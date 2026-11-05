/* "Review and Fix Your Data": the editable review grid over the 39 import
 * columns (port of role-zen's import-review/ImportReviewModal.tsx,
 * parameterised by ITEMS_IMPORT_SPEC). Second portal over the wizard
 * (z 150/151), Full View by default, whole-grid revalidation after every
 * edit, skip / duplicate / revert / delete row actions, bulk set + delete,
 * the 2400 ms importing ramp, the Import Complete dialog, history + detail
 * persistence, correction linking and the store upsert on completion. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronsUpDown,
  CircleX,
  Copy,
  GripVertical,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  RotateCcw,
  Search,
  SearchX,
  SkipForward,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useItems } from "@/app/context/ItemsContext";
import { ITEMS_IMPORT_SPEC, splitList, type EntitySpec, type ItemReviewField, type ItemReviewRow, type SpecColumn } from "./spec";
import { BulkSetDropdown, ImportSelectionBar, SELECTION_ACTION_BASE, SELECTION_ACTION_CLASS } from "./SelectionBar";
import { buildValidationContext, validateRows, type CellIssue, type RowStatus, type ValidationContext } from "./validation";
import {
  addFixChildImport,
  applyCorrectionToParent,
  clearPendingCorrection,
  CURRENT_IMPORTER_KEY,
  detectCorrectionTarget,
  linkRow,
  MODULE_SLUG,
  newImportId,
  recordCompletedImport,
  reimportChildId,
  saveImportDetail,
  toImportedItemRow,
  type ImportedItemRow,
} from "./importHistory";
import { setImportNotice } from "./importNotice";
import { DensityContext, DensityDropdown, ROW_HEIGHT_COMFORT, ROW_HEIGHT_CONDENSED, useDensity, type Density } from "./density";
import { Pagination } from "./Pagination";
import { HighlightMatch } from "./HighlightMatch";
import { CellIssueTooltip, EditedIndicator, RowOpBadge, StatusChip, UpdateCellTooltip, CELL_FONT } from "./CellIssueTooltip";
import { CellInput, type CommitDir } from "./cellEditors";
import { CorrectionBanner } from "./CorrectionBanner";
import { IssuesBanner, type ReviewIssue } from "./IssuesBanner";
import { SkipRowsConfirm } from "./SkipRowsConfirm";
import { ConfirmDialog, ImportCompleteDialog, type CompleteDetailFilter } from "./dialogs";
import { RequiredPill } from "./RequiredPill";
import { headerMinWidth } from "./headerWidth";
import { formatNumberDisplay } from "./numberDisplay";

/* ─── Constants ─── */

const ROW_NUM_WIDTH = 36;
const SELECT_COL_WIDTH = 40;
const STATUS_COL_WIDTH = 150;
const ACTIONS_COL_WIDTH = 72;
const FROZEN_RIGHT_SHADOW = "4px 0 8px rgba(0,0,0,0.06)";
const ACTIONS_SEAM = "inset 1px 0 0 0 rgba(0,0,0,0.08)";
const MIN_COL_WIDTH = 80;
const SORT_ICON_SPACE = 16;
const MAX_COL_WIDTH = 255 * 7;
const DRAG_THRESHOLD = 5;
const IMPORT_DURATION_MS = 2400;
const DISCARD_MESSAGE = "Your fixes on this screen will not be saved.";

/* ─── Types ─── */

export interface ImportOutcome {
  created: ItemReviewRow[];
  updated: ItemReviewRow[];
  skipped: ItemReviewRow[];
  importId: string;
}

export interface ImportReviewModalProps {
  open: boolean;
  importName: string;
  importDescription: string;
  fileName: string;
  parsedRows: ItemReviewRow[];
  sessionParentId?: string | null;
  /** Fix Failed Rows on an import's record page: the parent row of each parsed
   *  row (same order). The review stays linked to `sessionParentId`, each row
   *  closes out its own parent row, and the run nests under that import. */
  fixParentRows?: number[] | null;
  validationContext?: ValidationContext;
  onClose: () => void;
  onApplied?: (outcome: ImportOutcome) => void;
  onCompleted: () => void;
  spec?: EntitySpec;
}

interface ManagedRow {
  id: string;
  data: ItemReviewRow;
  /** Original uploaded values, used for revert and for the edited-cell triangle. */
  originalData: ItemReviewRow;
  /** Fix Failed Rows: the row of the parent import this row came from. */
  parentRow?: number;
}

type StatusFilter = "all" | "errors" | "ready";
interface CellAddr {
  rowId: string;
  field: ItemReviewField;
}
type ImportPhase =
  | { kind: "idle" }
  | { kind: "running"; processed: number; total: number }
  | {
      kind: "complete";
      importId: string;
      createdCount: number;
      updatedCount: number;
      skippedCount: number;
      correctionParentId: string | null;
    };

function makeRowId(): string {
  return `r-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}
function makeInitialRows(source: ItemReviewRow[], parentRows?: number[] | null): ManagedRow[] {
  return source.map((r, i) => ({ id: makeRowId(), data: { ...r }, originalData: { ...r }, parentRow: parentRows?.[i] }));
}
function isRowEdited(r: ManagedRow, keys: ItemReviewField[]): boolean {
  return keys.some((k) => r.data[k] !== r.originalData[k]);
}

/* ─── Chip tones ─── */

const CHIP_ACTIVE_TONES = {
  blue: { border: "#0A77FF", bg: "#EDF4FF", text: "#0A77FF", badgeBg: "rgba(10,119,255,0.1)", badgeText: "#0A77FF" },
  red: { border: "#FCA5A5", bg: "#FEF2F2", text: "#B91C1C", badgeBg: "rgba(220,38,38,0.10)", badgeText: "#B91C1C" },
  amber: { border: "#FCD34D", bg: "#FFFBEB", text: "#B45309", badgeBg: "rgba(180,83,9,0.12)", badgeText: "#B45309" },
  green: { border: "#86EFAC", bg: "#ECFDF5", text: "#047857", badgeBg: "rgba(4,120,87,0.12)", badgeText: "#047857" },
} as const;
type ChipTone = keyof typeof CHIP_ACTIVE_TONES;

export function FilterChip({ label, count, tone, active, onClick }: { label: string; count: number; tone: ChipTone; active: boolean; onClick: () => void }) {
  const t = CHIP_ACTIVE_TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
        active ? "" : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] hover:border-[#CBD5E1]"
      }`}
      style={{ fontSize: "12px", fontWeight: active ? 500 : 400, ...(active ? { borderColor: t.border, backgroundColor: t.bg, color: t.text } : {}) }}
    >
      {label}
      <span
        className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full tabular-nums ${active ? "" : "bg-[#F1F5F9] text-[#475569]"}`}
        style={{ fontSize: "10px", fontWeight: 600, ...(active ? { backgroundColor: t.badgeBg, color: t.badgeText } : {}) }}
      >
        {count}
      </span>
    </button>
  );
}

/* ─── The modal ─── */

export function ImportReviewModal({
  open,
  importName,
  importDescription,
  fileName,
  parsedRows,
  sessionParentId = null,
  fixParentRows = null,
  validationContext,
  onClose,
  onApplied,
  onCompleted,
  spec = ITEMS_IMPORT_SPEC,
}: ImportReviewModalProps) {
  const navigate = useNavigate();
  const { items, upsertImportedItems } = useItems();
  const columns = spec.columns;
  const columnKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const keyColumn = spec.keyColumn;
  const { singular, plural, titlePlural } = spec.nouns;

  /* State */
  const [rows, setRows] = useState<ManagedRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<ItemReviewRow[]>([]);
  const skippedRowIssuesRef = useRef<string[][]>([]);
  /* The skipped rows as they were in the grid, with their index, for "Undo skipped rows". */
  const skippedManagedRef = useRef<{ row: ManagedRow; index: number }[]>([]);
  /* "Skip N error rows" (strip or row menu) waits on SkipRowsConfirm. */
  const [pendingSkip, setPendingSkip] = useState<{ ids: string[] } | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [density, setDensity] = useState<Density>("condensed");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<{ key: ItemReviewField; dir: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeCell, setActiveCell] = useState<CellAddr | null>(null);
  const [editingCell, setEditingCell] = useState<CellAddr | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ ids: string[] } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ rowId: string; x: number; y: number } | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [phase, setPhase] = useState<ImportPhase>({ kind: "idle" });
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [hoveredHeaderKey, setHoveredHeaderKey] = useState<ItemReviewField | null>(null);
  const [columnOrder, setColumnOrder] = useState<ItemReviewField[]>(columnKeys);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [isResizing, setIsResizing] = useState(false);
  const [draggingColumnKey, setDraggingColumnKey] = useState<ItemReviewField | null>(null);
  const [isScrolledX, setIsScrolledX] = useState(false);
  const [linkToParent, setLinkToParent] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const ghostElRef = useRef<HTMLDivElement | null>(null);
  const suppressNextClickRef = useRef(false);
  const validationCtxRef = useRef<ValidationContext | null>(null);
  const rafRef = useRef(0);

  const resetPage = useCallback(() => setCurrentPage(1), []);

  /* Correction detection (once per open) */
  const detection = useMemo(() => {
    if (!open) return { kind: "none" as const };
    return detectCorrectionTarget({ moduleSlug: MODULE_SLUG, sessionParentId, rowKeys: parsedRows.map((r) => r[keyColumn] ?? "") });
  }, [open, sessionParentId, parsedRows, keyColumn]);

  /* Reset on open */
  useEffect(() => {
    if (!open) return;
    setRows(makeInitialRows(parsedRows, fixParentRows));
    setSkippedRows([]);
    skippedManagedRef.current = [];
    setPendingSkip(null);
    skippedRowIssuesRef.current = [];
    setIsFullScreen(true);
    setDensity("condensed");
    setSearch("");
    setTab("all");
    setSort(null);
    setCurrentPage(1);
    setRecordsPerPage(100);
    setSelectedIds(new Set());
    setActiveCell(null);
    setEditingCell(null);
    setPendingConfirm(null);
    setRowMenu(null);
    setShowDiscardConfirm(false);
    setPhase({ kind: "idle" });
    setColumnOrder(columnKeys);
    setColumnWidths({});
    setLinkToParent(detection.kind === "linked" && (!!fixParentRows || detection.confidence === "session"));
    validationCtxRef.current = validationContext ?? buildValidationContext(items, spec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, parsedRows]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /* Validation (whole grid, every change) */
  const effectiveRows = useMemo(() => rows.map((r) => r.data), [rows]);
  const validation = useMemo(
    () => validateRows(effectiveRows, validationCtxRef.current ?? validationContext ?? {}, spec),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveRows, spec],
  );

  const rowsAnnotated = useMemo(
    () =>
      rows.map((r, i) => {
        const v = validation.rows[i];
        return {
          ...r.data,
          _id: r.id,
          /* Fix Failed Rows numbers each row as the import's record page does. */
          _position: r.parentRow ?? i + 1,
          _originalData: r.originalData,
          _status: v?.status ?? ("ready" as RowStatus),
          _byField: v?.byField ?? {},
          _isUpdate: v?.isUpdate ?? false,
          _edited: isRowEdited(r, columnKeys),
        };
      }),
    [rows, validation, columnKeys],
  );
  type AnnotatedRow = (typeof rowsAnnotated)[number];

  const validationMessagesByIdRef = useRef<Map<string, string[]>>(new Map());
  useEffect(() => {
    const m = new Map<string, string[]>();
    rows.forEach((r, i) => m.set(r.id, (validation.rows[i]?.issues ?? []).map((iss) => iss.message)));
    validationMessagesByIdRef.current = m;
  }, [rows, validation]);

  const counts = {
    total: rowsAnnotated.length,
    errors: validation.errorRowCount,
    ready: validation.readyRowCount,
  };

  /* Correction link buckets */
  const linkedParent = linkToParent && detection.kind === "linked" ? detection.parent : null;
  /* Fix Failed Rows links by row, so a fixed key still closes out its own row. */
  const rowLinks = useMemo(
    () => (linkedParent ? rows.map((r) => (r.parentRow !== undefined ? { bucket: "matched" as const, parentRow: r.parentRow } : linkRow(linkedParent, r.data[keyColumn] ?? ""))) : null),
    [linkedParent, rows, keyColumn],
  );
  const bucketCounts = useMemo(() => {
    const c = { matched: 0, resolved: 0, new: 0 };
    rowLinks?.forEach((l) => c[l.bucket]++);
    return c;
  }, [rowLinks]);
  const alreadyImportedIds = useMemo(() => (rowLinks ? rows.filter((_, i) => rowLinks[i].bucket === "resolved").map((r) => r.id) : []), [rowLinks, rows]);

  /* Tags seen across the file, offered by the multi-select editor */
  const tagOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) for (const t of splitList(r.data.tags ?? "")) if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
    return [...seen.values()];
  }, [rows]);

  /* Filter / search / sort / page */
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rowsAnnotated.filter((r) => {
      if (tab === "errors" && r._status !== "error") return false;
      if (tab === "ready" && r._status !== "ready") return false;
      if (!q) return true;
      return columnKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q));
    });
  }, [rowsAnnotated, tab, search, columnKeys]);

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    const { key, dir } = sort;
    return [...filteredRows].sort((a, b) => {
      const c = String(a[key] ?? "").localeCompare(String(b[key] ?? ""), undefined, { sensitivity: "base" });
      return dir === "asc" ? c : -c;
    });
  }, [filteredRows, sort]);

  const totalPages = Number.isFinite(recordsPerPage) ? Math.max(1, Math.ceil(sortedRows.length / recordsPerPage)) : 1;
  const safePage = Math.min(currentPage, totalPages);
  const pagedRows = useMemo(
    () => (Number.isFinite(recordsPerPage) ? sortedRows.slice((safePage - 1) * recordsPerPage, safePage * recordsPerPage) : sortedRows),
    [sortedRows, safePage, recordsPerPage],
  );

  /* Jump from the issue strip: make the row visible (filters, search, page), then scroll to the
   * cell, select it and outline it for a moment so the landing spot is obvious. */
  const [pendingJump, setPendingJump] = useState<CellAddr | null>(null);
  useEffect(() => {
    if (!pendingJump) return;
    const idx = sortedRows.findIndex((r) => r._id === pendingJump.rowId);
    if (idx < 0) return setPendingJump(null);
    const page = Number.isFinite(recordsPerPage) ? Math.floor(idx / recordsPerPage) + 1 : 1;
    if (page !== safePage) return setCurrentPage(page);
    const target = pendingJump;
    setPendingJump(null);
    setActiveCell(target);
    requestAnimationFrame(() => {
      const td = tableScrollRef.current?.querySelector<HTMLElement>(`[data-cell="${CSS.escape(`${target.rowId}::${target.field}`)}"]`);
      if (!td) return;
      td.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      td.style.outline = "2px solid #60A5FA";
      td.style.outlineOffset = "-2px";
      window.setTimeout(() => {
        td.style.outline = "";
        td.style.outlineOffset = "";
      }, 1200);
    });
  }, [pendingJump, sortedRows, recordsPerPage, safePage]);

  const handleSort = (key: ItemReviewField) => {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: "asc" };
      if (cur.dir === "asc") return { key, dir: "desc" };
      return null;
    });
    resetPage();
  };

  /* Mutations */
  const commitEdit = useCallback((rowId: string, field: ItemReviewField, next: string) => {
    setRows((prev) => prev.map((r) => (r.id === rowId && r.data[field] !== next ? { ...r, data: { ...r.data, [field]: next } } : r)));
  }, []);

  const cleanupAfterRemoval = useCallback((ids: Set<string>) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setActiveCell((c) => (c && ids.has(c.rowId) ? null : c));
    setEditingCell((c) => (c && ids.has(c.rowId) ? null : c));
  }, []);

  const deleteRows = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const set = new Set(ids);
      setRows((prev) => prev.filter((r) => !set.has(r.id)));
      cleanupAfterRemoval(set);
    },
    [cleanupAfterRemoval],
  );

  const skipErrorRows = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const set = new Set(ids);
      const skipped: ItemReviewRow[] = [];
      const issues: string[][] = [];
      const managed: { row: ManagedRow; index: number }[] = [];
      rows.forEach((r, index) => {
        if (!set.has(r.id)) return;
        skipped.push({ ...r.data });
        issues.push(validationMessagesByIdRef.current.get(r.id) ?? []);
        managed.push({ row: r, index });
      });
      if (skipped.length === 0) return;
      setRows(rows.filter((r) => !set.has(r.id)));
      setSkippedRows((s) => [...s, ...skipped]);
      skippedRowIssuesRef.current = [...skippedRowIssuesRef.current, ...issues];
      skippedManagedRef.current = [...skippedManagedRef.current, ...managed];
      cleanupAfterRemoval(set);
      const count = ids.length;
      toast.info(`${count} ${count === 1 ? "row" : "rows"} skipped from this import`, {
        description: "They stay on the results as failed, to fix later.",
      });
    },
    [rows, cleanupAfterRemoval],
  );

  const duplicateRow = useCallback(
    (id: string) => {
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.id === id);
        if (idx < 0) return prev;
        const copy: ItemReviewRow = { ...prev[idx].data, [keyColumn]: "" };
        const dup: ManagedRow = { id: makeRowId(), data: copy, originalData: { ...copy } };
        return [...prev.slice(0, idx + 1), dup, ...prev.slice(idx + 1)];
      });
    },
    [keyColumn],
  );

  const revertRow = useCallback((id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, data: { ...r.originalData } } : r)));
  }, []);

  const bulkSetField = useCallback((ids: Set<string>, field: ItemReviewField, value: string) => {
    setRows((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, data: { ...r.data, [field]: value } } : r)));
  }, []);

  /* Selection */
  const pagedIds = pagedRows.map((r) => r._id);
  const allPagedSelected = pagedIds.length > 0 && pagedIds.every((id) => selectedIds.has(id));
  const somePagedSelected = pagedIds.some((id) => selectedIds.has(id));
  const headerChecked: boolean | "indeterminate" = allPagedSelected ? true : somePagedSelected ? "indeterminate" : false;
  const toggleAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pagedIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  };
  const toggleRowSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  /* Cell focus model */
  const moveActiveCell = useCallback(
    (from: CellAddr, dir: CommitDir | "up", keepEditing: boolean) => {
      const rowIdx = pagedRows.findIndex((r) => r._id === from.rowId);
      const colIdx = columnOrder.indexOf(from.field);
      if (rowIdx < 0 || colIdx < 0) return;
      let nr = rowIdx;
      let nc = colIdx;
      if (dir === "down") nr++;
      else if (dir === "up") nr--;
      else if (dir === "right") {
        nc++;
        if (nc >= columnOrder.length) {
          nc = 0;
          nr++;
        }
      } else if (dir === "left") {
        nc--;
        if (nc < 0) {
          nc = columnOrder.length - 1;
          nr--;
        }
      }
      if (nr < 0 || nr >= pagedRows.length) {
        if (!keepEditing) setEditingCell(null);
        return;
      }
      const addr = { rowId: pagedRows[nr]._id, field: columnOrder[nc] };
      setActiveCell(addr);
      setEditingCell(keepEditing ? addr : null);
    },
    [pagedRows, columnOrder],
  );

  const handleCellClick = useCallback((addr: CellAddr) => {
    setActiveCell(addr);
    setEditingCell(addr);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (!activeCell || editingCell) return;
      const map: Record<string, CommitDir | "up"> = { ArrowRight: "right", ArrowLeft: "left", ArrowDown: "down", ArrowUp: "up" };
      if (map[e.key]) {
        e.preventDefault();
        moveActiveCell(activeCell, map[e.key], false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        setEditingCell(activeCell);
      } else if (e.key === "Escape") {
        setActiveCell(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activeCell, editingCell, moveActiveCell]);

  useEffect(() => {
    if (editingCell && !pagedRows.some((r) => r._id === editingCell.rowId)) setEditingCell(null);
  }, [editingCell, pagedRows]);

  useEffect(() => {
    if (!open || !editingCell) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("td") || t.closest("[data-cell-dropdown]")) return;
      setEditingCell(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, editingCell]);

  /* Dirty + close */
  const isDirty = useMemo(() => {
    if (phase.kind !== "idle") return false;
    if (rows.length !== parsedRows.length) return true;
    return rows.some((r) => isRowEdited(r, columnKeys));
  }, [phase.kind, rows, parsedRows.length, columnKeys]);

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pendingConfirm || pendingSkip || phase.kind !== "idle" || rowMenu || showDiscardConfirm) return;
      if (activeCell || editingCell) return;
      attemptClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pendingConfirm, pendingSkip, phase.kind, rowMenu, showDiscardConfirm, activeCell, editingCell, attemptClose]);

  /* Column resize + drag reorder */
  /* Each column at least as wide as its header on hover (label, Required pill, grip, plus the 12px sort icon and its 4px gap),
   * so hovering never resizes or clips it. */
  const minColWidth = (key: ItemReviewField) => Math.max(MIN_COL_WIDTH, headerMinWidth(spec.columnByKey[key].label, spec.columnByKey[key].required) + SORT_ICON_SPACE);
  const colWidth = (key: ItemReviewField) => columnWidths[key] ?? Math.max(spec.columnByKey[key].width, minColWidth(key));
  const startResize = (key: ItemReviewField, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidth(key);
    setIsResizing(true);
    const onMove = (ev: PointerEvent) => {
      const w = Math.min(MAX_COL_WIDTH, Math.max(minColWidth(key), startW + (ev.clientX - startX)));
      setColumnWidths((prev) => ({ ...prev, [key]: w }));
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startColumnDrag = (key: ItemReviewField, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    const onMove = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
        dragging = true;
        setDraggingColumnKey(key);
      }
      if (ghostElRef.current) ghostElRef.current.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
      const th = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>("th[data-col-key]");
      const overKey = th?.dataset.colKey as ItemReviewField | undefined;
      if (!th || !overKey || overKey === key) return;
      const rect = th.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      setColumnOrder((prev) => {
        const from = prev.indexOf(key);
        const to = prev.indexOf(overKey);
        if (from < 0 || to < 0) return prev;
        if ((to > from && ev.clientX < mid) || (to < from && ev.clientX > mid)) return prev;
        const next = [...prev];
        next.splice(from, 1);
        next.splice(to, 0, key);
        return next;
      });
    };
    const onUp = () => {
      if (dragging) suppressNextClickRef.current = true;
      setDraggingColumnKey(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /* Start Import */
  const runImport = useCallback(() => {
    if (phase.kind !== "idle") return;
    const total = rows.length;
    const skippedCount = skippedRows.length;
    setPhase({ kind: "running", processed: 0, total });
    setActiveCell(null);
    setEditingCell(null);
    const startedAt = performance.now();
    const tick = (now: number) => {
      const ratio = Math.min(1, (now - startedAt) / IMPORT_DURATION_MS);
      const processed = Math.min(total, Math.floor(ratio * total));
      setPhase((cur) => (cur.kind === "running" ? { ...cur, processed } : cur));
      if (ratio < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const finishedAt = new Date().toISOString();
      const resolvedFileName = fileName || `${importName}.csv`;
      const importId = linkedParent ? reimportChildId(linkedParent.id) : newImportId();
      const created: ItemReviewRow[] = [];
      const updated: ItemReviewRow[] = [];
      const records: ImportedItemRow[] = [];
      rows.forEach((r, i) => {
        const isUpdate = validation.rows[i]?.isUpdate ?? false;
        (isUpdate ? updated : created).push({ ...r.data });
        records.push(toImportedItemRow(r.data, records.length + 1, isUpdate ? "Updated" : "Created"));
      });
      skippedRows.forEach((r, i) => {
        const msgs = skippedRowIssuesRef.current[i] ?? [];
        records.push(toImportedItemRow(r, records.length + 1, "Skipped", msgs.join(" ") || "Row was removed before import."));
      });
      if (linkedParent && rowLinks) {
        const resolved = rows
          .map((r, i) => ({ link: rowLinks[i], row: r, isUpdate: validation.rows[i]?.isUpdate ?? false }))
          .filter((x) => x.link.bucket === "matched" && x.link.parentRow !== null)
          .map((x) => ({ parentRow: x.link.parentRow as number, values: x.row.data, outcome: x.isUpdate ? ("Updated" as const) : ("Created" as const) }));
        applyCorrectionToParent(linkedParent.id, resolved);
        const parts: string[] = [];
        if (resolved.length) parts.push(`${resolved.length} error row${resolved.length === 1 ? "" : "s"} fixed`);
        if (bucketCounts.new) parts.push(`${bucketCounts.new} new row${bucketCounts.new === 1 ? "" : "s"}`);
        if (skippedCount) parts.push(`${skippedCount} still failing`);
        addFixChildImport({
          id: importId,
          parentId: linkedParent.id,
          moduleSlug: MODULE_SLUG,
          name: importName,
          fileName: resolvedFileName,
          description: parts.join(", ") || "Re-imported from file",
          dateISO: finishedAt,
          importerKey: CURRENT_IMPORTER_KEY,
          recordCount: total + skippedCount,
          importedCount: total,
          failedCount: skippedCount,
          correctionKind: "reimport",
        });
        clearPendingCorrection(linkedParent.id);
      } else {
        recordCompletedImport({
          id: importId,
          moduleSlug: MODULE_SLUG,
          name: importName,
          description: importDescription || undefined,
          fileName: resolvedFileName,
          dateISO: finishedAt,
          importerKey: CURRENT_IMPORTER_KEY,
          recordCount: total + skippedCount,
          importedCount: total,
          failedCount: skippedCount,
        });
      }
      saveImportDetail({
        id: importId,
        moduleSlug: MODULE_SLUG,
        name: importName,
        description: importDescription || undefined,
        dateISO: finishedAt,
        importerKey: CURRENT_IMPORTER_KEY,
        fileName: resolvedFileName,
        records,
      });
      upsertImportedItems(
        rows.map((r) => r.data),
        spec.lookups,
      );
      setImportNotice({ created: created.length, updated: updated.length, skipped: skippedCount, importId });
      onApplied?.({ created, updated, skipped: skippedRows, importId });
      setPhase({
        kind: "complete",
        importId,
        createdCount: created.length,
        updatedCount: updated.length,
        skippedCount,
        correctionParentId: linkedParent?.id ?? null,
      });
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [phase.kind, rows, validation, skippedRows, fileName, importName, importDescription, linkedParent, rowLinks, bucketCounts.new, upsertImportedItems, spec.lookups, onApplied]);

  const dismissCompletion = (target: "listing" | "history" | { kind: "detail"; filter: CompleteDetailFilter }) => {
    if (phase.kind !== "complete") return;
    const detailHref = spec.routes.record.replace(":importId", phase.importId);
    const parentHref = phase.correctionParentId ? spec.routes.record.replace(":importId", phase.correctionParentId) : null;
    onCompleted();
    if (target === "listing") navigate(spec.routes.listing, { replace: true });
    else if (target === "history") navigate(parentHref ?? detailHref);
    else navigate(`${detailHref}?filter=${target.filter}`);
  };

  const running = phase.kind === "running";
  const rowHeight = density === "comfort" ? ROW_HEIGHT_COMFORT : ROW_HEIGHT_CONDENSED;
  const tabs: { id: StatusFilter; label: string; count: number; tone: ChipTone }[] = [
    { id: "all", label: "Show All", count: counts.total, tone: "blue" },
    { id: "ready", label: "Ready", count: counts.ready, tone: "green" },
    { id: "errors", label: "Errors", count: counts.errors, tone: "red" },
  ];

  if (!open || typeof document === "undefined") return null;

  const renderColHeader = (key: ItemReviewField) => {
    const col = spec.columnByKey[key];
    const width = colWidth(key);
    const sortActive = sort?.key === key;
    const isActiveCol = activeCell?.field === key;
    const isDragged = draggingColumnKey === key;
    const hovered = hoveredHeaderKey === key;
    const bg = isActiveCol ? "#E8F2FF" : isDragged ? "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)" : hovered ? "#F1F5F9" : "#F8FAFC";
    const SortIcon = sortActive ? (sort!.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
    return (
      <th
        key={key}
        data-col-key={key}
        onMouseEnter={() => setHoveredHeaderKey(key)}
        onMouseLeave={() => setHoveredHeaderKey((k) => (k === key ? null : k))}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
          startColumnDrag(key, e);
        }}
        className={`relative text-left align-middle px-3 whitespace-nowrap border-b border-[#CBD5E1] border-r border-r-[#E2E8F0] cursor-grab group/colheader ${
          density === "comfort" ? "h-11" : "h-9"
        }`}
        style={{
          width,
          minWidth: width,
          maxWidth: width,
          overflow: "hidden",
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: bg,
          fontSize: "12px",
          fontWeight: 500,
          color: isActiveCol ? "#0A77FF" : "#64748B",
          lineHeight: 1.2,
        }}
      >
        {isDragged && <span className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "#0A77FF" }} />}
        <GripVertical
          className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${
            isDragged ? "opacity-100 text-[#0A77FF]" : "opacity-0 group-hover/colheader:opacity-100 text-[#94A3B8]"
          }`}
        />
        <div className="flex items-center justify-between gap-1 h-full pl-3 -ml-3">
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  if (suppressNextClickRef.current) {
                    suppressNextClickRef.current = false;
                    return;
                  }
                  handleSort(key);
                }}
                className="inline-flex items-center gap-1 text-left flex-1 min-w-0 hover:text-[#0F172A] transition-colors cursor-pointer"
                style={{ fontSize: "12px", fontWeight: 500, lineHeight: 1.2 }}
              >
                <span className="truncate">{col.label}</span>
                {col.required && <RequiredPill />}
                <SortIcon className="w-3 h-3 shrink-0" style={{ color: sortActive ? "#0A77FF" : hovered ? "#64748B" : "#CBD5E1" }} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8} className="z-[200] max-w-[260px] bg-white border border-[#E2E8F0] text-[#0F172A] px-3 py-2 rounded-lg shadow-lg">
              <div style={{ fontSize: "12.5px", fontWeight: 600 }}>{col.label}</div>
              <div className="text-[#475569] mt-0.5" style={{ fontSize: "12px", lineHeight: 1.45 }}>
                {col.description}
              </div>
              <TooltipPrimitive.Arrow width={10} height={5} style={{ fill: "white", stroke: "#E2E8F0", strokeWidth: 1 }} />
            </TooltipContent>
          </Tooltip>
        </div>
        <div
          data-resize-handle
          onPointerDown={(e) => startResize(key, e)}
          onDoubleClick={() => setColumnWidths((prev) => ({ ...prev, [key]: spec.columnByKey[key].width }))}
          className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
          title="Drag to resize · double-click to reset"
        >
          <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${isResizing ? "bg-[#0A77FF]" : "bg-transparent group-hover/resize:bg-[#0A77FF]/40"}`} />
        </div>
      </th>
    );
  };

  const rowBgFor = (r: AnnotatedRow, index: number) =>
    activeCell?.rowId === r._id ? "#E8F2FF" : hoveredRowId === r._id ? "#F1F5F9" : selectedIds.has(r._id) ? "#EFF6FF" : index % 2 === 1 ? "#F8FAFC" : "#FFFFFF";

  /* "Undo skipped rows": every skipped row back where it was, as it was. */
  const undoSkippedRows = () => {
    const restored = [...skippedManagedRef.current];
    if (restored.length === 0) return;
    skippedManagedRef.current = [];
    skippedRowIssuesRef.current = [];
    setSkippedRows([]);
    setRows((prev) => {
      const next = [...prev];
      /* Earlier skips first, so each lands back at its old index. */
      for (const { row, index } of [...restored].sort((a, b) => a.index - b.index)) next.splice(Math.min(index, next.length), 0, row);
      return next;
    });
  };

  /* Issue strip: every cell issue on its own line, errors first, in row and column order. */
  const reviewIssues: ReviewIssue[] = (() => {
    const colIndex = new Map(columns.map((c, i) => [c.key as string, i]));
    const label = new Map(columns.map((c) => [c.key as string, c.label]));
    const out: ReviewIssue[] = [];
    for (const r of rowsAnnotated)
      for (const [field, list] of Object.entries(r._byField as Record<string, CellIssue[] | undefined>))
        for (const issue of list ?? []) out.push({ rowId: r._id, rowNumber: r._position, field, columnLabel: label.get(field) ?? field, severity: issue.severity, message: issue.message });
    const sev = (i: ReviewIssue) => (i.severity === "error" ? 0 : 1);
    return out.sort((a, b) => sev(a) - sev(b) || a.rowNumber - b.rowNumber || (colIndex.get(a.field) ?? 0) - (colIndex.get(b.field) ?? 0));
  })();
  const jumpToIssue = (issue: ReviewIssue) => {
    setTab("all");
    setSearch("");
    setPendingJump({ rowId: issue.rowId, field: issue.field as CellAddr["field"] });
  };

  return createPortal(
    <TooltipProvider delayDuration={200}>
      <AnimatePresence>
        <motion.div
          key="review-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150]"
          onClick={attemptClose}
        />
        <div className={`fixed inset-0 z-[151] flex items-center justify-center pointer-events-none ${isFullScreen ? "p-3 lg:p-4" : "p-4 sm:p-6"}`}>
          <motion.div
            key="review-panel"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
            role="dialog"
            aria-modal="true"
            aria-label="Review and Fix Your Data"
            className={`bg-white flex flex-col overflow-hidden pointer-events-auto transition-[max-width,max-height,width,height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              isFullScreen
                ? "w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] h-[calc(100vh-1.5rem)] max-h-[calc(100vh-1.5rem)] rounded-2xl lg:w-[calc(100vw-2rem)] lg:max-w-[calc(100vw-2rem)] lg:h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2rem)]"
                : "w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] max-h-[100dvh] rounded-2xl sm:w-[min(92vw,1280px)] sm:max-w-[min(92vw,1280px)] sm:h-auto sm:max-h-[80vh]"
            }`}
            style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)" }}
          >
            {/* Header */}
            <div className="px-4 lg:px-6 py-4 shrink-0 bg-white border-b border-[#E2E8F0]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-[#0F172A] truncate shrink-0" style={{ fontSize: "17px", fontWeight: 700 }} title="Review and Fix Your Data">
                      Review and Fix Your Data
                    </h2>
                    {/* Which import these rows correct: a chip, not a banner. */}
                    <CorrectionBanner
                      detection={detection}
                      locked={!!fixParentRows}
                      linked={linkToParent}
                      onLinkChange={setLinkToParent}
                      counts={bucketCounts}
                      alreadyImportedCount={alreadyImportedIds.length}
                      onRemoveAlreadyImported={() => deleteRows(alreadyImportedIds)}
                    />
                  </div>
                  <p className="text-[#64748B] mt-1" style={{ fontSize: "13px" }}>
                    Check your {plural} before importing. Rows with errors will not be imported until you fix them.
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
                    disabled={running}
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>


            {/* Body */}
            <div className="flex-1 min-h-0 flex flex-col bg-[#F8FAFC] overflow-hidden">
              {/* End to end, as the Partners review: no inset card, the grid spans the modal between header and footer. */}
              <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
                <IssuesBanner
                  issues={reviewIssues}
                  noun={singular}
                  onJump={jumpToIssue}
                  errorRowCount={counts.errors}
                  onSkipErrorRows={() => setPendingSkip({ ids: rowsAnnotated.filter((r) => r._status === "error").map((r) => r._id) })}
                  skippedRowCount={skippedRows.length}
                  onUndoSkipped={undoSkippedRows}
                />
                {/* Search row */}
                <div className="shrink-0 px-6 pt-3.5 pb-2 flex items-center justify-between gap-2">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#CBD5E1" }} />
                    <input
                      type="text"
                      placeholder="Search records..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        resetPage();
                      }}
                      className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-[#E2E8F0] shadow-sm rounded-md placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/20 transition-colors"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          resetPage();
                        }}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* The listing's record count ("94 of 100 items"; selected of all while rows are selected), then its divider, then density. */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="mr-1 hidden sm:inline" style={{ fontSize: "14px", fontWeight: 500 }}>
                      {selectedIds.size > 0 || sortedRows.length !== rowsAnnotated.length ? (
                        <>
                          <span style={{ color: "#0F172A" }}>{selectedIds.size > 0 ? selectedIds.size : sortedRows.length}</span>
                          <span style={{ color: "rgba(71,85,105,0.6)" }}> of </span>
                          <span style={{ color: "#475569" }}>{rowsAnnotated.length}</span>
                          <span style={{ color: "rgba(71,85,105,0.7)" }}> {plural}</span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: "#0F172A" }}>{rowsAnnotated.length}</span>
                          <span style={{ color: "rgba(71,85,105,0.7)" }}> {rowsAnnotated.length === 1 ? singular : plural}</span>
                        </>
                      )}
                    </span>
                    <div className="w-px h-5 mx-1 hidden sm:block" style={{ backgroundColor: "rgba(226,232,240,0.6)" }} />
                    <DensityDropdown density={density} onChange={setDensity} />
                  </div>
                </div>

                {/* Filter row or bulk bar */}
                {selectedIds.size > 0 ? (
                  <div className="shrink-0 [&>div]:h-[52px]">
                    <ImportSelectionBar
                      count={selectedIds.size}
                      noun="row"
                      onClear={() => setSelectedIds(new Set())}
                      actions={
                        <>
                          {spec.bulkSetFields.map((f) => (
                        <BulkSetDropdown
                          key={f}
                          label={`Set ${spec.columnByKey[f].label}`}
                          options={spec.columnByKey[f].options}
                          onPick={(v) => bulkSetField(selectedIds, f, v)}
                        />
                      ))}
                          <button type="button" onClick={() => setPendingConfirm({ ids: [...selectedIds] })} className={`${SELECTION_ACTION_BASE} ${SELECTION_ACTION_CLASS.destructive}`}><Trash2 className="w-3.5 h-3.5" /><span>Delete Rows</span><span className="opacity-80">({selectedIds.size})</span></button>
                        </>
                      }
                    />
                  </div>
                ) : (
                  <div className="shrink-0 px-6 pb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 overflow-x-auto h-10">
                      {tabs.map((t) => (
                        <FilterChip
                          key={t.id}
                          label={t.label}
                          count={t.count}
                          tone={t.tone}
                          active={tab === t.id}
                          onClick={() => {
                            setTab(t.id);
                            resetPage();
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="shrink-0 border-t border-[#E2E8F0]" />

                {/* Grid wrap */}
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
                        <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-2xl bg-white border border-[#E2E8F0]" style={{ boxShadow: "0 24px 48px -12px rgba(15,23,42,0.18)" }}>
                          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#0A77FF" }} />
                          <p className="text-[#0F172A]" style={{ fontSize: "14px", fontWeight: 600 }}>
                            Importing {phase.total} {phase.total === 1 ? singular : plural}...
                          </p>
                          <p className="text-[#64748B] tabular-nums" style={{ fontSize: "12.5px" }}>
                            Importing... {phase.processed} of {phase.total} {plural} processed
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div
                    ref={tableScrollRef}
                    onScroll={(e) => setIsScrolledX((e.currentTarget.scrollLeft || 0) > 0)}
                    className={`flex-1 min-h-0 overflow-auto ${isResizing || draggingColumnKey ? "select-none" : ""}`}
                    style={{ scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}
                  >
                    <DensityContext.Provider value={density}>
                      <table className="border-separate" style={{ borderSpacing: 0, tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
                        <colgroup>
                          <col style={{ width: ROW_NUM_WIDTH }} />
                          <col style={{ width: SELECT_COL_WIDTH }} />
                          <col style={{ width: STATUS_COL_WIDTH }} />
                          {columnOrder.map((k) => (
                            <col key={k} style={{ width: colWidth(k) }} />
                          ))}
                          <col style={{ width: ACTIONS_COL_WIDTH }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <HeaderTh sticky stickyLeft={0} style={{ backgroundColor: "#FFFFFF", textAlign: "right", paddingLeft: 4, paddingRight: 8, width: ROW_NUM_WIDTH }}>
                              <span style={{ color: "#94A3B8" }}>#</span>
                            </HeaderTh>
                            <HeaderTh sticky stickyLeft={ROW_NUM_WIDTH} style={{ textAlign: "center", paddingLeft: 0, paddingRight: 0, width: SELECT_COL_WIDTH }}>
                              <Checkbox
                                aria-label="Select all rows on page"
                                checked={headerChecked}
                                onCheckedChange={(c) => toggleAllOnPage(c === true)}
                                className="h-4 w-4 rounded-[4px] data-[state=checked]:bg-[#0A77FF] data-[state=checked]:border-[#0A77FF] data-[state=checked]:text-white data-[state=indeterminate]:bg-[#0A77FF] data-[state=indeterminate]:border-[#0A77FF] data-[state=indeterminate]:text-white"
                              />
                            </HeaderTh>
                            <HeaderTh sticky stickyLeft={ROW_NUM_WIDTH + SELECT_COL_WIDTH} style={{ width: STATUS_COL_WIDTH, boxShadow: isScrolledX ? FROZEN_RIGHT_SHADOW : undefined }}>
                              Result
                            </HeaderTh>
                            {columnOrder.map(renderColHeader)}
                            <HeaderTh sticky stickyRight style={{ width: ACTIONS_COL_WIDTH, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: "#334155", boxShadow: ACTIONS_SEAM }}>
                              <span className="text-[13px]">Actions</span>
                            </HeaderTh>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedRows.map((r, index) => {
                            const rowBg = rowBgFor(r, index);
                            const isError = r._status === "error";
                            const isActiveRow = activeCell?.rowId === r._id;
                            return (
                              <tr
                                key={r._id}
                                className="group"
                                onMouseEnter={() => setHoveredRowId(r._id)}
                                onMouseLeave={() => setHoveredRowId((h) => (h === r._id ? null : h))}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setRowMenu({ rowId: r._id, x: e.clientX, y: e.clientY });
                                }}
                              >
                                <BodyTd sticky stickyLeft={0} rowHeight={rowHeight} style={{ backgroundColor: rowBg, textAlign: "right", paddingLeft: 4, paddingRight: 8 }}>
                                  {/* Update rows: blue row number and a blue accent bar on the row's leading edge. */}
                                  {r._isUpdate && <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: "#0A77FF" }} />}
                                  <span
                                    style={{
                                      color: isActiveRow ? "#0A77FF" : isError ? "#DC2626" : r._isUpdate ? "#0A77FF" : "#94A3B8",
                                      fontWeight: isActiveRow ? 600 : isError || r._isUpdate ? 500 : 400,
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  >
                                    {r._position}
                                  </span>
                                </BodyTd>
                                <BodyTd sticky stickyLeft={ROW_NUM_WIDTH} rowHeight={rowHeight} style={{ backgroundColor: rowBg, textAlign: "center", paddingLeft: 0, paddingRight: 0 }}>
                                  <Checkbox
                                    aria-label={`Select row ${r._position}`}
                                    checked={selectedIds.has(r._id)}
                                    onCheckedChange={(c) => toggleRowSelected(r._id, c === true)}
                                    className="h-4 w-4 rounded-[4px] data-[state=checked]:bg-[#0A77FF] data-[state=checked]:border-[#0A77FF] data-[state=checked]:text-white"
                                  />
                                </BodyTd>
                                <BodyTd sticky stickyLeft={ROW_NUM_WIDTH + SELECT_COL_WIDTH} rowHeight={rowHeight} style={{ backgroundColor: rowBg, boxShadow: isScrolledX ? FROZEN_RIGHT_SHADOW : undefined }}>
                                  <span className="inline-flex items-center gap-1.5">
                                    <StatusChip status={r._status} />
                                    {r._isUpdate && <RowOpBadge singular={singular} />}
                                  </span>
                                </BodyTd>
                                {columnOrder.map((key) => {
                                  const col = spec.columnByKey[key];
                                  const val = r[key] ?? "";
                                  const issues = r._byField[key] ?? [];
                                  const addr = { rowId: r._id, field: key };
                                  return (
                                    <EditableDataCell
                                      key={key}
                                      cellId={`${r._id}::${key}`}
                                      column={col}
                                      value={val}
                                      originalValue={r._originalData[key] ?? ""}
                                      issues={issues}
                                      isUpdateCell={r._isUpdate && key !== keyColumn && val.trim() !== "" && issues.length === 0}
                                      isActive={activeCell?.rowId === r._id && activeCell.field === key}
                                      isEditing={editingCell?.rowId === r._id && editingCell.field === key}
                                      rowBg={rowBg}
                                      colBg={draggingColumnKey === key ? "rgba(10,119,255,0.035)" : undefined}
                                      width={colWidth(key)}
                                      search={search}
                                      singular={singular}
                                      extraOptions={key === "tags" ? tagOptions : undefined}
                                      onClick={() => handleCellClick(addr)}
                                      onCommit={(next, dir) => {
                                        commitEdit(r._id, key, next);
                                        if (dir) moveActiveCell(addr, dir, true);
                                        else setEditingCell(null);
                                      }}
                                      onCancel={() => setEditingCell(null)}
                                    />
                                  );
                                })}
                                <BodyTd sticky stickyRight rowHeight={rowHeight} style={{ backgroundColor: rowBg, paddingLeft: 8, paddingRight: 8, boxShadow: ACTIONS_SEAM }}>
                                  <RowActionsButton
                                    edited={r._edited}
                                    isError={isError}
                                    onDuplicate={() => duplicateRow(r._id)}
                                    onRevert={() => revertRow(r._id)}
                                    onSkip={() => setPendingSkip({ ids: [r._id] })}
                                    onDelete={() => deleteRows([r._id])}
                                  />
                                </BodyTd>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </DensityContext.Provider>
                    {pagedRows.length === 0 && phase.kind !== "running" && (
                      <div className="sticky left-0" style={{ width: "100%", maxWidth: "100vw" }}>
                        <GridEmptyState
                          rowsTotal={rows.length}
                          searchActive={search.trim() !== ""}
                          tab={tab}
                          onCancelImport={onClose}
                          onClearSearch={() => {
                            setSearch("");
                            resetPage();
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <Pagination
                    currentPage={safePage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    recordsPerPage={recordsPerPage}
                    onRecordsPerPageChange={(n) => {
                      setRecordsPerPage(n);
                      resetPage();
                    }}
                    pageSizeOptions={[20, 50, 100]}
                    allowAll
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-[#E2E8F0] bg-white px-4 lg:px-6 py-2.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={attemptClose}
                disabled={running}
                className={`inline-flex items-center justify-center h-9 px-4 rounded-md border border-[#E2E8F0] bg-white text-[#334155] shadow-sm transition-colors ${
                  running ? "opacity-50 cursor-not-allowed" : "hover:bg-[#F8FAFC] hover:border-[#CBD5E1] cursor-pointer"
                }`}
                style={{ fontSize: "13px", fontWeight: 500 }}
              >
                Cancel
              </button>
              <StartImportButton errorCount={counts.errors} running={running} onStart={runImport} />
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {rowMenu && (
        <FloatingRowContextMenu
          x={rowMenu.x}
          y={rowMenu.y}
          onClose={() => setRowMenu(null)}
          edited={rowsAnnotated.find((r) => r._id === rowMenu.rowId)?._edited ?? false}
          isError={rowsAnnotated.find((r) => r._id === rowMenu.rowId)?._status === "error"}
          onDuplicate={() => duplicateRow(rowMenu.rowId)}
          onRevert={() => revertRow(rowMenu.rowId)}
          onSkip={() => setPendingSkip({ ids: [rowMenu.rowId] })}
          onDelete={() => deleteRows([rowMenu.rowId])}
        />
      )}

      <SkipRowsConfirm
        confirm={pendingSkip}
        onCancel={() => setPendingSkip(null)}
        onConfirm={(ids) => {
          skipErrorRows(ids);
          setPendingSkip(null);
        }}
      />

      <ConfirmDialog
        open={!!pendingConfirm}
        title="Delete These Rows?"
        message="This removes the rows you selected. The rest of your data stays as it is."
        confirmLabel="Delete Rows"
        cancelLabel="Cancel"
        icon="trash"
        maxWidth={440}
        onConfirm={() => {
          if (pendingConfirm) deleteRows(pendingConfirm.ids);
          setPendingConfirm(null);
        }}
        onCancel={() => setPendingConfirm(null)}
      />

      <ImportCompleteDialog
        open={phase.kind === "complete"}
        createdCount={phase.kind === "complete" ? phase.createdCount : 0}
        updatedCount={phase.kind === "complete" ? phase.updatedCount : 0}
        skippedCount={phase.kind === "complete" ? phase.skippedCount : 0}
        entityPlural={titlePlural}
        historyLabel={phase.kind === "complete" && phase.correctionParentId ? "View Original Import" : "View Import History"}
        onGoToListing={() => dismissCompletion("listing")}
        onViewHistory={() => dismissCompletion("history")}
        onViewDetail={(filter) => dismissCompletion({ kind: "detail", filter })}
      />

      <ConfirmDialog
        open={showDiscardConfirm}
        title="Close Without Importing?"
        message={DISCARD_MESSAGE}
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />

      {/* Column drag ghost */}
      <div
        ref={ghostElRef}
        style={{ position: "fixed", top: 0, left: 0, zIndex: 9999, pointerEvents: "none", opacity: draggingColumnKey ? 1 : 0, transition: "opacity 80ms ease-out", willChange: "transform" }}
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
              {spec.columnByKey[draggingColumnKey].label}
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>,
    document.body,
  );
}

/* ─── Table primitives ─── */

function HeaderTh({
  children,
  sticky,
  stickyLeft,
  stickyRight,
  style,
}: {
  children: React.ReactNode;
  sticky?: boolean;
  stickyLeft?: number;
  stickyRight?: boolean;
  style?: React.CSSProperties;
}) {
  const density = useDensity();
  return (
    <th
      className={`text-left align-middle px-3 whitespace-nowrap bg-[#F8FAFC] border-b border-[#CBD5E1] border-r border-r-[#E2E8F0] last:border-r-0 sticky top-0 ${
        density === "comfort" ? "h-11" : "h-9"
      } ${sticky ? "z-30" : ""}`}
      style={{
        fontSize: "12px",
        fontWeight: 500,
        color: "#64748B",
        lineHeight: 1.2,
        zIndex: sticky ? 30 : 20,
        left: stickyLeft,
        right: stickyRight ? 0 : undefined,
        ...style,
      }}
    >
      {children}
    </th>
  );
}

export function BodyTd({
  children,
  sticky,
  stickyLeft,
  stickyRight,
  rowHeight,
  style,
}: {
  children: React.ReactNode;
  sticky?: boolean;
  stickyLeft?: number;
  stickyRight?: boolean;
  rowHeight: number;
  style?: React.CSSProperties;
}) {
  return (
    <td
      className={`px-3 align-middle border-b border-[#F1F5F9] border-r border-r-[#F1F5F9] last:border-r-0 ${sticky ? "sticky z-10" : ""}`}
      style={{
        height: rowHeight,
        fontSize: "13px",
        color: "#1E293B",
        fontFamily: CELL_FONT,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        left: stickyLeft,
        right: stickyRight ? 0 : undefined,
        ...style,
      }}
    >
      {children}
    </td>
  );
}

interface EditableDataCellProps {
  /** "rowId::field", the target the issue strip's jump scrolls to. */
  cellId?: string;
  column: SpecColumn;
  value: string;
  originalValue: string;
  issues: CellIssue[];
  isUpdateCell: boolean;
  isActive: boolean;
  isEditing: boolean;
  rowBg: string;
  colBg?: string;
  width: number;
  search: string;
  singular: string;
  extraOptions?: string[];
  onClick: () => void;
  onCommit: (next: string, dir?: CommitDir) => void;
  onCancel: () => void;
}

export function EditableDataCell({
  column,
  value,
  originalValue,
  issues,
  isUpdateCell,
  isActive,
  isEditing,
  rowBg,
  colBg,
  width,
  search,
  singular,
  extraOptions,
  onClick,
  onCommit,
  onCancel,
  cellId,
}: EditableDataCellProps) {
  const density = useDensity();
  const rowHeight = density === "comfort" ? ROW_HEIGHT_COMFORT : ROW_HEIGHT_CONDENSED;
  /* Every issue is an error (there are no warnings). */
  const severity = issues.length ? "error" : null;
  const bg = isEditing ? "#FFFFFF" : severity === "error" ? "#FEF2F2" : isUpdateCell ? "#EFF6FF" : (colBg ?? rowBg);
  const shadow = isEditing
    ? "inset 0 0 0 2px #0A77FF, inset 0 0 0 3px rgba(10,119,255,0.15)"
    : isActive
      ? "inset 0 0 0 2px #0A77FF"
      : severity === "error"
        ? "inset 0 0 0 1px #FECACA"
        : isUpdateCell
            ? "inset 0 0 0 1px #BFDBFE"
            : undefined;
  const isEdited = value !== originalValue;
  const empty = value.trim() === "";
  const display = empty ? (
    <span className="text-[#CBD5E1]">-</span>
  ) : (
    <span className="block overflow-hidden text-ellipsis" style={{ whiteSpace: "pre" }}>
      <HighlightMatch text={column.kind === "number" ? formatNumberDisplay(value) : value} query={search} />
    </span>
  );

  return (
    <td
      data-cell={cellId}
      className="align-middle border-b border-[#F1F5F9] border-r border-r-[#F1F5F9]"
      onClick={onClick}
      onDoubleClick={onClick}
      style={{
        position: "relative",
        height: rowHeight,
        width,
        minWidth: width,
        maxWidth: width,
        paddingLeft: isEditing ? 0 : 12,
        paddingRight: isEditing ? 0 : 12,
        fontSize: "13px",
        color: "#1E293B",
        fontFamily: CELL_FONT,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        backgroundColor: bg.startsWith("rgba") || bg.startsWith("#") ? bg : undefined,
        boxShadow: shadow,
        cursor: isEditing ? "text" : "cell",
      }}
    >
      {isEdited && !isEditing && <EditedIndicator originalValue={originalValue} />}
      {isEditing ? (
        <CellInput column={column} value={value} onCommit={onCommit} onCancel={onCancel} extraOptions={extraOptions} />
      ) : issues.length > 0 ? (
        <CellIssueTooltip issues={issues}>{display}</CellIssueTooltip>
      ) : isUpdateCell ? (
        <UpdateCellTooltip singular={singular}>{display}</UpdateCellTooltip>
      ) : (
        display
      )}
    </td>
  );
}

/* ─── Row actions ─── */

interface RowActionsProps {
  edited: boolean;
  isError: boolean;
  onDuplicate: () => void;
  onRevert: () => void;
  onSkip: () => void;
  onDelete: () => void;
}

function RowActionsMenuItems({ edited, isError, onDuplicate, onRevert, onSkip, onDelete }: RowActionsProps) {
  const red = "cursor-pointer gap-2 text-[#DC2626] focus:text-[#DC2626]";
  return (
    <>
      <DropdownMenuItem className="cursor-pointer gap-2" onClick={onDuplicate}>
        <Copy className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
        Duplicate Row
      </DropdownMenuItem>
      {edited && (
        <DropdownMenuItem className="cursor-pointer gap-2" onClick={onRevert}>
          <RotateCcw className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
          Revert Changes
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      {isError && (
        <DropdownMenuItem className={red} onClick={onSkip}>
          <SkipForward className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
          Skip Row
        </DropdownMenuItem>
      )}
      <DropdownMenuItem className={red} onClick={onDelete}>
        <Trash2 className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
        Delete Row
      </DropdownMenuItem>
    </>
  );
}

function RowActionsButton(props: RowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Row actions"
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[230px] z-[200] bg-popover">
        <RowActionsMenuItems {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FloatingRowContextMenu({ x, y, onClose, ...props }: RowActionsProps & { x: number; y: number; onClose: () => void }) {
  return (
    <DropdownMenu open onOpenChange={(o) => !o && onClose()}>
      <DropdownMenuTrigger asChild>
        <span style={{ position: "fixed", left: x, top: y, width: 1, height: 1, pointerEvents: "none" }} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[230px] z-[200] bg-popover">
        <RowActionsMenuItems {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Start Import ─── */

export function StartImportButton({ errorCount, running, onStart, label = "Start Import" }: { errorCount: number; running: boolean; onStart: () => void; label?: string }) {
  const disabled = errorCount > 0 || running;
  const button = (
    <button
      type="button"
      onClick={onStart}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md shadow-sm transition-colors ${
        disabled ? "bg-[#0A77FF]/40 text-white cursor-not-allowed" : "bg-[#0A77FF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white cursor-pointer"
      }`}
      style={{ fontSize: "13px", fontWeight: 600 }}
    >
      {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {running ? "Importing..." : label}
    </button>
  );
  if (errorCount > 0 && !running) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-block cursor-not-allowed">
            <span style={{ pointerEvents: "none" }} className="inline-block">
              {button}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="z-[200] max-w-[260px] bg-white border border-[#FCA5A5] text-[#991B1B] px-3 py-2 rounded-lg shadow-lg">
          <span className="flex items-start gap-1.5">
            <CircleX className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#EF4444" }} />
            <span style={{ fontSize: "12.5px", fontWeight: 500, lineHeight: 1.4 }}>
              Fix all errors before importing. {errorCount} {errorCount === 1 ? "error" : "errors"} remaining.
            </span>
          </span>
        </TooltipContent>
      </Tooltip>
    );
  }
  return button;
}

/* ─── Empty states ─── */

function GridEmptyState({
  rowsTotal,
  searchActive,
  tab,
  onCancelImport,
  onClearSearch,
}: {
  rowsTotal: number;
  searchActive: boolean;
  tab: StatusFilter;
  onCancelImport: () => void;
  onClearSearch: () => void;
}) {
  const btn = "inline-flex items-center justify-center h-9 px-4 rounded-md border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer";
  let tile = "#F1F5F9";
  let icon: React.ReactNode = <SearchX className="w-7 h-7" style={{ color: "#64748B" }} />;
  let title = "No Rows to Display.";
  let subtitle: string | null = null;
  let action: React.ReactNode = null;
  if (rowsTotal === 0) {
    icon = <Upload className="w-7 h-7" style={{ color: "#64748B" }} />;
    title = "All Rows Have Been Removed.";
    subtitle = "There is nothing left to import.";
    action = (
      <button type="button" onClick={onCancelImport} className={`${btn} mt-4`} style={{ fontSize: "13px", fontWeight: 500 }}>
        Cancel Import
      </button>
    );
  } else if (searchActive) {
    title = "No Rows Match Your Search.";
    action = (
      <button type="button" onClick={onClearSearch} className={`${btn} mt-3`} style={{ fontSize: "13px", fontWeight: 500 }}>
        Clear Search
      </button>
    );
  } else if (tab === "errors") {
    tile = "#D1FAE5";
    icon = <CheckCircle2 className="w-7 h-7" style={{ color: "#059669" }} />;
    title = "No Errors.";
    subtitle = "Every row is ready to import.";
  } else if (tab === "ready") {
    tile = "#FEF3C7";
    icon = <AlertTriangle className="w-7 h-7" style={{ color: "#B45309" }} />;
    title = "No Rows Are Ready Yet.";
    subtitle = "Fix the errors to get your rows ready.";
  }
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl mb-3 flex items-center justify-center" style={{ backgroundColor: tile }}>
        {icon}
      </div>
      <p className="text-[#334155]" style={{ fontSize: "14px", fontWeight: 600 }}>
        {title}
      </p>
      {subtitle && (
        <p className="text-[#64748B] mt-1" style={{ fontSize: "13px" }}>
          {subtitle}
        </p>
      )}
      {action}
    </div>
  );
}
