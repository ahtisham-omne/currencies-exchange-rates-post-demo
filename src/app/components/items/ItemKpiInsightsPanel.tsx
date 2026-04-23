import { useState, useMemo, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import {
  Search,
  ChartColumn,
  Package,
  Boxes,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Factory,
  Tag,
  Layers,
  X,
  Check,
  Plus,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Globe,
  Clock,
  DollarSign,
  Users,
  ShoppingCart,
} from "lucide-react";
import type { Item } from "../../context/ItemsContext";

/* ─── KPI definition type ─── */
export interface ItemKpiDefinition {
  key: string;
  label: string;
  category: string;
  iconName: string;
  iconBg: string;
  iconColor: string;
  subtitle: string;
  tooltip?: string;
}

/* ─── All available KPI definitions for inventory items ─── */
export const ALL_ITEM_KPI_DEFINITIONS: ItemKpiDefinition[] = [
  // Inventory Overview
  {
    key: "total_items",
    label: "Total Items",
    category: "Inventory Overview",
    iconName: "Package",
    iconBg: "#EDF4FF",
    iconColor: "#0A77FF",
    subtitle: "All items in catalog",
  },
  {
    key: "total_on_hand",
    label: "Total On Hand",
    category: "Inventory Overview",
    iconName: "Boxes",
    iconBg: "#F0FDF4",
    iconColor: "#16A34A",
    subtitle: "Aggregate quantity",
    tooltip: "Sum of on-hand quantity across every item, regardless of unit. Use as a rough volume indicator.",
  },
  {
    key: "in_stock_count",
    label: "In Stock",
    category: "Inventory Overview",
    iconName: "CheckCircle2",
    iconBg: "#ECFDF5",
    iconColor: "#059669",
    subtitle: "Items currently in stock",
  },
  // Stock Health
  {
    key: "low_stock_count",
    label: "Low Stock",
    category: "Stock Health",
    iconName: "AlertTriangle",
    iconBg: "#FFFBEB",
    iconColor: "#D97706",
    subtitle: "Items below reorder",
    tooltip: "Items flagged Low Stock. Refill soon to avoid stockouts.",
  },
  {
    key: "out_of_stock_count",
    label: "Out of Stock",
    category: "Stock Health",
    iconName: "XCircle",
    iconBg: "#FEF2F2",
    iconColor: "#DC2626",
    subtitle: "Items at zero",
    tooltip: "Items with on-hand quantity at zero. Reorder priority.",
  },
  // Catalog Composition
  {
    key: "total_manufacturers",
    label: "Manufacturers",
    category: "Catalog Composition",
    iconName: "Factory",
    iconBg: "#F5F3FF",
    iconColor: "#7C3AED",
    subtitle: "Unique manufacturers",
  },
  {
    key: "total_categories",
    label: "Categories",
    category: "Catalog Composition",
    iconName: "Tag",
    iconBg: "#FFF7ED",
    iconColor: "#EA580C",
    subtitle: "Primary categories",
  },
  {
    key: "serialized_count",
    label: "Serialized Items",
    category: "Catalog Composition",
    iconName: "Layers",
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    subtitle: "Tracked by serial",
  },
];

/* Default active KPIs — 4-card pattern matching Partners' default density */
export const DEFAULT_ACTIVE_ITEM_KPIS = [
  "total_items",
  "in_stock_count",
  "low_stock_count",
  "out_of_stock_count",
];

/* ─── Compute KPI value from items data ─── */
export function computeItemKpiValue(key: string, items: Item[]): string {
  const formatCompact = (val: number): string => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return String(val);
  };

  switch (key) {
    case "total_items":
      return String(items.length);
    case "total_on_hand":
      return formatCompact(items.reduce((s, i) => s + (i.onHandQty || 0), 0));
    case "in_stock_count":
      return String(items.filter((i) => i.status === "In Stock").length);
    case "low_stock_count":
      return String(items.filter((i) => i.status === "Low Stock").length);
    case "out_of_stock_count":
      return String(items.filter((i) => i.status === "Out of Stock").length);
    case "total_manufacturers": {
      const set = new Set<string>();
      items.forEach((i) => i.manufacturer && set.add(i.manufacturer));
      return String(set.size);
    }
    case "total_categories": {
      const set = new Set<string>();
      items.forEach((i) => i.primaryCategory && set.add(i.primaryCategory));
      return String(set.size);
    }
    case "serialized_count":
      return String(items.filter((i) => i.inventoryControlType === "Serialized").length);
    default:
      return "–";
  }
}

/* ─── Icon mapper ─── */
export function ItemKpiIcon({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  const props = { className, style };
  switch (name) {
    case "Package": return <Package {...props} />;
    case "Boxes": return <Boxes {...props} />;
    case "CheckCircle2": return <CheckCircle2 {...props} />;
    case "AlertTriangle": return <AlertTriangle {...props} />;
    case "XCircle": return <XCircle {...props} />;
    case "Factory": return <Factory {...props} />;
    case "Tag": return <Tag {...props} />;
    case "Layers": return <Layers {...props} />;
    default: return <ChartColumn {...props} />;
  }
}

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "Inventory Overview": return <Package className="w-4 h-4 text-muted-foreground" />;
    case "Stock Health": return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    case "Catalog Composition": return <Layers className="w-4 h-4 text-muted-foreground" />;
    default: return <ChartColumn className="w-4 h-4 text-muted-foreground" />;
  }
}

/* ─── Customize Drawer ─── */
interface ItemKpiInsightsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  items: Item[];
}

export function ItemKpiInsightsPanel({
  open,
  onOpenChange,
  activeKpis,
  onToggleKpi,
  items,
}: ItemKpiInsightsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const categories = useMemo(() => {
    const cats: { name: string; kpis: ItemKpiDefinition[] }[] = [];
    const catMap = new Map<string, ItemKpiDefinition[]>();
    for (const kpi of ALL_ITEM_KPI_DEFINITIONS) {
      const matchesSearch =
        !searchQuery ||
        kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kpi.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (matchesSearch) {
        if (!catMap.has(kpi.category)) catMap.set(kpi.category, []);
        catMap.get(kpi.category)!.push(kpi);
      }
    }
    catMap.forEach((kpis, name) => cats.push({ name, kpis }));
    return cats;
  }, [searchQuery]);

  const activeCount = activeKpis.length;

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
        className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: visible ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#EDF4FF" }}
              >
                <Sliders className="w-5 h-5" style={{ color: "#0A77FF" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                  Customize Widgets
                </h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Manage your inventory KPI widgets.
                </p>
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
              {activeCount} of {ALL_ITEM_KPI_DEFINITIONS.length} widgets active
            </span>
            <button
              onClick={() => {
                const allKeys = ALL_ITEM_KPI_DEFINITIONS.map((k) => k.key);
                const allActive = allKeys.every((k) => activeKpis.includes(k));
                if (allActive) {
                  activeKpis.forEach((k) => onToggleKpi(k));
                } else {
                  allKeys.filter((k) => !activeKpis.includes(k)).forEach((k) => onToggleKpi(k));
                }
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                ALL_ITEM_KPI_DEFINITIONS.every((k) => activeKpis.includes(k.key))
                  ? "bg-[#EBF3FF] border-[#0A77FF]/25 text-[#0A77FF] hover:bg-[#DCEAFF] hover:border-[#0A77FF]/40 shadow-sm shadow-[#0A77FF]/10"
                  : activeKpis.length === 0
                  ? "bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8] hover:bg-[#F1F5F9] hover:border-[#CBD5E1] hover:text-[#64748B]"
                  : "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-[#EBF3FF] hover:border-[#0A77FF]/25 hover:text-[#0A77FF]"
              }`}
              style={{ fontWeight: 600 }}
            >
              {ALL_ITEM_KPI_DEFINITIONS.every((k) => activeKpis.includes(k.key)) ? (
                <>
                  <ToggleRight className="w-4 h-4 text-[#0A77FF]" />
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

        <div className="border-b border-[#F1F5F9] mt-3 shrink-0" />

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {categories.length === 0 && (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground/60">No metrics found</p>
            </div>
          )}

          {categories.map((cat) => (
            <div key={cat.name} className="mt-5 first:mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <CategoryIcon category={cat.name} />
                <span
                  className="text-[12px] text-muted-foreground/70 uppercase tracking-wide"
                  style={{ fontWeight: 600 }}
                >
                  {cat.name}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {cat.kpis.map((kpi) => {
                  const isActive = activeKpis.includes(kpi.key);
                  const value = computeItemKpiValue(kpi.key, items);
                  return (
                    <button
                      key={kpi.key}
                      onClick={() => onToggleKpi(kpi.key)}
                      className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                        isActive
                          ? "border-[#0A77FF]/25 bg-[#0A77FF]/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                          : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[11.5px] truncate transition-colors ${
                            isActive ? "text-[#0A77FF]" : "text-muted-foreground/70"
                          }`}
                          style={{ fontWeight: 500 }}
                          title={kpi.label}
                        >
                          {kpi.label}
                        </span>
                        <div className="shrink-0">
                          {isActive ? (
                            <Check className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />
                          )}
                        </div>
                      </div>
                      <p
                        className={`text-[15px] mt-1 transition-colors ${
                          isActive ? "text-foreground" : "text-foreground/80"
                        }`}
                        style={{ fontWeight: 550 }}
                      >
                        {value}
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
