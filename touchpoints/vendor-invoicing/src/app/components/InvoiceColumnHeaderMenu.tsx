import { useState, useMemo, type ReactNode } from 'react';
import { formatMoneyText } from '@/app/components/payments/MoneyInput';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import {
  ArrowUp,
  ArrowDown,
  Filter,
  EyeOff,
  Search,
  X,
  Check,
} from 'lucide-react';
import { DatePicker } from '@/app/components/ui/date-picker';
import type { Invoice } from '@/app/data/mockInvoices';
import { highlightText } from '@/app/components/InvoiceDataTable';

export type FilterType = 'multiselect' | 'text' | 'range' | 'date';

export interface ColumnFilterState {
  columnKey: string;
  type: FilterType;
  values: string[];
  text: string;
  min: string;
  max: string;
  dateFrom: string;
  dateTo: string;
}

export type SortDirection = 'asc' | 'desc' | null;
export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

const MULTISELECT_KEYS = new Set([
  'vendor',
  'type',
  'status',
  'apAccount',
  'currency',
  'createdBy',
]);

const RANGE_KEYS = new Set(['amount']);
const DATE_KEYS = new Set(['invoiceDate', 'dueDate', 'createdDate']);

export function getInvoiceFilterType(columnKey: string): FilterType {
  if (MULTISELECT_KEYS.has(columnKey)) return 'multiselect';
  if (RANGE_KEYS.has(columnKey)) return 'range';
  if (DATE_KEYS.has(columnKey)) return 'date';
  return 'text';
}

export function createBlankInvoiceFilter(columnKey: string): ColumnFilterState {
  return {
    columnKey,
    type: getInvoiceFilterType(columnKey),
    values: [],
    text: '',
    min: '',
    max: '',
    dateFrom: '',
    dateTo: '',
  };
}

export function isInvoiceFilterActive(filter: ColumnFilterState): boolean {
  switch (filter.type) {
    case 'multiselect':
      return filter.values.length > 0;
    case 'text':
      return filter.text.trim().length > 0;
    case 'range':
      return filter.min !== '' || filter.max !== '';
    case 'date':
      return filter.dateFrom !== '' || filter.dateTo !== '';
    default:
      return false;
  }
}

function getInvoiceUniqueValues(columnKey: string, invoices: Invoice[]): string[] {
  const set = new Set<string>();
  for (const inv of invoices) {
    let v: any = (inv as any)[columnKey];
    if (v === undefined || v === null || v === '') continue;
    set.add(String(v));
  }
  return Array.from(set).sort();
}

export function applyInvoiceColumnFilters(
  invoices: Invoice[],
  filters: ColumnFilterState[],
  /** Derived columns (Invoice Status, Payment Status) have no raw field
   *  on the record: the caller resolves them through the column's
   *  getValue so the filter matches what the cell shows (10/9/26). */
  resolveValue?: (invoice: Invoice, columnKey: string) => unknown,
): Invoice[] {
  if (!filters.length) return invoices;
  return invoices.filter((inv) =>
    filters.every((f) => {
      if (!isInvoiceFilterActive(f)) return true;
      const raw: any = resolveValue ? resolveValue(inv, f.columnKey) : (inv as any)[f.columnKey];
      switch (f.type) {
        case 'multiselect':
          return f.values.includes(String(raw));
        case 'text':
          return String(raw ?? '')
            .toLowerCase()
            .includes(f.text.trim().toLowerCase());
        case 'range': {
          const num = Number(raw);
          if (Number.isNaN(num)) return false;
          if (f.min !== '' && num < Number(f.min)) return false;
          if (f.max !== '' && num > Number(f.max)) return false;
          return true;
        }
        case 'date': {
          if (!raw) return false;
          // Parse the value and the bounds with the SAME (local) convention
          // so a date-only value isn't shifted a day by UTC parsing.
          const d = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
          if (Number.isNaN(d.getTime())) return false;
          // Day-inclusive bounds (user 10/7): now that cells show a time,
          // "to Oct 5" must include every time ON Oct 5, so the upper bound
          // is end-of-day and the lower bound is start-of-day.
          if (f.dateFrom && d < new Date(`${f.dateFrom}T00:00:00`)) return false;
          if (f.dateTo && d > new Date(`${f.dateTo}T23:59:59.999`)) return false;
          return true;
        }
      }
      return true;
    })
  );
}

interface InvoiceColumnHeaderMenuProps {
  columnKey: string;
  label: string;
  sortable: boolean;
  sortConfig: SortConfig | null;
  onSort: (columnKey: string, direction: 'asc' | 'desc') => void;
  filter: ColumnFilterState | null;
  hasActiveFilter: boolean;
  onFilterChange: (columnKey: string, filter: ColumnFilterState) => void;
  onHideColumn: (columnKey: string) => void;
  isLocked?: boolean;
  invoices: Invoice[];
  children: ReactNode;
  /** When true at the moment the menu would open, swallow the open. Set by
   *  the parent right after a header drag so the click that fires on
   *  mouseup doesn't pop the menu. */
  suppressOpenRef?: React.MutableRefObject<boolean>;
}

export function InvoiceColumnHeaderMenu({
  columnKey,
  label,
  sortable,
  sortConfig,
  onSort,
  filter,
  hasActiveFilter,
  onFilterChange,
  onHideColumn,
  isLocked,
  invoices,
  children,
  suppressOpenRef,
}: InvoiceColumnHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'filter'>('menu');
  const [search, setSearch] = useState('');

  const filterType = getInvoiceFilterType(columnKey);
  const currentSort = sortConfig?.key === columnKey ? sortConfig.direction : null;

  const uniqueValues = useMemo(
    () => (filterType === 'multiselect' ? getInvoiceUniqueValues(columnKey, invoices) : []),
    [columnKey, invoices, filterType]
  );
  const filteredOptions = useMemo(() => {
    if (!search) return uniqueValues;
    const q = search.toLowerCase();
    return uniqueValues.filter((v) => v.toLowerCase().includes(q));
  }, [uniqueValues, search]);

  const workingFilter = filter ?? createBlankInvoiceFilter(columnKey);

  const updateFilter = (next: Partial<ColumnFilterState>) => {
    onFilterChange(columnKey, { ...workingFilter, ...next });
  };

  const clearFilter = () => {
    onFilterChange(columnKey, createBlankInvoiceFilter(columnKey));
  };

  const handleSort = (direction: 'asc' | 'desc') => {
    onSort(columnKey, direction);
    setOpen(false);
  };

  const handleHide = () => {
    onHideColumn(columnKey);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o && suppressOpenRef?.current) {
          // Drag just ended — swallow the synthetic click that would
          // otherwise pop the menu open.
          return;
        }
        setOpen(o);
        if (!o) {
          setView('menu');
          setSearch('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center cursor-pointer focus:outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-[240px] p-1 z-[200]"
      >
        {view === 'menu' ? (
          <div className="flex flex-col">
            {sortable && (
              <>
                <MenuItem
                  icon={<ArrowUp className="w-3.5 h-3.5" />}
                  label="Sort A → Z"
                  active={currentSort === 'asc'}
                  onClick={() => handleSort('asc')}
                />
                <MenuItem
                  icon={<ArrowDown className="w-3.5 h-3.5" />}
                  label="Sort Z → A"
                  active={currentSort === 'desc'}
                  onClick={() => handleSort('desc')}
                />
                <Divider />
              </>
            )}
            <MenuItem
              icon={<Filter className="w-3.5 h-3.5" />}
              label={hasActiveFilter ? 'Edit Filter' : 'Filter'}
              active={hasActiveFilter}
              onClick={() => setView('filter')}
            />
            {hasActiveFilter && (
              <MenuItem
                icon={<X className="w-3.5 h-3.5" />}
                label="Clear Filter"
                destructive
                onClick={() => {
                  clearFilter();
                  setOpen(false);
                }}
              />
            )}
            {!isLocked && (
              <>
                <Divider />
                <MenuItem
                  icon={<EyeOff className="w-3.5 h-3.5" />}
                  label="Hide Column"
                  onClick={handleHide}
                />
              </>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>
                Filter · {label}
              </span>
              <button
                onClick={() => setView('menu')}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Back
              </button>
            </div>

            {filterType === 'multiselect' && (
              <>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-full pl-7 pr-2 h-7 text-[12px] border border-border rounded-md outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto scrollbar-hide -mx-1">
                  {filteredOptions.length === 0 && (
                    <div className="text-center text-[11px] text-muted-foreground py-4">No values</div>
                  )}
                  {filteredOptions.map((val) => {
                    const checked = workingFilter.values.includes(val);
                    return (
                      <label
                        key={val}
                        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/40 cursor-pointer text-[12px]"
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                            checked
                              ? 'bg-primary border-primary text-white'
                              : 'border-border bg-white'
                          }`}
                        >
                          {checked && <Check className="w-2.5 h-2.5" />}
                        </span>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={checked}
                          onChange={(e) => {
                            const v = e.target.checked
                              ? [...workingFilter.values, val]
                              : workingFilter.values.filter((x) => x !== val);
                            updateFilter({ values: v });
                          }}
                        />
                        <span className="truncate" title={val}>
                          {/* Searchable, so the match highlights like every list (10/9/26). */}
                          {highlightText(val, search)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            {filterType === 'text' && (
              <input
                value={workingFilter.text}
                onChange={(e) => updateFilter({ text: e.target.value })}
                placeholder={`Search ${label}…`}
                className="w-full px-2 h-7 text-[12px] border border-border rounded-md outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                autoFocus
              />
            )}

            {filterType === 'range' && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={formatMoneyText(workingFilter.min)}
                  onChange={(e) => updateFilter({ min: e.target.value.replace(/[^\d.]/g, '') })}
                  placeholder="Min"
                  type="text"
                  inputMode="decimal"
                  className="px-2 h-7 text-[12px] border border-border rounded-md outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 "
                />
                <input
                  value={formatMoneyText(workingFilter.max)}
                  onChange={(e) => updateFilter({ max: e.target.value.replace(/[^\d.]/g, '') })}
                  placeholder="Max"
                  type="text"
                  inputMode="decimal"
                  className="px-2 h-7 text-[12px] border border-border rounded-md outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 "
                />
              </div>
            )}

            {filterType === 'date' && (
              <div className="grid grid-cols-2 gap-2">
                <DatePicker
                  value={workingFilter.dateFrom}
                  onChange={(v) => updateFilter({ dateFrom: v })}
                  placeholder="From"
                  displayFormat="MMM DD, YYYY"
                  className="h-7 px-2 rounded-md text-[12px]"
                />
                <DatePicker
                  value={workingFilter.dateTo}
                  onChange={(v) => updateFilter({ dateTo: v })}
                  placeholder="To"
                  align="end"
                  displayFormat="MMM DD, YYYY"
                  className="h-7 px-2 rounded-md text-[12px]"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-border">
              <button
                onClick={() => {
                  clearFilter();
                  setView('menu');
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-[11px] px-2.5 py-1 rounded-md text-white"
                style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 500 }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function MenuItem({
  icon,
  label,
  active,
  destructive,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted/50 transition-colors ${
        destructive ? 'text-rose-600' : active ? 'text-primary' : 'text-foreground'
      }`}
    >
      <span className={`shrink-0 ${active ? 'text-primary' : destructive ? 'text-rose-500' : 'text-muted-foreground'}`}>
        {icon}
      </span>
      <span style={{ fontWeight: active ? 500 : 400 }}>{label}</span>
    </button>
  );
}

function Divider() {
  return <div className="my-0.5 mx-1 border-t border-border/50" />;
}
