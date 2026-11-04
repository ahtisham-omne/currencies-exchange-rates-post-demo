// Exchange Rates screens: CSV / Excel / PDF export of whatever rows the caller
// passes (the list exports the current tab as filtered, archived rows left out;
// the pair page exports its rate history). The xlsx and jsPDF bundles load on
// first use.
import { pushToast } from '../../coa/lib/toast'
import { fmtDateTime } from '../../coa/lib/utils'

export type ExportFormat = 'csv' | 'xlsx' | 'pdf'
export const FORMAT_LABEL: Record<ExportFormat, string> = { csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' }

export interface ExportSpec {
  /** File name without the extension. */
  fileBase: string
  /** Excel sheet name. */
  sheetName: string
  /** PDF title. */
  title: string
  headers: string[]
  rows: (string | number)[][]
  /** Plural noun for the PDF sub-line and the toast ("rates"). */
  noun: string
  /** Singular noun ("rate"). */
  one: string
  /** Column widths for Excel, in characters. */
  widths?: number[]
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportRows(spec: ExportSpec, fmt: ExportFormat): Promise<void> {
  const { fileBase, sheetName, title, headers, rows, noun, one, widths } = spec
  if (!rows.length) {
    pushToast('Nothing to export', 'info', `No ${noun} are listed with the current filters.`)
    return
  }
  const cells = rows.map(r => r.map(v => String(v)))
  try {
    if (fmt === 'csv') {
      const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
      const text = [headers.map(esc).join(','), ...cells.map(r => r.map(esc).join(','))].join('\n')
      download(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), `${fileBase}.csv`)
    } else if (fmt === 'xlsx') {
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.aoa_to_sheet([headers, ...cells])
      if (widths) ws['!cols'] = widths.map(wch => ({ wch }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
      XLSX.writeFile(wb, `${fileBase}.xlsx`)
    } else {
      const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      doc.setFontSize(14)
      doc.text(title, 40, 40)
      doc.setFontSize(10)
      doc.setTextColor(120)
      doc.text(`${rows.length} ${noun} · Exported ${fmtDateTime(new Date().toISOString())}`, 40, 56)
      autoTable(doc, {
        head: [headers],
        body: cells,
        startY: 72,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [10, 119, 255], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 40, right: 40 },
      })
      doc.save(`${fileBase}.pdf`)
    }
    pushToast(`${FORMAT_LABEL[fmt]} exported`, 'success', `${rows.length} ${rows.length === 1 ? one : noun}, as listed.`)
  } catch {
    pushToast(`Could not export ${FORMAT_LABEL[fmt]}`, 'danger')
  }
}
