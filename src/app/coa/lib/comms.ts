// Ported from chart-of-accounts-v2.1/src/lib/comms.ts; adapted: the records are currencies and exchange rates (CommRecordKind, CommSubjectKind, refOf), the seeded thread templates are written about rates, activation and decimal places, a template may name its outside party, threads are picked without repeats and every seeded record carries two to four.
import { hashSeed } from './hashSeed'
import { BASE_CURRENCY } from '../../data/exchangeRates'

/* ─────────────────────────── Comms on a record ───────────────────────────
   The conversation that happens around an account or an entry, kept against the
   record itself. Every question a reader has about a figure is asked somewhere,
   and today that somewhere is email: by the time anyone asks why an account was
   reclassed or why an entry posted where it did, the answer is in a thread
   nobody reading the ledger can see.

   The shape here is ported from the financial reporting module's Communication
   tab rather than invented, so the two modules file correspondence the same way.
   What was ported is the STRUCTURE - threads over messages, mailboxes, unread,
   pinning, attachments that carry the extract behind them. What was kept is this
   module's own copy and its Note/Email channel, because both are already written
   and governed here. The source's rule for its own port applies again: where the
   two disagree, the target's wins.

   Two levels, not one. A flat list of messages cannot say which reply answered
   which question, and the reader arriving at an account six months later is
   trying to follow exactly that. So messages hang off a thread, and the thread
   is what the list shows. */

/* The mailboxes on the tab's top bar, all four of the source's. Unmatched holds
   mail that arrived without a record to file it against; a thread lands there
   when the address it came in on names something the chart does not have, and
   it stays there until someone links it. It reads zero on most records, which
   is the honest answer rather than a reason to remove the place. */
export type Mailbox = 'all' | 'sent' | 'archived' | 'unmatched'

/* The kinds of record a thread can be filed against IN THIS MODULE. The source
   enumerated a reporting module's kinds (Report / Template / Automation /
   Other); the currency screens have two surfaces that carry a thread, a
   currency and an exchange rate, so it names those two, plus the source's
   `Other` for a thread filed against nothing — which is what the Unmatched
   mailbox collects. */
export type CommRecordKind = 'Currency' | 'Exchange Rate' | 'Other'

/* The record a Communications tab is open on. A currency (the base one reads
   differently: it cannot be deactivated and every rate is quoted against it),
   or one of a pair's two rates. */
export type CommSubjectKind = 'currency' | 'base' | 'corporate' | 'mid'

/** The kind of record a subject is filed as. */
export function recordKindOf(kind: CommSubjectKind): CommRecordKind {
  return kind === 'currency' || kind === 'base' ? 'Currency' : 'Exchange Rate'
}

/* Row height on the thread list. The source's two words, not this module's
   'comfortable': the control is labelled "Comfort" and a type that disagrees
   with the label it renders is the drift that makes one of them wrong later. */
export type Density = 'condensed' | 'comfort'

/* Which of the two products the tab is showing. Mail and chat are different
   surfaces against the same record, and the toggle is the only thing that says
   so, so the state it drives is named here with them. */
export type CommsSurface = 'emails' | 'chat'

/* A note and a message that left the building are not the same thing to the
   person reading them back. A note is internal and can say so; an email has
   recipients and is now on the record in more than one place. The distinction is
   what the reader is scanning for, so it is a channel rather than a tag. */
export type CommChannel = 'Note' | 'Email'

export const CHANNEL_MEANING: Record<CommChannel, string> = {
  Note: 'Internal. Stays on this record and goes nowhere else.',
  Email: 'Sent out. On this record and in the recipient\'s inbox.',
}

/* The LEDGER EXTRACT behind an attached file: which record, over which window,
   scoped how. A preview renders the real figures from these rather than showing
   canned document prose, so the file, the message that carried it and the
   account it came from all describe the same run. */
export interface AttachmentExtractRef {
  /** The account number or entry number the extract was run over. */
  recordRef: string
  name: string
  from: string
  to: string
  entity?: string
}

/** An attached file, with the extract it carries when it carries one. */
export interface AttachmentFileRef {
  name: string
  /** Pre-formatted, because nothing recomputes it. */
  size: string
  extracts?: AttachmentExtractRef[]
}

/** One message inside a thread. */
export interface CommMessage {
  id: string
  threadId: string
  channel: CommChannel
  from: string
  fromEmail: string
  /** Display name of the recipient. Empty on a note, which has none. */
  to: string
  toEmail: string
  /** Human-readable stamp, e.g. "Jul 16, 2026, 1:05 PM". */
  timestamp: string
  /** ISO, and the only thing anything sorts on. */
  dateIso: string
  body: string
  /** Written from here rather than received. Drives the Sent mailbox. */
  isOutbound: boolean
  attachments?: AttachmentFileRef[]
  isPinned?: boolean
  /** Issued by the system rather than typed by a person. */
  isAutomated?: boolean
  /** Internal-only, and says so on its face. */
  isConfidential?: boolean
}

/** A thread as the list renders it. */
export interface CommThread {
  id: string
  /** The record the thread hangs on: an account id, or an entry number. */
  subjectId: string
  entityType: CommRecordKind
  /** Stored prefixed, e.g. "ACC-1075" or "JE-0042", and displayed bare through
   *  `formatEntityRef`. The prefix is what makes a ref unambiguous once mail can
   *  be moved between records; the chip's own colour says the kind. */
  entityRef: string
  /** The record as the reader knows it, e.g. "1075 Trade Receivables". */
  entityLabel: string
  subject: string
  lastSender: string
  lastSenderEmail: string
  /** First line of the last message, so the list never flatMaps to render. */
  bodyPreview: string
  lastDate: string
  dateIso: string
  isUnread: boolean
  /** Denormalised for the same reason as bodyPreview. */
  hasAttachments: boolean
  attachmentCount: number
  messages: CommMessage[]
  isAutomated?: boolean
}

/* An inline comment on a message, keyed by message id rather than embedded in
   it. Two reasons, both the source's: the thread stays light to render, and a
   comment is a different act from a reply - a reply goes to the recipient, a
   comment is the team talking about what was said. */
export interface MessageComment {
  id: string
  messageId: string
  authorName: string
  authorInitials: string
  text: string
  timestamp: string
}

/* ─────────────────────────── The demo threads ───────────────────────────
   Derived from the record rather than stored against it, the same way an entry's
   paper trail is: a demo is read by opening whichever record the reader is
   curious about, and a handful of hand-seeded threads means most of those open
   empty. Hashing the record's own id keeps a thread stable between renders and
   between reloads, so a record a reader comes back to says what it said before.

   Messages the reader writes are stored, and sit after these. */
const PEOPLE = [
  { name: 'Ayesha Khan', role: 'Controller', email: 'ayesha.khan@omne.example' },
  { name: 'Daniel Osei', role: 'Accountant', email: 'daniel.osei@omne.example' },
  { name: 'Priya Raman', role: 'Financial Analyst', email: 'priya.raman@omne.example' },
  { name: 'Tom Brennan', role: 'Group Reporting', email: 'tom.brennan@omne.example' },
]

const OUTSIDE = [
  { name: 'Hartley & Co', email: 'reviews@hartleyco.example' },
  { name: 'Meridian Supplies', email: 'ap@meridiansupplies.example' },
  { name: 'Group treasury', email: 'treasury@omne.example' },
]

/** The system's own mailbox. Reserved so automated mail reads as system-issued
 *  rather than disappearing into the pool of people. */
export const SYSTEM_SENDER = { name: 'Omne System', email: 'no-reply@omnesoft.com' }

/** True when the sender is Omne's automated mailbox. Both the friendly name and
 *  the no-reply address are accepted. */
export function isSystemSender(from?: string | null, fromEmail?: string | null): boolean {
  const name = (from ?? '').trim().toLowerCase()
  const email = (fromEmail ?? '').trim().toLowerCase()
  return email === 'no-reply@omnesoft.com' || name === 'omne' || name === 'omne system'
}

/** The person whose seat this is. Outbound mail is from them. */
export const CURRENT_USER = { name: 'Mahad Ejaz', email: 'mejaz@omnesoft.com' }

/* ───────────────────────────── Sender tints ─────────────────────────────
   Colour-coding senders is what makes a dense thread list scannable. The pool
   is the source's five, referenced as the `--avatar-bg-*` primitives declared
   alongside the rest of the ported palette in index.css.

   Blue is deliberately absent, for the reason the source gave and which holds
   here too: a selected row is filled brand blue, and a blue avatar would
   dissolve into it. These are inline colours rather than Tailwind classes
   because they are values, not utilities, and an earlier translation into this
   module's scales is what made the port drift. */
export interface AvatarTint {
  bg: string
  fg: string
}

export const AVATAR_TINTS: readonly AvatarTint[] = [
  { bg: 'var(--avatar-bg-green)', fg: 'var(--color-white)' },
  { bg: 'var(--avatar-bg-sky)', fg: 'var(--color-ink-900)' },
  { bg: 'var(--avatar-bg-warm)', fg: 'var(--color-ink-900)' },
  { bg: 'var(--avatar-bg-amber)', fg: 'var(--color-ink-900)' },
  { bg: 'var(--avatar-bg-teal)', fg: 'var(--color-white)' },
]

/** Brand blue, reserved for the system's own mailbox. Blue is out of the pool
 *  precisely so that this one carries a meaning. */
export const SYSTEM_AVATAR_TINT: AvatarTint = { bg: 'var(--color-brand-75)', fg: 'var(--color-brand-500)' }

/** Stable tint for a name, so a sender keeps their colour across renders and
 *  reloads. Same hash the source used. */
export function avatarTint(name: string): AvatarTint {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length]
}

/** Tint for a message's sender: the system tint for automated mail, otherwise
 *  the sender's own. */
export function senderTint(from: string, fromEmail?: string): AvatarTint {
  return isSystemSender(from, fromEmail) ? SYSTEM_AVATAR_TINT : avatarTint(from)
}

interface MessageTemplate {
  channel: CommChannel
  body: string
  /** Outbound means written from this seat rather than received. */
  outbound?: boolean
  automated?: boolean
  confidential?: boolean
  /** A list, because one automated mail carries the statement and the schedule
   *  behind it, and a thread's badge has to be able to read "2 Attachments". */
  attach?: { name: string; size: string; extract?: boolean }[]
}

interface ThreadTemplate {
  subject: string
  messages: MessageTemplate[]
  /** Which outside correspondent the thread is with, as an index into OUTSIDE.
   *  Unset, the correspondent is picked from the record's seed. A question from
   *  the auditor has to come from the auditor. */
  party?: number
}

const TREASURY = 2
const AUDITOR = 0
const SUPPLIER = 1

/* Written to read against any record of their kind, because they are hung on
   every one. `{label}` is the record the thread belongs to, `{code}` its
   currency, `{pair}` the pair quoted against `{base}`. */
const CURRENCY_THREADS: ThreadTemplate[] = [
  {
    subject: 'Corporate rate change for {code}',
    party: TREASURY,
    messages: [
      { channel: 'Email', body: 'We are moving the {code} corporate rate at the start of next month. Before we send the new figure, can you confirm {code} is active in the Currency Library so the rate can be set against it?' },
      { channel: 'Email', body: 'Confirmed, {code} is active and nothing is holding it back. Send the rate across once it is agreed and I will set it on {pair}.', outbound: true },
      { channel: 'Email', body: 'Thanks. The proposed rate is attached with the mid-market reference we used. The variance is inside the band agreed for the quarter.', attach: [{ name: 'Corporate_Rate_Proposal.xlsx', size: '36 KB' }] },
      { channel: 'Note', body: 'Rate received from treasury. Setting it on {pair} once Ayesha has signed off the variance.', outbound: true },
    ],
  },
  {
    subject: 'Why was {code} deactivated?',
    party: AUDITOR,
    messages: [
      { channel: 'Email', body: 'Our sample for last year includes a period where {code} was inactive in your Currency Library. Could you confirm why it was deactivated, who approved it, and when it was brought back?' },
      { channel: 'Email', body: 'It was deactivated while we had no open documents in {code} and no plans to trade in it. It came back when the new supplier contract was signed. The approval is attached, and both changes are in the activity on the currency.', outbound: true, attach: [{ name: 'Status_Change_Approval.pdf', size: '92 KB', extract: true }] },
      { channel: 'Email', body: 'That is what we needed. No further questions on {code} from our side.' },
    ],
  },
  {
    subject: 'Decimal places on {code}',
    messages: [
      { channel: 'Note', body: 'Invoices from the new {code} supplier show amounts to three decimals. We round {code} to its ISO decimal places, so the last digit drops on entry. Is that what we want?' },
      { channel: 'Note', body: 'Yes. The ISO setting is what the bank settles at, so anything finer is noise. The rounding difference posts to FX rounding at month end.', outbound: true },
      { channel: 'Note', body: 'Makes sense. I will tell payables so they stop raising it as a variance.' },
    ],
  },
  {
    subject: 'Rate on {code} invoices',
    party: SUPPLIER,
    messages: [
      { channel: 'Email', body: 'Our latest invoice to you is in {code}. Which rate will you convert it at when you pay, the rate on the invoice date or the one on the payment date?' },
      { channel: 'Email', body: 'We book it at our corporate rate on the invoice date and settle at the bank rate on the day we pay. Any difference is ours, so the amount you receive in {code} does not change.', outbound: true },
      { channel: 'Email', body: 'Clear, thank you. That is how we will reconcile it on our side.' },
    ],
  },
  /* The automated threads. Their bodies are written the way every mail from
     no-reply@omnesoft.com is written in the source: a greeting, one sentence
     saying what happened, a `Caption:` and `• Label: value` block, a closing
     line, then a `---` rule and the fine print under it. That shape is the
     whole contract with AutomatedEmailTemplate, which renders the block as a
     table and the tail as fine print by reading the text rather than being
     handed structure. Keeping the body a plain string is what lets reply,
     forward, search and the list preview all read the same mail. */
  {
    subject: '{code} revaluation report is ready',
    messages: [
      {
        channel: 'Email',
        automated: true,
        attach: [
          { name: 'Revaluation_Report.pdf', size: '139 KB', extract: true },
          { name: 'Closing_Rates.xlsx', size: '48 KB' },
        ],
        body: [
          'Dear {me},',
          '',
          'The month-end revaluation for {label} is attached.',
          '',
          'Report Details:',
          '• Currency: {label}',
          '• Pair: {pair}',
          '• Period: {period}',
          '• Generated: {generated}',
          '• Format: PDF',
          '• Sent to: {myEmail}',
          '',
          'No action is needed. Open balances in {code} were revalued at the closing rate and the report is kept on the currency.',
          '',
          '---',
          'This is an automated message from Omne. Replies to this address are not monitored.',
        ].join('\n'),
      },
    ],
  },
  {
    subject: 'Variance alert on {code}',
    messages: [
      {
        channel: 'Email',
        automated: true,
        body: [
          'Dear {me},',
          '',
          'The corporate rate for {code} has moved outside the agreed variance from the mid-market rate.',
          '',
          'Alert Details:',
          '• Currency: {label}',
          '• Pair: {pair}',
          '• Trigger: Variance above the agreed threshold',
          '• Period: {period}',
          '• Raised by: Rate monitoring',
          '',
          'What to do next: Review the corporate rate and either confirm it or set a new one.',
          '',
          '---',
          'This is an automated message from Omne. Replies to this address are not monitored.',
        ].join('\n'),
      },
      { channel: 'Note', body: 'Looked at this. The mid-market rate jumped after a market holiday and has already come back, so the corporate rate stands. Leaving it.', outbound: true },
    ],
  },
]

/* The base currency cannot be deactivated and has no rate of its own, so its
   correspondence is about what is quoted against it. */
const BASE_THREADS: ThreadTemplate[] = [
  {
    subject: '{code} as the base currency',
    messages: [
      { channel: 'Note', body: 'Reminder that {code} is the base currency, so every rate in the library is quoted against it. Changing it means restating every corporate rate, so it is not something to do mid-year.' },
      { channel: 'Note', body: 'Agreed. {code} stays the base, and I am noting it here for whoever asks next.', outbound: true },
    ],
  },
  {
    subject: 'Rates quoted against {code}',
    party: TREASURY,
    messages: [
      { channel: 'Email', body: 'We are preparing the rate pack for next quarter. Can you confirm every corporate rate will still be quoted against {code}?' },
      { channel: 'Email', body: 'Yes. {code} stays the base, and every pair in Exchange Rates is quoted as one unit of the other currency in {code}.', outbound: true },
      { channel: 'Email', body: 'Perfect, that is how the pack is laid out already.' },
    ],
  },
  CURRENCY_THREADS[2],
  {
    subject: 'Closing rates against {code} are ready',
    messages: [
      {
        channel: 'Email',
        automated: true,
        attach: [
          { name: 'Closing_Rates.pdf', size: '126 KB', extract: true },
          { name: 'Closing_Rates.xlsx', size: '52 KB' },
        ],
        body: [
          'Dear {me},',
          '',
          'The month-end closing rates quoted against {code} are attached.',
          '',
          'Report Details:',
          '• Currency: {label}',
          '• Rate type: Mid-market rate',
          '• Period: {period}',
          '• Generated: {generated}',
          '• Format: PDF',
          '• Sent to: {myEmail}',
          '',
          'No action is needed. Every pair in the library was closed at these rates and the report is kept on the currency.',
          '',
          '---',
          'This is an automated message from Omne. Replies to this address are not monitored.',
        ].join('\n'),
      },
    ],
  },
]

const CORPORATE_THREADS: ThreadTemplate[] = [
  {
    subject: 'Corporate rate for {pair} next month',
    party: TREASURY,
    messages: [
      { channel: 'Email', body: 'Proposing to move the {pair} corporate rate at the start of next month. The mid-market rate has drifted and the current rate is further from it than we like.', attach: [{ name: 'Corporate_Rate_Proposal.xlsx', size: '36 KB' }] },
      { channel: 'Email', body: 'Received. What variance does the proposed rate carry against today\'s mid-market reference?', outbound: true },
      { channel: 'Email', body: 'Just under a quarter of a percent, inside the band agreed for the quarter.' },
      { channel: 'Note', body: 'Ayesha signed off the variance. Updating the rate with the effective date treasury asked for.', outbound: true },
    ],
  },
  {
    subject: 'Variance review on {pair}',
    messages: [
      { channel: 'Note', body: 'The variance on {pair} crept up this week. Worth a look before the payment run uses the rate.' },
      { channel: 'Note', body: 'Checked. It is the mid-market rate moving, not ours, and it is still inside the threshold. No change.', outbound: true },
      { channel: 'Note', body: 'Fine by me. I will look at it again at month end.' },
    ],
  },
  {
    subject: 'Previous rate for {pair} archived',
    messages: [
      { channel: 'Note', body: 'Archived the previous corporate rate for {pair} now that the new one is in effect. Its history stays on the pair.', outbound: true },
      { channel: 'Note', body: 'Thanks. If the new rate is questioned we can restore the old one rather than retype it.' },
    ],
  },
  {
    subject: 'Support for the {pair} corporate rate',
    party: AUDITOR,
    messages: [
      { channel: 'Email', body: 'For the year-end file, could you send the support behind the {pair} corporate rate in effect at the balance sheet date?' },
      { channel: 'Email', body: 'Attached: the approval, the mid-market reference on the day, and the variance it was signed off at.', outbound: true, attach: [{ name: 'Rate_Approval.pdf', size: '118 KB', extract: true }] },
      { channel: 'Email', body: 'Received, thank you. This ties to our sample.' },
    ],
  },
  {
    subject: 'Variance alert on {pair}',
    messages: [
      {
        channel: 'Email',
        automated: true,
        body: [
          'Dear {me},',
          '',
          'The corporate rate for {pair} has moved outside the agreed variance from the mid-market rate.',
          '',
          'Alert Details:',
          '• Pair: {pair}',
          '• Rate type: Corporate rate',
          '• Trigger: Variance above the agreed threshold',
          '• Period: {period}',
          '• Raised by: Rate monitoring',
          '',
          'What to do next: Review the corporate rate and either confirm it or set a new one.',
          '',
          '---',
          'This is an automated message from Omne. Replies to this address are not monitored.',
        ].join('\n'),
      },
      { channel: 'Note', body: 'Looked at this. The mid-market rate spiked for a day and has come back, so the corporate rate stands. Leaving it.', outbound: true },
    ],
  },
]

const MID_THREADS: ThreadTemplate[] = [
  {
    subject: 'Provider sync for {pair}',
    messages: [
      { channel: 'Note', body: 'The mid-market rate for {pair} did not move over the long weekend. Is the provider sync running?' },
      { channel: 'Note', body: 'It is. The provider publishes nothing on market holidays, so the last rate carries forward and catches up on the next trading day.', outbound: true },
    ],
  },
  {
    subject: 'Mid-market reference for {pair}',
    party: TREASURY,
    messages: [
      { channel: 'Email', body: 'Which source do you use for the {pair} mid-market reference? We want our figures to agree with yours.' },
      { channel: 'Email', body: 'Open Exchange Rates, synced every 24 hours. The rate on the pair is the last sync.', outbound: true },
      { channel: 'Email', body: 'Thanks, we use the same feed.' },
    ],
  },
  {
    subject: 'Large move on {pair}',
    messages: [
      { channel: 'Note', body: 'The {pair} mid-market rate moved more than usual today. Anything we need to do?' },
      { channel: 'Note', body: 'Nothing on the mid-market side. If the corporate rate is now too far from it, the variance alert will say so.', outbound: true },
    ],
  },
  {
    subject: '{pair} mid-market rates synced',
    messages: [
      {
        channel: 'Email',
        automated: true,
        attach: [{ name: 'Rate_Sync_Summary.pdf', size: '64 KB', extract: true }],
        body: [
          'Dear {me},',
          '',
          'The latest mid-market rates for {pair} are in.',
          '',
          'Sync Details:',
          '• Pair: {pair}',
          '• Rate type: Mid-market rate',
          '• Provider: Open Exchange Rates',
          '• Period: {period}',
          '• Generated: {generated}',
          '',
          'No action is needed. The new rate is on the pair and in its history.',
          '',
          '---',
          'This is an automated message from Omne. Replies to this address are not monitored.',
        ].join('\n'),
      },
    ],
  },
]

const TEMPLATES: Record<CommSubjectKind, ThreadTemplate[]> = {
  currency: CURRENCY_THREADS,
  base: BASE_THREADS,
  corporate: CORPORATE_THREADS,
  mid: MID_THREADS,
}

const DAY = 86_400_000

export function stampOf(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

/** Short date for the thread list, where the column is narrow. */
export function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** First line of a body, clipped the way the list shows it. */
export function previewOf(body: string): string {
  const first = body.split('\n')[0].trim()
  return first.length > 140 ? `${first.slice(0, 139)}…` : first
}

function isoDate(iso: string): string {
  return (iso || new Date().toISOString()).slice(0, 10)
}

/** "Sep 05, 2026", the long form the detail pane and the mail bodies use. */
export function longDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

/* The ref a thread is stored under. A currency is known by its code, which is
   the first token of its label; a rate by its pair ("USD/PKR"), prefixed by
   which of the pair's two rates it is. */
export function refOf(kind: CommSubjectKind, label: string): string {
  const head = label.split(' ')[0]
  if (!head) return 'No record'
  if (kind === 'corporate') return `CR-${head}`
  if (kind === 'mid') return `MR-${head}`
  return `CUR-${head}`
}

/** Distinct picks from a list, chosen by a seed. A record whose two threads
 *  carried the same subject read as a duplicate rather than as a history. */
function pickTemplates(list: ThreadTemplate[], seed: number, count: number): ThreadTemplate[] {
  const out: ThreadTemplate[] = []
  for (let i = 0; out.length < Math.min(count, list.length); i++) {
    // A stride of 7 shares no factor with any template list here, so it
    // walks the whole list before it repeats.
    const item = list[(seed + i * 7) % list.length]
    if (!out.includes(item)) out.push(item)
    else if (i > list.length * 3) break
  }
  // A stride that shares a factor with the list's length cycles early; fill
  // the rest in order rather than stop short.
  for (const item of list) if (out.length < Math.min(count, list.length) && !out.includes(item)) out.push(item)
  return out
}

/** The threads a record carries in the demo. Deterministic in the record's own
 *  id, so they neither shift between renders nor reshuffle on reload. */
export function seededThreads(
  subjectId: string,
  kind: CommSubjectKind,
  label: string,
  anchorIso: string,
): CommThread[] {
  if (!subjectId) return []
  const seed = hashSeed(`comms:${subjectId}`)
  // Every record the demo seeds carries two to four threads, so whichever
  // currency or rate the reader opens shows the tab doing its job. Read off
  // the seed's higher bits: codes differ in their last letters, and FNV's low
  // bits follow those letters too closely to spread the picks.
  const count = 2 + ((seed >>> 11) % 3)
  const templates = pickTemplates(TEMPLATES[kind], seed >>> 8, count)
  const anchor = new Date(anchorIso || Date.now()).getTime()
  const entityType: CommRecordKind = recordKindOf(kind)
  const entityRef = refOf(kind, label)
  const head = label.split(' ')[0] ?? ''
  const code = head.split('/')[0]
  const pair = head.includes('/') ? head : `${code}/${BASE_CURRENCY}`

  /* A thread whose last message would land after today is not seeded at all.
     Module review, 2026-10-06 (COA-31): a new account showed emails dated a
     week ahead. Dropping the thread, rather than sliding it back, keeps the rule
     above too - a thread never predates what it discusses. */
  const now = Date.now()
  return templates.map((tpl, t): CommThread | null => {
    if (anchor + (t + 1) * 5 * DAY + (tpl.messages.length - 1) * 2 * DAY > now) return null
    const threadId = `${subjectId}-thread-${t}`
    const who = hashSeed(`${subjectId}:${t}`)
    const person = PEOPLE[who % PEOPLE.length]
    const outside = OUTSIDE[tpl.party ?? who % OUTSIDE.length]

    const messages: CommMessage[] = tpl.messages.map((m, i) => {
      // Oldest first, ending a few days after the record's own date, so a
      // thread always reads forward and never predates what it discusses.
      const dateIso = new Date(anchor + (t + 1) * 5 * DAY + i * 2 * DAY).toISOString()
      /* An automated mail states the window it covers and the moment it was
         issued, so the tokens resolve against THIS message's date rather than
         the record's. A statement stamped with the account's creation date
         would be describing a run that never happened. */
      const monthStart = new Date(dateIso)
      monthStart.setUTCDate(1)
      const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0))
      const fill = (s: string) => s
        .replace(/\{label\}/g, label)
        .replace(/\{code\}/g, code)
        .replace(/\{pair\}/g, pair)
        .replace(/\{base\}/g, BASE_CURRENCY)
        .replace(/\{me\}/g, CURRENT_USER.name.split(' ')[0])
        .replace(/\{myEmail\}/g, CURRENT_USER.email)
        .replace(/\{period\}/g, `${longDate(monthStart.toISOString())} - ${longDate(monthEnd.toISOString())}`)
        .replace(/\{generated\}/g, stampOf(dateIso))
      const sender = m.automated
        ? SYSTEM_SENDER
        : m.outbound
          ? CURRENT_USER
          : m.channel === 'Email'
            ? { name: outside.name, email: outside.email }
            : { name: `${person.name} (${person.role})`, email: person.email }
      const recipient = m.channel === 'Note'
        ? { name: '', email: '' }
        : m.outbound
          ? { name: outside.name, email: outside.email }
          : CURRENT_USER
      return {
        id: `${threadId}-m${i}`,
        threadId,
        channel: m.channel,
        from: sender.name,
        fromEmail: sender.email,
        to: recipient.name,
        toEmail: recipient.email,
        timestamp: stampOf(dateIso),
        dateIso,
        body: fill(m.body),
        isOutbound: !!m.outbound,
        isAutomated: m.automated,
        isConfidential: m.confidential,
        attachments: m.attach?.map(a => ({
          name: `${head.replace('/', '-') || 'Record'}_${a.name}`,
          size: a.size,
          extracts: a.extract
            ? [{ recordRef: label, name: label, from: isoDate(anchorIso), to: isoDate(dateIso) }]
            : undefined,
        })),
      }
    })

    const last = messages[messages.length - 1]
    const attachmentCount = messages.reduce((n, m) => n + (m.attachments?.length ?? 0), 0)
    return {
      id: threadId,
      subjectId,
      entityType,
      entityRef,
      entityLabel: label,
      subject: tpl.subject.replace(/\{label\}/g, label).replace(/\{code\}/g, code).replace(/\{pair\}/g, pair),
      lastSender: last.from,
      lastSenderEmail: last.fromEmail,
      bodyPreview: previewOf(last.body),
      lastDate: shortDate(last.dateIso),
      dateIso: last.dateIso,
      // An inbound last word is what makes a thread look like it wants
      // something. A thread the reader themselves ended does not.
      isUnread: !last.isOutbound && (who + t) % 3 === 0,
      hasAttachments: attachmentCount > 0,
      attachmentCount,
      isAutomated: messages.some(m => m.isAutomated),
      messages,
    }
  }).filter((t): t is CommThread => t !== null)
}

/** Whether the reader made this record here, in this session's company: it
    starts with nothing said about it, no files and no notes (module review,
    2026-10-06, COA-31). The demo's seeded records carry their history. */
export const createdHere = (createdBy?: string): boolean => !!createdBy?.includes('(You)')

/** Initials as an avatar shows them: at most two letters, from the name. */
export function initialsOf(name: string): string {
  const parts = name.replace(/\(.*\)/g, '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** The record's whole correspondence: seeded and written together, newest
 *  thread first. One reader, so a tab and the count on it cannot disagree. */
export function threadsFor(
  storedThreads: CommThread[],
  storedMessages: CommMessage[],
  subjectId: string,
  kind: CommSubjectKind,
  label: string,
  anchorIso: string,
  fresh = false,
): CommThread[] {
  const seeded = fresh ? [] : seededThreads(subjectId, kind, label, anchorIso)
  const composed = storedThreads.filter(t => t.subjectId === subjectId)
  const byId = new Map<string, CommThread>()
  for (const t of [...seeded, ...composed]) byId.set(t.id, { ...t, messages: [...t.messages] })

  // A reply lands in the thread it answers.
  const answered = new Set<string>()
  for (const m of storedMessages) {
    const thread = m.threadId ? byId.get(m.threadId) : undefined
    if (!thread) continue
    thread.messages.push(m)
    answered.add(thread.id)
  }

  return [...byId.values()]
    .map(t => {
      const messages = [...t.messages].sort((a, b) => a.dateIso.localeCompare(b.dateIso))
      const last = messages[messages.length - 1]
      const attachmentCount = messages.reduce((n, m) => n + (m.attachments?.length ?? 0), 0)
      if (!last) return { ...t, messages, attachmentCount, hasAttachments: attachmentCount > 0 }
      return {
        ...t,
        messages,
        lastSender: last.from,
        lastSenderEmail: last.fromEmail,
        bodyPreview: previewOf(last.body),
        lastDate: shortDate(last.dateIso),
        dateIso: last.dateIso,
        attachmentCount,
        hasAttachments: attachmentCount > 0,
        // Answering a thread is reading it.
        isUnread: t.isUnread && !answered.has(t.id),
      }
    })
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso))
}

/** Every message on the record, flattened. What the tab's count reads. */
export function messageCountFor(threads: CommThread[]): number {
  return threads.reduce((n, t) => n + t.messages.length, 0)
}

/* ──────────────────────────────── Filtering ────────────────────────────────
   The source's whole filter set, all seven dimensions. It lives here rather
   than in the component so the count on the Filters button and the rows the
   list shows are computed by the same code: a button that claimed two filters
   while three were applied is the bug this placement prevents. */
export interface CommFilters {
  /** Refs to keep, e.g. ['ACC-1075']. Empty means every record. */
  records: string[]
  /** 'Note' | 'Email'. Empty means either. */
  channels: CommChannel[]
  /** 'user' | 'automated'. Empty means either. */
  writtenBy: string[]
  /** 'unread' | 'read'. Empty means either. */
  status: string[]
  /** 'me' | 'other'. Empty means either. */
  lastWord: string[]
  hasAttachments: boolean | null
  /** Searched over the full message bodies, not just the preview. */
  keyword: string
  hideAutomated: boolean
  dateFrom: string
  dateTo: string
}

export const DEFAULT_COMM_FILTERS: CommFilters = {
  records: [],
  channels: [],
  writtenBy: [],
  status: [],
  lastWord: [],
  hasAttachments: null,
  keyword: '',
  hideAutomated: false,
  dateFrom: '',
  dateTo: '',
}

/** What the badge on the Filters button reads. A date range counts once, not
 *  twice, because the reader set one thing. */
export function countActiveCommFilters(f: CommFilters): number {
  let n = 0
  if (f.records.length) n++
  if (f.channels.length) n++
  if (f.writtenBy.length) n++
  if (f.status.length) n++
  if (f.lastWord.length) n++
  if (f.hasAttachments !== null) n++
  if (f.keyword.trim()) n++
  if (f.hideAutomated) n++
  if (f.dateFrom || f.dateTo) n++
  return n
}

function matchesSearch(t: CommThread, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const haystack = [t.subject, t.entityRef, t.entityLabel, t.lastSender, t.bodyPreview]
  if (haystack.some(v => v.toLowerCase().includes(needle))) return true
  // A thread whose body holds the word is a hit even when its preview does not.
  // Searching correspondence and being shown only what fits in one line is the
  // behaviour readers report as "search is broken".
  return t.messages.some(m => m.body.toLowerCase().includes(needle))
}

/** The list, in the order and with the membership the panel renders. Newest
 *  first, because correspondence is read from the latest word backwards. */
export function filterThreads(
  threads: CommThread[],
  opts: { mailbox: Mailbox; archived: string[]; filters: CommFilters; search: string },
): CommThread[] {
  const { mailbox, archived, filters: f, search } = opts
  const isArchived = (t: CommThread) => archived.includes(t.id)

  return threads
    .filter(t => {
      // Mailbox first: it is a place, not a filter, and the others narrow within
      // it. Archived threads appear in exactly one mailbox, so a thread the
      // reader put away does not keep turning up under All.
      if (mailbox === 'archived') {
        if (!isArchived(t)) return false
      } else if (isArchived(t)) {
        return false
      }
      if (mailbox === 'sent' && !t.messages.some(m => m.isOutbound)) return false
      // Unmatched is read off the entity type rather than a flag of its own,
      // so unlinking a thread from its record is the single act that moves it:
      // set entityType to Other and the mailbox follows. A separate flag let
      // the two disagree, leaving an unlinked thread filed under its old record.
      if (mailbox === 'unmatched' && t.entityType !== 'Other') return false

      if (f.records.length && !f.records.includes(t.entityRef)) return false
      if (f.hideAutomated && t.isAutomated) return false
      if (f.keyword.trim() && !matchesSearch(t, f.keyword)) return false

      if (f.writtenBy.length) {
        const wantsAutomated = f.writtenBy.includes('automated')
        const wantsUser = f.writtenBy.includes('user')
        if (!((wantsAutomated && t.isAutomated) || (wantsUser && !t.isAutomated))) return false
      }
      if (f.status.length) {
        const wantsUnread = f.status.includes('unread')
        const wantsRead = f.status.includes('read')
        if (!((wantsUnread && t.isUnread) || (wantsRead && !t.isUnread))) return false
      }
      if (f.lastWord.length) {
        const mine = t.messages[t.messages.length - 1]?.isOutbound ?? false
        const wantsMe = f.lastWord.includes('me')
        const wantsOther = f.lastWord.includes('other')
        if (!((wantsMe && mine) || (wantsOther && !mine))) return false
      }
      if (f.channels.length && !t.messages.some(m => f.channels.includes(m.channel))) return false
      if (f.hasAttachments !== null && t.hasAttachments !== f.hasAttachments) return false

      const day = t.dateIso.slice(0, 10)
      if (f.dateFrom && day < f.dateFrom) return false
      if (f.dateTo && day > f.dateTo) return false

      return matchesSearch(t, search)
    })
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso))
}

/** How many threads each mailbox holds, for the counts on its pill. Computed
 *  with the filters applied but the mailbox ignored, so a count says what
 *  clicking would actually show. */
export function mailboxCounts(
  threads: CommThread[],
  opts: { archived: string[]; filters: CommFilters; search: string },
): Record<Mailbox, number> {
  const boxes: Mailbox[] = ['all', 'sent', 'archived', 'unmatched']
  const out = {} as Record<Mailbox, number>
  for (const mailbox of boxes) out[mailbox] = filterThreads(threads, { ...opts, mailbox }).length
  return out
}
