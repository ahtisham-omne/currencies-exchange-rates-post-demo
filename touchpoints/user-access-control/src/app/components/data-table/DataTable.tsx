import { useState, useMemo, useCallback, useRef, useEffect, Fragment, type ReactNode } from "react";
import { GripVertical, X as XIcon, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Checkbox } from "../ui/checkbox";
import type {
  DataTableProps,
  DensityOption,
  CardSize,
  ColumnDef,
  ColumnFilterState,
  ColumnFilterType,
  SortConfig,
  SortDirection,
  AdvancedFilterValues,
} from "./types";
import { DataTableToolbar } from "./DataTableToolbar";
import { DataTableFilterPills } from "./DataTableFilterPills";
import { DataTablePagination } from "./DataTablePagination";
import { ColumnSelector } from "./ColumnSelector";
import { useColumnDrag } from "./useColumnDrag";
import type { DragState } from "./useColumnDrag";
import {
  ColumnHeaderMenu,
  ActiveFiltersBar,
  applyColumnFilters,
  createBlankFilter,
  isFilterActive,
} from "./ColumnHeaderMenu";
import { AdvancedFiltersModal, countAdvancedFilters } from "./AdvancedFiltersModal";
import { DataTableEmptyState } from "./DataTableEmptyState";
import { CARD_SIZE_MIN_WIDTH, CARD_SIZE_PADDING } from "./types";
import { SHOW_ME_MODE } from "../../lib/feature-flags";

const CHECKBOX_COL_WIDTH = 40;
const ACTIONS_COL_WIDTH = 72;
const MIN_COL_WIDTH = 60;

/* ─── Persisted table state ──────────────────────────────────────────────
 * A table that passes `persistKey` keeps the admin's filtering choices across
 * visits and sessions. All three filtering controls persist together, because
 * a toolbar where the quick pills come back but Me Mode and the Filters panel
 * silently reset reads as a bug: the row count is filtered by something the
 * UI is no longer showing as on.
 *
 * One localStorage entry per control per table, so the keys stay greppable and
 * a table that gains or loses a control does not disturb the others. Reads are
 * defensive: anything unparseable, or of the wrong shape, falls back to the
 * default rather than throwing on mount.
 */
const PERSIST_NS = {
  quickFilters: "dt:filters",
  meMode: "dt:memode",
  advanced: "dt:advanced",
} as const;

function readPersisted<T>(key: string | null, revive: (parsed: unknown) => T | null): T | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return revive(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writePersisted(key: string | null, value: unknown): void {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

/* Restored advanced-filter selections are pruned against the sections the
 * table is rendering right now. Without this, a saved selection naming an
 * option that no longer exists (a role that was renamed, a value that
 * went away) survives forever as an invisible filter that matches no row, and
 * the table looks empty for no stated reason. */
export function pruneAdvancedValues(
  saved: AdvancedFilterValues,
  sections: { key: string; options: { value: string }[] }[],
): AdvancedFilterValues {
  const out: AdvancedFilterValues = {};
  for (const section of sections) {
    const selected = saved[section.key];
    if (!Array.isArray(selected) || selected.length === 0) continue;
    const valid = new Set(section.options.map((o) => o.value));
    const kept = selected.filter((v) => valid.has(v));
    if (kept.length > 0) out[section.key] = kept;
  }
  return out;
}

/* ─── Density-dependent row classes ─── */
const ROW_DENSITY_CLASSES: Record<Exclude<DensityOption, "card">, string> = {
  condensed: "[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2",
  comfort: "[&>td]:py-3 [&>td]:pl-4 [&>td]:pr-3",
};

const HEADER_DENSITY_CLASSES: Record<Exclude<DensityOption, "card">, string> = {
  condensed: "[&>th]:h-8",
  comfort: "[&>th]:h-11",
};

/* ─── Floating drag preview pill ─── */
function DragPreview({
  dragState,
  previewElRef,
}: {
  dragState: DragState | null;
  previewElRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (!dragState) return null;
  return (
    <div
      ref={previewElRef}
      style={{
        position: "fixed",
        pointerEvents: "none",
        zIndex: 9999,
        left: -9999,
        top: -9999,
        display: "none",
      }}
    >
      <div
        className="flex items-center gap-1 bg-card border rounded-md shadow-lg"
        style={{
          height: 28,
          padding: "0 12px",
          borderColor: "#93C5FD",
          boxShadow: "0 4px 12px rgba(10,119,255,0.15), 0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <GripVertical className="w-3 h-3 shrink-0" style={{ color: "#007FFF" }} />
        <span
          className="text-xs whitespace-nowrap"
          style={{ fontWeight: 600, color: "#007FFF" }}
        >
          {dragState.label}
        </span>
      </div>
    </div>
  );
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchPlaceholder = "Search...",
  searchPredicate,
  quickFilters,
  filterPredicate,
  showMeMode = true,
  meModePredicate,
  meModeTooltip,
  emptyIcon,
  emptyMessage = "No results found",
  emptyFilterMessage,
  emptySearchMessage,
  emptyAction,
  renderActions,
  actionsColWidth = ACTIONS_COL_WIDTH,
  renderCard,
  entityLabel = "records",
  onRowClick,
  selectedIds,
  onSelectedIdsChange,
  hideDensity,
  hideColumnSelector,
  hideFilters,
  hidePagination,
  fixedLayout,
  toolbarAction,
  filterPillsAction,
  insightsSlot,
  headerBanner,
  leadingToolbarSlot,
  countOverride,
  defaultDensity = "condensed",
  defaultCardSize = "medium",
  defaultActiveFilters,
  persistKey,
  bulkActionsSlot,
  selectOnRowClick,
  hideBulkBar,
  hideSelection,
  sortFn,
  rowGroupFn,
  rowGroupLabels,
  getRowAccent,
  cardGridClassName,
  cardContainerClassName,
  onFilteredCountChange,
  onFilteredRowsChange,
  tableCommand,
  onColumnVisibilityChange,
  excludeFromExport,
  advancedFilter,
  disableColumnMenu,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");

  /* Storage keys. Me Mode and the advanced panel only get one when this table
   * actually has that control, so a table without a Me Mode predicate can
   * never restore an active-looking chip it cannot apply. `!!predicate` and
   * `!!advancedFilter` are stable for a given table even though the props
   * themselves are recreated each render. */
  const storageKey = persistKey ? `${PERSIST_NS.quickFilters}:${persistKey}` : null;
  const meModeStorageKey =
    SHOW_ME_MODE && persistKey && meModePredicate ? `${PERSIST_NS.meMode}:${persistKey}` : null;
  const advancedStorageKey =
    persistKey && advancedFilter ? `${PERSIST_NS.advanced}:${persistKey}` : null;

  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => {
    const saved = readPersisted<string[]>(storageKey, (p) =>
      Array.isArray(p) && p.every((v) => typeof v === "string") ? (p as string[]) : null,
    );
    return new Set(saved ?? defaultActiveFilters ?? []);
  });

  const [meModeActive, setMeModeActive] = useState<boolean>(
    () => readPersisted<boolean>(meModeStorageKey, (p) => (typeof p === "boolean" ? p : null)) ?? false,
  );

  /* Persist each control per-table whenever it changes */
  useEffect(() => {
    writePersisted(storageKey, Array.from(activeFilters));
  }, [storageKey, activeFilters]);

  useEffect(() => {
    writePersisted(meModeStorageKey, meModeActive);
  }, [meModeStorageKey, meModeActive]);

  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [internalSelected, setInternalSelected] = useState<Set<number | string>>(new Set());
  const [density, setDensity] = useState<DensityOption>(defaultDensity);
  /* Card size survives density switches (card → condensed → card returns you
     to the same size); it only resets with the rest of the working state. */
  const [cardSize, setCardSize] = useState<CardSize>(defaultCardSize);

  /* ─── Column header menu: sort, per-column filters, frozen columns ─── */
  const columnMenuEnabled = !disableColumnMenu;
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [autoOpenFilterKey, setAutoOpenFilterKey] = useState<string | null>(null);
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set());

  /* ─── Advanced filters panel (toolbar Filters button) ─── */
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedValues, setAdvancedValues] = useState<AdvancedFilterValues>(() => {
    const saved = readPersisted<AdvancedFilterValues>(advancedStorageKey, (p) =>
      p !== null && typeof p === "object" && !Array.isArray(p) ? (p as AdvancedFilterValues) : null,
    );
    if (!saved || !advancedFilter) return {};
    return pruneAdvancedValues(saved, advancedFilter.sections);
  });

  useEffect(() => {
    writePersisted(advancedStorageKey, advancedValues);
  }, [advancedStorageKey, advancedValues]);

  const advancedActiveCount = advancedFilter
    ? countAdvancedFilters(advancedFilter.sections, advancedValues)
    : 0;

  /* Per-column filter metadata (type + value accessor) and derived options. */
  const columnFilterMeta = useMemo(() => {
    const m: Record<string, { type: ColumnFilterType; getValue: (row: T) => string | string[] | number | null | undefined }> = {};
    for (const c of columns) if (c.filter) m[c.key] = { type: c.filter.type, getValue: c.filter.getValue };
    return m;
  }, [columns]);

  const colLabelText = useCallback((c: ColumnDef<T>): string => {
    if (typeof c.label === "string") return c.label;
    return c.filter?.filterLabel ?? c.key;
  }, []);

  const columnLabels = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of columns) m[c.key] = colLabelText(c);
    return m;
  }, [columns, colLabelText]);

  const columnFormatLabelByKey = useMemo(() => {
    const m: Record<string, (v: string) => string> = {};
    for (const c of columns) if (c.filter?.formatLabel) m[c.key] = c.filter.formatLabel;
    return m;
  }, [columns]);

  const columnUniqueValues = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const c of columns) {
      if (c.filter?.type !== "multiselect") continue;
      if (c.filter.options) {
        out[c.key] = c.filter.options.map((o) => o.value);
        continue;
      }
      const set = new Set<string>();
      for (const row of data) {
        const v = c.filter.getValue(row);
        if (Array.isArray(v)) v.forEach((x) => x != null && x !== "" && set.add(String(x)));
        else if (v != null && v !== "") set.add(String(v));
      }
      out[c.key] = Array.from(set).sort();
    }
    return out;
  }, [columns, data]);

  const filterableColumns = useMemo(
    () => columns.filter((c) => c.filter).map((c) => ({ key: c.key, label: colLabelText(c) })),
    [columns, colLabelText],
  );

  /* ─── Controlled vs uncontrolled selection ─── */
  const isControlled = selectedIds !== undefined;
  const selectedRows = useMemo(
    () => (isControlled ? new Set(selectedIds) : internalSelected),
    [isControlled, selectedIds, internalSelected]
  );

  const setSelectedRows = useCallback(
    (updater: (prev: Set<number | string>) => Set<number | string>) => {
      if (isControlled) {
        const next = updater(new Set(selectedIds));
        onSelectedIdsChange?.(Array.from(next));
      } else {
        setInternalSelected(updater);
      }
    },
    [isControlled, selectedIds, onSelectedIdsChange]
  );

  /* ─── Identify sticky-left column (first one) ─── */
  const stickyCol = columns[0];
  const stickyColKey = stickyCol?.key ?? "";

  /* ─── Column order state (ALL columns including sticky) ─── */
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    columns.map((c) => c.key)
  );

  /* ─── Column visibility state ─── */
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.map((c) => [c.key, true]))
  );

  /* ─── Column widths state (for resize) ─── */
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((c) => [c.key, c.width]))
  );

  /* ─── Sync column order/visibility/widths when columns prop changes ─── */
  const columnKeysRef = useRef<string>(columns.map((c) => c.key).join(","));
  useEffect(() => {
    const newKeys = columns.map((c) => c.key).join(",");
    if (newKeys !== columnKeysRef.current) {
      columnKeysRef.current = newKeys;
      setColumnOrder((prev) => {
        const prevSet = new Set(prev);
        const newColKeys = columns.map((c) => c.key);
        // Keep existing order for columns that still exist, append new ones
        const kept = prev.filter((k) => newColKeys.includes(k));
        const added = newColKeys.filter((k) => !prevSet.has(k));
        return [...kept, ...added];
      });
      setColumnVisibility((prev) => {
        const next = { ...prev };
        columns.forEach((c) => {
          if (!(c.key in next)) next[c.key] = true;
        });
        return next;
      });
      setColumnWidths((prev) => {
        const next = { ...prev };
        columns.forEach((c) => {
          if (!(c.key in next)) next[c.key] = c.width;
        });
        return next;
      });
    }
  }, [columns]);

  /* ─── Column selector open state ─── */
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);

  /* Card view has no columns to manage, force the selector closed. */
  useEffect(() => {
    if (density === "card" && columnSelectorOpen) setColumnSelectorOpen(false);
  }, [density, columnSelectorOpen]);

  const stickyColWidth = columnWidths[stickyColKey] ?? stickyCol?.width ?? 200;

  /* ─── Scrollable column order (excludes sticky col, respects order + visibility) ─── */
  const scrollableCols = useMemo(() => {
    const colMap = new Map(columns.slice(1).map((c) => [c.key, c]));
    // Use columnOrder but skip sticky col, filter by visibility
    const visibleKeys = columnOrder
      .filter((key) => key !== stickyColKey && colMap.has(key) && columnVisibility[key] !== false)
      .filter((key) => {
        const def = colMap.get(key)!;
        // Hide columns flagged hideInComfort when in comfort density
        if (def.hideInComfort && density === "comfort") return false;
        return true;
      });
    // Frozen scrollable columns pin to the left (keeping their relative order),
    // ahead of the unfrozen ones, mirrors the Partner Management freeze.
    const frozenKeys = visibleKeys.filter((k) => frozenColumns.has(k));
    const restKeys = visibleKeys.filter((k) => !frozenColumns.has(k));
    return [...frozenKeys, ...restKeys].map((key) => {
      const def = colMap.get(key)!;
      return { ...def, width: columnWidths[key] ?? def.width };
    });
  }, [columns, columnOrder, columnVisibility, columnWidths, stickyColKey, density, frozenColumns]);

  const checkboxColW = hideSelection ? 0 : CHECKBOX_COL_WIDTH;

  /* ─── Frozen-column sticky-left offsets ─── */
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let cum = checkboxColW + stickyColWidth;
    for (const col of scrollableCols) {
      if (frozenColumns.has(col.key)) {
        offsets[col.key] = cum;
        cum += col.width;
      }
    }
    return offsets;
  }, [scrollableCols, frozenColumns, checkboxColW, stickyColWidth]);

  const lastFrozenKey = useMemo(() => {
    let last = "";
    for (const col of scrollableCols) if (frozenColumns.has(col.key)) last = col.key;
    return last;
  }, [scrollableCols, frozenColumns]);

  /* ─── Flexible column (fixed layout only) ───
   * The first visible `flexible` column absorbs extra viewport width in place
   * of the trailing spacer; its configured width stays the minimum via the
   * table-level minWidth. Frozen columns can't flex (their sticky offsets are
   * computed from fixed widths), and a manual resize hands control back to
   * the user by making the column fixed-width again. */
  const [userResizedKeys, setUserResizedKeys] = useState<Set<string>>(new Set());
  const flexColKey = useMemo(() => {
    if (!fixedLayout) return null;
    const col = scrollableCols.find(
      (c) => c.flexible && !frozenColumns.has(c.key) && !userResizedKeys.has(c.key)
    );
    return col?.key ?? null;
  }, [fixedLayout, scrollableCols, frozenColumns, userResizedKeys]);

  /* ─── Visible column count for toolbar badge ─── */
  const visibleColumnCount = useMemo(() => {
    // count sticky col (always visible) + visible scrollable cols
    return 1 + columns.slice(1).filter((c) => {
      if (columnVisibility[c.key] === false) return false;
      if (c.hideInComfort && density === "comfort") return false;
      return true;
    }).length;
  }, [columns, columnVisibility, density]);

  /* ─── Column selector config ─── */
  const allColumnConfigs = useMemo(
    () => columns.map((c) => ({ key: c.key, label: c.label, searchText: colLabelText(c) })),
    [columns, colLabelText]
  );

  /* ─── Handle column order change from selector (full order including sticky) ─── */
  const handleSelectorOrderChange = useCallback((newOrder: string[]) => {
    setColumnOrder(newOrder);
  }, []);

  /* ─── Column drag reorder (only scrollable cols) ─── */
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const dragColumns = useMemo(
    () => scrollableCols.map((c) => ({ key: c.key, label: c.label, width: c.width })),
    [scrollableCols]
  );

  const moveColumn = useCallback((from: number, to: number) => {
    // Move within the full columnOrder array
    setColumnOrder((prev) => {
      // Get the scrollable keys in current visible order
      const scrollableKeys = prev.filter(
        (key) => key !== stickyColKey && columns.some((c) => c.key === key && key !== stickyColKey)
      );
      const visibleScrollableKeys = scrollableKeys.filter(
        (key) => columnVisibility[key] !== false
      );

      const dragKey = visibleScrollableKeys[from];
      const targetKey = visibleScrollableKeys[to];
      if (!dragKey || !targetKey) return prev;

      const next = [...prev];
      const fromFull = next.indexOf(dragKey);
      const toFull = next.indexOf(targetKey);
      if (fromFull === -1 || toFull === -1) return prev;

      next.splice(fromFull, 1);
      next.splice(toFull, 0, dragKey);
      return next;
    });
  }, [stickyColKey, columns, columnVisibility]);

  const { dragState, draggedIndex, onHeaderPointerDown, previewElRef } = useColumnDrag(
    dragColumns,
    moveColumn,
    scrollContainerRef
  );

  /* ─── Column resize ─── */
  const resizeRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const [resizingKey, setResizingKey] = useState<string | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, colKey: string) => {
      e.preventDefault();
      e.stopPropagation();
      /* Measure the rendered header so a flexible (auto-width) column starts
       * the drag from its current visual size instead of snapping back to its
       * configured width. */
      const th = scrollContainerRef.current?.querySelector<HTMLElement>(
        `th[data-drag-col="${colKey}"]`
      );
      const startWidth = th
        ? Math.round(th.getBoundingClientRect().width)
        : columnWidths[colKey] ?? 150;
      resizeRef.current = { key: colKey, startX: e.clientX, startWidth };
      setResizingKey(colKey);
      setColumnWidths((prev) =>
        prev[colKey] === startWidth ? prev : { ...prev, [colKey]: startWidth }
      );
      /* From here on the user owns this column's width, it stops flexing. */
      setUserResizedKeys((prev) => (prev.has(colKey) ? prev : new Set(prev).add(colKey)));

      const onMove = (mv: MouseEvent) => {
        if (!resizeRef.current) return;
        const delta = mv.clientX - resizeRef.current.startX;
        const newWidth = Math.max(MIN_COL_WIDTH, resizeRef.current.startWidth + delta);
        setColumnWidths((prev) => ({ ...prev, [resizeRef.current!.key]: newWidth }));
      };

      const onUp = () => {
        resizeRef.current = null;
        setResizingKey(null);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [columnWidths]
  );

  /* ─── Filter counts ─── */
  const filterCounts = useMemo(() => {
    // The "Show All" chip counts the rows the default view actually shows, which
    // excludes archived rows (the "all" predicate filters them out). Falling back
    // to data.length here would over-count by including archived rows that the
    // Show All view never displays.
    const counts: Record<string, number> = {
      all: filterPredicate
        ? data.filter((row) => filterPredicate(row, "all")).length
        : data.length,
    };
    if (quickFilters && filterPredicate) {
      for (const f of quickFilters) {
        if (f.key === "all") continue;
        counts[f.key] = data.filter((row) => filterPredicate(row, f.key)).length;
      }
    }
    return counts;
  }, [data, quickFilters, filterPredicate]);

  /* ─── Filtered + paginated data ─── */
  const filteredData = useMemo(() => {
    let result = data;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row) => searchPredicate(row, q));
    }
    // Hidden behind SHOW_ME_MODE (see lib/feature-flags.ts): with the chip
    // gone, the filter must not apply either.
    if (SHOW_ME_MODE && meModeActive && meModePredicate) {
      result = result.filter((row) => meModePredicate(row));
    }

    // When advanced filters are active, bypass the quick-filter "all" baseline
    // (which hides archived rows, etc.) so advanced selections like
    // Status = Archived can surface. Explicit quick pills still constrain.
    const advActive =
      !!advancedFilter && Object.values(advancedValues).some((a) => a && a.length > 0);

    if (activeFilters.size > 0 && filterPredicate && quickFilters) {
      // Single-select OR: any active key passes (only one will be active).
      const keys = Array.from(activeFilters);
      result = result.filter((row) => keys.some((k) => filterPredicate(row, k)));
    } else if (activeFilters.size === 0 && filterPredicate && !advActive) {
      // Default "all" behavior
      result = result.filter((row) => filterPredicate(row, "all"));
    }

    if (advActive && advancedFilter) {
      result = result.filter((row) => advancedFilter.predicate(row, advancedValues));
    }

    const activeColumnFilters = Object.values(columnFilters);
    if (activeColumnFilters.length > 0) {
      result = applyColumnFilters(result, activeColumnFilters, columnFilterMeta);
    }

    // Interactive column sort takes precedence over the static sortFn.
    if (sortConfig) {
      const col = columns.find((c) => c.key === sortConfig.key);
      const getVal = col?.sortValue ?? (col?.filter ? (r: T) => col.filter!.getValue(r) : undefined);
      if (getVal) {
        const dir = sortConfig.direction === "asc" ? 1 : -1;
        result = [...result].sort((a, b) => {
          const rawA = getVal(a);
          const rawB = getVal(b);
          const na = Array.isArray(rawA) ? rawA[0] ?? "" : rawA;
          const nb = Array.isArray(rawB) ? rawB[0] ?? "" : rawB;
          if (typeof na === "number" && typeof nb === "number") return dir * (na - nb);
          return dir * String(na ?? "").localeCompare(String(nb ?? ""), undefined, { numeric: true });
        });
      }
    } else if (sortFn) {
      result = [...result].sort(sortFn);
    }

    return result;
  }, [data, searchQuery, meModeActive, meModePredicate, activeFilters, searchPredicate, filterPredicate, quickFilters, sortFn, advancedFilter, advancedValues, columnFilters, columnFilterMeta, sortConfig, columns]);

  /* ─── Export-facing row set ───
   * Rows flagged by excludeFromExport (archived) never reach the export flow or
   * the exported count, regardless of the active filter. The table display keeps
   * using filteredData, so archived rows still show under the Archived pill; only
   * what parents export/count is trimmed here. Both the filtered set and the
   * "total" baseline drop these rows so a Show-All export still reads as "all". */
  const exportFilteredRows = useMemo(
    () => (excludeFromExport ? filteredData.filter((r) => !excludeFromExport(r)) : filteredData),
    [filteredData, excludeFromExport]
  );
  const exportTotalCount = useMemo(
    () => (excludeFromExport ? data.filter((r) => !excludeFromExport(r)).length : data.length),
    [data, excludeFromExport]
  );

  /* ─── Notify parent of filtered/total counts ─── */
  useEffect(() => {
    onFilteredCountChange?.({
      filteredCount: exportFilteredRows.length,
      totalCount: exportTotalCount,
    });
  }, [exportFilteredRows.length, exportTotalCount, onFilteredCountChange]);

  /* ─── Notify parent of filtered (and sorted) row data ─── */
  useEffect(() => {
    onFilteredRowsChange?.(exportFilteredRows);
  }, [exportFilteredRows, onFilteredRowsChange]);

  /* ─── Notify parent of column visibility changes ─── */
  useEffect(() => {
    onColumnVisibilityChange?.(columnVisibility);
  }, [columnVisibility, onColumnVisibilityChange]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / recordsPerPage));
  const paginatedData = useMemo(() => {
    // recordsPerPage = Infinity → "All" option selected; show every row on a
    // single page (the math below would produce NaN with Infinity).
    if (!Number.isFinite(recordsPerPage)) return filteredData;
    const start = (currentPage - 1) * recordsPerPage;
    return filteredData.slice(start, start + recordsPerPage);
  }, [filteredData, currentPage, recordsPerPage]);

  /* ─── Selection ─── */
  const allPageSelected =
    paginatedData.length > 0 && paginatedData.every((r) => selectedRows.has(getRowId(r)));
  const somePageSelected = paginatedData.some((r) => selectedRows.has(getRowId(r)));

  const handleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginatedData.forEach((r) => next.delete(getRowId(r)));
      } else {
        paginatedData.forEach((r) => next.add(getRowId(r)));
      }
      return next;
    });
  }, [allPageSelected, paginatedData, getRowId, setSelectedRows]);

  const handleSelectRow = useCallback((id: number | string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [setSelectedRows]);

  /* ─── Search highlight helper ─── */
  const highlightText = useCallback(
    (text: string | undefined | null): ReactNode => {
      if (!text) return <span>{"\u2013"}</span>;
      if (!searchQuery || searchQuery.trim().length === 0) return <>{text}</>;
      const query = searchQuery.trim();
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      const parts = text.split(regex);
      if (parts.length === 1) return <>{text}</>;
      return (
        <>
          {parts.map((part, i) =>
            i % 2 === 1 ? (
              <mark
                key={i}
                className="px-0.5 rounded-sm"
                style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}
              >
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </>
      );
    },
    [searchQuery]
  );

  const tableDensity = density === "card" ? "condensed" as const : density;
  const helpers = useMemo(() => ({ highlightText, density: tableDensity, searchQuery, selectionActive: selectedRows.size > 0, cardSize }), [highlightText, tableDensity, searchQuery, selectedRows, cardSize]);

  /* ─── Handlers ─── */
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const handleFilterToggle = useCallback((key: string) => {
    // Single-select: clicking "all" or the active chip clears; otherwise replace.
    setActiveFilters((prev) => {
      if (key === "all") return new Set();
      if (prev.has(key) && prev.size === 1) return new Set();
      return new Set([key]);
    });
    setCurrentPage(1);
  }, []);

  const handleClearAll = useCallback(() => {
    setSearchQuery("");
    setActiveFilters(new Set());
    setCurrentPage(1);
  }, []);

  const handleRecordsPerPageChange = useCallback((size: number) => {
    setRecordsPerPage(size);
    setCurrentPage(1);
  }, []);

  const handleColumnSelectorToggle = useCallback(() => {
    setColumnSelectorOpen((prev) => !prev);
  }, []);

  /* ─── Column header menu + advanced filter handlers ─── */
  const handleSort = useCallback((key: string, direction: SortDirection | null) => {
    setSortConfig(direction ? { key, direction } : null);
    setCurrentPage(1);
  }, []);

  const handleColumnFilterChange = useCallback((key: string, filter: ColumnFilterState) => {
    setColumnFilters((prev) => ({ ...prev, [key]: filter }));
    setCurrentPage(1);
  }, []);

  const handleAddColumnFilter = useCallback((key: string) => {
    setColumnFilters((prev) =>
      prev[key] ? prev : { ...prev, [key]: createBlankFilter(key, columnFilterMeta[key]?.type ?? "text") },
    );
  }, [columnFilterMeta]);

  const handleAddColumnFilterWithAutoOpen = useCallback((key: string) => {
    setColumnFilters((prev) =>
      prev[key] ? prev : { ...prev, [key]: createBlankFilter(key, columnFilterMeta[key]?.type ?? "text") },
    );
    setAutoOpenFilterKey(key);
  }, [columnFilterMeta]);

  const handleRemoveColumnFilter = useCallback((key: string) => {
    setColumnFilters((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setCurrentPage(1);
  }, []);

  const handleClearAllColumnFilters = useCallback(() => {
    setColumnFilters({});
    setCurrentPage(1);
  }, []);

  const handleAutoOpened = useCallback(() => setAutoOpenFilterKey(null), []);

  /* Parent requests (Export modal scope actions). Keyed on seq so the same
     request can be sent again; the first render never fires. */
  const lastCommandSeq = useRef(tableCommand?.seq ?? 0);
  useEffect(() => {
    if (!tableCommand || tableCommand.seq === lastCommandSeq.current) return;
    lastCommandSeq.current = tableCommand.seq;
    if (tableCommand.kind === "clearFilters") {
      setSearchQuery("");
      setActiveFilters(new Set());
      setMeModeActive(false);
      setAdvancedValues({});
      setColumnFilters({});
      setCurrentPage(1);
    } else {
      setSelectedRows(() => new Set(exportFilteredRows.map((r) => getRowId(r))));
    }
  }, [tableCommand, exportFilteredRows, getRowId, setSelectedRows]);

  const handleHideColumn = useCallback((key: string) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: false }));
    setSortConfig((prev) => (prev?.key === key ? null : prev));
    setColumnFilters((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFrozenColumns((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const handleFreezeColumn = useCallback((key: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleAdvancedValuesChange = useCallback((values: AdvancedFilterValues) => {
    setAdvancedValues(values);
    setCurrentPage(1);
  }, []);

  const columnFiltersList = useMemo(() => Object.values(columnFilters), [columnFilters]);

  /* ─── Compute min table width ─── */
  const minTableWidth =
    checkboxColW +
    stickyColWidth +
    scrollableCols.reduce((s, c) => s + c.width, 0) +
    (renderActions ? actionsColWidth : 0);

  const hasFiltersActive = searchQuery !== "" || activeFilters.size > 0;
  const isCardView = density === "card";
  /* A listing may override the card grid entirely. Function form gets the
     active size so the override stays responsive to Large/Medium/Small. */
  const resolvedCardGridClassName =
    typeof cardGridClassName === "function" ? cardGridClassName(cardSize) : cardGridClassName;
  const isDragging = dragState !== null;

  /* ─── Contextual empty message ─── */
  const resolvedEmptyMessage = useMemo(() => {
    if (searchQuery && emptySearchMessage) return emptySearchMessage;
    if (activeFilters.size > 0 && emptyFilterMessage) {
      const activeLabel = quickFilters?.find((f) => activeFilters.has(f.key))?.label ?? "";
      return typeof emptyFilterMessage === "function" ? emptyFilterMessage(activeLabel) : emptyFilterMessage;
    }
    return emptyMessage;
  }, [searchQuery, activeFilters, emptySearchMessage, emptyFilterMessage, emptyMessage, quickFilters]);

  /* ─── Column header content (label + sort indicator), wrapped in the header
   *  menu when the menu is enabled. `isLocked` = the sticky-left column, which
   *  can sort/filter but never hide/freeze. ─── */
  const renderColumnHeader = useCallback(
    (col: ColumnDef<T>, isLocked: boolean): ReactNode => {
      const currentColSort: SortDirection | null =
        sortConfig?.key === col.key ? sortConfig.direction : null;
      const cf = columnFilters[col.key];
      const hasFilter = !!cf && isFilterActive(cf);
      const content = (
        <span className={`inline-flex items-center gap-1 min-w-0 ${col.align === "right" ? "w-full justify-end" : ""}`}>
          <span
            className="text-[13px] truncate"
            style={{ fontWeight: 500, color: currentColSort || hasFilter ? "#007FFF" : "#334155" }}
          >
            {col.label}
          </span>
          {hasFilter && !currentColSort && (
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#007FFF" }} />
          )}
          {currentColSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "#007FFF" }} />}
          {currentColSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "#007FFF" }} />}
          {!currentColSort && !hasFilter && col.sortable && (
            <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/header:opacity-100 transition-opacity" />
          )}
        </span>
      );

      if (!columnMenuEnabled) {
        return (
          <span className="text-[13px]" style={{ fontWeight: 500, color: "#334155" }}>
            {content}
          </span>
        );
      }

      return (
        <ColumnHeaderMenu
          columnKey={col.key}
          label={colLabelText(col)}
          sortable={col.sortable}
          sortConfig={sortConfig}
          onSort={handleSort}
          onAddFilter={handleAddColumnFilter}
          onHideColumn={handleHideColumn}
          onFreezeColumn={isLocked ? undefined : handleFreezeColumn}
          isFrozen={frozenColumns.has(col.key)}
          isLocked={isLocked}
          hasActiveFilter={hasFilter}
          filter={cf ?? null}
          filterType={col.filter?.type}
          uniqueValues={columnUniqueValues[col.key]}
          formatLabel={col.filter?.formatLabel}
          onFilterChange={handleColumnFilterChange}
        >
          {content}
        </ColumnHeaderMenu>
      );
    },
    [
      sortConfig,
      columnFilters,
      columnMenuEnabled,
      colLabelText,
      handleSort,
      handleAddColumnFilter,
      handleHideColumn,
      handleFreezeColumn,
      frozenColumns,
      columnUniqueValues,
      handleColumnFilterChange,
    ],
  );

  return (
    <div className="flex flex-col h-full font-['Inter',sans-serif]">
      {/* Toolbar */}
      <DataTableToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder={searchPlaceholder}
        filteredCount={filteredData.length}
        totalCount={data.length}
        entityLabel={entityLabel}
        density={density}
        onDensityChange={setDensity}
        cardSize={cardSize}
        onCardSizeChange={setCardSize}
        columnSelectorOpen={columnSelectorOpen}
        onColumnSelectorToggle={handleColumnSelectorToggle}
        visibleColumnCount={visibleColumnCount}
        hideDensity={hideDensity}
        hideColumnSelector={hideColumnSelector}
        hideFilters={hideFilters || !advancedFilter}
        onFiltersClick={() => setAdvancedOpen(true)}
        activeFilterCount={advancedActiveCount}
        toolbarAction={typeof toolbarAction === "function" ? toolbarAction(filteredData) : toolbarAction}
        insightsSlot={insightsSlot}
        leadingToolbarSlot={leadingToolbarSlot}
        countOverride={
          typeof countOverride === "function"
            ? countOverride({
                filteredCount: filteredData.length,
                totalCount: data.length,
                selectedCount: selectedRows.size,
              })
            : countOverride
        }
      />

      {/* Filter pills / Bulk action bar crossfade */}
      <div className="relative shrink-0 overflow-hidden">
        {/* Filter pills */}
        {quickFilters && quickFilters.length > 0 && (
          <div
            className="transition-all duration-[220ms] ease-out"
            style={{
              opacity: selectedRows.size > 0 && bulkActionsSlot && !hideBulkBar ? 0 : 1,
              transform: selectedRows.size > 0 && bulkActionsSlot && !hideBulkBar ? "translateY(-8px)" : "translateY(0)",
              pointerEvents: selectedRows.size > 0 && bulkActionsSlot && !hideBulkBar ? "none" : "auto",
              position: selectedRows.size > 0 && bulkActionsSlot && !hideBulkBar ? "absolute" : "relative",
              width: "100%",
            }}
          >
            <div className="flex items-center">
              <div className="flex-1 min-w-0">
                <DataTableFilterPills
                  filters={quickFilters}
                  activeFilters={activeFilters}
                  onFilterToggle={handleFilterToggle}
                  filterCounts={filterCounts}
                  showMeMode={showMeMode}
                  meModeActive={meModeActive}
                  onMeModeToggle={meModePredicate ? () => setMeModeActive((p) => !p) : undefined}
                  meModeTooltip={meModeTooltip}
                />
              </div>
              {filterPillsAction && (
                <div className="shrink-0 pr-4 pb-3">{filterPillsAction}</div>
              )}
            </div>
          </div>
        )}

        {/* Bulk action bar */}
        {!hideBulkBar && (bulkActionsSlot ? (
          <div
            className="transition-all duration-[220ms] ease-out"
            style={{
              opacity: selectedRows.size > 0 ? 1 : 0,
              transform: selectedRows.size > 0 ? "translateY(0)" : "translateY(8px)",
              pointerEvents: selectedRows.size > 0 ? "auto" : "none",
              position: selectedRows.size > 0 ? "relative" : "absolute",
              width: "100%",
            }}
          >
            {bulkActionsSlot(selectedRows.size, selectedRows, () => setSelectedRows(() => new Set()), activeFilters)}
          </div>
        ) : (
          /* Fallback: original simple bulk toolbar when no slot provided */
          selectedRows.size > 0 && (
            <div
              className="flex items-center gap-3 px-4 py-2 shrink-0"
              style={{
                backgroundColor: "#EDF4FF",
                borderTop: "1px solid rgba(0, 127, 255, 0.12)",
                borderBottom: "1px solid rgba(0, 127, 255, 0.12)",
              }}
            >
              <span
                className="text-[13px]"
                style={{ fontWeight: 600, color: "#007FFF" }}
              >
                {selectedRows.size} selected
              </span>
              <div className="flex-1" />
              <button
                onClick={() => setSelectedRows(() => new Set())}
                className="inline-flex items-center gap-1.5 px-3 h-7 rounded-[6px] border text-[12px] transition-colors cursor-pointer"
                style={{
                  fontWeight: 500,
                  color: "#64748B",
                  borderColor: "#CBD5E1",
                  backgroundColor: "white",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#94A3B8"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#CBD5E1"; }}
              >
                <XIcon className="w-3 h-3" />
                Cancel
              </button>
            </div>
          )
        ))}</div>

      {/* Active column-filter chips (from the header-menu "Filter" action) */}
      {columnMenuEnabled && columnFiltersList.length > 0 && (
        <div className="shrink-0">
          <ActiveFiltersBar
            columnFilters={columnFiltersList}
            columnLabels={columnLabels}
            uniqueValuesByKey={columnUniqueValues}
            formatLabelByKey={columnFormatLabelByKey}
            lockedColumnKey={stickyColKey}
            onFilterChange={handleColumnFilterChange}
            onRemoveFilter={handleRemoveColumnFilter}
            onAddFilter={handleAddColumnFilterWithAutoOpen}
            onClearAll={handleClearAllColumnFilters}
            autoOpenKey={autoOpenFilterKey}
            onAutoOpened={handleAutoOpened}
            availableColumns={filterableColumns}
          />
        </div>
      )}

      {/* Divider, or a flush header banner that connects to the column header */}
      {headerBanner ? (
        <div className="shrink-0">{headerBanner}</div>
      ) : (
        <div className="border-t border-border shrink-0" />
      )}

      {/* Main content area: table + column selector side panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Table / Card area */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          {isCardView ? (
            /* ─── Card View ─── */
            <div className={`@container p-4 min-h-0 overflow-y-auto flex-1 ${cardContainerClassName ?? ""}`}>
              {paginatedData.length === 0 ? (
                <div className="h-full min-h-[280px] flex items-center justify-center">
                  <DataTableEmptyState
                    icon={emptyIcon}
                    message={resolvedEmptyMessage}
                    onClearFilters={hasFiltersActive ? handleClearAll : undefined}
                    action={emptyAction}
                  />
                </div>
              ) : (
                <div
                  className={resolvedCardGridClassName ?? "grid gap-4"}
                  style={
                    resolvedCardGridClassName
                      ? undefined
                      : { gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_SIZE_MIN_WIDTH[cardSize]}px, 1fr))` }
                  }
                >
                  {paginatedData.map((row) => {
                    const rowId = getRowId(row);
                    return (
                      <div key={rowId}>
                        {renderCard
                          ? renderCard(row, helpers)
                          : (
                              <div className={`bg-card border border-border rounded-xl ${CARD_SIZE_PADDING[cardSize]} cursor-pointer hover:shadow-md hover:border-[#007FFF]/20 transition-all`}>
                                <div className={`flex items-start justify-between ${cardSize === "small" ? "mb-2" : "mb-3"}`}>
                                  <div className="flex-1 min-w-0">
                                    {stickyCol?.render(row, helpers)}
                                  </div>
                                  {renderActions && (
                                    <div className="shrink-0 ml-2">
                                      {renderActions(row)}
                                    </div>
                                  )}
                                </div>
                                <div className={`${cardSize === "small" ? "space-y-1" : "space-y-1.5"} text-xs text-muted-foreground`}>
                                  {scrollableCols.slice(0, cardSize === "large" ? 6 : cardSize === "small" ? 3 : 4).map((col) => (
                                    <div key={col.key} className="flex justify-between items-center gap-2">
                                      <span>{col.label}</span>
                                      <span className="text-foreground truncate max-w-[60%] text-right">
                                        {col.render(row, helpers)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ─── Table View (condensed / comfort) ─── */
            /* When empty, the scroll container shrinks to its header row and
               the empty state renders below it, OUTSIDE the scroller. That is
               what keeps it centred in the visible table and still when the
               columns are scrolled sideways; inside the scroller it would
               drift with the content. */
            <div className="min-h-0 flex-1 flex flex-col">
            <div
              ref={scrollContainerRef}
              className={paginatedData.length === 0 ? "overflow-auto shrink-0" : "min-h-0 overflow-auto flex-1"}
            >
              <table
                className="w-full text-sm"
                style={{
                  minWidth: `${minTableWidth}px`,
                  ...(fixedLayout ? { tableLayout: "fixed" as const } : {}),
                  ...(isDragging ? { cursor: "grabbing" } : {}),
                }}
              >
                <thead className="sticky top-0 z-20 bg-card">
                  <tr className={`bg-muted/30 ${HEADER_DENSITY_CLASSES[density]} border-b border-border`}>
                    {/* Checkbox, sticky left */}
                    {!hideSelection && (
                      <th className="sticky left-0 z-20 bg-[#f8fafc] w-[40px] min-w-[40px] max-w-[40px] pl-2 pr-0 text-left align-middle">
                        <Checkbox
                          checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all rows"
                        />
                      </th>
                    )}

                    {/* Sticky-left column (NOT draggable) */}
                    <th
                      className="sticky z-20 bg-[#f8fafc] text-left align-middle px-4 whitespace-nowrap"
                      style={{
                        left: `${checkboxColW}px`,
                        width: `${stickyColWidth}px`,
                        minWidth: `${stickyColWidth}px`,
                        fontWeight: 500,
                        color: "#334155",
                        boxShadow:
                          "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)",
                      }}
                    >
                      {stickyCol ? renderColumnHeader(stickyCol, true) : null}
                    </th>

                    {/* Draggable scrollable columns */}
                    {scrollableCols.map((col, idx) => {
                      const isBeingDragged = draggedIndex === idx;
                      const isLastCol = idx === scrollableCols.length - 1;
                      return (
                        <DraggableHeader
                          key={col.key}
                          colKey={col.key}
                          headerContent={renderColumnHeader(col, false)}
                          width={col.width}
                          flexible={col.key === flexColKey}
                          index={idx}
                          isBeingDragged={isBeingDragged}
                          isLastCol={isLastCol}
                          isResizing={resizingKey === col.key}
                          onPointerDown={onHeaderPointerDown}
                          onResizeStart={handleResizeStart}
                          frozen={frozenColumns.has(col.key)}
                          frozenLeft={frozenOffsets[col.key]}
                          isLastFrozen={col.key === lastFrozenKey}
                        />
                      );
                    })}

                    {/* Flexible spacer, in fixed layout, absorbs any extra
                        width so data columns keep their exact widths. Skipped
                        when a flexible column absorbs that width instead. */}
                    {fixedLayout && !flexColKey && <th aria-hidden className="bg-[#f8fafc] p-0" />}

                    {/* Actions, sticky right */}
                    {renderActions && (
                      <th
                        className="sticky right-0 z-20 bg-[#f8fafc] text-left align-middle pl-2 pr-2 whitespace-nowrap"
                        style={{
                          width: `${actionsColWidth}px`,
                          minWidth: `${actionsColWidth}px`,
                          maxWidth: `${actionsColWidth}px`,
                          fontWeight: 500,
                          color: "#334155",
                          boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)",
                        }}
                      >
                        <span className="text-[13px]">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? null : (
                    (() => {
                      const totalCols = (hideSelection ? 1 : 2) + scrollableCols.length + (renderActions ? 1 : 0);
                      const renderDataRow = (row: T) => {
                        const rowId = getRowId(row);
                        const isSelected = selectedRows.has(rowId);
                        const accent = getRowAccent?.(row) ?? null;
                        const stickyBg = isSelected ? "#F0F7FF" : (accent ?? undefined);
                        return (
                          <tr
                            key={rowId}
                            className={`group group/row cursor-pointer border-b border-border transition-colors ${
                              isSelected ? "bg-[#F0F7FF]" : "hover:bg-[#F0F7FF]"
                            } ${ROW_DENSITY_CLASSES[density]}`}
                            style={!isSelected && accent ? { backgroundColor: accent } : undefined}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('[role="menuitem"], [role="menu"], [data-radix-popper-content-wrapper], button, [data-radix-collection-item]')) return;
                              if (sessionStorage.getItem("uac_open_tab")) return;
                              if (document.querySelector('[data-radix-popper-content-wrapper]')) return;
                              if (selectOnRowClick || selectedRows.size > 0) {
                                handleSelectRow(rowId);
                              } else {
                                onRowClick?.(row);
                              }
                            }}
                          >
                            {/* Checkbox, sticky left */}
                            {!hideSelection && (
                              <td
                                className="sticky left-0 z-10 bg-card group-hover:bg-[#F0F7FF] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0 align-middle"
                                style={stickyBg ? { backgroundColor: stickyBg } : undefined}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleSelectRow(rowId)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Select row"
                                />
                              </td>
                            )}

                            {/* Sticky-left column */}
                            <td
                              className="sticky z-10 bg-card group-hover:bg-[#F0F7FF] align-middle whitespace-nowrap"
                              style={{
                                left: `${checkboxColW}px`,
                                width: `${stickyColWidth}px`,
                                minWidth: `${stickyColWidth}px`,
                                boxShadow:
                                  "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)",
                                ...(stickyBg ? { backgroundColor: stickyBg } : {}),
                              }}
                            >
                              {stickyCol?.render(row, helpers)}
                            </td>

                            {/* Draggable scrollable columns */}
                            {scrollableCols.map((col, idx) => {
                              const isBeingDragged = draggedIndex === idx;
                              const isFrozenCol = frozenColumns.has(col.key);
                              return (
                                <td
                                  key={col.key}
                                  data-drag-col={col.key}
                                  className={`align-middle whitespace-nowrap ${
                                    isFrozenCol ? "sticky z-10 bg-card group-hover:bg-[#F0F7FF]" : ""
                                  }`}
                                  style={{
                                    ...(col.key === flexColKey
                                      ? { overflow: "hidden" }
                                      : {
                                          width: `${col.width}px`,
                                          minWidth: `${col.width}px`,
                                          ...(fixedLayout ? { maxWidth: `${col.width}px`, overflow: "hidden" } : {}),
                                        }),
                                    ...(isFrozenCol
                                      ? {
                                          left: `${frozenOffsets[col.key] ?? 0}px`,
                                          ...(stickyBg ? { backgroundColor: stickyBg } : {}),
                                          ...(col.key === lastFrozenKey
                                            ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" }
                                            : {}),
                                        }
                                      : {}),
                                    ...(isBeingDragged ? { backgroundColor: "#EDF4FF" } : {}),
                                  }}
                                >
                                  {col.render(row, helpers)}
                                </td>
                              );
                            })}

                            {/* Flexible spacer (matches header) */}
                            {fixedLayout && !flexColKey && <td aria-hidden className="p-0" />}

                            {/* Actions, sticky right */}
                            {renderActions && (
                              <td
                                className="sticky right-0 bg-card group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2 align-middle"
                                style={{
                                  width: `${actionsColWidth}px`,
                                  minWidth: `${actionsColWidth}px`,
                                  maxWidth: `${actionsColWidth}px`,
                                  boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)",
                                  ...(stickyBg ? { backgroundColor: stickyBg } : {}),
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {renderActions(row)}
                              </td>
                            )}
                          </tr>
                        );
                      };

                      /* ─── Group headers ─── */
                      if (rowGroupFn && rowGroupLabels) {
                        const groups: { key: string; rows: T[] }[] = [];
                        let lastGroup = "";
                        for (const row of paginatedData) {
                          const gKey = rowGroupFn(row);
                          if (gKey !== lastGroup) {
                            groups.push({ key: gKey, rows: [row] });
                            lastGroup = gKey;
                          } else {
                            groups[groups.length - 1].rows.push(row);
                          }
                        }
                        return groups.map((g, gi) => (
                          <Fragment key={g.key}>
                            {gi > 0 && (
                              <tr>
                                <td colSpan={totalCols} className="px-4 py-0">
                                  <div className="border-t border-[#E2E8F0]" />
                                </td>
                              </tr>
                            )}
                            <tr className="bg-card" style={{ borderBottom: "1px solid #E2E8F0" }}>
                              <td
                                colSpan={totalCols}
                                className="px-4 pt-3 pb-1.5 bg-card"
                                style={{ position: "relative" }}
                              >
                                <span
                                  className="text-[11px] uppercase tracking-wider sticky left-4 inline-block z-10"
                                  style={{ fontWeight: 600, color: "#94A3B8" }}
                                >
                                  {rowGroupLabels[g.key] ?? g.key}
                                </span>
                              </td>
                            </tr>
                            {g.rows.map(renderDataRow)}
                          </Fragment>
                        ));
                      }

                      return paginatedData.map(renderDataRow);
                    })()
                  )}
                </tbody>
              </table>
            </div>
            {paginatedData.length === 0 && (
              <div className="flex-1 min-h-[280px] flex items-center justify-center">
                <DataTableEmptyState
                  icon={emptyIcon}
                  message={resolvedEmptyMessage}
                  onClearFilters={hasFiltersActive ? handleClearAll : undefined}
                  action={emptyAction}
                />
              </div>
            )}
            </div>
          )}

          {/* Pagination */}
          {filteredData.length > 0 && !hidePagination && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              recordsPerPage={recordsPerPage}
              onPageChange={setCurrentPage}
              onRecordsPerPageChange={handleRecordsPerPageChange}
            />
          )}
        </div>

        {/* Column Selector Side Panel */}
        <ColumnSelector
          columns={allColumnConfigs}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          onColumnOrderChange={handleSelectorOrderChange}
          onColumnVisibilityChange={setColumnVisibility}
          lockedColumns={[stickyColKey]}
          open={columnSelectorOpen}
          onOpenChange={setColumnSelectorOpen}
        />
      </div>

      {/* Floating drag preview pill */}
      <DragPreview dragState={dragState} previewElRef={previewElRef} />

      {/* Advanced filters panel (Partner-style modal, opened from the toolbar) */}
      {advancedFilter && (
        <AdvancedFiltersModal
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          sections={advancedFilter.sections}
          values={advancedValues}
          onValuesChange={handleAdvancedValuesChange}
          filteredCount={filteredData.length}
          entityLabel={entityLabel}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   DraggableHeader: individual <th> with grip handle + resize handle
   ═══════════════════════════════════════════════════════════════════════ */

function DraggableHeader({
  colKey,
  headerContent,
  width,
  flexible,
  index,
  isBeingDragged,
  isLastCol,
  isResizing,
  onPointerDown,
  onResizeStart,
  frozen,
  frozenLeft,
  isLastFrozen,
}: {
  colKey: string;
  headerContent: React.ReactNode;
  width: number;
  /** Auto-width column that absorbs leftover table width (fixed layout). */
  flexible?: boolean;
  index: number;
  isBeingDragged: boolean;
  isLastCol: boolean;
  isResizing: boolean;
  onPointerDown: (e: React.PointerEvent, index: number) => void;
  onResizeStart: (e: React.MouseEvent, colKey: string) => void;
  frozen?: boolean;
  frozenLeft?: number;
  isLastFrozen?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <th
      data-drag-col={colKey}
      onPointerDown={(e) => onPointerDown(e, index)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`text-left align-middle whitespace-nowrap select-none bg-[#f8fafc] ${frozen ? "sticky" : ""}`}
      style={{
        ...(flexible
          ? { minWidth: `${width}px` }
          : { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }),
        position: frozen ? "sticky" : "relative",
        ...(frozen ? { left: `${frozenLeft ?? 0}px`, zIndex: 20 } : {}),
        padding: "0 16px",
        cursor: isBeingDragged ? "grabbing" : "grab",
        backgroundColor: isBeingDragged ? "#EDF4FF" : "#f8fafc",
        borderRight: isLastCol ? undefined : "1px solid rgba(0,0,0,0.04)",
        ...(frozen && isLastFrozen && !isBeingDragged
          ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" }
          : {}),
      }}
    >
      {/* Grip handle, shows on hover */}
      <div
        className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-opacity z-[1]"
        style={{
          left: 2,
          width: 14,
          height: 14,
          opacity: isHovered || isBeingDragged ? 1 : 0,
          color: "#94A3B8",
        }}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Header content (label + sort indicator, wrapped in the column menu) */}
      {headerContent}

      {/* Resize handle */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeStart(e, colKey);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 bottom-0 z-[2]"
        style={{ width: 6, cursor: "col-resize" }}
      >
        <div
          className="absolute top-2 bottom-2 transition-colors"
          style={{
            right: 2,
            width: 2,
            borderRadius: 9999,
            backgroundColor: isHovered || isResizing ? "#CBD5E1" : "transparent",
          }}
        />
      </div>
    </th>
  );
}