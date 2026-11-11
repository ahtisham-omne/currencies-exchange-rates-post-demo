/* Ported from the reporting module's comms cluster (the EmailComposeInline in
   its communications-compose-modal.tsx).

   The compose itself: recipients as chips with Cc/Bcc, the contact dropdown,
   the linked-record row, subject, a rich-text body, attachments, and the footer
   toolbar with confidential, read receipt, save as draft and send.

   It lives in its own file because two surfaces compose mail: the in-thread
   reply pane, which passes `hideSubjectAndRecord` because the thread already
   prints both above it, and the docked compose popout, which needs the record
   row so the mail can be re-routed mid-compose. `InlineReplyPane` renders this
   rather than holding a second copy.

   Colours are the source's own primitives, which resolve because both callers
   render inside a `data-comms` element. The one panel that portals out of it
   re-declares the attribute on its own wrapper. */
import {
  useCallback, useEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  Bold, ExternalLink, Eye, EyeOff, FileEdit, Info, Italic, Link2, List, ListOrdered,
  MailCheck, Paperclip, Plus, Send, Star, Strikethrough, Underline, X,
} from 'lucide-react'
import { ConfirmModal, Menu, Tooltip } from '../ui'
import { AttachmentCard } from './AttachmentCard'
import { InsertLinkDialog } from './InsertLinkDialog'
import { useStore } from '../../store'
import { cn } from '../../lib/utils'
import { avatarTint, initialsOf } from '../../lib/comms'

const ATTACHMENT_GRID = 'repeat(auto-fill, 156px)'

/** What the popout reads back off a draft it is about to save. */
export interface EmailComposeDraftSnapshot {
  to: string[]
  subject: string
  body: string
}

/** What a send hands the caller. */
export interface EmailComposeSendData {
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

/* The addresses that actually appear in this module's threads, so the recipient
   suggestions name people the reader has seen rather than inventing a
   directory. Callers with a real participant list pass `directory` instead. */
export interface DirectoryContact { name: string; email: string }

export const EMAIL_DIRECTORY: DirectoryContact[] = [
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

/** Refs whose mail always requests a read receipt. The source locked this to
 *  purchase orders; the equivalent here is an entry in the ledger. */
const RECEIPT_LOCKED_PREFIX = 'JE-'

/* The longer answer behind the no-record banner's "What is a record?". A click
   panel rather than a hover tooltip, as the source had it, built on this
   module's `Menu` since there is no popover primitive. `Menu` portals to
   <body>, outside the tab, so the panel re-declares `data-comms` to bring the
   source's colour primitives back into scope. */
function WhatIsARecordPopover() {
  return (
    <Menu
      align="left"
      flush
      trigger={
        <button
          type="button"
          className="inline text-[11px] text-[var(--color-amber-700)] hover:underline cursor-pointer align-baseline"
          style={{ fontWeight: 600 }}
        >
          What is a record?
        </button>
      }
    >
      {() => (
        <div data-comms className="w-[320px] p-3.5 text-[12.5px] text-[var(--color-slate-700)] leading-relaxed">
          <p className="font-semibold text-[var(--color-slate-900)] mb-1.5">Records in Omne</p>
          <p>
            A record is anything the books hold: an account in the chart, or a journal entry posted to one.
          </p>
          <p className="mt-2">
            When an email is linked to a record, it appears in that record's communication tab so anyone
            working on it is in the loop. Unlinked emails only live in the central inbox.
          </p>
        </div>
      )}
    </Menu>
  )
}

export interface EmailComposeInlineProps {
  /** The record the mail is filed against. Prefixes the default subject and
   *  fills the linked-record chip. */
  entityId: string
  onDraftChange?: (hasDraft: boolean) => void
  suggestedRecipients?: string[]
  initialTo?: string[]
  onSaveAsDraft?: (draft: EmailComposeDraftSnapshot) => void
  initialSubject?: string
  /** The quoted original, as HTML. */
  initialBody?: string
  initialAttachments?: { name: string; size: string }[]
  initialCc?: string[]
  initialBcc?: string[]
  initialConfidential?: boolean
  /** Default for the read-receipt toggle. Overridden to on for a mail filed
   *  against a journal entry, where receipts are automatic. */
  initialReadReceiptRequested?: boolean
  /** Chips that render with the "Primary" star. */
  primaryChipLabels?: string[]
  initialShowCcBcc?: boolean
  directory?: DirectoryContact[]
  /** Lets the caller read the current draft, e.g. to auto-save on close. */
  onGetDraftData?: (getter: () => EmailComposeDraftSnapshot) => void
  /** Drop the record row and the subject field. The thread already prints both
   *  above the in-thread reply, so repeating them says the same thing twice. */
  hideSubjectAndRecord?: boolean
  /** Show "None" in the record chip and start with a blank subject rather than
   *  the `[entityId] ` prefix. */
  noRecord?: boolean
  /** Override the chip's label in the `noRecord` state. Falls back to "None". */
  noRecordLabel?: string
  /** Drop the record row only. The subject still renders. Implies `noRecord`
   *  for the subject prefix. */
  hideRecord?: boolean
  /** Opens the caller's record picker. Without it the chip is read-only. */
  onEditRecord?: () => void
  /** Unlinks in one click, without opening the picker. Only meaningful when
   *  there is a record to unlink. */
  onDetachRecord?: () => void
  /** A note has never left the record, so the only outbound act on one is
   *  sending it out for the first time, and the compose says so. */
  isNote?: boolean
  /** Names the send button when the compose answers a message. */
  mode?: 'reply' | 'reply-all' | 'forward'
  onSend?: (data: EmailComposeSendData) => void
}

export function EmailComposeInline({
  entityId,
  onDraftChange,
  suggestedRecipients = [],
  initialTo = [],
  onSaveAsDraft,
  initialSubject,
  initialBody,
  initialAttachments,
  initialCc,
  initialBcc,
  initialConfidential,
  initialReadReceiptRequested,
  primaryChipLabels,
  initialShowCcBcc,
  directory = EMAIL_DIRECTORY,
  onGetDraftData,
  hideSubjectAndRecord,
  noRecord,
  noRecordLabel,
  hideRecord,
  onEditRecord,
  onDetachRecord,
  isNote,
  mode,
  onSend,
}: EmailComposeInlineProps) {
  const pushToast = useStore(s => s.pushToast)

  const defaultSubject = noRecord || hideRecord ? '' : `[${entityId}] `
  const [toChips, setToChips] = useState<string[]>(initialTo)
  const [toInput, setToInput] = useState('')
  const [showCcBcc, setShowCcBcc] = useState(
    initialShowCcBcc ?? ((initialCc?.length ?? 0) > 0 || (initialBcc?.length ?? 0) > 0),
  )
  const [ccChips, setCcChips] = useState<string[]>(initialCc ?? [])
  const [ccInput, setCcInput] = useState('')
  const [bccChips, setBccChips] = useState<string[]>(initialBcc ?? [])
  const [bccInput, setBccInput] = useState('')
  const [subject, setSubject] = useState(initialSubject ?? defaultSubject)
  const [isConfidential, setIsConfidential] = useState(initialConfidential ?? false)
  /* Mail on a journal entry always requests a receipt: the toggle locks on and
     the button is disabled. Re-attaching the mail to an entry mid-compose flips
     it on to match. */
  const isReadReceiptLocked = !!entityId?.startsWith(RECEIPT_LOCKED_PREFIX)
  const [isReadReceiptRequested, setIsReadReceiptRequested] = useState(
    isReadReceiptLocked || (initialReadReceiptRequested ?? false),
  )
  useEffect(() => {
    if (isReadReceiptLocked) setIsReadReceiptRequested(true)
  }, [isReadReceiptLocked])
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

  const initialSubjectRef = useRef(initialSubject ?? defaultSubject)
  const initialToRef = useRef(initialTo)
  const initialBodyRef = useRef(initialBody ?? '')

  /* Keyed by value, not by array identity: a caller that rebuilds the array
     every render would otherwise wipe the chips the reader has just typed. */
  const initialToKey = initialTo.join(' ')
  useEffect(() => {
    setToChips(initialToKey ? initialToKey.split(' ') : [])
  }, [initialToKey])

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

  const readDraft = useCallback((): EmailComposeDraftSnapshot => ({
    to: toChips,
    subject,
    body: editorRef.current?.innerHTML ?? '',
  }), [toChips, subject])

  useEffect(() => { onGetDraftData?.(readDraft) }, [onGetDraftData, readDraft])

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
  const sendLabel = isNote ? 'Send Out' : mode === 'forward' ? 'Forward' : 'Send'
  const showRecordRow = !hideSubjectAndRecord && !hideRecord

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

      {/* Amber, and above the calmer grey chip below it, because this is the
          "do something" cue: an unlinked mail is the state the reader has to
          act on, so it should not read as downstream of the record row. */}
      {showRecordRow && noRecord && onEditRecord && (
        <div className="shrink-0 px-5 py-2.5 border-b border-[var(--color-amber-300)] bg-[var(--color-amber-100)] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[var(--color-amber-700)] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="flex-1 text-[12.5px] text-[var(--color-amber-900)] leading-relaxed" style={{ fontWeight: 400 }}>
            This email is not linked to a record. Linking keeps it in that record's communication history.{' '}
            <WhatIsARecordPopover />
          </p>
          <button
            type="button"
            onClick={onEditRecord}
            className="shrink-0 inline-flex items-center h-7 px-3 rounded-md border border-[var(--color-amber-700)] bg-white text-[12px] text-[var(--color-amber-900)] hover:bg-[var(--color-amber-50)] transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            Link a Record
          </button>
        </div>
      )}

      {showRecordRow && (
        <div className="shrink-0 px-5 py-2.5 border-b border-gray-200 bg-[var(--color-mist-200)] flex items-center gap-2" aria-labelledby="compose-linked-record-label">
          <span id="compose-linked-record-label" className="text-[11px] text-gray-500" style={{ fontWeight: 500 }}>Linked Record:</span>
          {(() => {
            const chipContent = noRecord ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] bg-[var(--color-slate-200)] text-[var(--color-slate-600)] border border-[var(--color-slate-300)]" style={{ fontWeight: 500 }}>
                {noRecordLabel || 'None'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] bg-[var(--color-brand-75)] text-[var(--color-sky-500)] border border-[var(--color-sky-500)]/15" style={{ fontWeight: 500 }}>
                {entityId}
                <ExternalLink className="w-3 h-3" />
              </span>
            )
            if (!onEditRecord) return chipContent
            return (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={onEditRecord}
                  className="inline-flex items-center gap-2 rounded-md hover:bg-white/60 transition-colors cursor-pointer px-1 -mx-1"
                  title={noRecord ? 'Link a record' : 'Change linked record'}
                  aria-label={noRecord ? 'Link a record' : 'Change linked record'}
                >
                  {chipContent}
                  <span className="text-[11px] text-[var(--color-sky-500)] hover:underline" style={{ fontWeight: 500 }}>
                    {noRecord ? 'Add' : 'Change'}
                  </span>
                </button>
                {/* Bypasses the picker: one click flips the chip to "None". */}
                {!noRecord && onDetachRecord && (
                  <button
                    type="button"
                    onClick={onDetachRecord}
                    className="w-5 h-5 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-700 hover:bg-white/60 transition-colors cursor-pointer"
                    title="Detach record"
                    aria-label="Detach linked record"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {!noRecord && isReadReceiptLocked && (
        <div className="shrink-0 px-5 py-1.5 border-b border-gray-200 bg-[var(--color-mist-200)] flex items-center gap-1.5">
          <MailCheck className="w-3 h-3 text-gray-400 shrink-0" aria-hidden />
          <span className="text-[11px] text-gray-500 leading-tight">
            Read receipts are automatically requested for all emails related to journal entries.
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
              className="flex-1 min-w-[120px] text-[13px] text-gray-700 outline-none py-[3px] placeholder:text-gray-500 bg-transparent"
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
                  className="flex-1 min-w-[120px] text-[13px] text-gray-700 outline-none py-[3px] placeholder:text-gray-500 bg-transparent"
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
                  className="flex-1 min-w-[120px] text-[13px] text-gray-700 outline-none py-[3px] placeholder:text-gray-500 bg-transparent"
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

        {/* The in-thread reply hides this, because the thread prints the subject
            above it. It comes back the moment the reader opens CC/BCC and is
            addressing the mail by hand. */}
        {(!hideSubjectAndRecord || showCcBcc) && (
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
                className="flex-1 text-[13px] text-gray-900 outline-none py-[3px] placeholder:text-gray-500 bg-transparent"
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
          data-placeholder={isNote ? 'Add anything the recipient needs…' : 'Compose your email…'}
          aria-label="Email body"
          role="textbox"
          className="flex-1 w-full px-5 py-4 text-[13px] text-gray-700 leading-relaxed outline-none overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:text-gray-500 empty:before:pointer-events-none [&_a]:text-[var(--color-sky-500)] [&_a]:underline"
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
        badge="No Subject"
        title="Send without a subject?"
        description="This message has no subject line. A thread with no subject is harder to find later."
        confirmLabel="Yes, Send"
        dismissLabel="No, Let Me Add One"
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
            <Tooltip
              content={isReadReceiptLocked
                ? 'Read receipt requested automatically for journal entries'
                : isReadReceiptRequested
                  ? 'Stop requesting read receipt'
                  : 'Request read receipt'}
            >
              <button
                type="button"
                disabled={isReadReceiptLocked}
                aria-label={isReadReceiptRequested ? 'Stop requesting read receipt' : 'Request read receipt'}
                aria-pressed={isReadReceiptRequested}
                onClick={() => { if (!isReadReceiptLocked) setIsReadReceiptRequested(v => !v) }}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  isReadReceiptRequested
                    ? 'bg-[var(--color-green-100)] text-[var(--color-green-800)]'
                    : 'bg-[var(--color-slate-100)] text-[var(--color-slate-500)] hover:bg-[var(--color-slate-200)] hover:text-[var(--color-slate-700)]',
                  isReadReceiptLocked && 'cursor-not-allowed opacity-90',
                )}
              >
                <MailCheck className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            {onSaveAsDraft && (
              <button
                type="button"
                onClick={() => onSaveAsDraft(readDraft())}
                className="inline-flex items-center gap-1.5 px-3 py-[7px] text-[13px] text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                <FileEdit className="w-3.5 h-3.5" />
                Save as Draft
              </button>
            )}
            <button
              type="button"
              onClick={handleSendClick}
              className="inline-flex items-center gap-1.5 px-4 py-[7px] text-[13px] bg-[var(--color-sky-500)] text-white rounded-lg hover:bg-[var(--color-blue-650)] transition-colors cursor-pointer"
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
