import * as React from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../../../lib/utils';
import {
  CURRENCY_LIBRARY,
  flagCodeForCurrency,
  getLibraryCurrency,
  type LibraryCurrency,
} from '../../data/rateConstants';
import { CurrencyFlag } from './CurrencyFlag';

interface CurrencyLibrarySelectProps {
  /** ISO 4217 alpha-3 (any case). */
  value: string | undefined;
  /** Emits uppercase code. */
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Compact currency picker — opens a searchable popover with the full ISO 4217
 * library. Mirrors the Partners `CurrencyLibrarySelect` Popover/Search pattern,
 * but the trigger is small enough to sit inline next to a label in the
 * Configure Vendor Details modal.
 *
 * - Trigger: flag + code chip (h-7).
 * - Popover: search input + scrollable list with [flag] [CODE] [name].
 * - Multi-country currencies render a globe fallback (or EU flag for EUR).
 */
export function CurrencyLibrarySelect({
  value,
  onChange,
  disabled,
  className,
}: CurrencyLibrarySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const selected = getLibraryCurrency(value);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CURRENCY_LIBRARY;
    return CURRENCY_LIBRARY.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'h-7 w-auto min-w-[92px] px-2 inline-flex items-center gap-1.5 rounded-md border-[1.5px] bg-white text-[11px] font-semibold transition-colors',
            open ? 'border-primary ring-2 ring-primary/10' : 'border-border hover:border-slate-300',
            disabled && 'opacity-60 cursor-not-allowed hover:border-border',
            className,
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {selected ? (
            <>
              <FlagInTrigger currency={selected} />
              <span>{selected.code}</span>
            </>
          ) : (
            <span className="text-slate-400">Select</span>
          )}
          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-auto" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        className="w-[320px] p-0 rounded-xl border border-border shadow-lg z-[250] flex flex-col overflow-hidden"
        style={{ maxHeight: 'min(420px, var(--radix-popover-content-available-height))' }}
      >
        <div className="p-2.5 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, name, or country…"
              className="w-full h-8 pl-8 pr-2.5 rounded-md border border-border bg-white text-xs text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              autoFocus
            />
          </div>
        </div>
        <div
          className="border-t border-muted flex-1 min-h-0 overflow-y-auto overscroll-contain"
          // Radix Dialog's scroll-lock (react-remove-scroll) blocks wheel events
          // on portaled popovers; translate them manually so the list still
          // scrolls when the picker is opened from inside a Dialog.
          onWheelCapture={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight <= el.clientHeight) return;
            el.scrollTop += e.deltaY;
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">No currencies match "{search}"</div>
          ) : (
            <ul role="listbox" className="py-1">
              {filtered.map((c) => {
                const isSelected = selected?.code === c.code;
                return (
                  <li key={c.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(c.code);
                        setOpen(false);
                        setSearch('');
                      }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-slate-50',
                        isSelected && 'bg-accent/40',
                      )}
                    >
                      <FlagInRow currency={c} />
                      <span className="w-10 text-[12px] font-semibold text-foreground shrink-0">{c.code}</span>
                      <span className="flex-1 min-w-0 text-[12px] text-slate-600 truncate">{c.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FlagInTrigger({ currency }: { currency: LibraryCurrency }) {
  return <CurrencyFlag country={flagCodeForCurrency(currency)} size={16} />;
}

function FlagInRow({ currency }: { currency: LibraryCurrency }) {
  return <CurrencyFlag country={flagCodeForCurrency(currency)} size={18} />;
}
