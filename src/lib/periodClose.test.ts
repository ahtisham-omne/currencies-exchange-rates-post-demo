import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store'
import { seedAccounts, seedTransactions, seedCompany, seedQ1Openings } from './seed'
import { periodPostingBlock } from './journalEntry'
import { todayIso } from './utils'
import {
  anyPeriodHasPostings,
  buildFiscalYearPeriods,
  buildPeriodsFromFirstYear,
  buildYearEndClosingEntry,
  describeCurrentPeriod,
  fiscalYearName,
  fiscalYearOf,
  movementForAccount,
  periodHasPostings,
  periodsForQuarter,
  retainedEarningsSweep,
} from './periodClose'
import type { Account, PeriodBalanceSnapshot, Transaction } from '../types'

const FY_START = '2026-01-01'

// Minimal object builders - the engine only reads a handful of fields, so cast
// the partials rather than spelling out every Account/Transaction property.
const acct = (p: Partial<Account>): Account => p as unknown as Account
const tx = (p: Partial<Transaction>): Transaction => p as unknown as Transaction
const snap = (p: Partial<PeriodBalanceSnapshot>): PeriodBalanceSnapshot => p as unknown as PeriodBalanceSnapshot

// A BS posting account present in the seed, used for carry-forward assertions.
const BS_ACCOUNT = 'acct_11130' // Operating - Chase Bank
const IE_ACCOUNT = 'acct_52110' // Salaries and Wages Expense
const RETAINED_EARNINGS = 'acct_32100'

describe('periodClose - pure helpers', () => {
  const periods = buildFiscalYearPeriods(2026)

  it('groups the fiscal year into calendar quarters (Q1 = Jan–Mar, Q4 = Oct–Dec)', () => {
    const q1 = periodsForQuarter(periods, 2026, 'Q1', FY_START)
    expect(q1.map(p => p.label)).toEqual(['Jan 2026', 'Feb 2026', 'Mar 2026'])

    const q4 = periodsForQuarter(periods, 2026, 'Q4', FY_START)
    expect(q4.map(p => p.label)).toEqual(['Oct 2026', 'Nov 2026', 'Dec 2026'])
    expect(q4[0].startDate).toBe('2026-10-01')
    expect(q4[2].endDate).toBe('2026-12-31')
  })

  // Which fiscal year a date belongs to is arithmetic; what that year is *called*
  // is a company's convention. The two are separate on purpose, so switching the
  // convention retitles labels without regrouping a single posting.
  it('fiscalYearName follows the company convention, and only where it can differ', () => {
    // A year that spans two calendar years can be named after either end.
    expect(fiscalYearName(2026, '2026-07-01')).toBe('FY2026')
    expect(fiscalYearName(2026, '2026-07-01', 'start')).toBe('FY2026')
    expect(fiscalYearName(2026, '2026-07-01', 'end')).toBe('FY2027')

    // A January year ends in December, so both conventions name the same year and
    // the setting cannot make the label wrong.
    expect(fiscalYearName(2026, '2026-01-01', 'start')).toBe('FY2026')
    expect(fiscalYearName(2026, '2026-01-01', 'end')).toBe('FY2026')

    // Naming never moves the year itself: the identity stays the starting year.
    expect(fiscalYearOf('2026-08-13', '2026-07-01')).toBe(2026)
  })

  it('carries the naming convention into the period label', () => {
    const july = buildFiscalYearPeriods(2026, 6)
    expect(describeCurrentPeriod(july, '2026-07-01', '2026-08-13')?.label).toBe('Aug FY2026')
    expect(describeCurrentPeriod(july, '2026-07-01', '2026-08-13', 'end')?.label).toBe('Aug FY2027')
    // A month in the second calendar year still carries its fiscal year's name.
    expect(describeCurrentPeriod(july, '2026-07-01', '2027-02-10', 'end')?.label).toBe('Feb FY2027')
  })

  it('describeCurrentPeriod names the period a date falls in, without repeating the year', () => {
    const mid = describeCurrentPeriod(periods, FY_START, '2026-07-31')
    expect(mid?.period.id).toBe('p_2026_07')
    expect(mid?.label).toBe('Jul FY2026')
    expect(mid?.range).toBe('Jul 1 - Jul 31')
    expect(mid?.fiscalYear).toBe(2026)

    // Status is carried through so the strip can badge a closed period.
    const closed = periods.map(p => (p.id === 'p_2026_04' ? { ...p, status: 'Soft-Closed' as const } : p))
    expect(describeCurrentPeriod(closed, FY_START, '2026-04-15')?.period.status).toBe('Soft-Closed')

    // Outside every period the caller renders nothing rather than assert one.
    expect(describeCurrentPeriod(periods, FY_START, '2027-01-05')).toBeNull()
  })

  it('movementForAccount is normal-side net, and a contra account nets negative', () => {
    const range = { startDate: '2026-01-01', endDate: '2026-03-31' }
    const txns = [
      tx({ accountId: 'a', date: '2026-02-10', debit: 1000, credit: 0 }),
      tx({ accountId: 'a', date: '2026-02-20', debit: 0, credit: 300 }),
      tx({ accountId: 'a', date: '2026-05-01', debit: 999, credit: 0 }), // outside range
      tx({ accountId: 'b', date: '2026-02-10', debit: 500, credit: 0 }),
    ]
    // Debit-normal: Σ(debit − credit) over the range = 1000 − 300 = 700.
    expect(movementForAccount(acct({ id: 'a', normalBalance: 'Debit' }), txns, range)).toBe(700)
    // Credit-normal (same postings): Σ(credit − debit) = 300 − 1000 = −700.
    expect(movementForAccount(acct({ id: 'a', normalBalance: 'Credit' }), txns, range)).toBe(-700)
    // A contra asset (normal balance Credit) accumulating debits nets negative.
    expect(movementForAccount(acct({ id: 'b', normalBalance: 'Credit' }), txns, range)).toBe(-500)
  })

  it('retainedEarningsSweep = Σ revenue closings − Σ expense closings', () => {
    const accounts = [
      acct({ id: 'r1', accountType: 'REV', normalBalance: 'Credit' }),
      acct({ id: 'r2', accountType: 'REV', normalBalance: 'Credit' }),
      acct({ id: 'e1', accountType: 'EXP', normalBalance: 'Debit' }),
      acct({ id: 'x1', accountType: 'AST', normalBalance: 'Debit' }),
    ]
    const q4 = [
      snap({ accountId: 'r1', closing: 1000 }),
      snap({ accountId: 'r2', closing: 500 }),
      snap({ accountId: 'e1', closing: 400 }),
      snap({ accountId: 'x1', closing: 9999 }), // balance-sheet, ignored
    ]
    const sweep = retainedEarningsSweep(accounts, q4)
    expect(sweep.revenueTotal).toBe(1500)
    expect(sweep.expenseTotal).toBe(400)
    expect(sweep.net).toBe(1100)
  })

  it('buildYearEndClosingEntry is balanced and posts exactly one Retained Earnings line', () => {
    const accounts = [
      acct({ id: 'r1', accountType: 'REV', normalBalance: 'Credit', isPosting: true }),
      acct({ id: 'e1', accountType: 'EXP', normalBalance: 'Debit', isPosting: true }),
      acct({ id: RETAINED_EARNINGS, accountType: 'EQT', normalBalance: 'Credit', isPosting: true }),
    ]
    const q4 = [
      snap({ accountId: 'r1', closing: 1000 }),
      snap({ accountId: 'e1', closing: 400 }),
    ]
    const { entry, transactions, net } = buildYearEndClosingEntry(accounts, q4, RETAINED_EARNINGS, 2026)
    const debit = entry.lines.reduce((s, l) => s + l.debit, 0)
    const credit = entry.lines.reduce((s, l) => s + l.credit, 0)
    expect(Math.abs(debit - credit)).toBeLessThan(0.005)
    expect(entry.lines.filter(l => l.accountId === RETAINED_EARNINGS)).toHaveLength(1)
    expect(net).toBe(600) // profit 1000 − 400
    // Profit credits Retained Earnings.
    const re = entry.lines.find(l => l.accountId === RETAINED_EARNINGS)!
    expect(re.credit).toBe(600)
    expect(transactions.every(t => t.entryType === 'Closing')).toBe(true)
    expect(entry.reference).toBe('CLOSE-2026')
  })
})

// Periods are real objects and a transaction can only post into one that exists,
// so what the fiscal-year screen builds is the whole of what can be recorded.
describe('periodClose - building the periods a fiscal year implies', () => {
  it('runs twelve months from the start month, rolling into the next calendar year', () => {
    const july = buildFiscalYearPeriods(2026, 6)
    expect(july).toHaveLength(12)
    expect(july[0].label).toBe('Jul 2026')
    expect(july[0].startDate).toBe('2026-07-01')
    expect(july[11].label).toBe('Jun 2027')
    expect(july[11].endDate).toBe('2027-06-30')
    // Ids and labels follow each month's own calendar year, so a year that
    // straddles the boundary cannot collide with the year on either side.
    expect(july[6].id).toBe('p_2027_01')
    expect(new Set(july.map(p => p.id)).size).toBe(12)
  })

  it('defaults to January, leaving the calendar-aligned year untouched', () => {
    expect(buildFiscalYearPeriods(2026)).toEqual(buildFiscalYearPeriods(2026, 0))
  })

  it('takes month-end from the calendar, including a leap February', () => {
    expect(buildFiscalYearPeriods(2024, 0)[1].endDate).toBe('2024-02-29')
    expect(buildFiscalYearPeriods(2026, 0)[1].endDate).toBe('2026-02-28')
  })

  it('builds every year from the first year of books through today', () => {
    const built = buildPeriodsFromFirstYear('2024-01-01', '2026-08-11')
    expect(built).toHaveLength(36)
    expect(built[0].label).toBe('Jan 2024')
    expect(built[35].label).toBe('Dec 2026')
    expect(new Set(built.map(p => p.id)).size).toBe(36)
    // The point of the earlier years: today still has somewhere to post.
    expect(periodPostingBlock('2026-08-11', built)).toBeNull()
    expect(periodPostingBlock('2024-03-15', built)).toBeNull()
  })

  it('carries a mid-year start through every year it builds', () => {
    const built = buildPeriodsFromFirstYear('2024-07-01', '2026-08-11')
    expect(built[0].label).toBe('Jul 2024')
    expect(built[built.length - 1].label).toBe('Jun 2027')
  })

  it('builds one year alone when the books start ahead of today', () => {
    const built = buildPeriodsFromFirstYear('2027-01-01', '2026-08-11')
    expect(built).toHaveLength(12)
    expect(built[0].label).toBe('Jan 2027')
  })
})

describe('periodClose - whether a period has been posted into', () => {
  const periods = buildFiscalYearPeriods(2026)
  const posting = [tx({ date: '2026-03-15' })]

  it('reads the transaction dates, not the period label they carry', () => {
    const march = periods.find(p => p.id === 'p_2026_03')!
    const april = periods.find(p => p.id === 'p_2026_04')!
    // The label says December; the date is what decides.
    expect(periodHasPostings(march, [tx({ date: '2026-03-15', period: 'Dec 2026' })])).toBe(true)
    expect(periodHasPostings(april, posting)).toBe(false)
  })

  it('counts a posting on either boundary of the period', () => {
    const march = periods.find(p => p.id === 'p_2026_03')!
    expect(periodHasPostings(march, [tx({ date: '2026-03-01' })])).toBe(true)
    expect(periodHasPostings(march, [tx({ date: '2026-03-31' })])).toBe(true)
    expect(periodHasPostings(march, [tx({ date: '2026-02-28' })])).toBe(false)
  })

  it('locks the whole shape as soon as any one period holds a posting', () => {
    expect(anyPeriodHasPostings(periods, posting)).toBe(true)
    expect(anyPeriodHasPostings(periods, [])).toBe(false)
    expect(anyPeriodHasPostings([], posting)).toBe(false)
  })
})

describe('periodClose - store actions', () => {
  beforeEach(() => {
    useStore.setState({
      accounts: JSON.parse(JSON.stringify(seedAccounts)),
      transactions: seedTransactions,
      periods: buildFiscalYearPeriods(2026), // all Open - a clean year to close
      periodSnapshots: [],
      seedQ1Openings,
      journalEntries: [],
      auditLog: [],
      toasts: [],
      company: { ...seedCompany, fiscalYearStart: FY_START },
    })
  })

  const substantiveState = () => {
    const s = useStore.getState()
    return JSON.stringify({
      accounts: s.accounts,
      periods: s.periods,
      periodSnapshots: s.periodSnapshots,
      journalEntries: s.journalEntries,
      auditLog: s.auditLog,
    })
  }

  it('setFiscalYear rebuilds the periods while the books are empty', () => {
    useStore.setState({ transactions: [] })
    useStore.getState().setFiscalYear('2024-07-01', 'end')
    const s = useStore.getState()
    expect(s.company.fiscalYearStart).toBe('2024-07-01')
    // The name the year goes by is set with the dates, not after them, so no
    // report can be titled from one and grouped by the other.
    expect(s.company.fiscalYearNaming).toBe('end')
    // Every year from the first year of books up to the one holding today.
    const years = new Set(s.periods.map(p => p.startDate.slice(0, 4)))
    expect(s.periods[0].label).toBe('Jul 2024')
    expect(years.size).toBeGreaterThanOrEqual(3)
    expect(periodPostingBlock(todayIso(), s.periods)).toBeNull()
  })

  it('setFiscalYear refuses once a period holds a posting, so history cannot shift', () => {
    const before = substantiveState()
    useStore.getState().setFiscalYear('2019-04-01', 'end')
    expect(useStore.getState().company.fiscalYearStart).toBe(FY_START)
    // Naming is cosmetic, but renaming a year whose reports have been read is
    // still a change to what those reports said, so it freezes with the dates.
    expect(useStore.getState().company.fiscalYearNaming).toBe('start')
    expect(substantiveState()).toBe(before)
  })

  it('closeQuarter guards sequential ordering and does not mutate state on failure', () => {
    const before = substantiveState()
    const res = useStore.getState().closeQuarter(2026, 'Q3')
    expect(res.ok).toBe(false)
    expect(substantiveState()).toBe(before)
  })

  it('closeQuarter(Q1) succeeds and hard-locks its three periods', () => {
    const res = useStore.getState().closeQuarter(2026, 'Q1')
    expect(res.ok).toBe(true)
    const q1 = periodsForQuarter(useStore.getState().periods, 2026, 'Q1', FY_START)
    expect(q1.every(p => p.status === 'Hard-Locked')).toBe(true)
    // A date inside a locked period can no longer be posted on.
    expect(periodPostingBlock('2026-02-15', useStore.getState().periods)).not.toBeNull()
    // One period-level audit entry, not tied to an account.
    const audit = useStore.getState().auditLog.find(a => a.action === 'CloseQuarter')
    expect(audit?.periodRef).toBe('2026-Q1')
    expect(audit?.accountId).toBeUndefined()
  })

  it('closeYear fails while Q4 is still open', () => {
    const res = useStore.getState().closeYear(2026)
    expect(res.ok).toBe(false)
  })

  it('carries balance-sheet AND income/expense closings forward as the next quarter opening', () => {
    useStore.getState().closeQuarter(2026, 'Q1')
    const q1 = useStore.getState().periodSnapshots.filter(s => s.fiscalYear === 2026 && s.quarter === 'Q1')
    useStore.getState().closeQuarter(2026, 'Q2')
    const q2 = useStore.getState().periodSnapshots.filter(s => s.fiscalYear === 2026 && s.quarter === 'Q2')

    const q1Closing = (id: string) => q1.find(s => s.accountId === id)!.closing
    const q2Opening = (id: string) => q2.find(s => s.accountId === id)!.opening

    // Balance-sheet account: opening(Q2) === closing(Q1).
    expect(q2Opening(BS_ACCOUNT)).toBeCloseTo(q1Closing(BS_ACCOUNT), 2)
    // Income/expense account is NOT zeroed mid-year - it carries forward too.
    expect(q2Opening(IE_ACCOUNT)).toBeCloseTo(q1Closing(IE_ACCOUNT), 2)
  })

  it('year-end close zeroes I/E accounts, sweeps net to Retained Earnings, and rolls the year over', () => {
    const store = useStore.getState()
    store.closeQuarter(2026, 'Q1')
    store.closeQuarter(2026, 'Q2')
    store.closeQuarter(2026, 'Q3')
    store.closeQuarter(2026, 'Q4')

    const q4 = useStore.getState().periodSnapshots.filter(s => s.fiscalYear === 2026 && s.quarter === 'Q4')
    const sweep = retainedEarningsSweep(useStore.getState().accounts, q4)
    const reBefore = useStore.getState().accounts.find(a => a.id === RETAINED_EARNINGS)!.balance
    const bsClosing = q4.find(s => s.accountId === BS_ACCOUNT)!.closing

    const res = useStore.getState().closeYear(2026)
    expect(res.ok).toBe(true)
    const after = useStore.getState()

    // Every revenue/expense posting account is zeroed.
    const ieBalances = after.accounts.filter(a => a.isPosting && (a.accountType === 'REV' || a.accountType === 'EXP'))
    expect(ieBalances.every(a => a.balance === 0)).toBe(true)

    // Retained Earnings absorbs exactly the net.
    const reAfter = after.accounts.find(a => a.id === RETAINED_EARNINGS)!.balance
    expect(reAfter - reBefore).toBeCloseTo(sweep.net, 2)

    // BS Dec-31 closing becomes next-FY Q1 opening; I/E opens at zero.
    const next = after.periodSnapshots.filter(s => s.fiscalYear === 2027 && s.quarter === 'Q1')
    expect(next.find(s => s.accountId === BS_ACCOUNT)!.opening).toBeCloseTo(bsClosing, 2)
    expect(next.find(s => s.accountId === IE_ACCOUNT)!.opening).toBe(0)

    // All twelve FY-2026 periods are locked; a fresh twelve FY-2027 open.
    const fy2026 = after.periods.filter(p => p.startDate.startsWith('2026-'))
    const fy2027 = after.periods.filter(p => p.startDate.startsWith('2027-'))
    expect(fy2026).toHaveLength(12)
    expect(fy2026.every(p => p.status === 'Hard-Locked')).toBe(true)
    expect(fy2027).toHaveLength(12)
    expect(fy2027.every(p => p.status === 'Open')).toBe(true)

    // The closing entry was appended via addJournalEntry and is balanced.
    const closingEntry = after.journalEntries.find(e => e.reference === 'CLOSE-2026')!
    expect(closingEntry).toBeDefined()
    const d = closingEntry.lines.reduce((s, l) => s + l.debit, 0)
    const c = closingEntry.lines.reduce((s, l) => s + l.credit, 0)
    expect(Math.abs(d - c)).toBeLessThan(0.005)
    expect(after.transactions.some(t => t.entryType === 'Closing')).toBe(true)

    // A second year-end close is refused.
    expect(useStore.getState().closeYear(2026).ok).toBe(false)
  })
})
