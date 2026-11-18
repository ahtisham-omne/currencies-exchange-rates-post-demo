import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Clock, FileInput, Pencil, Search, User, X } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../ui/hover-card";
import { Checkbox } from "../../ui/checkbox";
import { DensityDropdown, type DensityOption } from "../density";
import { Pagination } from "../Pagination";
import { ExpandableDescription } from "../../shared/ExpandableDescription";
import { toast } from "sonner";
import { getImporter } from "../importers";
import { updateCompletedImportCounts } from "../importHistory";
import type { SheetImportSpec } from "./sheetSpec";
import type { CellIssue, RowFilter, SheetRow } from "./sheetRecords";
import { importNameToStem } from "./sheetRecords";
import { getSheetImport, updateSheetImportRows } from "./sheetImportStore";
import { validateRows } from "./sheetValidation";
import { downloadSheetRows } from "./sheetRowExport";
import { SheetImportWizardModal } from "./SheetImportWizardModal";
import { CellEditor } from "./cells/CellEditor";
import { CellAffordance } from "./cells/CellAffordance";
import { LineItemsSheet } from "./cells/LineItemsSheet";
import { ResolveEntityDialog } from "./cells/ResolveEntityDialog";
import { CustomerResolveOverlay } from "./cells/CustomerResolveOverlay";
import type { EntityGap, EntityKind } from "./cells/importModel";
import { setActiveSpec } from "./cells/specBridge";
import { lineIdFor, rowNumberFromLineId, toImportRecord, toRecordValidation } from "./cells/rowAdapter";
import { toColumnSpec } from "./cells/columnAdapter";
import { ROW_HEIGHT_COMFORT, ROW_HEIGHT_CONDENSED } from "../density";
import { ExpandWidthButton, WIDTH_TRANSITION_CLASS, useExpandedWidth } from "../ExpandWidthButton";
import { ImportSelectionBar } from "../ImportSelectionBar";
import { ImportColumnHeaderMenu } from "../table-columns/ImportColumnHeaderMenu";
import { useColumnControls } from "../table-columns/useColumnControls";
import { TooltipProvider } from "../../ui/tooltip";
import { cn } from "../../ui/utils";
import {
  DownloadDropdown,
  ImportCorrectedRowsButton,
  ImporterOverviewCard,
  RESULT_COL_WIDTH,
  ROW_OUTCOME_TOKENS,
  SELECT_COL_WIDTH,
  formatImportedOnShort,
} from "../ImportRecordDetailPage";

/* Header and cell chrome copied from the Users and module record pages (their
   Th / Td): 13px slate header labels, 14px cells, horizontal rules only. */
const HEADER_CLASS =
  "text-left align-middle px-3 whitespace-nowrap bg-[#FBFCFD] border-b border-[#E2E8F0] sticky top-0";
const CELL_CLASS = "px-3 align-middle border-b border-[#E2E8F0]";
/* Always-pinned leading block: checkbox, Row, Result, Line items. */
const SELECT_W = SELECT_COL_WIDTH;
const ROW_W = 64;
const RESULT_W = RESULT_COL_WIDTH;
const LINES_W = 110;
const LEADING_WIDTH = SELECT_W + ROW_W + RESULT_W + LINES_W;
const FROZEN_EDGE = "inset -1px 0 0 0 #E2E8F0";

/* One past import, row by row: what landed, what did not, and a way to fix the
 * rows that did not and send them again. This is the surface that makes an
 * import correctable after the fact rather than a one-shot event. */
export function SheetImportRecordDetailPage({
  spec,
  seed,
  existingKeys,
}: {
  spec: SheetImportSpec;
  /** Keys the module already holds. Passed to every re-validation so a row
   *  re-using one stays flagged after an edit, as it was in review. */
  existingKeys?: readonly string[];
  /** Lays down this module's seeded history. Called before the first read so a
   *  deep link straight to a record page works without visiting the listing
   *  first. */
  seed?: () => void;
}) {
  const { importId = "" } = useParams<{ importId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(() => { seed?.(); return getSheetImport(importId); });
  const [filter, setFilter] = useState<RowFilter>("all");
  const [query, setQuery] = useState("");
  const [fixOpen, setFixOpen] = useState(false);
  /* Same table controls as the Users and Roles record pages: row selection
     with an export of just the selection, density, and pagination. */
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  /* Inline fix-and-re-import, the same shape the Users record page uses: a row
     that failed stays editable in place, each edit is saved as you make it, and
     the row only becomes imported when you commit it. */
  const [editing, setEditing] = useState<{ row: number; field: string } | null>(null);
  const [pulseRows, setPulseRows] = useState<Set<number>>(new Set());
  /* Same two-level shape as the review sheet: record columns here, line items in
     the module's own sheet. */
  const [openLinesFor, setOpenLinesFor] = useState<string | null>(null);
  /* Catalog cells resolve through the module's own pickers here too, so a cell
     behaves the same before and after the import ran. */
  const [resolving, setResolving] = useState<{ gap: EntityGap; row: number; field: string } | null>(null);
  const recordColumns = useMemo(() => spec.columns.filter((c) => c.level === "record"), [spec]);
  useEffect(() => { setActiveSpec(spec); }, [spec]);
  const [density, setDensity] = useState<DensityOption>("condensed");
  const { isExpanded, setIsExpanded, containerMaxWidth } = useExpandedWidth();
  const controlledColumns = useMemo(
    () => recordColumns.map((c) => ({ ...c, width: c.width ?? 150 })),
    [recordColumns],
  );
  const columns = useColumnControls(controlledColumns);
  const { visibleColumns } = columns;
  const frozenLeft = columns.frozenLefts(LEADING_WIDTH);
  const hasFrozen = columns.frozenColumns.length > 0;
  const lastFrozenKey = hasFrozen ? columns.frozenColumns[columns.frozenColumns.length - 1].key : null;
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);

  useEffect(() => { seed?.(); setDetail(getSheetImport(importId)); }, [importId, seed]);
  /* A changed view must not leave rows selected that are no longer on screen. */
  useEffect(() => { setSelectedRows(new Set()); setCurrentPage(1); }, [filter, query]);

  const rows = detail?.rows ?? [];

  const counts = useMemo(() => {
    const imported = rows.filter((r) => r._outcome === "Created").length;
    const failed = rows.filter((r) => r._outcome === "Failed" || r._outcome === "Skipped").length;
    return { all: rows.length, imported, failed };
  }, [rows]);

  /* One group per record row. Continuation rows attach to the latest record
     row carrying their key, so a record repeated in the file (a duplicate key)
     stays its own group instead of folding into the first one. `id` is unique
     per group; `recordKey` is the record's own number. */
  const recordGroups = useMemo(() => {
    const groups: { id: string; recordKey: string; head: SheetRow; group: SheetRow[] }[] = [];
    const latestByKey = new Map<string, (typeof groups)[number]>();
    for (const r of rows) {
      const current = latestByKey.get(r._key);
      if (r._isRecordRow || !current) {
        const g = { id: `${r._key}#${r._row}`, recordKey: r._key, head: r, group: [r] };
        groups.push(g);
        latestByKey.set(r._key, g);
      } else {
        current.group.push(r);
      }
    }
    return groups;
  }, [rows]);
  /** A record imported only when every one of its rows did. */
  const groupImported = (group: SheetRow[]) => group.every((r) => r._outcome === "Created");

  const openGroup = openLinesFor ? recordGroups.find((g) => g.id === openLinesFor) : undefined;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recordGroups.filter(({ group }) => {
      const imported = groupImported(group);
      if (filter === "imported" && !imported) return false;
      if (filter === "failed" && imported) return false;
      if (!q) return true;
      return group.some((r) => Object.values(r.values).some((v) => v.toLowerCase().includes(q)));
    });
  }, [recordGroups, filter, query]);

  /* Header-menu sort over whole records (their head row carries the values). */
  const { sortRows } = columns;
  const sortedGroups = useMemo(
    () =>
      sortRows(visible, (g, key) => {
        if (key === "_row") return g.head._row;
        if (key === "_result") return groupImported(g.group) ? "Imported" : "Failed";
        if (key === "_lines") return g.group.length;
        return g.head.values[key];
      }),
    [sortRows, visible],
  );

  const totalPages = Number.isFinite(recordsPerPage)
    ? Math.max(1, Math.ceil(sortedGroups.length / recordsPerPage))
    : 1;
  const pagedRows = useMemo(() => {
    if (!Number.isFinite(recordsPerPage)) return sortedGroups;
    const start = (currentPage - 1) * recordsPerPage;
    return sortedGroups.slice(start, start + recordsPerPage);
  }, [sortedGroups, currentPage, recordsPerPage]);

  /* A cell edit is persisted immediately and re-validated, so leaving the page
     and coming back keeps the fix rather than resurfacing the old error. The
     row keeps its failed outcome until it is committed. */
  const applyEdit = useCallback(
    (rowNo: number, field: string, value: string) => {
      if (!detail) return;
      const next = validateRows(
        detail.rows.map((r) =>
          r._row === rowNo ? { ...r, values: { ...r.values, [field]: value } } : r,
        ),
        spec,
        { existingKeys },
      ).map((r, i) => ({ ...r, _outcome: detail.rows[i]._outcome }));
      updateSheetImportRows(detail.id, next);
      updateCompletedImportCounts(detail.id, {
        importedCount: next.filter((r) => r._outcome === "Created").length,
        failedCount: next.filter((r) => r._outcome !== "Created").length,
      });
      setDetail(getSheetImport(detail.id));
      setEditing(null);
    },
    [detail, spec, existingKeys],
  );

  /* Rows that failed and now carry no errors: what the commit button imports. */
  const readyRows = useMemo(
    () => rows.filter((r) => r._outcome !== "Created" && !r.issues.some((i) => i.level === "error")),
    [rows],
  );

  const commitFixedRows = useCallback(() => {
    if (!detail || readyRows.length === 0) return;
    const ready = new Set(readyRows.map((r) => r._row));
    const next = detail.rows.map((r) =>
      ready.has(r._row) ? { ...r, _outcome: "Created" as const, _skipped: false } : r,
    );
    updateSheetImportRows(detail.id, next);
    updateCompletedImportCounts(detail.id, {
      importedCount: next.filter((r) => r._outcome === "Created").length,
      failedCount: next.filter((r) => r._outcome !== "Created").length,
    });
    setDetail(getSheetImport(detail.id));
    setPulseRows(ready);
    toast.success(
      `${ready.size} ${ready.size === 1 ? "row" : "rows"} imported into this ${spec.recordLabel.toLowerCase()} import.`,
    );
    window.setTimeout(() => setPulseRows(new Set()), 1600);
  }, [detail, readyRows, spec]);

  const exportSelected = useCallback(
    (fmt: "csv" | "xlsx") => {
      const picked = recordGroups.filter((g) => selectedRows.has(g.head._row)).flatMap((g) => g.group);
      if (picked.length === 0) {
        toast.info("No selected rows to export.");
        return;
      }
      void downloadSheetRows(spec, picked, `${importNameToStem(detail?.name ?? "import")}_selected`, fmt);
    },
    [recordGroups, selectedRows, spec, detail],
  );

  /* Re-importing corrected rows: the fixed file comes back through the same
     wizard, and the rows that now pass fold into this import as imported, so
     the listing's counts and this page keep agreeing. */
  const handleFixApplied = useCallback(
    (outcomeRows: SheetRow[]) => {
      if (!detail) return;
      const byRow = new Map(outcomeRows.map((r) => [r._row, r]));
      const merged: SheetRow[] = rows.map((row) => {
        const fixed = byRow.get(row._row);
        if (!fixed) return row;
        return fixed;
      });
      /* Rows the fixed file added (numbers this import never had) join the end. */
      for (const r of outcomeRows) {
        if (!rows.some((existing) => existing._row === r._row)) merged.push(r);
      }
      const revalidated = validateRows(merged, spec, { existingKeys }).map((r, i) => ({
        ...r,
        _outcome: merged[i]._outcome,
      }));
      updateSheetImportRows(detail.id, revalidated);
      updateCompletedImportCounts(detail.id, {
        importedCount: revalidated.filter((r) => r._outcome === "Created").length,
        failedCount: revalidated.filter((r) => r._outcome !== "Created").length,
      });
      setDetail(getSheetImport(detail.id));
      setFixOpen(false);
    },
    [detail, rows, spec, existingKeys],
  );

  if (!detail) {
    return (
      <div className="p-6">
        <button
          type="button"
          onClick={() => navigate(`/company-settings/data-imports/${spec.slug}`)}
          className="inline-flex items-center gap-1.5 text-[#0A77FF] cursor-pointer"
          style={{ fontSize: 13, fontWeight: 500 }}
        >
          <ChevronLeft className="w-4 h-4" />
          Back to {spec.recordLabel.toLowerCase()} imports
        </button>
        <p className="text-[#64748B] mt-4" style={{ fontSize: 13 }}>
          This import is no longer stored in this session.
        </p>
      </div>
    );
  }

  const importer = getImporter(detail.importerKey);

  const importedDateText = formatImportedOnShort(detail.dateISO);
  const failedRows = rows.filter((r) => r._outcome !== "Created");
  const downloadFailedRows = (fmt: "csv" | "xlsx") => {
    if (failedRows.length === 0) {
      toast.info("No failed rows to download.");
      return;
    }
    void downloadSheetRows(spec, failedRows, `${importNameToStem(detail.name)}_failed`, fmt);
  };
  const headerStyle: React.CSSProperties = {
    height: density === "comfort" ? 44 : 36,
    fontSize: 13,
    fontWeight: 400,
    color: "#475569",
    lineHeight: "1.2",
  };
  const filterChips: { key: RowFilter; label: string; count: number }[] = [
    { key: "all", label: "Show All", count: counts.all },
    { key: "imported", label: "Imported", count: counts.imported },
    { key: "failed", label: "Failed", count: counts.failed },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {columns.ghost}
      {/* ─── Header ─── */}
      <div className={cn("shrink-0 px-6 lg:px-8 pt-4", WIDTH_TRANSITION_CLASS)} style={{ maxWidth: containerMaxWidth }}>
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm" style={{ padding: "12px 16px" }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => navigate(`/company-settings/data-imports/${spec.slug}`)}
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
                    title={detail.fileName || detail.name}
                  >
                    {detail.fileName || detail.name}
                  </h1>

                  <HoverCard openDelay={120} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border cursor-pointer transition-colors hover:bg-[#EEF2F6] shrink-0"
                        style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}
                      >
                        <User className="w-3 h-3" style={{ color: "#94A3B8" }} />
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#475569" }}>{importer.name}</span>
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent
                      side="bottom"
                      align="start"
                      sideOffset={8}
                      className="w-[320px] p-0 rounded-xl border border-[#E2E8F0] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)]"
                    >
                      <ImporterOverviewCard user={importer} />
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

                {detail.description ? (
                  <ExpandableDescription
                    maxExpandedLines={8}
                    text={detail.description}
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
                <DownloadDropdown onPick={downloadFailedRows} onUpload={() => setFixOpen(true)} />
              )}
              {(counts.failed > 0 || readyRows.length > 0) && (
                <TooltipProvider delayDuration={200}>
                  <ImportCorrectedRowsButton
                    readyCount={readyRows.length}
                    errorCount={counts.failed}
                    running={false}
                    onImport={commitFixedRows}
                  />
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Body: full-height table card ─── */}
      <div className={cn("flex-1 min-h-0 px-6 lg:px-8 py-4 flex flex-col", WIDTH_TRANSITION_CLASS)} style={{ maxWidth: containerMaxWidth }}>
        <div className="flex-1 min-h-0 bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
          <div className="shrink-0 px-4 pt-3.5 pb-2 flex items-center justify-between gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#CBD5E1" }} />
              <input
                type="text"
                placeholder="Search records..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-[#E2E8F0] shadow-sm rounded-md placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/20 transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
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
            <ImportSelectionBar count={selectedRows.size} onExport={exportSelected} onClear={() => setSelectedRows(new Set())} />
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
                      onClick={() => setFilter(chip.key)}
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

          <div className="flex-1 min-h-0 overflow-auto relative">
          {/* Fixed layout only applies with an explicit width; without it the
              columns auto-size and the sticky offsets drift off their columns. */}
          <table
            className="border-separate"
            style={{ borderSpacing: 0, tableLayout: "fixed", width: LEADING_WIDTH + visibleColumns.reduce((acc, c) => acc + c.width, 0) }}
          >
            <colgroup>
              <col style={{ width: SELECT_W }} />
              <col style={{ width: ROW_W }} />
              <col style={{ width: RESULT_W }} />
              <col style={{ width: LINES_W }} />
              {visibleColumns.map((col) => (
                <col key={col.key} style={{ width: col.width }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <th className={`${HEADER_CLASS} sticky left-0 z-30 text-center`} style={{ ...headerStyle, width: SELECT_W }}>
                  <span className="flex items-center justify-center">
                    <Checkbox
                      aria-label="Select all rows on page"
                      className="data-[state=checked]:bg-[#0A77FF] data-[state=checked]:border-[#0A77FF] data-[state=checked]:text-white data-[state=indeterminate]:bg-[#0A77FF] data-[state=indeterminate]:border-[#0A77FF] data-[state=indeterminate]:text-white"
                      checked={
                        pagedRows.length > 0 && pagedRows.every((g) => selectedRows.has(g.head._row))
                          ? true
                          : pagedRows.some((g) => selectedRows.has(g.head._row))
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(checked) => {
                        setSelectedRows((prev) => {
                          const next = new Set(prev);
                          if (checked) for (const g of pagedRows) next.add(g.head._row);
                          else for (const g of pagedRows) next.delete(g.head._row);
                          return next;
                        });
                      }}
                    />
                  </span>
                </th>
                <th className={`${HEADER_CLASS} z-30`} style={{ ...headerStyle, left: SELECT_W, paddingLeft: 16, paddingRight: 4 }}>
                  <ImportColumnHeaderMenu columnKey="_row" label="Row" sort={columns.sort} onSort={columns.onSort} />
                </th>
                <th className={`${HEADER_CLASS} z-30`} style={{ ...headerStyle, left: SELECT_W + ROW_W }}>
                  <ImportColumnHeaderMenu columnKey="_result" label="Result" sort={columns.sort} onSort={columns.onSort} />
                </th>
                <th
                  className={`${HEADER_CLASS} z-30`}
                  style={{ ...headerStyle, left: SELECT_W + ROW_W + RESULT_W, boxShadow: hasFrozen ? undefined : FROZEN_EDGE }}
                >
                  <ImportColumnHeaderMenu columnKey="_lines" label="Line items" sort={columns.sort} onSort={columns.onSort} />
                </th>
                {visibleColumns.map((col) => {
                  const isFrozen = columns.frozen.has(col.key);
                  return (
                    <th
                      key={col.key}
                      {...columns.headerDragProps(col.key)}
                      className={`${HEADER_CLASS} group/colheader cursor-grab select-none ${isFrozen ? "z-30" : "z-20"}`}
                      style={{
                        ...headerStyle,
                        /* Header cells are already sticky to the top; frozen ones
                           also pin to the left. */
                        position: "sticky",
                        ...(isFrozen ? { left: frozenLeft[col.key] } : null),
                        ...(col.key === lastFrozenKey ? { boxShadow: FROZEN_EDGE } : null),
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
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 4} className="px-3 py-8 text-center text-[#94A3B8]" style={{ fontSize: 13 }}>
                    No rows match this view.
                  </td>
                </tr>
              ) : (
                pagedRows.map(({ id: groupId, recordKey: key, head: row, group }) => {
                  const isSelected = selectedRows.has(row._row);
                  const rowTint = isSelected ? "#EFF6FF" : undefined;
                  const rowHeight = density === "comfort" ? ROW_HEIGHT_COMFORT : ROW_HEIGHT_CONDENSED;
                  const cellStyle: React.CSSProperties = {
                    height: rowHeight,
                    fontSize: 14,
                    color: "#334155",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    backgroundColor: rowTint,
                  };
                  return (
                  <tr
                    key={row._row}
                    className={`import-row-hover${pulseRows.has(row._row) ? " import-fixed-row-pulse" : ""}`}
                  >
                    <td
                      className={`${CELL_CLASS} sticky left-0 z-10 text-center`}
                      style={{ ...cellStyle, width: SELECT_W, backgroundColor: rowTint ?? "#FFFFFF" }}
                    >
                      <span className="flex items-center justify-center">
                        <Checkbox
                          aria-label={`Select row ${row._row}`}
                          className="data-[state=checked]:bg-[#0A77FF] data-[state=checked]:border-[#0A77FF] data-[state=checked]:text-white"
                          checked={isSelected}
                          onCheckedChange={(c) => {
                            setSelectedRows((prev) => {
                              const next = new Set(prev);
                              if (c === true) next.add(row._row);
                              else next.delete(row._row);
                              return next;
                            });
                          }}
                        />
                      </span>
                    </td>
                    <td
                      className={`${CELL_CLASS} sticky z-10`}
                      style={{ ...cellStyle, left: SELECT_W, paddingLeft: 16, color: "#64748B", fontVariantNumeric: "tabular-nums", backgroundColor: rowTint ?? "#FFFFFF" }}
                    >
                      {row._row}
                    </td>
                    <td
                      className={`${CELL_CLASS} sticky z-10`}
                      style={{ ...cellStyle, left: SELECT_W + ROW_W, backgroundColor: rowTint ?? "#FFFFFF" }}
                    >
                      <OutcomeChip group={group} />
                    </td>
                    <td
                      className={`${CELL_CLASS} sticky z-10`}
                      style={{
                        ...cellStyle,
                        left: SELECT_W + ROW_W + RESULT_W,
                        backgroundColor: rowTint ?? "#FFFFFF",
                        boxShadow: hasFrozen ? undefined : FROZEN_EDGE,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenLinesFor(groupId)}
                        className="inline-flex items-center gap-1.5 px-2 h-6 rounded-md border border-[#E2E8F0] bg-white hover:border-[#0A77FF] hover:text-[#0A77FF] transition-colors cursor-pointer"
                        style={{ font: "inherit", fontSize: 12, fontWeight: 500, color: "#475569" }}
                      >
                        {group.length} {group.length === 1 ? "line" : "lines"}
                      </button>
                    </td>
                    {visibleColumns.map((col) => {
                      const isFrozenCol = columns.frozen.has(col.key);
                      const cellIssues = row.issues.filter((i) => i.field === col.key);
                      const hasError = cellIssues.some((i) => i.level === "error");
                      const blank = false;
                      /* Every cell that belongs to the row is editable here,
                         imported rows included: a row that came in with a
                         mapped value is exactly the kind you want to correct
                         after the fact. */
                      const editable = !blank;
                      const isEditing = editing?.row === row._row && editing.field === col.key;
                      return (
                        <td
                          key={col.key}
                          className={`${CELL_CLASS}${isFrozenCol ? " sticky z-10" : ""}`}
                          data-cell-tint={cellIssues.length > 0 || isEditing ? "" : undefined}
                          style={{
                            ...cellStyle,
                            ...(isFrozenCol ? { left: frozenLeft[col.key] } : null),
                            ...(col.key === lastFrozenKey ? { boxShadow: FROZEN_EDGE } : null),
                            backgroundColor: hasError
                              ? "#FEF2F2"
                              : cellIssues.length
                                ? "#FFFBEB"
                                : rowTint ?? (columns.draggingKey === col.key ? "#F7FAFF" : isFrozenCol ? "#FFFFFF" : undefined),
                          }}
                          title={row.values[col.key] || undefined}
                        >
                          {blank ? (
                            <span className="text-[#CBD5E1]">·</span>
                          ) : isEditing ? (
                            <CellEditor
                              column={toColumnSpec(col)}
                              value={row.values[col.key] ?? ""}
                              onCommit={(next) => applyEdit(row._row, col.key, next)}
                              onCancel={() => setEditing(null)}
                            />
                          ) : (
                            <FixableCell
                              text={row.values[col.key] ?? ""}
                              label={col.label}
                              affordance={<CellAffordance column={col} />}
                              issues={cellIssues}
                              editable={editable}
                              onEdit={() => {
                                /* Every cell, catalog columns included, edits in place on the shared
                                   cell dropdown (no full-screen search, no resolve dialog). */
                                setEditing({ row: row._row, field: col.key });
                              }}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          recordsPerPage={recordsPerPage}
          onRecordsPerPageChange={(n) => { setRecordsPerPage(n); setCurrentPage(1); }}
          pageSizeOptions={[10, 20, 50, 100]}
          allowAll
        />
        </div>
      </div>

      {resolving && ["customer", "location", "contact"].includes(resolving.gap.entity) && (
        <CustomerResolveOverlay
          open
          entity={resolving.gap.entity}
          onPick={(value) => { applyEdit(resolving.row, resolving.field, value); setResolving(null); }}
          onClose={() => setResolving(null)}
        />
      )}

      {resolving && !["customer", "location", "contact"].includes(resolving.gap.entity) && (
        <ResolveEntityDialog
          gap={resolving.gap}
          onApply={(replacement) => { applyEdit(resolving.row, resolving.field, replacement); setResolving(null); }}
          onClose={() => setResolving(null)}
        />
      )}

      {openGroup && (
        <LineItemsSheet
          record={toImportRecord(openGroup.recordKey, openGroup.group)}
          validation={toRecordValidation(openGroup.group, spec)}
          onEditLine={(lineId, field, value) => applyEdit(rowNumberFromLineId(lineId), field, value)}
          onEditAdjustments={() => undefined}
          onOpenEntity={(entity, current, cell) =>
            setResolving({
              gap: {
                entity,
                rawValue: current,
                occurrences: 1,
                recordIds: [openGroup.recordKey],
                cell: { recordId: openGroup.recordKey, lineId: cell.lineId, field: cell.field },
              },
              row: rowNumberFromLineId(cell.lineId),
              field: cell.field,
            })
          }
          onDropLine={() => undefined}
          onResolveIssue={() => undefined}
          onClose={() => setOpenLinesFor(null)}
        />
      )}

      <SheetImportWizardModal
        open={fixOpen}
        spec={spec}
        onClose={() => setFixOpen(false)}
        onApplied={(outcome) => handleFixApplied(outcome.rows)}
        title={`Re-import corrected ${spec.recordLabelPlural.toLowerCase()}`}
        description="Upload the file with your corrections. Rows that pass this time fold into this import."
      />
    </div>
  );
}

function OutcomeChip({ group }: { group: SheetRow[] }) {
  /* Same chip as the Users and module record pages, read over the whole
     record: Imported (green) only when every row imported, otherwise Failed
     (red); a record whose only problem is a dropped row reads as Error, the
     Users page's word for a skipped row. */
  const outcomes = group.map((r) => r._outcome ?? "Created");
  const imported = outcomes.every((o) => o === "Created");
  const tok = imported ? ROW_OUTCOME_TOKENS.Created : ROW_OUTCOME_TOKENS.Failed;
  const label = imported ? "Imported" : outcomes.includes("Failed") ? "Failed" : "Error";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full border whitespace-nowrap"
      style={{ fontSize: "11px", fontWeight: 600, backgroundColor: tok.bg, color: tok.text, borderColor: tok.border }}
    >
      {label}
    </span>
  );
}

/* A cell on a row that has not imported yet: the whole cell is the click
   target, and a flagged cell explains itself and says how to fix it. Mirrors
   the review sheet's cell so the two surfaces behave the same. */
function FixableCell({
  text,
  label,
  issues,
  editable,
  affordance,
  onEdit,
}: {
  text: string;
  label: string;
  issues: CellIssue[];
  editable: boolean;
  affordance?: React.ReactNode;
  onEdit: () => void;
}) {
  const body = editable ? (
    <button
      type="button"
      onClick={onEdit}
      className="group/cell flex w-full items-center gap-1.5 text-left cursor-pointer"
      style={{ font: "inherit", color: "inherit" }}
      title={text || undefined}
    >
      <span className={`truncate ${text ? "text-[#334155]" : "text-[#CBD5E1]"}`}>{text || "-"}</span>
      {affordance ? (
        <span className="shrink-0 inline-flex opacity-0 group-hover/cell:opacity-100 transition-opacity">{affordance}</span>
      ) : (
        <Pencil className="w-3 h-3 shrink-0 text-transparent group-hover/cell:text-[#0A77FF] transition-colors" />
      )}
    </button>
  ) : (
    <span className="text-[#334155]">{text}</span>
  );

  if (issues.length === 0) return body;

  const hasError = issues.some((i) => i.level === "error");
  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>{body}</HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-[290px] p-0 rounded-xl border-0 overflow-hidden z-[300]"
        style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
      >
        <div className="px-3.5 py-2.5" style={{ background: hasError ? "#FEF2F2" : "#FFFBEB" }}>
          <p className="text-[#0F172A]" style={{ fontSize: 12, fontWeight: 600 }}>{label}</p>
          <p style={{ fontSize: 11, fontWeight: 500, color: hasError ? "#B91C1C" : "#B45309" }}>
            {hasError ? "Needs a fix before it can import" : "Imported with a change"}
          </p>
        </div>
        <div className="bg-white px-3.5 py-3 flex flex-col" style={{ gap: 8 }}>
          {issues.map((issue, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <p className="text-[#334155]" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>{issue.message}</p>
              {issue.hint && (
                <p className="text-[#94A3B8]" style={{ fontSize: 11.5, lineHeight: 1.5, margin: 0 }}>{issue.hint}</p>
              )}
            </div>
          ))}
          {editable && (
            <p className="text-[#94A3B8]" style={{ fontSize: 11, margin: 0 }}>
              Click the cell to fix it here, then use Import fixed rows.
            </p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
