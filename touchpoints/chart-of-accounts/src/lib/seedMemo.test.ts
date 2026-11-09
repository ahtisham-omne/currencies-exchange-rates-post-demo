import { describe, it, expect } from 'vitest'
import { seedTransactions } from './seed'
import { entryMemo, reconstructEntry } from './journalEntry'
import { seedAccounts } from './seed'

/* One memo per entry, on every posting of it. Mahad, 2026-09-30, asked for the
   Journal entries tab's Description and Memo on the account's Transactions tab.
   A seeded entry had no memo, so each posting fell back to its own line's text -
   and the same entry read one memo on the register and another on the Journal
   entries tab, depending on which line each table happened to show. The seed now
   stamps the entry's memo, from the posting the entry page reads as its head. */
describe('a seeded entry has one memo', () => {
  const byJe = new Map<string, typeof seedTransactions>()
  for (const t of seedTransactions) byJe.set(t.jeNumber, [...(byJe.get(t.jeNumber) ?? []), t])

  it('has entries whose lines were worded apart, so the rule has something to hold', () => {
    const split = [...byJe.values()].filter(ps => new Set(ps.map(p => p.description)).size > 1)
    expect(split.length).toBeGreaterThan(100)
  })

  it('reads the same memo on every posting of an entry', () => {
    for (const [je, ps] of byJe) {
      expect(new Set(ps.map(entryMemo)).size, je).toBe(1)
    }
  })

  it('is the memo the entry page states', () => {
    for (const je of [...byJe.keys()].slice(0, 200)) {
      const page = reconstructEntry(je, seedTransactions, seedAccounts)
      expect(entryMemo(byJe.get(je)![0]), je).toBe(page.memo)
      for (const p of byJe.get(je)!) expect(entryMemo(p), je).toBe(page.memo)
    }
  })
})
