import * as React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import { CurrencyFlag } from "../ui/CurrencyFlag";
import { cn } from "../ui/utils";
import {
  BASE_CURRENCY,
  activeRateSnapshot,
  getLibraryCurrency,
  rateTypeLabel,
} from "@/app/data/currencyLibrary";
import { formatRateUpdatedAs } from "@/app/data/rateDateFormat";

interface Props {
  valuePKR: number;
  /** When true (default), renders a compact label (e.g. "2.4M"). Disable for full-precision cells. */
  compact?: boolean;
  className?: string;
}

/**
 * Financial KPI cell for base-currency (PKR) aggregates. Displays a compact
 * amount with a dotted-underline symbol and a hover card revealing the full
 * precision value and the active rate source — mirrors the Partner KPI hover.
 */
export function BaseCurrencyKPI({ valuePKR, compact = true, className }: Props) {
  const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
  const baseSym = baseCur.symbol ?? BASE_CURRENCY;
  const displayValue = compact ? formatCompact(valuePKR) : formatFull(valuePKR);
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
            "inline-flex items-baseline cursor-help bg-transparent p-0 m-0 border-0 text-left whitespace-nowrap tabular-nums",
            className,
          )}
          style={{ font: "inherit", color: "inherit", lineHeight: "inherit", letterSpacing: "inherit" }}
        >
          <span className="mr-1 border-b border-dotted border-slate-400 leading-none pb-[1px]">{baseSym}</span>
          <span>{displayValue}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="rounded-lg border border-slate-200 shadow-lg bg-white w-auto min-w-[240px] max-w-[320px] p-3"
      >
        <div className="flex items-baseline gap-2 text-[13px] font-semibold text-slate-900">
          <span className="self-center"><CurrencyFlag currency={baseCur} size={18} /></span>
          <span>{baseCur.name} ({BASE_CURRENCY})</span>
          <span className="text-slate-500 font-normal">— base currency</span>
        </div>
        <div className="border-t border-slate-100 my-2" />
        <div className="text-[12px] text-slate-700 tabular-nums">
          {baseSym} {formatFull(valuePKR)}
        </div>
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

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e9) return sign + trim(abs / 1e9) + "B";
  if (abs >= 1e6) return sign + trim(abs / 1e6) + "M";
  if (abs >= 1e3) return sign + trim(abs / 1e3) + "K";
  return sign + Math.round(abs).toLocaleString("en-US");
}

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

function formatFull(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
