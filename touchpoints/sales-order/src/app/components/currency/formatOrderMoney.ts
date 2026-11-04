import {
  BASE_CURRENCY,
  convertBetween,
  formatMoney,
  getLibraryCurrency,
} from "@/app/data/currencyLibrary";

/**
 * Build a string formatter that respects the page-level Base ↔ Customer view
 * toggle. Mirrors the Quotes module's makeFormatCurrency helper so legacy
 * places that emit raw `$X.toLocaleString()` strings can flip with the toggle
 * without re-architecting their layout into <OrderMoney> components.
 *
 * The input `valuePKR` is assumed to be the canonical base-currency amount;
 * an optional `lockedRate` anchors the customer-side conversion to a saved
 * snapshot (used by transactions / invoices that captured a rate at creation).
 */
export function makeFormatOrderMoney(
  customerCurrency: string | undefined,
  viewMode: "base" | "customer",
) {
  const cur = (customerCurrency || BASE_CURRENCY).toUpperCase();
  const showCustomer = cur !== BASE_CURRENCY && viewMode === "customer";
  const baseCur = getLibraryCurrency(BASE_CURRENCY);
  const baseSym = baseCur?.symbol ?? BASE_CURRENCY;
  const customerCurInfo = getLibraryCurrency(cur);
  const customerSym = customerCurInfo?.symbol ?? cur;

  return (valuePKR: number, lockedRate?: number): string => {
    if (showCustomer) {
      const customerValue = typeof lockedRate === "number"
        ? valuePKR / lockedRate
        : convertBetween(valuePKR, BASE_CURRENCY, cur);
      return `${customerSym} ${formatMoney(Math.abs(customerValue), cur)}`;
    }
    return `${baseSym} ${formatMoney(Math.abs(valuePKR), BASE_CURRENCY)}`;
  };
}
