import * as React from "react";
import { Money } from "./Money";
import { DocCurrencyContext, useDocCurrency, type DocCurrency } from "./docCurrencyContext";

/* Provider and amount for the document's currency (docCurrencyContext). */

export function DocCurrencyProvider({ children, ...value }: DocCurrency & { children: React.ReactNode }) {
  return (
    <DocCurrencyContext.Provider value={{ ...value, currency: value.currency.toUpperCase() }}>
      {children}
    </DocCurrencyContext.Provider>
  );
}

/** An amount in the document's currency, with the base-currency hover. */
export function DocMoney({ value, className, children }: { value: number; className?: string; children?: React.ReactNode }) {
  const { currency, fx, dateLabel, role } = useDocCurrency();
  return (
    <Money value={value} currency={currency} fx={fx} dateLabel={dateLabel} role={role} className={className}>
      {children}
    </Money>
  );
}
