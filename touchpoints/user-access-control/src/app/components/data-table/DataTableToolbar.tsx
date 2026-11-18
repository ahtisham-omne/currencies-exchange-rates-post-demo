import {
  Search,
  SlidersHorizontal,
  X,
  AlignJustify,
  List,
  LayoutGrid,
  Check,
  ChevronDown,
} from "lucide-react";
import { Input } from "../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { CARD_SIZES, DENSITY_OPTIONS, type CardSize, type DensityOption } from "./types";
import { ColumnSelectorTrigger } from "./ColumnSelector";

const DENSITY_ICONS = {
  "align-justify": AlignJustify,
  list: List,
  "layout-grid": LayoutGrid,
} as const;

interface DataTableToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder: string;
  filteredCount: number;
  totalCount: number;
  entityLabel: string;
  density: DensityOption;
  onDensityChange: (density: DensityOption) => void;
  /* Card size — the segmented control revealed under Card View */
  cardSize?: CardSize;
  onCardSizeChange?: (size: CardSize) => void;
  /* Column selector */
  columnSelectorOpen: boolean;
  onColumnSelectorToggle: () => void;
  visibleColumnCount: number;
  /* Visibility toggles */
  hideDensity?: boolean;
  hideColumnSelector?: boolean;
  hideFilters?: boolean;
  /* Advanced filters panel */
  onFiltersClick?: () => void;
  activeFilterCount?: number;
  /* Optional extra action element */
  toolbarAction?: React.ReactNode;
  /** Slot rendered before the density dropdown (e.g. Insights button) */
  insightsSlot?: React.ReactNode;
  /** Optional content rendered inline after the search input (e.g. segmented tabs) */
  leadingToolbarSlot?: React.ReactNode;
  /** Optional override for the count label (replaces "X of Y entityLabel"). */
  countOverride?: React.ReactNode;
}

export function DataTableToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  filteredCount,
  totalCount,
  entityLabel,
  density,
  onDensityChange,
  cardSize = "medium",
  onCardSizeChange,
  columnSelectorOpen,
  onColumnSelectorToggle,
  visibleColumnCount,
  hideDensity,
  hideColumnSelector,
  hideFilters,
  onFiltersClick,
  activeFilterCount = 0,
  toolbarAction,
  insightsSlot,
  leadingToolbarSlot,
  countOverride,
}: DataTableToolbarProps) {
  const activeConfig = DENSITY_OPTIONS.find((d) => d.key === density)!;
  const ActiveIcon = DENSITY_ICONS[activeConfig.icon];

  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#CBD5E1" }} />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-[#0A77FF] focus-visible:ring-[#0A77FF]/20"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters button, opens the advanced filters panel */}
        {!hideFilters && (
          <button
            type="button"
            onClick={onFiltersClick}
            className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-[8px] border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none shrink-0 ${
              activeFilterCount > 0 ? "border-[#007FFF]/30" : "border-border/80"
            }`}
            style={{ color: activeFilterCount > 0 ? "#007FFF" : "#334155" }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: activeFilterCount > 0 ? "#007FFF" : "#CBD5E1" }} />
            <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
            {activeFilterCount > 0 && (
              <span
                className="ml-0.5 min-w-[18px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                style={{ backgroundColor: "#007FFF", fontWeight: 600 }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        {/* Leading toolbar slot (e.g. segmented tabs) */}
        {leadingToolbarSlot && <div className="shrink-0">{leadingToolbarSlot}</div>}
      </div>

      {/* Count + Density + Columns */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
          {countOverride !== undefined ? (
            countOverride
          ) : filteredCount !== totalCount ? (
            <>
              <span className="text-foreground">{filteredCount}</span>
              <span className="text-muted-foreground/60"> of </span>
              <span className="text-muted-foreground">{totalCount}</span>
              <span className="text-muted-foreground/70"> {entityLabel}</span>
            </>
          ) : (
            <>
              <span className="text-foreground">{totalCount}</span>
              <span className="text-muted-foreground/70"> {entityLabel}</span>
            </>
          )}
        </span>

        {(!hideDensity || !hideColumnSelector) && (
          <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />
        )}

        {/* Insights button slot */}
        {insightsSlot}

        {/* Density dropdown */}
        {!hideDensity && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-[8px] border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none"
              >
                <ActiveIcon className="w-[18px] h-[18px]" style={{ color: "#94A3B8" }} />
                <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                  {activeConfig.label}
                </span>
                <ChevronDown className="w-3.5 h-3.5" style={{ color: "#CBD5E1" }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[230px] p-1.5 z-[120]">
              {DENSITY_OPTIONS.map((opt) => {
                const Icon = DENSITY_ICONS[opt.icon];
                return (
                  <DropdownMenuItem
                    key={opt.key}
                    className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                    onSelect={(e) => {
                      /* Picking Card View keeps the menu open so the card-size
                         control it reveals is immediately reachable. */
                      if (opt.key === "card" && onCardSizeChange) e.preventDefault();
                      onDensityChange(opt.key);
                    }}
                  >
                    <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.description}</div>
                    </div>
                    {density === opt.key && (
                      <Check className="w-4 h-4 shrink-0" style={{ color: "#007FFF" }} />
                    )}
                  </DropdownMenuItem>
                );
              })}

              {/* Card size — only while card view is active. Plain buttons, not
                  menu items, so clicking one resizes the grid live without
                  dismissing the menu. */}
              {density === "card" && onCardSizeChange && (
                <>
                  <div className="mx-2 my-1.5 border-t border-[#F1F5F9]" />
                  <div className="px-3 py-1.5">
                    <p
                      className="text-[10px] text-[#94A3B8] uppercase tracking-wide mb-2"
                      style={{ fontWeight: 600 }}
                    >
                      Card Size
                    </p>
                    <div className="flex items-center gap-1.5" role="group" aria-label="Card size">
                      {CARD_SIZES.map((size) => {
                        const selected = cardSize === size.key;
                        return (
                          <button
                            key={size.key}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onCardSizeChange(size.key)}
                            className={`flex-1 py-1.5 rounded-md text-[11px] text-center transition-all cursor-pointer ${
                              selected
                                ? "bg-[#007FFF] text-white shadow-sm"
                                : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                            }`}
                            style={{ fontWeight: selected ? 600 : 500 }}
                          >
                            {size.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Columns button */}
        {!hideColumnSelector && (
          <ColumnSelectorTrigger
            visibleCount={visibleColumnCount}
            active={columnSelectorOpen}
            onClick={onColumnSelectorToggle}
            disabled={density === "card"}
          />
        )}

        {/* Optional extra action element */}
        {toolbarAction && <div className="ml-2">{toolbarAction}</div>}
      </div>
    </div>
  );
}