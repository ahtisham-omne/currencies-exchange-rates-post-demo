import React from "react";
const { useState, useMemo, useCallback } = React;
import {
  Search, X, CalendarDays, ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
} from "./ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { Button } from "./ui/button";
import { FONT } from "./designTokens";
import type { POFilterState } from "./POFilterBar";
import { EMPTY_FILTERS } from "./POFilterBar";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type POStatus =
  | "Draft" | "Sent" | "Confirmed" | "Cancelled"
  | "Partially Received" | "Fully Received"
  | "Active with Cancellation" | "Closed with Cancellations" | "Closed";

const STATUS_LIST: POStatus[] = [
  "Draft", "Sent", "Confirmed", "Cancelled",
  "Partially Received", "Fully Received",
  "Active with Cancellation", "Closed with Cancellations", "Closed",
];

const STATUS_DOT: Record<POStatus, string> = {
  Draft:                       "var(--status-draft-text)",
  Sent:                        "var(--status-sent-text)",
  Confirmed:                   "var(--status-confirmed-text)",
  "Partially Received":        "var(--status-partial-text)",
  "Fully Received":            "var(--status-received-text)",
  Cancelled:                   "var(--status-cancelled-text)",
  "Active with Cancellation":  "var(--warning)",
  "Closed with Cancellations": "var(--danger)",
  Closed:                      "var(--status-closed-text)",
};

/* ═══════════════════════════════════════════════════════════════
   TYPOGRAPHY — CSS-var bound, Inter only
   ═══════════════════════════════════════════════════════════════ */

const t = {
  modalTitle: {
    fontSize: "var(--text-h4)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "28px",
    fontFamily: FONT,
    color: "var(--foreground)",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
    color: "var(--foreground)",
  } as React.CSSProperties,
  sectionSub: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  pill: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
  } as React.CSSProperties,
  pillCount: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "14px",
    fontFamily: FONT,
  } as React.CSSProperties,
  searchInput: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,
  fieldLabel: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  moreHint: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  footerBtn: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,
  dateInput: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ═══════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════ */

interface POFiltersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: POFilterState;
  onFiltersChange: (f: POFilterState) => void;
  partnerLocations: string[];
  contacts: string[];
  creators: string[];
  locations: string[];
  quoteValues: number[];
  filteredCount: number;
}

/* ═══════════════════════════════════════════════════════════════
   COUNT LOGIC — each category counts as 1
   ════════════════════════════════���══════════════════════════════ */

export function countAllFilters(f: POFilterState): number {
  let c = 0;
  if (f.status.length > 0) c++;
  if (f.partnerLocation.length > 0) c++;
  if (f.pointOfContact.length > 0) c++;
  if (f.createdBy.length > 0) c++;
  if (f.location.length > 0) c++;
  if (f.dueDateFrom || f.dueDateTo) c++;
  if (f.orderDateFrom || f.orderDateTo) c++;
  return c;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION WRAPPER
   ═══════════════════════════════════════════════════════════════ */

function Section({
  title,
  subtitle,
  children,
  noBorder,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <div
      className="py-5"
      style={{
        borderBottom: noBorder ? "none" : "1px solid var(--border)",
        paddingLeft: "20px",
        paddingRight: "20px",
      }}
    >
      <div className="mb-3">
        <div style={t.sectionTitle}>{title}</div>
        {subtitle && (
          <div className="mt-0.5" style={t.sectionSub}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STATUS PILL — rounded pill chip with optional dot + count
   (Toggle on click, selected = primary tint fill + primary border)
   ═══════════════════════════════════════════════════════════════ */

function StatusPill({
  label,
  isSelected,
  onClick,
  count,
  dotColor,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  count?: number;
  dotColor?: string;
}) {
  return (
    <button
      className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-full border transition-all cursor-pointer"
      style={{
        ...t.pill,
        backgroundColor: isSelected ? "var(--primary-tint)" : "var(--card)",
        borderColor: isSelected ? "var(--primary)" : "var(--border)",
        color: isSelected ? "var(--primary)" : "var(--foreground)",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = "var(--secondary)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isSelected ? "var(--primary-tint)" : "var(--card)";
      }}
    >
      {dotColor && (
        <span
          className="size-[7px] rounded-full shrink-0"
          style={{ backgroundColor: dotColor }}
        />
      )}
      <span>{label}</span>
      {count !== undefined && (
        <span
          style={{
            ...t.pillCount,
            color: isSelected ? "var(--primary)" : "var(--muted-foreground)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SEARCHABLE PILL MULTI-SELECT
   Reference pattern:
   - Search input (full width)
   - Below: inline pill chips for options (selected ones highlighted)
   - If too many: show first N + "+X more — type to search" hint
   - Typing filters the visible pills
   - No dropdown, no checkbox list, no overlay — all inline
   ═══════════════════════════════════════════════════════════════ */

const PILL_VISIBLE_LIMIT = 6;

function SearchablePillSelect({
  options,
  selected,
  onToggle,
  placeholder,
  counts,
}: {
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  placeholder: string;
  counts?: Record<string, number>;
}) {
  const [search, setSearch] = useState("");
  const isSearching = search.trim().length > 0;

  // Filter by search query
  const filtered = useMemo(() => {
    if (!isSearching) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, search, isSearching]);

  // Sort: selected first, then alphabetical
  const sorted = useMemo(() => {
    const sel = filtered.filter((o) => selected.includes(o));
    const rest = filtered.filter((o) => !selected.includes(o));
    return [...sel, ...rest];
  }, [filtered, selected]);

  // When NOT searching, cap visible pills
  const visible = isSearching ? sorted : sorted.slice(0, PILL_VISIBLE_LIMIT);
  const hiddenCount = isSearching ? 0 : Math.max(0, sorted.length - PILL_VISIBLE_LIMIT);

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-3">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
          style={{ color: "var(--muted-foreground)" }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-[var(--radius)] border border-border pl-9 pr-9 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/20"
          style={{
            ...t.searchInput,
            backgroundColor: "var(--input-background)",
            color: "var(--foreground)",
          }}
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer transition-colors"
            style={{ color: "var(--muted-foreground)" }}
            onClick={() => setSearch("")}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Pill chips — inline, wrapping */}
      {visible.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {visible.map((option) => {
            const isSelected = selected.includes(option);
            const count = counts?.[option];
            return (
              <StatusPill
                key={option}
                label={option}
                isSelected={isSelected}
                onClick={() => onToggle(option)}
                count={count}
              />
            );
          })}
          {hiddenCount > 0 && (
            <span className="ml-0.5" style={t.moreHint}>
              +{hiddenCount} more — type to search
            </span>
          )}
        </div>
      ) : (
        <div className="py-2" style={{ ...t.moreHint, color: "var(--muted-foreground)" }}>
          {isSearching ? "No results found" : "No options available"}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DATE PICKER INPUT — clickable field that opens a calendar popover
   ═══════════════════════════════════════════════════════════════ */

function DatePickerInput({
  label,
  value,
  onChange,
  disabledMatcher,
}: {
  label: string;
  value: string;
  onChange: (d: string) => void;
  disabledMatcher?: React.ComponentProps<typeof Calendar>["disabled"];
}) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value + "T00:00:00") : undefined;

  const formatDate = (d: string) => {
    if (!d) return "";
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "short", day: "2-digit", year: "numeric",
    });
  };

  return (
    <div className="flex-1">
      <div className="mb-1.5" style={t.fieldLabel}>{label}</div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="h-10 w-full flex items-center justify-between rounded-[var(--radius)] border border-border px-3 transition-all cursor-pointer hover:border-muted-foreground"
            style={{
              ...t.dateInput,
              backgroundColor: "var(--input-background)",
              color: value ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0" style={{ color: "var(--muted-foreground)" }} />
              <span>{value ? formatDate(value) : "Select date"}</span>
            </div>
            {value && (
              <span
                className="shrink-0 ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                style={{ color: "var(--muted-foreground)" }}
              >
                <X className="size-3.5 hover:opacity-70 transition-opacity" />
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0" sideOffset={6}>
          <div className="p-1">
            <Calendar
              mode="single"
              selected={parsed}
              onSelect={(d) => {
                if (d) {
                  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  onChange(iso);
                  setOpen(false);
                } else {
                  onChange("");
                }
              }}
              disabled={disabledMatcher}
              initialFocus
            />
          </div>
          {/* Quick presets */}
          <div className="px-3 py-2.5 border-t border-border flex flex-wrap gap-1.5">
            {[
              { label: "Last 7 days", days: 7 },
              { label: "Last 30 days", days: 30 },
              { label: "Last 90 days", days: 90 },
            ].map((preset) => (
              <button
                key={preset.label}
                className="inline-flex items-center h-7 px-2.5 rounded-full border transition-colors cursor-pointer"
                style={{
                  ...t.pillCount,
                  borderColor: "var(--border)",
                  backgroundColor: "var(--card)",
                  color: "var(--muted-foreground)",
                }}
                onClick={() => {
                  const now = new Date();
                  const past = new Date(now.getTime() - preset.days * 86400000);
                  const iso = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-${String(past.getDate()).padStart(2, "0")}`;
                  onChange(iso);
                  setOpen(false);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--secondary)";
                  e.currentTarget.style.borderColor = "var(--muted-foreground)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--card)";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DateRangeSection({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
}: {
  fromDate: string;
  toDate: string;
  onFromChange: (d: string) => void;
  onToChange: (d: string) => void;
}) {
  const toParsed = toDate ? new Date(toDate + "T00:00:00") : undefined;
  const fromParsed = fromDate ? new Date(fromDate + "T00:00:00") : undefined;

  return (
    <div className="flex items-end gap-3">
      <DatePickerInput
        label="From"
        value={fromDate}
        onChange={onFromChange}
        disabledMatcher={toParsed ? { after: toParsed } : undefined}
      />
      <span
        className="pb-2.5 shrink-0"
        style={{ fontSize: "var(--text-base)", fontFamily: FONT, color: "var(--muted-foreground)" }}
      >
        –
      </span>
      <DatePickerInput
        label="To"
        value={toDate}
        onChange={onToChange}
        disabledMatcher={fromParsed ? { before: fromParsed } : undefined}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN FILTERS MODAL COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function POFiltersModal({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  partnerLocations,
  contacts,
  creators,
  locations,
  quoteValues: _quoteValues,
  filteredCount: _filteredCount,
}: POFiltersModalProps) {
  /* ── Local draft state — filters are staged here until Apply is clicked ── */
  const [draft, setDraft] = useState<POFilterState>(() => ({ ...filters }));

  /* Reset draft to match applied filters whenever the modal opens */
  const prevOpenRef = React.useRef(open);
  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraft({ ...filters });
    }
    prevOpenRef.current = open;
  }, [open, filters]);

  /* ── Draft helpers ── */
  const updateDraft = useCallback(
    (patch: Partial<POFilterState>) => setDraft((prev) => ({ ...prev, ...patch })),
    [],
  );

  const toggleDraftArrayItem = useCallback(
    (key: keyof POFilterState, val: string) => {
      setDraft((prev) => {
        const arr = prev[key] as string[];
        const next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
        return { ...prev, [key]: next };
      });
    },
    [],
  );

  const resetDraft = useCallback(() => {
    setDraft((prev) => ({ ...EMPTY_FILTERS, ownership: prev.ownership }));
  }, []);

  const stagedCount = countAllFilters(draft);

  /* ── Apply: push draft to parent ── */
  const applyFilters = useCallback(() => {
    onFiltersChange(draft);
    onOpenChange(false);
  }, [draft, onFiltersChange, onOpenChange]);

  /* ── Close without applying: discard staged selections ── */
  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) {
        // discard draft — reset to applied filters
        setDraft({ ...filters });
      }
      onOpenChange(v);
    },
    [filters, onOpenChange],
  );

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="bg-card fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%] flex flex-col w-full max-w-[calc(100%-2rem)] sm:max-w-[640px] max-h-[85vh] rounded-[var(--radius-lg)] border border-border duration-200 data-[state=open]:animate-modal-enter data-[state=closed]:animate-modal-exit [transform-origin:center_center]"
          style={{ boxShadow: "var(--elevation-lg)", fontFamily: FONT }}
        >
          {/* ── HEADER ── */}
          <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border">
            <DialogPrimitive.Close
              className="flex items-center justify-center size-8 rounded-[var(--radius-sm)] cursor-pointer transition-colors"
              style={{ color: "var(--muted-foreground)" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              aria-label="Close"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
            <span style={t.modalTitle}>Filters</span>
            {/* Spacer to balance close button on left */}
            <div className="size-8" />
          </div>

          {/* ── SCROLLABLE BODY ── */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}
          >
            {/* ── STATUS ── */}
            <Section title="Status" subtitle="Filter by order status">
              <div className="flex flex-wrap gap-2">
                {STATUS_LIST.map((s) => (
                  <StatusPill
                    key={s}
                    label={s}
                    isSelected={draft.status.includes(s)}
                    onClick={() => toggleDraftArrayItem("status", s)}
                    dotColor={STATUS_DOT[s]}
                  />
                ))}
              </div>
            </Section>

            {/* ── PARTNER LOCATION ── */}
            <Section
              title="Partner Location"
              subtitle="Filter by partner or vendor location"
            >
              <SearchablePillSelect
                options={partnerLocations}
                selected={draft.partnerLocation}
                onToggle={(val) => toggleDraftArrayItem("partnerLocation", val)}
                placeholder="Search partner locations..."
              />
            </Section>

            {/* ── VENDOR CONTACT ── */}
            <Section
              title="Vendor Contact"
              subtitle="Filter by point of contact"
            >
              <SearchablePillSelect
                options={contacts}
                selected={draft.pointOfContact}
                onToggle={(val) => toggleDraftArrayItem("pointOfContact", val)}
                placeholder="Search people..."
              />
            </Section>

            {/* ── CREATED BY ── */}
            <Section
              title="Created By"
              subtitle="Filter by who created the order"
            >
              <SearchablePillSelect
                options={creators}
                selected={draft.createdBy}
                onToggle={(val) => toggleDraftArrayItem("createdBy", val)}
                placeholder="Search people..."
              />
            </Section>

            {/* ── LOCATION ── */}
            <Section
              title="Location"
              subtitle="Filter by delivery location"
            >
              <SearchablePillSelect
                options={locations}
                selected={draft.location}
                onToggle={(val) => toggleDraftArrayItem("location", val)}
                placeholder="Search locations..."
              />
            </Section>

            {/* ── DUE DELIVERY DATE ── */}
            <Section
              title="Due Delivery Date"
              subtitle="Filter by expected delivery window"
            >
              <DateRangeSection
                fromDate={draft.dueDateFrom}
                toDate={draft.dueDateTo}
                onFromChange={(d) => updateDraft({ dueDateFrom: d })}
                onToChange={(d) => updateDraft({ dueDateTo: d })}
              />
            </Section>

            {/* ── ORDER DATE ── */}
            <Section
              title="Order Date"
              subtitle="Filter by when the order was placed"
              noBorder
            >
              <DateRangeSection
                fromDate={draft.orderDateFrom}
                toDate={draft.orderDateTo}
                onFromChange={(d) => updateDraft({ orderDateFrom: d })}
                onToChange={(d) => updateDraft({ orderDateTo: d })}
              />
            </Section>
          </div>

          {/* ── FOOTER ── */}
          <div
            className="shrink-0 flex items-center justify-between py-4 border-t border-border"
            style={{ backgroundColor: "var(--card)", paddingLeft: "20px", paddingRight: "20px" }}
          >
            <button
              className="inline-flex items-center cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default"
              style={{
                ...t.footerBtn,
                color: stagedCount > 0 ? "var(--foreground)" : "var(--muted-foreground)",
                background: "none",
                border: "none",
                padding: 0,
                textDecoration: "underline",
                textUnderlineOffset: "3px",
                textDecorationColor: "var(--border)",
              }}
              onClick={resetDraft}
              disabled={stagedCount === 0}
              onMouseEnter={(e) => {
                if (stagedCount > 0) {
                  e.currentTarget.style.textDecorationColor = "var(--foreground)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecorationColor = "var(--border)";
              }}
            >
              Reset
            </button>

            <div className="flex items-center gap-3">
              {stagedCount > 0 && (
                <span
                  style={{
                    ...t.footerBtn,
                    color: "var(--muted-foreground)",
                    fontSize: "var(--text-label)",
                  }}
                >
                  {stagedCount} {stagedCount === 1 ? "filter" : "filters"} selected
                </span>
              )}
              <Button
                className="h-9 px-5 rounded-[var(--radius)]"
                style={{
                  ...t.footerBtn,
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
                onClick={applyFilters}
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}