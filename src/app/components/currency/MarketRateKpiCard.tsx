import * as React from "react";
import { TrendingUp, RefreshCw } from "lucide-react";
import { useRateContext } from "@/app/context/RateContext";
import { rateTypeLabel } from "@/app/data/currencyLibrary";
import { relativeTime, formatRateUpdatedAs } from "@/app/data/rateDateFormat";
import { RATE_TYPE_COLORS } from "./MarketCorporateToggle";
import { toast } from "sonner";

/**
 * Performance Insights card for the Sales Order list. Shows the active rate
 * type as a small colored dot ("Mid-market rate" / "Corporate rate"), the
 * "X min ago" freshness, and a tiny refresh action. Mirrors the cadence cue
 * from the Quotes module's RateContextStrip but compacted to fit the same
 * visual footprint as the other KPI cards in the grid.
 */
export function MarketRateKpiCard() {
  const { snapshot, rateType, refresh } = useRateContext();
  const colors = RATE_TYPE_COLORS[rateType];

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    refresh();
    toast.success("Rates refreshed");
  };

  return (
    <div
      className="border rounded-lg bg-white group relative min-w-0 transition-all duration-200 select-none border-[#E2E8F0] hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
      title={`${rateTypeLabel(rateType)} · Source ${snapshot.source} · Updated ${formatRateUpdatedAs(snapshot.lastSyncAt)}`}
    >
      <div className="px-3 py-2">
        {/* Label row: label + trend icon */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10.5px] text-[#64748B] whitespace-nowrap" style={{ fontWeight: 500 }}>
              Market Rate
            </p>
          </div>
          <TrendingUp className="w-3 h-3 text-[#94A3B8] shrink-0" />
        </div>
        {/* Value: colored dot + relative time */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: colors.hex }}
            />
            <p
              className="text-[15px] text-[#0F172A] tracking-tight whitespace-nowrap"
              style={{ fontWeight: 600, lineHeight: 1.2 }}
            >
              {relativeTime(snapshot.lastSyncAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted/50 cursor-pointer shrink-0"
            title="Refresh rates"
          >
            <RefreshCw className="w-3 h-3 text-[#64748B]" />
          </button>
        </div>
        <div className="text-[10px] text-[#94A3B8] mt-0.5 truncate" style={{ fontWeight: 500 }}>
          {rateTypeLabel(rateType)} · {snapshot.source}
        </div>
      </div>
    </div>
  );
}
