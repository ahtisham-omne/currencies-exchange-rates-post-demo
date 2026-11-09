import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { DimensionsStep, SLOT_ANSWERS, type SlotDecision } from './ImportAccounts'
import type { SlotTally } from '../lib/codeMapper'

/* This step asks one question of each dimension of the number, and a piece of an
   account number can only be three things. Everything here guards that the
   question stays answerable: that the three answers are the only three, that an
   unanswered dimension reads as unanswered rather than as a decision, and that
   the values behind each row are visible, because they are the only evidence the
   customer has for what a dimension means. */

const TALLY: Record<number, SlotTally[]> = {
  0: [{ code: '01', rows: 40 }, { code: '02', rows: 4 }],
  1: [{ code: '11000', rows: 20 }, { code: '11100', rows: 12 }, { code: '12000', rows: 8 }, { code: '71100', rows: 4 }],
  2: [{ code: '40', rows: 22 }, { code: '50', rows: 22 }],
}

const UNANSWERED: SlotDecision = { target: { kind: 'unmapped' }, labels: {} }

function markup(over: {
  decisions?: SlotDecision[]
  accountLimit?: number
  errors?: Record<number, { target?: string; label?: string }>
} = {}) {
  const decisions = over.decisions ?? [UNANSWERED, UNANSWERED, UNANSWERED]
  return renderToStaticMarkup(createElement(DimensionsStep, {
    accountLimit: over.accountLimit ?? 2,
    decisions,
    setDecisions: () => {},
    valueCounts: [2, 20, 2],
    codes: (slot: number) => TALLY[slot] ?? [],
    refusal: null,
    refusedRows: [],
    onExcludeRefused: () => {},
    errors: over.errors ?? {},
    questions: [],
    choices: {},
    onChoose: () => {},
  }))
}

describe('the three things a dimension can be', () => {
  it('offers those three and nothing else', () => {
    expect(SLOT_ANSWERS.map(a => a.label)).toEqual(['GL account number', 'Dimension', 'Ignore'])
  })

  // Every answer says what it does to the digits, because that is the whole
  // difference between them and none of it is visible in the chart afterwards.
  it('says what each answer does rather than leaving the label to carry it', () => {
    for (const a of SLOT_ANSWERS) expect(a.tip.length).toBeGreaterThan(20)
  })

  /* An unexamined dimension is not a decision, and the old three-role control
     could not say so: it always had one role selected. The empty answer is what
     lets the footer block on "still to define". */
  it('leaves a dimension nobody has answered for showing nothing chosen', () => {
    expect(markup()).toContain('Choose')
  })
})

/* What the answer is worth is only readable from the values, so the row carries
   them: a dimension with two values across the whole file is a location, one
   with two hundred is the account number. */
describe('the evidence behind the answer', () => {
  it('counts the values and shows the first few', () => {
    const html = markup()
    expect(html).toContain('20 value')
    expect(html).toContain('>11000<')
  })

  it('keeps the rest reachable rather than dropping them at a bare count', () => {
    expect(markup()).toContain('more')
  })
})

/* A dimension is not finished until it has a label: an unnamed one has
   nothing to call itself in a report. The field appears with the answer rather
   than as a fourth column every row is asked for. */
describe('naming a dimension', () => {
  it('asks for a label once the dimension is called a filter', () => {
    const html = markup({ decisions: [{ target: { kind: 'filter', name: '' }, labels: {} }, UNANSWERED, UNANSWERED] })
    expect(html).toContain('Label for dimension 1')
  })

  it('asks for no label on the other two answers', () => {
    const html = markup({ decisions: [{ target: { kind: 'account' }, labels: {} }, { target: { kind: 'ignore' }, labels: {} }, UNANSWERED] })
    expect(html).not.toContain('Label for dimension')
  })
})

/* Next is never disabled here. Pressing it with dimensions still unanswered is
   how you find out which ones, so the marks arrive on the fields rather than
   the button refusing the press. Nothing is marked before that press. */
describe('marking what was left unanswered', () => {
  it('says nothing until the step has been submitted', () => {
    const html = markup()
    expect(html).not.toContain('Choose what this dimension is.')
    expect(html).not.toContain('Name this dimension.')
  })

  it('marks an unanswered dimension on its dropdown', () => {
    const html = markup({ errors: { 0: { target: 'Choose what this dimension is.' } } })
    expect(html).toContain('Choose what this dimension is.')
  })

  it('marks an unnamed filter on its label field, not on the dropdown above it', () => {
    const html = markup({
      decisions: [{ target: { kind: 'filter', name: '' }, labels: {} }, UNANSWERED, UNANSWERED],
      errors: { 0: { label: 'Name this dimension.' } },
    })
    expect(html).toContain('Name this dimension.')
    // The dropdown and the label field are joined on a shared border seam, so a
    // message between them would break the seam apart.
    expect(html.indexOf('Name this dimension.')).toBeGreaterThan(html.indexOf('Label for dimension 1'))
  })
})
