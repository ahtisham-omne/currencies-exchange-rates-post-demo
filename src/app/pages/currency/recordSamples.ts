// What a currency opens with on its record tabs, the way CoA seeds an account's
// (lib/notes accountNotes, lib/seed seedAccountAttachments, the HistoryTab feed):
// a few notes, a handful of files and some history, derived from the currency
// itself so it reads the same on every visit. Never stored: only what the reader
// adds or takes off is kept (lib/recordStore). The real audit log stays the
// source of truth for status changes and is merged in by `currencyActivity`.
import type { ActivityFeedItem } from '../../coa/components/ActivityFeed'
import type { AttachmentFile } from '../../coa/components/AttachmentsTab'
import { cleanName } from '../../coa/components/Avatar'
import { hashSeed } from '../../coa/lib/hashSeed'
import type { RecordNote } from '../../coa/lib/recordStore'
import { fmtDate } from '../../coa/lib/utils'
import type { Currency } from '../../data/currencies'
import { BASE_CURRENCY, SEED_STANDARD_RATES } from '../../data/exchangeRates'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/* Who writes them: the people CoA's own notes and history name. */
export const CONTROLLER = 'Ayesha Khan (Controller)'
export const ACCOUNTANTS = ['Marcus Lee (Accountant)', 'Daniel Osei (Accountant)']
const AUTHORS = [CONTROLLER, ...ACCOUNTANTS]

/** A moment `days` before now, in working hours. */
export const daysAgo = (days: number, hour: number, minute: number, now = new Date()) => {
  const t = new Date(now)
  t.setDate(t.getDate() - days)
  t.setHours(hour, minute, 0, 0)
  return t
}

/** Distinct picks from a list, chosen by a seed. */
export function pick<T>(list: T[], seed: number, count: number): T[] {
  const out: T[] = []
  for (let i = 0; out.length < Math.min(count, list.length) && i < list.length * 8; i++) {
    const item = list[(seed + i * 7) % list.length]
    if (!out.includes(item)) out.push(item)
  }
  return out
}

/** An activity entry with the moment it happened, so real and sample history
 *  can be merged and read newest first. */
export type DatedActivity = ActivityFeedItem & { at: string }

/** Newest first, then printed the way CoA's feed prints them (date only). */
export function feedOf(items: DatedActivity[]): ActivityFeedItem[] {
  return [...items]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ at, ...item }) => ({ ...item, date: fmtDate(at) }))
}

/* ───────────────────────────── Notes ───────────────────────────── */

type Values = { code: string; name: string; month: string; places: string }
type Line = (v: Values) => string

const CURRENCY_LINES: Line[] = [
  v => `Treasury confirmed ${v.code} stays on the approved list for next quarter. No change to the corporate rate review cycle.`,
  v => `${v.code} rounds to ${v.places}. Supplier invoices quoted finer than that are rounded on entry, and the difference posts to FX rounding.`,
  v => `Bank confirmed ${v.code} settlements at the corporate rate from ${v.month}. The confirmation letter is in Attachments.`,
  v => `Check the ${v.code} variance before the month-end revaluation. The mid-market rate has been moving more than usual.`,
  v => `${v.name} is in scope for the year-end audit. Keep the rate approvals in Attachments.`,
  v => `Keep ${v.code} active while there are open documents in it. Deactivate only once the last one has settled.`,
]

const BASE_LINES: Line[] = [
  v => `${v.code} is the base currency. Every rate in the library is quoted against it, so it cannot be deactivated.`,
  v => `Closing rates for ${v.month} agreed to the bank before the revaluation ran.`,
  v => `${v.code} rounds to ${v.places} on every document, including converted amounts.`,
  () => 'Changing the base currency means restating every corporate rate. Raise it with the controller first.',
]

/* Hand-written for the currencies the demo leans on, so their notes read as
   theirs rather than as any currency's. */
const WRITTEN: Record<string, { id: string; text: string; author: string; days: number; hour: number; minute: number }[]> = {
  USD: [
    { id: 'note_usd_3', text: 'Treasury moved the USD corporate rate review to the first working day of each month. Update the pair on that day, not the calendar first.', author: CONTROLLER, days: 3, hour: 9, minute: 15 },
    { id: 'note_usd_2', text: 'Two USD supplier payments went out at the bank rate, 0.4% off our corporate rate. The difference is booked to FX gain or loss.', author: ACCOUNTANTS[0], days: 9, hour: 11, minute: 20 },
    { id: 'note_usd_1', text: 'Signed settlement instructions for the USD account are in Attachments, with the bank confirmation letter.', author: CONTROLLER, days: 40, hour: 16, minute: 5 },
  ],
  AED: [
    { id: 'note_aed_2', text: 'AED was deactivated for two months last year while the Dubai office had no open documents. Reactivated once the new supplier contract was signed.', author: CONTROLLER, days: 12, hour: 10, minute: 40 },
    { id: 'note_aed_1', text: 'AED is pegged to the US dollar, so its mid-market rate tracks USD closely. A large AED move usually means USD moved.', author: ACCOUNTANTS[0], days: 31, hour: 14, minute: 30 },
  ],
}

const placesOf = (dp: number) => (dp === 0 ? 'whole units, with no decimal places' : `${dp} decimal ${dp === 1 ? 'place' : 'places'}`)

/** The notes a currency opens with. */
export function currencyNotes(c: Currency | undefined, now = new Date()): RecordNote[] {
  if (!c) return []
  const written = WRITTEN[c.code]
  if (written) {
    return written.map(w => ({ id: w.id, text: w.text, author: w.author, at: daysAgo(w.days, w.hour, w.minute, now).toISOString() }))
  }
  // Higher bits: codes differ in their last letters, and FNV's low bits
  // follow those letters too closely to spread the picks.
  const h = hashSeed(`currency:${c.code}`) >>> 8
  const lines = c.isBaseCurrency ? BASE_LINES : CURRENCY_LINES
  return pick(lines, h, 2 + (h % 3)).map((line, i) => {
    const s = hashSeed(`currency:${c.code}:${i}`)
    const at = daysAgo(1 + i * 9 + (s % 8), 9 + (s % 8), (s >>> 3) % 60, now)
    return {
      id: `note_${c.code.toLowerCase()}_${i}`,
      text: line({ code: c.code, name: c.name, month: MONTHS[at.getMonth()], places: placesOf(c.decimalPlaces) }),
      author: AUTHORS[(s >>> 5) % AUTHORS.length],
      at: at.toISOString(),
    }
  })
}

/* ─────────────────────────── Attachments ─────────────────────────── */

/** `YYYY-MM-DD` for `d` days before today. */
export const dayMinus = (d: number, now = new Date()) => {
  const t = new Date(now)
  t.setDate(t.getDate() - d)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/** A size that reads like the file it is on, stable per name. */
export function sizeOf(name: string, minKb: number, maxKb: number): string {
  const kb = minKb + (hashSeed(name) % (maxKb - minKb + 1))
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}

/** The date a record's sample correspondence is written around (CommsTab's
 *  `anchorIso`): six weeks back, to the day, so threads and chat read as recent
 *  history and the value holds still for the whole day. In the afternoon, as a
 *  record's own timestamp would be, so the mail is not stamped at midnight. */
export const commsAnchorIso = (now = new Date()) => `${dayMinus(45, now)}T13:08:00.000Z`

type FileSpec = { name: string; type: AttachmentFile['type']; kb: [number, number]; days: number; time: string; by: string }

/** The files a currency opens with: spread across the five kinds the card grid
 *  draws differently, like CoA's seeded accounts. Every one opens: the kit's
 *  dummyAttachment builds the document from this metadata. */
export function currencyAttachments(c: Currency | undefined, now = new Date()): AttachmentFile[] {
  if (!c) return []
  const h = hashSeed(`files:${c.code}`) >>> 8
  const year = now.getFullYear()
  const specs: FileSpec[] = c.isBaseCurrency
    ? [
        { name: `Base currency resolution - board minutes.pdf`, type: 'pdf', kb: [900, 1600], days: 210, time: '14:00', by: CONTROLLER },
        { name: `${c.code} closing rates ${year}.xlsx`, type: 'xlsx', kb: [40, 120], days: 21, time: '15:10', by: CONTROLLER },
        { name: `State Bank rate notice.pdf`, type: 'pdf', kb: [200, 420], days: 96, time: '11:20', by: ACCOUNTANTS[0] },
        { name: `Revaluation policy.rtf`, type: 'doc', kb: [60, 110], days: 140, time: '10:05', by: ACCOUNTANTS[0] },
        { name: `Rate board - photo.jpg`, type: 'img', kb: [500, 1200], days: 63, time: '13:45', by: ACCOUNTANTS[1] },
      ]
    : [
        { name: `${c.code} corporate rate approval.pdf`, type: 'pdf', kb: [900, 1600], days: 18 + (h % 20), time: '14:00', by: CONTROLLER },
        { name: `Bank settlement confirmation - ${c.code}.pdf`, type: 'pdf', kb: [200, 420], days: 96, time: '11:20', by: CONTROLLER },
        { name: `${c.code} rate history ${year}.xlsx`, type: 'xlsx', kb: [40, 120], days: 6 + (h % 9), time: '15:10', by: ACCOUNTANTS[0] },
        { name: `${c.code} rounding policy.rtf`, type: 'doc', kb: [60, 110], days: 140, time: '10:05', by: ACCOUNTANTS[0] },
        { name: `${c.code} rate sheet - scan.png`, type: 'img', kb: [500, 1200], days: 63, time: '13:45', by: ACCOUNTANTS[1] },
      ]
  return specs.map((f, i) => ({
    id: `att_${c.code.toLowerCase()}_${i + 1}`,
    name: f.name,
    size: sizeOf(f.name, f.kb[0], f.kb[1]),
    date: `${dayMinus(f.days, now)}T${f.time}:00.000Z`,
    type: f.type,
    uploadedBy: f.by,
  }))
}

/* ───────────────────────────── Activity ───────────────────────────── */

/** The currency's history as CoA's HistoryTab tells it: the real audit log
 *  (status changes, made here or seeded) merged with the sample history a
 *  currency in use would carry, newest first. */
export function currencyActivity(c: Currency, now = new Date()): ActivityFeedItem[] {
  const real: DatedActivity[] = c.auditLog.map((a, i) => {
    const type: ActivityFeedItem['type'] = a.action === 'Activated' ? 'apply' : a.action === 'Deactivated' ? 'delete' : 'info'
    let verb = a.action === 'Activated' ? 'activated the currency' : a.action === 'Deactivated' ? 'marked the currency as inactive' : 'updated the currency'
    if (a.reason) verb += `: “${a.reason}”`
    return { id: `${c.code}-audit-${c.auditLog.length - i}`, type, user: cleanName(a.changedBy), verb, date: '', at: a.dateTime }
  })

  const h = hashSeed(`activity:${c.code}`) >>> 8
  const at = (days: number, hour: number) => daysAgo(days, hour, (h >>> (days % 7)) % 60, now).toISOString()
  const corporate = SEED_STANDARD_RATES.find(r => r.sourceCurrency === c.code)
  const pair = `${c.code}/${BASE_CURRENCY}`
  const sample: DatedActivity[] = [
    {
      id: `${c.code}-sample-rounding`, type: 'edit', user: 'Ayesha Khan', at: at(4 + (h % 5), 10), date: '',
      verb: 'updated rounding (“Half even” → “Half up”) for', target: c.name,
    },
    c.isBaseCurrency
      ? {
          id: `${c.code}-sample-closing`, type: 'info', user: 'Marcus Lee', at: at(26 + (h % 9), 15), date: '',
          verb: 'confirmed the closing rates quoted against', target: c.name,
        }
      : corporate
      ? {
          id: `${c.code}-sample-corporate`, type: 'link', user: 'Marcus Lee', at: at(26 + (h % 9), 15), date: '',
          verb: `linked the corporate rate (“${corporate.standardRate.toFixed(4)}”) to`, target: pair,
        }
      : {
          id: `${c.code}-sample-review`, type: 'info', user: 'Daniel Osei', at: at(26 + (h % 9), 15), date: '',
          verb: 'reviewed the mid-market rate for', target: pair,
        },
    {
      id: `${c.code}-sample-decimals`, type: 'edit', user: 'Marcus Lee', at: at(58 + (h % 11), 11), date: '',
      verb: `updated decimal places (“${c.decimalPlaces + 1}” → “${c.decimalPlaces}”) for: “Match the ISO 4217 minor unit”`, target: c.name,
    },
  ]
  /* A deactivation and the activation that undid it, in the spring of 2025:
     after the library was set up and before any document still open today was
     raised, so it cannot have been blocked by one. Not offered on the base
     currency, which can never be deactivated. */
  if (!c.isBaseCurrency) {
    const day = (month: number, d: number, hour: number) => new Date(Date.UTC(2025, month, d, hour - 5, (h >>> 3) % 60)).toISOString()
    sample.push(
      { id: `${c.code}-sample-activated`, type: 'apply', user: 'Daniel Osei', at: day(6, 8 + (h % 14), 9), date: '', verb: 'activated the currency: “New supplier contract signed”' },
      { id: `${c.code}-sample-deactivated`, type: 'delete', user: 'Ayesha Khan', at: day(4, 5 + (h % 14), 16), date: '', verb: 'marked the currency as inactive: “No open documents after the office closed”' },
    )
  }
  // Three to five of them, so no two currencies tell exactly the same story.
  const kept = c.isBaseCurrency ? sample : sample.filter((_, i) => i !== 1 || h % 2 === 0)
  return feedOf([...real, ...kept])
}
