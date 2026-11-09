import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'
import { accountFiguresFor } from './lib/periodSelection'
import { todayIso } from './lib/utils'
import type { Account, JournalEntry, Transaction } from './types'
import type { CommMessage, CommThread } from './lib/comms'

/* The money half of archiving. The planner decides whether a move is needed and
   what the reader is told; this is the part that actually carries the balance and
   the entries behind it across, so it is checked against the store rather than a
   plan object. */

const acct = (over: Partial<Account> & Pick<Account, 'id' | 'accountNumber'>): Account => ({
  accountName: 'Account', accountType: 'AST', glAccountType: 'Posting', status: 'Active',
  normalBalance: 'Debit', currencyCode: 'USD', balance: 0, netChange: 0,
  isPosting: true, isContra: false, hasTransactions: false,
  createdAt: '2026-01-01', updatedAt: '2026-01-01', updatedBy: 'Seed',
  ...over,
} as Account)

const tx = (id: string, accountId: string): Transaction => ({
  id, accountId, date: '2026-06-01', jeNumber: 'JE-2026-1', description: 'x',
  debit: 100, credit: 0, source: 'Manual JE', period: '2026-06', reference: '',
  entryType: 'Simple', runningBalance: 100, dimensionValues: [],
} as unknown as Transaction)

const CASH = acct({ id: 'c1', accountNumber: '1020', accountName: 'Petty Cash', balance: 1000, netChange: 250 })
const DEST = acct({ id: 'c2', accountNumber: '1025', accountName: 'Cash on Hand', balance: 8400, netChange: 100 })

describe('archiveAccount', () => {
  beforeEach(() => {
    useStore.setState({
      accounts: [CASH, DEST],
      transactions: [tx('t1', 'c1'), tx('t2', 'c2')],
      auditLog: [],
    })
  })

  it('refuses to archive money into thin air', () => {
    const r = useStore.getState().archiveAccount('c1')
    expect(r.ok).toBe(false)
    expect(useStore.getState().accounts.find(a => a.id === 'c1')!.status).toBe('Active')
  })

  it('carries the balance to the destination as a new entry', () => {
    const r = useStore.getState().archiveAccount('c1', 'c2')
    expect(r.ok).toBe(true)
    const [source, dest] = ['c1', 'c2'].map(id => useStore.getState().accounts.find(a => a.id === id)!)
    expect(source).toMatchObject({ status: 'Archived', balance: 0 })
    expect(dest.balance).toBe(9400)

    /* The movement follows the posting rather than being handed over: the
       source moved 250 this period and has just been taken down by 1000, and
       the destination moved 100 and has just gained 1000. Which keeps
       `opening + netChange === balance` true on both, the invariant the
       listing rewinds through to strike an opening. */
    expect(source.netChange).toBe(-750)
    expect(dest.netChange).toBe(1100)
  })

  /* The bug this replaced: the source's postings were re-pointed at the
     destination, so an entry posted in June silently read as the destination's
     afterwards. What happened does not change because an account closed today. */
  it('leaves the postings already made where they were posted', () => {
    useStore.getState().archiveAccount('c1', 'c2')
    const original = useStore.getState().transactions.find(t => t.id === 't1')!
    expect(original.accountId).toBe('c1')
    expect(original.date).toBe('2026-06-01')
  })

  it('writes the move as one balanced entry dated today', () => {
    useStore.getState().archiveAccount('c1', 'c2')
    const entries = useStore.getState().journalEntries
    const entry = entries[entries.length - 1]
    expect(entry.date).toBe(todayIso())
    const debit = entry.lines.reduce((n: number, l) => n + l.debit, 0)
    const credit = entry.lines.reduce((n: number, l) => n + l.credit, 0)
    expect(debit).toBe(credit)
    expect(debit).toBe(1000)

    // And the two ledgers agree about it, which the re-pointing never did.
    const posted = useStore.getState().transactions.filter(t => t.jeNumber === entry.reference)
    expect(posted.map(t => t.accountId).sort()).toEqual(['c1', 'c2'])
  })

  // Two events, not one. A reader asking why 1020 is empty needs to see where the
  // money went, not just that the account closed.
  it('records the move and the archiving separately', () => {
    useStore.getState().archiveAccount('c1', 'c2')
    const log = useStore.getState().auditLog.filter(e => e.accountId === 'c1')
    expect(log.map(e => e.action)).toEqual(['Merge', 'Archive'])
    expect(log[0].newValue).toBe('c2')
  })

  it('leaves a cleared account to archive without a destination', () => {
    useStore.setState({ accounts: [acct({ id: 'c9', accountNumber: '1099' }), DEST] })
    expect(useStore.getState().archiveAccount('c9').ok).toBe(true)
    expect(useStore.getState().accounts.find(a => a.id === 'c9')!.status).toBe('Archived')
  })

  // The picker only ever lists accounts the rules accept, so this is the guard
  // against a stale id rather than an everyday path.
  it('will not send a balance somewhere the rules never offered', () => {
    useStore.setState({ accounts: [CASH, DEST, acct({ id: 'e1', accountNumber: '5010', accountType: 'EXP' })] })
    expect(useStore.getState().archiveAccount('c1', 'e1').ok).toBe(false)
    expect(useStore.getState().accounts.find(a => a.id === 'c1')!.balance).toBe(1000)
  })
})

/* A posting moves the balance after it, never the balance before the period
   began. The listing and the ledger tree rewind backward from Account.balance to
   strike opening and movement, so a posting that left the balance stale showed up
   as a change to the opening instead of the current balance - a fresh account
   debited 23.45 read opening -23.45 with the current balance stuck at 0. */

const post = (accountId: string, debit: number, credit: number, id = 'txp'): Transaction => ({
  id, accountId, date: '2026-06-15', jeNumber: 'JE-2026-9', description: 'posting',
  debit, credit, source: 'Manual JE', period: '2026-06', reference: 'JE-2026-9',
  entryType: 'Compound', runningBalance: 0, dimensionValues: [],
} as unknown as Transaction)

const entry = (): JournalEntry => ({
  id: 'je-9', date: '2026-06-15', reference: 'JE-2026-9',
  description: 'posting', status: 'Posted',
  lines: [{ accountId: 'a1', debit: 23.45, credit: 0 }, { accountId: 'r1', debit: 0, credit: 23.45 }],
} as unknown as JournalEntry)

const JUNE = { startDate: '2026-06-01', endDate: '2026-06-30' }

describe('addJournalEntry', () => {
  beforeEach(() => {
    useStore.setState({
      accounts: [
        acct({ id: 'a1', accountNumber: '1200', accountName: 'Fresh Asset', balance: 0, netChange: 0 }),
        acct({ id: 'r1', accountNumber: '4000', accountName: 'Fresh Revenue', accountType: 'REV', normalBalance: 'Credit', balance: 0, netChange: 0 }),
      ],
      transactions: [],
      journalEntries: [],
      auditLog: [],
    })
  })

  it('moves the current balance, so the rewound opening stays 0', () => {
    useStore.getState().addJournalEntry(entry(), [post('a1', 23.45, 0), post('r1', 0, 23.45, 'txp2')])
    const asset = useStore.getState().accounts.find(a => a.id === 'a1')!
    expect(asset).toMatchObject({ balance: 23.45, netChange: 23.45, hasTransactions: true })
    // The reported symptom, stated against the rewind the listing uses: ending is
    // the posting, and ending minus movement (the opening) is 0, not -23.45.
    const figures = accountFiguresFor(asset, useStore.getState().transactions, JUNE)
    expect(figures.balance).toBe(23.45)
    expect(figures.balance - figures.netChange).toBe(0)
  })

  it('signs the delta by the account normal side', () => {
    useStore.getState().addJournalEntry(entry(), [post('a1', 23.45, 0), post('r1', 0, 23.45, 'txp2')])
    // Credit-normal revenue: a credit raises its balance the same 23.45.
    expect(useStore.getState().accounts.find(a => a.id === 'r1')!).toMatchObject({ balance: 23.45, netChange: 23.45 })
  })

  it('leaves balances untouched when the caller sets them itself', () => {
    useStore.getState().addJournalEntry(entry(), [post('a1', 23.45, 0)], undefined, { skipBalanceUpdate: true })
    expect(useStore.getState().accounts.find(a => a.id === 'a1')!).toMatchObject({ balance: 0, netChange: 0, hasTransactions: false })
  })
})

/* Moving a thread onto another record. Two acts share one action: filing it
   somewhere real, and unlinking it from a record without naming a new one. The
   second is how a thread reaches the Unmatched mailbox, so the two are checked
   together. */

const msg = (id: string, threadId: string): CommMessage => ({
  id, threadId, channel: 'Email', from: 'Ola Sagen', fromEmail: 'ola@omnesoft.com',
  to: 'Bishrant', toEmail: 'bishrant@omnesoft.com', timestamp: 'Sep 05, 2026, 9:12 AM',
  dateIso: '2026-09-05T09:12:00Z', body: 'Why is this account under 1000?', isOutbound: false,
})

const thread = (): CommThread => ({
  id: 'th-1', subjectId: 'c1', entityType: 'Account', entityRef: 'ACC-1020',
  entityLabel: '1020 Petty Cash', subject: 'Classification question',
  lastSender: 'Ola Sagen', lastSenderEmail: 'ola@omnesoft.com',
  bodyPreview: 'Why is this account under 1000?', lastDate: 'Sep 05', dateIso: '2026-09-05T09:12:00Z',
  isUnread: false, hasAttachments: false, attachmentCount: 0,
  messages: [msg('m-1', 'th-1'), msg('m-2', 'th-1')],
})

describe('transferCommThread', () => {
  beforeEach(() => {
    useStore.setState({ commsThreads: [], commsTransferred: [] })
  })

  it('files the thread against the destination and takes it off the old record', () => {
    const t = thread()
    useStore.getState().transferCommThread({
      thread: t,
      destination: { subjectId: 'c2', ref: 'ACC-1025', label: '1025 Cash on Hand', kind: 'Account' },
    })
    const { commsThreads, commsTransferred } = useStore.getState()
    expect(commsTransferred).toEqual(['th-1'])
    expect(commsThreads).toHaveLength(1)
    expect(commsThreads[0].subjectId).toBe('c2')
    expect(commsThreads[0].entityRef).toBe('ACC-1025')
    expect(commsThreads[0].entityLabel).toBe('1025 Cash on Hand')
  })

  /* The copy has to carry its own id, and its messages have to point at it. The
     original id is what marks the thread as gone from where it was, so reusing
     it would suppress the copy along with the original. */
  it('gives the moved thread its own id, and re-parents its messages', () => {
    const t = thread()
    useStore.getState().transferCommThread({
      thread: t,
      destination: { subjectId: 'c2', ref: 'ACC-1025', label: '1025 Cash on Hand', kind: 'Account' },
    })
    const moved = useStore.getState().commsThreads[0]
    expect(moved.id).not.toBe('th-1')
    expect(moved.messages.map(m => m.threadId)).toEqual([moved.id, moved.id])
    expect(moved.messages.map(m => m.body)).toEqual(t.messages.map(m => m.body))
  })

  /* Unlinking with no destination. There is no inbox outside a record here, so
     the thread stays where it is and is filed as Other, which is what the
     Unmatched mailbox reads. */
  it('files an unlinked thread as Unmatched without moving it off the record', () => {
    useStore.getState().transferCommThread({ thread: thread() })
    const moved = useStore.getState().commsThreads[0]
    expect(moved.entityType).toBe('Other')
    expect(moved.entityRef).toBe('Unmatched')
    expect(moved.subjectId).toBe('c1')
    expect(moved.entityLabel).toBe('1020 Petty Cash')
  })

  it('can move a thread on to a journal entry, not just another account', () => {
    useStore.getState().transferCommThread({
      thread: thread(),
      destination: { subjectId: 'JE-2026-0042', ref: 'JE-2026-0042', label: 'JE-2026-0042', kind: 'Journal Entry' },
    })
    expect(useStore.getState().commsThreads[0].entityType).toBe('Journal Entry')
  })
})

/* Retest, 2026-10-09: an archived account is read-only from the moment it is
   archived, whichever door an edit comes through, and editable again once
   unarchived. */
describe('an archived account is read-only', () => {
  const FRESH = acct({ id: 'f1', accountNumber: '12170', accountName: 'Fresh', defaultDimensionValues: [] })
  const tag = [{ dimensionId: 'dim_department', value: 'Design' }] as unknown as Account['defaultDimensionValues']
  beforeEach(() => {
    useStore.setState({ accounts: [FRESH], transactions: [], auditLog: [] })
  })

  it('refuses an edit right after archiving, and takes it again after unarchiving', () => {
    const s = () => useStore.getState()
    expect(s().archiveAccount('f1').ok).toBe(true)
    s().updateAccount('f1', { defaultDimensionValues: tag })
    expect(s().accounts.find(a => a.id === 'f1')!.defaultDimensionValues).toEqual([])
    expect(s().auditLog.filter(e => e.action === 'Edit')).toHaveLength(0)

    expect(s().unarchiveAccount('f1').ok).toBe(true)
    s().updateAccount('f1', { defaultDimensionValues: tag })
    expect(s().accounts.find(a => a.id === 'f1')!.defaultDimensionValues).toEqual(tag)
  })
})
