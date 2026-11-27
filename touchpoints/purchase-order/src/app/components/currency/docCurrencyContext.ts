import * as React from "react";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { currencyDecimals, formatMoney } from "@/app/currency/money";
import { toBase } from "@/app/currency/rates";
import type { MoneyFx } from "./Money";

/* ── The document's currency, and which one the page shows ────────────
 * A PO's amounts are kept in its currency, the vendor's (spec 4.2, 4.3), at a
 * rate to the base currency taken on the PO date. The page shows them in that
 * currency (D1, 27 Nov 2026: order line items open in the document's
 * currency); the Line Items' Base Currency | Vendor Currency switch
 * (`view`) shows them in base, the vendor's amount riding the hover. The PO
 * page puts the currency, its rate and the view here so the pieces (line
 * rows, hover cards, rule and adjustment modals) don't each need a prop; the
 * cart does the same for each vendor group. Outside a provider, amounts are in base. */

export type DocView = "base" | "document";

export interface DocCurrency {
  currency: string;
  /** The rate to base; null where there is none. */
  fx: MoneyFx | null;
  /** What the rate date is, for the hover ("PO date", "today"). */
  dateLabel?: string;
  /** What the currency is, for the hover ("PO currency", "vendor currency"). */
  role?: string;
  /** Which currency amounts are shown in. The document's unless the page says otherwise (D1, 27 Nov 2026). */
  view?: DocView;
}

export const DocCurrencyContext = React.createContext<DocCurrency>({ currency: BASE_CURRENCY, fx: null });

export const useDocCurrency = () => React.useContext(DocCurrencyContext);

/** Where a document's amounts are shown: its own currency (the default,
 *  D1, 27 Nov 2026) or, for a foreign document with a rate, the base. */
export function docInBase(doc: DocCurrency): boolean {
  return (doc.view ?? "document") === "base" && !!doc.fx && !isBaseCurrency(doc.currency);
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

/** "≈ €243.78" — a document amount in the currency not shown (the vendor's in
 *  base view, base in the vendor's); null when there's only one. */
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
