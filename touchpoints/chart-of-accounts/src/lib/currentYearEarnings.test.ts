import { describe, it, expect, beforeEach } from 'vitest'
import { earningsAccountHome, earningsPostings, isCurrentYearEarnings, withEarningsFigures } from './currentYearEarnings'
import { seedAccounts, seedCategoryAccounts, seedQ1Openings, seedTransactions } from './seed'
import { scopeAccountsToPeriod } from './periodSelection'
import { normalSideDelta } from './monthlyLedger'
import { planLifecycle, planDelete } from './accountLifecycle'
import { defaultCategoryRanges, schemeFromNumbering } from '../components/AccountNumberingStep'
import { useStore, lifecycleCtx } from '../store'
import type { Account } from '../types'

/* Mahad, 2026-10-10: *"Current year earnings should exist like any other
   account."* It is one: 35000, under Equity, with a role, an audit trail and a
   page. Its figure is still revenue less expenses, worked out, never authored. */
describe('Current Year Earnings, the account', () => {
  const earnings = seedAccounts.find(isCurrentYearEarnings)!

  it('is on the demo chart as 35000, a posting account under Equity', () => {
    expect(earnings.accountNumber).toBe('35000')
    expect(earnings.accountName).toBe('Current Year Earnings')
    expect(earnings.glAccountType).toBe('Posting')
    expect(earnings.statementClassification).toBe('Retained earnings')
    expect(seedAccounts.find(a => a.id === earnings.parentId)?.accountNumber).toBe('30000')
    expect(earnings.internalId).toMatch(/^ACC-/)
    expect(earnings.createdBy).toBeTruthy()
    // Nothing authored on it.
    expect(earnings.balance).toBe(0)
  })

  it('states revenue less expenses as its balance, on any period', () => {
    const all = scopeAccountsToPeriod(seedAccounts, seedTransactions, { startDate: '', endDate: '' })
    expect(all.find(isCurrentYearEarnings)!.balance).toBe(738100)
    const june = scopeAccountsToPeriod(seedAccounts, seedTransactions, { startDate: '2026-06-01', endDate: '2026-06-30' })
    const pl = (t: 'REV' | 'EXP') => june.filter(a => a.isPosting && a.accountType === t).reduce((s, a) => s + a.balance, 0)
    expect(june.find(isCurrentYearEarnings)!.balance).toBeCloseTo(pl('REV') - pl('EXP'), 6)
  })

  it('adds what is posted to it on top', () => {
    const posted = seedAccounts.map(a => (isCurrentYearEarnings(a) ? { ...a, balance: 50, netChange: 50 } : a))
    const base = withEarningsFigures(seedAccounts).find(isCurrentYearEarnings)!.balance
    expect(withEarningsFigures(posted).find(isCurrentYearEarnings)!.balance).toBe(base + 50)
  })

  it('runs on its page to the figure the chart states', () => {
    const own = earningsPostings(earnings, seedAccounts, seedTransactions)
    const run = (seedQ1Openings[earnings.id] ?? 0) + own.reduce((s, t) => s + normalSideDelta(earnings, t), 0)
    expect(run).toBeCloseTo(738100, 6)
  })

  it('cannot be deactivated, archived or deleted', () => {
    const ctx = lifecycleCtx(useStore.getState())
    for (const action of ['deactivate', 'archive'] as const) {
      expect(planLifecycle(action, earnings, ctx).blockedReason).toMatch(/year-end close moves it into retained earnings/)
    }
    expect(planDelete(earnings, ctx).blockedReason).toMatch(/cannot be deactivated, archived or deleted/)
  })
})

/* A chart built any other way gets the account the moment it has revenue or
   expense to work it out from, and not before: on a chart of category roots
   alone it read as an account nobody created (Mahad, 2026-10-08). */
describe('where the account is added', () => {
  const roots = seedCategoryAccounts(schemeFromNumbering(5, defaultCategoryRanges(5)), { currencyCode: 'USD', effectiveDate: '2026-01-01' })
  it('is not wanted on a chart of category roots alone', () => {
    expect(earningsAccountHome(roots)).toBeUndefined()
  })
  it('goes under Equity once a revenue or expense account exists, and only once', () => {
    const rev = roots.find(a => a.accountType === 'REV')!
    const sales: Account = { ...rev, id: 'sales', accountNumber: '41000', accountName: 'Sales', glAccountType: 'Posting', isPosting: true, parentId: rev.id }
    expect(earningsAccountHome([...roots, sales])?.accountType).toBe('EQT')
    expect(earningsAccountHome(seedAccounts)).toBeUndefined()
  })

  beforeEach(() => {
    useStore.setState({ accounts: roots, newAccountIds: [] })
  })
  it('is created by the system alongside the first revenue account', () => {
    const rev = roots.find(a => a.accountType === 'REV')!
    const created = useStore.getState().createAccount({
      accountNumber: '41000', accountName: 'Sales', accountType: 'REV', glAccountType: 'Posting',
      statementClassification: 'Operating revenue', parentId: rev.id, isPosting: true, currencyCode: 'USD',
      status: 'Active', effectiveDate: '2026-01-01', postingRestrictions: {}, defaultDimensionValues: [],
      balance: 0, netChange: 0, hasTransactions: false,
    })
    const { accounts, newAccountIds } = useStore.getState()
    const added = accounts.filter(isCurrentYearEarnings)
    expect(added).toHaveLength(1)
    expect(added[0].parentId).toBe(roots.find(a => a.accountType === 'EQT')!.id)
    expect(added[0].createdBy).toBe('System (Automated)')
    // The reader's new account is the one they made.
    expect(newAccountIds).toEqual([created.id])
  })
  const sales = (rev: Account) => ({
    accountNumber: '41000', accountName: 'Sales', accountType: 'REV' as const, glAccountType: 'Posting' as const,
    statementClassification: 'Operating revenue' as const, parentId: rev.id, isPosting: true, currencyCode: 'USD',
    status: 'Active' as const, effectiveDate: '2026-01-01', postingRestrictions: {}, defaultDimensionValues: [],
    balance: 0, netChange: 0, hasTransactions: false,
  })

  /* Design, 2026-10-12: *"remove the Current Year Earnings account from the
     guided setup output in the prototype."* */
  it('is not added to a chart guided setup builds', () => {
    const rev = roots.find(a => a.accountType === 'REV')!
    useStore.getState().createAccount(sales(rev), { withoutEarnings: true })
    expect(useStore.getState().accounts.filter(isCurrentYearEarnings)).toHaveLength(0)
  })

  it('does not ride in later with an account that is not the chart\'s first revenue or expense', () => {
    const rev = roots.find(a => a.accountType === 'REV')!
    useStore.getState().createAccount(sales(rev), { withoutEarnings: true })
    useStore.getState().createAccount({ ...sales(rev), accountNumber: '42000', accountName: 'Service revenue' })
    expect(useStore.getState().accounts.filter(isCurrentYearEarnings)).toHaveLength(0)
  })
})
