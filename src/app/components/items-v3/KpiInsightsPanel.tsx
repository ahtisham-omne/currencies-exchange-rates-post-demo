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
  Layers,
  Tag,
  ArchiveRestore,
  ShoppingCart,
  Wrench,
  X,
  Check,
  Plus,
  ToggleLeft,
  ToggleRight,
  Sliders,
  CircleCheck,
  CircleSlash,
  Lock,
  Factory,
  Layers3,
  UserPlus,
} from "lucide-react";
import type { Item } from "../../context/ItemsContext";

/* ─── KPI definition type ─── */
export interface KpiDefinition {
  key: string;
  label: string;
  category: string;
  iconName: string;
  iconBg: string;
  iconColor: string;
  subtitle: string;
  tooltip?: string;
}

/* ─── Listing KPI catalog — the only five listing widgets (Lifecycle / Inventory) ─── */
export const ALL_KPI_DEFINITIONS: KpiDefinition[] = [
  {
    key: "total_items",
    label: "Total Items",
    category: "Lifecycle",
    iconName: "Package",
    iconBg: "#EDF4FF",
    iconColor: "#0A77FF",
    subtitle: "All items in catalog",
  },
  {
    key: "items_on_order",
    label: "Items on Order",
    category: "Inventory",
    iconName: "ShoppingCart",
    iconBg: "#EFF6FF",
    iconColor: "#1E40AF",
    subtitle: "Inbound on open POs",
    tooltip: "Distinct items with quantity on open purchase orders awaiting receipt.",
  },
  {
    key: "serialized_items",
    label: "Serialized Items",
    category: "Inventory",
    iconName: "Layers",
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    subtitle: "Tracked by serial",
  },
  {
    key: "lot_controlled_items",
    label: "Lot-Controlled Items",
    category: "Inventory",
    iconName: "Lock",
    iconBg: "#FFF7ED",
    iconColor: "#C2410C",
    subtitle: "Tracked by lot number",
  },
  {
    key: "inactive_with_stock",
    label: "Inactive with Stock",
    category: "Lifecycle",
    iconName: "AlertTriangle",
    iconBg: "#FEF3C7",
    iconColor: "#B45309",
    subtitle: "Retired but still holding stock",
    tooltip: "Items marked Inactive that still carry on-hand quantity — candidates to consume, transfer, or write off before archiving.",
  },
];

/* Default active KPIs — four shown by default, in listed order. "Inactive with
   Stock" stays in the catalog but is off by default; users opt into it from the
   Insights panel. */
export const DEFAULT_ACTIVE_KPIS = [
  "total_items",
  "items_on_order",
  "serialized_items",
  "lot_controlled_items",
];

/* ─── Compute KPI value from items data ─── */
export function computeKpiValue(key: string, items: Item[]): string {
  switch (key) {
    case "total_items":
      return String(items.length);
    case "items_on_order":
      return String(items.filter((i) => (i.onOrderQty ?? 0) > 0).length);
    case "serialized_items":
      return String(items.filter((i) => i.inventoryControlType === "Serialized").length);
    case "lot_controlled_items":
      return String(items.filter((i) => i.lotControl).length);
    case "inactive_with_stock":
      return String(items.filter((i) => i.status === "Inactive" && (i.onHandQty ?? 0) > 0).length);
    default:
      return "–";
  }
}

/* ─── Icon mapper ─── */
function KpiIcon({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  const props = { className, style };
  switch (name) {
    case "Package": return <Package {...props} />;
    case "Boxes": return <Boxes {...props} />;
    case "CheckCircle2": return <CheckCircle2 {...props} />;
    case "AlertTriangle": return <AlertTriangle {...props} />;
    case "XCircle": return <XCircle {...props} />;
    case "Layers": return <Layers {...props} />;
    case "Tag": return <Tag {...props} />;
    case "ArchiveRestore": return <ArchiveRestore {...props} />;
    case "ShoppingCart": return <ShoppingCart {...props} />;
    case "Wrench": return <Wrench {...props} />;
    case "CircleCheck": return <CircleCheck {...props} />;
    case "CircleSlash": return <CircleSlash {...props} />;
    case "Lock": return <Lock {...props} />;
    case "Factory": return <Factory {...props} />;
    case "Layers3": return <Layers3 {...props} />;
    case "UserPlus": return <UserPlus {...props} />;
    default: return <ChartColumn {...props} />;
  }
}

/* Category icon mapper */
function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "Lifecycle": return <CircleCheck className="w-4 h-4 text-muted-foreground" />;
    case "Inventory": return <Boxes className="w-4 h-4 text-muted-foreground" />;
    case "Inventory Composition": return <Layers className="w-4 h-4 text-muted-foreground" />;
    case "Catalog Composition": return <Layers className="w-4 h-4 text-muted-foreground" />;
    case "Activity": return <UserPlus className="w-4 h-4 text-muted-foreground" />;
    default: return <ChartColumn className="w-4 h-4 text-muted-foreground" />;
  }
}

/* ─── KPI Insights Panel Component ─── */
interface KpiInsightsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  items: Item[];
}

export function KpiInsightsPanel({
  open,
  onOpenChange,
  activeKpis,
  onToggleKpi,
  items,
}: KpiInsightsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const categories = useMemo(() => {
    const cats: { name: string; kpis: KpiDefinition[] }[] = [];
    const catMap = new Map<string, KpiDefinition[]>();

    for (const kpi of ALL_KPI_DEFINITIONS) {
      const matchesSearch =
        !searchQuery ||
        kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kpi.category.toLowerCase().includes(searchQuery.toLowerCase());

      if (matchesSearch) {
        if (!catMap.has(kpi.category)) {
          catMap.set(kpi.category, []);
        }
        catMap.get(kpi.category)!.push(kpi);
      }
    }

    catMap.forEach((kpis, name) => {
      cats.push({ name, kpis });
    });

    return cats;
  }, [searchQuery]);

  const activeCount = activeKpis.length;

  /* Smooth mount/unmount with CSS transitions */
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
          {/* Toggle all widgets */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeCount} of {ALL_KPI_DEFINITIONS.length} widgets active
            </span>
            <button
              onClick={() => {
                const allKeys = ALL_KPI_DEFINITIONS.map(k => k.key);
                const allActive = allKeys.every(k => activeKpis.includes(k));
                if (allActive) {
                  activeKpis.forEach(k => onToggleKpi(k));
                } else {
                  allKeys.filter(k => !activeKpis.includes(k)).forEach(k => onToggleKpi(k));
                }
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                ALL_KPI_DEFINITIONS.every(k => activeKpis.includes(k.key))
                  ? "bg-[#EBF3FF] border-[#0A77FF]/25 text-[#0A77FF] hover:bg-[#DCEAFF] hover:border-[#0A77FF]/40 shadow-sm shadow-[#0A77FF]/10"
                  : activeKpis.length === 0
                  ? "bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8] hover:bg-[#F1F5F9] hover:border-[#CBD5E1] hover:text-[#64748B]"
                  : "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-[#EBF3FF] hover:border-[#0A77FF]/25 hover:text-[#0A77FF]"
              }`}
              style={{ fontWeight: 600 }}
            >
              {ALL_KPI_DEFINITIONS.every(k => activeKpis.includes(k.key)) ? (
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

        <div className="border-b border-[#F1F5F9] mt-3 shrink-0" />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
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
                  const value = computeKpiValue(kpi.key, items);

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

export { KpiIcon };
