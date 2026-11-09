import { describe, it, expect } from 'vitest'
import {
  countByStatus, searchableTexts, filterRows, sortRows,
  errorRowKeys, editedFields, moveColumn, pageOfRow,
} from './reviewDerive'
import {
  REVIEW_COLUMNS, REVIEW_COLUMN_ORDER, ROW_BG_CLASS, ROW_BG_OPAQUE, HEADER_BG_OPAQUE,
  dimensionColumns, dimensionKey, isDimensionKey, optionsFor,
  type ReviewField, type ReviewRowView, type ReviewStatus,
} from './reviewColumns'
import { runUploadValidation, type ParsedRow } from '../../lib/uploadValidation'
import { TEMPLATE_COLUMNS, FIELD_HEADERS } from '../../lib/importTemplate'
import { ACCOUNT_TYPE_META, CATEGORY_ORDER, categoryFirstNumber, type AccountType } from '../../types'

function view(row: number, verdict: ReviewStatus, over: Partial<ReviewRowView> = {}): ReviewRowView {
  return {
    row, number: String(1000 + row), name: `Account ${row}`, type: 'Asset',
    verdict, flagged: new Set(), message: '', needsDetails: false, excluded: false,
    ...over,
  }
}

/* A frozen cell stays put while the rest of the table slides beneath it, and the
   cells passing underneath paint on a lower layer of the same stacking context.
   Any alpha at all in a frozen fill therefore lets their text through, which is
   how the Result column came to read "Result GL account no." mid-scroll. There is
   no way to see that from a type, and a translucent Tailwind tint is the natural
   thing to reach for, so the two opaque maps are asserted opaque here. */
describe('the frozen columns are filled opaquely', () => {
  const fills = [...Object.values(ROW_BG_OPAQUE), ...Object.values(HEADER_BG_OPAQUE)]

  it('mixes every frozen fill down onto white rather than layering it over', () => {
    for (const fill of fills) {
      expect(fill).not.toMatch(/rgba|hsla|\btransparent\b/)
      // A color-mix has to name the white it lands on, or the rest shows through.
      if (fill.startsWith('color-mix')) expect(fill).toContain('#fff')
    }
  })

  it('offers a frozen fill for every tone a scrolling cell can take', () => {
    expect(Object.keys(ROW_BG_OPAQUE).sort()).toEqual(Object.keys(ROW_BG_CLASS).sort())
  })
})

describe('countByStatus', () => {
  it('counts each verdict and the whole set', () => {
    const counts = countByStatus([
      view(2, 'ready'), view(3, 'ready'), view(4, 'error'), view(5, 'warning'),
    ])
    expect(counts).toEqual({ all: 4, ready: 2, errors: 1, warnings: 1, needsDetails: 0 })
  })

  it('reports zeroes for an empty file rather than throwing', () => {
    expect(countByStatus([])).toEqual({ all: 0, ready: 0, errors: 0, warnings: 0, needsDetails: 0 })
  })

  /* Counted across the verdicts, not beside them. A bank row that also carries a
     warning is one row needing two different things done to it, and a to-do that
     only shows up when nothing else is wrong is a to-do that gets missed. */
  it('counts a row needing details on top of the verdict it already has', () => {
    const counts = countByStatus([
      view(2, 'ready', { needsDetails: true }),
      view(3, 'warning', { needsDetails: true }),
      view(4, 'ready'),
    ])
    expect(counts).toEqual({ all: 3, ready: 2, errors: 0, warnings: 1, needsDetails: 2 })
  })

  /* An error row is not importing, so what it will be missing afterwards is not
     yet a question. */
  it('leaves an error row out of the details count', () => {
    const counts = countByStatus([view(2, 'error', { needsDetails: true })])
    expect(counts.needsDetails).toBe(0)
  })
})

describe('filtering to the rows that need details', () => {
  const rows = [
    view(2, 'ready', { needsDetails: true }),
    view(3, 'warning', { needsDetails: true }),
    view(4, 'error', { needsDetails: true }),
    view(5, 'ready'),
  ]

  it('keeps every importing row that needs them, whatever its verdict', () => {
    expect(filterRows(rows, 'needsDetails', '').map(r => r.row)).toEqual([2, 3])
  })

  it('still narrows by the search', () => {
    expect(filterRows(rows, 'needsDetails', 'Account 3').map(r => r.row)).toEqual([3])
  })
})

describe('filterRows', () => {
  const rows = [
    view(2, 'ready', { name: 'Cash on hand' }),
    view(3, 'error', { name: 'Accounts receivable' }),
    view(4, 'warning', { name: 'Petty cash' }),
  ]

  it('narrows to one verdict', () => {
    expect(filterRows(rows, 'errors', '').map(r => r.row)).toEqual([3])
    expect(filterRows(rows, 'ready', '').map(r => r.row)).toEqual([2])
    expect(filterRows(rows, 'warnings', '').map(r => r.row)).toEqual([4])
    expect(filterRows(rows, 'all', '').map(r => r.row)).toEqual([2, 3, 4])
  })

  it('searches every column, case-insensitively', () => {
    expect(filterRows(rows, 'all', 'CASH').map(r => r.row)).toEqual([2, 4])
    expect(filterRows(rows, 'all', '1003').map(r => r.row)).toEqual([3])
  })

  it('applies the filter and the search together', () => {
    expect(filterRows(rows, 'ready', 'cash').map(r => r.row)).toEqual([2])
  })

  it('ignores a query that is only whitespace', () => {
    expect(filterRows(rows, 'all', '   ')).toHaveLength(3)
  })

  /* Every column the grid shows, as it prints - the Result column's chips
     included since 2026-10-05 (Mahad: *"the search should have everything in
     it"*). The verdict is read as its chip prints it, not as the stored key. */
  it('looks through every column the grid shows, the Result chip included', () => {
    const texts = searchableTexts(view(2, 'error', { description: 'opening balances' }))
    expect(texts).toContain('opening balances')
    expect(texts).toContain('Error')
    expect(filterRows([view(2, 'error'), view(3, 'ready')], 'all', 'error').map(r => r.row)).toEqual([2])
  })

  it('finds a needs-details row by its chip, but not an error row that is also a bank account', () => {
    const rows = [view(2, 'ready', { needsDetails: true }), view(3, 'error', { needsDetails: true }), view(4, 'ready')]
    expect(filterRows(rows, 'all', 'needs details').map(r => r.row)).toEqual([2])
  })
})

/* What the customer answered on the mapper is a claim about every row, and the
   review is the only screen that shows the claim applied. A dimension is not a
   column the file carried, so nothing static can hold it. */
describe('the dimensions read out of the numbers', () => {
  const cols = dimensionColumns(['Department', 'Location'])

  it('names a column after the dimension, and says where the value came from', () => {
    expect(cols.map(c => c.label)).toEqual(['Department', 'Location'])
    expect(cols[0].description).toContain('Read out of the account number')
  })

  /* The value is the number's digits plus the label given to that code, so a
     typed-in value could say Marketing while the number said 40, with nothing
     able to notice. */
  it('shows the value without letting it be typed over', () => {
    for (const c of cols) expect(c.readOnly).toBe(true)
  })

  /* Keyed apart from the file's own columns, so a customer who calls a dimension
     Status does not overwrite the file's Active / Inactive column. */
  it('cannot shadow a column the file carried', () => {
    const shadow = dimensionColumns(['Status'])[0]
    expect(shadow.key).not.toBe('status')
    expect(isDimensionKey(shadow.key)).toBe(true)
    expect(REVIEW_COLUMN_ORDER).not.toContain(shadow.key)
  })

  it('is searched even while its column is scrolled out of sight', () => {
    const rows = [
      view(2, 'ready', { [dimensionKey('Department')]: 'Marketing' }),
      view(3, 'ready', { [dimensionKey('Department')]: 'Sales' }),
    ]
    expect(filterRows(rows, 'all', 'marketing').map(r => r.row)).toEqual([2])
  })
})

describe('sortRows', () => {
  it('leaves the array untouched when nothing is sorted', () => {
    const rows = [view(3, 'ready'), view(2, 'ready')]
    expect(sortRows(rows, null)).toBe(rows)
  })

  it('does not mutate its input', () => {
    const rows = [view(3, 'ready', { name: 'Zebra' }), view(2, 'ready', { name: 'Apple' })]
    sortRows(rows, { key: 'name', dir: 'asc' })
    expect(rows.map(r => r.row)).toEqual([3, 2])
  })

  it('orders numbers numerically, not as text', () => {
    const rows = [
      view(2, 'ready', { number: '1100' }),
      view(3, 'ready', { number: '900' }),
      view(4, 'ready', { number: '10000' }),
    ]
    expect(sortRows(rows, { key: 'number', dir: 'asc' }).map(r => r.number)).toEqual(['900', '1100', '10000'])
    expect(sortRows(rows, { key: 'number', dir: 'desc' }).map(r => r.number)).toEqual(['10000', '1100', '900'])
  })

  it('ignores case when ordering names', () => {
    const rows = [
      view(2, 'ready', { name: 'bank' }),
      view(3, 'ready', { name: 'Assets' }),
      view(4, 'ready', { name: 'cash' }),
    ]
    expect(sortRows(rows, { key: 'name', dir: 'asc' }).map(r => r.name)).toEqual(['Assets', 'bank', 'cash'])
  })

  it('sorts blank optional columns without dropping the rows', () => {
    const rows = [view(2, 'ready', { parent: '1000' }), view(3, 'ready')]
    expect(sortRows(rows, { key: 'parent', dir: 'asc' })).toHaveLength(2)
  })
})

/* The bug worth a test of its own: selection keys on the spreadsheet row, so
   sorting must not change which rows a bulk action reaches. Keyed on array
   index instead, nothing throws - the import quietly brings in other accounts. */
describe('selection survives a sort', () => {
  const rows = [
    view(2, 'ready', { number: '1100', name: 'Cash' }),
    view(3, 'error', { number: '900', name: 'Bank' }),
    view(4, 'ready', { number: '10000', name: 'Equity' }),
  ]

  it('reaches the same rows before and after sorting', () => {
    const selected = new Set([rows[0].row, rows[2].row])
    const sorted = sortRows(rows, { key: 'number', dir: 'asc' })
    expect(sorted.filter(r => selected.has(r.row)).map(r => r.name).sort()).toEqual(['Cash', 'Equity'])
  })

  it('would reach different rows if it keyed on position', () => {
    const sorted = sortRows(rows, { key: 'number', dir: 'asc' })
    expect([sorted[0].name, sorted[2].name]).not.toEqual(['Cash', 'Equity'])
  })

  it('keeps the error set stable across a sort', () => {
    expect(errorRowKeys(sortRows(rows, { key: 'name', dir: 'desc' }))).toEqual(errorRowKeys(rows))
  })
})

describe('errorRowKeys', () => {
  it('names only the rows that cannot be imported', () => {
    expect(errorRowKeys([view(2, 'ready'), view(3, 'error'), view(4, 'warning'), view(5, 'error')]))
      .toEqual([3, 5])
  })

  it('returns spreadsheet rows, not positions', () => {
    expect(errorRowKeys([view(7, 'error')])).toEqual([7])
  })
})

describe('editedFields', () => {
  it('names the columns that changed', () => {
    const original: ParsedRow = { row: 2, number: '1000', name: 'Cash', type: 'Asset' }
    const edited = { ...original, name: 'Cash on hand', type: 'Liability' }
    expect([...editedFields(original as unknown as Record<string, unknown>, edited)].sort())
      .toEqual(['name', 'type'])
  })

  it('finds nothing when a row is untouched', () => {
    const original: ParsedRow = { row: 2, number: '1000', name: 'Cash', type: 'Asset' }
    expect(editedFields(original as unknown as Record<string, unknown>, { ...original }).size).toBe(0)
  })

  it('treats a missing column and a blank one as the same', () => {
    const original: ParsedRow = { row: 2, number: '1000', name: 'Cash', type: 'Asset' }
    expect(editedFields(original as unknown as Record<string, unknown>, { ...original, currency: '' }).size).toBe(0)
  })

  it('sees a value typed into a column that was blank', () => {
    const original: ParsedRow = { row: 2, number: '1000', name: 'Cash', type: 'Asset' }
    expect([...editedFields(original as unknown as Record<string, unknown>, { ...original, currency: 'EUR' })])
      .toEqual(['currency'])
  })

  it('ignores the row number, which is not a column', () => {
    const original: ParsedRow = { row: 2, number: '1000', name: 'Cash', type: 'Asset' }
    expect(editedFields(original as unknown as Record<string, unknown>, { ...original, row: 9 }).size).toBe(0)
  })
})

describe('moveColumn', () => {
  const order: ReviewField[] = ['number', 'name', 'type', 'glType']

  it('drops a column onto a later position', () => {
    expect(moveColumn(order, 'number', 'type')).toEqual(['name', 'type', 'number', 'glType'])
  })

  it('drops a column onto an earlier position', () => {
    expect(moveColumn(order, 'glType', 'name')).toEqual(['number', 'glType', 'name', 'type'])
  })

  it('returns the same array when the column has not moved', () => {
    expect(moveColumn(order, 'name', 'name')).toBe(order)
  })

  it('returns the same array when a key is not in the order', () => {
    expect(moveColumn(order, 'currency', 'name')).toBe(order)
  })

  it('never loses or duplicates a column', () => {
    const next = moveColumn(REVIEW_COLUMN_ORDER, 'description', 'number')
    expect([...next].sort()).toEqual([...REVIEW_COLUMN_ORDER].sort())
  })
})

describe('pageOfRow', () => {
  const rows = Array.from({ length: 55 }, (_, i) => view(i + 2, 'ready'))

  it('finds the page a row sits on', () => {
    expect(pageOfRow(rows, 2, 25)).toBe(1)
    expect(pageOfRow(rows, 27, 25)).toBe(2)
    expect(pageOfRow(rows, 52, 25)).toBe(3)
  })

  it('falls back to the first page for a row that is no longer there', () => {
    expect(pageOfRow(rows, 999, 25)).toBe(1)
  })
})

/* The grid draws whatever the template carries, so a column added to the
   template and not to the grid arrives in the file and cannot be fixed. */
describe('the grid covers the template', () => {
  // The template calls the category column "category"; ParsedRow calls it "type".
  const FIELD_ALIAS: Record<string, ReviewField> = { category: 'type' }
  const reviewKey = (field: string) => FIELD_ALIAS[field] ?? (field as ReviewField)

  it('has a column for every template column', () => {
    const keys = new Set(REVIEW_COLUMN_ORDER)
    for (const c of TEMPLATE_COLUMNS) {
      expect(keys.has(reviewKey(c.field)), `${c.header} (${c.field})`).toBe(true)
    }
  })

  /* Every column the template asks for, plus the ones it only reads. Our own
     file no longer asks for a number range, but a foreign export still states
     one and the grid is where a foreign column gets read, so the grid draws what
     the reader can fill rather than only what the template asks for. */
  it('adds no columns no file could fill', () => {
    const fields = new Set<string>((Object.keys(FIELD_HEADERS) as string[]).map(reviewKey))
    for (const key of REVIEW_COLUMN_ORDER) expect(fields.has(key), key).toBe(true)
  })

  it('offers the template’s own dropdown values, so the file and the grid agree', () => {
    for (const c of TEMPLATE_COLUMNS) {
      if (!c.list || !('values' in c.list)) continue
      const column = REVIEW_COLUMNS.find(r => r.key === reviewKey(c.field))
      expect(column?.options, c.header).toEqual(c.list.values)
    }
  })
})

/* The editors offer labels; validation reads raw strings. A dropdown offering a
   value the engine does not recognise flags the row it was meant to fix, and
   uploadValidation.test.ts would not catch it - it tests the engine, not the
   wiring. So run each option through the engine and require a clean row. */
describe('the enum editors emit values validation accepts', () => {
  /* Any number does for a fixture, because no number is refused and none of them
     decides where an account goes. One per category only so the rows do not
     collide with each other. */
  const numberFor = (category: AccountType) => String(categoryFirstNumber(category, 4))
  const labelFor = (category: AccountType) => ACCOUNT_TYPE_META[category].label
  const categoryOf = (label: string) =>
    CATEGORY_ORDER.find(c => ACCOUNT_TYPE_META[c].label === label) ?? CATEGORY_ORDER[0]

  // Every row the engine accepts states a GL account type, which has no default in
  // the engine: the point of these tests is what the editors emit, not what a blank
  // column implies.
  function validateOne(over: Partial<ParsedRow>): { accepted: boolean; errors: string[] } {
    const type = String(over.type ?? labelFor(CATEGORY_ORDER[0]))
    const number = numberFor(categoryOf(type))
    const row: ParsedRow = {
      row: 2, number, name: 'Test account', type, glType: 'Posting',
      ...over,
    }
    const result = runUploadValidation([row], [], 'USD')
    return { accepted: result.newAccounts.length === 1, errors: result.invalid.flatMap(i => i.errors) }
  }

  const enumColumns = REVIEW_COLUMNS.filter(c => c.editor === 'enum')

  it('offers an option list for every enum column', () => {
    expect(enumColumns.length).toBeGreaterThan(0)
    for (const c of enumColumns) expect(c.options?.length, c.key).toBeGreaterThan(0)
  })

  /* Asked of a row, not of the column, because the role list narrows to the
     category the row states: offering all seventeen let the dropdown hand back a
     value that fails the row it was opened to fix. */
  it('accepts every option each enum column offers a row', () => {
    for (const column of enumColumns) {
      for (const category of CATEGORY_ORDER) {
        const type = labelFor(category)
        for (const option of optionsFor(column, { type }) ?? []) {
          const { accepted, errors } = validateOne({ type, [column.key]: option } as Partial<ParsedRow>)
          expect(accepted, `${column.key} = "${option}" on ${type}: ${errors.join(' ')}`).toBe(true)
        }
      }
    }
  })

  it('rejects a category the engine cannot resolve, so the test above means something', () => {
    expect(validateOne({ type: 'Assets and things' }).accepted).toBe(false)
  })

  it('carries the category label through to the account it creates', () => {
    for (const category of CATEGORY_ORDER) {
      const label = labelFor(category)
      const result = runUploadValidation(
        [{ row: 2, number: numberFor(category), name: 'Test', type: label, glType: 'Posting' }],
        [], 'USD',
      )
      expect(result.newAccounts[0]?.accountType, label).toBe(category)
    }
  })

  it('creates a summary account when the type editor says Summary', () => {
    const { accepted } = validateOne({ glType: 'Summary' })
    const result = runUploadValidation(
      [{ row: 2, number: numberFor('AST'), name: 'Current assets', type: labelFor('AST'), glType: 'Summary' }],
      [], 'USD',
    )
    expect(accepted).toBe(true)
    expect(result.newAccounts[0]?.glAccountType).toBe('Summary')
    expect(result.newAccounts[0]?.isPosting).toBe(false)
  })

  it('marks a contra account when the contra editor says Yes', () => {
    const result = runUploadValidation(
      [{ row: 2, number: numberFor('AST'), name: 'Allowance for doubtful accounts', type: labelFor('AST'), glType: 'Posting', contra: 'Yes' }],
      [], 'USD',
    )
    expect(result.newAccounts[0]?.isContra).toBe(true)
    expect(result.newAccounts[0]?.normalBalance).toBe('Credit')
  })

  it('deactivates an account when the status editor says Inactive', () => {
    const result = runUploadValidation(
      [{ row: 2, number: numberFor('AST'), name: 'Old bank', type: labelFor('AST'), glType: 'Posting', status: 'Inactive' }],
      [], 'USD',
    )
    expect(result.newAccounts[0]?.status).toBe('Inactive')
  })
})
