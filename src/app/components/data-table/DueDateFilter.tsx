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
}: {
  label?: string;
  buckets: { id: string; label: string; count?: number }[];
  selected: string[];
  onChange: (next: string[]) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);
  const [customArmed, setCustomArmed] = useState(false);
  const hasCustom = !!(customFrom && customTo);
  const active = selected.length > 0 || hasCustom;
  /* No selection is the filter off, so every bucket is in scope and the rows
   * read as checked. A custom range is a real narrowing, so it is not "all". */
  const allActive = !hasCustom && (selected.length === 0 || selected.length === buckets.length);

  const triggerValue = hasCustom
    ? `${dayjs(customFrom).format('MMM D')} to ${dayjs(customTo).format('MMM D')}`
    : selected.length === 0
      ? 'All'
      : selected.length === 1
        ? buckets.find((b) => b.id === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;

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
    if (!active) {
      onChange(buckets.filter((b) => b.id !== id).map((b) => b.id));
      return;
    }
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
      <PopoverContent align="start" className="w-auto p-0">
        <DateRangePanel
          customLabel="Custom range"
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
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
              >
                <Checkbox checked={allActive ? true : 'indeterminate'} className="pointer-events-none" />
                <span className="text-[12px] text-foreground" style={{ fontWeight: allActive ? 600 : 400 }}>
                  Select all
                </span>
              </button>
              <div className="h-px bg-border/60 my-0.5" />
              {buckets.map((b) => {
                const checked = allActive || selected.includes(b.id);
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
                      <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{b.count}</span>
                    )}
                  </button>
                );
              })}
            </>
          }
        />
      </PopoverContent>
    </Popover>
  );
}
