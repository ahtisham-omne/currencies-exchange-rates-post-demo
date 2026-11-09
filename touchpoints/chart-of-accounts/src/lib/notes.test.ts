import { describe, it, expect } from 'vitest'
import { accountNotes, entryNotes } from './notes'
import { seedAccounts, seedTransactions } from './seed'
import { reconstructEntry } from './journalEntry'
import { fmtCurrency } from './utils'

const NOW = new Date('2026-10-06T12:00:00')

describe('the notes a record opens with', () => {
  it('gives every account two or three, the same ones every time', () => {
    for (const a of seedAccounts) {
      const notes = accountNotes(a, NOW)
      expect(notes.length, a.accountNumber).toBeGreaterThanOrEqual(1)
      expect(notes.length, a.accountNumber).toBeLessThanOrEqual(3)
      expect(accountNotes(a, NOW)).toEqual(notes)
      expect(new Set(notes.map(n => n.id)).size).toBe(notes.length)
    }
  })

  it('keeps the hand-written notes on the accounts the demo leans on, under their first ids', () => {
    const chase = accountNotes(seedAccounts.find(a => a.id === 'acct_11130'), NOW)
    expect(chase.map(n => n.id)).toEqual(['note_11130_3', 'note_11130_2', 'note_11130_1'])
    expect(chase[0].text).toMatch(/statement cut-off/)
  })

  it('gives every note an author and a real moment', () => {
    const all = [
      ...seedAccounts.flatMap(a => accountNotes(a, NOW)),
      ...[...new Set(seedTransactions.map(t => t.jeNumber))].flatMap(je => entryNotes(reconstructEntry(je, seedTransactions, seedAccounts), 'USD', NOW)),
    ]
    for (const n of all) {
      expect(typeof n.author, n.id).toBe('string')
      expect(n.author.length, n.id).toBeGreaterThan(0)
      expect(Number.isNaN(new Date(n.at).getTime()), n.id).toBe(false)
    }
  })

  it('never has the System confirm anything', () => {
    const texts = [...new Set(seedTransactions.map(t => t.jeNumber))]
      .flatMap(je => entryNotes(reconstructEntry(je, seedTransactions, seedAccounts), 'USD', NOW).map(n => n.text))
    expect(texts.some(x => /^System /.test(x))).toBe(false)
  })

  it('carries a tagged note from the document that raised an entry, and from an import', () => {
    const je = [...new Set(seedTransactions.filter(t => t.source === 'Vendor Invoice').map(t => t.jeNumber))][0]
    const notes = entryNotes(reconstructEntry(je, seedTransactions, seedAccounts), 'USD', NOW)
    expect(notes.filter(n => n.tag)).toEqual([expect.objectContaining({ tag: 'Vendor Invoice Note' })])
    const imported = seedAccounts.find(a => a.arrivedByImport)!
    expect(accountNotes(imported, NOW).filter(n => n.tag).map(n => n.tag)).toEqual(['Import Note'])
    const manual = [...new Set(seedTransactions.filter(t => t.source === 'Manual JE').map(t => t.jeNumber))][0]
    expect(entryNotes(reconstructEntry(manual, seedTransactions, seedAccounts), 'USD', NOW).some(n => n.tag)).toBe(false)
  })

  it('writes nothing about an entry the ledger does not hold', () => {
    expect(entryNotes(reconstructEntry('JE-0000-0000', seedTransactions, seedAccounts), 'USD', NOW)).toEqual([])
  })

  it('never dates a note in the future', () => {
    for (const a of seedAccounts.slice(0, 40)) for (const n of accountNotes(a, NOW)) expect(new Date(n.at) <= NOW).toBe(true)
    const jes = [...new Set(seedTransactions.map(t => t.jeNumber))].slice(-40)
    for (const je of jes) {
      const entry = reconstructEntry(je, seedTransactions, seedAccounts)
      for (const n of entryNotes(entry, 'USD', NOW)) expect(new Date(n.at) <= NOW, je).toBe(true)
    }
  })

  it('prints an entry\'s total from the entry, never an invented one', () => {
    const je = [...new Set(seedTransactions.map(t => t.jeNumber))].find(j => {
      const e = reconstructEntry(j, seedTransactions, seedAccounts)
      return entryNotes(e, 'USD', NOW).some(n => n.text.startsWith('Total of'))
    })!
    const entry = reconstructEntry(je, seedTransactions, seedAccounts)
    const total = entryNotes(entry, 'USD', NOW).find(n => n.text.startsWith('Total of'))!
    expect(total.text).toContain(fmtCurrency(entry.totalDebit, 'USD'))
  })

  it('writes in the module\'s voice: no em dashes, no curly quotes, a full stop at the end', () => {
    const texts = [
      ...seedAccounts.flatMap(a => accountNotes(a, NOW).map(n => n.text)),
      ...[...new Set(seedTransactions.map(t => t.jeNumber))].slice(0, 60)
        .flatMap(je => entryNotes(reconstructEntry(je, seedTransactions, seedAccounts), 'USD', NOW).map(n => n.text)),
    ]
    for (const t of texts) {
      expect(t).not.toMatch(/[—‘’“”]/)
      expect(t.trim()).toMatch(/\.$/)
    }
  })
})
