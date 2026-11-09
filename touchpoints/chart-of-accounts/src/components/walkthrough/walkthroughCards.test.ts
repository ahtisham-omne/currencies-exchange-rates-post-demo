import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { WALKTHROUGH_CARDS, type WalkthroughStep } from './walkthroughCards'
import { SPECIMEN_PARTS } from './walkthroughArt'
import { EXAMPLE_DIMENSIONS, EXAMPLE_FILTERS, EXAMPLE_LABELS, EXAMPLE_REVIEW } from './walkthroughExample'
import { IMPORT_STEPS, SLOT_ANSWERS } from '../../pages/ImportAccounts'
import { VALUE_MEANS_NOTHING } from '../../lib/codeMapper'
import { dimensionKey } from '../../pages/importReview/reviewColumns'

/* A card is a promise that something is on the screen behind it. The prose is
   Mahad's and is not guarded here; what is guarded is that the promise can be
   kept - that every anchor a card names is mounted by the wizard, that the step
   it asks for is a step the wizard has, and that a card quoting the example file
   quotes what the example file really holds. */

/** Every `data-walkthrough` key the app mounts, read off the source. */
function mountedAnchors(): { has: (key: string) => boolean } {
  const found = new Set<string>()
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        // The overlay is the reader of these keys, not a mounter of them.
        if (entry.name !== 'walkthrough') walk(path)
      } else if (entry.name.endsWith('.tsx')) {
        const src = readFileSync(path, 'utf8')
        /* `data-walkthrough` on an element, and `walkthrough` as a prop on a
           shared component that passes it through - an anchor on an OptionCard
           has to live on the card itself, so the component takes the key. */
        for (const [, quoted, expr] of src.matchAll(/(?:data-)?walkthrough=(?:"([a-z-]+)"|\{([^}]*)\})/g)) {
          if (quoted) found.add(quoted)
          /* A key chosen by a condition, e.g. the dimension row keyed by the
             answer it carries. Read as every string the expression could return,
             which is why those keys are written out rather than looked up in a
             table: a table would put them where this cannot see them. */
          if (expr) for (const [, key] of expr.matchAll(/'([a-z-]+)'/g)) found.add(key)
        }
      }
    }
  }
  walk(join(__dirname, '../..'))
  return { has: (key: string) => found.has(key) }
}

const STEP_ORDER: WalkthroughStep[] = ['upload', 'split', 'dimensions', 'labels', 'review']

/* The four steps the trail counts. Uploading is not one of them, so a card
   standing on the upload step is standing before the trail starts. */
const TRAIL_ORDER: WalkthroughStep[] = ['split', 'dimensions', 'labels', 'review']

describe('every card has something to point at', () => {
  const mounted = mountedAnchors()

  it('names only anchors the wizard actually mounts', () => {
    for (const { id, anchor } of WALKTHROUGH_CARDS) {
      if (anchor === null) continue
      expect(mounted.has(anchor), `${id} points at "${anchor}"`).toBe(true)
    }
  })

  /* A card pointing at nothing is a card the reader cannot check against the
     screen, so the ones that do are all saying what is about to be lit rather
     than describing it: the word "dimension" before the word is used, and then
     each of the two steps whose answers get a card apiece, framed before any one
     of those answers is lit. Lighting one while framing the question would read
     as that answer being the answer. */
  it('points at nothing only where there is nothing yet to point at', () => {
    const unanchored = WALKTHROUGH_CARDS.filter(c => c.anchor === null)
    expect(unanchored.map(c => c.id)).toEqual(['dimension-word', 'dimensions-step', 'labels-step'])
    // And each one stands at the head of the step it frames, not inside it.
    for (const card of unanchored) {
      const sameStep = WALKTHROUGH_CARDS.filter(c => c.step === card.step)
      expect(sameStep[0].id, card.id).toBe(card.id)
    }
  })

  /* Those two are a pair and read as one, so they are written as one: the same
     shape, one sentence each and no ticks, over the same dimmed screen. A step
     framed with a bulleted list beside a step framed with a sentence reads as
     two different kinds of card. */
  it('frames a step the same way each time it frames one', () => {
    const framing = ['dimensions-step', 'labels-step']
      .map(id => WALKTHROUGH_CARDS.find(c => c.id === id)!)
    for (const card of framing) {
      expect(card.lead, card.id).toBeTruthy()
      expect(card.points, card.id).toEqual([])
      expect(card.anchor, card.id).toBeNull()
      expect(card.eyebrow, card.id).toMatch(/^Step \d$/)
    }
  })

  /* Art needs a dimmed screen, so it can only go on such a card. The overlay
     binds it to the spotlight rather than to the card, so a card asking for both
     would silently drop its diagram; guarded here so the pair cannot be written
     in the first place. Not every unanchored card wants one: the dimensions step
     is legible behind its card, and a drawing of a table beside a real table is
     the worse of the two. */
  it('draws a diagram only on a card with nothing to point at', () => {
    for (const { id, anchor, art } of WALKTHROUGH_CARDS) {
      if (art !== undefined) expect(anchor, `${id} draws a diagram`).toBeNull()
    }
    expect(WALKTHROUGH_CARDS.filter(c => c.art !== undefined).map(c => c.id)).toEqual(['dimension-word'])
  })

  /* The diagram takes the number apart on screen while the copy beside it says
     what it holds. Both read the one const, so what is checked here is that the
     copy still spells the number out in the pieces the picture splits it into:
     a card saying "three parts" over a picture that draws four is worse than
     either alone. */
  it('quotes the number its diagram draws, in the pieces it draws it in', () => {
    const card = WALKTHROUGH_CARDS.find(c => c.id === 'dimension-word')!
    const html = renderToStaticMarkup(createElement('div', null, ...card.points))
    expect(html).toContain(SPECIMEN_PARTS.join('-'))
    for (const part of SPECIMEN_PARTS) expect(html, part).toContain(`>${part}<`)
  })

  /* And the gate step behind that card writes the same number out a third time,
     as pills. It reads the same const, which is the real guard; this holds the
     wiring, because a literal typed back in there would be invisible until
     somebody noticed the tour and the step disagreeing. */
  it('takes the number apart over a step that writes the same one', () => {
    const src = readFileSync(join(__dirname, '../../pages/ImportAccounts.tsx'), 'utf8')
    expect(src).toContain('<ExampleNumber parts={SPECIMEN_PARTS} />')
  })

  /* A card per answer where the answers are the decision, one card where the step
     is a single job. Guarded as a list rather than a count because the order is
     part of it: each card lights a control, and down a step they light it down
     the screen, so the spotlight never jumps back up the table it is working
     through. The tour used to be thirteen cards, one per control of any kind. */
  it('gives each step of the trail a card per answer, in the order they are read', () => {
    const anchorsOf = (step: WalkthroughStep) =>
      WALKTHROUGH_CARDS.filter(c => c.step === step && c.anchor !== null).map(c => c.anchor)
    expect(anchorsOf('split')).toEqual(['gate-yes', 'gate-no'])
    expect(anchorsOf('dimensions')).toEqual(['dimension-filter', 'dimension-ignore', 'dimension-account'])
    expect(anchorsOf('labels')).toEqual(['value-named', 'value-blank', 'value-excluded'])
    expect(anchorsOf('review')).toEqual(['review-dimensions'])
  })

  /* Which answer such a card is about is said twice on purpose, by the title and
     by the spotlight, and this is what stops the two coming apart. A card headed
     "If you say Yes" over a lit No is worse than either alone. */
  it('heads a card about one answer with that answer', () => {
    const titles = [
      ['gate-yes', 'If you say Yes'],
      ['gate-no', 'If you say No'],
      ['dimension-filter', 'Dimension'],
      ['dimension-ignore', 'Ignore'],
      ['dimension-account', 'GL account number'],
      ['value-named', 'Label a value'],
      ['value-blank', 'Leave it as is'],
      ['value-excluded', 'Exclude a value'],
    ] as const
    for (const [anchor, title] of titles) {
      expect(WALKTHROUGH_CARDS.find(c => c.anchor === anchor)?.title, anchor).toBe(title)
    }
  })

  /* These cards light by answer rather than by row, so the example file has to
     give each answer exactly once and in the order the cards are read: twice and
     a card lights two rows at opposite ends of the table, never and it lights
     nothing, out of order and the spotlight walks up the table. This is why the
     example file carries three dimensions and three values and not four of
     either. */
  it('gives the dimensions step one row per answer, in the order they are lit', () => {
    expect(EXAMPLE_DIMENSIONS.decisions.map(d => `dimension-${d.target.kind}`))
      .toEqual(['dimension-filter', 'dimension-ignore', 'dimension-account'])
  })

  it('gives the labelling step one value in each state, in the order they are lit', () => {
    const [band] = EXAMPLE_LABELS.slots
    const state = (code: string) =>
      band.labels[code] === VALUE_MEANS_NOTHING ? 'value-excluded'
        : band.labels[code]?.trim() ? 'value-named' : 'value-blank'
    expect(EXAMPLE_LABELS.codes(band.slot).map(t => state(t.code)))
      .toEqual(['value-named', 'value-blank', 'value-excluded'])
  })

  /* And each card is titled with the dropdown's own word for the answer, taken
     from the dropdown rather than typed again here. Renaming an option renames
     the card or fails: a card headed "Dimension" over a row whose dropdown
     now says something else is a card the reader cannot follow. */
  it('titles each dimensions card as the dropdown under it names that answer', () => {
    for (const answer of SLOT_ANSWERS) {
      const card = WALKTHROUGH_CARDS.find(c => c.anchor === `dimension-${answer.value}`)
      expect(card?.title, answer.value).toBe(answer.label)
    }
  })

  /* The tour opens before anything has been uploaded, so from the gate onwards
     there is no file behind the card. Every one of those cards has to ask for
     the example surface, or it spotlights an empty step. */
  it('asks for the example file on every step past the upload', () => {
    for (const card of WALKTHROUGH_CARDS) {
      if (card.step !== 'upload') expect(card.demo, card.id).toBeTruthy()
    }
  })

  it('shows the reader their own screen while it is still about their file', () => {
    for (const card of WALKTHROUGH_CARDS) {
      if (card.step === 'upload') expect(card.demo, card.id).toBeUndefined()
    }
  })

  it('opens on the upload step, which is the first thing the reader sees', () => {
    expect(WALKTHROUGH_CARDS[0].step).toBe('upload')
  })

  it('covers the template and the file, not only the steps after them', () => {
    const onUpload = WALKTHROUGH_CARDS.filter(c => c.step === 'upload').map(c => c.anchor)
    expect(onUpload).toContain('template')
    expect(onUpload).toContain('dropzone')
  })

  it('stands the reader on a step the wizard has', () => {
    for (const card of WALKTHROUGH_CARDS) {
      expect(STEP_ORDER, card.id).toContain(card.step)
    }
  })

  /* The last card is the exception and has to be: it is where the tour puts the
     reader down. Ending on the review grid would leave them standing on a
     screen they cannot use, holding a file they have not uploaded, so the tour
     walks them back to the step it started on and points at the way to read all
     of this again. */
  it('walks forward, so the tour never sends the reader back mid-story', () => {
    const seats = WALKTHROUGH_CARDS.slice(0, -1).map(c => STEP_ORDER.indexOf(c.step))
    expect(seats).toEqual([...seats].sort((a, b) => a - b))
  })

  it('sets the reader down where they came in, on the way to read it again', () => {
    const last = WALKTHROUGH_CARDS[WALKTHROUGH_CARDS.length - 1]
    expect(last.step).toBe('upload')
    expect(last.anchor).toBe('how-it-works')
  })

  /* A card reciting the trail was dropped on purpose. A list of the four steps
     says only that there are four, which the trail in the header already says,
     and it was being read on the upload step by someone who has not decided to
     take those steps yet. */
  it('recites no step trail, having nothing to add to the one on screen', () => {
    for (const card of WALKTHROUGH_CARDS) {
      expect(card.numbered, card.id).toBeFalsy()
      const html = renderToStaticMarkup(createElement('div', null, ...card.points))
      expect(IMPORT_STEPS.every(label => html.includes(label)), card.id).toBe(false)
    }
  })
})

/* The welcome slide is a greeting, and a greeting is only one if it arrives with
   the room. Delayed, it lands on a reader already reading the upload step and
   reaching for the template, which is an interruption wearing a greeting's
   words. Read off the source because the alternative is a test that waits. */
describe('when the tour offers itself', () => {
  const src = readFileSync(join(__dirname, '../../pages/ImportAccounts.tsx'), 'utf8')

  it('opens with the modal rather than a beat after it', () => {
    expect(src).toContain("if (!takeFirstWalkthrough('import')) return")
    expect(src).not.toContain('WALKTHROUGH_OPEN_DELAY_MS')
  })

  /* The dimensions tour keeps its delay, and the difference is the point: it
     opens as the reader steps into a step of a wizard already on screen, so the
     panel really is mid-move under it. */
  it('leaves the tour that opens mid-wizard waiting for the room', () => {
    const setup = readFileSync(join(__dirname, '../../pages/Setup.tsx'), 'utf8')
    expect(setup).toContain('WALKTHROUGH_OPEN_DELAY_MS')
  })
})

/* The review card promises "the dimension columns Omne has added", which is a
   claim about the grid rather than about any one value in it. So what is held
   here is that the grid it points at really has those columns and that each one
   reads as a column: a column showing one value on every row is a column the
   card has sent the reader to look at for nothing. */
describe('the grid the review card points at', () => {
  const inColumn = (name: string) =>
    new Set(EXAMPLE_REVIEW.rows.map(r => r[dimensionKey(name)]).filter(Boolean) as string[])

  /* And there has to be at least one, because the spotlight is the columns and
     not the grid: with none, the card lights nothing and the overlay centres it
     over a dimmed screen as though the grid were not there. */
  it('carries a column for every dimension the reader made a filter, and at least one', () => {
    expect(EXAMPLE_REVIEW.dimensionColumns.map(c => c.label)).toEqual(EXAMPLE_FILTERS.map(f => f.name))
    expect(EXAMPLE_REVIEW.dimensionColumns.length).toBeGreaterThan(0)
  })

  it('gives each column more than one value, so it reads as a column', () => {
    for (const { name } of EXAMPLE_FILTERS) {
      expect(inColumn(name).size, name).toBeGreaterThan(1)
    }
  })
})

describe('the cards stay in the house voice', () => {
  it('titles a card without punctuating it as a sentence', () => {
    for (const { id, title } of WALKTHROUGH_CARDS) {
      expect(title, id).not.toContain('—')
      expect(title.endsWith('.'), title).toBe(false)
    }
  })

  /* The floor is a message, not a list. A card framing a step says one sentence
     and takes no ticks, because a tick beside a single line reads as the first
     item of a list the reader then goes looking for. */
  it('keeps to five points, the ceiling a reader will scan, and says something', () => {
    for (const card of WALKTHROUGH_CARDS) {
      expect(!!card.lead || card.points.length > 0, card.id).toBe(true)
      expect(card.points.length, card.id).toBeLessThanOrEqual(5)
    }
  })

  it('gives each card an id and an eyebrow of its own', () => {
    const ids = WALKTHROUGH_CARDS.map(c => c.id)
    const eyebrows = WALKTHROUGH_CARDS.map(c => c.eyebrow)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(eyebrows).size).toBe(eyebrows.length)
  })

  /* Several cards now share a step, so an eyebrow may qualify its number -
     "Step 2, ignore". The number still has to be the trail's number, which is
     the only thing on the card tying it to the screen behind it. */
  it('numbers an eyebrow after the step the trail is counting', () => {
    for (const card of WALKTHROUGH_CARDS) {
      const said = card.eyebrow.match(/^Step (\d)/)
      if (said) expect(Number(said[1]), card.id).toBe(TRAIL_ORDER.indexOf(card.step) + 1)
    }
  })

  it('does not number the cards standing before the trail starts', () => {
    for (const card of WALKTHROUGH_CARDS) {
      if (card.step === 'upload') expect(card.eyebrow, card.id).not.toMatch(/^Step \d$/)
    }
  })

  it('writes no em dashes into the points either', () => {
    for (const card of WALKTHROUGH_CARDS) {
      const html = renderToStaticMarkup(createElement('div', null, card.lead, ...card.points))
      expect(html, card.id).not.toContain('—')
    }
  })
})
