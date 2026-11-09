/* Ported from the financial reporting module (components/fr/comms/InlineReplyPane.tsx
   and the EmailComposeInline it wraps, from communications-compose-modal.tsx).

   The in-thread compose: reply, reply all, forward, anchored below the message
   it answers rather than opening a popout. The source split this in two - a pane
   that supplies the avatar, the mode label, the pop-out and the close, and an
   inline compose passed to it as children. Both halves are here, because the
   pane on its own opens onto nothing and the whole point of the surface is that
   replying works. `children` still overrides the built-in compose, so the
   source's contract survives.

   Colours are the source's own primitives, which resolve because this renders
   inside the tab's `data-comms` root. Translating them into this module's
   scales is what made an earlier attempt drift. */
import {
  useCallback, useEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type ReactNode,
} from 'react'
import {
  Bold, ExternalLink, Eye, EyeOff, Italic, Link2, List, ListOrdered, MailCheck,
  Paperclip, Plus, Send, Star, Strikethrough, Underline, X,
} from 'lucide-react'
import { ConfirmModal, Tooltip } from '../ui'
import { AttachmentCard } from './AttachmentCard'
import { InsertLinkDialog } from './InsertLinkDialog'
import { useStore } from '../../store'
import { cn } from '../../lib/utils'
import {
  CURRENT_USER, avatarTint, initialsOf,
  type CommChannel, type CommMessage, type CommThread,
} from '../../lib/comms'

/* The target already spells reply-all `replyAll`; the source spells it
   `reply-all`. Both are accepted so neither side needs a conversion shim. */
export type InlineReplyMode = 'reply' | 'reply-all' | 'replyAll' | 'forward'

type Mode = 'reply' | 'reply-all' | 'forward'

function normaliseMode(mode: InlineReplyMode): Mode {
  return mode === 'replyAll' ? 'reply-all' : mode
}

/** What the reader gets back when they press Send. */
export interface InlineReplyDraft {
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  /** HTML, because the body is composed in a rich-text editor. */
  body: string
  isConfidential: boolean
  isReadReceiptRequested: boolean
  attachments: { name: string; size: string }[]
}

/** The pane's opening position, derived from the message being answered. */
export interface InlineReplyState {
  mode: Mode
  to: string[]
  subject: string
  body: string
  afterMessageId: string
  primaryToEmail?: string
  primaryToName?: string
}

const ATTACHMENT_GRID = 'repeat(auto-fill, 156px)'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The quoted original, in the source's exact shape: a rule, the attribution
 *  line, then the body prefixed line by line. */
export function formatQuotedBody(m: CommMessage): string {
  const quoted = m.body.split('\n').map(l => `&gt; ${escapeHtml(l)}`).join('<br/>')
  return `<br/><br/><hr style="border:none;border-top:1px solid var(--color-slate-200);margin:12px 0"/>`
    + `On ${escapeHtml(m.timestamp)}, <b>${escapeHtml(m.from)}</b> &lt;${escapeHtml(m.fromEmail)}&gt; wrote:<br/>${quoted}`
}

/** Recipients, subject and quoted body for one of the three openers, the way
 *  the source's openReply / openReplyAll / openForward built them. */
export function inlineReplyStateFor(
  thread: CommThread,
  message: CommMessage,
  mode: InlineReplyMode,
): InlineReplyState {
  const normalised = normaliseMode(mode)
  const body = formatQuotedBody(message)
  const afterMessageId = message.id

  if (normalised === 'forward') {
    return {
      mode: 'forward',
      to: [],
      subject: thread.subject.startsWith('Fwd:') ? thread.subject : `Fwd: ${thread.subject}`,
      body,
      afterMessageId,
    }
  }

  const primaryToName = message.isOutbound ? message.to : message.from
  const primaryToEmail = message.isOutbound ? message.toEmail : message.fromEmail
  const subject = thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`

  if (normalised === 'reply') {
    return { mode: 'reply', to: [primaryToName].filter(Boolean), subject, body, afterMessageId, primaryToEmail, primaryToName }
  }

  const tos = new Set<string>()
  if (primaryToName) tos.add(primaryToName)
  if (!message.isOutbound && message.to) tos.add(message.to)
  for (const x of thread.messages) {
    if (!x.isOutbound && x.from && x.from !== CURRENT_USER.name) tos.add(x.from)
  }
  tos.delete(CURRENT_USER.name)
  return { mode: 'reply-all', to: [...tos], subject, body, afterMessageId, primaryToEmail, primaryToName }
}

/* The addresses that actually appear in this module's threads, so the recipient
   suggestions name people the reader has seen rather than inventing a
   directory. Callers with a real participant list pass `directory` instead. */
export interface DirectoryContact { name: string; email: string }

const EMAIL_DIRECTORY: DirectoryContact[] = [
  { name: 'Ayesha Khan', email: 'ayesha.khan@omne.example' },
  { name: 'Daniel Osei', email: 'daniel.osei@omne.example' },
  { name: 'Priya Raman', email: 'priya.raman@omne.example' },
  { name: 'Tom Brennan', email: 'tom.brennan@omne.example' },
  { name: 'Hartley & Co', email: 'reviews@hartleyco.example' },
  { name: 'Meridian Supplies', email: 'ap@meridiansupplies.example' },
  { name: 'Group treasury', email: 'treasury@omne.example' },
]

function ContactDropdown({ query, recipients, existingChips, onSelect, visible, directory }: {
  query: string
  recipients: string[]
  existingChips: string[]
  onSelect: (email: string) => void
  visible: boolean
  directory: DirectoryContact[]
}) {
  if (!visible) return null
  const q = query.trim().toLowerCase()
  const taken = new Set(existingChips.map(c => c.toLowerCase()))
  const isTaken = (c: DirectoryContact) =>
    taken.has(c.email.toLowerCase()) || taken.has(c.name.toLowerCase())

  let results: DirectoryContact[]
  if (q) {
    // Matched against both the name and the address, so typing part of an
    // address surfaces the person behind it.
    results = directory.filter(
      c => !isTaken(c) && (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)),
    )
  } else {
    // Nothing typed yet: lead with the thread's own participants.
    const suggested = new Set(recipients.map(r => r.toLowerCase()))
    results = directory.filter(c => !isTaken(c) && suggested.has(c.name.toLowerCase()))
  }
  results = results.slice(0, 6)
  if (results.length === 0) return null

  return (
    <div className="absolute top-full left-0 mt-1 w-full max-h-[220px] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
      {results.map(c => {
        const tint = avatarTint(c.name)
        return (
          <button
            key={c.email}
            type="button"
            onMouseDown={e => { e.preventDefault(); onSelect(c.email) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--color-slate-100)] transition-colors text-left"
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] shrink-0 border border-[var(--color-mist-450)]"
              style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 600 }}
            >
              {initialsOf(c.name)}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] text-[var(--color-slate-900)] truncate" style={{ fontWeight: 500 }}>{c.name}</span>
              <span className="block text-[11.5px] text-[var(--color-slate-500)] truncate">{c.email}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ChipTag({ label, onRemove, isPrimary }: { label: string; onRemove: () => void; isPrimary?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[12px] bg-gray-100 text-gray-700 border border-gray-200">
      <span style={{ fontWeight: 500 }}>{label}</span>
      {isPrimary && (
        <Tooltip content="Primary contact">
          <span className="inline-flex items-center justify-center shrink-0 cursor-help" aria-label="Primary contact">
            <Star className="w-[11px] h-[11px]" fill="var(--color-blue-accent-600)" stroke="var(--color-blue-800)" strokeWidth={1.25} />
          </span>
        </Tooltip>
      )}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="text-gray-500 hover:text-gray-700 transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

const FORMAT_BUTTONS: { icon: typeof Bold; command: string; label: string }[] = [
  { icon: Bold, command: 'bold', label: 'Bold' },
  { icon: Italic, command: 'italic', label: 'Italic' },
  { icon: Underline, command: 'underline', label: 'Underline' },
  { icon: Strikethrough, command: 'strikeThrough', label: 'Strikethrough' },
]

const LIST_BUTTONS: { icon: typeof List; command: string; label: string }[] = [
  { icon: List, command: 'insertUnorderedList', label: 'Bulleted list' },
  { icon: ListOrdered, command: 'insertOrderedList', label: 'Numbered list' },
]

export interface InlineReplyPaneProps {
  mode: InlineReplyMode
  onClose: () => void
  /** When present, the header renders the "Pop out" button. */
  onPopOut?: () => void
  /** Supplied instead of the built-in compose, the way the source passed it. */
  children?: ReactNode
  /** The channel of the message being answered. A note was never sent to
   *  anyone, so it has nothing to reply to. */
  channel?: CommChannel
  to?: string[]
  cc?: string[]
  bcc?: string[]
  subject?: string
  /** The quoted original, as HTML. `formatQuotedBody` builds it. */
  body?: string
  attachments?: { name: string; size: string }[]
  /** Names offered before the reader types anything. */
  suggestedRecipients?: string[]
  /** Chips that render with the "Primary" star. */
  primaryChipLabels?: string[]
  directory?: DirectoryContact[]
  isConfidential?: boolean
  isReadReceiptRequested?: boolean
  showCcBcc?: boolean
  onDraftChange?: (hasDraft: boolean) => void
  onSend?: (draft: InlineReplyDraft) => void
}

/**
 * Container for the in-thread reply / reply all / forward compose.
 *
 *   ┌── Avatar (me) ─┐  ┌─── mode ───┐  pop out  ✕
 *                       │ the compose            │
 *                       └───────────────────────-┘
 *
 * Scrolls itself into view on mount so the pane appears just below the fold
 * without the reader reaching for the wheel.
 */
export function InlineReplyPane({
  mode,
  onClose,
  onPopOut,
  children,
  channel = 'Email',
  to = [],
  cc,
  bcc,
  subject: initialSubject,
  body: initialBody,
  attachments: initialAttachments,
  suggestedRecipients = [],
  primaryChipLabels,
  directory = EMAIL_DIRECTORY,
  isConfidential: initialConfidential,
  isReadReceiptRequested: initialReadReceiptRequested,
  showCcBcc: initialShowCcBcc,
  onDraftChange,
  onSend,
}: InlineReplyPaneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const normalised = normaliseMode(mode)
  /* A note has no recipient to reply to, so the only outbound act on one is
     sending it out for the first time. Whatever mode the caller asked for, on a
     note the pane composes a send-out and says so in the header. */
  const isNote = channel === 'Note'
  const headerLabel = isNote
    ? 'Send as email'
    : normalised === 'forward'
      ? 'Forward'
      : normalised === 'reply-all'
        ? 'Reply all'
        : 'Reply'

  useEffect(() => {
    // A small delay so the row mounts and lays out before the scroll, then the
    // pane's end into view, then a further nudge so the jump reads as a
    // deliberate downward motion rather than a barely-perceptible snap.
    let nudge = 0
    const t = window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      nudge = window.setTimeout(() => {
        let node: HTMLElement | null = ref.current?.parentElement ?? null
        while (node) {
          const overflowY = window.getComputedStyle(node).overflowY
          if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
            node.scrollBy({ top: 96, behavior: 'smooth' })
            break
          }
          node = node.parentElement
        }
      }, 220)
    }, 40)
    return () => {
      window.clearTimeout(t)
      if (nudge) window.clearTimeout(nudge)
    }
  }, [])

  const meTint = { bg: 'var(--color-blue-100)', text: 'var(--color-blue-800)' }

  return (
    <div
      ref={ref}
      className="mx-[14px] my-[18px] border border-gray-200 rounded-lg bg-white shadow-md overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 h-12 bg-white border-b border-gray-200">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] shrink-0 border border-[var(--color-mist-450)]"
          style={{ backgroundColor: meTint.bg, color: meTint.text, fontWeight: 600 }}
        >
          {initialsOf(CURRENT_USER.name)}
        </span>
        <span className="text-[12px] font-medium text-muted-foreground flex-1 min-w-0 truncate">
          {headerLabel}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {onPopOut && (
            <Tooltip content="Pop out in new window">
              <button
                type="button"
                onClick={onPopOut}
                aria-label="Pop out in new window"
                className={cn(
                  'w-7 h-7 flex items-center justify-center rounded-md text-gray-500 transition-colors cursor-pointer',
                  'hover:bg-gray-200',
                )}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reply"
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div style={{ maxHeight: 420, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children ?? (
          <InlineCompose
            isNote={isNote}
            mode={normalised}
            initialTo={isNote ? [] : to}
            initialCc={cc}
            initialBcc={bcc}
            initialSubject={initialSubject}
            initialBody={initialBody}
            initialAttachments={initialAttachments}
            suggestedRecipients={suggestedRecipients}
            primaryChipLabels={primaryChipLabels}
            directory={directory}
            initialConfidential={initialConfidential}
            initialReadReceiptRequested={initialReadReceiptRequested}
            initialShowCcBcc={initialShowCcBcc}
            onDraftChange={onDraftChange}
            onSend={onSend}
          />
        )}
      </div>
    </div>
  )
}

/* ─── The compose the pane wraps ──────────────────────────────────────────
   The source's EmailComposeInline as the reply call site used it, with
   `hideSubjectAndRecord` set: the thread already prints the subject and the
   record chip above, so repeating either inside the pane says the same thing
   twice. The record row, the "not linked to a record" banner and the
   purchase-order read-receipt lock are the parts of the source that answer to a
   record picker this module's thread does not have, and are left out with it. */
function InlineCompose({
  isNote,
  mode,
  initialTo,
  initialCc,
  initialBcc,
  initialSubject,
  initialBody,
  initialAttachments,
  suggestedRecipients,
  primaryChipLabels,
  directory,
  initialConfidential,
  initialReadReceiptRequested,
  initialShowCcBcc,
  onDraftChange,
  onSend,
}: {
  isNote: boolean
  mode: Mode
  initialTo: string[]
  initialCc?: string[]
  initialBcc?: string[]
  initialSubject?: string
  initialBody?: string
  initialAttachments?: { name: string; size: string }[]
  suggestedRecipients: string[]
  primaryChipLabels?: string[]
  directory: DirectoryContact[]
  initialConfidential?: boolean
  initialReadReceiptRequested?: boolean
  initialShowCcBcc?: boolean
  onDraftChange?: (hasDraft: boolean) => void
  onSend?: (draft: InlineReplyDraft) => void
}) {
  const pushToast = useStore(s => s.pushToast)

  const [toChips, setToChips] = useState<string[]>(initialTo)
  const [toInput, setToInput] = useState('')
  const [showCcBcc, setShowCcBcc] = useState(
    initialShowCcBcc ?? ((initialCc?.length ?? 0) > 0 || (initialBcc?.length ?? 0) > 0),
  )
  const [ccChips, setCcChips] = useState<string[]>(initialCc ?? [])
  const [ccInput, setCcInput] = useState('')
  const [bccChips, setBccChips] = useState<string[]>(initialBcc ?? [])
  const [bccInput, setBccInput] = useState('')
  const [subject, setSubject] = useState(initialSubject ?? '')
  const [isConfidential, setIsConfidential] = useState(initialConfidential ?? false)
  const [isReadReceiptRequested, setIsReadReceiptRequested] = useState(initialReadReceiptRequested ?? false)
  const [toFocused, setToFocused] = useState(false)
  const [ccFocused, setCcFocused] = useState(false)
  const [bccFocused, setBccFocused] = useState(false)
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set())
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkText, setLinkText] = useState('')
  const [showNoSubjectConfirm, setShowNoSubjectConfirm] = useState(false)
  const [savedSelection, setSavedSelection] = useState<Range | null>(null)
  const [attachments, setAttachments] = useState<{ name: string; size: string }[]>(initialAttachments ?? [])
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* The quoted original has to be in the markup on first paint, not written in
     by an effect: an effect that has not run yet is a compose that opens
     showing none of the mail it is answering. Two empty divs keep the caret
     region tight at the top, and the wrapper puts a fixed gap before the
     quote. */
  const initialHtml = useMemo(
    () => (initialBody ? `<div><br></div><div><br></div><div style="margin-top:72px">${initialBody}</div>` : ''),
    [initialBody],
  )

  const initialSubjectRef = useRef(initialSubject ?? '')
  const initialToRef = useRef(initialTo)
  const initialBodyRef = useRef(initialBody ?? '')

  useEffect(() => {
    if (!initialBody || !editorRef.current) return
    editorRef.current.focus()
    const sel = window.getSelection()
    const firstNode = editorRef.current.firstChild
    if (!sel || !firstNode) return
    const range = document.createRange()
    range.setStart(firstNode, 0)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const reportDraft = useCallback(() => {
    if (!onDraftChange) return
    const bodyText = editorRef.current?.textContent || ''
    const tmp = document.createElement('div')
    tmp.innerHTML = initialBodyRef.current
    const initialBodyText = tmp.textContent || ''
    const toChanged = JSON.stringify(toChips) !== JSON.stringify(initialToRef.current)
    const subjectChanged = subject !== initialSubjectRef.current
    const bodyChanged = bodyText.trim() !== initialBodyText.trim()
    const ccChanged = ccChips.length > 0 || bccChips.length > 0
    onDraftChange(toChanged || subjectChanged || bodyChanged || ccChanged)
  }, [onDraftChange, toChips, ccChips, bccChips, subject])

  useEffect(() => { reportDraft() }, [reportDraft])

  const addChip = (value: string, chips: string[], setChips: (c: string[]) => void, setInput: (v: string) => void) => {
    const trimmed = value.trim()
    if (trimmed && !chips.includes(trimmed)) setChips([...chips, trimmed])
    setInput('')
  }

  const handleChipKeyDown = (
    e: ReactKeyboardEvent<HTMLInputElement>,
    input: string,
    chips: string[],
    setChips: (c: string[]) => void,
    setInput: (v: string) => void,
  ) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault()
      addChip(input, chips, setChips, setInput)
    } else if (e.key === 'Backspace' && !input && chips.length > 0) {
      setChips(chips.slice(0, -1))
    }
  }

  const removeChip = (index: number, chips: string[], setChips: (c: string[]) => void) => {
    setChips(chips.filter((_, i) => i !== index))
  }

  const updateActiveFormats = useCallback(() => {
    const formats = new Set<string>()
    for (const command of ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList']) {
      if (document.queryCommandState(command)) formats.add(command)
    }
    setActiveFormats(formats)
  }, [])

  const execCommand = (command: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false)
    updateActiveFormats()
    reportDraft()
  }

  const openLinkDialog = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      setSavedSelection(range.cloneRange())
      // Pre-fill the display text with the highlighted text, so a selection can
      // be turned into a link by supplying only a URL.
      setLinkText(sel.toString())
    } else {
      setSavedSelection(null)
      setLinkText('')
    }
    setShowLinkDialog(true)
  }

  const doSend = () => {
    if (toChips.length === 0) {
      // Every caller drops a send with no recipient, so it is refused here
      // rather than accepted and silently lost.
      pushToast(
        'Add a recipient',
        'info',
        isNote ? 'A note goes nowhere until you say who it is for.' : 'Say who this is going to.',
      )
      return
    }
    onSend?.({
      to: toChips,
      cc: ccChips,
      bcc: bccChips,
      subject,
      body: editorRef.current?.innerHTML ?? '',
      isConfidential,
      isReadReceiptRequested,
      attachments,
    })
  }

  const handleSendClick = () => {
    if (!subject.trim()) { setShowNoSubjectConfirm(true); return }
    doSend()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const added = Array.from(files).map(f => ({
        name: f.name,
        size: f.size < 1024 * 1024 ? `${Math.round(f.size / 1024)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      }))
      setAttachments(prev => [...prev, ...added])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const ConfidentialEyeIcon = isConfidential ? EyeOff : Eye
  const remainingSuggestions = suggestedRecipients.filter(r => !toChips.includes(r))
  const sendLabel = isNote ? 'Send out' : mode === 'forward' ? 'Forward' : 'Send'

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {isNote && (
        <div className="shrink-0 px-5 py-2 border-b border-gray-200 bg-[var(--color-mist-200)] flex items-center gap-1.5">
          <MailCheck className="w-3 h-3 text-gray-400 shrink-0" aria-hidden />
          <span className="text-[11px] text-gray-500 leading-tight">
            This note has never left the record. Sending it out puts it in the recipient's inbox as well.
          </span>
        </div>
      )}

      {/* Fields */}
      <div className="shrink-0 px-5 py-3 space-y-0 border-b border-gray-200">
        <div className="flex items-start gap-2 py-1.5">
          <span className="text-[12px] text-gray-500 pt-[5px] shrink-0" style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>To:</span>
          <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0 relative">
            {toChips.map((chip, i) => (
              <ChipTag
                key={i}
                label={chip}
                onRemove={() => removeChip(i, toChips, setToChips)}
                isPrimary={primaryChipLabels?.includes(chip)}
              />
            ))}
            <input
              type="text"
              value={toInput}
              onChange={e => setToInput(e.target.value)}
              onKeyDown={e => handleChipKeyDown(e, toInput, toChips, setToChips, setToInput)}
              onFocus={() => setToFocused(true)}
              onBlur={() => { setToFocused(false); if (toInput.trim()) addChip(toInput, toChips, setToChips, setToInput) }}
              placeholder={toChips.length === 0 ? 'Add recipients…' : ''}
              aria-label="To recipients"
              className="flex-1 min-w-[120px] text-[13px] text-gray-700 outline-none py-[3px] bg-transparent"
            />
            <ContactDropdown
              query={toInput}
              recipients={suggestedRecipients}
              existingChips={toChips}
              visible={toFocused}
              directory={directory}
              onSelect={name => { setToChips(prev => [...prev, name]); setToInput('') }}
            />
          </div>
          {!showCcBcc && (
            <button
              type="button"
              onClick={() => setShowCcBcc(true)}
              className="text-[12px] text-[var(--color-sky-500)] hover:underline shrink-0 pt-[5px]"
              style={{ fontWeight: 500 }}
            >
              CC/BCC
            </button>
          )}
        </div>

        {remainingSuggestions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap py-1 pl-10">
            <span className="text-[11px] text-gray-400" style={{ fontWeight: 500 }}>Suggested:</span>
            {remainingSuggestions.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => setToChips(prev => [...prev, name])}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {name}
                <Plus className="w-2.5 h-2.5 text-gray-400" />
              </button>
            ))}
          </div>
        )}

        {showCcBcc && (
          <>
            <div className="flex items-start gap-2 py-1.5 border-t border-gray-200">
              <span className="text-[12px] text-gray-500 pt-[5px] shrink-0" style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>CC:</span>
              <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0 relative">
                {ccChips.map((chip, i) => <ChipTag key={i} label={chip} onRemove={() => removeChip(i, ccChips, setCcChips)} />)}
                <input
                  type="text"
                  value={ccInput}
                  onChange={e => setCcInput(e.target.value)}
                  onKeyDown={e => handleChipKeyDown(e, ccInput, ccChips, setCcChips, setCcInput)}
                  onFocus={() => setCcFocused(true)}
                  onBlur={() => { setCcFocused(false); if (ccInput.trim()) addChip(ccInput, ccChips, setCcChips, setCcInput) }}
                  placeholder={ccChips.length === 0 ? 'Add CC…' : ''}
                  aria-label="CC recipients"
                  className="flex-1 min-w-[120px] text-[13px] text-gray-700 outline-none py-[3px] bg-transparent"
                />
                <ContactDropdown
                  query={ccInput}
                  recipients={suggestedRecipients}
                  existingChips={[...toChips, ...ccChips]}
                  visible={ccFocused}
                  directory={directory}
                  onSelect={name => { setCcChips(prev => [...prev, name]); setCcInput('') }}
                />
              </div>
            </div>
            <div className="flex items-start gap-2 py-1.5 border-t border-gray-200">
              <span className="text-[12px] text-gray-500 pt-[5px] shrink-0" style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>BCC:</span>
              <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0 relative">
                {bccChips.map((chip, i) => <ChipTag key={i} label={chip} onRemove={() => removeChip(i, bccChips, setBccChips)} />)}
                <input
                  type="text"
                  value={bccInput}
                  onChange={e => setBccInput(e.target.value)}
                  onKeyDown={e => handleChipKeyDown(e, bccInput, bccChips, setBccChips, setBccInput)}
                  onFocus={() => setBccFocused(true)}
                  onBlur={() => { setBccFocused(false); if (bccInput.trim()) addChip(bccInput, bccChips, setBccChips, setBccInput) }}
                  placeholder={bccChips.length === 0 ? 'Add BCC…' : ''}
                  aria-label="BCC recipients"
                  className="flex-1 min-w-[120px] text-[13px] text-gray-700 outline-none py-[3px] bg-transparent"
                />
                <ContactDropdown
                  query={bccInput}
                  recipients={suggestedRecipients}
                  existingChips={[...toChips, ...ccChips, ...bccChips]}
                  visible={bccFocused}
                  directory={directory}
                  onSelect={name => { setBccChips(prev => [...prev, name]); setBccInput('') }}
                />
              </div>
            </div>
          </>
        )}

        {/* The thread already prints the subject above, so it only surfaces here
            once the reader has opened CC/BCC and is addressing the mail by hand. */}
        {showCcBcc && (
          <div className="flex items-center gap-2 py-1.5 border-t border-gray-200">
            <span className="text-[12px] text-gray-500 shrink-0" style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>Subject:</span>
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              {isConfidential && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-red-500 text-white shrink-0" style={{ fontWeight: 600 }}>
                  Confidential
                </span>
              )}
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                aria-label="Subject"
                className="flex-1 text-[13px] text-gray-900 outline-none py-[3px] bg-transparent"
                style={{ fontWeight: 500 }}
                placeholder="Subject…"
              />
            </div>
          </div>
        )}
      </div>

      {/* Rich text body */}
      <div className="flex-1 flex flex-col min-h-0">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => { updateActiveFormats(); reportDraft() }}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          data-placeholder={isNote ? 'Add anything the recipient needs…' : 'Write your reply…'}
          aria-label="Message body"
          role="textbox"
          className="flex-1 w-full px-5 py-4 text-[13px] text-gray-700 leading-relaxed outline-none overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:pointer-events-none [&_a]:text-[var(--color-sky-500)] [&_a]:underline"
          style={{ minHeight: '160px' }}
          dangerouslySetInnerHTML={{ __html: initialHtml }}
        />
      </div>

      {attachments.length > 0 && (
        <div className="shrink-0 px-5 py-3 border-t border-gray-200 grid gap-2.5" style={{ gridTemplateColumns: ATTACHMENT_GRID }}>
          {attachments.map((att, i) => (
            <AttachmentCard
              key={`${att.name}-${i}`}
              file={{ name: att.name, size: att.size }}
              onRemove={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>
      )}

      <InsertLinkDialog
        open={showLinkDialog}
        editorRef={editorRef}
        savedSelection={savedSelection}
        initialText={linkText}
        onClose={() => { setShowLinkDialog(false); setLinkText(''); setSavedSelection(null) }}
        onInserted={() => { updateActiveFormats(); onDraftChange?.(true) }}
        containerClassName="shrink-0 px-5 py-3 border-t border-gray-200 bg-gray-50 space-y-2"
      />

      <ConfirmModal
        open={showNoSubjectConfirm}
        tone="info"
        badge="No subject"
        title="Send without a subject?"
        description="This message has no subject line. A thread with no subject is harder to find later."
        confirmLabel="Yes, send"
        dismissLabel="No, let me add one"
        onConfirm={() => { setShowNoSubjectConfirm(false); doSend() }}
        onDismiss={() => setShowNoSubjectConfirm(false)}
      />

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />

      {/* Footer toolbar */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {FORMAT_BUTTONS.map(({ icon: Icon, command, label }) => (
              <Tooltip key={command} content={label}>
                <button
                  type="button"
                  onClick={() => execCommand(command)}
                  aria-label={label}
                  aria-pressed={activeFormats.has(command)}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    activeFormats.has(command)
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            ))}
            <div className="w-px h-4 bg-gray-200 mx-1" />
            {LIST_BUTTONS.map(({ icon: Icon, command, label }) => (
              <Tooltip key={command} content={label}>
                <button
                  type="button"
                  onClick={() => execCommand(command)}
                  aria-label={label}
                  aria-pressed={activeFormats.has(command)}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    activeFormats.has(command)
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            ))}
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <Tooltip content="Insert link">
              <button
                type="button"
                onClick={openLinkDialog}
                aria-label="Insert link"
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            <Tooltip content="Attach file">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach file"
                className={cn(
                  'p-1.5 rounded transition-colors',
                  attachments.length > 0
                    ? 'bg-gray-200 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200',
                )}
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content={isConfidential ? 'Remove confidential mark' : 'Mark as confidential'}>
              <button
                type="button"
                aria-label={isConfidential ? 'Remove confidential mark' : 'Mark as confidential'}
                aria-pressed={isConfidential}
                onClick={() => {
                  const next = !isConfidential
                  setIsConfidential(next)
                  // Confidential is a sensitive flag and the icon alone is easy
                  // to miss, so the state change is stated rather than shown.
                  if (next) {
                    pushToast('Marked as confidential', 'success', 'Recipients will see a Confidential chip on this message.')
                  } else {
                    pushToast('Confidential mark removed', 'info', 'This will send as a regular message.')
                  }
                }}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  isConfidential
                    ? 'bg-red-100 text-red-600'
                    : 'bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600',
                )}
              >
                <ConfidentialEyeIcon className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            <Tooltip content={isReadReceiptRequested ? 'Stop requesting read receipt' : 'Request read receipt'}>
              <button
                type="button"
                aria-label={isReadReceiptRequested ? 'Stop requesting read receipt' : 'Request read receipt'}
                aria-pressed={isReadReceiptRequested}
                onClick={() => setIsReadReceiptRequested(v => !v)}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  isReadReceiptRequested
                    ? 'bg-[var(--color-green-100)] text-[var(--color-green-800)]'
                    : 'bg-[var(--color-slate-100)] text-[var(--color-slate-500)] hover:bg-[var(--color-slate-200)] hover:text-[var(--color-slate-700)]',
                )}
              >
                <MailCheck className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={handleSendClick}
              className="inline-flex items-center gap-1.5 px-4 py-[7px] text-[13px] bg-[var(--color-sky-500)] text-white rounded-lg hover:bg-[var(--color-blue-650)] transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Send className="w-3.5 h-3.5" />
              {sendLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
