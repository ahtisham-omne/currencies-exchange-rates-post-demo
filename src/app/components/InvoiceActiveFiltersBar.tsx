import { Filter, X } from 'lucide-react';
import {
  type ColumnFilterState,
  isInvoiceFilterActive,
} from '@/app/components/InvoiceColumnHeaderMenu';

interface InvoiceActiveFiltersBarProps {
  columnFilters: Record<string, ColumnFilterState>;
  columnLabels: Record<string, string>;
  onRemoveFilter: (columnKey: string) => void;
  onClearAll: () => void;
}

/**
 * Notion-style strip of filter chips that appears above the table whenever
 * any per-column filter is active. Each chip summarizes the filter ("Status:
 * Approved, Paid in Full") and clicking the × removes that filter only.
 * Mirrors partners' ActiveFiltersBar layout.
 */
export function InvoiceActiveFiltersBar({
  columnFilters,
  columnLabels,
  onRemoveFilter,
  onClearAll,
}: InvoiceActiveFiltersBarProps) {
  const active = Object.values(columnFilters).filter(isInvoiceFilterActive);
  if (active.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2 shrink-0 border-b border-border/40">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
        <Filter className="w-3 h-3" />
        <span style={{ fontWeight: 500 }}>Filters</span>
      </div>
      <div className="w-px h-4 bg-border shrink-0" />
      {active.map((f) => (
        <FilterChip
          key={f.columnKey}
          filter={f}
          label={columnLabels[f.columnKey] ?? f.columnKey}
          onRemove={() => onRemoveFilter(f.columnKey)}
        />
      ))}
      <button
        onClick={onClearAll}
        className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
        style={{ fontWeight: 500 }}
      >
        Clear All
      </button>
    </div>
  );
}

function FilterChip({
  filter,
  label,
  onRemove,
}: {
  filter: ColumnFilterState;
  label: string;
  onRemove: () => void;
}) {
  let summary: string;
  switch (filter.type) {
    case 'multiselect':
      summary =
        filter.values.length === 1
          ? filter.values[0]
          : `${filter.values.length} Selected`;
      break;
    case 'text':
      summary = `"${filter.text}"`;
      break;
    case 'range':
      if (filter.min && filter.max) summary = `${filter.min} – ${filter.max}`;
      else if (filter.min) summary = `≥ ${filter.min}`;
      else summary = `≤ ${filter.max}`;
      break;
    case 'date':
      if (filter.dateFrom && filter.dateTo) summary = `${filter.dateFrom} → ${filter.dateTo}`;
      else if (filter.dateFrom) summary = `From ${filter.dateFrom}`;
      else summary = `To ${filter.dateTo}`;
      break;
    default:
      summary = '';
  }

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border bg-primary/[0.04] border-primary/25 text-[11px] whitespace-nowrap shrink-0"
      style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
    >
      <span className="opacity-80">{label}:</span>
      <span>{summary}</span>
      <button
        onClick={onRemove}
        className="ml-0.5 p-0.5 rounded hover:bg-primary/10 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
