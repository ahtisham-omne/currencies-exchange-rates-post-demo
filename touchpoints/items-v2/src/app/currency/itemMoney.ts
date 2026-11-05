import { BASE_CURRENCY } from './currencies';
import { formatCompactMoney, formatMoney, moneyPrefix } from './money';
import { usdToBase } from './vendorFx';

/* ── Item amounts (spec 4.1) ──────────────────────────────────────────
 * Item prices, costs and valuations stay in the base currency. The design
 * writes them in USD; they are restated in base at the last sync's
 * mid-market rate, so each figure keeps its place relative to the others. */

/** A unit price or valuation in base, to the cent: ₨6,824.31. */
export const baseMoney = (usd: number) => formatMoney(usdToBase(usd), BASE_CURRENCY);

/** A whole amount in base, KPI-sized from a million up: ₨6,685 · ₨1.7M. */
export function baseWhole(usd: number): string {
  const base = usdToBase(usd);
  if (Math.abs(base) >= 1e6) return formatCompactMoney(base, BASE_CURRENCY);
  const sign = base < 0 ? '−' : '';
  return `${sign}${moneyPrefix(BASE_CURRENCY)}${Math.round(Math.abs(base)).toLocaleString('en-US')}`;
}

/** KPI-sized: ₨34.6M · ₨3.5M · ₨835K. */
export const baseCompact = (usd: number) => formatCompactMoney(usdToBase(usd), BASE_CURRENCY);

/** The base-currency symbol for an input's prefix: ₨. */
export const basePrefix = () => moneyPrefix(BASE_CURRENCY).trim();
