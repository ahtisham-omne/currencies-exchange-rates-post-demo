import { useState, useMemo, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import {
  Search,
  ChartColumn,
  TrendingUp,
  Users,
  UserCheck,
  Clock,
  UserX,
  ArchiveRestore,
  DollarSign,
  CreditCard,
  Percent,
  ShoppingCart,
  Wallet,
  Star,
  Building2,
  Package,
  X,
  Check,
  Plus,
  Globe,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type { Vendor } from "../../data/vendors";

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

/* ─── All available KPI definitions ─── */
export const ALL_KPI_DEFINITIONS: KpiDefinition[] = [
  // Partner Overview
  {
    key: "total_partners",
    label: "Total Partners",
    category: "Partner Overview",
    iconName: "Users",
    iconBg: "#EDF4FF",
    iconColor: "#0A77FF",
    subtitle: "All partners in system",
  },
  {
    key: "total_vendors",
    label: "Total Vendors",
    category: "Partner Overview",
    iconName: "Building2",
    iconBg: "#F0FDF4",
    iconColor: "#16A34A",
    subtitle: "Vendor-type partners",
  },
  {
    key: "total_customers",
    label: "Total Customers",
    category: "Partner Overview",
    iconName: "ShoppingCart",
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    subtitle: "Customer-type partners",
  },
  // Financial
  {
    key: "total_credit_limit",
    label: "Total Credit Limit",
    category: "Financial",
    iconName: "TrendingUp",
    iconBg: "#EDF4FF",
    iconColor: "#0A77FF",
    subtitle: "Total credit exposure",
    tooltip: "The combined credit limit across all active partners. Represents total credit exposure your organization has extended.",
  },
  {
    key: "avg_credit_limit",
    label: "Avg Credit Limit",
    category: "Financial",
    iconName: "CreditCard",
    iconBg: "#F5F3FF",
    iconColor: "#7C3AED",
    subtitle: "Average per partner",
    tooltip: "Total credit limit divided by number of partners. Helps benchmark individual credit allocations against the portfolio average.",
  },
  {
    key: "total_credit_utilization",
    label: "Credit Utilization",
    category: "Financial",
    iconName: "Percent",
    iconBg: "#FFF7ED",
    iconColor: "#EA580C",
    subtitle: "Total utilization amount",
    tooltip: "Sum of all credit currently being used across partners. A high utilization relative to the total limit may indicate elevated risk.",
  },
  {
    key: "total_outstanding",
    label: "Outstanding Balance",
    category: "Financial",
    iconName: "Wallet",
    iconBg: "#FEF2F2",
    iconColor: "#DC2626",
    subtitle: "Total outstanding",
    tooltip: "Total unpaid balance across all partners. Includes invoices pending payment, overdue amounts, and scheduled disbursements.",
  },
  {
    key: "total_spent",
    label: "Total Spent",
    category: "Financial",
    iconName: "DollarSign",
    iconBg: "#F0FDF4",
    iconColor: "#16A34A",
    subtitle: "Across all partners",
  },
  {
    key: "avg_net_profit",
    label: "Avg Net Margin",
    category: "Financial",
    iconName: "TrendingUp",
    iconBg: "#ECFDF5",
    iconColor: "#059669",
    subtitle: "Average profit margin",
    tooltip: "Average net profit margin calculated across all partner transactions. Factors in revenue, cost of goods, and operational expenses per partner.",
  },
  // Status
  {
    key: "active_partners",
    label: "Active Partners",
    category: "Status",
    iconName: "UserCheck",
    iconBg: "#F0FDF4",
    iconColor: "#16A34A",
    subtitle: "Currently active",
  },
  {
    key: "inactive_partners",
    label: "Inactive Partners",
    category: "Status",
    iconName: "UserX",
    iconBg: "#F1F5F9",
    iconColor: "#64748B",
    subtitle: "Currently inactive",
  },
  {
    key: "archived_partners",
    label: "Archived Partners",
    category: "Status",
    iconName: "ArchiveRestore",
    iconBg: "#F8FAFC",
    iconColor: "#475569",
    subtitle: "In archive",
  },
  // Operational
  {
    key: "total_orders",
    label: "Total Orders",
    category: "Operational",
    iconName: "Package",
    iconBg: "#EDF4FF",
    iconColor: "#0A77FF",
    subtitle: "All partner orders",
  },
  {
    key: "avg_rating",
    label: "Avg Rating",
    category: "Operational",
    iconName: "Star",
    iconBg: "#FFFBEB",
    iconColor: "#D97706",
    subtitle: "Average partner rating",
    tooltip: "Weighted average of all partner performance ratings. Based on delivery reliability, quality, communication, and compliance scores.",
  },
];

/* Default active KPIs */
export const DEFAULT_ACTIVE_KPIS = [
  "total_credit_limit",
  "total_partners",
  "active_partners",
];

/* ─── Compute KPI value from vendors data ─── */
export function computeKpiValue(key: string, vendors: Vendor[]): string {
  const formatCompact = (val: number): string => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  switch (key) {
    case "total_partners":
      return String(vendors.length);
    case "total_vendors":
      return String(vendors.filter((v) => v.partnerTypes?.includes("vendor")).length);
    case "total_customers":
      return String(vendors.filter((v) => v.partnerTypes?.includes("customer")).length);
    case "total_credit_limit":
      return formatCompact(vendors.reduce((s, v) => s + (v.creditLimit || 0), 0));
    case "avg_credit_limit": {
      const total = vendors.reduce((s, v) => s + (v.creditLimit || 0), 0);
      return formatCompact(vendors.length > 0 ? total / vendors.length : 0);
    }
    case "total_credit_utilization":
      return formatCompact(vendors.reduce((s, v) => s + (v.creditUtilization || 0), 0));
    case "total_outstanding":
      return formatCompact(vendors.reduce((s, v) => s + (v.outstandingBalance || 0), 0));
    case "total_spent":
      return formatCompact(vendors.reduce((s, v) => s + (v.totalSpent || 0), 0));
    case "avg_net_profit": {
      const total = vendors.reduce((s, v) => s + (v.netProfitMargin || 0), 0);
      return vendors.length > 0 ? `${(total / vendors.length).toFixed(1)}%` : "0%";
    }
    case "active_partners":
      return String(vendors.filter((v) => v.status === "active").length);
    case "inactive_partners":
      return String(vendors.filter((v) => v.status === "inactive").length);
    case "archived_partners":
      return String(vendors.filter((v) => v.status === "archived").length);
    case "total_orders":
      return String(vendors.reduce((s, v) => s + (v.totalOrders || 0), 0));
    case "avg_rating": {
      const ratedVendors = vendors.filter((v) => v.rating > 0);
      const avg = ratedVendors.length > 0
        ? ratedVendors.reduce((s, v) => s + v.rating, 0) / ratedVendors.length
        : 0;
      return avg.toFixed(1);
    }
    default:
      return "–";
  }
}

/* ─── Icon mapper ─── */
function KpiIcon({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  const props = { className, style };
  switch (name) {
    case "Users": return <Users {...props} />;
    case "Building2": return <Building2 {...props} />;
    case "ShoppingCart": return <ShoppingCart {...props} />;
    case "TrendingUp": return <TrendingUp {...props} />;
    case "CreditCard": return <CreditCard {...props} />;
    case "Percent": return <Percent {...props} />;
    case "Wallet": return <Wallet {...props} />;
    case "DollarSign": return <DollarSign {...props} />;
    case "UserCheck": return <UserCheck {...props} />;
    case "UserX": return <UserX {...props} />;
    case "Clock": return <Clock {...props} />;
    case "ArchiveRestore": return <ArchiveRestore {...props} />;
    case "Package": return <Package {...props} />;
    case "Star": return <Star {...props} />;
    default: return <ChartColumn {...props} />;
  }
}

/* Category icon mapper */
function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "Partner Overview": return <Users className="w-4 h-4 text-muted-foreground" />;
    case "Financial": return <DollarSign className="w-4 h-4 text-muted-foreground" />;
    case "Status": return <Clock className="w-4 h-4 text-muted-foreground" />;
    case "Operational": return <Globe className="w-4 h-4 text-muted-foreground" />;
    default: return <ChartColumn className="w-4 h-4 text-muted-foreground" />;
  }
}

/* ─── KPI Insights Panel Component ─── */
interface KpiInsightsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  vendors: Vendor[];
}

export function KpiInsightsPanel({
  open,
  onOpenChange,
  activeKpis,
  onToggleKpi,
  vendors,
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

  /* ─── Smooth mount / unmount with CSS transitions ─── */
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      // Mount first, then make visible on next frame for CSS transition
      setMounted(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      // Hide first, then unmount after transition
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
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {/* Toggle all insights */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeCount} of {ALL_KPI_DEFINITIONS.length} insights active
            </span>
            <button
              onClick={() => {
                const allKeys = ALL_KPI_DEFINITIONS.map(k => k.key);
                const allActive = allKeys.every(k => activeKpis.includes(k));
                if (allActive) {
                  // Turn off all
                  activeKpis.forEach(k => onToggleKpi(k));
                } else {
                  // Turn on all missing
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
          {categories.length === 0 && (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground/60">No metrics found</p>
            </div>
          )}

          {categories.map((cat) => (
            <div key={cat.name} className="mt-5 first:mt-4">
              {/* Category Header */}
              <div className="flex items-center gap-1.5 mb-2">
                <CategoryIcon category={cat.name} />
                <span
                  className="text-[12px] text-muted-foreground/70 uppercase tracking-wide"
                  style={{ fontWeight: 600 }}
                >
                  {cat.name}
                </span>
              </div>

              {/* KPI Cards Grid - 2 columns */}
              <div className="grid grid-cols-2 gap-2">
                {cat.kpis.map((kpi) => {
                  const isActive = activeKpis.includes(kpi.key);
                  const value = computeKpiValue(kpi.key, vendors);

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
                      {/* Top row: label + toggle icon */}
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

                      {/* Value */}
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

// Re-export
export { KpiIcon };