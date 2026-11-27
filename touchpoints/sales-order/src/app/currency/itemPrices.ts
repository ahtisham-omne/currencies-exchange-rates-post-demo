import { BASE_CURRENCY, isBaseCurrency } from './currencies';
import { formatRateDate } from './money';
import { DESIGN_CURRENCY, LAST_SYNC_DAY, convertOn, localTodayIso, roundTo } from './soFx';

/* ── Market prices on order lines (Nophil review item 2, 25 Nov 2026) ──
 * An item keeps its price in the base currency and, optionally, a price
 * per market currency (`regionalPrices`, one per currency, never base).
 * A customer's market is the customer's currency, so a line on an order
 * takes the item's price in the order's currency when the item has one.
 * When it doesn't, the line takes the base price converted at the order's
 * rate (mid-market or corporate, whichever the order uses) and is marked as
 * an estimate. A price typed by hand is the rep's: it stays as typed and a
 * currency change converts it like any other amount. A base-currency order
 * is priced as before. */

export interface RegionalPrice {
  currency: string;
  /** In `currency`. */
  unitPrice: number;
}

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
}

/** The item's price in the base currency, where Items keeps it: the
 *  design's USD list price at the last synced mid-market rate
 *  (soMoney.ts itemListPrice shows the same figure). */
export const itemBasePrice = (item: PricedItem) => convertOn(item.unitPrice, DESIGN_CURRENCY, BASE_CURRENCY, LAST_SYNC_DAY);

/** The item's own price in a market currency, if it has one. */
export function regionalPriceFor(item: PricedItem, currency: string): number | undefined {
  const code = currency.toUpperCase();
  return item.regionalPrices?.find((p) => p.currency.toUpperCase() === code)?.unitPrice;
}

/**
 * The unit price a line takes on an order in `currency` at `rate` (base per
 * one unit of it). `basePrice` is the price on a base-currency order; it
 * defaults to the item's base price.
 */
export function marketPrice(
  item: PricedItem,
  currency: string,
  rate: number,
  basePrice: number = itemBasePrice(item),
): { unitPrice: number; priceSource: Exclude<LinePriceSource, 'manual'> } {
  const code = currency.toUpperCase();
  if (isBaseCurrency(code)) return { unitPrice: basePrice, priceSource: 'base' };
  const regional = regionalPriceFor(item, code);
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
  from: { currency: string; rate: number },
  to: { currency: string; rate: number },
): { unitPrice: number; priceSource: Exclude<LinePriceSource, 'manual'> } {
  const was = marketPrice(item, from.currency, from.rate).unitPrice;
  const perUnit = was > 0 ? Math.round((unitPrice / was) * 1000) / 1000 : 1;
  const now = marketPrice(item, to.currency, to.rate);
  return { unitPrice: roundTo(to.currency.toUpperCase(), now.unitPrice * perUnit), priceSource: now.priceSource };
}

/** The estimate's tooltip: "Converted from the base price at today's rate.
 *  No price is set for USD." The rate date is named when it isn't today. */
export function estimateNote(currency: string, rateDate?: string | null): string {
  const day = rateDate ? rateDate.slice(0, 10) : localTodayIso();
  const at = day === localTodayIso() ? "today's rate" : `the rate on ${formatRateDate(day)}`;
  return `Converted from the base price at ${at}. No price is set for ${currency.toUpperCase()}.`;
}
