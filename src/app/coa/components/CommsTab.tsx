// Ported from chart-of-accounts-v2.1/src/components/CommsTab.tsx; adapted: the subject is a currency or an exchange rate (CommSubjectKind), a moved thread lands on a currency or a rate, and a new thread is filed under the record's ref from lib/comms.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Mail, Maximize2, MessageSquare, Minimize2,
  PanelLeftClose, PanelLeftOpen, Plus, Search, Send, SlidersHorizontal, StickyNote, X,
} from 'lucide-react'
import { Button, EmptyState, Modal, Tooltip } from './ui'
import { ColumnResizeHandle, useColumnResize } from './comms/useColumnResize'
import { CommsFiltersModal } from './comms/CommsFiltersModal'
import { DensityToggle } from './comms/DensityToggle'
import { MailboxPill } from './comms/MailboxPill'
import { NO_RECORD_SENTINEL } from './comms/ModifyTagModal'
import { ownersForModule } from './comms/recordDirectory'
import { ThreadList } from './comms/ThreadList'
import { ThreadDetail } from './comms/ThreadDetail'
import { ChatPanel } from './comms/ChatPanel'
import { useStore } from '../store'
import {
  CHANNEL_MEANING, DEFAULT_COMM_FILTERS, countActiveCommFilters, filterThreads, mailboxCounts,
  messageCountFor, previewOf, recordKindOf, refOf, threadsFor,
  type CommChannel, type CommFilters, type CommSubjectKind, type CommThread, type CommsSurface,
  type Density, type Mailbox,
} from '../lib/comms'
import { cn, uid } from '../lib/utils'

/* ─────────────────────────── Comms on a record ───────────────────────────
   The thread that already exists around every figure, put where the figure is.
   Today the question "why is this account classified here" and the answer to it
   live in an inbox, so a reader looking at the ledger sees the number and none
   of the reasoning behind it, and the person who could explain it is whoever
   happens to remember the thread.

   This is a 1:1 port of the financial reporting module's Communication tab
   (components/fr/comms/RecordCommsTab.tsx). Same two-row top bar, same
   Emails/Chat switch, same four mailboxes, same controls in the same places,
   down to the markup and the copy. Only the records differ: it files mail
   against reports and automations, this files it against currencies and
   exchange rates.

   The colours are the source's own primitives, declared under `[data-comms]` in
   index.css, which is why the root carries that attribute. Translating them
   into this module's scales is what made an earlier attempt drift. */

export interface Subject {
  subjectId: string
  kind: CommSubjectKind
  /** What the record is called, in the words the thread should use for it. */
  label: string
  /** The record's own date. A thread never predates what it discusses. */
  anchorIso: string
  /** Made by the reader here: no seeded correspondence (see `createdHere`). */
  fresh?: boolean
}

const MAILBOXES: { value: Mailbox; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sent', label: 'Sent' },
  { value: 'archived', label: 'Archived' },
  { value: 'unmatched', label: 'Unmatched' },
]

/** The record's correspondence, as both the tab and the count on it read it. One
 *  reader, so the number on the tab cannot disagree with what is under it. */
export function useComms({ subjectId, kind, label, anchorIso, fresh }: Subject): CommThread[] {
  const storedThreads = useStore(s => s.commsThreads)
  const storedMessages = useStore(s => s.commsSent)
  const transferred = useStore(s => s.commsTransferred)
  return useMemo(
    () => threadsFor(storedThreads, storedMessages, subjectId, kind, label, anchorIso, fresh)
      // A thread that has been filed elsewhere leaves here. Dropping it at the
      // one place both the tab count and the list read from is what keeps the
      // two from disagreeing about a thread that has moved.
      .filter(t => !transferred.includes(t.id)),
    [storedThreads, storedMessages, transferred, subjectId, kind, label, anchorIso, fresh],
  )
}

/** What the tab badge shows: messages, not threads. A record with one thread of
 *  nine messages has had nine things said about it. */
export function useCommsCount(subject: Subject): number {
  return messageCountFor(useComms(subject))
}

export function CommsTab(subject: Subject) {
  const seeded = useComms(subject)
  /* Read state the reader has set - by opening a thread, or from its More menu -
     laid over the seeded flag, so the list's dot, its weight and the Unread
     filter all answer from the same place. */
  const unreadState = useStore(s => s.commsUnread)
  const setCommUnread = useStore(s => s.setCommUnread)
  const threads = useMemo(
    () => seeded.map(t => (t.id in unreadState ? { ...t, isUnread: unreadState[t.id] } : t)),
    [seeded, unreadState],
  )
  const archived = useStore(s => s.commsArchived)
  const pinnedIds = useStore(s => s.commsPinned)
  const addCommMessage = useStore(s => s.addCommMessage)
  const addCommThread = useStore(s => s.addCommThread)
  const toggleCommArchived = useStore(s => s.toggleCommArchived)
  const toggleCommPinned = useStore(s => s.toggleCommPinned)
  const transferCommThread = useStore(s => s.transferCommThread)
  const pushToast = useStore(s => s.pushToast)

  const [surface, setSurface] = useState<CommsSurface>('emails')
  const [mailbox, setMailbox] = useState<Mailbox>('all')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<CommFilters>(DEFAULT_COMM_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [density, setDensity] = useState<Density>('comfort')
  const [fullView, setFullView] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const { widthPercent, isResizing, onMouseDown } = useColumnResize({ containerRef, defaultPercent: 35 })

  const shown = useMemo(
    () => filterThreads(threads, { mailbox, archived, filters, search }),
    [threads, mailbox, archived, filters, search],
  )
  const counts = useMemo(
    () => mailboxCounts(threads, { archived, filters, search }),
    [threads, archived, filters, search],
  )
  const activeFilters = countActiveCommFilters(filters)

  // Full view gives the thread the whole screen, so the list gets out of the way
  // unless the reader puts it back.
  useEffect(() => { if (fullView) setLeftCollapsed(false) }, [fullView])

  /* The selection follows the list. A thread the reader has filtered out of view
     must not keep rendering in the pane beside it, and a list with something in
     it should not sit next to an empty pane.

     Falling back to the newest thread here rather than correcting the stored id
     in an effect: an effect runs after the first paint, so the reader would see
     "select a message to read it" flash and be replaced by a thread they never
     asked for. */
  const selected = (selectedId ? shown.find(t => t.id === selectedId) : undefined) ?? shown[0] ?? null

  /* Opening a thread is reading it. Keyed on the id, so Mark as unread from the
     open thread holds until the reader comes back to it. */
  const selectedThreadId = selected?.id
  useEffect(() => {
    if (selectedThreadId) setCommUnread(selectedThreadId, false)
  }, [selectedThreadId, setCommUnread])

  const send = (input: { threadId: string; channel: CommChannel; to: string; toEmail: string; body: string; isConfidential?: boolean; attachments?: { name: string; size: string }[] }) => {
    addCommMessage({ ...input, isPinned: false })
  }

  /* Where a thread goes when the reader says it belongs to another record. The
     ledger is read here rather than subscribed to, because moving a thread is
     something the reader does once and this tab has no other use for ten
     thousand postings. */
  const transfer = (thread: CommThread) => (targetModule: string, targetRecord: string) => {
    if (targetRecord === NO_RECORD_SENTINEL) {
      transferCommThread({ thread })
      setSelectedId(null)
      pushToast('Tagged as Unmatched', 'success', 'Find it under Unmatched until it has a record.')
      return
    }
    const { currencies, midMarketRates, standardRates } = useStore.getState()
    const owner = ownersForModule(targetModule, { currencies, midMarketRates, standardRates })
      .find(o => o.ref === targetRecord)
    // A typed id the ledger does not hold. Closing on nothing read as a move
    // that had happened; say it did not.
    if (!owner) {
      pushToast(`${targetRecord} was not found`, 'danger', 'The conversation stays where it is.')
      return
    }
    transferCommThread({
      thread,
      destination: {
        subjectId: owner.id,
        ref: owner.ref,
        label: owner.name,
        kind: targetModule === 'currency-library' ? 'Currency' : 'Exchange Rate',
      },
    })
    setSelectedId(null)
    pushToast(
      `Moved to ${targetRecord}`,
      'success',
      'You can access it from the destination record.',
    )
  }

  const startThread = (input: { channel: CommChannel; to: string; subject: string; body: string }) => {
    const thread = addCommThread({
      id: uid('thread'),
      subjectId: subject.subjectId,
      entityType: recordKindOf(subject.kind),
      entityRef: refOf(subject.kind, subject.label),
      entityLabel: subject.label,
      subject: input.subject,
      lastSender: '',
      lastSenderEmail: '',
      bodyPreview: previewOf(input.body),
      lastDate: '',
      dateIso: '',
      isUnread: false,
      hasAttachments: false,
      attachmentCount: 0,
      first: { channel: input.channel, to: input.to, toEmail: '', body: input.body },
    })
    setComposing(false)
    // A new thread the reader cannot see reads as a message that did not post, so
    // the view moves to where it landed rather than leaving them to find it.
    if (mailbox !== 'all') setMailbox('all')
    setFilters(DEFAULT_COMM_FILTERS)
    setSearch('')
    setSelectedId(thread.id)
    pushToast(
      input.channel === 'Note' ? 'Note added' : 'Email sent',
      'success',
      `On ${subject.label}`,
    )
  }

  return (
    <div
      ref={containerRef}
      data-comms
      className={cn(
        'flex flex-col bg-white overflow-hidden relative',
        fullView ? 'fixed inset-0 z-[60] border-0 rounded-none' : 'rounded-xl border border-border',
      )}
      style={fullView ? undefined : { minHeight: 700 }}
    >
      {/* Row one names the surface and holds everything that acts on the whole
          tab. Row two, and the search and mailboxes under it, belong to the
          list, so they sit inside the list's own column. */}
      <div
        className="relative flex items-center gap-2 px-4 pt-3 pb-2.5 bg-white shrink-0"
        style={{ borderBottom: '1px solid var(--color-slate-200)' }}
      >
        <div className="inline-flex items-center rounded-lg bg-[var(--color-slate-100)] p-0.5">
          {([['emails', 'Emails', Mail], ['chat', 'Chat', MessageSquare]] as const).map(([value, label, Icon]) => {
            const active = surface === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSurface(value)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] transition-colors cursor-pointer',
                  active
                    ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]'
                    : 'hover:text-[var(--color-slate-700)]',
                )}
                style={{
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--color-sky-500)' : 'var(--color-slate-500)',
                }}
              >
                {/* The icon is a step lighter than the label when inactive, so
                    the pair reads as one dimmed unit rather than two. */}
                <Icon
                  className="w-3.5 h-3.5"
                  style={{ color: active ? 'var(--color-sky-500)' : 'var(--color-slate-400)' }}
                  aria-hidden
                />
                {label}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* Density belongs to both surfaces: the chat stream reads it too, so
              hiding the control on chat left a setting with no way back. */}
          <DensityToggle density={density} onChange={setDensity} />

          <Tooltip side="bottom" content={fullView ? 'Exit full view' : 'Full view'}>
            <button
              type="button"
              onClick={() => setFullView(v => !v)}
              aria-label={fullView ? 'Exit full view' : 'Full view'}
              className="h-8 w-8 rounded-md border border-[var(--color-slate-200)] bg-white shadow-sm hover:bg-[var(--color-slate-100)] inline-flex items-center justify-center cursor-pointer transition-colors"
              style={{ color: 'var(--color-slate-500)' }}
            >
              {fullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </Tooltip>

          {/* Deliberately not this module's `Button`: the source's compose is a
              32px brand-filled control that has to line up with the two 32px
              bordered buttons beside it, and the shared primary is taller. */}
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] text-white rounded-md shadow-sm cursor-pointer transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--color-brand-500)', fontWeight: 500 }}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden />
            {surface === 'chat' ? 'Start New Chat' : 'Compose New Email'}
          </button>
        </div>
      </div>

      {surface === 'chat' ? (
        <ChatPanel
          subjectId={subject.subjectId}
          kind={subject.kind}
          label={subject.label}
          anchorIso={subject.anchorIso}
          density={density}
          composeOpen={composing}
          onComposeClose={() => setComposing(false)}
        />
      ) : (
        <div className="flex-1 flex min-h-0">
          <div
            className="shrink-0 overflow-hidden flex flex-col bg-white relative"
            style={{
              width: leftCollapsed ? 48 : `${widthPercent}%`,
              transition: isResizing ? undefined : 'width 280ms cubic-bezier(0.4, 0, 0.2, 1)',
              borderRight: '1px solid var(--color-slate-300)',
              boxShadow: leftCollapsed
                ? 'none'
                : '1px 0 0 0 rgba(15, 23, 42, 0.05), 4px 0 8px -4px rgba(15, 23, 42, 0.06)',
            }}
          >
            {leftCollapsed ? (
              <button
                type="button"
                onClick={() => setLeftCollapsed(false)}
                className="w-full h-full flex flex-col items-center gap-2 pt-3 hover:bg-[var(--color-slate-100)] transition-colors cursor-pointer"
                aria-label="Show thread list"
              >
                <PanelLeftOpen className="w-4 h-4" style={{ color: 'var(--color-slate-400)' }} aria-hidden />
                <span className="text-[10px]" style={{ fontWeight: 600, color: 'var(--color-slate-500)' }}>
                  {shown.length}
                </span>
              </button>
            ) : (
              <>
                <div className="shrink-0 px-4 pt-3 pb-3 bg-white flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search
                      className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: 'var(--color-slate-400)' }}
                      aria-hidden
                    />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search emails"
                      aria-label="Search emails"
                      className="h-8 w-full pl-8 pr-8 text-[13px] border border-border rounded-md bg-white shadow-sm hover:shadow-md transition-shadow outline-none focus:border-primary"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        aria-label="Clear search"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded inline-flex items-center justify-center cursor-pointer hover:bg-[var(--color-slate-100)]"
                        style={{ color: 'var(--color-slate-400)' }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <Tooltip side="bottom" content="Filters">
                    <button
                      type="button"
                      onClick={() => setShowFilters(true)}
                      aria-label="Filters"
                      className="relative h-8 w-8 rounded-md border bg-white shadow-sm inline-flex items-center justify-center cursor-pointer transition-colors hover:bg-[var(--color-slate-100)]"
                      style={{
                        borderColor: activeFilters ? 'var(--color-sky-500)' : 'var(--color-slate-200)',
                        color: activeFilters ? 'var(--color-sky-500)' : 'var(--color-slate-500)',
                      }}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      {activeFilters > 0 && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] text-white inline-flex items-center justify-center"
                          style={{ backgroundColor: 'var(--color-sky-500)', fontWeight: 700 }}
                        >
                          {activeFilters}
                        </span>
                      )}
                    </button>
                  </Tooltip>

                  <Tooltip side="bottom" content="Hide thread list">
                    <button
                      type="button"
                      onClick={() => setLeftCollapsed(true)}
                      aria-label="Hide thread list"
                      className="h-8 w-8 rounded-md border border-[var(--color-slate-200)] bg-white shadow-sm inline-flex items-center justify-center cursor-pointer transition-colors hover:bg-[var(--color-slate-100)]"
                      style={{ color: 'var(--color-slate-500)' }}
                    >
                      <PanelLeftClose className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>

                <div className="shrink-0 border-b border-[var(--color-slate-200)] px-4 pt-0 pb-3 bg-white">
                  <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto">
                    {MAILBOXES.map(m => (
                      <MailboxPill
                        key={m.value}
                        label={m.label}
                        count={counts[m.value]}
                        isActive={mailbox === m.value}
                        onClick={() => setMailbox(m.value)}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                  <ThreadList
                    threads={shown}
                    selectedId={selected?.id ?? null}
                    density={density}
                    query={search}
                    onSelect={setSelectedId}
                    hasAny={threads.length > 0}
                  />
                </div>
                <ColumnResizeHandle onMouseDown={onMouseDown} isResizing={isResizing} />
              </>
            )}
          </div>

          <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-[var(--color-slate-50)] relative">
            {selected ? (
              <ThreadDetail
                key={selected.id}
                thread={selected}
                archived={archived.includes(selected.id)}
                pinnedIds={pinnedIds}
                query={search}
                onToggleArchive={() => toggleCommArchived(selected.id)}
                onTogglePin={toggleCommPinned}
                onSend={send}
                onTransfer={transfer(selected)}
                onToast={pushToast}
                unread={selected.isUnread}
                onSetUnread={u => setCommUnread(selected.id, u)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <EmptyState
                  icon={<Mail className="w-5 h-5" />}
                  title={threads.length ? 'Select a message to read it' : 'Nothing has been said about this yet'}
                  description={threads.length
                    ? 'Choose a conversation from the list to read its thread.'
                    : 'Ask a question or leave a note, and it stays with the record instead of in an inbox.'}
                  action={<Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setComposing(true)}>Compose new email</Button>}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <CommsFiltersModal
        open={showFilters}
        onClose={() => setShowFilters(false)}
        value={filters}
        onApply={setFilters}
        records={threads.map(t => ({ ref: t.entityRef, label: t.entityLabel, kind: t.entityType }))}
        resultCount={draft => filterThreads(threads, { mailbox, archived, filters: draft, search }).length}
      />

      {/* One compose flag drives both surfaces, so this has to name its own:
          on the chat surface the button starts a conversation, not an email. */}
      <ComposeModal
        open={composing && surface === 'emails'}
        onClose={() => setComposing(false)}
        label={subject.label}
        onSend={startThread}
      />
    </div>
  )
}

/* Starting a thread, rather than answering one. The channel is chosen on the way
   in because a note and an email are not the same act: one stays on the record,
   the other is now in somebody's inbox too, and that is the difference a reader
   scanning the list is looking for. */
function ComposeModal({ open, onClose, label, onSend }: {
  open: boolean
  onClose: () => void
  label: string
  onSend: (input: { channel: CommChannel; to: string; subject: string; body: string }) => void
}) {
  const [channel, setChannel] = useState<CommChannel>('Note')
  const [to, setTo] = useState('')
  const [subjectLine, setSubjectLine] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    if (!open) return
    setChannel('Note')
    setTo('')
    setSubjectLine('')
    setBody('')
  }, [open])

  // An email with no recipient is a note that thinks it left the building, so the
  // channel that has recipients insists on one.
  const ready = !!body.trim() && (channel === 'Note' || !!to.trim())

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compose new email"
      subtitle={`On ${label}`}
      width="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!ready}
            icon={<Send className="w-3.5 h-3.5" />}
            onClick={() => onSend({
              channel,
              to: channel === 'Email' ? to.trim() : '',
              subject: subjectLine.trim() || `Re: ${label}`,
              body: body.trim(),
            })}
          >
            {channel === 'Note' ? 'Add note' : 'Send email'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          {(['Note', 'Email'] as CommChannel[]).map(c => {
            const Icon = c === 'Note' ? StickyNote : Mail
            const active = channel === c
            return (
              <Tooltip key={c} side="bottom" content={CHANNEL_MEANING[c]}>
                <button
                  onClick={() => setChannel(c)}
                  aria-pressed={active}
                  className={cn(
                    'h-8 px-3 rounded-lg border text-[12.5px] inline-flex items-center gap-1.5 transition-colors cursor-pointer',
                    active ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-fg-muted hover:bg-bg-subtle',
                  )}
                  style={{ fontWeight: active ? 600 : 500 }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {c}
                </button>
              </Tooltip>
            )
          })}
        </div>
        <p className="text-[11.5px] text-fg-muted">{CHANNEL_MEANING[channel]}</p>

        {channel === 'Email' && (
          <input
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="To (comma separated)"
            aria-label="To"
            className="input h-9 text-[12.5px]"
          />
        )}
        <input
          value={subjectLine}
          onChange={e => setSubjectLine(e.target.value)}
          placeholder={`Re: ${label}`}
          aria-label="Subject"
          className="input h-9 text-[12.5px]"
        />
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={channel === 'Note' ? 'Leave a note on this record' : 'Write the message'}
          aria-label="Message"
          className="input min-h-[120px] py-2 text-[12.5px]"
        />
      </div>
    </Modal>
  )
}
