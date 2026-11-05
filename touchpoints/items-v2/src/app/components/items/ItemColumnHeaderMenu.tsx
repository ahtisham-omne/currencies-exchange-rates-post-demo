import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import React from "react";
import type { Item } from "../../context/ItemsContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Checkbox } from "@/components/ui/checkbox";

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.trim().length === 0) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>{part}</mark>
    ) : (
      part
    )
  );
}

/* ─── Types ─── */
export type FilterType = "multiselect" | "text" | "range" | "date";

export interface ColumnFilterState {
  columnKey: string;
  type: FilterType;
  values: string[];
  text: string;
  min: string;
  max: string;
  dateFrom: string;
  dateTo: string;
}

export type SortDirection = "asc" | "desc" | null;
export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

/** Map item column keys to filter types */
export function getFilterType(columnKey: string): FilterType {
  switch (columnKey) {
    case "status":
    case "inventory_control":
    case "primary_category":
    case "manufacturer":
    case "acquisition_method":
      return "multiselect";
    case "on_hand_qty":
      return "range";
    case "created_on":
    case "updated_on":
      return "date";
    default:
      return "text";
  }
}

export function createBlankFilter(columnKey: string): ColumnFilterState {
  return {
    columnKey,
    type: getFilterType(columnKey),
    values: [],
    text: "",
    min: "",
    max: "",
    dateFrom: "",
    dateTo: "",
  };
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

function getAcquisitionLabel(item: Item): string {
  const a = item.acquisitionMethod;
  if (typeof a === "string") return a;
  return a?.primary ?? "";
}

export function getUniqueValues(columnKey: string, items: Item[]): string[] {
  const set = new Set<string>();
  items.forEach((i) => {
    switch (columnKey) {
      case "status": if (i.status) set.add(i.status); break;
      case "inventory_control": if (i.inventoryControlType) set.add(i.inventoryControlType); break;
      case "primary_category": if (i.primaryCategory) set.add(i.primaryCategory); break;
      case "manufacturer": if (i.manufacturer) set.add(i.manufacturer); break;
      case "acquisition_method": {
        const v = getAcquisitionLabel(i);
        if (v) set.add(v);
        break;
      }
    }
  });
  return Array.from(set).sort();
}

function formatValueLabel(_columnKey: string, value: string): string {
  return value;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "In Stock": return "#16A34A";
    case "Low Stock": return "#D97706";
    case "Out of Stock": return "#DC2626";
    case "Discontinued":
    case "Archived": return "#64748B";
    default: return "#6B7280";
  }
}

/* ─── Column Header Menu ─── */
interface ColumnHeaderMenuProps {
  columnKey: string;
  label: string;
  sortable?: boolean;
  sortConfig: SortConfig | null;
  onSort: (key: string, direction: "asc" | "desc" | null) => void;
  onAddFilter: (columnKey: string) => void;
  onHideColumn: (columnKey: string) => void;
  onFreezeColumn?: (columnKey: string) => void;
  isFrozen?: boolean;
  isLocked?: boolean;
  hasActiveFilter?: boolean;
  filter?: ColumnFilterState | null;
  items?: Item[];
  onFilterChange?: (columnKey: string, filter: ColumnFilterState) => void;
  children: ReactNode;
}

export function ItemColumnHeaderMenu({
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
  items,
  onFilterChange,
  children,
}: ColumnHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "filter">("menu");
  const [filterSearch, setFilterSearch] = useState("");

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setTimeout(() => {
        setView("menu");
        setFilterSearch("");
      }, 150);
    }
  }, []);

  const currentSort: SortDirection =
    sortConfig?.key === columnKey ? sortConfig.direction : null;

  const handleSort = (dir: "asc" | "desc") => {
    if (currentSort === dir) onSort(columnKey, null);
    else onSort(columnKey, dir);
    setOpen(false);
  };

  const handleFilterClick = () => {
    onAddFilter(columnKey);
    setView("filter");
  };

  const handleHide = () => { onHideColumn(columnKey); setOpen(false); };
  const handleFreeze = () => { onFreezeColumn?.(columnKey); setOpen(false); };

  const currentFilter = filter ?? createBlankFilter(columnKey);

  const uniqueValues = useMemo(
    () => items ? getUniqueValues(columnKey, items) : [],
    [columnKey, items]
  );

  const filteredValues = useMemo(() => {
    if (!filterSearch.trim()) return uniqueValues;
    const q = filterSearch.toLowerCase();
    return uniqueValues.filter((v) => formatValueLabel(columnKey, v).toLowerCase().includes(q));
  }, [uniqueValues, filterSearch, columnKey]);

  const handleToggleValue = (value: string) => {
    if (!onFilterChange) return;
    const newValues = currentFilter.values.includes(value)
      ? currentFilter.values.filter((v) => v !== value)
      : [...currentFilter.values, value];
    onFilterChange(columnKey, { ...currentFilter, values: newValues });
  };

  const handleClearFilter = () => {
    if (!onFilterChange) return;
    onFilterChange(columnKey, {
      ...currentFilter,
      values: [], text: "", min: "", max: "", dateFrom: "", dateTo: "",
    });
  };

  const handleInlineFilterChange = (updated: ColumnFilterState) => {
    if (!onFilterChange) return;
    onFilterChange(columnKey, updated);
  };

  const operatorLabel = currentFilter.type === "multiselect" ? "is" :
                        currentFilter.type === "text" ? "contains" : "between";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        type="button"
        className="flex items-center gap-1 w-full h-full text-left cursor-pointer select-none group/header hover:text-foreground transition-colors"
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className={`p-0 rounded-lg shadow-lg border border-border/80 z-[200] bg-white ${view === "filter" ? "w-[260px]" : "w-[220px]"}`}
      >
        {view === "menu" ? (
          <>
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-muted/30">
                <span className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>
                  {label}
                </span>
              </div>
            </div>
            <div className="border-t border-border/60" />
            <div className="py-1 px-1">
              <button
                type="button"
                onClick={handleFilterClick}
                className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
                  hasActiveFilter ? "text-primary" : "text-foreground"
                }`}
              >
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span style={{ fontWeight: 400 }}>Filter</span>
                {hasActiveFilter && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>

              {sortable && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSort("asc")}
                    className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
                      currentSort === "asc" ? "text-primary bg-primary/5" : "text-foreground"
                    }`}
                  >
                    <ArrowUp className="w-4 h-4 text-muted-foreground" />
                    <span style={{ fontWeight: 400 }}>Sort ascending</span>
                    {currentSort === "asc" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSort("desc")}
                    className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
                      currentSort === "desc" ? "text-primary bg-primary/5" : "text-foreground"
                    }`}
                  >
                    <ArrowDown className="w-4 h-4 text-muted-foreground" />
                    <span style={{ fontWeight: 400 }}>Sort descending</span>
                    {currentSort === "desc" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>
                </>
              )}

              <div className="border-t border-border/60 my-1" />

              {!isLocked && (
                <button
                  type="button"
                  onClick={handleHide}
                  className="flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] text-foreground cursor-pointer transition-colors hover:bg-muted/60"
                >
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                  <span style={{ fontWeight: 400 }}>Hide</span>
                </button>
              )}

              {onFreezeColumn && !isLocked && (
                <button
                  type="button"
                  onClick={handleFreeze}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
                    isFrozen ? "text-primary" : "text-foreground"
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
                  onClick={() => { setView("menu"); setFilterSearch(""); }}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md cursor-pointer transition-colors hover:bg-muted/60 text-muted-foreground shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 text-[13px] min-w-0">
                  <span className="truncate" style={{ fontWeight: 500, color: "#0f172a" }}>{label}</span>
                  <span className="text-muted-foreground/50 shrink-0">{operatorLabel}</span>
                </div>
                {isFilterActive(currentFilter) && (
                  <button
                    type="button"
                    onClick={handleClearFilter}
                    className="ml-auto text-[12px] cursor-pointer transition-colors hover:text-primary shrink-0"
                    style={{ fontWeight: 500, color: "#0A77FF" }}
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
                    <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">No options found</div>
                  ) : (
                    filteredValues.map((value) => {
                      const selected = currentFilter.values.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleToggleValue(value)}
                          className={`flex items-center gap-2.5 w-full px-2.5 py-[6px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/50 ${
                            selected ? "bg-primary/5" : ""
                          }`}
                        >
                          <Checkbox checked={selected} className="pointer-events-none" />
                          {columnKey === "status" && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: getStatusColor(value) }}
                            />
                          )}
                          <span style={{ fontWeight: selected ? 500 : 400 }}>
                            {highlightMatch(value, filterSearch)}
                          </span>
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
                        className="text-[12px] cursor-pointer transition-colors hover:text-primary"
                        style={{ fontWeight: 500, color: "#0A77FF" }}
                      >
                        Clear selection
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
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>Min</label>
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
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>Max</label>
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
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>From</label>
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
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>To</label>
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

/* ─── Column Filter Chip (used in ActiveFiltersBar) ─── */
interface ColumnFilterChipProps {
  filter: ColumnFilterState;
  label: string;
  items: Item[];
  onFilterChange: (filter: ColumnFilterState) => void;
  onRemove: () => void;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
}

export function ItemColumnFilterChip({
  filter,
  label,
  items,
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
  const operatorLabel = filter.type === "multiselect" ? "is" :
                        filter.type === "text" ? "contains" : "between";

  const uniqueValues = useMemo(() => getUniqueValues(filter.columnKey, items), [filter.columnKey, items]);
  const filteredValues = useMemo(() => {
    if (!search.trim()) return uniqueValues;
    return uniqueValues.filter((v) => v.toLowerCase().includes(search.toLowerCase()));
  }, [uniqueValues, search]);

  const toggleValue = (value: string) => {
    const newValues = filter.values.includes(value)
      ? filter.values.filter((v) => v !== value)
      : [...filter.values, value];
    onFilterChange({ ...filter, values: newValues });
  };

  const clearSelection = () => {
    onFilterChange({ ...filter, values: [], text: "", min: "", max: "", dateFrom: "", dateTo: "" });
  };

  const chipSummary = useMemo(() => {
    if (!active) return "";
    switch (filter.type) {
      case "multiselect":
        if (filter.values.length === 1) return filter.values[0];
        return `${filter.values.length} selected`;
      case "text": return filter.text;
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
      default: return "";
    }
  }, [active, filter]);

  return (
    <div className="flex items-center shrink-0">
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1 h-[30px] pl-2.5 rounded-l-md border text-[13px] cursor-pointer transition-colors ${
              active
                ? "border-primary/30 bg-[#EDF4FF] text-primary hover:bg-[#D6E8FF]"
                : "border-border bg-white text-foreground hover:bg-muted/50"
            } ${open ? "border-primary/40" : ""}`}
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
        <PopoverContent align="start" sideOffset={6} className="w-[260px] p-0 rounded-lg shadow-lg border border-border/80 z-[200] bg-white">
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
                  <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">No options found</div>
                ) : (
                  filteredValues.map((value) => {
                    const selected = filter.values.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleValue(value)}
                        className={`flex items-center gap-2.5 w-full px-2.5 py-[6px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/50 ${selected ? "bg-primary/5" : ""}`}
                      >
                        <Checkbox checked={selected} className="pointer-events-none" />
                        {filter.columnKey === "status" && (
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getStatusColor(value) }} />
                        )}
                        <span style={{ fontWeight: selected ? 500 : 400 }}>
                          {highlightMatch(value, search)}
                        </span>
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
                      className="text-[13px] cursor-pointer transition-colors hover:text-primary"
                      style={{ fontWeight: 500, color: "#0A77FF" }}
                    >
                      Clear selection
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
                  className="mt-2 text-[13px] cursor-pointer transition-colors hover:text-primary"
                  style={{ fontWeight: 500, color: "#0A77FF" }}
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
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>Min</label>
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
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>Max</label>
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
                  className="mt-2 text-[13px] cursor-pointer transition-colors hover:text-primary"
                  style={{ fontWeight: 500, color: "#0A77FF" }}
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
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>From</label>
                  <input
                    type="date"
                    value={filter.dateFrom}
                    onChange={(e) => onFilterChange({ ...filter, dateFrom: e.target.value })}
                    className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF]"
                  />
                </div>
                <span className="text-muted-foreground/30 mt-4">–</span>
                <div className="flex-1">
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>To</label>
                  <input
                    type="date"
                    value={filter.dateTo}
                    onChange={(e) => onFilterChange({ ...filter, dateTo: e.target.value })}
                    className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF]"
                  />
                </div>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={onRemove}
        className={`inline-flex items-center justify-center h-[30px] w-[28px] rounded-r-md border border-l-0 cursor-pointer transition-colors ${
          active
            ? "border-primary/30 bg-[#EDF4FF] text-primary/60 hover:text-primary hover:bg-[#D6E8FF]"
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
  items: Item[];
  onFilterChange: (columnKey: string, filter: ColumnFilterState) => void;
  onRemoveFilter: (columnKey: string) => void;
  onAddFilter: (columnKey: string) => void;
  onClearAll: () => void;
  autoOpenKey: string | null;
  onAutoOpened: () => void;
  availableColumns: { key: string; label: string }[];
}

export function ItemActiveFiltersBar({
  columnFilters,
  columnLabels,
  items,
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
    (c) => !existingKeys.has(c.key) && c.key !== "part_number"
  );
  const filteredAddable = addSearch.trim()
    ? addableColumns.filter((c) => c.label.toLowerCase().includes(addSearch.toLowerCase()))
    : addableColumns;

  return (
    <div className="flex items-center gap-2 px-4 pb-2.5 overflow-x-auto">
      {columnFilters.map((filter) => (
        <ItemColumnFilterChip
          key={filter.columnKey}
          filter={filter}
          label={columnLabels[filter.columnKey] || filter.columnKey}
          items={items}
          onFilterChange={(updated) => onFilterChange(filter.columnKey, updated)}
          onRemove={() => onRemoveFilter(filter.columnKey)}
          autoOpen={autoOpenKey === filter.columnKey}
          onAutoOpened={onAutoOpened}
        />
      ))}

      {addableColumns.length > 0 && (
        <Popover open={addFilterOpen} onOpenChange={(v) => { setAddFilterOpen(v); if (!v) setAddSearch(""); }}>
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
          <PopoverContent align="start" sideOffset={6} className="w-[220px] p-0 rounded-lg shadow-lg border border-border/80 z-[200] bg-white">
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
                <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">No columns available</div>
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
            Clear all
          </button>
        </>
      )}
    </div>
  );
}

/* ─── Apply column filters to items ─── */
export function applyItemColumnFilters(
  items: Item[],
  columnFilters: ColumnFilterState[]
): Item[] {
  if (columnFilters.length === 0) return items;
  return items.filter((i) => {
    for (const filter of columnFilters) {
      if (!isFilterActive(filter)) continue;
      switch (filter.columnKey) {
        case "part_number":
          if (filter.text && !i.partNumber?.toLowerCase().includes(filter.text.toLowerCase())) return false;
          break;
        case "description":
          if (filter.text && !i.description?.toLowerCase().includes(filter.text.toLowerCase())) return false;
          break;
        case "status":
          if (filter.values.length > 0 && !filter.values.includes(i.status)) return false;
          break;
        case "inventory_control":
          if (filter.values.length > 0 && !filter.values.includes(i.inventoryControlType)) return false;
          break;
        case "primary_category":
          if (filter.values.length > 0 && !filter.values.includes(i.primaryCategory)) return false;
          break;
        case "manufacturer":
          if (filter.values.length > 0 && !filter.values.includes(i.manufacturer)) return false;
          break;
        case "acquisition_method": {
          if (filter.values.length > 0) {
            const a = i.acquisitionMethod;
            const label = typeof a === "string" ? a : a?.primary ?? "";
            if (!filter.values.includes(label)) return false;
          }
          break;
        }
        case "on_hand_qty":
          if (filter.min && i.onHandQty < Number(filter.min)) return false;
          if (filter.max && i.onHandQty > Number(filter.max)) return false;
          break;
        case "mpn":
          if (filter.text && !(i.mpn || "").toLowerCase().includes(filter.text.toLowerCase())) return false;
          break;
        case "unit":
          if (filter.text && !(i.unit || "").toLowerCase().includes(filter.text.toLowerCase())) return false;
          break;
        case "created_on":
          if (filter.dateFrom && i.createdAt) {
            const from = new Date(filter.dateFrom);
            if (new Date(i.createdAt) < from) return false;
          }
          if (filter.dateTo && i.createdAt) {
            const to = new Date(filter.dateTo);
            to.setHours(23, 59, 59, 999);
            if (new Date(i.createdAt) > to) return false;
          }
          break;
      }
    }
    return true;
  });
}
