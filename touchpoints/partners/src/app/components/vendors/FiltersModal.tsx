import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import type { Vendor } from "../../data/vendors";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "../ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronDown, ChevronUp, Search } from "lucide-react";

/* ─── Filter Types ─── */
export interface AdvancedFilters {
  partnerTypes: string[];
  vendorTypes: string[];
  statuses: string[];
  partnerGroups: string[];
  services: string[];
  countries: string[];
  createdBy: string[];
  netProfitMin: string;
  netProfitMax: string;
  creditLimitMin: string;
  creditLimitMax: string;
  creditUtilMin: string;
  creditUtilMax: string;
  email: string;
  website: string;
  createdFrom: string;
  createdTo: string;
}

export const DEFAULT_FILTERS: AdvancedFilters = {
  partnerTypes: [],
  vendorTypes: [],
  statuses: [],
  partnerGroups: [],
  services: [],
  countries: [],
  createdBy: [],
  netProfitMin: "",
  netProfitMax: "",
  creditLimitMin: "",
  creditLimitMax: "",
  creditUtilMin: "",
  creditUtilMax: "",
  email: "",
  website: "",
  createdFrom: "",
  createdTo: "",
};

export function countActiveFilters(f: AdvancedFilters): number {
  let count = 0;
  if (f.partnerTypes.length > 0) count++;
  if (f.vendorTypes.length > 0) count++;
  if (f.statuses.length > 0) count++;
  if (f.partnerGroups.length > 0) count++;
  if (f.services.length > 0) count++;
  if (f.countries.length > 0) count++;
  if (f.createdBy.length > 0) count++;
  if (f.netProfitMin || f.netProfitMax) count++;
  if (f.creditLimitMin || f.creditLimitMax) count++;
  if (f.creditUtilMin || f.creditUtilMax) count++;
  if (f.email) count++;
  if (f.website) count++;
  if (f.createdFrom || f.createdTo) count++;
  return count;
}

/* ─── Helpers ─── */
const formatShort = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
};

/* ─── Sub-components ─── */

/** Pill chip for multiselect */
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
        backgroundColor: selected ? "hsl(var(--accent))" : undefined,
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

/** Segmented control */
function SegmentedControl({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const allSelected = selected.length === 0;
  return (
    <div className="flex rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => onChange([])}
        className={`flex-1 py-2.5 text-[13px] cursor-pointer transition-colors border-r border-border ${
          allSelected
            ? "text-primary"
            : "bg-white text-foreground hover:bg-muted/30"
        }`}
        style={{
          fontWeight: 500,
          backgroundColor: allSelected ? "hsl(var(--accent))" : undefined,
        }}
      >
        Any
      </button>
      {options.map((opt, i) => {
        const isSelected = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              if (isSelected) {
                onChange(selected.filter((v) => v !== opt.value));
              } else {
                onChange([...selected, opt.value]);
              }
            }}
            className={`flex-1 py-2.5 text-[13px] cursor-pointer transition-colors ${
              i < options.length - 1 ? "border-r border-border" : ""
            } ${
              isSelected
                ? "text-primary"
                : "bg-white text-foreground hover:bg-muted/30"
            }`}
            style={{
              fontWeight: 500,
              backgroundColor: isSelected ? "hsl(var(--accent))" : undefined,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Min / Max input fields for numeric range filtering */
function RangeHistogram({
  values,
  min: filterMin,
  max: filterMax,
  onMinChange,
  onMaxChange,
  prefix = "$",
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
            {prefix}
          </span>
          <input
            type="number"
            placeholder={formatShort(sliderMin)}
            value={filterMin}
            onChange={(e) => onMinChange(e.target.value)}
            className="w-full h-9 pl-7 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] tabular-nums"
          />
        </div>
      </div>
      <span className="text-muted-foreground/30 mt-5">–</span>
      <div className="flex-1">
        <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
          Maximum
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
            {prefix}
          </span>
          <input
            type="number"
            placeholder={formatShort(sliderMax)}
            value={filterMax}
            onChange={(e) => onMaxChange(e.target.value)}
            className="w-full h-9 pl-7 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF] tabular-nums"
          />
        </div>
      </div>
    </div>
  );
}

/** Pill section with "Show more" — used for Vendor Type */
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
          style={{ fontWeight: 500, color: "hsl(var(--primary))" }}
        >
          {showAll ? "Show less" : `Show all ${options.length}`}
          {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

/** Searchable multi-select with checkbox list and selected tags */
function SearchableMultiSelect({
  options,
  selected,
  onToggle,
  getCount,
  placeholder = "Search\u2026",
  getPrefix,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  getCount: (value: string) => number;
  placeholder?: string;
  getPrefix?: (value: string) => string | undefined;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="space-y-2.5">
      {/* Search input */}
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

      {/* Suggestion / search result pills */}
      <div className="max-h-[180px] overflow-y-auto -mx-1 px-1 overscroll-contain">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-muted-foreground/50 py-3 text-center">No results</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const selectedSet = new Set(selected);
              const isSearching = !!query.trim();

              if (isSearching) {
                // When searching: show all filtered results
                return filtered.map((opt) => {
                  const isChecked = selectedSet.has(opt.value);
                  const count = getCount(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onToggle(opt.value)}
                      className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] border transition-colors cursor-pointer ${
                        isChecked
                          ? "bg-accent border-primary/25 text-primary"
                          : "bg-white border-border text-foreground hover:bg-muted/40"
                      }`}
                      style={{ fontWeight: isChecked ? 500 : 400 }}
                    >
                      {getPrefix?.(opt.value) && (
                        <span>{getPrefix(opt.value)}</span>
                      )}
                      <span className="truncate max-w-[140px]">{opt.label}</span>
                      <span className={`text-[10px] tabular-nums ${isChecked ? "text-primary/60" : "text-muted-foreground/50"}`}>
                        {count}
                      </span>
                    </button>
                  );
                });
              }

              // When idle: show selected items + top 6 suggestions
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
                        onClick={() => onToggle(opt.value)}
                        className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] border transition-colors cursor-pointer ${
                          isChecked
                            ? "bg-accent border-primary/25 text-primary"
                            : "bg-white border-border text-foreground hover:bg-muted/40"
                        }`}
                        style={{ fontWeight: isChecked ? 500 : 400 }}
                      >
                        {getPrefix?.(opt.value) && (
                          <span>{getPrefix(opt.value)}</span>
                        )}
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

/* ─── Section divider ─── */
function Divider() {
  return <div className="border-t border-border/50 mx-6" />;
}

/* ─── Section wrapper ─── */
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
  vendors: Vendor[];
  filteredCount: number;
}

export function FiltersModal({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  vendors,
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

  /* ─── Extract unique filter options from vendor data ─── */
  const filterOptions = useMemo(() => {
    const vendorTypes = new Set<string>();
    const partnerGroups = new Set<string>();
    const servicesList = new Set<string>();
    const countries = new Set<string>();
    const createdByList = new Set<string>();

    vendors.forEach((v) => {
      if (v.vendorType) vendorTypes.add(v.vendorType);
      if (v.partnerGroup) partnerGroups.add(v.partnerGroup);
      if (v.services) servicesList.add(v.services);
      if (v.country) countries.add(v.country);
      if (v.createdByContact?.name) createdByList.add(v.createdByContact.name);
    });

    return {
      vendorTypes: Array.from(vendorTypes).sort().map((v) => ({ value: v, label: v })),
      partnerGroups: Array.from(partnerGroups).sort().map((v) => ({ value: v, label: v })),
      services: Array.from(servicesList).sort().map((v) => ({ value: v, label: v })),
      countries: Array.from(countries).sort().map((v) => ({ value: v, label: v })),
      createdBy: Array.from(createdByList).sort().map((v) => ({ value: v, label: v })),
    };
  }, [vendors]);

  const netProfitValues = useMemo(() => vendors.map((v) => v.netProfitMargin), [vendors]);
  const creditLimitValues = useMemo(() => vendors.map((v) => v.creditLimit), [vendors]);
  const creditUtilValues = useMemo(() => vendors.map((v) => v.creditUtilization), [vendors]);

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

          {/* ─── Header ─── */}
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
                style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 600 }}
              >
                {activeCount}
              </span>
            )}
          </div>

          {/* ─── Scrollable body ─── */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {/* Partner Type — segmented control */}
            <Section title="Partner type" subtitle="Select the type of partner to show.">
              <SegmentedControl
                options={[
                  { value: "vendor", label: "Vendor" },
                  { value: "customer", label: "Customer" },
                ]}
                selected={filters.partnerTypes}
                onChange={(val) => update("partnerTypes", val)}
              />
            </Section>

            <Divider />

            {/* Status — chip row */}
            <Section title="Status">
              <div className="flex flex-wrap gap-1.5">
                <Pill
                  label="Any"
                  selected={filters.statuses.length === 0}
                  onClick={() => update("statuses", [])}
                />
                {[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                  { value: "archived", label: "Archived" },
                ].map((opt) => (
                  <Pill
                    key={opt.value}
                    label={opt.label}
                    selected={filters.statuses.includes(opt.value)}
                    onClick={() => toggleMulti("statuses", opt.value)}
                    count={vendors.filter((v) => v.status === opt.value).length}
                  />
                ))}
              </div>
            </Section>

            <Divider />

            {/* Vendor Type — pill chips */}
            {filterOptions.vendorTypes.length > 0 && (
              <>
                <Section title="Vendor type">
                  <PillSection
                    options={filterOptions.vendorTypes}
                    selected={filters.vendorTypes}
                    onToggle={(v) => toggleMulti("vendorTypes", v)}
                    getCount={(val) => vendors.filter((v) => v.vendorType === val).length}
                  />
                </Section>
                <Divider />
              </>
            )}

            {/* Partner Group — searchable multi-select */}
            {filterOptions.partnerGroups.length > 0 && (
              <>
                <Section title="Partner group">
                  <SearchableMultiSelect
                    options={filterOptions.partnerGroups}
                    selected={filters.partnerGroups}
                    onToggle={(v) => toggleMulti("partnerGroups", v)}
                    getCount={(val) => vendors.filter((v) => v.partnerGroup === val).length}
                    placeholder="Search partner groups…"
                  />
                </Section>
                <Divider />
              </>
            )}

            {/* Country — searchable multi-select with flags */}
            {filterOptions.countries.length > 0 && (
              <>
                <Section title="Country">
                  <SearchableMultiSelect
                    options={filterOptions.countries}
                    selected={filters.countries}
                    onToggle={(v) => toggleMulti("countries", v)}
                    getCount={(val) => vendors.filter((v) => v.country === val).length}
                    placeholder="Search countries…"
                    getPrefix={(val) => vendors.find((v) => v.country === val)?.countryFlag}
                  />
                </Section>
                <Divider />
              </>
            )}

            {/* Services — searchable multi-select */}
            {filterOptions.services.length > 0 && (
              <>
                <Section title="Services">
                  <SearchableMultiSelect
                    options={filterOptions.services}
                    selected={filters.services}
                    onToggle={(v) => toggleMulti("services", v)}
                    getCount={(val) => vendors.filter((v) => v.services === val).length}
                    placeholder="Search services…"
                  />
                </Section>
                <Divider />
              </>
            )}

            {/* Created By — searchable multi-select */}
            {filterOptions.createdBy.length > 0 && (
              <>
                <Section title="Created by">
                  <SearchableMultiSelect
                    options={filterOptions.createdBy}
                    selected={filters.createdBy}
                    onToggle={(v) => toggleMulti("createdBy", v)}
                    getCount={(val) => vendors.filter((v) => v.createdByContact?.name === val).length}
                    placeholder="Search people…"
                  />
                </Section>
                <Divider />
              </>
            )}

            {/* Net Margin — min/max range */}
            <Section title="Net margin range" subtitle="Filter by net profit margin.">
              <RangeHistogram
                values={netProfitValues}
                min={filters.netProfitMin}
                max={filters.netProfitMax}
                onMinChange={(v) => update("netProfitMin", v)}
                onMaxChange={(v) => update("netProfitMax", v)}
              />
            </Section>

            <Divider />

            {/* Credit Limit — min/max range */}
            <Section title="Credit limit range">
              <RangeHistogram
                values={creditLimitValues}
                min={filters.creditLimitMin}
                max={filters.creditLimitMax}
                onMinChange={(v) => update("creditLimitMin", v)}
                onMaxChange={(v) => update("creditLimitMax", v)}
              />
            </Section>

            <Divider />

            {/* Credit Utilization — min/max range */}
            <Section title="Credit utilization">
              <RangeHistogram
                values={creditUtilValues}
                min={filters.creditUtilMin}
                max={filters.creditUtilMax}
                onMinChange={(v) => update("creditUtilMin", v)}
                onMaxChange={(v) => update("creditUtilMax", v)}
              />
            </Section>

            <Divider />

            {/* Contact info — Email & Website text inputs */}
            <Section title="Contact info">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                    Email address
                  </label>
                  <input
                    type="text"
                    placeholder="Filter by email…"
                    value={filters.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/40"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>
                    Website
                  </label>
                  <input
                    type="text"
                    placeholder="Filter by website…"
                    value={filters.website}
                    onChange={(e) => update("website", e.target.value)}
                    className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>
            </Section>

            <Divider />

            {/* Created On — date range */}
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

          {/* ─── Sticky footer ─── */}
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
              style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 600 }}
            >
              Show {filteredCount.toLocaleString()} partner{filteredCount !== 1 ? "s" : ""}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}