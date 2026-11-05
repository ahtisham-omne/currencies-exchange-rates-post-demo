/* ═══════════════════════════════════════════════════════════════
   PO DASHBOARD — analytics & health monitoring
   Purely informational. No action buttons. Charts + KPIs only.
   Action surfaces live on the Demands tab.
   ═══════════════════════════════════════════════════════════════ */

import React, { useState, useMemo } from "react";
import {
  RefreshCw,
  Sliders,
  RotateCcw,
  Calendar,
  TrendingUp,
  BarChart3,
  Activity,
  Clock,
  Package,
  DollarSign,
  Info,
  Check,
  ChevronDown,
  Plus,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
} from "recharts";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { toast } from "sonner";
import { FONT } from "./designTokens";

/* ─────────── Time-range filter ─────────── */

type TimeRange = "TODAY" | "1W" | "1M" | "3M" | "1Y" | "MAX" | "CUSTOM";

const TIME_RANGE_BUTTONS: { key: TimeRange; label: string }[] = [
  { key: "TODAY", label: "Today" },
  { key: "1W", label: "1W" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "1Y", label: "1Y" },
  { key: "MAX", label: "Max" },
  { key: "CUSTOM", label: "Custom" },
];

function daysForRange(r: TimeRange): number {
  switch (r) {
    case "TODAY": return 1;
    case "1W": return 7;
    case "1M": return 30;
    case "3M": return 90;
    case "1Y": return 365;
    case "MAX":
    case "CUSTOM":
    default: return 9999;
  }
}

function rangeLabel(r: TimeRange, custom?: { from: string; to: string }): string {
  switch (r) {
    case "TODAY": return "Today";
    case "1W": return "Last 7 days";
    case "1M": return "Last 30 days";
    case "3M": return "Last 90 days";
    case "1Y": return "Last 12 months";
    case "MAX": return "All time";
    case "CUSTOM": return custom?.from && custom?.to ? `${custom.from} → ${custom.to}` : "Custom range";
  }
}

/* ─────────── KPI card ─────────── */

const KPI_TONE: Record<"red" | "blue" | "orange" | "violet" | "gray" | "green", { bg: string; fg: string }> = {
  red: { bg: "#FEF2F2", fg: "#DC2626" },
  blue: { bg: "#EDF4FF", fg: "#0A77FF" },
  orange: { bg: "#FFF7ED", fg: "#EA580C" },
  violet: { bg: "#F5F3FF", fg: "#7C3AED" },
  gray: { bg: "#F1F5F9", fg: "#64748B" },
  green: { bg: "#F0FDF4", fg: "#16A34A" },
};

function KpiCard({
  icon: Icon,
  tone,
  label,
  badge,
  value,
  caption,
  tooltip,
}: {
  icon: React.ElementType;
  tone: keyof typeof KPI_TONE;
  label: string;
  badge?: { text: string; color?: string };
  value: React.ReactNode;
  caption?: React.ReactNode;
  tooltip?: string;
}) {
  const t = KPI_TONE[tone];
  return (
    <div
      className="group relative flex-1 min-w-[200px] rounded-lg border border-[#E2E8F0] bg-white overflow-hidden transition-all duration-200"
      style={{ fontFamily: FONT }}
    >
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: t.bg }}>
              <Icon className="w-3 h-3" style={{ color: t.fg }} />
            </div>
            <p className="whitespace-nowrap truncate" style={{ fontSize: 10.5, fontWeight: 500, color: "#64748B", fontFamily: FONT }}>
              {label}
            </p>
            {tooltip && (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                      <Info className="w-3 h-3 text-[#CBD5E1] hover:text-[#94A3B8] cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[280px] text-[11px] z-[300]">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          {badge && (
            <span style={{ fontSize: 10, fontWeight: 500, color: badge.color || "#059669", fontFamily: FONT }}>
              {badge.text}
            </span>
          )}
          <p className="tracking-tight whitespace-nowrap" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2, color: "#334155", fontFamily: FONT }}>
            {value}
          </p>
        </div>
        {caption && (
          <p className="mt-0.5 truncate" style={{ fontSize: 9.5, fontWeight: 400, color: "#94A3B8", fontFamily: FONT }}>
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────── Widget card chrome (Partners ContentCard pattern) ─────────── */

function WidgetCard({
  icon: Icon,
  title,
  children,
}: {
  icon?: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      /* h-full + min-h-0 lets the card stretch to whatever explicit height
         its wrapper sets (we use 340px on the dashboard so every widget
         lines up), and the inner body flex-grows below the header. */
      className="rounded-xl border border-border bg-card overflow-hidden flex flex-col h-full min-h-0 transition-[box-shadow] duration-300"
      style={{
        fontFamily: FONT,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="px-4 py-2.5 border-b border-muted flex items-center gap-2 shrink-0">
        {Icon && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(var(--accent))" }}>
            <Icon className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
          </div>
        )}
        <span style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))", fontFamily: FONT }}>{title}</span>
      </div>
      <div className="flex-1 min-h-0 p-4">{children}</div>
    </div>
  );
}

/* ─────────── ChartWidget ─────────── */

function ChartWidget({
  icon,
  title,
  footerStats,
  children,
}: {
  icon?: React.ElementType;
  title: string;
  footerStats?: Array<{ label: string; value: string; color?: string }>;
  children: React.ReactElement;
}) {
  /* Outer wrapper has a fixed pixel height so every widget in the row
     (chart + donut) renders at the exact same total height. The chart
     itself takes the remaining flex space inside the card after the
     footer stats so it scales naturally. */
  return (
    <div className="flex flex-col" style={{ flex: "1 1 calc(50% - 6px)", minWidth: 320, height: 340 }}>
      <WidgetCard icon={icon} title={title}>
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0 -ml-2">
            <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
          </div>
          {footerStats && footerStats.length > 0 && (
            <div className="flex items-end justify-between gap-4 mt-2 pt-2 border-t border-muted shrink-0">
              <div className="flex items-center gap-4 flex-wrap min-w-0">
                {footerStats.map((s, i) => (
                  <div key={i}>
                    <p style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8", fontFamily: FONT }}>{s.label}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: s.color || "#334155", fontFamily: FONT }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </WidgetCard>
    </div>
  );
}

/* ─────────── Mock chart data ─────────── */

/* Daily spend points for the trailing 90 days so a 30-day window still
   renders a meaningful line (the previous monthly series only had one
   datapoint inside a 30-day slice). Deterministic generator anchored at
   module load — values follow a sine/cosine curve plus weekly bumps so
   the line has shape without needing seeded randomness. */
const SPEND_TREND_DATA: { date: string; amount: number }[] = (() => {
  const out: { date: string; amount: number }[] = [];
  const ref = new Date();
  ref.setHours(0, 0, 0, 0);
  const totalDays = 90;
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(ref);
    d.setDate(d.getDate() - (totalDays - 1 - i));
    const doy = Math.floor(
      (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000,
    );
    const dow = d.getDay();
    const weekendDip = dow === 0 || dow === 6 ? -250 : 0;
    const amount = Math.round(
      950 +
        Math.sin(doy * 0.18) * 380 +
        Math.cos(doy * 0.11) * 260 +
        (doy % 7) * 60 +
        weekendDip,
    );
    out.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount: Math.max(120, amount),
    });
  }
  return out;
})();

const WEEKLY_ACTIVITY_DATA = [
  { week: "W1", created: 6, sent: 4 },
  { week: "W2", created: 8, sent: 7 },
  { week: "W3", created: 5, sent: 5 },
  { week: "W4", created: 9, sent: 6 },
  { week: "W5", created: 4, sent: 3 },
];

const RESPONSE_TIME_DATA = [
  { week: "W1", days: 3.1 },
  { week: "W2", days: 2.8 },
  { week: "W3", days: 2.5 },
  { week: "W4", days: 2.2 },
  { week: "W5", days: 2.4 },
  { week: "W6", days: 2.1 },
  { week: "W7", days: 2.3 },
  { week: "W8", days: 2.3 },
];

const REQUEST_STATUS_DATA = [
  { name: "Pending", value: 5 },
  { name: "Approved", value: 12 },
  { name: "Denied", value: 2 },
  { name: "Deferred", value: 1 },
];

/* Holistic demand mix — drives the "Demand Signals" widget. Numbers are
   mock totals across the three demand sources surfaced on the Demands
   tab; the donut + list mirror Partners' "Spend by Category" layout. */
const DEMAND_SIGNALS_DATA = [
  { name: "Sales Orders", value: 18 },
  { name: "Low Stock", value: 10 },
  { name: "Purchase Requests", value: 7 },
];
const DEMAND_SIGNALS_COLORS = ["#0A77FF", "#EA580C", "#7C3AED"];

const PIE_COLORS = ["#0A77FF", "#16A34A", "#DC2626", "#94A3B8"];

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  fontSize: 12,
  fontFamily: FONT,
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function PODashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  /* Custom-range UI is gone (matched Partners' fixed-options dropdown).
     Kept as a stable empty value so existing rangeLabel() callsites work. */
  const customRange = useMemo(() => ({ from: "", to: "" }), []);
  /* Timestamp that the header's "Data view as of …" + Refresh Page link
     drive against — refresh just bumps it forward so the UI animates. */
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());
  const handleRefresh = () => {
    setLastRefreshed(new Date());
    toast.success("Dashboard refreshed");
  };
  const handleResetDashboard = () => {
    setTimeRange("1M");
    setLastRefreshed(new Date());
    toast.success("Dashboard reset to defaults");
  };

  const today = useMemo(() => new Date(), []);

  const rangeDays = useMemo(() => {
    if (timeRange === "CUSTOM" && customRange.from && customRange.to) {
      const from = new Date(customRange.from);
      const to = new Date(customRange.to);
      return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
    }
    return daysForRange(timeRange);
  }, [timeRange, customRange]);

  const filteredSpendTrend = useMemo(() => {
    /* SPEND_TREND_DATA is now daily, so we slice directly by day-count. */
    return SPEND_TREND_DATA.slice(Math.max(0, SPEND_TREND_DATA.length - rangeDays));
  }, [rangeDays]);

  const filteredWeeklyActivity = useMemo(() => {
    const weeks = Math.max(1, Math.ceil(rangeDays / 7));
    return WEEKLY_ACTIVITY_DATA.slice(Math.max(0, WEEKLY_ACTIVITY_DATA.length - weeks));
  }, [rangeDays]);

  const filteredResponseTime = useMemo(() => {
    const weeks = Math.max(1, Math.ceil(rangeDays / 7));
    return RESPONSE_TIME_DATA.slice(Math.max(0, RESPONSE_TIME_DATA.length - weeks));
  }, [rangeDays]);

  const totalSpend = useMemo(
    () => filteredSpendTrend.reduce((sum, d) => sum + d.amount, 0),
    [filteredSpendTrend]
  );
  const totalSpendStr = `$${(totalSpend / 1000).toFixed(1)}K`;
  const totalPosCount = useMemo(
    () => filteredWeeklyActivity.reduce((sum, d) => sum + d.created, 0),
    [filteredWeeklyActivity]
  );
  const avgOrderValue = totalPosCount > 0 ? `$${Math.round(totalSpend / totalPosCount).toLocaleString()}` : "—";


  return (
    /* Cash-Management-style shell — content capped at 1120px wide and
       centred so KPIs / charts don't stretch on wide viewports. */
    <div className="w-full max-w-[1120px] mx-auto flex flex-col gap-5" style={{ fontFamily: FONT }}>
      {/* ═════════ ONE-LINE CONTROL ROW — Partners-style ═════════
         Single horizontal strip carrying every dashboard control:
         "Performance Insights" + Calendar date-range dropdown on the left,
         Reset + Add Insights buttons on the right. */}
      {/* Info bar — verbatim lift from cash-management VendorDetailsPage
         dashboard control bar (lines 919-973). Reset is added on the
         right using the identical Customize Widgets style so the two
         buttons read as a pair. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] text-[#64748B]">
          <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Dashboard</span>
          {/* Date Range Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer">
                <Calendar className="w-3 h-3" />
                <span style={{ fontWeight: 500 }}>
                  {timeRange === "1W" && "Last 7 days"}
                  {timeRange === "1M" && "Last 30 days"}
                  {timeRange === "3M" && "Last 90 days"}
                  {timeRange === "1Y" && "Last 12 months"}
                  {timeRange === "MAX" && "All time"}
                </span>
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[170px]">
              {[
                { key: "1W", label: "Last 7 days" },
                { key: "1M", label: "Last 30 days" },
                { key: "3M", label: "Last 90 days" },
                { key: "1Y", label: "Last 12 months" },
                { key: "MAX", label: "All time" },
              ].map((opt) => (
                <DropdownMenuItem
                  key={opt.key}
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setTimeRange(opt.key as TimeRange)}
                >
                  <span className="text-sm">{opt.label}</span>
                  {timeRange === opt.key && (
                    <Check className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-[#CBD5E1]">|</span>
          <span className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 400 }}>
            Updated{" "}
            {lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
          </span>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 text-[11px] text-[#0A77FF] hover:text-[#0862D4] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDashboard}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#334155] text-[12px] shadow-sm transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#94A3B8]" />
            Reset
          </button>
          <button
            onClick={() => toast.info("Customize Widgets coming soon")}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#334155] text-[12px] shadow-sm transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Sliders className="w-3.5 h-3.5 text-[#94A3B8]" />
            Customize Widgets
          </button>
        </div>
      </div>

      {/* ═════════ KPI STRIP — health metrics, grid like Cash Management ═════════ */}
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}
      >
        <KpiCard
          icon={Package}
          tone="blue"
          label="Total POs"
          value={totalPosCount}
          caption={rangeLabel(timeRange, customRange)}
          tooltip="Total purchase orders created in the selected period"
        />
        <KpiCard
          icon={DollarSign}
          tone="green"
          label="Total Spend"
          value={totalSpendStr}
          badge={{ text: "+12%", color: "#16A34A" }}
          caption="vs prior period"
          tooltip="Sum of all PO values in the selected period"
        />
        <KpiCard
          icon={TrendingUp}
          tone="violet"
          label="Avg Order Value"
          value={avgOrderValue}
          caption={`Across ${totalPosCount} orders`}
        />
        <KpiCard
          icon={Clock}
          tone="orange"
          label="Pending Approvals"
          value={5}
          caption="Awaiting review"
        />
      </div>

      {/* ═════════ CHARTS — 2x2 grid (all same height) ═════════
         Order requested: 1) Demand Signals  2) Request Status
                          3) Spend Trend     4) Order Activity */}
      <div className="flex flex-wrap gap-3 items-stretch min-w-0">
        {/* 1 — Demand Signals (Partners donut) */}
        <div className="flex flex-col" style={{ flex: "1 1 calc(50% - 6px)", minWidth: 320, height: 340 }}>
          <WidgetCard icon={Package} title="Demand Signals">
            {(() => {
              const total = DEMAND_SIGNALS_DATA.reduce((s, d) => s + d.value, 0);
              return (
                <div className="flex flex-col items-center justify-between gap-4 h-full">
                  <div className="w-[150px] h-[150px] shrink-0 relative">
                    <PieChart width={150} height={150}>
                      <Pie
                        data={DEMAND_SIGNALS_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {DEMAND_SIGNALS_DATA.map((_, i) => (
                          <Cell key={i} fill={DEMAND_SIGNALS_COLORS[i % DEMAND_SIGNALS_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", fontFamily: FONT }}>
                        {total}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8", fontFamily: FONT }}>
                        active signals
                      </span>
                    </div>
                  </div>
                  <div className="w-full space-y-2">
                    {DEMAND_SIGNALS_DATA.map((s, idx) => {
                      const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                      return (
                        <div key={s.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: DEMAND_SIGNALS_COLORS[idx % DEMAND_SIGNALS_COLORS.length] }}
                            />
                            <span style={{ fontSize: 12, fontWeight: 500, color: "#475569", fontFamily: FONT }}>
                              {s.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", fontFamily: FONT }}>
                              {s.value}
                            </span>
                            <span
                              className="w-8 text-right"
                              style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", fontFamily: FONT }}
                            >
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </WidgetCard>
        </div>

        {/* 2 — Request Status (Partners donut) */}
        <div className="flex flex-col" style={{ flex: "1 1 calc(50% - 6px)", minWidth: 320, height: 340 }}>
          <WidgetCard icon={PieChartIcon} title="Request Status">
            {(() => {
              const total = REQUEST_STATUS_DATA.reduce((s, d) => s + d.value, 0);
              return (
                <div className="flex flex-col items-center justify-between gap-4 h-full">
                  <div className="w-[150px] h-[150px] shrink-0 relative">
                    <PieChart width={150} height={150}>
                      <Pie
                        data={REQUEST_STATUS_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {REQUEST_STATUS_DATA.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", fontFamily: FONT }}>
                        {total}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8", fontFamily: FONT }}>
                        requests
                      </span>
                    </div>
                  </div>
                  <div className="w-full space-y-2">
                    {REQUEST_STATUS_DATA.map((s, idx) => {
                      const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                      return (
                        <div key={s.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                            />
                            <span style={{ fontSize: 12, fontWeight: 500, color: "#475569", fontFamily: FONT }}>
                              {s.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", fontFamily: FONT }}>
                              {s.value}
                            </span>
                            <span
                              className="w-8 text-right"
                              style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", fontFamily: FONT }}
                            >
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </WidgetCard>
        </div>

        {/* 3 — Spend Trend (daily area) */}
        <ChartWidget
          icon={TrendingUp}
          title="Spend Trend"
          footerStats={[
            { label: rangeLabel(timeRange, customRange), value: totalSpendStr },
            { label: "vs prior period", value: "+12%", color: "#16A34A" },
            { label: "Daily avg", value: filteredSpendTrend.length > 0 ? `$${Math.round(filteredSpendTrend.reduce((s, d) => s + d.amount, 0) / filteredSpendTrend.length).toLocaleString()}` : "—" },
          ]}
        >
          <AreaChart data={filteredSpendTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="poDashSpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              axisLine={false}
              tickLine={false}
              interval={Math.max(0, Math.floor(filteredSpendTrend.length / 6) - 1)}
            />
            <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <ReTooltip contentStyle={TOOLTIP_STYLE} formatter={(val: number) => [`$${val.toLocaleString()}`, "Spend"]} />
            <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#poDashSpend)" />
          </AreaChart>
        </ChartWidget>

        {/* 4 — Order Activity (weekly bars) */}
        <ChartWidget
          icon={BarChart3}
          title="Order Activity"
          footerStats={[
            { label: "POs created", value: String(totalPosCount) },
            { label: "POs sent", value: String(filteredWeeklyActivity.reduce((s, d) => s + d.sent, 0)) },
            { label: "Total spend", value: totalSpendStr, color: "#1F2937" },
          ]}
        >
          <BarChart data={filteredWeeklyActivity} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <ReTooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="created" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={18} />
            <Bar dataKey="sent" fill="#7C3AED" radius={[4, 4, 0, 0]} barSize={18} />
          </BarChart>
        </ChartWidget>
      </div>
    </div>
  );
}
