import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import type { Item } from "../../context/ItemsContext";
import { toCategoryCode } from "@/app/lib/categoryCode";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronDown, ChevronUp, Search } from "lucide-react";

/* ─── Filter Types (Item-native) ─── */
export interface AdvancedFilters {
  statuses: string[];                   // Active | Inactive
  inventoryControl: string[];           // Serialized | Non-Serialized
  primaryCategories: string[];          // multi
  acquisitionMethods: string[];         // multi (primary only)
  units: string[];                      // multi
  onHandMin: string;                    // range
  onHandMax: string;
  createdFrom: string;
  createdTo: string;
}

export const DEFAULT_FILTERS: AdvancedFilters = {
  statuses: [],
  inventoryControl: [],
  primaryCategories: [],
  acquisitionMethods: [],
  units: [],
  onHandMin: "",
  onHandMax: "",
  createdFrom: "",
  createdTo: "",
};

export function countActiveFilters(f: AdvancedFilters): number {
  let count = 0;
  if (f.statuses.length > 0) count++;
  if (f.inventoryControl.length > 0) count++;
  if (f.primaryCategories.length > 0) count++;
  if (f.acquisitionMethods.length > 0) count++;
  if (f.units.length > 0) count++;
  if (f.onHandMin || f.onHandMax) count++;
  if (f.createdFrom || f.createdTo) count++;
  return count;
}

/* ─── Helpers ─── */
const formatShort = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
};

function getPrimaryAcquisition(item: Item): string {
  const am = item.acquisitionMethod;
  if (typeof am === "string") return am;
  if (am && typeof am === "object" && "primary" in am) return am.primary;
  return "";
}

/* ─── Sub-components ─── */
function Pill({
  label,
  selected,
  onClick,
  count,
  prefix,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  count?: number;
  prefix?: string;
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
      {prefix && <span>{prefix}</span>}
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

function RangeHistogram({
  values,
  min: filterMin,
  max: filterMax,
  onMinChange,
  onMaxChange,
  prefix = "",
}: {
  values: number[];
  min: string;
  max: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  prefix?: string;
}) {
  const dataMin = useMemo(() => (values.length > 0 ? Math.min(...values) : 0), [values]);
  const dataMax = useMemo(() => (values.length > 0 ? Math.max(...values) : 100), [values]);

  const sliderMin = Math.floor(dataMin);
  const sliderMax = Math.ceil(dataMax) || 100;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
          Minimum
        </label>
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
              {prefix}
            </span>
          )}
          <input
            type="number"
            placeholder={formatShort(sliderMin)}
            value={filterMin}
            onChange={(e) => onMinChange(e.target.value)}
            className={`w-full h-9 ${prefix ? "pl-7" : "pl-3"} pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] tabular-nums`}
          />
        </div>
      </div>
      <span className="text-muted-foreground/30 mt-5">–</span>
      <div className="flex-1">
        <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
          Maximum
        </label>
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
              {prefix}
            </span>
          )}
          <input
            type="number"
            placeholder={formatShort(sliderMax)}
            value={filterMax}
            onChange={(e) => onMaxChange(e.target.value)}
            className={`w-full h-9 ${prefix ? "pl-7" : "pl-3"} pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] tabular-nums`}
          />
        </div>
      </div>
    </div>
  );
}

function PillSection({
  options,
  selected,
  onToggle,
  getCount,
  threshold = 8,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  getCount: (value: string) => number;
  threshold?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? options : options.slice(0, threshold);
  const hasMore = options.length > threshold;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((opt) => (
          <Pill
            key={opt.value}
            label={opt.label}
            selected={selected.includes(opt.value)}
            onClick={() => onToggle(opt.value)}
            count={getCount(opt.value)}
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

function SearchableMultiSelect({
  options,
  selected,
  onToggle,
  getCount,
  placeholder = "Search…",
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  getCount: (value: string) => number;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    // Match on both the displayed label (e.g. category code) and the underlying
    // value (e.g. full category name), so either is searchable.
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-9 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/40"
          style={{ paddingLeft: "2.125rem" }}
        />
      </div>

      <div className="max-h-[180px] overflow-y-auto -mx-1 px-1 overscroll-contain">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-muted-foreground/50 py-3 text-center">No results</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const selectedSet = new Set(selected);
              const isSearching = !!query.trim();

              if (isSearching) {
                return filtered.map((opt) => {
                  const isChecked = selectedSet.has(opt.value);
                  const count = getCount(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.value}
                      onClick={() => onToggle(opt.value)}
                      className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] border transition-colors cursor-pointer ${
                        isChecked
                          ? "bg-[#EDF4FF] border-primary/25 text-primary"
                          : "bg-white border-border text-foreground hover:bg-muted/40"
                      }`}
                      style={{ fontWeight: isChecked ? 500 : 400 }}
                    >
                      <span className="truncate max-w-[140px]">{opt.label}</span>
                      <span className={`text-[10px] tabular-nums ${isChecked ? "text-primary/60" : "text-muted-foreground/50"}`}>
                        {count}
                      </span>
                    </button>
                  );
                });
              }

              const selectedOpts = filtered.filter((o) => selectedSet.has(o.value));
              const suggestions = filtered
                .filter((o) => !selectedSet.has(o.value))
                .sort((a, b) => getCount(b.value) - getCount(a.value))
                .slice(0, 6);
              const display = [...selectedOpts, ...suggestions];
              const remaining = filtered.filter((o) => !selectedSet.has(o.value)).length - suggestions.length;

              return (
                <>
                  {display.map((opt) => {
                    const isChecked = selectedSet.has(opt.value);
                    const count = getCount(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        title={opt.value}
                        onClick={() => onToggle(opt.value)}
                        className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] border transition-colors cursor-pointer ${
                          isChecked
                            ? "bg-[#EDF4FF] border-primary/25 text-primary"
                            : "bg-white border-border text-foreground hover:bg-muted/40"
                        }`}
                        style={{ fontWeight: isChecked ? 500 : 400 }}
                      >
                        <span className="truncate max-w-[140px]">{opt.label}</span>
                        <span className={`text-[10px] tabular-nums ${isChecked ? "text-primary/60" : "text-muted-foreground/50"}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                  {remaining > 0 && (
                    <span className="inline-flex items-center h-[30px] px-2.5 text-[12px] text-muted-foreground/40 italic">
                      +{remaining} more — type to search
                    </span>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border/50 mx-6" />;
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-6 py-4">
      <h4 className="text-[14px] mb-0.5" style={{ fontWeight: 600 }}>
        {title}
      </h4>
      {subtitle && (
        <p className="text-[12px] text-muted-foreground mb-3">{subtitle}</p>
      )}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

/* ─── Main Component ─── */
interface FiltersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
  items: Item[];
  filteredCount: number;
}

export function FiltersModal({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  items,
  filteredCount,
}: FiltersModalProps) {
  const update = <K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  const toggleMulti = (key: keyof AdvancedFilters, value: string) => {
    const arr = filters[key] as string[];
    onFiltersChange({
      ...filters,
      [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    });
  };

  /* Extract unique filter options from item data */
  const filterOptions = useMemo(() => {
    const primaryCats = new Set<string>();
    const acquisitions = new Set<string>();
    const units = new Set<string>();

    items.forEach((i) => {
      if (i.primaryCategory) primaryCats.add(i.primaryCategory);
      const p = getPrimaryAcquisition(i);
      if (p) acquisitions.add(p);
      if (i.unit) units.add(i.unit);
    });

    return {
      // Display the category CODE (matches the listing table's category column),
      // keep the full name as the value so filtering/counts still match item.primaryCategory.
      primaryCategories: Array.from(primaryCats).sort().map((v) => ({ value: v, label: toCategoryCode(v) })),
      acquisitionMethods: Array.from(acquisitions).sort().map((v) => ({ value: v, label: v })),
      units: Array.from(units).sort().map((v) => ({ value: v, label: v })),
    };
  }, [items]);

  const onHandValues = useMemo(() => items.map((i) => i.onHandQty || 0), [items]);

  const activeCount = countActiveFilters(filters);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[50%] left-[50%] z-[200] translate-x-[-50%] translate-y-[-50%] w-full max-w-[680px] max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 outline-none"
        >
          <DialogPrimitive.Title className="sr-only">
            Filters
          </DialogPrimitive.Title>

          {/* Header */}
          <div className="flex items-center justify-center relative px-6 h-12 border-b border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-[14px]" style={{ fontWeight: 600 }}>
              Filters
            </span>
            {activeCount > 0 && (
              <span
                className="ml-2 min-w-[20px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
              >
                {activeCount}
              </span>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {/* Status — chip row */}
            <Section title="Status">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "Active", label: "Active" },
                  { value: "Inactive", label: "Inactive" },
                ].map((opt) => (
                  <Pill
                    key={opt.value}
                    label={opt.label}
                    selected={filters.statuses.includes(opt.value)}
                    onClick={() => toggleMulti("statuses", opt.value)}
                    count={items.filter((i) => i.status === opt.value).length}
                  />
                ))}
              </div>
            </Section>

            <Divider />

            {/* Inventory Control — chip row */}
            <Section title="Inventory control">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "Serialized", label: "Serialized" },
                  { value: "Non-Serialized", label: "Non-Serialized" },
                ].map((opt) => (
                  <Pill
                    key={opt.value}
                    label={opt.label}
                    selected={filters.inventoryControl.includes(opt.value)}
                    onClick={() => toggleMulti("inventoryControl", opt.value)}
                    count={items.filter((i) => i.inventoryControlType === opt.value).length}
                  />
                ))}
              </div>
            </Section>

            <Divider />

            {/* Primary Category — searchable multi-select */}
            {filterOptions.primaryCategories.length > 0 && (
              <>
                <Section title="Primary category">
                  <SearchableMultiSelect
                    options={filterOptions.primaryCategories}
                    selected={filters.primaryCategories}
                    onToggle={(v) => toggleMulti("primaryCategories", v)}
                    getCount={(val) => items.filter((i) => i.primaryCategory === val).length}
                    placeholder="Search categories…"
                  />
                </Section>
                <Divider />
              </>
            )}

            {/* Acquisition Method — pill chips (primary only) */}
            {filterOptions.acquisitionMethods.length > 0 && (
              <>
                <Section title="Acquisition method" subtitle="Filters by primary method only.">
                  <PillSection
                    options={filterOptions.acquisitionMethods}
                    selected={filters.acquisitionMethods}
                    onToggle={(v) => toggleMulti("acquisitionMethods", v)}
                    getCount={(val) => items.filter((i) => getPrimaryAcquisition(i) === val).length}
                  />
                </Section>
                <Divider />
              </>
            )}

            {/* Unit — searchable multi-select */}
            {filterOptions.units.length > 0 && (
              <>
                <Section title="Unit">
                  <SearchableMultiSelect
                    options={filterOptions.units}
                    selected={filters.units}
                    onToggle={(v) => toggleMulti("units", v)}
                    getCount={(val) => items.filter((i) => i.unit === val).length}
                    placeholder="Search units…"
                  />
                </Section>
                <Divider />
              </>
            )}

            {/* On-Hand Quantity — range */}
            <Section title="On-hand quantity" subtitle="Filter by on-hand stock count.">
              <RangeHistogram
                values={onHandValues}
                min={filters.onHandMin}
                max={filters.onHandMax}
                onMinChange={(v) => update("onHandMin", v)}
                onMaxChange={(v) => update("onHandMax", v)}
              />
            </Section>

            <Divider />

            {/* Created on — date range */}
            <Section title="Created on" subtitle="Filter by creation date.">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                    From
                  </label>
                  <input
                    type="date"
                    value={filters.createdFrom}
                    onChange={(e) => update("createdFrom", e.target.value)}
                    className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                    To
                  </label>
                  <input
                    type="date"
                    value={filters.createdTo}
                    onChange={(e) => update("createdTo", e.target.value)}
                    className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
            </Section>
          </div>

          {/* Sticky footer */}
          <div className="flex items-center justify-between px-6 h-14 border-t border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => onFiltersChange({ ...DEFAULT_FILTERS })}
              className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-white text-[13px] cursor-pointer transition-colors hover:opacity-90"
              style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
            >
              Show {filteredCount.toLocaleString()} item{filteredCount !== 1 ? "s" : ""}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
