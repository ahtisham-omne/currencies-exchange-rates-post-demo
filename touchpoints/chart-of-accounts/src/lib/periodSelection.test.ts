import { describe, it, expect } from 'vitest'
import { seedAccounts, seedTransactions, seedPeriods, seedCompany, seedQ1Openings } from './seed'
import {
  accountFiguresFor,
  buildPeriodChoices,
  choiceKey,
  defaultPeriodSelection,
  isInSelection,
  periodsInSpan,
  resolvePeriodSelection,
  scopeAccountsToPeriod,
  scopeChartToPeriod,
  selectionCoversAll,
} from './periodSelection'
import type { Account, Period, Transaction } from '../types'
import { isCurrentYearEarnings } from './currentYearEarnings'

const acct = (p: Partial<Account>): Account => p as unknown as Account
const tx = (p: Partial<Transaction>): Transaction => p as unknown as Transaction
const period = (p: Partial<Period>): Period => p as unknown as Period

const FY_START = '2026-01-01'
const TODAY = '2026-08-04'

const P = [
  period({ id: 'm1', label: 'Jan 2026', startDate: '2026-01-01', endDate: '2026-01-31', status: 'Hard-Locked' }),
  period({ id: 'm2', label: 'Feb 2026', startDate: '2026-02-01', endDate: '2026-02-28', status: 'Hard-Locked' }),
  period({ id: 'm3', label: 'Mar 2026', startDate: '2026-03-01', endDate: '2026-03-31', status: 'Soft-Closed' }),
  period({ id: 'm4', label: 'Apr 2026', startDate: '2026-04-01', endDate: '2026-04-30', status: 'Open' }),
]

const resolve = (s: Parameters<typeof resolvePeriodSelection>[0]) => resolvePeriodSelection(s, P, FY_START, TODAY)

describe('resolvePeriodSelection', () => {
  it('resolves a month to its own period and states its status', () => {
    const r = resolve({ scope: 'month', periodId: 'm3' })
    expect(r.label).toBe('Mar FY2026')
    expect(r.range).toBe('Mar 1 - Mar 31')
    expect([r.startDate, r.endDate]).toEqual(['2026-03-01', '2026-03-31'])
    expect(r.periods.map(p => p.id)).toEqual(['m3'])
    expect(r.status).toBe('Soft-Closed')
  })

  it('resolves a quarter to the span of its defined periods', () => {
    const r = resolve({ scope: 'quarter', fiscalYear: 2026, quarter: 'Q1' })
    expect(r.label).toBe('Q1 FY2026')
    expect([r.startDate, r.endDate]).toEqual(['2026-01-01', '2026-03-31'])
    expect(r.periods.map(p => p.id)).toEqual(['m1', 'm2', 'm3'])
  })

  it('reports Mixed, with a breakdown, when a span straddles a close', () => {
    const r = resolve({ scope: 'quarter', fiscalYear: 2026, quarter: 'Q1' })
    expect(r.status).toBeNull()
    expect(r.statusLabel).toBe('Mixed')
    expect(r.statusCounts).toEqual({ 'Open': 0, 'Soft-Closed': 1, 'Hard-Locked': 2 })
  })

  // The stored statuses keep the soft/hard distinction for the close engine, but
  // a reader only ever sees Closed and Locked.
  it('labels a single period with its display status, never the stored one', () => {
    expect(resolve({ scope: 'month', periodId: 'm3' }).statusLabel).toBe('Closed')
    expect(resolve({ scope: 'month', periodId: 'm1' }).statusLabel).toBe('Locked')
    expect(resolve({ scope: 'month', periodId: 'm4' }).statusLabel).toBe('Open')
  })

  it('resolves a fiscal year to the periods that exist, not to twelve months', () => {
    const r = resolve({ scope: 'year', fiscalYear: 2026 })
    expect(r.label).toBe('FY2026')
    expect([r.startDate, r.endDate]).toEqual(['2026-01-01', '2026-04-30'])
  })

  it('stops year to date at today even when the fiscal year runs on', () => {
    const r = resolvePeriodSelection({ scope: 'ytd' }, P, FY_START, '2026-03-10')
    expect(r.label).toBe('FY2026 to date')
    expect([r.startDate, r.endDate]).toEqual(['2026-01-01', '2026-03-10'])
    // A day inside the last, part-covered period still names that period.
    expect(r.periods.map(p => p.id)).toEqual(['m1', 'm2', 'm3'])
  })

  it('leaves all dates unbounded at both ends', () => {
    const r = resolve({ scope: 'all' })
    expect(r.label).toBe('All dates')
    expect([r.startDate, r.endDate]).toEqual(['', ''])
    expect(r.range).toBe('')
    expect(r.periods).toHaveLength(P.length)
  })

  it('falls back to all dates for a selection that no longer exists', () => {
    expect(resolve({ scope: 'month', periodId: 'gone' }).scope).toBe('all')
    expect(resolve({ scope: 'year', fiscalYear: 2019 }).scope).toBe('all')
    expect(resolve({ scope: 'quarter', fiscalYear: 2026, quarter: 'Q4' }).scope).toBe('all')
    // A back-to-front custom range is unusable, not empty.
    expect(resolve({ scope: 'custom', from: '2026-04-01', to: '2026-01-01' }).scope).toBe('all')
  })

  it('names the periods a custom span overlaps, including partly covered ones', () => {
    const r = resolve({ scope: 'custom', from: '2026-02-15', to: '2026-03-05' })
    expect(r.label).toBe('Custom')
    expect(r.range).toBe('Feb 15 - Mar 5')
    expect(r.periods.map(p => p.id)).toEqual(['m2', 'm3'])
  })
})

// The strip reads "Active accounting period" off `current`, not off status: more
// than one month can be Open at once (a prior month left open for late postings),
// but only the one covering today is the period actually being posted into.
describe('current: the open period covering today', () => {
  const OPEN_RUN = [
    period({ id: 'jul', label: 'Jul 2026', startDate: '2026-07-01', endDate: '2026-07-31', status: 'Open' }),
    period({ id: 'aug', label: 'Aug 2026', startDate: '2026-08-01', endDate: '2026-08-31', status: 'Open' }),
    period({ id: 'sep', label: 'Sep 2026', startDate: '2026-09-01', endDate: '2026-09-30', status: 'Open' }),
  ]
  const month = (id: string) => resolvePeriodSelection({ scope: 'month', periodId: id }, OPEN_RUN, FY_START, TODAY)

  it('marks only the month covering today as current', () => {
    // TODAY is 2026-08-04.
    expect(month('aug').current).toBe(true)
    expect(month('jul').current).toBe(false)
    expect(month('sep').current).toBe(false)
  })

  it('still reads Open on every open month, current or not', () => {
    expect(month('aug').status).toBe('Open')
    expect(month('jul').status).toBe('Open')
  })

  it('never marks the unbounded all-dates span as current', () => {
    expect(resolvePeriodSelection({ scope: 'all' }, OPEN_RUN, FY_START, TODAY).current).toBe(false)
  })
})

describe('isInSelection', () => {
  const march = resolve({ scope: 'month', periodId: 'm3' })

  it('is inclusive of both bounds', () => {
    expect(isInSelection('2026-03-01', march)).toBe(true)
    expect(isInSelection('2026-03-31', march)).toBe(true)
    expect(isInSelection('2026-02-28', march)).toBe(false)
    expect(isInSelection('2026-04-01', march)).toBe(false)
  })

  it('ignores the time part of a timestamp', () => {
    expect(isInSelection('2026-03-31T23:59:00.000Z', march)).toBe(true)
  })

  it('admits everything when the span is unbounded', () => {
    expect(isInSelection('1999-01-01', resolve({ scope: 'all' }))).toBe(true)
  })
})

describe('periodsInSpan', () => {
  it('returns periods in date order regardless of the input order', () => {
    const shuffled = [P[2], P[0], P[3], P[1]]
    expect(periodsInSpan(shuffled, '2026-01-01', '2026-04-30').map(p => p.id)).toEqual(['m1', 'm2', 'm3', 'm4'])
  })
})

describe('accountFiguresFor', () => {
  const account = acct({ id: 'a', glAccountType: 'Posting', normalBalance: 'Debit', balance: 1085, netChange: 85 })
  const txns = [
    tx({ accountId: 'a', date: '2026-01-15', debit: 100, credit: 0 }),
    tx({ accountId: 'a', date: '2026-02-10', debit: 0, credit: 40 }),
    tx({ accountId: 'a', date: '2026-03-05', debit: 25, credit: 0 }),
  ]

  it('rewinds the authored balance past the postings after the span', () => {
    // Authored balance 1085 is after all three postings. Through February that is
    // 1085 less March's +25.
    const feb = resolve({ scope: 'month', periodId: 'm2' })
    expect(accountFiguresFor(account, txns, feb)).toEqual({ balance: 1060, netChange: -40 })
  })

  it('reproduces the authored figures for a span that reaches every posting', () => {
    const year = resolve({ scope: 'year', fiscalYear: 2026 })
    expect(accountFiguresFor(account, txns, year)).toEqual({ balance: 1085, netChange: 85 })
    expect(accountFiguresFor(account, txns, resolve({ scope: 'all' })).balance).toBe(1085)
  })

  it('signs movement by the account normal balance', () => {
    const credit = acct({ ...account, normalBalance: 'Credit' })
    expect(accountFiguresFor(credit, txns, resolve({ scope: 'month', periodId: 'm1' })).netChange).toBe(-100)
  })

  it('reports a zero movement, and the opening, for a span with no postings', () => {
    const apr = resolve({ scope: 'month', periodId: 'm4' })
    expect(accountFiguresFor(account, txns, apr)).toEqual({ balance: 1085, netChange: 0 })
  })
})

describe('scopeAccountsToPeriod', () => {
  // A summary row holds no figure to rewind: its amount is the sum of the postings
  // beneath it, taken after this scoping runs. Scoping the leaves and then indexing
  // is the one correct order, and scopeChartToPeriod is what enforces it.
  it('leaves summary rows alone so they can re-sum the scoped postings', () => {
    const summary = acct({ id: 't', glAccountType: 'Summary', normalBalance: 'Debit', balance: 0 })
    const posting = acct({ id: 'a', glAccountType: 'Posting', normalBalance: 'Debit', balance: 100, netChange: 100 })
    const txns = [tx({ accountId: 'a', date: '2026-04-10', debit: 100, credit: 0 })]
    const scoped = scopeAccountsToPeriod([summary, posting], txns, resolve({ scope: 'month', periodId: 'm1' }))
    expect(scoped[0]).toBe(summary)
    expect(scoped[1]).toMatchObject({ balance: 0, netChange: 0 })
  })

  it('keeps object identity for a posting account the span does not move', () => {
    const posting = acct({ id: 'a', glAccountType: 'Posting', normalBalance: 'Debit', balance: 100, netChange: 100 })
    const txns = [tx({ accountId: 'a', date: '2026-04-10', debit: 100, credit: 0 })]
    const scoped = scopeAccountsToPeriod([posting], txns, resolve({ scope: 'month', periodId: 'm4' }))
    expect(scoped[0]).toBe(posting)
  })

  /* Mahad, 2026-10-11: *"Running balance always shows the current balance. Does
     not change with the period filter."* */
  it('keeps the balance as it stands today beside the period figures, and rolls it up', () => {
    const summary = acct({ id: 't', glAccountType: 'Summary', normalBalance: 'Debit', balance: 0 })
    const posting = acct({ id: 'a', parentId: 't', glAccountType: 'Posting', normalBalance: 'Debit', balance: 100, netChange: 100 })
    const txns = [tx({ accountId: 'a', date: '2026-04-10', debit: 100, credit: 0 })]
    const { accounts, index } = scopeChartToPeriod([summary, posting], txns, resolve({ scope: 'month', periodId: 'm1' }))
    expect(accounts[1]).toMatchObject({ balance: 0, currentBalance: 100 })
    expect(index.figuresOf('a')).toEqual({ balance: 0, netChange: 0, current: 100 })
    expect(index.figuresOf('t').current).toBe(100)
  })

  it('works Current Year Earnings out as it stands today too', () => {
    const scoped = scopeAccountsToPeriod(seedAccounts, seedTransactions, resolve({ scope: 'month', periodId: P[0].id }))
    const today = scopeAccountsToPeriod(seedAccounts, seedTransactions, resolve({ scope: 'all' }))
    const cye = scoped.find(isCurrentYearEarnings)!
    expect(cye.currentBalance ?? cye.balance).toBe(today.find(isCurrentYearEarnings)!.balance)
  })
})

/* Today is 2026-03-10, so April and the quarter it opens are defined but have not
   started. Mahad, 2026-09-22: *"We will not be showing future Fiscal Years."* A
   period the books have not reached answers nothing - every figure read against it
   is zero - and offering it puts an empty page one click from the reader. Defining
   a year ahead is how a tenant opens its books, so the cut is on the date, not on
   whether the period exists. */
describe('buildPeriodChoices', () => {
  const choices = buildPeriodChoices(P, FY_START, '2026-03-10')

  it('offers one choice per period that has begun, in fiscal order', () => {
    expect(choices.month.map(c => c.label)).toEqual(['Jan FY2026', 'Feb FY2026', 'Mar FY2026'])
  })

  it('offers only quarters that have periods, and have started', () => {
    expect(choices.quarter.map(c => c.label)).toEqual(['Q1 FY2026'])
  })

  it('marks the month, quarter and year today falls in as current', () => {
    expect(choices.month.filter(c => c.current).map(c => c.label)).toEqual(['Mar FY2026'])
    expect(choices.quarter.filter(c => c.current).map(c => c.label)).toEqual(['Q1 FY2026'])
    expect(choices.year.filter(c => c.current).map(c => c.label)).toEqual(['FY2026'])
  })

  it('gives every choice a key that round-trips its selection', () => {
    const all = [...choices.month, ...choices.quarter, ...choices.year]
    expect(all.map(c => c.key)).toEqual(all.map(c => choiceKey(c.selection)))
    expect(new Set(all.map(c => c.key)).size).toBe(all.length)
  })
})

// The whole fiscal year is the span the chart was authored against, so it is the
// one selection that reads every figure straight off the chart with no rewinding.
describe('the full fiscal year, against the seeded chart', () => {
  const resolved = resolvePeriodSelection(
    { scope: 'year', fiscalYear: 2026 }, seedPeriods, seedCompany.fiscalYearStart, TODAY,
  )

  it('covers every seeded posting', () => {
    expect(selectionCoversAll(resolved, seedTransactions)).toBe(true)
  })

  it('leaves every seeded balance exactly as authored', () => {
    const scoped = scopeAccountsToPeriod(seedAccounts, seedTransactions, resolved)
    // All but Current Year Earnings, which authors nothing and states revenue
    // less expenses (lib/currentYearEarnings).
    scoped.forEach((a, i) => { if (!isCurrentYearEarnings(a)) expect(a.balance).toBe(seedAccounts[i].balance) })
  })

  // The listing derives Opening Balance as balance less net change, and the
  // detail page, the monthly ledger and the close engine all open the year at
  // seedQ1Openings. Deriving net change from the postings is what makes those two
  // agree: the hand-authored netChange literals do not tie to the opening for 99
  // of the 103 posting accounts, so they are the figures being corrected here.
  it('opens the fiscal year at seedQ1Openings for every posting account', () => {
    // Current Year Earnings is moved by revenue and expense postings, not its
    // own; its page reads it that way (currentYearEarnings.test.ts).
    const posting = seedAccounts.filter(a => a.glAccountType === 'Posting' && !isCurrentYearEarnings(a))
    expect(posting).not.toHaveLength(0)
    for (const a of posting) {
      const { balance, netChange } = accountFiguresFor(a, seedTransactions, resolved)
      expect(balance - netChange).toBeCloseTo(seedQ1Openings[a.id] ?? 0, 6)
    }
  })
})

// A reader opening the module lands on the period being posted into, which is the
// one they are working in. It is deliberately narrower than the span the chart was
// authored against, so first load rewinds the later postings out.
describe('the default selection', () => {
  it('is the accounting period today falls in', () => {
    expect(defaultPeriodSelection(seedPeriods, seedCompany.fiscalYearStart, TODAY))
      .toEqual({ scope: 'month', periodId: 'p_2026_08' })
  })

  // A chart whose periods have run out still has to open on something real.
  it('falls back to the fiscal year when no period covers today', () => {
    expect(defaultPeriodSelection(seedPeriods, seedCompany.fiscalYearStart, '2027-04-10'))
      .toEqual({ scope: 'year', fiscalYear: 2027 })
  })

  // The consequence, asserted so it cannot change unnoticed: the seed carries
  // postings through December, so opening on August reads rewound figures rather
  // than the authored ones. Widening to the fiscal year restores them.
  it('does not cover the postings dated after it', () => {
    const resolved = resolvePeriodSelection(
      defaultPeriodSelection(seedPeriods, seedCompany.fiscalYearStart, TODAY),
      seedPeriods, seedCompany.fiscalYearStart, TODAY,
    )
    expect(selectionCoversAll(resolved, seedTransactions)).toBe(false)
  })
})

// A month's movement has to be the difference between two closings, or the
// listing's Opening Balance column (balance less net change) would not tie out.
describe('period figures reconcile across the seeded chart', () => {
  const posting = seedAccounts.filter(a => a.glAccountType === 'Posting')

  it('closes each month at the prior closing plus the month movement', () => {
    const months = seedPeriods.map(p => resolvePeriodSelection(
      { scope: 'month', periodId: p.id }, seedPeriods, seedCompany.fiscalYearStart, TODAY,
    ))
    for (const a of posting) {
      let prior: number | null = null
      for (const m of months) {
        const { balance, netChange } = accountFiguresFor(a, seedTransactions, m)
        if (prior !== null) expect(balance - netChange).toBeCloseTo(prior, 6)
        prior = balance
      }
    }
  })
})
