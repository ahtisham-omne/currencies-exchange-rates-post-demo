// Minimal XLSX reader and writer: enough of ZIP and SpreadsheetML to lift a
// header row and text cells off the first worksheet, which is all an imported
// chart of accounts is.
//
// No dependency. An .xlsx is a ZIP of XML, and the platform already ships the
// hard part: DecompressionStream('deflate-raw') inflates entries, so only the
// container needs reading. Writing uses stored (uncompressed) entries, which
// Excel accepts and which keeps the writer synchronous.
//
// Deliberately not handled: date serials (no date column is imported), styles,
// formulas beyond their cached result, ZIP64, and encrypted workbooks. Numbers
// come through as the literal text in <v>, so a code typed as a number reads
// back as "1000".

// Thrown for anything that isn't a readable workbook, so the caller can say so
// rather than showing an empty review table.
export class WorkbookError extends Error {}

const utf8 = new TextEncoder()
const decodeUtf8 = (b: Uint8Array) => new TextDecoder().decode(b)

// ---------------------------------------------------------------------------
// ZIP container
// ---------------------------------------------------------------------------

const SIG_EOCD = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50
const STORED = 0
const DEFLATED = 8

interface ZipEntry { name: string; method: number; start: number; compressedSize: number }

// Read the central directory rather than scanning local headers: an entry
// written by a streaming writer leaves its sizes in a trailing descriptor, and
// only the central copy is guaranteed to hold them.
function zipEntries(view: DataView, bytes: Uint8Array): ZipEntry[] {
  let eocd = -1
  const floor = Math.max(0, bytes.length - 65557)
  for (let i = bytes.length - 22; i >= floor; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) { eocd = i; break }
  }
  if (eocd < 0) throw new WorkbookError('That file is not a readable .xlsx workbook.')

  const count = view.getUint16(eocd + 10, true)
  let at = view.getUint32(eocd + 16, true)
  const entries: ZipEntry[] = []
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== SIG_CENTRAL) break
    const method = view.getUint16(at + 10, true)
    const compressedSize = view.getUint32(at + 20, true)
    const nameLen = view.getUint16(at + 28, true)
    const extraLen = view.getUint16(at + 30, true)
    const commentLen = view.getUint16(at + 32, true)
    const localAt = view.getUint32(at + 42, true)
    const name = decodeUtf8(bytes.subarray(at + 46, at + 46 + nameLen))
    if (compressedSize === 0xffffffff || localAt === 0xffffffff) {
      throw new WorkbookError('That workbook uses ZIP64, which this importer cannot read.')
    }
    // The local header repeats the name and carries its own extra field, whose
    // length can differ from the central one, so data starts past the local copy.
    if (view.getUint32(localAt, true) === SIG_LOCAL) {
      const localNameLen = view.getUint16(localAt + 26, true)
      const localExtraLen = view.getUint16(localAt + 28, true)
      entries.push({ name, method, start: localAt + 30 + localNameLen + localExtraLen, compressedSize })
    }
    at += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

async function inflate(chunk: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate-raw')
  const writer = stream.writable.getWriter()
  // Copied so the chunk is backed by a plain ArrayBuffer, which is what the
  // stream accepts; a subarray of the uploaded file is not.
  void writer.write(new Uint8Array(chunk))
  void writer.close()
  const out = await new Response(stream.readable).arrayBuffer()
  return new Uint8Array(out)
}

async function readZip(bytes: Uint8Array): Promise<Record<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out: Record<string, string> = {}
  for (const entry of zipEntries(view, bytes)) {
    const raw = bytes.subarray(entry.start, entry.start + entry.compressedSize)
    if (entry.method === STORED) out[entry.name] = decodeUtf8(raw)
    else if (entry.method === DEFLATED) out[entry.name] = decodeUtf8(await inflate(raw))
    // Any other method (bzip2, lzma) is left out; the sheet lookup then fails
    // with the same "not readable" message rather than a partial parse.
  }
  return out
}

// ---------------------------------------------------------------------------
// SpreadsheetML
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (whole, ent: string) => {
    if (ent[0] === '#') {
      const hex = ent[1] === 'x' || ent[1] === 'X'
      const code = parseInt(hex ? ent.slice(2) : ent.slice(1), hex ? 16 : 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return NAMED_ENTITIES[ent] ?? whole
  })
}

// Every <t> inside the element, concatenated: rich text splits one string across
// a run of them, and dropping all but the first would truncate the value.
function textOf(xml: string): string {
  let out = ''
  for (const m of xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) out += m[1]
  return decodeXml(out)
}

function sharedStrings(xml: string): string[] {
  if (!xml) return []
  return (xml.match(/<si\b[^>]*>[\s\S]*?<\/si>|<si\b[^>]*\/>/g) ?? []).map(textOf)
}

// Quote a CSV field only when it would otherwise change the shape of the row.
// Lives here beside the workbook writer because the import template is emitted
// in both formats and the two must agree on where a cell ends.
export function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// "BC" -> 54. Cells carry their own reference and blank ones are simply absent,
// so the column has to be read rather than counted.
export function columnIndex(ref: string): number {
  let n = 0
  for (const ch of ref) {
    const c = ch.toUpperCase().charCodeAt(0)
    if (c < 65 || c > 90) break
    n = n * 26 + (c - 64)
  }
  return n - 1
}

// 0 -> "A", 26 -> "AA".
export function columnName(index: number): string {
  let n = index + 1, out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = []
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = []
    for (const cell of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1] ?? ''
      const inner = cell[2] ?? ''
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1]
      let value: string
      if (type === 'inlineStr') {
        value = textOf(inner)
      } else {
        const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? ''
        if (type === 's') value = shared[parseInt(raw, 10)] ?? ''
        else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE'
        else value = decodeXml(raw)
      }
      const ref = /\br="([A-Z]+)[0-9]+"/i.exec(attrs)
      const at = ref ? columnIndex(ref[1]) : cells.length
      cells[at] = value
    }
    const rowRef = /\br="([0-9]+)"/.exec(rowMatch[1])
    const at = rowRef ? parseInt(rowRef[1], 10) - 1 : rows.length
    rows[at] = cells
  }
  // Sparse rows and cells leave holes; every reader downstream indexes blindly.
  const dense: string[][] = []
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? []
    const out: string[] = []
    for (let c = 0; c < row.length; c++) out[c] = row[c] ?? ''
    dense[r] = out
  }
  return dense
}

// The first sheet in the workbook's own order, which is not reliably sheet1.xml:
// deleting and re-adding a tab leaves the file numbered by creation. Resolved
// through the relationship the workbook actually points at, falling back to the
// lowest-numbered worksheet when those parts are missing.
function firstSheetPath(files: Record<string, string>): string | null {
  const relId = /<sheet\b[^>]*r:id="([^"]+)"/.exec(files['xl/workbook.xml'] ?? '')?.[1]
  if (relId) {
    // Attribute order isn't guaranteed, so match the element then read inside it.
    let target: string | undefined
    for (const rel of (files['xl/_rels/workbook.xml.rels'] ?? '').matchAll(/<Relationship\b[^>]*\/?>/g)) {
      if (/\bId="([^"]+)"/.exec(rel[0])?.[1] !== relId) continue
      target = /\bTarget="([^"]+)"/.exec(rel[0])?.[1]
      break
    }
    if (target) {
      const path = target.replace(/^\//, '').replace(/^xl\//, '')
      if (files[`xl/${path}`] != null) return `xl/${path}`
      if (files[path] != null) return path
    }
  }
  const sheets = Object.keys(files)
    .filter(k => /^xl\/worksheets\/[^/]+\.xml$/.test(k))
    .sort((a, b) => {
      const n = (s: string) => parseInt(/([0-9]+)\.xml$/.exec(s)?.[1] ?? '0', 10)
      return n(a) - n(b) || a.localeCompare(b)
    })
  return sheets[0] ?? null
}

export async function parseWorkbook(bytes: Uint8Array): Promise<string[][]> {
  const files = await readZip(bytes)
  // The old binary .xls is a different format entirely, not a zip of xl/ parts.
  if (!Object.keys(files).some(k => k.startsWith('xl/'))) {
    throw new WorkbookError('That file is not a readable .xlsx workbook.')
  }
  const path = firstSheetPath(files)
  if (!path) throw new WorkbookError('That workbook has no worksheets.')
  return parseSheet(files[path], sharedStrings(files['xl/sharedStrings.xml'] ?? ''))
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

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

// Stored entries only, so there is no compressor to write. A template is a few
// kilobytes and Excel reads an uncompressed zip without complaint.
function zipStored(parts: Record<string, string>): Uint8Array {
  const files = Object.entries(parts).map(([name, text]) => ({
    nameBytes: utf8.encode(name), data: utf8.encode(text),
  }))
  const total = files.reduce((n, f) => n + 30 + f.nameBytes.length + f.data.length + 46 + f.nameBytes.length, 0) + 22
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  let at = 0
  const offsets: number[] = []

  for (const f of files) {
    offsets.push(at)
    view.setUint32(at, SIG_LOCAL, true)
    view.setUint16(at + 4, 20, true)          // version needed
    view.setUint16(at + 6, 0, true)           // flags
    view.setUint16(at + 8, STORED, true)
    view.setUint32(at + 10, 0, true)          // fixed mod time/date, so output is deterministic
    view.setUint32(at + 14, crc32(f.data), true)
    view.setUint32(at + 18, f.data.length, true)
    view.setUint32(at + 22, f.data.length, true)
    view.setUint16(at + 26, f.nameBytes.length, true)
    view.setUint16(at + 28, 0, true)          // extra length
    at += 30
    out.set(f.nameBytes, at); at += f.nameBytes.length
    out.set(f.data, at); at += f.data.length
  }

  const centralStart = at
  files.forEach((f, i) => {
    view.setUint32(at, SIG_CENTRAL, true)
    view.setUint16(at + 4, 20, true)          // version made by
    view.setUint16(at + 6, 20, true)          // version needed
    view.setUint16(at + 8, 0, true)           // flags
    view.setUint16(at + 10, STORED, true)
    view.setUint32(at + 12, 0, true)          // mod time/date
    view.setUint32(at + 16, crc32(f.data), true)
    view.setUint32(at + 20, f.data.length, true)
    view.setUint32(at + 24, f.data.length, true)
    view.setUint16(at + 28, f.nameBytes.length, true)
    view.setUint16(at + 30, 0, true)          // extra
    view.setUint16(at + 32, 0, true)          // comment
    view.setUint16(at + 34, 0, true)          // disk number
    view.setUint16(at + 36, 0, true)          // internal attrs
    view.setUint32(at + 38, 0, true)          // external attrs
    view.setUint32(at + 42, offsets[i], true)
    at += 46
    out.set(f.nameBytes, at); at += f.nameBytes.length
  })

  view.setUint32(at, SIG_EOCD, true)
  view.setUint16(at + 4, 0, true)
  view.setUint16(at + 6, 0, true)
  view.setUint16(at + 8, files.length, true)
  view.setUint16(at + 10, files.length, true)
  view.setUint32(at + 12, at - centralStart, true)
  view.setUint32(at + 16, centralStart, true)
  view.setUint16(at + 20, 0, true)
  return out
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

// One cell. A plain string is an inline string in the default style, which is
// all a bare grid needs; the object form carries a style index and lets a value
// be written as a number so Excel right-aligns it.
export type Cell = string | { v: string; s?: number; num?: boolean }

export interface SheetRow {
  cells: (Cell | null)[]
  /* Points Excel at a taller row, for a wrapped two-line header. */
  height?: number
}

/* A list dropdown on a range. `list` is the formula1 body verbatim: either a
   quoted literal ("Yes,No") or a defined name. Excel caps a literal at 255
   characters, so a longer set has to live on a sheet and be named. */
export interface SheetValidation { sqref: string; list: string }

export interface SheetSpec {
  name: string
  rows: SheetRow[]
  colWidths?: number[]
  merges?: string[]
  /* Rows kept in view while the sheet scrolls. */
  freezeRows?: number
  validations?: SheetValidation[]
}

export interface WorkbookSpec {
  sheets: SheetSpec[]
  /* Name -> the range it refers to, e.g. "Reference!$A$11:$A$18". Lets a
     dropdown on one sheet read its values off another. */
  definedNames?: { name: string; refersTo: string }[]
  /* A whole <styleSheet> document. The writer stays ignorant of the palette:
     which fill means "required" is the template's business, not the format's. */
  styles?: string
}

function cellXml(cell: Cell | null | undefined, ref: string): string {
  if (cell == null) return ''
  const { v, s, num } = typeof cell === 'string' ? { v: cell, s: undefined, num: false } : cell
  // A styled blank still has to be written, or the fill and border stop at the
  // last cell that happened to hold text.
  if (v === '' && s === undefined) return ''
  const style = s === undefined ? '' : ` s="${s}"`
  if (num && v !== '') return `<c r="${ref}"${style}><v>${escapeXml(v)}</v></c>`
  if (v === '') return `<c r="${ref}"${style}/>`
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`
}

function sheetXml(sheet: SheetSpec): string {
  const width = sheet.rows.reduce((n, r) => Math.max(n, r.cells.length), 1)
  const rows = sheet.rows.map((row, r) => {
    const cells = row.cells.map((cell, c) => cellXml(cell, `${columnName(c)}${r + 1}`)).join('')
    const height = row.height ? ` ht="${row.height}" customHeight="1"` : ''
    return `<row r="${r + 1}"${height}>${cells}</row>`
  }).join('')

  const cols = sheet.colWidths?.length
    ? `<cols>${sheet.colWidths.map((w, i) => `<col width="${w}" customWidth="1" min="${i + 1}" max="${i + 1}"/>`).join('')}</cols>`
    : ''
  const freeze = sheet.freezeRows
    ? `<pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/>` +
      '<selection pane="bottomLeft" activeCell="A1" sqref="A1"/>'
    : '<selection activeCell="A1" sqref="A1"/>'
  const merges = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : ''
  const validations = sheet.validations?.length
    ? `<dataValidations count="${sheet.validations.length}">${sheet.validations.map(v =>
        `<dataValidation sqref="${v.sqref}" showDropDown="0" showInputMessage="0" showErrorMessage="0" allowBlank="1" type="list">` +
        `<formula1>${v.list}</formula1></dataValidation>`).join('')}</dataValidations>`
    : ''

  // Element order is fixed by the schema: cols before sheetData, merges and
  // validations after it. Out of order, Excel calls the file corrupt.
  return `${DECL}<worksheet xmlns="${MAIN_NS}">` +
    '<sheetPr><outlinePr summaryBelow="1" summaryRight="1"/><pageSetUpPr/></sheetPr>' +
    `<dimension ref="A1:${columnName(width - 1)}${Math.max(1, sheet.rows.length)}"/>` +
    `<sheetViews><sheetView workbookViewId="0">${freeze}</sheetView></sheetViews>` +
    '<sheetFormatPr baseColWidth="8" defaultRowHeight="15"/>' +
    cols +
    `<sheetData>${rows}</sheetData>` +
    merges +
    validations +
    '<pageMargins left="0.75" right="0.75" top="1" bottom="1" header="0.5" footer="0.5"/>' +
    '</worksheet>'
}

// Write a workbook of named sheets, with the widths, merges, frozen headers,
// dropdowns and styling a fill-in-me template needs. The import template is
// generated through this, so a template a user downloads is a file this module
// can read back: the first sheet is the grid, every cell an inline string.
export function buildStyledWorkbook(spec: WorkbookSpec): Uint8Array {
  const sheets = spec.sheets
  const parts: Record<string, string> = {}

  const sheetOverrides = sheets.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
  parts['[Content_Types].xml'] =
    `${DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheetOverrides +
    (spec.styles ? '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' : '') +
    '</Types>'

  parts['_rels/.rels'] =
    `${DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`

  // Styles take the relationship id after the last sheet, so the sheet ids stay
  // in sheet order and the workbook's first r:id is still the first tab.
  const styleRel = `rId${sheets.length + 1}`
  parts['xl/_rels/workbook.xml.rels'] =
    `${DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    (spec.styles ? `<Relationship Id="${styleRel}" Type="${REL_NS}/styles" Target="styles.xml"/>` : '') +
    '</Relationships>'

  const definedNames = spec.definedNames?.length
    ? `<definedNames>${spec.definedNames.map(d => `<definedName name="${escapeXml(d.name)}">${escapeXml(d.refersTo)}</definedName>`).join('')}</definedNames>`
    : ''
  parts['xl/workbook.xml'] =
    `${DECL}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">` +
    `<sheets>${sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
    definedNames +
    '<calcPr calcId="124519" fullCalcOnLoad="1"/></workbook>'

  sheets.forEach((s, i) => { parts[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s) })
  if (spec.styles) parts['xl/styles.xml'] = `${DECL}${spec.styles}`
  return zipStored(parts)
}

// The smallest workbook Excel will still open: one sheet, every cell an inline
// string, no styles to keep consistent.
export function buildWorkbook(rows: string[][], sheetName = 'Sheet1'): Uint8Array {
  return buildStyledWorkbook({ sheets: [{ name: sheetName, rows: rows.map(cells => ({ cells })) }] })
}
