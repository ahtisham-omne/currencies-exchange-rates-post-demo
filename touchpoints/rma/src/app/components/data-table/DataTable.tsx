import {
  Fragment,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
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
import { useColumnCurrencyViews, type ColumnCurrencyView } from './columnCurrencyView';

const CHECKBOX_COL_WIDTH = 44;
const ACTIONS_COL_WIDTH = 60;
const MIN_COL_WIDTH = 1; // unrestricted resize — caller can shrink columns freely

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

  /** Optional per-row extra classes — lets consumers give specific rows a
   *  visual accent (e.g. the pre-invoice left strip) without forking the
   *  row markup. Composes with the density + selection classes. */
  rowClassName?: (row: T) => string | undefined;

  /* Optional row-actions slot — rendered inside the sticky right Actions cell. */
  renderRowActions?: (row: T) => ReactNode;

  /* Empty-state slot — rendered inside a full-width <td> when rows is empty. */
  emptyState?: ReactNode;

  /** Nested detail slot — when a row's id is in `expandedIds`, this renders
   *  into a full-width row directly beneath it. The consumer owns the
   *  expand/collapse trigger (typically a chevron in its first cell). */
  renderExpandedRow?: (row: T) => ReactNode;
  expandedIds?: Set<string>;

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
  /** Where this table keeps its money columns' "Show values as" choice for
   *  the session (columnCurrencyView.ts), so it outlives a remount. Without
   *  it the money columns still switch, but only while the table is up. */
  currencyViewKey?: string;
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
  rowClassName,
  renderRowActions,
  emptyState,
  renderExpandedRow,
  expandedIds,
  newlyCreatedId,
  currentPage,
  recordsPerPage,
  totalRows,
  onPageChange,
  onRecordsPerPageChange,
  searchQuery,
  hideSelectionColumn = false,
  hidePagination = false,
  fillMode = 'flex',
  currencyViewKey,
}: DataTableProps<T>) {
  /* ─── Money columns' "Show values as" (base until switched) ─── */
  const [storedCurrencyViews, setStoredCurrencyView] = useColumnCurrencyViews(currencyViewKey);
  const [localCurrencyViews, setLocalCurrencyViews] = useState<Record<string, ColumnCurrencyView>>({});
  const currencyViewOf = (key: string): ColumnCurrencyView =>
    (currencyViewKey ? storedCurrencyViews[key] : localCurrencyViews[key]) ?? 'base';
  const changeCurrencyView = (key: string, view: ColumnCurrencyView) => {
    if (currencyViewKey) setStoredCurrencyView(key, view);
    else setLocalCurrencyViews((prev) => ({ ...prev, [key]: view }));
  };

  /* ─── Column lookup ─── */
  const colByKey = useMemo(() => {
    const m = new Map<string, ColumnDef<T>>();
    columns.forEach((c) => m.set(c.key, c));
    return m;
  }, [columns]);

  const visibleColumns = useMemo(
    () =>
      columnOrder
        .filter((k) => columnVisibility[k] !== false && colByKey.has(k)),
    [columnOrder, columnVisibility, colByKey]
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
  useEffect(() => {
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
  useEffect(() => {
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
    // Each column starts at the width its content was sized for and shares
    // any slack in proportion to it. An equal share ignored that: at 1440 px
    // nine columns got ~140 px each, which cut off the RMA ID beside its
    // version badge and the longer status pills. Where the columns do not
    // fit, they keep their own widths and the table scrolls.
    const base = (k: string) => {
      const col = colByKey.get(k);
      return Math.max(col?.minWidth ?? 80, col?.defaultWidth ?? col?.minWidth ?? 100);
    };
    const total = visibleColumns.reduce((n, k) => n + base(k), 0);
    const slack = Math.max(0, containerWidth - chrome - total);
    setColumnWidths((prev) => {
      const next = { ...prev };
      visibleColumns.forEach((k) => {
        next[k] = Math.floor(base(k) + (total > 0 ? (slack * base(k)) / total : 0));
      });
      return next;
    });
  }, [fillMode, containerWidth, visibleColumns, colByKey, hideSelectionColumn, selectedIds, renderRowActions]);

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

      // Snapshot the order we'll mutate inside the move handler
      let workingOrder = [...columnOrder];

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

        const now = performance.now();
        if (now - colDragRef.current.lastSwapTime < SWAP_SETTLE_MS) return;

        const cursorX = moveEvt.clientX;
        const draggedKey = colDragRef.current.columnKey;

        const draggedTh = document.querySelector<HTMLElement>(
          `th[data-col-drag-key="${draggedKey}"]`
        );
        if (!draggedTh) return;
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

          const srcIdx = workingOrder.indexOf(draggedKey);
          const tgtIdx = workingOrder.indexOf(k);
          if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) break;
          const next = [...workingOrder];
          next.splice(srcIdx, 1);
          next.splice(tgtIdx, 0, draggedKey);
          workingOrder = next;
          onColumnOrderChange(next);
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
        }

        colDragRef.current = null;
        setDraggingColumnKey(null);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [isResizing, columnOrder, colByKey, onColumnOrderChange]
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

  /* ─── Select all on this page ─── */
  const pageRowIds = useMemo(() => rows.map(getRowId), [rows, getRowId]);
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scroll container */}
      <div
        ref={scrollRef}
        className={`min-h-0 overflow-auto flex-1 hover-scrollbar ${
          isResizing || draggingColumnKey ? 'select-none' : ''
        }`}
      >
        <Table
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
                const isLocked = !!def.locked;
                const isDraggable = !isLocked;
                const currentColSort: 'asc' | 'desc' | null =
                  sortConfig?.key === key ? sortConfig.direction : null;
                const hasFilter = columnFilters[key]
                  ? isFilterActive(columnFilters[key])
                  : false;
                const width = effectiveWidth(key);
                const isBeingDragged = draggingColumnKey === key;
                const uniqueValues = def.uniqueValues ? def.uniqueValues(optionRows ?? rows) : undefined;

                const isLastFrozen = key === lastFrozenKey;
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
                      isFrozen ? 'sticky bg-slate-50 z-20' : ''
                    } ${hasFilter && !isFrozen ? 'bg-primary/[0.03]' : ''} ${
                      isDraggable ? 'cursor-grab' : ''
                    } ${def.align === 'right' ? 'text-right' : ''}`}
                    style={{
                      width: `${width}px`,
                      minWidth: `${width}px`,
                      maxWidth: `${width}px`,
                      overflow: 'hidden',
                      ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px` } : {}),
                      // Inset side-line on the last frozen column to mark the
                      // sticky/scroll boundary (mirrors partner module).
                      ...(isLastFrozen && !isBeingDragged
                        ? {
                            boxShadow:
                              'inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)',
                          }
                        : {}),
                      ...(isBeingDragged
                        ? {
                            background:
                              'linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)',
                          }
                        : {}),
                    }}
                  >
                    {isBeingDragged && (
                      <div
                        className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full"
                        style={{ backgroundColor: 'hsl(var(--primary))' }}
                      />
                    )}
                    {isDraggable && (
                      <GripVertical
                        className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${
                          isBeingDragged
                            ? 'opacity-100 text-primary'
                            : 'opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40'
                        }`}
                      />
                    )}

                    <div className={`flex items-center ${def.align === 'right' ? 'w-full' : ''}`}>
                      <ColumnHeaderMenu
                        columnKey={key}
                        label={def.label}
                        sortable={def.sortable}
                        sortConfig={sortConfig}
                        onSort={onSort}
                        onAddFilter={onAddColumnFilter}
                        onHideColumn={onHideColumn}
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
                        {...(def.moneyColumn
                          ? {
                              currencyView: currencyViewOf(key),
                              onCurrencyViewChange: (view: ColumnCurrencyView) => changeCurrencyView(key, view),
                              ...(def.partyCurrencyLabel ? { partyCurrencyLabel: def.partyCurrencyLabel } : {}),
                            }
                          : {})}
                      >
                        <div
                          className={`inline-flex items-center gap-1 ${
                            def.align === 'right' ? 'w-full justify-end' : ''
                          }`}
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
                          {hasFilter && !currentColSort && (
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
                          {!currentColSort && !hasFilter && def.sortable && (
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (isBulkMode ? 1 : 2)}
                  className="h-32 text-center"
                >
                  {emptyState ?? <span className="text-sm text-muted-foreground">No records found</span>}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const rowId = getRowId(row);
                const isSelected = selectedIds.has(rowId);
                const isFlashing = newlyCreatedId === rowId;
                const isExpanded = !!renderExpandedRow && !!expandedIds?.has(rowId);

                const mainRow = (
                  <TableRow
                    key={rowId}
                    data-selected={isSelected || undefined}
                    className={`cursor-pointer group ${
                      isSelected ? 'bg-accent-row-selected hover:bg-accent-row-hover' : 'hover:bg-accent-row-hover'
                    } ${
                      density === 'condensed'
                        ? '[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2'
                        : density === 'comfort'
                          ? '[&>td]:py-2 [&>td]:pl-4 [&>td]:pr-2'
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
                          <Checkbox
                            checked={isSelected}
                            tabIndex={-1}
                            className="pointer-events-none"
                            aria-hidden="true"
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
                        ...(isDraggedCol ? { backgroundColor: 'rgba(10,119,255,0.035)' } : {}),
                      };
                      const cellContent = def.render(row, {
                        density,
                        isSelected,
                        searchQuery,
                        ...(def.moneyColumn ? { currencyView: currencyViewOf(key) } : {}),
                      });
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

                if (!isExpanded) return mainRow;

                return (
                  <Fragment key={rowId}>
                    {mainRow}
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={
                          visibleColumns.length +
                          (hideSelectionColumn ? 0 : 1) +
                          (!isBulkMode && renderRowActions ? 1 : 0)
                        }
                        className="!p-0 bg-slate-50/70"
                      >
                        {/* Pinned to the scroll container's left edge and sized
                            to it, so the nested panel always sits inside the
                            visible boundary instead of stretching to the full
                            (scrollable) table width. */}
                        <div
                          className="sticky left-0"
                          style={containerWidth > 0 ? { width: `${containerWidth}px` } : undefined}
                        >
                          {renderExpandedRow(row)}
                        </div>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      {!hidePagination && (
      <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-4 shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span style={{ fontWeight: 400 }}>Records per page</span>
          <Select
            value={String(recordsPerPage)}
            onValueChange={(v) => onRecordsPerPageChange(Number(v))}
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
            </SelectContent>
          </Select>
        </div>

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
                borderColor: 'hsl(var(--primary) / 0.3)',
                color: 'hsl(var(--primary))',
                fontWeight: 500,
                boxShadow:
                  '0 8px 24px -8px rgba(10,119,255,0.25), 0 2px 6px rgba(0,0,0,0.08)',
              }}
            >
              <GripVertical className="w-3 h-3" />
              {colByKey.get(draggingColumnKey)?.label ?? draggingColumnKey}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
