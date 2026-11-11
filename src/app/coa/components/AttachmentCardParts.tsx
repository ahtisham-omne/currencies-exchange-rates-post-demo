/* Card internals for the kit's AttachmentsTab, ported from Vendor Invoicing's
   attachment card (touchpoints/vendor-invoicing › invoice-details/AttachmentsTab:
   `DocumentThumb` and `SourcePill`). The thumbnail draws believable content
   rather than a faded watermark icon - a mock page for PDFs and documents, a mock
   sheet for workbooks, the picture itself for an image picked this session - and
   the pill under it names the record the file is filed against. Layout and
   values are Vendor Invoicing's; the mock copy is this module's own. */
import { FileText, Image as ImageIcon, Paperclip } from 'lucide-react'

const SHEET_GRID = '#E2E8F0'
const SHEET_COLS = 7
const SHEET_ROWS = 14
/* The page fades out toward the card body, as a thumbnail of a longer page would. */
const PAGE_FADE = 'linear-gradient(to bottom, rgba(248,250,252,0) 0%, rgba(241,245,249,0.9) 80%)'

type SheetCell = { text: string; bold?: boolean; size?: number; color?: string }

const DOC_SECTIONS = [
  { heading: '1. Overview', body: 'This document describes the contents and intent of the attached file. It is provided for in-app preview only. Download the original for the canonical version with full formatting, embedded objects, and revision history.' },
  { heading: '2. Scope', body: 'The attached material covers rates, rounding, revaluation and settlement for this record. It supersedes all prior revisions.' },
]

const SHEET_BODY: Record<number, Record<number, SheetCell>> = {
  6: { 1: { text: 'Overview', bold: true, size: 5.5, color: '#0A77FF' } },
  8: { 1: { text: 'Q1', bold: true, size: 5.5 }, 2: { text: 'Opening rate', size: 5, color: '#475569' }, 3: { text: 'Reviewed', size: 5, color: '#475569' } },
  10: { 1: { text: 'Q2', bold: true, size: 5.5 }, 2: { text: 'Average rate', size: 5, color: '#475569' }, 3: { text: 'Approved', size: 5, color: '#475569' } },
  12: { 1: { text: 'Q3', bold: true, size: 5.5 }, 2: { text: 'Closing rate', size: 5, color: '#475569' }, 3: { text: 'Posted', size: 5, color: '#475569' } },
}

export function AttachmentThumb({ type, name, bg, color, recordLabel, imageUrl }: {
  type: string
  name: string
  /** The type's tint, behind the icon-only treatments. */
  bg: string
  color: string
  /** The record the file is filed against, written into the mock page. */
  recordLabel?: string
  /** Object URL of an image picked this session: drawn as itself. */
  imageUrl?: string
}) {
  if (imageUrl) return <img src={imageUrl} alt={name} className="w-full h-full object-cover block" />

  const title = name.replace(/\.[^.]+$/, '') || 'Document'

  if (type === 'xlsx') {
    const cells: Record<number, Record<number, SheetCell>> = {
      1: { 1: { text: title, bold: true, size: 8, color: '#1E293B' } },
      2: { 1: { text: recordLabel ?? 'Currencies & exchange rates', size: 5.5, color: '#94A3B8' } },
      ...SHEET_BODY,
    }
    return (
      <div className="w-full h-full bg-white relative overflow-hidden">
        <table className="w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 14 }} />
            {Array.from({ length: SHEET_COLS }).map((_, i) => <col key={i} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ background: '#F1F5F9', border: `1px solid ${SHEET_GRID}`, height: 8 }} />
              {Array.from({ length: SHEET_COLS }).map((_, i) => (
                <th key={i} style={{ background: '#F1F5F9', border: `1px solid ${SHEET_GRID}`, color: '#64748B', fontSize: 5, fontWeight: 600, height: 8, padding: 0, textAlign: 'center' }}>
                  {String.fromCharCode(65 + i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SHEET_ROWS }).map((_, r) => {
              const rowNum = r + 1
              const banded = rowNum === 6
              return (
                <tr key={r}>
                  <td style={{ background: '#F1F5F9', border: `1px solid ${SHEET_GRID}`, color: '#64748B', fontSize: 5, fontWeight: 500, textAlign: 'center', padding: 0, height: 10 }}>{rowNum}</td>
                  {Array.from({ length: SHEET_COLS }).map((_, c) => {
                    const cell = cells[rowNum]?.[c]
                    return (
                      <td key={c} style={{ border: `1px solid ${SHEET_GRID}`, background: banded ? '#F0F7FF' : 'white', padding: '0 3px', height: 10, fontSize: cell?.size ?? 5, fontWeight: cell?.bold ? 700 : 400, color: cell?.color ?? '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cell?.text ?? ''}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="absolute left-0 right-0 bottom-0 h-[40%] pointer-events-none" style={{ background: PAGE_FADE }} />
      </div>
    )
  }

  if (type === 'pdf' || type === 'doc') {
    return (
      <div className="w-full h-full bg-white relative overflow-hidden text-fg" style={{ padding: '10px 12px 0 12px' }}>
        <div className="whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 7.5, fontWeight: 700, lineHeight: 1.35, marginBottom: 3 }}>
          {title}
        </div>
        <div className="overflow-hidden text-slate-400" style={{ fontSize: 5.5, lineHeight: 1.5, marginBottom: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {recordLabel ? `Filed against ${recordLabel}.` : 'Internal document for treasury operations.'} Preview rendering, download the original for the canonical version.
        </div>
        {DOC_SECTIONS.map(s => (
          <div key={s.heading} style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 6, fontWeight: 600, lineHeight: 1.35, marginBottom: 2 }}>{s.heading}</div>
            <div className="text-slate-600" style={{ fontSize: 5.5, lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{s.body}</div>
          </div>
        ))}
        <div className="absolute left-0 right-0 bottom-0 h-[40%] pointer-events-none" style={{ background: PAGE_FADE }} />
      </div>
    )
  }

  const Icon = type === 'img' ? ImageIcon : FileText
  return (
    <div className="flex items-center justify-center w-full h-full" style={{ background: bg }}>
      <Icon className={type === 'img' ? 'w-8 h-8' : 'w-7 h-7'} style={{ color, opacity: 0.5 }} />
    </div>
  )
}

/** Vendor Invoicing's 'record' source pill: which record the file belongs to. */
export function RecordPill({ label, title }: { label: string; title?: string }) {
  return (
    <span
      className="inline-flex items-center gap-[3px] max-w-full px-1.5 rounded-full border truncate text-10 leading-normal bg-blue-50 border-blue-200 text-blue-700"
      style={{ paddingTop: 1, paddingBottom: 1, fontWeight: 500 }}
      title={title ?? label}
    >
      <Paperclip className="w-2.5 h-2.5 shrink-0" />
      {label}
    </span>
  )
}
