import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Filter, ChevronDown, Search, X, Plus, Calendar, DollarSign,
  Type, Trash2, Check, BarChart3,
} from 'lucide-react';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from '@/app/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { QuoteStatus, Priority } from '@/app/types/quote';
import {
  ActiveFilters,
  DateFilter, DateFieldKey, DateOperator,
  ValueFilter, ValueOperator,
  TextFilter, TextFieldKey, TextOperator,
  DATE_FIELD_LABELS, DATE_OPERATOR_LABELS,
  VALUE_OPERATOR_LABELS,
  TEXT_FIELD_LABELS, TEXT_OPERATOR_LABELS,
  countActiveFilters,
} from '@/app/utils/quoteUtils';
import { SALES_REPS, STATUSES, PRIORITIES, TAGS, CUSTOMERS } from '@/app/data/mockQuotes';

// ── Shared inline styles ──────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: '#6B7280',
  textTransform: 'none', marginBottom: '8px',
};

const checkboxLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  cursor: 'pointer', padding: '3px 0', fontSize: '13px', color: '#374151',
};

const miniSelect: React.CSSProperties = {
  height: '28px', padding: '0 8px', fontSize: '12px', fontWeight: 500,
  border: '1px solid #E5E7EB', borderRadius: '6px', backgroundColor: '#FFFFFF',
  color: '#374151', outline: 'none', cursor: 'pointer',
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  paddingRight: '24px',
};

const miniInput: React.CSSProperties = {
  height: '28px', padding: '0 8px', fontSize: '12px',
  border: '1px solid #E5E7EB', borderRadius: '6px', backgroundColor: '#FFFFFF',
  color: '#374151', outline: 'none', width: '100%',
};

const deleteBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '24px', height: '24px', borderRadius: '4px',
  border: 'none', background: 'none', cursor: 'pointer',
  color: '#9CA3AF', transition: 'all 100ms', flexShrink: 0,
};

// ── Searchable Multi-Select (for large lists) ─────────────────────────

function SearchableMultiSelect({
  items,
  selected,
  onToggle,
  placeholder,
  renderItem,
  getId,
}: {
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  placeholder: string;
  renderItem?: (item: { id: string; label: string }, isSelected: boolean) => React.ReactNode;
  getId?: (item: { id: string; label: string }) => string;
}) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter(i => i.label.toLowerCase().includes(term));
  }, [items, search]);

  const getItemId = getId || ((item: { id: string }) => item.id);

  return (
    <div>
      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: '6px' }}>
        <Search style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: '#9CA3AF' }} />
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={placeholder}
          style={{ ...miniInput, paddingLeft: '28px', width: '100%' }}
        />
        {search && (
          <button
            onClick={() => { setSearch(''); inputRef.current?.focus(); }}
            style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            <X style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
          </button>
        )}
      </div>
      {/* Selected count */}
      {selected.length > 0 && (
        <div style={{ fontSize: '11px', color: '#1B6EF3', fontWeight: 500, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {selected.length} selected
          <button
            onClick={() => selected.forEach(id => onToggle(id))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#6B7280', textDecoration: 'underline', padding: 0 }}
          >
            clear
          </button>
        </div>
      )}
      {/* List */}
      <div style={{
        maxHeight: '160px', overflowY: 'auto', scrollbarWidth: 'thin' as const,
        scrollbarColor: '#D1D5DB transparent',
      }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: '12px', color: '#9CA3AF', padding: '8px 0', textAlign: 'center' }}>No results</div>
        )}
        {filtered.map(item => {
          const itemId = getItemId(item);
          const isSel = selected.includes(itemId);
          return (
            <label key={itemId} style={checkboxLabel}>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                border: isSel ? '1px solid #1B6EF3' : '1px solid #D1D5DB',
                backgroundColor: isSel ? '#1B6EF3' : '#FFFFFF',
                transition: 'all 100ms',
              }}>
                {isSel && <Check style={{ width: '10px', height: '10px', color: '#FFFFFF' }} />}
              </span>
              {renderItem ? renderItem(item, isSel) : (
                <span style={{ fontSize: '12px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Date Filter Row ───────────────────────────────────────────────────

const DATE_FIELDS: DateFieldKey[] = ['createdDate', 'requestedDate', 'respondBy', 'expiryDate', 'confirmationDate', 'lastUpdated'];
const DATE_OPERATORS_STATIC: DateOperator[] = ['is', 'before', 'after', 'between'];
const DATE_OPERATORS_RELATIVE: DateOperator[] = ['last_7_days', 'last_30_days', 'last_90_days', 'this_week', 'this_month', 'this_quarter', 'this_year'];
const DATE_OPERATORS_NULL: DateOperator[] = ['is_empty', 'is_not_empty'];

function needsDateValue(op: DateOperator): boolean {
  return DATE_OPERATORS_STATIC.includes(op);
}

function DateFilterRow({ rule, onChange, onRemove }: {
  rule: DateFilter;
  onChange: (updated: DateFilter) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
      {/* Field */}
      <select
        value={rule.field}
        onChange={e => onChange({ ...rule, field: e.target.value as DateFieldKey })}
        style={{ ...miniSelect, width: '130px', flexShrink: 0 }}
      >
        {DATE_FIELDS.map(f => <option key={f} value={f}>{DATE_FIELD_LABELS[f]}</option>)}
      </select>
      {/* Operator */}
      <select
        value={rule.operator}
        onChange={e => onChange({ ...rule, operator: e.target.value as DateOperator, value: undefined, valueTo: undefined })}
        style={{ ...miniSelect, width: '140px', flexShrink: 0 }}
      >
        <optgroup label="Exact">
          {DATE_OPERATORS_STATIC.map(o => <option key={o} value={o}>{DATE_OPERATOR_LABELS[o]}</option>)}
        </optgroup>
        <optgroup label="Relative">
          {DATE_OPERATORS_RELATIVE.map(o => <option key={o} value={o}>{DATE_OPERATOR_LABELS[o]}</option>)}
        </optgroup>
        <optgroup label="Null check">
          {DATE_OPERATORS_NULL.map(o => <option key={o} value={o}>{DATE_OPERATOR_LABELS[o]}</option>)}
        </optgroup>
      </select>
      {/* Value(s) */}
      {needsDateValue(rule.operator) && (
        <>
          <input
            type="date"
            value={rule.value || ''}
            onChange={e => onChange({ ...rule, value: e.target.value })}
            style={{ ...miniInput, width: '140px', flexShrink: 0 }}
          />
          {rule.operator === 'between' && (
            <>
              <span style={{ fontSize: '12px', color: '#9CA3AF', flexShrink: 0 }}>to</span>
              <input
                type="date"
                value={rule.valueTo || ''}
                onChange={e => onChange({ ...rule, valueTo: e.target.value })}
                style={{ ...miniInput, width: '140px', flexShrink: 0 }}
              />
            </>
          )}
        </>
      )}
      <div style={{ flex: 1 }} />
      <button
        onClick={onRemove}
        style={deleteBtn}
        onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <Trash2 style={{ width: '13px', height: '13px' }} />
      </button>
    </div>
  );
}

// ── Text Filter Row ───────────────────────────────────────────────────

const TEXT_FIELDS: TextFieldKey[] = ['quoteNumber', 'description', 'customerName'];
const TEXT_OPERATORS_WITH_VALUE: TextOperator[] = ['contains', 'not_contains', 'starts_with', 'ends_with', 'equals', 'not_equals'];
const TEXT_OPERATORS_NULL: TextOperator[] = ['is_empty', 'is_not_empty'];

function needsTextValue(op: TextOperator): boolean {
  return TEXT_OPERATORS_WITH_VALUE.includes(op);
}

function TextFilterRow({ rule, onChange, onRemove }: {
  rule: TextFilter;
  onChange: (updated: TextFilter) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
      <select
        value={rule.field}
        onChange={e => onChange({ ...rule, field: e.target.value as TextFieldKey })}
        style={{ ...miniSelect, width: '130px', flexShrink: 0 }}
      >
        {TEXT_FIELDS.map(f => <option key={f} value={f}>{TEXT_FIELD_LABELS[f]}</option>)}
      </select>
      <select
        value={rule.operator}
        onChange={e => onChange({ ...rule, operator: e.target.value as TextOperator })}
        style={{ ...miniSelect, width: '150px', flexShrink: 0 }}
      >
        {TEXT_OPERATORS_WITH_VALUE.map(o => <option key={o} value={o}>{TEXT_OPERATOR_LABELS[o]}</option>)}
        <optgroup label="Null check">
          {TEXT_OPERATORS_NULL.map(o => <option key={o} value={o}>{TEXT_OPERATOR_LABELS[o]}</option>)}
        </optgroup>
      </select>
      {needsTextValue(rule.operator) && (
        <input
          type="text"
          value={rule.value}
          onChange={e => onChange({ ...rule, value: e.target.value })}
          placeholder="Enter value..."
          style={{ ...miniInput, flex: 1, minWidth: '120px' }}
        />
      )}
      <div style={{ flex: needsTextValue(rule.operator) ? 0 : 1 }} />
      <button
        onClick={onRemove}
        style={deleteBtn}
        onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <Trash2 style={{ width: '13px', height: '13px' }} />
      </button>
    </div>
  );
}

// ── Value Filter Section ──────────────────────────────────────────────

const VALUE_OPERATORS: ValueOperator[] = ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'between'];

function ValueFilterSection({ value, onChange, onClear }: {
  value: ValueFilter | null | undefined;
  onChange: (vf: ValueFilter) => void;
  onClear: () => void;
}) {
  const current: ValueFilter = value || { operator: 'greater_than', value: 0 };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <select
        value={current.operator}
        onChange={e => onChange({ ...current, operator: e.target.value as ValueOperator })}
        style={{ ...miniSelect, width: '150px', flexShrink: 0 }}
      >
        {VALUE_OPERATORS.map(o => <option key={o} value={o}>{VALUE_OPERATOR_LABELS[o]}</option>)}
      </select>
      <div style={{ position: 'relative', width: '120px', flexShrink: 0 }}>
        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#9CA3AF' }}>$</span>
        <input
          type="number"
          value={current.value || ''}
          onChange={e => onChange({ ...current, value: parseFloat(e.target.value) || 0 })}
          placeholder="0"
          style={{ ...miniInput, paddingLeft: '20px', width: '120px' }}
        />
      </div>
      {current.operator === 'between' && (
        <>
          <span style={{ fontSize: '12px', color: '#9CA3AF', flexShrink: 0 }}>to</span>
          <div style={{ position: 'relative', width: '120px', flexShrink: 0 }}>
            <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#9CA3AF' }}>$</span>
            <input
              type="number"
              value={current.valueTo || ''}
              onChange={e => onChange({ ...current, valueTo: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              style={{ ...miniInput, paddingLeft: '20px', width: '120px' }}
            />
          </div>
        </>
      )}
      <div style={{ flex: 1 }} />
      {value && (
        <button
          onClick={onClear}
          style={deleteBtn}
          onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <Trash2 style={{ width: '13px', height: '13px' }} />
        </button>
      )}
    </div>
  );
}

// ── Collapsible Section ───────────────────────────────────────────────

function Section({ title, icon, count, children, defaultOpen = true }: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: '1px solid #F3F4F6' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          width: '100%', padding: '10px 16px', border: 'none',
          backgroundColor: 'transparent', cursor: 'pointer',
          textAlign: 'left', transition: 'background-color 100ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <span style={{ color: '#6B7280', display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', flex: 1 }}>{title}</span>
        {(count ?? 0) > 0 && (
          <span style={{
            fontSize: '10px', fontWeight: 600, color: '#FFFFFF',
            backgroundColor: '#1B6EF3', borderRadius: '8px',
            minWidth: '18px', height: '16px', padding: '0 5px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {count}
          </span>
        )}
        <ChevronDown style={{
          width: '14px', height: '14px', color: '#9CA3AF',
          transition: 'transform 150ms',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }} />
      </button>
      {open && (
        <div style={{ padding: '0 16px 12px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main FilterBar ────────────────────────────────────────────────────

interface FilterBarProps {
  filters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  rightContent?: React.ReactNode;
}

export function FilterBar({
  filters,
  onFiltersChange,
  searchTerm,
  onSearchChange,
  rightContent,
}: FilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Build item lists for searchable selects
  const salesRepItems = useMemo(() =>
    SALES_REPS.map(r => ({ id: r.id, label: r.name }))
  , []);

  const customerItems = useMemo(() =>
    CUSTOMERS.map(c => ({ id: c.id, label: c.name }))
  , []);

  const tagItems = useMemo(() =>
    TAGS.map(t => ({ id: t, label: t }))
  , []);

  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);

  // Helpers
  const toggleStatus = (status: QuoteStatus) => {
    const arr = filters.statuses;
    const next = arr.includes(status) ? arr.filter(s => s !== status) : [...arr, status];
    onFiltersChange({ ...filters, statuses: next });
  };

  const togglePriority = (priority: Priority) => {
    const arr = filters.priorities;
    const next = arr.includes(priority) ? arr.filter(p => p !== priority) : [...arr, priority];
    onFiltersChange({ ...filters, priorities: next });
  };

  const toggleSalesRep = (id: string) => {
    const arr = filters.salesReps;
    const next = arr.includes(id) ? arr.filter(r => r !== id) : [...arr, id];
    onFiltersChange({ ...filters, salesReps: next });
  };

  const toggleCustomer = (id: string) => {
    const arr = filters.customers;
    const next = arr.includes(id) ? arr.filter(c => c !== id) : [...arr, id];
    onFiltersChange({ ...filters, customers: next });
  };

  const toggleTag = (tag: string) => {
    const arr = filters.tags;
    const next = arr.includes(tag) ? arr.filter(t => t !== tag) : [...arr, tag];
    onFiltersChange({ ...filters, tags: next });
  };

  // Date filters
  const dateFilters = filters.dateFilters || [];
  const addDateFilter = () => {
    const newRule: DateFilter = {
      id: `df-${Date.now()}`,
      field: 'createdDate',
      operator: 'after',
    };
    onFiltersChange({ ...filters, dateFilters: [...dateFilters, newRule] });
  };
  const updateDateFilter = (id: string, updated: DateFilter) => {
    onFiltersChange({ ...filters, dateFilters: dateFilters.map(r => r.id === id ? updated : r) });
  };
  const removeDateFilter = (id: string) => {
    onFiltersChange({ ...filters, dateFilters: dateFilters.filter(r => r.id !== id) });
  };

  // Text filters
  const textFilters = filters.textFilters || [];
  const addTextFilter = () => {
    const newRule: TextFilter = {
      id: `tf-${Date.now()}`,
      field: 'quoteNumber',
      operator: 'contains',
      value: '',
    };
    onFiltersChange({ ...filters, textFilters: [...textFilters, newRule] });
  };
  const updateTextFilter = (id: string, updated: TextFilter) => {
    onFiltersChange({ ...filters, textFilters: textFilters.map(r => r.id === id ? updated : r) });
  };
  const removeTextFilter = (id: string) => {
    onFiltersChange({ ...filters, textFilters: textFilters.filter(r => r.id !== id) });
  };

  // Value filter
  const setValueFilter = (vf: ValueFilter) => {
    onFiltersChange({ ...filters, valueFilter: vf });
  };
  const clearValueFilter = () => {
    onFiltersChange({ ...filters, valueFilter: null });
  };

  const resetAll = () => {
    onFiltersChange({
      ...filters,
      statuses: [],
      salesReps: [],
      customers: [],
      priorities: [],
      tags: [],
      dateRange: null,
      valueRange: null,
      dateFilters: [],
      valueFilter: null,
      textFilters: [],
    });
  };

  // Click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    // Delay so the click that opens doesn't immediately close
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [isOpen]);

  return (
    <div
      style={{ position: 'relative', zIndex: 30, backgroundColor: 'var(--card)', padding: '10px 28px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Search Input */}
        <div style={{ position: 'relative', width: '260px', flexShrink: 0 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, type, or email..."
            aria-label="Search quotes"
            className="w-full h-9 pr-3 text-[13px] border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/40"
            style={{ paddingLeft: '2.125rem' }}
          />
        </div>

        {/* Filters Button — triggers modal dialog */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none shrink-0"
          style={{
            borderColor: isOpen || activeCount > 0 ? 'hsl(var(--primary))' : undefined,
            backgroundColor: isOpen || activeCount > 0 ? '#EFF6FF' : 'white',
            color: isOpen || activeCount > 0 ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
            fontSize: '12px', fontWeight: 500,
          }}
          aria-label={`Filters${activeCount > 0 ? ` (${activeCount} active)` : ''}`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-sm" style={{ fontWeight: 500 }}>Filters</span>
          {activeCount > 0 && (
            <span className="min-w-[20px] h-[18px] rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
              style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 600 }}>{activeCount}</span>
          )}
        </button>

        {/* Right Content */}
        {rightContent && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {rightContent}
          </div>
        )}
      </div>

      {/* ── Filter Modal (SO V5 pattern — centered dialog) ── */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed top-[50%] left-[50%] z-[200] translate-x-[-50%] translate-y-[-50%] w-full max-w-[680px] max-h-[85vh] bg-card rounded-xl shadow-2xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 outline-none"
          >
            <DialogPrimitive.Title className="sr-only">Filters</DialogPrimitive.Title>

            {/* ─── Header ─── */}
            <div className="flex items-center justify-center relative px-6 h-12 border-b border-border/60 shrink-0">
              <button type="button" onClick={() => setIsOpen(false)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors cursor-pointer"
                aria-label="Close filters"
              ><X className="w-4 h-4" /></button>
              <span className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>Filters</span>
              {activeCount > 0 && (
                <span className="ml-2 min-w-[20px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                  style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 600 }}>{activeCount}</span>
              )}
            </div>

            {/* ─── Scrollable body ─── */}
            <div className="flex-1 overflow-y-auto overscroll-contain">

              {/* Status — pill chips */}
              <div className="px-6 py-4">
                <h4 className="text-[14px] text-foreground mb-0.5" style={{ fontWeight: 600 }}>Status</h4>
                <p className="text-[12px] text-muted-foreground mb-3">Filter by quote status.</p>
                <div className="flex flex-wrap gap-1.5">
                  <FilterPill label="Any" selected={filters.statuses.length === 0} onClick={() => onFiltersChange({ ...filters, statuses: [] })} />
                  {STATUSES.map(s => (
                    <FilterPill key={s} label={s} selected={filters.statuses.includes(s)} onClick={() => toggleStatus(s as QuoteStatus)} />
                  ))}
                </div>
              </div>
              <div className="border-t border-border/50 mx-6" />

              {/* Priority */}
              <div className="px-6 py-4">
                <h4 className="text-[14px] text-foreground mb-3" style={{ fontWeight: 600 }}>Priority</h4>
                <div className="flex flex-wrap gap-1.5">
                  <FilterPill label="Any" selected={filters.priorities.length === 0} onClick={() => onFiltersChange({ ...filters, priorities: [] })} />
                  {PRIORITIES.map(p => (
                    <FilterPill key={p} label={p} selected={filters.priorities.includes(p)} onClick={() => togglePriority(p)} />
                  ))}
                </div>
              </div>
              <div className="border-t border-border/50 mx-6" />

              {/* Sales Rep — searchable */}
              <div className="px-6 py-4">
                <h4 className="text-[14px] text-foreground mb-3" style={{ fontWeight: 600 }}>Sales Representative</h4>
                <SearchableMultiSelect
                  items={salesRepItems}
                  selected={filters.salesReps}
                  onToggle={toggleSalesRep}
                  placeholder="Search reps…"
                />
              </div>
              <div className="border-t border-border/50 mx-6" />

              {/* Customer — searchable */}
              <div className="px-6 py-4">
                <h4 className="text-[14px] text-foreground mb-3" style={{ fontWeight: 600 }}>Customer</h4>
                <SearchableMultiSelect
                  items={customerItems}
                  selected={filters.customers}
                  onToggle={toggleCustomer}
                  placeholder="Search customers…"
                />
              </div>
              <div className="border-t border-border/50 mx-6" />

              {/* Tags — searchable */}
              <div className="px-6 py-4">
                <h4 className="text-[14px] text-foreground mb-3" style={{ fontWeight: 600 }}>Tags</h4>
                <SearchableMultiSelect
                  items={tagItems}
                  selected={filters.tags}
                  onToggle={toggleTag}
                  placeholder="Search tags…"
                />
              </div>
              <div className="border-t border-border/50 mx-6" />

              {/* Quote Value Range */}
              <div className="px-6 py-4">
                <h4 className="text-[14px] text-foreground mb-0.5" style={{ fontWeight: 600 }}>Quote Value Range</h4>
                <p className="text-[12px] text-muted-foreground mb-3">Filter by total quote value.</p>
                <ValueFilterSection value={filters.valueFilter} onChange={setValueFilter} onClear={clearValueFilter} />
              </div>
              <div className="border-t border-border/50 mx-6" />

              {/* Date Filters */}
              <div className="px-6 py-4">
                <h4 className="text-[14px] text-foreground mb-3" style={{ fontWeight: 600 }}>Date Filters</h4>
                {dateFilters.map(rule => (
                  <DateFilterRow key={rule.id} rule={rule} onChange={(u) => updateDateFilter(rule.id, u)} onRemove={() => removeDateFilter(rule.id)} />
                ))}
                <button onClick={addDateFilter} className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border border-dashed border-border text-[12px] text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer mt-1">
                  <Plus className="w-3 h-3" /> Add date filter
                </button>
              </div>
              <div className="border-t border-border/50 mx-6" />

              {/* Text Filters */}
              <div className="px-6 py-4">
                <h4 className="text-[14px] text-foreground mb-3" style={{ fontWeight: 600 }}>Text Filters</h4>
                {textFilters.map(rule => (
                  <TextFilterRow key={rule.id} rule={rule} onChange={(u) => updateTextFilter(rule.id, u)} onRemove={() => removeTextFilter(rule.id)} />
                ))}
                <button onClick={addTextFilter} className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border border-dashed border-border text-[12px] text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer mt-1">
                  <Plus className="w-3 h-3" /> Add text filter
                </button>
              </div>
            </div>

            {/* ─── Footer ─── */}
            <div className="flex items-center justify-between px-6 h-14 border-t border-border/60 shrink-0">
              <button type="button" onClick={resetAll}
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                style={{ fontWeight: 500, border: 'none', background: 'none' }}
              >
                Reset all
              </button>
              <button type="button" onClick={() => setIsOpen(false)}
                className="h-9 px-5 rounded-lg text-[13px] text-white transition-colors cursor-pointer border-none"
                style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 500 }}
              >
                Apply Filters
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}

// ─── FilterPill (SO V5 pattern) ──────────────────────────────────────────────
function FilterPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border text-[13px] cursor-pointer transition-all select-none shrink-0 ${
        selected ? 'border-primary/30 text-primary' : 'bg-card text-foreground border-border hover:border-muted-foreground/40 hover:bg-muted/30'
      }`}
      style={{ fontWeight: selected ? 500 : 400, backgroundColor: selected ? '#EDF4FF' : undefined }}
    >
      <span>{label}</span>
    </button>
  );
}