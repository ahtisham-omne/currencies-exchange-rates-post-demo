import { useState, useEffect, useMemo, useRef } from "react";
import {
  X, Search, Check, Plus, ToggleLeft, ToggleRight, SlidersHorizontal,
  Activity as ActivityIcon, ShieldCheck, User, type LucideIcon,
} from "lucide-react";
import type { InsightMetric, InsightCategory } from "../shared/PerformanceInsights";
import { highlightMatch } from "../../lib/highlight-text";

/* ─────────────────────────────────────────────────────────────
 * WidgetsCustomizePanel
 * Right-side drawer with two tabs — KPIs and Widgets — mirroring the
 * Partner (Vendor) Details "Customize Widgets" drawer. The KPIs tab toggles
 * the insight-strip metrics; the Widgets tab toggles the left-column widget
 * cards and exposes a per-card SM/MD/LG size control (visible only while the
 * widget is active). Header count + "Enable All" are tab-aware.
 * ──────────────────────────────────────────────────────────── */

export type WidgetVisualKind =
  | "bars" | "line" | "list" | "fields" | "shield" | "devices" | "note";

export interface WidgetMeta {
  key: string;
  label: string;
  category: string;
  description: string;
  visual: WidgetVisualKind;
}

type WidgetSize = "sm" | "md" | "lg";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /* KPIs */
  metrics: InsightMetric[];
  categories: InsightCategory[];
  kpiVisibleIds: string[];
  onToggleKpi: (id: string) => void;
  onSetAllKpis: (ids: string[]) => void;
  /* Widgets */
  widgetDefs: WidgetMeta[];
  widgetCategoryOrder: string[];
  activeWidgets: string[];
  onToggleWidget: (key: string) => void;
  onSetAllWidgets: (keys: string[]) => void;
  widgetSizes: Record<string, WidgetSize>;
  onWidgetSizeChange: (key: string, size: WidgetSize) => void;
}

const WIDGET_CATEGORY_ICON: Record<string, LucideIcon> = {
  Activity: ActivityIcon,
  Security: ShieldCheck,
  Profile: User,
};

/* ── Miniature pastel preview shown on each widget card in the Widgets tab ── */
function WidgetVisual({ kind }: { kind: WidgetVisualKind }) {
  const wrap =
    "h-[74px] w-full rounded-lg flex items-center justify-center overflow-hidden";
  switch (kind) {
    case "bars":
      return (
        <div className={wrap} style={{ background: "linear-gradient(180deg,#F5F9FF,#FFFFFF)" }}>
          <div className="flex items-end gap-1.5 h-9">
            {[10, 20, 14, 26, 12, 22].map((h, i) => (
              <div
                key={i}
                className="w-2 rounded-sm"
                style={{ height: h, backgroundColor: i % 3 === 1 ? "#F59E0B" : "#7DB0FF" }}
              />
            ))}
          </div>
        </div>
      );
    case "line":
      return (
        <div className={wrap} style={{ background: "linear-gradient(180deg,#F5F9FF,#FFFFFF)" }}>
          <svg viewBox="0 0 120 40" className="w-[80%] h-9" preserveAspectRatio="none">
            <polyline
              points="0,32 20,26 40,28 60,18 80,20 100,10 120,6"
              fill="none"
              stroke="#7DB0FF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      );
    case "list":
      return (
        <div className={wrap} style={{ background: "linear-gradient(180deg,#F8FAFC,#FFFFFF)" }}>
          <div className="w-[72%] space-y-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#93B8F7" }} />
                <div className="h-1.5 rounded-full" style={{ width: `${70 - i * 14}%`, backgroundColor: "#E2E8F0" }} />
              </div>
            ))}
          </div>
        </div>
      );
    case "fields":
      return (
        <div className={wrap} style={{ background: "linear-gradient(180deg,#F8FAFC,#FFFFFF)" }}>
          <div className="grid grid-cols-2 gap-1.5 w-[72%]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-1 rounded-full w-8" style={{ backgroundColor: "#E2E8F0" }} />
                <div className="h-1.5 rounded-full w-12" style={{ backgroundColor: "#CBD5E1" }} />
              </div>
            ))}
          </div>
        </div>
      );
    case "shield":
      return (
        <div className={wrap} style={{ background: "linear-gradient(180deg,#F0FDF4,#FFFFFF)" }}>
          <ShieldCheck className="w-7 h-7" style={{ color: "#34D399" }} />
        </div>
      );
    case "devices":
      return (
        <div className={wrap} style={{ background: "linear-gradient(180deg,#F8FAFC,#FFFFFF)" }}>
          <div className="flex items-end gap-2">
            <div className="w-9 h-6 rounded-[3px] border-2" style={{ borderColor: "#93B8F7" }} />
            <div className="w-3.5 h-6 rounded-[3px] border-2" style={{ borderColor: "#7DB0FF" }} />
          </div>
        </div>
      );
    case "note":
      return (
        <div className={wrap} style={{ background: "linear-gradient(180deg,#FEFCE8,#FFFFFF)" }}>
          <div className="w-[64%] space-y-1.5">
            {[100, 82, 90].map((w, i) => (
              <div key={i} className="h-1.5 rounded-full" style={{ width: `${w}%`, backgroundColor: "#FDE68A" }} />
            ))}
          </div>
        </div>
      );
    default:
      return <div className={wrap} style={{ backgroundColor: "#F8FAFC" }} />;
  }
}

export function WidgetsCustomizePanel({
  open,
  onOpenChange,
  metrics,
  categories,
  kpiVisibleIds,
  onToggleKpi,
  onSetAllKpis,
  widgetDefs,
  widgetCategoryOrder,
  activeWidgets,
  onToggleWidget,
  onSetAllWidgets,
  widgetSizes,
  onWidgetSizeChange,
}: Props) {
  const [tab, setTab] = useState<"kpis" | "widgets">("kpis");
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      timeoutRef.current = setTimeout(() => setMounted(false), 280);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [open]);

  /* ── KPIs grouped by category ── */
  const kpiByCategory = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        items: metrics.filter(
          (m) => m.category === cat.id && (!q || m.label.toLowerCase().includes(q)),
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, metrics, searchQuery]);

  /* ── Widgets grouped by category (fixed order) ── */
  const widgetByCategory = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return widgetCategoryOrder
      .map((cat) => ({
        id: cat,
        items: widgetDefs.filter(
          (w) =>
            w.category === cat &&
            (!q ||
              w.label.toLowerCase().includes(q) ||
              w.description.toLowerCase().includes(q) ||
              w.category.toLowerCase().includes(q)),
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [widgetDefs, widgetCategoryOrder, searchQuery]);

  /* ── Tab-aware count + Enable All ── */
  const isKpis = tab === "kpis";
  const totalCount = isKpis ? metrics.length : widgetDefs.length;
  const activeCount = isKpis
    ? kpiVisibleIds.length
    : widgetDefs.filter((w) => activeWidgets.includes(w.key)).length;
  const allIds = isKpis ? metrics.map((m) => m.id) : widgetDefs.map((w) => w.key);
  const allActive = allIds.length > 0 && allIds.every((id) => (isKpis ? kpiVisibleIds : activeWidgets).includes(id));

  const handleEnableAll = () => {
    if (isKpis) {
      onSetAllKpis(allActive ? [] : [...allIds]);
    } else {
      onSetAllWidgets(allActive ? [] : [...allIds]);
    }
  };

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
        style={{ transform: visible ? "translateX(0)" : "translateX(100%)" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#EDF4FF" }}>
                <SlidersHorizontal className="w-5 h-5" style={{ color: "#007FFF" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                  Customize Widgets
                </h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Manage your dashboard KPIs and widgets.
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

          {/* Counter + Enable All */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px]" style={{ fontWeight: 500, color: "#94A3B8" }}>
              {activeCount} of {totalCount} {isKpis ? "KPIs" : "widgets"} active
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleEnableAll();
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
                <><ToggleRight className="w-4 h-4" style={{ color: "#007FFF" }} /><span>All On</span></>
              ) : activeCount === 0 ? (
                <><ToggleLeft className="w-4 h-4" /><span>All Off</span></>
              ) : (
                <><ToggleRight className="w-4 h-4" style={{ color: "#64748B" }} /><span>Enable All</span></>
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

        {/* Tab bar */}
        <div className="px-5 shrink-0 flex items-center gap-1 border-b" style={{ borderColor: "#F1F5F9" }}>
          {(["kpis", "widgets"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 -mb-px border-b-2 text-[13px] transition-colors cursor-pointer ${
                tab === t
                  ? "border-[#007FFF] text-[#007FFF]"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
              style={{ fontWeight: tab === t ? 600 : 500 }}
            >
              {t === "kpis" ? "KPIs" : "Widgets"}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {/* ── KPIs tab ── */}
          {isKpis && (
            <>
              {kpiByCategory.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground/60">No Metrics Found</p>
                </div>
              )}
              {kpiByCategory.map((cat) => (
                <div key={cat.id} className="mt-5 first:mt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span style={{ color: "#90A5BA" }}>{cat.icon}</span>
                    <span className="text-[12px] uppercase tracking-wide" style={{ fontWeight: 600, color: "#94A3B8" }}>
                      {cat.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.items.map((metric) => {
                      const active = kpiVisibleIds.includes(metric.id);
                      return (
                        <button
                          key={metric.id}
                          onClick={() => onToggleKpi(metric.id)}
                          className={`relative text-left rounded-[8px] border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                            active
                              ? "border-[#007FFF]/25 bg-[#007FFF]/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                              : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className="text-[11.5px] truncate transition-colors"
                              style={{ fontWeight: 500, color: active ? "#007FFF" : "#94A3B8" }}
                              title={metric.label}
                            >
                              {highlightMatch(metric.label, searchQuery)}
                            </span>
                            <div className="shrink-0">
                              {active ? (
                                <Check className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />
                              ) : (
                                <Plus className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
                              )}
                            </div>
                          </div>
                          <p className={`text-[15px] mt-1 ${active ? "text-foreground" : "text-foreground/80"}`} style={{ fontWeight: 550 }}>
                            {metric.value}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── Widgets tab ── */}
          {!isKpis && (
            <>
              {widgetByCategory.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground/60">No Widgets Found</p>
                </div>
              )}
              {widgetByCategory.map((cat) => {
                const CatIcon = WIDGET_CATEGORY_ICON[cat.id];
                return (
                  <div key={cat.id} className="mt-5 first:mt-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      {CatIcon && <CatIcon className="w-3.5 h-3.5" style={{ color: "#90A5BA" }} />}
                      <span className="text-[12px] uppercase tracking-wide" style={{ fontWeight: 600, color: "#94A3B8" }}>
                        {cat.id}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {cat.items.map((w) => {
                        const active = activeWidgets.includes(w.key);
                        const sz = widgetSizes[w.key] || "md";
                        return (
                          <div
                            key={w.key}
                            className={`relative text-left rounded-[10px] border p-2.5 transition-all duration-150 ${
                              active
                                ? "border-[#007FFF]/25 bg-[#007FFF]/[0.03] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                                : "border-border/60 bg-white hover:border-border hover:shadow-sm"
                            }`}
                          >
                            <button
                              onClick={() => onToggleWidget(w.key)}
                              className="w-full text-left cursor-pointer"
                            >
                              <div className="relative">
                                <WidgetVisual kind={w.visual} />
                                <div
                                  className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center ${
                                    active ? "bg-[#007FFF]" : "bg-white border border-[#E2E8F0]"
                                  }`}
                                >
                                  {active ? (
                                    <Check className="w-3 h-3 text-white" />
                                  ) : (
                                    <Plus className="w-3 h-3" style={{ color: "#94A3B8" }} />
                                  )}
                                </div>
                              </div>
                              <p className="text-[12.5px] mt-2 truncate" style={{ fontWeight: 600, color: active ? "#0F172A" : "#334155" }} title={w.label}>
                                {highlightMatch(w.label, searchQuery)}
                              </p>
                              <p className="text-[11px] mt-0.5 leading-snug line-clamp-2" style={{ color: "#94A3B8" }}>
                                {w.description}
                              </p>
                            </button>

                            {/* Size control — only for active widgets */}
                            {active && (
                              <div
                                className="mt-2 flex items-center h-6 rounded-md border bg-[#F8FAFC] p-0.5 gap-0.5"
                                style={{ borderColor: "#E2E8F0" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {(["sm", "md", "lg"] as const).map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onWidgetSizeChange(w.key, s);
                                    }}
                                    className={`flex-1 h-5 rounded text-[10px] transition-all duration-150 cursor-pointer ${
                                      sz === s ? "bg-white text-[#007FFF] shadow-sm" : "text-slate-400 hover:text-slate-700"
                                    }`}
                                    style={{ fontWeight: sz === s ? 600 : 500 }}
                                  >
                                    {s.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </>
  );
}
