// @ts-nocheck
// SO Filter Types & Utilities — adapted from Quotes module

import type { SOStatus } from "./types";

export type DateFieldKey = 'orderDate' | 'shipByDate' | 'deliveryDate' | 'createdDate' | 'confirmationDate' | 'lastUpdated';

export type DateOperator =
  | 'is' | 'before' | 'after' | 'between'
  | 'last_7_days' | 'last_30_days' | 'last_90_days'
  | 'this_week' | 'this_month' | 'this_quarter' | 'this_year'
  | 'is_empty' | 'is_not_empty';

export interface DateFilter {
  id: string;
  field: DateFieldKey;
  operator: DateOperator;
  value?: string;
  valueTo?: string;
}

export type ValueOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal' | 'between';

export interface ValueFilter {
  operator: ValueOperator;
  value: number;
  valueTo?: number;
}

export type TextFieldKey = 'soNumber' | 'customerName' | 'quoteRef';

export type TextOperator = 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'equals' | 'not_equals' | 'is_empty' | 'is_not_empty';

export interface TextFilter {
  id: string;
  field: TextFieldKey;
  operator: TextOperator;
  value: string;
}

export interface SOActiveFilters {
  statuses: SOStatus[];
  salesReps: string[];
  customers: string[];
  pocs: string[];
  priorities: string[];
  tags: string[];
  dateFilters: DateFilter[];
  valueFilter: ValueFilter | null;
  textFilters: TextFilter[];
}

export const EMPTY_SO_FILTERS: SOActiveFilters = {
  statuses: [],
  salesReps: [],
  customers: [],
  pocs: [],
  priorities: [],
  tags: [],
  dateFilters: [],
  valueFilter: null,
  textFilters: [],
};

export function countActiveSOFilters(f: SOActiveFilters): number {
  let c = 0;
  c += f.statuses.length;
  c += f.salesReps.length;
  c += f.customers.length;
  c += f.pocs.length;
  c += f.priorities.length;
  c += f.tags.length;
  c += f.dateFilters.length;
  if (f.valueFilter) c++;
  c += f.textFilters.length;
  return c;
}

/* Pure predicate version of the advanced filters — exported so the
   listing AND the modal's footer CTA can both ask "how many SOs
   does this filter set match?" without duplicating rules. The
   listing useMemo was previously ignoring advanced filters entirely,
   so the Apply CTA in the modal was a no-op; this fixes that.

   Status / priority / sales rep / customer / poc / tags use direct
   array membership. Value applies the operator. Date filters
   compare against the per-field date on the SO. Text filters do a
   case-insensitive contains check against the named text field. */
export function soMatchesAdvancedFilters(
  so: {
    status: SOStatus;
    salesRep?: string;
    salesReps?: { name?: string }[];
    customer?: string;
    pocs?: { name?: string }[];
    priority?: string;
    tags?: string[];
    orderDate?: string;
    shipByDate?: string;
    deliveryDate?: string;
    createdDate?: string;
    confirmationDate?: string;
    lastUpdated?: string;
    soNumber?: string;
    sourceQuoteRef?: string;
    grandTotal?: number;
  },
  f: SOActiveFilters,
): boolean {
  if (f.statuses.length > 0 && !f.statuses.includes(so.status)) return false;
  if (f.priorities.length > 0 && !f.priorities.includes(so.priority || '')) return false;

  if (f.salesReps.length > 0) {
    const primary = so.salesRep || '';
    const extras = Array.isArray(so.salesReps) ? so.salesReps.map(r => r?.name || '') : [];
    const all = [primary, ...extras];
    if (!all.some(n => f.salesReps.includes(n))) return false;
  }
  if (f.customers.length > 0) {
    if (!so.customer || !f.customers.includes(so.customer)) return false;
  }
  if (f.pocs.length > 0) {
    const names = Array.isArray(so.pocs) ? so.pocs.map(p => p?.name || '') : [];
    if (!names.some(n => f.pocs.includes(n))) return false;
  }
  if (f.tags.length > 0) {
    const tags = Array.isArray(so.tags) ? so.tags : [];
    if (!tags.some(t => f.tags.includes(t))) return false;
  }

  if (f.valueFilter) {
    const v = so.grandTotal ?? 0;
    const { operator, value, valueTo } = f.valueFilter;
    const a = Number(value) || 0;
    const b = Number(valueTo) || 0;
    switch (operator) {
      case 'equals': if (v !== a) return false; break;
      case 'not_equals': if (v === a) return false; break;
      case 'greater_than': if (v <= a) return false; break;
      case 'less_than': if (v >= a) return false; break;
      case 'greater_or_equal': if (v < a) return false; break;
      case 'less_or_equal': if (v > a) return false; break;
      case 'between': {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        if (lo && v < lo) return false;
        if (hi && v > hi) return false;
        break;
      }
    }
  }

  for (const d of f.dateFilters) {
    const raw = (so as any)[d.field] as string | undefined;
    if (d.operator === 'is_empty') { if (raw) return false; continue; }
    if (d.operator === 'is_not_empty') { if (!raw) return false; continue; }
    if (!raw) return false;
    /* Mock data uses `YYYY/MM/DD` and `MM/DD/YYYY` in different
       places; normalise to a Date by replacing slashes so both
       parse predictably. */
    const date = new Date(raw.replace(/\//g, '-'));
    if (Number.isNaN(date.getTime())) return false;
    const from = d.value ? new Date(d.value) : null;
    const to = d.valueTo ? new Date(d.valueTo) : null;
    if (to) to.setHours(23, 59, 59, 999);
    if (d.operator === 'is' && from) {
      if (date.toDateString() !== from.toDateString()) return false;
    } else if (d.operator === 'before' && from) {
      if (date >= from) return false;
    } else if (d.operator === 'after' && from) {
      if (date <= from) return false;
    } else if (d.operator === 'between') {
      if (from && date < from) return false;
      if (to && date > to) return false;
    }
  }

  for (const t of f.textFilters) {
    const fieldVal = (() => {
      if (t.field === 'soNumber') return so.soNumber || '';
      if (t.field === 'customerName') return so.customer || '';
      if (t.field === 'quoteRef') return so.sourceQuoteRef || '';
      return '';
    })();
    const haystack = fieldVal.toLowerCase();
    const needle = (t.value || '').toLowerCase();
    switch (t.operator) {
      case 'contains': if (!haystack.includes(needle)) return false; break;
      case 'not_contains': if (haystack.includes(needle)) return false; break;
      case 'starts_with': if (!haystack.startsWith(needle)) return false; break;
      case 'ends_with': if (!haystack.endsWith(needle)) return false; break;
      case 'equals': if (haystack !== needle) return false; break;
      case 'not_equals': if (haystack === needle) return false; break;
      case 'is_empty': if (haystack) return false; break;
      case 'is_not_empty': if (!haystack) return false; break;
    }
  }

  return true;
}

export const DATE_FIELD_LABELS: Record<DateFieldKey, string> = {
  orderDate: 'Requested On',
  shipByDate: 'Ship By Date',
  deliveryDate: 'Delivery Date',
  createdDate: 'Created Date',
  confirmationDate: 'Confirmation Date',
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
  soNumber: 'SO Number',
  customerName: 'Customer Name',
  quoteRef: 'Quote Reference',
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

export const SO_STATUSES: SOStatus[] = ['Draft', 'Pending Review', 'Cleared', 'Partially Shipped', 'Shipped', 'Cancelled', 'Partially Cancelled'];
export const SO_PRIORITIES = ['Low', 'Standard', 'High'];
export const SO_TAGS = ['Engine Components', 'Hydraulics', 'Electrical', 'Safety Equipment', 'Fleet', 'Priority Delivery'];

export const SO_SALES_REPS = [
  { id: 'Adrian User', name: 'Adrian User' },
  { id: 'Emily Chen', name: 'Emily Chen' },
  { id: 'Marcus Taylor', name: 'Marcus Taylor' },
  { id: 'David Park', name: 'David Park' },
  { id: 'James Rodriguez', name: 'James Rodriguez' },
];

/* Canonical PoC roster — mirrors the names listed in SOList's
   `POC_NAMES` mock array so the filter options are consistent with
   what the listing renders against each row. */
export const SO_POCS = [
  { id: 'Meredith Palmer',   name: 'Meredith Palmer' },
  { id: 'Toby Flenderson',   name: 'Toby Flenderson' },
  { id: 'Robert California', name: 'Robert California' },
  { id: 'Ryan Howard',       name: 'Ryan Howard' },
  { id: 'Kevin Malone',      name: 'Kevin Malone' },
  { id: 'Pam Beesly',        name: 'Pam Beesly' },
  { id: 'Holly Flax',        name: 'Holly Flax' },
  { id: 'Creed Bratton',     name: 'Creed Bratton' },
];

export const SO_CUSTOMERS = [
  { id: 'Metro City Fire & Rescue', name: 'Metro City Fire & Rescue' },
  { id: 'Tri-County EMS Authority', name: 'Tri-County EMS Authority' },
  { id: 'Lakewood Community Hospital', name: 'Lakewood Community Hospital' },
  { id: 'Pinecrest Volunteer Fire Dept', name: 'Pinecrest Volunteer Fire Dept' },
  { id: 'Summit Regional Medical Center', name: 'Summit Regional Medical Center' },
];
