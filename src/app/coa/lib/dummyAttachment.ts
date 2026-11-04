// Ported from chart-of-accounts-v2.1/src/lib/dummyAttachment.ts; adapted: workbooks built with SheetJS (xlsx, already a dependency) instead of ExcelJS, recordKind is any noun, letterhead names this module.
/* Real bytes behind the demo attachments.

   Every attachment in the module is metadata - a name, a size, an uploader -
   with nothing underneath it, so Preview and Download could only ever raise a
   toast. This builds a plausible document on demand from that metadata, in the
   format the file name promises: a PDF opens in the browser's viewer, a
   workbook opens in Excel, an image renders. The content is sample content and
   says so, but the letterhead, the record it is filed against and the uploader
   are the real ones off the record being looked at.

   jsPDF and SheetJS (xlsx) are reached through `await import(...)`, the same way
   `accountsExport.ts` reaches them, so neither lands in the bundle until a
   reader actually opens a document. */

import type { AttachmentFile } from '../components/AttachmentsTab'
import { cleanName } from '../components/Avatar'

/** What the record a document hangs on calls itself, e.g. "11130 Operating - Chase Bank". */
export interface DocumentContext {
  recordLabel: string
  /** What the record is, as a sentence names it: "currency", "exchange rate". */
  recordKind: string
}

function titleOf(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
}

function mimeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (ext === 'rtf') return 'application/rtf'
  if (ext === 'png') return 'image/png'
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg'
  return 'text/plain'
}

function longDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/* The lines every format carries, so a reader who opens the PDF and the
   workbook of the same folder sees the document agree with the card. */
function facts(file: AttachmentFile, ctx: DocumentContext): [string, string][] {
  return [
    ['Document', titleOf(file.name)],
    [ctx.recordKind.charAt(0).toUpperCase() + ctx.recordKind.slice(1), ctx.recordLabel],
    ['Filed on', longDate(file.date)],
    ['Filed by', cleanName(file.uploadedBy)],
    ['Reference', String(file.id)],
  ]
}

async function buildPdf(file: AttachmentFile, ctx: DocumentContext): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const left = 56
  let y = 64

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(10, 119, 255)
  doc.text('OMNE', left, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 130, 145)
  doc.text('Currencies & Exchange Rates', left + 46, y)

  y += 34
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(15, 23, 42)
  doc.text(titleOf(file.name), left, y)

  y += 22
  doc.setDrawColor(226, 232, 240)
  doc.line(left, y, 556, y)

  y += 28
  doc.setFontSize(10)
  for (const [label, value] of facts(file, ctx)) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 130, 145)
    doc.text(label, left, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(value, left + 130, y)
    y += 20
  }

  y += 16
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(10)
  doc.text(
    doc.splitTextToSize(
      `This document is sample content generated for the Omne demo environment. It stands in for the ${titleOf(file.name)} a finance team would have filed against this ${ctx.recordKind}, so the Attachments tab can be opened and read end to end without a document store behind it.`,
      500,
    ),
    left,
    y,
  )

  return doc.output('blob')
}

async function buildWorkbook(file: AttachmentFile, ctx: DocumentContext): Promise<Blob> {
  const XLSX = await import('xlsx')
  const rows: (string | number)[][] = [
    [titleOf(file.name), ''],
    [],
    ...facts(file, ctx),
    [],
    ['Sample content generated for the Omne demo environment.'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 24 }, { wch: 46 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, titleOf(file.name).slice(0, 28) || 'Sheet1')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([buf], { type: mimeFor(file.name) })
}

function buildRtf(file: AttachmentFile, ctx: DocumentContext): Blob {
  const esc = (s: string) => s.replace(/([\\{}])/g, '\\$1')
  const lines = facts(file, ctx).map(([l, v]) => `\\b ${esc(l)}:\\b0  ${esc(v)}\\par`)
  const rtf = [
    '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Helvetica;}}',
    '\\fs18 OMNE  Currencies & Exchange Rates\\par\\par',
    `\\fs32\\b ${esc(titleOf(file.name))}\\b0\\fs20\\par\\par`,
    ...lines,
    '\\par',
    `\\i Sample content generated for the Omne demo environment. It stands in for the ${esc(titleOf(file.name))} filed against this ${ctx.recordKind}.\\i0\\par`,
    '}',
  ].join('\n')
  return new Blob([rtf], { type: mimeFor(file.name) })
}

async function buildImage(file: AttachmentFile, ctx: DocumentContext): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 800
  const g = canvas.getContext('2d')!
  g.fillStyle = '#F8FAFC'
  g.fillRect(0, 0, 1200, 800)
  g.strokeStyle = '#E2E8F0'
  g.lineWidth = 2
  g.strokeRect(40, 40, 1120, 720)

  g.fillStyle = '#0A77FF'
  g.font = 'bold 22px Helvetica, Arial, sans-serif'
  g.fillText('OMNE', 88, 116)
  g.fillStyle = '#788291'
  g.font = '22px Helvetica, Arial, sans-serif'
  g.fillText('Currencies & Exchange Rates', 190, 116)

  g.fillStyle = '#0F172A'
  g.font = 'bold 44px Helvetica, Arial, sans-serif'
  g.fillText(titleOf(file.name), 88, 200)

  let y = 280
  g.font = '24px Helvetica, Arial, sans-serif'
  for (const [label, value] of facts(file, ctx)) {
    g.fillStyle = '#788291'
    g.fillText(label, 88, y)
    g.fillStyle = '#0F172A'
    g.fillText(value, 400, y)
    y += 46
  }

  g.fillStyle = '#94A3B8'
  g.font = 'italic 20px Helvetica, Arial, sans-serif'
  g.fillText('Sample content generated for the Omne demo environment.', 88, 700)

  return new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'))
}

/** Bytes for one attachment, in whatever format its name promises. */
export async function buildDummyAttachment(file: AttachmentFile, ctx: DocumentContext): Promise<Blob> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return buildPdf(file, ctx)
  if (ext === 'xlsx') return buildWorkbook(file, ctx)
  if (['png', 'jpg', 'jpeg'].includes(ext)) return buildImage(file, ctx)
  if (ext === 'rtf') return buildRtf(file, ctx)
  return new Blob([facts(file, ctx).map(([l, v]) => `${l}: ${v}`).join('\n')], { type: 'text/plain' })
}
