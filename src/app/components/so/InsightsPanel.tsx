import { useState, useMemo, useEffect, useRef } from "react";
import {
  X, Plus, Check, DollarSign, Globe, Zap, BarChart3, Users, Clock,
  AlertCircle, Package, Truck, Search, ToggleLeft, ToggleRight, ChartColumn,
  FileText, RefreshCw,
} from "lucide-react";

interface InsightMetric {
  label: string;
  value: string;
  active: boolean;
  trending?: "up" | "down" | "neutral";
  description?: string;
}

interface InsightCategory {
  id: string;
  title: string;
  icon: typeof DollarSign;
  metrics: InsightMetric[];
}

const INSIGHT_CATEGORIES: InsightCategory[] = [
  {
    id: "orders",
    title: "Order Status",
    icon: Globe,
    metrics: [
      { label: "Draft Orders", value: "16", active: false },
      { label: "Pending Review", value: "10", active: false, trending: "up", description: "Orders submitted for review but not yet approved." },
      { label: "Released", value: "3", active: false, description: "Orders reviewed and approved, ready for item allocation." },
      { label: "Partially Shipped", value: "5", active: false },
      { label: "Shipped Orders", value: "11", active: false },
      { label: "Cancelled Orders", value: "11", active: false },
      { label: "Total Orders", value: "60", active: true, trending: "up" },
    ],
  },
  {
    id: "revenue",
    title: "Revenue & Financial",
    icon: DollarSign,
    metrics: [
      { label: "Total Projected Revenue", value: "$4,422,135", active: true, trending: "up", description: "Cumulative value of all confirmed sales orders in the selected period. Represents order bookings, not invoiced revenue." },
      { label: "Average Order Value", value: "$73,702", active: false, trending: "up", description: "Average order value across all sales orders in the selected period." },
      { label: "Open Order Value", value: "$2,664,965", active: false, description: "Total monetary value of all sales orders that have not been fully shipped or closed yet." },
      { label: "Pipeline Value", value: "$3,891,420", active: true, description: "Total value of all active sales orders in the pipeline (excludes cancelled and archived)." },
      { label: "Released Value", value: "$1,245,680", active: true, description: "Total value of orders that have been released for fulfillment." },
    ],
  },
  {
    id: "operational",
    title: "Operational",
    icon: Zap,
    metrics: [
      { label: "Overdue Orders", value: "7", active: true, trending: "up", description: "Orders where at least one line item has passed its promised ship-by date and has not yet been shipped." },
      { label: "Ready to Ship", value: "3", active: true, description: "Orders that are fully allocated and packed, awaiting carrier pickup or shipment dispatch." },
      { label: "Avg. Days to Fulfill", value: "3.2 days", active: true, description: "Average number of days from Released to fully shipped, across all completed orders in the selected period." },
      { label: "High Priority Orders", value: "10", active: true, description: "Total number of orders currently marked with Critical priority status." },
      { label: "Order Fill Rate", value: "87%", active: false, description: "Percentage of order line items fully allocated from available inventory when auto-allocation was used." },
      { label: "Order Revisions", value: "12", active: false, description: "Count of active orders (excludes cancelled, shipped, and completed) revised at least once — line item changes, quantity adjustments, delivery date changes, or address updates." },
    ],
  },
];

export interface ActiveInsight { label: string; value: string; trending?: "up" | "down" | "neutral"; description?: string; }

/* Category icon for section headers */
function CategoryIcon({ catId }: { catId: string }) {
  const map: Record<string, typeof DollarSign> = {
    revenue: DollarSign, orders: Globe, operational: Zap, performance: BarChart3,
    sales: Users, time: Clock, exceptions: AlertCircle, inventory: Package, shipping: Truck,
  };
  const Icon = map[catId] || ChartColumn;
  return <Icon className="w-4 h-4 text-muted-foreground" />;
}

export function InsightsPanel({ open = true, onClose, onActiveChange }: { open?: boolean; onClose: () => void; onActiveChange?: (active: ActiveInsight[]) => void }) {
  const [categories, setCategories] = useState(INSIGHT_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState("");

  /* Count all metrics */
  const allMetrics = useMemo(() => categories.flatMap(c => c.metrics), [categories]);
  const activeCount = allMetrics.filter(m => m.active).length;
  const totalCount = allMetrics.length;
  const allActive = activeCount === totalCount;

  /* Filter by search */
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    const q = searchQuery.toLowerCase();
    return categories
      .map(c => ({
        ...c,
        metrics: c.metrics.filter(m =>
          m.label.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
        ),
      }))
      .filter(c => c.metrics.length > 0);
  }, [categories, searchQuery]);

  const toggleMetric = (catId: string, metricIdx: number) => {
    setCategories(prev => {
      const next = prev.map(c =>
        c.id === catId
          ? { ...c, metrics: c.metrics.map((m, i) => i === metricIdx ? { ...m, active: !m.active } : m) }
          : c
      );
      if (onActiveChange) {
        const active: ActiveInsight[] = [];
        next.forEach(c => c.metrics.forEach(m => { if (m.active) active.push({ label: m.label, value: m.value, trending: m.trending, description: m.description }); }));
        onActiveChange(active);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setCategories(prev => {
      const next = prev.map(c => ({
        ...c,
        metrics: c.metrics.map(m => ({ ...m, active: !allActive })),
      }));
      if (onActiveChange) {
        const active: ActiveInsight[] = [];
        next.forEach(c => c.metrics.forEach(m => { if (m.active) active.push({ label: m.label, value: m.value, trending: m.trending, description: m.description }); }));
        onActiveChange(active);
      }
      return next;
    });
  };

  /* Smooth mount/unmount */
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

  /* Tooltip state for descriptions */
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);

  if (!mounted) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{
          backgroundColor: visible ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0)",
          pointerEvents: visible ? "auto" : "none",
        }}
        onClick={handleClose}
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
                style={{ backgroundColor: "#EDF4FF" }}
              >
                <ChartColumn className="w-5 h-5" style={{ color: "#0A77FF" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                  Add Insights
                </h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Customize your dashboard with relevant metrics.
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Toggle all insights */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeCount} of {totalCount} insights active
            </span>
            <button
              onClick={toggleAll}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                allActive
                  ? "bg-[#EBF3FF] border-[#0A77FF]/25 text-[#0A77FF] hover:bg-[#DCEAFF] hover:border-[#0A77FF]/40 shadow-sm shadow-[#0A77FF]/10"
                  : activeCount === 0
                  ? "bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8] hover:bg-[#F1F5F9] hover:border-[#CBD5E1] hover:text-[#64748B]"
                  : "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-[#EBF3FF] hover:border-[#0A77FF]/25 hover:text-[#0A77FF]"
              }`}
              style={{ fontWeight: 600 }}
            >
              {allActive ? (
                <><ToggleRight className="w-4 h-4 text-[#0A77FF]" /><span>All On</span></>
              ) : activeCount === 0 ? (
                <><ToggleLeft className="w-4 h-4" /><span>All Off</span></>
              ) : (
                <><ToggleLeft className="w-4 h-4" /><span>Enable All</span></>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-3.5 pb-1 shrink-0">
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {filteredCategories.length === 0 && (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground/60">No metrics found</p>
            </div>
          )}

          {filteredCategories.map(cat => (
            <div key={cat.id} className="mt-5 first:mt-4">
              {/* Category Header */}
              <div className="flex items-center gap-1.5 mb-2">
                <CategoryIcon catId={cat.id} />
                <span
                  className="text-[12px] text-muted-foreground/70 uppercase tracking-wide"
                  style={{ fontWeight: 600 }}
                >
                  {cat.title}
                </span>
              </div>

              {/* KPI Cards Grid — 2 columns */}
              <div className="grid grid-cols-2 gap-2">
                {cat.metrics.map((metric, mi) => {
                  // Find original index to toggle correctly
                  const origCat = categories.find(c => c.id === cat.id);
                  const origIdx = origCat?.metrics.findIndex(m => m.label === metric.label) ?? mi;

                  return (
                    <div key={metric.label} className="relative">
                      <button
                        onClick={() => toggleMetric(cat.id, origIdx)}
                        onMouseEnter={() => metric.description ? setHoveredMetric(metric.label) : undefined}
                        onMouseLeave={() => setHoveredMetric(null)}
                        className={`relative w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                          metric.active
                            ? "border-[#0A77FF]/25 bg-[#0A77FF]/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                            : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                        }`}
                      >
                        {/* Top row: label + toggle icon */}
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-[11.5px] truncate transition-colors ${
                              metric.active ? "text-[#0A77FF]" : "text-muted-foreground/70"
                            }`}
                            style={{ fontWeight: 500 }}
                            title={metric.label}
                          >
                            {metric.label}
                          </span>
                          <div className="shrink-0">
                            {metric.active ? (
                              <Check className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
                            ) : (
                              <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />
                            )}
                          </div>
                        </div>

                        {/* Value */}
                        <p
                          className={`text-[15px] mt-1 transition-colors ${
                            metric.active ? "text-foreground" : "text-foreground/80"
                          }`}
                          style={{ fontWeight: 550 }}
                        >
                          {metric.value}
                        </p>
                      </button>

                    </div>
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
