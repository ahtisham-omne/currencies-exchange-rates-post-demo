import { describe, it, expect } from 'vitest'
import { toBaseLines, reconstructEntry } from './journalEntry'
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
