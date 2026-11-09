import { isCategoryRoot, type Account, type Transaction } from '../types'

/* ──────────────────────────────────────────────────────────────────
 * CURRENT YEAR EARNINGS
 *
 * The year's profit so far, revenue less expenses, under Equity. An account
 * like any other: it has a number, a role, an audit trail and a page, it is
 * counted, selected and exported with the rest, and a journal entry can pick it.
 * Mahad, 2026-10-10: *"Current year earnings should exist like any other
 * account."* It had been a line the listing drew and the store never held
 * (decision 57; module review, 2026-10-06, COA-05).
 *
 * What it does not have is an authored figure. Its balance is what is posted to
 * it, like any account's, plus revenue less expenses - worked out wherever the
 * chart is read (`withEarningsFigures`, applied as the chart is scoped to the
 * period), so it can never state a profit the ledger does not hold. At the
 * year-end close the year's net income moves into Retained System Earnings, the
 * revenue and expense accounts close to nothing, and so does this.
 *
 * Without it the balance sheet left the year's profit out of equity, and assets
 * did not equal liabilities plus equity once revenue and expense posted.
 * ────────────────────────────────────────────────────────────────── */

export const CURRENT_YEAR_EARNINGS_NAME = 'Current Year Earnings'
export const CURRENT_YEAR_EARNINGS_HELP =
  'Revenue less expenses for the year to date, worked out from what is posted to them. At the year-end close it moves into retained earnings.'

/** The chart's one Current Year Earnings account, found by its role. */
export const isCurrentYearEarnings = (a: Pick<Account, 'accountRole'>): boolean =>
  a.accountRole === 'Current Year Earnings'

const plSign = (a: Pick<Account, 'accountType'>) => (a.accountType === 'REV' ? 1 : a.accountType === 'EXP' ? -1 : 0)

/** Revenue less expenses on these accounts, as a balance and as the period's movement. */
export function currentYearEarnings(accounts: Account[]): { balance: number; netChange: number } {
  let balance = 0
  let netChange = 0
  for (const a of accounts) {
    // Archived accounts too, as the category totals count them (lib/chartTree):
    // one archived this year earned what it earned, and its move added nothing.
    if (!a.isPosting) continue
    const sign = plSign(a)
    if (!sign) continue
    balance += sign * (a.balance || 0)
    netChange += sign * (a.netChange ?? 0)
  }
  return { balance, netChange }
}

/** The chart with the earnings account's figures worked out: what is posted to
 *  it, plus revenue less expenses over the same accounts. Read off the chart it
 *  is given, so a period-scoped chart gives a period-scoped figure. */
export function withEarningsFigures(accounts: Account[]): Account[] {
  const at = accounts.findIndex(isCurrentYearEarnings)
  if (at < 0) return accounts
  const { balance, netChange } = currentYearEarnings(accounts)
  if (!balance && !netChange) return accounts
  const a = accounts[at]
  const out = accounts.slice()
  out[at] = { ...a, balance: (a.balance || 0) + balance, netChange: (a.netChange ?? 0) + netChange }
  return out
}

/** The postings that move the earnings account: its own, and every one on a
 *  revenue or expense account, read as landing on it. Its page reads these as
 *  its activity, so its running balance, trends and count come to the figure
 *  the chart states - a revenue credit raises it and an expense debit lowers
 *  it, on its own credit side. */
export function earningsPostings(account: Account, accounts: Account[], transactions: Transaction[]): Transaction[] {
  const pl = new Set(accounts.filter(a => a.isPosting && plSign(a)).map(a => a.id))
  return transactions
    .filter(t => t.accountId === account.id || pl.has(t.accountId))
    .map(t => (t.accountId === account.id ? t : { ...t, accountId: account.id }))
}

/** The opening the earnings account starts the year on: revenue less expenses
 *  of the openings the revenue and expense accounts start on. */
export function earningsOpening(accounts: Account[], openings: Record<string, number>): number {
  let out = 0
  for (const a of accounts) if (a.isPosting) out += plSign(a) * (openings[a.id] ?? 0)
  return out
}

/** The Equity root a chart that has no earnings account yet should add one
 *  under, or undefined when it has one or has nothing to work it out from. A
 *  chart with no revenue or expense account has no earnings to state, and an
 *  account under Equity there read as one nobody added (Mahad, 2026-10-08, on a
 *  chart just built from scratch). */
export function earningsAccountHome(accounts: Account[]): Account | undefined {
  if (accounts.some(isCurrentYearEarnings)) return undefined
  if (!accounts.some(a => a.isPosting && plSign(a))) return undefined
  return accounts.find(a => a.accountType === 'EQT' && isCategoryRoot(a))
}
