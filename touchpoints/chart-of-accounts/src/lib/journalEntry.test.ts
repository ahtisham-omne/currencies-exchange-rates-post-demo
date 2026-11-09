import { describe, it, expect } from 'vitest'
import {
  buildReversal, dimensionsOfAccount, firstPostableDate, isPartialJeLine, journalEntryProblems,
  adjustmentAccountNote, adjustmentKind, manualPostingLock, nextJeNumber,
  RETAINED_EARNINGS_POSTING_SHORT, RETAINED_EARNINGS_ADJUSTMENTS_SHORT, INACTIVE_POSTING_SHORT, retainedEarningsAdjustmentsOf,
  ARCHIVED_POSTING_SHORT, reconstructEntry, reversalLinks, reversalMemo, type ReconstructedEntry,
  entryChangesOf, entryCreatedAt, entryCreatedBy, unpostableReason,
  type JeValidationInput,
} from './journalEntry'
import { seedAccounts, seedTransactions } from './seed'
import { todayIso } from './utils'
import { CONTROL_ACCOUNT_SHORT, type Account, type Period, type Transaction } from '../types'

/* The account-to-posting handover. A posting's dimension values are the
   account's, and a line has nothing to decide: an account read out of
   01-71100-40 is the Department 40 one, so a line that could say Department 50
   would be describing an account nobody has. */
describe('dimensionsOfAccount', () => {
  const account = {
    defaultDimensionValues: [
      { dimensionId: 'dim_entity', value: 'London' },
      { dimensionId: 'dim_department', value: 'Sales' },
    ],
  }

  it('gives a line every value the account carries', () => {
    expect(dimensionsOfAccount(account)).toEqual([
      { dimensionId: 'dim_entity', value: 'London' },
      { dimensionId: 'dim_department', value: 'Sales' },
    ])
  })

  /* Copied, so editing the account later does not rewrite what was already
     posted. */
  it('copies the values rather than sharing the account array', () => {
    const line = dimensionsOfAccount(account)
    line[0].value = 'Paris'
    expect(account.defaultDimensionValues[0].value).toBe('London')
  })

  it('gives nothing when the account carries no dimensions', () => {
    expect(dimensionsOfAccount({ defaultDimensionValues: [] })).toEqual([])
  })

  it('gives nothing when there is no account to post to', () => {
    expect(dimensionsOfAccount(undefined)).toEqual([])
  })
})

/* What still blocks a post, once the amounts already balance. The bug this covers:
   a line carrying an amount but no account still balances the entry, so Post lit
   up and then did nothing. The check has to catch the account the totals cannot
   see, and name it, rather than let the press fall silent. */
describe('journalEntryProblems', () => {
  const ok: JeValidationInput = {
    date: '2026-06-15',
    lines: [
      { accountId: 'a1', debit: 100, credit: 0 },
      { accountId: 'a2', debit: 0, credit: 100 },
    ],
    adjustment: false, reason: '',
  }

  it('passes a complete, dated, two-line entry', () => {
    expect(journalEntryProblems(ok)).toEqual([])
  })

  // The reported bug: debit 100 against a named account, credit 100 against none.
  // Totals reconcile, so balance never catches it - this must.
  it('catches a balanced entry that is still short an account', () => {
    const problems = journalEntryProblems({
      ...ok,
      lines: [
        { accountId: 'a1', debit: 100, credit: 0 },
        { accountId: '', debit: 0, credit: 100 },
      ],
    })
    expect(problems).toEqual([
      { field: 'lines', message: 'Every line needs both an account and an amount. Finish or remove the ones left incomplete.' },
    ])
  })

  it('counts a line that is an amount with no account as unfinished', () => {
    expect(isPartialJeLine({ accountId: '', debit: 50, credit: 0 })).toBe(true)
    expect(isPartialJeLine({ accountId: 'a1', debit: 0, credit: 0 })).toBe(true)
    expect(isPartialJeLine({ accountId: 'a1', debit: 50, credit: 0 })).toBe(false)
    expect(isPartialJeLine({ accountId: '', debit: 0, credit: 0 })).toBe(false)
  })

  it('asks for a second complete line when only one is finished', () => {
    const problems = journalEntryProblems({
      ...ok,
      lines: [{ accountId: 'a1', debit: 100, credit: 0 }, { accountId: '', debit: 0, credit: 0 }],
    })
    expect(problems).toEqual([{ field: 'lines', message: 'An entry needs at least two complete lines.' }])
  })

  it('asks for a date, then defers to the period block once one is set', () => {
    expect(journalEntryProblems({ ...ok, date: '' })).toContainEqual(
      { field: 'date', message: 'Pick the date this entry posts on.' })
    expect(journalEntryProblems({ ...ok, periodBlock: 'August 2026 is closed.' })).toContainEqual(
      { field: 'date', message: 'August 2026 is closed.' })
  })

  // An adjustment to an account the system keeps owes a written reason. The
  // document behind it is recommended, not required: the review left that open.
  it('makes an adjustment owe a written reason, and nothing more', () => {
    expect(journalEntryProblems({ ...ok, adjustment: true })).toEqual([
      { field: 'reason', message: 'Write why this adjustment is needed.' },
    ])
    expect(journalEntryProblems({ ...ok, adjustment: true, reason: '   ' })).toHaveLength(1)
    expect(journalEntryProblems({ ...ok, adjustment: true, reason: '2025 insurance expense was 3,000 short' })).toEqual([])
  })
})

/* Which accounts a hand-written entry cannot reach. The picker greys whatever
   this names, so a rule that came back undefined by mistake would not fail
   loudly - it would quietly hand the reader an account they took out of service. */
describe('manualPostingLock', () => {
  it('lets an account in service through, whatever its role', () => {
    expect(manualPostingLock({ status: 'Active' })).toBeUndefined()
  })

  /* Deactivate is defined as a lock rather than a removal, and this is the lock.
     Without it the state was a label on the listing and nothing else, which is
     the one thing a reader deactivating an account is trying to prevent. */
  it('locks an account that has been taken out of service', () => {
    expect(manualPostingLock({ status: 'Inactive' })).toBe(INACTIVE_POSTING_SHORT)
    expect(manualPostingLock({ status: 'Archived' })).toBe(ARCHIVED_POSTING_SHORT)
  })
})

/* The accounts the system keeps. They are offered like any other, and a line on
   one is what turns the entry into an adjustment - design review, 2026-09-28:
   the flow shows when retained earnings is picked, not behind a switch that
   greyed it until turned on. */
describe('adjustmentKind', () => {
  it('names retained earnings and every control account, and nothing else', () => {
    expect(adjustmentKind({ accountRole: 'Retained Earnings' })).toBe('retained-earnings')
    expect(adjustmentKind({ accountRole: 'Retained Earnings Adjustments' })).toBe('retained-earnings')
    expect(adjustmentKind({ accountRole: 'Accounts Receivable' })).toBe('control')
    expect(adjustmentKind({ accountRole: 'Accounts Payable' })).toBe('control')
    expect(adjustmentKind({ accountRole: 'Inventory' })).toBe('control')
    expect(adjustmentKind({ accountRole: 'Bank' })).toBeUndefined()
    expect(adjustmentKind({ accountRole: undefined })).toBeUndefined()
    expect(adjustmentKind(undefined)).toBeUndefined()
  })

  it('marks them in the picker so they read apart from ordinary accounts', () => {
    expect(adjustmentAccountNote('retained-earnings')).toBe(RETAINED_EARNINGS_POSTING_SHORT)
    expect(adjustmentAccountNote('retained-earnings', { accountRole: 'Retained Earnings Adjustments' })).toBe(RETAINED_EARNINGS_ADJUSTMENTS_SHORT)
    expect(adjustmentAccountNote('control')).toBe(CONTROL_ACCOUNT_SHORT)
    expect(adjustmentAccountNote(undefined)).toBeUndefined()
  })

  /* The role is what this reads, and the seed is what hands it out. If the chart
     ever stopped giving the role to the retained earnings row, the flow would go
     quiet on the one account it was built for. */
  /* The chart ships retained earnings as a summary over two posting accounts
     (design review, 2026-09-28): the one the close posts to, and the one hand
     corrections go to. The role is what every rule here reads, so the seed has
     to hand out both. */
  it('ships retained earnings split into a system and a manual account', () => {
    const summary = seedAccounts.find(a => a.accountNumber === '32000')!
    expect(summary.glAccountType).toBe('Summary')
    const system = seedAccounts.filter(a => a.accountRole === 'Retained Earnings')
    const manual = seedAccounts.filter(a => a.accountRole === 'Retained Earnings Adjustments')
    expect(system.map(a => a.accountNumber)).toEqual(['32100'])
    expect(manual.map(a => a.accountNumber)).toEqual(['32200'])
    for (const a of [...system, ...manual]) {
      expect(a.glAccountType).toBe('Posting')
      expect(a.parentId).toBe(summary.id)
      expect(adjustmentKind(a)).toBe('retained-earnings')
    }
  })

  // With both, a hand entry is sent to the manual account and the system one is
  // closed to it; with only one, it stays open, since a correction has nowhere else.
  it('closes the system account to hand entries only where the manual one exists', () => {
    const adj = retainedEarningsAdjustmentsOf(seedAccounts)!
    expect(adj.accountNumber).toBe('32200')
    const system = seedAccounts.find(a => a.accountRole === 'Retained Earnings')!
    expect(manualPostingLock(system, adj)).toBe('Year-end close only, corrections go to 32200')
    expect(manualPostingLock(adj, adj)).toBeUndefined()
    expect(manualPostingLock(system, undefined)).toBeUndefined()
  })
})

/* The ledger groups postings by JE number, so a number is an identity and not a
   label. It used to be four random digits: the day two entries drew the same one
   the second disappeared into the first, wearing its date and its description.
   That is the bug these guard, so the property that matters is not the format but
   that a number is never handed out twice. */
describe('nextJeNumber', () => {
  it('carries on from the highest number the year has issued', () => {
    expect(nextJeNumber(['JE-2026-2000', 'JE-2026-2001'], '2026-03-04')).toBe('JE-2026-2002')
  })

  it('reads the highest rather than the last, so the order it is given cannot matter', () => {
    expect(nextJeNumber(['JE-2026-2009', 'JE-2026-2003'], '2026-03-04')).toBe('JE-2026-2010')
  })

  it('starts a year that has issued nothing at its own first number', () => {
    expect(nextJeNumber(['JE-2025-2400'], '2026-01-01')).toBe('JE-2026-0001')
    expect(nextJeNumber([], '2026-01-01')).toBe('JE-2026-0001')
  })

  /* A document reference shares the number's shape but is not a journal number,
     and says nothing about how far the JE- series has got. */
  it('ignores a number from another series', () => {
    expect(nextJeNumber(['INV-2026-1050', 'JE-2026-2000'], '2026-06-01')).toBe('JE-2026-2001')
  })

  it('ignores a number whose tail is not a number at all', () => {
    expect(nextJeNumber(['JE-2026-draft', 'JE-2026-2000'], '2026-06-01')).toBe('JE-2026-2001')
  })

  /* The seed's own numbers, because they are what a demo posts on top of. If the
     chart's format ever moved, the next number would restart inside a run that
     already exists and collide on its first press. */
  it('clears every number the shipped ledger already holds', () => {
    const issued = seedTransactions.map(t => t.jeNumber)
    for (const year of new Set(issued.map(n => n.slice(3, 7)))) {
      const next = nextJeNumber(issued, `${year}-06-01`)
      expect(issued, `${next} is already in the ledger`).not.toContain(next)
    }
  })
})

/* The ledger stores one row per posting, and a seeded entry carries only its
   primary side. The Journal entries tab opens an entry onto these lines and
   claims a reader can check that its two sides balance, so that claim is a
   property of the reconstruction and not of the page: every entry the chart
   ships has to come back with both sides and net to nothing. Reading the raw
   postings instead is what made the tab open an entry onto one side of itself. */
describe('reconstructEntry over the shipped ledger', () => {
  it('gives every entry both sides, balanced', () => {
    for (const jeNumber of new Set(seedTransactions.map(t => t.jeNumber))) {
      const entry = reconstructEntry(jeNumber, seedTransactions, seedAccounts)
      expect(entry.lines.length, jeNumber).toBeGreaterThan(1)
      expect(entry.lines.some(l => l.debit > 0), jeNumber).toBe(true)
      expect(entry.lines.some(l => l.credit > 0), jeNumber).toBe(true)
      expect(entry.balanced, `${jeNumber} is out by ${entry.totalDebit - entry.totalCredit}`).toBe(true)
    }
  })

  /* A real posting keeps its own row so the ledger's columns stay the ledger's;
     only the contra is stood in for. The table pairs lines back to postings by
     id, so an id that matched nothing would silently blank those columns. */
  it('keeps the posting id on every line it did not synthesise', () => {
    const byId = new Map(seedTransactions.map(t => [t.id, t]))
    for (const jeNumber of new Set(seedTransactions.map(t => t.jeNumber))) {
      for (const line of reconstructEntry(jeNumber, seedTransactions, seedAccounts).lines) {
        expect(line.synthetic || byId.has(line.id), `${jeNumber} line ${line.id}`).toBe(true)
      }
    }
  })

  /* Every line carries the dimensions it posted with, so the entry page can show
     what each account contributed the line rather than leave the reader to open
     the account for it. A real posting hands over its stored snapshot verbatim;
     only a synthesised contra, having none, reads the account's own defaults. */
  it('carries each real posting its own stored dimensions', () => {
    const byId = new Map(seedTransactions.map(t => [t.id, t]))
    for (const jeNumber of new Set(seedTransactions.map(t => t.jeNumber))) {
      for (const line of reconstructEntry(jeNumber, seedTransactions, seedAccounts).lines) {
        const posting = byId.get(line.id)
        if (posting?.dimensionValues.length) {
          expect(line.dimensionValues, `${jeNumber} line ${line.id}`).toEqual(posting.dimensionValues)
        }
      }
    }
  })
})

/* A reversal is a decision the app already holds, not a form. These cover what it
   decides: which side each line lands on, where it posts when the original's own
   month is shut, and the cases where it must refuse. */
describe('buildReversal', () => {
  const today = todayIso()
  const year = today.slice(0, 4)
  const open: Period = { id: 'p_open', label: 'Open period', startDate: `${year}-01-01`, endDate: `${year}-12-31`, status: 'Open' }
  const shut: Period = { id: 'p_shut', label: 'Closed period', startDate: '2019-01-01', endDate: '2019-12-31', status: 'Soft-Closed' }
  const periods = [shut, open]

  const acct = (over: Partial<Account> = {}) =>
    ({ id: 'acc_1', accountNumber: '1000', accountName: 'Bank', status: 'Active', ...over }) as Account

  const entry = (over: Partial<ReconstructedEntry> = {}): ReconstructedEntry => ({
    jeNumber: 'JE-2026-0007', date: `${year}-06-01`, memo: 'Accrue rent', period: open.label,
    status: 'Posted', source: 'Manual JE', reference: '', hasLinkedDoc: false, entryType: 'Simple',
    lines: [
      { id: 'l1', accountId: 'acc_1', account: acct(), debit: 500, credit: 0, description: 'Rent', dimensionValues: [] },
      { id: 'l2', accountId: 'acc_2', account: acct({ id: 'acc_2', accountNumber: '2000', accountName: 'Accruals' }), debit: 0, credit: 500, description: 'Rent', dimensionValues: [] },
    ],
    totalDebit: 500, totalCredit: 500, balanced: true, createdBy: 'Someone', createdAt: `${year}-06-01`,
    found: true, ...over,
  })

  it('flips every line onto the opposite side and keeps its description', () => {
    const plan = buildReversal(entry(), periods, [])
    expect(plan.lines).toEqual([
      { accountId: 'acc_1', account: expect.anything(), description: 'Rent', debit: 0, credit: 500, dimensionValues: [] },
      { accountId: 'acc_2', account: expect.anything(), description: 'Rent', debit: 500, credit: 0, dimensionValues: [] },
    ])
    expect(plan.total).toBe(500)
  })

  /* Mahad, 2026-10-10: *"If you post an entry in EUR and reverse it, the
     reversal keeps only the home-currency amounts. The EUR amounts and the
     exchange rate are lost. The reversal should copy the EUR amounts and the
     original rate, not today's rate."* */
  it('reverses an entry written in another currency in that currency, at its own rate', () => {
    const e = entry({ entryCurrency: 'EUR', entryRate: 0.92 })
    e.lines = e.lines.map(l => ({ ...l, fxDebit: l.debit ? 460 : 0, fxCredit: l.credit ? 460 : 0 }))
    const plan = buildReversal(e, periods, [])
    expect(plan.entryCurrency).toBe('EUR')
    expect(plan.entryRate).toBe(0.92)
    expect(plan.lines.map(l => [l.debit, l.credit, l.fxDebit, l.fxCredit])).toEqual([[0, 500, 0, 460], [500, 0, 460, 0]])
  })

  it('leaves a base-currency entry without any foreign amounts', () => {
    const plan = buildReversal(entry(), periods, [])
    expect(plan.entryCurrency).toBeUndefined()
    expect(plan.lines.every(l => l.fxDebit === undefined && l.fxCredit === undefined)).toBe(true)
  })

  /* A line can post to any of its account's values, so the reversal backs it
     out of the one it actually posted to, not the account's default. */
  it('backs each line out of the dimension value it posted to', () => {
    const singapore = [{ dimensionId: 'dim_location', value: 'Singapore' }]
    const e = entry()
    e.lines[0] = { ...e.lines[0], dimensionValues: singapore }
    expect(buildReversal(e, periods, []).lines[0].dimensionValues).toEqual(singapore)
  })

  /* The synthesised contra is what makes a seeded entry balance, so a reversal
     that dropped it would post a one-sided correction. Reversing the whole
     reconstruction rather than the raw postings is what prevents that. */
  it('nets to nothing against the entry it reverses', () => {
    const e = entry()
    const plan = buildReversal(e, periods, [])
    expect(plan.lines.reduce((s, l) => s + l.debit, 0)).toBe(e.totalCredit)
    expect(plan.lines.reduce((s, l) => s + l.credit, 0)).toBe(e.totalDebit)
  })

  it('posts on the original date while that period still takes postings', () => {
    const plan = buildReversal(entry(), periods, [])
    expect(plan.date).toBe(`${year}-06-01`)
    expect(plan.movedDate).toBe(false)
    expect(plan.period).toBe(open.label)
  })

  /* Refusing would leave a wrong entry standing with no way to back it out, so
     the reversal moves to a date that posts - and says so. */
  it('moves to a postable date when the original period is closed', () => {
    const plan = buildReversal(entry({ date: '2019-06-01', period: shut.label }), periods, [])
    expect(plan.date).toBe(firstPostableDate(periods))
    expect(plan.movedDate).toBe(true)
    expect(plan.period).toBe(open.label)
  })

  it('names itself out of the numbers already issued, and points back at the original', () => {
    const plan = buildReversal(entry(), periods, [`JE-${year}-0007`])
    expect(plan.jeNumber).toBe(`JE-${year}-0008`)
    expect(plan.memo).toBe('Reversal of JE-2026-0007 · Accrue rent')
    // Its record is named for what it reverses; an entry carries no title.
    expect(plan.description).toBe('Reversal of JE-2026-0007')
    expect(plan.blocked).toBeUndefined()
  })

  it('refuses an entry that has already been reversed', () => {
    const plan = buildReversal(entry(), periods, [], 'JE-2026-0009')
    expect(plan.blocked).toContain('JE-2026-0009')
  })

  /* Deactivate and archive are a standing instruction that the account takes
     nothing new, and the reader who gave it can lift it - so the refusal names
     the account rather than the rule. */
  it('refuses when a line lands on an account taken out of service', () => {
    const e = entry()
    e.lines[0].account = acct({ status: 'Inactive' })
    expect(buildReversal(e, periods, []).blocked).toContain('1000 Bank')
    e.lines[1].account = acct({ id: 'acc_2', accountNumber: '2000', accountName: 'Accruals', status: 'Archived' })
    expect(buildReversal(e, periods, []).blocked).toContain('2 accounts')
  })

  /* A control account's balance is the subledger's and retained earnings' is the
     close's, which is why a hand-written line cannot choose either. A reversal
     chooses nothing: it backs out lines already posted, and whatever put them
     there came through the same door. Refusing the mirror would trap the balance
     rather than protect it. */
  it('reverses through a control account and retained earnings', () => {
    const e = entry()
    e.lines[0].account = acct({ accountRole: 'Accounts Receivable' })
    e.lines[1].account = acct({ id: 'acc_2', accountNumber: '3900', accountName: 'Retained earnings', accountRole: 'Retained Earnings' })
    expect(buildReversal(e, periods, []).blocked).toBeUndefined()
  })

  it('refuses when there is no open period to post into', () => {
    expect(buildReversal(entry(), [shut], []).blocked).toContain('closed')
  })
})

/* The link between an entry and its mirror lives in the memo, so it travels
   everywhere an entry is read rather than only on the screen built to look for
   it. Both ends are read together: the hidden end is what stops the same entry
   being reversed twice. */
describe('reversalLinks', () => {
  const txn = (jeNumber: string, memo?: string) => ({ jeNumber, memo }) as Transaction
  const ledger = [
    txn('JE-2026-0001'),
    txn('JE-2026-0002', reversalMemo('JE-2026-0001', 'Accrue rent')),
    txn('JE-2026-0003', 'Nothing to do with reversals'),
  ]

  it('finds the entry that reverses this one', () => {
    expect(reversalLinks('JE-2026-0001', ledger)).toEqual({ reverses: undefined, reversedBy: 'JE-2026-0002' })
  })

  it('finds the entry this one reverses', () => {
    expect(reversalLinks('JE-2026-0002', ledger)).toEqual({ reverses: 'JE-2026-0001', reversedBy: undefined })
  })

  it('leaves an ordinary entry with neither', () => {
    expect(reversalLinks('JE-2026-0003', ledger)).toEqual({ reverses: undefined, reversedBy: undefined })
  })

  /* The memo carries the prior period declaration too, so the number has to be
     read off the front rather than off whatever the memo ends with. */
  it('reads the number out of a memo that carries more than the link', () => {
    const stamped = [txn('JE-2026-0004', `${reversalMemo('JE-2026-0001', 'Accrue rent')} · Prior period adjustment · PPA-ERR`)]
    expect(reversalLinks('JE-2026-0001', stamped).reversedBy).toBe('JE-2026-0004')
  })
})

/* Who posted an entry and when, and who changed it last - one answer for the
   entry's page and the grids' audit columns (design review, 2026-10-02). */
describe('who posted an entry, and when', () => {
  const t = (over: Partial<Transaction>) => ({ jeNumber: 'JE-2026-0001', date: '2026-09-03', memo: '', ...over }) as Transaction

  it('names whoever wrote it in the app, at the moment they did', () => {
    const made = t({ createdBy: 'Ahtisham Ahmad (You)', createdAt: '2026-10-02T09:12:00.000Z' })
    expect(entryCreatedBy(made)).toBe('Ahtisham Ahmad (You)')
    expect(entryCreatedAt(made)).toBe('2026-10-02T09:12:00.000Z')
  })

  it('gives a seeded entry the same stand-in every time, on its own date, in working hours', () => {
    const seeded = t({})
    expect(entryCreatedBy(seeded)).toBe(entryCreatedBy(t({})))
    const at = entryCreatedAt(seeded)
    expect(at.startsWith('2026-09-03T')).toBe(true)
    const hour = Number(at.slice(11, 13))
    expect(hour).toBeGreaterThanOrEqual(8)
    expect(hour).toBeLessThan(18)
  })

  it('never stamps a seeded entry dated today later than now', () => {
    const now = new Date(2026, 9, 3, 8, 30)
    expect(entryCreatedAt(t({ date: '2026-10-03' }), now) <= '2026-10-03T08:30:00').toBe(true)
  })

  it('reads a reversal as the last change to the entry it reverses, and nothing else as one', () => {
    const original = t({ jeNumber: 'JE-2026-0001' })
    const reversal = t({ jeNumber: 'JE-2026-0002', memo: reversalMemo('JE-2026-0001', ''), createdBy: 'Daniel Osei (Accountant)', createdAt: '2026-09-20T10:00:00' })
    const changes = entryChangesOf([original, reversal])
    expect(changes.get('JE-2026-0001')).toEqual({ by: 'Daniel Osei (Accountant)', at: '2026-09-20T10:00:00' })
    expect(changes.has('JE-2026-0002')).toBe(false)
  })
})

/* Why the picker greys an account out, for the option's hover (design review,
   2026-10-02 - no pills, a hover). Every greyed account has an answer, and an
   account that can be picked has none. */
describe('why an account cannot be picked', () => {
  const a = (over: Partial<Account>) => ({ accountName: 'Sales', status: 'Active', isPosting: true, ...over }) as Account
  it('says a summary adds up the accounts under it', () => {
    expect(unpostableReason(a({ accountName: 'Operating Revenue', isPosting: false }))).toBe(
      "Operating Revenue is a summary account. It adds up the accounts under it, so it can't take entries itself. Pick one of the accounts under it.")
  })
  it('says what the reader did to an account taken out of service', () => {
    expect(unpostableReason(a({ status: 'Archived' }))).toMatch(/is archived/)
    expect(unpostableReason(a({ status: 'Inactive' }))).toMatch(/is deactivated.*Turn it back on/)
  })
  it('sends a hand correction of retained earnings to the account that takes them', () => {
    const manual = { accountNumber: '32200', accountName: 'Retained Earnings Adjustments' } as Account
    expect(unpostableReason(a({ accountName: 'Retained Earnings', accountRole: 'Retained Earnings' }), manual))
      .toBe('Only the year-end close posts to Retained Earnings. Corrections made by hand go to 32200 Retained Earnings Adjustments.')
  })
  it('has nothing to say about an account that can be picked', () => {
    expect(unpostableReason(a({}))).toBeUndefined()
  })
})
