import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  Search,
  X,
  Plus,
  Mail,
  Phone,
  CornerDownRight,
  Plus as PlusIcon,
  Minus as MinusIcon,
  Pencil,
  FileUp,
  Upload,
} from "lucide-react";
import { TooltipProvider } from "../ui/tooltip";
import { cn } from "../ui/utils";
import { HeaderTabs } from "../shared/HeaderTabs";
import { resolveImportSurface } from "./moduleData";
import { ImportWizardModal } from "./import-wizard/ImportWizardModal";
import { TEMPLATE_ONLY_MODULES, isTemplateOnlySlug, seedTemplateOnlyImports } from "./templateOnlyModules";
import { renderModuleReview } from "./modules/renderModuleReview";
import { getModuleImport, type ModuleRecord } from "./modules/moduleImportStore";
import { UsersImportWizard } from "./import-wizard/UsersImportWizard";
import { RolesImportWizard } from "./import-wizard/RolesImportWizard";
import { getCompletedImports, ensureSeededForLoad } from "./importHistory";
import { getPendingCorrections, subscribeToPendingCorrections } from "./pendingCorrections";
import { getImportDetail } from "./importDetailStore";
import { getRolesImportDetail } from "./rolesImportDetailStore";
import { QuotesImportWizard, seedQuotesImports } from "./quotes/QuotesImportSurface";
import { SalesOrdersImportWizard, seedSalesOrdersImports } from "./sales-orders/SalesOrdersImportSurface";
import { getSheetImport } from "./sheet-import/sheetImportStore";
import type { SheetRow } from "./sheet-import/sheetRecords";
import type { ImportedUserRow } from "./importRecords";
import type { ImportedRoleRow } from "./rolesImportRecords";
import { getImporter, type Importer } from "./importers";
import { Pagination } from "./Pagination";
import { HighlightMatch } from "../alerts-settings/HighlightMatch";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card";
import { format } from "date-fns";
import { ColumnSelector, ColumnSelectorTrigger } from "../data-table/ColumnSelector";
import { DensityDropdown, ROW_HEIGHT_COMFORT, ROW_HEIGHT_CONDENSED, type DensityOption } from "./density";
import { ExpandWidthButton, WIDTH_TRANSITION_CLASS, useExpandedWidth } from "./ExpandWidthButton";
import { ImportColumnHeaderMenu } from "./table-columns/ImportColumnHeaderMenu";
import { useColumnControls, type ControlledColumn } from "./table-columns/useColumnControls";

const HIGHLIGHT_CLASS = "bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5";
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/* ────────────────────────────────────
   Types
   ──────────────────────────────────── */

interface ImportRow {
  id: string;
  /** Display name used for search + the Filename column (the uploaded file). */
  name: string;
  /** The uploaded file's name, shown in the Filename column. */
  fileName: string;
  /** Free-text description entered at import time. Empty when none was given. */
  description: string;
  dateISO: string;
  importer: Importer;
  /** How many records successfully imported. */
  importedCount: number;
  /** Failed + skipped tally: drives the listing's warning-tone "N failed"
   *  count and the detail page's Failed filter. */
  failedCount: number;
  /** Correction logs nested under this import: the fix batches created when
   *  its failed rows were corrected and re-imported. Present only on parent
   *  rows; a parent with children renders an expand toggle. The tree is one
   *  level deep by design, a child never carries children of its own. */
  children?: ImportRow[];
  /** On a child row: how the correction was made. Drives the row glyph so an
   *  audit reader can tell a grid fix from an uploaded file at a glance. */
  correctionKind?: "inline" | "reimport";
  /** On a parent row: its error rows have been downloaded and the corrected
   *  file has not come back yet. Surfaces the same waiting state the import's
   *  own page shows, so the work is visible without drilling in. */
  awaitingCorrection?: boolean;
}

function matchesRecord(rec: ImportedUserRow, q: string): boolean {
  return (
    rec.firstName.toLowerCase().includes(q) ||
    rec.lastName.toLowerCase().includes(q) ||
    rec.emailAddress.toLowerCase().includes(q) ||
    rec.jobTitle.toLowerCase().includes(q)
  );
}

/* Roles-module counterpart of matchesRecord, same underlying-records search,
 * over the role record's identity fields. */
function matchesRoleRecord(rec: ImportedRoleRow, q: string): boolean {
  return (
    rec.roleName.toLowerCase().includes(q) ||
    rec.description.toLowerCase().includes(q) ||
    rec.roleOwner.toLowerCase().includes(q)
  );
}

/** Renders the "Contains match…" whisper shown under an import name when
 *  the search query matched the import's underlying records rather than
 *  its listing-level fields. Each label carries its (row N) reference so
 *  the user can jump straight to the matching record. */
function formatMatchIndicator(labels: string[]): string {
  if (labels.length === 1) {
    return `Contains match: ${labels[0]}`;
  }
  if (labels.length <= 3) {
    return `Contains ${labels.length} matches: ${labels.join(", ")}`;
  }
  const shown = labels.slice(0, 3).join(", ");
  return `Contains ${labels.length} matches: ${shown} +${labels.length - 3} more`;
}

/* ────────────────────────────────────
   Helpers
   ──────────────────────────────────── */

/* Imported On date. Mirrors the Partners listing "Created On" column exactly:
 * date-fns `format(..., "MMM dd, yyyy")` → e.g. "Mar 05, 2026". No time shown. */
function formatImportedOn(iso: string): string {
  try {
    return format(new Date(iso), "MMM dd, yyyy");
  } catch {
    return iso;
  }
}

/* File Name is the pinned leading column (always visible, sort only); the
 * rest can be hidden, frozen after it and reordered from the header or the
 * Columns panel. The last scrolling column absorbs spare width. */
/* Widths sum to 1080, the table's original minimum, so every column fits the
 * default 1400px page without scrolling. */
const FILE_COL_WIDTH = 260;
const FILE_COL_KEY = "fileName";
/* Results holds two chips ("13 imported", "30 failed"), so it gets the room. */
const HISTORY_COLUMNS: ControlledColumn[] = [
  { key: "description", label: "Description", width: 260 },
  { key: "importedBy", label: "Imported By", width: 190 },
  { key: "importedOn", label: "Imported On", width: 140 },
  { key: "results", label: "Results", width: 230 },
];
const SELECTOR_COLUMNS = [{ key: FILE_COL_KEY, label: "File Name" }, ...HISTORY_COLUMNS.map(({ key, label }) => ({ key, label }))];
const FROZEN_EDGE_SHADOW = "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)";

function historySortValue(row: ImportRow, key: string): unknown {
  switch (key) {
    case FILE_COL_KEY: return row.fileName;
    case "description": return row.description;
    case "importedBy": return row.importer.name;
    case "importedOn": return new Date(row.dateISO).getTime();
    case "results": return row.importedCount;
    default: return undefined;
  }
}

/* ────────────────────────────────────
   User overview hover card
   ──────────────────────────────────── */

export function UserOverviewCard({ user }: { user: Importer }) {
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
   Page
   ──────────────────────────────────── */

export function DataImportDetailPage() {
  const { moduleSlug = "" } = useParams<{ moduleSlug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  /* A module can own several import surfaces (User Access Control holds Users
   * and Roles). `dataSlug` is what the history and record stores are keyed by;
   * for a single-surface module it is just the card's slug.
   *
   * The active tab is carried in `?tab=` rather than in the path. The Layout
   * cross-fades the whole page on any `location.pathname` change, so routing
   * tab clicks through the path made the header and table blink on every
   * switch. A search param leaves the pathname untouched, so the tab swap is
   * instant. A tab slug in the path still resolves (`/data-imports/users`) so
   * older deep links keep landing on the right tab. */
  const surface = resolveImportSurface(moduleSlug);
  const moduleDef = surface?.card;
  const tabs = moduleDef?.tabs;
  const tabParam = searchParams.get("tab");
  const activeTab =
    tabs?.find((t) => t.slug === tabParam) ?? surface?.tab ?? tabs?.[0];
  const dataSlug = activeTab?.slug ?? moduleSlug;

  /* All hooks run unconditionally, the early-return for a missing module
   * sits below so React's hook order stays stable across navigations. */
  const [searchQuery, setSearchQuery] = useState("");
  const [density, setDensity] = useState<DensityOption>("condensed");
  const [columnPanelOpen, setColumnPanelOpen] = useState(false);
  const { isExpanded: isWidthExpanded, setIsExpanded: setIsWidthExpanded, containerMaxWidth } = useExpandedWidth();
  const columns = useColumnControls(HISTORY_COLUMNS, { initialSort: { key: "importedOn", direction: "desc" } });
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const buildImportsList = useCallback((): ImportRow[] => {
    /* Reset to the two clean mock entries once per page load (refresh / new
     * session); a no-op on subsequent in-session calls so this session's own
     * imports persist across navigation. */
    /* Quotes and Sales Orders keep their rows in the sheet store (one row per
     * line item under a record), so they seed their own history rather than the
     * Users-shaped mocks. */
    if (dataSlug === "quotes") seedQuotesImports();
    else if (dataSlug === "sales-orders") seedSalesOrdersImports();
    /* Item Library, Categories, Partners, Partner Group keep their records
     * in the module store, so they seed their own history + records. */
    else if (isTemplateOnlySlug(dataSlug)) seedTemplateOnlyImports(dataSlug);
    else ensureSeededForLoad(dataSlug);

    /* Every row comes from a real completed import. The displayed name is
     * the file the user actually uploaded; pre-fileName entries fall back to
     * the import's stored name. */
    const pending = getPendingCorrections(dataSlug);
    const toRow = (e: ReturnType<typeof getCompletedImports>[number]): ImportRow => ({
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
    });

    const entries = getCompletedImports(dataSlug);
    /* Correction logs nest under their parent import instead of appearing as
     * their own top-level row. Group children by parentId, then attach them to
     * the parent (newest correction first). */
    const childrenByParent = new Map<string, ImportRow[]>();
    for (const e of entries) {
      if (!e.parentId) continue;
      const arr = childrenByParent.get(e.parentId) ?? [];
      arr.push(toRow(e));
      childrenByParent.set(e.parentId, arr);
    }
    return entries
      .filter((e) => !e.parentId)
      .map<ImportRow>((e) => {
        const children = (childrenByParent.get(e.id) ?? []).sort(
          (a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime(),
        );
        return { ...toRow(e), children };
      });
  }, [dataSlug]);
  const [importsList, setImportsList] = useState<ImportRow[]>(() => buildImportsList());
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  /* Which parent imports have their nested correction logs expanded. */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* Rebuild when the module changes (the list is per-module) and when the
   * backing localStorage changes from ANOTHER tab, an import completed in
   * one tab must show up in a Data Imports page already open elsewhere.
   * The `storage` event only fires for cross-tab writes; same-tab imports
   * refresh via the wizard's onImportCompleted callback below. */
  useEffect(() => {
    setImportsList(buildImportsList());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "omne:import-history") {
        setImportsList(buildImportsList());
      }
    };
    window.addEventListener("storage", onStorage);
    /* The waiting cue lives in a separate store, and an import's own page
     * can arm or clear it while this listing sits behind it in the history
     * stack. Subscribe so the chip never goes stale. */
    const unsubscribePending = subscribeToPendingCorrections(() => setImportsList(buildImportsList()));
    return () => {
      window.removeEventListener("storage", onStorage);
      unsubscribePending();
    };
  }, [buildImportsList]);

  /* Switching tabs swaps the whole listing, so the search and page position
   * from the previous tab would otherwise carry over onto unrelated rows. */
  useEffect(() => {
    setSearchQuery("");
    setCurrentPage(1);
    setExpandedIds(new Set());
  }, [dataSlug]);

  /* Per-import record payloads, sourced from the same stored detail the
   * drill-down page renders, so the listing's underlying-records search
   * matches exactly what the user sees after clicking in. The Roles module
   * reads from its own detail store (role-shaped records); every other
   * module keeps the Users-shaped store. */
  const recordsByImport = useMemo(() => {
    const map = new Map<string, ImportedUserRow[] | ImportedRoleRow[] | SheetRow[] | ModuleRecord[]>();
    for (const row of importsList) {
      if (isTemplateOnlySlug(dataSlug)) {
        const detail = getModuleImport(row.id);
        if (detail) map.set(row.id, detail.records);
      } else if (dataSlug === "quotes" || dataSlug === "sales-orders") {
        const detail = getSheetImport(row.id);
        if (detail) map.set(row.id, detail.rows);
      } else if (dataSlug === "roles") {
        const detail = getRolesImportDetail(row.id);
        if (detail) map.set(row.id, detail.records);
      } else {
        const detail = getImportDetail(row.id);
        if (detail) map.set(row.id, detail.records);
      }
    }
    return map;
  }, [importsList, dataSlug]);

  /* Newest first underneath, then the header-menu sort on top (stable), so
   * clearing the sort falls back to the default Imported On order. */
  const { sortRows } = columns;
  const sortedRows = useMemo(() => {
    const byDate = [...importsList].sort(
      (a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime(),
    );
    return sortRows(byDate, historySortValue);
  }, [importsList, sortRows]);

  /* When the listing-level fields (import name, importer) don't match, fall
   * back to searching inside the import's underlying records. Rows that
   * survive only via the underlying-records pass carry a `matches` payload
   * (pre-labelled per module) so the row renderer can show the "Contains
   * match…" whisper. Listing-level matches stay clean, no indicator. */
  const filteredRows = useMemo<Array<{ row: ImportRow; matches: string[] | null }>>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedRows.map((row) => ({ row, matches: null }));

    const out: Array<{ row: ImportRow; matches: string[] | null }> = [];
    for (const row of sortedRows) {
      const directMatch =
        row.name.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.importer.name.toLowerCase().includes(q);
      if (directMatch) {
        out.push({ row, matches: null });
        continue;
      }
      const records = recordsByImport.get(row.id);
      if (!records) continue;
      const moduleDef_ = isTemplateOnlySlug(dataSlug) ? TEMPLATE_ONLY_MODULES[dataSlug].def : null;
      const hits =
        moduleDef_
          ? (records as ModuleRecord[])
              .filter((rec) => moduleDef_.columns.some((c) => String(rec[c.key] ?? "").toLowerCase().includes(q)))
              .map((rec) => `${String(rec[moduleDef_.keyField] ?? "") || "row"} (row ${rec._row})`)
          : dataSlug === "quotes" || dataSlug === "sales-orders"
          ? (records as SheetRow[])
              .filter((rec) => Object.values(rec.values).some((v) => v.toLowerCase().includes(q)))
              .map((rec) => `${rec._key || "row"} (row ${rec._row})`)
          : dataSlug === "roles"
          ? (records as ImportedRoleRow[])
              .filter((rec) => matchesRoleRecord(rec, q))
              .map((rec) => `${rec.roleName} (row ${rec._row})`)
          : (records as ImportedUserRow[])
              .filter((rec) => matchesRecord(rec, q))
              .map((rec) => `${rec.firstName} ${rec.lastName} (row ${rec._row})`);
      if (hits.length > 0) out.push({ row, matches: hits });
    }
    return out;
  }, [sortedRows, searchQuery, recordsByImport, dataSlug]);

  const totalPages = Number.isFinite(recordsPerPage)
    ? Math.max(1, Math.ceil(filteredRows.length / recordsPerPage))
    : 1;
  const pagedRows = useMemo(() => {
    if (!Number.isFinite(recordsPerPage)) return filteredRows;
    const start = (currentPage - 1) * recordsPerPage;
    return filteredRows.slice(start, start + recordsPerPage);
  }, [filteredRows, currentPage, recordsPerPage]);

  if (!moduleDef) {
    return (
      <div className="flex flex-col h-full bg-[#F8FAFC] items-center justify-center">
        <p className="text-[#64748B] mb-3" style={{ fontSize: "14px" }}>Module Not Found.</p>
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

  const Icon = moduleDef.icon;
  /* Item Library, Categories, Partners, Partner Group: the Users page, the
   * Users Import modal and the Users review, configured per module. */
  const templateOnly = isTemplateOnlySlug(dataSlug) ? TEMPLATE_ONLY_MODULES[dataSlug] : null;
  const importButtonLabel = activeTab?.importLabel ?? (moduleDef.importLabel ?? "Import data");

  const onColumnSort: typeof columns.onSort = (key, direction) => {
    columns.onSort(key, direction);
    setCurrentPage(1);
  };
  const { visibleColumns, frozenColumns, scrollColumns } = columns;
  const frozenLeft = columns.frozenLefts(FILE_COL_WIDTH);
  const lastFrozenKey = frozenColumns.length > 0 ? frozenColumns[frozenColumns.length - 1].key : null;
  /* The last scrolling column takes up spare width; every other column keeps
   * its exact width so the frozen offsets stay true. */
  const flexKey = scrollColumns.length > 0 ? scrollColumns[scrollColumns.length - 1].key : null;
  const tableMinWidth = FILE_COL_WIDTH + visibleColumns.reduce((acc, c) => acc + c.width, 0);
  const rowHeight = density === "comfort" ? ROW_HEIGHT_COMFORT : ROW_HEIGHT_CONDENSED;
  const columnVisibility: Record<string, boolean> = { [FILE_COL_KEY]: true };
  for (const c of HISTORY_COLUMNS) columnVisibility[c.key] = !columns.hidden.has(c.key);
  const cellLayout = { columns: visibleColumns, frozenLeft, lastFrozenKey, density };

  return (
   <TooltipProvider delayDuration={200}>
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* Page header */}
      <div className={cn("shrink-0 px-6 lg:px-8 pt-4", WIDTH_TRANSITION_CLASS)} style={{ maxWidth: containerMaxWidth }}>
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between gap-4" style={{ padding: "12px 16px" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => navigate("/company-settings/data-imports")}
                className="w-11 h-11 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-colors"
                aria-label="Back to Data Imports"
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
                <Icon className="w-5 h-5" style={{ color: "#0A77FF" }} />
              </div>
              <div className="min-w-0">
                <h1 className="text-[#0F172A] truncate" style={{ fontSize: "16px", fontWeight: 700, lineHeight: "22px" }}>
                  {moduleDef.title}
                </h1>
                <p className="text-[12px] text-slate-500 leading-[1.6]" style={{ marginTop: 6 }}>
                  {moduleDef.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ExpandWidthButton isExpanded={isWidthExpanded} onToggle={() => setIsWidthExpanded((v) => !v)} />
              <button
                type="button"
                onClick={() => setIsWizardOpen(true)}
                className="inline-flex items-center justify-center h-9 gap-1.5 px-4 text-[13px] rounded-lg text-white shadow-sm transition-all duration-200 cursor-pointer hover:bg-[#0862D0]"
                style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
              >
                <Plus className="w-3.5 h-3.5" />
                {/* On a tabbed module the label follows the active tab, so the
                    primary action always names what it will import. */}
                {importButtonLabel}
              </button>
            </div>
          </div>

          {/* Tab strip — shared with the User Access Control page header, so the
              hairline above the tabs and the active underline read identically.
              Switching writes `?tab=`, keeping the tab deep-linkable without
              touching the pathname the Layout animates on. */}
          {tabs && tabs.length > 1 && (
            <HeaderTabs
              tabs={tabs.map((t) => ({ id: t.slug, label: t.label }))}
              value={activeTab?.slug ?? tabs[0].slug}
              onChange={(slug) => setSearchParams({ tab: slug }, { replace: true })}
            />
          )}
        </div>
      </div>

      {/* Content card */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          className={cn("flex-1 min-h-0 flex flex-col px-6 lg:px-8 py-4", WIDTH_TRANSITION_CLASS)}
          style={{ maxWidth: containerMaxWidth }}
        >
          {/* Content-only cross-fade on tab change, same treatment as the User
              Access Control page's tab panels: keyed on the active surface,
              mode="wait", 0.12s easeOut. Scoped to the card so the header and
              tab strip stay put — the Layout's page-level fade is what made
              switching tabs blink the whole screen. */}
          <AnimatePresence mode="wait">
          <motion.div
            key={dataSlug}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="flex flex-1 min-h-0 flex-col"
          >
          <div className="flex-1 min-h-0 flex flex-col bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden">
            {/* Toolbar: search + count */}
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#CBD5E1" }} />
                <input
                  type="text"
                  placeholder="Search by name, or user..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-border/80 shadow-sm rounded-md placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/20 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[13px] text-[#64748B] tabular-nums mr-1">
                  {filteredRows.length} import{filteredRows.length !== 1 ? "s" : ""}
                </span>
                <div className="w-px h-5 bg-[#E2E8F0] mx-1 hidden sm:block" />
                <DensityDropdown density={density} onChange={setDensity} />
                <ColumnSelectorTrigger
                  visibleCount={Object.values(columnVisibility).filter(Boolean).length}
                  active={columnPanelOpen}
                  onClick={() => setColumnPanelOpen((v) => !v)}
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-[#E2E8F0]" />

            {/* Table + Columns side panel (same layout as the UAC listings) */}
            <div className="flex-1 min-h-0 flex">
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full border-collapse" style={{ minWidth: tableMinWidth, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: FILE_COL_WIDTH }} />
                  {visibleColumns.map((c) => (
                    <col key={c.key} style={c.key === flexKey ? undefined : { width: c.width }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-20 bg-white">
                  <tr className={cn("bg-[#F1F5F9]/30 border-b border-[#E2E8F0]", density === "comfort" ? "[&>th]:h-11" : "[&>th]:h-9")}>
                    <Th
                      className="sticky left-0 z-20 bg-[#F8FAFC]"
                      style={lastFrozenKey ? undefined : { boxShadow: FROZEN_EDGE_SHADOW }}
                    >
                      {/* Mirror the cell's expand-toggle spacer + gap so the
                          heading text lines up with the file names below it
                          rather than with the toggle button. */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 shrink-0" aria-hidden />
                        <ImportColumnHeaderMenu columnKey={FILE_COL_KEY} label="File Name" sort={columns.sort} onSort={onColumnSort} />
                      </div>
                    </Th>
                    {visibleColumns.map((col) => {
                      const isFrozen = columns.frozen.has(col.key);
                      return (
                        <Th
                          key={col.key}
                          {...columns.headerDragProps(col.key)}
                          className={cn("group/colheader cursor-grab select-none overflow-hidden", isFrozen && "z-20 bg-[#F8FAFC]")}
                          style={{
                            position: isFrozen ? "sticky" : "relative",
                            ...(isFrozen ? { left: frozenLeft[col.key] } : null),
                            ...(col.key === lastFrozenKey ? { boxShadow: FROZEN_EDGE_SHADOW } : null),
                            ...columns.draggedHeaderStyle(col.key),
                          }}
                        >
                          {columns.dragAdornments(col.key)}
                          <ImportColumnHeaderMenu
                            columnKey={col.key}
                            label={col.label}
                            sort={columns.sort}
                            onSort={onColumnSort}
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
                      <td colSpan={visibleColumns.length + 1} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-[#9CA3AF]">
                          <Search className="w-8 h-8 text-[#D1D5DB]" />
                          <p className="text-sm" style={{ fontWeight: 500, color: "#6B7280" }}>No Imports Found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pagedRows.flatMap(({ row, matches }) => {
                      const children = row.children ?? [];
                      const hasChildren = children.length > 0;
                      const isExpanded = hasChildren && expandedIds.has(row.id);
                      /* A sub-row is shown only when the row survived filtering
                       * by an underlying-records match. */
                      const hasSubRow = !!matches && matches.length > 0;
                      /* The bottom border sits on the LAST rendered row of the
                       * group (parent, or last child, or the match sub-row) so
                       * an expanded import reads as one connected block. */
                      const parentIsLast = !isExpanded && !hasSubRow;
                      const out: React.ReactNode[] = [];

                      out.push(
                        <tr
                          key={row.id}
                          onClick={() => navigate(`/company-settings/data-imports/${dataSlug}/${row.id}`)}
                          className={cn(
                            "import-row-hover cursor-pointer [&>td]:pl-4 [&>td]:pr-2 [&>td]:align-middle",
                            parentIsLast && "border-b border-[#E2E8F0]",
                          )}
                          style={{ height: rowHeight }}
                        >
                          {/* File Name — frozen first column with the single vertical divider.
                              A parent with correction logs shows an expand toggle; otherwise a
                              spacer keeps every file name flush-aligned. */}
                          <td
                            className="sticky left-0 z-10 bg-white"
                            style={lastFrozenKey ? undefined : { boxShadow: FROZEN_EDGE_SHADOW }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {hasChildren ? (
                                <ExpandToggle
                                  expanded={isExpanded}
                                  onClick={(e) => { e.stopPropagation(); toggleExpanded(row.id); }}
                                />
                              ) : (
                                <span className="w-5 shrink-0" aria-hidden />
                              )}
                              <span
                                className="truncate block"
                                style={{ fontSize: "14px", fontWeight: 500, color: "#1E293B" }}
                                title={row.fileName}
                              >
                                <HighlightMatch text={row.fileName} query={searchQuery} matchClassName={HIGHLIGHT_CLASS} />
                              </span>
                              {row.awaitingCorrection && <AwaitingFileChip />}
                            </div>
                          </td>
                          <TrailingCells row={row} searchQuery={searchQuery} stickyBg="#FFFFFF" {...cellLayout} />
                        </tr>
                      );

                      /* Nested correction logs, revealed by the parent's toggle. These
                       * are terminal — no further expansion — so they carry no toggle,
                       * just an indent and a glyph naming how the fix was made. They
                       * are drillable like any other import: each one now carries its
                       * own detail payload. */
                      if (isExpanded) {
                        children.forEach((child, ci) => {
                          const childIsLast = ci === children.length - 1 && !hasSubRow;
                          const ChildGlyph = child.correctionKind === "reimport" ? FileUp : Pencil;
                          out.push(
                            <tr
                              key={child.id}
                              onClick={() => navigate(`/company-settings/data-imports/${dataSlug}/${child.id}`)}
                              className={cn(
                                "import-row-hover cursor-pointer bg-[#F8FAFF] [&>td]:pl-4 [&>td]:pr-2 [&>td]:align-middle",
                                childIsLast && "border-b border-[#E2E8F0]",
                              )}
                              style={{ height: rowHeight }}
                              aria-label={
                                child.correctionKind === "reimport"
                                  ? `Corrected file re-imported into ${row.fileName}`
                                  : `Inline correction of ${row.fileName}`
                              }
                            >
                              <td
                                className="sticky left-0 z-10 bg-[#F8FAFF]"
                                style={lastFrozenKey ? undefined : { boxShadow: FROZEN_EDGE_SHADOW }}
                              >
                                <div className="flex items-center gap-2 min-w-0 pl-7">
                                  <CornerDownRight className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                                  <ChildGlyph
                                    className="w-3.5 h-3.5 shrink-0"
                                    style={{ color: "#94A3B8" }}
                                    aria-label={child.correctionKind === "reimport" ? "Re-imported file" : "Fixed in place"}
                                  />
                                  <span
                                    className="truncate block"
                                    style={{ fontSize: "14px", fontWeight: 500, color: "#475569" }}
                                    title={child.fileName}
                                  >
                                    <HighlightMatch text={child.fileName} query={searchQuery} matchClassName={HIGHLIGHT_CLASS} />
                                  </span>
                                </div>
                              </td>
                              <TrailingCells row={child} searchQuery={searchQuery} stickyBg="#F8FAFF" {...cellLayout} />
                            </tr>
                          );
                        });
                      }

                      /* Sub-row paddingLeft matches the File Name column's `pl-4`
                       * (16px) so the icon and message line up flush with the
                       * text in the row above. */
                      if (hasSubRow) {
                        out.push(
                          <tr
                            key={`${row.id}-sub`}
                            className="border-b border-[#E2E8F0]"
                            aria-label={`Search matches for ${row.name}`}
                          >
                            <td colSpan={visibleColumns.length + 1} style={{ padding: 0, backgroundColor: "#FFFFFF" }}>
                              <div
                                className="inline-flex items-center gap-2"
                                style={{ height: 30, paddingLeft: 16, paddingRight: 16 }}
                              >
                                <CornerDownRight className="w-3.5 h-3.5 shrink-0" style={{ color: "#B45309" }} />
                                <span
                                  className="whitespace-nowrap"
                                  style={{ fontSize: "12.5px", fontWeight: 400, color: "#B45309" }}
                                >
                                  {formatMatchIndicator(matches!)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return out;
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
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              allowAll
            />
            </div>
            <ColumnSelector
              columns={SELECTOR_COLUMNS}
              columnOrder={[FILE_COL_KEY, ...columns.order]}
              columnVisibility={columnVisibility}
              onColumnOrderChange={(next) => columns.setOrder(next.filter((k) => k !== FILE_COL_KEY))}
              onColumnVisibilityChange={(next) => {
                for (const c of HISTORY_COLUMNS) {
                  const visible = next[c.key] !== false;
                  if (visible === !columns.hidden.has(c.key)) continue;
                  /* Hiding goes through onHide so sort + freeze clear, exactly
                   * as the header menu's Hide does. */
                  if (visible) columns.toggleHidden(c.key);
                  else columns.onHide(c.key);
                }
              }}
              lockedColumns={[FILE_COL_KEY]}
              open={columnPanelOpen}
              onOpenChange={setColumnPanelOpen}
            />
            </div>
          </div>
          </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>

    {columns.ghost}
    {templateOnly ? (
      /* The Import Users modal, configured for this module. Review Data opens
       * the Users review with the module's columns and rules. */
      <ImportWizardModal
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onImportCompleted={() => setImportsList(buildImportsList())}
        recordTypeLabel={templateOnly.entities}
        moduleSlug={dataSlug}
        descriptionPlacement="bottom"
        title={templateOnly.title}
        description={templateOnly.subtitle}
        template={templateOnly.templateConfig}
        parseFile={templateOnly.parseFile}
        descriptionPlaceholder={templateOnly.descriptionPlaceholder}
        renderReview={renderModuleReview(templateOnly.def, dataSlug)}
      />
    ) : dataSlug === "quotes" ? (
      /* Quotes runs the shared sheet-import wizard against its own column
       * contract: same upload, review and fix loop as every other surface. */
      <QuotesImportWizard
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onImportCompleted={() => setImportsList(buildImportsList())}
      />
    ) : dataSlug === "sales-orders" ? (
      <SalesOrdersImportWizard
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onImportCompleted={() => setImportsList(buildImportsList())}
      />
    ) : dataSlug === "users" ? (
      /* Users runs the exact same Import Users modal as User Access Control,
       * shared component, shared validation context, shared post-import fold
       * into the users listing. */
      <UsersImportWizard
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onImportCompleted={() => setImportsList(buildImportsList())}
      />
    ) : dataSlug === "roles" ? (
      /* Roles runs the exact same Import Roles modal as User Access Control,
       * shared component, shared validation context, shared post-import fold
       * into the roles listing. */
      <RolesImportWizard
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onImportCompleted={() => setImportsList(buildImportsList())}
      />
    ) : (
      <ImportWizardModal
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onImportCompleted={() => setImportsList(buildImportsList())}
        recordTypeLabel={moduleDef.title}
        moduleSlug={dataSlug}
      />
    )}
   </TooltipProvider>
  );
}

/* ────────────────────────────────────
   Sub-components
   ──────────────────────────────────── */

/* Circular expand/collapse control shown in front of a parent import that has
 * nested correction logs. Filled blue with a minus when open, outlined with a
 * plus when closed — mirrors the tree toggle in the Location & Warehouse module. */
function ExpandToggle({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 transition-colors",
        expanded
          ? "bg-[#0A77FF] text-white"
          : "border border-[#BFDBFE] bg-white text-[#0A77FF] hover:bg-[#EFF6FF]",
      )}
      aria-label={expanded ? "Hide corrections" : "Show corrections"}
    >
      {expanded ? <MinusIcon className="w-3 h-3" /> : <PlusIcon className="w-3 h-3" />}
    </button>
  );
}

/* The four columns that follow File Name (Description, Imported By, Imported On,
 * Results). Shared verbatim by parent rows and their nested correction rows so
 * both read identically. Rendered as a fragment so each <td> stays a direct
 * child of the <tr> (the row's `[&>td]` padding rules depend on that). */
function TrailingCells({
  row,
  searchQuery,
  columns,
  frozenLeft,
  lastFrozenKey,
  stickyBg,
  density,
}: {
  row: ImportRow;
  searchQuery: string;
  columns: ControlledColumn[];
  frozenLeft: Record<string, number>;
  lastFrozenKey: string | null;
  stickyBg: string;
  density: DensityOption;
}) {
  const avatar = density === "comfort" ? "w-7 h-7" : "w-6 h-6";
  const renderCell = (key: string) => {
    switch (key) {
      case "description":
        /* Optional, empty renders the module's muted dash. */
        return row.description ? (
          <span
            className="text-[#334155] truncate block"
            style={{ fontSize: "14px", fontWeight: 400 }}
            title={row.description}
          >
            <HighlightMatch text={row.description} query={searchQuery} matchClassName={HIGHLIGHT_CLASS} />
          </span>
        ) : (
          <span className="text-[#CBD5E1]">-</span>
        );
      case "importedBy":
        return (
          <HoverCard openDelay={120} closeDelay={80}>
            <div className="flex items-center gap-2 min-w-0">
              <HoverCardTrigger asChild>
                <span
                  className={cn("rounded-full flex items-center justify-center shrink-0 cursor-pointer", avatar)}
                  style={{ backgroundColor: row.importer.bg }}
                  aria-label={row.importer.name}
                >
                  <span style={{ fontSize: "10.5px", fontWeight: 600, color: row.importer.fg }}>
                    {row.importer.initials}
                  </span>
                </span>
              </HoverCardTrigger>
              <span
                className="text-[#334155] truncate cursor-pointer hover:text-[#0A77FF] hover:underline underline-offset-2"
                style={{ fontSize: "14px", fontWeight: 500 }}
              >
                <HighlightMatch text={row.importer.name} query={searchQuery} matchClassName={HIGHLIGHT_CLASS} />
              </span>
            </div>
            <HoverCardContent side="bottom" align="start" sideOffset={8} className="w-[320px] p-0 rounded-xl border border-[#E2E8F0] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)]">
              <UserOverviewCard user={row.importer} />
            </HoverCardContent>
          </HoverCard>
        );
      case "importedOn":
        return (
          <span className="text-[#334155]" style={{ fontSize: "14px", fontWeight: 400 }}>
            {formatImportedOn(row.dateISO)}
          </span>
        );
      case "results":
        return <ResultCell imported={row.importedCount} failed={row.failedCount} />;
      default:
        return null;
    }
  };
  /* Cells follow the header's column order and visibility. Rendered as a
   * fragment so each <td> stays a direct child of the <tr> (the row's
   * `[&>td]` padding rules depend on that). */
  return (
    <>
      {columns.map((col) => {
        const left = frozenLeft[col.key];
        const isFrozen = left !== undefined;
        return (
          <td
            key={col.key}
            className={cn("overflow-hidden", isFrozen && "sticky z-10")}
            style={{
              ...(isFrozen ? { left, backgroundColor: stickyBg } : null),
              ...(col.key === lastFrozenKey ? { boxShadow: FROZEN_EDGE_SHADOW } : null),
            }}
          >
            {renderCell(col.key)}
          </td>
        );
      })}
    </>
  );
}

function Th({
  children,
  className,
  style,
  divider,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  divider?: boolean;
} & Omit<React.ThHTMLAttributes<HTMLTableCellElement>, "children" | "className" | "style">) {
  return (
    <th
      {...rest}
      className={cn("text-left align-middle pl-4 pr-2 whitespace-nowrap", className)}
      style={{
        fontSize: "13px",
        fontWeight: 400,
        color: "#475569",
        lineHeight: "1.2",
        ...(divider
          ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" }
          : {}),
        ...style,
      }}
    >
      {children}
    </th>
  );
}

/* Result column chips. Matches the Active/Inactive pill design used elsewhere
 * in the module: rounded-full, soft tonal fill, 1px border, no icon. Success
 * uses the existing green outcome palette; failures use the red outcome
 * palette. The failed chip is hidden when the count is 0 so a clean import
 * reads as a single green chip. */
const RESULT_CHIP_TOKENS = {
  success: { bg: "#ECFDF5", text: "#065F46", border: "#D1FAE5" },
  failed:  { bg: "#FEF2F2", text: "#991B1B", border: "#FEE2E2" },
};

function ResultChip({ tone, children }: { tone: "success" | "failed"; children: React.ReactNode }) {
  const t = RESULT_CHIP_TOKENS[tone];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full border whitespace-nowrap"
      style={{ fontSize: "12px", fontWeight: 500, backgroundColor: t.bg, color: t.text, borderColor: t.border }}
    >
      {children}
    </span>
  );
}

function ResultCell({ imported, failed }: { imported: number | undefined; failed: number | undefined }) {
  /* Coalesce defensively, pre-schema sessionStorage entries can deliver
   * undefined for either count and would otherwise render as empty chips. */
  const importedCount = imported ?? 0;
  const failedCount = failed ?? 0;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <ResultChip tone="success">{importedCount} imported</ResultChip>
      {failedCount > 0 && <ResultChip tone="failed">{failedCount} failed</ResultChip>}
    </div>
  );
}

/* The error rows went out and the corrected file has not come back. Sits
 * beside the file name rather than in the Results column: the outcome chips
 * already fill that fixed-width cell, and this is a call to action about the
 * import itself, not another tally of it. Clicking anywhere on the row lands
 * on the import's page, where the upload strip is waiting. */
function AwaitingFileChip() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0"
      style={{
        fontSize: "11.5px",
        fontWeight: 500,
        backgroundColor: "#FFFBEB",
        color: "#B45309",
        borderColor: "#FDE68A",
      }}
      title="The error rows were downloaded. Open this import to upload the corrected file."
    >
      <Upload className="w-3 h-3" />
      Awaiting file
    </span>
  );
}
