import { BASE_CURRENCY, isBaseCurrency } from './currencies';
import { formatMoney, formatRate, formatRateDate, moneyPrefix } from './money';
import type { RateType } from './rates';
import { UOM_SETS } from '../data/uomSets';
import { DESIGN_CURRENCY, LAST_SYNC_DAY, convertOn, customerCurrency, localTodayIso, roundTo } from './soFx';

/* ── Market prices on order lines (Nophil review item 2, 25 Nov 2026) ──
 * An item keeps its price in the base currency and, optionally, a price
 * per currency (`regionalPrices`, never base). A line on an order takes the
 * item's price in the order's currency when the item has one. When it
 * doesn't, the line takes the base price converted at the order's rate (the
 * daily market rate or the corporate rate, whichever the order uses) and is
 * marked as an estimate. A price typed by hand is the rep's: it stays as
 * typed and a currency change converts it like any other amount. A
 * base-currency order is priced as before.
 *
 * Prices per currency and customer group (27 Nov 2026, Spec D, shared with
 * Items' "Other currencies"): each price row can name a customer partner
 * group (null = any group). A line takes the item's price for (order
 * currency, the customer's group), else (order currency, any group), else
 * the estimate. An item set to "Convert from the base price" ignores its
 * rows. */

export interface RegionalPrice {
  currency: string;
  /** In `currency`. */
  unitPrice: number;
  /** A customer partner group's name; null or left out: any group. */
  partnerGroup?: string | null;
}

/** Items' "Other currencies" choice: convert from the base price, or a price
 *  for each currency. 'perCurrency' when the item has prices, else 'convert'. */
export type OtherCurrencyPricing = 'convert' | 'perCurrency';

/** Where a line's unit price came from. */
export type LinePriceSource =
  /** The item's price in the order's currency. */
  | 'regional'
  /** The base price converted at the order's rate: an estimate. */
  | 'estimate'
  /** The base price, on a base-currency order. */
  | 'base'
  /** Typed by hand. */
  | 'manual';

export interface PricedItem {
  /** The catalog's list price, which the design writes in USD. */
  unitPrice: number;
  regionalPrices?: RegionalPrice[];
  otherCurrencyPricing?: OtherCurrencyPricing;
}

/* ── Customer partner groups (Spec D) ─────────────────────────────────
 * The customer groups Partners seeds, by the currency they trade in. Sales
 * Orders has no group on its customers, so a customer's group comes from its
 * currency (customerCurrency): USD North America, EUR Europe, AED GCC
 * States; any other currency, no group. */
export const CUSTOMER_GROUP_BY_CURRENCY: Record<string, string> = {
  USD: 'North America',
  EUR: 'Europe',
  AED: 'GCC States',
};

/** A customer's partner group, or null (no customer, or none for its currency). */
export function customerGroupOf(customer: string | null | undefined): string | null {
  if (!customer || !customer.trim()) return null;
  return CUSTOMER_GROUP_BY_CURRENCY[customerCurrency(customer)] ?? null;
}

/** The item's price in the base currency, where Items keeps it: the
 *  design's USD list price at today's daily market rate (soMoney.ts
 *  itemListPrice shows the same figure). */
export const itemBasePrice = (item: PricedItem) => convertOn(item.unitPrice, DESIGN_CURRENCY, BASE_CURRENCY, LAST_SYNC_DAY);

/** Does the item price lines in other currencies from its own rows? */
const usesOwnPrices = (item: PricedItem) =>
  (item.otherCurrencyPricing ?? (item.regionalPrices?.length ? 'perCurrency' : 'convert')) === 'perCurrency';

/** The item's own price in a currency, if it has one: for the customer's
 *  group first, then for any group. */
export function regionalPriceFor(item: PricedItem, currency: string, group?: string | null): number | undefined {
  if (!usesOwnPrices(item)) return undefined;
  const code = currency.toUpperCase();
  const rows = (item.regionalPrices ?? []).filter((p) => p.currency.toUpperCase() === code);
  const forGroup = group ? rows.find((p) => p.partnerGroup === group) : undefined;
  return (forGroup ?? rows.find((p) => !p.partnerGroup))?.unitPrice;
}

/**
 * The unit price a line takes on an order in `currency` at `rate` (base per
 * one unit of it), for a customer in `group`. `basePrice` is the price on a
 * base-currency order; it defaults to the item's base price.
 */
export function marketPrice(
  item: PricedItem,
  currency: string,
  rate: number,
  { basePrice = itemBasePrice(item), group = null }: { basePrice?: number; group?: string | null } = {},
): { unitPrice: number; priceSource: Exclude<LinePriceSource, 'manual'> } {
  const code = currency.toUpperCase();
  if (isBaseCurrency(code)) return { unitPrice: basePrice, priceSource: 'base' };
  const regional = regionalPriceFor(item, code, group);
  if (regional != null) return { unitPrice: regional, priceSource: 'regional' };
  return { unitPrice: roundTo(code, rate > 0 ? itemBasePrice(item) / rate : itemBasePrice(item)), priceSource: 'estimate' };
}

/** Was the line priced from the item, so a currency change prices it again
 *  (not typed by hand, nor priced elsewhere)? */
export const followsMarketPrice = (source: LinePriceSource | undefined) =>
  source === 'regional' || source === 'estimate' || source === 'base';

/** A line priced from the item, priced again for an order in another
 *  currency or at another rate: the item's price there, else its base price
 *  at the new rate. A line on another unit keeps the multiple it was
 *  rescaled by (its price over the item's price before). */
export function repriceFromItem(
  unitPrice: number,
  item: PricedItem,
  from: { currency: string; rate: number; group?: string | null },
  to: { currency: string; rate: number; group?: string | null },
): { unitPrice: number; priceSource: Exclude<LinePriceSource, 'manual'> } {
  const was = marketPrice(item, from.currency, from.rate, { group: from.group }).unitPrice;
  const perUnit = was > 0 ? Math.round((unitPrice / was) * 1000) / 1000 : 1;
  const now = marketPrice(item, to.currency, to.rate, { group: to.group });
  return { unitPrice: roundTo(to.currency.toUpperCase(), now.unitPrice * perUnit), priceSource: now.priceSource };
}

/** Every ratio between two units of one set (Box/EA 12, Gallon/Drum ≈ 0.0182…). */
const UNIT_RATIOS = Object.values(UOM_SETS).flatMap((set) => set.flatMap((a) => set.map((b) => a.multiplier / b.multiplier)));

/** The base price behind an estimated line price, for the line's unit: the
 *  item's base price times the units the line's price is for (its price
 *  over the item's estimate, as repriceFromItem works it out). The multiple
 *  snaps to the nearest ratio between two units when within 3%, so a line
 *  estimated before a rate change still names its unit's base price. */
export function estimateBasePrice(item: PricedItem, unitPrice: number, currency: string, rate: number): number {
  const base = itemBasePrice(item);
  const each = roundTo(currency.toUpperCase(), rate > 0 ? base / rate : base);
  const raw = each > 0 ? unitPrice / each : 1;
  const near = UNIT_RATIOS.reduce((best, r) => (Math.abs(r / raw - 1) < Math.abs(best / raw - 1) ? r : best), UNIT_RATIOS[0]);
  const perUnit = Math.abs(near / raw - 1) <= 0.03 ? near : raw;
  return Math.round(base * perUnit * 100) / 100;
}

/** "1 USD = ₨278.5200": a rate in a sentence, no trailing code. */
export const shortRateText = (code: string, rate: number) => `1 ${code.toUpperCase()} = ${moneyPrefix(BASE_CURRENCY)}${formatRate(rate)}`;

/** The estimate's hover (Mahreen, 27 Nov 2026, 4d): "This item has no USD
 *  price. Converted from the base price ₨100.00 at today's daily market
 *  rate (1 USD = ₨278.5200)." Names the rate date when it isn't today
 *  ("at the daily market rate on Nov 09, 2026"), and the corporate rate
 *  when the order uses it. `basePrice` is the base price for the line's
 *  unit. */
export function estimateNote({
  currency,
  basePrice,
  rate,
  rateType = 'mid',
  date,
}: {
  currency: string;
  basePrice: number;
  rate: number;
  rateType?: RateType;
  date?: string | null;
}): string {
  const code = currency.toUpperCase();
  const day = date ? date.slice(0, 10) : localTodayIso();
  const kind = rateType === 'corporate' ? 'corporate rate' : 'daily market rate';
  const at = day === localTodayIso() ? `today's ${kind}` : `the ${kind} on ${formatRateDate(day)}`;
  return `This item has no ${code} price. Converted from the base price ${formatMoney(basePrice, BASE_CURRENCY)} at ${at} (${shortRateText(code, rate)}).`;
}
