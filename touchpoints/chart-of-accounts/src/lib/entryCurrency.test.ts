import { describe, it, expect } from 'vitest'
import { toBaseLines, reconstructEntry, linesInBase, buildReversal } from './journalEntry'
import { seedAccounts, seedTransactions } from './seed'
import { currencyMeta, typedCorrection } from './currencies'
import type { Transaction } from '../types'

/* A journal entry written in another currency posts in base at the rate
   (Mahad, 2026-09-30). The ledger holds only base figures, and the entry page
   pads any entry whose base sides differ by more than half a cent with a contra
   line, so the conversion has to land balanced to the cent. */
const sum = (ls: { baseDebit: number; baseCredit: number }[], k: 'baseDebit' | 'baseCredit') =>
  Math.round(ls.reduce((s, l) => s + l[k], 0) * 100)

describe('toBaseLines', () => {
  it('divides each line by the rate', () => {
    const out = toBaseLines([{ debit: 92.43, credit: 0 }, { debit: 0, credit: 92.43 }], 0.9243)
    expect(out.map(l => [l.baseDebit, l.baseCredit])).toEqual([[100, 0], [0, 100]])
  })

  it('keeps an entry balanced in base when rounding line by line would not', () => {
    // In pounds at 0.7914: 0.03 is 3.79 cents, rounded 4; each 0.01 is 1.26, rounded 1.
    const lines = [{ debit: 0.03, credit: 0 }, { debit: 0, credit: 0.01 }, { debit: 0, credit: 0.01 }, { debit: 0, credit: 0.01 }]
    const naive = lines.map(l => [Math.round(l.debit / 0.7914 * 100), Math.round(l.credit / 0.7914 * 100)])
    expect(naive.reduce((s, [d, c]) => s + d - c, 0), 'the case has a rounding gap to close').not.toBe(0)
    const out = toBaseLines(lines, 0.7914)
    expect(sum(out, 'baseDebit')).toBe(sum(out, 'baseCredit'))
    // Every line within a cent or two of its own conversion.
    out.forEach((l, i) => expect(Math.abs(l.baseDebit * 100 + l.baseCredit * 100 - naive[i][0] - naive[i][1])).toBeLessThanOrEqual(2))
  })

  it('leaves a base-currency entry exactly as typed', () => {
    const out = toBaseLines([{ debit: 12.34, credit: 0 }, { debit: 0, credit: 12.34 }], 1)
    expect(out.map(l => [l.baseDebit, l.baseCredit])).toEqual([[12.34, 0], [0, 12.34]])
  })

  it('posts an entry the entry page reads as balanced, with no line made up', () => {
    const lines = toBaseLines([{ debit: 0.03, credit: 0 }, { debit: 0, credit: 0.01 }, { debit: 0, credit: 0.01 }, { debit: 0, credit: 0.01 }], 0.7914)
    const txs: Transaction[] = lines.map((l, i) => ({
      id: `t${i}`, accountId: `a${i}`, date: '2026-09-30', source: 'Manual JE', jeNumber: 'JE-2026-9999', reference: '',
      entryType: 'Compound', description: '', memo: '', debit: l.baseDebit, credit: l.baseCredit,
      entryCurrency: 'GBP', entryRate: 0.7914, fxDebit: l.debit, fxCredit: l.credit,
      runningBalance: 0, dimensionValues: [], period: 'Sep 2026',
    }))
    const entry = reconstructEntry('JE-2026-9999', txs, [])
    expect(entry.lines).toHaveLength(4)
    expect(entry.lines.some(l => l.synthetic)).toBe(false)
    expect(entry.entryCurrency).toBe('GBP')
    expect(entry.lines[0].fxDebit).toBe(0.03)
  })
})

/* Each line in its own currency (Mahad, 2026-11-14: *"add Currency, Foreign
   Currency Amount and Rate columns. The base amount fills in from the rate."*).
   A line's base figure is what it shows in Debit or Credit, so the conversion
   the form shows and the one that posts are this one. */
describe('linesInBase', () => {
  it('converts each line at its own rate and leaves a base line as typed', () => {
    const out = linesInBase([
      { debit: 1000, credit: 0, currency: 'EUR', rate: 0.9243 },
      { debit: 0, credit: 1081.9, currency: 'USD', rate: 1 },
    ])
    expect(out.map(l => [l.baseDebit, l.baseCredit])).toEqual([[1081.9, 0], [0, 1081.9]])
  })

  it('keeps lines in one currency that balance in it balanced in base, as toBaseLines does', () => {
    const lines = [{ debit: 0.03, credit: 0 }, { debit: 0, credit: 0.01 }, { debit: 0, credit: 0.01 }, { debit: 0, credit: 0.01 }]
      .map(l => ({ ...l, currency: 'GBP', rate: 0.7914 }))
    const out = linesInBase(lines)
    expect(sum(out, 'baseDebit')).toBe(sum(out, 'baseCredit'))
    expect(out.map(l => [l.baseDebit, l.baseCredit])).toEqual(toBaseLines(lines, 0.7914).map(l => [l.baseDebit, l.baseCredit]))
  })

  it('converts a line that cannot balance on its own to the cent, without moving it', () => {
    // One euro debit against a base credit: nothing in euros to balance against.
    const [eur] = linesInBase([
      { debit: 0.03, credit: 0, currency: 'GBP', rate: 0.7914 },
      { debit: 0, credit: 0.04, currency: 'USD', rate: 1 },
    ])
    expect([eur.baseDebit, eur.baseCredit]).toEqual([0.04, 0])
  })

  it('converts a line with no usable rate to nothing', () => {
    const [l] = linesInBase([{ debit: 100, credit: 0, currency: 'EUR', rate: 0 }])
    expect([l.baseDebit, l.baseCredit]).toEqual([0, 0])
  })
})

describe('an entry whose lines are in different currencies', () => {
  const posting = (over: Partial<Transaction>): Transaction => ({
    id: 't', accountId: 'a', date: '2026-11-14', source: 'Manual JE', jeNumber: 'JE-2026-9998', reference: '',
    entryType: 'Simple', description: '', memo: '', debit: 0, credit: 0, runningBalance: 0, dimensionValues: [], period: 'Nov 2026',
    ...over,
  })
  const txs = [
    posting({ id: 't1', accountId: 'eur', debit: 1081.9, entryCurrency: 'EUR', entryRate: 0.9243, fxDebit: 1000, fxCredit: 0 }),
    posting({ id: 't2', accountId: 'rev', credit: 1081.9 }),
  ]

  it('names no one currency for the entry, and keeps each line its own', () => {
    const entry = reconstructEntry('JE-2026-9998', txs, [])
    expect(entry.multiCurrency).toBe(true)
    expect(entry.entryCurrency).toBeUndefined()
    expect(entry.entryRate).toBeUndefined()
    expect(entry.lines.map(l => [l.currency, l.rate, l.fxDebit])).toEqual([['EUR', 0.9243, 1000], [undefined, undefined, undefined]])
  })

  it('still names the currency of an entry written wholly in one', () => {
    const one = txs.map(t => ({ ...t, entryCurrency: 'EUR', entryRate: 0.9243, fxDebit: t.debit ? 1000 : 0, fxCredit: t.credit ? 1000 : 0 }))
    const entry = reconstructEntry('JE-2026-9998', one, [])
    expect(entry.multiCurrency).toBeUndefined()
    expect([entry.entryCurrency, entry.entryRate]).toEqual(['EUR', 0.9243])
  })

  it('reverses each line in its own currency, at its own rate', () => {
    const entry = reconstructEntry('JE-2026-9998', txs, [])
    const periods = [{ id: 'p', label: 'Nov 2026', startDate: '2026-11-01', endDate: '2026-11-30', status: 'Open' as const }]
    const plan = buildReversal(entry, periods, [])
    expect(plan.entryCurrency).toBeUndefined()
    expect(plan.lines.map(l => [l.debit, l.credit, l.currency, l.rate, l.fxDebit, l.fxCredit]))
      .toEqual([[0, 1081.9, 'EUR', 0.9243, 0, 1000], [1081.9, 0, undefined, undefined, undefined, undefined]])
  })
})

/* The seed's euro receipts and Barclays reserve transfers carry the amount typed
   in the account's own currency, so the ledger's three currency columns have
   something to show. Typed at the booked rate, so no balance moves. */
describe('the seeded lines typed in an account currency', () => {
  const byId = new Map(seedAccounts.map(a => [a.id, a]))
  const typed = seedTransactions.filter(t => t.entryCurrency)

  it('are on the euro and pound accounts only, in each account\'s own currency', () => {
    expect(typed.length).toBeGreaterThan(0)
    expect([...new Set(typed.map(t => byId.get(t.accountId)!.accountNumber))].sort()).toEqual(['11160', '11170'])
    expect(typed.every(t => t.entryCurrency === byId.get(t.accountId)!.currencyCode)).toBe(true)
  })

  it('restate their base figure at the booked rate, to the cent', () => {
    for (const t of typed) {
      const rate = currencyMeta(t.entryCurrency!).bookedRate
      expect(t.entryRate).toBe(rate)
      expect(t.fxDebit).toBe(Math.round(t.debit * rate * 100) / 100)
      expect(t.fxCredit).toBe(Math.round(t.credit * rate * 100) / 100)
    }
  })

  it('leave each account\'s own-currency balance where it was, to the cent', () => {
    for (const n of ['11160', '11170']) {
      const a = seedAccounts.find(x => x.accountNumber === n)!
      expect(Math.abs(typedCorrection(a, seedTransactions))).toBeLessThan(0.005)
    }
  })
})
