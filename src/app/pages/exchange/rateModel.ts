// Exchange Rates screens: the rows the two tables draw, and the small rules the
// list, the pair page and the corporate rate form share (variance, backdating,
// the sync stamp, a currency's flag / country / region).
import { SEED_CURRENCIES, getRegionForCountry } from '../../data/currencies'
import { getCountryCode, getCountryName } from '../../utils/currencyFlags'
import {
  API_PROVIDER, BASE_CURRENCY, BASE_CURRENCY_NAME, LAST_SYNC, isRateInEffect, upcomingRateOf,
  type MidMarketRate, type StandardRate,
} from '../../data/exchangeRates'
import { fmtDate, fmtDateTime, todayIso } from '../../coa/lib/utils'

export const BASE = BASE_CURRENCY
export const BASE_NAME = BASE_CURRENCY_NAME
export const ACTOR = 'Ahtisham Ahmad'

/* ── A currency's flag, country and region ─────────────────────────────── */

const SEED_BY_CODE = new Map(SEED_CURRENCIES.map(c => [c.code, c]))

/** ISO 3166 alpha-2 for the flag ('ae'), or '' when there is none. */
export const flagOf = (code: string) => (getCountryCode(code) ?? '').toLowerCase()
/** The currency's country, from the Currency Library (falls back to the flag table). */
export const countryOf = (code: string) => SEED_BY_CODE.get(code)?.country ?? getCountryName(code) ?? ''
/** The region a rate files under for the Region filter. */
export const regionOf = (code: string): string | null => {
  const country = countryOf(code)
  return (country && getRegionForCountry(country)) || null
}
export const nameOf = (code: string) => SEED_BY_CODE.get(code)?.name ?? code
/** Digits after the point that amounts in the currency carry (2 when unknown). */
export const decimalsOf = (code: string) => SEED_BY_CODE.get(code)?.decimalPlaces ?? 2

/* ── Numbers ───────────────────────────────────────────────────────────── */

/** Every rate, and every inverse rate, prints with four decimals. */
export const fmtRate = (n: number) => n.toFixed(4)
export const fmtInverse = (n: number) => (n > 0 ? (1 / n).toFixed(4) : '–')
/** A rate as the pair it prices: "1 AED = 75.8400 PKR". */
export const fmtPairRate = (code: string, rate: number) => `1 ${code} = ${fmtRate(rate)} ${BASE}`
/** Its inverse the same way round: "1 PKR = 0.0132 AED". */
export const fmtPairInverse = (code: string, rate: number) => `1 ${BASE} = ${fmtInverse(rate)} ${code}`
/** An amount in a currency, with that currency's own decimals (75.84 PKR, 0.00 USD). */
export const fmtAmountIn = (n: number, code: string) => {
  const dp = decimalsOf(code)
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}
export const fmtSignedPct = (n: number, dp = 2) => `${n > 0 ? '+' : ''}${n.toFixed(dp)}%`

/** (corporate - mid) / mid, in percent to 2dp. */
export function variancePct(rate: number, mid: number | null | undefined): number | null {
  if (!mid || mid <= 0 || !(rate > 0)) return null
  return +(((rate - mid) / mid) * 100).toFixed(2)
}

/** The variance colour bands: green within 1%, amber 1 to 3%, red beyond 3%. */
export function varianceColor(v: number | null): string | undefined {
  if (v == null) return undefined
  const a = Math.abs(v)
  return a <= 1 ? '#059669' : a <= 3 ? '#D97706' : '#DC2626'
}

/* ── The sync stamp ────────────────────────────────────────────────────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad2 = (n: number) => String(n).padStart(2, '0')

/** LAST_SYNC's day in Pakistan time (UTC+5, no daylight saving), whatever the reader's zone. */
export function syncStamp(at: string = LAST_SYNC) {
  const d = new Date(new Date(at).getTime() + 5 * 3600 * 1000)
  return {
    date: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
    time: `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`,
    day: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
  }
}
const SYNC = syncStamp()
export const LAST_SYNC_DATE = SYNC.date
export const LAST_SYNC_TIME = SYNC.time
export const LAST_SYNC_DAY = SYNC.day
/** The last sync as every screen writes a moment: "Apr 10, 2026, 7:30 PM". */
export const LAST_SYNC_AT = fmtDateTime(LAST_SYNC)
export const SYNC_LINE = `Synced every 24h from ${API_PROVIDER} · Updated ${LAST_SYNC_AT}`
/** The toolbar's short form; the full line rides in its tooltip. */
export const SYNC_LINE_SHORT = `Updated ${LAST_SYNC_AT}`

/* ── Backdating (one rule for every door to the corporate rate form) ───── */

export type BackdateCheck = { kind: 'block' | 'warn'; message: string } | null

/**
 * Only matters when the currency already has an active corporate rate: a new
 * date may not fall before that rate's effective date (block), and a date
 * between it and yesterday applies the rate retroactively (warn).
 */
export function checkBackdate(existing: StandardRate | undefined, date: string, today = todayIso()): BackdateCheck {
  if (!existing || !date) return null
  if (date < existing.effectiveDate) {
    return { kind: 'block', message: `Cannot set a date before the current rate's effective date (${fmtDate(existing.effectiveDate)}).` }
  }
  if (date < today) {
    return {
      kind: 'warn',
      message: `Setting a past effective date means this rate applies retroactively from ${fmtDate(date)}. Transactions processed between ${fmtDate(date)} and today may have used a different rate.`,
    }
  }
  return null
}

/** Whole days from an ISO day to today (0 when it is today or later). */
export function daysSince(isoDay: string, today = todayIso()): number {
  const a = new Date(`${isoDay.slice(0, 10)}T00:00:00`).getTime()
  const b = new Date(`${today}T00:00:00`).getTime()
  return Math.max(0, Math.round((b - a) / 86400000))
}

/* ── Table rows ────────────────────────────────────────────────────────── */

export interface MidRow {
  id: string
  code: string
  name: string
  rate: number
  change24h: number
  effectiveDate: string
  flag: string
  country: string
  region: string | null
  corporate?: StandardRate
}

/** Every active mid-market rate except the base's own (always 1, and every
 *  rate here is quoted against it - the table says so above its header). */
export function toMidRows(mid: MidMarketRate[], standard: StandardRate[]): MidRow[] {
  return mid.filter(m => m.status === 'active' && m.sourceCurrency !== BASE).map(m => ({
    id: m.sourceCurrency,
    code: m.sourceCurrency,
    name: m.sourceCurrencyName,
    rate: m.rate,
    change24h: m.change24h,
    effectiveDate: m.effectiveDate,
    flag: flagOf(m.sourceCurrency),
    country: countryOf(m.sourceCurrency),
    region: regionOf(m.sourceCurrency),
    corporate: standard.find(s => s.sourceCurrency === m.sourceCurrency && s.status === 'active'),
  }))
}

export type CorpStatus = 'Active' | 'Archived'

export interface CorpRow {
  id: string
  code: string
  name: string
  /** The rate in effect today; null for one added for a later date. */
  rate: number | null
  /** The current mid-market rate (variance is measured against it). */
  mid: number | null
  variance: number | null
  /** When the rate in effect took effect ('' when none is yet). */
  effectiveDate: string
  /** A rate dated for later, shown as Upcoming until its day. */
  upcoming: { rate: number; effectiveDate: string } | null
  createdBy: string
  updatedAt: string
  notes: string
  status: CorpStatus
  flag: string
  country: string
  region: string | null
  record?: StandardRate
}

export function toCorpRows(standard: StandardRate[], mid: MidMarketRate[], today = todayIso()): CorpRow[] {
  const midOf = new Map(mid.map(m => [m.sourceCurrency, m.rate]))
  return standard.map(s => {
    const m = midOf.get(s.sourceCurrency) ?? s.midMarketRate ?? null
    // An archived rate keeps its figures; an active one dated for later has none in effect yet.
    const current = s.status === 'archived' || isRateInEffect(s, today)
    const next = upcomingRateOf(s, today)
    return {
      id: s.id,
      code: s.sourceCurrency,
      name: s.sourceCurrencyName,
      rate: current ? s.standardRate : null,
      mid: m,
      variance: current ? variancePct(s.standardRate, m) : null,
      effectiveDate: current ? s.effectiveDate : '',
      upcoming: next ? { rate: next.standardRate, effectiveDate: next.effectiveDate } : null,
      createdBy: s.createdBy,
      updatedAt: s.updatedAt,
      notes: s.notes,
      status: s.status === 'archived' ? 'Archived' : 'Active',
      flag: flagOf(s.sourceCurrency),
      country: countryOf(s.sourceCurrency),
      region: regionOf(s.sourceCurrency),
      record: s,
    }
  })
}

export const pairPath = (code: string, type: 'mid' | 'std') => `/accounting/exchange-rates/${code}?type=${type}`
