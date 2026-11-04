import * as React from "react";

export type InvoiceViewMode = "base" | "vendor";

const Ctx = React.createContext<InvoiceViewMode>("base");

/**
 * Lets a parent (typically the invoice detail screen) flip every nested
 * `<VIMoneyCell invoice={...} />` between the vendor's currency view and the
 * base-currency view in one place. Screens that don't provide it default to
 * "base" so cross-vendor listings stay comparable in the company's base
 * currency; the user can flip an individual invoice to vendor view from the
 * detail-screen toggle.
 */
export const InvoiceViewModeProvider = Ctx.Provider;
export function useInvoiceViewMode(): InvoiceViewMode {
  return React.useContext(Ctx);
}
