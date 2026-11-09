import { describe, it, expect } from 'vitest'
import { FULL_CHART, classificationFor, type ChartRow } from './fullChart'

// FULL_CHART is authored data, and everything downstream of it - the seeded
// accounts, the transaction generator, every figure on screen - trusts its shape
// without re-checking. These pin that shape at the source, where a fault is one
// line to find rather than a wrong total three modules away.
//
// Figures are deliberately checked as live sums over the posting rows. Only a
// posting row carries an amount now, so a statement that closes here closes
// because the leaves add up, not because someone typed agreeing subtotals.
const POSTINGS = FULL_CHART.filter(r => r.glType === 'Posting')
const SUMMARIES = FULL_CHART.filter(r => r.glType === 'Summary')

const num = (n: string) => parseInt(n, 10)
const byNumber = new Map(FULL_CHART.map(r => [r.number, r]))
const childrenOf = (number: string) => FULL_CHART.filter(r => r.parent === number)

const descendantsOf = (number: string): ChartRow[] => {
  const out: ChartRow[] = []
  const stack = childrenOf(number)
  while (stack.length) {
    const r = stack.pop()!
    out.push(r)
    stack.push(...childrenOf(r.number))
  }
  return out
}

// What a summary row prints: the sum of the posting rows anywhere beneath it.
const rollup = (number: string) => {
  const leaves = descendantsOf(number).filter(r => r.glType === 'Posting')
  return {
    netChange: leaves.reduce((s, r) => s + (r.netChange ?? 0), 0),
    balance: leaves.reduce((s, r) => s + (r.balance ?? 0), 0),
  }
}

describe('full chart structure', () => {
  it('numbers every row uniquely, in ascending order', () => {
    const numbers = FULL_CHART.map(r => r.number)
    expect(new Set(numbers).size).toBe(numbers.length)
    /* All but 54000 Income Tax Expense, which keeps the row it held as 6520 so the
       seeded ledger - drawn in row order - stays the one it was before the chart
       went to five digits. The tree sorts by number, so nobody sees the order. */
    const ordered = numbers.filter(n => n !== '54000')
    expect(ordered.map(num)).toEqual([...ordered.map(num)].sort((a, b) => a - b))
    expect(numbers.indexOf('54000')).toBe(numbers.indexOf('53010') + 1)
  })

  it('tops the chart with exactly the five statement divisions', () => {
    expect(FULL_CHART.filter(r => r.parent === null).map(r => r.number))
      .toEqual(['10000', '20000', '30000', '40000', '50000'])
  })

  // Hierarchy is declared, not inferred from number order, so a parent that does
  // not resolve is a row the tree cannot place at all. Category agreement is
  // BR-003: it is the only thing stopping an expense nesting under assets.
  it('resolves every declared parent, to a summary of the same category', () => {
    for (const r of FULL_CHART) {
      if (r.parent === null) {
        expect(r.glType, r.number).toBe('Summary')
        continue
      }
      const parent = byNumber.get(r.parent)
      expect(parent, `${r.number} ${r.name} names parent ${r.parent}, which is not on the chart`).toBeDefined()
      expect(parent!.glType, `${r.number} names a posting row as its parent`).toBe('Summary')
      expect(parent!.cat, `${r.number} sits under a ${parent!.cat} parent`).toBe(r.cat)
    }
  })

  it('gives every posting row a parent', () => {
    expect(POSTINGS.filter(r => r.parent === null).map(r => r.number)).toEqual([])
  })

  it('places every row: no cycle, nothing stranded', () => {
    const roots = FULL_CHART.filter(r => r.parent === null)
    const reached = roots.length + roots.reduce((s, r) => s + descendantsOf(r.number).length, 0)
    expect(reached).toBe(FULL_CHART.length)
  })

})

describe('full chart figures', () => {
  // A summary holding a figure of its own would be a second copy of an answer the
  // tree already has, and the two drifted ~1.95M in the chart this replaced.
  it('carries an amount on posting rows only', () => {
    for (const s of SUMMARIES) {
      expect(s.balance, s.number).toBeUndefined()
      expect(s.netChange, s.number).toBeUndefined()
    }
    expect(POSTINGS.filter(r => r.balance === undefined || r.netChange === undefined).map(r => r.number)).toEqual([])
  })

  /* Equity includes the computed Current year earnings line - revenue less
     expenses - which is not a row of this chart (decision 57; module review,
     2026-10-06, COA-05). With it the books balance: assets equal liabilities
     plus equity, and debits equal credits. */
  const earnings = (f: (n: string) => number) => f('40000') - f('50000')
  it('closes the balance sheet on the running column, with current year earnings', () => {
    const bal = (n: string) => rollup(n).balance
    expect(bal('10000')).toBe(5858600)
    expect(earnings(bal)).toBe(738100)
    expect(bal('10000')).toBe(bal('20000') + bal('30000') + earnings(bal))
  })

  it('closes the balance sheet on the opening column, with current year earnings', () => {
    const opening = (n: string) => rollup(n).balance - rollup(n).netChange
    expect(opening('10000')).toBe(opening('20000') + opening('30000') + earnings(opening))
  })

  it('balances debits against credits', () => {
    const bal = (n: string) => rollup(n).balance
    expect(bal('10000') + bal('50000')).toBe(bal('20000') + bal('30000') + bal('40000'))
  })

  // A KPI card that splits on section has to land on the same money as the rows a
  // reader can see under a division, or the two contradict each other. classifications
  // are number bands, parents are declared, and nothing keeps the two in step
  // except that they were authored to agree.
  it('partitions each division into its sections', () => {
    for (const root of FULL_CHART.filter(r => r.parent === null)) {
      const leaves = descendantsOf(root.number).filter(r => r.glType === 'Posting')
      const bySection = new Map<string, number>()
      for (const r of leaves) {
        const section = classificationFor(r.number, r.cat)
        bySection.set(section, (bySection.get(section) ?? 0) + (r.balance ?? 0))
      }
      const summed = [...bySection.values()].reduce((s, v) => s + v, 0)
      expect(summed, root.name).toBe(rollup(root.number).balance)
      expect(bySection.size, `${root.name} spreads over no section`).toBeGreaterThan(0)
    }
  })
})
