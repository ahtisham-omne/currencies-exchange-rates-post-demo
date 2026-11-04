import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { formatMoneyText } from '@/app/components/payments/MoneyInput';
import type { ReactNode } from "react";
import React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
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
  Clock,
} from "lucide-react";
import { Checkbox } from "@/app/components/ui/checkbox";

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.trim().length === 0) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        className="bg-transparent px-0.5 rounded-sm"
        style={{ backgroundColor: palette.yellow[50], color: palette.yellow[800], fontWeight: 500 }}
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/* ─── Types (re-exported from types.ts so this file is the canonical menu API) ─── */

import type { FilterType, ColumnFilterState, SortConfig, ColumnExtraSort } from "./types";
import { palette } from '@/styles/tokens';
export type { FilterType, ColumnFilterState, SortConfig };
export type SortDirection = "asc" | "desc" | null;

/** Create a blank filter state. Caller supplies the FilterType (the
 *  generic shell doesn't know which columns are multiselect vs range etc.). */
export function createBlankFilter(columnKey: string, type: FilterType = "text"): ColumnFilterState {
  return {
    columnKey,
    type,
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

/* ─── Column Header Menu ─── */

interface ColumnHeaderMenuProps {
  columnKey: string;
  label: string;
  sortable?: boolean;
  /** Extra named sorts listed under asc/desc (e.g. "Most overdue"). */
  extraSorts?: ColumnExtraSort[];
  sortConfig: SortConfig | null;
  onSort: (key: string, direction: "asc" | "desc" | null) => void;
  onAddFilter: (columnKey: string) => void;
  onHideColumn: (columnKey: string) => void;
  onFreezeColumn?: (columnKey: string) => void;
  isFrozen?: boolean;
  isLocked?: boolean;
  hasActiveFilter?: boolean;
  filter?: ColumnFilterState | null;
  /** False drops the Filter action — identifier columns (invoice number,
   *  vendor invoice number) where filtering a unique value makes no sense. */
  filterable?: boolean;
  /** Unique values for multiselect filter dropdown. Required when filterType is 'multiselect'. */
  uniqueValues?: string[];
  /** Filter type — drives the inline filter UI. */
  filterType?: FilterType;
  /** Optional value→display formatter (e.g. capitalise status strings). */
  formatValueLabel?: (value: string) => string;
  onFilterChange?: (columnKey: string, filter: ColumnFilterState) => void;
  /** When set, swallow the next open attempt — set by parent right after a header drag. */
  suppressOpenRef?: React.MutableRefObject<boolean>;
  children: ReactNode;
}

export function ColumnHeaderMenu({
  columnKey,
  label,
  sortable,
  extraSorts = [],
  sortConfig,
  onSort,
  onAddFilter,
  onHideColumn,
  onFreezeColumn,
  isFrozen,
  isLocked,
  hasActiveFilter,
  filter,
  filterable = true,
  uniqueValues = [],
  filterType = "text",
  formatValueLabel,
  onFilterChange,
  suppressOpenRef,
  children,
}: ColumnHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "filter">("menu");
  const [filterSearch, setFilterSearch] = useState("");

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && suppressOpenRef?.current) return;
      setOpen(nextOpen);
      if (!nextOpen) {
        setTimeout(() => {
          setView("menu");
          setFilterSearch("");
        }, 150);
      }
    },
    [suppressOpenRef]
  );

  const currentSort: SortDirection = sortConfig?.key === columnKey ? sortConfig.direction : null;
  const activeExtra = extraSorts.find((x) => sortConfig?.key === x.key && sortConfig.direction === x.direction) ?? null;

  const handleSort = (dir: "asc" | "desc") => {
    if (currentSort === dir) onSort(columnKey, null);
    else onSort(columnKey, dir);
    setOpen(false);
  };

  const handleExtraSort = (x: ColumnExtraSort) => {
    if (activeExtra?.key === x.key) onSort(x.key, null);
    else onSort(x.key, x.direction);
    setOpen(false);
  };

  const handleFilterClick = () => {
    onAddFilter(columnKey);
    setView("filter");
  };

  const handleHide = () => {
    onHideColumn(columnKey);
    setOpen(false);
  };

  const handleFreeze = () => {
    onFreezeColumn?.(columnKey);
    setOpen(false);
  };

  const blankFilter = useMemo(() => createBlankFilter(columnKey, filterType), [columnKey, filterType]);
  const currentFilter = filter ?? blankFilter;

  const fmt = useCallback(
    (value: string) => (formatValueLabel ? formatValueLabel(value) : value),
    [formatValueLabel]
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
    onFilterChange(columnKey, {
      ...currentFilter,
      values: [],
      text: "",
      min: "",
      max: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  const handleInlineFilterChange = (updated: ColumnFilterState) => {
    onFilterChange?.(columnKey, updated);
  };

  const operatorLabel =
    currentFilter.type === "multiselect"
      ? "is"
      : currentFilter.type === "text"
        ? "contains"
        : "between";

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
        className={`p-0 rounded-lg shadow-lg border border-border/80 z-[200] ${
          view === "filter"
            ? currentFilter.type === "date"
              ? "w-[340px]"
              : "w-[260px]"
            : "w-[220px]"
        }`}
      >
        {view === "menu" ? (
          <>
            {/* Eyebrow header — plain label with the current sort
                direction, matching the partner listing's column menu (the
                old boxed version read as an input field, feedback 7/16/26). */}
            <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground truncate" style={{ fontWeight: 600 }}>
                {label}
              </span>
              {currentSort === "asc" && <ArrowUp className="w-3 h-3 text-primary shrink-0" />}
              {currentSort === "desc" && <ArrowDown className="w-3 h-3 text-primary shrink-0" />}
              {activeExtra && <Clock className="w-3 h-3 text-primary shrink-0" />}
            </div>

            <div className="border-t border-border/60" />

            <div className="py-1 px-1">
              {filterable && (
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
              )}

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
                    <span style={{ fontWeight: 400 }}>Sort Ascending</span>
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
                    <span style={{ fontWeight: 400 }}>Sort Descending</span>
                    {currentSort === "desc" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>
                  {extraSorts.map((x) => {
                    const isOn = activeExtra?.key === x.key;
                    return (
                      <button
                        key={x.key}
                        type="button"
                        onClick={() => handleExtraSort(x)}
                        className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
                          isOn ? "text-primary bg-primary/5" : "text-foreground"
                        }`}
                      >
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span style={{ fontWeight: 400 }}>{x.label}</span>
                        {isOn && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
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
                  onClick={() => {
                    setView("menu");
                    setFilterSearch("");
                  }}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md cursor-pointer transition-colors hover:bg-muted/60 text-muted-foreground shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 text-[13px] min-w-0">
                  <span className="truncate" style={{ fontWeight: 500, color: "hsl(var(--foreground))" }}>
                    {label}
                  </span>
                  <span className="text-muted-foreground/50 shrink-0">{operatorLabel}</span>
                </div>
                {isFilterActive(currentFilter) && (
                  <button
                    type="button"
                    onClick={handleClearFilter}
                    className="ml-auto text-[12px] cursor-pointer transition-colors hover:text-primary shrink-0"
                    style={{ fontWeight: 500, color: "hsl(var(--primary))" }}
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
                        className="w-full h-8 pl-8 pr-3 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-pill-hover focus:border-accent-pill-active placeholder:text-muted-foreground/40"
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
                      const displayLabel = fmt(value);
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
                          <span style={{ fontWeight: selected ? 500 : 400 }}>
                            {highlightMatch(displayLabel, filterSearch)}
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
                      <span className="text-[12px] text-muted-foreground">{currentFilter.values.length} Selected</span>
                      <button
                        type="button"
                        onClick={handleClearFilter}
                        className="text-[12px] cursor-pointer transition-colors hover:text-primary"
                        style={{ fontWeight: 500, color: "hsl(var(--primary))" }}
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
                  placeholder={`Filter by ${label}…`}
                  className="w-full h-8 px-3 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-pill-hover focus:border-accent-pill-active placeholder:text-muted-foreground/40"
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
                      type="text"
                      inputMode="decimal"
                      value={formatMoneyText(currentFilter.min)}
                      onChange={(e) => handleInlineFilterChange({ ...currentFilter, min: e.target.value.replace(/[^\d.]/g, '') })}
                      placeholder="0"
                      className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-pill-hover focus:border-accent-pill-active "
                      autoFocus
                    />
                  </div>
                  <span className="text-muted-foreground/30 mt-4">–</span>
                  <div className="flex-1">
                    <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                      Max
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatMoneyText(currentFilter.max)}
                      onChange={(e) => handleInlineFilterChange({ ...currentFilter, max: e.target.value.replace(/[^\d.]/g, '') })}
                      placeholder="∞"
                      className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-pill-hover focus:border-accent-pill-active "
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
                      className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-pill-hover focus:border-accent-pill-active"
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
                      className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-pill-hover focus:border-accent-pill-active"
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
  formatValueLabel?: (value: string) => string;
  onFilterChange: (filter: ColumnFilterState) => void;
  onRemove: () => void;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
}

export function ColumnFilterChip({
  filter,
  label,
  uniqueValues = [],
  formatValueLabel,
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
  const fmt = useCallback(
    (value: string) => (formatValueLabel ? formatValueLabel(value) : value),
    [formatValueLabel]
  );

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

  const clearSelection = () => {
    onFilterChange({
      ...filter,
      values: [],
      text: "",
      min: "",
      max: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  const chipSummary = useMemo(() => {
    if (!active) return "";
    switch (filter.type) {
      case "multiselect":
        if (filter.values.length === 1) return fmt(filter.values[0]);
        return `${filter.values.length} Selected`;
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
                ? "border-primary/30 bg-accent text-primary hover:bg-accent-pill-hover"
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
        <PopoverContent
          align="start"
          sideOffset={6}
          className={`p-0 rounded-lg shadow-lg border border-border/80 z-[200] ${
            filter.type === "date" ? "w-[340px]" : "w-[260px]"
          }`}
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
                      className="w-full h-8 pl-8 pr-3 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-pill-hover focus:border-accent-pill-active placeholder:text-muted-foreground/40"
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
                        className={`flex items-center gap-2.5 w-full px-2.5 py-[6px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/50 ${
                          selected ? "bg-primary/5" : ""
                        }`}
                      >
                        <Checkbox checked={selected} className="pointer-events-none" />
                        <span style={{ fontWeight: selected ? 500 : 400 }}>
                          {highlightMatch(fmt(value), search)}
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
                      style={{ fontWeight: 500, color: "hsl(var(--primary))" }}
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
                placeholder={`Filter by ${label}…`}
                className="w-full h-8 px-3 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-pill-hover focus:border-accent-pill-active placeholder:text-muted-foreground/40"
                autoFocus
              />
              {filter.text && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="mt-2 text-[13px] cursor-pointer transition-colors hover:text-primary"
                  style={{ fontWeight: 500, color: "hsl(var(--primary))" }}
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
                    type="text"
                    inputMode="decimal"
                    value={formatMoneyText(filter.min)}
                    onChange={(e) => onFilterChange({ ...filter, min: e.target.value.replace(/[^\d.]/g, '') })}
                    placeholder="0"
                    className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-pill-hover focus:border-accent-pill-active "
                  />
                </div>
                <span className="text-muted-foreground/30 mt-4">–</span>
                <div className="flex-1">
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                    Max
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatMoneyText(filter.max)}
                    onChange={(e) => onFilterChange({ ...filter, max: e.target.value.replace(/[^\d.]/g, '') })}
                    placeholder="∞"
                    className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-pill-hover focus:border-accent-pill-active "
                  />
                </div>
              </div>
              {(filter.min || filter.max) && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="mt-2 text-[13px] cursor-pointer transition-colors hover:text-primary"
                  style={{ fontWeight: 500, color: "hsl(var(--primary))" }}
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
                    className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-pill-hover focus:border-accent-pill-active"
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
                    className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-pill-hover focus:border-accent-pill-active"
                  />
                </div>
              </div>
              {(filter.dateFrom || filter.dateTo) && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="mt-2 text-[13px] cursor-pointer transition-colors hover:text-primary"
                  style={{ fontWeight: 500, color: "hsl(var(--primary))" }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={onRemove}
        className={`inline-flex items-center justify-center h-[30px] w-[28px] rounded-r-md border border-l-0 cursor-pointer transition-colors ${
          active
            ? "border-primary/30 bg-accent text-primary/60 hover:text-primary hover:bg-accent-pill-hover"
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
  /** column key → unique values for multiselect chips */
  uniqueValuesByKey?: Record<string, string[]>;
  /** column key → label formatter (e.g. capitalise) */
  formatValueLabelByKey?: Record<string, (value: string) => string>;
  /** The key of the locked/pinned column that should be excluded from the "+ Filter" picker */
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
  formatValueLabelByKey,
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
    (c) => !existingKeys.has(c.key) && c.key !== lockedColumnKey
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
          formatValueLabel={formatValueLabelByKey?.[filter.columnKey]}
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
          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-[220px] p-0 rounded-lg shadow-lg border border-border/80 z-[200]"
          >
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                <input
                  type="text"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Search columns…"
                  className="w-full h-8 pl-8 pr-3 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent-pill-hover focus:border-accent-pill-active placeholder:text-muted-foreground/40"
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
            Clear All
          </button>
        </>
      )}
    </div>
  );
}
