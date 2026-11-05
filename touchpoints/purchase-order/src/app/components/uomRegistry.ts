/* ═══════════════════════════════════════════════════════════════
   Global UOM (Unit of Measure) Registry
   ─────────────────────────────────────────────────────────────
   Single source of truth for unit conversions across the app.
   Every unit declares a `dimension` (count / volume / weight / length /
   area) and a numeric `conversionFactor` to a canonical `baseUnit`
   within that dimension. Conversions between two units in the same
   dimension are derived from their factors; cross-dimension conversion
   is not allowed (returns null).

   The registry replaces hardcoded UOM arrays that previously lived in
   `OrderFlow.tsx` (PRICE_UOM_OPTIONS, UOM_OPTIONS) and `catalogData.ts`
   (vendorUOMs, defaultUOMs). The selectors that consume it filter
   compatible picks based on the stocking item's primary UOM — so a
   Gallon-stocked oil item only sees volume units (Drum, Tote, Liter,
   etc.) instead of count units (Box, Case).
   ═══════════════════════════════════════════════════════════════ */

export type UOMDimension = "count" | "volume" | "weight" | "length" | "area";

export interface UOMDefinition {
  /** Canonical name shown in dropdowns. Case-sensitive. */
  name: string;
  /** Family the unit belongs to — drives compatibility filtering. */
  dimension: UOMDimension;
  /** Canonical unit for this dimension. One per dimension. */
  baseUnit: string;
  /** How many `baseUnit`s in 1 of `name`. The baseUnit itself has 1. */
  conversionFactor: number;
  /** Optional aliases for typeahead search ("ea" matches "Each"). */
  aliases?: string[];
}

/**
 * Global registry. Hand-curated for v1.
 * Adding new units is currently a code change — admin-driven mutation
 * is out of scope (see plan).
 */
export const UOM_REGISTRY: UOMDefinition[] = [
  /* ── count (base: Each) ── */
  { name: "Each",    dimension: "count", baseUnit: "Each", conversionFactor: 1,   aliases: ["ea", "piece", "unit", "pc"] },
  { name: "Piece",   dimension: "count", baseUnit: "Each", conversionFactor: 1,   aliases: ["pc"] },
  { name: "Unit",    dimension: "count", baseUnit: "Each", conversionFactor: 1 },
  { name: "Pair",    dimension: "count", baseUnit: "Each", conversionFactor: 2 },
  { name: "Pack",    dimension: "count", baseUnit: "Each", conversionFactor: 4 },
  { name: "Box",     dimension: "count", baseUnit: "Each", conversionFactor: 6 },
  { name: "Set",     dimension: "count", baseUnit: "Each", conversionFactor: 6 },
  { name: "Kit",     dimension: "count", baseUnit: "Each", conversionFactor: 10 },
  { name: "Case",    dimension: "count", baseUnit: "Each", conversionFactor: 12 },
  { name: "Dozen",   dimension: "count", baseUnit: "Each", conversionFactor: 12,  aliases: ["doz"] },
  { name: "Bundle",  dimension: "count", baseUnit: "Each", conversionFactor: 12 },
  { name: "Carton",  dimension: "count", baseUnit: "Each", conversionFactor: 24 },
  { name: "Pallet",  dimension: "count", baseUnit: "Each", conversionFactor: 48 },
  { name: "Bag",     dimension: "count", baseUnit: "Each", conversionFactor: 50 },
  { name: "Module",  dimension: "count", baseUnit: "Each", conversionFactor: 1 },
  { name: "Assembly", dimension: "count", baseUnit: "Each", conversionFactor: 1 },
  { name: "Sub-Assembly", dimension: "count", baseUnit: "Each", conversionFactor: 1 },
  { name: "Element", dimension: "count", baseUnit: "Each", conversionFactor: 1 },
  { name: "Valve",   dimension: "count", baseUnit: "Each", conversionFactor: 1 },
  { name: "Spool",   dimension: "count", baseUnit: "Each", conversionFactor: 1 },
  { name: "Sheet",   dimension: "count", baseUnit: "Each", conversionFactor: 1 },

  /* ── volume (base: Gallon) ── */
  { name: "Gallon",  dimension: "volume", baseUnit: "Gallon", conversionFactor: 1,        aliases: ["gal"] },
  { name: "Quart",   dimension: "volume", baseUnit: "Gallon", conversionFactor: 0.25,     aliases: ["qt"] },
  { name: "Pint",    dimension: "volume", baseUnit: "Gallon", conversionFactor: 0.125,    aliases: ["pt"] },
  { name: "Liter",   dimension: "volume", baseUnit: "Gallon", conversionFactor: 0.264172, aliases: ["l", "ltr"] },
  { name: "Milliliter", dimension: "volume", baseUnit: "Gallon", conversionFactor: 0.000264172, aliases: ["ml"] },
  { name: "Drum",    dimension: "volume", baseUnit: "Gallon", conversionFactor: 55 },
  { name: "Barrel",  dimension: "volume", baseUnit: "Gallon", conversionFactor: 42,       aliases: ["bbl"] },
  { name: "Tote",    dimension: "volume", baseUnit: "Gallon", conversionFactor: 275 },
  { name: "Pail",    dimension: "volume", baseUnit: "Gallon", conversionFactor: 5 },

  /* ── weight (base: Pound) ── */
  { name: "Pound",     dimension: "weight", baseUnit: "Pound", conversionFactor: 1,        aliases: ["lb", "lbs"] },
  { name: "Ounce",     dimension: "weight", baseUnit: "Pound", conversionFactor: 0.0625,   aliases: ["oz"] },
  { name: "Gram",      dimension: "weight", baseUnit: "Pound", conversionFactor: 0.00220462, aliases: ["g"] },
  { name: "Kilogram",  dimension: "weight", baseUnit: "Pound", conversionFactor: 2.20462,  aliases: ["kg"] },
  { name: "Ton",       dimension: "weight", baseUnit: "Pound", conversionFactor: 2000 },

  /* ── length (base: Foot) ── */
  { name: "Foot",      dimension: "length", baseUnit: "Foot", conversionFactor: 1,        aliases: ["ft"] },
  { name: "Inch",      dimension: "length", baseUnit: "Foot", conversionFactor: 0.08333,  aliases: ["in"] },
  { name: "Yard",      dimension: "length", baseUnit: "Foot", conversionFactor: 3,        aliases: ["yd"] },
  { name: "Centimeter",dimension: "length", baseUnit: "Foot", conversionFactor: 0.0328084,aliases: ["cm"] },
  { name: "Meter",     dimension: "length", baseUnit: "Foot", conversionFactor: 3.28084,  aliases: ["m"] },
  { name: "Roll",      dimension: "length", baseUnit: "Foot", conversionFactor: 100 },
  { name: "Reel",      dimension: "length", baseUnit: "Foot", conversionFactor: 500 },

  /* ── area (base: Square Foot) ── */
  { name: "Square Foot",  dimension: "area", baseUnit: "Square Foot", conversionFactor: 1,        aliases: ["sqft", "ft2"] },
  { name: "Square Inch",  dimension: "area", baseUnit: "Square Foot", conversionFactor: 0.00694,  aliases: ["sqin", "in2"] },
  { name: "Square Yard",  dimension: "area", baseUnit: "Square Foot", conversionFactor: 9,        aliases: ["sqyd", "yd2"] },
  { name: "Square Meter", dimension: "area", baseUnit: "Square Foot", conversionFactor: 10.7639,  aliases: ["sqm", "m2"] },
];

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ─────────────────────────────────────────────────────────────
   All lookups are name-based and case-insensitive so the registry
   tolerates legacy data that capitalizes inconsistently.
   ═══════════════════════════════════════════════════════════════ */

const norm = (s: string) => s.trim().toLowerCase();

/** Find a registry entry by canonical name OR alias. */
export function findUOM(name: string | undefined | null): UOMDefinition | undefined {
  if (!name) return undefined;
  const target = norm(name);
  return UOM_REGISTRY.find(
    (u) => norm(u.name) === target || (u.aliases || []).some((a) => norm(a) === target),
  );
}

/** Dimension of a unit by name. Returns undefined for unknown units. */
export function getDimension(name: string | undefined | null): UOMDimension | undefined {
  return findUOM(name)?.dimension;
}

/**
 * All units that share a dimension with the given reference unit.
 * Sorted by `conversionFactor` ascending so smaller units come first
 * (which matches how tier ladders are presented in MultiUnitPriceTable).
 *
 * If the reference unit is unknown to the registry, returns an empty
 * array — callers should fall back to the full registry in that case.
 */
export function getCompatibleUOMs(referenceUnit: string | undefined | null): UOMDefinition[] {
  const ref = findUOM(referenceUnit);
  if (!ref) return [];
  return UOM_REGISTRY
    .filter((u) => u.dimension === ref.dimension)
    .sort((a, b) => a.conversionFactor - b.conversionFactor);
}

/**
 * Convert a quantity from one unit to another.
 *  - Returns null if either unit is unknown.
 *  - Returns null if the two units belong to different dimensions
 *    (cross-dimension conversion is not allowed).
 *  - Returns the same qty if `from` and `to` resolve to the same entry.
 */
export function convertQty(from: string, to: string, qty: number): number | null {
  const a = findUOM(from);
  const b = findUOM(to);
  if (!a || !b) return null;
  if (a.dimension !== b.dimension) return null;
  if (!Number.isFinite(qty)) return null;
  // qty in base = qty * a.conversionFactor
  // qty in b    = (qty in base) / b.conversionFactor
  return (qty * a.conversionFactor) / b.conversionFactor;
}

/**
 * Convenience: the conversion factor for `unit` against the dimension's
 * base unit. Falls back to 1 for unknown units so callers that compute
 * "× N <baseUnit>" hints degrade gracefully.
 */
export function conversionFactorOf(unit: string | undefined | null): number {
  return findUOM(unit)?.conversionFactor ?? 1;
}

/**
 * Convenience: the base unit name for a given unit (e.g. "Drum" → "Gallon").
 * Returns the input string unchanged if the unit is unknown so legacy
 * data still renders without throwing.
 */
export function baseUnitOf(unit: string | undefined | null): string {
  return findUOM(unit)?.baseUnit ?? (unit ?? "");
}

/**
 * Group every registry entry by dimension. Used by the searchable
 * picker when no reference unit is provided (the picker shows groups).
 */
export function groupRegistryByDimension(): Record<UOMDimension, UOMDefinition[]> {
  const out: Record<UOMDimension, UOMDefinition[]> = {
    count: [], volume: [], weight: [], length: [], area: [],
  };
  for (const u of UOM_REGISTRY) out[u.dimension].push(u);
  for (const d of Object.keys(out) as UOMDimension[]) {
    out[d].sort((a, b) => a.conversionFactor - b.conversionFactor);
  }
  return out;
}

/** Pretty label for a dimension family — used as section headers. */
export const DIMENSION_LABELS: Record<UOMDimension, string> = {
  count: "Count",
  volume: "Volume",
  weight: "Weight",
  length: "Length",
  area: "Area",
};
