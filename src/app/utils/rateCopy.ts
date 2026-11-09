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
    "How much the rate changed since the previous sync.",
  rateType:
    "Mid-market rates update automatically. Corporate rates are fixed rates your team sets.",
  lastSync:
    `When this rate was last updated from ${API_PROVIDER}.`,
  internalId:
    "The system ID for this rate.",
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

// The "Inverse rate" field on the currency and rate detail pages, read for the
// pair on screen: 1 [base] = [inverse rate] [currency].
export const inverseRateTooltip = (code: string, base: string, inverse: string) =>
  `1 ${base} = ${inverse} ${code}.`;

// The converter card's header tooltip on the currency detail page.
export const CONVERTER_TOOLTIP = "Convert any amount at the latest mid-market rate.";

export const CONVERTER_SUBTITLE =
  "See how this currency converts against your base currency or any other active currency. Switch between mid-market and corporate rates to compare.";

export const CONVERTER_TOGGLE_TOOLTIPS = {
  midMarket:
    "The live market rate sourced from your configured rate provider. Updated automatically every 24 hours.",
  corporate:
    "A fixed rate manually set by your team and applied to specific currency pairs. Updated only when someone in your team changes it.",
} as const;

export const EXPLANATORY_BLOCKS = {
  midMarket: `The rate halfway between the buy and sell price, with no bank markup. Updated automatically from ${API_PROVIDER} every 24 hours.`,
  corporate:
    "Fixed rates your team sets. They stay the same until someone changes them, so documents and budgets use a steady rate.",
} as const;
