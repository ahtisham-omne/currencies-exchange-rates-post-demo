/* "Review and Fix Your Data": the second portal above the Import wizard.
 * Port of User Access Control ImportReviewModal, generic over `spec.columns`.
 * Full View is the default; the whole grid re-validates after every edit. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Copy,
  GripVertical,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  RotateCcw,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import type { EntitySpec, ImportColumn, ImportRow } from "./spec";
import { normKey } from "./spec";
import { validateRows, type CellIssue, type RowStatus, type ValidationContext } from "./validation";
import {
  addFixChildImport,
  applyCorrectionToParent,
  clearPendingCorrection,
  CURRENT_IMPORTER_KEY,
  detectCorrectionTarget,
  linkRow,
  newImportId,
  recordCompletedImport,
  reimportChildId,
  saveImportDetail,
  toImportedRecord,
  type ImportedRecord,
  type RowFilter,
} from "./importHistory";
import {
  CELL_SEVERITY_STYLE,
  CellInput,
  CellIssueTooltip,
  CorrectionBanner,
  EditedIndicator,
  GridEmptyState,
  ImportCompleteDialog,
  ImportingOverlay,
  optionsForColumn,
  RowOpBadge,
  StartImportButton,
  StatusChip,
  UpdateCellTooltip,
  type CommitDir,
  type ReferenceOptions,
} from "./reviewParts";
import { BulkSetDropdown, ImportSelectionBar, SELECTION_ACTION_BASE, SELECTION_ACTION_CLASS } from "./SelectionBar";
import { CELL_FONT, ConfirmDialog, Density, DensityContext, DensityDropdown, FilterChip, HighlightMatch, Pagination, PANEL_SHADOW, ROW_HEIGHT_COMFORT, ROW_HEIGHT_CONDENSED, SearchBox, TriCheckbox, type ChipTone } from "./ui";

/* ───────────────────────── types ───────────────────────── */

export interface ImportOutcome {
  created: ImportRow[];
  updated: ImportRow[];
  skipped: ImportRow[];
  warningCount: number;
  importId: string;
}

interface ImportReviewModalProps {
  spec: EntitySpec<unknown>;
  open: boolean;
  importName: string;
  importDescription: string;
  fileName: string;
  parsedRows: ImportRow[];
  sessionParentId?: string | null;
  validationContext?: ValidationContext;
  referenceOptions?: ReferenceOptions;
  onClose: () => void;
  onApplied?: (outcome: ImportOutcome) => void;
  onCompleted: () => void;
}

interface ManagedRow {
  id: string;
  data: ImportRow;
  originalData: ImportRow;
}

interface CellAddr {
  rowId: string;
  field: string;
}

type StatusFilter = "all" | "errors" | "warnings" | "ready";

type ImportPhase =
  | { kind: "idle" }
  | { kind: "running"; processed: number; total: number }
  | { kind: "complete"; importId: string; createdCount: number; updatedCount: number; warningCount: number; skippedCount: number; finishedAt: string; correctionParentId: string | null };

const ROW_NUM_WIDTH = 36;
const SELECT_COL_WIDTH = 40;
const STATUS_COL_WIDTH = 150;
const ACTIONS_COL_WIDTH = 72;
const FROZEN_RIGHT_SHADOW = "4px 0 8px rgba(0,0,0,0.06)";
const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 255 * 7;
const DISCARD_MESSAGE = "Your fixes on this screen will not be saved.";
const IMPORT_DURATION_MS = 2400;

function makeRowId(): string {
  return `r-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}
function makeInitialRows(source: ImportRow[]): ManagedRow[] {
  return source.map((r) => ({ id: makeRowId(), data: { ...r }, originalData: { ...r } }));
}
function isRowEdited(r: ManagedRow, columns: ImportColumn[]): boolean {
  return columns.some((c) => (r.data[c.key] ?? "") !== (r.originalData[c.key] ?? ""));
}
function defaultColWidth(c: ImportColumn): number {
  return Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, Math.round((c.width ?? 14) * 7 + 20)));
}

/* ───────────────────────── component ───────────────────────── */

export function ImportReviewModal({ spec, open, importName, importDescription, fileName, parsedRows, sessionParentId = null, validationContext, referenceOptions = {}, onClose, onApplied, onCompleted }: ImportReviewModalProps) {
  const navigate = useNavigate();
  const columns = spec.columns;

  const [isFullScreen, setIsFullScreen] = useState(true);
  const [density, setDensity] = useState<Density>("comfort");
  const [rows, setRows] = useState<ManagedRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<ImportRow[]>([]);
  const skippedRowIssuesRef = useRef<string[][]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeCell, setActiveCell] = useState<CellAddr | null>(null);
  const [editingCell, setEditingCell] = useState<CellAddr | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ ids: string[] } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ rowId: string; x: number; y: number } | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [phase, setPhase] = useState<ImportPhase>({ kind: "idle" });
  const [tab, setTab] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => columns.map((c) => c.key));
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => Object.fromEntries(columns.map((c) => [c.key, defaultColWidth(c)])));
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [hoveredHeaderKey, setHoveredHeaderKey] = useState<string | null>(null);
  const [isScrolledX, setIsScrolledX] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);
  const [linkToParent, setLinkToParent] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const ghostElRef = useRef<HTMLDivElement | null>(null);
  const suppressNextClickRef = useRef(false);

  /* Reset on open. */
  useEffect(() => {
    if (!open) return;
    setIsFullScreen(true);
    setDensity("comfort");
    setRows(makeInitialRows(parsedRows));
    setSkippedRows([]);
    skippedRowIssuesRef.current = [];
    setSelectedIds(new Set());
    setActiveCell(null);
    setEditingCell(null);
    setPendingConfirm(null);
    setRowMenu(null);
    setShowDiscardConfirm(false);
    setPhase({ kind: "idle" });
    setTab("all");
    setSearch("");
    setSort(null);
    setCurrentPage(1);
    setRecordsPerPage(100);
    setColumnOrder(columns.map((c) => c.key));
    setColumnWidths(Object.fromEntries(columns.map((c) => [c.key, defaultColWidth(c)])));
  }, [open, parsedRows, columns]);

  /* ─── correction detection ─── */
  const detection = useMemo(
    () => (open ? detectCorrectionTarget(spec, { sessionParentId, rowKeys: parsedRows.map((r) => r[spec.keyColumn] ?? "") }) : { kind: "none" as const }),
    [open, spec, sessionParentId, parsedRows],
  );
  useEffect(() => {
    if (!open) return;
    setLinkToParent(detection.kind === "linked" && detection.confidence === "session");
  }, [open, detection]);
  const linkedParent = detection.kind === "linked" && linkToParent ? detection.parent : null;

  /* ─── validation (whole grid, every change) ─── */
  const effectiveRows = useMemo(() => rows.map((r) => r.data), [rows]);
  const validation = useMemo(() => validateRows(spec, effectiveRows, validationContext ?? {}), [spec, effectiveRows, validationContext]);

  const rowsAnnotated = useMemo(
    () =>
      rows.map((r, i) => {
        const v = validation.rows[i];
        const key = r.data[spec.keyColumn] ?? "";
        const link = linkedParent ? linkRow(linkedParent, key) : null;
        return {
          ...r.data,
          _id: r.id,
          _position: i + 1,
          _originalData: r.originalData,
          _status: v?.status ?? ("ready" as RowStatus),
          _byField: v?.byField ?? {},
          _isUpdate: v?.isUpdate ?? false,
          _edited: isRowEdited(r, columns),
          _bucket: link?.bucket ?? null,
          _parentRow: link?.parentRow ?? null,
        };
      }),
    [rows, validation, spec.keyColumn, columns, linkedParent],
  );
  type AnnotatedRow = (typeof rowsAnnotated)[number];

  const validationMessagesByIdRef = useRef<Map<string, string[]>>(new Map());
  useEffect(() => {
    const m = new Map<string, string[]>();
    rows.forEach((r, i) => m.set(r.id, (validation.rows[i]?.issues ?? []).map((iss) => iss.message)));
    validationMessagesByIdRef.current = m;
  }, [rows, validation]);

  const counts = { total: rowsAnnotated.length, errors: validation.errorRowCount, warnings: validation.warningRowCount, ready: validation.readyRowCount };
  const bucketCounts = useMemo(() => {
    const c = { matched: 0, resolved: 0, new: 0 };
    for (const r of rowsAnnotated) if (r._bucket) c[r._bucket]++;
    return c;
  }, [rowsAnnotated]);

  /* ─── filter, search, sort, page ─── */
  const resetPage = useCallback(() => setCurrentPage(1), []);
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rowsAnnotated.filter((r) => {
      if (tab === "errors" && r._status !== "error") return false;
      if (tab === "warnings" && r._status !== "warning") return false;
      if (tab === "ready" && r._status !== "ready") return false;
      if (q && !columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rowsAnnotated, tab, search, columns]);
  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const cmp = String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""), undefined, { sensitivity: "base" });
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filteredRows, sort]);
  const totalPages = Number.isFinite(recordsPerPage) ? Math.max(1, Math.ceil(sortedRows.length / recordsPerPage)) : 1;
  const pageSafe = Math.min(currentPage, totalPages);
  const pagedRows = useMemo(() => (Number.isFinite(recordsPerPage) ? sortedRows.slice((pageSafe - 1) * recordsPerPage, pageSafe * recordsPerPage) : sortedRows), [sortedRows, pageSafe, recordsPerPage]);

  const handleSort = (key: string) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    setSort((prev) => (!prev || prev.key !== key ? { key, dir: "asc" } : prev.dir === "asc" ? { key, dir: "desc" } : null));
    resetPage();
  };

  /* ─── row mutations ─── */
  const clearCellsForRows = (ids: Set<string>) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setActiveCell((c) => (c && ids.has(c.rowId) ? null : c));
    setEditingCell((c) => (c && ids.has(c.rowId) ? null : c));
  };
  const commitEdit = useCallback((rowId: string, field: string, next: string) => {
    setRows((prev) => prev.map((r) => (r.id === rowId && (r.data[field] ?? "") !== next ? { ...r, data: { ...r.data, [field]: next } } : r)));
  }, []);
  const deleteRows = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    setRows((prev) => prev.filter((r) => !set.has(r.id)));
    clearCellsForRows(set);
  }, []);
  const skipErrorRows = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    setRows((prev) => {
      const kept: ManagedRow[] = [];
      for (const r of prev) {
        if (set.has(r.id)) {
          setSkippedRows((s) => [...s, { ...r.data }]);
          skippedRowIssuesRef.current.push(validationMessagesByIdRef.current.get(r.id) ?? []);
        } else kept.push(r);
      }
      return kept;
    });
    clearCellsForRows(set);
    const count = ids.length;
    toast.info(`${count} ${count === 1 ? "row" : "rows"} skipped from this import`, {
      description: "These rows won't be imported now. They're kept available so you can fix and retry them from the import results.",
    });
  }, []);
  const duplicateRow = useCallback(
    (id: string) => {
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.id === id);
        if (idx === -1) return prev;
        const src = prev[idx];
        const copy = { ...src.data, [spec.keyColumn]: "" };
        const next = [...prev];
        next.splice(idx + 1, 0, { id: makeRowId(), data: copy, originalData: { ...copy } });
        return next;
      });
    },
    [spec.keyColumn],
  );
  const revertRow = useCallback((id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, data: { ...r.originalData } } : r)));
  }, []);
  const bulkSetField = useCallback((ids: Set<string>, field: string, value: string) => {
    setRows((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, data: { ...r.data, [field]: value } } : r)));
  }, []);

  /* ─── cell navigation ─── */
  const visibleColumns = useMemo(() => columnOrder.map((k) => columns.find((c) => c.key === k)).filter((c): c is ImportColumn => !!c), [columnOrder, columns]);
  const moveActiveCell = useCallback(
    (from: CellAddr, dir: "up" | "down" | "left" | "right", keepEditing: boolean) => {
      const rowIdx = pagedRows.findIndex((r) => r._id === from.rowId);
      const colIdx = visibleColumns.findIndex((c) => c.key === from.field);
      if (rowIdx === -1 || colIdx === -1) {
        if (!keepEditing) setEditingCell(null);
        return;
      }
      let nextRow = rowIdx;
      let nextCol = colIdx;
      if (dir === "up") nextRow -= 1;
      else if (dir === "down") nextRow += 1;
      else if (dir === "right") {
        nextCol += 1;
        if (nextCol >= visibleColumns.length) {
          nextCol = 0;
          nextRow += 1;
        }
      } else {
        nextCol -= 1;
        if (nextCol < 0) {
          nextCol = visibleColumns.length - 1;
          nextRow -= 1;
        }
      }
      if (nextRow < 0 || nextRow >= pagedRows.length) {
        if (!keepEditing) setEditingCell(null);
        return;
      }
      const addr = { rowId: pagedRows[nextRow]._id, field: visibleColumns[nextCol].key };
      setActiveCell(addr);
      setEditingCell(keepEditing ? addr : null);
    },
    [pagedRows, visibleColumns],
  );
  const handleCellClick = useCallback((addr: CellAddr) => {
    setActiveCell(addr);
    setEditingCell(addr);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) return;
      if (!activeCell || editingCell) return;
      const map: Record<string, "up" | "down" | "left" | "right"> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
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

  /* Drop edit mode when the editing row leaves the page. */
  useEffect(() => {
    if (editingCell && !pagedRows.some((r) => r._id === editingCell.rowId)) setEditingCell(null);
  }, [editingCell, pagedRows]);

  /* Outside mousedown (not on a td, not in a cell popover) clears the focus ring and edit mode. */
  useEffect(() => {
    if (!open) return;
    if (!activeCell && !editingCell) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("td") || t.closest("[data-cell-dropdown]")) return;
      setActiveCell(null);
      setEditingCell(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, activeCell, editingCell]);

  /* ─── close guards ─── */
  const isDirty = useMemo(() => {
    if (phase.kind !== "idle") return false;
    if (rows.length !== parsedRows.length) return true;
    return rows.some((r) => isRowEdited(r, columns));
  }, [phase.kind, rows, parsedRows.length, columns]);
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
      if (pendingConfirm || phase.kind !== "idle" || rowMenu || showDiscardConfirm) return;
      if (activeCell || editingCell) return;
      attemptClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pendingConfirm, phase.kind, rowMenu, showDiscardConfirm, activeCell, editingCell, attemptClose]);

  /* ─── run import ─── */
  const runImport = useCallback(() => {
    if (phase.kind !== "idle") return;
    const total = rows.length;
    const warningCount = validation.warningRowCount;
    const skippedCount = skippedRows.length;
    const created: ImportRow[] = [];
    const updated: ImportRow[] = [];
    const records: ImportedRecord[] = [];
    const resolved: { parentRow: number; values: ImportRow }[] = [];
    rows.forEach((r, i) => {
      const v = validation.rows[i];
      (v?.isUpdate ? updated : created).push({ ...r.data });
      records.push(toImportedRecord(spec, r.data, records.length + 1, "Created"));
      const ann = rowsAnnotated[i];
      if (linkedParent && ann?._bucket === "matched" && ann._parentRow !== null) resolved.push({ parentRow: ann._parentRow, values: { ...r.data } });
    });
    skippedRows.forEach((r, i) => {
      const msgs = skippedRowIssuesRef.current[i] ?? [];
      records.push(toImportedRecord(spec, r, records.length + 1, "Skipped", msgs.length ? msgs.join(" ") : "Row was removed before import."));
    });
    setPhase({ kind: "running", processed: 0, total });
    const startedAt = performance.now();
    const tick = (now: number) => {
      const ratio = Math.min(1, (now - startedAt) / IMPORT_DURATION_MS);
      const processed = Math.min(total, Math.floor(ratio * total));
      setPhase((cur) => (cur.kind === "running" ? { ...cur, processed } : cur));
      if (ratio < 1) {
        requestAnimationFrame(tick);
        return;
      }
      const finishedAt = new Date().toISOString();
      const resolvedFileName = fileName || `${importName}.csv`;
      const importId = linkedParent ? reimportChildId(linkedParent.id) : newImportId();
      if (linkedParent) {
        applyCorrectionToParent(spec, linkedParent.id, resolved);
        const parts: string[] = [];
        if (resolved.length) parts.push(`${resolved.length} error row${resolved.length === 1 ? "" : "s"} fixed`);
        if (bucketCounts.new) parts.push(`${bucketCounts.new} new row${bucketCounts.new === 1 ? "" : "s"}`);
        if (skippedCount) parts.push(`${skippedCount} still failing`);
        addFixChildImport(spec, {
          id: importId,
          parentId: linkedParent.id,
          moduleSlug: spec.moduleSlug,
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
        clearPendingCorrection(spec, linkedParent.id);
      } else {
        recordCompletedImport(spec, {
          id: importId,
          moduleSlug: spec.moduleSlug,
          name: importName,
          description: importDescription,
          fileName: resolvedFileName,
          dateISO: finishedAt,
          importerKey: CURRENT_IMPORTER_KEY,
          recordCount: total + skippedCount,
          importedCount: total,
          failedCount: skippedCount,
        });
      }
      saveImportDetail(spec, { id: importId, moduleSlug: spec.moduleSlug, name: importName, description: importDescription, dateISO: finishedAt, importerKey: CURRENT_IMPORTER_KEY, fileName: resolvedFileName, records });
      onApplied?.({ created, updated, skipped: skippedRows, warningCount, importId });
      setPhase({ kind: "complete", importId, createdCount: created.length, updatedCount: updated.length, warningCount, skippedCount, finishedAt, correctionParentId: linkedParent?.id ?? null });
    };
    requestAnimationFrame(tick);
  }, [phase.kind, rows, validation, skippedRows, spec, rowsAnnotated, linkedParent, fileName, importName, importDescription, bucketCounts.new, onApplied]);

  const dismissCompletion = (target: "listing" | "history" | { kind: "detail"; filter: RowFilter }) => {
    if (phase.kind !== "complete") return;
    const detailHref = spec.routes.recordHref(phase.importId);
    const parentHref = phase.correctionParentId ? spec.routes.recordHref(phase.correctionParentId) : null;
    onCompleted();
    if (target === "listing") navigate(spec.routes.listing, { replace: true });
    else if (target === "history") navigate(parentHref ?? detailHref);
    else navigate(`${detailHref}?filter=${target.filter}`);
  };

  /* ─── column resize + drag reorder ─── */
  const startResize = (key: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = columnWidths[key] ?? MIN_COL_WIDTH;
    setIsResizing(true);
    const onMove = (ev: PointerEvent) => setColumnWidths((prev) => ({ ...prev, [key]: Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, startW + ev.clientX - startX)) }));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setIsResizing(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const startColumnDrag = (key: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("[data-resize-handle]")) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let activated = false;
    const onMove = (ev: PointerEvent) => {
      if (!activated) {
        if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 5) return;
        activated = true;
        setDraggingColumnKey(key);
        document.body.style.userSelect = "none";
      }
      if (ghostElRef.current) ghostElRef.current.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
      const scroller = tableScrollRef.current;
      if (!scroller) return;
      const ths = Array.from(scroller.querySelectorAll<HTMLElement>("th[data-col-key]"));
      const others = ths.filter((th) => th.getAttribute("data-col-key") !== key);
      let insertBefore: string | null = null;
      for (const th of others) {
        const r = th.getBoundingClientRect();
        if (ev.clientX < r.left + r.width / 2) {
          insertBefore = th.getAttribute("data-col-key");
          break;
        }
      }
      setColumnOrder((prev) => {
        const without = prev.filter((k) => k !== key);
        const idx = insertBefore ? without.indexOf(insertBefore) : without.length;
        const next = [...without];
        next.splice(idx === -1 ? without.length : idx, 0, key);
        return next.every((k, i) => k === prev[i]) ? prev : next;
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      if (activated) {
        suppressNextClickRef.current = true;
        setDraggingColumnKey(null);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /* ─── selection ─── */
  const allPagedSelected = pagedRows.length > 0 && pagedRows.every((r) => selectedIds.has(r._id));
  const somePagedSelected = pagedRows.some((r) => selectedIds.has(r._id));
  const toggleAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPagedSelected) pagedRows.forEach((r) => next.delete(r._id));
      else pagedRows.forEach((r) => next.add(r._id));
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

  if (!open) return null;

  const running = phase.kind === "running";
  const rowHeight = density === "comfort" ? ROW_HEIGHT_COMFORT : ROW_HEIGHT_CONDENSED;
  const tabs: { id: StatusFilter; label: string; count: number; tone: ChipTone }[] = [
    { id: "all", label: "Show All", count: counts.total, tone: "blue" },
    { id: "ready", label: "Ready", count: counts.ready, tone: "green" },
    { id: "errors", label: "Errors", count: counts.errors, tone: "red" },
    { id: "warnings", label: "Warnings", count: counts.warnings, tone: "amber" },
  ];
  const emptyKind = rowsAnnotated.length === 0 ? "removed" : search.trim() ? "search" : tab === "errors" ? "errors" : tab === "warnings" ? "warnings" : tab === "ready" ? "ready" : "fallback";
  const bulkFields = spec.bulkSetFields.map((k) => columns.find((c) => c.key === k)).filter((c): c is ImportColumn => !!c);
  const rowBg = (r: AnnotatedRow, index: number) => (activeCell?.rowId === r._id ? "#E8F2FF" : hoveredRowId === r._id ? "#F1F5F9" : selectedIds.has(r._id) ? "#EFF6FF" : index % 2 === 1 ? "#F8FAFC" : "#FFFFFF");
  const thHeight = density === "comfort" ? "h-11" : "h-9";
  const thBase = `text-left align-middle px-3 whitespace-nowrap bg-[#F8FAFC] border-b border-[#CBD5E1] border-r border-r-border last:border-r-0 ${thHeight} sticky top-0`;
  const thStyle: React.CSSProperties = { fontSize: "12px", fontWeight: 500, color: "#64748B", lineHeight: "1.2" };
  const tdBase = "px-3 align-middle border-b border-[#F1F5F9] border-r border-r-[#F1F5F9] last:border-r-0";
  const tdStyle = (bg: string): React.CSSProperties => ({ height: rowHeight, fontSize: "13px", color: "#1E293B", fontFamily: CELL_FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", backgroundColor: bg });

  const menuItems = (r: AnnotatedRow) => (
    <>
      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => duplicateRow(r._id)}>
        <Copy className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
        Duplicate Row
      </DropdownMenuItem>
      {r._edited && (
        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => revertRow(r._id)}>
          <RotateCcw className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
          Revert Changes
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      {r._status === "error" && (
        <DropdownMenuItem className="cursor-pointer gap-2 text-[#DC2626] focus:text-[#DC2626]" onClick={() => skipErrorRows([r._id])}>
          <SkipForward className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
          Skip Row
        </DropdownMenuItem>
      )}
      <DropdownMenuItem className="cursor-pointer gap-2 text-[#DC2626] focus:text-[#DC2626]" onClick={() => deleteRows([r._id])}>
        <Trash2 className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
        Delete Row
      </DropdownMenuItem>
    </>
  );

  const renderColHeader = (col: ImportColumn) => {
    const width = columnWidths[col.key] ?? defaultColWidth(col);
    const sortActive = sort?.key === col.key;
    const hovered = hoveredHeaderKey === col.key;
    const isActive = activeCell?.field === col.key;
    const dragging = draggingColumnKey === col.key;
    const bg = isActive ? "#E8F2FF" : dragging ? "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)" : hovered ? "#F1F5F9" : "#F8FAFC";
    return (
      <th
        key={col.key}
        data-col-key={col.key}
        className={`${thBase} cursor-grab group/colheader z-20`}
        style={{ ...thStyle, width, minWidth: width, maxWidth: width, overflow: "hidden", position: "sticky", top: 0, background: bg, color: isActive ? "#0A77FF" : thStyle.color }}
        onMouseEnter={() => setHoveredHeaderKey(col.key)}
        onMouseLeave={() => setHoveredHeaderKey(null)}
        onPointerDown={(e) => startColumnDrag(col.key, e)}
      >
        {dragging && <span className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "#0A77FF" }} />}
        <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${dragging ? "opacity-100 text-[#0A77FF]" : "opacity-0 group-hover/colheader:opacity-100 text-[#94A3B8]"}`} />
        <div className="flex items-center justify-between gap-1 h-full pl-3 -ml-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={() => handleSort(col.key)} className="inline-flex items-center gap-1 text-left flex-1 min-w-0 hover:text-foreground transition-colors cursor-pointer" style={{ fontSize: "12px", fontWeight: 500, lineHeight: 1.2 }}>
                <span className="truncate">{col.label}</span>
                {sortActive ? (
                  sort!.dir === "asc" ? <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} /> : <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />
                ) : (
                  <ChevronsUpDown className="w-3 h-3 shrink-0" style={{ color: hovered ? "#64748B" : "#CBD5E1" }} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8} className="z-[200] max-w-[260px] bg-white border border-border text-foreground px-3 py-2 rounded-lg shadow-lg">
              <div style={{ fontSize: "12.5px", fontWeight: 600 }}>{col.label}</div>
              <div style={{ fontSize: "12px", lineHeight: 1.45, color: "#475569" }}>{col.description}</div>
              <TooltipPrimitive.Arrow width={10} height={5} style={{ fill: "white", stroke: "#E2E8F0", strokeWidth: 1 }} />
            </TooltipContent>
          </Tooltip>
        </div>
        <div
          data-resize-handle
          className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
          title="Drag to resize · double-click to reset"
          onPointerDown={(e) => startResize(col.key, e)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setColumnWidths((prev) => ({ ...prev, [col.key]: defaultColWidth(col) }));
          }}
        >
          <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${isResizing ? "bg-primary" : "bg-transparent group-hover/resize:bg-primary/40"}`} />
        </div>
      </th>
    );
  };

  const renderDataCell = (r: AnnotatedRow, col: ImportColumn, bg: string) => {
    const width = columnWidths[col.key] ?? defaultColWidth(col);
    const val = String(r[col.key] ?? "");
    const originalVal = String(r._originalData[col.key] ?? "");
    const issues: CellIssue[] = r._byField[col.key] ?? [];
    const severity = issues.some((i) => i.severity === "error") ? "error" : issues.length ? "warning" : null;
    const isEditing = editingCell?.rowId === r._id && editingCell.field === col.key;
    const isActive = !isEditing && activeCell?.rowId === r._id && activeCell.field === col.key;
    const isUpdateCell = r._isUpdate && col.key !== spec.keyColumn && val.trim() !== "" && !severity;
    const isEdited = val !== originalVal;
    const cellBg = isEditing ? CELL_SEVERITY_STYLE.editing.bg : severity === "error" ? CELL_SEVERITY_STYLE.error.bg : severity === "warning" ? CELL_SEVERITY_STYLE.warning.bg : isUpdateCell ? CELL_SEVERITY_STYLE.update.bg : draggingColumnKey === col.key ? "rgba(10,119,255,0.035)" : bg;
    const shadow = isEditing ? CELL_SEVERITY_STYLE.editing.shadow : isActive ? CELL_SEVERITY_STYLE.active.shadow : severity === "error" ? CELL_SEVERITY_STYLE.error.shadow : severity === "warning" ? CELL_SEVERITY_STYLE.warning.shadow : isUpdateCell ? CELL_SEVERITY_STYLE.update.shadow : undefined;
    const content = val ? (
      <span className="block overflow-hidden text-ellipsis" style={{ whiteSpace: "pre" }}>
        <HighlightMatch text={val} query={search} />
      </span>
    ) : (
      <span className="text-[#CBD5E1]">-</span>
    );
    return (
      <td
        key={col.key}
        className={tdBase}
        style={{ ...tdStyle(cellBg), width, minWidth: width, maxWidth: width, boxShadow: shadow, position: "relative", cursor: isEditing ? "text" : "cell", paddingLeft: isEditing ? 0 : undefined, paddingRight: isEditing ? 0 : undefined }}
        onClick={() => !isEditing && handleCellClick({ rowId: r._id, field: col.key })}
      >
        {isEdited && !isEditing && <EditedIndicator originalValue={originalVal} />}
        {isEditing ? (
          <CellInput
            column={col}
            value={val}
            referenceOptions={referenceOptions}
            onCommit={(next: string, dir?: CommitDir) => {
              commitEdit(r._id, col.key, next);
              if (dir) moveActiveCell({ rowId: r._id, field: col.key }, dir, true);
              else setEditingCell(null);
            }}
            onCancel={() => setEditingCell(null)}
          />
        ) : issues.length > 0 ? (
          <CellIssueTooltip issues={issues}>{content}</CellIssueTooltip>
        ) : isUpdateCell ? (
          <UpdateCellTooltip spec={spec}>{content}</UpdateCellTooltip>
        ) : (
          content
        )}
      </td>
    );
  };

  return createPortal(
    <TooltipProvider delayDuration={200}>
      <AnimatePresence>
        <motion.div key="review-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150]" onClick={attemptClose} />
        <div key="review-wrap" className={`fixed inset-0 z-[151] flex items-center justify-center pointer-events-none ${isFullScreen ? "p-3 lg:p-4" : "p-4 sm:p-6"}`}>
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
            className={`bg-white flex flex-col overflow-hidden pointer-events-auto transition-[max-width,max-height,width,height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              isFullScreen
                ? "w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] h-[calc(100vh-1.5rem)] max-h-[calc(100vh-1.5rem)] rounded-2xl lg:w-[calc(100vw-2rem)] lg:max-w-[calc(100vw-2rem)] lg:h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2rem)]"
                : "w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] max-h-[100dvh] rounded-2xl sm:w-[min(92vw,1280px)] sm:max-w-[min(92vw,1280px)] sm:h-auto sm:max-h-[80vh]"
            }`}
            style={{ boxShadow: PANEL_SHADOW }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 lg:px-6 py-4 shrink-0 bg-white border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-foreground truncate" style={{ fontSize: "17px", fontWeight: 700 }} title="Review and Fix Your Data">
                    Review and Fix Your Data
                  </h2>
                  <p className="text-[#64748B] mt-1" style={{ fontSize: "13px" }}>
                    Check your {spec.nounPluralLower} before importing. Rows with errors will not be imported until you fix them. Rows with warnings will import as they are.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsFullScreen((v) => !v)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-border bg-white text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                    style={{ fontSize: "12px", fontWeight: 500 }}
                    aria-label={isFullScreen ? "Exit full view" : "Enter full view"}
                  >
                    {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {isFullScreen ? "Exit Full View" : "Full View"}
                  </button>
                  <button type="button" onClick={attemptClose} disabled={running} className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Close">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <CorrectionBanner
              detection={detection}
              linked={linkToParent}
              onToggleLink={setLinkToParent}
              counts={bucketCounts}
              onRemoveAlreadyImported={() => deleteRows(rowsAnnotated.filter((r) => r._bucket === "resolved").map((r) => r._id))}
            />

            {/* Body */}
            <div className="flex-1 min-h-0 flex flex-col bg-[#F8FAFC] overflow-hidden">
              <div className="flex-1 min-h-0 flex flex-col mx-4 lg:mx-6 my-4 rounded-xl border border-border bg-white overflow-hidden">
                <div className="shrink-0 px-4 pt-3.5 pb-2 flex items-center justify-between gap-2">
                  <SearchBox
                    value={search}
                    onChange={(v) => {
                      setSearch(v);
                      resetPage();
                    }}
                    placeholder="Search records..."
                  />
                  <DensityDropdown density={density} onChange={setDensity} />
                </div>

                {selectedIds.size > 0 ? (
                  <div className="shrink-0 [&>div]:h-[52px]">
                    <ImportSelectionBar
                      count={selectedIds.size}
                      noun="row"
                      onClear={() => setSelectedIds(new Set())}
                      actions={
                        <>
                          {bulkFields.map((col) => (
                        <BulkSetDropdown key={col.key} label={`Set ${col.label}`} options={optionsForColumn(col, referenceOptions)} onPick={(v) => bulkSetField(selectedIds, col.key, v)} />
                      ))}
                          <button type="button" onClick={() => setPendingConfirm({ ids: Array.from(selectedIds) })} className={`${SELECTION_ACTION_BASE} ${SELECTION_ACTION_CLASS.destructive}`}><Trash2 className="w-3.5 h-3.5" /><span>Delete Rows</span><span className="opacity-80">({selectedIds.size})</span></button>
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
                          tone={t.tone}
                          active={tab === t.id}
                          onClick={() => {
                            setTab(t.id);
                            resetPage();
                          }}
                        />
                      ))}
                    </div>
                    {counts.errors > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => skipErrorRows(rowsAnnotated.filter((r) => r._status === "error").map((r) => r._id))}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] hover:border-[#FCA5A5] transition-colors cursor-pointer shrink-0"
                            style={{ fontSize: "12.5px", fontWeight: 500 }}
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                            Skip {counts.errors} Error {counts.errors === 1 ? "Row" : "Rows"}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8} className="z-[200] max-w-[260px] bg-white border border-border text-foreground px-3 py-2 rounded-lg shadow-lg">
                          <span style={{ fontSize: "12.5px", lineHeight: 1.45 }}>Excludes every row flagged as an error from this import. Skipped rows are kept for later review, valid rows still import.</span>
                          <TooltipPrimitive.Arrow width={10} height={5} style={{ fill: "white", stroke: "#E2E8F0", strokeWidth: 1 }} />
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}

                <div className="shrink-0 border-t border-border" />

                <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden relative">
                  <AnimatePresence>{phase.kind === "running" && <ImportingOverlay spec={spec} processed={phase.processed} total={phase.total} />}</AnimatePresence>
                  <div
                    ref={tableScrollRef}
                    onScroll={(e) => setIsScrolledX((e.currentTarget as HTMLDivElement).scrollLeft > 0)}
                    className={`flex-1 min-h-0 overflow-auto ${isResizing || draggingColumnKey ? "select-none" : ""}`}
                    style={{ scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}
                  >
                    <DensityContext.Provider value={density}>
                      <table className="border-separate" style={{ borderSpacing: 0, tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
                        <colgroup>
                          <col style={{ width: ROW_NUM_WIDTH }} />
                          <col style={{ width: SELECT_COL_WIDTH }} />
                          <col style={{ width: STATUS_COL_WIDTH }} />
                          {visibleColumns.map((c) => (
                            <col key={c.key} style={{ width: columnWidths[c.key] ?? defaultColWidth(c) }} />
                          ))}
                          <col style={{ width: ACTIONS_COL_WIDTH }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th className={`${thBase} z-30`} style={{ ...thStyle, left: 0, backgroundColor: "#FFFFFF", textAlign: "right", paddingLeft: 4, paddingRight: 8, position: "sticky", width: ROW_NUM_WIDTH }}>
                              <span style={{ color: "#94A3B8" }}>#</span>
                            </th>
                            <th className={`${thBase} z-30`} style={{ ...thStyle, left: ROW_NUM_WIDTH, textAlign: "center", paddingLeft: 0, paddingRight: 0, position: "sticky", width: SELECT_COL_WIDTH }}>
                              <TriCheckbox aria-label="Select all rows on page" checked={allPagedSelected ? true : somePagedSelected ? "indeterminate" : false} onCheckedChange={toggleAllOnPage} />
                            </th>
                            <th className={`${thBase} z-30`} style={{ ...thStyle, left: ROW_NUM_WIDTH + SELECT_COL_WIDTH, position: "sticky", width: STATUS_COL_WIDTH, boxShadow: isScrolledX ? FROZEN_RIGHT_SHADOW : undefined }}>
                              Result
                            </th>
                            {visibleColumns.map(renderColHeader)}
                            <th className={`${thBase} z-30`} style={{ ...thStyle, right: 0, position: "sticky", paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: "#334155", boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)", width: ACTIONS_COL_WIDTH }}>
                              <span className="text-[13px]">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedRows.map((r, index) => {
                            const bg = rowBg(r, index);
                            const isErr = r._status === "error";
                            const rowNumColor = activeCell?.rowId === r._id ? "#0A77FF" : isErr ? "#DC2626" : "#94A3B8";
                            const rowNumWeight = activeCell?.rowId === r._id ? 600 : isErr ? 500 : 400;
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
                                <td className={`${tdBase} sticky z-10`} style={{ ...tdStyle(bg), left: 0, textAlign: "right", paddingLeft: 4, paddingRight: 8, color: rowNumColor, fontWeight: rowNumWeight, fontVariantNumeric: "tabular-nums" }}>
                                  {r._position}
                                </td>
                                <td className={`${tdBase} sticky z-10`} style={{ ...tdStyle(bg), left: ROW_NUM_WIDTH, textAlign: "center", paddingLeft: 0, paddingRight: 0 }}>
                                  <TriCheckbox aria-label={`Select row ${r._position}`} checked={selectedIds.has(r._id)} onCheckedChange={(c) => toggleRowSelected(r._id, c === true)} />
                                </td>
                                <td className={`${tdBase} sticky z-10`} style={{ ...tdStyle(bg), left: ROW_NUM_WIDTH + SELECT_COL_WIDTH, boxShadow: isScrolledX ? FROZEN_RIGHT_SHADOW : undefined }}>
                                  <span className="inline-flex items-center gap-1.5">
                                    <StatusChip status={r._status} />
                                    {r._isUpdate && <RowOpBadge spec={spec} />}
                                    {isErr && <AlertTriangle strokeWidth={2.5} style={{ width: 13, height: 13, color: "#DC2626" }} />}
                                  </span>
                                </td>
                                {visibleColumns.map((col) => renderDataCell(r, col, bg))}
                                <td className={`${tdBase} sticky z-10`} style={{ ...tdStyle(bg), right: 0, paddingLeft: 8, paddingRight: 8, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button type="button" className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer" aria-label="Row actions">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[230px] z-[200]">
                                      {menuItems(r)}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </DensityContext.Provider>
                    {pagedRows.length === 0 && phase.kind !== "running" && (
                      <div className="sticky left-0" style={{ width: "100%", maxWidth: "100vw" }}>
                        <GridEmptyState kind={emptyKind} onCancelImport={onClose} onClearSearch={() => setSearch("")} />
                      </div>
                    )}
                  </div>
                  <Pagination
                    currentPage={pageSafe}
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
            <div className="shrink-0 border-t border-border bg-white px-4 lg:px-6 py-2.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={attemptClose}
                disabled={running}
                className={`inline-flex items-center justify-center h-9 px-4 rounded-md border border-border bg-white text-[#334155] shadow-sm transition-colors ${running ? "opacity-50 cursor-not-allowed" : "hover:bg-[#F8FAFC] hover:border-[#CBD5E1] cursor-pointer"}`}
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
        <DropdownMenu open onOpenChange={(o) => !o && setRowMenu(null)}>
          <DropdownMenuTrigger asChild>
            <span style={{ position: "fixed", left: rowMenu.x, top: rowMenu.y, width: 1, height: 1, zIndex: 199 }} aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[230px] z-[200]">
            {(() => {
              const r = rowsAnnotated.find((x) => x._id === rowMenu.rowId);
              return r ? menuItems(r) : null;
            })()}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <ConfirmDialog
        open={!!pendingConfirm}
        icon="trash"
        title="Delete These Rows?"
        message="This removes the rows you selected. The rest of your data stays as it is."
        confirmLabel="Delete Rows"
        cancelLabel="Cancel"
        maxWidth={440}
        onConfirm={() => {
          if (pendingConfirm) deleteRows(pendingConfirm.ids);
          setPendingConfirm(null);
        }}
        onCancel={() => setPendingConfirm(null)}
      />

      <AnimatePresence>
        {phase.kind === "complete" && (
          <ImportCompleteDialog
            key="complete"
            spec={spec}
            createdCount={phase.createdCount}
            updatedCount={phase.updatedCount}
            skippedCount={phase.skippedCount}
            warningCount={phase.warningCount}
            onViewDetail={(filter) => dismissCompletion({ kind: "detail", filter })}
            onGoToListing={() => dismissCompletion("listing")}
            onViewHistory={() => dismissCompletion("history")}
            historyLabel={phase.correctionParentId ? "View Original Import" : "View Import History"}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={showDiscardConfirm}
        title="Close Without Importing?"
        message={DISCARD_MESSAGE}
        confirmLabel="Discard"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />

      <div ref={ghostElRef} style={{ position: "fixed", top: 0, left: 0, zIndex: 9999, pointerEvents: "none", opacity: draggingColumnKey ? 1 : 0, transition: "opacity 80ms ease-out", willChange: "transform" }}>
        {draggingColumnKey && (
          <div
            className="flex items-center gap-1.5 h-[32px] pl-2 pr-3 rounded-md whitespace-nowrap"
            style={{ marginLeft: 12, marginTop: -14, backgroundColor: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(10,119,255,0.3)", boxShadow: "0 1px 3px rgba(10,119,255,0.08), 0 6px 20px rgba(0,0,0,0.10)" }}
          >
            <GripVertical className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />
            <span className="text-[13px]" style={{ color: "#0A77FF", fontWeight: 500 }}>
              {columns.find((c) => c.key === draggingColumnKey)?.label}
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>,
    document.body,
  );
}

export { normKey };
