import type { Account } from '../types'
import { ACCOUNT_TYPE_META, isCategoryRoot } from '../types'
import { chartFigureText, modifiedAtOf, type ColKey } from '../components/AccountTable'
import { cleanName } from '../components/Avatar'
import { stampText } from '../components/AuditCells'
import type { ChartIndex } from './chartTree'
import { searchMatcher } from './tableSearch'
import { accountRange, formatRange } from './numberRange'

/* ──────────────────────────────────────────────────────────────────
 * WHAT A SEARCH OF THE CHART FINDS
 *
 * One answer for every table of accounts: the Chart of Accounts listing, and
 * the Accounts steps of Build from scratch and Guided setup. A search shows the
 * accounts that matched and nothing else - design review, 2026-09-30, Eli: *"If
 * you're doing the search, then you're expecting the search to show you the
 * specific line"* - and the setup steps now answer it the same way (Mahad,
 * 2026-10-02: *"the search functionality should behave the same way we have it
 * in COA listing page"*).
 * ────────────────────────────────────────────────────────────────── */

/* What each column shows, as text a search can find. Every column is read
   whether or not it is on - Mahad, 2026-10-05: *"Right now when I search only
   the internal ID is being searched when it is hidden from the column
   configurator. I think this should be the case for every column that is
   hidden."* A match in a column that is off brings the column out for the
   search, with the note above the table saying so.

   A `Record` over every column, so a column added to the chart cannot be left
   out of search without the compiler saying so. Each entry reads what the cell
   prints, so a match is always something the reader can see marked once the
   column is on - a category root prints a dash for its classification, so it is
   not found by one.

   Figures and moments too, as they print. Mahad, 2026-10-05: *"the search
   should have everything in it."* A figure is found with or without its
   thousands separators (see lib/tableSearch). The one column read by a word of
   its own is Imported, whose chip says only Yes or No: "no" would otherwise
   find every account that did not arrive by import. */
export interface SearchContext {
  /** A dimension's name by id, for the Dimensions column's "Location: USA". */
  dimensionName?: (id: string) => string | undefined
  /** The chart the figures roll up through - the period-scoped one the table
   *  draws - and the base currency they print in. Without them the figure
   *  columns are not searched. */
  index?: ChartIndex
  base?: string
}

const none = () => ''

export const COLUMN_SEARCH_TEXT: Record<ColKey, (a: Account, ctx: SearchContext) => string> = {
  number: a => a.accountNumber,
  name: a => a.accountName,
  numberRange: a => { const r = accountRange(a); return r ? `${formatRange(r)} ${r.start}-${r.end}` : '' },
  type: a => ACCOUNT_TYPE_META[a.accountType]?.label ?? '',
  classification: a => (isCategoryRoot(a) ? '' : a.statementClassification ?? ''),
  // The chip reads "Contra" beside the type on a contra account.
  glType: a => `${a.glAccountType}${a.isContra ? ' Contra' : ''}`,
  role: a => (a.glAccountType === 'Posting' ? a.accountRole ?? '' : ''),
  normalBalance: a => (a.normalBalance === 'n/a' ? '' : a.normalBalance),
  currency: a => a.currencyCode,
  status: a => a.status,
  description: a => a.description ?? '',
  dimensions: (a, ctx) => a.defaultDimensionValues
    .map(v => `${ctx.dimensionName?.(v.dimensionId) ?? ''} ${v.value}`).join(' '),
  internalId: a => a.internalId,
  originalNumber: a => a.originalCode ?? '',
  // The cell reads Yes or No; "imported" is the word a reader looking for them types.
  imported: a => (a.arrivedByImport ? 'imported' : ''),
  // Likewise "restricted" for a restricted account.
  restricted: a => (a.restricted ? 'restricted' : ''),
  createdBy: a => (a.createdBy ? cleanName(a.createdBy) : ''),
  updatedBy: a => { const by = a.updatedBy || a.createdBy; return by ? cleanName(by) : '' },
  openingBalance: (a, ctx) => (ctx.index && ctx.base ? chartFigureText('openingBalance', a, ctx.index, ctx.base) : ''),
  runningBalance: (a, ctx) => (ctx.index && ctx.base ? chartFigureText('runningBalance', a, ctx.index, ctx.base) : ''),
  fxBalance: (a, ctx) => (ctx.index && ctx.base ? chartFigureText('fxBalance', a, ctx.index, ctx.base) : ''),
  createdAt: a => stampText(a.createdAt),
  updatedAt: a => stampText(modifiedAtOf(a)),
  // Never drawn: neither is in the column order.
  posting: none, effectiveDate: none,
}

const COLUMN_KEYS = Object.keys(COLUMN_SEARCH_TEXT) as ColKey[]

/** Which columns a search found its text in, for one account. */
export function searchHits(a: Account, q: string, ctx: SearchContext = {}): ColKey[] {
  if (!q.trim()) return []
  const found = searchMatcher(q)
  return COLUMN_KEYS.filter(k => found(COLUMN_SEARCH_TEXT[k](a, ctx)))
}

/** The accounts a search matched, and only those. An empty search is the whole chart. */
export function searchAccounts<T extends Account>(accounts: T[], query: string, ctx: SearchContext = {}): T[] {
  return query.trim() ? accounts.filter(a => searchHits(a, query, ctx).length > 0) : accounts
}

/** The columns that are off and that a search found something in, across the
 *  accounts it listed - what a table brings out for the search. */
export function hiddenSearchHits(accounts: Account[], query: string, isShown: (k: ColKey) => boolean, ctx: SearchContext = {}): ColKey[] {
  if (!query.trim()) return []
  const hit = new Set<ColKey>()
  for (const a of accounts) for (const k of searchHits(a, query, ctx)) if (!isShown(k)) hit.add(k)
  return COLUMN_KEYS.filter(k => hit.has(k))
}
