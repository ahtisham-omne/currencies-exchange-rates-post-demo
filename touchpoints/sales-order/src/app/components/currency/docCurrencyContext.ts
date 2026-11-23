import * as React from "react";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { currencyDecimals, formatMoney } from "@/app/currency/money";
import { toBase } from "@/app/currency/rates";
import { formatWhole, restateDesign, restateDesignText } from "@/app/components/so/soMoney";
import { LAST_SYNC_DAY } from "@/app/currency/soFx";
import type { MoneyFx } from "./Money";

/* ── The document's currency, and which one the page shows ────────────
 * An SO's amounts are kept in its currency, the customer's (spec 4.3), at a
 * rate to the base currency taken on the order date. The page shows them in
 * the base currency by default, the customer's amount riding the hover; the
 * header's Base Currency | Customer Currency toggle flips that (`view`). The
 * SO page puts the currency, its rate and the view here so the pieces (line
 * rows, Order Summary, hover cards, rule, adjustment and freight modals,
 * invoicing) don't each need a prop; creating an SO does the same for the
 * customer's currency at today's rate. Outside a provider, amounts are in
 * base. */

export type DocView = "base" | "document";

export interface DocCurrency {
  currency: string;
  /** The rate to base; null where there is none (a base-currency order). */
  fx: MoneyFx | null;
  /** What the rate date is, for the hover ("order date", "today"). */
  dateLabel?: string;
  /** What the currency is, for the hover ("order currency", "customer currency"). */
  role?: string;
  /** The document's rate date (ISO), also when `fx` is null (a base-currency
   *  order): the design's USD figures convert on it. */
  rateDate?: string;
  /** Which currency amounts are shown in. Base unless the page says otherwise. */
  view?: DocView;
}

export const DocCurrencyContext = React.createContext<DocCurrency>({ currency: BASE_CURRENCY, fx: null });

export const useDocCurrency = () => React.useContext(DocCurrencyContext);

/** Where a document's amounts are shown: base (the default, for a foreign
 *  document with a rate) or the document's own currency. */
export function docInBase(doc: DocCurrency): boolean {
  return (doc.view ?? "base") === "base" && !!doc.fx && !isBaseCurrency(doc.currency);
}

/** The shown currency, and the conversions between it and the document's. */
export function useDocView() {
  const doc = useDocCurrency();
  const inBase = docInBase(doc);
  const rate = doc.fx?.rate ?? 1;
  const viewCurrency = inBase ? BASE_CURRENCY : doc.currency;
  return React.useMemo(
    () => ({
      inBase,
      viewCurrency,
      decimals: currencyDecimals(viewCurrency),
      /** A document amount, in the shown currency. */
      toView: (n: number) => (inBase ? toBase(n, rate) : n),
      /** An amount typed in the shown currency, back in the document's. */
      fromView: (n: number) => (inBase ? (rate > 0 ? n / rate : n) : n),
    }),
    [inBase, viewCurrency, rate],
  );
}

/** formatMoney for a document amount, in the shown currency. */
export function useDocMoney(): (value: number) => string {
  const { viewCurrency, toView } = useDocView();
  return React.useCallback((value: number) => formatMoney(toView(value), viewCurrency), [viewCurrency, toView]);
}

/** Whole document amounts in the shown currency, as the summaries and modals
 *  write them: "₨36,816,233", "$132,186", "€16,692", "-¥3,000". */
export function useDocWhole(): (value: number) => string {
  const { viewCurrency, toView } = useDocView();
  return React.useCallback((value: number) => formatWhole(toView(value), viewCurrency), [viewCurrency, toView]);
}

/** "≈ €243.78" — a document amount in the currency not shown (the customer's
 *  in base view, base in the customer's); null when there's only one. */
export function useDocOtherText(): (value: number) => string | null {
  const doc = useDocCurrency();
  const inBase = docInBase(doc);
  const rate = doc.fx?.rate ?? 1;
  const single = !doc.fx || isBaseCurrency(doc.currency);
  return React.useCallback(
    (value: number) =>
      single ? null : inBase ? `≈ ${formatMoney(value, doc.currency)}` : `≈ ${formatMoney(toBase(value, rate), BASE_CURRENCY)}`,
    [single, inBase, doc.currency, rate],
  );
}

/** The design's fixed USD figures (mock history) in the document's currency,
 *  at the rate on its date: amounts, whole amounts in the shown currency
 *  (base at the order's rate in base view), and "$1,200" text (change
 *  notes, which stay in the order's currency, as the order recorded them). */
export function useDesignMoney() {
  const { currency, fx, rateDate } = useDocCurrency();
  const { viewCurrency, toView } = useDocView();
  const day = fx?.rateDate ?? rateDate ?? LAST_SYNC_DAY;
  return React.useMemo(
    () => ({
      amount: (usd: number) => restateDesign(usd, currency, day),
      whole: (usd: number) => formatWhole(toView(restateDesign(usd, currency, day)), viewCurrency),
      text: (s: string) => restateDesignText(s, currency, day),
    }),
    [currency, day, toView, viewCurrency],
  );
}
