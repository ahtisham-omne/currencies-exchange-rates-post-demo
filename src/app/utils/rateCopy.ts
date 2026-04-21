// Shared, single-source-of-truth copy for rate terminology tooltips, column
// headers, and explanatory blocks. Anywhere these terms appear in the UI must
// pull from here so wording stays identical across pages.

import { API_PROVIDER } from "../data/exchangeRates";

export const RATE_TOOLTIPS = {
  sourceCurrency:
    "The currency being valued. Each row shows how much one unit of this currency is worth in the base currency.",
  baseCurrency:
    "The reference currency configured for your company. All exchange rates in the system are expressed relative to this currency.",
  midMarket:
    "The live interbank rate sourced from your configured rate provider. Represents the midpoint between the global buy and sell prices of the source currency against the base currency.",
  corporate:
    "A fixed exchange rate manually set by your team for this currency pair.",
  inverse:
    "How much one unit of the base currency buys in the source currency. The mathematical inverse of the exchange rate.",
  change24h:
    "The percentage change in the mid-market exchange rate over the last 24 hours, compared against the previous day's synced value.",
  variance:
    "The percentage difference between the corporate rate and the current mid-market rate. Indicates how far the corporate rate has drifted from live market value.",
  effectiveDate:
    "The date the current corporate rate took effect. The rate remains active until manually updated by a team member.",
  totalValueAllDocs:
    "Sum of every active document booked in this currency, expressed in the currency's own units.",
  documentTypeTotal:
    "Sum of all active documents of this type, in this currency.",
} as const;

// Longer, example-driven tooltip used specifically on the "Inverse rate" badge
// that appears below the converter when the user swaps direction. Shorter
// column-header copy lives in RATE_TOOLTIPS.inverse.
export const INVERSE_BADGE_TOOLTIP =
  "The inverse rate shows how much 1 unit of the base currency buys in the source currency. For example, if 1 AED equals 75.84 PKR, the inverse rate is 1 PKR equals 0.013186 AED.";

export const CONVERTER_SUBTITLE =
  "See how this currency converts against your base currency or any other active currency. Switch between mid-market and corporate rates to compare.";

export const CONVERTER_TOGGLE_TOOLTIPS = {
  midMarket:
    "The live market rate sourced from your configured rate provider. Updated automatically every 24 hours.",
  corporate:
    "A fixed rate manually set by your team and applied to specific currency pairs. Updated only when someone in your team changes it.",
} as const;

export const EXPLANATORY_BLOCKS = {
  midMarket: `Live interbank rates sourced from ${API_PROVIDER} and synced automatically every 24 hours. The mid-market rate represents the midpoint between the global buy and sell prices of a currency pair. It contains no markup, spread, or margin, making it the most accurate and unbiased reference value available for any currency.`,
  corporate:
    "Fixed rates manually set by your team for specific currency pairs. A corporate rate stays in effect until someone on your team updates it, giving you a stable and predictable value for budgeting, intercompany transfers, and consistent reporting across documents — independent of daily market movement.",
} as const;
