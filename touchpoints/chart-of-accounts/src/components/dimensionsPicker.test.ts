import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { dimensionFacetsOf } from './DimensionsPicker'
import { useStore } from '../store'
import type { Account } from '../types'

/* The dimension filters came out of the Filters panel and onto the quick-filter
   pill row, in a control of their own. Two things are worth pinning: that they
   left (a filter reachable from two controls is two controls disagreeing about
   one answer), and that the panel behind the pill is the period picker's panel
   rather than a second invention of it. */

const picker = readFileSync(new URL('./DimensionsPicker.tsx', import.meta.url), 'utf8')
const filters = readFileSync(new URL('./Filters.tsx', import.meta.url), 'utf8')
const page = readFileSync(new URL('../pages/ChartOfAccounts.tsx', import.meta.url), 'utf8')
const period = readFileSync(new URL('./AccountingPeriodPicker.tsx', import.meta.url), 'utf8')

const seed = useStore.getState().accounts[0]
const account = (values: [string, string][]): Account => ({
  ...seed,
  defaultDimensionValues: values.map(([dimensionId, value]) => ({ dimensionId, value })),
})

const dim = (id: string, name: string, values: string[], status = 'Active') => ({ id, name, values, status })

describe('the values a dimension offers', () => {
  it('offers the declared values in the order they were declared', () => {
    // Not sorted: the reader wrote the list, and the order they wrote it in is
    // the order they think about it in.
    const [loc] = dimensionFacetsOf([dim('loc', 'Location', ['London', 'Aberdeen', 'Leeds'])], [])
    expect(loc.values).toEqual(['London', 'Aberdeen', 'Leeds'])
  })

  it('adds a value the accounts carry that the dimension no longer declares', () => {
    /* Otherwise taking a value off a dimension strands every account still
       holding it: the rows exist, and nothing in the panel can pull them up.
       The stranded tail is sorted, since nobody chose an order for it. */
    const [loc] = dimensionFacetsOf(
      [dim('loc', 'Location', ['London'])],
      [account([['loc', 'Perth']]), account([['loc', 'Dundee']])],
    )
    expect(loc.values).toEqual(['London', 'Dundee', 'Perth'])
  })

  it('counts the accounts on each value', () => {
    const [loc] = dimensionFacetsOf(
      [dim('loc', 'Location', ['London', 'Leeds'])],
      [account([['loc', 'London']]), account([['loc', 'London']]), account([['loc', 'Leeds']])],
    )
    expect(loc.counts).toEqual({ London: 2, Leeds: 1 })
  })

  it('leaves out a retired dimension, and one with nothing to offer yet', () => {
    const facets = dimensionFacetsOf([
      dim('loc', 'Location', ['London']),
      dim('old', 'Cost centre', ['A'], 'Inactive'),
      dim('empty', 'Project', []),
    ], [])
    expect(facets.map(f => f.id)).toEqual(['loc'])
  })

  /* Mahad, 2026-10-13: Location ticked, Engineering read 4, and ticking it
     emptied the table. The ticks across dimensions combine, so each dimension's
     counts take the others' ticks; its own are left out, so each count says
     what ticking that value would show. */
  it('counts each value under the ticks of the other dimensions, not its own', () => {
    const accounts = [
      account([['loc', 'USA'], ['dept', 'Engineering']]),
      account([['loc', 'Singapore'], ['dept', 'Engineering']]),
      account([['loc', 'Singapore'], ['dept', 'Sales']]),
    ]
    const dims = [dim('loc', 'Location', ['USA', 'Singapore']), dim('dept', 'Department', ['Engineering', 'Sales'])]
    const [loc, dept] = dimensionFacetsOf(dims, accounts, { loc: ['USA'] })
    expect(dept.counts).toEqual({ Engineering: 1 })
    expect(loc.counts).toEqual({ USA: 1, Singapore: 2 })
    // A value carried only off the ticked rows is still offered.
    expect(dept.values).toEqual(['Engineering', 'Sales'])
  })

  it('counts the whole chart, not what the other filters left', () => {
    /* A value reading 0 should mean no account carries it, never "no account
       carries it and also matches your status filter" - which would make the
       counts change under a reader who is trying to use them to decide. */
    expect(picker).toContain('The whole chart, unfiltered')
    expect(page).toContain('accounts={accounts}')
  })
})

describe('one filter, edited from two controls', () => {
  it('writes the same dimensionValues the Filters panel used to', () => {
    expect(picker).toContain('setFilters({ ...filters, dimensionValues: next })')
    // No draft of its own: a dropdown applies on the click, so a second copy of
    // the picks could only ever be a copy that has gone stale.
    expect(picker).not.toMatch(/useState<FilterState>/)
  })

  it('still applies every dimension pick when filtering', () => {
    expect(filters).toContain('for (const [id, values] of Object.entries(f.dimensionValues))')
  })

  it('takes the Dimensions section out of the Filters panel', () => {
    expect(filters).not.toContain('Your own ways of grouping accounts')
    expect(filters).not.toContain('toggleDimension')
  })

  it('splits the two badges, so neither reports the other\'s filters', () => {
    expect(filters).toContain('export function countDimensionsActive')
    // The Filters count is built from the facets the panel shows, and dimensions
    // are not among them.
    const body = filters.match(/export function countFiltersActive[\s\S]*?\n\}/)![0]
    expect(body).toContain('f.statuses.length')
    expect(body).not.toContain('dimensionValues')
  })

  it('leaves the dimension picks standing when the Filters panel is cleared', () => {
    expect(filters).toContain('export const clearPanelFilters')
    expect(page).toContain('onClear={() => setFilters(clearPanelFilters(filters))}')
  })

  it('owns up to a dimension pick in the empty state', () => {
    // "No accounts match these filters" has to mean every filter, or the reader
    // is told to widen a filter the page will not admit to holding.
    expect(page).toContain('countNarrowing(filters) > 0')
  })

  it('clears every dimension from Reset, not just the pane in view', () => {
    expect(picker).toContain("setFilters({ ...filters, dimensionValues: {} })")
    expect(picker).toContain('>Reset<')
  })
})

describe('the panel is the period picker\'s panel', () => {
  it('sits at the same rail width', () => {
    expect(picker).toContain('const RAIL_W = 176')
    expect(period).toContain('const RAIL_W = 176')
  })

  it('is portalled and placed the same way, flip included', () => {
    for (const line of [
      'createPortal(',
      "position: 'fixed'",
      "transformOrigin: pos?.flip ? 'bottom left' : 'top left'",
      "visibility: pos ? undefined : 'hidden'",
      'max-w-[calc(100vw-16px)] bg-white border border-border rounded-xl shadow-lg overflow-hidden',
    ]) {
      expect(picker, line).toContain(line)
      expect(period, line).toContain(line)
    }
  })

  it('wears the rail tint on the pane in view and the row tint on a pick', () => {
    // The rail's stronger `bg-accent` is what says "which panel you are looking
    // at"; a picked row is the subtler `bg-primary/5`. Swapping them would make
    // the two mean each other's thing.
    expect(picker).toContain("on ? 'bg-accent text-primary' : 'text-fg hover:bg-bg-subtle'")
    expect(picker).toContain("on ? 'bg-primary/5' : 'hover:bg-muted/50'")
  })

  it('borrows the Filters panel\'s own checkbox and its search field', () => {
    expect(picker).toContain("on ? 'bg-primary border-primary' : 'border-border-strong bg-white'")
    expect(picker).toContain("cn(FILTER_INPUT_CLS, 'pl-8 pr-8')")
  })

  it('stands with the quick-filter pills, not beside the Filters button', () => {
    // Beside Filters it read as a second filter panel next to the first. It
    // slices the chart the way Me mode and the category pills do, so it stands
    // where they do - between Me mode and the divider ahead of Show All.
    const me = page.indexOf('label="Me mode"')
    const dims = page.indexOf('<DimensionsPicker')
    const showAll = page.indexOf('label="Show All"')
    expect(me).toBeGreaterThan(-1)
    expect(dims).toBeGreaterThan(me)
    expect(showAll).toBeGreaterThan(dims)
    expect(page.indexOf('<FiltersButton')).toBeLessThan(me)
  })

  it('wears the quick-filter pill\'s own shape and tint', () => {
    // Not a near-copy: the same rounded-full pill, the same active tint, and the
    // same faint count the category pills carry.
    expect(picker).toContain('px-3 py-1.5 rounded-full border text-xs')
    expect(picker).toContain("'border-primary bg-accent hover:bg-[#DBEAFE] active:bg-[#BFDBFE]'")
    expect(filters).toContain("'border-primary bg-accent hover:bg-[#DBEAFE] active:bg-[#BFDBFE]'")
  })
})
