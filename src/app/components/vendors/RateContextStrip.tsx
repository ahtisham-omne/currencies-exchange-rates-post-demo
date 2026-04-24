import * as React from "react";
import { Activity, Clock, Database } from "lucide-react";
import { useRateContext } from "../../context/RateContext";
import { BASE_CURRENCY, getLibraryCurrency } from "@/app/data/currencyLibrary";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

/** "2 min ago" / "Just now" / "5 hours ago" — relative freshness indicator. */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round(diffMs / 1000));
  if (diffSec < 45) return "Just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Slim, persistent strip that surfaces the FX context feeding the listing:
 * source, daily sync cadence, and a "last synced" freshness indicator. Rates
 * are always mid-market and refresh automatically each day at 19:30.
 */
export function RateContextStrip() {
  const { snapshot } = useRateContext();
  const baseCur = getLibraryCurrency(BASE_CURRENCY);
  const baseSym = baseCur?.symbol ?? BASE_CURRENCY;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-white shadow-sm text-[11.5px] text-slate-600">
      {/* Static rate-type badge — mid-market only */}
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#7c3aed]/20 bg-[#7c3aed]/5 text-[10.5px] text-[#7c3aed] whitespace-nowrap shrink-0" style={{ fontWeight: 600 }}>
        <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed]" />
        Mid-market rates
      </span>

      <span className="h-4 w-px bg-slate-200 shrink-0" />

      {/* Source */}
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-slate-500 hidden md:inline">Source</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate text-foreground cursor-help" style={{ fontWeight: 600 }}>
              {snapshot.source}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px]">
            Rates expressed as {baseSym} {BASE_CURRENCY} per 1 unit of each foreign currency. Updated as of {snapshot.asOfDate}.
          </TooltipContent>
        </Tooltip>
      </span>

      {/* Sync cadence */}
      <span className="inline-flex items-center gap-1.5 hidden sm:inline-flex">
        <Activity className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-slate-500">Sync</span>
        <span className="text-foreground" style={{ fontWeight: 600 }}>{snapshot.syncFrequency}</span>
      </span>

      {/* Last sync — absolute on hover */}
      <span className="inline-flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-slate-500 hidden sm:inline">Updated as of</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-foreground cursor-help" style={{ fontWeight: 600 }}>
              {relativeTime(snapshot.lastSyncAt)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-[11px]">
            {formatAbsolute(snapshot.lastSyncAt)}
          </TooltipContent>
        </Tooltip>
      </span>

      <div className="flex-1" />
    </div>
  );
}
