import { useState, useMemo, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import {
  Search, ChartColumn, TrendingUp, FileText, Clock, DollarSign, X, Check, Plus,
  ToggleLeft, ToggleRight, Send, CheckCircle, AlertTriangle, Archive, Users,
  Percent, Flag, Timer, RefreshCw, Wallet, BarChart3,
} from "lucide-react";
import type { Quote } from "@/app/types/quote";

export interface KpiDefinition {
  key: string;
  label: string;
  category: string;
  iconName: string;
  iconBg: string;
  iconColor: string;
  subtitle: string;
  tooltip?: string;
  /** When `true`, the KPI's value is a PKR amount that should be rendered with `BaseCurrencyKPI` (and recomputed under the active rate snapshot). Untyped or `false` KPIs render their `computeKpiValue` string output verbatim. */
  isCurrency?: boolean;
}

export const ALL_KPI_DEFINITIONS: KpiDefinition[] = [
  // Overview
  { key: "total_quotes", label: "Total Quotes", category: "Overview", iconName: "FileText", iconBg: "#EDF4FF", iconColor: "#0A77FF", subtitle: "All quotes in system" },
  { key: "total_value", label: "Total Value", category: "Overview", iconName: "DollarSign", iconBg: "#F0FDF4", iconColor: "#16A34A", subtitle: "Combined quote value", tooltip: "Cumulative value of all active quotes created in the selected period, regardless of status. Dynamically updates based on the date range filter.", isCurrency: true },
  { key: "avg_value", label: "Avg Quote Value", category: "Overview", iconName: "TrendingUp", iconBg: "#F5F3FF", iconColor: "#7C3AED", subtitle: "Average per quote", isCurrency: true },
  // Status
  { key: "draft_count", label: "Drafts", category: "Status", iconName: "FileText", iconBg: "#F8FAFC", iconColor: "#64748B", subtitle: "Pending submission" },
  { key: "sent_value", label: "Sent to Customer", category: "Status", iconName: "Send", iconBg: "#EFF6FF", iconColor: "#2563EB", subtitle: "Value awaiting response", tooltip: "Combined value of quotes delivered to the customer and awaiting their response. Does not include quotes already confirmed, expired, or cancelled.", isCurrency: true },
  { key: "sent_count", label: "Sent to Customer (Count)", category: "Status", iconName: "Send", iconBg: "#EFF6FF", iconColor: "#2563EB", subtitle: "Awaiting response" },
  { key: "confirmed_count", label: "Confirmed", category: "Status", iconName: "CheckCircle", iconBg: "#F5F3FF", iconColor: "#7C3AED", subtitle: "Customer confirmed" },
  { key: "converted_value", label: "Converted to SO", category: "Status", iconName: "Check", iconBg: "#F0FDF4", iconColor: "#16A34A", subtitle: "Value converted to SO", tooltip: "Combined value of quotes that have been accepted by the customer and converted to a sales order.", isCurrency: true },
  { key: "converted_count", label: "Converted to SO (Count)", category: "Status", iconName: "Check", iconBg: "#F0FDF4", iconColor: "#16A34A", subtitle: "Sales orders created" },
  { key: "expired_count", label: "Expired", category: "Status", iconName: "Clock", iconBg: "#FEF2F2", iconColor: "#DC2626", subtitle: "Past expiry date" },
  { key: "cancelled_count", label: "Cancelled", category: "Status", iconName: "Archive", iconBg: "#FEF2F2", iconColor: "#DC2626", subtitle: "Cancelled quotes" },
  // Alerts
  { key: "expiring_value", label: "Expiring Soon", category: "Alerts", iconName: "AlertTriangle", iconBg: "#FFF7ED", iconColor: "#EA580C", subtitle: "Value expiring within 7 days", tooltip: "Combined value of quotes currently sent to a customer that will reach their expiry date within the next 7 days.", isCurrency: true },
  { key: "expiring_soon", label: "Expiring Soon (Count)", category: "Alerts", iconName: "AlertTriangle", iconBg: "#FFF7ED", iconColor: "#EA580C", subtitle: "Within 7 days" },
  // Advanced (addable via sidebar)
  { key: "win_rate", label: "Win Rate", category: "Advanced", iconName: "Percent", iconBg: "#F0FDF4", iconColor: "#16A34A", subtitle: "Conversion percentage", tooltip: "Percentage of quotes that converted to a sales order, out of all quotes that reached a final outcome (converted, expired, or cancelled) in the selected period." },
  { key: "high_priority", label: "High Priority Quotes", category: "Advanced", iconName: "Flag", iconBg: "#FEF2F2", iconColor: "#DC2626", subtitle: "Urgent quotes", tooltip: "Total number of quotes currently marked with High Priority status." },
  { key: "avg_days_to_convert", label: "Avg. Days to Convert", category: "Advanced", iconName: "Timer", iconBg: "#FFF7ED", iconColor: "#EA580C", subtitle: "Creation to SO", tooltip: "Average number of calendar days from quote creation to sales order conversion, across all converted quotes in the selected period." },
  { key: "revised_quotes", label: "Revised Quotes", category: "Advanced", iconName: "RefreshCw", iconBg: "#EFF6FF", iconColor: "#2563EB", subtitle: "Multi-version quotes", tooltip: "Count of active quotes that have been revised at least once \u2014 including line item changes, pricing adjustments, or validity date extensions." },
  { key: "open_quote_value", label: "Open Quote Value", category: "Advanced", iconName: "Wallet", iconBg: "#ECFDF5", iconColor: "#059669", subtitle: "Active pipeline value", tooltip: "Total monetary value of all quotes still active \u2014 in draft, sent to the customer or confirmed \u2014 that have not yet expired, been cancelled, or converted to a sales order.", isCurrency: true },
  // FX context \u2014 one card per rate book. Display-only freshness indicator;
  // full source / sync / last-synced metadata lives in the tooltip.
  { key: "market_rate", label: "Market Rate", category: "FX", iconName: "RefreshCw", iconBg: "#F5F3FF", iconColor: "#7C3AED", subtitle: "Live mid-market rates", tooltip: "Live mid-market rates from Open Exchange Rates. Refreshed every 15 minutes. Display-only \u2014 drives the customer-currency hover conversions on the table." },
  { key: "corporate_rate", label: "Corporate Rate", category: "FX", iconName: "RefreshCw", iconBg: "#FFFBEB", iconColor: "#D97706", subtitle: "Treasury-locked book rates", tooltip: "Corporate book rates from Corporate Treasury (Q1 FY26). Refreshed quarterly \u2014 manual. Display-only \u2014 matches what finance uses for accruals and reporting." },
];

// Market Rate sits last by default; Corporate Rate is hidden — users add it via
// the "Add Insights" drawer like any other optional KPI.
export const DEFAULT_ACTIVE_KPIS = ["total_value", "sent_value", "expiring_value", "converted_value", "market_rate"];

/**
 * Numeric PKR amount for currency-typed KPIs. Returns `undefined` for KPIs
 * that are counts/ratios/durations \u2014 caller should fall back to
 * `computeKpiValue()` and render the string.
 */
export function computeKpiAmount(key: string, quotes: Quote[]): number | undefined {
  switch (key) {
    case "total_value":
      return quotes.reduce((s, q) => s + (q.totalValue || 0), 0);
    case "avg_value":
      return quotes.length > 0
        ? quotes.reduce((s, q) => s + (q.totalValue || 0), 0) / quotes.length
        : 0;
    case "sent_value":
      return quotes
        .filter(q => q.status === "Sent to Customer")
        .reduce((s, q) => s + (q.totalValue || 0), 0);
    case "converted_value":
      return quotes
        .filter(q => q.status === "Confirmed SO")
        .reduce((s, q) => s + (q.totalValue || 0), 0);
    case "expiring_value": {
      const now = new Date();
      const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return quotes
        .filter(q => q.expiryDate && new Date(q.expiryDate) <= week && new Date(q.expiryDate) > now && q.status !== "Expired" && q.status !== "Cancelled")
        .reduce((s, q) => s + (q.totalValue || 0), 0);
    }
    case "open_quote_value": {
      const activeStatuses = ["Draft", "Sent to Customer", "Unconfirmed SO"];
      return quotes
        .filter(q => activeStatuses.includes(q.status))
        .reduce((s, q) => s + (q.totalValue || 0), 0);
    }
    default:
      return undefined;
  }
}

export function computeKpiValue(key: string, quotes: Quote[]): string {
  // Compact base-currency formatter — PKR is the canonical base currency for
  // every quote total, so the symbol stays the same regardless of the active
  // rate snapshot.
  const formatCompact = (val: number): string => {
    if (val >= 1_000_000) return `₨ ${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `₨ ${(val / 1_000).toFixed(0)}K`;
    return `₨ ${val.toFixed(0)}`;
  };
  switch (key) {
    case "total_quotes": return String(quotes.length);
    case "total_value": return formatCompact(quotes.reduce((s, q) => s + (q.totalValue || 0), 0));
    case "avg_value": return quotes.length > 0 ? formatCompact(quotes.reduce((s, q) => s + (q.totalValue || 0), 0) / quotes.length) : "$0";
    case "sent_value": return formatCompact(quotes.filter(q => q.status === "Sent to Customer").reduce((s, q) => s + (q.totalValue || 0), 0));
    case "converted_value": return formatCompact(quotes.filter(q => q.status === "Confirmed SO").reduce((s, q) => s + (q.totalValue || 0), 0));
    case "expiring_value": {
      const now = new Date();
      const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return formatCompact(quotes.filter(q => q.expiryDate && new Date(q.expiryDate) <= week && new Date(q.expiryDate) > now && q.status !== "Expired" && q.status !== "Cancelled").reduce((s, q) => s + (q.totalValue || 0), 0));
    }
    case "draft_count": return String(quotes.filter(q => q.status === "Draft").length);
    case "sent_count": return String(quotes.filter(q => q.status === "Sent to Customer").length);
    case "confirmed_count": return String(quotes.filter(q => q.status === "Unconfirmed SO").length);
    case "converted_count": return String(quotes.filter(q => q.status === "Confirmed SO").length);
    case "expired_count": return String(quotes.filter(q => q.status === "Expired").length);
    case "cancelled_count": return String(quotes.filter(q => q.status === "Cancelled").length);
    case "expiring_soon": {
      const now = new Date();
      const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return String(quotes.filter(q => q.expiryDate && new Date(q.expiryDate) <= week && new Date(q.expiryDate) > now && q.status !== "Expired" && q.status !== "Cancelled").length);
    }
    case "win_rate": {
      const converted = quotes.filter(q => q.status === "Confirmed SO").length;
      const terminal = converted + quotes.filter(q => q.status === "Expired" || q.status === "Cancelled").length;
      return terminal > 0 ? `${((converted / terminal) * 100).toFixed(1)}%` : "0%";
    }
    case "high_priority": return String(quotes.filter(q => q.priority === "Urgent").length);
    case "avg_days_to_convert": {
      const convertedQuotes = quotes.filter(q => q.status === "Confirmed SO" && q.createdDate);
      if (convertedQuotes.length === 0) return "0d";
      const totalDays = convertedQuotes.reduce((sum, q) => {
        const created = new Date(q.createdDate);
        const confirmed = q.confirmationDate ? new Date(q.confirmationDate) : new Date(q.lastUpdated || q.createdDate);
        return sum + Math.max(0, Math.floor((confirmed.getTime() - created.getTime()) / 86400000));
      }, 0);
      return `${Math.round(totalDays / convertedQuotes.length)}d`;
    }
    case "revised_quotes": return String(quotes.filter(q => (q.version || 1) > 1).length);
    case "open_quote_value": {
      const activeStatuses = ["Draft", "Sent to Customer", "Unconfirmed SO"];
      return formatCompact(quotes.filter(q => activeStatuses.includes(q.status)).reduce((s, q) => s + (q.totalValue || 0), 0));
    }
    default: return "–";
  }
}

function KpiIconComponent({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  const props = { className, style };
  switch (name) {
    case "FileText": return <FileText {...props} />;
    case "DollarSign": return <DollarSign {...props} />;
    case "TrendingUp": return <TrendingUp {...props} />;
    case "Send": return <Send {...props} />;
    case "CheckCircle": return <CheckCircle {...props} />;
    case "Check": return <Check {...props} />;
    case "Clock": return <Clock {...props} />;
    case "AlertTriangle": return <AlertTriangle {...props} />;
    case "Archive": return <Archive {...props} />;
    case "Users": return <Users {...props} />;
    case "Percent": return <Percent {...props} />;
    case "Flag": return <Flag {...props} />;
    case "Timer": return <Timer {...props} />;
    case "RefreshCw": return <RefreshCw {...props} />;
    case "Wallet": return <Wallet {...props} />;
    default: return <ChartColumn {...props} />;
  }
}

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "Overview": return <FileText className="w-4 h-4 text-muted-foreground" />;
    case "Status": return <Clock className="w-4 h-4 text-muted-foreground" />;
    case "Alerts": return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    case "Advanced": return <BarChart3 className="w-4 h-4 text-muted-foreground" />;
    default: return <ChartColumn className="w-4 h-4 text-muted-foreground" />;
  }
}

interface KpiInsightsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  quotes: Quote[];
}

export function KpiInsightsPanel({ open, onOpenChange, activeKpis, onToggleKpi, quotes }: KpiInsightsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const categories = useMemo(() => {
    const cats: { name: string; kpis: KpiDefinition[] }[] = [];
    const catMap = new Map<string, KpiDefinition[]>();
    for (const kpi of ALL_KPI_DEFINITIONS) {
      const matchesSearch = !searchQuery || kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) || kpi.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (matchesSearch) {
        if (!catMap.has(kpi.category)) catMap.set(kpi.category, []);
        catMap.get(kpi.category)!.push(kpi);
      }
    }
    catMap.forEach((kpis, name) => { cats.push({ name, kpis }); });
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
      requestAnimationFrame(() => { requestAnimationFrame(() => setVisible(true)); });
    } else {
      setVisible(false);
      timeoutRef.current = setTimeout(() => setMounted(false), 280);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [open]);

  if (!mounted) return null;

  return (
    <>
      <div className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{ backgroundColor: visible ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0)", pointerEvents: visible ? "auto" : "none" }}
        onClick={() => onOpenChange(false)} />
      <div className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: visible ? "translateX(0)" : "translateX(100%)" }}>
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#EDF4FF" }}>
                <ChartColumn className="w-5 h-5" style={{ color: "#0A77FF" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Add Insights</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">Customize your dashboard with relevant metrics.</p>
              </div>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>{activeCount} of {ALL_KPI_DEFINITIONS.length} insights active</span>
            <button
              onClick={() => {
                const allKeys = ALL_KPI_DEFINITIONS.map(k => k.key);
                const allActive = allKeys.every(k => activeKpis.includes(k));
                if (allActive) { activeKpis.forEach(k => onToggleKpi(k)); }
                else { allKeys.filter(k => !activeKpis.includes(k)).forEach(k => onToggleKpi(k)); }
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                ALL_KPI_DEFINITIONS.every(k => activeKpis.includes(k.key))
                  ? "bg-[#EBF3FF] border-[#0A77FF]/25 text-[#0A77FF] hover:bg-[#DCEAFF]"
                  : activeKpis.length === 0
                  ? "bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8] hover:bg-[#F1F5F9]"
                  : "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-[#EBF3FF]"
              }`}
              style={{ fontWeight: 600 }}
            >
              {ALL_KPI_DEFINITIONS.every(k => activeKpis.includes(k.key)) ? (<><ToggleRight className="w-4 h-4 text-[#0A77FF]" /><span>All On</span></>) :
               activeKpis.length === 0 ? (<><ToggleLeft className="w-4 h-4" /><span>All Off</span></>) :
               (<><ToggleLeft className="w-4 h-4" /><span>Enable All</span></>)}
            </button>
          </div>
        </div>

        <div className="px-5 pt-3.5 pb-1 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input placeholder="Search metrics..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors" />
          </div>
        </div>

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
                <span className="text-[12px] text-muted-foreground/70 uppercase tracking-wide" style={{ fontWeight: 600 }}>{cat.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {cat.kpis.map((kpi) => {
                  const isActive = activeKpis.includes(kpi.key);
                  const value = computeKpiValue(kpi.key, quotes);
                  return (
                    <button key={kpi.key} onClick={() => onToggleKpi(kpi.key)}
                      className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                        isActive ? "border-[#0A77FF]/25 bg-[#0A77FF]/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]" : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                      }`}>
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[11.5px] truncate transition-colors ${isActive ? "text-[#0A77FF]" : "text-muted-foreground/70"}`} style={{ fontWeight: 500 }} title={kpi.label}>{kpi.label}</span>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all ${isActive ? "bg-[#0A77FF] shadow-sm" : "border border-border/60 bg-white group-hover:border-muted-foreground/30"}`}>
                          {isActive && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1.5 mt-1.5">
                        <span className={`text-[15px] tracking-tight ${isActive ? "text-foreground" : "text-muted-foreground/50"}`} style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/40 mt-0.5 truncate">{kpi.subtitle}</p>
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

export { KpiIconComponent as KpiIcon };
