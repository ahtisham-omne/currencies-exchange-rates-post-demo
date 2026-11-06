/* ═══════════════════════════════════════════════════════════════════════════
 *  Unit-of-Measure data layer — Quote module
 *  Single source of truth for every UoM list, primary lookup, and within-set
 *  multiplier in the Quote module. The catalog used to render one universal
 *  list (EA/Box/Carton/Pallet) for every product; this file replaces that
 *  with per-product sets so liquid components surface Liter/Gallon/Drum,
 *  cable/wire components surface Foot/Yard/Roll, and the rest stay on the
 *  discrete EA/Box/Carton/Pallet ladder.
 *
 *  Mirrored verbatim in `Sales-Order-V5/src/app/data/uomSets.ts`. The
 *  duplication is intentional — both modules live in separate src trees
 *  and can't share a file.
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface UomOption {
  /** Stable identifier (lowercase). Used in line-item `uom` storage. */
  id: string;
  /** Short label rendered in capsule chrome (4–6 char ceiling). */
  name: string;
  /** Long label rendered as the dropdown sub-line, with the unit
   *  conversion in parentheses when applicable. */
  fullName: string;
  /** Base-unit multiplier *within this set*. Only ever applied when
   *  converting between two UoMs of the same set — cross-set
   *  conversions are not allowed. */
  multiplier: number;
}

export type UomSetId = 'discrete' | 'liquid' | 'length';

/* ─── The three canonical sets ─────────────────────────────────────
   Each set's first entry is the set's primary (Partner Management
   pattern: every catalog item has one preferred UoM that surfaces as
   a "Primary" pill in the dropdown). */

export const UOM_SETS: Record<UomSetId, UomOption[]> = {
  discrete: [
    { id: 'ea',     name: 'EA',     fullName: 'Each',                 multiplier: 1 },
    { id: 'box',    name: 'Box',    fullName: 'Box (12 units)',       multiplier: 12 },
    { id: 'carton', name: 'Carton', fullName: 'Carton (24 units)',    multiplier: 24 },
    { id: 'pallet', name: 'Pallet', fullName: 'Pallet (480 units)',   multiplier: 480 },
  ],
  liquid: [
    { id: 'liter',  name: 'Liter',  fullName: 'Liter',                multiplier: 1 },
    { id: 'gallon', name: 'Gallon', fullName: 'Gallon (3.79 L)',      multiplier: 3.785 },
    { id: 'drum',   name: 'Drum',   fullName: 'Drum (208 L)',         multiplier: 208 },
  ],
  length: [
    { id: 'foot',   name: 'Foot',   fullName: 'Foot',                 multiplier: 1 },
    { id: 'yard',   name: 'Yard',   fullName: 'Yard (3 ft)',          multiplier: 3 },
    { id: 'roll',   name: 'Roll',   fullName: 'Roll (500 ft)',        multiplier: 500 },
  ],
};

export const PRIMARY_UOM_BY_SET: Record<UomSetId, string> = {
  discrete: 'ea',
  liquid:   'liter',
  length:   'foot',
};

/* ─── Per-product set resolution ──────────────────────────────────
   The earlier broad name-pattern heuristic (matching `paint`, `cable`,
   `wire`, `coolant`, etc.) caught service descriptions and component
   kits whose names happened to include a liquid/length word — e.g.
   "Complete body preparation, prime, paint, and graphics installation
   labor package" is a SERVICE, not a paint can. The user reported
   solid items being sold with liquid UoMs because of this.

   New rule: a product is liquid/length ONLY when its name spells out
   a container or spool measurement (e.g. "5 Gallon", "Drum", "Quart",
   "Spool of", "Roll of"). Services, kits and components stay
   discrete unless they are literally packaged in a liquid container
   or a length spool. */
const LIQUID_NAME_PATTERNS = [
  /\b\d+(?:\.\d+)?\s*-?\s*gallon\b/i,   // "5 Gallon", "55-Gallon", "2.5 Gallon"
  /\bgallon\s+(jug|pail|drum|bottle|can)\b/i,
  /\bquart\s+(bottle|can|jug)\b/i,
  /\bdrum\s+(of|—)|^drum\b/i,
  /\bliter\s+(bottle|jug|drum)\b/i,
  /\b\d+(?:\.\d+)?\s*-?\s*l(?:iter)?\s+(bottle|jug|drum)\b/i,
];
const LENGTH_NAME_PATTERNS = [
  /\bspool\s+(of|—)|^spool\b/i,
  /\b\d+\s*ft\b\s*-?\s*(spool|roll)\b/i,
  /\broll\s+(of|—)|^roll\b/i,
];

/* Explicit allowlist by product code — the heuristic above stays
   conservative on purpose so it doesn't misclassify, and any product
   that needs a non-discrete set despite an ambiguous name can be
   pinned here. Add SKUs as they're identified, e.g.
   `'000-100-220': 'liquid'`. */
const SET_OVERRIDE_BY_CODE: Record<string, UomSetId> = {
  // (intentionally empty by default — populate per real catalog data)
};

export function getUomSetIdForProduct(p: { id: string; name: string; category?: string }): UomSetId {
  const override = SET_OVERRIDE_BY_CODE[p.id];
  if (override) return override;
  for (const pat of LIQUID_NAME_PATTERNS) if (pat.test(p.name)) return 'liquid';
  for (const pat of LENGTH_NAME_PATTERNS) if (pat.test(p.name)) return 'length';
  return 'discrete';
}

export function getUomSetForProduct(p: { id: string; name: string; category?: string }): UomOption[] {
  return UOM_SETS[getUomSetIdForProduct(p)];
}

/* Per-product PRIMARY UoM — deterministically derived from the
   product's id/code so each product carries a stable preferred unit
   that may not be the set's first entry. A discrete chassis can have
   primary = Box even though the set starts at EA, giving the catalog
   real variety instead of every discrete SKU defaulting to EA.

   Distribution: 50% set[0] (true set primary), 30% set[1], 15% set[2],
   5% set[3]. Liquid + length items skew heavier toward set[0] because
   those sets are smaller. */
export function getPrimaryUomForProduct(p: { id: string; name: string; category?: string }): string {
  const setId = getUomSetIdForProduct(p);
  const set = UOM_SETS[setId];
  const key = (p.id || p.name || '').toString();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const r = Math.abs(h % 100);
  if (r < 50) return set[0].id;
  if (r < 80) return set[Math.min(1, set.length - 1)].id;
  if (r < 95) return set[Math.min(2, set.length - 1)].id;
  return set[Math.min(3, set.length - 1)].id;
}

/* Set-level primary — still useful when the consumer wants the
   canonical first entry (Liter for liquid, Foot for length, EA for
   discrete) regardless of which product is in play. */
export function getSetPrimaryUom(p: { id?: string; name?: string; category?: string }): string {
  return PRIMARY_UOM_BY_SET[getUomSetIdForProduct(p as any)];
}

/* ─── Set + id lookups ────────────────────────────────────────────
   `findUomById` searches every set; useful when the line item only
   stores a `uom` string and the renderer needs the full option.
   `multiplierWithinSet` does the conversion math safely — if either
   uom is missing from the set (shouldn't happen, but guards against
   stale seed data), it returns 1. */

export function findUomById(uomId: string | undefined): UomOption | undefined {
  if (!uomId) return undefined;
  const needle = uomId.toLowerCase();
  for (const setId of Object.keys(UOM_SETS) as UomSetId[]) {
    const hit = UOM_SETS[setId].find((u) => u.id === needle || u.name.toLowerCase() === needle);
    if (hit) return hit;
  }
  return undefined;
}

export function findSetContainingUom(uomId: string | undefined): UomSetId | undefined {
  if (!uomId) return undefined;
  const needle = uomId.toLowerCase();
  for (const setId of Object.keys(UOM_SETS) as UomSetId[]) {
    if (UOM_SETS[setId].some((u) => u.id === needle || u.name.toLowerCase() === needle)) {
      return setId;
    }
  }
  return undefined;
}

export function multiplierWithinSet(uomId: string | undefined, set: UomOption[]): number {
  if (!uomId) return 1;
  const needle = uomId.toLowerCase();
  const hit = set.find((u) => u.id === needle || u.name.toLowerCase() === needle);
  return hit ? hit.multiplier : 1;
}

/* ─── Deterministic per-line UoM seeding ──────────────────────────
   The user wants existing line items to show varied UoMs across the
   table (not every row stuck on the primary). This picks a UoM from
   the product's set using a stable seed derived from the line id so
   the choice is consistent across re-renders + reloads. The primary
   wins ~50 % of the time so the table still reads as primary-heavy. */
export function pickSeededUomForLine(
  lineId: string,
  setId: UomSetId,
): UomOption {
  const set = UOM_SETS[setId];
  let h = 0;
  for (let i = 0; i < lineId.length; i++) h = (h * 31 + lineId.charCodeAt(i)) | 0;
  const r = Math.abs(h % 100);
  // 50% primary, 30% second option, 15% third, 5% fourth (if present)
  if (r < 50) return set[0];
  if (r < 80) return set[Math.min(1, set.length - 1)];
  if (r < 95) return set[Math.min(2, set.length - 1)];
  return set[Math.min(3, set.length - 1)];
}
