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
  Sliders,
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
  /** Fixed-pitch calculation shown in the KPI tooltip — mirrors the
   *  Vendor Invoicing listing's "Calculation" block so users can see
   *  how every number is derived. */
  formula?: string;
}

/* ─── All available KPI definitions ─── */
export const ALL_KPI_DEFINITIONS: KpiDefinition[] = [
  // Partner Overview
  {
    key: "total_partners",
    label: "Total Partners",
    category: "Partner Overview",
    iconName: "Users",
    iconBg: "rgb(var(--accent))",
    iconColor: "rgb(var(--primary))",
    subtitle: "All partners in system",
    tooltip: "Total count of every partner in the system, regardless of type or status.",
    formula: "count(all partners)",
  },
  {
    key: "total_vendors",
    label: "Total Vendors",
    category: "Partner Overview",
    iconName: "Building2",
    iconBg: "#F0FDF4",
    iconColor: "#16A34A",
    subtitle: "Vendor-type partners",
    tooltip: "Partners flagged as vendors, the supplier side of your roster.",
    formula: "count(partnerTypes ∋ Vendor)",
  },
  {
    key: "total_customers",
    label: "Total Customers",
    category: "Partner Overview",
    iconName: "ShoppingCart",
    iconBg: "#EBF3FF",
    iconColor: "#086AE6",
    subtitle: "Customer-type partners",
    tooltip: "Partners flagged as customers, the buyer side of your roster.",
    formula: "count(partnerTypes ∋ Customer)",
  },
  {
    key: "total_both",
    label: "Both Vendor & Customer",
    category: "Partner Overview",
    iconName: "Users",
    iconBg: "#ECFEFF",
    iconColor: "#0E7490",
    subtitle: "Partners on both sides",
    tooltip: "Partners flagged as both Vendor and Customer, they buy from you and sell to you. Useful when spotting which relationships are dual-direction.",
    formula: "count(Vendor ∧ Customer)",
  },
  // Financial — credit limit is split by partner type per BA pass:
  // vendor exposure (what we owe) and customer exposure (what's owed
  // to us) sit on opposite sides of the ledger, so collapsing them
  // into a single roll-up reads false. Same split applies to the
  // average so each side benchmarks against its own roster.
  {
    key: "total_credit_limit_vendors",
    label: "Total Credit Limit · Vendors",
    category: "Financial",
    iconName: "TrendingUp",
    iconBg: "#EBF3FF",
    iconColor: "#0548A3",
    subtitle: "Vendor credit exposure",
    tooltip: "Combined credit limit across all active vendors. The credit your organization has extended to its supplier base.",
    formula: "sum(creditLimit)\nwhere partnerTypes ∋ Vendor",
  },
  {
    key: "total_credit_limit_customers",
    label: "Total Credit Limit · Customers",
    category: "Financial",
    iconName: "TrendingUp",
    iconBg: "#ECFDF5",
    iconColor: "#065F46",
    subtitle: "Customer credit exposure",
    tooltip: "Combined credit limit across all active customers. The credit your organization has extended to its buyer base.",
    formula: "sum(creditLimit)\nwhere partnerTypes ∋ Customer",
  },
  {
    key: "avg_credit_limit_vendors",
    label: "Avg Credit Limit · Vendors",
    category: "Financial",
    iconName: "CreditCard",
    iconBg: "#F5F3FF",
    iconColor: "rgb(var(--violet))",
    subtitle: "Average per vendor",
    tooltip: "Total vendor credit limit divided by number of vendors. Benchmarks individual supplier allocations against the vendor portfolio.",
    formula: "sum(creditLimit) ÷ count(vendors)",
  },
  {
    key: "avg_credit_limit_customers",
    label: "Avg Credit Limit · Customers",
    category: "Financial",
    iconName: "CreditCard",
    iconBg: "#FEF3F2",
    iconColor: "#9F1239",
    subtitle: "Average per customer",
    tooltip: "Total customer credit limit divided by number of customers. Benchmarks individual buyer allocations against the customer portfolio.",
    formula: "sum(creditLimit) ÷ count(customers)",
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
    formula: "sum(creditUtilization)",
  },
  {
    key: "total_outstanding",
    label: "Outstanding Balance",
    category: "Financial",
    iconName: "Wallet",
    iconBg: "#FEF2F2",
    iconColor: "rgb(var(--destructive))",
    subtitle: "Total outstanding",
    tooltip: "Total unpaid balance across all partners. Includes invoices pending payment, overdue amounts, and scheduled disbursements.",
    formula: "sum(outstandingBalance)",
  },
  {
    key: "total_spent",
    label: "Total Spent",
    category: "Financial",
    iconName: "DollarSign",
    iconBg: "#F0FDF4",
    iconColor: "#16A34A",
    subtitle: "Across all partners",
    tooltip: "Cumulative spend across the whole partner portfolio.",
    formula: "sum(totalSpent)",
  },
  {
    key: "avg_net_profit",
    label: "Avg Net Margin",
    category: "Financial",
    iconName: "TrendingUp",
    iconBg: "#ECFDF5",
    iconColor: "rgb(var(--success))",
    subtitle: "Average profit margin",
    tooltip: "Average net profit margin calculated across all partner transactions. Factors in revenue, cost of goods, and operational expenses per partner.",
    formula: "avg(netProfitMargin)",
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
    tooltip: "Partners whose status is Active, the working roster.",
    formula: "count(status = Active)",
  },
  {
    key: "inactive_partners",
    label: "Inactive Partners",
    category: "Status",
    iconName: "UserX",
    iconBg: "rgb(var(--muted))",
    iconColor: "#64748B",
    subtitle: "Currently inactive",
    tooltip: "Partners whose status is Inactive, paused relationships that can be re-activated.",
    formula: "count(status = Inactive)",
  },
  {
    key: "archived_partners",
    label: "Archived Partners",
    category: "Status",
    iconName: "ArchiveRestore",
    iconBg: "#F8FAFC",
    iconColor: "rgb(var(--muted-foreground))",
    subtitle: "In archive",
    tooltip: "Partners moved to the archive, hidden from day-to-day surfaces but never deleted.",
    formula: "count(status = Archived)",
  },
  // Operational — orders ship split by trade direction per BA pass
  // (no aggregate "Total Orders" roll-up anywhere in the module):
  // POs flow to vendor-side partners, SOs come from customer-side ones.
  {
    key: "purchase_orders",
    label: "Purchase Orders",
    category: "Operational",
    iconName: "ShoppingCart",
    iconBg: "rgb(var(--accent))",
    iconColor: "rgb(var(--primary))",
    subtitle: "POs to vendor partners",
    tooltip: "Purchase orders placed with vendor-side partners across the portfolio.",
    formula: "sum(orders) over vendor-side partners",
  },
  {
    key: "sales_orders",
    label: "Sales Orders",
    category: "Operational",
    iconName: "Package",
    iconBg: "#ECFDF5",
    iconColor: "#059669",
    subtitle: "SOs from customer partners",
    tooltip: "Sales orders received from customer-side partners across the portfolio.",
    formula: "sum(orders) over customer-side partners",
  },
];

/** Split a partner's order count by trade direction. Vendor-only
 *  partners are all POs, customer-only all SOs; dual-direction
 *  partners split 60/40 toward purchasing (deterministic — production
 *  reads the real PO/SO ledgers). Shared by every surface that used to
 *  show a "Total Orders" roll-up. */
export function splitVendorOrders(v: Vendor): { po: number; so: number } {
  const total = v.totalOrders || 0;
  const isVendor = v.partnerTypes?.includes("vendor");
  const isCustomer = v.partnerTypes?.includes("customer");
  if (isVendor && isCustomer) {
    const po = Math.round(total * 0.6);
    return { po, so: total - po };
  }
  if (isCustomer) return { po: 0, so: total };
  return { po: total, so: 0 };
}

/* Default active KPIs — Credit Limit ships split by partner type per
 * BA pass so the listing surface leads with vendor + customer exposure
 * side-by-side, not a single aggregate roll-up. */
export const DEFAULT_ACTIVE_KPIS = [
  "total_partners",
  "total_credit_limit_vendors",
  "total_credit_limit_customers",
  "avg_credit_limit_vendors",
  "avg_credit_limit_customers",
  "active_partners",
];

/* ─── Period-over-period delta (Vendor Invoicing listing pattern) ─── */

export interface KpiDelta {
  /** Display string e.g. "+12%", "−8%". */
  text: string;
  /** Drives the prefix color — semantic up/down for the metric. */
  tone: "positive" | "negative" | "neutral";
}

export interface ComputedKpi {
  value: string;
  /** Small muted complement line under the headline (count ↔ money). */
  sub: string;
  /** Optional period-over-period delta shown as a colored prefix. */
  delta?: KpiDelta;
}

/** Whether growth is good news for the metric — drives delta tone
 *  (growth in Total Partners = green; growth in Outstanding = red). */
const KPI_GROWTH_IS_GOOD: Record<string, boolean> = {
  total_partners: true,
  total_vendors: true,
  total_customers: true,
  total_both: true,
  total_credit_limit_vendors: true,
  total_credit_limit_customers: true,
  avg_credit_limit_vendors: true,
  avg_credit_limit_customers: true,
  total_credit_utilization: false,
  total_outstanding: false,
  total_spent: true,
  avg_net_profit: true,
  active_partners: true,
  inactive_partners: false,
  archived_partners: false,
  purchase_orders: true,
  sales_orders: true,
};

/** Deterministic previous-period drift. The seeded mock roster carries
 *  no dated transaction stream to diff against, so the prototype
 *  derives a stable ±2–14% drift from (kpi, range) — the same KPI in
 *  the same range always shows the same delta, and switching ranges
 *  visibly recomputes. Production swaps this for the real
 *  previous-period dataset (see Vendor Invoicing's
 *  filterInvoicesByPreviousRange for the contract). */
export function buildSeededDelta(key: string, range: string, current: number, growthIsGoodOverride?: boolean): KpiDelta | undefined {
  if (range === "all_time" || range === "custom" || !current) return undefined;
  const seed = `${key}:${range}`.split("").reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) % 9973, 7);
  const pct = 2 + (seed % 13); // 2–14%
  const grew = seed % 2 === 0;
  const growthIsGood = growthIsGoodOverride ?? KPI_GROWTH_IS_GOOD[key] ?? true;
  return {
    text: `${grew ? "+" : "−"}${pct}%`,
    tone: grew === growthIsGood ? "positive" : "negative",
  };
}

/** Period label for the "vs prior X" anchor next to the delta. */
export function insightsRangePeriodLabel(range: string): string | undefined {
  switch (range) {
    case "last_7": return "7 days";
    case "last_30": return "30 days";
    case "last_90": return "90 days";
    case "last_365": return "12 months";
    default: return undefined;
  }
}

const formatCompact = (val: number): string => {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
};

/* ─── Compute KPI value from vendors data ─── */
export function computeKpiValue(key: string, vendors: Vendor[]): string {
  switch (key) {
    case "total_partners":
      return String(vendors.length);
    case "total_vendors":
      return String(vendors.filter((v) => v.partnerTypes?.includes("vendor")).length);
    case "total_customers":
      return String(vendors.filter((v) => v.partnerTypes?.includes("customer")).length);
    case "total_both":
      return String(vendors.filter((v) => v.partnerTypes?.includes("vendor") && v.partnerTypes?.includes("customer")).length);
    case "total_credit_limit_vendors": {
      const subset = vendors.filter((v) => v.partnerTypes?.includes("vendor"));
      return formatCompact(subset.reduce((s, v) => s + (v.creditLimit || 0), 0));
    }
    case "total_credit_limit_customers": {
      const subset = vendors.filter((v) => v.partnerTypes?.includes("customer"));
      return formatCompact(subset.reduce((s, v) => s + (v.creditLimit || 0), 0));
    }
    case "avg_credit_limit_vendors": {
      const subset = vendors.filter((v) => v.partnerTypes?.includes("vendor"));
      const total = subset.reduce((s, v) => s + (v.creditLimit || 0), 0);
      return formatCompact(subset.length > 0 ? total / subset.length : 0);
    }
    case "avg_credit_limit_customers": {
      const subset = vendors.filter((v) => v.partnerTypes?.includes("customer"));
      const total = subset.reduce((s, v) => s + (v.creditLimit || 0), 0);
      return formatCompact(subset.length > 0 ? total / subset.length : 0);
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
    case "purchase_orders":
      return String(vendors.reduce((s, v) => s + splitVendorOrders(v).po, 0));
    case "sales_orders":
      return String(vendors.reduce((s, v) => s + splitVendorOrders(v).so, 0));
    default:
      return "–";
  }
}

/** Raw numeric behind the headline — feeds the seeded delta so the
 *  drift suppresses itself on empty metrics (current = 0 → no chip). */
function kpiNumeric(key: string, vendors: Vendor[]): number {
  switch (key) {
    case "total_partners": return vendors.length;
    case "total_vendors": return vendors.filter((v) => v.partnerTypes?.includes("vendor")).length;
    case "total_customers": return vendors.filter((v) => v.partnerTypes?.includes("customer")).length;
    case "total_both": return vendors.filter((v) => v.partnerTypes?.includes("vendor") && v.partnerTypes?.includes("customer")).length;
    case "total_credit_limit_vendors": return vendors.filter((v) => v.partnerTypes?.includes("vendor")).reduce((s, v) => s + (v.creditLimit || 0), 0);
    case "total_credit_limit_customers": return vendors.filter((v) => v.partnerTypes?.includes("customer")).reduce((s, v) => s + (v.creditLimit || 0), 0);
    case "avg_credit_limit_vendors": {
      const subset = vendors.filter((v) => v.partnerTypes?.includes("vendor"));
      return subset.length ? subset.reduce((s, v) => s + (v.creditLimit || 0), 0) / subset.length : 0;
    }
    case "avg_credit_limit_customers": {
      const subset = vendors.filter((v) => v.partnerTypes?.includes("customer"));
      return subset.length ? subset.reduce((s, v) => s + (v.creditLimit || 0), 0) / subset.length : 0;
    }
    case "total_credit_utilization": return vendors.reduce((s, v) => s + (v.creditUtilization || 0), 0);
    case "total_outstanding": return vendors.reduce((s, v) => s + (v.outstandingBalance || 0), 0);
    case "total_spent": return vendors.reduce((s, v) => s + (v.totalSpent || 0), 0);
    case "avg_net_profit": return vendors.length ? vendors.reduce((s, v) => s + (v.netProfitMargin || 0), 0) / vendors.length : 0;
    case "active_partners": return vendors.filter((v) => v.status === "active").length;
    case "inactive_partners": return vendors.filter((v) => v.status === "inactive").length;
    case "archived_partners": return vendors.filter((v) => v.status === "archived").length;
    case "purchase_orders": return vendors.reduce((s, v) => s + splitVendorOrders(v).po, 0);
    case "sales_orders": return vendors.reduce((s, v) => s + splitVendorOrders(v).so, 0);
    default: return 0;
  }
}

/** Complement line under the headline — count for money-led cards,
 *  money for count-led cards (Vendor Invoicing card pattern). */
function kpiSub(key: string, vendors: Vendor[]): string {
  const pctOfPortfolio = (n: number) => vendors.length ? `${Math.round((n / vendors.length) * 100)}% of portfolio` : "";
  switch (key) {
    case "total_partners": {
      const v = vendors.filter((x) => x.partnerTypes?.includes("vendor")).length;
      const c = vendors.filter((x) => x.partnerTypes?.includes("customer")).length;
      return `${v} vendors · ${c} customers`;
    }
    case "total_vendors": return formatCompact(kpiNumeric("total_credit_limit_vendors", vendors)) + " credit limit";
    case "total_customers": return formatCompact(kpiNumeric("total_credit_limit_customers", vendors)) + " credit limit";
    case "total_both": return `of ${vendors.length} partners`;
    case "total_credit_limit_vendors": return `${kpiNumeric("total_vendors", vendors)} vendors`;
    case "total_credit_limit_customers": return `${kpiNumeric("total_customers", vendors)} customers`;
    case "avg_credit_limit_vendors": return `across ${kpiNumeric("total_vendors", vendors)} vendors`;
    case "avg_credit_limit_customers": return `across ${kpiNumeric("total_customers", vendors)} customers`;
    case "total_credit_utilization": {
      const limit = vendors.reduce((s, v) => s + (v.creditLimit || 0), 0);
      const util = kpiNumeric("total_credit_utilization", vendors);
      return limit ? `${Math.round((util / limit) * 100)}% of ${formatCompact(limit)} limit` : "";
    }
    case "total_outstanding": {
      const owing = vendors.filter((v) => (v.outstandingBalance || 0) > 0).length;
      return owing ? `${owing} partners owe` : "Nothing outstanding";
    }
    case "total_spent": return `across ${vendors.length} partners`;
    case "avg_net_profit": return `across ${vendors.length} partners`;
    case "active_partners": return pctOfPortfolio(kpiNumeric("active_partners", vendors));
    case "inactive_partners": return pctOfPortfolio(kpiNumeric("inactive_partners", vendors));
    case "archived_partners": return pctOfPortfolio(kpiNumeric("archived_partners", vendors));
    case "purchase_orders": return `to ${kpiNumeric("total_vendors", vendors)} vendors`;
    case "sales_orders": return `from ${kpiNumeric("total_customers", vendors)} customers`;
    default: return "";
  }
}

/** Full computed KPI — headline + complement sub-line + range-scoped
 *  delta. The Vendor Invoicing listing card consumes this exact shape;
 *  the partner surfaces now share it. */
export function computeKpi(key: string, vendors: Vendor[], range: string): ComputedKpi {
  return {
    value: computeKpiValue(key, vendors),
    sub: kpiSub(key, vendors),
    delta: buildSeededDelta(key, range, kpiNumeric(key, vendors)),
  };
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
                style={{ backgroundColor: "rgb(var(--accent))" }}
              >
                <Sliders className="w-5 h-5" style={{ color: "rgb(var(--primary))" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                  Customize Widgets
                </h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Manage your dashboard KPI widgets.
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
                  // Turn off all
                  activeKpis.forEach(k => onToggleKpi(k));
                } else {
                  // Turn on all missing
                  allKeys.filter(k => !activeKpis.includes(k)).forEach(k => onToggleKpi(k));
                }
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                ALL_KPI_DEFINITIONS.every(k => activeKpis.includes(k.key))
                  ? "bg-[#EBF3FF] border-primary/25 text-primary hover:bg-[#DCEAFF] hover:border-primary/40 shadow-sm shadow-primary/10"
                  : activeKpis.length === 0
                  ? "bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500"
                  : "bg-slate-50 border-border text-slate-500 hover:bg-[#EBF3FF] hover:border-primary/25 hover:text-primary"
              }`}
              style={{ fontWeight: 600 }}
            >
              {ALL_KPI_DEFINITIONS.every(k => activeKpis.includes(k.key)) ? (
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

        {/* Separator — matches DashboardCustomizePanel tab bar bottom border */}
        <div className="border-b border-muted mt-3 shrink-0" />

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
                  className="text-[12px] text-muted-foreground/70 tracking-wide"
                  style={{ fontWeight: 600 }}
                >
                  {cat.name}
                </span>
              </div>

              {/* KPI Cards Grid - 2 columns (compact text-only design) */}
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
                          ? "border-primary/25 bg-primary/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                          : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                      }`}
                    >
                      {/* Top row: label + toggle icon */}
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[11px] truncate transition-colors ${
                            isActive ? "text-primary" : "text-muted-foreground/70"
                          }`}
                          style={{ fontWeight: 500 }}
                          title={kpi.label}
                        >
                          {kpi.label}
                        </span>
                        <div className="shrink-0">
                          {isActive ? (
                            <Check className="w-3.5 h-3.5" style={{ color: "rgb(var(--primary))" }} />
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