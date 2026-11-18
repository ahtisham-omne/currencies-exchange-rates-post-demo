/* Provenance: radiant-core-fusion/src/app/import-export/values.ts
 * sha256 daed7821c2c63a78cb29b880c0a5e20194b40d5d0a123d282b857256244a6238
 * Copied into role-zen 2026-09-30. Edits: 2 import/field line(s) rewritten for role-zen (see git diff vs source). 27 Oct 2026: the 5000-character description cap removed, rule and copy (Omne does not cap descriptions; ERP-9664). Otherwise rules and copy unchanged. */
/* Cell-value normalisers shared by validation.ts (what is wrong with a value)
   and mappers.ts (what a value becomes on import). Kept together so the two
   can never disagree about what a cell means. */

import { resolveUnitName, uomCategory } from "./uom.mjs";
import type { LotIdSource, CategoryStatus } from "./categoryTypes";

export const LIST_SEPARATOR = "|";
export const MAX_TAG_LENGTH = 30;
export const ACQUISITION_OPTIONS = ["Purchased", "Manufactured"] as const;
export const STATUS_OPTIONS = ["Active", "Inactive"] as const;
export const LOT_ID_OPTIONS = ["System Generated", "Vendor Lot"] as const;

/** Trimmed, lower-cased matching key (Category Code). */
export function normalizeKey(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
}

/** Split a pipe-separated cell into trimmed, non-empty entries. */
export function splitList(raw: string): string[] {
  return String(raw ?? "")
    .split(LIST_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Case-insensitive match of a typed value against a fixed option list; the canonical spelling or null. */
export function matchOption(raw: string, options: readonly string[]): string | null {
  const t = String(raw ?? "").trim().toLowerCase();
  if (!t) return null;
  return options.find((o) => o.toLowerCase() === t) ?? null;
}

/** Yes / No cells also accept y, n, true, false, 1, 0. */
export function matchYesNo(raw: string): "Yes" | "No" | null {
  const t = String(raw ?? "").trim().toLowerCase();
  if (!t) return null;
  if (["yes", "y", "true", "1"].includes(t)) return "Yes";
  if (["no", "n", "false", "0"].includes(t)) return "No";
  return null;
}

export function normalizeStatus(raw: string): CategoryStatus | null {
  const m = matchOption(raw, STATUS_OPTIONS);
  return m ? (m.toLowerCase() as CategoryStatus) : null;
}

export function normalizeLotIdSource(raw: string): LotIdSource | null {
  const m = matchOption(raw, LOT_ID_OPTIONS);
  if (m === "System Generated") return "system";
  if (m === "Vendor Lot") return "vendor";
  return null;
}

export interface ParsedTags {
  /** Trimmed, deduped (case-insensitive), each cut to MAX_TAG_LENGTH. */
  tags: string[];
  /** The original spellings that were longer than the cap. */
  truncated: string[];
}

export function parseTags(raw: string): ParsedTags {
  const tags: string[] = [];
  const seen = new Set<string>();
  const truncated: string[] = [];
  for (const t of splitList(raw)) {
    if (t.length > MAX_TAG_LENGTH) truncated.push(t);
    const cut = t.slice(0, MAX_TAG_LENGTH);
    const k = cut.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    tags.push(cut);
  }
  return { tags, truncated };
}

export interface AltUnitPair {
  unit: string;
  factor: number;
}

export interface ParsedAlternativeUnits {
  pairs: AltUnitPair[];
  /** One sentence per bad entry; empty when every entry parsed. */
  problems: string[];
}

/**
 * Parse "Unit=factor|Unit=factor". `baseUnit` is the canonical base unit name
 * when known (the same-category rule is skipped when it is null).
 */
export function parseAlternativeUnits(raw: string, baseUnit: string | null): ParsedAlternativeUnits {
  const pairs: AltUnitPair[] = [];
  const problems: string[] = [];
  const baseCategory = baseUnit ? uomCategory(baseUnit) : undefined;
  for (const entry of splitList(raw)) {
    const eq = entry.indexOf("=");
    if (eq < 0) {
      problems.push(`"${entry}" is not in the Unit=factor form.`);
      continue;
    }
    const unitRaw = entry.slice(0, eq).trim();
    const factorRaw = entry.slice(eq + 1).trim();
    const unit = resolveUnitName(unitRaw);
    if (!unit) {
      problems.push(`"${unitRaw || entry}" is not a unit Omne knows.`);
      continue;
    }
    const factor = Number(factorRaw);
    if (!factorRaw || !Number.isFinite(factor) || factor <= 0) {
      problems.push(`"${unit}" needs a factor above 0.`);
      continue;
    }
    if (baseUnit && unit === baseUnit) {
      problems.push(`"${unit}" is the base unit itself.`);
      continue;
    }
    if (baseCategory && uomCategory(unit) === baseCategory) {
      problems.push(`"${unit}" is in the same unit category as the base unit (${baseUnit}).`);
      continue;
    }
    pairs.push({ unit, factor });
  }
  return { pairs, problems };
}

export interface ParsedAcquisition {
  /** Canonical, deduped, in option order. */
  methods: string[];
  /** Entries that matched neither option. */
  unknown: string[];
}

export function parseAcquisitionMethods(raw: string): ParsedAcquisition {
  const found = new Set<string>();
  const unknown: string[] = [];
  for (const entry of splitList(raw)) {
    const m = matchOption(entry, ACQUISITION_OPTIONS);
    if (m) found.add(m);
    else unknown.push(entry);
  }
  return { methods: ACQUISITION_OPTIONS.filter((o) => found.has(o)), unknown };
}

/** "A", "A and B", or "A, B, and N more" for messages. */
export function quoteList(items: string[]): string {
  const q = items.map((s) => `"${s}"`);
  if (q.length === 1) return q[0];
  if (q.length === 2) return `${q[0]} and ${q[1]}`;
  return `${q[0]}, ${q[1]}, and ${q.length - 2} more`;
}

/** "Active or Inactive", "Stock, Non-stock, or Asset". */
export function orList(options: readonly string[]): string {
  if (options.length <= 1) return options.join("");
  if (options.length === 2) return `${options[0]} or ${options[1]}`;
  return `${options.slice(0, -1).join(", ")}, or ${options[options.length - 1]}`;
}
