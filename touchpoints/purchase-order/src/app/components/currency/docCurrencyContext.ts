import * as React from "react";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { formatMoney } from "@/app/currency/money";
import type { MoneyFx } from "./Money";

/* ── The document's currency ──────────────────────────────────────────
 * Everything a PO renders (line rows, hover cards, rule and adjustment
 * modals) shows its amounts in the PO's currency (spec 4.3). The PO page
 * puts that currency and its rate here so the pieces don't each need a
 * prop; the cart does the same for each vendor group. Outside a provider,
 * amounts are in the base currency. */

export interface DocCurrency {
  currency: string;
  /** The rate for the base-currency hover; null where there is none. */
  fx: MoneyFx | null;
  /** What the rate date is, for the hover ("PO date", "today"). */
  dateLabel?: string;
  /** What the currency is, for the hover ("PO currency", "vendor currency"). */
  role?: string;
}

export const DocCurrencyContext = React.createContext<DocCurrency>({ currency: BASE_CURRENCY, fx: null });

export const useDocCurrency = () => React.useContext(DocCurrencyContext);

/** formatMoney in the document's currency. */
export function useDocMoney(): (value: number) => string {
  const { currency } = useDocCurrency();
  return React.useCallback((value: number) => formatMoney(value, currency), [currency]);
}
