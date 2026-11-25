import * as React from "react";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { currencyDecimals, formatMoney } from "@/app/currency/money";
import { formatWhole, restateDesign, restateDesignText } from "@/app/currency/quoteMoney";
import { LAST_SYNC_DAY } from "@/app/currency/qFx";
import { toBase } from "@/app/currency/rates";
import type { MoneyFx } from "./Money";

/* ── The document's currency, and which one the page shows ────────────
 * A quote's amounts are kept in its currency, the customer's (spec 4.2,
 * 4.3), at a rate to the base currency taken on the quote date. The page
 * shows them in the base currency by default, the customer's amount riding
 * the hover; the Base Currency | Customer Currency switch (back on 25 Nov
 * 2026, in the Line Items toolbar, foreign-currency quotes only) flips that (`view`, kept per
 * quote for the session in quoteView.ts). The quote page puts the currency, its rate and the view
 * here so the pieces (line rows, Quote Summary, hover cards, rule,
 * adjustment and freight modals, versions) don't each need a prop; creating
 * a quote does the same for the customer's currency at today's rate.
 * Outside a provider, amounts are in base. */

export type DocView = "base" | "document";

export interface DocCurrency {
  currency: string;
  /** The rate to base; null where there is none (a base-currency quote). */
  fx: MoneyFx | null;
  /** What the rate date is, for the hover ("quote date", "today"). */
  dateLabel?: string;
  /** What the currency is, for the hover ("customer currency"). */
  role?: string;
  /** The document's date (ISO): USD rule amounts and the design's figures
   *  convert on it, also when `fx` is null (a base-currency quote) or its
   *  rate was taken later (today's rate applied on a new version). */
  rateDate?: string;
  /** Which currency amounts are shown in. Base unless the page says otherwise. */
  view?: DocView;
  /** The rate a version of the quote locked in (versions show their amounts
   *  at it); null where it has none on record. */
  versionFx?: (version: number) => MoneyFx | null;
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

/** Whole amounts, as the summaries and modals write them, in the shown
 *  currency: "₨4,652,301", "$1,400,000", "€16,692", "-¥3,000". */
export function useDocWhole(): (value: number) => string {
  const { viewCurrency, toView } = useDocView();
  return React.useCallback((value: number) => formatWhole(toView(value), viewCurrency), [viewCurrency, toView]);
}

/** "≈ €243.78" — a document amount in the currency not shown (the
 *  customer's in base view, base in the customer's); null when there's only one. */
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

/** The design's fixed USD figures (mock history) on the document: restated
 *  in its currency at the rate on its date (`amount`), and written in the
 *  shown currency (`whole`, `text`): through the document's currency and its
 *  rate in base view, so they agree with the document's own amounts. */
export function useDesignMoney() {
  const { currency, fx, rateDate } = useDocCurrency();
  const { inBase, viewCurrency, toView } = useDocView();
  const day = rateDate ?? fx?.rateDate ?? LAST_SYNC_DAY;
  return React.useMemo(
    () => ({
      amount: (usd: number) => restateDesign(usd, currency, day),
      whole: (usd: number) => formatWhole(toView(restateDesign(usd, currency, day)), viewCurrency),
      text: (s: string) =>
        inBase
          ? s.replace(/\$([\d,]+(?:\.\d+)?)/g, (_m, n: string) =>
              formatWhole(toView(restateDesign(Number(n.replace(/,/g, "")), currency, day)), viewCurrency),
            )
          : restateDesignText(s, currency, day),
    }),
    [currency, day, inBase, viewCurrency, toView],
  );
}
