import { mockVendors } from '@/app/data/mockVendors';
import type { RMA } from '@/app/data/mockRMAs';
import { getRMALinkedRecords } from '@/app/data/rmaLinkedRecords';
import { BASE_CURRENCY, isBaseCurrency } from './currencies';
import { formatMoney } from './money';
import { fxOn, fxToday, midRateOn, toBase, type MoneyFx } from './rates';
import { PO_CURRENCY, VENDOR_CURRENCY } from './poCurrencySeed';

/* ── A return's currency ──────────────────────────────────────────────
 * A return is in the currency of the PO its goods came on: the vendor priced
 * the goods in it, invoiced them in it and credits or refunds in it, so every
 * amount on the return reads in it ("£30.23 per FT"). PKR is the base (since
 * 2026-11-20; it was dollars): the return's page opens in it, and the
 * listing's insights add returns up in it.
 *
 * One return, one currency: once a receiving document is picked, receipts
 * from a PO in another currency can't join it (Create New RMA, step 4).
 *
 * Amounts are stored as the PO priced them, so the figures in the seed are
 * read in the PO's currency; nothing is restated.
 *
 * The rate is the receiving-day rate. Sending goods back reverses their
 * receipt, and a receipt reverses at the rate it was booked at, so a return's
 * value converts to dollars at its receipt's rate (GL Impact). A return that
 * unwinds receipts from different days converts each receipt's share at that
 * receipt's own rate. */

const VENDOR_OF_PO = new Map<string, string>();
for (const v of mockVendors) for (const p of v.purchaseOrders) VENDOR_OF_PO.set(p.poNumber, v.vendorCode);

/** The bare PO number: "PO-11151", "PO 11151" and "11151" are one order. A
 *  receipt covering two orders ("11151, 11152") is read by its first. */
export function poKey(po: string | null | undefined): string {
  return (po ?? '').split(',')[0]!.trim().replace(/^PO[- ]?/i, '');
}

/** The currency the design's sample figures are written in. A PO with no
 *  currency of its own is in it. */
export const DESIGN_CURRENCY = 'USD';

/** The currency a PO was placed in. */
export function poCurrency(po: string | null | undefined): string {
  const key = poKey(po);
  const vendor = VENDOR_OF_PO.get(key);
  return PO_CURRENCY[key] ?? (vendor ? VENDOR_CURRENCY[vendor] : undefined) ?? DESIGN_CURRENCY;
}

/** A return's currency: its PO's. */
export function rmaCurrency(rma: Pick<RMA, 'sourcePO' | 'sourcePOs'>): string {
  return poCurrency(rma.sourcePOs?.[0] ?? rma.sourcePO);
}

/** "PO-11151", for the record's "Currency: GBP (from PO 11151)". */
export const rmaCurrencyPO = (rma: Pick<RMA, 'sourcePO' | 'sourcePOs'>) => poKey(rma.sourcePOs?.[0] ?? rma.sourcePO);

export interface ReturnReceipt {
  grnNumber: string;
  /** The receiving date, as Linked Records shows it. */
  date: string;
  /** What this return takes back off the receipt, in the PO's currency. */
  value: number;
  /** Dollars per one unit of the PO's currency on that day. */
  rate: number;
}

const receiptsCache = new WeakMap<object, ReturnReceipt[]>();

/** The receipts a return unwinds, with their dates (read off Linked Records,
 *  so both tabs give a receipt the same day) and rates. */
export function returnReceipts(rma: RMA): ReturnReceipt[] {
  const hit = receiptsCache.get(rma);
  if (hit) return hit;
  const code = rmaCurrency(rma);
  const out = getRMALinkedRecords(rma)
    .filter((r) => r.type === 'Receiving Document')
    .map((r) => ({ grnNumber: r.reference, date: r.date, value: r.amount ?? 0, rate: midRateOn(code, r.date) }));
  receiptsCache.set(rma, out);
  return out;
}

/** The rate a return's amounts convert to dollars at, for the hovers: its
 *  receipt's, or, across receipts from different days, each receipt's share at
 *  its own rate. Null for a return in dollars. */
export function returnFx(rma: RMA): MoneyFx | null {
  const code = rmaCurrency(rma);
  if (isBaseCurrency(code)) return null;
  const receipts = returnReceipts(rma);
  const days = [...new Set(receipts.map((r) => r.date))];
  if (receipts.length === 0) return fxToday(code);
  if (days.length === 1) {
    const r = receipts[0]!;
    return fxOn(code, r.date, receipts.length === 1 ? `receiving date, ${r.grnNumber}` : 'receiving date');
  }
  const weight = receipts.reduce((s, r) => s + (r.value || 1), 0);
  const blended = receipts.reduce((s, r) => s + (r.value || 1) * r.rate, 0) / weight;
  return {
    ...fxOn(code, receipts[0]!.date, 'receiving dates'),
    rate: Math.round(blended * 1_000_000) / 1_000_000,
    breakdown: receipts.map((r) => ({ label: r.grnNumber, date: r.date, rate: r.rate })),
  };
}

/** An amount of a return in dollars, at the return's rate. */
export function returnToBase(rma: RMA, amount: number): number {
  const fx = returnFx(rma);
  return fx ? toBase(amount, fx.rate) : amount;
}

/** Amounts in several currencies, added up in dollars at today's rates, and
 *  the split that went into it: "£1,200.00 + €850.00 + $5,900.00". */
export function sumInBase(parts: { amount: number; currency: string }[]): { base: number; split: string; byCurrency: { currency: string; amount: number }[] } {
  const by = new Map<string, number>();
  for (const p of parts) if (p.amount) by.set(p.currency, (by.get(p.currency) ?? 0) + p.amount);
  // Pounds and euros first, dollars last, as the split reads.
  const byCurrency = [...by].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => Number(isBaseCurrency(a.currency)) - Number(isBaseCurrency(b.currency)) || a.currency.localeCompare(b.currency));
  const base = Math.round(byCurrency.reduce((s, p) => s + toBase(p.amount, fxToday(p.currency).rate), 0) * 100) / 100;
  return { base, split: byCurrency.map((p) => formatMoney(p.amount, p.currency)).join(' + '), byCurrency };
}

/** The currency of the PO a vendor's receipt came on. */
export function receiptCurrency(vendorCode: string, grnNumber: string): string | null {
  const vendor = mockVendors.find((v) => v.vendorCode === vendorCode);
  const grn = vendor?.receivingDocuments.find((g) => g.grnNumber === grnNumber);
  return grn ? poCurrency(grn.poNumber) : null;
}

/** Why a receipt can't join a return already in another currency. */
export const otherCurrencyReason = (currency: string) =>
  `This receiving is from a PO in ${currency}. Start a separate return for it.`;
