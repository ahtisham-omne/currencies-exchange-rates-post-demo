import * as React from "react";

export type InvoiceViewMode = "base" | "vendor";

const Ctx = React.createContext<InvoiceViewMode>("vendor");

/**
 * Lets a parent (typically the invoice detail screen) flip every nested
 * `<VIMoneyCell invoice={...} />` between the vendor's currency view and the
 * base-currency view in one place. Screens that don't provide it default to
 * "vendor" so amounts stay in the invoice's native currency.
 */
export const InvoiceViewModeProvider = Ctx.Provider;
export function useInvoiceViewMode(): InvoiceViewMode {
  return React.useContext(Ctx);
}
