/* "Review and Fix Your Data" for Item Library, Categories, Partners and
 * Partner Group.
 *
 * This is the Users ImportReviewModal (import-review/ImportReviewModal.tsx)
 * with the module's columns and validator in place of the Users ones. Every
 * visual part is the Users component itself, imported from that file: the
 * filter chips, status chip, Update badge, header and body cells, editable
 * cell with its issue and update tooltips, Start Import button, bulk-set
 * menu, row actions and context menu, delete and discard confirms, empty
 * states and the Import Complete dialog. What stays here is the component
 * body (state, validation, the 2400ms import run, history + detail writes),
 * copied from the Users body with the Users-only pieces (emails, licenses,
 * roles, the Users listing) swapped for the module definition. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  Search,
  X,
  Maximize2,
  Minimize2,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Trash2,
  Loader2,
  GripVertical,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import { Checkbox } from "../../ui/checkbox";
import { cn } from "../../ui/utils";
import { ImportColumnHeaderMenu } from "../table-columns/ImportColumnHeaderMenu";
import { ImportSelectionBar, SELECTION_ACTION_BASE, SELECTION_ACTION_CLASS } from "../ImportSelectionBar";
import { Pagination } from "../Pagination";
import {
  ACTIONS_COL_WIDTH,
  BodyTd,
  BulkDeleteConfirm,
  BulkSetDropdown,
  CellInput,
  DiscardConfirmModal,
  EditableDataCell,
  FilterChip,
  FloatingRowContextMenu,
  FROZEN_RIGHT_SHADOW,
  GridEmptyState,
  HeaderTh,
  ImportCompleteDialog,
  MAX_COL_WIDTH,
  MIN_COL_WIDTH,
  ROW_NUM_WIDTH,
  RowActionsButton,
  RowOpBadge,
  SELECT_COL_WIDTH,
  StartImportButton,
  STATUS_COL_WIDTH,
  StatusChip,
  type IssueGuide,
  type NavDir,
  type PendingConfirm,
  type StatusFilter,
} from "../import-review/ImportReviewModal";
import type { CellIssue } from "../import-review/validation";
import type { UserReviewField } from "../import-review/usersReviewMockData";
import { ChoiceCellDropdown, SEARCH_THRESHOLD, type ChoiceGroup } from "../import-review/ChoiceCellDropdown";
import { UOM_CATEGORIES, uomCategory } from "./categories/uom.mjs";
import { getSpecialEditor } from "./cell-editors";
import { addCompletedImport, addFixChildImport } from "../importHistory";
import { clearPendingCorrection } from "../pendingCorrections";
import {
  detectCorrectionTarget,
  linkRow,
  countBuckets,
  type CorrectionDetection,
  type RowLink,
} from "../correctionLink";
import { CorrectionBanner } from "../import-review/CorrectionBanner";
import type { RowOutcome } from "../importRecords";
import { DensityContext, DensityDropdown, type DensityOption } from "../density";
import {
  completeRow,
  editorOptions,
  type ModuleColumn,
  type ModuleImportDef,
  type ModuleIssue,
  type ModuleRow,
} from "./moduleImportDefs";
import {
  applyModuleCorrectionToParent,
  moduleSnapshotLoader,
  saveModuleImport,
  toModuleRecord,
  type ModuleRecord,
} from "./moduleImportStore";

interface CellAddr {
  rowId: string;
  field: string;
}

interface ManagedRow {
  id: string;
  data: ModuleRow;
  /** Original uploaded values, used for revert & for the edited-cell triangle. */
  originalData: ModuleRow;
}


function isSameCell(a: CellAddr | null, b: CellAddr | null): boolean {
  if (!a || !b) return a === b;
  return a.rowId === b.rowId && a.field === b.field;
}

function makeRowId(): string {
  return `r-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function makeInitialRows(source: ModuleRow[]): ManagedRow[] {
  return source.map((r) => ({ id: makeRowId(), data: { ...r }, originalData: { ...r } }));
}

function isRowEdited(r: ManagedRow, columns: ModuleColumn[]): boolean {
  for (const col of columns) {
    if ((r.data[col.key] ?? "") !== (r.originalData[col.key] ?? "")) return true;
  }
  return false;
}

/** Tooltip guide from the module issue itself: the home validators carry
 *  their own explanation, example and options, as their review tooltips show
 *  (`explanation || message`, then the EXAMPLE / OPTIONS card). */
export function describeModuleIssue(issue: CellIssue): IssueGuide {
  const i = issue as unknown as ModuleIssue;
  return {
    explanation: i.explanation || i.message,
    example: i.example ?? "",
    options: i.options && i.options.length > 0 ? i.options : undefined,
  };
}

/** Uppercase multi heading per reference source, as the Partners review
 *  labels them; every other column uses its own label. */
const SECTION_LABEL: Record<NonNullable<ModuleColumn["optionsFrom"]>, string> = {
  groups: "Partner Groups",
  partners: "Partners",
  contacts: "Contacts",
};

/** Base Unit of Measure lists its units under their unit category, as the
 *  Categories and Items reviews do (Length, Area, ... Custom). */
function unitGroups(options: string[]): ChoiceGroup[] | undefined {
  const groups: ChoiceGroup[] = [];
  const placed = new Set<string>();
  for (const cat of UOM_CATEGORIES) {
    const units = options.filter((u) => uomCategory(u) === cat);
    units.forEach((u) => placed.add(u));
    if (units.length) groups.push({ label: cat, options: units });
  }
  const rest = options.filter((u) => !placed.has(u));
  if (rest.length) groups.push({ label: "Custom", options: rest });
  return groups.length > 1 ? groups : undefined;
}

/** Cell editor for a module column, by the home module's Review and Fix
 *  rule: a pipe list opens the multi panel (search, checkboxes, Done), a
 *  single list opens the plain list, under a search box once it is long
 *  (more than 8 options; Items more than 10), free text and numbers type in
 *  the cell. Tags and Description keep the shared Data Imports editors (see
 *  cell-editors/), and so does every Physical Inventory column, which already
 *  mirrors its home module. */
export function renderModuleCellEditor(def: ModuleImportDef, col: ModuleColumn, row: ModuleRow = {}) {
  return function ModuleCellEditor(p: { initialValue: string; onCommit: (next: string, dir?: NavDir) => void; onCancel: () => void }) {
    const Special = getSpecialEditor(def.slug, col.key);
    if (Special) {
      return <Special initialValue={p.initialValue} onCommit={p.onCommit} onCancel={p.onCancel} def={def} col={col} row={row} />;
    }
    const options = editorOptions(def, col);
    if (options.length === 0) {
      return (
        <CellInput
          initialValue={p.initialValue}
          field={col.key as UserReviewField}
          onCommit={p.onCommit}
          onCancel={p.onCancel}
        />
      );
    }
    const threshold = def.slug === "item-library" ? 10 : SEARCH_THRESHOLD;
    const isUnit = !col.multi && (col.key === "uom" || col.key === "unit");
    return (
      <ChoiceCellDropdown
        value={p.initialValue}
        options={options}
        groups={isUnit ? unitGroups(options) : undefined}
        multi={col.multi}
        searchable={options.length > threshold}
        label={col.label}
        sectionLabel={col.optionsFrom ? SECTION_LABEL[col.optionsFrom] : undefined}
        onCommit={p.onCommit}
        onCancel={p.onCancel}
      />
    );
  };
}

export interface ModuleImportOutcome {
  created: ModuleRow[];
  updated: ModuleRow[];
  skipped: ModuleRow[];
  warningCount: number;
  importId: string;
}

interface ModuleImportReviewModalProps {
  def: ModuleImportDef;
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
  onApplied?: (outcome: ModuleImportOutcome) => void;
  moduleSlug: string;
  importName: string;
  importDescription?: string;
  fileName: string;
  /** Rows parsed out of the uploaded file, keyed by the module's columns. */
  parsedRows: ModuleRow[];
  sessionParentId?: string | null;
}

export function ModuleImportReviewModal({
  def,
  open,
  onClose,
  onCompleted,
  onApplied,
  moduleSlug,
  importName,
  importDescription = "",
  fileName,
  parsedRows: parsedRowsProp,
  sessionParentId = null,
}: ModuleImportReviewModalProps) {
  const navigate = useNavigate();
  const COLUMNS = def.columns;
  const nounPlural = def.nounPlural;

  /* Every column present on every row, so a file missing an optional column
   * still validates and edits like the template. */
  const parsedRows = useMemo(() => parsedRowsProp.map((r) => completeRow(def, r)), [parsedRowsProp, def]);

  /* Validation context, snapshotted when the review opens, the way the Users
   * host memoizes it per wizard open: existing records drive create vs
   * update, reference lists drive the not-found rules. */
  const validationContext = useMemo(() => (open ? def.buildContext() : null), [open, def]);

  const [isFullScreen, setIsFullScreen] = useState(true);
  const [density, setDensity] = useState<DensityOption>("condensed");
  const [rows, setRows] = useState<ManagedRow[]>(() => makeInitialRows(parsedRows));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeCell, setActiveCell] = useState<CellAddr | null>(null);
  const [editingCell, setEditingCell] = useState<CellAddr | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [skippedRows, setSkippedRows] = useState<ModuleRow[]>([]);
  const skippedRowIssuesRef = useRef<string[][]>([]);
  const [rowMenu, setRowMenu] = useState<{ rowId: string; x: number; y: number } | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  type ImportPhase =
    | { kind: "idle" }
    | { kind: "running"; processed: number; total: number }
    | {
        kind: "complete";
        importId: string;
        createdCount: number;
        updatedCount: number;
        warningCount: number;
        skippedCount: number;
        finishedAt: string;
        correctionParentId: string | null;
      };
  const [phase, setPhase] = useState<ImportPhase>({ kind: "idle" });

  useEffect(() => {
    if (!open) return;
    setRows(makeInitialRows(parsedRows));
    setSelectedIds(new Set());
    setActiveCell(null);
    setEditingCell(null);
    setPendingConfirm(null);
    setSkippedRows([]);
    skippedRowIssuesRef.current = [];
    setRowMenu(null);
    setShowDiscardConfirm(false);
    setPhase({ kind: "idle" });
    setIsFullScreen(true);
    setDensity("condensed");
    setHiddenCols(new Set());
    setFrozenCols(new Set());
    setHoveredRowId(null);
    setHoveredHeaderKey(null);
    setIsScrolledX(false);
  }, [open, parsedRows]);

  /* ── Correction linkage (correctionLink.ts, the module's own loader) ── */
  const loadSnapshot = useMemo(() => moduleSnapshotLoader(def), [def]);
  const keyOf = useCallback((r: ModuleRow) => (r[def.keyField] ?? "").trim().toLowerCase(), [def.keyField]);

  const detection = useMemo<CorrectionDetection>(() => {
    if (!open) return { kind: "none" };
    return detectCorrectionTarget({
      moduleSlug,
      sessionParentId,
      rowKeys: parsedRows.map(keyOf),
      loadSnapshot,
    });
  }, [open, moduleSlug, sessionParentId, parsedRows, keyOf, loadSnapshot]);

  const [linkToParent, setLinkToParent] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLinkToParent(detection.kind === "linked" && detection.confidence !== "suggested");
  }, [open, detection]);

  const linkedParent = detection.kind === "linked" && linkToParent ? detection.parent : null;

  const rowLinks = useMemo<RowLink[]>(() => {
    if (!linkedParent) return rows.map(() => ({ bucket: "new" as const, parentRow: null }));
    return rows.map((r) => linkRow(linkedParent, keyOf(r.data)));
  }, [rows, linkedParent, keyOf]);

  const bucketCounts = useMemo(() => countBuckets(rowLinks), [rowLinks]);

  const alreadyImportedIds = useMemo(
    () => rows.filter((_, i) => rowLinks[i]?.bucket === "resolved").map((r) => r.id),
    [rows, rowLinks],
  );

  const isDirty = useMemo(() => {
    if (phase.kind === "running" || phase.kind === "complete") return false;
    if (rows.length !== parsedRows.length) return true;
    return rows.some((r) => isRowEdited(r, COLUMNS));
  }, [rows, parsedRows.length, phase.kind, COLUMNS]);

  const effectiveRows = useMemo<ModuleRow[]>(() => rows.map((r) => r.data), [rows]);

  /* The home repo's own validator, run on every edit. */
  const validation = useMemo(
    () => def.validate(effectiveRows, validationContext ?? def.buildContext()),
    [effectiveRows, validationContext, def],
  );

  const rowsAnnotated = useMemo(
    () =>
      rows.map((r, i) => ({
        data: r.data,
        _id: r.id,
        _position: i + 1,
        _originalData: r.originalData,
        _status: validation.rows[i].status,
        _byField: validation.rows[i].byField,
        _isUpdate: validation.rows[i].isUpdate,
        _edited: isRowEdited(r, COLUMNS),
      })),
    [rows, validation, COLUMNS],
  );

  const validationMessagesByIdRef = useRef<Map<string, string[]>>(new Map());
  useEffect(() => {
    const m = new Map<string, string[]>();
    rows.forEach((r, i) => {
      const v = validation.rows[i];
      m.set(r.id, v ? v.issues.map((it) => it.message) : []);
    });
    validationMessagesByIdRef.current = m;
  }, [rows, validation]);

  const counts = useMemo(
    () => ({
      total: rowsAnnotated.length,
      errors: validation.errorRowCount,
      warnings: validation.warningRowCount,
      ready: validation.readyRowCount,
    }),
    [rowsAnnotated.length, validation],
  );

  const [tab, setTab] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);

  const [columnOrder, setColumnOrder] = useState<string[]>(() => COLUMNS.map((c) => c.key));
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    () => COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: col.defaultWidth }), {} as Record<string, number>),
  );
  /* A new module (the def) resets the grid layout. */
  useEffect(() => {
    setColumnOrder(COLUMNS.map((c) => c.key));
    setColumnWidths(COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: col.defaultWidth }), {} as Record<string, number>));
  }, [COLUMNS]);

  /* Header-menu Hide / Freeze (Inventory Movement pattern). Frozen columns
   * sit first in columnOrder and join the sticky block after Result; a drag
   * never crosses the freeze boundary. */
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => new Set());
  const [frozenCols, setFrozenCols] = useState<Set<string>>(() => new Set());
  const frozenColsRef = useRef(frozenCols);
  /* Column description tooltip, controlled so it never sits on top of an
   * open header menu. */
  const [descTipKey, setDescTipKey] = useState<string | null>(null);
  frozenColsRef.current = frozenCols;
  const visibleOrder = useMemo(() => columnOrder.filter((k) => !hiddenCols.has(k)), [columnOrder, hiddenCols]);
  const frozenLefts = useMemo(() => {
    const out: Record<string, number> = {};
    let left = ROW_NUM_WIDTH + SELECT_COL_WIDTH + STATUS_COL_WIDTH;
    for (const k of visibleOrder) {
      if (!frozenCols.has(k)) continue;
      out[k] = left;
      left += columnWidths[k] ?? 0;
    }
    return out;
  }, [visibleOrder, frozenCols, columnWidths]);
  const lastFrozenKey = useMemo(
    () => [...visibleOrder].reverse().find((k) => frozenCols.has(k)) ?? null,
    [visibleOrder, frozenCols],
  );
  const hideColumn = useCallback((key: string) => {
    setHiddenCols((prev) => new Set(prev).add(key));
    setFrozenCols((prev) => { const n = new Set(prev); n.delete(key); return n; });
    setSort((cur) => (cur?.key === key ? null : cur));
  }, []);
  const toggleFreeze = useCallback((key: string) => {
    const next = new Set(frozenColsRef.current);
    if (next.has(key)) next.delete(key); else next.add(key);
    setFrozenCols(next);
    setColumnOrder((prev) => {
      const rest = prev.filter((k) => k !== key);
      let lastFrozen = -1;
      rest.forEach((k, i) => { if (next.has(k)) lastFrozen = i; });
      rest.splice(lastFrozen + 1, 0, key);
      return rest;
    });
  }, []);

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

  const resizeRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null);

  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [hoveredHeaderKey, setHoveredHeaderKey] = useState<string | null>(null);

  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [isScrolledX, setIsScrolledX] = useState(false);
  const handleTableScroll = useCallback(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    setIsScrolledX(el.scrollLeft > 0);
  }, []);

  const resetPage = () => setCurrentPage(1);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rowsAnnotated.filter((r) => {
      if (tab === "errors" && r._status !== "error") return false;
      if (tab === "warnings" && r._status !== "warning") return false;
      if (tab === "ready" && r._status !== "ready") return false;
      if (!q) return true;
      return COLUMNS.some((c) => (r.data[c.key] ?? "").toLowerCase().includes(q));
    });
    if (sort) {
      const { key, dir } = sort;
      list = [...list].sort((a, b) => {
        const cmp = String(a.data[key] ?? "").localeCompare(String(b.data[key] ?? ""), undefined, { sensitivity: "base" });
        return dir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [rowsAnnotated, tab, search, sort, COLUMNS]);

  const totalPages = Number.isFinite(recordsPerPage)
    ? Math.max(1, Math.ceil(filteredRows.length / recordsPerPage))
    : 1;
  const pagedRows = useMemo(() => {
    if (!Number.isFinite(recordsPerPage)) return filteredRows;
    const start = (currentPage - 1) * recordsPerPage;
    return filteredRows.slice(start, start + recordsPerPage);
  }, [filteredRows, currentPage, recordsPerPage]);

  const handleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
    resetPage();
  };

  const colDef = useCallback((key: string) => COLUMNS.find((c) => c.key === key)!, [COLUMNS]);

  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidths[columnKey] ?? colDef(columnKey).defaultWidth;
    resizeRef.current = { columnKey, startX: e.clientX, startWidth };
    setIsResizing(true);
    setResizingColumnKey(columnKey);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = moveEvent.clientX - resizeRef.current.startX;
      const newWidth = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, resizeRef.current.startWidth + delta));
      setColumnWidths((prev) => ({ ...prev, [resizeRef.current!.columnKey]: newWidth }));
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      setResizingColumnKey(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [columnWidths, colDef]);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    if (isResizing) return;
    if (e.button !== 0) return;

    colDragRef.current = { columnKey, startX: e.clientX, startY: e.clientY, isDragging: false, lastSwapTime: 0 };

    const DRAG_THRESHOLD = 5;
    const SWAP_SETTLE_MS = 60;

    const onMove = (moveEvt: MouseEvent) => {
      if (!colDragRef.current) return;
      const dx = moveEvt.clientX - colDragRef.current.startX;
      const dy = moveEvt.clientY - colDragRef.current.startY;

      if (!colDragRef.current.isDragging) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        colDragRef.current.isDragging = true;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        setDraggingColumnKey(colDragRef.current.columnKey);
      }

      const ghost = ghostElRef.current;
      if (ghost) ghost.style.transform = `translate(${moveEvt.clientX}px, ${moveEvt.clientY}px)`;

      const now = performance.now();
      if (now - colDragRef.current.lastSwapTime < SWAP_SETTLE_MS) return;

      const cursorX = moveEvt.clientX;
      const draggedKey = colDragRef.current.columnKey;
      const draggedTh = document.querySelector<HTMLElement>(`th[data-col-drag-key="${CSS.escape(draggedKey)}"]`);
      if (!draggedTh) return;
      const draggedRect = draggedTh.getBoundingClientRect();
      if (cursorX >= draggedRect.left && cursorX <= draggedRect.right) return;

      const allThs = document.querySelectorAll<HTMLElement>("th[data-col-drag-key]");
      for (const th of allThs) {
        const rect = th.getBoundingClientRect();
        if (cursorX < rect.left || cursorX > rect.right) continue;
        const k = th.getAttribute("data-col-drag-key");
        if (!k || k === draggedKey) break;
        if (frozenColsRef.current.has(draggedKey) !== frozenColsRef.current.has(k)) break;
        setColumnOrder((prev) => {
          const srcIdx = prev.indexOf(draggedKey);
          const tgtIdx = prev.indexOf(k);
          if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return prev;
          const next = [...prev];
          next.splice(srcIdx, 1);
          next.splice(tgtIdx, 0, draggedKey);
          return next;
        });
        colDragRef.current.lastSwapTime = now;
        break;
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (colDragRef.current?.isDragging) {
        suppressNextClickRef.current = true;
        requestAnimationFrame(() => { suppressNextClickRef.current = false; });
      }
      colDragRef.current = null;
      setDraggingColumnKey(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [isResizing]);

  /* ── Edit + row state helpers ── */

  const commitEdit = useCallback((rowId: string, field: string, next: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId && r.data[field] !== next ? { ...r, data: { ...r.data, [field]: next } } : r)),
    );
  }, []);

  const deleteRows = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setRows((prev) => prev.filter((r) => !idSet.has(r.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setActiveCell((cur) => (cur && idSet.has(cur.rowId) ? null : cur));
    setEditingCell((cur) => (cur && idSet.has(cur.rowId) ? null : cur));
  }, []);

  const skipErrorRows = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setRows((prev) => {
      const retained: ModuleRow[] = [];
      const retainedMessages: string[][] = [];
      const next = prev.filter((r) => {
        if (idSet.has(r.id)) {
          retained.push({ ...r.data });
          retainedMessages.push(validationMessagesByIdRef.current.get(r.id) ?? []);
          return false;
        }
        return true;
      });
      if (retained.length > 0) {
        setSkippedRows((cur) => [...cur, ...retained]);
        skippedRowIssuesRef.current = [...skippedRowIssuesRef.current, ...retainedMessages];
      }
      return next;
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setActiveCell((cur) => (cur && idSet.has(cur.rowId) ? null : cur));
    setEditingCell((cur) => (cur && idSet.has(cur.rowId) ? null : cur));
    const count = ids.length;
    toast.info(`${count} ${count === 1 ? "row" : "rows"} skipped from this import`, {
      description:
        "These rows won't be imported now. They're kept available so you can fix and retry them from the import results.",
    });
  }, []);

  const duplicateRow = useCallback((rowId: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === rowId);
      if (idx < 0) return prev;
      const src = prev[idx];
      /* The key is the matching key, so a duplicate starts without one, like
       * the Users duplicate clears the email. */
      const dupData: ModuleRow = { ...src.data, [def.keyField]: "" };
      const dup: ManagedRow = { id: makeRowId(), data: dupData, originalData: { ...dupData } };
      return [...prev.slice(0, idx + 1), dup, ...prev.slice(idx + 1)];
    });
  }, [def.keyField]);

  const revertRow = useCallback((rowId: string) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, data: { ...r.originalData } } : r)));
  }, []);

  const bulkSetField = useCallback((ids: string[], field: string, value: string) => {
    const idSet = new Set(ids);
    setRows((prev) => prev.map((r) => (idSet.has(r.id) ? { ...r, data: { ...r.data, [field]: value } } : r)));
  }, []);

  const toggleRowSelected = useCallback((rowId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  }, []);

  const moveActiveCell = useCallback(
    (from: CellAddr, dir: NavDir, keepEditing: boolean) => {
      const visibleIds = pagedRows.map((r) => r._id);
      const fromVisibleIdx = visibleIds.indexOf(from.rowId);
      const colIdx = COLUMNS.findIndex((c) => c.key === from.field);
      let nextVisible = fromVisibleIdx;
      let nextCol = colIdx;
      if (dir === "right") {
        nextCol = colIdx + 1;
        if (nextCol >= COLUMNS.length) { nextCol = 0; nextVisible = fromVisibleIdx + 1; }
      } else if (dir === "left") {
        nextCol = colIdx - 1;
        if (nextCol < 0) { nextCol = COLUMNS.length - 1; nextVisible = fromVisibleIdx - 1; }
      } else if (dir === "down") {
        nextVisible = fromVisibleIdx + 1;
      } else if (dir === "up") {
        nextVisible = fromVisibleIdx - 1;
      }
      if (nextVisible < 0 || nextVisible >= visibleIds.length || fromVisibleIdx === -1) {
        if (!keepEditing) setEditingCell(null);
        return;
      }
      const next: CellAddr = { rowId: visibleIds[nextVisible], field: COLUMNS[nextCol].key };
      setActiveCell(next);
      setEditingCell(keepEditing ? next : null);
    },
    [pagedRows, COLUMNS],
  );

  const handleCellClick = useCallback((addr: CellAddr) => {
    setActiveCell(addr);
    setEditingCell(addr);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (editingCell || !activeCell) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
      switch (e.key) {
        case "ArrowRight": e.preventDefault(); moveActiveCell(activeCell, "right", false); break;
        case "ArrowLeft": e.preventDefault(); moveActiveCell(activeCell, "left", false); break;
        case "ArrowDown": e.preventDefault(); moveActiveCell(activeCell, "down", false); break;
        case "ArrowUp": e.preventDefault(); moveActiveCell(activeCell, "up", false); break;
        case "Enter": e.preventDefault(); setEditingCell(activeCell); break;
        case "Escape": e.preventDefault(); setActiveCell(null); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, activeCell, editingCell, moveActiveCell]);

  useEffect(() => {
    if (!editingCell) return;
    const visible = pagedRows.some((r) => r._id === editingCell.rowId);
    if (!visible) setEditingCell(null);
  }, [pagedRows, editingCell]);

  useEffect(() => {
    if (!open) return;
    if (!activeCell && !editingCell) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("td")) return;
      if (target.closest("[data-cell-dropdown]")) return;
      setActiveCell(null);
      setEditingCell(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, activeCell, editingCell]);

  /* ── Close handling ── */

  const attemptClose = useCallback(() => {
    if (phase.kind === "running") return;
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }, [phase.kind, isDirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pendingConfirm || phase.kind === "running" || phase.kind === "complete" || rowMenu || showDiscardConfirm) return;
      if (activeCell || editingCell) return;
      attemptClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, attemptClose, pendingConfirm, phase.kind, rowMenu, showDiscardConfirm, activeCell, editingCell]);

  /* ── Start-import flow (the Users run, 2400ms, same history + detail writes) ── */

  const runImport = useCallback(() => {
    if (counts.errors > 0) return;
    const total = rows.length;
    const warningCount = validation.warningRowCount;
    const skippedCount = skippedRows.length;

    const created: ModuleRow[] = [];
    const updated: ModuleRow[] = [];
    rows.forEach((r, i) => {
      const v = validation.rows[i];
      if (!v) return;
      if (v.isUpdate) updated.push({ ...r.data });
      else created.push({ ...r.data });
    });
    const skipped: ModuleRow[] = skippedRows.map((r) => ({ ...r }));

    let rowNumber = 0;
    const importedDetailRows: ModuleRecord[] = [];
    const pushDetailRow = (data: ModuleRow, outcome: RowOutcome, message?: string) => {
      rowNumber++;
      importedDetailRows.push(toModuleRecord(data, rowNumber, outcome, message));
    };
    for (const r of rows) pushDetailRow(r.data, "Created");
    skippedRows.forEach((r, i) => {
      const messages = skippedRowIssuesRef.current[i] ?? [];
      const message = messages.length > 0 ? messages.join(" ") : "Row was removed before import.";
      pushDetailRow(r, "Skipped", message);
    });

    setPhase({ kind: "running", processed: 0, total });

    const startedAt = performance.now();
    const durationMs = 2400;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const ratio = Math.min(1, elapsed / durationMs);
      const processed = Math.min(total, Math.floor(ratio * total));
      setPhase((cur) => (cur.kind === "running" ? { ...cur, processed } : cur));
      if (ratio < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const finishedAt = new Date().toISOString();
      const resolvedFileName = fileName || `${importName}.csv`;
      const importId = linkedParent ? `${linkedParent.id}-reimport-${Date.now()}` : `imp-${Date.now()}`;

      if (linkedParent) {
        const resolved = rows.flatMap((r, i) => {
          const link = rowLinks[i];
          if (!link || link.bucket !== "matched" || link.parentRow === null) return [];
          return [{ parentRow: link.parentRow, values: { ...r.data } }];
        });
        applyModuleCorrectionToParent(linkedParent.id, resolved);

        const parts: string[] = [];
        if (bucketCounts.matched > 0) parts.push(`${bucketCounts.matched} error row${bucketCounts.matched === 1 ? "" : "s"} fixed`);
        if (bucketCounts.new > 0) parts.push(`${bucketCounts.new} new row${bucketCounts.new === 1 ? "" : "s"}`);
        if (skippedCount > 0) parts.push(`${skippedCount} still failing`);

        addFixChildImport({
          id: importId,
          parentId: linkedParent.id,
          moduleSlug,
          name: importName,
          fileName: resolvedFileName,
          description: parts.join(", ") || "Re-imported from file",
          dateISO: finishedAt,
          importerKey: "am",
          recordCount: total + skippedCount,
          importedCount: total,
          failedCount: skippedCount,
          correctionKind: "reimport",
        });
        clearPendingCorrection(linkedParent.id);
      } else {
        addCompletedImport({
          id: importId,
          moduleSlug,
          name: importName,
          description: importDescription,
          fileName: resolvedFileName,
          dateISO: finishedAt,
          importerKey: "am",
          recordCount: total + skippedCount,
          importedCount: total,
          failedCount: skippedCount,
        });
      }

      saveModuleImport({
        id: importId,
        moduleSlug,
        name: importName,
        description: importDescription,
        dateISO: finishedAt,
        importerKey: "am",
        fileName: resolvedFileName,
        records: importedDetailRows,
      });
      /* Fold the kept rows into the module's existing records, the way the
       * Users host upserts the listing, so the next import of the same key
       * reads as an update. */
      def.applyImported(created, updated);
      onApplied?.({ created, updated, skipped, warningCount, importId });
      setPhase({
        kind: "complete",
        importId,
        createdCount: created.length,
        updatedCount: updated.length,
        warningCount,
        skippedCount,
        finishedAt,
        correctionParentId: linkedParent?.id ?? null,
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    counts.errors, importName, importDescription, fileName, moduleSlug, rows, validation,
    skippedRows, onApplied, linkedParent, rowLinks, bucketCounts, def,
  ]);

  const dismissCompletion = useCallback(
    (target: "history" | "records" | { kind: "detail"; filter: "imported" | "failed" }) => {
      const detailHref = phase.kind === "complete" ? `/company-settings/data-imports/${moduleSlug}/${phase.importId}` : null;
      const parentHref =
        phase.kind === "complete" && phase.correctionParentId
          ? `/company-settings/data-imports/${moduleSlug}/${phase.correctionParentId}`
          : null;
      onCompleted();
      if (target === "records" && detailHref) {
        /* "View Imported <Entities>": this import's record page, landing on
         * the rows it imported. Same tab, for the reason below. */
        navigate(`${detailHref}?filter=imported`);
      } else if (target === "history" && (parentHref ?? detailHref)) {
        /* Same tab, exactly as the Users dismissCompletion: a new tab reloads
         * the app, which runs the per-load history reset and drops the import
         * that was just created from the listing. */
        navigate((parentHref ?? detailHref) as string);
      } else if (typeof target === "object" && target.kind === "detail" && detailHref) {
        navigate(`${detailHref}?filter=${target.filter}`);
      }
    },
    [navigate, onCompleted, phase, moduleSlug],
  );

  const tabs: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "Show All", count: counts.total },
    { id: "ready", label: "Ready", count: counts.ready },
    { id: "errors", label: "Errors", count: counts.errors },
    { id: "warnings", label: "Warnings", count: counts.warnings },
  ];

  const bulkSetColumns = def.bulkSetFields
    .map((f) => COLUMNS.find((c) => c.key === f))
    .filter((c): c is ModuleColumn => !!c && editorOptions(def, c).length > 0);

  const updateText = `This row updates an existing ${def.noun}, matched by ${def.keyLabel.toLowerCase()}. This value will replace the ${def.noun}'s current value on import.`;
  const updateBadgeTitle = `${def.keyLabel} matches an existing ${def.noun}. This row will update that ${def.noun}.`;

  const renderColHeader = (
    key: string,
    opts: { sticky?: boolean; stickyLeft?: number; outerBoxShadow?: string } = {},
  ) => {
    const col = colDef(key);
    const sortActive = sort?.key === col.key;
    const dir = sort?.dir;
    const width = columnWidths[key] ?? col.defaultWidth;
    const draggable = true;
    const isBeingDragged = draggingColumnKey === key;
    const isActiveCol = activeCell?.field === col.key;
    const isHoveredHeader = hoveredHeaderKey === col.key;

    const bgStyle: React.CSSProperties = isActiveCol
      ? { backgroundColor: "#E8F2FF" }
      : isBeingDragged
        ? { background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)" }
        : isHoveredHeader
          ? { backgroundColor: "#F1F5F9" }
          : {};

    const textColor = isActiveCol ? "#0A77FF" : undefined;
    const sortIconColor = sortActive ? "#0A77FF" : isHoveredHeader ? "#64748B" : "#CBD5E1";

    return (
      <HeaderTh
        key={col.key}
        sticky={opts.sticky}
        stickyLeft={opts.stickyLeft}
        data-col-drag-key={col.key}
        onMouseDown={(e) => handleHeaderMouseDown(e, col.key)}
        onMouseEnter={() => setHoveredHeaderKey(col.key)}
        onMouseLeave={() => setHoveredHeaderKey((k) => (k === col.key ? null : k))}
        className={cn(draggable && "cursor-grab", "group/colheader")}
        extraStyle={{
          width,
          overflow: "hidden",
          position: "sticky",
          top: 0,
          ...(textColor ? { color: textColor } : null),
          ...(opts.outerBoxShadow ? { boxShadow: opts.outerBoxShadow } : null),
          ...bgStyle,
        }}
      >
        {isBeingDragged && (
          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "#0A77FF" }} />
        )}
        <GripVertical
          className={cn(
            "absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none",
            isBeingDragged ? "opacity-100 text-[#0A77FF]" : "opacity-0 group-hover/colheader:opacity-100 text-[#94A3B8]",
          )}
        />
        <div className="flex items-center justify-between gap-1 h-full pl-3 -ml-3">
          <Tooltip
            open={descTipKey === col.key}
            onOpenChange={(o) => {
              const menuOpen = !!document.querySelector(`th[data-col-drag-key="${col.key}"] button[aria-expanded="true"]`);
              setDescTipKey((cur) => (o && !menuOpen ? col.key : cur === col.key ? null : cur));
            }}
          >
            <TooltipTrigger asChild>
              <div className="flex-1 min-w-0 h-full flex items-center">
                <ImportColumnHeaderMenu
                  columnKey={col.key}
                  label={col.label}
                  sort={sort ? { key: sort.key, direction: sort.dir } : null}
                  onSort={(k, d) => {
                    setSort(d ? { key: k as string, dir: d } : null);
                    resetPage();
                  }}
                  onHide={(k) => hideColumn(k as string)}
                  isFrozen={frozenCols.has(col.key)}
                  onFreeze={(k) => toggleFreeze(k as string)}
                  labelColor={textColor}
                  labelStyle={{ fontSize: "12px", fontWeight: 500 }}
                  suppressClick={() => suppressNextClickRef.current}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              sideOffset={8}
              className="z-[200] max-w-[260px] bg-white border border-[#E2E8F0] text-[#0F172A] px-3 py-2 rounded-lg shadow-lg"
            >
              <div className="flex flex-col gap-1">
                <span style={{ fontSize: "12.5px", fontWeight: 600 }}>{col.label}</span>
                <span className="text-[#475569]" style={{ fontSize: "12px", lineHeight: 1.45 }}>
                  {col.description}
                </span>
              </div>
              <TooltipPrimitive.Arrow width={10} height={5} style={{ fill: "white", stroke: "#E2E8F0", strokeWidth: 1 }} />
            </TooltipContent>
          </Tooltip>
        </div>
        <div
          onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, col.key); }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setColumnWidths((prev) => ({ ...prev, [col.key]: col.defaultWidth }));
          }}
          className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
          style={{ touchAction: "none" }}
          title="Drag to resize · double-click to reset"
        >
          <div
            className={cn(
              "absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors",
              resizingColumnKey === col.key ? "bg-[#0A77FF]" : "bg-transparent group-hover/resize:bg-[#0A77FF]/40",
            )}
          />
        </div>
      </HeaderTh>
    );
  };

  if (!open) return null;

  return createPortal(
    <TooltipProvider delayDuration={200}>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150]"
              onClick={attemptClose}
            />

            <div className={cn(
              "fixed inset-0 z-[151] flex items-center justify-center pointer-events-none",
              isFullScreen ? "p-3 lg:p-4" : "p-4 sm:p-6"
            )}>
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 16 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "bg-white flex flex-col overflow-hidden pointer-events-auto transition-[max-width,max-height,width,height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  isFullScreen
                    ? "w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] h-[calc(100vh-1.5rem)] max-h-[calc(100vh-1.5rem)] rounded-2xl lg:w-[calc(100vw-2rem)] lg:max-w-[calc(100vw-2rem)] lg:h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2rem)]"
                    : "w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] max-h-[100dvh] rounded-2xl sm:w-[min(92vw,1280px)] sm:max-w-[min(92vw,1280px)] sm:h-auto sm:max-h-[80vh]"
                )}
                style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)" }}
              >
                {/* ─── Header ─── */}
                <div className="px-4 lg:px-6 py-4 shrink-0 bg-white border-b border-[#E2E8F0]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2
                        className="text-[#0F172A] truncate"
                        style={{ fontSize: "17px", fontWeight: 700 }}
                        title="Review and Fix Your Data"
                      >
                        Review and Fix Your Data
                      </h2>
                      <p className="text-[#64748B] mt-1" style={{ fontSize: "13px" }}>
                        Check your {nounPlural} before importing. Rows with errors will not be imported until you fix them. Rows with warnings will import as they are.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsFullScreen((v) => !v)}
                        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                        style={{ fontSize: "12px", fontWeight: 500 }}
                        aria-label={isFullScreen ? "Exit full view" : "Enter full view"}
                      >
                        {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        {isFullScreen ? "Exit Full View" : "Full View"}
                      </button>
                      <button
                        type="button"
                        onClick={attemptClose}
                        disabled={phase.kind === "running"}
                        className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <CorrectionBanner
                  detection={detection}
                  linked={linkToParent}
                  onLinkChange={setLinkToParent}
                  counts={bucketCounts}
                  alreadyImportedCount={alreadyImportedIds.length}
                  onRemoveAlreadyImported={() => deleteRows(alreadyImportedIds)}
                />

                {/* ─── Body ─── */}
                <div className="flex-1 min-h-0 flex flex-col bg-[#F8FAFC] overflow-hidden">
                  <div className="flex-1 min-h-0 flex flex-col mx-4 lg:mx-6 my-4 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
                    <div className="shrink-0 px-4 pt-3.5 pb-2 flex items-center justify-between gap-2">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#CBD5E1" }} />
                        <input
                          type="text"
                          placeholder="Search records..."
                          value={search}
                          onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                          className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-[#E2E8F0] shadow-sm rounded-md placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/20 transition-colors"
                        />
                        {search && (
                          <button
                            type="button"
                            onClick={() => { setSearch(""); resetPage(); }}
                            aria-label="Clear search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <DensityDropdown density={density} onChange={setDensity} />
                    </div>

                    {selectedIds.size > 0 ? (
                      /* Partners bulk-bar pattern. The wrapper pins the bar to the
                       * filter row's height (40px row + pb-3 + divider) so the
                       * swap never shifts the grid. */
                      <div className="shrink-0 [&>div]:h-[53px]">
                        <ImportSelectionBar
                          count={selectedIds.size}
                          noun="row"
                          onClear={() => setSelectedIds(new Set())}
                          actions={
                            <>
                          {bulkSetColumns.map((col) => (
                            <BulkSetDropdown
                              key={col.key}
                              label={`Set ${col.label}`}
                              options={editorOptions(def, col)}
                              onPick={(v) => bulkSetField(Array.from(selectedIds), col.key, v)}
                            />
                          ))}
                          <button
                            type="button"
                            onClick={() => setPendingConfirm({ ids: Array.from(selectedIds), reason: "delete-selected" })}
                            className={`${SELECTION_ACTION_BASE} ${SELECTION_ACTION_CLASS.destructive}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Rows</span>
                            <span className="opacity-80">({selectedIds.size})</span>
                          </button>
                            </>
                          }
                        />
                      </div>
                    ) : (
                      <div className="shrink-0 px-4 pb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 overflow-x-auto h-10">
                          {tabs.map((t) => (
                            <FilterChip
                              key={t.id}
                              label={t.label}
                              count={t.count}
                              tone={t.id === "errors" ? "red" : t.id === "warnings" ? "amber" : t.id === "ready" ? "green" : "blue"}
                              active={tab === t.id}
                              onClick={() => { setTab(t.id); resetPage(); }}
                            />
                          ))}
                        </div>
                        {counts.errors > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => {
                                  const errorIds = rowsAnnotated.filter((r) => r._status === "error").map((r) => r._id);
                                  skipErrorRows(errorIds);
                                }}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] hover:border-[#FCA5A5] transition-colors cursor-pointer shrink-0"
                                style={{ fontSize: "12.5px", fontWeight: 500 }}
                              >
                                <SkipForward className="w-3.5 h-3.5" />
                                Skip {counts.errors} error {counts.errors === 1 ? "row" : "rows"}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              sideOffset={8}
                              className="z-[200] max-w-[260px] bg-white border border-[#E2E8F0] text-[#0F172A] px-3 py-2 rounded-lg shadow-lg"
                            >
                              <span style={{ fontSize: "12.5px", lineHeight: 1.45 }}>
                                Excludes every row flagged as an error from this import. Skipped rows are kept for later review, valid rows still import.
                              </span>
                              <TooltipPrimitive.Arrow width={10} height={5} style={{ fill: "white", stroke: "#E2E8F0", strokeWidth: 1 }} />
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}

                    {/* The selection bar draws its own bottom border. */}
                    {selectedIds.size === 0 && <div className="shrink-0 border-t border-[#E2E8F0]" />}

                    <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden relative">
                      <AnimatePresence>
                        {phase.kind === "running" && (
                          <motion.div
                            key="import-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="absolute inset-0 z-30 flex items-center justify-center bg-white/50 backdrop-blur-[1px] pointer-events-auto"
                          >
                            <div
                              className="flex flex-col items-center gap-3 px-6 py-5 rounded-2xl bg-white border border-[#E2E8F0]"
                              style={{ boxShadow: "0 24px 48px -12px rgba(15,23,42,0.18)" }}
                            >
                              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#0A77FF" }} />
                              <p className="text-[#0F172A]" style={{ fontSize: "14px", fontWeight: 600 }}>
                                Importing {phase.total} {phase.total === 1 ? def.noun : def.nounPlural}...
                              </p>
                              <p className="text-[#64748B] tabular-nums" style={{ fontSize: "12.5px" }}>
                                Importing... {phase.processed} of {phase.total} {def.nounPlural} processed
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div
                        ref={tableScrollRef}
                        onScroll={handleTableScroll}
                        className={cn("flex-1 min-h-0 overflow-auto", (isResizing || draggingColumnKey) && "select-none")}
                        style={{ scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}
                      >
                        <DensityContext.Provider value={density}>
                          <table
                            className="border-separate"
                            style={{ borderSpacing: 0, tableLayout: "fixed", width: "max-content", minWidth: "100%" }}
                          >
                            <colgroup>
                              <col style={{ width: ROW_NUM_WIDTH }} />
                              <col style={{ width: SELECT_COL_WIDTH }} />
                              <col style={{ width: STATUS_COL_WIDTH }} />
                              {visibleOrder.map((key) => (
                                <col key={key} style={{ width: columnWidths[key] ?? colDef(key).defaultWidth }} />
                              ))}
                              <col style={{ width: ACTIONS_COL_WIDTH }} />
                            </colgroup>
                            <thead>
                              <tr>
                                <HeaderTh
                                  sticky
                                  stickyLeft={0}
                                  extraStyle={{ width: ROW_NUM_WIDTH, backgroundColor: "#FFFFFF", textAlign: "right", paddingLeft: 4, paddingRight: 8 }}
                                >
                                  <span style={{ color: "#94A3B8" }}>#</span>
                                </HeaderTh>
                                <HeaderTh
                                  sticky
                                  stickyLeft={ROW_NUM_WIDTH}
                                  extraStyle={{ width: SELECT_COL_WIDTH, backgroundColor: "#F8FAFC", textAlign: "center", paddingLeft: 0, paddingRight: 0 }}
                                >
                                  <span className="flex items-center justify-center">
                                    <Checkbox
                                      aria-label="Select all rows on page"
                                      className="data-[state=checked]:bg-[#0A77FF] data-[state=checked]:border-[#0A77FF] data-[state=checked]:text-white data-[state=indeterminate]:bg-[#0A77FF] data-[state=indeterminate]:border-[#0A77FF] data-[state=indeterminate]:text-white"
                                      checked={
                                        pagedRows.length > 0 && pagedRows.every((r) => selectedIds.has(r._id))
                                          ? true
                                          : pagedRows.some((r) => selectedIds.has(r._id))
                                            ? "indeterminate"
                                            : false
                                      }
                                      onCheckedChange={(checked) => {
                                        setSelectedIds((prev) => {
                                          const next = new Set(prev);
                                          if (checked) for (const r of pagedRows) next.add(r._id);
                                          else for (const r of pagedRows) next.delete(r._id);
                                          return next;
                                        });
                                      }}
                                    />
                                  </span>
                                </HeaderTh>
                                <HeaderTh
                                  sticky
                                  stickyLeft={ROW_NUM_WIDTH + SELECT_COL_WIDTH}
                                  extraStyle={{
                                    width: STATUS_COL_WIDTH,
                                    backgroundColor: "#F8FAFC",
                                    textAlign: "left",
                                    boxShadow: isScrolledX && !lastFrozenKey ? FROZEN_RIGHT_SHADOW : undefined,
                                  }}
                                >
                                  Result
                                </HeaderTh>
                                {visibleOrder.map((key) =>
                              renderColHeader(
                                key,
                                frozenCols.has(key)
                                  ? {
                                      sticky: true,
                                      stickyLeft: frozenLefts[key],
                                      outerBoxShadow: key === lastFrozenKey && isScrolledX ? FROZEN_RIGHT_SHADOW : undefined,
                                    }
                                  : {},
                              ),
                            )}
                                <HeaderTh
                                  sticky
                                  stickyLeft={undefined}
                                  extraStyle={{
                                    width: ACTIONS_COL_WIDTH,
                                    minWidth: ACTIONS_COL_WIDTH,
                                    maxWidth: ACTIONS_COL_WIDTH,
                                    backgroundColor: "#F8FAFC",
                                    textAlign: "left",
                                    right: 0,
                                    position: "sticky",
                                    paddingLeft: 8,
                                    paddingRight: 8,
                                    fontWeight: 500,
                                    color: "#334155",
                                    boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)",
                                  }}
                                >
                                  <span className="text-[13px]">Actions</span>
                                </HeaderTh>
                              </tr>
                            </thead>
                            <tbody>
                              {pagedRows.length === 0 ? null : (
                                pagedRows.map((row, rowIdx) => {
                                  const selected = selectedIds.has(row._id);
                                  const isActiveRow = activeCell?.rowId === row._id;
                                  const isHoveredRow = hoveredRowId === row._id;
                                  const isZebra = rowIdx % 2 === 1;
                                  const rowBg = isActiveRow ? "#E8F2FF"
                                    : isHoveredRow ? "#F1F5F9"
                                    : selected ? "#EFF6FF"
                                    : isZebra ? "#F8FAFC"
                                    : "#FFFFFF";
                                  const rowNum = row._position;
                                  const isErrorRow = row._status === "error";
                                  const rowNumColor = isActiveRow ? "#0A77FF" : isErrorRow ? "#DC2626" : "#94A3B8";
                                  const rowNumWeight = isActiveRow ? 600 : isErrorRow ? 500 : 400;

                                  return (
                                    <tr
                                      key={row._id}
                                      className="group import-row-hover"
                                      onMouseEnter={() => setHoveredRowId(row._id)}
                                      onMouseLeave={() => setHoveredRowId((id) => (id === row._id ? null : id))}
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        setRowMenu({ rowId: row._id, x: e.clientX, y: e.clientY });
                                      }}
                                    >
                                      <BodyTd
                                        sticky
                                        tinted={isActiveRow}
                                        stickyLeft={0}
                                        extraStyle={{
                                          width: ROW_NUM_WIDTH,
                                          backgroundColor: rowBg,
                                          color: rowNumColor,
                                          fontWeight: rowNumWeight,
                                          textAlign: "right",
                                          paddingRight: 8,
                                          paddingLeft: 4,
                                          fontVariantNumeric: "tabular-nums",
                                        }}
                                      >
                                        {rowNum}
                                      </BodyTd>
                                      <BodyTd
                                        sticky
                                        tinted={isActiveRow}
                                        stickyLeft={ROW_NUM_WIDTH}
                                        extraStyle={{ width: SELECT_COL_WIDTH, backgroundColor: rowBg, textAlign: "center", paddingLeft: 0, paddingRight: 0 }}
                                      >
                                        <span className="flex items-center justify-center">
                                          <Checkbox
                                            aria-label={`Select row ${rowNum}`}
                                            className="data-[state=checked]:bg-[#0A77FF] data-[state=checked]:border-[#0A77FF] data-[state=checked]:text-white"
                                            checked={selected}
                                            onCheckedChange={(c) => toggleRowSelected(row._id, c === true)}
                                          />
                                        </span>
                                      </BodyTd>
                                      <BodyTd
                                        sticky
                                        tinted={isActiveRow}
                                        stickyLeft={ROW_NUM_WIDTH + SELECT_COL_WIDTH}
                                        extraStyle={{
                                          width: STATUS_COL_WIDTH,
                                          backgroundColor: rowBg,
                                          textAlign: "left",
                                          boxShadow: isScrolledX && !lastFrozenKey ? FROZEN_RIGHT_SHADOW : undefined,
                                        }}
                                      >
                                        <span className="inline-flex items-center gap-1.5">
                                          <StatusChip status={row._status} />
                                          {row._isUpdate && <RowOpBadge title={updateBadgeTitle} />}
                                          {row._status === "error" && (
                                            <AlertTriangle aria-hidden strokeWidth={2.5} style={{ width: 13, height: 13, color: "#DC2626" }} />
                                          )}
                                        </span>
                                      </BodyTd>
                                      {visibleOrder.map((key) => {
                                        const col = colDef(key);
                                        const val = String(row.data[col.key] ?? "");
                                        const cellIssues = row._byField[col.key] as unknown as CellIssue[] | undefined;
                                        const cellSeverity = cellIssues?.some((i) => i.severity === "error")
                                          ? "error"
                                          : cellIssues?.some((i) => i.severity === "warning")
                                            ? "warning"
                                            : null;
                                        const addr: CellAddr = { rowId: row._id, field: col.key };
                                        const isEditing = isSameCell(editingCell, addr);
                                        const isActive = isSameCell(activeCell, addr);
                                        const originalVal = String(row._originalData[col.key] ?? "");
                                        const isEdited = val !== originalVal;
                                        const isDraggedCol = draggingColumnKey === col.key;
                                        /* Update rows: every non-blank value overwrites the
                                         * matched record's field; the key is the matching key
                                         * and is never written. */
                                        const isUpdateCell = row._isUpdate && col.key !== def.keyField && val.trim() !== "" && !cellSeverity;
                                        return (
                                          <EditableDataCell
                                            key={col.key}
                                            addr={addr as never}
                                            value={val}
                                            originalValue={originalVal}
                                            issues={cellIssues}
                                            severity={cellSeverity}
                                            isUpdateCell={isUpdateCell}
                                            isEditing={isEditing}
                                            isActive={isActive}
                                            isEdited={isEdited}
                                            width={columnWidths[key] ?? col.defaultWidth}
                                            rowBg={rowBg}
                                            tinted={isActiveRow}
                                            sticky={frozenCols.has(key)}
                                            stickyLeft={frozenLefts[key]}
                                            outerBoxShadow={key === lastFrozenKey && isScrolledX ? FROZEN_RIGHT_SHADOW : undefined}
                                            cellBg={isDraggedCol ? "rgba(10,119,255,0.035)" : undefined}
                                            searchQuery={search}
                                            onClick={() => handleCellClick(addr)}
                                            onCommit={(next, dir) => {
                                              commitEdit(addr.rowId, addr.field, next);
                                              if (dir) moveActiveCell(addr, dir, true);
                                              else setEditingCell(null);
                                            }}
                                            onCancel={() => setEditingCell(null)}
                                            renderInput={renderModuleCellEditor(def, col, row.data as ModuleRow)}
                                            describe={describeModuleIssue}
                                            updateText={updateText}
                                          />
                                        );
                                      })}
                                      <BodyTd
                                        sticky
                                        tinted={isActiveRow}
                                        extraStyle={{
                                          width: ACTIONS_COL_WIDTH,
                                          minWidth: ACTIONS_COL_WIDTH,
                                          maxWidth: ACTIONS_COL_WIDTH,
                                          backgroundColor: rowBg,
                                          right: 0,
                                          textAlign: "left",
                                          paddingLeft: 8,
                                          paddingRight: 8,
                                          boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)",
                                        }}
                                      >
                                        <RowActionsButton
                                          edited={row._edited}
                                          isError={isErrorRow}
                                          onDelete={() => deleteRows([row._id])}
                                          onDuplicate={() => duplicateRow(row._id)}
                                          onRevert={() => revertRow(row._id)}
                                          onSkip={() => skipErrorRows([row._id])}
                                        />
                                      </BodyTd>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </DensityContext.Provider>

                        {pagedRows.length === 0 && phase.kind !== "running" && (
                          <div className="sticky left-0" style={{ width: "100%", maxWidth: "100vw" }}>
                            <GridEmptyState
                              rowsTotal={rows.length}
                              searchActive={search.trim().length > 0}
                              tab={tab}
                              tabCount={
                                tab === "errors" ? counts.errors
                                : tab === "warnings" ? counts.warnings
                                : tab === "ready" ? counts.ready
                                : counts.total
                              }
                              onClearSearch={() => { setSearch(""); resetPage(); }}
                              onCancelImport={attemptClose}
                            />
                          </div>
                        )}
                      </div>

                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        recordsPerPage={recordsPerPage}
                        onRecordsPerPageChange={(n) => { setRecordsPerPage(n); resetPage(); }}
                        pageSizeOptions={[20, 50, 100]}
                        allowAll
                      />
                    </div>
                  </div>
                </div>

                {/* ─── Footer ─── */}
                <div className="shrink-0 border-t border-[#E2E8F0] bg-white px-4 lg:px-6 py-2.5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={attemptClose}
                    disabled={phase.kind === "running"}
                    className={cn(
                      "inline-flex items-center justify-center h-9 px-4 rounded-md border border-[#E2E8F0] bg-white text-[#334155] shadow-sm transition-colors",
                      phase.kind === "running" ? "opacity-50 cursor-not-allowed" : "hover:bg-[#F8FAFC] hover:border-[#CBD5E1] cursor-pointer",
                    )}
                    style={{ fontSize: "13px", fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                  <StartImportButton errorCount={counts.errors} running={phase.kind === "running"} onStart={runImport} />
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {rowMenu && (() => {
        const menuRow = rowsAnnotated.find((r) => r._id === rowMenu.rowId);
        if (!menuRow) return null;
        return (
          <FloatingRowContextMenu
            position={{ x: rowMenu.x, y: rowMenu.y }}
            edited={menuRow._edited}
            isError={menuRow._status === "error"}
            onClose={() => setRowMenu(null)}
            onDelete={() => deleteRows([menuRow._id])}
            onDuplicate={() => duplicateRow(menuRow._id)}
            onRevert={() => revertRow(menuRow._id)}
            onSkip={() => skipErrorRows([menuRow._id])}
          />
        );
      })()}

      <BulkDeleteConfirm
        confirm={pendingConfirm}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={(ids) => {
          deleteRows(ids);
          setPendingConfirm(null);
        }}
      />

      {phase.kind === "complete" && (
        <ImportCompleteDialog
          createdCount={phase.createdCount}
          updatedCount={phase.updatedCount}
          skippedCount={phase.skippedCount}
          warningCount={phase.warningCount}
          entityLabel={def.entities}
          primaryLabel={`View Imported ${def.entities}`}
          historyLabel={phase.correctionParentId ? "View Original Import" : undefined}
          onViewHistory={() => dismissCompletion("history")}
          onGoToUsers={() => dismissCompletion("records")}
          onViewDetail={(filter) => dismissCompletion({ kind: "detail", filter })}
        />
      )}

      <DiscardConfirmModal
        open={showDiscardConfirm}
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
      />

      <div
        ref={ghostElRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 9999,
          pointerEvents: "none",
          opacity: draggingColumnKey ? 1 : 0,
          transition: "opacity 80ms ease-out",
          willChange: "transform",
        }}
      >
        {draggingColumnKey && (
          <div
            className="flex items-center gap-1.5 h-[32px] pl-2 pr-3 rounded-md whitespace-nowrap"
            style={{
              marginLeft: 12,
              marginTop: -14,
              backgroundColor: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(10,119,255,0.3)",
              boxShadow: "0 1px 3px rgba(10,119,255,0.08), 0 6px 20px rgba(0,0,0,0.10)",
            }}
          >
            <GripVertical className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />
            <span className="text-[13px]" style={{ color: "#0A77FF", fontWeight: 500 }}>
              {colDef(draggingColumnKey)?.label}
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>,
    document.body,
  );
}
