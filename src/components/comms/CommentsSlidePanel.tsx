/* Ported from the financial reporting module's comms cluster
   (components/fr/comms/CommentsSlidePanel.tsx).

   Every comment on the thread, grouped under the message it answers, with the
   composer pinned at the top so a long thread never has to be scrolled to say
   something. Colour references are the source's own primitives, declared under
   `[data-comms]` in index.css: translating them into this module's scales is
   what made the previous port drift. */
import { useState, useRef, useMemo, useEffect, type KeyboardEvent, type ReactNode } from 'react'
import { Send, Check, CornerDownRight, MessageSquare } from 'lucide-react'
import { cn } from '../../lib/utils'
import { SlideOver, Tooltip } from '../ui'
import type { CommMessage } from '../../lib/comms'
import type { EmailComment } from './commentsData'

const avatarColors = [
  { bg: 'var(--color-blue-100)', text: 'var(--color-blue-800)' },
  { bg: 'var(--color-red-50)', text: 'var(--color-red-800)' },
  { bg: 'var(--color-emerald-100)', text: 'var(--color-emerald-800)' },
  { bg: 'var(--color-amber-100)', text: 'var(--color-amber-800)' },
  { bg: 'var(--color-blue-100)', text: 'var(--color-indigo-800)' },
  { bg: 'var(--color-red-200)', text: 'var(--color-red-800)' },
  { bg: 'var(--color-emerald-100)', text: 'var(--color-emerald-800)' },
  { bg: 'var(--color-orange-200)', text: 'var(--color-orange-800)' },
  { bg: 'var(--color-violet-200)', text: 'var(--color-violet-800)' },
  { bg: 'var(--color-brand-175)', text: 'var(--color-brand-800)' },
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

/* Mention candidates. Mirrors the module's own cast, kept local because comments
   are mock data and the panel stays self-contained. */
const MENTION_USERS: { name: string; initials: string; role?: string }[] = [
  { name: 'Ayesha Khan', initials: 'AK', role: 'Controller' },
  { name: 'Daniel Osei', initials: 'DO', role: 'Accountant' },
  { name: 'Priya Raman', initials: 'PR', role: 'Financial Analyst' },
  { name: 'Tom Brennan', initials: 'TB', role: 'Group Reporting' },
  { name: 'Mahad Ejaz', initials: 'ME', role: 'Finance Manager' },
  { name: 'Sarah Henderson', initials: 'SH' },
  { name: 'Drew Carter', initials: 'DC' },
  { name: 'Emma Brooks', initials: 'EB' },
  { name: 'Paige Kennedy', initials: 'PK' },
  { name: 'Rachel Kim', initials: 'RK' },
]

const CURRENT_COMMENTER = { name: 'Mahad Ejaz', initials: 'ME' }

/* The avatar a person reads as. shadcn's Avatar/AvatarFallback pair is a tinted
   circle holding initials, so it ports as one. */
function CommentAvatar({ name, initials, size }: { name: string; initials: string; size: 'sm' | 'md' }) {
  const color = getAvatarColor(name)
  const role = MENTION_USERS.find(u => u.name === name)?.role
  return (
    <Tooltip content={role ? `${name} · ${role}` : name} side="bottom">
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full shrink-0 mt-0.5 border border-[var(--color-mist-450)]',
          size === 'md' ? 'w-7 h-7 text-[10px]' : 'w-5 h-5 text-[8px]',
        )}
        style={{ fontWeight: 600, backgroundColor: color.bg, color: color.text }}
      >
        {initials}
      </span>
    </Tooltip>
  )
}

/**
 * Render comment text with @-mentions highlighted. Matches against the known
 * MENTION_USERS list (longest-first) so only real mentions are styled and
 * tokens like email addresses are left alone.
 */
function renderCommentText(text: string): ReactNode {
  if (!text) return text
  const names = MENTION_USERS.map(u => u.name).sort((a, b) => b.length - a.length)
  const pattern = new RegExp(
    `@(${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g',
  )
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(pattern)) {
    const start = m.index ?? 0
    if (start > last) out.push(text.slice(last, start))
    out.push(
      <span
        key={`m-${start}`}
        className="inline-flex items-center px-1 py-0 rounded text-[var(--color-sky-500)] bg-[var(--color-brand-75)] font-medium"
      >
        @{m[1]}
      </span>,
    )
    last = start + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.length > 0 ? out : text
}

/**
 * contentEditable composer for comments. Typing `@` opens a name picker;
 * picking a name inserts a styled chip directly into the editor so the mention
 * is visible while the user is still drafting. `value` / `onChange` carry the
 * flattened plain-text representation (`@Name`) so the rest of the panel keeps
 * treating comments as strings.
 *
 * Caret note: the DOM is synced from `value` only when the value resets to
 * empty (post-submit clear), otherwise the editor is uncontrolled, which keeps
 * the caret stable while the user is typing.
 */
function MentionEditable({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel,
  className,
  autoFocus,
}: {
  value: string
  onChange: (next: string) => void
  onSubmit?: () => void
  placeholder: string
  ariaLabel: string
  className?: string
  autoFocus?: boolean
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const matches = useMemo(() => {
    if (!mentionOpen) return []
    const q = mentionQuery.toLowerCase()
    return MENTION_USERS.filter(u => u.name.toLowerCase().includes(q)).slice(0, 5)
  }, [mentionOpen, mentionQuery])

  const readPlain = (): string => editorRef.current?.innerText ?? ''

  // Only on a parent-driven clear. Re-writing the DOM for arbitrary value
  // changes would clobber the caret and the live chip styling while typing.
  useEffect(() => {
    if (!editorRef.current) return
    if (value === '' && readPlain() !== '') {
      editorRef.current.innerHTML = ''
    }
  }, [value])

  useEffect(() => {
    if (autoFocus) editorRef.current?.focus()
  }, [autoFocus])

  // Look at the text immediately before the caret: an `@` preceded by
  // start-of-input or whitespace, with no whitespace between it and the caret,
  // means an active mention token.
  const refreshMentionState = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !editorRef.current) {
      setMentionOpen(false)
      return
    }
    const range = sel.getRangeAt(0)
    if (!editorRef.current.contains(range.startContainer)) {
      setMentionOpen(false)
      return
    }
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) {
      setMentionOpen(false)
      return
    }
    const text = node.textContent ?? ''
    const caret = range.startOffset
    const before = text.slice(0, caret)
    const atIdx = before.lastIndexOf('@')
    if (atIdx === -1) {
      setMentionOpen(false)
      return
    }
    const prev = atIdx === 0 ? ' ' : before[atIdx - 1]
    if (!/\s/.test(prev)) {
      setMentionOpen(false)
      return
    }
    const token = before.slice(atIdx + 1)
    if (/\s/.test(token)) {
      setMentionOpen(false)
      return
    }
    setMentionOpen(true)
    setMentionQuery(token)
    setActiveIndex(0)
  }

  const handleInput = () => {
    onChange(readPlain())
    refreshMentionState()
  }

  const insertMention = (name: string) => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) return
    const text = node.textContent ?? ''
    const caret = range.startOffset
    const atIdx = text.slice(0, caret).lastIndexOf('@')
    if (atIdx === -1) return
    const tokenRange = document.createRange()
    tokenRange.setStart(node, atIdx)
    tokenRange.setEnd(node, caret)
    tokenRange.deleteContents()

    const chip = document.createElement('span')
    chip.setAttribute('data-mention', name)
    chip.contentEditable = 'false'
    chip.className = 'inline-flex items-center px-1 py-0 rounded font-medium align-baseline'
    chip.style.color = 'var(--color-sky-500)'
    chip.style.backgroundColor = 'var(--color-brand-75)'
    chip.textContent = `@${name}`
    const space = document.createTextNode(' ')

    tokenRange.insertNode(space)
    tokenRange.insertNode(chip)

    const newRange = document.createRange()
    newRange.setStartAfter(space)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)

    setMentionOpen(false)
    setMentionQuery('')
    setActiveIndex(0)
    onChange(readPlain())
    editorRef.current.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (mentionOpen && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => (i + 1) % matches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => (i - 1 + matches.length) % matches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(matches[activeIndex].name)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionOpen(false)
        return
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="relative">
      <div
        ref={editorRef}
        role="textbox"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={refreshMentionState}
        onMouseUp={refreshMentionState}
        aria-label={ariaLabel}
        data-placeholder={placeholder}
        className={cn(
          'min-h-[56px] outline-none whitespace-pre-wrap break-words',
          'empty:before:content-[attr(data-placeholder)]',
          className,
        )}
      />
      {mentionOpen && matches.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-20 rounded-md border border-border bg-popover shadow-md overflow-hidden"
          role="listbox"
          aria-label="Mention suggestions"
        >
          {matches.map((u, i) => {
            const color = getAvatarColor(u.name)
            return (
              <button
                key={u.name}
                type="button"
                onMouseDown={e => { e.preventDefault(); insertMention(u.name) }}
                onMouseEnter={() => setActiveIndex(i)}
                role="option"
                aria-selected={i === activeIndex}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors',
                  i === activeIndex ? 'bg-muted/60' : 'hover:bg-muted/40',
                )}
              >
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] shrink-0"
                  style={{ fontWeight: 600, backgroundColor: color.bg, color: color.text }}
                >
                  {u.initials}
                </span>
                <span className="text-[12px] text-foreground truncate" style={{ fontWeight: 500 }}>{u.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CommentsSlidePanel({
  open,
  onClose,
  comments,
  messages,
  subject,
  totalCount,
  onAddComment,
  onReply,
  onResolve,
  onHighlightMessage,
  targetMessageId,
}: {
  open: boolean
  onClose: () => void
  comments: EmailComment[]
  /** The thread's messages, which is what a comment is grouped under. */
  messages: CommMessage[]
  subject: string
  /** Comments plus their replies, so the panel agrees with the pill that opened it. */
  totalCount: number
  onAddComment: (messageId: string, text: string) => void
  onReply: (commentId: string, text: string) => void
  onResolve: (commentId: string) => void
  onHighlightMessage: (messageId: string | null) => void
  /** The message the panel was opened from, which a new comment goes on. The
   *  last message when it was opened from the thread's own Comments pill. */
  targetMessageId?: string | null
}) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [newCommentText, setNewCommentText] = useState('')
  const [commentFilter, setCommentFilter] = useState<'all' | 'unread' | 'resolved'>('all')

  const filteredComments = commentFilter === 'all'
    ? comments
    : commentFilter === 'unread'
      ? comments.filter(c => !c.isRead)
      : comments.filter(c => c.isResolved)

  const messageIds = Array.from(new Set(filteredComments.map(c => c.emailId)))
  const groupedComments = messageIds.map(messageId => ({
    messageId,
    message: messages.find(m => m.id === messageId),
    comments: filteredComments.filter(c => c.emailId === messageId),
  }))

  const handleSubmitReply = (commentId: string) => {
    if (!replyText.trim()) return
    onReply(commentId, replyText.trim())
    setReplyText('')
    setReplyingTo(null)
  }

  /* The target message is read at the moment of posting rather than held in
     state. The source stashed it on the first click and only posted on the
     second, so a comment typed and posted once went nowhere. */
  const goToMessage = (messageId: string) => {
    onClose()
    onHighlightMessage(messageId)
    window.setTimeout(() => onHighlightMessage(null), 2500)
    window.setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${messageId}"]`) ?? document.getElementById(`message-${messageId}`)
      ;(el as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }

  const handleSubmitNewComment = () => {
    const target = (targetMessageId && messages.some(m => m.id === targetMessageId) ? targetMessageId : null)
      ?? messages[messages.length - 1]?.id
    if (!newCommentText.trim() || !target) return
    onAddComment(target, newCommentText.trim())
    setNewCommentText('')
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Comments"
      subtitle={`${totalCount} comment${totalCount === 1 ? '' : 's'} on this thread`}
      widthClass="max-w-[432px]"
    >
      <div className="flex flex-col">
        {/* Pinned above the list so it is reachable without scrolling a long
            thread. The internal-only notice sits above the input so it sets
            context before the reader types. */}
        <div className="sticky top-0 z-10 bg-white">
          <div className="border-b border-border px-5 py-3">
            <p className="text-[10px] text-muted-foreground/60 mb-2 px-0.5">
              Comments are only visible internally and are not shared with external users
            </p>
            <div className="flex items-start gap-2.5">
              <CommentAvatar name={CURRENT_COMMENTER.name} initials={CURRENT_COMMENTER.initials} size="md" />
              <div className="flex-1 min-w-0">
                <MentionEditable
                  value={newCommentText}
                  onChange={setNewCommentText}
                  onSubmit={handleSubmitNewComment}
                  placeholder="Add a comment... use @ to mention"
                  ariaLabel="Add a comment"
                  className="w-full text-[13px] text-foreground bg-white border border-border rounded-md px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                />
                {newCommentText.trim() && (
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={handleSubmitNewComment}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] text-white rounded-md transition-colors"
                      style={{ fontWeight: 500, backgroundColor: 'var(--color-sky-500)' }}
                    >
                      <Send className="w-3 h-3" /> Post
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border">
            {([
              { key: 'all' as const, label: 'All', count: comments.length },
              { key: 'unread' as const, label: 'Unread', count: comments.filter(c => !c.isRead).length },
              { key: 'resolved' as const, label: 'Resolved', count: comments.filter(c => c.isResolved).length },
            ]).map(pill => (
              <button
                key={pill.key}
                onClick={() => setCommentFilter(pill.key)}
                aria-pressed={commentFilter === pill.key}
                aria-label={`${pill.label} comments (${pill.count})`}
                className={cn(
                  'inline-flex items-center gap-1 h-7 px-3 rounded-full border text-[12px] transition-colors cursor-pointer',
                  commentFilter === pill.key
                    ? 'border-[var(--color-sky-500)]/30 text-[var(--color-sky-500)] bg-[var(--color-brand-75)]'
                    : 'border-border text-muted-foreground bg-background hover:bg-muted/50',
                )}
                style={{ fontWeight: commentFilter === pill.key ? 600 : 400 }}
              >
                {pill.label}
                <span className={cn(
                  'text-[10px] ml-0.5',
                  commentFilter === pill.key ? 'text-[var(--color-sky-500)]/70' : 'text-muted-foreground',
                )}>
                  ({pill.count})
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {groupedComments.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <MessageSquare style={{ width: '20px', height: '20px', color: 'var(--color-grey-300)', margin: '0 auto 8px' }} />
              <div style={{ fontSize: '12px', color: 'var(--color-grey-400)', lineHeight: '1.4' }}>
                No comments yet
              </div>
            </div>
          ) : (
            groupedComments.map(group => (
              <div
                key={group.messageId}
                className="rounded-lg border border-border bg-white overflow-hidden"
              >
                <button
                  className="w-full text-left px-4 py-2.5 bg-muted/40 border-b border-border hover:bg-muted/60 transition-colors"
                  onMouseEnter={() => onHighlightMessage(group.messageId)}
                  onMouseLeave={() => onHighlightMessage(null)}
                  // Takes the reader to the message the comments are on, the way
                  // the attachments panel's Go to message does.
                  onClick={() => goToMessage(group.messageId)}
                >
                  <p className="text-[12px] font-medium text-muted-foreground">
                    From: <span className="text-foreground font-semibold">
                      {group.message?.from}
                    </span>
                  </p>
                  {subject && (
                    <p className="text-[12px] font-medium text-muted-foreground mt-0.5 truncate">
                      Subject: <span className="text-foreground font-semibold">
                        {subject}
                      </span>
                    </p>
                  )}
                </button>

                <div className="p-3 space-y-2">
                  {group.comments.map(comment => (
                    <div
                      key={comment.id}
                      className={cn(
                        'rounded-md p-3 bg-muted/25 border border-border/70',
                        comment.isResolved && 'opacity-50',
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <CommentAvatar name={comment.authorName} initials={comment.authorInitials} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-semibold text-foreground">{comment.authorName}</span>
                            <span className="text-[11px] text-muted-foreground">· {comment.timestamp}</span>
                            {!comment.isRead && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-[13px] text-foreground mt-1.5 leading-relaxed">{renderCommentText(comment.text)}</p>
                          {comment.isResolved && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 mt-2 font-medium">
                              <Check className="w-3 h-3" /> Resolved
                            </span>
                          )}
                          <div className="flex items-center gap-3 mt-2.5">
                            <button
                              onClick={() => { setReplyingTo(replyingTo === comment.id ? null : comment.id); setReplyText('') }}
                              className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                            >
                              Reply
                            </button>
                            {/* Resolving can be undone: onResolve toggles. */}
                            <button
                              onClick={() => onResolve(comment.id)}
                              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {comment.isResolved ? 'Reopen' : 'Resolve'}
                            </button>
                          </div>

                          {comment.replies.length > 0 && (
                            <div className="mt-3 space-y-2 pl-3 border-l-2 border-border">
                              {comment.replies.map(reply => (
                                <div key={reply.id} className="flex items-start gap-2">
                                  <CommentAvatar name={reply.authorName} initials={reply.authorInitials} size="sm" />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[11px] font-semibold text-foreground">{reply.authorName}</span>
                                      <span className="text-[10px] text-muted-foreground">· {reply.timestamp}</span>
                                    </div>
                                    <p className="text-[12px] text-foreground mt-0.5 leading-relaxed">{renderCommentText(reply.text)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {replyingTo === comment.id && (
                            <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border/40">
                              <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1.5" />
                              <div className="flex-1">
                                <MentionEditable
                                  value={replyText}
                                  onChange={setReplyText}
                                  onSubmit={() => handleSubmitReply(comment.id)}
                                  placeholder="Write a reply... use @ to mention"
                                  ariaLabel="Reply to comment"
                                  autoFocus
                                  className="w-full text-[12px] text-foreground bg-white border border-border rounded-md px-2.5 py-1.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                                />
                                {replyText.trim() && (
                                  <div className="flex justify-end mt-1.5">
                                    <button
                                      onClick={() => handleSubmitReply(comment.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] text-white rounded-md transition-colors"
                                      style={{ fontWeight: 500, backgroundColor: 'var(--color-sky-500)' }}
                                    >
                                      <Send className="w-3 h-3" /> Reply
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </SlideOver>
  )
}
