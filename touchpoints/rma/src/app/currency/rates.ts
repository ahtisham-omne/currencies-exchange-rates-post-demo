import { BASE_CURRENCY, getCurrency, isBaseCurrency } from './currencies';

/* ── Exchange rates for returns ───────────────────────────────────────
 * Every rate is rupees (PKR, the base) per one unit of the other currency, the
 * way the Currency & Exchange Rates module quotes it: 1 GBP = Rs355.4200 PKR.
 * The base was dollars until 2026-11-20 (Mahreen: "Base currency is PKR, not
 * dollars").
 *
 * The rates are the ones Purchase Orders holds (its HAND_SEEDED_MID and the
 * same generated daily series, ending on the provider's last sync), so a
 * return's receiving-day rate is the rate the PO module shows for that day.
 * A receipt dated weeks ago has its own day's rate, which is the rate it
 * reverses at when goods go back (GL Impact). Nothing is random at run time:
 * the same day always gets the same rate. */

export type RateType = 'mid' | 'corporate';

export const RATE_TYPE_LABEL: Record<RateType, string> = {
  mid: 'Mid-market',
  corporate: 'Corporate',
};

export const RATE_PROVIDER = 'Open Exchange Rates';

/** Company Setup's default rate type, for a PO that names none. */
export const DEFAULT_RATE_TYPE: RateType = 'mid';

/** Finance's corporate rates, effective from a date: the same rates Purchase
 *  Orders holds (its CORPORATE_RATES), so a return settled at the corporate
 *  rate reads the figure its PO module shows (Currency Touchpoints Map,
 *  2026-11-24: "Rate: today, mid-market or corporate"). */
export interface CorporateRate {
  code: string;
  rate: number;
  effectiveDate: string;
  setBy: string;
  note: string;
}

export const CORPORATE_RATES: CorporateRate[] = [
  { code: 'USD', rate: 279.0, effectiveDate: '2026-04-01', setBy: 'Ahtisham Ahmad', note: 'Q2 2026 corporate rate' },
  { code: 'EUR', rate: 305.5, effectiveDate: '2026-04-01', setBy: 'Ahtisham Ahmad', note: 'Q2 2026 corporate rate' },
  { code: 'GBP', rate: 356.0, effectiveDate: '2026-04-01', setBy: 'Ahtisham Ahmad', note: 'Q2 2026 corporate rate' },
  { code: 'AED', rate: 76.0, effectiveDate: '2026-04-01', setBy: 'Ahtisham Ahmad', note: 'Q2 2026 corporate rate' },
  { code: 'SAR', rate: 74.5, effectiveDate: '2026-04-01', setBy: 'Ahtisham Ahmad', note: 'Q2 2026 corporate rate' },
  { code: 'CNY', rate: 38.5, effectiveDate: '2026-04-01', setBy: 'Ahtisham Ahmad', note: 'Q2 2026 corporate rate' },
];

/** The provider's last sync; mid-market history ends on this day. */
const LAST_SYNC_DAY = '2026-04-10';
const HISTORY_DAYS = 6 * 365;

// [rate, 24h change %] for the hand-seeded pairs (as Purchase Orders seeds them).
const HAND_SEEDED_MID: Record<string, [number, number]> = {
  USD: [278.52, 0.12], EUR: [304.815, -0.23], GBP: [355.42, 0.35], AED: [75.84, 0.02],
  SAR: [74.27, -0.01], CNY: [38.31, -0.45], JPY: [1.923, 0.08], INR: [3.27, 0.15],
  AUD: [178.35, -0.19], CAD: [199.87, 0.05], CHF: [315.61, 0.28], NZD: [162.45, -0.11],
  SGD: [210.14, 0.14], HKD: [35.71, 0.09], SEK: [27.14, -0.07], NOK: [26.55, 0.22],
  DKK: [40.85, -0.18], MYR: [63.12, 0.31], THB: [8.14, -0.05], KRW: [0.201, 0.41],
  ZAR: [14.82, 0.55], TRY: [7.65, -0.92], BRL: [48.9, -0.34], MXN: [16.43, 0.19],
};

export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function generatedMidRate(code: string): number {
  const h = hash(code);
  const exp = (h % 5) - 2;
  const base = 1 + ((h >> 3) % 999) / 100;
  return +(base * Math.pow(10, exp)).toFixed(4);
}

function generatedChange24h(code: string): number {
  const h = hash(code + '#c24');
  return +(((h % 401) - 200) / 100).toFixed(2);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);
const LAST_SYNC_DAY_NUMBER = dayNumber(LAST_SYNC_DAY);

const seriesCache = new Map<string, number[]>();

/** Daily mid-market rates ending on the last sync (index HISTORY_DAYS). */
function midSeries(code: string): number[] {
  const cached = seriesCache.get(code);
  if (cached) return cached;
  const [rate, change24h] = HAND_SEEDED_MID[code] ?? [generatedMidRate(code), generatedChange24h(code)];
  const n = HISTORY_DAYS + 1;
  const values = new Array<number>(n);
  const rand = mulberry32(hash(`${code}#series`) || 1);
  const vol = 0.0015 + (hash(`${code}#vol`) % 40) / 10000;
  const drift = 0.00018;
  values[n - 1] = rate;
  values[n - 2] = rate / (1 + change24h / 100);
  for (let i = n - 3; i >= 0; i--) {
    const z = (rand() + rand() + rand() - 1.5) * 2;
    values[i] = values[i + 1]! / (1 + drift + z * vol);
  }
  const rounded = values.map((v) => +v.toFixed(4));
  seriesCache.set(code, rounded);
  return rounded;
}

/** The mid-market rate on a day (rupees per one unit), to four decimals. A day
 *  after the last sync takes the synced rate; a currency with no rate here
 *  converts 1:1. */
export function midRateOn(code: string, isoDate: string): number {
  const c = code.toUpperCase();
  if (isBaseCurrency(c)) return 1;
  if (!getCurrency(c)) return 1;
  const series = midSeries(c);
  const idx = Math.min(series.length - 1, Math.max(0, dayNumber(isoDate) - LAST_SYNC_DAY_NUMBER + HISTORY_DAYS));
  return series[idx] ?? 1;
}

/** The corporate rate in effect on a day, if finance has set one. */
export function corporateRateOn(code: string, isoDate: string): CorporateRate | undefined {
  const day = isoDate.slice(0, 10);
  return CORPORATE_RATES.filter((r) => r.code === code.toUpperCase() && r.effectiveDate <= day).sort((a, b) =>
    b.effectiveDate.localeCompare(a.effectiveDate),
  )[0];
}

export interface RateQuote {
  /** Rupees per one unit. */
  rate: number;
  /** The type asked for, or mid-market where no corporate rate is set. */
  type: RateType;
  /** The day the rate is for. */
  date: string;
  /** The provider, or who set the corporate rate. */
  source: string;
  /** Corporate was asked for and none is set for the day: mid-market stands. */
  fellBack?: boolean;
}

/** The rate of a type on a day. A corporate rate finance hasn't set falls back
 *  to the day's mid-market rate, and says so. The base is always 1. */
export function rateOn(code: string, isoDate: string, type: RateType): RateQuote {
  const date = isoDate.slice(0, 10);
  if (isBaseCurrency(code)) return { rate: 1, type, date, source: 'Base currency' };
  if (type === 'corporate') {
    const corp = corporateRateOn(code, date);
    if (corp) return { rate: corp.rate, type, date, source: `Set by ${corp.setBy}` };
    return { rate: midRateOn(code, date), type: 'mid', date, source: RATE_PROVIDER, fellBack: true };
  }
  return { rate: midRateOn(code, date), type, date, source: RATE_PROVIDER };
}

/** A rate and what it is, for the money hover (Money.tsx). */
export interface MoneyFx {
  /** Rupees (the base) per one unit of the amount's currency. */
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

/** A quoted rate as the hover reads it. */
export const fxOfQuote = (q: RateQuote, dateLabel: string, provisional = false): MoneyFx => ({
  rate: q.rate,
  rateType: q.type,
  rateDate: q.date,
  source: q.source,
  dateLabel,
  ...(provisional ? { provisional: true } : {}),
});

/** Today's rate, for an amount not posted yet (an open return's value). */
export const fxToday = (code: string): MoneyFx => ({ ...fxOn(code, todayIso(), 'today'), provisional: true });

/** An amount in the base currency, at a rate, to the paisa. */
export function toBase(amount: number, rate: number | null | undefined): number {
  return Math.round(amount * (rate ?? 1) * 100) / 100;
}

/** Parts of one amount in the base currency, each at `rate`, the paisa split
 *  (largest remainder first) so the parts add up to `total` exactly: the
 *  amount's own conversion unless given. What keeps a journal step balanced
 *  and the Return Summary's rows adding back to its Return value. */
export function splitToBase(parts: number[], rate: number, total?: number): number[] {
  const totalCents = Math.round((total ?? toBase(parts.reduce((s, v) => s + v, 0), rate)) * 100);
  const raw = parts.map((v) => v * rate * 100);
  const cents = raw.map((r) => Math.floor(r + 1e-9));
  let left = totalCents - cents.reduce((s, c) => s + c, 0);
  const order = raw.map((r, i) => [r - Math.floor(r + 1e-9), i] as const).sort((a, b) => b[0] - a[0]);
  for (let pass = 0; left !== 0 && pass < 4; pass++) {
    for (const [, i] of order) {
      if (left === 0) break;
      if (!parts[i]) continue;
      cents[i] = (cents[i] ?? 0) + (left > 0 ? 1 : -1);
      left += left > 0 ? -1 : 1;
    }
  }
  return cents.map((c, i) => (parts[i] ? c / 100 : 0));
}

export { BASE_CURRENCY };
