import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detailTabs, OPENS_IN_FULL_VIEW, RECORD_TABS, REGISTER_OPENS_ON } from './AccountDetail'

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8')

/* Which tabs an account offers is a statement about what kind of thing it is. A
   posting account holds transactions and gets named as a posting target; a
   summary holds neither and is only ever the total of what sits under it.

   Where used was built and then left out of the tab list, which is the same as
   not having been built: nothing on the page led to it. */

const ids = (t: 'rollup' | 'transaction') => detailTabs(t, 0).map(x => x.id)

describe('the tabs a posting account offers', () => {
  it('leads to where used', () => {
    expect(ids('transaction')).toContain('source')
  })

  it('puts it after the transactions that produced the links, and before the record tabs', () => {
    expect(ids('transaction')).toEqual(['overview', 'register', 'source', 'notes', 'attachments', 'comms', 'activity'])
  })

  it('names it for the question it answers', () => {
    expect(detailTabs('transaction', 0).find(t => t.id === 'source')!.label).toBe('Where used')
  })
})

describe('the tabs a summary account offers', () => {
  // Nothing is configured to post to a summary, so the tab would open on an
  // answer that is empty by definition rather than because nothing uses it.
  it('does not offer where used', () => {
    expect(ids('rollup')).not.toContain('source')
  })

  it('offers the figure and the accounts behind it, then the record tabs', () => {
    expect(ids('rollup')).toEqual(['overview', 'accounts', 'notes', 'attachments', 'comms', 'activity'])
  })
})

describe('the communication tab', () => {
  it('carries its count on both, so a thread is visible without opening it', () => {
    for (const t of ['rollup', 'transaction'] as const) {
      expect(detailTabs(t, 4).find(x => x.id === 'comms')).toMatchObject({ count: 4 })
    }
  })
})

/* The panel behind the Where used tab is a placeholder now. The first pass
   built a demo graph out of the partners store, invented invoice numbers per
   account, and read "receivables" out of the account's name to guess which
   configuration roles applied - none of it wired to a real Where used answer.
   None of that has to live in the file just because a tab still names it. */
describe('the where used panel', () => {
  const detail = read('pages', 'AccountDetail.tsx')

  /* The shared Coming Soon state, not a second design of its own - Mahad,
     2026-09-29, pointing at the Notes placeholder: *"for the coming soon, we
     will be using this one... I think Notes tab UI is the way to go"*. Asserted
     on the component rather than the words, which a nearby comment can satisfy. */
  it('is the shared PlaceholderTab, and nothing else', () => {
    expect(detail).toMatch(/function WhereUsedTab\(\) \{/)
    const body = detail.slice(detail.indexOf('function WhereUsedTab() {')).slice(0, 400)
    expect(body).toContain('<PlaceholderTab')
    expect(body).not.toContain('<EmptyState')
  })

  it('holds none of the retired demo machinery', () => {
    // The names read like a table of contents for what was there: config link
    // shapes, doc groups, the anchor date, the role heuristic. All gone.
    for (const dead of ['buildWhereUsed', 'ConfigLink', 'DocGroup', 'DOC_TYPE_DEFS', 'CONFIG_ROLE_BY_ACCOUNT_ROLE', 'WHERE_USED_ANCHOR', 'sourceBucket', 'DocStatusPill', 'ITEM_POOL']) {
      expect(detail, dead).not.toContain(dead)
    }
  })

  it('takes no props, because there is nothing to hand it', () => {
    // A component that needed the account or its transactions to draw an empty
    // state was doing something it should not have been.
    expect(detail).toContain('<WhereUsedTab />')
    expect(detail).not.toMatch(/<WhereUsedTab account=/)
  })
})

/* Design review, 2026-09-24 - Eli: *"Every detailed view of every object should
   have notes, activity, attachments and communications ... they're always there
   and they're always at the end."* */
describe('the four tabs every record carries', () => {
  it('closes both templates, in the same order', () => {
    for (const t of ['rollup', 'transaction'] as const) {
      expect(ids(t).slice(-4)).toEqual([...RECORD_TABS])
      expect(ids(t).slice(-4)).toEqual(['notes', 'attachments', 'comms', 'activity'])
    }
  })

  it('calls the timeline Activity on both, not Recent activity on one', () => {
    for (const t of ['rollup', 'transaction'] as const) {
      const labels = detailTabs(t, 0).map(x => x.label)
      expect(labels).toContain('Activity')
      expect(labels).not.toContain('Recent activity')
    }
  })

  it('counts the files, as it counts the messages', () => {
    expect(detailTabs('transaction', 0, 3).find(x => x.id === 'attachments')).toMatchObject({ count: 3 })
  })
})

describe('how each tab opens', () => {
  // *"If you're looking at a table with a lot of columns ... the default view
  // should be expanded."* The Transactions table opened collapsed until
  // 2026-09-30, when Mahad asked for it to open like Accounts.
  it("opens the summary's Accounts table and the posting's Transactions in full view, and nothing else", () => {
    expect(OPENS_IN_FULL_VIEW).toEqual({ accounts: true, register: true })
  })

  // *"All time is almost certainly not it. My gut is telling me last 30 days."*
  it('opens Transactions on the last 30 days, not all time', () => {
    expect(REGISTER_OPENS_ON).toEqual({ kind: 'preset', preset: '30d' })
  })
})
