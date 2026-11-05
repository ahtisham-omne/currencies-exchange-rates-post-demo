import { useState } from "react";
import dayjs from "dayjs";
import { Calendar as CalendarIcon, ChevronDown, Check, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";

/** Ported verbatim from Vendor Invoicing (InsightsRangeMenu / InsightsRefresh /
 *  InsightsResetButton) so the Performance Insights band reads and behaves
 *  identically across modules — same options incl. "All time" + "Custom",
 *  same text-link CTA recipes and hover tints.
 *
 *  Range menu is ONE panel: the preset shortcuts (Last 7/30/90 days...) sit
 *  in a left rail that is always visible, next to a two-month range calendar.
 *  Presets apply on click; picking two days on the calendar enables Apply. */
export type InsightsRange = "last_7" | "last_30" | "last_90" | "last_365" | "all_time" | "custom";

export const INSIGHTS_RANGE_OPTIONS: { key: InsightsRange; label: string }[] = [
  { key: "last_7", label: "Last 7 Days" },
  { key: "last_30", label: "Last 30 Days" },
  { key: "last_90", label: "Last 90 Days" },
  { key: "last_365", label: "Last 12 Months" },
  { key: "all_time", label: "All Time" },
  { key: "custom", label: "Custom" },
];

export function insightsRangeLabel(range: InsightsRange, customFrom?: string, customTo?: string): string {
  if (range === "custom") {
    if (customFrom && customTo) return `${dayjs(customFrom).format("MMM D")} to ${dayjs(customTo).format("MMM D")}`;
    return "Custom";
  }
  return INSIGHTS_RANGE_OPTIONS.find((o) => o.key === range)?.label ?? "Last 30 Days";
}

interface InsightsRangeMenuProps {
  range: InsightsRange;
  onRangeChange: (range: InsightsRange) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}

export function InsightsRangeMenu({ range, onRangeChange, customFrom, customTo, onCustomChange }: InsightsRangeMenuProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);
  // Clicking Custom (or picking a day) arms custom mode: the preset
  // check deselects immediately instead of lingering until Apply.
  const [customArmed, setCustomArmed] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Reopening while a custom range is applied loads the selection.
      const hasCustom = range === "custom" && customFrom && customTo;
      setDraft(hasCustom ? { from: dayjs(customFrom).toDate(), to: dayjs(customTo).toDate() } : undefined);
      setCustomArmed(!!hasCustom);
    }
  };

  const applyDraft = () => {
    if (!draft?.from || !draft?.to) return;
    onCustomChange(dayjs(draft.from).format("YYYY-MM-DD"), dayjs(draft.to).format("YYYY-MM-DD"));
    onRangeChange("custom");
    setOpen(false);
  };

  const presets = INSIGHTS_RANGE_OPTIONS.filter((o) => o.key !== "custom");

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <CalendarIcon className="w-3 h-3" />
          {insightsRangeLabel(range, customFrom, customTo)}
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex">
          {/* Preset rail — always visible next to the calendar, one click
              applies. Custom highlights when a calendar range is live. */}
          <div className="w-[136px] shrink-0 border-r border-slate-100 p-1.5 flex flex-col gap-0.5">
            {presets.map((opt) => {
              const active = range === opt.key && !customArmed && !draft?.from;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => { onRangeChange(opt.key); setOpen(false); }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer text-[12px] ${
                    active ? "bg-accent text-primary" : "hover:bg-slate-50 text-foreground"
                  }`}
                  style={{ fontWeight: active ? 600 : 400 }}
                >
                  {opt.label}
                  {active && <Check className="w-3.5 h-3.5 shrink-0 text-primary" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCustomArmed(true)}
              className={`px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer text-[12px] ${
                customArmed || draft?.from ? "bg-accent text-primary" : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
              }`}
              style={{ fontWeight: customArmed || draft?.from ? 600 : 400 }}
            >
              Custom
            </button>
          </div>

          {/* Two-month range calendar (Airbnb style): click a start day,
              click an end day, Apply. */}
          <div>
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={draft}
              onSelect={setDraft}
              defaultMonth={draft?.from ?? dayjs().subtract(1, "month").toDate()}
            />
            <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                {draft?.from ? dayjs(draft.from).format("MMM D, YYYY") : "Start date"}
                {" to "}
                {draft?.to ? dayjs(draft.to).format("MMM D, YYYY") : "end date"}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-7 px-3 rounded-lg border border-border bg-white text-[11px] text-muted-foreground hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyDraft}
                  disabled={!draft?.from || !draft?.to}
                  className="h-7 px-3 rounded-lg border-0 text-[11px] text-white bg-primary hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontWeight: 600 }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
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
