import type { Account, FiscalYearNaming, JournalEntry, Period, PeriodBalanceSnapshot, QuarterId, Transaction } from '../types'
import { ACCOUNT_TYPE_META } from '../types'
import { uid } from './utils'
import { normalSideDelta } from './monthlyLedger'

/* A month locks when it ends. Mahad, 2026-10-11: *"When a month ends, lock it
   and label it 'Locked'. Don't let anyone post an entry dated in a locked
   month."* Read wherever the periods arrive - the seed, and a save read back on a
   later day - so a month that ended since is locked by the time anyone can post. */
export function lockEndedPeriods(periods: Period[], today: string): Period[] {
  const day = today.slice(0, 10)
  let changed = false
  const out = periods.map(p => {
    if (p.endDate >= day || p.status === 'Hard-Locked') return p
    changed = true
    return { ...p, status: 'Hard-Locked' as const }
  })
  return changed ? out : periods
}

// =========================
// Period-close engine (pure). No store import - mirrors coaViews / guidedSetup.
//
// The model in one paragraph: a quarter is a group of three consecutive monthly
// periods, derived from company.fiscalYearStart (Q1 = the first three months).
// Each posting account's closing for a quarter is `opening + movement`, where
// movement is the normal-side net of that account's postings inside the quarter
// and opening is the prior quarter's closing (or the fiscal-year opening for
// Q1). Balance-sheet closings carry forward as the next period's opening;
// income/expense accounts run cumulatively through the year and are zeroed only
// at year-end, when net profit sweeps into Retained Earnings.
// =========================

export const QUARTERS: QuarterId[] = ['Q1', 'Q2', 'Q3', 'Q4']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Balanced-entry tolerance, matching journalEntry.ts.
const EPS = 0.005

// The fiscal year an ISO date falls in, given the fiscal-year start date. A date
// in a month at or after the start month belongs to that calendar year's FY;
// earlier months belong to the previous FY. With a Jan-1 start this is just the
// calendar year.
export function fiscalYearOf(iso: string, fiscalYearStart: string): number {
  const startMonth = Number(fiscalYearStart.slice(5, 7)) - 1
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7)) - 1
  return month >= startMonth ? year : year - 1
}

// The one name a fiscal year carries everywhere it is shown - period labels,
// report titles and every period dropdown. `fiscalYearOf` answers *which* fiscal
// year; this answers what to call it. A company whose year spans two calendar
// years may name it after either end, so the label is a setting rather than a
// derivation, and the two conventions coincide on a January start. Defined in one
// place so the FY prefix cannot drift between the surfaces that print it.
export function fiscalYearName(
  fiscalYear: number,
  fiscalYearStart: string,
  naming: FiscalYearNaming = 'start',
): string {
  const spansTwoYears = fiscalYearStart.slice(5, 7) !== '01'
  return `FY${naming === 'end' && spansTwoYears ? fiscalYear + 1 : fiscalYear}`
}

// The accounting period a date sits in, described for display. The Chart of
// Accounts listing states this above the table: every figure in it is read
// against a period, and without naming one the reader can't tell what "balance"
// means. Returns null when the date falls outside every defined period, so the
// caller can render nothing rather than assert a period that doesn't exist.
export interface CurrentPeriodDescription {
  period: Period
  fiscalYear: number
  label: string   // "Jul FY2026"
  range: string   // "Jul 1 - Jul 31"
}

export function describeCurrentPeriod(
  periods: Period[],
  fiscalYearStart: string,
  asOf: string,
  naming: FiscalYearNaming = 'start',
): CurrentPeriodDescription | null {
  const day = asOf.slice(0, 10)
  const period = periods.find(p => day >= p.startDate && day <= p.endDate)
  if (!period) return null
  const fiscalYear = fiscalYearOf(period.startDate, fiscalYearStart)
  // Month and day only: the fiscal year is already stated in the label, so
  // repeating the calendar year on both ends of the range only adds noise.
  const monthDay = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
  return {
    period,
    fiscalYear,
    label: `${MONTHS[Number(period.startDate.slice(5, 7)) - 1]} ${fiscalYearName(fiscalYear, fiscalYearStart, naming)}`,
    range: `${monthDay(period.startDate)} - ${monthDay(period.endDate)}`,
  }
}

// The zero-based quarter index a month falls in relative to the fiscal-year
// start (0 = Q1). Months are counted forward from the start month, wrapping.
function quarterIndexOfMonth(month: number, startMonth: number): number {
  return Math.floor(((month - startMonth + 12) % 12) / 3)
}

// The monthly periods that make up one quarter of one fiscal year, in date order.
export function periodsForQuarter(
  periods: Period[],
  fiscalYear: number,
  quarter: QuarterId,
  fiscalYearStart: string,
): Period[] {
  const startMonth = Number(fiscalYearStart.slice(5, 7)) - 1
  const idx = QUARTERS.indexOf(quarter)
  return periods
    .filter(p => {
      if (fiscalYearOf(p.startDate, fiscalYearStart) !== fiscalYear) return false
      const month = Number(p.startDate.slice(5, 7)) - 1
      return quarterIndexOfMonth(month, startMonth) === idx
    })
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
}

// The [startDate, endDate] span a quarter covers, or null when the quarter has
// no periods defined.
export function quarterDateRange(
  periods: Period[],
  fiscalYear: number,
  quarter: QuarterId,
  fiscalYearStart: string,
): { startDate: string; endDate: string } | null {
  const ps = periodsForQuarter(periods, fiscalYear, quarter, fiscalYearStart)
  if (!ps.length) return null
  return { startDate: ps[0].startDate, endDate: ps[ps.length - 1].endDate }
}

// The normal-side net movement of one account's postings inside a date span,
// signed by normalSideDelta so this and the monthly ledger cannot answer
// differently. Contra accounts net negative, matching the netChange convention
// in fullChart.ts.
export function movementForAccount(
  account: Account,
  transactions: Transaction[],
  range: { startDate: string; endDate: string },
): number {
  let sum = 0
  for (const t of transactions) {
    if (t.accountId !== account.id) continue
    const day = t.date.slice(0, 10)
    if (day < range.startDate || day > range.endDate) continue
    sum += normalSideDelta(account, t)
  }
  return sum
}

// The opening balance for an account at the start of a quarter. Prefers the
// prior quarter's finalized snapshot closing; for Q1 prefers a carried-forward
// opening snapshot from the previous year's year-end close. Falls back to the
// seeded fiscal-year opening plus the net movement of any earlier quarters -
// which is what lets the engine close Q2 even though the seed marks Q1 locked
// without ever writing a Q1 snapshot.
export function openingForAccount(
  account: Account,
  transactions: Transaction[],
  priorSnapshots: PeriodBalanceSnapshot[],
  seededOpenings: Record<string, number>,
  periods: Period[],
  fiscalYear: number,
  quarter: QuarterId,
  fiscalYearStart: string,
): number {
  const idx = QUARTERS.indexOf(quarter)
  if (idx > 0) {
    const prev = priorSnapshots.find(
      s => s.fiscalYear === fiscalYear && s.quarter === QUARTERS[idx - 1] && s.accountId === account.id,
    )
    if (prev) return prev.closing
  } else {
    const carried = priorSnapshots.find(
      s => s.fiscalYear === fiscalYear && s.quarter === 'Q1' && s.accountId === account.id && !s.final,
    )
    if (carried) return carried.opening
  }
  let opening = seededOpenings[account.id] ?? 0
  for (let i = 0; i < idx; i++) {
    const range = quarterDateRange(periods, fiscalYear, QUARTERS[i], fiscalYearStart)
    if (range) opening += movementForAccount(account, transactions, range)
  }
  return opening
}

// One finalized snapshot per posting account for a quarter close.
export function buildQuarterSnapshots(
  accounts: Account[],
  transactions: Transaction[],
  priorSnapshots: PeriodBalanceSnapshot[],
  seededOpenings: Record<string, number>,
  periods: Period[],
  fiscalYear: number,
  quarter: QuarterId,
  fiscalYearStart: string,
): PeriodBalanceSnapshot[] {
  const range = quarterDateRange(periods, fiscalYear, quarter, fiscalYearStart)
  if (!range) return []
  const closedAt = new Date().toISOString()
  return accounts
    .filter(a => a.isPosting)
    .map(a => {
      const opening = openingForAccount(a, transactions, priorSnapshots, seededOpenings, periods, fiscalYear, quarter, fiscalYearStart)
      const movement = movementForAccount(a, transactions, range)
      return {
        id: uid('snap'),
        fiscalYear,
        quarter,
        accountId: a.id,
        opening,
        movement,
        closing: opening + movement,
        statement: ACCOUNT_TYPE_META[a.accountType].statement,
        final: true,
        closedAt,
      }
    })
}

// Refuse to close a quarter until every earlier quarter of the same fiscal year
// is fully hard-locked. Q1 has no predecessor and always passes.
export function quarterCloseGuard(
  periods: Period[],
  fiscalYear: number,
  quarter: QuarterId,
  fiscalYearStart: string,
): string | null {
  const idx = QUARTERS.indexOf(quarter)
  for (let i = 0; i < idx; i++) {
    const q = QUARTERS[i]
    const ps = periodsForQuarter(periods, fiscalYear, q, fiscalYearStart)
    if (!ps.length || ps.some(p => p.status !== 'Hard-Locked')) {
      return `${q} must be closed before you can close ${quarter}.`
    }
  }
  return null
}

// Refuse to close the year until Q4 is fully hard-locked (which, via the
// quarter guard, transitively requires Q1–Q3 first).
export function yearCloseGuard(
  periods: Period[],
  fiscalYear: number,
  fiscalYearStart: string,
): string | null {
  const q4 = periodsForQuarter(periods, fiscalYear, 'Q4', fiscalYearStart)
  if (!q4.length || q4.some(p => p.status !== 'Hard-Locked')) {
    return 'Q4 must be closed before you can close the fiscal year.'
  }
  return null
}

// The net income to sweep into Retained Earnings. A snapshot's `closing` is
// normal-side signed, but income-statement math needs revenue as a credit total
// and expense as a debit total regardless of whether the account is a contra
// (a contra-revenue reduces revenue, a contra-expense reduces expense). We
// convert each closing to its natural income-statement side so `net` matches
// the imbalance the year-end closing entry actually posts.
export function retainedEarningsSweep(
  accounts: Account[],
  q4Snapshots: PeriodBalanceSnapshot[],
): { net: number; revenueTotal: number; expenseTotal: number } {
  const acctById = new Map(accounts.map(a => [a.id, a]))
  let revenueTotal = 0
  let expenseTotal = 0
  for (const s of q4Snapshots) {
    const a = acctById.get(s.accountId)
    if (!a) continue
    if (a.accountType === 'REV') revenueTotal += a.normalBalance === 'Credit' ? s.closing : -s.closing
    else if (a.accountType === 'EXP') expenseTotal += a.normalBalance === 'Debit' ? s.closing : -s.closing
  }
  return { net: revenueTotal - expenseTotal, revenueTotal, expenseTotal }
}

// Turn a set of journal lines into ledger postings for a synthesised entry
// (year-end close, opening balance). runningBalance isn't meaningful for a
// system-generated entry, so it's left at zero.
function linesToTransactions(
  lines: { accountId: string; debit: number; credit: number }[],
  meta: { date: string; source: string; jeNumber: string; reference: string; entryType: 'Opening' | 'Closing'; periodLabel: string; description: string },
): Transaction[] {
  return lines.map(l => ({
    id: uid('tx'),
    accountId: l.accountId,
    date: meta.date,
    source: meta.source,
    jeNumber: meta.jeNumber,
    reference: meta.reference,
    entryType: meta.entryType,
    description: meta.description,
    debit: l.debit,
    credit: l.credit,
    runningBalance: 0,
    dimensionValues: [],
    period: meta.periodLabel,
  }))
}

// The year-end closing entry: one line per revenue/expense account that zeroes
// its balance, plus one balancing Retained Earnings line. Dated Dec 31 of the
// fiscal year. Guaranteed balanced - the RE line is computed to offset the exact
// imbalance of the zeroing lines. `net` is the amount swept to RE (positive =
// profit credited).
export function buildYearEndClosingEntry(
  accounts: Account[],
  q4Snapshots: PeriodBalanceSnapshot[],
  retainedEarningsId: string,
  fiscalYear: number,
): { entry: JournalEntry; transactions: Transaction[]; net: number } {
  const acctById = new Map(accounts.map(a => [a.id, a]))
  const lines: { accountId: string; debit: number; credit: number }[] = []
  let totalDebit = 0
  let totalCredit = 0

  for (const s of q4Snapshots) {
    const a = acctById.get(s.accountId)
    if (!a || !a.isPosting) continue
    if (a.accountType !== 'REV' && a.accountType !== 'EXP') continue
    const amount = s.closing
    if (Math.abs(amount) < EPS) continue
    // Zero the account by posting the opposite of its balance. A credit-normal
    // (revenue) balance is cleared with a debit; a debit-normal (expense)
    // balance with a credit. Negative balances flip the side.
    let debit = 0
    let credit = 0
    if (a.normalBalance === 'Credit') {
      if (amount >= 0) debit = amount
      else credit = -amount
    } else {
      if (amount >= 0) credit = amount
      else debit = -amount
    }
    lines.push({ accountId: s.accountId, debit, credit })
    totalDebit += debit
    totalCredit += credit
  }

  const imbalance = totalDebit - totalCredit
  if (imbalance >= 0) lines.push({ accountId: retainedEarningsId, debit: 0, credit: imbalance })
  else lines.push({ accountId: retainedEarningsId, debit: -imbalance, credit: 0 })

  const date = `${fiscalYear}-12-31`
  const reference = `CLOSE-${fiscalYear}`
  const entry: JournalEntry = {
    id: uid('je'),
    date,
    reference,
    description: `Year-end close ${fiscalYear}`,
    status: 'Posted',
    lines,
  }
  const transactions = linesToTransactions(lines, {
    date,
    source: 'Manual JE',
    jeNumber: reference,
    reference,
    entryType: 'Closing',
    periodLabel: `Dec ${fiscalYear}`,
    description: `Year-end close ${fiscalYear}`,
  })
  return { entry, transactions, net: imbalance }
}

// The next fiscal year's Q1 opening snapshots: balance-sheet closings carry
// forward as openings (Retained Earnings additionally absorbs the year's net),
// income/expense accounts open at zero. Provisional (final: false).
export function nextYearOpeningSnapshots(
  accounts: Account[],
  q4Snapshots: PeriodBalanceSnapshot[],
  retainedEarningsId: string,
  net: number,
  nextFiscalYear: number,
): PeriodBalanceSnapshot[] {
  const acctById = new Map(accounts.map(a => [a.id, a]))
  const out: PeriodBalanceSnapshot[] = []
  for (const s of q4Snapshots) {
    const a = acctById.get(s.accountId)
    if (!a || !a.isPosting) continue
    const statement = ACCOUNT_TYPE_META[a.accountType].statement
    let opening: number
    if (statement === 'Income Statement') opening = 0
    else if (a.id === retainedEarningsId) opening = s.closing + net
    else opening = s.closing
    out.push({
      id: uid('snap'),
      fiscalYear: nextFiscalYear,
      quarter: 'Q1',
      accountId: a.id,
      opening,
      movement: 0,
      closing: opening,
      statement,
      final: false,
    })
  }
  return out
}

// Twelve fresh monthly Open periods for a fiscal year, running from its start
// month. A year that starts mid-calendar rolls into the next one, so each period
// is identified and labelled by the calendar year its own month falls in: ids
// stay unique across fiscal years, and a label never claims the wrong year.
// Month-end is leap-aware via Date.UTC.
export function buildFiscalYearPeriods(fiscalYear: number, startMonth = 0): Period[] {
  const out: Period[] = []
  for (let i = 0; i < 12; i++) {
    const m = (startMonth + i) % 12
    const year = fiscalYear + Math.floor((startMonth + i) / 12)
    const mm = String(m + 1).padStart(2, '0')
    const lastDay = new Date(Date.UTC(year, m + 1, 0)).getUTCDate()
    out.push({
      id: `p_${year}_${mm}`,
      label: `${MONTHS[m]} ${year}`,
      startDate: `${year}-${mm}-01`,
      endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
      status: 'Open',
    })
  }
  return out
}

// Every monthly period from the first year of books through the year containing
// today. A transaction can only be posted into a period that exists, so choosing
// an earlier first year has to build the years between it and now as well -
// otherwise imported history lands somewhere postable but today does not.
// A first year still ahead of today builds that one year on its own.
export function buildPeriodsFromFirstYear(fiscalYearStart: string, today: string): Period[] {
  const firstFiscalYear = Number(fiscalYearStart.slice(0, 4))
  const startMonth = Number(fiscalYearStart.slice(5, 7)) - 1
  const last = Math.max(firstFiscalYear, fiscalYearOf(today.slice(0, 10), fiscalYearStart))
  const out: Period[] = []
  for (let fy = firstFiscalYear; fy <= last; fy++) out.push(...buildFiscalYearPeriods(fy, startMonth))
  return out
}

// Reaching the books further back. Unlike a rebuild this is safe after postings:
// the months it adds all sit before the ones already there, so nothing recorded
// moves. Periods already held are returned untouched, close status and all, which
// is why this filters rather than rebuilding the whole range. The start month
// comes from what is saved, never from the caller: a different shape at the front
// would split one set of books into two calendars.
export function periodsWithEarlierYears(
  periods: Period[], fiscalYearStart: string, firstYear: number, today: string,
): Period[] {
  if (firstYear >= Number(fiscalYearStart.slice(0, 4))) return periods
  const held = new Set(periods.map(p => p.id))
  const iso = `${firstYear}-${fiscalYearStart.slice(5)}`
  return [...buildPeriodsFromFirstYear(iso, today).filter(p => !held.has(p.id)), ...periods]
}

// Whether anything has been posted into a period. Read from the transaction
// dates rather than from Transaction.period, which is a display label; the date
// is what decides the period a posting belongs to (see journalEntry.ts).
export function periodHasPostings(period: Period, transactions: Transaction[]): boolean {
  return transactions.some(t => t.date >= period.startDate && t.date <= period.endDate)
}

// The gate on changing the fiscal calendar. Once a period holds a posting, its
// dates cannot move without shifting recorded history, so the whole shape is
// frozen rather than only the period that filled up.
export function anyPeriodHasPostings(periods: Period[], transactions: Transaction[]): boolean {
  return periods.some(p => periodHasPostings(p, transactions))
}

// A one-time opening entry that brings an account set's opening balances in
// against Opening Balance Equity. Exposed for the later onboarding module - the
// standing seed derives its opening arithmetically instead (see seedQ1Openings).
export function buildOpeningEntry(
  accounts: Account[],
  openings: Record<string, number>,
  openingBalanceEquityId: string,
  date: string,
  periodLabel: string,
): { entry: JournalEntry; transactions: Transaction[] } {
  const acctById = new Map(accounts.map(a => [a.id, a]))
  const lines: { accountId: string; debit: number; credit: number }[] = []
  let totalDebit = 0
  let totalCredit = 0

  for (const [accountId, amount] of Object.entries(openings)) {
    if (accountId === openingBalanceEquityId) continue
    const a = acctById.get(accountId)
    if (!a || !a.isPosting || Math.abs(amount) < EPS) continue
    let debit = 0
    let credit = 0
    if (a.normalBalance === 'Debit') {
      if (amount >= 0) debit = amount
      else credit = -amount
    } else {
      if (amount >= 0) credit = amount
      else debit = -amount
    }
    lines.push({ accountId, debit, credit })
    totalDebit += debit
    totalCredit += credit
  }

  const imbalance = totalDebit - totalCredit
  if (imbalance >= 0) lines.push({ accountId: openingBalanceEquityId, debit: 0, credit: imbalance })
  else lines.push({ accountId: openingBalanceEquityId, debit: -imbalance, credit: 0 })

  const reference = 'OPENING'
  const entry: JournalEntry = {
    id: uid('je'),
    date,
    reference,
    description: 'Opening balances',
    status: 'Posted',
    lines,
  }
  const transactions = linesToTransactions(lines, {
    date,
    source: 'Manual JE',
    jeNumber: reference,
    reference,
    entryType: 'Opening',
    periodLabel,
    description: 'Opening balances',
  })
  return { entry, transactions }
}
