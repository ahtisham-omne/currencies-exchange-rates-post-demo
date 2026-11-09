/* Ported from the financial reporting module (components/fr/comms/ChatSearch.tsx).

   Slack-style search for ChatPanel.

     • ChatSearchBar renders the suggestion popover that overlays the channel
       column. Empty-state shows recent searches and a "Search in #channel"
       primary action; typing surfaces matching messages and channels.
     • ChatSearchResults replaces the message stream with a focused results
       panel - result-type / From / In / Date chips, a sort menu, and a
       scrollable list that branches on the active result type.
     • ChatSearchFiltersModal is the "Filter by" sheet (From / In / Date range /
       Message has / Message is).

   The components are deliberately UI-focused; the consumer (ChatPanel) owns
   state and supplies channels + messages.

   Three substitutions, all forced by what this app carries:

     1. Radix Popover, at five call sites, is `ChipPopover` below: a portalled
        `position: fixed` surface measured off its trigger's rect, with
        align-start + a 4px side offset, viewport clamping, outside-mousedown
        and Escape. It portals to <body> and so re-declares `data-comms`,
        which is why every colour in it is still the source's own primitive.
     2. The source's two-month react-day-picker `Calendar mode="range"` is this
        module's `DateRangeCalendar`. It already speaks ISO `yyyy-mm-dd`, which
        is the shape the filter stores, so the source's `isoFromDate` /
        `dateFromIso` bridges are gone rather than ported dead.
     3. The filters sheet is this module's `Modal`, not the source's
        hand-rolled `fixed inset-0` dialog, so a filter set dismisses and
        scrolls the way every other dialog here does. Its body re-declares
        `data-comms` for the same reason as the popover.

   `FilterChip` is unused here, exactly as it is unused in the source; it is
   kept so the two files stay diff-able. */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUpDown, AtSign, Calendar as CalendarIcon, Check, ChevronDown, ChevronLeft,
  Clock, Hash, Lock, MessageSquare, Paperclip, Search, User, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { DateRangeCalendar } from '../DateField'
import { Modal } from '../ui'

/* ──────────────────────────────────────────────────────────────────────── */
/* Types                                                                    */
/* ──────────────────────────────────────────────────────────────────────── */

export interface ChatSearchChannel {
  id: string
  type: 'public' | 'private' | 'dm'
  name: string
  /** Optional channel description / topic - surfaced in the
   *  result-type=Channels rendering. */
  description?: string
  /** Member count, also rendered in the Channels result list. */
  memberCount?: number
  /** True when the current user is a member - flips the row's "Joined"
   *  pill on. Defaults to true if not provided. */
  joined?: boolean
}

export interface ChatSearchMessage {
  id: string
  channelId: string
  authorId: string
  authorName: string
  authorInitials: string
  text: string
  timestamp: string
  /** Optional list of attachments shipped with the message - drives the
   *  result-type=Attachments rendering. */
  attachments?: { name: string; size: string }[]
}

export interface ChatSearchUser {
  id: string
  name: string
  initials: string
}

export interface ChatSearchFilters {
  /** Authors to include - multi-select user ids. Empty/undefined means
   *  no author filter. */
  from?: string[]
  /** Channels (incl. DMs) to include - multi-select channel ids. */
  inChannel?: string[]
  /** Single counterparty for "With" filter (still single in the modal). */
  with?: string
  date?: 'any' | 'today' | 'week' | 'month' | 'year'
  /** Custom inclusive date range for the search results. Either bound may
   *  be omitted to mean "open" on that side (e.g. only `start` set →
   *  "from this date onward"). When neither bound is set the range is
   *  considered cleared and the pill renders in its inactive state. */
  dateRange?: { start?: string; end?: string }
  fileTypes?: string
  onlyMyChannels: boolean
  excludeAutomations: boolean
  reactions?: string
  hasFile: boolean
  hasLink: boolean
  hasAction: boolean
  isDM: boolean
  isThread: boolean
}

export const DEFAULT_CHAT_SEARCH_FILTERS: ChatSearchFilters = {
  date: 'any',
  onlyMyChannels: false,
  excludeAutomations: false,
  hasFile: false,
  hasLink: false,
  hasAction: false,
  isDM: false,
  isThread: false,
}

/** Count how many filters are currently narrowing the result set, so the
 *  Filters button can show the same active-count badge the correspondence
 *  list's does. */
export function countActiveChatSearchFilters(f: ChatSearchFilters): number {
  let n = 0
  if (f.from && f.from.length > 0) n += 1
  if (f.inChannel && f.inChannel.length > 0) n += 1
  if (f.with) n += 1
  if (f.date && f.date !== 'any') n += 1
  if (f.dateRange && (f.dateRange.start || f.dateRange.end)) n += 1
  if (f.fileTypes) n += 1
  if (f.onlyMyChannels) n += 1
  if (f.excludeAutomations) n += 1
  if (f.reactions) n += 1
  if (f.hasFile) n += 1
  if (f.hasLink) n += 1
  if (f.hasAction) n += 1
  if (f.isDM) n += 1
  if (f.isThread) n += 1
  return n
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Channel icon helper                                                       */
/* ──────────────────────────────────────────────────────────────────────── */

function ChannelGlyph({ channel, className }: { channel: ChatSearchChannel; className?: string }) {
  if (channel.type === 'dm') return <MessageSquare className={cn('w-3.5 h-3.5', className)} />
  if (channel.type === 'private') return <Lock className={cn('w-3.5 h-3.5', className)} />
  return <Hash className={cn('w-3.5 h-3.5', className)} />
}

/* ──────────────────────────────────────────────────────────────────────── */
/* ChipPopover — the Radix Popover substitution                              */
/* ──────────────────────────────────────────────────────────────────────── */

/* Every chip in this file opened a Radix Popover with `align="start"
   sideOffset={4}` and a `z-[220]` content class. This reproduces exactly that:
   portalled so the chip row's `overflow-x-auto` cannot clip it, measured off
   the trigger so it tracks a resized column, and flipped above the trigger
   when the surface would run off the bottom of the window.

   Position is settled in a layout effect, before paint, so the card never
   appears at the wrong place for a frame. The first pass renders it hidden
   only so its own size can be read. */
function ChipPopover({
  open,
  onOpenChange,
  anchorRef,
  className,
  children,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** The pill the surface hangs off. Usually the whole chip, not just its
   *  button, so a chip with a clear ✕ still aligns to its left edge. */
  anchorRef: React.RefObject<HTMLElement | null>
  className?: string
  children: ReactNode
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) { setPos(null); return undefined }
    const measure = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      const card = cardRef.current
      if (!rect || !card) return
      const w = card.offsetWidth
      const h = card.offsetHeight
      let left = rect.left
      if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w
      if (left < 8) left = 8
      let top = rect.bottom + 4
      // Not enough room under the chip: flip above it, the way the tooltip
      // primitive does.
      if (top + h > window.innerHeight - 8 && rect.top - 4 - h > 8) top = rect.top - 4 - h
      setPos({ left, top })
    }
    measure()
    window.addEventListener('resize', measure)
    // Capture, so a scroll inside the results list repositions it too.
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (cardRef.current?.contains(t)) return
      // The trigger's own click toggles; letting this fire too would close
      // and reopen in the same gesture.
      if (anchorRef.current?.contains(t)) return
      onOpenChange(false)
    }
    // Capture + stopPropagation, so Escape inside a chip popover closes the
    // chip and not the dialog or the whole search behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onOpenChange(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, anchorRef, onOpenChange])

  if (!open) return null
  return createPortal(
    <div
      ref={cardRef}
      data-comms
      className={className}
      style={{
        position: 'fixed',
        left: pos ? pos.left : 0,
        top: pos ? pos.top : 0,
        zIndex: 220,
        visibility: pos ? 'visible' : 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Search bar + popover                                                      */
/* ──────────────────────────────────────────────────────────────────────── */

interface ChatSearchBarProps {
  query: string
  onQueryChange: (q: string) => void
  onSubmit: (q: string) => void
  /** Optional alternative to `onSubmit` - fired by the "Search in #channel"
   *  primary action so the parent can scope the resulting view to that
   *  channel by pre-applying the In filter. Falls back to `onSubmit` when
   *  not supplied. */
  onSubmitInChannel?: (channelId: string, query: string) => void
  onClose: () => void
  /** The channel the user is currently viewing - surfaces as the
   *  highlighted "Search in #channel" suggestion. */
  currentChannel: ChatSearchChannel | null
  channels: ChatSearchChannel[]
  messages: ChatSearchMessage[]
  recentSearches: string[]
  onSelectRecent: (q: string) => void
  /** When false, only the search input row renders - the suggestion
   *  popover is hidden. Used in `results` mode so the dropdown
   *  collapses once the user has submitted and the full-page results
   *  view takes over. */
  showSuggestions?: boolean
  /** When true, ChatSearchBar renders its own input bar above the
   *  popover. Used by the in-conversation search icon (where the parent
   *  doesn't have a visible toolbar search). The toolbar-driven flow
   *  leaves this false so only one search input is on screen at a time. */
  showInput?: boolean
  /** Width of the sidebar-anchored dropdown. The source hardcoded
   *  `calc(35% - 32px)` because its channel column was a fixed 35%; this
   *  one is resizable, so the host passes its live width and the popover
   *  keeps reading as a continuation of the input above it. */
  anchorWidth?: string
}

export function ChatSearchBar({
  query,
  onQueryChange,
  onSubmit,
  onSubmitInChannel,
  onClose,
  currentChannel,
  channels,
  messages,
  recentSearches,
  onSelectRecent,
  showSuggestions = true,
  showInput = false,
  anchorWidth = 'calc(35% - 32px)',
}: ChatSearchBarProps) {
  // The duplicate header input was removed in favour of the parent's outer
  // toolbar search input, which is the single source of truth. No focus
  // hook is needed here - the outer input is already focused when the user
  // opens the popover.

  // When the input has text, surface up to 5 matching messages and channel
  // shortcuts so the user can dive in without leaving the popover.
  const trimmed = query.trim().toLowerCase()
  const matchingMessages = useMemo(() => {
    if (!trimmed) return []
    return messages
      .filter(m => m.text.toLowerCase().includes(trimmed) || m.authorName.toLowerCase().includes(trimmed))
      .slice(0, 6)
  }, [trimmed, messages])
  const matchingChannels = useMemo(() => {
    if (!trimmed) return []
    return channels.filter(c => c.name.toLowerCase().includes(trimmed)).slice(0, 4)
  }, [trimmed, channels])

  const channelById = useMemo(() => {
    const m = new Map<string, ChatSearchChannel>()
    channels.forEach(c => m.set(c.id, c))
    return m
  }, [channels])

  // Flatten the popover's selectable rows in their visual render order so
  // ↑/↓ can traverse them. Each entry carries the action to fire on Enter,
  // matching that row's onClick handler.
  type Item =
    | { key: string; kind: 'search-current'; activate: () => void }
    | { key: string; kind: 'channel'; activate: () => void }
    | { key: string; kind: 'message'; activate: () => void }
    | { key: string; kind: 'recent'; activate: () => void }
  const items: Item[] = useMemo(() => {
    const out: Item[] = []
    if (trimmed) {
      if (currentChannel) {
        out.push({
          key: 'search-current',
          kind: 'search-current',
          activate: () => {
            if (onSubmitInChannel) onSubmitInChannel(currentChannel.id, query)
            else onSubmit(query)
          },
        })
      }
      matchingChannels.forEach(c => {
        out.push({ key: `ch-${c.id}`, kind: 'channel', activate: () => onSubmit(c.name) })
      })
      matchingMessages.forEach(m => {
        out.push({ key: `msg-${m.id}`, kind: 'message', activate: () => onSubmit(query) })
      })
    } else {
      recentSearches.forEach(q => {
        out.push({ key: `rec-${q}`, kind: 'recent', activate: () => onSelectRecent(q) })
      })
    }
    return out
  }, [trimmed, currentChannel, matchingChannels, matchingMessages, recentSearches, query, onSubmit, onSubmitInChannel, onSelectRecent])

  const [activeIndex, setActiveIndex] = useState(-1)
  // Reset focus index whenever the visible items change so the highlight
  // never points past the end of the list.
  useEffect(() => {
    setActiveIndex(idx => (items.length === 0 ? -1 : Math.min(Math.max(idx, 0), items.length - 1)))
  }, [items])
  // Reset to "no selection" whenever the user types so a fresh query
  // doesn't carry the previous highlight forward.
  useEffect(() => { setActiveIndex(-1) }, [trimmed])

  // Selectable-row indices, by render section, so the JSX below can read
  // its row index without a counter variable.
  let cursor = 0
  const searchCurrentIndex = trimmed && currentChannel ? cursor++ : -1
  const channelStartIndex = trimmed && matchingChannels.length > 0 ? cursor : -1
  if (trimmed) cursor += matchingChannels.length
  const messageStartIndex = trimmed && matchingMessages.length > 0 ? cursor : -1
  if (trimmed) cursor += matchingMessages.length
  const recentStartIndex = !trimmed ? 0 : -1

  // Keyboard navigation runs against `document` so the parent's outer
  // toolbar search input - which is the only visible search bar now -
  // drives ↑/↓/Enter/Esc through the popover.
  useEffect(() => {
    if (!showSuggestions) return undefined
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        if (items.length === 0) return
        e.preventDefault()
        setActiveIndex(idx => (idx + 1) % items.length)
      } else if (e.key === 'ArrowUp') {
        if (items.length === 0) return
        e.preventDefault()
        setActiveIndex(idx => (idx <= 0 ? items.length - 1 : idx - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (activeIndex >= 0 && items[activeIndex]) {
          // User explicitly arrowed to a row - activate that row (open the
          // matching channel / message).
          items[activeIndex].activate()
        } else {
          // No row focused - Enter opens the focused search results view
          // with the filters bar at the top.
          onSubmit(query)
        }
      } else if (e.key === 'Tab' && !e.shiftKey) {
        // Tab is the shortcut for "Search in #channel" - fires the
        // in-conversation search when the user is in a channel and has
        // typed a query. Mirrors the badge rendered on the Search-in
        // row. Shift+Tab is left alone so the outer focus order isn't
        // hijacked.
        if (currentChannel && trimmed) {
          e.preventDefault()
          if (onSubmitInChannel) onSubmitInChannel(currentChannel.id, query)
          else onSubmit(query)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showSuggestions, items, activeIndex, onClose, onSubmit, onSubmitInChannel, query, currentChannel, trimmed])

  return (
    <>
      {/* Backdrop - lightly dimmed scrim scoped to the chat-panel area so
          the parent's outer toolbar search input stays bright and typable.
          Click anywhere on the dim area to dismiss the popover. */}
      {showSuggestions && (
        <div
          className="absolute inset-0 z-20 bg-black/15"
          onMouseDown={e => { e.preventDefault(); onClose() }}
          aria-hidden="true"
        />
      )}
      <div
        className={cn(
          'absolute z-30',
          showInput
            ? 'left-1/2 -translate-x-1/2 top-0 w-[80%]'
            // Sidebar-driven search: anchor the dropdown directly under the
            // left column's Search input (px-4 padding + the row's height)
            // and match its width so the popover reads as a continuation of
            // the input.
            : 'left-4 top-[57px]',
        )}
        style={showInput ? undefined : { width: anchorWidth }}
      >
        {/* In-conversation input - only renders when the search was opened
            from the chat header's Search icon. The toolbar-driven flow keeps
            showInput false so the parent's outer input is the only search
            field on screen. */}
        {showInput && (
          <div className="flex items-center gap-2 px-4 h-12 bg-white border border-[var(--color-slate-300)] rounded-lg shadow-[0_8px_24px_rgba(15,23,42,0.10)] mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => onQueryChange(e.target.value)}
                placeholder="Search messages…"
                className="w-full h-9 pl-9 pr-9 text-[13px] border border-[var(--color-slate-300)] rounded-md bg-[var(--color-slate-50)] outline-none focus:border-[var(--color-sky-500)] focus:bg-white transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => onQueryChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-[var(--color-slate-400)] hover:text-[var(--color-slate-500)] hover:bg-muted/50 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted/50 text-[var(--color-slate-400)] hover:text-[var(--color-slate-500)] transition-colors"
              aria-label="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Popover - suggestions + recent searches. Slate-300 borders so the
            dropdown reads as one cohesive card anchored beneath the search
            input. Hidden once the user submits (results mode) so the
            full-page results view takes over. */}
        {showSuggestions && (
          <div className="bg-white border border-[var(--color-slate-300)] rounded-lg overflow-hidden shadow-[0_8px_24px_rgba(15,23,42,0.10)]">
            {/* Primary action - "Search in #channel". Neutral surface so it
                doesn't compete with the brand-blue highlight; only the active
                (keyboard / hover) state lifts to the brand-blue tint, matching
                the rest of the popover rows. */}
            {currentChannel && (() => {
              const isDM = currentChannel.type === 'dm'
              const tint = searchAvatarColor(currentChannel.name)
              const initials = currentChannel.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (onSubmitInChannel) onSubmitInChannel(currentChannel.id, query)
                    else onSubmit(query)
                  }}
                  onMouseEnter={() => searchCurrentIndex >= 0 && setActiveIndex(searchCurrentIndex)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors border-b border-[var(--color-slate-300)]',
                    activeIndex === searchCurrentIndex ? 'bg-[var(--color-brand-75)]' : 'bg-white hover:bg-[var(--color-brand-75)]',
                  )}
                >
                  {isDM ? (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] shrink-0"
                      style={{ backgroundColor: tint.bg, color: tint.text, fontWeight: 600 }}
                    >
                      {initials}
                    </div>
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: tint.bg, color: tint.text }}
                    >
                      {currentChannel.type === 'private'
                        ? <Lock className="w-3.5 h-3.5" />
                        : <Hash className="w-3.5 h-3.5" />}
                    </div>
                  )}
                  <span className="text-[13px] text-foreground flex-1 min-w-0 truncate">
                    Search in <span className="font-semibold">{isDM ? currentChannel.name : `#${currentChannel.name}`}</span>
                  </span>
                  {/* Tab is the shortcut for this row - badge mirrors the
                      keyboard hint in the footer so users learn that Tab
                      scopes the search to this conversation while Enter
                      opens the broader results view. */}
                  <kbd className="ml-2 px-1.5 py-0.5 rounded border border-[var(--color-slate-300)] bg-white text-[10px] font-medium text-[var(--color-slate-600)] shrink-0">Tab</kbd>
                </button>
              )
            })()}

            {/* Either matching messages/channels or recent searches. */}
            <div className="max-h-[340px] overflow-y-auto">
              {trimmed ? (
                <>
                  {matchingChannels.length === 0 && matchingMessages.length === 0 && (
                    <div className="px-4 py-5 text-[12.5px] text-muted-foreground text-center">
                      No quick matches. Press Enter to view all results.
                    </div>
                  )}
                  {matchingChannels.length > 0 && (
                    <div className="py-2">
                      <p className="px-4 pt-1 pb-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground/80">Channels</p>
                      {matchingChannels.map((c, i) => {
                        const idx = channelStartIndex + i
                        const isActive = activeIndex === idx
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onSubmit(c.name)}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors',
                              isActive ? 'bg-[var(--color-brand-75)]' : 'hover:bg-[var(--color-brand-75)]',
                            )}
                          >
                            <ChannelGlyph channel={c} className={isActive ? 'text-[var(--color-sky-500)]' : 'text-muted-foreground'} />
                            <span className="text-[13px] text-foreground truncate">{highlight(c.name, query)}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {matchingChannels.length > 0 && matchingMessages.length > 0 && (
                    <div className="border-t border-[var(--color-slate-200)]" />
                  )}
                  {matchingMessages.length > 0 && (
                    <div className="py-2">
                      <p className="px-4 pt-1 pb-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground/80">All search results</p>
                      {matchingMessages.map((m, i) => {
                        const ch = channelById.get(m.channelId)
                        const idx = messageStartIndex + i
                        const isActive = activeIndex === idx
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onSubmit(query)}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={cn(
                              'w-full flex items-start gap-2.5 px-4 py-2.5 text-left transition-colors',
                              isActive ? 'bg-[var(--color-brand-75)]' : 'hover:bg-[var(--color-brand-75)]',
                            )}
                          >
                            <Search className={cn('w-3.5 h-3.5 shrink-0 mt-1', isActive ? 'text-[var(--color-sky-500)]' : 'text-muted-foreground')} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="font-medium text-foreground/80">{highlight(m.authorName, query)}</span>
                                {ch && <span>·</span>}
                                {ch && <span>#{ch.name}</span>}
                                <span>·</span>
                                <span>{m.timestamp}</span>
                              </div>
                              <p className="text-[12.5px] text-foreground/90 truncate">{highlight(m.text, query)}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                recentSearches.length > 0 && (
                  <div className="py-2">
                    <p className="px-4 pt-1 pb-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground/80">Recent searches</p>
                    {recentSearches.map((q, i) => {
                      const idx = recentStartIndex + i
                      const isActive = activeIndex === idx
                      return (
                        <button
                          key={q}
                          type="button"
                          onClick={() => onSelectRecent(q)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors',
                            isActive ? 'bg-[var(--color-brand-75)]' : 'hover:bg-[var(--color-brand-75)]',
                          )}
                        >
                          <Clock className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-[var(--color-sky-500)]' : 'text-muted-foreground')} />
                          <span className="text-[13px] text-foreground">{q}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              )}
            </div>

            {/* Footer keyboard hints. Darker slate background so the rail
                visually anchors the popover and reads as a distinct utility
                strip from the white results above. */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--color-slate-300)] bg-[var(--color-slate-200)] text-[11px] text-[var(--color-slate-600)]">
              <span className="inline-flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded border border-[var(--color-slate-300)] bg-white text-[10px] font-medium">↑</kbd><kbd className="px-1.5 py-0.5 rounded border border-[var(--color-slate-300)] bg-white text-[10px] font-medium">↓</kbd> Select</span>
              <span className="inline-flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded border border-[var(--color-slate-300)] bg-white text-[10px] font-medium">Enter</kbd> Open</span>
              {currentChannel && trimmed && (
                <span className="inline-flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded border border-[var(--color-slate-300)] bg-white text-[10px] font-medium">Tab</kbd> Search in {currentChannel.type === 'dm' ? currentChannel.name : `#${currentChannel.name}`}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* PORT_MARKER_3 */
