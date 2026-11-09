// The import template: the files a user downloads, and the columns they carry.
//
// The two files are Mahad's, shipped as they are (2026-10-02): public/templates/
// chart-of-accounts-import-template.xlsx and .csv. The Excel file is four tabs:
// Accounts (the grid to fill in), Instructions, Field Reference and Reference.
// The CSV is the header row and the same four examples.
//
// This module describes those files so the rest of the import can read them:
// the card in the importer lists these columns, and the parser in
// uploadValidation matches against them. The headers, the Field Reference wording
// and the examples here are copied from the files, and a test reads the shipped
// files to hold the two together.

import type { ParsedRow } from './uploadValidation'

// --- Columns ---------------------------------------------------------------

/* The field on a parsed row that a column fills. Names the link between a
   spreadsheet column and ParsedRow in uploadValidation, so adding a column to
   the template forces a decision about where its value goes. */
export type RowField =
  | 'number' | 'name' | 'category' | 'classification' | 'glType' | 'parent'
  | 'normalBalance' | 'contra' | 'role'
  | 'currency' | 'status' | 'description'

export interface TemplateColumn {
  /* The header as written in the file, without the required marker. */
  header: string
  field: RowField
  required: boolean
  width: number
  /* What the column is for, in the reader's own terms, and what Omne does with
     the column when the cell is empty. These are the Field Reference tab, held
     on the column so a column added here cannot be missing from the tab that
     promises to explain all of them. A required column has no blank to explain. */
  about: string
  blankMeans?: string
  /* The dropdown offered on this column, if any. A literal list is capped by
     Excel at 255 characters, so a longer set is named and lives on Reference. */
  list?: { values: string[] } | { name: 'AccountRoles' }
  /* What other systems call this column. An importer's job is to read files it
     did not write, so a QuickBooks or Xero export still maps cleanly. */
  aliases?: string[]
}

/* In the files' order, under the files' headers. `about` and `blankMeans` are
   the Field Reference tab's two columns, word for word. */
export const TEMPLATE_COLUMNS: TemplateColumn[] = [
  {
    header: 'GL account no.', field: 'number', required: true, width: 18,
    aliases: ['account code', 'account number', 'number', 'code'],
    about: "The account's number. Letters, numbers and dashes, up to 100 characters. Imported exactly as you type it and never changed. Each number can be used once.",
  },
  {
    header: 'GL account name', field: 'name', required: true, width: 30,
    aliases: ['account name', 'name'],
    about: 'What the account is called. This name is shown across Omne.',
  },
  {
    header: 'Description', field: 'description', required: false, width: 38,
    blankMeans: 'Left empty',
    about: 'Optional text explaining what the account is for.',
  },
  {
    header: 'GL account category', field: 'category', required: true, width: 20,
    list: { values: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] },
    // "Type" meant the category in the older five-type model.
    aliases: ['category', 'account category', 'type'],
    about: 'One of five categories: Asset, Liability, Equity, Revenue or Expense. Decides which statement the account appears on and its normal balance.',
  },
  {
    header: 'Statement classification', field: 'classification', required: false, width: 24,
    aliases: ['classification', 'statement line', 'sub type', 'subtype'],
    blankMeans: 'Filled in from the role, the parent or the category',
    about: 'The line of the statement the account appears on, such as Current asset or Operating expense. See the Reference tab for every option and what it means. Leave it blank and Omne fills it in from the account role, then the parent summary, then the category. An account must have the same statement classification as its parent.',
  },
  {
    header: 'GL account type', field: 'glType', required: true, width: 17,
    list: { values: ['Summary', 'Posting'] },
    // Not "role": that names the account's identity now, not its structure.
    aliases: ['account type', 'structural type', 'gl type'],
    about: "Summary: a heading that shows the total of the accounts beneath it. You can't post to it. Posting: records transactions and holds a balance. This also decides which optional columns apply.",
  },
  {
    /* In place of the Contra column the template used to carry. A side opposite
       the category's is what makes a contra account, so the file states the side
       and Omne reads the contra flag off it (see uploadValidation). */
    header: 'Normal balance', field: 'normalBalance', required: false, width: 16,
    list: { values: ['Debit', 'Credit'] }, aliases: ['balance side'],
    blankMeans: 'Set from the category',
    about: 'The side the account increases on: Debit or Credit. Omne sets it from the category. Choose the opposite side only for a contra account, such as Accumulated Depreciation. Posting accounts only.',
  },
  {
    // No dropdown: the parent can be a row further down this same file.
    header: 'Parent', field: 'parent', required: false, width: 18,
    aliases: ['parent account no', 'parent code', 'parent account'],
    blankMeans: 'Sits directly under its category',
    about: "The summary account this account sits under and rolls up into. The five categories already exist as summary accounts, so a blank still rolls up. The parent must be a summary account with the same category and statement classification. The order of your rows doesn't matter.",
  },
  {
    header: 'Account role', field: 'role', required: false, width: 24,
    list: { name: 'AccountRoles' }, aliases: ['role'],
    blankMeans: 'No role',
    about: "What the account is used for in Omne, such as Bank or Accounts Receivable. Posting accounts only, one role per account. The role must fit the account's category and statement classification.",
  },
  {
    header: 'Currency', field: 'currency', required: false, width: 11,
    blankMeans: 'Your base currency',
    about: 'The currency the account holds. Only accounts with the Bank or Cash on Hand role can have their own currency.',
  },
  {
    header: 'Status', field: 'status', required: false, width: 11,
    list: { values: ['Active', 'Inactive'] },
    blankMeans: 'Active',
    about: "Active accounts can be used in transactions. Inactive accounts keep their history but can't be used in new transactions.",
  },
]

/* A field with no column of its own: the Contra column older downloads of this
   template carried, still read from a file that has it. */
const UNASKED_HEADERS: Partial<Record<RowField, string[]>> = {
  contra: ['contra', 'contra account'],
}

/* Lowercased, with the required marker and a trailing period dropped, so
   "GL Account No. *" and "gl account no" are the same header. */
export function normalizeHeader(raw: string): string {
  return (raw ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/\.$/, '')
}

/* Every name each field answers to, our template's own first. */
export const FIELD_HEADERS = {
  ...Object.fromEntries(
    TEMPLATE_COLUMNS.map(c => [c.field, [normalizeHeader(c.header), ...(c.aliases ?? [])]]),
  ),
  ...UNASKED_HEADERS,
} as Record<RowField, string[]>

const KNOWN_HEADERS = new Set(Object.values(FIELD_HEADERS).flat())

/* Which row holds the headers. Our own template puts them first, but a file from
   somewhere else opens with a title line or a run of group labels as often as
   not, and so did an older download of this template. The row that recognizes
   the most field names wins. Only the top of the file is considered: past that,
   a match is a data row that happens to read like a header. */
export function headerRowIndex(rows: string[][]): number {
  let best = 0
  let bestScore = -1
  for (let i = 0; i < Math.min(rows.length, 3); i++) {
    const score = rows[i].filter(c => KNOWN_HEADERS.has(normalizeHeader(c))).length
    if (score > bestScore) { bestScore = score; best = i }
  }
  return best
}

/* The header exactly as it appears in the file. The asterisk is a marker for the
   reader, and the parser strips it back off. */
export const templateHeader = (col: TemplateColumn) => col.header + (col.required ? ' *' : '')

export const TEMPLATE_FIELDS = TEMPLATE_COLUMNS.map(c => c.header)
export const REQUIRED_TEMPLATE_FIELDS = TEMPLATE_COLUMNS.filter(c => c.required).map(c => c.header)
export const OPTIONAL_TEMPLATE_FIELDS = TEMPLATE_COLUMNS.filter(c => !c.required).map(c => c.header)

/* The columns as a sentence, for the places that ask for a file in prose rather
   than listing its columns. Derived so a column added above cannot go missing
   from a hint that promises to name them all. */
export const templateFieldSentence = (fields: string[]) =>
  fields.length < 2 ? (fields[0] ?? '') : `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}`

/* The two sides of the field-mapping table: what a foreign export is likely to
   call each column, and what we call it. Both come off the column table, so the
   mapping step cannot be missing a column the file carries. */
export const MAPPING_COLUMNS = TEMPLATE_COLUMNS.map(c =>
  (c.aliases?.[0] ?? c.header).replace(/\b[a-z]/g, m => m.toUpperCase()),
)
export const MAPPING_TARGETS = TEMPLATE_FIELDS

/* The examples the files ship, in the files' column order: a summary, a summary
   under it, and two bank accounts under that, one in another currency. */
const EXAMPLE_ROWS: string[][] = [
  ['11000', 'Current Assets', 'Assets you expect to use or turn into cash within your operating cycle', 'Asset', 'Current asset', 'Summary', '', '', '', '', ''],
  ['11100', 'Cash and Cash Equivalents', 'Cash in bank accounts and on hand', 'Asset', 'Current asset', 'Summary', '', '11000', '', '', ''],
  ['11130', 'Operating - Chase Bank', 'Main account for day-to-day payments', 'Asset', 'Current asset', 'Posting', 'Debit', '11100', 'Bank', '', 'Active'],
  ['11160', 'EUR Account - Deutsche Bank', 'Euro bank account', 'Asset', 'Current asset', 'Posting', 'Debit', '11100', 'Bank', 'EUR', 'Active'],
]

export const TEMPLATE_EXAMPLE_ROW_COUNT = EXAMPLE_ROWS.length

/* The examples keyed by header, so a screen that shows what a filled-in row
   looks like shows the row the file actually ships with. */
export const TEMPLATE_EXAMPLE_ROWS: Record<string, string>[] = EXAMPLE_ROWS.map(
  cells => Object.fromEntries(TEMPLATE_COLUMNS.map((c, i) => [c.header, cells[i] ?? ''])),
)

const exampleKey = (number: string, name: string) =>
  `${number.trim().toLowerCase()} ${name.trim().toLowerCase()}`
const EXAMPLE_KEYS = new Set(EXAMPLE_ROWS.map(cells => exampleKey(cells[0], cells[1])))

/* Which of these rows are still the template's own examples. The workbook greys
   them and says so on the Instructions tab, but a reader who fills the sheet
   around them and uploads it has stated two accounts they do not have. Matching
   on what they say is the last chance to catch that. */
export function templateExampleRows(rows: ParsedRow[]): number[] {
  return rows.filter(r => EXAMPLE_KEYS.has(exampleKey(r.number, r.name))).map(r => r.row)
}

/** What the review step says about them. Named as a run where they are one. */
export function templateExamplesMessage(rows: number[]): string {
  if (rows.length === 1) return `Row ${rows[0]} looks like a template example. Remove it, or exclude it here.`
  const tail = 'Remove them, or exclude them here.'
  const contiguous = rows.every((r, i) => i === 0 || r === rows[i - 1] + 1)
  if (contiguous) return `Rows ${rows[0]} to ${rows[rows.length - 1]} look like the template examples. ${tail}`
  const named = `${rows.slice(0, -1).join(', ')} and ${rows[rows.length - 1]}`
  return `Rows ${named} look like the template examples. ${tail}`
}

// --- Files -----------------------------------------------------------------

export const TEMPLATE_FILENAME = {
  excel: 'chart-of-accounts-import-template.xlsx',
  csv: 'chart-of-accounts-import-template.csv',
} as const

/** Where each shipped file is served from. */
export const templateUrl = (format: keyof typeof TEMPLATE_FILENAME) =>
  `${import.meta.env.BASE_URL ?? '/'}templates/${TEMPLATE_FILENAME[format]}`

/* Hands the reader the shipped file, under its own name. Fetched and saved as a
   blob rather than linked, so the browser downloads it instead of opening the
   CSV as a page. */
export async function downloadTemplate(format: keyof typeof TEMPLATE_FILENAME): Promise<void> {
  const res = await fetch(templateUrl(format))
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = TEMPLATE_FILENAME[format]
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Released a moment later: revoked on the same tick, the download can be cut off.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// --- Reading ---------------------------------------------------------------
// The reader lives beside the writer because they have to agree on the same
// column names, and a template whose own file failed to parse would be the one
// bug this module exists to prevent.

/* Split one CSV line, honoring quoted fields and escaped quotes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let k = 0; k < line.length; k++) {
    const ch = line[k]
    if (q) {
      if (ch === '"') { if (line[k + 1] === '"') { cur += '"'; k++ } else q = false }
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

/* Splitting is all that separates a CSV from a workbook; both arrive at
   readTemplateGrid as a grid and are read the same way from there. */
export function parseTemplateCsv(text: string): ParsedRow[] {
  return readTemplateCsv(text).rows
}

/* A CSV as a grid, because the workbook reader hands back a grid too and
   everything downstream of here works on one shape. */
export function csvGrid(text: string): string[][] {
  return text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim() !== '').map(splitCsvLine)
}

export function readTemplateCsv(text: string): GridReading {
  return readTemplateGrid(csvGrid(text))
}

export function parseTemplateGrid(grid: string[][]): ParsedRow[] {
  return readTemplateGrid(grid).rows
}

// What a read of a file found.
export interface GridReading {
  rows: ParsedRow[]
  /* Every column of the file, kept whether or not we matched it to a field. A
     file whose numbers hold dimensions usually carries the names of what is inside
     them in a column of its own, and that column is the cheapest way to name
     twenty codes. */
  columns: FileColumn[]
  /* Which of our fields the file turned out to carry. A file with none of them
     is a file from somewhere else entirely, which is a different refusal from
     our own template with nothing typed into it yet. */
  matched: RowField[]
}

export interface FileColumn {
  /** Its position in the file. */
  at: number
  /** As the file spelled it, because this is offered back and has to be recognised. */
  header: string
  /* Keyed by the row's real position rather than held as a list, so the column
     still lines up with the rows after some of them have been excluded. */
  cellByRow: Record<number, string>
}

/* Where the headers are and which of the file's columns each of our fields is
   read from. */
interface GridMapping {
  /** Index into the file's non-blank rows. */
  headerRow: number
  columnOf: Partial<Record<RowField, number>>
}

/* The file with its blank rows dropped, which is what every index here counts
   in: the mapping's header row, a `ParsedRow.row`, and a `FileColumn.cellByRow`
   key. */
const significantRows = (grid: string[][]) =>
  grid.filter(r => r.some(c => (c ?? '').trim() !== ''))

/* Map header names onto our fields. Our own names come first; the rest are what
   other systems call the same column, since an importer exists to read files it
   did not write. A header we do not recognise leaves its field unread rather
   than being guessed at by position. */
function autoMapGrid(grid: string[][]): GridMapping {
  const lines = significantRows(grid)
  const head = headerRowIndex(lines)
  const headers = (lines[head] ?? []).map(normalizeHeader)
  const columnOf: Partial<Record<RowField, number>> = {}
  for (const field of Object.keys(FIELD_HEADERS) as RowField[]) {
    const at = headers.findIndex(h => FIELD_HEADERS[field].includes(h))
    if (at >= 0) columnOf[field] = at
  }
  // "Type" is a name both Category and Account Type answer to. When one column
  // carries it, it is the category, so Account Type is left unread rather than
  // reading the same cell twice and calling a row Summary because it says Asset.
  if (columnOf.glType !== undefined && columnOf.glType === columnOf.category) delete columnOf.glType
  return { headerRow: head, columnOf }
}

/* Read a grid into rows. Row numbers are the row's real position among the
   file's non-blank rows, so an error message points at a row the user can go and
   find. */
export function readTemplateGrid(grid: string[][]): GridReading {
  const lines = significantRows(grid)
  const { headerRow: head, columnOf } = autoMapGrid(grid)
  const matched = (Object.keys(columnOf) as RowField[]).filter(f => columnOf[f] !== undefined)
  if (lines.length < head + 2) return { rows: [], columns: [], matched }

  const rows: ParsedRow[] = []
  const columns: FileColumn[] = (lines[head] ?? []).map((header, at) => ({
    at,
    header: (header ?? '').trim(),
    cellByRow: {},
  }))
  for (let i = head + 1; i < lines.length; i++) {
    const cells = lines[i]
    columns.forEach((column, at) => {
      const cell = (cells[at] ?? '').trim()
      if (cell) column.cellByRow[i + 1] = cell
    })
    const get = (field: RowField) => {
      const at = columnOf[field]
      return at === undefined ? '' : (cells[at] ?? '').trim()
    }
    const opt = (field: RowField) => get(field) || undefined
    /* Content past the last header means the reader has no column to put it in,
       so every cell on this row may be one place from where it was meant to be.
       Carried to the grid to be fixed rather than read and quietly believed. */
    const overflow = cells.slice(columns.length).some(c => (c ?? '').trim() !== '')
    rows.push({
      row: i + 1,
      unparseable: overflow ? 'extra columns' : undefined,
      number: get('number'),
      name: get('name'),
      type: get('category'),
      classification: opt('classification'),
      glType: opt('glType'),
      role: opt('role'),
      contra: opt('contra'),
      status: opt('status'),
      parent: opt('parent'),
      currency: opt('currency'),
      description: opt('description'),
      normalBalance: opt('normalBalance'),
    })
  }
  /* A column that is blank the whole way down is dropped however it is headed: it
     can name nothing and it can fill nothing, so offering it is only a way to
     waste somebody's click. */
  return { rows, columns: columns.filter(c => Object.keys(c.cellByRow).length > 0), matched }
}
