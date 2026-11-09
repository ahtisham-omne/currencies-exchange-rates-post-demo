import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WizardRightPane } from './WizardRightPane'
import { BASELINE_ENTRIES, EMPTY_GUIDED_ANSWERS, computeGuidedChart } from '../lib/guidedSetup'

// The pane is the live answer to "what am I getting", and the guided wizard's
// most load-bearing screen furniture. What is pinned here is what the reader can
// see before touching anything: the baseline is present but closed, and the
// additions list reads as prose rather than a shouted label.

const core = computeGuidedChart(EMPTY_GUIDED_ANSWERS, false)
const added = computeGuidedChart({ ...EMPTY_GUIDED_ANSWERS, activities: ['resell'] }, false)
  .filter(e => !core.some(c => c.number === e.number))

const render = (props: Partial<Parameters<typeof WizardRightPane>[0]> = {}) =>
  renderToStaticMarkup(createElement(WizardRightPane, {
    newEntries: [],
    priorCount: core.filter(e => e.posting === 'Posting').length,
    fullAccounts: [],
    emptyHint: 'Answer a question.',
    title: 'Adding from your answers',
    hideChartChip: true,
    ...props,
  }))

describe('wizard right pane', () => {
  it('heads its list in sentence case, not shouted', () => {
    const html = render()
    expect(html).toContain('Adding from your answers')
    expect(html).not.toContain('uppercase tracking-wider text-fg-subtle font-semibold')
  })

  it('shows the always-included baseline, closed', () => {
    const html = render({ coreEntries: core })
    expect(html).toContain('Core accounts (always included)')
    expect(html).toContain('aria-expanded="false"')
    // Closed means closed: the names are behind the disclosure, not merely hidden.
    expect(html).not.toContain(BASELINE_ENTRIES[0].name)
  })

  it('counts the baseline in posting accounts, the only ones the reader recognises', () => {
    const html = render({ coreEntries: core })
    const postings = core.filter(e => e.posting === 'Posting').length
    expect(html).toContain(`>${postings}<`)
    expect(postings).toBeLessThan(core.length)
  })

  it('leaves the disclosure out of a flow that passes no baseline', () => {
    expect(render()).not.toContain('Core accounts')
  })

  it('still lists what the answers added, and counts it', () => {
    const html = render({ newEntries: added, coreEntries: core })
    expect(added.length).toBeGreaterThan(0)
    for (const e of added.filter(e => e.posting === 'Posting')) expect(html, e.number).toContain(e.name)
    expect(html).toContain('new')
  })

  it('says nothing was added yet with the hint it was given', () => {
    const html = render({ emptyHint: 'Answer a question to see what else we\'ll add.' })
    expect(html).toContain('Nothing added yet')
    expect(html).toContain('Answer a question to see what else we')
  })
})
