// Shared, single-source-of-truth copy for rate terminology tooltips, column
// headers, and explanatory blocks. Anywhere these terms appear in the UI must
// pull from here so wording stays identical across pages.

import { API_PROVIDER } from "../data/exchangeRates";

export const RATE_TOOLTIPS = {
  sourceCurrency:
    "The currency this rate is for, quoted against your base currency.",
  baseCurrency:
    "The reference currency configured for your company. All exchange rates in the system are expressed relative to this currency.",
  // The daily market rate's meaning (Eli's ruling, 26 Nov 2026; Mahreen, 27 Nov 2026).
  midMarket:
    `Read once a day from ${API_PROVIDER}, and fixed for that date.`,
  corporate:
    "Fixed rate set by your company. Applies until a new rate takes effect.",
  // The rate lists' columns, named by what they show (Mahreen's 1d, 27 Nov 2026):
  // "1 Unit in PKR" on each tab, then "1 PKR in That Currency" (inverse).
  unitInBaseMid:
    `The daily market rate: what 1 unit of this currency is worth in your base currency. Read once a day from ${API_PROVIDER}, and fixed for that date.`,
  unitInBaseCorporate:
    "The corporate rate: what 1 unit of this currency is worth in your base currency. Set by your company. Applies until a new rate takes effect.",
  inverse:
    "What 1 unit of your base currency is worth in this currency.\n\nExample: If 1 AED equals 75.8400 in your base currency, 1 unit of your base currency equals 0.0132 AED.",
  change24h:
    "How much the rate moved since the previous day’s read.",
  rateType:
    `Daily market rates are read once a day from ${API_PROVIDER}. Corporate rates are fixed rates your team sets.`,
  // The Rate Date column and fields (Eli's ruling, 26 Nov 2026: a date, no time).
  lastSync:
    `The day this rate was read from ${API_PROVIDER}. It stays fixed for that date.`,
  internalId:
    "The system ID for this rate.",
  upcoming:
    "A rate saved for a later date. The current rate stays in effect until then.",
  variance:
    "The difference between the corporate rate and the daily market rate, in your base currency and as a percentage. Positive means the corporate rate is higher; negative means it’s lower. Updated each day when the daily market rate is read.\n\nExample: A corporate rate of 255 against a daily market rate of 250 shows +5 (+2%). At 245, it shows −5 (−2%).",
  effectiveDate:
    "Date from which this rate is applicable.",
  totalValueAllDocs:
    "The combined amount of this currency’s active transactions. Drafts, and finished, cancelled or archived ones, aren’t counted.",
  documentTypeTotal:
    "Sum of all active transactions of this type, in this currency.",
} as const;

// The converters' swap button (and the currency converter's "1 PKR in that
// currency" badge). No "inverse": Mahreen, 27 Nov 2026, names both directions.
// The column headers say the same in RATE_TOOLTIPS.inverse. The "Example:" line
// renders on its own line in blue (Tooltip's TooltipText).
export const INVERSE_BADGE_TOOLTIP =
  "Show the other direction: what 1 unit of your base currency is worth in this currency.\n\nExample: If 1 AED equals 75.8400 in your base currency, 1 unit of your base currency is 0.0132 AED.";


export const CONVERTER_SUBTITLE =
  "Convert amounts between this currency and other currencies, at the daily market rate or the corporate rate.";

// The Daily Market Rate field on the currency and rate detail pages.
export const MID_MARKET_DETAIL_TOOLTIP = RATE_TOOLTIPS.midMarket;

// The converter's rate toggles say what the listing's columns say.
export const CONVERTER_TOGGLE_TOOLTIPS = {
  midMarket: RATE_TOOLTIPS.midMarket,
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
  // The Daily Market Rates banner is written in ExchangeRateLibraryPage, where it links the provider.
  corporate:
    "A fixed exchange rate set by your company. It applies until a new rate takes effect.",
} as const;
