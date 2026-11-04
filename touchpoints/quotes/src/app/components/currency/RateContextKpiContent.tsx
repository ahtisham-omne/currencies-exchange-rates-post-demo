import * as React from "react";
import { RefreshCw, Check } from "lucide-react";
import { useRateContext } from "../../context/RateContext";
import { MarketCorporateToggle } from "./MarketCorporateToggle";
import { toast } from "sonner";

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

/**
 * Compact rate-context content sized to fit inside a Performance Insight KPI
 * card slot. Same controls as `RateContextStrip` (toggle, source, sync, last
 * synced, refresh, display-only) — laid out vertically.
 */
export function RateContextKpiContent() {
  const { snapshot, refresh } = useRateContext();

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    refresh();
    toast.success("Rates refreshed");
  };

  return (
    <div className="flex flex-col gap-1 mt-0.5">
      {/* Row 1: rate-type toggle + refresh */}
      <div className="flex items-center justify-between gap-2">
        <MarketCorporateToggle variant="badge" />
        <button
          type="button"
          onClick={handleRefresh}
          title="Refresh rates"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] text-primary hover:bg-primary/5 transition-colors cursor-pointer shrink-0"
          style={{ fontWeight: 500 }}
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Row 2: source */}
      <div className="text-[10.5px] text-slate-500 truncate" title={snapshot.source}>
        <span className="text-foreground" style={{ fontWeight: 600 }}>{snapshot.source}</span>
      </div>

      {/* Row 3: sync cadence + last synced */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <span className="truncate">{snapshot.syncFrequency}</span>
        <span className="text-slate-300">·</span>
        <span className="text-foreground whitespace-nowrap" style={{ fontWeight: 600 }}>
          {relativeTime(snapshot.lastSyncAt)}
        </span>
      </div>

      {/* Row 4: display-only badge */}
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
        <Check className="w-3 h-3 text-emerald-500" />
        Display-only
      </span>
    </div>
  );
}
