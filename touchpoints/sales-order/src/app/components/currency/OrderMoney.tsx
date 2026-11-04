import * as React from "react";
import { CurrencyAmount } from "@/app/components/ui/CurrencyAmount";
import { BASE_CURRENCY, convertBetween } from "@/app/data/currencyLibrary";

interface Props {
  /** Amount in PKR (base). All SO amounts are stored as PKR — this component handles the display-side conversion. */
  valuePKR: number;
  /** Customer's order currency. Defaults to base when omitted. */
  customerCurrency?: string;
  /** Detail-page view-mode toggle. `base` shows PKR + customer hover; `customer` shows the converted value + PKR hover. */
  view?: "base" | "customer";
  /** Optional locked rate (base-per-1-customer). When supplied, the conversion + hover anchor to this rate instead of the live snapshot. */
  lockedRate?: number;
  /** Optional ISO timestamp when `lockedRate` was captured. Surfaces in the hover. */
  lockedAt?: string;
  /** Force render with a +/- sign for signed values. */
  signed?: boolean;
  className?: string;
}

/**
 * Shared money cell for Sales Order surfaces (header total, summary card,
 * line items, version history). Honors the page-level Base ↔ Customer view
 * toggle. When the order has a locked rate (post-send), the locked rate wins
 * over the live snapshot so totals stay stable. Mirrors the Quotes module's
 * QuoteMoney for cross-touchpoint consistency.
 */
export function OrderMoney({
  valuePKR,
  customerCurrency,
  view = "base",
  lockedRate,
  lockedAt,
  signed,
  className,
}: Props) {
  const cur = (customerCurrency || BASE_CURRENCY).toUpperCase();
  const isBase = cur === BASE_CURRENCY;

  if (isBase) {
    // Customer settles in the base currency — no FX context to surface, so
    // render the amount plain (no hover) per the product rule.
    return (
      <CurrencyAmount
        mode="single"
        currency={BASE_CURRENCY}
        value={valuePKR}
        signed={signed}
        className={className}
      />
    );
  }

  // Per-record locked rate wins over the live snapshot (versions, history).
  const customerValue = typeof lockedRate === "number"
    ? valuePKR / lockedRate
    : convertBetween(valuePKR, BASE_CURRENCY, cur);

  if (view === "customer") {
    return (
      <CurrencyAmount
        mode="listing-partner"
        currency={cur}
        value={customerValue}
        lockedRate={lockedRate}
        lockedAt={lockedAt}
        signed={signed}
        className={className}
      />
    );
  }

  // base view — show PKR; hover reveals customer-currency equivalent.
  return (
    <CurrencyAmount
      mode="listing-base"
      currency={BASE_CURRENCY}
      value={valuePKR}
      partnerDefaultCurrency={cur}
      partnerDefaultValue={customerValue}
      lockedRate={lockedRate}
      lockedAt={lockedAt}
      signed={signed}
      className={className}
    />
  );
}
