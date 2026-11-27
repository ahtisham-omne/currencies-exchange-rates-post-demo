import { BASE_CURRENCY, CURRENCIES, isBaseCurrency } from './currencies';
import { currencyDecimals } from './money';
import { rateOn, toBase } from './rates';
import { localTodayIso, roundTo } from './vendorFx';

/* ── Regional item prices (Nophil review item 1, 25 Nov 2026) ─────────
 * An item may carry its own unit (selling) price per market currency, next
 * to its base price: a company prices the same item differently per market
 * (duties, VAT, import fees). Optional, one per currency, never the base
 * currency. An item without one keeps using the base price, converted at
 * the order's rate. Still open with Eli, so it is kept to this file, the
 * Selling section and the item's data. */

/** As the item stores it: the unit price in that currency. */
export interface RegionalPrice {
  currency: string;
  unitPrice: number;
}

/** As the form edits it: the price as typed. */
export interface RegionalPriceDraft {
  currency: string;
  unitPrice: string;
}

/* The currencies a new row offers first, USD leading; then the library's order. */
const SUGGESTED = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'CNY'];

/** The currency a new row starts on: the first suggested one not yet used. */
export function nextRegionalCurrency(used: string[]): string | null {
  const taken = new Set(used.map((c) => c.toUpperCase()));
  const pick = [...SUGGESTED, ...CURRENCIES.map((c) => c.code)].find(
    (code) => !taken.has(code) && !isBaseCurrency(code),
  );
  return pick ?? null;
}

/** A row's price is valid when it is a number above 0. */
export const regionalPriceInvalid = (row: RegionalPriceDraft) => !(Number(row.unitPrice) > 0);

/** The rows still to fix before saving (only rows the form shows). */
export const invalidRegionalPrices = (rows: RegionalPriceDraft[] | undefined) =>
  (rows ?? []).filter(regionalPriceInvalid);

export function toRegionalDrafts(prices: RegionalPrice[] | undefined): RegionalPriceDraft[] {
  return (prices ?? []).map((p) => ({
    currency: p.currency,
    unitPrice: p.unitPrice.toFixed(currencyDecimals(p.currency)),
  }));
}

/** The valid rows, rounded to each currency's minor units. */
export function fromRegionalDrafts(rows: RegionalPriceDraft[] | undefined): RegionalPrice[] {
  return (rows ?? [])
    .filter((r) => !regionalPriceInvalid(r) && !isBaseCurrency(r.currency))
    .map((r) => ({ currency: r.currency, unitPrice: roundTo(r.currency, Number(r.unitPrice)) }));
}

/** Today's mid-market rate for a currency, base per one unit. */
export const regionalRateToday = (code: string) => rateOn(code, localTodayIso(), 'mid').rate;

/** A regional price in base at today's mid-market rate (null without a rate). */
export function regionalBaseEquivalent(code: string, amount: number): number | null {
  const rate = regionalRateToday(code);
  return rate == null ? null : toBase(amount, rate);
}

export { BASE_CURRENCY };
