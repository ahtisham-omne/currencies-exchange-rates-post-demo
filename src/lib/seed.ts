import type { Account, AccountCategory, AccountRole, StatementClassification, AuditEntry, CompanyConfig, JournalEntry, NumberingScheme, Period, RecurringTemplate, Dimension, TaxCode, Transaction } from '../types'
import { ACCOUNT_TYPE_META, DEFAULT_NUMBER_WIDTH, DEFAULT_CLASSIFICATION_BY_CATEGORY, categoryFirstNumber, CATEGORY_ORDER } from '../types'
import { FULL_CHART, classificationFor } from './fullChart'
import { TX_SCENARIOS, formatLeg, type ScenarioLeg, type TxScenario } from './txScenarios'
import { comparePostingOrder, normalSideDelta } from './monthlyLedger'
import { formatInternalId, formatJournalInternalId } from './internalId'
import { todayIso } from './utils'
import { lockEndedPeriods } from './periodClose'
import type { EntryAttachment } from './journalEntry'
import { postingDimensions } from './dimensionDefaults'
import { earningsOpening, isCurrentYearEarnings } from './currentYearEarnings'

const todayMinus = (d: number) => {
  const t = new Date()
  t.setDate(t.getDate() - d)
  return t.toISOString()
}

/* The same day as a calendar day rather than an instant. A posting date is the
   day it was booked on and nothing finer, so it must not carry a time: an
   instant west of UTC slices back to the day before, and the entry lands in a
   period nobody chose. Audit timestamps keep `todayMinus`. */
const dayMinus = (d: number) => {
  const t = new Date()
  t.setDate(t.getDate() - d)
  return todayIso(t)
}

export const seedNumberingScheme: NumberingScheme = {
  segments: [
    { index: 0, length: 5, meaning: 'Account', separator: '' },
  ],
}

// The five foundational category anchors for a type-driven Build-from-Scratch
// chart. Seeds one Summary per GAAP category (Asset, Liability, Equity, Revenue,
// Expense), numbered at that category's first number, so the user starts from
// the five categories and adds accounts down the tree rather than facing a blank
// page. The number is a starting suggestion and is editable like any other.
//
// Each reserves its whole block - every number that starts with its digit at the
// chart's width (Eli, 2026-09-24: *"Top level reserves the entire range, its
// entire block"*). A default, not a rule: the range can be changed or cleared on
// the anchor like any other summary's.
export function seedCategoryAccounts(
  scheme: NumberingScheme,
  opts: { currencyCode?: string; effectiveDate?: string } = {},
): Account[] {
  const now = new Date().toISOString()
  return CATEGORY_ORDER.map((code, i) => {
    const meta = ACCOUNT_TYPE_META[code]
    const width = scheme.segments[0]?.length ?? DEFAULT_NUMBER_WIDTH
    // The block setup was given for the category, or the width's default.
    const set = scheme.categoryRanges?.[code]
    const first = set?.start ?? categoryFirstNumber(code, width)
    const last = set?.end ?? first + 10 ** (Math.max(1, width) - 1) - 1
    const fromNum = String(first)
    const normalBalance: 'Debit' | 'Credit' = code === 'AST' || code === 'EXP' ? 'Debit' : 'Credit'
    return {
      id: `seed_cat_${code}`,
      internalId: formatInternalId(i + 1),
      accountNumber: fromNum,
      numberRangeStart: first,
      numberRangeEnd: last,
      accountName: meta.label,
      accountType: code,
      glAccountType: 'Summary',
      statementClassification: DEFAULT_CLASSIFICATION_BY_CATEGORY[code],
      isPosting: false,
      normalBalance,
      currencyCode: opts.currencyCode ?? 'USD',
      status: 'Active',
      effectiveDate: opts.effectiveDate ?? '',
      postingRestrictions: {},
      defaultDimensionValues: [],
      isContra: false,
      parentId: null,
      subsidiaryId: 'sub_main',
      balance: 0,
      hasTransactions: false,
      description: meta.notes,
      createdAt: now,
      updatedAt: now,
      createdBy: '',
      updatedBy: '',
    } satisfies Account
  })
}

// Bank-detail records for the seeded bank and credit-card accounts (the
// Operating / Payroll / Money Market / foreign-currency accounts under Cash &
// Cash Equivalents, plus the two corporate cards). Keyed by account number;
// merged into the matching seed account so the Account Detail page can render a
// populated "Bank Account Information" card. Pure cash accounts (Petty Cash,
// Cash on Hand) deliberately carry no bank record.
// The type is here for the same reason the rest is: the setup form requires it,
// so a seeded bank account left without one is an account the form would refuse.
const SEED_BANK_DETAILS: Record<string, {
  bankName: string; bankAccountTitle: string; bankAccountNumber: string; bankRouting: string
  bankAccountType: string; bankNickname?: string
}> = {
  '11130': { bankName: 'JPMorgan Chase Bank, N.A.', bankAccountTitle: 'Omnesoft Inc.',               bankAccountNumber: '483920175566', bankRouting: '021000021', bankAccountType: 'Checking',     bankNickname: 'Operating' },
  '11140': { bankName: 'JPMorgan Chase Bank, N.A.', bankAccountTitle: 'Omnesoft Inc. Payroll',       bankAccountNumber: '483920188421', bankRouting: '021000021', bankAccountType: 'Checking',     bankNickname: 'Payroll' },
  '11150': { bankName: 'JPMorgan Private Bank',     bankAccountTitle: 'Omnesoft Inc.',               bankAccountNumber: '771204559830', bankRouting: '021000021', bankAccountType: 'Money Market', bankNickname: 'Money Market' },
  '11160': { bankName: 'Barclays Bank UK PLC',      bankAccountTitle: 'Omnesoft International Ltd.',  bankAccountNumber: '20581347',     bankRouting: '20-00-00',   bankAccountType: 'Savings',      bankNickname: 'GBP Savings' },
  '11170': { bankName: 'Deutsche Bank AG',          bankAccountTitle: 'Omnesoft International GmbH',  bankAccountNumber: '0532013000',   bankRouting: '37040044',   bankAccountType: 'Checking',     bankNickname: 'EUR Account' },
}

// Account roles for the seeded chart, keyed by account number. Only the accounts
// that genuinely play a recognized part carry one - the rest stay unclassified,
// which is the normal state for most posting accounts.
//
// Every number in SEED_BANK_DETAILS must appear here as 'Bank': the role is what
// marks an account reconcilable, so bank details without the role would leave the
// account looking un-set-up in Cash Management.
const SEED_ACCOUNT_ROLES: Record<string, AccountRole> = {
  '11110': 'Cash on Hand', '11120': 'Cash on Hand',
  '11130': 'Bank', '11140': 'Bank', '11150': 'Bank', '11160': 'Bank', '11170': 'Bank',
  '11310': 'Accounts Receivable', '11320': 'Accounts Receivable',
  '11410': 'Inventory', '11420': 'Inventory', '11430': 'Inventory',
  '21110': 'Accounts Payable',
  '21200': 'AP Accrual',
  '21410': 'Sales Tax Payable',
  '21620': 'Customer Deposits',
  '32100': 'Retained Earnings', '32200': 'Retained Earnings Adjustments',
  '35000': 'Current Year Earnings',
  '41010': 'Sales Revenue', '41020': 'Sales Revenue', '41030': 'Sales Revenue',
  '41040': 'Sales Revenue', '41050': 'Sales Revenue', '41060': 'Sales Revenue',
  '42040': 'Exchange Gain',
  '51010': 'Cost of Goods Sold', '51020': 'Cost of Goods Sold',
  '51030': 'Cost of Goods Sold', '51040': 'Cost of Goods Sold',
}

/* Dimension values the seeded accounts carry by default, keyed by account
   number. A default is not a suggestion: every posting to the account takes it
   and no posting can change it. So an account earns one only where its own
   identity already fixes the answer, and most accounts do not - Trade
   Receivables is owed by customers in every place the company sells, and
   Salaries and Wages is paid by every department that employs anyone. A dash in
   the Dimensions column is the normal reading, not a gap in the demo.
 *
 * What fixes an answer here, given this manufacturer's shape - a US head office
 * that owns its building, the plant and warehouse in Singapore, a leased sales
 * office in Hong Kong, and a UK subsidiary:
 *   Location   - where the money or the thing sits. A named bank tells you
 *                (Chase is the US entity's, Barclays the UK one's), and so does
 *                a warehouse or a leasehold.
 *   Department - which function owns the spend. Only on income-statement
 *                accounts and the assets a function alone produces; a
 *                department does not own the cash or the receivable.
 *
 * 11170 EUR Account - Deutsche Bank is deliberately bare. It belongs to Omnesoft
 * International GmbH, and none of the four Location values is Germany - so
 * there is no honest answer to give it, and inventing a fifth value here would
 * put a value in the column that the Dimensions page never offered. */
const loc = (value: string) => ({ dimensionId: 'dim_location', value })
const dept = (value: string) => ({ dimensionId: 'dim_department', value })

const SEED_DIMENSION_DEFAULTS: Record<string, { dimensionId: string; value: string; isDefault?: boolean }[]> = {
  // Cash: the bank on the account name says whose it is and where.
  '11130': [loc('USA')], '11140': [loc('USA')], '11150': [loc('USA')],
  '11160': [loc('United Kingdom')],
  // Stock sits in the Singapore warehouse, and Operations answers for it.
  '11410': [loc('Singapore'), dept('Operations')],
  '11420': [loc('Singapore'), dept('Operations')],
  '11430': [loc('Singapore'), dept('Operations')],
  '11440': [loc('Singapore'), dept('Operations')],
  // Property, by the site it stands on. The plant's machinery is Operations';
  // the land and building are the company's, so they take no department.
  '12105': [loc('USA')], '12110': [loc('USA')], '12140': [loc('USA')],
  '12115': [loc('Hong Kong')], '12145': [loc('Hong Kong')],
  '12120': [loc('Singapore'), dept('Operations')],
  '12150': [loc('Singapore'), dept('Operations')],
  // Intangibles Engineering alone produces: the patents it files and the
  // software it capitalises. No location - the IP is held centrally.
  '12220': [dept('Engineering')], '12230': [dept('Engineering')],
  // US sales tax is a US filing; VAT would be a different account.
  '21410': [loc('USA')],
  // Both borrowings are against the US entity - the Chase facility and the
  // mortgage on the building above.
  '22110': [loc('USA')], '22120': [loc('USA')],
  /* Wholesale goes through the Sales desk and consulting through the Business
     practice. Product Sales is left bare on purpose: it is cut by region and by
     team every month, which is work for the dimensions on the posting rather
     than a default the account can fix. */
  '41020': [dept('Sales')], '41040': [dept('Business')],
  // The let space is in the US building.
  '42020': [loc('USA')],
  // Cost of sales is incurred at the plant, by Operations.
  '51010': [loc('Singapore'), dept('Operations')],
  '51020': [loc('Singapore'), dept('Operations')],
  '51030': [loc('Singapore'), dept('Operations')],
  '51040': [loc('Singapore'), dept('Operations')],
  // Sales and marketing spend, wherever it is spent.
  /* Advertising runs from the US office and the Singapore one, so the account
     carries both and its postings land on the US one, its default: one amount
     lands in one place (2026-10-02). */
  '52210': [dept('Sales'), { ...loc('USA'), isDefault: true }, loc('Singapore')],
  '52220': [dept('Sales')], '52230': [dept('Sales')],
  '52410': [dept('Engineering')], '52420': [dept('Engineering')],
}

/* The part of the seeded chart that was migrated in from the company's previous
   system rather than typed into Omne. Keyed by the number the account carries
   now; the value is the code it arrived as.

   Cash and receivables, because that is the branch a migration touches first and
   the one whose numbers get rewritten hardest: the old system numbered by
   grouping - every USD bank account under one header, told apart by a suffix -
   and Omne numbers each account in its own right. So the whole branch is
   renumbered, and these codes are the only remaining answer to "which of these
   is the 1020-01 I have been reconciling against for six years".

   The old chart is four digits and this one is five, which is the point rather
   than a detail. Read side by side in the listing, a legacy code that looked
   like a current number - 11100-00 against an account genuinely numbered 11100 -
   would let the eye pair up two rows that have nothing to do with each other.
   Four digits and five cannot be confused, so the column answers its question
   without raising a second one. Any legacy scheme invented here has to keep that
   gap. (It ran the other way round while Omne's own chart was the four-digit
   one; the chart went to five digits on 2026-09-25, so the legacy codes went to
   four.)

   An account that arrived by import arrived as something, so every number here
   is a real one. Mahad, 2026-09-21: *"Prior account number should be there for
   imported accounts."* One each, and only one. Mahad, 2026-09-22: *"prior
   account number is always one number that was imported."* The two summaries
   used to list every old header they answer for; they carry the statement that
   landed now, which is what the importer keeps when a file writes the same
   summary once per group. */
const SEED_ARRIVAL_CODES: Record<string, string> = {
  '11100': '1010',
  // 1010 - cash held on site, one suffix per float.
  '11110': '1010-01',
  '11120': '1010-02',
  // 1020 - USD bank accounts. 1030 - the international subsidiaries', which
  // the old system kept apart because they settle in another currency.
  '11130': '1020-00',
  '11140': '1020-01',
  '11150': '1020-02',
  '11160': '1030-00',
  '11170': '1030-01',
  // 1200 and 1210 were headers in their own right, so they carry no suffix.
  '11300': '1200',
  '11310': '1200-00',
  '11320': '1210-00',
  // -99 is where the old chart parked a group's contra account.
  '11330': '1210-99',
}

export const seedCompany: CompanyConfig = {
  // The seeded tenant represents a company that has already finished setup, so
  // the app loads straight into the full chart of accounts. To preview the
  // brand-new-user experience, use the floating "View as first-time user"
  // button (AppShell → store.resetToFirstTimeUser), which flips this to false
  // at runtime and clears all accounts to zero for a true blank-slate first run.
  setupComplete: true,
  // The first year of books, not the current one: the tenant carries FY2024 and
  // FY2025 behind it (see seedPeriods), and this is the field `addEarlierYears`
  // moves when a reader reaches the books further back.
  fiscalYearStart: '2024-01-01',
  // A January start makes both conventions agree, so this only records the default.
  fiscalYearNaming: 'start',
  baseCurrency: 'USD',
  industry: 'Manufacturing',
  subsidiaries: [
    { id: 'sub_main', name: 'Omnesoft Main' },
    { id: 'sub_intl', name: 'Omnesoft International' },
  ],
}

// Tenant-level dimensions: how the General Ledger is cut. Configured at setup.
// Set up with the chart, by the person who built it; Department has had a value
// added since, so the list's Last updated columns have a change to show.
const DIMENSIONS_BY = 'Ayesha Khan (Controller)'
export const seedDimensions: Dimension[] = [
  { id: 'dim_location',   name: 'Location',   values: ['USA', 'Hong Kong', 'Singapore', 'United Kingdom'], status: 'Active', createdAt: todayMinus(120), updatedAt: todayMinus(120), createdBy: DIMENSIONS_BY, updatedBy: DIMENSIONS_BY },
  { id: 'dim_department', name: 'Department', values: ['Business', 'Design', 'Engineering', 'Sales', 'Operations'], status: 'Active', createdAt: todayMinus(120), updatedAt: todayMinus(45), createdBy: DIMENSIONS_BY, updatedBy: 'Marcus Lee (Accountant)' },
  { id: 'dim_misc',       name: 'Miscellaneous', values: [], status: 'Active', createdAt: todayMinus(120), updatedAt: todayMinus(120), createdBy: DIMENSIONS_BY, updatedBy: DIMENSIONS_BY },
]

// Tax codes are a dedicated concept, separate from dimensions.
export const seedTaxCodes: TaxCode[] = [
  { id: 'tax_std',    code: 'VAT-STD', name: 'Standard 17%',  rate: 17, status: 'Active' },
  { id: 'tax_zero',   code: 'VAT-ZR',  name: 'Zero-rated 0%', rate: 0,  status: 'Active' },
  { id: 'tax_exempt', code: 'VAT-EX',  name: 'Exempt',        rate: 0,  status: 'Active' },
]

/* Who and when, for the chart that was here before anyone signed in.
 *
 * Every account used to carry the same two answers - the controller, 120 days
 * ago - which reads as a placeholder rather than as a history, and left the
 * detail page's card contradicting its own Activity tab on a quarter of the
 * chart. Both come from one place now, and the log is written from them.
 *
 * The migrated branch is credited to the import, because that is what made it,
 * and shares one date, because it arrived in one file. The rest is spread by
 * account number: hand-built charts grow, and a chart where every row was
 * created in the same second is a chart nobody built. */
// One reading of the clock, shared. Taken per account it drifted by a
// millisecond or two between rows, so a branch that arrived in a single file
// carried a dozen slightly different arrival times.
const IMPORT_RUN_AT = todayMinus(120)
/* A person, not the machine. An import is something somebody ran, and "System
   Import" answered *how* an account arrived where the field asks *who* put it
   there - which the Source column already states, and states better. Kept
   distinct from HAND_BUILT_BY so the chart still reads as two provenances. */
const IMPORT_RUN_BY = 'Marcus Lee (Accountant)'
const HAND_BUILT_BY = 'Ayesha Khan (Controller)'
// FNV-1a, so the spread is the same on every reload rather than reshuffling
// under a reader comparing two accounts.
const hashOf = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
const createdFor = (a: { accountNumber: string; arrivedByImport?: boolean }) => a.arrivedByImport
  ? { createdBy: IMPORT_RUN_BY, createdAt: IMPORT_RUN_AT }
  // 121 to 240 days, so nothing hand-built postdates the migration it was
  // reconciled against.
  : { createdBy: HAND_BUILT_BY, createdAt: todayMinus(121 + (hashOf(a.accountNumber) % 120)) }

/* The changes somebody actually made to this chart, one entry per event. Read
   twice: as the Activity tab's timeline, and as where each account's "last
   updated" comes from - so the two cannot say different things. Declared here
   rather than beside the rest of the log because the accounts are stamped from
   it. The Create entries are the other way round, written from the accounts. */
const CURATED_AUDIT: AuditEntry[] = [
  { id: 'au_1', accountId: 'acct_52230', action: 'Edit', field: 'accountName', oldValue: 'Travel & Meals', newValue: 'Travel', user: 'Ayesha Khan (Controller)', timestamp: todayMinus(40) },
  { id: 'au_3', accountId: 'acct_53040', action: 'Edit', field: 'description', oldValue: '-', newValue: 'Uncategorized operating costs', user: 'Ayesha Khan (Controller)', timestamp: todayMinus(30) },
  /* acct_11130 is the operating bank, and it is numbered 11130. The entry used to
     read the summary above it moving onto the petty cash account beside it - two
     live numbers, neither of them this one. The import parked it at 11101,
     straight under the summary, and it was moved down so the bank accounts sit as
     a block after the two cash floats. */
  { id: 'au_4', accountId: 'acct_11130', action: 'Edit', field: 'accountNumber', oldValue: '11101', newValue: '11130', reason: 'Renumbered to fit cash sub-range', user: 'Marcus Lee (Accountant)', timestamp: todayMinus(55) },
  { id: 'au_5', accountId: 'acct_11130', action: 'Edit', field: 'description', oldValue: 'Operating account', newValue: 'Primary operating account (JPMorgan Chase)', user: 'Ayesha Khan (Controller)', timestamp: todayMinus(12) },
  { id: 'au_6', accountId: 'acct_21310', action: 'Edit', field: 'accountName', oldValue: 'Wages Payable', newValue: 'Accrued Wages Payable', user: 'Marcus Lee (Accountant)', timestamp: todayMinus(22) },
  { id: 'au_7', accountId: 'acct_52310', action: 'Deactivate', reason: 'Lease ended; consolidating under Facilities', user: 'Ayesha Khan (Controller)', timestamp: todayMinus(18) },
  { id: 'au_8', accountId: 'acct_52310', action: 'Activate', reason: 'New office lease signed', user: 'Ayesha Khan (Controller)', timestamp: todayMinus(6) },
  { id: 'au_9', accountId: 'acct_52110', action: 'Edit', field: 'description', oldValue: '-', newValue: 'Gross wages incl. contractor payroll', user: 'Marcus Lee (Accountant)', timestamp: todayMinus(9) },
  { id: 'au_10', accountId: 'acct_52510', action: 'Edit', field: 'accountName', oldValue: 'Depreciation', newValue: 'Depreciation Expense', user: 'Ayesha Khan (Controller)', timestamp: todayMinus(34) },
  /* The two accounts that ship archived. They used to arrive with a last-touched
     date and a name and no event behind either, so the card credited somebody
     for a change the timeline had no record of. */
  /* Retired after the migration, not before it: the branch was closed on the old
     system in 2024, came across with the rest of the cash accounts, and was
     archived here once its zero balance had been confirmed. An archiving dated
     ahead of the arrival is an account retired before it existed. */
  { id: 'au_11', accountId: 'acct_arch_petty', action: 'Archive', reason: 'Closed on the old system in 2024; zero balance confirmed after the migration', user: 'Ahtisham Ahmad (You)', timestamp: todayMinus(105) },
  { id: 'au_12', accountId: 'acct_arch_print', action: 'Archive', reason: 'Spend moved fully to digital channels', user: 'Ahtisham Ahmad (You)', timestamp: todayMinus(240) },
]

/* Ranges reserved on Summary accounts, laid out the way Omne lays out a chart it
   builds itself: the cascade settled in the design review of 2026-09-24. Each
   statement division reserves its whole block of ten thousand, each summary
   directly under it a block of a thousand, and each summary under that a block
   of a hundred - one zero less per level, so every branch has room to grow
   without anything being squeezed in beside it. See lib/numberRange.ts.

   The two summaries under Non-Current Liabilities are left without a typed range
   on purpose, so the chart still shows the case a customer meets on a chart they
   imported: no reservation, and number protection keeping the stretch from the
   summary to its last account for it anyway. */
const SEED_SUMMARY_RANGES: Record<string, [number, number]> = {
  '10000': [10000, 19999], // ASSETS
  '11000': [11000, 11999], //   Current Assets
  '11100': [11100, 11199], //     Cash and Cash Equivalents
  '11200': [11200, 11299], //     Short-Term Investments
  '11300': [11300, 11399], //     Accounts Receivable
  '11400': [11400, 11499], //     Inventory
  '11500': [11500, 11599], //     Prepaid Expenses and Other
  '12000': [12000, 12999], //   Non-Current Assets
  '12100': [12100, 12199], //     Property, Plant and Equipment
  '12200': [12200, 12299], //     Intangible Assets
  '12300': [12300, 12399], //     Other Non-Current Assets
  '20000': [20000, 29999], // LIABILITIES
  '21000': [21000, 21999], //   Current Liabilities
  '21100': [21100, 21199], //     Accounts Payable
  '21300': [21300, 21399], //     Accrued Liabilities
  '21400': [21400, 21499], //     Taxes Payable
  '21500': [21500, 21599], //     Short-Term Debt
  '21600': [21600, 21699], //     Other Current Liabilities
  '22000': [22000, 22999], //   Non-Current Liabilities
  '30000': [30000, 39999], // EQUITY
  '31000': [31000, 31999], //   Contributed Capital
  '33000': [33000, 33999], //   Distributions
  '40000': [40000, 49999], // REVENUE
  '41000': [41000, 41999], //   Operating Revenue
  '42000': [42000, 42999], //   Other Revenue
  '50000': [50000, 59999], // EXPENSES
  '51000': [51000, 51999], //   Cost of Goods Sold
  '52000': [52000, 52999], //   Operating Expenses
  '52100': [52100, 52199], //     Salaries and Wages
  '52200': [52200, 52299], //     Sales and Marketing
  '52300': [52300, 52399], //     General and Administrative
  '52400': [52400, 52499], //     Research and Development
  '52500': [52500, 52599], //     Depreciation and Amortization
  '53000': [53000, 53999], //   Other Expenses
}

// The seeded demo tenant is the full chart with "all
// triggers active", the standing chart of accounts after a completed setup.
const chartSeedAccounts: Omit<Account, 'internalId'>[] = FULL_CHART.map(r => {
  const range = r.glType === 'Summary' ? SEED_SUMMARY_RANGES[r.number] : undefined
  const cat = r.cat
  const isPosting = r.glType === 'Posting'
  const base: 'Debit' | 'Credit' = ['AST', 'EXP'].includes(cat) ? 'Debit' : 'Credit'
  const normalBalance = r.contra ? (base === 'Debit' ? 'Credit' : 'Debit') : base
  return {
    id: `acct_${r.number}`,
    accountNumber: r.number,
    accountName: r.name,
    accountType: cat,
    glAccountType: r.glType,
    // Roles are for posting accounts only; a structural line never carries one
    // even if its number happens to appear in the map.
    accountRole: isPosting ? SEED_ACCOUNT_ROLES[r.number] : undefined,
    statementClassification: classificationFor(r.number, cat),
    isPosting,
    normalBalance,
    currencyCode: r.currency ?? 'USD',
    status: r.status ?? 'Active',
    effectiveDate: '2026-01-01',
    postingRestrictions: {},
    // Posting accounts only. A summary takes no postings, so a default on one
    // would be a value nothing could ever carry.
    defaultDimensionValues: isPosting ? (SEED_DIMENSION_DEFAULTS[r.number] ?? []) : [],
    isContra: r.contra ?? false,
    // Figures are posting-only. A summary's balance and movement are the sum of
    // what is under it, taken live, so storing anything here would be a second
    // copy waiting to disagree with the tree.
    netChange: isPosting ? r.netChange : undefined,
    parentId: r.parent ? `acct_${r.parent}` : null,
    subsidiaryId: 'sub_main',
    balance: isPosting ? (r.balance ?? 0) : 0,
    // Not where only the system posts: the demo seeds nothing there, and the
    // flag says whether the ledger holds postings for the account.
    hasTransactions: isPosting && (r.status ?? 'Active') === 'Active' && (r.balance ?? 0) !== 0 && r.seedPostings !== false,
    masterChartRef: r.number,
    // Provenance. The flag is set from the key being present, not from the code
    // being there, so an inferred parent still reports where it came from.
    arrivedByImport: r.number in SEED_ARRIVAL_CODES,
    originalCode: SEED_ARRIVAL_CODES[r.number],
    /* Last touched is filled in below, from the log. An account nobody has
       edited was last touched when it was made, and saying so beats a date
       nothing in its history accounts for. */
    ...createdFor({ accountNumber: r.number, arrivedByImport: r.number in SEED_ARRIVAL_CODES }),
    updatedAt: '',
    updatedBy: '',
    ...SEED_BANK_DETAILS[r.number],
    ...(range ? { numberRangeStart: range[0], numberRangeEnd: range[1] } : {}),
  }
})

// Two accounts archived by default so the Archived tab is populated on first
// load. Each hangs off the summary it retired from, and each carries a zero
// balance, so the tree can place them without moving any figure.
const archivedSeedAccounts: Omit<Account, 'internalId'>[] = [
  {
    id: 'acct_arch_petty', accountNumber: '11180', accountName: 'Legacy Petty Cash (Closed)', accountType: 'AST',
    glAccountType: 'Posting', statementClassification: classificationFor('11180', 'AST'),
    isPosting: true, normalBalance: 'Debit', currencyCode: 'USD', status: 'Archived',
    effectiveDate: '2024-01-01', postingRestrictions: {}, defaultDimensionValues: [], isContra: false, netChange: 0,
    parentId: 'acct_11100', subsidiaryId: 'sub_main', balance: 0, hasTransactions: false, masterChartRef: '11180',
    // Migrated in with the rest of the cash branch, then retired here. Archiving
    // does not change where an account came from.
    arrivedByImport: true, originalCode: '1010-03',
    description: 'Closed during the 2024 banking consolidation.',
    // Migrated with the branch, so the import is what made it. Last touched is
    // the archiving, stamped from the log below.
    createdAt: IMPORT_RUN_AT, createdBy: IMPORT_RUN_BY, updatedAt: '', updatedBy: '',
  },
  {
    id: 'acct_arch_print', accountNumber: '52600', accountName: 'Discontinued Print Advertising', accountType: 'EXP',
    glAccountType: 'Posting', statementClassification: classificationFor('52600', 'EXP'),
    isPosting: true, normalBalance: 'Debit', currencyCode: 'USD', status: 'Archived',
    effectiveDate: '2024-01-01', postingRestrictions: {}, defaultDimensionValues: [], isContra: false, netChange: 0,
    parentId: 'acct_52000', subsidiaryId: 'sub_main', balance: 0, hasTransactions: false, masterChartRef: '52600',
    description: 'Retired after moving spend fully to digital channels.',
    createdAt: todayMinus(610), createdBy: HAND_BUILT_BY, updatedAt: '', updatedBy: '',
  },
]

/* Last touched, stamped from the change log rather than declared alongside it.
   The card on the detail page and the Activity tab beneath it are answering the
   same question, so one of them has to be reading the other - and the log is the
   record, so the card reads it.

   An account nobody has edited was last touched when it was made. That is a
   truthful answer, and it is the one the log gives. */
const lastTouched = (a: { id: string; createdAt: string; createdBy: string }) => {
  const newest = CURATED_AUDIT
    .filter(e => e.accountId === a.id)
    .reduce<AuditEntry | undefined>((m, e) => (!m || e.timestamp > m.timestamp ? e : m), undefined)
  return newest
    ? { updatedAt: newest.timestamp, updatedBy: newest.user }
    : { updatedAt: a.createdAt, updatedBy: a.createdBy }
}

/* Internal ids are stamped here, in one place, over the whole seeded chart -
   including the archived pair, which is the point: an archived account holds its
   id, and skipping it would hand that id to a live account later. Position in
   this list is the order, so the same tenant reloads to the same ids. */
export const seedAccounts: Account[] = [...chartSeedAccounts, ...archivedSeedAccounts]
  .map((a, i) => ({ ...a, internalId: formatInternalId(i + 1), ...lastTouched(a) }))

// All twelve months of FY-2026, the year the demo is read in. 2026 is NOT a leap
// year, so February ends on the 28th. Q1 (Jan–Mar) is fully closed via a prior
// close (Hard-Locked); Q2 (Apr–Jun) is soft-closed and in review (closeable - the
// close action still has to Hard-Lock it); Q3/Q4 (Jul–Dec) stay Open.
//
// The full year is declared even though postings stop at today, so the period
// picker and the close flow have the months ahead to work with. Only the Open
// months up to today carry movement - the rest are empty because posting into
// them would mean future-dating the ledger.
const fy2026Periods: Period[] = [
  { id: 'p_2026_01', label: 'Jan 2026', startDate: '2026-01-01', endDate: '2026-01-31', status: 'Hard-Locked' },
  { id: 'p_2026_02', label: 'Feb 2026', startDate: '2026-02-01', endDate: '2026-02-28', status: 'Hard-Locked' },
  { id: 'p_2026_03', label: 'Mar 2026', startDate: '2026-03-01', endDate: '2026-03-31', status: 'Hard-Locked' },
  { id: 'p_2026_04', label: 'Apr 2026', startDate: '2026-04-01', endDate: '2026-04-30', status: 'Soft-Closed' },
  { id: 'p_2026_05', label: 'May 2026', startDate: '2026-05-01', endDate: '2026-05-31', status: 'Soft-Closed' },
  { id: 'p_2026_06', label: 'Jun 2026', startDate: '2026-06-01', endDate: '2026-06-30', status: 'Soft-Closed' },
  { id: 'p_2026_07', label: 'Jul 2026', startDate: '2026-07-01', endDate: '2026-07-31', status: 'Open' },
  { id: 'p_2026_08', label: 'Aug 2026', startDate: '2026-08-01', endDate: '2026-08-31', status: 'Open' },
  { id: 'p_2026_09', label: 'Sep 2026', startDate: '2026-09-01', endDate: '2026-09-30', status: 'Open' },
  { id: 'p_2026_10', label: 'Oct 2026', startDate: '2026-10-01', endDate: '2026-10-31', status: 'Open' },
  { id: 'p_2026_11', label: 'Nov 2026', startDate: '2026-11-01', endDate: '2026-11-30', status: 'Open' },
  { id: 'p_2026_12', label: 'Dec 2026', startDate: '2026-12-01', endDate: '2026-12-31', status: 'Open' },
]

/* Two closed years behind the current one, so the fiscal-year pane of the period
   picker has more than a single row in it and a reader can see what looking at a
   prior year does. They carry no postings: the seeded ledger is authored against
   FY2026 and anchored to it (SEED_TX_START below reads fy2026Periods, not this
   list, so reaching the books further back cannot spread the demo's entries over
   three years). Hard-Locked because that is what a year two closes past is - a
   prior year still soft-closed would be a company that never finished it. */
const priorYearPeriods: Period[] = [2024, 2025].flatMap(year =>
  fy2026Periods.map(p => ({
    ...p,
    id: `p_${year}${p.id.slice(6)}`,
    label: p.label.replace('2026', String(year)),
    startDate: `${year}${p.startDate.slice(4)}`,
    // 2024 is a leap year, so February has a 29th there and a 28th in 2025.
    endDate: p.startDate.slice(5, 7) === '02' && year % 4 === 0
      ? `${year}-02-29`
      : `${year}${p.endDate.slice(4)}`,
    status: 'Hard-Locked' as const,
  })),
)

// Every month that has ended is locked (lib/periodClose, lockEndedPeriods).
export const seedPeriods: Period[] = lockEndedPeriods([...priorYearPeriods, ...fy2026Periods], todayIso())

// Each posting source maps to a source-document type. `prefix` builds the
// human-facing linked-document ID (e.g. INV-2024-1000) and `label` names the
// document it links back to (e.g. "vendor invoice"). Sources with `linked:false`
// originate in the ledger itself - they have a GL entry but no source document.
export const SOURCE_DOC: Record<string, { prefix: string; label: string; linked: boolean; name?: string }> = {
  'Customer Invoice': { prefix: 'CINV', label: 'customer invoice', linked: true },
  'Customer payments': { prefix: 'CPMT', label: 'customer payments', linked: true },
  'Vendor Invoice': { prefix: 'INV', label: 'vendor invoice', linked: true },
  'Vendor Payments': { prefix: 'VPMT', label: 'vendor payments', linked: true },
  'Cash Management': { prefix: 'CM', label: 'cash management', linked: true },
  'RMA': { prefix: 'RMA', label: 'RMA', linked: true },
  'Receiving': { prefix: 'GRN', label: 'receiving', linked: true },
  'Payroll': { prefix: 'PAY', label: 'payroll run', linked: true },
  'Manual JE': { prefix: 'JE', label: 'manual journal entry', linked: false },
  // Posted by archiving an account that still holds a balance. See
  // `buildBalanceTransferEntry`.
  // Named as its entry type names it, not title-cased: the entry's Type reads
  // "Archive transfer", and the Source column beside it said "Archive Transfer".
  'Archive transfer': { prefix: 'JE', label: 'archive transfer', linked: false, name: 'Archive transfer' },
}
export const sourceDocLabel = (source: string) => SOURCE_DOC[source]?.label ?? 'source document'
/* A source as a column, a filter or a tile writes it on its own: the document's
   name with each word raised ("Customer Invoice"), unless the source spells
   itself out. One function, so no surface capitalises it differently from
   another - CSS `capitalize` did this, and could not spare the one exception. */
export const sourceDocName = (source: string) =>
  SOURCE_DOC[source]?.name ?? sourceDocLabel(source).replace(/\b\w/g, c => c.toUpperCase())
export const sourceHasLinkedDoc = (source: string) => SOURCE_DOC[source]?.linked ?? false

// Postings run from the first seeded period's start up to today, and no further.
// Two bounds, both load-bearing: the seeded periods, so a posting can never land
// in a period the app doesn't know about, and the wall clock, so it can never be
// dated in the future. Anchoring on the last period's end alone satisfied the
// first and broke the second - a quarter of the postings sat months ahead of
// today, which surfaced as a running balance struck "as of" a future date.
//
// The consequence is intended: periods after the current one hold no postings,
// which is what a real ledger looks like. Each posting's period label is derived
// from its own date, so the two can never disagree.
// ISO dates compare correctly as strings, so the clamp is a min then a max: the
// earlier of today / the last period end, but never before the first period start
// (which would otherwise pile every posting onto a date no period contains, were
// the demo ever run before the seeded year).
const SEED_TX_START = fy2026Periods[0].startDate
const SEED_TX_END = [
  [todayIso(), fy2026Periods[fy2026Periods.length - 1].endDate].sort()[0],
  SEED_TX_START,
].sort()[1]
const SEED_TX_SPAN = Math.round((+new Date(SEED_TX_END) - +new Date(SEED_TX_START)) / 86_400_000)
// Days elapsed in the accounting month the app opens on. Load-bearing because
// every period selector defaults to the current month: spread uniformly over the
// year, a register showed one or two rows on the 4th, since four days is under 2%
// of the span. Accounts get a separate month-to-date quota drawn from this window
// so the view a reader actually lands on is never near-empty, however early in
// the month the demo is run.
const SEED_MTD_SPAN = Math.min(
  SEED_TX_SPAN,
  Math.round((+new Date(SEED_TX_END) - +new Date(`${SEED_TX_END.slice(0, 7)}-01`)) / 86_400_000),
)
/* Counted in UTC so the arithmetic never crosses a daylight-saving seam, but
   handed back as a bare calendar day: a posting date carries no time. */
const seedDateDaysAgo = (d: number) => {
  const t = new Date(`${SEED_TX_END}T00:00:00.000Z`)
  t.setUTCDate(t.getUTCDate() - d)
  return t.toISOString().slice(0, 10)
}
const periodForDate = (iso: string) =>
  seedPeriods.find(p => iso >= p.startDate && iso <= p.endDate) ?? seedPeriods[seedPeriods.length - 1]

// Which grouping label each posting account sits under: the name of the summary
// it hangs from. Scenario legs name a group rather than an account, so the chart
// can gain or lose accounts without stranding narration. Read off the parent link
// rather than restated per row - it was authored on all 101 posting rows and was
// the parent's name on every one of them, which is a copy with nothing to gain
// and a rename to get wrong.
const NAME_BY_NUMBER: Record<string, string> = Object.fromEntries(FULL_CHART.map(r => [r.number, r.name]))
export const GROUP_BY_NUMBER: Record<string, string> = Object.fromEntries(
  FULL_CHART.filter(r => r.glType === 'Posting' && r.parent).map(r => [r.number, NAME_BY_NUMBER[r.parent!] ?? '']),
)

// Deterministic PRNG (mulberry32). The whole ledger derives from these postings -
// every opening balance, KPI card and chart - so a Math.random() draw meant the
// figures changed on every page load and no number could be checked, screenshotted
// or pinned by a test. One fixed constant makes the demo reproducible.
const rng = (() => {
  let s = 0x9e3779b9
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
})()

/* The accounts the demo seeds postings on: every posting account with a figure,
   less the ones only the system posts to (see `seedPostings` in fullChart.ts),
   which `hasTransactions` already leaves out. */
export const isSeedPostingAccount = (a: Account) => a.isPosting && a.hasTransactions

export const seedTransactions: Transaction[] = (() => {
  const txs: Transaction[] = []
  const accounts = seedAccounts.filter(isSeedPostingAccount)
  const groupOf = (a: Account) => GROUP_BY_NUMBER[a.accountNumber] ?? ''

  // Accounts a given leg can land on: right group, contra-ness matching what the
  // leg asks for, and within the leg's own shortlist when it names one. A leg
  // without `contra` excludes contra accounts, because "Record raw material"
  // belongs on Inventory, not on Inventory Reserve. The shortlist matters just as
  // much: a group is coarser than its members, so "Capitalize tooling" would
  // otherwise land on Vehicles.
  const legFits = (leg: ScenarioLeg, a: Account) =>
    groupOf(a) === leg.group
    && a.isContra === !!leg.contra
    && (!leg.accounts || leg.accounts.includes(a.accountNumber))
  const poolFor = (leg: ScenarioLeg) => accounts.filter(a => legFits(leg, a))

  // Index legs by the accounts they can land on, but only register a scenario
  // when BOTH its legs have a real account - an unsatisfiable scenario must be
  // unpickable rather than silently emitting a one-sided entry.
  type LegRef = { scenario: TxScenario; side: 'Debit' | 'Credit' }
  const legsByAccount = new Map<string, LegRef[]>()
  for (const scenario of TX_SCENARIOS) {
    const pools = { Debit: poolFor(scenario.debit), Credit: poolFor(scenario.credit) } as const
    if (!pools.Debit.length || !pools.Credit.length) continue
    for (const side of ['Debit', 'Credit'] as const) {
      for (const a of pools[side]) {
        if (!legsByAccount.has(a.id)) legsByAccount.set(a.id, [])
        legsByAccount.get(a.id)!.push({ scenario, side })
      }
    }
  }
  const legsFor = (a: Account) => legsByAccount.get(a.id) ?? []

  // How busy an account's register is follows from the events that touch it: the
  // operating bank account sees daily settlements, Bonds Payable sees an issue
  // and little else. Without this every account got the same 12-30 postings, so
  // the ledger read as though the plant bought land every fortnight.
  const VOLUME: Record<'high' | 'normal' | 'low', [number, number]> = {
    high: [96, 168], normal: [36, 72], low: [8, 24],
  }
  // Postings for the current month, on top of the year's. See SEED_MTD_SPAN.
  const MTD_VOLUME: Record<'high' | 'normal' | 'low', [number, number]> = {
    high: [10, 18], normal: [4, 9], low: [1, 3],
  }
  const bandFor = (a: Account) => {
    const cadences = legsFor(a).map(l => l.scenario.cadence ?? 'normal')
    if (!cadences.length) return 'normal' as const
    return cadences.includes('high') ? 'high' as const : cadences.includes('normal') ? 'normal' as const : 'low' as const
  }
  const drawCount = ([min, max]: [number, number]) => min + Math.floor(rng() * (max - min + 1))
  const postingCount = (a: Account) => drawCount(VOLUME[bandFor(a)])
  const mtdCount = (a: Account) => drawCount(MTD_VOLUME[bandFor(a)])

  // How much a year of postings may carry an account away from the closing
  // balance the chart publishes. It matters because the fiscal-year opening is
  // derived as closing minus movement (see seedQ1Openings): with movement
  // unbounded, a $520K money-market account opened at -$62M. Holding the cap
  // under 100% of the account's own size is what keeps every derived opening on
  // the same side of zero as its closing.
  //
  // Revenue and expense accounts accumulate their whole balance over the year, so
  // nearly all of it can be this year's movement. A balance-sheet account carries
  // most of its balance in from the prior year, so only a slice of it moves.
  const MOVEMENT_CAP: Record<string, number> = { REV: 0.9, EXP: 0.9 }
  const capOf = (a: Account) => Math.abs(a.balance) * (MOVEMENT_CAP[a.accountType] ?? 0.55)
  // The cap is on an account's NET movement, but its gross throughput is a
  // multiple of that: an operating account receives and pays out many times its
  // own balance over a year and still closes near where it opened. Sizing
  // postings off the net cap alone made every figure in the ledger about four
  // times too quiet.
  const GROSS_TURNOVER = 4

  const moved = new Map<string, number>()
  // +1 when posting on this side grows the account's natural balance.
  const sideSign = (a: Account, side: 'Debit' | 'Credit') => (a.normalBalance === side ? 1 : -1)
  const headroom = (a: Account, side: 'Debit' | 'Credit') =>
    Math.max(0, capOf(a) - sideSign(a, side) * (moved.get(a.id) ?? 0))
  const spend = (a: Account, side: 'Debit' | 'Credit', amount: number) => {
    moved.set(a.id, (moved.get(a.id) ?? 0) + sideSign(a, side) * amount)
  }

  // What the event is worth, relative to the accounts it touches. A flat band put
  // a quarter of a million dollars of cutting fluid on an expense claim, and an
  // absolute band can't be right for both a $845K operating account and a $4K
  // stamp float, so the scenario supplies only an order of magnitude and the
  // accounts supply the scale.
  const SIZE_WEIGHT: Record<'tiny' | 'small' | 'mid' | 'large', number> = {
    tiny: 0.3, small: 0.65, mid: 1, large: 2,
  }
  const weightFor = (scenario?: TxScenario) =>
    SIZE_WEIGHT[scenario?.size ?? 'mid'] * (0.65 + rng() * 0.7)

  // ─── Pass 1: plan the entries, amounts excluded ───
  // An entry's worth depends on how thinly every account it touches has to spread
  // its cap, which isn't known until the whole year is planned. Sizing entries as
  // they were emitted spent the early accounts' caps on their first few postings
  // and left eighteen accounts with an empty register.
  type PlannedLine = {
    account: Account
    side: 'Debit' | 'Credit'
    // The entry amount this line takes. The primary line takes all of it; a
    // compound entry's two counterparts split it 60/40.
    frac: number
    // The narration is held as its leg, not as finished text, because it can
    // embed the source document reference and the reference is not issued until
    // the entry has a number. See the numbering pass.
    leg?: ScenarioLeg
    fallback: string
    dimensionValues: { dimensionId: string; value: string }[]
  }
  type PlannedEntry = {
    date: string; periodLabel: string; source: string
    entryType: 'Simple' | 'Compound' | 'Reversing'
    scenarioId?: string
    weight: number
    lines: PlannedLine[]
    /** A figure written by hand, posted as it stands rather than sized. */
    amount?: number
  }
  const plan: PlannedEntry[] = []

  // Which period-end scenarios have already been posted, so a close is done once
  // per period however many accounts reach for it.
  const closedAt = new Set<string>()
  // Each "primary" iteration plans one line on `a` plus 1-2 counterpart lines on
  // other accounts, all sharing one jeNumber - producing real multi-account
  // journal entries (Simple = 2 lines, Compound = 3 lines). Primary counts are
  // halved from the pre-JE-grouping model so totals stay roughly the same.
  accounts.forEach(a => {
    const candidates = legsFor(a)
    const yearCount = postingCount(a)
    const mtd = mtdCount(a)
    const count = yearCount + mtd
    for (let i = 0; i < count; i++) {
      // Spread postings across the full seeded year, then the month-to-date quota
      // across the current month alone. The period label is derived from the date,
      // so the two always agree either way.
      const daysAgo = i < yearCount
        ? Math.floor(rng() * (SEED_TX_SPAN + 1))
        : Math.floor(rng() * (SEED_MTD_SPAN + 1))
      const drawn = seedDateDaysAgo(daysAgo)
      // The scenario decides the event: its source, its party, both legs'
      // wording and which account families the other side may land on. The side
      // `a` posts on comes from the matched leg, NOT from a.normalBalance - a
      // payable being cleared is a debit to a credit-normal account, and forcing
      // the normal side would make half this narration unreachable.
      const pick = candidates.length ? candidates[Math.floor(rng() * candidates.length)] : undefined
      const scenario = pick?.scenario
      /* A period-end event takes the period's last day rather than the day it was
         drawn on, and takes it once. Left on the drawn day it posted whenever the
         die fell, so the GBP retranslation appeared every few days - a close that
         never ends. A period the close has not reached yet gets no entry at all
         rather than one dated ahead of the ledger. */
      const closeOnly = scenario?.timing === 'period-end'
      const period = periodForDate(closeOnly ? periodForDate(drawn).endDate : drawn)
      if (closeOnly && (period.endDate > SEED_TX_END || closedAt.has(`${scenario!.id}|${period.id}`))) continue
      if (closeOnly) closedAt.add(`${scenario!.id}|${period.id}`)
      const date = closeOnly ? period.endDate : drawn
      const primarySide: 'Debit' | 'Credit' = pick
        ? pick.side
        : a.normalBalance === 'Credit' ? 'Credit' : 'Debit'
      const source = scenario?.source ?? 'Manual JE'
      const primaryLeg = pick && (pick.side === 'Debit' ? scenario!.debit : scenario!.credit)
      const oppositeLeg = pick && (pick.side === 'Debit' ? scenario!.credit : scenario!.debit)
      // Most entries are simple (one debit, one credit). Manual entries are more
      // often compound; a small slice of accruals are reversing entries.
      const others = oppositeLeg ? poolFor(oppositeLeg).filter(x => x.id !== a.id) : accounts.filter(x => x.id !== a.id)
      // No counterpart means no entry at all: a lone primary line would leave an
      // unbalanced JE in the ledger.
      if (!others.length) continue
      const entryType: 'Simple' | 'Compound' | 'Reversing' =
        source === 'Manual JE' && i % 3 === 0 && others.length >= 2 ? 'Compound'
          : source === 'Payroll' && i % 5 === 0 ? 'Reversing'
          : 'Simple'
      /* The draw runs for every account, including the ones whose result is
         thrown away on the next line. One generator is seeded for the whole
         ledger, so a call skipped here shifts the sequence for everything after
         it, and every authored figure in the demo moves. */
      const drawnDims: { dimensionId: string; value: string }[] = []
      if (i < 2 + Math.floor(rng() * 2)) {
        drawnDims.push({ dimensionId: 'dim_location', value: ['USA', 'Hong Kong', 'Singapore', 'United Kingdom'][Math.floor(rng() * 4)] })
        if (rng() < 0.6) drawnDims.push({ dimensionId: 'dim_department', value: ['Business', 'Design', 'Engineering', 'Sales', 'Operations'][Math.floor(rng() * 5)] })
      }
      /* An account that fixes its own dimensions hands them to every line that
         touches it - that is what a default is. Without this, Direct Labor would
         read Singapore on the account and Hong Kong on half its own register. */
      const dimensionValues = a.defaultDimensionValues.length ? postingDimensions(a.defaultDimensionValues) : drawnDims
      // Counterpart line(s) on the opposite side, drawn from the opposite leg's
      // group so the two halves describe one event. Compound entries split across
      // two counterparts (60/40); simple entries use one.
      const oppositeSide: 'Debit' | 'Credit' = primarySide === 'Debit' ? 'Credit' : 'Debit'
      const counterpartCount = entryType === 'Compound' && others.length >= 2 ? 2 : 1
      const takers: Account[] = []
      for (let j = 0; j < counterpartCount; j++) {
        const free = others.filter(x => !takers.some(t => t.id === x.id))
        const pool = free.length ? free : others
        takers.push(pool[Math.floor(rng() * pool.length)])
      }
      const cpFracs = counterpartCount === 2 ? [0.6, 0.4] : [1]
      plan.push({
        date, periodLabel: period.label, source, entryType,
        scenarioId: scenario?.id,
        weight: weightFor(scenario),
        lines: [
          { account: a, side: primarySide, frac: 1, leg: primaryLeg || undefined, fallback: `${a.accountName} posting`, dimensionValues },
          ...takers.map((b, j) => ({
            account: b,
            side: oppositeSide,
            frac: cpFracs[j],
            leg: oppositeLeg || undefined,
            fallback: `${b.accountName} posting`,
            // The other half of the entry answers for its own account, not for
            // the one that drew the entry.
            dimensionValues: postingDimensions(b.defaultDimensionValues),
          })),
        ],
      })
    }
  })

  // ─── Pass 2: size the planned entries ───
  // Each account spreads its throughput evenly across the lines that will touch
  // it, so a busy register gets many modest postings and a quiet one a few large
  // ones. An entry is worth the least its accounts can each afford, scaled by the
  // event's own magnitude. The 0.4 share is checked against 0.5 so the integer
  // rounding below still fits the room it was checked against.
  const lineCount = new Map<string, number>()
  // Lines counted with a sign: +1 where the posting grows the account's natural
  // balance, -1 where it shrinks it. The total tells us how one-sided the account
  // is, which is what its gross throughput actually depends on.
  const netLines = new Map<string, number>()
  plan.forEach(e => e.lines.forEach(l => {
    lineCount.set(l.account.id, (lineCount.get(l.account.id) ?? 0) + 1)
    netLines.set(l.account.id, (netLines.get(l.account.id) ?? 0) + sideSign(l.account, l.side))
  }))

  // GROSS_TURNOVER can only be spent by an account whose postings offset each
  // other. A revenue account is only ever credited, so its gross throughput IS
  // its net movement and the cap allows one turn, not four. Charging it four
  // meant three quarters of its year ran out of room and was dropped - and
  // because sizing runs in date order, the dropped ones were always the latest,
  // which is why the register thinned out month by month and the current month
  // was nearly empty. Allowed turns are therefore 1/bias: balanced accounts keep
  // the full four, one-sided accounts get one.
  const turnoverOf = (a: Account) => {
    const lines = Math.max(1, lineCount.get(a.id) ?? 1)
    const bias = Math.abs(netLines.get(a.id) ?? 0) / lines
    return Math.min(GROSS_TURNOVER, 1 / Math.max(bias, 1 / GROSS_TURNOVER))
  }
  // Held under the cap rather than at it, because each entry's size is jittered by
  // `weightFor` and an account that spends its last room mid-year loses every
  // posting after it. The headroom left over just means slightly quieter figures.
  const CAP_UTILISATION = 0.8
  // The smallest entry worth emitting. See the guard in pass 2. Deliberately low:
  // a $12 petty cash posting is real, and anything higher silently emptied the
  // registers of the small accounts, whose every posting is legitimately tiny.
  const MIN_ENTRY = 10
  const perLine = (a: Account) =>
    capOf(a) * turnoverOf(a) * CAP_UTILISATION / Math.max(1, lineCount.get(a.id) ?? 1)
  const checkFrac = (frac: number) => (frac === 0.4 ? 0.5 : frac)

  /* Petty Cash moves both ways across the year, so its Net change trend shows
     months up and months down. Mahad, 2026-10-15: *"the Net Change Trend widget
     is currently showing either only positive numbers or only negative numbers
     over time. Can we put some dummy data into the Petty Cash account that
     displays both positive and negative changes over, say, 12 months? The
     developers were asking for this."* The generator only ever paid vouchers out
     of it, so every month fell. These top it up from the operating account in
     some months and send a surplus back in others, against the vouchers already
     there. Fixed amounts, added after the sizing budget is read and never drawn
     from it, so every generated figure stays as it was. The authored balance is
     untouched; the fiscal-year opening is worked out from it (seedQ1Openings). */
  const pettyCash = accounts.find(a => a.accountNumber === '11110')
  const operating = accounts.find(a => a.accountNumber === '11130')
  if (pettyCash && operating) {
    const PETTY_CASH_SWINGS: [string, number][] = [
      // [date, amount]: positive tops the float up, negative returns a surplus.
      ['2026-01-12', 310], ['2026-02-17', -140], ['2026-03-09', 180],
      ['2026-04-21', -120], ['2026-05-11', 280], ['2026-06-08', 125],
      ['2026-07-20', -110], ['2026-08-10', 160], ['2026-10-06', 210],
    ]
    for (const [date, signed] of PETTY_CASH_SWINGS) {
      if (date > SEED_TX_END) continue
      const topUp = signed > 0
      const dims = (a: Account) => postingDimensions(a.defaultDimensionValues)
      plan.push({
        date, periodLabel: periodForDate(date).label, source: 'Cash Management', entryType: 'Simple',
        weight: 0, amount: Math.abs(signed),
        lines: [
          { account: pettyCash, side: topUp ? 'Debit' : 'Credit', frac: 1, dimensionValues: dims(pettyCash),
            fallback: topUp ? 'Top up the petty cash float from the operating account' : 'Return surplus petty cash to the operating account' },
          { account: operating, side: topUp ? 'Credit' : 'Debit', frac: 1, dimensionValues: dims(operating),
            fallback: topUp ? 'Transfer to top up the petty cash float' : 'Surplus petty cash returned' },
        ],
      })
    }
  }

  // Sized in date order, so an account's receipts and payments interleave the way
  // they do in a real register and its net movement stays near zero all year.
  // Sizing account by account instead pushed every receipt through the bank
  // before any payment, hit the cap in March, and trimmed the rest to nothing.
  plan.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))

  /* Entry numbers are issued here, in the same date order the entries are sized
     in, and only to the entries that survive sizing. Issued during planning they
     came out in account order, so JE-2026-2001 could be dated December and
     JE-2026-7000 dated January - a number that says an entry was written late
     against a date that says it was written early, with gaps where the sizing
     pass had dropped an entry. One counter per series is what makes the two
     readings agree: a higher number is always a later entry, so the register's
     date order IS its posting order and there is nothing for a reader to
     reconcile. Back-dating an entry is still allowed - the app's own posting
     flow does it deliberately, with a prior-period reason - but a back-dated
     entry then carries a number issued after the ones it sits behind, which is
     exactly what happened. */
  const series = new Map<string, number>()
  const issue = (prefix: string, year: string, from: number) => {
    const key = `${prefix}-${year}`
    const next = (series.get(key) ?? from) + 1
    series.set(key, next)
    return `${key}-${next}`
  }

  let id = 0
  plan.forEach(e => {
    const afford = Math.min(...e.lines.map(l => perLine(l.account) / checkFrac(l.frac)))
    const room = Math.min(...e.lines.map(l => headroom(l.account, l.side) / checkFrac(l.frac)))
    // At least the floor, but never more than the room left. Lifting rather than
    // dropping matters for the small accounts: a $6K supplies account that is a
    // counterpart to hundreds of events spreads its cap so thinly that every one
    // of its entries came out under a dollar and was discarded, leaving its
    // register empty. Room is still the hard ceiling, so no cap is breached.
    const amount = e.amount ?? Math.floor(Math.min(Math.max(afford * e.weight, MIN_ENTRY), room))
    // Genuinely no room left on one of the accounts. A token posting reads as a
    // data fault, and no entry at all is the honest outcome, since the journal
    // entry has to balance either way.
    if (amount < MIN_ENTRY) return
    // Every seeded entry lands in the one JE- series. A manual journal entry has
    // no linked source document, so `reference` stays empty for those.
    const year = e.date.slice(0, 4)
    const doc = SOURCE_DOC[e.source]
    const jeNumber = issue('JE', year, 2000)
    const reference = doc.linked ? issue(doc.prefix, year, 1000) : ''
    // Shares are taken off the entry amount rather than computed independently, so
    // the debits and credits of a compound entry still agree to the cent.
    let remaining = amount
    const amounts = e.lines.slice(1).map((l, j, arr) => {
      const share = j === arr.length - 1 ? remaining : Math.floor(amount * l.frac)
      remaining -= share
      return share
    })
    e.lines.forEach((l, j) => {
      const value = j === 0 ? amount : amounts[j - 1]
      // A hand-written figure stays out of the generator's budget.
      if (e.amount == null) spend(l.account, l.side, value)
      txs.push({
        id: `tx_${id++}`,
        accountId: l.account.id,
        date: e.date, source: e.source, jeNumber, reference,
        entryType: e.entryType,
        description: l.leg ? formatLeg(l.leg, e.date, reference) : l.fallback,
        scenarioId: e.scenarioId,
        debit: l.side === 'Debit' ? value : 0,
        credit: l.side === 'Credit' ? value : 0,
        runningBalance: 0,
        dimensionValues: l.dimensionValues,
        period: e.periodLabel,
      })
    })
  })
  // Newest first, which is reverse posting order - not date alone, or the
  // entries sharing a day came out in whatever order the plan happened to hold
  // them while the days around them ran the other way.
  txs.sort((a, b) => comparePostingOrder(b, a))
  /* One memo per entry, repeated on each of its postings, as a typed memo is.
     Nobody wrote these, so an entry's memo is the narration of its first posting
     - the posting the entry page reads as the entry's head. Left to each line,
     the same entry read one memo on the account's register and another on the
     Journal entries tab, depending on which of its lines each happened to show. */
  const memoOf = new Map<string, string>()
  for (const t of txs) if (!memoOf.has(t.jeNumber)) memoOf.set(t.jeNumber, t.description)
  for (const t of txs) t.memo = memoOf.get(t.jeNumber)
  /* A journal internal ID per entry, issued in the order the entries posted -
     oldest first, so the ledger's first entry is JNL-000001 - and repeated on each
     of its postings, as `addJournalEntry` does for an entry made in the app. */
  const idOf = new Map<string, string>()
  for (let i = txs.length - 1; i >= 0; i--) {
    const je = txs[i].jeNumber
    if (!idOf.has(je)) idOf.set(je, formatJournalInternalId(idOf.size + 1))
  }
  for (const t of txs) t.entryInternalId = idOf.get(t.jeNumber)
  return txs
})()

// The fiscal-year opening balance per posting account, derived so the period-
// close engine can drive off transactions while leaving the hand-authored
// `Account.balance` (the shown closing) intact: opening = authored closing −
// full-year normal-side movement. Feeding this as each account's Q1 opening makes
// closing(Q4) reconcile back to the number the GL/COA already display.
//
// This only produces a sane opening because the generator caps each account's
// year movement at MOVEMENT_CAP of its own size, so the opening lands within
// that fraction of the closing and on the same side of zero. A contra account
// opens negative, matching the negative closing the chart publishes for it.
export const seedQ1Openings: Record<string, number> = (() => {
  const acctById = new Map(seedAccounts.map(a => [a.id, a]))
  const movement = new Map<string, number>()
  for (const t of seedTransactions) {
    const a = acctById.get(t.accountId)
    if (!a) continue
    movement.set(t.accountId, (movement.get(t.accountId) ?? 0) + normalSideDelta(a, t))
  }
  const out: Record<string, number> = {}
  for (const a of seedAccounts) {
    if (!a.isPosting) continue
    out[a.id] = a.balance - (movement.get(a.id) ?? 0)
  }
  // Current Year Earnings opens on what revenue less expenses opened on, since
  // their postings are what move it (lib/currentYearEarnings).
  const earnings = seedAccounts.find(isCurrentYearEarnings)
  if (earnings) out[earnings.id] = earningsOpening(seedAccounts, out)
  return out
})()

export const seedJournalEntries: JournalEntry[] = [
  { id: 'je_001', date: dayMinus(2), reference: 'JE-1042', description: 'Payroll accrual', status: 'Open', lines: [
    { accountId: 'acct_52110', debit: 2_400_000, credit: 0 },     // Salaries and Wages Expense
    { accountId: 'acct_21310', debit: 0, credit: 2_400_000 },     // Accrued Wages Payable
  ]},
  { id: 'je_002', date: dayMinus(5), reference: 'JE-1041', description: 'Monthly depreciation', status: 'Draft', lines: [
    { accountId: 'acct_52510', debit: 620_000, credit: 0 },       // Depreciation Expense
    { accountId: 'acct_12150', debit: 0, credit: 620_000 },       // Accumulated Depreciation - Machinery and Equipment
  ]},
]

export const seedRecurring: RecurringTemplate[] = [
  { id: 'rt_rent', name: 'Monthly Rent', accountIds: ['acct_52310', 'acct_11130'], frequency: 'Monthly · 1st' },
  { id: 'rt_dep',  name: 'Depreciation accrual', accountIds: ['acct_52510', 'acct_12150'], frequency: 'Monthly · last day' },
  { id: 'rt_sal',  name: 'Salaries accrual',    accountIds: ['acct_52110', 'acct_21310'], frequency: 'Monthly · 25th' },
]

const baseAuditLog: AuditEntry[] = [
  ...CURATED_AUDIT,
  /* Baseline: every account gets a Create entry, read off the account itself so
     each detail page shows history that agrees with the card above it.
   *
   * It used to name its own creator (every fourth account, by index) and its own
   * date (120 days ago, for all of them), so a quarter of the chart had an
   * information card crediting the controller over a log crediting the import,
   * and the two archived accounts were created months after they were last
   * edited. Both facts belong to the account; nothing else may state them. */
  ...seedAccounts.map(a => ({
    id: `au_create_${a.id}`,
    accountId: a.id,
    action: 'Create' as const,
    user: a.createdBy,
    timestamp: a.createdAt,
  })),
]
export const seedAuditLog: AuditEntry[] = baseAuditLog.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))

/* A few accounts arrive with files already on them, so the Attachments tab is
   seen doing its job and not only its empty state. Kept to the accounts where a
   real team would have filed something: the operating bank account (the
   agreement and who signs) and the building lease.

   The folders spread across the five kinds the card grid draws differently -
   PDF, XLSX, DOC, PNG, JPG - so the tab is seen with its full badge set the way
   Partners' is. Every one of these opens: `lib/dummyAttachment.ts` builds the
   document from this metadata when a reader previews or downloads it, which is
   also why the DOC entries are `.rtf` - Word reads it, and we can write it. */
export const seedAccountAttachments: Record<string, EntryAttachment[]> = {
  acct_11130: [
    { id: 'att_11130_1', name: 'Chase business account agreement.pdf', size: '1.4 MB', date: `${dayMinus(210)}T14:00:00.000Z`, type: 'pdf', uploadedBy: 'Ayesha Khan (Controller)' },
    { id: 'att_11130_2', name: 'Signature card - 2026.pdf', size: '312 KB', date: `${dayMinus(96)}T11:20:00.000Z`, type: 'pdf', uploadedBy: 'Ayesha Khan (Controller)' },
    { id: 'att_11130_3', name: 'Wire approval limits.xlsx', size: '48 KB', date: `${dayMinus(21)}T15:10:00.000Z`, type: 'xlsx', uploadedBy: 'Ayesha Khan (Controller)' },
    { id: 'att_11130_4', name: 'Bank authorisation letter.rtf', size: '86 KB', date: `${dayMinus(140)}T10:05:00.000Z`, type: 'doc', uploadedBy: 'Marcus Lee (Accountant)' },
    { id: 'att_11130_5', name: 'Voided check - scan.png', size: '640 KB', date: `${dayMinus(63)}T13:45:00.000Z`, type: 'img', uploadedBy: 'Marcus Lee (Accountant)' },
  ],
  acct_52310: [
    { id: 'att_52310_1', name: 'Harbor Point lease - executed.pdf', size: '2.8 MB', date: `${dayMinus(180)}T16:30:00.000Z`, type: 'pdf', uploadedBy: 'Marcus Lee (Accountant)' },
    { id: 'att_52310_2', name: 'CAM reconciliation Q2.xlsx', size: '96 KB', date: `${dayMinus(9)}T09:02:00.000Z`, type: 'xlsx', uploadedBy: 'Marcus Lee (Accountant)' },
    { id: 'att_52310_3', name: 'Premises condition report.jpg', size: '1.1 MB', date: `${dayMinus(172)}T09:30:00.000Z`, type: 'img', uploadedBy: 'Marcus Lee (Accountant)' },
    { id: 'att_52310_4', name: 'Landlord correspondence.rtf', size: '54 KB', date: `${dayMinus(31)}T08:15:00.000Z`, type: 'doc', uploadedBy: 'Ayesha Khan (Controller)' },
  ],
}
