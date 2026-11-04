// Currency Library exports: the columns and file formats the library has always
// written (CSV with a UTF-8 BOM and RFC 4180 quoting, an XLSX sheet "Currencies",
// an A4 landscape PDF), now fed the rows the page is showing and toasting
// through the kit's toast store. The writers load on demand.
import type { Currency } from '../../data/currencies'
import { pushToast } from '../../coa/lib/toast'
import { DOC_TYPES, fmtAmount, type LinkedDoc } from './model'

export type ExportFormat = 'csv' | 'xlsx' | 'pdf'
export const FORMAT_LABEL: Record<ExportFormat, string> = { csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' }

const HEADERS = ['Code', 'Name', 'ISO Numeric Code', 'Symbol', 'Decimal Places', 'Country', 'Status']
const COL_WIDTHS = [8, 32, 14, 8, 14, 28, 10]

const rowOf = (c: Currency) => [c.code, c.name, c.numericCode, c.symbol, String(c.decimalPlaces), c.country, c.status]

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
function writeCsv(headers: string[], data: string[][], filename: string) {
  const text = [headers.map(esc).join(','), ...data.map(r => r.map(esc).join(','))].join('\n')
  download(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), filename)
}

const stampNow = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${p(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function writeTable(fmt: ExportFormat, opts: { headers: string[]; data: string[][]; widths: number[]; sheet: string; title: string; subtitle: string; baseName: string }) {
  const { headers, data, widths, sheet, title, subtitle, baseName } = opts
  if (fmt === 'csv') { writeCsv(headers, data, `${baseName}.csv`); return }
  if (fmt === 'xlsx') {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
    ws['!cols'] = widths.map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheet)
    XLSX.writeFile(wb, `${baseName}.xlsx`)
    return
  }
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(14)
  doc.text(title, 40, 40)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(subtitle, 40, 56)
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 72,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [10, 119, 255], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  })
  doc.save(`${baseName}.pdf`)
}

/** Writes the currencies given (the filtered list, or the selection) and toasts the result. */
export async function exportCurrencies(rows: Currency[], fmt: ExportFormat, scope: 'filtered' | 'selected') {
  const n = rows.length
  const noun = `${n.toLocaleString('en-US')} ${n === 1 ? 'currency' : 'currencies'}`
  try {
    await writeTable(fmt, {
      headers: HEADERS,
      data: rows.map(rowOf),
      widths: COL_WIDTHS,
      sheet: 'Currencies',
      title: 'Currency Library',
      subtitle: `${noun} · Exported ${stampNow()}`,
      baseName: scope === 'selected' ? 'currencies_selected' : 'currencies',
    })
    if (scope === 'selected') pushToast(`${noun} exported as ${FORMAT_LABEL[fmt]}`)
    else pushToast(`${FORMAT_LABEL[fmt]} exported`, 'success', `${noun}, as the list is filtered now.`)
  } catch {
    pushToast('Could not export', 'danger', `The ${FORMAT_LABEL[fmt]} file could not be written. Try again.`)
  }
}

/** A currency's linked transactions as CSV, from its detail page. */
export function exportLinkedDocs(code: string, decimals: number, docs: LinkedDoc[]) {
  const label = (k: LinkedDoc['type']) => DOC_TYPES.find(t => t.key === k)?.label ?? k
  writeCsv(
    ['Number', 'Type', 'Vendor / customer', 'Status', 'Date', `Amount (${code})`],
    docs.map(d => [d.number, label(d.type), d.party, d.status, d.date, fmtAmount(d.amount, decimals)]),
    `${code.toLowerCase()}_linked_transactions.csv`,
  )
  pushToast('CSV exported', 'success', `${docs.length} linked ${docs.length === 1 ? 'transaction' : 'transactions'} in ${code}.`)
}
