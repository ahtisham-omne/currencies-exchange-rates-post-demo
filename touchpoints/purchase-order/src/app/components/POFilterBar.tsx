import React, { useState, useMemo, useCallback } from "react";
import {
  Search,
  X,
  Plus,
  Check,
  ChevronDown,
  CalendarDays,
  Building2,
  User,
  MapPin,
  UserCircle,
  CircleDot,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { FONT } from "./designTokens";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type POStatus =
  | "Draft"
  | "Sent"
  | "Confirmed"
  | "Cancelled"
  | "Partially Received"
  | "Fully Received"
  | "Active with Cancellation"
  | "Closed with Cancellations";

export interface POFilterState {
  status: POStatus[];
  partnerLocation: string[];
  pointOfContact: string[];
  createdBy: string[];
  location: string[];
  dueDateFrom: string;
  dueDateTo: string;
  orderDateFrom: string;
  orderDateTo: string;
  ownership: "all" | "me";
}

export const EMPTY_FILTERS: POFilterState = {
  status: [],
  partnerLocation: [],
  pointOfContact: [],
  createdBy: [],
  location: [],
  dueDateFrom: "",
  dueDateTo: "",
  orderDateFrom: "",
  orderDateTo: "",
  ownership: "all",
};

/** Counts how many non-status filter dimensions are active */
export function countNonStatusFilters(f: POFilterState): number {
  let c = 0;
  if (f.partnerLocation.length > 0) c++;
  if (f.pointOfContact.length > 0) c++;
  if (f.createdBy.length > 0) c++;
  if (f.location.length > 0) c++;
  if (f.dueDateFrom || f.dueDateTo) c++;
  if (f.orderDateFrom || f.orderDateTo) c++;
  return c;
}

/** Whether any non-status filters are applied */
export function hasNonStatusFilters(f: POFilterState): boolean {
  return countNonStatusFilters(f) > 0;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const STATUS_LIST: POStatus[] = [
  "Draft", "Sent", "Confirmed", "Cancelled",
  "Partially Received", "Fully Received",
  "Active with Cancellation", "Closed with Cancellations",
];

const STATUS_DOT_INLINE: Record<POStatus, React.CSSProperties> = {
  Draft:                      { backgroundColor: "var(--status-draft-text)" },
  Sent:                       { backgroundColor: "var(--status-sent-text)" },
  Confirmed:                  { backgroundColor: "var(--status-confirmed-text)" },
  "Partially Received":       { backgroundColor: "var(--status-partial-text)" },
  "Fully Received":           { backgroundColor: "var(--status-received-text)" },
  Cancelled:                  { backgroundColor: "var(--status-cancelled-text)" },
  "Active with Cancellation": { backgroundColor: "hsl(var(--warning))" },
  "Closed with Cancellations":{ backgroundColor: "var(--status-received-text)" },
};

/* ═══════════════════════════════════════════════════════════════
   TYPOGRAPHY — CSS-var bound, Inter only
   ═══════════════════════════════════════════════════════════════ */

const typo = {
  chipLabel: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,
  chipValue: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,
  sectionLabel: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "14px",
    fontFamily: FONT,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  optionLabel: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
  } as React.CSSProperties,
  searchInput: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,
  menuItem: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
  } as React.CSSProperties,
  countBadge: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "14px",
    fontFamily: FONT,
  } as React.CSSProperties,
  clearAll: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,
  conjunction: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,
  dateLabel: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "14px",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ═══════════════════════════════════════════════════════════════
   FILTER CATEGORY DEFINITIONS
   ═══════════════════════════════════════════════════════════════ */

type FilterCategoryId =
  | "status"
  | "partnerLocation"
  | "pointOfContact"
  | "createdBy"
  | "location"
  | "dueDate"
  | "orderDate";

interface FilterCategoryDef {
  id: FilterCategoryId;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  kind: "multi-select" | "date-range";
}

const FILTER_CATEGORIES: FilterCategoryDef[] = [
  { id: "status",          label: "Status",            shortLabel: "Status",     icon: CircleDot,    kind: "multi-select" },
  { id: "partnerLocation", label: "Partner Location",  shortLabel: "Partner",    icon: Building2,    kind: "multi-select" },
  { id: "pointOfContact",  label: "Vendor Contact",    shortLabel: "Contact",    icon: User,         kind: "multi-select" },
  { id: "createdBy",       label: "Created By",        shortLabel: "Creator",    icon: UserCircle,   kind: "multi-select" },
  { id: "location",        label: "Location",          shortLabel: "Location",   icon: MapPin,       kind: "multi-select" },
  { id: "dueDate",         label: "Expected PO completion", shortLabel: "Completion", icon: CalendarDays, kind: "date-range" },
  { id: "orderDate",       label: "Need By Date",      shortLabel: "Need By",    icon: CalendarDays, kind: "date-range" },
];

/* ═══════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════ */

interface POFilterBarProps {
  filters: POFilterState;
  onFiltersChange: (f: POFilterState) => void;
  partnerLocations: string[];
  contacts: string[];
  creators: string[];
  locations: string[];
}

/* ═══════════════════════════════════════════════════════════════
   MULTI-SELECT FILTER CHIP (ClickUp-style)
   Self-contained: field name | values | × — all in one chip
   ══════════════════════════════════════════════════════════════ */

function MultiSelectChip({
  category,
  options,
  selected,
  onSelectedChange,
  onRemove,
  isStatus,
}: {
  category: FilterCategoryDef;
  options: string[];
  selected: string[];
  onSelectedChange: (s: string[]) => void;
  onRemove: () => void;
  isStatus?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, search]);

  const toggle = (val: string) => {
    onSelectedChange(
      selected.includes(val)
        ? selected.filter((s) => s !== val)
        : [...selected, val]
    );
  };

  const valueSummary = selected.length === 0
    ? "is any"
    : selected.length === 1
      ? `is ${selected[0]}`
      : `is any of ${selected.length}`;

  const Icon = category.icon;

  return (
    <div className="inline-flex items-center shrink-0 group/chip">
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex items-center gap-1.5 h-7 rounded-l-[var(--radius-sm)] border border-r-0 pl-2 pr-1.5 transition-all cursor-pointer ${
              selected.length > 0
                ? "bg-primary/5 border-primary/20 text-foreground hover:bg-primary/8"
                : "bg-card border-border text-foreground/50 hover:bg-secondary hover:text-foreground/70"
            }`}
          >
            <Icon className="size-3 shrink-0 opacity-50" />
            <span style={typo.chipLabel}>{category.shortLabel}</span>
            {selected.length > 0 && (
              <>
                <span className="text-foreground/35" style={typo.chipValue}>·</span>
                <span className="text-foreground/65 max-w-[140px] truncate" style={typo.chipValue}>
                  {valueSummary}
                </span>
              </>
            )}
            <ChevronDown className="size-2.5 opacity-35 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[280px] p-0" sideOffset={6}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-1.5">
              <Icon className="size-3.5 text-foreground/40" />
              <span className="text-foreground" style={typo.chipLabel}>{category.label}</span>
            </div>
            {selected.length > 0 && (
              <button
                className="text-primary hover:underline cursor-pointer"
                style={typo.clearAll}
                onClick={() => onSelectedChange([])}
              >
                Clear
              </button>
            )}
          </div>

          {/* Search (only when >5 options) */}
          {options.length > 5 && (
            <div className="px-3 py-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-foreground/30" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${category.label.toLowerCase()}...`}
                  className="h-7 w-full rounded-[var(--radius-sm)] border border-border pl-7 pr-7 text-foreground placeholder:text-foreground/30 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/20"
                  style={{ ...typo.searchInput, backgroundColor: "hsl(var(--input-background))" }}
                />
                {search && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground cursor-pointer transition-colors"
                    onClick={() => setSearch("")}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options list */}
          <ScrollArea className="max-h-[240px]">
            <div className="py-1 px-1">
              {filtered.length === 0 ? (
                <div className="py-4 text-center text-foreground/35" style={typo.optionLabel}>
                  No results found
                </div>
              ) : (
                filtered.map((option) => {
                  const isSelected = selected.includes(option);
                  return (
                    <button
                      key={option}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                        isSelected ? "bg-primary/5" : "hover:bg-secondary"
                      }`}
                      onClick={() => toggle(option)}
                    >
                      <div
                        className={`flex items-center justify-center size-4 rounded-[3px] border shrink-0 transition-colors ${
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-border bg-card"
                        }`}
                      >
                        {isSelected && <Check className="size-2.5 text-primary-foreground" />}
                      </div>
                      {isStatus ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="size-1.5 rounded-full shrink-0" style={STATUS_DOT_INLINE[option as POStatus]} />
                          <span className="text-foreground truncate" style={typo.optionLabel}>{option}</span>
                        </div>
                      ) : (
                        <span className="text-foreground truncate" style={typo.optionLabel}>{option}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Footer count */}
          {selected.length > 0 && (
            <div className="px-3 py-2 border-t border-border">
              <span className="text-foreground/40" style={typo.countBadge}>
                {selected.length} of {options.length} selected
              </span>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Remove button — right side of the chip */}
      <button
        className={`inline-flex items-center justify-center h-7 w-6 rounded-r-[var(--radius-sm)] border border-l-0 transition-colors cursor-pointer ${
          selected.length > 0
            ? "bg-primary/5 border-primary/20 text-foreground/30 hover:text-destructive hover:bg-destructive/8"
            : "bg-card border-border text-foreground/25 hover:text-destructive hover:bg-destructive/8"
        }`}
        onClick={onRemove}
        aria-label={`Remove ${category.label} filter`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DATE RANGE CHIP (ClickUp-style)
   ══════════════════════════════════════════════════════════���════ */

function DateRangeChip({
  category,
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  onRemove,
}: {
  category: FilterCategoryDef;
  fromDate: string;
  toDate: string;
  onFromChange: (d: string) => void;
  onToChange: (d: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasValue = fromDate || toDate;

  const formatDate = (d: string) => {
    if (!d) return "";
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  };

  const valueSummary = !hasValue
    ? "is any"
    : fromDate && toDate
      ? `${formatDate(fromDate)} – ${formatDate(toDate)}`
      : fromDate
        ? `from ${formatDate(fromDate)}`
        : `until ${formatDate(toDate)}`;

  const [activeTab, setActiveTab] = useState<"from" | "to">("from");
  const fromParsed = fromDate ? new Date(fromDate + "T00:00:00") : undefined;
  const toParsed = toDate ? new Date(toDate + "T00:00:00") : undefined;

  const Icon = category.icon;

  return (
    <div className="inline-flex items-center shrink-0 group/chip">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex items-center gap-1.5 h-7 rounded-l-[var(--radius-sm)] border border-r-0 pl-2 pr-1.5 transition-all cursor-pointer ${
              hasValue
                ? "bg-primary/5 border-primary/20 text-foreground hover:bg-primary/8"
                : "bg-card border-border text-foreground/50 hover:bg-secondary hover:text-foreground/70"
            }`}
          >
            <Icon className="size-3 shrink-0 opacity-50" />
            <span style={typo.chipLabel}>{category.shortLabel}</span>
            {hasValue && (
              <>
                <span className="text-foreground/35" style={typo.chipValue}>·</span>
                <span className="text-foreground/65 max-w-[180px] truncate" style={typo.chipValue}>
                  {valueSummary}
                </span>
              </>
            )}
            <ChevronDown className="size-2.5 opacity-35 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0" sideOffset={6}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-1.5">
              <Icon className="size-3.5 text-foreground/40" />
              <span className="text-foreground" style={typo.chipLabel}>{category.label}</span>
            </div>
            {hasValue && (
              <button
                className="text-primary hover:underline cursor-pointer"
                style={typo.clearAll}
                onClick={() => { onFromChange(""); onToChange(""); }}
              >
                Clear
              </button>
            )}
          </div>

          {/* From / To tabs */}
          <div className="flex items-center gap-0 border-b border-border">
            {(["from", "to"] as const).map((tab) => {
              const isActive = activeTab === tab;
              const val = tab === "from" ? fromDate : toDate;
              return (
                <button
                  key={tab}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors cursor-pointer ${
                    isActive
                      ? "border-b-2 border-primary text-primary"
                      : "text-foreground/45 hover:text-foreground/65"
                  }`}
                  style={typo.dateLabel}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "from" ? "From" : "To"}
                  {val && (
                    <span className="text-foreground/50" style={{ ...typo.countBadge, textTransform: "none" as const }}>
                      {formatDate(val)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Calendar */}
          <div className="p-1">
            {activeTab === "from" ? (
              <Calendar
                mode="single"
                selected={fromParsed}
                onSelect={(d) => {
                  if (d) {
                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    onFromChange(iso);
                    setActiveTab("to");
                  } else {
                    onFromChange("");
                  }
                }}
                disabled={toParsed ? { after: toParsed } : undefined}
                initialFocus
              />
            ) : (
              <Calendar
                mode="single"
                selected={toParsed}
                onSelect={(d) => {
                  if (d) {
                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    onToChange(iso);
                  } else {
                    onToChange("");
                  }
                }}
                disabled={fromParsed ? { before: fromParsed } : undefined}
                initialFocus
              />
            )}
          </div>

          {/* Quick presets */}
          <div className="px-3 py-2 border-t border-border flex flex-wrap gap-1">
            {[
              { label: "Last 7 days", days: 7 },
              { label: "Last 30 days", days: 30 },
              { label: "Last 90 days", days: 90 },
            ].map((preset) => (
              <button
                key={preset.label}
                className="inline-flex items-center h-6 px-2 rounded-[var(--radius-sm)] border border-border bg-secondary/50 text-foreground/55 hover:bg-secondary hover:text-foreground/75 transition-colors cursor-pointer"
                style={typo.countBadge}
                onClick={() => {
                  const now = new Date();
                  const past = new Date(now.getTime() - preset.days * 86400000);
                  const toIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                  const fromIso = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-${String(past.getDate()).padStart(2, "0")}`;
                  onFromChange(fromIso);
                  onToChange(toIso);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Remove button */}
      <button
        className={`inline-flex items-center justify-center h-7 w-6 rounded-r-[var(--radius-sm)] border border-l-0 transition-colors cursor-pointer ${
          hasValue
            ? "bg-primary/5 border-primary/20 text-foreground/30 hover:text-destructive hover:bg-destructive/8"
            : "bg-card border-border text-foreground/25 hover:text-destructive hover:bg-destructive/8"
        }`}
        onClick={onRemove}
        aria-label={`Remove ${category.label} filter`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADD FILTER MENU
   ═══════════════════════════════════════════════════════════════ */

function AddFilterMenu({
  activeCategories,
  onAdd,
}: {
  activeCategories: FilterCategoryId[];
  onAdd: (id: FilterCategoryId) => void;
}) {
  const [open, setOpen] = useState(false);
  const inactiveCategories = FILTER_CATEGORIES.filter(
    (c) => !activeCategories.includes(c.id)
  );

  if (inactiveCategories.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1 h-7 rounded-[var(--radius-sm)] border border-dashed border-foreground/15 px-2 text-foreground/35 hover:text-foreground/55 hover:border-foreground/25 hover:bg-secondary/60 transition-all cursor-pointer shrink-0"
          style={typo.chipLabel}
        >
          <Plus className="size-3" />
          <span>Add filter</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[220px] p-0" sideOffset={6}>
        <div className="px-3 py-2.5 border-b border-border">
          <span className="text-foreground/40" style={typo.sectionLabel}>Filter by</span>
        </div>
        <div className="py-1 px-1">
          {inactiveCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-sm)] hover:bg-secondary transition-colors cursor-pointer"
                onClick={() => { onAdd(cat.id); setOpen(false); }}
              >
                <Icon className="size-3.5 text-foreground/40" />
                <span className="text-foreground" style={typo.menuItem}>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN FILTER BAR COMPONENT
   ─ This is a dedicated row shown below the status tabs.
   ─ Status tabs handle quick single-status switching.
   ─ This bar handles: multi-status (advanced), partner,
     contact, creator, location, date ranges.
   ═══════════════════════════════════════════════════════════════ */

export default function POFilterBar({
  filters,
  onFiltersChange,
  partnerLocations,
  contacts,
  creators,
  locations,
}: POFilterBarProps) {
  /* ── Track which filter categories are visible as chips ── */
  const [activeCategories, setActiveCategories] = useState<FilterCategoryId[]>(() => {
    const initial: FilterCategoryId[] = [];
    if (filters.status.length > 1) initial.push("status"); // only show if multi-status (single handled by tabs)
    if (filters.partnerLocation.length > 0) initial.push("partnerLocation");
    if (filters.pointOfContact.length > 0) initial.push("pointOfContact");
    if (filters.createdBy.length > 0) initial.push("createdBy");
    if (filters.location.length > 0) initial.push("location");
    if (filters.dueDateFrom || filters.dueDateTo) initial.push("dueDate");
    if (filters.orderDateFrom || filters.orderDateTo) initial.push("orderDate");
    return initial;
  });

  const addCategory = useCallback((id: FilterCategoryId) => {
    setActiveCategories((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeCategory = useCallback(
    (id: FilterCategoryId) => {
      setActiveCategories((prev) => prev.filter((c) => c !== id));
      // Clear the filter values for this category
      const updates: Partial<POFilterState> = {};
      switch (id) {
        case "status":          updates.status = [];          break;
        case "partnerLocation": updates.partnerLocation = []; break;
        case "pointOfContact":  updates.pointOfContact = [];  break;
        case "createdBy":       updates.createdBy = [];       break;
        case "location":        updates.location = [];        break;
        case "dueDate":         updates.dueDateFrom = ""; updates.dueDateTo = ""; break;
        case "orderDate":       updates.orderDateFrom = ""; updates.orderDateTo = ""; break;
      }
      onFiltersChange({ ...filters, ...updates });
    },
    [filters, onFiltersChange]
  );

  const clearAll = useCallback(() => {
    onFiltersChange({ ...EMPTY_FILTERS, ownership: filters.ownership });
    setActiveCategories([]);
  }, [onFiltersChange, filters.ownership]);

  const nonStatusCount = countNonStatusFilters(filters);
  const hasStatusChip = activeCategories.includes("status");
  const totalActiveCount = nonStatusCount + (hasStatusChip && filters.status.length > 0 ? 1 : 0);

  /* ── If there are no active category chips, show nothing ── */
  if (activeCategories.length === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <AddFilterMenu activeCategories={activeCategories} onAdd={addCategory} />
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
      {/* "Where" conjunction before first chip */}
      <span className="text-foreground/30 shrink-0 select-none" style={typo.conjunction}>Where</span>

      {activeCategories.map((catId, idx) => {
        const cat = FILTER_CATEGORIES.find((c) => c.id === catId)!;
        if (!cat) return null;

        const optionsMap: Record<string, string[]> = {
          status: STATUS_LIST,
          partnerLocation: partnerLocations,
          pointOfContact: contacts,
          createdBy: creators,
          location: locations,
        };

        return (
          <div key={catId} className="contents">
            {/* "and" conjunction between chips */}
            {idx > 0 && (
              <span className="text-foreground/25 shrink-0 select-none" style={typo.conjunction}>and</span>
            )}

            {cat.kind === "date-range" ? (
              <DateRangeChip
                category={cat}
                fromDate={catId === "dueDate" ? filters.dueDateFrom : filters.orderDateFrom}
                toDate={catId === "dueDate" ? filters.dueDateTo : filters.orderDateTo}
                onFromChange={(v) =>
                  onFiltersChange({
                    ...filters,
                    [catId === "dueDate" ? "dueDateFrom" : "orderDateFrom"]: v,
                  })
                }
                onToChange={(v) =>
                  onFiltersChange({
                    ...filters,
                    [catId === "dueDate" ? "dueDateTo" : "orderDateTo"]: v,
                  })
                }
                onRemove={() => removeCategory(catId)}
              />
            ) : (
              <MultiSelectChip
                category={cat}
                options={optionsMap[catId] || []}
                selected={
                  (filters[catId as keyof Pick<POFilterState, "status" | "partnerLocation" | "pointOfContact" | "createdBy" | "location">] as string[]) || []
                }
                onSelectedChange={(vals) =>
                  onFiltersChange({ ...filters, [catId]: vals })
                }
                onRemove={() => removeCategory(catId)}
                isStatus={catId === "status"}
              />
            )}
          </div>
        );
      })}

      {/* Add filter button */}
      <AddFilterMenu activeCategories={activeCategories} onAdd={addCategory} />

      {/* Clear all */}
      {totalActiveCount > 0 && (
        <div className="contents">
          <Separator orientation="vertical" className="!h-4 shrink-0 mx-0.5" />
          <button
            className="inline-flex items-center gap-1 h-6 px-1.5 rounded-[var(--radius-sm)] text-foreground/40 hover:text-destructive hover:bg-destructive/6 transition-all cursor-pointer shrink-0"
            style={typo.clearAll}
            onClick={clearAll}
          >
            <X className="size-2.5" />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}