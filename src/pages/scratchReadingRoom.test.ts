import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { ReadingRoom, WalkthroughReplayRow } from '../components/walkthrough/ReadingRoom'
import { DIMENSIONS_CARDS } from '../components/walkthrough/dimensionsCards'
import { DIMENSIONS_PAGE_READING_ROOM, DIMENSIONS_READING_ROOM } from './scratchReadingRoom'

/* The long answer to a step that asks its question in one line. What is guarded
   here is that the answer arrives whole - that the worked examples the prose
   promises are on screen beside it, that the panel opens on something, and that
   the noun it teaches is the one every other surface in this flow uses. */

const html = renderToStaticMarkup(createElement(ReadingRoom, {
  open: true,
  onClose: () => {},
  config: DIMENSIONS_READING_ROOM,
}))

describe('what the panel is', () => {
  it('is nothing at all until it is opened', () => {
    expect(renderToStaticMarkup(createElement(ReadingRoom, {
      open: false, onClose: () => {}, config: DIMENSIONS_READING_ROOM,
    }))).toBe('')
  })

  it('names its subject where the reader can see it', () => {
    expect(html).toContain('How it works')
    expect(html).toContain('Dimensions in Omne')
  })

  it('opens on the first section so the panel never lands shut', () => {
    const opened = html.match(/aria-expanded="(true|false)"/g) ?? []
    expect(opened[0]).toBe('aria-expanded="true"')
    expect(opened.slice(1).every(a => a === 'aria-expanded="false"')).toBe(true)
    expect(opened).toHaveLength(DIMENSIONS_READING_ROOM.sections.length)
  })

  it('answers in the order someone works it out', () => {
    expect(DIMENSIONS_READING_ROOM.sections.map(s => s.title)).toEqual([
      'What a dimension is',
      'How dimensions work',
      'This step is optional',
    ])
  })
})

/* Every claim the prose makes is checkable on screen, because a reference panel
   that describes an example without showing one is asking the reader to picture
   it. Each of these assertions pairs a sentence with the specimen under it. */
describe('the prose and the specimens under it agree', () => {
  it('shows the two dimensions it names, with the values it names', () => {
    for (const word of ['Location', 'Department']) expect(html, word).toContain(word)
    for (const value of ['USA', 'Hong Kong', 'Singapore', 'United Kingdom']) {
      expect(html, value).toContain(value)
    }
    for (const value of ['Business', 'Design', 'Engineering', 'Sales', 'Operations']) {
      expect(html, value).toContain(value)
    }
  })

  it('tags the account it says it tags, in a table with the columns it describes', () => {
    // The filtering and posting lines are only checkable against 51090 Travel
    // carrying USA (default) and Singapore, and Sales (Mahad's copy, 2026-10-08).
    expect(html).toContain('51090')
    expect(html).toContain('Travel')
    expect(html).toContain('USA (default), Singapore')
    expect(html).toContain('GL account no.')
    expect(html).toContain('the line fills in with USA and')
    expect(html).toContain('you can switch it to Singapore on that line')
  })

  it('gives each column more than one value, so it reads as a filter and not a label', () => {
    // Location holding only USA would show nothing about why you would filter.
    expect(html).toContain('Hong Kong')
    expect(html).toContain('Advertising')
    expect(html).toContain('Software')
  })

  it('says the step can be skipped, since the footer never blocks it', () => {
    expect(html).toMatch(/have to create dimensions/i)
    expect(html).toMatch(/If you skip this step/i)
  })

  it('says where a dimension can be added afterwards', () => {
    expect(html).toContain('chart of accounts listing')
  })
})

describe('the way into the walkthrough', () => {
  it('is absent unless the panel is given one', () => {
    expect(html).not.toContain('Take the guided walkthrough')
  })

  it('counts the cards this tour actually has, not the import tour', () => {
    const withTail = renderToStaticMarkup(createElement(ReadingRoom, {
      open: true,
      onClose: () => {},
      config: DIMENSIONS_READING_ROOM,
      tail: createElement(WalkthroughReplayRow, { onStart: () => {}, count: DIMENSIONS_CARDS.length }),
    }))
    expect(withTail).toContain(`${DIMENSIONS_CARDS.length} short cards`)
  })
})

describe('the panel stays in the house voice', () => {
  it('calls it a dimension everywhere, never a group filter', () => {
    expect(html).not.toMatch(/group.filter/i)
  })

  it('writes no em dashes, en dashes or curly apostrophes', () => {
    expect(html).not.toContain('—')
    expect(html).not.toContain('–')
    expect(html).not.toContain('’')
  })

  it('heads each section without punctuating it as a sentence', () => {
    for (const { title } of DIMENSIONS_READING_ROOM.sections) {
      expect(title, title).not.toContain('—')
      expect(title.endsWith('.'), title).toBe(false)
    }
  })

  it('gives each section a heading nothing else in the panel repeats', () => {
    const titles = DIMENSIONS_READING_ROOM.sections.map(s => s.title)
    expect(new Set(titles).size).toBe(titles.length)
  })
})

/* Mahad, 2026-10-08: the Dimensions page's guide is the setups' guide, less
   the section about a step the page doesn't have. */
describe('the Dimensions page guide', () => {
  it('reads the same sections as the setups, without the optional step', () => {
    expect(DIMENSIONS_PAGE_READING_ROOM.title).toBe(DIMENSIONS_READING_ROOM.title)
    expect(DIMENSIONS_PAGE_READING_ROOM.sections.map(s => s.title)).toEqual(
      DIMENSIONS_READING_ROOM.sections.map(s => s.title).filter(t => t !== 'This step is optional'),
    )
    expect(DIMENSIONS_PAGE_READING_ROOM.sections.map(s => s.title)).not.toContain('Where dimensions come from')
  })
})
