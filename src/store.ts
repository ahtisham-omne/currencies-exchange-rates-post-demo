import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Account, AccountDraft, AccountCategory, AccountType, StatementClassification, AuditEntry, CompanyConfig, FiscalYearNaming, JournalEntry, NumberingScheme, Period, PeriodBalanceSnapshot, QuarterId, RecurringTemplate, Dimension, TaxCode, Transaction } from './types'
import { CLASSIFICATIONS_BY_CATEGORY, DEFAULT_CLASSIFICATION_BY_CATEGORY, CATEGORY_OF_CLASSIFICATION, DEFAULT_NUMBER_WIDTH, categoryFirstNumber, accountSegmentValue, accountSegmentIndex, formatInScheme, displayAccountNumber, isNumericAccountNumber, numberProtectionOn } from './types'
import { seedAccounts, seedAuditLog, seedCompany, seedJournalEntries, seedNumberingScheme, seedPeriods, seedQ1Openings, seedRecurring, seedDimensions, seedTaxCodes, seedTransactions, seedAccountAttachments } from './lib/seed'
import type { RecordNote } from './lib/notes'
import { STATE_KEY, savedStateStorage } from './lib/persistence'
import {
  anyPeriodHasPostings,
  buildFiscalYearPeriods,
  buildPeriodsFromFirstYear,
  periodsWithEarlierYears,
  buildQuarterSnapshots,
  buildYearEndClosingEntry,
  fiscalYearOf,
  lockEndedPeriods,
  nextYearOpeningSnapshots,
  periodsForQuarter,
  quarterCloseGuard,
  yearCloseGuard,
} from './lib/periodClose'
import { defaultPeriodSelection, resolvePeriodSelection, scopeAccountsToPeriod } from './lib/periodSelection'
import { normalSideDelta } from './lib/monthlyLedger'
import type { PeriodSelection, ResolvedPeriod } from './lib/periodSelection'
import { buildChartIndex, eligibleParents } from './lib/chartTree'
import type { ChartIndex } from './lib/chartTree'
import { buildBalanceTransferEntry, planBulk, planDelete, planLifecycle, isReadOnlyAccount } from './lib/accountLifecycle'
import type { LifecycleAction, LifecycleCtx } from './lib/accountLifecycle'
import { todayIso, uid } from './lib/utils'
import { nextInternalId, nextJournalInternalId } from './lib/internalId'
import { accountRange, checkPlacement, problemText } from './lib/numberRange'
import { nextJeNumber } from './lib/journalEntry'
import { CURRENT_YEAR_EARNINGS_HELP, CURRENT_YEAR_EARNINGS_NAME, earningsAccountHome } from './lib/currentYearEarnings'
import type { CoaView } from './lib/coaViews'
import type { EntryAttachment } from './lib/journalEntry'
import type { CommMessage, CommRecordKind, CommThread } from './lib/comms'
import { CURRENT_USER, previewOf, shortDate, stampOf } from './lib/comms'
import type { Partner, NewPartnerInput } from './lib/partners'
import { SEED_PARTNERS } from './lib/partners'

export interface ValidationError {
  field: string
  message: string
}

export interface LifecycleResult {
  ok: boolean
  error?: string
  /** Every account whose status changed. */
  affectedIds: string[]
}

// When a caller knows only the Type (no classification picked yet).
export function defaultClassificationForCategory(type: AccountType): StatementClassification {
  return DEFAULT_CLASSIFICATION_BY_CATEGORY[type]
}

export interface ToastMsg {
  id: string
  message: string
  tone: 'success' | 'info' | 'danger'
  // Optional secondary line, rendered muted under the message (UAC-style
  // "Generating structured PDF… / The PDF will download shortly.").
  description?: string
  // Optional inline action (e.g. "Undo"). Clicking it runs onClick and
  // dismisses the toast.
  action?: { label: string; onClick: () => void }
}

// =========================
// Pure helpers (no store dependency)
// =========================
// Shared so the Build-from-Scratch setup flow can validate against a *draft*
// numbering scheme and a *local* account list (not yet committed), using the
// exact same logic as the live store.

// Normal balance derives from the Category, flipped when the account is a
// contra (spec: "Normal balance - From Category, flipped when Contra is on").
export function deriveNormalBalance(category: AccountCategory, isContra = false): Account['normalBalance'] {
  const base: 'Debit' | 'Credit' = ['AST', 'EXP'].includes(category) ? 'Debit' : 'Credit'
  if (!isContra) return base
  return base === 'Debit' ? 'Credit' : 'Debit'
}

// Contra is derived, never entered: an account is a contra when its (user-set)
// normal balance sits on the opposite side to its category's natural balance.
export function deriveContra(category: AccountCategory, normalBalance: Account['normalBalance']): boolean {
  return normalBalance === 'n/a' ? false : normalBalance !== deriveNormalBalance(category, false)
}

/* What an account number has to be: letters, numbers and dashes, and short enough
   to store. Nothing more. Customers really keep 01-71100-40 and AR-1100, and a
   scheme nobody was asked about should not be the thing that refuses either.

   Letters are as ordinary here as digits: a number is a label the customer
   chose, so nothing downstream may assume it can be read as an amount. Where an
   account is filed comes from the category and section stated on it, never from
   its digits, so a lettered number needs no special case. */
const NUMBER_SHAPE = /^[A-Za-z0-9-]+$/

/* Exported so the import runs the same rule the account form does. A number that
   arrives on a file is the same kind of thing as one somebody types. */
export const isAccountNumberShape = (number: string) => NUMBER_SHAPE.test(number.trim())
export const ACCOUNT_NUMBER_SHAPE_MESSAGE = 'An account number is made of letters, numbers and dashes.'

/* Generous on purpose: 01-71100-40-0001 is a number somebody really keeps. The
   only reason there is a limit at all is that it has to fit somewhere. */
export const MAX_NUMBER_LENGTH = 100

/* How one account is told apart from another. Not the number alone: a chart read
   out of segmented codes holds 71100 once per set of dimension values, and what
   distinguishes those is the values. Spaces and letter case are noise; a leading
   zero is not, because 0100 and 100 are numbers someone chose to write
   differently. Compared on stored dimension ids, so no name lookup is needed. */
export function accountIdentity(number: string, values?: { dimensionId: string; value: string }[]): string {
  const n = number.trim().toLowerCase()
  if (!values?.length) return n
  return `${n} ${values.map(v => `${v.dimensionId}=${v.value.trim().toLowerCase()}`).sort().join(' ')}`
}

export function validateAccountNumberAgainst(
  scheme: NumberingScheme, accounts: Account[], number: string, exceptId?: string,
  values?: { dimensionId: string; value: string }[],
): ValidationError | null {
  void scheme
  const trimmed = number.trim()
  if (!isAccountNumberShape(trimmed)) {
    return { field: 'accountNumber', message: ACCOUNT_NUMBER_SHAPE_MESSAGE }
  }
  if (trimmed.length > MAX_NUMBER_LENGTH) {
    return { field: 'accountNumber', message: `An account number can be up to ${MAX_NUMBER_LENGTH} characters, and this one is ${trimmed.length}.` }
  }
  const identity = accountIdentity(trimmed, values)
  const clash = accounts.find(a => a.id !== exceptId && accountIdentity(a.accountNumber, a.defaultDimensionValues) === identity)
  if (clash) {
    return {
      field: 'accountNumber',
      message: values?.length
        ? `${clash.accountName} is already ${trimmed} with the same dimension values, so nothing would tell the two apart (BR-001).`
        : `GL account number ${trimmed} already exists (BR-001).`,
    }
  }
  return null
}

export function validateAccountAgainst(scheme: NumberingScheme, accounts: Account[], company: CompanyConfig, a: Partial<Account>, exceptId?: string): ValidationError[] {
  const errors: ValidationError[] = []
  if (!a.accountNumber) errors.push({ field: 'accountNumber', message: 'Enter a GL account number.' })
  else {
    const e = validateAccountNumberAgainst(scheme, accounts, a.accountNumber, exceptId, a.defaultDimensionValues)
    if (e) errors.push(e)
    /* No check on where the number sits, because there is nowhere for it to sit
       wrong: no category or section reserves a block, the number is taken exactly
       as typed, and the section an account is filed under is stated on it rather
       than read out of its digits. The check that used to be here also read
       01-71100-40 as being below 1000, so it refused segmented numbers outright. */
  }
  if (!a.accountName?.trim()) errors.push({ field: 'accountName', message: 'Enter a GL account name.' })
  if (!a.accountType) errors.push({ field: 'accountType', message: 'Select a GL account category.' })
  // The parent link is now what builds the chart, so this is the only thing
  // standing between the reader and an expense filed under assets, or an account
  // nested inside itself. The picker offers exactly eligibleParents(), so these
  // messages should be unreachable from the UI; they are the backstop for import
  // and for a parent that was archived while the form was open.
  if (a.parentId) {
    const parent = accounts.find(p => p.id === a.parentId)
    if (!parent) {
      errors.push({ field: 'parentId', message: 'That parent account is no longer on the chart. Pick another.' })
    } else if (parent.glAccountType !== 'Summary') {
      errors.push({ field: 'parentId', message: `${parent.accountNumber} ${parent.accountName} is a posting account, so nothing can sit under it. Pick a summary account.` })
    } else if (parent.accountType !== a.accountType) {
      errors.push({ field: 'parentId', message: `Parent type (${parent.accountType}) must match child type (${a.accountType}), BR-003.` })
    } else if (exceptId && !eligibleParents(accounts, a.accountType!, exceptId).some(p => p.id === parent.id)) {
      errors.push({ field: 'parentId', message: 'An account cannot sit under itself, or under one of the accounts beneath it.' })
    }
    /* A classification other than the parent's is allowed, and flagged on the
       chart rather than refused (decision 3; module review, 2026-10-06,
       COA-13). See `classificationOverride`. */
    /* The parent's range does not bind the account's own number: a reservation
       is a one-way block (design review, 2026-09-24). It keeps strangers out of
       the block; it does not keep the summary's own accounts in. What it does
       refuse is checked below, with the number and the range together. */
  }
  /* Where the number and, on a summary, the range may sit - read against every
     reservation on the chart and, with number protection on, the stretch each
     summary keeps for its accounts. Only when the caller says which kind of
     account this is: the create form runs the same check itself, as the reader
     types, and passes neither. */
  if (a.glAccountType && a.accountNumber) {
    const proposed = accountRange({ numberRangeStart: a.numberRangeStart, numberRangeEnd: a.numberRangeEnd })
    if (a.glAccountType === 'Summary' && (a.numberRangeStart !== undefined || a.numberRangeEnd !== undefined) && !proposed) {
      errors.push({ field: 'numberRange', message: 'Enter both numbers of the range, with the start no higher than the end.' })
    } else {
      const clash = checkPlacement({
        accountId: exceptId,
        accountNumber: a.accountNumber,
        accountName: a.accountName,
        glAccountType: a.glAccountType,
        parentId: a.parentId ?? null,
        range: proposed,
        chart: accounts,
        protection: numberProtectionOn(company),
      })
      if (clash) errors.push({ field: a.glAccountType === 'Summary' && proposed ? 'numberRange' : 'accountNumber', message: problemText(clash) })
    }
  }
  if (a.effectiveDate && a.effectiveDate < company.fiscalYearStart) {
    errors.push({ field: 'effectiveDate', message: `Effective date cannot precede fiscal year start (${company.fiscalYearStart}), BR-008.` })
  }
  // Routing / Bank ID and Bank account number are optional on Bank/Cash
  // accounts - they can be added later and do not block creation.
  return errors
}

/* Suggest the next account number for a category: the highest number that
   category already uses, plus ten. An empty category is offered its first
   number for the chart's width, because a new chart has nothing to count
   from.
 *
 * Nothing here is a boundary. There is no upper bound to run out of and no
 * range to fall outside, so this always returns a number, and a customer is
 * free to ignore it and type whatever they like. Works for the plain numeric
 * scheme (e.g. 1020) as well as any single-segment format.
 *
 * A parent no longer narrows the answer, because a summary reserves nothing:
 * what it totals is whatever names it as a parent. The parent is still read for
 * its own number, which a glued scheme copies the other segments from so a
 * child comes out in the customer's style. */
export function suggestNextNumberAgainst(scheme: NumberingScheme, accounts: Account[], statementClassification: StatementClassification, parent?: Account): string {
  const category = CATEGORY_OF_CLASSIFICATION[statementClassification]
  const width = suggestionWidth(scheme)
  const first = categoryFirstNumber(category, width)
  const peers = accounts.filter(a => a.accountType === category)
  // Glued chart (100-2000-200): read and write the account segment, copying the
  // parent's other segments so a child comes out in the customer's own style.
  if (scheme.segments.length > 1) {
    const template = parent?.accountNumber
    const used = peers.map(a => accountSegmentValue(scheme, a.accountNumber)).filter(n => !isNaN(n))
    const next = used.length ? Math.max(...used) + 10 : first
    return formatInScheme(scheme, next, template)
  }
  /* Only numbers that are numbers get a vote. A lettered number like AR1100 has
     no numeric value, so counting it would step off a number nobody wrote. */
  const used = peers
    .filter(a => isNumericAccountNumber(a.accountNumber))
    .map(a => parseInt(a.accountNumber, 10))
  const next = used.length ? Math.max(...used) + 10 : first
  return String(next).padStart(width, '0')
}

/* How wide a suggested number is written. The scheme's account segment says so,
   because that is the width the customer chose. It is a padding rule only:
   a number wider than this is not wrong, it is just wider. */
function suggestionWidth(scheme: NumberingScheme): number {
  return scheme.segments[accountSegmentIndex(scheme)]?.length ?? DEFAULT_NUMBER_WIDTH
}

// Build a fully-formed Account from create input (uid, normal balance,
// timestamps, author). Used by store.createAccount and by flows that stage
// accounts locally before committing.
//
// `isPosting` is derived here rather than taken from the input: it is a mirror of
// the type, and it is what every aggregate filters on, so a caller that sets one
// without the other would make a summary account count as a leaf and add its
// children to its own total. Deriving at the one chokepoint every create flow
// passes through makes that unrepresentable.
//
// `internalId` likewise. It is the system's to issue, never the caller's, and it
// is issued against the whole chart so no two accounts can be handed the same
// one - which is the only promise the field makes.
export function buildAccount(
  input: AccountDraft,
  chart: { internalId?: string }[] = [],
): Account {
  const now = new Date().toISOString()
  return {
    ...input,
    id: uid('acc'),
    internalId: nextInternalId(chart),
    isPosting: input.glAccountType === 'Posting',
    normalBalance: deriveNormalBalance(input.accountType, input.isContra),
    createdAt: now,
    updatedAt: now,
    createdBy: 'Ahtisham Ahmad (You)',
    updatedBy: 'Ahtisham Ahmad (You)',
  }
}

interface State {
  company: CompanyConfig
  accounts: Account[]
  dimensions: Dimension[]
  taxCodes: TaxCode[]
  numberingScheme: NumberingScheme
  periods: Period[]
  transactions: Transaction[]
  journalEntries: JournalEntry[]
  // Files the user attached when posting an entry, keyed by JE number. Entries
  // that came from a source system derive their paper trail instead
  // (attachmentsForEntry), so only hand-uploaded files need storing.
  jeAttachments: Record<string, EntryAttachment[]>
  /* The tags on an entry, keyed by JE number (Mahad, 2026-09-30). Set while the
     entry is written and added to or removed on its page. Kept beside the entry
     rather than on its postings: a tag is not a fact about any one line. */
  jeTags: Record<string, string[]>
  /* The files kept against an account, keyed by account id (design review,
     2026-09-24 - Eli: *"Notes, attachments, communications, and activity. Those
     are in everything."*). Kept beside the account rather than on it: a file is
     not a fact about how the account posts, and writing one through
     updateAccount would stamp the account as edited. */
  accountAttachments: Record<string, EntryAttachment[]>
  /* What the reader wrote on a record's Notes tab, keyed by `noteKey` - an
     account or a journal entry - newest first. The notes a record opens with
     are derived from it (lib/notes) and never stored; `removedNotes` holds the
     ids of any note taken off, derived or written, so it stays off. Kept beside
     the record, as its files are: a note is not a fact about how it posts. */
  recordNotes: Record<string, RecordNote[]>
  removedNotes: string[]
  addRecordNote: (key: string, text: string) => void
  /** Takes a note off; Undo hands the same note back to `restoreRecordNote`. */
  removeRecordNote: (key: string, note: RecordNote) => void
  /** `written`: the reader wrote it, so it goes back on the record as well. */
  restoreRecordNote: (key: string, note: RecordNote, written: boolean) => void
  recurringTemplates: RecurringTemplate[]
  auditLog: AuditEntry[]
  // Finalized (or provisional) per-account balances written by the period-close
  // engine, one per posting account per closed quarter. Empty until a close runs.
  periodSnapshots: PeriodBalanceSnapshot[]
  // Derived fiscal-year opening per posting account, feeding the close engine so
  // it reconciles to the hand-authored balances the GL/COA display.
  seedQ1Openings: Record<string, number>
  toasts: ToastMsg[]
  // Ids of accounts created during this session, so the table can flag them with
  // a "New" badge. Session-scoped (in-memory) - cleared on reload.
  newAccountIds: string[]

  // mutations
  setCompany: (patch: Partial<CompanyConfig>) => void
  // The fiscal year, the name it goes by and the periods it implies, set
  // together. Ignored once anything has posted, so a rebuild can never move
  // recorded history and no report is retitled after it has been read.
  setFiscalYear: (iso: string, naming?: FiscalYearNaming) => void
  // Reach the books further back without touching the shape of a fiscal year.
  // Unlike setFiscalYear this survives the lock: the periods it adds sit before
  // everything already posted, so nothing recorded moves. Existing periods are
  // kept as they are, close status and all.
  addEarlierYears: (firstYear: number) => void
  // Hide the post-setup "configure in your modules" checklist card.
  dismissModuleChecklist: () => void
  // Ephemeral toasts (auto-dismiss). pushToast returns the id.
  pushToast: (message: string, tone?: ToastMsg['tone'], description?: string, action?: ToastMsg['action']) => string
  dismissToast: (id: string) => void
  // DEV ONLY, wipe the tenant back to a brand-new, zero-account state so the
  // guided setup wizard can be previewed as a first-time user. Backs the
  // floating "View as first-time user" button. See the TODO in src/lib/seed.ts.
  // True while the first-time preview is active - stays true after the user
  // publishes their chart (they're still in the simulated tenant) until they
  // explicitly Exit. Backs the floating button's active state.
  firstTimePreview: boolean
  // Full-view mode for a page's main table: hides the app sidebar + top bar
  // and trims page padding so the table fills the viewport. Toggled from the
  // table toolbar; read by AppShell to drop its chrome.
  fullView: boolean
  setFullView: (v: boolean) => void
  // Which of the General Ledger's two header tabs is open ('tree' = Postings,
  // 'list' = Journal entries). Session-scoped, so the choice survives navigation
  // but resets on reload. The Chart of Accounts has no such pair: the chart
  // nests, and a flat run of it was a second answer to a question with one.
  glView: 'list' | 'tree'
  setGlView: (v: 'list' | 'tree') => void
  // The accounting period every money figure in this module is read against.
  // One selection for the whole module rather than one per page: the Chart of
  // Accounts, the General Ledger and an account's detail are three readings of
  // the same ledger, so letting them disagree on the period would make their
  // figures irreconcilable. Session-scoped, like the view toggles above.
  periodSelection: PeriodSelection
  setPeriodSelection: (v: PeriodSelection) => void
  resetToFirstTimeUser: () => void
  // DEV ONLY, leave the first-time preview and restore the seeded, fully
  // set-up tenant (the normal demo data). Backs the button's Exit control.
  exitFirstTimeUser: () => void
  validateAccountNumber: (number: string, exceptId?: string) => ValidationError | null
  validateAccount: (a: Partial<Account>, exceptId?: string) => ValidationError[]
  /** `withoutEarnings` leaves out the Current Year Earnings account the chart's
   *  first revenue or expense account brings with it (guided setup). */
  createAccount: (a: AccountDraft, opts?: { withoutEarnings?: boolean }) => Account
  // Append a journal entry plus its per-account register transactions, moving
  // each posted account's live balance by the posting. Callers that set the
  // post-entry balances themselves - the setup wizard's opening-balance entry,
  // the year-end close - pass `skipBalanceUpdate` so the balance is not moved
  // twice.
  addJournalEntry: (entry: JournalEntry, transactions: Transaction[], attachments?: EntryAttachment[], opts?: { skipBalanceUpdate?: boolean }) => void
  /* What the reader wrote on a record's correspondence. Only theirs is stored:
     the demo threads are derived from the record (seededThreads), the same way
     an entry's paper trail is.

     Replies and whole new threads are kept apart because they arrive
     differently - a reply names the thread it answers, a composed message
     starts one. Archive and pin are stored rather than held in component state,
     since a thread that un-archives itself when the tab is closed reads as a
     bug. Read state is deliberately NOT stored: it is per-visit, and the ported
     source made the same call. */
  commsSent: CommMessage[]
  commsThreads: CommThread[]
  commsArchived: string[]
  commsPinned: string[]
  /** Whether the reader has read a thread, where they have said so - by opening
   *  it, or with Mark as unread / Mark as read. Over the seeded flag, per thread id. */
  commsUnread: Record<string, boolean>
  /** Threads moved onto another record. Held by id so the record they left
   *  stops offering them: a thread in two places is a thread whose answer the
   *  reader has to look for twice. */
  commsTransferred: string[]
  addCommMessage: (input: Omit<CommMessage, 'id' | 'timestamp' | 'dateIso' | 'from' | 'fromEmail' | 'isOutbound'>) => CommMessage
  addCommThread: (input: Omit<CommThread, 'messages'> & { first: Omit<CommMessage, 'id' | 'timestamp' | 'dateIso' | 'from' | 'fromEmail' | 'isOutbound' | 'threadId'> }) => CommThread
  toggleCommArchived: (threadId: string) => void
  toggleCommPinned: (messageId: string) => void
  setCommUnread: (threadId: string, unread: boolean) => void
  transferCommThread: (input: {
    thread: CommThread
    /** Where it lands. Omitted for an unlink, which leaves it on this record
     *  with no record of its own to belong to. */
    destination?: { subjectId: string; ref: string; label: string; kind: CommRecordKind }
  }) => void
  // Period close (engine in lib/periodClose.ts). Both guard first (toast + bail
  // on error) and mutate the store in a single batch on success.
  closeQuarter: (fiscalYear: number, quarter: QuarterId) => { ok: boolean; error?: string }
  closeYear: (fiscalYear: number) => { ok: boolean; error?: string }
  updateAccount: (id: string, patch: Partial<Account>, reason?: string) => Account
  setAccountAttachments: (accountId: string, files: EntryAttachment[]) => void
  setEntryTags: (jeNumber: string, tags: string[]) => void
  // Lifecycle. All four go through planLifecycle (lib/accountLifecycle.ts), which
  // writes only the account it was asked about: a summary is refused while
  // anything under it is not yet as far along, and a Posting account with open
  // entries is refused the same way everywhere. `affectedIds` is what changed,
  // for the toast.
  deactivateAccount: (id: string, reason?: string) => LifecycleResult
  activateAccount: (id: string) => LifecycleResult
  // moveBalanceTo names the account that inherits the balance. Required when the
  // account holds one, since an archived account cannot.
  archiveAccount: (id: string, moveBalanceTo?: string) => LifecycleResult
  unarchiveAccount: (id: string) => LifecycleResult
  /** A true delete, gated by planDelete: the row is gone and nothing is kept.
   *  Only reachable on an account nothing has ever posted to. */
  deleteAccount: (id: string) => LifecycleResult
  bulkLifecycle: (action: LifecycleAction, ids: string[]) => LifecycleResult & { skipped: string[] }
  mergeAccounts: (sourceIds: string[], targetId: string) => { ok: boolean; error?: string }

  // dimensions (tenant-level)
  setDimensions: (dimensions: Dimension[]) => void
  addDimension: (t: Omit<Dimension, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>) => Dimension
  updateDimension: (id: string, patch: Partial<Dimension>) => void
  deleteDimension: (id: string) => void

  // numbering
  setNumberingScheme: (s: NumberingScheme) => void
  // classification-aware: returns the next number for the classification's category, in +10
  // gaps from the highest that category already uses.
  suggestNextNumber: (statementClassification: StatementClassification) => string
  // Allocate a batch of `count` sequential numbers for a type (used by the
  // guided setup wizard when generating a whole chart at once).
  allocateNumbers: (type: Account['accountType'], count: number) => string[]

  // helpers
  hasOpenJEReferencing: (accountId: string) => boolean
  hasRecurringReferencing: (accountId: string) => boolean

  // Saved Chart-of-Accounts views (read-only lenses). The three built-in
  // defaults live in coaViews.ts (DEFAULT_VIEWS); only user-saved views are
  // persisted here. NOTE (open decision §7): in the prototype these live in the
  // client store; real persistence is server-side, per-COA-table, team-shared.
  coaSavedViews: CoaView[]
  addCoaView: (v: CoaView) => void
  updateCoaView: (id: string, patch: Partial<CoaView>) => void
  removeCoaView: (id: string) => void

  // Partners (local, in-memory) - backs the "Set up as partner" nudge shown
  // when creating a bank/credit-card GL account. Mirrors the Cash Management
  // partner data layer so both modules stay consistent.
  partners: Partner[]
  addPartner: (input: NewPartnerInput) => Partner
}

// ── Lifecycle plumbing ──
// The rules live in lib/accountLifecycle.ts and know nothing about the store, so
// this adapter hands them the chart and the open-entry test they need.
type SetState = (fn: (s: State) => Partial<State>) => void
type GetState = () => State

export const lifecycleCtx = (s: State): LifecycleCtx => ({
  accounts: s.accounts,
  hasOpenJEs: s.hasOpenJEReferencing,
  baseCurrency: s.company.baseCurrency,
})

const AUDIT_ACTION: Record<LifecycleAction, AuditEntry['action']> = {
  deactivate: 'Deactivate', activate: 'Activate', archive: 'Archive', unarchive: 'Unarchive',
}

// Every target is written in one `set`, so no render ever observes a bulk action
// half-applied. Each account here was named by the reader: a lifecycle action
// writes only what it was asked about and never reaches a neighbour.
function applyStatus(
  set: SetState,
  targetIds: string[],
  status: Account['status'],
  action: AuditEntry['action'],
  reason?: string,
) {
  const ids = new Set(targetIds)
  const now = new Date().toISOString()
  const user = 'Ahtisham Ahmad (You)'
  set(s => ({
    accounts: s.accounts.map(a => ids.has(a.id) ? { ...a, status, updatedAt: now, updatedBy: user } : a),
    auditLog: [...s.auditLog, ...targetIds.map(id => ({
      id: uid('au'), accountId: id, action, reason, user, timestamp: now,
    }))],
  }))
}

/* An archived account cannot hold money, so the balance lands on the destination
   before the account is closed - as a journal entry dated today, posted the way
   any other entry is.

   It used to re-point the source's postings at the destination instead, which
   silently rewrote history: an entry posted months ago read afterwards as though
   it had always hit a different account, with nothing dated to say otherwise and
   no way back. It also left the two ledgers disagreeing, because
   `journalEntries[].lines` kept the original accountId while `transactions` did
   not. Both problems are the same mistake - treating a thing that happens today
   as a correction to what happened then.

   addJournalEntry does the rest: it appends the entry and its postings and moves
   each account's balance by its normal-side delta, so the source lands on zero
   and the destination gains what it lost without either being written by hand. */
function moveBalance(set: SetState, get: GetState, source: Account, dest: Account) {
  const now = new Date().toISOString()
  const user = 'Ahtisham Ahmad (You)'
  // The next number in the year's journal entry run, read from both sides like
  // every other entry's: a seeded posting can carry a number no entry claims.
  const s = get()
  const issued = new Set([...s.journalEntries.map(e => e.reference), ...s.transactions.map(t => t.jeNumber)])
  const jeNumber = nextJeNumber(issued, todayIso(new Date(now)))
  const { entry, transactions } = buildBalanceTransferEntry(source, dest, now, jeNumber, user)
  get().addJournalEntry(entry, transactions)
  set(s => ({
    accounts: s.accounts.map(a =>
      a.id === dest.id ? { ...a, updatedAt: now, updatedBy: user } : a),
    auditLog: [...s.auditLog, {
      id: uid('au'), accountId: source.id, action: 'Merge' as const,
      field: 'balance', newValue: dest.id, user, timestamp: now,
    }],
  }))
}

function runLifecycle(
  set: SetState,
  get: GetState,
  action: LifecycleAction,
  id: string,
  reason?: string,
): LifecycleResult {
  const s = get()
  const account = s.accounts.find(a => a.id === id)
  if (!account) return { ok: false, error: 'Not found', affectedIds: [] }
  const plan = planLifecycle(action, account, lifecycleCtx(s))
  if (!plan.allowed) return { ok: false, error: plan.blockedReason, affectedIds: [] }
  applyStatus(set, plan.targetIds, plan.status, AUDIT_ACTION[action], reason)
  return { ok: true, affectedIds: plan.targetIds }
}

/* What survives a reload. Enumerated rather than "all of it minus a couple", so
   that a slice added later is a deliberate decision to save it or not.

   Two are deliberately absent. `toasts` is ephemeral - one replaying on every
   reload would announce work the reader did days ago. `newAccountIds` drives the
   New badge on a row and means "created in this session", which a saved copy
   would stretch into "created at some point", marking the whole chart new. */
const PERSISTED_KEYS = [
  'company', 'accounts', 'dimensions', 'taxCodes', 'numberingScheme', 'periods',
  'transactions', 'journalEntries', 'jeAttachments', 'jeTags', 'accountAttachments', 'recordNotes', 'removedNotes', 'commsSent', 'commsThreads',
  'commsArchived', 'commsPinned', 'commsUnread', 'commsTransferred', 'recurringTemplates',
  'auditLog', 'periodSnapshots', 'seedQ1Openings', 'coaSavedViews', 'partners',
  'firstTimePreview', 'fullView', 'glView', 'periodSelection',
] as const satisfies readonly (keyof State)[]

export const useStore = create<State>()(persist((set, get) => ({
  company: seedCompany,
  accounts: seedAccounts,
  dimensions: seedDimensions,
  taxCodes: seedTaxCodes,
  numberingScheme: seedNumberingScheme,
  periods: seedPeriods,
  transactions: seedTransactions,
  journalEntries: seedJournalEntries,
  jeAttachments: {},
  jeTags: {},
  accountAttachments: seedAccountAttachments,
  recordNotes: {},
  removedNotes: [],
  commsSent: [],
  commsThreads: [],
  commsArchived: [],
  commsPinned: [],
  commsUnread: {},
  commsTransferred: [],
  recurringTemplates: seedRecurring,
  auditLog: seedAuditLog,
  periodSnapshots: [],
  seedQ1Openings,
  toasts: [],
  newAccountIds: [],
  firstTimePreview: false,
  fullView: false,
  // Postings is the General Ledger's landing tab.
  glView: 'tree',

  periodSelection: defaultPeriodSelection(seedPeriods, seedCompany.fiscalYearStart, todayIso()),

  setFullView: (v) => set({ fullView: v }),
  setGlView: (v) => set({ glView: v }),
  setPeriodSelection: (v) => set({ periodSelection: v }),
  setCompany: (patch) => set(s => ({ company: { ...s.company, ...patch } })),

  setFiscalYear: (iso, naming = 'start') => set(s => {
    if (anyPeriodHasPostings(s.periods, s.transactions)) return s
    return {
      company: { ...s.company, fiscalYearStart: iso, fiscalYearNaming: naming },
      periods: lockEndedPeriods(buildPeriodsFromFirstYear(iso, todayIso()), todayIso()),
    }
  }),

  addEarlierYears: (firstYear) => set(s => {
    const current = s.company.fiscalYearStart
    const periods = lockEndedPeriods(periodsWithEarlierYears(s.periods, current, firstYear, todayIso()), todayIso())
    if (periods === s.periods) return s
    // Only the year moves. The start month and the naming are what every year in
    // the books is shaped by, so they carry forward untouched.
    return { company: { ...s.company, fiscalYearStart: `${firstYear}-${current.slice(5)}` }, periods }
  }),

  dismissModuleChecklist: () => set(s => (
    s.company.moduleSetupChecklist
      ? { company: { ...s.company, moduleSetupChecklist: { ...s.company.moduleSetupChecklist, dismissed: true } } }
      : {}
  )),

  pushToast: (message, tone = 'success', description, action) => {
    const id = uid('toast')
    set(s => ({ toasts: [...s.toasts, { id, message, tone, description, action }] }))
    // Toasts with an action linger longer so the user has time to act (e.g. Undo).
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), action ? 7000 : 4000)
    return id
  },
  dismissToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  // DEV ONLY, see interface note. Clears all transactional/account data and
  // marks setup incomplete; keeps the tenant config a first run genuinely
  // inherits (tax codes, periods).
  resetToFirstTimeUser: () => set(s => ({
    accounts: [],
    newAccountIds: [],
    transactions: [],
    journalEntries: [],
    jeAttachments: {},
    jeTags: {},
    accountAttachments: {},
    recordNotes: {},
    removedNotes: [],
    commsSent: [],
    commsThreads: [],
    commsArchived: [],
    commsPinned: [],
    commsUnread: {},
    commsTransferred: [],
    recurringTemplates: [],
    auditLog: [],
    periodSnapshots: [],
    // Nobody has said what they want to report by yet. Setup asks, and the step
    // that asks has to open empty: three demo dimensions sitting there read as
    // ours rather than theirs, and the reader deletes before they define.
    dimensions: [],
    // Start the first-time numbering config from the standard default. Any
    // scheme the user configures during first-time setup is scoped to that
    // session and reset on exit, so it never governs normal account creation.
    numberingScheme: seedNumberingScheme,
    // Number protection starts on, as it does for any new chart; an import that
    // cannot live with it turns it off as it lands.
    company: { ...s.company, setupComplete: false, wizardDraft: undefined, numberProtection: undefined },
    firstTimePreview: true,
  })),

  // DEV ONLY, see interface note. Restores the seeded demo data and marks the
  // tenant as fully set up, so the app returns to its normal state.
  exitFirstTimeUser: () => set({
    accounts: seedAccounts,
    newAccountIds: [],
    transactions: seedTransactions,
    journalEntries: seedJournalEntries,
    jeAttachments: {},
    jeTags: {},
    accountAttachments: seedAccountAttachments,
  recordNotes: {},
  removedNotes: [],
    recurringTemplates: seedRecurring,
    auditLog: seedAuditLog,
    periodSnapshots: [],
    // The demo postings carry dimension ids, so the demo's dimensions have to
    // come back with them or those postings read as raw ids.
    dimensions: seedDimensions,
    // Discard any numbering scheme configured during first-time setup so it
    // doesn't constrain / block account creation in the normal app.
    numberingScheme: seedNumberingScheme,
    company: { ...seedCompany, setupComplete: true, wizardDraft: undefined },
    firstTimePreview: false,
  }),

  validateAccountNumber: (number, exceptId) => {
    const { numberingScheme, accounts } = get()
    return validateAccountNumberAgainst(numberingScheme, accounts, number, exceptId)
  },

  validateAccount: (a, exceptId) => {
    const { numberingScheme, accounts, company } = get()
    return validateAccountAgainst(numberingScheme, accounts, company, a, exceptId)
  },

  createAccount: (input, opts) => {
    const acc = buildAccount(input, get().accounts)
    /* A chart that has just gained its first revenue or expense account, and has
       an Equity root, gains its Current Year Earnings account with it (Mahad,
       2026-10-10: *"Current year earnings should exist like any other
       account"*). Added by the system, so it is not one of the reader's new
       accounts. Only on that first one: a chart that already had revenue or
       expense and no earnings account was built without one on purpose.

       Not from guided setup. Design, 2026-10-12: *"remove the Current Year
       Earnings account from the guided setup output in the prototype."* */
    const withNew = [...get().accounts, acc]
    const home = opts?.withoutEarnings || earningsAccountHome(get().accounts) ? undefined : earningsAccountHome(withNew)
    const earnings: Account[] = home ? [{
      ...buildAccount({
        accountNumber: suggestNextNumberAgainst(get().numberingScheme, withNew, 'Retained earnings', home),
        accountName: CURRENT_YEAR_EARNINGS_NAME,
        accountType: 'EQT',
        glAccountType: 'Posting',
        statementClassification: 'Retained earnings',
        accountRole: 'Current Year Earnings',
        parentId: home.id,
        isPosting: true,
        currencyCode: home.currencyCode,
        status: 'Active',
        effectiveDate: home.effectiveDate,
        postingRestrictions: {},
        defaultDimensionValues: [],
        description: CURRENT_YEAR_EARNINGS_HELP,
        balance: 0,
        netChange: 0,
        hasTransactions: false,
      }, withNew),
      createdBy: 'System (Automated)', updatedBy: 'System (Automated)',
    }] : []
    set(s => ({
      accounts: [...s.accounts, acc, ...earnings],
      newAccountIds: [...s.newAccountIds, acc.id],
      // Read off the account rather than restated here: the detail page's card
      // and its Activity tab answer "created when, by whom" from these two
      // fields, so there is one place for them to come from. Restating them also
      // stamped a second clock reading, a few milliseconds later than the first.
      auditLog: [...s.auditLog, { id: uid('au'), accountId: acc.id, action: 'Create', user: acc.createdBy, timestamp: acc.createdAt }],
    }))
    return acc
  },

  addJournalEntry: (entry, transactions, attachments, opts) => set(s => {
    // A posting moves the account's live balance: it changes activity inside the
    // period and the balance after it, never the balance before the period
    // began. The listing and the ledger tree rewind backward from
    // Account.balance to strike opening and movement (accountFiguresFor), so
    // leaving the balance stale pushed the new activity into the opening instead
    // - a fresh account debited 12.34 read opening -12.34 with the current
    // balance stuck at 0. Summing the normal-side delta per account keeps the
    // authored balance the true "after the last posting" figure the rewind
    // depends on.
    //
    // skipBalanceUpdate is for the callers that write the post-entry balances
    // themselves: the setup wizard already seeds each account's opening as its
    // balance before recording JE-OB-001, and closeYear sets the swept balances
    // by hand - moving the balance here as well would double them.
    const deltas = new Map<string, number>()
    if (!opts?.skipBalanceUpdate) {
      const byId = new Map(s.accounts.map(a => [a.id, a]))
      for (const t of transactions) {
        const acc = byId.get(t.accountId)
        if (!acc) continue
        deltas.set(t.accountId, (deltas.get(t.accountId) ?? 0) + normalSideDelta(acc, t))
      }
    }
    /* Every entry gets its journal internal ID here, since every entry arrives
       here - the form, a reversal, an archive transfer, the period close. One ID
       for the entry, on each of its postings. */
    const entryInternalId = transactions[0]?.entryInternalId ?? nextJournalInternalId(s.transactions)
    const stamped = transactions.map(t => ({ ...t, entryInternalId }))
    return {
      journalEntries: [...s.journalEntries, entry],
      transactions: [...s.transactions, ...stamped],
      accounts: deltas.size
        ? s.accounts.map(a => {
            const d = deltas.get(a.id)
            return d === undefined
              ? a
              : { ...a, balance: a.balance + d, netChange: (a.netChange ?? 0) + d, hasTransactions: true }
          })
        : s.accounts,
      // Keyed by reference, which is the JE number the detail page looks up.
      jeAttachments: attachments?.length
        ? { ...s.jeAttachments, [entry.reference]: attachments }
        : s.jeAttachments,
    }
  }),

  addCommMessage: (input) => {
    const now = new Date()
    const message: CommMessage = {
      ...input,
      id: uid('msg'),
      // Sender and time are stamped here rather than passed in, so a message
      // cannot claim to have been written by someone else, or at a time it
      // was not.
      from: CURRENT_USER.name,
      fromEmail: CURRENT_USER.email,
      isOutbound: true,
      dateIso: now.toISOString(),
      // Written the way a seeded message's is, not as the raw ISO string.
      timestamp: stampOf(now.toISOString()),
    }
    set(s => ({ commsSent: [...s.commsSent, message] }))
    return message
  },

  addCommThread: (input) => {
    const now = new Date()
    const { first, ...rest } = input
    const message: CommMessage = {
      ...first,
      id: uid('msg'),
      threadId: rest.id,
      from: CURRENT_USER.name,
      fromEmail: CURRENT_USER.email,
      isOutbound: true,
      dateIso: now.toISOString(),
      // Written the way a seeded message's is, not as the raw ISO string.
      timestamp: stampOf(now.toISOString()),
    }
    // The list row's own fields are derived from the message that starts the
    // thread, not asked for twice. A preview that disagreed with the message
    // under it would be the caller's to keep in step, and it would drift.
    const thread: CommThread = {
      ...rest,
      lastSender: message.from,
      lastSenderEmail: message.fromEmail,
      bodyPreview: previewOf(message.body),
      lastDate: shortDate(message.dateIso),
      dateIso: message.dateIso,
      isUnread: false,
      hasAttachments: !!message.attachments?.length,
      attachmentCount: message.attachments?.length ?? 0,
      messages: [message],
    }
    set(s => ({ commsThreads: [...s.commsThreads, thread] }))
    return thread
  },

  toggleCommArchived: (threadId) => set(s => ({
    commsArchived: s.commsArchived.includes(threadId)
      ? s.commsArchived.filter(id => id !== threadId)
      : [...s.commsArchived, threadId],
  })),

  setCommUnread: (threadId, unread) => set(s => (s.commsUnread[threadId] === unread ? s : { commsUnread: { ...s.commsUnread, [threadId]: unread } })),

  toggleCommPinned: (messageId) => set(s => ({
    commsPinned: s.commsPinned.includes(messageId)
      ? s.commsPinned.filter(id => id !== messageId)
      : [...s.commsPinned, messageId],
  })),

  transferCommThread: ({ thread, destination }) => {
    const id = uid('thread')
    /* A copy under a new id, because the original id is what marks the thread
       as gone from where it was. Reusing it would suppress the copy too. */
    const moved: CommThread = {
      ...thread,
      id,
      messages: thread.messages.map(m => ({ ...m, threadId: id })),
      subjectId: destination?.subjectId ?? thread.subjectId,
      // Unlinking leaves the thread where it is and files it as Other, which is
      // what the Unmatched mailbox reads. There is no inbox outside a record
      // here for it to go to instead.
      entityType: destination?.kind ?? 'Other',
      entityRef: destination?.ref ?? 'Unmatched',
      entityLabel: destination?.label ?? thread.entityLabel,
    }
    set(s => ({
      commsThreads: [...s.commsThreads, moved],
      commsTransferred: [...s.commsTransferred, thread.id],
    }))
  },

  closeQuarter: (fiscalYear, quarter) => {
    const { periods, accounts, transactions, periodSnapshots, seedQ1Openings, company } = get()
    const fyStart = company.fiscalYearStart
    const quarterPeriods = periodsForQuarter(periods, fiscalYear, quarter, fyStart)
    if (!quarterPeriods.length) {
      const error = `${quarter} ${fiscalYear} has no periods to close.`
      get().pushToast(error, 'danger')
      return { ok: false, error }
    }
    // Idempotency: a quarter whose periods are all hard-locked is already closed.
    if (quarterPeriods.every(p => p.status === 'Hard-Locked')) {
      const error = `${quarter} ${fiscalYear} is already closed.`
      get().pushToast(error, 'info')
      return { ok: false, error }
    }
    const guard = quarterCloseGuard(periods, fiscalYear, quarter, fyStart)
    if (guard) {
      get().pushToast(guard, 'danger')
      return { ok: false, error: guard }
    }

    const snapshots = buildQuarterSnapshots(accounts, transactions, periodSnapshots, seedQ1Openings, periods, fiscalYear, quarter, fyStart)
    const closingById = new Map(snapshots.map(s => [s.accountId, s]))
    const periodIds = new Set(quarterPeriods.map(p => p.id))
    const now = new Date().toISOString()

    set(s => ({
      periods: s.periods.map(p => (periodIds.has(p.id) ? { ...p, status: 'Hard-Locked' as const } : p)),
      // Replace any provisional snapshots for this fy/quarter with the finalized set.
      periodSnapshots: [
        ...s.periodSnapshots.filter(snap => !(snap.fiscalYear === fiscalYear && snap.quarter === quarter)),
        ...snapshots,
      ],
      accounts: s.accounts.map(a => {
        const snap = closingById.get(a.id)
        return snap ? { ...a, balance: snap.closing, netChange: snap.movement } : a
      }),
      auditLog: [...s.auditLog, { id: uid('au'), action: 'CloseQuarter' as const, periodRef: `${fiscalYear}-${quarter}`, user: 'Ahtisham Ahmad (You)', timestamp: now }],
    }))
    get().pushToast(`${quarter} ${fiscalYear} closed and locked.`, 'success')
    return { ok: true }
  },

  closeYear: (fiscalYear) => {
    const { periods, accounts, transactions, periodSnapshots, seedQ1Openings, company } = get()
    const fyStart = company.fiscalYearStart
    // Idempotency: if the next fiscal year's periods already exist, the year is closed.
    if (periods.some(p => fiscalYearOf(p.startDate, fyStart) === fiscalYear + 1)) {
      const error = `Fiscal year ${fiscalYear} is already closed.`
      get().pushToast(error, 'info')
      return { ok: false, error }
    }
    const guard = yearCloseGuard(periods, fiscalYear, fyStart)
    if (guard) {
      get().pushToast(guard, 'danger')
      return { ok: false, error: guard }
    }

    // The Q4 snapshots hold each account's Dec-31 closing. They exist because
    // closing Q4 wrote them; recompute defensively if somehow absent.
    let q4Snapshots = periodSnapshots.filter(s => s.fiscalYear === fiscalYear && s.quarter === 'Q4')
    if (!q4Snapshots.length) {
      q4Snapshots = buildQuarterSnapshots(accounts, transactions, periodSnapshots, seedQ1Openings, periods, fiscalYear, 'Q4', fyStart)
    }

    const retainedEarningsId = accounts.find(a => a.accountRole === 'Retained Earnings')?.id ?? 'acct_32100'
    const { entry, transactions: closingTx, net } = buildYearEndClosingEntry(accounts, q4Snapshots, retainedEarningsId, fiscalYear)

    // Reuse the existing action so the closing entry and its postings land the
    // same way any journal entry does. The post-close balances are set by hand
    // below (revenue/expense back to 0, net swept to Retained Earnings), so the
    // entry itself must not also move them.
    get().addJournalEntry(entry, closingTx, undefined, { skipBalanceUpdate: true })

    const openingSnapshots = nextYearOpeningSnapshots(accounts, q4Snapshots, retainedEarningsId, net, fiscalYear + 1)
    const fyPeriodIds = new Set(periods.filter(p => fiscalYearOf(p.startDate, fyStart) === fiscalYear).map(p => p.id))
    const now = new Date().toISOString()

    set(s => ({
      periods: [
        ...s.periods.map(p => (fyPeriodIds.has(p.id) ? { ...p, status: 'Hard-Locked' as const } : p)),
        ...buildFiscalYearPeriods(fiscalYear + 1, Number(fyStart.slice(5, 7)) - 1),
      ],
      accounts: s.accounts.map(a => {
        if (!a.isPosting) return a
        if (a.id === retainedEarningsId) return { ...a, balance: a.balance + net }
        if (a.accountType === 'REV' || a.accountType === 'EXP') return { ...a, balance: 0, netChange: 0 }
        return a
      }),
      periodSnapshots: [...s.periodSnapshots, ...openingSnapshots],
      auditLog: [...s.auditLog, { id: uid('au'), action: 'CloseYear' as const, periodRef: `${fiscalYear}-FY`, user: 'Ahtisham Ahmad (You)', timestamp: now }],
    }))
    get().pushToast(`Fiscal year ${fiscalYear} closed. Net ${net >= 0 ? 'income' : 'loss'} swept to Retained Earnings.`, 'success')
    return { ok: true }
  },

  setAccountAttachments: (accountId, files) => set(s => ({ accountAttachments: { ...s.accountAttachments, [accountId]: files } })),
  addRecordNote: (key, text) => set(s => ({
    recordNotes: { ...s.recordNotes, [key]: [{ id: uid('note'), text, author: 'Ahtisham Ahmad (You)', at: new Date().toISOString() }, ...(s.recordNotes[key] ?? [])] },
  })),
  removeRecordNote: (key, note) => set(s => ({
    recordNotes: { ...s.recordNotes, [key]: (s.recordNotes[key] ?? []).filter(n => n.id !== note.id) },
    removedNotes: s.removedNotes.includes(note.id) ? s.removedNotes : [...s.removedNotes, note.id],
  })),
  // A written note goes back on its record; a derived one only stops being hidden.
  restoreRecordNote: (key, note, written) => set(s => ({
    removedNotes: s.removedNotes.filter(id => id !== note.id),
    recordNotes: written && !(s.recordNotes[key] ?? []).some(n => n.id === note.id)
      ? { ...s.recordNotes, [key]: [note, ...(s.recordNotes[key] ?? [])] }
      : s.recordNotes,
  })),
  setEntryTags: (jeNumber, tags) => set(s => ({ jeTags: { ...s.jeTags, [jeNumber]: tags } })),

  updateAccount: (id, patch, reason) => {
    const before = get().accounts.find(a => a.id === id)!
    // Read-only once archived: an edit is refused here whatever door it came
    // through (lib/accountLifecycle, isReadOnlyAccount). Archive and unarchive
    // change status through the lifecycle plan, not through this.
    if (isReadOnlyAccount(before)) return before
    const updated: Account = { ...before, ...patch, updatedAt: new Date().toISOString(), updatedBy: 'Ahtisham Ahmad (You)' }
    const auditEntries: AuditEntry[] = []
    Object.entries(patch).forEach(([k, v]) => {
      const oldV = (before as any)[k]
      if (JSON.stringify(oldV) !== JSON.stringify(v)) {
        auditEntries.push({
          id: uid('au'), accountId: id, action: 'Edit', field: k,
          oldValue: typeof oldV === 'object' ? JSON.stringify(oldV) : String(oldV),
          newValue: typeof v === 'object' ? JSON.stringify(v) : String(v),
          reason, user: 'Ahtisham Ahmad (You)', timestamp: new Date().toISOString(),
        })
      }
    })
    set(s => ({
      accounts: s.accounts.map(a => a.id === id ? updated : a),
      auditLog: [...s.auditLog, ...auditEntries],
    }))
    return updated
  },

  deactivateAccount: (id, reason) => runLifecycle(set, get, 'deactivate', id, reason),
  activateAccount: (id) => runLifecycle(set, get, 'activate', id),
  // Soft-archive: move the account to the Archived tab without removing it.
  // History is preserved and the account can be brought back later. A balance
  // cannot come with it, so one holding money has to name where the money goes.
  archiveAccount: (id, moveBalanceTo) => {
    const s = get()
    const account = s.accounts.find(a => a.id === id)
    if (!account) return { ok: false, error: 'Not found', affectedIds: [] }
    const plan = planLifecycle('archive', account, lifecycleCtx(s))
    if (!plan.allowed) return { ok: false, error: plan.blockedReason, affectedIds: [] }
    if (plan.balanceMove) {
      const dest = plan.balanceMove.destinations.find(d => d.id === moveBalanceTo)
      if (!dest) return { ok: false, error: 'Choose where the balance goes.', affectedIds: [] }
      moveBalance(set, get, account, dest)
    }
    applyStatus(set, plan.targetIds, plan.status, AUDIT_ACTION.archive)
    return { ok: true, affectedIds: plan.targetIds }
  },
  unarchiveAccount: (id) => runLifecycle(set, get, 'unarchive', id),

  /* A true delete. The audit trail goes with the row rather than gaining an entry:
     every entry is keyed to an accountId, and a log pointing at an account that no
     longer exists renders as a blank line on the detail page of nothing. The gate
     is what makes that safe - nothing has posted to this account, so there is no
     ledger history the audit trail was the explanation for. */
  deleteAccount: (id) => {
    const s = get()
    const account = s.accounts.find(a => a.id === id)
    if (!account) return { ok: false, error: 'Not found', affectedIds: [] }
    const plan = planDelete(account, lifecycleCtx(s))
    if (!plan.allowed) return { ok: false, error: plan.blockedReason, affectedIds: [] }
    set(st => ({
      accounts: st.accounts.filter(a => a.id !== id),
      auditLog: st.auditLog.filter(e => e.accountId !== id),
    }))
    return { ok: true, affectedIds: [id] }
  },

  bulkLifecycle: (action, ids) => {
    const state = get()
    const ctx = lifecycleCtx(state)
    const plan = planBulk(action, ids, ctx)
    if (plan.targetIds.length === 0) {
      return { ok: false, error: plan.toast, affectedIds: [], skipped: plan.skipped.map(s => s.id) }
    }
    applyStatus(set, plan.targetIds, plan.status, AUDIT_ACTION[action])
    return { ok: true, affectedIds: plan.targetIds, skipped: plan.skipped.map(s => s.id) }
  },

  mergeAccounts: (sourceIds, targetId) => {
    const { accounts } = get()
    const target = accounts.find(a => a.id === targetId)
    if (!target) return { ok: false, error: 'Target not found' }
    for (const sid of sourceIds) {
      const s = accounts.find(a => a.id === sid)
      if (!s) return { ok: false, error: 'Source not found' }
      if (s.accountType !== target.accountType) return { ok: false, error: 'Merge requires same account type (BR-012).' }
    }
    set(s => {
      const newTransactions = s.transactions.map(t => sourceIds.includes(t.accountId) ? { ...t, accountId: targetId } : t)
      // Both columns move, not just the balance: a parent summary's movement is now
      // the sum of its postings', so leaving netChange behind on a merged-away
      // account would double count the period on every ancestor.
      const sources = sourceIds.map(sid => accounts.find(a => a.id === sid)).filter(Boolean) as Account[]
      const mergedBalance = target.balance + sources.reduce((sum, a) => sum + a.balance, 0)
      const mergedNetChange = (target.netChange ?? 0) + sources.reduce((sum, a) => sum + (a.netChange ?? 0), 0)
      return {
        transactions: newTransactions,
        accounts: s.accounts.map(a => {
          if (a.id === targetId) return { ...a, balance: mergedBalance, netChange: mergedNetChange, hasTransactions: true }
          if (sourceIds.includes(a.id)) return { ...a, status: 'Inactive', balance: 0, netChange: 0 }
          return a
        }),
        auditLog: [
          ...s.auditLog,
          ...sourceIds.map(sid => ({ id: uid('au'), accountId: sid, action: 'Merge' as const, newValue: targetId, user: 'Ahtisham Ahmad (You)', timestamp: new Date().toISOString() })),
        ],
      }
    })
    return { ok: true }
  },

  setDimensions: (dimensions) => set({ dimensions }),
  addDimension: (t) => {
    const now = new Date().toISOString()
    const dimension: Dimension = { ...t, id: uid('dimension'), createdAt: now, updatedAt: now, createdBy: 'Ahtisham Ahmad (You)', updatedBy: 'Ahtisham Ahmad (You)' }
    set(st => ({ dimensions: [...st.dimensions, dimension] }))
    return dimension
  },
  updateDimension: (id, patch) => set(st => ({ dimensions: st.dimensions.map(t => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString(), updatedBy: 'Ahtisham Ahmad (You)' } : t) })),
  /* Takes the dimension's account defaults with it, as both remove dialogs say.
     Only reached for a dimension nothing has posted with: the Dimensions page
     refuses Remove on one in use and offers Deactivate (decision 89), and in
     setup nothing has posted yet. */
  deleteDimension: (id) => set(st => ({
    dimensions: st.dimensions.filter(t => t.id !== id),
    accounts: st.accounts.some(a => a.defaultDimensionValues?.some(p => p.dimensionId === id))
      ? st.accounts.map(a => a.defaultDimensionValues?.some(p => p.dimensionId === id)
        ? { ...a, defaultDimensionValues: a.defaultDimensionValues.filter(p => p.dimensionId !== id) }
        : a)
      : st.accounts,
  })),

  setNumberingScheme: (s) => set({ numberingScheme: s }),

  suggestNextNumber: (section) => {
    const { numberingScheme, accounts } = get()
    return suggestNextNumberAgainst(numberingScheme, accounts, section)
  },

  // Batch allocator built on the same +10 rule as suggestNextNumber, returning
  // `count` numbers at once and accounting for the ones it just handed out so a
  // single generation pass never collides.
  allocateNumbers: (type, count) => {
    const { numberingScheme, accounts } = get()
    if (count <= 0) return []
    const width = suggestionWidth(numberingScheme)
    const first = categoryFirstNumber(type, width)
    const peers = accounts.filter(a => a.accountType === type)
    if (numberingScheme.segments.length > 1) {
      const used = peers.map(a => accountSegmentValue(numberingScheme, a.accountNumber)).filter(n => !isNaN(n))
      let cursor = used.length ? Math.max(...used) : first - 10
      const out: string[] = []
      for (let i = 0; i < count; i++) { cursor += 10; out.push(formatInScheme(numberingScheme, cursor)) }
      return out
    }
    const used = peers
      .filter(a => isNumericAccountNumber(a.accountNumber))
      .map(a => parseInt(a.accountNumber, 10))
    let cursor = used.length ? Math.max(...used) : first - 10
    const out: string[] = []
    for (let i = 0; i < count; i++) {
      cursor += 10
      out.push(String(cursor).padStart(width, '0'))
    }
    return out
  },

  hasOpenJEReferencing: (accountId) => {
    return get().journalEntries.some(je => (je.status === 'Open' || je.status === 'Draft') && je.lines.some(l => l.accountId === accountId))
  },
  hasRecurringReferencing: (accountId) => {
    return get().recurringTemplates.some(t => t.accountIds.includes(accountId))
  },

  // ── Saved COA views ── these never touch `accounts`; a view is a lens only.
  coaSavedViews: [],
  addCoaView: (v) => set(s => ({ coaSavedViews: [...s.coaSavedViews, v] })),
  updateCoaView: (id, patch) => set(s => ({ coaSavedViews: s.coaSavedViews.map(v => v.id === id ? { ...v, ...patch, id: v.id } : v) })),
  removeCoaView: (id) => set(s => ({ coaSavedViews: s.coaSavedViews.filter(v => v.id !== id) })),

  partners: SEED_PARTNERS,
  addPartner: (input) => {
    const now = new Date().toISOString()
    const partner: Partner = {
      ...input,
      id: uid('ptr'),
      kinds: input.kinds.length ? input.kinds : ['vendor'],
      createdAt: now,
      createdBy: 'Ahtisham Ahmad (You)',
    }
    set(s => ({ partners: [...s.partners, partner] }))
    return partner
  },
}), {
  name: STATE_KEY,
  storage: createJSONStorage(() => savedStateStorage),
  partialize: s => Object.fromEntries(PERSISTED_KEYS.map(k => [k, s[k]])) as unknown as State,
  /* Bump when a saved chart stops being readable by this build. A demo has
     nothing worth migrating, so an older save is dropped and the seed runs
     again - the same outcome as pressing Reset demo data, just automatic.
     Returning an empty object leaves the freshly seeded state untouched.
     3: the demo chart went to five-digit numbers (2026-09-25), so a save holding
     the four-digit chart would sit beside postings that name the new ones. */
  /* 5: retained earnings split into a system and a manual adjustments account
     (design review, 2026-09-28). A chart saved by an earlier build has the one
     posting account, so it is dropped and the demo reseeded. (4 was the same
     change, saved by a build still in progress.) */
  /* 6: the seeded attachment folders grew the DOC/PNG/JPG kinds (2026-09-29).
     `accountAttachments` is persisted, so a save from an earlier build would
     keep showing the old PDF-and-XLSX-only folders. */
  /* 7: every seeded posting carries its entry's memo (2026-09-30). A save from
     an earlier build holds postings without one, which would read a different
     memo per line beside the reseeded ones. */
  /* 8: every posting carries its entry's journal internal ID (2026-09-30). */
  /* 9: an account holding several values for a dimension marks one as the
     default its postings take (2026-10-02), and the seed now has one. */
  /* 10: the seeded dimensions say who added and last changed them (2026-10-03),
     for the Dimensions list's audit columns. */
  /* 11: Current Year Earnings is an account, 35000, rather than a line the
     listing draws (2026-10-10). A save from an earlier build has no such account. */
  version: 11,
  migrate: () => ({}) as State,
  // A save read back on a later day locks the months that have ended since.
  merge: (persisted, current) => {
    const s = { ...current, ...(persisted as Partial<State>) }
    return { ...s, periods: lockEndedPeriods(s.periods, todayIso()) }
  },
}))

/* Whether the saved chart has been read back yet. Reading IndexedDB is async, so
   for the first moments the store still holds the seed; painting then would show
   the demo chart and swap it for the reader's own a frame later.

   True from the first render when nothing is persisting - tests, or a browser
   with storage blocked - because that storage answers synchronously, so this
   never gates an app that has nothing to wait for. */
export function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated())
  useEffect(() => {
    if (useStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    return useStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])
  return hydrated
}

/* How to write an account number out for a reader. A chart that imported glued
   numbers and chose to shorten them shows the account segment alone, so every
   surface has to agree: the number in the listing, in the ledger, on the detail
   header and in a journal line are the same account said four times, and one of
   them spelling it differently reads as a different account.
 *
 * Reading only. The stored number is what a form edits, what a sort orders and
 * what a download carries, so those sites go on using accountNumber directly. */
export function useAccountNumberText(): (number: string) => string {
  const scheme = useStore(s => s.numberingScheme)
  return useMemo(() => (number: string) => displayAccountNumber(scheme, number), [scheme])
}

// The period in force, resolved. Every surface that shows money reads it through
// this one hook so the Chart of Accounts, the ledger and an account's detail can
// never resolve the same selection to different spans.
export function useSelectedPeriod(): ResolvedPeriod {
  const selection = useStore(s => s.periodSelection)
  const periods = useStore(s => s.periods)
  const fiscalYearStart = useStore(s => s.company.fiscalYearStart)
  const naming = useStore(s => s.company.fiscalYearNaming)
  // Re-resolving on every render is cheap (a filter over twelve periods) and
  // keeps a `ytd` span honest as the day rolls over.
  return useMemo(
    () => resolvePeriodSelection(selection, periods, fiscalYearStart, todayIso(), naming),
    [selection, periods, fiscalYearStart, naming],
  )
}

// The chart with every posting account's balance and net change rewound to the
// selected period. Memoized at module scope rather than per component: the
// listing, the table and the row components that roll up totals all need the very
// same array, and recomputing it per caller would walk the whole transaction set
// several times over on every render. Pure derivation from stable inputs, so the
// cached array is identity-stable for as long as those inputs are.
let scopedChartCache: { key: unknown[]; result: Account[] } | null = null

export function usePeriodScopedAccounts(): Account[] {
  const accounts = useStore(s => s.accounts)
  const transactions = useStore(s => s.transactions)
  const period = useSelectedPeriod()
  const key: unknown[] = [accounts, transactions, period.startDate, period.endDate]
  if (!scopedChartCache || scopedChartCache.key.some((k, i) => k !== key[i])) {
    scopedChartCache = { key, result: scopeAccountsToPeriod(accounts, transactions, period) }
  }
  return scopedChartCache.result
}

// The tree over that same chart: parents, children, depths and rolled-up
// figures. Built off the identical array the hook above returns, and
// buildChartIndex caches on that array's identity, so every surface reading
// structure or a summary total shares one derivation rather than each rolling
// its own.
export function usePeriodScopedChart(): ChartIndex {
  return buildChartIndex(usePeriodScopedAccounts())
}
