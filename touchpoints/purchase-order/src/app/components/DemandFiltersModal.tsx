/* ═══════════════════════════════════════════════════════════════
   DEMAND FILTERS MODAL
   Centered dialog with section blocks matching the design used on
   the Purchase Orders table's POFiltersModal. Each filter group
   becomes a Section with title + subtitle + pill chips. Changes
   are staged in a draft until "Apply Filters" is pressed.

   The modal is data-driven so it can be reused by every Demands
   table (All Demand, Sales Orders, Purchase Requests, Low Stock,
   Stale POs). Each consumer passes a `groups` array describing
   which filters to render and how.
   ═══════════════════════════════════════════════════════════════ */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Dialog, DialogOverlay, DialogPortal } from "./ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "./ui/button";
import { FONT } from "./designTokens";

/* ─────────────────────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────────────────────── */

/** A single option inside a filter group. */
export interface DemandFilterOption {
  value: string;
  label: string;
  count?: number;
  /** Optional coloured dot rendered before the label (matches PO Status pills). */
  dotColor?: string;
}

/**
 * A filter group rendered inside the modal.
 *
 * - `single` (default): one option active at a time. The "value" prop is a string.
 *   The first option with value === "all" (or similar) is considered the "clear" choice.
 * - `multi`: multiple options active. The "value" prop is a string[] and `onChange`
 *   receives a string[].
 */
export interface DemandFilterModalGroup {
  key: string;
  title: string;
  subtitle?: string;
  /** Whether this group accepts multiple simultaneous selections. */
  multi?: boolean;
  /** Show a search input above the pills when the option count exceeds this number. */
  searchAfter?: number;
  options: DemandFilterOption[];
  /** Current value — string for single-select, string[] for multi-select. */
  value: string | string[];
  /** When single-select, the value to send when clearing (defaults to "all"). */
  clearValue?: string;
}

interface DemandFiltersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Title shown at the top of the modal (defaults to "Filters"). */
  title?: string;
  groups: DemandFilterModalGroup[];
  /**
   * Called when Apply Filters is pressed.
   * The map is keyed by group.key. Values match each group's value shape.
   */
  onApply: (next: Record<string, string | string[]>) => void;
}

/* ─────────────────────────────────────────────────────────────────
   TYPOGRAPHY — mirrors POFiltersModal tokens
   ───────────────────────────────────────────────────────────────── */

const t = {
  modalTitle: {
    fontSize: "var(--text-h4)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "28px",
    fontFamily: FONT,
    color: "hsl(var(--foreground))",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
    color: "hsl(var(--foreground))",
  } as React.CSSProperties,
  sectionSub: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
    color: "hsl(var(--muted-foreground))",
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
  moreHint: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
    color: "hsl(var(--muted-foreground))",
  } as React.CSSProperties,
  footerBtn: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ─────────────────────────────────────────────────────────────────
   COUNT — each group that has any non-default selection counts as 1
   ───────────────────────────────────────────────────────────────── */

function isGroupActive(group: DemandFilterModalGroup, draft: string | string[]): boolean {
  if (group.multi) {
    return Array.isArray(draft) && draft.length > 0;
  }
  const clear = group.clearValue || "all";
  return typeof draft === "string" && draft !== clear;
}

/** Visible-active count across all groups. */
export function countModalFilters(
  groups: DemandFilterModalGroup[],
  drafts?: Record<string, string | string[]>,
): number {
  let total = 0;
  for (const g of groups) {
    const draft = drafts?.[g.key] ?? g.value;
    if (isGroupActive(g, draft)) total += 1;
  }
  return total;
}

/* ─────────────────────────────────────────────────────────────────
   SECTION WRAPPER — title + subtitle + body, hairline bottom border
   ───────────────────────────────────────────────────────────────── */

function Section({
  title,
  subtitle,
  noBorder,
  children,
}: {
  title: string;
  subtitle?: string;
  noBorder?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="py-5"
      style={{
        borderBottom: noBorder ? "none" : "1px solid hsl(var(--border))",
        paddingLeft: "20px",
        paddingRight: "20px",
      }}
    >
      <div className="mb-3">
        <div style={t.sectionTitle}>{title}</div>
        {subtitle && (
          <div className="mt-0.5" style={t.sectionSub}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   PILL CHIP — toggle on click. Selected = primary tint fill.
   Matches POFiltersModal StatusPill 1:1.
   ───────────────────────────────────────────────────────────────── */

function FilterPill({
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
      type="button"
      className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-full border transition-all cursor-pointer"
      style={{
        ...t.pill,
        backgroundColor: isSelected ? "hsl(var(--primary-tint))" : "hsl(var(--card))",
        borderColor: isSelected ? "hsl(var(--primary))" : "hsl(var(--border))",
        color: isSelected ? "hsl(var(--primary))" : "hsl(var(--foreground))",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = "hsl(var(--secondary))";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isSelected ? "hsl(var(--primary-tint))" : "hsl(var(--card))";
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
            color: isSelected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────
   GROUP BODY — renders pills (with optional inline search) per group
   ───────────────────────────────────────────────────────────────── */

const PILL_VISIBLE_LIMIT = 6;

function FilterGroupBody({
  group,
  draft,
  onToggle,
  onSet,
}: {
  group: DemandFilterModalGroup;
  draft: string | string[];
  onToggle: (val: string) => void;
  onSet: (val: string) => void;
}) {
  const [search, setSearch] = useState("");
  const showSearch =
    typeof group.searchAfter === "number"
      ? group.options.length > group.searchAfter
      : group.options.length > 8;
  const isSearching = search.trim().length > 0;

  /* Filter by search query (multi-select & single both support search). */
  const filtered = useMemo(() => {
    if (!isSearching) return group.options;
    const q = search.toLowerCase();
    return group.options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [group.options, search, isSearching]);

  /* Sort: selected first, then keep declared order. */
  const sorted = useMemo(() => {
    const isSelected = (val: string) =>
      group.multi && Array.isArray(draft) ? draft.includes(val) : draft === val;
    const sel = filtered.filter((o) => isSelected(o.value));
    const rest = filtered.filter((o) => !isSelected(o.value));
    return [...sel, ...rest];
  }, [filtered, draft, group.multi]);

  /* When NOT searching and search bar is enabled, cap visible pills. */
  const useCap = showSearch && !isSearching;
  const visible = useCap ? sorted.slice(0, PILL_VISIBLE_LIMIT) : sorted;
  const hiddenCount = useCap ? Math.max(0, sorted.length - PILL_VISIBLE_LIMIT) : 0;

  return (
    <div>
      {showSearch && (
        <div className="relative mb-3">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
            style={{ color: "hsl(var(--muted-foreground))" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${group.title.toLowerCase()}...`}
            className="h-10 w-full rounded-[var(--radius)] border border-border pl-9 pr-9 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/20"
            style={{
              ...t.searchInput,
              backgroundColor: "hsl(var(--input-background))",
              color: "hsl(var(--foreground))",
            }}
          />
          {search && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer transition-colors"
              style={{ color: "hsl(var(--muted-foreground))" }}
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {visible.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {visible.map((opt) => {
            const isSelected =
              group.multi && Array.isArray(draft)
                ? draft.includes(opt.value)
                : draft === opt.value;
            return (
              <FilterPill
                key={opt.value}
                label={opt.label}
                isSelected={isSelected}
                count={opt.count}
                dotColor={opt.dotColor}
                onClick={() => {
                  if (group.multi) onToggle(opt.value);
                  else onSet(opt.value);
                }}
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
        <div
          className="py-2"
          style={{ ...t.moreHint, color: "hsl(var(--muted-foreground))" }}
        >
          {isSearching ? "No results found" : "No options available"}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN MODAL
   ───────────────────────────────────────────────────────────────── */

export default function DemandFiltersModal({
  open,
  onOpenChange,
  title = "Filters",
  groups,
  onApply,
}: DemandFiltersModalProps) {
  /* Build draft from groups' current values. */
  const buildInitialDraft = useCallback((): Record<string, string | string[]> => {
    const d: Record<string, string | string[]> = {};
    for (const g of groups) {
      d[g.key] = Array.isArray(g.value) ? [...g.value] : g.value;
    }
    return d;
  }, [groups]);

  const [draft, setDraft] = useState<Record<string, string | string[]>>(buildInitialDraft);

  /* Reset draft each time the modal opens, to match the applied values. */
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraft(buildInitialDraft());
    }
    prevOpenRef.current = open;
  }, [open, buildInitialDraft]);

  /* Handlers — operate on draft only. */
  const toggleMulti = useCallback((key: string, val: string) => {
    setDraft((prev) => {
      const arr = (prev[key] as string[]) || [];
      const next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
      return { ...prev, [key]: next };
    });
  }, []);

  const setSingle = useCallback((key: string, val: string) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }, []);

  const resetDraft = useCallback(() => {
    const cleared: Record<string, string | string[]> = {};
    for (const g of groups) {
      cleared[g.key] = g.multi ? [] : g.clearValue || "all";
    }
    setDraft(cleared);
  }, [groups]);

  const stagedCount = countModalFilters(groups, draft);

  const applyFilters = useCallback(() => {
    onApply(draft);
    onOpenChange(false);
  }, [draft, onApply, onOpenChange]);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) {
        /* Discard draft on close without apply. */
        setDraft(buildInitialDraft());
      }
      onOpenChange(v);
    },
    [buildInitialDraft, onOpenChange],
  );

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
              style={{ color: "hsl(var(--muted-foreground))" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "hsl(var(--secondary))";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              aria-label="Close"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
            <span style={t.modalTitle}>{title}</span>
            <div className="size-8" />
          </div>

          {/* ── BODY ── */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}
          >
            {groups.map((group, idx) => (
              <Section
                key={group.key}
                title={group.title}
                subtitle={group.subtitle}
                noBorder={idx === groups.length - 1}
              >
                <FilterGroupBody
                  group={group}
                  draft={draft[group.key]}
                  onToggle={(val) => toggleMulti(group.key, val)}
                  onSet={(val) => setSingle(group.key, val)}
                />
              </Section>
            ))}
          </div>

          {/* ── FOOTER ── */}
          <div
            className="shrink-0 flex items-center justify-between py-4 border-t border-border"
            style={{ backgroundColor: "hsl(var(--card))", paddingLeft: "20px", paddingRight: "20px" }}
          >
            <button
              type="button"
              className="inline-flex items-center cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default"
              style={{
                ...t.footerBtn,
                color: stagedCount > 0 ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                background: "none",
                border: "none",
                padding: 0,
                textDecoration: "underline",
                textUnderlineOffset: "3px",
                textDecorationColor: "hsl(var(--border))",
              }}
              onClick={resetDraft}
              disabled={stagedCount === 0}
              onMouseEnter={(e) => {
                if (stagedCount > 0) {
                  e.currentTarget.style.textDecorationColor = "hsl(var(--foreground))";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecorationColor = "hsl(var(--border))";
              }}
            >
              Reset
            </button>

            <div className="flex items-center gap-3">
              {stagedCount > 0 && (
                <span
                  style={{
                    ...t.footerBtn,
                    color: "hsl(var(--muted-foreground))",
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
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
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
