import type { Invoice } from '@/app/data/mockInvoices';
import { BASE_CURRENCY, isBaseCurrency } from './currencies';
import { invoiceFx } from './invoiceFx';
import { formatMoney, formatRateDate, rateSentence } from './money';
import { DEFAULT_RATE_TYPE, rateOn, toBase } from './rates';

/* ── FX Variance at invoice (Currency & Exchange Rates) ───────────────
 * Receiving books the goods into stock at the receiving day's rate. A part
 * the vendor was prepaid for is booked at that prepayment's rate instead,
 * the rate it was locked at when paid (each prepayment keeps its own). The
 * invoice then converts the vendor's amount at the invoice's rate (its Rate
 * as of date). For the same goods the two base amounts differ only by the
 * rate, so on the unpaid rest:
 *
 *   FX Variance = rest at the receiving rate − rest at the invoice rate
 *
 * It posts automatically, and stock keeps its receiving value. Owing fewer
 * base units than receiving booked is a gain (a credit), more is a loss (a
 * debit). The prepaid part is applied at its locked rate, so it never makes a
 * variance; a prepayment covering the whole invoice leaves none at all.
 *
 * Only a rate difference goes here. A price difference (the invoice billing
 * another unit price than the PO price receiving booked at) is quantity ×
 * (invoice price − received price), at the invoice rate, and posts to
 * Purchase Price Variance (lib/glPosting.ts).
 *
 * The invoice keeps its own rate and its unpaid rest (outstandingBalance):
 * a later payment compares against those, and that difference is FX
 * Gain/Loss, posted on the payment (currency/paymentFx.ts). */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The rate receiving books at: the module's default rate type on the
 *  receiving day (mid-market), mid-market where that type has none. */
export function receivingRateOn(currency: string, date: string): number {
  if (isBaseCurrency(currency)) return 1;
  const q = rateOn(currency, date, DEFAULT_RATE_TYPE);
  return q.rate ?? rateOn(currency, date, 'mid').rate ?? 1;
}

/** One receiving's goods, as receiving booked them. */
export interface ReceiptValue {
  grnNumber?: string;
  /** The receiving date. */
  date: string;
  /** In the invoice's currency: quantity × the received (PO) price. */
  amount: number;
  /** Base per one unit on the receiving date. */
  rate: number;
}

/** A prepayment applied to the invoice, at the rate it was paid (locked). */
export interface LockedPrepayment {
  invoiceNumber: string;
  /** Applied to this invoice, in its currency. */
  amount: number;
  /** Base per one unit when it was paid. */
  rate: number;
  rateDate?: string;
  /** The currency and rate it was paid in, where the invoice is in another
   *  (its amount and rate above are then the invoice currency's, same base). */
  paid?: { currency: string; rate: number } | undefined;
}

export interface FxVariance {
  currency: string;
  invoiceRate: number;
  /** The invoice rate's day (its Rate as of date). */
  invoiceDate: string;
  /** The received goods, in the invoice's currency (the accrual it clears). */
  goods: number;
  /** The part of the goods prepaid, each prepayment at its locked rate. */
  prepaidGoods: (LockedPrepayment & { base: number })[];
  /** Prepayments past the goods (they cover charges or a price difference),
   *  still at their locked rates. */
  prepaidBeyond: (LockedPrepayment & { base: number })[];
  /** The unpaid rest of the goods, by receiving, at each receiving's rate. */
  rest: (ReceiptValue & { base: number })[];
  restForeign: number;
  restAtReceiving: number;
  restAtInvoice: number;
  /** What receiving booked for these goods in base: the AP Accrual cleared. */
  receivedBase: number;
  /** restAtReceiving − restAtInvoice: positive is a gain, negative a loss. */
  amount: number;
}

export type GainLoss = 'gain' | 'loss' | 'none';
export const gainLossOf = (amount: number): GainLoss => (Math.abs(amount) < 0.005 ? 'none' : amount > 0 ? 'gain' : 'loss');

/** Spread `total` over `weights` to the cent, the last share taking the rounding. */
function spread(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  let used = 0;
  return weights.map((w, i) => {
    if (i === weights.length - 1) return round2(total - used);
    const share = round2((total * w) / sum);
    used = round2(used + share);
    return share;
  });
}

/** Prepayments in order, each up to what is left of `cap`. */
function allocate(prepayments: LockedPrepayment[], cap: number) {
  const within: (LockedPrepayment & { base: number })[] = [];
  const beyond: (LockedPrepayment & { base: number })[] = [];
  let left = Math.max(0, cap);
  prepayments.forEach((p) => {
    const inside = round2(Math.min(p.amount, left));
    left = round2(left - inside);
    if (inside > 0.004) within.push({ ...p, amount: inside, base: toBase(inside, p.rate) });
    const outside = round2(p.amount - inside);
    if (outside > 0.004) beyond.push({ ...p, amount: outside, base: toBase(outside, p.rate) });
  });
  return { within, beyond };
}

/**
 * The FX Variance for an invoice of received goods. Null when there is
 * nothing to compare: a base-currency invoice, or no goods received.
 */
export function fxVarianceOf(input: {
  currency: string;
  invoiceRate: number;
  invoiceDate: string;
  receipts: ReceiptValue[];
  prepayments?: LockedPrepayment[];
}): FxVariance | null {
  const { currency, invoiceRate, invoiceDate } = input;
  if (isBaseCurrency(currency)) return null;
  const receipts = input.receipts.filter((r) => r.amount > 0.004);
  const goods = round2(receipts.reduce((s, r) => s + r.amount, 0));
  if (goods <= 0) return null;
  const { within: prepaidGoods, beyond: prepaidBeyond } = allocate(input.prepayments ?? [], goods);
  const prepaidForeign = round2(prepaidGoods.reduce((s, p) => s + p.amount, 0));
  const restForeign = round2(goods - prepaidForeign);
  // The unpaid rest, spread over the receivings by what each received.
  const restShares = spread(restForeign, receipts.map((r) => r.amount));
  const rest = receipts
    .map((r, i) => ({ ...r, amount: restShares[i], base: toBase(restShares[i], r.rate) }))
    .filter((r) => r.amount > 0.004);
  const restAtReceiving = round2(rest.reduce((s, r) => s + r.base, 0));
  const restAtInvoice = toBase(restForeign, invoiceRate);
  const receivedBase = round2(prepaidGoods.reduce((s, p) => s + p.base, 0) + restAtReceiving);
  return {
    currency,
    invoiceRate,
    invoiceDate,
    goods,
    prepaidGoods,
    prepaidBeyond,
    rest,
    restForeign,
    restAtReceiving,
    restAtInvoice,
    receivedBase,
    amount: round2(restAtReceiving - restAtInvoice),
  };
}

/** One line's receivings, valued as receiving booked them: the received
 *  value (`accrual`, quantity covered × PO price) spread over its receipts by
 *  quantity, oldest first, each at its own receiving date's rate. */
export function receiptValuesForLine(
  currency: string,
  accrual: number,
  receipts: { grnNumber?: string; date: string; qty: number; rate?: number }[],
): ReceiptValue[] {
  if (accrual <= 0.004 || receipts.length === 0) return [];
  const sorted = [...receipts].sort((a, b) => a.date.localeCompare(b.date));
  const shares = spread(accrual, sorted.map((r) => Math.max(0, r.qty)));
  return sorted.map((r, i) => ({
    grnNumber: r.grnNumber,
    date: r.date,
    amount: shares[i],
    rate: r.rate ?? receivingRateOn(currency, r.date),
  }));
}

/** "Oct 05, 2025": a short day for a sentence. */
const day = (iso: string) => formatRateDate(iso);

/** The FX Variance line's description: both rates and both dates.
 *  "Received Oct 05, 2025 at 1 GBP = ₨344.1448 PKR · invoiced Oct 16, 2025 at 1 GBP = ₨340.6802 PKR" */
export function fxVarianceDescription(v: FxVariance): string {
  const rates = Array.from(new Set(v.rest.map((r) => r.rate)));
  const invoiced = `invoiced ${day(v.invoiceDate)} at ${rateSentence(v.currency, v.invoiceRate)}`;
  if (rates.length === 1) {
    const dates = Array.from(new Set(v.rest.map((r) => r.date))).sort();
    return `Received ${dates.map(day).join(', ')} at ${rateSentence(v.currency, rates[0])} · ${invoiced}`;
  }
  const dates = Array.from(new Set(v.rest.map((r) => r.date))).sort();
  return `Received on ${dates.length} dates (${dates.map(day).join(', ')}), each at its own rate · ${invoiced}`;
}

/** The AP Accrual line's description: what receiving booked, at which rates. */
export function accrualDescription(v: FxVariance): string {
  const prepaid = v.prepaidGoods.reduce((s, p) => s + p.amount, 0);
  const parts = ['Received, not invoiced, at the receiving rate'];
  if (prepaid > 0.004) {
    parts[0] = v.restForeign > 0.004 ? 'Received, not invoiced: the unpaid part at the receiving rate' : 'Received, not invoiced';
    parts.push(`${formatMoney(prepaid, v.currency)} prepaid at its locked rate`);
  }
  return parts.join(' · ');
}

/** "+₨34,646.00 gain" / "−₨2,180.00 loss" / "No FX variance". */
export function fxVarianceText(amount: number): string {
  const k = gainLossOf(amount);
  if (k === 'none') return 'No FX variance';
  return `${k === 'gain' ? '+' : '−'}${formatMoney(Math.abs(amount), BASE_CURRENCY)} ${k}`;
}

/** What a saved invoice's FX Variance is measured from: the receivings on
 *  its saved lines (each at its own date's rate) and the prepayments applied
 *  to it (each at its locked rate). Empty receipts on the seeds that predate
 *  this, which carry no receivings on their lines. */
export function invoiceFxInputs(invoice: Invoice): { receipts: ReceiptValue[]; prepayments: LockedPrepayment[] } {
  const fx = invoiceFx(invoice);
  const receipts = (invoice.savedLineItems ?? []).flatMap((l) => {
    const price = l.poUnitPrice ?? l.unitPrice;
    const covered = Math.min(l.quantity, l.receivedQty ?? l.quantity);
    return receiptValuesForLine(fx.currency, round2(covered * price), l.receipts ?? []);
  });
  const prepayments: LockedPrepayment[] = (invoice.appliedPrepayments ?? []).map((p) => ({
    invoiceNumber: p.invoiceNumber,
    amount: p.amount,
    rate: p.rate ?? fx.rate,
    rateDate: p.rateDate,
  }));
  return { receipts, prepayments };
}

/** A saved invoice's FX Variance, from invoiceFxInputs. Null when it has
 *  no receiving on file or is in the base currency. */
export function invoiceFxVariance(invoice: Invoice): FxVariance | null {
  const fx = invoiceFx(invoice);
  if (fx.isBase || fx.provisional || invoice.type === 'Pre-Invoice') return null;
  const { receipts, prepayments } = invoiceFxInputs(invoice);
  if (receipts.length === 0) return null;
  return fxVarianceOf({ currency: fx.currency, invoiceRate: fx.rate, invoiceDate: fx.rateDate, receipts, prepayments });
}
