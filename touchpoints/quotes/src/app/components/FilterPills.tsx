import { X } from 'lucide-react';
import { ActiveFilters } from '@/app/utils/quoteUtils';
import { SALES_REPS, CUSTOMERS } from '@/app/data/mockQuotes';

interface FilterPillsProps {
  filters: ActiveFilters;
  onRemoveStatus: (status: string) => void;
  onRemoveSalesRep: (repId: string) => void;
  onRemoveCustomer: (customerId: string) => void;
  onRemovePriority: (priority: string) => void;
  onRemoveTag: (tag: string) => void;
  onClearDateRange: () => void;
  onClearValueRange: () => void;
  onClearAll: () => void;
}

export function FilterPills({ 
  filters, 
  onRemoveStatus,
  onRemoveSalesRep,
  onRemoveCustomer,
  onRemovePriority,
  onRemoveTag,
  onClearDateRange,
  onClearValueRange,
  onClearAll 
}: FilterPillsProps) {
  const hasActiveFilters = 
    filters.statuses.length > 0 ||
    filters.salesReps.length > 0 ||
    filters.customers.length > 0 ||
    filters.priorities.length > 0 ||
    filters.tags.length > 0 ||
    filters.dateRange ||
    filters.valueRange;

  if (!hasActiveFilters) return null;

  const getSalesRepName = (id: string) => {
    return SALES_REPS.find(rep => rep.id === id)?.name || id;
  };

  const getCustomerName = (id: string) => {
    return CUSTOMERS.find(cust => cust.id === id)?.name || id;
  };

  return (
    <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-[#E5E7EB]">
      <span className="text-[13px] text-[#6B7280]">Active filters:</span>
      
      {filters.statuses.map(status => (
        <FilterPill 
          key={`status-${status}`}
          label={status}
          onRemove={() => onRemoveStatus(status)}
        />
      ))}
      
      {filters.salesReps.map(repId => (
        <FilterPill 
          key={`rep-${repId}`}
          label={`Rep: ${getSalesRepName(repId)}`}
          onRemove={() => onRemoveSalesRep(repId)}
        />
      ))}
      
      {filters.customers.map(custId => (
        <FilterPill 
          key={`customer-${custId}`}
          label={`Customer: ${getCustomerName(custId)}`}
          onRemove={() => onRemoveCustomer(custId)}
        />
      ))}
      
      {filters.priorities.map(priority => (
        <FilterPill 
          key={`priority-${priority}`}
          label={`Priority: ${priority}`}
          onRemove={() => onRemovePriority(priority)}
        />
      ))}
      
      {filters.tags.map(tag => (
        <FilterPill 
          key={`tag-${tag}`}
          label={`Tag: ${tag}`}
          onRemove={() => onRemoveTag(tag)}
        />
      ))}
      
      {filters.dateRange && (
        <FilterPill 
          label="Date range"
          onRemove={onClearDateRange}
        />
      )}
      
      {filters.valueRange && (
        <FilterPill 
          label="Value range"
          onRemove={onClearValueRange}
        />
      )}
      
      <button
        onClick={onClearAll}
        className="text-[13px] text-[#1B6EF3] hover:text-[#0D5ED7] font-medium ml-2"
      >
        Clear all
      </button>
    </div>
  );
}

interface FilterPillProps {
  label: string;
  onRemove: () => void;
}

function FilterPill({ label, onRemove }: FilterPillProps) {
  return (
    <span className="inline-flex items-center gap-1 h-[26px] px-2 bg-[#E7F3FF] text-[#1B6EF3] rounded text-[13px] font-medium">
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-[#D0E7FF] rounded p-0.5 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
