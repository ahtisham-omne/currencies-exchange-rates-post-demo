// Ported from chart-of-accounts-v2.1/src/components/comms/ChatPanel.tsx; adapted: the subject is a currency or an exchange rate (CommSubjectKind), and the seeded channels and messages talk about rates, rounding and activation.
/* The Chat half of the Communication tab, ported from the financial reporting
   module's `comms/ChatPanel.tsx`.

   That file is 5.6k lines and leans on Radix, shadcn, sonner and framer-motion,
   none of which exist here. What survives is the surface a reader actually
   works: the channel and DM column, the message stream with its day grouping
   and consecutive-message collapsing, reactions, threads, pins, attachments,
   and the composer. Everything cut is cut because it needed a dependency this
   app does not carry, or because it answered a prop this panel is not given.

   Colours are written as the source writes them, `var(--color-slate-500)` and
   friends, because the tab root carries `data-comms` and `index.css` declares
   that palette under it. Nothing here reaches for the COA scale, so the ported
   surface keeps the tones it was designed in.

   All state is local. The panel seeds its own fixtures from the record it is
   shown on, so two accounts do not share one conversation. */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, Archive, ArchiveRestore, AtSign, Bell, BellOff, Bold, Check,
  ChevronDown, CornerDownRight, Download, Filter, Forward, Hash, Italic, Link2,
  Lock, LogOut, MessageSquare, MoreHorizontal, PanelLeftClose, PanelLeftOpen,
  Paperclip, Pencil, Pin, PinOff, Plus, Search, Send, SlidersHorizontal,
  SmilePlus, Underline, Users as UsersIcon, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { CommSubjectKind } from '../../lib/comms'
import { useStore } from '../../store'
import { ConfirmModal, EmptyState, Input, Menu, MenuItem, Modal, Select, Toggle, Tooltip } from '../ui'
import { AttachmentCard, getFileInfo } from './AttachmentCard'
import { highlightMatch } from './highlightMatch'
import { MailboxPill } from './MailboxPill'
import { ColumnResizeHandle, useColumnResize } from './useColumnResize'

type ChannelType = 'public' | 'private' | 'dm'

interface User {
  id: string
  name: string
  initials: string
  email: string
  status: 'online' | 'away' | 'offline'
}

interface Reaction { emoji: string; users: string[] }

interface ThreadReply {
  id: string
  authorId: string
  authorName: string
  authorInitials: string
  text: string
  timestamp: string
  reactions: Reaction[]
}

interface ChatAttachment { name: string; size: string }

interface ChatMessage {
  id: string
  channelId: string
  authorId: string
  authorName: string
  authorInitials: string
  text: string
  timestamp: string
  isMe?: boolean
  reactions: Reaction[]
  replies: ThreadReply[]
  pinned?: boolean
  attachments?: ChatAttachment[]
  readBy: string[]
  edited?: boolean
}

interface Channel {
  id: string
  type: ChannelType
  name: string
  description?: string
  topic?: string
  members: string[]
  ownerId: string
  archived?: boolean
  pinned?: boolean
  muted?: boolean
  unreadCount: number
  lastActivity: string
  isOnline?: boolean
}

/* ── Fixtures ─────────────────────────────────────────────────────────────── */

const ME_ID = 'me'
const ME: User = { id: ME_ID, name: 'Ashmita Roy', initials: 'AR', email: 'ashmita.roy@company.com', status: 'online' }

const USERS: User[] = [
  ME,
  { id: 'marcus', name: 'Marcus Chen', initials: 'MC', email: 'marcus.chen@company.com', status: 'online' },
  { id: 'james', name: 'James Wright', initials: 'JW', email: 'james.wright@company.com', status: 'online' },
  { id: 'rachel', name: 'Rachel Kim', initials: 'RK', email: 'rachel.kim@company.com', status: 'away' },
  { id: 'tom', name: 'Tom Mitchell', initials: 'TM', email: 'tom.mitchell@company.com', status: 'offline' },
  { id: 'david', name: 'David Patel', initials: 'DP', email: 'david.patel@company.com', status: 'online' },
  { id: 'sarah', name: 'Sarah Henderson', initials: 'SH', email: 'sarah.henderson@company.com', status: 'online' },
  { id: 'drew', name: 'Drew Carter', initials: 'DC', email: 'drew.carter@company.com', status: 'away' },
  { id: 'emma', name: 'Emma Brooks', initials: 'EB', email: 'emma.brooks@company.com', status: 'online' },
]

const avatarColors = [
  { bg: 'var(--color-blue-100)', text: 'var(--color-blue-800)' }, { bg: 'var(--color-red-50)', text: 'var(--color-red-800)' },
  { bg: 'var(--color-emerald-100)', text: 'var(--color-emerald-800)' }, { bg: 'var(--color-amber-100)', text: 'var(--color-amber-800)' },
  { bg: 'var(--color-blue-100)', text: 'var(--color-indigo-800)' }, { bg: 'var(--color-red-200)', text: 'var(--color-red-800)' },
  { bg: 'var(--color-emerald-100)', text: 'var(--color-emerald-800)' }, { bg: 'var(--color-orange-200)', text: 'var(--color-orange-800)' },
  { bg: 'var(--color-violet-200)', text: 'var(--color-violet-800)' }, { bg: 'var(--color-brand-175)', text: 'var(--color-brand-800)' },
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

const QUICK_EMOJIS = ['👍', '❤️', '😄', '🎉', '🙏', '🔥', '👀', '✅']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function initialsOf(name: string) {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

/* ── Time ─────────────────────────────────────────────────────────────────── */

/** A date-only ISO parses as UTC midnight, which lands on the previous day west
 *  of Greenwich. Noon local keeps the day the record actually carries. */
function parseAnchor(iso: string): Date {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Timestamp for a message `daysBack` days before the record's own date. The
 *  stream is seeded around the record, not around the wall clock, so an account
 *  opened months later still reads as a conversation that happened when the
 *  record did. A stamp that lands on today or yesterday keeps the source's bare
 *  time / "Yesterday, …" shapes so `getDateGroup` still separates the days. */
function stampFor(anchor: Date, daysBack: number, time: string): string {
  const d = new Date(anchor)
  d.setDate(d.getDate() - daysBack)
  const today = new Date()
  if (sameDay(d, today)) return time
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (sameDay(d, yesterday)) return `Yesterday, ${time}`
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${time}`
}

function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Derive a date group label from a message timestamp string.
 *  Returns "Today", "Yesterday", or the timestamp prefix for older messages. */
function getDateGroup(timestamp: string): string {
  const lower = timestamp.toLowerCase()
  if (lower.startsWith('yesterday')) return 'Yesterday'
  if (timestamp.includes(',')) return timestamp.split(',')[0].trim()
  return 'Today'
}

/** Compact "Last reply …" label for thread reply previews. Mock timestamps are
 *  mostly strings like "1:45 PM" / "Yesterday, 4:00 PM" / "May 6, 9:30 AM", so
 *  this stays lightweight: collapse to today / yesterday / date prefix. */
function formatLastReplyTime(timestamp: string): string {
  const lower = timestamp.toLowerCase()
  if (lower.startsWith('yesterday')) return 'yesterday'
  if (timestamp.includes(',')) return timestamp.split(',')[0].trim()
  return 'today'
}

/* ── Small pieces ─────────────────────────────────────────────────────────── */

/** Round avatar for a person, square-ish tile for a channel. Stands in for the
 *  source's shadcn Avatar, which this app does not have. */
function Avatar({ name, initials, size = 'w-9 h-9', rounded = 'rounded-full', text = 'text-[11px]' }: {
  name: string
  initials?: string
  size?: string
  rounded?: string
  text?: string
}) {
  const color = getAvatarColor(name)
  return (
    <span
      className={cn('inline-flex items-center justify-center shrink-0 border border-[var(--color-mist-450)]', size, rounded, text)}
      style={{ backgroundColor: color.bg, color: color.text, fontWeight: 600 }}
    >
      {initials ?? initialsOf(name)}
    </span>
  )
}

/** Slack-style date separator */
function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-5 my-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] font-semibold text-fg-muted/70 bg-background px-2 rounded-full border border-border py-0.5">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

/** "Load older messages" pill at the top of the message list */
function LoadOlderMessages({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center py-3">
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border bg-background text-[12px] font-medium text-fg-muted hover:bg-bg-subtle hover:text-fg transition-colors"
      >
        <ChevronDown className="w-3 h-3 rotate-180" />
        Load Older Messages
      </button>
    </div>
  )
}

function ChannelIcon({ channel }: { channel: Channel }) {
  if (channel.type === 'private') return <Lock className="w-3.5 h-3.5" />
  if (channel.type === 'dm') return null
  return <Hash className="w-3.5 h-3.5" />
}

function PresenceDot({ status }: { status: 'online' | 'away' | 'offline' }) {
  const color = status === 'online' ? 'bg-emerald-500' : status === 'away' ? 'bg-amber-400' : 'bg-gray-300'
  return <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background', color)} />
}

function ReactionPill({ reaction, onClick }: { reaction: Reaction; onClick: () => void }) {
  const meReacted = reaction.users.includes(ME_ID)
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] transition-colors',
        meReacted ? 'border-[var(--color-sky-500)]/30 bg-[var(--color-brand-75)] text-[var(--color-sky-500)]' : 'border-border bg-background text-fg hover:bg-bg-subtle',
      )}
    >
      <span>{reaction.emoji}</span>
      <span style={{ fontWeight: 600 }}>{reaction.users.length}</span>
    </button>
  )
}

/** Mentions, channel references, bold, italic, links, and the search mark.
 *  The source also drew a typed chip for every record ID it recognised and
 *  routed it into the other module; there is nothing to route to here, so a
 *  record number in a message stays plain text. */
/* Opens a channel named in a message. A context rather than a prop because the
   text is drawn several components down from the panel that owns the channels. */
const OpenChannelContext = createContext<((name: string) => void) | null>(null)

function MessageRichText({ text, highlightQuery }: { text: string; highlightQuery?: string }) {
  const openChannel = useContext(OpenChannelContext)
  const splitRe = /(@[A-Z][A-Za-z]*(?:[\s ]+[A-Z][A-Za-z]*)*|#[\w-]+|\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/\S+)/g
  const parts = text.split(splitRe)
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null
        if (part.startsWith('@')) {
          return (
            <span key={i} className="text-[var(--color-sky-500)] font-semibold bg-[var(--color-brand-75)] rounded" style={{ padding: '1px 4px' }}>{part}</span>
          )
        }
        if (part.startsWith('#')) {
          return (
            <button key={i} type="button" onClick={() => openChannel?.(part.slice(1))} className="text-[var(--color-sky-500)] font-medium hover:underline cursor-pointer">{part}</button>
          )
        }
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
        if (part.startsWith('http')) return <a key={i} href={part} target="_blank" rel="noreferrer" className="text-[var(--color-sky-500)] underline hover:text-[var(--color-blue-650)]">{part}</a>
        return <span key={i}>{highlightQuery ? highlightMatch(part, highlightQuery) : part}</span>
      })}
    </>
  )
}

/** Attachments inside a sent message: a tinted type tile, the name, and
 *  "TYPE · size", with the download appearing on hover. The source's image
 *  branch and its full-screen preview are dropped; the Attachments tab uses
 *  this module's own `AttachmentCard`, which already previews. */
function ChatAttachments({ attachments }: { attachments: ChatAttachment[] }) {
  if (!attachments.length) return null
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {attachments.map((att, i) => <ChatAttachmentRow key={`${att.name}-${i}`} att={att} />)}
    </div>
  )
}

/** The files are fixtures, so the download hands back a stub with the same
 *  name rather than pretending to fetch bytes that were never uploaded. */
function downloadAttachment(name: string) {
  const blob = new Blob([`Mock attachment: ${name}\nGenerated by Omne.`], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ChatAttachmentRow({ att }: { att: ChatAttachment }) {
  const { type, color, bg, Icon } = getFileInfo(att.name)
  return (
    <div className="group/att inline-flex items-center gap-2.5 max-w-[360px] p-1.5 pr-2.5 rounded-lg border border-[var(--color-slate-200)] bg-white hover:border-[var(--color-slate-300)] transition-colors">
      <span className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] text-[var(--color-slate-900)] truncate" style={{ fontWeight: 600 }}>{att.name}</span>
        <span className="block text-[11px] text-[var(--color-slate-500)]">{type} · {att.size}</span>
      </span>
      <button
        type="button"
        onClick={() => downloadAttachment(att.name)}
        aria-label={`Download ${att.name}`}
        className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[var(--color-slate-400)] opacity-0 group-hover/att:opacity-100 hover:bg-[var(--color-slate-100)] hover:text-[var(--color-slate-600)] transition-all"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

/** Composer toolbar icon button. Neutral grey, no brand blue, matching the
 *  email compose toolbar. */
function FormatBtn({ active, onClick, icon: Icon, label }: {
  active?: boolean
  onClick: () => void
  icon: typeof Bold
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active || undefined}
      className={cn('p-1.5 rounded transition-colors', active ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200')}
      aria-label={label}
      title={label}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}

function SidebarSection({ label, expanded, onToggle, count, onAdd, addTooltip, children }: {
  label: string
  expanded: boolean
  onToggle: () => void
  count: number
  onAdd?: () => void
  addTooltip?: string
  children: React.ReactNode
}) {
  return (
    <div className="pt-3">
      <div className="flex items-center px-4 py-1.5">
        <button onClick={onToggle} className="flex items-center gap-1.5 flex-1 text-left">
          <ChevronDown className={cn('w-3 h-3 text-fg-muted/50 transition-transform', !expanded && '-rotate-90')} />
          <span className="text-[11px] font-semibold text-[var(--color-slate-500)]">{label}</span>
          <span
            className="min-w-[18px] h-[18px] rounded-full text-[10px] flex items-center justify-center px-1 font-semibold"
            style={{ backgroundColor: 'var(--color-slate-200)', color: 'var(--color-slate-600)' }}
          >
            {count}
          </span>
        </button>
        {onAdd && (
          <Tooltip content={addTooltip ?? `Add ${label}`}>
            <button
              onClick={onAdd}
              aria-label={addTooltip ?? `Add ${label}`}
              className="ml-1.5 w-7 h-7 flex items-center justify-center rounded-md border border-[var(--color-slate-200)] bg-white text-[var(--color-slate-500)] hover:text-[var(--color-sky-500)] hover:border-[var(--color-sky-500)]/30 hover:bg-[var(--color-brand-75)] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        )}
      </div>
      {expanded && <div className="mt-1.5 space-y-1.5 px-1.5">{children}</div>}
    </div>
  )
}

function ChannelItem({ channel, isSelected, onClick, density }: {
  channel: Channel
  isSelected: boolean
  onClick: () => void
  density: 'condensed' | 'comfort'
}) {
  const hasUnread = channel.unreadCount > 0
  const isCondensed = density === 'condensed'
  const avatarSize = isCondensed ? 'w-7 h-7' : 'w-9 h-9'
  const color = getAvatarColor(channel.name)
  return (
    <button
      onClick={onClick}
      className={cn(
        // Selected reads as a brand-blue-at-25% border with a soft blue spread;
        // hover is a lighter blue border with the same lift. The 16px gutter
        // lines the row's left border up with the search input and the section
        // headers above it.
        'w-full text-left flex items-center gap-3 transition-all duration-200 rounded-md mx-4 border',
        isCondensed ? 'px-2.5 py-1.5' : 'px-3 py-3',
        isSelected
          ? 'bg-[var(--color-blue-50)] border-[var(--color-sky-500)]/25'
          : 'bg-white border-[var(--color-mist-450)] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-[var(--color-blue-200)] hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]',
      )}
      style={{ width: 'calc(100% - 32px)' }}
    >
      <div className="relative shrink-0">
        {channel.type === 'dm' ? (
          <div className="relative">
            <Avatar name={channel.name} size={avatarSize} />
            <PresenceDot status={channel.isOnline ? 'online' : 'away'} />
          </div>
        ) : (
          <div
            className={cn(avatarSize, 'rounded-lg flex items-center justify-center border border-[var(--color-mist-450)]')}
            style={{ backgroundColor: color.bg, color: color.text }}
          >
            <ChannelIcon channel={channel} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[13px] truncate', hasUnread ? 'font-semibold text-fg' : 'font-medium text-fg/80')}>{channel.name}</span>
          {hasUnread && (
            <span className="min-w-[16px] h-[16px] rounded-full text-[10px] flex items-center justify-center px-1 font-bold shrink-0" style={{ backgroundColor: 'var(--color-sky-500)', color: 'var(--color-white)' }}>
              {channel.unreadCount}
            </span>
          )}
          {channel.muted && <BellOff className="w-3 h-3 text-fg-muted/50 shrink-0" />}
          {channel.pinned && <Pin className="w-3 h-3 text-[var(--color-sky-500)] shrink-0" style={{ fill: 'var(--color-sky-500)' }} />}
        </div>
        {!isCondensed && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-[var(--color-slate-400)] truncate">
              {channel.type === 'dm'
                ? (channel.isOnline ? 'Active now' : 'Away')
                : (channel.topic || `${channel.members.length} members`)}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}

function MessageBubble({
  message, showAvatar, isHighlighted, highlightQuery, onPin, onReact, onOpenThread, onForward,
  showEmojiPicker, onToggleEmojiPicker, onGoToMessage,
}: {
  message: ChatMessage
  showAvatar: boolean
  /** Temporary ring after the reader clicks "Go to message" on an attachment.
   *  The caller clears it on a timeout. */
  isHighlighted?: boolean
  /** Active in-conversation query. Matching substrings in the body and the
   *  author's name get the shared yellow mark. */
  highlightQuery?: string
  onPin: () => void
  onReact: (emoji: string) => void
  onOpenThread: () => void
  onForward: () => void
  showEmojiPicker: boolean
  onToggleEmojiPicker: () => void
  /** Set only in the Pins tab, where the row needs a way back to its place in
   *  the chronological stream. */
  onGoToMessage?: () => void
}) {
  // Which trigger opened the picker, so the popover anchors to that button
  // rather than always parking at the hover toolbar's corner.
  const [pickerSource, setPickerSource] = useState<'toolbar' | 'pill'>('toolbar')
  useEffect(() => { if (!showEmojiPicker) setPickerSource('toolbar') }, [showEmojiPicker])
  const openPicker = (source: 'toolbar' | 'pill') => {
    setPickerSource(source)
    onToggleEmojiPicker()
  }

  return (
    <div
      className={cn(
        'group relative flex items-start gap-2.5 px-5 py-2',
        // A pinned row keeps a slate wash so it reads as "kept" even when
        // scrolled past; hover deepens it so the row still says it is live.
        message.pinned ? 'bg-[var(--color-slate-50)] hover:bg-[var(--color-slate-100)]' : 'hover:bg-[var(--color-slate-50)]',
      )}
      style={isHighlighted
        ? { backgroundColor: 'var(--color-brand-75)', boxShadow: 'inset 3px 0 0 var(--color-sky-500)', transition: 'background-color 0.4s ease, box-shadow 0.4s ease' }
        : { transition: 'background-color 0.4s ease, box-shadow 0.4s ease' }}
    >
      <div className="w-8 shrink-0">
        {showAvatar && <Avatar name={message.authorName} initials={message.authorInitials} size="w-8 h-8" />}
      </div>
      <div className="flex-1 min-w-0">
        {showAvatar && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[13px] font-semibold">
              {highlightQuery ? highlightMatch(message.authorName, highlightQuery) : message.authorName}
            </span>
            <span className="text-[11px] text-[var(--color-slate-400)]">{message.timestamp}</span>
            {message.pinned && <Pin className="w-3 h-3 text-[var(--color-sky-500)]" style={{ fill: 'var(--color-sky-500)' }} />}
            {message.edited && <span className="text-[10px] text-fg-muted/60">(edited)</span>}
          </div>
        )}
        <p className="text-[13px] text-fg leading-relaxed"><MessageRichText text={message.text} highlightQuery={highlightQuery} /></p>
        {message.attachments && message.attachments.length > 0 && <ChatAttachments attachments={message.attachments} />}
        {message.reactions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {message.reactions.map((r, i) => <ReactionPill key={i} reaction={r} onClick={() => onReact(r.emoji)} />)}
            {/* The add-reaction pill gets its own positioning context so the
                popover anchors to the button, not to the full-width row. */}
            <div className="relative inline-flex">
              <Tooltip content="Add reaction…">
                <button onClick={() => openPicker('pill')} aria-label="Add reaction" className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-border bg-background text-fg-muted hover:bg-bg-subtle text-[11px]">
                  <SmilePlus className="w-3 h-3" />
                </button>
              </Tooltip>
              {showEmojiPicker && pickerSource === 'pill' && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-white border border-border rounded-lg shadow-lg p-2 flex flex-wrap gap-1 z-20 w-[200px]">
                  {QUICK_EMOJIS.map(em => (
                    <button key={em} onClick={() => onReact(em)} className="w-8 h-8 hover:bg-bg-subtle rounded text-base">{em}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {message.replies.length > 0 && (
          <button onClick={onOpenThread} className="inline-flex items-baseline gap-1.5 mt-2.5 text-[11px] hover:underline">
            <MessageSquare className="w-3 h-3 self-center text-[var(--color-sky-500)]" />
            <span className="text-[var(--color-sky-500)] font-medium">
              {message.replies.length} {message.replies.length === 1 ? 'reply' : 'replies'}
            </span>
            <span className="text-fg-muted/70 font-normal">
              · Last reply {formatLastReplyTime(message.replies[message.replies.length - 1].timestamp)}
            </span>
          </button>
        )}
      </div>

      {/* Reaction, reply in thread, forward and pin are the canonical four. */}
      <div className="absolute right-3 -top-3 hidden group-hover:flex items-center gap-0.5 bg-white border border-border rounded-md shadow-sm px-1 py-0.5 z-10">
        {onGoToMessage && (
          <Tooltip content="Go to message">
            <button onClick={onGoToMessage} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-subtle text-fg-muted" aria-label="Go to message"><CornerDownRight className="w-3.5 h-3.5" /></button>
          </Tooltip>
        )}
        <Tooltip content="Add reaction…">
          <button onClick={() => openPicker('toolbar')} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-subtle text-fg-muted" aria-label="Add reaction"><SmilePlus className="w-3.5 h-3.5" /></button>
        </Tooltip>
        <Tooltip content="Reply in thread">
          <button onClick={onOpenThread} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-subtle text-fg-muted" aria-label="Reply in thread"><MessageSquare className="w-3.5 h-3.5" /></button>
        </Tooltip>
        <Tooltip content="Forward">
          <button onClick={onForward} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-subtle text-fg-muted" aria-label="Forward"><Forward className="w-3.5 h-3.5" /></button>
        </Tooltip>
        <Tooltip content={message.pinned ? 'Unpin' : 'Pin'}>
          <button onClick={onPin} className={cn('w-6 h-6 flex items-center justify-center rounded hover:bg-bg-subtle', message.pinned ? 'text-[var(--color-sky-500)]' : 'text-fg-muted')} aria-label="Pin"><Pin className="w-3.5 h-3.5" /></button>
        </Tooltip>
      </div>

      {showEmojiPicker && pickerSource === 'toolbar' && (
        <div className="absolute right-3 top-5 bg-white border border-border rounded-lg shadow-lg p-2 flex flex-wrap gap-1 z-20 w-[200px]">
          {QUICK_EMOJIS.map(em => (
            <button key={em} onClick={() => onReact(em)} className="w-8 h-8 hover:bg-bg-subtle rounded text-base">{em}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/* Everything the reader has sent, flattened to message level across channels
   and DMs and grouped by date, so "who did I message and what did I say" is one
   scan rather than a walk through every conversation. */
function SentMessagesView({ groups, onOpen, highlightQuery }: {
  groups: { label: string; rows: { channel: Channel; message: ChatMessage }[] }[]
  onOpen: (channelId: string, messageId: string) => void
  highlightQuery?: string
}) {
  if (groups.length === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={<Send size={20} />}
        title="No sent messages yet"
        description="Anything you send across channels and direct messages will show up here."
      />
    )
  }
  const totalRows = groups.reduce((n, g) => n + g.rows.length, 0)
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      <div className="shrink-0 px-5 py-3 border-b border-border flex items-center gap-2">
        <Send className="w-4 h-4 text-[var(--color-sky-500)]" />
        <h3 className="text-[14px] font-semibold text-fg">Sent</h3>
        <span
          className="min-w-[18px] h-[18px] rounded-full text-[10px] flex items-center justify-center px-1.5"
          style={{ backgroundColor: 'var(--color-blue-100)', color: 'var(--color-blue-800)', fontWeight: 600 }}
        >
          {totalRows}
        </span>
        <span className="ml-auto text-[11.5px] text-fg-muted">
          All your outgoing messages across channels &amp; DMs
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        {groups.map(group => (
          <div key={group.label} className="mb-3">
            <div className="px-3 py-1.5 text-[11px] text-fg-muted" style={{ fontWeight: 600 }}>
              {group.label}
            </div>
            <div className="space-y-1">
              {group.rows.map(({ channel, message }) => {
                const isDm = channel.type === 'dm'
                const color = getAvatarColor(channel.name)
                return (
                  <button
                    key={`${channel.id}-${message.id}`}
                    type="button"
                    onClick={() => onOpen(channel.id, message.id)}
                    className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-slate-50)] transition-colors text-left"
                  >
                    {isDm ? (
                      <Avatar name={channel.name} />
                    ) : (
                      <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 border border-[var(--color-mist-450)]" style={{ backgroundColor: color.bg, color: color.text }}>
                        {channel.type === 'private' ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[13px] font-semibold text-fg truncate">
                          {isDm ? '' : channel.type === 'private' ? '' : '#'}
                          {highlightQuery ? highlightMatch(channel.name, highlightQuery) : channel.name}
                        </span>
                        <span className="ml-auto shrink-0 text-[11px] text-[var(--color-slate-400)]">{message.timestamp}</span>
                      </div>
                      <p className="text-[12.5px] text-[var(--color-slate-600)] leading-snug mt-0.5 line-clamp-2">
                        {highlightQuery ? highlightMatch(message.text, highlightQuery) : message.text}
                      </p>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-fg-muted">
                          <Paperclip className="w-3 h-3" />
                          <span>{message.attachments.length} attachment{message.attachments.length === 1 ? '' : 's'}</span>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Seed ─────────────────────────────────────────────────────────────────── */

function slugify(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').replace(/-+$/, '').slice(0, 32)
}

/** The workspace a currency reader sits in. The record's own channel is pinned
 *  and first, because that is the conversation the tab was opened to read; the
 *  rest is the standing treasury and rates traffic around it. */
function seedChannels(subjectId: string, kind: CommSubjectKind, label: string): Channel[] {
  const recordId = `record-${subjectId}`
  const isCurrency = kind === 'currency' || kind === 'base'
  return [
    {
      id: recordId,
      type: 'public',
      name: `${isCurrency ? 'currency' : 'rate'}-${slugify(label)}`,
      description: label,
      topic: isCurrency
        ? 'Activation, decimal places and rate questions for this currency'
        : 'Rate changes, variance reviews and approvals for this rate',
      members: [ME_ID, 'marcus', 'rachel', 'david', 'james'],
      ownerId: ME_ID,
      pinned: true,
      unreadCount: 2,
      lastActivity: 'Today',
    },
    {
      id: 'treasury-ops',
      type: 'public',
      name: 'treasury-ops',
      description: 'Treasury and payments',
      topic: 'Payment runs, bank rates and settlements',
      members: [ME_ID, 'marcus', 'rachel', 'david', 'sarah', 'tom'],
      ownerId: 'marcus',
      unreadCount: 3,
      lastActivity: 'Today',
    },
    {
      id: 'fx-rates',
      type: 'public',
      name: 'fx-rates',
      description: 'Rate maintenance',
      topic: 'Corporate rates, provider syncs and variance thresholds',
      members: [ME_ID, 'james', 'rachel', 'emma', 'drew'],
      ownerId: 'james',
      unreadCount: 0,
      lastActivity: 'Yesterday',
    },
    {
      id: 'month-end-close',
      type: 'private',
      name: 'month-end-close',
      description: 'Close checklist and sign offs',
      topic: 'Revaluation, closing rates and sign offs',
      members: [ME_ID, 'marcus', 'sarah'],
      ownerId: ME_ID,
      muted: true,
      unreadCount: 0,
      lastActivity: 'Yesterday',
    },
    {
      id: 'audit-prep',
      type: 'public',
      name: 'audit-prep',
      description: 'Prior year audit requests',
      topic: 'Prior year requests and sampled rates',
      members: [ME_ID, 'sarah', 'tom', 'emma'],
      ownerId: 'sarah',
      archived: true,
      unreadCount: 0,
      lastActivity: 'Mar 4',
    },
    { id: 'dm-marcus', type: 'dm', name: 'Marcus Chen', members: [ME_ID, 'marcus'], ownerId: ME_ID, unreadCount: 1, lastActivity: 'Today', isOnline: true },
    { id: 'dm-rachel', type: 'dm', name: 'Rachel Kim', members: [ME_ID, 'rachel'], ownerId: ME_ID, unreadCount: 0, lastActivity: 'Today', isOnline: false },
    { id: 'dm-james', type: 'dm', name: 'James Wright', members: [ME_ID, 'james'], ownerId: ME_ID, unreadCount: 0, lastActivity: 'Yesterday', isOnline: true },
    { id: 'dm-david', type: 'dm', name: 'David Patel', members: [ME_ID, 'david'], ownerId: ME_ID, unreadCount: 0, lastActivity: 'Mar 3', isOnline: true },
  ]
}

/** One helper so a fixture line names a person once and the id, display name
 *  and initials all follow from it. */
function msg(
  channelId: string,
  authorId: string,
  text: string,
  timestamp: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  const u = USERS.find(x => x.id === authorId) ?? ME
  return {
    id: `${channelId}-${authorId}-${timestamp.replace(/[^a-z0-9]/gi, '')}-${text.length}`,
    channelId,
    authorId,
    authorName: u.name,
    authorInitials: u.initials,
    text,
    timestamp,
    ...(authorId === ME_ID ? { isMe: true } : {}),
    reactions: [],
    replies: [],
    readBy: [ME_ID],
    ...extra,
  }
}

function reply(authorId: string, text: string, timestamp: string, reactions: Reaction[] = []): ThreadReply {
  const u = USERS.find(x => x.id === authorId) ?? ME
  return { id: `r-${authorId}-${text.length}-${timestamp.length}`, authorId, authorName: u.name, authorInitials: u.initials, text, timestamp, reactions }
}

function seedMessages(
  subjectId: string,
  kind: CommSubjectKind,
  label: string,
  anchorIso: string,
): Record<string, ChatMessage[]> {
  const anchor = parseAnchor(anchorIso)
  const t = (daysBack: number, time: string) => stampFor(anchor, daysBack, time)
  const rid = `record-${subjectId}`
  const isCurrency = kind === 'currency' || kind === 'base'
  const code = label.split(' ')[0].split('/')[0]

  return {
    [rid]: [
      msg(rid, 'james', `Opened this for ${label}. Anything that changes how it is rated, rounded or offered on documents, put it here rather than in a DM so the trail sits with the record.`, t(9, '9:04 AM')),
      msg(rid, 'rachel', isCurrency
        ? `Question on rounding. ${code} invoices from the new supplier come in with three decimals, but we hold ${code} to its ISO decimal places, so a few cents drop on every entry.`
        : `Question on this one. The corporate rate is further from the mid-market rate than it was last month. Worth a look before the payment run uses it.`,
        t(6, '11:22 AM'),
        { reactions: [{ emoji: '👀', users: ['marcus', 'me'] }] }),
      msg(rid, 'me', isCurrency
        ? '@Rachel Kim agreed, the ISO setting stays. The difference goes to FX rounding at month end, so it never sits on the supplier balance.'
        : '@Rachel Kim good catch. I will pull the mid-market history and check the variance before anything posts at this rate.',
        t(6, '11:41 AM')),
      msg(rid, 'marcus', isCurrency
        ? 'Before anyone changes anything: check whether there are **open documents** in this currency. A currency with open documents cannot be deactivated, and a rounding change mid-period moves balances people have already agreed.'
        : 'Before it is updated, confirm the **effective date**. Backdating past a closed period means every document since then was booked at the old rate.',
        t(6, '2:15 PM'),
        {
          pinned: true,
          reactions: [{ emoji: '✅', users: ['me', 'rachel'] }, { emoji: '🙏', users: ['david'] }],
          replies: [
            reply('me', isCurrency ? 'There are open documents, so nothing changes until they clear. I will note it on the currency.' : 'Effective from the first of next month, so nothing already booked moves. I will draft it.', t(6, '2:34 PM'), [{ emoji: '👍', users: ['marcus'] }]),
            reply('rachel', 'Send me the figures when they are ready and I will tie them back to the bank rates.', t(5, '9:12 AM')),
            reply('marcus', 'One change, one note. Do not split it across two edits or the reviewer will chase both.', t(5, '9:40 AM')),
          ],
        }),
      msg(rid, 'david', 'Pulled the mid-market and corporate rates for the last three months so we can see how far apart they have been.', t(3, '10:07 AM'), {
        attachments: [{ name: `${code}_Rate_History_Q1.xlsx`, size: '184 KB' }],
        reactions: [{ emoji: '🔥', users: ['me'] }],
      }),
      msg(rid, 'me', 'Thanks David. Reading it now, will come back with a proposal this afternoon.', t(3, '10:19 AM')),
      msg(rid, 'marcus', 'Reminder that whatever we land on has to hold at month end too, otherwise the revaluation moves for no reason a reader can see.', t(1, '4:02 PM'), {
        readBy: [],
      }),
      msg(rid, 'rachel', `Figures tie out to the bank rates. Happy for this to go through on ${label}.`, t(0, '9:31 AM'), {
        readBy: [],
        reactions: [{ emoji: '🎉', users: ['me', 'david'] }],
      }),
    ],
    'treasury-ops': [
      msg('treasury-ops', 'sarah', 'Payment run is clear as of last night. Two foreign payments bounced on a currency that had been deactivated, both from the same requester.', t(4, '8:47 AM')),
      msg('treasury-ops', 'marcus', 'I will talk to them. An inactive currency is not a validation to argue with, it is a decision to respect.', t(4, '9:02 AM'), {
        reactions: [{ emoji: '😄', users: ['sarah', 'rachel'] }],
      }),
      msg('treasury-ops', 'tom', 'Bank settlement rates agree to ours through the anchor date. One difference, a fee the bank took in the foreign currency.', t(2, '3:18 PM'), {
        replies: [
          reply('me', 'Raise it in #fx-rates and I will look at it. Do not net it into the rate, we will never find it again.', t(2, '3:41 PM'), [{ emoji: '👍', users: ['tom'] }]),
          reply('tom', 'Raised. Thanks.', t(2, '3:55 PM')),
        ],
      }),
      msg('treasury-ops', 'me', 'Rate calendar for the quarter is up. Corporate rates change on the first working day, not the calendar day, so plan the payment runs around it.', t(1, '11:05 AM'), {
        attachments: [{ name: 'Rate_Calendar.pdf', size: '96 KB' }],
      }),
      msg('treasury-ops', 'sarah', 'Noted. I will move the large payments a day earlier so they do not land on the changeover itself.', t(0, '8:12 AM'), { readBy: [] }),
      msg('treasury-ops', 'marcus', '@Ashmita Roy can you confirm the corporate rates are agreed with treasury before we lock? Last quarter they were not and it cost us two days.', t(0, '10:44 AM'), { readBy: [] }),
      msg('treasury-ops', 'david', 'Agreed with treasury this morning. Every pair is inside its variance threshold.', t(0, '10:58 AM'), {
        readBy: [],
        reactions: [{ emoji: '🙏', users: ['marcus'] }],
      }),
    ],
    'fx-rates': [
      msg('fx-rates', 'james', 'Two rules for this channel. A corporate rate needs an effective date and an approval before it needs a number. And no rate gets changed because one invoice looked wrong.', t(7, '9:15 AM'), {
        pinned: true,
        reactions: [{ emoji: '✅', users: ['me', 'rachel', 'emma'] }],
      }),
      msg('fx-rates', 'emma', 'Request: a corporate rate for a currency we have only ever paid at the mid-market rate. Tom found a supplier invoicing in it.', t(2, '4:06 PM')),
      msg('fx-rates', 'me', 'Approved. It goes live from the first of next month, quoted against the base like every other pair, so nothing already booked moves.', t(2, '4:29 PM'), {
        reactions: [{ emoji: '👍', users: ['emma', 'james'] }],
      }),
      msg('fx-rates', 'drew', 'Also worth saying: three currencies have had no documents in two years and are still active. Deactivation candidates.', t(1, '1:33 PM'), {
        replies: [
          reply('james', 'Deactivate them and leave them a period. If nothing complains, they stay off.', t(1, '1:52 PM')),
        ],
      }),
    ],
    'month-end-close': [
      msg('month-end-close', 'marcus', 'Checklist for this close is the same as last, with one addition: the rate change on the record channel has to be signed off before we revalue.', t(3, '9:00 AM'), { pinned: true }),
      msg('month-end-close', 'me', 'I will own that one. Rachel is tying it back today.', t(3, '9:14 AM')),
      msg('month-end-close', 'sarah', 'Revaluation is run and posted. Closing rates agree to the provider.', t(1, '5:02 PM'), {
        attachments: [{ name: 'Closing_Rates.csv', size: '42 KB' }],
        reactions: [{ emoji: '👍', users: ['marcus'] }],
      }),
    ],
    'audit-prep': [
      msg('audit-prep', 'sarah', 'Prior year requests are all answered. Archiving this so the list stays honest, and we will open a fresh one when the new sample lands.', t(12, '2:20 PM'), {
        reactions: [{ emoji: '🙏', users: ['me', 'tom'] }],
      }),
      msg('audit-prep', 'tom', 'Sampled rates and their approvals are in the shared folder if anyone needs them later.', t(12, '2:45 PM')),
    ],
    'dm-marcus': [
      msg('dm-marcus', 'marcus', `Had a look at ${label}. My worry is not the rate, it is that two people have a different idea of when it should change.`, t(5, '7:58 AM')),
      msg('dm-marcus', 'me', 'Same worry. I will write the review rule on the record itself so it stops being folklore.', t(5, '8:11 AM'), {
        reactions: [{ emoji: '👍', users: ['marcus'] }],
      }),
      msg('dm-marcus', 'marcus', 'Good. Also, when the new rate is drafted, send it to me before Rachel sees it. I would rather catch a wrong decimal than explain one.', t(0, '7:41 AM'), { readBy: [] }),
    ],
    'dm-rachel': [
      msg('dm-rachel', 'rachel', 'Bank rates tie. The only difference is the fee we already know about.', t(2, '11:02 AM')),
      msg('dm-rachel', 'me', 'Perfect. I will set the rate and you can re-run.', t(2, '11:15 AM')),
      msg('dm-rachel', 'rachel', 'Re-run is clean. Sending you the tie out so it is on the record rather than in a chat.', t(0, '9:28 AM'), {
        attachments: [{ name: 'Bank_Rate_Tieout.pdf', size: '211 KB' }],
        reactions: [{ emoji: '🎉', users: ['me'] }],
      }),
    ],
    'dm-james': [
      msg('dm-james', 'james', 'The decimals question again: someone wants to show four decimal places on a currency that settles at two.', t(3, '1:12 PM')),
      msg('dm-james', 'me', 'No. The ISO setting is what the bank settles at, so extra decimals buy a precision nobody can pay in.', t(3, '1:26 PM'), {
        reactions: [{ emoji: '✅', users: ['james'] }],
      }),
      msg('dm-james', 'james', 'That is what I told them. Wanted it in writing from you.', t(1, '10:03 AM')),
    ],
    'dm-david': [
      msg('dm-david', 'david', 'Rate extract is attached. Three months, mid-market and corporate side by side.', t(3, '10:05 AM'), {
        attachments: [{ name: `${code}_Rate_History_Q1.xlsx`, size: '184 KB' }],
      }),
      msg('dm-david', 'me', 'Exactly what I needed, thanks.', t(3, '10:20 AM')),
    ],
  }
}

/* Older history, generated on demand behind the "Load older messages" pill.
   Each click walks a batch further back, so the stream has somewhere to go
   without the seed carrying a hundred rows nobody reads. */
const OLDER_MSG_POOL: { authorId: string; text: string }[] = [
  { authorId: 'marcus', text: 'Picking this up from where we left it: the review rule has not changed, only who knows about it.' },
  { authorId: 'rachel', text: 'Rate tie out for the prior month is filed. No open items.' },
  { authorId: 'james', text: 'A reminder that a corporate rate with no effective date is not a rate, it is a draft.' },
  { authorId: 'david', text: 'Rate history for the prior quarter is in the shared folder if anyone wants to compare.' },
  { authorId: 'me', text: 'Agreed. Let us keep the decision here rather than re-litigating it next period.' },
  { authorId: 'sarah', text: 'Nothing outstanding from my side. Payment run was clear at the cut off.' },
  { authorId: 'tom', text: 'Bank side agrees. One timing difference that cleared the next day.' },
  { authorId: 'emma', text: 'Request from the reporting side: they want closing rates named the same way in both packs.' },
]

const DM_OLDER_POOL: { authorId: string; text: string }[] = [
  { authorId: 'marcus', text: 'Quick one before the call: is the rate settled or still open?' },
  { authorId: 'me', text: 'Settled. I wrote the review rule on the record so it stops moving.' },
  { authorId: 'marcus', text: 'Good. That is the part that keeps coming back.' },
  { authorId: 'me', text: 'Will send the extract once David has pulled it.' },
]

function generateOlderMessages(channel: Channel, anchor: Date, batch: number): ChatMessage[] {
  const pool = channel.type === 'dm' ? DM_OLDER_POOL : OLDER_MSG_POOL
  // Batch 1 sits just behind the seed, batch 2 behind that, and so on.
  const base = 14 + batch * 7
  return pool.map((p, i) => {
    const daysBack = base + (pool.length - i)
    const hour = 8 + (i % 8)
    return msg(
      channel.id,
      p.authorId,
      p.text,
      stampFor(anchor, daysBack, `${hour > 12 ? hour - 12 : hour}:${String((i * 7) % 60).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`),
      { id: `older-${channel.id}-${batch}-${i}` },
    )
  })
}

/* ── Date filter ──────────────────────────────────────────────────────────── */

/** Turn a fixture timestamp back into a date so the date-range filter is a
 *  real control rather than a label. "9:02 AM" is today, "Yesterday, …" is
 *  yesterday, "Mar 17, …" is that day in the nearest year not in the future. */
function timestampToDate(timestamp: string): Date | null {
  const today = new Date()
  const lower = timestamp.toLowerCase()
  if (lower.startsWith('yesterday')) {
    const d = new Date(today)
    d.setDate(d.getDate() - 1)
    return d
  }
  if (!timestamp.includes(',')) return today
  const head = timestamp.split(',')[0].trim()
  const parts = head.split(/\s+/)
  const month = MONTHS.indexOf(parts[0])
  const day = Number(parts[1])
  if (month < 0 || !Number.isFinite(day)) return null
  const d = new Date(today.getFullYear(), month, day)
  if (d.getTime() > today.getTime()) d.setFullYear(d.getFullYear() - 1)
  return d
}

function withinRange(timestamp: string, range: 'today' | 'week' | 'month'): boolean {
  const d = timestampToDate(timestamp)
  if (!d) return true
  const today = new Date()
  const days = Math.floor((today.getTime() - d.getTime()) / 86400000)
  if (range === 'today') return sameDay(d, today)
  if (range === 'week') return days <= 7
  return days <= 31
}

type ChatListTab = 'all' | 'sent' | 'archived'
type ChatViewTab = 'messages' | 'pins' | 'attachments'
interface ChatFilters { sender?: string; dateRange?: 'today' | 'week' | 'month' }

interface ComposeRecipient {
  id: string
  name: string
  subtitle?: string
  type: 'dm' | 'channel-public' | 'channel-private'
  group: string
}

/* ── Panel ────────────────────────────────────────────────────────────────── */

export function ChatPanel({ subjectId, kind, label, anchorIso, density, composeOpen, onComposeClose }: {
  subjectId: string
  kind: CommSubjectKind
  label: string
  anchorIso: string
  density: 'condensed' | 'comfort'
  composeOpen: boolean
  onComposeClose: () => void
}) {
  const anchor = useMemo(() => parseAnchor(anchorIso), [anchorIso])
  const recordChannelId = `record-${subjectId}`

  const [channels, setChannels] = useState<Channel[]>(() => seedChannels(subjectId, kind, label))
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(() => seedMessages(subjectId, kind, label, anchorIso))
  const [selectedChannelId, setSelectedChannelId] = useState(recordChannelId)

  /* The tab is mounted per record, but a router that keeps the component alive
     across two accounts would otherwise show the first one's conversation on
     the second one's page. Re-seed when the record identity changes. */
  const seedKey = `${subjectId}|${kind}|${label}|${anchorIso}`
  const lastSeedKey = useRef(seedKey)
  useEffect(() => {
    if (lastSeedKey.current === seedKey) return
    lastSeedKey.current = seedKey
    setChannels(seedChannels(subjectId, kind, label))
    setMessages(seedMessages(subjectId, kind, label, anchorIso))
    setSelectedChannelId(`record-${subjectId}`)
  }, [seedKey, subjectId, kind, label, anchorIso])

  const [chatListTab, setChatListTab] = useState<ChatListTab>('all')
  const [chatViewTab, setChatViewTab] = useState<ChatViewTab>('messages')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [pinnedExpanded, setPinnedExpanded] = useState(true)
  const [groupsExpanded, setGroupsExpanded] = useState(true)
  const [dmsExpanded, setDmsExpanded] = useState(true)
  const [globalSearch, setGlobalSearch] = useState('')

  const [searchInConversation, setSearchInConversation] = useState(false)
  const [searchQueryInput, setSearchQueryInput] = useState('')
  const [filters, setFilters] = useState<ChatFilters>({})
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [forwardTargetMessage, setForwardTargetMessage] = useState<ChatMessage | null>(null)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showChannelDetails, setShowChannelDetails] = useState(false)
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [archiveConfirmChannelId, setArchiveConfirmChannelId] = useState<string | null>(null)
  const [leaveConfirmChannelId, setLeaveConfirmChannelId] = useState<string | null>(null)

  const [threadOpenFor, setThreadOpenFor] = useState<string | null>(null)
  const [threadReplyText, setThreadReplyText] = useState('')
  const [emojiPickerForMessage, setEmojiPickerForMessage] = useState<string | null>(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

  const [inputText, setInputText] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([])
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set())
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionType, setMentionType] = useState<'@' | '#'>('@')
  const [mentionQuery, setMentionQuery] = useState('')
  const [olderLoadCount, setOlderLoadCount] = useState<Record<string, number>>({})

  const [localComposeOpen, setLocalComposeOpen] = useState(false)
  const [composeRecipient, setComposeRecipient] = useState<ComposeRecipient | null>(null)
  const [composeQuery, setComposeQuery] = useState('')
  const [composeDropdownOpen, setComposeDropdownOpen] = useState(false)

  const chatRootRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerWrapperRef = useRef<HTMLDivElement>(null)
  const composeSearchRef = useRef<HTMLInputElement>(null)
  const threadReplyRef = useRef<HTMLDivElement>(null)
  const loadOlderAnchorRef = useRef<{ el: HTMLElement; prevHeight: number; prevTop: number } | null>(null)

  const { widthPercent: leftWidthPercent, isResizing: isLeftResizing, onMouseDown: onLeftResizeStart } =
    useColumnResize({ containerRef: chatRootRef })

  const isComposeOpen = composeOpen || localComposeOpen
  const closeCompose = () => {
    setLocalComposeOpen(false)
    setComposeRecipient(null)
    setComposeQuery('')
    setComposeDropdownOpen(false)
    onComposeClose()
  }

  /* ── Lists ── */
  const myChannels = useMemo(() => channels.filter(c => c.members.includes(ME_ID)), [channels])

  const searchedChannels = useMemo(() => {
    const q = globalSearch.trim().toLowerCase()
    if (!q) return myChannels
    return myChannels.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.topic ?? '').toLowerCase().includes(q) ||
      (c.description ?? '').toLowerCase().includes(q))
  }, [myChannels, globalSearch])

  const listChannels = useMemo(
    () => searchedChannels.filter(c => (chatListTab === 'archived' ? !!c.archived : !c.archived)),
    [searchedChannels, chatListTab],
  )
  const pinnedChannels = listChannels.filter(c => c.pinned)
  const groupChannels = listChannels.filter(c => !c.pinned && c.type !== 'dm')
  const dmChannels = listChannels.filter(c => !c.pinned && c.type === 'dm')

  const sentRows = useMemo(() => {
    const rows: { channel: Channel; message: ChatMessage }[] = []
    for (const c of myChannels) {
      if (c.archived) continue
      for (const m of messages[c.id] ?? []) if (m.authorId === ME_ID) rows.push({ channel: c, message: m })
    }
    return rows
  }, [myChannels, messages])

  const chatTabCounts = {
    all: searchedChannels.filter(c => !c.archived).length,
    sent: sentRows.length,
    archived: searchedChannels.filter(c => !!c.archived).length,
  }

  const sentMessagesByGroup = useMemo(() => {
    const q = globalSearch.trim().toLowerCase()
    const rows = q
      ? sentRows.filter(r => r.message.text.toLowerCase().includes(q) || r.channel.name.toLowerCase().includes(q))
      : sentRows
    const order: string[] = []
    const byGroup = new Map<string, { channel: Channel; message: ChatMessage }[]>()
    for (const row of rows) {
      const g = getDateGroup(row.message.timestamp)
      if (!byGroup.has(g)) { byGroup.set(g, []); order.push(g) }
      byGroup.get(g)!.push(row)
    }
    return order.map(g => ({ label: g, rows: byGroup.get(g)! }))
  }, [sentRows, globalSearch])

  const selected = channels.find(c => c.id === selectedChannelId) ?? null
  const showSentList = chatListTab === 'sent' && !selected
  const channelMessages = messages[selectedChannelId] ?? []

  const filteredMessages = useMemo(() => {
    let msgs = channelMessages
    if (filters.sender) msgs = msgs.filter(m => m.authorId === filters.sender)
    if (filters.dateRange) {
      const range = filters.dateRange
      msgs = msgs.filter(m => withinRange(m.timestamp, range))
    }
    if (searchInConversation) {
      const q = searchQueryInput.trim().toLowerCase()
      if (q) msgs = msgs.filter(m => m.text.toLowerCase().includes(q) || m.authorName.toLowerCase().includes(q))
    }
    return msgs
  }, [channelMessages, filters, searchInConversation, searchQueryInput])

  const pinnedMessages = channelMessages.filter(m => m.pinned)

  const allChannelAttachments = useMemo(
    () => channelMessages.flatMap(m => (m.attachments ?? []).map(att => ({ ...att, sender: m.authorName, timestamp: m.timestamp, messageId: m.id }))),
    [channelMessages],
  )

  /* ── Channel actions ── */
  const togglePinChannel = (id: string) => setChannels(prev => prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c))
  const toggleMuteChannel = (id: string) => setChannels(prev => prev.map(c => c.id === id ? { ...c, muted: !c.muted } : c))
  const toggleArchiveChannel = (id: string) => setChannels(prev => prev.map(c => c.id === id ? { ...c, archived: !c.archived } : c))

  /** Leaving is per person: the channel stays for everyone else, which is what
   *  separates it from archiving. */
  const leaveChannel = (id: string) => {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, members: c.members.filter(m => m !== ME_ID) } : c))
    if (selectedChannelId === id) setSelectedChannelId('')
  }

  const markAllRead = (id: string) => {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c))
    setMessages(prev => ({ ...prev, [id]: (prev[id] ?? []).map(m => ({ ...m, readBy: Array.from(new Set([...m.readBy, ME_ID])) })) }))
  }

  const updateChannel = (id: string, patch: Partial<Channel>) =>
    setChannels(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))

  const createChannel = (draft: { name: string; description: string; private: boolean; members: string[] }) => {
    const id = `ch-${Date.now()}`
    setChannels(prev => [...prev, {
      id,
      type: draft.private ? 'private' : 'public',
      name: draft.name,
      description: draft.description || undefined,
      members: [ME_ID, ...draft.members],
      ownerId: ME_ID,
      unreadCount: 0,
      lastActivity: 'Today',
    }])
    setMessages(prev => ({ ...prev, [id]: [] }))
    setShowCreateChannel(false)
    setChatListTab('all')
    setSelectedChannelId(id)
  }

  /* ── Message actions ── */
  const togglePinMessage = (msgId: string) =>
    setMessages(prev => ({ ...prev, [selectedChannelId]: (prev[selectedChannelId] ?? []).map(m => m.id === msgId ? { ...m, pinned: !m.pinned } : m) }))

  const addReaction = (msgId: string, emoji: string) => {
    setMessages(prev => ({
      ...prev,
      [selectedChannelId]: (prev[selectedChannelId] ?? []).map(m => {
        if (m.id !== msgId) return m
        const existing = m.reactions.find(r => r.emoji === emoji)
        if (existing) {
          const hasMe = existing.users.includes(ME_ID)
          return {
            ...m,
            reactions: hasMe
              ? m.reactions.map(r => r.emoji === emoji ? { ...r, users: r.users.filter(u => u !== ME_ID) } : r).filter(r => r.users.length > 0)
              : m.reactions.map(r => r.emoji === emoji ? { ...r, users: [...r.users, ME_ID] } : r),
          }
        }
        return { ...m, reactions: [...m.reactions, { emoji, users: [ME_ID] }] }
      }),
    }))
    setEmojiPickerForMessage(null)
  }

  /** Strip the composer's markup back to text. The contentEditable can hold
   *  formatting spans and a stray <br>; the fixtures are plain strings, so what
   *  is sent has to be one too or the bubble renders tags. */
  const plainFromComposer = (html: string) =>
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(div|p)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()

  const sendMessage = () => {
    if (!selectedChannelId) return
    const text = plainFromComposer(inputRef.current?.innerHTML ?? '')
    if (!text && pendingAttachments.length === 0) return
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      channelId: selectedChannelId,
      authorId: ME_ID,
      authorName: ME.name,
      authorInitials: ME.initials,
      text,
      timestamp: nowTime(),
      isMe: true,
      reactions: [],
      replies: [],
      readBy: [ME_ID],
      ...(pendingAttachments.length > 0 ? { attachments: pendingAttachments } : {}),
    }
    setMessages(prev => ({ ...prev, [selectedChannelId]: [...(prev[selectedChannelId] ?? []), newMsg] }))
    setInputText('')
    setDrafts(prev => ({ ...prev, [selectedChannelId]: '' }))
    setPendingAttachments([])
    if (inputRef.current) inputRef.current.innerHTML = ''
    // The reader is now looking at the resolved conversation, so compose is done.
    if (isComposeOpen) closeCompose()
  }

  const sendThreadReply = (parentId: string, text: string) => {
    if (!text.trim()) return
    const newReply: ThreadReply = {
      id: `r-${Date.now()}`,
      authorId: ME_ID,
      authorName: ME.name,
      authorInitials: ME.initials,
      text: text.trim(),
      timestamp: nowTime(),
      reactions: [],
    }
    setMessages(prev => ({
      ...prev,
      [selectedChannelId]: (prev[selectedChannelId] ?? []).map(m => m.id === parentId ? { ...m, replies: [...m.replies, newReply] } : m),
    }))
    setThreadReplyText('')
  }

  const forwardMessage = (msgToSend: ChatMessage, targetChannelId: string) => {
    const fwd: ChatMessage = {
      id: `msg-${Date.now()}`,
      channelId: targetChannelId,
      authorId: ME_ID,
      authorName: ME.name,
      authorInitials: ME.initials,
      text: `Forwarded from #${channels.find(c => c.id === msgToSend.channelId)?.name}: "${msgToSend.text}"`,
      timestamp: nowTime(),
      isMe: true,
      reactions: [],
      replies: [],
      readBy: [ME_ID],
    }
    setMessages(prev => ({ ...prev, [targetChannelId]: [...(prev[targetChannelId] ?? []), fwd] }))
    setForwardTargetMessage(null)
    // The forward lands in another channel, out of sight, so it says where.
    const target = channels.find(c => c.id === targetChannelId)
    useStore.getState().pushToast(`Forwarded to ${target ? `#${target.name}` : 'the channel'}`, 'success')
  }

  const goToChatMessage = (messageId: string) => {
    setChatViewTab('messages')
    setHighlightedMessageId(messageId)
    window.setTimeout(() => {
      const el = document.querySelector(`[data-chat-message-id="${messageId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
    window.setTimeout(() => setHighlightedMessageId(null), 2400)
  }

  const handleLoadOlder = () => {
    if (!selected) return
    const el = messagesScrollRef.current
    if (el) loadOlderAnchorRef.current = { el, prevHeight: el.scrollHeight, prevTop: el.scrollTop }
    const batch = (olderLoadCount[selectedChannelId] ?? 0) + 1
    setOlderLoadCount(prev => ({ ...prev, [selectedChannelId]: batch }))
    setMessages(prev => ({
      ...prev,
      [selectedChannelId]: [...generateOlderMessages(selected, anchor, batch), ...(prev[selectedChannelId] ?? [])],
    }))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    // Staged, not sent: the files ride along with the next message rather than
    // firing one message per file.
    const formatBytes = (n: number) => {
      if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
      if (n >= 1024) return `${Math.round(n / 1024)} KB`
      return `${n} B`
    }
    setPendingAttachments(prev => [...prev, ...Array.from(files).map(f => ({ name: f.name, size: formatBytes(f.size) }))])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const exportConversation = () => {
    if (!selected) return
    const rows = [
      ['Timestamp', 'Author', 'Message', 'Has Attachments'].join(','),
      ...channelMessages.map(m => [
        `"${m.timestamp}"`,
        `"${m.authorName}"`,
        `"${m.text.replace(/"/g, '""')}"`,
        m.attachments && m.attachments.length > 0 ? 'Yes' : 'No',
      ].join(',')),
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-${selected.name}-export.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ── Formatting and mentions ── */
  const updateFormats = () => {
    const fmts = new Set<string>()
    if (document.queryCommandState('bold')) fmts.add('bold')
    if (document.queryCommandState('italic')) fmts.add('italic')
    if (document.queryCommandState('underline')) fmts.add('underline')
    setActiveFormats(fmts)
  }
  const execFormat = (cmd: string) => {
    document.execCommand(cmd, false)
    inputRef.current?.focus()
    updateFormats()
  }
  const placeCursorAtEnd = () => {
    const root = inputRef.current
    if (!root) return
    const range = document.createRange()
    range.selectNodeContents(root)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  const handleComposerInput = (e: React.FormEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    setInputText(el.innerHTML)
    const text = el.textContent ?? ''
    // Only the token the caret is sitting in matters, so read back from the end.
    const match = /(^|\s)([@#])([\w ]{0,24})$/.exec(text)
    if (match) {
      setMentionOpen(true)
      setMentionType(match[2] as '@' | '#')
      setMentionQuery(match[3])
    } else {
      setMentionOpen(false)
    }
  }

  // People and channels are flattened to one shape so the dropdown does not
  // have to branch on which list it is showing.
  const mentionResults = useMemo<{ id: string; name: string; initials: string }[]>(() => {
    const q = mentionQuery.trim().toLowerCase()
    if (mentionType === '@') {
      return USERS
        .filter(u => u.id !== ME_ID && u.name.toLowerCase().includes(q))
        .slice(0, 5)
        .map(u => ({ id: u.id, name: u.name, initials: u.initials }))
    }
    return channels
      .filter(c => c.type !== 'dm' && c.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map(c => ({ id: c.id, name: c.name, initials: initialsOf(c.name) }))
  }, [mentionType, mentionQuery, channels])

  const insertMention = (name: string) => {
    const root = inputRef.current
    if (!root) return
    const token = `${mentionType}${name}`
    // Replace the half-typed token in place rather than appending a second one.
    const html = root.innerHTML
    root.innerHTML = html.replace(new RegExp(`${mentionType}[\\w ]{0,24}$`), `${token}&nbsp;`)
    setInputText(root.innerHTML)
    setMentionOpen(false)
    setMentionQuery('')
    root.focus()
    placeCursorAtEnd()
  }

  /* ── Compose recipients ── */
  const composeRecipients = useMemo<ComposeRecipient[]>(() => {
    const active = myChannels.filter(c => !c.archived)
    const fromChannels: ComposeRecipient[] = active.map(c => c.type === 'dm'
      ? { id: c.id, name: c.name, subtitle: USERS.find(u => u.name === c.name)?.email, type: 'dm', group: 'Recent Conversations' }
      : { id: c.id, name: c.name, subtitle: c.topic ?? c.description, type: c.type === 'private' ? 'channel-private' : 'channel-public', group: 'Channels' })
    const dmNames = new Set(active.filter(c => c.type === 'dm').map(c => c.name))
    const fromUsers: ComposeRecipient[] = USERS
      .filter(u => u.id !== ME_ID && !dmNames.has(u.name))
      .map(u => ({ id: `new-dm-${u.id}`, name: u.name, subtitle: u.email, type: 'dm', group: 'People' }))
    return [...fromChannels, ...fromUsers]
  }, [myChannels])

  const composeGroups = useMemo(() => {
    const q = composeQuery.trim().replace(/^[#@]/, '').toLowerCase()
    const matched = q
      ? composeRecipients.filter(r => r.name.toLowerCase().includes(q) || (r.subtitle ?? '').toLowerCase().includes(q))
      : composeRecipients
    const out: Record<string, ComposeRecipient[]> = {}
    for (const r of matched) {
      if (!out[r.group]) out[r.group] = []
      out[r.group].push(r)
    }
    return out
  }, [composeRecipients, composeQuery])

  const pickComposeRecipient = (r: ComposeRecipient) => {
    setComposeRecipient(r)
    setComposeDropdownOpen(false)
    setComposeQuery('')
    if (r.id.startsWith('new-dm-')) {
      // Materialise the DM so the picked person has a conversation to open.
      const user = USERS.find(u => `new-dm-${u.id}` === r.id)
      if (!user) return
      const id = `dm-${user.id}`
      setChannels(prev => prev.some(c => c.id === id) ? prev : [...prev, {
        id, type: 'dm', name: user.name, members: [ME_ID, user.id], ownerId: ME_ID,
        unreadCount: 0, lastActivity: 'Today', isOnline: user.status === 'online',
      }])
      setMessages(prev => (prev[id] ? prev : { ...prev, [id]: [] }))
      setSelectedChannelId(id)
      return
    }
    setSelectedChannelId(r.id)
  }

  /* ── Effects ── */
  // A "Load older messages" prepend keeps the reader's place: bump scrollTop by
  // however much the list grew, so what they were reading does not move.
  useEffect(() => {
    const pending = loadOlderAnchorRef.current
    if (pending) {
      loadOlderAnchorRef.current = null
      pending.el.scrollTop = pending.prevTop + (pending.el.scrollHeight - pending.prevHeight)
      return
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filteredMessages.length, selectedChannelId])

  // Give the reader a moment to see the unread markers before clearing them.
  useEffect(() => {
    if (!selectedChannelId) return
    const channel = channels.find(c => c.id === selectedChannelId)
    if (!channel || channel.unreadCount === 0) return
    const hasUnread = (messages[selectedChannelId] ?? []).some(m => m.authorId !== ME_ID && !m.readBy.includes(ME_ID))
    if (!hasUnread) return
    const timer = window.setTimeout(() => markAllRead(selectedChannelId), 1800)
    return () => window.clearTimeout(timer)
    // Only the channel id: re-running on every keystroke would reset the timer
    // and it would never fire.
  }, [selectedChannelId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mentionOpen && emojiPickerForMessage !== 'composer') return
    const onDown = (e: MouseEvent) => {
      const wrapper = composerWrapperRef.current
      if (wrapper && e.target instanceof Node && wrapper.contains(e.target)) return
      setMentionOpen(false)
      setEmojiPickerForMessage(curr => (curr === 'composer' ? null : curr))
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [mentionOpen, emojiPickerForMessage])

  useEffect(() => {
    if (selectedChannelId) setDrafts(prev => ({ ...prev, [selectedChannelId]: inputText }))
  }, [inputText, selectedChannelId])

  useEffect(() => {
    setInputText(drafts[selectedChannelId] ?? '')
    setThreadOpenFor(null)
    setChatViewTab('messages')
    setSearchInConversation(false)
    setSearchQueryInput('')
    if (inputRef.current) inputRef.current.innerHTML = drafts[selectedChannelId] ?? ''
  }, [selectedChannelId]) // eslint-disable-line react-hooks/exhaustive-deps

  const archiveConfirmChannel = channels.find(c => c.id === archiveConfirmChannelId) ?? null
  const leaveConfirmChannel = channels.find(c => c.id === leaveConfirmChannelId) ?? null
  const conversationQuery = searchInConversation ? searchQueryInput.trim() : ''

  const activeFilterCount = (filters.sender ? 1 : 0) + (filters.dateRange ? 1 : 0)

  const openChannelByName = (name: string) => {
    const { pushToast } = useStore.getState()
    const c = channels.find(x => !x.archived && x.name.toLowerCase() === name.toLowerCase())
    if (c) setSelectedChannelId(c.id)
    else pushToast(`#${name} is not a channel here`, 'info')
  }

  return (
    <OpenChannelContext.Provider value={openChannelByName}>
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={chatRootRef} className="flex flex-1 min-h-0 relative">
        {/* Left column: channels and DMs. One always-mounted wrapper whose width
            animates between the 48px slim strip and the resizable column, so it
            pushes in and out instead of snapping. */}
        <div
          className="shrink-0 overflow-hidden flex flex-col relative bg-[var(--color-slate-50)]"
          style={{
            width: leftCollapsed ? '48px' : `${leftWidthPercent}%`,
            transition: 'width 280ms cubic-bezier(0.4, 0, 0.2, 1)',
            borderRight: leftCollapsed ? '1px solid var(--color-slate-200)' : '1px solid var(--color-slate-300)',
            boxShadow: leftCollapsed
              ? '1px 0 0 0 rgba(15, 23, 42, 0.025), 4px 0 8px -4px rgba(15, 23, 42, 0.04)'
              : '1px 0 0 0 rgba(15, 23, 42, 0.05), 4px 0 8px -4px rgba(15, 23, 42, 0.06)',
          }}
        >
          {leftCollapsed ? (
            <div className="flex flex-col items-center px-2.5 pt-5">
              <button
                onClick={() => setLeftCollapsed(false)}
                title="Show conversations"
                className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--color-slate-400)] hover:text-[var(--color-slate-500)] hover:bg-bg-subtle transition-colors"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="shrink-0 px-4 pt-3 pb-3 bg-[var(--color-slate-50)]">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted pointer-events-none" />
                    <input
                      type="text"
                      value={globalSearch}
                      onChange={e => setGlobalSearch(e.target.value)}
                      placeholder="Search conversations"
                      aria-label="Search chats"
                      className="h-8 w-full pl-8 pr-8 text-[13px] border border-border rounded-md bg-white shadow-sm hover:shadow-md transition-shadow outline-none focus:border-primary"
                    />
                    {globalSearch && (
                      <button
                        type="button"
                        onClick={() => setGlobalSearch('')}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-bg-subtle text-fg-muted"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className={cn(
                      'relative inline-flex items-center justify-center h-8 w-8 rounded-md border bg-white shadow-sm hover:bg-[var(--color-slate-100)] transition-colors cursor-pointer outline-none shrink-0',
                      activeFilterCount > 0 ? 'border-[var(--color-sky-500)]' : 'border-[var(--color-slate-200)]',
                    )}
                    title="Filters"
                    aria-label="Filters"
                  >
                    <SlidersHorizontal className={cn('w-3.5 h-3.5', activeFilterCount > 0 ? 'text-[var(--color-sky-500)]' : 'text-[var(--color-slate-500)]')} />
                    {activeFilterCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] text-white flex items-center justify-center border border-white"
                        style={{ backgroundColor: 'var(--color-sky-500)', fontWeight: 700 }}
                      >
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftCollapsed(true)}
                    title="Hide thread list"
                    aria-label="Hide thread list"
                    className="w-8 h-8 flex items-center justify-center rounded-md border border-[var(--color-slate-200)] bg-white shadow-sm hover:bg-[var(--color-slate-100)] text-[var(--color-slate-500)] transition-colors shrink-0"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="shrink-0 border-b border-border px-4 pt-0 pb-3 bg-[var(--color-slate-50)]">
                <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto">
                  {([
                    { key: 'all' as ChatListTab, label: 'All', count: chatTabCounts.all },
                    { key: 'sent' as ChatListTab, label: 'Sent', count: chatTabCounts.sent },
                    { key: 'archived' as ChatListTab, label: 'Archived', count: chatTabCounts.archived },
                  ]).map(tab => (
                    <MailboxPill
                      key={tab.key}
                      label={tab.label}
                      count={tab.count}
                      isActive={chatListTab === tab.key}
                      onClick={() => {
                        setChatListTab(tab.key)
                        // Sent drops the channel selection so the right pane
                        // reveals the flat sent list straight away.
                        if (tab.key === 'sent') setSelectedChannelId('')
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pb-4">
                {pinnedChannels.length > 0 && (
                  <SidebarSection label="Pinned" expanded={pinnedExpanded} onToggle={() => setPinnedExpanded(v => !v)} count={pinnedChannels.length}>
                    {pinnedChannels.map(c => (
                      <ChannelItem key={c.id} channel={c} isSelected={c.id === selectedChannelId} onClick={() => setSelectedChannelId(c.id)} density={density} />
                    ))}
                  </SidebarSection>
                )}
                <SidebarSection
                  label="Channels"
                  expanded={groupsExpanded}
                  onToggle={() => setGroupsExpanded(v => !v)}
                  count={groupChannels.length}
                  onAdd={() => setShowCreateChannel(true)}
                  addTooltip="Create a channel"
                >
                  {groupChannels.map(c => (
                    <ChannelItem key={c.id} channel={c} isSelected={c.id === selectedChannelId} onClick={() => setSelectedChannelId(c.id)} density={density} />
                  ))}
                </SidebarSection>
                <SidebarSection
                  label="Direct Messages"
                  expanded={dmsExpanded}
                  onToggle={() => setDmsExpanded(v => !v)}
                  count={dmChannels.length}
                  onAdd={() => setLocalComposeOpen(true)}
                  addTooltip="Start new chat"
                >
                  {dmChannels.map(c => (
                    <ChannelItem key={c.id} channel={c} isSelected={c.id === selectedChannelId} onClick={() => setSelectedChannelId(c.id)} density={density} />
                  ))}
                </SidebarSection>
              </div>
              <ColumnResizeHandle onMouseDown={onLeftResizeStart} isResizing={isLeftResizing} />
            </>
          )}
        </div>

        {/* Right pane: the conversation */}
        <div className="flex-1 min-w-0 flex flex-col bg-white relative">
          {/* The "New message" header and To: picker replace the channel header
              for the length of the compose flow. Picking a recipient swaps the
              selection to that conversation, so the existing history appears
              below the picker the way Slack does it. */}
          {isComposeOpen && (
            <>
              <div className="shrink-0 flex items-center justify-between px-5 h-[44px] border-b border-border bg-white">
                <span className="text-[15px] text-[var(--color-slate-900)]" style={{ fontWeight: 600 }}>New Message</span>
                <button
                  type="button"
                  onClick={closeCompose}
                  aria-label="Close compose"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-fg-muted hover:text-fg hover:bg-bg-subtle transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="shrink-0 px-5 py-2.5 border-b border-border bg-white relative">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] text-[var(--color-slate-500)]" style={{ fontWeight: 500 }}>To:</span>
                  {composeRecipient ? (
                    <span
                      className="inline-flex items-center gap-1.5 pl-1 pr-1 py-0.5 rounded-full text-[12.5px] bg-[var(--color-brand-75)] border border-[var(--color-sky-500)]/20 text-[var(--color-sky-500)]"
                      style={{ fontWeight: 500 }}
                    >
                      {composeRecipient.type === 'dm' ? (
                        <Avatar name={composeRecipient.name} size="w-5 h-5" text="text-[9px]" />
                      ) : (
                        <span
                          className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                          style={{ backgroundColor: getAvatarColor(composeRecipient.name).bg, color: getAvatarColor(composeRecipient.name).text }}
                        >
                          {composeRecipient.type === 'channel-private' ? <Lock className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
                        </span>
                      )}
                      {composeRecipient.name}
                      <button
                        type="button"
                        onClick={() => {
                          setComposeRecipient(null)
                          setComposeQuery('')
                          setComposeDropdownOpen(true)
                          window.setTimeout(() => composeSearchRef.current?.focus(), 0)
                        }}
                        className="w-4 h-4 rounded-full hover:bg-[var(--color-sky-500)]/15 flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Remove recipient"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ) : (
                    <div className="relative flex-1 min-w-[200px]">
                      <input
                        ref={composeSearchRef}
                        type="text"
                        value={composeQuery}
                        onChange={e => { setComposeQuery(e.target.value); setComposeDropdownOpen(true) }}
                        onFocus={() => setComposeDropdownOpen(true)}
                        placeholder="#a-channel, @somebody, or somebody@example.com"
                        className="h-7 w-full text-[13px] outline-none text-[var(--color-slate-700)] bg-transparent"
                      />
                    </div>
                  )}
                </div>
                {!composeRecipient && composeDropdownOpen && (
                  <div className="absolute left-5 right-5 top-[44px] max-h-[280px] overflow-y-auto bg-white border border-border rounded-lg shadow-lg z-20">
                    {Object.keys(composeGroups).length === 0 ? (
                      <div className="px-3 py-3 text-[12px] text-[var(--color-slate-400)]">No matches</div>
                    ) : (
                      Object.entries(composeGroups).map(([group, items]) => (
                        <div key={group} className="py-1.5">
                          <div className="px-3 pb-1 pt-0.5 text-[10px] text-[var(--color-slate-400)]" style={{ fontWeight: 600 }}>
                            {group}
                          </div>
                          {items.map(r => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => pickComposeRecipient(r)}
                              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[var(--color-slate-50)] transition-colors cursor-pointer"
                            >
                              {r.type === 'dm' ? (
                                <Avatar name={r.name} size="w-6 h-6" text="text-[10px]" />
                              ) : (
                                <span
                                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: getAvatarColor(r.name).bg, color: getAvatarColor(r.name).text }}
                                >
                                  {r.type === 'channel-private' ? <Lock className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
                                </span>
                              )}
                              <span className="flex-1 min-w-0">
                                <span className="text-[12.5px] text-[var(--color-slate-900)] block truncate" style={{ fontWeight: 500 }}>{r.name}</span>
                                {r.subtitle && <span className="text-[11px] text-[var(--color-slate-400)] block truncate">{r.subtitle}</span>}
                              </span>
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* The Messages / Pinned / Attachments switcher is always drawn, even
              on an empty chat, so the surface never changes shape underneath a
              reader who has not picked a channel yet. */}
          {!isComposeOpen && (
            <div className="shrink-0 flex items-end gap-1 px-5 py-0.5 border-b border-border bg-white">
              {([
                { id: 'messages' as ChatViewTab, label: 'Messages', count: filteredMessages.length },
                { id: 'pins' as ChatViewTab, label: 'Pinned', count: pinnedMessages.length },
                { id: 'attachments' as ChatViewTab, label: 'Attachments', count: allChannelAttachments.length },
              ]).map(t => {
                const isActive = chatViewTab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setChatViewTab(t.id)}
                    className="relative inline-flex items-center gap-1.5 h-9 px-3 text-[12.5px] transition-colors"
                    style={{ fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--color-sky-500)' : 'var(--color-slate-600)' }}
                  >
                    {t.label}
                    {t.count > 0 && (
                      <span
                        className="inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded text-[10px]"
                        style={{
                          fontWeight: 600,
                          backgroundColor: isActive ? 'var(--color-blue-100)' : 'var(--color-slate-200)',
                          color: isActive ? 'var(--color-blue-800)' : 'var(--color-slate-600)',
                        }}
                      >
                        {t.count}
                      </span>
                    )}
                    {isActive && <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-t-sm" style={{ backgroundColor: 'var(--color-sky-500)' }} />}
                  </button>
                )
              })}
            </div>
          )}

          {isComposeOpen && !composeRecipient ? (
            /* Blank chat window while the reader is still picking. A muted
               composer sits at the bottom so the pane reads as a real, settled
               conversation surface rather than an empty placeholder. */
            <>
              <div className="flex-1 bg-white" />
              <div className="shrink-0 border-t border-border bg-white px-5 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-7 h-7 flex items-center justify-center text-[var(--color-slate-300)]"><Bold className="w-3.5 h-3.5" /></span>
                  <span className="w-7 h-7 flex items-center justify-center text-[var(--color-slate-300)]"><Italic className="w-3.5 h-3.5" /></span>
                  <span className="w-7 h-7 flex items-center justify-center text-[var(--color-slate-300)]"><Underline className="w-3.5 h-3.5" /></span>
                  <span className="w-7 h-7 flex items-center justify-center text-[var(--color-slate-300)]"><Link2 className="w-3.5 h-3.5" /></span>
                </div>
                <div className="border border-border rounded-md bg-[var(--color-slate-50)] px-3 py-2 text-[13px] text-[var(--color-slate-400)]">
                  Start a new message
                </div>
                <div className="flex items-center gap-2 mt-2 text-[var(--color-slate-300)]">
                  <Paperclip className="w-3.5 h-3.5" />
                  <SmilePlus className="w-3.5 h-3.5" />
                  <AtSign className="w-3.5 h-3.5" />
                </div>
              </div>
            </>
          ) : showSentList ? (
            <SentMessagesView
              groups={sentMessagesByGroup}
              onOpen={(channelId, messageId) => { setSelectedChannelId(channelId); goToChatMessage(messageId) }}
              highlightQuery={globalSearch.trim()}
            />
          ) : selected ? (
            <>
              {/* One header row whether or not the reader is searching. Clicking
                  the search action hides the channel identity on the left and
                  grows the input out of where the icon was, so no second header
                  layers over the first. */}
              {!isComposeOpen && (
                <div className="shrink-0 px-5 py-[14px] border-b border-border flex items-center gap-3 bg-white">
                  {!searchInConversation && (
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {selected.type === 'dm' ? (
                        <div className="relative shrink-0">
                          <Avatar name={selected.name} size="w-9 h-9" text="text-[12px]" />
                          <PresenceDot status={selected.isOnline ? 'online' : 'away'} />
                        </div>
                      ) : (
                        <div
                          className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 border border-[var(--color-mist-450)]"
                          style={{ backgroundColor: getAvatarColor(selected.name).bg, color: getAvatarColor(selected.name).text }}
                        >
                          <ChannelIcon channel={selected} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {selected.type === 'dm' ? (
                            <h3 className="text-base font-semibold leading-snug truncate">{selected.name}</h3>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowChannelDetails(true)}
                              className="text-base font-semibold leading-snug truncate text-left hover:underline cursor-pointer outline-none"
                              title="Open channel details"
                            >
                              {selected.name}
                            </button>
                          )}
                          {selected.muted && <BellOff className="w-3.5 h-3.5 text-fg-muted" />}
                          {selected.pinned && <Pin className="w-3.5 h-3.5 text-[var(--color-sky-500)]" style={{ fill: 'var(--color-sky-500)' }} />}
                        </div>
                        {selected.type === 'dm' ? (
                          <p className="text-[11px] text-[var(--color-slate-500)]">{selected.isOnline ? 'Active now' : 'Away'}</p>
                        ) : (
                          <p className="text-[11px] text-[var(--color-slate-500)] truncate">
                            {selected.topic || selected.description || `${selected.members.length} members`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {searchInConversation && (
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted pointer-events-none" />
                        <input
                          autoFocus
                          type="text"
                          value={searchQueryInput}
                          onChange={e => setSearchQueryInput(e.target.value)}
                          placeholder={`Search in ${selected.type === 'dm' ? selected.name : '#' + selected.name}…`}
                          className="w-full h-9 pl-9 pr-9 text-[13px] border border-[var(--color-sky-500)] rounded-md bg-white outline-none focus:border-[var(--color-sky-500)] focus:ring-1 focus:ring-[var(--color-sky-500)]/25 transition-colors"
                        />
                        {searchQueryInput && (
                          <Tooltip content="Clear search">
                            <button
                              type="button"
                              onClick={() => setSearchQueryInput('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-fg-muted hover:bg-bg-subtle"
                              aria-label="Clear search"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                      <Tooltip content="Close search">
                        <button
                          type="button"
                          onClick={() => { setSearchQueryInput(''); setSearchInConversation(false) }}
                          className="p-1.5 rounded-md hover:bg-bg-subtle text-fg-muted shrink-0"
                          aria-label="Close search"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                  )}

                  {!searchInConversation && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Tooltip content="Filter messages">
                        <button
                          onClick={() => setFiltersOpen(true)}
                          className={cn(
                            'relative w-8 h-8 flex items-center justify-center rounded-md transition-colors',
                            activeFilterCount > 0
                              ? 'text-[var(--color-sky-500)] bg-[var(--color-brand-75)] hover:bg-[var(--color-blue-100)]'
                              : 'text-[var(--color-slate-400)] hover:text-[var(--color-slate-600)] hover:bg-[var(--color-slate-100)]',
                          )}
                          aria-label={`Filter messages${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                      {selected.type !== 'dm' && (
                        <Tooltip content="Channel details">
                          <button onClick={() => setShowChannelDetails(true)} className="w-8 h-8 flex items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle transition-colors" aria-label="Channel details">
                            <UsersIcon className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      )}
                      <Menu
                        trigger={
                          <span className="w-8 h-8 flex items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle transition-colors" aria-label="More actions">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </span>
                        }
                      >
                        {close => (
                          <>
                            <MenuItem
                              icon={<Search className="w-3.5 h-3.5" />}
                              onClick={() => { close(); setSearchQueryInput(''); setSearchInConversation(true) }}
                            >
                              Search in Conversation
                            </MenuItem>
                            <MenuItem
                              icon={selected.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                              onClick={() => { close(); togglePinChannel(selected.id) }}
                            >
                              {selected.pinned ? 'Unpin Channel' : 'Pin Channel'}
                            </MenuItem>
                            <MenuItem
                              icon={selected.muted ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                              onClick={() => { close(); toggleMuteChannel(selected.id) }}
                            >
                              {selected.muted ? 'Unmute' : 'Mute'}
                            </MenuItem>
                            {selected.type !== 'dm' && (
                              <MenuItem icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => { close(); setShowChannelDetails(true) }}>
                                Edit Channel Details
                              </MenuItem>
                            )}
                            <MenuItem icon={<Activity className="w-3.5 h-3.5" />} onClick={() => { close(); setShowActivityLog(true) }}>
                              Activity Log
                            </MenuItem>
                            <MenuItem icon={<Download className="w-3.5 h-3.5" />} onClick={() => { close(); exportConversation() }}>
                              Export Conversation
                            </MenuItem>
                            {/* Archiving removes the channel for everyone, so only
                                its owner can start it. Unarchiving stays a single
                                click; archiving asks first. */}
                            {selected.type !== 'dm' && selected.ownerId === ME_ID && (
                              <MenuItem
                                danger
                                icon={selected.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                                onClick={() => {
                                  close()
                                  if (selected.archived) toggleArchiveChannel(selected.id)
                                  else setArchiveConfirmChannelId(selected.id)
                                }}
                              >
                                {selected.archived ? 'Unarchive' : 'Archive Channel'}
                              </MenuItem>
                            )}
                            {selected.type !== 'dm' && selected.ownerId !== ME_ID && !selected.archived && (
                              <MenuItem danger icon={<LogOut className="w-3.5 h-3.5" />} onClick={() => { close(); setLeaveConfirmChannelId(selected.id) }}>
                                Leave Channel
                              </MenuItem>
                            )}
                          </>
                        )}
                      </Menu>
                    </div>
                  )}
                </div>
              )}

              {activeFilterCount > 0 && (
                <div className="shrink-0 px-5 py-2 border-b border-border bg-blue-50/40 flex items-center gap-2 text-[11px]">
                  <Filter className="w-3 h-3 text-[var(--color-sky-500)]" />
                  <span className="text-[var(--color-sky-500)] font-medium">Filters Active:</span>
                  {filters.sender && (
                    <span className="px-1.5 py-0.5 bg-white rounded border border-[var(--color-sky-500)]/20">
                      Sender: {USERS.find(u => u.id === filters.sender)?.name}
                    </span>
                  )}
                  {filters.dateRange && (
                    <span className="px-1.5 py-0.5 bg-white rounded border border-[var(--color-sky-500)]/20">
                      Date: {filters.dateRange === 'today' ? 'Today' : filters.dateRange === 'week' ? 'This Week' : 'This Month'}
                    </span>
                  )}
                  <button onClick={() => setFilters({})} className="ml-auto text-[var(--color-sky-500)] hover:underline">Clear All</button>
                </div>
              )}

              {/* Body. Messages and Pins share one chronological renderer;
                  Attachments lists every file the conversation carries. */}
              <div ref={messagesScrollRef} className="flex-1 overflow-y-auto py-3">
                {chatViewTab === 'attachments' ? (
                  allChannelAttachments.length === 0 ? (
                    <EmptyState
                      icon={<Paperclip size={20} />}
                      title="No attachments"
                      description="Files shared in this conversation will appear here."
                    />
                  ) : (
                    <div
                      className="px-5 grid"
                      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', columnGap: 12, rowGap: 16 }}
                    >
                      {allChannelAttachments.map((att, i) => (
                        <div key={`${att.messageId}-${i}`} className="flex flex-col gap-1.5">
                          <AttachmentCard file={{ name: att.name, size: att.size, uploadedBy: att.sender, date: att.timestamp }} />
                          {/* This module's card has no footer action of its own,
                              so the way back to the message sits under the tile. */}
                          <button
                            type="button"
                            onClick={() => goToChatMessage(att.messageId)}
                            className="self-start inline-flex items-center gap-1 text-[11.5px] text-[var(--color-sky-500)] hover:underline"
                          >
                            <CornerDownRight className="w-3 h-3" />
                            Go to Message
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                ) : (() => {
                  const isPinsTab = chatViewTab === 'pins'
                  const displayMessages = isPinsTab ? pinnedMessages : filteredMessages
                  if (isPinsTab && displayMessages.length === 0) {
                    return (
                      <EmptyState
                        icon={<Pin size={20} />}
                        title="No pinned messages"
                        description="Pin important messages to find them quickly."
                      />
                    )
                  }
                  if (conversationQuery && displayMessages.length === 0) {
                    return (
                      <EmptyState
                        icon={<Search size={20} />}
                        title="No matches"
                        description={`No messages in this conversation match "${conversationQuery}".`}
                      />
                    )
                  }
                  return (
                    <>
                      {/* Only offered where there is enough seeded history behind
                          the conversation to be worth reaching back for. */}
                      {!isPinsTab && displayMessages.length >= 3 && (olderLoadCount[selectedChannelId] ?? 0) < 3 && (
                        <LoadOlderMessages onClick={handleLoadOlder} />
                      )}
                      {displayMessages.map((msg, idx) => {
                        const prev = idx > 0 ? displayMessages[idx - 1] : null
                        const currentGroup = getDateGroup(msg.timestamp)
                        const prevGroup = prev ? getDateGroup(prev.timestamp) : null
                        const showDateSeparator = currentGroup !== prevGroup
                        // Consecutive messages from one person collapse into a
                        // single attributed run, but a new day restarts it.
                        const showAvatar = !prev || prev.authorId !== msg.authorId || showDateSeparator
                        return (
                          <div key={msg.id} data-chat-message-id={msg.id}>
                            {showDateSeparator && <DateSeparator label={currentGroup} />}
                            <MessageBubble
                              message={msg}
                              showAvatar={showAvatar}
                              isHighlighted={highlightedMessageId === msg.id}
                              highlightQuery={conversationQuery || undefined}
                              onPin={() => togglePinMessage(msg.id)}
                              onReact={emoji => addReaction(msg.id, emoji)}
                              onOpenThread={() => setThreadOpenFor(msg.id)}
                              onForward={() => setForwardTargetMessage(msg)}
                              showEmojiPicker={emojiPickerForMessage === msg.id}
                              onToggleEmojiPicker={() => setEmojiPickerForMessage(emojiPickerForMessage === msg.id ? null : msg.id)}
                              onGoToMessage={isPinsTab ? () => goToChatMessage(msg.id) : undefined}
                            />
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )
                })()}
              </div>

              {/* Composer. Pins and Attachments are read-only ways of finding
                  what a channel holds, so a typing area there would imply you
                  could post into the wrong context. An archived channel is
                  archived for everyone, so it gets a banner instead. */}
              {chatViewTab !== 'messages' ? null : selected.archived ? (
                <div className="shrink-0 mx-5 mb-4 mt-2 px-3 py-2.5 rounded-md border border-border bg-bg-subtle flex items-center gap-2.5">
                  <Archive className="w-4 h-4 text-fg-muted shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-fg">This channel is archived</p>
                    <p className="text-[11.5px] text-fg-muted mt-0.5">
                      {selected.ownerId === ME_ID
                        ? 'Unarchive the channel from the menu above to start posting again.'
                        : 'New messages and thread replies are paused until the channel owner unarchives it.'}
                    </p>
                  </div>
                  {selected.ownerId === ME_ID && (
                    <button
                      type="button"
                      onClick={() => toggleArchiveChannel(selected.id)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] border border-border bg-white hover:bg-bg-subtle transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" />
                      Unarchive
                    </button>
                  )}
                </div>
              ) : (
                <div ref={composerWrapperRef} className="shrink-0 px-5 pb-4 pt-2 relative">
                  {mentionOpen && mentionResults.length > 0 && (
                    <div className="absolute bottom-full left-5 mb-1 w-[260px] bg-white border border-border rounded-lg shadow-lg z-50 py-1 max-h-[200px] overflow-y-auto">
                      {mentionResults.map(item => (
                        <button
                          key={item.id}
                          // mousedown, not click: the composer must not lose its
                          // selection before the token is swapped in.
                          onMouseDown={e => { e.preventDefault(); insertMention(item.name) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-bg-subtle transition-colors text-left"
                        >
                          {mentionType === '@' ? (
                            <Avatar name={item.name} initials={item.initials} size="w-6 h-6" text="text-[9px]" />
                          ) : (
                            <div className="w-6 h-6 rounded flex items-center justify-center text-fg-muted"><Hash className="w-3 h-3" /></div>
                          )}
                          <span className="text-[13px] font-medium text-fg">{mentionType === '@' ? item.name : `#${item.name}`}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* The active border persists once there is something unsent,
                      so a draft still reads as ready after the reader clicks away
                      to attach a file or pick a mention. */}
                  <div className={cn(
                    'border rounded-lg bg-background transition-colors',
                    plainFromComposer(inputText) || pendingAttachments.length > 0
                      ? 'border-[var(--color-sky-500)] ring-1 ring-[var(--color-sky-500)]/20'
                      : 'border-border focus-within:border-[var(--color-sky-500)] focus-within:ring-1 focus-within:ring-[var(--color-sky-500)]/20',
                  )}>
                    {pendingAttachments.length > 0 && (
                      <div className="grid gap-2 px-3 pt-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, 150px)' }}>
                        {pendingAttachments.map((a, i) => (
                          <AttachmentCard
                            key={`${a.name}-${i}`}
                            file={{ name: a.name, size: a.size }}
                            onRemove={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                          />
                        ))}
                      </div>
                    )}
                    <div
                      ref={inputRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={handleComposerInput}
                      onKeyDown={e => {
                        if (e.key === 'Escape' && mentionOpen) {
                          e.preventDefault()
                          setMentionOpen(false)
                          return
                        }
                        // Enter sends unless the mention list is open, where it
                        // belongs to the list, or Shift is held for a new line.
                        if (e.key === 'Enter' && !e.shiftKey && !mentionOpen) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                      onKeyUp={updateFormats}
                      onMouseUp={updateFormats}
                      data-placeholder={`Message ${selected.type === 'dm' ? selected.name : `#${selected.name}`}`}
                      className="w-full text-[13px] text-fg bg-transparent px-3 py-2.5 outline-none empty:before:content-[attr(data-placeholder)] [&_a]:text-[var(--color-sky-500)] [&_a]:underline [&_a]:cursor-pointer"
                      style={{ minHeight: '38px', maxHeight: '120px', overflowY: 'auto' }}
                    />
                    <div className="flex items-center justify-between px-2 pb-2">
                      <div className="flex items-center gap-0.5">
                        <FormatBtn active={activeFormats.has('bold')} onClick={() => execFormat('bold')} icon={Bold} label="Bold" />
                        <FormatBtn active={activeFormats.has('italic')} onClick={() => execFormat('italic')} icon={Italic} label="Italic" />
                        <FormatBtn active={activeFormats.has('underline')} onClick={() => execFormat('underline')} icon={Underline} label="Underline" />
                        <div className="w-px h-4 bg-border mx-0.5" />
                        <FormatBtn onClick={() => fileInputRef.current?.click()} icon={Paperclip} label="Attach" />
                        <FormatBtn
                          active={emojiPickerForMessage === 'composer'}
                          onClick={() => { setMentionOpen(false); setEmojiPickerForMessage('composer') }}
                          icon={SmilePlus}
                          label="Emoji"
                        />
                        <FormatBtn
                          active={mentionOpen}
                          onClick={() => {
                            const el = inputRef.current
                            if (!el) return
                            setEmojiPickerForMessage(null)
                            el.innerHTML += '@'
                            setInputText(el.innerHTML)
                            setMentionOpen(true)
                            setMentionType('@')
                            setMentionQuery('')
                            el.focus()
                            placeCursorAtEnd()
                          }}
                          icon={AtSign}
                          label="Mention someone"
                        />
                      </div>
                      <button
                        onClick={sendMessage}
                        disabled={!plainFromComposer(inputText) && pendingAttachments.length === 0}
                        aria-label="Send message"
                        className={cn(
                          'w-8 h-8 flex items-center justify-center rounded-md transition-colors',
                          plainFromComposer(inputText) || pendingAttachments.length > 0
                            ? 'bg-[var(--color-sky-500)] text-white hover:bg-[var(--color-brand-700)]'
                            : 'bg-bg-subtle text-fg-muted cursor-not-allowed',
                        )}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {emojiPickerForMessage === 'composer' && (
                    <div className="absolute bottom-[64px] left-5 bg-white border border-border rounded-lg shadow-lg p-2 flex flex-wrap gap-1 z-50 w-[200px]">
                      {QUICK_EMOJIS.map(em => (
                        <button
                          key={em}
                          onMouseDown={e => {
                            e.preventDefault()
                            inputRef.current?.focus()
                            document.execCommand('insertText', false, em)
                            if (inputRef.current) setInputText(inputRef.current.innerHTML)
                            setEmojiPickerForMessage(null)
                          }}
                          className="w-8 h-8 hover:bg-bg-subtle rounded text-base"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  )}

                  {drafts[selectedChannelId] && (
                    <p className="text-[10px] text-fg-muted/60 mt-1.5 px-0.5">Draft saved · Reply with Enter, new line with Shift+Enter</p>
                  )}
                </div>
              )}

              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            </>
          ) : (
            <EmptyState
              className="flex-1"
              icon={<MessageSquare size={20} />}
              title={isComposeOpen
                ? 'Pick a recipient to start a new chat'
                : myChannels.length === 0
                  ? 'No chat conversations yet'
                  : 'Select a channel or DM to start chatting'}
              description={isComposeOpen
                ? 'Search a person, channel, or email above to open their conversation here.'
                : myChannels.length === 0
                  ? 'Create a channel or send a direct message to start the conversation.'
                  : 'Pick a channel or direct message from the left to view its messages.'}
            />
          )}
        </div>

        {/* Thread side panel. The source slid this in with framer-motion; this
            module has no animation library, so it appears in place. */}
        {threadOpenFor && selected && (() => {
          const parent = channelMessages.find(m => m.id === threadOpenFor)
          if (!parent) return null
          const channelLabel = selected.type === 'dm' ? selected.name : `#${selected.name}`
          return (
            <div className="shrink-0 w-[380px] border-l border-border flex flex-col min-h-0 bg-white">
              <div className="shrink-0 px-4 h-12 border-b border-border flex items-center justify-between bg-white">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold leading-tight truncate">Thread</p>
                  <p className="text-[11px] text-fg-muted leading-tight truncate">{channelLabel}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Tooltip content="Close thread">
                    <button
                      onClick={() => setThreadOpenFor(null)}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle transition-colors"
                      aria-label="Close thread"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto bg-white">
                <div className="py-3">
                  {/* The parent reuses the stream's bubble so the thread reads as
                      a continuation rather than a separate surface. */}
                  <MessageBubble
                    message={parent}
                    showAvatar
                    onPin={() => togglePinMessage(parent.id)}
                    onReact={emoji => addReaction(parent.id, emoji)}
                    // Already in the thread, so the reply box is where it goes.
                    onOpenThread={() => threadReplyRef.current?.focus()}
                    onForward={() => setForwardTargetMessage(parent)}
                    showEmojiPicker={emojiPickerForMessage === parent.id}
                    onToggleEmojiPicker={() => setEmojiPickerForMessage(emojiPickerForMessage === parent.id ? null : parent.id)}
                  />
                  {parent.replies.length > 0 && (
                    <div className="flex items-center gap-3 px-5 my-2">
                      <span className="text-[11px] font-medium text-fg-muted/70">
                        {parent.replies.length} {parent.replies.length === 1 ? 'reply' : 'replies'}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  {parent.replies.map(r => (
                    <div key={r.id} className="group relative flex items-start gap-2.5 px-5 py-1.5 mt-2 hover:bg-[var(--color-slate-50)]">
                      <div className="w-8 shrink-0">
                        <Avatar name={r.authorName} initials={r.authorInitials} size="w-8 h-8" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-[13px] font-semibold">{r.authorName}</span>
                          <span className="text-[11px] text-[var(--color-slate-400)]">{r.timestamp}</span>
                        </div>
                        <p className="text-[13px] text-fg leading-relaxed"><MessageRichText text={r.text} /></p>
                        {r.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {r.reactions.map((reaction, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-border bg-background text-[11px]">
                                <span>{reaction.emoji}</span>
                                <span className="text-fg-muted tabular-nums">{reaction.users.length}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {selected.archived ? (
                  <div className="mx-3 mb-4 mt-2 px-3 py-2.5 rounded-md border border-border bg-bg-subtle flex items-center gap-2.5">
                    <Archive className="w-4 h-4 text-fg-muted shrink-0" />
                    <p className="text-[12.5px] text-fg">
                      This channel is archived, so thread replies are paused until the owner unarchives.
                    </p>
                  </div>
                ) : (
                  <div className="px-3 pb-4 pt-2">
                    <div className="border border-border rounded-lg overflow-hidden focus-within:border-[var(--color-sky-500)] focus-within:ring-1 focus-within:ring-[var(--color-sky-500)]/20 transition-all bg-white">
                      <div
                        ref={threadReplyRef}
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="Reply…"
                        className="min-h-[44px] max-h-[140px] overflow-y-auto px-3 py-2 text-[13px] text-fg outline-none leading-relaxed empty:before:content-[attr(data-placeholder)]"
                        onInput={e => setThreadReplyText(e.currentTarget.textContent ?? '')}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            const text = e.currentTarget.textContent?.trim() ?? ''
                            if (!text) return
                            sendThreadReply(parent.id, text)
                            e.currentTarget.innerHTML = ''
                          }
                        }}
                      />
                      <div className="flex items-center justify-between px-2 py-1.5 border-t border-border/50 bg-[var(--color-slate-50)]">
                        <div className="flex items-center gap-0.5">
                          <FormatBtn onClick={() => document.execCommand('bold', false)} icon={Bold} label="Bold" />
                          <FormatBtn onClick={() => document.execCommand('italic', false)} icon={Italic} label="Italic" />
                          <FormatBtn onClick={() => document.execCommand('underline', false)} icon={Underline} label="Underline" />
                        </div>
                        <button
                          onClick={() => {
                            const text = threadReplyText.trim()
                            if (!text) return
                            sendThreadReply(parent.id, text)
                            if (threadReplyRef.current) threadReplyRef.current.innerHTML = ''
                          }}
                          disabled={!threadReplyText.trim()}
                          aria-label="Send reply"
                          className={cn(
                            'w-8 h-8 flex items-center justify-center rounded-md transition-colors',
                            threadReplyText.trim() ? 'bg-[var(--color-sky-500)] text-white hover:bg-[var(--color-brand-700)]' : 'bg-bg-subtle text-fg-muted cursor-not-allowed',
                          )}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Keyed on what they are editing so the draft state inside each one is
            rebuilt for a new subject rather than carried over. */}
        {filtersOpen && (
          <ChatFiltersModal
            filters={filters}
            channelMessages={channelMessages}
            onApply={next => { setFilters(next); setFiltersOpen(false) }}
            onClose={() => setFiltersOpen(false)}
          />
        )}

        {forwardTargetMessage && (
          <ForwardMessageModal
            key={forwardTargetMessage.id}
            message={forwardTargetMessage}
            channels={myChannels.filter(c => !c.archived)}
            onForward={targetId => forwardMessage(forwardTargetMessage, targetId)}
            onClose={() => setForwardTargetMessage(null)}
          />
        )}

        {showCreateChannel && (
          <CreateChannelModal onCreate={createChannel} onClose={() => setShowCreateChannel(false)} />
        )}

        {showChannelDetails && selected && (
          <ChannelDetailsModal
            key={selected.id}
            channel={selected}
            onUpdate={patch => updateChannel(selected.id, patch)}
            onClose={() => setShowChannelDetails(false)}
          />
        )}

        {showActivityLog && selected && (
          <ActivityLogModal channel={selected} onClose={() => setShowActivityLog(false)} />
        )}

        <ConfirmModal
          open={!!archiveConfirmChannel}
          tone="warning"
          badge="Archive"
          icon={<Archive size={20} />}
          title={`Archive #${archiveConfirmChannel?.name ?? ''}?`}
          description="This channel will be moved to the archive. You can still find it later under the Archived tab."
          confirmLabel="Archive Channel"
          dismissLabel="Keep Active"
          onConfirm={() => {
            if (archiveConfirmChannelId) toggleArchiveChannel(archiveConfirmChannelId)
            setArchiveConfirmChannelId(null)
          }}
          onDismiss={() => setArchiveConfirmChannelId(null)}
        />

        <ConfirmModal
          open={!!leaveConfirmChannel}
          tone="danger"
          badge="Leave"
          icon={<LogOut size={20} />}
          title={`Leave #${leaveConfirmChannel?.name ?? ''}?`}
          description={`You'll stop receiving messages from #${leaveConfirmChannel?.name ?? ''}. You can be re-added by another member later.`}
          confirmLabel="Leave Channel"
          dismissLabel="Stay in Channel"
          onConfirm={() => {
            if (leaveConfirmChannelId) leaveChannel(leaveConfirmChannelId)
            setLeaveConfirmChannelId(null)
          }}
          onDismiss={() => setLeaveConfirmChannelId(null)}
        />
      </div>
    </div>
    </OpenChannelContext.Provider>
  )
}

/* ── Modals ───────────────────────────────────────────────────────────────── */

function ChatFiltersModal({ filters, channelMessages, onApply, onClose }: {
  filters: ChatFilters
  channelMessages: ChatMessage[]
  onApply: (f: ChatFilters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<ChatFilters>(filters)
  // Only people who have actually spoken here, so the list cannot offer a
  // sender that would filter the conversation down to nothing.
  const senders = Array.from(new Set(channelMessages.map(m => m.authorId)))
  return (
    <Modal
      open
      onClose={onClose}
      title="Filter Messages"
      footerAlign="between"
      footer={
        <>
          <button onClick={() => { setDraft({}); onApply({}) }} className="text-[13px] text-fg-muted hover:text-fg">Clear All</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={() => onApply(draft)} className="btn-primary">Apply</button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Sender"
          value={draft.sender ?? ''}
          onChange={e => setDraft({ ...draft, sender: e.target.value || undefined })}
        >
          <option value="">All Senders</option>
          {senders.map(s => <option key={s} value={s}>{USERS.find(u => u.id === s)?.name ?? s}</option>)}
        </Select>
        <Select
          label="Date Range"
          value={draft.dateRange ?? ''}
          onChange={e => setDraft({ ...draft, dateRange: (e.target.value || undefined) as ChatFilters['dateRange'] })}
        >
          <option value="">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </Select>
      </div>
    </Modal>
  )
}

function ForwardMessageModal({ message, channels, onForward, onClose }: {
  message: ChatMessage
  channels: Channel[]
  onForward: (id: string) => void
  onClose: () => void
}) {
  const [target, setTarget] = useState<string | null>(null)
  return (
    <Modal
      open
      onClose={onClose}
      title="Forward Message"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => target && onForward(target)} disabled={!target} className="btn-primary">Forward</button>
        </>
      }
    >
      <p className="text-[12px] text-fg-muted mb-3">Forward to Channel or DM:</p>
      <div className="space-y-1 max-h-[280px] overflow-y-auto">
        {channels.map(c => (
          <button
            key={c.id}
            onClick={() => setTarget(c.id)}
            className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left', target === c.id ? 'bg-[var(--color-brand-75)]' : 'hover:bg-bg-subtle')}
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-semibold"
              style={{ backgroundColor: getAvatarColor(c.name).bg, color: getAvatarColor(c.name).text }}
            >
              {c.type === 'dm' ? initialsOf(c.name) : <ChannelIcon channel={c} />}
            </div>
            <span className="text-[13px] font-medium">{c.type === 'dm' ? c.name : `#${c.name}`}</span>
            {target === c.id && <Check className="w-4 h-4 text-[var(--color-sky-500)] ml-auto" />}
          </button>
        ))}
      </div>
      <div className="mt-4 p-3 bg-bg-subtle rounded-md border border-border">
        <p className="text-[11px] text-fg-muted mb-1">Message Preview</p>
        <p className="text-[12px] text-fg line-clamp-2">{message.text}</p>
      </div>
    </Modal>
  )
}

function CreateChannelModal({ onCreate, onClose }: {
  onCreate: (c: { name: string; description: string; private: boolean; members: string[] }) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [members, setMembers] = useState<string[]>([])
  return (
    <Modal
      open
      onClose={onClose}
      title="Create a Channel"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => name.trim() && onCreate({ name: name.trim(), description, private: isPrivate, members })}
            disabled={!name.trim()}
            className="btn-primary"
          >
            Create
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Name</label>
          {/* The leading glyph is the channel's own type marker, so it flips with
              the private toggle rather than being decoration. */}
          <div className="mt-1.5 flex items-center border border-border rounded-md overflow-hidden focus-within:border-brand-600 bg-white">
            <span className="px-2.5 text-fg-muted">{isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}</span>
            <input
              value={name}
              onChange={e => setName(e.target.value.replace(/\s+/g, '-').toLowerCase())}
              placeholder="e.g. project-alpha"
              autoFocus
              className="flex-1 h-9 pr-2 text-[13px] outline-none"
            />
          </div>
        </div>
        <Input
          label="Description (Optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What's this channel about?"
        />
        <Toggle checked={isPrivate} onChange={setIsPrivate} label="Make Private" />
        <div>
          <label className="label">Add Members</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {USERS.filter(u => u.id !== ME_ID).map(u => (
              <button
                key={u.id}
                onClick={() => setMembers(prev => prev.includes(u.id) ? prev.filter(m => m !== u.id) : [...prev, u.id])}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[12px]',
                  members.includes(u.id) ? 'border-[var(--color-sky-500)]/30 bg-[var(--color-brand-75)] text-[var(--color-sky-500)]' : 'border-border text-fg hover:bg-bg-subtle',
                )}
              >
                <Avatar name={u.name} initials={u.initials} size="w-4 h-4" text="text-[7px]" />
                {u.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ChannelDetailsModal({ channel, onUpdate, onClose }: {
  channel: Channel
  onUpdate: (patch: Partial<Channel>) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'about' | 'members'>('about')
  const [topic, setTopic] = useState(channel.topic ?? '')
  const [description, setDescription] = useState(channel.description ?? '')
  const isOwner = channel.ownerId === ME_ID
  const memberUsers = channel.members.map(id => USERS.find(u => u.id === id)).filter((u): u is User => !!u)
  const candidates = USERS.filter(u => !channel.members.includes(u.id))
  return (
    <Modal
      open
      onClose={onClose}
      title={channel.type === 'dm' ? channel.name : `#${channel.name}`}
      subtitle={channel.type === 'private' ? 'Private Channel' : channel.type === 'dm' ? 'Direct Message' : 'Public Channel'}
      subheader={
        <div className="px-5 flex items-center gap-4 border-b border-border">
          {(['about', 'members'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'py-2.5 text-[13px] border-b-2 -mb-px transition-colors',
                tab === t ? 'border-brand-600 text-fg font-semibold' : 'border-transparent text-fg-muted hover:text-fg',
              )}
            >
              {t === 'about' ? 'About' : `Members (${channel.members.length})`}
            </button>
          ))}
        </div>
      }
      footer={
        tab === 'about' && isOwner ? (
          <>
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={() => { onUpdate({ topic: topic || undefined, description: description || undefined }); onClose() }}
              className="btn-primary"
            >
              Save Changes
            </button>
          </>
        ) : (
          <button onClick={onClose} className="btn-secondary">Close</button>
        )
      }
    >
      {tab === 'about' ? (
        <div className="space-y-4">
          <Input
            label="Topic"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="What the channel is for right now"
            disabled={!isOwner}
          />
          <Input
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What's this channel about?"
            disabled={!isOwner}
          />
          <div className="rounded-md border border-border bg-bg-subtle px-3 py-2.5 text-[12px] text-fg-muted space-y-1">
            <p>Owner: {USERS.find(u => u.id === channel.ownerId)?.name ?? 'Unknown'}</p>
            <p>Last Activity: {channel.lastActivity}</p>
          </div>
          {!isOwner && (
            <p className="text-[12px] text-fg-muted">Only the channel owner can change the topic and description.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            {memberUsers.map(u => (
              <div key={u.id} className="flex items-center gap-2.5 px-1 py-1.5">
                <Avatar name={u.name} initials={u.initials} size="w-7 h-7" text="text-[10px]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-fg truncate">
                    {u.name}{u.id === ME_ID ? ' (you)' : ''}
                  </p>
                  <p className="text-[11px] text-fg-muted truncate">{u.email}</p>
                </div>
                {u.id === channel.ownerId ? (
                  <span className="text-[11px] text-fg-muted">Owner</span>
                ) : isOwner ? (
                  <button
                    onClick={() => onUpdate({ members: channel.members.filter(m => m !== u.id) })}
                    className="text-[12px] text-[var(--color-red-600)] hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {isOwner && candidates.length > 0 && (
            <div>
              <p className="text-[12px] font-medium text-fg-muted mb-1.5">Add Members</p>
              <div className="flex flex-wrap gap-1.5">
                {candidates.map(u => (
                  <button
                    key={u.id}
                    onClick={() => onUpdate({ members: [...channel.members, u.id] })}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-border text-[12px] text-fg hover:bg-bg-subtle"
                  >
                    <Plus className="w-3 h-3" />
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function ActivityLogModal({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const log = [
    { ts: 'Jul 12, 2025 2:15 PM', actor: 'Marcus Chen', action: 'sent a message' },
    { ts: 'Jul 12, 2025 11:00 AM', actor: 'Ashmita Roy', action: 'pinned a message' },
    { ts: 'Jul 11, 2025 4:30 PM', actor: 'James Wright', action: 'shared a file: Trial_Balance_Tieout.pdf' },
    { ts: 'Jul 10, 2025 9:00 AM', actor: 'Rachel Kim', action: 'joined the channel' },
    { ts: 'Jul 8, 2025 3:00 PM', actor: 'Ashmita Roy', action: `created the channel #${channel.name}` },
  ]
  return (
    <Modal open onClose={onClose} title="Activity Log" footer={<button onClick={onClose} className="btn-secondary">Close</button>}>
      <div className="space-y-3">
        {log.map((e, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-sky-500)] mt-1.5 shrink-0" />
            <div className="flex-1">
              <p className="text-[13px]"><span className="font-medium">{e.actor}</span> {e.action}</p>
              <p className="text-[11px] text-fg-muted mt-0.5">{e.ts}</p>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
