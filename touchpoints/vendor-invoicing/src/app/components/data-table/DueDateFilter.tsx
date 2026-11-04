import { useState } from 'react';
import dayjs from 'dayjs';
import { ChevronDown, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Checkbox } from '@/app/components/ui/checkbox';
import { DateRangePanel } from './DateRangePanel';

/* Due-date quick filter — urgency buckets next to the GLOBAL
 * DateRangePanel (7/17/26). Buckets and the custom range are mutually
 * exclusive: arming custom clears the buckets immediately and applying
 * a range keeps them cleared, so the trigger label stays unambiguous. */
export function DueDateFilter({
  label = 'Due Date',
  buckets,
  selected,
  onChange,
  customFrom,
  customTo,
  onCustomChange,
  bucketsOnly = false,
  align = 'start',
}: {
  label?: string;
  buckets: { id: string; label: string; count?: number }[];
  selected: string[];
  onChange: (next: string[]) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
  /** Rail only, no custom-range calendar (user 9/28): inside the filters
   *  modal the two-month panel overflowed the dialog, and the modal's own
   *  From/To pickers already cover custom ranges. */
  bucketsOnly?: boolean;
  /** Popover alignment — 'end' when the trigger hugs a right edge. */
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);
  const [customArmed, setCustomArmed] = useState(false);
  const hasCustom = !!(customFrom && customTo);
  const active = selected.length > 0 || hasCustom;

  const triggerValue = hasCustom
    ? `${dayjs(customFrom).format('MMM D')} to ${dayjs(customTo).format('MMM D')}`
    : selected.length === 0
      ? 'All'
      : selected.length === 1
        ? buckets.find((b) => b.id === selected[0])?.label ?? selected[0]
        : `${selected.length} Selected`;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setDraft(hasCustom ? { from: dayjs(customFrom).toDate(), to: dayjs(customTo).toDate() } : undefined);
      setCustomArmed(hasCustom);
    }
  };

  const clearAll = () => {
    onChange([]);
    onCustomChange('', '');
    setCustomArmed(false);
  };

  const toggleBucket = (id: string) => {
    onCustomChange('', '');
    setCustomArmed(false);
    onChange(selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id]);
  };

  const applyDraft = () => {
    if (!draft?.from || !draft?.to) return;
    onChange([]);
    onCustomChange(dayjs(draft.from).format('YYYY-MM-DD'), dayjs(draft.to).format('YYYY-MM-DD'));
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
          <span>{label}:</span>
          <span className="max-w-[160px] truncate">{triggerValue}</span>
          {active ? (
            <span
              role="button"
              aria-label={`Clear ${label} filter`}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); clearAll(); }}
              className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-primary/15 transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
            </span>
          ) : (
            <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        {bucketsOnly ? (
          <div className="flex flex-col p-1.5 w-[200px]">
            <button
              type="button"
              onClick={() => { clearAll(); setDraft(undefined); }}
              className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer text-[12px] text-foreground"
              style={{ fontWeight: !active ? 600 : 400 }}
            >
              All
            </button>
            <div className="h-px bg-border/60 my-0.5" />
            {buckets.map((b) => {
              const checked = selected.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBucket(b.id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  <Checkbox checked={checked} className="pointer-events-none" />
                  <span className="text-[12px] text-foreground flex-1 truncate">{b.label}</span>
                  {b.count !== undefined && (
                    <span className="text-[11px] text-slate-400 shrink-0">{b.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
        <DateRangePanel
          customLabel="Custom Range"
          customArmed={customArmed}
          customApplied={hasCustom}
          onArmCustom={() => { onChange([]); setCustomArmed(true); }}
          draft={draft}
          onDraftChange={setDraft}
          onCancel={() => setOpen(false)}
          onApply={applyDraft}
          railWidth={168}
          rail={
            <>
              <button
                type="button"
                onClick={() => { clearAll(); setDraft(undefined); }}
                className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer text-[12px] text-foreground"
                style={{ fontWeight: !active ? 600 : 400 }}
              >
                All
              </button>
              <div className="h-px bg-border/60 my-0.5" />
              {buckets.map((b) => {
                const checked = selected.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBucket(b.id)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span className="text-[12px] text-foreground flex-1 truncate">{b.label}</span>
                    {b.count !== undefined && (
                      <span className="text-[11px] text-slate-400 shrink-0">{b.count}</span>
                    )}
                  </button>
                );
              })}
            </>
          }
        />
        )}
      </PopoverContent>
    </Popover>
  );
}
