import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@/app/components/ui/calendar';

/* ══════════════════════════════════════════════════════════════════
 * THE global date-range panel (meeting feedback 7/17/26).
 * One implementation of the Airbnb-style popover body — preset rail on
 * the left, clickable Custom entry, two-month range calendar, and the
 * Cancel/Apply footer — shared by every date-range control in the app:
 * the Performance Insights range menu, the Period quick filter, and
 * the Due Date quick filter. The host component owns its trigger pill
 * and preset semantics and passes the rail content in; this panel owns
 * the custom-mode interaction (clicking Custom or picking a day arms
 * custom and the host deselects its presets via `customArmed`).
 * ══════════════════════════════════════════════════════════════════ */
export function DateRangePanel({
  rail,
  customLabel = 'Custom',
  customArmed,
  customApplied,
  onArmCustom,
  draft,
  onDraftChange,
  onCancel,
  onApply,
  railWidth = 136,
  defaultMonth,
}: {
  /** Preset entries rendered above the Custom row. */
  rail: ReactNode;
  customLabel?: string;
  /** Custom mode is armed (clicked, or a draft day picked). */
  customArmed: boolean;
  /** A custom range is currently APPLIED on the host filter. */
  customApplied: boolean;
  onArmCustom: () => void;
  draft: DateRange | undefined;
  onDraftChange: (next: DateRange | undefined) => void;
  onCancel: () => void;
  onApply: () => void;
  railWidth?: number;
  /** First visible month when no draft is picked. Backward-looking
   *  filters keep the default (last month); forward-looking ones
   *  (e.g. Due by) pass today so the window starts at the current month. */
  defaultMonth?: Date;
}) {
  const customActive = customApplied || customArmed || !!draft?.from;
  return (
    <div className="flex">
      <div
        className="shrink-0 border-r border-slate-100 p-1.5 flex flex-col gap-0.5"
        style={{ width: railWidth }}
      >
        {rail}
        <button
          type="button"
          onClick={onArmCustom}
          className={`px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer text-[12px] ${
            customActive ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground'
          }`}
          style={{ fontWeight: customActive ? 600 : 400 }}
        >
          {customLabel}
        </button>
      </div>

      <div>
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={draft}
          onSelect={onDraftChange}
          defaultMonth={draft?.from ?? defaultMonth ?? dayjs().subtract(1, 'month').toDate()}
        />
        <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-500 " style={{ fontWeight: 500 }}>
            {draft?.from ? dayjs(draft.from).format('MMM D, YYYY') : 'Start date'}
            {' to '}
            {draft?.to ? dayjs(draft.to).format('MMM D, YYYY') : 'end date'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-7 px-3 rounded-lg border border-border bg-white text-[11px] text-muted-foreground hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
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
  );
}
