import { mulberry32 } from './seededRandom';
import {
  availableSerials,
  binsForItem,
  buildSerial,
  hasSerials,
  hashKey,
  isLotMode,
  trackingModeFor,
  type TrackingMode,
} from './itemTracking';
import { lotBlocksFor, lotUnitsInLot, lotVendorFor } from './itemProvenance';

/** Re-exported: the control type and the pools moved to `itemTracking` so
 *  provenance could stop importing the seeded returns, and every screen that
 *  already imports them from here keeps working. */
export {
  availableSerials,
  binsForItem,
  hasSerials,
  isLotMode,
  trackingModeFor,
  type TrackingMode,
};
import { mockVendors, type LineItem, type VendorPO } from './mockVendors';
import { PINNED_CREATORS, TEAM_ROSTER } from './mockInvoices';
import { BANK_ACCOUNTS } from './mockPayments';
import { PARTNER_LOCATION_ITEMS, partnerForItem } from './partnerLocations';
import { invoiceSplitForRMALine } from './receiptInvoiceStatus';
import type { RMAVersionEntry } from './rmaVersions';
import type { ReturnBucket } from './rmaReturnAllocation';
import type { RateType } from '@/app/currency/rates';
import { CARRIER_CATALOGUE } from '@/app/data/vendorCarriers';

const rand = mulberry32(0x2114DA1);

// A return ends in one stop, not two: the goods arriving back and the return
// being settled are logged as the same close, so nothing sits in a
// received-but-unsettled state waiting for a second click.
export type RMAStatus =
  | 'Draft'
  | 'Sent'
  | 'Approved'
  | 'Shipped to Vendor'
  | 'Closed'
  | 'Cancelled';

/** 'Return Only' sends the goods back and settles nothing: no credit is
 *  expected and no replacement is coming, so the line closes on dispatch. */
/** How a status reads on screen. A return that closed on an acknowledged
 *  short settlement is still `Closed` for every rule that checks it, but it
 *  says so, because the money did not all come back. */
/** The return skips the vendor authorization steps (company setup, DQ-03). */
export function rmaShipsDirect(rma: { lifecycle?: RMA['lifecycle'] }): boolean {
  return rma.lifecycle === 'ship-direct';
}

/** Whether an earlier version can still be made current (DQ-09, Eli, Nov 2).
 *  Only before the first shipment: after it the return is locked, and a
 *  correction is a Cancel line or Vendor refused, never a revert. A cancelled
 *  or archived return is over and has nothing to revert. */
export function rmaCanRevert(rma: Pick<RMA, 'status' | 'shippedDate' | 'shipmentStartedDate' | 'archived'>): boolean {
  return (
    (rma.status === 'Draft' || rma.status === 'Sent' || rma.status === 'Approved') &&
    !rma.shippedDate &&
    !rma.shipmentStartedDate &&
    !rma.archived
  );
}

/** Whether a material change (DQ-07) can still be made. Up to the first
 *  shipment; after it only an unshipped line can be taken off. */
export function rmaMaterialEditable(rma: Pick<RMA, 'status' | 'shipmentStartedDate' | 'shippedDate'>): boolean {
  return RMA_EDITABLE_STATUSES.includes(rma.status) && !rma.shipmentStartedDate && !rma.shippedDate;
}

/** RMA Module Defaults: how long after shipping a refund may take before
 *  the return is tagged Payment overdue (DQ-02, Eli, Nov 2). A company
 *  setting; 30 days is the default. */
export const PAYMENT_OVERDUE_DAYS = 30;

/** Whole days since the goods shipped, or null if they have not. */
export function rmaDaysSinceShipped(rma: Pick<RMA, 'shippedDate'>, now = new Date()): number | null {
  if (!rma.shippedDate) return null;
  const shipped = new Date(`${rma.shippedDate.slice(0, 10)}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - shipped.getTime()) / 86_400_000);
}

/** DQ-02: a refund return still waiting for its money past the setting. The
 *  clock starts at Shipped to Vendor. Credit returns close on shipment and
 *  never wait, so only refunds can be overdue. The expected refund date the
 *  user entered stays information only and does not move the tag. */
export function rmaPaymentOverdue(
  rma: Pick<RMA, 'status' | 'shippedDate' | 'archived' | 'creditTerms'>,
  days = PAYMENT_OVERDUE_DAYS,
): boolean {
  if (rma.archived || rma.status !== 'Shipped to Vendor') return false;
  if (rma.creditTerms?.refundOrCredit === 'Credit') return false;
  const since = rmaDaysSinceShipped(rma);
  return since !== null && since > days;
}

/** The statuses this return walks through, in order. */
export function rmaLifecycleSteps(rma: { lifecycle?: RMA['lifecycle'] }): RMAStatus[] {
  return rmaShipsDirect(rma)
    ? ['Draft', 'Shipped to Vendor', 'Closed']
    : ['Draft', 'Sent', 'Approved', 'Shipped to Vendor', 'Closed'];
}

export type RMAStatusLabel = RMAStatus | 'Closed with loss';

export function rmaStatusLabel(rma: { status: RMAStatus; closedWithLoss?: boolean }): RMAStatusLabel {
  return rma.status === 'Closed' && rma.closedWithLoss ? 'Closed with loss' : rma.status;
}

export type ReturnType = 'Refund/Credit' | 'Replacement' | 'Return Only';

/** How a return that spans several vendor sites ships back. 'origin' sends
 *  each group to the site it was received from; 'consolidated' sends the whole
 *  return to one address the vendor nominated, which is the common exception. */
export type ReturnRouting = 'origin' | 'consolidated';

/** One outbound shipment on a return. A return-to-origin fan-out has one leg
 *  per site; a consolidated return has exactly one leg listing every site. */
export interface RMAReturnLeg {
  /** Vendor sites whose goods travel on this leg. */
  originIds: string[];
  /** Address the goods go back to. */
  shipTo: string;
  /** Partner who owns that address. A vendor can nominate another party's
   *  site to receive returns, so this is not always the RMA's own vendor. */
  shipToPartner?: string;
  /** Receipts whose goods are on this leg. */
  receivingNumbers: string[];
  /** Carrier this shipment travels on. Each site is its own partner record
   *  with its own freight arrangements, so a return that fans out to several
   *  of them ships on several carriers, not one. */
  carrier?: string;
}

export type ReturnReason =
  | 'Failed inspection'
  | 'Wrong item or variant'
  | 'Over-shipped'
  | 'Not ordered'
  | 'Price or terms discrepancy'
  | 'Other';

/** Single source for every Return Reason picker, in the order they should
 *  be offered — quality issues first, then fulfilment, then commercial. */
export const RETURN_REASONS: ReturnReason[] = [
  'Failed inspection',
  'Wrong item or variant',
  'Over-shipped',
  'Not ordered',
  'Price or terms discrepancy',
  'Other',
];

export type FreightParty = 'Vendor' | 'Tenant';

/** What actually goes back to the vendor. Before approval that is what the
 *  return asked for; after it, only what the vendor authorized. Everything
 *  downstream of approval — picking, shipping, expected credit — counts this,
 *  never `returnQty`. */
/** Statuses in which a return can still be changed. Editing stops at Shipped
 *  to Vendor: once the goods are gone, the return is what left. Every edit in
 *  these states is captured as a new version. */
export const RMA_EDITABLE_STATUSES: string[] = ['Draft', 'Sent', 'Approved'];

export function authorizedQty(li: RMALineItem): number {
  return li.approvedQty ?? li.returnQty;
}

export interface RMALotAllocation {
  lot: string;
  qty: number;
  /** The delivery this much of the batch came in on. A batch arrives over
   *  several receipts and a credit reverses one of them, so a pick is a batch
   *  on a document rather than a batch on its own. */
  grnNumber?: string;
  /** LOT Serialized only: which units inside the batch are going back. The
   *  quantity is however many of these there are. */
  serials?: string[];
}

/** One invoice state's share of a return line. Goods that were part paid, part
 *  billed and part still on accrual settle three different ways, so each state
 *  carries the quantity going back under it and the terms it goes back on. */
export interface RMALineSettlement {
  state: ReturnBucket;
  qty: number;
  unitPrice: number;
  reason: ReturnReason;
  returnType?: ReturnType;
}

export interface RMALineItem {
  id: string;
  /** Original PO line the RMA is returning against. */
  poLineId: string;
  sku: string;
  description: string;
  uom: string;
  unitPrice: number;
  /** Our own site the goods were booked into, which is the fact the vendor
   *  matches a returned line against. Distinct from `originName`, the vendor
   *  site they were despatched from: the document printed that under
   *  "Received at" and so told the vendor we had received the goods at their
   *  own address. */
  receivedAtSite?: string;
  /** Qty the order asked for. Kept beside `receivedQty` because a line that
   *  shows the same figure for both is not saying anything about the
   *  delivery, and an over-shipment is exactly the gap between them. */
  orderedQty?: number;
  /** Qty the receiving documents booked in against this line — the cap on
   *  returnQty. Read off the receipts the return unwinds, never off stock on
   *  hand: the same part can arrive on several orders and the shelf figure
   *  answers a different question. */
  receivedQty: number;
  /** Qty being returned by this RMA line. */
  returnQty: number;
  /** Qty the vendor authorized, captured at approval. Undefined until then,
   *  and left alongside `returnQty` rather than overwriting it so the line can
   *  still say what was asked for. Zero means the vendor refused the line. */
  approvedQty?: number;
  /** The vendor's grounds for cutting or refusing the line. */
  approvalNote?: string;
  /** Per-line reason (defaults to the header reason). */
  reason: ReturnReason;
  /** Free-text explanation — required when reason is 'Other'. */
  /** Per-line return type (defaults to the header returnType when unset). */
  returnType?: ReturnType;
  /** The return type the vendor authorized, when it is not the one asked for.
   *  A vendor who will replace but not credit has answered the request rather
   *  than refused it, so both sides of that answer stay on the line. */
  approvedReturnType?: ReturnType;
  /** The deliveries this line's credit unwinds, and how much against each.
   *
   *  A counted part has no provenance, so the tie is a decision rather than a
   *  fact: it says which receipts the credit reverses. Empty means the return
   *  was deliberately tied to nothing, which is a different instrument -- a
   *  floating credit somebody applies to an invoice by hand, because there is
   *  no receipt for it to unwind on its own. */
  ties?: { grnNumber: string; qty: number }[] | undefined;
  /** Tied to nothing on purpose. Kept apart from an empty tie list so the
   *  record can tell "not tied" from "not asked". */
  untied?: boolean | undefined;
  /** How the line settles when its goods sat in more than one invoice state.
   *  `reason`, `returnType` and `unitPrice` above stay the line's headline
   *  answer, taken from the state covering the most units. */
  settlements?: RMALineSettlement[] | undefined;
  /** Units the last step of the create flow counted as paid for, read off
   *  the receipts and lots actually picked. Kept so the saved return states
   *  the paid amount the buyer agreed to rather than re-deriving it from the
   *  whole order. */
  paidQty?: number | undefined;
  /** For serialized items: which specific units are being returned. */
  serialNumbers?: string[];
  /** For lot-controlled items: lot + qty pairs. */
  lots?: RMALotAllocation[];
  /** Context the vendor needs to process this specific line, captured while
   *  the return was built. Distinct from the RMA-level `notes`. */
  notes?: string;
  /** Evidence for this line — photos of the damage, the vendor's email. */
  attachments?: { name: string }[];
  /** What the PO priced this at, when the price was corrected on the return. */
  originalUnitPrice?: number;
  /** Vendor site the goods were received from. Fixed by the receipt and never
   *  edited — routing is resolved against it. */
  originId: string;
  originName: string;
  image?: string;
}

/** Where the clock starts on a vendor's promise to pay.
 *
 *  A vendor rarely says "the 5th of November". They say "thirty days", and the
 *  thirty days run from something: the conversation, the goods leaving, or the
 *  goods landing on their dock. Which one changes the answer by weeks, so it
 *  is asked rather than assumed. */
export type RefundCountsFrom = 'today' | 'shipped' | 'received';

/** How the money comes back. `Unknown` is a real answer, not a missing one: a
 *  vendor who has not said is different from one nobody asked. */
export type RefundMethod = 'Wire' | 'Check' | 'Unknown';

export interface RMARefundExpectation {
  /** Days the vendor asked for. Ignored when `onDate` is set. */
  days: number;
  from: RefundCountsFrom;
  method: RefundMethod;
  /** A date the vendor named outright, instead of a number of days.
   *
   *  The two are different kinds of promise and only one can be true at a
   *  time. "Thirty days after it ships" has no date until it ships; "by the
   *  tenth" has a date and no need of a starting point. Where this is set,
   *  `days` and `from` say nothing. */
  onDate?: string;
  /** When the promise was captured, and by whom. */
  at?: string;
  by?: string;
}

/** The date a refund is expected, where the promise can be resolved to one.
 *
 *  Returns null while the clock has not started: a return promising thirty
 *  days from shipping has no date until it ships. Naming the gap is the point
 *  -- a forecast invented from a date that does not exist is worse than no
 *  forecast, because somebody will chase against it. */
/** A purchase order as the module prints it, PO-11211. Stored numbers come
 *  both with and without the prefix, and the list printed "PO 11211" in one
 *  column and "PO-11211" in its search. */
export function poLabel(po: string): string {
  if (!po || po === '\u2014' || po === '\u2013') return '\u2013';
  return /^PO[- ]?/i.test(po) ? po.replace(/^PO[- ]?/i, 'PO-') : `PO-${po}`;
}

/** A date as YYYY-MM-DD on the local calendar. `toISOString` gives the UTC
 *  day, which east of Greenwich is the day before for anything stamped
 *  before 5am, so a modal that said Nov 28 saved Nov 27. */
export function localISODate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function expectedRefundDate(rma: RMA): string | null {
  const promise = rma.refundExpectation;
  if (!promise) return rma.expectedResolutionDate ?? null;
  // A date the vendor named is already the answer, and it needs no clock to
  // have started.
  if (promise.onDate) return promise.onDate;
  const base =
    promise.from === 'today'
      ? (promise.at ? localISODate(new Date(promise.at)) : (rma.approvedDate ?? rma.createdDate))
      : promise.from === 'shipped'
        ? rma.shippedDate
        : rma.receivedDate;
  if (!base) return null;
  const d = new Date(`${base}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + promise.days);
  return localISODate(d);
}

/** The promise in words, for the places a date cannot be given yet. */
export function refundExpectationLabel(rma: RMA): string | null {
  const promise = rma.refundExpectation;
  if (!promise) return null;
  if (promise.onDate) {
    const d = new Date(`${promise.onDate}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? null
      : `by ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  const days = `${promise.days} ${promise.days === 1 ? 'day' : 'days'}`;
  if (promise.from === 'shipped') return `${days} after the goods ship`;
  if (promise.from === 'received') return `${days} after the vendor receives them`;
  return `${days} from approval`;
}

/** A note added on the Notes tab. */
export interface RMANote {
  id: string;
  text: string;
  author: string;
  /** ISO timestamp. */
  at: string;
}

export interface RMACreditTerms {
  refundOrCredit?: 'Refund' | 'Credit';
  creditPct?: number;
  restockingFee?: number;
}

/**
 * One thing the vendor sent back against a refund return.
 *
 * A refund return stays open the way an invoice stays open, and this is what
 * closes it: the money landed. A list rather than a field,
 * because a vendor can settle in instalments and each one is its own event
 * with its own date and reference.
 */
export interface RMASettlementEntry {
  id: string;
  /** Always a payment: Log settlement records refunds only. */
  kind: 'payment';
  amount: number;
  /** The day the money landed. */
  date: string;
  /** Check number, ACH trace or wire confirmation. */
  reference: string;
  /** Wire, ACH, check. */
  method?: string;
  /** The account the money landed in (ERP-8664 AC2.3). */
  depositedToAccountId?: string;
  /** A refund in another currency landing in a PKR account: what it came to
   *  in PKR. Since 2026-11-24 it is the amount at the settlement rate below,
   *  no longer typed in (it was what the bank credited, and gave the rate). */
  bankReceived?: number | undefined;
  /** PKR per one unit of the return's currency the vendor settled at: the
   *  rate of the configured type (the PO's, mid-market or corporate) on the
   *  day the money landed (Currency Touchpoints Map, 2026-11-24). Against the
   *  receiving-day rate it leaves the FX variance (GL Impact). */
  rate?: number | undefined;
  /** Which rate that was. */
  rateType?: RateType | undefined;
  description?: string;
  fileName?: string;
  /** Set when the entry came in short of what was agreed and the user
   *  confirmed the gap should be written off as a loss. */
  lossAcknowledged?: boolean;
  by: string;
}

export interface RMAActionHistoryEntry {
  action: string;
  reason?: string;
  by: string;
  at: string;
}

export interface RMA {
  id: string;
  rmaNumber: string;
  sourcePO: string;
  /** Every PO the return draws from. A return spanning several origin sites is
   *  raised against a PO per site, and `sourcePO` keeps only the first, so
   *  naming that one alone under-reports what the return is linked to. */
  sourcePOs?: string[];
  /** Receiving documents the returned goods were booked in on. A return is
   *  raised against what was physically received, so these sit alongside
   *  the source PO in Linked Records. */
  receivingNumbers?: string[];
  vendor: string;
  vendorCode?: string;
  status: RMAStatus;
  returnType: ReturnType;
  /** Header-level reason; per-line reasons override. */
  reason: ReturnReason;
  owner: string;
  createdBy: string;
  createdDate: string;
  sentDate?: string;
  approvedDate?: string;
  shippedDate?: string;
  /** The first shipment went out while others are still being staged. The
   *  return stays Approved, tagged Shipment in process, until the last one
   *  ships (ERP-8637 AC9). */
  shipmentStartedDate?: string;
  receivedDate?: string;
  resolvedDate?: string;
  items: RMALineItem[];
  vendorRMANumber?: string;
  /** Date the return is expected to be settled. A forecast the user sets at
   *  creation, not a date the vendor issued. */
  expectedResolutionDate?: string;
  /** What the vendor said about paying, captured when the return is approved.
   *
   *  A vendor agreeing to take goods back is also agreeing to a rough when and
   *  a rough how, and that is the one moment somebody is on the phone to them.
   *  Asking later means asking twice. Held as the promise rather than as a
   *  date, because two of the three starting points have not happened yet when
   *  it is made. */
  refundExpectation?: RMARefundExpectation;
  /** Vendor-side point of contact (name of person handling the return). */
  pointOfContact?: string;
  /** Note, email, confirmation number, or shipping label ref. */
  notes?: string;
  /** Notes added on the Notes tab after the return was raised, newest
   *  first. `notes` above is the one written at creation and stays its own
   *  field, because the create flow and the documents read it. */
  noteLog?: RMANote[];
  freightArrangedBy?: FreightParty;
  freightPaidBy?: FreightParty;
  carrier?: string;
  /** Single destination. Set only when the return ships to one address, so
   *  the sidebar can keep its one-line read; undefined on a fan-out. */
  returnShipTo?: string;
  /** Partner who receives the return. Independent of `vendor`: the goods
   *  were bought from `vendor` but that vendor can route returns to another
   *  party's site, so this is the party the shipment is actually addressed
   *  to. Undefined on a fan-out, same as `returnShipTo`. */
  returnShipToPartner?: string;
  returnRouting: ReturnRouting;
  /** Packing and dock instructions the user writes for this return, as
   *  opposed to `notes`, which carries the return's own description. */
  shippingInstruction?: string;
  /** Outbound shipments. Length 1 for a single-site or consolidated return. */
  returnLegs: RMAReturnLeg[];
  creditTerms?: RMACreditTerms;
  // No payment term on a return. Terms say when an invoice gets paid, and a
  // return is not something you pay: it unwinds a delivery and settles as a
  // credit or a refund, on whatever the original invoice was already on
  // (Eli, 6 Oct). The field and its card are gone rather than left unread.
  paymentMethodName?: string;
  /** What the vendor charges or deducts on this return: restocking, return
   *  freight, handling. Asked on the detail page under Credit or refund, in
   *  the invoice create modal's own Additional Charges panel. */
  additionalCharges?: { id: number; type: string; amount: number; description?: string }[];
  /** Free words for finding this return again: what it was about, long
   *  after its number has been forgotten. Searched by the listing. */
  tags?: string[];
  attachments?: { name: string; url?: string }[];
  actionHistory?: RMAActionHistoryEntry[];
  /** Archived RMAs stay readable by direct link but drop out of the list. */
  archived?: boolean;
  /** Condition the goods were in when the vendor logged them as received. */
  receivedCondition?: string;
  /** Credit actually settled by the vendor, which can differ from the
   *  return value if they short-pay or deduct a restocking fee. */
  creditAmountReceived?: number;
  /** Every payment and credit memo logged against a refund return. The
   *  sum of them is what `creditAmountReceived` reports. */
  settlementEntries?: RMASettlementEntry[];
  /** The return closed on a short settlement the user acknowledged, and the
   *  gap was written off to RMA Settlement Loss. Still `Closed` as a status;
   *  this only changes how it reads. */
  closedWithLoss?: boolean;
  /** What was written off when `closedWithLoss` is set. */
  settlementLoss?: number;
  creditNoteRef?: string;
  /** Settlement milestones the GL entries hang off. `settledDate` is whatever
   *  event clears 1255 Other Receivables – Vendor Returns: the vendor's credit note,
   *  the replacement stock booking in, or the accrual reversal on a plain
   *  return. `cashRefundedDate` only applies where the return was already paid,
   *  so the credit becomes a receivable that the refund later clears. Both are
   *  absent until the event happens, which is what keeps a GL step projected. */
  settledDate?: string;
  cashRefundedDate?: string;
  /** The vendor would not settle at all: the goods shipped, they refused
   *  them, and nothing is coming back. Distinct from a refusal at approval,
   *  which cuts the line before anything moves. Set here, the whole return
   *  is written off. */
  refusedDate?: string;
  refusalNote?: string;
  /** How many steps the return walks, from the company's RMA setup. With
   *  Sent and Approved both off (DQ-03), a return goes Draft, Shipped to
   *  Vendor, Closed: no vendor authorization is asked, so the vendor's RMA
   *  number and the expected date are taken at creation instead. Absent is
   *  the full five-step lifecycle. */
  lifecycle?: 'ship-direct';
  /** The vendor credit the system raised when a credit return closed
   *  (DQ-01). The return closes once everything has shipped; accounting
   *  confirms this credit later in partner credits, against the vendor's
   *  memo number, amount and date, so it is recorded there and not here. */
  pendingCredit?: { ref: string; raisedDate: string; amount: number };
  /** Account the vendor's credit settles to, picked on the create form the
   *  same way the Record Payment flow picks one. Holds a `PayFromAccount.id`.
   *  It is the currency configuration's "Deposited to": an account in the
   *  base currency or the return's (2026-11-24). */
  payToAccountId?: string;
  /** The rate type the vendor settles at, set in the currency configuration.
   *  Absent is the PO's type (`rmaPORateType`). The rate is today's until the
   *  vendor settles, then the settlement day's (2026-11-24). */
  settlementRateType?: RateType;
  /** Revision history. Every version carries a full snapshot of the return as
   *  it stood when the version was cut, so a revert is a copy rather than a
   *  replay. Seeded lazily, since a return created before versioning has none. */
  versions?: RMAVersionEntry[];
  currentVersion?: number;
}

// Return types are no longer drawn. Every seeded return is 'Refund/Credit',
// and how each of its lines actually settles follows the payable state of
// the goods rather than a type on the record.
// "Other" is excluded from seeding — it only exists as a user choice, and
// it would need a free-text note to mean anything.
// Reasons the seeded returns are allowed to carry.
//
// 'Other' is out because a seeded return cannot say what Other meant.
// 'Over-shipped' is out on Eli's instruction, Oct 9: it is not a reason the
// returns desk raises, and sample records using it sent reviewers looking for
// it in the create flow. The reason stays in `RETURN_REASONS` and in the
// return-type rules, so a return that already carries one still reads; nothing
// new is seeded with it.
const REASONS: ReturnReason[] = RETURN_REASONS.filter(
  (r) => r !== 'Other' && r !== 'Over-shipped',
);
// Drawn from the carrier catalogue rather than typed out again. A seeded
// name that is not in the catalogue cannot be looked up, so the detail
// page fell back to the site's default carrier while Versions and Print
// RMA printed the stored name: three places, two answers.
const CARRIERS: string[] = CARRIER_CATALOGUE.map((c) => c.name);

/** Our own receiving facilities. Goods come in at one of these, and a return
 *  leaves from the one it came into, which is what the vendor document has to
 *  say under "Received at". */
const RECEIVING_SITES = [
  'Westminster DC',
  'Plano Receiving',
  'Charlotte Cross-Dock',
  'Aurora Main Store',
];

/** Where a return ships back to. Always a vendor address, so the options
 *  are built from the vendor on the RMA rather than a global list. Shared
 *  with the create screen's Return ship-to picker. */
export function returnShipToOptions(vendorName: string): [string, string, string] {
  // The first is the vendor's own address and reads as the vendor, not as a
  // department inside it: "Returns Dept, Dock 4" was a loading bay pretending
  // to be a partner, and it turned every destination in the flow into the same
  // phrase with a different company glued to the front. The other two are
  // genuinely different places, so they still say which.
  return [
    vendorName,
    `${vendorName} · RMA Processing Center`,
    `${vendorName} · Central Warehouse`,
  ];
}

const STATUS_SEQUENCE: RMAStatus[] = [
  'Draft',
  'Sent',
  'Sent',
  'Approved',
  'Approved',
  'Shipped to Vendor',
  'Shipped to Vendor',
  'Closed',
  'Closed',
];

const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const pickWeighted = <T,>(arr: T[], i: number) => arr[i % arr.length];

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function serialsFor(sku: string, qty: number, seed: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < qty; i++) out.push(buildSerial(sku, seed * 991, i));
  return out;
}

/**
 * Where a whole batch sits.
 *
 * A lot-controlled part that is not serialized has no unit to locate, so the
 * batch itself is what is held somewhere: one code per lot, in the same
 * aisle-rack-bin shape a unit uses, so a picker can be filtered by location
 * whichever kind of stock it is listing.
 */
/**
 * The bins one part is held in.
 *
 * Three or four, stable on the part. Hashing every unit into the whole
 * warehouse put a part in all 288 bins at once, which is not a warehouse, and
 * it made "filter by location" a list nobody could use. Real stock of one
 * part sits in a few places.
 */
/** Where one unit of a part sits: one of that part's own bins. */
export function binForUnit(sku: string, serial: string): string {
  const pool = binsForItem(sku);
  return pool[hashKey(`${sku}:${serial}`) % pool.length]!;
}

/**
 * Where a unit physically sits: aisle, rack, bin.
 *
 * A serialized pool is a list of numbers, and a number tells you nothing about
 * where to walk. Somebody pulling forty units off a shelf works location by
 * location, so the picker can group by this and they can clear one bin before
 * moving to the next. Deterministic on the serial, so a unit is always in the
 * same place.
 */
export function binFor(serial: string): string {
  const h = hashKey(serial);
  // Unsigned shifts. `>>` is signed, so a hash above 2^31 came back negative
  // and produced racks like A-00-0 and A--4-2.
  const aisle = String.fromCharCode(65 + (h % 6));
  const rack = 1 + ((h >>> 3) % 12);
  const bin = 1 + ((h >>> 7) % 4);
  return `${aisle}-${String(rack).padStart(2, '0')}-${bin}`;
}

/** One lot of a part sitting on a receipt, and how much of it is there. */
export interface LotOnHand {
  lot: string;
  /** How much of the part arrived under this lot code. The ceiling on what can
   *  go back under it. */
  qty: number;
  /** Lot-controlled stock is usually date-controlled too, and the date is
   *  often the reason it is going back. */
  expiry: string;
}

/**
 * The lots a receipt's stock of a part sits in.
 *
 * The serial equivalent of this is `availableSerials`, and the two answer the
 * same question a different way: a serialized part is a list of units, a
 * lot-controlled one is a handful of batches with a quantity against each. So
 * the picker for it counts rather than ticks, and this is the pool it counts
 * against. Deterministic on the part and the receipt, so a line opened twice
 * offers the same batches twice.
 */
export function availableLots(sku: string, poLineId: string, receivedQty: number): LotOnHand[] {
  if (receivedQty <= 0) return [];
  const base = hashKey(`${sku}:${poLineId}:lot`);
  // One to three batches. More than that on a single receipt is a warehouse
  // problem rather than a returns one.
  const count = Math.min(1 + (base % 3), Math.max(1, Math.floor(receivedQty)));
  const out: LotOnHand[] = [];
  let left = receivedQty;
  for (let i = 0; i < count; i++) {
    const last = i === count - 1;
    // The first batches take a rough share and the last takes the remainder,
    // so the pool always adds up to what the receipt brought in.
    const share = last ? left : Math.max(1, Math.round(receivedQty / count));
    const qty = Math.min(share, left);
    const code = ((base + i * 977) * 131).toString(36).toUpperCase().slice(-4);
    const day = 1 + ((base + i * 31) % 28);
    const month = 1 + ((base + i * 7) % 12);
    const year = 2027 + ((base + i) % 2);
    out.push({
      lot: `LOT-${sku.slice(0, 3)}-${code}`,
      qty: Math.round(qty * 100) / 100,
      expiry: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
    left = Math.round((left - qty) * 100) / 100;
    if (left <= 0) break;
  }
  return out;
}

/** The batches this vendor holds of this part, and nobody else's.
 *
 *  A batch belongs to one supplier: it arrives as a batch and is held as a
 *  batch, so every unit and every unit of quantity inside it is theirs. A
 *  vendor may hold several batches of the same part; a batch is never shared.
 *  Seeded returns used to invent a lot code from the line's seed, which
 *  produced batches no vendor had ever shipped and which no picker could
 *  find. */
function vendorLots(sku: string, uom: string, vendorCode: string) {
  return lotBlocksFor(sku, uom).filter((b) => lotVendorFor(b)?.vendorCode === vendorCode);
}

/** What is going back out of a counted batch, by the delivery it arrived on.
 *
 *  Taken from the vendor's own batches in order, so the quantity on a return
 *  is quantity that batch actually holds. One or two batches: a return drawn
 *  from five of a vendor's batches is a stock problem rather than a returns
 *  one. */
function lotPicks(sku: string, uom: string, vendorCode: string, qty: number): RMALotAllocation[] {
  const blocks = vendorLots(sku, uom, vendorCode);
  const out: RMALotAllocation[] = [];
  let left = qty;
  for (const block of blocks.slice(0, 2)) {
    for (const r of block.receipts) {
      if (left <= 0) break;
      const take = Math.round(Math.min(left, r.qty) * 100) / 100;
      if (take <= 0) continue;
      out.push({ lot: block.lot, qty: take, grnNumber: r.grnNumber });
      left = Math.round((left - take) * 100) / 100;
    }
    if (left <= 0) break;
  }
  return out;
}

/** The same, for a batch whose units are numbered: which units are going
 *  back, said batch by batch and document by document. The quantity is
 *  however many units that is, because on this kind of part it can be nothing
 *  else. */
function lotUnitPicks(
  sku: string,
  uom: string,
  vendorCode: string,
  qty: number,
): RMALotAllocation[] {
  const want = Math.max(0, Math.floor(qty));
  const out: RMALotAllocation[] = [];
  let left = want;
  for (const block of vendorLots(sku, uom, vendorCode).slice(0, 2)) {
    if (left <= 0) break;
    const byGrn = new Map<string, string[]>();
    lotUnitsInLot(sku, uom, block.lot).forEach((u) => {
      if (left <= 0) return;
      const held = byGrn.get(u.grnNumber);
      if (held) held.push(u.serial);
      else byGrn.set(u.grnNumber, [u.serial]);
      left -= 1;
    });
    byGrn.forEach((serials, grnNumber) =>
      out.push({ lot: block.lot, qty: serials.length, grnNumber, serials }),
    );
  }
  return out;
}

/** This vendor's units of a plain serialized part, in the order they were
 *  received. The same pool the pickers list, so a unit named on a seeded
 *  return is a unit the rest of the app can find. */
function vendorUnits(sku: string, vendorCode: string): string[] {
  const vendor = mockVendors.find((v) => v.vendorCode === vendorCode);
  if (!vendor) return [];
  const out: string[] = [];
  vendor.receivingDocuments.forEach((grn) =>
    grn.items.forEach((line) => {
      if (line.sku !== sku || line.quantity <= 0) return;
      out.push(...availableSerials(sku, line.id, line.quantity));
    }),
  );
  return out;
}

function buildRMALines(
  poItems: LineItem[],
  rmaIndex: number,
  origin: { id: string; name: string },
  /** Who the return is with. Every controlled line is drawn from this
   *  vendor's own stock: their batches, and the units inside them. */
  vendorCode: string,
  /** The order these lines came off, so each one can be measured against the
   *  deliveries booked under it rather than against a stock figure. */
  poNumber: string,
): RMALineItem[] {
  const lineCount = Math.min(poItems.length, 3 + Math.floor(rand() * 5));
  const chosen = poItems.slice(0, lineCount);
  const vendorRecord = mockVendors.find((v) => v.vendorCode === vendorCode);
  /** What the receiving documents on this order actually booked in for a
   *  part. A return is measured against the delivery it is unwinding, not
   *  against what happens to be on the shelf: the two differ whenever a part
   *  arrived on several orders, and reading the shelf figure put thousands
   *  received against a receipt holding dozens. */
  const receivedOnReceipts = (sku: string): number =>
    (vendorRecord?.receivingDocuments ?? [])
      .filter((g) => g.poNumber === poNumber)
      .flatMap((g) => g.items)
      .filter((it) => it.sku === sku)
      .reduce((n, it) => n + it.quantity, 0);
  return chosen.map((li, j) => {
    // `?? ` let a PO line carrying an explicit 0 through, which showed a
    // return of 1 against nothing received.
    const received = receivedOnReceipts(li.sku) || li.receivedQty || li.quantity;
    // What the order asked for, kept beside what arrived so the line can say
    // both. They are different numbers and the table showed one twice.
    const ordered = li.quantity || received;
    const returnQty = Math.max(1, Math.floor(received * (0.2 + rand() * 0.4)));
    const mode = trackingModeFor(li.sku);
    const seed = rmaIndex * 100 + j;
    // What is actually going back, drawn from the vendor's own stock rather
    // than invented beside it. A counted batch gives quantity by document; a
    // numbered batch gives the units themselves, and the quantity is however
    // many that is; a plain serialized line takes units off their deliveries.
    const uom = li.uom;
    const lots =
      mode === 'lot'
        ? lotPicks(li.sku, uom, vendorCode, returnQty)
        : mode === 'lot-serialized'
          ? lotUnitPicks(li.sku, uom, vendorCode, returnQty)
          : [];
    const units =
      mode === 'lot-serialized'
        ? lots.flatMap((a) => a.serials ?? [])
        : mode === 'serialized'
          ? vendorUnits(li.sku, vendorCode).slice(0, Math.max(0, Math.floor(returnQty)))
          : [];
    // A controlled line returns what it could actually draw. Asking for more
    // than the vendor holds in their batches is a figure with nothing behind
    // it, which is what put quantities on lots that do not exist.
    const drawn =
      lots.length > 0
        ? Math.round(lots.reduce((n, a) => n + a.qty, 0) * 100) / 100
        : mode === 'serialized' && units.length > 0
          ? units.length
          : returnQty;
    return {
      id: `rma-line-${rmaIndex}-${j}`,
      poLineId: li.id,
      originId: origin.id,
      originName: origin.name,
      sku: li.sku,
      description: li.description,
      uom: li.uom,
      unitPrice: li.unitPrice,
      orderedQty: ordered,
      // One delivery lands at one of our docks, so the site follows the
      // origin rather than being drawn per line.
      receivedAtSite:
        RECEIVING_SITES[
          Math.abs(
            [...origin.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7),
          ) % RECEIVING_SITES.length
        ]!,
      receivedQty: received,
      returnQty: drawn,
      reason: pickWeighted(REASONS, rmaIndex + j),
      // One return is one resolution, and it lives on the document, so no
      // line carries a type of its own any more. Lines still settle several
      // ways on one return, but on the payable state of their goods -- paid,
      // billed, never billed -- which the receipts decide rather than a
      // field somebody picked.
      returnType: 'Refund/Credit',
      serialNumbers: units.length > 0 ? units : undefined,
      lots: lots.length > 0 ? lots : undefined,
      image: li.image,
    };
  });
}

/** Stock that arrived with no order and no receipt behind it.
 *
 *  Every seeded return was built from a vendor's own receipts, so the state
 *  never appeared: nothing on the list had a line whose downstream documents
 *  do not exist. One return carries a stocktake find, which is what puts the
 *  unlinked row on Linked Records and gives the hover something to explain. */
const UNSOURCED_FINDS = [
  {
    sku: 'MISC-BRG-88',
    description: 'Tapered Roller Bearing 88mm - found in stocktake, no receiver',
    uom: 'EA',
    qty: 46,
    unitPrice: 31.4,
  },
  {
    sku: 'MISC-GSKT-KIT',
    description: 'Gasket & Seal Kit, assorted - counted in, supplier unknown',
    uom: 'BOX',
    qty: 24,
    unitPrice: 62.0,
  },
] as const;

function unsourcedLine(rmaIndex: number, origin: { id: string; name: string }): RMALineItem {
  const found = UNSOURCED_FINDS[rmaIndex % UNSOURCED_FINDS.length]!;
  const returnQty = Math.max(1, Math.floor(found.qty * 0.3));
  return {
    id: `rma-line-${rmaIndex}-unsourced`,
    poLineId: `unsourced-${found.sku}`,
    originId: origin.id,
    originName: origin.name,
    sku: found.sku,
    description: found.description,
    uom: found.uom,
    unitPrice: found.unitPrice,
    receivedQty: found.qty,
    returnQty,
    // Found on a shelf rather than booked in against an order, but it was
    // found on one of ours. Without this the document fell back to the
    // vendor's own site and told them they had received it.
    receivedAtSite:
      RECEIVING_SITES[
        Math.abs([...origin.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)) %
          RECEIVING_SITES.length
      ]!,
    reason: 'Failed inspection',
    returnType: 'Refund/Credit',
  };
}

/** Partner sites a return can be redirected to, drawn from the same
 *  catalogue the Ship-To picker offers so seeded and user-created returns
 *  name the same destinations. */
const REDIRECT_SITES = PARTNER_LOCATION_ITEMS.filter((p) => p.type === 'location');

function generateRMAs(): RMA[] {
  const out: RMA[] = [];
  /** How many closed returns have been seeded as short-paid so far. */
  let shortSettled = 0;
  const eligibleVendors = mockVendors.filter((v) => v.purchaseOrders.length > 0);

  for (let i = 0; i < 24; i++) {
    const vendor = pickWeighted(eligibleVendors, i);
    // A third of the seed spans every site the vendor ships from, so the
    // detail page exercises the fan-out read and not only the single-site
    // case that a flat returnShipTo string can express.
    const multiOrigin = (vendor?.locations.length ?? 1) > 1 && i % 3 === 0;
    const firstPOPerOrigin = new Map<string, VendorPO>();
    for (const p of vendor?.purchaseOrders ?? []) {
      if (!firstPOPerOrigin.has(p.originId)) firstPOPerOrigin.set(p.originId, p);
    }
    const sourcePOs: VendorPO[] = multiOrigin
      ? Array.from(firstPOPerOrigin.values()).slice(0, 3)
      : [pickWeighted(vendor!.purchaseOrders, i + 3)!];
    const po = sourcePOs[0]!;
    const nameForOrigin = (originId: string) =>
      vendor?.locations.find((l) => l.id === originId)?.name ?? vendor!.vendorName;
    const status = pickWeighted(STATUS_SEQUENCE, i);
    // Every return settles as a refund or a credit. Return Only booked the
    // goods straight to a write-off on invoices that were still open and
    // still creditable, which cost money that was never lost; Replacement is
    // backlogged and the flow does not handle it. Neither is seeded.
    const returnType: ReturnType = 'Refund/Credit';
    const reason = pickWeighted(REASONS, i + 2);
    const createdAgo = 3 + Math.floor(rand() * 42);
    const createdDate = daysAgo(createdAgo);
    // Stepping the line seed per PO keeps generated line ids unique when a
    // return draws from more than one PO.
    const items = sourcePOs.flatMap((p, k) =>
      buildRMALines(
        p.items,
        i + k * 31,
        { id: p.originId, name: nameForOrigin(p.originId) },
        vendor!.vendorCode,
        p.poNumber,
      ),
    );
    // Every seeded return was built from a vendor's own receipts, so a line
    // with nothing behind it never appeared on the list. One in nine carries
    // a stocktake find: the state exists in life, and Linked Records has to
    // be able to show it.
    if (i % 9 === 5 && sourcePOs[0]) {
      items.push(
        unsourcedLine(i, {
          id: sourcePOs[0].originId,
          name: nameForOrigin(sourcePOs[0].originId),
        }),
      );
    }
    // Receipts booked against each source PO, narrowed to the ones that
    // actually carry a returned SKU. Vendor data keys receipts by PO rather
    // than by line, so the SKU match is what ties them to this return.
    const returnedSkus = new Set(items.map((li) => li.sku));
    const receiptsForPO = (p: VendorPO) => {
      const poReceipts = (vendor?.receivingDocuments ?? []).filter((g) => g.poNumber === p.poNumber);
      const matched = poReceipts.filter((g) => g.items.some((gi) => returnedSkus.has(gi.sku)));
      const nums = (matched.length > 0 ? matched : poReceipts).map((g) => g.grnNumber);
      // Goods have to have been received for a return to exist, so a PO with
      // no receipt in the vendor data still gets one stamped against this RMA.
      if (nums.length > 0) return nums;
      return [sourcePOs.length > 1 ? `Rec-${1400 + i}-${p.poNumber}` : `Rec-${1400 + i}`];
    };
    const receiptsByPO = new Map(sourcePOs.map((p) => [p.poNumber, receiptsForPO(p)]));
    const receivingNumbers = sourcePOs.flatMap((p) => receiptsByPO.get(p.poNumber)!);
    // Returning to origin is the happy path, so it stays the majority; a
    // slice consolidates so the exception is readable without stepping
    // through the create flow.
    const returnRouting: ReturnRouting = multiOrigin && i % 9 === 0 ? 'consolidated' : 'origin';
    const originIds = Array.from(new Set(sourcePOs.map((p) => p.originId)));
    // A vendor can nominate another party's site to take its returns, so the
    // goods bought from one partner go back to a different one. A slice of
    // the seed routes that way; the rest go to the vendor's own returns dock.
    const redirect = i % 4 === 1 ? REDIRECT_SITES[i % REDIRECT_SITES.length] : undefined;
    const shipToPartner = (redirect ? partnerForItem(redirect)?.name : undefined) ?? vendor!.vendorName;
    const returnLegs: RMAReturnLeg[] =
      returnRouting === 'consolidated'
        ? [
            {
              originIds,
              shipTo: redirect?.name ?? returnShipToOptions(vendor!.vendorName)[0],
              shipToPartner,
              receivingNumbers,
            },
          ]
        : originIds.map((originId) => ({
            originIds: [originId],
            shipTo: redirect?.name ?? returnShipToOptions(nameForOrigin(originId))[0],
            shipToPartner,
            receivingNumbers: sourcePOs
              .filter((p) => p.originId === originId)
              .flatMap((p) => receiptsByPO.get(p.poNumber)!),
          }));
    const owner = i < PINNED_CREATORS.length ? PINNED_CREATORS[i] : pick(TEAM_ROSTER);
    const createdBy = i < PINNED_CREATORS.length ? PINNED_CREATORS[i] : pick(TEAM_ROSTER);

    const rma: RMA = {
      id: `rma-${String(i + 1).padStart(4, '0')}`,
      rmaNumber: `RMA-${String(i + 1001).padStart(5, '0')}`,
      sourcePO: po.poNumber,
      sourcePOs: sourcePOs.map((p) => p.poNumber),
      receivingNumbers,
      vendor: vendor.vendorName,
      vendorCode: vendor.vendorCode,
      status,
      returnType,
      reason,
      owner,
      createdBy,
      createdDate,
      items,
      // The note has to agree with how the return settles. A refund with
      // "Awaiting credit note." on it contradicts every other line on the
      // vendor document, which says the money comes back to the account the
      // invoice was paid from.
      notes:
        i % 3 === 0
          ? `Vendor confirmed defect on inspection. ${
              (i + 1) % 3 === 0 ? 'Awaiting credit note.' : 'Awaiting refund.'
            }`
          : undefined,
      // Point of contact holds the same person as Created by so both
       // columns render with the same avatar/hover recipe (CreatedByCell)
       // and read consistently in the list.
      pointOfContact: createdBy,
      // Known from the vendor profile at creation, so a Draft already says
      // where the goods go back to rather than waiting for the ship step. A
      // fan-out has no single value, so the sidebar falls through to the legs.
      returnShipTo: returnLegs.length === 1 ? returnLegs[0]!.shipTo : undefined,
      returnShipToPartner: returnLegs.length === 1 ? returnLegs[0]!.shipToPartner : undefined,
      returnRouting,
      returnLegs,
      freightArrangedBy: pick(['Vendor', 'Tenant'] as FreightParty[]),
      freightPaidBy: pick(['Vendor', 'Tenant'] as FreightParty[]),
      // Derived from `i` rather than the PRNG so adding it doesn't reshuffle
      // the rest of the seeded dataset.
      payToAccountId: BANK_ACCOUNTS[i % BANK_ACCOUNTS.length]!.id,
      actionHistory: [
        { action: 'create', by: createdBy, at: new Date(createdDate).toISOString() },
      ],
    };

    // One resolution, recorded on the document from the moment it is raised.
    //
    // It used to be stamped only at close, so every return still in flight
    // read "Not chosen" while the ledger projected both a credit note and a
    // cash refund for the same money. A return that has paid goods on it has
    // made this choice at creation, and one that has none settles without a
    // choice, so the field is never the thing that is missing.
    rma.creditTerms = {
      refundOrCredit: (i + 1) % 3 === 0 ? 'Credit' : 'Refund',
      creditPct: 100,
    };

    // What the vendor keeps back out of the refund. Common rather than
    // universal, so roughly a third of the seed carries one and the rest are
    // settled in full: a list where every return is docked reads as a rule,
    // and a list where none is leaves the Return Summary's deduction row and
    // the whole section with no state anybody can see.
    if (i % 3 === 1) {
      const value = rma.items.reduce(
        (sum, li) => sum + authorizedQty(li) * (li.originalUnitPrice ?? li.unitPrice),
        0,
      );
      const restocking = Math.round(value * 0.05 * 100) / 100;
      rma.additionalCharges = [
        { id: 1, type: 'Restocking fee', amount: restocking },
        ...(i % 6 === 1
          ? [{ id: 2, type: 'Return freight', amount: 40 + ((i * 17) % 120) }]
          : []),
      ];
    }

    // Each state is stamped a variable gap after the one before it rather than
    // a fixed offset from creation, so the stage durations the insights band
    // averages actually differ between returns. Derived from `i` and not the
    // PRNG so the rest of the seeded dataset is unaffected. Each gap is taken
    // off the previous stamp, which keeps the chain in order however hard the
    // floor clamps a young return.
    const sentAgo = Math.max(1, createdAgo - (1 + (i % 3)));
    const approvedAgo = Math.max(1, sentAgo - (1 + ((i * 5) % 6)));
    const shippedAgo = Math.max(1, approvedAgo - (1 + ((i * 3) % 5)));
    const receivedAgo = Math.max(1, shippedAgo - (2 + ((i * 7) % 7)));

    // Sent is the "submitted for approval — awaiting Approved" state; it
    // records a sentDate but no approvedDate. All downstream states carry
    // both a sentDate AND an approvedDate.
    if (status !== 'Draft') {
      rma.sentDate = daysAgo(sentAgo);
      rma.actionHistory!.push({
        action: 'submit',
        by: createdBy,
        at: new Date(rma.sentDate).toISOString(),
      });
    }

    if (status === 'Approved' || status === 'Shipped to Vendor' || status === 'Closed') {
      rma.approvedDate = daysAgo(approvedAgo);
      // Some approved returns are partway out: the first shipment has gone
      // and the last is still being staged. They stay Approved, tagged
      // Shipment in process, until the last one ships (ERP-8637 AC9).
      if (status === 'Approved' && rma.items.length > 3 && i % 2 === 0) {
        rma.shipmentStartedDate = daysAgo(Math.max(1, approvedAgo - 2));
      }
      rma.vendorRMANumber = `V-RMA-${String(70000 + i * 7).padStart(6, '0')}`;
      // Vendors authorize the whole request most of the time but not always,
      // so every third return comes back cut short on one line. A line the
      // vendor refuses outright is dropped from the return rather than left
      // on it, and the version history records the removal.
      const partial = i % 3 === 1 && rma.items.length >= 2;
      rma.items = rma.items.map((li, lineIdx) => {
        if (!partial) return { ...li, approvedQty: li.returnQty };
        if (lineIdx === rma.items.length - 2 && li.returnQty > 1) {
          return {
            ...li,
            approvedQty: li.returnQty - 1,
            approvalNote: 'One unit showed use beyond inspection',
          };
        }
        return { ...li, approvedQty: li.returnQty };
      });
      rma.actionHistory!.push({
        action: 'approve',
        by: owner,
        at: new Date(rma.approvedDate).toISOString(),
        reason: partial
          ? 'Vendor authorized the return in part'
          : 'Vendor authorized the return',
      });
    }

    if (status === 'Shipped to Vendor' || status === 'Closed') {
      rma.shippedDate = daysAgo(shippedAgo);
      rma.carrier = pick(CARRIERS);
      rma.actionHistory!.push({
        action: 'ship',
        by: owner,
        at: new Date(rma.shippedDate).toISOString(),
      });
    }

    if (status === 'Closed') {
      rma.receivedDate = daysAgo(receivedAgo);
      rma.receivedCondition = pick([
        'As described, packaging intact',
        'Damaged in transit',
        'Seals broken, units otherwise sound',
      ]);
      // The resolution was chosen when the return was raised; closing only
      // adds what the vendor held back off the credit.
      rma.creditTerms = {
        ...rma.creditTerms,
        creditPct: 100,
        restockingFee: pick([0, 0, 5, 10]),
      };
      // Closing stamps the settlement alongside the arrival, since the two
      // are now one event.
      rma.resolvedDate = rma.receivedDate;
      // Closing settles the return, so both milestones land with it. A return
      // still in flight leaves them unset and its later GL steps stay
      // projected.
      rma.settledDate = rma.receivedDate;
      rma.cashRefundedDate = rma.receivedDate;
      rma.creditNoteRef = `CN-${String(40000 + i * 11).padStart(6, '0')}`;
      rma.actionHistory!.push({
        action: 'close',
        by: owner,
        at: new Date(rma.receivedDate!).toISOString(),
      });
      // Not every vendor pays in full, and some pay nothing at all. Both
      // endings cost money, so the seed carries examples of each: without
      // them the GL tab only ever shows the happy path and the settlement
      // loss accounts are never seen.
      const closedValue =
        Math.round(
          rma.items.reduce(
            (sum, li) => sum + authorizedQty(li) * (li.originalUnitPrice ?? li.unitPrice),
            0,
          ) * 100,
        ) / 100;
      if (i % 11 === 6 && closedValue > 0) {
        rma.refusedDate = rma.receivedDate!;
        rma.refusalNote =
          'Returned outside the 90-day window agreed on the contract, so the units were not accepted.';
        rma.actionHistory!.push({
          action: 'record-refusal',
          // Non-null the same way the dates are: the seed always has an
          // owner by here, and the surrounding pushes predate the stricter
          // optional-property rule.
          by: owner!,
          at: new Date(rma.receivedDate!).toISOString(),
        });
      } else if (
        shortSettled < 2 &&
        closedValue > 0 &&
        // Only a refund is logged, so only a refund can be short-paid here.
        // A short credit is accounting's, at confirmation.
        rma.creditTerms?.refundOrCredit === 'Refund' &&
        // Only a return that actually claims money back can be short-paid,
        // and the first two that can are the ones that do: a modulo landed
        // on returns that claim nothing, and the state was never seeded.
        rma.items.some((li) => (li.returnType ?? rma.returnType) === 'Refund/Credit')
      ) {
        shortSettled += 1;
        // Against the part of the return that actually claims money back,
        // not the whole of it: a replacement line is not part of a credit
        // anybody could under-pay, and 72% of the lot came out above the
        // credit and read as settled in full.
        const claimValue = rma.items
          .filter((li) => (li.returnType ?? rma.returnType) === 'Refund/Credit')
          .reduce(
            (sum, li) => sum + authorizedQty(li) * (li.originalUnitPrice ?? li.unitPrice),
            0,
          );
        rma.creditAmountReceived = Math.round(claimValue * 0.72 * 100) / 100;
        // Someone confirmed the gap as a loss when they logged it, so these
        // are the returns the list shows as Closed with loss.
        rma.closedWithLoss = true;
        rma.settlementLoss = Math.round((claimValue - rma.creditAmountReceived) * 100) / 100;
        rma.actionHistory!.push({
          action: 'log-settlement',
          // Non-null the same way the dates are: the seed always has an
          // owner by here, and the surrounding pushes predate the stricter
          // optional-property rule.
          by: owner!,
          at: new Date(rma.receivedDate!).toISOString(),
        });
      }
    }

    // One return that was called off.
    //
    // Cancelled is the one state a return can be archived from, and the seed
    // had none of them: the rule was unreachable on the list and on the
    // detail page. The fourth return is stopped after it was sent, which is
    // when a cancellation actually happens -- somebody raised it, the vendor
    // had not agreed yet, and the goods never moved.
    if (i === 3) {
      rma.status = 'Cancelled';
      rma.reason = 'Price or terms discrepancy';
      rma.notes = 'Called off before the vendor authorized it. The goods stayed on the shelf.';
      delete rma.shippedDate;
      delete rma.receivedDate;
      delete rma.receivedCondition;
      delete rma.resolvedDate;
      delete rma.settledDate;
      delete rma.cashRefundedDate;
      delete rma.creditNoteRef;
      delete rma.creditAmountReceived;
      delete rma.closedWithLoss;
      delete rma.settlementLoss;
      rma.actionHistory = [
        ...(rma.actionHistory ?? []).filter((h) => h.action === 'create' || h.action === 'submit'),
        {
          action: 'cancel',
          by: rma.owner ?? rma.createdBy,
          at: new Date(daysAgo(Math.max(1, 3))).toISOString(),
          reason: 'Vendor quoted different terms than the order was placed on.',
        },
      ];
    }

    // A refund the vendor is late on (DQ-02). The only refund waiting at
    // Shipped to Vendor shipped 23 days ago, inside the 30-day setting, so
    // the Payment overdue tag had nothing to show. Its whole history moves
    // back 16 days, keeping every gap between steps as it was.
    if (i === 15 && rma.status === 'Shipped to Vendor') {
      const back = (d?: string) =>
        d ? new Date(new Date(d).getTime() - 16 * 86_400_000).toISOString().slice(0, 10) : d;
      rma.createdDate = back(rma.createdDate)!;
      if (rma.sentDate) rma.sentDate = back(rma.sentDate)!;
      if (rma.approvedDate) rma.approvedDate = back(rma.approvedDate)!;
      if (rma.shippedDate) rma.shippedDate = back(rma.shippedDate)!;
      rma.actionHistory = (rma.actionHistory ?? []).map((h) => ({
        ...h,
        at: new Date(new Date(h.at).getTime() - 16 * 86_400_000).toISOString(),
      }));
    }

    // A company that switched Sent and Approved off (DQ-03). Its returns go
    // Draft, Shipped to Vendor, Closed, and this one settles as a credit, so
    // it closes the moment the last of it ships (DQ-01). Held at Draft so
    // the whole short lifecycle can be walked from the detail page.
    if (i === 6) {
      rma.lifecycle = 'ship-direct';
      rma.status = 'Draft';
      rma.creditTerms = { refundOrCredit: 'Credit', creditPct: 100 };
      rma.notes = 'Vendor takes returns without an authorization step. Credit raised once the goods ship.';
      // Nobody asks the vendor later, so both are written at creation.
      rma.vendorRMANumber = `V-RMA-${String(70000 + i * 7).padStart(6, '0')}`;
      rma.expectedResolutionDate = daysAgo(-21);
      rma.items = rma.items.map((li) => {
        const { approvedQty: _a, approvalNote: _n, ...rest } = li;
        return rest;
      });
      for (const k of [
        'sentDate', 'approvedDate', 'shippedDate', 'shipmentStartedDate', 'carrier',
        'receivedDate', 'receivedCondition', 'resolvedDate', 'settledDate',
        'cashRefundedDate', 'creditNoteRef', 'creditAmountReceived',
        'closedWithLoss', 'settlementLoss', 'refusedDate', 'refusalNote',
      ] as const) {
        delete rma[k];
      }
      delete rma.additionalCharges;
      rma.actionHistory = (rma.actionHistory ?? []).filter((h) => h.action === 'create');
    }

    out.push(rma);
  }

  return out;
}

/** Returns pulled from the seed by hand.
 *
 *  The generator builds each record from its own index, so dropping one at
 *  the end leaves every other record exactly as it was. A gap in the numbers
 *  is what a real ledger looks like anyway: numbers get issued and the
 *  return behind one never happens. */
const WITHDRAWN_RMA_NUMBERS = new Set(['RMA-01019', 'RMA-01022']);

export const mockRMAs: RMA[] = generateRMAs().filter(
  (r) => !WITHDRAWN_RMA_NUMBERS.has(r.rmaNumber),
);

export interface VendorReturnsContact {
  name: string;
  role: string;
  email: string;
  phone: string;
}

const RETURNS_CONTACT_NAMES = [
  'Katherine Walsh',
  'Marcus Delgado',
  'Priya Raghunathan',
  'Tobias Lindqvist',
  'Renée Beaumont',
  'Samuel Okafor',
  'Hana Watanabe',
  'Gabriela Ortiz',
];

const RETURNS_CONTACT_ROLES = [
  'Returns Coordinator',
  'RMA Desk Lead',
  'Aftermarket Support Manager',
  'Warranty Claims Specialist',
];

/** The person at the vendor who handles this return. Derived from the vendor
 *  name so the same vendor always answers with the same desk, which is what a
 *  buyer expects when they call about a second return. */
export function returnsContactFor(vendor: string): VendorReturnsContact {
  let hash = 0;
  for (let i = 0; i < vendor.length; i++) hash = (hash * 31 + vendor.charCodeAt(i)) >>> 0;
  const name = RETURNS_CONTACT_NAMES[hash % RETURNS_CONTACT_NAMES.length]!;
  const role = RETURNS_CONTACT_ROLES[(hash >>> 3) % RETURNS_CONTACT_ROLES.length]!;
  const [first = '', last = ''] = name.split(' ');
  const domain = vendor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .join('');
  return {
    name,
    role,
    email: `${first[0]!.toLowerCase()}.${last.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@${domain || 'vendor'}.com`,
    phone: `+1 (${200 + (hash % 700)}) ${100 + ((hash >>> 5) % 900)}-${String((hash >>> 11) % 10000).padStart(4, '0')}`,
  };
}

/** Every PO a return is raised against. An RMA created in-session carries only
 *  the single `sourcePO` it was built from. */
export function sourcePOsForRMA(rma: RMA): string[] {
  return rma.sourcePOs && rma.sourcePOs.length > 0 ? rma.sourcePOs : [rma.sourcePO];
}

/** Receiving documents to show against a return. Falls back to the vendor's
 *  receipts for the source PO so an RMA created in-session, which carries no
 *  receipt of its own, still reads with the goods it was raised against. */
export function receivingsForRMA(rma: RMA): string[] {
  if (rma.receivingNumbers && rma.receivingNumbers.length > 0) return rma.receivingNumbers;
  const vendor = mockVendors.find((v) => v.vendorName === rma.vendor);
  const receipts = (vendor?.receivingDocuments ?? []).filter((g) => g.poNumber === rma.sourcePO);
  const returnedSkus = new Set(rma.items.map((li) => li.sku));
  const matched = receipts.filter((g) => g.items.some((gi) => returnedSkus.has(gi.sku)));
  return (matched.length > 0 ? matched : receipts).map((g) => g.grnNumber);
}
