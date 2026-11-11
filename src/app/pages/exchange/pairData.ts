// Pair detail: everything the page shows, derived from the exchange-rate context
// (mid-market rates, corporate rates and their audit log) rather than generated
// per visit. The mid-market history is seeded from the currency code, and the
// corporate line comes from the audit log, so an edit moves the KPIs, the
// charts, the rate history and the activity feed together.
import {
  API_PROVIDER, midMarketHistory, pairTransactionsOn,
  type MidMarketRate, type RateAuditEntry, type StandardRate,
} from '../../data/exchangeRates'
import type { ActivityFeedItem } from '../../coa/components/ActivityFeed'
import type { RangeOption, RangeValue } from '../../coa/components/PeriodBar'
import { INSIGHTS_RANGE_OPTIONS, insightsRangeLabel } from './InsightsRangeMenu'
import { windowSeries, windowSeriesBetween } from '../../coa/components/chartKit'
import { cleanName } from '../../coa/components/Avatar'
import { fmtDate, fmtDateTime, localDayOf } from '../../coa/lib/utils'
import { BASE, LAST_SYNC_TIME, fmtRate, variancePct } from './rateModel'

export interface PairPoint {
  date: string
  mid: number
  /** The corporate rate in effect that day, or null when none was. */
  corp: number | null
}

/* ── The corporate timeline ─────────────────────────────────────────────── */

interface CorpEvent { day: string; at: string; value: number | null }

/** When each change took effect: a set or update on its effective date, an archive or restore on the day it was made. */
export function corporateEvents(code: string, audit: RateAuditEntry[]): CorpEvent[] {
  return audit
    .filter(e => e.sourceCurrency === code)
    .map(e => ({
      day: (e.action === 'Created' || e.action === 'Updated' || e.action === 'Scheduled') && e.effectiveDate ? e.effectiveDate : localDayOf(e.dateTime),
      at: e.dateTime,
      value: e.action === 'Archived' ? null : e.newValue,
    }))
    .sort((a, b) => (a.day === b.day ? a.at.localeCompare(b.at) : a.day.localeCompare(b.day)))
}

export function buildPairSeries(mid: MidMarketRate, audit: RateAuditEntry[]): PairPoint[] {
  const history = midMarketHistory(mid)
  const events = corporateEvents(mid.sourceCurrency, audit)
  let i = 0
  let corp: number | null = null
  return history.map(p => {
    while (i < events.length && events[i].day <= p.date) { corp = events[i].value; i++ }
    return { date: p.date, mid: p.mid, corp }
  })
}

/* ── Ranges (1D, 5D, 1M, 1Y, 5Y, Max and Custom, 1M by default; see
   InsightsRangeMenu) ───────────────────────────────────────────────────── */

export const RANGES: RangeOption[] = INSIGHTS_RANGE_OPTIONS.filter(o => o.key !== 'custom')
const RANGE_DAYS: Record<string, number> = { '1d': 1, '5d': 5, '1m': 30, '1y': 365, '5y': 5 * 365 }
export const RANGE_LONG: Record<string, string> = {
  '1d': 'Over the last day', '5d': 'Over the last 5 days', '1m': 'Over the last month',
  '1y': 'Over the last year', '5y': 'Over the last 5 years', max: 'Over the full history',
}
export const DEFAULT_RANGE: RangeValue = { kind: 'preset', key: '1m' }

export function windowRange<P extends { date: string }>(series: P[], range: RangeValue): P[] {
  if (range.kind === 'custom') return windowSeriesBetween(series, range.from, range.to)
  if (range.key === 'max') return series
  return windowSeries(series, RANGE_DAYS[range.key] ?? 30)
}

export const rangeLabel = (range: RangeValue) =>
  range.kind === 'preset' ? RANGE_LONG[range.key] ?? '' : insightsRangeLabel('custom', range.from, range.to)

export interface RangeMetrics { change: number; high: number; low: number; avg: number; volatility: number }

export function rangeMetrics(points: PairPoint[]): RangeMetrics {
  if (!points.length) return { change: 0, high: 0, low: 0, avg: 0, volatility: 0 }
  const mids = points.map(p => p.mid)
  const start = mids[0], end = mids[mids.length - 1]
  const daily = mids.slice(1).map((v, i) => ((v - mids[i]) / mids[i]) * 100)
  const mean = daily.reduce((s, v) => s + v, 0) / Math.max(1, daily.length)
  const variance = daily.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, daily.length)
  return {
    change: start ? ((end - start) / start) * 100 : 0,
    high: Math.max(...mids),
    low: Math.min(...mids),
    avg: mids.reduce((s, v) => s + v, 0) / mids.length,
    volatility: Math.sqrt(variance),
  }
}

/* ── Chart helpers ──────────────────────────────────────────────────────── */

/** At most `max` points, evenly spaced, the last always kept (lines over long ranges). */
export function thin<T>(points: T[], max = 360): T[] {
  if (points.length <= max) return points
  const step = Math.ceil(points.length / max)
  const out = points.filter((_, i) => i % step === 0)
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1])
  return out
}

export type Grain = 'day' | 'week' | 'month'
/** Bars stay legible: daily up to 120 days, weekly up to two years, monthly beyond. */
export const grainFor = (n: number): Grain => (n <= 120 ? 'day' : n <= 730 ? 'week' : 'month')

/** Groups dated values into buckets of the grain; each bucket is labelled by its first day. */
export function bucketBy<P extends { date: string }>(points: P[], grain: Grain): { date: string; items: P[] }[] {
  if (grain === 'day') return points.map(p => ({ date: p.date, items: [p] }))
  const out: { date: string; items: P[] }[] = []
  let key = ''
  for (const p of points) {
    const k = grain === 'month' ? p.date.slice(0, 7) : weekKey(p.date)
    if (k !== key) { out.push({ date: p.date, items: [p] }); key = k } else out[out.length - 1].items.push(p)
  }
  return out
}
function weekKey(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Axis label: "Apr 10" within a year, "Apr '25" across years. */
export const tickLabelFor = (spanDays: number) => (iso: string) =>
  spanDays > 366 ? `${MONTHS[+iso.slice(5, 7) - 1]} '${iso.slice(2, 4)}` : `${MONTHS[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`

/** A rate's ticks: four decimals for small rates, two otherwise. */
export const rateTick = (v: number) => (Math.abs(v) < 10 ? v.toFixed(4) : v.toFixed(2))

export const transactionsOn = pairTransactionsOn

/* ── Rate history (the table tab) ───────────────────────────────────────── */

export type HistoryEvent = 'Synced' | 'Created' | 'Updated' | 'Scheduled' | 'Archived' | 'Restored'
export interface RateHistoryRow {
  id: string
  type: 'Mid-Market' | 'Corporate'
  event: HistoryEvent
  effectiveDate: string
  /** When it was recorded (the sync, or the change). */
  at: string
  rate: number
  changePct: number | null
  variance: number | null
  by: string
  source: string
  note: string
}

/** A year of daily syncs plus every corporate rate change, newest first. */
export function rateHistory(code: string, series: PairPoint[], audit: RateAuditEntry[], midDays = 365): RateHistoryRow[] {
  const midOn = new Map(series.map(p => [p.date, p.mid]))
  const latestMid = series[series.length - 1]?.mid ?? null
  const mids = series.slice(-(midDays + 1))
  const rows: RateHistoryRow[] = mids.slice(1).map((p, i) => ({
    id: `mid-${p.date}`,
    type: 'Mid-Market',
    event: 'Synced',
    effectiveDate: p.date,
    at: `${p.date}T${LAST_SYNC_TIME}:00+05:00`,
    rate: p.mid,
    changePct: ((p.mid - mids[i].mid) / mids[i].mid) * 100,
    variance: null,
    by: 'System',
    source: API_PROVIDER,
    note: '',
  }))
  for (const e of audit.filter(a => a.sourceCurrency === code)) {
    const rate = e.newValue ?? e.oldValue ?? 0
    const day = e.effectiveDate ?? localDayOf(e.dateTime)
    const midThen = midOn.get(day) ?? e.midRate ?? latestMid
    rows.push({
      id: e.id,
      type: 'Corporate',
      event: e.action,
      effectiveDate: day,
      at: e.dateTime,
      rate,
      changePct: (e.action === 'Updated' || e.action === 'Scheduled') && e.oldValue ? ((rate - e.oldValue) / e.oldValue) * 100 : null,
      variance: e.action === 'Archived' ? null : variancePct(rate, midThen),
      by: e.user,
      source: 'Manual',
      note: e.reason,
    })
  }
  return rows.sort((a, b) => (a.effectiveDate === b.effectiveDate ? b.at.localeCompare(a.at) : b.effectiveDate.localeCompare(a.effectiveDate)))
}

/* ── Activity (the audit log, CoA's ActivityFeed) ───────────────────────── */

export function corporateActivity(code: string, audit: RateAuditEntry[]): (ActivityFeedItem & { at: string })[] {
  const pair = `${code}/${BASE}`
  return audit
    .filter(e => e.sourceCurrency === code)
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime))
    .map(e => {
      const user = cleanName(e.user)
      const date = fmtDateTime(e.dateTime)
      const at = e.dateTime
      // CoA's verb copy: what changed in brackets, then "for" the record.
      const parts = [
        e.effectiveDate ? `effective ${fmtDate(e.effectiveDate)}` : '',
        e.reason ? `note: “${e.reason}”` : '',
      ].filter(Boolean)
      const tail = (lead: string) => {
        const all = [lead, ...parts].filter(Boolean)
        return all.length ? ` (${all.join('; ')})` : ''
      }
      switch (e.action) {
        case 'Created':
          return { id: e.id, type: 'create' as const, user, date, at, verb: `set the corporate rate${tail(`“${fmtRate(e.newValue ?? 0)}”`)} for`, target: pair }
        case 'Updated':
          return { id: e.id, type: 'edit' as const, user, date, at, verb: `updated the corporate rate${tail(`“${fmtRate(e.oldValue ?? 0)}” → “${fmtRate(e.newValue ?? 0)}”`)} for`, target: pair }
        case 'Scheduled':
          return { id: e.id, type: 'edit' as const, user, date, at, verb: `scheduled an upcoming corporate rate${tail(`“${fmtRate(e.oldValue ?? 0)}” → “${fmtRate(e.newValue ?? 0)}”`)} for`, target: pair }
        case 'Archived':
          return { id: e.id, type: 'delete' as const, user, date, at, verb: `archived the corporate rate${tail(`“${fmtRate(e.oldValue ?? 0)}”`)} for`, target: pair }
        default:
          return { id: e.id, type: 'apply' as const, user, date, at, verb: `restored the corporate rate${tail(`“${fmtRate(e.newValue ?? 0)}”`)} for`, target: pair }
      }
    })
}

/** The corporate record the pair page shows: the active one, else the latest archived one. */
export function corporateRecordFor(code: string, rates: StandardRate[]): StandardRate | undefined {
  const mine = rates.filter(r => r.sourceCurrency === code)
  return mine.find(r => r.status === 'active') ?? [...mine].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}
