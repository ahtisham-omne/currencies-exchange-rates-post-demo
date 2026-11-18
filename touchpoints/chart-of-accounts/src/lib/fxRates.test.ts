import { describe, it, expect } from 'vitest'
import { seedAccounts, seedJournalEntries, seedPeriods, seedTransactions } from './seed'
import { FX_EXAMPLES, FX_ROUNDING_NUMBER, convertLines, withFxExamples } from './fxExamples'
import { canTypeRate, corporateRateOn, defaultRateKind, fmtUnitRate, midRateOn, rateQuote, unitsPerBase } from './fxRates'
import { currencyMeta } from './currencies'
import { todayIso } from './utils'

/* The rules for a journal entry in another currency (Mahad, 2026-11-18), as the
   rates, the form's conversion and the two seeded examples keep them. */

describe('dated rates', () => {
  it('end on today\'s spot rate and pass through the booked rate at the last month end', () => {
    const today = todayIso()
    expect(midRateOn('GBP', today)).toBeCloseTo(1 / currencyMeta('GBP').rate, 4)
    const [y, m] = today.split('-').map(Number)
    const monthEnd = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10)
    expect(midRateOn('GBP', monthEnd)).toBeCloseTo(1 / currencyMeta('GBP').bookedRate, 4)
  })

  it('give a back-dated entry that day\'s rate, the same every time', () => {
    const a = midRateOn('EUR', '2026-09-14')
    expect(a).toBe(midRateOn('EUR', '2026-09-14'))
    expect(a).not.toBe(midRateOn('EUR', todayIso()))
  })

  it('read the Currencies way, to four decimals', () => {
    expect(fmtUnitRate('GBP', 1.26358)).toBe('1 GBP = $1.2636 USD')
  })
})

describe('the rate type', () => {
  it('follows the company setting, falling back to mid-market where Treasury sets no corporate rate', () => {
    expect(defaultRateKind('corporate', 'EUR', '2026-11-12')).toBe('corporate')
    expect(defaultRateKind('corporate', 'GBP', '2026-11-12')).toBe('mid')
    expect(defaultRateKind('mid-market', 'EUR', '2026-11-12')).toBe('mid')
    expect(rateQuote('GBP', '2026-11-12', 'corporate').kind).toBe('mid')
  })

  it('lets only a company on corporate or manual rates type one, and never a mid-market one', () => {
    expect(canTypeRate('mid-market', 'corporate')).toBe(false)
    expect(canTypeRate('corporate', 'mid')).toBe(false)
    expect(canTypeRate('corporate', 'corporate')).toBe(true)
    expect(canTypeRate('manual', 'manual')).toBe(true)
  })

  it('takes the corporate rate in effect on the entry date', () => {
    expect(corporateRateOn('EUR', '2026-10-15')?.rate).toBe(1.074)
    expect(corporateRateOn('EUR', '2026-11-12')?.rate).toBe(1.08)
    expect(corporateRateOn('EUR', '2026-09-30')).toBeUndefined()
  })
})

describe('converting an entry line by line', () => {
  it('leaves the rounding gap a balanced entry carries in base', () => {
    const { base, gap } = convertLines([
      { side: 'debit', amount: 1850 }, { side: 'debit', amount: 312.46 }, { side: 'debit', amount: 87.3 },
      { side: 'credit', amount: 2249.76 },
    ], 1.265)
    expect(base).toEqual([2340.25, 395.26, 110.43, 2845.95])
    expect(gap).toBe(-0.01)
  })
})

describe('the seeded entries in another currency', () => {
  const seeded = withFxExamples({ accounts: seedAccounts, transactions: seedTransactions, journalEntries: seedJournalEntries }, seedPeriods)
  const byId = new Map(seeded.accounts.map(a => [a.id, a]))
  const added = seeded.transactions.filter(t => t.id.startsWith('tx_fx_'))
  const entries = [...new Set(added.map(t => t.jeNumber))].map(je => added.filter(t => t.jeNumber === je))

  it('are two, one at the mid-market rate and one at Treasury\'s corporate rate', () => {
    expect(entries).toHaveLength(FX_EXAMPLES.length)
    expect(entries.map(e => e[0].entryRateType).sort()).toEqual(['corporate', 'mid'])
  })

  it('each have one currency, on every line', () => {
    for (const e of entries) expect(new Set(e.map(t => t.entryCurrency)).size).toBe(1)
  })

  it('balance in both currencies', () => {
    for (const e of entries) {
      const sum = (k: 'debit' | 'credit' | 'fxDebit' | 'fxCredit') => Math.round(e.reduce((s, t) => s + (t[k] ?? 0), 0) * 100)
      expect(sum('debit')).toBe(sum('credit'))
      expect(sum('fxDebit')).toBe(sum('fxCredit'))
    }
  })

  it('take the rate for their own date', () => {
    for (const e of entries) {
      const t = e[0]
      expect(t.entryRate).toBe(unitsPerBase(rateQuote(t.entryCurrency!, t.date, t.entryRateType!).rate))
    }
  })

  it('put a foreign account only in an entry in its own currency', () => {
    for (const t of added) {
      const a = byId.get(t.accountId)!
      if (a.currencyCode !== 'USD') expect(a.currencyCode).toBe(t.entryCurrency)
    }
  })

  it('send the rounding cent to Foreign Exchange Gain/Loss, in dollars only', () => {
    const rounding = added.filter(t => byId.get(t.accountId)!.accountNumber === FX_ROUNDING_NUMBER)
    expect(rounding.length).toBeGreaterThan(0)
    for (const t of rounding) {
      expect((t.fxDebit ?? 0) + (t.fxCredit ?? 0)).toBe(0)
      expect(t.debit + t.credit).toBeLessThan(0.05)
    }
  })

  it('move the accounts they post to, and only those', () => {
    const before = new Map(seedAccounts.map(a => [a.id, a.balance]))
    const touched = new Set(added.map(t => t.accountId))
    for (const a of seeded.accounts) {
      if (!before.has(a.id)) continue
      if (touched.has(a.id)) expect(a.balance).not.toBe(before.get(a.id))
      else expect(a.balance).toBe(before.get(a.id))
    }
  })
})
