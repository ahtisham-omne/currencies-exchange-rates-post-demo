/**
 * Shared filter modal primitives — extracted so every "Filters" surface
 * across the Quote module (listing FiltersModal, detail-tab dropdowns
 * that were previously bespoke) reads as the same component. Mirrors
 * Partner Management's `vendors/FiltersModal.tsx` chrome exactly:
 * Dialog + header (X close, title, count badge) + scrollable
 * Section/Divider body + sticky footer with Clear all + Cancel +
 * primary "Show N {label}" CTA.
 *
 * Consumers wire their own field-specific UI into the body via the
 * Section/Pill/SearchableMultiSelect/RangeInputs primitives, and pass
 * a `getDraftMatchCount(draft)` callback so the CTA can render the
 * live preview count of records that match the staged draft.
 */
import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "@/app/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Search } from "lucide-react";

/* ─── Pill chip ─── */
export function Pill({
  label,
  selected,
  onClick,
  count,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border text-[13px] cursor-pointer transition-all select-none shrink-0 ${
        selected
          ? "border-primary/30 text-primary bg-accent"
          : "bg-white text-foreground border-border hover:border-muted-foreground/40 hover:bg-muted/30"
      }`}
      style={{ fontWeight: selected ? 500 : 400 }}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`text-[11px] tabular-nums ${selected ? "text-primary/60" : "text-muted-foreground/50"}`}>{count}</span>
      )}
    </button>
  );
}

/* ─── Section divider ─── */
export function Divider() {
  return <div className="border-t border-border/50 mx-6" />;
}

/* ─── Section wrapper ─── */
export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-6 py-4">
      <h4 className="text-[14px] mb-0.5" style={{ fontWeight: 600 }}>{title}</h4>
      {subtitle && <p className="text-[12px] text-muted-foreground mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

/* ─── Searchable multi-select ─── */
export function SearchableMultiSelect({
  options,
  selected,
  onToggle,
  getCount,
  placeholder = "Search…",
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  getCount?: (value: string) => number;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full h-9 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/40"
          style={{ paddingLeft: "2.125rem" }}
        />
      </div>
      <div className="-mx-1 px-1">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-muted-foreground/50 py-3 text-center">No results</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const selectedSet = new Set(selected);
              const isSearching = !!query.trim();
              if (isSearching) {
                return filtered.map(opt => {
                  const isChecked = selectedSet.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onToggle(opt.value)}
                      className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] border transition-colors cursor-pointer ${
                        isChecked ? "bg-accent border-primary/25 text-primary" : "bg-white border-border text-foreground hover:bg-muted/40"
                      }`}
                      style={{ fontWeight: isChecked ? 500 : 400 }}
                    >
                      <span className="truncate max-w-[140px]">{opt.label}</span>
                      {getCount && (
                        <span className={`text-[10px] tabular-nums ${isChecked ? "text-primary/60" : "text-muted-foreground/50"}`}>{getCount(opt.value)}</span>
                      )}
                    </button>
                  );
                });
              }
              const selectedOpts = filtered.filter(o => selectedSet.has(o.value));
              const suggestions = filtered.filter(o => !selectedSet.has(o.value)).slice(0, 6);
              const display = [...selectedOpts, ...suggestions];
              const remaining = filtered.filter(o => !selectedSet.has(o.value)).length - suggestions.length;
              return (
                <>
                  {display.map(opt => {
                    const isChecked = selectedSet.has(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onToggle(opt.value)}
                        className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] border transition-colors cursor-pointer ${
                          isChecked ? "bg-accent border-primary/25 text-primary" : "bg-white border-border text-foreground hover:bg-muted/40"
                        }`}
                        style={{ fontWeight: isChecked ? 500 : 400 }}
                      >
                        <span className="truncate max-w-[140px]">{opt.label}</span>
                        {getCount && (
                          <span className={`text-[10px] tabular-nums ${isChecked ? "text-primary/60" : "text-muted-foreground/50"}`}>{getCount(opt.value)}</span>
                        )}
                      </button>
                    );
                  })}
                  {remaining > 0 && (
                    <span className="inline-flex items-center h-[30px] px-2.5 text-[12px] text-muted-foreground/40 italic">
                      +{remaining} more, type to search
                    </span>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Min/Max range inputs ─── */
export function RangeInputs({
  min,
  max,
  onMinChange,
  onMaxChange,
  prefix = "$",
  minPlaceholder = "0",
  maxPlaceholder = "∞",
}: {
  min: string;
  max: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  prefix?: string;
  minPlaceholder?: string;
  maxPlaceholder?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Minimum</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{prefix}</span>
          <input
            type="number"
            placeholder={minPlaceholder}
            value={min}
            onChange={e => onMinChange(e.target.value)}
            className="w-full h-9 pl-7 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary tabular-nums"
          />
        </div>
      </div>
      <span className="text-muted-foreground/30 mt-5">–</span>
      <div className="flex-1">
        <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Maximum</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{prefix}</span>
          <input
            type="number"
            placeholder={maxPlaceholder}
            value={max}
            onChange={e => onMaxChange(e.target.value)}
            className="w-full h-9 pl-7 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary tabular-nums"
          />
        </div>
      </div>
    </div>
  );
}

/* ─── From/To date inputs ─── */
export function DateRangeInputs({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>From</label>
        <input
          type="date"
          value={from}
          onChange={e => onFromChange(e.target.value)}
          className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>To</label>
        <input
          type="date"
          value={to}
          onChange={e => onToChange(e.target.value)}
          className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
    </div>
  );
}

/* ─── Modal shell ─── */
export interface FilterModalShellProps<TFilters> {
  /** Whether the modal is open. */
  open: boolean;
  /** Called with `false` when the user dismisses (X / overlay / Esc). */
  onOpenChange: (open: boolean) => void;
  /** Applied filters — the source of truth on the parent. */
  applied: TFilters;
  /** Default empty/cleared filter shape. Used by Clear All. */
  empty: TFilters;
  /** Called when the user clicks the primary CTA. */
  onApply: (next: TFilters) => void;
  /** Counts the number of active filters in a given filter set. Drives
   *  the header badge and the empty-state collapse of the count. */
  countActive: (filters: TFilters) => number;
  /** Returns the count of records that match a given draft filter
   *  set — drives the "Show N {label}" CTA label. */
  getDraftMatchCount: (draft: TFilters) => number;
  /** Singular noun shown in the CTA, e.g. "quote", "version", "attachment". */
  itemLabel: string;
  /** Plural form for the CTA. Defaults to `itemLabel + "s"`. */
  itemLabelPlural?: string;
  /** Render-prop body that receives the live draft + setters. */
  children: (api: {
    draft: TFilters;
    setDraft: React.Dispatch<React.SetStateAction<TFilters>>;
    /** Single-field update helper. */
    update: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void;
    /** Multi-select toggle helper for `string[]` keys. */
    toggleMulti: (key: keyof TFilters, value: string) => void;
  }) => ReactNode;
}

export function FilterModalShell<TFilters>(props: FilterModalShellProps<TFilters>) {
  const {
    open,
    onOpenChange,
    applied,
    empty,
    onApply,
    countActive,
    getDraftMatchCount,
    itemLabel,
    itemLabelPlural,
    children,
  } = props;

  /* Staged-apply — re-sync on open so a previous-session draft doesn't
     leak in, and snap back to applied on dismiss. */
  const [draft, setDraft] = useState<TFilters>(applied);
  useEffect(() => {
    if (open) setDraft(applied);
  }, [open, applied]);

  const update = useCallback(<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleMulti = useCallback((key: keyof TFilters, value: string) => {
    setDraft(prev => {
      const arr = (prev as any)[key] as string[];
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] } as TFilters;
    });
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) setDraft(applied);
    onOpenChange(nextOpen);
  }, [applied, onOpenChange]);

  const handleApply = useCallback(() => {
    onApply(draft);
    onOpenChange(false);
  }, [draft, onApply, onOpenChange]);

  const handleClearAll = useCallback(() => {
    setDraft(empty);
  }, [empty]);

  const headerCount = countActive(draft);
  const matchCount = useMemo(() => getDraftMatchCount(draft), [draft, getDraftMatchCount]);
  const hasPendingChanges = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(applied),
    [draft, applied],
  );

  const plural = itemLabelPlural ?? `${itemLabel}s`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        {/* z-index ladder — must sit above any caller that opens us, since
            the PoC selection modal (RecipientsSelectionModal) renders at
            zIndex 12100/12101 from a portal of its own. Using 12200/12201
            keeps a 100-unit gap so future nested popovers can squeeze in. */}
        <DialogOverlay className="z-[12200]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[50%] left-[50%] z-[12201] translate-x-[-50%] translate-y-[-50%] w-full max-w-[680px] max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Filters</DialogPrimitive.Title>

          {/* Header */}
          <div className="flex items-center justify-center relative px-6 h-12 border-b border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors cursor-pointer"
              aria-label="Close filters"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-[14px]" style={{ fontWeight: 600 }}>Filters</span>
            {headerCount > 0 && (
              <span
                className="ml-2 min-w-[20px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 600 }}
              >
                {headerCount}
              </span>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {children({ draft, setDraft, update, toggleMulti })}
          </div>

          {/* Sticky footer — staged-apply CTAs. */}
          <div className="flex items-center justify-between px-6 h-14 border-t border-border/60 shrink-0">
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Clear all
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-border text-[13px] cursor-pointer transition-colors hover:bg-muted/40 text-foreground"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!hasPendingChanges}
                className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-white text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 600, cursor: hasPendingChanges ? "pointer" : "not-allowed" }}
              >
                {hasPendingChanges
                  ? `Show ${matchCount.toLocaleString()} ${matchCount === 1 ? itemLabel : plural}`
                  : "No changes"}
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
