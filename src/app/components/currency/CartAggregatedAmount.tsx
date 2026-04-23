import * as React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import { cn } from "../ui/utils";
import { CurrencyFlag } from "../ui/CurrencyFlag";
import { CurrencyAmount } from "../ui/CurrencyAmount";
import { POPriceDisplay } from "./POPriceDisplay";
import {
  BASE_CURRENCY,
  activeRateSnapshot,
  convertToBase,
  getLibraryCurrency,
  rateTypeLabel,
} from "@/app/data/currencyLibrary";
import { formatRateUpdatedAs } from "@/app/data/rateDateFormat";

export interface CartBreakdownEntry {
  currency: string;
  itemCount: number;
  nativeAmount: number;
}

interface Props {
  breakdown: CartBreakdownEntry[];
  signed?: boolean;
  className?: string;
}

/**
 * Cross-vendor cart total. Converts each vendor's native sum to PKR,
 * displays the PKR total, and reveals a per-currency breakdown on hover.
 * When only one currency is present, delegates to the single-currency
 * tooltip for consistency with per-line/per-vendor cells.
 */
export function CartAggregatedAmount({ breakdown, signed, className }: Props) {
  const nonZero = breakdown.filter((e) => e.nativeAmount !== 0);

  if (nonZero.length === 0) {
    return (
      <CurrencyAmount
        mode="single"
        currency={BASE_CURRENCY}
        value={0}
        className={className}
      />
    );
  }

  const unique = Array.from(new Set(nonZero.map((e) => e.currency.toUpperCase())));
  if (unique.length === 1) {
    const only = nonZero[0];
    return (
      <POPriceDisplay
        nativePrice={nonZero.reduce((s, e) => s + e.nativeAmount, 0)}
        vendorName=""
        nativeCurrency={only.currency}
        className={className}
      />
    );
  }

  const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
  const baseSym = baseCur.symbol ?? BASE_CURRENCY;
  const rows = nonZero.map((e) => ({
    ...e,
    baseAmount: convertToBase(e.nativeAmount, e.currency),
  }));
  const totalBase = rows.reduce((s, r) => s + r.baseAmount, 0);
  const sign = signed && totalBase > 0 ? "- " : "";
  const formatted = formatNumber(Math.abs(totalBase), BASE_CURRENCY);
  const snap = activeRateSnapshot();
  const typeLabel = rateTypeLabel(snap.type);
  const typeHex = snap.type === "market" ? "#7c3aed" : "#d97706";
  const updatedAs = formatRateUpdatedAs(snap.lastSyncAt);

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-baseline cursor-help bg-transparent p-0 m-0 border-0 text-left tabular-nums whitespace-nowrap",
            className,
          )}
          style={{ font: "inherit", color: "inherit", letterSpacing: "inherit", lineHeight: "inherit" }}
        >
          {sign}
          <span className="mr-1 border-b border-dotted border-slate-400 leading-none pb-[1px]">{baseSym}</span>
          <span>{formatted}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="rounded-lg border border-slate-200 shadow-lg bg-white w-auto min-w-[280px] max-w-[340px] p-3"
      >
        <div className="flex items-baseline gap-2 text-[13px] font-semibold text-slate-900">
          <span className="self-center"><CurrencyFlag currency={baseCur} size={18} /></span>
          <span>{baseCur.name} ({BASE_CURRENCY})</span>
          <span className="text-slate-500 font-normal">— base currency</span>
        </div>
        <div className="border-t border-slate-100 my-2" />
        <div className="text-[12px] text-slate-500 mb-1.5">
          Aggregated across {rows.length} {rows.length === 1 ? "currency" : "currencies"}
        </div>
        {rows.map((r) => {
          const c = getLibraryCurrency(r.currency);
          const nativeSym = c?.symbol ?? r.currency.toUpperCase();
          const sameAsBase = r.currency.toUpperCase() === BASE_CURRENCY;
          return (
            <div key={r.currency} className="text-[12px] text-slate-700 leading-5 tabular-nums">
              <span className="font-medium">{r.currency.toUpperCase()}</span>
              <span className="text-slate-500"> · {r.itemCount} item{r.itemCount !== 1 ? "s" : ""} · </span>
              <span>{nativeSym} {formatNumber(r.nativeAmount, r.currency)}</span>
              {!sameAsBase && (
                <span className="text-slate-500"> ≈ {baseSym} {formatNumber(r.baseAmount, BASE_CURRENCY)}</span>
              )}
            </div>
          );
        })}
        <div className="mt-2 px-2 py-1.5 rounded-md bg-slate-50 border border-slate-100">
          <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeHex }} />
            <span style={{ color: typeHex, fontWeight: 600 }}>{typeLabel}</span>
            <span className="text-slate-400">· Source: {snap.source}</span>
          </div>
          {updatedAs && (
            <div className="text-[10px] text-slate-400 mt-0.5">Updated as of {updatedAs}</div>
          )}
          <div className="text-[10px] text-slate-400 mt-0.5 italic">
            Invoice posting will use the rate at its own date.
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function formatNumber(value: number, code: string): string {
  const zeroDecimals = new Set(["JPY", "KRW", "VND", "IDR", "HUF", "ISK", "CLP"]);
  const threeDecimals = new Set(["KWD", "BHD", "OMR", "JOD", "TND"]);
  const upper = code.toUpperCase();
  const decimals = zeroDecimals.has(upper) ? 0 : threeDecimals.has(upper) ? 3 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
