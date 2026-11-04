/* Ported from the financial reporting module. The rows live inline in that
   module's RecordCommsTab, so this file is the row markup lifted out of it
   rather than a component it also has.

   The row order is load-bearing and is the source's: sender and date on the
   first line, then the record chip leading the subject on the second, then the
   preview, then the attachment badge. A reader scanning the list is asking
   "who, when, about what" in that order. */
import { Mail, Paperclip } from 'lucide-react'
import { EmptyState } from '../ui'
import { initialsOf, senderTint, type CommThread, type Density } from '../../lib/comms'
import { ENTITY_META, formatEntityRef } from './entityRef'
import { highlightMatch } from './highlightMatch'
import { RecordRefHoverCard } from './RecordRefHoverCard'

function ThreadRow({ thread, selected, density, query, onSelect }: {
  thread: CommThread
  selected: boolean
  density: Density
  query: string
  onSelect: () => void
}) {
  const comfort = density === 'comfort'
  const tint = senderTint(thread.lastSender, thread.lastSenderEmail)
  const meta = ENTITY_META[thread.entityType]

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`w-full text-left border-b border-[var(--color-slate-200)] cursor-pointer transition-colors ${comfort ? 'px-4 py-3.5' : 'px-4 py-2.5'}`}
      style={{
        backgroundColor: selected ? 'var(--color-brand-75)' : 'transparent',
        /* A border rather than an inset shadow, because the row's own
           background is what changes on hover and a shadow sat under it. */
        borderLeft: `2px solid ${selected ? 'var(--color-sky-500)' : 'transparent'}`,
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.backgroundColor = 'var(--color-slate-100)'
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      <div className={`flex gap-3 min-w-0 ${comfort ? 'items-start' : 'items-center'}`}>
        <div
          className={`rounded-full flex items-center justify-center shrink-0 border border-[var(--color-mist-450)] w-9 h-9 text-[10px] ${comfort ? 'mt-0.5' : ''}`}
          style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 600 }}
          aria-hidden
        >
          {initialsOf(thread.lastSender)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-[13px] truncate"
              style={{ fontWeight: thread.isUnread ? 700 : 500, color: 'var(--color-slate-900)' }}
            >
              {highlightMatch(thread.lastSender, query)}
            </span>
            {thread.isUnread && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-sky-500)] shrink-0" aria-label="Unread" />
            )}
            <span
              className="ml-auto text-[11px] font-light whitespace-nowrap shrink-0"
              style={{ color: 'var(--color-slate-500)' }}
            >
              {thread.lastDate}
            </span>
          </div>

          {/* The chip leads the subject rather than sitting on its own line, so
              the record a thread belongs to is read as part of what it is
              about. Fixed height and no shrink: it must never be the thing that
              gives way when the subject is long. */}
          <div className="flex items-center gap-2 mt-1 min-w-0 pr-1">
            {/* Hover only, no click of its own, so the chip can explain the
                record without competing with the row for the same press. */}
            <RecordRefHoverCard recordId={thread.entityRef} module={thread.entityType}>
              <span
                className="inline-flex items-center h-[16px] px-1.5 rounded text-[9.5px] whitespace-nowrap shrink-0"
                style={{ fontWeight: 600, backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
              >
                {formatEntityRef(thread.entityRef)}
              </span>
            </RecordRefHoverCard>
            <span
              className="text-[13px] truncate min-w-0 flex-1"
              style={{ fontWeight: thread.isUnread ? 700 : 500, color: 'var(--color-slate-900)' }}
            >
              {highlightMatch(thread.subject, query)}
            </span>
          </div>

          {comfort && (
            <>
              <p
                className="text-[12px] font-light truncate mt-1 leading-relaxed"
                style={{ color: 'var(--color-slate-500)' }}
              >
                {highlightMatch(thread.bodyPreview, query)}
              </p>
              {thread.hasAttachments && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span
                    className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-[var(--color-slate-200)] bg-white text-[10px]"
                    style={{ fontWeight: 500, color: 'var(--color-slate-500)' }}
                  >
                    <Paperclip className="w-2.5 h-2.5" aria-hidden />
                    {thread.attachmentCount} Attachment{thread.attachmentCount === 1 ? '' : 's'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </button>
  )
}

export function ThreadList({ threads, selectedId, density, query, onSelect, hasAny }: {
  threads: CommThread[]
  selectedId: string | null
  density: Density
  query: string
  onSelect: (id: string) => void
  /** Whether the record has any correspondence at all, before filtering. An
   *  empty record and an over-filtered one are different problems and get
   *  different words. */
  hasAny: boolean
}) {
  if (!threads.length) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Mail className="w-5 h-5" />}
          title={hasAny ? 'No threads match' : 'Nothing has been said about this yet'}
          description={hasAny
            ? 'No conversation matches the current filter.'
            : 'Ask a question or leave a note, and it stays with the record instead of in an inbox.'}
        />
      </div>
    )
  }
  return (
    <ul>
      {threads.map(t => (
        <li key={t.id}>
          <ThreadRow
            thread={t}
            selected={t.id === selectedId}
            density={density}
            query={query}
            onSelect={() => onSelect(t.id)}
          />
        </li>
      ))}
    </ul>
  )
}
