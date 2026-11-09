import { useMemo, useState } from 'react'
import {
  Archive, ArchiveRestore, Download, EyeOff, Forward, Link2, Lock,
  MailOpen, MessageSquare, MoreHorizontal, Paperclip, Pin, Reply, ReplyAll, ShieldAlert,
} from 'lucide-react'
import { Badge, Button, EmptyState, Menu, MenuItem, Tooltip } from '../ui'
import {
  CHANNEL_MEANING, CURRENT_USER, initialsOf, isSystemSender, longDate, senderTint, stampOf,
  type CommMessage, type CommThread,
} from '../../lib/comms'
import { ArchiveConfirmModal, type ArchiveConfirmKind } from './ArchiveConfirmModal'
import { AttachmentCard } from './AttachmentCard'
import { AttachmentsSlidePanel, type ThreadAttachment } from './AttachmentsSlidePanel'
import { AutomatedEmailTemplate } from './AutomatedEmailTemplate'
import { CommentsSlidePanel } from './CommentsSlidePanel'
import { generateMockComments, type EmailComment } from './commentsData'
import { ENTITY_META, entityLabelOf, formatEntityRef } from './entityRef'
import { highlightMatch } from './highlightMatch'
import { InlineReplyPane, inlineReplyStateFor, type InlineReplyState } from './InlineReplyPane'
import { ModifyTagModal } from './ModifyTagModal'
import { PersonHoverCard } from './PersonHoverCard'
import { RecordRefHoverCard } from './RecordRefHoverCard'
import { cn, uid } from '../../lib/utils'

/* One thread, read. Ported from the financial reporting module: the header
   naming the record above the subject, the three count pills under it, and the
   message cards themselves, each one a card on a tinted page rather than a row
   in a list. */

type ReplyMode = 'reply' | 'replyAll' | 'forward'

/** The rich-text body the reply pane hands back, flattened for a store that
 *  holds message bodies as plain text. Line breaks survive; markup does not. */
function plainTextFrom(html: string): string {
  return html
    .replace(/<hr[^>]*>/gi, '\n---\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const REPLY_LABEL: Record<ReplyMode, string> = {
  reply: 'Reply',
  replyAll: 'Reply all',
  forward: 'Forward',
}

function fullStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function MessageCard({ message, pinned, commentCount, isLast, flagged, onPin, onReply, onComment, query }: {
  message: CommMessage
  pinned: boolean
  commentCount: number
  /** The newest message carries the inline reply affordance, because that is the
   *  one a reader answers. */
  isLast: boolean
  /** Pointed at from a side panel. Rings the card so the reader can see which
   *  message the comment or file they just clicked belongs to. */
  flagged: boolean
  onPin: () => void
  onReply: (mode: ReplyMode) => void
  onComment: () => void
  query: string
}) {
  const tint = senderTint(message.from, message.fromEmail)
  const system = isSystemSender(message.from, message.fromEmail)
  const isEmail = message.channel === 'Email'
  /* A card the search hit is ringed rather than captioned. The old caption bar
     said "Matches your search" under a body that already had the words
     highlighted, which is the same fact stated twice. */
  const isHighlighted = flagged
    || (!!query.trim() && message.body.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <li
      id={`message-${message.id}`}
      data-message-id={message.id}
      className="mx-[14px] my-[10px] rounded-lg bg-white shadow-sm transition-all scroll-mt-4"
      style={{
        border: `1px solid ${isHighlighted ? 'var(--color-sky-500)' : 'var(--color-gray-200)'}`,
        boxShadow: isHighlighted ? '0 0 0 3px rgba(10, 119, 255, 0.12)' : undefined,
      }}
    >
      <div className="px-5 py-4">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[11px] border border-[var(--color-mist-450)]"
            style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 600 }}
            aria-hidden
          >
            {initialsOf(message.from)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <PersonHoverCard name={message.from} email={message.fromEmail}>
                <span className="text-[13px]" style={{ fontWeight: 500, color: 'var(--color-slate-900)' }}>
                  {message.from}
                </span>
              </PersonHoverCard>
              {message.fromEmail && (
                <span className="text-[11px]" style={{ color: 'var(--color-slate-400)' }}>
                  &lt;{message.fromEmail}&gt;
                </span>
              )}
              <Tooltip side="bottom" content={CHANNEL_MEANING[message.channel]}>
                <Badge tone={isEmail ? 'indigo' : 'neutral'}>{message.channel}</Badge>
              </Tooltip>
              {system && <Badge tone="brand">Automated</Badge>}
              {message.isConfidential && (
                <Tooltip side="bottom" content="Internal only. Not to be forwarded outside the company.">
                  <Badge tone="warning"><Lock className="w-2.5 h-2.5" /> Confidential</Badge>
                </Tooltip>
              )}
            </div>
            {/* Who else has this. The half of an email a record cannot otherwise
                show. A note has no recipient and prints no line. */}
            {isEmail && message.to && (
              <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--color-slate-500)' }}>
                to {message.to}{message.toEmail ? ` <${message.toEmail}>` : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {/* A note was never sent to anyone, so it has nothing to reply to.
                Offering a reply would be offering to send an email the reader
                did not ask for. */}
            {isEmail && (
              <>
                <IconAction label="Reply" onClick={() => onReply('reply')}><Reply className="w-3.5 h-3.5" /></IconAction>
                <IconAction label="Reply all" onClick={() => onReply('replyAll')}><ReplyAll className="w-3.5 h-3.5" /></IconAction>
                <IconAction label="Forward" onClick={() => onReply('forward')}><Forward className="w-3.5 h-3.5" /></IconAction>
              </>
            )}
            <IconAction label={commentCount ? `Comments (${commentCount})` : 'Comment'} onClick={onComment}>
              <MessageSquare className="w-3.5 h-3.5" />
            </IconAction>
            <IconAction label={pinned ? 'Unpin' : 'Pin'} onClick={onPin} active={pinned}>
              <Pin className="w-3.5 h-3.5" fill={pinned ? 'currentColor' : 'none'} />
            </IconAction>
            <span className="text-[11px] shrink-0 ml-1 whitespace-nowrap" style={{ color: 'var(--color-slate-400)' }}>
              {/* Messages saved before sent ones were stamped properly carry the
                  raw ISO string; say it the way every other message is said. */}
              {/^\d{4}-\d{2}-\d{2}T/.test(message.timestamp) ? stampOf(message.timestamp) : message.timestamp}
            </span>
          </div>
        </div>

        {/* Indented to the avatar's right edge so the body starts where the
            sender's name does, which is what makes a stack of cards read as a
            conversation rather than as separate documents. */}
        {message.isAutomated ? (
          <div className="pl-12">
            <AutomatedEmailTemplate body={message.body} />
          </div>
        ) : (
          <div
            className="text-[13px] whitespace-pre-line pl-12"
            style={{ lineHeight: 1.6, color: 'var(--color-slate-700)' }}
          >
            {highlightMatch(message.body, query)}
          </div>
        )}

        {!!message.attachments?.length && (
          <div
            className="mt-3 pl-12 grid gap-2.5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, 156px)' }}
          >
            {message.attachments.map(file => (
              <AttachmentCard
                key={file.name}
                file={{ name: file.name, size: file.size, uploadedBy: message.from, date: longDate(message.dateIso), extracts: file.extracts }}
              />
            ))}
          </div>
        )}

        {isLast && isEmail && (
          <div className="mt-4 pl-12 flex items-center gap-2">
            <InlineReply icon={<Reply className="w-3.5 h-3.5" />} onClick={() => onReply('reply')}>Reply</InlineReply>
            <InlineReply icon={<Forward className="w-3.5 h-3.5" />} onClick={() => onReply('forward')}>Forward</InlineReply>
          </div>
        )}
      </div>
    </li>
  )
}

/* The three pills above the thread. Each one states a count and each count can
   honestly be zero: a thread with nothing pinned says so rather than hiding the
   control, because a pill that appears only when it is non-empty makes the
   reader wonder where it went. */
function CountPill({ icon, label, count, active, onClick }: {
  icon: React.ReactNode
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center justify-center h-8 gap-1.5 px-3 rounded-md border bg-white shadow-sm text-[13px] cursor-pointer transition-colors',
        active
          ? 'border-[var(--color-sky-500)] text-[var(--color-sky-500)] bg-[var(--color-brand-75)]'
          : 'border-[var(--color-slate-200)] hover:bg-[var(--color-slate-100)]',
      )}
      style={active ? undefined : { color: 'var(--color-slate-600)' }}
    >
      {icon}
      {label}
      <span
        className="min-w-[18px] h-[18px] rounded-full text-[10px] flex items-center justify-center px-1"
        style={{
          fontWeight: 600,
          backgroundColor: active ? 'var(--color-blue-100)' : 'var(--color-slate-100)',
          color: active ? 'var(--color-blue-800)' : 'var(--color-slate-400)',
        }}
      >
        {count}
      </span>
    </button>
  )
}

function IconAction({ label, onClick, active, children }: {
  label: string
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip side="bottom" content={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="w-7 h-7 rounded-md inline-flex items-center justify-center cursor-pointer transition-colors hover:bg-[var(--color-slate-100)] hover:text-[var(--color-sky-500)]"
        style={{ color: active ? 'var(--color-sky-500)' : 'var(--color-slate-400)' }}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function InlineReply({ icon, onClick, children }: {
  icon: React.ReactNode
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[var(--color-slate-200)] bg-white text-[12px] cursor-pointer transition-colors hover:bg-[var(--color-slate-100)]"
      style={{ fontWeight: 500, color: 'var(--color-slate-600)' }}
    >
      {icon}
      {children}
    </button>
  )
}

export function ThreadDetail({
  thread, archived, pinnedIds, query, onToggleArchive, onTogglePin, onSend, onTransfer, onToast, unread = false, onSetUnread,
}: {
  thread: CommThread
  archived: boolean
  pinnedIds: string[]
  query: string
  onToggleArchive: () => void
  onTogglePin: (messageId: string) => void
  onSend: (input: { threadId: string; channel: CommMessage['channel']; to: string; toEmail: string; body: string; isConfidential?: boolean; attachments?: { name: string; size: string }[] }) => void
  /** Where the reader has chosen to file the thread instead. `targetRecord` is
   *  ModifyTagModal's `NO_RECORD_SENTINEL` when they picked no record at all. */
  onTransfer: (targetModule: string, targetRecord: string) => void
  onToast: (message: string, tone?: 'success' | 'info' | 'danger', description?: string) => void
  /** Whether the thread reads as unread in the list, and the way to change it. */
  unread?: boolean
  onSetUnread?: (unread: boolean) => void
}) {
  const messageIds = useMemo(() => thread.messages.map(m => m.id), [thread.messages])

  const [pinnedOnly, setPinnedOnly] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<EmailComment[]>(() => generateMockComments(messageIds))
  const [seededFor, setSeededFor] = useState(thread.id)
  const [confirmArchive, setConfirmArchive] = useState<ArchiveConfirmKind | null>(null)
  const [reply, setReply] = useState<(InlineReplyState & { channel: CommMessage['channel'] }) | null>(null)
  const [flaggedMessageId, setFlaggedMessageId] = useState<string | null>(null)
  const [showTagModal, setShowTagModal] = useState(false)

  /* Comments hang on messages, so a new thread re-seeds rather than carrying the
     last one's comments onto messages that never had them. Adjusted during
     render, not in an effect, because the count pill states a number on first
     paint and an effect would show it as zero first. */
  if (seededFor !== thread.id) {
    setSeededFor(thread.id)
    setComments(generateMockComments(messageIds))
    setFlaggedMessageId(null)
    setReply(null)
  }

  const pinned = useMemo(
    () => thread.messages.filter(m => pinnedIds.includes(m.id)),
    [thread.messages, pinnedIds],
  )
  const shown = pinnedOnly ? pinned : thread.messages
  const attachmentCount = thread.attachmentCount
  const commentsFor = (id: string) => comments.filter(c => c.emailId === id)
  /* Replies count. The pill and the panel header have to agree, and a reader who
     sees Comments 5 then finds eight cards inside is being lied to by one of
     them. */
  const commentTotal = comments.reduce((n, c) => n + 1 + c.replies.length, 0)

  const threadAttachments: ThreadAttachment[] = useMemo(
    () => thread.messages.flatMap(m => (m.attachments ?? []).map(f => ({
      ...f,
      from: m.from,
      date: longDate(m.dateIso),
      messageId: m.id,
      messagePreview: m.body.slice(0, 140),
      subject: thread.subject,
    }))),
    [thread.messages, thread.subject],
  )

  /* Offered before the reader types anything: everyone who has written on this
     thread. A directory of strangers is a worse first guess than the people
     already in the conversation. */
  const suggestedRecipients = useMemo(
    () => [...new Set(thread.messages.map(m => m.from).filter(n => n && n !== CURRENT_USER.name))],
    [thread.messages],
  )

  const startReply = (mode: ReplyMode, message: CommMessage) => {
    setReply({ ...inlineReplyStateFor(thread, message, mode), channel: message.channel })
  }

  /* A note was never sent to anyone, so there is nothing to reply to: the only
     way to put it in front of someone is to send it out for the first time,
     which is a forward. The footer names whichever one it will open, because a
     button labelled Reply that opens a Forward is a mistake the reader only
     finds after pressing it. */
  const lastMessage = thread.messages[thread.messages.length - 1]
  const footerMode: ReplyMode = lastMessage?.channel === 'Note' ? 'forward' : 'reply'

  const meta = ENTITY_META[thread.entityType]
  const lastId = thread.messages[thread.messages.length - 1]?.id

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* The record is named ABOVE the subject, not beside it. A reader who has
          scrolled a long thread is asking "what am I looking at" before "what
          does it say", and the chip answers it in the same place every time. */}
      <div className="px-5 shrink-0 pt-5 pb-4 bg-white">
        <div className="flex items-center gap-2 mb-1.5">
          <RecordRefHoverCard recordId={thread.entityRef} module={thread.entityType}>
            <span
              className="inline-flex items-center h-[18px] px-1.5 rounded text-[10px] shrink-0"
              style={{ fontWeight: 600, backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
            >
              {formatEntityRef(thread.entityRef)}
            </span>
          </RecordRefHoverCard>
          <span className="text-[11px]" style={{ color: 'var(--color-slate-400)' }}>
            · {entityLabelOf(thread.entityType)}
          </span>
          {archived && <Badge tone="slate">Archived</Badge>}
          {unread && <Badge tone="info">Unread</Badge>}
        </div>
        <h2 className="text-base leading-snug" style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>
          {thread.subject}
        </h2>
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-slate-500)' }}>
          {thread.messages.length} message{thread.messages.length === 1 ? '' : 's'} · Last updated {longDate(thread.dateIso)}
        </p>
      </div>

      <div className="flex items-center gap-2 px-5 border-b border-[var(--color-slate-200)] shrink-0 -mt-3 pt-1.5 pb-2.5 bg-white">
        <CountPill
          icon={<Pin className="w-3.5 h-3.5" fill={pinnedOnly ? 'currentColor' : 'none'} />}
          label="Pinned"
          count={pinned.length}
          active={pinnedOnly}
          onClick={() => setPinnedOnly(v => !v)}
        />
        <CountPill
          icon={<MessageSquare className="w-3.5 h-3.5" />}
          label="Comments"
          count={commentTotal}
          active={showComments}
          onClick={() => setShowComments(true)}
        />
        <CountPill
          icon={<Paperclip className="w-3.5 h-3.5" />}
          label="Attachments"
          count={attachmentCount}
          active={showAttachments}
          onClick={() => setShowAttachments(true)}
        />

        <div className="flex-1" />

        <Menu
          align="right"
          trigger={
            <span
              className="h-8 w-8 rounded-md inline-flex items-center justify-center cursor-pointer transition-colors hover:bg-[var(--color-slate-100)]"
              style={{ color: 'var(--color-slate-500)' }}
              aria-label="More actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </span>
          }
        >
          {close => (
            <>
              <MenuItem
                icon={unread ? <MailOpen className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                onClick={() => {
                  onSetUnread?.(!unread)
                  onToast(unread ? 'Marked as read' : 'Marked as unread', 'info')
                  close()
                }}
              >
                {unread ? 'Mark as read' : 'Mark as unread'}
              </MenuItem>
              <MenuItem
                icon={<Link2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  setShowTagModal(true)
                  close()
                }}
              >
                Link email conversation to another record
              </MenuItem>
              <MenuItem
                icon={<Download className="w-3.5 h-3.5" />}
                onClick={() => {
                  // A real file, not a toast announcing one: the conversation as
                  // plain text, oldest message first, headed the way it reads here.
                  const text = [
                    thread.subject,
                    `On ${thread.entityRef}`,
                    '',
                    ...thread.messages.flatMap(m => [
                      `From: ${m.from}${m.fromEmail ? ` <${m.fromEmail}>` : ''}`,
                      `Date: ${longDate(m.dateIso)}`,
                      '',
                      m.body,
                      '',
                      '---',
                      '',
                    ]),
                  ].join('\n')
                  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `${thread.subject.replace(/[^\w\- ]+/g, '').trim() || 'Conversation'}.txt`
                  document.body.appendChild(link)
                  link.click()
                  link.remove()
                  URL.revokeObjectURL(url)
                  onToast('Conversation exported', 'success', `${thread.messages.length} message${thread.messages.length === 1 ? '' : 's'}, as a text file`)
                  close()
                }}
              >
                Export conversation
              </MenuItem>
              <MenuItem
                icon={<ShieldAlert className="w-3.5 h-3.5" />}
                warning
                onClick={() => {
                  // Reporting spam archives the thread and reports it, so
                  // it asks first. It used to just happen, on one click, with a
                  // toast as the only notice.
                  setConfirmArchive('spam')
                  close()
                }}
              >
                Report spam
              </MenuItem>
              <MenuItem
                icon={archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                warning={!archived}
                onClick={() => {
                  // Unarchiving needs no confirming: it puts a thread back where
                  // the reader can see it. Archiving takes it out of the list they
                  // are looking at, so it asks.
                  if (archived) {
                    onToggleArchive()
                    onToast('Thread unarchived', 'success')
                  } else {
                    setConfirmArchive('archive')
                  }
                  close()
                }}
              >
                {archived ? 'Unarchive thread' : 'Archive'}
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 flex flex-col">
        {shown.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Pin className="w-5 h-5" />}
              title="No pinned messages"
              description="Pin the messages that answer something, and they collect here."
            />
          </div>
        ) : (
          <ul>
            {shown.map(m => (
              <MessageCard
                key={m.id}
                message={m}
                pinned={pinnedIds.includes(m.id)}
                commentCount={commentsFor(m.id).length}
                isLast={m.id === lastId}
                flagged={flaggedMessageId === m.id}
                query={query}
                onPin={() => {
                  onTogglePin(m.id)
                  onToast(pinnedIds.includes(m.id) ? 'Message unpinned' : 'Message pinned', 'info')
                }}
                onReply={mode => startReply(mode, m)}
                onComment={() => {
                  // The panel composes against whichever message is flagged, so
                  // commenting from a card has to say which card it came from.
                  setFlaggedMessageId(m.id)
                  setShowComments(true)
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {reply ? (
        <div className="shrink-0 border-t border-[var(--color-slate-200)] bg-white">
          <InlineReplyPane
            // Keyed on what is being answered and how, so switching from Reply
            // to Forward opens a fresh pane rather than keeping the reply's
            // recipients under a Forward heading.
            key={`${reply.mode}-${reply.afterMessageId}`}
            mode={reply.mode}
            channel={reply.channel}
            to={reply.to}
            subject={reply.subject}
            body={reply.body}
            suggestedRecipients={suggestedRecipients}
            primaryChipLabels={reply.primaryToName ? [reply.primaryToName] : undefined}
            onClose={() => setReply(null)}
            onSend={draft => {
              onSend({
                threadId: thread.id,
                channel: 'Email',
                to: draft.to.join(', '),
                toEmail: reply.primaryToEmail ?? '',
                body: plainTextFrom(draft.body),
                // What the pane offered and the reader set: kept on the message
                // rather than dropped on send.
                isConfidential: draft.isConfidential || undefined,
                attachments: draft.attachments.length ? draft.attachments : undefined,
              })
              onToast(
                reply.mode === 'forward' ? 'Message forwarded' : 'Reply sent',
                'success',
                `On ${thread.entityRef}`,
              )
              setReply(null)
              // The new message is not pinned, so a pinned-only view would send
              // the reply and then show the reader nothing.
              if (pinnedOnly) setPinnedOnly(false)
            }}
          />
        </div>
      ) : (
        <div className="shrink-0 border-t border-[var(--color-slate-200)] bg-white px-4 py-2.5 flex items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            icon={footerMode === 'forward' ? <Forward className="w-3.5 h-3.5" /> : <Reply className="w-3.5 h-3.5" />}
            onClick={() => { if (lastMessage) startReply(footerMode, lastMessage) }}
          >
            {REPLY_LABEL[footerMode]}
          </Button>
          <span className="text-[11px]" style={{ color: 'var(--color-slate-400)' }}>
            {footerMode === 'forward'
              ? `Sending this out leaves the note on ${thread.entityLabel}.`
              : `Replies stay on ${thread.entityLabel} as well as going out.`}
          </span>
        </div>
      )}

      <AttachmentsSlidePanel
        open={showAttachments}
        onClose={() => setShowAttachments(false)}
        attachments={threadAttachments}
        onHighlightMessage={setFlaggedMessageId}
      />

      <CommentsSlidePanel
        open={showComments}
        // The card a comment was opened from stays ringed only while the panel
        // is commenting on it.
        onClose={() => { setShowComments(false); setFlaggedMessageId(null) }}
        targetMessageId={flaggedMessageId}
        comments={comments}
        messages={thread.messages}
        subject={thread.subject}
        totalCount={commentTotal}
        onAddComment={(messageId, text) => {
          setComments(cs => [...cs, {
            id: uid('comment'),
            emailId: messageId,
            authorName: CURRENT_USER.name,
            authorInitials: initialsOf(CURRENT_USER.name),
            text,
            timestamp: fullStamp(new Date().toISOString()),
            isRead: true,
            isResolved: false,
            replies: [],
          }])
          onToast('Comment added', 'success', 'Internal. Nobody on the thread was emailed.')
        }}
        onReply={(commentId, text) => {
          setComments(cs => cs.map(c => c.id === commentId
            ? {
              ...c,
              replies: [...c.replies, {
                id: uid('reply'),
                authorName: CURRENT_USER.name,
                authorInitials: initialsOf(CURRENT_USER.name),
                text,
                timestamp: fullStamp(new Date().toISOString()),
              }],
            }
            : c))
        }}
        onResolve={commentId => {
          const target = comments.find(c => c.id === commentId)
          setComments(cs => cs.map(c => c.id === commentId ? { ...c, isResolved: !c.isResolved } : c))
          onToast(target?.isResolved ? 'Comment reopened' : 'Comment resolved', 'info')
        }}
        onHighlightMessage={setFlaggedMessageId}
      />

      <ModifyTagModal
        open={showTagModal}
        onClose={() => setShowTagModal(false)}
        currentQuoteNumber={thread.entityRef}
        threadSender={thread.lastSender}
        threadSubject={thread.subject}
        onConfirm={(targetModule, targetRecord) => {
          setShowTagModal(false)
          onTransfer(targetModule, targetRecord)
        }}
      />

      <ArchiveConfirmModal
        open={confirmArchive !== null}
        kind={confirmArchive ?? 'archive'}
        target="thread"
        onClose={() => setConfirmArchive(null)}
        onConfirm={() => {
          const kind = confirmArchive
          if (!archived) onToggleArchive()
          setConfirmArchive(null)
          onToast(
            kind === 'spam' ? 'Reported as spam' : 'Thread archived',
            'success',
            kind === 'spam' ? 'Moved to Archived and reported as spam.' : 'Find it under Archived.',
          )
        }}
      />
    </div>
  )
}
