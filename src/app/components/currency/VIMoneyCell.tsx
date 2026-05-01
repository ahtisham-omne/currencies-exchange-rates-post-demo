import * as React from "react";
import { CurrencyAmount } from "../ui/CurrencyAmount";
import { BASE_CURRENCY } from "@/app/data/currencyLibrary";
import type { Invoice } from "@/app/data/mockInvoices";
import { useInvoiceViewMode } from "./InvoiceViewModeContext";

interface VIMoneyCellInvoiceProps {
  /** Amount in the invoice's currency (the vendor's currency). */
  value: number;
  /** The invoice this amount belongs to — drives currency, locked rate, and PO rate. */
  invoice: Invoice;
  className?: string;
}

interface VIMoneyCellRawProps {
  /** Amount in the supplied `currency`. */
  value: number;
  /** ISO 4217 alpha-3 (any case) the value is denominated in. */
  currency: string;
  /** Base-per-1-foreign rate captured at the time this amount was recorded. */
  lockedRate?: number;
  lockedAt?: string;
  /** PO commitment rate carried forward from the originating PO, when applicable. */
  poRate?: number;
  poRateAt?: string;
  /** Optional caption override for the primary rate line. */
  lockedRateLabel?: string;
  className?: string;
}

export type VIMoneyCellProps = VIMoneyCellInvoiceProps | VIMoneyCellRawProps;

function isInvoiceProps(p: VIMoneyCellProps): p is VIMoneyCellInvoiceProps {
  return (p as VIMoneyCellInvoiceProps).invoice !== undefined;
}

/**
 * The single render target for every monetary value across the Vendor
 * Invoicing module. Mirrors the PO module's `POMoneyCell` visual treatment:
 * a dotted-underlined currency symbol with an on-hover panel that explains
 * the FX context.
 *
 * VI-specific:
 *  - the hover panel includes a "PO creation rate" row whenever the invoice
 *    carries a `poLockedRate` (i.e., is PO-based).
 *  - when wrapped in `<InvoiceViewModeProvider value="base">`, every cell
 *    flips to the base currency (PKR) and the hover reveals the vendor
 *    currency. Without the provider it stays in the vendor currency.
 *
 * Two call shapes are supported:
 *   <VIMoneyCell value={inv.amount} invoice={inv} />
 *   <VIMoneyCell value={123.45} currency="USD" lockedRate={278} poRate={275} />
 */
export function VIMoneyCell(props: VIMoneyCellProps) {
  const viewMode = useInvoiceViewMode();

  if (isInvoiceProps(props)) {
    const { invoice, value, className } = props;
    const currency = (invoice.currency || BASE_CURRENCY).toUpperCase();
    const isBase = currency === BASE_CURRENCY;

    if (isBase) {
      return (
        <CurrencyAmount
          mode="single"
          currency={currency}
          value={value}
          className={className}
        />
      );
    }

    if (viewMode === "base") {
      // Show the PKR equivalent; hover reveals the vendor currency line.
      const rate = invoice.lockedRate;
      const baseValue = rate !== undefined ? value * rate : value;
      return (
        <CurrencyAmount
          mode="listing-base"
          currency={BASE_CURRENCY}
          value={baseValue}
          partnerDefaultCurrency={currency}
          partnerDefaultValue={value}
          lockedRate={invoice.lockedRate}
          lockedAt={invoice.lockedAt}
          poRate={invoice.poLockedRate}
          poRateAt={invoice.poLockedAt}
          lockedRateLabel="Invoice rate"
          className={className}
        />
      );
    }

    // Default: vendor-currency view.
    return (
      <CurrencyAmount
        mode="listing-partner"
        currency={currency}
        value={value}
        lockedRate={invoice.lockedRate}
        lockedAt={invoice.lockedAt}
        poRate={invoice.poLockedRate}
        poRateAt={invoice.poLockedAt}
        lockedRateLabel="Invoice rate"
        className={className}
      />
    );
  }

  const { value, currency, lockedRate, lockedAt, poRate, poRateAt, lockedRateLabel, className } = props;
  const code = (currency || BASE_CURRENCY).toUpperCase();
  const isBase = code === BASE_CURRENCY;

  if (isBase) {
    return (
      <CurrencyAmount
        mode="single"
        currency={code}
        value={value}
        className={className}
      />
    );
  }

  return (
    <CurrencyAmount
      mode="listing-partner"
      currency={code}
      value={value}
      lockedRate={lockedRate}
      lockedAt={lockedAt}
      poRate={poRate}
      poRateAt={poRateAt}
      lockedRateLabel={lockedRateLabel ?? (lockedRate !== undefined ? "Invoice rate" : undefined)}
      className={className}
    />
  );
}
