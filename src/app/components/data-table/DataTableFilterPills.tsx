import { useMemo, type ReactNode } from "react";
import { Archive, User } from "lucide-react";
import type { QuickFilterDef } from "./types";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { SHOW_ME_MODE } from "../../lib/feature-flags";

interface DataTableFilterPillsProps {
  filters: QuickFilterDef[];
  activeFilters: Set<string>;
  onFilterToggle: (key: string) => void;
  filterCounts: Record<string, number>;
  showMeMode?: boolean;
  /** Active/inactive state of the Me Mode pill. */
  meModeActive?: boolean;
  /** Click handler for the Me Mode pill. When omitted the chip stays inert
   *  (DataTable passes `undefined` if no `meModePredicate` was provided). */
  onMeModeToggle?: () => void;
  /** Optional hover tooltip text shown above the Me Mode pill. */
  meModeTooltip?: ReactNode;
}

export function DataTableFilterPills({
  filters,
  activeFilters,
  onFilterToggle,
  filterCounts,
  showMeMode = true,
  meModeActive = false,
  onMeModeToggle,
  meModeTooltip,
}: DataTableFilterPillsProps) {
  /* Build the filter list with divider positions.
   * Two rules produce a divider, and they never stack:
   *  1. a group boundary (`group` on QuickFilterDef), so License pills read
   *     separately from Status pills, and
   *  2. immediately before the Archived filter, which always sits last.
   * Filters with no group (e.g. "all") never open a group break. */
  const filtersWithDividers = useMemo(() => {
    const items: ({ type: "filter"; filter: QuickFilterDef } | { type: "divider" })[] = [];
    const isArchivedFilter = (f: QuickFilterDef) =>
      f.key === "archived" || f.variant === "danger";
    let lastGroup: string | undefined = undefined;

    for (const filter of filters) {
      const groupChanged =
        filter.group !== undefined && lastGroup !== undefined && filter.group !== lastGroup;
      if (groupChanged || isArchivedFilter(filter)) {
        // Never emit two dividers back to back.
        if (items[items.length - 1]?.type !== "divider") {
          items.push({ type: "divider" });
        }
      }
      items.push({ type: "filter", filter });
      lastGroup = filter.group ?? lastGroup;
    }
    return items;
  }, [filters]);

  const isAllActive = activeFilters.size === 0;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
      {/* Me mode pill. Hidden behind SHOW_ME_MODE, see lib/feature-flags.ts. */}
      {SHOW_ME_MODE && showMeMode && (
        <>
          {(() => {
            const meButton = (
              <button
                type="button"
                onClick={onMeModeToggle}
                disabled={!onMeModeToggle}
                aria-pressed={meModeActive}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 ${
                  onMeModeToggle ? "cursor-pointer" : "cursor-default opacity-70"
                } ${
                  meModeActive
                    ? "border-[#0A77FF] bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                    : "border-border bg-white text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                }`}
                style={{
                  fontWeight: meModeActive ? 500 : 400,
                  color: meModeActive ? "#0A77FF" : undefined,
                }}
              >
                <User className="w-3.5 h-3.5" />
                Me Mode
              </button>
            );
            return meModeTooltip ? (
              <Tooltip>
                <TooltipTrigger asChild>{meButton}</TooltipTrigger>
                <TooltipContent side="top" sideOffset={4} className="max-w-[260px] text-[12px]">
                  {meModeTooltip}
                </TooltipContent>
              </Tooltip>
            ) : (
              meButton
            );
          })()}
          <div className="shrink-0" style={{ width: 1.5, height: 22, backgroundColor: "#CBD5E1", borderRadius: 1 }} />
        </>
      )}
      {filtersWithDividers.map((item, idx) => {
        if (item.type === "divider") {
          return (
            <div
              key={`divider-${idx}`}
              className="shrink-0"
              style={{ width: 1.5, height: 22, backgroundColor: "#CBD5E1", borderRadius: 1 }}
            />
          );
        }

        const filter = item.filter;
        const isAll = filter.key === "all";
        const isActive = isAll ? isAllActive : activeFilters.has(filter.key);
        const count = filterCounts[filter.key] ?? 0;
        const isDanger = filter.variant === "danger";

        /* Danger variant (Archived chip):
         *  - default state: red text/icon + red badge on a neutral chip
         *  - active state:  red border + red-tinted fill, same red text
         *  Keeps the red theme regardless of selection so the Archive
         *  filter always reads as the "destructive" option. */
        const dangerClasses = isActive
          ? "border-[#DC2626] bg-[#FEF2F2] hover:bg-[#FEE2E2] active:bg-[#FECACA]"
          : "border-[#FECACA] bg-white hover:bg-[#FEF2F2] hover:border-[#FCA5A5] active:bg-[#FEE2E2]";
        const blueClasses = isActive
          ? "border-[#0A77FF] bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
          : "border-border bg-white text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted";

        return (
          <button
            key={filter.key}
            onClick={() => onFilterToggle(filter.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isDanger ? dangerClasses : blueClasses
            }`}
            style={{
              fontWeight: isActive ? 500 : 400,
              color: isDanger ? "#DC2626" : isActive ? "#0A77FF" : undefined,
            }}
          >
            {isDanger && <Archive className="w-3.5 h-3.5" />}
            {filter.label}
            {filter.showCount && (
              <span
                className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
                  isDanger
                    ? isActive
                      ? "bg-[#FECACA]"
                      : "bg-[#FEE2E2]"
                    : isActive
                      ? "bg-[#0A77FF]/10"
                      : "bg-muted"
                }`}
                style={{
                  fontWeight: 600,
                  color: isDanger ? "#DC2626" : isActive ? "#0A77FF" : "#475569",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
