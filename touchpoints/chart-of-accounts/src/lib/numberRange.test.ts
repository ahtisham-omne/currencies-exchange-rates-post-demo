import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  accountRange,
  categoryBlock,
  chartConflicts,
  checkPlacement,
  childBlock,
  childBlockSize,
  formatRange,
  numericValueOf,
  offerBlocks,
  parseRangeInputs,
  problemText,
  protectedSpan,
  rangeContainsNumber,
  rangeContainsRange,
  rangesOverlap,
  suggestPostingNumber,
  numberBeside,
  chartNumberWidth,
  numberLengthWarning,
} from './numberRange'
import { seedAccounts } from './seed'
import type { Account } from '../types'

/* A summary reserves a block of numbers. What the module is promising, as
   settled in the design review of 2026-09-24:

   - a reservation is a one-way block: it keeps accounts that are not under the
     summary out, and does not keep the summary's own accounts in;
   - with number protection on, the stretch from a summary to its last account
     is kept for its accounts even with no range typed;
   - a new summary is offered the next clean block one zero smaller than its
     parent's, never the leftover tail;
   - a refusal names the account in the way, so the form can draw it as a pill. */

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8')

/* Minimal account, so a test can pin one behaviour at a time without dragging
   the whole shape of an Account into every case. Cast at the callsite. */
const acc = (over: Partial<Account>): any => ({
  id: 'x',
  accountNumber: '',
  accountName: '',
  glAccountType: 'Summary',
  parentId: null,
  ...over,
})

describe('reading a range off an account', () => {
  it('reads both ends when the account holds them', () => {
    expect(accountRange({ numberRangeStart: 1000, numberRangeEnd: 1999 })).toEqual({ start: 1000, end: 1999 })
  })

  it('reads nothing when either end is missing', () => {
    expect(accountRange({ numberRangeStart: 1000, numberRangeEnd: undefined })).toBeNull()
    expect(accountRange({ numberRangeStart: undefined, numberRangeEnd: 1999 })).toBeNull()
    expect(accountRange({})).toBeNull()
  })

  it('refuses a range whose ends are the wrong way round', () => {
    // A range typed 1999-1000 is not a range going the other way, it is one
    // whose ends were confused. Reading it as valid would let it hide behind a
    // subsequent overlap check that could not answer for it.
    expect(accountRange({ numberRangeStart: 1999, numberRangeEnd: 1000 })).toBeNull()
  })
})

describe('the numeric value of an account number', () => {
  it('is the integer for a number that is one', () => {
    expect(numericValueOf('1010')).toBe(1010)
    expect(numericValueOf(' 1010 ')).toBe(1010)
  })

  it('is null for a number with letters', () => {
    // Stripping the AR out of AR100 to reach 100 would file the account against
    // a number the customer never wrote. See the header comment.
    expect(numericValueOf('AR100')).toBeNull()
    expect(numericValueOf('100-40')).toBeNull()
    expect(numericValueOf('')).toBeNull()
  })
})

describe('the small algebra of ranges', () => {
  const r = { start: 1000, end: 1999 }

  it('contains a number when the number is inside, inclusive', () => {
    expect(rangeContainsNumber(r, 1000)).toBe(true)
    expect(rangeContainsNumber(r, 1500)).toBe(true)
    expect(rangeContainsNumber(r, 1999)).toBe(true)
    expect(rangeContainsNumber(r, 999)).toBe(false)
    expect(rangeContainsNumber(r, 2000)).toBe(false)
  })

  it('contains a range when the range sits inside, inclusive', () => {
    expect(rangeContainsRange(r, { start: 1000, end: 1999 })).toBe(true)
    expect(rangeContainsRange(r, { start: 1100, end: 1200 })).toBe(true)
    expect(rangeContainsRange(r, { start: 999, end: 1200 })).toBe(false)
    expect(rangeContainsRange(r, { start: 1800, end: 2000 })).toBe(false)
  })

  it('overlaps a touching range', () => {
    // Adjacency is overlap because the endpoint is a number a posting could
    // sit on. 1000-1999 and 1999-2999 both stake a claim to 1999.
    expect(rangesOverlap(r, { start: 1999, end: 2999 })).toBe(true)
    expect(rangesOverlap(r, { start: 500, end: 1000 })).toBe(true)
    expect(rangesOverlap(r, { start: 2000, end: 2999 })).toBe(false)
  })
})

describe('parsing what the form typed', () => {
  it('reads two empty fields as no range', () => {
    expect(parseRangeInputs('', '')).toEqual({ kind: 'empty' })
    expect(parseRangeInputs('  ', ' ')).toEqual({ kind: 'empty' })
  })

  it('refuses a half-set range', () => {
    // Either both or neither: a lone endpoint names no block.
    expect(parseRangeInputs('1000', '')).toEqual({ kind: 'error', error: expect.stringMatching(/both/i) })
    expect(parseRangeInputs('', '1999')).toEqual({ kind: 'error', error: expect.stringMatching(/both/i) })
  })

  it('refuses a lettered end', () => {
    expect(parseRangeInputs('AR', '1999').kind).toBe('error')
    expect(parseRangeInputs('1000', '19XX').kind).toBe('error')
  })

  it('refuses a range whose start is above its end', () => {
    expect(parseRangeInputs('1999', '1000').kind).toBe('error')
  })

  it('returns the range on two good integers', () => {
    expect(parseRangeInputs('1000', '1999')).toEqual({ kind: 'range', range: { start: 1000, end: 1999 } })
  })
})

/* A small chart in the cascade's shape, so each rule can be pinned on its own.

   ASSETS 10000 [10000-19999]
     Current Assets 11000 [11000-11999]
       Cash 11100 [11100-11199]: 11110, 11120
       Investments 11200 (no range): 11210, 11220
     Receivables 12000 [12000-12999]: 12010 */
const chart = [
  acc({ id: 'ast', accountNumber: '10000', accountName: 'ASSETS', numberRangeStart: 10000, numberRangeEnd: 19999 }),
  acc({ id: 'cur', accountNumber: '11000', accountName: 'Current Assets', parentId: 'ast', numberRangeStart: 11000, numberRangeEnd: 11999 }),
  acc({ id: 'cash', accountNumber: '11100', accountName: 'Cash', parentId: 'cur', numberRangeStart: 11100, numberRangeEnd: 11199 }),
  acc({ id: 'petty', accountNumber: '11110', accountName: 'Petty Cash', parentId: 'cash', glAccountType: 'Posting' }),
  acc({ id: 'bank', accountNumber: '11120', accountName: 'Bank', parentId: 'cash', glAccountType: 'Posting' }),
  acc({ id: 'inv', accountNumber: '11200', accountName: 'Investments', parentId: 'cur' }),
  acc({ id: 'sec', accountNumber: '11210', accountName: 'Securities', parentId: 'inv', glAccountType: 'Posting' }),
  acc({ id: 'cds', accountNumber: '11220', accountName: 'CDs', parentId: 'inv', glAccountType: 'Posting' }),
  acc({ id: 'rec', accountNumber: '12000', accountName: 'Receivables', parentId: 'ast', numberRangeStart: 12000, numberRangeEnd: 12999 }),
  acc({ id: 'trade', accountNumber: '12010', accountName: 'Trade', parentId: 'rec', glAccountType: 'Posting' }),
]
const posting = (accountNumber: string, parentId: string, protection = true) =>
  checkPlacement({ accountNumber, glAccountType: 'Posting', parentId, chart, protection })
const summary = (start: number, end: number, parentId: string, protection = true, extra: object = {}) =>
  checkPlacement({ accountNumber: String(start), glAccountType: 'Summary', parentId, range: { start, end }, chart, protection, ...extra })

describe('a reservation is a one-way block', () => {
  it('keeps an account that is not under the summary out of its block, naming the summary', () => {
    const p = posting('11150', 'rec')!
    expect(p).not.toBeNull()
    expect(p.holder).toEqual({ accountNumber: '11100', accountName: 'Cash' })
    expect(problemText(p)).toMatch(/^This number is inside the range 11100 Cash sets aside \(11100–11199\)/)
  })

  it('keeps it out even with number protection off - a typed range always holds', () => {
    expect(posting('11150', 'rec', false)?.holder?.accountNumber).toBe('11100')
  })

  it('names the nearest block in the way, not the category above it', () => {
    expect(posting('11150', 'rec')!.holder!.accountName).toBe('Cash')
  })

  it('lets the summary\'s own account sit outside its block', () => {
    // Eli: "It is not to force you into the range." With protection off there
    // is nothing else in the way.
    expect(posting('11350', 'cash', false)).toBeNull()
  })

  it('never leaves a full block without somewhere to put the next account', () => {
    const full = [
      ...chart.filter(a => a.parentId !== 'cash'),
      ...Array.from({ length: 99 }, (_, i) => acc({ id: `c${i}`, accountNumber: String(11101 + i), parentId: 'cash', glAccountType: 'Posting' })),
    ]
    const p = checkPlacement({ accountNumber: '11350', glAccountType: 'Posting', parentId: 'cash', chart: full, protection: false })
    expect(p).toBeNull()
  })

  it('refuses a summary range that takes a number someone else already holds', () => {
    const p = summary(11200, 11299, 'cur', false)!
    expect(problemText(p)).toMatch(/11200 Investments already uses a number in this range/)
  })

  it('refuses a range overlapping another summary\'s, naming it', () => {
    const p = summary(11150, 11159, 'cur', false)!
    expect(p.holder?.accountNumber).toBe('11100')
  })

  it('refuses a summary numbered outside its own range', () => {
    const p = checkPlacement({ accountNumber: '11300', glAccountType: 'Summary', parentId: 'cur', range: { start: 11400, end: 11499 }, chart, protection: true })!
    expect(p.text).toMatch(/first number of the range it reserves\. Use 11400/)
  })

  /* Decision 84: the first number of the range, not anywhere inside it. Module
     review, 2026-10-06 (COA-14): 11655 reserving 11650-11699 was accepted. */
  it('refuses a summary numbered inside its range but past the first number', () => {
    const p = checkPlacement({ accountNumber: '11655', glAccountType: 'Summary', parentId: 'cur', range: { start: 11650, end: 11699 }, chart, protection: true })!
    expect(p.text).toMatch(/Use 11650, or change the range/)
    expect(checkPlacement({ accountNumber: '11650', glAccountType: 'Summary', parentId: 'cur', range: { start: 11650, end: 11699 }, chart, protection: true })).toBeNull()
  })

  it('lets a lettered number through every block', () => {
    expect(posting('AR100', 'rec')).toBeNull()
  })

  it('does not hold a new account to what the chart already broke', () => {
    // An import let in with protection off. Adding an unrelated account later is
    // not refused over the old clash.
    const messy = [...chart, acc({ id: 'stray', accountNumber: '11215', parentId: 'rec', glAccountType: 'Posting' })]
    expect(checkPlacement({ accountNumber: '12020', glAccountType: 'Posting', parentId: 'rec', chart: messy, protection: true })).toBeNull()
  })
})

describe('number protection', () => {
  it('keeps the stretch from a summary with no range to its last account', () => {
    expect(protectedSpan('inv', chart, true)).toEqual({ range: { start: 11200, end: 11220 }, auto: true })
    expect(protectedSpan('inv', chart, false)).toBeNull()
  })

  it('refuses an outsider inside that stretch, saying where the stretch comes from', () => {
    const p = posting('11215', 'cur')!
    expect(p.holder?.accountNumber).toBe('11200')
    expect(p.text).toMatch(/the accounts under \{holder\} already use \(11200–11220\)/)
    expect(posting('11215', 'cur', false)).toBeNull()
  })

  it('refuses a summary injected between a branch\'s accounts', () => {
    // Eli: "prevent the injection".
    expect(summary(11212, 11219, 'cur')).not.toBeNull()
    expect(summary(11212, 11219, 'cur', false)).toBeNull()
  })

  it('refuses an account placed so far out it stretches its branch across another', () => {
    const p = posting('11650', 'cash')!
    expect(problemText(p)).toMatch(/push that range into the numbers of 11200 Investments/)
    expect(p.holder?.accountNumber).toBe('11100')
  })

  it('lets the branch grow past its last account where nothing is in the way', () => {
    expect(posting('11230', 'inv')).toBeNull()
  })

  it('keeps the demo chart clean both ways', () => {
    expect(chartConflicts(seedAccounts, true)).toEqual([])
    expect(chartConflicts(seedAccounts, false)).toEqual([])
  })

  it('numbers every demo summary at the start of the range it reserves (decision 84)', () => {
    const off = seedAccounts
      .filter(x => x.glAccountType === 'Summary' && accountRange(x))
      .filter(x => numericValueOf(x.accountNumber) !== accountRange(x)!.start)
      .map(x => `${x.accountNumber} ${formatRange(accountRange(x)!)}`)
    expect(off).toEqual([])
  })

  it('lists a chart that breaks it, naming both sides', () => {
    const messy = [...chart, acc({ id: 'stray', accountNumber: '11215', accountName: 'Stray', parentId: 'rec', glAccountType: 'Posting' })]
    const c = chartConflicts(messy, true)
    expect(c.map(x => [x.account.accountNumber, x.holder.accountNumber])).toContainEqual(['11215', '11200'])
    // Off, the stretch Investments keeps goes - but Current Assets typed its
    // range, and a typed range still keeps the stray out.
    const off = chartConflicts(messy, false).map(x => [x.account.accountNumber, x.holder.accountNumber])
    expect(off).toContainEqual(['11215', '11000'])
    expect(off).not.toContainEqual(['11215', '11200'])
  })
})

describe('the blocks a new summary is offered', () => {
  it('divides a parent into blocks one zero smaller', () => {
    expect(childBlockSize(chart[0], chart)).toBe(1000)
    expect(childBlockSize(chart[1], chart)).toBe(100)
    expect(childBlockSize(chart[2], chart)).toBe(10)
  })

  it('sizes a parent with no range by where it sits', () => {
    // Investments is two levels down in a five-digit chart: blocks of ten.
    expect(childBlockSize(chart[5], chart)).toBe(10)
  })

  it('offers no block smaller than ten numbers', () => {
    const odd = acc({ id: 'odd', accountNumber: '1015', numberRangeStart: 1015, numberRangeEnd: 1049 })
    expect(childBlockSize(odd, [odd])).toBeNull()
  })

  it('recommends the next clean block after what the parent holds, not the leftover tail', () => {
    const o = offerBlocks({ parent: chart[1], chart, protection: true })
    expect(o.recommended).toEqual({ start: 11300, end: 11399 })
    expect(o.inParent.every(b => b.end - b.start + 1 === 100)).toBe(true)
    expect(o.inParent.map(b => b.start)).not.toContain(11100)
    expect(o.inParent.map(b => b.start)).not.toContain(11200)
  })

  it('offers only blocks the check would accept', () => {
    const o = offerBlocks({ parent: chart[1], chart, protection: true })
    for (const b of o.inParent) expect(summary(b.start, b.end, 'cur')).toBeNull()
  })

  it('offers blocks outside the parent only when the parent has none left', () => {
    const tight = [
      ...chart,
      ...Array.from({ length: 10 }, (_, i) => acc({ id: `s${i}`, accountNumber: String(11102 + i * 10), parentId: 'cash', glAccountType: 'Posting' })),
    ]
    const o = offerBlocks({ parent: tight[2], chart: tight, protection: false })
    expect(o.inParent).toEqual([])
    expect(o.outside.length).toBeGreaterThan(0)
    for (const b of o.outside) expect(rangesOverlap(b, { start: 11100, end: 11199 })).toBe(false)
    expect(offerBlocks({ parent: chart[1], chart, protection: true }).outside).toEqual([])
  })

  /* Design review, 2026-10-02 - Eli: the summary takes the number in front of
     the account it is wrapping, and the block runs to the block's own end. */
  it('puts the new summary directly in front of the account being moved under it', () => {
    const o = offerBlocks({ parent: chart[2], chart, protection: true, adopts: ['petty'] })
    expect(o.recommended).toEqual({ start: 11109, end: 11119 })
  })

  it('opens one past the account instead when the number in front of it is taken', () => {
    const taken = [...chart, acc({ id: 'float', accountNumber: '11109', accountName: 'Float', parentId: 'cash', glAccountType: 'Posting' })]
    const o = offerBlocks({ parent: chart[2], chart: taken, protection: true, adopts: ['petty'] })
    expect(o.recommended).toEqual({ start: 11111, end: 11119 })
  })

  it('offers nothing without a parent', () => {
    expect(offerBlocks({ parent: null, chart, protection: true }).recommended).toBeNull()
  })

  it('opens a new summary under the demo chart\'s Current Assets at 11600', () => {
    const cur = seedAccounts.find(a => a.accountNumber === '11000')!
    expect(offerBlocks({ parent: cur, chart: seedAccounts, protection: true }).recommended).toEqual({ start: 11600, end: 11699 })
  })
})

describe('the number a new posting account is offered', () => {
  it('is next after its siblings, on the step they keep', () => {
    expect(suggestPostingNumber({ parent: chart[2], chart, protection: true })).toBe(11130)
  })

  it('opens ten past the parent when nothing is under it yet', () => {
    expect(suggestPostingNumber({ parent: chart[8], chart: chart.filter(a => a.id !== 'trade'), protection: true })).toBe(12010)
  })

  it('steps over a child summary\'s block', () => {
    // Under Current Assets the first ten-step lands on 11010, clear of Cash and
    // Investments, which sit in 11100 and up.
    expect(suggestPostingNumber({ parent: chart[1], chart, protection: true })).toBe(11010)
  })

  it('reads a sibling step wider than ten as ten', () => {
    const eq = [
      acc({ id: 'eq', accountNumber: '30000', numberRangeStart: 30000, numberRangeEnd: 39999 }),
      acc({ id: 're', accountNumber: '32000', parentId: 'eq', glAccountType: 'Posting' }),
      acc({ id: 'oci', accountNumber: '34000', parentId: 'eq', glAccountType: 'Posting' }),
    ]
    expect(suggestPostingNumber({ parent: eq[0], chart: eq, protection: true })).toBe(34010)
  })

  it('offers nothing for a lettered parent with no range', () => {
    const p = acc({ id: 'p', accountNumber: 'AR' })
    expect(suggestPostingNumber({ parent: p, chart: [p], protection: true })).toBeNull()
  })
})

describe('the cascade Omne numbers its own charts by', () => {
  it('gives a category every number that starts with its digit', () => {
    expect(categoryBlock(1, 5)).toEqual({ start: 10000, end: 19999 })
    expect(categoryBlock(5, 4)).toEqual({ start: 5000, end: 5999 })
  })

  it('takes one zero off per level', () => {
    expect(childBlock({ start: 10000, end: 19999 }, 1)).toEqual({ start: 11000, end: 11999 })
    expect(childBlock({ start: 11000, end: 11999 }, 3)).toEqual({ start: 11300, end: 11399 })
    expect(childBlock({ start: 11300, end: 11399 }, 9)).toEqual({ start: 11390, end: 11399 })
    expect(childBlock({ start: 11390, end: 11399 }, 1)).toBeNull()
  })

  it('lays the demo chart out that way', () => {
    const by = (n: string) => seedAccounts.find(a => a.accountNumber === n)!
    expect(accountRange(by('10000'))).toEqual({ start: 10000, end: 19999 })
    expect(accountRange(by('11000'))).toEqual({ start: 11000, end: 11999 })
    expect(accountRange(by('11100'))).toEqual({ start: 11100, end: 11199 })
    expect(seedAccounts.every(a => a.accountNumber.length === 5)).toBe(true)
  })

  it('still reads the helpers the listing uses', () => {
    expect(formatRange({ start: 10000, end: 19999 })).toBe('10000–19999')
    expect(numericValueOf('11110')).toBe(11110)
    expect(rangeContainsNumber({ start: 11100, end: 11199 }, 11110)).toBe(true)
    expect(rangeContainsRange({ start: 11000, end: 11999 }, { start: 11100, end: 11199 })).toBe(true)
  })
})

/* "Create account above" and "below" on a row's menu (design review,
   2026-10-02): a sibling, numbered in the gap on that side. Read off the demo
   chart, where Cash and Cash Equivalents (11100, reserving 11100-11199) holds
   11110 to 11180 and sits beside the next block, Short-Term Investments. */
describe('the number a new account beside another is offered', () => {
  const byNum = (n: string) => seedAccounts.find(a => a.accountNumber === n)!
  const beside = (n: string, side: 'above' | 'below') =>
    numberBeside({ account: byNum(n), side, chart: seedAccounts, protection: true })

  it('takes the middle of the gap between two neighbours', () => {
    expect(beside('11130', 'above')).toBe(11125)
    expect(beside('11130', 'below')).toBe(11135)
  })

  it('stays between the first account and its parent above it', () => {
    expect(beside('11110', 'above')).toBe(11105)
  })

  it('steps ten past the last account, inside the parent\'s block', () => {
    expect(beside('11180', 'below')).toBe(11190)
  })

  it('goes past everything a summary keeps, and offers nothing where the next block starts straight after', () => {
    expect(beside('11100', 'below')).toBeNull()
    expect(beside('11200', 'above')).toBeNull()
  })

  it('offers nothing beside a category, which has no parent to share', () => {
    expect(beside('10000', 'below')).toBeNull()
  })

  it('offers nothing between two accounts numbered one apart', () => {
    const chart = [
      acc({ id: 'p', accountNumber: '5000', numberRangeStart: 5000, numberRangeEnd: 5999 }),
      acc({ id: 'a', accountNumber: '5010', glAccountType: 'Posting', parentId: 'p' }),
      acc({ id: 'b', accountNumber: '5011', glAccountType: 'Posting', parentId: 'p' }),
    ]
    expect(numberBeside({ account: chart[2], side: 'above', chart, protection: true })).toBeNull()
    expect(numberBeside({ account: chart[1], side: 'above', chart, protection: true })).toBe(5005)
  })
})

/* Decisions 26 and 40: numbers of other lengths are allowed, with a soft
   warning. Module review, 2026-10-06 (COA-07): 1104, 110 and 110400 under 11000
   were refused, the message naming accounts they had nothing to do with. */
describe('numbers of another length', () => {
  it('reads the chart\'s length from most of its numbers', () => {
    expect(chartNumberWidth(chart)).toBe(5)
    expect(chartNumberWidth([])).toBeNull()
  })

  it('lets a number of another length through every block, with protection on', () => {
    for (const n of ['1104', '110', '110400']) expect(posting(n, 'cur')).toBeNull()
  })

  it('warns, softly, and only about the length', () => {
    expect(numberLengthWarning('110400', chart)).toBe('This number has 6 digits, and your other account numbers have 5. You can still save it.')
    expect(numberLengthWarning('11130', chart)).toBeNull()
    expect(numberLengthWarning('AR-1', chart)).toBeNull()
  })

  it('still keeps a number of the chart\'s length out of a block that is not its own', () => {
    expect(posting('11150', 'rec')?.holder?.accountNumber).toBe('11100')
  })
})
