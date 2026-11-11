// Ported from chart-of-accounts-v2.1/src/components/AttachmentsTab.tsx; adapted: toasts from the kit store, plus RecordAttachmentsTab (files kept per record key in lib/recordStore).
/**
 * AttachmentsTab - ported from the Partners module
 * (test-partner-management-vendors/src/app/components/vendors/AttachmentsTab.tsx),
 * which stakeholders approved as the standard for tab content density.
 *
 * The three-tier density selector (condensed / comfort / card) plus the card-size
 * sub-menu under the "card" tier is the reference pattern; keep ATTACH_DENSITY_CONFIG
 * and the dropdown structure in step with Partners rather than diverging.
 *
 * Substitutions made for this repo: Menu/MenuItem instead of the radix dropdown,
 * the store's pushToast instead of sonner, and this module's font/colour tokens.
 *
 * The card itself is Vendor Invoicing's (touchpoints/vendor-invoicing ›
 * invoice-details/AttachmentsTab): a mock document thumbnail with the type badge
 * bottom-left, a pill naming the record, then name, date and time, and
 * size · uploader. Its parts live in AttachmentCardParts.
 */
import { useEffect, useMemo, useRef, useState, type ElementType } from 'react'
import {
  Search, X, Upload, LayoutGrid, List, AlignJustify, MoreVertical,
  ChevronDown, Check, FileText, FileSpreadsheet, Image as ImageIcon, Paperclip,
  Download, Eye, Trash2,
} from 'lucide-react'
import { Button, ConfirmModal, EmptyState, Marked, Menu, MenuItem } from './ui'
import { cleanName } from './Avatar'
import { searchMatcher } from '../lib/tableSearch'
import { pushToast } from '../lib/toast'
import { useRecordAttachments } from '../lib/recordStore'
import { cn } from '../lib/utils'
import { buildDummyAttachment, type DocumentContext } from '../lib/dummyAttachment'
import { AttachmentThumb, RecordPill } from './AttachmentCardParts'

/* Bytes for files picked in this session, held here rather than on the record so
   nothing tries to put a Blob through the store's serializer. A reload drops
   them and the file falls back to generated sample content, which is the same
   place every seeded attachment starts. */
const uploadedBlobs = new Map<AttachmentFile['id'], File>()

/* An image picked this session draws as itself on its card, as in Vendor
   Invoicing. One object URL per file, made the first time a card asks and kept
   for the session alongside the bytes it points at. */
const uploadedImageUrls = new Map<AttachmentFile['id'], string>()
const RENDERABLE_IMAGE = /^image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml)$/
function uploadedImageUrl(id: AttachmentFile['id']): string | undefined {
  const blob = uploadedBlobs.get(id)
  if (!blob || !RENDERABLE_IMAGE.test(blob.type)) return undefined
  let url = uploadedImageUrls.get(id)
  if (!url) {
    url = URL.createObjectURL(blob)
    uploadedImageUrls.set(id, url)
  }
  return url
}

export type AttachmentFileType = 'pdf' | 'doc' | 'img' | 'xlsx' | 'other'
export interface AttachmentFile {
  id: number | string
  name: string
  size: string
  date: string
  type: AttachmentFileType | string
  uploadedBy: string
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/* "Nov 4, 2025, 8:51 PM" when the stamp carries a time, "Nov 4, 2025" when it is
   a bare date: Vendor Invoicing's date-and-time line. Spelled out by hand so no
   locale renders it with "at" or a narrow space before PM, and a bare YYYY-MM-DD
   reads as that calendar day rather than as UTC midnight. */
function formatWhen(dateStr: string): string {
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (bare) {
    const month = MONTH_SHORT[Number(bare[2]) - 1]
    return month ? `${month} ${Number(bare[3])}, ${bare[1]}` : dateStr
  }
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  const day = `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  if (!/\d:\d{2}/.test(dateStr)) return day
  const h = d.getHours()
  return `${day}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function getFileTypeInfo(type: string, name: string): { color: string; bg: string; label: string; Icon: ElementType } {
  const ext = name.split('.').pop()?.toUpperCase() || ''
  switch (type) {
    case 'pdf': return { color: 'hsl(var(--destructive))', bg: '#FEF2F2', label: 'PDF', Icon: FileText }
    case 'doc': return { color: '#2563EB', bg: '#EFF6FF', label: 'DOC', Icon: FileText }
    case 'img': return { color: 'hsl(var(--violet))', bg: '#F5F3FF', label: ext, Icon: ImageIcon }
    case 'xlsx': return { color: 'hsl(var(--success))', bg: '#ECFDF5', label: 'XLSX', Icon: FileSpreadsheet }
    default: return { color: '#64748B', bg: '#F8FAFC', label: ext, Icon: FileText }
  }
}

type AttachDensity = 'condensed' | 'comfort' | 'card'

const ATTACH_DENSITY_CONFIG: { key: AttachDensity; label: string; description: string; Icon: ElementType }[] = [
  { key: 'condensed', label: 'Condensed', description: 'Compact list view', Icon: AlignJustify },
  { key: 'comfort', label: 'Comfort', description: 'Relaxed list view', Icon: List },
  { key: 'card', label: 'Card', description: 'Thumbnail grid', Icon: LayoutGrid },
]

const CARD_SIZE_LABEL: Record<'small' | 'medium' | 'large', string> = { small: 'Small', medium: 'Medium', large: 'Large' }

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileToAttachment(f: File, uploadedBy: string): AttachmentFile {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  let type: AttachmentFileType = 'other'
  if (ext === 'pdf') type = 'pdf'
  else if (['doc', 'docx', 'rtf', 'txt'].includes(ext)) type = 'doc'
  else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) type = 'img'
  else if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) type = 'xlsx'
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: f.name,
    size: formatBytes(f.size),
    date: new Date().toISOString(),
    type,
    uploadedBy,
  }
}

/** Sum the displayed size strings (e.g. "1.2 MB", "340 KB") into one label. */
function aggregateSize(items: AttachmentFile[]): string {
  let totalKb = 0
  for (const f of items) {
    const m = f.size.match(/^([\d.]+)\s*(B|KB|MB|GB)$/i)
    if (!m) continue
    const n = parseFloat(m[1])
    const unit = m[2].toUpperCase()
    totalKb += unit === 'GB' ? n * 1024 * 1024 : unit === 'MB' ? n * 1024 : unit === 'B' ? n / 1024 : n
  }
  if (totalKb < 1) return '0 KB'
  if (totalKb < 1024) return `${Math.round(totalKb)} KB`
  return `${(totalKb / 1024).toFixed(1)} MB`
}

/**
 * AttachmentDropzone - Partners' create-flow attachment pattern
 * (CreatePartnerModal's `AttachmentsSection`): an accent-tile heading with a
 * count, a click-or-drag drop zone, and a removable list of staged files.
 *
 * This is the pattern for *collecting* files on a record that doesn't exist yet.
 * AttachmentsTab above is the pattern for *managing* files on one that does; a
 * create modal has nothing to search, sort or re-density yet, so its toolbar
 * would be chrome over an empty list.
 */
export function AttachmentDropzone({ files, onChange, hint, required, error }: {
  files: AttachmentFile[]
  onChange: (files: AttachmentFile[]) => void
  hint?: string
  /* A file is normally evidence for a record that stands without it, so the
     heading says "optional" and nothing gates on it. Set this where the document
     *is* the justification - a prior period adjustment to retained earnings - and
     the heading and the drop zone say so instead. */
  required?: boolean
  error?: string
}) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const add = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return
    onChange([...files, ...Array.from(picked).map(f => fileToAttachment(f, 'You'))])
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Paperclip className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-13 text-fg" style={{ fontWeight: 600 }}>Attachments</span>
        <span className={cn('text-11', required ? 'text-danger-600' : 'text-fg-subtle')} style={{ fontWeight: 500 }}>
          {required ? 'Required' : 'Optional'}
        </span>
        {files.length > 0 && (
          <span className="text-10 text-slate-500 bg-bg-muted px-1.5 py-0.5 rounded-full" style={{ fontWeight: 500 }}>{files.length}</span>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); add(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={cn('rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-all',
          dragActive ? 'border-primary bg-accent/30'
            : error ? 'border-danger-500 bg-white hover:bg-[#F8FAFC]'
              : 'border-border bg-white hover:border-slate-300 hover:bg-[#F8FAFC]')}
      >
        <input ref={inputRef} type="file" multiple className="hidden"
          onChange={(e) => { add(e.target.files); e.target.value = '' }} />
        <div className="flex flex-col items-center gap-2">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
            dragActive ? 'bg-[#DBEAFE] text-primary' : 'bg-bg-muted text-slate-400')}>
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-fg" style={{ fontWeight: 500 }}>
              <span className="text-primary">Click to upload</span><span className="hidden sm:inline"> or drag and drop</span>
            </p>
            <p className="text-11 text-slate-400 mt-0.5">{hint ?? 'PDF, DOC, XLS, PNG, JPG up to 10MB'}</p>
          </div>
        </div>
      </div>

      {error && <p className="mt-1.5 text-2xs leading-snug text-danger-600">{error}</p>}

      {files.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {files.map(file => {
            const info = getFileTypeInfo(file.type, file.name)
            return (
              <div key={file.id} className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-border bg-white hover:bg-[#F8FAFC] transition-colors group">
                {/* The tab's coloured type tile rather than Partners' emoji, so a
                    file reads the same here as it will once the entry is posted. */}
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: info.bg }}>
                  <info.Icon className="w-3.5 h-3.5" style={{ color: info.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg truncate" style={{ fontWeight: 500 }}>{file.name}</p>
                  <p className="text-11 text-slate-400">{file.size}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChange(files.filter(f => f.id !== file.id)) }}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AttachmentsTab({
  files,
  embedded = false,
  initialDensity,
  totalSizeLabel,
  onUpload,
  onFilesChange,
  uploadedByName = 'You',
  document: docContext,
}: {
  files?: AttachmentFile[]
  /** Compact layout for modals: drops the card chrome + min-height floor. */
  embedded?: boolean
  initialDensity?: AttachDensity
  totalSizeLabel?: string
  onUpload?: () => void
  onFilesChange?: (files: AttachmentFile[]) => void
  uploadedByName?: string
  /** Names the record in generated documents. Without it they read generically. */
  document?: DocumentContext
} = {}) {
  const [items, setItems] = useState<AttachmentFile[]>(files ?? [])
  useEffect(() => { if (files) setItems(files) }, [files])

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [search, setSearch] = useState('')
  const [density, setDensity] = useState<AttachDensity>(initialDensity ?? (embedded ? 'comfort' : 'card'))
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>('medium')
  // Delete asks first, as Vendor Invoicing's attachments do.
  const [confirmDelete, setConfirmDelete] = useState<AttachmentFile | null>(null)

  const filtered = useMemo(() => {
    /* Every field a file shows, as it prints - name, type, size, date and who
       uploaded it - with the one matcher the marks are drawn with. Mahad,
       2026-10-05: *"the search should have everything in it."* */
    if (!search.trim()) return items
    const found = searchMatcher(search)
    return items.filter(f => [f.name, getFileTypeInfo(f.type, f.name).label, f.size, formatWhen(f.date), f.uploadedBy].some(found))
  }, [search, items])

  const handleUploadClick = () => {
    if (onUpload) { onUpload(); return }
    fileInputRef.current?.click()
  }

  const handleFilesPicked = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return
    const incoming = Array.from(picked).map(f => {
      const att = fileToAttachment(f, uploadedByName)
      uploadedBlobs.set(att.id, f)
      return att
    })
    setItems(prev => {
      const next = [...incoming, ...prev]
      onFilesChange?.(next)
      return next
    })
    pushToast(`${incoming.length} ${incoming.length === 1 ? 'file' : 'files'} uploaded`, 'success')
  }

  const handleDelete = (id: AttachmentFile['id']) => {
    setItems(prev => {
      const next = prev.filter(f => f.id !== id)
      onFilesChange?.(next)
      return next
    })
    pushToast('Attachment deleted', 'success')
  }

  const isCondensed = density === 'condensed'
  const isComfort = density === 'comfort'
  const isCard = density === 'card'
  const cur = ATTACH_DENSITY_CONFIG.find(d => d.key === density) ?? ATTACH_DENSITY_CONFIG[0]

  const wrapperClass = embedded
    ? 'flex flex-col flex-1 min-h-0'
    : 'bg-white border border-border rounded-xl overflow-hidden flex flex-col flex-1 min-h-[calc(100vh-260px)]'
  const sizeLabel = totalSizeLabel ?? aggregateSize(items)

  /* A file picked in this session opens its own bytes; everything else is demo
     data, so the document is built on demand from what the card already states. */
  const bytesFor = async (file: AttachmentFile): Promise<Blob> =>
    uploadedBlobs.get(file.id)
    ?? buildDummyAttachment(file, docContext ?? { recordLabel: 'this record', recordKind: 'record' })

  const handlePreview = async (file: AttachmentFile) => {
    // Opened before the await so the click still counts as a user gesture and
    // the tab is not treated as a pop-up.
    const tab = window.open('', '_blank')
    const url = URL.createObjectURL(await bytesFor(file))
    if (tab) tab.location.href = url
    else pushToast('Allow pop-ups to preview attachments', 'info')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const handleDownload = async (file: AttachmentFile) => {
    const url = URL.createObjectURL(await bytesFor(file))
    const a = window.document.createElement('a')
    a.href = url
    a.download = file.name
    window.document.body.appendChild(a)
    a.click()
    window.document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  /* The pill on every card: the record the files belong to, by its code - the
     first word of its label ("USD United States Dollar" → USD, "USD/PKR
     corporate rate" → USD/PKR). Without a document context there is no record
     to name, so no pill. */
  const recordLabel = docContext?.recordLabel.trim()
  const recordCode = recordLabel ? recordLabel.split(/\s+/)[0] : undefined

  /* Per-row actions. Shared by all three densities so Preview/Download/Delete
     never drift apart between them. The card's trigger is Vendor Invoicing's
     22px square, and stays up while its menu is open. */
  const RowMenu = ({ file, iconCls, card = false }: { file: AttachmentFile; iconCls: string; card?: boolean }) => (
    <Menu align="right" trigger={(open) => (
      <button className={cn(
        card
          ? 'flex items-center justify-center w-[22px] h-[22px] rounded hover:bg-sky-50 text-slate-500 transition-all'
          : 'p-1 rounded hover:bg-bg-subtle text-fg-subtle/50 hover:text-fg transition-colors',
        card && open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
        <MoreVertical className={iconCls} />
      </button>
    )}>
      {(close) => (
        <>
          <MenuItem icon={<Eye size={14} />} onClick={() => { close(); void handlePreview(file) }}>Preview</MenuItem>
          <MenuItem icon={<Download size={14} />} onClick={() => { close(); void handleDownload(file) }}>Download</MenuItem>
          <MenuItem icon={<Trash2 size={14} />} danger onClick={() => { close(); setConfirmDelete(file) }}>Delete Attachment</MenuItem>
        </>
      )}
    </Menu>
  )

  return (
    <div className={wrapperClass}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { handleFilesPicked(e.target.files); e.target.value = '' }}
      />
      <ConfirmModal
        open={!!confirmDelete}
        tone="danger"
        icon={<Trash2 size={26} className="text-danger-600" />}
        badge="Delete Attachment"
        title="Delete this attachment?"
        description={confirmDelete ? `${confirmDelete.name} is removed from the record. This cannot be undone.` : ''}
        confirmLabel="Delete Attachment"
        dismissLabel="Keep Attachment"
        onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete.id); setConfirmDelete(null) }}
        onDismiss={() => setConfirmDelete(null)}
      />

      {/* Toolbar */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-muted shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle/50 pointer-events-none" />
          <input
            placeholder="Search attachments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full pl-9 pr-8 text-sm bg-white rounded-lg border border-border shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-bg-muted text-fg-subtle hover:text-fg transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-sm tabular-nums ml-auto" style={{ fontWeight: 500 }}>
          <span className="text-fg">{filtered.length}</span>
          <span className="text-fg-muted/70"> {filtered.length === 1 ? 'file' : 'files'} · {sizeLabel}</span>
        </span>

        {/* Density dropdown, with the card-size sub-row under the Card tier. */}
        <Menu align="right" trigger={
          <button className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-fg shadow-xs hover:bg-bg-subtle transition-colors">
            <cur.Icon className="w-[18px] h-[18px] text-fg-subtle" />
            <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>{cur.label}</span>
            <ChevronDown className="w-3.5 h-3.5 text-fg-subtle/60" />
          </button>
        }>
          {(close) => (
            <div className="w-[230px] p-1.5 -my-1">
              {ATTACH_DENSITY_CONFIG.map(opt => (
                <button
                  key={opt.key}
                  // Choosing Card keeps the menu open so the size row it reveals
                  // is immediately reachable; the list tiers close on pick.
                  onClick={() => { setDensity(opt.key); if (opt.key !== 'card') close() }}
                  className="w-full flex items-center gap-3 py-2.5 px-3 rounded-md text-left hover:bg-bg-subtle transition-colors"
                >
                  <opt.Icon className="w-5 h-5 text-fg-subtle shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-fg" style={{ fontWeight: 500 }}>{opt.label}</div>
                    <div className="text-xs text-fg-muted">{opt.description}</div>
                  </div>
                  {density === opt.key && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              ))}
              {isCard && (
                <>
                  <div className="mx-2 my-1.5 border-t border-muted" />
                  <div className="px-3 py-1.5">
                    <p className="text-10 text-slate-400 mb-2" style={{ fontWeight: 600 }}>Card Size</p>
                    <div className="flex items-center gap-1.5">
                      {(['large', 'medium', 'small'] as const).map(size => (
                        <button key={size} onClick={() => setCardSize(size)}
                          className={cn('flex-1 py-1.5 rounded-md text-11 text-center transition-all',
                            cardSize === size ? 'bg-primary text-white shadow-sm' : 'bg-bg-muted text-slate-500 hover:bg-border')}
                          style={{ fontWeight: cardSize === size ? 600 : 500 }}>
                          {CARD_SIZE_LABEL[size]}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </Menu>

        <button
          onClick={handleUploadClick}
          className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-lg bg-primary text-white shadow-xs hover:bg-[#0862D0] transition-colors text-sm"
          style={{ fontWeight: 500 }}
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isCard && filtered.length > 0 && (
          <div className={cn('grid gap-4',
            cardSize === 'large' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
            cardSize === 'small' ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' :
            'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5')}>
            {filtered.map(file => {
              const info = getFileTypeInfo(file.type, file.name)
              const previewH = cardSize === 'large' ? 'h-[160px]' : cardSize === 'small' ? 'h-[100px]' : 'h-[130px]'
              const small = cardSize === 'small'
              const imageUrl = uploadedImageUrl(file.id)
              const uploader = cleanName(file.uploadedBy)
              return (
                <div key={file.id} className="group relative flex flex-col min-w-0 rounded-xl bg-white border border-border shadow-xs hover:border-blue-200 hover:shadow-md transition-[border-color,box-shadow] duration-150">
                  {/* Thumbnail: the content, not a watermark icon. Type badge bottom-left. */}
                  <div className={cn('relative shrink-0 w-full overflow-hidden rounded-t-[11px]', previewH)} style={{ backgroundColor: info.bg }}>
                    <AttachmentThumb type={file.type} name={file.name} bg={info.bg} color={info.color} recordLabel={recordLabel} imageUrl={imageUrl} />
                    <span className="absolute bottom-1.5 left-1.5 z-[2] px-1 rounded bg-white border border-border text-[9px] tracking-wide"
                      style={{ paddingTop: 1, paddingBottom: 1, fontWeight: 600, color: info.color, boxShadow: imageUrl ? '0 1px 2px rgba(0,0,0,0.2)' : undefined }}>
                      <Marked text={info.label} q={search} />
                    </span>
                  </div>
                  {/* Body: record pill, file name, date and time, size · uploader. */}
                  <div className={cn('flex items-start w-full gap-1', small ? 'px-2 pt-1.5 pb-2' : 'px-2.5 pt-2 pb-2.5')}>
                    <div className="flex flex-col flex-1 min-w-0 gap-1">
                      {recordCode && !small && (
                        <div className="flex flex-wrap items-center gap-1">
                          <RecordPill label={recordCode} title={`Filed against ${recordLabel}`} />
                        </div>
                      )}
                      <p className={cn('text-fg truncate leading-snug', small ? 'text-11' : 'text-xs')} style={{ fontWeight: 500 }} title={file.name}>
                        <Marked text={file.name} q={search} />
                      </p>
                      <div className="flex flex-col" style={{ gap: 1 }}>
                        <p className={cn('text-slate-400 truncate leading-snug', small ? 'text-10' : 'text-11')}>
                          <Marked text={formatWhen(file.date)} q={search} />
                        </p>
                        <p className={cn('text-slate-400 truncate leading-snug', small ? 'text-10' : 'text-11')} title={`${file.size} · ${uploader}`}>
                          <Marked text={file.size} q={search} /> · <Marked text={uploader} q={search} />
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 mt-px"><RowMenu file={file} iconCls="w-3.5 h-3.5" card /></div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {(isCondensed || isComfort) && filtered.length > 0 && (
          <div className="border border-border bg-white rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className={cn('bg-slate-50 border-b border-muted', isCondensed ? '[&>th]:py-2' : '[&>th]:py-2.5')}>
                  <th className="text-left text-11 text-slate-400 px-4" style={{ fontWeight: 600 }}>File Name</th>
                  <th className="text-left text-11 text-slate-400 px-4 w-[80px]" style={{ fontWeight: 600 }}>Size</th>
                  <th className="text-left text-11 text-slate-400 px-4 hidden md:table-cell" style={{ fontWeight: 600 }}>Date</th>
                  <th className="text-left text-11 text-slate-400 px-4 hidden md:table-cell" style={{ fontWeight: 600 }}>Uploaded By</th>
                  <th className={isCondensed ? 'w-[36px]' : 'w-[40px]'} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(file => {
                  const info = getFileTypeInfo(file.type, file.name)
                  return (
                    <tr key={file.id} className={cn('border-b border-muted last:border-b-0 hover:bg-slate-50 transition-colors group',
                      isCondensed ? '[&>td]:py-1.5' : '[&>td]:py-3')}>
                      <td className="px-4">
                        <div className={cn('flex items-center', isCondensed ? 'gap-2.5' : 'gap-3')}>
                          <div className={cn('flex items-center justify-center shrink-0', isCondensed ? 'w-7 h-7 rounded-md' : 'w-10 h-10 rounded-lg')} style={{ backgroundColor: info.bg }}>
                            <info.Icon className={isCondensed ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]'} style={{ color: info.color }} />
                          </div>
                          {isCondensed ? (
                            <span className="text-xs text-slate-700 truncate" style={{ fontWeight: 500 }}><Marked text={file.name} q={search} /></span>
                          ) : (
                            <div className="min-w-0">
                              <span className="text-xs text-slate-700 truncate block" style={{ fontWeight: 500 }}><Marked text={file.name} q={search} /></span>
                              <span className="text-11 text-slate-400"><Marked text={file.size} q={search} /></span>
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Condensed sets its cells a size down (11px), as Vendor Invoicing does. */}
                      <td className="px-4"><span className={cn('text-slate-500', isCondensed ? 'text-11' : 'text-xs')}><Marked text={file.size} q={search} /></span></td>
                      <td className="px-4 hidden md:table-cell"><span className={cn('text-slate-500 whitespace-nowrap', isCondensed ? 'text-11' : 'text-xs')}><Marked text={formatWhen(file.date)} q={search} /></span></td>
                      <td className="px-4 hidden md:table-cell"><span className={cn('text-slate-500', isCondensed ? 'text-11' : 'text-xs')}><Marked text={file.uploadedBy} q={search} /></span></td>
                      <td className="px-2"><RowMenu file={file} iconCls={isCondensed ? 'w-3.5 h-3.5' : 'w-4 h-4'} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length === 0 && (
          <EmptyState
            icon={items.length === 0 ? <Paperclip size={20} /> : <Search size={20} />}
            title={items.length === 0 ? 'No attachments yet' : 'No attachments match your search'}
            description={items.length === 0 ? undefined : 'Nothing uploaded here carries that in its name.'}
            action={items.length === 0 ? (
              <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={handleUploadClick}>
                Upload Your First File
              </Button>
            ) : undefined}
          />
        )}
      </div>
    </div>
  )
}

/** The Attachments tab for one record, with its files kept in the kit's
 *  in-memory record store under `recordKey` (e.g. `recordKey('currency', 'USD')`).
 *  `seed` supplies the files a record opens with, read once. */
export function RecordAttachmentsTab({ recordKey, seed, document, uploadedByName = 'Ahtisham Ahmad (You)' }: {
  recordKey: string
  seed?: () => AttachmentFile[]
  document?: DocumentContext
  uploadedByName?: string
}) {
  const [files, setFiles] = useRecordAttachments(recordKey, seed)
  return (
    <div className="flex flex-col">
      <AttachmentsTab key={recordKey} files={files} onFilesChange={setFiles} uploadedByName={uploadedByName} document={document} />
    </div>
  )
}

/** How many files a record holds, for its tab badge. */
export function useRecordAttachmentCount(recordKey: string, seed?: () => AttachmentFile[]) {
  return useRecordAttachments(recordKey, seed)[0].length
}
