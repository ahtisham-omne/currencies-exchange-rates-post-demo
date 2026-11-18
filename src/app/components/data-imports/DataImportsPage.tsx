import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileInput,
  Search,
  X,
  ChevronLeft,
} from "lucide-react";
import { TooltipProvider } from "../ui/tooltip";
import { ExpandWidthButton, useExpandedWidth } from "./ExpandWidthButton";
import { cn } from "../ui/utils";
import { type AlertModuleView } from "../alerts-settings/ViewSwitcher";
import { DataImportModuleTable, type DataImportModuleRow } from "./DataImportModuleTable";
import { DataImportModuleCardGrid } from "./DataImportModuleCardGrid";
import { categoryNav, emptySectionMeta, getAllModuleCards, moduleCards } from "./moduleData";
import { isTemplateOnlySlug, seedTemplateOnlyImports } from "./templateOnlyModules";
import { getCompletedImports } from "./importHistory";
import { ComingSoonEmptyState } from "../shared/ComingSoonEmptyState";
import {
  ModuleFiltersMenu,
  EMPTY_MODULE_FILTERS,
  countActiveFilters,
  matchesModuleFilters,
  type ModuleFilters,
} from "./ModuleFiltersMenu";
import { Pagination } from "./Pagination";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/* ────────────────────────────────────
   Page
   ──────────────────────────────────── */

export function DataImportsPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [view] = useState<AlertModuleView>("card");
  const { isExpanded, setIsExpanded, containerMaxWidth } = useExpandedWidth();
  const [columnVisibility] = useState<Record<string, boolean>>({
    module: true,
    description: true,
    total: true,
    enabled: true,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [filters, setFilters] = useState<ModuleFilters>(EMPTY_MODULE_FILTERS);

  /* Item Library, Categories, Partners and Partner Group count their live
   * import history (seeded once per load), so a new import shows here. */
  const allCards = useMemo<DataImportModuleRow[]>(
    () =>
      getAllModuleCards().map((card) => {
        /* A tabbed card whose tabs are all module imports counts every tab. */
        const tabSlugs = card.tabs?.map((t) => t.slug) ?? [];
        if (tabSlugs.length > 0 && tabSlugs.every(isTemplateOnlySlug)) {
          let count = 0;
          for (const slug of tabSlugs) {
            if (!isTemplateOnlySlug(slug)) continue;
            seedTemplateOnlyImports(slug);
            count += getCompletedImports(slug).filter((e) => !e.parentId).length;
          }
          return { ...card, importsCount: count };
        }
        if (!card.slug || !isTemplateOnlySlug(card.slug)) return card;
        seedTemplateOnlyImports(card.slug);
        return { ...card, importsCount: getCompletedImports(card.slug).filter((e) => !e.parentId).length };
      }),
    [],
  );

  /* Search and the Filters menu narrow every chip's count, so the chip row
   * always reflects what selecting it would actually show. Only the category
   * itself is left out of a chip's own count. */
  const matchesSearchAndFilters = useCallback(
    (card: DataImportModuleRow) => {
      const q = searchQuery.trim().toLowerCase();
      const searchHit =
        !q ||
        card.title.toLowerCase().includes(q) ||
        card.description.toLowerCase().includes(q);
      return searchHit && matchesModuleFilters(card, filters);
    },
    [searchQuery, filters],
  );

  const categoryCounts = useMemo(() => {
    const eligible = allCards.filter(matchesSearchAndFilters);
    const counts: Record<string, number> = { all: eligible.length };
    for (const cat of categoryNav) {
      counts[cat.id] = eligible.filter((c) => c._category === cat.id).length;
    }
    return counts;
  }, [allCards, matchesSearchAndFilters]);

  /* Every category keeps its chip even at zero so the taxonomy stays visible
   * while a search or filter is narrowing things down. */
  const visibleCategories = categoryNav;

  const filteredCards = useMemo(() => {
    const hasCategoryFilter = activeCategory !== "all";
    return allCards
      .filter((c) => !hasCategoryFilter || c._category === activeCategory)
      .filter(matchesSearchAndFilters)
      /* Order here rather than inside a view, so the card grid, the table and
         pagination all agree: available modules first, and among those the
         `order` hint leads with User Access Control, then Quotes, then Sales
         Orders. Anything without a hint keeps its category order behind them. */
      .sort((a, b) => {
        const aDisabled = !a.hasTemplates ? 1 : 0;
        const bDisabled = !b.hasTemplates ? 1 : 0;
        if (aDisabled !== bDisabled) return aDisabled - bDisabled;
        return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
      });
  }, [allCards, activeCategory, matchesSearchAndFilters]);

  const totalPages = Number.isFinite(recordsPerPage)
    ? Math.max(1, Math.ceil(filteredCards.length / recordsPerPage))
    : 1;
  const pagedCards = useMemo(() => {
    if (!Number.isFinite(recordsPerPage)) return filteredCards;
    const start = (currentPage - 1) * recordsPerPage;
    return filteredCards.slice(start, start + recordsPerPage);
  }, [filteredCards, currentPage, recordsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleCardClick = (card: DataImportModuleRow) => {
    if (card.hasTemplates && card.slug) {
      navigate(`/company-settings/data-imports/${card.slug}`);
    }
  };

  const emptyMeta = activeCategory !== "all" ? emptySectionMeta[activeCategory] : undefined;
  const activeFilterCount = countActiveFilters(filters);
  /* A category with no import surfaces defined at all (People today) is a
   * coming-soon story, not a search miss — so it gets the Partner Details
   * placeholder treatment rather than the "no matches" panel. */
  const categoryIsUnbuilt =
    activeCategory !== "all" && (moduleCards[activeCategory]?.length ?? 0) === 0;
  /* Filters clearing the grid is a different dead end than a search miss, so
   * the empty state names the one that's actually responsible. */
  const emptyTitle =
    activeFilterCount > 0 && !searchQuery.trim()
      ? "No Modules Match Your Filters."
      : undefined;
  const emptyLabel =
    activeFilterCount > 0
      ? "Try clearing a filter, or pick a different category."
      : emptyMeta?.label;


  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
        {/* Page header, card-style */}
        <div
          className="shrink-0 px-6 lg:px-8 pt-4 mx-auto w-full transition-[max-width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ maxWidth: containerMaxWidth }}
        >
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between gap-4" style={{ padding: "12px 16px" }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => navigate("/company-settings")}
                  aria-label="Back to Company Setup"
                  className="w-11 h-11 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-400" />
                </button>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white"
                  style={{
                    backgroundColor: "#EEF2FF",
                    boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 0 0 2px rgba(79,70,229,0.10)",
                  }}
                >
                  <FileInput className="w-5 h-5" style={{ color: "#4F46E5" }} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-[#0F172A] truncate" style={{ fontSize: "16px", fontWeight: 700, lineHeight: "22px" }}>
                    Data Imports
                  </h1>
                  <p className="text-[12px] text-slate-500 leading-[1.6]" style={{ marginTop: 6 }}>
                    Bring records into Omne in bulk from a spreadsheet. Pick a module to download its template and start an import.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <ExpandWidthButton isExpanded={isExpanded} onToggle={() => setIsExpanded((v) => !v)} />
              </div>
            </div>
          </div>
        </div>

        {/* Content card, fills remaining height; body scrolls internally */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div
            className="flex-1 min-h-0 flex flex-col px-6 lg:px-8 py-4 mx-auto w-full transition-[max-width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ maxWidth: containerMaxWidth }}
          >
            <div className="flex-1 min-h-0 flex flex-col bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden">
              {/* Toolbar row */}
              <div className="shrink-0 flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#CBD5E1" }} />
                    <input
                      type="text"
                      placeholder="Search modules"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-border/80 shadow-sm rounded-md placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/20 transition-colors"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <ModuleFiltersMenu
                    filters={filters}
                    onChange={(next) => { setFilters(next); setCurrentPage(1); }}
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[13px] text-[#64748B] tabular-nums mr-1">
                    {filteredCards.length} import module{filteredCards.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Filter chips */}
              <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto px-4 pb-3">
                <ChipButton
                  label="Show All"
                  count={categoryCounts.all}
                  active={activeCategory === "all"}
                  onClick={() => { setActiveCategory("all"); setCurrentPage(1); }}
                />
                {visibleCategories.map((cat) => (
                  <ChipButton
                    key={cat.id}
                    label={cat.label}
                    count={categoryCounts[cat.id] ?? 0}
                    active={activeCategory === cat.id}
                    onClick={() => { setActiveCategory(cat.id); setCurrentPage(1); }}
                  />
                ))}
              </div>

              <div className="shrink-0 border-t border-[#F1F5F9]" />

              {/* Content, fills available height, scrolls internally */}
              <div className={cn("flex-1 min-h-0 overflow-auto", view === "card" ? "p-4 bg-white" : "bg-white")}>
                {view === "card" ? (
                  <DataImportModuleCardGrid
                    cards={pagedCards}
                    onCardClick={handleCardClick}
                    searchQuery={searchQuery}
                    emptySectionIcon={emptyMeta?.icon}
                    emptySectionLabel={emptyLabel}
                    emptyTitle={emptyTitle}
                    emptyState={
                      categoryIsUnbuilt ? (
                        <ComingSoonEmptyState
                          title={emptyMeta?.label ?? "Coming Soon"}
                          description="Imports for this module are being designed in a separate workstream. Once that lands, this section will list the templates you can bring records in with."
                        />
                      ) : undefined
                    }
                  />
                ) : (
                  <DataImportModuleTable
                    cards={pagedCards}
                    density={view}
                    onRowClick={handleCardClick}
                    searchQuery={searchQuery}
                    columnVisibility={columnVisibility}
                  />
                )}
              </div>

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
        </div>
      </div>

    </TooltipProvider>
  );
}


function ChipButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 transition-colors cursor-pointer",
        active
          ? "border-[#0A77FF] bg-[#EDF4FF] text-[#0A77FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
          : "border-[rgba(0,0,0,0.1)] bg-white text-[#717182] hover:bg-[#F4F4F6] hover:text-[#0F172A] hover:border-[#D2D2D7] active:bg-[#ECECF0]"
      )}
      style={{ fontSize: "12px", fontWeight: active ? 500 : 400 }}
    >
      {label}
      <span
        className={cn(
          "inline-flex items-center justify-center min-w-[18px] px-1.5 py-px rounded-full text-[10px] text-center tabular-nums",
          active ? "bg-[#0A77FF]/10 text-[#0A77FF]" : "bg-[#ECECF0] text-[#475569]"
        )}
        style={{ fontWeight: 600 }}
      >
        {count}
      </span>
    </button>
  );
}
