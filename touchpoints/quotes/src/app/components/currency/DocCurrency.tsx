import * as React from "react";
import { BaseMoney, Money } from "./Money";
import { DocCurrencyContext, docInBase, useDocCurrency, type DocCurrency } from "./docCurrencyContext";

/* Provider and amount for the document's currency (docCurrencyContext). */

export function DocCurrencyProvider({ children, ...value }: DocCurrency & { children: React.ReactNode }) {
  return (
    <DocCurrencyContext.Provider value={{ ...value, currency: value.currency.toUpperCase() }}>
      {children}
    </DocCurrencyContext.Provider>
  );
}

/** A document amount, in the shown currency: in base with the customer's
 *  amount on hover, or in the document's currency with base on hover. */
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
