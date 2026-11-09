import { VALUE_MEANS_NOTHING, type SlotTally } from '../../lib/codeMapper'
import { dimensionColumns, dimensionKey, type ReviewRowView } from '../../pages/importReview/reviewColumns'
import type { ReviewCounts } from '../../pages/importReview/reviewDerive'
import type { ParsedRow } from '../../lib/uploadValidation'
import type { SlotDecision } from '../../pages/ImportAccounts'

/* ──────────────────────────────────────────────────────────────────
 * THE FILE THE TOUR TEACHES FROM
 *
 * The tour opens on the upload step, before there is a file, so every step
 * after that one has nothing of the reader's to show. Rather than draw each
 * step, the wizard mounts the real step components and feeds them this: one
 * example file, stated once, in the shapes each step's props already want.
 *
 * Stated once because the tour is one story. The card about the dimensions
 * table and the card about the review grid are two sentences about the same
 * file, and two example files would have them disagree in front of the reader.
 *
 * Nothing here is wired to the draft. The overlay's inert layer already stops
 * every event reaching the wizard, and the setters below are no-ops on top of
 * that, so the tour cannot write an answer the reader did not give.
 *
 * ──── THREE DIMENSIONS, ONE PER ANSWER ────
 * Which is the whole reason the numbers in this file are this long and no
 * longer. The dimensions step offers three answers - dimension, ignore, GL
 * account number - and the file carries exactly one dimension for each, so the
 * card listing the three answers is standing over a table showing all three
 * given and no row is left over. A second dimension was here for a while and
 * taught nothing: it was the first answer said twice, and it pushed the values
 * the labelling step is about down the page.
 *
 * The number the cards quote is not from here. It is `SPECIMEN_PARTS` in
 * `walkthroughArt.tsx`, which the diagram draws and the gate step writes out as
 * pills, and it is short on purpose: the card defining the word is read before
 * there is a file, so the number in it is one the reader only has to look at.
 * This file's numbers are the ones they scroll through afterwards.
 *
 * The ignored one is a retired branch code rather than a filter nobody happens
 * to want, because a reader told to throw away something they can see a use for
 * will not believe the advice.
 * ────────────────────────────────────────────────────────────────── */

/** A value found in one dimension of the file, and what the reader named it. */
interface ExampleValue {
  code: string
  rows: number
  label?: string
  /** Marked as standing for nothing, so it stores no value and reads as blank. */
  nothing?: boolean
}

export interface ExampleFilter {
  name: string
  values: ExampleValue[]
}

/* The one dimension the reader turns into a filter, carrying all three answers
   the labelling step allows and nothing else: one value named, one left as its
   number, one marked as meaning nothing. Three cards, three rows, and the row
   each card is about is on screen when the card arrives.

   It held four named values and a second filter for a while. Both are gone. The
   naming cards only ever pointed at the first row, and the rows under it pushed
   the two answers the step is really about - blank is allowed, and a value can
   mean nothing - far enough down that arriving at the card scrolled the panel. */
export const EXAMPLE_FILTERS: ExampleFilter[] = [
  {
    name: 'Department',
    values: [
      { code: '100', rows: 71, label: 'Operations' },
      { code: '400', rows: 19 },
      { code: '900', rows: 6, nothing: true },
    ],
  },
]

/* The dimension the reader throws away. Branch codes from a structure the
   business retired: every row still carries one, and none of them is worth
   storing. Kept out of EXAMPLE_FILTERS because that list is what becomes
   columns, and an ignored dimension becomes nothing. */
const EXAMPLE_IGNORED: ExampleFilter = {
  name: 'Branch',
  values: [
    { code: '99', rows: 41 },
    { code: '98', rows: 33 },
    { code: '97', rows: 22 },
  ],
}

/* Every dimension tallies to the same number of rows, because they are two
   readings of one file. Asserted by arithmetic rather than by a comment: the
   grid below is built by pairing the expansions off, which only holds if they
   are the same length. */
const ROW_COUNT = EXAMPLE_FILTERS[0].values.reduce((n, v) => n + v.rows, 0)

/** One dimension's values, one entry per row carrying it. */
const expand = (f: ExampleFilter): string[] =>
  f.values.flatMap(v => Array.from({ length: v.rows }, () => v.code))

const labelsOf = (f: ExampleFilter): Record<string, string> =>
  Object.fromEntries(f.values.flatMap(v =>
    v.nothing ? [[v.code, VALUE_MEANS_NOTHING]] : v.label ? [[v.code, v.label]] : []))

/** What a value reads as on the account. A code left unnamed reads as itself; a
    code marked as meaning nothing stores nothing at all. */
const valueOn = (f: ExampleFilter, code: string): string | undefined => {
  const v = f.values.find(x => x.code === code)!
  return v.nothing ? undefined : v.label ?? v.code
}

/* Accounts a chart of this shape actually holds, cycled down the file. The name
   repeating is correct for a chart read by department: every department has
   salaries. What tells two of them apart is the number, which is why each
   repeat takes the next one up. */
const ACCOUNTS: readonly (readonly [string, string, string])[] = [
  ['5020', 'Salaries', 'Expense'],
  ['5030', 'Employer contributions', 'Expense'],
  ['5040', 'Contractors', 'Expense'],
  ['5110', 'Rent', 'Expense'],
  ['5120', 'Utilities', 'Expense'],
  ['5130', 'Repairs and maintenance', 'Expense'],
  ['5210', 'Software subscriptions', 'Expense'],
  ['5220', 'Telephone and internet', 'Expense'],
  ['5310', 'Advertising', 'Expense'],
  ['5320', 'Client entertainment', 'Expense'],
  ['5410', 'Travel', 'Expense'],
  ['5420', 'Vehicle running costs', 'Expense'],
  ['5510', 'Professional fees', 'Expense'],
  ['5520', 'Insurance', 'Expense'],
  ['5610', 'Office supplies', 'Expense'],
  ['5620', 'Printing and postage', 'Expense'],
  ['5710', 'Training', 'Expense'],
  ['5720', 'Recruitment', 'Expense'],
  ['5810', 'Bank charges', 'Expense'],
  ['5820', 'Depreciation', 'Expense'],
  ['5910', 'Bad debts', 'Expense'],
  ['5920', 'Sundry expenses', 'Expense'],
  ['4010', 'Product revenue', 'Revenue'],
  ['4020', 'Service revenue', 'Revenue'],
]

const DEPARTMENTS = expand(EXAMPLE_FILTERS[0])
const BRANCHES = expand(EXAMPLE_IGNORED)

/* Which department and which branch sit on which row. Dealt out by strides
   coprime with the row count, so the two readings are permutations of the file
   rather than blocks: taken in order, the grid would open on seventy identical
   rows and the column would read as one value. Both land on the first row what
   the cards quote, so the number in the copy is the row the review card is
   pointing at. */
const DEPARTMENT_AT = (i: number) => DEPARTMENTS[(i * 37) % ROW_COUNT]
const BRANCH_AT = (i: number) => BRANCHES[(i * 53) % ROW_COUNT]

interface ExampleRow { arrival: string; account: string; name: string; type: string; department: string }

const EXAMPLE_ROWS: ExampleRow[] = Array.from({ length: ROW_COUNT }, (_, i) => {
  const [base, name, type] = ACCOUNTS[i % ACCOUNTS.length]
  // Each time an account comes round again it takes the next number up, so no
  // two rows arrive as the same account.
  const account = String(Number(base) + Math.floor(i / ACCOUNTS.length))
  const department = DEPARTMENT_AT(i)
  const arrival = `${department}-${BRANCH_AT(i)}-${account}`
  return { arrival, account, name, type, department }
})

// --- The gate ---------------------------------------------------------------

/* Answered yes, because the example file's numbers do split and the steps after
   this one are the steps that answer leads to. Nothing is off pattern: a
   warning on a step the reader is only being shown would read as a problem with
   their own file. */
export const EXAMPLE_SPLIT = {
  answer: 'yes' as const,
  onAnswer: () => {},
  onOpenGuide: () => {},
  fit: null,
  offPattern: [] as string[],
  blocked: [] as string[],
}

// --- What each dimension is -------------------------------------------------

const EXAMPLE_DECISIONS: SlotDecision[] = [
  { target: { kind: 'filter', name: 'Department' }, labels: labelsOf(EXAMPLE_FILTERS[0]) },
  { target: { kind: 'ignore' }, labels: {} },
  { target: { kind: 'account' }, labels: {} },
]

const ACCOUNT_TALLY: SlotTally[] = EXAMPLE_ROWS.map(r => ({ code: r.account, rows: 1 }))

const EXAMPLE_TALLIES: SlotTally[][] = [
  EXAMPLE_FILTERS[0].values.map(v => ({ code: v.code, rows: v.rows })),
  EXAMPLE_IGNORED.values.map(v => ({ code: v.code, rows: v.rows })),
  ACCOUNT_TALLY,
]

export const EXAMPLE_DIMENSIONS = {
  // Every row reaches the third dimension, so any of the three can be the
  // account and none of them wears a reason it cannot be.
  accountLimit: 2,
  decisions: EXAMPLE_DECISIONS,
  setDecisions: () => {},
  valueCounts: EXAMPLE_TALLIES.map(t => t.length),
  codes: (slot: number) => EXAMPLE_TALLIES[slot] ?? [],
  refusal: null,
  refusedRows: [],
  onExcludeRefused: () => {},
  errors: {},
  questions: [],
  choices: {},
  onChoose: () => {},
}

// --- The labelling step -----------------------------------------------------

/* One band, because the file has one dimension. The `slot` it carries is
   still its position in the number, so the band name stays true to the
   dimension table a card ago. */
export const EXAMPLE_LABEL_SLOTS = [
  { slot: 0, name: 'Department', labels: labelsOf(EXAMPLE_FILTERS[0]) },
]

export const EXAMPLE_LABELS = {
  slots: EXAMPLE_LABEL_SLOTS,
  setLabel: () => {},
  codes: (slot: number) => EXAMPLE_TALLIES[slot] ?? [],
}

// --- The review grid --------------------------------------------------------

const EXAMPLE_REVIEW_ROWS: ReviewRowView[] = EXAMPLE_ROWS.map((r, i) => ({
  row: i + 2, // line 1 of the file is the header
  number: r.account,
  name: r.name,
  type: r.type,
  glType: 'Posting',
  status: 'Active',
  currency: '',
  verdict: 'ready',
  flagged: new Set(),
  message: 'Ready to import.',
  /* Blank in the file and answered by the engine, which is the state most rows
     of most files are in. */
  classification: r.type === 'Revenue' ? 'Operating revenue' : 'Operating expense',
  needsDetails: false,
  excluded: false,
  /* Flattened onto the row, the way the grid reads a cell. A dimension the row
     stores nothing for has no key at all, which is what the grid draws blank -
     so the value marked as meaning nothing is absent rather than empty. */
  ...Object.fromEntries(EXAMPLE_FILTERS.flatMap(f => {
    const value = valueOn(f, r.department)
    return value === undefined ? [] : [[dimensionKey(f.name), value]]
  })),
}))

export const EXAMPLE_REVIEW = {
  rows: EXAMPLE_REVIEW_ROWS,
  counts: { all: ROW_COUNT, ready: ROW_COUNT, errors: 0, warnings: 0, needsDetails: 0 } satisfies ReviewCounts,
  dimensionColumns: dimensionColumns(EXAMPLE_FILTERS.map(f => f.name)),
  // The numbers as the file wrote them, so a cell can say what it used to hold.
  originals: new Map<number, ParsedRow>(EXAMPLE_ROWS.map((r, i) => [i + 2, {
    row: i + 2, number: r.arrival, name: r.name, type: r.type, glType: 'Posting',
  }])),
  parentCandidates: [],
  currencyOptions: ['GBP'],
}
