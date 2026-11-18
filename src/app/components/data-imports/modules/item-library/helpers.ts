/* Provenance: nimble-palette/src/app/import-export/helpers.ts
 * sha256 324e28af971280d1e245084bd7b4049d0bde4c69393288892511d28b0d3576b3
 * Copied into role-zen 2026-09-30. Verbatim. */
/* Pure helpers over the file vocabulary. Depend only on spec.data.mjs so
 * mappers.ts (and through it ItemsContext) never import the UI modules that
 * spec.ts reads its live option lists from. */

import { PIPE, VOCAB } from "./spec.data.mjs";

/** Split a pipe list: trimmed, empties dropped, case-insensitive duplicates removed. */
export function splitPipe(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(value ?? "").split(PIPE)) {
    const v = part.trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

/** Omne tag contract: each tag is at most 30 characters. */
export const TAG_MAX = 30;

/** Tags from a pipe list: trimmed, each cut to TAG_MAX, deduped after the cut.
 * `truncated` lists the original entries that were longer than TAG_MAX. */
export function parseTags(value: string): { tags: string[]; truncated: string[] } {
  const tags: string[] = [];
  const truncated: string[] = [];
  const seen = new Set<string>();
  for (const t of splitPipe(value)) {
    if (t.length > TAG_MAX) truncated.push(t);
    const cut = t.slice(0, TAG_MAX).trim();
    const k = cut.toLowerCase();
    if (!cut || seen.has(k)) continue;
    seen.add(k);
    tags.push(cut);
  }
  return { tags, truncated };
}

export function joinPipe(values: readonly string[] | undefined | null): string {
  return (values ?? []).filter((v) => v && String(v).trim()).join(PIPE);
}

/** Normalised natural key: trimmed, lower-cased. */
export function normalizeKey(value: string | undefined | null): string {
  return String(value ?? "").trim().toLowerCase();
}

/** "Yes" / "No" vocabulary -> boolean; null when blank or not recognised. */
export function parseYesNo(value: string): boolean | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return null;
  if (VOCAB.yes.includes(v)) return true;
  if (VOCAB.no.includes(v)) return false;
  return null;
}

/** Case-insensitive enum match returning the canonical file value, or null. */
export function matchOption(value: string, options: readonly string[]): string | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return null;
  return options.find((o) => o.toLowerCase() === v) ?? null;
}

/** Look a name up in a lower-cased -> canonical map; the trimmed input when no map is given. */
export function canonical(value: string, known?: Map<string, string>): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  if (!known || known.size === 0) return v;
  return known.get(v.toLowerCase()) ?? null;
}

/** Keep the names the map knows (canonical spelling); all names when no map. */
export function knownOnly(values: readonly string[], known?: Map<string, string>): string[] {
  if (!known || known.size === 0) return [...values];
  const out: string[] = [];
  for (const v of values) {
    const c = known.get(v.trim().toLowerCase());
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}
