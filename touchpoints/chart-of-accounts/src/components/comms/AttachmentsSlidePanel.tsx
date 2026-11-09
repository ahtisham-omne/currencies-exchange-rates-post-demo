/* Ported from the financial reporting module's comms cluster
   (components/fr/comms/AttachmentsSlidePanel.tsx).

   Every file on the thread, grouped by the message that carried it, with the
   source's whole toolbar: file-type filter, sort, and a three-way density with
   card sizing under it. Colour references are the source's own primitives,
   declared under `[data-comms]` in index.css. */
import { useMemo, useState } from 'react'
import {
  AlignJustify, ArrowDownNarrowWide, Check, ChevronDown, Download, Filter,
  LayoutGrid, List, Paperclip,
} from 'lucide-react'
import { useStore } from '../../store'
import type { AttachmentFileRef } from '../../lib/comms'
import { Button, Menu, MenuItem, SlideOver } from '../ui'
import { AttachmentCard, getFileInfo, inferFileType } from './AttachmentCard'

/** A file as the panel lists it: the thread's own attachment, plus who sent it
 *  and when, which is what the group headers are built from. */
export interface ThreadAttachment extends AttachmentFileRef {
  from: string
  date: string
  messageId?: string
  messagePreview?: string
  subject?: string
}

const HIGHLIGHT_DURATION_MS = 2500

type Density = 'card' | 'comfort' | 'condensed'
type CardSize = 'small' | 'medium' | 'large'
type SortOrder = 'latest' | 'oldest'

/** Convert a free-form size string ("2.7 MB", "88 KB", "1.2 GB") into a byte
 *  total so the toolbar can display "13 files · 42.0 MB". */
function parseSizeToBytes(input: string): number {
  const m = /^([\d.]+)\s*([KMG]?B)$/i.exec(input.trim())
  if (!m) return 0
  const n = parseFloat(m[1])
  const unit = m[2].toUpperCase()
  const mult = unit === 'GB' ? 1024 ** 3 : unit === 'MB' ? 1024 ** 2 : unit === 'KB' ? 1024 : 1
  return n * mult
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/* Card size to grid minmax and gutter. Mirrors the Small / Medium / Large pills
   the source shares with the item library. */
const sizeConfig: Record<CardSize, { minmax: string; gap: number }> = {
  small: { minmax: '180px', gap: 10 },
  medium: { minmax: '220px', gap: 12 },
  large: { minmax: '280px', gap: 14 },
}

export function AttachmentsSlidePanel({
  open,
  onClose,
  attachments,
  onHighlightMessage,
}: {
  open: boolean
  onClose: () => void
  attachments: ThreadAttachment[]
  onHighlightMessage?: (messageId: string | null) => void
}) {
  const pushToast = useStore(s => s.pushToast)
  const [density, setDensity] = useState<Density>('card')
  const [cardSize, setCardSize] = useState<CardSize>('small')
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest')

  // The file-type set across every attachment, which feeds the filter menu.
  const availableTypes = useMemo(() => {
    const set = new Set<string>()
    attachments.forEach(a => set.add(inferFileType(a.name)))
    return Array.from(set).sort()
  }, [attachments])

  // Sort is a proxy: the items carry a formatted stamp rather than an ISO date,
  // and the thread they came from is already chronological.
  const filtered = useMemo(() => {
    let list = attachments
    if (fileTypeFilter !== 'all') {
      list = list.filter(a => inferFileType(a.name) === fileTypeFilter)
    }
    // The thread is oldest first, so Latest is the one that reverses it.
    if (sortOrder === 'latest') list = [...list].reverse()
    return list
  }, [attachments, fileTypeFilter, sortOrder])

  const totalBytes = useMemo(
    () => filtered.reduce((acc, a) => acc + parseSizeToBytes(a.size), 0),
    [filtered],
  )

  // Grouped by sender and date, so the reader still sees the per-message
  // grouping with the files sitting inside it.
  const grouped = useMemo(() => {
    const out: {
      key: string
      from: string
      date: string
      messageId?: string
      messagePreview?: string
      subject?: string
      files: ThreadAttachment[]
    }[] = []
    filtered.forEach(a => {
      const key = `${a.from}::${a.date}`
      const existing = out.find(g => g.key === key)
      if (existing) {
        existing.files.push(a)
      } else {
        out.push({
          key,
          from: a.from,
          date: a.date,
          messageId: a.messageId,
          messagePreview: a.messagePreview,
          subject: a.subject,
          files: [a],
        })
      }
    })
    return out
  }, [filtered])

  const goToMessage = (messageId: string) => {
    onClose()
    onHighlightMessage?.(messageId)
    window.setTimeout(() => onHighlightMessage?.(null), HIGHLIGHT_DURATION_MS)
    window.setTimeout(() => {
      const el =
        document.querySelector(`[data-message-id="${messageId}"]`) ??
        document.getElementById(`message-${messageId}`)
      ;(el as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Attachments"
      subtitle={`${attachments.length} file${attachments.length === 1 ? '' : 's'} on this thread`}
      widthClass="max-w-[520px]"
      footer={attachments.length > 0 ? (
        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="w-3.5 h-3.5" />}
          title="Download all attachments"
          onClick={() => {
            /* The files are fixtures, so each downloads as a stub under its own
               name - the way a chat attachment does - rather than a toast
               announcing a download that never starts. */
            for (const a of filtered) {
              const url = URL.createObjectURL(new Blob([`Mock attachment: ${a.name}\nGenerated by Omne.`], { type: 'application/octet-stream' }))
              const link = document.createElement('a')
              link.href = url
              link.download = a.name
              document.body.appendChild(link)
              link.click()
              link.remove()
              URL.revokeObjectURL(url)
            }
            pushToast(`Downloaded ${filtered.length} attachment${filtered.length === 1 ? '' : 's'}`, 'success')
          }}
        >
          Download all
        </Button>
      ) : undefined}
    >
      <div className="flex flex-col">
        {/* The count summary on the left, the controls on the right. */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-5 py-2.5 border-b border-border bg-white">
          <span className="text-[11.5px] text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'file' : 'files'}
            {totalBytes > 0 && <> · {formatBytes(totalBytes)}</>}
          </span>
          <div className="flex items-center gap-1.5">
            <Menu
              align="right"
              trigger={
                <span
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border bg-white text-[11.5px] text-foreground hover:bg-muted/40 cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <Filter className="w-3 h-3 text-muted-foreground" />
                  {fileTypeFilter === 'all' ? 'All file types' : fileTypeFilter}
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </span>
              }
            >
              {close => (
                <>
                  <MenuItem
                    active={fileTypeFilter === 'all'}
                    onClick={() => { setFileTypeFilter('all'); close() }}
                  >
                    <span className="flex-1 flex items-center justify-between gap-6">
                      All file types
                      {fileTypeFilter === 'all' && <Check className="w-3 h-3 text-[var(--color-sky-500)]" />}
                    </span>
                  </MenuItem>
                  {availableTypes.map(t => (
                    <MenuItem
                      key={t}
                      active={fileTypeFilter === t}
                      onClick={() => { setFileTypeFilter(t); close() }}
                    >
                      <span className="flex-1 flex items-center justify-between gap-6">
                        {t}
                        {fileTypeFilter === t && <Check className="w-3 h-3 text-[var(--color-sky-500)]" />}
                      </span>
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>

            <Menu
              align="right"
              trigger={
                <span
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border bg-white text-[11.5px] text-foreground hover:bg-muted/40 cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <ArrowDownNarrowWide className="w-3 h-3 text-muted-foreground" />
                  {sortOrder === 'latest' ? 'Latest' : 'Oldest'}
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </span>
              }
            >
              {close => (
                <>
                  {(['latest', 'oldest'] as SortOrder[]).map(o => (
                    <MenuItem
                      key={o}
                      active={sortOrder === o}
                      onClick={() => { setSortOrder(o); close() }}
                    >
                      <span className="flex-1 flex items-center justify-between gap-6 capitalize">
                        {o}
                        {sortOrder === o && <Check className="w-3 h-3 text-[var(--color-sky-500)]" />}
                      </span>
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>

            {/* Flush, and hand-rolled rows: each one is two lines of copy, and
                the card-size row underneath is a control rather than an item. */}
            <Menu
              align="right"
              flush
              trigger={
                <span
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border bg-white text-[11.5px] text-foreground hover:bg-muted/40 cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {density === 'card'
                    ? <LayoutGrid className="w-3 h-3 text-muted-foreground" />
                    : density === 'comfort'
                      ? <AlignJustify className="w-3 h-3 text-muted-foreground" />
                      : <List className="w-3 h-3 text-muted-foreground" />}
                  {density === 'card' ? 'Card' : density === 'comfort' ? 'Comfort' : 'Condensed'}
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </span>
              }
            >
              {close => (
                <div className="w-[220px] p-1.5">
                  <button
                    type="button"
                    onClick={() => { setDensity('condensed'); close() }}
                    className="flex items-center justify-between w-full px-2 py-1.5 rounded text-[12px] hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-2">
                      <List className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-left">
                        <span className="block font-medium">Condensed</span>
                        <span className="block text-[10.5px] text-muted-foreground">Compact list view</span>
                      </span>
                    </span>
                    {density === 'condensed' && <Check className="w-3 h-3 text-[var(--color-sky-500)]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDensity('comfort'); close() }}
                    className="flex items-center justify-between w-full px-2 py-1.5 rounded text-[12px] hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-2">
                      <AlignJustify className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-left">
                        <span className="block font-medium">Comfort</span>
                        <span className="block text-[10.5px] text-muted-foreground">Spacious list view</span>
                      </span>
                    </span>
                    {density === 'comfort' && <Check className="w-3 h-3 text-[var(--color-sky-500)]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDensity('card'); close() }}
                    className="flex items-center justify-between w-full px-2 py-1.5 rounded text-[12px] hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-2">
                      <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-left">
                        <span className="block font-medium">Card</span>
                        <span className="block text-[10.5px] text-muted-foreground">Sized card grid</span>
                      </span>
                    </span>
                    {density === 'card' && <Check className="w-3 h-3 text-[var(--color-sky-500)]" />}
                  </button>
                  {density === 'card' && (
                    <>
                      <div className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Card size</div>
                      <div className="flex items-center gap-1 px-1 pb-1">
                        {(['large', 'medium', 'small'] as CardSize[]).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setCardSize(s)}
                            className={`flex-1 h-7 rounded-md text-[11.5px] capitalize transition-colors ${
                              cardSize === s
                                ? 'bg-[var(--color-sky-500)] text-white'
                                : 'bg-muted/40 text-foreground hover:bg-muted/60'
                            }`}
                            style={{ fontWeight: 500 }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </Menu>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">
          {grouped.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <Paperclip style={{ width: '20px', height: '20px', color: 'var(--color-grey-300)', margin: '0 auto 8px' }} />
              <div style={{ fontSize: '12px', color: 'var(--color-grey-400)', lineHeight: '1.4' }}>
                {fileTypeFilter === 'all' ? 'No attachments added yet' : `No ${fileTypeFilter} files in this thread`}
              </div>
            </div>
          ) : (
            grouped.map(group => (
              <div
                key={group.key}
                onMouseEnter={() => group.messageId && onHighlightMessage?.(group.messageId)}
                onMouseLeave={() => onHighlightMessage?.(null)}
                className="rounded-lg border border-border bg-white overflow-hidden"
              >
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-muted-foreground">
                      From: <span className="text-foreground font-semibold">{group.from}</span>
                    </p>
                    {(group.subject || group.messagePreview) && (
                      <p className="text-[12px] font-medium text-muted-foreground mt-0.5 truncate">
                        Subject: <span className="text-foreground font-semibold">{group.subject ?? group.messagePreview}</span>
                      </p>
                    )}
                  </div>
                  {/* The source hung this off each card's kebab menu, which this
                      module's AttachmentCard does not carry. One per group says
                      the same thing: a group is one message. */}
                  {group.messageId && (
                    <button
                      type="button"
                      onClick={() => group.messageId && goToMessage(group.messageId)}
                      className="shrink-0 text-[11px] font-medium text-[var(--color-sky-500)] hover:underline"
                    >
                      Go to message
                    </button>
                  )}
                </div>

                {density === 'card' ? (
                  <div
                    className="grid p-3"
                    style={{
                      gridTemplateColumns: `repeat(auto-fill, minmax(${sizeConfig[cardSize].minmax}, 1fr))`,
                      columnGap: sizeConfig[cardSize].gap,
                      rowGap: sizeConfig[cardSize].gap + 2,
                    }}
                  >
                    {group.files.map((file, i) => (
                      <AttachmentCard
                        key={`${file.name}-${i}`}
                        file={{
                          name: file.name,
                          size: file.size,
                          uploadedBy: group.from,
                          date: group.date,
                          extracts: file.extracts,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {group.files.map((file, i) => {
                      const info = getFileInfo(file.name)
                      const padY = density === 'comfort' ? 'py-2.5' : 'py-1.5'
                      return (
                        <li
                          key={`${file.name}-${i}`}
                          className={`flex items-center gap-3 px-3 ${padY} hover:bg-muted/30 transition-colors cursor-pointer`}
                          onClick={() => {
                            if (!group.messageId) return
                            onClose()
                            onHighlightMessage?.(group.messageId)
                            window.setTimeout(() => onHighlightMessage?.(null), HIGHLIGHT_DURATION_MS)
                          }}
                        >
                          <span
                            className="shrink-0 inline-flex items-center justify-center"
                            style={{ width: 28, height: 28, borderRadius: 6, background: info.bg }}
                          >
                            <info.Icon size={14} style={{ color: info.color }} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] font-medium text-foreground truncate" title={file.name}>{file.name}</p>
                            {density === 'comfort' && (
                              <p className="text-[10.5px] text-muted-foreground truncate">{file.size} · {group.date}</p>
                            )}
                          </div>
                          {density === 'condensed' && (
                            <span className="text-[10.5px] text-muted-foreground whitespace-nowrap">{file.size}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </SlideOver>
  )
}
