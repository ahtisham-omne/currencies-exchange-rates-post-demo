import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import React from "react";
import type { Vendor } from "../../data/vendors";
import { getLastUpdated } from "../../utils/lastUpdated";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
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
  Banknote,
  Globe,
} from "lucide-react";
import { partnerCurrencyOf, toBaseNow } from "@/app/currency/partnerCurrency";
import type { CurrencyView } from "@/app/currency/partnerAmounts";
import { Checkbox } from "../ui/checkbox";

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

/** Determine filter type for a given column key.
 *
 * Per the Column Filters spec (Eli, 7 Sep 2026) the filter control is
 * chosen ONLY by the column's data type: constrained value set →
 * multiselect checkboxes, number → min/max range, date → from/to,
 * everything else → free-text search. This switch is the fallback for
 * the built-in Partners column keys; new tables should declare
 * `filterType` on their column defs and pass it explicitly. */
export function getFilterType(columnKey: string): FilterType {
  switch (columnKey) {
    case "partner_type":
    case "vendor_type":
    // Sub-types come from the fixed VENDOR_SUB_TYPES / CUSTOMER_SUB_TYPES
    // pick-lists → constrained set, not free text.
    case "vendor_sub_types":
    case "customer_sub_types":
    case "partner_group":
    case "services":
    case "carrier_vendor":
    case "carrier_customer":
    case "country":
    case "created_by":
    case "last_updated_by":
    case "status":
      return "multiselect";
    // No. of Items is a numeric count → range, not an item-code text search.
    case "num_items":
    case "net_profit":
    case "credit_limit":
    case "credit_utilization":
      return "range";
    case "created_on":
    case "last_updated_on":
      return "date";
    default:
      return "text";
  }
}

/** Create a blank filter state for a column. Pass `type` explicitly for
 *  non-vendor tables (from the table's own column defs). */
export function createBlankFilter(columnKey: string, type?: FilterType): ColumnFilterState {
  return {
    columnKey,
    type: type ?? getFilterType(columnKey),
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

/* ─── Generic filter engine ───
 *
 * The four filter semantics (contains / in-set / min-max / date-between)
 * live here ONCE, keyed purely by ColumnFilterState.type — never by
 * column key or module (the spec bans bespoke per-module filters).
 * A table plugs in with a CellAccessor mapping (row, columnKey) → raw
 * value; `vendorCellValue` below is the Partners reference accessor and
 * keeps the original Vendor-typed signatures working unchanged. */

export type CellValue = string | number | Date | null | undefined | Array<string | number>;
/** Maps (row, columnKey) → raw filterable value(s). Arrays mean "match any element". */
export type CellAccessor<T> = (row: T, columnKey: string) => CellValue;

function matchesFilter(value: CellValue, filter: ColumnFilterState): boolean {
  switch (filter.type) {
    case "text": {
      const q = filter.text.toLowerCase();
      if (Array.isArray(value)) return value.some((el) => String(el).toLowerCase().includes(q));
      return String(value ?? "").toLowerCase().includes(q);
    }
    case "multiselect": {
      if (Array.isArray(value)) return value.some((el) => filter.values.includes(String(el)));
      return filter.values.includes(String(value ?? ""));
    }
    case "range": {
      const n = typeof value === "number" ? value : value == null || Array.isArray(value) ? NaN : Number(value);
      if (Number.isNaN(n)) return false;
      if (filter.min !== "" && n < Number(filter.min)) return false;
      if (filter.max !== "" && n > Number(filter.max)) return false;
      return true;
    }
    case "date": {
      if (value == null || Array.isArray(value)) return false;
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) return false;
      if (filter.dateFrom && d < new Date(filter.dateFrom)) return false;
      if (filter.dateTo) {
        const to = new Date(filter.dateTo);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
      return true;
    }
    default:
      return true;
  }
}

/** Apply active column filters to any row set via a cell accessor. */
export function applyFilters<T>(
  rows: T[],
  columnFilters: ColumnFilterState[],
  getCellValue: CellAccessor<T>,
): T[] {
  const active = columnFilters.filter(isFilterActive);
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every((f) => matchesFilter(getCellValue(row, f.columnKey), f)));
}

/** Distinct values for a column (multiselect checkbox options) from any row set. */
export function getUniqueColumnValues<T>(
  columnKey: string,
  rows: T[],
  getCellValue: CellAccessor<T>,
): string[] {
  const valuesSet = new Set<string>();
  rows.forEach((row) => {
    const value = getCellValue(row, columnKey);
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach((el) => { if (el != null && String(el) !== "") valuesSet.add(String(el)); });
    } else if (String(value) !== "") {
      valuesSet.add(String(value));
    }
  });
  return Array.from(valuesSet).sort();
}

/** Sort rows via the same cell accessor the filters use. `getType` lets the
 *  caller pass its column-def filter types so numeric ("range") and "date"
 *  columns compare as numbers/dates instead of strings. */
export function sortRows<T>(
  rows: T[],
  sortConfig: SortConfig | null,
  getCellValue: CellAccessor<T>,
  getType?: (columnKey: string) => FilterType | undefined,
): T[] {
  if (!sortConfig) return rows;
  const dir = sortConfig.direction === "asc" ? 1 : -1;
  const type = getType?.(sortConfig.key);
  const norm = (v: CellValue): string | number | Date | null => {
    if (v == null) return null;
    if (Array.isArray(v)) return v.map(String).join(", ");
    return v;
  };
  return [...rows].sort((a, b) => {
    const av = norm(getCellValue(a, sortConfig.key));
    const bv = norm(getCellValue(b, sortConfig.key));
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulls last regardless of direction
    if (bv == null) return -1;
    if (type === "range") return (Number(av) - Number(bv)) * dir;
    if (type === "date") return (new Date(av).getTime() - new Date(bv).getTime()) * dir;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

/** Canonical accessor for the Partners grid (the reference implementation). */
export const vendorCellValue: CellAccessor<Vendor> = (v, columnKey) => {
  switch (columnKey) {
    case "partner_name": return v.displayName;
    case "partner_type": return v.partnerTypes;
    case "vendor_type": return v.vendorType;
    // Numeric count — pairs with the range filter per the data-type rule.
    case "num_items": return (v.itemCodes || []).length;
    // Match the rendered pills, which hide the base profile entries.
    case "vendor_sub_types": return (v.vendorSubTypes || []).filter((s) => s !== "Vendor Rules");
    case "customer_sub_types": return (v.customerSubTypes || []).filter((s) => s !== "Customer Rules");
    case "partner_locations": return v.partnerLocations;
    case "global_contacts": return (v.globalPointOfContacts || []).map((c) => c.name);
    case "partner_group": return v.partnerGroup;
    // Money columns filter and sort on the base-currency amount (each
    // partner's is in its own currency).
    case "net_profit": return toBaseNow(v.netProfitMargin, partnerCurrencyOf(v));
    case "credit_limit": return toBaseNow(v.creditLimit, partnerCurrencyOf(v));
    case "credit_utilization": return toBaseNow(v.creditUtilization, partnerCurrencyOf(v));
    case "services": return v.services;
    case "carrier_vendor": return v.defaultCarrierVendor;
    case "carrier_customer": return v.defaultCarrierCustomer;
    case "country": return v.country;
    case "website": return v.website;
    case "email": return v.emailAddress;
    case "created_by": return v.createdByContact?.name;
    case "last_updated_by": return getLastUpdated(v.id, v.createdAt).name;
    case "last_updated_on": return getLastUpdated(v.id, v.createdAt).date;
    case "created_on": return v.createdAt;
    case "status": return v.status;
    default: return undefined;
  }
};

/** Get unique values for a column from vendor data */
export function getUniqueValues(columnKey: string, vendors: Vendor[]): string[] {
  return getUniqueColumnValues(columnKey, vendors, vendorCellValue);
}

/** Written labels for stored status codes (no display case transform). */
const STATUS_VALUE_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
  disabled: "Disabled",
  pending: "Pending",
  draft: "Draft",
};

/** Get display label for a value */
function formatValueLabel(columnKey: string, value: string): string {
  if (columnKey === "partner_type") {
    return value === "vendor" ? "Vendor" : value === "customer" ? "Customer" : value;
  }
  if (columnKey === "status") {
    return STATUS_VALUE_LABELS[value] ?? value;
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
  onAddFilter: (columnKey: string) => void;
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
  /** A money column: show its amounts in the base or each partner's currency. */
  currencyView?: CurrencyView;
  onCurrencyViewChange?: (view: CurrencyView) => void;
  /** Shown under the switch, e.g. what sorting uses. */
  currencyNote?: string;
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
  currencyView,
  onCurrencyViewChange,
  currencyNote,
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
            {/* Column name heading — plain text, not an input-looking box */}
            <div className="px-3 pt-2.5 pb-2">
              <span className="text-[11px] tracking-wide text-muted-foreground/80" style={{ fontWeight: 600 }}>
                {label}
              </span>
            </div>

            <div className="border-t border-border/60" />

            {/* Menu items */}
            <div className="py-1 px-1">
              {/* Filter */}
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
                    <span style={{ fontWeight: 400 }}>Sort Ascending</span>
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
                    <span style={{ fontWeight: 400 }}>Sort Descending</span>
                    {currentSort === "desc" && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                </>
              )}

              {/* Show values as — base or partner currency (money columns) */}
              {currencyView !== undefined && onCurrencyViewChange && (
                <>
                  <div className="border-t border-border/60 my-1" />
                  <div
                    className="px-2.5 pt-1 pb-0.5 text-[10.5px] text-muted-foreground/70 uppercase tracking-wider"
                    style={{ fontWeight: 600, letterSpacing: "0.04em" }}
                  >
                    Show values as
                  </div>
                  {([
                    ["base", "Base currency", Banknote],
                    ["partner", "Partner currency", Globe],
                  ] as const).map(([value, text, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { onCurrencyViewChange(value); setOpen(false); }}
                      className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
                        currencyView === value ? "text-primary bg-primary/5" : "text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span style={{ fontWeight: 400 }}>{text}</span>
                      {currencyView === value && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                    </button>
                  ))}
                  {currencyNote && <p className="px-2.5 pt-0.5 pb-1 text-[10.5px] leading-snug text-muted-foreground/70">{currencyNote}</p>}
                </>
              )}

              <div className="border-t border-border/60 my-1" />

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
                  <span className="truncate" style={{ fontWeight: 500, color: "rgb(var(--foreground))" }}>{label}</span>
                  <span className="text-muted-foreground/50 shrink-0">{operatorLabel}</span>
                </div>
                {isFilterActive(currentFilter) && (
                  <button
                    type="button"
                    onClick={handleClearFilter}
                    className="ml-auto text-[12px] cursor-pointer transition-colors hover:text-primary shrink-0"
                    style={{ fontWeight: 500, color: "rgb(var(--primary))" }}
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
                        style={{ fontWeight: 500, color: "rgb(var(--primary))" }}
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
                      className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF]"
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
                      className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF]"
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
  vendors?: Vendor[];
  /** Optional override for unique values when the chip is used outside the vendor list */
  uniqueValues?: string[];
  onFilterChange: (filter: ColumnFilterState) => void;
  onRemove: () => void;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
}

export function ColumnFilterChip({
  filter,
  label,
  vendors = [],
  uniqueValues: uniqueValuesProp,
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

  // Auto-open when first added or when re-triggered from column header menu
  useEffect(() => {
    if (autoOpen && !prevAutoOpen.current) {
      prevAutoOpen.current = true;
      // Small delay so the chip renders and positions first
      const t = requestAnimationFrame(() => {
        setTimeout(() => {
          setOpen(true);
          onAutoOpenedRef.current?.();
        }, 60);
      });
      return () => cancelAnimationFrame(t);
    }
    if (!autoOpen) {
      prevAutoOpen.current = false;
    }
  }, [autoOpen]);

  const active = isFilterActive(filter);

  const operatorLabel = filter.type === "multiselect" ? "is" :
                        filter.type === "text" ? "contains" :
                        filter.type === "range" ? "between" : "between";

  const uniqueValues = useMemo(
    () => uniqueValuesProp ?? getUniqueValues(filter.columnKey, vendors),
    [filter.columnKey, vendors, uniqueValuesProp]
  );

  const filteredValues = useMemo(() => {
    if (!search.trim()) return uniqueValues;
    const q = search.toLowerCase();
    return uniqueValues.filter((v) =>
      formatValueLabel(filter.columnKey, v).toLowerCase().includes(q)
    );
  }, [uniqueValues, search, filter.columnKey]);

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

  /** Summary text for the chip */
  const chipSummary = useMemo(() => {
    if (!active) return "";
    switch (filter.type) {
      case "multiselect":
        if (filter.values.length === 1) {
          return formatValueLabel(filter.columnKey, filter.values[0]);
        }
        return `${filter.values.length} selected`;
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
  }, [active, filter]);

  return (
    <div className="flex items-center shrink-0">
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1 h-[30px] pl-2.5 rounded-l-md border text-[13px] cursor-pointer transition-colors ${
              active
                ? "border-primary/30 bg-accent text-primary hover:bg-[#D6E8FF]"
                : "border-border bg-white text-foreground hover:bg-muted/50"
            } ${open ? "border-primary/40" : ""}`}
            style={{ fontWeight: 500, borderRight: "none" }}
          >
            {label}
            {active && chipSummary && (
              <>
                <span className="text-muted-foreground/50 mx-0.5">·</span>
                <span className="text-[12px] max-w-[100px] truncate opacity-80">
                  {chipSummary}
                </span>
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
          {/* Header */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <span style={{ fontWeight: 500 }}>{label}</span>
              <span className="text-muted-foreground/50">{operatorLabel}</span>
            </div>
          </div>

          {/* Content based on filter type */}
          {filter.type === "multiselect" && (
            <div>
              {/* Search */}
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

              {/* Options */}
              <div className="max-h-[240px] overflow-y-auto py-1 px-1">
                {filteredValues.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">
                    No options found
                  </div>
                ) : (
                  filteredValues.map((value) => {
                    const selected = filter.values.includes(value);
                    const displayLabel = formatValueLabel(filter.columnKey, value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleValue(value)}
                        className={`flex items-center gap-2.5 w-full px-2.5 py-[6px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/50 ${
                          selected ? "bg-primary/5" : ""
                        }`}
                      >
                        <Checkbox
                          checked={selected}
                          className="pointer-events-none"
                        />
                        {filter.columnKey === "status" && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: getStatusColor(value) }}
                          />
                        )}
                        <span style={{ fontWeight: selected ? 500 : 400 }}>
                          {highlightMatch(displayLabel, search)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Clear selection */}
              {filter.values.length > 0 && (
                <>
                  <div className="border-t border-border/40" />
                  <div className="px-3 py-2">
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="text-[13px] cursor-pointer transition-colors hover:text-primary"
                      style={{ fontWeight: 500, color: "rgb(var(--primary))" }}
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
                className="w-full h-8 px-3 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] placeholder:text-muted-foreground/40"
                autoFocus
              />
              {filter.text && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="mt-2 text-[13px] cursor-pointer transition-colors hover:text-primary"
                  style={{ fontWeight: 500, color: "rgb(var(--primary))" }}
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
                    className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF]"
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
                    className="w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF]"
                  />
                </div>
              </div>
              {(filter.min || filter.max) && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="mt-2 text-[13px] cursor-pointer transition-colors hover:text-primary"
                  style={{ fontWeight: 500, color: "rgb(var(--primary))" }}
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
                  className="mt-2 text-[13px] cursor-pointer transition-colors hover:text-primary"
                  style={{ fontWeight: 500, color: "rgb(var(--primary))" }}
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
            ? "border-primary/30 bg-accent text-primary/60 hover:text-primary hover:bg-[#D6E8FF]"
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
  vendors?: Vendor[];
  /** Optional override: column key → unique values (used by non-vendor tables) */
  uniqueValuesByKey?: Record<string, string[]>;
  /** The key of the locked/pinned column that should be excluded from the "+ Filter" picker */
  lockedColumnKey?: string;
  onFilterChange: (columnKey: string, filter: ColumnFilterState) => void;
  onRemoveFilter: (columnKey: string) => void;
  onAddFilter: (columnKey: string) => void;
  onClearAll: () => void;
  autoOpenKey: string | null;
  onAutoOpened: () => void;
  /** All available column keys that can be filtered (visible columns) */
  availableColumns: { key: string; label: string }[];
}

export function ActiveFiltersBar({
  columnFilters,
  columnLabels,
  vendors = [],
  uniqueValuesByKey,
  lockedColumnKey = "partner_name",
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
    ? addableColumns.filter((c) =>
        c.label.toLowerCase().includes(addSearch.toLowerCase())
      )
    : addableColumns;

  return (
    <div className="flex items-center gap-2 px-4 pb-2.5 overflow-x-auto">
      {/* Filter chips */}
      {columnFilters.map((filter) => (
        <ColumnFilterChip
          key={filter.columnKey}
          filter={filter}
          label={columnLabels[filter.columnKey] || filter.columnKey}
          vendors={vendors}
          uniqueValues={uniqueValuesByKey?.[filter.columnKey]}
          onFilterChange={(updated) => onFilterChange(filter.columnKey, updated)}
          onRemove={() => onRemoveFilter(filter.columnKey)}
          autoOpen={autoOpenKey === filter.columnKey}
          onAutoOpened={onAutoOpened}
        />
      ))}

      {/* + Filter button */}
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
          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-[220px] p-0 rounded-lg shadow-lg border border-border/80 z-[200]"
          >
            {/* Search */}
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

            {/* Column list */}
            <div className="max-h-[240px] overflow-y-auto py-1 px-1">
              {filteredAddable.length === 0 ? (
                <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">
                  No columns available
                </div>
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

      {/* Clear all */}
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

/* ─── Apply column filters to vendor data  ─── */

export function applyColumnFilters(
  vendors: Vendor[],
  columnFilters: ColumnFilterState[]
): Vendor[] {
  return applyFilters(vendors, columnFilters, vendorCellValue);
}