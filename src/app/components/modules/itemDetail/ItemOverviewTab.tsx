// @ts-nocheck
// Overview tab body — Vendor Dashboard parity for Items.
// Layout: info bar → draggable KPI strip → widget grid (no sidebar).
// State for KPIs / widgets / customize panel / date range / refresh
// is co-located here so the legacy ItemDetail shell stays unchanged.
import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  Calendar, ChevronDown, Check, RefreshCw, RotateCcw, Sliders,
  LayoutDashboard,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  ITEM_DASH_KPI_DEFS,
  DEFAULT_ITEM_DASH_KPIS,
  computeItemDashKpiValue,
} from "./ItemDashKpis";
import { DraggableKpiCard } from "./DraggableKpiCard";
import { ItemDashCustomizePanel } from "./ItemDashCustomizePanel";
import { WidgetShell } from "./WidgetShell";

const DEFAULT_WIDGETS = [
  "widget-stock-health",
  "widget-uom",
  "widget-locations",
  "widget-top-customers",
  "widget-primary-vendor",
  "widget-activity",
];

/** Default column span per widget, matching legacy `ItemDetail` widget defs. */
const WIDGET_SPAN: Record<string, 1 | 2 | 3> = {
  "widget-stock-health":   2,
  "widget-top-customers":  1,
  "widget-primary-vendor": 1,
  "widget-locations":      1,
  "widget-uom":            1,
  "widget-activity":       3,
};

interface ItemOverviewTabProps {
  item: any;
  /** Map of widget-key → render fn (passed in from `ItemDetail` so we keep
   *  reusing the existing widget bodies — no duplication). */
  widgetRenderers: Record<string, (item: any) => React.ReactNode>;
  widgetLabels: Record<string, string>;
  /** Per-widget meta for the WidgetShell header (icon + tooltip). */
  widgetMeta?: Record<string, { icon?: any; tooltip?: string }>;
}

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

export function ItemOverviewTab({ item, widgetRenderers, widgetLabels, widgetMeta }: ItemOverviewTabProps) {
  const [activeKpis, setActiveKpis] = useState<string[]>(DEFAULT_ITEM_DASH_KPIS);
  const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_WIDGETS);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date());
  const [dateRange, setDateRange] = useState("last_30");

  const handleToggleKpi = useCallback((key: string) => {
    setActiveKpis((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const handleToggleWidget = useCallback((key: string) => {
    setActiveWidgets((prev) =>
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
    setActiveKpis([...DEFAULT_ITEM_DASH_KPIS]);
    setActiveWidgets([...DEFAULT_WIDGETS]);
  }, []);

  const handleRefresh = useCallback(() => {
    setLastRefreshed(new Date());
  }, []);

  const activeKpiDefs = useMemo(
    () => activeKpis.map((k) => ITEM_DASH_KPI_DEFS.find((d) => d.key === k)).filter(Boolean) as typeof ITEM_DASH_KPI_DEFS,
    [activeKpis]
  );

  return (
    <div className="space-y-3">
      {/* ── Info bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Overview</span>
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

      {/* ── KPI strip ── */}
      {activeKpiDefs.length > 0 && (
        <DndProvider backend={HTML5Backend}>
          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}
          >
            {activeKpiDefs.map((kpi, idx) => {
              const computed = computeItemDashKpiValue(kpi.key, item);
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

      {/* ── Widget grid ── */}
      {activeWidgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl bg-secondary/10 mt-3">
          <LayoutDashboard className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
          <p className="font-medium text-foreground">No widgets active</p>
          <p className="text-sm text-muted-foreground">Open Customize Widgets to add some.</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
          <AnimatePresence mode="popLayout" initial={false}>
            {activeWidgets.map((wKey) => {
              const render = widgetRenderers[wKey];
              if (!render) return null;
              const span = WIDGET_SPAN[wKey] ?? 1;
              const meta = widgetMeta?.[wKey] ?? {};
              return (
                <motion.div
                  key={wKey}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className={`min-w-0 ${
                    span === 3 ? "lg:col-span-3" : span === 2 ? "lg:col-span-2" : "lg:col-span-1"
                  }`}
                >
                  <WidgetShell
                    title={widgetLabels[wKey] ?? wKey}
                    icon={meta.icon}
                    tooltip={meta.tooltip}
                    onRemove={() => handleToggleWidget(wKey)}
                  >
                    {render(item)}
                  </WidgetShell>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Customize drawer ── */}
      <ItemDashCustomizePanel
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        activeKpis={activeKpis}
        onToggleKpi={handleToggleKpi}
        activeWidgets={activeWidgets}
        onToggleWidget={handleToggleWidget}
        item={item}
      />
    </div>
  );
}