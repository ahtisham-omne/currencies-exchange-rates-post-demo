// Right-side drawer with two tabs (KPIs / Widgets), search, category sections,
// and toggle cards with mini visual previews. Lifted literally from Partners'
// `DashboardCustomizePanel` and adapted to Items' KPI/widget catalog.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, X, Check, Plus, Sliders, ToggleLeft, ToggleRight,
  DollarSign, Globe, BarChart3, Activity, FileText, Boxes,
} from "lucide-react";
import {
  ITEM_DASH_KPI_DEFS,
  computeItemDashKpiValue,
  type ItemDashKpiCategory,
} from "./ItemDashKpis";

// ── Items' widget catalog for the customize drawer (mirrors Partners' shape) ──
export type ItemWidgetVisualType =
  | "list" | "donut" | "bars" | "line" | "contact" | "text";
export type ItemWidgetCategory = "Inventory" | "Performance" | "Operational" | "People & Docs";

export interface ItemWidgetDef {
  key: string;
  label: string;
  type: ItemWidgetVisualType;
  description: string;
  category: ItemWidgetCategory;
}

/** Items-native widget catalog. Keys match the legacy `ALL_WIDGETS` ids in
 *  `ItemDetail.tsx` so toggling stays wired to the existing render functions. */
export const ITEM_WIDGET_DEFS: ItemWidgetDef[] = [
  { key: "widget-stock-health",   label: "Stock Health",                type: "line",    description: "Semi-circle gauge: current vs Min/Max thresholds", category: "Inventory" },
  { key: "widget-uom",            label: "On-Hand by Unit of Measure",  type: "donut",   description: "Donut breakdown of stock per unit of measure",     category: "Inventory" },
  { key: "widget-locations",      label: "Location Distribution",       type: "bars",    description: "Top locations by on-hand quantity",                category: "Inventory" },
  { key: "widget-top-customers",  label: "Top Customers",               type: "bars",    description: "Highest-volume customers for this item",           category: "Performance" },
  { key: "widget-primary-vendor", label: "Primary Vendor",              type: "contact", description: "Default supplier card with key metrics",           category: "People & Docs" },
  { key: "widget-activity",       label: "Transaction Activity",        type: "list",    description: "Daily Increase vs Decrease bar chart",             category: "Operational" },
];

export const ITEM_WIDGET_CATEGORY_ORDER: ItemWidgetCategory[] = [
  "Inventory", "Performance", "Operational", "People & Docs",
];

/** Pastel mini visual matching Partners' drawer treatment. */
function ItemWidgetVisual({ type, isActive }: { type: ItemWidgetVisualType; isActive: boolean }) {
  const C = {
    blue:   isActive ? "#93C5FD" : "hsl(var(--border))",
    orange: isActive ? "#FDBA74" : "hsl(var(--border))",
    purple: isActive ? "#C4B5FD" : "hsl(var(--border))",
    green:  isActive ? "#86EFAC" : "hsl(var(--border))",
    slate:  isActive ? "#CBD5E1" : "hsl(var(--border))",
    lineFg: isActive ? "#93C5FD" : "#CBD5E1",
  };
  if (type === "list") {
    const dots = [C.blue, C.orange, C.green];
    return (
      <div className="flex flex-col gap-1.5 w-full px-3.5">
        {[82, 64, 72].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dots[i] }} />
            <div className="h-1.5 rounded-sm" style={{ width: `${w}%`, backgroundColor: C.slate }} />
          </div>
        ))}
      </div>
    );
  }
  if (type === "donut") {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="16" stroke={C.orange} strokeWidth="6" strokeDasharray="30 100" transform="rotate(-90 22 22)" />
        <circle cx="22" cy="22" r="16" stroke={C.purple} strokeWidth="6" strokeDasharray="25 100" strokeDashoffset="-30" transform="rotate(-90 22 22)" />
        <circle cx="22" cy="22" r="16" stroke={C.green} strokeWidth="6" strokeDasharray="25 100" strokeDashoffset="-55" transform="rotate(-90 22 22)" />
        <circle cx="22" cy="22" r="16" stroke={C.blue} strokeWidth="6" strokeDasharray="20 100" strokeDashoffset="-80" transform="rotate(-90 22 22)" />
      </svg>
    );
  }
  if (type === "bars") {
    const rows = [
      [{ w: 50, c: C.orange }, { w: 25, c: C.green }, { w: 15, c: C.purple }],
      [{ w: 35, c: C.orange }, { w: 30, c: C.green }, { w: 20, c: C.purple }],
      [{ w: 45, c: C.orange }, { w: 20, c: C.green }, { w: 25, c: C.purple }],
    ];
    return (
      <div className="flex flex-col gap-1.5 w-full px-3">
        {rows.map((row, i) => (
          <div key={i} className="flex h-1.5 gap-px">
            {row.map((seg, j) => (
              <div key={j} className="rounded-sm" style={{ width: `${seg.w}%`, backgroundColor: seg.c }} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (type === "contact") {
    return (
      <div className="flex items-center gap-2 w-full px-3">
        <div className="w-7 h-7 rounded-full shrink-0" style={{ backgroundColor: C.blue }} />
        <div className="flex flex-col gap-1 flex-1">
          <div className="h-1.5 rounded-sm" style={{ width: "70%", backgroundColor: C.slate }} />
          <div className="h-1.5 rounded-sm" style={{ width: "50%", backgroundColor: C.slate, opacity: 0.7 }} />
        </div>
      </div>
    );
  }
  if (type === "line") {
    return (
      <svg width="80%" height="34" viewBox="0 0 80 32" fill="none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g-line-item" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.lineFg} stopOpacity="0.45" />
            <stop offset="100%" stopColor={C.lineFg} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M2 26 L 12 22 L 22 24 L 32 18 L 42 14 L 52 16 L 62 10 L 72 8 L 78 6 L 78 30 L 2 30 Z" fill="url(#g-line-item)" />
        <path d="M2 26 L 12 22 L 22 24 L 32 18 L 42 14 L 52 16 L 62 10 L 72 8 L 78 6" stroke={C.lineFg} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  // text
  return (
    <div className="flex flex-col gap-1.5 w-full px-4">
      {[92, 78, 86, 60].map((w, i) => (
        <div key={i} className="h-1.5 rounded-sm" style={{ width: `${w}%`, backgroundColor: C.slate, opacity: i === 0 ? 1 : 0.65 }} />
      ))}
    </div>
  );
}

const CAT_ICON: Record<ItemDashKpiCategory, React.ComponentType<{ className?: string }>> = {
  Inventory:   Boxes,
  Financial:   DollarSign,
  Operational: Globe,
};

const WIDGET_CAT_ICON: Record<ItemWidgetCategory, React.ComponentType<{ className?: string }>> = {
  Inventory:       Boxes,
  Performance:     BarChart3,
  Operational:     Activity,
  "People & Docs": FileText,
};

interface ItemDashCustomizePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  activeWidgets: string[];
  onToggleWidget: (key: string) => void;
  item: any;
}

export function ItemDashCustomizePanel({
  open, onOpenChange,
  activeKpis, onToggleKpi,
  activeWidgets, onToggleWidget,
  item,
}: ItemDashCustomizePanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [panelTab, setPanelTab] = useState<"kpis" | "widgets">("kpis");
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
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [open]);

  const kpiCategories = useMemo(() => {
    const catMap = new Map<ItemDashKpiCategory, typeof ITEM_DASH_KPI_DEFS>();
    for (const kpi of ITEM_DASH_KPI_DEFS) {
      const q = searchQuery.toLowerCase();
      if (!q || kpi.label.toLowerCase().includes(q) || kpi.category.toLowerCase().includes(q)) {
        if (!catMap.has(kpi.category)) catMap.set(kpi.category, []);
        catMap.get(kpi.category)!.push(kpi);
      }
    }
    return Array.from(catMap, ([name, kpis]) => ({ name, kpis }));
  }, [searchQuery]);

  if (!mounted) return null;

  const allKpiKeys = ITEM_DASH_KPI_DEFS.map(k => k.key);
  const allKpisActive = allKpiKeys.every(k => activeKpis.includes(k));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{
          backgroundColor: visible ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0)",
          pointerEvents: visible ? "auto" : "none",
        }}
        onClick={() => onOpenChange(false)}
      />
      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: visible ? "translateX(0)" : "translateX(100%)" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "hsl(var(--accent))" }}
              >
                <Sliders className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Customize Widgets</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">Manage your dashboard KPI widgets.</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeKpis.length} of {ITEM_DASH_KPI_DEFS.length} KPIs active
            </span>
            <button
              onClick={() => {
                if (allKpisActive) {
                  activeKpis.forEach(k => onToggleKpi(k));
                } else {
                  allKpiKeys.filter(k => !activeKpis.includes(k)).forEach(k => onToggleKpi(k));
                }
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                allKpisActive
                  ? "bg-[hsl(var(--accent))] border-primary/25 text-primary hover:border-primary/40"
                  : activeKpis.length === 0
                  ? "bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500"
                  : "bg-slate-50 border-border text-slate-500 hover:bg-[hsl(var(--accent))] hover:border-primary/25 hover:text-primary"
              }`}
              style={{ fontWeight: 600 }}
            >
              {allKpisActive ? (
                <>
                  <ToggleRight className="w-4 h-4 text-primary" />
                  <span>All On</span>
                </>
              ) : activeKpis.length === 0 ? (
                <>
                  <ToggleLeft className="w-4 h-4" />
                  <span>All Off</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4" />
                  <span>Enable All</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-3.5 pb-0 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input
              placeholder="Search metrics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
            />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0 px-5 border-b border-muted shrink-0 mt-3">
          {(["kpis", "widgets"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPanelTab(t)}
              className={`px-4 py-2.5 border-b-2 text-[13px] transition-all duration-200 cursor-pointer whitespace-nowrap ${
                panelTab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
              style={{ fontWeight: panelTab === t ? 600 : 400 }}
            >
              {t === "kpis" ? "KPIs" : "Widgets"}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {panelTab === "kpis" ? (
            <>
              {kpiCategories.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground/60">No metrics found</p>
                </div>
              )}
              {kpiCategories.map((cat) => {
                const CatIcon = CAT_ICON[cat.name] ?? Globe;
                return (
                  <div key={cat.name} className="mt-5 first:mt-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CatIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[12px] text-muted-foreground/70 uppercase tracking-wide" style={{ fontWeight: 600 }}>{cat.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {cat.kpis.map((kpi) => {
                        const isActive = activeKpis.includes(kpi.key);
                        const computed = computeItemDashKpiValue(kpi.key, item);
                        return (
                          <button
                            key={kpi.key}
                            onClick={() => onToggleKpi(kpi.key)}
                            className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                              isActive
                                ? "border-primary/25 bg-primary/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                                : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-[11.5px] truncate transition-colors ${isActive ? "text-primary" : "text-muted-foreground/70"}`} style={{ fontWeight: 500 }} title={kpi.label}>{kpi.label}</span>
                              <div className="shrink-0">
                                {isActive
                                  ? <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
                                  : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />}
                              </div>
                            </div>
                            <p className={`text-[15px] mt-1 transition-colors ${isActive ? "text-foreground" : "text-foreground/80"}`} style={{ fontWeight: 600 }}>{computed.value}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            /* ── Widgets tab ── */
            <div className="mt-2">
              {ITEM_WIDGET_CATEGORY_ORDER.map((cat) => {
                const inCat = ITEM_WIDGET_DEFS.filter((w) => {
                  if (w.category !== cat) return false;
                  const q = searchQuery.toLowerCase();
                  return !q || w.label.toLowerCase().includes(q) || w.description.toLowerCase().includes(q);
                });
                if (inCat.length === 0) return null;
                const CatIcon = WIDGET_CAT_ICON[cat] ?? Sliders;
                return (
                  <div key={cat} className="mt-5 first:mt-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CatIcon className="w-3.5 h-3.5 text-muted-foreground/70" />
                      <span className="text-[12px] text-muted-foreground/70 uppercase tracking-wide" style={{ fontWeight: 600 }}>{cat}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {inCat.map((w) => {
                        const isActive = activeWidgets.includes(w.key);
                        return (
                          <button
                            key={w.key}
                            type="button"
                            onClick={() => onToggleWidget(w.key)}
                            className={`relative text-left rounded-xl border overflow-hidden transition-all duration-150 cursor-pointer group ${
                              isActive
                                ? "border-primary/30 bg-white shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                                : "border-border/60 bg-white hover:border-border hover:shadow-sm"
                            }`}
                          >
                            <div className={`h-[68px] flex items-center justify-center transition-colors ${isActive ? "bg-[hsl(var(--accent))]" : "bg-slate-50"}`}>
                              <ItemWidgetVisual type={w.type} isActive={isActive} />
                            </div>
                            <div className="absolute top-1.5 right-1.5">
                              {isActive ? (
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center group-hover:border-slate-300 transition-colors">
                                  <Plus className="w-3 h-3 text-slate-400" />
                                </div>
                              )}
                            </div>
                            <div className="px-3 py-2.5 border-t border-muted">
                              <p className="text-[12.5px] text-foreground truncate" style={{ fontWeight: 600 }} title={w.label}>{w.label}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug" title={w.description}>{w.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}