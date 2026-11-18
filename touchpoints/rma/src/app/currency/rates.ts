import { BASE_CURRENCY, isBaseCurrency } from './currencies';

/* ── Exchange rates for returns ───────────────────────────────────────
 * Every rate is dollars (the base) per one unit of the other currency, the way
 * the Currency & Exchange Rates module quotes it: 1 GBP = $1.2636 USD.
 *
 * Today's mid-market rates are the ones the Chart of Accounts touchpoint
 * holds (its CURRENCY_META, in units per dollar), so the two USD modules in
 * the shell agree. The history is generated the same way too: one fixed series
 * per currency that passes through the last month-end revaluation rate and ends
 * on today's rate. A receipt dated weeks ago therefore has its own day's rate,
 * which is the rate it reverses at when goods go back (GL Impact). Nothing is
 * random at run time: the same day always gets the same rate. */

export type RateType = 'mid' | 'corporate';

export const RATE_TYPE_LABEL: Record<RateType, string> = {
  mid: 'Mid-market',
  corporate: 'Corporate',
};

export const RATE_PROVIDER = 'Open Exchange Rates';

/** Units of the currency per one dollar: [today, last month-end revaluation]. */
const UNITS_PER_USD: Record<string, [number, number]> = {
  EUR: [0.9243, 0.931],
  GBP: [0.7914, 0.7862],
  HKD: [7.8215, 7.8098],
  JPY: [157.2485, 155.894],
  CAD: [1.3718, 1.3795],
  AUD: [1.5106, 1.5023],
  SGD: [1.3482, 1.3531],
  CHF: [0.8967, 0.8894],
  CNY: [7.2519, 7.241],
  INR: [83.4162, 83.1875],
  AED: [3.6725, 3.6725],
  PKR: [278.534, 277.09],
};

/** Pegged to the dollar: the rate doesn't move from day to day. */
const PEGGED = new Set(['AED']);

const DAY = 86_400_000;
const dayNum = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY);
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The last month end before today: when balances were last revalued.
function revaluationDay(today: string): string {
  const [y, m] = today.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 0)).toISOString().slice(0, 10);
}

// A small, fixed wobble in [-1, 1] for a currency and a day.
function wobble(code: string, n: number): number {
  let h = 2166136261;
  for (const ch of `${code}:${n}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 20_001) / 10_000 - 1;
}

const history = new Map<string, Map<number, number>>();

/** The mid-market rate on a day (dollars per one unit), to four decimals. A
 *  day after today takes today's; a currency with no rate here converts 1:1. */
export function midRateOn(code: string, isoDate: string): number {
  const c = code.toUpperCase();
  if (isBaseCurrency(c)) return 1;
  const pair = UNITS_PER_USD[c];
  if (!pair) return 1;
  const spot = 1 / pair[0];
  const booked = 1 / pair[1];
  if (PEGGED.has(c)) return round4(spot);
  const today = todayIso();
  const t = dayNum(today);
  const r = dayNum(revaluationDay(today));
  const d = dayNum(isoDate);
  if (d >= t) return round4(spot);
  if (d >= r) {
    // Between the revaluation and today: from the booked rate to today's, with
    // a wobble that vanishes at both ends.
    const f = (d - r) / Math.max(1, t - r);
    return round4(booked + (spot - booked) * f + Math.sin(Math.PI * f) * wobble(c, d) * 0.002 * spot);
  }
  // Before it: walk back from the booked rate, a quarter of a percent a day at most.
  let series = history.get(c);
  if (!series) history.set(c, (series = new Map()));
  const hit = series.get(d);
  if (hit !== undefined) return hit;
  let v = booked;
  for (let k = r - 1; k >= d; k--) {
    v = v * (1 + wobble(c, k) * 0.0025);
    if (!series.has(k)) series.set(k, round4(v));
  }
  return series.get(d) ?? round4(v);
}

/** A rate and what it is, for the money hover (Money.tsx). */
export interface MoneyFx {
  /** Dollars per one unit of the amount's currency. */
  rate: number;
  rateType: RateType;
  /** The day the rate is for (ISO). */
  rateDate: string;
  source: string;
  /** Not fixed yet: shown at today's rate. */
  provisional?: boolean;
  /** What the rate day is to the record: "receiving date", "today". */
  dateLabel?: string;
  /** For a provisional rate: why it isn't fixed yet. */
  note?: string;
  /** Several rates behind one amount (receipts from different days): each
   *  one's rate, and `rate` is the value-weighted blend of them. */
  breakdown?: { label: string; date: string; rate: number }[];
}

/** The mid-market rate on a day, as the hover reads it. */
export function fxOn(code: string, isoDate: string, dateLabel: string): MoneyFx {
  return { rate: midRateOn(code, isoDate), rateType: 'mid', rateDate: isoDate.slice(0, 10), source: RATE_PROVIDER, dateLabel };
}

/** Today's rate, for an amount not posted yet (an open return's value). */
export const fxToday = (code: string): MoneyFx => ({ ...fxOn(code, todayIso(), 'today'), provisional: true });

/** An amount in dollars, at a rate, to the cent. */
export function toBase(amount: number, rate: number | null | undefined): number {
  return Math.round(amount * (rate ?? 1) * 100) / 100;
}

export { BASE_CURRENCY };
