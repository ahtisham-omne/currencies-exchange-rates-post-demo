import { describe, it, expect } from 'vitest'
import { runUploadValidation, parentsFirst, type ParsedRow } from './uploadValidation'
import { CATEGORY_OF_CLASSIFICATION, DEFAULT_CLASSIFICATION_BY_CATEGORY, type Account } from '../types'

// An imported file is the one place accounts arrive from outside, so it is the
// one place the chart's invariants are not already true. These pin what the
// engine has to establish on the way in: a type it recognises, a parent to hang
// from, and `isPosting` agreeing with the type.

const acct = (over: Partial<Account> & Pick<Account, 'id' | 'accountNumber'>): Account => ({
  internalId: over.id.toUpperCase(),
  accountName: over.accountNumber,
  accountType: 'AST',
  glAccountType: 'Summary',
  statementClassification: 'Current asset',
  isPosting: false,
  normalBalance: 'Debit',
  currencyCode: 'USD',
  status: 'Active',
  effectiveDate: '2026-01-01',
  postingRestrictions: {},
  defaultDimensionValues: [],
  isContra: false,
  parentId: null,
  subsidiaryId: 'sub_main',
  balance: 0,
  hasTransactions: false,
  createdAt: '', updatedAt: '', createdBy: '', updatedBy: '',
  ...over,
})

// A three-deep asset branch, so a row that names a parent has something to name
// at each depth. Only the roots are reachable without naming one.
const ASSET_ROOT = acct({ id: 'root_ast', accountNumber: '1000', accountName: 'Assets' })
const CURRENT = acct({ id: 's_1010', accountNumber: '1010', accountName: 'Current Assets', parentId: 'root_ast' })
const CASH = acct({ id: 's_1015', accountNumber: '1015', accountName: 'Cash', parentId: 's_1010' })
const EXPENSES = acct({ id: 'root_exp', accountNumber: '5500', accountName: 'Expenses', accountType: 'EXP', statementClassification: 'Operating expense' })
const CHART = [ASSET_ROOT, CURRENT, CASH, EXPENSES]

// Every row carries a GL account type, because the engine requires one: which of
// the two a row is decides whether it can be posted to and what can sit under it,
// so there is no safe default to fall back on.
const row = (over: Partial<ParsedRow> & Pick<ParsedRow, 'row' | 'number'>): ParsedRow => ({
  name: `Account ${over.number}`, type: 'Asset', glType: 'Posting', ...over,
})

const summaryRow = (over: Partial<ParsedRow> & Pick<ParsedRow, 'row' | 'number'>): ParsedRow => ({
  ...row(over), glType: 'Summary', ...over,
})

const run = (rows: ParsedRow[], chart: Account[] = CHART) =>
  runUploadValidation(rows, chart)

describe('upload validation', () => {
  it('accepts the clean rows and reports nothing else', () => {
    const { newAccounts, invalid, warned, needDetails } = run([row({ row: 2, number: '1030' })])
    expect(invalid).toEqual([])
    expect(warned).toEqual([])
    expect(needDetails).toEqual([])
    expect(newAccounts.map(a => a.accountNumber)).toEqual(['1030'])
  })

  // The mirror every aggregate filters on. Let the two disagree and a summary
  // account counts as a leaf, so its children are added to its own total.
  it('mirrors isPosting off the type on every account it builds', () => {
    const rows = [
      row({ row: 2, number: '1030' }),
      summaryRow({ row: 3, number: '1105' }),
      row({ row: 4, number: '1110', glType: 'Posting' }),
      summaryRow({ row: 5, number: '5510', type: 'Expense', glType: 'Begin-Total' }),
    ]
    const { newAccounts } = run(rows)
    expect(newAccounts).toHaveLength(4)
    expect(newAccounts.filter(a => a.isPosting !== (a.glAccountType === 'Posting'))).toEqual([])
  })

  it('brings in no balance, whatever the file says', () => {
    const { newAccounts } = run([row({ row: 2, number: '1030' })])
    expect(newAccounts[0].balance).toBe(0)
    expect(newAccounts[0].hasTransactions).toBe(false)
  })

  // There is no safe default. Whether a row is Summary or Posting decides whether
  // it can be posted to, whether it reserves a block and what can sit under it, so
  // a blank column used to invent a chart of leaves rather than admit it was blank.
  it('refuses a row that does not say whether it is Summary or Posting', () => {
    const { newAccounts, invalid } = run([{ row: 2, number: '1030', name: 'Cash', type: 'Asset' }])
    expect(newAccounts).toEqual([])
    expect(invalid[0].columns).toContain('glType')
    expect(invalid[0].errors).toEqual(['Choose summary or posting.'])
  })

  // Every label of the five-type model this chart replaced named a row that held
  // no balance of its own, so all of them land on Summary and a file exported
  // before the change still imports.
  it('reads the retired structural labels as Summary', () => {
    const retired = ['Heading', 'Header', 'Total', 'Begin-Total', 'begin total', 'End-Total', 'endtotal']
    const rows = retired.map((glType, i) => summaryRow({ row: i + 2, number: String(1105 + i * 5), glType }))
    const { newAccounts, invalid } = run(rows)
    expect(invalid).toEqual([])
    expect(newAccounts).toHaveLength(retired.length)
    expect(newAccounts.filter(a => a.glAccountType !== 'Summary').map(a => a.accountNumber)).toEqual([])
  })

  it('refuses a structural label it does not recognise rather than guessing one', () => {
    const { newAccounts, invalid } = run([row({ row: 2, number: '1030', glType: 'something else' })])
    expect(newAccounts).toEqual([])
    expect(invalid[0].columns).toEqual(['glType'])
  })
})

describe('upload validation parenting', () => {
  /* Nothing about a number says which summary should total it, so a row that
     names no parent goes to the top of its category rather than being placed by
     the number it happens to carry. */
  it('hangs a row that names no parent from the top of its category', () => {
    const { newAccounts, invalid } = run([
      row({ row: 2, number: '1030' }),
      row({ row: 3, number: '1250' }),
    ])
    expect(invalid).toEqual([])
    expect(newAccounts.map(a => a.parentId)).toEqual(['root_ast', 'root_ast'])
  })

  it('never parents across categories', () => {
    const { newAccounts } = run([row({ row: 2, number: '5600', type: 'Expense' })])
    expect(newAccounts[0].parentId).toBe('root_exp')
  })

  it('prefers the parent the file names over the one the number implies', () => {
    const { newAccounts } = run([row({ row: 2, number: '1030', parent: '1010' })])
    expect(newAccounts[0].parentId).toBe('s_1010')
  })

  it('lets a row hang from a summary the same file brought in', () => {
    const { newAccounts } = run([
      summaryRow({ row: 2, number: '1105' }),
      row({ row: 3, number: '1110', parent: '1105' }),
    ])
    const child = newAccounts.find(a => a.accountNumber === '1110')!
    const parent = newAccounts.find(a => a.accountNumber === '1105')!
    expect(child.parentId).toBe(parent.id)
  })

  it('leaves a row parentless rather than guessing when the chart is empty', () => {
    const { newAccounts } = run([row({ row: 2, number: '1030' })], [])
    expect(newAccounts[0].parentId).toBeNull()
  })
})

// Whoever writes these accounts gets one real id back per call, so it can only
// translate a child's parent link if the parent went first. Nesting was lost on
// every imported chart until it did: a file's own summaries were written after
// the rows hanging from them, and those rows landed at the top of the chart.
describe('ordering an import so parents are written first', () => {
  it('puts a parent brought in by the same file ahead of its child', () => {
    const { newAccounts } = run([
      row({ row: 2, number: '1110', parent: '1105' }),
      summaryRow({ row: 3, number: '1105' }),
    ])
    const ordered = parentsFirst(newAccounts).map(a => a.accountNumber)
    expect(ordered).toEqual(['1105', '1110'])
  })

  it('resolves a whole chain, however the file ordered it', () => {
    const { newAccounts } = run([
      row({ row: 2, number: '1130', parent: '1120' }),
      summaryRow({ row: 3, number: '1120', parent: '1105' }),
      summaryRow({ row: 4, number: '1105' }),
    ])
    const ordered = parentsFirst(newAccounts)
    const at = (n: string) => ordered.findIndex(a => a.accountNumber === n)
    expect(at('1105')).toBeLessThan(at('1120'))
    expect(at('1120')).toBeLessThan(at('1130'))
  })

  it('keeps every account exactly once', () => {
    const { newAccounts } = run([
      row({ row: 2, number: '1110', parent: '1105' }),
      summaryRow({ row: 3, number: '1105' }),
      row({ row: 4, number: '5600', type: 'Expense' }),
    ])
    const ordered = parentsFirst(newAccounts)
    expect(ordered).toHaveLength(newAccounts.length)
    expect(new Set(ordered.map(a => a.id)).size).toBe(newAccounts.length)
  })

  it('leaves a row alone when its parent is already in the chart', () => {
    const { newAccounts } = run([row({ row: 2, number: '1030', parent: '1015' })])
    expect(newAccounts[0].parentId).toBe('s_1015')
    expect(parentsFirst(newAccounts)).toEqual(newAccounts)
  })

  it('emits a cycle rather than hanging on it', () => {
    // Not reachable through validation, which only ever points a row at a row
    // above it. Asserted because the alternative is an infinite recursion.
    const a = { ...ASSET_ROOT, id: 'a', parentId: 'b' }
    const b = { ...ASSET_ROOT, id: 'b', parentId: 'a' }
    expect(parentsFirst([a, b]).map(x => x.id).sort()).toEqual(['a', 'b'])
  })
})

// A file can state something the row's own fields already decide (Normal
// Balance, which Contra and the category settle) or something its type has no
// room for (a block on a posting row). Neither stops the row. Range start and
// end are no longer columns of our own template, but a foreign export still
// carries them, so they are still read and still checked.
describe('upload validation of the template-only columns', () => {
  const NORMAL_BALANCE_IGNORED = 'Omne sets the normal balance from the category and the contra flag. This value was ignored.'

  /* The template states the side in a Normal balance column (2026-10-02). The
     category's own side is an ordinary account; the opposite side is a contra
     account, which is what makes the side the account then carries. */
  it('reads the opposite side as a contra account, and its own side as an ordinary one', () => {
    const own = run([row({ row: 2, number: '1030', normalBalance: 'Debit' })])
    expect(own.newAccounts[0].isContra).toBeFalsy()
    expect(own.newAccounts[0].normalBalance).toBe('Debit')
    expect(own.warned).toEqual([])
    const opposite = run([row({ row: 2, number: '1030', normalBalance: 'Credit' })])
    expect(opposite.newAccounts[0].isContra).toBe(true)
    expect(opposite.newAccounts[0].normalBalance).toBe('Credit')
  })

  it('refuses a side it cannot read', () => {
    const { newAccounts, invalid } = run([row({ row: 2, number: '1030', normalBalance: 'Left' })])
    expect(newAccounts).toEqual([])
    expect(invalid[0].columns).toEqual(['normalBalance'])
    expect(invalid[0].errors).toEqual(['Normal balance must be debit or credit.'])
  })

  // An older template's Contra column still reads.
  it('still reads Contra from a file made with an older template', () => {
    const { newAccounts } = run([row({ row: 2, number: '1030', contra: 'Yes' })])
    expect(newAccounts[0].isContra).toBe(true)
    expect(newAccounts[0].normalBalance).toBe('Credit')
  })

  /* Contra used to be read as No when it could not be read at all, which is a
     guess at the one field that decides an account's sign. */
  it('refuses a Contra column it cannot read rather than guessing No', () => {
    const { newAccounts, invalid } = run([row({ row: 2, number: '1030', contra: 'maybe' })])
    expect(newAccounts).toEqual([])
    expect(invalid[0].columns).toEqual(['contra'])
    expect(invalid[0].errors).toEqual(['Contra must be yes or no.'])
  })

  it('says a summary has nothing to reverse rather than refusing it', () => {
    const { newAccounts, warned } = run([summaryRow({ row: 2, number: '1200', contra: 'Yes' })])
    expect(newAccounts[0].isContra).toBeUndefined()
    expect(warned[0].columns).toEqual(['contra'])
    expect(warned[0].warnings).toEqual(["Summary accounts don't post transactions, so contra has no effect here."])
  })

  it('refuses a Status column it cannot read rather than setting it Active', () => {
    const { newAccounts, invalid } = run([row({ row: 2, number: '1030', status: 'on hold' })])
    expect(newAccounts).toEqual([])
    expect(invalid[0].columns).toEqual(['status'])
    expect(invalid[0].errors).toEqual(['Status must be active or inactive.'])
  })

  /* Switching a branch off is a real thing to want, and the accounts under it
     keep working whatever the summary says. So it is said, not refused. */
  it('counts what still rolls up into a summary the file switched off', () => {
    const { warned } = run([
      summaryRow({ row: 2, number: '1105', status: 'Inactive' }),
      row({ row: 3, number: '1110', parent: '1105' }),
      row({ row: 4, number: '1115', parent: '1105' }),
    ])
    expect(warned.find(w => w.row === 2)?.warnings).toEqual(['This summary is inactive but 2 accounts roll up into it.'])
  })

  it('counts one as one', () => {
    const { warned } = run([
      summaryRow({ row: 2, number: '1105', status: 'Inactive' }),
      row({ row: 3, number: '1110', parent: '1105' }),
    ])
    expect(warned.find(w => w.row === 2)?.warnings).toEqual(['This summary is inactive but 1 account rolls up into it.'])
  })

  /* A summary totals whatever names it as a parent, so it claims no numbers and
     there is nothing on the row to check a number against. */
  it('takes a summary row without asking it to reserve anything', () => {
    const { invalid, newAccounts } = run([row({ row: 2, number: '1200', glType: 'Summary' })])
    expect(invalid).toEqual([])
    expect(newAccounts[0].glAccountType).toBe('Summary')
  })
})

// A glued legacy chart (100-2000-200) has to survive the same engine: the number
// is kept exactly as it arrived, and the category stated on the row is what
// places it. Nothing reads the digits, so no part of a glued number has to be
// identified before the row can be accepted.
describe('upload validation with glued account numbers', () => {
  const gRow = (r: number, number: string, type: string): ParsedRow => ({ row: r, number, name: `Account ${number}`, type, glType: 'Posting' })

  it('accepts a glued row and keeps its full number', () => {
    const { newAccounts, invalid } = runUploadValidation([gRow(2, '100-2000-200', 'Liability')], [])
    expect(invalid).toEqual([])
    expect(newAccounts[0].accountNumber).toBe('100-2000-200')
  })

  it('places a glued row by the category the file states', () => {
    const { newAccounts } = runUploadValidation([
      gRow(2, '100-2000-200', 'Liability'),
      gRow(3, '100-4000-300', 'Revenue'),
      gRow(4, '200-6110-100', 'Expense'),
    ], [])
    const typeOf = (n: string) => {
      const a = newAccounts.find(x => x.accountNumber === n)!
      return CATEGORY_OF_CLASSIFICATION[a.statementClassification]
    }
    expect(typeOf('100-2000-200')).toBe('LIA')
    expect(typeOf('100-4000-300')).toBe('REV')
    expect(typeOf('200-6110-100')).toBe('EXP')
  })

  // A row whose code is a segment short, or shaped unlike its neighbours, is
  // still that customer's account. Refusing it told them to renumber their chart
  // to match a pattern the importer had inferred for them.
  it('takes a ragged code rather than refusing the row', () => {
    const { invalid, newAccounts } = runUploadValidation([gRow(2, '100-20-200', 'Liability')], [])
    expect(invalid).toEqual([])
    expect(newAccounts[0].accountNumber).toBe('100-20-200')
  })
})

/* A number is a label, so nothing about where an account is filed may be read out
   of it. The importer applies a numbering scheme nobody was asked about, so every
   inference it used to draw from the digits was an inference the customer had no
   chance to correct: a chart that numbers its operating expenses in the 6000s is
   the more common of the two conventions, and every one of those rows used to
   come back as an error or be quietly refiled. */
describe('upload validation files a row by the category it states, not by its number', () => {
  const sRow = (r: number, number: string, type: string): ParsedRow => ({ row: r, number, name: `Account ${number}`, type, glType: 'Posting' })

  it('accepts an expense chart numbered in the 6000s', () => {
    const rows = ['6000', '6100', '6200', '6300', '6400', '6500', '6900'].map((n, i) => sRow(i + 2, n, 'Expense'))
    const { newAccounts, invalid } = runUploadValidation(rows, [])
    expect(invalid).toEqual([])
    expect(newAccounts).toHaveLength(rows.length)
    for (const a of newAccounts) expect(a.statementClassification, a.accountNumber).toBe('Operating expense')
  })

  /* Expenses default to operating expenses rather than to cost of sales, which
     is the first section the category lists. Printing order put cost of sales
     first; it is the narrower of the two, and reading the list's head as the
     default filed a whole imported chart under it. */
  it('defaults an expense to operating expenses, not to cost of sales', () => {
    expect(DEFAULT_CLASSIFICATION_BY_CATEGORY.EXP).toBe('Operating expense')
    const { newAccounts } = runUploadValidation([sRow(2, '5100', 'Expense')], [])
    expect(newAccounts[0].statementClassification).toBe('Operating expense')
  })

  // Every one of these numbers used to be read as belonging to another category.
  it('keeps the stated category whatever the number looks like', () => {
    const { invalid, newAccounts, warned } = runUploadValidation([
      sRow(2, '2000', 'Expense'), sRow(3, '9500', 'Expense'), sRow(4, '7100', 'Revenue'), sRow(5, 'AR-1100', 'Asset'),
    ], [])
    expect(invalid).toEqual([])
    expect(warned).toEqual([])
    const typeOf = (n: string) => newAccounts.find(a => a.accountNumber === n)!.accountType
    expect(typeOf('2000')).toBe('EXP')
    expect(typeOf('9500')).toBe('EXP')
    expect(typeOf('7100')).toBe('REV')
    expect(typeOf('AR-1100')).toBe('AST')
  })

  // No number is out of range, because there is no range to be out of.
  it('never warns about where a number sits', () => {
    const { warned, invalid } = runUploadValidation(
      ['0001', '9999', '123456', 'AR-1100'].map((n, i) => sRow(i + 2, n, 'Asset')), [])
    expect(invalid).toEqual([])
    expect(warned).toEqual([])
  })
})

// A row cannot be judged on its own. A parent may be declared further down the
// file than the rows naming it, a chain only shows itself to be circular once the
// whole graph is in hand, and a number is only a duplicate relative to the others.
describe('upload validation of the parent a file states', () => {
  const POSTING = acct({ id: 'p_1025', accountNumber: '1025', accountName: 'Petty Cash', glAccountType: 'Posting', isPosting: true, parentId: 's_1015' })

  const columnsOf = (rows: ParsedRow[], line: number, chart = CHART) =>
    run(rows, chart).invalid.find(i => i.row === line)?.columns ?? []

  it('refuses a parent that is in neither the file nor the chart', () => {
    const { invalid, newAccounts } = run([row({ row: 2, number: '1030', parent: '9999' })])
    expect(newAccounts).toEqual([])
    expect(invalid[0].columns).toEqual(['parent'])
    expect(invalid[0].errors).toEqual(['No account with this number. Add it to your file or pick an existing summary.'])
  })

  // A posting account holds a balance of its own. Hanging accounts under it would
  // have its total counted twice, once as its own balance and once as theirs.
  it('refuses a parent that is a posting account', () => {
    const chart = [...CHART, POSTING]
    expect(columnsOf([row({ row: 2, number: '1030', parent: '1025' })], 2, chart)).toEqual(['parent'])
  })

  it('refuses a parent in a different category', () => {
    expect(columnsOf([row({ row: 2, number: '1030', parent: '5500' })], 2)).toContain('parent')
  })

  it('takes a summary under a summary, whatever the two are numbered', () => {
    const { invalid, newAccounts } = run([summaryRow({ row: 2, number: '1020', parent: '1015' })])
    expect(invalid).toEqual([])
    expect(newAccounts[0].parentId).toBe('s_1015')
  })

  it('refuses a chain of parents that comes back on itself', () => {
    const { invalid, newAccounts } = run([
      summaryRow({ row: 2, number: '1100', parent: '1200' }),
      summaryRow({ row: 3, number: '1200', parent: '1100' }),
    ])
    expect(newAccounts).toEqual([])
    expect(invalid).toHaveLength(2)
    for (const i of invalid) expect(i.errors).toContain("This creates a loop. An account can't roll up into itself.")
  })

  // The whole reason for reading the file twice: a chart exported parent-last is
  // as common as one exported parent-first.
  it('takes a parent declared below the row that names it', () => {
    const { invalid, newAccounts } = run([
      row({ row: 2, number: '1110', parent: '1105' }),
      summaryRow({ row: 3, number: '1105' }),
    ])
    expect(invalid).toEqual([])
    const parent = newAccounts.find(a => a.accountNumber === '1105')!
    expect(newAccounts.find(a => a.accountNumber === '1110')!.parentId).toBe(parent.id)
  })

  // Otherwise the child imports with a parent id pointing at an account nobody
  // wrote, and lands at the top of the chart with no way to tell why.
  it('holds back a row whose parent has an error of its own', () => {
    const rows = [
      row({ row: 2, number: '1110', parent: '1105' }),
      summaryRow({ row: 3, number: '1105', glType: 'nonsense' }),
    ]
    expect(columnsOf(rows, 2)).toEqual(['parent'])
    expect(columnsOf(rows, 3)).toEqual(['glType'])
  })

  it('refuses every row of a number used twice in the same file', () => {
    const { invalid, newAccounts } = run([
      row({ row: 2, number: '1030' }),
      row({ row: 3, number: '1030', name: 'Cash again' }),
    ])
    expect(newAccounts).toEqual([])
    expect(invalid.map(i => i.row)).toEqual([2, 3])
    for (const i of invalid) {
      expect(i.columns).toEqual(['number'])
      expect(i.errors).toEqual(['Account number 1030 is already in use. Each account needs its own number.'])
    }
  })

  /* A number the chart already holds is the same mistake as a number the file
     repeats, and is told in the same words. It used to be skipped quietly, which
     left the reader with a row on screen and no way to see why it never landed. */
  it('refuses a number the chart already holds, in the same words', () => {
    const { invalid, newAccounts } = run([row({ row: 2, number: '1015' })])
    expect(newAccounts).toEqual([])
    expect(invalid).toMatchObject([{
      row: 2,
      columns: ['number'],
      errors: ['Account number 1015 is already in use. Each account needs its own number.'],
    }])
  })

  /* Dimensions are what tell two rows of the same number apart, so a chart
     holding 71100 for one department is not holding it for another. */
  it('reads a repeated number as free when its dimensions differ', () => {
    const dimmed = (r: number, value: string): ParsedRow =>
      ({ ...row({ row: r, number: '1030' }), dimensions: [{ name: 'Department', value }] })
    const { invalid, newAccounts } = run([dimmed(2, 'Sales'), dimmed(3, 'Marketing')])
    expect(invalid).toEqual([])
    expect(newAccounts).toHaveLength(2)
  })

  /* Mahad, 2026-09-24: *"Import creates duplicate account codes and still marks
     them 'Ready.'"*

     Dimensions are the whole of what lets a number repeat, and identity was read
     as number-plus-dimensions on both sides of the comparison. So a row carrying
     no dimensions had an identity of its own - the bare number - and sat happily
     beside the same number carrying some. Two accounts numbered 71100 went into
     the chart, both of them Ready, and nothing on either told them apart. */
  it('refuses a row with no dimensions beside the same number carrying some', () => {
    const dimmed = { ...row({ row: 2, number: '7100' }), dimensions: [{ name: 'Department', value: 'Sales' }] }
    const { invalid, newAccounts } = run([dimmed, row({ row: 3, number: '7100', name: 'Bare' })])
    expect(invalid).toMatchObject([{
      row: 3,
      columns: ['number'],
      errors: ['Account number 7100 is already in use. Each account needs its own number.'],
    }])
    // The dimensioned row is the one that can be told apart, so it still imports.
    expect(newAccounts.map(a => a.accountNumber)).toEqual(['7100'])
  })

  // The same collision from the other side: the chart is holding the bare one.
  it('refuses a dimensioned row whose number the chart already holds bare', () => {
    const dimmed = { ...row({ row: 2, number: '1015' }), dimensions: [{ name: 'Department', value: 'Sales' }] }
    const { invalid, newAccounts } = run([dimmed])
    expect(newAccounts).toEqual([])
    expect(invalid).toMatchObject([{
      row: 2,
      columns: ['number'],
      errors: ['Account number 1015 is already in your chart with no dimensions on it, so nothing would tell the two apart. Each account needs its own number.'],
    }])
  })

  it('carries a row the parser could not read through to the review grid', () => {
    const { invalid } = run([{ row: 2, number: '', name: '', type: '', unparseable: 'anything' }])
    expect(invalid[0].errors).toEqual(["This row couldn't be read. Check for merged cells or extra columns."])
  })
})

// The line the spec draws: a field the engine overrode is reported, and the row
// still imports. Nothing here is a reason to hold an account back.
describe('upload validation of the fields it overrides rather than obeys', () => {
  const warnOn = (over: Partial<ParsedRow>) => {
    const { newAccounts, warned } = run([row({ row: 2, number: '1030', ...over })])
    return { account: newAccounts[0], warning: warned[0] }
  }

  /* Nothing is checked about a child's number against its parent. The parent
     claims no band, so there is nothing for the number to fall outside of. */
  it('says nothing about a number that does not look like its parent', () => {
    const { newAccounts, warned } = run([row({ row: 2, number: '1300', parent: '1015' })])
    expect(newAccounts[0].accountNumber).toBe('1300')
    expect(newAccounts[0].parentId).toBe('s_1015')
    expect(warned).toEqual([])
  })

  it('says nothing about an optional field left blank', () => {
    const { warned } = run([row({ row: 2, number: '1030', role: '', currency: '', contra: '', status: '', normalBalance: '', description: '' })])
    expect(warned).toEqual([])
  })

  it('takes a description exactly as written', () => {
    const { account } = warnOn({ description: 'Anything at all, 100% of it.' })
    expect(account.description).toBe('Anything at all, 100% of it.')
  })
})

/* A currency other than the base one is a fact about the account, not a
   preference: it decides what the balance is denominated in and what has to be
   revalued. Dropping it quietly imported an account holding the wrong money. */
describe('upload validation of the currency column', () => {
  const errorOn = (over: Partial<ParsedRow>) =>
    run([row({ row: 2, number: '1030', ...over })]).invalid[0]

  it('refuses a currency on an account that cannot hold one', () => {
    expect(errorOn({ currency: 'EUR' })).toMatchObject({
      columns: ['currency'],
      errors: ['Only bank and cash on hand accounts can hold their own currency.'],
    })
  })

  it('refuses a code that names no currency', () => {
    expect(errorOn({ role: 'Bank', currency: 'XYZ' })).toMatchObject({
      columns: ['currency'],
      errors: ["XYZ isn't a currency Omne recognises."],
    })
  })

  it('keeps a currency on the roles that carry a balance of their own', () => {
    for (const [number, type, role] of [['1030', 'Asset', 'Bank'], ['1035', 'Asset', 'Cash on Hand']]) {
      const { newAccounts, warned, invalid } = run([row({ row: 2, number, type, role, currency: 'EUR' })])
      expect(invalid, role).toEqual([])
      expect(newAccounts[0].currencyCode, role).toBe('EUR')
      expect(warned, role).toEqual([])
    }
  })

  /* Naming the base currency is not refused whatever the account is. It is what
     the account carries either way, so the column changed nothing to be wrong
     about. */
  it('says the base currency changes nothing rather than refusing it', () => {
    const { newAccounts, invalid, warned } = run([row({ row: 2, number: '1030', currency: 'USD' })])
    expect(invalid).toEqual([])
    expect(newAccounts[0].currencyCode).toBe('USD')
    expect(warned[0]).toMatchObject({
      columns: ['currency'],
      warnings: ['This is already your base currency, so it changes nothing.'],
    })
  })
})

/* The role cell may name more than one, so each value is judged on its own: a
   cell holding one good role and one misspelling has to say which is which. */
describe('upload validation of the account role column', () => {
  const errorsOn = (over: Partial<ParsedRow>) =>
    run([row({ row: 2, number: '1030', ...over })]).invalid[0]?.errors ?? []

  it('refuses a role that is on no list', () => {
    expect(errorsOn({ role: 'Petty cash' }))
      .toEqual(["Petty cash isn't an account role. See the Reference tab for the full list."])
  })

  it('refuses a real role that belongs to another category', () => {
    expect(errorsOn({ role: 'Accounts Payable' }))
      .toEqual(['Accounts payable is a liability role. This account is an asset.'])
  })

  it('refuses any role at all on a summary account', () => {
    const { newAccounts, invalid } = run([summaryRow({ row: 2, number: '1200', role: 'Bank' })])
    expect(newAccounts).toEqual([])
    expect(invalid[0]).toMatchObject({
      columns: ['role'],
      errors: ['Roles apply to posting accounts only. Clear the roles or change the type to posting.'],
    })
  })

  /* A spreadsheet cannot stop a cell holding a list, so one arriving is read
     apart rather than refused whole: that way the row is told which value is
     the problem. */
  it('judges each value in a cell separately', () => {
    expect(errorsOn({ role: 'Bank, Petty cash' }))
      .toEqual(["Petty cash isn't an account role. See the Reference tab for the full list."])
  })

  it('ignores a role listed twice rather than refusing it', () => {
    const { newAccounts, warned, invalid } = run([row({ row: 2, number: '1030', role: 'Bank; Bank' })])
    expect(invalid).toEqual([])
    expect(newAccounts[0].accountRole).toBe('Bank')
    expect(warned[0].warnings).toEqual(['Bank is listed twice. The duplicate was ignored.'])
  })

  /* An account holds one role. Two different ones is not a typo and there is
     nothing to choose between them, so neither is picked. */
  it('refuses a cell naming two different roles rather than taking one', () => {
    const { newAccounts, invalid } = run([row({ row: 2, number: '1030', role: 'Bank, Cash on Hand' })])
    expect(newAccounts).toEqual([])
    expect(invalid[0].errors).toEqual(['An account can have one role. This one lists Bank and Cash on hand.'])
  })

  it('names all of them when a cell lists more than two', () => {
    expect(errorsOn({ role: 'Bank | Cash on Hand | Inventory' }))
      .toEqual(['An account can have one role. This one lists Bank, Cash on hand and Inventory.'])
  })

  // Different accounts sharing a role is an ordinary chart: one bank account per
  // bank, one inventory account per warehouse.
  it('lets any number of accounts hold the same ordinary role', () => {
    const rows = [1030, 1031, 1032].map((n, i) => row({ row: i + 2, number: String(n), role: 'Bank' }))
    const { invalid, warned } = run(rows, [])
    expect(invalid).toEqual([])
    expect(warned).toEqual([])
  })

  /* Two accounts holding one of these leaves nothing able to say which of them
     a posting written by the system means. */
  it('refuses a second claim on retained earnings, and names both', () => {
    const eq = (r: number, number: string): ParsedRow =>
      ({ ...row({ row: r, number, type: 'Equity' }), role: 'Retained Earnings' })
    const { invalid } = run([eq(2, '3100'), eq(3, '3200')], [])
    expect(invalid.map(i => i.row)).toEqual([2, 3])
    for (const i of invalid) {
      expect(i.errors).toEqual(['Two accounts are set as retained earnings. Only one account can hold this role.'])
    }
  })

  it('counts a holder already in the chart against the file', () => {
    const held = acct({ id: 'e_3000', accountNumber: '3000', accountName: 'Retained Earnings', accountType: 'EQT', statementClassification: 'Retained earnings', glAccountType: 'Posting', isPosting: true, accountRole: 'Retained Earnings' })
    const { invalid } = run([{ ...row({ row: 2, number: '3100', type: 'Equity' }), role: 'Retained Earnings' }], [held])
    expect(invalid[0].errors).toEqual(['Two accounts are set as retained earnings. Only one account can hold this role.'])
  })

  /* A bank account is correct and unfinished: the template carries no column for
     a sort code, so the file could not have supplied one. */
  it('lists a bank account as needing details without flagging it', () => {
    const { invalid, warned, needDetails } = run([row({ row: 2, number: '1030', role: 'Bank' })])
    expect(invalid).toEqual([])
    expect(warned).toEqual([])
    expect(needDetails).toEqual([{ row: 2, number: '1030', name: 'Account 1030', role: 'Bank' }])
  })

  /* Cash on hand may be held in its own currency, which is why it sits with the
     other two in the currency rule, but there is no statement behind it and so
     nothing to go and fill in. It is a bank or a card that is unfinished. */
  it('asks for details on cards too, and on nothing else', () => {
    const rows = [
      row({ row: 2, number: '1030', role: 'Bank' }),
      row({ row: 3, number: '1035', role: 'Cash on Hand' }),
      row({ row: 4, number: '2010', type: 'Liability', role: 'Credit Card' }),
      row({ row: 5, number: '1040', role: 'Inventory' }),
      row({ row: 6, number: '1045' }),
    ]
    expect(run(rows, []).needDetails.map(n => n.row)).toEqual([2, 4])
  })
})

/* What the file looks like as a whole. None of these can be seen from one row,
   and none of them stop a row: they are the things worth saying out loud to
   someone who is about to import a file they have not read closely. */
describe('upload validation of the file as a whole', () => {
  it('flags a number that is not the width the rest of the file uses', () => {
    const rows = ['1010', '1020', '1030', '104000'].map((n, i) => row({ row: i + 2, number: n }))
    const { warned, invalid } = run(rows, [])
    expect(invalid).toEqual([])
    expect(warned).toEqual([{
      row: 5, columns: ['number'],
      warnings: ['Most of your account numbers are 4 digits. This one is 6.'],
    }])
  })

  /* A file mixing AR-1100 with 5020 has no house width to fall short of, so
     measuring it would flag nearly every row in it. */
  it('measures nothing in a file that does not number by digits alone', () => {
    const rows = ['AR-1100', '1020', '1030', '104000'].map((n, i) => row({ row: i + 2, number: n }))
    expect(run(rows, []).warned).toEqual([])
  })

  it('stays quiet when no width is the width most of the file uses', () => {
    const rows = ['1010', '1020', '104000', '105000'].map((n, i) => row({ row: i + 2, number: n }))
    expect(run(rows, []).warned).toEqual([])
  })

  /* One Petty cash per branch is an ordinary chart, so this cannot stop either
     row. It is said because the other reading, a row pasted twice, looks
     identical from here. */
  it('says two accounts share a name rather than refusing either', () => {
    const { invalid, warned, newAccounts } = run([
      row({ row: 2, number: '1030', name: 'Operating cash' }),
      row({ row: 3, number: '1040', name: 'Operating cash' }),
    ], [])
    expect(invalid).toEqual([])
    expect(newAccounts).toHaveLength(2)
    for (const w of warned) {
      expect(w.columns).toEqual(['name'])
      expect(w.warnings).toEqual(['Another account is also called Operating cash. Both will import.'])
    }
    expect(warned.map(w => w.row)).toEqual([2, 3])
  })

  it('counts a name the chart already carries', () => {
    const { warned } = run([row({ row: 2, number: '1030', name: 'Cash' })])
    expect(warned[0].warnings).toEqual(['Another account is also called Cash. Both will import.'])
  })
})

/* Roughly thirty sentences, each written once and shown to somebody who has just
   had their file refused. Linted here rather than read one by one: the rules are
   the same across all of them, and the next one added is the one that slips. */
describe('what the engine says, as copy', () => {
  const BROKEN: ParsedRow[] = [
    { row: 2, number: '', name: '', type: '', glType: '' },
    row({ row: 3, number: 'x'.repeat(200) }),
    row({ row: 4, number: '10 30' }),
    row({ row: 5, number: '1000' }),
    row({ row: 6, number: '1030', type: 'Prepaid' }),
    row({ row: 7, number: '1031', glType: 'something else' }),
    summaryRow({ row: 8, number: '1032', role: 'Bank' }),
    row({ row: 9, number: '1033', parent: '9999' }),
    row({ row: 10, number: '1034', parent: '1035' }),
    row({ row: 11, number: '1035', parent: '1034' }),
    row({ row: 12, number: '1036', type: 'Expense', parent: '1000' }),
    row({ row: 13, number: '1037', normalBalance: 'Debit' }),
    row({ row: 14, number: '1038', contra: 'maybe' }),
    summaryRow({ row: 15, number: '1039', contra: 'Yes' }),
    row({ row: 16, number: '1040', role: 'Petty cash' }),
    row({ row: 17, number: '1041', role: 'Accounts Payable' }),
    row({ row: 18, number: '1042', role: 'Bank, Bank', currency: 'USD' }),
    row({ row: 19, number: '1043', currency: 'USDD' }),
    row({ row: 20, number: '1044', currency: 'EUR' }),
    row({ row: 21, number: '1045', status: 'retired' }),
    summaryRow({ row: 22, number: '1046', status: 'Inactive' }),
    row({ row: 23, number: '1047', parent: '1046' }),
    row({ row: 24, number: '104800', name: 'Cash' }),
    { row: 25, number: '1049', name: 'Garbled', type: 'Asset', glType: 'Posting', unparseable: 'extra columns' },
    row({ row: 26, number: '3000', type: 'Equity', role: 'Retained Earnings' }),
    row({ row: 27, number: '3001', type: 'Equity', role: 'Retained Earnings' }),
  ]

  const said = (() => {
    const { invalid, warned } = run(BROKEN)
    return [...invalid.flatMap(i => i.errors), ...warned.flatMap(w => w.warnings)]
  })()

  it('reaches most of what the engine can say, so the rules below bite', () => {
    expect(new Set(said).size).toBeGreaterThan(20)
  })

  it('writes a whole sentence, ending in a full stop', () => {
    for (const s of said) {
      expect(s, s).toMatch(/\.$/)
      expect(s[0], s).toBe(s[0].toUpperCase())
    }
  })

  // Straight apostrophes and no dashes for punctuation, house-wide.
  it('keeps to straight quotes and plain punctuation', () => {
    for (const s of said) expect(s, s).not.toMatch(/[—–‘’“”]/)
  })

  /* The five-type model and the numbering language that went with it. Any of
     these back in a message is a message describing a chart we no longer build. */
  it('uses none of the vocabulary this module retired', () => {
    for (const s of said) {
      expect(s, s).not.toMatch(/\b(segments?|Begin-Total|End-Total|Headings?)\b/i)
      // "Dimension" is the reader's word for a dimension; "group" alone is not.
      expect(s, s).not.toMatch(/\bgroups?\b(?! filter)/i)
    }
  })
})
