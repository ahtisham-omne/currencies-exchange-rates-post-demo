/* One import's record at /items/imports/:importId (port of role-zen's
 * ImportRecordDetailPage): header with file name, importer and date chips,
 * description, the filter-independent "Download/Upload Failed Rows" menu (only
 * while failed rows remain, with Upload Corrected File), the "Import N Correct Rows"
 * inline-fix commit, the CorrectionStrip while a corrected file is awaited,
 * the rows table with Show All / Imported / Failed chips (honouring
 * ?filter=), inline editing of failed rows with auto-save, error reason
 * sub-rows, selection export, density and pagination. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ChevronDown,
  Clock,
  FileInput,
  FileSpreadsheet,
  FileText,
  Info,
  Search,
  Upload,
  User,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useItems } from "@/app/context/ItemsContext";
import { ITEMS_IMPORT_SPEC, type ItemReviewField, type ItemReviewRow } from "./spec";
import { ImportSelectionBar, SELECTION_ACTION_BASE, SELECTION_ACTION_CLASS } from "./SelectionBar";
import { buildValidationContext, validateRows, type CellIssue } from "./validation";
import {
  clearPendingCorrection,
  DOWNLOAD_META,
  ensureSeededForLoad,
  getImporter,
  getPendingCorrection,
  IMPORT_RECORD_COLUMNS,
  importNameToFilenameStem,
  isFailed,
  isImported,
  loadImportDetail,
  MODULE_SLUG,
  startPendingCorrection,
  subscribeToPendingCorrections,
  type ImportedItemRow,
  type PendingCorrection,
  type RowFilter,
  type StoredImportDetail,
} from "./importHistory";
import { exportFailedTemplateRows, exportImportRecords, type RecordExportFormat } from "./recordExport";
import { ItemsTopBar } from "./ItemsTopBar";
import { DensityDropdown, ROW_HEIGHT_COMFORT, ROW_HEIGHT_CONDENSED, type Density } from "./density";
import { Pagination } from "./Pagination";
import { HighlightMatch } from "./HighlightMatch";
import { CellIssueTooltip } from "./CellIssueTooltip";
import { ImportWizardModal, type CorrectionSetupContext } from "./ImportWizardModal";
import { ImportReviewModal } from "./ImportReviewModal";
import { BackButton, ImporterOverviewCard } from "./ImportHistoryPage";
import { useColumnWidths } from "./columnResize";
import { IssuesBanner, type ReviewIssue } from "./IssuesBanner";
import { formatNumberDisplay } from "./numberDisplay";

const HIGHLIGHT_CLASS = "bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5";
const SELECT_COL_WIDTH = 44;
const ROW_COL_WIDTH = 64;
const RESULT_COL_WIDTH = 90;
const MENU_CLASS = "z-[200] p-1.5 bg-white border border-[#E2E8F0] rounded-lg shadow-[0_10px_30px_-10px_rgba(15,23,42,0.18)]";
const MENU_ITEM_CLASS = "flex items-center gap-2.5 py-2 px-3 rounded-md cursor-pointer data-[highlighted]:bg-[#F1F5F9]";

type DisplayOutcome = "imported" | "skipped" | "failed";
const OUTCOME_TOKENS: Record<DisplayOutcome, { bg: string; text: string; border: string; label: string }> = {
  imported: { bg: "#ECFDF5", text: "#065F46", border: "#D1FAE5", label: "Imported" },
  skipped: { bg: "#FEF2F2", text: "#991B1B", border: "#FEE2E2", label: "Failed" },
  failed: { bg: "#FEF2F2", text: "#991B1B", border: "#FEE2E2", label: "Failed" },
};


function HeaderChip({ icon, children, interactive }: { icon: React.ReactNode; children: React.ReactNode; interactive?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border shrink-0 transition-colors ${interactive ? "cursor-pointer hover:bg-[#EEF2F6]" : ""}`}
      style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}
    >
      {icon}
      <span style={{ fontSize: "11px", fontWeight: 500, color: "#475569" }}>{children}</span>
    </span>
  );
}

function FilterChipButton({ label, count, active, tone, onClick }: { label: string; count: number; active: boolean; tone: "blue" | "imported" | "failed"; onClick: () => void }) {
  const toneStyle =
    tone === "imported" ? OUTCOME_TOKENS.imported : tone === "failed" ? OUTCOME_TOKENS.failed : { bg: "#EDF4FF", text: "#0A77FF", border: "#0A77FF" };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
        active ? "" : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] hover:border-[#CBD5E1]"
      }`}
      style={{ fontSize: "12px", fontWeight: active ? 500 : 400, ...(active ? { borderColor: toneStyle.border, backgroundColor: toneStyle.bg, color: toneStyle.text } : {}) }}
    >
      {label}
      <span
        className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full tabular-nums ${!active ? "bg-[#F1F5F9] text-[#475569]" : tone === "blue" ? "bg-[#0A77FF]/10 text-[#0A77FF]" : ""}`}
        style={{ fontSize: "10px", fontWeight: 600, ...(active && tone !== "blue" ? { backgroundColor: "rgba(255,255,255,0.6)", color: toneStyle.text } : {}) }}
      >
        {count}
      </span>
    </button>
  );
}

/* ─── Correction strip ─── */

function CorrectionStrip({
  pending,
  onOpenUpload,
  onDropFile,
  onRedownload,
  onDismiss,
}: {
  pending: PendingCorrection;
  onOpenUpload: () => void;
  onDropFile: (file: File) => void;
  onRedownload: (format: RecordExportFormat) => void;
  onDismiss: () => void;
}) {
  const [depth, setDepth] = useState(0);
  const dragging = depth > 0;
  return (
    <div
      aria-label="Awaiting corrected file"
      onDragEnter={(e) => {
        e.preventDefault();
        setDepth((d) => d + 1);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDepth((d) => Math.max(0, d - 1))}
      onDrop={(e) => {
        e.preventDefault();
        setDepth(0);
        const f = e.dataTransfer.files?.[0];
        if (f) onDropFile(f);
      }}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors ${dragging ? "border-[#0A77FF] bg-[#EFF6FF]" : "border-[#FDE68A] bg-[#FFFBEB]"}`}
      style={{ borderStyle: dragging ? "dashed" : "solid", borderWidth: 1.5 }}
    >
      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: dragging ? "#DBEAFE" : "#FEF3C7" }}>
        <Upload className="w-4 h-4" style={{ color: dragging ? "#0A77FF" : "#B45309" }} />
      </div>
      <div className="min-w-0 flex-1">
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{dragging ? "Drop to upload your corrected file" : "Waiting on your corrected file"}</div>
        <div className="mt-0.5 truncate" style={{ fontSize: "12px", color: "#92400E" }}>
          <span style={{ fontWeight: 500 }}>{pending.fileName}</span>, {pending.rowCount} error {pending.rowCount === 1 ? "row" : "rows"}, downloaded{" "}
          {format(new Date(pending.startedISO), "MMM d 'at' h:mm a")}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-md border border-[#D97706] bg-white text-[#B45309] shadow-sm hover:bg-[#FEF3C7] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
              style={{ fontSize: "13px", fontWeight: 500 }}
            >
              Download Again
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className={`${MENU_CLASS} w-[200px]`}>
            <DropdownMenuItem onClick={() => onRedownload("csv")} className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer text-[#334155] focus:bg-[#F1F5F9] focus:text-[#0F172A]" style={{ fontSize: "13px", fontWeight: 500 }}>
              <FileText className="w-4 h-4" style={{ color: "#64748B" }} />
              Download as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRedownload("xlsx")} className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer text-[#334155] focus:bg-[#F1F5F9] focus:text-[#0F172A]" style={{ fontSize: "13px", fontWeight: 500 }}>
              <FileSpreadsheet className="w-4 h-4" style={{ color: "#64748B" }} />
              Download as Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={onOpenUpload}
          className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-md text-white shadow-sm transition-colors cursor-pointer hover:bg-[#B45309]"
          style={{ backgroundColor: "#D97706", fontSize: "13px", fontWeight: 600 }}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Corrected File
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Stop waiting for a corrected file"
          title="Stop waiting for a corrected file"
          className="w-8 h-8 rounded-md flex items-center justify-center text-[#B45309] hover:bg-[#FEF3C7] transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ─── Page ─── */

export default function ImportRecordPage() {
  /* Resizable columns: each column at its dragged width (columnResize.tsx). */
  const { widthOf, grip } = useColumnWidths();
  const recordColumns = useMemo(() => IMPORT_RECORD_COLUMNS.map((c) => ({ ...c, width: widthOf(c.key, c.width) })), [widthOf]);
  const tableMinWidth = SELECT_COL_WIDTH + ROW_COL_WIDTH + RESULT_COL_WIDTH + recordColumns.reduce((s, c) => s + c.width, 0);
  const { importId = "" } = useParams<{ importId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { items, upsertImportedItems } = useItems();
  const spec = ITEMS_IMPORT_SPEC;

  /* A deep link straight to a seeded import still lands on a populated page:
   * lay the seeds down before the first read, as the history listing does. */
  useState(() => {
    ensureSeededForLoad();
    return true;
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const detail = useMemo<StoredImportDetail | null>(() => loadImportDetail(importId), [importId, refreshKey]);
  const [filter, setFilter] = useState<RowFilter>(() => {
    const f = searchParams.get("filter");
    return f === "imported" || f === "failed" ? f : "all";
  });
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState<Density>("condensed");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  /* Fix Failed Rows: the failed rows, frozen when the modal opens. */
  const [fixRun, setFixRun] = useState<{ rows: ItemReviewRow[]; parentRows: number[] } | null>(null);
  const [pending, setPending] = useState<PendingCorrection | null>(() => getPendingCorrection(importId));
  const [wizardOpen, setWizardOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [pulseRows, setPulseRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    setPending(getPendingCorrection(importId));
    return subscribeToPendingCorrections(() => setPending(getPendingCorrection(importId)));
  }, [importId]);
  useEffect(() => {
    setSelectedRows(new Set());
    setCurrentPage(1);
  }, [filter, importId]);

  const records = useMemo(() => detail?.records ?? [], [detail]);
  const effectiveRows = records;
  const validationContext = useMemo(() => buildValidationContext(items, spec), [items, spec]);
  const validation = useMemo(() => validateRows(effectiveRows, validationContext, spec), [effectiveRows, validationContext, spec]);
  const validationByRow = useMemo(() => new Map(effectiveRows.map((r, i) => [r._row, validation.rows[i]])), [effectiveRows, validation]);

  const displayOutcome = useCallback(
    (r: ImportedItemRow): DisplayOutcome => {
      if (isImported(r._outcome)) return "imported";
      return r._outcome === "Skipped" ? "skipped" : "failed";
    },
    [],
  );

  const counts = useMemo(() => {
    let imported = 0;
    let failed = 0;
    for (const r of effectiveRows) {
      const o = displayOutcome(r);
      if (o === "imported") imported++;
      else if (o === "failed" || o === "skipped") failed++;
    }
    return { imported, failed, all: effectiveRows.length };
  }, [effectiveRows, displayOutcome]);

  /* Filter membership is frozen per import + filter. */
  const snapshotRef = useRef<{ key: string; rows: Set<number> } | null>(null);
  const memberRows = useMemo(() => {
    const key = `${importId}|${filter}|${records.length}`;
    if (snapshotRef.current?.key === key) return snapshotRef.current.rows;
    const set = new Set<number>();
    for (const r of effectiveRows) {
      const o = displayOutcome(r);
      if (filter === "all" || (filter === "imported" && o === "imported") || (filter === "failed" && o !== "imported")) set.add(r._row);
    }
    snapshotRef.current = { key, rows: set };
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importId, filter, records.length]);

  const q = search.trim().toLowerCase();
  const visibleRows = useMemo(
    () =>
      effectiveRows.filter(
        (r) => memberRows.has(r._row) && (!q || recordColumns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q)) || (r._message ?? "").toLowerCase().includes(q)),
      ),
    [effectiveRows, memberRows, q],
  );
  const totalPages = Number.isFinite(recordsPerPage) ? Math.max(1, Math.ceil(visibleRows.length / recordsPerPage)) : 1;
  const safePage = Math.min(currentPage, totalPages);
  const pagedRows = Number.isFinite(recordsPerPage) ? visibleRows.slice((safePage - 1) * recordsPerPage, safePage * recordsPerPage) : visibleRows;

  const liveMessage = useCallback(
    (r: ImportedItemRow): string | undefined => {
      const v = validationByRow.get(r._row);
      const errs = v?.issues.filter((i) => i.severity === "error").map((i) => i.message) ?? [];
      return errs.length ? errs.join(" ") : undefined;
    },
    [validationByRow],
  );

  /* Downloads */
  const importName = detail?.name ?? "import";
  /* The error-rows download (UAC downloadFailedRows), shared by the header menu
   * and the correction strip's "Download Again": the failed rows in the template
   * layout plus "Error Message". */
  const downloadFailedRows = useCallback(
    (fmt: RecordExportFormat) => {
      const rows = effectiveRows.filter((r) => isFailed(r._outcome));
      if (rows.length === 0) {
        toast.info("No rows to download for this filter.");
        return;
      }
      void (async () => {
        const messages = rows.map((r) => liveMessage(r) ?? r._message ?? "");
        const fileName = await exportFailedTemplateRows({ rows, messages, format: fmt, importName, suffix: DOWNLOAD_META.failed.fileSuffix, spec });
        startPendingCorrection({ importId, moduleSlug: MODULE_SLUG, fileName, rowCount: rows.length, startedISO: new Date().toISOString() });
      })();
    },
    [effectiveRows, liveMessage, importName, importId, spec],
  );

  const exportSelected = async (fmt: RecordExportFormat) => {
    const rows = effectiveRows.filter((r) => selectedRows.has(r._row));
    if (rows.length === 0) {
      toast.info("No selected rows to export.");
      return;
    }
    await exportImportRecords({ rows, filter: "all", format: fmt, importName, suffix: "selected" });
  };

  /* Fix Failed Rows: the Review and Fix modal with this import's failed rows,
   * each linked to its own row here. */
  /* Selected rows that failed: what the selection bar's Fix Failed Rows opens. */
  const selectedFailedCount = records.filter((r) => selectedRows.has(r._row) && isFailed(r._outcome)).length;
  const openFixFailedRows = (only?: ReadonlySet<number>) => {
    /* `only`: the selection bar's rows; the header button fixes every failed row. */
    const failed = records.filter((r) => isFailed(r._outcome) && (!only || only.has(r._row)));
    if (failed.length === 0) return;
    setFixRun({
      rows: failed.map((r) => {
        const { _row, _outcome, _message, ...data } = r;
        void _row;
        void _outcome;
        void _message;
        return data as ItemReviewRow;
      }),
      parentRows: failed.map((r) => r._row),
    });
  };
  const pulseFixedRows = (ids: Set<number>) => {
    setFilter("imported");
    setCurrentPage(1);
    setPulseRows(ids);
    window.setTimeout(() => setPulseRows(new Set()), 1500);
  };
  /* The fix run finished: reload this import and, when the admin stays on it
   * ("View Original Import"), land on its imported rows with the fixed ones pulsing. */
  const onFixCompleted = () => {
    const ids = new Set(fixRun?.parentRows ?? []);
    setFixRun(null);
    setRefreshKey((k) => k + 1);
    const here = window.location.pathname;
    window.setTimeout(() => {
      if (window.location.pathname === here) pulseFixedRows(ids);
    }, 0);
  };

  /* Not found */
  /* The issues strip: each failed row's flagged cells (or its stored reason when no cell carries
   * one), sorted by row then column, as the review lists them. */
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const failedIssues = useMemo<ReviewIssue[]>(() => {
    const colIndex = new Map(recordColumns.map((col, i) => [String(col.key), i]));
    const label = new Map(recordColumns.map((col) => [String(col.key), col.label]));
    const out: (ReviewIssue & { colIndex: number })[] = [];
    for (const r of records) {
      if (!isFailed(r._outcome)) continue;
      const v = validationByRow.get(r._row);
      let cellIssues = 0;
      for (const [field, list] of Object.entries(v?.byField ?? {})) {
        if (!colIndex.has(field)) continue;
        for (const issue of (list ?? []) as { severity: string; message: string }[]) {
          if (issue.severity !== "error") continue;
          out.push({ rowId: String(r._row), rowNumber: r._row, field, columnLabel: label.get(field) ?? field, severity: "error", message: issue.message, colIndex: colIndex.get(field) ?? 0 });
          cellIssues++;
        }
      }
      if (cellIssues === 0 && r._message) {
        out.push({ rowId: String(r._row), rowNumber: r._row, field: "_result", columnLabel: "Result", severity: "error", message: r._message, colIndex: -1 });
      }
    }
    return out.sort((a, b) => a.rowNumber - b.rowNumber || a.colIndex - b.colIndex);
  }, [records, validationByRow, recordColumns]);

  /* Jump from the strip: show the row (Show All, no search, its page), then scroll to the cell and
   * outline it for a moment. */
  const [pendingJump, setPendingJump] = useState<{ row: number; field: string } | null>(null);
  const jumpToIssue = useCallback((issue: ReviewIssue) => {
    setFilter("all");
    setSearch("");
    setPendingJump({ row: issue.rowNumber, field: issue.field });
  }, []);
  useEffect(() => {
    if (!pendingJump) return;
    const idx = visibleRows.findIndex((r) => r._row === pendingJump.row);
    if (idx < 0) return;
    const target = Number.isFinite(recordsPerPage) ? Math.floor(idx / recordsPerPage) + 1 : 1;
    if (target !== currentPage) { setCurrentPage(target); return; }
    const jump = pendingJump;
    setPendingJump(null);
    requestAnimationFrame(() => {
      const tr = tableScrollRef.current?.querySelector<HTMLElement>(`tr[data-row-id="${jump.row}"]`);
      const col = jump.field === "_result" ? 2 : recordColumns.findIndex((cc) => String(cc.key) === jump.field) + 3;
      const td = col >= 2 ? (tr?.children[col] as HTMLElement | undefined) : undefined;
      if (!td) return;
      td.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      td.style.outline = "2px solid #60A5FA";
      td.style.outlineOffset = "-2px";
      window.setTimeout(() => {
        td.style.outline = "";
        td.style.outlineOffset = "";
      }, 1800);
    });
  }, [pendingJump, visibleRows, recordsPerPage, currentPage, recordColumns]);

  if (!detail) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center gap-2 bg-[#F8FAFC]">
        <span style={{ fontSize: "14px", color: "#64748B" }}>Import Not Found.</span>
        <button type="button" onClick={() => navigate(spec.routes.history)} className="text-[#0A77FF] hover:underline cursor-pointer" style={{ fontSize: "13px", fontWeight: 500 }}>
          Back to Import History
        </button>
      </div>
    );
  }

  const importer = getImporter(detail.importerKey);
  const correctionContext: CorrectionSetupContext = {
    parentName: detail.fileName || detail.name,
    fileName: pending?.fileName ?? null,
    rowCount: pending?.rowCount ?? counts.failed,
    onRedownload: downloadFailedRows,
  };
  const rowHeight = density === "comfort" ? ROW_HEIGHT_COMFORT : ROW_HEIGHT_CONDENSED;
  const pagedIds = pagedRows.map((r) => r._row);
  const allSelected = pagedIds.length > 0 && pagedIds.every((id) => selectedRows.has(id));
  const someSelected = pagedIds.some((id) => selectedRows.has(id));
  const checkboxClass =
    "h-4 w-4 rounded-[4px] data-[state=checked]:bg-[#0A77FF] data-[state=checked]:border-[#0A77FF] data-[state=checked]:text-white data-[state=indeterminate]:bg-[#0A77FF] data-[state=indeterminate]:border-[#0A77FF] data-[state=indeterminate]:text-white";
  const thClass = `text-left align-middle px-3 whitespace-nowrap border-b border-[#E2E8F0] ${density === "comfort" ? "h-11" : "h-9"}`;
  const thStyle: React.CSSProperties = { fontSize: "13px", fontWeight: 400, color: "#475569", lineHeight: 1.2 };

  const downloadMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-[8px] border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC] shadow-sm transition-all duration-200 cursor-pointer shrink-0 self-center outline-none focus-visible:ring-2 focus-visible:ring-[#0A77FF]/30"
          style={{ fontSize: "13px", fontWeight: 500 }}
        >
          {DOWNLOAD_META.failed.downloadLabel}
          <ChevronDown className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className={`${MENU_CLASS} w-[268px]`}>
        <div className="flex items-start gap-2.5 p-2.5 bg-[#F1F5FF] rounded-lg border border-[#C6D2FF]">
          <Info className="w-4 h-4 shrink-0 mt-[0.5px]" style={{ color: "#4339CA" }} />
          <p style={{ fontSize: "12px", fontWeight: 400, color: "#475569", lineHeight: 1.45 }}>
            First download the failed rows in your desired format, fix them, then upload the corrected file.
          </p>
        </div>
        <div aria-hidden className="h-1.5" />
        <DropdownMenuItem onSelect={() => downloadFailedRows("xlsx")} className={MENU_ITEM_CLASS}>
          <FileSpreadsheet className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>Download as Excel</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadFailedRows("csv")} className={MENU_ITEM_CLASS}>
          <FileText className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>Download as CSV</span>
        </DropdownMenuItem>
        {/* A border, not a 1px fill: it snaps to whole pixels so it never renders thicker. */}
        <DropdownMenuSeparator className="my-1.5 h-0 border-t border-[#E2E8F0] bg-transparent" />
        <DropdownMenuItem
          onSelect={() => {
            setDroppedFile(null);
            setWizardOpen(true);
          }}
          className={MENU_ITEM_CLASS}
        >
          <Upload className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>Upload Corrected File</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      <ItemsTopBar
        crumbs={[
          { label: "Items & Inventory", to: "/dashboard" },
          { label: "Items", to: "/items" },
          { label: "Import History", to: spec.routes.history },
          { label: "Import Details" },
        ]}
      />
      {/* Header */}
      <div className="shrink-0 px-6 lg:px-8 pt-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm" style={{ padding: "12px 16px" }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <BackButton onClick={() => navigate(spec.routes.listing)} label="Back to the list" />
              <div
                className="w-11 h-11 rounded-xl border border-white flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#EDF4FF", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 0 0 2px rgba(10,119,255,0.10)" }}
              >
                <FileInput className="w-5 h-5" style={{ color: "#0A77FF" }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <h1 className="text-[#0F172A] truncate min-w-0" style={{ fontSize: "16px", fontWeight: 700, lineHeight: "22px" }}>
                    {detail.fileName || detail.name}
                  </h1>
                  <HoverCard openDelay={120} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <span>
                        <HeaderChip interactive icon={<User className="w-3 h-3" style={{ color: "#94A3B8" }} />}>
                          {importer.name}
                        </HeaderChip>
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent side="bottom" align="start" sideOffset={8} className="w-[320px] p-0 rounded-xl border border-[#E2E8F0] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)]">
                      <ImporterOverviewCard importer={importer} />
                    </HoverCardContent>
                  </HoverCard>
                  <HeaderChip icon={<Clock className="w-3 h-3" style={{ color: "#94A3B8" }} />}>{format(new Date(detail.dateISO), "MMM dd, yyyy")}</HeaderChip>
                </div>
                <p className="mt-1 truncate" style={{ fontSize: "12.5px", lineHeight: 1.6 }}>
                  {detail.description ? (
                    <>
                      <span style={{ color: "#475569", fontWeight: 600 }}>Description: </span>
                      <span style={{ color: "#64748B", fontWeight: 400 }}>{detail.description}</span>
                    </>
                  ) : (
                    <span className="italic" style={{ color: "#94A3B8" }}>
                      No Description Added
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {counts.failed > 0 && downloadMenu}
              {counts.failed > 0 && <FixFailedRowsButton failedCount={counts.failed} onClick={() => openFixFailedRows()} />}
            </div>
          </div>
          {pending && (
            <div style={{ marginTop: 12 }}>
              <CorrectionStrip
                pending={pending}
                onOpenUpload={() => {
                  setDroppedFile(null);
                  setWizardOpen(true);
                }}
                onDropFile={(f) => {
                  setDroppedFile(f);
                  setWizardOpen(true);
                }}
                onRedownload={downloadFailedRows}
                onDismiss={() => clearPendingCorrection(importId)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 px-6 lg:px-8 py-4 flex flex-col">
        <div className="flex-1 min-h-0 bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
          <div className="shrink-0 px-4 pt-3.5 pb-2 flex items-center justify-between gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#CBD5E1" }} />
              <input
                type="text"
                placeholder="Search records..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-[#E2E8F0] shadow-sm rounded-md placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/20 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {/* The listing's record count ("94 of 100 rows"; selected of all while rows are selected), then its divider, then density. */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="mr-1 hidden sm:inline" style={{ fontSize: "14px", fontWeight: 500 }}>
                {selectedRows.size > 0 || visibleRows.length !== effectiveRows.length ? (
                  <>
                    <span style={{ color: "#0F172A" }}>{selectedRows.size > 0 ? selectedRows.size : visibleRows.length}</span>
                    <span style={{ color: "rgba(71,85,105,0.6)" }}> of </span>
                    <span style={{ color: "#475569" }}>{effectiveRows.length}</span>
                    <span style={{ color: "rgba(71,85,105,0.7)" }}> {spec.nouns.plural}</span>
                  </>
                ) : (
                  <>
                    <span style={{ color: "#0F172A" }}>{effectiveRows.length}</span>
                    <span style={{ color: "rgba(71,85,105,0.7)" }}> {effectiveRows.length === 1 ? spec.nouns.singular : spec.nouns.plural}</span>
                  </>
                )}
              </span>
              <div className="w-px h-5 mx-1 hidden sm:block" style={{ backgroundColor: "rgba(226,232,240,0.6)" }} />
              <DensityDropdown density={density} onChange={setDensity} />
            </div>
          </div>

          {selectedRows.size > 0 ? (
            <div className="shrink-0 [&>div]:h-[52px]">
              <ImportSelectionBar
                count={selectedRows.size}
                noun="row"
                onExport={(format) => void (format === "csv" ? exportSelected("csv") : exportSelected("xlsx"))}
                onClear={() => setSelectedRows(new Set())}
                actions={
                  selectedFailedCount > 0 ? (
                    <FixSelectedRowsAction
                      count={selectedFailedCount}
                      onClick={() => {
                        const only = new Set(selectedRows);
                        setSelectedRows(new Set());
                        openFixFailedRows(only);
                      }}
                    />
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="shrink-0 px-4 pb-3 border-b border-[#E2E8F0] flex items-center gap-1.5 overflow-x-auto">
              <FilterChipButton label="Show All" count={counts.all} active={filter === "all"} tone="blue" onClick={() => setFilter("all")} />
              {counts.imported > 0 && <FilterChipButton label="Imported" count={counts.imported} active={filter === "imported"} tone="imported" onClick={() => setFilter("imported")} />}
              {counts.failed > 0 && <FilterChipButton label="Failed" count={counts.failed} active={filter === "failed"} tone="failed" onClick={() => setFilter("failed")} />}
            </div>
          )}

          {/* The review's issues strip, view only (no Skip): why the failed rows failed, on every filter,
              right above the table header. */}
          <IssuesBanner issues={failedIssues} noun="item" onJump={jumpToIssue} errorRowCount={counts.failed} />

          <div ref={tableScrollRef} className="flex-1 min-h-0 overflow-auto relative" style={{ scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}>
              <table className="w-full border-separate" style={{ minWidth: tableMinWidth, borderSpacing: 0 }}>
                <thead className="sticky top-0 z-30 bg-white">
                  <tr className="bg-[#F1F5F9]/30">
                    <th className={thClass} style={{ ...thStyle, width: SELECT_COL_WIDTH, paddingLeft: 12, paddingRight: 0, textAlign: "center" }}>
                      <Checkbox
                        aria-label="Select all rows on page"
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={(c) =>
                          setSelectedRows((prev) => {
                            const next = new Set(prev);
                            pagedIds.forEach((id) => (c === true ? next.add(id) : next.delete(id)));
                            return next;
                          })
                        }
                        className={checkboxClass}
                      />
                    </th>
                    <th className={thClass} style={{ ...thStyle, width: ROW_COL_WIDTH, paddingLeft: 16 }}>
                      Row
                    </th>
                    <th className={thClass} style={{ ...thStyle, width: RESULT_COL_WIDTH }}>
                      Result
                    </th>
                    {recordColumns.map((c) => (
                      <th key={c.key} className={thClass} style={{ ...thStyle, width: c.width, position: "relative" }}>
                        {c.label}
                        {grip(c.key, c.width)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.length === 0 && (
                    <tr>
                      <td colSpan={recordColumns.length + 3} className="py-16 text-center" style={{ fontSize: "13px", color: "#94A3B8" }}>
                        No Rows Match This Filter.
                      </td>
                    </tr>
                  )}
                  {pagedRows.map((r) => {
                    const outcome = displayOutcome(r);
                    const v = validationByRow.get(r._row);
                    const errored = outcome === "failed" || outcome === "skipped";
                    const failedRow = isFailed(r._outcome);
                    const selected = selectedRows.has(r._row);
                    const rowTint = selected ? "#EFF6FF" : errored ? "#FFFBFB" : undefined;
                    const tokens = OUTCOME_TOKENS[outcome];
                    const message = liveMessage(r) ?? r._message;
                    /* No reason sub-row: the reason is the highlighted cell's tooltip. A failed row with no
                     * highlighted cell (row-level or stale message) carries it on the Failed pill instead. */
                    const rowLevelMessage = errored && message && !(failedRow && recordColumns.some((c) => (v?.byField[c.key]?.length ?? 0) > 0)) ? message : "";
                    const tdBase: React.CSSProperties = { height: rowHeight, fontSize: "14px", backgroundColor: rowTint ?? "#FFFFFF" };
                    const pill = (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full border whitespace-nowrap"
                        style={{ backgroundColor: tokens.bg, color: tokens.text, borderColor: tokens.border, fontSize: "11px", fontWeight: 600 }}
                      >
                        {tokens.label}
                      </span>
                    );
                    return (
                      <RowPair key={r._row}>
                        <tr data-row-id={r._row} className={pulseRows.has(r._row) ? "import-fixed-row-pulse" : undefined}>
                          <td
                            className="px-3 align-middle whitespace-nowrap border-b border-[#E2E8F0]"
                            style={{ ...tdBase, paddingLeft: 12, paddingRight: 0, textAlign: "center", borderLeft: errored ? "2px solid #EF4444" : undefined }}
                          >
                            <Checkbox
                              aria-label={`Select row ${r._row}`}
                              checked={selected}
                              onCheckedChange={(c) =>
                                setSelectedRows((prev) => {
                                  const next = new Set(prev);
                                  if (c === true) next.add(r._row);
                                  else next.delete(r._row);
                                  return next;
                                })
                              }
                              className={checkboxClass}
                            />
                          </td>
                          <td className="px-3 align-middle whitespace-nowrap border-b border-[#E2E8F0] text-left tabular-nums text-[#64748B]" style={{ ...tdBase, paddingLeft: 16 }}>
                            {r._row}
                          </td>
                          <td className="px-3 align-middle whitespace-nowrap border-b border-[#E2E8F0]" style={tdBase}>
                            {rowLevelMessage ? <CellIssueTooltip issues={[rowLevelIssue(rowLevelMessage)]}>{pill}</CellIssueTooltip> : pill}
                          </td>
                          {recordColumns.map((c) => {
                            /* Number columns read thousands separated, as in Review and Fix. */
                            const raw = r[c.key] ?? "";
                            const val = spec.columnByKey[c.key as ItemReviewField]?.kind === "number" ? formatNumberDisplay(raw) : raw;
                            const issues = failedRow ? (v?.byField[c.key] ?? []) : [];
                            const severity = issues.length ? "error" : null;
                            const display = val.trim() === "" ? (
                              <span className="text-[#CBD5E1]">-</span>
                            ) : (
                              <HighlightMatch text={val} query={search} matchClassName={HIGHLIGHT_CLASS} />
                            );
                            return (
                              <td
                                key={c.key}
                                className={`px-3 align-middle whitespace-nowrap truncate text-[#334155] border-b border-[#E2E8F0] ${c.mono ? "font-mono" : ""}`}
                                title={issues.length ? undefined : val}
                                style={{
                                  ...tdBase,
                                  width: c.width,
                                  maxWidth: c.width,
                                  backgroundColor: severity === "error" ? "#FEF2F2" : tdBase.backgroundColor,
                                  boxShadow: severity === "error" ? "inset 0 0 0 1px #FECACA" : undefined,
                                }}
                              >
                                {issues.length > 0 ? (
                                  <CellIssueTooltip issues={issues}>{display}</CellIssueTooltip>
                                ) : (
                                  display
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </RowPair>
                    );
                  })}
                </tbody>
              </table>
          </div>
          <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              recordsPerPage={recordsPerPage}
              onRecordsPerPageChange={(n) => {
                setRecordsPerPage(n);
                setCurrentPage(1);
              }}
              pageSizeOptions={[10, 20, 50, 100]}
              allowAll
            />
        </div>
      </div>

      {/* Fix Failed Rows: the Review and Fix modal, linked row by row to this
        * import, so the run nests under it and closes out its rows. */}
      {fixRun && (
        <ImportReviewModal
          open
          importName={`${detail.fileName || detail.name} (corrected)`}
          importDescription=""
          fileName={`${detail.fileName || detail.name} (corrected)`}
          parsedRows={fixRun.rows}
          sessionParentId={importId}
          fixParentRows={fixRun.parentRows}
          validationContext={validationContext}
          onClose={() => setFixRun(null)}
          onCompleted={onFixCompleted}
          spec={spec}
        />
      )}

      <ImportWizardModal
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setDroppedFile(null);
        }}
        parentImportId={importId}
        correction={correctionContext}
        initialFile={droppedFile}
        title="Re-import Fixed Records"
        description="Fixed the errors in your downloaded file? Upload it here to re-import, no need to start over."
        validationContext={validationContext}
        onImportCompleted={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

/** Opens the Review and Fix modal with this import's failed rows. The fixed
 *  rows import as a correction nested under this import. */
/** The selection bar's "Fix Failed Rows (N)": the Review and Fix modal with only the selected rows
 *  that failed. Hidden by the caller when none of them failed. */
function FixSelectedRowsAction({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${SELECTION_ACTION_BASE} ${SELECTION_ACTION_CLASS.primary}`}>
      <Wrench className="w-3.5 h-3.5" />
      <span>Fix Failed Rows</span>
      <span className="opacity-80">({count})</span>
    </button>
  );
}

function FixFailedRowsButton({ failedCount, onClick }: { failedCount: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md shadow-sm transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#0A77FF]/30 bg-[#0A77FF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white cursor-pointer"
      style={{ fontSize: "13px", fontWeight: 600 }}
    >
      <Wrench className="w-3.5 h-3.5" />
      Fix {failedCount} Failed {failedCount === 1 ? "Row" : "Rows"}
    </button>
  );
}

/** A failed row's stored message as a cell-issue tooltip entry, for rows with no highlighted cell. */
function rowLevelIssue(message: string): CellIssue {
  return { field: "", severity: "error", message, explanation: message } as unknown as CellIssue;
}

function RowPair({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Exposed for the listing's post-import banner and tests. */
export function recordHref(importId: string): string {
  return ITEMS_IMPORT_SPEC.routes.record.replace(":importId", importId);
}

export { importNameToFilenameStem };
