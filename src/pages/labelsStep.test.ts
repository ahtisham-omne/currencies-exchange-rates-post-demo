import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { LabelsStep } from './ImportAccounts'
import { VALUE_MEANS_NOTHING, type SlotTally } from '../lib/codeMapper'
import type { SlotMeaning } from '../lib/importSplit'

/* The naming step is a nested table: one collapsible band per dimension over the
   same Value / Used by / Name grid the values are named in - the collapse the
   account list itself is read by. The first band opens so the step never lands
   empty; the rest are shut, carrying only how far their naming has got. The bulk
   routes that once sat beside the typing - a paste, a lift from a column, a
   running tally that read as an unfinished job - are gone. */

const CODES: Record<number, SlotTally[]> = {
  0: [{ code: '01', rows: 40 }, { code: '02', rows: 3 }, { code: '03', rows: 1 }],
  1: [{ code: 'N', rows: 9 }, { code: 'S', rows: 4 }],
}

function markup(over: { slots?: SlotMeaning[] } = {}) {
  const slots: SlotMeaning[] = over.slots ?? [
    { slot: 0, name: 'Department', labels: {} },
    { slot: 1, name: 'Region', labels: {} },
  ]
  return renderToStaticMarkup(createElement(LabelsStep, {
    slots,
    setLabel: () => {},
    codes: (slot: number) => CODES[slot] ?? [],
  }))
}

describe('the naming step as a nested table', () => {
  it('bands each dimension by name over one Value / Used by / Name grid', () => {
    const html = markup()
    expect(html).toContain('Department')
    expect(html).toContain('Region')
    expect(html).toContain('>Value<')
    expect(html).toContain('>Used by<')
    expect(html).toContain('>Name<')
  })

  it('carries how far each dimension has got on its band, named against total', () => {
    const html = markup({ slots: [
      { slot: 0, name: 'Department', labels: { '01': 'Head office' } },
      { slot: 1, name: 'Region', labels: {} },
    ] })
    expect(html).toContain('1 of 3 named')
    expect(html).toContain('0 of 2 named')
  })

  it('opens the first dimension so the step never lands empty, and folds the rest', () => {
    const html = markup()
    // The first band's values are named-in; the second stays folded.
    expect(html).toContain('40 accounts')
    expect(html).toContain('1 account<')
    expect(html).not.toContain('9 accounts')
  })

  it('offers a search over the values and no bulk route beside it', () => {
    const html = markup()
    expect(html).toContain('placeholder="Search values"')
    expect(html).not.toContain('Hide named')
    expect(html).not.toContain('Take names from a column')
    expect(html).not.toContain('Paste names')
    expect(html).not.toContain('named, covering')
  })

  /* The name box on an excluded value says so rather than sitting empty beside
     two boxes that are empty because nobody has typed in them yet. */
  it('says excluded in place of the name on a value marked so', () => {
    const html = markup({ slots: [{ slot: 0, name: 'Department', labels: { '01': VALUE_MEANS_NOTHING } }] })
    expect(html).toContain('placeholder="Excluded"')
    expect(html).toContain('placeholder="Optional"')
  })
})
