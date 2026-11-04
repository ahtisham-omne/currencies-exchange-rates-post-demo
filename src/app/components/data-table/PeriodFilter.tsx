import { useState } from 'react';
import dayjs from 'dayjs';
import { Check, ChevronDown, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { DateRangePanel } from './DateRangePanel';

/* Period quick-filter pill — preset windows next to the GLOBAL
 * DateRangePanel (7/17/26), so "Custom" is one click away from the
 * presets and the interaction matches every other date-range control. */
export interface PeriodOption {
  id: string;
  label: string;
  days: number | null;
}

export function periodFilterLabel(
  options: PeriodOption[],
  value: string,
  customFrom: string,
  customTo: string,
): string {
  if (value === 'custom') {
    if (customFrom && customTo) return `${dayjs(customFrom).format('MMM D')} to ${dayjs(customTo).format('MMM D')}`;
    return 'Custom';
  }
  return options.find((o) => o.id === value)?.label ?? 'All Time';
}

export function PeriodFilter({
  options,
  value,
  onChange,
  customFrom,
  customTo,
  onCustomChange,
}: {
  options: PeriodOption[];
  value: string;
  onChange: (next: string) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);
  // Clicking Custom (or picking a day) arms custom mode: the preset
  // check deselects immediately instead of lingering until Apply.
  const [customArmed, setCustomArmed] = useState(false);
  const active = value !== 'all';
  const hasCustom = value === 'custom' && !!(customFrom && customTo);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setDraft(hasCustom ? { from: dayjs(customFrom).toDate(), to: dayjs(customTo).toDate() } : undefined);
      setCustomArmed(hasCustom);
    }
  };

  const applyDraft = () => {
    if (!draft?.from || !draft?.to) return;
    onCustomChange(dayjs(draft.from).format('YYYY-MM-DD'), dayjs(draft.to).format('YYYY-MM-DD'));
    onChange('custom');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 h-[30px] rounded-full border text-xs px-3 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
            active ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-muted-foreground hover:bg-muted/60'
          }`}
          style={{ fontWeight: active ? 500 : 400 }}
        >
          <span>Period:</span>
          <span className="max-w-[160px] truncate">{periodFilterLabel(options, value, customFrom, customTo)}</span>
          {active ? (
            <span
              role="button"
              aria-label="Clear Period Filter"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onChange('all'); }}
              className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-primary/15 transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
            </span>
          ) : (
            <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
          )}
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
          rail={options.map((opt) => {
            const optActive = value === opt.id && !customArmed && !draft?.from;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => { onChange(opt.id); setOpen(false); }}
                className={`flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer text-[12px] ${
                  optActive ? 'bg-accent text-primary' : 'hover:bg-slate-50 text-foreground'
                }`}
                style={{ fontWeight: optActive ? 600 : 400 }}
              >
                {opt.label}
                {optActive && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
              </button>
            );
          })}
        />
      </PopoverContent>
    </Popover>
  );
}
