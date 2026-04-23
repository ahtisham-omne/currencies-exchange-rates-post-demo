import * as React from "react";
import { CurrencyAmount } from "../ui/CurrencyAmount";
import { BASE_CURRENCY, convertBetween } from "@/app/data/currencyLibrary";
import type { PurchaseOrderData } from "../poStore";
import { getPOVendorCurrency, poVendorCurrencyIsBase } from "../poStore";

interface POMoneyCellProps {
  /**
   * Amount in the PO's base currency (always PKR). All line-item unitPrice,
   * subtotal, discountTotal, shippingFee, and total fields are already PKR.
   */
  valuePKR: number;
  /** PO context — drives viewMode and partner currency lookups. */
  po: PurchaseOrderData;
  /**
   * Optional locked rate for this specific number (base-per-1-native).
   * Provide it for line-item cells so the hover shows the frozen add-to-cart
   * rate instead of the current market/corporate rate. Omit for aggregate
   * totals; the hover will fall back to the live snapshot.
   */
  lockedRate?: number;
  lockedAt?: string;
  className?: string;
  /** When true, always render in the PO's vendor currency regardless of viewMode. Useful for "native-only" spots like a vendor-native invoice preview. */
  forcePartner?: boolean;
}

/**
 * The single render target for every amount shown on a PO detail surface
 * (line items, order summary, credit utilization, header strip). Honors the
 * PO's `viewMode` so the Base ↔ Partner toggle flips every cell at once.
 *
 * When the PO's vendor-amount currency is already PKR, the toggle should be
 * hidden by the caller, and this component renders a plain value with no
 * conversion hover.
 */
export function POMoneyCell({ valuePKR, po, lockedRate, lockedAt, className, forcePartner }: POMoneyCellProps) {
  const partnerCurrency = getPOVendorCurrency(po);
  const isBase = poVendorCurrencyIsBase(po);

  // PKR vendor — nothing to convert; render a single-mode amount.
  if (isBase) {
    return (
      <CurrencyAmount
        mode="single"
        currency={BASE_CURRENCY}
        value={valuePKR}
        className={className}
      />
    );
  }

  const showingPartner = forcePartner || po.viewMode === "partner";

  if (showingPartner) {
    const partnerValue = lockedRate !== undefined
      ? valuePKR / lockedRate
      : convertBetween(valuePKR, BASE_CURRENCY, partnerCurrency);
    return (
      <CurrencyAmount
        mode="listing-partner"
        currency={partnerCurrency}
        value={partnerValue}
        lockedRate={lockedRate}
        lockedAt={lockedAt}
        className={className}
      />
    );
  }

  // "base" view — show PKR; hover reveals partner-currency equivalent.
  const partnerValue = lockedRate !== undefined
    ? valuePKR / lockedRate
    : convertBetween(valuePKR, BASE_CURRENCY, partnerCurrency);
  return (
    <CurrencyAmount
      mode="listing-base"
      currency={BASE_CURRENCY}
      value={valuePKR}
      partnerDefaultCurrency={partnerCurrency}
      partnerDefaultValue={partnerValue}
      lockedRate={lockedRate}
      lockedAt={lockedAt}
      className={className}
    />
  );
}
