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
    "Midpoint of global buy and sell rates.",
  corporate:
    "Fixed rate set by your company. Applies until a new rate takes effect.",
  inverse:
    "The value of 1 unit of your base currency in this currency.\n\nExample: If 1 AED equals 75.8400 PKR, the inverse rate is 1 PKR = 0.0132 AED.",
  change24h:
    "How much the rate moved since the last sync.",
  rateType:
    "Mid-market rates update automatically. Corporate rates are fixed rates your team sets.",
  lastSync:
    `When ${API_PROVIDER} last updated this rate.`,
  internalId:
    "The system ID for this rate.",
  upcoming:
    "A rate saved for a later date. The current rate stays in effect until then.",
  variance:
    "How far the corporate rate is from the mid-market rate, shown in your base currency and as a percentage.\n\nExample: A corporate rate of 279.0000 PKR against a mid-market rate of 278.5200 PKR shows +0.4800 PKR (+0.17%).",
  effectiveDate:
    "Date from which this rate is applicable.",
  totalValueAllDocs:
    "The combined amount of this currency’s active transactions: open, pending and overdue. Drafts aren’t counted.",
  documentTypeTotal:
    "Sum of all active transactions of this type, in this currency.",
} as const;

// The converters' swap button (and the currency converter's Inverse Rate badge).
// The column headers say the same in RATE_TOOLTIPS.inverse. The "Example:" line
// renders on its own line in blue (Tooltip's TooltipText).
export const INVERSE_BADGE_TOOLTIP =
  "Show the inverse rate: the value of 1 unit of your base currency in this currency.\n\nExample: If 1 AED equals 75.8400 PKR, the inverse rate is 1 PKR = 0.0132 AED.";


export const CONVERTER_SUBTITLE =
  "Convert amounts between this currency and other currencies, at the mid-market or corporate rate.";

// The converter's rate toggles say what the listing's columns say.
export const CONVERTER_TOGGLE_TOOLTIPS = {
  midMarket: `${RATE_TOOLTIPS.midMarket} Synced every 24 hours.`,
  corporate: RATE_TOOLTIPS.corporate,
} as const;

// The Currency Library's column tooltips, which the currency detail page's
// fields share, so a field and its column always say the same thing.
export const CURRENCY_TOOLTIPS = {
  currency: "This currency’s three-letter ISO (International Organization for Standardization) code and name.",
  symbol: "The sign shown with this currency’s amounts.",
  decimals: "The number of decimal places in this currency’s amounts.",
  country: "Where this currency is used.",
  region: "The region of this currency’s main country.",
  inUse: "Active and total transactions in this currency.",
  status: "Whether this currency can be used on new transactions. Inactive currencies keep their history.",
  numericCode: "This currency’s three-digit ISO (International Organization for Standardization) code.",
} as const;

// The exchange rate tables' Notes column, shared by the rate detail page.
export const NOTES_TOOLTIP = "Note added with this rate.";

export const EXPLANATORY_BLOCKS = {
  // The mid-market banner is written in ExchangeRateLibraryPage, where it links the provider.
  corporate:
    "A fixed exchange rate set by your company. It applies until a new rate takes effect.",
} as const;
