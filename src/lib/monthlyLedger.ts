import type { Account, Period, Transaction } from '../types'

// =========================
// Monthly ledger (pure, derived - no store, no mutation).
//
// Every posting account has, for each accounting month: an opening balance
// (carried from the prior month's closing), a net movement, and a closing
// balance. The first month's opening is the account's fiscal-year opening
// (seedQ1Openings), and closing = opening + movement, so the last month's
// closing reconciles to the hand-authored Account.balance. A month is "locked"
// when its Period is Soft-Closed or Hard-Locked.
//
// The daily running balance is the same arithmetic at transaction grain: a
// single continuous curve starting at the fiscal-year opening, moved by each
// posting's normal-side delta. Within any month it runs from that month's
// opening to its closing.
//
// All figures are signed on the side the account's CATEGORY is naturally
// carried (assets and expenses → debit − credit; liabilities, equity and
// revenue → credit − debit), which is the side Account.balance and
// Account.netChange are already authored on. A contra account is carried on the
// opposite side to its category, so it reads negative and grows more negative
// as it grows - an allowance of -22,232 is a bigger allowance than one of
// -18,500, and a deduction is what a contra account is.
// =========================

// The delta a single posting applies to its account's balance.
//
// A contra account's `normalBalance` is deliberately the flip of its category's
// (deriveNormalBalance in store.ts), so signing by it alone would walk the
// account the wrong way: every credit to an allowance for doubtful accounts
// would carry it *toward* zero while the allowance was in fact being built up.
// Negating it for a contra puts every figure back on its category's axis, which
// is where the balance the chart publishes for it already sits.
export function normalSideDelta(
  account: Pick<Account, 'normalBalance' | 'isContra'>,
  t: Pick<Transaction, 'debit' | 'credit'>,
): number {
  const onOwnSide = account.normalBalance === 'Debit' ? t.debit - t.credit : t.credit - t.debit
  return account.isContra ? -onOwnSide : onOwnSide
}

export interface MonthlyBalance {
  period: Period
  opening: number
  movement: number
  closing: number
  // Frozen once the period is Soft-Closed or Hard-Locked - no further postings
  // can change opening/closing.
  locked: boolean
  txCount: number
}

// One MonthlyBalance per period, in date order, for a single account. Periods
// are sorted by start date; each opening chains from the prior closing.
export function monthlyBalances(
  account: Account,
  transactions: Transaction[],
  seededOpening: number,
  periods: Period[],
): MonthlyBalance[] {
  const own = transactions.filter(t => t.accountId === account.id)
  const ordered = [...periods].sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
  const out: MonthlyBalance[] = []
  let opening = seededOpening
  for (const period of ordered) {
    let movement = 0
    let txCount = 0
    for (const t of own) {
      const day = t.date.slice(0, 10)
      if (day < period.startDate || day > period.endDate) continue
      movement += normalSideDelta(account, t)
      txCount++
    }
    const closing = opening + movement
    out.push({ period, opening, movement, closing, locked: period.status !== 'Open', txCount })
    opening = closing
  }
  return out
}

// Rows up to and including the period containing `asOf`, with that last period
// flagged provisional. A month still accruing has no final closing balance yet,
// and months that haven't started shouldn't be charted at all - they'd draw as a
// flat carry-forward of the current balance and read as real history.
//
// When `asOf` falls outside every period the rows are returned untouched with no
// provisional flag, so a chart never blanks on an out-of-range date.
export function monthlyBalancesThrough(
  account: Account,
  transactions: Transaction[],
  seededOpening: number,
  periods: Period[],
  asOf: string,
): { rows: MonthlyBalance[]; provisionalPeriodId: string | null } {
  const rows = monthlyBalances(account, transactions, seededOpening, periods)
  const day = asOf.slice(0, 10)
  const idx = rows.findIndex(m => day >= m.period.startDate && day <= m.period.endDate)
  if (idx === -1) return { rows, provisionalPeriodId: null }
  const through = rows.slice(0, idx + 1)
  const current = through[idx].period
  return { rows: through, provisionalPeriodId: current.status === 'Open' ? current.id : null }
}

// The MonthlyBalance for the period containing `asOf` (an ISO date/day), or the
// undefined when the date sits outside every period.
export function monthlyBalanceAsOf(
  account: Account,
  transactions: Transaction[],
  seededOpening: number,
  periods: Period[],
  asOf: string,
): MonthlyBalance | undefined {
  const day = asOf.slice(0, 10)
  return monthlyBalances(account, transactions, seededOpening, periods)
    .find(m => day >= m.period.startDate && day <= m.period.endDate)
}

/**
 * The last accounting month that has fully run its course as of `today`, or
 * undefined before any has. Read on 7 August this is July.
 *
 * Deliberately "ended", not "closed". A performance figure over the month in
 * progress compares half a month of revenue against half a month of cost, so the
 * one worth showing is the last whole one - but gating on the period's close
 * status instead would report June all through August whenever the close is a few
 * days behind, which reads as the figure being stale rather than as the books
 * being open.
 */
export function lastEndedPeriod(periods: Period[], today: string): Period | undefined {
  const day = today.slice(0, 10)
  return [...periods]
    .filter(p => p.endDate < day)
    .sort((a, b) => (a.endDate < b.endDate ? -1 : 1))
    .pop()
}

/* Posting order: the one order the ledger is read in, oldest first.
   Date decides it, and the entry number settles a day that holds more than one
   entry - numbers being issued in date order (see lib/seed), so the two can
   never disagree and there is no second answer to give. Every register that
   sorts by date is therefore also sorting by posting order, and a running
   balance computed in this order matches the order the rows are printed in.

   Back-dating an entry stays legal: the app posts prior-period adjustments on
   purpose, with a reason attached. Such an entry takes a number issued after
   the ones it now sits behind, and this comparator puts it where its date says
   it belongs rather than where its number was drawn. */
export function comparePostingOrder(
  a: Pick<Transaction, 'date' | 'jeNumber'>,
  b: Pick<Transaction, 'date' | 'jeNumber'>,
): number {
  const da = a.date.slice(0, 10)
  const db = b.date.slice(0, 10)
  if (da !== db) return da < db ? -1 : 1
  return a.jeNumber.localeCompare(b.jeNumber, 'en', { numeric: true, sensitivity: 'base' })
}

export interface RunningBalancePoint {
  transaction: Transaction
  delta: number          // normal-side delta this posting applied
  runningBalance: number // normal-side balance immediately after this posting
}

// The continuous daily running balance for one account: transactions in posting
// order, each carrying the balance immediately after it posts, anchored at the
// fiscal-year opening.
export function runningBalanceLedger(
  account: Account,
  transactions: Transaction[],
  seededOpening: number,
): RunningBalancePoint[] {
  const own = transactions
    .filter(t => t.accountId === account.id)
    .map((t, i) => ({ t, i }))
    .sort((a, b) => comparePostingOrder(a.t, b.t) || a.i - b.i)
  let running = seededOpening
  return own.map(({ t }) => {
    const delta = normalSideDelta(account, t)
    running += delta
    return { transaction: t, delta, runningBalance: running }
  })
}
