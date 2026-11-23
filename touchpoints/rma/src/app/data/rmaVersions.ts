/**
 * Version history for a return authorization.
 *
 * Ported from the Purchase Order module's `poStore.ts` version model
 * (`POVersionEntry` / `POChangeRecord` / `buildVersionSnapshot` /
 * `revertPOToVersion`) so the two modules read the same way. The shape is
 * kept identical; only the taxonomy is restated in return nouns, since a
 * return has no pricing rules and a PO has no authorization.
 *
 * Snapshots are full, not diffs. A return is small enough that storing the
 * whole document per version is cheaper than reconstructing it by replay,
 * and it means a revert is a copy rather than an inverse.
 */

import {
  authorizedQty,
  type RMA,
  type RMALineItem,
  type RMALotAllocation,
  type RMAStatus,
  type ReturnReason,
  type ReturnType,
} from './mockRMAs';
import { restockingFeeAmount } from '@/app/data/rmaGLEntries';
import { PAY_FROM_ACCOUNTS } from './mockPayments';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney } from '@/app/currency/money';
import { RATE_TYPE_LABEL, toBase, type MoneyFx, type RateType } from '@/app/currency/rates';
import { returnFx, rmaCurrency } from '@/app/currency/returnCurrency';

/* ── Taxonomy ───────────────────────────────────────────────────────── */

/** The lifecycle stop the return stood at when the version was cut. */
export type RMAVersionStatus =
  | 'draft'
  | 'sent'
  | 'approved'
  | 'shipped'
  | 'closed'
  | 'cancelled';

/** Mirrors PO's `POChangeType`, restated for a return. `authorization-changed`
 *  is the return-side equivalent of PO's `rule-applied`: the vendor's answer
 *  rather than a price the buyer set. */
export type RMAChangeType =
  | 'line-item-added'
  | 'line-item-removed'
  | 'line-item-modified'
  | 'authorization-changed'
  | 'value-changed'
  | 'logistics-changed'
  | 'vendor-changed'
  | 'config-changed'
  | 'attachment-added';

export interface RMAChangeRecord {
  id: string;
  type: RMAChangeType;
  action: 'Added' | 'Removed' | 'Changed';
  subject: string;
  /** Secondary line under the subject, such as "Return qty · 4 → 6". */
  subjectDetail?: string;
  detail?: string;
  /** The line, attachment or field this change touches. */
  itemRef?: string;
  timestamp: string;
  user: string;
  initials?: string;
}

/* ── Snapshot ───────────────────────────────────────────────────────── */

export interface RMALineSnapshot {
  id: string;
  sku: string;
  description: string;
  uom: string;
  returnQty: number;
  approvedQty?: number;
  unitPrice: number;
  totalValue: number;
  reason: ReturnReason;
  returnType?: ReturnType;
  approvedReturnType?: ReturnType;
  originName: string;
  serialNumbers?: string[];
  /** Lot-tracked lines carry their batches into the snapshot the same way
   *  serialized lines carry their units, so a revert can put them back. */
  lots?: RMALotAllocation[];
  notes?: string;
}

export interface RMAVersionSnapshot {
  rmaNumber: string;
  vendor: string;
  status: RMAStatus;
  owner: string;
  vendorRMANumber?: string;
  expectedResolutionDate?: string;
  pointOfContact?: string;
  notes?: string;
  shippingInstruction?: string;
  carrier?: string;
  returnShipTo?: string;
  returnShipToPartner?: string;
  freightArrangedBy?: string;
  freightPaidBy?: string;
  payToAccountId?: string;
  creditPct?: number;
  restockingFee?: number;
  /** What the vendor keeps back, line by line.
   *
   *  A single total could say that charges moved but never which one: a
   *  restocking fee cut by twenty and return freight raised by twenty is no
   *  change at all to a sum, and two changes to anybody reading the history. */
  charges?: { type: string; amount: number }[];
  lineItemCount: number;
  totalQty: number;
  totalValue: number;
  lineItems: RMALineSnapshot[];
  attachmentNames: string[];
  /** The return's currency, and the receiving rate its values convert to PKR
   *  at (Currency Touchpoints Map, 2026-11-24). Versions show PKR at that
   *  rate, and it is the receipt's, so a new version doesn't move them. */
  currency?: string;
  receivingFx?: MoneyFx;
  /** The rate type the vendor settles at, from the currency configuration. */
  settlementRateType?: RateType;
}

/** An amount of a version in PKR, at its receiving rate: "₨283,719.97". */
export function versionMoney(snap: Pick<RMAVersionSnapshot, 'currency' | 'receivingFx'>, n: number): string {
  const code = (snap.currency ?? BASE_CURRENCY).toUpperCase();
  if (isBaseCurrency(code) || !snap.receivingFx) return formatMoney(n, BASE_CURRENCY);
  return formatMoney(toBase(n, snap.receivingFx.rate), BASE_CURRENCY);
}

export interface RMAVersionEntry {
  version: number;
  versionStatus: RMAVersionStatus;
  createdAt: string;
  createdBy: string;
  avatar: string;
  reason: string;
  changes: RMAChangeRecord[];
  snapshot: RMAVersionSnapshot;
  isRevert?: boolean;
  revertedFrom?: number;
  changeTags?: string[];
  previousStatus?: string;
  newStatus?: string;
  /** Stamped onto the version that was reverted *to*, so the card can say why.
   *  Only the most recent revert of that version is kept. */
  revertReason?: string;
  revertReasonAt?: string;
  revertReasonBy?: string;
}

/* ── Builders ───────────────────────────────────────────────────────── */

export function toRMAVersionStatus(status: RMAStatus): RMAVersionStatus {
  switch (status) {
    case 'Draft':
      return 'draft';
    case 'Sent':
      return 'sent';
    case 'Approved':
      return 'approved';
    case 'Shipped to Vendor':
      return 'shipped';
    case 'Cancelled':
      return 'cancelled';
    default:
      return 'closed';
  }
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function lineSnapshot(li: RMALineItem): RMALineSnapshot {
  const qty = authorizedQty(li);
  return {
    id: li.id,
    sku: li.sku,
    description: li.description,
    uom: li.uom,
    returnQty: li.returnQty,
    ...(li.approvedQty !== undefined ? { approvedQty: li.approvedQty } : {}),
    unitPrice: li.unitPrice,
    totalValue: qty * li.unitPrice,
    reason: li.reason,
    ...(li.returnType ? { returnType: li.returnType } : {}),
    ...(li.approvedReturnType ? { approvedReturnType: li.approvedReturnType } : {}),
    originName: li.originName,
    ...(li.serialNumbers ? { serialNumbers: [...li.serialNumbers] } : {}),
    ...(li.notes ? { notes: li.notes } : {}),
  };
}

/** The restocking fee this return actually carries.
 *
 *  Approval writes one into `creditTerms`. Creation writes one as a vendor
 *  charge instead, so a return that was saved with a $25 restocking charge
 *  showed it in the Return Summary and $0.00 in Versions. Where both exist
 *  the agreed terms win: they are what the vendor confirmed. */
function restockingFeeOn(rma: RMA): number | undefined {
  // Dollars, always. The panel prints this through a currency formatter, so a
  // percentage parked here rendered a 10% fee as "$10.00" -- the figure was
  // stored as entered, which is why it reads as a storage bug and is not one.
  // The charge line carries what the fee costs this return; where only the
  // vendor's percentage is known, it is converted on the same base the
  // approval dialog used.
  const charged = Math.round(
    (rma.additionalCharges ?? [])
      .filter((c) => c.type === 'Restocking fee')
      .reduce((s, c) => s + c.amount, 0) * 100,
  ) / 100;
  if (charged > 0.004) return charged;
  const pct = rma.creditTerms?.restockingFee;
  return pct === undefined ? undefined : restockingFeeAmount(rma, pct) || undefined;
}

export function buildRMAVersionSnapshot(rma: RMA): RMAVersionSnapshot {
  const lineItems = rma.items.map(lineSnapshot);
  return {
    rmaNumber: rma.rmaNumber,
    vendor: rma.vendor,
    status: rma.status,
    // No returnType or reason here. Both are per line: RMA-01007's twelve
    // lines carry five different reasons, and a single header figure picked
    // one of them and called it the return's. The line snapshots below hold
    // the real answer, and the diff reports a change on the line it happened
    // on.
    owner: rma.owner,
    ...(rma.vendorRMANumber ? { vendorRMANumber: rma.vendorRMANumber } : {}),
    ...(rma.expectedResolutionDate
      ? { expectedResolutionDate: rma.expectedResolutionDate }
      : {}),
    ...(rma.pointOfContact ? { pointOfContact: rma.pointOfContact } : {}),
    ...(rma.notes ? { notes: rma.notes } : {}),
    ...(rma.shippingInstruction ? { shippingInstruction: rma.shippingInstruction } : {}),
    ...(rma.carrier ? { carrier: rma.carrier } : {}),
    ...(rma.returnShipTo ? { returnShipTo: rma.returnShipTo } : {}),
    ...(rma.returnShipToPartner ? { returnShipToPartner: rma.returnShipToPartner } : {}),
    ...(rma.freightArrangedBy ? { freightArrangedBy: rma.freightArrangedBy } : {}),
    ...(rma.freightPaidBy ? { freightPaidBy: rma.freightPaidBy } : {}),
    ...(rma.payToAccountId ? { payToAccountId: rma.payToAccountId } : {}),
    ...(rma.creditTerms?.creditPct !== undefined
      ? { creditPct: rma.creditTerms.creditPct }
      : {}),
    ...((fee) => (fee !== undefined ? { restockingFee: fee } : {}))(
      restockingFeeOn(rma),
    ),
    ...((lines) => (lines.length > 0 ? { charges: lines } : {}))(
      (rma.additionalCharges ?? [])
        .filter((c) => Math.abs(c.amount) > 0.004)
        .map((c) => ({ type: c.type, amount: Math.round(c.amount * 100) / 100 })),
    ),
    lineItemCount: lineItems.length,
    totalQty: lineItems.reduce((s, li) => s + (li.approvedQty ?? li.returnQty), 0),
    totalValue: lineItems.reduce((s, li) => s + li.totalValue, 0),
    lineItems,
    attachmentNames: (rma.attachments ?? []).map((a) => a.name),
    currency: rmaCurrency(rma),
    ...((fx) => (fx ? { receivingFx: fx } : {}))(returnFx(rma)),
    ...(rma.settlementRateType ? { settlementRateType: rma.settlementRateType } : {}),
  };
}

/* ── Diff ───────────────────────────────────────────────────────────── */

type DraftChange = Omit<RMAChangeRecord, 'id' | 'timestamp' | 'user'>;

const HEADER_FIELDS: {
  key: keyof RMAVersionSnapshot;
  label: string;
  type: RMAChangeType;
  /** Snapshots hold ids so a revert stays a copy; the history reads the name. */
  format?: (v: unknown) => string;
}[] = [
  { key: 'vendor', label: 'Vendor', type: 'vendor-changed' },
  { key: 'pointOfContact', label: 'Point of Contact', type: 'vendor-changed' },
  { key: 'owner', label: 'Owner', type: 'config-changed' },
  { key: 'vendorRMANumber', label: 'Vendor RMA Number', type: 'authorization-changed' },
  { key: 'expectedResolutionDate', label: 'Expected Resolution Date', type: 'config-changed' },
  { key: 'notes', label: 'Notes', type: 'config-changed' },
  { key: 'shippingInstruction', label: 'Shipping Instructions', type: 'logistics-changed' },
  { key: 'carrier', label: 'Carrier', type: 'logistics-changed' },
  { key: 'returnShipTo', label: 'Return Ship To', type: 'logistics-changed' },
  { key: 'returnShipToPartner', label: 'Return Partner', type: 'logistics-changed' },
  { key: 'freightArrangedBy', label: 'Freight Arranged By', type: 'logistics-changed' },
  { key: 'freightPaidBy', label: 'Freight Paid By', type: 'logistics-changed' },
  {
    key: 'payToAccountId',
    label: 'Refund Account',
    type: 'value-changed',
    format: (v) => PAY_FROM_ACCOUNTS.find((a) => a.id === v)?.label ?? String(v ?? ''),
  },
  {
    key: 'settlementRateType',
    label: 'Settlement Rate Type',
    type: 'value-changed',
    format: (v) => RATE_TYPE_LABEL[v as RateType] ?? String(v ?? ''),
  },
  { key: 'creditPct', label: 'Agreed Credit Rate', type: 'value-changed' },
  { key: 'restockingFee', label: 'Restocking Fee', type: 'value-changed' },
];

const asText = (v: unknown): string =>
  v === undefined || v === null || v === '' ? '—' : String(v);

/** Change records describing how `next` differs from `prev`. Returned without
 *  ids or timestamps; the recorder stamps those. */
export function diffRMASnapshots(
  prev: RMAVersionSnapshot,
  next: RMAVersionSnapshot,
): DraftChange[] {
  const changes: DraftChange[] = [];

  if (prev.status !== next.status) {
    changes.push({
      type: 'config-changed',
      action: 'Changed',
      subject: 'Status',
      subjectDetail: `${prev.status} → ${next.status}`,
    });
  }

  // Vendor charges, by type. Matched on the type rather than on an id,
  // because the id is a counter the panel hands out and a charge retyped from
  // Handling fee to Intake fee is a different deduction, not an edited one.
  {
    // In PKR at the receiving rate (2026-11-24), as the Versions tab shows it.
    const money = (n: number) => versionMoney(next, n);
    const before = new Map((prev.charges ?? []).map((c) => [c.type, c.amount]));
    const after = new Map((next.charges ?? []).map((c) => [c.type, c.amount]));
    [...new Set([...before.keys(), ...after.keys()])].forEach((type) => {
      const was = before.get(type);
      const now = after.get(type);
      if (was === undefined && now !== undefined) {
        changes.push({
          type: 'value-changed',
          action: 'Added',
          subject: type,
          subjectDetail: `Vendor charge · ${money(now)}`,
        });
      } else if (was !== undefined && now === undefined) {
        changes.push({
          type: 'value-changed',
          action: 'Removed',
          subject: type,
          subjectDetail: `Vendor charge · ${money(was)}`,
        });
      } else if (was !== undefined && now !== undefined && Math.abs(was - now) > 0.004) {
        changes.push({
          type: 'value-changed',
          action: 'Changed',
          subject: type,
          subjectDetail: `Vendor charge · ${money(was)} → ${money(now)}`,
        });
      }
    });
  }

  for (const field of HEADER_FIELDS) {
    const before = prev[field.key];
    const after = next[field.key];
    if (asText(before) === asText(after)) continue;
    const show = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : asText(field.format ? field.format(v) : v));
    changes.push({
      type: field.type,
      action: 'Changed',
      subject: field.label,
      subjectDetail: `${show(before)} → ${show(after)}`,
    });
  }

  const prevById = new Map(prev.lineItems.map((li) => [li.id, li]));
  const nextById = new Map(next.lineItems.map((li) => [li.id, li]));

  for (const li of next.lineItems) {
    if (prevById.has(li.id)) continue;
    changes.push({
      type: 'line-item-added',
      action: 'Added',
      subject: li.sku,
      subjectDetail: li.description,
      detail: `${li.returnQty} ${li.uom}`,
      itemRef: li.id,
    });
  }

  for (const li of prev.lineItems) {
    if (nextById.has(li.id)) continue;
    changes.push({
      type: 'line-item-removed',
      action: 'Removed',
      subject: li.sku,
      subjectDetail: li.description,
      itemRef: li.id,
    });
  }

  for (const after of next.lineItems) {
    const before = prevById.get(after.id);
    if (!before) continue;

    if (before.returnQty !== after.returnQty) {
      changes.push({
        type: 'line-item-modified',
        action: 'Changed',
        subject: after.sku,
        subjectDetail: `Return qty · ${before.returnQty} → ${after.returnQty} ${after.uom}`,
        itemRef: after.id,
      });
    }
    if (before.approvedQty !== after.approvedQty) {
      changes.push({
        type: 'authorization-changed',
        action: 'Changed',
        subject: after.sku,
        subjectDetail:
          after.approvedQty === 0
            ? 'Line refused by vendor'
            : `Authorized qty · ${asText(before.approvedQty)} → ${asText(after.approvedQty)} ${after.uom}`,
        itemRef: after.id,
      });
    }
    // Compared to the cent, the way it is shown. A price that only moved in
    // a digit nobody sees logged "$13.71 → $13.71".
    if (Math.abs(before.unitPrice - after.unitPrice) > 0.004) {
      changes.push({
        type: 'value-changed',
        action: 'Changed',
        subject: after.sku,
        subjectDetail: `Unit price · ${versionMoney(prev, before.unitPrice)} → ${versionMoney(next, after.unitPrice)}`,
        itemRef: after.id,
      });
    }
    if (before.reason !== after.reason) {
      changes.push({
        type: 'line-item-modified',
        action: 'Changed',
        subject: after.sku,
        subjectDetail: `Reason · ${before.reason} → ${after.reason}`,
        itemRef: after.id,
      });
    }
    const beforeType = before.approvedReturnType ?? before.returnType;
    const afterType = after.approvedReturnType ?? after.returnType;
    if (asText(beforeType) !== asText(afterType)) {
      changes.push({
        type: 'line-item-modified',
        action: 'Changed',
        subject: after.sku,
        subjectDetail: `Return type · ${asText(beforeType)} → ${asText(afterType)}`,
        itemRef: after.id,
      });
    }
    const beforeSerials = (before.serialNumbers ?? []).join(',');
    const afterSerials = (after.serialNumbers ?? []).join(',');
    if (beforeSerials !== afterSerials) {
      changes.push({
        type: 'line-item-modified',
        action: 'Changed',
        subject: after.sku,
        subjectDetail: `Units returned · ${(before.serialNumbers ?? []).length} → ${(after.serialNumbers ?? []).length} serial numbers`,
        itemRef: after.id,
      });
    }
  }

  const prevAttachments = new Set(prev.attachmentNames);
  for (const name of next.attachmentNames) {
    if (prevAttachments.has(name)) continue;
    changes.push({
      type: 'attachment-added',
      action: 'Added',
      subject: name,
      detail: 'Attached to the return',
      itemRef: name,
    });
  }

  return changes;
}

/* ── Seeding ────────────────────────────────────────────────────────── */

function creationChange(rma: RMA, snapshot: RMAVersionSnapshot): RMAChangeRecord {
  return {
    id: `chg-${rma.id}-v1`,
    type: 'config-changed',
    action: 'Added',
    subject: 'Return Authorization Created',
    detail: `${snapshot.lineItemCount} lines · ${versionMoney(snapshot, snapshot.totalValue)}`,
    timestamp: '09:00 AM',
    user: rma.createdBy,
    initials: initialsOf(rma.createdBy),
  };
}

/** Version 1 for a return that has none. It is the only version, so it has to
 *  describe the return as it stands today, status included. */
export function buildInitialVersion(rma: RMA): RMAVersionEntry {
  const snapshot = buildRMAVersionSnapshot(rma);
  return {
    version: 1,
    // A return seeded before versioning existed has one version, and that
    // version is the return as it stands now — not a Draft it never was.
    versionStatus: toRMAVersionStatus(rma.status),
    // The moment the return was actually raised, where the record kept it.
    // A nine-in-the-morning stamp was printed beside an activity log holding
    // the real time, on returns created minutes earlier.
    createdAt:
      (rma.actionHistory ?? []).find((h) => h.action === 'create')?.at ??
      `${rma.createdDate}T09:00:00.000Z`,
    createdBy: rma.createdBy,
    avatar: initialsOf(rma.createdBy),
    reason: 'Return authorization created',
    changes: [creationChange(rma, snapshot)],
    snapshot,
  };
}

/** Stamps a draft change list into full records. */
export function stampChanges(
  rmaId: string,
  version: number,
  user: string,
  changes: DraftChange[],
  at: Date = new Date(),
): RMAChangeRecord[] {
  const timestamp = at.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return changes.map((c, idx) => ({
    ...c,
    id: `chg-${rmaId}-v${version}-${idx + 1}`,
    timestamp,
    user,
    initials: initialsOf(user),
  }));
}

export type { DraftChange as RMADraftChange };

/** Why a version was cut, keyed by the action that cut it. Shared by the live
 *  store and the seeded history so a return created today and one that came
 *  with the dataset describe the same transition the same way. */
export const ACTION_VERSION_REASON: Record<string, string> = {
  submit: 'Return sent to vendor',
  approve: 'Vendor authorization recorded',
  ship: 'Return shipped to vendor',
  close: 'Return closed',
  'receive-goods': 'Vendor receipt recorded',
  'log-settlement': 'Settlement logged, return closed',
  'record-credit': 'Vendor credit recorded',
  'record-refund': 'Vendor refund recorded',
  'record-refusal': 'Vendor refused the return',
  cancel: 'Return cancelled',
  archive: 'Return archived',
};

/* ── Seeded lifecycle history ───────────────────────────────────────── */

/** The lifecycle stops that cut a version, in the order they happen. The index
 *  doubles as the rank `rewindSnapshot` measures against. */
const STAGE_ORDER = ['create', 'submit', 'approve', 'ship', 'close'] as const;

const STAGE_STATUS: Record<string, RMAStatus> = {
  create: 'Draft',
  submit: 'Sent',
  approve: 'Approved',
  ship: 'Shipped to Vendor',
  close: 'Closed',
};

/**
 * The return as it read before the stages after `rank` had run. Snapshots are
 * derived by rewinding the current state rather than composed forwards,
 * because the seed only stores where the return ended up: approval stamps the
 * authorized quantities and the vendor reference, shipping stamps the carrier,
 * closing stamps the credit terms. Taking those back off is what an earlier
 * version actually looked like.
 */
function rewindSnapshot(
  final: RMAVersionSnapshot,
  rank: number,
  status: RMAStatus,
): RMAVersionSnapshot {
  const lineItems: RMALineSnapshot[] = final.lineItems.map((li) => {
    if (rank >= 2) return { ...li };
    const { approvedQty: _authorized, approvedReturnType: _authorizedType, ...asked } = li;
    return { ...asked, totalValue: asked.returnQty * asked.unitPrice };
  });

  const snapshot: RMAVersionSnapshot = {
    ...final,
    status,
    lineItems,
    lineItemCount: lineItems.length,
    totalQty: lineItems.reduce((s, li) => s + (li.approvedQty ?? li.returnQty), 0),
    totalValue: lineItems.reduce((s, li) => s + li.totalValue, 0),
  };

  if (rank < 2) delete snapshot.vendorRMANumber;
  if (rank < 3) delete snapshot.carrier;
  if (rank < 4) {
    delete snapshot.creditPct;
    delete snapshot.restockingFee;
  }
  return snapshot;
}

/**
 * The version chain a seeded return implies. Every lifecycle transition the
 * store would have versioned is already recorded in `actionHistory` with its
 * own actor and timestamp, so the history is read off that rather than
 * invented: a Sent return has one version, a Closed one four.
 *
 * Creation itself does not cut a version — the draft is the document, not a
 * revision of it. The first version is the one sent to the vendor, so the
 * creation snapshot is kept only as the baseline the send is diffed against.
 *
 * Returns an empty list when there is nothing beyond creation, leaving the
 * single-version case to `buildInitialVersion`.
 */
export function buildSeededVersions(rma: RMA): RMAVersionEntry[] {
  const stages = (rma.actionHistory ?? []).filter((h) =>
    (STAGE_ORDER as readonly string[]).includes(h.action),
  );
  if (stages.length < 2) return [];

  const final = buildRMAVersionSnapshot(rma);
  const entries: RMAVersionEntry[] = [];
  let previous: RMAVersionSnapshot | null = null;

  stages.forEach((stage, idx) => {
    const isLast = idx === stages.length - 1;
    const rank = STAGE_ORDER.indexOf(stage.action as (typeof STAGE_ORDER)[number]);
    // The newest version has to be the return as it stands, status included —
    // a cancelled return ends on a stage the ladder has no entry for.
    const status = isLast ? rma.status : (STAGE_STATUS[stage.action] ?? rma.status);
    const snapshot = isLast ? final : rewindSnapshot(final, rank, status);
    const at = new Date(stage.at);

    if (previous) {
      const version = idx;
      entries.push({
        version,
        versionStatus: toRMAVersionStatus(status),
        createdAt: at.toISOString(),
        createdBy: stage.by,
        avatar: initialsOf(stage.by),
        reason:
          stage.reason?.trim() || (ACTION_VERSION_REASON[stage.action] ?? 'Return updated'),
        changes: stampChanges(
          rma.id,
          version,
          stage.by,
          diffRMASnapshots(previous, snapshot),
          at,
        ),
        snapshot,
      });
    }
    previous = snapshot;
  });

  return entries.reverse();
}

/** Attaches the seeded chain, leaving returns with nothing past creation to
 *  the lazy single-version path. */
export function withSeededVersions(rma: RMA): RMA {
  const versions = buildSeededVersions(rma);
  if (versions.length === 0) return rma;
  return { ...rma, versions, currentVersion: versions[0]!.version };
}
