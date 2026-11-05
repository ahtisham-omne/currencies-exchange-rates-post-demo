"use client";

/**
 * DatePicker — the standard, design-system date field.
 *
 * Replaces the browser's native `<input type="date">` (the dated gray popup
 * with the up/down month stepper + Clear/Today footer) with an on-brand
 * picker that matches the rest of the app: rounded-xl surface, soft bluish
 * shadow, primary-blue selection, and light-blue hover states.
 *
 * Keeps the native picker's well-liked behaviour — single-view year / month /
 * day selection — via month + year dropdowns sitting directly above the day
 * grid, so the user can jump to any date without changing modes. Footer keeps
 * the familiar Clear / Today shortcuts.
 *
 * Value contract mirrors the native input it replaces: `value` / `onChange`
 * speak ISO `YYYY-MM-DD` strings (empty string = no date), so swapping
 * `<Input type="date" />` for `<DatePicker />` is a drop-in change.
 */

import * as React from "react";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface DatePickerProps {
  /** ISO date string `YYYY-MM-DD`, or `""` for no selection. */
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  /** Extra classes for the trigger button (sizing/spacing tweaks). */
  className?: string;
  /** Popover alignment relative to the trigger. */
  align?: "start" | "center" | "end";
  /** Render the trigger in an error state (red border/ring). */
  error?: boolean;
  /** How the selected date renders in the trigger. Defaults to `MMM D, YYYY`. */
  displayFormat?: string;
  /** Inclusive year range for the year dropdown. Defaults to ±10 years. */
  fromYear?: number;
  toYear?: number;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  disabled,
  id,
  className,
  align = "start",
  error,
  displayFormat = "MMM D, YYYY",
  fromYear,
  toYear,
}: DatePickerProps) {
  const today = dayjs();
  const selected = value ? dayjs(value, "YYYY-MM-DD") : null;
  const hasValidSelection = !!selected && selected.isValid();

  const [open, setOpen] = React.useState(false);
  // First day of the month currently shown in the grid.
  const [viewMonth, setViewMonth] = React.useState(() =>
    (hasValidSelection ? selected! : today).startOf("month"),
  );
  const [menu, setMenu] = React.useState<null | "month" | "year">(null);

  // Re-sync the visible month to the selected date each time the popover
  // opens, so reopening always lands on the chosen date rather than wherever
  // the user last browsed.
  React.useEffect(() => {
    if (open) {
      setViewMonth((hasValidSelection ? selected! : today).startOf("month"));
      setMenu(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const currentYear = today.year();
  const startYear = fromYear ?? currentYear - 10;
  const endYear = toYear ?? currentYear + 10;
  const years = React.useMemo(() => {
    const out: number[] = [];
    for (let y = endYear; y >= startYear; y--) out.push(y);
    return out;
  }, [startYear, endYear]);

  // 6 weeks × 7 days, starting on the Sunday on/just before the 1st.
  const gridStart = viewMonth.subtract(viewMonth.day(), "day");
  const days = React.useMemo(
    () => Array.from({ length: 42 }, (_, i) => gridStart.add(i, "day")),
    [gridStart],
  );

  const commit = (d: dayjs.Dayjs) => {
    onChange?.(d.format("YYYY-MM-DD"));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex w-full items-center justify-between gap-2 h-10 rounded-lg border bg-white px-3 text-sm transition-colors",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary data-[state=open]:ring-1 data-[state=open]:ring-primary/20 data-[state=open]:border-primary",
            error
              ? "border-red-400 ring-2 ring-red-100"
              : "border-border hover:border-primary/40",
            disabled && "opacity-60 cursor-not-allowed hover:border-border",
            className,
          )}
        >
          <span className={cn("truncate", !hasValidSelection && "text-slate-400")} style={{ fontWeight: 500 }}>
            {hasValidSelection ? selected!.format(displayFormat) : placeholder}
          </span>
          <CalendarDays className="w-4 h-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-[300px] p-0 rounded-xl border border-slate-200/80 bg-white shadow-[0_16px_44px_-18px_rgba(10,119,255,0.45),0_4px_12px_-6px_rgba(15,23,42,0.12)]"
      >
        {/* Header — prev/next chevrons flanking month + year dropdowns. */}
        <div className="relative flex items-center justify-between gap-1 px-3 pt-3 pb-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => { setViewMonth((m) => m.subtract(1, "month")); setMenu(null); }}
            className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1">
            {/* Month dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((p) => (p === "month" ? null : "month"))}
                className="inline-flex items-center gap-1 h-8 pl-2.5 pr-1.5 rounded-lg text-[13px] text-foreground hover:bg-blue-50 transition-colors"
                style={{ fontWeight: 600 }}
              >
                {MONTHS[viewMonth.month()]}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {menu === "month" && (
                <div className="absolute left-0 top-full mt-1 z-20 w-36 max-h-[200px] overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  {MONTHS.map((m, i) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setViewMonth((v) => v.month(i)); setMenu(null); }}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-md text-[12px] transition-colors",
                        i === viewMonth.month()
                          ? "bg-primary text-white font-semibold"
                          : "text-foreground hover:bg-blue-50 hover:text-primary",
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Year dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((p) => (p === "year" ? null : "year"))}
                className="inline-flex items-center gap-1 h-8 pl-2.5 pr-1.5 rounded-lg text-[13px] text-foreground hover:bg-blue-50 transition-colors tabular-nums"
                style={{ fontWeight: 600 }}
              >
                {viewMonth.year()}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {menu === "year" && (
                <div className="absolute right-0 top-full mt-1 z-20 w-24 max-h-[200px] overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  {years.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => { setViewMonth((v) => v.year(y)); setMenu(null); }}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-md text-[12px] tabular-nums transition-colors",
                        y === viewMonth.year()
                          ? "bg-primary text-white font-semibold"
                          : "text-foreground hover:bg-blue-50 hover:text-primary",
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            aria-label="Next month"
            onClick={() => { setViewMonth((m) => m.add(1, "month")); setMenu(null); }}
            className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-primary transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 px-3">
          {WEEKDAYS.map((d) => (
            <div key={d} className="h-7 grid place-items-center text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5 px-3 pb-2" onClick={() => menu && setMenu(null)}>
          {days.map((d) => {
            const isOutside = d.month() !== viewMonth.month();
            const isSelected = hasValidSelection && d.isSame(selected!, "day");
            const isToday = d.isSame(today, "day");
            return (
              <button
                key={d.format("YYYY-MM-DD")}
                type="button"
                onClick={() => commit(d)}
                className={cn(
                  "h-9 w-full grid place-items-center text-[13px] rounded-lg transition-colors tabular-nums",
                  isSelected
                    ? "bg-primary text-white shadow-sm hover:bg-primary"
                    : isToday
                      ? "text-primary ring-1 ring-inset ring-primary/30 hover:bg-blue-50"
                      : isOutside
                        ? "text-slate-300 hover:bg-slate-50"
                        : "text-foreground hover:bg-blue-50 hover:text-primary",
                )}
                style={{ fontWeight: isSelected || isToday ? 600 : 500 }}
              >
                {d.date()}
              </button>
            );
          })}
        </div>

        {/* Footer — Clear / Today shortcuts. */}
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-100">
          <button
            type="button"
            onClick={() => { onChange?.(""); setOpen(false); }}
            className="text-[12px] text-slate-500 hover:text-red-500 transition-colors"
            style={{ fontWeight: 500 }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => commit(today)}
            className="text-[12px] text-primary hover:bg-blue-50 h-7 px-2.5 rounded-lg transition-colors"
            style={{ fontWeight: 600 }}
          >
            Today
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
