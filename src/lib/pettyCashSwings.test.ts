import { describe, it, expect } from 'vitest'
import { seedAccounts, seedTransactions, seedPeriods, seedQ1Openings } from './seed'
import { monthlyBalances } from './monthlyLedger'

/* Mahad, 2026-10-15: the developers asked to see the Net change trend with
   months both up and down, and Petty Cash is the account set up to show it. */
describe('Petty Cash moves both ways across the year', () => {
  const a = seedAccounts.find(x => x.accountNumber === '11110')!
  const tx = seedTransactions.filter(t => t.accountId === a.id)
  const rows = monthlyBalances(a, tx, seedQ1Openings[a.id], seedPeriods)
    .filter(r => r.period.startDate >= '2026-01-01' && r.period.endDate <= '2026-09-30')

  it('has months up and months down', () => {
    expect(rows.filter(r => r.movement > 0).length).toBeGreaterThanOrEqual(4)
    expect(rows.filter(r => r.movement < 0).length).toBeGreaterThanOrEqual(3)
  })

  it('still closes on the balance the chart states', () => {
    const moved = tx.reduce((s, t) => s + t.debit - t.credit, 0)
    expect(seedQ1Openings[a.id] + moved).toBe(a.balance)
    expect(seedQ1Openings[a.id]).toBeGreaterThan(0)
  })
})
