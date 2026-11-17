import { useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { format, subDays, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../ui/utils";

/** The log's date filter. The popover is OMNE's period range picker (Mahad,
 * 16 Nov 2026; the same one Billy Bob's insights use): the presets on a rail
 * on the left, two months side by side, each with its own month and year
 * dropdowns, today marked, and a Start date to end date / Reset / Cancel /
 * Apply footer. Presets apply on click; a hand-picked range is a draft until
 * Apply. The trigger is unchanged: the applied range, a chevron, and an X
 * that goes back to the default once something else is applied. */

// Last 30 days is the DEFAULT the field opens on, not a limit — any
// custom range is selectable. The default exists so the log does not
// load thousands of entries on first paint.
export type DatePresetKey = "last_7" | "last_30" | "last_90" | "last_12m" | "all";

const PRESET_OPTIONS: { key: DatePresetKey; label: string }[] = [
  { key: "last_7", label: "Last 7 days" },
  { key: "last_30", label: "Last 30 days" },
  { key: "last_90", label: "Last 90 days" },
  { key: "last_12m", label: "Last 12 months" },
  { key: "all", label: "All time" },
];

/** "All time" starts here — earlier than any record in these prototypes,
 * so the whole history shows without the matcher needing an open end. */
export const ALL_TIME_FROM = new Date(2000, 0, 1);

/** The log's today. The hub is a design reference, not a live system, so a
 * module may freeze its clock (Shipment: 4 November 2026) at the real time of
 * day, so entries stamped earlier today still read as past. The range
 * presets, the "Today ·" day header, the same-year check and the picker's
 * months all read this, never the real date. */
const WALL = new Date();
export const LOG_TODAY = new Date(WALL); // a module that pins its demo date sets it here (Shipment: 4 Nov 2026)

function rangeForPreset(key: DatePresetKey): DateRange {
  const today = LOG_TODAY;
  switch (key) {
    case "last_7":
      return { from: subDays(today, 7), to: today };
    case "last_30":
      return { from: subDays(today, 30), to: today };
    case "last_90":
      return { from: subDays(today, 90), to: today };
    case "last_12m":
      return { from: subMonths(today, 12), to: today };
    case "all":
      return { from: ALL_TIME_FROM, to: today };
  }
}

/** The year always shows — a range can sit in a different month, or year,
 * than today, and a bare "Sep 1 to Oct 26" can't say which year that was.
 * It appears once at the end when both ends share a year, and on both ends
 * when they land in different years. */
function formatRangeLabel(from: Date, to: Date): string {
  if (from.getFullYear() !== to.getFullYear()) {
    return `${format(from, "MMM d, yyyy")} to ${format(to, "MMM d, yyyy")}`;
  }
  return `${format(from, "MMM d")} to ${format(to, "MMM d, yyyy")}`;
}

function fieldLabel(dateRange: DateRange | undefined, datePreset: DatePresetKey | null): string {
  if (datePreset) return PRESET_OPTIONS.find((o) => o.key === datePreset)!.label;
  if (dateRange?.from && dateRange?.to) return formatRangeLabel(dateRange.from, dateRange.to);
  return "";
}

/* ── the two-month calendar ─────────────────────────────────────────────── */

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dateOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

/** Week rows a month needs, so both panes show the same number and line up. */
function weeksIn(base: Date) {
  const y = base.getFullYear(), m = base.getMonth();
  return Math.ceil((new Date(y, m, 1).getDay() + new Date(y, m + 1, 0).getDate()) / 7);
}

/** A month's cells, with the adjacent months' days muted but pickable. */
function monthGrid(base: Date, weeks: number) {
  const y = base.getFullYear(), m = base.getMonth();
  const start = new Date(y, m, 1 - new Date(y, m, 1).getDay());
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { iso: isoOf(d), day: d.getDate(), outside: d.getMonth() !== m };
  });
}

function CaptionSelect({ value, options, onChange, label }: { value: number; options: { value: number; label: string }[]; onChange: (v: number) => void; label: string }) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="cursor-pointer appearance-none rounded-md bg-transparent py-1 pl-2 pr-6 text-sm text-foreground transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        style={{ fontWeight: 500 }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
    </div>
  );
}

/** One month's caption: the month and year dropdowns, centred, with the
 * previous arrow on the left pane's edge and the next on the right's. */
function MonthCaption({ shown, onSet, onPrev, onNext }: { shown: Date; onSet: (d: Date) => void; onPrev?: () => void; onNext?: () => void }) {
  const y = shown.getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => LOG_TODAY.getFullYear() - 10 + i);
  if (!years.includes(y)) years.push(y), years.sort((a, b) => a - b);
  const arrow = "absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted-foreground opacity-60 transition-opacity hover:bg-slate-50 hover:opacity-100";
  return (
    <div className="relative flex h-8 items-center justify-center gap-1.5">
      {onPrev && (
        <button type="button" aria-label="Previous month" onClick={onPrev} className={cn(arrow, "left-0")}>
          <ChevronLeft className="size-4" />
        </button>
      )}
      <CaptionSelect label="Month" value={shown.getMonth()} options={MONTHS.map((l, i) => ({ value: i, label: l }))} onChange={(m) => onSet(new Date(y, m, 1))} />
      <CaptionSelect label="Year" value={y} options={years.map((v) => ({ value: v, label: String(v) }))} onChange={(v) => onSet(new Date(v, shown.getMonth(), 1))} />
      {onNext && (
        <button type="button" aria-label="Next month" onClick={onNext} className={cn(arrow, "right-0")}>
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}

function MonthPane({ base, weeks, from, to, todayIso, onPick }: { base: Date; weeks: number; from: string; to: string; todayIso: string; onPick: (iso: string) => void }) {
  const complete = !!from && !!to;
  return (
    <div className="min-w-0">
      <div className="mt-2 grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div key={w} className="flex h-8 items-center justify-center text-[13px] text-muted-foreground">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {monthGrid(base, weeks).map((c) => {
          const end = c.iso === from || c.iso === to;
          const span = complete && c.iso >= from && c.iso <= to;
          return (
            <div key={c.iso} className={cn("flex h-9 items-center justify-center", span && "bg-primary/10", span && c.iso === from && "rounded-l-md", span && c.iso === to && "rounded-r-md")}>
              <button
                type="button"
                onClick={() => onPick(c.iso)}
                className={cn(
                  "inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-sm transition-colors",
                  end
                    ? "bg-primary text-white hover:bg-primary"
                    : span
                      ? "text-primary hover:bg-primary/15"
                      : c.outside
                        ? "text-slate-300 hover:bg-slate-50"
                        : c.iso === todayIso
                          ? "bg-accent text-primary hover:bg-accent"
                          : "text-foreground hover:bg-slate-50",
                )}
                style={{ fontWeight: end ? 500 : 400 }}
              >
                {c.day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── the field ──────────────────────────────────────────────────────────── */

export function DateRangeField({
  dateRange,
  datePreset,
  onChange,
}: {
  dateRange: DateRange;
  datePreset: DatePresetKey | null;
  onChange: (next: { dateRange: DateRange; datePreset: DatePresetKey | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customArmed, setCustomArmed] = useState(false);
  const [anchor, setAnchor] = useState(() => addMonths(monthStart(LOG_TODAY), -1));

  // "Active" means the reader picked something other than the default; the
  // field always holds a range, so that is the only state worth showing.
  const isDefault = datePreset === "last_30";
  const hasCustomApplied = datePreset === null && !!(dateRange?.from && dateRange?.to);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    if (hasCustomApplied) {
      setFrom(isoOf(dateRange.from!));
      setTo(isoOf(dateRange.to!));
      setAnchor(monthStart(dateRange.from!));
    } else {
      setFrom("");
      setTo("");
      setAnchor(addMonths(monthStart(LOG_TODAY), -1));
    }
    setCustomArmed(hasCustomApplied);
  };

  const applyPreset = (key: DatePresetKey) => {
    onChange({ dateRange: rangeForPreset(key), datePreset: key });
    setOpen(false);
  };

  /** Back to the default, Last 30 days: the trigger's X, and Reset when a
   * range other than the default is applied. */
  const clearToDefault = () => {
    onChange({ dateRange: rangeForPreset("last_30"), datePreset: "last_30" });
    setOpen(false);
  };

  // First click sets the start, the second closes the range; a click before
  // the start (or after a complete range) starts again from that day.
  const pick = (iso: string) => {
    setCustomArmed(true);
    if (!from || (from && to) || iso < from) {
      setFrom(iso);
      setTo("");
      return;
    }
    setTo(iso);
  };

  const applyDraft = () => {
    if (!from || !to) return;
    onChange({ dateRange: { from: dateOf(from), to: dateOf(to) }, datePreset: null });
    setOpen(false);
  };

  /** Reset clears what is picked in the calendar; with nothing picked, it puts
   * an applied custom or other preset back to the default. Greyed when there
   * is nothing to reset. */
  const canReset = !!from || !isDefault;
  const reset = () => {
    if (from) {
      setFrom("");
      setTo("");
      setCustomArmed(false);
      return;
    }
    clearToDefault();
  };

  const customActive = customArmed || !!from || hasCustomApplied;
  const next = addMonths(anchor, 1);
  const weeks = Math.max(weeksIn(anchor), weeksIn(next));
  const todayIso = isoOf(LOG_TODAY);
  const footerLabel = from && to ? formatRangeLabel(dateOf(from), dateOf(to)) : from ? `${format(dateOf(from), "MMM d, yyyy")} to end date` : "Start date to end date";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border bg-white px-3 shadow-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50",
            isDefault ? "border-border/80" : "border-primary/30",
          )}
        >
          <span className="truncate text-sm text-foreground" style={{ fontWeight: 500 }}>
            {fieldLabel(dateRange, datePreset)}
          </span>
          {isDefault ? (
            // Rotated via inline style: a rotate class didn't generate a rule
            // in some hosts' bundles, and inline style has no step to fail.
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
          ) : (
            // Not a <button>: the trigger already is one, and a nested button
            // is invalid HTML. stopPropagation keeps it from opening the popover.
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear the date filter"
              onClick={(e) => {
                e.stopPropagation();
                clearToDefault();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  clearToDefault();
                }
              }}
              className="flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <X className="size-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="activity-log-portal w-[772px] max-w-[calc(100vw-16px)] overflow-hidden rounded-xl p-0 shadow-lg">
        <div className="flex items-stretch">
          {/* Presets: apply on click and close. */}
          <div className="w-[176px] shrink-0 space-y-0.5 border-r border-border p-2">
            {PRESET_OPTIONS.map((opt) => {
              const active = datePreset === opt.key && !customActive;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => applyPreset(opt.key)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    active ? "bg-accent text-primary" : "text-foreground hover:bg-slate-50",
                  )}
                  style={{ fontWeight: active ? 500 : 400 }}
                >
                  <span className="truncate">{opt.label}</span>
                  {active && <Check className="size-[15px] shrink-0" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCustomArmed(true)}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                customActive ? "bg-accent text-primary" : "text-foreground hover:bg-slate-50",
              )}
              style={{ fontWeight: customActive ? 500 : 400 }}
            >
              <span className="truncate">Custom</span>
              {customActive && <Check className="size-[15px] shrink-0" />}
            </button>
          </div>

          {/* Two months and the footer that commits a picked range. */}
          <div className="min-w-0 flex-1 p-4">
            <div className="grid grid-cols-2 gap-8">
              <div className="min-w-0">
                <MonthCaption shown={anchor} onSet={(d) => setAnchor(monthStart(d))} onPrev={() => setAnchor(addMonths(anchor, -1))} />
                <MonthPane base={anchor} weeks={weeks} from={from} to={to} todayIso={todayIso} onPick={pick} />
              </div>
              <div className="min-w-0">
                {/* The right pane trails the left by a month, so jumping it
                    moves the shared anchor back one to keep the pair in step. */}
                <MonthCaption shown={next} onSet={(d) => setAnchor(addMonths(monthStart(d), -1))} onNext={() => setAnchor(addMonths(anchor, 1))} />
                <MonthPane base={next} weeks={weeks} from={from} to={to} todayIso={todayIso} onPick={pick} />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className={cn("text-[13px] tabular-nums", from ? "text-muted-foreground" : "text-muted-foreground/80")}>{footerLabel}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canReset}
                  onClick={reset}
                  className="h-9 cursor-pointer rounded-lg px-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed"
                  // Inline, so the greyed state holds in every host's CSS order.
                  style={{ fontWeight: 500, color: canReset ? undefined : "#CBD5E1" }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 cursor-pointer rounded-lg border border-border bg-white px-4 text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!from || !to}
                  onClick={applyDraft}
                  className="h-9 cursor-pointer rounded-lg bg-primary px-4 text-[13px] text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed"
                  style={{ fontWeight: 500, opacity: from && to ? 1 : 0.4 }}
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
