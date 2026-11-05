/* Pure helpers over the file vocabulary. Depend only on spec.data.mjs so
 * mappers.ts (and through it ItemsContext) never import the UI modules that
 * spec.ts reads its live option lists from. */

import { OPTION_SNAPSHOTS, PIPE, VOCAB } from "./spec.data.mjs";

/** Lists in the file and in the review grid are comma separated: "Pumps, Fluid Handling". */
export const LIST_SEPARATOR = ", ";

/* Names that carry a comma of their own ("Tesla, Inc."): the option snapshots, plus any live
 * reference list a caller passes. Adjacent comma pieces are joined back whenever the joined
 * text is one of them. */
const SNAPSHOT_NAMES = new Set(
  Object.values(OPTION_SNAPSHOTS)
    .flatMap((list) => (list as readonly unknown[]).map((v) => String(Array.isArray(v) ? v[0] : v)))
    .map((v) => v.toLowerCase()),
);
/* Company suffixes after a comma ("Honda Motor Co., Ltd.") and thousands groups in a number
 * ("1,250.00 Each") belong to the piece before them. */
const COMPANY_SUFFIX = /^(inc|ltd|llc|llp|plc|corp|co|gmbh|pty|s\.p\.a|n\.v|b\.v)\.?(\s|\(|$)/i;
const THOUSANDS = /^\d{3}(?!\d)/;

type KnownNames = ReadonlyMap<string, string> | Iterable<string>;

function knownChecker(extra?: KnownNames): (v: string) => boolean {
  const names = new Set<string>();
  if (extra instanceof Map) {
    for (const [k, v] of extra) {
      names.add(String(k).toLowerCase());
      names.add(String(v).toLowerCase());
    }
  } else if (extra) {
    for (const v of extra as Iterable<string>) names.add(String(v).toLowerCase());
  }
  return (v) => {
    const k = v.toLowerCase();
    return SNAPSHOT_NAMES.has(k) || names.has(k);
  };
}

/** Split a list cell: comma separated, a "|" from files made for the older pipe template reads
 * the same way. Trimmed, empties dropped, case-insensitive duplicates removed. Names that hold a
 * comma themselves stay whole when they are known (the option snapshots or `known`). */
export function splitList(value: string, known?: KnownNames): string[] {
  const isKnown = knownChecker(known);
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    const k = v.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(v);
  };
  for (const part of String(value ?? "").split(PIPE)) {
    const pieces = part.split(",");
    for (let i = 0; i < pieces.length; i++) {
      let taken = pieces[i].trim();
      for (let j = pieces.length - 1; j > i; j--) {
        const joined = pieces.slice(i, j + 1).map((p) => p.trim()).join(", ");
        if (isKnown(joined)) {
          taken = joined;
          i = j;
          break;
        }
      }
      while (i + 1 < pieces.length) {
        const next = pieces[i + 1];
        if (THOUSANDS.test(next) && /\d$/.test(taken)) taken = `${taken},${next.trim()}`;
        else if (COMPANY_SUFFIX.test(next.trim())) taken = `${taken}, ${next.trim()}`;
        else break;
        i++;
      }
      add(taken);
    }
  }
  return out;
}

/** Omne tag contract: each tag is at most 30 characters. */
export const TAG_MAX = 30;

/** Tags from a list cell: trimmed, each cut to TAG_MAX, deduped after the cut.
 * `truncated` lists the original entries that were longer than TAG_MAX. */
export function parseTags(value: string): { tags: string[]; truncated: string[] } {
  const tags: string[] = [];
  const truncated: string[] = [];
  const seen = new Set<string>();
  for (const t of splitList(value)) {
    if (t.length > TAG_MAX) truncated.push(t);
    const cut = t.slice(0, TAG_MAX).trim();
    const k = cut.toLowerCase();
    if (!cut || seen.has(k)) continue;
    seen.add(k);
    tags.push(cut);
  }
  return { tags, truncated };
}

/** Join a list for a cell or a file: comma separated. */
export function joinList(values: readonly string[] | undefined | null): string {
  return (values ?? []).filter((v) => v && String(v).trim()).join(LIST_SEPARATOR);
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
