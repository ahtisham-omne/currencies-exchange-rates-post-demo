import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useExchangeRates } from "../context/ExchangeRateContext";
import {
  generatePairDetail,
  BASE_CURRENCY,
  BASE_CURRENCY_NAME,
  API_PROVIDER,
  LAST_SYNC,
  SEED_MID_MARKET_RATES,
  type CurrencyPairDetail,
} from "../data/exchangeRates";
import { getFlagUrl } from "../utils/currencyFlags";
import {
  ArrowLeft,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Star,
  Download,
  Activity,
  Clock,
  BarChart3,
  Calendar,
  DollarSign,
  Target,
  Zap,
  AlertTriangle,
  FileText,
  RefreshCw,
  Pencil,
  MoreHorizontal,
  Printer,
  Link2,
  X,
  Search,
  Plus,
  Check,
  Info,
  Sliders,
  GripVertical,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  Globe,
  Eye,
  ArrowDownRight,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "../components/ui/dialog";
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from "../components/ui/tooltip";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, Legend, ReferenceLine,
} from "recharts";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

type TimeRange = "1D" | "5D" | "1M" | "1Y" | "5Y" | "MAX" | "CUSTOM";
const DND_KPI_TYPE = "EXCHANGE_KPI";
const TIME_RANGE_BUTTONS: { key: TimeRange; label: string }[] = [
  { key: "1D", label: "1D" },
  { key: "5D", label: "5D" },
  { key: "1M", label: "1M" },
  { key: "1Y", label: "1Y" },
  { key: "5Y", label: "5Y" },
  { key: "MAX", label: "Max" },
  { key: "CUSTOM", label: "Custom" },
];
// Map a TimeRange to the number of days to slice from the tail of the time series.
// The underlying series is 90 daily points, so 1Y / 5Y / Max all resolve to "everything we have".
function daysForRange(r: TimeRange): number {
  switch (r) {
    case "1D": return 1;
    case "5D": return 5;
    case "1M": return 30;
    case "1Y":
    case "5Y":
    case "MAX":
    case "CUSTOM":
    default: return 90;
  }
}

// ── Analytics Widget definitions ──
interface AnalyticsWidgetDef {
  key: string; label: string; description: string; iconName: string; category: string;
  previewType?: "line" | "area" | "bar" | "area-red";
}

const WIDGET_TOOLTIPS: Record<string, string> = {
  rate_over_time: "Shows both rates side by side over time. The market rate is the live line; your corporate rate is the stepped line. Hover any date to see both values and the gap between them.",
  variance_trend: "How far your corporate rate sits from the market each day. Colour bands: green within ±1%, amber 1–3%, red beyond 3%.",
  daily_change: "Shows how much the mid-market rate moved each day — up (green) or down (red). Tall bars mean big moves that day.",
  cumulative_return: "Shows the total movement of the mid-market rate since the start of the selected period. Answers: \"how much has this rate moved overall?\"",
  conversion_trend: "Type an amount in the source currency to see what it would have converted to in the base currency on each day. Useful for seeing how timing would have affected a transaction.",
  drawdown_from_peak: "Shows how far the mid-market rate has fallen from its recent high. 0% means it's at a new high; −2% means it's 2% below the highest point in the selected period.",
  corp_rate_step: "Step chart of your corporate rate over time — one step for every change you've made.",
  transaction_volume: "Bar chart of daily transaction count priced using this corporate rate.",
};

const ALL_ANALYTICS_WIDGETS: AnalyticsWidgetDef[] = [
  { key: "rate_over_time", label: "Rate Over Time", description: "Mid-Market vs Corporate rate trends", iconName: "TrendingUp", category: "Charts", previewType: "line" },
  { key: "variance_trend", label: "Variance Trend — Corporate vs Mid-Market", description: "Bar chart of corporate vs mid-market variance (thresholds at ±1% / ±3%)", iconName: "BarChart3", category: "Charts", previewType: "bar" },
  { key: "daily_change", label: "Daily % Change (Mid-Market)", description: "Area chart of daily percentage changes in the mid-market rate", iconName: "Activity", category: "Charts", previewType: "area" },
  { key: "cumulative_return", label: "Cumulative Return (Mid-Market)", description: "Area chart of cumulative return over time", iconName: "TrendingUp", category: "Charts", previewType: "area" },
  { key: "conversion_trend", label: "Conversion Trend (What-If)", description: "What-if conversion with amount input and summary", iconName: "DollarSign", category: "Charts", previewType: "line" },
  { key: "drawdown_from_peak", label: "Drawdown from Peak (Mid-Market)", description: "Downward red area chart from all-time high", iconName: "TrendingDown", category: "Charts", previewType: "area-red" },
  { key: "corp_rate_step", label: "Corporate Rate Change History", description: "Step chart of your corporate rate only", iconName: "Star", category: "Charts", previewType: "line" },
  { key: "transaction_volume", label: "Transaction Volume in this Pair", description: "Daily transaction count using this corporate rate", iconName: "BarChart3", category: "Charts", previewType: "bar" },
  { key: "rate_history", label: "Rate History", description: "Table of historical rate values", iconName: "FileText", category: "Tables" },
];

// Widgets allowed per mode. Corporate view excludes mid-only market behaviour charts
// (daily change, cumulative return, drawdown) and excludes audit log because audit
// is rendered as a fixed section below the charts.
const MID_WIDGET_KEYS = ["rate_over_time", "daily_change", "cumulative_return", "conversion_trend", "drawdown_from_peak", "variance_trend", "rate_history"];
// Corporate mode keeps Rate History locked-visible as a dedicated section, so it
// does not appear in the Customize Widgets list.
const STD_WIDGET_KEYS = ["rate_over_time", "variance_trend", "corp_rate_step", "transaction_volume", "conversion_trend"];

const DEFAULT_MID_WIDGETS = ["rate_over_time", "daily_change", "rate_history"];
const DEFAULT_STD_WIDGETS = ["rate_over_time", "variance_trend"];

// ── KPI definitions ──
interface ExKpiDef {
  key: string; label: string; category: string; iconName: string; tooltip?: string;
  iconBg?: string; iconColor?: string;
}

const ALL_KPI_DEFS: ExKpiDef[] = [
  { key: "current_mid", label: "Current Mid-Market Rate", category: "Rates", iconName: "Activity", iconBg: "#F5F3FF", iconColor: "#7C3AED" },
  { key: "current_std", label: "Current Corporate Rate", category: "Rates", iconName: "Star", iconBg: "#FFFBEB", iconColor: "#D97706" },
  { key: "change_24h", label: "Mid-Market 24h Change", category: "Performance", iconName: "Activity", iconBg: "#EDF4FF", iconColor: "#0A77FF", tooltip: "Percentage change in mid-market rate over the last 24 hours." },
  { key: "change_7d", label: "Mid-Market 7-Day Change", category: "Performance", iconName: "TrendingUp", iconBg: "#EDF4FF", iconColor: "#0A77FF" },
  { key: "change_30d", label: "Mid-Market 30-Day Change", category: "Performance", iconName: "TrendingUp", iconBg: "#ECFDF5", iconColor: "#059669" },
  { key: "change_ytd", label: "Mid-Market YTD Change", category: "Performance", iconName: "Calendar", iconBg: "#EFF6FF", iconColor: "#2563EB" },
  { key: "high_low_30d", label: "Mid-Market 30-Day High / Low", category: "Analytics", iconName: "BarChart3", iconBg: "#FFF7ED", iconColor: "#EA580C", tooltip: "Highest and lowest mid-market rates recorded in the last 30 days." },
  { key: "volatility_30d", label: "Mid-Market 30-Day Volatility", category: "Analytics", iconName: "Zap", iconBg: "#FEF2F2", iconColor: "#DC2626", tooltip: "Standard deviation of daily rate changes over 30 days.\n\nLow: < 0.3% — Stable pair, minimal fluctuation.\nModerate: 0.3–0.8% — Normal market movement.\nHigh: > 0.8% — Elevated risk, consider hedging." },
  { key: "avg_rate_30d", label: "Mid-Market Average Rate (30d)", category: "Analytics", iconName: "Target", iconBg: "#F0FDF4", iconColor: "#16A34A" },
  { key: "transactions_30d", label: "Mid-Market Transactions (30d)", category: "Operational", iconName: "FileText", iconBg: "#EDF4FF", iconColor: "#0A77FF", tooltip: "Number of transactions using this currency pair in the last 30 days." },
  // Corporate-specific KPIs
  { key: "variance", label: "Corporate Variance vs Mid-Market", category: "Rates", iconName: "Target", iconBg: "#FFFBEB", iconColor: "#D97706" },
  { key: "days_since_update", label: "Days Since Corporate Rate Last Updated", category: "Operational", iconName: "Calendar", iconBg: "#EDF4FF", iconColor: "#0A77FF" },
  { key: "corp_transactions_30d", label: "Corporate Rate Transactions (30d)", category: "Operational", iconName: "FileText", iconBg: "#EDF4FF", iconColor: "#0A77FF", tooltip: "Transactions priced using the corporate rate in the last 30 days." },
  { key: "fx_exposure_30d", label: "FX Exposure (30d)", category: "Operational", iconName: "Globe", iconBg: "#F0FDF4", iconColor: "#16A34A", tooltip: "Total transaction value booked in this currency pair over the last 30 days, expressed in the base currency." },
  { key: "max_variance_30d", label: "Max Corporate Variance (30d)", category: "Analytics", iconName: "TrendingUp", iconBg: "#FEF2F2", iconColor: "#DC2626" },
  { key: "avg_variance_30d", label: "Average Corporate Variance (30d)", category: "Analytics", iconName: "Target", iconBg: "#FFFBEB", iconColor: "#D97706" },
  { key: "change_count_30d", label: "Corporate Rate Change Count (30d)", category: "Operational", iconName: "Activity", iconBg: "#F5F3FF", iconColor: "#7C3AED" },
];

// KPIs relevant per context
const MID_KPI_KEYS = ["current_mid", "change_24h", "change_7d", "change_30d", "change_ytd", "high_low_30d", "volatility_30d", "avg_rate_30d", "transactions_30d"];
const STD_KPI_KEYS = ["current_std", "variance", "days_since_update", "corp_transactions_30d", "fx_exposure_30d", "max_variance_30d", "avg_variance_30d", "change_count_30d"];

const DEFAULT_MID_KPIS = ["current_mid", "change_24h", "change_30d", "high_low_30d", "volatility_30d"];
const DEFAULT_STD_KPIS = ["current_std", "variance", "days_since_update", "corp_transactions_30d", "fx_exposure_30d"];

function computeKpiValue(key: string, detail: CurrencyPairDetail): { value: string; change?: string; changeColor?: string; sublabel?: string } {
  switch (key) {
    case "current_mid": return {
      value: detail.currentMidRate.toFixed(4),
      change: `${detail.change24h > 0 ? "+" : ""}${detail.change24h.toFixed(2)}%`,
      changeColor: detail.change24h >= 0 ? "#059669" : "#EF4444",
      sublabel: `as of ${format(new Date(LAST_SYNC), "dd MMM yyyy, HH:mm")} today`,
    };
    case "current_std": return {
      value: detail.currentStdRate ? detail.currentStdRate.toFixed(4) : "Not Set",
      sublabel: detail.stdEffectiveDate ? `Effective ${format(new Date(detail.stdEffectiveDate), "dd MMM yyyy")}` : undefined,
    };
    case "change_24h": return { value: `${detail.change24h > 0 ? "+" : ""}${detail.change24h.toFixed(2)}%` };
    case "change_7d": return { value: `${detail.change7d > 0 ? "+" : ""}${detail.change7d.toFixed(2)}%` };
    case "change_30d": return { value: `${detail.change30d > 0 ? "+" : ""}${detail.change30d.toFixed(2)}%` };
    case "change_ytd": return { value: `${detail.changeYtd > 0 ? "+" : ""}${detail.changeYtd.toFixed(2)}%` };
    case "high_low_30d": {
      const spread = (detail.high30d - detail.low30d).toFixed(4);
      return { value: `${detail.high30d.toFixed(2)} / ${detail.low30d.toFixed(2)}`, sublabel: `Spread: ${spread}` };
    }
    case "volatility_30d": {
      const label = detail.volatility30d < 0.3 ? "Low" : detail.volatility30d < 0.8 ? "Moderate" : "High";
      return { value: `${detail.volatility30d.toFixed(3)}%`, change: label, changeColor: detail.volatility30d < 0.3 ? "#059669" : detail.volatility30d < 0.8 ? "#D97706" : "#EF4444" };
    }
    case "avg_rate_30d": return { value: detail.avgRate30d.toFixed(4) };
    case "variance":
      return {
        value: detail.variance !== null ? `${detail.variance > 0 ? "+" : ""}${detail.variance.toFixed(2)}%` : "N/A",
        changeColor: detail.variance !== null ? (Math.abs(detail.variance) <= 1 ? "#059669" : Math.abs(detail.variance) <= 3 ? "#D97706" : "#EF4444") : undefined,
      };
    case "transactions_30d": return { value: String(detail.transactions30d) };
    case "corp_transactions_30d": return { value: String(Math.floor(detail.transactions30d * 0.7)) };
    case "days_since_update": {
      if (!detail.stdEffectiveDate) return { value: "N/A" };
      const days = Math.max(0, Math.floor((Date.now() - new Date(detail.stdEffectiveDate).getTime()) / 86400000));
      return { value: `${days} days`, sublabel: `Since ${format(new Date(detail.stdEffectiveDate), "dd MMM yyyy")}` };
    }
    case "fx_exposure_30d": {
      const exposure = detail.transactions30d * detail.avgRate30d * 1200; // rough value estimation
      return {
        value: `${BASE_CURRENCY} ${exposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        sublabel: `${detail.transactions30d} transactions`,
      };
    }
    case "max_variance_30d": {
      // Approximate: largest variance seen over the series window
      if (detail.variance === null) return { value: "N/A" };
      const max = Math.max(Math.abs(detail.variance) * 1.5, Math.abs(detail.variance));
      return { value: `${max.toFixed(2)}%` };
    }
    case "avg_variance_30d": {
      if (detail.variance === null) return { value: "N/A" };
      return { value: `${detail.variance.toFixed(2)}%` };
    }
    case "change_count_30d": return { value: String(detail.auditLog.length) };
    default: return { value: "–" };
  }
}

// ── Icon mapper ──
function KpiIconByName({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const p = { className, style };
  switch (name) {
    case "Activity": return <Activity {...p} />;
    case "TrendingUp": return <TrendingUp {...p} />;
    case "TrendingDown": return <TrendingDown {...p} />;
    case "Calendar": return <Calendar {...p} />;
    case "BarChart3": return <BarChart3 {...p} />;
    case "Zap": return <Zap {...p} />;
    case "Target": return <Target {...p} />;
    case "FileText": return <FileText {...p} />;
    case "Star": return <Star {...p} />;
    case "DollarSign": return <DollarSign {...p} />;
    case "Globe": return <Globe {...p} />;
    default: return <Activity {...p} />;
  }
}

// ── Mini chart previews for widget panel ──
function MiniChartPreview({ type }: { type?: string }) {
  if (type === "line") return (
    <svg viewBox="0 0 120 40" className="w-full h-10">
      <polyline points="5,30 20,25 35,28 50,18 65,22 80,12 95,15 115,8" fill="none" stroke="#0A77FF" strokeWidth="2" strokeLinecap="round" />
      <polyline points="5,32 20,30 35,31 50,28 65,29 80,26 95,27 115,24" fill="none" stroke="#D97706" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
    </svg>
  );
  if (type === "area") return (
    <svg viewBox="0 0 120 40" className="w-full h-10">
      <defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity="0.2" /><stop offset="100%" stopColor="#7C3AED" stopOpacity="0.02" /></linearGradient></defs>
      <path d="M5,30 20,25 35,28 50,18 65,22 80,14 95,20 115,10 115,38 5,38Z" fill="url(#mg)" />
      <polyline points="5,30 20,25 35,28 50,18 65,22 80,14 95,20 115,10" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  if (type === "area-red") return (
    <svg viewBox="0 0 120 40" className="w-full h-10">
      <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EF4444" stopOpacity="0.2" /><stop offset="100%" stopColor="#EF4444" stopOpacity="0.02" /></linearGradient></defs>
      <path d="M5,8 20,12 35,10 50,20 65,18 80,28 95,25 115,32 115,38 5,38Z" fill="url(#rg)" />
      <polyline points="5,8 20,12 35,10 50,20 65,18 80,28 95,25 115,32" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  if (type === "bar") return (
    <svg viewBox="0 0 120 40" className="w-full h-10">
      {[10,20,30,45,60,75,90,105].map((x, i) => (
        <rect key={i} x={x} y={12 + Math.random() * 12} width="8" height={16 + Math.random() * 10} rx="2" fill="#D97706" opacity="0.6" />
      ))}
    </svg>
  );
  return null;
}

// ── Draggable KPI Card ──
function DraggableKpiCard({ index, kpiKey, label, value, tooltip, sublabel, change, changeColor, moveCard, onRemove, iconName, iconBg, iconColor }: {
  index: number; kpiKey: string; label: string; value: string; tooltip?: string; sublabel?: string;
  change?: string; changeColor?: string; moveCard: (from: number, to: number) => void; onRemove?: () => void; iconName?: string;
  iconBg?: string; iconColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_KPI_TYPE,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });
  const [{ isOver }, drop] = useDrop({
    accept: DND_KPI_TYPE,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      const hoverRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverRect.right - hoverRect.left) / 2;
      const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverRect.left;
      const hoverClientY = clientOffset.y - hoverRect.top;
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY && hoverClientX < hoverMiddleX) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY && hoverClientX > hoverMiddleX) return;
      moveCard(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });
  preview(drop(ref));
  drag(ref);

  if (isDragging) {
    return <div ref={ref} className="rounded-lg border border-dashed border-[#0A77FF]/20 bg-[#0A77FF]/[0.02] min-h-[52px] pointer-events-none" />;
  }

  return (
    <div
      ref={ref}
      className={`border rounded-lg bg-white group relative min-w-0 transition-all duration-200 select-none overflow-hidden cursor-grab active:cursor-grabbing ${
        isOver
          ? "border-[#0A77FF]/30 bg-[#0A77FF]/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]"
          : "border-[#E2E8F0] hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
      }`}
    >
      {isOver && <div className="absolute inset-0 rounded-lg bg-[#0A77FF]/[0.02] pointer-events-none" />}
      <div className="px-3 py-2">
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-[#F1F5F9] rounded-md p-1 z-10 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-[#64748B]" />
        </div>
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {iconName && (
              <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg || "#EDF4FF" }}>
                <KpiIconByName name={iconName} className="w-3 h-3" style={{ color: iconColor || "#0A77FF" }} />
              </div>
            )}
            <p className="text-[10.5px] text-[#64748B] whitespace-nowrap truncate" style={{ fontWeight: 500 }}>{label}</p>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                      <Info className="w-3 h-3 text-[#CBD5E1] hover:text-[#94A3B8] transition-colors cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[280px] text-[11px] z-[300] whitespace-pre-line">{tooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          {change && <span className="text-[10px] shrink-0" style={{ fontWeight: 500, color: changeColor || "#059669" }}>{change}</span>}
          <p className="text-[15px] text-[#334155] tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
        </div>
        {sublabel && (
          <p className="text-[9.5px] text-[#94A3B8] mt-0.5 truncate" style={{ fontWeight: 400 }}>{sublabel}</p>
        )}
      </div>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
          title={`Remove ${label}`}
        >
          <Trash2 className="w-3 h-3 text-[#94A3B8] hover:text-[#EF4444]" />
        </button>
      )}
    </div>
  );
}

// ── Widget Category Icon ──
function WidgetCategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "Rates": return <DollarSign className="w-4 h-4 text-muted-foreground" />;
    case "Performance": return <TrendingUp className="w-4 h-4 text-muted-foreground" />;
    case "Analytics": return <BarChart3 className="w-4 h-4 text-muted-foreground" />;
    case "Operational": return <Globe className="w-4 h-4 text-muted-foreground" />;
    case "Charts": return <Activity className="w-4 h-4 text-muted-foreground" />;
    case "Tables": return <FileText className="w-4 h-4 text-muted-foreground" />;
    default: return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
}

// ── Customize Widgets Panel (with previews like Partners) ──
function CustomizeKpiPanel({ open, onOpenChange, activeKpis, onToggleKpi, detail, allowedKeys, allowedWidgetKeys, activeWidgets, onToggleWidget }: {
  open: boolean; onOpenChange: (open: boolean) => void; activeKpis: string[]; onToggleKpi: (key: string) => void; detail: CurrencyPairDetail;
  allowedKeys: string[]; allowedWidgetKeys: string[]; activeWidgets: string[]; onToggleWidget: (key: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"kpis" | "widgets">("kpis");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) { setMounted(true); if (timeoutRef.current) clearTimeout(timeoutRef.current); requestAnimationFrame(() => { requestAnimationFrame(() => setVisible(true)); }); }
    else { setVisible(false); timeoutRef.current = setTimeout(() => setMounted(false), 280); }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [open]);

  const allowedDefs = useMemo(() => ALL_KPI_DEFS.filter(k => allowedKeys.includes(k.key)), [allowedKeys]);

  const kpiCategories = useMemo(() => {
    const catMap = new Map<string, ExKpiDef[]>();
    for (const kpi of allowedDefs) {
      if (searchQuery && !kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) && !kpi.category.toLowerCase().includes(searchQuery.toLowerCase())) continue;
      if (!catMap.has(kpi.category)) catMap.set(kpi.category, []);
      catMap.get(kpi.category)!.push(kpi);
    }
    return Array.from(catMap.entries()).map(([name, kpis]) => ({ name, kpis }));
  }, [searchQuery, allowedDefs]);

  const widgetCategories = useMemo(() => {
    const available = ALL_ANALYTICS_WIDGETS.filter(w => {
      if (!allowedWidgetKeys.includes(w.key)) return false;
      // Variance Trend only surfaces when a corporate rate exists for this pair
      if (w.key === "variance_trend" && !detail.currentStdRate) return false;
      if (searchQuery && !w.label.toLowerCase().includes(searchQuery.toLowerCase()) && !w.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
    const catMap = new Map<string, AnalyticsWidgetDef[]>();
    for (const w of available) {
      if (!catMap.has(w.category)) catMap.set(w.category, []);
      catMap.get(w.category)!.push(w);
    }
    return { categories: Array.from(catMap.entries()).map(([name, widgets]) => ({ name, widgets })), available };
  }, [searchQuery, allowedWidgetKeys, detail.currentStdRate]);

  if (!mounted) return null;

  const totalKpis = allowedDefs.length;
  const totalWidgets = widgetCategories.available.length;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out" style={{ backgroundColor: visible ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0)", pointerEvents: visible ? "auto" : "none" }} onClick={() => onOpenChange(false)} />
      <div className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ transform: visible ? "translateX(0)" : "translateX(100%)" }}>
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#EDF4FF" }}>
                <Sliders className="w-5 h-5" style={{ color: "#0A77FF" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Customize Widgets</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">Manage your dashboard KPI widgets.</p>
              </div>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Count + Enable All */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeTab === "kpis" ? `${activeKpis.length} of ${totalKpis} KPIs active` : `${activeWidgets.filter(w => widgetCategories.available.some(aw => aw.key === w)).length} of ${totalWidgets} widgets active`}
            </span>
            <button
              onClick={() => {
                if (activeTab === "kpis") {
                  const allKeys = allowedDefs.map(k => k.key);
                  const allActive = allKeys.every(k => activeKpis.includes(k));
                  if (allActive) { activeKpis.forEach(k => onToggleKpi(k)); } else { allKeys.filter(k => !activeKpis.includes(k)).forEach(k => onToggleKpi(k)); }
                } else {
                  const allKeys = widgetCategories.available.map(w => w.key);
                  const allActive = allKeys.every(k => activeWidgets.includes(k));
                  if (allActive) { allKeys.forEach(k => onToggleWidget(k)); } else { allKeys.filter(k => !activeWidgets.includes(k)).forEach(k => onToggleWidget(k)); }
                }
              }}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-[#EBF3FF] hover:border-[#0A77FF]/25 hover:text-[#0A77FF]"
              style={{ fontWeight: 600 }}
            >
              <Eye className="w-4 h-4" />
              <span>Enable All</span>
            </button>
          </div>

          {/* Search */}
          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
              <input placeholder="Search metrics..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors" />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0 mt-3 px-1">
            {(["kpis", "widgets"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-[12px] text-center transition-all cursor-pointer border-b-2 ${
                  activeTab === tab
                    ? "border-[#0A77FF] text-[#0A77FF]"
                    : "border-transparent text-[#94A3B8] hover:text-[#64748B]"
                }`}
                style={{ fontWeight: activeTab === tab ? 600 : 500 }}
              >
                {tab === "kpis" ? "KPIs" : "Widgets"}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-[#F1F5F9] shrink-0" />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {activeTab === "kpis" ? (
            <>
              {kpiCategories.length === 0 && (<div className="flex flex-col items-center py-12 text-muted-foreground"><Search className="w-5 h-5 mb-2 opacity-40" /><p className="text-xs text-muted-foreground/60">No metrics found</p></div>)}
              {kpiCategories.map((cat) => (
                <div key={cat.name} className="mt-5 first:mt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <WidgetCategoryIcon category={cat.name} />
                    <span className="text-[12px] text-muted-foreground/70 uppercase tracking-wide" style={{ fontWeight: 600 }}>{cat.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.kpis.map((kpi) => {
                      const isActive = activeKpis.includes(kpi.key);
                      const computed = computeKpiValue(kpi.key, detail);
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
                            <span className={`text-[11.5px] truncate transition-colors ${isActive ? "text-[#0A77FF]" : "text-muted-foreground/70"}`} style={{ fontWeight: 500 }} title={kpi.label}>{kpi.label}</span>
                            <div className="shrink-0">
                              {isActive ? <Check className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} /> : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />}
                            </div>
                          </div>
                          <p className={`text-[15px] mt-1 transition-colors ${isActive ? "text-foreground" : "text-foreground/80"}`} style={{ fontWeight: 550 }}>{computed.value}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {widgetCategories.categories.length === 0 && (<div className="flex flex-col items-center py-12 text-muted-foreground"><Search className="w-5 h-5 mb-2 opacity-40" /><p className="text-xs text-muted-foreground/60">No widgets found</p></div>)}
              {widgetCategories.categories.map((cat) => (
                <div key={cat.name} className="mt-5 first:mt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <WidgetCategoryIcon category={cat.name} />
                    <span className="text-[12px] text-muted-foreground/70 uppercase tracking-wide" style={{ fontWeight: 600 }}>{cat.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.widgets.map((widget) => {
                      const isActive = activeWidgets.includes(widget.key);
                      return (
                        <button
                          key={widget.key}
                          onClick={() => onToggleWidget(widget.key)}
                          className={`relative text-left rounded-xl border overflow-hidden transition-all duration-150 cursor-pointer group ${
                            isActive
                              ? "border-[#0A77FF]/25 bg-[#0A77FF]/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                              : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                          }`}
                        >
                          {/* Preview area */}
                          <div className={`px-3 pt-3 pb-1 ${isActive ? "bg-[#EDF4FF]/50" : "bg-[#F8FAFC]"}`}>
                            <MiniChartPreview type={widget.previewType} />
                            {/* Toggle indicator */}
                            <div className="absolute top-2 right-2">
                              {isActive ? (
                                <div className="w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-[#CBD5E1] bg-white" />
                              )}
                            </div>
                          </div>
                          {/* Info */}
                          <div className="px-3 py-2.5">
                            <span className={`text-[12px] transition-colors block ${isActive ? "text-foreground" : "text-foreground/80"}`} style={{ fontWeight: 600 }}>{widget.label}</span>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{widget.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Chart tooltip style ──
const ttStyle = { borderRadius: 8, border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 };

// ── ContentCard ──
function ContentCard({ title, icon: Icon, children, action, tooltipText }: {
  title: string; icon?: React.ElementType; children: React.ReactNode; action?: React.ReactNode; tooltipText?: string;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden h-full flex flex-col shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] transition-shadow">
      <div className="px-4 py-2.5 border-b border-[#F1F5F9] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="w-7 h-7 rounded-lg bg-[#EDF4FF] flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-[#0A77FF]" />
            </div>
          )}
          <span className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>{title}</span>
          {tooltipText && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                    <Info className="w-3.5 h-3.5 text-[#CBD5E1] hover:text-[#94A3B8] transition-colors cursor-help" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="max-w-[300px] text-[11px] z-[300] whitespace-pre-line">{tooltipText}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}

export function CurrencyPairDetailPage() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { midMarketRates, standardRates, updateStandardRate } = useExchangeRates();

  const rateType = searchParams.get("type") || "mid";

  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [customizePanelOpen, setCustomizePanelOpen] = useState(false);
  const [activeKpis, setActiveKpis] = useState<string[]>(rateType === "std" ? [...DEFAULT_STD_KPIS] : [...DEFAULT_MID_KPIS]);
  const [activeWidgets, setActiveWidgets] = useState<string[]>(rateType === "std" ? [...DEFAULT_STD_WIDGETS] : [...DEFAULT_MID_WIDGETS]);
  const [conversionAmount, setConversionAmount] = useState("1000");

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ standardRate: "", effectiveDate: "", notes: "" });

  const detail = useMemo(() => {
    if (!code) return null;
    return generatePairDetail(code);
  }, [code]);

  const chartData = useMemo(() => {
    if (!detail) return [];
    if (timeRange === "CUSTOM" && customRange.from && customRange.to) {
      return detail.timeSeries.filter(p => p.date >= customRange.from && p.date <= customRange.to);
    }
    const days = daysForRange(timeRange);
    return detail.timeSeries.slice(-days - 1);
  }, [detail, timeRange, customRange]);

  const varianceData = useMemo(() => {
    return chartData.map(d => ({
      date: d.date,
      variance: d.std ? +((d.std - d.mid) / d.mid * 100).toFixed(2) : 0,
    }));
  }, [chartData]);

  // Drawdown data
  const drawdownData = useMemo(() => {
    let peak = 0;
    return chartData.map(d => {
      if (d.mid > peak) peak = d.mid;
      const drawdown = peak > 0 ? -((peak - d.mid) / peak * 100) : 0;
      return { date: d.date, drawdown: +drawdown.toFixed(3) };
    });
  }, [chartData]);

  // Daily transaction volume (deterministic pseudo-data keyed off the date string)
  const transactionVolumeData = useMemo(() => {
    return chartData.map(d => {
      let h = 0;
      for (let i = 0; i < d.date.length; i++) h = ((h << 5) - h + d.date.charCodeAt(i)) | 0;
      const count = 3 + (Math.abs(h) % 20); // 3..22 txns per day
      return { date: d.date, count };
    });
  }, [chartData]);

  // Conversion trend data
  const conversionData = useMemo(() => {
    const amt = parseFloat(conversionAmount) || 1000;
    return chartData.map(d => ({
      date: d.date,
      converted: +(amt * d.mid).toFixed(2),
    }));
  }, [chartData, conversionAmount]);

  const handleToggleKpi = useCallback((key: string) => {
    setActiveKpis(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);

  const handleToggleWidget = useCallback((key: string) => {
    setActiveWidgets(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);

  const moveKpi = useCallback((fromIndex: number, toIndex: number) => {
    setActiveKpis(prev => { const next = [...prev]; const [moved] = next.splice(fromIndex, 1); next.splice(toIndex, 0, moved); return next; });
  }, []);

  const activeKpiDefs = useMemo(
    () => activeKpis.map(k => ALL_KPI_DEFS.find(d => d.key === k)).filter(Boolean) as ExKpiDef[],
    [activeKpis]
  );

  // Scrolled state for compact header
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { root, threshold: 0, rootMargin: "-44px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const isStandardDetail = rateType === "std";
  const stdRecord = standardRates.find(r => r.sourceCurrency === code);
  const midRecord = midMarketRates.find(r => r.sourceCurrency === code);

  const openEditModal = useCallback(() => {
    if (!stdRecord) return;
    setEditForm({
      standardRate: String(stdRecord.standardRate),
      effectiveDate: stdRecord.effectiveDate,
      notes: stdRecord.notes,
    });
    setEditModalOpen(true);
  }, [stdRecord]);

  const handleEditSave = useCallback(() => {
    if (!stdRecord || !code) return;
    const rateVal = parseFloat(editForm.standardRate);
    if (isNaN(rateVal) || rateVal <= 0 || !editForm.effectiveDate) {
      toast.error("Please fill all required fields with valid values");
      return;
    }
    const midRate = midRecord?.rate || 0;
    const variance = midRate > 0 ? +((rateVal - midRate) / midRate * 100).toFixed(2) : 0;
    updateStandardRate(stdRecord.id, {
      standardRate: rateVal,
      effectiveDate: editForm.effectiveDate,
      notes: editForm.notes,
      midMarketRate: midRate,
      variance,
    });
    toast.success(`Corporate rate for ${code} updated`);
    setEditModalOpen(false);
  }, [stdRecord, code, editForm, midRecord, updateStandardRate]);

  const editLiveVariance = useMemo(() => {
    const rateVal = parseFloat(editForm.standardRate);
    if (isNaN(rateVal) || !midRecord) return null;
    return +((rateVal - midRecord.rate) / midRecord.rate * 100).toFixed(2);
  }, [editForm.standardRate, midRecord]);

  const statusConfig = { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", label: "Active" };

  if (!detail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
          <ArrowLeftRight className="w-8 h-8 text-[#94A3B8]" />
        </div>
        <p className="text-[#64748B] text-sm">Currency pair not found.</p>
        <Button variant="outline" onClick={() => navigate("/accounting/exchange-rates")} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back to Exchange Rates
        </Button>
      </div>
    );
  }

  

  return (
    <div ref={scrollContainerRef} className="flex-1 flex flex-col overflow-y-auto bg-[#F8FAFC]">
      {/* ══ TOP NAV BAR ══ */}
      <div className="bg-white border-b border-[#E2E8F0] shrink-0 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 lg:px-6 h-11">
          <div className="flex items-center gap-2 text-[13px] text-[#64748B]">
            <button onClick={() => navigate("/accounting")} className="hover:text-[#0F172A] transition-colors cursor-pointer" style={{ fontWeight: 500 }}>Accounting</button>
            <span className="text-[#CBD5E1]">/</span>
            <button onClick={() => navigate("/accounting/exchange-rates")} className="hover:text-[#0F172A] transition-colors cursor-pointer" style={{ fontWeight: 500 }}>Exchange Rate Library</button>
            <span className="text-[#CBD5E1]">/</span>
            <span className="text-[#0F172A]" style={{ fontWeight: 500 }}>{detail.pairCode}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border-2 border-[#E2E8F0]" style={{ backgroundColor: '#0A77FF' }}>
              <span className="text-[11px] text-white" style={{ fontWeight: 600 }}>AA</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>Ahtisham Ahmad</p>
              <p className="text-[11px] text-[#94A3B8] leading-tight">Product Designer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sentinel for scroll detection */}
      <div ref={sentinelRef} className="shrink-0 h-px" />

      {/* ══ STICKY HEADER ══ */}
      <div className="shrink-0 sticky top-[44px] z-20 bg-[#F8FAFC]">
        <div style={{ paddingTop: isScrolled ? "8px" : "12px", paddingBottom: "4px", transition: "padding-top 250ms ease" }}>
          <div className="mx-auto px-4 lg:px-6 xl:px-8 max-w-[1440px] 2xl:max-w-[1600px]">
            <div className={`bg-white border border-[#E2E8F0] rounded-xl overflow-hidden transition-shadow duration-250 ${isScrolled ? "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]" : "shadow-sm"}`}>
              <div
                className="flex items-center justify-between gap-4 px-4 lg:px-5 transition-all duration-250 ease-in-out"
                style={{ padding: isScrolled ? "6px 16px" : "12px 16px" }}
              >
                {/* Left: Back + Icon + Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => navigate("/accounting/exchange-rates")}
                    className="rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-all duration-250"
                    style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44 }}
                  >
                    <ChevronLeft className="text-[#94A3B8] transition-all duration-250" style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20 }} />
                  </button>

                  <div
                    className="rounded-xl flex items-center justify-center shrink-0 border border-white shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_0_0_2px_rgba(10,119,255,0.10)] transition-all duration-250"
                    style={{
                      width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44,
                      backgroundColor: isStandardDetail ? "#FFFBEB" : "#F5F3FF",
                    }}
                  >
                    <ArrowLeftRight
                      className="transition-all duration-250"
                      style={{ width: isScrolled ? 14 : 20, height: isScrolled ? 14 : 20, color: isStandardDetail ? "#D97706" : "#7C3AED" }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-1.5 transition-all duration-250" style={{ gap: isScrolled ? 6 : 8 }}>
                      <h1
                        className="text-[#0F172A] truncate transition-all duration-250"
                        style={{ fontSize: isScrolled ? 13 : 16, fontWeight: isScrolled ? 600 : 700, lineHeight: isScrolled ? "18px" : "22px" }}
                      >
                        {detail.pairCode}
                      </h1>

                      <span
                        className="inline-flex items-center rounded-full border transition-all duration-250"
                        style={{ padding: isScrolled ? "1px 6px" : "2px 8px", fontSize: isScrolled ? 10 : 11, fontWeight: 500, backgroundColor: statusConfig.bg, color: statusConfig.color, borderColor: statusConfig.border }}
                      >
                        {statusConfig.label}
                      </span>

                      {isStandardDetail ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-md border transition-all duration-250 border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]"
                          style={{ padding: isScrolled ? "1px 6px" : "2px 8px", fontSize: isScrolled ? 10 : 11, fontWeight: 600 }}
                        >
                          <Star className="transition-all duration-250" style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                          Corporate Rate
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-md border transition-all duration-250 border-[#DDD6FE] bg-[#F5F3FF] text-[#7C3AED]"
                          style={{ padding: isScrolled ? "1px 6px" : "2px 8px", fontSize: isScrolled ? 10 : 11, fontWeight: 600 }}
                        >
                          <Activity className="transition-all duration-250" style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                          Mid-Market Rate
                        </span>
                      )}
                    </div>
                    {!isScrolled && (
                      <p className="text-[12px] text-[#64748B] mt-0.5">{detail.sourceCurrencyName} → {BASE_CURRENCY_NAME}</p>
                    )}
                  </div>
                </div>

                {/* Right: Actions — Edit Rate lives only on the corporate detail page.
                   Mid-market data comes from the API and isn't owned by the company,
                   so there is no Export/Edit affordance on this page. */}
                <div className="flex items-center gap-2 shrink-0">
                  {isStandardDetail && stdRecord && (
                    <button
                      onClick={openEditModal}
                      className={`rounded-lg bg-[#0A77FF] hover:bg-[#0862D0] text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? "h-8 px-3.5 text-[12px]" : "h-9 px-4 text-[13px]"}`}
                      style={{ fontWeight: 600 }}
                    >
                      <Pencil className={isScrolled ? "w-3 h-3" : "w-3.5 h-3.5"} />
                      Edit Rate
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll to top FAB */}
      <button
        onClick={() => { scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-white border border-[#E2E8F0] shadow-[0_2px_12px_-3px_rgba(0,0,0,0.12)] flex items-center justify-center cursor-pointer hover:bg-[#F8FAFC] active:scale-95 transition-all duration-300"
        style={{ width: 40, height: 40, opacity: isScrolled ? 1 : 0, transform: isScrolled ? "translateY(0) scale(1)" : "translateY(16px) scale(0.9)", pointerEvents: isScrolled ? "auto" : "none" }}
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-5 h-5 text-[#64748B]" />
      </button>

      {/* ══ BODY ══ */}
      <div className="flex-1">
        <div className="mx-auto px-4 lg:px-6 xl:px-8 pt-3 pb-5 space-y-4 max-w-[1440px] 2xl:max-w-[1600px]">
          {/* Info bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] text-[#64748B]">
              <span className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 400 }}>
                Synced every 24h from {API_PROVIDER} · Updated as of {format(new Date(LAST_SYNC), "dd MMM yyyy")} at {format(new Date(LAST_SYNC), "HH:mm")} PKT
              </span>
            </div>
            <button
              onClick={() => setCustomizePanelOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#334155] text-[12px] shadow-sm transition-all cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              <Sliders className="w-3.5 h-3.5 text-[#94A3B8]" /> Customize Widgets
            </button>
          </div>

          {/* KPI Cards — draggable, 5 in a row */}
          {activeKpiDefs.length > 0 && (
            <DndProvider backend={HTML5Backend}>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(activeKpiDefs.length, 5)}, 1fr)` }}>
                {activeKpiDefs.map((kpi, idx) => {
                  const computed = computeKpiValue(kpi.key, detail);
                  return (
                    <DraggableKpiCard
                      key={kpi.key}
                      index={idx}
                      kpiKey={kpi.key}
                      label={kpi.label}
                      value={computed.value}
                      iconName={kpi.iconName}
                      iconBg={kpi.iconBg}
                      iconColor={kpi.iconColor}
                      tooltip={kpi.tooltip}
                      sublabel={computed.sublabel}
                      change={computed.change}
                      changeColor={computed.changeColor}
                      moveCard={moveKpi}
                      onRemove={() => handleToggleKpi(kpi.key)}
                    />
                  );
                })}
              </div>
            </DndProvider>
          )}

          {/* ══ Analytics Widgets (Charts) ══ */}
          {activeWidgets.some(w => ["rate_over_time", "variance_trend", "daily_change", "cumulative_return", "conversion_trend", "drawdown_from_peak", "corp_rate_step", "transaction_volume"].includes(w)) && (
            <div className="space-y-3">
              {/* Google-pattern time range selector */}
              <div className="flex items-center flex-wrap gap-1">
                {TIME_RANGE_BUTTONS.map(({ key: r, label }) => {
                  const isCustom = r === "CUSTOM";
                  if (isCustom) {
                    return (
                      <div key={r} className="relative">
                        <button
                          onClick={() => setCustomPopoverOpen(o => !o)}
                          className={`px-3 py-1 rounded-md text-[12px] transition-all inline-flex items-center gap-1 ${
                            timeRange === r ? "bg-[#0A77FF] text-white shadow-sm" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                          }`}
                          style={{ fontWeight: timeRange === r ? 600 : 500 }}
                        >
                          <Calendar className="w-3 h-3" />
                          {label}
                          {timeRange === "CUSTOM" && customRange.from && customRange.to && (
                            <span className="text-[11px]">: {format(new Date(customRange.from), "dd MMM")} – {format(new Date(customRange.to), "dd MMM")}</span>
                          )}
                        </button>
                        {customPopoverOpen && (
                          <div className="absolute top-full mt-2 left-0 z-30 w-[280px] rounded-xl border border-[#E2E8F0] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.10)] p-3">
                            <p className="text-[11px] text-muted-foreground mb-2" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Custom Range</p>
                            <div className="space-y-2">
                              <div>
                                <Label className="text-[11px] text-muted-foreground mb-1">From</Label>
                                <Input type="date" value={customRange.from} onChange={e => setCustomRange(p => ({ ...p, from: e.target.value }))} className="h-8 text-[12px]" />
                              </div>
                              <div>
                                <Label className="text-[11px] text-muted-foreground mb-1">To</Label>
                                <Input type="date" value={customRange.to} onChange={e => setCustomRange(p => ({ ...p, to: e.target.value }))} className="h-8 text-[12px]" />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              <Button
                                size="sm"
                                className="flex-1 h-8 text-[12px]"
                                disabled={!customRange.from || !customRange.to}
                                onClick={() => { setTimeRange("CUSTOM"); setCustomPopoverOpen(false); }}
                              >
                                Apply
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => setCustomPopoverOpen(false)}>Cancel</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <button
                      key={r}
                      onClick={() => setTimeRange(r)}
                      className={`px-3 py-1 rounded-md text-[12px] transition-all ${
                        timeRange === r ? "bg-[#0A77FF] text-white shadow-sm" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                      }`}
                      style={{ fontWeight: timeRange === r ? 600 : 500 }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {activeWidgets.includes("rate_over_time") && (
                  <ContentCard title="Rate Over Time — Mid-Market vs Corporate" icon={TrendingUp} tooltipText={WIDGET_TOOLTIPS.rate_over_time}>
                    <div style={{ height: 250 }} className="-ml-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => format(new Date(v), "dd MMM")} />
                          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                          <ReTooltip contentStyle={ttStyle} labelFormatter={v => format(new Date(v), "dd MMM yyyy")} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="mid" name="Mid-Market" stroke="#0A77FF" strokeWidth={2} dot={false} />
                          {detail.currentStdRate && <Line type="stepAfter" dataKey="std" name="Corporate" stroke="#D97706" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </ContentCard>
                )}

                {activeWidgets.includes("variance_trend") && detail.currentStdRate && (
                  <ContentCard title="Variance Trend — Corporate vs Mid-Market" icon={BarChart3} tooltipText={WIDGET_TOOLTIPS.variance_trend}>
                    <div style={{ height: 250 }} className="-ml-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={varianceData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => format(new Date(v), "dd MMM")} />
                          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} unit="%" />
                          <ReTooltip contentStyle={ttStyle} labelFormatter={v => format(new Date(v), "dd MMM yyyy")} />
                          <ReferenceLine y={1} stroke="#94A3B8" strokeDasharray="2 3" />
                          <ReferenceLine y={-1} stroke="#94A3B8" strokeDasharray="2 3" />
                          <ReferenceLine y={3} stroke="#DC2626" strokeDasharray="2 3" />
                          <ReferenceLine y={-3} stroke="#DC2626" strokeDasharray="2 3" />
                          <Bar dataKey="variance" name="Variance %" radius={[4, 4, 0, 0]}>
                            {varianceData.map((d, i) => {
                              const abs = Math.abs(d.variance);
                              const color = abs <= 1 ? "#059669" : abs <= 3 ? "#D97706" : "#DC2626";
                              return <Cell key={i} fill={color} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ContentCard>
                )}

                {activeWidgets.includes("daily_change") && (
                  <ContentCard
                    title="Daily % Change — Mid-Market"
                    icon={Activity}
                    tooltipText={WIDGET_TOOLTIPS.daily_change}
                  >
                    <div style={{ height: 250 }} className="-ml-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData.map((d, i, a) => {
                          const curr = d.mid;
                          const prev = i > 0 ? a[i - 1].mid : curr;
                          return { date: d.date, change: i > 0 ? +((curr - prev) / prev * 100).toFixed(3) : 0 };
                        }).slice(1)}>
                          <defs><linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity={0.15} /><stop offset="100%" stopColor="#7C3AED" stopOpacity={0.01} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => format(new Date(v), "dd MMM")} />
                          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} unit="%" />
                          <ReTooltip contentStyle={ttStyle} labelFormatter={v => format(new Date(v), "dd MMM yyyy")} />
                          <Area type="monotone" dataKey="change" name="Daily Change" stroke="#7C3AED" fill="url(#dailyGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </ContentCard>
                )}

                {activeWidgets.includes("cumulative_return") && (
                  <ContentCard title="Cumulative Return" icon={TrendingUp} tooltipText={WIDGET_TOOLTIPS.cumulative_return}>
                    <div style={{ height: 250 }} className="-ml-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData.map((d) => ({
                          date: d.date,
                          cumReturn: +((d.mid - chartData[0].mid) / chartData[0].mid * 100).toFixed(3),
                        }))}>
                          <defs><linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#059669" stopOpacity={0.15} /><stop offset="100%" stopColor="#059669" stopOpacity={0.01} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => format(new Date(v), "dd MMM")} />
                          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} unit="%" />
                          <ReTooltip contentStyle={ttStyle} labelFormatter={v => format(new Date(v), "dd MMM yyyy")} />
                          <Area type="monotone" dataKey="cumReturn" name="Cumulative %" stroke="#059669" fill="url(#cumGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </ContentCard>
                )}

                {activeWidgets.includes("conversion_trend") && (
                  <ContentCard
                    title="Conversion Trend (What-If)"
                    icon={DollarSign}
                    tooltipText={WIDGET_TOOLTIPS.conversion_trend}
                    action={
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#64748B]" style={{ fontWeight: 500 }}>Amount:</span>
                        <input
                          type="number"
                          value={conversionAmount}
                          onChange={e => setConversionAmount(e.target.value)}
                          className="w-20 h-6 px-2 rounded border border-border text-[11px] tabular-nums outline-none focus:border-[#0A77FF]/40"
                          onClick={e => e.stopPropagation()}
                        />
                        <span className="text-[10px] text-[#94A3B8]">{code}</span>
                      </div>
                    }
                  >
                    <div className="flex items-center gap-4 mb-3 text-[12px]">
                      <div className="bg-[#F0FDF4] rounded-lg px-3 py-1.5 border border-[#A7F3D0]">
                        <span className="text-[10px] text-[#059669]" style={{ fontWeight: 500 }}>Current</span>
                        <p className="text-[14px] tabular-nums text-[#065F46]" style={{ fontWeight: 700 }}>
                          {((parseFloat(conversionAmount) || 0) * detail.currentMidRate).toLocaleString(undefined, { maximumFractionDigits: 2 })} {BASE_CURRENCY}
                        </p>
                      </div>
                      <div className="bg-[#F8FAFC] rounded-lg px-3 py-1.5 border border-[#E2E8F0]">
                        <span className="text-[10px] text-[#64748B]" style={{ fontWeight: 500 }}>30d Avg</span>
                        <p className="text-[14px] tabular-nums text-[#334155]" style={{ fontWeight: 600 }}>
                          {((parseFloat(conversionAmount) || 0) * detail.avgRate30d).toLocaleString(undefined, { maximumFractionDigits: 2 })} {BASE_CURRENCY}
                        </p>
                      </div>
                    </div>
                    <div style={{ height: 200 }} className="-ml-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={conversionData}>
                          <defs><linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0A77FF" stopOpacity={0.15} /><stop offset="100%" stopColor="#0A77FF" stopOpacity={0.01} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => format(new Date(v), "dd MMM")} />
                          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                          <ReTooltip contentStyle={ttStyle} labelFormatter={v => format(new Date(v), "dd MMM yyyy")} formatter={(val: number) => [`${val.toLocaleString()} ${BASE_CURRENCY}`, "Converted"]} />
                          <Area type="monotone" dataKey="converted" name="Converted" stroke="#0A77FF" fill="url(#convGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </ContentCard>
                )}

                {activeWidgets.includes("drawdown_from_peak") && (
                  <ContentCard title="Drawdown from Peak (Mid-Market)" icon={ArrowDownRight} tooltipText={WIDGET_TOOLTIPS.drawdown_from_peak}>
                    <div style={{ height: 250 }} className="-ml-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={drawdownData}>
                          <defs><linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EF4444" stopOpacity={0.2} /><stop offset="100%" stopColor="#EF4444" stopOpacity={0.02} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => format(new Date(v), "dd MMM")} />
                          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} unit="%" domain={["auto", 0]} />
                          <ReTooltip contentStyle={ttStyle} labelFormatter={v => format(new Date(v), "dd MMM yyyy")} />
                          <Area type="monotone" dataKey="drawdown" name="Drawdown %" stroke="#EF4444" fill="url(#ddGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </ContentCard>
                )}

                {activeWidgets.includes("corp_rate_step") && detail.currentStdRate && (
                  <ContentCard title="Corporate Rate Change History" icon={Star} tooltipText={WIDGET_TOOLTIPS.corp_rate_step}>
                    <div style={{ height: 250 }} className="-ml-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => format(new Date(v), "dd MMM")} />
                          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                          <ReTooltip contentStyle={ttStyle} labelFormatter={v => format(new Date(v), "dd MMM yyyy")} />
                          <Line type="stepAfter" dataKey="std" name="Corporate Rate" stroke="#D97706" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </ContentCard>
                )}

                {activeWidgets.includes("transaction_volume") && (
                  <ContentCard title="Transaction Volume in this Pair" icon={BarChart3} tooltipText={WIDGET_TOOLTIPS.transaction_volume}>
                    <div style={{ height: 250 }} className="-ml-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={transactionVolumeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => format(new Date(v), "dd MMM")} />
                          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <ReTooltip contentStyle={ttStyle} labelFormatter={v => format(new Date(v), "dd MMM yyyy")} />
                          <Bar dataKey="count" name="Transactions" fill="#0A77FF" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ContentCard>
                )}
              </div>
            </div>
          )}


          {/* ══ Rate History ══
             Corporate view: always visible, rendered after the charts.
             Mid-Market view: rendered only when the widget is active (user can hide via Customize Widgets). */}
          {(isStandardDetail || activeWidgets.includes("rate_history")) && (
          <div>
            <h2 className="text-[15px] mb-3" style={{ fontWeight: 600 }}>Rate History</h2>
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-clip shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                    <TableHead><span className="text-[12px]" style={{ fontWeight: 600 }}>Effective Date</span></TableHead>
                    <TableHead><span className="text-[12px]" style={{ fontWeight: 600 }}>Rate Type</span></TableHead>
                    <TableHead><span className="text-[12px]" style={{ fontWeight: 600 }}>Rate Value</span></TableHead>
                    {isStandardDetail && <TableHead><span className="text-[12px]" style={{ fontWeight: 600 }}>Variance vs Mid</span></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.rateHistory
                    .filter(entry => isStandardDetail ? entry.rateType === "STD" : entry.rateType === "MID")
                    .slice(0, 30)
                    .map(entry => (
                    <TableRow key={entry.id} className="hover:bg-[#F0F7FF]">
                      <TableCell className="text-[12px]">{format(new Date(entry.effectiveDate), "dd MMM yyyy, HH:mm")}</TableCell>
                      <TableCell>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          entry.rateType === "MID"
                            ? "text-[#7C3AED] bg-[#F5F3FF] border-[#DDD6FE]"
                            : "text-[#D97706] bg-[#FFFBEB] border-[#FDE68A]"
                        }`} style={{ fontWeight: 500 }}>
                          {entry.rateType === "MID" ? "Mid-Market" : "Corporate"}
                        </span>
                      </TableCell>
                      <TableCell className="text-[13px] tabular-nums" style={{ fontWeight: 600 }}>{entry.rateValue.toFixed(4)}</TableCell>
                      {isStandardDetail && (
                        <TableCell className="text-[12px] tabular-nums text-[#64748B]">
                          {entry.varianceVsMid !== null ? `${entry.varianceVsMid > 0 ? "+" : ""}${entry.varianceVsMid.toFixed(2)}%` : "—"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          )}

          {/* ══ Audit Log — always visible and expanded on the corporate detail page ══ */}
          {isStandardDetail && detail.auditLog.length > 0 && (
            <div className="pb-4">
              <h2 className="text-[15px] mb-3" style={{ fontWeight: 600 }}>Audit Log</h2>
              <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-clip shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                      <TableHead><span className="text-[12px]" style={{ fontWeight: 600 }}>Date & Time</span></TableHead>
                      <TableHead><span className="text-[12px]" style={{ fontWeight: 600 }}>Action</span></TableHead>
                      <TableHead><span className="text-[12px]" style={{ fontWeight: 600 }}>User</span></TableHead>
                      <TableHead><span className="text-[12px]" style={{ fontWeight: 600 }}>Old Value</span></TableHead>
                      <TableHead><span className="text-[12px]" style={{ fontWeight: 600 }}>New Value</span></TableHead>
                      <TableHead><span className="text-[12px]" style={{ fontWeight: 600 }}>Reason</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.auditLog.map(entry => (
                      <TableRow key={entry.id} className="hover:bg-[#F0F7FF]">
                        <TableCell className="text-[12px]">{format(new Date(entry.dateTime), "dd MMM yyyy, HH:mm")}</TableCell>
                        <TableCell>
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF]" style={{ fontWeight: 500 }}>
                            {entry.action}
                          </span>
                        </TableCell>
                        <TableCell className="text-[12px]">{entry.user}</TableCell>
                        <TableCell className="text-[12px] tabular-nums text-[#64748B]">{entry.oldValue?.toFixed(4) || "—"}</TableCell>
                        <TableCell className="text-[12px] tabular-nums" style={{ fontWeight: 600 }}>{entry.newValue?.toFixed(4) || "—"}</TableCell>
                        <TableCell className="text-[12px] text-[#64748B]">{entry.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customize Widgets Panel */}
      <CustomizeKpiPanel
        open={customizePanelOpen}
        onOpenChange={setCustomizePanelOpen}
        activeKpis={activeKpis}
        onToggleKpi={handleToggleKpi}
        detail={detail}
        allowedKeys={isStandardDetail ? STD_KPI_KEYS : MID_KPI_KEYS}
        allowedWidgetKeys={isStandardDetail ? STD_WIDGET_KEYS : MID_WIDGET_KEYS}
        activeWidgets={activeWidgets}
        onToggleWidget={handleToggleWidget}
      />

      {/* Edit Corporate Rate Modal — Archive-pattern */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden rounded-2xl border-0 bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]" hideCloseButton>
          <div className="relative flex flex-col items-center pt-10 pb-6 text-center" style={{ background: "linear-gradient(180deg, #EFF6FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#3B82F6" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#DBEAFE" }}>
              <Pencil className="w-7 h-7" style={{ color: "#2563EB" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#EFF6FF", color: "#1E40AF", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
            >
              Update Rate
            </span>
            <DialogTitle className="mt-3 text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "#0F172A" }}>
              Edit Corporate Rate — {code}
            </DialogTitle>
            <DialogDescription className="text-[13px] mt-1.5 max-w-[320px] mx-auto" style={{ color: "#475569", lineHeight: "1.65" }}>
              Update the corporate rate for {code} / {BASE_CURRENCY}.
            </DialogDescription>
          </div>
          <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto bg-white">
            <div>
              <Label className="text-[12px] text-muted-foreground mb-1.5">Base Currency</Label>
              <div className="h-9 px-3 rounded-md border border-border bg-muted/30 flex items-center text-[13px]">
                <span style={{ fontWeight: 600 }}>{BASE_CURRENCY}</span>
                <span className="ml-1.5 text-muted-foreground">— {BASE_CURRENCY_NAME}</span>
              </div>
            </div>

            <div>
              <Label className="text-[12px] text-muted-foreground mb-1.5">Source Currency</Label>
              <div className="h-9 px-3 rounded-md border border-border bg-muted/30 flex items-center text-[13px]">
                <span style={{ fontWeight: 600 }}>{code}</span>
                <span className="ml-1.5 text-muted-foreground">— {detail.sourceCurrencyName}</span>
              </div>
            </div>

            {midRecord && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground mb-1" style={{ fontWeight: 500 }}>Mid-Market Reference</p>
                <p className="text-[15px] tabular-nums" style={{ fontWeight: 700 }}>{midRecord.rate.toFixed(4)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">As of {format(new Date(midRecord.effectiveDate), "dd MMM yyyy")}</p>
              </div>
            )}

            <div>
              <Label className="text-[12px] text-muted-foreground mb-1.5">Corporate Rate *</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="e.g., 279.0000"
                value={editForm.standardRate}
                onChange={e => setEditForm(p => ({ ...p, standardRate: e.target.value }))}
                className="h-9 text-[13px] tabular-nums"
              />
              {editLiveVariance !== null && (
                <p className="text-[11px] mt-1.5 text-amber-600" style={{ fontWeight: 500 }}>
                  Variance from mid-market: {editLiveVariance > 0 ? "+" : ""}{editLiveVariance.toFixed(2)}%
                </p>
              )}
            </div>

            <div>
              <Label className="text-[12px] text-muted-foreground mb-1.5">Effective Date *</Label>
              <Input
                type="date"
                value={editForm.effectiveDate}
                onChange={e => setEditForm(p => ({ ...p, effectiveDate: e.target.value }))}
                className="h-9 text-[13px]"
              />
            </div>

            <div>
              <Label className="text-[12px] text-muted-foreground mb-1.5">Notes (optional)</Label>
              <Textarea
                placeholder="Add notes about this rate..."
                value={editForm.notes}
                onChange={e => setEditForm(p => ({ ...p, notes: e.target.value.slice(0, 500) }))}
                className="text-[13px] resize-none"
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{editForm.notes.length}/500</p>
            </div>
          </div>
          <div className="px-8 py-5 border-t border-border flex flex-col gap-2.5 bg-white">
            <Button
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: "#0A77FF", color: "#fff" }}
              onClick={handleEditSave}
            >
              Update Rate
            </Button>
            <Button
              variant="outline"
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#334155" }}
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
