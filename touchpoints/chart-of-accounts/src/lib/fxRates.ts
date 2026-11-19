import { currencyMeta, PEGGED_TO_BASE } from './currencies'
import { todayIso } from './utils'

/* ── Dated rates for an entry in another currency ─────────────────────
   Mahad, 2026-11-18, the rules for a journal entry in another currency:
   *"The rate comes from the entry date. A back-dated entry uses the rate for
   that day, not today's. The rate type follows the company setting. A
   mid-market rate can't be edited. Only a company on corporate or manual rates
   can type its own rate. Show the rate the Currencies way: '1 GBP = $1.2636
   USD', with 4 decimals."*

   Rates here are quoted the Currencies way: base currency per one unit of the
   other (1 GBP = $1.2636). The rest of the module, and the postings, carry the
   inverse (units per one of base, CurrencyMeta.rate); `unitsPerBase` converts.

   The mid-market history is one deterministic series per currency, anchored on
   the two rates the module already holds: it passes through the booked rate at
   the last revaluation (the month end before today) and ends on today's spot
   rate, so a balance revalued at month end and an entry dated that day agree.
   Before the revaluation it walks back a day at a time. Nothing in it is
   random at run time, so the same date always gets the same rate. */

export type RateKind = 'mid' | 'corporate' | 'manual'

/** How the company takes its rates (Currencies module setting). */
export type RateSetting = 'mid-market' | 'corporate' | 'manual'

export const RATE_KIND_LABEL: Record<RateKind, string> = { mid: 'Mid-market', corporate: 'Corporate', manual: 'Manual' }

const DAY = 86_400_000
const dayNum = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY)
const round4 = (n: number) => Math.round(n * 10_000) / 10_000

// The last month end before today: when balances were last revalued.
function revaluationDay(today: string): string {
  const [y, m] = today.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 0))
  return d.toISOString().slice(0, 10)
}

// A small, fixed wobble in [-1, 1] for a currency and a day.
function wobble(code: string, n: number): number {
  let h = 2166136261
  for (const ch of `${code}:${n}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return ((h >>> 0) % 20_001) / 10_000 - 1
}

const history = new Map<string, Map<number, number>>()

/** The mid-market rate on a day: base per one unit, to four decimals. A date
 *  after today takes today's. */
export function midRateOn(code: string, isoDate: string, base = 'USD'): number {
  if (code === base) return 1
  const meta = currencyMeta(code)
  const spot = 1 / meta.rate
  const booked = 1 / meta.bookedRate
  if (PEGGED_TO_BASE.has(code)) return round4(spot)
  const today = todayIso()
  const t = dayNum(today)
  const r = dayNum(revaluationDay(today))
  const d = dayNum(isoDate)
  if (d >= t) return round4(spot)
  if (d >= r) {
    // Between the revaluation and today: from the booked rate to today's, with a
    // wobble that vanishes at both ends.
    const f = (d - r) / Math.max(1, t - r)
    return round4(booked + (spot - booked) * f + Math.sin(Math.PI * f) * wobble(code, d) * 0.002 * spot)
  }
  // Before it: walk back from the booked rate, a quarter of a percent a day at most.
  let series = history.get(code)
  if (!series) history.set(code, (series = new Map()))
  const hit = series.get(d)
  if (hit !== undefined) return hit
  let v = booked
  for (let k = r - 1; k >= d; k--) {
    v = v * (1 + wobble(code, k) * 0.0025)
    if (!series.has(k)) series.set(k, round4(v))
  }
  return series.get(d) ?? round4(v)
}

/* Corporate rates are set in the Currencies & Exchange Rates module, each from
   an effective date until the next, by a named person (the module's own
   corporate rates are Ahtisham Ahmad's; Mahreen, 2026-11-20: "show the name of
   the person who set a corporate rate, not 'Treasury'"). Only some currencies
   carry one; an entry in any other takes the mid-market rate. */
export interface CorporateRate { code: string; rate: number; effectiveDate: string; setBy: string }

export const CORPORATE_RATES: CorporateRate[] = [
  { code: 'EUR', rate: 1.0740, effectiveDate: '2026-10-01', setBy: 'Ahtisham Ahmad' },
  { code: 'EUR', rate: 1.0800, effectiveDate: '2026-11-01', setBy: 'Ahtisham Ahmad' },
  { code: 'CAD', rate: 0.7250, effectiveDate: '2026-11-01', setBy: 'Ahtisham Ahmad' },
]

/** The corporate rate in effect on a day, if one has been set. */
export function corporateRateOn(code: string, isoDate: string): CorporateRate | undefined {
  const day = isoDate.slice(0, 10)
  return CORPORATE_RATES
    .filter(r => r.code === code && r.effectiveDate <= day)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]
}

/** Who set the corporate rate in effect for `code` on a day; without a day,
 *  the latest one. */
export function corporateSetBy(code: string, isoDate?: string): string {
  const r = isoDate
    ? corporateRateOn(code, isoDate)
    : CORPORATE_RATES.filter(c => c.code === code).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]
  return r?.setBy ?? CORPORATE_RATES[0].setBy
}

export interface RateQuote {
  /** Base per one unit, four decimals. */
  rate: number
  kind: RateKind
  /** The day the rate is for (mid-market) or took effect (corporate). */
  date: string
  source: string
}

export const MID_SOURCE = 'Open Exchange Rates'

/** The rate an entry in `code` dated `isoDate` takes, of the kind asked for. A
 *  corporate rate where none is set falls back to mid-market. */
export function rateQuote(code: string, isoDate: string, kind: RateKind, base = 'USD'): RateQuote {
  if (kind === 'corporate') {
    const c = corporateRateOn(code, isoDate)
    if (c) return { rate: c.rate, kind: 'corporate', date: c.effectiveDate, source: `Set by ${c.setBy}` }
  }
  const mid = { rate: midRateOn(code, isoDate, base), kind: 'mid' as const, date: isoDate.slice(0, 10), source: MID_SOURCE }
  return kind === 'manual' ? { ...mid, kind: 'manual', source: 'Typed on the entry' } : mid
}

/** The kind an entry starts on: the company's, where the currency has one. */
export function defaultRateKind(setting: RateSetting | undefined, code: string, isoDate: string): RateKind {
  if (setting === 'manual') return 'manual'
  if (setting === 'corporate' && corporateRateOn(code, isoDate)) return 'corporate'
  return 'mid'
}

/** Whether the company may type its own rate: only on corporate or manual rates. */
export const canTypeRate = (setting: RateSetting | undefined, kind: RateKind) =>
  kind !== 'mid' && (setting === 'corporate' || setting === 'manual')

/** A posting's stored rate (units per base) as the Currencies way quotes it. */
export const basePerUnit = (unitsPerBase: number) => (unitsPerBase > 0 ? 1 / unitsPerBase : 0)
/** And back: what a posting stores for a quoted rate. */
export const unitsPerBase = (basePerOne: number) => (basePerOne > 0 ? 1 / basePerOne : 0)

/** "1 GBP = $1.2636 USD": four decimals, base per one unit. */
export function fmtUnitRate(code: string, basePerOne: number, base = 'USD', symbol = '$'): string {
  return `1 ${code} = ${symbol}${basePerOne.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ${base}`
}

/** The same for a posting's stored rate. */
export const fmtPostingRate = (code: string, unitsPerBaseRate: number, base = 'USD', symbol = '$') =>
  fmtUnitRate(code, basePerUnit(unitsPerBaseRate), base, symbol)
