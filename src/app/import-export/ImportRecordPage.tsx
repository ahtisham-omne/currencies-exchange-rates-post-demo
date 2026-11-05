/* Import record page (port of UAC ImportRecordDetailPage): rows with
 * outcomes, ?filter=imported|failed deep links, inline fixes on failed rows
 * (auto-saved), "Import N Correct Rows", downloads, and the corrected-file
 * loop (CorrectionStrip -> wizard with parentImportId). */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { AnimatePresence } from "motion/react";
import { ChevronDown, ChevronLeft, CircleX, Clock, FileInput, FileSpreadsheet, FileText, Info, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import type { ImportRow } from "./spec";
import { ImportSelectionBar } from "./SelectionBar";
import { validateRows, type CellIssue } from "./validation";
import {
  addFixChildImport,
  clearPendingCorrection,
  CURRENT_IMPORTER_KEY,
  DOWNLOAD_META,
  ensureSeededForLoad,
  fixChildId,
  getCompletedImportById,
  getImporter,
  getPendingCorrection,
  importNameToFilenameStem,
  importRecordColumns,
  isFailed,
  isImported,
  loadImportDetail,
  recordToRow,
  saveImportDetail,
  startPendingCorrection,
  subscribeToPendingCorrections,
  toImportedRecord,
  updateCompletedImportCounts,
  type ImportedRecord,
  type PendingCorrection,
  type RowFilter,
} from "./importHistory";
import { exportImportRecords, exportTemplateRecords } from "./recordExport";
import { CELL_SEVERITY_STYLE, CellInput, CellIssueTooltip, ImportCompleteDialog, ImportingOverlay } from "./reviewParts";
import { ImportWizardModal, type CorrectionSetupContext } from "./ImportWizardModal";
import { useImportHostBindings, useRouteImportSpec } from "./hostBindings";
import { PinToViewport, TableEmptyState, TableSkeletonRows, resolveTableEmptyKind, useTableLoadState } from "../components/ui/table-empty-state";
import { findSearchSuggestion } from "../utils/searchSuggestion";
import { CELL_FONT, DensityDropdown, HighlightMatch, ImporterHoverName, MENU_SHADOW, Pagination, SearchBox, TriCheckbox, type Density } from "./ui";

const SELECT_COL_WIDTH = 44;
const ROW_COL_WIDTH = 64;
const RESULT_COL_WIDTH = 90;
const ROW_OUTCOME_TOKENS = {
  Created: { bg: "#ECFDF5", text: "#065F46", border: "#D1FAE5" },
  Failed: { bg: "#FEF2F2", text: "#991B1B", border: "#FEE2E2" },
};
type DisplayOutcome = "imported" | "ready" | "skipped" | "failed";
type Phase = { kind: "idle" } | { kind: "running"; processed: number; total: number } | { kind: "complete"; createdCount: number; updatedCount: number; warningCount: number };

const PULSE_CSS = `
@keyframes import-fixed-row-pulse { 0%, 100% { outline-color: rgba(34,197,94,0); box-shadow: inset 0 0 0 0 rgba(34,197,94,0); } 50% { outline-color: #22C55E; box-shadow: inset 0 0 0 2px #22C55E; } }
.import-fixed-row-pulse { outline: 2px solid transparent; outline-offset: -2px; animation: import-fixed-row-pulse 500ms ease-in-out 3; }
@media (prefers-reduced-motion: reduce) { .import-fixed-row-pulse { animation: none; outline-color: #22C55E; } }
`;

export function ImportRecordPage() {
  const spec = useRouteImportSpec();
  const navigate = useNavigate();
  const { importId = "" } = useParams<{ importId: string }>();
  const [searchParams] = useSearchParams();
  const host = useImportHostBindings(spec);

  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    ensureSeededForLoad(spec);
    return subscribeToPendingCorrections(spec, () => setRefreshKey((k) => k + 1));
  }, [spec]);
  const detail = useMemo(() => loadImportDetail(spec, importId), [spec, importId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const entry = useMemo(() => getCompletedImportById(spec, importId), [spec, importId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending: PendingCorrection | null = useMemo(() => getPendingCorrection(spec, importId), [spec, importId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [filter, setFilter] = useState<RowFilter>(() => {
    const f = searchParams.get("filter");
    return f === "imported" || f === "failed" ? f : "all";
  });
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState<Density>("comfort");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rowEdits, setRowEdits] = useState<Map<number, Partial<ImportRow>>>(new Map());
  const [committedRows, setCommittedRows] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [pulseRows, setPulseRows] = useState<Set<number>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const lastFixedRef = useRef<number[]>([]);

  useEffect(() => {
    setSelected(new Set());
    setPage(1);
  }, [filter, importId]);

  const records: ImportedRecord[] = useMemo(() => detail?.records ?? [], [detail]);
  const columns = useMemo(() => importRecordColumns(spec), [spec]);
  const validationContext = useMemo(() => host.makeValidationContext(), [host.makeValidationContext]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveRows = useMemo(() => records.map((rec) => ({ ...recordToRow(spec, rec), ...(rowEdits.get(rec._row) ?? {}) })), [records, rowEdits, spec]);
  const validation = useMemo(() => validateRows(spec, effectiveRows, validationContext), [spec, effectiveRows, validationContext]);
  const validationByRow = useMemo(() => {
    const m = new Map<number, (typeof validation.rows)[number]>();
    records.forEach((rec, i) => m.set(rec._row, validation.rows[i]));
    return m;
  }, [records, validation]);

  const displayOutcome = useCallback(
    (rec: ImportedRecord): DisplayOutcome => {
      if (isImported(rec._outcome) || committedRows.has(rec._row)) return "imported";
      const v = validationByRow.get(rec._row);
      if (v && v.status !== "error") return "ready";
      return rec._outcome === "Skipped" ? "skipped" : "failed";
    },
    [committedRows, validationByRow],
  );
  const counts = useMemo(() => {
    let imported = 0;
    let failed = 0;
    for (const r of records) {
      const d = displayOutcome(r);
      if (d === "imported") imported++;
      else if (d === "failed" || d === "skipped") failed++;
    }
    return { total: records.length, imported, failed };
  }, [records, displayOutcome]);
  const readyRowCount = records.filter((r) => isFailed(r._outcome) && !committedRows.has(r._row) && validationByRow.get(r._row)?.status !== "error").length;

  /* Filter membership is frozen per import + filter so fixed rows stay visible in the Failed view. */
  const frozenRef = useRef<{ key: string; rows: Set<number> | null }>({ key: "", rows: null });
  const frozenKey = `${importId}|${filter}`;
  if (frozenRef.current.key !== frozenKey) {
    frozenRef.current = { key: frozenKey, rows: filter === "all" ? null : new Set(records.filter((r) => (filter === "imported" ? isImported(r._outcome) || committedRows.has(r._row) : isFailed(r._outcome) && !committedRows.has(r._row))).map((r) => r._row)) };
  }
  const q = search.trim().toLowerCase();
  const visibleRows = useMemo(() => {
    const frozen = frozenRef.current.rows;
    return records.filter((r) => {
      if (frozen && !frozen.has(r._row)) return false;
      if (!q) return true;
      const row = effectiveRows[records.indexOf(r)];
      return spec.columns.some((c) => String(row?.[c.key] ?? "").toLowerCase().includes(q)) || (r._message ?? "").toLowerCase().includes(q);
    });
  }, [records, effectiveRows, q, spec.columns, frozenKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalPages = Number.isFinite(perPage) ? Math.max(1, Math.ceil(visibleRows.length / perPage)) : 1;
  const pageSafe = Math.min(page, totalPages);
  const paged = Number.isFinite(perPage) ? visibleRows.slice((pageSafe - 1) * perPage, pageSafe * perPage) : visibleRows;

  /* Global empty / error states */
  const tableLoad = useTableLoadState();
  const filterLayerCount = filter !== "all" ? 1 : 0;
  const emptyKind = resolveTableEmptyKind({
    loadState: tableLoad.loadState,
    totalCount: tableLoad.forceEmpty ? 0 : records.length,
    filteredCount: tableLoad.forceEmpty ? 0 : visibleRows.length,
    pageCount: paged.length,
    searchQuery: search,
    filterCount: filterLayerCount,
  });
  const searchSuggestion = useMemo(() => {
    if (emptyKind !== "no-results" && emptyKind !== "no-results-filtered") return null;
    return findSearchSuggestion(
      search,
      records.flatMap((r, i) => [...spec.columns.map((c) => String(effectiveRows[i]?.[c.key] ?? "")), r._message]),
    );
  }, [emptyKind, search, records, effectiveRows, spec.columns]);

  useEffect(() => {
    if (editingCell && !paged.some((r) => r._row === editingCell.row)) setEditingCell(null);
  }, [editingCell, paged]);

  /* ─── inline edit (auto-saved) ─── */
  const commitCellEdit = (row: number, field: string, value: string) => {
    if (!detail) return;
    const nextEdits = new Map(rowEdits);
    nextEdits.set(row, { ...(nextEdits.get(row) ?? {}), [field]: value });
    setRowEdits(nextEdits);
    const idx = records.findIndex((r) => r._row === row);
    if (idx === -1) return;
    const merged = { ...recordToRow(spec, records[idx]), ...nextEdits.get(row) };
    const rows = records.map((rec, i) => (i === idx ? merged : effectiveRows[i]));
    const v = validateRows(spec, rows, validationContext).rows[idx];
    const errors = v.issues.filter((i) => i.severity === "error").map((i) => i.message);
    const updated = records.map((rec, i) => {
      if (i !== idx) return rec;
      const next: ImportedRecord = { ...rec };
      for (const c of spec.columns) next[c.key] = merged[c.key] ?? "";
      if (errors.length) next._message = errors.join(" ");
      else delete next._message;
      return next;
    });
    saveImportDetail(spec, { ...detail, records: updated });
    setRefreshKey((k) => k + 1);
  };

  /* ─── commit staged rows ("Import N Correct Rows") ─── */
  const commitStagedRows = () => {
    if (!detail || phase.kind !== "idle") return;
    const staged = records.filter((r) => isFailed(r._outcome) && !committedRows.has(r._row) && validationByRow.get(r._row)?.status !== "error");
    if (staged.length === 0) return;
    const stagedRows = new Set(staged.map((r) => r._row));
    const stagedValues = staged.map((r) => effectiveRows[records.indexOf(r)]);
    const nextRecords = records.map((rec) => {
      if (!stagedRows.has(rec._row)) return rec;
      const next: ImportedRecord = { ...rec, _outcome: "Created" };
      delete next._message;
      return next;
    });
    saveImportDetail(spec, { ...detail, records: nextRecords });
    const importedCount = nextRecords.filter((r) => isImported(r._outcome)).length;
    const failedCount = nextRecords.length - importedCount;
    updateCompletedImportCounts(spec, importId, { importedCount, failedCount });
    if (failedCount === 0) clearPendingCorrection(spec, importId);
    const now = new Date().toISOString();
    const childId = fixChildId(importId);
    const childName = `${detail.fileName || detail.name} (corrected)`;
    addFixChildImport(spec, {
      id: childId,
      parentId: importId,
      moduleSlug: spec.moduleSlug,
      name: childName,
      fileName: childName,
      description: `Fixed ${staged.length} failed row${staged.length === 1 ? "" : "s"}`,
      dateISO: now,
      importerKey: CURRENT_IMPORTER_KEY,
      recordCount: staged.length,
      importedCount: staged.length,
      failedCount: 0,
      correctionKind: "inline",
    });
    saveImportDetail(spec, { id: childId, moduleSlug: spec.moduleSlug, name: childName, description: `Fixed ${staged.length} failed row${staged.length === 1 ? "" : "s"}`, dateISO: now, importerKey: CURRENT_IMPORTER_KEY, fileName: childName, records: stagedValues.map((v, i) => toImportedRecord(spec, v, i + 1, "Created")) });
    const total = staged.length;
    setPhase({ kind: "running", processed: 0, total });
    const startedAt = performance.now();
    const tick = (nowMs: number) => {
      const ratio = Math.min(1, (nowMs - startedAt) / 2400);
      setPhase((cur) => (cur.kind === "running" ? { ...cur, processed: Math.min(total, Math.floor(ratio * total)) } : cur));
      if (ratio < 1) {
        requestAnimationFrame(tick);
        return;
      }
      const result = host.applyRows(stagedValues);
      const warningCount = staged.filter((r) => validationByRow.get(r._row)?.status === "warning").length;
      setCommittedRows((prev) => new Set([...prev, ...stagedRows]));
      lastFixedRef.current = Array.from(stagedRows);
      setRefreshKey((k) => k + 1);
      setPhase({ kind: "complete", createdCount: result.created, updatedCount: result.updated, warningCount });
    };
    requestAnimationFrame(tick);
  };
  const pulseFixedRows = () => {
    setPhase({ kind: "idle" });
    setFilter("imported");
    setPage(1);
    const rows = new Set(lastFixedRef.current);
    setPulseRows(rows);
    window.setTimeout(() => setPulseRows(new Set()), 1500);
  };

  /* ─── downloads ─── */
  const liveMessage = (rec: ImportedRecord) => {
    const v = validationByRow.get(rec._row);
    const errs = v?.issues.filter((i) => i.severity === "error").map((i) => i.message) ?? [];
    return errs.length ? errs.join(" ") : (rec._message ?? "");
  };
  const downloadFailedRows = async (fmt: "xlsx" | "csv") => {
    if (!detail) return;
    const failed = records.filter((r) => isFailed(r._outcome) && !committedRows.has(r._row));
    if (failed.length === 0) {
      toast.info("No rows to download for this filter.");
      return;
    }
    const rows = failed.map((r) => toImportedRecord(spec, effectiveRows[records.indexOf(r)], r._row, r._outcome, r._message));
    const filename = await exportTemplateRecords({ spec, rows, messages: failed.map(liveMessage), format: fmt, importName: detail.name, suffix: "failed" });
    startPendingCorrection(spec, { importId, moduleSlug: spec.moduleSlug, fileName: filename, rowCount: failed.length, startedISO: new Date().toISOString() });
    setRefreshKey((k) => k + 1);
    toast.success(`Downloaded ${filename}`);
  };
  const downloadSelected = async (fmt: "xlsx" | "csv") => {
    if (!detail) return;
    const rows = records.filter((r) => selected.has(r._row)).map((r) => ({ ...r, ...effectiveRows[records.indexOf(r)] }));
    if (rows.length === 0) {
      toast.info("No selected rows to export.");
      return;
    }
    const filename = await exportImportRecords({ spec, rows, filter: "all", format: fmt, importName: detail.name, suffix: "selected" });
    toast.success(`Downloaded ${filename}`);
  };

  const correctionContext: CorrectionSetupContext | null = detail ? { parentName: detail.fileName || detail.name, fileName: pending?.fileName ?? null, rowCount: pending?.rowCount ?? counts.failed, onRedownload: downloadFailedRows } : null;
  const openCorrectionWizard = (file?: File) => {
    setDroppedFile(file ?? null);
    setWizardOpen(true);
  };

  if (!detail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-[#F8FAFC]">
        <span style={{ fontSize: "14px", color: "#64748B" }}>Import not found.</span>
        <button type="button" onClick={() => navigate(spec.routes.history)} className="text-primary hover:underline cursor-pointer" style={{ fontSize: "13px", fontWeight: 500 }}>
          Back to Imports
        </button>
      </div>
    );
  }

  const importer = getImporter(detail.importerKey);
  const rowH = density === "comfort" ? 52 : 36;
  const running = phase.kind === "running";
  const thH = density === "comfort" ? "h-11" : "h-9";
  const chip = (id: RowFilter, label: string, count: number, tone: "blue" | "Created" | "Failed") => {
    const active = filter === id;
    const t = tone === "blue" ? null : ROW_OUTCOME_TOKENS[tone];
    return (
      <button
        key={id}
        type="button"
        onClick={() => { setFilter(id); setPage(1); }}
        aria-pressed={active}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${!active ? "border-border bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-foreground hover:border-[#CBD5E1]" : t ? "" : "border-primary bg-[#EDF4FF] text-primary"}`}
        style={{ fontSize: "12px", fontWeight: active ? 500 : 400, ...(active && t ? { backgroundColor: t.bg, color: t.text, borderColor: t.border } : {}) }}
      >
        {label}
        <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full tabular-nums ${!active ? "bg-muted text-[#475569]" : t ? "" : "bg-primary/10 text-primary"}`} style={{ fontSize: "10px", fontWeight: 600, ...(active && t ? { backgroundColor: "rgba(255,255,255,0.6)", color: t.text } : {}) }}>
          {count}
        </span>
      </button>
    );
  };
  const allPagedSelected = paged.length > 0 && paged.every((r) => selected.has(r._row));
  const somePagedSelected = paged.some((r) => selected.has(r._row));
  const minWidth = SELECT_COL_WIDTH + ROW_COL_WIDTH + RESULT_COL_WIDTH + columns.reduce((s, c) => s + c.width, 0);

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-[#F8FAFC]">
      <style>{PULSE_CSS}</style>
      <div data-page-topbar className="flex items-center justify-between px-3 h-12 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <button onClick={() => navigate("/partners")} className="hover:text-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
            Partners Management
          </button>
          <span>/</span>
          <button onClick={() => navigate(spec.routes.listing)} className="hover:text-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
            {spec.entity}
          </button>
          <span>/</span>
          <button onClick={() => navigate(spec.routes.history)} className="hover:text-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
            Imports
          </button>
          <span>/</span>
          <span style={{ fontWeight: 500 }} className="text-foreground">
            Import Details
          </span>
        </div>
      </div>
      {/* Header card, exactly the UAC record page header: back, icon tile,
        * file name + importer / date chips, description line; the right side
        * carries only the failed-rows Download menu (when there are failed
        * rows) and the Import Correct Rows button. No summary tiles. */}
      <div className="shrink-0 px-6 lg:px-8 pt-4">
        <div data-page-topbar className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm" style={{ padding: "12px 16px" }}>
          <div data-page-heading className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => navigate(spec.routes.history)}
                aria-label="Back to imports"
                className="w-11 h-11 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-400" />
              </button>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white" style={{ backgroundColor: "#EDF4FF", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 0 0 2px rgba(10,119,255,0.10)" }}>
                <FileInput className="w-5 h-5" style={{ color: "#0A77FF" }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <h1 className="text-[#0F172A] truncate min-w-0" style={{ fontSize: "16px", fontWeight: 700, lineHeight: "22px" }} title={detail.fileName || detail.name}>
                    {detail.fileName || detail.name}
                  </h1>
                  <ImporterHoverName importer={importer} variant="chip" />
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border shrink-0" style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}>
                    <Clock className="w-3 h-3" style={{ color: "#94A3B8" }} />
                    <span style={{ fontSize: "11px", fontWeight: 500, color: "#475569" }}>{format(new Date(detail.dateISO), "MMM dd, yyyy")}</span>
                  </span>
                </div>
                <p className="mt-1 truncate" style={{ fontSize: "12.5px", lineHeight: "1.6" }} title={detail.description || undefined}>
                  {detail.description ? (
                    <>
                      <span style={{ color: "#475569", fontWeight: 600 }}>Description: </span>
                      <span style={{ color: "#64748B", fontWeight: 400 }}>{detail.description}</span>
                    </>
                  ) : (
                    <span className="italic" style={{ color: "#94A3B8", fontWeight: 400 }}>
                      No description added
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {counts.failed > 0 && <FailedRowsDownloadDropdown onPick={(fmt) => void downloadFailedRows(fmt)} onUpload={() => openCorrectionWizard()} />}
              {(counts.failed > 0 || readyRowCount > 0) && <ImportCorrectedRowsButton readyCount={readyRowCount} errorCount={counts.failed} running={running} onClick={commitStagedRows} />}
            </div>
          </div>
          {pending && (
            <div style={{ marginTop: 12 }}>
              <CorrectionStrip pending={pending} onOpenUpload={() => openCorrectionWizard()} onDropFile={(f) => openCorrectionWizard(f)} onRedownload={downloadFailedRows} onDismiss={() => clearPendingCorrection(spec, importId)} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 px-6 lg:px-8 py-4 flex flex-col">
        <div className="flex-1 min-h-0 bg-white border border-border rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
          <div className="shrink-0 px-4 pt-3.5 pb-2 flex items-center justify-between gap-2">
            <SearchBox
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search records..."
            />
            <DensityDropdown density={density} onChange={setDensity} />
          </div>
          {selected.size > 0 ? (
            <div className="shrink-0 [&>div]:h-[52px]">
              <ImportSelectionBar
                count={selected.size}
                noun="row"
                onExport={(format) => void (format === "csv" ? downloadSelected("csv") : downloadSelected("xlsx"))}
                onClear={() => setSelected(new Set())}
              />
            </div>
          ) : (
            <div className="shrink-0 px-4 pb-3 border-b border-border flex items-center gap-1.5 overflow-x-auto">
              {chip("all", "Show All", counts.total, "blue")}
              {counts.imported > 0 && chip("imported", "Imported", counts.imported, "Created")}
              {counts.failed > 0 && chip("failed", "Failed", counts.failed, "Failed")}
            </div>
          )}
          {filter === "failed" && (
            <div className="shrink-0 px-4 pt-3 pb-3 border-b border-border" style={{ fontSize: "13px", color: "#64748B" }}>
              Fix rows here, or download failed records to correct in bulk and re-upload.
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-auto relative">
            <AnimatePresence>{running && <ImportingOverlay spec={spec} processed={phase.processed} total={phase.total} z={40} bg="bg-white/60" />}</AnimatePresence>
            <table className="w-full border-separate" style={{ minWidth, borderSpacing: 0 }}>
              <thead className="sticky top-0 z-30 bg-white">
                <tr className="bg-[#F1F5F9]/30">
                  <th className={`text-left align-middle whitespace-nowrap border-b border-border ${thH}`} style={{ width: SELECT_COL_WIDTH, paddingLeft: 12, paddingRight: 0, textAlign: "center" }}>
                    <TriCheckbox aria-label="Select all rows on page" checked={allPagedSelected ? true : somePagedSelected ? "indeterminate" : false} onCheckedChange={() => setSelected((prev) => { const next = new Set(prev); if (allPagedSelected) paged.forEach((r) => next.delete(r._row)); else paged.forEach((r) => next.add(r._row)); return next; })} />
                  </th>
                  <th className={`text-left align-middle whitespace-nowrap border-b border-border ${thH}`} style={{ width: ROW_COL_WIDTH, paddingLeft: 16, fontSize: "13px", fontWeight: 400, color: "#475569" }}>
                    Row
                  </th>
                  <th className={`text-left align-middle px-3 whitespace-nowrap border-b border-border ${thH}`} style={{ width: RESULT_COL_WIDTH, fontSize: "13px", fontWeight: 400, color: "#475569" }}>
                    Result
                  </th>
                  {columns.map((c) => (
                    <th key={c.key} className={`text-left align-middle px-3 whitespace-nowrap border-b border-border ${thH}`} style={{ width: c.width, fontSize: "13px", fontWeight: 400, color: "#475569", lineHeight: "1.2" }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableLoad.loadState === "loading" ? (
                  <TableSkeletonRows columns={columns.length + 3} />
                ) : emptyKind ? (
                  <tr>
                    <td colSpan={columns.length + 3} className="p-0">
                      <PinToViewport>
                        <TableEmptyState
                          kind={emptyKind}
                          entity={{ singular: "record", plural: "records" }}
                          searchQuery={search}
                          suggestion={searchSuggestion}
                          onApplySuggestion={(v) => { setSearch(v); setPage(1); }}
                          filterCount={filterLayerCount}
                          onClearSearch={() => { setSearch(""); setPage(1); }}
                          onClearFilters={() => { setFilter("all"); setPage(1); }}
                          onClearAll={() => { setSearch(""); setFilter("all"); setPage(1); }}
                          onRetry={tableLoad.retry}
                          retrying={tableLoad.retrying}
                          onFirstPage={() => setPage(1)}
                          title={filterLayerCount ? `No ${filter} records` : undefined}
                          description={filterLayerCount ? "No rows in this import have that result." : "This import has no records."}
                        />
                      </PinToViewport>
                    </td>
                  </tr>
                ) : (
                  paged.map((rec) => {
                    const idx = records.indexOf(rec);
                    const row = effectiveRows[idx];
                    const v = validationByRow.get(rec._row);
                    const outcome = displayOutcome(rec);
                    const editable = isFailed(rec._outcome) && !committedRows.has(rec._row);
                    const errored = outcome === "failed" || outcome === "skipped";
                    const errMsg = errored ? liveMessage(rec) : "";
                    const isSel = selected.has(rec._row);
                    const rowTint = isSel ? "#EFF6FF" : errored ? "#FFFBFB" : "#FFFFFF";
                    const tok = outcome === "imported" || outcome === "ready" ? ROW_OUTCOME_TOKENS.Created : ROW_OUTCOME_TOKENS.Failed;
                    const label = outcome === "imported" ? "Imported" : outcome === "ready" ? "Ready" : outcome === "skipped" ? "Error" : "Failed";
                    const hasSub = errored && !!errMsg;
                    const tdBase = "px-3 align-middle whitespace-nowrap truncate text-[#334155] border-b border-border";
                    const tdStyle: React.CSSProperties = { height: rowH, fontSize: "14px", backgroundColor: rowTint, borderBottomColor: hasSub ? "transparent" : undefined };
                    return (
                      <FragmentRows key={rec._row}>
                        <tr className={pulseRows.has(rec._row) ? "import-fixed-row-pulse" : undefined}>
                          <td className={tdBase} style={{ ...tdStyle, paddingLeft: 12, paddingRight: 0, textAlign: "center", borderLeft: errored ? "2px solid #EF4444" : undefined }}>
                            <TriCheckbox aria-label={`Select row ${rec._row}`} checked={isSel} onCheckedChange={(c) => setSelected((prev) => { const next = new Set(prev); if (c === true) next.add(rec._row); else next.delete(rec._row); return next; })} />
                          </td>
                          <td className={`${tdBase} tabular-nums text-[#64748B]`} style={{ ...tdStyle, paddingLeft: 16 }}>
                            {rec._row}
                          </td>
                          <td className={tdBase} style={tdStyle}>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full border whitespace-nowrap" style={{ backgroundColor: tok.bg, color: tok.text, borderColor: tok.border, fontSize: "11px", fontWeight: 600 }}>
                              {label}
                            </span>
                          </td>
                          {columns.map((c) => {
                            const col = spec.columns.find((x) => x.key === c.key)!;
                            const val = String(row?.[c.key] ?? "");
                            const issues: CellIssue[] = v?.byField[c.key] ?? [];
                            const sev = issues.some((i) => i.severity === "error") ? "error" : issues.length ? "warning" : null;
                            const isEditing = editingCell?.row === rec._row && editingCell.field === c.key;
                            const bg = isEditing ? CELL_SEVERITY_STYLE.editing.bg : sev === "error" ? CELL_SEVERITY_STYLE.error.bg : sev === "warning" ? CELL_SEVERITY_STYLE.warning.bg : rowTint;
                            const shadow = isEditing ? CELL_SEVERITY_STYLE.editing.shadow : sev === "error" ? CELL_SEVERITY_STYLE.error.shadow : sev === "warning" ? CELL_SEVERITY_STYLE.warning.shadow : undefined;
                            const content = val ? <HighlightMatch text={val} query={search} /> : <span className="text-[#CBD5E1]">-</span>;
                            return (
                              <td
                                key={c.key}
                                className={`${tdBase} ${c.mono ? "font-mono" : ""}`}
                                style={{ ...tdStyle, backgroundColor: bg, boxShadow: shadow, cursor: isEditing ? "text" : editable ? "cell" : undefined, paddingLeft: isEditing ? 0 : undefined, paddingRight: isEditing ? 0 : undefined, fontFamily: isEditing ? CELL_FONT : undefined }}
                                title={issues.length ? undefined : val}
                                onClick={() => editable && !isEditing && !running && setEditingCell({ row: rec._row, field: c.key })}
                              >
                                {isEditing ? (
                                  <CellInput
                                    column={col}
                                    value={val}
                                    referenceOptions={host.referenceOptions}
                                    onCommit={(next) => {
                                      commitCellEdit(rec._row, c.key, next);
                                      setEditingCell(null);
                                    }}
                                    onCancel={() => setEditingCell(null)}
                                  />
                                ) : issues.length > 0 ? (
                                  <CellIssueTooltip issues={issues}>{content}</CellIssueTooltip>
                                ) : (
                                  content
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        {hasSub && (
                          <tr aria-label={`${rec._outcome} reason for row ${rec._row}`}>
                            <td colSpan={columns.length + 3} style={{ padding: 0, backgroundColor: rowTint, borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0", borderLeft: "2px solid #EF4444" }}>
                              <div className="inline-flex items-center gap-2" style={{ height: density === "comfort" ? 30 : 24, paddingLeft: 16, paddingRight: 16 }}>
                                <CircleX className="w-3.5 h-3.5 shrink-0" style={{ color: "#EF4444" }} />
                                <span className="whitespace-nowrap" style={{ fontSize: "12.5px", fontWeight: 400, color: "#DC2626" }}>
                                  <HighlightMatch text={errMsg} query={search} />
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </FragmentRows>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={pageSafe}
            totalPages={totalPages}
            onPageChange={setPage}
            recordsPerPage={perPage}
            onRecordsPerPageChange={(n) => {
              setPerPage(n);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
            allowAll
          />
        </div>
      </div>

      <AnimatePresence>
        {phase.kind === "complete" && (
          <ImportCompleteDialog
            key="complete"
            spec={spec}
            createdCount={phase.createdCount}
            updatedCount={phase.updatedCount}
            skippedCount={0}
            warningCount={phase.warningCount}
            onViewDetail={() => pulseFixedRows()}
            onGoToListing={() => {
              setPhase({ kind: "idle" });
              navigate(spec.routes.listing, { replace: true });
            }}
            onViewHistory={() => pulseFixedRows()}
            historyLabel="Close"
          />
        )}
      </AnimatePresence>

      <ImportWizardModal
        spec={spec}
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setDroppedFile(null);
        }}
        parentImportId={importId}
        correction={correctionContext}
        initialFile={droppedFile}
        title={`Re-import Fixed ${spec.entity}`}
        description="Fixed the errors in your downloaded file? Upload it here to re-import, no need to start over."
        validationContext={validationContext}
        referenceOptions={host.referenceOptions}
        onApplied={(o) => {
          host.onApplied(o);
        }}
        onImportCompleted={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* Header failed-rows menu, UAC's DownloadDropdown: info note, Excel / CSV of
 * the error rows, then Upload Corrected File. Rendered only when rows failed. */
function FailedRowsDownloadDropdown({ onPick, onUpload }: { onPick: (fmt: "xlsx" | "csv") => void; onUpload: () => void }) {
  const item = "flex items-center gap-2.5 py-2 px-3 rounded-md cursor-pointer data-[highlighted]:bg-[#F1F5F9]";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-md border border-[#0A77FF] bg-white text-[#0A77FF] shadow-sm hover:bg-[#EDF4FF] transition-colors cursor-pointer shrink-0 self-center outline-none focus-visible:ring-2 focus-visible:ring-[#0A77FF]/30" style={{ fontSize: "13px", fontWeight: 500 }}>
          {DOWNLOAD_META.failed.downloadLabel}
          <ChevronDown className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="z-[200] w-[268px] p-1.5 bg-white border border-[#E2E8F0] rounded-lg shadow-[0_10px_30px_-10px_rgba(15,23,42,0.18)]">
        <div className="flex items-start gap-2.5 p-2.5 bg-[#F1F5FF] rounded-lg border border-[#C6D2FF]">
          <Info className="w-4 h-4 shrink-0 mt-[0.5px]" style={{ color: "#4339CA" }} />
          <p style={{ fontSize: "12px", fontWeight: 400, color: "#475569", lineHeight: 1.45 }}>First download the error rows in your desired format, fix them, then upload the corrected file.</p>
        </div>
        <DropdownMenuSeparator className="my-1.5 h-px bg-[#E2E8F0]" />
        <DropdownMenuItem onSelect={() => onPick("xlsx")} className={item}>
          <FileSpreadsheet className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>Download as Excel</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick("csv")} className={item}>
          <FileText className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>Download as CSV</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1.5 h-px bg-[#E2E8F0]" />
        <DropdownMenuItem onSelect={onUpload} className={item}>
          <Upload className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>Upload Corrected File</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ImportCorrectedRowsButton({ readyCount, errorCount, running, onClick }: { readyCount: number; errorCount: number; running: boolean; onClick: () => void }) {
  const disabled = readyCount === 0 || running;
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md shadow-sm transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${disabled ? "bg-primary/40 text-white cursor-not-allowed" : "bg-primary hover:bg-[#0066D6] active:bg-[#005BBF] text-white cursor-pointer"}`}
      style={{ fontSize: "13px", fontWeight: 600 }}
    >
      {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {running ? "Importing..." : readyCount > 0 ? `Import ${readyCount} Correct ${readyCount === 1 ? "Row" : "Rows"}` : "Import Corrected Rows"}
    </button>
  );
  if (disabled && !running) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-block cursor-not-allowed">
            <span style={{ pointerEvents: "none" }} className="inline-block">
              {button}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8} className="z-[200] max-w-[280px] px-3 py-2">
          <span style={{ fontSize: "12.5px", fontWeight: 500 }}>{errorCount === 1 ? "Fix the row flagged with errors below to re-import it." : "Fix at least one of the rows flagged with errors below to re-import."}</span>
        </TooltipContent>
      </Tooltip>
    );
  }
  return button;
}

function CorrectionStrip({ pending, onOpenUpload, onDropFile, onRedownload, onDismiss }: { pending: PendingCorrection; onOpenUpload: () => void; onDropFile: (f: File) => void; onRedownload: (fmt: "xlsx" | "csv") => void; onDismiss: () => void }) {
  const [depth, setDepth] = useState(0);
  const dragging = depth > 0;
  const stem = importNameToFilenameStem(pending.fileName);
  void stem;
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors ${dragging ? "border-primary bg-[#EFF6FF]" : "border-[#FDE68A] bg-[#FFFBEB]"}`}
      style={{ borderStyle: dragging ? "dashed" : "solid", borderWidth: 1.5 }}
      aria-label="Awaiting corrected file"
      onDragEnter={(e) => {
        e.preventDefault();
        setDepth((d) => d + 1);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        setDepth((d) => Math.max(0, d - 1));
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDepth(0);
        const f = e.dataTransfer.files?.[0];
        if (f) onDropFile(f);
      }}
    >
      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: dragging ? "#DBEAFE" : "#FEF3C7" }}>
        <Upload className="w-4 h-4" style={{ color: dragging ? "#0A77FF" : "#B45309" }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-foreground" style={{ fontSize: "13px", fontWeight: 600 }}>
          {dragging ? "Drop to upload your corrected file" : "Waiting on your corrected file"}
        </div>
        <div className="mt-0.5 truncate" style={{ fontSize: "12px", color: "#92400E" }}>
          <span style={{ fontWeight: 500 }}>{pending.fileName}</span>, {pending.rowCount} error {pending.rowCount === 1 ? "row" : "rows"}, downloaded {format(new Date(pending.startedISO), "MMM d 'at' h:mm a")}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-md border border-[#D97706] bg-white text-[#B45309] shadow-sm hover:bg-[#FEF3C7] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]/30" style={{ fontSize: "13px", fontWeight: 500 }}>
              Download Again
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className={`z-[200] w-[200px] p-1.5 bg-white border border-border rounded-lg shadow-[${MENU_SHADOW}]`}>
            <DropdownMenuItem className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer text-[#334155] focus:bg-muted focus:text-foreground" onClick={() => onRedownload("csv")}>
              <FileText className="w-4 h-4" style={{ color: "#64748B" }} />
              <span style={{ fontSize: "13px", fontWeight: 500 }}>Download as CSV</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer text-[#334155] focus:bg-muted focus:text-foreground" onClick={() => onRedownload("xlsx")}>
              <FileSpreadsheet className="w-4 h-4" style={{ color: "#64748B" }} />
              <span style={{ fontSize: "13px", fontWeight: 500 }}>Download as Excel</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" onClick={onOpenUpload} className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-md text-white shadow-sm transition-colors cursor-pointer hover:bg-[#B45309]" style={{ backgroundColor: "#D97706", fontSize: "13px", fontWeight: 600 }}>
          <Upload className="w-3.5 h-3.5" />
          Upload Corrected File
        </button>
        <button type="button" onClick={onDismiss} aria-label="Stop waiting for a corrected file" title="Stop waiting for a corrected file" className="w-8 h-8 rounded-md flex items-center justify-center text-[#B45309] hover:bg-[#FEF3C7] transition-colors cursor-pointer shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
