import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  Fragment,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Button } from '@/app/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  GripVertical,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  ColumnHeaderMenu,
  isFilterActive,
} from './ColumnHeaderMenu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import type {
  ColumnDef,
  ColumnFilterState,
  DensityOption,
  SortConfig,
} from './types';
import { hiddenSearchHits, orderWithRevealed, listJoin, columnSearchText } from './tableSearch';
import {
  TableEmptyState,
  PinToViewport,
  TableSkeletonRows,
  TableStaleBanner,
  resolveTableEmptyKind,
  useTableLoadState,
  type TableEmptyStateProps,
} from '@/app/components/ui/table-empty-state';
import { findSearchSuggestion } from '@/app/utils/searchSuggestion';

/** Table Empty & Error States Standard v1.0 (11/3/26, partner parity): the
 *  facts a table hands the shared decision. The table picks the state
 *  (loading, failed, no data, no search results with Did you mean, filters
 *  hide everything, search + filters, page empty) from these plus its own
 *  rows, totalRows and searchQuery. */
export interface DataTableEmptyConfig {
  /** Lowercase nouns, e.g. { singular: 'invoice', plural: 'invoices' }. */
  entity: { singular: string; plural: string };
  /** Rows before search and filters. */
  totalCount: number;
  /** Active non-search filters: a quick pill off "All", each modal facet,
   *  each column filter, each count as one. */
  filterCount?: number;
  onClearSearch?: () => void;
  /** Removes the filters and keeps the search. */
  onClearFilters?: () => void;
  /** Runs a search; Did you mean calls it with the suggestion. */
  onSearch?: (q: string) => void;
  onCreate?: () => void;
  createLabel?: string;
  /** Overrides for the no-data / filters copy. */
  title?: string;
  description?: string;
  /** Modals and nested tabs. */
  compact?: boolean;
  /** Extra values Did you mean may suggest; the columns' printed text over
   *  optionRows is always read. */
  suggestionValues?: string[];
}

/* ─── All mode (10/29, design-system list pattern) ───
 * "All" in Records per Page hands the table every matching row; it
 * renders them in lazy batches of LAZY_BATCH, with a loading row at the
 * bottom while the next batch comes in, a "N of M loaded" footer and a
 * "Select all that match" option for bulk actions. Parents slice with
 * recordsPerPage as usual: ALL_RECORDS makes page 1 hold everything. */
export const ALL_RECORDS = Number.MAX_SAFE_INTEGER;
export const LAZY_BATCH = 1000;
const LAZY_LOAD_MS = 600;
export const isAllRecords = (n: number) => n >= ALL_RECORDS;

const CHECKBOX_COL_WIDTH = 44;

/* ─── Drag up to hide (column-drag-to-hide spec, 10/14/26) ───
 * The hide line is the top of the table's toolbar (the element marked
 * `data-col-hide-edge`): from the toolbar down a release moves, above it a
 * release hides. Measured on every mouse move, since the page can scroll
 * under a drag. A table with no marked toolbar above its header falls back
 * to a margin over the header row. */
const DRAG_OUT_MARGIN = 24;
function hideEdgeOf(th: HTMLElement): number {
  const headerTop = th.getBoundingClientRect().top;
  let el = th.parentElement;
  while (el && !el.querySelector('[data-col-hide-edge]')) el = el.parentElement;
  const toolbar = el?.querySelector('[data-col-hide-edge]');
  const top = toolbar?.getBoundingClientRect().top;
  // Only a toolbar that sits above this header counts; anything else on the
  // page (another table's toolbar) falls back to the margin.
  return top != null && top < headerTop ? top : headerTop - DRAG_OUT_MARGIN;
}
// Hide-state reds follow the drag chip's existing rose, so the chip, the
// header and the column read as one state.
const HIDE_RED = '#E11D48';
const TINT_MOVE = 'rgba(10,119,255,0.035)';
const TINT_HIDE = 'rgba(225,29,72,0.06)';
const ACTIONS_COL_WIDTH = 60;
const MIN_COL_WIDTH = 1; // unrestricted resize — caller can shrink columns freely

/** The shared decision for the Table Empty & Error States Standard, for
 *  DataTable and for card views that render their own grid. */
export function useTableStates<T>({
  config,
  pageRows,
  totalRows,
  searchQuery,
  suggestionRows,
  columns,
  onFirstPage,
}: {
  config?: DataTableEmptyConfig;
  pageRows: T[];
  totalRows: number;
  searchQuery?: string;
  suggestionRows: T[];
  columns: ColumnDef<T>[];
  onFirstPage?: () => void;
}) {
  const tableLoad = useTableLoadState();
  const loadState = config ? tableLoad.loadState : 'ready';
  const forceEmpty = !!config && tableLoad.forceEmpty;
  const emptyKind = config
    ? resolveTableEmptyKind({
        loadState,
        totalCount: forceEmpty ? 0 : config.totalCount,
        filteredCount: forceEmpty ? 0 : totalRows,
        pageCount: forceEmpty ? 0 : pageRows.length,
        searchQuery: forceEmpty ? '' : searchQuery,
        filterCount: forceEmpty ? 0 : config.filterCount ?? 0,
      })
    : null;
  const wantsSuggestion = emptyKind === 'no-results' || emptyKind === 'no-results-filtered';
  const suggestion = useMemo(() => {
    if (!wantsSuggestion || !config?.onSearch || !searchQuery?.trim()) return null;
    const values: string[] = [...(config.suggestionValues ?? [])];
    for (const row of suggestionRows) {
      for (const col of columns) {
        const t = columnSearchText(col, row);
        if (t) values.push(t);
      }
    }
    return findSearchSuggestion(searchQuery, values);
  }, [wantsSuggestion, config, searchQuery, suggestionRows, columns]);
  const emptyProps: TableEmptyStateProps | null =
    config && emptyKind
      ? {
          kind: emptyKind,
          entity: config.entity,
          searchQuery,
          suggestion,
          onApplySuggestion: config.onSearch,
          filterCount: config.filterCount ?? 0,
          onClearSearch: config.onClearSearch,
          onClearFilters: config.onClearFilters,
          onClearAll:
            config.onClearSearch || config.onClearFilters
              ? () => { config.onClearFilters?.(); config.onClearSearch?.(); }
              : undefined,
          onRetry: tableLoad.retry,
          retrying: tableLoad.retrying,
          onFirstPage,
          onCreate: config.onCreate,
          createLabel: config.createLabel,
          title: config.title,
          description: config.description,
          errorRef: tableLoad.errorRef,
          compact: config.compact,
        }
      : null;
  return { tableLoad, loadState, emptyKind, emptyProps };
}

interface DataTableProps<T> {
  /** All rows after filtering/sorting are done upstream. */
  rows: T[];
  /** UNFILTERED dataset used to compute multiselect filter options — so
   *  applying one value never removes the other options from the menu
   *  (multi-select bug, 7/16/26). Falls back to `rows` when omitted. */
  optionRows?: T[];
  columns: ColumnDef<T>[];
  /** Stable id extractor for selection + keys. */
  getRowId: (row: T) => string;

  /* Controlled state — caller owns persistence (localStorage etc.) */
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  columnOrder: string[];
  onColumnOrderChange: (next: string[]) => void;
  columnVisibility: Record<string, boolean>;
  columnFilters: Record<string, ColumnFilterState>;
  onColumnFilterChange: (columnKey: string, filter: ColumnFilterState) => void;
  onAddColumnFilter: (columnKey: string) => void;
  onHideColumn: (columnKey: string) => void;
  sortConfig: SortConfig | null;
  onSort: (columnKey: string, direction: 'asc' | 'desc' | null) => void;
  frozenColumns: Set<string>;
  onFreezeColumn: (columnKey: string) => void;
  density: DensityOption;

  /* Optional row click — typically opens detail / quick view. */
  onRowClick?: (row: T) => void;

  /** Optional grouping (Eli 9/25): when set, rows that share a group id
   *  are preceded by a full-width band naming the group. Opt-in — with no
   *  groupBy the table renders a flat list exactly as before. The caller
   *  must sort `rows` so same-group rows are already adjacent. `right`
   *  (10/5/26) rides the far-right edge of the band so a group total lands
   *  directly over the pinned Amount column below it. */
  groupBy?: (row: T) => { id: string; label: string; subtitle?: string; right?: ReactNode };

  /** Optional per-row extra classes — lets consumers give specific rows a
   *  visual accent (e.g. the pre-invoice left strip) without forking the
   *  row markup. Composes with the density + selection classes. */
  rowClassName?: (row: T) => string | undefined;

  /* Optional row-actions slot — rendered inside the sticky right Actions cell. */
  renderRowActions?: (row: T) => ReactNode;

  /* Empty-state slot — rendered inside a full-width <td> when rows is empty. */
  emptyState?: ReactNode;
  /** Table Empty & Error States Standard: when set, the table chooses its
   *  own empty, error and loading state (and ignores `emptyState`). */
  emptyConfig?: DataTableEmptyConfig;

  /* Newly-created row animation — adds .animate-row-flash class to that row. */
  newlyCreatedId?: string | null;

  /* Pagination (controlled). */
  currentPage: number;
  recordsPerPage: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onRecordsPerPageChange: (n: number) => void;

  /** Optional active search query — passed into each cell renderer's
   *  context so renderers can highlight matching substrings. */
  searchQuery?: string;
  /** Every row the search listed (after filters, before paging). A hidden
   *  column any of them matched in comes out while the search runs
   *  (hidden-column-search, 10/14/26). Falls back to `rows`. */
  searchRows?: T[];
  /** The column that names the row; brought-out columns sit straight after
   *  it. Defaults to the first shown column. */
  searchRevealAfter?: string;

  /** Hide the leading selection (checkbox) column — for read-only consumers
   *  like the invoice-detail line items. Defaults to false (column shown). */
  hideSelectionColumn?: boolean;
  /** Hide the pagination footer — for short, non-paged lists. Defaults to
   *  false (footer shown). */
  hidePagination?: boolean;
  /** How the table fills horizontal space.
   *  - 'flex' (default): the column flagged `flex` absorbs all leftover
   *    width. Great for listings with one long text column, but that
   *    column can't be resized directly (the slack cancels the drag) and
   *    resizing neighbours visibly reflows it.
   *  - 'spread': on first layout every visible column gets an equal share
   *    of the container, `flex` flags are ignored, and each resize moves
   *    ONLY the dragged column (the table scrolls if it overflows). */
  fillMode?: 'flex' | 'spread';
}

/** Generic data table shell. Ported from the partner-management module's
 *  VendorsListPage so the look, feel, and micro-interactions match exactly.
 *  Schema-agnostic — every cell renderer lives in the consumer's ColumnDef. */
export function DataTable<T>({
  rows,
  optionRows,
  columns,
  getRowId,
  selectedIds,
  onSelectionChange,
  columnOrder,
  onColumnOrderChange,
  columnVisibility,
  columnFilters,
  onColumnFilterChange,
  onAddColumnFilter,
  onHideColumn,
  sortConfig,
  onSort,
  frozenColumns,
  onFreezeColumn,
  density,
  onRowClick,
  groupBy,
  rowClassName,
  renderRowActions,
  emptyState,
  emptyConfig,
  newlyCreatedId,
  currentPage,
  recordsPerPage,
  totalRows,
  onPageChange,
  onRecordsPerPageChange,
  searchQuery,
  searchRows,
  searchRevealAfter,
  hideSelectionColumn = false,
  hidePagination = false,
  fillMode = 'flex',
}: DataTableProps<T>) {
  /* ─── Column lookup ─── */
  const colByKey = useMemo(() => {
    const m = new Map<string, ColumnDef<T>>();
    columns.forEach((c) => m.set(c.key, c));
    return m;
  }, [columns]);

  /* ─── Search reveal (hidden-column-search, 10/14/26) ───
   * A hidden column a listed row matched in comes out for this search,
   * after the naming column, and the note above the table names it. The
   * reader's own setup (columnOrder / columnVisibility) is never written:
   * clear the search and the table is exactly as they left it. Hiding a
   * brought-out column declines it for this search; any edit to the query
   * forgets the declines. */
  const hiddenHits = useMemo(
    () => hiddenSearchHits(searchRows ?? rows, columns, columnOrder, columnVisibility, searchQuery),
    [searchRows, rows, columns, columnOrder, columnVisibility, searchQuery],
  );
  const [declined, setDeclined] = useState<string[]>([]);
  useEffect(() => { setDeclined((prev) => (prev.length ? [] : prev)); }, [searchQuery]);
  const revealed = useMemo(
    () => (searchQuery?.trim() ? hiddenHits.filter((k) => !declined.includes(k)) : []),
    [searchQuery, hiddenHits, declined],
  );
  const revealAfter = useMemo(
    () => searchRevealAfter
      ?? columnOrder.find((k) => columnVisibility[k] !== false && colByKey.has(k) && colByKey.get(k)?.sticky !== 'right')
      ?? null,
    [searchRevealAfter, columnOrder, columnVisibility, colByKey],
  );
  const displayOrder = useMemo(
    () => orderWithRevealed(columnOrder, revealed, revealAfter),
    [columnOrder, revealed, revealAfter],
  );
  // A drag reorders the display; the reader's order keeps each brought-out
  // column where it was, so the search never moves their setup.
  const toReaderOrder = useCallback((display: string[]) => {
    if (!revealed.length) return display;
    const out = display.filter((k) => !revealed.includes(k));
    columnOrder.forEach((k, i) => {
      if (revealed.includes(k)) out.splice(Math.min(i, out.length), 0, k);
    });
    return out;
  }, [revealed, columnOrder]);
  // Header menu Hide and drag-to-hide both land here.
  const hideColumn = useCallback((key: string) => {
    if (revealed.includes(key)) setDeclined((prev) => [...prev, key]);
    else onHideColumn(key);
  }, [revealed, onHideColumn]);

  const visibleColumns = useMemo(
    () => {
      const visible = displayOrder.filter((k) => (columnVisibility[k] !== false || revealed.includes(k)) && colByKey.has(k));
      // Right-pinned columns (ColumnDef.sticky === 'right', wired 8/28/26
      // for the run Step 1 amount column) always render at the trailing
      // edge, whatever the stored order says.
      return [
        ...visible.filter((k) => colByKey.get(k)?.sticky !== 'right'),
        ...visible.filter((k) => colByKey.get(k)?.sticky === 'right'),
      ];
    },
    [displayOrder, columnVisibility, revealed, colByKey]
  );

  const rightPinned = useMemo(
    () => visibleColumns.filter((k) => colByKey.get(k)?.sticky === 'right'),
    [visibleColumns, colByKey]
  );

  /* ─── Column widths (internal — resize doesn't round-trip on every mousemove) ─── */
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    columns.forEach((c) => {
      m[c.key] = c.defaultWidth ?? c.minWidth;
    });
    return m;
  });

  // Backfill widths for any newly-added columns
  useEffect(() => {
    setColumnWidths((prev) => {
      let changed = false;
      const next = { ...prev };
      columns.forEach((c) => {
        if (next[c.key] == null) {
          next[c.key] = c.defaultWidth ?? c.minWidth;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [columns]);

  /* ─── Flex-column auto-fill ───
   * A column flagged `flex` stretches to consume any horizontal slack so the
   * table fills its container without leaving dead space on the right (and
   * without the proportional stretch that pulls every column apart). We
   * measure the scroll container and hand the leftover width to the flex
   * column explicitly — `table-layout: fixed` distributes `width:auto`
   * unreliably alongside sticky columns, so a computed px width is robust. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  // useLayoutEffect, not useEffect (9/2/26): the first measurement must
  // land BEFORE the browser paints, or the table flashes one frame of
  // unfilled default widths and then snaps — a visible glitch when the
  // table mounts inside a just-opened modal (the payment run flow).
  // ResizeObserver still owns every later resize.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const flexKey = useMemo(
    () => (fillMode === 'spread' ? null : visibleColumns.find((k) => colByKey.get(k)?.flex) ?? null),
    [fillMode, visibleColumns, colByKey],
  );

  /* ─── Spread fill ───
   * Equal-width fill: distribute the container across every visible column
   * once per visible-column set (and on container growth until the user
   * resizes something). After that, widths are fully manual — dragging a
   * handle moves only that column. */
  const userResizedRef = useRef(false);
  // Once the user drags a resize handle, stop stretching the flex column so the
  // dragged width is honored literally instead of being absorbed by slack
  // (Eli 7/22/26: "resizing is not working properly"). State (not the ref) so
  // flexExtra recomputes.
  const [hasManualResize, setHasManualResize] = useState(false);
  const spreadSigRef = useRef('');
  // Pre-paint for the same reason as the container measurement above:
  // the spread pass must not paint an intermediate default-width frame.
  useLayoutEffect(() => {
    if (fillMode !== 'spread' || containerWidth <= 0 || visibleColumns.length === 0) return;
    const sig = visibleColumns.join('|');
    if (sig === spreadSigRef.current && userResizedRef.current) return;
    if (sig === spreadSigRef.current) {
      // Same column set: only track container growth before any manual resize.
    }
    spreadSigRef.current = sig;
    const chrome =
      (hideSelectionColumn ? 0 : CHECKBOX_COL_WIDTH) +
      (selectedIds.size > 0 || !renderRowActions ? 0 : ACTIONS_COL_WIDTH);
    const per = Math.max(80, Math.floor((containerWidth - chrome) / visibleColumns.length));
    setColumnWidths((prev) => {
      const next = { ...prev };
      visibleColumns.forEach((k) => { next[k] = per; });
      return next;
    });
  }, [fillMode, containerWidth, visibleColumns, hideSelectionColumn, selectedIds, renderRowActions]);

  // Natural (unstretched) width — each column's resize baseline and the basis
  // for measuring how much horizontal slack the flex column should absorb.
  const naturalWidth = useCallback(
    (key: string) => columnWidths[key] ?? colByKey.get(key)?.minWidth ?? 100,
    [columnWidths, colByKey],
  );

  // Leftover container width handed to the flex column so the table fills its
  // container without dead space on the right — and without the proportional
  // stretch that pulls every column apart. Zero when there's no flex column or
  // the columns already overflow (then the table scrolls horizontally).
  const flexExtra = useMemo(() => {
    // After a manual resize, widths are honored literally (no stretch).
    if (hasManualResize) return 0;
    if (!flexKey || containerWidth <= 0) return 0;
    const natural =
      (hideSelectionColumn ? 0 : CHECKBOX_COL_WIDTH) +
      visibleColumns.reduce((sum, key) => sum + naturalWidth(key), 0) +
      (selectedIds.size > 0 || !renderRowActions ? 0 : ACTIONS_COL_WIDTH);
    return Math.max(0, containerWidth - natural);
  }, [flexKey, containerWidth, hideSelectionColumn, visibleColumns, naturalWidth, selectedIds, renderRowActions, hasManualResize]);

  // Resolved render width — the flex column absorbs any leftover width; every
  // other column keeps its natural width. Resizing stays independent because
  // the baseline (naturalWidth) is never mutated by the stretch.
  const effectiveWidth = useCallback(
    (key: string) => naturalWidth(key) + (key === flexKey ? flexExtra : 0),
    [naturalWidth, flexKey, flexExtra],
  );

  /* ─── Frozen-column left-offset map ─── */
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    // When the selection column is hidden, frozen columns start flush at 0.
    let acc = hideSelectionColumn ? 0 : CHECKBOX_COL_WIDTH;
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) {
        offsets[key] = acc;
        acc += effectiveWidth(key);
      }
    }
    return offsets;
  }, [visibleColumns, frozenColumns, effectiveWidth]);

  const lastFrozenKey = useMemo(() => {
    for (let i = visibleColumns.length - 1; i >= 0; i--) {
      if (frozenColumns.has(visibleColumns[i])) return visibleColumns[i];
    }
    return null;
  }, [visibleColumns, frozenColumns]);

  /* ─── Right-pinned offset map (mirror of frozenOffsets, from the right
   * edge; the sticky Actions column, when shown, sits outside them). ─── */
  const rightPinnedOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let acc = selectedIds.size > 0 || !renderRowActions ? 0 : ACTIONS_COL_WIDTH;
    for (let i = rightPinned.length - 1; i >= 0; i--) {
      const key = rightPinned[i];
      offsets[key] = acc;
      acc += effectiveWidth(key);
    }
    return offsets;
  }, [rightPinned, effectiveWidth, selectedIds, renderRowActions]);
  const firstRightPinnedKey = rightPinned[0] ?? null;

  /* ─── Column resize ─── */
  const resizeRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, columnKey: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = effectiveWidth(columnKey);
      // On the first manual resize, freeze the flex column's current stretched
      // width into columnWidths so it doesn't snap back when the stretch is
      // disabled, then honor widths literally from here on.
      if (!hasManualResize && flexKey) {
        const frozen = effectiveWidth(flexKey);
        setColumnWidths((prev) => ({ ...prev, [flexKey]: frozen }));
      }
      setHasManualResize(true);
      resizeRef.current = { columnKey, startX: e.clientX, startWidth };
      userResizedRef.current = true; // spread mode: stop auto-refitting
      setIsResizing(true);
      setResizingColumnKey(columnKey);

      const onMove = (moveEvt: MouseEvent) => {
        if (!resizeRef.current) return;
        const delta = moveEvt.clientX - resizeRef.current.startX;
        const newWidth = Math.max(MIN_COL_WIDTH, resizeRef.current.startWidth + delta);
        setColumnWidths((prev) => ({ ...prev, [resizeRef.current!.columnKey]: newWidth }));
      };

      const onUp = () => {
        resizeRef.current = null;
        setIsResizing(false);
        setResizingColumnKey(null);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [effectiveWidth, hasManualResize, flexKey]
  );

  /* ─── Column drag (custom mouse-event live reorder) ─── */
  const colDragRef = useRef<{
    columnKey: string;
    startX: number;
    startY: number;
    isDragging: boolean;
    lastSwapTime: number;
  } | null>(null);
  const suppressNextClickRef = useRef(false);
  const ghostElRef = useRef<HTMLDivElement>(null);
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);
  // Drag-out-to-hide (user 10/5): carrying a header well outside the
  // table and releasing hides that column, same effect as the header
  // menu's Hide. The ghost flips to a "Release to hide" cue while out.
  const [dragOutHide, setDragOutHide] = useState(false);
  const dragOutHideRef = useRef(false);

  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent, columnKey: string) => {
      const colDef = colByKey.get(columnKey);
      if (colDef?.locked) return;
      if (isResizing) return;
      if (e.button !== 0) return;

      const startX = e.clientX;
      const startY = e.clientY;
      colDragRef.current = { columnKey, startX, startY, isDragging: false, lastSwapTime: 0 };

      const DRAG_THRESHOLD = 5;
      const SWAP_SETTLE_MS = 60;

      // Snapshot the order we'll mutate inside the move handler (the order
      // on screen, brought-out columns included).
      let workingOrder = [...displayOrder];

      const onMove = (moveEvt: MouseEvent) => {
        if (!colDragRef.current) return;
        const dx = moveEvt.clientX - colDragRef.current.startX;
        const dy = moveEvt.clientY - colDragRef.current.startY;

        if (!colDragRef.current.isDragging) {
          if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
          colDragRef.current.isDragging = true;
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'grabbing';
          setDraggingColumnKey(colDragRef.current.columnKey);
        }

        // Position the floating ghost pill at the cursor (DOM ref update —
        // zero React re-renders during drag, matching partner module's
        // perf characteristics).
        const ghost = ghostElRef.current;
        if (ghost) {
          ghost.style.transform = `translate(${moveEvt.clientX + 8}px, ${moveEvt.clientY + 8}px)`;
        }

        const draggedKey = colDragRef.current.columnKey;

        const draggedTh = document.querySelector<HTMLElement>(
          `th[data-col-drag-key="${draggedKey}"]`
        );
        if (!draggedTh) return;

        // Pulled up past the toolbar's top: a release hides (drag-to-hide
        // spec, 10/14/26). Strictly above the line; the toolbar itself and
        // everything below it is still a move. Only what the header menu
        // can hide turns red, and draggable columns are exactly those.
        const out = moveEvt.clientY < hideEdgeOf(draggedTh);
        if (out !== dragOutHideRef.current) {
          dragOutHideRef.current = out;
          setDragOutHide(out);
        }
        // No swaps while red: the column keeps its place, so a release
        // hides it from where it stood.
        if (out) return;

        const now = performance.now();
        if (now - colDragRef.current.lastSwapTime < SWAP_SETTLE_MS) return;

        const cursorX = moveEvt.clientX;
        const draggedRect = draggedTh.getBoundingClientRect();
        if (cursorX >= draggedRect.left && cursorX <= draggedRect.right) return;

        const allThs = document.querySelectorAll<HTMLElement>('th[data-col-drag-key]');
        for (const th of allThs) {
          const rect = th.getBoundingClientRect();
          if (cursorX < rect.left || cursorX > rect.right) continue;
          const k = th.getAttribute('data-col-drag-key');
          if (!k || k === draggedKey) break;
          const targetDef = colByKey.get(k);
          if (targetDef?.locked) break;
          // Swap only once the pointer passes the neighbour's middle, so a
          // pointer drifting sideways on its way up does not shuffle columns.
          const mid = rect.left + rect.width / 2;
          if (rect.left > draggedRect.left ? cursorX < mid : cursorX > mid) break;

          const srcIdx = workingOrder.indexOf(draggedKey);
          const tgtIdx = workingOrder.indexOf(k);
          if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) break;
          const next = [...workingOrder];
          next.splice(srcIdx, 1);
          next.splice(tgtIdx, 0, draggedKey);
          workingOrder = next;
          onColumnOrderChange(toReaderOrder(next));
          colDragRef.current.lastSwapTime = now;
          break;
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        if (colDragRef.current?.isDragging) {
          suppressNextClickRef.current = true;
          requestAnimationFrame(() => {
            suppressNextClickRef.current = false;
          });
          // Released past the hide line → hide (or, for a column the
          // search brought out, decline it for this search).
          if (dragOutHideRef.current) {
            hideColumn(colDragRef.current.columnKey);
          }
        }

        dragOutHideRef.current = false;
        setDragOutHide(false);
        colDragRef.current = null;
        setDraggingColumnKey(null);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [isResizing, displayOrder, colByKey, onColumnOrderChange, hideColumn, toReaderOrder]
  );

  /* ─── Drag-select (row range selection) ─── */
  const dragSelectRef = useRef<{
    anchorId: string;
    mode: boolean;
    touched: Set<string>;
  } | null>(null);

  const beginDragSelect = useCallback(
    (id: string) => {
      const currentlySelected = selectedIds.has(id);
      const mode = !currentlySelected;
      dragSelectRef.current = { anchorId: id, mode, touched: new Set([id]) };
      const next = new Set(selectedIds);
      if (mode) next.add(id);
      else next.delete(id);
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange]
  );

  const extendDragSelect = useCallback(
    (id: string) => {
      const ctx = dragSelectRef.current;
      if (!ctx || ctx.touched.has(id)) return;
      ctx.touched.add(id);
      const next = new Set(selectedIds);
      if (ctx.mode) next.add(id);
      else next.delete(id);
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange]
  );

  const endDragSelect = useCallback(() => {
    dragSelectRef.current = null;
  }, []);

  useEffect(() => {
    const onUp = () => endDragSelect();
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mouseleave', onUp);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mouseleave', onUp);
    };
  }, [endDragSelect]);

  /* ─── All mode: lazy batches ─── */
  const allMode = isAllRecords(recordsPerPage);
  const [loadedCount, setLoadedCount] = useState(LAZY_BATCH);
  const [loadingMore, setLoadingMore] = useState(false);
  // A new filter, search or sort starts again from the first batch.
  useEffect(() => {
    setLoadedCount(LAZY_BATCH);
    setLoadingMore(false);
  }, [allMode, totalRows, searchQuery]);
  const renderRows = useMemo(() => (allMode ? rows.slice(0, loadedCount) : rows), [allMode, rows, loadedCount]);
  const hasMoreToLoad = allMode && loadedCount < rows.length;
  const loadSentinelRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    if (!hasMoreToLoad || loadingMore) return;
    const el = loadSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setLoadingMore(true);
        window.setTimeout(() => {
          setLoadedCount((n) => n + LAZY_BATCH);
          setLoadingMore(false);
        }, LAZY_LOAD_MS);
      },
      { root: scrollRef.current, rootMargin: '0px 0px 120px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMoreToLoad, loadingMore, renderRows.length]);

  /* ─── Select all on this page (All mode: the loaded rows) ─── */
  const pageRowIds = useMemo(() => renderRows.map(getRowId), [renderRows, getRowId]);
  // "Select all that match" (All mode): every matching row, loaded or not.
  const matchRowIds = useMemo(() => (allMode ? rows.map(getRowId) : []), [allMode, rows, getRowId]);
  const allMatchSelected = matchRowIds.length > 0 && matchRowIds.every((id) => selectedIds.has(id));
  const allPageSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageRowIds.some((id) => selectedIds.has(id));

  const handleSelectAll = useCallback(() => {
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pageRowIds.forEach((id) => next.delete(id));
    } else {
      pageRowIds.forEach((id) => next.add(id));
    }
    onSelectionChange(next);
  }, [allPageSelected, pageRowIds, selectedIds, onSelectionChange]);

  /* ─── Per-group row IDs (10/5): the vendor-level checkbox in the band
   *  ticks/clears every invoice in that group at once. ─── */
  const groupRowIds = useMemo(() => {
    if (!groupBy) return null;
    const m = new Map<string, string[]>();
    for (const r of rows) {
      const gid = groupBy(r).id;
      const arr = m.get(gid);
      if (arr) arr.push(getRowId(r));
      else m.set(gid, [getRowId(r)]);
    }
    return m;
  }, [groupBy, rows, getRowId]);

  const toggleGroupSelection = useCallback(
    (memberIds: string[], allSelected: boolean) => {
      const next = new Set(selectedIds);
      if (allSelected) memberIds.forEach((id) => next.delete(id));
      else memberIds.forEach((id) => next.add(id));
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange],
  );

  /* ─── Pagination buttons (1 2 3 … N) ─── */
  const totalPages = Math.max(1, Math.ceil(totalRows / recordsPerPage));
  const pageButtons = useMemo(() => {
    const buttons: (number | string)[] = [];
    const maxButtons = 7;
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) buttons.push(i);
    } else {
      buttons.push(1);
      if (currentPage > 3) buttons.push('…');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) buttons.push(i);
      if (currentPage < totalPages - 2) buttons.push('…');
      buttons.push(totalPages);
    }
    return buttons;
  }, [totalPages, currentPage]);

  const isBulkMode = selectedIds.size > 0;
  const tableWidth =
    (hideSelectionColumn ? 0 : CHECKBOX_COL_WIDTH) +
    visibleColumns.reduce((sum, key) => sum + effectiveWidth(key), 0) +
    (isBulkMode || !renderRowActions ? 0 : ACTIONS_COL_WIDTH);

  const revealedLabels = visibleColumns
    .filter((k) => revealed.includes(k))
    .map((k) => colByKey.get(k)?.label ?? k);

  /* ─── Empty & error states (standard v1.0) ─── */
  const st = useTableStates<T>({
    config: emptyConfig,
    pageRows: rows,
    totalRows,
    searchQuery,
    suggestionRows: optionRows ?? rows,
    columns,
    onFirstPage: () => onPageChange(1),
  });
  const { tableLoad, loadState, emptyProps } = st;
  const emptyKind = emptyConfig ? st.emptyKind : rows.length === 0 ? 'legacy' : null;
  const showSkeleton = loadState === 'loading';
  const showEmpty = !showSkeleton && emptyKind !== null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* A refresh failed with rows on screen: the rows stay (standard 3.4). */}
      {emptyConfig && loadState === 'stale' && (
        <TableStaleBanner entity={emptyConfig.entity} lastUpdated={tableLoad.lastUpdated} onRetry={tableLoad.retry} retrying={tableLoad.retrying} />
      )}
      {/* The search-reveal note (10/14/26): directly above the headings it
          explains, only while a column is brought out. */}
      {revealedLabels.length > 0 && (
        <div
          className="shrink-0 px-4 py-2 bg-blue-50 border-b border-blue-100 text-blue-700 text-xs flex items-center gap-2"
          data-search-revealed
        >
          <Info className="w-3.5 h-3.5 shrink-0 text-blue-600" />
          <span>
            Your search also matched {listJoin(revealedLabels)}, so {revealedLabels.length === 1 ? 'that column is' : 'those columns are'} shown while you search.
          </span>
        </div>
      )}
      {/* Scroll container — overscroll-contain so a wheel that runs out
          of rows never chains to the page behind (bit modal consumers,
          8/28/26: the run's Step 1 scrolled the listing underneath). */}
      {/* All mode: "Select all that match" (Gmail pattern) once every
          loaded row is ticked and more rows match than are loaded. */}
      {allMode && selectedIds.size > 0 && (allPageSelected || allMatchSelected) && rows.length > renderRows.length && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-border bg-accent/40 text-[13px] text-foreground shrink-0">
          {allMatchSelected ? (
            <>
              <span>All {rows.length.toLocaleString('en-US')} records that match are selected.</span>
              <button
                type="button"
                onClick={() => onSelectionChange(new Set())}
                className="text-primary hover:underline cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Clear Selection
              </button>
            </>
          ) : (
            <>
              <span>All {renderRows.length.toLocaleString('en-US')} loaded records are selected.</span>
              <button
                type="button"
                onClick={() => onSelectionChange(new Set([...selectedIds, ...matchRowIds]))}
                className="text-primary hover:underline cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Select All {rows.length.toLocaleString('en-US')} That Match
              </button>
            </>
          )}
        </div>
      )}
      <div
        ref={scrollRef}
        className={`min-h-0 overflow-auto flex-1 overscroll-contain ${
          isResizing || draggingColumnKey ? 'select-none' : ''
        }`}
      >
        <Table
          // Zero rows: the table stretches to the container height so the
          // empty-state row (height 100%) centers in the visible area
          // instead of hugging the header (user 10/1).
          className={showEmpty ? 'h-full' : undefined}
          style={{
            tableLayout: 'fixed',
            // Flex tables fill their container via the flex column's absorbed
            // slack, so tableWidth already equals the container width. Non-flex
            // tables (the listing) stretch to fill the container as before.
            width: flexKey ? `${tableWidth}px` : `max(${tableWidth}px, 100%)`,
          }}
        >
          <TableHeader className="sticky top-0 z-20 bg-card [&_tr]:border-0">
            <TableRow
              className={`bg-muted/30 hover:bg-muted/30 [&>th]:border-b [&>th]:border-border [&>th]:border-solid ${
                density === 'condensed' ? '[&>th]:h-8' : density === 'comfort' ? '[&>th]:h-9' : ''
              }`}
              style={{ boxShadow: 'inset 0 -1px 0 0 hsl(var(--border))' }}
            >
              {/* Sticky checkbox header — opaque bg so scroll content doesn't bleed through */}
              {!hideSelectionColumn && (
                <TableHead
                  className="sticky left-0 z-20 bg-slate-50 w-[44px] min-w-[44px] max-w-[44px] !p-0 cursor-pointer select-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectAll();
                  }}
                  aria-label="Select all rows on this page"
                >
                  <div className="flex h-full w-full items-center justify-center">
                    <Checkbox
                      checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                      tabIndex={-1}
                      className="pointer-events-none"
                      aria-hidden="true"
                    />
                  </div>
                </TableHead>
              )}

              {/* Dynamic column headers */}
              {visibleColumns.map((key) => {
                const def = colByKey.get(key);
                if (!def) return null;
                const isFrozen = frozenColumns.has(key);
                const isRightPinned = def.sticky === 'right';
                const isLocked = !!def.locked;
                const isDraggable = !isLocked && !isRightPinned;
                const extraSortOn = !!def.extraSorts?.some((x) => sortConfig?.key === x.key && sortConfig.direction === x.direction);
                const currentColSort: 'asc' | 'desc' | null =
                  sortConfig?.key === key ? sortConfig.direction : null;
                const hasFilter = columnFilters[key]
                  ? isFilterActive(columnFilters[key])
                  : false;
                const width = effectiveWidth(key);
                const isBeingDragged = draggingColumnKey === key;
                const uniqueValues = def.uniqueValues ? def.uniqueValues(optionRows ?? rows) : undefined;

                const isLastFrozen = key === lastFrozenKey;
                const isFirstRightPinned = key === firstRightPinnedKey;
                return (
                  <TableHead
                    key={key}
                    data-col-drag-key={key}
                    onMouseDown={isDraggable ? (e) => handleHeaderMouseDown(e, key) : undefined}
                    onClickCapture={
                      isDraggable
                        ? (e) => {
                            if (suppressNextClickRef.current) {
                              e.stopPropagation();
                              e.preventDefault();
                            }
                          }
                        : undefined
                    }
                    className={`whitespace-nowrap relative group/colheader ${
                      isFrozen || isRightPinned ? 'sticky bg-slate-50 z-20' : ''
                    } ${hasFilter && !isFrozen && !isRightPinned ? 'bg-primary/[0.03]' : ''} ${
                      isDraggable ? 'cursor-grab' : ''
                    } ${def.align === 'right' ? 'text-right' : ''}`}
                    style={{
                      width: `${width}px`,
                      minWidth: `${width}px`,
                      maxWidth: `${width}px`,
                      overflow: 'hidden',
                      ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px` } : {}),
                      ...(isRightPinned ? { right: `${rightPinnedOffsets[key] ?? 0}px` } : {}),
                      // Inset side-line on the last frozen column to mark the
                      // sticky/scroll boundary (mirrors partner module).
                      ...(isLastFrozen && !isBeingDragged
                        ? {
                            boxShadow:
                              'inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)',
                          }
                        : {}),
                      ...(isFirstRightPinned && !isBeingDragged
                        ? {
                            boxShadow:
                              'inset 1px 0 0 0 rgba(0,0,0,0.08), -3px 0 6px -2px rgba(0,0,0,0.06)',
                          }
                        : {}),
                      ...(isBeingDragged
                        ? {
                            background: dragOutHide
                              ? 'linear-gradient(180deg, rgba(225,29,72,0.10) 0%, rgba(225,29,72,0.04) 100%)'
                              : 'linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)',
                          }
                        : {}),
                    }}
                  >
                    {isBeingDragged && (
                      <div
                        className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full"
                        style={{ backgroundColor: dragOutHide ? HIDE_RED : 'hsl(var(--primary))' }}
                      />
                    )}
                    {isDraggable && (
                      <GripVertical
                        className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${
                          isBeingDragged
                            ? `opacity-100 ${dragOutHide ? 'text-rose-600' : 'text-primary'}`
                            : 'opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40'
                        }`}
                      />
                    )}

                    <div className={`flex items-center ${def.align === 'right' ? 'w-full' : ''}`}>
                      <ColumnHeaderMenu
                        columnKey={key}
                        label={def.label}
                        sortable={def.sortable}
                        extraSorts={def.extraSorts}
                        sortConfig={sortConfig}
                        onSort={onSort}
                        onAddFilter={onAddColumnFilter}
                        onHideColumn={hideColumn}
                        onFreezeColumn={isLocked ? undefined : onFreezeColumn}
                        isFrozen={isFrozen}
                        isLocked={isLocked}
                        hasActiveFilter={hasFilter}
                        filter={columnFilters[key] ?? null}
                        filterable={def.filterable !== false}
                        filterType={def.filterType ?? 'text'}
                        uniqueValues={uniqueValues}
                        formatValueLabel={def.formatValueLabel}
                        onFilterChange={onColumnFilterChange}
                        suppressOpenRef={suppressNextClickRef}
                      >
                        <div
                          className={
                            def.align === 'right'
                              // Right-aligned columns reverse the row (user
                              // 10/8): the sort arrow / filter dot / info icon
                              // live to the LEFT of the label, so the label's
                              // right edge sits flush over the values instead
                              // of ~16px left of them (the hidden hover-arrow
                              // placeholder still takes layout space).
                              ? 'flex w-full flex-row-reverse items-center gap-1 justify-start'
                              : 'inline-flex items-center gap-1'
                          }
                        >
                          {/* Only FILTERS mark the header primary — a sort
                              (including the table's default order) shows just
                              the direction arrow, so a default sort never
                              reads as a user-applied state (review 7/14/26). */}
                          <span
                            className="text-[13px]"
                            style={hasFilter ? { color: 'hsl(var(--primary))' } : undefined}
                          >
                            {def.label}
                          </span>
                          {def.tooltip && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className="inline-flex items-center justify-center cursor-help shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                {def.tooltip}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {hasFilter && !currentColSort && !extraSortOn && (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: 'hsl(var(--primary))' }}
                            />
                          )}
                          {currentColSort === 'asc' && (
                            <ArrowUp className="w-3 h-3 shrink-0 text-slate-500" />
                          )}
                          {currentColSort === 'desc' && (
                            <ArrowDown className="w-3 h-3 shrink-0 text-slate-500" />
                          )}
                          {extraSortOn && (
                            <Clock className="w-3 h-3 shrink-0 text-slate-500" />
                          )}
                          {!currentColSort && !extraSortOn && !hasFilter && def.sortable && (
                            <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </ColumnHeaderMenu>
                    </div>

                    {def.resizable !== false && (
                      <div
                        onMouseDown={(e) => handleResizeStart(e, key)}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setColumnWidths((prev) => ({ ...prev, [key]: def.minWidth }));
                        }}
                        className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
                        style={{ touchAction: 'none' }}
                      >
                        <div
                          className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${
                            resizingColumnKey === key
                              ? 'bg-primary'
                              : 'bg-transparent group-hover/resize:bg-primary/40'
                          }`}
                        />
                      </div>
                    )}
                  </TableHead>
                );
              })}

              {/* Sticky right Actions header — opaque so scroll content doesn't bleed */}
              {!isBulkMode && renderRowActions && (
                <TableHead
                  className="whitespace-nowrap w-[60px] sticky right-0 bg-slate-50 z-20 !pl-2 !pr-2"
                  style={{ boxShadow: 'inset 1px 0 0 0 rgba(0,0,0,0.08)' }}
                >
                  <span className="text-[13px]">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {showSkeleton ? (
              <TableSkeletonRows columns={visibleColumns.length + (isBulkMode ? 1 : 2)} />
            ) : showEmpty && emptyProps ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumns.length + (isBulkMode ? 1 : 2)} className="p-0 align-middle">
                  <PinToViewport>
                    <TableEmptyState {...emptyProps} />
                  </PinToViewport>
                </TableCell>
              </TableRow>
            ) : showEmpty ? (
              // No row hover on the empty state (user 10/1) — nothing here
              // is interactive, so the highlight read as a broken affordance.
              <TableRow className="hover:bg-transparent">
                {/* Empty state pinned to the viewport (VI-50): the cell spans
                    every column (several thousand px with all columns shown),
                    so centering inside it rendered the "no match" message and
                    Clear-search button far off-screen to the right. The
                    sticky, viewport-bounded wrapper keeps them in view at any
                    horizontal scroll position. */}
                <TableCell
                  colSpan={visibleColumns.length + (isBulkMode ? 1 : 2)}
                  className="h-32 p-0 align-middle sticky left-0"
                >
                  <div
                    className="h-32 flex items-center justify-center px-6"
                    style={{ width: 'min(100vw, 1200px)' }}
                  >
                    {emptyState ?? <span className="text-sm text-muted-foreground">No records found</span>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              renderRows.map((row, rowIndex) => {
                const rowId = getRowId(row);
                const isSelected = selectedIds.has(rowId);
                const isFlashing = newlyCreatedId === rowId;

                // Group band (Eli 9/25): emit a full-width header the first
                // time a new group id appears. Rows are pre-sorted by group
                // upstream, so a change from the previous row starts a band.
                let groupHeader: ReactNode = null;
                if (groupBy) {
                  const g = groupBy(row);
                  const prevG = rowIndex > 0 ? groupBy(rows[rowIndex - 1]) : null;
                  if (!prevG || prevG.id !== g.id) {
                    const memberIds = groupRowIds?.get(g.id) ?? [];
                    const selInGroup = memberIds.reduce((n, id) => n + (selectedIds.has(id) ? 1 : 0), 0);
                    const allGroupSel = memberIds.length > 0 && selInGroup === memberIds.length;
                    const someGroupSel = selInGroup > 0 && !allGroupSel;
                    groupHeader = (
                      <TableRow key={`group-${g.id}`} className="hover:bg-transparent">
                        <TableCell colSpan={99} className="sticky left-0 !py-1.5 !px-4 bg-slate-100/80 border-y border-slate-200">
                          <div className="flex items-center gap-3">
                            <div className="inline-flex items-center gap-2.5 min-w-0">
                              {/* Vendor-level select (user 10/5): ticks every
                                  invoice in this group, left of the name. */}
                              {!hideSelectionColumn && (
                                <span
                                  onClick={(e) => { e.stopPropagation(); toggleGroupSelection(memberIds, allGroupSel); }}
                                  className="inline-flex items-center justify-center cursor-pointer shrink-0"
                                  aria-label={`Select all ${memberIds.length} invoice${memberIds.length === 1 ? '' : 's'} for ${g.label}`}
                                >
                                  <Checkbox
                                    checked={allGroupSel ? true : someGroupSel ? 'indeterminate' : false}
                                    tabIndex={-1}
                                    className="pointer-events-none"
                                    aria-hidden="true"
                                  />
                                </span>
                              )}
                              <span className="inline-flex items-center gap-2 text-[12px] text-slate-700 min-w-0" style={{ fontWeight: 700 }}>
                                {g.label}
                                {g.subtitle && <span className="text-slate-400" style={{ fontWeight: 500 }}>{g.subtitle}</span>}
                              </span>
                            </div>
                            {g.right != null && <span className="ml-auto shrink-0">{g.right}</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }
                }

                const dataRow = (
                  <TableRow
                    key={rowId}
                    data-row-id={rowId}
                    data-selected={isSelected || undefined}
                    className={`cursor-pointer group ${
                      isSelected ? 'bg-accent-row-selected hover:bg-accent-row-hover' : 'hover:bg-accent-row-hover'
                    } ${
                      density === 'condensed'
                        ? '[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2'
                        : density === 'comfort'
                          ? '[&>td]:py-2 [&>td]:pl-4 [&>td]:pr-2 [&>td]:text-[13px]'
                          : ''
                    } ${isFlashing ? 'animate-row-flash' : ''} ${rowClassName?.(row) ?? ''}`}
                    onClick={() => {
                      if (isBulkMode) {
                        const next = new Set(selectedIds);
                        if (next.has(rowId)) next.delete(rowId);
                        else next.add(rowId);
                        onSelectionChange(next);
                        return;
                      }
                      onRowClick?.(row);
                    }}
                  >
                    {/* Sticky checkbox cell */}
                    {!hideSelectionColumn && (
                      <TableCell
                        className={`sticky left-0 z-10 w-[44px] min-w-[44px] max-w-[44px] !p-0 cursor-pointer select-none ${
                          isSelected
                            ? 'bg-accent-row-selected group-hover:bg-accent-row-hover'
                            : 'bg-card group-hover:bg-accent-row-hover'
                        }`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          beginDragSelect(rowId);
                        }}
                        onMouseEnter={() => extendDragSelect(rowId)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select row"
                      >
                        <div className="flex h-full w-full items-center justify-center">
                          {/* Keyboard-reachable selection (VI-30): Tab lands
                              on the box and Space toggles it via onCheckedChange;
                              mouse clicks still pass through (pointer-events-none)
                              to the cell's drag-select. It carries its own name
                              instead of hiding from assistive tech. */}
                          <Checkbox
                            checked={isSelected}
                            tabIndex={0}
                            onCheckedChange={() => {
                              const next = new Set(selectedIds);
                              if (next.has(rowId)) next.delete(rowId);
                              else next.add(rowId);
                              onSelectionChange(next);
                            }}
                            className="pointer-events-none"
                            aria-label={isSelected ? 'Deselect row' : 'Select row'}
                          />
                        </div>
                      </TableCell>
                    )}

                    {/* Body cells */}
                    {visibleColumns.map((key) => {
                      const def = colByKey.get(key);
                      if (!def) return null;
                      const w = effectiveWidth(key);
                      const isDraggedCol = draggingColumnKey === key;
                      const cellWidthStyle: React.CSSProperties = {
                        width: `${w}px`,
                        minWidth: `${w}px`,
                        maxWidth: `${w}px`,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        ...(isDraggedCol ? { backgroundColor: dragOutHide ? TINT_HIDE : TINT_MOVE } : {}),
                      };
                      const cellContent = def.render(row, { density, isSelected, searchQuery });
                      const cellAlign = def.align === 'right' ? 'text-right' : '';

                      if (frozenColumns.has(key)) {
                        const frozenBg = isSelected
                          ? 'bg-accent-row-selected group-hover:bg-accent-row-hover'
                          : 'bg-card group-hover:bg-accent-row-hover';
                        const isLastFrozenCell = key === lastFrozenKey;
                        return (
                          <TableCell
                            key={key}
                            className={`sticky z-10 ${frozenBg} ${cellAlign}`.trim()}
                            style={{
                              ...cellWidthStyle,
                              left: `${frozenOffsets[key] ?? 0}px`,
                              ...(isLastFrozenCell
                                ? {
                                    boxShadow:
                                      'inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)',
                                  }
                                : {}),
                            }}
                          >
                            {cellContent}
                          </TableCell>
                        );
                      }
                      if (def.sticky === 'right') {
                        const pinnedBg = isSelected
                          ? 'bg-accent-row-selected group-hover:bg-accent-row-hover'
                          : 'bg-card group-hover:bg-accent-row-hover';
                        return (
                          <TableCell
                            key={key}
                            className={`sticky z-10 ${pinnedBg} ${cellAlign}`.trim()}
                            style={{
                              ...cellWidthStyle,
                              right: `${rightPinnedOffsets[key] ?? 0}px`,
                              ...(key === firstRightPinnedKey
                                ? {
                                    boxShadow:
                                      'inset 1px 0 0 0 rgba(0,0,0,0.08), -3px 0 6px -2px rgba(0,0,0,0.06)',
                                  }
                                : {}),
                            }}
                          >
                            {cellContent}
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={key} className={cellAlign} style={cellWidthStyle}>
                          {cellContent}
                        </TableCell>
                      );
                    })}

                    {/* Sticky right Actions cell — hidden in bulk mode */}
                    {!isBulkMode && renderRowActions && (
                      <TableCell
                        className={`sticky right-0 z-10 !pl-2 !pr-2 ${
                          isSelected
                            ? 'bg-accent-row-selected group-hover:bg-accent-row-hover'
                            : 'bg-card group-hover:bg-accent-row-hover'
                        }`}
                        style={{ boxShadow: 'inset 1px 0 0 0 rgba(0,0,0,0.08)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {renderRowActions(row)}
                      </TableCell>
                    )}
                  </TableRow>
                );
                if (!groupHeader) return dataRow;
                return (
                  <Fragment key={`grp-wrap-${rowId}`}>
                    {groupHeader}
                    {dataRow}
                  </Fragment>
                );
              })
            )}
            {/* All mode: the loading row at the bottom while the next
                batch comes in; it doubles as the scroll sentinel. */}
            {hasMoreToLoad && (
              <TableRow ref={loadSentinelRef} className="hover:bg-transparent">
                <TableCell colSpan={visibleColumns.length + (isBulkMode ? 1 : 2)} className="p-0 sticky left-0">
                  <div className="h-11 flex items-center gap-2 px-4 text-[13px] text-muted-foreground" style={{ width: 'min(100vw, 1200px)' }}>
                    <Loader2 className={`w-3.5 h-3.5 ${loadingMore ? 'animate-spin' : ''} text-primary`} />
                    {loadingMore
                      ? `Loading the next ${Math.min(LAZY_BATCH, rows.length - loadedCount).toLocaleString('en-US')} records…`
                      : 'Scroll to load more records'}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      {!hidePagination && (
      <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-4 shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span style={{ fontWeight: 400 }}>Records per Page</span>
          <Select
            value={allMode ? 'all' : String(recordsPerPage)}
            onValueChange={(v) => onRecordsPerPageChange(v === 'all' ? ALL_RECORDS : Number(v))}
          >
            {/* Force white bg + foreground text — shadcn's default Select
                trigger leans muted, which read as "disabled" against the
                rest of the page chrome. */}
            <SelectTrigger className="w-[68px] h-8 text-sm bg-white text-foreground border border-border/80 shadow-sm hover:bg-muted/40 transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* All mode keeps the same pager (partner parity, 10/29): page 1 of 1. */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-sm text-muted-foreground"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </Button>
          {pageButtons.map((page, index) =>
            page === '…' ? (
              <span key={`gap-${index}`} className="px-2 text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={page}
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 text-sm ${
                  page === currentPage
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'text-muted-foreground'
                }`}
                onClick={() => typeof page === 'number' && onPageChange(page)}
              >
                {page}
              </Button>
            )
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-sm text-muted-foreground"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      )}

      {/* Floating drag ghost — portal'd to body, positioned via DOM ref for
          zero React re-renders. Mirrors partner module's drag affordance. */}
      {draggingColumnKey &&
        createPortal(
          <div
            ref={ghostElRef}
            className="fixed top-0 left-0 z-[9999] pointer-events-none"
            style={{ transform: 'translate(-9999px, -9999px)' }}
          >
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border shadow-lg text-[12px]"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: dragOutHide ? 'rgba(225,29,72,0.35)' : 'hsl(var(--primary) / 0.3)',
                color: dragOutHide ? '#E11D48' : 'hsl(var(--primary))',
                fontWeight: 500,
                boxShadow: dragOutHide
                  ? '0 8px 24px -8px rgba(225,29,72,0.25), 0 2px 6px rgba(0,0,0,0.08)'
                  : '0 8px 24px -8px rgba(10,119,255,0.25), 0 2px 6px rgba(0,0,0,0.08)',
              }}
            >
              {dragOutHide ? <EyeOff className="w-3 h-3" /> : <GripVertical className="w-3 h-3" />}
              {colByKey.get(draggingColumnKey)?.label ?? draggingColumnKey}
              {dragOutHide && <span className="text-[11px]" style={{ fontWeight: 400 }}>· release to hide</span>}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
