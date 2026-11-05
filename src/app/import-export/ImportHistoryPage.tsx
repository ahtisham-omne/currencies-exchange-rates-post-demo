/* Import history for the Items module at /items/imports (port of role-zen's
 * DataImportDetailPage for one module): header card with a "New Import" CTA,
 * search, density, the File Name / Description / Imported By / Imported On /
 * Results table with nested correction rows, "Awaiting file" chips, search
 * match sub-rows and the shared pagination bar. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  CornerDownRight,
  FileInput,
  FileUp,
  Mail,
  Minus,
  Pencil,
  Phone,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useItems } from "@/app/context/ItemsContext";
import { ITEMS_IMPORT_SPEC } from "./spec";
import { buildValidationContext } from "./validation";
import {
  getImporter,
  getPendingCorrections,
  HISTORY_KEY,
  listImports,
  loadImportDetail,
  subscribeToPendingCorrections,
  type CompletedImportEntry,
  type Importer,
} from "./importHistory";
import { DensityDropdown, type Density } from "./density";
import { Pagination } from "./Pagination";
import { HighlightMatch } from "./HighlightMatch";
import { ImportWizardModal } from "./ImportWizardModal";
import { ItemsTopBar } from "./ItemsTopBar";

const HIGHLIGHT_CLASS = "bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5";
const FROZEN_SEAM = "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)";
const RESULT_CHIP_TOKENS = {
  success: { bg: "#ECFDF5", text: "#065F46", border: "#D1FAE5" },
  failed: { bg: "#FEF2F2", text: "#991B1B", border: "#FEE2E2" },
} as const;

interface ImportRow {
  id: string;
  name: string;
  fileName: string;
  description: string;
  dateISO: string;
  importer: Importer;
  importedCount: number;
  failedCount: number;
  correctionKind?: "inline" | "reimport";
  awaitingCorrection: boolean;
  children: ImportRow[];
}

function toRow(e: CompletedImportEntry, pending: Record<string, unknown>, children: ImportRow[] = []): ImportRow {
  return {
    id: e.id,
    name: e.fileName ?? e.name,
    fileName: e.fileName ?? e.name,
    description: e.description ?? "",
    dateISO: e.dateISO,
    importer: getImporter(e.importerKey),
    importedCount: e.importedCount ?? 0,
    failedCount: e.failedCount ?? 0,
    correctionKind: e.correctionKind,
    awaitingCorrection: !e.parentId && !!pending[e.id],
    children,
  };
}

function buildImportsList(): ImportRow[] {
  const entries = listImports();
  const pending = getPendingCorrections();
  const childrenOf = new Map<string, CompletedImportEntry[]>();
  for (const e of entries) {
    if (!e.parentId) continue;
    const list = childrenOf.get(e.parentId) ?? [];
    list.push(e);
    childrenOf.set(e.parentId, list);
  }
  return entries
    .filter((e) => !e.parentId)
    .map((e) =>
      toRow(
        e,
        pending,
        (childrenOf.get(e.id) ?? []).sort((a, b) => b.dateISO.localeCompare(a.dateISO)).map((c) => toRow(c, pending)),
      ),
    )
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

/** Records inside an import that match the search (so an import surfaces when a row inside it does). */
function recordMatches(importId: string, q: string): string[] {
  const detail = loadImportDetail(importId);
  if (!detail) return [];
  const out: string[] = [];
  for (const r of detail.records) {
    if (r.partNumber.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)) out.push(`${r.partNumber || "row"} (row ${r._row})`);
  }
  return out;
}

function formatMatchIndicator(labels: string[]): string {
  if (labels.length === 1) return `Contains match: ${labels[0]}`;
  const shown = labels.slice(0, 3).join(", ");
  return labels.length <= 3 ? `Contains ${labels.length} matches: ${shown}` : `Contains ${labels.length} matches: ${shown} +${labels.length - 3} more`;
}

/* ─── Small parts ─── */

export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-11 h-11 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-colors"
    >
      <ChevronLeft className="w-5 h-5 text-slate-400" />
    </button>
  );
}

export function ImporterOverviewCard({ importer }: { importer: Importer }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white">
      <div className="relative px-4 py-4 overflow-hidden" style={{ backgroundColor: "#1B2637" }}>
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: importer.bg }}>
            <span style={{ fontSize: "15px", fontWeight: 600, color: importer.fg }}>{importer.initials}</span>
          </div>
          <div className="min-w-0">
            <div className="text-white truncate" style={{ fontSize: "15px", fontWeight: 600 }}>
              {importer.name}
            </div>
            <div className="mt-0.5 truncate" style={{ fontSize: "12.5px", color: "#94A3B8" }}>
              {importer.role}
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 shrink-0" style={{ color: "#94A3B8" }} />
          <span style={{ fontSize: "13px", color: "#334155" }}>{importer.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 shrink-0" style={{ color: "#94A3B8" }} />
          <span style={{ fontSize: "13px", color: "#334155" }}>{importer.phone}</span>
        </div>
      </div>
    </div>
  );
}

function ResultChip({ tone, children }: { tone: keyof typeof RESULT_CHIP_TOKENS; children: React.ReactNode }) {
  const t = RESULT_CHIP_TOKENS[tone];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full border whitespace-nowrap"
      style={{ backgroundColor: t.bg, color: t.text, borderColor: t.border, fontSize: "12px", fontWeight: 500 }}
    >
      {children}
    </span>
  );
}

function AwaitingFileChip() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0"
      style={{ backgroundColor: "#FFFBEB", color: "#B45309", borderColor: "#FDE68A", fontSize: "11.5px", fontWeight: 500 }}
      title="The error rows were downloaded. Open this import to upload the corrected file."
    >
      <Upload className="w-3 h-3" />
      Awaiting file
    </span>
  );
}

function ExpandToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={expanded ? "Hide corrections" : "Show corrections"}
      className={`w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
        expanded ? "bg-[#0A77FF] text-white" : "border border-[#BFDBFE] bg-white text-[#0A77FF] hover:bg-[#EFF6FF]"
      }`}
    >
      {expanded ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
    </button>
  );
}

function Th({ children, first, width }: { children: React.ReactNode; first?: boolean; width?: string }) {
  return (
    <th
      className={`text-left align-middle pl-4 pr-2 whitespace-nowrap ${first ? "sticky left-0 z-20 bg-[#F8FAFC]" : ""}`}
      style={{ fontSize: "13px", fontWeight: 400, color: "#475569", lineHeight: 1.2, width, boxShadow: first ? FROZEN_SEAM : undefined }}
    >
      {children}
    </th>
  );
}

function TrailingCells({ row, query }: { row: ImportRow; query: string }) {
  return (
    <>
      <td>
        {row.description ? (
          <span className="text-[#334155] truncate block" style={{ fontSize: "14px", fontWeight: 400 }}>
            <HighlightMatch text={row.description} query={query} matchClassName={HIGHLIGHT_CLASS} />
          </span>
        ) : (
          <span className="text-[#CBD5E1]">-</span>
        )}
      </td>
      <td>
        <HoverCard openDelay={120} closeDelay={80}>
          <div className="flex items-center gap-2 min-w-0">
            <HoverCardTrigger asChild>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
                style={{ backgroundColor: row.importer.bg }}
                aria-label={row.importer.name}
                onClick={(e) => e.stopPropagation()}
              >
                <span style={{ fontSize: "10.5px", fontWeight: 600, color: row.importer.fg }}>{row.importer.initials}</span>
              </div>
            </HoverCardTrigger>
            <HoverCardTrigger asChild>
              <span
                className="text-[#334155] truncate cursor-pointer hover:text-[#0A77FF] hover:underline underline-offset-2"
                style={{ fontSize: "14px", fontWeight: 500 }}
                onClick={(e) => e.stopPropagation()}
              >
                <HighlightMatch text={row.importer.name} query={query} matchClassName={HIGHLIGHT_CLASS} />
              </span>
            </HoverCardTrigger>
          </div>
          <HoverCardContent side="bottom" align="start" sideOffset={8} className="w-[320px] p-0 rounded-xl border border-[#E2E8F0] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)]">
            <ImporterOverviewCard importer={row.importer} />
          </HoverCardContent>
        </HoverCard>
      </td>
      <td>
        <span style={{ fontSize: "14px", fontWeight: 400, color: "#334155" }}>{format(new Date(row.dateISO), "MMM dd, yyyy")}</span>
      </td>
      <td>
        <div className="flex items-center gap-1.5 min-w-0">
          <ResultChip tone="success">{row.importedCount} imported</ResultChip>
          {row.failedCount > 0 && <ResultChip tone="failed">{row.failedCount} failed</ResultChip>}
        </div>
      </td>
    </>
  );
}

/* ─── Page ─── */

export default function ImportHistoryPage() {
  const navigate = useNavigate();
  const { items } = useItems();
  const spec = ITEMS_IMPORT_SPEC;
  const [importsList, setImportsList] = useState<ImportRow[]>(() => buildImportsList());
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [density, setDensity] = useState<Density>("condensed");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [wizardOpen, setWizardOpen] = useState(false);

  const refresh = useCallback(() => setImportsList(buildImportsList()), []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === HISTORY_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    const unsub = subscribeToPendingCorrections(refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      unsub();
    };
  }, [refresh]);

  const validationContext = useMemo(() => buildValidationContext(items, spec), [items, spec]);

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => {
    const matches = (r: ImportRow) => !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.importer.name.toLowerCase().includes(q);
    const out: { row: ImportRow; subMatches: string[] }[] = [];
    for (const r of importsList) {
      const direct = matches(r) || r.children.some(matches);
      const subMatches = q && !direct ? recordMatches(r.id, q) : [];
      if (direct || subMatches.length) out.push({ row: r, subMatches });
    }
    out.sort((a, b) => (sortDir === "desc" ? b.row.dateISO.localeCompare(a.row.dateISO) : a.row.dateISO.localeCompare(b.row.dateISO)));
    return out;
  }, [importsList, q, sortDir]);

  const totalPages = Number.isFinite(recordsPerPage) ? Math.max(1, Math.ceil(visible.length / recordsPerPage)) : 1;
  const safePage = Math.min(currentPage, totalPages);
  const paged = Number.isFinite(recordsPerPage) ? visible.slice((safePage - 1) * recordsPerPage, safePage * recordsPerPage) : visible;
  const rowHeightClass = density === "comfort" ? "h-[52px]" : "h-[36px]";
  const openRecord = (id: string) => navigate(spec.routes.record.replace(":importId", id));

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      <ItemsTopBar crumbs={[{ label: "Items & Inventory", to: "/dashboard" }, { label: "Items", to: "/items" }, { label: "Import History" }]} />
      <div className="shrink-0 px-6 lg:px-8 pt-4 mx-auto w-full" style={{ maxWidth: "1400px" }}>
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between gap-4" style={{ padding: "12px 16px" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <BackButton onClick={() => navigate(spec.routes.listing)} label={`Back to ${spec.nouns.titlePlural} Library`} />
              <div
                className="w-11 h-11 rounded-xl border border-white flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#EDF4FF", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 0 0 2px rgba(10,119,255,0.10)" }}
              >
                <FileInput className="w-5 h-5" style={{ color: "#0A77FF" }} />
              </div>
              <div className="min-w-0">
                <h1 className="text-[#0F172A] truncate" style={{ fontSize: "16px", fontWeight: 700, lineHeight: "22px" }}>
                  Import History
                </h1>
                <p className="text-[12px] text-slate-500 leading-[1.6]" style={{ marginTop: 2 }}>
                  Every spreadsheet import into {spec.nouns.titlePlural}, with its results and corrections.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center justify-center h-9 gap-1.5 px-4 text-[13px] rounded-lg text-white shadow-sm transition-all duration-200 cursor-pointer hover:bg-[#0862D0] shrink-0"
              style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />
              New Import
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-6 lg:px-8 py-4 mx-auto w-full" style={{ maxWidth: "1400px" }}>
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#CBD5E1" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by name, or user..."
                className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-border/80 shadow-sm rounded-md placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/20 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-[#64748B] tabular-nums">
                {visible.length} {visible.length === 1 ? "import" : "imports"}
              </span>
              <DensityDropdown density={density} onChange={setDensity} />
            </div>
          </div>
          <div className="shrink-0 border-t border-[#E2E8F0]" />

          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full border-collapse" style={{ minWidth: "1080px", tableLayout: "fixed" }}>
              <thead className="sticky top-0 z-20 bg-white">
                <tr className="bg-[#F1F5F9]/30 border-b border-[#E2E8F0] [&>th]:h-11">
                  <Th first width="26%">
                    <span className="flex items-center gap-2">
                      <span className="w-5 shrink-0" aria-hidden />
                      File Name
                    </span>
                  </Th>
                  <Th width="28%">Description</Th>
                  <Th width="200px">Imported By</Th>
                  <Th width="200px">
                    <button
                      type="button"
                      onClick={() => {
                        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                        setCurrentPage(1);
                      }}
                      className="inline-flex items-center gap-1 hover:text-[#0F172A] transition-colors cursor-pointer"
                      style={{ font: "inherit" }}
                      aria-label={`Sort by imported date, currently ${sortDir === "desc" ? "newest" : "oldest"} first`}
                    >
                      Imported On
                      {sortDir === "desc" ? <ArrowDown className="w-3 h-3" style={{ color: "#0A77FF" }} /> : <ArrowUp className="w-3 h-3" style={{ color: "#0A77FF" }} />}
                    </button>
                  </Th>
                  <Th width="200px">Results</Th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-[#9CA3AF]">
                        <Search className="w-8 h-8 text-[#D1D5DB]" />
                        <span className="text-sm" style={{ fontWeight: 500, color: "#6B7280" }}>
                          No Imports Found
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                {paged.map(({ row, subMatches }) => {
                  const isExpanded = expanded.has(row.id);
                  const showChildren = isExpanded && row.children.length > 0;
                  return (
                    <RowGroup key={row.id}>
                      <tr
                        onClick={() => openRecord(row.id)}
                        className={`group cursor-pointer transition-colors hover:bg-[#F0F7FF] ${rowHeightClass} [&>td]:pl-4 [&>td]:pr-2 [&>td]:align-middle ${
                          !showChildren && subMatches.length === 0 ? "border-b border-[#E2E8F0]" : ""
                        }`}
                      >
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#F0F7FF]" style={{ boxShadow: FROZEN_SEAM }}>
                          <div className="flex items-center gap-2 min-w-0">
                            {row.children.length > 0 ? (
                              <ExpandToggle
                                expanded={isExpanded}
                                onToggle={() =>
                                  setExpanded((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(row.id)) next.delete(row.id);
                                    else next.add(row.id);
                                    return next;
                                  })
                                }
                              />
                            ) : (
                              <span className="w-5 shrink-0" aria-hidden />
                            )}
                            <span className="truncate block" style={{ fontSize: "14px", fontWeight: 500, color: "#1E293B" }} title={row.fileName}>
                              <HighlightMatch text={row.name} query={search} matchClassName={HIGHLIGHT_CLASS} />
                            </span>
                            {row.awaitingCorrection && <AwaitingFileChip />}
                          </div>
                        </td>
                        <TrailingCells row={row} query={search} />
                      </tr>
                      {showChildren &&
                        row.children.map((child, ci) => {
                          const last = ci === row.children.length - 1 && subMatches.length === 0;
                          const reimport = child.correctionKind === "reimport";
                          const Glyph = reimport ? FileUp : Pencil;
                          return (
                            <tr
                              key={child.id}
                              onClick={() => openRecord(child.id)}
                              aria-label={reimport ? `Corrected file re-imported into ${row.fileName}` : `Inline correction of ${row.fileName}`}
                              className={`group cursor-pointer transition-colors bg-[#F8FAFF] hover:bg-[#F0F7FF] ${rowHeightClass} [&>td]:pl-4 [&>td]:pr-2 [&>td]:align-middle ${last ? "border-b border-[#E2E8F0]" : ""}`}
                            >
                              <td className="sticky left-0 z-10 bg-[#F8FAFF] group-hover:bg-[#F0F7FF]" style={{ boxShadow: FROZEN_SEAM }}>
                                <div className="flex items-center gap-2 min-w-0 pl-7">
                                  <CornerDownRight className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                                  <Glyph className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} aria-label={reimport ? "Re-imported file" : "Fixed in place"} />
                                  <span className="truncate block" style={{ fontSize: "14px", fontWeight: 500, color: "#475569" }} title={child.fileName}>
                                    <HighlightMatch text={child.name} query={search} matchClassName={HIGHLIGHT_CLASS} />
                                  </span>
                                </div>
                              </td>
                              <TrailingCells row={child} query={search} />
                            </tr>
                          );
                        })}
                      {subMatches.length > 0 && (
                        <tr className="border-b border-[#E2E8F0]" aria-label={`Search matches for ${row.name}`}>
                          <td colSpan={5} style={{ padding: 0, backgroundColor: "#FFFFFF" }}>
                            <div className="inline-flex items-center gap-2" style={{ height: 30, paddingLeft: 16, paddingRight: 16 }}>
                              <CornerDownRight className="w-3.5 h-3.5" style={{ color: "#B45309" }} />
                              <span style={{ fontSize: "12.5px", fontWeight: 400, color: "#B45309" }}>{formatMatchIndicator(subMatches)}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </RowGroup>
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

      <ImportWizardModal open={wizardOpen} onClose={() => setWizardOpen(false)} onImportCompleted={refresh} validationContext={validationContext} />
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
