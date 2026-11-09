// Ported from Partner-Management---Vendor/src/app/components/vendors/InsightsControls.tsx (InsightsRangeMenu); adapted: date-fns instead of dayjs, Partners' popover variant (6px offset + arrow) kept local, and a `defaultMonth` so the calendar opens on the data's last month rather than today's.
import { useState, type ComponentProps } from "react";
import { format, parseISO, subMonths } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Calendar } from "../../components/ui/calendar";

/** Ported verbatim from Vendor Invoicing (InsightsRangeMenu / InsightsRefresh /
 *  InsightsResetButton) so the Performance Insights band reads and behaves
 *  like the other modules' (text-link CTA recipes, hover tints). The rate
 *  page's own periods replace Partners' "Last 7 days" to "All time".
 *
 *  Range menu is ONE panel: the preset shortcuts (1D, 5D, 1M, 1Y, 5Y, Max) sit
 *  in a left rail that is always visible, next to a two-month range calendar.
 *  Presets apply on click; picking two days on the calendar enables Apply. */
export type InsightsRange = "1d" | "5d" | "1m" | "1y" | "5y" | "max" | "custom";

/** The chart periods, 1M by default (see pairData DEFAULT_RANGE). */
export const INSIGHTS_RANGE_OPTIONS: { key: InsightsRange; label: string }[] = [
  { key: "1d", label: "1D" },
  { key: "5d", label: "5D" },
  { key: "1m", label: "1M" },
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
  { key: "max", label: "Max" },
  { key: "custom", label: "Custom" },
];

export function insightsRangeLabel(range: InsightsRange, customFrom?: string, customTo?: string): string {
  if (range === "custom") {
    if (customFrom && customTo) return `${format(parseISO(customFrom), "MMM d")} to ${format(parseISO(customTo), "MMM d")}`;
    return "Custom";
  }
  return INSIGHTS_RANGE_OPTIONS.find((o) => o.key === range)?.label ?? "1M";
}

interface InsightsRangeMenuProps {
  range: InsightsRange;
  onRangeChange: (range: InsightsRange) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
  /** The month the calendar opens on with nothing picked (Partners: last month). */
  defaultMonth?: Date;
}

export function InsightsRangeMenu({ range, onRangeChange, customFrom, customTo, onCustomChange, defaultMonth }: InsightsRangeMenuProps) {
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
      setDraft(hasCustom ? { from: parseISO(customFrom), to: parseISO(customTo) } : undefined);
      setCustomArmed(!!hasCustom);
    }
  };

  const applyDraft = () => {
    if (!draft?.from || !draft?.to) return;
    onCustomChange(format(draft.from, "yyyy-MM-dd"), format(draft.to, "yyyy-MM-dd"));
    onRangeChange("custom");
    setOpen(false);
  };

  const presets = INSIGHTS_RANGE_OPTIONS.filter((o) => o.key !== "custom");

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <CalendarIcon className="w-3 h-3" />
          {insightsRangeLabel(range, customFrom, customTo)}
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
      </PopoverPrimitive.Trigger>
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
              defaultMonth={draft?.from ?? defaultMonth ?? subMonths(new Date(), 1)}
            />
            <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                {draft?.from ? format(draft.from, "MMM d, yyyy") : "Start date"}
                {" to "}
                {draft?.to ? format(draft.to, "MMM d, yyyy") : "end date"}
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
    </PopoverPrimitive.Root>
  );
}

/* Partners' PopoverContent (src/app/components/ui/popover.tsx): a 6px offset and
   an arrow, which this app's shared popover doesn't draw. */
function PopoverContent({ className, align = "center", sideOffset = 6, children, ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[200] w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
          className,
        )}
        {...props}
      >
        {children}
        <PopoverPrimitive.Arrow
          width={11}
          height={5}
          className="fill-popover drop-shadow-[0_1px_1px_rgba(0,0,0,0.06)]"
        />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
