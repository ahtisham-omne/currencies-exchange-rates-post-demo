import { Filter, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { cn } from "../ui/utils";
import type { DataImportModuleCard } from "./moduleData";

/* Availability splits the grid by whether a module can actually be imported
 * today. Last import filters on the outcome of the module's most recent run,
 * with `never` covering modules that have no history at all. */
export type AvailabilityFilter = "available" | "coming-soon";
export type LastImportFilter = "completed" | "inProgress" | "failed" | "never";

export interface ModuleFilters {
  availability: AvailabilityFilter[];
  lastImport: LastImportFilter[];
}

export const EMPTY_MODULE_FILTERS: ModuleFilters = { availability: [], lastImport: [] };

const AVAILABILITY_OPTIONS: { value: AvailabilityFilter; label: string }[] = [
  { value: "available", label: "Ready to import" },
  { value: "coming-soon", label: "Coming soon" },
];

const LAST_IMPORT_OPTIONS: { value: LastImportFilter; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "inProgress", label: "In progress" },
  { value: "failed", label: "Failed" },
  { value: "never", label: "Never imported" },
];

export function countActiveFilters(filters: ModuleFilters): number {
  return filters.availability.length + filters.lastImport.length;
}

/** Does a card survive the current filter selection? An empty group means "no
 *  constraint", so filters inside a group are OR'd and the groups are AND'd. */
export function matchesModuleFilters(
  card: Partial<Pick<DataImportModuleCard, "hasTemplates" | "importsCount" | "lastImportStatus">>,
  filters: ModuleFilters,
): boolean {
  if (filters.availability.length > 0) {
    const availability: AvailabilityFilter = card.hasTemplates ? "available" : "coming-soon";
    if (!filters.availability.includes(availability)) return false;
  }
  if (filters.lastImport.length > 0) {
    const lastImport: LastImportFilter =
      card.importsCount === 0 || card.lastImportStatus === null ? "never" : card.lastImportStatus;
    if (!filters.lastImport.includes(lastImport)) return false;
  }
  return true;
}

interface ModuleFiltersMenuProps {
  filters: ModuleFilters;
  onChange: (next: ModuleFilters) => void;
}

/** Filters control for the Data Imports module grid. Category selection stays
 *  on the chip row above; this covers the cross-cutting attributes that don't
 *  belong there. */
export function ModuleFiltersMenu({ filters, onChange }: ModuleFiltersMenuProps) {
  const activeCount = countActiveFilters(filters);

  const toggle = <K extends keyof ModuleFilters>(group: K, value: ModuleFilters[K][number]) => {
    const current = filters[group] as ModuleFilters[K][number][];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [group]: next });
  };

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={activeCount > 0 ? `Filters, ${activeCount} applied` : "Filters"}
            className={cn(
              "inline-flex items-center justify-center h-9 gap-2 px-3 rounded-md border bg-white shadow-sm transition-colors cursor-pointer",
              activeCount > 0
                ? "border-[#0A77FF] text-[#0A77FF] hover:bg-[#EDF4FF]"
                : "border-border/80 text-[#334155] hover:bg-muted/50",
            )}
          >
            <Filter className="w-4 h-4" style={{ color: activeCount > 0 ? "#0A77FF" : "#94A3B8" }} />
            <span className="text-[13px]" style={{ fontWeight: 500 }}>Filters</span>
            {activeCount > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[18px] px-1.5 py-px rounded-full bg-[#0A77FF]/10 text-[#0A77FF] tabular-nums"
                style={{ fontSize: "10px", fontWeight: 600 }}
              >
                {activeCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[232px]">
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-[#94A3B8]">
            Availability
          </DropdownMenuLabel>
          {AVAILABILITY_OPTIONS.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={filters.availability.includes(opt.value)}
              onCheckedChange={() => toggle("availability", opt.value)}
              onSelect={(e) => e.preventDefault()}
              className="cursor-pointer text-[13px]"
            >
              {opt.label}
            </DropdownMenuCheckboxItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-[#94A3B8]">
            Last import
          </DropdownMenuLabel>
          {LAST_IMPORT_OPTIONS.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={filters.lastImport.includes(opt.value)}
              onCheckedChange={() => toggle("lastImport", opt.value)}
              onSelect={(e) => e.preventDefault()}
              className="cursor-pointer text-[13px]"
            >
              {opt.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_MODULE_FILTERS)}
          className="inline-flex items-center gap-1 h-9 px-2 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          style={{ fontSize: "12.5px", fontWeight: 500 }}
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
