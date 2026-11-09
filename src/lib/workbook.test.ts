import { describe, it, expect } from 'vitest'
import { deflateRawSync } from 'zlib'
import { parseWorkbook, buildWorkbook, columnIndex, columnName, WorkbookError } from './workbook'

// A workbook is the one input format we hand-parse, so these pin the parts of
// SpreadsheetML a real export actually uses: a shared-string table, cells that
// carry their own column reference with the blanks left out, and rich text split
// across runs. Excel writes deflated entries, so the fixtures below are deflated
// too - a reader that only handled stored entries would pass a round-trip test
// against our own writer and still fail on every real file.

const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const SIG_LOCAL = 0x04034b50
const SIG_CENTRAL = 0x02014b50
const SIG_EOCD = 0x06054b50

let crcTable: Uint32Array | null = null
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[i] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// A deflate-compressed zip, the way Excel actually writes one.
function zipDeflated(parts: Record<string, string>): Uint8Array {
  const enc = new TextEncoder()
  const files = Object.entries(parts).map(([name, text]) => {
    const raw = enc.encode(text)
    return { nameBytes: enc.encode(name), raw, data: new Uint8Array(deflateRawSync(raw)) }
  })
  const total = files.reduce((n, f) => n + 30 + f.nameBytes.length + f.data.length + 46 + f.nameBytes.length, 0) + 22
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  let at = 0
  const offsets: number[] = []
  for (const f of files) {
    offsets.push(at)
    view.setUint32(at, SIG_LOCAL, true)
    view.setUint16(at + 4, 20, true)
    view.setUint16(at + 8, 8, true)
    view.setUint32(at + 14, crc32(f.raw), true)
    view.setUint32(at + 18, f.data.length, true)
    view.setUint32(at + 22, f.raw.length, true)
    view.setUint16(at + 26, f.nameBytes.length, true)
    at += 30
    out.set(f.nameBytes, at); at += f.nameBytes.length
    out.set(f.data, at); at += f.data.length
  }
  const centralStart = at
  files.forEach((f, i) => {
    view.setUint32(at, SIG_CENTRAL, true)
    view.setUint16(at + 8, 0, true)
    view.setUint16(at + 10, 8, true)
    view.setUint32(at + 16, crc32(f.raw), true)
    view.setUint32(at + 20, f.data.length, true)
    view.setUint32(at + 24, f.raw.length, true)
    view.setUint16(at + 28, f.nameBytes.length, true)
    view.setUint32(at + 42, offsets[i], true)
    at += 46
    out.set(f.nameBytes, at); at += f.nameBytes.length
  })
  view.setUint32(at, SIG_EOCD, true)
  view.setUint16(at + 8, files.length, true)
  view.setUint16(at + 10, files.length, true)
  view.setUint32(at + 12, at - centralStart, true)
  view.setUint32(at + 16, centralStart, true)
  return out
}

function workbookWith(sheetXml: string, strings: string[], sheetPath = 'worksheets/sheet1.xml') {
  return zipDeflated({
    '_rels/.rels': `${DECL}<Relationships><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${DECL}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets><sheet name="Accounts" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${DECL}<Relationships><Relationship Id="rId1" Type="${REL}/worksheet" Target="${sheetPath}"/></Relationships>`,
    [`xl/${sheetPath}`]: `${DECL}<worksheet xmlns="${MAIN}"><sheetData>${sheetXml}</sheetData></worksheet>`,
    'xl/sharedStrings.xml': `${DECL}<sst xmlns="${MAIN}" count="${strings.length}">${strings.map(s => `<si><t>${s}</t></si>`).join('')}</sst>`,
  })
}

describe('column references', () => {
  it('reads a column letter as an index', () => {
    expect(['A', 'B', 'Z', 'AA', 'AB', 'BC'].map(columnIndex)).toEqual([0, 1, 25, 26, 27, 54])
  })

  it('writes an index back as the same letter', () => {
    expect([0, 1, 25, 26, 27, 54].map(columnName)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'BC'])
  })
})

describe('parseWorkbook', () => {
  it('inflates deflated entries and reads the shared-string table', async () => {
    const bytes = workbookWith(
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>',
      ['Account Code', 'Account Name', '100-2000-200', 'Accounts Payable'],
    )
    expect(await parseWorkbook(bytes)).toEqual([
      ['Account Code', 'Account Name'],
      ['100-2000-200', 'Accounts Payable'],
    ])
  })

  // The common real-world shape: a code typed as a number has no t attribute.
  it('reads a bare numeric cell as its literal text', async () => {
    expect(await parseWorkbook(workbookWith('<row r="1"><c r="A1"><v>1045</v></c></row>', []))).toEqual([['1045']])
  })

  // Excel omits empty cells entirely, so position has to come from r=, not order.
  it('places a cell by its reference, filling the gap it skipped', async () => {
    const bytes = workbookWith('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="D1" t="s"><v>1</v></c></row>', ['first', 'fourth'])
    expect(await parseWorkbook(bytes)).toEqual([['first', '', '', 'fourth']])
  })

  it('leaves a gap for a row number that was skipped', async () => {
    const bytes = workbookWith('<row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="3"><c r="A3" t="s"><v>1</v></c></row>', ['top', 'third'])
    expect(await parseWorkbook(bytes)).toEqual([['top'], [], ['third']])
  })

  it('joins rich text split across runs', async () => {
    const bytes = zipDeflated({
      'xl/workbook.xml': `${DECL}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': `${DECL}<Relationships><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
      'xl/worksheets/sheet1.xml': `${DECL}<worksheet xmlns="${MAIN}"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>`,
      'xl/sharedStrings.xml': `${DECL}<sst xmlns="${MAIN}"><si><r><t>Accounts </t></r><r><t>Payable</t></r></si></sst>`,
    })
    expect(await parseWorkbook(bytes)).toEqual([['Accounts Payable']])
  })

  it('reads an inline string', async () => {
    const bytes = workbookWith('<row r="1"><c r="A1" t="inlineStr"><is><t>Cash</t></is></c></row>', [])
    expect(await parseWorkbook(bytes)).toEqual([['Cash']])
  })

  it('decodes XML entities in a value', async () => {
    const bytes = workbookWith('<row r="1"><c r="A1" t="s"><v>0</v></c></row>', ['Repairs &amp; Maintenance &#65;'])
    expect(await parseWorkbook(bytes)).toEqual([['Repairs & Maintenance A']])
  })

  it('preserves significant whitespace', async () => {
    const bytes = workbookWith('<row r="1"><c r="A1" t="inlineStr"><is><t xml:space="preserve"> Cash </t></is></c></row>', [])
    expect(await parseWorkbook(bytes)).toEqual([[' Cash ']])
  })

  it('follows the workbook to a sheet that is not sheet1', async () => {
    const bytes = workbookWith('<row r="1"><c r="A1" t="s"><v>0</v></c></row>', ['from sheet4'], 'worksheets/sheet4.xml')
    expect(await parseWorkbook(bytes)).toEqual([['from sheet4']])
  })

  it('handles a self-closing empty cell', async () => {
    const bytes = workbookWith('<row r="1"><c r="A1"/><c r="B1" t="s"><v>0</v></c></row>', ['second'])
    expect(await parseWorkbook(bytes)).toEqual([['', 'second']])
  })

  it('rejects a csv that was renamed .xlsx', async () => {
    const bytes = new TextEncoder().encode('Account Code,Account Name\n1000,Assets')
    await expect(parseWorkbook(bytes)).rejects.toThrow(WorkbookError)
  })

  it('rejects a zip that is not a workbook', async () => {
    await expect(parseWorkbook(zipDeflated({ 'notes.txt': 'hello' }))).rejects.toThrow(WorkbookError)
  })
})

// The template the flow hands out has to be a file the flow can read back.
describe('buildWorkbook', () => {
  it('round-trips a grid through write and read', async () => {
    const grid = [
      ['Account Code', 'Account Name', 'Category'],
      ['100-2000-200', 'Accounts Payable', 'Liability'],
      ['1045', 'Repairs & Maintenance', 'Expense'],
    ]
    expect(await parseWorkbook(buildWorkbook(grid, 'Accounts'))).toEqual(grid)
  })

  it('keeps a blank cell in the middle of a row', async () => {
    const grid = [['a', '', 'c']]
    expect(await parseWorkbook(buildWorkbook(grid))).toEqual(grid)
  })

  it('escapes text that would otherwise break the XML', async () => {
    const grid = [['<Assets> & "Cash"']]
    expect(await parseWorkbook(buildWorkbook(grid))).toEqual(grid)
  })
})
