// @ts-nocheck
// SOFilterPills — Applied filter pills, cloned from Quotes FilterPills
import { X } from 'lucide-react';
import type { SOActiveFilters } from './SOFilterUtils';

interface SOFilterPillsProps {
  filters: SOActiveFilters;
  onFiltersChange: (f: SOActiveFilters) => void;
}

export function SOFilterPills({ filters, onFiltersChange }: SOFilterPillsProps) {
  const hasActive =
    filters.statuses.length > 0 ||
    filters.salesReps.length > 0 ||
    filters.customers.length > 0 ||
    filters.priorities.length > 0 ||
    filters.tags.length > 0 ||
    filters.warehouses.length > 0 ||
    (filters.dateFilters && filters.dateFilters.length > 0) ||
    filters.valueFilter ||
    (filters.textFilters && filters.textFilters.length > 0);

  if (!hasActive) return null;

  const clearAll = () => onFiltersChange({
    statuses: [], salesReps: [], customers: [], priorities: [],
    tags: [], warehouses: [], dateFilters: [], valueFilter: null, textFilters: [],
  });

  const remove = (key: keyof SOActiveFilters, val: string) => {
    const arr = filters[key] as string[];
    onFiltersChange({ ...filters, [key]: arr.filter(v => v !== val) });
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-[#E5E7EB]">
      <span className="text-[13px] text-[#6B7280]">Active filters:</span>

      {filters.statuses.map(s => <Pill key={`s-${s}`} label={s} onRemove={() => remove('statuses', s)} />)}
      {filters.salesReps.map(r => <Pill key={`r-${r}`} label={`Rep: ${r}`} onRemove={() => remove('salesReps', r)} />)}
      {filters.customers.map(c => <Pill key={`c-${c}`} label={`Customer: ${c}`} onRemove={() => remove('customers', c)} />)}
      {filters.priorities.map(p => <Pill key={`p-${p}`} label={`Priority: ${p}`} onRemove={() => remove('priorities', p)} />)}
      {filters.tags.map(t => <Pill key={`t-${t}`} label={`Tag: ${t}`} onRemove={() => remove('tags', t)} />)}
      {filters.warehouses.map(w => <Pill key={`w-${w}`} label={`Warehouse: ${w}`} onRemove={() => remove('warehouses', w)} />)}
      {filters.dateFilters?.map(df => <Pill key={df.id} label="Date filter" onRemove={() => onFiltersChange({ ...filters, dateFilters: filters.dateFilters.filter(d => d.id !== df.id) })} />)}
      {filters.valueFilter && <Pill label="Value filter" onRemove={() => onFiltersChange({ ...filters, valueFilter: null })} />}
      {filters.textFilters?.map(tf => <Pill key={tf.id} label="Text filter" onRemove={() => onFiltersChange({ ...filters, textFilters: filters.textFilters.filter(t => t.id !== tf.id) })} />)}

      <button onClick={clearAll} className="text-[13px] text-[#1B6EF3] hover:text-[#0D5ED7] font-medium ml-2">
        Clear all
      </button>
    </div>
  );
}

function Pill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-[26px] px-2 bg-[#E7F3FF] text-[#1B6EF3] rounded text-[13px] font-medium">
      {label}
      <button onClick={onRemove} className="hover:bg-[#D0E7FF] rounded p-0.5 transition-colors" aria-label={`Remove ${label} filter`}>
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
