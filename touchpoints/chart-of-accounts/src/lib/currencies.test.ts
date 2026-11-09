import { describe, it, expect } from 'vitest'
import { bookedFromBase, ownBalanceOf, ownSide, typedCorrection } from './currencies'
import { scopeAccountsToPeriod } from './periodSelection'
import type { Account, Transaction } from '../types'

/* Mahad, 2026-10-11: *"On the EUR account, show the euro amount that was
   actually typed in (€123.45), not €124.34. Add up the euro balance from those
   real amounts."* €123.45 typed at today's 0.9243 posts as $133.56; restated at
   the booked 0.9310 that came back as €124.34. */
describe('euro amounts as typed', () => {
  const eur = { id: 'eur', currencyCode: 'EUR', normalBalance: 'Debit', isContra: false, glAccountType: 'Posting', isPosting: true, balance: 1000, netChange: 0 } as Account
  const typed: Transaction = {
    id: 't1', accountId: 'eur', date: '2026-10-11', source: 'Manual JE', jeNumber: 'JE-1', reference: '', entryType: 'Simple',
    description: '', debit: 133.56, credit: 0, runningBalance: 0, dimensionValues: [], period: 'Oct 2026',
    entryCurrency: 'EUR', entryRate: 0.9243, fxDebit: 123.45, fxCredit: 0,
  } as Transaction
  const restatedOnly = { ...typed, id: 't2', entryCurrency: undefined, entryRate: undefined, fxDebit: undefined, fxCredit: undefined } as Transaction

  it('reads a line typed in euros as typed, and any other restated', () => {
    expect(bookedFromBase(133.56, 'EUR')).toBeCloseTo(124.34, 2)
    expect(ownSide(typed, 'debit', 'EUR')).toBe(123.45)
    expect(ownSide(restatedOnly, 'debit', 'EUR')).toBeCloseTo(124.34, 2)
  })

  it('adds the euro balance up from what was typed', () => {
    // The base balance includes the $133.56; the euros count €123.45 for it.
    const correction = typedCorrection(eur, [typed, restatedOnly])
    expect(correction).toBeCloseTo(123.45 - bookedFromBase(133.56, 'EUR'), 6)
    expect(ownBalanceOf({ ...eur, typedCorrection: correction })).toBeCloseTo(bookedFromBase(1000, 'EUR') - 124.34 + 123.45, 2)
  })

  it('counts a typed line only once its date is inside the period', () => {
    expect(typedCorrection(eur, [typed], '2026-10-10')).toBe(0)
    const [scoped] = scopeAccountsToPeriod([eur], [typed], { startDate: '2026-10-01', endDate: '2026-10-31' })
    expect(scoped.typedCorrection).toBeCloseTo(123.45 - bookedFromBase(133.56, 'EUR'), 6)
  })
})
