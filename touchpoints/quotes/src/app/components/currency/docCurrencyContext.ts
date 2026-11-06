import * as React from "react";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { formatMoney } from "@/app/currency/money";
import { formatWhole, restateDesign, restateDesignText } from "@/app/currency/quoteMoney";
import { LAST_SYNC_DAY } from "@/app/currency/qFx";
import type { MoneyFx } from "./Money";

/* ── The document's currency ──────────────────────────────────────────
 * Everything a quote renders (line rows, Quote Summary, hover cards, rule,
 * adjustment and freight modals, versions) shows its amounts in the
 * quote's currency (spec 4.3). The quote page puts that currency and its
 * rate here so the pieces don't each need a prop; creating a quote does
 * the same for the customer's currency. Outside a provider, amounts are in
 * the base currency. */

export interface DocCurrency {
  currency: string;
  /** The rate for the base-currency hover; null where there is none. */
  fx: MoneyFx | null;
  /** What the rate date is, for the hover ("quote date", "today"). */
  dateLabel?: string;
  /** What the currency is, for the hover ("quote currency", "customer currency"). */
  role?: string;
  /** The document's rate date (ISO), also when `fx` is null (a base-currency
   *  quote): USD rule amounts and the design's figures convert on it. */
  rateDate?: string;
}

export const DocCurrencyContext = React.createContext<DocCurrency>({ currency: BASE_CURRENCY, fx: null });

export const useDocCurrency = () => React.useContext(DocCurrencyContext);

/** formatMoney in the document's currency. */
export function useDocMoney(): (value: number) => string {
  const { currency } = useDocCurrency();
  return React.useCallback((value: number) => formatMoney(value, currency), [currency]);
}

/** Whole amounts in the document's currency, as the summaries and modals
 *  write them: "$1,400,000", "€16,692", "-¥3,000". */
export function useDocWhole(): (value: number) => string {
  const { currency } = useDocCurrency();
  return React.useCallback((value: number) => formatWhole(value, currency), [currency]);
}

/** The design's fixed USD figures (mock history) in the document's currency,
 *  at the rate on its date: amounts and "$1,200" text. */
export function useDesignMoney() {
  const { currency, fx, rateDate } = useDocCurrency();
  const day = fx?.rateDate ?? rateDate ?? LAST_SYNC_DAY;
  return React.useMemo(
    () => ({
      amount: (usd: number) => restateDesign(usd, currency, day),
      whole: (usd: number) => formatWhole(restateDesign(usd, currency, day), currency),
      text: (s: string) => restateDesignText(s, currency, day),
    }),
    [currency, day],
  );
}
