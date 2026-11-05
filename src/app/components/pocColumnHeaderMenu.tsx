import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
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
import { Checkbox } from "./ui/checkbox";

/* ─── Minimal Vendor stub kept local to this file so the filter helpers
 *  retain the same call signatures Partners uses. Inside the PO modal we
 *  don't actually pass vendor arrays into the header menu, but the
 *  filter machinery is still typed against the same shape. ─── */
type PartnerType = "vendor" | "customer";
interface Vendor {
  partnerTypes?: PartnerType[];
  vendorType?: string;
  partnerGroup?: string;
  services?: string;
  defaultCarrierVendor?: string;
  defaultCarrierCustomer?: string;
  country?: string;
  createdByContact?: { name?: string };
  status?: string;
  displayName?: string;
  itemCodes?: string[];
  partnerLocations?: string[];
  globalPointOfContacts?: { name: string }[];
  netProfitMargin?: number;
  creditLimit?: number;
  creditUtilization?: number;
  website?: string;
  emailAddress?: string;
  createdAt?: string;
}

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
  values: string[];    // for multiselect
  text: string;        // for text search
  min: string;         // for range min
  max: string;         // for range max
  dateFrom: string;    // for date from
  dateTo: string;      // for date to
}

export type SortDirection = "asc" | "desc" | null;
export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

/** Determine filter type for a given column key */
export function getFilterType(columnKey: string): FilterType {
  switch (columnKey) {
    case "partner_type":
    case "vendor_type":
    case "partner_group":
    case "services":
    case "carrier_vendor":
    case "carrier_customer":
    case "country":
    case "created_by":
    case "status":
      return "multiselect";
    case "net_profit":
    case "credit_limit":
    case "credit_utilization":
      return "range";
    case "created_on":
      return "date";
    default:
      return "text";
  }
}

/** Create a blank filter state for a column */
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

/** Check if a column filter has any active values */
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

/** Get unique values for a column from vendor data */
export function getUniqueValues(columnKey: string, vendors: Vendor[]): string[] {
  const valuesSet = new Set<string>();

  vendors.forEach((v) => {
    switch (columnKey) {
      case "partner_type":
        (v.partnerTypes || []).forEach((t) => valuesSet.add(t));
        break;
      case "vendor_type":
        if (v.vendorType) valuesSet.add(v.vendorType);
        break;
      case "partner_group":
        if (v.partnerGroup) valuesSet.add(v.partnerGroup);
        break;
      case "services":
        if (v.services) valuesSet.add(v.services);
        break;
      case "carrier_vendor":
        if (v.defaultCarrierVendor) valuesSet.add(v.defaultCarrierVendor);
        break;
      case "carrier_customer":
        if (v.defaultCarrierCustomer) valuesSet.add(v.defaultCarrierCustomer);
        break;
      case "country":
        if (v.country) valuesSet.add(v.country);
        break;
      case "created_by":
        if (v.createdByContact?.name) valuesSet.add(v.createdByContact.name);
        break;
      case "status":
        if (v.status) valuesSet.add(v.status);
        break;
    }
  });

  return Array.from(valuesSet).sort();
}

/** Get display label for a value */
function formatValueLabel(columnKey: string, value: string): string {
  if (columnKey === "partner_type") {
    return value === "vendor" ? "Vendor" : value === "customer" ? "Customer" : value;
  }
  if (columnKey === "status") {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return value;
}

/** Get status dot color */
function getStatusColor(status: string): string {
  switch (status) {
    case "active": return "#22C55E";
    case "inactive": return "#F59E0B";
    case "archived": return "#6B7280";
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
  /** Optional — when omitted the Filter menu item is hidden (planner
      surfaces use a toolbar-level filter, not per-column chips). */
  onAddFilter?: (columnKey: string) => void;
  onHideColumn: (columnKey: string) => void;
  onFreezeColumn?: (columnKey: string) => void;
  isFrozen?: boolean;
  isLocked?: boolean;
  hasActiveFilter?: boolean;
  /** Pass the current filter state + vendors + change handler for inline filter editing */
  filter?: ColumnFilterState | null;
  vendors?: Vendor[];
  /** Optional override for unique filter values (used by non-vendor tables) */
  uniqueValues?: string[];
  /** Optional override for the filter type — used when the column key is not a built-in vendor key */
  filterTypeOverride?: FilterType;
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
  vendors,
  uniqueValues: uniqueValuesProp,
  filterTypeOverride,
  onFilterChange,
  children,
}: ColumnHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "filter">("menu");
  const [filterSearch, setFilterSearch] = useState("");

  // Reset view when popover closes
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Delay reset so the close animation completes
      setTimeout(() => {
        setView("menu");
        setFilterSearch("");
      }, 150);
    }
  }, []);

  const currentSort: SortDirection =
    sortConfig?.key === columnKey ? sortConfig.direction : null;

  const handleSort = (dir: "asc" | "desc") => {
    if (currentSort === dir) {
      onSort(columnKey, null);
    } else {
      onSort(columnKey, dir);
    }
    setOpen(false);
  };

  const handleFilterClick = () => {
    if (!onAddFilter) return;
    // Ensure the filter chip exists in the ActiveFiltersBar
    onAddFilter(columnKey);
    // Switch to inline filter view instead of closing
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

  // ─── Inline filter helpers ───
  const blankFilter = useMemo(() => {
    const f = createBlankFilter(columnKey);
    if (filterTypeOverride) f.type = filterTypeOverride;
    return f;
  }, [columnKey, filterTypeOverride]);
  const currentFilter = filter ?? blankFilter;

  const uniqueValues = useMemo(
    () => (uniqueValuesProp ?? (vendors ? getUniqueValues(columnKey, vendors) : [])),
    [columnKey, vendors, uniqueValuesProp]
  );

  const filteredValues = useMemo(() => {
    if (!filterSearch.trim()) return uniqueValues;
    const q = filterSearch.toLowerCase();
    return uniqueValues.filter((v) =>
      formatValueLabel(columnKey, v).toLowerCase().includes(q)
    );
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
      values: [],
      text: "",
      min: "",
      max: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  const handleInlineFilterChange = (updated: ColumnFilterState) => {
    if (!onFilterChange) return;
    onFilterChange(columnKey, updated);
  };

  const operatorLabel = currentFilter.type === "multiselect" ? "is" :
                        currentFilter.type === "text" ? "contains" :
                        currentFilter.type === "range" ? "between" : "between";

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
            {/* Column name display — small-caps section label (matches the
                app-wide dropdown heading style). Replaces the previous
                bordered pill so column menus feel consistent with other
                dropdowns in the product. */}
            <div className="px-3 pt-2.5 pb-1.5">
              <span
                className="text-[11px] uppercase tracking-wider text-muted-foreground"
                style={{ fontWeight: 600, letterSpacing: "0.06em" }}
              >
                {label}
              </span>
            </div>

            <div className="border-t border-border/60" />

            {/* Menu items */}
            <div className="py-1 px-1">
              {/* Filter — only shown when the host wires up onAddFilter. Planning
                  tables leave it off so the menu is just Sort/Hide/Freeze. */}
              {onAddFilter && (
                <button
                  type="button"
                  onClick={handleFilterClick}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
                    hasActiveFilter ? "text-primary" : "text-foreground"
                  }`}
                >
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span style={{ fontWeight: 400 }}>Filter</span>
                  {hasActiveFilter && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </button>
              )}

              {/* Sort */}
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
                    {currentSort === "asc" && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
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
                    {currentSort === "desc" && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                </>
              )}

              {/* Separator only when there's a section below (Hide/Freeze).
                  Locked columns have neither and would otherwise show a
                  trailing divider. */}
              {!isLocked && (
                <div className="border-t border-border/60 my-1" />
              )}

              {/* Hide */}
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

              {/* Freeze — hidden for locked columns (they're always frozen) */}
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
          /* ─── Inline Filter View ─── */
          <>
            {/* Header with back button */}
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
                  <span className="truncate" style={{ fontWeight: 500, color: "hsl(var(--foreground))" }}>{label}</span>
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

            {/* Filter content based on type */}
            {currentFilter.type === "multiselect" && (
              <div>
                {/* Search */}
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

                {/* Options */}
                <div className="max-h-[240px] overflow-y-auto py-1 px-1">
                  {filteredValues.length === 0 ? (
                    <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">
                      No options found
                    </div>
                  ) : (
                    filteredValues.map((value) => {
                      const selected = currentFilter.values.includes(value);
                      const displayLabel = formatValueLabel(columnKey, value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleToggleValue(value)}
                          className={`flex items-center gap-2.5 w-full px-2.5 py-[6px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/50 ${
                            selected ? "bg-primary/5" : ""
                          }`}
                        >
                          <Checkbox
                            checked={selected}
                            className="pointer-events-none"
                          />
                          {columnKey === "status" && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: getStatusColor(value) }}
                            />
                          )}
                          <span style={{ fontWeight: selected ? 500 : 400 }}>
                            {highlightMatch(displayLabel, filterSearch)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Selected count footer */}
                {currentFilter.values.length > 0 && (
                  <>
                    <div className="border-t border-border/40" />
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[12px] text-muted-foreground">
                        {currentFilter.values.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={handleClearFilter}
                        className="text-[12px] cursor-pointer transition-colors hover:text-primary"
                        style={{ fontWeight: 500, color: "hsl(var(--primary))" }}
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
