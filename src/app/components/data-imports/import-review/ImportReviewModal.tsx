import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  Search,
  X,
  Maximize2,
  Minimize2,
  CircleX,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  MoreHorizontal,
  Trash2,
  Copy,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Upload,
  SearchX,
  GripVertical,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Checkbox } from "../../ui/checkbox";
import { cn } from "../../ui/utils";
import { pickExamples } from "../shared-cells/examples";
import { ImportColumnHeaderMenu } from "../table-columns/ImportColumnHeaderMenu";
import { ImportSelectionBar, SELECTION_ACTION_BASE, SELECTION_ACTION_CLASS } from "../ImportSelectionBar";
import { Pagination } from "../Pagination";
import {
  USER_REVIEW_COLUMNS,
  type UserReviewField,
  type UserReviewRow,
} from "./usersReviewMockData";
import { validateRows, type CellIssue, type RowStatus, type ValidationContext } from "./validation";
import { LicenseCellDropdown, RolesCellDropdown, SimpleCellDropdown } from "./CellFieldDropdowns";
import { DateCellEditor } from "../shared-cells/DateCellEditor";
import { addCompletedImport, addFixChildImport } from "../importHistory";
import { saveImportDetail } from "../importDetailStore";
import { clearPendingCorrection } from "../pendingCorrections";
import {
  detectCorrectionTarget,
  loadUsersParentSnapshot,
  linkRow,
  countBuckets,
  applyUsersCorrectionToParent,
  type CorrectionDetection,
  type RowLink,
} from "../correctionLink";
import { CorrectionBanner } from "./CorrectionBanner";
import type { ImportedUserRow, RowOutcome } from "../importRecords";
import { HighlightMatch } from "../../alerts-settings/HighlightMatch";
import {
  DensityContext,
  DensityDropdown,
  ROW_HEIGHT_COMFORT,
  ROW_HEIGHT_CONDENSED,
  useDensity,
  type DensityOption,
} from "../density";

export const SEARCH_HIGHLIGHT_CLASS = "bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5";

export type StatusFilter = "all" | "errors" | "warnings" | "ready";
type SortDir = "asc" | "desc";
export type NavDir = "right" | "down" | "left" | "up";

interface CellAddr {
  rowId: string;
  field: UserReviewField;
}

interface ManagedRow {
  id: string;
  data: UserReviewRow;
  /** Original uploaded values, used for revert & for the edited-cell triangle. */
  originalData: UserReviewRow;
}

export interface PendingConfirm {
  ids: string[];
  reason: "delete-selected";
}

export const ROW_NUM_WIDTH = 36;
export const SELECT_COL_WIDTH = 40;
/* Result column carries the status chip plus the New / Update badge that
 * tells the user whether the row will create a user or update an existing
 * one (matched by email). */
export const STATUS_COL_WIDTH = 150;
export const ACTIONS_COL_WIDTH = 72;

/* Right-side shadow cast by the rightmost frozen column (Result chip) once
 * the grid is scrolled horizontally, creates the visual seam between the
 * sticky identifier columns and the scrollable data area. */
export const FROZEN_RIGHT_SHADOW = "4px 0 8px rgba(0,0,0,0.06)";

/* Column width clamp, min keeps cells readable; max mirrors Excel's
 * 255-character convention (avg ~7px per char at the table's 13px font). */
export const MIN_COL_WIDTH = 80;
export const MAX_COL_WIDTH = 255 * 7;

const LICENSE_OPTIONS = ["Full Access", "Field User", "No License"];
/* Matches the Status values documented in OMNE_Users_Import_Guide.txt. The
 * import maps "Deactivated" onto the stored `Inactive` and still accepts a
 * file that spells it the old way. */
const STATUS_OPTIONS = ["Active", "Deactivated"];

const DISCARD_MESSAGE = "Your fixes on this screen will not be saved.";

function isSameCell(a: CellAddr | null, b: CellAddr | null): boolean {
  if (!a || !b) return a === b;
  return a.rowId === b.rowId && a.field === b.field;
}

function makeRowId(): string {
  return `r-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function makeInitialRows(source: UserReviewRow[]): ManagedRow[] {
  return source.map((r) => ({
    id: makeRowId(),
    data: { ...r },
    originalData: { ...r },
  }));
}

function isRowEdited(r: ManagedRow): boolean {
  for (const col of USER_REVIEW_COLUMNS) {
    if (r.data[col.key] !== r.originalData[col.key]) return true;
  }
  return false;
}

/** Map the editable review-row shape into the detail page's record shape.
 *  The fields are 1:1 and values pass through verbatim, a skipped row must
 *  keep exactly the data that produced its validation error, so the detail
 *  page can reproduce that error. `_row` / `_outcome` are filled in by the
 *  caller per record. */
function toImportedUserRowShape(r: UserReviewRow): Omit<ImportedUserRow, "_row" | "_outcome" | "_message"> {
  return {
    firstName: r.firstName,
    lastName: r.lastName,
    emailAddress: r.emailAddress,
    licenseType: r.licenseType,
    employeeStatus: r.status,
    assignedRoles: r.assignedRoles,
    username: r.username,
    gender: r.gender,
    dateOfBirth: r.dateOfBirth,
    preferredName: r.preferredName,
    pronouns: r.pronouns,
    jobTitle: r.jobTitle,
    personalEmail: r.personalEmail,
    mobile: r.mobile,
    workPhone: r.workPhone,
    homeAddress: r.homeAddress,
    workAddress: r.workAddress,
  };
}

/** Outcome of a successful import, split into create / update / skip so the
 *  host can fold each bucket back into its own data store. Also carries the
 *  warning count and the newly-minted import id so the host can show a
 *  post-import summary banner that deep-links to the import's detail page. */
export interface ImportOutcome {
  created: UserReviewRow[];
  updated: UserReviewRow[];
  skipped: UserReviewRow[];
  warningCount: number;
  importId: string;
}

interface ImportReviewModalProps {
  open: boolean;
  /** Close the review modal, returns user to the wizard. */
  onClose: () => void;
  /** Import succeeded and the user dismissed the complete dialog, close
   *  everything and refresh the upstream listing. */
  onCompleted: () => void;
  /** Fires once when the import finishes, with the rows split by outcome.
   *  The host page applies each bucket to its own user-list state. */
  onApplied?: (outcome: ImportOutcome) => void;
  moduleSlug: string;
  importName: string;
  /** Free-text description the admin typed in the wizard (may be empty). Stored
   *  with the import so the history table and detail header can surface it. */
  importDescription?: string;
  /** Original uploaded file name (e.g. "Q2_New_Hires.xlsx"). Stored alongside
   *  the import detail so the detail page header can show it. */
  fileName: string;
  /** Rows parsed out of the uploaded file. Empty arrays render the
   *  "everything removed" empty state. */
  parsedRows: UserReviewRow[];
  /** The import this upload was launched from, when it was launched from
   *  one. The primary correction signal. */
  sessionParentId?: string | null;
  /** Validation context, existing user emails (drives the upsert warning)
   *  and known role names (drives the role-not-found warning). */
  validationContext?: ValidationContext;
}

export function ImportReviewModal({
  open,
  onClose,
  onCompleted,
  onApplied,
  moduleSlug,
  importName,
  importDescription = "",
  fileName,
  parsedRows,
  sessionParentId = null,
  validationContext,
}: ImportReviewModalProps) {
  const navigate = useNavigate();

  /* Full-view by default; toggle to standard size. */
  const [isFullScreen, setIsFullScreen] = useState(true);

  /* Table density, defaults to Condensed on each open. */
  const [density, setDensity] = useState<DensityOption>("condensed");

  /* Managed list of rows, supports edit, delete, duplicate, revert. Seeded
   * from the parsed file each time the modal opens. */
  const [rows, setRows] = useState<ManagedRow[]>(() => makeInitialRows(parsedRows));

  /* Selected row IDs for bulk actions. */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* The currently focused cell (blue outline, supports arrow nav). */
  const [activeCell, setActiveCell] = useState<CellAddr | null>(null);

  /* The cell currently in edit mode (renders an input). */
  const [editingCell, setEditingCell] = useState<CellAddr | null>(null);

  /* Pending confirm for destructive bulk deletes. */
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  /* Rows removed via "Skip X error rows", retained (not discarded) so the
   * import results / failed-file output can surface them later. Separate
   * from rows deleted via the bulk action bar, which remain permanently
   * removed (existing behavior). */
  const [skippedRows, setSkippedRows] = useState<UserReviewRow[]>([]);

  /* Validation issues captured at the moment a row was skipped, indexed
   * positionally against `skippedRows`. Held as a ref because it never needs
   * to drive a re-render, only the import-time detail-record builder reads
   * it, and only once. */
  const skippedRowIssuesRef = useRef<string[][]>([]);

  /* Anchor + state for the right-click row context menu. */
  const [rowMenu, setRowMenu] = useState<{ rowId: string; x: number; y: number } | null>(null);

  /* Discard-changes confirmation when closing with unsaved edits. */
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  /* Start-import flow state machine. The completed phase carries the new
   * history entry's id so the completion dialog's "View Import History"
   * action can deep-link straight to its detail page. */
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
        /** Parent this run was recorded under, when it ran as a correction.
         *  Drives the completion dialog's "back to the original" route. */
        correctionParentId: string | null;
      };
  const [phase, setPhase] = useState<ImportPhase>({ kind: "idle" });

  /* Reset everything when the modal opens. */
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

  /* ── Correction linkage ───────────────────────────────────────────
   *
   * Whether this upload is a fix for an existing import, and if so which
   * of its rows it closes out. See correctionLink.ts for the three layers
   * that answer the first question. */

  /* Recomputed only on open, so the banner doesn't flicker while the admin
   * edits cells. */
  const detection = useMemo<CorrectionDetection>(() => {
    if (!open) return { kind: "none" };
    return detectCorrectionTarget({
      moduleSlug,
      sessionParentId,
      rowKeys: parsedRows.map((r) => r.emailAddress.trim().toLowerCase()),
      loadSnapshot: loadUsersParentSnapshot,
    });
  }, [open, moduleSlug, sessionParentId, parsedRows]);

  /* A stamped file or a launch from an import's own page links by default.
   * A key-matched guess never does, the admin confirms that one. Either way
   * the banner exposes the toggle: an inferred link the admin can neither
   * see nor undo would be worse than no link at all. */
  const [linkToParent, setLinkToParent] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLinkToParent(detection.kind === "linked" && detection.confidence !== "suggested");
  }, [open, detection]);

  const linkedParent = detection.kind === "linked" && linkToParent ? detection.parent : null;

  /* Per-row reconciliation. Recomputed as the grid is edited: the stamp is
   * stable, but the natural-key fallback follows whatever email the admin
   * is currently typing. */
  const rowLinks = useMemo<RowLink[]>(() => {
    if (!linkedParent) return rows.map(() => ({ bucket: "new" as const, parentRow: null }));
    return rows.map((r) => linkRow(linkedParent, r.data.emailAddress.trim().toLowerCase()));
  }, [rows, linkedParent]);

  const bucketCounts = useMemo(() => countBuckets(rowLinks), [rowLinks]);

  /* Rows whose parent counterpart has already been fixed, inline or by an
   * earlier correction. Re-importing them is harmless (the email matches an
   * existing user, so they patch rather than duplicate) but they inflate the
   * correction's numbers, so the banner offers to drop them. */
  const alreadyImportedIds = useMemo(
    () => rows.filter((_, i) => rowLinks[i]?.bucket === "resolved").map((r) => r.id),
    [rows, rowLinks],
  );


  /* Dirty when any cell or row count differs from the original upload, and
   * the import isn't already running/complete. */
  const isDirty = useMemo(() => {
    if (phase.kind === "running" || phase.kind === "complete") return false;
    if (rows.length !== parsedRows.length) return true;
    return rows.some((r) => isRowEdited(r));
  }, [rows, parsedRows.length, phase.kind]);

  /* Effective row data, fed to validation. */
  const effectiveRows = useMemo<UserReviewRow[]>(
    () => rows.map((r) => r.data),
    [rows],
  );

  /* Re-run validation whenever the rows or the cross-check context change.
   * The parent (UserAccessControl) memoizes the context per wizard-open so
   * the reference stays stable while the modal is on screen. */
  const validation = useMemo(
    () => validateRows(effectiveRows, validationContext ?? {}),
    [effectiveRows, validationContext],
  );

  const rowsAnnotated = useMemo(
    () =>
      rows.map((r, i) => ({
        ...r.data,
        _id: r.id,
        _position: i + 1,
        _originalData: r.originalData,
        _status: validation.rows[i].status,
        _byField: validation.rows[i].byField,
        _isUpdate: validation.rows[i].isUpdate,
        _edited: isRowEdited(r),
      })),
    [rows, validation],
  );

  /* Per-row validation messages indexed by row id. Used by `skipErrorRows`
   * to snapshot the error reason at the moment a row is skipped so the
   * Failed file (and the detail page's failed sub-row) explains why. */
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

  /* Tabs / search / sort / pagination */
  const [tab, setTab] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: UserReviewField; dir: SortDir } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);

  /* User-controllable column order (only the scrollable data columns, the
   * sticky row#/select/status/actions columns sit outside this list). */
  const [columnOrder, setColumnOrder] = useState<UserReviewField[]>(
    () => USER_REVIEW_COLUMNS.map((c) => c.key),
  );

  /* Resizable column widths */
  const [columnWidths, setColumnWidths] = useState<Record<UserReviewField, number>>(
    () =>
      USER_REVIEW_COLUMNS.reduce(
        (acc, col) => ({ ...acc, [col.key]: col.defaultWidth }),
        {} as Record<UserReviewField, number>,
      ),
  );

  /* Header-menu Hide / Freeze (Inventory Movement pattern). Frozen columns
   * sit first in columnOrder and join the sticky block after Result; a drag
   * never crosses the freeze boundary. */
  const [hiddenCols, setHiddenCols] = useState<Set<UserReviewField>>(() => new Set());
  const [frozenCols, setFrozenCols] = useState<Set<UserReviewField>>(() => new Set());
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
  const hideColumn = useCallback((key: UserReviewField) => {
    setHiddenCols((prev) => new Set(prev).add(key));
    setFrozenCols((prev) => { const n = new Set(prev); n.delete(key); return n; });
    setSort((cur) => (cur?.key === key ? null : cur));
  }, []);
  const toggleFreeze = useCallback((key: UserReviewField) => {
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

  /* Drag-to-reorder refs (Partners pattern, mouse-event based, live shuffle) */
  const colDragRef = useRef<{
    columnKey: UserReviewField;
    startX: number;
    startY: number;
    isDragging: boolean;
    lastSwapTime: number;
  } | null>(null);
  const suppressNextClickRef = useRef(false);
  const ghostElRef = useRef<HTMLDivElement>(null);
  const [draggingColumnKey, setDraggingColumnKey] = useState<UserReviewField | null>(null);

  /* Resize refs */
  const resizeRef = useRef<{
    columnKey: UserReviewField;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnKey, setResizingColumnKey] = useState<UserReviewField | null>(null);

  /* Row hover, used to paint a Slate 100 lane across every cell in the row. */
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  /* Header hover, paints a Slate 100 tint on the hovered column header and
   * darkens its sort icon so the cell reads as interactive (sortable). */
  const [hoveredHeaderKey, setHoveredHeaderKey] = useState<UserReviewField | null>(null);

  /* Horizontal scroll state, drives the frozen-column right-edge shadow.
   * Only `true` once the grid has been scrolled past column 0. */
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
      return USER_REVIEW_COLUMNS.some((c) => {
        const v = r[c.key];
        return typeof v === "string" && v.toLowerCase().includes(q);
      });
    });

    if (sort) {
      const { key, dir } = sort;
      list = [...list].sort((a, b) => {
        const av = String(a[key] ?? "");
        const bv = String(b[key] ?? "");
        const cmp = av.localeCompare(bv, undefined, { sensitivity: "base" });
        return dir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [rowsAnnotated, tab, search, sort]);

  /* recordsPerPage is Number.POSITIVE_INFINITY when the user picks "All" from
   * the dropdown, in that case there's exactly one page and the slice is
   * a no-op (Infinity * 0 = NaN, so the math needs an explicit guard). */
  const totalPages = Number.isFinite(recordsPerPage)
    ? Math.max(1, Math.ceil(filteredRows.length / recordsPerPage))
    : 1;
  const pagedRows = useMemo(() => {
    if (!Number.isFinite(recordsPerPage)) return filteredRows;
    const start = (currentPage - 1) * recordsPerPage;
    return filteredRows.slice(start, start + recordsPerPage);
  }, [filteredRows, currentPage, recordsPerPage]);

  const handleSort = (key: UserReviewField) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
    resetPage();
  };

  const colDef = useCallback(
    (key: UserReviewField) => USER_REVIEW_COLUMNS.find((c) => c.key === key)!,
    [],
  );

  /* Column resize, drag the right edge of a header. Double-click resets
   * the column to its default width. */
  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: UserReviewField) => {
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

  /* Column drag-to-reorder, grab anywhere on the header to start dragging.
   * Live shuffle: surrounding columns reorder as the cursor crosses their
   * bounds, matching the Partners listing behaviour. */
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: UserReviewField) => {
    if (isResizing) return;
    if (e.button !== 0) return;

    colDragRef.current = {
      columnKey,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
      lastSwapTime: 0,
    };

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
      if (ghost) {
        ghost.style.transform = `translate(${moveEvt.clientX}px, ${moveEvt.clientY}px)`;
      }

      const now = performance.now();
      if (now - colDragRef.current.lastSwapTime < SWAP_SETTLE_MS) return;

      const cursorX = moveEvt.clientX;
      const draggedKey = colDragRef.current.columnKey;

      const draggedTh = document.querySelector<HTMLElement>(`th[data-col-drag-key="${draggedKey}"]`);
      if (!draggedTh) return;
      const draggedRect = draggedTh.getBoundingClientRect();
      if (cursorX >= draggedRect.left && cursorX <= draggedRect.right) return;

      const allThs = document.querySelectorAll<HTMLElement>("th[data-col-drag-key]");
      for (const th of allThs) {
        const rect = th.getBoundingClientRect();
        if (cursorX < rect.left || cursorX > rect.right) continue;
        const k = th.getAttribute("data-col-drag-key") as UserReviewField | null;
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

      // Suppress the click that fires after mouseup so sort doesn't trigger.
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

  /* ── Edit + row state helpers ─────────────────────────────────── */

  const commitEdit = useCallback(
    (rowId: string, field: UserReviewField, next: string) => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId && r.data[field] !== next
            ? { ...r, data: { ...r.data, [field]: next } }
            : r,
        ),
      );
    },
    [],
  );

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

  /* Excludes error rows from the current import without discarding them.
   * Rows leave the active grid (same removal mechanics as deleteRows) but
   * their data is preserved in `skippedRows` so the import results can
   * surface them later. */
  const skipErrorRows = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setRows((prev) => {
      const retained: UserReviewRow[] = [];
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
      const dupData: UserReviewRow = { ...src.data, emailAddress: "" };
      const dup: ManagedRow = {
        id: makeRowId(),
        data: dupData,
        originalData: { ...dupData },
      };
      return [...prev.slice(0, idx + 1), dup, ...prev.slice(idx + 1)];
    });
  }, []);

  const revertRow = useCallback((rowId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, data: { ...r.originalData } } : r)),
    );
  }, []);

  const bulkSetField = useCallback(
    (ids: string[], field: UserReviewField, value: string) => {
      const idSet = new Set(ids);
      setRows((prev) =>
        prev.map((r) =>
          idSet.has(r.id) ? { ...r, data: { ...r.data, [field]: value } } : r,
        ),
      );
    },
    [],
  );

  const toggleRowSelected = useCallback((rowId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  }, []);

  /** Move the active/editing cell. `keepEditing` keeps edit mode on the next cell. */
  const moveActiveCell = useCallback(
    (from: CellAddr, dir: NavDir, keepEditing: boolean) => {
      const visibleIds = pagedRows.map((r) => r._id);
      const fromVisibleIdx = visibleIds.indexOf(from.rowId);
      const colIdx = USER_REVIEW_COLUMNS.findIndex((c) => c.key === from.field);
      let nextVisible = fromVisibleIdx;
      let nextCol = colIdx;
      if (dir === "right") {
        nextCol = colIdx + 1;
        if (nextCol >= USER_REVIEW_COLUMNS.length) { nextCol = 0; nextVisible = fromVisibleIdx + 1; }
      } else if (dir === "left") {
        nextCol = colIdx - 1;
        if (nextCol < 0) { nextCol = USER_REVIEW_COLUMNS.length - 1; nextVisible = fromVisibleIdx - 1; }
      } else if (dir === "down") {
        nextVisible = fromVisibleIdx + 1;
      } else if (dir === "up") {
        nextVisible = fromVisibleIdx - 1;
      }
      if (nextVisible < 0 || nextVisible >= visibleIds.length || fromVisibleIdx === -1) {
        if (!keepEditing) setEditingCell(null);
        return;
      }
      const next: CellAddr = {
        rowId: visibleIds[nextVisible],
        field: USER_REVIEW_COLUMNS[nextCol].key,
      };
      setActiveCell(next);
      setEditingCell(keepEditing ? next : null);
    },
    [pagedRows],
  );

  const handleCellClick = useCallback((addr: CellAddr) => {
    setActiveCell(addr);
    setEditingCell(addr);
  }, []);

  /* Arrow-key navigation when a cell is active but not being edited. */
  useEffect(() => {
    if (!open) return;
    if (editingCell || !activeCell) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          moveActiveCell(activeCell, "right", false);
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveActiveCell(activeCell, "left", false);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveActiveCell(activeCell, "down", false);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveActiveCell(activeCell, "up", false);
          break;
        case "Enter":
          e.preventDefault();
          setEditingCell(activeCell);
          break;
        case "Escape":
          e.preventDefault();
          setActiveCell(null);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, activeCell, editingCell, moveActiveCell]);

  /* If filtering / paging removed the editing row from view, drop edit mode. */
  useEffect(() => {
    if (!editingCell) return;
    const visible = pagedRows.some((r) => r._id === editingCell.rowId);
    if (!visible) setEditingCell(null);
  }, [pagedRows, editingCell]);

  /* Click-outside: any mousedown that doesn't land inside a table cell clears
   * the focus ring + edit mode. Clicks on other <td>s (the row number,
   * checkbox, or another data cell) are handled by their own click handlers. */
  useEffect(() => {
    if (!open) return;
    if (!activeCell && !editingCell) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("td")) return;
      /* A cell dropdown (License / Status / Roles) portals its panel to
       * <body>, outside any <td>. Clicks inside it are still "in the cell"
       * and must not tear down the editor. */
      if (target.closest("[data-cell-dropdown]")) return;
      setActiveCell(null);
      setEditingCell(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, activeCell, editingCell]);

  /* ── Close handling ─────────────────────────────────────────────── */

  const attemptClose = useCallback(() => {
    if (phase.kind === "running") return;
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }, [phase.kind, isDirty, onClose]);

  /* Escape key, top-level dialogs handle their own. */
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

  /* ── Start-import flow ──────────────────────────────────────────── */

  const runImport = useCallback(() => {
    if (counts.errors > 0) return;
    const total = rows.length;
    const warningCount = validation.warningRowCount;
    /* Skipped = exactly the rows the user excluded via "Skip error rows".
     * Rows deleted outright via the bulk action bar are removed from the
     * import entirely and never counted anywhere. */
    const skippedCount = skippedRows.length;

    /* Split kept rows into create / update buckets based on the live
     * validation result. Skipped rows come from `skippedRows`, retained
     * during the editing session. */
    const created: UserReviewRow[] = [];
    const updated: UserReviewRow[] = [];
    rows.forEach((r, i) => {
      const v = validation.rows[i];
      if (!v) return;
      if (v.isUpdate) updated.push({ ...r.data });
      else created.push({ ...r.data });
    });
    const skipped: UserReviewRow[] = skippedRows.map((r) => ({ ...r }));

    /* Build the per-record payload that the detail page will render. Each
     * imported (created or updated) row gets the "Created" outcome, the
     * detail UI labels that chip "Imported", which is what an admin reading
     * the history wants to see. Each skipped row carries the joined
     * validation messages as its error reason so the Failed filter (and the
     * downloaded failed file) explains why it didn't import. */
    let rowNumber = 0;
    const importedDetailRows: ImportedUserRow[] = [];
    const pushDetailRow = (data: UserReviewRow, outcome: RowOutcome, message?: string) => {
      rowNumber++;
      importedDetailRows.push({
        ...toImportedUserRowShape(data),
        _row: rowNumber,
        _outcome: outcome,
        ...(message ? { _message: message } : {}),
      });
    };
    for (const r of rows) {
      pushDetailRow(r.data, "Created");
    }
    skippedRows.forEach((r, i) => {
      /* Pull the row's recorded validation issues so the failed file carries
       * the same explanation as the on-screen error pill. */
      const messages = skippedRowIssuesRef.current[i] ?? [];
      const message = messages.length > 0
        ? messages.join(" ")
        : "Row was removed before import.";
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
      /* A correction is recorded under its parent's id so the two read as
       * one thread in the history store. */
      const importId = linkedParent
        ? `${linkedParent.id}-reimport-${Date.now()}`
        : `imp-${Date.now()}`;

      if (linkedParent) {
        /* Close out the parent rows this file actually fixed. Only rows that
         * imported AND map to a still-failing parent row count, a skipped
         * row leaves its parent counterpart failing, which is correct: it
         * still needs a pass. */
        const resolved = rows.flatMap((r, i) => {
          const link = rowLinks[i];
          if (!link || link.bucket !== "matched" || link.parentRow === null) return [];
          return [{ parentRow: link.parentRow, values: toImportedUserRowShape(r.data) }];
        });
        applyUsersCorrectionToParent(linkedParent.id, resolved);

        /* Describe the batch the way an audit reader needs to see it: what
         * got fixed, what came in fresh, and what is still outstanding. */
        const parts: string[] = [];
        if (bucketCounts.matched > 0) {
          parts.push(`${bucketCounts.matched} error row${bucketCounts.matched === 1 ? "" : "s"} fixed`);
        }
        if (bucketCounts.new > 0) {
          parts.push(`${bucketCounts.new} new row${bucketCounts.new === 1 ? "" : "s"}`);
        }
        if (skippedCount > 0) {
          parts.push(`${skippedCount} still failing`);
        }

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
          /* Recorded honestly. Unlike an inline fix, an uploaded file can
           * still carry bad rows; the tree stays one level deep, so those
           * stay counted against the parent rather than spawning a
           * grandchild. */
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

      /* Written for both paths, so a correction log is drillable in the
       * listing exactly like a top-level import. */
      saveImportDetail({
        id: importId,
        moduleSlug,
        name: importName,
        description: importDescription,
        dateISO: finishedAt,
        importerKey: "am",
        fileName: resolvedFileName,
        records: importedDetailRows,
      });
      /* Hand the kept rows back to the host page so it can fold them into
       * the listing data. Fires once per successful import. */
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
    skippedRows, onApplied, linkedParent, rowLinks, bucketCounts,
  ]);

  const dismissCompletion = useCallback(
    (
      target:
        | "history"
        | "users"
        | { kind: "detail"; filter: "imported" | "failed" },
    ) => {
      /* The detail-tab path must be captured before `onCompleted` flips the
       * phase back to idle, `phase.kind === "complete"` is what carries the
       * just-minted import id. */
      const detailHref =
        phase.kind === "complete"
          ? `/company-settings/data-imports/${moduleSlug}/${phase.importId}`
          : null;
      /* After a correction the useful destination is the import that was
       * being fixed, not the correction log, the question the admin has is
       * "did my errors clear?". The stat cards still deep-link into this
       * batch; only the secondary button reroutes. */
      const parentHref =
        phase.kind === "complete" && phase.correctionParentId
          ? `/company-settings/data-imports/${moduleSlug}/${phase.correctionParentId}`
          : null;
      onCompleted();
      if (target === "users") {
        navigate("/company-settings/user-access-control?tab=users", { replace: true });
      } else if (target === "history" && (parentHref ?? detailHref)) {
        /* Navigate to the new import's detail page in the SAME tab. Opening a
         * new tab reloads the app, which runs the per-load import-history reset
         * and would drop the import that was just created (its listing entry
         * lives in shared localStorage) — leaving a working detail page but an
         * empty listing. Same-tab navigation keeps the entry intact. */
        navigate((parentHref ?? detailHref) as string);
      } else if (typeof target === "object" && target.kind === "detail" && detailHref) {
        /* Stat-card deep-link → navigates in the same view, with the detail
         * page landing on the requested filter tab (Imported or Failed). */
        navigate(`${detailHref}?filter=${target.filter}`);
      }
    },
    [navigate, onCompleted, phase, moduleSlug],
  );

  /* Tabs */
  const tabs: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all",      label: "Show All", count: counts.total },
    { id: "ready",    label: "Ready",    count: counts.ready },
    { id: "errors",   label: "Errors",   count: counts.errors },
    { id: "warnings", label: "Warnings", count: counts.warnings },
  ];

  /* Shared renderer for sortable data-column headers, used for both the
   * frozen First Name column and every scrollable column. Centralizes the
   * sort/resize handles plus the hover and active-column visual states. */
  const renderColHeader = (
    key: UserReviewField,
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

    /* Background priority: active column > hover > drag preview > default. */
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
        data-col-drag-key={draggable ? col.key : undefined}
        onMouseDown={draggable ? (e) => handleHeaderMouseDown(e, col.key) : undefined}
        onMouseEnter={() => setHoveredHeaderKey(col.key)}
        onMouseLeave={() => setHoveredHeaderKey((k) => (k === col.key ? null : k))}
        className={cn(draggable && "cursor-grab", "group/colheader")}
        extraStyle={{
          width,
          overflow: "hidden",
          /* Force vertical stickiness for every data-column header (matches
           * the Result/First Name headers). Without this, the Tailwind
           * `relative` utility that used to live on these <th>s was winning
           * the position cascade and letting headers scroll out of view. */
          position: "sticky",
          top: 0,
          ...(textColor ? { color: textColor } : null),
          ...(opts.outerBoxShadow ? { boxShadow: opts.outerBoxShadow } : null),
          ...bgStyle,
        }}
      >
        {/* Blue accent on top edge of dragged header */}
        {isBeingDragged && (
          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "#0A77FF" }} />
        )}
        {/* Drag grip, only shown for draggable (non-sticky) columns. */}
        {draggable && (
          <GripVertical
            className={cn(
              "absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none",
              isBeingDragged
                ? "opacity-100 text-[#0A77FF]"
                : "opacity-0 group-hover/colheader:opacity-100 text-[#94A3B8]",
            )}
          />
        )}
        <div className={cn("flex items-center justify-between gap-1 h-full", draggable && "pl-3 -ml-3")}>
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
                    setSort(d ? { key: k as UserReviewField, dir: d } : null);
                    resetPage();
                  }}
                  onHide={(k) => hideColumn(k as UserReviewField)}
                  isFrozen={frozenCols.has(col.key)}
                  onFreeze={(k) => toggleFreeze(k as UserReviewField)}
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
              <TooltipPrimitive.Arrow
                width={10}
                height={5}
                style={{ fill: "white", stroke: "#E2E8F0", strokeWidth: 1 }}
              />
            </TooltipContent>
          </Tooltip>
        </div>
        {/* Resize handle, full-height right-edge hit area (5px), bar shows on hover/active. Double-click resets to default width. */}
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
              resizingColumnKey === col.key
                ? "bg-[#0A77FF]"
                : "bg-transparent group-hover/resize:bg-[#0A77FF]/40",
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
            {/* Backdrop sits above the wizard (z-[101]) but below complete/confirm dialogs (z-[300]+). */}
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
                        Check your users before importing. Rows with errors will not be imported until you fix them. Rows with warnings will import as they are.
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

                {/* ─── Correction banner ───
                  * Only mounts when this upload has something to say about
                  * its provenance. Everything it asserts is reversible from
                  * inside it. */}
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
                  {/* Card-wrapped listing area */}
                  <div className="flex-1 min-h-0 flex flex-col mx-4 lg:mx-6 my-4 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
                    {/* Search row */}
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

                    {/* Filter pills row OR bulk action bar (swap in place, no layout shift) */}
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
                          <BulkSetDropdown
                            label="Set License Type"
                            options={LICENSE_OPTIONS}
                            onPick={(v) => bulkSetField(Array.from(selectedIds), "licenseType", v)}
                          />
                          <BulkSetDropdown
                            label="Set Status"
                            options={STATUS_OPTIONS}
                            onPick={(v) => bulkSetField(Array.from(selectedIds), "status", v)}
                          />
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
                              tone={
                                t.id === "errors" ? "red"
                                : t.id === "warnings" ? "amber"
                                : t.id === "ready" ? "green"
                                : "blue"
                              }
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
                              <TooltipPrimitive.Arrow
                                width={10}
                                height={5}
                                style={{ fill: "white", stroke: "#E2E8F0", strokeWidth: 1 }}
                              />
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}

                    {/* The selection bar draws its own bottom border. */}
                    {selectedIds.size === 0 && <div className="shrink-0 border-t border-[#E2E8F0]" />}

                    {/* Data grid */}
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
                              Importing {phase.total} {phase.total === 1 ? "user" : "users"}...
                            </p>
                            <p className="text-[#64748B] tabular-nums" style={{ fontSize: "12.5px" }}>
                              Importing... {phase.processed} of {phase.total} users processed
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div
                      ref={tableScrollRef}
                      onScroll={handleTableScroll}
                      className={cn(
                        "flex-1 min-h-0 overflow-auto",
                        (isResizing || draggingColumnKey) && "select-none",
                      )}
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
                                    pagedRows.length > 0 &&
                                    pagedRows.every((r) => selectedIds.has(r._id))
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
                              /* Zebra: alternate stripes, first paged row is white,
                               * the next sits on Slate 50, and so on. */
                              const isZebra = rowIdx % 2 === 1;

                              /* Row-base background priority:
                               *   active (clicked) > hover > selected > zebra > white.
                               * Per-cell error/warning tints layer on top inside
                               * EditableDataCell and are not overridden by these. */
                              const rowBg = isActiveRow ? "#E8F2FF"
                                : isHoveredRow ? "#F1F5F9"
                                : selected ? "#EFF6FF"
                                : isZebra ? "#F8FAFC"
                                : "#FFFFFF";

                              const rowNum = row._position;
                              const isErrorRow = row._status === "error";
                              const rowNumColor = isActiveRow ? "#0A77FF"
                                : isErrorRow ? "#DC2626"
                                : "#94A3B8";
                              const rowNumWeight = isActiveRow ? 600
                                : isErrorRow ? 500
                                : 400;

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
                                    extraStyle={{
                                      width: SELECT_COL_WIDTH,
                                      backgroundColor: rowBg,
                                      textAlign: "center",
                                      paddingLeft: 0,
                                      paddingRight: 0,
                                    }}
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
                                      {row._isUpdate && <RowOpBadge />}
                                      {row._status === "error" && (
                                        <AlertTriangle
                                          aria-hidden
                                          strokeWidth={2.5}
                                          style={{ width: 13, height: 13, color: "#DC2626" }}
                                        />
                                      )}
                                    </span>
                                  </BodyTd>
                                  {visibleOrder.map((key) => {
                                    const col = colDef(key);
                                    const val = String(row[col.key] ?? "");
                                    const cellIssues = row._byField[col.key];
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
                                    /* On an update row, every present (non-blank)
                                     * value will overwrite the existing user's
                                     * field on import, highlight those cells.
                                     * Email is the matching key (never updated)
                                     * and error/warning highlights win. */
                                    const isUpdateCell =
                                      row._isUpdate &&
                                      col.key !== "emailAddress" &&
                                      val.trim() !== "" &&
                                      !cellSeverity;
                                    return (
                                      <EditableDataCell
                                        key={col.key}
                                        addr={addr}
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
                              tab === "errors"   ? counts.errors
                              : tab === "warnings" ? counts.warnings
                              : tab === "ready"    ? counts.ready
                              : counts.total
                            }
                            onClearSearch={() => { setSearch(""); resetPage(); }}
                            onCancelImport={attemptClose}
                          />
                        </div>
                      )}
                    </div>

                    {/* Table-footer pagination (matches Users / Imports listing) */}
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
                      phase.kind === "running"
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-[#F8FAFC] hover:border-[#CBD5E1] cursor-pointer",
                    )}
                    style={{ fontSize: "13px", fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                  <StartImportButton
                    errorCount={counts.errors}
                    running={phase.kind === "running"}
                    onStart={runImport}
                  />
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Right-click row context menu */}
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
          historyLabel={phase.correctionParentId ? "View Original Import" : undefined}
          onViewHistory={() => dismissCompletion("history")}
          onGoToUsers={() => dismissCompletion("users")}
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

      {/* Column-drag ghost, DOM-positioned via transform for zero re-renders */}
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
              {colDef(draggingColumnKey).label}
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>,
    document.body,
  );
}

/* ──────── Sub-components ──────── */

type ChipTone = "blue" | "red" | "amber" | "green";

const CHIP_ACTIVE_TONES: Record<ChipTone, {
  border: string;
  bg: string;
  text: string;
  badgeBg: string;
  badgeText: string;
}> = {
  blue:  { border: "#0A77FF", bg: "#EDF4FF", text: "#0A77FF", badgeBg: "rgba(10,119,255,0.1)",  badgeText: "#0A77FF" },
  red:   { border: "#FCA5A5", bg: "#FEF2F2", text: "#B91C1C", badgeBg: "rgba(220,38,38,0.10)",   badgeText: "#B91C1C" },
  amber: { border: "#FCD34D", bg: "#FFFBEB", text: "#B45309", badgeBg: "rgba(180,83,9,0.12)",    badgeText: "#B45309" },
  green: { border: "#86EFAC", bg: "#ECFDF5", text: "#047857", badgeBg: "rgba(4,120,87,0.12)",    badgeText: "#047857" },
};

export function FilterChip({
  label,
  count,
  tone = "blue",
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone?: ChipTone;
  active: boolean;
  onClick: () => void;
}) {
  const t = CHIP_ACTIVE_TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 transition-colors cursor-pointer",
        !active && "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] hover:border-[#CBD5E1]",
      )}
      style={{
        fontSize: "12px",
        fontWeight: active ? 500 : 400,
        ...(active
          ? { borderColor: t.border, backgroundColor: t.bg, color: t.text }
          : null),
      }}
    >
      {label}
      <span
        className={cn(
          "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full tabular-nums",
          !active && "bg-[#F1F5F9] text-[#475569]",
        )}
        style={{
          fontSize: "10px",
          fontWeight: 600,
          ...(active ? { backgroundColor: t.badgeBg, color: t.badgeText } : null),
        }}
      >
        {count}
      </span>
    </button>
  );
}

const ROW_STATUS_TOKENS: Record<RowStatus, { bg: string; text: string; border: string; label: string }> = {
  ready:   { bg: "#ECFDF5", text: "#065F46", border: "#D1FAE5", label: "Ready" },
  warning: { bg: "#FFFBEB", text: "#92400E", border: "#FEF3C7", label: "Warning" },
  error:   { bg: "#FEF2F2", text: "#991B1B", border: "#FEE2E2", label: "Error" },
};

/** Update indicator shown next to the status chip, the row's email matched
 *  an existing user, so the row will update that user. Create rows carry no
 *  badge. Reuses the filter-chip badge styling (same dimensions and palette
 *  as the count badges above the table). */
export function RowOpBadge({
  title = "Email matches an existing user. This row will update that user.",
}: { title?: string } = {}) {
  return (
    <span
      className="inline-flex items-center justify-center h-[18px] px-1.5 rounded-full whitespace-nowrap"
      style={{
        fontSize: "10px",
        fontWeight: 600,
        backgroundColor: CHIP_ACTIVE_TONES.blue.badgeBg,
        color: CHIP_ACTIVE_TONES.blue.badgeText,
      }}
      title={title}
    >
      Update
    </span>
  );
}

export function StatusChip({ status }: { status: RowStatus }) {
  const t = ROW_STATUS_TOKENS[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full border whitespace-nowrap"
      style={{ fontSize: "11px", fontWeight: 600, backgroundColor: t.bg, color: t.text, borderColor: t.border }}
      aria-label={status}
    >
      {t.label}
    </span>
  );
}

export function GridEmptyState({
  rowsTotal,
  searchActive,
  tab,
  tabCount,
  onClearSearch,
  onCancelImport,
}: {
  rowsTotal: number;
  searchActive: boolean;
  tab: StatusFilter;
  tabCount: number;
  onClearSearch: () => void;
  onCancelImport: () => void;
}) {
  if (rowsTotal === 0) {
    return (
      <EmptyStateLayout>
        <EmptyIcon tone="slate">
          <Upload className="w-7 h-7" style={{ color: "#64748B" }} />
        </EmptyIcon>
        <EmptyTitle>All Rows Have Been Removed.</EmptyTitle>
        <EmptySubtitle>There is nothing left to import.</EmptySubtitle>
        <div className="mt-4">
          <button
            type="button"
            onClick={onCancelImport}
            className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontSize: "13px", fontWeight: 500 }}
          >
            Cancel Import
          </button>
        </div>
      </EmptyStateLayout>
    );
  }

  if (searchActive) {
    return (
      <EmptyStateLayout>
        <EmptyIcon tone="slate">
          <SearchX className="w-7 h-7" style={{ color: "#64748B" }} />
        </EmptyIcon>
        <EmptyTitle>No Rows Match Your Search.</EmptyTitle>
        <div className="mt-3">
          <button
            type="button"
            onClick={onClearSearch}
            className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontSize: "13px", fontWeight: 500 }}
          >
            Clear Search
          </button>
        </div>
      </EmptyStateLayout>
    );
  }

  if (tab === "errors" && tabCount === 0) {
    return (
      <EmptyStateLayout>
        <EmptyIcon tone="green">
          <CheckCircle2 className="w-7 h-7" style={{ color: "#059669" }} />
        </EmptyIcon>
        <EmptyTitle>No Errors.</EmptyTitle>
        <EmptySubtitle>Every row is ready to import.</EmptySubtitle>
      </EmptyStateLayout>
    );
  }
  if (tab === "warnings" && tabCount === 0) {
    return (
      <EmptyStateLayout>
        <EmptyIcon tone="green">
          <CheckCircle2 className="w-7 h-7" style={{ color: "#059669" }} />
        </EmptyIcon>
        <EmptyTitle>No Warnings.</EmptyTitle>
        <EmptySubtitle>Every row looks good.</EmptySubtitle>
      </EmptyStateLayout>
    );
  }
  if (tab === "ready" && tabCount === 0) {
    return (
      <EmptyStateLayout>
        <EmptyIcon tone="amber">
          <AlertTriangle className="w-7 h-7" style={{ color: "#B45309" }} />
        </EmptyIcon>
        <EmptyTitle>No Rows Are Ready Yet.</EmptyTitle>
        <EmptySubtitle>Fix the errors to get your rows ready.</EmptySubtitle>
      </EmptyStateLayout>
    );
  }

  return (
    <EmptyStateLayout>
      <EmptyIcon tone="slate">
        <SearchX className="w-7 h-7" style={{ color: "#64748B" }} />
      </EmptyIcon>
      <EmptyTitle>No Rows to Display.</EmptyTitle>
    </EmptyStateLayout>
  );
}

function EmptyStateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {children}
    </div>
  );
}

function EmptyIcon({ tone, children }: { tone: "slate" | "green" | "amber"; children: React.ReactNode }) {
  const tones: Record<typeof tone, string> = {
    slate: "#F1F5F9",
    green: "#D1FAE5",
    amber: "#FEF3C7",
  };
  return (
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
      style={{ backgroundColor: tones[tone] }}
    >
      {children}
    </div>
  );
}

function EmptyTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[#334155]" style={{ fontSize: "14px", fontWeight: 600 }}>
      {children}
    </p>
  );
}

function EmptySubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[#64748B] mt-1" style={{ fontSize: "13px" }}>
      {children}
    </p>
  );
}

export interface IssueGuide {
  explanation: string;
  example: string;
  /** Optional inline chip list (used for INVALID_DROPDOWN to show all valid values). */
  options?: string[];
}

function describeIssue(issue: CellIssue): IssueGuide {
  switch (issue.code) {
    case "REQUIRED_EMPTY": {
      /* The three asterisked columns in the template, and nothing else.
       * License is deliberately not here: it is optional and warns instead. */
      const byField: Partial<Record<UserReviewField, IssueGuide>> = {
        firstName:    { explanation: "First name is required. Every user needs one to be created in Omne.",                            example: "Sarah" },
        lastName:     { explanation: "Last name is required. It joins the first name to form the full name shown across Omne.",        example: "Patel" },
        emailAddress: { explanation: "Email is required. The user signs in with it and receives notifications at it.",                 example: "robert.patel@acme.com" },
      };
      return byField[issue.field] ?? { explanation: issue.message, example: "" };
    }
    case "MISSING_LICENSE":
      return {
        explanation: "License is optional, so this row will still import. Left blank, the user lands with No License and cannot act in Omne until one is assigned.",
        example: "",
        options: ["Full Access", "Field User", "No License"],
      };
    case "INVALID_EMAIL":
      return {
        explanation: "This is not a valid email address. Check for typos and missing parts like the @ sign.",
        example: "",
      };
    case "DUPLICATE_EMAIL": {
      const m = issue.message.match(/row ([\d, ]+)/i);
      const rowRef = m ? `row ${m[1].trim()}` : "another row";
      return {
        explanation: `This email is also in ${rowRef}. Each user needs a unique email. Use a different email, or remove one of the rows.`,
        example: "",
      };
    }
    case "INVALID_DROPDOWN":
      return {
        explanation: "This is not a license Omne offers, so the user will import with No License. Choose Full Access, Field User, or No License.",
        example: "",
        options: ["Full Access", "Field User", "No License"],
      };
    case "INVALID_PHONE":
      return {
        explanation: "This phone number doesn't look like a standard format. It will import as-is, you can clean it up later.",
        example: "+1 404-555-0142",
      };
    case "ROLE_NOT_FOUND":
      return {
        explanation: "One or more of these roles don't exist in Omne. The user will still import, the unknown roles just won't be applied.",
        example: "Administrator|Warehouse Manager",
      };
  }
}

const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/** Hover explainer for cells whose value will overwrite the matched existing
 *  user's field, same shell and trigger mechanics as CellIssueTooltip, with
 *  a blue "Update" badge instead of the severity badge. */
export function UpdateCellTooltip({
  children,
  text = "This row updates an existing user, matched by email. This value will replace the user's current value on import.",
}: {
  children: React.ReactNode;
  /** Tooltip copy. Defaults to the Users wording. */
  text?: string;
}) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        {/* Trigger fills the cell so the tooltip fires from anywhere in the
         *  cell, not just where the text glyphs are. Negative inline margin
         *  cancels the parent td's px-3 padding so the hover area also
         *  reaches the cell's left/right edges. */}
        <span
          className="flex items-center cursor-help"
          style={{
            height: "100%",
            width: "calc(100% + 24px)",
            marginLeft: -12,
            marginRight: -12,
            paddingLeft: 12,
            paddingRight: 12,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "pre",
          }}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        collisionPadding={12}
        className="z-[200] max-w-[320px] bg-white border border-[#E2E8F0] rounded-lg p-0"
        style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.10)" }}
      >
        <div className="p-3 flex flex-col gap-2">
          <span
            className="inline-flex items-center self-start px-2 py-0.5 rounded-full border whitespace-nowrap"
            style={{ fontSize: "11px", fontWeight: 600, backgroundColor: "#EFF6FF", color: "#0A77FF", borderColor: "#BFDBFE" }}
          >
            Update
          </span>
          <p className="text-[#1E293B]" style={{ fontSize: "13px", fontWeight: 400, lineHeight: 1.5 }}>
            {text}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function CellIssueTooltip({
  issues,
  children,
  describe = describeIssue,
}: {
  issues: CellIssue[];
  children: React.ReactNode;
  /** Tooltip guide per issue. Defaults to the Users rules' copy. */
  describe?: (issue: CellIssue) => IssueGuide;
}) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        {/* Trigger fills the cell so the tooltip fires from anywhere in the
         *  cell, not just where the text glyphs are. Negative inline margin
         *  cancels the parent td's px-3 padding so the hover area also
         *  reaches the cell's left/right edges. */}
        <span
          className="flex items-center cursor-help"
          style={{
            height: "100%",
            width: "calc(100% + 24px)",
            marginLeft: -12,
            marginRight: -12,
            paddingLeft: 12,
            paddingRight: 12,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "pre",
          }}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        collisionPadding={12}
        className="z-[200] max-w-[320px] bg-white border border-[#E2E8F0] rounded-lg p-0"
        style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.10)" }}
      >
        <div className="flex flex-col">
          {issues.map((issue, i) => {
            const guide = describe(issue);
            const isError = issue.severity === "error";
            const badgeBg = isError ? "#FEF2F2" : "#FFFBEB";
            const badgeText = isError ? "#DC2626" : "#B45309";
            const badgeBorder = isError ? "#FECACA" : "#FDE68A";
            return (
              <div key={i} className={cn("p-3 flex flex-col gap-2", i > 0 && "border-t border-[#E2E8F0]")}>
                {/* Badge */}
                <span
                  className="inline-flex items-center self-start px-2 py-0.5 rounded-full border whitespace-nowrap"
                  style={{ fontSize: "11px", fontWeight: 600, backgroundColor: badgeBg, color: badgeText, borderColor: badgeBorder }}
                >
                  {isError ? "Error" : "Warning"}
                </span>

                {/* Explanation */}
                <p className="text-[#1E293B]" style={{ fontSize: "13px", fontWeight: 400, lineHeight: 1.5 }}>
                  {guide.explanation}
                </p>

                {/* Correct values: the column's example plus a few valid options,
                    never the whole list (see shared-cells/examples.ts). */}
                {(() => {
                  const examples = pickExamples(guide.example, guide.options);
                  if (examples.length === 0) return null;
                  return (
                    <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2 flex flex-col gap-1">
                      <span
                        className="text-[#94A3B8]"
                        style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}
                      >
                        {examples.length === 1 ? "Example" : "Examples"}
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        {examples.map((opt) => (
                          <span
                            key={opt}
                            className="inline-flex items-center px-1.5 py-0.5 rounded border border-[#E2E8F0] bg-white text-[#334155]"
                            style={{ fontSize: "12px", fontWeight: 500, fontFamily: MONO_FONT }}
                          >
                            {opt}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
        <TooltipPrimitive.Arrow
          width={10}
          height={5}
          style={{ fill: "white", stroke: "#E2E8F0", strokeWidth: 1 }}
        />
      </TooltipContent>
    </Tooltip>
  );
}

export function StartImportButton({
  errorCount,
  running,
  onStart,
}: {
  errorCount: number;
  running: boolean;
  onStart: () => void;
}) {
  const disabled = errorCount > 0 || running;
  const button = (
    <button
      type="button"
      disabled={disabled}
      onClick={running ? undefined : onStart}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md shadow-sm transition-colors",
        disabled
          ? "bg-[#0A77FF]/40 text-white cursor-not-allowed"
          : "bg-[#0A77FF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white cursor-pointer",
      )}
      style={{ fontSize: "13px", fontWeight: 600 }}
    >
      {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {running ? "Importing..." : "Start Import"}
    </button>
  );
  if (!disabled || running) return button;
  const msg = `Fix all errors before importing. ${errorCount} ${errorCount === 1 ? "error" : "errors"} remaining.`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-block cursor-not-allowed">
          <span style={{ pointerEvents: "none" }} className="inline-block">
            {button}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        /* z-[200] lifts the tooltip above the review modal stack (z-[151]),
         * without it the content mounts at the shared z-50 default and is
         * covered by the modal footer, so the disabled button reads as
         * unexplained. */
        className="z-[200] max-w-[260px] bg-white border border-[#FCA5A5] text-[#991B1B] px-3 py-2 rounded-lg shadow-lg"
      >
        <div className="flex items-start gap-1.5">
          <CircleX className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#EF4444" }} />
          <span style={{ fontSize: "12.5px", lineHeight: 1.4, fontWeight: 500 }}>{msg}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function BulkSetDropdown({
  label,
  options,
  onPick,
}: {
  label: string;
  options: string[];
  onPick: (value: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`${SELECTION_ACTION_BASE} ${SELECTION_ACTION_CLASS.neutral}`}
        >
          {label}
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="min-w-[160px] z-[200] bg-white border border-[#E2E8F0] rounded-lg py-1 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.18)]"
      >
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onSelect={() => onPick(opt)}
            className="px-3 py-1.5 cursor-pointer text-[#0F172A] data-[highlighted]:bg-[#F1F5F9]"
            style={{ fontSize: "13px" }}
          >
            {opt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* Row action items. Styling mirrors the user-listing actions menu: neutral
 * items on top, a separator, then the two that remove the row from this
 * import (Skip and Delete, both red on request). Revert only appears once the
 * row has edits to undo, Skip only on an error row, since that is the only
 * status the import can exclude. */
function RowActionsMenuItems({
  edited,
  isError,
  onDelete,
  onDuplicate,
  onRevert,
  onSkip,
}: {
  edited: boolean;
  isError: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onRevert: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <DropdownMenuItem onSelect={onDuplicate} className="cursor-pointer gap-2">
        <Copy className="w-3.5 h-3.5 text-[#64748B]" />
        Duplicate Row
      </DropdownMenuItem>
      {edited && (
        <DropdownMenuItem onSelect={onRevert} className="cursor-pointer gap-2">
          <RotateCcw className="w-3.5 h-3.5 text-[#64748B]" />
          Revert Changes
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      {isError && (
        <DropdownMenuItem
          onSelect={onSkip}
          className="gap-2 cursor-pointer text-[#DC2626] focus:text-[#DC2626]"
        >
          <SkipForward className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
          Skip Row
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        onSelect={onDelete}
        className="gap-2 cursor-pointer text-[#DC2626] focus:text-[#DC2626]"
      >
        <Trash2 className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
        Delete Row
      </DropdownMenuItem>
    </>
  );
}

export function RowActionsButton({
  edited,
  isError,
  onDelete,
  onDuplicate,
  onRevert,
  onSkip,
}: {
  edited: boolean;
  isError: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onRevert: () => void;
  onSkip: () => void;
}) {
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
      {/* z-[200] lifts the panel above the review modal stack (z-[151]),
          without it the menu opens behind the modal and reads as dead. */}
      <DropdownMenuContent align="end" className="w-[230px] z-[200]">
        <RowActionsMenuItems
          edited={edited}
          isError={isError}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onRevert={onRevert}
          onSkip={onSkip}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FloatingRowContextMenu({
  position,
  edited,
  isError,
  onClose,
  onDelete,
  onDuplicate,
  onRevert,
  onSkip,
}: {
  position: { x: number; y: number } | null;
  edited: boolean;
  isError: boolean;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRevert: () => void;
  onSkip: () => void;
}) {
  const open = position !== null;
  return (
    <DropdownMenu open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          tabIndex={-1}
          style={{
            position: "fixed",
            top: position?.y ?? -1000,
            left: position?.x ?? -1000,
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={0}
        className="w-[230px] z-[200]"
      >
        <RowActionsMenuItems
          edited={edited}
          isError={isError}
          onDelete={() => { onClose(); onDelete(); }}
          onDuplicate={() => { onClose(); onDuplicate(); }}
          onRevert={() => { onClose(); onRevert(); }}
          onSkip={() => { onClose(); onSkip(); }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function HeaderTh({
  children,
  sticky,
  stickyLeft,
  extraStyle,
  className,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  "data-col-drag-key": dataColDragKey,
}: {
  children: React.ReactNode;
  sticky?: boolean;
  stickyLeft?: number;
  extraStyle?: React.CSSProperties;
  className?: string;
  onMouseDown?: React.MouseEventHandler<HTMLTableCellElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLTableCellElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLTableCellElement>;
  "data-col-drag-key"?: string;
}) {
  const density = useDensity();
  return (
    <th
      data-col-drag-key={dataColDragKey}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "text-left align-middle px-3 whitespace-nowrap bg-[#F8FAFC] border-b border-[#CBD5E1] border-r border-r-[#E2E8F0] last:border-r-0",
        density === "comfort" ? "h-11" : "h-9",
        "sticky top-0",
        sticky && "z-30",
        className,
      )}
      style={{
        fontSize: "12px",
        fontWeight: 500,
        color: "#64748B",
        lineHeight: "1.2",
        zIndex: sticky ? 30 : 20,
        ...(sticky && typeof stickyLeft === "number" ? { left: stickyLeft, position: "sticky" } : null),
        ...extraStyle,
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
  extraStyle,
  title,
  onClick,
  onDoubleClick,
  tinted,
}: {
  children: React.ReactNode;
  sticky?: boolean;
  stickyLeft?: number;
  extraStyle?: React.CSSProperties;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLTableCellElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLTableCellElement>;
  /** Cell carries a meaning-bearing tint (active row, severity, edit ring)
   *  that the shared row hover must not paint over. */
  tinted?: boolean;
}) {
  const density = useDensity();
  const rowHeight = density === "comfort" ? ROW_HEIGHT_COMFORT : ROW_HEIGHT_CONDENSED;
  return (
    <td
      className={cn(
        "px-3 align-middle border-b border-[#F1F5F9] border-r border-r-[#F1F5F9] last:border-r-0",
        sticky && "sticky z-10",
      )}
      style={{
        height: rowHeight,
        fontSize: "13px",
        color: "#1E293B",
        fontFamily: "Aptos, Inter, ui-sans-serif, system-ui, -apple-system",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        ...(sticky && typeof stickyLeft === "number" ? { left: stickyLeft } : null),
        ...extraStyle,
      }}
      title={title}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      data-cell-tint={tinted ? "" : undefined}
    >
      {children}
    </td>
  );
}

interface EditableDataCellProps {
  addr: CellAddr;
  value: string;
  originalValue: string;
  issues: CellIssue[] | undefined;
  severity: "error" | "warning" | null;
  /** True when this cell's value will overwrite the matched existing user's
   *  field on import (update row, non-blank, not the email matching key).
   *  Renders the blue update highlight + tooltip; severity wins over it. */
  isUpdateCell?: boolean;
  isEditing: boolean;
  isActive: boolean;
  isEdited: boolean;
  width: number;
  rowBg: string;
  /** Optional column-level background override (e.g. the faint blue tint
   *  applied to cells in the column currently being drag-reordered). */
  cellBg?: string;
  /** Render the cell as a sticky-left column (used for the frozen
   *  First Name identifier column). */
  sticky?: boolean;
  stickyLeft?: number;
  /** Extra outer drop shadow appended to the cell's existing inset shadows,
   *  used to render the frozen-column seam when scrolled horizontally. */
  outerBoxShadow?: string;
  /** Row-level tint the hover must keep (active row). */
  tinted?: boolean;
  searchQuery: string;
  onClick: () => void;
  onCommit: (next: string, dir?: NavDir) => void;
  onCancel: () => void;
  /** Editor shown while the cell is in edit mode. Defaults to CellInput. */
  renderInput?: (p: { initialValue: string; onCommit: (next: string, dir?: NavDir) => void; onCancel: () => void }) => React.ReactNode;
  /** Issue tooltip guide. Defaults to the Users rules' copy. */
  describe?: (issue: CellIssue) => IssueGuide;
  /** Update-cell tooltip copy. Defaults to the Users wording. */
  updateText?: string;
}

export function EditableDataCell({
  addr,
  value,
  originalValue,
  issues,
  severity,
  isUpdateCell,
  isEditing,
  isActive,
  isEdited,
  width,
  rowBg,
  cellBg,
  sticky,
  stickyLeft,
  outerBoxShadow,
  tinted,
  searchQuery,
  onClick,
  onCommit,
  onCancel,
  renderInput,
  describe,
  updateText,
}: EditableDataCellProps) {
  const bg =
    isEditing ? "#FFFFFF"
    : severity === "error" ? "#FEF2F2"
    : severity === "warning" ? "#FFFBEB"
    : isUpdateCell ? "#EFF6FF"
    : cellBg ?? rowBg;

  const baseShadow =
    isEditing ? "inset 0 0 0 2px #0A77FF, inset 0 0 0 3px rgba(10,119,255,0.15)"
    : isActive ? "inset 0 0 0 2px #0A77FF"
    : severity === "error" ? "inset 0 0 0 1px #FECACA"
    : severity === "warning" ? "inset 0 0 0 1px #FDE68A"
    : isUpdateCell ? "inset 0 0 0 1px #BFDBFE"
    : null;
  const shadow = [baseShadow, outerBoxShadow].filter(Boolean).join(", ") || undefined;

  const paddingLeft = isEditing ? 0 : undefined;
  const paddingRight = isEditing ? 0 : undefined;

  const baseInner = value
    ? (
      <span
        className="block overflow-hidden text-ellipsis"
        style={{ whiteSpace: "pre" }}
      >
        <HighlightMatch text={value} query={searchQuery} matchClassName={SEARCH_HIGHLIGHT_CLASS} />
      </span>
    )
    : <span className="text-[#CBD5E1]">-</span>;

  const displayContent = issues
    ? <CellIssueTooltip issues={issues} describe={describe}>{baseInner}</CellIssueTooltip>
    : isUpdateCell
      ? <UpdateCellTooltip text={updateText}>{baseInner}</UpdateCellTooltip>
      : baseInner;

  return (
    <BodyTd
      sticky={sticky}
      stickyLeft={stickyLeft}
      tinted={tinted || isEditing || isActive || !!severity || !!isUpdateCell}
      title={isEditing || issues || isUpdateCell ? undefined : value}
      extraStyle={{
        width,
        backgroundColor: bg,
        boxShadow: shadow,
        paddingLeft,
        paddingRight,
        position: sticky ? "sticky" : "relative",
        cursor: isEditing ? "text" : "cell",
      }}
      onClick={isEditing ? undefined : onClick}
      onDoubleClick={isEditing ? undefined : onClick}
    >
      {isEdited && !isEditing && (
        <EditedIndicator originalValue={originalValue} />
      )}
      {isEditing && renderInput
        ? renderInput({ initialValue: value, onCommit, onCancel })
        : isEditing
        ? <CellInput
            initialValue={value}
            field={addr.field}
            onCommit={onCommit}
            onCancel={onCancel}
          />
        : displayContent}
    </BodyTd>
  );
}

function EditedIndicator({ originalValue }: { originalValue: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label="Edited cell"
          className="absolute top-0 left-0 cursor-help"
          style={{
            width: 0,
            height: 0,
            borderTop: "6px solid #0A77FF",
            borderRight: "6px solid transparent",
            zIndex: 2,
          }}
        />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-[260px] bg-white border border-[#BFDBFE] text-[#0F172A] px-3 py-2 rounded-lg shadow-lg"
      >
        <div className="flex items-start gap-1.5">
          <span style={{ fontSize: "12.5px", lineHeight: 1.4, fontWeight: 500 }}>
            Edited, original value: {originalValue ? `"${originalValue}"` : <em className="text-[#94A3B8] not-italic">empty</em>}
          </span>
        </div>
        <TooltipPrimitive.Arrow width={10} height={5} style={{ fill: "white", stroke: "#BFDBFE", strokeWidth: 1 }} />
      </TooltipContent>
    </Tooltip>
  );
}

interface CellInputProps {
  initialValue: string;
  field: UserReviewField;
  onCommit: (next: string, dir?: NavDir) => void;
  onCancel: () => void;
}

export function CellInput({ initialValue, field, onCommit, onCancel }: CellInputProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const finalizedRef = useRef(false);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const finalize = (mode: "commit" | "cancel", next: string, dir?: NavDir) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    if (mode === "cancel") onCancel();
    else onCommit(next, dir);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finalize("commit", value, "down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      finalize("commit", value, e.shiftKey ? "left" : "right");
    } else if (e.key === "Escape") {
      e.preventDefault();
      finalize("cancel", value);
    }
  };

  const handleBlur = () => {
    finalize("commit", value);
  };

  const sharedStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    fontFamily: "Aptos, Inter, ui-sans-serif, system-ui, -apple-system",
    fontSize: "13px",
    color: "#1E293B",
    padding: "0 12px",
  };

  /* License / Status / Assigned Roles are edited through design-system
   * dropdowns (see CellFieldDropdowns) rather than an OS <select>. Each
   * mounts already open and owns its own commit/cancel lifecycle (single
   * fire, guarded internally), so the shared text-input focus/blur/keydown
   * handlers above don't apply and onCommit/onCancel pass straight through. */
  if (field === "licenseType") {
    return <LicenseCellDropdown value={value} onCommit={onCommit} onCancel={onCancel} />;
  }
  if (field === "status") {
    return <SimpleCellDropdown value={value} options={STATUS_OPTIONS} onCommit={onCommit} onCancel={onCancel} />;
  }
  if (field === "assignedRoles") {
    return <RolesCellDropdown value={value} onCommit={onCommit} onCancel={onCancel} />;
  }

  /* Date of Birth: typed in the cell (any common order, saved as the
   * template's YYYY-MM-DD) or picked from the calendar icon. */
  if (field === "dateOfBirth") {
    return <DateCellEditor value={initialValue} format="iso" onCommit={onCommit} onCancel={onCancel} />;
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={sharedStyle}
    />
  );
}

export function BulkDeleteConfirm({
  confirm,
  onConfirm,
  onCancel,
}: {
  confirm: PendingConfirm | null;
  onConfirm: (ids: string[]) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!confirm) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirm, onCancel]);

  const open = confirm !== null;
  const title = "Delete These Rows?";
  const message = "This removes the rows you selected. The rest of your data stays as it is.";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 z-[300]"
            onClick={onCancel}
          />
          <div className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              role="alertdialog"
              aria-labelledby="bulk-delete-title"
              aria-describedby="bulk-delete-desc"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl overflow-hidden pointer-events-auto w-[calc(100vw-2rem)] max-w-[440px] flex flex-col"
              style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)" }}
            >
              <div
                className="relative px-6 pt-8 pb-4 flex flex-col items-center"
                style={{
                  background:
                    "radial-gradient(120% 100% at 50% 0%, #FEE2E2 0%, rgba(254,226,226,0.4) 40%, rgba(255,255,255,0) 75%)",
                }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: "rgba(254,202,202,0.45)" }}
                >
                  <Trash2 className="w-8 h-8" style={{ color: "#DC2626" }} strokeWidth={2} />
                </div>
              </div>
              <div className="px-6 pb-2 text-center">
                <h2 id="bulk-delete-title" className="text-[#0F172A]" style={{ fontSize: "18px", fontWeight: 700 }}>
                  {title}
                </h2>
                <p id="bulk-delete-desc" className="text-[#64748B] mt-2" style={{ fontSize: "13px", lineHeight: 1.55 }}>
                  {message}
                </p>
              </div>
              <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => confirm && onConfirm(confirm.ids)}
                  autoFocus
                  className="w-full h-11 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white shadow-sm transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  Delete Rows
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full h-11 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ImportCompleteDialog({
  createdCount,
  updatedCount,
  skippedCount,
  warningCount,
  onViewHistory,
  onGoToUsers,
  onViewDetail,
  historyLabel = "View Import History",
  entityLabel = "Users",
  primaryLabel = "View Users Listing",
}: {
  /** Plural noun on the Created / Updated cards. Defaults to "Users". */
  entityLabel?: string;
  /** Primary button label. Defaults to "View Users Listing". */
  primaryLabel?: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  warningCount: number;
  onViewHistory: () => void;
  onGoToUsers: () => void;
  /** Label for the secondary button. Defaults to "View Import History" (the
   *  wizard flow); the in-log correction flow overrides it with "View Updates". */
  historyLabel?: string;
  /* Deep-link to this import's detail page on a specific filter tab. The
   * detail page only exposes "imported" / "failed" filters, so warnings
   * (a subset of imported rows) reuse the imported tab, cell-level
   * highlights still surface the warning rows there. */
  onViewDetail: (filter: "imported" | "failed") => void;
}) {
  return createPortal(
    <AnimatePresence>
      <motion.div
        key="complete-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 bg-black/50 z-[300]"
      />
      <div key="complete-wrap" className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          role="dialog"
          aria-labelledby="import-complete-title"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
          className="bg-white rounded-2xl overflow-hidden pointer-events-auto w-[calc(100vw-2rem)] max-w-[460px] flex flex-col"
          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)" }}
        >
          <div
            className="relative px-6 pt-8 pb-4 flex flex-col items-center"
            style={{
              background:
                "radial-gradient(120% 100% at 50% 0%, #D1FAE5 0%, rgba(209,250,229,0.4) 40%, rgba(255,255,255,0) 75%)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(167,243,208,0.45)" }}
            >
              <CheckCircle2 className="w-9 h-9" style={{ color: "#059669" }} strokeWidth={2} />
            </div>
            <h2 id="import-complete-title" className="text-[#0F172A] mt-4" style={{ fontSize: "20px", fontWeight: 700 }}>
              Import Complete
            </h2>
          </div>

          <div className="px-6 pb-5 grid grid-cols-2 gap-3">
            <SummaryCard
              label={`${entityLabel} Created`}
              count={createdCount}
              onClick={() => onViewDetail("imported")}
            />
            <SummaryCard
              label={`${entityLabel} Updated`}
              count={updatedCount}
              onClick={() => onViewDetail("imported")}
            />
            <SummaryCard
              label="Rows Skipped"
              count={skippedCount}
              onClick={() => onViewDetail("failed")}
            />
            <SummaryCard
              label="Warnings"
              count={warningCount}
              onClick={() => onViewDetail("imported")}
            />
          </div>

          <div className="px-6 pt-2 pb-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onGoToUsers}
              autoFocus
              className="w-full h-11 rounded-xl bg-[#10B981] hover:bg-[#059669] active:bg-[#047857] text-white shadow-sm transition-colors cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              onClick={onViewHistory}
              className="w-full h-11 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] transition-colors cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              {historyLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}

function SummaryCard({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick?: () => void;
}) {
  /* Cards become clickable only when their count is meaningful (> 0). The
   * hover treatment (lift + blue border tint) mirrors the existing
   * clickable-card pattern in DataImportModuleCardGrid. */
  const isClickable = count > 0 && !!onClick;
  const body = (
    <>
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="text-[#64748B]" style={{ fontSize: "12.5px", fontWeight: 500 }}>
          {label}
        </span>
        <span className="text-[#0F172A] tabular-nums" style={{ fontSize: "22px", fontWeight: 600, lineHeight: 1 }}>
          {count}
        </span>
      </div>
      {isClickable && (
        <ChevronRight className="w-4 h-4 shrink-0 self-start mt-0.5" style={{ color: "#94A3B8" }} aria-hidden />
      )}
    </>
  );
  const baseClass =
    "rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 flex items-start justify-between gap-2";
  if (!isClickable) {
    return <div className={baseClass}>{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${count}. View on import detail page.`}
      className={cn(
        baseClass,
        "text-left transition-all cursor-pointer hover:shadow-md hover:border-[#0A77FF]/30",
      )}
    >
      {body}
    </button>
  );
}

export function DiscardConfirmModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 z-[300]"
            onClick={onCancel}
          />
          <div className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              role="alertdialog"
              aria-labelledby="discard-review-title"
              aria-describedby="discard-review-desc"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl overflow-hidden pointer-events-auto w-[calc(100vw-2rem)] max-w-[420px] flex flex-col"
              style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)" }}
            >
              <div
                className="relative px-6 pt-8 pb-4 flex flex-col items-center"
                style={{
                  background:
                    "radial-gradient(120% 100% at 50% 0%, #FEE2E2 0%, rgba(254,226,226,0.4) 40%, rgba(255,255,255,0) 75%)",
                }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: "rgba(254,202,202,0.45)" }}
                >
                  <AlertTriangle className="w-8 h-8" style={{ color: "#DC2626" }} strokeWidth={2} />
                </div>
              </div>

              <div className="px-6 pb-2 text-center">
                <h2 id="discard-review-title" className="text-[#0F172A]" style={{ fontSize: "20px", fontWeight: 700 }}>
                  Close Without Importing?
                </h2>
                <p
                  id="discard-review-desc"
                  className="text-[#64748B] mt-2"
                  style={{ fontSize: "13.5px", lineHeight: 1.55 }}
                >
                  {DISCARD_MESSAGE}
                </p>
              </div>

              <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={onConfirm}
                  autoFocus
                  className="w-full h-11 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white shadow-sm transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full h-11 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  Keep Editing
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
