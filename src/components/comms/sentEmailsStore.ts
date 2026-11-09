/* Ported from the reporting module's comms cluster (its sentEmailsStore.ts).

   Mail sent from the docked compose popout, and the request channel a surface
   uses to open one. Same shape, same subscribe/notify pattern, one in-memory
   list.

   Module-level rather than in the Zustand store: `requestOpenEmailCompose` is a
   fire-and-forget request with no state behind it, and a compose popout has to
   survive a route change, so neither belongs to a page's own state. */
import type { AttachmentFileRef, CommRecordKind } from '../../lib/comms'

export interface SentEmailEntry {
  id: string
  /** First To address, used for contact lookup. */
  primaryToEmail: string
  /** Display name for the primary recipient. Falls back to the address. */
  primaryToName: string
  /** Every To recipient, as display names or addresses. */
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  /** ISO, for sorting and "Last updated" labels. */
  dateIso: string
  /** Friendly timestamp label, e.g. "Sep 07, 2026 at 03:45 PM". */
  timestampLabel: string
  attachments?: { name: string; size: string }[]
  fromName: string
  fromEmail: string
  /**
   * The record this mail belongs to. When set, it surfaces in that record's
   * Communication tab and the compose host skips its post-send navigation.
   */
  recordRef?: string
  recordKind?: CommRecordKind
  /** Human label for the record, for the linkage chip and the post-send toast. */
  recordLabel?: string
  /** Set from the compose's Confidential toggle. Drives the red Confidential
   *  chip in every surface that renders this mail. */
  isConfidential?: boolean
}

const entries: SentEmailEntry[] = []
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach(cb => cb())
}

/* ─── Open-compose requests ───────────────────────────────────────────────────
   A surface emits `requestOpenEmailCompose` to pop a compose over the current
   screen with no navigation. `EmailComposeHost` subscribes and renders it. */

export interface EmailComposeOpenRequest {
  /** Primary recipient address. */
  email: string
  /** Display name for the primary recipient. Defaults to the address. */
  name?: string
  /**
   * When provided, the popout's record chip shows this record instead of
   * "No record", and the sent mail is tagged so it surfaces in that record's
   * Communication tab.
   */
  recordRef?: string
  recordKind?: CommRecordKind
  recordLabel?: string
  /**
   * The recipient's chip in the To field renders with a star and a "Primary
   * contact" tooltip. Set when the address is the record's primary contact.
   */
  primary?: boolean
  /** Pre-fill the subject, so an automated flow lands the reader on a filled
   *  draft rather than an empty composer. */
  subject?: string
  /** Pre-fill the body. Pairs with `subject`. */
  body?: string
  /** Files the draft opens with. An extract attachment carries its refs, so the
   *  recipient's preview renders the real file. */
  attachments?: AttachmentFileRef[]
}

type OpenListener = (req: EmailComposeOpenRequest) => void
const openListeners = new Set<OpenListener>()

export function requestOpenEmailCompose(req: EmailComposeOpenRequest) {
  openListeners.forEach(cb => cb(req))
}

export function subscribeOpenEmailCompose(cb: OpenListener): () => void {
  openListeners.add(cb)
  return () => {
    openListeners.delete(cb)
  }
}

export function addSentEmail(
  input: Omit<SentEmailEntry, 'id' | 'dateIso' | 'timestampLabel'> & { dateIso?: string },
): SentEmailEntry {
  const dateIso = input.dateIso ?? new Date().toISOString()
  const d = new Date(dateIso)
  const timestampLabel =
    d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    + ' at '
    + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const entry: SentEmailEntry = {
    ...input,
    id: `sent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dateIso,
    timestampLabel,
  }
  entries.unshift(entry)
  notify()
  return entry
}

export function getSentEmails(): SentEmailEntry[] {
  return entries.slice()
}

export function getSentEmailsForContact(contactEmail: string): SentEmailEntry[] {
  const target = contactEmail.toLowerCase()
  return entries.filter(
    e => e.primaryToEmail.toLowerCase() === target || e.to.some(t => t.toLowerCase() === target),
  )
}

/** Mail filed against one record. */
export function getSentEmailsForRecord(recordRef: string): SentEmailEntry[] {
  const target = recordRef.toLowerCase()
  return entries.filter(e => (e.recordRef ?? '').toLowerCase() === target)
}

export function subscribeSentEmails(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
