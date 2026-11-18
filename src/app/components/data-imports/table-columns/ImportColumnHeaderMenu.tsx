/**
 * ImportColumnHeaderMenu: the column-header popover used by every Data Import
 * table (record pages, review modals). Mirrors Inventory-Movement-Web's
 * ColumnHeaderMenu exactly (column name heading, Sort ascending / Sort
 * descending, then Hide / Freeze), re-expressed in UAC's hex tokens:
 * primary #0A77FF, primary-50 #EDF4FF, neutrals from the slate ramp.
 */
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, EyeOff, Snowflake } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "../../ui/utils";

export type ColumnSortDirection = "asc" | "desc";
export interface ColumnSortState {
  key: string;
  direction: ColumnSortDirection;
}

const ITEM =
  "flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-[#F1F5F9]/60";

export function ImportColumnHeaderMenu({
  columnKey,
  label,
  sort,
  onSort,
  onHide,
  isFrozen,
  onFreeze,
  labelColor,
  labelStyle,
  trailing,
  suppressClick,
}: {
  columnKey: string;
  label: string;
  sort: ColumnSortState | null;
  onSort: (key: string, direction: ColumnSortDirection | null) => void;
  /** Omitted for locked columns: the menu then offers sorting only. */
  onHide?: (key: string) => void;
  isFrozen?: boolean;
  onFreeze?: (key: string) => void;
  /** Overrides the idle label colour (e.g. the active-column blue in review). */
  labelColor?: string;
  labelStyle?: React.CSSProperties;
  /** Extra inline content after the label (e.g. an info affordance). */
  trailing?: ReactNode;
  /** Returns true when the click that opens the menu should be swallowed
   *  (it ended a column drag). */
  suppressClick?: () => boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = sort?.key === columnKey ? sort.direction : null;

  const handleSort = (dir: ColumnSortDirection) => {
    onSort(columnKey, current === dir ? null : dir);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o && suppressClick?.()) return;
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 w-full h-full min-w-0 text-left cursor-pointer select-none group/header text-[#475569] hover:text-[#0F172A] transition-colors"
          style={{ background: "transparent", border: "none", padding: 0 }}
        >
          <span
            className="truncate"
            style={{ fontSize: "13px", fontWeight: 400, lineHeight: 1.2, ...labelStyle, color: current ? "#0A77FF" : labelColor }}
          >
            {label}
          </span>
          {trailing}
          {current ? (
            <span className="shrink-0" style={{ color: "#0A77FF" }}>
              {current === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            </span>
          ) : (
            <ArrowUpDown
              size={12}
              className="shrink-0 opacity-0 group-hover/header:opacity-100 transition-opacity"
              style={{ color: "#94A3B8" }}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0 rounded-lg shadow-lg border border-[#E2E8F0] bg-white z-[400] w-[220px]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-3 pt-2.5 pb-2">
          <span className="text-[11px] uppercase tracking-wide" style={{ fontWeight: 600, color: "#64748B" }}>
            {label}
          </span>
        </div>
        <div className="border-t border-[#E2E8F0]" />
        <div className="py-1 px-1">
          <button
            type="button"
            onClick={() => handleSort("asc")}
            className={cn(ITEM, current === "asc" ? "text-[#0A77FF] bg-[#EDF4FF]" : "text-[#0F172A]")}
          >
            <ArrowUp className="w-4 h-4 text-[#64748B]" />
            <span style={{ fontWeight: 400 }}>Sort ascending</span>
            {current === "asc" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#0A77FF]" />}
          </button>
          <button
            type="button"
            onClick={() => handleSort("desc")}
            className={cn(ITEM, current === "desc" ? "text-[#0A77FF] bg-[#EDF4FF]" : "text-[#0F172A]")}
          >
            <ArrowDown className="w-4 h-4 text-[#64748B]" />
            <span style={{ fontWeight: 400 }}>Sort descending</span>
            {current === "desc" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#0A77FF]" />}
          </button>
          {onHide && (
            <>
              <div className="border-t border-[#E2E8F0] my-1" />
              <button
                type="button"
                onClick={() => { onHide(columnKey); setOpen(false); }}
                className={cn(ITEM, "text-[#0F172A]")}
              >
                <EyeOff className="w-4 h-4 text-[#64748B]" />
                <span style={{ fontWeight: 400 }}>Hide</span>
              </button>
              {onFreeze && (
                <button
                  type="button"
                  onClick={() => { onFreeze(columnKey); setOpen(false); }}
                  className={cn(ITEM, "text-[#0F172A]")}
                >
                  <Snowflake className="w-4 h-4 text-[#64748B]" />
                  <span style={{ fontWeight: 400 }}>{isFrozen ? "Unfreeze" : "Freeze"}</span>
                </button>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
