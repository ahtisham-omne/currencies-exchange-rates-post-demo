// Saved Views for the Chart of Accounts table - a read-only "lens" over the
// accounts (filter + optional group-by + auto-aggregation). See
// coa-views-spec.md. The cardinal rule: a view NEVER mutates account records;
// every function here is pure and returns fresh arrays/objects.
import { Account, AccountType, ACCOUNT_TYPE_META } from '../types'

export type ViewKind = 'all' | 'filter' | 'group'
export type GroupBy = 'type' | 'classification' | 'status'

export interface CoaView {
  id: string
  name: string
  kind: ViewKind
  // Filter layer - our AccountType codes. null / empty = include every type.
  types: AccountType[] | null
  // Group-by layer - null = flat list. Applies AFTER the filter.
  groupBy: GroupBy | null
  agg: { count: boolean; sum: boolean }
  builtin: boolean
  shared: boolean
  owner: string | null
}

// Canonical type ordering for grouped sections (spec §5.5).
export const VIEW_TYPE_ORDER: AccountType[] = ['AST', 'LIA', 'EQT', 'REV', 'EXP']

// Group-by option labels for the builder dropdown and lens labels.
export const GROUP_BY_LABEL: Record<GroupBy, string> = {
  type: 'Account type',
  classification: 'Statement classification',
  status: 'Status',
}
// Short form used in the pinned bar's "Grouped by …" lens label.
export const GROUP_BY_SHORT: Record<GroupBy, string> = { type: 'type', classification: 'statement classification', status: 'status' }

// The base "All accounts" state. This is NOT a selectable view - it's the
// table's default (no-lens) state, so it never appears in the Views menu or the
// view tab strip. Kept as a constant purely so activeView resolution has a
// stable fallback when no lens is applied.
export const ALL_VIEW: CoaView = { id: 'all', name: 'All accounts', kind: 'all', types: null, groupBy: null, agg: { count: false, sum: false }, builtin: true, shared: true, owner: null }

// The built-in default views shipped with the table (spec §4). These are
// constants - they are never persisted or mutated. "All accounts" is the base
// state (see ALL_VIEW), not one of these lenses.
export const DEFAULT_VIEWS: CoaView[] = [
  { id: 'rev-exp', name: 'Revenue + Expense', kind: 'group', types: ['REV', 'EXP'], groupBy: 'type', agg: { count: true, sum: true }, builtin: true, shared: true, owner: null },
  { id: 'ast-lia', name: 'Asset + Liability', kind: 'group', types: ['AST', 'LIA'], groupBy: 'type', agg: { count: true, sum: true }, builtin: true, shared: true, owner: null },
]

// The rows a view shows: the filter layer applied to the account set. Returns a
// fresh array; never mutates the input.
export function rowsForView(view: CoaView | null, accounts: Account[]): Account[] {
  if (!view || view.kind === 'all') return accounts.slice()
  if (view.types && view.types.length) return accounts.filter(a => view.types!.includes(a.accountType))
  return accounts.slice()
}

// Only posting rows carry money of their own. A summary row restates the sum of
// the postings beneath it, so adding those rows in as well counts the same money
// once per enclosing summary - with the seed chart that inflated Assets from
// 5,858,600 to 23,434,400. A summary now stores no balance, so this filter no
// longer changes the answer, but it stays as the one definition the group
// subtotals and the grand total share: a lens sums the accounts, not the totals.
export function sumBalance(rows: Account[]): number {
  return rows.reduce((s, a) => (a.isPosting ? s + a.balance : s), 0)
}

// The value an account groups under for a given group-by axis.
function groupValue(a: Account, by: GroupBy): string {
  if (by === 'type') return ACCOUNT_TYPE_META[a.accountType].label
  if (by === 'classification') return a.statementClassification
  return a.status
}

export interface ViewGroup { key: string; rows: Account[]; subtotal: number }

// Group an already-visible row set into sections. For `type`, sections use the
// canonical order; otherwise first-appearance order. Pure - returns fresh data.
export function groupRows(rows: Account[], by: GroupBy): ViewGroup[] {
  const order: string[] = []
  const map = new Map<string, Account[]>()
  rows.forEach(a => {
    const k = groupValue(a, by)
    if (!map.has(k)) { map.set(k, []); order.push(k) }
    map.get(k)!.push(a)
  })
  let keys = order
  if (by === 'type') {
    const canonical = VIEW_TYPE_ORDER.map(t => ACCOUNT_TYPE_META[t].label)
    keys = canonical.filter(l => map.has(l))
  }
  return keys.map(k => ({ key: k, rows: map.get(k)!, subtotal: sumBalance(map.get(k)!) }))
}

// Group the view's filtered rows into sections (filter → group-by).
export function groupRowsForView(view: CoaView, accounts: Account[]): ViewGroup[] {
  return groupRows(rowsForView(view, accounts), view.groupBy ?? 'type')
}

// Auto-name a view from its layers (spec §5.3), e.g. "Revenue + Expense by type".
export function autoNameView(types: AccountType[] | null, groupBy: GroupBy | null): string {
  const labels = (types ?? []).map(t => ACCOUNT_TYPE_META[t].label)
  if (groupBy && labels.length) return `${labels.join(' + ')} by ${GROUP_BY_SHORT[groupBy]}`
  if (groupBy) return `Grouped by ${GROUP_BY_SHORT[groupBy]}`
  if (labels.length) return labels.join(' + ')
  return 'Filtered view'
}

// Build a temporary view from builder selections (does not save).
export function buildTempView(types: AccountType[], groupBy: GroupBy | null, agg: { count: boolean; sum: boolean }): CoaView {
  return {
    id: '__temp',
    name: autoNameView(types.length ? types : null, groupBy),
    kind: groupBy ? 'group' : 'filter',
    types: types.length ? types : null,
    groupBy,
    agg,
    builtin: false,
    shared: false,
    owner: null,
  }
}

// The lens label shown in the pinned aggregation bar.
export function lensLabel(view: CoaView): string {
  return view.kind === 'group' && view.groupBy ? `Grouped by ${GROUP_BY_SHORT[view.groupBy]}` : 'Filtered view'
}
