import * as React from "react";
import { Lock } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import type { PurchaseOrderData } from "../poStore";
import {
  getPOVendorCurrency,
  getPOSettlementCurrency,
  poVendorCurrencyIsBase,
} from "../poStore";
import {
  BASE_CURRENCY,
  convertBetween,
  getLibraryCurrency,
  rateToBase,
} from "@/app/data/currencyLibrary";
import { useRateContext } from "../../context/RateContext";

interface Props {
  po: PurchaseOrderData;
  /** Optional extra classes for positioning. */
  className?: string;
  /** Condense the label for compact placements (e.g. the credit utilization helper). */
  dense?: boolean;
}

/**
 * Small helper text surfaced next to PO totals.
 *
 * Draft POs show the current live rate between the vendor amount currency and
 * the settlement ("You Pay") currency with no lock icon — nothing is locked
 * yet. Once the PO is created, the rate captured at add-to-cart time is
 * shown with a lock icon. When the settlement currency differs from base,
 * the rate is expressed in vendor → settlement terms so it matches the
 * currency configurator.
 */
export function POLockedRateHelper({ po, className, dense }: Props) {
  // Subscribe to RateContext so live-rate display refreshes on rate-type changes.
  useRateContext();

  if (poVendorCurrencyIsBase(po)) return null;

  const partnerCurrency = getPOVendorCurrency(po).toUpperCase();
  // When the saved settlement currency equals the vendor currency, the
  // rate line has nothing to compare against (1:1). Fall back to base so
  // the helper stays informative until the user explicitly picks a different
  // settlement currency in the configurator.
  const savedSettlement = getPOSettlementCurrency(po).toUpperCase();
  const settlementCurrency = savedSettlement === partnerCurrency ? BASE_CURRENCY : savedSettlement;
  const settleCur = getLibraryCurrency(settlementCurrency);
  const settleSym = settleCur?.symbol ?? settlementCurrency;
  const settleAgainstBase = settlementCurrency === BASE_CURRENCY;

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const isDraft = po.status === "Draft";

  if (isDraft) {
    const liveRate = settleAgainstBase
      ? rateToBase(partnerCurrency)
      : convertBetween(1, partnerCurrency, settlementCurrency);
    if (!liveRate) return null;

    return (
      <span
        className={
          "inline-flex items-center gap-1 text-slate-500 " +
          (dense ? "text-[10px]" : "text-[10.5px]") +
          (className ? " " + className : "")
        }
        style={{ fontWeight: 500 }}
      >
        <span className="tabular-nums">
          {dense
            ? `1 ${partnerCurrency} = ${settleSym} ${fmt(liveRate)}`
            : `1 ${partnerCurrency} = ${settleSym} ${fmt(liveRate)} ${settlementCurrency}`}
        </span>
        {!dense && <span className="text-slate-400">· PO creation rate</span>}
      </span>
    );
  }

  // Collect distinct locked rates across active line items (base-per-vendor).
  const rates = po.lineItems
    .filter((li) => !li.cancelled && li.lockedRate !== undefined)
    .map((li) => li.lockedRate as number);

  if (rates.length === 0) return null;

  // Convert the base-per-vendor locked rate into settlement-per-vendor terms
  // when the user settles in a currency other than base.
  const basePerSettlement = settleAgainstBase ? 1 : rateToBase(settlementCurrency);
  const toSettlementRate = (r: number) => (settleAgainstBase || !basePerSettlement ? r : r / basePerSettlement);

  const displayRates = rates.map(toSettlementRate);
  const min = Math.min(...displayRates);
  const max = Math.max(...displayRates);
  const hasRange = max - min > 0.0001;
  const representative = displayRates[0];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={
            "inline-flex items-center gap-1 cursor-help text-slate-500 " +
            (dense ? "text-[10px]" : "text-[10.5px]") +
            (className ? " " + className : "")
          }
          style={{ fontWeight: 500 }}
        >
          <Lock className="w-2.5 h-2.5 text-emerald-600" />
          <span className="tabular-nums">
            {dense ? "Locked" : `Locked at ${settleSym} ${fmt(representative)} / 1 ${partnerCurrency}`}
          </span>
          {hasRange && (
            <span className="tabular-nums text-amber-700">· varies</span>
          )}
          {!dense && !hasRange && <span className="text-slate-400">· PO creation rate</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="max-w-[280px] text-[11px]">
        {hasRange ? (
          <>
            <div className="text-slate-900" style={{ fontWeight: 600 }}>
              Line items locked across a range
            </div>
            <div className="tabular-nums mt-0.5">
              {settleSym} {fmt(min)} – {fmt(max)} per 1 {partnerCurrency}
            </div>
            <div className="text-slate-400 mt-1">
              Each item keeps the rate it was added at. Add-to-cart freezes the equivalent value.
            </div>
          </>
        ) : (
          <>
            <div className="text-slate-900" style={{ fontWeight: 600 }}>
              PO creation rate
            </div>
            <div className="tabular-nums mt-0.5">
              1 {partnerCurrency} = {settleSym} {fmt(representative)} {settlementCurrency}
            </div>
            <div className="text-slate-400 mt-1">
              Frozen at add-to-cart. Totals stay fixed even if market rates move.
            </div>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
