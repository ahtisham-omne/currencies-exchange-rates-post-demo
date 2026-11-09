// =========================
// Adjustment accounts — where an entry goes when the sealed account cannot take
// it.
//
// A control account's balance is owned by its subledger, so hand-typing into it
// breaks the promise that the total always matches its detailed list. But some
// entries belong to no customer, vendor or item at all: the slice of
// receivables you never expect to collect, or a leftover balance from migrating
// off an old system. Those go next door instead - into an ordinary posting
// account that sits beside the sealed one under the same summary, stays visible
// and named, and is the one place a hand entry is allowed.
//
// Nothing here is a new account type or a new flag on Account. An adjustment
// account is a posting account with no control role (which is already what
// makes it postable) carrying the Adjustment dimension, whose value names the sealed
// account it stands beside.
//
// Not to be confused with an offset account: "offset" is the customer-and-
// vendor netting feature and means something else entirely.
// =========================
import type { Account, AccountDraft, NumberingScheme, Dimension } from '../types'
import { accountSegmentValue, compareAccountNumbers, formatInScheme, isControlAccountRole } from '../types'
import { todayIso } from './utils'

/* The dimension that marks an account as an adjustment. A dimension rather than a field on
   Account because the target is a report cut like any other: "show me every
   adjustment sitting beside Accounts Receivable" is the question this exists to
   answer, and dimensions are the only thing that can answer it. */
export const ADJUSTMENT_DIMENSION_NAME = 'Adjustment'

export const ADJUSTMENT_WHY =
  'Some entries belong to no customer, vendor or item. They cannot go into the sealed account, because hand-typing into it would put the general ledger out of step with the list that is the actual record. They go here instead: an ordinary posting account beside the sealed one, under the same summary account.'

/* The user's own question, with "group" swapped for the word this product uses
   for the same thing. It sets the normal balance and is never asked as
   "normal balance", because nobody creating an allowance is thinking in sides. */
export const ADJUSTMENT_REDUCE_QUESTION = 'Will this account reduce the total, like an allowance?'
export const ADJUSTMENT_REDUCE_HINT =
  'An allowance sits against what it reduces, so it carries the opposite normal balance. Leave this off for an adjustment that adds.'

export const ADJUSTMENT_ACCEPTS_ENTRIES =
  'Accepts hand-typed entries. The sealed account beside it never does, and that is the whole point of this one.'

export const ADJUSTMENT_TARGET_LABEL = 'Sits beside'
export const ADJUSTMENT_TARGET_HINT =
  'The sealed account this one stands in for. It is recorded on every posting, so a report can put the two back together.'
export const ADJUSTMENT_TARGET_REQUIRED = 'Pick the account this one sits beside.'

// What the account is called, before the user renames it.
export interface AdjustmentDraft {
  targetId: string
  accountName: string
  accountNumber: string
  /* Whether the account reduces the total it sits under. Stored as `isContra`,
     which is what the normal balance derives from. */
  reducesTotal: boolean
  description?: string
}

/**
 * The sealed accounts an adjustment can be created beside: the posting accounts
 * whose balance a subledger owns. A summary is not a candidate (nothing posts
 * to it), and neither is an ordinary posting account (it takes hand entries
 * already, so it needs no neighbour).
 */
export function adjustmentTargets(accounts: Account[]): Account[] {
  return accounts
    .filter(a => a.isPosting && a.status !== 'Archived' && isControlAccountRole(a.accountRole))
    .sort((a, b) => compareAccountNumbers(a.accountNumber, b.accountNumber))
}

// How a target reads in the dimension's value list and in the picker.
export const adjustmentDimensionValue = (target: Pick<Account, 'accountNumber' | 'accountName'>): string =>
  `${target.accountNumber} ${target.accountName}`.trim()

/**
 * The Adjustment dimension as it needs to exist for `target`: the dimension already in the
 * chart with the target's value added when it is missing, or a fresh dimension when
 * there is none yet. Returned rather than written so the caller decides between
 * addDimension and updateDimension.
 */
export function adjustmentDimensionFor(
  dimensions: Dimension[],
  target: Pick<Account, 'accountNumber' | 'accountName'>,
): { dimension: Dimension | null; values: string[]; value: string } {
  const value = adjustmentDimensionValue(target)
  const dimension = dimensions.find(t => t.name.trim().toLowerCase() === ADJUSTMENT_DIMENSION_NAME.toLowerCase()) ?? null
  const values = dimension?.values.includes(value) ? dimension.values : [...(dimension?.values ?? []), value]
  return { dimension, values, value }
}

/**
 * The name and number to open the form with. The number is the first free one
 * after the target, shaped like the customer's own numbers - for a glued chart
 * (100-2000-200) only the account segment moves, and the rest is copied from the
 * target.
 *
 * A run of taken numbers is walked past rather than given up on. Nothing bounds
 * the walk but the step limit, since the summary it lands under reserves no block
 * for the suggestion to fall outside of.
 */
export function suggestAdjustment(
  target: Account,
  accounts: Account[],
  scheme: NumberingScheme,
): { accountName: string; accountNumber: string } {
  const accountName = `${target.accountName} adjustment`
  const taken = new Set(accounts.map(a => a.accountNumber))
  const base = accountSegmentValue(scheme, target.accountNumber)
  if (!Number.isFinite(base)) return { accountName, accountNumber: '' }

  for (let step = 1; step <= 200; step++) {
    const candidate = formatInScheme(scheme, base + step, target.accountNumber)
    if (taken.has(candidate)) continue
    return { accountName, accountNumber: candidate }
  }
  return { accountName, accountNumber: '' }
}

/**
 * What is missing before the account can be saved, keyed by field. The target is
 * the one that is genuinely new: without it the account is an ordinary posting
 * account with a dimension that points at nothing, so it is required here rather than
 * offered as a nicety. Number collisions and range warnings are left to the
 * chart-wide validator, which already owns them.
 */
export function validateAdjustment(draft: AdjustmentDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!draft.targetId) errors.targetId = ADJUSTMENT_TARGET_REQUIRED
  if (!draft.accountName.trim()) errors.accountName = 'Enter a GL account name.'
  if (!draft.accountNumber.trim()) errors.accountNumber = 'Enter a GL account number.'
  return errors
}

/**
 * The account to create, derived from the target wherever it can be: the
 * category and the summary it sits under are the target's, so the two end up
 * side by side and the sealed one is left untouched. `accountRole` is
 * deliberately absent - a control role is exactly what would seal this account
 * shut, and an adjustment account exists to be open.
 *
 * `normalBalance` is not set here: buildAccount derives it from the category and
 * `isContra`, which is what the reduce-the-total question answers.
 */
export function buildAdjustmentInput(
  draft: AdjustmentDraft,
  target: Account,
  dimensionId: string,
  dimensionValue: string,
): AccountDraft {
  return {
    accountNumber: draft.accountNumber.trim(),
    accountName: draft.accountName.trim(),
    accountType: target.accountType,
    glAccountType: 'Posting',
    statementClassification: target.statementClassification,
    parentId: target.parentId,
    isPosting: true,
    currencyCode: target.currencyCode,
    status: 'Active',
    effectiveDate: todayIso(),
    postingRestrictions: {},
    defaultDimensionValues: [{ dimensionId, value: dimensionValue }],
    description: draft.description?.trim() || undefined,
    isContra: draft.reducesTotal,
    balance: 0,
    hasTransactions: false,
  }
}
