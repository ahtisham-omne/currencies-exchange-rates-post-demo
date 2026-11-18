import * as React from 'react';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { currencyDecimals, formatMoney } from '@/app/currency/money';
import { toBase } from '@/app/currency/rates';
import type { MoneyFx } from './Money';

/* ── The document's currency, and which one the page shows ────────────
 * An invoice's amounts are kept in its own currency, the vendor's (spec 4.2,
 * 4.4), at a rate to the base currency taken on its Rate as of date. The page
 * shows them in the base currency by default, the vendor's amount riding the
 * hover; the header's Base Currency | Vendor Currency toggle flips that
 * (`view`). The invoice page and the create screen put the currency, its rate
 * and the view here so the pieces (line rows, summary, sidebar) don't each
 * need a prop. Ported from Purchase Orders (same names, same rules), so a
 * payment page can use it the same way. Outside a provider, amounts are in
 * base. */

export type DocView = 'base' | 'document';

export interface DocCurrency {
  currency: string;
  /** The rate to base; null where there is none. */
  fx: MoneyFx | null;
  /** What the rate date is, for the hover ("vendor invoice date", "payment date"). */
  dateLabel?: string;
  /** What the currency is, for the hover ("vendor currency", "invoice currency"). */
  role?: string;
  /** Which currency amounts are shown in. Base unless the page says otherwise. */
  view?: DocView;
}

export const DocCurrencyContext = React.createContext<DocCurrency>({ currency: BASE_CURRENCY, fx: null });

export const useDocCurrency = () => React.useContext(DocCurrencyContext);

/** Where a document's amounts are shown: base (the default, for a foreign
 *  document with a rate) or the document's own currency. */
export function docInBase(doc: DocCurrency): boolean {
  return (doc.view ?? 'base') === 'base' && !!doc.fx && !isBaseCurrency(doc.currency);
}

/** The shown currency, and the conversions between it and the document's.
 *  Plain function form for a component that renders the provider itself
 *  (it can't read its own context): the create screen. */
export function docViewOf(doc: DocCurrency) {
  const inBase = docInBase(doc);
  const rate = doc.fx?.rate ?? 1;
  const viewCurrency = inBase ? BASE_CURRENCY : doc.currency;
  return {
    inBase,
    viewCurrency,
    decimals: currencyDecimals(viewCurrency),
    /** A document amount, in the shown currency. */
    toView: (n: number) => (inBase ? toBase(n, rate) : n),
    /** An amount typed in the shown currency, back in the document's. */
    fromView: (n: number) => (inBase ? (rate > 0 ? n / rate : n) : n),
  };
}

/** The shown currency, and the conversions between it and the document's. */
export function useDocView() {
  const doc = useDocCurrency();
  const inBase = docInBase(doc);
  const rate = doc.fx?.rate ?? 1;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => docViewOf(doc), [inBase, doc.currency, rate]);
}

/** formatMoney for a document amount, in the shown currency. */
export function useDocMoney(): (value: number) => string {
  const { viewCurrency, toView } = useDocView();
  return React.useCallback((value: number) => formatMoney(toView(value), viewCurrency), [viewCurrency, toView]);
}

/** "≈ €243.78": a document amount in the currency not shown (the vendor's in
 *  base view, base in the vendor's); null when there's only one. */
export function docOtherText(doc: DocCurrency, value: number): string | null {
  if (!doc.fx || isBaseCurrency(doc.currency)) return null;
  return docInBase(doc) ? `≈ ${formatMoney(value, doc.currency)}` : `≈ ${formatMoney(toBase(value, doc.fx.rate), BASE_CURRENCY)}`;
}

/** docOtherText for the page's document. */
export function useDocOtherText(): (value: number) => string | null {
  const doc = useDocCurrency();
  return React.useCallback((value: number) => docOtherText(doc, value), [doc]);
}
