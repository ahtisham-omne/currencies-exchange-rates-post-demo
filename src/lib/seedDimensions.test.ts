import { describe, it, expect } from 'vitest'
import { missingDefaults, postingDimensions, valuesByDimension } from './dimensionDefaults'
import { seedAccounts, seedDimensions, seedTransactions } from './seed'

/* The demo chart's dimension defaults. A default is not decoration: every
   posting to the account takes it and no posting can change it, so these
   assertions are about whether the seeded data can be believed, not about
   whether the column looks full. */

const byId = new Map(seedDimensions.map(d => [d.id, d]))
const posting = seedAccounts.filter(a => a.glAccountType === 'Posting')
const withDefaults = posting.filter(a => a.defaultDimensionValues.length)

describe('the seeded defaults only say things the Dimensions page offers', () => {
  it('names a dimension that exists, and a value that dimension lists', () => {
    /* The one failure mode a screenshot cannot catch: a typo puts "Singapore "
       or "UK" in the column, the pill renders it happily, and the value matches
       nothing a reader could ever filter or report by. */
    for (const a of seedAccounts) {
      for (const dv of a.defaultDimensionValues) {
        const dim = byId.get(dv.dimensionId)
        expect(dim, `${a.accountNumber} names unknown dimension ${dv.dimensionId}`).toBeTruthy()
        expect(dim!.values, `${a.accountNumber} (${a.accountName}) sets ${dim!.name} to "${dv.value}"`)
          .toContain(dv.value)
      }
    }
  })

  /* Several values for one dimension are allowed (design review, 2026-09-30),
     and then one is the default its postings take (2026-10-02). */
  it('marks a default wherever it gives one dimension two values', () => {
    for (const a of seedAccounts) expect(missingDefaults(a.defaultDimensionValues), a.accountNumber).toEqual([])
    expect(seedAccounts.some(a => valuesByDimension(a.defaultDimensionValues).get('dim_location')?.length === 2)).toBe(true)
  })
})

describe('the defaults sit where a default can be true', () => {
  it('leaves every summary bare, since a summary takes no postings', () => {
    for (const a of seedAccounts.filter(x => x.glAccountType === 'Summary')) {
      expect(a.defaultDimensionValues, `${a.accountNumber} ${a.accountName}`).toEqual([])
    }
  })

  /* Most accounts must stay bare. Trade Receivables is owed by customers
     everywhere and Salaries is paid by every department - fixing a value on
     those would be a lie the ledger then repeats on every line. If this ever
     fails upward, the demo has started tagging accounts to fill a column. */
  it('leaves most posting accounts open, because most genuinely are', () => {
    expect(withDefaults.length / posting.length).toBeLessThan(0.5)
  })

  it('still fills enough of the column to show what it is for', () => {
    expect(withDefaults.length).toBeGreaterThan(20)
    // Some accounts carry two, or the "+1" overflow pill never appears at all.
    expect(withDefaults.filter(a => a.defaultDimensionValues.length > 1).length).toBeGreaterThan(4)
  })
})

describe('a posting agrees with the account it is posted to', () => {
  it('carries the account default on every line of an account that has one', () => {
    /* The contradiction this rules out: Direct Labor reads Singapore on the
       account and Hong Kong on its own register, because the line dimensions
       were drawn at random regardless of what the account had fixed. */
    // One value per dimension, the default, where the account holds several.
    const defaults = new Map(withDefaults.map(a => [a.id, postingDimensions(a.defaultDimensionValues)]))
    for (const t of seedTransactions) {
      const want = defaults.get(t.accountId)
      if (!want) continue
      expect(t.dimensionValues ?? [], `${t.accountId} entry ${t.id}`).toEqual(want)
    }
  })
})
