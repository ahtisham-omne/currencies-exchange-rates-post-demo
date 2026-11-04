import { useState } from 'react';
import dayjs from 'dayjs';
import { Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { DateRangePanel } from '@/app/components/data-table/DateRangePanel';
import type { InsightsRange } from '@/app/components/PaymentInsightsPanel';

// Single source of truth for the Performance Insights date-range control so the
// interaction is identical everywhere it is used: Vendor Invoicing, Vendor
// Payments (V1 + V2), and the Ready to pay tab.
//
// The popover body is the GLOBAL DateRangePanel (7/17/26): preset rail +
// clickable Custom + two-month calendar, shared with the Period and Due
// Date quick filters.
export const INSIGHTS_RANGE_OPTIONS: { key: InsightsRange; label: string }[] = [
  { key: 'last_7', label: 'Last 7 Days' },
  { key: 'last_30', label: 'Last 30 Days' },
  { key: 'last_90', label: 'Last 90 Days' },
  { key: 'last_365', label: 'Last 12 Months' },
  { key: 'all_time', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
];

export function insightsRangeLabel(range: InsightsRange, customFrom?: string, customTo?: string): string {
  if (range === 'custom') {
    if (customFrom && customTo) return `${dayjs(customFrom).format('MMM D')} to ${dayjs(customTo).format('MMM D')}`;
    return 'Custom';
  }
  return INSIGHTS_RANGE_OPTIONS.find((o) => o.key === range)?.label ?? 'Last 30 Days';
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
  const hasCustom = range === 'custom' && !!(customFrom && customTo);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Reopening while a custom range is applied loads the selection.
      setDraft(hasCustom ? { from: dayjs(customFrom).toDate(), to: dayjs(customTo).toDate() } : undefined);
      setCustomArmed(hasCustom);
    }
  };

  const applyDraft = () => {
    if (!draft?.from || !draft?.to) return;
    onCustomChange(dayjs(draft.from).format('YYYY-MM-DD'), dayjs(draft.to).format('YYYY-MM-DD'));
    onRangeChange('custom');
    setOpen(false);
  };

  const presets = INSIGHTS_RANGE_OPTIONS.filter((o) => o.key !== 'custom');

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
        <DateRangePanel
          customArmed={customArmed}
          customApplied={hasCustom}
          onArmCustom={() => setCustomArmed(true)}
          draft={draft}
          onDraftChange={setDraft}
          onCancel={() => setOpen(false)}
          onApply={applyDraft}
          rail={presets.map((opt) => {
            const active = range === opt.key && !customArmed && !draft?.from;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => { onRangeChange(opt.key); setOpen(false); }}
                className={`flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer text-[12px] ${
                  active ? 'bg-accent text-primary' : 'hover:bg-slate-50 text-foreground'
                }`}
                style={{ fontWeight: active ? 600 : 400 }}
              >
                {opt.label}
                {active && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
              </button>
            );
          })}
        />
      </PopoverContent>
    </Popover>
  );
}
