import * as React from 'react';
import { getBaseCurrency, isBaseCurrency } from './currencies';
import { currencyDecimals, formatMoney } from './moneyFormat';
import { DEFAULT_RATE_TYPE, RATE_PROVIDER, rateOn, toBase, type RateType } from './rates';
import type { MoneyFx } from './Money';

/* ── OMNE currency kit: the document's currency, and which one is shown ─
 * A document's amounts are kept in its own currency (the partner's unless
 * changed on it), at a rate to base taken on its rate date. The page shows
 * them in the base currency by default, the document's amount on hover;
 * the Base Currency | <Party> Currency switch in the line items toolbar
 * (DocViewSwitch) flips that. The view is kept per document for the session
 * (docView.ts) and is never an edit.
 *
 * The page puts the currency, its rate and the view in a
 * DocCurrencyProvider (DocCurrency.tsx), so line rows, the summary, hover
 * cards and modals don't each need props. Outside a provider, amounts are
 * in base. GL Impact and journal tables never read the view: they post in
 * base.
 *
 * Shared file. Do not edit it in a module. */

export type DocView = 'base' | 'document';

export interface DocCurrency {
  /** The document's currency, ISO code. */
  currency: string;
  /** The rate to base; null for a base-currency document. */
  fx: MoneyFx | null;
  /** What the rate day is, for the hover: "PO date", "posting date". */
  dateLabel?: string;
  /** What the currency is to the document, for the hover: "Vendor currency". */
  role?: string;
  /** Which currency amounts are shown in. Base unless the page says otherwise. */
  view?: DocView;
}

export const DocCurrencyContext = React.createContext<DocCurrency>({ currency: getBaseCurrency(), fx: null });

export const useDocCurrency = () => React.useContext(DocCurrencyContext);

/** True when the document's amounts are shown in base: the default, for a
 *  foreign document with a rate. */
export function docInBase(doc: DocCurrency): boolean {
  return (doc.view ?? 'base') === 'base' && !!doc.fx && !isBaseCurrency(doc.currency);
}

/** The shown currency, and the conversions between it and the document's.
 *  Plain function, for a component that renders the provider itself. */
export function docViewOf(doc: DocCurrency) {
  const inBase = docInBase(doc);
  const rate = doc.fx?.rate ?? 1;
  const viewCurrency = inBase ? getBaseCurrency() : doc.currency;
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

/** docViewOf for the page's document. */
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

/** "≈ €243.78": a document amount in the currency not shown (the
 *  document's in base view, base in the document's); null when there's only one. */
export function docOtherText(doc: DocCurrency, value: number): string | null {
  if (!doc.fx || isBaseCurrency(doc.currency)) return null;
  return docInBase(doc) ? `≈ ${formatMoney(value, doc.currency)}` : `≈ ${formatMoney(toBase(value, doc.fx.rate), getBaseCurrency())}`;
}

/** docOtherText for the page's document. */
export function useDocOtherText(): (value: number) => string | null {
  const doc = useDocCurrency();
  return React.useCallback((value: number) => docOtherText(doc, value), [doc]);
}

/* ── A document's rate ────────────────────────────────────────────────── */

export interface DocumentFxInput {
  /** The document's currency. */
  currency: string;
  /** The daily market rate unless the document (or the company default) says corporate. */
  rateType?: RateType;
  /** The day the rate is for: the document date, posting date or payment date the BA's document names. */
  rateDate: string;
  /** What that day is, for hovers: "PO date", "posting date", "payment date". */
  dateLabel: string;
  /** The rate stamped on the document, if it has one; else the rate on its day. */
  rate?: number | null;
  /** A corporate rate typed on the document. */
  rateEdited?: boolean;
  /** Not saved or not posted yet: today's rate stands in. */
  provisional?: boolean;
}

/**
 * A document's MoneyFx: its stamped rate, else the rate of its type on its
 * rate day (falling back to the daily market rate on a day with no corporate rate).
 * Null for a base-currency document, which has nothing to convert.
 */
export function documentFx(input: DocumentFxInput): MoneyFx | null {
  const currency = input.currency.toUpperCase();
  if (isBaseCurrency(currency)) return null;
  const rateType = input.rateType ?? DEFAULT_RATE_TYPE;
  if (input.rate && input.rate > 0) {
    return {
      rate: input.rate,
      rateType,
      rateDate: input.rateDate.slice(0, 10),
      source: rateType === 'mid' ? RATE_PROVIDER : input.rateEdited ? 'Corporate rate, changed on this document' : rateOn(currency, input.rateDate, 'corporate').source,
      dateLabel: input.dateLabel,
      provisional: input.provisional,
    };
  }
  const quote = rateOn(currency, input.rateDate, rateType);
  const usable = quote.rate != null ? quote : rateOn(currency, input.rateDate, 'mid');
  return {
    rate: usable.rate ?? 1,
    rateType: usable.type,
    rateDate: usable.date,
    source: usable.source,
    dateLabel: input.dateLabel,
    provisional: input.provisional,
  };
}
