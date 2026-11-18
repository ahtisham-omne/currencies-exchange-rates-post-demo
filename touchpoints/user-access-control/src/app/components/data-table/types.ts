import type { ReactNode } from "react";

/* ─── Density / view mode ─── */
export type DensityOption = "condensed" | "comfort" | "card";

export interface DensityConfig {
  key: DensityOption;
  label: string;
  description: string;
  icon: "align-justify" | "list" | "layout-grid";
}

export const DENSITY_OPTIONS: DensityConfig[] = [
  { key: "condensed", label: "Condensed", description: "Compact view", icon: "align-justify" },
  { key: "comfort", label: "Comfort", description: "Spacious view", icon: "list" },
  { key: "card", label: "Card View", description: "Grid layout", icon: "layout-grid" },
];

/* ─── Card size ────────────────────────────────────────────────────────────
 * Mirrors the Partner Management listing: while Card View is the active
 * density, the same dropdown grows a "CARD SIZE" segmented control that
 * rescales the grid. Size is remembered while you switch back and forth
 * between table densities, and resets with the rest of the table's working
 * state on unmount (same policy as density — see the note on `persistKey`). */
export type CardSize = "large" | "medium" | "small";

export const CARD_SIZES: { key: CardSize; label: string }[] = [
  { key: "large", label: "Large" },
  { key: "medium", label: "Medium" },
  { key: "small", label: "Small" },
];

/** Min track width (px) per size for the default auto-fill card grid. The
 *  grid stays auto-fill rather than a fixed column count so cards reflow to
 *  the container — this repo sizes card grids by container, not viewport. */
export const CARD_SIZE_MIN_WIDTH: Record<CardSize, number> = {
  large: 400,
  medium: 280,
  small: 208,
};

/** Body padding per size — the shared scale every listing card uses so the
 *  grid and its contents shrink together. */
export const CARD_SIZE_PADDING: Record<CardSize, string> = {
  large: "p-5",
  medium: "p-4",
  small: "p-3",
};

/** Same scale for cards that pad x and y independently (the request cards). */
export const CARD_SIZE_PADDING_XY: Record<CardSize, string> = {
  large: "px-5 py-4",
  medium: "px-4 py-3",
  small: "px-3 py-2",
};

/** Avatar / icon tile edge (px) per size, for cards that lead with one. */
export const CARD_SIZE_AVATAR: Record<CardSize, number> = {
  large: 40,
  medium: 36,
  small: 28,
};

/** Base container class shared by every listing card, with per-size padding
 *  folded in. Keeps the ~11 hand-rolled `renderCard` callbacks on one scale. */
export function cardShellClass(size: CardSize, extra?: string): string {
  return `bg-card border border-border rounded-xl ${CARD_SIZE_PADDING[size]} cursor-pointer hover:shadow-md hover:border-[#007FFF]/20 transition-all h-full${extra ? ` ${extra}` : ""}`;
}

/* ─── Render helpers passed to column renderers ─── */
export interface RenderHelpers {
  highlightText: (text: string | null | undefined) => ReactNode;
  density: Exclude<DensityOption, "card">;
  searchQuery: string;
  /** True while a bulk selection is active (one or more rows selected). Lets
   *  cells signal when a row is excluded from bulk actions (e.g. protected users). */
  selectionActive: boolean;
  /** Active card size. Only meaningful inside `renderCard`; the table
   *  densities ignore it. */
  cardSize: CardSize;
}

/* ─── Column header menu: sort + per-column filter ─────────────────────────
 * Mirrors the Partner Management column-header dropdown (Filter / Sort / Hide /
 * Freeze) and its inline column filters. Types live here so DataTable and
 * ColumnHeaderMenu can share them without a circular import. */
export type SortDirection = "asc" | "desc";
export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export type ColumnFilterType = "multiselect" | "text" | "range" | "date";

export interface ColumnFilterState {
  columnKey: string;
  type: ColumnFilterType;
  values: string[]; // multiselect
  text: string; // text contains
  min: string; // range min
  max: string; // range max
  dateFrom: string; // date from
  dateTo: string; // date to
}

/** Per-column filter config attached to a ColumnDef. Enables the "Filter" item
 *  in that column's header menu. Logic stays UAC-native: `getValue` reads the
 *  filterable value(s) off the row. */
export interface ColumnFilterConfig<T> {
  type: ColumnFilterType;
  /** Filterable value(s) for a row. multiselect → the row's value or values;
   *  text → the searchable string; range → the numeric value; date → ISO date. */
  getValue: (row: T) => string | string[] | number | null | undefined;
  /** Explicit multiselect options. Omit to derive unique values from the data. */
  options?: { value: string; label: string }[];
  /** Label formatter for derived multiselect option values. */
  formatLabel?: (value: string) => string;
  /** Chip / menu-heading label when the column's `label` is a ReactNode. */
  filterLabel?: string;
}

/* ─── Column definition ─── */
export interface ColumnDef<T> {
  key: string;
  label: string | ReactNode;
  width: number;
  /** In `fixedLayout` tables, let this column grow to absorb extra viewport
   *  width (instead of the trailing spacer); `width` becomes its minimum.
   *  Manually resizing the column reverts it to fixed-width. Only the first
   *  visible flexible column flexes; ignored when the column is frozen. */
  flexible?: boolean;
  /** If true, this column is sticky-left (rendered right after the checkbox column). Only the first column should use this. */
  stickyLeft?: boolean;
  /** If true, this column is hidden when the table is in comfort density (e.g. duplicate of subtitle in name cell). */
  hideInComfort?: boolean;
  /** Cell renderer. Receives the row and helpers (highlightText + density). */
  render: (row: T, helpers: RenderHelpers) => ReactNode;
  /** Enable click-to-sort (Sort ascending / descending) in the header menu. */
  sortable?: boolean;
  /** Right-align the header + cells (numeric columns). */
  align?: "left" | "right";
  /** Per-column filter config; enables the "Filter" item in the header menu. */
  filter?: ColumnFilterConfig<T>;
  /** Value used for click-sort. Defaults to `filter.getValue` when omitted. */
  sortValue?: (row: T) => string | number | null | undefined;
}

/* ─── Advanced filters panel (opened from the toolbar Filters button) ────────
 * Config-driven port of the Partner Management "Filters" modal. Each section is
 * a group of multi-select values keyed by `key`; the table's `predicate`
 * decides how those values filter rows (UAC-native logic). */
export type AdvancedFilterSectionKind = "segmented" | "pills" | "pillsExpandable" | "searchable";

export interface AdvancedFilterOption {
  value: string;
  label: string;
  prefix?: string;
}

export interface AdvancedFilterSection {
  key: string;
  title: string;
  subtitle?: string;
  kind: AdvancedFilterSectionKind;
  options: AdvancedFilterOption[];
  /** Count badge per option (usually computed from the full dataset). */
  getCount?: (value: string) => number;
  /** Search placeholder for the `searchable` kind. */
  placeholder?: string;
  /** "Show all N" threshold for the `pillsExpandable` kind (default 8). */
  threshold?: number;
}

/** Section key → selected values. Empty / missing = "Any". */
export type AdvancedFilterValues = Record<string, string[]>;

export interface AdvancedFilterConfig<T> {
  sections: AdvancedFilterSection[];
  /** True if the row passes the current advanced-filter selection. */
  predicate: (row: T, values: AdvancedFilterValues) => boolean;
}

/* ─── Quick filter definition ─── */
export interface QuickFilterDef {
  key: string;
  label: string;
  showCount: boolean;
  /** Optional group identifier. Filters in the same group use OR logic; across groups use AND. A divider is rendered between groups. */
  group?: string;
  /** Optional visual variant. `"danger"` paints the chip with a red theme
   *  and renders an Archive icon, used for the Archived filter across
   *  every list table. Default chips stay blue. */
  variant?: "danger";
}

/* ─── DataTable props ─── */
export interface DataTableProps<T> {
  /** Full unfiltered dataset */
  data: T[];
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Unique row identifier */
  getRowId: (row: T) => number | string;

  /* ── Search ── */
  searchPlaceholder?: string;
  /** Return true if row matches the search query */
  searchPredicate: (row: T, query: string) => boolean;

  /* ── Quick filters ── */
  quickFilters?: QuickFilterDef[];
  /** Return true if row passes the given filter key. Not called for "all". */
  filterPredicate?: (row: T, filterKey: string) => boolean;
  /** Show the "Me mode" toggle pill */
  showMeMode?: boolean;
  /** When provided, Me Mode becomes interactive: rows are kept only when this
   *  returns true. Without a predicate the chip stays disabled-looking. */
  meModePredicate?: (row: T) => boolean;
  /** Optional hover tooltip text for the Me Mode pill (e.g. explains what
   *  "yours" means for this listing). */
  meModeTooltip?: ReactNode;

  /* ── Empty state ── */
  emptyIcon?: ReactNode;
  emptyMessage?: string;
  /** Shown when a quick filter is active but yields no results */
  emptyFilterMessage?: string | ((filterLabel: string) => string);
  /** Shown when a search query yields no results */
  emptySearchMessage?: string;
  /** Primary CTA rendered inside the empty state when the table is empty and
   *  no filter or search is what emptied it, e.g. "Add Users" on a role with
   *  no members. Takes the slot the Clear All Filters link would otherwise
   *  occupy. */
  emptyAction?: ReactNode;

  /* ── Actions column ── */
  renderActions?: (row: T) => ReactNode;
  /** Override the sticky Actions column width (px). Defaults to 72. */
  actionsColWidth?: number;

  /* ── Card view renderer ── */
  renderCard?: (
    row: T,
    helpers: RenderHelpers
  ) => ReactNode;

  /* ── Label for the count display (e.g. "users", "roles") ── */
  entityLabel?: string;

  /* ── Row click handler ── */
  onRowClick?: (row: T) => void;

  /* ── Controlled selection (optional) ── */
  /** When provided, the table uses these IDs as the selection source of truth. */
  selectedIds?: (number | string)[];
  /** Called when selection changes (only used with controlled mode). */
  onSelectedIdsChange?: (ids: (number | string)[]) => void;

  /* ── Toolbar visibility toggles (optional) ── */
  /** Hide the density (condensed/comfort/card) dropdown */
  hideDensity?: boolean;
  /** Hide the column selector button */
  hideColumnSelector?: boolean;
  /** Hide the Filters button next to search */
  hideFilters?: boolean;
  /** Hide the pagination footer entirely (useful when the table is embedded
   *  in a slim modal where pagination chrome adds visual noise). */
  hidePagination?: boolean;
  /** Use CSS `table-layout: fixed` so column widths are authoritative and long
   *  cell content truncates instead of one column absorbing all slack. A
   *  flexible trailing spacer soaks up any extra width so data columns keep
   *  their exact `width`. Opt-in; other tables keep the default auto layout. */
  fixedLayout?: boolean;
  /** Optional content rendered inline after the search input (e.g. segmented tabs) */
  leadingToolbarSlot?: ReactNode;

  /** Default density mode (defaults to "condensed") */
  defaultDensity?: DensityOption;

  /** Initial card size for card view (defaults to "medium"). */
  defaultCardSize?: CardSize;

  /** Initial active filter keys (uncontrolled). Empty/undefined = "All". */
  defaultActiveFilters?: string[];

  /** When provided, the table's filtering state is persisted to localStorage
   *  under this key and restored on next mount. That means all three controls
   *  together: the quick filter pills, the Me Mode chip, and the advanced
   *  Filters panel selection. They persist as a set on purpose, since a
   *  toolbar that restores the pills but resets the other two shows a filtered
   *  row count with no visible reason for it.
   *
   *  System-wide rule: all UAC list tables should pass a unique persistKey so
   *  admin filter choices survive across visits and sessions. Tables inside a
   *  wizard step or a picker modal are the exception, they should open
   *  unfiltered every time and so pass no key.
   *
   *  Not persisted: the search box, per-column header filters, sort, density,
   *  column visibility, and page. Those are per-visit working state. */
  persistKey?: string;

  /** Optional extra action element rendered in the toolbar (right side, after filters).
   *  Can be a static node or a render function that receives the current filtered rows. */
  toolbarAction?: ReactNode | ((filteredData: T[]) => ReactNode);

  /** Optional element rendered inline at the end of the filter pills row. */
  filterPillsAction?: ReactNode;

  /** Slot rendered before the density dropdown (e.g. Insights button) */
  insightsSlot?: ReactNode;

  /** Banner rendered flush, directly above the column header (connects to it).
   *  When present it replaces the default toolbar/table divider. */
  headerBanner?: ReactNode;

  /** Optional override for the toolbar count label ("X of Y entityLabel").
   *  Can be a static node or a render function receiving filtered/total/selected counts. */
  countOverride?:
    | ReactNode
    | ((info: { filteredCount: number; totalCount: number; selectedCount: number }) => ReactNode);

  /** Bulk actions slot: rendered in place of filter pills when rows are selected */
  bulkActionsSlot?: (selectedCount: number, selectedIds: Set<number | string>, onCancel: () => void, activeFilters: Set<string>) => ReactNode;

  /** When true, clicking a row always toggles its selection (instead of only when rows are already selected) */
  selectOnRowClick?: boolean;

  /** When true, hides the default bulk action bar that appears when rows are selected */
  hideBulkBar?: boolean;

  /** When true, removes the row-selection checkbox column entirely (no bulk selection at all) */
  hideSelection?: boolean;

  /** Optional sort function applied to filtered data before pagination. An
   *  interactive column sort (from the header menu) takes precedence over this. */
  sortFn?: (a: T, b: T) => number;

  /** Advanced filters panel config (Partner-style modal opened from the
   *  toolbar "Filters" button). When omitted, the Filters button is hidden. */
  advancedFilter?: AdvancedFilterConfig<T>;

  /** Disable the per-column header dropdown menu (Filter / Sort / Hide /
   *  Freeze). Defaults to enabled for every list table. */
  disableColumnMenu?: boolean;

  /** Optional function that returns a group key for each row. Rows with the same key are grouped together with a header. */
  rowGroupFn?: (row: T) => string;

  /** Map of group key → display label for row group headers */
  rowGroupLabels?: Record<string, string>;

  /** Optional accent background color applied to a row (and its sticky cells). Useful to highlight inactive/error rows. */
  getRowAccent?: (row: T) => string | null | undefined;

  /** Optional override for the card-view grid wrapper class. When provided, replaces the default auto-fill grid.
   *  Pass a function to react to the active card size — a plain string is size-invariant and will
   *  make the Large/Medium/Small control a no-op for that listing. */
  cardGridClassName?: string | ((size: CardSize) => string);

  /** Optional extra classes appended to the card-view's outer scroll container (the element that wraps the card grid). Useful for tinting the empty space behind the cards, e.g. `bg-slate-50`. */
  cardContainerClassName?: string;

  /** Called whenever the filtered/total row counts change. Useful for parents that need the table's live filter state (e.g. an external Export button). */
  onFilteredCountChange?: (info: { filteredCount: number; totalCount: number }) => void;

  /** Called whenever the filtered (and sorted) row set changes. Provides the actual row data for parents that need to export the visible rows. */
  onFilteredRowsChange?: (rows: T[]) => void;

  /** Imperative requests from the parent, applied whenever `seq` changes:
   *  "clearFilters" resets search, quick filters, Me mode, advanced and column
   *  filters; "selectAll" selects every exportable row the table shows. Used by
   *  the Export modal's scope actions. */
  tableCommand?: { kind: "clearFilters" | "selectAll"; seq: number };

  /** Called whenever the per-column visibility map changes. Mirrors the state the Columns selector controls. Used by external pickers (e.g. an Export column picker) that want to pre-check currently visible columns. */
  onColumnVisibilityChange?: (visibility: Record<string, boolean>) => void;

  /** Rows for which this returns true are excluded from the export-facing callbacks
   *  (`onFilteredCountChange` / `onFilteredRowsChange`) regardless of the active filter.
   *  Used to keep archived rows out of every export flow and out of the exported count,
   *  while the row still displays in the table (e.g. under the Archived pill). */
  excludeFromExport?: (row: T) => boolean;
}