import { describe, it, expect } from 'vitest'
import { placementPreview, DRAFT_ID } from './placementPreview'
import { buildChartIndex } from './chartTree'
import type { Account } from '../types'

/* The last step of Create says where the account lands. It showed the enclosing
   summary and three rows, and stopped: the siblings past the window were dropped
   with nothing standing in for them, so a branch of twenty read as a branch of
   three, and nothing was said about what a new summary would hold.

   Three parts, each with a count for what it leaves out: above, below, inside. */

const acct = (id: string, accountNumber: string, extra: Partial<Account> = {}): Account => ({
  id,
  accountNumber,
  accountName: `Account ${accountNumber}`,
  glAccountType: 'Posting',
  status: 'Active',
  parentId: null,
  ...extra,
} as unknown as Account)

const ROOT = acct('r1', '1000', { glAccountType: 'Summary' })
const MID = acct('m1', '1005', { glAccountType: 'Summary', parentId: 'r1' })
// Twenty siblings under MID, 1010 to 1200, so any window has something to leave
// out at each end. 1105 is the gap in the middle, between k9 and k10.
const KIDS = Array.from({ length: 20 }, (_, i) => acct(`k${i}`, String(1010 + i * 10), { parentId: 'm1' }))
const index = buildChartIndex([ROOT, MID, ...KIDS])

const draft = (accountNumber: string, extra: Partial<Account> = {}) =>
  acct(DRAFT_ID, accountNumber, extra)

const notes = (rows: { note?: string }[]) => rows.map(r => r.note).filter(Boolean)
const named = (rows: { account?: Account }[]) => rows.filter(r => r.account).map(r => r.account!.id)

describe('the branch above', () => {
  it('names every summary enclosing the account, not just the outermost', () => {
    const p = placementPreview({ index, draft: draft('1105'), parent: MID })
    expect(p.chain.map(a => a.id)).toEqual(['r1', 'm1'])
    expect(named(p.rows).slice(0, 2)).toEqual(['r1', 'm1'])
  })

  it('has no chain at all for an account going in at the top', () => {
    expect(placementPreview({ index, draft: draft('9000'), parent: null }).chain).toEqual([])
  })
})

describe('the siblings either side', () => {
  const mid = () => placementPreview({ index, draft: draft('1105'), parent: MID })

  it('shows two either side of the account', () => {
    expect(named(mid().rows)).toEqual(['r1', 'm1', 'k8', 'k9', DRAFT_ID, 'k10', 'k11'])
  })

  /* The count is the whole of the fix: a window with nothing marking its edges
     reads as the entire branch. */
  it('counts what it left out at each end', () => {
    const p = mid()
    expect(p.above).toBe(8)
    expect(p.below).toBe(8)
    expect(notes(p.rows)).toEqual(['8 more above', '8 more below'])
  })

  it('adds up to every sibling, plus the account itself', () => {
    const p = mid()
    expect(p.above + p.below + named(p.rows).length - p.chain.length).toBe(KIDS.length + 1)
  })

  // An unnumbered draft lands at the head of the run, where the whole branch is
  // below it - which is the case that showed three rows and looked complete.
  it('says what is below when nothing has been numbered yet', () => {
    const p = placementPreview({ index, draft: draft(''), parent: MID })
    expect(p.above).toBe(0)
    expect(p.below).toBe(18)
    expect(notes(p.rows)).toEqual(['18 more below'])
  })

  it('says what is above when the account sorts last', () => {
    const p = placementPreview({ index, draft: draft('9999'), parent: MID })
    expect(p.below).toBe(0)
    expect(p.above).toBe(18)
    expect(notes(p.rows)).toEqual(['18 more above'])
  })

  it('leaves both counts off a branch that fits', () => {
    const small = buildChartIndex([ROOT, MID, KIDS[0], KIDS[1]])
    const p = placementPreview({ index: small, draft: draft('1015'), parent: MID })
    expect([p.above, p.below]).toEqual([0, 0])
    expect(notes(p.rows)).toEqual([])
  })

  it('drops the account being edited from its own sibling run', () => {
    const p = placementPreview({ index, draft: draft('1105'), parent: MID, exclude: ['k9'] })
    expect(named(p.rows)).not.toContain('k9')
    expect(p.above + p.below).toBe(KIDS.length - 1 - 4)
  })
})

/* What the account holds. A summary is defined by its contents, so a preview
   showing only its neighbours answers the wrong half of the question. */
describe('the contents', () => {
  const heldAll = Array.from({ length: 5 }, (_, i) => acct(`h${i}`, `12${10 + i}`))

  it('draws them one level inside the account', () => {
    const p = placementPreview({ index, draft: draft('1105'), parent: MID, held: heldAll.slice(0, 2) })
    const at = p.rows.findIndex(r => r.account?.id === DRAFT_ID)
    expect(p.rows.slice(at + 1, at + 3).map(r => [r.account!.id, r.depth]))
      .toEqual([['h0', 3], ['h1', 3]])
  })

  it('counts the ones it left inside', () => {
    const p = placementPreview({ index, draft: draft('1105'), parent: MID, held: heldAll })
    expect(p.heldRest).toBe(2)
    expect(notes(p.rows)).toContain('2 more inside')
  })

  it('says nothing about contents for an account that holds nothing', () => {
    const p = placementPreview({ index, draft: draft('1105'), parent: MID })
    expect(p.heldRest).toBe(0)
    expect(notes(p.rows).some(n => n!.includes('inside'))).toBe(false)
  })
})

/* Every guide line has to point at a row that is on screen, including the rows
   standing in for the ones that are not. */
describe('the guide lines', () => {
  it('gives every row one trunk per level it sits under', () => {
    const p = placementPreview({ index, draft: draft('1105'), parent: MID, held: [acct('h0', '1210')] })
    for (const r of p.rows) expect(r.trunks, r.key).toHaveLength(r.depth)
  })

  it('carries the trunk past a collapsed run rather than closing on it', () => {
    const p = placementPreview({ index, draft: draft('1105'), parent: MID })
    const above = p.rows.find(r => r.note?.includes('above'))!
    expect(above.trunks).toEqual([false, true])
  })

  // The last row under the parent closes its trunk, and with siblings left over
  // that row is the "N more below" stand-in, not the last account shown.
  it('closes the parent on the last row it draws', () => {
    const p = placementPreview({ index, draft: draft('1105'), parent: MID })
    const last = p.rows[p.rows.length - 1]
    expect(last.note).toBe('8 more below')
    expect(last.trunks).toEqual([false, false])
  })
})
