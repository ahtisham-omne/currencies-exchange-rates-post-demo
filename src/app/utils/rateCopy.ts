// Shared, single-source-of-truth copy for rate terminology tooltips, column
// headers, and explanatory blocks. Anywhere these terms appear in the UI must
// pull from here so wording stays identical across pages.

import { API_PROVIDER } from "../data/exchangeRates";

export const RATE_TOOLTIPS = {
  midMarket:
    "The live exchange rate sourced from your configured rate provider. Auto-synced every 24 hours and used as the default rate across documents.",
  corporate:
    "A fixed exchange rate manually set by your team for a specific currency pair. Overrides the mid-market rate wherever it applies and only changes when someone on your team updates it.",
  inverse:
    "The reverse of the displayed exchange rate — what one unit of the target currency is worth in the source currency. For example, if 1 USD = 278.52 PKR, the inverse rate is 1 PKR = 0.003590 USD.",
  baseCurrency:
    "The currency your books are kept in. Every exchange rate is expressed relative to this currency.",
  sourceCurrency:
    "The foreign currency being priced against your base currency.",
  change24h:
    "Percentage change in the mid-market rate over the last 24 hours.",
  effectiveDate:
    "The date this rate becomes (or became) the active rate for new transactions.",
  totalValueAllDocs:
    "Sum of every active document booked in this currency, expressed in the currency's own units.",
  documentTypeTotal:
    "Sum of all active documents of this type, in this currency.",
} as const;

export const CONVERTER_SUBTITLE =
  "See how this currency converts against your base currency or any other active currency. Switch between mid-market and corporate rates to compare.";

export const CONVERTER_TOGGLE_TOOLTIPS = {
  midMarket:
    "The live market rate sourced from your configured rate provider. Updated automatically every 24 hours.",
  corporate:
    "A fixed rate manually set by your team and applied to specific currency pairs. Updated only when someone in your team changes it.",
} as const;

export const EXPLANATORY_BLOCKS = {
  midMarket: {
    whatThisIs: `Live market rates sourced from ${API_PROVIDER}, auto-synced every 24 hours.`,
    whenItsUsed:
      "Default rate across all documents unless a corporate rate is set for the specific pair.",
  },
  corporate: {
    whatThisIs:
      "Fixed rates manually defined by your team for specific currency pairs.",
    whenItsUsed:
      "Overrides the mid-market rate wherever it exists. Useful for contracts, internal reporting, or agreed pricing with partners.",
  },
} as const;
