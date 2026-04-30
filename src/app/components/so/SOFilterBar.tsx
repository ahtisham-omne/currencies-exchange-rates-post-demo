// @ts-nocheck
// SOFilterBar — Adapted from Partner Management FiltersModal layout
import { useState, useMemo, type ReactNode } from 'react';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from '../../components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, ChevronDown, ChevronUp, Search, SlidersHorizontal } from 'lucide-react';
import {
  SOActiveFilters,
  EMPTY_SO_FILTERS,
  countActiveSOFilters,
  SO_STATUSES, SO_PRIORITIES, SO_WAREHOUSES, SO_TAGS,
  SO_SALES_REPS, SO_CUSTOMERS,
} from './SOFilterUtils';

/* ─── Pill chip ─── */
function Pill({ label, selected, onClick, count }: {
  label: string; selected: boolean; onClick: () => void; count?: number;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border text-[13px] cursor-pointer transition-all select-none shrink-0 ${
        selected ? "border-primary/30 text-primary" : "bg-white text-foreground border-border hover:border-muted-foreground/40 hover:bg-muted/30"
      }`}
      style={{ fontWeight: selected ? 500 : 400, backgroundColor: selected ? "#EDF4FF" : undefined }}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`text-[11px] tabular-nums ${selected ? "text-primary/60" : "text-muted-foreground/50"}`}>{count}</span>
      )}
    </button>
  );
}

/* ─── Searchable multi-select with pill chips ─── */
function SearchableMultiSelect({ options, selected, onToggle, placeholder = "Search…" }: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedSet = new Set(selected);
  const isSearching = !!query.trim();

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
        <input type="text" placeholder={placeholder} value={query} onChange={e => setQuery(e.target.value)}
          className="w-full h-9 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/40"
          style={{ paddingLeft: "2.125rem" }}
        />
      </div>
      <div className="max-h-[180px] overflow-y-auto -mx-1 px-1 overscroll-contain">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-muted-foreground/50 py-3 text-center">No results</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              if (isSearching) {
                return filtered.map(opt => (
                  <button key={opt.value} type="button" onClick={() => onToggle(opt.value)}
                    className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] border transition-colors cursor-pointer ${
                      selectedSet.has(opt.value) ? "bg-[#EDF4FF] border-primary/25 text-primary" : "bg-white border-border text-foreground hover:bg-muted/40"
                    }`}
                    style={{ fontWeight: selectedSet.has(opt.value) ? 500 : 400 }}
                  >
                    <span className="truncate max-w-[140px]">{opt.label}</span>
                  </button>
                ));
              }
              const selectedOpts = filtered.filter(o => selectedSet.has(o.value));
              const suggestions = filtered.filter(o => !selectedSet.has(o.value)).slice(0, 6);
              const display = [...selectedOpts, ...suggestions];
              const remaining = filtered.filter(o => !selectedSet.has(o.value)).length - suggestions.length;
              return (
                <>
                  {display.map(opt => (
                    <button key={opt.value} type="button" onClick={() => onToggle(opt.value)}
                      className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] border transition-colors cursor-pointer ${
                        selectedSet.has(opt.value) ? "bg-[#EDF4FF] border-primary/25 text-primary" : "bg-white border-border text-foreground hover:bg-muted/40"
                      }`}
                      style={{ fontWeight: selectedSet.has(opt.value) ? 500 : 400 }}
                    >
                      <span className="truncate max-w-[140px]">{opt.label}</span>
                    </button>
                  ))}
                  {remaining > 0 && (
                    <span className="inline-flex items-center h-[30px] px-2.5 text-[12px] text-muted-foreground/40 italic">
                      +{remaining} more — type to search
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

/* ─── Range input ─── */
function RangeInput({ min, max, onMinChange, onMaxChange, prefix = "$" }: {
  min: string; max: string; onMinChange: (v: string) => void; onMaxChange: (v: string) => void; prefix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Minimum</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{prefix}</span>
          <input type="number" placeholder="0" value={min} onChange={e => onMinChange(e.target.value)}
            className="w-full h-9 pl-7 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] tabular-nums"
          />
        </div>
      </div>
      <span className="text-muted-foreground/30 mt-5">–</span>
      <div className="flex-1">
        <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Maximum</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{prefix}</span>
          <input type="number" placeholder="0" value={max} onChange={e => onMaxChange(e.target.value)}
            className="w-full h-9 pl-7 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] tabular-nums"
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Section divider & wrapper ─── */
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

/* ─── Main SOFilterBar ─── */
interface SOFilterBarProps {
  filters: SOActiveFilters;
  onFiltersChange: (f: SOActiveFilters) => void;
  isKanbanView?: boolean;
}

export function SOFilterBar({ filters, onFiltersChange, isKanbanView }: SOFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = useMemo(() => countActiveSOFilters(filters), [filters]);

  const toggleMulti = (key: keyof SOActiveFilters, value: string) => {
    const arr = filters[key] as string[];
    onFiltersChange({
      ...filters,
      [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
    });
  };

  const salesRepOpts = useMemo(() => SO_SALES_REPS.map(r => ({ value: r.id, label: r.name })), []);
  const customerOpts = useMemo(() => SO_CUSTOMERS.map(c => ({ value: c.id, label: c.name })), []);
  const tagOpts = useMemo(() => SO_TAGS.map(t => ({ value: t, label: t })), []);
  const warehouseOpts = useMemo(() => SO_WAREHOUSES.map(w => ({ value: w, label: w })), []);

  // Internal range state mapped to/from valueFilter
  const valueMin = filters.valueFilter ? String(filters.valueFilter.value || '') : '';
  const valueMax = filters.valueFilter?.valueTo ? String(filters.valueFilter.valueTo) : '';

  const handleValueMinChange = (v: string) => {
    const num = parseFloat(v) || 0;
    if (!v && !valueMax) { onFiltersChange({ ...filters, valueFilter: null }); return; }
    onFiltersChange({ ...filters, valueFilter: { operator: 'between', value: num, valueTo: parseFloat(valueMax) || 0 } });
  };
  const handleValueMaxChange = (v: string) => {
    const num = parseFloat(v) || 0;
    if (!v && !valueMin) { onFiltersChange({ ...filters, valueFilter: null }); return; }
    onFiltersChange({ ...filters, valueFilter: { operator: 'between', value: parseFloat(valueMin) || 0, valueTo: num } });
  };

  // Date range (simple from/to using dateFilters)
  const createdDateFilter = filters.dateFilters.find(d => d.field === 'createdDate');
  const orderDateFilter = filters.dateFilters.find(d => d.field === 'orderDate');
  const shipByDateFilter = filters.dateFilters.find(d => d.field === 'shipByDate');

  const setDateRange = (field: string, from: string, to: string) => {
    const others = filters.dateFilters.filter(d => d.field !== field);
    if (!from && !to) {
      onFiltersChange({ ...filters, dateFilters: others });
    } else {
      onFiltersChange({ ...filters, dateFilters: [...others, { id: `df-${field}`, field: field as any, operator: 'between' as any, value: from, valueTo: to }] });
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 ${
          activeCount > 0
            ? "text-primary border-primary/30"
            : "text-foreground border-border/80"
        }`}
      >
        <SlidersHorizontal className={`w-3.5 h-3.5 ${activeCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
        {activeCount > 0 && (
          <span className="ml-0.5 min-w-[18px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
            style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}>{activeCount}</span>
        )}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed top-[50%] left-[50%] z-[200] translate-x-[-50%] translate-y-[-50%] w-full max-w-[680px] max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 outline-none"
          >
            <DialogPrimitive.Title className="sr-only">Filters</DialogPrimitive.Title>

            {/* ─── Header ─── */}
            <div className="flex items-center justify-center relative px-6 h-12 border-b border-border/60 shrink-0">
              <button type="button" onClick={() => setIsOpen(false)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors cursor-pointer"
              ><X className="w-4 h-4" /></button>
              <span className="text-[14px]" style={{ fontWeight: 600 }}>Filters</span>
              {activeCount > 0 && (
                <span className="ml-2 min-w-[20px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                  style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}>{activeCount}</span>
              )}
            </div>

            {/* ─── Scrollable body ─── */}
            <div className="flex-1 overflow-y-auto overscroll-contain">

              {/* Status — pill chips (hidden in kanban) */}
              {!isKanbanView && (
                <>
                  <Section title="Status" subtitle="Filter by order status.">
                    <div className="flex flex-wrap gap-1.5">
                      <Pill label="Any" selected={filters.statuses.length === 0} onClick={() => onFiltersChange({ ...filters, statuses: [] })} />
                      {SO_STATUSES.map(s => (
                        <Pill key={s} label={s} selected={filters.statuses.includes(s)}
                          onClick={() => toggleMulti('statuses', s)} />
                      ))}
                    </div>
                  </Section>
                  <Divider />
                </>
              )}

              {/* Priority */}
              <Section title="Priority">
                <div className="flex flex-wrap gap-1.5">
                  <Pill label="Any" selected={filters.priorities.length === 0} onClick={() => onFiltersChange({ ...filters, priorities: [] })} />
                  {SO_PRIORITIES.map(p => (
                    <Pill key={p} label={p} selected={filters.priorities.includes(p)}
                      onClick={() => toggleMulti('priorities', p)} />
                  ))}
                </div>
              </Section>

              <Divider />

              {/* Sales Rep — searchable multi-select */}
              <Section title="Sales representative">
                <SearchableMultiSelect options={salesRepOpts} selected={filters.salesReps}
                  onToggle={id => toggleMulti('salesReps', id)} placeholder="Search reps…" />
              </Section>

              <Divider />

              {/* Customer — searchable multi-select */}
              <Section title="Customer">
                <SearchableMultiSelect options={customerOpts} selected={filters.customers}
                  onToggle={id => toggleMulti('customers', id)} placeholder="Search customers…" />
              </Section>

              <Divider />

              {/* Warehouse */}
              <Section title="Warehouse">
                <SearchableMultiSelect options={warehouseOpts} selected={filters.warehouses}
                  onToggle={id => toggleMulti('warehouses', id)} placeholder="Search warehouses…" />
              </Section>

              <Divider />

              {/* Tags */}
              <Section title="Tags">
                <SearchableMultiSelect options={tagOpts} selected={filters.tags}
                  onToggle={id => toggleMulti('tags', id)} placeholder="Search tags…" />
              </Section>

              <Divider />

              {/* Order Value — range */}
              <Section title="Order value range" subtitle="Filter by total order value.">
                <RangeInput min={valueMin} max={valueMax} onMinChange={handleValueMinChange} onMaxChange={handleValueMaxChange} />
              </Section>

              <Divider />

              {/* Order Date — date range */}
              <Section title="Order date" subtitle="Filter by order date.">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>From</label>
                    <input type="date" value={orderDateFilter?.value || ''} onChange={e => setDateRange('orderDate', e.target.value, orderDateFilter?.valueTo || '')}
                      className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>To</label>
                    <input type="date" value={orderDateFilter?.valueTo || ''} onChange={e => setDateRange('orderDate', orderDateFilter?.value || '', e.target.value)}
                      className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                </div>
              </Section>

              <Divider />

              {/* Ship By Date — date range */}
              <Section title="Ship by date">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>From</label>
                    <input type="date" value={shipByDateFilter?.value || ''} onChange={e => setDateRange('shipByDate', e.target.value, shipByDateFilter?.valueTo || '')}
                      className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>To</label>
                    <input type="date" value={shipByDateFilter?.valueTo || ''} onChange={e => setDateRange('shipByDate', shipByDateFilter?.value || '', e.target.value)}
                      className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                </div>
              </Section>

              <Divider />

              {/* Created Date — date range */}
              <Section title="Created on" subtitle="Filter by creation date.">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>From</label>
                    <input type="date" value={createdDateFilter?.value || ''} onChange={e => setDateRange('createdDate', e.target.value, createdDateFilter?.valueTo || '')}
                      className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>To</label>
                    <input type="date" value={createdDateFilter?.valueTo || ''} onChange={e => setDateRange('createdDate', createdDateFilter?.value || '', e.target.value)}
                      className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                </div>
              </Section>
            </div>

            {/* ─── Sticky footer ─── */}
            <div className="flex items-center justify-between px-6 h-14 border-t border-border/60 shrink-0">
              <button type="button" onClick={() => onFiltersChange({ ...EMPTY_SO_FILTERS })}
                className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >Clear all</button>
              <button type="button" onClick={() => setIsOpen(false)}
                className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-white text-[13px] cursor-pointer transition-colors hover:opacity-90"
                style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
              >Apply filters</button>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </>
  );
}
