import * as React from "react";
import { CurrencyAmount } from "../ui/CurrencyAmount";
import { BASE_CURRENCY, convertToBase } from "@/app/data/currencyLibrary";
import { getVendorCurrency } from "../catalogData";

interface POPriceDisplayProps {
  /** Vendor-native price (what the vendor quoted). */
  nativePrice: number;
  /** Name of the vendor whose currency drives this price. */
  vendorName: string;
  /** Optional override — if the caller already knows the native currency. */
  nativeCurrency?: string;
  /** Optional locked rate (per 1 native unit → PKR). When present, the hover shows "Locked" and the displayed value is nativePrice * lockedRate. */
  lockedRate?: number;
  lockedAt?: string;
  /** Extra Tailwind classes applied to the amount span. */
  className?: string;
}

/**
 * Shared price cell for PO surfaces that need to show vendor-native prices
 * converted to PKR with a hover tooltip revealing the original price, rate,
 * and whether the rate is live-market or locked-at-cart.
 *
 * Behavior:
 *   - vendor currency === PKR → renders the native PKR value, no hover chrome
 *     (CurrencyAmount suppresses the hover automatically for base values).
 *   - vendor currency !== PKR → renders PKR equivalent; hover reveals the
 *     "Partner currency: $X USD" line + rate block (market or locked).
 */
export function POPriceDisplay({
  nativePrice,
  vendorName,
  nativeCurrency,
  lockedRate,
  lockedAt,
  className,
}: POPriceDisplayProps) {
  const cur = (nativeCurrency ?? getVendorCurrency(vendorName)).toUpperCase();
  const basePKR = lockedRate !== undefined
    ? nativePrice * lockedRate
    : convertToBase(nativePrice, cur);
  return (
    <CurrencyAmount
      mode="listing-base"
      currency={BASE_CURRENCY}
      value={basePKR}
      partnerDefaultCurrency={cur}
      partnerDefaultValue={nativePrice}
      lockedRate={lockedRate}
      lockedAt={lockedAt}
      className={className}
    />
  );
}
