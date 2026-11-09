/* Ported from the reporting module's comms cluster (its recordDirectory.ts).

   ModifyTagModal is a three-step picker: module -> owning record -> sub-record.
   In the source the middle step is a report template and the third is a report
   generated from it. This module's own two-level hierarchy is an account and the
   journal entries posted to it, so that is what the steps read.

   The records are passed in rather than pulled off the store here, so the
   directory stays hook-free and a caller cannot end up offering a record the
   chart does not hold. */
import { ACCOUNT_TYPE_META, type Account, type JournalEntry, type Transaction } from '../../types'
import { fmtDate } from '../../lib/utils'

/** The middle step: a record that can own correspondence. */
export interface RecordOwner {
  /** The record's own id, which is what a route and a thread's subject use. */
  id: string
  /** Prefixed reference a thread is filed under (see `refOf` in lib/comms). */
  ref: string
  /** What the picker shows as the row title. */
  name: string
  /** Secondary line: enough to tell two similar rows apart. */
  meta: string
  /** The record's own status, shown as a pill beside its reference. */
  status: string
}

/** The third step: a specific record under an owner. */
export interface RecordSubRecord {
  id: string
  label: string
  status?: string
  /** The "No record" sentinel prepended to every sub-list. Renders with
   *  distinct styling and an alternate secondary line, exactly as the source
   *  did - it files the thread against the OWNER without pinning it to one
   *  specific record underneath. */
  isNoRecord?: boolean
}

/** Which sub-list to build under an owner. */
export type RecordOwnerKind = 'account' | 'entry'

/** Everything the picker can offer, read off the store by the caller. */
export interface RecordSource {
  accounts: Account[]
  journalEntries: JournalEntry[]
  transactions: Transaction[]
}

/** The chart, the owners that actually have a second level under them. */
export function accountOwners(accounts: Account[]): RecordOwner[] {
  return accounts.map(a => ({
    id: a.id,
    ref: `ACC-${a.accountNumber}`,
    name: a.accountName,
    meta: `${ACCOUNT_TYPE_META[a.accountType].label} · ${a.glAccountType}`,
    status: a.status,
  }))
}

/* An entry is known here the way the General Ledger knows it: by its number,
   off the postings that carry it. Entries created in this session may have no
   postings yet, so both sides are read and the record wins over the posting. */
export function entryOwners({ journalEntries, transactions }: Pick<RecordSource, 'journalEntries' | 'transactions'>): RecordOwner[] {
  const byNumber = new Map<string, RecordOwner & { date: string }>()
  for (const t of transactions) {
    if (byNumber.has(t.jeNumber)) continue
    byNumber.set(t.jeNumber, {
      id: t.jeNumber,
      ref: t.jeNumber,
      name: t.memo || t.description,
      meta: `${t.source} · ${fmtDate(t.date)}`,
      status: 'Posted',
      date: t.date,
    })
  }
  for (const e of journalEntries) {
    byNumber.set(e.reference, {
      id: e.reference,
      ref: e.reference,
      name: e.description,
      meta: `Manual · ${fmtDate(e.date)}`,
      status: e.status,
      date: e.date,
    })
  }
  return [...byNumber.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ date: _date, ...owner }) => owner)
}

/** Owners for a module key, matching TAG_MODULES in ModifyTagModal. */
export function ownersForModule(moduleKey: string, src: RecordSource): RecordOwner[] {
  switch (moduleKey) {
    case 'chart-of-accounts': return accountOwners(src.accounts)
    case 'journal-entries': return entryOwners(src)
    /* The source synthesised eight fictional rows for a module it held no data
       for. Both of this module's keys have real records, so an unknown key has
       nothing honest to offer. */
    default: return []
  }
}

/**
 * Sub-records under one owner, with the "No record" sentinel first - the
 * source's contract, unchanged.
 */
export function getOwnerSubRecords(owner: RecordOwner, kind: RecordOwnerKind, src: RecordSource): RecordSubRecord[] {
  const noRecord: RecordSubRecord = {
    id: owner.ref,
    label: 'No record',
    isNoRecord: true,
  }
  if (kind !== 'entry') return [noRecord]

  // Every entry that posted to this account, newest first.
  const seen = new Set<string>()
  const runs: RecordSubRecord[] = []
  for (const t of [...src.transactions].sort((a, b) => b.date.localeCompare(a.date))) {
    if (t.accountId !== owner.id || seen.has(t.jeNumber)) continue
    seen.add(t.jeNumber)
    runs.push({ id: t.jeNumber, label: `${t.memo || t.description} · ${fmtDate(t.date)}`, status: 'Posted' })
  }
  for (const e of src.journalEntries) {
    if (seen.has(e.reference) || !e.lines.some(l => l.accountId === owner.id)) continue
    seen.add(e.reference)
    runs.unshift({ id: e.reference, label: `${e.description} · ${fmtDate(e.date)}`, status: e.status })
  }
  return [noRecord, ...runs]
}
