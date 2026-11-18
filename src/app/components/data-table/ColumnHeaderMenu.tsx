/**
 * ColumnHeaderMenu: per-column header dropdown (Filter / Sort ascending /
 * Sort descending / Hide / Freeze) with inline column filters, plus the
 * ColumnFilterChip and ActiveFiltersBar that render active column filters.
 *
 * Layout/UI mirrors the Partner Management column-header menu. The blue tokens
 * from that app (`primary` / `accent`) are remapped to UAC's blue
 * (#007FFF / #EDF4FF); neutral tokens are kept. Filtering LOGIC is UAC-native:
 * unique values + per-column value accessors are supplied by the table.
 */
import { useState, useMemo, useRef, useEffect, useCallback, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowUp,
  ArrowDown,
  Filter,
  EyeOff,
  Snowflake,
  Search,
  X,
  ChevronDown,
  ChevronLeft,
  Plus,
} from "lucide-react";
import { Checkbox } from "../ui/checkbox";
import type { ColumnFilterState, ColumnFilterType, SortConfig, SortDirection } from "./types";

const BLUE = "#007FFF";

/* ─── Helpers ─── */
function highlightMatch(text: string, query: string): ReactNode {
  if (!query || query.trim().length === 0) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/** Status → dot color. Returns null for non-status values (no dot shown). */
function getStatusColor(status: string): string | null {
  switch (status) {
    case "Active":
      return "#22C55E";
    case "Inactive":
      return "#F59E0B";
    case "Archived":
      return "#6B7280";
    case "Invite Sent":
      return "#0EA5E9";
    case "Invite Expired":
      return "#EF4444";
    case "Pending Setup":
      return "#94A3B8";
    case "No License":
      return "#94A3B8";
    default:
      return null;
  }
}

export function createBlankFilter(columnKey: string, type: ColumnFilterType): ColumnFilterState {
  return { columnKey, type, values: [], text: "", min: "", max: "", dateFrom: "", dateTo: "" };
}

export function isFilterActive(filter: ColumnFilterState): boolean {
  switch (filter.type) {
    case "multiselect":
      return filter.values.length > 0;
    case "text":
      return filter.text.trim().length > 0;
    case "range":
      return filter.min !== "" || filter.max !== "";
    case "date":
      return filter.dateFrom !== "" || filter.dateTo !== "";
    default:
      return false;
  }
}

/** Apply the active column filters to a dataset (AND across columns). Uses the
 *  per-column value accessor supplied by the table. */
export function applyColumnFilters<T>(
  rows: T[],
  filters: ColumnFilterState[],
  metaByKey: Record<string, { type: ColumnFilterType; getValue: (row: T) => string | string[] | number | null | undefined }>,
): T[] {
  const active = filters.filter(isFilterActive);
  if (active.length === 0) return rows;

  return rows.filter((row) => {
    for (const f of active) {
      const meta = metaByKey[f.columnKey];
      if (!meta) continue;
      const raw = meta.getValue(row);

      if (f.type === "multiselect") {
        const vals = Array.isArray(raw)
          ? raw.map((v) => String(v))
          : raw == null || raw === ""
            ? []
            : [String(raw)];
        if (f.values.length > 0 && !f.values.some((v) => vals.includes(v))) return false;
      } else if (f.type === "text") {
        const s = (raw == null ? "" : String(raw)).toLowerCase();
        if (f.text.trim() && !s.includes(f.text.trim().toLowerCase())) return false;
      } else if (f.type === "range") {
        const n = Number(raw);
        if (!Number.isNaN(n)) {
          if (f.min !== "" && n < Number(f.min)) return false;
          if (f.max !== "" && n > Number(f.max)) return false;
        }
      } else if (f.type === "date") {
        const d = raw ? new Date(String(raw)) : null;
        if (d && !Number.isNaN(d.getTime())) {
          if (f.dateFrom && d < new Date(f.dateFrom)) return false;
          if (f.dateTo) {
            const to = new Date(f.dateTo);
            to.setHours(23, 59, 59, 999);
            if (d > to) return false;
          }
        }
      }
    }
    return true;
  });
}

/* ─── Column Header Menu ─── */
interface ColumnHeaderMenuProps {
  columnKey: string;
  label: string;
  sortable?: boolean;
  sortConfig: SortConfig | null;
  onSort: (key: string, direction: SortDirection | null) => void;
  onAddFilter: (columnKey: string) => void;
  onHideColumn: (columnKey: string) => void;
  onFreezeColumn?: (columnKey: string) => void;
  isFrozen?: boolean;
  isLocked?: boolean;
  hasActiveFilter?: boolean;
  filter?: ColumnFilterState | null;
  /** Filter type: presence enables the "Filter" item. */
  filterType?: ColumnFilterType;
  uniqueValues?: string[];
  formatLabel?: (value: string) => string;
  onFilterChange?: (columnKey: string, filter: ColumnFilterState) => void;
  children: ReactNode;
}

export function ColumnHeaderMenu({
  columnKey,
  label,
  sortable,
  sortConfig,
  onSort,
  onAddFilter,
  onHideColumn,
  onFreezeColumn,
  isFrozen,
  isLocked,
  hasActiveFilter,
  filter,
  filterType,
  uniqueValues = [],
  formatLabel,
  onFilterChange,
  children,
}: ColumnHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "filter">("menu");
  const [filterSearch, setFilterSearch] = useState("");
  const canFilter = !!filterType && !!onFilterChange;

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setTimeout(() => {
        setView("menu");
        setFilterSearch("");
      }, 150);
    }
  }, []);

  const currentSort: SortDirection | null =
    sortConfig?.key === columnKey ? sortConfig.direction : null;

  const handleSort = (dir: SortDirection) => {
    onSort(columnKey, currentSort === dir ? null : dir);
    setOpen(false);
  };

  const handleFilterClick = () => {
    onAddFilter(columnKey);
    setView("filter");
  };

  const blankFilter = useMemo(
    () => createBlankFilter(columnKey, filterType ?? "text"),
    [columnKey, filterType],
  );
  const currentFilter = filter ?? blankFilter;

  const fmt = useCallback(
    (v: string) => (formatLabel ? formatLabel(v) : v),
    [formatLabel],
  );

  const filteredValues = useMemo(() => {
    if (!filterSearch.trim()) return uniqueValues;
    const q = filterSearch.toLowerCase();
    return uniqueValues.filter((v) => fmt(v).toLowerCase().includes(q));
  }, [uniqueValues, filterSearch, fmt]);

  const handleToggleValue = (value: string) => {
    if (!onFilterChange) return;
    const newValues = currentFilter.values.includes(value)
      ? currentFilter.values.filter((v) => v !== value)
      : [...currentFilter.values, value];
    onFilterChange(columnKey, { ...currentFilter, values: newValues });
  };

  const handleClearFilter = () => {
    if (!onFilterChange) return;
    onFilterChange(columnKey, { ...currentFilter, values: [], text: "", min: "", max: "", dateFrom: "", dateTo: "" });
  };

  const handleInlineFilterChange = (updated: ColumnFilterState) => {
    onFilterChange?.(columnKey, updated);
  };

  const operatorLabel =
    currentFilter.type === "multiselect" ? "is" : currentFilter.type === "text" ? "contains" : "between";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        type="button"
        className="flex items-center gap-1 w-full h-full text-left cursor-pointer select-none group/header transition-colors"
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className={`p-0 rounded-lg shadow-lg border border-border/80 z-[200] ${
          view === "filter" ? (currentFilter.type === "date" ? "w-[340px]" : "w-[260px]") : "w-[220px]"
        }`}
      >
        {view === "menu" ? (
          <>
            <div className="px-3 pt-2.5 pb-2">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80" style={{ fontWeight: 600 }}>
                {label}
              </span>
            </div>

            <div className="border-t border-border/60" />

            <div className="py-1 px-1">
              {/* Filter */}
              {canFilter && (
                <button
                  type="button"
                  onClick={handleFilterClick}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
                    hasActiveFilter ? "text-[#007FFF]" : "text-foreground"
                  }`}
                >
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span style={{ fontWeight: 400 }}>Filter</span>
                  {hasActiveFilter && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#007FFF]" />}
                </button>
              )}

              {/* Sort */}
              {sortable && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSort("asc")}
                    className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
                      currentSort === "asc" ? "text-[#007FFF] bg-[#007FFF]/5" : "text-foreground"
                    }`}
                  >
                    <ArrowUp className="w-4 h-4 text-muted-foreground" />
                    <span style={{ fontWeight: 400 }}>Sort Ascending</span>
                    {currentSort === "asc" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#007FFF]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSort("desc")}
                    className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
                      currentSort === "desc" ? "text-[#007FFF] bg-[#007FFF]/5" : "text-foreground"
                    }`}
                  >
                    <ArrowDown className="w-4 h-4 text-muted-foreground" />
                    <span style={{ fontWeight: 400 }}>Sort Descending</span>
                    {currentSort === "desc" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#007FFF]" />}
                  </button>
                </>
              )}

              {(canFilter || sortable) && !isLocked && <div className="border-t border-border/60 my-1" />}

              {/* Hide */}
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    onHideColumn(columnKey);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] text-foreground cursor-pointer transition-colors hover:bg-muted/60"
                >
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                  <span style={{ fontWeight: 400 }}>Hide</span>
                </button>
              )}

              {/* Freeze */}
              {onFreezeColumn && !isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    onFreezeColumn(columnKey);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
                    isFrozen ? "text-[#007FFF]" : "text-foreground"
                  }`}
                >
                  <Snowflake className="w-4 h-4 text-muted-foreground" />
                  <span style={{ fontWeight: 400 }}>{isFrozen ? "Unfreeze" : "Freeze"}</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="px-3 pt-2.5 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setView("menu");
                    setFilterSearch("");
                  }}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md cursor-pointer transition-colors hover:bg-muted/60 text-muted-foreground shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 text-[13px] min-w-0">
                  <span className="truncate" style={{ fontWeight: 500, color: "#0F172A" }}>
                    {label}
                  </span>
                  <span className="text-muted-foreground/50 shrink-0">{operatorLabel}</span>
                </div>
                {isFilterActive(currentFilter) && (
                  <button
                    type="button"
                    onClick={handleClearFilter}
                    className="ml-auto text-[12px] cursor-pointer transition-colors shrink-0"
                    style={{ fontWeight: 500, color: BLUE }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {currentFilter.type === "multiselect" && (
              <div>
                {uniqueValues.length > 5 && (
                  <div className="px-3 pb-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                      <input
                        type="text"
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        placeholder="Search…"
                        className="w-full h-8 pl-8 pr-3 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] placeholder:text-muted-foreground/40"
                        autoFocus
                      />
                      {filterSearch && (
                        <button
                          type="button"
                          onClick={() => setFilterSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t border-border/40" />

                <div className="max-h-[240px] overflow-y-auto py-1 px-1">
                  {filteredValues.length === 0 ? (
                    <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">No Options Found</div>
                  ) : (
                    filteredValues.map((value) => {
                      const selected = currentFilter.values.includes(value);
                      const dot = getStatusColor(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleToggleValue(value)}
                          className={`flex items-center gap-2.5 w-full px-2.5 py-[6px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/50 ${
                            selected ? "bg-[#007FFF]/5" : ""
                          }`}
                        >
                          <Checkbox checked={selected} className="pointer-events-none" />
                          {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />}
                          <span style={{ fontWeight: selected ? 500 : 400 }}>{highlightMatch(fmt(value), filterSearch)}</span>
                        </button>
                      );
                    })
                  )}
                </div>

                {currentFilter.values.length > 0 && (
                  <>
                    <div className="border-t border-border/40" />
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[12px] text-muted-foreground">{currentFilter.values.length} selected</span>
                      <button
                        type="button"
                        onClick={handleClearFilter}
                        className="text-[12px] cursor-pointer transition-colors"
                        style={{ fontWeight: 500, color: BLUE }}
                      >
                        Clear Selection
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {currentFilter.type === "text" && (
              <div className="px-3 pb-3">
                <input
                  type="text"
                  value={currentFilter.text}
                  onChange={(e) => handleInlineFilterChange({ ...currentFilter, text: e.target.value })}
                  placeholder={`Filter by ${label.toLowerCase()}…`}
                  className="w-full h-8 px-3 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] placeholder:text-muted-foreground/40"
                  autoFocus
                />
              </div>
            )}

            {currentFilter.type === "range" && (
              <div className="px-3 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                      Min
                    </label>
                    <input
                      type="number"
                      value={currentFilter.min}
                      onChange={(e) => handleInlineFilterChange({ ...currentFilter, min: e.target.value })}
                      placeholder="0"
                      className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] tabular-nums"
                      autoFocus
                    />
                  </div>
                  <span className="text-muted-foreground/30 mt-4">–</span>
                  <div className="flex-1">
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                      Max
                    </label>
                    <input
                      type="number"
                      value={currentFilter.max}
                      onChange={(e) => handleInlineFilterChange({ ...currentFilter, max: e.target.value })}
                      placeholder="∞"
                      className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] tabular-nums"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentFilter.type === "date" && (
              <div className="px-3 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                      From
                    </label>
                    <input
                      type="date"
                      value={currentFilter.dateFrom}
                      onChange={(e) => handleInlineFilterChange({ ...currentFilter, dateFrom: e.target.value })}
                      className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF]"
                      autoFocus
                    />
                  </div>
                  <span className="text-muted-foreground/30 mt-4">–</span>
                  <div className="flex-1">
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                      To
                    </label>
                    <input
                      type="date"
                      value={currentFilter.dateTo}
                      onChange={(e) => handleInlineFilterChange({ ...currentFilter, dateTo: e.target.value })}
                      className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF]"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Column Filter Chip ─── */
interface ColumnFilterChipProps {
  filter: ColumnFilterState;
  label: string;
  uniqueValues?: string[];
  formatLabel?: (value: string) => string;
  onFilterChange: (filter: ColumnFilterState) => void;
  onRemove: () => void;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
}

export function ColumnFilterChip({
  filter,
  label,
  uniqueValues = [],
  formatLabel,
  onFilterChange,
  onRemove,
  autoOpen,
  onAutoOpened,
}: ColumnFilterChipProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const prevAutoOpen = useRef(false);
  const onAutoOpenedRef = useRef(onAutoOpened);
  onAutoOpenedRef.current = onAutoOpened;

  useEffect(() => {
    if (autoOpen && !prevAutoOpen.current) {
      prevAutoOpen.current = true;
      const t = requestAnimationFrame(() => {
        setTimeout(() => {
          setOpen(true);
          onAutoOpenedRef.current?.();
        }, 60);
      });
      return () => cancelAnimationFrame(t);
    }
    if (!autoOpen) prevAutoOpen.current = false;
  }, [autoOpen]);

  const active = isFilterActive(filter);
  const fmt = useCallback((v: string) => (formatLabel ? formatLabel(v) : v), [formatLabel]);

  const operatorLabel =
    filter.type === "multiselect" ? "is" : filter.type === "text" ? "contains" : "between";

  const filteredValues = useMemo(() => {
    if (!search.trim()) return uniqueValues;
    const q = search.toLowerCase();
    return uniqueValues.filter((v) => fmt(v).toLowerCase().includes(q));
  }, [uniqueValues, search, fmt]);

  const toggleValue = (value: string) => {
    const newValues = filter.values.includes(value)
      ? filter.values.filter((v) => v !== value)
      : [...filter.values, value];
    onFilterChange({ ...filter, values: newValues });
  };

  const clearSelection = () =>
    onFilterChange({ ...filter, values: [], text: "", min: "", max: "", dateFrom: "", dateTo: "" });

  const chipSummary = useMemo(() => {
    if (!active) return "";
    switch (filter.type) {
      case "multiselect":
        return filter.values.length === 1 ? fmt(filter.values[0]) : `${filter.values.length} selected`;
      case "text":
        return filter.text;
      case "range": {
        const parts: string[] = [];
        if (filter.min) parts.push(`≥ ${filter.min}`);
        if (filter.max) parts.push(`≤ ${filter.max}`);
        return parts.join(" & ");
      }
      case "date": {
        const parts: string[] = [];
        if (filter.dateFrom) parts.push(`from ${filter.dateFrom}`);
        if (filter.dateTo) parts.push(`to ${filter.dateTo}`);
        return parts.join(" ");
      }
      default:
        return "";
    }
  }, [active, filter, fmt]);

  return (
    <div className="flex items-center shrink-0">
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1 h-[30px] pl-2.5 rounded-l-md border text-[13px] cursor-pointer transition-colors ${
              active
                ? "border-[#007FFF]/30 bg-[#EDF4FF] text-[#007FFF] hover:bg-[#D6E8FF]"
                : "border-border bg-white text-foreground hover:bg-muted/50"
            } ${open ? "border-[#007FFF]/40" : ""}`}
            style={{ fontWeight: 500, borderRight: "none" }}
          >
            {label}
            {active && chipSummary && (
              <>
                <span className="text-muted-foreground/50 mx-0.5">·</span>
                <span className="text-[12px] max-w-[100px] truncate opacity-80">{chipSummary}</span>
              </>
            )}
            <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className={`p-0 rounded-lg shadow-lg border border-border/80 z-[200] ${filter.type === "date" ? "w-[340px]" : "w-[260px]"}`}
        >
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <span style={{ fontWeight: 500 }}>{label}</span>
              <span className="text-muted-foreground/50">{operatorLabel}</span>
            </div>
          </div>

          {filter.type === "multiselect" && (
            <div>
              {uniqueValues.length > 5 && (
                <div className="px-3 pb-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search…"
                      className="w-full h-8 pl-8 pr-3 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] placeholder:text-muted-foreground/40"
                      autoFocus
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-border/40" />

              <div className="max-h-[240px] overflow-y-auto py-1 px-1">
                {filteredValues.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">No Options Found</div>
                ) : (
                  filteredValues.map((value) => {
                    const selected = filter.values.includes(value);
                    const dot = getStatusColor(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleValue(value)}
                        className={`flex items-center gap-2.5 w-full px-2.5 py-[6px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/50 ${
                          selected ? "bg-[#007FFF]/5" : ""
                        }`}
                      >
                        <Checkbox checked={selected} className="pointer-events-none" />
                        {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />}
                        <span style={{ fontWeight: selected ? 500 : 400 }}>{highlightMatch(fmt(value), search)}</span>
                      </button>
                    );
                  })
                )}
              </div>

              {filter.values.length > 0 && (
                <>
                  <div className="border-t border-border/40" />
                  <div className="px-3 py-2">
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="text-[13px] cursor-pointer transition-colors"
                      style={{ fontWeight: 500, color: BLUE }}
                    >
                      Clear Selection
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {filter.type === "text" && (
            <div className="px-3 pb-3">
              <input
                type="text"
                value={filter.text}
                onChange={(e) => onFilterChange({ ...filter, text: e.target.value })}
                placeholder={`Filter by ${label.toLowerCase()}…`}
                className="w-full h-8 px-3 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] placeholder:text-muted-foreground/40"
                autoFocus
              />
              {filter.text && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="mt-2 text-[13px] cursor-pointer transition-colors"
                  style={{ fontWeight: 500, color: BLUE }}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {filter.type === "range" && (
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                    Min
                  </label>
                  <input
                    type="number"
                    value={filter.min}
                    onChange={(e) => onFilterChange({ ...filter, min: e.target.value })}
                    placeholder="0"
                    className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] tabular-nums"
                  />
                </div>
                <span className="text-muted-foreground/30 mt-4">–</span>
                <div className="flex-1">
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                    Max
                  </label>
                  <input
                    type="number"
                    value={filter.max}
                    onChange={(e) => onFilterChange({ ...filter, max: e.target.value })}
                    placeholder="∞"
                    className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] tabular-nums"
                  />
                </div>
              </div>
              {(filter.min || filter.max) && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="mt-2 text-[13px] cursor-pointer transition-colors"
                  style={{ fontWeight: 500, color: BLUE }}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {filter.type === "date" && (
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                    From
                  </label>
                  <input
                    type="date"
                    value={filter.dateFrom}
                    onChange={(e) => onFilterChange({ ...filter, dateFrom: e.target.value })}
                    className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF]"
                  />
                </div>
                <span className="text-muted-foreground/30 mt-4">–</span>
                <div className="flex-1">
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                    To
                  </label>
                  <input
                    type="date"
                    value={filter.dateTo}
                    onChange={(e) => onFilterChange({ ...filter, dateTo: e.target.value })}
                    className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF]"
                  />
                </div>
              </div>
              {(filter.dateFrom || filter.dateTo) && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="mt-2 text-[13px] cursor-pointer transition-colors"
                  style={{ fontWeight: 500, color: BLUE }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className={`inline-flex items-center justify-center h-[30px] w-[28px] rounded-r-md border border-l-0 cursor-pointer transition-colors ${
          active
            ? "border-[#007FFF]/30 bg-[#EDF4FF] text-[#007FFF]/60 hover:text-[#007FFF] hover:bg-[#D6E8FF]"
            : "border-border bg-white text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50"
        }`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

/* ─── Active Filters Bar ─── */
interface ActiveFiltersBarProps {
  columnFilters: ColumnFilterState[];
  columnLabels: Record<string, string>;
  uniqueValuesByKey?: Record<string, string[]>;
  formatLabelByKey?: Record<string, (v: string) => string>;
  lockedColumnKey?: string;
  onFilterChange: (columnKey: string, filter: ColumnFilterState) => void;
  onRemoveFilter: (columnKey: string) => void;
  onAddFilter: (columnKey: string) => void;
  onClearAll: () => void;
  autoOpenKey: string | null;
  onAutoOpened: () => void;
  availableColumns: { key: string; label: string }[];
}

export function ActiveFiltersBar({
  columnFilters,
  columnLabels,
  uniqueValuesByKey,
  formatLabelByKey,
  lockedColumnKey,
  onFilterChange,
  onRemoveFilter,
  onAddFilter,
  onClearAll,
  autoOpenKey,
  onAutoOpened,
  availableColumns,
}: ActiveFiltersBarProps) {
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  if (columnFilters.length === 0) return null;

  const existingKeys = new Set(columnFilters.map((f) => f.columnKey));
  const addableColumns = availableColumns.filter(
    (c) => !existingKeys.has(c.key) && c.key !== lockedColumnKey,
  );
  const filteredAddable = addSearch.trim()
    ? addableColumns.filter((c) => c.label.toLowerCase().includes(addSearch.toLowerCase()))
    : addableColumns;

  return (
    <div className="flex items-center gap-2 px-4 pb-2.5 overflow-x-auto">
      {columnFilters.map((filter) => (
        <ColumnFilterChip
          key={filter.columnKey}
          filter={filter}
          label={columnLabels[filter.columnKey] || filter.columnKey}
          uniqueValues={uniqueValuesByKey?.[filter.columnKey]}
          formatLabel={formatLabelByKey?.[filter.columnKey]}
          onFilterChange={(updated) => onFilterChange(filter.columnKey, updated)}
          onRemove={() => onRemoveFilter(filter.columnKey)}
          autoOpen={autoOpenKey === filter.columnKey}
          onAutoOpened={onAutoOpened}
        />
      ))}

      {addableColumns.length > 0 && (
        <Popover
          open={addFilterOpen}
          onOpenChange={(v) => {
            setAddFilterOpen(v);
            if (!v) setAddSearch("");
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 h-[30px] px-2.5 rounded-md border border-dashed border-border text-[13px] text-muted-foreground cursor-pointer transition-colors hover:bg-muted/50 hover:text-foreground hover:border-muted-foreground/40 shrink-0"
              style={{ fontWeight: 500 }}
            >
              <Plus className="w-3.5 h-3.5" />
              Filter
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={6} className="w-[220px] p-0 rounded-lg shadow-lg border border-border/80 z-[200]">
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                <input
                  type="text"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Search columns…"
                  className="w-full h-8 pl-8 pr-3 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] placeholder:text-muted-foreground/40"
                  autoFocus
                />
              </div>
            </div>

            <div className="border-t border-border/40" />

            <div className="max-h-[240px] overflow-y-auto py-1 px-1">
              {filteredAddable.length === 0 ? (
                <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">No Columns Available</div>
              ) : (
                filteredAddable.map((col) => (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => {
                      onAddFilter(col.key);
                      setAddFilterOpen(false);
                      setAddSearch("");
                    }}
                    className="flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] text-foreground cursor-pointer transition-colors hover:bg-muted/50"
                  >
                    <Filter className="w-3.5 h-3.5 text-muted-foreground/60" />
                    <span style={{ fontWeight: 400 }}>{highlightMatch(col.label, addSearch)}</span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {columnFilters.some((f) => isFilterActive(f)) && (
        <>
          <div className="w-px h-5 bg-border/60 shrink-0" />
          <button
            type="button"
            onClick={onClearAll}
            className="text-[12px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors whitespace-nowrap shrink-0"
            style={{ fontWeight: 500 }}
          >
            Clear All
          </button>
        </>
      )}
    </div>
  );
}
