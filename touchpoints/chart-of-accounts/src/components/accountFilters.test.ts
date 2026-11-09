import { describe, it, expect } from 'vitest'
import { applyFilters, countFiltersActive, EMPTY_FILTERS } from './Filters'
import { invertedDates, invertedRange, withinMagnitude } from '../lib/utils'
import { useStore } from '../store'
import { CATEGORY_ORDER, GL_ACCOUNT_TYPES } from '../types'

const CHART = useStore.getState().accounts

/* The chart has two facts about an account that both used to be called its
   "type": which of the five categories it belongs to, and whether it is a
   Posting or a Summary account. The panel offered one filter headed "Account
   type" and filled it with Asset and Liability, so the reader looking for the
   summary accounts opened the right control and found the wrong question. */
describe('category and GL account type are two filters', () => {
  it('cuts the chart by category', () => {
    for (const cat of CATEGORY_ORDER) {
      const kept = applyFilters(CHART, { ...EMPTY_FILTERS, categories: [cat] })
      expect(kept.length, cat).toBeGreaterThan(0)
      expect(kept.every(a => a.accountType === cat), cat).toBe(true)
    }
  })

  it('cuts the chart by Posting or Summary', () => {
    for (const t of GL_ACCOUNT_TYPES) {
      const kept = applyFilters(CHART, { ...EMPTY_FILTERS, glTypes: [t] })
      expect(kept.length, t).toBeGreaterThan(0)
      expect(kept.every(a => a.glAccountType === t), t).toBe(true)
    }
  })

  it('narrows on both at once, rather than one replacing the other', () => {
    const both = applyFilters(CHART, { ...EMPTY_FILTERS, categories: ['AST'], glTypes: ['Summary'] })
    expect(both.length).toBeGreaterThan(0)
    expect(both.every(a => a.accountType === 'AST' && a.glAccountType === 'Summary')).toBe(true)
    const byCategory = applyFilters(CHART, { ...EMPTY_FILTERS, categories: ['AST'] })
    expect(both.length).toBeLessThan(byCategory.length)
  })

  // The badge on the Filters button counts what is being asked, so a filter the
  // panel offers and the count ignores is a filter the reader cannot see applied.
  it('counts on the badge, each value once', () => {
    expect(countFiltersActive({ ...EMPTY_FILTERS, categories: ['AST', 'LIA'], glTypes: ['Posting'] })).toBe(3)
    expect(countFiltersActive(EMPTY_FILTERS)).toBe(0)
  })
})

/* A minimum above a maximum matches nothing there could ever be, and every
   filter surface in the module used to accept it in silence: the table went
   empty and nothing said which of the two numbers was the problem. */
describe('a range whose ends cross', () => {
  it('is inverted when the minimum is above the maximum', () => {
    expect(invertedRange('100', '10')).toBe(true)
    expect(invertedRange('10', '100')).toBe(false)
    expect(invertedRange('10', '10')).toBe(false)
  })

  // Negative balances are ordinary here: a liability account carries one.
  it('reads negative bounds by value, not by the digits', () => {
    expect(invertedRange('-10', '-100')).toBe(true)
    expect(invertedRange('-100', '-10')).toBe(false)
  })

  /* One end open is the ordinary way to ask for "at least this much", and a
     half-typed number is not yet a question. Neither is an error. */
  it('is not inverted when either end is left open', () => {
    expect(invertedRange('100', '')).toBe(false)
    expect(invertedRange('', '10')).toBe(false)
    expect(invertedRange('', '')).toBe(false)
    expect(invertedRange('-', '10')).toBe(false)
  })

  /* An amount range bounds a size, so its ends are compared as sizes too -
     otherwise the warning and the matching would read the same pair of numbers
     differently, and the panel would go quiet on a range that matches nothing. */
  it('reads a magnitude range by size once it is told the range is one', () => {
    expect(invertedRange('-100', '10', true)).toBe(true)
    expect(invertedRange('-100', '10')).toBe(false)
    expect(invertedRange('-10', '100', true)).toBe(false)
  })

  it('reads a From after a To the same way', () => {
    expect(invertedDates('2026-03-01', '2026-01-01')).toBe(true)
    expect(invertedDates('2026-01-01', '2026-03-01')).toBe(false)
    expect(invertedDates('2026-01-01', '2026-01-01')).toBe(false)
    expect(invertedDates('2026-01-01', '')).toBe(false)
  })

  /* Told, not corrected. The filter still applies as typed, because quietly
     swapping the two numbers would show the reader a set they did not ask for
     and give them no way to tell that it happened. */
  it('still applies as typed, matching nothing', () => {
    expect(applyFilters(CHART, { ...EMPTY_FILTERS, balanceMin: '100', balanceMax: '10' })).toEqual([])
  })
})

/* A posting is either a debit or a credit, and its amount is the size of it. A
   reader copying a figure off a statement writes the credit down the way it
   appeared there, minus sign and all, and used to get an empty table for it. */
describe('an amount bound is a size', () => {
  it('admits the same posting whichever way the bound is signed', () => {
    expect(withinMagnitude(23.45, '-23.45', '')).toBe(true)
    expect(withinMagnitude(23.45, '23.45', '')).toBe(true)
    expect(withinMagnitude(23.45, '', '-23.45')).toBe(true)
    expect(withinMagnitude(23.45, '', '23.45')).toBe(true)
  })

  it('bars the same posting whichever way the bound is signed', () => {
    expect(withinMagnitude(10, '-23.45', '')).toBe(false)
    expect(withinMagnitude(10, '23.45', '')).toBe(false)
    expect(withinMagnitude(100, '', '-23.45')).toBe(false)
    expect(withinMagnitude(100, '', '23.45')).toBe(false)
  })

  it('holds both ends at once', () => {
    expect(withinMagnitude(50, '-10', '-100')).toBe(true)
    expect(withinMagnitude(5, '-10', '-100')).toBe(false)
    expect(withinMagnitude(500, '-10', '-100')).toBe(false)
  })

  // An end left open is no bound, and a half-typed number is not yet a question.
  it('lets an open or half-typed end through', () => {
    expect(withinMagnitude(23.45, '', '')).toBe(true)
    expect(withinMagnitude(23.45, '-', '')).toBe(true)
    expect(withinMagnitude(23.45, '', '-')).toBe(true)
  })
})
