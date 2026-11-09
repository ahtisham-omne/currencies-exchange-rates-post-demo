import { describe, it, expect } from 'vitest'
import { detectFileShape, readRows, suggestAccountSlot, distinctSlotValues, VALUE_MEANS_NOTHING, rowsWithoutDimensions, patternFit, type FileShape } from './codeMapper'
import { splitRows, isSummary, type SlotMeaning } from './importSplit'
import { runUploadValidation, buildExistingIndex, type ParsedRow } from './uploadValidation'
import { schemeFromNumberWidth } from '../components/AccountNumberingStep'
import type { Account } from '../types'

/* The seam, end to end: a glued file read, split, and then put to the validation
   engine exactly as the import wires it.
 *
 * Each half is covered on its own in codeMapper.test.ts. What only shows up here
 * is the handover - above all that a number repeating is now the ordinary case,
 * and that what stops two rows being the same account is the dimensions read off
 * their numbers. Get that wrong and a segmented file imports as one account and a
 * pile of duplicates. */

// The seeded chart is 4 wide; nothing about the file changes that, because a
// number is imported exactly as typed and the scheme only decides placement.
const SCHEME = schemeFromNumberWidth(4)

// The file from the explainer, verbatim: two departments of one Travel account
// and one bank account, all in one London entity.
const FILE: ParsedRow[] = [
  { row: 2, number: '01-71100-40', name: 'Travel - Sales', type: 'Expense', glType: 'Posting' },
  { row: 3, number: '01-71100-50', name: 'Travel - Marketing', type: 'Expense', glType: 'Posting' },
  { row: 4, number: '01-11000-00', name: 'Cash at bank', type: 'Asset', glType: 'Posting' },
]

// The customer's answers: part 1 is Entity, part 2 is the account, part 3 is
// Department, and the 00 that stands for no department says so.
const MEANINGS: SlotMeaning[] = [
  { slot: 0, name: 'Entity', labels: { '01': 'London' } },
  { slot: 2, name: 'Department', labels: { '40': 'Sales', '50': 'Marketing', '00': VALUE_MEANS_NOTHING } },
]

function pass(rows: ParsedRow[], meanings = MEANINGS, accountIdx?: number, chart: Account[] = []) {
  // As the import reads them: posting accounts only, summaries standing in blank.
  const numbers = rows.map(r => (isSummary(r) ? '' : r.number))
  const shape = detectFileShape(numbers) as FileShape
  const idx = accountIdx ?? suggestAccountSlot(numbers, shape)
  const readings = readRows(numbers, shape, idx)
  const split = splitRows(rows, readings, meanings, raw => readRows([raw], shape, idx)[0].accountPart)
  return {
    shape, idx, readings, ...split,
    result: runUploadValidation(split.rows, chart, 'USD', buildExistingIndex(chart)),
  }
}

describe('the explainer\'s own file, read and split', () => {
  /* The whole reversal in one assertion. The rows stay; only the code splits. */
  it('stays three accounts, and two of them share a number', () => {
    const { rows } = pass(FILE)
    expect(rows.map(r => `${r.number} ${r.name}`)).toEqual([
      '71100 Travel - Sales', '71100 Travel - Marketing', '11000 Cash at bank',
    ])
  })

  it('keeps the name the file gave each row, inventing none', () => {
    expect(pass(FILE).rows.map(r => r.name)).toEqual(FILE.map(r => r.name))
  })

  /* On the evidence alone: width is what points at the middle part. */
  it('proposes the account part without being told which it is', () => {
    expect(pass(FILE).idx).toBe(1)
  })

  it('reads each row\'s own values off its own number', () => {
    const { rows } = pass(FILE)
    expect(rows[0].dimensions).toEqual([{ name: 'Entity', value: 'London' }, { name: 'Department', value: 'Sales' }])
    expect(rows[1].dimensions).toEqual([{ name: 'Entity', value: 'London' }, { name: 'Department', value: 'Marketing' }])
  })

  /* Absence is absence. Cash carries the 00 the customer called meaningless, so
     it gets an entity and no department - not an "Unassigned" to store. */
  it('stores nothing for a code the customer said means nothing', () => {
    expect(pass(FILE).rows[2].dimensions).toEqual([{ name: 'Entity', value: 'London' }])
  })

  it('offers the customer\'s names as the dimension values, and no meaningless code', () => {
    const { readings } = pass(FILE)
    expect(distinctSlotValues(readings, 0, MEANINGS[0].labels)).toEqual(['London'])
    expect(distinctSlotValues(readings, 2, MEANINGS[1].labels)).toEqual(['Sales', 'Marketing'])
  })

  it('keeps the full code that arrived, so nothing the file said is lost', () => {
    const { arrivals } = pass(FILE)
    expect(arrivals.get(2)).toBe('01-71100-40')
    expect(arrivals.get(3)).toBe('01-71100-50')
  })
})

describe('the chart the split hands to validation', () => {
  /* The regression this file exists for. Under the old rule 71100 twice was a
     duplicate, so the second Travel row was dropped and the department
     distinction with it. */
  it('creates all three accounts, and calls none of them a duplicate', () => {
    const { result } = pass(FILE)
    expect(result.invalid).toEqual([])
    expect(result.newAccounts.map(a => a.accountNumber)).toEqual(['11000', '71100', '71100'])
  })

  it('places each account by what the file called it', () => {
    expect(pass(FILE).result.newAccounts.map(a => a.accountType)).toEqual(['AST', 'EXP', 'EXP'])
  })

  /* The other side of the same rule. If nobody kept the department, nothing in
     the chart could tell the two Travel rows apart, so they collide - and the
     message has to say why rather than just refuse. */
  it('collides the two rows when the part that told them apart was ignored', () => {
    const { result } = pass(FILE, [MEANINGS[0]])
    expect(result.newAccounts.map(a => a.accountNumber)).toEqual(['11000'])
    expect(result.invalid).toHaveLength(2)
    expect(result.invalid[0].errors.join(' ')).toContain('Entity London')
  })

  /* A number is free text now, so a 5-wide account part against the seeded
     4-wide scheme is not a complaint. Nothing is renumbered to fit. */
  it('imports a number wider than the scheme exactly as typed', () => {
    const { result } = pass(FILE)
    expect(result.newAccounts.map(a => a.accountNumber)).toContain('71100')
  })
})

/* Pointer 5's summary rule. A file written per entity states its structure once
   per entity, and those statements are one summary: it holds no balance and takes
   no transactions, so there is nothing for a dimension on one to qualify. */
describe('a summary the file states more than once', () => {
  const PER_ENTITY: ParsedRow[] = [
    { row: 2, number: '01-71000-00', name: 'Operating Expenses', type: 'Expense', glType: 'Summary' },
    { row: 3, number: '01-71100-40', name: 'Travel - Sales', type: 'Expense', glType: 'Posting', parent: '01-71000-00' },
    { row: 4, number: '02-71000-00', name: 'Operating Expenses', type: 'Expense', glType: 'Summary' },
    { row: 5, number: '02-71100-40', name: 'Travel - Sales', type: 'Expense', glType: 'Posting', parent: '02-71000-00' },
  ]

  it('imports it once, and says so', () => {
    const { rows, folded } = pass(PER_ENTITY, MEANINGS, 1)
    expect(rows.map(r => `${r.number} ${r.glType}`)).toEqual(['71000 Summary', '71100 Posting', '71100 Posting'])
    expect(folded.get(2)).toEqual(['02-71000-00'])
  })

  it('carries no dimensions on the summary, whichever entity stated it', () => {
    expect(pass(PER_ENTITY, MEANINGS, 1).rows[0].dimensions).toBeUndefined()
  })

  /* Because a summary never repeats, a stated parent number resolves to exactly
     one row - which is what makes reading the parent through the split safe. */
  it('parents both entities\' postings to that one summary', () => {
    const { result } = pass(PER_ENTITY, MEANINGS, 1)
    expect(result.invalid).toEqual([])
    const summary = result.newAccounts.find(a => a.glAccountType === 'Summary') as Account
    expect(result.newAccounts.filter(a => a.glAccountType === 'Posting').map(a => a.parentId))
      .toEqual([summary.id, summary.id])
  })

  /* Mahad, 2026-09-22: *"prior account number is always one number that was
     imported."* The summary keeps the statement that landed; the others are
     named as folded into it, which is what the review grid reads. */
  it('keeps the statement that landed as its one original code', () => {
    expect(pass(PER_ENTITY, MEANINGS, 1).arrivals.get(2)).toBe('01-71000-00')
  })
})

/* A real export is ragged, and the reason the tolerant reader exists: the old
   rectangle reader gave up on a file like this and fell back to flat, which cost
   the chart every dimension in it. */
describe('a ragged file with the account leftmost', () => {
  const RAGGED: ParsedRow[] = [
    { row: 2, number: '2000-200', name: 'Rent - Sales', type: 'Expense', glType: 'Posting' },
    { row: 3, number: '2000-300', name: 'Rent - Admin', type: 'Expense', glType: 'Posting' },
    { row: 4, number: '3000', name: 'Insurance', type: 'Expense', glType: 'Posting' },
  ]
  const DEPT: SlotMeaning[] = [{ slot: 1, name: 'Department', labels: { '200': 'Sales', '300': 'Admin' } }]

  it('keeps all three rows, the short one as a bare account', () => {
    const { rows } = pass(RAGGED, DEPT, 0)
    expect(rows.map(r => `${r.number} ${r.name}`)).toEqual(['2000 Rent - Sales', '2000 Rent - Admin', '3000 Insurance'])
  })

  /* Absence is absence. The short row reached no second part, so it carries no
     department - not a padded stand-in for one. */
  it('gives the short row no dimension value at all', () => {
    expect(pass(RAGGED, DEPT, 0).rows[2].dimensions).toBeUndefined()
  })

  it('validates without complaint, ragged input and all', () => {
    expect(pass(RAGGED, DEPT, 0).result.invalid).toEqual([])
  })
})

/* A file usually has one or two numbers that were never built the way the rest
   were. The rule is that the split not holding for a row is not licence to
   rewrite it: the number is kept exactly as the file spelled it, carries no
   dimensions, and is reported so the review grid can say why. */
describe('a number the split does not hold for', () => {
  const ODD: ParsedRow[] = [
    ...FILE,
    { row: 5, number: '01-71100-50-9', name: 'Travel - odd one out', type: 'Expense', glType: 'Posting' },
  ]

  /* The three well-built rows set the pattern. One number typed with an extra
     segment does not make the rest of the file short. */
  it('takes the pattern from the numbers that agree, not the longest one', () => {
    expect(pass(ODD, MEANINGS, 1).shape.partCount).toBe(3)
  })

  it('keeps the whole code as the account number, padding nothing', () => {
    const { rows } = pass(ODD, MEANINGS, 1)
    expect(rows.map(r => r.number)).toEqual(['71100', '71100', '11000', '01-71100-50-9'])
  })

  it('gives it no dimensions, rather than guessing which part was which', () => {
    expect(pass(ODD, MEANINGS, 1).rows[3].dimensions).toBeUndefined()
  })

  it('reports it, so the row can be flagged rather than quietly imported', () => {
    expect([...pass(ODD, MEANINGS, 1).unsplit]).toEqual([5])
  })

  /* Still a legal account number, so it imports. Letters, numbers and dashes is
     the whole rule, and this is inside it. */
  it('imports it, because a number is free text and this is a number', () => {
    const { result } = pass(ODD, MEANINGS, 1)
    expect(result.invalid).toEqual([])
    expect(result.newAccounts.map(a => a.accountNumber)).toContain('01-71100-50-9')
  })

  it('keeps it as the code it arrived as', () => {
    expect(pass(ODD, MEANINGS, 1).arrivals.get(5)).toBe('01-71100-50-9')
  })
})

/* Free text stops at letters, numbers and dashes. The import runs the same rule
   the account form does, so a file cannot put a number into the chart that nobody
   could have typed into it - and cannot refuse one they could. */
describe('a number carrying letters', () => {
  const LETTERS: ParsedRow[] = [
    { row: 2, number: '01-71100-40', name: 'Travel - Sales', type: 'Expense', glType: 'Posting' },
    { row: 3, number: '01-711X0-40', name: 'Travel - other', type: 'Expense', glType: 'Posting' },
  ]

  it('imports it, because a letter is part of a number', () => {
    const { result } = pass(LETTERS, MEANINGS, 1)
    expect(result.invalid).toEqual([])
    expect(result.newAccounts.map(a => a.accountNumber)).toContain('711X0')
  })
})

/* A stray space is a separator (agreed Sept 3), so the typo adds a segment, the
   row cannot be split the file's way and imports whole, and its whole number is
   then refused for the space in it. */
describe('a number that is not letters, numbers and dashes', () => {
  const SPACED: ParsedRow[] = [
    { row: 2, number: '01-71100-40', name: 'Travel - Sales', type: 'Expense', glType: 'Posting' },
    { row: 3, number: '01-711 0-40', name: 'Travel - typo', type: 'Expense', glType: 'Posting' },
    { row: 4, number: '02-71100-40', name: 'Travel - Ops', type: 'Expense', glType: 'Posting' },
  ]

  it('refuses it, naming the number column', () => {
    const { result } = pass(SPACED, MEANINGS, 1)
    expect(result.invalid.map(i => i.row)).toEqual([3])
    expect(result.invalid[0].errors).toEqual(['Account numbers can use letters, numbers, and dashes only.'])
    expect(result.invalid[0].columns).toContain('number')
  })
})

/* Only posting accounts can have dimensions (Mahad, 2026-10-02). A chart that
   writes its summaries plainly over segmented postings is the ordinary shape of
   a chart: the summaries are not told they hold no separator, they keep their
   numbers, and nothing they hold becomes a dimension. */
describe('summaries in a segmented file', () => {
  const MIXED: ParsedRow[] = [
    { row: 2, number: '11000', name: 'Current Assets', type: 'Asset', glType: 'Summary' },
    { row: 3, number: '11100', name: 'Cash', type: 'Asset', glType: 'Summary', parent: '11000' },
    { row: 4, number: '01-11110-40', name: 'Bank - Sales', type: 'Asset', glType: 'Posting', parent: '11100' },
    { row: 5, number: '01-11120-50', name: 'Bank - Marketing', type: 'Asset', glType: 'Posting', parent: '11100' },
  ]
  const numbers = MIXED.map(r => (isSummary(r) ? '' : r.number))

  it('reads the file\'s shape off its posting accounts, and flags no summary for it', () => {
    const shape = detectFileShape(numbers)!
    expect(shape.partCount).toBe(3)
    expect(rowsWithoutDimensions(numbers, shape)).toEqual([])
    expect(patternFit(numbers, shape).short).toEqual([])
  })

  it('keeps each summary\'s number whole, with no dimensions and no warning', () => {
    const { rows, unsplit, result } = pass(MIXED, MEANINGS, 1)
    expect(rows.map(r => [r.number, r.dimensions?.length ?? 0])).toEqual([['11000', 0], ['11100', 0], ['11110', 2], ['11120', 2]])
    expect(unsplit.size).toBe(0)
    expect(result.invalid).toEqual([])
    expect(result.warned.filter(w => w.row <= 3)).toEqual([])
  })

  it('refuses a dimension typed onto a summary in the review grid', () => {
    const result = runUploadValidation([{ ...MIXED[0], dimensions: [{ name: 'Department', value: 'Sales' }] }], [], 'USD')
    expect(result.invalid[0].errors).toEqual(['Only posting accounts can have dimensions. Clear the dimension values on this summary account.'])
    expect(result.invalid[0].columns).toEqual(['dim:Department'])
  })
})
