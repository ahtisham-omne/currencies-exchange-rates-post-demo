import { describe, it, expect } from 'vitest'
import { useStore, buildAccount } from '../store'
import type { Account, AuditEntry } from '../types'

/* "Who made this account, and when" is one fact with two surfaces: the
   information card on the detail page, and the Create entry in its Activity tab.
   They disagreed - the card credited the controller and dated every account to
   the same day, because it was reading the effective date, while the log named
   the import on every fourth account by index.

   Two facts, one owner: the account holds them, and the log is written from it.
   Nothing may restate them. */

const accounts = useStore.getState().accounts
const audit = useStore.getState().auditLog
const createFor = (id: string) => audit.find(e => e.accountId === id && e.action === 'Create')

describe('the log is written from the account', () => {
  it('gives every account exactly one Create entry', () => {
    for (const a of accounts) {
      expect(audit.filter(e => e.accountId === a.id && e.action === 'Create'), a.accountNumber).toHaveLength(1)
    }
  })

  it('credits the same person the account does', () => {
    for (const a of accounts) {
      expect(createFor(a.id)!.user, a.accountNumber).toBe(a.createdBy)
    }
  })

  it('dates it the same day the account does', () => {
    for (const a of accounts) {
      expect(createFor(a.id)!.timestamp, a.accountNumber).toBe(a.createdAt)
    }
  })

  /* The effective date is the other date on the card and used to be printed
     under the Created on label. It is one value for the whole chart, so reading
     it as a creation date gave every account the same birthday. */
  it('does not date creation from the effective date', () => {
    const effective = new Set(accounts.map(a => a.effectiveDate))
    expect(effective.size).toBeLessThan(accounts.length)
    expect(new Set(accounts.map(a => a.createdAt)).size).toBeGreaterThan(effective.size)
  })
})

describe('what the seeded chart credits', () => {
  const imported = accounts.filter(a => a.arrivedByImport)
  const handBuilt = accounts.filter(a => !a.arrivedByImport)

  /* To a person, and to one person. "System Import" named the mechanism where
     the field asks who is answerable for the account - and how it arrived is
     what the Source column is for. */
  it('credits the migrated branch to the one person who ran it', () => {
    expect(imported.length).toBeGreaterThan(0)
    expect(new Set(imported.map(a => a.createdBy)).size).toBe(1)
    expect(imported[0].createdBy).toMatch(/^[A-Z][a-z]+ [A-Z]/)
  })

  it('dates the whole migrated branch to one day, because it arrived in one file', () => {
    expect(new Set(imported.map(a => a.createdAt)).size).toBe(1)
  })

  // Still two provenances, now that both are people: the migration and the
  // chart that grew around it were not the same person's work.
  it('credits the rest to a different person than the migration', () => {
    expect(handBuilt.every(a => a.createdBy && a.createdBy !== imported[0].createdBy)).toBe(true)
  })

  // No account predates the file it was reconciled against.
  it('has nothing hand-built arriving after the migration', () => {
    const importedAt = imported[0].createdAt
    expect(handBuilt.every(a => a.createdAt < importedAt)).toBe(true)
  })
})

/* Last touched is the same shape of claim, and had the same fault: every account
   arrived saying it was edited 40 days ago by the controller, with no event in
   the timeline to account for it. */
describe('last touched comes from the log too', () => {
  const changes = (id: string) => audit.filter(e => e.accountId === id && e.action !== 'Create')
  const newest = (es: AuditEntry[]) =>
    es.reduce<AuditEntry | undefined>((m, e) => (!m || e.timestamp > m.timestamp ? e : m), undefined)

  it('names the newest change on an account that has one', () => {
    const edited = accounts.filter(a => changes(a.id).length > 0)
    expect(edited.length).toBeGreaterThan(0)
    for (const a of edited) {
      const last = newest(changes(a.id))!
      expect(a.updatedAt, a.accountNumber).toBe(last.timestamp)
      expect(a.updatedBy, a.accountNumber).toBe(last.user)
    }
  })

  it('falls back to the creation on an account nobody has touched', () => {
    const untouched = accounts.filter(a => changes(a.id).length === 0)
    expect(untouched.length).toBeGreaterThan(0)
    for (const a of untouched) {
      expect(a.updatedAt, a.accountNumber).toBe(a.createdAt)
      expect(a.updatedBy, a.accountNumber).toBe(a.createdBy)
    }
  })

  it('never claims an account was updated before it existed', () => {
    for (const a of accounts) expect(a.updatedAt >= a.createdAt, a.accountNumber).toBe(true)
  })

  it('has an event behind every archived account being archived', () => {
    const archived = accounts.filter(a => a.status === 'Archived')
    expect(archived.length).toBeGreaterThan(0)
    for (const a of archived) {
      expect(changes(a.id).some(e => e.action === 'Archive'), a.accountNumber).toBe(true)
    }
  })
})

/* The same rule at runtime. An account created in the app has to log what it
   recorded about itself, or the card and the tab drift apart from the first
   account the reader adds. */
describe('an account created here', () => {
  const seed = accounts[0]
  const draft = (({ id, createdAt, updatedAt, createdBy, updatedBy, normalBalance, ...rest }) => rest)(
    { ...seed, accountNumber: '9911', accountName: 'Test account' } as Account)

  it('logs the creator and date it recorded on itself', () => {
    const before = useStore.getState().auditLog.length
    const made = useStore.getState().createAccount(draft)
    const log = useStore.getState().auditLog
    expect(log).toHaveLength(before + 1)
    const entry = log[log.length - 1]
    expect(entry.action).toBe('Create')
    expect(entry.user).toBe(made.createdBy)
    expect(entry.timestamp).toBe(made.createdAt)
  })

  it('opens with one clock reading, not two', () => {
    const made = buildAccount(draft)
    expect(made.updatedAt).toBe(made.createdAt)
  })
})
