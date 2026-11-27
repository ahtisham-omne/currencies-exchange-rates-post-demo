import { BASE_CURRENCY, CURRENCIES, isBaseCurrency } from './currencies';
import { currencyDecimals } from './money';
import { RATES_READ_ON, rateOn, toBase } from './rates';
import { roundTo } from './vendorFx';

/* ── Item prices in other currencies ──────────────────────────────────
 * Nophil's review (25 Nov 2026) and Mahreen's "Other currencies" (27 Nov
 * 2026), still waiting on Eli, so built as the proposal for Monday. Under its
 * base price an item either converts the base price at the order's rate
 * ("convert", orders mark it as an estimate) or sets its own price per
 * currency, optionally for one customer partner group ("perCurrency";
 * currencies without a price still convert). A company prices the same item
 * differently per market (duties, VAT, import fees).
 *
 * The shape is shared with Sales Orders (Spec D): one price per currency +
 * group, never the base currency; `partnerGroup` is a customer partner
 * group's name, null or missing for any group. In "convert" mode orders
 * ignore the prices; they stay on the item, so switching back restores them. */

export type OtherCurrencyPricing = 'convert' | 'perCurrency';

/** As the item stores it: the unit price in that currency. */
export interface RegionalPrice {
  currency: string;
  unitPrice: number;
  /** A customer partner group's name; null or missing = any group. */
  partnerGroup?: string | null;
}

/** As the form edits it: the price as typed. */
export interface RegionalPriceDraft {
  currency: string;
  unitPrice: string;
  partnerGroup: string | null;
}

/* Customer partner groups, as Partners seeds them (Spec D). Items has no
 * partner groups of its own, so this small list mirrors theirs; Sales Orders
 * seeds the same one. */
export interface CustomerPartnerGroup {
  name: string;
  /** The group's currency, for reference. */
  currency: string;
}

export const CUSTOMER_PARTNER_GROUPS: CustomerPartnerGroup[] = [
  { name: 'North America', currency: 'USD' },
  { name: 'Europe', currency: 'EUR' },
  { name: 'GCC States', currency: 'AED' },
];

/** What a price with no partner group reads as. */
export const ALL_GROUPS_LABEL = 'All groups';

/** The item's mode: its own, else "perCurrency" when it has prices (Spec D). */
export function otherCurrencyPricingOf(
  item: { otherCurrencyPricing?: OtherCurrencyPricing; regionalPrices?: RegionalPrice[] } | null | undefined,
): OtherCurrencyPricing {
  return item?.otherCurrencyPricing ?? ((item?.regionalPrices?.length ?? 0) > 0 ? 'perCurrency' : 'convert');
}

type PriceRow = { currency: string; partnerGroup?: string | null };

const sameGroup = (a: PriceRow, b: PriceRow) => (a.partnerGroup ?? null) === (b.partnerGroup ?? null);

/** A row's identity: its currency + group (one price each). */
export const regionalPriceKey = (row: PriceRow) => `${row.currency.toUpperCase()}|${row.partnerGroup ?? ''}`;

/* The currencies a new row offers first, USD leading; then the library's order. */
const SUGGESTED = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'CNY'];
const PICK_ORDER = [...new Set([...SUGGESTED, ...CURRENCIES.map((c) => c.code)])].filter((code) => !isBaseCurrency(code));

/** The currency a new row (for all groups) starts on: the first suggested
 *  one no row uses, else the first without an all-groups price. */
export function nextRegionalCurrency(rows: PriceRow[]): string | null {
  const used = new Set(rows.map((r) => r.currency.toUpperCase()));
  const usedForAll = new Set(rows.filter((r) => !r.partnerGroup).map((r) => r.currency.toUpperCase()));
  return PICK_ORDER.find((code) => !used.has(code)) ?? PICK_ORDER.find((code) => !usedForAll.has(code)) ?? null;
}

/** Currencies row `idx` can't switch to: the base currency, and those another
 *  row already prices for the same group. */
export const takenCurrencies = (rows: PriceRow[], idx: number) => [
  BASE_CURRENCY,
  ...rows.filter((r, i) => i !== idx && sameGroup(r, rows[idx])).map((r) => r.currency.toUpperCase()),
];

/** Groups row `idx` can't switch to: those another row already prices in the
 *  same currency (null = all groups). */
export const takenGroups = (rows: PriceRow[], idx: number): (string | null)[] =>
  rows
    .filter((r, i) => i !== idx && r.currency.toUpperCase() === rows[idx].currency.toUpperCase())
    .map((r) => r.partnerGroup ?? null);

/** A row's price is valid when it is a number above 0. */
export const regionalPriceInvalid = (row: RegionalPriceDraft) => !(Number(row.unitPrice) > 0);

/** The rows still to fix before saving (only rows the form shows). */
export const invalidRegionalPrices = (rows: RegionalPriceDraft[] | undefined) =>
  (rows ?? []).filter(regionalPriceInvalid);

/** The rows that block saving: only while the form shows them, i.e. selling
 *  to all partners and setting a price for each currency. */
export const blockingRegionalPrices = (config: {
  sellingScope?: string;
  otherCurrencyPricing?: OtherCurrencyPricing;
  regionalPrices?: RegionalPriceDraft[];
}) =>
  config.sellingScope === 'all' && config.otherCurrencyPricing === 'perCurrency'
    ? invalidRegionalPrices(config.regionalPrices)
    : [];

export function toRegionalDrafts(prices: RegionalPrice[] | undefined): RegionalPriceDraft[] {
  return (prices ?? []).map((p) => ({
    currency: p.currency,
    unitPrice: p.unitPrice.toFixed(currencyDecimals(p.currency)),
    partnerGroup: p.partnerGroup ?? null,
  }));
}

/** The valid rows, rounded to each currency's minor units, one per currency + group. */
export function fromRegionalDrafts(rows: RegionalPriceDraft[] | undefined): RegionalPrice[] {
  const seen = new Set<string>();
  return (rows ?? [])
    .filter((r) => !regionalPriceInvalid(r) && !isBaseCurrency(r.currency))
    .filter((r) => {
      const key = regionalPriceKey(r);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => ({
      currency: r.currency,
      unitPrice: roundTo(r.currency, Number(r.unitPrice)),
      partnerGroup: r.partnerGroup ?? null,
    }));
}

/** Today's daily market rate for a currency, base per one unit (read on RATES_READ_ON). */
export const regionalRateToday = (code: string) => rateOn(code, RATES_READ_ON, 'mid').rate;

/** A price in base at today's daily market rate (null without a rate). */
export function regionalBaseEquivalent(code: string, amount: number): number | null {
  const rate = regionalRateToday(code);
  return rate == null ? null : toBase(amount, rate);
}

export { BASE_CURRENCY, RATES_READ_ON };
