import { searchMatcher } from '../../lib/tableSearch'
import { NEEDS_DETAILS_LABEL, REVIEW_COLUMNS, REVIEW_STATUS_LABEL, isDimensionKey, mergedChipText, type ColumnKey, type DimensionKey, type ReviewField, type ReviewRowView, type ReviewStatus } from './reviewColumns'

// Everything the grid works out from its rows, kept pure so it can be tested
// without a DOM. The grid itself only draws.

export type ReviewFilter = 'all' | 'ready' | 'errors' | 'warnings' | 'needsDetails'

export interface ReviewCounts { all: number; ready: number; errors: number; warnings: number; needsDetails: number }

export function countByStatus(rows: ReviewRowView[]): ReviewCounts {
  let ready = 0, errors = 0, warnings = 0, needsDetails = 0
  for (const r of rows) {
    if (r.verdict === 'ready') ready++
    else if (r.verdict === 'error') errors++
    else warnings++
    /* Counted across the three verdicts rather than beside them. A bank account
       that also carries a warning is one row needing two different things done
       to it, and hiding the to-do behind the defect loses it. */
    if (r.needsDetails && r.verdict !== 'error') needsDetails++
  }
  return { all: rows.length, ready, errors, warnings, needsDetails }
}

const STATUS_OF_FILTER: Record<'ready' | 'errors' | 'warnings', ReviewStatus> = {
  ready: 'ready', errors: 'error', warnings: 'warning',
}

/* The text a search looks through, one entry per cell, as each prints: every
   column the file carries, the dimensions read out of the numbers, and the
   Result column's chips. Read off the row rather than off a column list, so
   searching for Marketing finds the rows that came out as Marketing whether or
   not that column happens to be on screen. Mahad, 2026-10-05: *"the search
   should have everything in it"* - which brought the Result column in, so
   "error" finds the rows the grid marks Error and marks the chip. */
export function searchableTexts(row: ReviewRowView): string[] {
  const fromFile = REVIEW_COLUMNS.map(c => String(row[c.key] ?? ''))
  const fromDimensions = Object.keys(row).filter(isDimensionKey).map(k => row[k as DimensionKey] ?? '')
  const result = [
    REVIEW_STATUS_LABEL[row.verdict],
    row.mergedFrom ? mergedChipText(row.mergedFrom) : '',
    row.needsDetails && row.verdict !== 'error' ? NEEDS_DETAILS_LABEL : '',
  ]
  return [...fromFile, ...fromDimensions, ...result].filter(Boolean)
}

export function filterRows(rows: ReviewRowView[], filter: ReviewFilter, query: string): ReviewRowView[] {
  const q = query.trim()
  // The pattern the cells mark with (lib/tableSearch), so a row found is a row marked.
  const found = searchMatcher(q)
  return rows.filter(r => {
    if (filter === 'needsDetails') {
      if (!r.needsDetails || r.verdict === 'error') return false
    } else if (filter !== 'all' && r.verdict !== STATUS_OF_FILTER[filter]) return false
    return !q || searchableTexts(r).some(found)
  })
}

export interface SortState { key: ColumnKey; dir: 'asc' | 'desc' }

export function sortRows(rows: ReviewRowView[], sort: SortState | null): ReviewRowView[] {
  if (!sort) return rows
  const dir = sort.dir === 'asc' ? 1 : -1
  // Copied first: the caller's array is a memo other things read.
  return [...rows].sort((a, b) =>
    dir * String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''), undefined, { sensitivity: 'base', numeric: true }),
  )
}

/** The rows that cannot be imported, as the set the exclude button applies. */
export function errorRowKeys(rows: ReviewRowView[]): number[] {
  return rows.filter(r => r.verdict === 'error').map(r => r.row)
}

/**
 * Which cells on a row were changed, and what they said before. The grid keys
 * edits by spreadsheet row, so this compares the edited row against the row as
 * parsed rather than tracking a history.
 */
export function editedFields(original: Record<string, unknown>, edited: Record<string, unknown>): Set<ColumnKey> {
  const out = new Set<ColumnKey>()
  for (const c of REVIEW_COLUMNS) {
    const before = original[c.key] ?? ''
    const after = edited[c.key] ?? ''
    /* An answer the engine filled in for a cell the file left blank is not
       somebody's edit, and marking it as one would offer to revert the row to a
       classification it never carried. */
    if (c.filledIn && !String(before).trim()) continue
    if (String(before) !== String(after)) out.add(c.key)
  }
  return out
}

/** Move `key` to where `over` sits, the splice a column drag performs. */
export function moveColumn(order: ColumnKey[], key: ColumnKey, over: ColumnKey): ColumnKey[] {
  const from = order.indexOf(key)
  const to = order.indexOf(over)
  if (from === -1 || to === -1 || from === to) return order
  const next = [...order]
  next.splice(from, 1)
  next.splice(to, 0, key)
  return next
}

/** The page a given row falls on, so a selected or edited row stays reachable. */
export function pageOfRow(rows: ReviewRowView[], rowKey: number, perPage: number): number {
  const idx = rows.findIndex(r => r.row === rowKey)
  return idx === -1 ? 1 : Math.floor(idx / perPage) + 1
}
