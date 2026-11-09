import { describe, it, expect } from 'vitest'
import { seedAccounts, seedTransactions, seedQ1Openings, seedPeriods } from './seed'
import {
  monthlyBalances,
  monthlyBalancesThrough,
  monthlyBalanceAsOf,
  normalSideDelta,
  runningBalanceLedger,
  comparePostingOrder,
} from './monthlyLedger'
import { todayIso } from './utils'
import { isCurrentYearEarnings } from './currentYearEarnings'
import type { Account, Period, Transaction } from '../types'

const acct = (p: Partial<Account>): Account => p as unknown as Account
const tx = (p: Partial<Transaction>): Transaction => p as unknown as Transaction
const period = (p: Partial<Period>): Period => p as unknown as Period

const P = [
  period({ id: 'm1', label: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31', status: 'Hard-Locked' }),
  period({ id: 'm2', label: 'Feb', startDate: '2026-02-01', endDate: '2026-02-28', status: 'Soft-Closed' }),
  period({ id: 'm3', label: 'Mar', startDate: '2026-03-01', endDate: '2026-03-31', status: 'Open' }),
]

describe('monthlyLedger - pure', () => {
  it('normalSideDelta signs by the account normal balance', () => {
    expect(normalSideDelta(acct({ normalBalance: 'Debit' }), tx({ debit: 100, credit: 30 }))).toBe(70)
    expect(normalSideDelta(acct({ normalBalance: 'Credit' }), tx({ debit: 100, credit: 30 }))).toBe(-70)
  })

  /* A contra account carries its normalBalance flipped against its category, so
     signing by that alone would walk it toward zero as it grew. Negating it puts
     it back on its category's axis: a credit deepens a contra asset. */
  it('normalSideDelta flips again on a contra account', () => {
    expect(normalSideDelta(acct({ normalBalance: 'Credit', isContra: true }), tx({ debit: 0, credit: 30 }))).toBe(-30)
    expect(normalSideDelta(acct({ normalBalance: 'Credit', isContra: true }), tx({ debit: 100, credit: 0 }))).toBe(100)
    expect(normalSideDelta(acct({ normalBalance: 'Debit', isContra: true }), tx({ debit: 100, credit: 30 }))).toBe(-70)
  })

  it('chains each month opening from the prior closing and reflects lock status', () => {
    const account = acct({ id: 'a', normalBalance: 'Debit' })
    const txns = [
      tx({ accountId: 'a', date: '2026-01-15', debit: 100, credit: 0 }),
      tx({ accountId: 'a', date: '2026-02-10', debit: 0, credit: 40 }),
      tx({ accountId: 'a', date: '2026-03-05', debit: 25, credit: 0 }),
    ]
    const months = monthlyBalances(account, txns, 1000, P)
    expect(months.map(m => m.opening)).toEqual([1000, 1100, 1060])
    expect(months.map(m => m.movement)).toEqual([100, -40, 25])
    expect(months.map(m => m.closing)).toEqual([1100, 1060, 1085])
    // opening[n] === closing[n-1]
    expect(months[1].opening).toBe(months[0].closing)
    expect(months[2].opening).toBe(months[1].closing)
    // lock reflects period status
    expect(months.map(m => m.locked)).toEqual([true, true, false])
  })

  it('monthlyBalanceAsOf returns the period containing the date', () => {
    const account = acct({ id: 'a', normalBalance: 'Debit' })
    const txns = [tx({ accountId: 'a', date: '2026-01-15', debit: 100, credit: 0 })]
    const feb = monthlyBalanceAsOf(account, txns, 1000, P, '2026-02-20')
    expect(feb?.period.id).toBe('m2')
    expect(monthlyBalanceAsOf(account, txns, 1000, P, '2099-01-01')).toBeUndefined()
  })

  it('monthlyBalancesThrough truncates at the period containing the date and flags it provisional', () => {
    const account = acct({ id: 'a', normalBalance: 'Debit' })
    const txns = [tx({ accountId: 'a', date: '2026-01-15', debit: 100, credit: 0 })]

    // Mid-year: months after the current one aren't charted at all.
    const feb = monthlyBalancesThrough(account, txns, 1000, P, '2026-02-20')
    expect(feb.rows.map(m => m.period.id)).toEqual(['m1', 'm2'])
    // Feb is Soft-Closed, so it's final - nothing is provisional.
    expect(feb.provisionalPeriodId).toBeNull()

    // The final period, still Open: nothing truncated, and it is provisional.
    const mar = monthlyBalancesThrough(account, txns, 1000, P, '2026-03-10')
    expect(mar.rows.map(m => m.period.id)).toEqual(['m1', 'm2', 'm3'])
    expect(mar.provisionalPeriodId).toBe('m3')

    // Outside every period: all rows, no flag, so a chart never blanks.
    const outside = monthlyBalancesThrough(account, txns, 1000, P, '2099-01-01')
    expect(outside.rows).toHaveLength(P.length)
    expect(outside.provisionalPeriodId).toBeNull()
  })

  it('running balance is continuous and lands on each month closing', () => {
    const account = acct({ id: 'a', normalBalance: 'Debit' })
    const txns = [
      tx({ accountId: 'a', date: '2026-02-10', debit: 0, credit: 40 }),
      tx({ accountId: 'a', date: '2026-01-15', debit: 100, credit: 0 }),
    ]
    const ledger = runningBalanceLedger(account, txns, 1000)
    // sorted by date ascending regardless of input order
    expect(ledger.map(p => p.transaction.date)).toEqual(['2026-01-15', '2026-02-10'])
    expect(ledger.map(p => p.runningBalance)).toEqual([1100, 1060])
    // last running balance === last month closing with movement
    const months = monthlyBalances(account, txns, 1000, P)
    expect(ledger[ledger.length - 1].runningBalance).toBe(months[1].closing)
  })

  it('reconciles: seeded opening + full-year movement === Account.balance for a real posting account', () => {
    const account = seedAccounts.find(a => a.id === 'acct_11130')!
    const months = monthlyBalances(account, seedTransactions, seedQ1Openings[account.id] ?? 0, seedPeriods)
    const finalClosing = months[months.length - 1].closing
    expect(finalClosing).toBeCloseTo(account.balance, 2)
    // and the running ledger ends at the same closing
    const ledger = runningBalanceLedger(account, seedTransactions, seedQ1Openings[account.id] ?? 0)
    expect(ledger[ledger.length - 1].runningBalance).toBeCloseTo(account.balance, 2)
  })

  // The Net change trend's hover card prints the subtraction itself - closing less
  // opening, with both figures beside it - so a reader can check the bar instead of
  // trusting it. That only works while the identity holds for every account and
  // month, hence the sweep over the whole seeded chart rather than one fixture.
  it('every month closing less opening equals its movement, across the whole chart', () => {
    const broken: string[] = []
    for (const a of seedAccounts.filter(a => a.isPosting)) {
      for (const m of monthlyBalances(a, seedTransactions, seedQ1Openings[a.id] ?? 0, seedPeriods)) {
        if (Math.abs(m.closing - m.opening - m.movement) > 0.005) {
          broken.push(`${a.accountNumber} ${m.period.label}`)
        }
      }
    }
    expect(broken).toEqual([])
  })
})

// The opening is derived as closing − full-year movement, so an unbounded
// generator produced openings nowhere near the closing the chart publishes: a
// $520K money-market account opened at -$62M, and 82 of 103 posting accounts
// opened on the wrong side of zero. The generator now caps each account's year
// movement below its own size, which is what makes these hold.
describe('seeded openings are plausible', () => {
  // Current Year Earnings authors nothing: its figure is worked out from
  // revenue less expenses, so it has no authored closing to open against.
  const postings = seedAccounts.filter(a => a.isPosting && !isCurrentYearEarnings(a))

  it('never opens an account on the opposite side of zero from its closing', () => {
    const wrong = postings.filter(a => {
      const opening = seedQ1Openings[a.id] ?? 0
      return a.balance > 0 ? opening < 0 : a.balance < 0 ? opening > 0 : opening !== 0
    })
    expect(wrong.map(a => `${a.accountNumber} ${a.accountName}`)).toEqual([])
  })

  it('opens every account within a plausible distance of its closing', () => {
    // A year of movement may not exceed the account's own size, so |opening| stays
    // inside 2x the closing. Anything wider means the postings have drifted out of
    // scale with the chart again.
    const outliers = postings.filter(a => Math.abs(seedQ1Openings[a.id] ?? 0) > Math.abs(a.balance) * 2)
    expect(outliers.map(a => `${a.accountNumber} ${a.accountName}`)).toEqual([])
  })

  it('gives every account marked as having transactions at least one posting', () => {
    const posted = new Set(seedTransactions.map(t => t.accountId))
    const starved = postings.filter(a => a.hasTransactions && !posted.has(a.id))
    expect(starved.map(a => `${a.accountNumber} ${a.accountName}`)).toEqual([])
  })

  // A quarter of the seeded postings were once dated after today, because they were
  // anchored to the last period's end (Dec 2026) rather than to the wall clock. It
  // showed up as a Running balance struck "as of" a date months away.
  it('never dates a posting in the future', () => {
    const today = todayIso()
    const ahead = seedTransactions.filter(t => t.date.slice(0, 10) > today)
    expect(ahead.map(t => `${t.jeNumber} ${t.date.slice(0, 10)}`)).toEqual([])
  })

  it('keeps every posting inside a seeded period', () => {
    const orphans = seedTransactions.filter(t => {
      const d = t.date.slice(0, 10)
      return !seedPeriods.some(p => d >= p.startDate && d <= p.endDate)
    })
    expect(orphans.map(t => `${t.jeNumber} ${t.date.slice(0, 10)}`)).toEqual([])
  })

  // The register used to thin out month by month - 400 postings in January down to
  // 20 in the current month - because sizing runs in date order and each account's
  // movement cap was exhausted long before the year was, so every later entry had
  // no room left and was dropped. Asserted as a shape rather than fixed counts, so
  // the seed can still be retuned freely.
  it('spreads postings evenly across the elapsed months', () => {
    const today = todayIso()
    /* Measured over the months the ledger was authored against, which is the
       current fiscal year. The tenant also carries two closed years behind it so
       the period picker has a history to offer, and those are empty by design - a
       demo that spread its entries over three years would show a handful a month
       everywhere. Opening at the first posting is what tells the two apart. */
    const opened = seedTransactions.map(t => t.date.slice(0, 10)).sort()[0]
    const counts = seedPeriods
      .filter(p => p.startDate <= today && p.endDate >= opened)
      .map(p => ({
        label: p.label,
        n: seedTransactions.filter(t => {
          const d = t.date.slice(0, 10)
          return d >= p.startDate && d <= p.endDate
        }).length,
      }))
    const busiest = Math.max(...counts.map(c => c.n))
    const starved = counts.filter(c => c.n < busiest * 0.4)
    expect(starved.map(c => `${c.label}=${c.n} of ${busiest}`)).toEqual([])
  })

  // Every period selector opens on the current accounting month, so that is the
  // register a reader actually lands on. Spread uniformly over the year it held one
  // or two rows per account when the demo ran early in a month, which reads as
  // missing data - hence the seed's separate month-to-date quota.
  it('gives almost every active account a register in the current month', () => {
    const today = todayIso()
    const current = seedPeriods.find(p => p.startDate <= today && today <= p.endDate)
    expect(current).toBeTruthy()
    const inMonth = new Set(
      seedTransactions
        .filter(t => t.date.slice(0, 10) >= current!.startDate && t.date.slice(0, 10) <= today)
        .map(t => t.accountId),
    )
    const active = postings.filter(a => a.status === 'Active')
    const empty = active.filter(a => !inMonth.has(a.id))
    // Not "every": a certificate of deposit or a treasury stock account genuinely
    // does not move every month, and forcing one to would be less true, not more.
    expect(empty.length).toBeLessThanOrEqual(Math.ceil(active.length * 0.1))
  })

  // Sub-dollar postings are the tail of an exhausted cap, and they read as a data
  // fault sitting next to a $20,000 settlement.
  it('never emits a token posting', () => {
    const crumbs = seedTransactions.filter(t => Math.max(t.debit, t.credit) < 5)
    expect(crumbs.map(t => `${t.jeNumber} ${Math.max(t.debit, t.credit)}`)).toEqual([])
  })

  it('emits only balanced journal entries', () => {
    const byEntry = new Map<string, number>()
    seedTransactions.forEach(t => byEntry.set(t.jeNumber, (byEntry.get(t.jeNumber) ?? 0) + t.debit - t.credit))
    expect([...byEntry.entries()].filter(([, net]) => Math.abs(net) > 0.005)).toEqual([])
  })
})

/* Posting order. Entry numbers used to be issued in account order, so
   JE-2026-2001 could be dated December and JE-2026-7000 dated January: the
   number said an entry was written late while its date said it was written
   early, and a register sorted by date and a register sorted by number were two
   different registers. Numbers are now issued in date order, which makes the
   two the same reading - and settles the second question, whether the grid sorts
   by date or by posting order, by removing the difference. */
describe('the order the ledger is read in', () => {
  it('puts the earlier date first, whatever the numbers say', () => {
    const a = { date: '2026-03-01', jeNumber: 'JE-2026-9999' }
    const b = { date: '2026-04-01', jeNumber: 'JE-2026-2000' }
    expect(comparePostingOrder(a, b)).toBeLessThan(0)
    expect(comparePostingOrder(b, a)).toBeGreaterThan(0)
  })

  it('separates two entries on one day by the number they were issued', () => {
    const a = { date: '2026-03-01', jeNumber: 'JE-2026-2009' }
    const b = { date: '2026-03-01', jeNumber: 'JE-2026-2010' }
    expect(comparePostingOrder(a, b)).toBeLessThan(0)
    // Numeric, not lexical: 2010 sorts after 2009 and not before it.
    expect(comparePostingOrder({ ...a, jeNumber: 'JE-2026-999' }, b)).toBeLessThan(0)
  })

  it('leaves one entry equal to itself, so a sort on it is stable', () => {
    const a = { date: '2026-03-01', jeNumber: 'JE-2026-2009' }
    expect(comparePostingOrder(a, { ...a })).toBe(0)
  })

  it('issues every seeded number in date order, with no holes in a series', () => {
    const dateOf = new Map<string, string>()
    for (const t of seedTransactions) dateOf.set(t.jeNumber, t.date.slice(0, 10))
    const bySeries = new Map<string, { seq: number; date: string }[]>()
    for (const [number, date] of dateOf) {
      const [prefix, year, seq] = number.split('-')
      const key = `${prefix}-${year}`
      if (!bySeries.has(key)) bySeries.set(key, [])
      bySeries.get(key)!.push({ seq: Number(seq), date })
    }
    expect([...bySeries.keys()].sort()).toEqual(['JE-2026'])
    for (const [key, rows] of bySeries) {
      rows.sort((a, b) => a.seq - b.seq)
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].date >= rows[i - 1].date, `${key} ${rows[i].seq}`).toBe(true)
        expect(rows[i].seq, `${key} gap before ${rows[i].seq}`).toBe(rows[i - 1].seq + 1)
      }
    }
  })

  it('hands the register out newest first, ties included', () => {
    for (let i = 1; i < seedTransactions.length; i++) {
      expect(comparePostingOrder(seedTransactions[i - 1], seedTransactions[i]) >= 0, String(i)).toBe(true)
    }
  })

  // The running balance has to accumulate in the order the rows are printed in,
  // or the figure in the balance column steps backwards down the page.
  it('runs the balance in that same order', () => {
    const account = seedAccounts.find(a => a.accountNumber === '11130')!
    const points = runningBalanceLedger(account, seedTransactions, seedQ1Openings[account.id])
    for (let i = 1; i < points.length; i++) {
      expect(comparePostingOrder(points[i - 1].transaction, points[i].transaction) <= 0, String(i)).toBe(true)
    }
    expect(points[points.length - 1].runningBalance).toBe(account.balance)
  })
})
