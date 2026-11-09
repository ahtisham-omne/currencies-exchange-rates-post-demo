import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store'
import {
  CoaView, DEFAULT_VIEWS, rowsForView, groupRowsForView, sumBalance, buildTempView,
} from './coaViews'
import type { Account } from '../types'

// A view is a read-only lens - spec §2 "Lens, not edit" and §8 acceptance:
// "No code path mutates account data when creating, applying, switching,
// saving, or deleting a view." These tests assert the account set is
// byte-for-byte unchanged across a full view lifecycle, plus the aggregation
// reconciliation invariant from §6.

const snapshot = (accounts: Account[]) => JSON.stringify(accounts)

describe('COA Saved Views - no mutation of account data', () => {
  beforeEach(() => {
    // Reset saved views between tests; accounts are the seeded set.
    useStore.setState({ coaSavedViews: [] })
  })

  it('leaves the account set byte-for-byte unchanged across a full view lifecycle', () => {
    const before = snapshot(useStore.getState().accounts)

    // 1 - CREATE a temporary view from the builder (filter + group-by + agg).
    const temp = buildTempView(['REV', 'EXP'], 'type', { count: true, sum: true })
    expect(snapshot(useStore.getState().accounts)).toBe(before)

    // 2 - APPLY it: compute the lens rows + groups + aggregation.
    const applied = rowsForView(temp, useStore.getState().accounts)
    groupRowsForView(temp, useStore.getState().accounts)
    sumBalance(applied)
    expect(snapshot(useStore.getState().accounts)).toBe(before)

    // 3 - SWITCH between built-in views.
    DEFAULT_VIEWS.forEach(v => {
      rowsForView(v, useStore.getState().accounts)
      if (v.kind === 'group') groupRowsForView(v, useStore.getState().accounts)
    })
    expect(snapshot(useStore.getState().accounts)).toBe(before)

    // 4 - SAVE the temp view (persists to the store's saved views).
    const saved: CoaView = { ...temp, id: 'view_test', name: 'Rev + Exp', shared: true, builtin: false, owner: 'tester' }
    useStore.getState().addCoaView(saved)
    expect(useStore.getState().coaSavedViews).toHaveLength(1)
    expect(snapshot(useStore.getState().accounts)).toBe(before)

    // 5 - DELETE the saved view.
    useStore.getState().removeCoaView('view_test')
    expect(useStore.getState().coaSavedViews).toHaveLength(0)
    expect(snapshot(useStore.getState().accounts)).toBe(before)
  })

  it('rowsForView returns a fresh array and never mutates the source', () => {
    const accounts = useStore.getState().accounts
    const before = snapshot(accounts)
    const rows = rowsForView(DEFAULT_VIEWS[0], accounts)
    expect(rows).not.toBe(accounts)            // new array reference
    rows.reverse()                              // mutating the result...
    expect(snapshot(useStore.getState().accounts)).toBe(before)  // ...must not touch the store
  })
})

describe('COA Saved Views - aggregation reconciliation (spec §6)', () => {
  it('sum of all group subtotals === grand total === sum of the filtered row set', () => {
    const accounts = useStore.getState().accounts
    const view = DEFAULT_VIEWS.find(v => v.id === 'rev-exp')!
    const rows = rowsForView(view, accounts)
    const grandTotal = sumBalance(rows)
    const groups = groupRowsForView(view, accounts)
    const subtotalSum = groups.reduce((s, g) => s + g.subtotal, 0)
    const groupedRowCount = groups.reduce((n, g) => n + g.rows.length, 0)

    expect(subtotalSum).toBe(grandTotal)
    expect(groupedRowCount).toBe(rows.length)
  })

  // The reconciliation test above only proves the parts add up to the whole, which
  // held even when every figure was inflated. These pin the absolute value: an
  // aggregate must count each amount once, and must agree with the KPI cards on
  // the same page, which sum posting accounts only.
  it('counts postings only - subtotal rows never double count the money beneath them', () => {
    const accounts = useStore.getState().accounts
    const assets = accounts.filter(a => a.accountType === 'AST')
    const postingsOnly = assets.filter(a => a.isPosting).reduce((s, a) => s + a.balance, 0)

    expect(sumBalance(assets)).toBe(postingsOnly)
    // Guard against the assertion passing vacuously: there have to be summary rows
    // in the set for "counts postings only" to mean anything. They now hold no
    // stored figure at all - their amount is the live sum of what is under them -
    // so a summary can no longer inflate an aggregate even when one forgets to
    // filter, and the filter is defence in depth rather than the only thing
    // standing between the reader and a 4x number.
    expect(assets.some(a => !a.isPosting)).toBe(true)
    expect(assets.filter(a => !a.isPosting).every(a => a.balance === 0)).toBe(true)
  })

  it('agrees with the total assets KPI', () => {
    const accounts = useStore.getState().accounts
    const kpiTotalAssets = accounts
      .filter(a => a.isPosting && a.accountType === 'AST')
      .reduce((s, a) => s + (a.balance || 0), 0)
    const view = buildTempView(['AST'], null, { count: true, sum: true })

    expect(sumBalance(rowsForView(view, accounts))).toBe(kpiTotalAssets)
  })

  it('group-by applies after the filter - sections only cover filtered rows', () => {
    const accounts = useStore.getState().accounts
    const view = DEFAULT_VIEWS.find(v => v.id === 'ast-lia')!
    const groups = groupRowsForView(view, accounts)
    // Only Asset and Liability sections may appear.
    expect(groups.every(g => g.key === 'Asset' || g.key === 'Liability')).toBe(true)
  })
})
