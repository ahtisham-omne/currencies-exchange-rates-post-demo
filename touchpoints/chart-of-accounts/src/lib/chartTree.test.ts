import { describe, it, expect } from 'vitest'
import { EMPTY_FILTERS, offTheListing } from '../components/Filters'
import { seedAccounts, seedTransactions, seedPeriods } from './seed'
import { buildChartIndex, classificationTrail, sumFigures } from './chartTree'
import { withEarningsFigures, isCurrentYearEarnings } from './currentYearEarnings'
import { resolvePeriodSelection, scopeChartToPeriod } from './periodSelection'
import { todayIso } from './utils'
import { buildAccount } from '../store'
import { CLASSIFICATIONS_BY_CATEGORY } from '../types'
import type { Account } from '../types'

// These pin the invariants the two-type chart rests on. Each one was a live fault
// or an unwritten assumption before the collapse to Posting + Summary, and each is
// cheap to state and expensive to rediscover.

const index = buildChartIndex(seedAccounts)
const summaries = seedAccounts.filter(a => a.glAccountType === 'Summary')
const postings = seedAccounts.filter(a => a.glAccountType === 'Posting')

describe('chart shape', () => {
  it('has both types, and nothing else', () => {
    expect(summaries.length + postings.length).toBe(seedAccounts.length)
    expect(summaries.length).toBeGreaterThan(0)
    expect(postings.length).toBeGreaterThan(0)
  })

  // isPosting is the load-bearing aggregate guard, and it is a mirror rather than a
  // second fact. Left to drift, a Summary counts as a leaf in every aggregate that
  // reads it and the figure comes out inflated with nothing to point at.
  it('isPosting mirrors glAccountType exactly', () => {
    for (const a of seedAccounts) expect(a.isPosting).toBe(a.glAccountType === 'Posting')
  })

  // Every create flow in the app goes through buildAccount, so deriving the mirror
  // there is what keeps the invariant above true of accounts the user makes and not
  // just of the seeded ones. A caller that contradicts itself is corrected.
  it('derives the mirror on a newly built account, whatever the caller says', () => {
    const base = { ...postings[0], isPosting: true }
    expect(buildAccount({ ...base, glAccountType: 'Summary' }).isPosting).toBe(false)
    expect(buildAccount({ ...base, glAccountType: 'Posting', isPosting: false }).isPosting).toBe(true)
  })

  it('places every account: no orphan parent, no cycle', () => {
    expect(index.unreachable).toEqual([])
  })

  it('resolves every declared parent, to a Summary of the same category', () => {
    for (const a of seedAccounts) {
      if (a.parentId === null) {
        expect(a.glAccountType).toBe('Summary')
        continue
      }
      const parent = index.byId.get(a.parentId)
      expect(parent, `${a.accountNumber} names a parent that is not here`).toBeDefined()
      expect(parent!.glAccountType).toBe('Summary')
      expect(parent!.accountType).toBe(a.accountType)
    }
  })

  it('gives every posting account a parent', () => {
    for (const a of postings) expect(a.parentId, a.accountNumber).not.toBeNull()
  })

  /* Its number is not asked about: no section reserves one, so there is nothing
     for a number to be inside. What still has to hold is that the section and the
     category on an account agree, because reporting reads both. */
  it('puts every account in a section of its own category', () => {
    for (const a of seedAccounts) {
      expect(CLASSIFICATIONS_BY_CATEGORY[a.accountType], `${a.accountNumber} ${a.accountName}`).toContain(a.statementClassification)
    }
  })
})

/* "Move under a new summary account" on a posting row: a summary is built in
   that account's exact place and the account becomes its child, which is why the
   item says under rather than to. The whole reason it is a create
   in place rather than a move into an existing summary is that it must not change
   a figure anyone has already reported, so that is what these pin. */
describe('wrapping a posting account in a new summary', () => {
  const leaf = seedAccounts.find(a => a.accountNumber === '11110')!
  const wrapper = buildAccount({
    ...leaf, glAccountType: 'Summary', accountNumber: '1019', accountName: 'Cash on hand',
    balance: 0, hasTransactions: false,
  })
  const wrapped = seedAccounts.map(a => a.id === leaf.id ? { ...a, parentId: wrapper.id } : a).concat(wrapper)
  const after = buildChartIndex(wrapped)

  it('stands where the account stood, and takes only that account', () => {
    expect(wrapper.parentId).toBe(leaf.parentId)
    expect(wrapper.accountType).toBe(leaf.accountType)
    expect(wrapper.statementClassification).toBe(leaf.statementClassification)
    expect(after.childrenOf(wrapper.id).map(a => a.id)).toEqual([leaf.id])
  })

  it('leaves the account itself alone', () => {
    const moved = after.byId.get(leaf.id)!
    expect({ ...moved, parentId: null }).toEqual({ ...leaf, parentId: null })
  })

  it('changes no figure above it', () => {
    for (const a of summaries) {
      expect(after.figuresOf(a.id), a.accountName).toEqual(index.figuresOf(a.id))
    }
  })
})

describe('classification trail', () => {
  it('narrows from the outside in, without repeating the category', () => {
    const cash = seedAccounts.find(a => a.accountNumber === '11110')!
    expect(classificationTrail(index, cash.id).map(a => a.accountName))
      .toEqual(['Current Assets', 'Cash and Cash Equivalents'])
  })

  it('is empty for a category anchor, which is the category itself', () => {
    for (const root of index.roots) expect(classificationTrail(index, root.id), root.accountName).toEqual([])
  })

  it('reads every account as one step longer than its parent', () => {
    for (const a of seedAccounts) {
      const parent = index.parentOf(a.id)
      const own = classificationTrail(index, a.id).map(t => t.accountName)
      // A child of an anchor adds the anchor's own name to nothing: the trail
      // skips the anchor, but only when it is the outermost of the chain.
      expect(own, a.accountNumber).toEqual(
        !parent ? []
          : parent.parentId === null ? []
          : [...classificationTrail(index, parent.id).map(t => t.accountName), parent.accountName])
    }
  })
})

describe('summary figures', () => {
  // A summary that stored a figure would be a second copy of an answer the tree
  // already holds, and the two disagreed: the authored literals on the old rollup
  // rows were the sole reason every aggregate had to filter to postings or read 4x.
  it('stores no figure on a Summary', () => {
    for (const a of summaries) {
      expect(a.balance, a.accountNumber).toBe(0)
      expect(a.netChange, a.accountNumber).toBeUndefined()
    }
  })

  it('rolls each Summary up to the sum of its children, on both columns', () => {
    for (const a of summaries) {
      const kids = index.childrenOf(a.id)
      expect(index.figuresOf(a.id), a.accountName).toEqual(sumFigures(index, kids))
    }
  })

  it('rolls each Summary up to the sum of the postings beneath it', () => {
    for (const a of summaries) {
      const leaves = index.descendantsOf(a.id).filter(d => d.isPosting)
      const expected = leaves.reduce(
        (s, d) => ({ balance: s.balance + d.balance, netChange: s.netChange + (d.netChange ?? 0), current: s.current + (d.currentBalance ?? d.balance) }),
        { balance: 0, netChange: 0, current: 0 },
      )
      expect(index.figuresOf(a.id), a.accountName).toEqual(expected)
    }
  })

  it('reports zero for a Summary with nothing under it', () => {
    const empty: Account = { ...summaries[0], id: 'lonely', parentId: null, accountNumber: '9000' }
    const only = buildChartIndex([empty])
    expect(only.figuresOf('lonely')).toEqual({ balance: 0, netChange: 0, current: 0 })
  })

  // The balance sheet now closes only as arithmetic over the posting rows. When the
  // divisions carried authored totals it closed because someone had typed numbers
  // that agreed; this is the stronger claim.
  it('closes the balance sheet from the leaves up', () => {
    const at = (number: string) => index.figuresOf(`acct_${number}`).balance
    expect(at('10000')).toBe(5858600)
    expect(at('20000')).toBe(2048700)
    expect(at('30000')).toBe(3071800)
    // Equity closes it with the Current Year Earnings account, whose figure is
    // revenue less expenses (decision 57; module review, 2026-10-06, COA-05; an
    // account since 2026-10-10).
    const withLine = buildChartIndex(withEarningsFigures(seedAccounts))
    const full = (number: string) => withLine.figuresOf(`acct_${number}`).balance
    const earnings = seedAccounts.find(isCurrentYearEarnings)!
    expect(withLine.figuresOf(earnings.id).balance).toBe(738100)
    expect(withLine.parentOf(earnings.id)?.accountNumber).toBe('30000')
    expect(full('30000')).toBe(3809900)
    expect(full('10000')).toBe(full('20000') + full('30000'))
  })

  /* Retest, 2026-10-07: archiving a child keeps its parent's opening where it
     was. The move that empties it is a posting of the period, so the period's
     opening still holds it, and the account stays listed for that period - the
     parent's opening is the children it shows, archived one included. */
  it('keeps an archived child\'s opening in its parent, and lists it for that period', () => {
    const child = seedAccounts.find(a => a.isPosting && a.parentId && (a.netChange ?? 0) !== 0 && a.status === 'Active')!
    const before = buildChartIndex(seedAccounts)
    const opening = (idx: ReturnType<typeof buildChartIndex>, id: string) => idx.figuresOf(id).balance - idx.figuresOf(id).netChange
    const parentId = before.parentOf(child.id)!.id
    // Archive and move: the balance goes out as a posting dated in the period.
    const moved = { ...child, status: 'Archived' as const, balance: 0, netChange: (child.netChange ?? 0) - child.balance }
    const after = buildChartIndex(seedAccounts.map(a => (a.id === child.id ? moved : a)))
    expect(opening(after, parentId)).toBe(opening(before, parentId))
    expect(opening(after, 'acct_10000')).toBe(opening(before, 'acct_10000'))
    expect(offTheListing(moved, EMPTY_FILTERS)).toBe(false)
    const shown = after.childrenOf(parentId).filter(k => !offTheListing(k, EMPTY_FILTERS))
    expect(opening(after, parentId)).toBe(shown.reduce((sum, k) => sum + opening(after, k.id), 0))
    // A period after the move: nothing to show, so it is off the listing again.
    expect(offTheListing({ ...moved, netChange: 0 }, EMPTY_FILTERS)).toBe(true)
  })

  // Deactivating a mid-tree summary is a display decision. Were status consulted
  // inside the rollup, it would silently drop a whole branch out of its
  // grandparent's total and the statement would stop closing.
  it('rolls an inactive account up the same as an active one', () => {
    const inactive = postings.find(a => a.status === 'Inactive')!
    const parent = index.parentOf(inactive.id)!
    const kids = index.childrenOf(parent.id)
    expect(index.figuresOf(parent.id).balance).toBe(kids.reduce((s, k) => s + index.figuresOf(k.id).balance, 0))
    expect(inactive.balance).not.toBe(0)
  })
})

describe('period-scoped figures', () => {
  const today = todayIso()
  const resolve = (s: Parameters<typeof resolvePeriodSelection>[0]) =>
    resolvePeriodSelection(s, seedPeriods, '2026-01-01', today)

  // Scope-then-index is the one correct order. Indexed first and scoped after, a
  // summary would read the whole ledger while its own children read the period.
  const spans = {
    month: resolve({ scope: 'month', periodId: 'p_2026_02' }),
    quarter: resolve({ scope: 'quarter', fiscalYear: 2026, quarter: 'Q1' }),
    all: resolve({ scope: 'all' }),
  }

  for (const [name, resolved] of Object.entries(spans)) {
    it(`holds over a ${name} span`, () => {
      const { index: scoped } = scopeChartToPeriod(seedAccounts, seedTransactions, resolved)
      for (const a of summaries) {
        expect(scoped.figuresOf(a.id), `${name}: ${a.accountName}`)
          .toEqual(sumFigures(scoped, scoped.childrenOf(a.id)))
      }
    })
  }

  it('prints the authored figures over an all-time span', () => {
    const { index: scoped } = scopeChartToPeriod(seedAccounts, seedTransactions, spans.all)
    expect(scoped.figuresOf('acct_10000').balance).toBe(5858600)
  })
})
