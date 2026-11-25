import * as React from 'react';
import { isBaseCurrency } from '@/app/currency/currencies';
import { Segment } from './CurrencyHeaderControls';
import { useDocCurrency } from './docCurrencyContext';
import { setDocView, useDocViewOf } from './docView';

/* ── Base Currency | Invoice (Payment) Currency, on a detail page ─────────────────
 * The detail-page currency switch (25 Nov 2026): flips every amount on the
 * document between the base currency and the document's own. It sits in the
 * main content's toolbar (the invoice's Line Items toolbar, the payment's
 * first card), not the page header: the user turned the header placement
 * down. Self-contained, so it can be moved with a single render site: it
 * reads the document's currency from the page's DocCurrencyProvider and keeps
 * the choice per document for the session (docView.ts). Shown only on a
 * foreign-currency document; a view, never an edit. */

export function DocViewSwitch({
  viewKey,
  partyLabel = 'Invoice Currency',
  partyTip,
  currency: currencyProp,
  className = '',
}: {
  /** The docView.ts key: "invoice:<id>", "payment:<id>". */
  viewKey: string;
  /** The second option: "Invoice Currency", "Payment Currency". */
  partyLabel?: string;
  /** Its tooltip: "Show amounts in the currency set for this invoice." */
  partyTip: string;
  /** The document's currency, where the switch sits outside the page's
   *  DocCurrencyProvider; read from it otherwise. */
  currency?: string;
  className?: string;
}) {
  const doc = useDocCurrency();
  const currency = currencyProp ?? doc.currency;
  const view = useDocViewOf(viewKey);
  if (!currency || isBaseCurrency(currency)) return null;
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5 shrink-0 ${className}`}
      role="radiogroup"
      aria-label="Show amounts in"
    >
      <Segment
        active={view === 'base'}
        onClick={() => setDocView(viewKey, 'base')}
        label="Base Currency"
        tip="Show amounts in your base currency."
      />
      <Segment
        active={view === 'document'}
        onClick={() => setDocView(viewKey, 'document')}
        label={partyLabel}
        tip={partyTip}
      />
    </div>
  );
}
