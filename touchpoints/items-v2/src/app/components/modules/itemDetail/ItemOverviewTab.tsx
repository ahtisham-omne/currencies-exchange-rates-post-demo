// @ts-nocheck
// Overview tab body — Physical-Inventory dashboard parity for Items.
// Layout: info bar → draggable KPI strip (react-dnd) → PI widget grid with
// native drag-to-reorder + per-widget S/M/L sizing.
//
// The 4 chart widgets (Stock Health, On-Hand by UoM, Location Distribution,
// Transaction Activity) are the EXACT Physical-Inventory components, wrapped
// in PI's WidgetCard frame. Top Customers + Primary Vendor are re-hosted in
// the same frame (WidgetHeader + body) so the whole grid is uniform — every
// widget gets the hover S/M/L toggle + remove control and drag-to-reorder.
import React, { useCallback, useMemo, useState, useRef } from "react";
import { format } from "date-fns";
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
import { BaseCurrencyNote } from "@/app/components/currency/BaseCurrencyNote";

/* ── Physical-Inventory widget system (exact components + frame) ── */
import { Chart, registerables } from "chart.js";
import { StockHealthGauge } from "@/app/components/widgets/stock-health-gauge";
import { OnHandByUOM } from "@/app/components/widgets/on-hand-by-uom";
import { TopLocations } from "@/app/components/widgets/top-locations";
import { TransactionActivity } from "@/app/components/widgets/transaction-activity";
import { WidgetCard, WidgetHeader, WidgetControlsContext } from "@/app/components/widgets/widget-primitives";

/* Register Chart.js once at module level (Location Distribution + Transaction Activity). */
Chart.register(...registerables);

/* Widget-key → exact Physical-Inventory component. Keys not listed here
 * (top-customers, primary-vendor) fall through to the legacy render fns,
 * wrapped in a WidgetHeader so they share the same frame. */
const PI_WIDGETS = {
  "widget-stock-health": StockHealthGauge,
  "widget-uom":          OnHandByUOM,
  "widget-locations":    TopLocations,
  "widget-activity":     TransactionActivity,
};

const DEFAULT_WIDGETS = [
  "widget-stock-health",
  "widget-uom",
  "widget-locations",
  "widget-activity",
];

// Hidden by default — still available to enable via the Customize Widgets drawer.
// (Their defs live in ITEM_WIDGET_DEFS, so they remain toggleable.)
// "widget-top-customers", "widget-primary-vendor"

interface ItemOverviewTabProps {
  item: any;
  /** Map of widget-key → render fn (passed in from `ItemDetail` so we keep
   *  reusing the existing widget bodies for the non-PI widgets). */
  widgetRenderers: Record<string, (item: any) => React.ReactNode>;
  widgetLabels: Record<string, string>;
  /** Per-widget meta for the header (icon + tooltip). */
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

/* ══════════════════════════════════════════════════════════════════════
 *  useGridDrag — native HTML5 drag-to-reorder (ported 1:1 from PI
 *  dashboard-tab). Uses refs for hot-path state so drag-over doesn't
 *  re-render on every pixel; only lift + drop cause re-renders.
 * ══════════════════════════════════════════════════════════════════════ */
function useGridDrag(prefix: string, move: (from: number, to: number) => void) {
  const [dragging, setDragging] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const register = useCallback(
    (idx: number) => (el: HTMLDivElement | null) => {
      if (el) itemRefs.current.set(idx, el);
      else itemRefs.current.delete(idx);
    },
    [],
  );

  const clearHighlights = useCallback(() => {
    itemRefs.current.forEach((el) => {
      el.style.removeProperty("box-shadow");
      el.style.removeProperty("outline");
      el.style.removeProperty("outline-offset");
      el.style.removeProperty("transform");
    });
  }, []);

  const onDragStart = useCallback(
    (e: React.DragEvent, idx: number) => {
      activeRef.current = idx;
      setDragging(idx);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `${prefix}:${idx}`);

      const ghost = document.createElement("div");
      ghost.style.cssText = "position:absolute;top:-9999px;width:1px;height:1px;";
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      requestAnimationFrame(() => {
        try { document.body.removeChild(ghost); } catch (_) { /* already removed */ }
      });
    },
    [prefix],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const from = activeRef.current;
      if (from === null || from === idx) return;

      clearHighlights();
      const el = itemRefs.current.get(idx);
      if (el) {
        el.style.boxShadow = "0 0 0 2px hsl(var(--primary) / 0.20), 0 0 0 4px hsl(var(--primary) / 0.06)";
        el.style.transform = "scale(1.005)";
      }
    },
    [clearHighlights],
  );

  const onDragLeave = useCallback(
    (_e: React.DragEvent, idx: number) => {
      const el = itemRefs.current.get(idx);
      if (el) {
        el.style.removeProperty("box-shadow");
        el.style.removeProperty("transform");
      }
    },
    [],
  );

  const onDrop = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      clearHighlights();
      const data = e.dataTransfer.getData("text/plain");
      if (!data.startsWith(`${prefix}:`)) return;
      const fromIdx = parseInt(data.split(":")[1], 10);
      if (!isNaN(fromIdx) && fromIdx !== idx) {
        move(fromIdx, idx);
      }
      activeRef.current = null;
      setDragging(null);
    },
    [prefix, move, clearHighlights],
  );

  const onDragEnd = useCallback(() => {
    clearHighlights();
    activeRef.current = null;
    setDragging(null);
  }, [clearHighlights]);

  return { dragging, register, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd };
}

/* ══════════════════════════════════════════════════════════════════════
 *  DraggableWidget — PI WidgetCard frame + native drag + S/M/L flex weight.
 *  `children` is the widget body (PI component, or header + legacy body).
 * ══════════════════════════════════════════════════════════════════════ */
function DraggableWidget({
  index, dragging, register,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  size, onSizeChange, onRemove, children,
}) {
  const isDragging = dragging === index;
  const weight = size === "sm" ? 1 : size === "md" ? 2 : 3;

  return (
    <div
      ref={register(index)}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={(e) => onDragLeave(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className="relative group/widget min-w-0"
      style={{
        flex: `${weight} ${weight} 0`,
        minWidth: 0,
        height: "100%",
        minHeight: 0,
        opacity: isDragging ? 0.3 : 1,
        transform: isDragging ? "scale(0.97) rotate(-0.5deg)" : undefined,
        transition: "flex-grow 0.25s ease, flex-shrink 0.25s ease, opacity 0.2s ease, transform 0.3s ease, box-shadow 0.2s ease",
        cursor: "grab",
        borderRadius: "var(--radius-md)",
      }}
    >
      <WidgetControlsContext.Provider value={{ size, onSizeChange, onRemove }}>
        <WidgetCard>{children}</WidgetCard>
      </WidgetControlsContext.Provider>
    </div>
  );
}

export function ItemOverviewTab({ item, widgetRenderers, widgetLabels, widgetMeta }: ItemOverviewTabProps) {
  const [activeKpis, setActiveKpis] = useState<string[]>(DEFAULT_ITEM_DASH_KPIS);
  const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_WIDGETS);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date());
  const [dateRange, setDateRange] = useState("last_30");
  /* Per-widget size — defaults to "sm" (matches PI). */
  const [widgetSizes, setWidgetSizes] = useState<Record<string, "sm" | "md" | "lg">>({});

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

  const moveWidget = useCallback((from: number, to: number) => {
    setActiveWidgets((prev) => {
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }, []);

  const setWidgetSize = useCallback((id: string, s: "sm" | "md" | "lg") => {
    setWidgetSizes((prev) => ({ ...prev, [id]: s }));
  }, []);

  const handleReset = useCallback(() => {
    setActiveKpis([...DEFAULT_ITEM_DASH_KPIS]);
    setActiveWidgets([...DEFAULT_WIDGETS]);
    setWidgetSizes({});
  }, []);

  const handleRefresh = useCallback(() => {
    setLastRefreshed(new Date());
  }, []);

  const activeKpiDefs = useMemo(
    () => activeKpis.map((k) => ITEM_DASH_KPI_DEFS.find((d) => d.key === k)).filter(Boolean) as typeof ITEM_DASH_KPI_DEFS,
    [activeKpis]
  );

  /* Native drag-to-reorder for the widget grid. */
  const widgetGrid = useGridDrag("widget", moveWidget);

  /* Pack widgets into rows of 3 units (sm=1, md=2, lg=3); overflow wraps. */
  const rows = useMemo(() => {
    const ROW_CAPACITY = 3;
    const out: string[][] = [];
    let cur: string[] = [];
    let used = 0;
    for (const wKey of activeWidgets) {
      const s = widgetSizes[wKey] || "sm";
      const wt = s === "sm" ? 1 : s === "md" ? 2 : 3;
      if (used + wt > ROW_CAPACITY && cur.length > 0) {
        out.push(cur);
        cur = [];
        used = 0;
      }
      cur.push(wKey);
      used += wt;
    }
    if (cur.length > 0) out.push(cur);
    return out;
  }, [activeWidgets, widgetSizes]);

  /* Render a widget's inner content. PI widgets bring their own WidgetHeader;
   * legacy widgets get a WidgetHeader + their existing body. */
  const renderWidgetInner = (wKey: string) => {
    const PIComp = PI_WIDGETS[wKey];
    if (PIComp) return <PIComp partNumber={item?.partNumber} />;
    const render = widgetRenderers[wKey];
    const meta = widgetMeta?.[wKey] ?? {};
    return (
      <>
        <WidgetHeader title={widgetLabels[wKey] ?? wKey} icon={meta.icon} />
        <div className="flex-1 min-h-0 overflow-auto">{render ? render(item) : null}</div>
      </>
    );
  };

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
          <BaseCurrencyNote />
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

      {/* ── KPI strip (react-dnd drag-to-reorder) ── */}
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

      {/* ── Widget grid (PI frame · native drag-to-reorder · S/M/L sizing) ── */}
      {activeWidgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl bg-secondary/10 mt-3">
          <LayoutDashboard className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
          <p className="font-medium text-foreground">No widgets active</p>
          <p className="text-sm text-muted-foreground">Open Customize Widgets to add some.</p>
        </div>
      ) : (
        <div className="flex flex-col pt-1" style={{ gap: "var(--spacing-2-5)" }}>
          {rows.map((rowKeys, rowIdx) => (
            <div
              key={rowIdx}
              className="flex"
              style={{ gap: "var(--spacing-2-5)", height: "420px" }}
            >
              {rowKeys.map((wKey) => {
                const idx = activeWidgets.indexOf(wKey);
                const size = widgetSizes[wKey] || "sm";
                return (
                  <DraggableWidget
                    key={wKey}
                    index={idx}
                    size={size}
                    dragging={widgetGrid.dragging}
                    register={widgetGrid.register}
                    onDragStart={widgetGrid.onDragStart}
                    onDragOver={widgetGrid.onDragOver}
                    onDragLeave={widgetGrid.onDragLeave}
                    onDrop={widgetGrid.onDrop}
                    onDragEnd={widgetGrid.onDragEnd}
                    onSizeChange={(s) => setWidgetSize(wKey, s)}
                    onRemove={() => handleToggleWidget(wKey)}
                  >
                    {renderWidgetInner(wKey)}
                  </DraggableWidget>
                );
              })}
            </div>
          ))}
        </div>
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
