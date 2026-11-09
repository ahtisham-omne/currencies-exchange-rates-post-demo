import { describe, it, expect } from 'vitest'
import { applyFilters, clearPanelFilters, countDimensionsActive, countFiltersActive, countNarrowing, EMPTY_FILTERS, type FilterState } from './Filters'
import { useStore } from '../store'
import type { Account } from '../types'

/* A dimension is only worth having if it answers the question the import
   promised it would: "mark dimension 1 as Location and you can pull up every
   account in London". Asking whether an account carries a Location at all -
   which is what this facet used to ask - answers nothing anyone wanted to know.

   So what is guarded here is the shape of the answer: values inside one group
   filter widen the set, and dimensions narrow each other. That is the way a
   reader says it out loud, and it is the one part of this that cannot be seen
   by looking at the screen. */

const seed = useStore.getState().accounts[0]
const account = (id: string, values: [string, string][]): Account => ({
  ...seed,
  id,
  defaultDimensionValues: values.map(([dimensionId, value]) => ({ dimensionId, value })),
})

const LOC = 'loc'
const DEPT = 'dept'

const CHART = [
  account('a', [[LOC, 'London'], [DEPT, 'Marketing']]),
  account('b', [[LOC, 'London'], [DEPT, 'Finance']]),
  account('c', [[LOC, 'Manchester'], [DEPT, 'Marketing']]),
  account('d', [[LOC, 'Leeds']]),
  account('e', []),
]

const asking = (dimensionValues: FilterState['dimensionValues']): FilterState =>
  ({ ...EMPTY_FILTERS, dimensionValues })
const ids = (f: FilterState) => applyFilters(CHART, f).map(a => a.id)

describe('filtering by a dimension value', () => {
  it('pulls up the accounts carrying that one value', () => {
    expect(ids(asking({ [LOC]: ['London'] }))).toEqual(['a', 'b'])
  })

  it('widens within one dimension, so two cities means either', () => {
    expect(ids(asking({ [LOC]: ['London', 'Leeds'] }))).toEqual(['a', 'b', 'd'])
  })

  it('narrows across dimensions, so a city and a department means both', () => {
    expect(ids(asking({ [LOC]: ['London', 'Manchester'], [DEPT]: ['Marketing'] }))).toEqual(['a', 'c'])
  })

  it('drops an account that carries no value for a dimension being asked about', () => {
    // Leeds has no department, so a question about departments excludes it.
    expect(ids(asking({ [DEPT]: ['Marketing', 'Finance'] }))).not.toContain('d')
    expect(ids(asking({ [DEPT]: ['Marketing', 'Finance'] }))).not.toContain('e')
  })

  it('asks nothing when a dimension is present but holds no values', () => {
    expect(ids(asking({ [LOC]: [] }))).toEqual(CHART.map(a => a.id))
    expect(ids(EMPTY_FILTERS)).toEqual(CHART.map(a => a.id))
  })

  it('keeps a value that is on no account from silently matching everything', () => {
    expect(ids(asking({ [LOC]: ['Bristol'] }))).toEqual([])
  })
})

describe('which button wears the count', () => {
  /* Dimensions have their own toolbar button now, so the two badges divide the
     filter set between them rather than both reporting parts of it. Guarded
     because getting it wrong is invisible until a reader wonders why Filters
     says 3 and shows nothing, or why Clear all emptied a control it never
     showed. */
  it('counts each value asked for on the Dimensions button', () => {
    expect(countDimensionsActive(asking({}))).toBe(0)
    expect(countDimensionsActive(asking({ [LOC]: [] }))).toBe(0)
    expect(countDimensionsActive(asking({ [LOC]: ['London'] }))).toBe(1)
    expect(countDimensionsActive(asking({ [LOC]: ['London', 'Leeds'], [DEPT]: ['Marketing'] }))).toBe(3)
  })

  it('leaves them out of the Filters button, which no longer edits them', () => {
    expect(countFiltersActive(asking({ [LOC]: ['London', 'Leeds'], [DEPT]: ['Marketing'] }))).toBe(0)
    // The facets the panel does own still count, dimensions or no dimensions.
    expect(countFiltersActive({ ...asking({ [LOC]: ['London'] }), statuses: ['Active'] })).toBe(1)
  })

  it('adds up to everything narrowing the chart', () => {
    const both = { ...asking({ [LOC]: ['London'] }), statuses: ['Active' as const] }
    expect(countNarrowing(both)).toBe(2)
  })

  it('starts at nothing, so an unopened button wears no badge', () => {
    expect(EMPTY_FILTERS.dimensionValues).toEqual({})
    expect(countFiltersActive(EMPTY_FILTERS)).toBe(0)
    expect(countDimensionsActive(EMPTY_FILTERS)).toBe(0)
  })
})

describe('clearing one control does not clear the other', () => {
  it('keeps the dimension picks when the Filters panel is cleared', () => {
    const held = { ...asking({ [LOC]: ['London'] }), statuses: ['Active' as const], currencies: ['GBP'] }
    const cleared = clearPanelFilters(held)
    expect(cleared.statuses).toEqual([])
    expect(cleared.currencies).toEqual([])
    expect(cleared.dimensionValues).toEqual({ [LOC]: ['London'] })
  })

  it('still filters by the dimensions it kept', () => {
    expect(ids(clearPanelFilters({ ...asking({ [LOC]: ['London'] }), statuses: ['Archived'] }))).toEqual(['a', 'b'])
  })
})
