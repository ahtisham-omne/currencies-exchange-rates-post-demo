import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Search, X } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { userPhotoFor } from '@/app/utils/userAvatar';
import { highlightText } from '@/app/components/InvoiceDataTable';

// Global search-select pattern for people/entity filters. Rev 7/16/26:
// no inline suggestion list — the input sits alone, and clicking into it
// opens a DROPDOWN (Jira-style): recently used options first when the
// query is empty, live matches while typing. Selections pin above the
// input with a clear button. Multi-select by design.

export interface SearchSelectOption {
  id: string;
  name: string;
  /** Optional count badge (e.g. how many records this person created). */
  count?: number;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function loadRecents(key: string): string[] {
  try {
    const raw = localStorage.getItem(`omnesoft:recents:${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === 'string');
    }
  } catch { /* ignore */ }
  return [];
}

function pushRecent(key: string, id: string) {
  try {
    const next = [id, ...loadRecents(key).filter((v) => v !== id)].slice(0, 5);
    localStorage.setItem(`omnesoft:recents:${key}`, JSON.stringify(next));
    return next;
  } catch {
    return [id];
  }
}

export function SearchSelectPeople({
  options,
  selected,
  onChange,
  placeholder = 'Search people...',
  emptyText = 'No people found.',
  recentsKey = 'people',
  recentsOnlyWhenIdle = false,
  variant = 'people',
}: {
  options: SearchSelectOption[];
  /** Selected option ids (multi-select). */
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  /** Namespace for the "recently used" memory (localStorage). */
  recentsKey?: string;
  /** When true, an empty query shows ONLY the recent searches (up to 5)
   *  and a "type to search" hint instead of dumping the whole dataset
   *  (feedback 7/22/26) — keeps large option lists cheap to open. */
  recentsOnlyWhenIdle?: boolean;
  /** 'plain' drops the person avatar and renders the option name with a
   *  leading-code emphasis (Nophil 9/28: GL accounts filtered like
   *  people, initials avatar and all, "is it a person?"). */
  variant?: 'people' | 'plain';
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>(() => loadRecents(recentsKey));
  // Windowed list (user 9/28): only 10 rows render at a time — reaching
  // the bottom of the dropdown reveals the next 10, so a long vendor
  // catalogue never dumps hundreds of rows into the DOM at once.
  const PAGE = 10;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(PAGE);
  }, [query, open]);

  // Close the dropdown on outside click — plain listener keeps this
  // component portable inside dialogs without Popover z-index juggling.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const recentOptions = useMemo(
    () => recents.map((id) => options.find((o) => o.id === id)).filter((o): o is SearchSelectOption => !!o),
    [recents, options],
  );

  const selectedOptions = options.filter((o) => selected.includes(o.id));

  const toggle = (id: string) => {
    const adding = !selected.includes(id);
    onChange(adding ? [...selected, id] : selected.filter((s) => s !== id));
    if (adding) setRecents(pushRecent(recentsKey, id));
  };

  const renderRow = (o: SearchSelectOption) => {
    const isSelected = selected.includes(o.id);
    return (
      <button
        key={o.id}
        type="button"
        onClick={() => toggle(o.id)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer ${
          isSelected ? 'bg-accent/60' : 'hover:bg-muted/40'
        }`}
      >
        {variant === 'people' && (
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 overflow-hidden bg-slate-100 text-slate-600 border border-slate-200"
            style={{ fontWeight: 600 }}
          >
            {userPhotoFor(o.name)
              ? <img src={userPhotoFor(o.name)} alt="" className="w-full h-full object-cover" />
              : initials(o.name)}
          </span>
        )}
        {variant === 'plain' ? (
          // Plain rows read like ledger entries: leading code emphasized,
          // the rest of the name regular.
          (() => {
            const sp = o.name.indexOf(' ');
            const code = sp > 0 ? o.name.slice(0, sp) : o.name;
            const rest = sp > 0 ? o.name.slice(sp + 1) : '';
            return (
              <span className="flex-1 min-w-0 truncate text-[13px]">
                {/* Searchable, so the match highlights like every other list (10/9/26). */}
                <span className="text-foreground" style={{ fontWeight: 600 }}>{highlightText(code, query)}</span>
                {rest && <span className="text-slate-600 ml-1.5" style={{ fontWeight: isSelected ? 600 : 400 }}>{highlightText(rest, query)}</span>}
              </span>
            );
          })()
        ) : (
        <span className="flex-1 min-w-0 truncate text-[13px] text-foreground" style={{ fontWeight: isSelected ? 600 : 500 }}>
          {highlightText(o.name, query)}
        </span>
        )}
        {typeof o.count === 'number' && (
          <span
            className="text-[10px] rounded-full px-1.5 py-px bg-muted text-muted-foreground shrink-0"
            style={{ fontWeight: 600 }}
          >
            {o.count}
          </span>
        )}
        <span
          className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors ${
            isSelected ? 'bg-primary border-primary' : 'border-slate-300 bg-white'
          }`}
        >
          {isSelected && <Check className="w-3 h-3 text-white" style={{ strokeWidth: 3 }} />}
        </span>
      </button>
    );
  };

  const idle = !query.trim();
  const showRecents = idle && recentOptions.length > 0;
  // recentsOnlyWhenIdle: never dump the full list on an empty query —
  // only recents show until the user types (feedback 7/22/26).
  const rest = idle
    ? recentsOnlyWhenIdle
      ? []
      : filtered.filter((o) => !recents.includes(o.id))
    : filtered;

  return (
    <div ref={rootRef} className="relative">
      {/* Pinned selection — always visible above the input so applied
          people never get lost. */}
      {selectedOptions.length > 0 && (
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap gap-1.5 min-w-0">
            {selectedOptions.map((o) => (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full border border-primary/30 bg-accent text-primary text-xs"
                style={{ fontWeight: 500 }}
              >
                {o.name}
                <button
                  type="button"
                  onClick={() => toggle(o.id)}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-primary/10 transition-colors cursor-pointer"
                  aria-label={`Remove ${o.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] text-slate-500 hover:text-foreground transition-colors shrink-0 mt-1 cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Clear
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
        <Input
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className="pl-8 h-9 text-sm bg-white border-border/80"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown — opens on focus. Recently used first when the query is
          empty, live matches while typing. */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-lg border border-border bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)] max-h-[260px] overflow-y-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
              setVisibleCount((c) => (c < rest.length ? Math.min(rest.length, c + PAGE) : c));
            }
          }}
        >
          {showRecents && (
            <>
              <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                <Clock className="w-3 h-3 text-muted-foreground/60" />
                <span className="text-[10px] text-muted-foreground" style={{ fontWeight: 600 }}>
                  Recently Used
                </span>
              </div>
              <div className="pb-1">{recentOptions.map(renderRow)}</div>
              {rest.length > 0 && <div className="border-t border-border/50" />}
            </>
          )}
          {showRecents && rest.length > 0 && (
            <div className="px-3 pt-2.5 pb-1">
              <span className="text-[10px] text-muted-foreground" style={{ fontWeight: 600 }}>
                All
              </span>
            </div>
          )}
          <div className="pb-1">{rest.slice(0, visibleCount).map(renderRow)}</div>
          {rest.length > visibleCount && (
            <div className="px-3 pb-2 text-center text-[10px] text-muted-foreground/70" style={{ fontWeight: 500 }}>
              Scroll for {rest.length - visibleCount} more
            </div>
          )}
          {/* Idle + recents-only: prompt to search instead of listing all. */}
          {recentsOnlyWhenIdle && idle && (
            <div className="px-3 py-3 text-center text-[12px] text-muted-foreground">
              {recentOptions.length > 0 ? 'Type to search all ' : 'Start typing to search '}
              {options.length} option{options.length === 1 ? '' : 's'}
              {recentOptions.length > 0 ? '.' : ''}
            </div>
          )}
          {!idle && filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">{emptyText}</div>
          )}
        </div>
      )}
    </div>
  );
}
