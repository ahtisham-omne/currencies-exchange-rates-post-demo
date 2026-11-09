import type { Account, Transaction, JournalEntryType, Period } from '../types'
import { CONTROL_ACCOUNT_SHORT, isControlAccountRole } from '../types'
import { isRetainedEarnings, isRetainedEarningsAdjustments } from './accountLifecycle'
import { SOURCE_DOC } from './seed'
import { scenarioById, scenarioParty } from './txScenarios'
import { fmtDate, todayIso } from './utils'
import { postingDimensions } from './dimensionDefaults'

// A posting's period is a function of its date, never an independent choice -
// the seed asserts the same invariant when it builds transactions. Dates arrive
// as either 'YYYY-MM-DD' or a full ISO timestamp, so compare on the day part.
export function periodForDate(iso: string, periods: Period[]): Period | undefined {
  if (!iso) return undefined
  const day = iso.slice(0, 10)
  return periods.find(p => day >= p.startDate && day <= p.endDate)
}

// Why the given date can't be posted on, or null when it can. Once the period
// is derived rather than picked, the date field is the only place this
// constraint can surface, so the message has to name the period and its state.
export function periodPostingBlock(iso: string, periods: Period[]): string | null {
  if (!iso) return null
  const period = periodForDate(iso, periods)
  if (!period) return 'That date falls outside every accounting period you have defined.'
  if (period.status === 'Hard-Locked') return `${period.label} is locked - nothing can be posted into it.`
  if (period.status === 'Soft-Closed') return `${period.label} is closed - it has to be reopened before you can post here.`
  return null
}

/* ───────────────── Accounts the system keeps ─────────────────
   Two kinds of account are owned by something other than the person typing, and
   posting to them by hand puts the GL out of step with whatever owns them. A
   control account's balance is the subledger's; retained earnings' is the
   year-end close's.

   Neither is refused. A closed year can turn out to have been wrong, and the
   correction has nowhere else to land - neither the close nor the subledger will
   recalculate a period it has already run through. So both are offered like any
   other account, and picking one is what brings up the adjustment flow: a reason
   and the document behind it. Design review, 2026-09-28 - Eli: *"when I hit
   Retained Earnings, I should get whatever you're trying to do here ... That
   shouldn't happen until I've selected ... that specific control account."* It
   replaced an always-visible "Prior period adjustment" switch that greyed these
   accounts until it was turned on, which put a rare, book-length decision in
   front of every entry.

   Retained earnings is two accounts under one summary (design review, same
   day): the system account the close posts to, and a manual adjustments account
   for corrections. Where the chart has both, a hand-written entry is sent to the
   manual one and the system account is closed to it, so the two sets of
   transactions never mix. A chart with only one retained earnings account - one
   built in setup, say - keeps it open, with the flow, since there is nowhere
   else for a correction to go.

   What a hand-written entry cannot reach either way is what the reader closed -
   `Inactive` and `Archived` are their own decision, and posting is not a way
   back onto the chart. */
export const RETAINED_EARNINGS_POSTING_SHORT = 'Year-end close posts here'
export const RETAINED_EARNINGS_ADJUSTMENTS_SHORT = 'Corrections to retained earnings'
export const retainedEarningsSystemLock = (adjustments: Pick<Account, 'accountNumber'>) =>
  `Year-end close only, corrections go to ${adjustments.accountNumber}`

/* The same lock, said on the account's own page rather than in a picker option.
   Shaped like `CONTROL_ACCOUNT_LOCK_LINE` because it sits in the same list, under
   the same padlock, and the two locks should not read as two different kinds of
   thing. The exception gets a line of its own, and is shared by both locks: a
   reader on this page is asking why the journal entry picker refused the
   account, and the honest answer is that it refused a plain entry, not every
   entry. */
export const RETAINED_EARNINGS_LOCK_LINE = 'The year-end close posts here, and nothing else does'
export const PRIOR_PERIOD_EXCEPTION_LINE = 'You can still post here by hand to correct a closed period. The journal entry asks for a written reason.'
export const retainedEarningsRedirectLine = (adjustments: Pick<Account, 'accountNumber' | 'accountName'>) =>
  `Corrections made by hand go to ${adjustments.accountNumber} ${adjustments.accountName}, with a written reason.`
export const RETAINED_EARNINGS_ADJUSTMENTS_LINE = 'Corrections to retained earnings made by hand land here, each with a written reason. It rolls up into retained earnings with the system account.'

/* The other two locks, and the only ones a reader put there themselves. Deactivate
   is defined as a lock rather than a removal - the account stays on the chart and
   keeps its history, and what it stops is exactly this. Archive goes further and
   takes it off the chart. Neither had any effect here, so an account taken out of
   service went on accepting entries and the state said nothing. */
export const INACTIVE_POSTING_SHORT = 'Deactivated, no new postings'
export const ARCHIVED_POSTING_SHORT = 'Archived, off the chart'

/** Why a hand-written line cannot post to this account, short enough to ride in a
 *  picker option's label, or undefined when it can. The whole reason is the
 *  option's hover - see `unpostableReason`. */
export function manualPostingLock(
  account: Pick<Account, 'status'> & Partial<Pick<Account, 'accountRole'>>,
  /** The chart's manual retained earnings account, when it has one. */
  retainedEarningsAdjustments?: Pick<Account, 'accountNumber'>,
): string | undefined {
  if (account.status === 'Archived') return ARCHIVED_POSTING_SHORT
  if (account.status === 'Inactive') return INACTIVE_POSTING_SHORT
  if (retainedEarningsAdjustments && account.accountRole === 'Retained Earnings') return retainedEarningsSystemLock(retainedEarningsAdjustments)
  return undefined
}

/* Why an account in the journal entry's picker cannot be picked, in a sentence,
   for the option's hover. The short lock above rides in the option's label; this
   is the whole answer, and a summary - which has no lock, only nothing to post
   to - gets one too. Design review, 2026-10-02: Eli could not pick Operating
   revenue and could not tell why. Nophil: *"there should be a hover state that
   tells you why it's not selectable"*; no pills. Undefined for an account that
   can be picked. */
export function unpostableReason(
  account: Pick<Account, 'status' | 'isPosting' | 'accountName'> & Partial<Pick<Account, 'accountRole'>>,
  retainedEarningsAdjustments?: Pick<Account, 'accountNumber' | 'accountName'>,
): string | undefined {
  if (!account.isPosting) return `${account.accountName} is a summary account. It adds up the accounts under it, so it can't take entries itself. Pick one of the accounts under it.`
  if (account.status === 'Archived') return `${account.accountName} is archived. It's off the chart and takes no new entries.`
  if (account.status === 'Inactive') return `${account.accountName} is deactivated, so it takes no new entries. Turn it back on from its page to post here.`
  if (retainedEarningsAdjustments && account.accountRole === 'Retained Earnings') {
    return `Only the year-end close posts to ${account.accountName}. Corrections made by hand go to ${retainedEarningsAdjustments.accountNumber} ${retainedEarningsAdjustments.accountName}.`
  }
  return undefined
}

/** The chart's manual retained earnings account, if it has one in service. */
export function retainedEarningsAdjustmentsOf(accounts: Account[]): Account | undefined {
  return accounts.find(a => isRetainedEarningsAdjustments(a) && a.status === 'Active')
}

export type AdjustmentKind = 'retained-earnings' | 'control'

/** Which kind of system-kept account this is, when it is one: a line on it makes
 *  the entry an adjustment, which owes a reason and its document. Retained
 *  earnings is asked first - it is the one the flow explains at length. */
export function adjustmentKind(account: Pick<Account, 'accountRole'> | undefined): AdjustmentKind | undefined {
  if (!account) return undefined
  if (isRetainedEarnings(account) || isRetainedEarningsAdjustments(account)) return 'retained-earnings'
  if (isControlAccountRole(account.accountRole)) return 'control'
  return undefined
}

/** How a system-kept account is marked in the picker: offered, and told apart. */
export function adjustmentAccountNote(kind: AdjustmentKind | undefined, account?: Pick<Account, 'accountRole'>): string | undefined {
  if (kind === 'retained-earnings') return account && isRetainedEarningsAdjustments(account) ? RETAINED_EARNINGS_ADJUSTMENTS_SHORT : RETAINED_EARNINGS_POSTING_SHORT
  if (kind === 'control') return CONTROL_ACCOUNT_SHORT
  return undefined
}

/* The next number in the year's run. It used to be four random digits, which is
   not a number so much as a hope: the ledger groups postings by JE number, so the
   day two entries drew the same one the second vanished into the first and wore
   its date and its description. Reading the highest already issued costs one pass
   and cannot collide.

   The year sits in the prefix, so each year starts its own run at 0001 and a
   number carries the year it belongs to. Both the entries and the postings are
   read, because a seeded posting can carry a number no entry record claims. */
/* An entry written in another currency, turned into the base figures the ledger
   holds. Mahad, 2026-09-30, asked for a currency on the journal entry, entered
   in that currency and posted in base at the rate.

   Worked in cents. Each line is divided by the rate and rounded to the cent, and
   rounding line by line can leave an entry that balances in euros a cent apart
   in dollars - which the entry page would then read as unbalanced and pad with
   a contra line. The cent (or two) goes on the largest line of the side that
   came out short, where it moves the line least. */
export function toBaseLines<L extends { debit: number; credit: number }>(lines: L[], rate: number): (L & { baseDebit: number; baseCredit: number })[] {
  const cents = (v: number) => Math.round((v / rate) * 100)
  const out = lines.map(l => ({ ...l, dc: cents(l.debit), cc: cents(l.credit) }))
  const gap = out.reduce((s, l) => s + l.dc - l.cc, 0)
  if (gap !== 0) {
    const side: 'dc' | 'cc' = gap > 0 ? 'cc' : 'dc'
    const largest = out.reduce((best, l) => (l[side] > (best?.[side] ?? -1) ? l : best), out[0])
    largest[side] += Math.abs(gap)
  }
  return out.map(({ dc, cc, ...l }) => ({ ...(l as unknown as L), baseDebit: dc / 100, baseCredit: cc / 100 }))
}

export function nextJeNumber(issued: Iterable<string>, date: string): string {
  const prefix = `JE-${date.slice(0, 4)}-`
  let highest = 0
  for (const number of issued) {
    if (!number.startsWith(prefix)) continue
    const seq = Number(number.slice(prefix.length))
    if (Number.isInteger(seq) && seq > highest) highest = seq
  }
  return `${prefix}${String(highest + 1).padStart(4, '0')}`
}

/* A date that can actually be posted on: today when it lands in an open period,
   otherwise the newest open period that has already begun, and never a date in
   the future. Empty when nothing is open at all, which is the one case a caller
   has to answer for itself.

   Backing off to the newest open period rather than taking its end date outright
   matters because open periods run to the end of the fiscal year - months past
   today for most of it, so the end date is a future posting date. */
export function firstPostableDate(periods: Period[]): string {
  const today = todayIso()
  if (periods.length && !periodPostingBlock(today, periods)) return today
  const open = periods.filter(p => p.status === 'Open')
  if (!open.length) return ''
  const begun = open.filter(p => p.startDate <= today)
  if (begun.length) {
    const p = begun[begun.length - 1]
    return p.endDate <= today ? p.endDate : today
  }
  /* Every open period is still ahead of today, so every postable date is too.
     The earliest is the least wrong of them. */
  return open[0].startDate
}

/* The dimension values a posting to this account carries. Taken from the account
   and nothing else: an account read out of 01-71100-40 is the Department 40 one,
   so picking the account is what picks the dimensions and a line has nothing left
   to decide. Re-picking the account therefore replaces the line's values outright
   rather than leaving the old account's behind.

   One value per dimension, the default: an account carrying USA and Singapore
   posts a line to the one marked default, because a line amount can only land in
   one place (Mahad, 2026-10-02).

   Copied rather than shared, so editing the account later does not rewrite what
   was already posted. */
export function dimensionsOfAccount(
  account: Pick<Account, 'defaultDimensionValues'> | undefined,
): { dimensionId: string; value: string }[] {
  return postingDimensions(account?.defaultDimensionValues)
}

/* ─────────────────────── What still blocks a post ───────────────────────
   A journal entry balances on its amounts alone: the two totals reconcile
   whether or not every line names an account. So "balanced" cannot be the whole
   gate - a balanced entry can still be short an account, and pressing Post on one
   used to set the amounts down and appear to do nothing. These name what is left,
   so the row that owns each problem and the banner beside the button read one
   list rather than disagreeing. Balance itself is deliberately absent: the live
   bar under the lines states the shortfall and Post stays disabled until it
   clears, which is the very reason a still-unbalanced entry never reaches here. */

export type JeProblemField = 'date' | 'lines' | 'reason'
export interface JeProblem { field: JeProblemField; message: string }

export interface JeLineFigures { accountId: string; debit: number; credit: number }

export interface JeValidationInput {
  date: string
  /** Why the date's period will not take a posting, when it will not. */
  periodBlock?: string
  lines: JeLineFigures[]
  /** A line posts to retained earnings or a control account. */
  adjustment: boolean
  /** Why, in the poster's words. Required on an adjustment. */
  reason: string
}

// A line the reader started but left half-made: an amount with no account, or an
// account with no amount. The account-less half is the one Post used to wave
// through, so it is named on its own row as well as in the submit banner.
export function isPartialJeLine(l: JeLineFigures): boolean {
  const hasAmount = l.debit > 0 || l.credit > 0
  return (hasAmount && !l.accountId) || (!!l.accountId && !hasAmount)
}

export function journalEntryProblems(input: JeValidationInput): JeProblem[] {
  const problems: JeProblem[] = []
  const complete = input.lines.filter(l => l.accountId && (l.debit > 0 || l.credit > 0))
  if (!input.date) problems.push({ field: 'date', message: 'Pick the date this entry posts on.' })
  else if (input.periodBlock) problems.push({ field: 'date', message: input.periodBlock })
  if (input.lines.some(isPartialJeLine)) problems.push({ field: 'lines', message: 'Every line needs both an account and an amount. Finish or remove the ones left incomplete.' })
  else if (complete.length < 2) problems.push({ field: 'lines', message: 'An entry needs at least two complete lines.' })
  /* Written, not picked. Design review, 2026-09-28 - Eli: *"normally I don't
     require explanations, but for retained earnings adjustment, this is screwing
     around with something that's serious."* A supporting document was left
     undecided (*"I don't know about the attachments to evidence"*), so it is
     asked for but not required. */
  if (input.adjustment && !input.reason.trim()) problems.push({ field: 'reason', message: 'Write why this adjustment is needed.' })
  return problems
}

// The GL stores one posting line per row, but a journal entry is the whole
// balanced set of debits and credits. This module reconstructs the full entry
// from the postings that share a JE number, synthesising the contra line(s)
// when the seed only carries the primary side, so the detail page always shows
// a balanced entry the way an accountant expects to read it.

export interface JeLine {
  id: string
  accountId: string
  account?: Account
  debit: number
  credit: number
  description: string
  entity?: string
  // The dimensions this line carries, inherited from the account it posts to.
  // A real posting stores the snapshot it inherited at post time; a synthesised
  // contra line has none stored, so it reads the contra account's own defaults.
  dimensionValues: { dimensionId: string; value: string }[]
  synthetic?: boolean
  /** The line as it was typed, on an entry written in another currency. */
  fxDebit?: number
  fxCredit?: number
}

export interface ReconstructedEntry {
  jeNumber: string
  date: string
  memo: string
  /** Why it was posted to an account the system keeps, when it was. */
  adjustmentReason?: string
  /** Why it was reversed, on a reversing entry. */
  reversalReason?: string
  /** The ID the system gave the entry (JNL-000123). */
  entryInternalId?: string
  /** The currency it was written in and the rate it posted at, when that was
   *  not the base currency. */
  entryCurrency?: string
  entryRate?: number
  period: string
  status: 'Draft' | 'Posted' | 'Reversed'
  source: string
  reference: string
  hasLinkedDoc: boolean
  entryType: JournalEntryType
  lines: JeLine[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
  createdBy: string
  createdAt: string
  reversalDate?: string
  /** The entry that reverses this one, and the entry this one reverses. Both
   *  read from the ledger rather than passed in, so a surface showing an entry
   *  cannot show it without them. */
  reversalNo?: string
  reverses?: string
  found: boolean
}

// Tiny deterministic hash so the same JE always reconstructs the same contra
// account, party and author - no flicker between renders.
export function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const AUTHORS = [
  'Ayesha Khan (Controller)',
  'Daniel Osei (Accountant)',
  'System (Automated)',
]
const VENDORS = ['Meridian Supplies', 'Northwind Traders', 'Blue Harbor Logistics', 'Apex Facilities']
const CUSTOMERS = ['Lumen Retail', 'Crestline Group', 'Vantage Partners', 'Solaris Media']

// A seeded posting names its counterparty through its scenario, so the entry and
// the source document behind it always agree. Postings made in the app carry no
// scenario, so those fall back to a party inferred from the source.
function partyFor(source: string, seed: number): string | undefined {
  if (source === 'Vendor Invoice' || source === 'Vendor Payments' || source === 'Receiving') return VENDORS[seed % VENDORS.length]
  if (source === 'Customer Invoice' || source === 'Customer payments' || source === 'RMA') return CUSTOMERS[seed % CUSTOMERS.length]
  return undefined
}

// Pick a deterministic contra account whose normal balance can absorb the
// imbalance without duplicating an account already on the entry.
function pickContra(accounts: Account[], used: Set<string>, needSide: 'debit' | 'credit', seed: number): Account | undefined {
  const wantNormal = needSide === 'debit' ? 'Debit' : 'Credit'
  const pool = accounts.filter(a => a.isPosting && !used.has(a.id) && a.normalBalance === wantNormal)
  const candidates = pool.length ? pool : accounts.filter(a => a.isPosting && !used.has(a.id))
  if (!candidates.length) return undefined
  return candidates[seed % candidates.length]
}

export function reconstructEntry(
  jeNumber: string,
  transactions: Transaction[],
  accounts: Account[],
): ReconstructedEntry {
  const acctById = new Map(accounts.map(a => [a.id, a]))
  const primary = transactions.filter(t => t.jeNumber === jeNumber)
  const seed = hashSeed(jeNumber)

  if (!primary.length) {
    return {
      jeNumber, date: '', memo: '', period: '', status: 'Posted',
      source: '', reference: '', hasLinkedDoc: false, entryType: 'Simple',
      lines: [], totalDebit: 0, totalCredit: 0, balanced: true,
      createdBy: '', createdAt: '', found: false,
    }
  }

  const head = primary[0]
  const source = head.source
  const doc = SOURCE_DOC[source]
  const hasLinkedDoc = !!doc?.linked && !!head.reference

  const lines: JeLine[] = primary.map(t => ({
    id: t.id,
    accountId: t.accountId,
    account: acctById.get(t.accountId),
    debit: t.debit,
    credit: t.credit,
    fxDebit: t.fxDebit,
    fxCredit: t.fxCredit,
    description: t.description,
    entity: scenarioParty(t.scenarioId) ?? partyFor(source, hashSeed(t.id)),
    // The dimensions posted with this line. A stored posting carries its own
    // snapshot; where none was stored the account's current defaults are the
    // inherited values to fall back on.
    dimensionValues: t.dimensionValues?.length
      ? t.dimensionValues.map(v => ({ ...v }))
      : dimensionsOfAccount(acctById.get(t.accountId)),
  }))

  const used = new Set(lines.map(l => l.accountId))
  let totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  let totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  const imbalance = totalDebit - totalCredit

  // Synthesise the missing side so the entry balances. A compound entry splits
  // the contra across two accounts; everything else takes a single contra line.
  if (Math.abs(imbalance) > 0.005) {
    const needSide: 'debit' | 'credit' = imbalance > 0 ? 'credit' : 'debit'
    const amount = Math.abs(imbalance)
    const parts = head.entryType === 'Compound' ? 2 : 1
    const chunk = Math.round(amount / parts)
    let remaining = amount
    for (let i = 0; i < parts; i++) {
      const value = i === parts - 1 ? remaining : chunk
      remaining -= value
      const contra = pickContra(accounts, used, needSide, seed + i)
      if (!contra) break
      used.add(contra.id)
      lines.push({
        id: `${jeNumber}-contra-${i}`,
        accountId: contra.id,
        account: contra,
        debit: needSide === 'debit' ? value : 0,
        credit: needSide === 'credit' ? value : 0,
        description: hasLinkedDoc ? `Offset - ${doc.label}` : 'Balancing entry',
        entity: undefined,
        dimensionValues: dimensionsOfAccount(contra),
        synthetic: true,
      })
    }
    totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  }

  const isReversing = head.entryType === 'Reversing'
  const reversalDate = isReversing ? nextMonthFirst(head.date) : undefined

  /* An entry that has been backed out is not simply posted, and every surface
     reading one should say so - otherwise the ledger shows a live entry and its
     mirror with nothing tying them together. */
  const { reverses, reversedBy } = reversalLinks(jeNumber, transactions)

  return {
    jeNumber,
    date: head.date,
    memo: entryMemo(head),
    /* A seeded correction was never typed by anyone, so it carries the reason
       its business event gives ("Prior year tax accrual restated after ..."),
       where it was written by hand and one of its lines lands on an account the
       system keeps. A document's own posting to a control account is not one. */
    adjustmentReason: head.adjustmentReason
      ?? (head.source === 'Manual JE' && lines.some(l => l.account && adjustmentKind(l.account)) ? scenarioById(head.scenarioId)?.doc : undefined),
    period: head.period,
    status: reversedBy ? 'Reversed' : 'Posted',
    source,
    reference: head.reference,
    hasLinkedDoc,
    entryType: head.entryType,
    lines,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.005,
    reversalReason: head.reversalReason,
    entryInternalId: head.entryInternalId,
    entryCurrency: head.entryCurrency,
    entryRate: head.entryRate,
    /* When it was written, which is not the date it is dated: an entry posted on
       the 29th can be dated the 1st. Stamped on every entry made here; a seeded
       one was never written by anyone in this app, so it reads its own date and
       a stand-in author. */
    createdBy: entryCreatedBy(head),
    createdAt: entryCreatedAt(head),
    reversalDate,
    reversalNo: reversedBy,
    reverses,
    found: true,
  }
}

/* ─────────────────────────── Reversing an entry ───────────────────────────
   A posted entry is a permanent record, so correcting one means posting its
   mirror rather than editing it - both stay on the ledger and the pair nets to
   nothing. Which means a reversal is not a form to fill in: every field one
   could ask for is already decided by the entry being reversed. The action used
   to open the blank new-entry modal, which asked the reader to retype an entry
   the app was already holding, and produced an entry with no link back to the
   original. What is left to decide is whether it can post at all, and on what
   date, and both of those are answered here rather than asked. */

export const REVERSAL_MEMO_PREFIX = 'Reversal of '

/* The link back to the original, stamped into the memo rather than kept in a
   field of its own, so it travels with the entry everywhere an entry is read -
   the ledger, the drill-down, the account's own history - instead of only on the
   one screen built to look for it. The prior period declaration is carried the
   same way and for the same reason. */
export function reversalMemo(jeNumber: string, memo: string): string {
  return [`${REVERSAL_MEMO_PREFIX}${jeNumber}`, memo].filter(Boolean).join(' · ')
}

// The number a memo says its entry reverses, or undefined if it says nothing.
export function reversedNumberFromMemo(memo: string | undefined): string | undefined {
  if (!memo?.startsWith(REVERSAL_MEMO_PREFIX)) return undefined
  return memo.slice(REVERSAL_MEMO_PREFIX.length).split(' · ')[0] || undefined
}

/* ──────────────────── Who posted an entry, and when ────────────────────
   One answer for the entry's page and for the grids that list it, which carry
   Created by, Created on, Last updated by and Last updated on (design
   review, 2026-10-02, Eli: *"Dates, times, and whose"*).

   An entry written in the app is stamped as it posts. A seeded one was never
   written by anyone here, so it reads a stand-in author - the same one for the
   same entry on every reload - and its own date, at a time of the working day
   taken from its number. Never later than now: a seeded entry dated today
   cannot have been posted this evening while it is still this morning. */
export function entryCreatedBy(t: Pick<Transaction, 'jeNumber' | 'createdBy'>): string {
  return t.createdBy ?? AUTHORS[hashSeed(t.jeNumber) % AUTHORS.length]
}
export function entryCreatedAt(t: Pick<Transaction, 'jeNumber' | 'date' | 'createdAt'>, now = new Date()): string {
  if (t.createdAt) return t.createdAt
  const pad = (n: number) => String(n).padStart(2, '0')
  // 8:00 to 17:59, in the reader's zone.
  let minutes = 8 * 60 + (hashSeed(`${t.jeNumber}:time`) % (10 * 60))
  if (t.date === todayIso(now)) minutes = Math.min(minutes, now.getHours() * 60 + now.getMinutes())
  return `${t.date}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`
}

/* Who last changed an entry, and when, for the entries that have been changed.
   A posted entry is never edited - correcting one means posting its mirror - so
   the one thing that changes it afterwards is being reversed, which turns it
   Reversed. Its last change is that reversal: by whoever posted the reversing
   entry, when they posted it. An entry missing from the map was last changed
   when it was posted. */
export function entryChangesOf(transactions: Transaction[]): Map<string, { by: string; at: string }> {
  const out = new Map<string, { by: string; at: string }>()
  for (const t of transactions) {
    const target = reversedNumberFromMemo(t.memo)
    if (target && !out.has(target)) out.set(target, { by: entryCreatedBy(t), at: entryCreatedAt(t) })
  }
  return out
}

/** Which entry reversed each entry that has been, by number. */
export function reversedByOf(transactions: Transaction[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const t of transactions) {
    const target = reversedNumberFromMemo(t.memo)
    if (target && t.jeNumber !== target && !out.has(target)) out.set(target, t.jeNumber)
  }
  return out
}

/** Both ends of the relationship for one entry: the entry it reverses, and the
 *  entry that reverses it. Read together because an entry that shows one link
 *  and hides the other reads as though the other does not exist - and it is the
 *  hidden end that stops a reader reversing the same entry twice. */
export function reversalLinks(
  jeNumber: string,
  transactions: Transaction[],
): { reverses?: string; reversedBy?: string } {
  let reverses: string | undefined
  let reversedBy: string | undefined
  for (const t of transactions) {
    const target = reversedNumberFromMemo(t.memo)
    if (!target) continue
    if (t.jeNumber === jeNumber) reverses = target
    else if (target === jeNumber) reversedBy = t.jeNumber
  }
  return { reverses, reversedBy }
}

export interface ReversalLine {
  accountId: string
  account?: Account
  description: string
  debit: number
  credit: number
  /** The values the original line posted to, so the reversal backs them out of
   *  the same place - which, now that a line can take any of its account's
   *  values, is not always the account's default. */
  dimensionValues: { dimensionId: string; value: string }[]
  /** The line as it was typed, flipped, on an entry written in another
   *  currency - the same amounts the original was typed in, not a reconversion. */
  fxDebit?: number
  fxCredit?: number
}

export interface ReversalPlan {
  jeNumber: string
  date: string
  period: string
  description: string
  memo: string
  lines: ReversalLine[]
  total: number
  /** True when the original's own period is shut, so the reversal lands on a
   *  later date than the entry it backs out. Worth saying out loud: the reader
   *  asked to reverse an entry dated in a closed month and will otherwise be
   *  surprised by where it turns up. */
  movedDate: boolean
  /** The date offered before the reader picked one. */
  offeredDate: string
  /** Why the picked date cannot take the reversal, or undefined. A closed or
   *  locked month, or a day before the entry being reversed. */
  dateProblem?: string
  /** Why this entry cannot be reversed, or undefined. */
  blocked?: string
  /** The currency the original was written in and the rate it posted at, when
   *  that was not the base currency. The reversal posts at the original's rate,
   *  never today's, so the pair nets to nothing in both currencies. */
  entryCurrency?: string
  entryRate?: number
}

/** What reversing this entry would post. Every line flips sides; nothing else
 *  about it changes, including the line descriptions, so the two entries read as
 *  one correction rather than as an entry and an unrelated echo.
 *
 *  The lines come from the reconstructed entry rather than from the raw
 *  postings, so a seeded entry carrying only its primary side is reversed
 *  balanced - the synthesised contra flips with the rest. */
export function buildReversal(
  entry: ReconstructedEntry,
  periods: Period[],
  issued: Iterable<string>,
  reversedBy?: string,
  /** The date the reader picked, over the one offered. */
  chosenDate?: string,
): ReversalPlan {
  /* Offered on the original's own date when that month still accepts postings,
     because that is where the correction belongs. When it does not, the reversal
     has to land somewhere it can, and the alternative - refusing - would leave a
     wrong entry standing with no way to back it out. The reader can move it;
     `reversalDateProblem` says where it may go. */
  const ownDate = entry.date.slice(0, 10)
  const offered = periodPostingBlock(ownDate, periods) ? firstPostableDate(periods) : ownDate
  const date = chosenDate ?? offered

  const lines: ReversalLine[] = entry.lines.map(l => ({
    accountId: l.accountId,
    account: l.account,
    description: l.description,
    debit: l.credit,
    credit: l.debit,
    dimensionValues: l.dimensionValues,
    /* The typed amounts flip with the base ones. Mahad, 2026-10-10: *"The
       reversal should copy the EUR amounts and the original rate, not today's
       rate."* */
    ...(entry.entryCurrency ? { fxDebit: l.fxCredit ?? 0, fxCredit: l.fxDebit ?? 0 } : {}),
  }))

  /* The locks in `manualPostingLock` apply here too. A reversal does not choose
     an account, and it asks for no adjustment reason on a control account or
     retained earnings: it backs out lines already on the ledger, whose reason was
     given when they were posted. Deactivate and archive are different, because
     they are a standing instruction that this account takes nothing new, and the
     reader who gave it can lift it. */
  const outOfService = lines
    .map(l => l.account)
    .filter((a): a is Account => !!a && (a.status === 'Archived' || a.status === 'Inactive'))

  let blocked: string | undefined
  if (reversedBy) blocked = `${entry.jeNumber} has already been reversed by ${reversedBy}.`
  else if (!offered) blocked = 'Every accounting period is closed, so there is nowhere for the reversal to post.'
  else if (outOfService.length === 1) {
    const a = outOfService[0]
    blocked = `${a.accountNumber} ${a.accountName} is ${a.status === 'Archived' ? 'archived' : 'deactivated'}, so it takes no new postings. Put it back in service to reverse this entry.`
  } else if (outOfService.length > 1) {
    blocked = `${outOfService.length} accounts on this entry are out of service, so they take no new postings. Put them back in service to reverse this entry.`
  }

  return {
    // Numbered off the date it will post on, so the number carries the year it
    // belongs to even when the reversal lands in a later one than the original.
    jeNumber: nextJeNumber(issued, date || ownDate),
    date,
    period: periodForDate(date, periods)?.label ?? '',
    description: `Reversal of ${entry.jeNumber}`,
    memo: reversalMemo(entry.jeNumber, entry.memo),
    lines,
    total: lines.reduce((s, l) => s + l.debit, 0),
    movedDate: !!offered && offered !== ownDate,
    offeredDate: offered,
    entryCurrency: entry.entryCurrency,
    entryRate: entry.entryRate,
    dateProblem: date ? (date < ownDate ? `A reversal can't be dated before the entry it reverses, which is dated ${fmtDate(ownDate)}.` : periodPostingBlock(date, periods) ?? undefined) : 'Pick the date the reversal posts on.',
    blocked,
  }
}

/* The note the entry was posted with. An entry written here always carries one,
   blank when the reader left it blank - and that blank is the answer, not a gap
   to fill. The seed stamps each entry's memo on all its postings (see
   `seedTransactions`). Only a posting with no memo at all - the period close's,
   whose lines all carry the entry's one text - falls back to its narration. Filling it with the line's own
   text put the first line in the Memo field of an entry nobody wrote a memo for.
   Mahad, 2026-09-30: *"The Memo field shows the first line's text."* */
export function entryMemo(t: Pick<Transaction, 'memo' | 'description'>): string {
  return t.memo ?? t.description ?? ''
}

function nextMonthFirst(iso: string): string {
  const d = new Date(iso)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
}

/* ─────────────────────────── Attachments ───────────────────────────
   Supporting documents are the paper trail behind an entry, so which files an
   entry carries follows from where it came from: a bill brings the vendor's
   invoice, a payroll run brings its register. Seeded from the same hash as the
   rest of the reconstruction so an entry's attachments never shift between
   renders. */
const SOURCE_ATTACHMENTS: Record<string, { name: string; type: string; size: string }[]> = {
  'Vendor Invoice': [
    { name: 'Vendor_Invoice_{REF}.pdf', type: 'pdf', size: '412 KB' },
    { name: 'Purchase_Order_{REF}.pdf', type: 'pdf', size: '286 KB' },
    { name: 'Goods_Receipt_Note.pdf', type: 'pdf', size: '198 KB' },
  ],
  'Vendor Payments': [
    { name: 'Remittance_Advice_{REF}.pdf', type: 'pdf', size: '244 KB' },
    { name: 'Payment_Confirmation_{REF}.pdf', type: 'pdf', size: '176 KB' },
  ],
  'Customer Invoice': [
    { name: 'Customer_Invoice_{REF}.pdf', type: 'pdf', size: '355 KB' },
    { name: 'Signed_Delivery_Note.pdf', type: 'pdf', size: '241 KB' },
  ],
  'Customer payments': [
    { name: 'Remittance_Received_{REF}.pdf', type: 'pdf', size: '212 KB' },
    { name: 'Bank_Credit_Advice.pdf', type: 'pdf', size: '164 KB' },
  ],
  'Cash Management': [
    { name: 'Bank_Statement_{REF}.pdf', type: 'pdf', size: '780 KB' },
    { name: 'Reconciliation_Worksheet.xlsx', type: 'xlsx', size: '640 KB' },
  ],
  'RMA': [
    { name: 'Return_Authorization_{REF}.pdf', type: 'pdf', size: '268 KB' },
    { name: 'Credit_Memo_{REF}.pdf', type: 'pdf', size: '223 KB' },
    { name: 'Inspection_Report.pdf', type: 'pdf', size: '141 KB' },
  ],
  'Receiving': [
    { name: 'Goods_Receipt_Note_{REF}.pdf', type: 'pdf', size: '231 KB' },
    { name: 'Packing_Slip.pdf', type: 'pdf', size: '158 KB' },
    { name: 'Inspection_Report.pdf', type: 'pdf', size: '141 KB' },
  ],
  'Payroll': [
    { name: 'Payroll_Register_{REF}.xlsx', type: 'xlsx', size: '1.4 MB' },
    { name: 'Payroll_Summary_{REF}.pdf', type: 'pdf', size: '520 KB' },
    { name: 'Tax_Filing_Confirmation.pdf', type: 'pdf', size: '167 KB' },
  ],
  'Manual JE': [
    { name: 'Supporting_Schedule_{REF}.xlsx', type: 'xlsx', size: '486 KB' },
    // .rtf, not .docx: Word opens both, and only this one has bytes we can
    // honestly generate for the demo (see lib/dummyAttachment.ts). The card
    // still reads DOC either way.
    { name: 'Approval_Memo.rtf', type: 'doc', size: '124 KB' },
  ],
}

export interface EntryAttachment {
  id: string
  name: string
  size: string
  date: string
  type: string
  uploadedBy: string
}

export function attachmentsForEntry(
  entry: Pick<ReconstructedEntry, 'jeNumber' | 'source' | 'reference' | 'date' | 'createdBy' | 'found'>,
): EntryAttachment[] {
  const template = SOURCE_ATTACHMENTS[entry.source]
  if (!entry.found || !template) return []
  // An entry the reader posted here has the files they attached, and no others
  // (module review, 2026-10-06, COA-31).
  if (entry.createdBy?.includes('(You)')) return []
  const seed = hashSeed(`att:${entry.jeNumber}`)
  // One document is always present; the rest vary, so entries carry different
  // folders the way a real ledger does.
  const count = 1 + (seed % template.length)
  const ref = entry.reference || entry.jeNumber
  return template.slice(0, count).map((f, i) => ({
    id: `${entry.jeNumber}-att-${i}`,
    name: f.name.replace('{REF}', ref),
    size: f.size,
    date: entry.date,
    type: f.type,
    // The first document arrives with the record; later ones are attached by hand.
    uploadedBy: i === 0 ? entry.createdBy : AUTHORS[hashSeed(`${entry.jeNumber}${i}`) % AUTHORS.length],
  }))
}
