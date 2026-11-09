/* Issuing the internal id (see Account.internalId).
 *
 * One shape, one counter, and no reuse. The counter reads the chart rather than
 * being held somewhere: whatever the highest issued id is, the next one is above
 * it. A deleted account's id is therefore never handed out again - which is the
 * whole point of the field, since something outside this module may still be
 * naming it.
 *
 * Sequential rather than random. It is read aloud, typed into another system's
 * search box, and quoted in a ticket, so it has to be short enough to carry and
 * distinct enough to check; a uuid is neither.
 */

const PREFIX = 'ACC'
const WIDTH = 6

/* What the field is called and how it is explained, wherever it is shown: the
   listing's column, its header tooltip and the account page's rail. One copy,
   so the reader who finds it in one place recognises it in the other.

   Shown at all because of the design review of 2026-09-24. Eli: *"expose it in
   the table so it becomes searchable ... And expose it in the detail view of the
   item. You could put it at the bottom in a bottom card, something out of the
   way."* The account number belongs to the customer and is a label; this is the
   handle the system knows the account by, and it has to be findable for the
   day someone quotes it from another system. */
export const INTERNAL_ID_LABEL = 'Internal ID'
export const INTERNAL_ID_HELP = 'The ID Omne gave this account when it was created. It never changes, even if the account is renumbered or renamed, so other systems and reports can always find this account by it. Searching for it finds this account.'

export function formatInternalId(seq: number): string {
  return `${PREFIX}-${String(seq).padStart(WIDTH, '0')}`
}

/** The number inside an id, or 0 for anything that is not one of ours. */
export function internalIdSeq(internalId: string | undefined): number {
  const m = /^ACC-(\d+)$/.exec(internalId ?? '')
  return m ? parseInt(m[1], 10) : 0
}

/**
 * The next `count` ids for a chart. Takes the whole chart including archived and
 * inactive accounts - an archived account is still an account something may be
 * pointing at, and skipping it would hand its id to a different one.
 */
export function nextInternalIds(existing: { internalId?: string }[], count: number): string[] {
  let cursor = existing.reduce((max, a) => Math.max(max, internalIdSeq(a.internalId)), 0)
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(formatInternalId(++cursor))
  return out
}

export function nextInternalId(existing: { internalId?: string }[]): string {
  return nextInternalIds(existing, 1)[0]
}

/* The same kind of ID for a journal entry. Mahad, 2026-09-30: *"Additional
   column for Journal Internal ID."* The JE number is the entry's reference, and
   a year runs its own sequence; this is the handle the system knows the entry by,
   one counter across every year. Its own prefix, so an ID quoted from elsewhere
   says what kind of record it names. Repeated on each of the entry's postings
   (`Transaction.entryInternalId`), like the memo. */
const JOURNAL_PREFIX = 'JNL'
/* Named for the kind of record, beside the account's plain "Internal ID" - Mahad,
   2026-09-30: *"Change Internal ID to "Journal Entry ID" in general ledger
   listing page and journal entry listing page."* The entry page's rail reads the
   same, since a field names a fact the way its column does. */
// Sentence case, as every other label (OMNE writing standard; module review,
// 2026-10-06, COA-30), and as Outline 05 lists it.
export const JOURNAL_INTERNAL_ID_LABEL = 'Journal entry ID'
export const JOURNAL_INTERNAL_ID_HELP = 'The ID Omne gave this journal entry when it was posted. It never changes, so other systems and reports can always find this entry by it. Searching for it finds this entry.'

export function formatJournalInternalId(seq: number): string {
  return `${JOURNAL_PREFIX}-${String(seq).padStart(WIDTH, '0')}`
}

export function journalInternalIdSeq(id: string | undefined): number {
  const m = /^JNL-(\d+)$/.exec(id ?? '')
  return m ? parseInt(m[1], 10) : 0
}

/** The next journal ID after every one the ledger holds. */
export function nextJournalInternalId(postings: { entryInternalId?: string }[]): string {
  const highest = postings.reduce((max, t) => Math.max(max, journalInternalIdSeq(t.entryInternalId)), 0)
  return formatJournalInternalId(highest + 1)
}
