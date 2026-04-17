import { useState, useMemo } from "react";
import { REGION_LIST, getRegionForCountry } from "../../data/currencies";
import { getCountryName } from "../../utils/currencyFlags";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "../ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronDown, ChevronUp } from "lucide-react";

/* ─── Filter Types ─── */
export interface ExchangeRateFilters {
  regions: string[];
}

export const DEFAULT_EXCHANGE_RATE_FILTERS: ExchangeRateFilters = {
  regions: [],
};

export function countActiveExchangeRateFilters(f: ExchangeRateFilters): number {
  return f.regions.length > 0 ? 1 : 0;
}

/** Check if a currency code matches region filters */
export function currencyMatchesExchangeRateRegionFilter(
  currencyCode: string,
  regions: string[]
): boolean {
  if (regions.length === 0) return true;
  const country = getCountryName(currencyCode);
  if (!country) return false;
  const region = getRegionForCountry(country);
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
        <span
          className={`text-[11px] tabular-nums ${
            selected ? "text-primary/60" : "text-muted-foreground/50"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ─── Main Component ─── */
interface ExchangeRateFiltersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ExchangeRateFilters;
  onFiltersChange: (filters: ExchangeRateFilters) => void;
  /** All currency codes currently in the table (e.g. ["USD","EUR",...]) */
  currencyCodes: string[];
  filteredCount: number;
}

export function ExchangeRateFiltersModal({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  currencyCodes,
  filteredCount,
}: ExchangeRateFiltersModalProps) {
  const toggleRegion = (value: string) => {
    const arr = filters.regions;
    onFiltersChange({
      ...filters,
      regions: arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value],
    });
  };

  const regionOptions = useMemo(() => {
    const counts = new Map<string, number>();
    currencyCodes.forEach((code) => {
      const country = getCountryName(code);
      if (!country) return;
      const region = getRegionForCountry(country);
      if (region) counts.set(region, (counts.get(region) || 0) + 1);
    });
    return REGION_LIST.map((r) => ({
      value: r,
      label: r,
      count: counts.get(r) || 0,
    })).filter((r) => r.count > 0);
  }, [currencyCodes]);

  const activeCount = countActiveExchangeRateFilters(filters);

  const handleClear = () => {
    onFiltersChange({ ...DEFAULT_EXCHANGE_RATE_FILTERS });
  };

  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? regionOptions : regionOptions.slice(0, 8);
  const hasMore = regionOptions.length > 8;

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-[200] bg-black/50" />
        <DialogPrimitive.Content className="fixed top-[50%] left-[50%] z-[200] translate-x-[-50%] translate-y-[-50%] w-full max-w-[540px] max-h-[85vh] rounded-2xl border bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <h3 className="text-[16px]" style={{ fontWeight: 600 }}>
                Filters
              </h3>
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
            <div className="px-6 py-4">
              <h4 className="text-[14px] mb-0.5" style={{ fontWeight: 600 }}>
                Region
              </h4>
              <p className="text-[12px] text-muted-foreground mb-3">
                Filter by geographic region
              </p>
              <div className="flex flex-wrap gap-1.5">
                {visible.map((opt) => (
                  <Pill
                    key={opt.value}
                    label={opt.label}
                    selected={filters.regions.includes(opt.value)}
                    onClick={() => toggleRegion(opt.value)}
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
                  {showAll ? "Show less" : `Show all ${regionOptions.length}`}
                  {showAll ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 bg-[#FAFBFC]">
            <span className="text-[13px] text-muted-foreground">
              <span style={{ fontWeight: 600, color: "#1E293B" }}>
                {filteredCount}
              </span>{" "}
              currencies match
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
