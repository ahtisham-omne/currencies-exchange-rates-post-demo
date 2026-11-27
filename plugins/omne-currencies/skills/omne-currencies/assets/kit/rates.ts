import { CURRENCIES, getBaseCurrency, getCurrency, isBaseCurrency } from './currencies';

/* ── OMNE currency kit: exchange rates ────────────────────────────────
 * The same demo rates the Currency & Exchange Rates module shows
 * (src/app/data/exchangeRates.ts in the shell), so a converted amount can be
 * checked against the pair's Rate History:
 *  - Mid-market: synced daily from the provider. The history is generated
 *    exactly as the module generates it (same seeds), ending on the last
 *    sync; a date after the last sync takes the last synced rate.
 *  - Corporate: set by finance, in effect from a date. USD to PKR follows
 *    the module's own history (279.0000 from 2 Mar 2026, 281.5000 from
 *    1 May 2026), as its activity log tells it.
 * Every rate is base currency per one unit of the other currency
 * (1 USD = 278.5200 PKR). The demo rates are for a PKR base.
 *
 * Shared file. Do not edit it in a module. */

export type RateType = 'mid' | 'corporate';

/** Company Setup's default rate type (the module's DEFAULT_RATE_TYPE). */
export const DEFAULT_RATE_TYPE: RateType = 'mid';

export const RATE_TYPE_LABEL: Record<RateType, string> = {
  mid: 'Mid-market',
  corporate: 'Corporate',
};

/** The rate type's colour: purple for mid-market, amber for corporate. */
export const RATE_HEX: Record<RateType, string> = { mid: '#7C3AED', corporate: '#B45309' };
export const RATE_TINT: Record<RateType, string> = { mid: 'rgba(124,58,237,0.08)', corporate: 'rgba(180,83,9,0.10)' };

export const RATE_PROVIDER = 'Open Exchange Rates';
/** The provider's last sync; mid-market history ends on this day. */
export const LAST_SYNC = '2026-04-10T14:30:00Z';
export const LAST_SYNC_DAY = LAST_SYNC.slice(0, 10);
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
  /** ISO day the rate takes effect. */
  effectiveDate: string;
  setBy: string;
  note: string;
}

/** Corporate rates, every change kept, so a past document finds the rate it used. */
export const CORPORATE_RATES: CorporateRate[] = [
  { code: 'USD', rate: 279.0, effectiveDate: '2026-03-02', setBy: 'Ahtisham Ahmad', note: 'Agreed with the bank for Q2 imports.' },
  { code: 'USD', rate: 280.0, effectiveDate: '2026-04-01', setBy: 'Ahtisham Ahmad', note: '' },
  { code: 'USD', rate: 280.25, effectiveDate: '2026-04-15', setBy: 'Ahtisham Ahmad', note: '' },
  { code: 'USD', rate: 281.5, effectiveDate: '2026-05-01', setBy: 'Ahtisham Ahmad', note: '' },
  { code: 'EUR', rate: 305.5, effectiveDate: '2026-04-01', setBy: 'Ahtisham Ahmad', note: 'Q2 2026 corporate rate' },
  { code: 'GBP', rate: 356.0, effectiveDate: '2026-04-01', setBy: 'Ahtisham Ahmad', note: 'Q2 2026 corporate rate' },
  { code: 'AED', rate: 76.0, effectiveDate: '2026-04-01', setBy: 'Ahtisham Ahmad', note: 'Q2 2026 corporate rate' },
  { code: 'SAR', rate: 74.5, effectiveDate: '2026-04-01', setBy: 'Ahtisham Ahmad', note: 'Q2 2026 corporate rate' },
  { code: 'CNY', rate: 38.5, effectiveDate: '2026-04-01', setBy: 'Ahtisham Ahmad', note: 'Q2 2026 corporate rate' },
];

// ── The module's generators, kept bit for bit so the numbers agree ──

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

/** Today, as an ISO day in the user's time zone. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  /** The day the rate is for. */
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

/** The rate a document uses: its type on its day, falling back to mid-market
 *  on a day with no corporate rate. */
export function usableRateOn(code: string, isoDate: string, type: RateType): RateQuote {
  const quote = rateOn(code, isoDate, type);
  return quote.rate != null ? quote : rateOn(code, isoDate, 'mid');
}

/** An amount in base currency, at a rate, to the base currency's minor unit. */
export function toBase(amount: number, rate: number | null | undefined): number {
  const d = getCurrency(getBaseCurrency())?.decimals ?? 2;
  const f = 10 ** d;
  return Math.round(amount * (rate ?? 1) * f) / f;
}

/** A base amount in another currency, at that currency's rate. */
export function fromBase(amountInBase: number, rate: number | null | undefined, code: string): number {
  const d = getCurrency(code)?.decimals ?? 2;
  const f = 10 ** d;
  const r = rate && rate > 0 ? rate : 1;
  return Math.round((amountInBase / r) * f) / f;
}

/**
 * The direct rate between two currencies on a day: units of `to` per one
 * unit of `from` (1 USD = 1.3935 CAD). Paying a USD vendor from a CAD account
 * moves CAD to USD, so this is the only rate the user needs to see; the base
 * currency stays out of it (Nophil, 25 Nov 2026). Worked through each
 * currency's rate to base, of the same type, on the same day.
 */
export function crossRateOn(from: string, to: string, isoDate: string, type: RateType = DEFAULT_RATE_TYPE): number | null {
  const a = usableRateOn(from, isoDate, type).rate;
  const b = usableRateOn(to, isoDate, type).rate;
  if (a == null || b == null || b === 0) return null;
  return +(a / b).toFixed(6);
}

/** Converts an amount in `from` to `to` at a direct rate, to `to`'s minor unit. */
export function convertAt(amount: number, rate: number, to: string): number {
  const d = getCurrency(to)?.decimals ?? 2;
  const f = 10 ** d;
  return Math.round(amount * rate * f) / f;
}

/** Currencies with a corporate rate in effect on a day. */
export const corporateCodesOn = (isoDate: string) =>
  CURRENCIES.filter((c) => !!corporateRateOn(c.code, isoDate)).map((c) => c.code);

export interface RateComparison {
  code: string;
  date: string;
  mid: RateQuote;
  corporate: RateQuote;
  /** Corporate minus mid-market, per one unit, in base; null unless both exist. */
  difference: number | null;
  /** The difference as a percentage of mid-market. */
  percent: number | null;
}

/** Both rates for a pair on a day, for the Compare rates hover. */
export function compareRatesOn(code: string, isoDate: string): RateComparison {
  const mid = rateOn(code, isoDate, 'mid');
  const corporate = rateOn(code, isoDate, 'corporate');
  const both = mid.rate != null && corporate.rate != null;
  const difference = both ? +(corporate.rate! - mid.rate!).toFixed(4) : null;
  const percent = both && mid.rate ? +((difference! / mid.rate!) * 100).toFixed(2) : null;
  return { code: code.toUpperCase(), date: isoDate.slice(0, 10), mid, corporate, difference, percent };
}
