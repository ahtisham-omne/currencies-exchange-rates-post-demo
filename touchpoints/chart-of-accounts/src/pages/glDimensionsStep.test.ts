import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STEP_LABEL, DimensionDefaultsEditor } from './CreateAccount'
import type { Dimension } from '../types'

/* Dimension defaults get their own step in GL creation, and read as a card per
   dimension the account carries: the dimension, and the value every posting on
   the account starts with.

   Mahad, 2026-09-29: *"the current UI doesn't look good; it feels very clunky,
   and the layout isn't intuitive or easy to understand"* - naming the Partners
   module's Freight & Logistics modal as the shape to take.

   What that replaced was a table listing every dimension the tenant had ever
   defined, answered or not, under two captions: "Set on this account" and
   "Available, not applied". Those captions existed to answer a real complaint -
   defining a dimension from one account makes it *offered* on every account, and
   a table that listed it everywhere read as *applied* everywhere. Cards settle
   that by construction rather than by labelling around it: only what the account
   carries is drawn, so there is no second group left to misread. What is merely
   available now lives inside the Dimension dropdown, which is where a list of
   things you could pick belongs.

   Nothing here asserts what is inside a picker. `Select` builds its options from
   its children but only renders them once the menu is open, so an option's label
   never reaches this markup - the create rows included. Those are checked
   against the source instead. */

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8')

const DIMS: Dimension[] = [
  { id: 'd1', name: 'Location', values: ['London', 'Singapore'], status: 'Active', createdAt: '', updatedAt: '' },
  { id: 'd2', name: 'Department', values: ['Design', 'Sales'], status: 'Active', createdAt: '', updatedAt: '' },
]

const render = (value: { dimensionId: string; value: string }[], dimensions = DIMS, extra: object = {}) =>
  renderToStaticMarkup(createElement(DimensionDefaultsEditor, { dimensions, value, onChange: () => {}, ...extra }))

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')

describe('dimensions, as a step of GL creation', () => {
  it('is a step in its own right, named for what it holds', () => {
    expect(STEP_LABEL.dimensions).toBe('Dimensions')
    /* Its old home. The defaults used to hang off the bottom of this step, which
       is named for itself and not for the card it opens with - Mahad,
       2026-09-22: *"rename the first step simply to 'Details'."* The card inside
       it still says "GL account details"; the tab no longer says it twice. */
    expect(STEP_LABEL.details).toBe('Details')
  })
})

describe('a dimension card', () => {
  const html = render([{ dimensionId: 'd1', value: 'London' }])

  it('names the dimension in its own header', () => {
    expect(text(html)).toContain('Location')
  })

  it('asks two things, and asks them the way the account reads them back', () => {
    const labels = Array.from(html.matchAll(/<label class="label[^"]*">([^<]*)/g)).map(m => m[1].trim())
    // Mahad, 2026-09-21: *"Replace starts as by 'Value for this account'."*
    // Values, plural, since 2026-09-30: an account can take several.
    expect(labels).toEqual(['Dimension', 'Values for this account'])
  })

  it('reads the answer back on the trigger', () => {
    expect(html).toContain('London')
  })

  /* Mahad, 2026-09-24: *"Dimension selection is not working properly here. If i
     select a value, it should only select that for me."* The old table went on
     listing the whole dimension beside the answer, so an account with one
     location read as carrying all of them. A card holds one value and shows
     that one. */
  it('shows the value picked and none of the ones that were not', () => {
    expect(html).not.toContain('Singapore')
    // As the chip, in the chip's own name (the default), and in its remove button's name.
    expect(html.match(/London/g)).toHaveLength(3)
    expect(html).toContain('aria-label="Remove London"')
  })

  /* The change the cards are for: a dimension the account does not carry is not
     a row here waiting to be misread as carried. It is an option in a dropdown. */
  it('draws nothing for a dimension this account does not carry', () => {
    expect(text(html)).not.toContain('Department')
  })

  it('can be taken off, even when it is the only one', () => {
    /* A divergence from the carrier card this is drawn from, which keeps its
       last one: an account carrying no dimensions is a legal account. */
    expect(html).toContain('aria-label="Remove Location"')
  })
})

describe('more than one dimension', () => {
  const two = render([{ dimensionId: 'd1', value: 'London' }, { dimensionId: 'd2', value: 'Sales' }])

  it('gives each its own card, in the order the account holds them', () => {
    expect(two.indexOf('Location')).toBeLessThan(two.indexOf('Department'))
    expect(two).toContain('aria-label="Remove Location"')
    expect(two).toContain('aria-label="Remove Department"')
  })

  it('numbers them, so a card can be named by position as well as by dimension', () => {
    expect(two.match(/bg-primary\/10/g)).toHaveLength(2)
  })

  it('leaves a lone card unnumbered, there being nothing to tell it from', () => {
    expect(render([{ dimensionId: 'd1', value: 'London' }])).not.toContain('bg-primary/10')
  })
})

/* Mahad: *"The key feature is the 'Add Another Carrier' pattern, which in our
   context would translate to 'Add Another Dimension'."* */
describe('adding another', () => {
  it('offers one dashed button under the cards, whatever they hold', () => {
    const html = render([{ dimensionId: 'd1', value: 'London' }])
    expect(text(html)).toContain('Add another dimension')
    expect(html.match(/border-dashed/g)).toHaveLength(1)
  })

  it('stays gone once every dimension is spoken for and none can be defined', () => {
    // The button would open a dropdown holding nothing but its own create row.
    const html = render([{ dimensionId: 'd1', value: 'London' }, { dimensionId: 'd2', value: 'Sales' }])
    expect(text(html)).not.toContain('Add another dimension')
  })

  it('stands anyway when a dimension can be defined from here', () => {
    const html = render(
      [{ dimensionId: 'd1', value: 'London' }, { dimensionId: 'd2', value: 'Sales' }],
      DIMS,
      { onCreateDimension: () => DIMS[0] },
    )
    expect(text(html)).toContain('Add another dimension')
  })
})

describe('an account carrying none', () => {
  /* Not an empty table with two captions over it. One panel saying what the
     account has and one way out of it - the dashed button stays off until there
     is a card for it to follow, since it is the same offer twice. */
  it('says so, and offers the one act that answers it', () => {
    const t = text(render([]))
    expect(t).toContain('No dimensions on this account')
    expect(t).toContain('Add a dimension')
    expect(t).not.toContain('Add another dimension')
    expect(render([])).not.toContain('<table')
  })

  // Just the title (design review, 2026-09-30): the explanation was too much text.
  it('says no more than that there are none', () => {
    expect(text(render([]))).not.toContain('Postings here start with whatever you set')
  })
})

describe('when the tenant has defined no dimensions', () => {
  it('says what one is, rather than drawing an empty anything', () => {
    const html = render([], [])
    expect(html).toContain('No dimensions are set up yet')
    expect(html).toContain('Location')
    expect(html).not.toContain('<table')
  })

  it('offers to define one, rather than naming a menu on another page', () => {
    /* It used to end at "from Actions then Dimensions on the Chart of Accounts",
       which costs the reader the account they were part-way through creating to
       follow. The way out of the empty state is now inside it. */
    const t = text(render([], [], { onCreateDimension: () => DIMS[0] }))
    expect(t).toContain('Add a dimension')
    expect(t).toContain('A dimension is something you want to report by')
    expect(t).not.toContain('Chart of Accounts')
  })

  it('is absent from a flow that did not offer it', () => {
    // A wizard whose dimensions are a draft it owns has nowhere to put one.
    expect(text(render([], []))).not.toContain('Add a dimension')
  })
})

/* The two creates. Both are rows inside a menu that is only built on open, so
   what is checked is the wiring: which picker offers which, and where what it
   makes lands. */
describe('creating from inside the pickers', () => {
  const src = read('pages', 'CreateAccount.tsx')

  /* Mahad: *"Inside that dropdown, there should be an option to 'Create New
     Dimension'."* — and 2026-09-29: *"there should be an option to add new value
     on the go... similar to create new dimension"*. So both rows stand whether
     or not anything has been typed. */
  it('offers a new dimension from the dimension picker, typed or not', () => {
    expect(src).toMatch(/onCreate=\{onCreateDimension && \(name => openDefine\(c\.key, name\)\)\}\s*\n\s*createAlways=\{!!onCreateDimension\}\s*\n\s*createNoun="dimension"/)
  })

  it('offers a new value from the value picker, typed or not', () => {
    expect(src).toContain('createAlways={!!dim && !!onAddValue}')
    expect(src).toContain('createNoun={dim ? `${dim.name} value` : \'value\'}')
  })

  /* A standing row must have somewhere to send a reader who typed nothing —
     Mahad, 2026-09-23: *"'Create new value' in the Choose dropdown doesn't do
     anything when you click it."* A typed name is the whole of a value, so it is
     made on the spot; untyped, the row opens a form that asks for the name. */
  it('asks for a name when the value row was clicked without one', () => {
    expect(src).toMatch(/if \(v\.trim\(\)\) addValue\(c\.key, dim\.id, v\.trim\(\)\)/)
    expect(src).toMatch(/else \{ setNewValue\(''\); setNamingFor\(\{ key: c\.key, dimensionId: dim\.id \}\) \}/)
  })

  it('will not let that form make a value the dimension already holds', () => {
    expect(src).toContain('const takenValue = !!namingDim?.values.some(v => v.trim().toLowerCase() === newValue.trim().toLowerCase())')
    expect(src).toContain('disabled={!newValue.trim() || takenValue}')
  })

  /* What you just made is what you wanted, so nobody should have to go and find
     it in the list they have just come from. */
  it('selects what it made, on the card that asked for it', () => {
    expect(src).toContain('if (definingFor) patch(definingFor, { dimensionId: made.id, values: [], defaultValue: undefined })')
    expect(src).toContain('else commit([...cards, card(made.id)])')
  })

  /* One act, two landings, whichever row made it - the typed fast path and the
     form both go through here, so neither can add to the dimension and leave the
     card that asked for it unanswered. */
  it('takes a new value onto the card as well as into the dimension', () => {
    expect(src).toMatch(/const addValue = \(key: string, dimensionId: string, v: string\) => \{\s*\n\s*onAddValue\?\.\(dimensionId, v\)[\s\S]{0,200}patch\(key, \{ values,/)
  })
})

describe('the picker that cannot yet be answered', () => {
  /* A blank card asks for a dimension first: its values do not exist until one
     is named. Shut rather than flagged - there is nothing wrong yet. */
  it('is shut until its dimension is chosen, and says which way round they go', () => {
    const src = read('pages', 'CreateAccount.tsx')
    expect(src).toContain('disabled={!dim}')
    expect(src).toContain("placeholder={!dim ? 'Pick a dimension first' : 'Select values'}")
  })
})

describe('the card is drawn from the module\'s own tokens', () => {
  it('takes no colour from a literal', () => {
    expect(render([{ dimensionId: 'd1', value: 'London' }])).not.toMatch(/#[0-9a-f]{6}/i)
  })
})
