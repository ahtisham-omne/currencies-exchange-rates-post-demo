import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_NUMBER_WIDTH, categoryFirstNumber, CATEGORY_ORDER } from '../types'
import {
  AccountNumberingStep, schemeFromNumberWidth, numberWidthValid, defaultCategoryRanges,
  NUMBERING_STEP_TITLE, NUMBERING_STEP_SUBTITLE,
} from './AccountNumberingStep'

// The numbering step is the first step of three separate flows (upload, build from
// scratch, guided setup), each of which draws its own heading and step tabs. It
// asks how wide a suggested number is, and states the block each category
// keeps - editable where the host builds the chart (2026-10-01, Mahad: *"We had
// setting up the ranges in the first-time view before. Can we bring it back?"*).
// `render` is the read-only host (an import); `renderEditable` passes ranges.
const render = (digits: number) =>
  renderToStaticMarkup(createElement(AccountNumberingStep as any, { digits, onChange: () => {} }))
const renderEditable = (digits: number) =>
  renderToStaticMarkup(createElement(AccountNumberingStep as any, { digits, onChange: () => {}, ranges: defaultCategoryRanges(digits), onRangesChange: () => {} }))
// A block as the step draws it: a From field and a To field holding its ends.
const holdsBlock = (html: string, from: number, to: number) =>
  html.includes(`value="${from}"`) && html.includes(`value="${to}"`)

describe('numbering step - hosted inside each setup path', () => {
  it('claims no step number and no heading of its own', () => {
    const html = render(DEFAULT_NUMBER_WIDTH)
    expect(html).not.toContain('Step 2 of 3')
    expect(html).not.toContain('<h1')
    expect(html).not.toContain('Configure your numbering scheme')
  })

  it('offers the same wording to every flow that hosts it', () => {
    // Mahad's copy, 2026-10-02.
    expect(NUMBERING_STEP_TITLE).toBe('Set up your account numbers')
    for (const line of [NUMBERING_STEP_TITLE, NUMBERING_STEP_SUBTITLE]) {
      expect(line).not.toContain('—')
      expect(line).not.toContain('–')
      expect(line).not.toContain('’')
    }
    expect(NUMBERING_STEP_SUBTITLE.endsWith('.')).toBe(true)
  })

  /* Design review, 2026-09-24: a chart Omne builds keeps a block of numbers for
     each category and group, cut at this width. Said as a default the reader can
     change, not as a rule about what their numbers may be. */
  it('says what the step is for, before any account exists', () => {
    expect(NUMBERING_STEP_SUBTITLE).toBe('Choose how your account numbers will look before you add accounts.')
    expect(NUMBERING_STEP_SUBTITLE).not.toContain('nothing is reserved')
    expect(NUMBERING_STEP_SUBTITLE).not.toContain('how your financial reports are built')
  })

  it('asks for a number length, and states each category\'s range', () => {
    const html = render(DEFAULT_NUMBER_WIDTH)
    expect(html).toContain('Default account number length')
    /* The length is what gets suggested, not what gets enforced: an account number
       can carry letters and be any length, so the helper must not promise that
       every number in the chart is this many digits. */
    expect(html).toContain('This only affects the numbers Omne suggests.')
    expect(html).toContain('Set the range of numbers each category can use.')
    expect(html).toContain('Number ranges by category')
    expect(html).toContain('>From<')
    expect(html).toContain('>To<')
  })

  // Edited only where the flow builds the chart; an import brings its own.
  it('offers Edit ranges only to a host that passes ranges, and opens locked', () => {
    expect(render(DEFAULT_NUMBER_WIDTH)).not.toContain('Edit ranges')
    const html = renderEditable(DEFAULT_NUMBER_WIDTH)
    expect(html).toContain('Edit ranges')
    expect(html.match(/<input[^>]*disabled/g)).toHaveLength(10)
  })

  /* One width, asked once. The step used to ask a shortest and a longest, which
     put two steppers on the line and left the reader deciding which of them the
     heading was about. */
  it('asks a single width, with nothing left of the pair it replaced', () => {
    const html = render(4)
    expect(html).not.toContain('Shortest')
    expect(html).not.toContain('Longest')
    expect(html).not.toContain('as a category fills up')
    expect(html.match(/one more digit/g)).toHaveLength(1)
  })

  it('shows the block each category keeps', () => {
    const html = render(4)
    for (const label of ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses']) {
      expect(html).toContain(label)
    }
    expect(holdsBlock(html, 1000, 1999)).toBe(true)
    expect(holdsBlock(html, 5000, 5999)).toBe(true)
    // Each category is one digit's worth, so nothing runs into the next one.
    expect(html).not.toContain('8999')
  })

  /* The notes under the table are gone on every path (Mahad, 2026-10-02:
     *"Can you remove this from both?"*): the cascade line, the protection rule
     and the "these are defaults" line. */
  it('prints no notes under the blocks', () => {
    const ranges = defaultCategoryRanges(5)
    const editable = renderToStaticMarkup(createElement(AccountNumberingStep as any, { digits: 5, onChange: () => {}, ranges, onRangesChange: () => {} }))
    for (const html of [render(5), editable]) {
      expect(html).not.toContain('Each level down keeps a smaller block')
      expect(html).not.toContain('Number protection also keeps')
      expect(html).not.toContain('These are defaults')
      expect(html).not.toContain('<ul')
    }
  })

  /* The zeros go on the right. A width is room to count up through, and padding
     the left would put a digit on the page that buys the reader nothing: 01000
     still leaves a thousand numbers under assets, where 10000 leaves ten. */
  it('grows the example rightwards as the length goes up', () => {
    expect(holdsBlock(render(5), 10000, 19999)).toBe(true)
    expect(holdsBlock(render(6), 100000, 199999)).toBe(true)
    expect(holdsBlock(render(8), 10000000, 19999999)).toBe(true)
    expect(holdsBlock(render(3), 100, 199)).toBe(true)
    for (const digits of [3, 5, 6, 8]) {
      expect(render(digits)).not.toContain('>01000<')
      expect(render(digits)).not.toContain('>001000<')
    }
  })

  it('opens on the default width, and reads it back off the stepper', () => {
    expect(DEFAULT_NUMBER_WIDTH).toBe(5)
    const html = render(DEFAULT_NUMBER_WIDTH)
    expect(html).toContain(`>${DEFAULT_NUMBER_WIDTH}<`)
    for (const code of CATEGORY_ORDER) {
      const first = categoryFirstNumber(code, DEFAULT_NUMBER_WIDTH)
      expect(holdsBlock(html, first, first + 10 ** (DEFAULT_NUMBER_WIDTH - 1) - 1)).toBe(true)
    }
  })
})

describe('numbering step - what a flow may advance on', () => {
  it('accepts every length the stepper can reach', () => {
    for (const digits of [4, 5, 6, 7, 8]) expect(numberWidthValid(digits)).toBe(true)
  })

  // Never below four (decision 40; module review, 2026-10-06, COA-14).
  it('refuses a width outside the offered bounds', () => {
    expect(numberWidthValid(3)).toBe(false)
    expect(numberWidthValid(2)).toBe(false)
    expect(numberWidthValid(9)).toBe(false)
  })

  it('produces a flat scheme at the width asked for, and reserves nothing', () => {
    const scheme = schemeFromNumberWidth(4)
    expect(scheme.segments).toHaveLength(1)
    expect(scheme.segments[0].length).toBe(4)
    expect(scheme.segments[0].separator).toBe('')
    expect(scheme).not.toHaveProperty('sectionRanges')
  })

  /* The width lives on the account segment and nowhere else. It used to be
     copied onto the scheme as a min and a max as well, which nothing read and
     which invited a reader to think one of them refused something. */
  it('carries the width on the segment alone', () => {
    const scheme = schemeFromNumberWidth(3)
    expect(scheme.segments[0].length).toBe(3)
    expect(scheme).not.toHaveProperty('minLength')
    expect(scheme).not.toHaveProperty('maxLength')
  })
})
