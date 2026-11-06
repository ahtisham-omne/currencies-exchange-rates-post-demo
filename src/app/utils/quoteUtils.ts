// @ts-nocheck
import { Quote, QuoteStatus, Priority } from '@/app/types/quote';

export interface SortConfig {
  key: keyof Quote | string;
  direction: 'asc' | 'desc';
}

export function sortQuotes(quotes: Quote[], sortConfig: SortConfig | null): Quote[] {
  if (!sortConfig) return quotes;
  
  return [...quotes].sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    // Handle nested properties
    if (sortConfig.key.includes('.')) {
      const keys = sortConfig.key.split('.');
      aValue = keys.reduce((obj: any, key) => obj?.[key], a);
      bValue = keys.reduce((obj: any, key) => obj?.[key], b);
    } else if (sortConfig.key === 'deliveryLocation') {
      aValue = a.customer.location?.name || '';
      bValue = b.customer.location?.name || '';
    } else if (sortConfig.key === 'primaryPoC') {
      aValue = a.primaryPoC.name;
      bValue = b.primaryPoC.name;
    } else {
      aValue = a[sortConfig.key as keyof Quote];
      bValue = b[sortConfig.key as keyof Quote];
    }
    
    // Handle dates
    if (aValue instanceof Date && bValue instanceof Date) {
      return sortConfig.direction === 'asc' 
        ? aValue.getTime() - bValue.getTime()
        : bValue.getTime() - aValue.getTime();
    }
    
    // Handle numbers
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' 
        ? aValue - bValue
        : bValue - aValue;
    }
    
    // Handle strings
    const aStr = String(aValue || '').toLowerCase();
    const bStr = String(bValue || '').toLowerCase();
    
    if (sortConfig.direction === 'asc') {
      return aStr.localeCompare(bStr);
    } else {
      return bStr.localeCompare(aStr);
    }
  });
}

export function searchQuotes(quotes: Quote[], searchTerm: string): Quote[] {
  if (!searchTerm.trim()) return quotes;
  
  const term = searchTerm.toLowerCase();
  
  return quotes.filter(quote => 
    quote.quoteNumber.toLowerCase().includes(term) ||
    quote.customer.name.toLowerCase().includes(term) ||
    quote.customer.id.toLowerCase().includes(term) ||
    quote.primaryPoC.name.toLowerCase().includes(term) ||
    quote.primaryPoC.email.toLowerCase().includes(term) ||
    quote.salesRep.name.toLowerCase().includes(term) ||
    quote.description?.toLowerCase().includes(term) ||
    quote.tags?.some(tag => tag.toLowerCase().includes(term))
  );
}

// ── Advanced Filter Types ──────────────────────────────────────────────

export type DateFieldKey = 'createdDate' | 'requestedDate' | 'respondBy' | 'expiryDate' | 'confirmationDate' | 'lastUpdated';

export type DateOperator =
  | 'is'
  | 'before'
  | 'after'
  | 'between'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_week'
  | 'this_month'
  | 'this_quarter'
  | 'this_year'
  | 'is_empty'
  | 'is_not_empty';

export interface DateFilter {
  id: string;
  field: DateFieldKey;
  operator: DateOperator;
  value?: string;   // ISO date string
  valueTo?: string;  // ISO date string for 'between'
}

export type ValueOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal' | 'between';

export interface ValueFilter {
  operator: ValueOperator;
  value: number;
  valueTo?: number; // for 'between'
}

export type TextFieldKey = 'quoteNumber' | 'description' | 'customerName';

export type TextOperator = 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'equals' | 'not_equals' | 'is_empty' | 'is_not_empty';

export interface TextFilter {
  id: string;
  field: TextFieldKey;
  operator: TextOperator;
  value: string;
}

export const DATE_FIELD_LABELS: Record<DateFieldKey, string> = {
  createdDate: 'Created Date',
  requestedDate: 'Requested Date',
  respondBy: 'Respond By',
  expiryDate: 'Expiration Date',
  confirmationDate: 'Confirmed Date',
  lastUpdated: 'Last Updated',
};

export const DATE_OPERATOR_LABELS: Record<DateOperator, string> = {
  is: 'is exactly',
  before: 'is before',
  after: 'is after',
  between: 'is between',
  last_7_days: 'in last 7 days',
  last_30_days: 'in last 30 days',
  last_90_days: 'in last 90 days',
  this_week: 'is this week',
  this_month: 'is this month',
  this_quarter: 'is this quarter',
  this_year: 'is this year',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

export const VALUE_OPERATOR_LABELS: Record<ValueOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  greater_than: 'greater than',
  less_than: 'less than',
  greater_or_equal: '≥',
  less_or_equal: '≤',
  between: 'between',
};

export const TEXT_FIELD_LABELS: Record<TextFieldKey, string> = {
  quoteNumber: 'Quote Number',
  description: 'Description',
  customerName: 'Customer Name',
};

export const TEXT_OPERATOR_LABELS: Record<TextOperator, string> = {
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  equals: 'equals',
  not_equals: 'does not equal',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

// ── ActiveFilters (backward-compatible extension) ──────────────────────

export interface ActiveFilters {
  statuses: QuoteStatus[];
  salesReps: string[];
  customers: string[];
  priorities: Priority[];
  dateRange?: { start: Date; end: Date } | null;
  valueRange?: { min: number; max: number } | null;
  tags: string[];
  showArchived: boolean;
  // Extended advanced filters
  dateFilters?: DateFilter[];
  valueFilter?: ValueFilter | null;
  textFilters?: TextFilter[];
}

// ── Filter Logic ───────────────────────────────────────────────────────

function getDateFieldValue(quote: Quote, field: DateFieldKey): Date | undefined {
  switch (field) {
    case 'createdDate': return quote.createdDate;
    case 'requestedDate': return quote.requestedDate ?? undefined;
    case 'respondBy': return quote.respondBy ?? undefined;
    case 'expiryDate': return quote.expiryDate;
    case 'confirmationDate': return quote.confirmationDate ?? undefined;
    case 'lastUpdated': return quote.lastUpdated;
    default: return undefined;
  }
}

function getRelativeDateRange(operator: DateOperator): { start: Date; end: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  switch (operator) {
    case 'last_7_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      return { start, end: endOfDay };
    }
    case 'last_30_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      return { start, end: endOfDay };
    }
    case 'last_90_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 90);
      return { start, end: endOfDay };
    }
    case 'this_week': {
      const dayOfWeek = today.getDay();
      const start = new Date(today);
      start.setDate(start.getDate() - dayOfWeek);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'this_quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      const end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    default:
      return null;
  }
}

function matchesDateFilter(quote: Quote, df: DateFilter): boolean {
  const dateVal = getDateFieldValue(quote, df.field);

  if (df.operator === 'is_empty') return !dateVal;
  if (df.operator === 'is_not_empty') return !!dateVal;

  if (!dateVal) return false;
  const ts = dateVal.getTime();

  // Static operators
  if (df.operator === 'is' && df.value) {
    const target = new Date(df.value);
    const start = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    const end = start + 86400000 - 1;
    return ts >= start && ts <= end;
  }
  if (df.operator === 'before' && df.value) {
    return ts < new Date(df.value).getTime();
  }
  if (df.operator === 'after' && df.value) {
    const target = new Date(df.value);
    target.setHours(23, 59, 59, 999);
    return ts > target.getTime();
  }
  if (df.operator === 'between' && df.value && df.valueTo) {
    const start = new Date(df.value).getTime();
    const end = new Date(df.valueTo);
    end.setHours(23, 59, 59, 999);
    return ts >= start && ts <= end.getTime();
  }

  // Relative operators
  const range = getRelativeDateRange(df.operator);
  if (range) {
    return ts >= range.start.getTime() && ts <= range.end.getTime();
  }

  return true;
}

function matchesValueFilter(quote: Quote, vf: ValueFilter): boolean {
  const v = quote.totalValue;
  switch (vf.operator) {
    case 'equals': return v === vf.value;
    case 'not_equals': return v !== vf.value;
    case 'greater_than': return v > vf.value;
    case 'less_than': return v < vf.value;
    case 'greater_or_equal': return v >= vf.value;
    case 'less_or_equal': return v <= vf.value;
    case 'between': return v >= vf.value && v <= (vf.valueTo ?? Infinity);
    default: return true;
  }
}

function getTextFieldValue(quote: Quote, field: TextFieldKey): string {
  switch (field) {
    case 'quoteNumber': return quote.quoteNumber;
    case 'description': return quote.description || '';
    case 'customerName': return quote.customer.name;
    default: return '';
  }
}

function matchesTextFilter(quote: Quote, tf: TextFilter): boolean {
  const val = getTextFieldValue(quote, tf.field).toLowerCase();
  const search = (tf.value || '').toLowerCase();

  switch (tf.operator) {
    case 'contains': return val.includes(search);
    case 'not_contains': return !val.includes(search);
    case 'starts_with': return val.startsWith(search);
    case 'ends_with': return val.endsWith(search);
    case 'equals': return val === search;
    case 'not_equals': return val !== search;
    case 'is_empty': return val.trim() === '';
    case 'is_not_empty': return val.trim() !== '';
    default: return true;
  }
}

export function filterQuotes(quotes: Quote[], filters: ActiveFilters): Quote[] {
  return quotes.filter(quote => {
    // Status filter
    if (filters.statuses.length > 0 && !filters.statuses.includes(quote.status)) {
      return false;
    }
    
    // Sales rep filter
    if (filters.salesReps.length > 0 && !filters.salesReps.includes(quote.salesRep.id)) {
      return false;
    }
    
    // Customer filter
    if (filters.customers.length > 0 && !filters.customers.includes(quote.customer.id)) {
      return false;
    }
    
    // Priority filter
    if (filters.priorities.length > 0 && !filters.priorities.includes(quote.priority)) {
      return false;
    }
    
    // Legacy date range filter
    if (filters.dateRange) {
      const quoteDate = quote.createdDate.getTime();
      const start = filters.dateRange.start.getTime();
      const end = filters.dateRange.end.getTime();
      if (quoteDate < start || quoteDate > end) {
        return false;
      }
    }
    
    // Legacy value range filter
    if (filters.valueRange) {
      if (quote.totalValue < filters.valueRange.min || quote.totalValue > filters.valueRange.max) {
        return false;
      }
    }
    
    // Tags filter
    if (filters.tags.length > 0) {
      const quoteTags = quote.tags || [];
      const hasMatchingTag = filters.tags.some(tag => quoteTags.includes(tag));
      if (!hasMatchingTag) {
        return false;
      }
    }
    
    // Show archived filter
    if (!filters.showArchived && quote.status === 'archived') {
      return false;
    }

    // ── Advanced date filters ──
    if (filters.dateFilters && filters.dateFilters.length > 0) {
      for (const df of filters.dateFilters) {
        if (!matchesDateFilter(quote, df)) return false;
      }
    }

    // ── Advanced value filter ──
    if (filters.valueFilter) {
      if (!matchesValueFilter(quote, filters.valueFilter)) return false;
    }

    // ── Advanced text filters ──
    if (filters.textFilters && filters.textFilters.length > 0) {
      for (const tf of filters.textFilters) {
        if (!matchesTextFilter(quote, tf)) return false;
      }
    }
    
    return true;
  });
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

export function isExpiringSoon(expiryDate: Date, daysThreshold: number = 7): boolean {
  const now = new Date();
  const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilExpiry > 0 && daysUntilExpiry <= daysThreshold;
}

export function isExpired(expiryDate: Date): boolean {
  return expiryDate.getTime() < new Date().getTime();
}

/** Counts all active advanced filter dimensions */
export function countActiveFilters(filters: ActiveFilters): number {
  let count = 0;
  count += filters.statuses.length;
  count += filters.salesReps.length;
  count += filters.customers.length;
  count += filters.priorities.length;
  count += filters.tags.length;
  if (filters.dateRange) count += 1;
  if (filters.valueRange) count += 1;
  if (filters.dateFilters) count += filters.dateFilters.length;
  if (filters.valueFilter) count += 1;
  if (filters.textFilters) count += filters.textFilters.length;
  return count;
}