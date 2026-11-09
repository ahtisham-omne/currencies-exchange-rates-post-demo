import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { ReadingRoom, WalkthroughReplayRow } from '../components/walkthrough/ReadingRoom'
import { WALKTHROUGH_CARDS } from '../components/walkthrough/walkthroughCards'
import { EXAMPLE_FILTERS } from '../components/walkthrough/walkthroughExample'
import {
  REQUIRED_TEMPLATE_FIELDS, OPTIONAL_TEMPLATE_FIELDS, TEMPLATE_COLUMNS,
} from '../lib/importTemplate'
import { ACCOUNT_TYPE_META, CATEGORY_ORDER, CLASSIFICATIONS_BY_CATEGORY, ROLES_BY_CATEGORY, SOLE_ROLES } from '../types'
import {
  DIMENSIONS_SECTION, IMPORT_READING_ROOM, importGuideFor,
  IMPORT_GUIDE_GROUP, DIMENSION_GUIDE_GROUP,
} from './importReadingRoom'

/* The reading room is the wizard's long answer: a panel of headings that open
   one at a time. What is guarded here is the shape of that promise rather than
   its prose - that it opens on something rather than on a stack of shut boxes,
   that a shut section has still shipped its body so opening it is a reveal and
   not a fetch, and that the only door back into the walkthrough counts the
   cards the walkthrough actually has.

   The prose that is pinned is the prose that counts something. This panel
   describes a file it does not own, and every number and name in it is read off
   `TEMPLATE_COLUMNS` for that reason; the few sentences that say a figure out
   loud are the ones that can go stale, so they are held here. */

type RoomProps = Parameters<typeof ReadingRoom>[0]

function markup(opts: Partial<RoomProps> = {}) {
  const props: RoomProps = {
    open: true,
    onClose: () => {},
    config: IMPORT_READING_ROOM,
    ...opts,
  }
  return renderToStaticMarkup(createElement(ReadingRoom, props))
}

describe('what the panel is', () => {
  it('is nothing at all until it is opened', () => {
    expect(markup({ open: false })).toBe('')
  })

  it('names its subject where the reader can see it', () => {
    const html = markup()
    expect(html).toContain('How it works')
    expect(html).toContain('Importing accounts in Omne')
  })

  it('carries the file and the number as two named parts of one panel', () => {
    const groups = [...new Set(IMPORT_READING_ROOM.sections.map(s => s.group))]
    expect(groups).toEqual([IMPORT_GUIDE_GROUP, DIMENSION_GUIDE_GROUP])
    // Every section belongs to one of them, or the eyebrow above it is a lie.
    expect(IMPORT_READING_ROOM.sections.every(s => s.group)).toBe(true)
  })
})

describe('one heading open, the rest waiting', () => {
  it('opens on the first section so the panel never lands shut', () => {
    const opened = markup().match(/aria-expanded="(true|false)"/g) ?? []
    expect(opened[0]).toBe('aria-expanded="true"')
    expect(opened.slice(1).every(a => a === 'aria-expanded="false"')).toBe(true)
    expect(opened).toHaveLength(IMPORT_READING_ROOM.sections.length)
  })

  it('opens on the heading it was sent to instead, for a reader already past the file', () => {
    const opened = markup({ openAt: DIMENSIONS_SECTION }).match(/aria-expanded="(true|false)"/g) ?? []
    const at = IMPORT_READING_ROOM.sections.findIndex(s => s.title === DIMENSIONS_SECTION)
    expect(at).toBeGreaterThan(0)
    expect(opened[at]).toBe('aria-expanded="true"')
    expect(opened.filter(a => a === 'aria-expanded="true"')).toHaveLength(1)
  })

  it('opens on the first section when sent to a heading it does not carry', () => {
    const opened = markup({ openAt: 'Opening balances' }).match(/aria-expanded="(true|false)"/g) ?? []
    expect(opened[0]).toBe('aria-expanded="true"')
  })

  it('ships every body with the panel, open or not', () => {
    // The dimensions half is shut on arrival, and its copy is in the markup anyway.
    expect(markup()).toContain('one part of a segmented account number')
  })
})

describe('the file it describes', () => {
  const html = markup()

  /* The one place the panel says a count out loud rather than reading it off
     the columns. Spelled out in words on purpose, so it cannot be interpolated
     and has to be checked from outside. */
  it('counts the required and optional columns the template actually has', () => {
    expect(REQUIRED_TEMPLATE_FIELDS).toHaveLength(4)
    expect(OPTIONAL_TEMPLATE_FIELDS).toHaveLength(7)
    expect(html).toContain('Four columns are required')
    expect(html).toContain('The other seven are optional')
  })

  /* The column with a fixed list and no dropdown in the file, so the guide is
     the only place the reader can read the list off. */
  it('names the thirteen classifications under the category that owns each', () => {
    for (const code of CATEGORY_ORDER) {
      expect(html, code).toContain(CLASSIFICATIONS_BY_CATEGORY[code].join(', '))
    }
  })

  it('explains every column the file carries, and nothing it does not', () => {
    for (const c of TEMPLATE_COLUMNS) {
      expect(html, c.header).toContain(`${c.header} ·`)
      // The explanation itself, not a paraphrase of it that can drift.
      expect(html, c.header).toContain(c.about.slice(-40).replace(/'/g, '&#x27;'))
    }
    expect(html.match(/ · (Required|Optional)/g)).toHaveLength(TEMPLATE_COLUMNS.length)
  })

  it('says what a blank cell does for every optional column', () => {
    for (const c of TEMPLATE_COLUMNS.filter(x => !x.required)) {
      expect(html, c.header).toContain(`${c.header} · Optional · Blank `)
    }
    for (const c of TEMPLATE_COLUMNS.filter(x => x.required)) {
      expect(html, c.header).toContain(`${c.header} · Required`)
    }
  })

  it('names the four columns that cannot be left blank first', () => {
    const at = (h: string) => html.indexOf(`${h} ·`)
    const required = REQUIRED_TEMPLATE_FIELDS.map(at)
    const optional = OPTIONAL_TEMPLATE_FIELDS.map(at)
    expect(Math.max(...required)).toBeLessThan(Math.min(...optional))
  })

  it('offers only the values the file offers', () => {
    for (const c of TEMPLATE_COLUMNS) {
      if (!c.list || !('values' in c.list)) continue
      expect(html, c.header).toContain(c.list.values.join(', '))
    }
  })

  it('gives every category its statement and its normal balance', () => {
    for (const code of CATEGORY_ORDER) {
      const meta = ACCOUNT_TYPE_META[code]
      expect(html, meta.label).toContain(meta.label)
      expect(html, meta.label).toContain(meta.normal)
    }
    expect(html).toContain('Balance sheet')
    expect(html).toContain('Income statement')
  })

  it('lists every role under the category that owns it', () => {
    for (const code of CATEGORY_ORDER) {
      expect(html, code).toContain(ROLES_BY_CATEGORY[code].join(', '))
    }
  })

  /* The sentence about a role only one account may hold is attached to whichever
     category holds nothing else, which is equity and only equity. Split the
     sole roles across two categories and the sentence lands on neither. */
  it('holds the roles only one account may take to a single category', () => {
    const whole = CATEGORY_ORDER.filter(c => {
      const roles = ROLES_BY_CATEGORY[c]
      return roles.length > 1 && roles.every(r => SOLE_ROLES.includes(r))
    })
    expect(whole).toEqual(['EQT'])
    expect(SOLE_ROLES.every(r => ROLES_BY_CATEGORY.EQT.includes(r))).toBe(true)
    expect(html).toContain('Each of these can be held by one account only')
  })
})

describe('the way back into the walkthrough', () => {
  it('is absent unless the panel is given one', () => {
    expect(markup()).not.toContain('Take the guided walkthrough')
  })

  it('counts the cards the walkthrough actually has', () => {
    const html = markup({ tail: createElement(WalkthroughReplayRow, { onStart: () => {} }) })
    expect(html).toContain('Take the guided walkthrough')
    expect(html).toContain(`${WALKTHROUGH_CARDS.length} short cards`)
  })

  /* The link inside the copy is a button only where there is a tour to start.
     Mounted without one it is plain text, so the panel cannot offer a door that
     opens on nothing. */
  it('offers the tour mid-sentence only where the mount can start it', () => {
    const arrowed = 'Start the guided walkthrough <span aria-hidden="true">'
    expect(markup()).toContain('Start the guided walkthrough')
    expect(markup()).not.toContain(arrowed)
    expect(markup({ onStartWalkthrough: () => {} })).toContain(arrowed)
  })

  /* The tour's last card sends the reader here calling it the same guide in
     writing, so the two have to be about the same file. They are written
     separately on purpose - one is a panel of prose and the other is a real
     wizard step fed example data - which is exactly why the worked example they
     share needs holding together from outside. */
  it('works the same example the walkthrough teaches from', () => {
    const html = markup()
    const department = EXAMPLE_FILTERS.find(f => f.name === 'Department')!
    const labelled = department.values.filter(v => v.label)
    expect(labelled.length).toBeGreaterThan(0)
    for (const { code, label } of labelled) {
      expect(html, `${code} is ${label} in the walkthrough`).toContain(label!)
      expect(html, `${code} is what the walkthrough labels`).toContain(code)
    }
  })
})

describe('the headings stay in the house voice', () => {
  it('asks each one as a heading, not as a sentence', () => {
    for (const { title } of IMPORT_READING_ROOM.sections) {
      expect(title, title).not.toContain('—')
      expect(title.endsWith('.'), title).toBe(false)
    }
  })

  it('gives each section a heading nothing else in the panel repeats', () => {
    const titles = IMPORT_READING_ROOM.sections.map(s => s.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('keeps the em dash and the curly apostrophe out of the prose', () => {
    const html = markup()
    expect(html).not.toContain('—')
    expect(html).not.toContain('’')
  })
})

/* The panel the wizard mounts is a scope of the config above, never the whole
   of it: the file half while the reader is choosing and mapping a file, the
   dimension half once they reach the numbering question. What is pinned here is
   that the split is clean - every section lands on exactly one step, the step it
   lands on is the one whose question it answers, and nothing falls between. */
describe('one part to a step', () => {
  it('shows the file guide on every step but the numbering one', () => {
    const file = importGuideFor('upload').sections
    expect(file.every(s => s.group === IMPORT_GUIDE_GROUP)).toBe(true)
    expect(file.map(s => s.title)).not.toContain(DIMENSIONS_SECTION)
    // A step the panel is not scoped for still falls back to the file half.
    expect(importGuideFor('labels').sections).toEqual(file)
  })

  it('shows the dimension guide only on the numbering step', () => {
    const dim = importGuideFor('split').sections
    expect(dim.every(s => s.group === DIMENSION_GUIDE_GROUP)).toBe(true)
    expect(dim[0].title).toBe(DIMENSIONS_SECTION)
  })

  it('splits the whole guide between the two, losing nothing', () => {
    const file = importGuideFor('upload').sections
    const dim = importGuideFor('split').sections
    expect(file.length).toBeGreaterThan(0)
    expect(dim.length).toBeGreaterThan(0)
    expect(file.length + dim.length).toBe(IMPORT_READING_ROOM.sections.length)
    // The scope narrows the sections and keeps the panel's name.
    expect(importGuideFor('upload').title).toBe(IMPORT_READING_ROOM.title)
  })

  it('opens each step on its own half and carries nothing from the other', () => {
    const upload = markup({ config: importGuideFor('upload') })
    const split = markup({ config: importGuideFor('split') })
    // The file half names the columns; the dimension half explains the number.
    expect(upload).toContain('Four columns are required')
    expect(upload).not.toContain('one part of a segmented account number')
    expect(split).toContain('one part of a segmented account number')
    expect(split).not.toContain('Four columns are required')
  })
})
