/* Import history for one entity (port of UAC DataImportDetailPage), mounted
 * at /vendors/imports and /partners/groups/imports inside the AppLayout. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, ChevronLeft, CornerDownRight, FileInput, FileUp, Minus, Pencil, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { ensureSeededForLoad, getImporter, getPendingCorrections, listImports, loadImportDetail, subscribeToImportHistory, subscribeToPendingCorrections, type CompletedImportEntry, type Importer } from "./importHistory";
import { ImportWizardModal } from "./ImportWizardModal";
import { useImportHostBindings, useRouteImportSpec } from "./hostBindings";
import { PinToViewport, TableEmptyState, TableSkeletonRows, resolveTableEmptyKind, useTableLoadState } from "../components/ui/table-empty-state";
import { findSearchSuggestion } from "../utils/searchSuggestion";
import { DensityDropdown, HighlightMatch, ImporterHoverName, Pagination, ResultChip, SearchBox, type Density } from "./ui";

interface ImportRow {
  id: string;
  name: string;
  fileName?: string;
  description?: string;
  dateISO: string;
  importer: Importer;
  importedCount: number;
  failedCount: number;
  correctionKind?: "inline" | "reimport";
  awaitingCorrection: boolean;
  children: ImportRow[];
}

function toRow(e: CompletedImportEntry, pending: Record<string, unknown>): ImportRow {
  return {
    id: e.id,
    name: e.fileName ?? e.name,
    fileName: e.fileName,
    description: e.description,
    dateISO: e.dateISO,
    importer: getImporter(e.importerKey),
    importedCount: e.importedCount ?? 0,
    failedCount: e.failedCount ?? 0,
    correctionKind: e.correctionKind,
    awaitingCorrection: !e.parentId && !!pending[e.id],
    children: [],
  };
}

export function ImportHistoryPage() {
  const spec = useRouteImportSpec();
  const navigate = useNavigate();
  const host = useImportHostBindings(spec);
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState<Density>("comfort");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    ensureSeededForLoad(spec);
    const bump = () => setVersion((v) => v + 1);
    const a = subscribeToImportHistory(spec, bump);
    const b = subscribeToPendingCorrections(spec, bump);
    return () => {
      a();
      b();
    };
  }, [spec]);

  const rows = useMemo(() => {
    const pending = getPendingCorrections(spec);
    const entries = listImports(spec);
    const byId = new Map<string, ImportRow>();
    const top: ImportRow[] = [];
    for (const e of entries) byId.set(e.id, toRow(e, pending));
    for (const e of entries) {
      const row = byId.get(e.id)!;
      if (e.parentId && byId.has(e.parentId)) byId.get(e.parentId)!.children.push(row);
      else top.push(row);
    }
    for (const r of top) r.children.sort((x, y) => y.dateISO.localeCompare(x.dateISO));
    return top;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, version]);

  const q = search.trim().toLowerCase();
  const recordMatches = useCallback(
    (id: string): string[] => {
      if (!q) return [];
      const detail = loadImportDetail(spec, id);
      if (!detail) return [];
      return detail.records.filter((r) => spec.columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))).map((r) => `${String(r[spec.keyColumn] ?? "row")} (row ${r._row})`);
    },
    [q, spec],
  );
  const filtered = useMemo(() => {
    const list = rows
      .map((r) => {
        const direct = !q || r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q) || r.importer.name.toLowerCase().includes(q);
        const matches = direct ? [] : recordMatches(r.id);
        return direct || matches.length ? { row: r, matches } : null;
      })
      .filter((x): x is { row: ImportRow; matches: string[] } => !!x);
    list.sort((a, b) => (sortDir === "desc" ? b.row.dateISO.localeCompare(a.row.dateISO) : a.row.dateISO.localeCompare(b.row.dateISO)));
    return list;
  }, [rows, q, recordMatches, sortDir]);
  const totalPages = Number.isFinite(perPage) ? Math.max(1, Math.ceil(filtered.length / perPage)) : 1;
  const pageSafe = Math.min(page, totalPages);
  const paged = Number.isFinite(perPage) ? filtered.slice((pageSafe - 1) * perPage, pageSafe * perPage) : filtered;
  const rowH = density === "comfort" ? "h-[52px]" : "h-[36px]";
  const stickyShadow = "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)";
  const [validationContext, setValidationContext] = useState<ReturnType<typeof host.makeValidationContext> | undefined>(undefined);
  const openWizard = () => {
    setValidationContext(host.makeValidationContext());
    setWizardOpen(true);
  };

  /* Global empty / error states */
  const tableLoad = useTableLoadState();
  const emptyKind = resolveTableEmptyKind({
    loadState: tableLoad.loadState,
    totalCount: tableLoad.forceEmpty ? 0 : rows.length,
    filteredCount: tableLoad.forceEmpty ? 0 : filtered.length,
    pageCount: paged.length,
    searchQuery: search,
  });
  const searchSuggestion = useMemo(() => {
    if (emptyKind !== "no-results") return null;
    return findSearchSuggestion(search, rows.flatMap((r) => [r, ...r.children]).flatMap((r) => [r.name, r.description, r.importer.name]));
  }, [emptyKind, search, rows]);

  const formatMatches = (m: string[]) => (m.length === 1 ? `Contains match: ${m[0]}` : `Contains ${m.length} matches: ${m.slice(0, 3).join(", ")}${m.length > 3 ? ` +${m.length - 3} more` : ""}`);

  const trailing = (r: ImportRow) => (
    <>
      <td className="truncate">{r.description ? <span className="text-[#334155] truncate block" style={{ fontSize: "14px", fontWeight: 400 }}><HighlightMatch text={r.description} query={search} /></span> : <span className="text-[#CBD5E1]">-</span>}</td>
      <td>
        <ImporterHoverName importer={r.importer} />
      </td>
      <td className="text-[#334155]" style={{ fontSize: "14px" }}>
        {format(new Date(r.dateISO), "MMM dd, yyyy")}
      </td>
      <td>
        <div className="flex items-center gap-1.5 min-w-0">
          <ResultChip tone="success">{r.importedCount} imported</ResultChip>
          {r.failedCount > 0 && <ResultChip tone="failed">{r.failedCount} failed</ResultChip>}
        </div>
      </td>
    </>
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-background">
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
          <span style={{ fontWeight: 500 }} className="text-foreground">
            Imports
          </span>
        </div>
      </div>
      <div className="p-3 flex-1 min-h-0 flex flex-col">
        <div data-page-heading className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 -mx-3 -mt-3 px-3 pt-3.5 pb-3.5 bg-white border-b border-border shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button type="button" onClick={() => navigate(spec.routes.listing)} aria-label="Back to listing" className="w-8 h-8 rounded-lg border border-border bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgb(var(--accent))" }}>
              <FileInput className="w-4 h-4" style={{ color: "rgb(var(--primary))" }} />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-[20px]">{spec.entity} Imports</h1>
              <p className="text-xs text-muted-foreground">Every spreadsheet import into {spec.nounPluralLower}, with what landed and what still needs fixing.</p>
            </div>
          </div>
          <button type="button" onClick={openWizard} className="inline-flex items-center justify-center h-9 gap-1.5 px-4 text-[13px] rounded-lg text-white shadow-sm transition-all duration-200 cursor-pointer bg-primary hover:bg-[#0862D0] shrink-0" style={{ fontWeight: 600 }}>
            <Plus className="w-3.5 h-3.5" />
            New Import
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col bg-white border border-border rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
            <SearchBox
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search by name, or user..."
            />
            <div className="flex items-center gap-2">
              <span data-table-meta className="text-[13px] text-[#64748B] tabular-nums mr-1">
                {filtered.length} {filtered.length === 1 ? "import" : "imports"}
              </span>
              <DensityDropdown density={density} onChange={setDensity} />
            </div>
          </div>
          <div className="shrink-0 border-t border-border" />
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full border-collapse" style={{ minWidth: "1080px", tableLayout: "fixed" }}>
              <thead className="sticky top-0 z-20 bg-white">
                <tr className="bg-[#F1F5F9]/30 border-b border-border [&>th]:h-11">
                  <th className="text-left align-middle pl-4 pr-2 whitespace-nowrap sticky left-0 z-20 bg-[#F8FAFC] w-[26%]" style={{ fontSize: "13px", fontWeight: 400, color: "#475569", lineHeight: "1.2", boxShadow: stickyShadow }}>
                    <span className="flex items-center gap-2">
                      <span className="w-5 shrink-0" aria-hidden />
                      File Name
                    </span>
                  </th>
                  <th className="text-left align-middle pl-4 pr-2 whitespace-nowrap w-[28%]" style={{ fontSize: "13px", fontWeight: 400, color: "#475569" }}>
                    Description
                  </th>
                  <th className="text-left align-middle pl-4 pr-2 whitespace-nowrap w-[200px]" style={{ fontSize: "13px", fontWeight: 400, color: "#475569" }}>
                    Imported By
                  </th>
                  <th className="text-left align-middle pl-4 pr-2 whitespace-nowrap w-[200px]" style={{ fontSize: "13px", fontWeight: 400, color: "#475569" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                        setPage(1);
                      }}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                      style={{ font: "inherit" }}
                      aria-label={`Sort by imported date, currently ${sortDir === "desc" ? "newest" : "oldest"} first`}
                    >
                      Imported On
                      {sortDir === "desc" ? <ArrowDown className="w-3 h-3" style={{ color: "#0A77FF" }} /> : <ArrowUp className="w-3 h-3" style={{ color: "#0A77FF" }} />}
                    </button>
                  </th>
                  <th className="text-left align-middle pl-4 pr-2 whitespace-nowrap w-[200px]" style={{ fontSize: "13px", fontWeight: 400, color: "#475569" }}>
                    Results
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableLoad.loadState === "loading" ? (
                  <TableSkeletonRows columns={5} />
                ) : emptyKind ? (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <PinToViewport>
                        <TableEmptyState
                          kind={emptyKind}
                          entity={{ singular: "import", plural: "imports" }}
                          searchQuery={search}
                          suggestion={searchSuggestion}
                          onApplySuggestion={(v) => { setSearch(v); setPage(1); }}
                          onClearSearch={() => { setSearch(""); setPage(1); }}
                          onRetry={tableLoad.retry}
                          retrying={tableLoad.retrying}
                          onFirstPage={() => setPage(1)}
                          description="Imports you run will show up here with their results."
                          onCreate={openWizard}
                          createLabel="Import"
                        />
                      </PinToViewport>
                    </td>
                  </tr>
                ) : (
                  paged.map(({ row: r, matches }) => {
                    const isOpen = expanded.has(r.id);
                    const showChildren = isOpen && r.children.length > 0;
                    return (
                      <FragmentRows key={r.id}>
                        <tr className={`group cursor-pointer transition-colors hover:bg-[#F0F7FF] ${rowH} [&>td]:pl-4 [&>td]:pr-2 [&>td]:align-middle ${!showChildren && matches.length === 0 ? "border-b border-border" : ""}`} onClick={() => navigate(spec.routes.recordHref(r.id))}>
                          <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F0F7FF]" style={{ boxShadow: stickyShadow }}>
                            <div className="flex items-center gap-2 min-w-0">
                              {r.children.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpanded((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(r.id)) next.delete(r.id);
                                      else next.add(r.id);
                                      return next;
                                    });
                                  }}
                                  aria-label={isOpen ? "Hide corrections" : "Show corrections"}
                                  className={`w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer ${isOpen ? "bg-primary text-white" : "border border-[#BFDBFE] bg-white text-primary hover:bg-[#EFF6FF]"}`}
                                >
                                  {isOpen ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                </button>
                              ) : (
                                <span className="w-5 shrink-0" aria-hidden />
                              )}
                              <span className="truncate block" style={{ fontSize: "14px", fontWeight: 500, color: "#1E293B" }} title={r.name}>
                                <HighlightMatch text={r.name} query={search} />
                              </span>
                              {r.awaitingCorrection && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0" style={{ fontSize: "11.5px", fontWeight: 500, backgroundColor: "#FFFBEB", color: "#B45309", borderColor: "#FDE68A" }} title="The error rows were downloaded. Open this import to upload the corrected file.">
                                  <Upload className="w-3 h-3" />
                                  Awaiting File
                                </span>
                              )}
                            </div>
                          </td>
                          {trailing(r)}
                        </tr>
                        {showChildren &&
                          r.children.map((c, i) => (
                            <tr
                              key={c.id}
                              className={`group cursor-pointer transition-colors bg-[#F8FAFF] hover:bg-[#F0F7FF] ${rowH} [&>td]:pl-4 [&>td]:pr-2 [&>td]:align-middle ${i === r.children.length - 1 && matches.length === 0 ? "border-b border-border" : ""}`}
                              aria-label={c.correctionKind === "reimport" ? `Corrected file re-imported into ${r.name}` : `Inline correction of ${r.name}`}
                              onClick={() => navigate(spec.routes.recordHref(c.id))}
                            >
                              <td className="sticky left-0 z-10 bg-[#F8FAFF] group-hover:bg-[#F0F7FF]" style={{ boxShadow: stickyShadow }}>
                                <div className="flex items-center gap-2 min-w-0 pl-7">
                                  <CornerDownRight className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                                  {c.correctionKind === "reimport" ? <FileUp className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} aria-label="Re-imported file" /> : <Pencil className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} aria-label="Fixed in place" />}
                                  <span className="truncate block" style={{ fontSize: "14px", fontWeight: 500, color: "#475569" }} title={c.name}>
                                    {c.name}
                                  </span>
                                </div>
                              </td>
                              {trailing(c)}
                            </tr>
                          ))}
                        {matches.length > 0 && (
                          <tr className="border-b border-border" aria-label={`Search matches for ${r.name}`}>
                            <td colSpan={5} style={{ padding: 0, backgroundColor: "#FFFFFF" }}>
                              <div className="inline-flex items-center gap-2" style={{ height: 30, paddingLeft: 16, paddingRight: 16 }}>
                                <CornerDownRight className="w-3.5 h-3.5" style={{ color: "#B45309" }} />
                                <span style={{ fontSize: "12.5px", fontWeight: 400, color: "#B45309" }}>{formatMatches(matches)}</span>
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

      <ImportWizardModal
        spec={spec}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        validationContext={validationContext}
        referenceOptions={host.referenceOptions}
        onApplied={(o) => {
          host.onApplied(o);
        }}
        onImportCompleted={() => {
          setVersion((v) => v + 1);
          toast.success("Import recorded in history");
        }}
      />
    </div>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
