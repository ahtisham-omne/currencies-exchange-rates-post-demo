// Ported from chart-of-accounts-v2.1/src/components/comms/AttachmentCard.tsx; adapted: the preview copy names the rates and the Currency Library instead of the ledger and the chart.
/* Ported from the financial reporting module (components/fr/comms/AttachmentCard.tsx).

   The tile an attached file renders as inside a message. A document type draws
   a miniature of its own first page rather than a generic file glyph, which is
   the whole point: the reader can tell two attachments apart without opening
   either. */
import { useState } from 'react'
import {
  Box, DraftingCompass, Eye, FileArchive, FileImage, FileSpreadsheet, FileText,
  Music, Video, X,
} from 'lucide-react'
import type { AttachmentExtractRef } from '../../lib/comms'
import { Modal } from '../ui'
import { DetailTable } from './AutomatedEmailTemplate'

const LAVENDER_BG = 'var(--color-indigo-50)'
const INDIGO = 'var(--color-indigo-500)'

/* Per-type colour and glyph: one lavender preview surface for most types, with
   pops of colour for PDF, audio and document previews. */
const TYPE_INFO: Record<string, { color: string; bg: string; Icon: typeof FileText }> = {
  PDF: { color: 'var(--color-red-600)', bg: 'var(--color-red-100)', Icon: FileText },
  DOC: { color: 'var(--color-blue-accent-600)', bg: 'var(--color-blue-50)', Icon: FileText },
  DOCX: { color: 'var(--color-blue-accent-600)', bg: 'var(--color-blue-50)', Icon: FileText },
  TXT: { color: 'var(--color-blue-accent-600)', bg: 'var(--color-blue-50)', Icon: FileText },
  RTF: { color: 'var(--color-blue-accent-600)', bg: 'var(--color-blue-50)', Icon: FileText },
  XLSX: { color: 'var(--color-emerald-600)', bg: 'var(--color-emerald-50)', Icon: FileSpreadsheet },
  CSV: { color: 'var(--color-emerald-600)', bg: 'var(--color-emerald-50)', Icon: FileSpreadsheet },
  PNG: { color: 'var(--color-violet-600)', bg: 'var(--color-violet-50)', Icon: FileImage },
  JPG: { color: 'var(--color-violet-600)', bg: 'var(--color-violet-50)', Icon: FileImage },
  JPEG: { color: 'var(--color-violet-600)', bg: 'var(--color-violet-50)', Icon: FileImage },
  GIF: { color: 'var(--color-violet-600)', bg: 'var(--color-violet-50)', Icon: FileImage },
  SVG: { color: 'var(--color-violet-600)', bg: 'var(--color-violet-50)', Icon: FileImage },
  ZIP: { color: 'var(--color-blue-accent-600)', bg: 'var(--color-blue-50)', Icon: FileArchive },
  RAR: { color: 'var(--color-blue-accent-600)', bg: 'var(--color-blue-50)', Icon: FileArchive },
  MP3: { color: 'var(--color-orange-600)', bg: 'var(--color-orange-50)', Icon: Music },
  WAV: { color: 'var(--color-orange-600)', bg: 'var(--color-orange-50)', Icon: Music },
  MP4: { color: INDIGO, bg: LAVENDER_BG, Icon: Video },
  MOV: { color: INDIGO, bg: LAVENDER_BG, Icon: Video },
  STL: { color: INDIGO, bg: LAVENDER_BG, Icon: Box },
  OBJ: { color: INDIGO, bg: LAVENDER_BG, Icon: Box },
  DXF: { color: 'var(--color-violet-600)', bg: LAVENDER_BG, Icon: DraftingCompass },
  DWG: { color: 'var(--color-blue-accent-600)', bg: LAVENDER_BG, Icon: Box },
}

const AUDIO_TYPES = new Set(['MP3', 'WAV', 'OGG', 'M4A', 'AAC', 'FLAC'])
/** Document types that get an inset text-snippet preview. */
const DOC_TEXT_PREVIEW_TYPES = new Set(['PDF', 'TXT', 'DOC', 'DOCX', 'RTF'])

/** Pull the type token from a filename: "Trial_Balance.pdf" becomes "PDF". */
export function inferFileType(name: string): string {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toUpperCase() : ''
  return ext || 'FILE'
}

export function getFileInfo(name: string) {
  const type = inferFileType(name)
  const info = TYPE_INFO[type] ?? { color: 'var(--color-slate-500)', bg: 'var(--color-slate-50)', Icon: FileText }
  return { type, ...info }
}

export interface AttachmentCardFile {
  name: string
  size: string
  uploadedBy?: string
  date?: string
  extracts?: AttachmentExtractRef[]
}

export function AttachmentCard({
  file,
  onRemove,
}: {
  file: AttachmentCardFile
  /** Present only in the composer, where the tile is a staged file the reader
   *  can take back off rather than something already sent. */
  onRemove?: () => void
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const { type, color, bg, Icon } = getFileInfo(file.name)
  const isAudio = AUDIO_TYPES.has(type)
  const isDocTextPreview = DOC_TEXT_PREVIEW_TYPES.has(type)
  const previewSurfaceBg = isAudio ? 'var(--color-orange-50)' : isDocTextPreview ? 'var(--color-white)' : bg
  const metaLine = [file.size, file.uploadedBy].filter(Boolean).join(' · ')

  // A staged tile's only affordance is the remove button; every other tile
  // opens its preview when the body is clicked.
  const bodyClickable = !onRemove

  return (
    <>
      <div className="group rounded-xl border border-[var(--color-slate-200)] bg-white overflow-hidden hover:shadow-md hover:border-[var(--color-slate-300)] transition-all">
        <div
          className={`relative h-[120px] overflow-hidden${bodyClickable ? ' cursor-pointer' : ''}`}
          style={{ backgroundColor: previewSurfaceBg }}
          onClick={bodyClickable ? () => setPreviewOpen(true) : undefined}
        >
          {isDocTextPreview ? (
            /* A white page filling the preview area with structured document
               content, so the bottom trails off behind the type badge the way a
               real first page does. */
            <div className="absolute inset-0 overflow-hidden px-2.5 pt-2 pb-5">
              <p
                className="text-[8px] truncate"
                style={{ fontWeight: 700, paddingRight: 40, color: 'var(--color-slate-900)' }}
                title={file.name.replace(/\.[^/.]+$/, '')}
              >
                {file.name.replace(/\.[^/.]+$/, '')}
              </p>
              <p className="text-[6px] leading-[1.45] mt-1" style={{ color: 'var(--color-slate-600)' }}>
                {file.extracts?.length
                  ? `${file.extracts.map(r => r.name).join(', ')} · rendered from the rate history`
                  : 'Generated from the Currency Library. Internal document.'}
              </p>
              <p className="text-[6.5px] mt-1.5" style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>
                1. Overview
              </p>
              <p className="text-[6px] leading-[1.45] mt-0.5 line-clamp-3" style={{ color: 'var(--color-slate-600)' }}>
                {file.extracts?.length
                  ? file.extracts.map(r => `${r.name}: ${r.from} to ${r.to}`).join(' · ')
                  : 'This document describes the contents and intent of the attached file. It is provided for in-app preview only; please download the original to access the canonical…'}
              </p>
              <p className="text-[6.5px] mt-1" style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>
                2. Scope
              </p>
              <p className="text-[6px] leading-[1.45] mt-0.5 line-clamp-2" style={{ color: 'var(--color-slate-600)' }}>
                The attached material covers the currencies and rates named above, their changes and their closing rates for the stated period. It supersedes all prior revisions.
              </p>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                <Icon className="w-6 h-6" style={{ color }} />
              </span>
            </div>
          )}
          {/* Type badge. A translucent white chip with a hairline border so it
              never obscures the faux document text underneath. In staged mode
              the remove button owns the top-right, so the badge moves left. */}
          <span
            className={`absolute top-1.5 ${onRemove ? 'left-1.5' : 'right-1.5'} text-[9px] tracking-wider`}
            style={{
              fontWeight: 700,
              color,
              backgroundColor: 'rgba(255,255,255,0.88)',
              border: '1px solid var(--color-slate-200)',
              padding: '1px 6px',
              borderRadius: 4,
              textTransform: 'uppercase',
            }}
          >
            {type}
          </span>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Remove attachment"
              aria-label={`Remove ${file.name}`}
              className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-white/90 border border-[var(--color-slate-200)] text-[var(--color-slate-500)] shadow-sm hover:text-[var(--color-red-600)] hover:border-[var(--color-red-300)] transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div
          className={`px-2.5 pt-2 pb-2.5${bodyClickable ? ' cursor-pointer' : ''}`}
          onClick={bodyClickable ? () => setPreviewOpen(true) : undefined}
        >
          <div className="flex items-start justify-between gap-1 mb-1">
            <span
              className="text-[11px] truncate leading-tight"
              title={file.name}
              style={{ fontWeight: 500, color: 'var(--color-slate-900)' }}
            >
              {file.name}
            </span>
            {bodyClickable && (
              <Eye
                className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--color-slate-400)' }}
                aria-hidden
              />
            )}
          </div>
          {file.date && (
            <p className="text-[10px] leading-tight truncate" style={{ color: 'var(--color-slate-400)' }}>{file.date}</p>
          )}
          {metaLine && (
            <p className="text-[10px] leading-tight truncate" style={{ color: 'var(--color-slate-400)' }} title={metaLine}>{metaLine}</p>
          )}
        </div>
      </div>

      <AttachmentPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} file={file} />
    </>
  )
}

/** The full-size preview. A file that names its extracts renders those as the
 *  document's own content, so the file, the mail's detail table and the ledger
 *  all describe the same figures. */
function AttachmentPreviewModal({
  open,
  onClose,
  file,
}: {
  open: boolean
  onClose: () => void
  file: AttachmentCardFile
}) {
  const { type } = getFileInfo(file.name)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={file.name}
      subtitle={[type, file.size].filter(Boolean).join(' · ')}
      width="lg"
    >
      <div className="rounded-lg border border-[var(--color-gray-200)] bg-white p-8 mx-auto" style={{ maxWidth: 620 }}>
        <p className="text-[15px]" style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>
          {file.name.replace(/\.[^/.]+$/, '')}
        </p>
        <p className="text-[11.5px] mt-1" style={{ color: 'var(--color-slate-500)' }}>
          {file.extracts?.length
            ? `${file.extracts.map(r => r.name).join(', ')} · rendered from the rate history`
            : 'Generated from the Currency Library. Internal document.'}
        </p>
        {file.extracts?.length ? (
          <div className="mt-5">
            <DetailTable
              caption="What this covers"
              rows={file.extracts.map(r => ({
                label: r.name,
                value: [`${r.from} to ${r.to}`, r.entity].filter(Boolean).join(' · '),
              }))}
            />
          </div>
        ) : null}
        <p className="text-[12.5px] mt-5" style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>1. Overview</p>
        <p className="text-[12.5px] mt-1" style={{ lineHeight: 1.6, color: 'var(--color-slate-600)' }}>
          This document describes the contents and intent of the attached file. It is provided for in-app preview only; download the original to access the canonical copy.
        </p>
        <p className="text-[12.5px] mt-4" style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>2. Scope</p>
        <p className="text-[12.5px] mt-1" style={{ lineHeight: 1.6, color: 'var(--color-slate-600)' }}>
          The attached material covers the currencies and rates named above, their changes and their closing rates for the stated period. It supersedes all prior revisions.
        </p>
      </div>
    </Modal>
  )
}
