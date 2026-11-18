/* The import record page for Item Library, Categories, Partners and Partner
 * Group: /company-settings/data-imports/<slug>/<importId>.
 *
 * The Users ImportRecordDetailPage (../ImportRecordDetailPage.tsx) with the
 * module's columns, validator and downloads. Its visual parts are the Users
 * ones, imported from that file (importer overview card, Th / Td cells, the
 * outcome and severity tokens, the "Fix Error Rows Manually" download menu,
 * the selected-rows export menu, the Import Corrected Rows button), plus the
 * Users review's CellInput / CellIssueTooltip / ImportCompleteDialog, the
 * CorrectionStrip and the same Import wizard. The body is the Users body:
 * search, Show All / Imported / Failed chips, density, the inline fix and
 * re-import loop, the 2400ms overlay, the fix child log, ?filter= deep links
 * and the pending-correction task. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, CircleX, TriangleAlert, FileInput, Loader2, Search, X, Clock, User } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { TooltipProvider } from "../../ui/tooltip";
import { cn } from "../../ui/utils";
import { getModuleBySlug, resolveImportSurface } from "../moduleData";
import { Pagination } from "../Pagination";
import { ExpandableDescription } from "../../shared/ExpandableDescription";
import { HighlightMatch } from "../../alerts-settings/HighlightMatch";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../../ui/hover-card";
import { Checkbox } from "../../ui/checkbox";
import { DensityContext, DensityDropdown, type DensityOption } from "../density";
import { CellIssueTooltip, ImportCompleteDialog } from "../import-review/ImportReviewModal";
import type { CellIssue } from "../import-review/validation";
import {
  CELL_SEVERITY_BG,
  CELL_SEVERITY_SHADOW,
  DownloadDropdown,
  HIGHLIGHT_CLASS,
  ImportCorrectedRowsButton,
  ImporterOverviewCard,
  PAGE_SIZE_OPTIONS,
  RESULT_COL_WIDTH,
  ROW_OUTCOME_TOKENS,
  SELECT_COL_WIDTH,
  Td,
  Th,
  formatImportedOnShort,
  type DisplayOutcome,
} from "../ImportRecordDetailPage";
import { DOWNLOAD_META, isFailed, isImported, importNameToFilenameStem, type RowFilter } from "../importRecords";
import { getCompletedImports, updateCompletedImportCounts, addFixChildImport } from "../importHistory";
import { getImporter, type ImporterKey } from "../importers";
import { ImportWizardModal } from "../import-wizard/ImportWizardModal";
import { CorrectionStrip } from "../CorrectionStrip";
import { ImportSelectionBar } from "../ImportSelectionBar";
import { ExpandWidthButton, WIDTH_TRANSITION_CLASS, useExpandedWidth } from "../ExpandWidthButton";
import { ImportColumnHeaderMenu } from "../table-columns/ImportColumnHeaderMenu";
import { useColumnControls } from "../table-columns/useColumnControls";
import {
  startPendingCorrection,
  clearPendingCorrection,
  getPendingCorrection,
  subscribeToPendingCorrections,
  type PendingCorrection,
} from "../pendingCorrections";
import { MODULE_IMPORT_DEFS, isModuleImportSlug, type ModuleImportDef, type ModuleRow } from "./moduleImportDefs";
import { getModuleImport, recordValues, saveModuleImport, seedModuleImports, type ModuleRecord } from "./moduleImportStore";
import { describeModuleIssue, renderModuleCellEditor } from "./ModuleImportReviewModal";
import { exportModuleRecords, exportModuleTemplateRecords } from "./moduleImportExport";
import { renderModuleReview } from "./renderModuleReview";
import { TEMPLATE_ONLY_MODULES } from "../templateOnlyModules";

export function ModuleImportRecordPage() {
  const { moduleSlug = "" } = useParams<{ moduleSlug: string }>();
  if (!isModuleImportSlug(moduleSlug)) return null;
  return <ModuleImportRecordPageInner def={MODULE_IMPORT_DEFS[moduleSlug]} />;
}

const ROW_COL_WIDTH = 64;

function fromReviewRow(orig: ModuleRecord, review: ModuleRow): ModuleRecord {
  return { ...review, _row: orig._row, _outcome: orig._outcome, _message: orig._message };
}

function ModuleImportRecordPageInner({ def }: { def: ModuleImportDef }) {
  const { moduleSlug = "", importId = "" } = useParams<{ moduleSlug: string; importId: string }>();
  const navigate = useNavigate();
  const moduleDef = getModuleBySlug(moduleSlug);
  const COLUMNS = def.columns;
  /** Width of the always-pinned leading block (checkbox, Row, Result). */
  const LEADING_WIDTH = SELECT_COL_WIDTH + ROW_COL_WIDTH + RESULT_COL_WIDTH;
  const toReviewRow = useCallback((r: ModuleRecord) => recordValues(def, r), [def]);

  /* A deep link straight to a seeded import after a reload still lands on a
   * populated page: lay the module's seeds down first, like its listing. */
  useState(() => {
    seedModuleImports(def.slug);
    return true;
  });

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
  const controlledColumns = useMemo(() => COLUMNS.map((c) => ({ ...c, width: c.defaultWidth })), [COLUMNS]);
  const columns = useColumnControls(controlledColumns);
  const { visibleColumns } = columns;
  const frozenLeft = columns.frozenLefts(LEADING_WIDTH);
  const hasFrozen = columns.frozenColumns.length > 0;
  const lastFrozenKey = hasFrozen ? columns.frozenColumns[columns.frozenColumns.length - 1].key : null;
  const tableMinWidth = LEADING_WIDTH + visibleColumns.reduce((acc, c) => acc + c.width, 0);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const [rowEdits, setRowEdits] = useState<Map<number, Partial<ModuleRow>>>(new Map());
  const [committedRowIds, setCommittedRowIds] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowNumber: number; field: string } | null>(null);

  type ImportPhase =
    | { kind: "idle" }
    | { kind: "running"; processed: number; total: number }
    | { kind: "complete"; importId: string; createdCount: number; updatedCount: number; skippedCount: number; warningCount: number };
  const [phase, setPhase] = useState<ImportPhase>({ kind: "idle" });

  const [pulseRowIds, setPulseRowIds] = useState<Set<number>>(new Set());
  const pulseTimerRef = useRef<number | null>(null);
  const lastCommittedRowsRef = useRef<Set<number>>(new Set());
  const pulseFixedRows = useCallback(() => {
    const ids = lastCommittedRowsRef.current;
    if (ids.size === 0) return;
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

  const [reimportOpen, setReimportOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  const [pending, setPending] = useState<PendingCorrection | null>(() => getPendingCorrection(importId));
  useEffect(() => {
    const sync = () => setPending(getPendingCorrection(importId));
    sync();
    return subscribeToPendingCorrections(sync);
  }, [importId]);

  const [refreshKey, setRefreshKey] = useState(0);

  const { found: importFound, rows: rowsForImport, header: importHeader, importerKey } = useMemo(() => {
    const stored = getModuleImport(importId);
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
        rows: [] as ModuleRecord[],
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
      rows: [] as ModuleRecord[],
      header: { name: "", description: "", fileName: "", dateISO: "", importer: getImporter(undefined) },
      importerKey: "am" as ImporterKey,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importId, moduleSlug, refreshKey]);

  useEffect(() => {
    setSelectedRows(new Set());
  }, [filter, rowsForImport]);

  useEffect(() => {
    setRowEdits(new Map());
    setCommittedRowIds(new Set());
    setEditingCell(null);
  }, [rowsForImport]);

  useEffect(() => {
    if (!editingCell) return;
    const stillVisible = rowsForImport.some((r) => r._row === editingCell.rowNumber);
    if (!stillVisible) setEditingCell(null);
  }, [rowsForImport, editingCell]);

  const effectiveReviewRows = useMemo(() => {
    return rowsForImport.map((r) => {
      const edits = rowEdits.get(r._row);
      const base = toReviewRow(r);
      return edits ? ({ ...base, ...edits } as ModuleRow) : base;
    });
  }, [rowsForImport, rowEdits, toReviewRow]);

  /* The same context the review ran with, snapshotted per import view. */
  const validationContext = useMemo(
    () => def.buildContext(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importId, def],
  );

  const validationByRow = useMemo(() => {
    const result = def.validate(effectiveReviewRows, validationContext);
    const map = new Map<number, (typeof result.rows)[number]>();
    rowsForImport.forEach((r, i) => map.set(r._row, result.rows[i]));
    return map;
  }, [rowsForImport, effectiveReviewRows, validationContext, def]);

  const displayOutcomeByRow = useMemo(() => {
    const map = new Map<number, DisplayOutcome>();
    for (const r of rowsForImport) {
      if (committedRowIds.has(r._row)) { map.set(r._row, "imported"); continue; }
      if (isImported(r._outcome)) { map.set(r._row, "imported"); continue; }
      const v = validationByRow.get(r._row);
      if (v && v.status !== "error") { map.set(r._row, "ready"); continue; }
      map.set(r._row, r._outcome === "Skipped" ? "skipped" : "failed");
    }
    return map;
  }, [rowsForImport, validationByRow, committedRowIds]);

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
      const edits = rowEdits.get(r._row);
      for (const col of COLUMNS) {
        const overlay = edits && col.key in edits ? (edits[col.key] as string | undefined) : undefined;
        const v = overlay !== undefined ? overlay : r[col.key];
        if (typeof v === "string" && v.toLowerCase().includes(q)) return true;
      }
      if (r._message && r._message.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [searchQuery, rowsForImport, filterRowIds, rowEdits, COLUMNS]);

  /* Header-menu sort. Reads the same value the cell shows (edit overlay
   * first); Row sorts numerically, Result by its displayed label. */
  const { sortRows } = columns;
  const sortedRows = useMemo(
    () =>
      sortRows(filteredRows, (r, key) => {
        if (key === "_row") return r._row;
        if (key === "_result") return displayOutcomeByRow.get(r._row) ?? "failed";
        const edits = rowEdits.get(r._row);
        if (edits && key in edits) return edits[key];
        return r[key];
      }),
    [sortRows, filteredRows, displayOutcomeByRow, rowEdits],
  );

  const totalPages = Number.isFinite(recordsPerPage) ? Math.max(1, Math.ceil(sortedRows.length / recordsPerPage)) : 1;
  const pagedRows = useMemo(() => {
    if (!Number.isFinite(recordsPerPage)) return sortedRows;
    const start = (currentPage - 1) * recordsPerPage;
    return sortedRows.slice(start, start + recordsPerPage);
  }, [sortedRows, currentPage, recordsPerPage]);

  const commitStagedRows = useCallback(() => {
    if (phase.kind !== "idle") return;
    if (readyRowCount === 0) return;

    const newlyCommitted = new Set<number>();
    const committedCreated: ModuleRow[] = [];
    const committedUpdated: ModuleRow[] = [];
    let warningCount = 0;
    const updatedRecords: ModuleRecord[] = rowsForImport.map((r) => {
      if (!isFailed(r._outcome)) return r;
      if (committedRowIds.has(r._row)) return r;
      const v = validationByRow.get(r._row);
      if (!v || v.status === "error") return r;
      newlyCommitted.add(r._row);
      if (v.status === "warning") warningCount++;
      const edits = rowEdits.get(r._row);
      const merged: ModuleRow = edits ? ({ ...toReviewRow(r), ...edits } as ModuleRow) : toReviewRow(r);
      if (v.isUpdate) committedUpdated.push(merged);
      else committedCreated.push(merged);
      return { ...fromReviewRow(r, merged), _outcome: "Created", _message: undefined };
    });
    if (newlyCommitted.size === 0) return;

    const total = newlyCommitted.size;
    setEditingCell(null);
    lastCommittedRowsRef.current = new Set(newlyCommitted);
    setCommittedRowIds((prev) => {
      const next = new Set(prev);
      for (const id of newlyCommitted) next.add(id);
      return next;
    });
    setPhase({ kind: "running", processed: 0, total });

    saveModuleImport({
      id: importId,
      moduleSlug,
      name: importHeader.name,
      description: importHeader.description,
      fileName: importHeader.fileName,
      dateISO: importHeader.dateISO,
      importerKey,
      records: updatedRecords,
    });
    const remainingFailed = updatedRecords.filter((r) => isFailed(r._outcome)).length;
    updateCompletedImportCounts(importId, {
      importedCount: updatedRecords.filter((r) => isImported(r._outcome)).length,
      failedCount: remainingFailed,
    });
    if (remainingFailed === 0) clearPendingCorrection(importId);
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
    saveModuleImport({
      id: childId,
      moduleSlug,
      name: childName,
      description: childDescription,
      fileName: childName,
      dateISO: childDateISO,
      importerKey,
      records: updatedRecords.filter((r) => newlyCommitted.has(r._row)).map((r, i) => ({ ...r, _row: i + 1 })),
    });

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
      def.applyImported(committedCreated, committedUpdated);
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
    importId, moduleSlug, importHeader, importerKey, toReviewRow, def,
  ]);

  const downloadFailedRows = useCallback((exportFormat: "csv" | "xlsx") => {
    const failedRows = rowsForImport
      .filter((r) => isFailed(r._outcome))
      .map((r) => {
        const edits = rowEdits.get(r._row);
        return edits ? fromReviewRow(r, { ...toReviewRow(r), ...edits } as ModuleRow) : r;
      });
    if (failedRows.length === 0) {
      toast.info("No rows to download for this filter.");
      return;
    }
    const messages = new Map<number, string>();
    for (const r of failedRows) {
      const v = validationByRow.get(r._row);
      const live = v ? v.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" ") : "";
      messages.set(r._row, live || r._message || "");
    }
    void exportModuleTemplateRecords({
      def,
      rows: failedRows,
      messages,
      format: exportFormat,
      importName: importHeader.name,
      suffix: DOWNLOAD_META.failed.fileSuffix,
    });
    startPendingCorrection({
      importId,
      moduleSlug,
      fileName: `${importNameToFilenameStem(importHeader.name)}_${DOWNLOAD_META.failed.fileSuffix}.${exportFormat}`,
      rowCount: failedRows.length,
      startedISO: new Date().toISOString(),
    });
  }, [rowsForImport, rowEdits, validationByRow, importHeader.name, importId, moduleSlug, def, toReviewRow]);

  const correctionContext = useMemo(
    () => ({
      parentName: importHeader.fileName || importHeader.name,
      fileName: pending?.fileName ?? null,
      rowCount: pending?.rowCount ?? counts.failed,
      onRedownload: downloadFailedRows,
    }),
    [importHeader.fileName, importHeader.name, pending, counts.failed, downloadFailedRows],
  );

  const hasFailureWorkToDo = counts.failed > 0 || readyRowCount > 0;

  const dismissCompletion = useCallback(
    (target: "history" | "records" | { kind: "detail"; filter: "imported" | "failed" }) => {
      const detailHref = phase.kind === "complete" ? `/company-settings/data-imports/${moduleSlug}/${phase.importId}` : null;
      setPhase({ kind: "idle" });
      if (target === "records" || target === "history") {
        /* Already on this import: land on its imported rows and pulse the
         * ones just fixed ("Close" in the Users page does the same). */
        pulseFixedRows();
      } else if (typeof target === "object" && target.kind === "detail" && detailHref) {
        navigate(`${detailHref}?filter=${target.filter}`);
      }
    },
    [phase, moduleSlug, navigate, pulseFixedRows],
  );

  const commitCellEdit = useCallback((rowNumber: number, field: string, nextValue: string) => {
    setRowEdits((prev) => {
      const next = new Map(prev);
      const existing = next.get(rowNumber) ?? {};
      next.set(rowNumber, { ...existing, [field]: nextValue });
      return next;
    });
  }, []);

  useEffect(() => {
    if (rowEdits.size === 0) return;
    const stored = getModuleImport(importId);
    if (!stored) return;
    let changed = false;
    const records = stored.records.map((r) => {
      const edits = rowEdits.get(r._row);
      if (!edits || !isFailed(r._outcome) || committedRowIds.has(r._row)) return r;
      const merged = fromReviewRow(r, { ...toReviewRow(r), ...edits } as ModuleRow);
      const v = validationByRow.get(r._row);
      const liveErrors = v ? v.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" ") : "";
      const next: ModuleRecord = { ...merged, _message: liveErrors || undefined };
      const same = Object.keys(next).every((k) => next[k] === r[k]);
      if (same) return r;
      changed = true;
      return next;
    });
    if (changed) saveModuleImport({ ...stored, records });
  }, [rowEdits, validationByRow, committedRowIds, importId, toReviewRow]);

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

  const listingSurface = resolveImportSurface(moduleSlug);
  const moduleListingPath = listingSurface?.tab
    ? `/company-settings/data-imports/${listingSurface.card.slug}?tab=${listingSurface.tab.slug}`
    : `/company-settings/data-imports/${moduleSlug}`;
  const importedDateText = formatImportedOnShort(importHeader.dateISO);

  const filterChips: { key: RowFilter; label: string; count: number }[] = [
    { key: "all", label: "Show All", count: counts.all },
    { key: "imported", label: "Imported", count: counts.imported },
    { key: "failed", label: "Failed", count: counts.failed },
  ];

  const applyFilter = (next: RowFilter) => {
    setFilter(next);
    setCurrentPage(1);
  };

  const wizard = TEMPLATE_ONLY_MODULES[def.slug];

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {columns.ghost}
      {/* ─── Header ─── */}
      <div className={cn("shrink-0 px-6 lg:px-8 pt-4", WIDTH_TRANSITION_CLASS)} style={{ maxWidth: containerMaxWidth }}>
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm" style={{ padding: "12px 16px" }}>
          <div className="flex items-center justify-between gap-4">
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
                style={{ backgroundColor: "#EDF4FF", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 0 0 2px rgba(10,119,255,0.10)" }}
              >
                <FileInput className="w-5 h-5" style={{ color: "#0A77FF" }} />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <h1
                    className="text-[#0F172A] truncate min-w-0"
                    style={{ fontSize: "16px", fontWeight: 700, lineHeight: "22px" }}
                    title={importHeader.fileName || importHeader.name}
                  >
                    {importHeader.fileName || importHeader.name}
                  </h1>

                  <HoverCard openDelay={120} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border cursor-pointer transition-colors hover:bg-[#EEF2F6] shrink-0"
                        style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}
                      >
                        <User className="w-3 h-3" style={{ color: "#94A3B8" }} />
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#475569" }}>{importHeader.importer.name}</span>
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

                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border shrink-0"
                    style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}
                  >
                    <Clock className="w-3 h-3" style={{ color: "#94A3B8" }} />
                    <span style={{ fontSize: "11px", fontWeight: 500, color: "#475569" }}>{importedDateText}</span>
                  </span>
                </div>

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

            <div className="flex items-center gap-2 shrink-0">
              <ExpandWidthButton isExpanded={isExpanded} onToggle={() => setIsExpanded((v) => !v)} />
              {counts.failed > 0 && (
                <DownloadDropdown
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

          {selectedRows.size > 0 ? (
            <ImportSelectionBar
              count={selectedRows.size}
              onExport={(format) => {
                const rows = rowsForImport.filter((r) => selectedRows.has(r._row));
                if (rows.length === 0) {
                  toast.info("No selected rows to export.");
                  return;
                }
                void exportModuleRecords({ def, rows, filter: "all", format, importName: importHeader.name, suffix: "selected" });
              }}
              onClear={() => setSelectedRows(new Set())}
            />
          ) : (
            <div className="shrink-0 flex items-center gap-1.5 px-4 pb-3 border-b border-[#E2E8F0] overflow-x-auto">
              {filterChips
                .filter((c) => c.key === "all" || c.count > 0)
                .map((chip) => {
                  const active = filter === chip.key;
                  const tone = chip.key === "imported" ? ROW_OUTCOME_TOKENS.Created : chip.key === "failed" ? ROW_OUTCOME_TOKENS.Failed : null;
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

          {filter === "failed" && (
            <div className="shrink-0 px-4 pt-3 pb-3 border-b border-[#E2E8F0]">
              <p className="text-[#64748B]" style={{ fontSize: "13px" }}>
                Fix rows here, or download failed records to correct in bulk and re-upload.
              </p>
            </div>
          )}

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
                        Importing {phase.total} {phase.total === 1 ? def.noun : def.nounPlural}...
                      </p>
                      <p className="text-[#64748B] tabular-nums" style={{ fontSize: "12.5px" }}>
                        Importing... {phase.processed} of {phase.total} {def.nounPlural} processed
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <DensityContext.Provider value={density}>
                <table className="w-full border-separate" style={{ minWidth: tableMinWidth, borderSpacing: 0 }}>
                  <thead className="sticky top-0 z-30 bg-white">
                    <tr className="bg-[#F1F5F9]/30">
                      <Th sticky style={{ width: SELECT_COL_WIDTH, minWidth: SELECT_COL_WIDTH, left: 0, paddingLeft: 12, paddingRight: 0, textAlign: "center" }}>
                        <span className="flex items-center justify-center">
                          <Checkbox
                            aria-label="Select all rows on page"
                            className="data-[state=checked]:bg-[#0A77FF] data-[state=checked]:border-[#0A77FF] data-[state=checked]:text-white data-[state=indeterminate]:bg-[#0A77FF] data-[state=indeterminate]:border-[#0A77FF] data-[state=indeterminate]:text-white"
                            checked={
                              pagedRows.length > 0 && pagedRows.every((r) => selectedRows.has(r._row))
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
                          <p className="text-[#94A3B8]" style={{ fontSize: "13px" }}>No Rows Match This Filter.</p>
                        </td>
                      </tr>
                    ) : (
                      pagedRows.flatMap((r) => {
                        const displayOutcome = displayOutcomeByRow.get(r._row) ?? "failed";
                        const tok = displayOutcome === "imported" || displayOutcome === "ready" ? ROW_OUTCOME_TOKENS.Created : ROW_OUTCOME_TOKENS.Failed;
                        const resultLabel =
                          displayOutcome === "imported" ? "Imported"
                          : displayOutcome === "ready" ? "Ready"
                          : displayOutcome === "skipped" ? "Error"
                          : "Failed";
                        const stillErrored = displayOutcome === "failed" || displayOutcome === "skipped";
                        const messageColor = stillErrored ? "#DC2626" : "#0F172A";
                        const liveErrorMessage = stillErrored
                          ? (validationByRow.get(r._row)?.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" ") || r._message || "")
                          : "";
                        const hasSubRow = stillErrored && !!liveErrorMessage;
                        const dataRowBorder = hasSubRow ? "transparent" : "#E2E8F0";
                        const accentBar = stillErrored ? "2px solid #EF4444" : undefined;
                        const isSelected = selectedRows.has(r._row);
                        const rowTint = isSelected ? "#EFF6FF" : stillErrored ? "#FFFBFB" : undefined;
                        const rowIssues = validationByRow.get(r._row);
                        const isEditable = isFailed(r._outcome) && !committedRowIds.has(r._row);
                        const rowEditOverlay = rowEdits.get(r._row);
                        const isPulsing = pulseRowIds.has(r._row);

                        const dataRow = (
                          <tr key={r._row} className={cn("import-row-hover", isPulsing && "import-fixed-row-pulse")}>
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
                              style={{ width: ROW_COL_WIDTH, minWidth: ROW_COL_WIDTH, left: SELECT_COL_WIDTH, paddingLeft: 16, borderBottomColor: dataRowBorder, backgroundColor: rowTint }}
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
                              const isFrozenCol = columns.frozen.has(col.key);
                              const overlay = rowEditOverlay && col.key in rowEditOverlay ? (rowEditOverlay[col.key] as string | undefined) : undefined;
                              const val = String(overlay !== undefined ? overlay : r[col.key] ?? "");
                              const cellIssues = rowIssues?.byField[col.key] as unknown as CellIssue[] | undefined;
                              const severity: "error" | "warning" | null =
                                cellIssues?.some((i) => i.severity === "error") ? "error"
                                : cellIssues?.some((i) => i.severity === "warning") ? "warning"
                                : null;
                              const cellBg = severity ? CELL_SEVERITY_BG[severity] : rowTint;
                              const cellShadow = severity ? CELL_SEVERITY_SHADOW[severity] : undefined;
                              const hasIssueTooltip = !!severity && !!cellIssues && cellIssues.length > 0;
                              const isThisEditing = isEditable && editingCell?.rowNumber === r._row && editingCell.field === col.key;
                              const editingBg = isThisEditing ? "#FFFFFF" : cellBg;
                              const editingShadow = isThisEditing
                                ? "inset 0 0 0 2px #0A77FF, inset 0 0 0 3px rgba(10,119,255,0.15)"
                                : cellShadow;
                              const onClick = isEditable && !isThisEditing
                                ? () => setEditingCell({ rowNumber: r._row, field: col.key })
                                : undefined;
                              return (
                                <Td
                                  key={col.key}
                                  sticky={isFrozenCol}
                                  tinted={!!severity || isThisEditing}
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
                                    cursor: isThisEditing ? "text" : onClick ? "cell" : undefined,
                                  }}
                                  title={isThisEditing || hasIssueTooltip ? undefined : (val || undefined)}
                                  onClick={onClick}
                                >
                                  {isThisEditing ? (
                                    renderModuleCellEditor(def, col, { ...toReviewRow(r), ...(rowEdits.get(r._row) ?? {}) } as ModuleRow)({
                                      initialValue: val,
                                      onCommit: (next) => {
                                        commitCellEdit(r._row, col.key, next);
                                        setEditingCell(null);
                                      },
                                      onCancel: () => setEditingCell(null),
                                    })
                                  ) : hasIssueTooltip && cellIssues ? (
                                    <CellIssueTooltip issues={cellIssues} describe={describeModuleIssue}>
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
                                style={{ height: density === "comfort" ? 30 : 24, paddingLeft: 16, paddingRight: 16 }}
                              >
                                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor }} />
                                <span className="whitespace-nowrap" style={{ fontSize: "12.5px", fontWeight: 400, color: messageColor }}>
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

      {phase.kind === "complete" && (
        <ImportCompleteDialog
          createdCount={phase.createdCount}
          updatedCount={phase.updatedCount}
          skippedCount={phase.skippedCount}
          warningCount={phase.warningCount}
          entityLabel={def.entities}
          primaryLabel={`View Imported ${def.entities}`}
          historyLabel="Close"
          onViewHistory={() => dismissCompletion("history")}
          onGoToUsers={() => dismissCompletion("records")}
          onViewDetail={(f) => dismissCompletion({ kind: "detail", filter: f })}
        />
      )}

      {/* Re-import wizard: the same Import modal the module page opens, with
        * correction framing and this import's id (layer 2 of detection). */}
      <ImportWizardModal
        open={reimportOpen}
        onClose={() => { setReimportOpen(false); setDroppedFile(null); }}
        onImportCompleted={() => setRefreshKey((k) => k + 1)}
        recordTypeLabel={def.entities}
        moduleSlug={moduleSlug}
        descriptionPlacement="bottom"
        parentImportId={importId}
        correction={correctionContext}
        initialFile={droppedFile}
        title="Re-import Fixed Records"
        description="Fixed the errors in your downloaded file? Upload it here to re-import, no need to start over."
        template={wizard.templateConfig}
        parseFile={wizard.parseFile}
        descriptionPlaceholder={wizard.descriptionPlaceholder}
        renderReview={renderModuleReview(def, moduleSlug)}
      />
    </div>
  );
}
