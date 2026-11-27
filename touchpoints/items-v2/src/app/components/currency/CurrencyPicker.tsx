import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CURRENCIES, getCurrency } from '@/app/currency/currencies';
import { CurrencyFlag } from './CurrencyChip';

const FONT = 'Inter, system-ui, sans-serif';

/**
 * A currency field: flag + code, opening every active currency, searchable
 * by code, name or country (spec 2.3). Same pattern as the order apps'
 * CurrencyPicker, sized to the item form's 40px fields (25 Nov 2026).
 * `exclude` hides codes that can't be picked here (the base currency, codes
 * already used).
 */
export function CurrencyPicker({
  value,
  onPick,
  exclude = [],
  ariaLabel = 'Currency',
  invalid = false,
}: {
  value: string;
  onPick: (code: string) => void;
  exclude?: string[];
  ariaLabel?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const cur = getCurrency(value);
  const hidden = new Set(exclude.map((c) => c.toUpperCase()).filter((c) => c !== value));
  const q = query.trim().toLowerCase();
  const list = CURRENCIES.filter(
    (c) =>
      !hidden.has(c.code) &&
      (!q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)),
  );

  return (
    // modal: inside the Create Item dialog the list must take the wheel.
    <Popover modal open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          title={cur?.name}
          className={`flex items-center gap-2 w-full bg-white border rounded-lg px-3 justify-between cursor-pointer transition-colors outline-none ${
            invalid ? 'border-[#FCA5A5]' : 'border-border hover:border-[#BFDBFE] focus:border-[#93C5FD]'
          }`}
          style={{ height: 40, fontFamily: FONT }}
        >
          <span className="flex items-center gap-2 min-w-0">
            <CurrencyFlag code={value} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{value}</span>
          </span>
          <ChevronDown style={{ width: 12, height: 12, color: '#94A3B8' }} className="shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={8}
        className="p-0 w-[280px] z-[200] bg-card"
        style={{ border: '0.75px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 24px -4px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: FONT }}
      >
        <div className="p-2" style={{ borderBottom: '0.75px solid var(--border)' }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search currency, code or country"
            className="w-full h-8 px-2.5 rounded-md border border-border text-[12px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
        </div>
        <div className="max-h-[260px] overflow-y-auto py-1" role="listbox">
          {list.length === 0 && <p className="px-3 py-3 text-[12px] text-slate-400">No currency matches "{query}".</p>}
          {list.map((c) => (
            <button
              key={c.code}
              type="button"
              role="option"
              aria-selected={c.code === value}
              onClick={() => { setOpen(false); setQuery(''); if (c.code !== value) onPick(c.code); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] cursor-pointer transition-colors ${
                c.code === value ? 'bg-primary/[0.06] text-primary' : 'hover:bg-slate-50 text-foreground'
              }`}
            >
              <CurrencyFlag code={c.code} />
              <span className="w-9 shrink-0" style={{ fontWeight: 600 }}>{c.code}</span>
              <span className="truncate text-slate-600">{c.name}</span>
              {c.code === value && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
