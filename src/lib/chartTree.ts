import { compareAccountNumbers, type Account, type AccountType } from '../types'

// =========================
// Chart tree: the single derivation of chart *structure* and chart *figures*.
//
// A chart of accounts is a forest. Every account either sits at the top or names
// its parent through `parentId`, and a Summary account's figures are nothing but
// the sum of what hangs beneath it. Both facts are needed on the same row at the
// same time - a table cell needs the indent depth and the rolled amount together,
// a lifecycle gate needs the descendants, an export needs all three - so
// structure and figures are derived in one pass and read through one index.
//
// Keeping them together is deliberate. When they lived apart, the table's rollup
// and the listing's rollup drifted into two implementations that disagreed.
// =========================

export interface ChartFigures {
  /** Closing balance. A posting's own; a summary's the sum of its children's. */
  balance: number
  /** Net movement over the same span, rolled up the same way. */
  netChange: number
  /** The balance as it stands today, whatever the span, rolled up the same way. */
  current: number
}

export interface ChartIndex {
  byId: Map<string, Account>
  /** Children per parent id, sorted by account number. Parents with none are absent. */
  children: Map<string, Account[]>
  /** Top-level accounts, sorted by account number. */
  roots: Account[]
  parentOf(id: string): Account | undefined
  childrenOf(id: string): Account[]
  /** Everything beneath the account, pre-order (a parent before its own children), excluding itself. */
  descendantsOf(id: string): Account[]
  /** The chain up to the top, nearest parent first. */
  ancestorsOf(id: string): Account[]
  /** 0 for a top-level account, 1 for its children, and so on. */
  depthOf(id: string): number
  figuresOf(id: string): ChartFigures
  /**
   * Accounts the tree cannot place: a `parentId` naming an account that is not
   * here, or a loop. Empty for any chart the app itself produced - a value in
   * here is a data fault, not a state to design around.
   */
  unreachable: string[]
}

const ZERO: ChartFigures = { balance: 0, netChange: 0, current: 0 }

/** How sibling rows order. Compared as whole numbers rather than reduced to an
 *  integer key: an account number may carry letters, and AR100 and BR100 are two
 *  different accounts that a digits-only key would call the same. */
// A computed line (Current year earnings) carries no number, and closes its
// section rather than leading it.
const computedLast = (a: Account) => (a.id.startsWith('computed:') ? 1 : 0)
export const byAccountNumber = (a: Account, b: Account) =>
  computedLast(a) - computedLast(b) || compareAccountNumbers(a.accountNumber, b.accountNumber) || a.accountName.localeCompare(b.accountName)

const byNumber = byAccountNumber

// Whether an account's figures come from its children rather than from itself.
// Stated as the negative of Posting on purpose: only a posting account holds a
// figure of its own, so anything else sums what is under it and an empty parent
// reports zero rather than surfacing a stale stored amount.
const rollsUp = (a: Account) => a.glAccountType !== 'Posting'

// Cached on the identity of the array handed in. Callers pass either the store's
// accounts or the period-scoped array, both of which are identity-stable for as
// long as their inputs are, so the whole index is built once per distinct chart.
const indexCache = new WeakMap<Account[], ChartIndex>()

export function buildChartIndex(accounts: Account[]): ChartIndex {
  const hit = indexCache.get(accounts)
  if (hit) return hit
  const built = computeChartIndex(accounts)
  indexCache.set(accounts, built)
  return built
}

function computeChartIndex(accounts: Account[]): ChartIndex {
  const byId = new Map<string, Account>()
  for (const a of accounts) byId.set(a.id, a)

  const children = new Map<string, Account[]>()
  const roots: Account[] = []
  const unreachable: string[] = []

  for (const a of accounts) {
    const parentId = a.parentId ?? null
    if (parentId === null || parentId === a.id || !byId.has(parentId)) {
      // A parent that is not here, or is the account itself, is a broken link.
      // The row still has to be reachable or nobody could find it to repair it,
      // so it renders at the top and is reported.
      if (parentId !== null) unreachable.push(a.id)
      roots.push(a)
      continue
    }
    const kids = children.get(parentId)
    if (kids) kids.push(a)
    else children.set(parentId, [a])
  }
  roots.sort(byNumber)
  for (const kids of children.values()) kids.sort(byNumber)

  // Breadth-first down from the roots, never upward from a node. `parentId` is
  // editable, so a loop is reachable rather than theoretical; walking down can
  // only ever visit what is genuinely attached to the top, which makes
  // termination structural instead of a depth guard. A loop is simply never
  // entered, and its members fall out as unreachable below.
  const visitOrder: Account[] = []
  const depth = new Map<string, number>()
  let frontier = roots
  let level = 0
  while (frontier.length) {
    const next: Account[] = []
    for (const a of frontier) {
      depth.set(a.id, level)
      visitOrder.push(a)
      const kids = children.get(a.id)
      if (kids) next.push(...kids)
    }
    frontier = next
    level++
  }
  if (visitOrder.length !== accounts.length) {
    const reached = new Set(visitOrder.map(a => a.id))
    for (const a of accounts) if (!reached.has(a.id)) unreachable.push(a.id)
  }

  // Reverse visit order is reverse topological order: breadth-first puts a
  // parent before all of its descendants, so walking back from the end
  // guarantees every child is already summed when its parent is reached.
  //
  // Every child is summed, whatever its status. A deactivated account's balance
  // still belongs to its parent's total (decision 31). So does an archived one's,
  // for the period it was archived in: it opened that period with a balance, and
  // the move that emptied it is a posting of that period. The module review
  // (2026-10-06, COA-22) offered two cures for a parent whose opening sat above
  // the children it showed - leave the archived account out, or show it - and
  // leaving it out was tried first. The retest (2026-10-07) found the cost:
  // archiving 11540 Employee Advances took $4,274 off the Asset opening, and the
  // chart no longer agreed with the General ledger, which still lists 11540 for
  // October. So the account stays in the total, and the listing shows it for any
  // period it still has figures in (components/Filters, `offTheListing`). In the
  // periods after, it holds nothing and adds nothing.
  const figures = new Map<string, ChartFigures>()
  for (let i = visitOrder.length - 1; i >= 0; i--) {
    const a = visitOrder[i]
    if (!rollsUp(a)) {
      figures.set(a.id, { balance: a.balance, netChange: a.netChange ?? 0, current: a.currentBalance ?? a.balance })
      continue
    }
    let balance = 0
    let netChange = 0
    let current = 0
    for (const kid of children.get(a.id) ?? []) {
      const f = figures.get(kid.id) ?? ZERO
      balance += f.balance
      netChange += f.netChange
      current += f.current
    }
    figures.set(a.id, { balance, netChange, current })
  }

  const descendantCache = new Map<string, Account[]>()
  const ancestorCache = new Map<string, Account[]>()

  return {
    byId,
    children,
    roots,
    unreachable,
    parentOf: id => {
      const parentId = byId.get(id)?.parentId
      return parentId ? byId.get(parentId) : undefined
    },
    childrenOf: id => children.get(id) ?? [],
    depthOf: id => depth.get(id) ?? 0,
    figuresOf: id => figures.get(id) ?? ZERO,
    descendantsOf: id => {
      const hit = descendantCache.get(id)
      if (hit) return hit
      const out: Account[] = []
      const seen = new Set<string>([id])
      const stack = [...(children.get(id) ?? [])].reverse()
      while (stack.length) {
        const a = stack.pop()!
        if (seen.has(a.id)) continue
        seen.add(a.id)
        out.push(a)
        const kids = children.get(a.id)
        if (kids) for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i])
      }
      descendantCache.set(id, out)
      return out
    },
    ancestorsOf: id => {
      const hit = ancestorCache.get(id)
      if (hit) return hit
      const out: Account[] = []
      const seen = new Set<string>([id])
      let current = byId.get(id)
      while (current) {
        const parentId = current.parentId
        if (!parentId || seen.has(parentId)) break
        const parent = byId.get(parentId)
        if (!parent) break
        out.push(parent)
        seen.add(parentId)
        current = parent
      }
      ancestorCache.set(id, out)
      return out
    },
  }
}

/**
 * The accounts something may name as its parent: a Summary of the same category,
 * still on the chart, and never itself or anything already beneath it.
 *
 * Offering only these is what makes BR-003 and cycle-freedom hold by
 * construction. The picker and the validator read this one rule, so a parent the
 * user can choose is never a parent the save will reject.
 */
export function eligibleParents(accounts: Account[], accountType: AccountType, exceptId?: string): Account[] {
  const index = buildChartIndex(accounts)
  const closed = exceptId
    ? new Set([exceptId, ...index.descendantsOf(exceptId).map(d => d.id)])
    : undefined
  return accounts
    .filter(a =>
      a.glAccountType === 'Summary' &&
      a.accountType === accountType &&
      a.status !== 'Archived' &&
      !closed?.has(a.id))
    .sort(byNumber)
}

/**
 * How the account classifies below its category: the summary accounts it sits
 * under, outermost first. A current asset held as cash reads `Current Assets`,
 * `Cash and Cash Equivalents`.
 *
 * Derived, never stored. The account already states this by where it sits, so
 * asking for it again on create would only add a second field that can drift out
 * of step with the nesting.
 *
 * The outermost ancestor is left out: it is the category's own anchor - `ASSETS`
 * over every asset - and whatever shows this path leads with the category, so
 * including it would print the same thing twice.
 */
export function classificationTrail(index: ChartIndex, id: string): Account[] {
  return index.ancestorsOf(id).filter(a => a.parentId !== null).reverse()
}

/** Sum of the given accounts' rolled figures. Pass roots or siblings only:
 *  passing a parent and its own child would count that child twice. */
export function sumFigures(index: ChartIndex, accounts: Account[]): ChartFigures {
  let balance = 0
  let netChange = 0
  let current = 0
  for (const a of accounts) {
    const f = index.figuresOf(a.id)
    balance += f.balance
    netChange += f.netChange
    current += f.current
  }
  return { balance, netChange, current }
}
