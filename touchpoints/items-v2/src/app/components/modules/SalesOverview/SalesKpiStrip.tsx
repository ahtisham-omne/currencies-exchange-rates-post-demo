// @ts-nocheck
// Sales KPI strip — Performance Insights pattern (Overview tab parity).
// Info bar (Sales / date range / updated / Refresh + Reset + Customize)
// → draggable KPI grid using DraggableKpiCard (shared atom).
import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  Calendar, ChevronDown, Check, RefreshCw, RotateCcw, Sliders,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { DraggableKpiCard } from "../itemDetail/DraggableKpiCard";
import {
  SALES_KPI_DEFS,
  DEFAULT_SALES_KPIS,
  computeSalesKpiValue,
} from "./SalesKpis";
import { SalesCustomizePanel } from "./SalesCustomizePanel";

const DATE_RANGE_OPTIONS = [
  { key: "last_7",   label: "Last 7 days" },
  { key: "last_30",  label: "Last 30 days" },
  { key: "last_90",  label: "Last 90 days" },
  { key: "last_365", label: "Last 12 months" },
  { key: "all_time", label: "All time" },
];

function dateRangeLabel(key: string) {
  return DATE_RANGE_OPTIONS.find((o) => o.key === key)?.label ?? "Last 30 days";
}

export function SalesKpiStrip() {
  const [activeKpis, setActiveKpis] = useState<string[]>(DEFAULT_SALES_KPIS);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date());
  const [dateRange, setDateRange] = useState("last_30");

  const handleToggleKpi = useCallback((key: string) => {
    setActiveKpis((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const moveKpi = useCallback((from: number, to: number) => {
    setActiveKpis((prev) => {
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setActiveKpis([...DEFAULT_SALES_KPIS]);
  }, []);

  const handleRefresh = useCallback(() => {
    setLastRefreshed(new Date());
  }, []);

  const activeKpiDefs = useMemo(
    () => activeKpis.map((k) => SALES_KPI_DEFS.find((d) => d.key === k)).filter(Boolean) as typeof SALES_KPI_DEFS,
    [activeKpis]
  );

  return (
    <div className="px-4 pt-3 pb-2 space-y-3">
      {/* ── Info bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Sales</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer">
                <Calendar className="w-3 h-3" />
                <span style={{ fontWeight: 500 }}>{dateRangeLabel(dateRange)}</span>
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[170px]">
              {DATE_RANGE_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.key}
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setDateRange(opt.key)}
                >
                  <span className="text-sm">{opt.label}</span>
                  {dateRange === opt.key && (
                    <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] text-slate-400" style={{ fontWeight: 400 }}>Updated {format(lastRefreshed, "h:mm a")}</span>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:opacity-80 transition-opacity cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 text-[12px] shadow-sm transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            Reset
          </button>
          <button
            onClick={() => setCustomizeOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 text-[12px] shadow-sm transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            Customize Widgets
          </button>
        </div>
      </div>

      {/* ── KPI grid ── */}
      {activeKpiDefs.length > 0 && (
        <DndProvider backend={HTML5Backend}>
          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}
          >
            {activeKpiDefs.map((kpi, idx) => {
              const computed = computeSalesKpiValue(kpi.key);
              return (
                <DraggableKpiCard
                  key={kpi.key}
                  index={idx}
                  kpiKey={kpi.key}
                  label={kpi.label}
                  value={computed.value}
                  iconName={kpi.iconName}
                  tooltip={kpi.tooltip}
                  change={computed.change}
                  changeColor={computed.changeColor}
                  moveCard={moveKpi}
                  onRemove={() => handleToggleKpi(kpi.key)}
                />
              );
            })}
          </div>
        </DndProvider>
      )}

      {/* ── Customize drawer ── */}
      <SalesCustomizePanel
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        activeKpis={activeKpis}
        onToggleKpi={handleToggleKpi}
      />
    </div>
  );
}
