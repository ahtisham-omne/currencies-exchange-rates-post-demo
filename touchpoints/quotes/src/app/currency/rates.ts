import { BASE_CURRENCY, CURRENCIES, getCurrency, isBaseCurrency } from './currencies';

/* ── Exchange rates ───────────────────────────────────────────────────
 * The same rates the Currency & Exchange Rates module shows
 * (src/app/data/exchangeRates.ts there), so a converted amount can be checked
 * against the pair's rate history:
 *  - Mid-market: synced from the provider. The history is generated exactly as
 *    the module generates it (same seeds), ending on the last sync; a date after
 *    the last sync takes the last synced rate.
 *  - Corporate: set by finance, effective from a date.
 * Every rate is base currency per one unit of the other currency
 * (1 USD = 278.52 PKR). */

export type RateType = 'mid' | 'corporate';

/** Company Setup's default rate type (the module's DEFAULT_RATE_TYPE, "MID"). */
export const DEFAULT_RATE_TYPE: RateType = 'mid';

export const RATE_TYPE_LABEL: Record<RateType, string> = {
  mid: 'Mid-market',
  corporate: 'Corporate',
};

export const RATE_PROVIDER = 'Open Exchange Rates';
/** The provider's last sync; mid-market history ends on this day. */
export const LAST_SYNC = '2026-04-10T14:30:00Z';
const LAST_SYNC_DAY = LAST_SYNC.slice(0, 10);
const HISTORY_DAYS = 6 * 365;

// [rate, 24h change %] for the hand-seeded pairs; the rest are generated.
const HAND_SEEDED_MID: Record<string, [number, number]> = {
  USD: [278.52, 0.12], EUR: [304.815, -0.23], GBP: [355.42, 0.35], AED: [75.84, 0.02],
  SAR: [74.27, -0.01], CNY: [38.31, -0.45], JPY: [1.923, 0.08], INR: [3.27, 0.15],
  AUD: [178.35, -0.19], CAD: [199.87, 0.05], CHF: [315.61, 0.28], NZD: [162.45, -0.11],
  SGD: [210.14, 0.14], HKD: [35.71, 0.09], SEK: [27.14, -0.07], NOK: [26.55, 0.22],
  DKK: [40.85, -0.18], MYR: [63.12, 0.31], THB: [8.14, -0.05], KRW: [0.201, 0.41],
  ZAR: [14.82, 0.55], TRY: [7.65, -0.92], BRL: [48.9, -0.34], MXN: [16.43, 0.19],
};

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

// ── The module's generators, kept bit-for-bit so the numbers agree ──

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

/** Current (last synced) mid-market rate and its 24h change, as the module seeds them. */
function syncedMid(code: string): [number, number] {
  return HAND_SEEDED_MID[code] ?? [generatedMidRate(code), generatedChange24h(code)];
}

const seriesCache = new Map<string, number[]>();

/** Daily mid-market rates ending on the last sync (index HISTORY_DAYS). */
function midSeries(code: string): number[] {
  const cached = seriesCache.get(code);
  if (cached) return cached;
  const [rate, change24h] = syncedMid(code);
  const n = HISTORY_DAYS + 1;
  const values = new Array<number>(n);
  const rand = mulberry32(hash(`${code}#series`) || 1);
  const vol = 0.0015 + (hash(`${code}#vol`) % 40) / 10000;
  const drift = 0.00018;
  values[n - 1] = rate;
  values[n - 2] = rate / (1 + change24h / 100);
  for (let i = n - 3; i >= 0; i--) {
    const z = (rand() + rand() + rand() - 1.5) * 2;
    values[i] = values[i + 1] / (1 + drift + z * vol);
  }
  const rounded = values.map((v) => +v.toFixed(4));
  seriesCache.set(code, rounded);
  return rounded;
}

/** The mid-market rate on a day (the last synced rate for any day after the last sync). */
export function midRateOn(code: string, isoDate: string): number | null {
  if (isBaseCurrency(code)) return 1;
  if (!getCurrency(code)) return null;
  const series = midSeries(code.toUpperCase());
  const idx = Math.min(series.length - 1, Math.max(0, dayNumber(isoDate) - LAST_SYNC_DAY_NUMBER + HISTORY_DAYS));
  return series[idx];
}

/** The corporate rate in effect on a day, if finance has set one. */
export function corporateRateOn(code: string, isoDate: string): CorporateRate | undefined {
  const day = isoDate.slice(0, 10);
  return CORPORATE_RATES.filter((r) => r.code === code.toUpperCase() && r.effectiveDate <= day).sort((a, b) =>
    b.effectiveDate.localeCompare(a.effectiveDate),
  )[0];
}

export interface RateQuote {
  /** Base currency per one unit; null when no rate of that type exists for the day. */
  rate: number | null;
  type: RateType;
  /** The day the rate is for (the document's posting date). */
  date: string;
  /** Where it comes from: the provider, or who set the corporate rate. */
  source: string;
  /** Corporate only: the day the corporate rate took effect. */
  effectiveDate?: string;
}

/** The rate of a type for a currency on a day. The base currency is always 1. */
export function rateOn(code: string, isoDate: string, type: RateType): RateQuote {
  const date = isoDate.slice(0, 10);
  if (isBaseCurrency(code)) return { rate: 1, type, date, source: 'Base currency' };
  if (type === 'corporate') {
    const corp = corporateRateOn(code, date);
    return {
      rate: corp?.rate ?? null,
      type,
      date,
      source: corp ? `Set by ${corp.setBy}` : 'No corporate rate set',
      effectiveDate: corp?.effectiveDate,
    };
  }
  return { rate: midRateOn(code, date), type, date, source: RATE_PROVIDER };
}

/** An amount in base currency, at a rate, to the base currency's cents. */
export function toBase(amount: number, rate: number | null | undefined): number {
  return Math.round(amount * (rate ?? 1) * 100) / 100;
}

/** Currencies with a corporate rate in effect on a day. */
export const corporateCodesOn = (isoDate: string) =>
  CURRENCIES.filter((c) => !!corporateRateOn(c.code, isoDate)).map((c) => c.code);

export { BASE_CURRENCY };
