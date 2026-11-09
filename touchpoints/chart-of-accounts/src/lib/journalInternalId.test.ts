import { describe, it, expect, beforeEach } from 'vitest'
import { seedTransactions } from './seed'
import { formatJournalInternalId, journalInternalIdSeq, nextJournalInternalId } from './internalId'
import { useStore } from '../store'

/* The journal entry's internal ID (Mahad, 2026-09-30: *"Additional column for
   Journal Internal ID"*). One per entry, on every posting of it; sequential
   across every year, oldest first; and the next one for any entry the app posts. */
describe('journal internal IDs', () => {
  const byJe = new Map<string, Set<string | undefined>>()
  for (const t of seedTransactions) byJe.set(t.jeNumber, (byJe.get(t.jeNumber) ?? new Set()).add(t.entryInternalId))

  it('gives every seeded entry one, the same on all its postings, and no two entries the same', () => {
    const ids = [...byJe.values()].map(s => { expect(s.size).toBe(1); return [...s][0]! })
    expect(ids.every(id => /^JNL-\d{6}$/.test(id))).toBe(true)
    expect(new Set(ids).size).toBe(byJe.size)
  })

  // Oldest first: by date, then by the number the entry was issued.
  const posted = [...seedTransactions].sort((a, b) => a.date.localeCompare(b.date) || a.jeNumber.localeCompare(b.jeNumber, undefined, { numeric: true }))
  it('numbers them in the order they posted, from JNL-000001', () => {
    expect(posted[0].entryInternalId).toBe('JNL-000001')
    expect(posted[posted.length - 1].entryInternalId).toBe(formatJournalInternalId(byJe.size))
    const seqs = posted.map(t => journalInternalIdSeq(t.entryInternalId))
    for (let i = 1; i < seqs.length; i++) expect(seqs[i]).toBeGreaterThanOrEqual(seqs[i - 1])
  })

  it('reads the sequence, not the text', () => {
    expect(formatJournalInternalId(42)).toBe('JNL-000042')
    expect(journalInternalIdSeq('JNL-1000000')).toBeGreaterThan(journalInternalIdSeq('JNL-999999'))
    expect(journalInternalIdSeq('ACC-000001')).toBe(0)
  })

  describe('an entry posted in the app', () => {
    beforeEach(() => useStore.setState({ transactions: seedTransactions }))
    it('takes the next ID after the highest the ledger holds, on each of its postings', () => {
      const expected = nextJournalInternalId(seedTransactions)
      expect(journalInternalIdSeq(expected)).toBe(byJe.size + 1)
      const base = { date: '2026-09-30', source: 'Manual JE', jeNumber: 'JE-2026-9990', reference: '', entryType: 'Simple' as const, description: '', runningBalance: 0, dimensionValues: [], period: 'Sep 2026' }
      useStore.getState().addJournalEntry(
        { id: 'je_x', date: '2026-09-30', reference: 'JE-2026-9990', description: 'Manual journal entry', status: 'Posted', lines: [] },
        [{ ...base, id: 'x1', accountId: 'acct_52110', debit: 5, credit: 0 }, { ...base, id: 'x2', accountId: 'acct_11130', debit: 0, credit: 5 }],
      )
      const posted = useStore.getState().transactions.filter(t => t.jeNumber === 'JE-2026-9990')
      expect(posted.map(t => t.entryInternalId)).toEqual([expected, expected])
    })
  })
})
