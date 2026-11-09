import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AccountTable, AccountTree, DEFAULT_COLUMNS, withAncestorContext } from './AccountTable'
import { buildChartIndex } from '../lib/chartTree'
import { useStore } from '../store'

const CHART = useStore.getState().accounts
const INDEX = buildChartIndex(CHART)

/* Searching PAYROLL finds three accounts in this chart and used to report twelve
   results, because the tree needs the nine summaries above them on screen to show
   each match in its place. Those nine are context, and the reader did not ask for
   them: counting them told the reader they had mistyped nothing while showing them
   rows that match nothing.

   The flat List view had the worse half of it. It has no hierarchy to place
   anything in, so it drew all nine as ordinary rows, indistinguishable from the
   three that actually answered. */
describe('a search counts its matches, not the tree it is drawn in', () => {
  const matches = CHART.filter(a => a.accountName.toLowerCase().includes('payroll'))
  const rows = withAncestorContext(CHART, matches, false)

  it('has something to search for', () => {
    expect(matches.length).toBeGreaterThan(0)
    expect(matches.every(a => a.glAccountType === 'Posting')).toBe(true)
  })

  it('hands back the matches unchanged, and first', () => {
    expect(rows.slice(0, matches.length)).toEqual(matches)
  })

  it('draws more rows than it found, which is why the two are counted apart', () => {
    expect(rows.length).toBeGreaterThan(matches.length)
  })

  // Every ancestor, or a match renders under the wrong heading or at the top level.
  it('adds every summary above every match', () => {
    const drawn = new Set(rows.map(a => a.id))
    for (const m of matches) {
      for (const p of INDEX.ancestorsOf(m.id)) {
        expect(drawn.has(p.id), `${m.accountNumber} is missing ${p.accountNumber}`).toBe(true)
      }
    }
  })

  it('adds nothing that is not one, and nothing twice', () => {
    const extras = rows.slice(matches.length)
    const matchedIds = new Set(matches.map(a => a.id))
    const wanted = new Set(matches.flatMap(m => INDEX.ancestorsOf(m.id).map(p => p.id)))
    expect(extras.every(a => wanted.has(a.id) && !matchedIds.has(a.id))).toBe(true)
    expect(new Set(rows.map(a => a.id)).size).toBe(rows.length)
  })

  /* An archived summary is off the chart, so it cannot be dragged back onto the
     listing by a live account underneath it. */
  it('leaves an archived summary out unless the reader asked for archived rows', () => {
    const parent = CHART.find(a => a.glAccountType === 'Summary' && a.parentId)!
    const child = CHART.find(a => a.parentId === parent.id)!
    const chart = CHART.map(a => (a.id === parent.id ? { ...a, status: 'Archived' as const } : a))
    expect(withAncestorContext(chart, [child], false).some(a => a.id === parent.id)).toBe(false)
    expect(withAncestorContext(chart, [child], true).some(a => a.id === parent.id)).toBe(true)
  })

  it('adds nothing when nothing matched, so the empty state has an empty table to sit in', () => {
    expect(withAncestorContext(CHART, [], false)).toEqual([])
  })
})

/* A no-match search used to leave a full header row over an empty body, which
   reads as a chart with no accounts in it rather than as a search that found none.
   Both views take the state as a prop, because only the page that narrowed knows
   what narrowed it and how to undo that. */
describe('an empty table says why it is empty', () => {
  const NOTE = 'No accounts match the term zzz'
  const render = (component: unknown) => renderToStaticMarkup(
    createElement(MemoryRouter, null,
      createElement(component as any, {
        accounts: [], query: 'zzz', density: 'condensed', columns: DEFAULT_COLUMNS,
        onAction: () => {}, onOpen: () => {}, onToggle: () => {}, onToggleGroup: () => {},
        expanded: new Set(), collapsedGroups: new Set(), readOnly: true,
        emptyState: createElement('p', null, NOTE),
      })))

  it('in the flat list', () => {
    expect(render(AccountTable)).toContain(NOTE)
  })

  it('in the tree', () => {
    expect(render(AccountTree)).toContain(NOTE)
  })

  // Omitted, an empty table is still just an empty table: every other caller
  // (the import preview, the setup builders) keeps the behaviour it had.
  it('and stays silent when the caller says nothing', () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null,
        createElement(AccountTable as any, {
          accounts: [], query: '', density: 'condensed', columns: DEFAULT_COLUMNS,
          onAction: () => {}, onOpen: () => {}, readOnly: true,
        })))
    expect(html).not.toContain('No accounts match')
  })
})
