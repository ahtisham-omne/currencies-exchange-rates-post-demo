/* ──────────────────────────────────────────────────────────────────
 * ONE DEFAULT PER DIMENSION
 *
 * An account can carry several values for one dimension (design review,
 * 2026-09-30: one account used in Singapore and in the USA), and that is right
 * for finding the account: filter by either and it comes up.
 *
 * It is wrong for posting. A $1,000 line that picked up USA and Singapore would
 * either be counted twice by a report by location, or not be placeable at all,
 * because one amount can only land in one place. So when an account holds more
 * than one value for a dimension, one of them is marked the default, and that is
 * the value a journal line takes when the account is picked. Mahad, 2026-10-02:
 * *"One default per dimension... it's required as soon as a second value is
 * added. Posting uses the default."*
 *
 * A dimension with a single value needs no mark: that value is the default. The
 * flag is only stored where there is a choice to record.
 * ────────────────────────────────────────────────────────────────── */

export interface DimensionPair {
  dimensionId: string
  value: string
  /** The value a journal line takes, where the account holds more than one for this dimension. */
  isDefault?: boolean
}

/** Each dimension the account carries, with its values in the order given. */
export function valuesByDimension(pairs: DimensionPair[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const p of pairs) out.set(p.dimensionId, [...(out.get(p.dimensionId) ?? []), p.value])
  return out
}

/** The value a posting takes for one dimension: the only one, or the one marked.
    null when the dimension holds several and none (or more than one) is marked. */
export function defaultValueOf(pairs: DimensionPair[], dimensionId: string): string | null {
  const mine = pairs.filter(p => p.dimensionId === dimensionId)
  if (mine.length === 1) return mine[0].value
  const marked = mine.filter(p => p.isDefault)
  return marked.length === 1 ? marked[0].value : null
}

/** The dimensions holding more than one value with no single default marked. */
export function missingDefaults(pairs: DimensionPair[]): string[] {
  return [...valuesByDimension(pairs).keys()].filter(id => defaultValueOf(pairs, id) === null)
}

/** What a journal line takes from the account: one value per dimension, the
    default. A dimension without one is left off rather than guessed at. */
export function postingDimensions(pairs: DimensionPair[] | undefined): { dimensionId: string; value: string }[] {
  const list = pairs ?? []
  return [...valuesByDimension(list).keys()].flatMap(id => {
    const value = defaultValueOf(list, id)
    return value === null ? [] : [{ dimensionId: id, value }]
  })
}

/** Marks `value` the default for its dimension, and nothing else in it. */
export function withDefault(pairs: DimensionPair[], dimensionId: string, value: string): DimensionPair[] {
  return normaliseDefaults(pairs.map(p => p.dimensionId === dimensionId ? { ...p, isDefault: p.value === value } : p))
}

/** Keeps the mark only where it records a choice: on a dimension holding more
    than one value, on exactly one of them. A lone value carries no flag. */
export function normaliseDefaults(pairs: DimensionPair[]): DimensionPair[] {
  const counts = new Map<string, number>()
  pairs.forEach(p => counts.set(p.dimensionId, (counts.get(p.dimensionId) ?? 0) + 1))
  const seen = new Set<string>()
  return pairs.map(({ isDefault, ...p }) => {
    if ((counts.get(p.dimensionId) ?? 0) < 2 || !isDefault || seen.has(p.dimensionId)) return p
    seen.add(p.dimensionId)
    return { ...p, isDefault: true }
  })
}

/* ──────────────────────────────────────────────────────────────────
 * IN USE
 *
 * A dimension, or one of its values, that any account carries or any posting
 * was booked with cannot be removed - it can only be deactivated, so nothing
 * new picks it while everything that has it keeps it. Decision 89; module
 * review, 2026-10-06 (COA-02): removing Location left four bank accounts
 * showing a dimension that no longer existed.
 * ────────────────────────────────────────────────────────────────── */

export interface DimensionUse {
  /** Accounts carrying it as a default. */
  accounts: number
  /** Postings booked with it. */
  postings: number
}

type CarriesDimensions = { defaultDimensionValues?: { dimensionId: string; value: string }[] }
type PostedWithDimensions = { dimensionValues?: { dimensionId: string; value: string }[] }

/** How much uses a dimension, or one value of it when `value` is given. */
export function dimensionUse(
  dimensionId: string,
  accounts: CarriesDimensions[],
  postings: PostedWithDimensions[],
  value?: string,
): DimensionUse {
  const hits = (list: { dimensionId: string; value: string }[] | undefined) =>
    !!list?.some(p => p.dimensionId === dimensionId && (value === undefined || p.value === value))
  return {
    accounts: accounts.filter(a => hits(a.defaultDimensionValues)).length,
    postings: postings.filter(t => hits(t.dimensionValues)).length,
  }
}

export const inUse = (u: DimensionUse) => u.accounts > 0 || u.postings > 0

/** "4 accounts and 1,203 postings", for a sentence about why it stays. */
export function describeUse(u: DimensionUse): string {
  const n = (k: number, one: string, many: string) => `${k.toLocaleString('en-US')} ${k === 1 ? one : many}`
  const parts = [
    u.accounts ? n(u.accounts, 'account', 'accounts') : '',
    u.postings ? n(u.postings, 'posting', 'postings') : '',
  ].filter(Boolean)
  return parts.join(' and ')
}

/** Every value of a dimension that something uses, with how much uses it. */
export function valuesInUse(
  dimensionId: string,
  values: string[],
  accounts: CarriesDimensions[],
  postings: PostedWithDimensions[],
): Map<string, DimensionUse> {
  const out = new Map<string, DimensionUse>()
  for (const v of values) {
    const u = dimensionUse(dimensionId, accounts, postings, v)
    if (inUse(u)) out.set(v, u)
  }
  return out
}
