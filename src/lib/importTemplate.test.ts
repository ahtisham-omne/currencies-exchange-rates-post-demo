import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  TEMPLATE_COLUMNS, TEMPLATE_FIELDS, REQUIRED_TEMPLATE_FIELDS, OPTIONAL_TEMPLATE_FIELDS,
  TEMPLATE_EXAMPLE_ROW_COUNT, TEMPLATE_EXAMPLE_ROWS, MAPPING_COLUMNS, MAPPING_TARGETS,
  FIELD_HEADERS, normalizeHeader, headerRowIndex, templateHeader, templateFieldSentence,
  parseTemplateCsv, parseTemplateGrid, csvGrid, TEMPLATE_FILENAME,
  readTemplateGrid, templateExampleRows, templateExamplesMessage,
} from './importTemplate'
import { parseWorkbook } from './workbook'
import { runUploadValidation } from './uploadValidation'
import { seedAccounts, seedNumberingScheme } from './seed'

// The template is a contract with a stranger: they download a file, type into it
// somewhere we never see, and hand it back. The files are Mahad's, shipped as
// they are (2026-10-02), so the one thing that must always hold is that the
// files we hand out are files we can read - most of these tests read the shipped
// files themselves.

const shipped = (format: keyof typeof TEMPLATE_FILENAME) =>
  readFileSync(join(__dirname, '../../public/templates', TEMPLATE_FILENAME[format]))
const CSV = () => shipped('csv').toString('utf8')
const XLSX = () => parseWorkbook(new Uint8Array(shipped('excel')))

/* The examples under a header row, as a grid, read without going through either file. */
const EXAMPLE_GRID = [
  TEMPLATE_COLUMNS.map(templateHeader),
  ...TEMPLATE_EXAMPLE_ROWS.map(r => TEMPLATE_COLUMNS.map(c => r[c.header])),
]

describe('template columns', () => {
  it('marks the required columns and only those', () => {
    const marked = TEMPLATE_COLUMNS.filter(c => templateHeader(c).endsWith(' *')).map(c => c.header)
    expect(marked).toEqual(REQUIRED_TEMPLATE_FIELDS)
    expect(REQUIRED_TEMPLATE_FIELDS).toEqual([
      'GL account no.', 'GL account name', 'GL account category', 'GL account type',
    ])
  })

  it('names every field exactly once, so no cell feeds two fields', () => {
    const fields = TEMPLATE_COLUMNS.map(c => c.field)
    expect(new Set(fields).size).toBe(fields.length)
  })

  it('reads its own headers back, marker and casing and all', () => {
    for (const col of TEMPLATE_COLUMNS) {
      expect(FIELD_HEADERS[col.field]).toContain(normalizeHeader(templateHeader(col)))
      expect(FIELD_HEADERS[col.field]).toContain(normalizeHeader(col.header.toUpperCase()))
    }
  })

  /* A download taken before 2026-10-02 still says Contra and Parent Account No. */
  it('still reads the headers an older download of the template carries', () => {
    expect(FIELD_HEADERS.contra).toContain('contra')
    expect(FIELD_HEADERS.parent).toContain(normalizeHeader('Parent Account No.'))
  })

  it('keeps every dropdown inside the 255 characters Excel allows inline', () => {
    for (const col of TEMPLATE_COLUMNS) {
      if (col.list && 'values' in col.list) {
        expect(`"${col.list.values.join(',')}"`.length).toBeLessThanOrEqual(255)
      }
    }
  })
})

/* The shipped files and the columns this module reads them by have to agree,
   header for header and example for example. */
describe('the shipped files', () => {
  it('open on the headers this module reads, in its order', async () => {
    expect(csvGrid(CSV())[0]).toEqual(TEMPLATE_COLUMNS.map(templateHeader))
    expect((await XLSX())[0]).toEqual(TEMPLATE_COLUMNS.map(templateHeader))
  })

  it('carry exactly the examples this module knows, so an untouched upload is caught', async () => {
    expect(parseTemplateCsv(CSV())).toEqual(parseTemplateGrid(EXAMPLE_GRID))
    expect(parseTemplateGrid(await XLSX())).toEqual(parseTemplateGrid(EXAMPLE_GRID))
    expect(templateExampleRows(parseTemplateCsv(CSV()))).toEqual([2, 3, 4, 5])
  })

  it('ships the Excel one as a real workbook, which the importer reads by extension', () => {
    expect(shipped('excel').subarray(0, 2).toString('latin1')).toBe('PK')
  })
})

describe('header row detection', () => {
  it('takes the first row of the shipped CSV and workbook, which open on the headers', async () => {
    expect(headerRowIndex(csvGrid(CSV()))).toBe(0)
    expect(headerRowIndex(await XLSX())).toBe(0)
  })

  it('looks past a row of group labels above the headers', () => {
    const band = ['Identity', '', '', 'Classification', '', '', 'Hierarchy', 'Settings', '', '']
    expect(headerRowIndex([band, TEMPLATE_COLUMNS.map(templateHeader)])).toBe(1)
  })

  it('takes row one when a foreign export has nothing above its headers', () => {
    expect(headerRowIndex([['Account Code', 'Account Name', 'Type'], ['1000', 'Cash', 'Asset']])).toBe(0)
  })

  it('looks past a title line', () => {
    const grid = [['Chart of accounts export'], ['Account Code', 'Account Name', 'Type'], ['1000', 'Cash', 'Asset']]
    expect(headerRowIndex(grid)).toBe(1)
  })
})

describe('the examples the files ship', () => {
  it('parses back into the accounts they show', () => {
    const rows = parseTemplateGrid(EXAMPLE_GRID)
    expect(rows.length).toBe(TEMPLATE_EXAMPLE_ROW_COUNT)
    expect(rows[0]).toMatchObject({ number: '11000', name: 'Current Assets', type: 'Asset', glType: 'Summary', parent: undefined })
    expect(rows[1]).toMatchObject({ number: '11100', glType: 'Summary', parent: '11000' })
    expect(rows[2]).toMatchObject({ number: '11130', glType: 'Posting', parent: '11100', role: 'Bank', normalBalance: 'Debit' })
    expect(rows[3]).toMatchObject({ number: '11160', role: 'Bank', currency: 'EUR' })
  })

  it('points a row number at the row a spreadsheet would show', () => {
    expect(parseTemplateGrid(EXAMPLE_GRID)[0].row).toBe(2)
  })

  it('validates against a chart that already holds those numbers', () => {
    const result = runUploadValidation(parseTemplateGrid(EXAMPLE_GRID), seedAccounts, 'USD')
    expect(result.invalid.map(i => i.row)).toEqual([2, 3, 4, 5])
    expect(result.newAccounts).toEqual([])
  })

  it('imports all four into a chart that has none of them yet, nested as stated', () => {
    const result = runUploadValidation(parseTemplateGrid(EXAMPLE_GRID), [], 'USD')
    expect(result.invalid).toEqual([])
    expect(result.newAccounts.map(a => [a.accountNumber, a.glAccountType, a.normalBalance, a.currencyCode]))
      .toEqual([['11000', 'Summary', 'Debit', 'USD'], ['11100', 'Summary', 'Debit', 'USD'], ['11130', 'Posting', 'Debit', 'USD'], ['11160', 'Posting', 'Debit', 'EUR']])
    const [current, cash, chase, eur] = result.newAccounts
    expect(current.parentId).toBeNull()
    expect(cash.parentId).toBe(current.id)
    expect(chase.parentId).toBe(cash.id)
    expect(eur.parentId).toBe(cash.id)
    // A Debit side on an asset is its own side, so neither bank is a contra account.
    expect(result.newAccounts.some(a => a.isContra)).toBe(false)
  })
})

describe('reading a file we did not write', () => {
  it('maps a QuickBooks-style export onto our fields', () => {
    const rows = parseTemplateGrid([
      ['Account Number', 'Account Name', 'Type', 'Parent', 'Description'],
      ['1020', 'Operating Bank', 'Asset', '1015', 'Main account'],
    ])
    expect(rows).toEqual([{
      row: 2, number: '1020', name: 'Operating Bank', type: 'Asset',
      glType: undefined, role: undefined, contra: undefined, status: undefined,
      parent: '1015', currency: undefined, description: 'Main account',
      normalBalance: undefined,
    }])
  })

  it('will not let one Type column stand in for the category and the GL type', () => {
    const rows = parseTemplateGrid([['Type', 'Account Code'], ['Asset', '1020']])
    expect(rows[0].type).toBe('Asset')
    expect(rows[0].glType).toBeUndefined()
  })

  it('returns nothing when the file is headers alone', () => {
    expect(parseTemplateCsv(CSV().split(/\r?\n/).slice(0, 1).join('\n'))).toEqual([])
  })

  it('keeps a quoted comma inside its own cell', () => {
    const rows = parseTemplateCsv('GL account no.,GL account name\n1020,"Bank, operating"')
    expect(rows[0].name).toBe('Bank, operating')
  })
})

describe('the card in the importer', () => {
  it('lists exactly the columns the file carries', () => {
    expect(TEMPLATE_FIELDS).toEqual(TEMPLATE_COLUMNS.map(c => c.header))
  })
})

// Four screens name these columns: the importer's card, the setup hint, the
// hint card's table and the mapping step. A column added above has to reach all
// four, so each one is derived here rather than typed out again.
describe('one column list', () => {
  it('splits the columns into required and optional with nothing lost', () => {
    expect([...REQUIRED_TEMPLATE_FIELDS, ...OPTIONAL_TEMPLATE_FIELDS].sort()).toEqual([...TEMPLATE_FIELDS].sort())
    expect(OPTIONAL_TEMPLATE_FIELDS).not.toContain('GL account no.')
  })

  it('offers every column as a mapping target, and a name for each in the file', () => {
    expect(MAPPING_TARGETS).toEqual(TEMPLATE_FIELDS)
    expect(MAPPING_COLUMNS.length).toBe(TEMPLATE_COLUMNS.length)
    expect(MAPPING_COLUMNS[0]).toBe('Account Code')
    expect(new Set(MAPPING_COLUMNS).size).toBe(MAPPING_COLUMNS.length)
  })

  it('reads an example by header, so a hint shows what the file ships', () => {
    expect(TEMPLATE_EXAMPLE_ROWS).toHaveLength(TEMPLATE_EXAMPLE_ROW_COUNT)
    expect(TEMPLATE_EXAMPLE_ROWS[0]['GL account no.']).toBe('11000')
    expect(TEMPLATE_EXAMPLE_ROWS[0]['GL account type']).toBe('Summary')
    for (const field of REQUIRED_TEMPLATE_FIELDS) expect(TEMPLATE_EXAMPLE_ROWS[0][field]).not.toBe('')
  })

  it('explains every column, and says what a blank does', () => {
    for (const col of TEMPLATE_COLUMNS) {
      expect(col.about.length, col.header).toBeGreaterThan(20)
      expect(col.about.endsWith('.'), col.header).toBe(true)
      if (col.required) expect(col.blankMeans, col.header).toBeUndefined()
      else expect(col.blankMeans, col.header).toBeTruthy()
    }
  })

  it('reads a column list as a sentence', () => {
    expect(templateFieldSentence(['Currency'])).toBe('Currency')
    expect(templateFieldSentence(['Currency', 'Status'])).toBe('Currency and Status')
    expect(templateFieldSentence(['A', 'B', 'C'])).toBe('A, B and C')
    expect(templateFieldSentence([])).toBe('')
  })
})

/* A file carrying segmented numbers usually carries the names of what is inside
   them in a column of its own, and that column is the cheapest way to name twenty
   codes. So the read keeps every column, not only the ones it recognised. */
describe('the columns a file carries that are not ours', () => {
  const GRID = [
    ['GL Account No.', 'Account Name', 'Category', 'GL Account Type', 'Entity name', 'Notes'],
    ['01-71100-40', 'Travel', 'Expense', 'Posting', 'UK Ltd', ''],
    ['02-71100-40', 'Travel', 'Expense', 'Posting', 'France SARL', ''],
  ]

  it('keeps a column we have no field for, headed as the file spelled it', () => {
    const headers = readTemplateGrid(GRID).columns.map(c => c.header)
    expect(headers).toContain('Entity name')
  })

  /* Keyed by the row's real position rather than held as a list, so a column
     still lines up with the rows after some of them have been excluded, which is
     what the refusal panel does. */
  it('keys its cells by the row they came from', () => {
    const { rows, columns } = readTemplateGrid(GRID)
    const entity = columns.find(c => c.header === 'Entity name')!
    expect(rows.map(r => entity.cellByRow[r.row])).toEqual(['UK Ltd', 'France SARL'])
  })

  // It can name nothing and fill nothing, so offering it only wastes a click.
  it('drops a column that is blank the whole way down, headed or not', () => {
    expect(readTemplateGrid(GRID).columns.map(c => c.header)).not.toContain('Notes')
  })

  it('keeps our own columns too, since one of them can name codes as well', () => {
    expect(readTemplateGrid(GRID).columns.map(c => c.header)).toContain('Account Name')
  })

  it('gives nothing back for a grid with no rows under its headers', () => {
    expect(readTemplateGrid([GRID[0]]).columns).toEqual([])
  })
})

/* Columns are matched by their header text and nothing else. What that matching
   found is reported back, because "we recognised none of your columns" and "we
   recognised your columns and you typed no accounts" are two different files and
   need two different things said about them. */
describe('which of our columns a file turned out to carry', () => {
  const OURS = [
    ['GL Account No.', 'GL Account Name', 'GL Account Category', 'GL Account Type'],
    ['71100', 'Travel', 'Expense', 'Posting'],
  ]
  const FOREIGN = [
    ['Sage export 2026-08-01', '', '', ''],
    ['Nominal', 'Description', 'Class', 'Kind'],
    ['71100', 'Travel', 'Expense', 'Posting'],
  ]

  it('names the fields it matched', () => {
    expect(readTemplateGrid(OURS).matched).toContain('number')
    expect(readTemplateGrid(OURS).matched).toContain('name')
  })

  it('leaves a field unmatched rather than guessing at a header it does not know', () => {
    const { matched } = readTemplateGrid(FOREIGN)
    for (const c of TEMPLATE_COLUMNS.filter(c => c.required)) {
      expect(matched, c.header).not.toContain(c.field)
    }
  })

  /* Sage calls the account's name its description, so our Description field takes
     the column holding "Travel" and nothing else matches. A header match is the
     only evidence there is, so the file is read as far as it can be and the blank
     numbers it produces are what the review grid then refuses. */
  it('matches on header text alone, which can match the wrong field', () => {
    expect(readTemplateGrid(FOREIGN).matched).toEqual(['description'])
  })

  it('still finds the headers under a title row', () => {
    expect(readTemplateGrid(FOREIGN).rows.map(r => r.description)).toEqual(['Travel'])
  })

  // A field is read from one column, so it cannot be matched to two.
  it('takes the category over the account type when one column answers to both', () => {
    const { rows, matched } = readTemplateGrid([['Code', 'Name', 'Type'], ['71100', 'Travel', 'Expense']])
    expect(rows[0].type).toBe('Expense')
    expect(rows[0].glType).toBeUndefined()
    expect(matched).not.toContain('glType')
  })
})

/* Read by position once the headers are found, so content past the last header
   has no column to go in and every cell on that row may be one place from where
   it was meant to be. The row is carried to the grid rather than read and
   quietly believed. */
describe('a row the reader cannot line up', () => {
  const HEAD = ['GL Account No.', 'GL Account Name', 'GL Account Category', 'GL Account Type']

  it('marks a row carrying content past the last header', () => {
    const { rows } = readTemplateGrid([
      HEAD,
      ['71100', 'Travel', 'Expense', 'Posting'],
      ['71200', 'Meals', 'Expense', 'Posting', 'stray'],
    ])
    expect(rows.map(r => r.unparseable)).toEqual([undefined, 'extra columns'])
  })

  it('leaves a row alone when the extra cells are blank', () => {
    const { rows } = readTemplateGrid([HEAD, ['71100', 'Travel', 'Expense', 'Posting', '', '  ']])
    expect(rows[0].unparseable).toBeUndefined()
  })

  it('refuses it with one sentence rather than one per blank cell', () => {
    const { rows } = readTemplateGrid([HEAD, ['71100', 'Travel', 'Expense', 'Posting', 'stray']])
    const result = runUploadValidation(rows, [], 'USD')
    expect(result.invalid.map(i => i.errors)).toEqual([
      ["This row couldn't be read. Check for merged cells or extra columns."],
    ])
  })
})

/* The workbook greys its examples and says on the Instructions tab that they are
   to be deleted. A reader who fills the sheet around them and uploads it has
   stated two accounts they do not have, so matching on what those rows say is
   the last chance to catch that. */
describe('the template examples left in the file', () => {
  const filled = parseTemplateGrid(EXAMPLE_GRID)

  it('finds every one of them in an untouched template', () => {
    expect(templateExampleRows(filled)).toHaveLength(TEMPLATE_EXAMPLE_ROW_COUNT)
  })

  it('finds none in a file the reader typed over', () => {
    const own = filled.map(r => ({ ...r, number: `9${r.number}`, name: `${r.name} of ours` }))
    expect(templateExampleRows(own)).toEqual([])
  })

  /* Both, because an example is only an example while it says what the template
     said. Renumbering it or renaming it makes it the reader's own account. */
  it('takes the number and the name together, not either alone', () => {
    const [first] = filled
    expect(templateExampleRows([{ ...first, name: 'Our own assets' }])).toEqual([])
    expect(templateExampleRows([{ ...first, number: '9000' }])).toEqual([])
  })

  it('names a run of them as a run', () => {
    expect(templateExamplesMessage([3, 4, 5, 6, 7]))
      .toBe('Rows 3 to 7 look like the template examples. Remove them, or exclude them here.')
  })

  it('names them one by one when they are not a run', () => {
    expect(templateExamplesMessage([3, 5, 9]))
      .toBe('Rows 3, 5 and 9 look like the template examples. Remove them, or exclude them here.')
  })

  it('speaks of one row in the singular', () => {
    expect(templateExamplesMessage([4]))
      .toBe('Row 4 looks like a template example. Remove it, or exclude it here.')
  })
})
