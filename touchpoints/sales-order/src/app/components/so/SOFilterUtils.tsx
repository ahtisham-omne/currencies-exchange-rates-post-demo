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
  priorities: string[];
  tags: string[];
  warehouses: string[];
  dateFilters: DateFilter[];
  valueFilter: ValueFilter | null;
  textFilters: TextFilter[];
}

export const EMPTY_SO_FILTERS: SOActiveFilters = {
  statuses: [],
  salesReps: [],
  customers: [],
  priorities: [],
  tags: [],
  warehouses: [],
  dateFilters: [],
  valueFilter: null,
  textFilters: [],
};

export function countActiveSOFilters(f: SOActiveFilters): number {
  let c = 0;
  c += f.statuses.length;
  c += f.salesReps.length;
  c += f.customers.length;
  c += f.priorities.length;
  c += f.tags.length;
  c += f.warehouses.length;
  c += f.dateFilters.length;
  if (f.valueFilter) c++;
  c += f.textFilters.length;
  return c;
}

export const DATE_FIELD_LABELS: Record<DateFieldKey, string> = {
  orderDate: 'Order Date',
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
export const SO_WAREHOUSES = ['Main Warehouse', 'East Hub', 'West Depot', 'Austin DC'];
export const SO_TAGS = ['Engine Components', 'Hydraulics', 'Electrical', 'Safety Equipment', 'Fleet', 'Priority Delivery'];

export const SO_SALES_REPS = [
  { id: 'Adrian User', name: 'Adrian User' },
  { id: 'Emily Chen', name: 'Emily Chen' },
  { id: 'Marcus Taylor', name: 'Marcus Taylor' },
  { id: 'David Park', name: 'David Park' },
  { id: 'James Rodriguez', name: 'James Rodriguez' },
];

export const SO_CUSTOMERS = [
  { id: 'Metro City Fire & Rescue', name: 'Metro City Fire & Rescue' },
  { id: 'Tri-County EMS Authority', name: 'Tri-County EMS Authority' },
  { id: 'Lakewood Community Hospital', name: 'Lakewood Community Hospital' },
  { id: 'Pinecrest Volunteer Fire Dept', name: 'Pinecrest Volunteer Fire Dept' },
  { id: 'Summit Regional Medical Center', name: 'Summit Regional Medical Center' },
];
