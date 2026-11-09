import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { ReviewRow } from './ReviewRow'
import {
  REVIEW_COLUMNS, DEFAULT_COLUMN_WIDTHS, dimensionColumns, dimensionKey,
  type ColumnKey, type ReviewColumn, type ReviewRowView,
} from './reviewColumns'

/* A segmented import collapses the rows that differ only in their dimension
   parts into one account, so the grid shows fewer rows than the file had. That
   is a large claim to make silently, and the row is the only place it is made:
   the count and the numbers those rows arrived as have to be on it. */

function markup(over: Partial<ReviewRowView> = {}, columns: ReviewColumn[] = REVIEW_COLUMNS) {
  const row: ReviewRowView = {
    row: 2, number: '71100', name: 'Travel', type: 'Expense',
    verdict: 'ready', flagged: new Set(), message: '', needsDetails: false, excluded: false,
    ...over,
  }
  return renderToStaticMarkup(createElement(ReviewRow, {
    row, position: 1, columns, widths: DEFAULT_COLUMN_WIDTHS,
    rowHeight: 44, query: '', selected: false, activeKey: null, editingKey: null,
    edited: new Map(), zebra: false, seam: false, parentCandidates: [],
    onSelect: () => {}, onFocusCell: () => {}, onEditCell: () => {}, onCommit: () => {},
    onCancelEdit: () => {}, onRowAction: () => {}, onContextMenu: () => {},
  }))
}

/** The one `<td>` for a column, so an assertion cannot be satisfied by another. */
function cell(html: string, key: ColumnKey) {
  const from = html.indexOf(`data-cell-key="${key}"`)
  expect(from).toBeGreaterThan(-1)
  return html.slice(from, html.indexOf('</td>', from))
}

/* A summary is written once however many times the file states it, so the row
   that stands for it has to say how many statements it answers for. */
describe('a restated summary says so', () => {
  it('counts the statements of it the file held', () => {
    const html = markup({ mergedFrom: ['01-71100-40', '01-71100-50'] })
    expect(html).toContain('stated 2 times')
  })

  it('names the codes those statements arrived as, so the count can be checked', () => {
    const html = markup({ mergedFrom: ['01-71100-40', '01-71100-50'] })
    expect(html).toContain('01-71100-40')
    expect(html).toContain('01-71100-50')
  })

  it('says nothing on a row the file stated once', () => {
    expect(markup()).not.toContain('stated')
  })

  /* The number column holds the account number, not any of the codes it was
     stated as. A row edited here is edited as the account, which is what the
     user is looking at. */
  it('shows the account number in the number column', () => {
    const number = cell(markup({ mergedFrom: ['01-71100-40', '01-71100-50'] }), 'number')
    expect(number).toContain('>71100<')
    expect(number).not.toContain('01-71100')
  })
})

/* A dimension is a column the file never carried: 01-71100-40 said Department
   40, and the row is where that reading is shown applied. */
describe('a dimension read out of the number', () => {
  const cols = dimensionColumns(['Department'])
  const key = dimensionKey('Department')

  it('draws the value the number was read as', () => {
    expect(cell(markup({ [key]: 'Marketing' }, cols), key)).toContain('Marketing')
  })

  it('draws nothing for a number that carried none, rather than inventing one', () => {
    const blank = cell(markup({}, cols), key)
    expect(blank).not.toContain('Marketing')
    expect(blank).not.toContain('Unassigned')
  })

  /* Editing one would leave the number saying 40 and the column saying Sales, so
     the cell is arrowed through but never opened. */
  it('does not offer to be typed into', () => {
    expect(cell(markup({ [key]: 'Marketing' }, cols), key)).not.toContain('cursor-cell')
  })
})
