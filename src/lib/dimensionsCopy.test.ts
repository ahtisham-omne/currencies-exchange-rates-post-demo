import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DIMENSIONS_HELP_INTRO,
  DIMENSIONS_HELP_FILTERING,
  DIMENSIONS_EXAMPLE,
  DIMENSIONS_EXAMPLE_NUMBER,
  DimensionsHelp,
} from './dimensionsCopy'
import { HEADER_DEFS } from '../components/AccountTable'

/* Supplied copy for the Dimensions column tooltip, pinned as strings. Changing
   a word here is a product decision and should have to come through this file.
   That the card reaches the screen is a separate question, and a browser one:
   e2e/headerTooltips.spec.ts hovers the (i) and reads it back. */

/* Tags become spaces, so a sentence that ends inside a bolded span comes out as
   "Marketing ." - closing the gap before punctuation is what lets the
   assertions below be the supplied sentence rather than a regex around it. */
const strip = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(el)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/ +([.,:])/g, '$1')
    .trim()

const text = () => strip(createElement(DimensionsHelp))

describe('what the Dimensions column says it is', () => {
  it('opens on what a dimension is and what having one buys you', () => {
    expect(DIMENSIONS_HELP_INTRO).toBe(
      'Dimensions are segments of an account number that you can use to group and filter accounts by specific values.',
    )
  })

  it('closes on the filtering, named down to the value', () => {
    // "You can filter by dimensions" would be true and useless. The arrow and
    // the two worked values are the half that tells a reader what they will
    // actually type.
    expect(DIMENSIONS_HELP_FILTERING).toBe(
      'This lets you filter accounts using a dimension value, e.g. Location → London or Department → Marketing.',
    )
  })

  it('reads the example number out piece by piece, in the order the number has them', () => {
    /* The card is only worth its space if the pieces reassemble into the
       number above them. A reading in the wrong order, or one that quietly
       renames 100 to 010, is the failure this catches. */
    expect(DIMENSIONS_EXAMPLE.map(r => r.code).join('-')).toBe(DIMENSIONS_EXAMPLE_NUMBER)
  })

  it('says which dimension each piece is, and what a value of it looks like', () => {
    const t = text()
    expect(t).toContain('01')
    expect(t).toContain('can be the Location dimension, with a value like London')
    expect(t).toContain('can be the Department dimension, with a value like Marketing')
  })

  /* 5020 is the account, not something the account is cut by, so it is the one
     row with no value. Giving it one would say the GL account number is a thing
     you filter by, which is the confusion the whole card exists to undo. */
  it('leaves the account number without a value, because it is not a cut', () => {
    const account = DIMENSIONS_EXAMPLE.find(r => r.dimension === 'GL account number')!
    expect(account.value).toBeUndefined()
    expect(text()).toContain('can be the GL account number')
  })

  it('renders the whole of the supplied copy, not just the parts it found room for', () => {
    expect(text()).toContain(DIMENSIONS_HELP_INTRO)
    expect(text()).toContain(DIMENSIONS_HELP_FILTERING)
    expect(text()).toContain(`For example, if an account number is ${DIMENSIONS_EXAMPLE_NUMBER}`)
  })
})

describe('the column offers it', () => {
  /* The header used to hang the whole worked card off its (i). The example now
     has a surface of its own - the Dimensions page states it in full and opens
     the reading room beside it - so the column is back to defining the word and
     nothing more. */
  it('defines the word on the Dimensions header, and leaves the example to the page', () => {
    // Said the way How it works says it (Mahad, 2026-10-08).
    expect(HEADER_DEFS.dimensions.info).toBe(
      'A dimension is something your company organizes or filters accounts by, such as Location or Department.')
    expect(HEADER_DEFS.dimensions.infoRich).toBeUndefined()
  })
})

describe('the tooltip and the import guide teach the same example', () => {
  /* A reader who met dimensions while importing a chart should not have to
     re-learn them from a different number here. These two are the only places
     the module works the example, so they are cheap to keep in step - and if
     one moves, this says so rather than letting the demo teach two charts. */
  it('uses the number the reading room already walks through', () => {
    const readingRoom = readFileSync(join(__dirname, '..', 'pages', 'importReadingRoom.tsx'), 'utf8')
    expect(readingRoom).toContain(DIMENSIONS_EXAMPLE_NUMBER)
    for (const row of DIMENSIONS_EXAMPLE) expect(readingRoom).toContain(`<Quoted>${row.code}</Quoted>`)
  })
})
