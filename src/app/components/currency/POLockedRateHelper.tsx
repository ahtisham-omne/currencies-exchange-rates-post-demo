import * as React from "react";
import { Lock } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import type { PurchaseOrderData } from "../poStore";
import { getPOVendorCurrency, poVendorCurrencyIsBase } from "../poStore";
import { BASE_CURRENCY, getLibraryCurrency } from "@/app/data/currencyLibrary";

interface Props {
  po: PurchaseOrderData;
  /** Optional extra classes for positioning. */
  className?: string;
  /** Condense the label for compact placements (e.g. the credit utilization helper). */
  dense?: boolean;
}

/**
 * Small helper text surfaced next to PO totals: "Locked at ₨ 278 per 1 USD —
 * PO creation rate". When line items span multiple captured rates, the tooltip
 * shows the min–max range and the count of distinct rates so the user can
 * spot drift at a glance.
 */
export function POLockedRateHelper({ po, className, dense }: Props) {
  if (poVendorCurrencyIsBase(po)) return null;

  const partnerCurrency = getPOVendorCurrency(po);
  const baseCur = getLibraryCurrency(BASE_CURRENCY);
  const baseSym = baseCur?.symbol ?? BASE_CURRENCY;

  // Collect distinct locked rates across active line items.
  const rates = po.lineItems
    .filter((li) => !li.cancelled && li.lockedRate !== undefined)
    .map((li) => li.lockedRate as number);

  if (rates.length === 0) return null;

  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const hasRange = max - min > 0.0001;
  const representative = rates[0];

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

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
            {dense ? "Locked" : `Locked at ${baseSym} ${fmt(representative)} / 1 ${partnerCurrency}`}
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
              {baseSym} {fmt(min)} – {fmt(max)} per 1 {partnerCurrency}
            </div>
            <div className="text-slate-400 mt-1">
              Each item keeps the rate it was added at. Add-to-cart freezes the PKR equivalent.
            </div>
          </>
        ) : (
          <>
            <div className="text-slate-900" style={{ fontWeight: 600 }}>
              PO creation rate
            </div>
            <div className="tabular-nums mt-0.5">
              1 {partnerCurrency} = {baseSym} {fmt(representative)} {BASE_CURRENCY}
            </div>
            <div className="text-slate-400 mt-1">
              Frozen at add-to-cart. PKR totals stay fixed even if market rates move.
            </div>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
