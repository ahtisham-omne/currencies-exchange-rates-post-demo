import { useState, useMemo, useEffect } from "react";
import type { ReactNode } from "react";
import type { Quote } from "@/app/types/quote";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "@/app/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronDown, ChevronUp, Search } from "lucide-react";

/* ─── Filter Types ─── */
export interface QuoteAdvancedFilters {
  statuses: string[];
  priorities: string[];
  salesReps: string[];
  customers: string[];
  pocs: string[];
  valueMin: string;
  valueMax: string;
  createdFrom: string;
  createdTo: string;
  expiryFrom: string;
  expiryTo: string;
}

export const DEFAULT_QUOTE_FILTERS: QuoteAdvancedFilters = {
  statuses: [],
  priorities: [],
  salesReps: [],
  customers: [],
  pocs: [],
  valueMin: "",
  valueMax: "",
  createdFrom: "",
  createdTo: "",
  expiryFrom: "",
  expiryTo: "",
};

export function countActiveQuoteFilters(f: QuoteAdvancedFilters): number {
  let count = 0;
  if (f.statuses.length > 0) count++;
  if (f.priorities.length > 0) count++;
  if (f.salesReps.length > 0) count++;
  if (f.customers.length > 0) count++;
  if (f.pocs.length > 0) count++;
  if (f.valueMin || f.valueMax) count++;
  if (f.createdFrom || f.createdTo) count++;
  if (f.expiryFrom || f.expiryTo) count++;
  return count;
}

/* Pure predicate version of the advanced filters — exported so the
   listing page AND the modal's footer CTA can both ask "how many
   quotes does this filter set match?" without duplicating the
   matching rules. Mirrors the chain that ran inline inside
   QuotesListPage.filteredQuotes. */
export function quoteMatchesAdvancedFilters(q: Quote, f: QuoteAdvancedFilters): boolean {
  if (f.statuses.length > 0 && !f.statuses.includes(q.status)) return false;
  if (f.priorities.length > 0 && !f.priorities.includes(q.priority as any)) return false;
  if (f.salesReps.length > 0) {
    const n = typeof q.salesRep === 'string' ? q.salesRep : (q.salesRep as any)?.name || '';
    if (!f.salesReps.includes(n)) return false;
  }
  if (f.customers.length > 0) {
    const n = typeof q.customer === 'string' ? q.customer : (q.customer as any)?.name || '';
    if (!f.customers.includes(n)) return false;
  }
  if (f.pocs.length > 0) {
    const primary = typeof (q as any).primaryPoC === 'string' ? (q as any).primaryPoC : (q as any).primaryPoC?.name;
    const additional = (q as any).additionalPoCs;
    const additionalMatch = Array.isArray(additional) && additional.some((p: any) => f.pocs.includes(typeof p === 'string' ? p : p?.name));
    if (!(primary && f.pocs.includes(primary)) && !additionalMatch) return false;
  }
  if (f.valueMin && (q.totalValue || 0) < Number(f.valueMin)) return false;
  if (f.valueMax && (q.totalValue || 0) > Number(f.valueMax)) return false;
  if (f.createdFrom && (!q.createdDate || new Date(q.createdDate) < new Date(f.createdFrom))) return false;
  if (f.createdTo) {
    const to = new Date(f.createdTo); to.setHours(23, 59, 59, 999);
    if (!q.createdDate || new Date(q.createdDate) > to) return false;
  }
  if (f.expiryFrom && (!q.expiryDate || new Date(q.expiryDate) < new Date(f.expiryFrom))) return false;
  if (f.expiryTo) {
    const to = new Date(f.expiryTo); to.setHours(23, 59, 59, 999);
    if (!q.expiryDate || new Date(q.expiryDate) > to) return false;
  }
  return true;
}

/* ─── Helpers ─── */
const formatShort = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
};

/* ─── Sub-components ─── */
function Pill({ label, selected, onClick, count }: { label: string; selected: boolean; onClick: () => void; count?: number }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border text-[13px] cursor-pointer transition-all select-none shrink-0 ${
        selected ? "border-primary/30 text-primary bg-accent" : "bg-white text-foreground border-border hover:border-muted-foreground/40 hover:bg-muted/30"
      }`}
      style={{ fontWeight: selected ? 500 : 400 }}>
      <span>{label}</span>
      {count !== undefined && (
        <span className={`text-[11px] tabular-nums ${selected ? "text-primary/60" : "text-muted-foreground/50"}`}>{count}</span>
      )}
    </button>
  );
}

function SearchableMultiSelect({ options, selected, onToggle, getCount, placeholder = "Search…" }: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  getCount: (value: string) => number;
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
        <input type="text" placeholder={placeholder} value={query} onChange={e => setQuery(e.target.value)}
          className="w-full h-9 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/40"
          style={{ paddingLeft: "2.125rem" }} />
      </div>
      {/* No inner v-scroll — the modal body already scrolls, and a
          nested 180px scroll-box was creating a confusing double
          scrollbar (the chip area scrolled independently of the
          modal). Chips now flow naturally; long lists are bounded
          by the modal's own scroll. */}
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
                    <button key={opt.value} type="button" onClick={() => onToggle(opt.value)}
                      className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] border transition-colors cursor-pointer ${
                        isChecked ? "bg-accent border-primary/25 text-primary" : "bg-white border-border text-foreground hover:bg-muted/40"
                      }`} style={{ fontWeight: isChecked ? 500 : 400 }}>
                      <span className="truncate max-w-[140px]">{opt.label}</span>
                      <span className={`text-[10px] tabular-nums ${isChecked ? "text-primary/60" : "text-muted-foreground/50"}`}>{getCount(opt.value)}</span>
                    </button>
                  );
                });
              }
              const selectedOpts = filtered.filter(o => selectedSet.has(o.value));
              const suggestions = filtered.filter(o => !selectedSet.has(o.value)).sort((a, b) => getCount(b.value) - getCount(a.value)).slice(0, 6);
              const display = [...selectedOpts, ...suggestions];
              const remaining = filtered.filter(o => !selectedSet.has(o.value)).length - suggestions.length;
              return (
                <>
                  {display.map(opt => {
                    const isChecked = selectedSet.has(opt.value);
                    return (
                      <button key={opt.value} type="button" onClick={() => onToggle(opt.value)}
                        className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] border transition-colors cursor-pointer ${
                          isChecked ? "bg-accent border-primary/25 text-primary" : "bg-white border-border text-foreground hover:bg-muted/40"
                        }`} style={{ fontWeight: isChecked ? 500 : 400 }}>
                        <span className="truncate max-w-[140px]">{opt.label}</span>
                        <span className={`text-[10px] tabular-nums ${isChecked ? "text-primary/60" : "text-muted-foreground/50"}`}>{getCount(opt.value)}</span>
                      </button>
                    );
                  })}
                  {remaining > 0 && <span className="inline-flex items-center h-[30px] px-2.5 text-[12px] text-muted-foreground/40 italic">+{remaining} more — type to search</span>}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function RangeInputs({ min, max, onMinChange, onMaxChange, prefix = "$" }: {
  min: string; max: string; onMinChange: (v: string) => void; onMaxChange: (v: string) => void; prefix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Minimum</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{prefix}</span>
          <input type="number" placeholder="0" value={min} onChange={e => onMinChange(e.target.value)}
            className="w-full h-9 pl-7 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))] focus:border-[#ADD1FF] tabular-nums" />
        </div>
      </div>
      <span className="text-muted-foreground/30 mt-5">–</span>
      <div className="flex-1">
        <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Maximum</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{prefix}</span>
          <input type="number" placeholder="∞" value={max} onChange={e => onMaxChange(e.target.value)}
            className="w-full h-9 pl-7 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))] focus:border-[#ADD1FF] tabular-nums" />
        </div>
      </div>
    </div>
  );
}

function Divider() { return <div className="border-t border-border/50 mx-6" />; }

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="px-6 py-4">
      <h4 className="text-[14px] mb-0.5" style={{ fontWeight: 600 }}>{title}</h4>
      {subtitle && <p className="text-[12px] text-muted-foreground mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

/* ─── Main Component ─── */
interface FiltersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: QuoteAdvancedFilters;
  onFiltersChange: (filters: QuoteAdvancedFilters) => void;
  quotes: Quote[];
  filteredCount: number;
}

export function QuoteFiltersModal({ open, onOpenChange, filters, onFiltersChange, quotes, filteredCount }: FiltersModalProps) {
  /* Staged apply — every change updates a local draft, the listing's
     applied filters only move when the user clicks Apply. Re-syncs
     to props each time the modal opens so the draft never carries
     stale edits from a previous session. The X close, the overlay
     click, and Esc all discard the pending draft. */
  const [draftFilters, setDraftFilters] = useState<QuoteAdvancedFilters>(filters);
  useEffect(() => {
    if (open) setDraftFilters(filters);
  }, [open, filters]);

  const update = <K extends keyof QuoteAdvancedFilters>(key: K, value: QuoteAdvancedFilters[K]) =>
    setDraftFilters(prev => ({ ...prev, [key]: value }));

  const toggleMulti = (key: keyof QuoteAdvancedFilters, value: string) => {
    setDraftFilters(prev => {
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const handleApply = () => {
    onFiltersChange(draftFilters);
    onOpenChange(false);
  };

  const handleClearAll = () => setDraftFilters({ ...DEFAULT_QUOTE_FILTERS });

  /* Discard pending changes whenever the user dismisses the modal
     without clicking Apply. */
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setDraftFilters(filters);
    onOpenChange(nextOpen);
  };

  const filterOptions = useMemo(() => {
    const salesReps = new Set<string>();
    const customers = new Set<string>();
    const pocs = new Set<string>();
    quotes.forEach(q => {
      const repName = typeof q.salesRep === 'string' ? q.salesRep : q.salesRep?.name;
      if (repName) salesReps.add(repName);
      const custName = typeof q.customer === 'string' ? q.customer : q.customer?.name;
      if (custName) customers.add(custName);
      /* Collect every PoC referenced on each quote — primary + any
         additional contacts — so the filter searches against the full
         POC roster, not just the headline one shown in the listing. */
      const primaryPoc = typeof (q as any).primaryPoC === 'string'
        ? (q as any).primaryPoC
        : (q as any).primaryPoC?.name;
      if (primaryPoc) pocs.add(primaryPoc);
      const additional = (q as any).additionalPoCs;
      if (Array.isArray(additional)) {
        additional.forEach((p: any) => {
          const n = typeof p === 'string' ? p : p?.name;
          if (n) pocs.add(n);
        });
      }
    });
    return {
      salesReps: Array.from(salesReps).sort().map(v => ({ value: v, label: v })),
      customers: Array.from(customers).sort().map(v => ({ value: v, label: v })),
      pocs: Array.from(pocs).sort().map(v => ({ value: v, label: v })),
    };
  }, [quotes]);

  /* Predicate: does a quote reference the given PoC by name? Walks
     the primary + additional roster so a quote is counted regardless
     of which slot the PoC sits in. */
  const quoteHasPoc = (q: Quote, name: string): boolean => {
    const primary = typeof (q as any).primaryPoC === 'string'
      ? (q as any).primaryPoC
      : (q as any).primaryPoC?.name;
    if (primary === name) return true;
    const additional = (q as any).additionalPoCs;
    if (Array.isArray(additional)) {
      return additional.some((p: any) => (typeof p === 'string' ? p : p?.name) === name);
    }
    return false;
  };

  const activeCount = countActiveQuoteFilters(draftFilters);

  /* Count of quotes that match the staged draft — drives the
     "Show N quotes" CTA label. Recomputes only when the draft or
     the underlying catalogue changes. */
  const draftMatchCount = useMemo(
    () => quotes.filter((q) => quoteMatchesAdvancedFilters(q, draftFilters)).length,
    [quotes, draftFilters],
  );

  /* The Apply CTA is disabled when the draft equals the currently
     applied filter set (nothing to commit). Compared via JSON since
     QuoteAdvancedFilters is plain data. */
  const hasPendingChanges = useMemo(
    () => JSON.stringify(draftFilters) !== JSON.stringify(filters),
    [draftFilters, filters],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[50%] left-[50%] z-[200] translate-x-[-50%] translate-y-[-50%] w-full max-w-[680px] max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 outline-none">
          <DialogPrimitive.Title className="sr-only">Filters</DialogPrimitive.Title>

          {/* Header */}
          <div className="flex items-center justify-center relative px-6 h-12 border-b border-border/60 shrink-0">
            <button type="button" onClick={() => handleOpenChange(false)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
            <span className="text-[14px]" style={{ fontWeight: 600 }}>Filters</span>
            {activeCount > 0 && (
              <span className="ml-2 min-w-[20px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 600 }}>{activeCount}</span>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {/* Status */}
            <Section title="Status">
              <div className="flex flex-wrap gap-1.5">
                <Pill label="Any" selected={draftFilters.statuses.length === 0} onClick={() => update("statuses", [])} />
                {["Draft", "Sent to Customer", "Unconfirmed SO", "Confirmed SO", "Expired", "Cancelled"].map(s => (
                  <Pill key={s} label={s === "Unconfirmed SO" ? "Confirmed by Customer" : s === "Confirmed SO" ? "Converted to SO" : s}
                    selected={draftFilters.statuses.includes(s)} onClick={() => toggleMulti("statuses", s)}
                    count={quotes.filter(q => q.status === s).length} />
                ))}
              </div>
            </Section>

            <Divider />

            {/* Priority */}
            <Section title="Priority">
              <div className="flex flex-wrap gap-1.5">
                <Pill label="Any" selected={draftFilters.priorities.length === 0} onClick={() => update("priorities", [])} />
                {["High", "Standard", "Low"].map(p => (
                  <Pill key={p} label={p} selected={draftFilters.priorities.includes(p)} onClick={() => toggleMulti("priorities", p)}
                    count={quotes.filter(q => {
                      // Match canonical labels as well as legacy mock values
                      if (p === 'High') return q.priority === 'High' || q.priority === 'Urgent';
                      if (p === 'Standard') return q.priority === 'Standard' || q.priority === 'Medium';
                      return q.priority === 'Low';
                    }).length} />
                ))}
              </div>
            </Section>

            <Divider />

            {/* Sales Rep */}
            {filterOptions.salesReps.length > 0 && (
              <>
                <Section title="Sales representative">
                  <SearchableMultiSelect options={filterOptions.salesReps} selected={draftFilters.salesReps}
                    onToggle={v => toggleMulti("salesReps", v)}
                    getCount={val => quotes.filter(q => (typeof q.salesRep === 'string' ? q.salesRep : q.salesRep?.name) === val).length}
                    placeholder="Search reps…" />
                </Section>
                <Divider />
              </>
            )}

            {/* Customer */}
            {filterOptions.customers.length > 0 && (
              <>
                <Section title="Customer">
                  <SearchableMultiSelect options={filterOptions.customers} selected={draftFilters.customers}
                    onToggle={v => toggleMulti("customers", v)}
                    getCount={val => quotes.filter(q => (typeof q.customer === 'string' ? q.customer : q.customer?.name) === val).length}
                    placeholder="Search customers…" />
                </Section>
                <Divider />
              </>
            )}

            {/* Point of contact — same searchable multi-select UI as
                the Customer block above. Matches any quote whose
                primary OR additional PoC roster contains the chosen
                contact, so contacts that don't appear as the headline
                PoC on the listing are still findable. */}
            {filterOptions.pocs.length > 0 && (
              <>
                <Section title="Point of contact">
                  <SearchableMultiSelect options={filterOptions.pocs} selected={draftFilters.pocs}
                    onToggle={v => toggleMulti("pocs", v)}
                    getCount={val => quotes.filter(q => quoteHasPoc(q, val)).length}
                    placeholder="Search contacts…" />
                </Section>
                <Divider />
              </>
            )}

            {/* Quote Value Range */}
            <Section title="Quote value range" subtitle="Filter by total quote value.">
              <RangeInputs min={draftFilters.valueMin} max={draftFilters.valueMax}
                onMinChange={v => update("valueMin", v)} onMaxChange={v => update("valueMax", v)} />
            </Section>

            <Divider />

            {/* Created On */}
            <Section title="Created on" subtitle="Filter by creation date.">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>From</label>
                  <input type="date" value={draftFilters.createdFrom} onChange={e => update("createdFrom", e.target.value)}
                    className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>To</label>
                  <input type="date" value={draftFilters.createdTo} onChange={e => update("createdTo", e.target.value)}
                    className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
            </Section>

            <Divider />

            {/* Expiration Date */}
            <Section title="Expiration date" subtitle="Filter by expiration date.">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>From</label>
                  <input type="date" value={draftFilters.expiryFrom} onChange={e => update("expiryFrom", e.target.value)}
                    className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>To</label>
                  <input type="date" value={draftFilters.expiryTo} onChange={e => update("expiryTo", e.target.value)}
                    className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
            </Section>
          </div>

          {/* Sticky footer — staged-apply CTAs.
              - "Clear all" resets the draft inside the modal (doesn't
                touch the applied filters until the user clicks Apply).
              - "Cancel" discards the draft and closes.
              - The primary CTA label reads "Show {N} quotes" where N
                is the count of quotes that match the current draft
                filter set. Disabled (and label flips to "No changes")
                when the draft equals the applied filters so the CTA
                states stay honest about what clicking will do. */}
          <div className="flex items-center justify-between px-6 h-14 border-t border-border/60 shrink-0">
            <button type="button" onClick={handleClearAll}
              className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}>Clear all</button>
            <button type="button" onClick={handleApply}
              className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-white text-[13px] cursor-pointer transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", fontWeight: 600 }}>
              Show {draftMatchCount.toLocaleString()} quote{draftMatchCount !== 1 ? "s" : ""}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
