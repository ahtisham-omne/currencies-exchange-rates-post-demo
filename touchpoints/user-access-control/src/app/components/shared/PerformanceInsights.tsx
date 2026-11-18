import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import {
  Calendar, Plus, Search, X, Check, ChevronDown, Trash2, BarChart3,
  Users, UserCheck, Activity, Clock, Archive, UserX, Mail, AlertCircle,
  DollarSign, TrendingDown, PieChart, ShieldAlert, Shield, ShieldCheck,
  ShieldOff, ShieldX, Lock, Wrench, Star, KeyRound, Layers, HardHat, LogIn,
  ToggleLeft, ToggleRight, ChartColumn, GripVertical, CheckCircle2, SlidersHorizontal,
} from "lucide-react";
import { useDrag, useDrop } from "react-dnd";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";
import { highlightMatch } from "../../lib/highlight-text";

/* ─── Types ─── */
export interface InsightMetric {
  id: string;
  label: string;
  value: string;
  subtitle: string;
  category: string;
  iconName: string;
}

export interface InsightCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface PerformanceInsightsProps {
  metrics: InsightMetric[];
  categories: InsightCategory[];
  defaultVisibleIds: string[];
  leadCard?: React.ReactNode;
  panelSubtitle?: string;
  hideHeading?: boolean;
  visibleIds?: string[];
  onVisibleIdsChange?: (ids: string[]) => void;
  drawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  /** Skip rendering the heading + date dropdown + Add Insights row.
   *  Use when the parent provides its own header chrome (e.g. UserDetail
   *  OverviewTab renders the date dropdown next to the page heading). */
  hideHeaderRow?: boolean;
  /** Controlled date range (use with onDateRangeChange to share state with a
   *  parent-rendered date dropdown). */
  dateRange?: DateRangeKey;
  onDateRangeChange?: (key: DateRangeKey) => void;
  /** The ranges the date picker offers. Defaults to every range
   *  (DATE_OPTIONS); the Users and Roles listings pass LISTING_DATE_OPTIONS. */
  dateOptions?: readonly DateOption[];
  /** Starting range when uncontrolled. Defaults to Last 30 Days. */
  defaultDateRange?: DateRangeKey;
}

/* ─── Date filter options ─── */
export const DATE_OPTIONS = [
  { key: "last_7", label: "Last 7 Days" },
  { key: "last_30", label: "Last 30 Days" },
  { key: "last_90", label: "Last 90 Days" },
  { key: "last_365", label: "Last 12 Months" },
  { key: "all_time", label: "All Time" },
] as const;

export type DateRangeKey = (typeof DATE_OPTIONS)[number]["key"];
export type DateOption = (typeof DATE_OPTIONS)[number];

/** The ranges the Users and Roles listings offer in Pioneer: All Time only.
 *  The system does not keep the history a date range needs, so the other
 *  ranges are backlogged (ERP-5203 AC6, ERP-5686, Fatima 59286; same call as
 *  the Roles listing, ERP-5493 Option A). They stay in DATE_OPTIONS, which the
 *  User Detail and Role Detail pickers still use; to bring them back to the
 *  listings, pass DATE_OPTIONS instead. */
export const LISTING_DATE_OPTIONS: readonly DateOption[] = DATE_OPTIONS.filter(
  (o) => o.key === "all_time"
);

export function dateRangeLabel(key: DateRangeKey): string {
  return DATE_OPTIONS.find((o) => o.key === key)?.label ?? "Last 30 days";
}

/* ─── KPI Icon mapper ─── */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: CSSProperties }>> = {
  Users, UserCheck, Activity, Clock, Archive, UserX, Mail, AlertCircle,
  DollarSign, TrendingDown, PieChart, ShieldAlert, Shield, ShieldCheck,
  ShieldOff, ShieldX, Lock, Wrench, Star, KeyRound, Layers, BarChart3, HardHat, LogIn, Calendar, CheckCircle2,
};

function KpiIcon({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className={className} style={style} />;
}

/* ─── DnD type ─── */
const DND_KPI = "KPI_CARD";

/* ─── Draggable KPI Card ─── */
function DraggableKpiCard({
  index, kpi, moveCard, onRemove,
}: {
  index: number;
  kpi: InsightMetric;
  moveCard: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_KPI,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_KPI,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      const hoverRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverRect.right - hoverRect.left) / 2;
      const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverRect.left;
      const hoverClientY = clientOffset.y - hoverRect.top;
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY && hoverClientX < hoverMiddleX) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY && hoverClientX > hoverMiddleX) return;
      moveCard(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  preview(drop(ref));
  drag(ref);

  if (isDragging) {
    return (
      <div
        ref={ref}
        className="rounded-[8px] border border-dashed border-[#007FFF]/20 bg-[#007FFF]/[0.02] min-h-[52px] pointer-events-none"
      />
    );
  }

  return (
    <div
      ref={ref}
      className={`border rounded-[8px] bg-white group relative min-w-0 transition-all duration-200 select-none overflow-hidden cursor-grab active:cursor-grabbing ${
        isOver
          ? "border-[#007FFF]/30 bg-[#007FFF]/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]"
          : "border-[#E2E8F0] hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
      }`}
    >
      {isOver && (
        <div className="absolute inset-0 rounded-[8px] bg-[#007FFF]/[0.02] pointer-events-none" />
      )}
      <div className="px-3 py-2" title={kpi.subtitle}>
        {/* Drag handle */}
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-[#F1F5F9] rounded-md p-1 z-10 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
        </div>
        {/* Label + icon */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <p className="text-[10.5px] whitespace-nowrap" style={{ fontWeight: 500, color: "#64748B" }}>{kpi.label}</p>
          <KpiIcon name={kpi.iconName} className="w-3.5 h-3.5 shrink-0" style={{ color: "#90A5BA" }} />
        </div>
        {/* Value */}
        <p className="text-[15px] tracking-tight whitespace-nowrap" style={{ fontWeight: 550, lineHeight: 1.2, color: "#0F172A" }}>
          {kpi.value}
        </p>
      </div>
      {/* Remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
        title={`Remove ${kpi.label}`}
      >
        <Trash2 className="w-3 h-3" style={{ color: "#94A3B8" }} />
      </button>
    </div>
  );
}

/* ─── Insights Drawer ─── */
interface InsightsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metrics: InsightMetric[];
  categories: InsightCategory[];
  visibleIds: string[];
  onToggle: (id: string) => void;
  onSetAll: (ids: string[]) => void;
  panelSubtitle?: string;
}

function InsightsDrawer({ open, onOpenChange, metrics, categories, visibleIds, onToggle, onSetAll, panelSubtitle }: InsightsDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      timeoutRef.current = setTimeout(() => setMounted(false), 280);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [open]);

  const filteredByCategory = useMemo(() => {
    const cats: { id: string; label: string; icon: React.ReactNode; items: InsightMetric[] }[] = [];
    for (const cat of categories) {
      const items = metrics.filter((m) => {
        if (m.category !== cat.id) return false;
        if (!searchQuery) return true;
        return m.label.toLowerCase().includes(searchQuery.toLowerCase());
      });
      if (items.length > 0) cats.push({ ...cat, items });
    }
    return cats;
  }, [categories, metrics, searchQuery]);

  const activeCount = visibleIds.length;
  const allIds = metrics.map((m) => m.id);
  const allActive = allIds.length > 0 && allIds.every((id) => visibleIds.includes(id));

  if (!mounted) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{
          backgroundColor: visible ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0)",
          pointerEvents: visible ? "auto" : "none",
        }}
        onClick={() => onOpenChange(false)}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          transform: visible ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#EDF4FF" }}
              >
                <SlidersHorizontal className="w-5 h-5" style={{ color: "#007FFF" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                  Customize Widgets
                </h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  {panelSubtitle ?? "Manage your dashboard KPI widgets."}
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
            >
              <X className="w-4 h-4" style={{ color: "#94A3B8" }} />
            </button>
          </div>

          {/* Counter + All On/Off toggle */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px]" style={{ fontWeight: 500, color: "#94A3B8" }}>
              {activeCount} of {metrics.length} widgets active
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (allActive) {
                  onSetAll([]);
                } else {
                  onSetAll([...allIds]);
                }
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                allActive
                  ? "bg-[#EBF3FF] border-[#007FFF]/25 text-[#007FFF] hover:bg-[#DCEAFF] hover:border-[#007FFF]/40 shadow-sm shadow-[#007FFF]/10"
                  : activeCount === 0
                  ? "bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8] hover:bg-[#F1F5F9] hover:border-[#CBD5E1] hover:text-[#64748B]"
                  : "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-[#EBF3FF] hover:border-[#007FFF]/25 hover:text-[#007FFF]"
              }`}
              style={{ fontWeight: 600 }}
            >
              {allActive ? (
                <>
                  <ToggleRight className="w-4 h-4" style={{ color: "#007FFF" }} />
                  <span>All On</span>
                </>
              ) : activeCount === 0 ? (
                <>
                  <ToggleLeft className="w-4 h-4" />
                  <span>All Off</span>
                </>
              ) : (
                <>
                  <ToggleRight className="w-4 h-4" style={{ color: "#64748B" }} />
                  <span>Enable All</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-3.5 pb-1 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#90A5BA" }} />
            <input
              placeholder="Search metrics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-[8px] border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {filteredByCategory.length === 0 && (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground/60">No Metrics Found</p>
            </div>
          )}

          {filteredByCategory.map((cat) => (
            <div key={cat.id} className="mt-5 first:mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span style={{ color: "#90A5BA" }}>{cat.icon}</span>
                <span
                  className="text-[12px] uppercase tracking-wide"
                  style={{ fontWeight: 600, color: "#94A3B8" }}
                >
                  {cat.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {cat.items.map((metric) => {
                  const isActive = visibleIds.includes(metric.id);
                  return (
                    <button
                      key={metric.id}
                      onClick={() => onToggle(metric.id)}
                      title={metric.subtitle}
                      className={`relative text-left rounded-[8px] border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                        isActive
                          ? "border-[#007FFF]/25 bg-[#007FFF]/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                          : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-[11.5px] truncate transition-colors"
                          style={{ fontWeight: 500, color: isActive ? "#007FFF" : "#94A3B8" }}
                          title={metric.label}
                        >
                          {highlightMatch(metric.label, searchQuery)}
                        </span>
                        <div className="shrink-0">
                          {isActive ? (
                            <Check className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />
                          ) : (
                            <Plus className="w-3.5 h-3.5 transition-colors" style={{ color: "#94A3B8" }} />
                          )}
                        </div>
                      </div>
                      <p
                        className={`text-[15px] mt-1 transition-colors ${
                          isActive ? "text-foreground" : "text-foreground/80"
                        }`}
                        style={{ fontWeight: 550 }}
                      >
                        {metric.value}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── Main PerformanceInsights Component ─── */
export function PerformanceInsights({
  metrics,
  categories,
  defaultVisibleIds,
  leadCard,
  panelSubtitle,
  hideHeading,
  visibleIds: controlledVisibleIds,
  onVisibleIdsChange,
  drawerOpen: controlledDrawerOpen,
  onDrawerOpenChange,
  hideHeaderRow,
  dateRange: controlledDateRange,
  onDateRangeChange,
  dateOptions = DATE_OPTIONS,
  defaultDateRange = "last_30",
}: PerformanceInsightsProps) {
  const [internalVisibleIds, setInternalVisibleIds] = useState<string[]>(defaultVisibleIds);
  const [internalDateRange, setInternalDateRange] = useState<DateRangeKey>(defaultDateRange);
  const [internalDrawerOpen, setInternalDrawerOpen] = useState(false);

  const visibleIds = controlledVisibleIds ?? internalVisibleIds;
  const drawerOpen = controlledDrawerOpen ?? internalDrawerOpen;
  const setDrawerOpen = onDrawerOpenChange ?? setInternalDrawerOpen;
  const insightsDateRange = controlledDateRange ?? internalDateRange;
  const setInsightsDateRange = onDateRangeChange ?? setInternalDateRange;

  const visibleMetrics = useMemo(
    () => {
      // Preserve order of visibleIds
      return visibleIds
        .map((id) => metrics.find((m) => m.id === id))
        .filter(Boolean) as InsightMetric[];
    },
    [metrics, visibleIds]
  );

  const toggleMetric = useCallback((id: string) => {
    const next = visibleIds.includes(id) ? visibleIds.filter((x) => x !== id) : [...visibleIds, id];
    if (onVisibleIdsChange) {
      onVisibleIdsChange(next);
    } else {
      setInternalVisibleIds(next);
    }
  }, [visibleIds, onVisibleIdsChange]);

  const setAllIds = useCallback((ids: string[]) => {
    if (onVisibleIdsChange) {
      onVisibleIdsChange(ids);
    } else {
      setInternalVisibleIds(ids);
    }
  }, [onVisibleIdsChange]);

  const moveCard = useCallback((fromIndex: number, toIndex: number) => {
    const next = [...visibleIds];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    if (onVisibleIdsChange) {
      onVisibleIdsChange(next);
    } else {
      setInternalVisibleIds(next);
    }
  }, [visibleIds, onVisibleIdsChange]);

  const hasVisibleContent = visibleMetrics.length > 0 || !!leadCard;

  return (
    <div className="relative">
      {hasVisibleContent && (
        <>
          {/* Header row, skipped when parent renders its own chrome. */}
          {!hideHeaderRow && (
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                {!hideHeading && (
                  <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>
                    Performance Insights
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer">
                      <Calendar className="w-3 h-3" />
                      <span style={{ fontWeight: 500 }}>
                        {dateRangeLabel(insightsDateRange)}
                      </span>
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[170px]">
                    {dateOptions.map((opt) => (
                      <DropdownMenuItem
                        key={opt.key}
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setInsightsDateRange(opt.key)}
                      >
                        <span className="text-sm">{opt.label}</span>
                        {insightsDateRange === opt.key && (
                          <Check className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] hover:bg-muted/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                style={{ fontWeight: 500, color: "#007FFF" }}
              >
                <Plus className="w-3 h-3" />
                Add Insights
              </button>
            </div>
          )}

          {/* KPI Cards, draggable grid */}
          <DndProvider backend={HTML5Backend}>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
              {leadCard}
              {visibleMetrics.map((kpi, idx) => (
                <DraggableKpiCard
                  key={kpi.id}
                  index={idx}
                  kpi={kpi}
                  moveCard={moveCard}
                  onRemove={() => toggleMetric(kpi.id)}
                />
              ))}
            </div>
          </DndProvider>
        </>
      )}

      {/* Drawer, always in the same tree position to prevent remount */}
      <InsightsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        metrics={metrics}
        categories={categories}
        visibleIds={visibleIds}
        onToggle={toggleMetric}
        onSetAll={setAllIds}
        panelSubtitle={panelSubtitle}
      />
    </div>
  );
}

/* ─── Standalone Insights toolbar button ─── */
interface InsightsToolbarButtonProps {
  activeCount: number;
  onClick: () => void;
  isActive?: boolean;
}

export function InsightsToolbarButton({ activeCount, onClick, isActive }: InsightsToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-[8px] border shadow-sm transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        isActive
          ? "border-primary/30 bg-primary/[0.04] text-foreground"
          : "border-border bg-white text-foreground hover:bg-muted/40"
      }`}
    >
      <ChartColumn className="w-[18px] h-[18px]" style={{ color: "#94A3B8" }} />
      <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
        Insights
      </span>
      {activeCount > 0 && (
        <span
          className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]"
          style={{ backgroundColor: "#EDF4FF", color: "#007FFF", fontWeight: 600 }}
        >
          {activeCount}
        </span>
      )}
    </button>
  );
}
