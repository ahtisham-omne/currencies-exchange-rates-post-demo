import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { seedAccounts, seedTransactions } from './seed'
import { balanceStruckLabel, NEVER_POSTED, NO_ACTIVITY_IN_WINDOW } from './balanceStruckCopy'

/* A caption under a figure has to be about that figure.

   "No postings yet" was printed whenever nothing had ever posted to the account,
   including under a balance that was not nothing. 6530 Loss on Sale of Assets
   carries an opening of $3,200 and has never been posted to, so its Running
   balance tile read "+$ 3,200" over "No postings yet" and left the reader to
   work out where the 3,200 came from - the tile beside it, Opening balance, was
   printing the same 3,200 with a date on it.

   A figure standing with no movement behind it is an opening balance, not an
   absence. So the never-posted caption is reserved for the tile that really is
   showing nothing, and a tile showing a figure says nothing has moved it. */

const bySeedNumber = (n: string) => seedAccounts.find(a => a.accountNumber === n)
const lifetimeTx = (id: string) => seedTransactions.filter(t => t.accountId === id)

describe('the caption answers the figure above it', () => {
  it('dates the figure whenever something has posted', () => {
    expect(balanceStruckLabel('Mar 31, 2026', 4820)).toBe('As of Mar 31, 2026')
    // Including when the postings have netted the balance back to nothing: a
    // struck zero is a fact with a date, not an empty account.
    expect(balanceStruckLabel('Mar 31, 2026', 0)).toBe('As of Mar 31, 2026')
  })

  it('says nothing has moved a figure that no posting stands behind', () => {
    expect(balanceStruckLabel(undefined, 3200)).toBe(NO_ACTIVITY_IN_WINDOW)
    // A deficit is a figure too - the test is whether one is printed, not which
    // way it points.
    expect(balanceStruckLabel(undefined, -3200)).toBe(NO_ACTIVITY_IN_WINDOW)
  })

  it('keeps the never-posted caption for the tile showing nothing at all', () => {
    expect(balanceStruckLabel(undefined, 0)).toBe(NEVER_POSTED)
  })

  it('never claims nothing has happened over a figure', () => {
    for (const balance of [3200, -3200, 0.01, 1e9]) {
      expect(balanceStruckLabel(undefined, balance)).not.toBe(NEVER_POSTED)
    }
  })
})

describe('the account that reported it', () => {
  /* Found by the condition rather than pinned to 6530, so the seed can move the
     account without the test going quiet. What must keep holding is that the
     chart still contains the shape - a balance with no postings behind it - and
     that the shape gets the dormant caption rather than the empty one. */
  const dormant = seedAccounts.filter(
    a => a.balance !== 0 && lifetimeTx(a.id).length === 0,
  )

  it('the chart still holds an account with a balance and no postings', () => {
    expect(dormant.length).toBeGreaterThan(0)
    expect(bySeedNumber('53020'), 'the reported account is still seeded').toBeTruthy()
  })

  it('every one of them reads as dormant, not as empty', () => {
    for (const a of dormant) {
      expect(balanceStruckLabel(undefined, a.balance), a.accountNumber).toBe(NO_ACTIVITY_IN_WINDOW)
    }
  })
})

describe('the page says it one way', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

  it('borrows the wording the activity chart already uses', () => {
    // Not a second phrasing of the same idea: the account page's own chart empty
    // state says this, so the caption under the figure says it identically.
    expect(read('pages/AccountDetail.tsx')).toContain(`title="${NO_ACTIVITY_IN_WINDOW}"`)
  })

  it('sends both balance tiles through the one caption', () => {
    const src = read('pages/AccountDetail.tsx')
    // The posting account's Running balance and the summary's rolled-up Balance
    // make the same claim about the same kind of figure. A caption that means one
    // thing on one page and another on the next is the defect this replaces.
    expect((src.match(/balanceStruckLabel\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('leaves the never-posted wording only where there is no figure', () => {
    // Last posting still says it, and rightly: that tile prints a dash, so there
    // is no figure for the caption to contradict.
    const said = readFileSync(join(__dirname, '..', 'pages/AccountDetail.tsx'), 'utf8')
      .split('\n')
      .filter(l => l.includes(NEVER_POSTED))
    expect(said).toHaveLength(1)
    expect(said[0]).toContain('relativeTime')
  })
})
