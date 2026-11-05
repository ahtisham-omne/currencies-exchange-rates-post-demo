// @ts-nocheck
/* ────────────────────────────────────────────────────────────────────────
   Slim ColumnHeaderMenu — sort / hide / freeze popover for column
   headers. Mirrors Partner Management's visual structure but drops the
   vendor-tied filter rails (multiselect / range / date), since the
   embedded contacts directory only ever calls onAddFilter as a no-op.
   The "Filter" entry is kept so the menu layout matches the source.
   ──────────────────────────────────────────────────────────────────────── */

import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/popover";
import {
  ArrowUp,
  ArrowDown,
  Filter,
  EyeOff,
  Snowflake,
} from "lucide-react";

export type SortDirection = "asc" | "desc" | null;
export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

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
  children,
}: ColumnHeaderMenuProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
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
    onAddFilter(columnKey);
    setOpen(false);
  };

  const handleHide = () => {
    onHideColumn(columnKey);
    setOpen(false);
  };

  const handleFreeze = () => {
    onFreezeColumn?.(columnKey);
    setOpen(false);
  };

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
        className="p-0 rounded-lg shadow-lg border border-border/80 z-[200] w-[220px]"
      >
        {/* Column name display */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-muted/30">
            <span className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>
              {label}
            </span>
          </div>
        </div>

        <div className="border-t border-border/60" />

        <div className="py-1 px-1">
          {/* Filter — no-op in embedded contact directory; surfaces the entry
              point so the menu layout matches Partner Management's design. */}
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

          {/* Freeze */}
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
      </PopoverContent>
    </Popover>
  );
}
