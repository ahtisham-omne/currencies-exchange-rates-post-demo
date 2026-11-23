import { BASE_CURRENCY } from './currencies';
import { moneyPrefix } from './money';

/* ── Pricing-rule amounts (Currency Touchpoints Map, Partners 5–6) ────
 * A pricing rule is in the company's base currency, with no currency pick
 * of its own: value thresholds and fixed amounts are PKR. Percentages and
 * volume (quantity) rules don't change. On a document in another currency
 * the threshold is checked in base (the document total at the document's
 * rate) and a fixed amount converts to the document's currency at that rate.
 *
 * The seeded rules and templates were written in USD. Each amount is
 * restated ×280 exactly, the spec's own factor ($2,500 → ₨700,000,
 * $10,000 → ₨2,800,000), so every module restates them the same way. */

/** The currency pricing rules are written in: the base currency. */
export const RULE_CURRENCY = BASE_CURRENCY;

/** The spec's restatement factor for the seeded USD rule amounts. */
export const RULE_USD_FACTOR = 280;

/** A seeded USD rule amount in base, whole: 2500 → "₨700,000". */
export function ruleAmount(usd: number): string {
  return `${moneyPrefix(BASE_CURRENCY)}${Math.round(usd * RULE_USD_FACTOR).toLocaleString('en-US')}`;
}
