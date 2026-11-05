/* ═══════════════════════════════════════════════════════════════════════════
 *  Unit-of-Measure data layer — SO module
 *  Mirror of `Quotes-Detail-V6.5/src/app/data/uomSets.ts`. The two modules
 *  live in separate src trees and can't share a file; keep these byte-for-
 *  byte equivalent so a product behaves the same on a quote and on the SO
 *  it converts into.
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface UomOption {
  id: string;
  name: string;
  fullName: string;
  multiplier: number;
}

export type UomSetId = 'discrete' | 'liquid' | 'length';

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

/* Strict patterns: only match names that spell out a container or
   spool measurement. Services, kits, and components that merely
   reference paint/cable/coolant in their description stay discrete.
   See the Quote module's `uomSets.ts` for the rationale. */
const LIQUID_NAME_PATTERNS = [
  /\b\d+(?:\.\d+)?\s*-?\s*gallon\b/i,
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

const SET_OVERRIDE_BY_CODE: Record<string, UomSetId> = {};

export function getUomSetIdForProduct(p: { id?: string; itemCode?: string; name?: string; itemName?: string; category?: string }): UomSetId {
  const code = (p.id || p.itemCode || '').toString();
  if (code && SET_OVERRIDE_BY_CODE[code]) return SET_OVERRIDE_BY_CODE[code];
  const name = (p.name || p.itemName || '').toString();
  for (const pat of LIQUID_NAME_PATTERNS) if (pat.test(name)) return 'liquid';
  for (const pat of LENGTH_NAME_PATTERNS) if (pat.test(name)) return 'length';
  return 'discrete';
}

export function getUomSetForProduct(p: { id?: string; itemCode?: string; name?: string; itemName?: string; category?: string }): UomOption[] {
  return UOM_SETS[getUomSetIdForProduct(p)];
}

/* Per-product PRIMARY UoM — deterministically derived from the
   product's id/code so each product carries a stable preferred unit
   that may not be the set's first entry. Gives the catalog real
   per-product variety instead of every discrete SKU defaulting to
   EA. Distribution: 50% set[0], 30% set[1], 15% set[2], 5% set[3]. */
export function getPrimaryUomForProduct(p: { id?: string; itemCode?: string; name?: string; itemName?: string; category?: string }): string {
  const setId = getUomSetIdForProduct(p);
  const set = UOM_SETS[setId];
  const key = (p.id || p.itemCode || p.name || p.itemName || '').toString();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const r = Math.abs(h % 100);
  if (r < 50) return set[0].id;
  if (r < 80) return set[Math.min(1, set.length - 1)].id;
  if (r < 95) return set[Math.min(2, set.length - 1)].id;
  return set[Math.min(3, set.length - 1)].id;
}

/* Set-level primary — useful when the consumer wants the canonical
   first entry (Liter for liquid, Foot for length, EA for discrete)
   regardless of which product is in play. */
export function getSetPrimaryUom(p: { id?: string; itemCode?: string; name?: string; itemName?: string; category?: string }): string {
  return PRIMARY_UOM_BY_SET[getUomSetIdForProduct(p)];
}

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

export function pickSeededUomForLine(
  lineId: string,
  setId: UomSetId,
): UomOption {
  const set = UOM_SETS[setId];
  let h = 0;
  for (let i = 0; i < lineId.length; i++) h = (h * 31 + lineId.charCodeAt(i)) | 0;
  const r = Math.abs(h % 100);
  if (r < 50) return set[0];
  if (r < 80) return set[Math.min(1, set.length - 1)];
  if (r < 95) return set[Math.min(2, set.length - 1)];
  return set[Math.min(3, set.length - 1)];
}
