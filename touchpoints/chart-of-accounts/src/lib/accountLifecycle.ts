import type { Account, AccountRole, AccountStatus, JournalEntry, Transaction } from '../types'
import { isCategoryRoot } from '../types'
import { buildChartIndex, type ChartIndex } from './chartTree'
import { fmtCurrencyExact, todayIso, uid } from './utils'

/* Who may be deactivated, archived, deleted or brought back, and what the reader
   is told before it happens. Every surface that offers one of these goes through
   planLifecycle or planDelete, so the COA list, the tree, the bulk bar and the
   detail page can never disagree about whether an action is allowed or what it
   will touch.

   The three closings are separate things, and the split is stated once beside
   planDelete: deactivate locks, archive removes from the chart and keeps the
   history, delete keeps nothing and is only offered where there is nothing to
   keep.

   Store-free and JSX-free on purpose: it is a pure function of the chart, so it
   can be unit-tested (vitest runs these in a node environment) and the copy
   lives beside the rule that produces it rather than drifting in a component. */

export type LifecycleAction = 'deactivate' | 'activate' | 'archive' | 'unarchive'

/* Delete is not one of them. The four above are status transitions, and each has a
   status to land on; delete has no state on the other side of it, so it gets its
   own plan rather than a row in every Record keyed by action. This union is for
   the places that only need to tell the five apart - an icon, a menu key. */
export type AccountAction = LifecycleAction | 'delete'

export interface LifecycleCtx {
  accounts: Account[]
  hasOpenJEs: (accountId: string) => boolean
  /** The company's base currency: the one every balance is held in, and so the
   *  one a balance move is stated and posted in. */
  baseCurrency?: string
}

export interface ConfirmSpec {
  tone: 'warning' | 'danger'
  title: string
  description: string[]
  /** Heading for the named-accounts box, e.g. 'Accounts affected'. */
  affectedTitle?: string
  /** Every account the action writes to, named. */
  affected?: string[]
  /** The rest of that same list, past what the box names inline. */
  affectedRest?: string[]
  /** Heading for the second box, e.g. 'Why each one stayed'. */
  stayedTitle?: string
  /* The accounts the batch leaves where they are, each with its own reason. A
     count is not an answer here: the reader ticked those rows deliberately, and
     "14 skipped" tells them neither which fourteen nor what to do about any of
     them. Named beside the ones that do move, the same dialog answers both. */
  stayed?: string[]
  /** The rest of that same list, past what the box names inline. */
  stayedRest?: string[]
  confirmLabel: string
}

/**
 * What a refused action tells the reader who asked for it anyway. The action is
 * offered whatever the answer is, and the answer arrives as a dialog: a greyed
 * menu item with the reason behind a hover asks the reader to discover why
 * nothing happened, which is the one moment they are least likely to go looking.
 */
export interface RefusalSpec {
  title: string
  description: string[]
  /** Heading for the named-accounts box, e.g. 'Still active'. */
  affectedTitle?: string
  /** The accounts standing in the way, named, so the reader knows where to start. */
  affected?: string[]
  /** The rest of that same list, past what the box names inline. */
  affectedRest?: string[]
  /** The button, where it is not Close: a refusal that only waits on
   *  something - the year-end close - is acknowledged rather than shut. */
  dismissLabel?: string
}

/**
 * The money an account has to hand over before it can leave the chart, and the
 * accounts that may take it.
 *
 * This is the line between the two closing actions. An inactive account keeps
 * its balance and goes on being reported; an archived one is off the chart, so
 * a balance left on it would be money reported from nowhere. Archiving
 * therefore asks where it goes rather than refusing, and the answer is part of
 * the same action: the move and the archive commit together or not at all.
 */
export interface BalanceMove {
  amount: number
  currency: string
  /** Active posting accounts in the same category, numerically ordered. */
  destinations: Account[]
}

export interface LifecyclePlan {
  action: LifecycleAction
  status: AccountStatus
  allowed: boolean
  /** One line saying why the action is refused. */
  blockedReason?: string
  /** Present exactly when the action is refused. */
  refusal?: RefusalSpec
  needsConfirm: boolean
  /** Every account to write. An action only ever writes the account it was asked
   *  about: nothing is dragged along with it. */
  targetIds: string[]
  /** Present exactly when archiving an account that still holds money. The
   *  reader picks a destination and the confirmation turns into the move. */
  balanceMove?: BalanceMove
  confirm?: ConfirmSpec
  toast: string
  menuLabel: string
}

export interface BulkPlan {
  action: LifecycleAction
  status: AccountStatus
  targetIds: string[]
  affected: string[]
  skipped: { id: string; label: string; reason: string }[]
  needsConfirm: boolean
  confirm?: ConfirmSpec
  /** Present when the selection held something but none of it could move. */
  refusal?: RefusalSpec
  toast: string
}

const TARGET_STATUS: Record<LifecycleAction, AccountStatus> = {
  deactivate: 'Inactive', activate: 'Active', archive: 'Archived', unarchive: 'Active',
}

/* Retained earnings is not an ordinary equity account: the year-end close posts to
   it, and the close is the system's own entry rather than anyone's journal. That
   makes the account part of the machinery. Locked, off the chart, or gone, and the
   close has nowhere to land, so all three closings are refused on it and say which
   mechanism is depending on it. Coming back is never refused, here or anywhere.

   Read off the role rather than the number or the name, because neither is unique
   or fixed: numbers are alphanumeric and may repeat, and the reader can rename the
   account. The role is what the close itself looks the account up by. */
const BLOCKED_SYSTEM_RETAINED = 'The year-end close posts to retained earnings, so this account stays on the chart and stays open. It cannot be deactivated, archived or deleted.'

export const isRetainedEarnings = (a: Pick<Account, 'accountRole'>) => a.accountRole === 'Retained Earnings'
/* Current Year Earnings states revenue less expenses, which the chart works out
   for as long as there is a chart, and the close reads it at year end. */
const BLOCKED_SYSTEM_EARNINGS = 'This account states revenue less expenses for the year, and the year-end close moves it into retained earnings, so it stays on the chart and stays open. It cannot be deactivated, archived or deleted.'
/** The manual half of retained earnings: where corrections made by hand go. */
export const isRetainedEarningsAdjustments = (a: Pick<Account, 'accountRole'>) => a.accountRole === 'Retained Earnings Adjustments'

/* The five branches at the top of the chart (Assets, Liabilities, Equity,
   Revenue, Expense). They are what the statement is filed under, so nothing
   under them has anywhere to move to if they leave, and there is nothing to
   report on if they are turned off. */
const BLOCKED_CATEGORY_ROOT = 'This is a top of the chart, and the statement is filed under it. It cannot be deactivated or archived - remove the accounts inside it instead.'

/* A summary is not an account something is moved to: it is the sum of what
   sits under it, and nothing posts to it directly. The way to take a summary
   off the chart is to take the accounts under it off first; the summary then
   has nothing to total and comes down on its own. */
/* Mahad, 2026-09-22: *"I don't think summary accounts should allow direct
   transaction postings - that doesn't make sense. I think summary account should
   be archived only, but only when there is no child account under it."*

   Deactivate closes an account to postings, and nothing ever posts to a summary,
   so the state said nothing about one. Offering it implied the opposite - that a
   summary was open to transactions until you turned it off. Archive is the one
   way a summary leaves, and `holdUps` gates it on the branch being empty. */
/* Decision 53 (Eli, 2026-09-04) settled it the other way, and the module review
   of 2026-10-06 (COA-21) and Outline 09 asked for it: a summary can be
   deactivated once every account under it is inactive. It then stops being
   offered as a parent for new accounts, as a posting account stops being
   offered to new entries. `holdUps` gates it on the branch, as it gates archive. */

/* Roles the module needs at least one active holder of. Removing the last one
   would leave every other module naming an account that is no longer on the
   chart: an invoice with no receivable to post to, a bill with no payable, a
   migration with no opening balance to hold. Retained Earnings is on the same
   footing but is refused above under `systemHold`. */
export const REQUIRED_ROLES: readonly AccountRole[] = [
  'Accounts Receivable',
  'Accounts Payable',
  'Opening Balance Equity',
]

/* Which of the archive rules the account plays by. Read off role and category
   together, because a role is finer than a category (a bank account and a
   piece of PPE are both AST, and the two do not archive by the same rule) and
   a category is more forgiving than a role (an asset with no role is still
   handled the balance-sheet way, not left with no rule at all).

   - `cash`     — money kept in a bank, on hand, or waiting to be deposited.
     Transferred to another cash account; no month-end wait, because a cash
     balance is what is there right now and does not accrue at period edges.
   - `card`     — a credit card. Must be at true zero: overpaying it produces
     a credit balance which is not zero either. Paid off from a bank, or the
     remaining balance moves to another card.
   - `balanceSheet` — any other asset or liability role (receivables,
     payables, inventory, PPE, ...). Move to another account of the same role,
     and safest at month end so the postings that will keep coming this period
     move with the balance.
   - `permanentEquity` — capital accounts (common stock, paid-in capital,
     opening balance equity). No move flow; the account archives only at zero.
   - `incomeStatement` — revenue and expense (and equity-adjacent draws,
     distributions, dividends). No move flow; the account archives only after
     the year-end close has swept the tally and nothing has posted since.
*/
export type ArchiveBucket = 'cash' | 'card' | 'balanceSheet' | 'permanentEquity' | 'incomeStatement'

const CASH_ROLES: readonly AccountRole[] = ['Bank', 'Cash on Hand', 'Payments to Deposit']

export function archiveBucketOf(a: Pick<Account, 'accountType' | 'accountRole'>): ArchiveBucket {
  const r = a.accountRole
  if (r && CASH_ROLES.includes(r)) return 'cash'
  if (r === 'Credit Card') return 'card'
  if (a.accountType === 'REV' || a.accountType === 'EXP') return 'incomeStatement'
  if (a.accountType === 'EQT') return 'permanentEquity'
  return 'balanceSheet'
}

/** Whether the role, if archived here, would leave the module without one. */
function isLastActiveOfRequiredRole(a: Account, accounts: Account[]): boolean {
  if (!a.accountRole || !REQUIRED_ROLES.includes(a.accountRole)) return false
  const others = accounts.filter(x =>
    x.id !== a.id && x.accountRole === a.accountRole && x.status === 'Active')
  return others.length === 0
}

/** The reasons an account is off-limits to a closing action, whatever its
 *  state. Read before every other gate: no amount of dealing with what is
 *  around the account will clear it, and the reader should not be sent chasing
 *  children or entries first only to be refused for a reason that was always
 *  going to hold. */
function neverArchivableReason(a: Account, action: AccountAction, accounts: Account[]): string | undefined {
  if (isCategoryRoot(a)) return BLOCKED_CATEGORY_ROOT
  // A summary is not refused here: deactivate and archive are both gated on its
  // branch by `holdUps`, which is a state the reader can clear. Delete is
  // refused separately by its own gates.
  if (isLastActiveOfRequiredRole(a, accounts)) {
    const role = a.accountRole!
    const verb = action === 'archive' ? 'archive' : action === 'delete' ? 'delete' : 'deactivate'
    return `This is the only active ${role} account, and other modules need one to post to. Add another ${role} account first, then ${verb} this one.`
  }
  return undefined
}

/** Why the system needs this account left alone, for an action that would take it
 *  out of service. Undefined for every ordinary account. */
const systemHold = (account: Account, action: AccountAction, accounts: Account[]) =>
  isRetainedEarnings(account)
    ? BLOCKED_SYSTEM_RETAINED
    : account.accountRole === 'Current Year Earnings'
      ? BLOCKED_SYSTEM_EARNINGS
      : neverArchivableReason(account, action, accounts)

/* The message the "no unposted work" gate carries. The check itself reads open
   journal entries - drafts, ones waiting to post - which is the state the
   module actually tracks. Read at archive too, since money moves off the
   account on the way out and a draft still expecting to land there would post
   to somewhere it no longer names. */
const BLOCKED_UNPOSTED_WORK = 'Something is still on its way to this account - a draft entry, an approval waiting, a purchase order open against it. Post it, void it, or close it first.'
const BLOCKED_LIVE_CHILDREN = 'Some accounts under this account are still on the chart. Archive them first.'
const BLOCKED_ACTIVE_CHILDREN = 'Some accounts under this account are still active. Deactivate them first.'
/* A balance moves to an account under the summary it sits under (Mahad,
   2026-10-08), or to one with the same role anywhere (Mahad, 2026-10-10), so
   each says which of the two came up empty. */
const BLOCKED_NOWHERE_TO_MOVE_CASH = (role: AccountRole, summary: string) => `This balance has nowhere to go. There is no other open cash account under ${summary} and no other open ${role} account in your chart of accounts, so activate or add one first.`
const BLOCKED_NOWHERE_TO_MOVE_CARD = 'This balance has nowhere to go. Pay it off from a bank account, or activate another Credit Card account so the remaining balance has somewhere to land.'
const BLOCKED_NOWHERE_TO_MOVE_ROLE = (role: AccountRole) => `This balance has nowhere to go. There is no other open ${role} account in your chart of accounts, so activate one first.`
const BLOCKED_NOWHERE_TO_MOVE_CATEGORY = (summary: string) => `This balance has nowhere to go. There is no other open account in this category under ${summary}, so activate one there first.`
const BLOCKED_CARD_NON_ZERO = (amount: string) => `This card is not at zero - it holds ${amount}. Pay it off from a bank account, or transfer the remaining balance to another card, so archiving finds no money to leave behind. An overpaid credit balance is not zero either.`
const BLOCKED_EQUITY_NON_ZERO = (amount: string) => `This account holds ${amount}, and a permanent equity account has to be at zero before it can be archived. Move the balance out through a journal entry that clears it.`
// Mahad's copy, 2026-10-08.
const BLOCKED_INCOME_NON_ZERO = (amount: string) => `This account has a balance of ${amount}. Revenue and expense balances move to retained earnings at the year-end close. You can archive this account after the close, before anything new is posted to it.`
const SKIPPED_HOLDS_BALANCE = 'Holds a balance. Archive it on its own, so you can say where the money goes.'

export const describeAccount = (a: Account) => `${a.accountNumber} ${a.accountName}`

const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`

/**
 * Whether a row prints its rolled-up figure. A summary that is no longer active
 * has stopped totalling, so showing a number would contradict the confirmation the
 * reader just accepted. A posting account holds its own balance and always shows
 * it, whatever its status.
 *
 * Applied on top of the figures, never inside them: an inactive account's balance
 * still belongs to its parent's total, and suppressing it in the rollup would drop
 * a whole branch out of its grandparent.
 */
export function showsSummaryTotal(a: Account): boolean {
  // An inactive summary stays on reports, as an inactive account does (decision
  // 31); only an archived one has left the chart.
  return a.glAccountType === 'Summary' ? a.status !== 'Archived' : true
}

/** The span of numbers a summary covers, as prose: '1015 to 1049'. Read off what
 *  it actually totals, since a summary reserves nothing and so declares no span. */
export function describeSummarySpan(a: Account, index: ChartIndex): string | undefined {
  if (a.glAccountType !== 'Summary') return undefined
  const numbers = index.descendantsOf(a.id).map(d => d.accountNumber).sort()
  if (!numbers.length) return undefined
  return `${numbers[0]} to ${numbers[numbers.length - 1]}`
}

/* What each state is, for a control that offers all three at once. The dialogs
   say what an action does to this account; these say what the state means, so a
   reader choosing between them can tell the two closings apart before picking
   one. The order is the order they are offered in. */
export const STATUS_ORDER: AccountStatus[] = ['Active', 'Inactive', 'Archived']

/** The states this account can be in. A summary has all three since decision
 *  53; whether it can reach one is decided on the attempt, by `holdUps`. */
export const statusesFor = (_a: Pick<Account, 'glAccountType'>): AccountStatus[] => STATUS_ORDER

/* Said once per kind of account, because a state can mean different things to
   them. Stated together rather than one at a time so the reader can see which
   rule is theirs, and what the other kind's is. Inactive says it only for a
   posting account, because it is the only kind that has the state. */
export interface StatusMeaning {
  Posting: string
  Summary?: string
}

/* Copy supplied verbatim. Archived says "no longer part of the chart of
   accounts" once per kind rather than once above both, so each line stands on
   its own and the reader who only reads theirs still gets the whole rule.

   Each line says what the state *is* and stops there. What would refuse the
   change - unposted work on its way in, accounts still under a summary, a
   balance with nowhere to go - is deliberately not here: it belongs to the
   attempt, not to the state, and `planLifecycle` states it at the moment it
   applies. Listing all of it on all three options put every reader's refusal
   in front of every reader, and the picker read as a rulebook. */
/* An archived account is read-only: nothing about it changes until it is
   unarchived, and the guard applies the moment it is archived, not on the next
   load. One rule, read by the store and by every place that offers an edit.
   Retest, 2026-10-09: right after archiving a fresh 12170, Add dimension still
   saved Department = Design, while other doors already refused archived
   accounts. */
export const isReadOnlyAccount = (a: Pick<Account, 'status'>): boolean => a.status === 'Archived'
export const ARCHIVED_READ_ONLY = 'Archived accounts can\u2019t be changed. Unarchive it to edit it.'

export const STATUS_MEANING: Record<AccountStatus, StatusMeaning> = {
  Active: {
    Posting: 'Posting account: Available for transactions.',
    Summary: 'Summary account: Available as a parent for other accounts.',
  },
  Inactive: {
    Posting: 'Posting account: No longer available for transactions.',
    Summary: 'Summary account: No longer available as a parent for new accounts.',
  },
  Archived: {
    Posting: 'Posting account: No longer part of the chart of accounts.',
    Summary: 'Summary account: No longer part of the chart of accounts.',
  },
}

/** One state's copy as the lines a control prints, in reading order. */
export const statusMeaningLines = (status: AccountStatus): string[] => {
  const m = STATUS_MEANING[status]
  return m.Summary ? [m.Posting, m.Summary] : [m.Posting]
}

/** The action that gets an account from where it is to the state chosen. */
export function actionToward(target: AccountStatus, current: AccountStatus): LifecycleAction | undefined {
  if (target === current) return undefined
  if (target === 'Active') return current === 'Archived' ? 'unarchive' : 'activate'
  return target === 'Inactive' ? 'deactivate' : 'archive'
}

// Active < Inactive < Archived. The one gate below is stated as "not yet as far
// along as where this one is going" rather than as an equality, so an archived
// account under a summary does not have to be reopened to get out of the way -
// while an inactive one still holds the summary, because it is still on the
// chart and archiving the summary above it would strand it.
const RANK: Record<AccountStatus, number> = { Active: 0, Inactive: 1, Archived: 2 }

/**
 * The money sitting on the account itself. Only a posting account has any: a
 * summary's figure is the sum of the accounts under it, and every one of those
 * has already been dealt with by the time the summary can be archived, so
 * reading a stored number off it would double-count what the branch handed over.
 */
export function heldBalance(a: Account): number {
  return a.glAccountType === 'Posting' ? a.balance || 0 : 0
}

/**
 * Where a balance may go, by bucket:
 *   cash → any other active cash account (Bank, Cash on Hand, Payments to
 *          Deposit) - the reader is moving money between wallets, so the role
 *          within the bucket is not what makes the destination valid;
 *   card → another active Credit Card, since a card's balance is what the
 *          business owes and only another card can take that on;
 *   balanceSheet → an account of the same role, so a receivable moves to
 *          another receivable and an inventory move stays inventory - or, for
 *          an unroled asset/liability, any other posting in the same
 *          category, so the rule does not refuse an account without a role;
 *   permanentEquity / incomeStatement → nowhere, and no picker is shown; the
 *          balance is cleared through a journal entry or the close, not by
 *          re-pointing it at another equity or revenue account.
 * Active and posting throughout, because a closed account cannot take money
 * and a summary holds none of its own.
 *
 * In any currency, for now. Mahad, 2026-10-10: *"When I try to archive an
 * account that has another currency other than USD, make sure we have the same
 * behavior as we have in the USD account for now."* It used to offer only
 * accounts in the source's own currency, which left a EUR or GBP account with
 * nowhere to go and so refused it. Every balance is held in the base currency,
 * and the move posts that base figure (see `buildBalanceTransferEntry`), so no
 * rate is asked for; a revaluation of the foreign balance is not part of it.
 *
 * Under the same summary as the account, at any depth (Mahad, 2026-10-08), so
 * the balance stays on the statement line it was reported on - or, anywhere in
 * the chart, an account with the same role. Mahad, 2026-10-10: *"Your decision is
 * to offer accounts under the same parent or accounts with the same role."* The
 * rules above still hold under the summary: a receivable only moves to a
 * receivable, and cash only to cash.
 */
export function balanceDestinations(account: Account, accounts: Account[]): Account[] {
  const bucket = archiveBucketOf(account)
  if (bucket === 'permanentEquity' || bucket === 'incomeStatement') return []
  const byId = new Map(accounts.map(a => [a.id, a]))
  const under = (d: Account) => {
    if (!account.parentId) return true
    for (let p = d.parentId; p; p = byId.get(p)?.parentId ?? null) if (p === account.parentId) return true
    return false
  }
  const open = accounts.filter(d => d.id !== account.id
    && d.glAccountType === 'Posting'
    && d.status === 'Active')
  const byNumber = (a: Account, b: Account) =>
    a.accountNumber.localeCompare(b.accountNumber, undefined, { numeric: true })
  const sameRole = (d: Account) => !!account.accountRole && d.accountRole === account.accountRole
  // What the bucket accepts from under the summary.
  const fits = (d: Account) => {
    if (bucket === 'cash') return !!d.accountRole && CASH_ROLES.includes(d.accountRole)
    if (bucket === 'card') return d.accountRole === 'Credit Card'
    // balanceSheet: same role if this account has one, else same category.
    return account.accountRole ? sameRole(d) : (d.accountType === account.accountType && !d.accountRole)
  }
  return open.filter(d => (under(d) && fits(d)) || sameRole(d)).sort(byNumber)
}

/** The summary a balance has to stay under when the account is archived. */
export function moveSummary(account: Account, accounts: Account[]): Account | undefined {
  return account.parentId ? accounts.find(a => a.id === account.parentId) : undefined
}

/** Whether archiving this account has to ask where its money goes first. Only
 *  the two buckets that both hold a balance and offer a move flow reach this
 *  point - a card is refused above until it reads zero, and equity and income
 *  statement accounts clear a different way. */
const needsBalanceMove = (action: LifecycleAction, a: Account) => {
  if (action !== 'archive' || heldBalance(a) === 0) return false
  const bucket = archiveBucketOf(a)
  return bucket === 'cash' || bucket === 'balanceSheet'
}

/**
 * Why the action is refused, in the reader's terms, or undefined if it may go
 * ahead. Only the two closing actions are ever refused: an account can be turned
 * back on at any time, whatever is around it.
 *
 * Both closing actions are one rule read at two depths - nothing goes before the
 * things depending on it. A posting account is held by its own live entries; a
 * summary account is held by the accounts under it.
 *
 * A held summary is *blocked*, never cascaded through. Switching off a dozen rows
 * on the reader's behalf is the kind of help nobody asks for twice, so the action
 * stops and says which way round to do it. The gate reads every descendant rather
 * than the immediate children, because with nothing cascading, an inactive child
 * can still have an active account of its own underneath it.
 */
function blockedReasonFor(action: LifecycleAction, account: Account, ctx: LifecycleCtx, index: ChartIndex) {
  if (action !== 'deactivate' && action !== 'archive') return undefined
  // Ahead of every other gate: this one is about the account, not about its
  // state, so no amount of dealing with what is around it will clear it.
  const system = systemHold(account, action, ctx.accounts)
  if (system) return system
  // Only a posting account holds entries, so it is the only type with that gate.
  if (account.glAccountType !== 'Summary') {
    if (ctx.hasOpenJEs(account.id)) return BLOCKED_UNPOSTED_WORK
    // What "still holds a balance" means depends on the bucket. For a card the
    // balance is what is owed and archiving is refused outright until the card
    // reads zero - overpaid is not zero either, said in the copy so the reader
    // knows why a credit balance is not the answer. For permanent equity there
    // is no move flow and the account has to reach zero through a journal
    // entry; for revenue and expense the year-end close is what clears them.
    // For the three buckets that do offer a move, the missing part is the
    // destination: cash cannot go anywhere but cash, and so on.
    if (action === 'archive' && heldBalance(account) !== 0) {
      const bucket = archiveBucketOf(account)
      // A base figure, stated in base, as the move dialog states it.
      const amount = fmtCurrencyExact(heldBalance(account), ctx.baseCurrency ?? account.currencyCode)
      if (bucket === 'card') return BLOCKED_CARD_NON_ZERO(amount)
      if (bucket === 'permanentEquity') return BLOCKED_EQUITY_NON_ZERO(amount)
      if (bucket === 'incomeStatement') return BLOCKED_INCOME_NON_ZERO(amount)
      if (!balanceDestinations(account, ctx.accounts).length) {
        const parent = moveSummary(account, ctx.accounts)
        const summary = parent ? describeAccount(parent) : 'its summary'
        if (bucket === 'cash' && account.accountRole) return BLOCKED_NOWHERE_TO_MOVE_CASH(account.accountRole, summary)
        return account.accountRole
          ? BLOCKED_NOWHERE_TO_MOVE_ROLE(account.accountRole)
          : BLOCKED_NOWHERE_TO_MOVE_CATEGORY(summary)
      }
    }
    return undefined
  }
  // Only a summary reaches here: a posting account has already returned.
  if (!holdUps(action, account, index).length) return undefined
  return action === 'deactivate' ? BLOCKED_ACTIVE_CHILDREN : BLOCKED_LIVE_CHILDREN
}

/** The accounts standing in the way, so a refusal can name them instead of
 *  leaving the reader to hunt down the branch for whatever is not ready. Empty
 *  for a posting account: what holds one is its own open entries, not accounts. */
function holdUps(action: LifecycleAction, account: Account, index: ChartIndex): Account[] {
  if (account.glAccountType !== 'Summary') return []
  const target = RANK[TARGET_STATUS[action]]
  return index.descendantsOf(account.id).filter(d => RANK[d.status] < target)
}

/* The deactivate dialog no longer states the pending-work rule. An account
   reaching it has already passed that gate, so the sentence told every reader
   their account had work on its way in when it had none. Module review,
   2026-10-06 (COA-21); Outline 09 - *"A reason specific to the account (#52)"*.
   The rule is said where it applies: `BLOCKED_UNPOSTED_WORK`, on the refusal. */

/* What stops working, in the reader's terms. Turning an Inactive account back
   on needs no explaining - it simply works again - so it carries no lines and
   no confirmation.

   Unarchive is asked, though. Mahad, 2026-09-30: *"Unarchive account has no
   confirmation. One click makes the account active again straight away."* An
   archived account is off the chart, so bringing one back puts a row on the
   chart and reopens it to postings - the same size of change archiving it was,
   and archiving is confirmed. A batch was already asked the same thing.

   The two closing actions are told apart by what happens to the money. Turning
   an account off leaves the balance where it is and goes on reporting it;
   archiving takes the account off the chart, which a balance cannot survive. An
   account still holding one does not reach these lines at all - it gets the
   move's own wording instead. */
function effectLines(action: LifecycleAction, account: Account): string[] {
  if (action === 'activate') return []
  const label = describeAccount(account)
  // Mahad's copy for archive and unarchive, 2026-10-09. A summary comes back on
  // its own: unarchiving writes only the account asked about.
  if (action === 'unarchive') {
    return [account.glAccountType === 'Posting'
      ? `${label} will be restored to your chart of accounts and reports, and can be used in transactions again.`
      : `${label} will be restored to your chart of accounts and reports. Accounts under it remain archived.`]
  }
  const gone = action === 'archive'
  const archived = `${label} will be archived and will no longer appear in your chart of accounts or reports. Its history is kept, and you can unarchive it anytime.`
  if (account.glAccountType === 'Posting') {
    return gone
      ? [archived]
      // Mahad's copy, 2026-10-08, with the action named as the menu names it:
      // Activate, since "reactivate" is retired (see the copy test's BANNED).
      : [`${label} will stop accepting new postings. It stays in your chart of accounts with its balance and history, and you can activate it again anytime.`]
  }
  return gone
    ? [archived]
    // Mahad's copy, 2026-10-09, with "reactivate" named as the menu names it,
    // the same as the posting line above.
    : [`${label} will no longer accept new accounts under it. It stays in your chart of accounts and on your reports, and you can activate it again anytime.`]
}

const VERB: Record<LifecycleAction, string> = {
  deactivate: 'Deactivate', activate: 'Activate', archive: 'Archive', unarchive: 'Unarchive',
}
const PAST: Record<LifecycleAction, string> = {
  deactivate: 'deactivated', activate: 'activated', archive: 'archived', unarchive: 'unarchived',
}

const MAX_NAMED = 8

/* Names, capped, so a wide branch does not turn a dialog into a list. What the
   cap leaves out is handed over rather than counted off: this dialog's whole job
   is telling the reader which accounts to go and deal with, so a bare "and 41
   more" is a dead end on the one screen that owes them those 41 names. */
const nameSome = (labels: string[]) => ({
  affected: labels.slice(0, MAX_NAMED),
  affectedRest: labels.slice(MAX_NAMED),
})

/* One account, one reason, in the same capped shape - so the box naming what
   stayed behaves like the box naming what moved. */
const reasonLines = (skipped: BulkPlan['skipped']) => skipped.map(s => `${s.label}: ${s.reason}`)
const stayedNames = (skipped: BulkPlan['skipped']) => ({
  stayed: reasonLines(skipped).slice(0, MAX_NAMED),
  stayedRest: reasonLines(skipped).slice(MAX_NAMED),
})

/* What the reader is agreeing to, once they have picked somewhere for the money
   to go. The destination is a choice made in the dialog rather than a fact about
   the chart, so this is asked for separately from the plan.

   It is a journal entry, and it is one for the reason every other balance move
   in the ledger is: the postings already made are what happened, and what
   happened does not change because an account is being closed today. Moving the
   money is a thing that happens now, so it gets an entry dated now, and the
   source's own history stays where it was posted. `postings` is what stays
   behind - the count is worth showing because a reader archiving an account
   wants to know its history survives it. */
export interface BalanceMoveImpact {
  amount: number
  currency: string
  /** Postings on the source, which stay under it and keep their dates. */
  postings: number
  rows: { account: Account; from: number; to: number; leaves: boolean }[]
}

export function balanceMoveImpact(
  move: BalanceMove,
  source: Account,
  dest: Account | undefined,
  postings: number,
): BalanceMoveImpact | undefined {
  // Nothing to describe until somewhere is picked, and a half-filled impact
  // would read as a claim about whichever account happens to be on offer.
  if (!dest) return undefined
  const destFrom = dest.balance || 0
  return {
    amount: move.amount,
    currency: move.currency,
    postings,
    rows: [
      { account: source, from: heldBalance(source), to: 0, leaves: true },
      { account: dest, from: destFrom, to: destFrom + move.amount, leaves: false },
    ],
  }
}

/* The entry that moves the money, as two lines: one that takes the source to
   zero and one that is its exact opposite on the destination. Opposite in
   debit/credit terms rather than in balance terms, because that is what makes
   the entry balance - the destination's own sign convention then decides which
   way its balance goes, exactly as it would for any entry a person typed.

   Which side zeroes the source is a question about the source, not about the
   amount: a contra account holds its balance on the side opposite its type, so
   asking `normalSideDelta` for the answer keeps this correct for the one kind
   of account where the obvious arithmetic is backwards. */
/* Its number is the next in the journal entry run, handed in by the caller that
   can read every number already issued. It used to be BT-<account>-<date>, which
   gave two archives of one account on one day the same number, and sorted ahead
   of every JE posted that day - so the register ran the transfer first and read
   the account back up to its old balance after it had been emptied.

   One name for what it is, on its type, its source and its memo alike, rather
   than borrowing Closing and Manual JE from entries it is neither of. */
export const ARCHIVE_TRANSFER = 'Archive transfer'

export function archiveTransferMemo(source: Pick<Account, 'accountNumber' | 'accountName'>): string {
  return `Balance moved from ${source.accountNumber} ${source.accountName} on archive`
}

export function buildBalanceTransferEntry(
  source: Account,
  dest: Account,
  nowIso: string,
  jeNumber: string,
  user: string,
): { entry: JournalEntry; transactions: Transaction[] } {
  const held = heldBalance(source)
  // The signed movement on the source's own side needed to leave it at zero.
  const ownSide = source.isContra ? held : -held
  const debitMinusCredit = source.normalBalance === 'Debit' ? ownSide : -ownSide
  const srcDebit = Math.max(debitMinusCredit, 0)
  const srcCredit = Math.max(-debitMinusCredit, 0)

  const date = todayIso(new Date(nowIso))
  const memo = archiveTransferMemo(source)
  const lines = [
    { accountId: source.id, debit: srcDebit, credit: srcCredit },
    { accountId: dest.id, debit: srcCredit, credit: srcDebit },
  ]
  const entry: JournalEntry = {
    id: uid('je'),
    date,
    reference: jeNumber,
    description: ARCHIVE_TRANSFER,
    status: 'Posted',
    lines,
  }
  const transactions: Transaction[] = lines.map(l => ({
    id: uid('tx'),
    accountId: l.accountId,
    date,
    source: ARCHIVE_TRANSFER,
    jeNumber,
    // No source document: the entry is its own record.
    reference: '',
    entryType: ARCHIVE_TRANSFER,
    // The line carries the memo too, because the ledger's Memo column reads the
    // line - so every surface names the move in the same words.
    description: memo,
    memo,
    createdAt: nowIso,
    createdBy: user,
    debit: l.debit,
    credit: l.credit,
    runningBalance: 0,
    dimensionValues: [],
    period: monthLabel(date),
  }))
  return { entry, transactions }
}

function monthLabel(date: string) {
  const [y, m] = date.split('-')
  return `${MONTH_ABBR[Number(m) - 1]} ${y}`
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Whether the refusal is the revenue-and-expense one, which the close clears. */
const waitsForClose = (action: LifecycleAction, account: Account, blockedReason: string) =>
  action === 'archive'
  && blockedReason === BLOCKED_INCOME_NON_ZERO(fmtCurrencyExact(heldBalance(account), account.currencyCode))

export function planLifecycle(
  action: LifecycleAction,
  account: Account,
  ctx: LifecycleCtx,
): LifecyclePlan {
  const index = buildChartIndex(ctx.accounts)
  const status = TARGET_STATUS[action]
  const blockedReason = blockedReasonFor(action, account, ctx, index)
  const menuLabel = `${VERB[action]} account`

  const label = describeAccount(account)
  const held = blockedReason ? holdUps(action, account, index) : []

  /* Money still on an account being archived. Read only when the action is
     going ahead: with nowhere to send it the action is already refused above,
     and offering an empty list of destinations would be asking a question that
     has no answer. */
  const move: BalanceMove | undefined = !blockedReason && needsBalanceMove(action, account)
    ? {
      amount: heldBalance(account),
      /* The balance is the base-currency figure the ledger holds, whatever the
         account's own currency, so it is stated in base. Read in a EUR account's
         symbol it would claim euros it is not. */
      currency: ctx.baseCurrency ?? account.currencyCode,
      destinations: balanceDestinations(account, ctx.accounts),
    }
    : undefined

  /* Mahad's copy, 2026-10-09: the rule and the amount. Only the balance moves -
     it posts as a new entry, and nothing already posted is rewritten (module
     review, 2026-10-06, COA-21); the GL impact panel below shows that entry. */
  const lines = move
    ? [
      `Archived accounts can't hold a balance. Transfer the ${fmtCurrencyExact(move.amount, move.currency)} to another account first.`,
    ]
    : effectLines(action, account)

  return {
    action, status, allowed: !blockedReason, blockedReason,
    refusal: !blockedReason ? undefined : {
      /* Revenue and expense wait on the year-end close, after which the
         archive goes ahead, so that one refusal says "yet" and is acknowledged
         (Mahad, 2026-10-08). The rest need the reader to act first. */
      ...(waitsForClose(action, account, blockedReason)
        ? { title: `Can't ${VERB[action].toLowerCase()} ${label} yet`, dismissLabel: 'Got it' }
        : { title: `Can't ${VERB[action].toLowerCase()} ${label}` }),
      description: [blockedReason],
      affectedTitle: held.length ? (action === 'archive' ? 'Still on the chart' : 'Still active') : undefined,
      ...(held.length ? nameSome(held.map(describeAccount)) : {}),
    },
    needsConfirm: lines.length > 0,
    targetIds: [account.id],
    balanceMove: move,
    confirm: lines.length === 0 ? undefined : {
      tone: action === 'archive' ? 'danger' : 'warning',
      title: move ? `${VERB[action]} ${label}?` : `${menuLabel}?`,
      description: lines,
      confirmLabel: move ? 'Move and archive' : menuLabel,
    },
    toast: `${label} ${PAST[action]}`,
    menuLabel,
  }
}

/* ──────── Delete ────────
 * The three closings, told apart once. Deactivate is a lock: the account stays on
 * the chart, stops taking new postings, and goes on reporting what it holds.
 * Archive is a removal: the account comes off the chart, which a balance cannot
 * survive, so it hands the money over on the way out and its history stays in the
 * ledger. Delete is neither - it is for the row that was a mistake, typed and then
 * found to be wrong before anything used it, so there is no history to keep and
 * nothing is kept.
 *
 * That makes delete the only one of the three with a precondition rather than a
 * consequence, and the only one that is not offered when it does not apply. A
 * greyed Delete on an account with a year of postings behind it is an invitation to
 * try; a Delete that is simply absent says the account has a past, and Archive
 * sitting above it says what to do about that instead.
 *
 * "Never posted to at all" is read four ways, because a figure can arrive four
 * ways: a posted transaction, an entry still waiting to post, a balance from any
 * source whatever, and - for a summary - an account underneath, which delete would
 * leave with no parent.
 */
const BLOCKED_DELETE_POSTED = 'This account has been posted to, so its history has to be kept. Archive it instead to take it off the chart.'
const BLOCKED_DELETE_OPEN_JES = 'Open journal entries reference this account. Post or void them first.'
const BLOCKED_DELETE_BALANCE = 'This account holds a balance, so its history has to be kept. Archive it instead, and say where the money goes.'
const BLOCKED_DELETE_CHILDREN = 'Accounts hang under this summary. Deleting it would leave them with no parent, so deal with those first.'

/** Why this account's own past rules delete out, or undefined if it does not. Pass
 *  `index` when one is already built; it is only read for a summary. */
function historyBlocksDelete(account: Account, ctx: LifecycleCtx, index?: ChartIndex): string | undefined {
  if (account.hasTransactions) return BLOCKED_DELETE_POSTED
  if (ctx.hasOpenJEs(account.id)) return BLOCKED_DELETE_OPEN_JES
  if (heldBalance(account) !== 0) return BLOCKED_DELETE_BALANCE
  if (account.glAccountType === 'Summary'
    && (index ?? buildChartIndex(ctx.accounts)).childrenOf(account.id).length) {
    return BLOCKED_DELETE_CHILDREN
  }
  return undefined
}

/**
 * Whether Delete belongs in the menu at all - the account's past only, deliberately
 * not the whole rule. Absence has to mean one thing, and here it means "this
 * account has a history", with Archive above it saying what to do instead.
 *
 * A system account is refused rather than hidden, which is why it is not read here.
 * Hiding it would say the account had a past, and a retained earnings account fresh
 * off a new tenant has none: the reason it cannot go is what it is for, and that is
 * something to be told rather than left to infer from a missing item.
 */
export const canDeleteAccount = (account: Account, ctx: LifecycleCtx, index?: ChartIndex) =>
  !historyBlocksDelete(account, ctx, index)

export interface DeletePlan {
  allowed: boolean
  blockedReason?: string
  /** Present exactly when the action is refused. */
  refusal?: RefusalSpec
  targetIds: string[]
  /** Always present: a true delete is never silent, however empty the account. */
  confirm: ConfirmSpec
  toast: string
  menuLabel: string
}

export function planDelete(account: Account, ctx: LifecycleCtx): DeletePlan {
  const blockedReason = systemHold(account, 'delete', ctx.accounts) ?? historyBlocksDelete(account, ctx)
  const label = describeAccount(account)
  return {
    allowed: !blockedReason,
    blockedReason,
    refusal: !blockedReason ? undefined : {
      title: `Can't delete ${label}`,
      description: [blockedReason],
    },
    targetIds: [account.id],
    confirm: {
      tone: 'danger',
      title: `Delete ${label}?`,
      // Said plainly, because this is the one action with nothing to fall back on.
      // The reader who wanted the softer thing is pointed at it by name.
      description: [
        'The account is removed from the chart and no record of it is kept. This cannot be undone.',
        'Nothing has posted to it, so there is no history to lose. To keep an account and its history, deactivate or archive it instead.',
      ],
      confirmLabel: 'Delete account',
    },
    toast: `${label} deleted`,
    menuLabel: 'Delete account',
  }
}

export function planBulk(action: LifecycleAction, ids: string[], ctx: LifecycleCtx): BulkPlan {
  const status = TARGET_STATUS[action]
  const byId = new Map(ctx.accounts.map(a => [a.id, a]))
  const selected = new Set(ids)

  // A summary is held by the accounts under it, and a selection that includes both
  // is the reader dealing with them - in one action rather than two rounds of
  // clicking, but in the right order all the same. So each account is judged
  // against where the chart lands once the batch has run, not against where it
  // stands now, or ticking a whole branch would refuse every summary in it.
  //
  // Only a posting account held by its own open entries is left where it is: the
  // batch cannot clear those. Being optimistic about the rest is safe because the
  // gate reads every descendant, so a summary still held by something unselected
  // holds up its parents too, exactly as it would one at a time.
  /* An account holding money is stuck here too, though on its own it would be
     allowed. Where the balance goes is a question only the reader can answer,
     and a batch has nowhere to ask it, so the account stays put and says why
     rather than leaving the chart with its money unaccounted for. */
  const stuck = new Set(ids.filter(id => {
    const a = byId.get(id)
    if (!a || a.glAccountType === 'Summary') return false
    const p = planLifecycle(action, a, ctx)
    return !p.allowed || !!p.balanceMove
  }))
  const batchCtx: LifecycleCtx = {
    ...ctx,
    accounts: ctx.accounts.map(a =>
      selected.has(a.id) && !stuck.has(a.id) && RANK[a.status] < RANK[status] ? { ...a, status } : a),
  }

  const targets = new Set<string>()
  const affected: string[] = []
  const skipped: BulkPlan['skipped'] = []

  for (const id of ids) {
    const account = byId.get(id)
    if (!account) continue
    const plan = planLifecycle(action, account, batchCtx)
    if (!plan.allowed) {
      skipped.push({ id, label: describeAccount(account), reason: plan.blockedReason! })
      continue
    }
    if (plan.balanceMove) {
      skipped.push({ id, label: describeAccount(account), reason: SKIPPED_HOLDS_BALANCE })
      continue
    }
    for (const t of plan.targetIds) {
      if (targets.has(t)) continue
      targets.add(t)
      const acct = byId.get(t)
      if (acct) affected.push(describeAccount(acct))
    }
  }

  const n = targets.size
  const named = nameSome(affected)

  const toast = n === 0
    ? skipped.length > 0
      ? `Nothing ${PAST[action]}. ${plural(skipped.length, 'account is', 'accounts are')} not ready.`
      : `Nothing to ${action}.`
    : `${plural(n, 'account', 'accounts')} ${PAST[action]}${skipped.length > 0 ? `, ${skipped.length} skipped` : ''}`

  return {
    action, status,
    targetIds: [...targets],
    affected,
    skipped,
    needsConfirm: n > 0,
    confirm: n === 0 ? undefined : {
      tone: action === 'archive' ? 'danger' : 'warning',
      title: `${VERB[action]} ${plural(n, 'account', 'accounts')}?`,
      description: [
        action === 'archive'
          ? 'These accounts leave the chart. Their history stays in the ledger.'
          : action === 'deactivate'
            ? 'These accounts stop accepting new postings. Their history stays in the ledger.'
            : 'These accounts return to the chart and accept postings again.',
        ...(skipped.length > 0 ? [`${plural(skipped.length, 'account stays where it is', 'accounts stay where they are')}, named below.`] : []),
      ],
      affectedTitle: 'Accounts affected',
      ...named,
      ...(skipped.length > 0 ? {
        stayedTitle: 'Why each one stayed',
        ...stayedNames(skipped),
      } : {}),
      confirmLabel: `${VERB[action]} ${plural(n, 'account', 'accounts')}`,
    },
    // Nothing could move, but the reader did select something, so the answer is
    // owed to them in the same place they asked. Each account carries its own
    // reason: a batch is refused one account at a time, and which ones stayed is
    // the whole of what the reader needs to know.
    refusal: n > 0 || skipped.length === 0 ? undefined : {
      title: `Can't ${VERB[action].toLowerCase()} ${plural(skipped.length, 'account', 'accounts')}`,
      description: [`${skipped.length === 1 ? 'The account below stays where it is, for the reason given beside it.' : 'The accounts below stay where they are, each for the reason given beside it.'}`],
      affectedTitle: 'Why each one stayed',
      ...nameSome(reasonLines(skipped)),
    },
    toast,
  }
}
