/* ═══════════════════════════════════════════════════════════════
   UnitCombobox — searchable picker over the global UOM_REGISTRY.

   Used everywhere a buyer or vendor-config user picks a unit:
     - MultiUnitPriceTable add-row picker
     - OrderFlow inline price-tier editor (add + edit)
     - OrderFlow line-item quantity UOM picker (qty card)

   Filtering rules:
     - If `itemBaseUnit` is provided, only units in the SAME dimension
       as that unit appear (e.g. a Gallon-stocked item shows volume
       units only — Drum, Liter, Pint, Tote, etc.).
     - If `itemBaseUnit` is omitted, the entire registry appears,
       grouped by dimension.

   Selection rules (per the approved plan):
     - Picks must come from the registry. No free-form entries.
     - Aliases (e.g. "ea" → Each) match via the typeahead but the
       canonical name is committed.

   Visual rules:
     - Closed state mirrors the existing shadcn `<Select>` trigger so
       toolbar visuals don't shift when we swap in this component.
     - Each row shows the conversion hint "× N <baseUnit>" so the
       buyer knows the math at pick-time (e.g. "Drum × 55 Gallon").
   ═══════════════════════════════════════════════════════════════ */

"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "./ui/utils";
import {
  DIMENSION_LABELS,
  UOM_REGISTRY,
  findUOM,
  getCompatibleUOMs,
  groupRegistryByDimension,
  type UOMDefinition,
} from "./uomRegistry";

const FONT = "'PP Object Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

export interface UnitComboboxProps {
  /** Currently selected unit name (canonical, e.g. "Each"). */
  value: string;
  /** Fires when the user picks a different unit. */
  onChange: (next: string) => void;
  /** When provided, the picker is filtered to compatible units (same
   *  dimension as this unit). Pass the item's `defaultUOM` here on
   *  vendor-side pickers so the buyer can only choose physically
   *  meaningful units. */
  itemBaseUnit?: string;
  /** Optional set of unit names (lowercased) to hide — used to filter
   *  out tiers already configured on the active vendor. */
  hideUnits?: Set<string>;
  /** Optional whitelist of unit names — when provided, the picker
   *  restricts to this exact set (intersected with the UOM registry)
   *  and the dimension-based `itemBaseUnit` filter is ignored. Used
   *  by the Items Detail Modal's Vendor Selling Unit picker so the
   *  buyer can only pick from the units the vendor is actually
   *  qualified to sell in. Case-insensitive match. */
  allowedUnits?: string[];
  /** Explicit helper copy rendered under the search input. Overrides
   *  the auto-generated helper text (which only fires when the picker
   *  is dimension-filtered). Callers use this to explain the source
   *  of the visible list — e.g. "Qualified with {vendor}" on the
   *  Items Detail Modal's Vendor Selling Unit picker. */
  helperText?: string;
  /** Optional per-unit badges. Key is the unit name (case-insensitive
   *  — the picker lowercases the lookup). When a row's unit matches,
   *  the badge label renders as a small pill next to the name. Used
   *  by the Items Detail Modal to mark tiers that live only on this
   *  PO ("PO only" chip). */
  unitBadges?: Record<string, string>;
  placeholder?: string;
  disabled?: boolean;
  /** Compact form (h-7 px-2 text-[12px]) — used inside the inline tier
   *  table where vertical space is tight. */
  size?: "default" | "sm";
  /** Visual variant — "input" mimics a form input (used in modals),
   *  "ghost" mimics the in-toolbar Select trigger. */
  variant?: "input" | "ghost";
  className?: string;
}

export function UnitCombobox({
  value,
  onChange,
  itemBaseUnit,
  hideUnits,
  allowedUnits,
  helperText: helperTextOverride,
  unitBadges,
  placeholder = "Choose unit…",
  disabled = false,
  size = "default",
  variant = "input",
  className,
}: UnitComboboxProps) {
  const [open, setOpen] = React.useState(false);

  /* Build the list of options.
       1. `allowedUnits` (highest priority) — explicit whitelist. Used
          when the picker should reflect an out-of-band curated set
          (e.g. the vendor's qualified priced units on the Items Detail
          Modal). Group header reads "Qualified units". When the
          whitelist is provided but resolves to zero registry entries,
          we fall back through to the dimension-based / registry-wide
          behavior so the dropdown is never left empty.
       2. `itemBaseUnit` — restrict to the same dimension.
       3. Neither — the whole registry, grouped by dimension. */
  const grouped = React.useMemo<Array<{ heading: string; items: UOMDefinition[] }>>(() => {
    const filterHidden = (list: UOMDefinition[]) =>
      hideUnits && hideUnits.size > 0
        ? list.filter((u) => !hideUnits.has(u.name.toLowerCase()))
        : list;

    if (allowedUnits && allowedUnits.length > 0) {
      /* Resolve each whitelist entry to its registry definition,
         preferring an exact canonical-name match. `findUOM` also
         matches aliases, so e.g. `findUOM("Piece")` returns the
         `Each` entry (because "piece" is an alias of Each) and the
         real `Piece` entry gets swallowed. That's why we do the
         name-first lookup here — the whitelist is trusted, don't
         let alias resolution rewrite what the vendor priced. */
      const findByNameFirst = (raw: string): UOMDefinition | undefined => {
        const target = raw.trim().toLowerCase();
        const exact = UOM_REGISTRY.find((u) => u.name.toLowerCase() === target);
        if (exact) return exact;
        return findUOM(raw);
      };
      const seen = new Set<string>();
      const deduped: UOMDefinition[] = [];
      for (const raw of allowedUnits) {
        const u = findByNameFirst(raw);
        if (!u) continue;
        const key = u.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(u);
      }
      if (deduped.length > 0) {
        /* Single-group filter case — no group heading. The helper
           copy under the search (see `helperText` below) already
           carries the context. */
        return [{ heading: "", items: filterHidden(deduped) }];
      }
      // Whitelist resolved to nothing — fall through to the older
      // dimension-based / registry-wide behavior below.
    }

    if (itemBaseUnit) {
      const compatible = getCompatibleUOMs(itemBaseUnit);
      if (compatible.length > 0) {
        /* Same treatment — dimension-filtered pickers drop the group
           heading ("Count units" / "Volume units" etc.) in favour of
           the helper text under the search. */
        return [{ heading: "", items: filterHidden(compatible) }];
      }
      // Unknown reference unit — degrade to "show everything" rather
      // than leaving the dropdown empty.
    }

    const groups = groupRegistryByDimension();
    return (Object.keys(groups) as Array<keyof typeof groups>)
      .map((dim) => ({
        heading: DIMENSION_LABELS[dim],
        items: filterHidden(groups[dim]),
      }))
      .filter((g) => g.items.length > 0);
  }, [itemBaseUnit, hideUnits, allowedUnits]);

  /* Resolve the display label. Prefer the registry's canonical name
     (so "ea" stored in legacy data still renders as "Each"). */
  const resolved = findUOM(value);
  const displayLabel = resolved?.name || value || placeholder;
  const showPlaceholder = !value;

  /* Helper copy under the search input — explains WHY the visible list
     is what it is. An explicit `helperText` prop always wins (used e.g.
     to name the qualified vendor on the Items Detail Modal). Otherwise
     the picker auto-generates copy only when dimension-filtered by an
     `itemBaseUnit` (the "Add another unit price" case). */
  /* Lowercase-keyed lookup so callers can pass either the canonical
     name ("Box") or a legacy alias — both resolve. */
  const badgeLookup = React.useMemo<Record<string, string>>(() => {
    if (!unitBadges) return {};
    const out: Record<string, string> = {};
    for (const key of Object.keys(unitBadges)) {
      out[key.trim().toLowerCase()] = unitBadges[key];
    }
    return out;
  }, [unitBadges]);

  const helperText = React.useMemo<string | null>(() => {
    if (helperTextOverride && helperTextOverride.trim().length > 0) {
      return helperTextOverride;
    }
    if (allowedUnits && allowedUnits.length > 0) return null;
    if (!itemBaseUnit) return null;
    const ref = findUOM(itemBaseUnit);
    const baseName = ref?.name || itemBaseUnit;
    return `Alternative units convertible with ${baseName} (base UOM)`;
  }, [itemBaseUnit, allowedUnits, helperTextOverride]);

  const triggerHeight = size === "sm" ? "h-7" : "h-9";
  const triggerPadding = size === "sm" ? "px-2" : "px-3";
  const triggerText = size === "sm" ? "text-[12px]" : "text-[13px]";

  const baseTriggerClass =
    variant === "ghost"
      ? "inline-flex items-center gap-1 w-auto rounded-md hover:bg-[#F8FAFC] cursor-pointer transition-colors"
      : "inline-flex items-center justify-between w-full rounded-[var(--radius)] border border-border bg-[hsl(var(--input-background))] hover:border-foreground/20 cursor-pointer transition-colors";

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(
            baseTriggerClass,
            triggerHeight,
            triggerPadding,
            triggerText,
            "outline-none focus:border-primary focus:ring-1 focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
          style={{ fontFamily: FONT, fontWeight: 500 }}
        >
          <span
            className={cn(
              "truncate",
              showPlaceholder ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {displayLabel}
          </span>
          <ChevronsUpDown
            className={cn(
              "shrink-0 opacity-50",
              size === "sm" ? "w-3 h-3 ml-1" : "w-3.5 h-3.5 ml-2",
            )}
          />
        </button>
      </PopoverTrigger>
      {/* Popover mirrors the Partners FilterDropdown pattern
          (`POFilterBar.tsx:283`): 280px wide, bordered search input at
          the top inside a `px-3 py-2 border-b` shell, options list with
          Partners row tokens (`px-2 py-1.5 rounded-sm`, `bg-primary/5`
          selection wash, `hover:bg-secondary`), and a footer count.
          Responsive width so it never overflows narrow viewports. */}
      <PopoverContent
        className="p-0 w-[min(280px,calc(100vw-24px))] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/80"
        align="start"
        style={{ fontFamily: FONT, zIndex: 250 }}
      >
        <UnitPickerBody
          items={grouped}
          helperText={helperText}
          selectedName={resolved?.name || value}
          badgeLookup={badgeLookup}
          onPick={(name) => {
            onChange(name);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Render conversion factor without trailing zeros: 0.264172 → "0.264", 55 → "55". */
function formatFactor(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

/* ═══════════════════════════════════════════════════════════════
   UnitPickerBody — Partners-style popover contents.

   Split from the trigger so the search + list layout stays isolated
   from the button chrome, and the search state stays local to the
   open popover (resets naturally on close/re-open when React unmounts
   the body via Radix's Popover portal).
   ═══════════════════════════════════════════════════════════════ */

interface UnitPickerBodyProps {
  items: Array<{ heading: string; items: UOMDefinition[] }>;
  helperText: string | null;
  selectedName: string;
  badgeLookup: Record<string, string>;
  onPick: (name: string) => void;
}

function UnitPickerBody({
  items,
  helperText,
  selectedName,
  badgeLookup,
  onPick,
}: UnitPickerBodyProps) {
  const [search, setSearch] = React.useState("");

  /* Flat, alias-aware filter — same behavior the original Command
     component provided but implemented directly so we control the row
     rendering (no `[cmdk-*]` selectors to fight). Matches on canonical
     name, aliases, and base-unit name. */
  const filteredGroups = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items
      .map((g) => ({
        heading: g.heading,
        items: g.items.filter((u) => {
          if (u.name.toLowerCase().includes(needle)) return true;
          if ((u.aliases || []).some((a) => a.toLowerCase().includes(needle))) return true;
          if (u.baseUnit.toLowerCase().includes(needle)) return true;
          return false;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [items, search]);

  const totalVisible = filteredGroups.reduce((n, g) => n + g.items.length, 0);
  const totalAll = items.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      {/* Search bar in a bordered box — Partners style. */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-foreground/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search units..."
            autoFocus
            className="h-7 w-full rounded-[var(--radius-sm)] border border-border pl-7 pr-7 text-foreground placeholder:text-foreground/30 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/20"
            style={{
              fontSize: 12,
              fontWeight: 400,
              lineHeight: "16px",
              fontFamily: FONT,
              backgroundColor: "hsl(var(--input-background))",
            }}
          />
          {search && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground cursor-pointer transition-colors"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Helper copy — explains the source of the visible list. */}
      {helperText && (
        <div
          className="px-3 py-1.5 text-[10.5px] leading-snug text-muted-foreground border-b border-border/40"
          style={{ fontWeight: 500 }}
        >
          {helperText}
        </div>
      )}

      {/* Options list — scrollable, Partners row tokens. */}
      <div className="max-h-[240px] overflow-y-auto py-1 px-1">
        {totalVisible === 0 ? (
          <div className="py-4 text-center text-foreground/35" style={{ fontSize: 12, fontFamily: FONT }}>
            No matching units.
          </div>
        ) : (
          filteredGroups.map((group, gi) => (
            <React.Fragment key={group.heading || `group-${gi}`}>
              {group.heading && (
                <div
                  className="px-3 py-1 uppercase tracking-wide text-foreground/40"
                  style={{ fontSize: 10, fontWeight: 600, lineHeight: "14px", letterSpacing: "0.05em", fontFamily: FONT }}
                >
                  {group.heading}
                </div>
              )}
              {group.items.map((u) => {
                const isSelected = u.name.toLowerCase() === selectedName.toLowerCase();
                const hint =
                  u.conversionFactor === 1
                    ? `base ${u.baseUnit}`
                    : `× ${formatFactor(u.conversionFactor)} ${u.baseUnit}`;
                const badge = badgeLookup[u.name.toLowerCase()];
                return (
                  <button
                    key={u.name}
                    type="button"
                    onClick={() => onPick(u.name)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer text-left",
                      isSelected ? "bg-primary/5" : "hover:bg-secondary",
                    )}
                  >
                    <Check
                      className={cn(
                        "w-3.5 h-3.5 shrink-0",
                        isSelected ? "opacity-100 text-primary" : "opacity-0",
                      )}
                    />
                    <span className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span
                        className="text-foreground truncate"
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? 500 : 400,
                          lineHeight: "18px",
                          fontFamily: FONT,
                        }}
                      >
                        {u.name}
                      </span>
                      {badge && (
                        <span
                          className="inline-flex items-center px-1.5 rounded shrink-0"
                          style={{
                            background: "#FEF3C7",
                            color: "#92400E",
                            fontSize: 9,
                            fontWeight: 600,
                            lineHeight: "13px",
                            letterSpacing: "0.02em",
                          }}
                          title="This tier is applied to the current PO only. The qualified vendor's master price book is unchanged."
                        >
                          {badge}
                        </span>
                      )}
                    </span>
                    <span
                      className="ml-1 shrink-0 text-foreground/40"
                      style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT }}
                    >
                      {hint}
                    </span>
                  </button>
                );
              })}
            </React.Fragment>
          ))
        )}
      </div>

      {/* Footer count — Partners uses "N of M selected"; we show
          available unit count since this picker is single-select. */}
      {totalAll > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <span
            className="text-foreground/40"
            style={{ fontSize: 10, fontWeight: 600, lineHeight: "14px", fontFamily: FONT }}
          >
            {search
              ? `${totalVisible} of ${totalAll} unit${totalAll === 1 ? "" : "s"}`
              : `${totalAll} unit${totalAll === 1 ? "" : "s"} available`}
          </span>
        </div>
      )}
    </>
  );
}

/* Backwards-compat default export so callers can `import UnitCombobox from "./UnitCombobox"`. */
export default UnitCombobox;
