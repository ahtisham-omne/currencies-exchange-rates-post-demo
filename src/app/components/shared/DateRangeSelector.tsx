import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react";
import { format, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DATE_OPTIONS, dateRangeLabel, type DateRangeKey } from "./PerformanceInsights";

/* ─────────────────────────────────────────────────────────────
 * DateRangeSelector
 * Preset list (left) + two-month range calendar (right) + Cancel/Apply
 * footer, opened from a compact "Last N days ▾" trigger. Presets and the
 * Custom calendar are independent: choosing a preset highlights it in the
 * sidebar (no range painted); choosing "Custom" lets the calendar drive a
 * from→to range that shows in the footer.
 *
 * Preset selection is committed up to the parent via onChange (so a KPI
 * strip reading the same DateRangeKey stays in sync). A committed custom
 * range is presentation-only and kept locally — the trigger shows its
 * formatted label while the parent's key is left untouched.
 * ──────────────────────────────────────────────────────────── */

type StagedKey = DateRangeKey | "custom";

interface Props {
  value: DateRangeKey;
  onChange: (key: DateRangeKey) => void;
}

export function DateRangeSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  /** Committed custom label; when set, the trigger shows it instead of the preset label. */
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  /** Staged (not-yet-applied) selection while the popover is open. */
  const [stagedKey, setStagedKey] = useState<StagedKey>(value);
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  // Re-sync the staged selection to the committed state each time we open.
  useEffect(() => {
    if (open) {
      setStagedKey(customLabel ? "custom" : value);
    }
  }, [open, value, customLabel]);

  const triggerLabel = customLabel ?? dateRangeLabel(value);

  const rangeText =
    range?.from && range?.to
      ? `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`
      : range?.from
        ? `${format(range.from, "MMM d, yyyy")} – …`
        : "Start date to end date";

  const applyDisabled = stagedKey === "custom" && !(range?.from && range?.to);

  const handleApply = () => {
    if (stagedKey === "custom") {
      if (range?.from && range?.to) {
        setCustomLabel(`${format(range.from, "MMM d")} – ${format(range.to, "MMM d, yyyy")}`);
      }
    } else {
      setCustomLabel(null);
      onChange(stagedKey);
    }
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] transition-colors cursor-pointer hover:bg-[#F1F5F9]"
          style={{ fontWeight: 500, color: "#64748B" }}
        >
          <CalendarIcon className="w-3 h-3" /> {triggerLabel}{" "}
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto p-0 overflow-hidden rounded-xl border-[#E2E8F0] shadow-[0_12px_32px_-8px_rgba(15,23,42,0.18)]"
      >
        <div className="flex">
          {/* ── Preset sidebar ── */}
          <div className="w-[168px] shrink-0 border-r p-2 space-y-0.5" style={{ borderColor: "#F1F5F9" }}>
            {DATE_OPTIONS.map((opt) => {
              const active = stagedKey === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setStagedKey(opt.key);
                    setRange(undefined);
                  }}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-[13px] transition-colors cursor-pointer"
                  style={{
                    fontWeight: active ? 600 : 500,
                    color: active ? "#007FFF" : "#475569",
                    backgroundColor: active ? "#EDF4FF" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = "#F8FAFC";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span>{opt.label}</span>
                  {active && <Check className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setStagedKey("custom")}
              className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-[13px] transition-colors cursor-pointer"
              style={{
                fontWeight: stagedKey === "custom" ? 600 : 500,
                color: stagedKey === "custom" ? "#007FFF" : "#94A3B8",
                backgroundColor: stagedKey === "custom" ? "#EDF4FF" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (stagedKey !== "custom") e.currentTarget.style.backgroundColor = "#F8FAFC";
              }}
              onMouseLeave={(e) => {
                if (stagedKey !== "custom") e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <span>Custom</span>
              {stagedKey === "custom" && <Check className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />}
            </button>
          </div>

          {/* ── Two-month range calendar ── */}
          <div className="p-1">
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={subMonths(new Date(), 1)}
              selected={range}
              onSelect={(r) => {
                setRange(r);
                setStagedKey("custom");
              }}
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-between px-4 py-3 border-t"
          style={{ borderColor: "#F1F5F9" }}
        >
          <span className="text-[12px]" style={{ color: "#94A3B8" }}>
            {rangeText}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center h-8 px-3.5 rounded-lg border bg-white text-[12px] transition-colors cursor-pointer hover:bg-[#F8FAFC]"
              style={{ fontWeight: 500, color: "#334155", borderColor: "#E2E8F0" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={applyDisabled}
              className="inline-flex items-center h-8 px-4 rounded-lg text-[12px] text-white transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              style={{ fontWeight: 600, backgroundColor: "#007FFF" }}
              onMouseEnter={(e) => {
                if (!applyDisabled) e.currentTarget.style.backgroundColor = "#0066D6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#007FFF";
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
