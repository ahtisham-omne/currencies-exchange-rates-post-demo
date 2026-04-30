import { useState, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
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
  ChevronLeft,
  ChevronDown,
} from "lucide-react";
import type { SOStatus } from "./types";

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

/** Determine filter type for a given SO column key */
export function getFilterType(columnKey: string): FilterType {
  switch (columnKey) {
    case "status":
    case "priority":
    case "warehouse":
    case "currency":
    case "createdby":
      return "multiselect";
    case "value":
    case "linecount":
      return "range";
    case "orderdate":
    case "shipby":
    case "delivery":
    case "createdon":
    case "lastupdated":
    case "confirmation":
      return "date";
    default:
      return "text";
  }
}

export function createBlankFilter(columnKey: string): ColumnFilterState {
  return { columnKey, type: getFilterType(columnKey), values: [], text: "", min: "", max: "", dateFrom: "", dateTo: "" };
}

export function isFilterActive(filter: ColumnFilterState): boolean {
  switch (filter.type) {
    case "multiselect": return filter.values.length > 0;
    case "text": return filter.text.trim().length > 0;
    case "range": return filter.min !== "" || filter.max !== "";
    case "date": return filter.dateFrom !== "" || filter.dateTo !== "";
    default: return false;
  }
}

/** Get unique values for SO column from data */
export function getSOUniqueValues(columnKey: string, orders: { status: SOStatus; priority: string; warehouse: string; currency: string; salesRep: string }[]): string[] {
  const s = new Set<string>();
  orders.forEach(o => {
    switch (columnKey) {
      case "status": s.add(o.status); break;
      case "priority": s.add(o.priority); break;
      case "warehouse": s.add(o.warehouse); break;
      case "currency": s.add(o.currency); break;
      case "createdby": break; // mock data
    }
  });
  return Array.from(s).sort();
}

/** Apply column filters to SO data */
export function applySOColumnFilters<T extends Record<string, any>>(data: T[], filters: ColumnFilterState[]): T[] {
  let result = data;
  for (const f of filters) {
    if (!isFilterActive(f)) continue;
    result = result.filter(row => {
      const val = String(row[f.columnKey] ?? "");
      switch (f.type) {
        case "multiselect": return f.values.includes(val);
        case "text": return val.toLowerCase().includes(f.text.toLowerCase());
        case "range": {
          const num = parseFloat(val);
          if (isNaN(num)) return true;
          if (f.min && num < parseFloat(f.min)) return false;
          if (f.max && num > parseFloat(f.max)) return false;
          return true;
        }
        default: return true;
      }
    });
  }
  return result;
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
  children: ReactNode;
}

export function SOColumnHeaderMenu({
  columnKey, label, sortable, sortConfig, onSort,
  onAddFilter, onHideColumn, onFreezeColumn,
  isFrozen, isLocked, hasActiveFilter, children,
}: ColumnHeaderMenuProps) {
  const [open, setOpen] = useState(false);

  const currentSort: SortDirection = sortConfig?.key === columnKey ? sortConfig.direction : null;

  const handleSort = (dir: "asc" | "desc") => {
    if (currentSort === dir) onSort(columnKey, null);
    else onSort(columnKey, dir);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className="flex items-center gap-1 w-full h-full text-left cursor-pointer select-none group/header hover:text-foreground transition-colors"
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="p-0 rounded-lg shadow-lg border border-border/80 z-[200] w-[220px]">
        {/* Column name display */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-muted/30">
            <span className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>{label}</span>
          </div>
        </div>
        <div className="border-t border-border/60" />
        <div className="py-1 px-1">
          {/* Filter */}
          <button
            type="button"
            onClick={() => { onAddFilter(columnKey); setOpen(false); }}
            className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${hasActiveFilter ? "text-primary" : "text-foreground"}`}
          >
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span style={{ fontWeight: 400 }}>Filter</span>
            {hasActiveFilter && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>

          {/* Sort */}
          {sortable && (
            <>
              <button type="button" onClick={() => handleSort("asc")} className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${currentSort === "asc" ? "text-primary bg-primary/5" : "text-foreground"}`}>
                <ArrowUp className="w-4 h-4 text-muted-foreground" />
                <span style={{ fontWeight: 400 }}>Sort ascending</span>
                {currentSort === "asc" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
              <button type="button" onClick={() => handleSort("desc")} className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${currentSort === "desc" ? "text-primary bg-primary/5" : "text-foreground"}`}>
                <ArrowDown className="w-4 h-4 text-muted-foreground" />
                <span style={{ fontWeight: 400 }}>Sort descending</span>
                {currentSort === "desc" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            </>
          )}

          <div className="border-t border-border/60 my-1" />

          {/* Hide */}
          {!isLocked && (
            <button type="button" onClick={() => { onHideColumn(columnKey); setOpen(false); }} className="flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] text-foreground cursor-pointer transition-colors hover:bg-muted/60">
              <EyeOff className="w-4 h-4 text-muted-foreground" />
              <span style={{ fontWeight: 400 }}>Hide</span>
            </button>
          )}

          {/* Freeze */}
          {onFreezeColumn && !isLocked && (
            <button type="button" onClick={() => { onFreezeColumn(columnKey); setOpen(false); }} className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${isFrozen ? "text-primary" : "text-foreground"}`}>
              <Snowflake className="w-4 h-4 text-muted-foreground" />
              <span style={{ fontWeight: 400 }}>{isFrozen ? "Unfreeze" : "Freeze"}</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
