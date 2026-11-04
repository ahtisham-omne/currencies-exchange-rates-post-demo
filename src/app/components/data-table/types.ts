import type { ReactNode } from 'react';

export type FilterType = 'multiselect' | 'text' | 'range' | 'date';
export type DensityOption = 'condensed' | 'comfort' | 'card';
export type CardSize = 'small' | 'medium' | 'large';

/** Flat shape (matches partner module exactly). Only the fields relevant to
 *  the active `type` are populated; the rest stay at their empty defaults. */
export interface ColumnFilterState {
  columnKey: string;
  type: FilterType;
  values: string[]; // for multiselect
  text: string;     // for text
  min: string;      // for range
  max: string;      // for range
  dateFrom: string; // for date
  dateTo: string;   // for date
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface ColumnExtraSort {
  key: string;
  direction: 'asc' | 'desc';
  label: string;
}

export interface QuickFilter {
  key: string;
  label: string;
  count?: number;
  showCount?: boolean;
  tone?: 'destructive' | 'default';
}

export interface ColumnDef<T> {
  /** Stable column id used as map key, drag identifier, filter key. */
  key: string;
  /** Display label in the column header. */
  label: string;
  /** Optional plain-language help text shown on the column header (info icon). */
  tooltip?: string;
  /** Minimum width when resizing. Also serves as the initial width when defaultWidth is omitted. */
  minWidth: number;
  /** Initial width in px. Falls back to minWidth. */
  defaultWidth?: number;
  /** When true, this column absorbs any horizontal slack instead of letting
   *  all columns stretch proportionally. Use for the primary text column so
   *  numeric columns keep their natural width and don't develop odd gaps when
   *  the visible columns don't fill the container. */
  flex?: boolean;
  /** Cell horizontal alignment. Defaults to 'left'. */
  align?: 'left' | 'right';
  /** Whether the header offers an asc/desc sort action. */
  sortable?: boolean;
  /** Extra named sorts offered under asc/desc in the header menu (e.g.
   *  Due Date's "Most overdue"). Each sorts by its own key; the column
   *  header shows it as active while it's applied. */
  extraSorts?: ColumnExtraSort[];
  /** Defaults to true. */
  resizable?: boolean;
  /** Locked columns can't be hidden, reordered, or unfrozen. */
  locked?: boolean;
  /** Which side this column is frozen on. Locked columns are typically `sticky: 'left'`. */
  sticky?: 'left' | 'right';
  /** Default filter type if the consumer's getFilterType isn't enough. */
  filterType?: FilterType;
  /** Set false to drop the Filter action from the header menu — for
   *  identifier columns (invoice number, vendor invoice number) where filtering a
   *  unique-per-row value makes no sense. Defaults to true. */
  filterable?: boolean;
  /** Unique values for multiselect filter dropdowns — computed from data. */
  uniqueValues?: (rows: T[]) => string[];
  /** Optional value→display formatter (e.g. capitalise status strings). */
  formatValueLabel?: (value: string) => string;
  /** Raw value for sorting + filtering. */
  getValue: (row: T) => unknown;
  /** The text the cell prints, for the table search (hidden-column-search,
   *  10/14/26). Every column is searched, shown or not; when omitted the
   *  search reads getValue as the cell shows it (ISO dates as "Sep 12, 2026",
   *  figures as money). Give one when the cell prints something else. */
  searchText?: (row: T) => string;
  /** Set false for columns whose cell holds nothing to search (a yes/no flag,
   *  an icon). Defaults to true. */
  searchable?: boolean;
  /** Optional sort key override — useful when getValue returns a complex shape. */
  getSortValue?: (row: T) => string | number;
  /** Cell renderer. Receives row + density context + optional active
   *  search query so renderers can highlight matching substrings. */
  render: (
    row: T,
    ctx: { density: DensityOption; isSelected: boolean; searchQuery?: string }
  ) => ReactNode;
}

export interface BulkActionConfig<T = unknown> {
  key: string;
  label: string;
  count?: number;
  tone?: 'primary' | 'destructive' | 'success' | 'warning' | 'neutral';
  onClick: (selectedIds: string[], rows: T[]) => void;
  disabled?: boolean;
}
