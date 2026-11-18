/* Provenance: radiant-core-fusion/src/app/data/uom.d.mts
 * sha256 a3fc12704cafd79663557b15227ac51bb9f7dbaeaa52d81a3111d54bd15ac495
 * Copied into role-zen 2026-09-30. Verbatim. */
/* Type surface for uom.mjs (the runtime lives in the .mjs so Node scripts can
   import it without a TypeScript loader). Keep both files in step. */

export type UomType = "standard" | "custom";

export interface UomDefinition {
  category: string;
  /** Factor against the canonical base unit of the category; NaN when no linear ratio exists. */
  factor: number;
  abbrev: string;
  type: UomType;
}

export const UOM_CANONICAL: Record<string, UomDefinition>;
export const uomAbbrev: (v: string) => string;
export const uomType: (unit: string) => UomType | undefined;
export const uomCategory: (unit: string) => string | undefined;
/** Every selectable unit name, in table order, minus the legacy aliases (Kg, Lb, Ton). */
export const allUnitNames: () => string[];
export const unitsByCategory: (cat: string) => string[];
export const UOM_CATEGORIES: string[];
export function autoConversionFactor(altUnit: string, baseUnit: string): number | null;
export const isStandardConversion: (altUnit: string, baseUnit: string) => boolean;
/** Case-insensitive lookup by unit name or abbreviation; canonical spelling or null. */
export function resolveUnitName(raw: string | null | undefined): string | null;
