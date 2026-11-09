/* ──────────────────────────────────────────────────────────────────
 * WHAT A TABLE SEARCH FINDS, AND WHAT IT MARKS
 *
 * One rule for every searchable table in the module. Mahad, 2026-10-05: *"can
 * we have that on all searchable tables in the COA module? ... the search should
 * have everything in it. For example, When I have search for "System" and the
 * created by column is active, it doesn't highlight it ... do this carefully for
 * both active and hidden columns."*
 *
 * So every table searches every column, on or off, by the text the cell prints,
 * and the yellow mark is drawn by the same pattern the match was made with - a
 * row can never come back for a reason the reader cannot see marked.
 *
 * A query with a digit in it skips thousands separators on both sides, so 1250
 * finds "$ 1,250.00" and marks the "1,250" in it, and 1,250 finds a bare 1250.
 * ────────────────────────────────────────────────────────────────── */

const escape = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

let lastQuery = ''
let lastSource: string | null = null

/** The pattern a query finds in a cell's text, as a RegExp source; null for an
 *  empty query. Cached on the query, since a table asks once per cell. */
export function searchPatternSource(q: string): string | null {
  if (q === lastQuery) return lastSource
  lastQuery = q
  const query = q.trim()
  if (!query) return (lastSource = null)
  if (/\d/.test(query)) {
    const chars = [...query.replace(/,/g, '')]
    lastSource = chars.length ? chars.map(escape).join(',?') : null
  } else {
    lastSource = [...query].map(escape).join('')
  }
  return lastSource
}

/** A test for one query, built once and run against every cell. */
export function searchMatcher(q: string): (text: string | undefined | null) => boolean {
  const source = searchPatternSource(q)
  if (!source) return () => true
  const re = new RegExp(source, 'i')
  return text => !!text && re.test(text)
}

/** Does this text hold the query? For a single check; a loop should hold one
 *  `searchMatcher` instead. */
export const matchesSearch = (text: string | undefined | null, q: string) => searchMatcher(q)(text)

/** "A", "A and B", "A, B and C". */
export const listJoin = (xs: string[]) =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
