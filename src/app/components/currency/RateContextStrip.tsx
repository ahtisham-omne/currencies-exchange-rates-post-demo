import * as React from "react";
import { Activity, Clock, RefreshCw, Database, Check } from "lucide-react";
import { useRateContext } from "../../context/RateContext";
import { BASE_CURRENCY, getLibraryCurrency } from "@/app/data/currencyLibrary";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";
import { toast } from "sonner";
import { MarketCorporateToggle } from "./MarketCorporateToggle";

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
 * Slim, persistent strip that surfaces the FX logic feeding the listing: which
 * rate table is active (market or corporate), where the numbers come from,
 * sync cadence, and a "last synced" freshness indicator with a refresh action.
 */
export function RateContextStrip() {
  const { snapshot, rateType, refresh } = useRateContext();
  const baseCur = getLibraryCurrency(BASE_CURRENCY);
  const baseSym = baseCur?.symbol ?? BASE_CURRENCY;

  const handleRefresh = () => {
    refresh();
    toast.success("Rates refreshed");
  };

  const typeLabel = rateType === "market" ? "Live market" : "Corporate book";

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-white shadow-sm text-[11.5px] text-slate-600">
        <MarketCorporateToggle variant="badge" label={`${typeLabel} rates`} />

        <span className="h-4 w-px bg-slate-200 shrink-0" />

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
              Rates expressed as {baseSym} {BASE_CURRENCY} per 1 unit of each foreign currency. Effective as of {snapshot.asOfDate}.
            </TooltipContent>
          </Tooltip>
        </span>

        <span className="items-center gap-1.5 hidden sm:inline-flex">
          <Activity className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500">Sync</span>
          <span className="text-foreground" style={{ fontWeight: 600 }}>{snapshot.syncFrequency}</span>
        </span>

        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500 hidden sm:inline">Updated</span>
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

        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-primary hover:bg-primary/5 transition-colors cursor-pointer shrink-0"
          style={{ fontWeight: 500 }}
        >
          <RefreshCw className="w-3 h-3" />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground/70 shrink-0">
          <Check className="w-3 h-3 text-emerald-500" />
          Display-only
        </span>
      </div>
    </TooltipProvider>
  );
}
