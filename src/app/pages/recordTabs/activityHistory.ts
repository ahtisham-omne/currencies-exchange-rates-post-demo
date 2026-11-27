// Each record's Activity Logs entries, built from what the app already holds
// about it and written in the words of the BA's use cases ("Activity Logs:
// Currency & Exchange Rates", 16 Nov 2026), so every log carries a history and
// every page agrees with its log:
//   a currency: its status changes (its audit log, the initial setup left out:
//     currencies are preloaded, so a log opens on the first change), and the
//     notes and files on it;
//   an exchange rate: every daily mid-market sync (Decision 1), its corporate
//     rate's changes (the rate audit that Rate history reads), and the notes and
//     files on its two views.
// The kinds and wording are the ones the showcase uses (components/activity-log).
// A change made in the prototype lands here as it is made; a note or file taken
// off keeps the entry that added it, since entries are kept.
import type { ActivityEvent, FxEvent, FxRow } from '../../components/activity-log/activity-data'
import type { AttachmentFile } from '../../coa/components/AttachmentsTab'
import { cleanName } from '../../coa/components/Avatar'
import type { RecordNote } from '../../coa/lib/recordStore'
import type { Currency } from '../../data/currencies'
import { API_PROVIDER, LAST_SYNC, type RateAuditEntry } from '../../data/exchangeRates'
import { fmtRate } from '../exchange/rateModel'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** "March 2, 2026" from an ISO day. */
const longDate = (day: string) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}, ${day.slice(0, 4)}`
/** "May 1" from an ISO day. */
const shortDate = (day: string) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`
/** The company day (Pakistan, UTC+5) a moment falls on. */
const companyDay = (iso: string) => new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString().slice(0, 10)

/* ── Notes and files, on either kind of record ─────────────────────────── */

/** Use cases C3 and E7: one note, its own words beneath. A corporate rate's own
 *  note, carried onto the Notes tab, is written on the entry that set the rate. */
function noteAdded(note: RecordNote): FxEvent | null {
  if (note.tag) return null
  return {
    id: `note-${note.id}`, actor: cleanName(note.author), timestamp: note.at, kind: 'fx',
    verb: 'added a note', rows: [{ kind: 'note', text: note.text }],
    filter: 'added', changed: 'notes',
  }
}

/** Use cases C6 and E9: the shared attachment entry, one file each. */
function fileAdded(file: AttachmentFile): ActivityEvent {
  return {
    id: `file-${file.id}`, actor: cleanName(file.uploadedBy), timestamp: file.date, kind: 'attachmentsChanged',
    added: [{ name: file.name, size: file.size }], removed: [],
  }
}

const notesAndFiles = (notes: RecordNote[], files: AttachmentFile[]): ActivityEvent[] => [
  ...notes.map(noteAdded).filter((e): e is FxEvent => e !== null),
  ...files.map(fileAdded),
]

/* ── A currency ──────────────────────────────────────────────────────────── */

/** Use cases C1 and C2 from the currency's audit log. The System's own change
 *  (a currency withdrawn, as the lev was for the euro) says what set it off
 *  beside the time; a person's carries the status pair alone. */
function statusChanges(c: Currency): FxEvent[] {
  return c.auditLog
    .filter(a => (a.action === 'Activated' || a.action === 'Deactivated') && !/initiali[sz]ation/i.test(a.reason))
    .map(a => {
      const on = a.action === 'Activated'
      const actor = cleanName(a.changedBy)
      return {
        id: `status-${c.code}-${a.dateTime}-${a.action}`, actor, timestamp: a.dateTime, kind: 'fx' as const,
        verb: on ? 'activated this currency' : 'deactivated this currency',
        ...(actor === 'System' && a.reason ? { trigger: a.reason } : {}),
        rows: [{ kind: 'status' as const, before: on ? 'Inactive' : 'Active', after: on ? 'Active' : 'Inactive' }],
        filter: 'updated' as const, changed: 'status' as const,
      }
    })
}

export function currencyHistory(c: Currency, notes: RecordNote[], files: AttachmentFile[]): ActivityEvent[] {
  return [...statusChanges(c), ...notesAndFiles(notes, files)]
}

/* ── An exchange rate ────────────────────────────────────────────────────── */

/** Use case E2: every daily sync that moved the rate, at the provider's sync
 *  time. A failed sync writes nothing, so a pair whose last sync failed ends a
 *  day early, as its rate does. */
function syncs(code: string, series: { date: string; mid: number }[]): FxEvent[] {
  const time = LAST_SYNC.slice(10)
  const out: FxEvent[] = []
  for (let i = 1; i < series.length; i++) {
    const before = series[i - 1].mid
    const after = series[i].mid
    if (before === after) continue
    out.push({
      id: `sync-${code}-${series[i].date}`, actor: 'System', timestamp: `${series[i].date}${time}`, kind: 'fx',
      verb: 'updated the daily market rate', trigger: 'daily sync',
      rows: [
        { kind: 'pair', field: 'Daily market rate', before: fmtRate(before), after: fmtRate(after) },
        { kind: 'sentence', parts: [{ t: 'Rates from ' }, { v: API_PROVIDER }] },
      ],
      filter: 'updated', changed: 'midMarketRate',
    })
  }
  return out
}

/** "1.64% below the daily market rate of 283.6509". */
function varianceRow(rate: number, mid: number | null | undefined): FxRow[] {
  if (!mid) return []
  const pct = ((rate - mid) / mid) * 100
  return [{ kind: 'sentence', parts: [{ v: `${Math.abs(pct).toFixed(2)}%` }, { t: ` ${pct < 0 ? 'below' : 'above'} the daily market rate of ` }, { v: fmtRate(mid) }] }]
}

const noteRow = (text: string): FxRow[] => (text.trim() ? [{ kind: 'note', text: text.trim() }] : [])

/** Use cases E1, E3, E4, E5, E10 and E11 from the corporate rate's audit. The
 *  mid-market rate "at that moment" is the one the change recorded, or else
 *  that day's sync. A scheduled rate taking effect (E6) waits for its shape. */
function rateChanges(code: string, audit: RateAuditEntry[], midOn: (day: string) => number | undefined): FxEvent[] {
  return audit.filter(e => e.sourceCurrency === code).map((e): FxEvent => {
    const base = { id: `rate-${e.id}`, actor: cleanName(e.user), timestamp: e.dateTime, kind: 'fx' as const }
    const saved = companyDay(e.dateTime)
    const mid = midOn(saved) ?? e.midRate
    const rate = e.newValue ?? e.oldValue ?? 0
    const pair = (): FxRow[] => (e.oldValue != null && e.newValue != null
      ? [{ kind: 'pair', field: 'Corporate rate', before: fmtRate(e.oldValue), after: fmtRate(e.newValue) }]
      : [])
    switch (e.action) {
      case 'Created':
        return {
          ...base, verb: 'added a corporate rate', value: { text: fmtRate(rate), middot: true },
          rows: [
            ...(e.effectiveDate ? [{ kind: 'sentence' as const, parts: [{ t: 'Effective ' }, { v: longDate(e.effectiveDate) }] }] : []),
            ...varianceRow(rate, mid),
            ...noteRow(e.reason),
          ],
          filter: 'added', changed: 'corporateRate',
        }
      case 'Updated':
        // An effective date before the day it was saved leads with that date.
        if (e.effectiveDate && e.effectiveDate < saved) {
          return {
            ...base, verb: 'updated the corporate rate',
            rows: [
              { kind: 'sentence', parts: [{ t: 'Effective from ' }, { v: longDate(e.effectiveDate) }, { t: ', before the day it was saved' }] },
              { kind: 'sentence', parts: [{ t: 'Transactions since then may have used the old rate' }] },
              ...pair(),
              ...noteRow(e.reason),
            ],
            filter: 'updated', changed: 'corporateRate',
          }
        }
        return {
          ...base, verb: 'updated the corporate rate',
          rows: [...pair(), ...varianceRow(rate, mid), ...noteRow(e.reason)],
          filter: 'updated', changed: 'corporateRate',
        }
      case 'Scheduled': {
        const day = e.effectiveDate ?? saved
        return {
          ...base, verb: 'scheduled a corporate rate for', value: { text: longDate(day), middot: false },
          rows: [
            { kind: 'sentence', parts: [{ t: 'Corporate rate set to ' }, { v: fmtRate(rate) }] },
            ...varianceRow(rate, mid),
            { kind: 'sentence', parts: [{ t: 'The current rate stays in effect until midnight, company time, on ' }, { v: shortDate(day) }] },
            ...noteRow(e.reason),
          ],
          filter: 'added', changed: 'corporateRate',
        }
      }
      case 'Archived':
        return {
          ...base, verb: 'archived the corporate rate', value: { text: fmtRate(rate), middot: true },
          rows: [{ kind: 'status', before: 'Active', after: 'Archived' }],
          filter: 'updated', changed: 'corporateRate',
        }
      default: // Restored
        return {
          ...base, verb: 'restored the corporate rate', value: { text: fmtRate(rate), middot: true },
          rows: [{ kind: 'status', before: 'Archived', after: 'Active' }],
          filter: 'updated', changed: 'corporateRate',
        }
    }
  })
}

export function exchangeRateHistory(
  code: string,
  series: { date: string; mid: number }[],
  audit: RateAuditEntry[],
  notes: RecordNote[],
  files: AttachmentFile[],
): ActivityEvent[] {
  const midByDay = new Map(series.map(p => [p.date, p.mid]))
  return [...syncs(code, series), ...rateChanges(code, audit, day => midByDay.get(day)), ...notesAndFiles(notes, files)]
}

/** Each entry once (by id), newest first. */
export function mergeActivity(...lists: ActivityEvent[][]): ActivityEvent[] {
  const byId = new Map<string, ActivityEvent>()
  for (const list of lists) for (const e of list) if (!byId.has(e.id)) byId.set(e.id, e)
  return [...byId.values()].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
}

/** Every note or file a record has carried: what it opens with, and what was
 *  added in this session, once each. */
export function everSeen<T extends { id: string | number }>(seeded: T[], ...current: (T[] | undefined)[]): T[] {
  const byId = new Map<string | number, T>()
  for (const item of seeded) byId.set(item.id, item)
  for (const list of current) for (const item of list ?? []) if (!byId.has(item.id)) byId.set(item.id, item)
  return [...byId.values()]
}
