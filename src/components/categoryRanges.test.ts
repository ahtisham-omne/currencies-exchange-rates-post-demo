import { describe, it, expect } from 'vitest'
import { categoryRangeProblems, categoryRangesValid, defaultCategoryRanges, schemeFromNumbering } from './AccountNumberingStep'
import { seedCategoryAccounts } from '../lib/seed'
import { guidedPreviewAccounts } from '../lib/guidedSetup'
import { EMPTY_GUIDED_ANSWERS } from '../lib/guidedSetup'

/* The block each category keeps, set on the first-time Number length step.
   Mahad, 2026-10-01: *"We had setting up the ranges in the first-time view
   before. Can we bring it back?"* What the step states has to be what the chart
   it builds holds, so the scheme carries the blocks into every builder. */
describe('category ranges', () => {
  it('defaults to each first digit and a block of the width', () => {
    expect(defaultCategoryRanges(5).AST).toEqual({ from: '10000', to: '19999' })
    expect(defaultCategoryRanges(5).EXP).toEqual({ from: '50000', to: '59999' })
    expect(defaultCategoryRanges(4).LIA).toEqual({ from: '2000', to: '2999' })
    expect(categoryRangesValid(defaultCategoryRanges(5), 5)).toBe(true)
  })

  it('names what is wrong on the row that is wrong', () => {
    const r = defaultCategoryRanges(5)
    const at = (patch: Partial<typeof r>) => categoryRangeProblems({ ...r, ...patch }, 5)
    expect(at({ AST: { from: '10000', to: '' } }).AST).toBe('Assets needs a start and an end number.')
    expect(at({ AST: { from: '10000', to: '9999' } }).AST).toBe('The Assets range needs numbers 5 digits long.')
    expect(at({ AST: { from: '15000', to: '14000' } }).AST).toBe('Assets needs an end number above its start.')
    expect(at({ AST: { from: '10000', to: '10050' } }).AST).toBe('Assets needs a block of at least 100 numbers.')
    const overlap = at({ AST: { from: '10000', to: '25000' } })
    // No "Liabilities's" (module review, 2026-10-06, COA-30).
    expect(overlap.AST).toBe('Assets overlaps the Liabilities range, 20000 to 29999.')
    expect(overlap.LIA).toBe('Liabilities overlaps the Assets range, 10000 to 25000.')
    expect(categoryRangesValid({ ...r, AST: { from: '10000', to: '25000' } }, 5)).toBe(false)
  })

  it('gives each category account its block, numbered at its start', () => {
    const ranges = { ...defaultCategoryRanges(5), AST: { from: '10000', to: '14999' }, EXP: { from: '60000', to: '69999' } }
    const anchors = seedCategoryAccounts(schemeFromNumbering(5, ranges))
    const ast = anchors.find(a => a.accountType === 'AST')!
    expect([ast.accountNumber, ast.numberRangeStart, ast.numberRangeEnd]).toEqual(['10000', 10000, 14999])
    const exp = anchors.find(a => a.accountType === 'EXP')!
    expect([exp.accountNumber, exp.numberRangeStart, exp.numberRangeEnd]).toEqual(['60000', 60000, 69999])
  })

  it('cuts the guided chart\'s groups from the block it was given', () => {
    const ranges = { ...defaultCategoryRanges(5), EXP: { from: '60000', to: '69999' } }
    const chart = guidedPreviewAccounts(schemeFromNumbering(5, ranges), EMPTY_GUIDED_ANSWERS, { baseCurrency: 'USD', fiscalYearStart: '2026-01-01' })
    const anchor = chart.find(a => a.parentId === null && a.accountType === 'EXP')!
    const under = (id: string): typeof chart => chart.filter(a => a.parentId === id).flatMap(a => [a, ...under(a.id)])
    const inside = under(anchor.id)
    expect(inside.length).toBeGreaterThan(0)
    for (const a of inside) {
      const n = parseInt(a.accountNumber, 10)
      expect(n, a.accountName).toBeGreaterThanOrEqual(60000)
      expect(n, a.accountName).toBeLessThanOrEqual(69999)
    }
  })
})
