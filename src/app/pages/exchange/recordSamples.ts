// What a pair's rate opens with on its record tabs, the way CoA seeds an
// account's (see ../currency/recordSamples): notes, files and history written
// about corporate rate updates, variance reviews and archive/restore, derived
// from the pair and its rate type so they read the same on every visit. A rate
// set up in this session is new: nothing has been written about it yet.
import type { ActivityFeedItem } from '../../coa/components/ActivityFeed'
import type { AttachmentFile } from '../../coa/components/AttachmentsTab'
import { hashSeed } from '../../coa/lib/hashSeed'
import type { RecordNote } from '../../coa/lib/recordStore'
import { API_PROVIDER, LAST_SYNC, SEED_STANDARD_RATES, type RateAuditEntry, type StandardRate } from '../../data/exchangeRates'
import { ACCOUNTANTS, CONTROLLER, dayMinus, daysAgo, feedOf, sizeOf, type DatedActivity } from '../currency/recordSamples'
import { corporateActivity, type PairPoint } from './pairData'
import { BASE, fmtRate, fmtSignedPct, variancePct } from './rateModel'

export type RateKind = 'mid' | 'std'

/** Whether a corporate rate came with the demo, rather than being set up here. */
export const isSeededRate = (record: StandardRate | undefined) => !!record && SEED_STANDARD_RATES.some(s => s.id === record.id)

/* ───────────────────────────── Notes ───────────────────────────── */

const CORPORATE_NOTES = [
  (pair: string) => `Treasury agreed this rate for the quarter. Review ${pair} against the mid-market rate on the first working day of each month.`,
  () => 'Variance checked at month end. Still inside the threshold, so no change.',
  () => 'The previous rate was archived when this one took effect. Restore it from the archive if this one is questioned.',
  (pair: string) => `Payments in ${pair.split('/')[0]} are booked at this rate and settled at the bank rate. The difference goes to FX gain or loss.`,
]

const MID_NOTES = [
  () => `Rates come from ${API_PROVIDER} every 24 hours. On market holidays the last rate carries forward.`,
  () => 'Use the corporate rate on transactions. This rate is the reference the variance is measured against.',
  (pair: string) => `${pair} moved more than usual this month. Nothing to do on this side; the variance alert on the corporate rate covers it.`,
]

/** The notes a pair's rate opens with. The corporate record's own notes field
 *  is carried over with a tag, as CoA tags a note brought from elsewhere. */
export function pairNotes(code: string, kind: RateKind, record: StandardRate | undefined, now = new Date()): RecordNote[] {
  const pair = `${code}/${BASE}`
  const carried: RecordNote[] = kind === 'std' && record?.notes
    ? [{ id: `${record.id}-notes`, text: record.notes, author: record.createdBy, at: record.updatedAt, tag: 'Rate Notes' }]
    : []
  if (kind === 'std' && !isSeededRate(record)) return carried
  const lines = kind === 'std' ? CORPORATE_NOTES : MID_NOTES
  const h = hashSeed(`pair:${code}:${kind}`) >>> 8
  const authors = [CONTROLLER, ...ACCOUNTANTS]
  const count = 2 + (h % 2)
  const picked: RecordNote[] = Array.from({ length: Math.min(count, lines.length) }, (_, i) => {
    const line = lines[(h + i) % lines.length]
    const s = hashSeed(`pair:${code}:${kind}:${i}`)
    return {
      id: `note_${code.toLowerCase()}_${kind}_${i}`,
      text: line(pair),
      author: authors[(s >>> 5) % authors.length],
      at: daysAgo(2 + i * 11 + (s % 7), 9 + (s % 8), (s >>> 3) % 60, now).toISOString(),
    }
  })
  return [...carried, ...picked]
}

/* ─────────────────────────── Attachments ─────────────────────────── */

/** The files a pair's rate opens with, across the five kinds the card grid draws. */
export function pairAttachments(code: string, kind: RateKind, record: StandardRate | undefined, now = new Date()): AttachmentFile[] {
  if (kind === 'std' && !isSeededRate(record)) return []
  const stem = `${code}-${BASE}`
  const h = hashSeed(`pairfiles:${code}:${kind}`) >>> 8
  const specs: { name: string; type: AttachmentFile['type']; kb: [number, number]; days: number; time: string; by: string }[] = kind === 'std'
    ? [
        { name: `${stem} corporate rate approval.pdf`, type: 'pdf', kb: [900, 1600], days: 24 + (h % 10), time: '14:00', by: CONTROLLER },
        { name: `Treasury rate proposal - ${stem}.xlsx`, type: 'xlsx', kb: [30, 90], days: 27 + (h % 10), time: '15:10', by: ACCOUNTANTS[0] },
        { name: `Mid-market reference - ${stem}.pdf`, type: 'pdf', kb: [180, 360], days: 27 + (h % 10), time: '11:20', by: ACCOUNTANTS[0] },
        { name: `Variance review memo.rtf`, type: 'doc', kb: [50, 100], days: 9 + (h % 6), time: '10:05', by: CONTROLLER },
        { name: `Bank rate confirmation - scan.png`, type: 'img', kb: [500, 1100], days: 63, time: '13:45', by: ACCOUNTANTS[1] },
      ]
    : [
        { name: `${API_PROVIDER} service terms.pdf`, type: 'pdf', kb: [900, 1500], days: 210, time: '14:00', by: CONTROLLER },
        { name: `${stem} daily rates export.xlsx`, type: 'xlsx', kb: [60, 180], days: 5 + (h % 6), time: '15:10', by: ACCOUNTANTS[0] },
        { name: `Mid-market methodology.pdf`, type: 'pdf', kb: [200, 420], days: 140, time: '11:20', by: CONTROLLER },
        { name: `Provider sync checklist.rtf`, type: 'doc', kb: [40, 90], days: 96, time: '10:05', by: ACCOUNTANTS[1] },
        { name: `Rate feed dashboard - screenshot.png`, type: 'img', kb: [400, 900], days: 33, time: '13:45', by: ACCOUNTANTS[0] },
      ]
  return specs.map((f, i) => ({
    id: `att_${code.toLowerCase()}_${kind}_${i + 1}`,
    name: f.name,
    size: sizeOf(f.name, f.kb[0], f.kb[1]),
    date: `${dayMinus(f.days, now)}T${f.time}:00.000Z`,
    type: f.type,
    uploadedBy: f.by,
  }))
}

/* ───────────────────────────── Activity ───────────────────────────── */

const DAY = 86_400_000
const plusDays = (iso: string, days: number, hour: number) => {
  const t = new Date(new Date(iso).getTime() + days * DAY)
  t.setUTCHours(hour - 5, 0, 0, 0) // PKT working hours
  return t.toISOString()
}

/** A corporate rate's history: its real audit entries (set up, updated,
 *  archived, restored, here or seeded) merged with the reviews and changes a
 *  rate in use would carry since it was set up, newest first. */
export function corporatePairActivity(code: string, audit: RateAuditEntry[], record: StandardRate | undefined, midRate: number): ActivityFeedItem[] {
  const real = corporateActivity(code, audit)
  const created = audit.find(e => e.sourceCurrency === code && e.action === 'Created' && e.rateId === record?.id)
  if (!record || !created || !isSeededRate(record)) return feedOf(real)
  const pair = `${code}/${BASE}`
  const set = created.newValue ?? record.standardRate
  // Treasury's revised figure: one step lower at the precision the rate is
  // quoted to (278.90 for a 279.00 rate).
  const revised = +(set - (set >= 10 ? 0.1 : set >= 1 ? 0.01 : 0.0001)).toFixed(4)
  const from = created.dateTime
  const v = variancePct(set, midRate)
  const sample: DatedActivity[] = [
    { id: `${record.id}-sample-review-1`, type: 'info', user: 'Daniel Osei', at: plusDays(from, 9, 11), date: '', target: pair,
      verb: `reviewed the variance${v == null ? '' : ` (“${fmtSignedPct(v)}”)`} for` },
    { id: `${record.id}-sample-update-1`, type: 'edit', user: 'Marcus Lee', at: plusDays(from, 38, 10), date: '', target: pair,
      verb: `updated the corporate rate (“${fmtRate(set)}” → “${fmtRate(revised)}”; note: “Treasury’s revised figure”) for` },
    { id: `${record.id}-sample-update-2`, type: 'edit', user: 'Ayesha Khan', at: plusDays(from, 40, 15), date: '', target: pair,
      verb: `updated the corporate rate (“${fmtRate(revised)}” → “${fmtRate(set)}”; note: “Revision withdrawn by treasury”) for` },
    { id: `${record.id}-sample-archive`, type: 'delete', user: 'Marcus Lee', at: plusDays(from, 96, 12), date: '', target: pair,
      verb: `archived the corporate rate (“${fmtRate(set)}”; note: “Replaced by the revised rate pack”) for` },
    { id: `${record.id}-sample-restore`, type: 'apply', user: 'Ayesha Khan', at: plusDays(from, 97, 9), date: '', target: pair,
      verb: `restored the corporate rate (“${fmtRate(set)}”; note: “Revised pack withdrawn, rate back in effect”) for` },
  ]
  // Only history that has already happened, and three to five entries of it.
  const now = Date.now()
  const h = hashSeed(`pairactivity:${code}`) >>> 8
  const kept = sample.filter((e, i) => new Date(e.at).getTime() < now && (i !== 0 || h % 2 === 0))
  return feedOf([...real, ...kept])
}

/** The mid-market rate's history: the provider's latest syncs, then the reviews
 *  and the provider change behind them. */
export function midPairActivity(code: string, series: PairPoint[]): ActivityFeedItem[] {
  const pair = `${code}/${BASE}`
  const syncs: DatedActivity[] = series.slice(-4).reverse().map(p => ({
    id: `sync-${p.date}`,
    type: 'info' as const,
    user: API_PROVIDER,
    verb: `synced the mid-market rate to “${fmtRate(p.mid)}” for`,
    target: pair,
    date: '',
    at: `${p.date}T09:30:00.000Z`,
  }))
  const sample: DatedActivity[] = [
    { id: `${code}-mid-review`, type: 'info', user: 'Daniel Osei', at: plusDays(LAST_SYNC, -20, 11), date: '', target: pair,
      verb: 'reviewed the mid-market rate against the bank’s closing rate for' },
    { id: `${code}-mid-provider`, type: 'edit', user: 'Ayesha Khan', at: plusDays(LAST_SYNC, -300, 10), date: '', target: pair,
      verb: `updated the rate provider (“XE” → “${API_PROVIDER}”) for` },
  ]
  return feedOf([...syncs, ...sample])
}
