// =========================
// Full Chart of Accounts, from the "G/L Account Card"
// reference (see CHART_OF_ACCOUNTS_SPEC.md). This is the standing demo chart the
// app seeds from. It is intentionally SEPARATE from masterChart.ts (which the
// guided-setup wizard consumes) so the two can evolve independently.
//
// Rows are in number order (one exception, noted at 54000), and every row is a real account with a number. Two
// types, and the hierarchy is declared rather than inferred:
//   Summary  - a parent. Holds no figure of its own; its amount is the live sum
//              of what hangs beneath it. `parent` names its own parent's number,
//              or null for one of the five statement divisions.
//   Posting  - a leaf you post to. The only type carrying authored figures.
//
// Because structure is declared, the figures on a Summary are not authored at
// all: there is nothing to keep in step with a number range, and the balance
// sheet closes only as a live rollup, which is strictly stronger than a literal
// that agreed once. Assets 5,858,600 = liabilities 2,048,700 + equity 3,071,800
// + current year earnings 738,100 (revenue 3,300,000 less expenses 2,561,900),
// as arithmetic over the posting rows. fullChart.test.ts asserts it through
// buildChartIndex.
//
// Current year earnings is an account like any other (35000, Mahad,
// 2026-10-10: *"Current year earnings should exist like any other account"*),
// though nothing is authored on it: its balance is worked out as revenue less
// expenses wherever the chart is read (lib/currentYearEarnings, decision 57).
// Until it existed the year's profit was folded into the system retained
// earnings account, so equity balanced the balance sheet while the trial
// balance was out by exactly that profit - debits 8,420,500 against credits
// 9,158,600. Module review, 2026-10-06 (COA-05).
//
// The income statement is read off the REVENUE and EXPENSES summaries. There is
// deliberately no Net Income row: a "Revenue - Expenses" line matched no part of
// the tree, so it carried a hand-typed figure that drifted.
//
// `cat` is the GAAP Category. `netChange` / `balance` are the period movement and
// cumulative balance shown in the listing, and the listing derives Opening
// Balance as balance less netChange. A posting row's internal grouping label -
// what txScenarios.ts matches its legs against - is its parent summary's name,
// derived in seed.ts rather than restated per row.
// =========================

import type { AccountCategory, StatementClassification, GLAccountType } from '../types'

export interface ChartRow {
  number: string
  name: string
  cat: AccountCategory
  glType: GLAccountType
  /** Parent account's number. null only for a statement division. */
  parent: string | null
  contra?: boolean
  status?: 'Active' | 'Inactive'   // defaults Active
  currency?: string                // defaults USD
  netChange?: number
  balance?: number
  /** False where only the system posts: the demo seeds no postings on it. */
  seedPostings?: boolean
}

const P = (number: string, name: string, cat: AccountCategory, parent: string, netChange: number, balance: number, extra: Partial<ChartRow> = {}): ChartRow =>
  ({ number, name, cat, glType: 'Posting', parent, netChange, balance, ...extra })
const S = (number: string, name: string, cat: AccountCategory, parent: string | null): ChartRow =>
  ({ number, name, cat, glType: 'Summary', parent })

/* Statement classifications as number bands over this chart. The classification
   is what the listing's column and group-by read, and what the working capital
   KPI splits current from non-current on, so deriving it from the category alone
   put every asset in current assets and made working capital come out as total
   equity. Each band is the stretch one of the chart's own top summaries covers.

   Equity takes three bands rather than one, because contributed capital,
   retained earnings and what the owners take back out are three different lines
   on the statement, and income tax leaves the other-expense pile for the same
   reason: the statement subtotals pre-tax income above it. */
const CLASSIFICATION_BANDS: [StatementClassification, AccountCategory, number, number][] = [
  ['Current asset', 'AST', 11000, 11999],
  ['Non-current asset', 'AST', 12000, 12999],
  ['Current liability', 'LIA', 21000, 21999],
  ['Non-current liability', 'LIA', 22000, 22999],
  // The division's own number files with contributed capital, the first band.
  ['Contributed capital', 'EQT', 30000, 31999],
  ['Retained earnings', 'EQT', 32000, 32999],
  ['Distributions', 'EQT', 33000, 33999],
  // Comprehensive income is earnings the P&L never carried, so it files with the
  // earnings rather than with what the owners put in or took out.
  ['Retained earnings', 'EQT', 34000, 34999],
  // This year's earnings, before the close moves them into retained earnings.
  ['Retained earnings', 'EQT', 35000, 35999],
  ['Operating revenue', 'REV', 41000, 41999],
  ['Other income', 'REV', 42000, 42999],
  ['Cost of goods sold', 'EXP', 51000, 51999],
  ['Operating expense', 'EXP', 52000, 52999],
  ['Other expense', 'EXP', 53000, 53999],
  ['Income tax expense', 'EXP', 54000, 54999],
]

/* Which classification a seeded row sits in. An authoring device for the demo
   chart below, and nothing more: it reads the bands above, which are the
   stretches this chart's own top summaries cover. It is not a rule about
   numbering, and a customer's account is filed by the classification stated on
   it. */
export const classificationFor = (number: string, cat: AccountCategory): StatementClassification => {
  const n = parseInt(number, 10)
  const hit = CLASSIFICATION_BANDS.find(([, c, from, to]) => c === cat && n >= from && n <= to)
  return hit?.[0] ?? CLASSIFICATION_BANDS.find(([, c]) => c === cat)![0]
}

export const FULL_CHART: ChartRow[] = [
  // ============ BALANCE SHEET ============

  // ----- Assets -----
  S('10000', 'ASSETS', 'AST', null),
  S('11000', 'Current Assets', 'AST', '10000'),
  S('11100', 'Cash and Cash Equivalents', 'AST', '11000'),
  P('11110', 'Petty Cash', 'AST', '11100', 0, 1000),
  P('11120', 'Cash on Hand', 'AST', '11100', 2500, 8400),
  P('11130', 'Operating - Chase Bank', 'AST', '11100', 210400, 845300),
  P('11140', 'Payroll - Chase Bank', 'AST', '11100', -24600, 92500),
  P('11150', 'Money Market - JPMorgan', 'AST', '11100', -12000, 520000),
  P('11160', 'Savings - Barclays', 'AST', '11100', 56000, 312000, { currency: 'GBP' }),
  P('11170', 'EUR Account - Deutsche Bank', 'AST', '11100', -8400, 148600, { currency: 'EUR' }),
  S('11200', 'Short-Term Investments', 'AST', '11000'),
  P('11210', 'Marketable Securities', 'AST', '11200', 15000, 210000),
  P('11220', 'Certificates of Deposit', 'AST', '11200', 0, 100000),
  S('11300', 'Accounts Receivable', 'AST', '11000'),
  P('11310', 'Trade Receivables', 'AST', '11300', 88750, 402100),
  P('11320', 'Other Receivables', 'AST', '11300', 4200, 18900),
  P('11330', 'Allowance for Doubtful Accounts', 'AST', '11300', -4200, -18500, { contra: true }),
  S('11400', 'Inventory', 'AST', '11000'),
  P('11410', 'Raw Materials', 'AST', '11400', 28000, 96400),
  P('11420', 'Work in Process', 'AST', '11400', 12500, 44800),
  P('11430', 'Finished Goods', 'AST', '11400', 33000, 176400),
  P('11440', 'Inventory Reserve', 'AST', '11400', -3000, -14200, { contra: true }),
  S('11500', 'Prepaid Expenses and Other', 'AST', '11000'),
  P('11510', 'Prepaid Insurance', 'AST', '11500', 6400, 22300),
  P('11520', 'Prepaid Rent', 'AST', '11500', 12000, 24000),
  P('11530', 'Prepaid Subscriptions', 'AST', '11500', 3200, 9600),
  P('11540', 'Employee Advances', 'AST', '11500', 1500, 4200),
  S('12000', 'Non-Current Assets', 'AST', '10000'),
  S('12100', 'Property, Plant and Equipment', 'AST', '12000'),
  P('12105', 'Land', 'AST', '12100', 0, 250000),
  P('12110', 'Buildings', 'AST', '12100', 0, 1200000),
  P('12115', 'Leasehold Improvements', 'AST', '12100', 18000, 145000),
  P('12120', 'Machinery and Equipment', 'AST', '12100', 45000, 380000),
  P('12125', 'Furniture and Fixtures', 'AST', '12100', 6500, 62000),
  P('12130', 'Vehicles', 'AST', '12100', 0, 88000),
  P('12135', 'Computer Equipment', 'AST', '12100', 22400, 96800),
  P('12140', 'Accumulated Depreciation - Buildings', 'AST', '12100', -24000, -180000, { contra: true }),
  P('12145', 'Accumulated Depreciation - Leasehold Improvements', 'AST', '12100', -5000, -35000, { contra: true }),
  P('12150', 'Accumulated Depreciation - Machinery and Equipment', 'AST', '12100', -15000, -110000, { contra: true }),
  P('12155', 'Accumulated Depreciation - Furniture and Fixtures', 'AST', '12100', -3000, -22000, { contra: true }),
  P('12160', 'Accumulated Depreciation - Vehicles', 'AST', '12100', -4000, -25000, { contra: true }),
  P('12165', 'Accumulated Depreciation - Computer Equipment', 'AST', '12100', -1000, -18000, { contra: true }),
  S('12200', 'Intangible Assets', 'AST', '12000'),
  P('12210', 'Goodwill', 'AST', '12200', 0, 500000),
  P('12220', 'Patents and Trademarks', 'AST', '12200', 8000, 180000),
  P('12230', 'Software and Licenses', 'AST', '12200', 15000, 120000),
  P('12240', 'Accumulated Amortization', 'AST', '12200', 0, -77000, { contra: true }),
  S('12300', 'Other Non-Current Assets', 'AST', '12000'),
  P('12310', 'Long-Term Deposits', 'AST', '12300', 0, 60000),
  P('12320', 'Deferred Tax Assets', 'AST', '12300', 10000, 240000),

  // ----- Liabilities -----
  S('20000', 'LIABILITIES', 'LIA', null),
  S('21000', 'Current Liabilities', 'LIA', '20000'),
  /* Accounts Payable is a control summary, so what hangs under it has to be
     what the Accounts Payable role counts and nothing else - the KPI reads the
     role, the summary reads the tree, and the two sat on one screen disagreeing
     by the accrual. AP Accrual is goods received and not yet invoiced: a
     payable nobody has billed, which is why it carries the AP Accrual role
     rather than this one. It files beside the summary instead of inside it,
     which is where guidedSetup.ts has always put its equivalent. */
  S('21100', 'Accounts Payable', 'LIA', '21000'),
  P('21110', 'Trade Payables', 'LIA', '21100', 180000, 285000),
  P('21200', 'AP Accrual', 'LIA', '21000', 12000, 42000),
  S('21300', 'Accrued Liabilities', 'LIA', '21000'),
  P('21310', 'Accrued Wages and Salaries', 'LIA', '21300', 18000, 78000),
  P('21320', 'Accrued Interest', 'LIA', '21300', 1500, 9500),
  P('21330', 'Accrued Taxes', 'LIA', '21300', 6000, 21000),
  S('21400', 'Taxes Payable', 'LIA', '21000'),
  P('21410', 'Sales Tax Payable', 'LIA', '21400', 8000, 33000),
  P('21420', 'Payroll Tax Payable', 'LIA', '21400', 4500, 24500),
  P('21430', 'Income Tax Payable', 'LIA', '21400', 11000, 41000),
  S('21500', 'Short-Term Debt', 'LIA', '21000'),
  P('21510', 'Line of Credit', 'LIA', '21500', 120000, 150000),
  P('21520', 'Current Portion of Long-Term Debt', 'LIA', '21500', 0, 120000),
  S('21600', 'Other Current Liabilities', 'LIA', '21000'),
  P('21610', 'Deferred Revenue', 'LIA', '21600', 26000, 96000),
  P('21620', 'Customer Deposits', 'LIA', '21600', 8000, 38000),
  P('21630', 'Unearned Revenue', 'LIA', '21600', 7000, 27000),
  S('22000', 'Non-Current Liabilities', 'LIA', '20000'),
  S('22100', 'Long-Term Debt', 'LIA', '22000'),
  P('22110', 'Term Loan - Chase Bank', 'LIA', '22100', 60000, 520000),
  P('22120', 'Mortgage Payable', 'LIA', '22100', 20000, 380000),
  P('22130', 'Equipment Financing', 'LIA', '22100', 5000, 60000),
  S('22200', 'Other Long-Term Liabilities', 'LIA', '22000'),
  P('22210', 'Deferred Tax Liabilities', 'LIA', '22200', 3000, 84000),
  P('22220', 'Lease Liabilities', 'LIA', '22200', 1000, 30000),
  P('22230', 'Deferred Revenue - Long-Term', 'LIA', '22200', 708, 9700),

  // ----- Equity -----
  S('30000', 'EQUITY', 'EQT', null),
  S('31000', 'Contributed Capital', 'EQT', '30000'),
  P('31010', 'Common Stock', 'EQT', '31000', 0, 500000),
  P('31020', 'Additional Paid-In Capital', 'EQT', '31000', 0, 1200000),
  /* Retained earnings is a summary over two posting accounts: what the year-end
     close works out, and the corrections people make by hand. Both roll up, so
     the balance sheet still shows one Retained Earnings line. Design review,
     2026-09-28 - Eli: *"you still get a retained earnings account, it's just
     divided up into two different sets of transactions, transactions that are
     automated and transactions that are manual."* It keeps a hand correction
     from ever reading as part of the profit the close carried forward.

     The system account holds prior years' earnings only. This year's profit is
     the computed Current year earnings line (decision 57), which the close moves
     in at year end. Its 1,428,200 is the 2,166,300 it carried before the line
     existed, less this year's 738,100. The two accounts' movements cancel - the
     year's own movement is on the computed line, the 2,442 the income statement
     nets to. Names per decision 101 (module review, 2026-10-06, COA-06). */
  S('32000', 'Retained Earnings', 'EQT', '30000'),
  // Only the year-end close posts to the system account, so the demo seeds no
  // postings on it. The manual account carries this year's one correction, a
  // prior year tax accrual restated, as a debit; the two total 1,409,800.
  P('32100', 'Retained System Earnings', 'EQT', '32000', 18400, 1428200, { seedPostings: false }),
  P('32200', 'Manual GL Transactions', 'EQT', '32000', -18400, -18400),
  /* Was one "Other Equity" summary over both of the rows below. It had to split:
     a summary prints as a single line on the statement, and what the owners take
     back out is not the same line as earnings the P&L never carried. So the
     summary keeps the distributions, and comprehensive income moves up to sit
     beside retained earnings under the root. */
  S('33000', 'Distributions', 'EQT', '30000'),
  P('33010', 'Dividends Declared', 'EQT', '33000', 0, -50000, { contra: true }),
  P('34000', 'Accumulated Other Comprehensive Income', 'EQT', '30000', 0, 12000),
  // Nothing authored and nothing seeded: revenue less expenses is its figure.
  P('35000', 'Current Year Earnings', 'EQT', '30000', 0, 0, { seedPostings: false }),

  // ============ INCOME STATEMENT ============

  // ----- Revenue -----
  S('40000', 'REVENUE', 'REV', null),
  S('41000', 'Operating Revenue', 'REV', '40000'),
  P('41010', 'Product Sales', 'REV', '41000', 320000, 1700000),
  P('41020', 'Wholesale Sales', 'REV', '41000', 130000, 700000),
  P('41030', 'Service Revenue', 'REV', '41000', 100000, 500000),
  P('41040', 'Consulting Revenue', 'REV', '41000', 40000, 200000),
  P('41050', 'Subscription Revenue', 'REV', '41000', 50000, 240000),
  P('41060', 'Shipping and Handling Revenue', 'REV', '41000', 15000, 60000),
  P('41070', 'Sales Returns and Allowances', 'REV', '41000', -10000, -110000, { contra: true }),
  P('41080', 'Sales Discounts', 'REV', '41000', -29000, -60000, { contra: true }),
  S('42000', 'Other Revenue', 'REV', '40000'),
  P('42010', 'Interest Income', 'REV', '42000', 6000, 30000),
  P('42020', 'Rental Income', 'REV', '42000', 7000, 22000),
  P('42030', 'Gain on Sale of Assets', 'REV', '42000', 6442, 10000),
  P('42040', 'Miscellaneous Income', 'REV', '42000', 3000, 8000),

  // ----- Expenses -----
  S('50000', 'EXPENSES', 'EXP', null),
  S('51000', 'Cost of Goods Sold', 'EXP', '50000'),
  P('51010', 'Direct Materials', 'EXP', '51000', 130000, 520000),
  P('51020', 'Direct Labor', 'EXP', '51000', 78000, 310000),
  P('51030', 'Manufacturing Overhead', 'EXP', '51000', 34400, 140000),
  P('51040', 'Freight and Shipping', 'EXP', '51000', 10000, 40000),
  S('52000', 'Operating Expenses', 'EXP', '50000'),
  S('52100', 'Salaries and Wages', 'EXP', '52000'),
  P('52110', 'Salaries and Wages Expense', 'EXP', '52100', 160000, 620000),
  P('52120', 'Payroll Taxes', 'EXP', '52100', 23000, 95000),
  P('52130', 'Employee Benefits', 'EXP', '52100', 27000, 105000),
  S('52200', 'Sales and Marketing', 'EXP', '52000'),
  P('52210', 'Advertising', 'EXP', '52200', 6000, 70000),
  P('52220', 'Marketing Campaigns', 'EXP', '52200', 5000, 55000),
  P('52230', 'Travel and Entertainment', 'EXP', '52200', 4000, 30000),
  S('52300', 'General and Administrative', 'EXP', '52000'),
  P('52310', 'Rent Expense', 'EXP', '52300', 16000, 60000),
  P('52320', 'Utilities', 'EXP', '52300', 8000, 28000),
  P('52330', 'Office Supplies', 'EXP', '52300', 3200, 12000),
  P('52340', 'Insurance Expense', 'EXP', '52300', 6000, 22000),
  P('52350', 'Professional Fees', 'EXP', '52300', 15000, 45000),
  P('52360', 'Software Subscriptions', 'EXP', '52300', 10800, 24800),
  S('52400', 'Research and Development', 'EXP', '52000'),
  P('52410', 'R&D Salaries', 'EXP', '52400', 35000, 130000),
  P('52420', 'R&D Materials and Supplies', 'EXP', '52400', 15000, 50000),
  S('52500', 'Depreciation and Amortization', 'EXP', '52000'),
  P('52510', 'Depreciation Expense', 'EXP', '52500', 14000, 56000),
  P('52520', 'Amortization Expense', 'EXP', '52500', 4000, 16000),
  S('53000', 'Other Expenses', 'EXP', '50000'),
  P('53010', 'Interest Expense', 'EXP', '53000', 4800, 21000),
  /* Sits beside "Other Expenses" rather than inside it. Income tax is its own
     classification precisely so the statement can subtotal pre-tax income, and
     a summary prints as one line, so it cannot carry both.

     The one row out of number order, and deliberately: it held this place while
     it was 6520, and the seeded ledger is drawn in row order, so moving it after
     53040 would reshuffle every generated posting. The tree sorts by number, so
     the listing shows it last either way. */
  P('54000', 'Income Tax Expense', 'EXP', '50000', 22000, 88000),
  P('53020', 'Loss on Sale of Assets', 'EXP', '53000', 0, 3200, { status: 'Inactive' }),
  P('53030', 'Bad Debt Expense', 'EXP', '53000', 4200, 18500),
  P('53040', 'Penalties and Fines', 'EXP', '53000', 600, 2400),
]
