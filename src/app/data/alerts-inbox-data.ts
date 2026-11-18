import { ALERT_MODULES } from "./alerts-data";

/* ─── Alerts inbox: what lands in the bell ───
 *
 * The catalog in `alerts-data.ts` defines WHAT an alert is (name, in-app copy,
 * channels, who receives it). This file defines what a DELIVERED alert looks
 * like once it has fired and been routed to the signed-in user: one alert
 * object, read state held per recipient, the card action the catalog gives it
 * (if any), and the record it deep-links to.
 *
 * Nothing here is invented copy. Headline and body are the catalog's
 * `inAppTitle` / `inAppText`, unaltered, as the PRD requires. The only thing
 * generated is the history (record ids are varied so a heavy user's list looks
 * like a heavy user's list).
 */

export type ActionChoice = "primary" | "secondary";

/** A card action as the catalog defines it for an alert. `secondary` is absent
 *  for single-control actions such as "Send new link". */
export interface CardActionDef {
  primary: string;
  secondary?: string;
  /** Past tense, shown once the action has completed. */
  donePrimary: string;
  doneSecondary?: string;
  /** Present participle, shown while the action is in flight. */
  progressPrimary: string;
  progressSecondary?: string;
}

export type ActionState =
  | { status: "idle" }
  | { status: "pending"; choice: ActionChoice }
  | { status: "done"; choice: ActionChoice; at: number; alreadyInRecord: boolean }
  | { status: "failed"; choice: ActionChoice };

/** Where the deep link can land. Anything other than `available` keeps the
 *  alert in the list, marks it read on click, and shows a message instead of
 *  navigating (PRD 07, Record unavailable). */
export type RecordAvailability = "available" | "unavailable" | "inaccessible";

export interface InboxAlert {
  id: string;
  /** Catalog alert id. */
  alertId: string;
  /** Catalog alert name, exactly as written. */
  name: string;
  moduleId: string;
  moduleName: string;
  /** Catalog `inAppTitle`. */
  title: string;
  /** Catalog `inAppText`, one sentence on what happened and whether a response is needed. */
  body: string;
  firedAt: number;
  /** Read state for the signed-in user only. Other recipients hold their own. */
  read: boolean;
  /** The alert wants a response, whether on the card or in the record. */
  actionRequired: boolean;
  cardAction?: CardActionDef;
  actionState: ActionState;
  /** Deep link: the screen and view where the exception is resolved. */
  target: { path: string; recordLabel: string };
  record: RecordAvailability;
  /** Prototype only: the first attempt at the card action fails, so the failure state can be exercised. */
  failFirstAttempt?: boolean;
  /** Prototype only: the same decision was already taken in the record. */
  decidedInRecord?: boolean;
}

/* ─── Access ───
 * Modules the signed-in user can open. The module filter lists only these
 * (NP-05), and no alert is generated for a module outside this set (NP-16).
 * Seeded statically for the prototype. */
export const MY_ALERT_MODULE_IDS: ReadonlySet<string> = new Set([
  "items-library",
  "cycle-count",
  "inventory-movement",
  "lot-management",
  "partners",
  "shipment",
  "quotes",
  "sales-orders",
  "purchase-orders",
  "receiving-documents",
  "users",
]);

/** Modules the user has access to that ship alerts, in catalog order. */
export const MY_ALERT_MODULES = ALERT_MODULES.filter(
  (m) => m.hasAlerts && MY_ALERT_MODULE_IDS.has(m.moduleId),
);

/* ─── Catalog extensions ───
 * Per-alert facts the PRD says the catalog owns but the current catalog does
 * not yet carry: the card action (NP-03), whether a response is needed, and
 * the deep-link destination (NP-10). Keyed by the alert's exact name so they
 * join the same way `predefined-roles.ts` does. */

const APPROVE_REJECT: CardActionDef = {
  primary: "Approve",
  secondary: "Reject",
  donePrimary: "Approved",
  doneSecondary: "Rejected",
  progressPrimary: "Approving",
  progressSecondary: "Rejecting",
};

const ACCEPT_DECLINE: CardActionDef = {
  primary: "Accept",
  secondary: "Decline",
  donePrimary: "Accepted",
  doneSecondary: "Declined",
  progressPrimary: "Accepting",
  progressSecondary: "Declining",
};

const CARD_ACTIONS_BY_NAME: Record<string, CardActionDef> = {
  "Plan Discrepancy Requires Your Approval": APPROVE_REJECT,
  "New Permission Request Submitted": APPROVE_REJECT,
  "Cycle Count Plan Assignment": ACCEPT_DECLINE,
  "User Requested New Invitation Link": {
    primary: "Send new link",
    donePrimary: "New link sent",
    progressPrimary: "Sending",
  },
};

const ACTION_REQUIRED_NAMES = new Set<string>([
  "Vendor Removed from QVL",
  "Category Owner Removed",
  "Category Deactivated",
  "Cycle Count Plan Assignment",
  "Cycle Count Plan Declined: Action Required",
  "Plan Discrepancy Requires Your Approval",
  "Recount Requested for a Line Item",
  "Issue Reported on a Counted Item",
  "Issue Reported During Movement",
  "Shipment Delay Expected: Movement Overdue",
  "Lot Expired",
  "Lot Quarantined",
  "Credit Limit Exceeded",
  "Pick Task Assignment",
  "Quote Expiring Soon",
  "Quote Item Made Inactive",
  "Insufficient Inventory for Order",
  "Complete Your Purchase Order",
  "Received More Than Ordered",
  "Damaged Items Received",
  "Delivery Past Due Date",
  "Over Receipt on Delivery",
  "Item Mismatch on Receipt",
  "Lot Quarantined on Receipt",
  "User Requested New Invitation Link",
  "New Permission Request Submitted",
  "Pending Task Needs Reassignment",
]);

/** Module landing routes. The deep link appends the record so it lands on the
 *  record's own screen, not the module home. Most of these are placeholder
 *  routes in this prototype; the Users module is real. */
const MODULE_PATHS: Record<string, string> = {
  "items-library": "/items-inventory/items-library",
  "item-categories": "/items-inventory/categories",
  "cycle-count": "/items-inventory/cycle-count",
  "inventory-movement": "/items-inventory/inventory-movement",
  "lot-management": "/items-inventory/lot-management",
  partners: "/vendors",
  shipment: "/supply-chain/shipment",
  quotes: "/supply-chain/quotes",
  "sales-orders": "/supply-chain/orders",
  "purchase-orders": "/supply-chain/purchase-orders",
  "receiving-documents": "/supply-chain/receiving-documents",
  users: "/company-settings/user-access-control",
};

/** Views inside a record where specific exceptions are worked, so the link
 *  lands on the view, not just the record (NP-10). */
const RECORD_VIEWS_BY_NAME: Record<string, string> = {
  "Plan Discrepancy Requires Your Approval": "discrepancies",
  "Recount Requested for a Line Item": "recounts",
  "Issue Reported on a Counted Item": "issues",
  "Issue Reported During Movement": "issues",
  "Received More Than Ordered": "receipts",
  "Over Receipt on Delivery": "lines",
  "Item Mismatch on Receipt": "lines",
  "Damaged Items Received": "receipts",
  "Lot Quarantined on Receipt": "quality",
  "New Permission Request Submitted": "requests",
  "User Requested New Invitation Link": "invitations",
  "Pending Task Needs Reassignment": "tasks",
};

/* ─── Templates: one per in-app alert the user can receive ─── */

export interface InboxAlertTemplate {
  alertId: string;
  name: string;
  moduleId: string;
  moduleName: string;
  title: string;
  body: string;
  actionRequired: boolean;
  cardAction?: CardActionDef;
  basePath: string;
}

const RECORD_ID_RE = /\b(?:[A-Z]{2,3}-\d{4}-\d{4}|PO-\d{4}-\d{4}|LOT-\d{4}-\d{4}|SKU-\d{3,5}|QT-\d{4}-\d{4})\b/;

export const INBOX_TEMPLATES: InboxAlertTemplate[] = ALERT_MODULES.flatMap((m) =>
  m.alerts
    .filter((a) => a.channels.includes("in-app"))
    .map<InboxAlertTemplate>((a) => ({
      alertId: a.id,
      name: a.title,
      moduleId: m.moduleId,
      moduleName: m.name,
      title: a.preview.inAppTitle,
      body: a.preview.inAppText,
      actionRequired: ACTION_REQUIRED_NAMES.has(a.title),
      cardAction: CARD_ACTIONS_BY_NAME[a.title],
      basePath: MODULE_PATHS[m.moduleId] ?? "/",
    })),
);

const TEMPLATE_BY_NAME: Record<string, InboxAlertTemplate> = Object.fromEntries(
  INBOX_TEMPLATES.map((t) => [t.name, t]),
);

/** The record the alert is about, lifted from its own copy. Falls back to the
 *  module name when the copy names no record. */
export function recordLabelOf(body: string, fallback: string): string {
  const m = body.match(RECORD_ID_RE);
  return m ? m[0] : fallback;
}

/** Vary the record ids inside a body so repeated alerts of one type read as
 *  different records. Every occurrence of the same id is replaced the same way,
 *  so the sentence stays coherent. */
function varyRecordIds(body: string, seed: number): string {
  const seen = new Map<string, string>();
  return body.replace(new RegExp(RECORD_ID_RE.source, "g"), (id) => {
    if (!seen.has(id)) {
      const digits = id.match(/\d+$/)?.[0] ?? "";
      const next = String((parseInt(digits || "0", 10) + seed * 37) % 10000).padStart(digits.length, "0");
      seen.set(id, id.replace(/\d+$/, next));
    }
    return seen.get(id)!;
  });
}

interface BuildOptions {
  firedAt: number;
  read: boolean;
  seed?: number;
  record?: RecordAvailability;
  failFirstAttempt?: boolean;
  decidedInRecord?: boolean;
}

let counter = 0;

function build(name: string, opts: BuildOptions): InboxAlert {
  const t = TEMPLATE_BY_NAME[name];
  if (!t) throw new Error(`Unknown alert "${name}"`);
  const body = opts.seed ? varyRecordIds(t.body, opts.seed) : t.body;
  const recordLabel = recordLabelOf(body, t.moduleName);
  const view = RECORD_VIEWS_BY_NAME[name];
  const path =
    recordLabel === t.moduleName
      ? t.basePath
      : `${t.basePath}/${recordLabel}${view ? `?view=${view}` : ""}`;
  counter += 1;
  return {
    id: `al-${counter}`,
    alertId: t.alertId,
    name: t.name,
    moduleId: t.moduleId,
    moduleName: t.moduleName,
    title: t.title,
    body,
    firedAt: opts.firedAt,
    read: opts.read,
    actionRequired: t.actionRequired,
    cardAction: t.cardAction,
    actionState: { status: "idle" },
    target: { path, recordLabel },
    record: opts.record ?? "available",
    failFirstAttempt: opts.failFirstAttempt,
    decidedInRecord: opts.decidedInRecord,
  };
}

/* ─── Seeded generator (mulberry32) so the history is stable across reloads ─── */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

function startOfToday(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The signed-in user's inbox at load time: an authored recent window that
 *  exercises every state the PRD names, and a generated history behind it. */
export function buildInitialInbox(now: number = Date.now()): InboxAlert[] {
  counter = 0;
  const today = startOfToday(now);
  const yesterday = today - DAY;
  const at = (dayStart: number, h: number, m: number) => dayStart + h * HOUR + m * MIN;

  const authored: InboxAlert[] = [
    /* Today */
    build("Plan Discrepancy Requires Your Approval", { firedAt: now - 8 * MIN, read: false }),
    build("Damaged Items Received", { firedAt: now - 34 * MIN, read: false }),
    build("Cycle Count Plan Assignment", { firedAt: now - 70 * MIN, read: false }),
    build("Shipment Delay Expected: Movement Overdue", { firedAt: now - 2 * HOUR - 12 * MIN, read: false }),
    build("New Permission Request Submitted", { firedAt: now - 3 * HOUR - 5 * MIN, read: false, failFirstAttempt: true }),
    build("Lot Expiry Warning", { firedAt: now - 4 * HOUR - 20 * MIN, read: true }),
    build("Recount Requested for a Line Item", { firedAt: now - 5 * HOUR - 2 * MIN, read: true }),
    build("Purchase Order Cancelled", { firedAt: now - 6 * HOUR - 40 * MIN, read: true, record: "unavailable" }),
    /* Yesterday */
    build("User Requested New Invitation Link", { firedAt: at(yesterday, 16, 12), read: false }),
    build("Plan Discrepancy Requires Your Approval", { firedAt: at(yesterday, 14, 5), read: false, seed: 3, decidedInRecord: true }),
    build("Item Mismatch on Receipt", { firedAt: at(yesterday, 11, 40), read: true }),
    build("Quote Expiring Soon", { firedAt: at(yesterday, 9, 15), read: true }),
    build("Vendor Removed from QVL", { firedAt: at(yesterday, 8, 30), read: true, record: "inaccessible" }),
  ].filter((a) => a.firedAt <= now);

  /* Generated history: the previous 60 days, weighted toward action-heavy
   * modules, almost entirely read. A handful of unread items sit in the last
   * week so the Unread filter has something older than today to show. */
  const random = rng(20260903);
  const pool = INBOX_TEMPLATES.filter((t) => MY_ALERT_MODULE_IDS.has(t.moduleId));
  const history: InboxAlert[] = [];
  const TOTAL = 128;
  for (let i = 0; i < TOTAL; i += 1) {
    const daysAgo = 2 + Math.floor(random() * 59);
    const dayStart = today - daysAgo * DAY;
    const firedAt = at(dayStart, 7 + Math.floor(random() * 11), Math.floor(random() * 60));
    const t = pool[Math.floor(random() * pool.length)];
    const read = daysAgo > 6 || random() > 0.35;
    history.push(build(t.name, { firedAt, read, seed: 1 + Math.floor(random() * 2500) }));
  }

  return [...authored, ...history].sort((a, b) => b.firedAt - a.firedAt);
}

/** The alert the prototype delivers live a little after load (NP-11). */
export function buildIncomingAlert(now: number = Date.now()): InboxAlert {
  return build("Over Receipt on Delivery", { firedAt: now, read: false, seed: 41 });
}

/** A row for the in-app preview inside Notification Settings. */
export function buildPreviewAlert(
  partial: { title: string; body: string; moduleName?: string; read?: boolean; minutesAgo?: number },
  now: number = Date.now(),
): InboxAlert {
  const body = partial.body;
  const moduleName = partial.moduleName ?? "Omne";
  return {
    id: `preview-${partial.title}-${partial.minutesAgo ?? 0}`,
    alertId: "preview",
    name: partial.title,
    moduleId: "preview",
    moduleName,
    title: partial.title,
    body,
    firedAt: now - (partial.minutesAgo ?? 0) * MIN,
    read: partial.read ?? false,
    actionRequired: false,
    actionState: { status: "idle" },
    target: { path: "#", recordLabel: recordLabelOf(body, moduleName) },
    record: "available",
  };
}
