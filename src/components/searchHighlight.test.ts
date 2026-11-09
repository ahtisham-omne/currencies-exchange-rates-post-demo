import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/* A row is in a result because something in it matched. Without the yellow the
   reader has to find that something themselves, which on a description column is
   a sentence-long hunt per row - the Transactions tab shipped that way while the
   chart beside it marked its hits, and the two read as different products.
   So: one mark, one implementation, and every table that offers a search box
   uses it. */

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8')

const SEARCHABLE_TABLES = [
  ['components', 'AccountTable.tsx'],
  ['components', 'AttachmentsTab.tsx'],
  ['pages', 'AccountDetail.tsx'],
  ['pages', 'GeneralLedger.tsx'],
  ['pages', 'Merge.tsx'],
  ['pages', 'importReview', 'cells.tsx'],
]

describe('the yellow behind a search match', () => {
  it.each(SEARCHABLE_TABLES)('marks matches in %s/%s', (...path) => {
    expect(read(...path)).toContain('<Marked')
  })

  it('is built once, from spans rather than an HTML string', () => {
    const ui = read('components', 'ui.tsx')
    expect(ui).toContain('export function Marked')
    // A journal entry line description is typed by a user. Assembling the mark as
    // markup and handing it to dangerouslySetInnerHTML would run whatever they typed.
    expect(ui).not.toMatch(/Marked[\s\S]{0,600}dangerouslySetInnerHTML/)
  })

  it('leaves no second implementation to drift from it', () => {
    for (const path of [['lib', 'utils.ts'], ['pages', 'importReview', 'reviewDerive.ts']]) {
      expect(read(...path)).not.toMatch(/highlightText|highlightSegments/)
    }
  })

  it('paints one colour, the module token', () => {
    expect(read('index.css')).toContain('.mark')
    for (const path of SEARCHABLE_TABLES) {
      expect(read(...path)).not.toMatch(/<mark\b/)
    }
  })
})
