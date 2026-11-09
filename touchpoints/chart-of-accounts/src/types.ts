// =========================
// Account Category, the top-level GAAP bucket (spec: "Account Category").
// Exactly five fixed categories - Assets, Liabilities, Equity, Revenue,
// Expenses. Determines statement placement and the default normal balance. It
// does not determine the number: a category owns no band of numbers, and an
// account may be numbered anything the customer likes. (Statistical was removed
// in the Fields-spec remodel.)
// `AccountType` is retained as a backwards-compatible alias of AccountCategory.
// =========================
export type AccountCategory = 'AST' | 'LIA' | 'EQT' | 'REV' | 'EXP'
export type AccountType = AccountCategory

export const CATEGORY_ORDER: AccountCategory[] = ['AST', 'LIA', 'EQT', 'REV', 'EXP']

export const ACCOUNT_TYPE_META: Record<AccountCategory, {
  code: AccountCategory
  label: string
  normal: 'Debit' | 'Credit' | 'n/a'
  color: 'success' | 'warning' | 'info' | 'brand' | 'danger' | 'neutral' | 'purple' | 'teal'
  // Statement the category lands on (spec: "Statement placement" derived chip).
  statement: 'Balance Sheet' | 'Income Statement'
  notes: string
}> = {
  AST:  { code: 'AST',  label: 'Asset',     normal: 'Debit',  color: 'purple',  statement: 'Balance Sheet',    notes: 'What your business owns: cash, bank accounts, receivables, and property.' },
  LIA:  { code: 'LIA',  label: 'Liability', normal: 'Credit', color: 'warning', statement: 'Balance Sheet',    notes: 'What your business owes: payables, accrued costs, and loans.' },
  EQT:  { code: 'EQT',  label: 'Equity',    normal: 'Credit', color: 'info',    statement: 'Balance Sheet',    notes: "The owners' stake in the business, after liabilities are paid." },
  REV:  { code: 'REV',  label: 'Revenue',   normal: 'Credit', color: 'success', statement: 'Income Statement', notes: 'Income your business earns from sales and operations.' },
  EXP:  { code: 'EXP',  label: 'Expense',   normal: 'Debit',  color: 'danger',  statement: 'Income Statement', notes: 'The cost of running the business, including cost of goods sold.' },
}

// The category metadata keyed for the "Account Category" picker (spec Step 1).
export const CATEGORY_META = ACCOUNT_TYPE_META

/* How wide a suggested account number is written when nobody has said
   otherwise. Answered in the numbering step and carried on the scheme's account
   segment thereafter; this is only the figure that step opens on, and the one
   any code holding a scheme with no segments falls back to. */
export const DEFAULT_NUMBER_WIDTH = 5

/* The digit a category's numbers open on: assets are the 1s, liabilities the
   2s, and so on down. The convention every chart of accounts already uses, and
   the only part of a first number that carries meaning. */
export const CATEGORY_FIRST_DIGIT: Record<AccountCategory, number> = {
  AST: 1,
  LIA: 2,
  EQT: 3,
  REV: 4,
  EXP: 5,
}

/* Where a category's numbers start when there is nothing else to go on, written
   at the chart's own width. A chart Omne builds (guided setup, build from
   scratch) opens each category here and reserves its whole block from here by
   default - see lib/numberRange.ts - but the reservation is a default on the
   category's summary, not a rule about numbers: a customer's own chart may be
   numbered anything at all. This exists because a brand new chart has no
   accounts to count from, so the first asset has to be offered something.

   The zeros go on the right, so a wider chart opens assets at 10000 rather than
   at 01000. They are the room the category counts up through, and a leading
   zero is not room: it would put five digits on the page and leave the same
   thousand numbers underneath them. */
export function categoryFirstNumber(category: AccountCategory, width: number): number {
  return CATEGORY_FIRST_DIGIT[category] * 10 ** (Math.max(1, width) - 1)
}

// =========================
// Statement classification, the line a figure prints on once it reaches a
// statement. It sits between the category and the role: the category says which
// statement, the classification says where on it, and the role (optional, and
// only on postings) says what job the account does.
//
// Answered second, immediately after the category, because it narrows the role
// list. Required on every account, summaries included - a summary that totals
// current assets prints among the current assets, so it has to say so.
//
// It carries no number range, and an account's number has no bearing on it.
// Replaces the earlier `AccountSection`, which held ten values and lumped all
// of equity into one: equity now splits three ways, because contributed capital,
// retained earnings and distributions are three different lines on the
// statement, and income tax expense leaves the general operating pile.
// =========================
export type StatementClassification =
  // Balance sheet - assets
  | 'Current asset'
  | 'Non-current asset'
  // Balance sheet - liabilities
  | 'Current liability'
  | 'Non-current liability'
  // Balance sheet - equity
  | 'Contributed capital'
  | 'Retained earnings'
  | 'Distributions'
  // Income statement - revenue
  | 'Operating revenue'
  | 'Other income'
  // Income statement - expense
  | 'Cost of goods sold'
  | 'Operating expense'
  | 'Other expense'
  | 'Income tax expense'

// The classifications allowed inside each category, in the order they print on
// the statement. This is what scopes the classification picker once a category
// has been chosen.
export const CLASSIFICATIONS_BY_CATEGORY: Record<AccountCategory, StatementClassification[]> = {
  AST: ['Current asset', 'Non-current asset'],
  LIA: ['Current liability', 'Non-current liability'],
  EQT: ['Contributed capital', 'Retained earnings', 'Distributions'],
  REV: ['Operating revenue', 'Other income'],
  EXP: ['Cost of goods sold', 'Operating expense', 'Other expense', 'Income tax expense'],
}

/* Which classification a category falls into when the category is all anyone
   has said. Not the same question as presentation order: cost of sales prints
   above operating expenses, so it leads the Expenses list, but it is the
   narrower of the two and most expenses are not cost of sales. Reading the
   list's first entry as the default filed every imported expense under cost of
   sales. */
export const DEFAULT_CLASSIFICATION_BY_CATEGORY: Record<AccountCategory, StatementClassification> = {
  AST: 'Current asset',
  LIA: 'Current liability',
  EQT: 'Contributed capital',
  REV: 'Operating revenue',
  EXP: 'Operating expense',
}

// All classifications in canonical (category-then-statement-order) order.
export const ALL_CLASSIFICATIONS: StatementClassification[] = CATEGORY_ORDER
  .flatMap(c => CLASSIFICATIONS_BY_CATEGORY[c])

// The category a classification belongs to (reverse of CLASSIFICATIONS_BY_CATEGORY).
export const CATEGORY_OF_CLASSIFICATION: Record<StatementClassification, AccountCategory> = (() => {
  const out = {} as Record<StatementClassification, AccountCategory>
  CATEGORY_ORDER.forEach(c => CLASSIFICATIONS_BY_CATEGORY[c].forEach(s => { out[s] = c }))
  return out
})()

/* One line per classification, shown beside it in the picker. Written for
   someone who knows their own business but not the statement, so each says what
   lands there rather than restating the term.

   Mahad, 2026-09-23: *"Current doesn't just mean within 12 months. It also
   includes things like inventory and receivables that are part of the normal
   business cycle, even if that cycle is longer than a year."* The four
   current/non-current lines said only the year, which files a distiller's or a
   shipbuilder's inventory as non-current. The test is the year or the operating
   cycle, whichever runs longer, and each line has to carry it on its own: these
   are read one at a time in the listing tooltip and the detail rail, not only as
   a pair in the picker. */
export const CLASSIFICATION_DESCRIPTIONS: Record<StatementClassification, string> = {
  'Current asset': 'Turns into cash within a year, or within the operating cycle if that runs longer: bank accounts, receivables, inventory, prepaid costs.',
  'Non-current asset': 'Held beyond a year and beyond the operating cycle: property, equipment, vehicles, intangibles, deposits.',
  'Current liability': 'Falls due within a year, or within the operating cycle if that runs longer: payables, accruals, cards, short-term loans, tax owed.',
  'Non-current liability': 'Falls due beyond a year and beyond the operating cycle: term loans, mortgages, deferred tax.',
  'Contributed capital': 'What owners put in: common and preferred stock, paid-in capital, owner capital.',
  'Retained earnings': 'Earnings kept in the business, added to by the year end close.',
  'Distributions': 'What owners take out: draws, distributions, dividends, treasury stock.',
  'Operating revenue': 'Income from what the business actually does: product and service sales.',
  'Other income': 'Income from outside operations: interest, rent, gains on disposal.',
  'Cost of goods sold': 'The direct cost of what was sold: materials, direct labour, production cost.',
  'Operating expense': 'The cost of running the business: payroll, rent, utilities, software, marketing.',
  'Other expense': 'Cost from outside operations: interest, penalties, losses on disposal.',
  'Income tax expense': 'Tax on profit, kept apart so the statement can subtotal pre-tax income.',
}

/* The five accounts that head each category. They are the one place a
   classification is not asked for: a category root totals everything in its
   category, and assets span current and non-current, so any single value on the
   root would be a statement line that lies. Everywhere else the field is
   required.

   These are also the rows that can never be archived, and the rows whose
   classification a child is never flagged against - see
   `classificationOverride`. */
export function isCategoryRoot(a: Pick<Account, 'parentId' | 'glAccountType'>): boolean {
  return a.parentId === null && a.glAccountType === 'Summary'
}

/* What the classification field reads on a category root, in place of a value.
   A root spans its category, so it names the span rather than picking a side. */
export const CLASSIFICATION_SPANS_CATEGORY: Record<AccountCategory, string> = {
  AST: 'Spans current and non-current assets',
  LIA: 'Spans current and non-current liabilities',
  EQT: 'Spans all equity classifications',
  REV: 'Spans operating revenue and other income',
  EXP: 'Spans all expense classifications',
}

/* Whether a child's classification overrides its parent's. Decision 3: the
   statement section defaults from the parent, and an override is allowed but
   flagged - the chart marks it, nothing refuses it (module review, 2026-10-06,
   COA-13).

   The category roots span by nature, so nothing under one is an override.
   Below a root, any difference is. */
export function classificationOverride(
  parent: Pick<Account, 'parentId' | 'glAccountType' | 'statementClassification'> | null | undefined,
  childClassification: StatementClassification,
): boolean {
  if (!parent) return false
  if (isCategoryRoot(parent)) return false
  return parent.statementClassification !== childClassification
}

export type AccountStatus = 'Active' | 'Inactive' | 'Archived'

// =========================
// GL account type, the structural role an account plays in the chart (distinct
// from the financial nature in AccountType above - Asset/Liability/…).
//
// There are two, and the difference between them is the whole structure of the
// chart:
//   Posting - a leaf. Transactions post to it and it holds their balance.
//   Summary - a parent. Nothing posts to it; its amount is the live sum of the
//             accounts beneath it. It reserves no numbers: what it totals is
//             whatever names it as a parent. Its children all share its
//             category.
//
// Both have an account number, so the rule a reader learns on day one is that
// every row in the chart is a real account.
//
// Hierarchy is declared, through Account.parentId - never inferred from where a
// number happens to fall.
// =========================
export type GLAccountType = 'Posting' | 'Summary'

export const GL_ACCOUNT_TYPES: GLAccountType[] = ['Posting', 'Summary']

// Both types are offered when creating an account: neither is system-generated.
export const SELECTABLE_GL_ACCOUNT_TYPES: GLAccountType[] = ['Posting', 'Summary']

// =========================
// Account Role, the recognized identity that lets other modules and reports know
// what an account is for - receivables show in AR views, bank accounts get
// reconciliation, inventory is tracked correctly.
//
// Distinct from both AccountCategory (the GAAP bucket) and GLAccountType (the
// structural role in the chart). A role only CLASSIFIES: it never decides where a
// transaction posts, so the same role may sit on more than one account and each
// transaction still names the specific account it uses.
//
// Roles apply to Posting accounts only - a Summary receives no transactions of
// its own, so it never carries one. Blank is valid and normal: an unclassified
// line behaves as an ordinary account.
// =========================
export type AccountRole =
  // Asset
  | 'Accounts Receivable'
  | 'Inventory'
  | 'Bank'
  | 'Cash on Hand'
  | 'Vendor Prepayments'
  | 'Payments to Deposit'
  // Liability
  | 'Accounts Payable'
  | 'Credit Card'
  | 'AP Accrual'
  | 'Customer Deposits'
  | 'Sales Tax Payable'
  // Equity
  | 'Opening Balance Equity'
  | 'Retained Earnings'
  | 'Retained Earnings Adjustments'
  | 'Current Year Earnings'
  // Revenue
  | 'Sales Revenue'
  | 'Exchange Gain'
  // Expense
  | 'Cost of Goods Sold'
  | 'Exchange Loss'

// The roles offered under each Account Category. A role is only meaningful inside
// its own category, so the picker is scoped by the category chosen first.
export const ROLES_BY_CATEGORY: Record<AccountCategory, AccountRole[]> = {
  AST: ['Accounts Receivable', 'Inventory', 'Bank', 'Cash on Hand', 'Vendor Prepayments', 'Payments to Deposit'],
  LIA: ['Accounts Payable', 'Credit Card', 'AP Accrual', 'Customer Deposits', 'Sales Tax Payable'],
  EQT: ['Opening Balance Equity', 'Retained Earnings', 'Retained Earnings Adjustments', 'Current Year Earnings'],
  REV: ['Sales Revenue', 'Exchange Gain'],
  EXP: ['Cost of Goods Sold', 'Exchange Loss'],
}

// Roles the picker never offers, but that stay in the type system so accounts
// already carrying them keep working. Sales Tax Payable is set up for you by the
// tax module against a specific tax code, so hand-picking it on a new account
// would produce a payable nothing remits. Current Year Earnings is the account
// the chart adds for itself (lib/currentYearEarnings), one per chart.
export const UNOFFERED_ROLES: AccountRole[] = ['Sales Tax Payable', 'Current Year Earnings']

export const ALL_ACCOUNT_ROLES: AccountRole[] = CATEGORY_ORDER.flatMap(c => ROLES_BY_CATEGORY[c])

// Roles exactly one account in the whole chart may hold. Every other role can be
// worn by as many accounts as the business has of that thing, one Bank role per
// bank account; these name a single place the books close into, and the one
// place a correction to what the close worked out is kept.
export const SOLE_ROLES: AccountRole[] = ['Retained Earnings', 'Retained Earnings Adjustments', 'Opening Balance Equity', 'Current Year Earnings']

// One line per role, shown beside it in the picker and on the account detail page.
export const ACCOUNT_ROLE_DESCRIPTIONS: Record<AccountRole, string> = {
  'Accounts Receivable': 'Tracks amounts owed by customers.',
  'Inventory': 'Tracks the value of inventory on hand.',
  'Bank': 'Tracks balances held in bank accounts.',
  'Cash on Hand': 'Tracks physical cash held by the business.',
  'Vendor Prepayments': 'Tracks payments made to vendors in advance.',
  'Payments to Deposit': 'Holds received payments until they are deposited.',
  'Accounts Payable': 'Tracks amounts owed to vendors.',
  'Credit Card': 'Tracks business credit card balances and activity.',
  'AP Accrual': 'Tracks accrued expenses before invoicing.',
  'Customer Deposits': 'Tracks customer payments received in advance.',
  'Sales Tax Payable': 'Tracks sales tax collected and owed to the tax authority.',
  'Opening Balance Equity': 'Stores opening balances during setup or migration.',
  'Retained Earnings': 'Tracks accumulated profits and losses, as the year-end close works them out.',
  'Retained Earnings Adjustments': 'Holds corrections to retained earnings made by hand, each with a written reason.',
  'Current Year Earnings': 'Tracks this fiscal year\'s revenue less expenses. At the year-end close it moves into retained earnings.',
  'Sales Revenue': 'Tracks income from sales.',
  'Exchange Gain': 'Tracks gains from currency exchange rate changes.',
  'Cost of Goods Sold': 'Tracks the direct cost of goods sold.',
  'Exchange Loss': 'Tracks losses from currency exchange rate changes.',
}

// The kind of balance the role actually holds, shown beside the description so
// someone who does not know the accounting term can still recognize their own
// account in the list.
export const ACCOUNT_ROLE_EXAMPLES: Record<AccountRole, string> = {
  'Accounts Receivable': 'Example: Outstanding customer balances.',
  'Inventory': 'Example: Raw materials or finished goods.',
  'Bank': 'Example: Business checking or savings accounts.',
  'Cash on Hand': 'Example: Petty cash or cash registers.',
  'Vendor Prepayments': 'Example: Vendor deposits or prepayments.',
  'Payments to Deposit': 'Example: Customer payments awaiting deposit.',
  'Accounts Payable': 'Example: Outstanding vendor balances.',
  'Credit Card': 'Example: Company credit cards.',
  'AP Accrual': 'Example: Expenses awaiting a vendor bill.',
  'Customer Deposits': 'Example: Advance customer payments.',
  'Sales Tax Payable': 'Example: Sales tax awaiting remittance.',
  'Opening Balance Equity': 'Example: Initial account balances.',
  'Retained Earnings': 'Example: Earnings kept in the business, posted at year end close.',
  'Retained Earnings Adjustments': 'Example: Fixing an expense a closed year never recorded.',
  'Current Year Earnings': 'Example: The profit made so far this year.',
  'Sales Revenue': 'Example: Product or service revenue.',
  'Exchange Gain': 'Example: Favorable exchange rate differences.',
  'Cost of Goods Sold': 'Example: Materials or production costs.',
  'Exchange Loss': 'Example: Unfavorable exchange rate differences.',
}

// The category a role belongs to, the reverse of ROLES_BY_CATEGORY.
export const CATEGORY_OF_ROLE: Record<AccountRole, AccountCategory> = (() => {
  const out = {} as Record<AccountRole, AccountCategory>
  CATEGORY_ORDER.forEach(c => ROLES_BY_CATEGORY[c].forEach(r => { out[r] = c }))
  return out
})()

// The normal balance every account of a role carries. A role sits in exactly one
// category and the category fixes the side, so the side is a property of the role
// rather than something to set per account. This is why the Normal balance field
// locks once a role is chosen: two accounts with the same role must agree, or the
// modules that consume the role would read them as opposites.
export function normalBalanceForRole(role: AccountRole): 'Debit' | 'Credit' {
  return ACCOUNT_TYPE_META[CATEGORY_OF_ROLE[role]].normal as 'Debit' | 'Credit'
}

/* Which statement classifications a role can sit on. Nearly every role names one
   and only one: receivables are a current asset and nothing else, so picking the
   role settles the classification and the picker stops asking.

   Three roles genuinely span, and each for its own reason:
     Bank          - a certificate of deposit maturing beyond a year is a
                     non-current asset while still being a bank account.
     Exchange Gain - a business whose trade is currency puts the gain in
                     operating revenue; everyone else puts it in other income.
     Exchange Loss - the same argument on the expense side.

   Read the other direction, this is also what filters the role list once a
   classification is chosen: see `rolesForClassification`. */
export const CLASSIFICATIONS_FOR_ROLE: Record<AccountRole, StatementClassification[]> = {
  'Accounts Receivable': ['Current asset'],
  'Inventory': ['Current asset'],
  'Bank': ['Current asset', 'Non-current asset'],
  'Cash on Hand': ['Current asset'],
  'Vendor Prepayments': ['Current asset'],
  'Payments to Deposit': ['Current asset'],
  'Accounts Payable': ['Current liability'],
  'Credit Card': ['Current liability'],
  'AP Accrual': ['Current liability'],
  'Customer Deposits': ['Current liability'],
  'Sales Tax Payable': ['Current liability'],
  'Opening Balance Equity': ['Contributed capital'],
  'Retained Earnings': ['Retained earnings'],
  'Retained Earnings Adjustments': ['Retained earnings'],
  'Current Year Earnings': ['Retained earnings'],
  'Sales Revenue': ['Operating revenue'],
  'Exchange Gain': ['Operating revenue', 'Other income'],
  'Cost of Goods Sold': ['Cost of goods sold'],
  'Exchange Loss': ['Operating expense', 'Other expense'],
}

/* The classification a role settles on its own, or undefined when the role
   spans and the reader has to say which. Used to derive the classification an
   import never stated: given a role, this is the answer the file implied. */
export function classificationForRole(role: AccountRole): StatementClassification | undefined {
  const allowed = CLASSIFICATIONS_FOR_ROLE[role]
  return allowed.length === 1 ? allowed[0] : undefined
}

/* The roles a picker should offer once a classification has been chosen. This is
   the third question narrowed by the second: a reader who has said "non-current
   asset" is not offered receivables, because a receivable is never one.

   `keep` forces a role to stay in the list even when it would otherwise be
   filtered out, so editing an account that already carries one never silently
   drops it. */
export function rolesForClassification(
  classification: StatementClassification,
  opts: { keep?: AccountRole | '' } = {},
): AccountRole[] {
  const category = CATEGORY_OF_CLASSIFICATION[classification]
  return ROLES_BY_CATEGORY[category].filter(r =>
    r === opts.keep
    || (!UNOFFERED_ROLES.includes(r) && CLASSIFICATIONS_FOR_ROLE[r].includes(classification)),
  )
}

/* The role a classification names outright, if there is one. Two of the thirteen
   classifications are the same words as a role - retained earnings and cost of
   goods sold - and there, saying which line the account prints on has already
   said what the account is. A picker can fill the role in rather than ask the
   same question a second time.

   Matched on the words rather than from a hand-kept pair list, so a role added
   later that names its own statement line is picked up without anyone having to
   remember this function exists. Deliberately not "the classification offers
   exactly one role": non-current asset offers only Bank, and most non-current
   assets are not bank accounts. */
export function roleNamedByClassification(classification: StatementClassification): AccountRole | undefined {
  return rolesForClassification(classification)
    .find(r => r.toLowerCase() === classification.toLowerCase())
}

// Bank and Credit Card are the two roles Cash Management reconciles against, and
// they are what unlock the bank-details block. This is the single source of truth
// for "is this a bank account" - do not reintroduce a separate boolean flag.
export function roleIsReconcilable(role: AccountRole | undefined | ''): boolean {
  return role === 'Bank' || role === 'Credit Card'
}

/* A bank or credit card account whose bank details are still missing. No import
   template carries an issuer or an account number, so every one of these arrives
   unfinished and has to be told apart from a bank account somebody filled in.

   The fields checked are exactly the ones the Create GL account form refuses to
   move past - issuer for a card, bank name and account number for a bank - so the
   chart cannot call an account unfinished that the form would call complete, or
   the other way round. */
export function needsBankDetails(a: Pick<Account, 'accountRole' | 'bankName' | 'bankAccountNumber'>): boolean {
  if (!roleIsReconcilable(a.accountRole)) return false
  if (!a.bankName?.trim()) return true
  return a.accountRole === 'Bank' && !a.bankAccountNumber?.trim()
}

// The roles that carry a balance in a currency of their own, and so the only ones
// that can be denominated in anything other than the base currency. Cross-cuts
// roleIsReconcilable rather than nesting inside it: cash on hand has no statement
// to reconcile against but still holds a currency. Decision 22: Bank and Cash on
// Hand only. A credit card used to be here too; the retest of 2026-10-07 found
// the guide saying so against the decision, and Mahreen kept the decision, so a
// card is held in the base currency like every other account.
export function roleHoldsOwnCurrency(role: AccountRole | undefined | ''): boolean {
  return role === 'Bank' || role === 'Cash on Hand'
}

// Shown wherever the Currency field is read-only, so the lock reads as a rule
// rather than a missing control.
export const CURRENCY_LOCKED_REASON =
  "Only bank and cash on hand accounts hold their own currency. Everything else uses the company's base currency."

// The roles whose balance is owned by a subledger rather than by the GL. The list
// of customers, vendors or items is the record; the account is only its total, so
// the system posts every movement and nobody posts by hand. That is what keeps the
// two from ever disagreeing, and it is the whole reason the distinction exists.
//
// The single source of truth for "is this a control account" - the role tooltips
// and the journal entry picker both read it, so an account the copy calls locked
// is an account the picker refuses. Do not add a parallel boolean to Account.
export const CONTROL_ACCOUNT_ROLES: AccountRole[] = [
  'Accounts Receivable',
  'Accounts Payable',
  'Inventory',
  'Vendor Prepayments',
  'Customer Deposits',
  'AP Accrual',
]

export function isControlAccountRole(role: AccountRole | undefined | ''): boolean {
  return !!role && CONTROL_ACCOUNT_ROLES.includes(role)
}

// What each control account holds and which list owns it. The uniform "Control
// account" prefix is the tooltip panel's heading rather than part of these
// strings, so it is written once instead of six times.
export const CONTROL_ACCOUNT_DETAIL: Partial<Record<AccountRole, string>> = {
  'Accounts Receivable': 'The balance is the total of what every customer owes you. The system posts here automatically from invoices and payments, and manual posting is locked so the account always matches the customer list.',
  'Accounts Payable': 'The balance is the total of what you owe every vendor. Posted automatically from bills and payments; manual posting is locked so it always matches the vendor list.',
  'Inventory': 'The balance is the total value of goods on hand. Driven by item transactions; manual posting is locked so it always matches the stock records.',
  'Vendor Prepayments': 'Tracks money paid to vendors in advance, per vendor. System-posted; manual posting locked to keep it matching the vendor detail.',
  'Customer Deposits': 'Tracks money customers paid in advance, per customer. System-posted; manual posting locked to keep it matching the customer detail.',
  'AP Accrual': 'Holds goods received but not yet invoiced, per vendor. System-posted; manual posting locked to keep it matching the receipts detail.',
}

// The suffix a control account carries in a picker that cannot accept it. Short
// because it is a fourth segment on an already long option label, and the greyed
// row is what says "not selectable" - this only has to say why. It stands in for a
// hover explanation, which a disabled option cannot show.
export const CONTROL_ACCOUNT_SHORT = 'Control account'

// The one-line form, for a surface already stating the role's other lock rather
// than explaining the role from scratch. Shaped to sit beside "Normal balance:
// Debit, set by the role", since both are the role deciding something for you.
// The full explanation stays in CONTROL_ACCOUNT_DETAIL; do not paraphrase either.
export const CONTROL_ACCOUNT_LOCK_LINE = 'Control account, so only the system posts here'

export interface PostingRestrictions {
  restrictedToRoles?: string[]
  restrictedToDepartments?: string[]
}

export interface Account {
  id: string
  /* The handle that outlives every edit. Issued once, by the system, and never
     reissued - not when the account is renumbered, not when it is renamed, not
     when it is archived and brought back.

     The account number cannot do this job: it belongs to the customer, and they
     change it. A renumber to fit a new scheme moves 1010 to 1100, and every
     saved report, old export and integration still naming 1010 now names a
     different account or none. They name this instead, which is why it is on
     the page rather than kept private - someone reconciling this chart against
     another system has to be able to read it and quote it.

     A column on the listing, searchable, and a field in the account page's
     bottom block (design review, 2026-09-24 - Eli: *"expose it in the table so
     it becomes searchable ... and expose it in the detail view"*). The column
     ships hidden, since it sorts no better than the number and reads worse, but
     search finds it whether or not the column is on.

     What the ledger keeps about an account - transactions, journal lines,
     closed balances, audit, children - links by `id`, never by the number, which
     is what leaves the number free to change later without rewriting history. */
  internalId: string
  accountNumber: string
  accountName: string
  accountType: AccountType
  // Structural role in the chart: Posting or Summary. See GLAccountType. The
  // single source of truth for the distinction; everything else derives.
  glAccountType: GLAccountType
  // Recognized identity for other modules and reports (Accounts Receivable,
  // Bank, Inventory, …). See AccountRole. Posting accounts only, and optional
  // there - absent means an ordinary, unclassified account.
  accountRole?: AccountRole
  /* The line this account prints on once it reaches a statement. See
     StatementClassification. Required on every account, summaries included; the
     five category roots are the exception, and they carry their category's
     default here while the page reads the span instead of the value. */
  statementClassification: StatementClassification
  subType?: string
  // The Summary this account sits under, or null when it sits at the top of the
  // chart. This is what makes the chart a tree: nesting is declared here and
  // nowhere else. A parent must share this account's category (BR-003).
  parentId: string | null
  // Mirrors `glAccountType === 'Posting'`. Kept because it is the guard every
  // aggregate reads to avoid counting a summary's rolled-up amount alongside the
  // postings it already contains. The two must never disagree.
  isPosting: boolean
  normalBalance: 'Debit' | 'Credit' | 'n/a'
  subsidiaryId?: string | null
  currencyCode: string
  status: AccountStatus
  effectiveDate: string
  postingRestrictions: PostingRestrictions
  /* What this account *is*, not what it suggests: the dimension values read off
     its own number, or picked when it was created. They are also what tells this
     account apart from another one numbered the same, so they are part of its
     identity.

     A dimension may hold several values (one account used in the USA and in
     Singapore). Then one of them is marked `isDefault`, and that is the value a
     journal line takes when the account is picked: one amount lands in one place
     (Mahad, 2026-10-02). A lone value needs no mark. See `lib/dimensionDefaults`.
     Empty means the account carries no dimensions. */
  defaultDimensionValues: { dimensionId: string; value: string; isDefault?: boolean }[]
  // Optional dedicated tax-code mapping (separate from dimensions); drives
  // downstream tax treatment for postings to this account.
  taxCodeId?: string
  description?: string
  // Movement to date, on posting accounts only. A Summary's movement is rolled
  // up from its children at render time, never stored. The listing no longer
  // shows it as a column - it derives Opening Balance (balance less movement)
  // and feeds the monthly Net Change Trend chart.
  netChange?: number
  /* Derived, never stored: on a chart scoped to a period, what the amounts typed
     in the account's own currency change about its own-currency balance, against
     restating their base figures (lib/currencies, ownBalanceOf). */
  typedCorrection?: number
  /* Derived, never stored: on a chart scoped to a period that ends before today,
     the balance and typed correction as they stand today, where they differ from
     the period's. The running balance reads these whatever the period
     (lib/periodSelection, scopeAccountsToPeriod). */
  currentBalance?: number
  currentTypedCorrection?: number
  // Bank details (spec Step 2, shown only when the account is flagged as a bank
  // account). Bank name, account title, account number and routing are required
  // for a bank account; nickname is an optional label.
  // Checking / Savings / Money Market / Certificate of Deposit, narrowed by the
  // account's statement classification - or 'Credit Card', which a card's role
  // sets for it. The setup form marks it required, so the record states it back.
  bankAccountType?: string
  // The agreed spend ceiling on a Credit Card account, held as an unformatted
  // amount string in the account's own currency. A card carries a limit and no
  // routing number, which is what separates it from a bank account.
  creditLimit?: string
  bankName?: string
  // Institution id from the shared bank catalogue (src/lib/bankInstitutions.ts)
  // when the bank was picked from the list; absent for a free-typed name. Lets
  // the selected bank carry forward into the connect-feed flow with no re-pick.
  selectedInstitutionId?: string
  bankAccountTitle?: string
  bankNickname?: string
  bankRouting?: string
  bankAccountNumber?: string
  // Closing balance from this account's own postings. Always 0 on a Summary,
  // whose amount is rolled up from its children instead and never read from here.
  balance: number
  hasTransactions: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  // For wizard-generated / imported accounts pending review
  pendingReview?: boolean
  // Plain-language "why this is here" note attached by the guided setup wizard.
  setupNote?: string
  // True for contra accounts (e.g. Accumulated Depreciation, Owner's Draw).
  isContra?: boolean
  // Which wizard answer added this account; surfaced on the Detail page.
  wizardTrigger?: string
  // The master-chart number, retained even after the user renumbers.
  masterChartRef?: string
  /* The number this account arrived as, verbatim, as a permanent note of where
     it came from. Set once at import and never rewritten - distinct from
     masterChartRef, which is load-bearing for renumber-lock and collision
     detection. Absent on hand-created accounts.

     One, always. Mahad, 2026-09-22: *"prior account number is always one number
     that was imported."* It is the whole code the row arrived as, not the part
     that survived the split: someone who reads 01-71100-40 has to be able to
     find 71100 by it. Where a file writes the same summary once per entity, the
     statement that landed is the one kept; the rest are reported as folded into
     it on the review grid, which is where a reader asks that question. */
  originalCode?: string
  /* Whether this account came into the chart through a file import, rather than
     being typed in or added by guided setup.

     Its own flag rather than a set `originalCode`, because the two answer
     different questions and the code is not always there to answer with: an
     import writes a code per file row, and an account the import created without
     a row behind it (a parent summary the file implied but never stated) has
     none. Read that absence as "not imported" and the chart mis-states where
     half an imported branch came from. */
  arrivedByImport?: boolean
  /* Restricted: only people with permission to view restricted accounts see
     it. A flag on the account itself, set when it is created and shown on the
     chart and the account's page. COA discussion, 2026-10-06 - Eli: *"put a flag
     on the account itself, mark it as restricted, and put a notation on what
     restricted means"*; it is its own permission, separate from Insights, and
     anyone who can create an account can create a restricted one. */
  restricted?: boolean
  /* Who a restricted account is open to: roles ("role:Controller") and people
     ("user:<email>"), as the Notify picker names them (Mahad, 2026-10-08). Kept
     only while the account is restricted. */
  restrictedAccess?: string[]
  /* The block of numbers a Summary reserves, so a reader adding an account under
     it can see where the number belongs before typing it. Optional and Summary-
     only: a Posting is a leaf and has nothing to guard. Held as two integers
     rather than a string because the checks against it are numeric. See
     `lib/numberRange.ts`. */
  numberRangeStart?: number
  numberRangeEnd?: number
}

// =========================
/** What a create flow supplies. Everything else about a new account is issued:
 *  its ids, its normal balance, and who made it when. See store.buildAccount. */
export type AccountDraft = Omit<Account,
  'id' | 'internalId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'normalBalance'>

/* An account a setup flow is holding, as the thing to create. The flows stage
   whole accounts and publish them at the end, and a publish that re-lists the
   fields it carries is a second copy of `Account` kept by hand: the bank block
   was written down as routing and account number, so a bank account arrived in
   the chart having lost the name, the title and the type the form had asked for
   and the reader had answered. Subtracting what the store issues leaves every
   field on the account carried, including the ones added after this was
   written. */
export function draftOf(a: Account): AccountDraft {
  const { id, internalId, createdAt, updatedAt, createdBy, updatedBy, normalBalance, ...draft } = a
  return draft
}

// =========================
// Dimensions, the reporting axes of the General Ledger (Location, Department,
// Job, …). Owned at the tenant level, not per-account. The values live on
// transactions, so one account serves every location and department, and
// account numbers stay plain sort keys.
// =========================
export interface Dimension {
  id: string
  name: string
  values: string[]
  status: 'Active' | 'Inactive'
  createdAt: string
  updatedAt: string
  /* Who added it and who changed it last, for the Dimensions list's audit
     columns. Optional because a dimension staged inside a setup flow is not
     anybody's yet - it is created, and stamped, when the chart is published. */
  createdBy?: string
  updatedBy?: string
}

// Tax codes are a dedicated, separate concept (not a dimension). An account can map
// to one tax code so downstream tax handling derives the correct treatment.
export interface TaxCode {
  id: string
  code: string
  name: string
  rate: number
  status: 'Active' | 'Inactive'
}

export type PeriodStatus = 'Open' | 'Soft-Closed' | 'Hard-Locked'

// What a reader sees. The stored values keep the soft/hard distinction because the
// close engine depends on it, but the two are shown as Closed and Locked: a closed
// period can be reopened, a locked one cannot, and that is the whole difference a
// reader needs. Never print a raw PeriodStatus.
export const PERIOD_STATUS_LABEL: Record<PeriodStatus, string> = {
  'Open': 'Open',
  'Soft-Closed': 'Closed',
  'Hard-Locked': 'Locked',
}

export interface Period {
  id: string
  label: string
  startDate: string
  endDate: string
  status: PeriodStatus
}

// The four quarters of a fiscal year, derived as groups of three monthly
// periods from company.fiscalYearStart (Q1 = the first three months, …).
export type QuarterId = 'Q1' | 'Q2' | 'Q3' | 'Q4'

// Which calendar year a fiscal year is named after when it spans two of them: the
// year it starts in, or the year it ends in. A fiscal year's *identity* is always
// its starting year (see fiscalYearOf) - this decides the label alone, and both
// conventions agree whenever the year begins in January.
export type FiscalYearNaming = 'start' | 'end'

// A finalized (or provisional) balance for one account across one quarter. The
// period-close engine writes one per posting account when a quarter closes.
// `opening` is carried from the prior quarter's closing (or the seeded
// fiscal-year opening for Q1); `movement` is the normal-side net over the
// quarter; `closing = opening + movement`. `final` is true once locked.
export interface PeriodBalanceSnapshot {
  id: string
  fiscalYear: number
  quarter: QuarterId
  accountId: string
  opening: number
  movement: number
  closing: number
  statement: 'Balance Sheet' | 'Income Statement'
  final: boolean
  closedAt?: string
}

export interface AuditEntry {
  id: string
  // Absent for period-level events (CloseQuarter / CloseYear), which aren't tied
  // to a single account. Account edits still carry it.
  accountId?: string
  action: 'Create' | 'Edit' | 'Deactivate' | 'Activate' | 'Archive' | 'Unarchive' | 'Delete' | 'Merge' | 'CloseQuarter' | 'CloseYear'
  // The period a close acted on, e.g. '2026-Q3' or '2026-FY'.
  periodRef?: string
  field?: string
  oldValue?: string
  newValue?: string
  reason?: string
  user: string
  timestamp: string
}

// Simple = one debit, one credit. Compound = one side split across several
// accounts. Reversing = an entry that automatically backs out a prior accrual.
// Opening = the one-time entry that brings a first-ever period's balances in
// against Opening Balance Equity. Closing = the year-end entry that zeroes
// income/expense accounts and sweeps net into Retained Earnings. Archive
// transfer = the entry archiving posts to move an account's balance onto
// another before it leaves the chart.
export type JournalEntryType = 'Simple' | 'Compound' | 'Reversing' | 'Opening' | 'Closing' | 'Archive transfer'

export interface Transaction {
  id: string
  accountId: string
  date: string
  source: string
  // The GL entry this posting belongs to (JE-…, ADJ-…). Always present - every
  // posting lives inside a journal entry. Opens the journal entry detail page.
  jeNumber: string
  // The source document the entry originated from (INV-, CINV-, PAY-, BNK-…).
  // Empty for manual / adjusting entries, which have a GL entry but no source
  // document. Opens the source document.
  reference: string
  entryType: JournalEntryType
  // This line's own narration. Distinct from `memo`, which describes the whole
  // entry - a line often has nothing to add and is left blank.
  description: string
  // The entry-level memo, repeated on every posting because a posting is the
  // only record the ledger keeps. Absent on seeded postings, whose memo is
  // inferred from the source document instead.
  memo?: string
  // Why the entry was posted to an account the system keeps (retained earnings,
  // a control account), in the words of whoever posted it. Entry-level and
  // repeated like the memo. Absent on every other entry.
  adjustmentReason?: string
  // Why the entry was reversed, on the reversing entry, as whoever reversed it
  // wrote it. Entry-level and repeated like the memo.
  reversalReason?: string
  // When the entry was written, and by whom - not the date it is dated, which a
  // reader picks and which can be any day in an open period. Stamped on entries
  // made in the app; a seeded posting has neither, and reads its date instead.
  createdAt?: string
  createdBy?: string
  // The seeded business event this posting belongs to (see lib/txScenarios.ts).
  // Everything shown about the source document - its party, its one-line summary
  // - is looked up from here, so the document can never contradict the narration
  // already on the row. Absent on postings made in the app.
  scenarioId?: string
  // The ID the system gave the entry (JNL-000123), repeated on every posting of
  // it. Issued by `addJournalEntry`, and stamped on the seed in date order.
  entryInternalId?: string
  /* The currency the entry was written in, when it was not the base currency,
     and the rate it posted at (units of it per one of base). `debit` and
     `credit` stay the base figures the ledger holds; `fxDebit` and `fxCredit`
     are the line as it was typed. Entry-level currency and rate are repeated on
     every posting, like the memo. Absent on a base-currency entry. */
  entryCurrency?: string
  entryRate?: number
  fxDebit?: number
  fxCredit?: number
  debit: number
  credit: number
  runningBalance: number
  /* Dimension values carried by this posting. Taken from the account it posts to
     and not editable on the line: an account read out of 01-71100-40 *is* the
     Department 40 one, so a line that could say otherwise would be describing an
     account that does not exist. Copied onto the posting rather than looked up so
     a report of what was posted stays true after the account is edited. */
  dimensionValues: { dimensionId: string; value: string }[]
  period: string
}

export interface JournalEntry {
  id: string
  date: string
  reference: string
  description: string
  status: 'Draft' | 'Posted' | 'Open'
  lines: { accountId: string; debit: number; credit: number }[]
}

export interface RecurringTemplate {
  id: string
  name: string
  accountIds: string[]
  frequency: string
}

export interface SegmentDef {
  index: number
  length: number
  meaning: string
  separator: string
}

export interface NumberingScheme {
  segments: SegmentDef[]
  /* How a glued number is shown to a reader, once its parts have been named.
     Display only: the stored accountNumber is always the full original string,
     so this settles what a column shows and never what the chart holds. 'short'
     shows the account segment alone, the rest of the number having moved onto
     dimensions. Absent means 'full', which is every flat chart. */
  numberDisplay?: 'full' | 'short'
  /* The block each category's summary reserves, where setup was told one.
     Absent for a category, its block follows from the width (categoryFirstNumber
     and a block of 10^(width-1)). Set on the first-time Number length step
     (2026-10-01) and read by `seedCategoryAccounts`, which every flow that
     builds a chart starts from. */
  categoryRanges?: Partial<Record<AccountCategory, { start: number; end: number }>>
}

// Which segment carries the category meaning that decides an account's Type and
// classification. Marked by the reserved meaning "Account" (every seeded and editor
// scheme sets it); falls back to the widest segment, ties to the earliest, so a
// scheme that never labelled one still resolves.
export function accountSegmentIndex(scheme: NumberingScheme): number {
  const marked = scheme.segments.findIndex(s => s.meaning.trim().toLowerCase() === 'account')
  if (marked >= 0) return marked
  let widest = 0
  for (let i = 1; i < scheme.segments.length; i++) {
    if (scheme.segments[i].length > scheme.segments[widest].length) widest = i
  }
  return widest
}

// Split a glued number into its segments by the given lengths and separators,
// e.g. "100-2000-200" → ["100", "2000", "200"]. Returns null when the number
// does not fit the shape (wrong length, missing separator).
export function splitBySegments(segments: SegmentDef[], number: string): string[] | null {
  const out: string[] = []
  let pos = 0
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const chunk = number.slice(pos, pos + seg.length)
    if (chunk.length !== seg.length) return null
    out.push(chunk)
    pos += seg.length
    const sep = i < segments.length - 1 ? seg.separator : ''
    if (sep) {
      if (number.slice(pos, pos + sep.length) !== sep) return null
      pos += sep.length
    }
  }
  return pos === number.length ? out : null
}

// As splitBySegments, but keyed off a whole scheme.
export function splitByScheme(scheme: NumberingScheme, number: string): string[] | null {
  return splitBySegments(scheme.segments, number)
}

/* Whether a number is one arithmetic can be done on. An account number may carry
   letters, and a lettered number has no numeric value: stripping the letters out
   of AR100 to reach 100 would file it wherever 100 happens to fall, which is a
   number the customer never wrote. */
export const isNumericAccountNumber = (number: string) => /^\d+$/.test(number.trim())

/* How two account numbers sort. Numeric-aware, so 1010 comes after 999 instead of
   before it, and letters sort where a reader expects rather than being stripped
   out. Case-insensitive, matching accountIdentity, which treats case as noise. */
export const compareAccountNumbers = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

// The numeric value of the account segment, the part that places the number in a
// classification. NaN when the number does not fit the scheme, or when the segment
// carries letters and so names no point on the number line.
export function accountSegmentValue(scheme: NumberingScheme, number: string): number {
  const segs = splitByScheme(scheme, number)
  if (!segs) return NaN
  const seg = segs[accountSegmentIndex(scheme)] ?? ''
  return isNumericAccountNumber(seg) ? parseInt(seg, 10) : NaN
}

/* The account number as a reader should see it, which is not always the number
   the chart stores. A glued chart that chose to shorten shows the account
   segment alone: the other parts became dimensions at import, so repeating them in
   every cell says the same thing twice.
 *
 * Falls back to the stored number on anything it cannot split. A number that
 * does not fit the scheme is still a number someone typed, and showing nothing
 * of it would be worse than showing all of it. Nothing here is reversible-only:
 * the full number stays on the account, so this must never feed a sort, a match,
 * or a downloaded file. */
export function displayAccountNumber(scheme: NumberingScheme, number: string): string {
  if (scheme.numberDisplay !== 'short' || scheme.segments.length < 2) return number
  const segs = splitByScheme(scheme, number)
  return segs?.[accountSegmentIndex(scheme)] ?? number
}

// Render an account-segment value back into the scheme's full style, so a
// suggestion for a glued chart comes out shaped like the customer's own
// numbers, e.g. 2010 → "000-2010-00" for a 3-4-2 dash scheme. The non-account
// segments are copied from `template` (another number of the same shape,
// typically the parent's) verbatim when it fits, and are zero-filled otherwise.
export function formatInScheme(scheme: NumberingScheme, accountValue: number, template?: string): string {
  const acctIdx = accountSegmentIndex(scheme)
  const tmpl = template ? splitByScheme(scheme, template) : null
  let out = ''
  scheme.segments.forEach((seg, i) => {
    /* Copied parts keep whatever they are made of. Only the account part is a
       number here, and stripping letters out of the parts around it would hand
       back a number that belongs to a different account. */
    const raw = i === acctIdx ? String(accountValue) : (tmpl?.[i] ?? '')
    out += raw.padStart(seg.length, '0').slice(-seg.length)
    if (i < scheme.segments.length - 1) out += seg.separator
  })
  return out
}

export interface Subsidiary {
  id: string
  name: string
}

// =========================
// Guided setup wizard
// =========================

// A single account in the wizard's working set, before it becomes a real
// Account on publish. Carries the impact copy as `setupNote` and a `source`
// so the live side panel can show which answer contributed it.
export interface WizardAccount {
  key: string                                   // stable identity for dedupe + review edits
  accountName: string
  accountType: AccountType
  statementClassification: StatementClassification                        // presentation grouping → persisted as Account.statementClassification
  setupNote: string                             // the impact copy → persisted as Account.setupNote
  source: string                                // 'base' | 'q1' … 'q9' | 'custom'
  isCashBank?: boolean                          // required-type marker (Cash/Bank)
  coreExpense?: string                          // names a required core operating expense
  isContra?: boolean
  taxCodeMapped?: boolean
  taxCodeId?: string                            // optional tax-code mapping
  checked: boolean                              // review-step inclusion
  custom?: boolean                              // user-added ad-hoc account
  renamed?: boolean                             // user renamed on review
}

// Persisted to company.wizardDraft so an accidental refresh mid-setup recovers.
export interface WizardDraft {
  answers: Record<string, string>
  workingAccounts: WizardAccount[]
  step: number
}

export interface CompanyConfig {
  setupComplete: boolean
  // First day of the first year of books: the start month sets the shape of every
  // fiscal year, and the year says how far back periods are built.
  fiscalYearStart: string
  // Which of the two calendar years a mid-year fiscal year is named after.
  fiscalYearNaming?: FiscalYearNaming
  // Who can see restricted accounts unless an account sets its own list. Owned
  // by the permissions module; lib/restrictedAccess has the fallback.
  restrictedAccessDefault?: string[]
  baseCurrency: string
  // ISO-2 country of registration. The anchor for anything localised; today it
  // decides the local name for the tax added to a sale.
  country?: string
  industry?: string
  // Cash or accrual, as answered in Guided setup. Adds no accounts; kept because
  // it decides when income and expenses are recorded, which the question tells
  // the reader (Mahad, 2026-10-08).
  accountingMethod?: 'accrual' | 'cash'
  subsidiaries: Subsidiary[]
  // In-progress guided-setup state; cleared once setup is published.
  wizardDraft?: WizardDraft
  // Tenant-configurable defaults, set on the Build-from-Scratch rules step.
  defaults?: {
    allowNonBaseCurrency: boolean
    autoSuggestNumbers: boolean
    requireEffectiveDate: boolean
  }
  // Post-publish "configure in your modules" state, seeded by the guided setup
  // wizard. Surfaced as a persistent checklist on the Chart of Accounts until
  // every module is ready or the user dismisses it. Session-scoped (the store
  // is in-memory), so a reload resets it along with the rest of the tenant.
  moduleSetupChecklist?: {
    items: { moduleId: 'items' | 'partners' | 'purchasing' | 'tax'; status: 'todo' | 'partial' | 'ready' }[]
    dismissed: boolean
  }
  /* Number protection: the stretch from a summary's own number to its last
     account is kept for the accounts under it, whether or not a range was typed.
     On unless turned off - read it through `numberProtectionOn`, never directly,
     so a company saved before the setting existed reads as on. Turned off for a
     chart imported from a system that numbered things another way. Settled in the
     design review of 2026-09-24; see lib/numberRange.ts. */
  numberProtection?: boolean
}

/** Whether number protection is on for this company. On by default. */
export const numberProtectionOn = (company: Pick<CompanyConfig, 'numberProtection'>): boolean =>
  company.numberProtection !== false
