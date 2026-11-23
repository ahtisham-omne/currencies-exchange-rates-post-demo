/**
 * Journal entries a vendor return books, per the finance-confirmed GL impact
 * for RTV (PO side only), `rma-gl-transactions.md` of 01 Sep.
 *
 * Nothing posts in Draft. Every scenario opens with the same entry: the goods
 * leave on-hand stock and park in Other Receivables – Vendor Returns. What follows drains
 * that account, and which entry that is depends on what the vendor does with
 * the goods and on how far the original receipt got billed. The account nets
 * to zero once a return is fully resolved, which is the check the tab shows.
 *
 * Two of those endings cost money. A vendor who settles short pays part of
 * the value and the gap is a loss; a vendor who refuses pays none of it and
 * the whole value is written off. Neither rewrites the price: every entry is
 * valued at the original PO price per unit, so the loss is where the
 * difference is recognised rather than in a quietly restated line.
 *
 * Repair is out of scope, and `ReturnType` carries no such option.
 *
 * In PKR, the base currency (Currency Touchpoints Map, 2026-11-24). A return in
 * another currency books every step at the receiving rate, the rate its
 * receipt was booked at, except what the vendor settles: that is worth
 * today's rate (the settlement day's once settled), and the gap posts as its
 * own FX variance step to FX Gain or FX Loss. Goods never invoiced reverse
 * their accrual at the receiving rate, with no FX, and RMA Settlement Loss
 * only takes what the vendor didn't pay.
 */

import type { RMA, RMALineItem } from './mockRMAs';
import { authorizedQty } from './mockRMAs';
import { invoiceSplitForRMALine } from './receiptInvoiceStatus';
import type { ReturnBucket } from './rmaReturnAllocation';
import { PAY_FROM_ACCOUNTS } from './mockPayments';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, rateSentence } from '@/app/currency/money';
import { splitToBase, toBase } from '@/app/currency/rates';

export interface GLAccount {
  code: string;
  name: string;
}

/** Amounts in PKR, the base currency. */
export interface GLPosting {
  account: GLAccount;
  debit?: number;
  credit?: number;
  /** The same amount in the return's currency, where it has one (the FX
   *  variance has none): what the hover shows. */
  doc?: number;
}

export interface GLEntry {
  id: string;
  /** In the base currency only, with no amount in the return's currency: the
   *  FX variance step. */
  baseOnly?: boolean;
  /** Step heading, the event that books the entry. */
  title: string;
  /** One line saying when it fires, so a projected step reads as a promise. */
  trigger: string;
  posted: boolean;
  /** Set only once posted. */
  date?: string;
  postings: GLPosting[];
}

export const GL_ACCOUNTS = {
  inventoryOnHand: { code: '1200', name: 'Inventory, On Hand' },
  /** Shipped out on a return and not yet resolved. Still ours, not sellable. */
  inventoryAtVendor: { code: '1255', name: 'Other Receivables – Vendor Returns' },
  /** A credit owed on a receipt that was already paid, until the cash lands. */
  vendorCredits: { code: '1320', name: 'Vendor Credits Receivable' },
  payFrom: { code: '1000', name: 'Pay-From Account' },
  apTrade: { code: '2000', name: 'Accounts Payable' },
  apAccrual: { code: '2150', name: 'AP Accrual' },
  /** The gap when the vendor settles for less than the goods were worth. */
  settlementLoss: { code: '6810', name: 'RMA Settlement Loss' },
  /** The value lost when the vendor will not settle at all. */
  writeOffLoss: { code: '6820', name: 'RMA Write-Off Loss' },
  /** What the vendor keeps back by agreement: restocking, return freight.
   *  Agreed before the money moves, so it is a cost of the return rather than
   *  a shortfall on it. */
  vendorCharges: { code: '6830', name: 'RMA Vendor Charges' },
  /** What the vendor settles, worth more or less at the settlement rate than
   *  the receipt it reverses was booked at: the FX variance. Separate
   *  accounts, never "FX Gain/Loss" (Mahreen). */
  fxGain: { code: '4910', name: 'FX Gain' },
  fxLoss: { code: '6910', name: 'FX Loss' },
} as const satisfies Record<string, GLAccount>;

/**
 * Which ending a line is heading for. Return type decides most of it; a
 * credit splits further on whether the receipt was already paid, because a
 * paid return is owed cash rather than a smaller payable.
 *
 * `write-off` is where a line claims nothing back and the goods were already
 * billed: the invoice still stands, no credit is coming, so the value leaves
 * the books as a loss rather than as a smaller payable.
 */
export type RMAGLScenario =
  | 'credit-unpaid'
  | 'credit-paid'
  | 'replacement'
  | 'accrual'
  | 'accrual-noclaim'
  | 'write-off';

const SCENARIO_ORDER: RMAGLScenario[] = [
  'credit-unpaid',
  'credit-paid',
  'replacement',
  'accrual',
  'accrual-noclaim',
  'write-off',
];

/** Endings where the vendor owes money back, and where a short settlement is
 *  therefore possible. A replacement settles in goods and an accrual reversal
 *  settles nothing, so neither can come up short.
 *
 *  `accrual` was in this list, which counted goods never invoiced as money
 *  the vendor owed: Log settlement expected the whole $1,025.81 of RMA-01020
 *  when only $248.09 had been paid, and a short settlement booked the
 *  never-billed goods as a loss. Nothing was paid for them and no invoice
 *  stands to be credited, so they unwind against the goods-receipt accrual
 *  whatever the vendor sends. */
const SETTLES_IN_MONEY: RMAGLScenario[] = ['credit-unpaid', 'credit-paid'];

/** How one line's value divides across the endings it is heading for.
 *
 *  A return has one resolution, on the document. What a line does *not* get
 *  to decide is how it settles: that follows the payable state of the goods
 *  underneath it, and one line's units can sit in more than one state at
 *  once. Ten units received, four of them paid and six on an open invoice,
 *  are four units owed money back and six units of payable that shrinks.
 *
 *  Reading the whole line into whichever state held the most units was what
 *  made the summary disagree with the lines: the card claimed the full value
 *  was paid for when only part of it was.
 */
function scenarioSplitForLine(
  rma: RMA,
  line: RMALineItem,
): Array<{ scenario: RMAGLScenario; value: number }> {
  const value = lineValue(line);
  if (value <= 0.004) return [];
  const going = authorizedQty(line);
  if (going <= 0) return [];
  const perUnit = value / going;

  const emit = (paidQty: number, billedQty: number): Array<{ scenario: RMAGLScenario; value: number }> => {
    const paidValue = round2(paidQty * perUnit);
    const billedValue = round2(billedQty * perUnit);
    // The remainder carries the rounding so the parts always add back to the
    // line, which is the check the holding account balance depends on.
    const accrualValue = round2(value - paidValue - billedValue);
    const parts: Array<{ scenario: RMAGLScenario; value: number }> = [];
    if (paidValue > 0.004) parts.push({ scenario: 'credit-paid', value: paidValue });
    if (billedValue > 0.004) parts.push({ scenario: 'credit-unpaid', value: billedValue });
    if (accrualValue > 0.004) parts.push({ scenario: 'accrual', value: accrualValue });
    return parts;
  };

  // Where the create flow recorded how the units sat across invoice states,
  // that is the record's own answer and it wins over re-deriving one.
  const settlements = line.settlements && line.settlements.length > 1 ? line.settlements : null;
  if (settlements) {
    const qtyIn = (state: ReturnBucket) =>
      settlements.filter((sx) => sx.state === state).reduce((n, sx) => n + sx.qty, 0);
    const paidQty = Math.min(going, qtyIn('paid'));
    const billedQty = Math.min(going - paidQty, qtyIn('invoicedUnpaid'));
    return emit(paidQty, billedQty);
  }

  const split = invoiceSplitForRMALine(
    rma.vendor,
    rma.receivingNumbers,
    line.originId,
    line.sku,
    line.receivedQty,
  );
  // The paid units the create flow showed, where it recorded them. Taking
  // the order's paid share instead moved money between refund and credit
  // the moment the return was saved.
  const recordedPaid = line.paidQty !== undefined ? Math.min(going, line.paidQty) : undefined;
  // Nothing behind the line at all — a stocktake find, say — is goods that
  // were never billed, so the accrual is the only thing to come off.
  if (!split || split.received <= 0) {
    return recordedPaid !== undefined && recordedPaid > 0 ? emit(recordedPaid, 0) : [{ scenario: 'accrual', value }];
  }

  const paidQty = recordedPaid ?? Math.min(going, (split.paid / split.received) * going);
  const billedQty = Math.min(going - paidQty, (split.invoicedUnpaid / split.received) * going);
  return emit(paidQty, billedQty);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Figures inside a trigger sentence. No symbol: the tab knows the currency
 *  and the entry tables carry it, so a bare grouped number reads as part of
 *  the sentence rather than as a second opinion on what it is worth. */
const grouped = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** What a line is worth to the ledger.
 *
 *  The original PO price, always. A price corrected on the return is kept for
 *  the paperwork, not for the books: valuing the entry at the new figure
 *  would rewrite history through the back door, and the doc is explicit that
 *  the price is never rewritten. */
function lineValue(line: RMALineItem): number {
  return authorizedQty(line) * (line.originalUnitPrice ?? line.unitPrice);
}

/** The bank or card the refund actually lands in, where the return named one.
 *  `creditGl` carries "1010 Operating Bank", which is the code and the name
 *  in one string. */
function payFromAccount(rma: RMA): GLAccount {
  // Where the refund was logged as deposited wins over where the return
  // nominated it, because it is where the money actually is.
  const deposited = [...(rma.settlementEntries ?? [])]
    .reverse()
    .find((e) => e.depositedToAccountId)?.depositedToAccountId;
  const picked = PAY_FROM_ACCOUNTS.find((a) => a.id === (deposited ?? rma.payToAccountId));
  if (!picked) return GL_ACCOUNTS.payFrom;
  const [code, ...rest] = picked.creditGl.split(' ');
  if (!code || rest.length === 0) return { code: GL_ACCOUNTS.payFrom.code, name: picked.label };
  return { code, name: rest.join(' ') };
}

/** What the return is worth, what the vendor actually gave back, and the gap.
 *
 *  Only the endings that settle in money can come up short, so the expected
 *  figure counts those alone: a replacement line is not part of a credit
 *  somebody under-paid. An over-credit is left alone rather than booked as a
 *  gain, which is a conversation with finance rather than a posting. */
export interface RMASettlementSummary {
  /** Total value leaving on the return, every line, at PO price. */
  value: number;
  /** The part of that the vendor owes back in money before charges: what
   *  was paid, plus what is credited against an invoice still open. Goods
   *  never invoiced are not in it. */
  claimed: number;
  /** What the vendor keeps back by agreement, never more than `claimed`. */
  charges: number;
  /** The cash coming back: the paid share less the charges. The share on an
   *  open invoice comes back as a credit note and is not in it. */
  expected: number;
  /** What they actually settled, where it has been recorded. */
  received: number | null;
  /** Expected less received, never below zero. */
  loss: number;
  /** Value written off because the vendor refused or nothing is coming back. */
  writtenOff: number;
  /** `refused` is the vendor turning the goods away; `written-off` is a
   *  return that never claimed anything back on goods already billed, which
   *  costs the same money by a different route. */
  kind: 'open' | 'settled' | 'short' | 'refused' | 'written-off';
}

/**
 * What a restocking fee is a percentage of: the full return value, every
 * line at PO price, invoiced or not.
 *
 * It used to be only the billed part, paid plus credited against the open
 * invoice, which left goods not yet invoiced out of the base and put the fee
 * at half what the vendor quoted on RMA-01013 ($283.19 against $578.14 at
 * 10%). A vendor quotes the percentage on the goods coming back, so that is
 * what it is taken of. The percentage itself is unchanged; only the dollars
 * it comes to.
 */
export function restockingFeeBase(rma: RMA): number {
  return round2([...scenarioTotals(rma).values()].reduce((s, v) => s + v, 0));
}

/** One bucket's share of a return, for the places that show the base split
 *  into the parts a reader can recognise. */
export function scenarioValue(rma: RMA, scenario: RMAGLScenario): number {
  return round2(scenarioTotals(rma).get(scenario) ?? 0);
}

/** The money a restocking fee of `pct` keeps back on this return. */
export function restockingFeeAmount(rma: RMA, pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return round2(restockingFeeBase(rma) * (pct / 100));
}

/** What the vendor keeps back on this return: every agreed charge, plus a
 *  restocking fee held only as a percentage where no charge line carries it
 *  in dollars yet. */
export function rmaVendorChargesTotal(rma: RMA): number {
  const charges = rma.additionalCharges ?? [];
  const listed = charges.reduce((n, c) => n + (c.amount || 0), 0);
  const feeListed = charges.some((c) => c.type === 'Restocking fee' && c.amount > 0.004);
  const pct = rma.creditTerms?.restockingFee ?? 0;
  return round2(listed + (feeListed ? 0 : restockingFeeAmount(rma, pct)));
}

/** How the money on a return divides once the vendor's charges are taken.
 *
 *  Two different things come back. The paid share comes back as cash, and
 *  that is the figure Log settlement waits on. The share still on an open
 *  invoice comes back as a credit note against the payable: no cash moves,
 *  and nothing a vendor sends can make it short. Charges come off the cash
 *  first, and only what the cash cannot cover comes off the credit note. */
function moneySplit(rma: RMA, byScenario: Map<RMAGLScenario, number>) {
  const paid = round2(byScenario.get('credit-paid') ?? 0);
  const credit = round2(byScenario.get('credit-unpaid') ?? 0);
  const charges = Math.min(round2(paid + credit), rmaVendorChargesTotal(rma));
  const chargesOnPaid = Math.min(paid, charges);
  const chargesOnCredit = round2(charges - chargesOnPaid);
  return {
    paid,
    credit,
    charges,
    chargesOnPaid,
    chargesOnCredit,
    cashDue: round2(paid - chargesOnPaid),
    creditDue: round2(credit - chargesOnCredit),
  };
}

export function rmaSettlementSummary(rma: RMA): RMASettlementSummary {
  const byScenario = scenarioTotals(rma);
  const value = round2([...byScenario.values()].reduce((s, v) => s + v, 0));
  const refused = Boolean(rma.refusedDate);
  const claimed = round2(
    SETTLES_IN_MONEY.reduce((s, sc) => s + (byScenario.get(sc) ?? 0), 0),
  );
  // Charges come off before anything is owed, so they are never a shortfall:
  // a vendor who keeps $123.00 of freight back as agreed has not paid short.
  // What is expected is the cash: the paid share less the charges. The open
  // invoice share settles as a credit note and is never part of a payment.
  const { charges, cashDue } = moneySplit(rma, byScenario);
  const expected = cashDue;
  const writtenOff = refused ? value : round2(byScenario.get('write-off') ?? 0);
  // Clamped to what the return could have been owed, the same way the
  // entries clamp it. A figure recorded against a return that claims no
  // money back is not money that came back.
  const received =
    refused || rma.creditAmountReceived === undefined
      ? refused
        ? 0
        : null
      : Math.min(round2(rma.creditAmountReceived), expected);
  // Only a settled return can be short. Before that, what has come back is
  // a part payment and the rest is still owed, not lost.
  const loss =
    refused || received === null || !rma.settledDate
      ? 0
      : Math.max(0, round2(expected - received));

  return {
    value,
    claimed: refused ? 0 : claimed,
    charges: refused ? 0 : charges,
    expected: refused ? 0 : expected,
    received,
    loss,
    writtenOff,
    kind: refused
      ? 'refused'
      : loss > 0.004
        ? 'short'
        : writtenOff > 0.004
          ? 'written-off'
          : received === null
            ? 'open'
            : 'settled',
  };
}

/** What this return is worth against each way it can settle. The detail
 *  page reads it to know whether there is a resolution to ask about at all:
 *  only money already paid out leaves anybody a choice. */
export function rmaScenarioValues(rma: RMA): Record<RMAGLScenario, number> {
  const totals = scenarioTotals(rma);
  return {
    'credit-unpaid': round2(totals.get('credit-unpaid') ?? 0),
    'credit-paid': round2(totals.get('credit-paid') ?? 0),
    replacement: round2(totals.get('replacement') ?? 0),
    accrual: round2(totals.get('accrual') ?? 0),
    'accrual-noclaim': round2(totals.get('accrual-noclaim') ?? 0),
    'write-off': round2(totals.get('write-off') ?? 0),
  };
}

function scenarioTotals(rma: RMA): Map<RMAGLScenario, number> {
  const byScenario = new Map<RMAGLScenario, number>();
  for (const line of rma.items) {
    for (const { scenario, value } of scenarioSplitForLine(rma, line)) {
      byScenario.set(scenario, (byScenario.get(scenario) ?? 0) + value);
    }
  }
  return byScenario;
}

/** What a return's value divides into once the vendor settles, or is expected
 *  to, in the return's currency. The Return Summary's rows, the currency
 *  block and GL Impact all read it, so they never disagree on a figure.
 *
 *  `settlesCredit + settlesCash + charges + loss` is everything that was
 *  invoiced; with `reverses`, `replacement` and `writtenOff` it adds back to
 *  `value`. */
export interface RMASettlementParts {
  /** Every line at the original PO price. */
  value: number;
  /** The vendor's credit note against the payable, after charges: the share on
   *  an open invoice, plus the paid share where the return takes a credit. */
  settlesCredit: number;
  /** The paid share coming back as cash, after charges: what was received once
   *  the return settled, what is due until then. */
  settlesCash: number;
  /** What the vendor settles in money: credit note and cash. The amount the FX
   *  variance is taken on. */
  settles: number;
  /** What the vendor keeps back by agreement. */
  charges: number;
  /** A short settlement's gap, written off to RMA Settlement Loss. */
  loss: number;
  /** Goods never invoiced: their accrual reverses, nothing comes back. */
  reverses: number;
  replacement: number;
  /** Billed goods closed with nothing back, or the whole return when the
   *  vendor refused it. */
  writtenOff: number;
  refused: boolean;
  /** The paid share, before charges (the Refund or Credit row). */
  paid: number;
  /** The open-invoice share, before charges (the Vendor credit row). */
  credit: number;
  /** The return takes a credit on goods already paid for. */
  takesCreditOnPaid: boolean;
}

export function rmaSettlementParts(rma: RMA): RMASettlementParts {
  const byScenario = scenarioTotals(rma);
  const value = round2([...byScenario.values()].reduce((s, v) => s + v, 0));
  const takesCreditOnPaid = rma.creditTerms?.refundOrCredit === 'Credit';
  const paidGross = round2(byScenario.get('credit-paid') ?? 0);
  const creditGross = round2(byScenario.get('credit-unpaid') ?? 0);
  const empty = {
    value,
    settlesCredit: 0,
    settlesCash: 0,
    settles: 0,
    charges: 0,
    loss: 0,
    reverses: 0,
    replacement: 0,
    writtenOff: 0,
    refused: false,
    paid: paidGross,
    credit: creditGross,
    takesCreditOnPaid,
  };
  if (rma.refusedDate) return { ...empty, writtenOff: value, refused: true };
  // A credit taken on paid goods books like a credit on an open invoice: the
  // payable drops and no cash moves.
  if (takesCreditOnPaid && byScenario.has('credit-paid')) {
    byScenario.set('credit-unpaid', round2(creditGross + paidGross));
    byScenario.delete('credit-paid');
  }
  const split = moneySplit(rma, byScenario);
  const paidBack =
    rma.creditAmountReceived === undefined || !rma.settledDate
      ? null
      : Math.min(round2(rma.creditAmountReceived), split.cashDue);
  const settlesCash = paidBack ?? split.cashDue;
  const settlesCredit = split.creditDue;
  return {
    ...empty,
    settlesCredit,
    settlesCash,
    settles: round2(settlesCredit + settlesCash),
    charges: split.charges,
    loss: paidBack === null ? 0 : Math.max(0, round2(split.cashDue - paidBack)),
    reverses: round2((byScenario.get('accrual') ?? 0) + (byScenario.get('accrual-noclaim') ?? 0)),
    replacement: round2(byScenario.get('replacement') ?? 0),
    writtenOff: round2(byScenario.get('write-off') ?? 0),
  };
}

/** The same parts in PKR at the receiving rate, the paisa split so they add
 *  up to the Return value's own conversion exactly. */
export interface RMASettlementBase {
  value: number;
  settlesCredit: number;
  settlesCash: number;
  /** What the vendor settles, at the receiving rate: what it clears off 1255. */
  settles: number;
  charges: number;
  loss: number;
  reverses: number;
  replacement: number;
  writtenOff: number;
}

export function rmaSettlementBase(parts: RMASettlementParts, receivingRate: number): RMASettlementBase {
  const value = toBase(parts.value, receivingRate);
  // What the vendor settles is its own conversion, so the FX variance is
  // exactly settled × (settle rate − receiving rate) and reads zero when the
  // two rates agree. The other parts share what is left of the Return value.
  const settles = Math.min(value, toBase(parts.settles, receivingRate));
  const [settlesCredit = 0, settlesCash = 0] = splitToBase([parts.settlesCredit, parts.settlesCash], receivingRate, settles);
  const [charges = 0, loss = 0, reverses = 0, replacement = 0, writtenOff = 0] = splitToBase(
    [parts.charges, parts.loss, parts.reverses, parts.replacement, parts.writtenOff],
    receivingRate,
    round2(value - settles),
  );
  return { value, settlesCredit, settlesCash, settles, charges, loss, reverses, replacement, writtenOff };
}

/** The two rates a return's ledger needs (returnSettlement.ts works them out). */
export interface RMAGLRates {
  /** The return's currency. */
  currency: string;
  /** PKR per one unit on the receiving day (each receipt's, blended). */
  receivingRate: number;
  /** PKR per one unit the vendor settles at: today's of the configured type
   *  while the return is open, the settlement day's once settled. */
  settleRate: number;
}

/** The FX variance on what the vendor settles, split between the payable (the
 *  credit note) and the bank (the cash), so each carries its own share. */
function fxVarianceSplit(parts: RMASettlementParts, base: RMASettlementBase, settleRate: number) {
  const now = toBase(parts.settles, settleRate);
  const creditNow = toBase(parts.settlesCredit, settleRate);
  const cashNow = round2(now - creditNow);
  return {
    total: round2(now - base.settles),
    onCredit: round2(creditNow - base.settlesCredit),
    onCash: round2(cashNow - base.settlesCash),
  };
}

/** What the vendor settles is worth this much more (+) or less (−) in PKR at
 *  the settlement rate than at the receiving rate: settled amount × (settle
 *  rate − receiving rate), to the paisa the ledger posts. */
export function rmaFxVariance(parts: RMASettlementParts, base: RMASettlementBase, settleRate: number): number {
  return fxVarianceSplit(parts, base, settleRate).total;
}

/** Ordered journal entries for a return, in PKR. Empty while the return is a
 *  draft, since nothing is committed to post yet.
 *
 *  1 · Goods ship back: 1255 ← 1200 Inventory, at the receiving rate.
 *  2 · Vendor settles: clears 1255 at the receiving rate, against the payable
 *      (credit note) and the refund receivable, with agreed charges and any
 *      short-payment loss beside them.
 *      Vendor refunds cash: the receivable clears into the bank.
 *  3 · FX variance: what was settled, at the settlement rate less the
 *      receiving rate, to FX Gain (+) or FX Loss (−).
 *  4 · Accrual reversed: 2150 AP Accrual at the receiving rate, no FX.
 *  Then a replacement or a write-off where the return ends that way. */
export function buildRMAGLEntries(rma: RMA, rates: RMAGLRates): GLEntry[] {
  if (rma.status === 'Draft') return [];

  const parts = rmaSettlementParts(rma);
  if (parts.value <= 0.004) return [];
  const code = rates.currency.toUpperCase();
  const foreign = !isBaseCurrency(code);
  const r = foreign ? rates.receivingRate : 1;
  const base = rmaSettlementBase(parts, r);

  const shipped = Boolean(rma.shippedDate);
  const settled = Boolean(rma.settledDate);
  const refunded = Boolean(rma.cashRefundedDate);
  const atReceiving = foreign ? ` at the receiving rate, ${rateSentence(code, r)}` : '';

  const entries: GLEntry[] = [
    {
      id: 'ship',
      title: 'Goods ship back',
      trigger: `Posts when the return physically leaves on the shipment, valued${atReceiving || ' at the original PO price'}.`,
      posted: shipped,
      ...(shipped && rma.shippedDate ? { date: rma.shippedDate } : {}),
      postings: [
        { account: GL_ACCOUNTS.inventoryAtVendor, debit: base.value, doc: parts.value },
        { account: GL_ACCOUNTS.inventoryOnHand, credit: base.value, doc: parts.value },
      ],
    },
  ];

  // The vendor refused the lot. Nothing is coming back and nothing is owed,
  // so whatever each line was heading for stops mattering: one entry clears
  // the holding account and takes the hit.
  if (parts.refused) {
    entries.push({
      id: 'refused',
      title: 'Vendor refused the return',
      trigger: 'The goods are gone and nothing is coming back, so the value is written off.',
      posted: true,
      ...(rma.refusedDate ? { date: rma.refusedDate } : {}),
      postings: [
        { account: GL_ACCOUNTS.writeOffLoss, debit: base.value, doc: parts.value },
        { account: GL_ACCOUNTS.inventoryAtVendor, credit: base.value, doc: parts.value },
      ],
    });
    return entries;
  }

  // ── 2 · Vendor settles ──────────────────────────────────────────────
  const invoiced = round2(parts.settles + parts.charges + parts.loss);
  if (invoiced > 0.004) {
    const postings: GLPosting[] = [];
    if (base.settlesCredit > 0.004)
      postings.push({ account: GL_ACCOUNTS.apTrade, debit: base.settlesCredit, doc: parts.settlesCredit });
    if (base.settlesCash > 0.004)
      postings.push({ account: GL_ACCOUNTS.vendorCredits, debit: base.settlesCash, doc: parts.settlesCash });
    if (base.charges > 0.004) postings.push({ account: GL_ACCOUNTS.vendorCharges, debit: base.charges, doc: parts.charges });
    if (base.loss > 0.004) postings.push({ account: GL_ACCOUNTS.settlementLoss, debit: base.loss, doc: parts.loss });
    const cleared = round2(base.settlesCredit + base.settlesCash + base.charges + base.loss);
    postings.push({ account: GL_ACCOUNTS.inventoryAtVendor, credit: cleared, doc: invoiced });
    const said: string[] = [`Clears 1255${atReceiving}.`];
    if (parts.settlesCredit > 0.004 && parts.settlesCash > 0.004)
      said.push('The credit note lowers the payable, and the paid share is owed back as a refund.');
    else if (parts.settlesCredit > 0.004)
      said.push(
        parts.takesCreditOnPaid && parts.paid > 0.004
          ? 'A credit note lowers the payable; what was already paid sits on the vendor account for a future invoice.'
          : 'A credit note lowers the payable. No cash moves.',
      );
    else if (parts.settlesCash > 0.004) said.push('The invoice was already paid, so the credit is owed back as a refund.');
    if (parts.charges > 0.004) said.push(`${formatMoney(parts.charges, code)} is kept back as agreed vendor charges.`);
    if (parts.loss > 0.004)
      said.push(
        `They settled ${formatMoney(parts.settlesCash, code)} of ${formatMoney(round2(parts.settlesCash + parts.loss), code)} in cash, so the gap is a loss.`,
      );
    entries.push({
      id: 'settle',
      title: `Vendor settles ${formatMoney(parts.settles, code)}`,
      trigger: said.join(' '),
      posted: settled,
      ...(settled && rma.settledDate ? { date: rma.settledDate } : {}),
      postings,
    });
  }

  if (base.settlesCash > 0.004) {
    entries.push({
      id: 'refund',
      title: 'Vendor refunds cash',
      trigger: `Posts when the refund lands and clears the receivable${foreign ? ', at the receiving rate it was booked at' : ''}.`,
      posted: refunded,
      ...(refunded && rma.cashRefundedDate ? { date: rma.cashRefundedDate } : {}),
      postings: [
        { account: payFromAccount(rma), debit: base.settlesCash, doc: parts.settlesCash },
        { account: GL_ACCOUNTS.vendorCredits, credit: base.settlesCash, doc: parts.settlesCash },
      ],
    });
  }

  // ── 3 · FX variance ─────────────────────────────────────────────────
  if (foreign && parts.settles > 0.004) {
    const fx = fxVarianceSplit(parts, base, rates.settleRate);
    if (Math.abs(fx.total) >= 0.005) {
      const gain = fx.total > 0;
      const bank = payFromAccount(rma);
      const sides: GLPosting[] = [];
      const side = (account: GLAccount, amount: number) => {
        if (Math.abs(amount) < 0.005) return;
        sides.push(amount > 0 ? { account, debit: amount } : { account, credit: -amount });
      };
      side(GL_ACCOUNTS.apTrade, fx.onCredit);
      side(bank, fx.onCash);
      const postings: GLPosting[] = gain
        ? [...sides, { account: GL_ACCOUNTS.fxGain, credit: fx.total }]
        : [{ account: GL_ACCOUNTS.fxLoss, debit: -fx.total }, ...sides];
      entries.push({
        id: 'fx-variance',
        baseOnly: true,
        title: `FX variance · ${gain ? GL_ACCOUNTS.fxGain.name : GL_ACCOUNTS.fxLoss.name}`,
        trigger: `${formatMoney(parts.settles, code)} settled at ${rateSentence(code, rates.settleRate)} against the receiving rate, ${rateSentence(code, r)}: ${formatMoney(Math.abs(fx.total), BASE_CURRENCY)} ${gain ? 'more' : 'less'} than booked, to ${gain ? GL_ACCOUNTS.fxGain.name : GL_ACCOUNTS.fxLoss.name}.`,
        posted: settled,
        ...(settled && rma.settledDate ? { date: rma.settledDate } : {}),
        postings,
      });
    }
  }

  // ── 4 · Accrual reversed ────────────────────────────────────────────
  // Never billed, so nothing was paid and no invoice stands to be credited.
  // The accrual comes off in full at the receiving rate whatever the vendor
  // sends: no FX, and a short settlement elsewhere never reaches it.
  if (base.reverses > 0.004) {
    entries.push({
      id: 'accrual-settle',
      title: 'Accrual reversed',
      trigger: `The goods were never invoiced, so the goods-receipt accrual comes off instead${atReceiving}. No FX: nothing is settled for them.`,
      posted: settled,
      ...(settled && rma.settledDate ? { date: rma.settledDate } : {}),
      postings: [
        { account: GL_ACCOUNTS.apAccrual, debit: base.reverses, doc: parts.reverses },
        { account: GL_ACCOUNTS.inventoryAtVendor, credit: base.reverses, doc: parts.reverses },
      ],
    });
  }

  if (base.replacement > 0.004) {
    entries.push({
      id: 'replacement-settle',
      title: 'Replacement goods received',
      trigger: 'No money moves. The books balance when the replacement stock arrives.',
      posted: settled,
      ...(settled && rma.settledDate ? { date: rma.settledDate } : {}),
      postings: [
        { account: GL_ACCOUNTS.inventoryOnHand, debit: base.replacement, doc: parts.replacement },
        { account: GL_ACCOUNTS.inventoryAtVendor, credit: base.replacement, doc: parts.replacement },
      ],
    });
  }

  if (base.writtenOff > 0.004) {
    entries.push({
      id: 'write-off-settle',
      title: 'Return closed with nothing back',
      trigger: 'The goods were already billed and no credit is coming, so the value is written off.',
      posted: settled,
      ...(settled && rma.settledDate ? { date: rma.settledDate } : {}),
      postings: [
        { account: GL_ACCOUNTS.writeOffLoss, debit: base.writtenOff, doc: parts.writtenOff },
        { account: GL_ACCOUNTS.inventoryAtVendor, credit: base.writtenOff, doc: parts.writtenOff },
      ],
    });
  }

  return entries;
}

/** What is left sitting in the holding account across the posted entries. A
 *  fully resolved return reads zero. */
export function returnsPendingBalance(entries: GLEntry[]): number {
  let balance = 0;
  for (const entry of entries) {
    if (!entry.posted) continue;
    for (const posting of entry.postings) {
      if (posting.account.code !== GL_ACCOUNTS.inventoryAtVendor.code) continue;
      balance += posting.debit ?? 0;
      balance -= posting.credit ?? 0;
    }
  }
  return round2(balance);
}
