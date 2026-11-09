import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { DIMENSIONS_CARDS, DIMENSIONS_DEMO, DIMENSIONS_LABEL, type DimensionsAnchor } from './dimensionsCards'
import { DIMENSIONS_DEMO_DIMENSIONS } from '../../pages/Setup'

type Card = (typeof DIMENSIONS_CARDS)[number]

/** Everything a card says, as one string. */
const html = (card: Card) =>
  renderToStaticMarkup(createElement('div', null, card.lead, ...card.points))

const cardById = (id: string) => DIMENSIONS_CARDS.find(c => c.id === id)!

/* Same promise as the import tour, on a step that opens empty: every card claims
   something is on the screen behind it. Guarded here is that the claim can be
   kept - that each anchor is one the build-from-scratch wizard mounts, that a
   card pointing into the editor brings filters to point at, and that the card
   reciting the trail recites the trail the reader is looking at. */

/** Every `data-walkthrough` key the app mounts, read off the source. */
function mountedAnchors(): Set<string> {
  const found = new Set<string>()
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        // The overlay is the reader of these keys, not a mounter of them.
        if (entry.name !== 'walkthrough') walk(path)
      } else if (entry.name.endsWith('.tsx')) {
        const src = readFileSync(path, 'utf8')
        for (const [, quoted, expr] of src.matchAll(/data-walkthrough=(?:"([a-z-]+)"|\{([^}]*)\})/g)) {
          if (quoted) found.add(quoted)
          for (const [, key] of expr?.matchAll(/'([a-z-]+)'/g) ?? []) found.add(key)
        }
      }
    }
  }
  walk(join(__dirname, '../..'))
  return found
}

/* The step is one editor, and it opens with nothing in it. A card that points
   into the editor has to stand something there or it spotlights an empty box
   and explains the box. */
const INSIDE_EDITOR: DimensionsAnchor[] = ['dimensions', 'dimensions-add']

describe('every card has something to point at', () => {
  const mounted = mountedAnchors()

  it('names only anchors the wizard actually mounts', () => {
    // null is a card that stands centred on purpose, pointing at nothing.
    for (const { id, anchor } of DIMENSIONS_CARDS) {
      if (anchor !== null) expect(mounted.has(anchor), `${id} points at "${anchor}"`).toBe(true)
    }
  })

  it('brings filters to point at whenever it points into the editor', () => {
    for (const card of DIMENSIONS_CARDS) {
      if (card.anchor && INSIDE_EDITOR.includes(card.anchor)) expect(card.demo, card.id).toBe(DIMENSIONS_DEMO)
    }
  })

  it('asks for the one step this tour runs on, so it never navigates', () => {
    for (const card of DIMENSIONS_CARDS) {
      expect(card.step, card.id).toBe('dimensions')
    }
  })

  /* The card that pointed at the step trail ("Where you are") was taken out
     (Mahad, 2026-10-02), so the tour opens on the idea and closes on the footer. */
  it('opens on the idea, points at no step trail, and closes on the footer', () => {
    expect(DIMENSIONS_CARDS[0].title).toBe('What a dimension is')
    expect(DIMENSIONS_CARDS.some(c => c.title === 'Where you are')).toBe(false)
    expect(DIMENSIONS_CARDS.some(c => (c.anchor as string | null) === 'wizard-stepper')).toBe(false)
    expect(DIMENSIONS_CARDS[DIMENSIONS_CARDS.length - 1].anchor).toBe('wizard-footer')
  })
})

describe('the cards stay in the house voice', () => {
  it('calls it a dimension everywhere, never a group filter', () => {
    for (const card of DIMENSIONS_CARDS) {
      expect(card.title, card.id).not.toMatch(/group.filter/i)
      expect(html(card), card.id).not.toMatch(/group.filter/i)
    }
    expect(DIMENSIONS_LABEL).not.toMatch(/group.filter/i)
  })

  it('titles a card without punctuating it as a sentence', () => {
    for (const { id, title } of DIMENSIONS_CARDS) {
      expect(title, id).not.toContain('—')
      expect(title.endsWith('.'), title).toBe(false)
    }
  })

  it('says each card in a paragraph, under the title the copy gives it', () => {
    expect(DIMENSIONS_CARDS.map(c => c.title)).toEqual([
      'What a dimension is', 'Add a dimension', 'Values on an account', 'You can skip this',
    ])
    for (const card of DIMENSIONS_CARDS) {
      expect(card.lead, card.id).toBeTruthy()
      expect(card.points, card.id).toEqual([])
    }
  })

  it('gives each card an id of its own', () => {
    const ids = DIMENSIONS_CARDS.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('writes no em dashes, en dashes or curly apostrophes into the points', () => {
    for (const card of DIMENSIONS_CARDS) {
      expect(html(card), card.id).not.toContain('—')
      expect(html(card), card.id).not.toContain('–')
      expect(html(card), card.id).not.toContain('’')
    }
  })

  /* The footer never blocks this step, so the tour has to account for the button
     itself: that it can be pressed, what the chart looks like if it is, and that
     the decision is not final. */
  it('tells the reader they can skip, and what skipping costs them', () => {
    const skip = DIMENSIONS_CARDS.find(c => c.anchor === 'wizard-footer')!
    expect(skip.title).toMatch(/skip/i)
    expect(html(skip)).toMatch(/created without them/i)
    expect(html(skip)).toMatch(/later/i)
  })
})

/* Two of these cards name filters and quote values out loud, and the wizard
   stands the demo filters in the editor behind them while they are up. A card
   that lists four values the editor beside it is not showing reads as a fault in
   the editor, not as an example. */
describe('the cards quote what is standing behind them', () => {
  const demo = new Map(DIMENSIONS_DEMO_DIMENSIONS.map(d => [d.name, d.values]))

  it('names, on the card explaining the idea, both filters the editor is showing', () => {
    for (const name of demo.keys()) expect(html(cardById('gf-what')), name).toContain(name)
  })

  it('quotes only Location values the editor is showing', () => {
    const location = demo.get('Location')!
    for (const id of ['gf-what', 'gf-add']) {
      for (const v of ['USA', 'Singapore', 'United Kingdom']) {
        if (html(cardById(id)).includes(v)) expect(location, `${id} quotes ${v}`).toContain(v)
      }
    }
  })

  it('says a second value on an account needs a default, which a journal line takes', () => {
    expect(html(cardById('gf-values'))).toContain('If you give it more than one, choose a default.')
  })

  it('gives each demo filter more than one value, so it reads as a filter', () => {
    for (const [name, values] of demo) expect(new Set(values).size, name).toBeGreaterThan(1)
  })
})
