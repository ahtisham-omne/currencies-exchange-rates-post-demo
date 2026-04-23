// @ts-nocheck
// Sales KPI customize drawer — sibling to ItemDashCustomizePanel, KPI-only
// (no widgets tab). Same Partners-literal shell, search, category sections,
// and toggle cards. Catalog swapped to SALES_KPI_DEFS.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, X, Check, Plus, Sliders, ToggleLeft, ToggleRight,
  DollarSign, ShoppingCart, Users, Globe,
} from "lucide-react";
import {
  SALES_KPI_DEFS,
  SALES_KPI_CATEGORY_ORDER,
  computeSalesKpiValue,
  type SalesKpiCategory,
} from "./SalesKpis";

const CAT_ICON: Record<SalesKpiCategory, React.ComponentType<{ className?: string }>> = {
  Revenue:   DollarSign,
  Orders:    ShoppingCart,
  Customers: Users,
};

interface SalesCustomizePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
}

export function SalesCustomizePanel({
  open, onOpenChange, activeKpis, onToggleKpi,
}: SalesCustomizePanelProps) {
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
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [open]);

  const kpiCategories = useMemo(() => {
    const catMap = new Map<SalesKpiCategory, typeof SALES_KPI_DEFS>();
    for (const cat of SALES_KPI_CATEGORY_ORDER) catMap.set(cat, []);
    for (const kpi of SALES_KPI_DEFS) {
      const q = searchQuery.toLowerCase();
      if (!q || kpi.label.toLowerCase().includes(q) || kpi.category.toLowerCase().includes(q)) {
        catMap.get(kpi.category)!.push(kpi);
      }
    }
    return Array.from(catMap, ([name, kpis]) => ({ name, kpis })).filter((c) => c.kpis.length > 0);
  }, [searchQuery]);

  if (!mounted) return null;

  const allKpiKeys = SALES_KPI_DEFS.map(k => k.key);
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
                <p className="text-[13px] text-muted-foreground mt-0.5">Manage your Sales KPI widgets.</p>
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
              {activeKpis.length} of {SALES_KPI_DEFS.length} KPIs active
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
        <div className="px-5 pt-3.5 pb-3 shrink-0">
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

        {/* Scrollable content — KPIs only (no widgets tab on Sales) */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 border-t border-muted">
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
                    const computed = computeSalesKpiValue(kpi.key);
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
        </div>
      </div>
    </>
  );
}
