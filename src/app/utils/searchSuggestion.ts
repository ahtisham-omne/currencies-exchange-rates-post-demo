/**
 * "Did you mean …?" engine for listing-table search.
 *
 * When a search returns nothing, we look through the values the grid can
 * search (names, codes, emails, cities …) for the closest spelling of what
 * the user typed. "toyotaa" → "Toyota", "acme indstries" → "Acme Industries".
 *
 * Pure and synchronous so every grid can call it inside a useMemo. The
 * corpus is only scanned when the result set is empty, so it never costs
 * anything on the happy path.
 */

const MIN_QUERY_LENGTH = 3;
const MAX_CANDIDATE_LENGTH = 80;

/** Optimal-string-alignment distance (Levenshtein + adjacent transposition). */
function editDistance(a: string, b: string, limit: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const prev2: number[] = new Array(b.length + 1).fill(0);
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > limit) return limit + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    prev = cur;
  }
  return prev[b.length];
}

/** How many typos we forgive for a word of this length. */
function allowedDistance(len: number): number {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

const tokenize = (s: string) => s.split(/[^\p{L}\p{N}@.]+/u).filter(Boolean);

interface Candidate {
  /** lowercased form used for comparison */
  key: string;
  /** original casing shown to the user */
  display: string;
  /** how many times this value appears — breaks ties toward common terms */
  weight: number;
}

function buildCandidates(values: Iterable<string | null | undefined>): Map<string, Candidate> {
  const out = new Map<string, Candidate>();
  const add = (raw: string) => {
    const display = raw.trim();
    if (display.length < MIN_QUERY_LENGTH || display.length > MAX_CANDIDATE_LENGTH) return;
    const key = display.toLowerCase();
    const hit = out.get(key);
    if (hit) hit.weight++;
    else out.set(key, { key, display, weight: 1 });
  };
  for (const v of values) {
    if (!v) continue;
    add(v);
    for (const t of tokenize(v)) add(t);
  }
  return out;
}

/** Best fuzzy match for one term, or null. Also tolerates a typo inside a prefix ("toyta" → "Toyota"). */
function bestMatch(term: string, candidates: Map<string, Candidate>): { c: Candidate; d: number } | null {
  const limit = allowedDistance(term.length);
  let best: { c: Candidate; d: number } | null = null;
  for (const c of candidates.values()) {
    if (c.key === term) return null; // already an exact term — not a typo
    let d = editDistance(term, c.key, limit);
    if (d > limit && c.key.length > term.length) {
      // Prefix tolerance: compare against the start of the candidate.
      d = Math.min(
        editDistance(term, c.key.slice(0, term.length), limit),
        editDistance(term, c.key.slice(0, term.length + 1), limit),
      );
      if (d <= limit) d += 0.5; // a full-word match always beats a prefix match
    }
    if (d > limit) continue;
    if (
      !best ||
      d < best.d ||
      (d === best.d && c.weight > best.c.weight) ||
      (d === best.d && c.weight === best.c.weight && Math.abs(c.key.length - term.length) < Math.abs(best.c.key.length - term.length))
    ) {
      best = { c, d };
    }
  }
  return best;
}

export interface SearchSuggestionOptions {
  /**
   * Optional check that the suggestion actually returns rows with the
   * grid's own search logic. When given, suggestions that would still
   * come back empty are dropped.
   */
  yieldsResults?: (suggestion: string) => boolean;
}

/**
 * Return a corrected search term, or null when nothing is close enough.
 *
 * @param query  what the user typed
 * @param values every searchable string in the grid (pass the full dataset,
 *               not just the current page)
 */
export function findSearchSuggestion(
  query: string,
  values: Iterable<string | null | undefined>,
  options: SearchSuggestionOptions = {},
): string | null {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_QUERY_LENGTH) return null;
  const candidates = buildCandidates(values);
  if (candidates.size === 0) return null;

  const accept = (s: string | null) => {
    if (!s || s.toLowerCase() === q) return null;
    if (options.yieldsResults && !options.yieldsResults(s)) return null;
    return s;
  };

  // 1. Whole-phrase match ("acme indstries" → "Acme Industries").
  const whole = bestMatch(q, candidates);
  const wholeHit = accept(whole?.c.display ?? null);
  if (wholeHit) return wholeHit;

  // 2. Word-by-word correction for multi-word queries.
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    let changed = false;
    const fixed = words.map((w) => {
      if (w.length < MIN_QUERY_LENGTH) return w;
      const m = bestMatch(w, candidates);
      if (!m) return w;
      changed = true;
      return m.c.display;
    });
    if (changed) return accept(fixed.join(" "));
  }
  return null;
}
