/**
 * RMA context — module-scoped source of truth for the RMA list and the
 * action handler. Ported from vendor-invoicing's App.tsx (top-level state
 * lifted here so both the /rma list route and the /rma/$rmaNumber detail
 * route share the same source without needing an app-level `App` shell).
 *
 * TanStack Start SSR-safe: the initial state is a stable in-memory seed
 * from mockRMAs, and there's no localStorage read on init. Any browser
 * APIs live inside effect handlers.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  mockRMAs,
  rmaCanRevert,
  rmaMaterialEditable,
  rmaShipsDirect,
  type RMA,
  type RMALineItem,
  type RMAStatus,
} from "@/app/data/mockRMAs";
import { shipmentForShippedLine } from "@/app/data/rmaShipments";
import { mockVendors } from "@/app/data/mockVendors";
import {
  ACTION_VERSION_REASON,
  buildInitialVersion,
  buildRMAVersionSnapshot,
  diffRMASnapshots,
  initialsOf,
  stampChanges,
  toRMAVersionStatus,
  withSeededVersions,
  type RMADraftChange,
  type RMAVersionEntry,
} from "@/app/data/rmaVersions";
import type {
  RMAActionId,
  RMAActionPayload,
} from "@/app/components/RMADetailScreen";
import { restockingFeeAmount, rmaSettlementSummary } from "@/app/data/rmaGLEntries";

const CURRENT_USER = "Ahtisham Ahmad";

/* ── Versioning ──────────────────────────────────────────────────────────
   Ported from the Purchase Order module's version model. Every mutation the
   store makes cuts a version carrying a full snapshot of the return as it
   stood after the change, so a revert is a copy rather than a replay.

   Returns seeded before versioning existed have no history, so v1 is built
   lazily the first time one is touched. */

function ensureVersioned(r: RMA): RMA {
  if (r.versions && r.versions.length > 0) return r;
  return { ...r, versions: [buildInitialVersion(r)], currentVersion: 1 };
}

/** Appends a version describing how `next` differs from `prev`. A change that
 *  moved nothing the snapshot records is not worth a version, so the return is
 *  handed back untouched apart from the seeded history. */
function cutVersion(
  prev: RMA,
  next: RMA,
  reason: string,
  extra?: {
    changes?: RMADraftChange[];
    isRevert?: boolean;
    revertedFrom?: number;
    changeTags?: string[];
  },
): RMA {
  const seeded = ensureVersioned(prev);
  const history = seeded.versions ?? [];
  const beforeSnapshot = history[0]?.snapshot ?? buildRMAVersionSnapshot(seeded);
  const afterSnapshot = buildRMAVersionSnapshot(next);
  const changes = extra?.changes ?? diffRMASnapshots(beforeSnapshot, afterSnapshot);

  if (changes.length === 0) {
    return { ...next, versions: history, currentVersion: seeded.currentVersion ?? 1 };
  }

  const version = (seeded.currentVersion ?? history.length) + 1;
  const entry: RMAVersionEntry = {
    version,
    versionStatus: toRMAVersionStatus(next.status),
    createdAt: new Date().toISOString(),
    createdBy: CURRENT_USER,
    avatar: initialsOf(CURRENT_USER),
    reason,
    changes: stampChanges(next.id, version, CURRENT_USER, changes),
    snapshot: afterSnapshot,
    ...(extra?.isRevert ? { isRevert: true } : {}),
    ...(extra?.revertedFrom !== undefined ? { revertedFrom: extra.revertedFrom } : {}),
    ...(extra?.changeTags ? { changeTags: extra.changeTags } : {}),
    ...(prev.status !== next.status
      ? { previousStatus: prev.status, newStatus: next.status }
      : {}),
  };

  return { ...next, versions: [entry, ...history], currentVersion: version };
}

/* An edit never sends a return back to Draft (DQ-07, Eli, Nov 1). A Sent or
   Approved return that changes materially gets a new version and keeps its
   status: once the vendor approved it, it is approved, and nothing goes back
   to them for re-approval. The Purchase Order and Sales Order rule. */

/** What counts as a material change (DQ-07): the Purchase Order and Sales
 *  Order rule applied to returns. These are what the vendor agreed to, so a
 *  change to any of them makes a new version, and the status stays where
 *  it is:
 *    - items added, removed or modified, configuration included (part, unit,
 *      price, serials, lots, the receipts it is tied to)
 *    - quantity
 *    - ship to, and the refund account
 *    - payment method
 *    - credit or refund
 *    - vendor charges
 *  Everything else (owner, contact, notes, tags, carrier, shipping
 *  instruction, the vendor's RMA number, the expected date, a line's reason)
 *  is saved in place, with no version. */
const MATERIAL_LINE_FIELDS = [
  "sku",
  "uom",
  "returnQty",
  "unitPrice",
  "serialNumbers",
  "lots",
  "ties",
  "returnType",
  "originId",
] as const satisfies readonly (keyof RMALineItem)[];

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function isMaterialRMAChange(prev: RMA, next: RMA): boolean {
  if (prev.items.length !== next.items.length) return true;
  const before = new Map(prev.items.map((li) => [li.id, li]));
  for (const li of next.items) {
    const was = before.get(li.id);
    if (!was) return true;
    if (MATERIAL_LINE_FIELDS.some((k) => !same(was[k], li[k]))) return true;
  }
  const shipTo = (r: RMA) => [
    r.returnShipTo,
    r.returnShipToPartner,
    r.returnLegs.map((l) => [l.shipTo, l.shipToPartner]),
  ];
  return (
    !same(shipTo(prev), shipTo(next)) ||
    !same(prev.payToAccountId, next.payToAccountId) ||
    !same(prev.paymentMethodName, next.paymentMethodName) ||
    !same(prev.creditTerms?.refundOrCredit, next.creditTerms?.refundOrCredit) ||
    !same(prev.creditTerms?.restockingFee, next.creditTerms?.restockingFee) ||
    !same(prev.additionalCharges, next.additionalCharges)
  );
}

/** Saves an edit by the DQ-07 rule. A material change is refused once the
 *  first shipment has gone (the return is locked, DQ-09), and otherwise makes
 *  a version with the status unchanged. Anything else is written in place. */
function saveEdit(prev: RMA, next: RMA, reason: string): RMA {
  // A Draft is edited freely: nothing has gone to the vendor, so there is no
  // version to protect (DQ-07, the PO rule).
  if (prev.status === "Draft") return saveInPlace(prev, next);
  if (isMaterialRMAChange(prev, next)) {
    if (!rmaMaterialEditable(prev)) return prev;
    return cutVersion(prev, next, reason);
  }
  return saveInPlace(prev, next);
}

/** Writes a change onto the current version: no new version, and the current
 *  version's snapshot takes it too, so the next real version's change list
 *  holds only what changed in it. */
function saveInPlace(prev: RMA, next: RMA): RMA {
  const seeded = ensureVersioned(prev);
  const current = seeded.currentVersion ?? seeded.versions?.[0]?.version ?? 1;
  const snapshot = buildRMAVersionSnapshot(next);
  return {
    ...next,
    versions: (seeded.versions ?? []).map((v) =>
      v.version === current ? { ...v, snapshot } : v,
    ),
    currentVersion: current,
  };
}

/** What each lifecycle action is recorded as in the history. */
/** Created RMAs are mirrored here so a draft opened in a second browser tab
 *  resolves. A return that fans out to several vendor sites saves as one draft
 *  per site and opens each in its own tab, and a tab that only had the mock
 *  seed would 404 on every draft but the first. */
/*  Bumped to v2 when the staging location was dropped, so a v1 draft carrying
 *  a facility name that nothing reads any more is left behind. */
const CREATED_RMAS_STORAGE_KEY = "omnesoft:rma:created-drafts-v2";

function readCreatedRMAs(): RMA[] {
  try {
    const raw = window.localStorage.getItem(CREATED_RMAS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as RMA[]) : [];
  } catch {
    return [];
  }
}

/** What a reduction may touch: fewer units, the serials that go with them,
 *  and the line's own notes. Nothing the vendor priced or agreed to. */
export type RMALineReduction = Pick<RMALineItem, "returnQty"> &
  Partial<Pick<RMALineItem, "serialNumbers" | "settlements" | "notes" | "attachments">>;

interface RMAContextValue {
  rmas: RMA[];
  currentUser: string;
  /** Adds every draft a single save produced, in one state write, so a
   *  fan-out return's drafts all land before the tabs open. */
  addRMAs: (created: RMA[]) => void;
  /** Clones an RMA back to a fresh Draft and returns it so the caller can
   *  navigate straight to the copy. */
  applyRMAAction: (
    rmaId: string,
    action: RMAActionId,
    payload?: RMAActionPayload,
  ) => void;
  /** Edits a single return line. Material changes make a version up to the
   *  first shipment; after it the line can only be reduced, through
   *  `reduceRMALine`. */
  updateRMALine: (
    rmaId: string,
    lineId: string,
    patch: Partial<RMALineItem>,
  ) => void;
  /** Drops a line off the return. Before the first shipment it makes a new
   *  version; after it, it cancels a line still in the warehouse on the
   *  current version (ERP-8682). A shipped line, and the last line, stay. */
  removeRMALine: (rmaId: string, lineId: string) => void;
  /** After the first shipment: cuts the quantity of a line still in the
   *  warehouse, on the current version (ERP-8701). Never raises it. */
  reduceRMALine: (rmaId: string, lineId: string, patch: RMALineReduction) => void;
  /** The PO editing session (ERP-11107). After Draft, the first edit opens a
   *  session; every edit in it applies to the page without cutting a
   *  version, and Save Version records them all as one. Discard puts the
   *  return back as it was when the session opened. */
  editSessionActive: (rmaId: string) => boolean;
  startEditSession: (rmaId: string) => void;
  /** What Save Version would record, against the latest version. */
  editSessionChanges: (rmaId: string) => RMADraftChange[];
  /** Cuts the one version. The status stays where it is. */
  commitEditSession: (rmaId: string, reason?: string) => void;
  discardEditSession: (rmaId: string) => void;
  /** Edits the return's own header fields while it is still a Draft. */
  updateRMA: (rmaId: string, patch: Partial<RMA>) => void;
  /** Adds a note on the Notes tab. A note is a remark about the return, not
   *  a change to it, so it cuts no version and leaves the status alone,
   *  which `updateRMA` would not. */
  addRMANote: (rmaId: string, text: string) => void;
  /** Removes a note added on the Notes tab. */
  deleteRMANote: (rmaId: string, noteId: string) => void;
  /** Points the return back at an earlier version and restores it from that
   *  version's snapshot. Cuts no new version. */
  revertRMAToVersion: (rmaId: string, version: number, reason: string) => void;
  /** The restocking fee a vendor charges as a matter of course, as a
   *  percentage. Read from the vendor master, then from anything learned
   *  since: a fee pushed to a profile during this session lives here because
   *  the master is a static list. */
  restockingStandardFor: (vendorName: string) => number | undefined;
  /** Writes a fee onto a vendor's profile, where the next return finds it
   *  already filled in. */
  setRestockingStandard: (vendorName: string, pct: number) => void;
}

const RMAContext = createContext<RMAContextValue | null>(null);

export function RMAProvider({ children }: { children: ReactNode }) {
  // The seed records every lifecycle transition it went through, and each of
  // those is a version the store would have cut. Deriving them up front is
  // what gives a Closed return five versions instead of one.
  const [rmas, setRmas] = useState<RMA[]>(() => mockRMAs.map(withSeededVersions));
  /** Open editing sessions: the return as it stood when each one opened.
   *  Read through a ref inside the state updaters, which run outside render. */
  const [editSessions, setEditSessions] = useState<Record<string, RMA>>({});
  const editSessionsRef = useRef(editSessions);
  editSessionsRef.current = editSessions;
  // The ref moves first, so an edit queued in the same tick as the session
  // opening or closing already sees it.
  const endSession = (rmaId: string) => {
    if (rmaId in editSessionsRef.current) {
      const rest = { ...editSessionsRef.current };
      delete rest[rmaId];
      editSessionsRef.current = rest;
    }
    setEditSessions((prev) => {
      if (!(rmaId in prev)) return prev;
      const next = { ...prev };
      delete next[rmaId];
      return next;
    });
  };
  /** Inside a session an edit only applies; the version comes on Save.
   *  A material change is still refused once the return is locked. */
  const applyEdit = (prev: RMA, next: RMA, reason: string): RMA => {
    if (prev.status !== "Draft" && editSessionsRef.current[prev.id]) {
      if (isMaterialRMAChange(prev, next) && !rmaMaterialEditable(prev)) return prev;
      return next;
    }
    return saveEdit(prev, next, reason);
  };

  /** Restocking standards learned while the app has been open, keyed by
   *  vendor. The vendor master is a static list here, so a fee somebody
   *  pushed to a profile sits alongside it rather than in it.
   *
   *  It lives on the context rather than on a screen because three surfaces
   *  ask the same question -- the approval, the detail page's vendor charges,
   *  and the last step of the create flow -- and an answer given on one of
   *  them is meant to stop the other two asking.
   */
  const [learnedRestocking, setLearnedRestocking] = useState<Record<string, number>>({});
  const restockingStandardFor = useCallback(
    (vendorName: string): number | undefined =>
      learnedRestocking[vendorName] ??
      mockVendors.find((v) => v.vendorName === vendorName)?.restockingFeePct,
    [learnedRestocking],
  );
  const setRestockingStandard = useCallback((vendorName: string, pct: number) => {
    setLearnedRestocking((prev) => ({ ...prev, [vendorName]: pct }));
  }, []);

  // Read after mount, never on init, so the server and the first client
  // render agree.
  useEffect(() => {
    const stored = readCreatedRMAs();
    if (stored.length === 0) return;
    setRmas((prev) => {
      const known = new Set(prev.map((r) => r.id));
      const missing = stored.filter((r) => !known.has(r.id));
      return missing.length > 0 ? [...missing, ...prev] : prev;
    });
  }, []);

  const addRMAs = useCallback((created: RMA[]) => {
    if (created.length === 0) return;
    const seeded = created.map(ensureVersioned);
    setRmas((prev) => [...seeded, ...prev]);
    try {
      window.localStorage.setItem(
        CREATED_RMAS_STORAGE_KEY,
        JSON.stringify([...seeded, ...readCreatedRMAs()]),
      );
    } catch {
      // A full or blocked store only costs the new-tab hand-off, so the
      // save itself still stands.
    }
  }, []);

  const applyRMAAction = useCallback(
    (rmaId: string, action: RMAActionId, payload?: RMAActionPayload) => {
      // A lifecycle action cuts its own version, which takes any edits still
      // open in a session along with it.
      endSession(rmaId);
      const at = new Date().toISOString();
      const day = at.split("T")[0]!;
      setRmas((prev) =>
        prev.map((r) => {
          if (r.id !== rmaId) return r;
          let nextStatus: RMAStatus = r.status;
          const next: RMA = { ...r };
          switch (action) {
            case "submit":
              if (r.status === "Draft") nextStatus = "Sent";
              next.sentDate = day;
              break;
            case "approve": {
              if (r.status === "Sent") nextStatus = "Approved";
              next.approvedDate = day;
              if (payload?.vendorRMANumber)
                next.vendorRMANumber = payload.vendorRMANumber;
              // What the vendor said about paying, taken down on the call that
              // authorized the return. Stamped with the day so a promise
              // counted from "today" still resolves to a date later, once
              // today has stopped being today.
              if (payload?.refundExpectation) {
                next.refundExpectation = {
                  ...payload.refundExpectation,
                  at: new Date().toISOString(),
                  by: CURRENT_USER,
                };
              }
              // What the vendor keeps back. Always written, including a zero,
              // because "they are not charging one" is an answer somebody
              // gave and a blank is a question nobody asked.
              if (payload?.restockingPct !== undefined) {
                next.creditTerms = {
                  ...(r.creditTerms ?? { creditPct: 100 }),
                  restockingFee: payload.restockingPct,
                };
              }
              // Every line gets an approved qty, including the ones the vendor
              // took in full. A line left undefined would keep reading as an
              // unanswered request after the RMA is already authorized.
              const byLine = new Map(
                (payload?.lineApprovals ?? []).map((a) => [a.lineId, a]),
              );
              next.items = r.items.map((li) => {
                const a = byLine.get(li.id);
                // A type the vendor changed is recorded beside the one asked
                // for, never over it, so the line still says what was wanted.
                const authorizedType =
                  a?.returnType && a.returnType !== (li.returnType ?? r.returnType)
                    ? a.returnType
                    : undefined;
                return {
                  ...li,
                  approvedQty: a ? a.approvedQty : li.returnQty,
                  ...(authorizedType ? { approvedReturnType: authorizedType } : {}),
                  ...(a?.note ? { approvalNote: a.note } : {}),
                };
              });
              break;
            }
            case "ship": {
              // A company with Sent and Approved off ships straight from
              // Draft (DQ-03). Nobody authorized a cut, so every line goes
              // back in full.
              const direct = r.status === "Draft" && rmaShipsDirect(r);
              if (r.status === "Approved" || direct) nextStatus = "Shipped to Vendor";
              if (direct)
                next.items = r.items.map((li) => ({ ...li, approvedQty: li.returnQty }));
              next.shippedDate = day;
              if (payload?.carrier) next.carrier = payload.carrier;
              if (payload?.returnShipTo)
                next.returnShipTo = payload.returnShipTo;
              // DQ-01 (Eli, Nov 2): a credit return closes once everything
              // has shipped. It does not wait for the credit: the system
              // raises a pending credit here, and accounting confirms it in
              // partner credits against the vendor's memo. Nothing is
              // settled yet, so the GL steps after the shipment stay
              // projected until that confirmation.
              if (
                nextStatus === "Shipped to Vendor" &&
                r.creditTerms?.refundOrCredit === "Credit"
              ) {
                nextStatus = "Closed";
                next.resolvedDate = day;
                next.pendingCredit = {
                  ref: `PC-${r.rmaNumber.replace("RMA-", "")}`,
                  raisedDate: day,
                  // Everything that claims money back, less what the vendor
                  // keeps. On a credit return it all comes back as credit.
                  amount: (() => {
                    const sum = rmaSettlementSummary({ ...r, ...next } as RMA);
                    return Math.max(0, Math.round((sum.claimed - sum.charges) * 100) / 100);
                  })(),
                };
              }
              break;
            }
            case "close":
              if (r.status === "Shipped to Vendor") nextStatus = "Closed";
              next.receivedDate = day;
              next.resolvedDate = day;
              // Closing is what clears Other Receivables – Vendor Returns, so the GL steps
              // after the shipment hang off it. Without this the ledger sat
              // at "goods shipped, everything else projected" on a return
              // that was finished.
              next.settledDate = r.settledDate ?? day;
              next.cashRefundedDate = r.cashRefundedDate ?? day;
              break;
            case "receive-goods":
              // The detailed path to the same stop — it captures the date the
              // goods actually landed and their condition, which is why the
              // arrival and the settlement can carry different dates here.
              if (r.status === "Shipped to Vendor") nextStatus = "Closed";
              next.receivedDate = payload?.receivedDate ?? day;
              next.resolvedDate = day;
              next.settledDate = r.settledDate ?? day;
              next.cashRefundedDate = r.cashRefundedDate ?? day;
              if (payload?.receivedCondition)
                next.receivedCondition = payload.receivedCondition;
              break;
            case "record-credit":
              if (payload?.creditAmountReceived !== undefined)
                next.creditAmountReceived = payload.creditAmountReceived;
              if (payload?.creditNoteRef)
                next.creditNoteRef = payload.creditNoteRef;
              // The credit note is the settlement event, whatever it settled
              // for. A short one still clears the holding account: the gap
              // leaves as a loss rather than staying parked there.
              next.settledDate = r.settledDate ?? day;
              if (payload?.creditReceiptFileName)
                next.attachments = [
                  ...(r.attachments ?? []),
                  { name: payload.creditReceiptFileName },
                ];
              break;
            // Money, or a credit memo in place of it. Eli, Oct 7: a refund
            // return stays open like an open invoice until the payment is
            // logged, and logging it is what closes the return. There is no
            // close action of its own.
            case "log-settlement": {
              const entry = payload?.settlement;
              if (!entry) break;
              // Refund returns only. A credit return closed when it shipped
              // and its credit is accounting's to confirm (DQ-01).
              if (r.creditTerms?.refundOrCredit === "Credit") return r;
              const logged = [
                ...(r.settlementEntries ?? []),
                {
                  id: `set-${r.id}-${(r.settlementEntries?.length ?? 0) + 1}`,
                  ...entry,
                  by: CURRENT_USER,
                },
              ];
              next.settlementEntries = logged;
              // A charge accounting found on the remittance joins the
              // return's Vendor charges, so the summary, the expected amount
              // and the GL all read it (ERP-8664).
              if (payload?.addedCharges?.length) {
                const existing = r.additionalCharges ?? [];
                let nextId = existing.reduce((m, c) => Math.max(m, c.id), 0);
                next.additionalCharges = [
                  ...existing,
                  ...payload.addedCharges.map((c) => ({ ...c, id: ++nextId })),
                ];
              }
              // One figure for what came back, however many events it took.
              next.creditAmountReceived =
                Math.round(logged.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
              if (entry.fileName)
                next.attachments = [...(r.attachments ?? []), { name: entry.fileName }];
              // A part payment. The rest is still coming, so the return stays
              // where it is, still awaiting refund, and none of the settlement
              // milestones land: they would book the gap as a loss.
              if (payload?.keepOpen) break;
              next.settledDate = r.settledDate ?? entry.date;
              // The money landed, so the bank sees it. A loss with nothing
              // sent back moves no cash.
              if (entry.amount > 0) {
                next.cashRefundedDate = r.cashRefundedDate ?? entry.date;
              }
              if (r.status === "Shipped to Vendor") nextStatus = "Closed";
              // Short, and the user said so on purpose. Still Closed for
              // every rule that checks it; it just reads as Closed with loss.
              const loss = payload?.settlementLoss ?? 0;
              if (entry.lossAcknowledged && loss > 0.004) {
                nextStatus = "Closed";
                next.closedWithLoss = true;
                next.settlementLoss = loss;
              }
              next.receivedDate = r.receivedDate ?? day;
              next.resolvedDate = entry.date;
              break;
            }
            case "record-refund":
              next.cashRefundedDate = payload?.refundedDate ?? day;
              next.settledDate = r.settledDate ?? next.cashRefundedDate;
              break;
            case "record-refusal":
              // The goods shipped and the vendor turned them away. The
              // return is over, and it is over at a loss.
              if (r.status === "Shipped to Vendor" || r.status === "Closed")
                nextStatus = "Closed";
              next.refusedDate = day;
              next.resolvedDate = day;
              if (payload?.reason) next.refusalNote = payload.reason;
              break;
            case "cancel":
              // Only on Sent or Approved: a Draft is not cancelled, and once
              // the goods ship the way out is a settlement or a refusal. The
              // menus offer it nowhere else; this refuses it from anywhere.
              if (r.status !== "Sent" && r.status !== "Approved") return r;
              // Nor once a shipment has gone out: part of it is with the vendor.
              if (r.shipmentStartedDate) return r;
              nextStatus = "Cancelled";
              next.resolvedDate = day;
              break;
            case "archive":
              next.archived = true;
              break;
          }
          // The agreed fee, said in money.
          //
          // Approval records a percentage, because that is what a vendor
          // quotes. Everything that shows money -- the Return Summary, the
          // version snapshot -- reads dollar lines off `additionalCharges`, so
          // a fee that only ever existed as a percentage was announced in the
          // dialog and then appeared nowhere afterwards. The percentage stays
          // on `creditTerms` as the vendor's standing term; this is what it
          // costs on this return.
          if (payload?.restockingPct !== undefined) {
            const merged = { ...r, ...next } as RMA;
            const owed = restockingFeeAmount(merged, payload.restockingPct);
            const rest = (r.additionalCharges ?? []).filter(
              (c) => c.type !== "Restocking fee",
            );
            next.additionalCharges =
              owed > 0.004
                ? [
                    ...rest,
                    {
                      id: Math.max(0, ...rest.map((c) => c.id)) + 1,
                      type: "Restocking fee",
                      amount: owed,
                      description: `${payload.restockingPct}% of the return value, agreed at approval`,
                    },
                  ]
                : rest;
          }
          next.status = nextStatus;
          next.actionHistory = [
            ...(r.actionHistory ?? []),
            { action, by: CURRENT_USER, at, reason: payload?.reason },
          ];
          return cutVersion(
            r,
            next,
            payload?.reason?.trim() || ACTION_VERSION_REASON[action] || "Return updated",
          );
        }),
      );
    },
    [],
  );

  const updateRMALine = useCallback(
    (rmaId: string, lineId: string, patch: Partial<RMALineItem>) => {
      setRmas((prev) =>
        prev.map((r) => {
          if (r.id !== rmaId) return r;
          const next: RMA = {
            ...r,
            items: r.items.map((li) =>
              li.id === lineId ? { ...li, ...patch } : li,
            ),
          };
          return applyEdit(r, next, "Return line edited");
        }),
      );
    },
    [],
  );

  const removeRMALine = useCallback((rmaId: string, lineId: string) => {
    setRmas((prev) =>
      prev.map((r) => {
        if (r.id !== rmaId || r.items.length <= 1) return r;
        const next: RMA = { ...r, items: r.items.filter((li) => li.id !== lineId) };
        // Locked since the first shipment: a line still in the warehouse is
        // cancelled on the version the vendor already has.
        if (r.shipmentStartedDate) {
          if (shipmentForShippedLine(r, lineId)) return r;
          return saveInPlace(r, next);
        }
        return applyEdit(r, next, "Return line removed");
      }),
    );
  }, []);

  const reduceRMALine = useCallback(
    (rmaId: string, lineId: string, patch: RMALineReduction) => {
      setRmas((prev) =>
        prev.map((r) => {
          if (r.id !== rmaId) return r;
          const was = r.items.find((li) => li.id === lineId);
          if (!was || shipmentForShippedLine(r, lineId)) return r;
          if (patch.returnQty < 1 || patch.returnQty > was.returnQty) return r;
          const next: RMA = {
            ...r,
            items: r.items.map((li) => (li.id === lineId ? { ...li, ...patch } : li)),
          };
          return saveInPlace(r, next);
        }),
      );
    },
    [],
  );

  const updateRMA = useCallback((rmaId: string, patch: Partial<RMA>) => {
    setRmas((prev) =>
      prev.map((r) =>
        r.id === rmaId
          ? applyEdit(r, { ...r, ...patch }, "Return details edited")
          : r,
      ),
    );
  }, []);

  const editSessionActive = useCallback((rmaId: string) => rmaId in editSessions, [editSessions]);

  const startEditSession = useCallback(
    (rmaId: string) => {
      const base = rmas.find((r) => r.id === rmaId);
      if (!base || rmaId in editSessionsRef.current) return;
      const opened = ensureVersioned(base);
      editSessionsRef.current = { ...editSessionsRef.current, [rmaId]: opened };
      setEditSessions((prev) => ({ ...prev, [rmaId]: opened }));
    },
    [rmas],
  );

  const editSessionChanges = useCallback(
    (rmaId: string): RMADraftChange[] => {
      const base = editSessions[rmaId];
      const now = rmas.find((r) => r.id === rmaId);
      if (!base || !now) return [];
      const latest = base.versions?.[0]?.snapshot ?? buildRMAVersionSnapshot(base);
      return diffRMASnapshots(latest, buildRMAVersionSnapshot(now));
    },
    [editSessions, rmas],
  );

  const commitEditSession = useCallback((rmaId: string, reason?: string) => {
    const base = editSessionsRef.current[rmaId];
    if (!base) return;
    setRmas((prev) =>
      prev.map((r) => (r.id === rmaId ? cutVersion(base, r, reason?.trim() || "Return edited") : r)),
    );
    endSession(rmaId);
  }, []);

  const discardEditSession = useCallback((rmaId: string) => {
    const base = editSessionsRef.current[rmaId];
    if (!base) return;
    setRmas((prev) => prev.map((r) => (r.id === rmaId ? base : r)));
    endSession(rmaId);
  }, []);

  const addRMANote = useCallback((rmaId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setRmas((prev) =>
      prev.map((r) =>
        r.id === rmaId
          ? {
              ...r,
              noteLog: [
                { id: `note-${Date.now()}`, text: trimmed, author: CURRENT_USER, at: new Date().toISOString() },
                ...(r.noteLog ?? []),
              ],
            }
          : r,
      ),
    );
  }, []);

  const deleteRMANote = useCallback((rmaId: string, noteId: string) => {
    setRmas((prev) =>
      prev.map((r) =>
        r.id === rmaId ? { ...r, noteLog: (r.noteLog ?? []).filter((n) => n.id !== noteId) } : r,
      ),
    );
  }, []);

  /* Reverting points `currentVersion` back at the picked version and restores
     the return from its snapshot. No new version is cut, matching the PO
     module: the version reverted to becomes current again, and the versions
     in between stay in the history. The reason is stamped onto the version
     that was reverted to, so its card can say why. */
  const revertRMAToVersion = useCallback(
    (rmaId: string, version: number, reason: string) => {
      setRmas((prev) =>
        prev.map((r) => {
          if (r.id !== rmaId) return r;
          // Locked from the first shipment on (DQ-09). The menus stop
          // offering it there; this refuses it from anywhere.
          if (!rmaCanRevert(r)) return r;
          const seeded = ensureVersioned(r);
          const history = seeded.versions ?? [];
          const source = history.find((v) => v.version === version);
          if (!source) return r;
          const at = new Date().toISOString();
          const trimmed = reason.trim();

          const nextHistory = history.map((v) =>
            v.version === version && trimmed
              ? {
                  ...v,
                  revertReason: trimmed,
                  revertReasonAt: at,
                  revertReasonBy: CURRENT_USER,
                }
              : v,
          );

          const snap = source.snapshot;
          const restored: RMA = {
            ...seeded,
            // The status stays where it is (DQ-09). A revert brings back
            // what the return said, not where it stood: an Approved return
            // reverted to its Draft wording is still Approved, and nothing
            // is sent back to Draft.
            status: seeded.status,
            // The header's type and reason are not restored, because the
            // snapshot no longer carries them: both are per line, and the
            // lines below bring back their own.
            owner: snap.owner,
            ...(snap.vendorRMANumber ? { vendorRMANumber: snap.vendorRMANumber } : {}),
            ...(snap.expectedResolutionDate
              ? { expectedResolutionDate: snap.expectedResolutionDate }
              : {}),
            ...(snap.pointOfContact ? { pointOfContact: snap.pointOfContact } : {}),
            ...(snap.notes ? { notes: snap.notes } : {}),
            ...(snap.shippingInstruction
              ? { shippingInstruction: snap.shippingInstruction }
              : {}),
            ...(snap.carrier ? { carrier: snap.carrier } : {}),
            ...(snap.returnShipTo ? { returnShipTo: snap.returnShipTo } : {}),
            ...(snap.returnShipToPartner
              ? { returnShipToPartner: snap.returnShipToPartner }
              : {}),
            ...(snap.payToAccountId ? { payToAccountId: snap.payToAccountId } : {}),
            items: snap.lineItems.map((li) => {
              const match = seeded.items.find((x) => x.id === li.id);
              const base = match ?? seeded.items[0]!;
              return {
                ...base,
                id: li.id,
                sku: li.sku,
                description: li.description,
                uom: li.uom,
                returnQty: li.returnQty,
                unitPrice: li.unitPrice,
                reason: li.reason,
                originName: li.originName,
                ...(li.approvedQty !== undefined ? { approvedQty: li.approvedQty } : {}),
                ...(li.returnType ? { returnType: li.returnType } : {}),
                ...(li.approvedReturnType
                  ? { approvedReturnType: li.approvedReturnType }
                  : {}),
                ...(li.serialNumbers ? { serialNumbers: li.serialNumbers } : {}),
                // Lots travel with the line the way serials do. This mapper
                // rebuilt every other field and silently dropped them, so
                // reverting a lot-tracked line to an earlier version came back
                // with no batch IDs on it at all.
                ...(li.lots ? { lots: li.lots } : {}),
                ...(li.notes ? { notes: li.notes } : {}),
              };
            }),
            versions: nextHistory,
            currentVersion: version,
            actionHistory: [
              ...(seeded.actionHistory ?? []),
              {
                action: "revert",
                by: CURRENT_USER,
                at,
                reason: trimmed || `Reverted to version ${version}`,
              },
            ],
          };
          return restored;
        }),
      );
    },
    [],
  );

  const value = useMemo<RMAContextValue>(
    () => ({ rmas, currentUser: CURRENT_USER, addRMAs, applyRMAAction, updateRMALine, removeRMALine, reduceRMALine, editSessionActive, startEditSession, editSessionChanges, commitEditSession, discardEditSession, updateRMA, addRMANote, deleteRMANote, revertRMAToVersion, restockingStandardFor, setRestockingStandard }),
    [rmas, addRMAs, applyRMAAction, updateRMALine, removeRMALine, reduceRMALine, editSessionActive, startEditSession, editSessionChanges, commitEditSession, discardEditSession, updateRMA, addRMANote, deleteRMANote, revertRMAToVersion, restockingStandardFor, setRestockingStandard],
  );

  return <RMAContext.Provider value={value}>{children}</RMAContext.Provider>;
}

export function useRMAContext(): RMAContextValue {
  const ctx = useContext(RMAContext);
  if (!ctx) {
    throw new Error("useRMAContext must be used inside <RMAProvider>");
  }
  return ctx;
}
