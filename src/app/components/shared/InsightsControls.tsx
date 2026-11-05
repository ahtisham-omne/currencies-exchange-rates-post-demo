import { useState } from "react";
import dayjs from "dayjs";
import { Calendar, ChevronDown, Check, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";
import { DatePicker } from "../ui/date-picker";

/** Ported verbatim from Vendor Invoicing (InsightsRangeMenu / InsightsRefresh /
 *  InsightsResetButton) so the Performance Insights band reads and behaves
 *  identically across modules — same options incl. "All time" + "Custom"
 *  from/to pickers, same text-link CTA recipes and hover tints. */
export type InsightsRange = "last_7" | "last_30" | "last_90" | "last_365" | "all_time" | "custom";

export const INSIGHTS_RANGE_OPTIONS: { key: InsightsRange; label: string }[] = [
  { key: "last_7", label: "Last 7 days" },
  { key: "last_30", label: "Last 30 days" },
  { key: "last_90", label: "Last 90 days" },
  { key: "last_365", label: "Last 12 months" },
  { key: "all_time", label: "All time" },
  { key: "custom", label: "Custom" },
];

export function insightsRangeLabel(range: InsightsRange, customFrom?: string, customTo?: string): string {
  if (range === "custom") {
    if (customFrom && customTo) return `${dayjs(customFrom).format("MMM D")} to ${dayjs(customTo).format("MMM D")}`;
    return "Custom";
  }
  return INSIGHTS_RANGE_OPTIONS.find((o) => o.key === range)?.label ?? "Last 30 days";
}

interface InsightsRangeMenuProps {
  range: InsightsRange;
  onRangeChange: (range: InsightsRange) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}

export function InsightsRangeMenu({ range, onRangeChange, customFrom, customTo, onCustomChange }: InsightsRangeMenuProps) {
  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Calendar className="w-3 h-3" />
            {insightsRangeLabel(range, customFrom, customTo)}
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[170px]">
          {INSIGHTS_RANGE_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.key}
              className="flex items-center justify-between cursor-pointer"
              onClick={() => onRangeChange(opt.key)}
            >
              <span className="text-sm">{opt.label}</span>
              {range === opt.key && <Check className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Custom range → inline From / To calendars. */}
      {range === "custom" && (
        <div className="flex items-center gap-1">
          <DatePicker
            value={customFrom}
            onChange={(v) => onCustomChange(v, customTo)}
            placeholder="From"
            className="h-7 text-[11px] w-[124px]"
            align="start"
          />
          <span className="text-[11px] text-slate-400">to</span>
          <DatePicker
            value={customTo}
            onChange={(v) => onCustomChange(customFrom, v)}
            placeholder="To"
            className="h-7 text-[11px] w-[124px]"
            align="start"
          />
        </div>
      )}
    </div>
  );
}

/** "Updated hh:mm · Refresh" block for KPI/widget band headers. The CTA is
 *  the shared text-link recipe with a blue hover tint, the blue sibling of
 *  the red InsightsResetButton. Owns its refreshed-at state so any band can
 *  drop it in without wiring. */
export function InsightsRefresh({ toastLabel = "Insights refreshed" }: { toastLabel?: string }) {
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setLastUpdated(new Date());
      toast.success(toastLabel);
    }, 600);
  };

  const updatedLabel = lastUpdated.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <>
      <span className="text-slate-300 hidden sm:inline">|</span>
      <span className="text-[11px] text-slate-400 hidden sm:inline" style={{ fontWeight: 400 }}>
        Updated {updatedLabel}
      </span>
      <button
        onClick={handleRefresh}
        className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-[#0862D4] hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
        style={{ fontWeight: 500 }}
      >
        <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
        Refresh
      </button>
    </>
  );
}

/** Reset CTA for KPI/widget bands — same text-link recipe as the Refresh
 *  and Add Insights controls beside it. Disabled (grey) while the layout
 *  matches its default; turns red once the user has customized anything
 *  (added/removed widgets, drag-and-drop reorder) so there's something
 *  to reset. */
export function InsightsResetButton({ dirty, onReset }: { dirty: boolean; onReset: () => void }) {
  return (
    <button
      onClick={onReset}
      disabled={!dirty}
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md transition-colors ${
        dirty
          ? "text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
          : "text-slate-300 cursor-not-allowed"
      }`}
      style={{ fontWeight: 500 }}
    >
      <RotateCcw className="w-3 h-3" />
      Reset
    </button>
  );
}
