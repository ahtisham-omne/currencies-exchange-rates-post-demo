import { describe, expect, it } from 'vitest'
import {
  AVATAR_TINTS, DEFAULT_COMM_FILTERS, SYSTEM_AVATAR_TINT, avatarTint, countActiveCommFilters,
  filterThreads, initialsOf, isSystemSender, mailboxCounts, messageCountFor, previewOf,
  seededThreads, senderTint, threadsFor,
  type CommFilters, type CommMessage, type CommThread,
} from './comms'

const ANCHOR = '2026-03-14'

const filters = (patch: Partial<CommFilters> = {}): CommFilters => ({ ...DEFAULT_COMM_FILTERS, ...patch })

/* The threads are derived rather than stored, so what is worth pinning is what a
   reader would notice breaking: a record that says something different every
   time it is opened, or a thread that discusses an entry before it exists. */
describe('seededThreads', () => {
  it('says the same thing every time the same record is opened', () => {
    const a = seededThreads('acct-1000', 'account', '1000 Cash', ANCHOR)
    const b = seededThreads('acct-1000', 'account', '1000 Cash', ANCHOR)
    expect(a).toEqual(b)
  })

  it('leaves some records with nothing said about them', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `acct-${i}`)
    const empty = ids.filter(id => seededThreads(id, 'account', id, ANCHOR).length === 0)
    expect(empty.length).toBeGreaterThan(0)
    expect(empty.length).toBeLessThan(ids.length)
  })

  it('never discusses a record before its own date', () => {
    for (let i = 0; i < 40; i++) {
      for (const t of seededThreads(`je-${i}`, 'entry', `JE-2026-${i}`, ANCHOR)) {
        for (const m of t.messages) expect(m.dateIso >= ANCHOR).toBe(true)
      }
    }
  })

  it('reads forward inside every thread', () => {
    for (let i = 0; i < 40; i++) {
      for (const t of seededThreads(`acct-${i}`, 'account', `Account ${i}`, ANCHOR)) {
        const stamps = t.messages.map(m => m.dateIso)
        expect([...stamps].sort()).toEqual(stamps)
      }
    }
  })

  it('names the record it hangs on, and fills every placeholder', () => {
    const threads = seededThreads('acct-4000', 'account', '4000 Revenue', ANCHOR)
    expect(threads.some(t => t.subject.includes('4000 Revenue') || t.messages.some(m => m.body.includes('4000 Revenue')))).toBe(true)
    for (const t of threads) {
      expect(t.subject).not.toContain('{label}')
      for (const m of t.messages) expect(m.body).not.toContain('{label}')
    }
  })

  it('gives an email a recipient and a note none', () => {
    const all = Array.from({ length: 40 }, (_, i) => seededThreads(`acct-${i}`, 'account', `Account ${i}`, ANCHOR))
      .flat().flatMap(t => t.messages)
    for (const m of all) {
      if (m.channel === 'Email') expect(m.to.length).toBeGreaterThan(0)
      else expect(m.to).toBe('')
    }
  })

  it('files every thread against the kind of record it came from', () => {
    for (const t of seededThreads('acct-1075', 'account', '1075 Trade Receivables', ANCHOR)) {
      expect(t.entityType).toBe('Account')
    }
    for (const t of seededThreads('je-7', 'entry', 'JE-2026-007', ANCHOR)) {
      expect(t.entityType).toBe('Journal Entry')
    }
  })

  /* A thread row is denormalised so the list never walks the messages to render.
     The cost of that is these three fields, which have to keep agreeing with the
     messages under them. */
  it('describes itself with the last word actually said in it', () => {
    for (let i = 0; i < 30; i++) {
      for (const t of seededThreads(`acct-${i}`, 'account', `Account ${i}`, ANCHOR)) {
        const last = t.messages[t.messages.length - 1]
        expect(t.lastSender).toBe(last.from)
        expect(t.dateIso).toBe(last.dateIso)
        expect(t.bodyPreview).toBe(previewOf(last.body))
        expect(t.attachmentCount).toBe(t.messages.reduce((n, m) => n + (m.attachments?.length ?? 0), 0))
        expect(t.hasAttachments).toBe(t.attachmentCount > 0)
      }
    }
  })

  it('has nothing to say about a record with no id', () => {
    expect(seededThreads('', 'account', '', ANCHOR)).toEqual([])
  })
})

describe('threadsFor', () => {
  const seeded = () => seededThreads('acct-1000', 'account', '1000 Cash', ANCHOR)
  const reply = (threadId: string, dateIso: string): CommMessage => ({
    id: `w-${dateIso}`, threadId, channel: 'Note',
    from: 'Mahad Ejaz', fromEmail: 'mejaz@omnesoft.com', to: '', toEmail: '',
    timestamp: dateIso, dateIso, body: 'Written here.', isOutbound: true,
  })

  it('reads newest thread first', () => {
    const list = threadsFor([], [], 'acct-1000', 'account', '1000 Cash', ANCHOR)
    const stamps = list.map(t => t.dateIso)
    expect([...stamps].sort().reverse()).toEqual(stamps)
  })

  it('lands a reply in the thread it answers', () => {
    const target = seeded()[0]
    const list = threadsFor([], [reply(target.id, '2027-01-01T09:00:00.000Z')], 'acct-1000', 'account', '1000 Cash', ANCHOR)
    const found = list.find(t => t.id === target.id)!
    expect(found.messages).toHaveLength(target.messages.length + 1)
    expect(found.lastSender).toBe('Mahad Ejaz')
    expect(found.bodyPreview).toBe('Written here.')
  })

  it('reads a thread forward even when the reply predates what is already there', () => {
    const target = seeded()[0]
    const list = threadsFor([], [reply(target.id, '2020-01-01T09:00:00.000Z')], 'acct-1000', 'account', '1000 Cash', ANCHOR)
    const stamps = list.find(t => t.id === target.id)!.messages.map(m => m.dateIso)
    expect([...stamps].sort()).toEqual(stamps)
  })

  /* Answering a thread is reading it. A thread the reader has just written into
     still showing an unread dot is the bug this pins. */
  it('treats answering a thread as having read it', () => {
    const unread = seededThreads('acct-1075', 'account', '1075 Trade Receivables', ANCHOR).find(t => t.isUnread)
      ?? Array.from({ length: 40 }, (_, i) => seededThreads(`acct-${i}`, 'account', `Account ${i}`, ANCHOR)).flat().find(t => t.isUnread)!
    expect(unread.isUnread).toBe(true)
    const subjectId = unread.subjectId
    const list = threadsFor([], [reply(unread.id, '2027-01-01T09:00:00.000Z')], subjectId, 'account', unread.entityRef, ANCHOR)
    expect(list.find(t => t.id === unread.id)!.isUnread).toBe(false)
  })

  it('keeps another record\'s threads off this one', () => {
    const other: CommThread = { ...seeded()[0], id: 'other-thread', subjectId: 'acct-2000' }
    const list = threadsFor([other], [], 'acct-1000', 'account', '1000 Cash', ANCHOR)
    expect(list.every(t => t.subjectId === 'acct-1000')).toBe(true)
  })

  it('drops a reply whose thread is not on this record', () => {
    const list = threadsFor([], [reply('a-thread-elsewhere', '2027-01-01T09:00:00.000Z')], 'acct-1000', 'account', '1000 Cash', ANCHOR)
    expect(list.flatMap(t => t.messages).some(m => m.body === 'Written here.')).toBe(false)
  })

  /* The tab's badge counts messages, not threads: a record with one thread of
     nine messages has had nine things said about it. */
  it('counts messages rather than threads, because that is what was said', () => {
    const list = threadsFor([], [], 'acct-1000', 'account', '1000 Cash', ANCHOR)
    expect(messageCountFor(list)).toBe(list.reduce((n, t) => n + t.messages.length, 0))

    const chatty = Array.from({ length: 40 }, (_, i) =>
      threadsFor([], [], `acct-${i}`, 'account', `Account ${i}`, ANCHOR),
    ).find(l => l.some(t => t.messages.length > 1))!
    expect(messageCountFor(chatty)).toBeGreaterThan(chatty.length)
  })
})

describe('filterThreads', () => {
  const list = () => threadsFor([], [], 'acct-1000', 'account', '1000 Cash', ANCHOR)
  const run = (opts: Partial<Parameters<typeof filterThreads>[1]> = {}) =>
    filterThreads(list(), { mailbox: 'all', archived: [], filters: filters(), search: '', ...opts })

  it('reads newest first', () => {
    const stamps = run().map(t => t.dateIso)
    expect([...stamps].sort().reverse()).toEqual(stamps)
  })

  /* An archived thread appears in exactly one mailbox. One that kept turning up
     under All would make putting it away pointless. */
  it('shows an archived thread only under Archived', () => {
    const [first] = list()
    expect(run({ archived: [first.id] }).some(t => t.id === first.id)).toBe(false)
    expect(run({ mailbox: 'archived', archived: [first.id] }).map(t => t.id)).toEqual([first.id])
  })

  it('leaves Archived empty until something is archived', () => {
    expect(run({ mailbox: 'archived' })).toEqual([])
  })

  it('shows under Sent only what was written from here', () => {
    for (const t of run({ mailbox: 'sent' })) {
      expect(t.messages.some(m => m.isOutbound)).toBe(true)
    }
  })

  /* Whichever record happens to carry a note, so the test pins the rule rather
     than which template landed on account 1000. */
  it('narrows to a channel', () => {
    for (let i = 0; i < 120; i++) {
      const threads = threadsFor([], [], `acct-${i}`, 'account', `Account ${i}`, ANCHOR)
      if (!threads.some(t => t.messages.some(m => m.channel === 'Note'))) continue
      const notes = filterThreads(threads, {
        mailbox: 'all', archived: [], search: '', filters: filters({ channels: ['Note'] }),
      })
      expect(notes.length).toBeGreaterThan(0)
      expect(notes.every(t => t.messages.some(m => m.channel === 'Note'))).toBe(true)
      return
    }
    throw new Error('no seeded record carried a note to narrow to')
  })

  it('splits a person\'s writing from the system\'s', () => {
    const person = run({ filters: filters({ writtenBy: ['user'] }) }).length
    const system = run({ filters: filters({ writtenBy: ['automated'] }) }).length
    expect(person + system).toBe(run().length)
    expect(system).toBeGreaterThan(0)
  })

  it('splits on who spoke last', () => {
    const mine = run({ filters: filters({ lastWord: ['me'] }) }).length
    const theirs = run({ filters: filters({ lastWord: ['other'] }) }).length
    expect(mine + theirs).toBe(run().length)
  })

  it('reads an empty choice as either, not as neither', () => {
    expect(run({ filters: filters({ status: [] }) }).length).toBe(run().length)
    expect(run({ filters: filters({ status: ['unread', 'read'] }) }).length).toBe(run().length)
  })

  it('splits read from unread without losing a thread between them', () => {
    const unread = run({ filters: filters({ status: ['unread'] }) }).length
    const read = run({ filters: filters({ status: ['read'] }) }).length
    expect(unread + read).toBe(run().length)
  })

  it('splits on attachments the same way', () => {
    const withFiles = run({ filters: filters({ hasAttachments: true }) })
    const without = run({ filters: filters({ hasAttachments: false }) })
    expect(withFiles.length + without.length).toBe(run().length)
    expect(withFiles.every(t => t.hasAttachments)).toBe(true)
  })

  it('honours a date range against the thread\'s last word', () => {
    const all = run()
    const cutoff = all[Math.floor(all.length / 2)].dateIso.slice(0, 10)
    for (const t of run({ filters: filters({ dateFrom: cutoff }) })) {
      expect(t.dateIso.slice(0, 10) >= cutoff).toBe(true)
    }
    for (const t of run({ filters: filters({ dateTo: cutoff }) })) {
      expect(t.dateIso.slice(0, 10) <= cutoff).toBe(true)
    }
  })

  /* Searching correspondence and being shown only the threads whose one-line
     preview happens to hold the word is the behaviour readers call broken. */
  it('finds a word buried in a message the row does not show', () => {
    // Whichever record happens to carry a thread long enough to have a message
    // its preview cannot show. Naming one would pin the seed rather than the rule.
    for (let i = 0; i < 40; i++) {
      const threads = threadsFor([], [], `acct-${i}`, 'account', `Account ${i}`, ANCHOR)
      const target = threads.find(t => t.messages.length > 1)
      if (!target) continue
      const word = target.messages[0].body.split(/\s+/)
        .find(w => w.length > 6 && !target.bodyPreview.includes(w))
      if (!word) continue
      const found = filterThreads(threads, {
        mailbox: 'all', archived: [], filters: filters(), search: word,
      })
      expect(found.some(t => t.id === target.id)).toBe(true)
      return
    }
    throw new Error('no seeded record carried a thread with a hidden message to search')
  })

  it('matches a sender and a record, not only a subject', () => {
    const [first] = list()
    expect(run({ search: first.lastSender }).some(t => t.id === first.id)).toBe(true)
    expect(run({ search: '1000 Cash' }).length).toBe(run().length)
  })

  it('ignores case and surrounding space', () => {
    const [first] = list()
    expect(run({ search: `  ${first.subject.toUpperCase()}  ` }).some(t => t.id === first.id)).toBe(true)
  })

  it('finds nothing for a word nobody wrote', () => {
    expect(run({ search: 'zzzznothinghere' })).toEqual([])
  })

  it('narrows to the record the reader picked', () => {
    const [first] = list()
    expect(run({ filters: filters({ records: [first.entityRef] }) }).length).toBe(run().length)
    expect(run({ filters: filters({ records: ['ACC-9999'] }) })).toEqual([])
  })

  /* The keyword box and the list's search box narrow the same way, and the
     reader can be using both at once. */
  it('applies the keyword box the same way as the search box', () => {
    const [first] = list()
    const word = first.subject.split(/\s+/)[0]
    expect(run({ filters: filters({ keyword: word }) }).map(t => t.id))
      .toEqual(run({ search: word }).map(t => t.id))
    expect(run({ filters: filters({ keyword: 'zzzznothinghere' }) })).toEqual([])
  })

  it('clears automated mail out of the list when asked', () => {
    // Whichever record happens to carry one, so the test pins the rule and not
    // which template landed where.
    for (let i = 0; i < 120; i++) {
      const threads = threadsFor([], [], `acct-${i}`, 'account', `Account ${i}`, ANCHOR)
      if (!threads.some(t => t.isAutomated)) continue
      const opts = { mailbox: 'all' as const, archived: [], search: '' }
      const hidden = filterThreads(threads, { ...opts, filters: filters({ hideAutomated: true }) })
      expect(hidden.every(t => !t.isAutomated)).toBe(true)
      expect(hidden.length).toBeLessThan(threads.length)
      return
    }
    throw new Error('no seeded record carried automated mail to hide')
  })
})

describe('mailboxCounts', () => {
  const list = () => threadsFor([], [], 'acct-1000', 'account', '1000 Cash', ANCHOR)

  /* A count that disagreed with what clicking the pill shows is worse than no
     count, so it is computed by the same function that builds the list. */
  it('says what clicking the pill would actually show', () => {
    const opts = { archived: [] as string[], filters: filters(), search: '' }
    const counts = mailboxCounts(list(), opts)
    for (const mailbox of ['all', 'sent', 'archived'] as const) {
      expect(counts[mailbox]).toBe(filterThreads(list(), { ...opts, mailbox }).length)
    }
  })

  it('counts with the filters applied, so a pill never over-promises', () => {
    const opts = { archived: [] as string[], filters: filters({ dateFrom: '2099-01-01' }), search: '' }
    expect(mailboxCounts(list(), opts).all).toBe(0)
    expect(mailboxCounts(list(), { ...opts, filters: filters() }).all).toBeGreaterThan(0)
  })

  /* All four of the source's mailboxes, Unmatched included. It reads zero on a
     record whose mail is all filed, which is the honest answer rather than a
     reason to remove the place: a thread can arrive without a record to hang
     on, and this is where it waits. */
  it('offers the source\'s four mailboxes', () => {
    const counts = mailboxCounts(list(), { archived: [], filters: filters(), search: '' })
    expect(Object.keys(counts).sort()).toEqual(['all', 'archived', 'sent', 'unmatched'])
  })

  it('keeps a filed thread out of Unmatched', () => {
    const counts = mailboxCounts(list(), { archived: [], filters: filters(), search: '' })
    expect(counts.all).toBeGreaterThan(0)
    expect(counts.unmatched).toBe(0)
  })

  it('shows an unlinked thread in Unmatched and still under All', () => {
    const [first] = list()
    const orphan: CommThread = { ...first, id: 'orphan', entityType: 'Other', entityRef: 'Unmatched' }
    const opts = { archived: [] as string[], filters: filters(), search: '' }
    expect(filterThreads([orphan], { ...opts, mailbox: 'unmatched' }).map(t => t.id)).toEqual(['orphan'])
    // All is every active thread, so unlinking does not hide the thread while
    // the reader decides where it belongs. Unmatched is a second place to find
    // it, not a place it disappears to.
    expect(filterThreads([orphan], { ...opts, mailbox: 'all' }).map(t => t.id)).toEqual(['orphan'])
    expect(filterThreads(list(), { ...opts, mailbox: 'unmatched' })).toEqual([])
  })
})

describe('countActiveCommFilters', () => {
  it('reads nothing set as nothing set', () => {
    expect(countActiveCommFilters(DEFAULT_COMM_FILTERS)).toBe(0)
  })

  it('counts a date range once, because the reader set one thing', () => {
    expect(countActiveCommFilters(filters({ dateFrom: '2026-01-01' }))).toBe(1)
    expect(countActiveCommFilters(filters({ dateFrom: '2026-01-01', dateTo: '2026-06-30' }))).toBe(1)
  })

  it('counts a dimension once however many values it holds', () => {
    expect(countActiveCommFilters(filters({ status: ['unread'] }))).toBe(1)
    expect(countActiveCommFilters(filters({ status: ['unread', 'read'] }))).toBe(1)
  })

  it('counts false as set, because it is a choice', () => {
    expect(countActiveCommFilters(filters({ hasAttachments: false }))).toBe(1)
  })

  it('adds up across dimensions', () => {
    expect(countActiveCommFilters(filters({
      channels: ['Email'], writtenBy: ['user'], status: ['unread'],
      lastWord: ['me'], hasAttachments: true, dateFrom: '2026-01-01',
    }))).toBe(6)
  })

  it('reads a blank keyword as nothing set', () => {
    expect(countActiveCommFilters(filters({ keyword: '   ' }))).toBe(0)
    expect(countActiveCommFilters(filters({ keyword: 'accrual' }))).toBe(1)
  })

  /* Nine dimensions, the source's whole set. Ten fields, because the date range
     is two the reader sets as one thing. */
  it('counts to nine with everything set, so no dimension has gone missing', () => {
    expect(countActiveCommFilters({
      records: ['ACC-1000'], channels: ['Note', 'Email'], writtenBy: ['user'], status: ['read'],
      lastWord: ['other'], hasAttachments: true, keyword: 'accrual', hideAutomated: true,
      dateFrom: '2026-01-01', dateTo: '2026-12-31',
    })).toBe(9)
    expect(Object.keys(DEFAULT_COMM_FILTERS).sort()).toEqual([
      'channels', 'dateFrom', 'dateTo', 'hasAttachments', 'hideAutomated',
      'keyword', 'lastWord', 'records', 'status', 'writtenBy',
    ])
  })
})

describe('senders', () => {
  it('gives a sender the same colour every time', () => {
    expect(avatarTint('Ayesha Khan')).toEqual(avatarTint('Ayesha Khan'))
  })

  /* Blue is out of the pool on purpose: a selected row is filled brand blue, so
     a blue avatar would dissolve into it, and reserving blue is what lets the
     system's own mail read as system-issued. */
  it('keeps the system tint out of the pool it reserves it from', () => {
    expect(AVATAR_TINTS).not.toContain(SYSTEM_AVATAR_TINT)
    expect(AVATAR_TINTS.some(t => t.bg === SYSTEM_AVATAR_TINT.bg)).toBe(false)
  })

  it('marks the system\'s mailbox as the system, by name or by address', () => {
    expect(isSystemSender('Omne System', 'no-reply@omnesoft.com')).toBe(true)
    expect(isSystemSender('Omne')).toBe(true)
    expect(isSystemSender('Someone Else', 'no-reply@omnesoft.com')).toBe(true)
    expect(isSystemSender('Ayesha Khan', 'ayesha.khan@omne.example')).toBe(false)
    expect(isSystemSender()).toBe(false)
  })

  it('tints the system\'s mail as the system and everyone else from the pool', () => {
    expect(senderTint('Omne System', 'no-reply@omnesoft.com')).toEqual(SYSTEM_AVATAR_TINT)
    expect(AVATAR_TINTS).toContain(senderTint('Ayesha Khan', 'ayesha.khan@omne.example'))
  })

  it('reads initials off a name, dropping the role after it', () => {
    expect(initialsOf('Ayesha Khan')).toBe('AK')
    expect(initialsOf('Daniel Osei (Accountant)')).toBe('DO')
    expect(initialsOf('Omne')).toBe('O')
    expect(initialsOf('  ')).toBe('?')
  })
})

describe('previewOf', () => {
  it('takes the first line, because that is the line the row has room for', () => {
    expect(previewOf('First line.\nSecond line.')).toBe('First line.')
  })

  it('clips a long line rather than letting it push the row', () => {
    const preview = previewOf('x'.repeat(400))
    expect(preview).toHaveLength(140)
    expect(preview.endsWith('…')).toBe(true)
  })

  it('leaves a line that fits alone', () => {
    expect(previewOf('Short enough.')).toBe('Short enough.')
  })
})
