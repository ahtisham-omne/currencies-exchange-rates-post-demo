import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { seedAccounts } from './seed'
import {
  actionToward,
  archiveBucketOf,
  balanceDestinations,
  canDeleteAccount,
  describeAccount,
  describeSummarySpan,
  balanceMoveImpact,
  planBulk,
  planDelete,
  planLifecycle,
  showsSummaryTotal,
  STATUS_MEANING,
  statusesFor,
  statusMeaningLines,
  STATUS_ORDER,
} from './accountLifecycle'
import type { LifecycleCtx } from './accountLifecycle'
import { buildChartIndex } from './chartTree'
import type { Account, AccountStatus, GLAccountType } from '../types'

const acct = (
  id: string,
  accountNumber: string,
  glAccountType: GLAccountType,
  extra: Partial<Account> = {},
): Account => ({
  id,
  accountNumber,
  accountName: `Account ${accountNumber}`,
  glAccountType,
  isPosting: glAccountType === 'Posting',
  status: 'Active',
  parentId: null,
  currencyCode: 'USD',
  ...extra,
} as unknown as Account)

const ctxOf = (accounts: Account[], openIds: string[] = []): LifecycleCtx => ({
  accounts,
  hasOpenJEs: id => openIds.includes(id),
})

// 4000 Revenue, with 4010 Operating Revenue under it and two postings under that,
// plus an empty summary at 4900. Three levels, so a gate has something to catch on
// at a distance and not just one step down.
const ROOT = acct('r1', '4000', 'Summary')
const MID = acct('m1', '4010', 'Summary', { parentId: 'r1' })
const POST_A = acct('p1', '4015', 'Posting', { parentId: 'm1' })
const POST_B = acct('p2', '4020', 'Posting', { parentId: 'm1' })
const EMPTY = acct('s9', '4900', 'Summary', { parentId: 'r1' })
const CHART = [ROOT, MID, POST_A, POST_B, EMPTY]

const restatus = (a: Account, status: AccountStatus) => ({ ...a, status })

describe('accountLifecycle - posting gate', () => {
  it('blocks deactivate and archive on a posting account with unposted work', () => {
    // "Unposted work" is the umbrella: a draft entry, an approval waiting, an
    // open PO. What the gate actually reads is open journal entries - the copy
    // names the shape of the problem, not the field it happens to read.
    const ctx = ctxOf(CHART, ['p1'])
    for (const action of ['deactivate', 'archive'] as const) {
      const plan = planLifecycle(action, POST_A, ctx)
      expect(plan.allowed).toBe(false)
      expect(plan.blockedReason).toMatch(/draft entry|approval waiting|purchase order/i)
    }
  })

  it('never blocks bringing an account back, even with unposted work', () => {
    const ctx = ctxOf(CHART, ['p1'])
    expect(planLifecycle('activate', POST_A, ctx).allowed).toBe(true)
    expect(planLifecycle('unarchive', POST_A, ctx).allowed).toBe(true)
  })

  it('allows and confirms a posting account with no unposted work', () => {
    const plan = planLifecycle('deactivate', POST_A, ctxOf(CHART))
    expect(plan.allowed).toBe(true)
    expect(plan.needsConfirm).toBe(true)
    expect(plan.confirm?.confirmLabel).toBe('Deactivate account')
  })

  /* Mahad, 2026-09-24: *"in the deactive alert, You can not deactivate a posting
     account with active transactions so please update this as well."* The gate
     above is what enforces it; the dialog is where a reader who has not hit it
     yet learns the action has one. So it is said to an account that passed. */
  /* Module review, 2026-10-06 (COA-21): the dialog said every account had work
     on its way in. An account reaching it has passed that gate, so the dialog
     says only what is true of it; the rule is said on the refusal. */
  it('says only what is true of the account in the dialog of one that passed the gate', () => {
    const said = planLifecycle('deactivate', POST_A, ctxOf(CHART)).confirm!.description.join(' ')
    expect(said).toContain('will stop accepting new postings. It stays in your chart of accounts with its balance and history, and you can activate it again anytime.')
    expect(said).not.toMatch(/on its way in/)
  })

  // Mahad's copy for a summary, 2026-10-09, under the same "Deactivate account?".
  it('tells a summary it will take no new accounts under it', () => {
    const plan = planLifecycle('deactivate', EMPTY, ctxOf(CHART))
    expect(plan.confirm?.title).toBe('Deactivate account?')
    expect(plan.confirm!.description.join(' ')).toBe('4900 Account 4900 will no longer accept new accounts under it. It stays in your chart of accounts and on your reports, and you can activate it again anytime.')
  })

  // And it stays that action's rule. Archiving takes the account off the chart
  // and is held back by its own things, so it borrows none of this sentence.
  it('says it of deactivating only', () => {
    for (const action of ['archive', 'activate'] as const) {
      const said = planLifecycle(action, POST_A, ctxOf(CHART)).confirm?.description.join(' ') ?? ''
      expect(said, action).not.toMatch(/on its way in/)
    }
  })

  it('reads entries on the clicked account only, not on its neighbours', () => {
    const ctx = ctxOf(CHART, ['p2'])
    expect(planLifecycle('deactivate', POST_A, ctx).allowed).toBe(true)
    // The summary above them holds no entries of its own, so this gate never
    // applies to it: what holds a summary up is the accounts under it.
    expect(planLifecycle('deactivate', MID, ctxOf(CHART, ['m1'])).blockedReason)
      .not.toMatch(/draft entry/i)
  })
})

/* Mahad, 2026-09-22: *"I don't think summary accounts should allow direct
   transaction postings - that doesn't make sense. I think summary account should
   be archieved only but only when there is no child account under it."*

   So a summary has one way off the chart and one gate on it. Deactivate is
   refused outright - it closes an account to postings, and nothing posts to a
   summary, so offering it implied the summary had been open to them until you
   turned it off. Archive is offered, and held while anything is still filed
   underneath. */
describe('accountLifecycle - a summary is gated by what is under it', () => {
  /* Decision 53: a summary can be deactivated once every account under it is
     inactive. MID, not ROOT: ROOT is a category root and refuses both closings
     under a different rule. */
  it('refuses deactivate on a summary while an account under it is active, and allows it after', () => {
    const plan = planLifecycle('deactivate', MID, ctxOf(CHART))
    expect(plan.allowed).toBe(false)
    expect(plan.blockedReason).toBe('Some accounts under this account are still active. Deactivate them first.')
    const quiet = [ROOT, MID, restatus(POST_A, 'Inactive'), restatus(POST_B, 'Archived'), EMPTY]
    expect(planLifecycle('deactivate', MID, ctxOf(quiet)).allowed).toBe(true)
    expect(planLifecycle('deactivate', EMPTY, ctxOf(CHART)).allowed).toBe(true)
  })

  it('blocks archive while any account under it is still on the chart', () => {
    const plan = planLifecycle('archive', MID, ctxOf(CHART))
    expect(plan.allowed).toBe(false)
    expect(plan.blockedReason).toBe('Some accounts under this account are still on the chart. Archive them first.')
  })

  // Archiving needs them off the chart, not merely closed: an inactive account
  // is still filed under the summary and still expects a total above it.
  it('allows archive once nothing under it is left on the chart', () => {
    const chart = [ROOT, MID, restatus(POST_A, 'Archived'), restatus(POST_B, 'Archived'), EMPTY]
    const plan = planLifecycle('archive', MID, ctxOf(chart))
    expect(plan.allowed).toBe(true)
    expect(plan.targetIds).toEqual(['m1'])
    expect(plan.menuLabel).toBe('Archive account')
  })

  // The gate reads the whole branch, not one step: with nothing cascading, an
  // archived child can still have a live account of its own underneath it.
  it('blocks archive on a summary with a live account further down than the children', () => {
    const other = acct('o1', '4990', 'Summary', { parentId: null })
    const inner = acct('o2', '4991', 'Summary', { parentId: 'o1' })
    const leaf = acct('o3', '4992', 'Posting', { parentId: 'o2' })
    // A middle summary held by a live grand-leaf, so the rule reads through the
    // tree rather than one step.
    expect(planLifecycle('archive', inner, ctxOf([other, restatus(inner, 'Active'), leaf])).allowed).toBe(false)
  })

  it('holds nothing against archiving a summary with nothing under it', () => {
    expect(planLifecycle('archive', EMPTY, ctxOf(CHART)).allowed).toBe(true)
    expect(planLifecycle('archive', EMPTY, ctxOf(CHART)).confirm?.description.join(' '))
      .toBe('4900 Account 4900 will be archived and will no longer appear in your chart of accounts or reports. Its history is kept, and you can unarchive it anytime.')
  })
})

/* Never-archivable, and never-deactivatable in the two cases that carry
   through. A category root is the top of the chart and the statement is filed
   under it; a summary totals what sits under it and comes off with them;
   retained earnings is where the year-end close posts. These read ahead of
   every other gate: nothing the reader could do to the accounts around them
   would clear the rule, and sending them chasing children would be the wrong
   place to send them. */
describe('accountLifecycle - never-archivable set', () => {
  it('refuses both closings on a category root, whatever is under it', () => {
    // ROOT has parentId null and glAccountType Summary - the definition of
    // a category root. The rule fires whether the branch is populated,
    // half-inactive, or empty.
    for (const chart of [CHART, [ROOT], CHART.map(a => a.id === 'r1' ? a : restatus(a, 'Archived'))]) {
      for (const action of ['deactivate', 'archive'] as const) {
        const p = planLifecycle(action, ROOT, ctxOf(chart))
        expect(p.allowed, action).toBe(false)
        expect(p.blockedReason, action).toContain('top of the chart')
      }
    }
  })

  /* And the row menu does not offer what the rule will always refuse. The five
     category rows used to carry Deactivate and Archive like any other row, and
     both led to the same refusal every time - the menu arguing with the reader
     about something it could have declined to raise. */
  it('offers a category row no closing action to be refused for', () => {
    const menu = readFileSync(join(__dirname, '..', 'components', 'AccountTable.tsx'), 'utf8')
    const lifecycleItems = menu.match(/function LifecycleMenuItems[\s\S]{0,1400}/)![0]
    expect(lifecycleItems).toMatch(/if \(isCategoryRoot\(a\)\) return null/)
    // Ahead of every item, or one of them still renders on a category row.
    const gate = lifecycleItems.indexOf('isCategoryRoot(a)')
    for (const item of ['deactivate', 'archive', 'activate']) {
      expect(lifecycleItems.indexOf(`onAction('${item}'`), item).toBeGreaterThan(gate)
    }
    // Edit and Create GL account are not lifecycle items and are untouched.
    expect(lifecycleItems).not.toContain('Edit account')
    expect(menu).toContain('AddChildMenuItem')
  })

  it('lets a summary be deactivated once its branch is cleared (decision 53)', () => {
    const cleared = CHART.map(a => (a.id === 'm1' || a.parentId !== 'm1') ? a : restatus(a, 'Archived'))
    expect(planLifecycle('deactivate', MID, ctxOf(cleared)).allowed).toBe(true)
    expect(planLifecycle('deactivate', EMPTY, ctxOf(CHART)).allowed).toBe(true)
    expect(planLifecycle('archive', EMPTY, ctxOf(CHART)).allowed).toBe(true)
  })

  it('refuses archiving the only active account of a required role', () => {
    // The role names something else in the module points at: an invoice needs
    // an Accounts Receivable to post to, a bill needs an Accounts Payable, a
    // migration needs an Opening Balance Equity. Removing the last one leaves
    // those pointing at an account no longer on the chart.
    const ar1 = acct('ar1', '1075', 'Posting', { accountType: 'AST', accountRole: 'Accounts Receivable' })
    const ar2 = acct('ar2', '1076', 'Posting', { accountType: 'AST', accountRole: 'Accounts Receivable' })
    // With two active, either one archives fine (no balance to worry about).
    expect(planLifecycle('archive', ar1, ctxOf([ar1, ar2])).blockedReason).toBeUndefined()
    // With one active and one already inactive, that last active one is held.
    expect(planLifecycle('archive', ar1, ctxOf([ar1, restatus(ar2, 'Inactive')])).blockedReason)
      .toContain('only active Accounts Receivable')
    // Deactivate is refused for the same reason: an inactive account cannot
    // take a posting either.
    expect(planLifecycle('deactivate', ar1, ctxOf([ar1, restatus(ar2, 'Inactive')])).blockedReason)
      .toContain('only active Accounts Receivable')
  })
})

describe('accountLifecycle - bringing an account back', () => {
  const closed = [restatus(ROOT, 'Inactive'), restatus(MID, 'Inactive'), restatus(POST_A, 'Inactive'), POST_B, EMPTY]

  // Never refused and never questioned, whatever is around it. It also reaches no
  // further than the row itself: an account is turned back on because someone asked
  // for that account.
  it('is always allowed and writes only itself', () => {
    for (const chart of [CHART, closed]) {
      for (const action of ['activate', 'unarchive'] as const) {
        for (const a of chart) {
          const plan = planLifecycle(action, a, ctxOf(chart, ['p1', 'p2']))
          expect(plan.allowed, `${action} ${a.accountNumber}`).toBe(true)
          expect(plan.targetIds).toEqual([a.id])
        }
      }
    }
  })

  // Turning an account back on asks nothing; bringing one back from the archive
  // puts it back on the chart, so it is confirmed, as archiving it was.
  it('asks nothing to activate, and confirms an unarchive', () => {
    for (const a of CHART) {
      const ctx = ctxOf(CHART, ['p1', 'p2'])
      const on = planLifecycle('activate', a, ctx)
      expect(on.needsConfirm).toBe(false)
      expect(on.confirm).toBeUndefined()
      const back = planLifecycle('unarchive', a, ctx)
      expect(back.needsConfirm, a.accountNumber).toBe(true)
      expect(back.confirm?.title).toBe('Unarchive account?')
      expect(back.confirm?.confirmLabel).toBe('Unarchive account')
      // Mahad's copy, 2026-10-09.
      expect(back.confirm?.description[0]).toBe(a.glAccountType === 'Posting'
        ? `${a.accountNumber} ${a.accountName} will be restored to your chart of accounts and reports, and can be used in transactions again.`
        : `${a.accountNumber} ${a.accountName} will be restored to your chart of accounts and reports. Accounts under it remain archived.`)
    }
  })

  it('leaves the accounts above it alone, so the reader can reopen a branch in any order', () => {
    expect(planLifecycle('activate', closed[2], ctxOf(closed)).targetIds).toEqual(['p1'])
  })
})

describe('accountLifecycle - the span a summary covers', () => {
  it('reads the span its accounts occupy', () => {
    expect(describeSummarySpan(MID, buildChartIndex(CHART))).toBe('4015 to 4020')
  })

  it('says nothing for an empty summary or a posting account', () => {
    const index = buildChartIndex(CHART)
    expect(describeSummarySpan(EMPTY, index)).toBeUndefined()
    expect(describeSummarySpan(POST_A, index)).toBeUndefined()
  })

  it('describes every summary in the seeded chart that holds something', () => {
    const index = buildChartIndex(seedAccounts)
    const summaries = seedAccounts.filter(a => a.glAccountType === 'Summary' && index.descendantsOf(a.id).length > 0)
    expect(summaries.length).toBeGreaterThan(0)
    for (const s of summaries) expect(describeSummarySpan(s, index)).toMatch(/^[\d-]+ to [\d-]+$/)
  })
})

describe('accountLifecycle - bulk', () => {
  // Ticking a summary and the accounts under it is the reader dealing with them
  // first, in one action rather than two rounds of clicking, so the summary is not
  // refused for the very rows in the same batch.
  // Archive, not deactivate: a summary is refused deactivate outright now, so
  // the only batch that can carry one is an archiving batch.
  it('lets a selection clear its own summary', () => {
    const plan = planBulk('archive', ['p1', 'p2', 'm1'], ctxOf(CHART))
    expect(plan.skipped).toEqual([])
    expect(new Set(plan.targetIds)).toEqual(new Set(['p1', 'p2', 'm1']))
  })

  it('still refuses the summary when one of its accounts cannot go', () => {
    const plan = planBulk('archive', ['p1', 'p2', 'm1'], ctxOf(CHART, ['p1']))
    // p1 has open entries, so the batch cannot clear it and m1 stays held by it.
    expect(plan.skipped.map(s => s.id)).toEqual(['p1', 'm1'])
    expect(plan.targetIds).toEqual(['p2'])
    expect(plan.toast).toContain('2 skipped')
  })

  it('refuses a summary whose accounts were left out of the selection', () => {
    const plan = planBulk('archive', ['m1'], ctxOf(CHART))
    expect(plan.skipped.map(s => s.id)).toEqual(['m1'])
    expect(plan.targetIds).toEqual([])
  })

  // And a batch cannot smuggle a summary past the rule that refuses it outright.
  it('deactivates a summary in the same batch as the accounts under it', () => {
    const plan = planBulk('deactivate', ['p1', 'p2', 'm1'], ctxOf(CHART))
    expect(plan.skipped).toEqual([])
    expect(new Set(plan.targetIds)).toEqual(new Set(['p1', 'p2', 'm1']))
  })

  it('reports nothing done when every account is blocked', () => {
    const plan = planBulk('archive', ['p1'], ctxOf(CHART, ['p1']))
    expect(plan.targetIds).toEqual([])
    expect(plan.needsConfirm).toBe(false)
    expect(plan.confirm).toBeUndefined()
  })

  it('names each account once', () => {
    const plan = planBulk('archive', ['m1', 'p1', 'p2'], ctxOf(CHART))
    expect(plan.targetIds).toHaveLength(3)
    expect(plan.affected).toHaveLength(3)
  })
})

/* A batch that half worked owes the reader both halves. The dialog used to name
   what would move and count what would not - "14 skipped" tells them neither
   which fourteen nor what to do about any of them, and the count is the whole of
   what they get, because the accounts stay ticked and unchanged with nothing on
   the row to say why. */
describe('accountLifecycle - what a part-refused batch says', () => {
  const partial = () => planBulk('deactivate', ['p1', 'p2', 'm1'], ctxOf(CHART, ['p1'])).confirm!

  it('names every skipped account with its own reason, beside the ones that move', () => {
    const confirm = partial()
    expect(confirm.affected).toEqual([describeAccount(POST_B)])
    expect(confirm.stayedTitle).toBe('Why each one stayed')
    expect(confirm.stayed?.[0]).toContain(`${describeAccount(POST_A)}: `)
    expect(confirm.stayed?.[0]).toMatch(/draft entry|approval waiting|purchase order/)
    expect(confirm.stayed?.[1]).toContain(`${describeAccount(MID)}: `)
  })

  it('says how many stay without making the count the answer', () => {
    expect(partial().description.some(l => typeof l === 'string' && /2 accounts stay where they are/.test(l))).toBe(true)
  })

  it('hands over the skipped accounts the cap leaves out', () => {
    const held = Array.from({ length: 12 }, (_, i) => acct(`h${i}`, `48${10 + i}`, 'Posting', { parentId: 'r1' }))
    const free = acct('f1', '4890', 'Posting', { parentId: 'r1' })
    const ctx = ctxOf([ROOT, ...held, free], held.map(a => a.id))
    const confirm = planBulk('deactivate', [...held.map(a => a.id), free.id], ctx).confirm!
    expect(confirm.stayed).toHaveLength(8)
    expect(confirm.stayedRest).toHaveLength(4)
  })

  it('leaves the second box off a batch that skipped nothing', () => {
    const confirm = planBulk('archive', ['p1', 'p2', 'm1'], ctxOf(CHART)).confirm!
    expect(confirm.stayed).toBeUndefined()
    expect(confirm.stayedTitle).toBeUndefined()
  })
})

// A refused action is still offered, so every refusal has to be able to say why
// on its own. The reader clicked Deactivate and something has to answer.
describe('accountLifecycle - what a refusal says', () => {
  it('carries a spec exactly when the action is refused', () => {
    const ctx = ctxOf(CHART, ['p1'])
    for (const action of ['deactivate', 'activate', 'archive', 'unarchive'] as const) {
      for (const a of CHART) {
        const plan = planLifecycle(action, a, ctx)
        expect(!!plan.refusal, `${action} ${a.accountNumber}`).toBe(!plan.allowed)
      }
    }
  })

  it('names the accounts still standing in the way, however far down they are', () => {
    const refusal = planLifecycle('deactivate', ROOT, ctxOf(CHART)).refusal!
    expect(refusal.title).toBe(`Can't deactivate ${describeAccount(ROOT)}`)
    expect(refusal.affectedTitle).toBe('Still active')
    expect(refusal.affected).toEqual([MID, POST_A, POST_B, EMPTY].map(describeAccount))
  })

  it('leaves out an account that is already far enough along', () => {
    const chart = [ROOT, MID, POST_A, restatus(POST_B, 'Archived'), EMPTY]
    expect(planLifecycle('deactivate', MID, ctxOf(chart)).refusal!.affected)
      .toEqual([describeAccount(POST_A)])
  })

  // The cap keeps the dialog short; it must not lose the names, or the reader is
  // told 41 accounts are in the way and shown none of them.
  it('hands over the accounts the cap leaves out instead of counting them', () => {
    const wide = Array.from({ length: 12 }, (_, i) => acct(`w${i}`, `47${10 + i}`, 'Posting', { parentId: 'r1' }))
    const refusal = planLifecycle('deactivate', ROOT, ctxOf([ROOT, ...wide])).refusal!
    expect(refusal.affected).toEqual(wide.slice(0, 8).map(describeAccount))
    expect(refusal.affectedRest).toEqual(wide.slice(8).map(describeAccount))
  })

  it('leaves nothing over when the whole list fits', () => {
    expect(planLifecycle('deactivate', ROOT, ctxOf(CHART)).refusal!.affectedRest).toEqual([])
  })

  // Nothing to name, because what holds a posting account is its own entries.
  it('names no accounts when the hold-up is unposted work', () => {
    const refusal = planLifecycle('deactivate', POST_A, ctxOf(CHART, ['p1'])).refusal!
    expect(refusal.description[0]).toMatch(/draft entry|approval waiting|purchase order/)
    expect(refusal.affected).toBeUndefined()
    expect(refusal.affectedTitle).toBeUndefined()
  })

  it('gives each skipped account its own reason when a whole batch is refused', () => {
    const plan = planBulk('deactivate', ['p1'], ctxOf(CHART, ['p1']))
    expect(plan.needsConfirm).toBe(false)
    expect(plan.refusal!.affected?.[0]).toContain(`${describeAccount(POST_A)}: `)
    expect(plan.refusal!.affected?.[0]).toMatch(/draft entry|approval waiting|purchase order/)
  })

  // An empty selection is not a refusal: there is nothing to explain.
  it('has nothing to say when the selection was empty', () => {
    expect(planBulk('deactivate', [], ctxOf(CHART)).refusal).toBeUndefined()
  })
})

describe('accountLifecycle - total suppression', () => {
  // An inactive summary stays on reports, as an inactive account does (#31).
  it('hides the figure for an archived summary only', () => {
    expect(showsSummaryTotal(acct('x', '9', 'Summary', { status: 'Active' }))).toBe(true)
    expect(showsSummaryTotal(acct('x', '9', 'Summary', { status: 'Inactive' }))).toBe(true)
    expect(showsSummaryTotal(acct('x', '9', 'Summary', { status: 'Archived' }))).toBe(false)
    for (const status of ['Active', 'Inactive', 'Archived'] as const) {
      expect(showsSummaryTotal(acct('x', '9', 'Posting', { status }))).toBe(true)
    }
  })
})

/* The line between the two closing actions is what happens to the money. An
   inactive account keeps its balance and goes on being reported; an archived one
   is off the chart, where a balance would be money reported from nowhere. So
   archiving asks where it goes instead of refusing. */
describe('accountLifecycle - archiving an account that holds money', () => {
  const cash = acct('c1', '1020', 'Posting', { accountType: 'AST', balance: 1000, currencyCode: 'USD' })
  const other = acct('c2', '1025', 'Posting', { accountType: 'AST', balance: 8400, currencyCode: 'USD' })
  const expense = acct('e1', '5010', 'Posting', { accountType: 'EXP', balance: 200, currencyCode: 'USD' })
  const shut = acct('c3', '1030', 'Posting', { accountType: 'AST', balance: 0, status: 'Inactive' })
  const CASH_CHART = [cash, other, expense, shut]

  it('asks where the balance goes, naming the amount', () => {
    const plan = planLifecycle('archive', cash, ctxOf(CASH_CHART))
    expect(plan.allowed).toBe(true)
    expect(plan.balanceMove?.amount).toBe(1000)
    expect(plan.confirm?.description.join(' ')).toContain('$ 1,000')
    expect(plan.confirm?.confirmLabel).toBe('Move and archive')
  })

  it('offers only open accounts of the same kind as the destination', () => {
    const to = planLifecycle('archive', cash, ctxOf(CASH_CHART)).balanceMove!.destinations
    // Not the expense account (wrong category), not the inactive one, not itself.
    expect(to.map(a => a.id)).toEqual(['c2'])
  })

  it('refuses when the balance has nowhere of its own kind to go', () => {
    const plan = planLifecycle('archive', cash, ctxOf([cash, expense, shut]))
    expect(plan.allowed).toBe(false)
    expect(plan.blockedReason).toMatch(/nowhere to go/i)
  })

  it('leaves a cleared account to archive plainly', () => {
    const empty = acct('c9', '1099', 'Posting', { accountType: 'AST', balance: 0 })
    const plan = planLifecycle('archive', empty, ctxOf([...CASH_CHART, empty]))
    expect(plan.balanceMove).toBeUndefined()
    expect(plan.confirm?.confirmLabel).toBe('Archive account')
    // Mahad's copy, 2026-10-09: the plain archive line, with no transfer to ask for.
    expect(plan.confirm?.title).toBe('Archive account?')
    expect(plan.confirm?.description.join(' ')).toBe('1099 Account 1099 will be archived and will no longer appear in your chart of accounts or reports. Its history is kept, and you can unarchive it anytime.')
  })

  // The whole point of the distinction: turning an account off never moves money.
  it('never asks a deactivation to move anything, however much it holds', () => {
    const plan = planLifecycle('deactivate', cash, ctxOf(CASH_CHART))
    expect(plan.allowed).toBe(true)
    expect(plan.balanceMove).toBeUndefined()
    expect(plan.confirm?.description.join(' ')).toContain('with its balance and history')
  })

  // A summary shows its children's total rather than holding one, and they are
  // all archived by the time it can be, so there is nothing left to move.
  it('asks nothing of a summary, whose figure is the accounts under it', () => {
    const parent = acct('s1', '1015', 'Summary', { accountType: 'AST', balance: 9400 })
    const child = acct('s2', '1016', 'Posting', { accountType: 'AST', balance: 0, status: 'Archived', parentId: 's1' })
    expect(planLifecycle('archive', parent, ctxOf([parent, child])).balanceMove).toBeUndefined()
  })

  // Bulk has nowhere to ask the question, so it must not answer it by itself.
  it('skips a balance holder in bulk rather than archiving it silently', () => {
    const plan = planBulk('archive', ['c1', 'c2'], ctxOf(CASH_CHART))
    expect(plan.targetIds).not.toContain('c1')
    expect(plan.skipped.find(s => s.id === 'c1')?.reason).toMatch(/holds a balance/i)
  })

  it('says nothing about the move until somewhere is picked', () => {
    const move = planLifecycle('archive', cash, ctxOf(CASH_CHART)).balanceMove!
    expect(balanceMoveImpact(move, cash, undefined, 12)).toBeUndefined()
  })

  /* Both sides of the write, because the reader is agreeing to a change on two
     accounts and only one of them is the one they opened the menu on. */
  it('states where both balances land once a destination is picked', () => {
    const move = planLifecycle('archive', cash, ctxOf(CASH_CHART)).balanceMove!
    const impact = balanceMoveImpact(move, cash, other, 12)!
    expect(impact.amount).toBe(1000)
    expect(impact.rows).toEqual([
      { account: cash, from: 1000, to: 0, leaves: true },
      { account: other, from: 8400, to: 9400, leaves: false },
    ])
  })

  /* The history changes hands too, and that is the part a reader does not expect.
     Archiving re-points the postings rather than copying them, so a count that
     came back wrong would understate what cannot be undone. */
  it('carries the number of postings that change hands', () => {
    const move = planLifecycle('archive', cash, ctxOf(CASH_CHART)).balanceMove!
    expect(balanceMoveImpact(move, cash, other, 12)!.postings).toBe(12)
    expect(balanceMoveImpact(move, cash, other, 0)!.postings).toBe(0)
  })
})

/* Choosing the state rather than the verb. The status control offers all three at
   once, so it needs to know which action gets from here to there, and the two
   closings have to be told apart before either is picked. */
describe('accountLifecycle - choosing a state', () => {
  it('offers the three states in the order they close down', () => {
    expect(STATUS_ORDER).toEqual(['Active', 'Inactive', 'Archived'])
  })

  it('routes each state to the action that reaches it', () => {
    expect(actionToward('Inactive', 'Active')).toBe('deactivate')
    expect(actionToward('Archived', 'Active')).toBe('archive')
    expect(actionToward('Active', 'Inactive')).toBe('activate')
    // Reopening an archived account is its own action, not a plain activation.
    expect(actionToward('Active', 'Archived')).toBe('unarchive')
  })

  it('treats picking the state already showing as no action at all', () => {
    for (const s of STATUS_ORDER) expect(actionToward(s, s)).toBeUndefined()
  })

  // The distinction the whole change turns on has to be legible in the control
  // that offers both, not only in the dialog that follows one of them. Inactive
  // closes the account and leaves it on the chart; archiving takes it off.
  it('tells the two closings apart, one closing the account and one removing it', () => {
    for (const kind of ['Posting', 'Summary'] as const) {
      expect(STATUS_MEANING.Archived[kind], kind).toContain('No longer part of the chart of accounts')
    }
    expect(STATUS_MEANING.Inactive.Posting).not.toContain('part of the chart of accounts')
  })

  /* Inactive says nothing about a summary because a summary is never in it.
     Mahad, 2026-09-22: a summary is *"archieved only"*. The line it used to
     carry - "No longer available as a parent for other accounts" - described a
     state the control no longer offers, so it went with the state rather than
     being softened into one that reads as still reachable. */
  it('offers a summary all three states since decision 53, and says what Inactive means for one', () => {
    expect(statusesFor({ glAccountType: 'Summary' })).toEqual(STATUS_ORDER)
    expect(statusesFor({ glAccountType: 'Posting' })).toEqual(STATUS_ORDER)
    expect(STATUS_MEANING.Inactive.Summary).toBe('Summary account: No longer available as a parent for new accounts.')
  })

  /* A state says what it is, not what would refuse it. The conditions that block
     a change belong to the attempt: `planLifecycle` states each one at the moment
     it applies, and the archive-with-balance rule is pinned against `balanceMove`
     above. Spelling them out on all three options instead put every reader's
     refusal in front of every reader. */
  it('leaves the blocking conditions to the plan, and states only the state', () => {
    for (const line of STATUS_ORDER.flatMap(statusMeaningLines)) {
      expect(line, line).not.toMatch(/can't be|cannot be|first\./i)
      expect(line, line).not.toMatch(/balance|draft|approval|purchase order/i)
      // One sentence per kind, so the option stays two lines at any width.
      expect(line.match(/\./g)?.length, line).toBe(1)
    }
  })

  /* Both kinds are answered in every state. A reader picking a state for a
     summary account and finding only the posting rule would be reading a control
     that does not cover them. */
  it('says what each state means to a posting account and to a summary', () => {
    for (const s of STATUS_ORDER) {
      expect(STATUS_MEANING[s].Posting, s).toContain('Posting account:')
      // Except Inactive, which a summary has no way into - see above.
      if (s === 'Inactive') continue
      expect(STATUS_MEANING[s].Summary, s).toContain('Summary account:')
      expect(statusMeaningLines(s), s).toEqual([STATUS_MEANING[s].Posting, STATUS_MEANING[s].Summary])
    }
  })

  /* Straight quotes only, module-wide. The copy arrives with curly apostrophes
     when it is written somewhere that autocorrects them, and they render as a
     different glyph beside every other contraction in the product. */
  it('keeps its apostrophes straight', () => {
    for (const s of STATUS_ORDER) {
      for (const line of statusMeaningLines(s)) expect(line, line).not.toContain('’')
    }
  })
})

/* Delete is not a third degree of archive, so it does not follow archive's rules.
   Archive asks what to do with what the account holds; delete only exists where it
   holds nothing and never has. These check the four ways "never posted to" can
   fail, and that the gate the menu reads is the same one the plan enforces - the
   item is hidden rather than refused, so a disagreement between the two would show
   up as an action that is simply missing with no way to find out why. */
describe('accountLifecycle - delete', () => {
  it('allows it on an account nothing has ever touched', () => {
    const p = planDelete(POST_A, ctxOf(CHART))
    expect(p.allowed).toBe(true)
    expect(p.targetIds).toEqual(['p1'])
    // Never silent: the one action with nothing behind it always asks.
    expect(p.confirm.tone).toBe('danger')
    expect(p.confirm.description.join(' ')).toContain('cannot be undone')
  })

  it('refuses a posted account, and points at archive instead', () => {
    const posted = { ...POST_A, hasTransactions: true }
    const p = planDelete(posted, ctxOf([...CHART.filter(a => a.id !== 'p1'), posted]))
    expect(p.allowed).toBe(false)
    expect(p.blockedReason).toContain('Archive it instead')
    expect(p.refusal?.title).toBe(`Can't delete ${describeAccount(posted)}`)
  })

  it('refuses an entry still waiting to post, and a balance from any source', () => {
    expect(planDelete(POST_A, ctxOf(CHART, ['p1'])).blockedReason).toContain('Open journal entries')
    const holding = { ...POST_A, balance: 40 }
    expect(planDelete(holding, ctxOf([holding])).blockedReason).toContain('holds a balance')
  })

  it('refuses a summary that would orphan the accounts under it', () => {
    expect(planDelete(MID, ctxOf(CHART)).blockedReason).toContain('no parent')
    // The same summary with nothing under it is only an empty row.
    expect(planDelete(EMPTY, ctxOf(CHART)).allowed).toBe(true)
  })

  /* A summary's figure is its children's, so it has no balance and no transactions
     of its own to be caught by. Once the children are gone it deletes, whatever
     the branch used to total. */
  it('lets a summary go once its children have, ignoring its rolled-up figure', () => {
    const chart = [ROOT, { ...MID, balance: 900_000, hasTransactions: true }]
    expect(planDelete(chart[1], ctxOf(chart)).allowed).toBe(false)
    expect(planDelete({ ...chart[1], hasTransactions: false }, ctxOf([ROOT])).allowed).toBe(true)
  })

  it('hides the menu item on exactly the accounts the plan would refuse', () => {
    const charts = [CHART, [ROOT, MID, { ...POST_A, hasTransactions: true }, { ...POST_B, balance: 5 }, EMPTY]]
    for (const chart of charts) {
      const ctx = ctxOf(chart, ['p2'])
      for (const a of chart) {
        expect(canDeleteAccount(a, ctx), describeAccount(a)).toBe(planDelete(a, ctx).allowed)
      }
    }
  })
})

/* Retained earnings is what the year-end close posts to, so the account has to be
   there and has to be open. It is the one account where the reason an action is
   refused is not a state the reader can clear. */
describe('accountLifecycle - retained earnings is held open', () => {
  const RE = acct('re', '3050', 'Posting', { accountRole: 'Retained Earnings', parentId: 'r1' })
  const chart = [ROOT, RE]
  const ctx = ctxOf(chart)

  it('refuses all three closings, and says which mechanism depends on it', () => {
    for (const action of ['deactivate', 'archive'] as const) {
      const p = planLifecycle(action, RE, ctx)
      expect(p.allowed, action).toBe(false)
      expect(p.blockedReason, action).toContain('year-end close')
    }
    const d = planDelete(RE, ctx)
    expect(d.allowed).toBe(false)
    expect(d.blockedReason).toContain('year-end close')
  })

  // Told, not hidden: a retained earnings account on a new tenant has no history,
  // so an absent Delete would say the wrong thing about why it cannot go.
  it('still offers delete, so the refusal has somewhere to be read', () => {
    expect(canDeleteAccount(RE, ctx)).toBe(true)
    expect(planDelete(RE, ctx).refusal?.description.join(' ')).toContain('year-end close')
  })

  it('holds whatever the account has been dealt with around it', () => {
    // Nothing under it, no entries, no balance: an ordinary posting account in this
    // state deactivates freely, and this one still does not.
    expect(planLifecycle('deactivate', POST_A, ctxOf([ROOT, MID, POST_A])).allowed).toBe(true)
    expect(planLifecycle('deactivate', RE, ctx).allowed).toBe(false)
  })

  it('never blocks bringing it back', () => {
    for (const action of ['activate', 'unarchive'] as const) {
      expect(planLifecycle(action, RE, ctx).allowed, action).toBe(true)
    }
  })

  it('holds the account the seeded chart actually gives the role to', () => {
    const held = seedAccounts.filter(a => a.accountRole === 'Retained Earnings')
    expect(held).toHaveLength(1)
    expect(held[0].glAccountType).toBe('Posting')
    const seedCtx = ctxOf(seedAccounts)
    expect(planLifecycle('deactivate', held[0], seedCtx).allowed).toBe(false)
    expect(planDelete(held[0], seedCtx).allowed).toBe(false)
  })
})

/* The archive rules split by what the account holds and how it clears. Five
   buckets: cash and card each carry money the reader can move or clear; the
   other balance-sheet roles do too but by the account's role, not just its
   category; permanent equity and income-statement accounts have no move flow
   at all and archive only after the balance reaches zero the way their kind
   reaches zero. */
describe('accountLifecycle - buckets branch by role and type', () => {
  const bank = acct('bnk', '1030', 'Posting', { accountType: 'AST', accountRole: 'Bank' })
  const petty = acct('pty', '1020', 'Posting', { accountType: 'AST', accountRole: 'Cash on Hand' })
  const card = acct('cc', '2020', 'Posting', { accountType: 'LIA', accountRole: 'Credit Card' })
  const ar = acct('ar', '1075', 'Posting', { accountType: 'AST', accountRole: 'Accounts Receivable' })
  const ar2 = acct('ar2', '1076', 'Posting', { accountType: 'AST', accountRole: 'Accounts Receivable' })
  const revenue = acct('rev', '4010', 'Posting', { accountType: 'REV' })
  const expense = acct('exp', '5010', 'Posting', { accountType: 'EXP' })
  const equity = acct('eq', '3020', 'Posting', { accountType: 'EQT', accountRole: 'Opening Balance Equity' })
  const ppe = acct('ppe', '1215', 'Posting', { accountType: 'AST' })

  it('reads the bucket off role first, then category', () => {
    expect(archiveBucketOf(bank)).toBe('cash')
    expect(archiveBucketOf(petty)).toBe('cash')
    expect(archiveBucketOf(card)).toBe('card')
    expect(archiveBucketOf(ar)).toBe('balanceSheet')
    expect(archiveBucketOf(ppe)).toBe('balanceSheet')
    expect(archiveBucketOf(revenue)).toBe('incomeStatement')
    expect(archiveBucketOf(expense)).toBe('incomeStatement')
    expect(archiveBucketOf(equity)).toBe('permanentEquity')
  })

  it('offers cash any other cash account, whatever the specific cash role', () => {
    const holds = { ...bank, balance: 400, currencyCode: 'USD' }
    const dests = balanceDestinations(holds, [holds, petty, ar, ppe])
    // Petty (Cash on Hand) is offered; AR and PPE (not cash) are not; itself is
    // excluded because you cannot move a balance to the account it is on.
    expect(dests.map(a => a.id)).toEqual(['pty'])
  })

  /* Mahad, 2026-10-10: *"When I try to archive an account that has another
     currency other than USD, make sure we have the same behavior as we have in
     the USD account for now."* Destinations are not narrowed by currency, either
     way round, and the move is stated in the base currency the balance is held in. */
  it('offers the same accounts whatever the currency, and states the move in base', () => {
    const gbp = { ...petty, id: 'gbp', currencyCode: 'GBP' }
    const eur = acct('eur', '1040', 'Posting', { accountType: 'AST', accountRole: 'Bank', currencyCode: 'EUR' })
    const usd = { ...bank, balance: 400 }
    expect(balanceDestinations(usd, [usd, petty, gbp, eur]).map(a => a.id)).toEqual(['pty', 'gbp', 'eur'])
    const euro = { ...eur, balance: 400 }
    // And a euro account is offered every cash account, dollars and pounds included.
    expect(balanceDestinations(euro, [euro, bank, petty, gbp]).map(a => a.id)).toEqual(['pty', 'gbp', 'bnk'])
    const plan = planLifecycle('archive', euro, { ...ctxOf([euro, bank, petty, gbp]), baseCurrency: 'USD' })
    expect(plan.allowed).toBe(true)
    expect(plan.balanceMove?.destinations.length).toBeGreaterThan(0)
    expect(plan.confirm!.description.join(' ')).toBe("Archived accounts can't hold a balance. Transfer the $ 400.00 to another account first.")
  })

  it('offers a balance-sheet role only accounts of the same role', () => {
    const holds = { ...ar, balance: 500, currencyCode: 'USD' }
    // AR2 (same role) is on offer; PPE is same category but a different role.
    expect(balanceDestinations(holds, [holds, ar2, ppe]).map(a => a.id)).toEqual(['ar2'])
  })

  /* Mahad, 2026-10-08: "You can only move it to an account under [summary
     name]." On top of the kind and currency rules, at any depth under it. */
  it('offers only accounts under the same summary, at any depth', () => {
    const cashSum = acct('cs', '1000', 'Summary', { accountType: 'AST' })
    const otherSum = acct('os', '1900', 'Summary', { accountType: 'AST' })
    const sub = acct('sub', '1050', 'Summary', { accountType: 'AST', parentId: 'cs' })
    const holds = { ...bank, balance: 400, currencyCode: 'USD', parentId: 'cs' }
    const sibling = { ...petty, parentId: 'cs' }
    const nested = { ...petty, id: 'nst', accountNumber: '1055', parentId: 'sub' }
    const elsewhere = { ...petty, id: 'far', accountNumber: '1910', parentId: 'os' }
    const chart = [cashSum, otherSum, sub, holds, sibling, nested, elsewhere]
    expect(balanceDestinations(holds, chart).map(a => a.id).sort()).toEqual(['nst', 'pty'])
    // With only an account elsewhere left, it is refused, and the summary is named.
    const plan = planLifecycle('archive', holds, ctxOf([cashSum, otherSum, holds, elsewhere]))
    expect(plan.allowed).toBe(false)
    expect(plan.blockedReason).toContain('under 1000 ')
  })

  /* Mahad, 2026-10-10: *"Your decision is to offer accounts under the same
     parent or accounts with the same role."* A Bank account under another summary
     is on offer; a Cash on Hand account there is not, since only under the
     summary does any cash account do. */
  it('offers, beyond the summary, the accounts with the same role', () => {
    const cashSum = acct('cs', '1000', 'Summary', { accountType: 'AST' })
    const otherSum = acct('os', '1900', 'Summary', { accountType: 'AST' })
    const holds = { ...bank, balance: 400, currencyCode: 'USD', parentId: 'cs' }
    const sibling = { ...petty, parentId: 'cs' }
    const farBank = { ...bank, id: 'fbk', accountNumber: '1920', parentId: 'os' }
    const farPetty = { ...petty, id: 'far', accountNumber: '1910', parentId: 'os' }
    const chart = [cashSum, otherSum, holds, sibling, farBank, farPetty]
    expect(balanceDestinations(holds, chart).map(a => a.id)).toEqual(['pty', 'fbk'])
    // With the summary empty, the same role elsewhere still takes it.
    const alone = planLifecycle('archive', holds, ctxOf([cashSum, otherSum, holds, farBank, farPetty]))
    expect(alone.allowed).toBe(true)
    expect(alone.balanceMove!.destinations.map(a => a.id)).toEqual(['fbk'])
    // And with neither, the refusal says both came up empty.
    const none = planLifecycle('archive', holds, ctxOf([cashSum, otherSum, holds, farPetty]))
    expect(none.blockedReason).toBe('This balance has nowhere to go. There is no other open cash account under 1000 Account 1000 and no other open Bank account in your chart of accounts, so activate or add one first.')
  })

  it('offers a receivable any other receivable, under any summary', () => {
    const top = acct('t1', '1100', 'Summary', { accountType: 'AST' })
    const top2 = acct('t2', '1200', 'Summary', { accountType: 'AST' })
    const holds = { ...ar, balance: 500, currencyCode: 'USD', parentId: 't1' }
    const far = { ...ar2, parentId: 't2' }
    expect(balanceDestinations(holds, [top, top2, holds, far]).map(a => a.id)).toEqual(['ar2'])
  })

  it('offers nothing to income-statement or permanent-equity accounts', () => {
    for (const a of [revenue, expense, equity]) {
      expect(balanceDestinations({ ...a, balance: 100, currencyCode: 'USD' }, [a, bank, ar, ar2]))
        .toEqual([])
    }
  })

  it('refuses a card outright until it reads zero, without offering a picker', () => {
    // Overpayment or plain balance - both are "not zero" for a card, and the
    // way to clear one is a payoff journal entry, not a re-point.
    const owing = { ...card, balance: 400, currencyCode: 'USD' }
    const overpaid = { ...card, balance: -50, currencyCode: 'USD' }
    for (const c of [owing, overpaid]) {
      const p = planLifecycle('archive', c, ctxOf([c, bank]))
      expect(p.allowed).toBe(false)
      expect(p.balanceMove).toBeUndefined()
      expect(p.blockedReason).toMatch(/not at zero|overpaid credit balance is not zero/)
    }
  })

  it('lets a card archive once it reads zero, with no picker to answer first', () => {
    const zero = { ...card, balance: 0, currencyCode: 'USD' }
    const p = planLifecycle('archive', zero, ctxOf([zero]))
    expect(p.allowed).toBe(true)
    expect(p.balanceMove).toBeUndefined()
  })

  it('refuses permanent equity with a balance, and refuses revenue and expense with the year-end line', () => {
    // A capital-contributed account, not the singleton Opening Balance Equity
    // - the required-role gate would fire first on that one.
    const capital = acct('cap', '3030', 'Posting', { accountType: 'EQT', balance: 200, currencyCode: 'USD' })
    expect(planLifecycle('archive', capital, ctxOf([capital])).blockedReason)
      .toContain('has to be at zero')
    const rev = { ...revenue, balance: 500, currencyCode: 'USD' }
    const exp = { ...expense, balance: 500, currencyCode: 'USD' }
    for (const a of [rev, exp]) {
      expect(planLifecycle('archive', a, ctxOf([a, ar, ar2])).blockedReason)
        .toContain('year-end close')
    }
  })

  /* Mahad's copy, 2026-10-08: the one refusal that only waits on the close
     says "yet" and is acknowledged with Got it; the others keep Close. */
  it('tells revenue and expense they can archive after the close, and says yet', () => {
    const rev = { ...revenue, balance: 500, currencyCode: 'USD' }
    const refusal = planLifecycle('archive', rev, ctxOf([rev, ar, ar2])).refusal!
    expect(refusal.title).toMatch(/^Can't archive .+ yet$/)
    expect(refusal.dismissLabel).toBe('Got it')
    expect(refusal.description).toEqual(['This account has a balance of $ 500.00. Revenue and expense balances move to retained earnings at the year-end close. You can archive this account after the close, before anything new is posted to it.'])
    const capital = acct('cap', '3030', 'Posting', { accountType: 'EQT', balance: 200, currencyCode: 'USD' })
    const other = planLifecycle('archive', capital, ctxOf([capital])).refusal!
    expect(other.title).not.toMatch(/yet$/)
    expect(other.dismissLabel).toBeUndefined()
  })

  it('says "cash" on the label when the source is cash, and the role name when it is roled', () => {
    // Not a hard check on the picker JSX - that lives in AccountActions -
    // but a documentation of what the source drives, since the two share the
    // bucket helper.
    expect(archiveBucketOf(bank)).toBe('cash')
    expect(ar.accountRole).toBe('Accounts Receivable')
  })

  /* Module review, 2026-10-06 (COA-21): the dialog said postings still coming
     this period move with the balance. Only the balance moves; every posting
     stays under the archived account. */
  it('states the rule and the amount, on any archive with a move', () => {
    const arHolds = { ...ar, balance: 500, currencyCode: 'USD' }
    const cashHolds = { ...bank, balance: 500, currencyCode: 'USD' }
    for (const plan of [planLifecycle('archive', arHolds, ctxOf([arHolds, ar2])), planLifecycle('archive', cashHolds, ctxOf([cashHolds, petty]))]) {
      const said = plan.confirm?.description.join(' ') ?? ''
      // Mahad's copy, 2026-10-09. That the move is a new entry dated today is
      // the GL impact panel's to say, under the destination picker.
      expect(said).toBe("Archived accounts can't hold a balance. Transfer the $ 500.00 to another account first.")
      expect(said).not.toMatch(/month end|move with the balance/)
    }
  })

  it('says nowhere to go with the bucket named, when the destination list is empty', () => {
    const cashOnly = { ...bank, balance: 500, currencyCode: 'USD' }
    expect(planLifecycle('archive', cashOnly, ctxOf([cashOnly])).blockedReason)
      .toContain('cash account')
    const roleOnly = { ...ar, balance: 500, currencyCode: 'USD' }
    expect(planLifecycle('archive', roleOnly, ctxOf([roleOnly])).blockedReason)
      .toContain('Accounts Receivable')
  })
})

describe('accountLifecycle - copy', () => {
  const strings = () => {
    const out: string[] = STATUS_ORDER.flatMap(statusMeaningLines)
    const charts = [CHART, [ROOT, MID, restatus(POST_A, 'Inactive'), restatus(POST_B, 'Archived'), EMPTY]]
    for (const chart of charts) {
      const ctx = ctxOf(chart, ['p1'])
      for (const action of ['deactivate', 'activate', 'archive', 'unarchive'] as const) {
        for (const a of chart) {
          const p = planLifecycle(action, a, ctx)
          out.push(p.toast, p.menuLabel, p.blockedReason ?? '')
          if (p.confirm) out.push(p.confirm.title, p.confirm.confirmLabel, ...p.confirm.description, ...(p.confirm.affected ?? []))
          if (p.refusal) out.push(p.refusal.title, ...p.refusal.description, p.refusal.affectedTitle ?? '', ...(p.refusal.affected ?? []))
        }
        const b = planBulk(action, chart.map(a => a.id), ctx)
        out.push(b.toast)
        if (b.confirm) out.push(b.confirm.title, b.confirm.confirmLabel, ...b.confirm.description)
        if (b.refusal) out.push(b.refusal.title, ...b.refusal.description, b.refusal.affectedTitle ?? '', ...(b.refusal.affected ?? []))
      }
      for (const a of chart) {
        const d = planDelete(a, ctx)
        out.push(d.toast, d.menuLabel, d.blockedReason ?? '', d.confirm.title, d.confirm.confirmLabel, ...d.confirm.description)
        if (d.refusal) out.push(d.refusal.title, ...d.refusal.description)
      }
    }
    return out
  }

  /* The retired vocabulary is listed here rather than only in a comment so it
     cannot leak back. This change is *about* parents and children, so "group" is
     exactly the word one reaches for, and it has always meant something else here.

     "Reactivate" is retired for a different reason: there are four actions and
     each gets one verb, on every surface. The bulk bar said Reactivate while the
     status cell said Activate, which reads as two different actions on a listing
     showing one of them per row. Activate is the verb, in both places. */
  const BANNED = ['group', 'begin-total', 'end-total', 'heading', 'bracket', 'both halves', 'totaling', 'reactivate']

  it('uses no em dashes and none of the retired vocabulary', () => {
    for (const s of strings()) {
      expect(s).not.toContain('—')
      for (const word of BANNED) expect(s.toLowerCase(), s).not.toContain(word)
    }
  })
})
