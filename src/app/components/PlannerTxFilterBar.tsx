/* ═══════════════════════════════════════════════════════════════
   PLANNER TRANSACTION FILTERS MODAL
   ───────────────────────────────────────────────────────────────
   Modal-based filter surface for the planner's transaction ledger,
   ported one-for-one from the PO listing's `POFiltersModal` recipe:

     · Dialog + DialogPortal + centred modal with header / body / footer
     · Section wrappers with title + subtitle + pill children
     · Draft state — filters are staged locally until Apply is clicked
     · Cancel discards; Apply pushes to the parent + closes

   Categories the planner cares about:
     · Transaction type   (typeKind multi-select)
     · Party              (Customer/Vendor searchable multi-select)
     · On-hand band       (band multi-select)

   Kept self-contained — no imports from `POFiltersModal.tsx` so the
   PO surfaces stay untouched per the current scope agreement.
   ═══════════════════════════════════════════════════════════════ */

import React, { useCallback, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogOverlay } from "./ui/dialog";
import { FONT } from "./designTokens";
import type { TxBand, TxRowData } from "./PlannerTransactionTable";

/* ─── Filter state ──────────────────────────────────────────── */

export type TxTypeKind = TxRowData["typeKind"];

export interface PlannerTxFilterState {
  typeKinds: TxTypeKind[];
  parties: string[];
  bands: TxBand[];
}

export const EMPTY_TX_FILTERS: PlannerTxFilterState = {
  typeKinds: [],
  parties: [],
  bands: [],
};

export function countTxFilters(f: PlannerTxFilterState): number {
  let c = 0;
  if (f.typeKinds.length > 0) c++;
  if (f.parties.length > 0) c++;
  if (f.bands.length > 0) c++;
  return c;
}

/* ─── Option metadata ───────────────────────────────────────── */

const TYPE_KIND_META: Record<TxTypeKind, { label: string; dot: string }> = {
  so:        { label: "Sales order",              dot: "#DC2626" },
  pr:        { label: "Purchase request",         dot: "#EA580C" },
  po:        { label: "Purchase order",           dot: "#059669" },
  draft:     { label: "Draft purchase order",     dot: "#64748B" },
  planned:   { label: "Planned purchase order",   dot: "#0A77FF" },
  simulated: { label: "Simulated",                dot: "#7C3AED" },
  demand:    { label: "Planned demand",           dot: "#DC2626" },
};

const BAND_META: Record<TxBand, { label: string; dot: string }> = {
  belowZero: { label: "Below zero", dot: "#B91C1C" },
  belowMin:  { label: "Below min",  dot: "#C2410C" },
  /* Above-max ADDED 2026-07-14 — Nophil: overstock is a real issue.
     Teal dot matches the graph's Above-max zone + the scope-bar
     Issues pill so the tone means the same thing everywhere. */
  aboveMax:  { label: "Above max",  dot: "#0F766E" },
  belowMax:  { label: "Below max",  dot: "#475569" },
  healthy:   { label: "Healthy",    dot: "#15803D" },
};

/* ─── Typography ────────────────────────────────────────────── */

const t = {
  modalTitle: {
    fontSize: 14,
    fontWeight: 500,
    lineHeight: "20px",
    fontFamily: FONT,
    color: "hsl(var(--foreground))",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 12,
    fontWeight: 500,
    lineHeight: "16px",
    fontFamily: FONT,
    color: "hsl(var(--foreground))",
  } as React.CSSProperties,
  sectionSub: {
    fontSize: 11,
    fontWeight: 400,
    lineHeight: "16px",
    fontFamily: FONT,
    color: "hsl(var(--muted-foreground))",
  } as React.CSSProperties,
  pill: {
    fontSize: 12,
    fontWeight: 500,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,
  btn: {
    fontSize: 12,
    fontWeight: 500,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,
  input: {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,
  hint: {
    fontSize: 11,
    fontWeight: 400,
    lineHeight: "16px",
    fontFamily: FONT,
    color: "hsl(var(--muted-foreground))",
  } as React.CSSProperties,
};

/* ─── Pill (multi-select toggle) ────────────────────────────── */

function Pill({
  label,
  isSelected,
  onClick,
  dotColor,
  count,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  dotColor?: string;
  count?: number;
}) {
  return (
    <button
      className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-full border transition-all cursor-pointer"
      style={{
        ...t.pill,
        backgroundColor: isSelected ? "hsl(var(--primary-tint))" : "hsl(var(--card))",
        borderColor: isSelected ? "hsl(var(--primary))" : "hsl(var(--border))",
        color: isSelected ? "hsl(var(--primary))" : "hsl(var(--foreground))",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.backgroundColor = "hsl(var(--secondary))";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isSelected
          ? "hsl(var(--primary-tint))"
          : "hsl(var(--card))";
      }}
    >
      {dotColor && (
        <span className="size-[7px] rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      )}
      <span>{label}</span>
      {count !== undefined && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: isSelected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ─── Section wrapper ───────────────────────────────────────── */

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
        borderBottom: noBorder ? "none" : "1px solid hsl(var(--border))",
        paddingLeft: 20,
        paddingRight: 20,
      }}
    >
      <div className="mb-3">
        <div style={t.sectionTitle}>{title}</div>
        {subtitle && <div className="mt-0.5" style={t.sectionSub}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

/* ─── Searchable party pill list ─────────────────────────────
   Mirrors POFiltersModal's SearchablePillSelect: inline pill grid,
   selected-first sort, capped visible count with "+N more" hint
   until the buyer types to search. */

const PILL_VISIBLE_LIMIT = 6;

function SearchablePillSelect({
  options,
  selected,
  onToggle,
  placeholder,
}: {
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  placeholder: string;
}) {
  const [search, setSearch] = useState("");
  const isSearching = search.trim().length > 0;

  const filtered = useMemo(() => {
    if (!isSearching) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, search, isSearching]);

  const sorted = useMemo(() => {
    const sel = filtered.filter((o) => selected.includes(o));
    const rest = filtered.filter((o) => !selected.includes(o));
    return [...sel, ...rest];
  }, [filtered, selected]);

  const visible = isSearching ? sorted : sorted.slice(0, PILL_VISIBLE_LIMIT);
  const hiddenCount = isSearching ? 0 : Math.max(0, sorted.length - PILL_VISIBLE_LIMIT);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground/30 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-[var(--radius-md)] border border-border pl-8 pr-8 text-foreground placeholder:text-foreground/30 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/20"
          style={{ ...t.input, backgroundColor: "hsl(var(--input-background))" }}
        />
        {search && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground cursor-pointer transition-colors"
            onClick={() => setSearch("")}
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {visible.length === 0 ? (
        <div className="py-3 text-center" style={t.hint}>
          No matches
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map((opt) => (
            <Pill
              key={opt}
              label={opt}
              isSelected={selected.includes(opt)}
              onClick={() => onToggle(opt)}
            />
          ))}
          {hiddenCount > 0 && (
            <span className="inline-flex items-center h-[30px] px-1" style={t.hint}>
              +{hiddenCount} more — type to search
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Filters button (renders in a toolbar) ─────────────────── */

export function PlannerTxFiltersTrigger({
  activeCount,
  onClick,
  open,
}: {
  activeCount: number;
  onClick: () => void;
  open?: boolean;
}) {
  const active = activeCount > 0 || !!open;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center h-7 gap-1 px-2 rounded-lg border shadow-sm text-[11.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 2xl:h-9 2xl:gap-2 2xl:px-3 2xl:text-[12.5px]"
      style={{
        ...t.btn,
        borderColor: active ? "hsl(var(--primary))" : "hsl(var(--border))",
        backgroundColor: active ? "hsl(var(--primary-tint))" : "hsl(var(--card))",
        color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
      }}
      title="Filters"
    >
      <SlidersHorizontal className="size-2.5 2xl:size-3.5" />
      <span className="hidden md:inline">Filters</span>
      {activeCount > 0 && (
        <span
          className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[11px]"
          style={{
            backgroundColor: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            fontWeight: 600,
          }}
        >
          {activeCount}
        </span>
      )}
    </button>
  );
}

/* ─── The modal ─────────────────────────────────────────────── */

export interface PlannerTxFiltersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PlannerTxFilterState;
  onFiltersChange: (f: PlannerTxFilterState) => void;
  /** Party names (Customer/Vendor) present in the current row set. */
  parties: string[];
  /** typeKinds present in the current row set. Falls back to the
   *  full metadata catalogue when omitted / empty. */
  typeKinds?: TxTypeKind[];
  /** Row count after all filters — surfaced on the Apply button so
   *  the buyer sees the impact before committing. */
  filteredCount?: number;
}

export function PlannerTxFiltersModal({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  parties,
  typeKinds,
  filteredCount,
}: PlannerTxFiltersModalProps) {
  /* Draft state — staged locally so Cancel discards changes. */
  const [draft, setDraft] = useState<PlannerTxFilterState>(() => ({ ...filters }));
  const prevOpenRef = React.useRef(open);
  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraft({ ...filters });
    }
    prevOpenRef.current = open;
  }, [open, filters]);

  const toggleType = useCallback((k: TxTypeKind) => {
    setDraft((p) => ({
      ...p,
      typeKinds: p.typeKinds.includes(k)
        ? p.typeKinds.filter((x) => x !== k)
        : [...p.typeKinds, k],
    }));
  }, []);
  const toggleParty = useCallback((v: string) => {
    setDraft((p) => ({
      ...p,
      parties: p.parties.includes(v) ? p.parties.filter((x) => x !== v) : [...p.parties, v],
    }));
  }, []);
  const toggleBand = useCallback((b: TxBand) => {
    setDraft((p) => ({
      ...p,
      bands: p.bands.includes(b) ? p.bands.filter((x) => x !== b) : [...p.bands, b],
    }));
  }, []);

  const resetDraft = useCallback(() => setDraft(EMPTY_TX_FILTERS), []);
  const stagedCount = countTxFilters(draft);

  const applyFilters = useCallback(() => {
    onFiltersChange(draft);
    onOpenChange(false);
  }, [draft, onFiltersChange, onOpenChange]);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) setDraft({ ...filters });
      onOpenChange(v);
    },
    [filters, onOpenChange],
  );

  /* Type options — faceted when the caller passes `typeKinds`,
     otherwise the full catalogue. Parties sorted alphabetically. */
  const typeOptions: TxTypeKind[] = useMemo(() => {
    if (typeKinds && typeKinds.length > 0) return typeKinds;
    return Object.keys(TYPE_KIND_META) as TxTypeKind[];
  }, [typeKinds]);
  const sortedParties = useMemo(
    () => [...parties].filter((p) => p && p.trim()).sort((a, b) => a.localeCompare(b)),
    [parties],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="bg-card fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%] flex flex-col w-full max-w-[calc(100%-2rem)] sm:max-w-[560px] max-h-[85vh] rounded-[var(--radius-lg)] border border-border duration-200 data-[state=open]:animate-modal-enter data-[state=closed]:animate-modal-exit [transform-origin:center_center]"
          style={{ boxShadow: "var(--elevation-lg)", fontFamily: FONT }}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border">
            <DialogPrimitive.Close
              className="flex items-center justify-center size-8 rounded-[var(--radius-sm)] cursor-pointer transition-colors"
              style={{ color: "hsl(var(--muted-foreground))" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--secondary))"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              aria-label="Close"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
            <span style={t.modalTitle}>Filters</span>
            <div className="size-8" />
          </div>

          {/* Scrollable body */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}
          >
            <Section
              title="Transaction type"
              subtitle="Filter by the kind of event driving the row"
            >
              <div className="flex flex-wrap gap-2">
                {typeOptions.map((k) => {
                  const meta = TYPE_KIND_META[k];
                  return (
                    <Pill
                      key={k}
                      label={meta.label}
                      dotColor={meta.dot}
                      isSelected={draft.typeKinds.includes(k)}
                      onClick={() => toggleType(k)}
                    />
                  );
                })}
              </div>
            </Section>

            <Section
              title="Customer / Vendor"
              subtitle="Narrow to specific parties involved in the transactions"
            >
              {sortedParties.length === 0 ? (
                <div className="py-2" style={t.hint}>No parties available in the current view.</div>
              ) : (
                <SearchablePillSelect
                  options={sortedParties}
                  selected={draft.parties}
                  onToggle={toggleParty}
                  placeholder="Search customers or vendors..."
                />
              )}
            </Section>

            <Section
              title="On-hand band"
              subtitle="Filter to rows whose projected on-hand sits in a specific severity band"
              noBorder
            >
              <div className="flex flex-wrap gap-2">
                {/* "Healthy" is not a filter option — filtering by
                    healthy means "show me the rows that aren't
                    problems", which the buyer already gets by not
                    ticking any band. Buyer feedback 2026-07-14. */}
                {(Object.keys(BAND_META) as TxBand[])
                  .filter((b) => b !== "healthy")
                  .map((b) => (
                    <Pill
                      key={b}
                      label={BAND_META[b].label}
                      dotColor={BAND_META[b].dot}
                      isSelected={draft.bands.includes(b)}
                      onClick={() => toggleBand(b)}
                    />
                  ))}
              </div>
            </Section>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-3 border-t border-border">
            <button
              type="button"
              onClick={resetDraft}
              disabled={stagedCount === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] transition-colors"
              style={{
                ...t.btn,
                color: stagedCount === 0 ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))",
                opacity: stagedCount === 0 ? 0.5 : 1,
                cursor: stagedCount === 0 ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (stagedCount > 0) e.currentTarget.style.backgroundColor = "hsl(var(--secondary))";
              }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              Reset
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="inline-flex items-center h-9 px-3 rounded-[var(--radius-md)] border border-border transition-colors cursor-pointer"
                style={{ ...t.btn, backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--secondary))"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--card))"; }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="inline-flex items-center h-9 px-4 rounded-[var(--radius-md)] transition-colors cursor-pointer"
                style={{
                  ...t.btn,
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              >
                {filteredCount != null
                  ? `Apply · ${filteredCount} ${filteredCount === 1 ? "row" : "rows"}`
                  : "Apply filters"}
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
