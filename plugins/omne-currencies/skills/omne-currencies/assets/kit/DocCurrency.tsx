import * as React from 'react';
import { BaseMoney, Money } from './Money';
import { DocCurrencyContext, docInBase, useDocCurrency, type DocCurrency } from './docCurrencyContext';

/* ── OMNE currency kit: the document provider and its amount ──────────
 * Wrap a document's page (or create screen) in DocCurrencyProvider with
 * its currency, its rate (documentFx) and the view from docView.ts. Then
 * render every document amount with DocMoney, or useDocMoney() for text.
 *
 * Shared file. Do not edit it in a module. */

export function DocCurrencyProvider({ children, ...value }: DocCurrency & { children: React.ReactNode }) {
  const memo = React.useMemo(
    () => ({ ...value, currency: value.currency.toUpperCase() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value.currency, value.fx, value.dateLabel, value.role, value.view],
  );
  return <DocCurrencyContext.Provider value={memo}>{children}</DocCurrencyContext.Provider>;
}

/** A document amount, in the shown currency: in base with the document's
 *  amount on hover, or in the document's currency with base on hover.
 *  `children` replaces the text (a highlighted or signed copy); the hover stays. */
export function DocMoney({ value, className, children }: { value: number; className?: string; children?: React.ReactNode }) {
  const doc = useDocCurrency();
  const { currency, fx, dateLabel, role } = doc;
  if (docInBase(doc)) {
    return (
      <BaseMoney value={value} currency={currency} fx={fx} dateLabel={dateLabel} role={role ? capitalize(role) : undefined} className={className}>
        {children}
      </BaseMoney>
    );
  }
  return (
    <Money value={value} currency={currency} fx={fx} dateLabel={dateLabel} role={role} className={className}>
      {children}
    </Money>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
