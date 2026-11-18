import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Clock, Search, X } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { userPhotoFor } from '@/app/utils/userAvatar';

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

// Same yellow mark the listing table uses for its own search, so a match
// reads identically whether it was found in the table or in a filter.
function highlightMatch(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-inherit rounded-sm" style={{ padding: '0 1px' }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Guarded for SSR: this seeds useState, so it runs during the server render
// where localStorage doesn't exist.
function loadRecents(key: string): string[] {
  if (typeof window === 'undefined') return [];
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
  avatars = true,
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
  /** Off for non-person facets (warehouses, sites) where an initials
   *  circle reads as a person who doesn't exist. */
  avatars?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>(() => loadRecents(recentsKey));
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // The facet lives inside the Filters dialog's scroll container, which
  // would clip an absolutely positioned menu. The menu is portalled to the
  // body and anchored to the input instead, so it stays whole.
  const [anchor, setAnchor] = useState<{ left: number; top: number; bottom: number; width: number } | null>(null);

  const measure = useCallback(() => {
    const el = fieldRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({ left: r.left, top: r.top, bottom: r.bottom, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    measure();
    // Capture phase so the dialog's own scroll container re-anchors too.
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, measure]);

  // Close the dropdown on outside click — plain listener keeps this
  // component portable inside dialogs without Popover z-index juggling.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
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
        {avatars && (
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 overflow-hidden bg-slate-100 text-slate-600 border border-slate-200"
            style={{ fontWeight: 600 }}
          >
            {userPhotoFor(o.name)
              ? <img src={userPhotoFor(o.name)} alt="" className="w-full h-full object-cover" />
              : initials(o.name)}
          </span>
        )}
        <span className="flex-1 min-w-0 truncate text-[13px] text-foreground" style={{ fontWeight: isSelected ? 600 : 500 }}>
          {highlightMatch(o.name, query)}
        </span>
        {typeof o.count === 'number' && (
          <span
            className="text-[10px] tabular-nums rounded-full px-1.5 py-px bg-muted text-muted-foreground shrink-0"
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

  // Prefer opening downward; flip only when the space below cannot hold a
  // usable list and the space above is genuinely better.
  const spaceBelow = anchor ? window.innerHeight - anchor.bottom - 12 : 0;
  const spaceAbove = anchor ? anchor.top - 12 : 0;
  const flipUp = !!anchor && spaceBelow < 180 && spaceAbove > spaceBelow;
  const menuMaxHeight = Math.max(140, Math.min(260, flipUp ? spaceAbove : spaceBelow));

  return (
    <div ref={rootRef} className="relative flex flex-col">
      {/* Pinned selection — sits under the input so the field stays put as
          selections accumulate, instead of being pushed down the dialog. */}
      {selectedOptions.length > 0 && (
        <div className="flex items-start justify-between gap-2 mt-2 order-2">
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

      <div ref={fieldRef} className="relative">
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
          empty, live matches while typing. Portalled and flipped above the
          input when the space below is short, so it is never clipped. */}
      {open && anchor && createPortal(
        <div
          ref={menuRef}
          // The menu is portalled to the body, which puts it outside the
          // Filters dialog. A modal Radix dialog parks `pointer-events: none`
          // on the body and re-enables it only inside its own content, so
          // without `pointer-events-auto` the menu draws but no row can be
          // clicked. Stopping pointerdown keeps the dialog's dismiss layer
          // from reading that same click as a click outside itself and
          // closing the whole dialog.
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed z-[300] rounded-lg border border-border bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)] overflow-y-auto pointer-events-auto"
          style={{
            left: anchor.left,
            width: anchor.width,
            ...(flipUp
              ? { bottom: window.innerHeight - anchor.top + 6 }
              : { top: anchor.bottom + 6 }),
            maxHeight: menuMaxHeight,
          }}
        >
          {showRecents && (
            <>
              <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                <Clock className="w-3 h-3 text-muted-foreground/60" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground" style={{ fontWeight: 600 }}>
                  Recently used
                </span>
              </div>
              <div className="pb-1">{recentOptions.map(renderRow)}</div>
              {rest.length > 0 && <div className="border-t border-border/50" />}
            </>
          )}
          {showRecents && rest.length > 0 && (
            <div className="px-3 pt-2.5 pb-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground" style={{ fontWeight: 600 }}>
                All
              </span>
            </div>
          )}
          <div className="pb-1">{rest.map(renderRow)}</div>
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
        </div>,
        document.body,
      )}
    </div>
  );
}
