import { describe, it, expect } from 'vitest'
import { lockEndedPeriods } from './periodClose'
import { periodPostingBlock } from './journalEntry'
import { seedPeriods } from './seed'
import { todayIso } from './utils'
import type { Period } from '../types'

/* Mahad, 2026-10-11: *"When a month ends, lock it and label it 'Locked'. Don't
   let anyone post an entry dated in a locked month."* */
describe('a month locks when it ends', () => {
  const p = (id: string, start: string, end: string, status: Period['status'] = 'Open'): Period => ({ id, label: id, startDate: start, endDate: end, status })
  const months = [p('Aug', '2026-08-01', '2026-08-31'), p('Sep', '2026-09-01', '2026-09-30', 'Soft-Closed'), p('Oct', '2026-10-01', '2026-10-31')]

  it('locks every month that has ended, and no other', () => {
    const out = lockEndedPeriods(months, '2026-10-11')
    expect(out.map(m => m.status)).toEqual(['Hard-Locked', 'Hard-Locked', 'Open'])
  })

  it('keeps a month open through its last day', () => {
    expect(lockEndedPeriods(months, '2026-09-30')[1].status).toBe('Soft-Closed')
    expect(lockEndedPeriods(months, '2026-09-30')[0].status).toBe('Hard-Locked')
  })

  it('refuses an entry dated in a locked month', () => {
    const out = lockEndedPeriods(months, '2026-10-11')
    expect(periodPostingBlock('2026-08-15', out)).toBe('Aug is locked - nothing can be posted into it.')
    expect(periodPostingBlock('2026-10-11', out)).toBeNull()
  })

  it('leaves the seeded chart with every ended month locked and the current one open', () => {
    const today = todayIso()
    for (const m of seedPeriods) {
      if (m.endDate < today) expect(m.status, m.label).toBe('Hard-Locked')
      else if (m.startDate <= today) expect(m.status, m.label).toBe('Open')
    }
  })
})
