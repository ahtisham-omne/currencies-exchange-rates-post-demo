import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import type { Currency } from "../../data/currencies";
import { REGION_LIST, getRegionForCountry, countInUse } from "../../data/currencies";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "../ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronDown, ChevronUp } from "lucide-react";

/* ─── Filter Types ─── */
export type InUseFilterMode = "any" | "yes" | "no";

export interface CurrencyFilters {
  statuses: string[];
  decimalPlaces: string[];
  regions: string[];
  inUseFilter: InUseFilterMode;
}

export const DEFAULT_CURRENCY_FILTERS: CurrencyFilters = {
  statuses: [],
  decimalPlaces: [],
  regions: [],
  inUseFilter: "any",
};

export function countActiveCurrencyFilters(f: CurrencyFilters): number {
  let count = 0;
  if (f.statuses.length > 0) count++;
  if (f.decimalPlaces.length > 0) count++;
  if (f.regions.length > 0) count++;
  if (f.inUseFilter !== "any") count++;
  return count;
}

/** Check if a currency matches the In Use filter */
export function currencyMatchesInUseFilter(c: Currency, f: CurrencyFilters): boolean {
  if (f.inUseFilter === "any") return true;
  const inUse = countInUse(c) > 0;
  return f.inUseFilter === "yes" ? inUse : !inUse;
}

/** Check if a currency matches region filters */
export function currencyMatchesRegionFilter(c: Currency, regions: string[]): boolean {
  if (regions.length === 0) return true;
  const region = getRegionForCountry(c.country);
  return region ? regions.includes(region) : false;
}

/* ─── Pill component ─── */
function Pill({
  label,
  selected,
  onClick,
  count,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border text-[13px] cursor-pointer transition-all select-none shrink-0 ${
        selected
          ? "border-primary/30 text-primary"
          : "bg-white text-foreground border-border hover:border-muted-foreground/40 hover:bg-muted/30"
      }`}
      style={{
        fontWeight: selected ? 500 : 400,
        backgroundColor: selected ? "#EDF4FF" : undefined,
      }}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`text-[11px] tabular-nums ${selected ? "text-primary/60" : "text-muted-foreground/50"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ─── Section wrapper ─── */
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="px-6 py-4">
      <h4 className="text-[14px] mb-0.5" style={{ fontWeight: 600 }}>{title}</h4>
      {subtitle && <p className="text-[12px] text-muted-foreground mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border/50 mx-6" />;
}

/* ─── Main Component ─── */
interface CurrencyFiltersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CurrencyFilters;
  onFiltersChange: (filters: CurrencyFilters) => void;
  currencies: Currency[];
  filteredCount: number;
}

export function CurrencyFiltersModal({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  currencies,
  filteredCount,
}: CurrencyFiltersModalProps) {
  const toggleMulti = (key: keyof CurrencyFilters, value: string) => {
    const arr = filters[key] as string[];
    onFiltersChange({
      ...filters,
      [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    });
  };

  const setInUseFilter = (mode: InUseFilterMode) => {
    if (mode === filters.inUseFilter) {
      onFiltersChange({ ...filters, inUseFilter: "any" });
    } else {
      onFiltersChange({ ...filters, inUseFilter: mode });
    }
  };

  const filterOptions = useMemo(() => {
    const decimals = new Map<string, number>();
    const regionCounts = new Map<string, number>();

    currencies.forEach((c) => {
      const dp = String(c.decimalPlaces);
      decimals.set(dp, (decimals.get(dp) || 0) + 1);

      const region = getRegionForCountry(c.country);
      if (region) {
        regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
      }
    });

    const statusCounts = {
      active: currencies.filter((c) => c.status === "active").length,
      inactive: currencies.filter((c) => c.status === "inactive").length,
    };

    return {
      regions: REGION_LIST
        .map((r) => ({ value: r, label: r, count: regionCounts.get(r) || 0 }))
        .filter((r) => r.count > 0),
      decimals: Array.from(decimals.entries())
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([value, count]) => ({ value, label: `${value} decimal${value !== "1" ? "s" : ""}`, count })),
      statusCounts,
    };
  }, [currencies]);

  const activeCount = countActiveCurrencyFilters(filters);

  const handleClear = () => {
    onFiltersChange({ ...DEFAULT_CURRENCY_FILTERS });
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-[200] bg-black/50" />
        <DialogPrimitive.Content
          className="fixed top-[50%] left-[50%] z-[200] translate-x-[-50%] translate-y-[-50%] w-full max-w-[540px] max-h-[85vh] rounded-2xl border bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <h3 className="text-[16px]" style={{ fontWeight: 600 }}>Filters</h3>
              {activeCount > 0 && (
                <span
                  className="min-w-[20px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                  style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
                >
                  {activeCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <button
                  onClick={handleClear}
                  className="text-[13px] px-2 py-1 rounded-md hover:bg-muted/60 transition-colors cursor-pointer"
                  style={{ fontWeight: 500, color: "#0A77FF" }}
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {/* Status */}
            <Section title="Status" subtitle="Filter by currency status">
              <div className="flex flex-wrap gap-1.5">
                <Pill
                  label="Active"
                  selected={filters.statuses.includes("active")}
                  onClick={() => toggleMulti("statuses", "active")}
                  count={filterOptions.statusCounts.active}
                />
                <Pill
                  label="Inactive"
                  selected={filters.statuses.includes("inactive")}
                  onClick={() => toggleMulti("statuses", "inactive")}
                  count={filterOptions.statusCounts.inactive}
                />
              </div>
            </Section>

            <Divider />

            {/* In Use */}
            <Section title="In Use" subtitle="Filter by whether the currency is referenced on any document">
              <div className="flex flex-wrap gap-1.5">
                <Pill
                  label="Yes"
                  selected={filters.inUseFilter === "yes"}
                  onClick={() => setInUseFilter("yes")}
                />
                <Pill
                  label="No"
                  selected={filters.inUseFilter === "no"}
                  onClick={() => setInUseFilter("no")}
                />
              </div>
            </Section>

            <Divider />

            {/* Decimal Places */}
            <Section title="Decimal Places" subtitle="Filter by number of decimal places">
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.decimals.map((opt) => (
                  <Pill
                    key={opt.value}
                    label={opt.label}
                    selected={filters.decimalPlaces.includes(opt.value)}
                    onClick={() => toggleMulti("decimalPlaces", opt.value)}
                    count={opt.count}
                  />
                ))}
              </div>
            </Section>

            <Divider />

            {/* Region */}
            <Section title="Region" subtitle="Filter by geographic region">
              <RegionPills
                options={filterOptions.regions}
                selected={filters.regions}
                onToggle={(val) => toggleMulti("regions", val)}
              />
            </Section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 bg-[#FAFBFC]">
            <span className="text-[13px] text-muted-foreground">
              <span style={{ fontWeight: 600, color: "#1E293B" }}>{filteredCount}</span> currencies match
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                className="h-9 px-4 rounded-lg text-[13px] border border-border bg-white hover:bg-muted/50 transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Reset
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="h-9 px-4 rounded-lg text-[13px] text-white transition-colors cursor-pointer"
                style={{ fontWeight: 500, backgroundColor: "#0A77FF" }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function RegionPills({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; label: string; count: number }[];
  selected: string[];
  onToggle: (val: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? options : options.slice(0, 8);
  const hasMore = options.length > 8;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((opt) => (
          <Pill
            key={opt.value}
            label={opt.label}
            selected={selected.includes(opt.value)}
            onClick={() => onToggle(opt.value)}
            count={opt.count}
          />
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="inline-flex items-center gap-1 mt-2.5 text-[13px] cursor-pointer transition-colors hover:text-primary"
          style={{ fontWeight: 500, color: "#0A77FF" }}
        >
          {showAll ? "Show less" : `Show all ${options.length}`}
          {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}
