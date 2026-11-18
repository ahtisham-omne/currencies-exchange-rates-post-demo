import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronDown,
  CircleX,
  TriangleAlert,
  FileInput,
  FileText,
  Info,
  FileSpreadsheet,
  Loader2,
  Search,
  X,
  Mail,
  Phone,
  Clock,
  User,
  Upload,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { cn } from "../ui/utils";
import { getModuleBySlug, resolveImportSurface } from "./moduleData";
import { Pagination } from "./Pagination";
import { ExpandableDescription } from "../shared/ExpandableDescription";
import { HighlightMatch } from "../alerts-settings/HighlightMatch";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card";
import { Checkbox } from "../ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  DensityContext,
  DensityDropdown,
  ROW_HEIGHT_COMFORT,
  ROW_HEIGHT_CONDENSED,
  useDensity,
  type DensityOption,
} from "./density";
import { validateRows } from "./import-review/validation";
import type { UserReviewField, UserReviewRow } from "./import-review/usersReviewMockData";
import { CellInput, CellIssueTooltip, ImportCompleteDialog } from "./import-review/ImportReviewModal";
import {
  DOWNLOAD_META,
  IMPORT_RECORD_COLUMNS,
  type ImportedUserRow,
  type RowFilter,
  type RowOutcome,
  isFailed,
  isImported,
  importNameToFilenameStem,
} from "./importRecords";
import { exportImportRecords } from "./importDetailExport";
import { exportTemplateRecords } from "./importTemplateExport";
import { getImportDetail, saveImportDetail } from "./importDetailStore";
import { getCompletedImports, updateCompletedImportCounts, addFixChildImport } from "./importHistory";
import { getImporter, type Importer as ImporterUser, type ImporterKey } from "./importers";
import { reviewRowToUserRow, reviewRowToUserUpdate, UsersImportWizard } from "./import-wizard/UsersImportWizard";
import { ImportWizardModal } from "./import-wizard/ImportWizardModal";
import { CorrectionStrip } from "./CorrectionStrip";
import { ImportSelectionBar } from "./ImportSelectionBar";
import { ExpandWidthButton, WIDTH_TRANSITION_CLASS, useExpandedWidth } from "./ExpandWidthButton";
import { ImportColumnHeaderMenu } from "./table-columns/ImportColumnHeaderMenu";
import { useColumnControls } from "./table-columns/useColumnControls";
import {
  startPendingCorrection,
  clearPendingCorrection,
  getPendingCorrection,
  subscribeToPendingCorrections,
  type PendingCorrection,
} from "./pendingCorrections";
import {
  getCurrentUserEmails,
  getCurrentRoleNames,
  makeImportedUserId,
  upsertImportedUsers,
} from "../../data/users-row-store";

export const HIGHLIGHT_CLASS = "bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5";
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/* ────────────────────────────────────
   Types
   ──────────────────────────────────── */

type Importer = ImporterUser;

export function ImporterOverviewCard({ user }: { user: Importer }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white">
      {/* Dark header */}
      <div className="relative px-4 py-4 overflow-hidden" style={{ backgroundColor: "#1B2637" }}>
        <div
          aria-hidden
          className="absolute -right-6 -top-6 w-24 h-24 rounded-full pointer-events-none"
          style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
        />
        <div className="relative flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: user.bg }}
          >
            <span style={{ fontSize: "15px", fontWeight: 600, color: user.fg }}>
              {user.initials}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-white truncate" style={{ fontSize: "15px", fontWeight: 600 }} title={user.name}>
              {user.name}
            </p>
            <p className="text-[#94A3B8] mt-0.5" style={{ fontSize: "12.5px" }}>
              {user.role}
            </p>
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Mail className="w-4 h-4 shrink-0" style={{ color: "#94A3B8" }} />
          <span className="text-[#334155] truncate" style={{ fontSize: "13px" }} title={user.email}>
            {user.email}
          </span>
        </div>
        <div className="flex items-center gap-2.5 min-w-0">
          <Phone className="w-4 h-4 shrink-0" style={{ color: "#94A3B8" }} />
          <span className="text-[#334155]" style={{ fontSize: "13px" }}>
            {user.phone}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────
   Tokens
   ──────────────────────────────────── */

export const ROW_OUTCOME_TOKENS: Record<RowOutcome, { bg: string; text: string; border: string }> = {
  Created: { bg: "#ECFDF5", text: "#065F46", border: "#D1FAE5" },
  /* Skipped rows are surfaced as "Error" with the red palette, the import
   * flow only skips on validation failures, so the user-facing label and
   * treatment match the failure semantics rather than the legacy "warning"
   * tone. Failed shares the same tokens. */
  Skipped: { bg: "#FEF2F2", text: "#991B1B", border: "#FEE2E2" },
  Failed:  { bg: "#FEF2F2", text: "#991B1B", border: "#FEE2E2" },
};

/* Display outcome, adds a transient "Ready" state for rows that were
 * originally Failed but have been edited to a passing-validation state.
 * Same green palette as Created (the Ready chip in the Review and Fix Your
 * Data step uses identical tokens); no new colors introduced. */
export type DisplayOutcome = "imported" | "ready" | "failed" | "skipped";

/* Cell-level severity treatment, copied verbatim from the Import Review
 * modal's EditableDataCell so error / warning cells read identically across
 * both surfaces. Background fill + inset 1px border. */
export const CELL_SEVERITY_BG: Record<"error" | "warning", string> = {
  error:   "#FEF2F2",
  warning: "#FFFBEB",
};
export const CELL_SEVERITY_SHADOW: Record<"error" | "warning", string> = {
  error:   "inset 0 0 0 1px #FECACA",
  warning: "inset 0 0 0 1px #FDE68A",
};

/* ImportedUserRow → UserReviewRow shape expected by `validateRows`. The only
 * field-name difference is `employeeStatus` → `status`; all 21 other columns
 * line up 1:1. The audit fields (_row / _outcome / _message) are dropped. */
function toReviewRow(r: ImportedUserRow): UserReviewRow {
  const { _row, _outcome, _message, employeeStatus, ...rest } = r;
  void _row; void _outcome; void _message;
  return { ...rest, status: employeeStatus };
}

/* Maps the detail page's column key to the validation field key. Returns
 * undefined for keys that have no validation counterpart (e.g. audit columns
 * if they ever appear in COLUMNS). */
function reviewFieldFromColKey(key: keyof ImportedUserRow): UserReviewField | undefined {
  if (key === "employeeStatus") return "status";
  if (key === "_row" || key === "_outcome" || key === "_message") return undefined;
  return key as UserReviewField;
}

/* Fold a committed edit back into the ImportedUserRow shape so the row can be
 * persisted via saveImportDetail. Values pass through verbatim, because
 * preserving the user's exact input is the point. Note that the commit gate
 * (no validation errors) does NOT imply every enum-like field holds a valid
 * value: License warns rather than errors, so a blank or unrecognised license
 * can reach here. That is intended, and the listing mapper resolves it to
 * No License. Mirrors the Review modal's toImportedUserRowShape (it's the same
 * upsert path), but kept local to avoid widening the modal's public surface. */
function fromReviewRow(orig: ImportedUserRow, review: UserReviewRow): ImportedUserRow {
  return {
    firstName: review.firstName,
    lastName: review.lastName,
    emailAddress: review.emailAddress,
    licenseType: review.licenseType,
    employeeStatus: review.status,
    assignedRoles: review.assignedRoles,
    username: review.username,
    gender: review.gender,
    dateOfBirth: review.dateOfBirth,
    preferredName: review.preferredName,
    pronouns: review.pronouns,
    jobTitle: review.jobTitle,
    personalEmail: review.personalEmail,
    mobile: review.mobile,
    workPhone: review.workPhone,
    homeAddress: review.homeAddress,
    workAddress: review.workAddress,
    _row: orig._row,
    _outcome: orig._outcome,
    _message: orig._message,
  };
}

export const RESULT_COL_WIDTH = 90;
export const SELECT_COL_WIDTH = 44;

const COLUMNS = IMPORT_RECORD_COLUMNS;
const ROW_COL_WIDTH = 64;
/** Width of the always-pinned leading block (checkbox, Row, Result). */
const LEADING_WIDTH = SELECT_COL_WIDTH + ROW_COL_WIDTH + RESULT_COL_WIDTH;

/* ────────────────────────────────────
   Page
   ──────────────────────────────────── */

export function ImportRecordDetailPage() {
  const { moduleSlug = "", importId = "" } = useParams<{ moduleSlug: string; importId: string }>();
  const navigate = useNavigate();
  const moduleDef = getModuleBySlug(moduleSlug);

  /* Optional `?filter=imported|failed` deep-link from the Import Complete
   * modal's stat cards, read once on mount so the page lands directly on
   * the relevant tab. Anything else (including absence) falls back to the
   * standard "all" view. Subsequent in-page filter clicks are kept in local
   * state and don't write back to the URL, matching the existing chip
   * behavior. */
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<RowFilter>(() => {
    const f = searchParams.get("filter");
    return f === "imported" || f === "failed" ? f : "all";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [density, setDensity] = useState<DensityOption>("condensed");
  const { isExpanded, setIsExpanded, containerMaxWidth } = useExpandedWidth();
  const columns = useColumnControls(COLUMNS);
  const { visibleColumns } = columns;
  const frozenLeft = columns.frozenLefts(LEADING_WIDTH);
  const hasFrozen = columns.frozenColumns.length > 0;
  const lastFrozenKey = hasFrozen ? columns.frozenColumns[columns.frozenColumns.length - 1].key : null;
  const tableMinWidth = LEADING_WIDTH + visibleColumns.reduce((acc, c) => acc + c.width, 0);
  /* Keyed by _row, that field is the stable per-record identifier inside an
   * import slice. Selection never leaks across imports or filters because we
   * reset the set whenever rowsForImport or `filter` changes (effect below). */
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  /* ── Inline fix-and-re-import state (Failed view) ──────────────────
   * `rowEdits`: per-row overlay of the user's edits. Keyed by _row so the
   *   overlay survives selection / paging.
   * `committedRowIds`: rows the user has already committed via the "Import N
   *   fixed rows" button, they keep their original filter membership until
   *   the user changes filters, at which point they fall out (see snapshot).
   * `editingCell`: the cell currently in edit mode. Reuses the Review and
   *   Fix Your Data step's CellInput interaction verbatim. */
  const [rowEdits, setRowEdits] = useState<Map<number, Partial<UserReviewRow>>>(new Map());
  const [committedRowIds, setCommittedRowIds] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowNumber: number; field: UserReviewField } | null>(null);

  /* Import phase, mirrors the wizard's running / complete progression so
   * the user sees the same "Importing N items" overlay and the same Import
   * Complete dialog when the corrected rows are re-imported. */
  type ImportPhase =
    | { kind: "idle" }
    | { kind: "running"; processed: number; total: number }
    | {
        kind: "complete";
        importId: string;
        createdCount: number;
        updatedCount: number;
        skippedCount: number;
        warningCount: number;
      };
  const [phase, setPhase] = useState<ImportPhase>({ kind: "idle" });

  /* Rows just fixed and re-imported in the current session. "View Updates" on
   * the completion dialog pulses them in place for 1500ms so the admin can see
   * exactly which rows were added, without a new import log or page. */
  const [pulseRowIds, setPulseRowIds] = useState<Set<number>>(new Set());
  const pulseTimerRef = useRef<number | null>(null);
  const lastCommittedRowsRef = useRef<Set<number>>(new Set());
  const pulseFixedRows = useCallback(() => {
    const ids = lastCommittedRowsRef.current;
    if (ids.size === 0) return;
    /* The fixed rows now belong to the Imported tab, so switch there before
     * pulsing. Left on the Failed tab their snapshot still shows them (until
     * the next filter change) and the pulse would land under the wrong tab.
     * Reset to page 1 too, otherwise the just-fixed rows can sit on a page
     * that isn't visible and the pulse never appears. */
    setFilter("imported");
    setCurrentPage(1);
    setPulseRowIds(new Set(ids));
    if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => {
      setPulseRowIds(new Set());
      pulseTimerRef.current = null;
    }, 1500);
  }, []);
  useEffect(() => () => {
    if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
  }, []);

  /* Re-import wizard. No longer thrown up the instant the error file is
   * downloaded (nothing has been fixed yet at that point, so the only
   * sensible action was Cancel). It now opens from the correction strip,
   * which persists until the corrected file comes back. */
  const [reimportOpen, setReimportOpen] = useState(false);
  /* A file dropped straight onto the correction strip, handed to the wizard
   * so the round trip finishes in one gesture. */
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  /* "Awaiting corrected file" state for THIS import. Read from the shared
   * store so it survives navigation and stays in step with the listing's
   * matching cue. */
  const [pending, setPending] = useState<PendingCorrection | null>(() => getPendingCorrection(importId));
  useEffect(() => {
    const sync = () => setPending(getPendingCorrection(importId));
    sync();
    return subscribeToPendingCorrections(sync);
  }, [importId]);

  /* Bumped whenever a correction lands, so the header/records memo below
   * re-reads the detail store and the rows this file just fixed show as
   * Imported without a reload. */
  const [refreshKey, setRefreshKey] = useState(0);

  /* Resolve the rows + header metadata for this import, everything comes
   * from the actual completed import. The stored detail record carries the
   * real rows, the real file name, and the real importer. If the detail
   * payload is missing (e.g. sessionStorage quota) the history entry still
   * supplies the real header; an unknown id renders the not-found state. */
  const { found: importFound, rows: rowsForImport, header: importHeader, importerKey } = useMemo(() => {
    const stored = getImportDetail(importId);
    if (stored) {
      return {
        found: true,
        rows: stored.records,
        header: {
          name: stored.name,
          description: stored.description ?? "",
          fileName: stored.fileName,
          dateISO: stored.dateISO,
          importer: getImporter(stored.importerKey),
        },
        importerKey: stored.importerKey,
      };
    }
    const completed = getCompletedImports(moduleSlug).find((e) => e.id === importId);
    if (completed) {
      return {
        found: true,
        rows: [] as ImportedUserRow[],
        header: {
          name: completed.name,
          description: completed.description ?? "",
          fileName: completed.fileName ?? completed.name,
          dateISO: completed.dateISO,
          importer: getImporter(completed.importerKey),
        },
        importerKey: completed.importerKey,
      };
    }
    return {
      found: false,
      rows: [] as ImportedUserRow[],
      header: {
        name: "",
        description: "",
        fileName: "",
        dateISO: "",
        importer: getImporter(undefined),
      },
      importerKey: "am" as ImporterKey,
    };
    /* `refreshKey` is a deliberate cache-buster, not a value this body reads:
     * the records come from a localStorage-backed store that a landing
     * correction writes to behind React's back. Bumping it is what makes the
     * just-fixed rows show as Imported without a reload. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importId, moduleSlug, refreshKey]);

  /* Drop any selection when the active filter (or the underlying import)
   * changes. Selection must never persist across filters or on rows hidden
   * by the filter, clearing here is the simplest enforcement. */
  useEffect(() => {
    setSelectedRows(new Set());
  }, [filter, rowsForImport]);

  /* Reset inline-fix state when the underlying import changes. Edits and
   * committed-row tracking are per-import: switching imports must not carry
   * a previous import's edits into a new record set. */
  useEffect(() => {
    setRowEdits(new Map());
    setCommittedRowIds(new Set());
    setEditingCell(null);
  }, [rowsForImport]);

  /* Drop edit mode when filter / search / paging shifts the editing row out
   * of view, same self-preservation as the Review modal. */
  useEffect(() => {
    if (!editingCell) return;
    const stillVisible = rowsForImport.some((r) => r._row === editingCell.rowNumber);
    if (!stillVisible) setEditingCell(null);
  }, [rowsForImport, editingCell]);

  /* The effective UserReviewRow for each ImportedUserRow, original data
   * merged with any inline edits the user has applied. Drives both the
   * validator and the cell values shown in the table. */
  const effectiveReviewRows = useMemo(() => {
    return rowsForImport.map((r) => {
      const edits = rowEdits.get(r._row);
      const base = toReviewRow(r);
      return edits ? { ...base, ...edits } : base;
    });
  }, [rowsForImport, rowEdits]);

  /* Snapshot the existing-user emails + known role names per import view,
   * the same cross-check context the Review and Fix Your Data step ran with,
   * so revalidation here reproduces the exact issues produced during review
   * (and `isUpdate` drives the real created-vs-updated split on commit). */
  const validationContext = useMemo(
    () => ({
      existingEmails: getCurrentUserEmails(),
      knownRoles: getCurrentRoleNames(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importId],
  );

  /* Re-use the Import Review modal's validator so error / warning cells get
   * the exact same highlight treatment here AND so the live revalidation of
   * an edited row uses identical rules. Validation runs against the full
   * effective set so cross-row checks (duplicate email) see the edits.
   * Indexed by `_row` so a paged / filtered row can grab its issues
   * directly. */
  const validationByRow = useMemo(() => {
    const result = validateRows(effectiveReviewRows, validationContext);
    const map = new Map<number, typeof result.rows[number]>();
    rowsForImport.forEach((r, i) => map.set(r._row, result.rows[i]));
    return map;
  }, [rowsForImport, effectiveReviewRows, validationContext]);

  /* Display-time outcome, promotes originally-failed rows whose live
   * validation no longer has any errors to "ready", and promotes
   * session-committed rows to "imported". The stored `_outcome` field is
   * unchanged until persistence runs on commit.
   *
   * Note: "passes validation" here means *no errors*, warnings don't block
   * import in the Review and Fix Your Data step (StartImportButton only
   * disables on `errorCount > 0`), so a row with warnings alone should
   * surface as Ready here too. Per-cell amber highlights still render via
   * the validator's issues map. */
  const displayOutcomeByRow = useMemo(() => {
    const map = new Map<number, DisplayOutcome>();
    for (const r of rowsForImport) {
      if (committedRowIds.has(r._row)) {
        map.set(r._row, "imported");
        continue;
      }
      if (isImported(r._outcome)) {
        map.set(r._row, "imported");
        continue;
      }
      const v = validationByRow.get(r._row);
      if (v && v.status !== "error") {
        map.set(r._row, "ready");
        continue;
      }
      map.set(r._row, r._outcome === "Skipped" ? "skipped" : "failed");
    }
    return map;
  }, [rowsForImport, validationByRow, committedRowIds]);

  /* Filter membership is captured as a snapshot at the moment the filter
   * changes, staged Ready rows and freshly-committed rows stay visible in
   * the Failed view until the user navigates away, mirroring the spec's
   * "row drops out of the Failed filter on the next load or filter change".
   * Committed rows are evaluated against committedRowIds at snapshot time,
   * so a row that's committed mid-view stays in the snapshot. */
  const snapshotRef = useRef<{ key: string; ids: Set<number> }>({ key: "", ids: new Set() });
  const snapshotKey = `${importId}|${filter}`;
  if (snapshotRef.current.key !== snapshotKey) {
    const snap = new Set<number>();
    for (const r of rowsForImport) {
      const isCommitted = committedRowIds.has(r._row);
      const include =
        filter === "all" ? true :
        filter === "imported" ? (isImported(r._outcome) || isCommitted) :
        filter === "failed" ? (isFailed(r._outcome) && !isCommitted) :
        false;
      if (include) snap.add(r._row);
    }
    snapshotRef.current = { key: snapshotKey, ids: snap };
  }
  const filterRowIds = snapshotRef.current.ids;

  /* Pill counts, display the effective ("live") counts, including in-session
   * commits and ready-to-import rows. The Failed count narrows as the user
   * resolves rows so the pill labels match the action they imply. */
  const counts = useMemo(() => {
    let imported = 0;
    let failed = 0;
    for (const r of rowsForImport) {
      const eo = displayOutcomeByRow.get(r._row);
      if (eo === "imported") imported++;
      else if (eo === "failed" || eo === "skipped") failed++;
    }
    return { all: rowsForImport.length, imported, failed };
  }, [rowsForImport, displayOutcomeByRow]);

  /* Live count of rows currently staged (Ready) for the commit button label
   * and enablement. Limited to originally-failed, not-yet-committed rows
   * whose validation now passes. */
  const readyRowCount = useMemo(() => {
    let n = 0;
    for (const r of rowsForImport) {
      if (!isFailed(r._outcome)) continue;
      if (committedRowIds.has(r._row)) continue;
      if (displayOutcomeByRow.get(r._row) === "ready") n++;
    }
    return n;
  }, [rowsForImport, committedRowIds, displayOutcomeByRow]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rowsForImport.filter((r) => {
      if (!filterRowIds.has(r._row)) return false;
      if (!q) return true;
      // Search across all column values (using the edited overlay) + message
      const edits = rowEdits.get(r._row);
      for (const col of COLUMNS) {
        const reviewField = reviewFieldFromColKey(col.key);
        const overlay = reviewField && edits && reviewField in edits
          ? (edits[reviewField] as string | undefined)
          : undefined;
        const v = overlay !== undefined ? overlay : r[col.key];
        if (typeof v === "string" && v.toLowerCase().includes(q)) return true;
      }
      if (r._message && r._message.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [searchQuery, rowsForImport, filterRowIds, rowEdits]);

  /* Header-menu sort. Reads the same value the cell shows (edit overlay
   * first); Row sorts numerically, Result by its displayed label. */
  const { sortRows } = columns;
  const sortedRows = useMemo(
    () =>
      sortRows(filteredRows, (r, key) => {
        if (key === "_row") return r._row;
        if (key === "_result") return displayOutcomeByRow.get(r._row) ?? "failed";
        const reviewField = reviewFieldFromColKey(key as (typeof COLUMNS)[number]["key"]);
        const edits = rowEdits.get(r._row);
        if (reviewField && edits && reviewField in edits) return edits[reviewField];
        return r[key as keyof typeof r];
      }),
    [sortRows, filteredRows, displayOutcomeByRow, rowEdits],
  );

  const totalPages = Number.isFinite(recordsPerPage)
    ? Math.max(1, Math.ceil(sortedRows.length / recordsPerPage))
    : 1;
  const pagedRows = useMemo(() => {
    if (!Number.isFinite(recordsPerPage)) return sortedRows;
    const start = (currentPage - 1) * recordsPerPage;
    return sortedRows.slice(start, start + recordsPerPage);
  }, [sortedRows, currentPage, recordsPerPage]);

  /* Commit handler, mirrors the Review and Fix Your Data step's Start
   * Import action. Imports only the staged (Ready) rows; rows still Failed
   * are left untouched. Persists the new outcome to the detail store so a
   * page reload picks up the committed state. */
  const commitStagedRows = useCallback(() => {
    if (phase.kind !== "idle") return;
    if (readyRowCount === 0) return;

    /* Pass 1, compute the updated original-import records and the
     * just-committed payload (only the rows that are getting imported in
     * this batch). The original import is updated in place so an admin
     * returning to it sees the rows as Imported. No separate history entry
     * is created, the fixed rows simply fold into this original import. */
    const newlyCommitted = new Set<number>();
    /* Created vs updated is decided per row by the validator's email match
     * against the existing users listing, the same rule the wizard's Start
     * Import uses. */
    const committedCreated: UserReviewRow[] = [];
    const committedUpdated: UserReviewRow[] = [];
    let warningCount = 0;
    const updatedRecords: ImportedUserRow[] = rowsForImport.map((r) => {
      if (!isFailed(r._outcome)) return r;
      if (committedRowIds.has(r._row)) return r;
      const v = validationByRow.get(r._row);
      /* Commit any non-error row, mirrors the review step where warnings
       * don't block import. Keeps this gate aligned with displayOutcomeByRow. */
      if (!v || v.status === "error") return r;
      newlyCommitted.add(r._row);
      if (v.status === "warning") warningCount++;
      const edits = rowEdits.get(r._row);
      const merged: UserReviewRow = edits ? { ...toReviewRow(r), ...edits } : toReviewRow(r);
      if (v.isUpdate) committedUpdated.push(merged);
      else committedCreated.push(merged);
      const next = fromReviewRow(r, merged);
      const committedRow: ImportedUserRow = { ...next, _outcome: "Created", _message: undefined };
      return committedRow;
    });
    if (newlyCommitted.size === 0) return;

    const total = newlyCommitted.size;
    setEditingCell(null);
    /* Remember exactly which rows were fixed in this batch so "View Updates"
     * can pulse them once the completion dialog is dismissed. */
    lastCommittedRowsRef.current = new Set(newlyCommitted);
    setCommittedRowIds((prev) => {
      const next = new Set(prev);
      for (const id of newlyCommitted) next.add(id);
      return next;
    });
    setPhase({ kind: "running", processed: 0, total });

    /* Persist the original-import update immediately so a page reload mid-
     * animation still reflects the committed state. The new history entry
     * + dialog deep-link are written at the end of the animation. */
    saveImportDetail({
      id: importId,
      moduleSlug,
      name: importHeader.name,
      description: importHeader.description,
      fileName: importHeader.fileName,
      dateISO: importHeader.dateISO,
      importerKey,
      records: updatedRecords,
    });
    /* Keep the original entry's listing chips in sync with its records,
     * the rows just committed move from the failed tally to imported. */
    const remainingFailed = updatedRecords.filter((r) => isFailed(r._outcome)).length;
    updateCompletedImportCounts(importId, {
      importedCount: updatedRecords.filter((r) => isImported(r._outcome)).length,
      failedCount: remainingFailed,
    });
    /* Inline fixes can close out the last failure, at which point there is
     * nothing left for the downloaded file to correct. Retire the reminder
     * rather than leaving it advertising work that no longer exists. */
    if (remainingFailed === 0) clearPendingCorrection(importId);
    /* Record this correction as a CHILD log nested under the parent import.
     * It captures only the rows fixed in this batch (always clean) and gives
     * the parent its expand toggle in the listing. */
    const childId = `${importId}-fix-${Date.now()}`;
    const childDateISO = new Date().toISOString();
    const childName = `${importHeader.fileName} (corrected)`;
    const childDescription = `Fixed ${total} failed row${total === 1 ? "" : "s"}`;
    addFixChildImport({
      id: childId,
      parentId: importId,
      moduleSlug,
      name: childName,
      fileName: childName,
      description: childDescription,
      dateISO: childDateISO,
      importerKey,
      recordCount: total,
      importedCount: total,
      failedCount: 0,
      correctionKind: "inline",
    });
    /* Give the child log its own detail payload so it is drillable from the
     * listing exactly like the file-upload corrections are. Without this a
     * nested row led to a Not Found page. Rows are renumbered from 1: the
     * child is its own batch, not a slice of the parent's numbering. */
    saveImportDetail({
      id: childId,
      moduleSlug,
      name: childName,
      description: childDescription,
      fileName: childName,
      dateISO: childDateISO,
      importerKey,
      records: updatedRecords
        .filter((r) => newlyCommitted.has(r._row))
        .map((r, i) => ({ ...r, _row: i + 1 })),
    });

    /* Progress animation, mirrors the wizard's 2400ms RAF tick exactly so
     * the overlay reads identically on both surfaces. */
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
      /* The fixed rows fold into THIS original import (already persisted above);
       * no separate correction entry is created and no new detail page opens.
       * The completion dialog's "View Updates" returns here and pulses them. */
      /* Fold the committed rows into the users listing, the same upsert the
       * wizard flow runs, so "Users created / updated" on the dialog reflects
       * users that actually exist in the listing. Updates apply as field-level
       * patches so blank cells never overwrite existing values. */
      upsertImportedUsers(
        committedCreated.map((r) => reviewRowToUserRow(r, makeImportedUserId())),
        committedUpdated.map(reviewRowToUserUpdate),
      );
      setPhase({
        kind: "complete",
        importId,
        createdCount: committedCreated.length,
        updatedCount: committedUpdated.length,
        skippedCount: 0,
        warningCount,
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    phase.kind, readyRowCount, rowsForImport, committedRowIds, validationByRow, rowEdits,
    importId, moduleSlug, importHeader, importerKey,
  ]);

  /* The error-rows download, shared by the header menu and the correction
   * strip's "Download again". Ships the exact import-template layout with an
   * "Error Message" column appended, unchanged from before: the file the
   * admin gets back is the same one they always got. Rows go out with any
   * inline edits applied, matching what is on screen. */
  const downloadFailedRows = useCallback((exportFormat: "csv" | "xlsx") => {
    const failedRows = rowsForImport
      .filter((r) => isFailed(r._outcome))
      .map((r) => {
        const edits = rowEdits.get(r._row);
        return edits ? fromReviewRow(r, { ...toReviewRow(r), ...edits }) : r;
      });
    if (failedRows.length === 0) {
      toast.info("No rows to download for this filter.");
      return;
    }
    const messages = new Map<number, string>();
    for (const r of failedRows) {
      const v = validationByRow.get(r._row);
      const live = v
        ? v.issues
            .filter((i) => i.severity === "error")
            .map((i) => i.message)
            .join(" ")
        : "";
      messages.set(r._row, live || r._message || "");
    }
    void exportTemplateRecords({
      rows: failedRows,
      messages,
      messageHeader: "Error Message",
      format: exportFormat,
      importName: importHeader.name,
      suffix: DOWNLOAD_META.failed.fileSuffix,
    });
    /* Arm the resumable correction task rather than opening a wizard at
     * someone who has not fixed anything yet. The strip below the header
     * (and the cue on the listing row) is what brings them back. */
    startPendingCorrection({
      importId,
      moduleSlug,
      fileName: `${importNameToFilenameStem(importHeader.name)}_${DOWNLOAD_META.failed.fileSuffix}.${exportFormat}`,
      rowCount: failedRows.length,
      startedISO: new Date().toISOString(),
    });
  }, [rowsForImport, rowEdits, validationByRow, importHeader.name, importId, moduleSlug]);

  /* Framing handed to the wizard's setup step: the blank template is no use
   * to someone fixing an existing file, so the bar points back at the error
   * file instead. Rebuilt from the live failed count so it stays accurate
   * as inline fixes whittle the list down. */
  const correctionContext = useMemo(
    () => ({
      parentName: importHeader.fileName || importHeader.name,
      fileName: pending?.fileName ?? null,
      rowCount: pending?.rowCount ?? counts.failed,
      onRedownload: downloadFailedRows,
    }),
    [importHeader.fileName, importHeader.name, pending, counts.failed, downloadFailedRows],
  );

  /* Whether the header commit button should appear at all. It's gated on
   * "this import has unresolved or just-staged failures", once all the
   * originally-failed rows are committed and there's nothing staged, the
   * button has no purpose and we hide it. */
  const hasFailureWorkToDo = counts.failed > 0 || readyRowCount > 0;

  /* Dismiss handler for the Import Complete dialog. The summary cards and
   * "View Users Listing" button use the new import id (set in `phase`) for
   * their deep links; the "View Import History" button opens the new entry
   * "View Updates" stays on this original log and pulses the just-fixed rows,
   * no new import log or page is created for a correction. */
  const dismissCompletion = useCallback(
    (
      target:
        | "history"
        | "users"
        | { kind: "detail"; filter: "imported" | "failed" },
    ) => {
      const detailHref =
        phase.kind === "complete"
          ? `/company-settings/data-imports/${moduleSlug}/${phase.importId}`
          : null;
      setPhase({ kind: "idle" });
      if (target === "users") {
        navigate("/company-settings/user-access-control?tab=users", { replace: true });
      } else if (target === "history") {
        // "View Updates": we're already on the original import log, so just
        // dismiss the dialog and pulse the rows that were just fixed.
        pulseFixedRows();
      } else if (typeof target === "object" && target.kind === "detail" && detailHref) {
        navigate(`${detailHref}?filter=${target.filter}`);
      }
    },
    [phase, moduleSlug, navigate, pulseFixedRows],
  );

  /* Apply a single cell commit from the inline editor, keyed by _row so the
   * overlay survives paging / search. Reuses the Review modal's CellInput
   * verbatim, so the validation rules re-run automatically through the
   * effectiveReviewRows memo on the next render. */
  const commitCellEdit = useCallback(
    (rowNumber: number, field: UserReviewField, nextValue: string) => {
      setRowEdits((prev) => {
        const next = new Map(prev);
        const existing = next.get(rowNumber) ?? {};
        next.set(rowNumber, { ...existing, [field]: nextValue });
        return next;
      });
    },
    [],
  );

  /* Auto-save inline fixes. Every committed cell edit is folded into the
   * stored detail record immediately, so leaving the page and coming back
   * (or reloading) keeps the fix instead of resurfacing the old error.
   * Runs after render so `validationByRow` already reflects the edit:
   * the stored `_message` is kept in sync with the row's live validation
   * errors (cleared when none remain). `_outcome` stays Failed/Skipped,
   * a fixed row still isn't imported until the user commits it, and rows
   * already committed in this session are skipped (the commit handler
   * persisted their final Created state). Merging into the freshly-read
   * stored record (not the mount-time snapshot) preserves anything the
   * commit handler wrote in the meantime. */
  useEffect(() => {
    if (rowEdits.size === 0) return;
    const stored = getImportDetail(importId);
    if (!stored) return;
    let changed = false;
    const records = stored.records.map((r) => {
      const edits = rowEdits.get(r._row);
      if (!edits || !isFailed(r._outcome) || committedRowIds.has(r._row)) return r;
      const merged = fromReviewRow(r, { ...toReviewRow(r), ...edits });
      const v = validationByRow.get(r._row);
      const liveErrors = v
        ? v.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" ")
        : "";
      const next: ImportedUserRow = { ...merged, _message: liveErrors || undefined };
      const same = (Object.keys(next) as Array<keyof ImportedUserRow>).every(
        (k) => next[k] === r[k],
      );
      if (same) return r;
      changed = true;
      return next;
    });
    if (changed) saveImportDetail({ ...stored, records });
  }, [rowEdits, validationByRow, committedRowIds, importId]);

  if (!moduleDef || !importFound) {
    return (
      <div className="flex flex-col h-full bg-[#F8FAFC] items-center justify-center">
        <p className="text-[#64748B] mb-3" style={{ fontSize: "14px" }}>Import Not Found.</p>
        <button
          onClick={() => navigate("/company-settings/data-imports")}
          className="text-[#0A77FF] hover:underline"
          style={{ fontSize: "13px", fontWeight: 500 }}
        >
          Back to Data Imports
        </button>
      </div>
    );
  }

  /* Back to the module listing. For a tab surface (Users / Roles) that is the
   * parent card's path plus `?tab=`, the canonical URL the listing uses — going
   * to the bare tab slug would work too, but leaves the pathname and the tab
   * param able to disagree once the user switches tabs. */
  const listingSurface = resolveImportSurface(moduleSlug);
  const moduleListingPath = listingSurface?.tab
    ? `/company-settings/data-imports/${listingSurface.card.slug}?tab=${listingSurface.tab.slug}`
    : `/company-settings/data-imports/${moduleSlug}`;
  const importedDateText = formatImportedOnShort(importHeader.dateISO);

  // Filter chip definitions, only show non-empty chips except for "All"
  const filterChips: { key: RowFilter; label: string; count: number }[] = [
    { key: "all",      label: "Show All", count: counts.all },
    { key: "imported", label: "Imported", count: counts.imported },
    { key: "failed",   label: "Failed",   count: counts.failed },
  ];

  const applyFilter = (next: RowFilter) => {
    setFilter(next);
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {columns.ghost}
      {/* ─── Header ─── */}
      <div className={cn("shrink-0 px-6 lg:px-8 pt-4", WIDTH_TRANSITION_CLASS)} style={{ maxWidth: containerMaxWidth }}>
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm" style={{ padding: "12px 16px" }}>
          <div className="flex items-center justify-between gap-4">
            {/* Left, back + icon + identity */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => navigate(moduleListingPath)}
                className="w-11 h-11 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-colors"
                aria-label="Back to imports"
              >
                <ChevronLeft className="w-5 h-5 text-slate-400" />
              </button>

              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white"
                style={{
                  backgroundColor: "#EDF4FF",
                  boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 0 0 2px rgba(10,119,255,0.10)",
                }}
              >
                <FileInput className="w-5 h-5" style={{ color: "#0A77FF" }} />
              </div>

              <div className="min-w-0">
                {/* Line 1, Filename heading with the imported-by / imported-on
                  * metadata chips inline beside it. */}
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <h1
                    className="text-[#0F172A] truncate min-w-0"
                    style={{ fontSize: "16px", fontWeight: 700, lineHeight: "22px" }}
                    title={importHeader.fileName || importHeader.name}
                  >
                    {importHeader.fileName || importHeader.name}
                  </h1>

                  {/* Imported-by chip, user icon (not an avatar), name only,
                    * overview card preserved on hover. */}
                  <HoverCard openDelay={120} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border cursor-pointer transition-colors hover:bg-[#EEF2F6] shrink-0"
                        style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}
                      >
                        <User className="w-3 h-3" style={{ color: "#94A3B8" }} />
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#475569" }}>
                          {importHeader.importer.name}
                        </span>
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent
                      side="bottom"
                      align="start"
                      sideOffset={8}
                      className="w-[320px] p-0 rounded-xl border border-[#E2E8F0] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)]"
                    >
                      <ImporterOverviewCard user={importHeader.importer} />
                    </HoverCardContent>
                  </HoverCard>

                  {/* Imported-on chip, clock icon + date only (no time). */}
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border shrink-0"
                    style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}
                  >
                    <Clock className="w-3 h-3" style={{ color: "#94A3B8" }} />
                    <span style={{ fontSize: "11px", fontWeight: 500, color: "#475569" }}>
                      {importedDateText}
                    </span>
                  </span>
                </div>

                {/* Line 2, Import description (italic placeholder when none) */}
                {importHeader.description ? (
                  <ExpandableDescription
                    maxExpandedLines={8}
                    text={importHeader.description}
                    prefix={<span style={{ color: "#475569", fontWeight: 600 }}>Description: </span>}
                    className="mt-1"
                    style={{ fontSize: "12.5px", lineHeight: "1.6", color: "#64748B", fontWeight: 400 }}
                  />
                ) : (
                  <p className="mt-1 truncate" style={{ fontSize: "12.5px", lineHeight: "1.6" }}>
                    <span className="italic" style={{ color: "#94A3B8", fontWeight: 400 }}>
                      No Description Added
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Right, Download reflects the active filter. CSV / Excel
              * options share one generator; failed + all carry an Error
              * Reason column so admins can act on the file without reopening
              * the source upload.
              * The "Import corrected rows" action sits next to it: a primary
              * filled button that's disabled until every flagged error in the
              * import is resolved (matches the wizard's Start Import gate of
              * `errorCount === 0`). */}
            <div className="flex items-center gap-2 shrink-0">
              <ExpandWidthButton isExpanded={isExpanded} onToggle={() => setIsExpanded((v) => !v)} />
              {counts.failed > 0 && (
              <DownloadDropdown
                /* Correcting errors is not a property of whichever filter the
                 * table happens to be on, so this control is filter-independent:
                 * it always downloads the error rows and always offers the
                 * upload half of the loop, whatever tab is selected. */
                onPick={(format) => downloadFailedRows(format)}
                onUpload={() => {
                  setDroppedFile(null);
                  setReimportOpen(true);
                }}
              />
              )}
              {hasFailureWorkToDo && (
                <TooltipProvider delayDuration={200}>
                  <ImportCorrectedRowsButton
                    readyCount={readyRowCount}
                    errorCount={counts.failed}
                    running={phase.kind === "running"}
                    onImport={commitStagedRows}
                  />
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Resumable correction task. Armed by the error-rows download and
            * cleared when the corrected file lands (or when the admin waves
            * it off). Doubles as a drop target so the round trip can finish
            * with a drag. */}
          {pending && (
            <div style={{ marginTop: 12 }}>
              <CorrectionStrip
                pending={pending}
                onOpenUpload={() => {
                  setDroppedFile(null);
                  setReimportOpen(true);
                }}
                onDropFile={(file) => {
                  setDroppedFile(file);
                  setReimportOpen(true);
                }}
                onRedownload={downloadFailedRows}
                onDismiss={() => clearPendingCorrection(importId)}
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── Body: full-width table card ─── */}
      <div className={cn("flex-1 min-h-0 px-6 lg:px-8 py-4 flex flex-col", WIDTH_TRANSITION_CLASS)} style={{ maxWidth: containerMaxWidth }}>
        <div className="flex-1 min-h-0 bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
          {/* Search row */}
          <div className="shrink-0 px-4 pt-3.5 pb-2 flex items-center justify-between gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#CBD5E1" }} />
              <input
                type="text"
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-[#E2E8F0] shadow-sm rounded-md placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/20 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <DensityDropdown density={density} onChange={setDensity} />
          </div>

          {/* Filter chip row OR selection toolbar, swap in place, no shift.
            * Both branches share px-4 pb-3 + border-b so the wrapper height is
            * identical regardless of selection state. */}
          {selectedRows.size > 0 ? (
            <ImportSelectionBar
              count={selectedRows.size}
              onExport={(format) => {
                const rows = rowsForImport.filter((r) => selectedRows.has(r._row));
                if (rows.length === 0) {
                  toast.info("No selected rows to export.");
                  return;
                }
                /* "all" filter keeps the Result + Error Reason columns so
                 * each exported record carries its outcome and any failed
                 * record carries its reason. */
                void exportImportRecords({
                  rows,
                  filter: "all",
                  format,
                  importName: importHeader.name,
                  suffix: "selected",
                });
              }}
              onClear={() => setSelectedRows(new Set())}
            />
          ) : (
            <div className="shrink-0 flex items-center gap-1.5 px-4 pb-3 border-b border-[#E2E8F0] overflow-x-auto">
              {filterChips
                .filter((c) => c.key === "all" || c.count > 0)
                .map((chip) => {
                  const active = filter === chip.key;
                  /* Imported reuses the Created-row green token; Failed reuses
                   * the Failed-row red token so the active pill carries the
                   * same red accent as the listing's failed chip. */
                  const tone =
                    chip.key === "imported" ? ROW_OUTCOME_TOKENS.Created :
                    chip.key === "failed"   ? ROW_OUTCOME_TOKENS.Failed :
                    null;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => applyFilter(chip.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 transition-colors cursor-pointer",
                        active && !tone && "border-[#0A77FF] bg-[#EDF4FF] text-[#0A77FF]",
                        !active && "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] hover:border-[#CBD5E1]",
                      )}
                      style={active && tone ? {
                        backgroundColor: tone.bg,
                        color: tone.text,
                        borderColor: tone.border,
                        fontSize: "12px",
                        fontWeight: 500,
                      } : { fontSize: "12px", fontWeight: active ? 500 : 400 }}
                    >
                      {chip.label}
                      <span
                        className={cn(
                          "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full tabular-nums",
                          active && !tone && "bg-[#0A77FF]/10 text-[#0A77FF]",
                          !active && "bg-[#F1F5F9] text-[#475569]",
                        )}
                        style={active && tone ? {
                          backgroundColor: "rgba(255,255,255,0.6)",
                          color: tone.text,
                          fontSize: "10px",
                          fontWeight: 600,
                        } : { fontSize: "10px", fontWeight: 600 }}
                      >
                        {chip.count}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}

          {/* Helper text shown only in the Failed view, same typographic
            * style as the Review and Fix Your Data step's helper line. */}
          {filter === "failed" && (
            <div className="shrink-0 px-4 pt-3 pb-3 border-b border-[#E2E8F0]">
              <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
                Fix rows here, or download failed records to correct in bulk and re-upload.
              </p>
            </div>
          )}

          {/* Table, horizontal scroll for 22 columns + Row + Status + Error.
            * The "running" phase overlays the table area with the same
            * Importing-N-users card the wizard uses; the dialog at page
            * level handles the "complete" phase. */}
          <TooltipProvider delayDuration={300}>
          <div className="flex-1 min-h-0 overflow-auto relative">
            <AnimatePresence>
              {phase.kind === "running" && (
                <motion.div
                  key="reimport-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-0 z-40 flex items-center justify-center bg-white/60 backdrop-blur-[1px] pointer-events-auto"
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
            <DensityContext.Provider value={density}>
            <table
              className="w-full border-separate"
              style={{ minWidth: tableMinWidth, borderSpacing: 0 }}
            >
              <thead className="sticky top-0 z-30 bg-white">
                <tr className="bg-[#F1F5F9]/30">
                  <Th sticky style={{ width: SELECT_COL_WIDTH, minWidth: SELECT_COL_WIDTH, left: 0, paddingLeft: 12, paddingRight: 0, textAlign: "center" }}>
                    <span className="flex items-center justify-center">
                      <Checkbox
                        aria-label="Select all rows on page"
                        className="data-[state=checked]:bg-[#0A77FF] data-[state=checked]:border-[#0A77FF] data-[state=checked]:text-white data-[state=indeterminate]:bg-[#0A77FF] data-[state=indeterminate]:border-[#0A77FF] data-[state=indeterminate]:text-white"
                        checked={
                          pagedRows.length > 0 &&
                          pagedRows.every((r) => selectedRows.has(r._row))
                            ? true
                            : pagedRows.some((r) => selectedRows.has(r._row))
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(checked) => {
                          setSelectedRows((prev) => {
                            const next = new Set(prev);
                            if (checked) for (const r of pagedRows) next.add(r._row);
                            else for (const r of pagedRows) next.delete(r._row);
                            return next;
                          });
                        }}
                      />
                    </span>
                  </Th>
                  <Th sticky style={{ width: ROW_COL_WIDTH, minWidth: ROW_COL_WIDTH, left: SELECT_COL_WIDTH, paddingLeft: 16, paddingRight: 4 }}>
                    <ImportColumnHeaderMenu columnKey="_row" label="Row" sort={columns.sort} onSort={columns.onSort} />
                  </Th>
                  <Th
                    sticky
                    style={{
                      width: RESULT_COL_WIDTH,
                      minWidth: RESULT_COL_WIDTH,
                      left: SELECT_COL_WIDTH + ROW_COL_WIDTH,
                      boxShadow: hasFrozen ? undefined : "inset -1px 0 0 0 #E2E8F0",
                    }}
                  >
                    <ImportColumnHeaderMenu columnKey="_result" label="Result" sort={columns.sort} onSort={columns.onSort} />
                  </Th>
                  {visibleColumns.map((col) => {
                    const isFrozen = columns.frozen.has(col.key);
                    return (
                      <Th
                        key={col.key}
                        {...columns.headerDragProps(col.key)}
                        sticky={isFrozen}
                        className="group/colheader cursor-grab select-none"
                        style={{
                          width: col.width,
                          minWidth: col.width,
                          /* Inline position: the `relative` utility (needed by the
                           * grip overlay) would otherwise beat `sticky`. */
                          position: isFrozen ? "sticky" : "relative",
                          ...(isFrozen ? { left: frozenLeft[col.key] } : null),
                          ...(col.key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 #E2E8F0" } : null),
                          ...columns.draggedHeaderStyle(col.key),
                        }}
                      >
                        {columns.dragAdornments(col.key)}
                        <ImportColumnHeaderMenu
                          columnKey={col.key}
                          label={col.label}
                          sort={columns.sort}
                          onSort={columns.onSort}
                          onHide={columns.onHide}
                          isFrozen={isFrozen}
                          onFreeze={columns.onFreeze}
                          suppressClick={columns.suppressClick}
                        />
                      </Th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 3} className="py-16 text-center">
                      <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>
                        No Rows Match This Filter.
                      </p>
                    </td>
                  </tr>
                ) : (
                  pagedRows.flatMap((r) => {
                    const displayOutcome = displayOutcomeByRow.get(r._row) ?? "failed";
                    /* Result-chip token. Ready and Imported share the same
                     * green palette already used by Created, no new colors.
                     * Skipped and Failed both render with the red token. */
                    const tok =
                      displayOutcome === "imported" || displayOutcome === "ready"
                        ? ROW_OUTCOME_TOKENS.Created
                        : ROW_OUTCOME_TOKENS.Failed;
                    const resultLabel =
                      displayOutcome === "imported" ? "Imported"
                      : displayOutcome === "ready" ? "Ready"
                      : displayOutcome === "skipped" ? "Error"
                      : "Failed";
                    /* The error-reason sub-row only hangs off a row that's
                     * still failed/skipped; once a row passes validation or is
                     * committed it loses the sub-row (and the red accent).
                     * The message text reflects *live* validation errors so
                     * an edit that introduces a different error (or that
                     * clears the original one but trips a new one) surfaces
                     * the current problem, never the stale stored
                     * `_message`. Falls back to the stored message for rows
                     * whose live validation has no errors (defensive, the
                     * sub-row should already be hidden in that case). */
                    const stillErrored = displayOutcome === "failed" || displayOutcome === "skipped";
                    const messageColor = stillErrored ? "#DC2626" : "#0F172A";
                    const liveErrorMessage = stillErrored
                      ? (validationByRow.get(r._row)?.issues
                          .filter((i) => i.severity === "error")
                          .map((i) => i.message)
                          .join(" ") || r._message || "")
                      : "";
                    const hasSubRow = stillErrored && !!liveErrorMessage;
                    /* Bottom border lives on the sub-row when it exists, otherwise
                     * on the data row, so the data + sub-row read as one unit. */
                    const dataRowBorder = hasSubRow ? "transparent" : "#E2E8F0";
                    /* 2px left accent bar on the leading edge of error rows
                     * (both Failed and the renamed-to-Error Skipped). */
                    const accentBar = stillErrored ? "2px solid #EF4444" : undefined;
                    const isSelected = selectedRows.has(r._row);
                    /* Subtle row tint applied to data + sub-row. Selection takes
                     * precedence over outcome tints so the user always reads the
                     * blue fill as "this row is in the current selection";
                     * cell-level error / warning highlights still layer on top. */
                    const rowTint = isSelected
                      ? "#EFF6FF"
                      : stillErrored
                        ? "#FFFBFB"
                        : undefined;
                    /* Per-cell issues from the shared validator, drives the
                     * cell-level error/warning highlight (same spec as the
                     * Import Review modal). */
                    const rowIssues = validationByRow.get(r._row);
                    /* A row is editable when it was originally failed/skipped
                     * and the user hasn't yet committed it. Once committed
                     * (Imported), the row is read-only again. */
                    const isEditable = isFailed(r._outcome) && !committedRowIds.has(r._row);
                    const rowEditOverlay = rowEdits.get(r._row);
                    const isPulsing = pulseRowIds.has(r._row);

                    const dataRow = (
                      <tr
                        key={r._row}
                        className={cn("import-row-hover", isPulsing && "import-fixed-row-pulse")}
                      >
                        <Td
                          sticky
                          style={{
                            width: SELECT_COL_WIDTH,
                            minWidth: SELECT_COL_WIDTH,
                            paddingLeft: 12,
                            paddingRight: 0,
                            textAlign: "center",
                            borderBottomColor: dataRowBorder,
                            borderLeft: accentBar,
                            backgroundColor: rowTint,
                          }}
                        >
                          <span className="flex items-center justify-center">
                            <Checkbox
                              aria-label={`Select row ${r._row}`}
                              className="data-[state=checked]:bg-[#0A77FF] data-[state=checked]:border-[#0A77FF] data-[state=checked]:text-white"
                              checked={isSelected}
                              onCheckedChange={(c) => {
                                setSelectedRows((prev) => {
                                  const next = new Set(prev);
                                  if (c === true) next.add(r._row);
                                  else next.delete(r._row);
                                  return next;
                                });
                              }}
                            />
                          </span>
                        </Td>
                        <Td
                          sticky
                          className="text-left tabular-nums text-[#64748B]"
                          style={{
                            width: ROW_COL_WIDTH,
                            minWidth: ROW_COL_WIDTH,
                            left: SELECT_COL_WIDTH,
                            paddingLeft: 16,
                            borderBottomColor: dataRowBorder,
                            backgroundColor: rowTint,
                          }}
                        >
                          {r._row}
                        </Td>
                        <Td
                          sticky
                          style={{
                            width: RESULT_COL_WIDTH,
                            minWidth: RESULT_COL_WIDTH,
                            left: SELECT_COL_WIDTH + ROW_COL_WIDTH,
                            borderBottomColor: dataRowBorder,
                            backgroundColor: rowTint,
                            boxShadow: hasFrozen ? undefined : "inset -1px 0 0 0 #E2E8F0",
                          }}
                        >
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full border whitespace-nowrap"
                            style={{ fontSize: "11px", fontWeight: 600, backgroundColor: tok.bg, color: tok.text, borderColor: tok.border }}
                          >
                            {resultLabel}
                          </span>
                        </Td>
                        {visibleColumns.map((col) => {
                          const reviewField = reviewFieldFromColKey(col.key);
                          const isFrozenCol = columns.frozen.has(col.key);
                          /* Display the edited value if the user has changed
                           * this cell; falls back to the original. */
                          const overlay = reviewField && rowEditOverlay && reviewField in rowEditOverlay
                            ? (rowEditOverlay[reviewField] as string | undefined)
                            : undefined;
                          const val = String(overlay !== undefined ? overlay : r[col.key] ?? "");
                          /* Resolve the validator's findings for this cell.
                           * Severity precedence (error > warning) matches the
                           * review modal's EditableDataCell. */
                          const cellIssues = reviewField ? rowIssues?.byField[reviewField] : undefined;
                          const severity: "error" | "warning" | null =
                            cellIssues?.some((i) => i.severity === "error") ? "error"
                            : cellIssues?.some((i) => i.severity === "warning") ? "warning"
                            : null;
                          const cellBg = severity ? CELL_SEVERITY_BG[severity] : rowTint;
                          const cellShadow = severity ? CELL_SEVERITY_SHADOW[severity] : undefined;
                          /* Rich hover tooltip, same component the Import
                           * Review modal uses, fires for cells with issues.
                           * Non-issue cells keep a plain native title so a
                           * truncated value can still be read on hover. */
                          const hasIssueTooltip = !!severity && !!cellIssues && cellIssues.length > 0;
                          const isThisEditing =
                            isEditable
                            && editingCell?.rowNumber === r._row
                            && reviewField !== undefined
                            && editingCell.field === reviewField;
                          /* Match the EditableDataCell's "in-edit" affordance:
                           * white background + inset blue focus ring + zero
                           * horizontal padding (the inner input owns the gutter). */
                          const editingBg = isThisEditing ? "#FFFFFF" : cellBg;
                          const editingShadow = isThisEditing
                            ? "inset 0 0 0 2px #0A77FF, inset 0 0 0 3px rgba(10,119,255,0.15)"
                            : cellShadow;
                          /* Click behavior: clickable when the row is
                           * editable and the column maps to a validation
                           * field. Static (non-failed / committed) cells
                           * keep their existing read-only behavior. */
                          const onClick = isEditable && reviewField !== undefined && !isThisEditing
                            ? () => setEditingCell({ rowNumber: r._row, field: reviewField })
                            : undefined;
                          return (
                            <Td
                              key={col.key}
                              sticky={isFrozenCol}
                              tinted={!!severity || isThisEditing}
                              mono={col.mono && !isThisEditing}
                              style={{
                                width: col.width,
                                minWidth: col.width,
                                maxWidth: col.width,
                                ...(isFrozenCol ? { left: frozenLeft[col.key] } : null),
                                borderBottomColor: dataRowBorder,
                                backgroundColor: editingBg ?? (columns.draggingKey === col.key ? "#F7FAFF" : undefined),
                                boxShadow: editingShadow ?? (col.key === lastFrozenKey ? "inset -1px 0 0 0 #E2E8F0" : undefined),
                                paddingLeft: isThisEditing ? 0 : undefined,
                                paddingRight: isThisEditing ? 0 : undefined,
                                cursor: isThisEditing
                                  ? "text"
                                  : onClick ? "cell" : undefined,
                              }}
                              title={isThisEditing || hasIssueTooltip ? undefined : (val || undefined)}
                              onClick={onClick}
                            >
                              {isThisEditing && reviewField !== undefined ? (
                                <CellInput
                                  initialValue={val}
                                  field={reviewField}
                                  onCommit={(next) => {
                                    commitCellEdit(r._row, reviewField, next);
                                    setEditingCell(null);
                                  }}
                                  onCancel={() => setEditingCell(null)}
                                />
                              ) : hasIssueTooltip && cellIssues ? (
                                <CellIssueTooltip issues={cellIssues}>
                                  {val ? (
                                    <HighlightMatch text={val} query={searchQuery} matchClassName={HIGHLIGHT_CLASS} />
                                  ) : (
                                    <span className="text-[#CBD5E1]">-</span>
                                  )}
                                </CellIssueTooltip>
                              ) : val ? (
                                <HighlightMatch text={val} query={searchQuery} matchClassName={HIGHLIGHT_CLASS} />
                              ) : (
                                <span className="text-[#CBD5E1]">-</span>
                              )}
                            </Td>
                          );
                        })}
                      </tr>
                    );

                    if (!hasSubRow) return [dataRow];

                    /* Skipped is surfaced as "Error" with the red palette, so
                     * its sub-row icon matches Failed (X-in-circle, red). */
                    const isErrorOutcome = displayOutcome === "failed" || displayOutcome === "skipped";
                    const Icon = isErrorOutcome ? CircleX : TriangleAlert;
                    const iconColor = isErrorOutcome ? "#EF4444" : "#F59E0B";

                    const subRow = (
                      <tr key={`${r._row}-sub`} aria-label={`${r._outcome} reason for row ${r._row}`}>
                        <td
                          colSpan={visibleColumns.length + 3}
                          style={{
                            padding: 0,
                            backgroundColor: rowTint ?? "#FFFFFF",
                            borderTop: "1px solid #E2E8F0",
                            borderBottom: "1px solid #E2E8F0",
                            borderLeft: accentBar,
                          }}
                        >
                          <div
                            className="sticky left-0 inline-flex items-center gap-2"
                            style={{
                              height: density === "comfort" ? 30 : 24,
                              paddingLeft: 16,
                              paddingRight: 16,
                            }}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor }} />
                            <span
                              className="whitespace-nowrap"
                              style={{ fontSize: "12.5px", fontWeight: 400, color: messageColor }}
                            >
                              <HighlightMatch text={liveErrorMessage} query={searchQuery} matchClassName={HIGHLIGHT_CLASS} />
                            </span>
                          </div>
                        </td>
                      </tr>
                    );

                    return [dataRow, subRow];
                  })
                )}
              </tbody>
            </table>
            </DensityContext.Provider>
          </div>
          </TooltipProvider>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            recordsPerPage={recordsPerPage}
            onRecordsPerPageChange={(n) => { setRecordsPerPage(n); setCurrentPage(1); }}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            allowAll
          />
        </div>
      </div>

      {/* Import Complete dialog, the exact same component used by the
        * Review and Fix Your Data step's completion screen, fed with the
        * stats from this re-import. Summary cards and the View Users
        * Listing / View Import History buttons deep-link to the newly
        * created import-history entry. */}
      {phase.kind === "complete" && (
        <ImportCompleteDialog
          createdCount={phase.createdCount}
          updatedCount={phase.updatedCount}
          skippedCount={phase.skippedCount}
          warningCount={phase.warningCount}
          historyLabel="Close"
          onViewHistory={() => dismissCompletion("history")}
          onGoToUsers={() => dismissCompletion("users")}
          onViewDetail={(f) => dismissCompletion({ kind: "detail", filter: f })}
        />
      )}

      {/* Re-import wizard, the same component used from the imports listing,
        * opened with correction framing and, crucially, this import's id.
        * That id is layer 2 of correction detection: it is what nests the
        * result under this import even when the uploaded file has had its
        * provenance columns stripped. */}
      {moduleSlug === "users" ? (
        <UsersImportWizard
          open={reimportOpen}
          onClose={() => { setReimportOpen(false); setDroppedFile(null); }}
          onImportCompleted={() => setRefreshKey((k) => k + 1)}
          parentImportId={importId}
          correction={correctionContext}
          initialFile={droppedFile}
          title="Re-import Fixed Records"
          description="Fixed the errors in your downloaded file? Upload it here to re-import, no need to start over."
        />
      ) : (
        <ImportWizardModal
          open={reimportOpen}
          onClose={() => { setReimportOpen(false); setDroppedFile(null); }}
          onImportCompleted={() => setRefreshKey((k) => k + 1)}
          recordTypeLabel={moduleDef.title}
          moduleSlug={moduleSlug}
          parentImportId={importId}
          correction={correctionContext}
          initialFile={droppedFile}
          title={`Re-import Fixed ${moduleDef.title}`}
          description="Fixed the errors in your downloaded file? Upload it here to re-import, no need to start over."
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────
   Internal helpers
   ──────────────────────────────────── */

/* Page-header commit button, mirrors the Start Import button from the
 * Review and Fix Your Data step (same primary fill, same disabled tooltip
 * pattern). Gated on the wizard's rule: enabled only when there are no
 * remaining errors AND at least one row is staged. Label tracks the live
 * Ready count so the user sees the size of the action they're about to
 * take. While the re-import is running we keep the button mounted but
 * disabled with a spinner, matching the wizard's "Importing..." state. */
export function ImportCorrectedRowsButton({
  readyCount,
  errorCount,
  running,
  onImport,
}: {
  readyCount: number;
  errorCount: number;
  running: boolean;
  onImport: () => void;
}) {
  /* Enabled as soon as *any* row is staged (Ready), the user can re-import
   * the rows they've fixed without waiting until every error is resolved.
   * Only fully blocked when nothing is ready yet (or while running). */
  const disabled = readyCount === 0 || running;
  const label = running
    ? "Importing..."
    : readyCount > 0
      ? `Import ${readyCount} Correct ${readyCount === 1 ? "Row" : "Rows"}`
      : "Import Corrected Rows";
  const button = (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onImport}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md shadow-sm transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#0A77FF]/30",
        disabled
          ? "bg-[#0A77FF]/40 text-white cursor-not-allowed"
          : "bg-[#0A77FF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white cursor-pointer",
      )}
      style={{ fontSize: "13px", fontWeight: 600 }}
    >
      {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {label}
    </button>
  );
  /* Tooltip only appears while the button is disabled because nothing has
   * been fixed yet. Once at least one row is staged (or while running) the
   * button speaks for itself. Uses the shared TooltipContent defaults,
   * clean white surface, neutral text, so it reads consistently with other
   * tooltips in the app. */
  if (!disabled || running) return button;
  const tooltipMsg = errorCount === 1
    ? "Fix the row flagged with errors below to re-import it."
    : "Fix at least one of the rows flagged with errors below to re-import.";
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
        side="bottom"
        sideOffset={8}
        className="z-[200] max-w-[280px] px-3 py-2"
      >
        <span style={{ fontSize: "12.5px", lineHeight: 1.4, fontWeight: 500 }}>{tooltipMsg}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function Th({
  children,
  className,
  style,
  sticky,
  stickySide = "left",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  sticky?: boolean;
  stickySide?: "left" | "right";
} & Omit<React.ThHTMLAttributes<HTMLTableCellElement>, "children" | "className" | "style">) {
  const density = useDensity();
  return (
    <th
      {...rest}
      className={cn(
        "text-left align-middle px-3 whitespace-nowrap border-b border-[#E2E8F0]",
        density === "comfort" ? "h-11" : "h-9",
        sticky && "sticky z-40 bg-[#F8FAFC]",
        className,
      )}
      style={{
        fontSize: "13px",
        fontWeight: 400,
        color: "#475569",
        lineHeight: "1.2",
        ...(sticky ? (stickySide === "right" ? { right: 0 } : { left: 0 }) : null),
        ...style,
      }}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  style,
  sticky,
  stickySide = "left",
  mono,
  title,
  onClick,
  tinted,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  sticky?: boolean;
  stickySide?: "left" | "right";
  mono?: boolean;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLTableCellElement>;
  /** Cell carries its own meaning-bearing tint (validation severity, in-edit
   *  ring) that the row hover must not paint over. */
  tinted?: boolean;
}) {
  const density = useDensity();
  const rowHeight = density === "comfort" ? ROW_HEIGHT_COMFORT : ROW_HEIGHT_CONDENSED;
  return (
    <td
      className={cn(
        "px-3 align-middle whitespace-nowrap truncate text-[#334155] bg-white border-b border-[#E2E8F0]",
        mono && "font-mono",
        sticky && "sticky z-10",
        className,
      )}
      style={{
        height: rowHeight,
        fontSize: "14px",
        ...(sticky ? (stickySide === "right" ? { right: 0 } : { left: 0 }) : null),
        ...style,
      }}
      title={title}
      onClick={onClick}
      data-cell-tint={tinted ? "" : undefined}
    >
      {children}
    </td>
  );
}

/* ─── Header download dropdown ─── */

type ExportFormat = "csv" | "xlsx";

export function DownloadDropdown({
  onPick,
  onUpload,
}: {
  onPick: (format: ExportFormat) => void;
  /** Keeping the upload in this menu is what stops the header growing a third
   *  button: download and upload are two halves of one loop, so they belong in
   *  one control. */
  onUpload: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-md border border-[#0A77FF] bg-white text-[#0A77FF] shadow-sm hover:bg-[#EDF4FF] transition-colors cursor-pointer shrink-0 self-center outline-none focus-visible:ring-2 focus-visible:ring-[#0A77FF]/30"
          style={{ fontSize: "13px", fontWeight: 500 }}
        >
          {DOWNLOAD_META.failed.downloadLabel}
          <ChevronDown className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="z-[200] w-[268px] p-1.5 bg-white border border-[#E2E8F0] rounded-lg shadow-[0_10px_30px_-10px_rgba(15,23,42,0.18)]"
      >
        {/* The menu carries both halves of the correction loop, so it opens by
         *  naming the order they run in. Same tokens as the info banners in the
         *  permission detail panel, scaled down to menu width. */}
        <div className="flex items-start gap-2.5 p-2.5 bg-[#F1F5FF] rounded-lg border border-[#C6D2FF]">
          <Info className="w-4 h-4 shrink-0 mt-[0.5px]" style={{ color: "#4339CA" }} />
          <p style={{ fontSize: "12px", fontWeight: 400, color: "#475569", lineHeight: 1.45 }}>
            First download the error rows in your desired format, fix them, then upload the
            corrected file.
          </p>
        </div>
        <DropdownMenuSeparator className="my-1.5 h-px bg-[#E2E8F0]" />
        <DownloadFormatItem icon="xlsx" label="Download as Excel" onSelect={() => onPick("xlsx")} />
        <DownloadFormatItem icon="csv" label="Download as CSV" onSelect={() => onPick("csv")} />
        <DropdownMenuSeparator className="my-1.5 h-px bg-[#E2E8F0]" />
        <DropdownMenuItem
          onSelect={onUpload}
          className="flex items-center gap-2.5 py-2 px-3 rounded-md cursor-pointer data-[highlighted]:bg-[#F1F5F9]"
        >
          <Upload className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>
            Upload Corrected File
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Selected-rows export dropdown ─── */

export function SelectedRowsDownloadDropdown({
  label,
  onPick,
}: {
  label: string;
  onPick: (format: ExportFormat) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[#E2E8F0] bg-white text-[#334155] shadow-sm hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#0A77FF]/30"
          style={{ fontSize: "12.5px", fontWeight: 500 }}
        >
          {label}
          <ChevronDown className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="z-[200] w-[210px] p-1.5 bg-white border border-[#E2E8F0] rounded-lg shadow-[0_10px_30px_-10px_rgba(15,23,42,0.18)]"
      >
        <DownloadFormatItem icon="csv" label="Download as CSV" onSelect={() => onPick("csv")} />
        <DownloadFormatItem icon="xlsx" label="Download as Excel" onSelect={() => onPick("xlsx")} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DownloadFormatItem({
  icon,
  label,
  onSelect,
}: {
  icon: "csv" | "xlsx";
  label: string;
  onSelect: () => void;
}) {
  const Icon = icon === "csv" ? FileText : FileSpreadsheet;
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className="flex items-center gap-2.5 py-2 px-3 rounded-md cursor-pointer data-[highlighted]:bg-[#F1F5F9]"
    >
      <Icon className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
      <span style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>{label}</span>
    </DropdownMenuItem>
  );
}

/* Apply the active filter to the import's rows and trigger the matching
 * file download via the shared exporter. Both the header dropdown and the
 * selection toolbar route through this so the on-disk file has exactly one
 * column layout regardless of which control triggered it. */
function downloadScopedRows({
  rows,
  filter,
  format,
  importName,
}: {
  rows: ImportedUserRow[];
  filter: RowFilter;
  format: ExportFormat;
  importName: string;
}): void {
  const scoped = rows.filter((r) => {
    if (filter === "imported") return isImported(r._outcome);
    if (filter === "failed") return isFailed(r._outcome);
    return true;
  });
  if (scoped.length === 0) {
    toast.info("No rows to download for this filter.");
    return;
  }
  void exportImportRecords({ rows: scoped, filter, format, importName });
}

/* Format the importedAt ISO timestamp as a date only ("Jul 12, 2026"), matching
 * the Imported On column of the import log listing. No time is shown. */
export function formatImportedOnShort(iso: string): string {
  try {
    return format(new Date(iso), "MMM dd, yyyy");
  } catch {
    return iso;
  }
}
