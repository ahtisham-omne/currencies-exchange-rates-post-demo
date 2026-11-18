import { useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Checkbox } from '@/app/components/ui/checkbox';

/* Quick-filter multi-select — the listing toolbars' compact dropdown
 * (Eli review 7/15/26: independent filter axes, no pill walls), upgraded
 * to MULTI-select per feedback 7/15/26. Empty selection = filter off
 * ("All"). The trigger reads All / the single label / "N selected". */
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  searchable = false,
}: {
  label: string;
  options: { id: string; label: string; count?: number }[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Long option lists (accounts, vendors) get a search box at the top
   *  of the dropdown (feedback 7/16/26). */
  searchable?: boolean;
}) {
  const [search, setSearch] = useState('');
  const active = selected.length > 0;
  const visibleOptions = searchable && search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;
  /* An empty selection is the filter off, so every option is already in scope.
   * The rows say so by reading as checked, which means unchecking one from
   * that state has to spell the rest out explicitly. */
  const allActive = selected.length === 0 || selected.length === options.length;
  const triggerValue = allActive
    ? 'All'
    : selected.length === 1
      ? options.find((o) => o.id === selected[0])?.label ?? selected[0]
      : `${selected.length} selected`;

  const toggle = (id: string) => {
    if (selected.length === 0) {
      onChange(options.filter((o) => o.id !== id).map((o) => o.id));
      return;
    }
    onChange(selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id]);
  };

  return (
    <Popover onOpenChange={(open) => { if (!open) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 h-[30px] rounded-full border text-xs px-3 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
            active ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-muted-foreground hover:bg-muted/60'
          }`}
          style={{ fontWeight: active ? 500 : 400 }}
        >
          <span>{label}:</span>
          <span className="max-w-[140px] truncate">{triggerValue}</span>
          {/* One-tap clear when active — no need to reopen the dropdown
              to reset a stacked selection (feedback 7/16/26). */}
          {active ? (
            <span
              role="button"
              aria-label={`Clear ${label} filter`}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onChange([]); }}
              className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-primary/15 transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
            </span>
          ) : (
            <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[240px] p-1">
        {searchable && (
          <div className="relative mb-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full h-8 pl-8 pr-7 rounded-md border border-border bg-white text-[12px] outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        {/* Same select-all affordance the tables use: a checkbox that reads
            partial as a dash. */}
        <button
          type="button"
          onClick={() => onChange([])}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
        >
          <Checkbox checked={allActive ? true : 'indeterminate'} className="pointer-events-none" />
          <span className="text-[12px] text-foreground" style={{ fontWeight: allActive ? 600 : 400 }}>
            Select all
          </span>
        </button>
        <div className="h-px bg-border/60 my-1" />
        {searchable && visibleOptions.length === 0 && (
          <p className="px-2 py-2 text-[12px] text-muted-foreground">No matches</p>
        )}
        {(searchable ? (
          <div className="max-h-[260px] overflow-y-auto">
            {visibleOptions.map((opt) => renderOption(opt))}
          </div>
        ) : (
          visibleOptions.map((opt) => renderOption(opt))
        ))}
      </PopoverContent>
    </Popover>
  );

  function renderOption(opt: { id: string; label: string; count?: number }) {
    const checked = allActive || selected.includes(opt.id);
    return (
      <button
        key={opt.id}
        type="button"
        onClick={() => toggle(opt.id)}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
      >
        <Checkbox checked={checked} className="pointer-events-none" />
        <span className="text-[12px] text-foreground flex-1 truncate">{opt.label}</span>
        {opt.count !== undefined && (
          <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{opt.count}</span>
        )}
      </button>
    );
  }
}
