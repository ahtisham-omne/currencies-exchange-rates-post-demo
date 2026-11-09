/* Writing the export file. Ported from User Access Control's
   `src/app/lib/users-export.ts`, which is the module this flow is modelled on.

   The three formats used to be two. "Excel Spreadsheet" sat in the picker beside
   PDF and CSV, and picking it wrote `text/csv` to a file named `.csv` - the same
   bytes CSV had already produced, under a label promising a workbook. A format
   picker that offers three things and writes two is the defect this replaces.

   Each writer now owns its own serialization: CSV is built here, the workbook
   comes from ExcelJS, and the PDF from jsPDF + autotable. The two libraries are
   imported dynamically so neither is in the bundle until a reader picks that
   format - they are large, and most exports are CSV. */

// Both libraries are only reachable through `await import(...)` below, so a
// reader who never opens the export modal never downloads them.

/** A column as the export sees it: a heading and how to read one row. */
export interface ExportColumn<Row> {
  label: string
  /** Display text. Every format falls back to this when it has no richer type. */
  text: (row: Row) => string
  /** When set, the workbook writes a real number so Excel can total the column. */
  number?: (row: Row) => number | null
  /** What a page prints, where it differs from `text`. A figure is written bare
      for a spreadsheet to read, and as money for a person to. */
  display?: (row: Row) => string
  /** When set, the workbook writes a real date under this number format. */
  date?: (row: Row) => Date | null
  numFmt?: string
}

/**
 * `stem` names the file, e.g. "Chart_of_Accounts". The date is appended so a
 * reader exporting twice in a week does not overwrite the first file.
 */
export function exportFilename(stem: string, ext: 'pdf' | 'xlsx' | 'csv'): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${stem}_Export_${d.getFullYear()}-${m}-${day}.${ext}`
}

function triggerBlobDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoked late so Safari has a chance to start the download first.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ── CSV ─────────────────────────────────────────────────────────────────── */

/** RFC 4180: quote only when the cell needs it, and double any internal quote. */
function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function exportCsv<Row>(rows: Row[], cols: ExportColumn<Row>[], stem: string): void {
  const header = cols.map(c => escapeCsvCell(c.label)).join(',')
  const body = rows
    .map(row => cols.map(c => escapeCsvCell(c.text(row))).join(','))
    .join('\r\n')
  // A UTF-8 BOM, so Excel on Windows decodes a currency symbol or an accented
  // account name instead of showing mojibake.
  const bom = new Uint8Array([0xef, 0xbb, 0xbf])
  const blob = new Blob([bom, `${header}\r\n${body}`], { type: 'text/csv;charset=utf-8' })
  triggerBlobDownload(exportFilename(stem, 'csv'), blob)
}

/* ── PDF (jsPDF + autotable) ─────────────────────────────────────────────── */

// Shared by the table and by the measuring pass that sizes the figure columns,
// which has to ask jsPDF for a width under the font the cells will be drawn in.
const CELL_FONT_SIZE = 8
const CELL_PADDING = 5

export async function exportPdf<Row>(
  rows: Row[],
  cols: ExportColumn<Row>[],
  stem: string,
  title: string,
  /** Which day each figure column is struck at, printed under the title. */
  dateLine?: string,
): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = (autoTableModule as { default: typeof autoTableModule.default }).default

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const dateStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  const body = rows.map(row => cols.map(c => (c.display ?? c.text)(row)))

  /* A figure and a date are each one indivisible token: an amount broken across
     two lines has stopped being an amount, and cutting it short is worse still.
     Both are narrow, so the width they need costs the prose columns little, and
     it is measured off the values rather than the heading - a heading can wrap,
     and "Number range start" claiming the width of its own title would take
     four times what any number under it needs.

     Every column, figures included, is then floored at the longest word of its
     own heading. A squeeze wraps a heading, which is fine, but below that floor
     it wraps inside the words: "GL account no." over a column sized to five
     characters comes out as "GL ac / count / no.".

     Nothing is cut short in either case. That was `ellipsize`, under which a
     24-column export cut 1,585 cells, the heading row among them, and there is
     no reading around a column called "Statem...". */
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(CELL_FONT_SIZE)
  const cellWidth = (text: string) => doc.getTextWidth(text) + 2 * CELL_PADDING + 2
  const columnStyles: Record<number, { cellWidth?: number; minCellWidth: number; halign?: 'right' }> = {}
  let floors = 0
  cols.forEach((c, i) => {
    let widestValue = 0
    for (const row of body) widestValue = Math.max(widestValue, cellWidth(row[i]))
    const longestWord = Math.max(...c.label.split(' ').map(cellWidth))
    floors += longestWord
    columnStyles[i] = c.number || c.date
      ? { cellWidth: Math.max(widestValue, longestWord), minCellWidth: longestWord, ...(c.number ? { halign: 'right' } : {}) }
      : { minCellWidth: longestWord }
  })

  /* Whether the columns continue on a further page rather than being squeezed
     onto this one. Squeezing wraps, so nothing is lost either way, and one
     unbroken table is easier to read than a set of column groups - but only
     down to the floors above. Asked to go below them the table stops wrapping
     and starts breaking words, so that is where it splits instead. */
  const printable = pageWidth - 64
  const splitColumns = floors > printable

  autoTable(doc, {
    head: [cols.map(c => c.label)],
    body,
    startY: 56,
    margin: { left: 32, right: 32, top: 56, bottom: 36 },
    styles: { font: 'helvetica', fontSize: CELL_FONT_SIZE, cellPadding: CELL_PADDING, overflow: 'linebreak', valign: 'middle' },
    columnStyles,
    // Column 0 rides on every group, so a reader always knows whose row it is -
    // it is the one column an export cannot drop.
    horizontalPageBreak: splitColumns,
    horizontalPageBreakRepeat: 0,
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      lineWidth: 0.5,
      lineColor: [226, 232, 240],
    },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    bodyStyles: { textColor: [30, 41, 59], lineWidth: 0.25, lineColor: [241, 245, 249] },
    showHead: 'everyPage',
    didDrawPage: () => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text(title, 32, 32)
      doc.text(`Exported ${dateStr}`, pageWidth - 32, 32, { align: 'right' })
      // Its own line under the title, in the table's gutter above the header row.
      if (dateLine) {
        doc.setFontSize(8)
        doc.text(dateLine, 32, 44)
      }
    },
  })

  /* Stamped after the table is laid out rather than during it. `didDrawPage`
     runs as each page is produced, so the total it could read was only ever the
     pages so far - which is how a six-page file came out saying "Page 1 of 1",
     "Page 2 of 2", and on to "Page 6 of 6". */
  const pageCount = doc.getNumberOfPages()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.text(`Page ${page} of ${pageCount}`, pageWidth / 2, pageHeight - 18, { align: 'center' })
  }

  doc.save(exportFilename(stem, 'pdf'))
}

/* ── Excel (ExcelJS) ─────────────────────────────────────────────────────── */

export async function exportExcel<Row>(
  rows: Row[],
  cols: ExportColumn<Row>[],
  stem: string,
  sheetName: string,
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default ?? (await import('exceljs'))

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] })

  sheet.columns = cols.map((c, i) => ({
    header: c.label,
    key: String(i),
    width: Math.min(Math.max(c.label.length + 4, 14), 32),
  }))

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FF1E40AF' } }
  headerRow.alignment = { vertical: 'middle' }
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF93C5FD' } } }
  })
  headerRow.height = 22

  // Widen each column to its widest cell as the rows go in, rather than in a
  // second pass over the data.
  const widths = cols.map(c => c.label.length + 4)

  for (const row of rows) {
    const cells: Record<string, string | number | Date | null> = {}
    cols.forEach((c, i) => {
      // A number stays a number and a date stays a date, so the column can be
      // totalled or sorted in the sheet instead of being text that looks right.
      const value: string | number | Date =
        c.number ? c.number(row) ?? '' : c.date ? c.date(row) ?? '' : c.text(row)
      cells[String(i)] = value
      const len = value instanceof Date ? 18 : String(value ?? '').length
      if (len > widths[i]) widths[i] = len
    })
    const added = sheet.addRow(cells)
    cols.forEach((c, i) => {
      const cell = added.getCell(i + 1)
      if (c.date && cell.value instanceof Date) cell.numFmt = c.numFmt ?? 'yyyy-mm-dd'
      // Still a number, so the column totals; shown to the cent.
      else if (c.number && c.numFmt && typeof cell.value === 'number') cell.numFmt = c.numFmt
    })
  }

  // Capped, so one long description does not push a column off the screen.
  sheet.columns.forEach((col, i) => { col.width = Math.min(Math.max(widths[i] + 2, 12), 48) })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  triggerBlobDownload(exportFilename(stem, 'xlsx'), blob)
}
