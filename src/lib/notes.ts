import type { Account, AccountType } from '../types'
import { hashSeed, type ReconstructedEntry } from './journalEntry'
import { sourceDocName, sourceHasLinkedDoc } from './seed'
import { fmtCurrency } from './utils'

/* ─────────────────────────── A record's notes ───────────────────────────
   What the team wrote against an account or a journal entry, on its Notes tab.
   Mahad, 2026-10-06, of the tab's design: *"Can we have dummy data as well? as
   shown in the screenshot."* - so every record opens with a few notes, the way
   one in use would.

   Those are derived from the record, as an entry's correspondence is
   (`seededThreads`), never stored: there are thousands of entries, and a note
   that is only demo text has no reason to sit in the browser's storage. What is
   stored is what the reader does - the notes they add (`recordNotes`) and the
   ids of any they delete (`removedNotes`) - so a derived note taken off stays
   off, and comes back with Undo.

   A figure in a derived note is the record's own: an entry's total is printed
   from the entry, never invented. */
export interface RecordNote {
  id: string
  text: string
  author: string
  at: string
  /** Where a note carried over came from, drawn as a chip before its author -
   *  the design's "Plan Note". Absent on a note written on the record itself. */
  tag?: string
}

/** The key a record's notes are kept under: one store slice for every kind. */
export const noteKey = (kind: 'account' | 'entry', id: string) => `${kind}:${id}`

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/* Who writes them: the people the demo's chart and ledger already name. */
const CONTROLLER = 'Ayesha Khan (Controller)'
const ACCOUNTANTS = ['Marcus Lee (Accountant)', 'Daniel Osei (Accountant)']
const BY_CATEGORY: Record<AccountType, string[]> = {
  AST: [CONTROLLER, ...ACCOUNTANTS],
  LIA: [CONTROLLER, ...ACCOUNTANTS],
  EQT: [CONTROLLER],
  REV: [CONTROLLER, 'Hannah Weiss (Sales Director)', ACCOUNTANTS[0]],
  EXP: [CONTROLLER, ...ACCOUNTANTS, 'Ravi Menon (Plant Supervisor)'],
}

type Line = (v: { month: string; name: string }) => string

const POSTING_LINES: Record<AccountType, Line[]> = {
  AST: [
    v => `Reconciled to the ${v.month} statement. No differences to carry forward.`,
    () => 'Balance reviewed at month end. The supporting schedule is in Attachments.',
    () => 'Check the aging before the quarter closes. A few items look older than 90 days.',
    () => 'Confirmed nothing is in transit at month end, so the balance stands as booked.',
    v => `${v.name} is in scope for the year-end audit. Keep the workpapers in Attachments.`,
  ],
  LIA: [
    v => `Accrual reviewed against open invoices. Reverse the ${v.month} accrual on the first of next month.`,
    () => 'Agreed to the supplier statement. One invoice is still under query.',
    () => "Friday's payment run should clear most of this balance.",
    v => `${v.name} reviewed with the controller. Nothing to reclass this month.`,
  ],
  EQT: [
    () => 'Only the year-end close should post here. Raise anything else with the controller first.',
    () => "Opening balance agreed to last year's signed accounts.",
    v => `${v.name} reviewed for the board pack. No movement expected before year end.`,
  ],
  REV: [
    v => `Revenue cut-off checked for ${v.month}. Two shipments moved to next month.`,
    () => 'Credit notes for returns are booked here as well, so expect a few debits.',
    () => 'Agreed to the sales report before the month closed.',
    v => `${v.name} split by Location from this quarter. Keep the dimension on every line.`,
  ],
  EXP: [
    () => 'Recurring charge. Check it against the contract each quarter.',
    v => `Coded by department from ${v.month}. Use the Department dimension on every line.`,
    () => 'Spend is on budget for the year. Flag anything unusual to the controller before it posts.',
    v => `${v.name} reviewed in the month-end pack. No changes needed.`,
  ],
}

const SUMMARY_LINES: Line[] = [
  v => `Totals reviewed with the controller for ${v.month}. Nothing to reclass.`,
  () => "Keep new accounts under this summary numbered inside its range.",
  () => 'Check the accounts under this one before the quarter closes.',
  v => `${v.name} is a line on the management pack. Tell the controller before adding to it.`,
]

/* Hand-written for the three accounts the demo leans on, so their notes read as
   theirs rather than as any account's. */
/* Each keeps the id the build that first seeded it stored it under, so a browser
   holding that copy shows it once. */
const WRITTEN: Record<string, { id: string; text: string; author: string; days: number; hour: number; minute: number }[]> = {
  acct_11130: [
    { id: 'note_11130_3', text: 'Chase moved the statement cut-off to the 25th from November. Reconcile against the new date from then on.', author: CONTROLLER, days: 3, hour: 9, minute: 15 },
    { id: 'note_11130_2', text: 'Two outgoing wires to Meridian Supplies are still in transit. Expect them to clear by Friday.', author: ACCOUNTANTS[0], days: 9, hour: 11, minute: 20 },
    { id: 'note_11130_1', text: 'Signatories updated after the board meeting. The new authorisation letter is in Attachments.', author: CONTROLLER, days: 40, hour: 16, minute: 5 },
  ],
  acct_52310: [
    { id: 'note_52310_1', text: 'The new Harbor Point lease starts next month. Rent is billed on the 1st, so accrue it at month end.', author: CONTROLLER, days: 6, hour: 10, minute: 40 },
  ],
  acct_21310: [
    { id: 'note_21310_1', text: 'Renamed from Wages Payable so it reads as the accrual it is. Payroll clears it on the first run of each month.', author: ACCOUNTANTS[0], days: 22, hour: 14, minute: 30 },
  ],
}

/** A moment `days` before now, in working hours. */
const daysAgo = (days: number, hour: number, minute: number, now: Date) => {
  const t = new Date(now)
  t.setDate(t.getDate() - days)
  t.setHours(hour, minute, 0, 0)
  return t
}

/** Two or three distinct picks from a list, chosen by a seed. */
function pick<T>(list: T[], seed: number, count: number): T[] {
  const out: T[] = []
  for (let i = 0; out.length < Math.min(count, list.length); i++) {
    const item = list[(seed + i * 7) % list.length]
    if (!out.includes(item)) out.push(item)
  }
  return out
}

/** The notes an account opens with. */
export function accountNotes(account: (Pick<Account, 'id' | 'accountName' | 'accountType' | 'glAccountType' | 'arrivedByImport' | 'createdAt'> & { createdBy?: string }) | undefined, now = new Date()): RecordNote[] {
  if (!account) return []
  /* An account the reader created here starts with no notes: nobody has
     written anything about it yet (module review, 2026-10-06, COA-31; still
     open on the retest of 2026-10-07, where a new 12170 showed two notes dated
     before it existed). */
  if (account.createdBy?.includes('(You)') && !account.arrivedByImport) return []
  const written = WRITTEN[account.id]
  if (written) {
    return written.map(w => ({ id: w.id, text: w.text, author: w.author, at: daysAgo(w.days, w.hour, w.minute, now).toISOString() }))
  }
  const h = hashSeed(account.id)
  const lines = account.glAccountType === 'Summary' ? SUMMARY_LINES : POSTING_LINES[account.accountType]
  const authors = BY_CATEGORY[account.accountType]
  /* An account that arrived by import brings the note it was imported with,
     written when it arrived, by whoever ran the import. */
  const arrived = account.arrivedByImport && account.createdAt && !Number.isNaN(new Date(account.createdAt).getTime())
  const carried: RecordNote[] = arrived ? [{
    id: `note_${account.id}_import`,
    text: 'Brought over from the previous system. Balance agreed to the trial balance it came with.',
    author: ACCOUNTANTS[0],
    at: account.createdAt,
    tag: 'Import Note',
  }] : []
  const count = arrived ? 2 : 2 + (h % 2)
  return [...carried, ...pick(lines, h, count).map((line, i) => {
    const s = hashSeed(`${account.id}:${i}`)
    const at = daysAgo(1 + i * 9 + (s % 8), 9 + (s % 8), (s >>> 3) % 60, now)
    return {
      id: `note_${account.id}_${i}`,
      text: line({ month: MONTHS[at.getMonth()], name: account.accountName }),
      author: authors[(s >>> 5) % authors.length],
      at: at.toISOString(),
    }
  })]
}

type EntryLine = (v: { source: string; total: string; month: string; poster: string }) => string

const ENTRY_LINES: EntryLine[] = [
  v => `Checked against the ${v.source.toLowerCase()}. Amounts agree.`,
  v => `Total of ${v.total} agrees to the supporting schedule.`,
  v => `Posted to ${v.month}, the period it belongs to.`,
  () => 'Reviewed in the month-end pack. No changes needed.',
  () => 'Raised a question with the supplier about one line. Leave it as is until they reply.',
  v => `${v.poster} confirmed the coding before it posted.`,
]
/* The one line that names a person as having checked something; an entry the
   system posted has nobody to name, so it is not offered there. */
const NAMES_POSTER = ENTRY_LINES[ENTRY_LINES.length - 1]
/* The note an entry brings from the document that raised it in its own module. */
const DOCUMENT_LINES: EntryLine[] = [
  v => `Approved in ${v.source} before it posted to the ledger.`,
  () => 'Amounts agreed to the paperwork before it was sent for posting.',
  () => 'Coding checked by the requester and signed off by their manager.',
]

const MANUAL_LINES: EntryLine[] = [
  () => 'Supporting calculation is in Attachments.',
  v => `Total of ${v.total} agrees to the working paper.`,
  v => `Reviewed by the controller before ${v.month} closed.`,
  () => 'One-off correction. It should not recur next month.',
]

/** The notes a journal entry opens with: written after it was dated, never in
 *  the future. */
export function entryNotes(entry: Pick<ReconstructedEntry, 'jeNumber' | 'date' | 'source' | 'totalDebit' | 'createdBy'> | undefined, base: string, now = new Date()): RecordNote[] {
  // An entry the ledger does not hold comes back with no date: the page says it
  // is not there, and nothing is written about it.
  if (!entry?.date || Number.isNaN(new Date(`${entry.date}T00:00:00`).getTime())) return []
  // Posted by the reader here: nothing written about it yet (COA-31).
  if (entry.createdBy.includes('(You)')) return []
  const h = hashSeed(entry.jeNumber)
  const manual = entry.source === 'Manual JE'
  const automated = /^system\b/i.test(entry.createdBy)
  const lines = manual ? MANUAL_LINES : automated ? ENTRY_LINES.filter(l => l !== NAMES_POSTER) : ENTRY_LINES
  const dated = new Date(`${entry.date}T00:00:00`)
  const poster = entry.createdBy.replace(/\s*\(.*?\)\s*/g, '').trim()
  const values = { source: sourceDocName(entry.source), total: fmtCurrency(entry.totalDebit, base), month: MONTHS[dated.getMonth()], poster: poster || 'The poster' }
  /* An entry raised by a document in another module brings that document's note
     with it, written on the morning of the entry's date - before anything was
     said about it here - and tagged with the document it came from. */
  const fromDoc = sourceHasLinkedDoc(entry.source)
  const carriedAt = new Date(dated)
  carriedAt.setHours(8, (h >>> 4) % 50, 0, 0)
  const carried: RecordNote[] = fromDoc ? [{
    id: `note_${entry.jeNumber}_doc`,
    text: DOCUMENT_LINES[h % DOCUMENT_LINES.length](values),
    author: ACCOUNTANTS[(h >>> 2) % ACCOUNTANTS.length],
    at: (carriedAt > now ? new Date(now.getTime() - 4 * 3600_000) : carriedAt).toISOString(),
    tag: `${values.source} Note`,
  }] : []
  const count = fromDoc ? 2 : 2 + (h % 2)
  return [...carried, ...pick(lines, h, count).map((line, i) => {
    const s = hashSeed(`${entry.jeNumber}:${i}`)
    const at = new Date(dated)
    at.setDate(at.getDate() + i * 2 + (s % 3))
    at.setHours(9 + (s % 8), (s >>> 3) % 60, 0, 0)
    const when = at > now ? new Date(now.getTime() - (i + 1) * 3600_000) : at
    return {
      id: `note_${entry.jeNumber}_${i}`,
      text: line(values),
      author: [CONTROLLER, ...ACCOUNTANTS][(s >>> 5) % 3],
      at: when.toISOString(),
    }
  })]
}
