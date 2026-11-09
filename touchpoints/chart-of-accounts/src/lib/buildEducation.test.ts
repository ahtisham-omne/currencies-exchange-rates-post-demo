import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReadingRoom } from '../components/walkthrough/ReadingRoom'
import { CHART_READING_ROOM, GUIDED_ACCOUNTS_READING_ROOM, SCRATCH_ACCOUNTS_READING_ROOM } from '../components/BuildEducation'
import type { ReadingRoomConfig } from '../components/walkthrough/ReadingRoom'

const textOf = (config: ReadingRoomConfig) =>
  renderToStaticMarkup(createElement(ReadingRoom, { open: true, onClose: () => {}, config }))
    .replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ')
const titles = (config: ReadingRoomConfig) => config.sections.map(s => s.title)

/* Mahad, 2026-10-08, and his copy of 2026-10-09: the chart page's How it works is the setups' Accounts guide,
   *"the exact same content"*, read where the chart is already live. */
describe('the chart page guide', () => {
  it('reads the Accounts guide, less publishing', () => {
    for (const setup of [GUIDED_ACCOUNTS_READING_ROOM, SCRATCH_ACCOUNTS_READING_ROOM]) {
      expect(titles(CHART_READING_ROOM)).toEqual(titles(setup).filter(t => t !== 'What happens when I publish?'))
    }
  })

  it('names the button the page has, and the row menu, not a + it does not have', () => {
    const text = textOf(CHART_READING_ROOM)
    expect(text).toContain('Create GL account button')
    expect(text).toContain('Create account above')
    expect(text).not.toContain('Hover between two rows')
    expect(text).not.toContain('Add account button')
  })

  it('keeps the setups naming their own buttons', () => {
    expect(textOf(GUIDED_ACCOUNTS_READING_ROOM)).toContain('Selecting Publish chart saves')
    expect(textOf(SCRATCH_ACCOUNTS_READING_ROOM)).toContain('Selecting Publish saves')
    expect(textOf(SCRATCH_ACCOUNTS_READING_ROOM)).toContain('From the Add account button')
  })

  // Decision 115: allowed as an exception, with a written reason (COA-19).
  it('says of a control account that a manual entry is an exception, with a reason', () => {
    expect(textOf(CHART_READING_ROOM)).toContain('to a control account only as an exception')
    expect(textOf(CHART_READING_ROOM)).toContain('A written reason is required')
  })
})
