// ─── Exchange Rate Library — Data Model & Seed Data ───
import { SEED_CURRENCIES } from "./currencies";
import { CORPORATE_CREATED, CORPORATE_EFFECTIVE, CORPORATE_NOTE, LAST_SYNC, SYNC_DAY } from "./demoClock";

export interface MidMarketRate {
  id: string;
  baseCurrency: string;
  sourceCurrency: string;
  sourceCurrencyName: string;
  rate: number;
  change24h: number; // percentage
  effectiveDate: string;
  source: "API";
  status: "active" | "inactive";
}

export interface StandardRate {
  id: string;
  baseCurrency: string;
  sourceCurrency: string;
  sourceCurrencyName: string;
  standardRate: number;
  midMarketRate: number;
  variance: number; // percentage difference
  effectiveDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  // Corporate rates only have two valid states — they either exist (active)
  // or have been retired (archived). "Inactive" was ambiguous and removed.
  status: "active" | "archived";
  isStale: boolean; // not updated in 30+ days
  /** A rate saved for a later date. The rate above stays in effect until then. */
  upcoming?: UpcomingRate;
}

/** A corporate rate dated for later: it takes over on its effective date. */
export interface UpcomingRate {
  standardRate: number;
  effectiveDate: string;
  notes: string;
  setBy: string;
  setAt: string;
}

export interface RateHistoryEntry {
  id: string;
  effectiveDate: string;
  rateType: "MID" | "STD";
  rateValue: number;
  varianceVsMid: number | null;
  setBy: string;
  source?: string; // provider name
}

export interface AuditEntry {
  id: string;
  dateTime: string;
  action: string;
  user: string;
  oldValue: number | null;
  newValue: number | null;
  reason: string;
}

/** One change to a corporate rate, kept for the pair's history and activity. */
/** "Scheduled" is a new rate saved for a later date, while the current one stays in effect. */
export type RateAuditAction = "Created" | "Updated" | "Scheduled" | "Archived" | "Restored";
export interface RateAuditEntry extends AuditEntry {
  action: RateAuditAction;
  sourceCurrency: string;
  /** The StandardRate record the change was made to. */
  rateId: string;
  /** The date the rate took (or takes) effect; set on Created / Updated. */
  effectiveDate: string | null;
  /** The mid-market rate at the time of the change, for its variance. */
  midRate: number | null;
}

// Base currency is PKR
export const BASE_CURRENCY = "PKR";
export const BASE_CURRENCY_NAME = "Pakistani Rupee";
export const API_PROVIDER = "Open Exchange Rates";
export const API_PROVIDER_URL = "https://openexchangerates.org";
export const SYNC_FREQUENCY = "Every 30 min";
export const DEFAULT_RATE_TYPE: "MID" | "STD" = "MID";

// ─── Mid-Market Rates Seed Data ───
// All rates are relative to PKR (base), so USD/PKR = 278.52 means 1 USD = 278.52 PKR.
// Hand-seeded rates below cover real quotable currencies; the rest are filled in
// deterministically from the Currency Library so every active currency has a rate.
const HAND_SEEDED_MID_RATES: MidMarketRate[] = [
  { id: "mm-usd", baseCurrency: "PKR", sourceCurrency: "USD", sourceCurrencyName: "United States Dollar", rate: 278.5200, change24h: 0.12, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-eur", baseCurrency: "PKR", sourceCurrency: "EUR", sourceCurrencyName: "Euro", rate: 304.8150, change24h: -0.23, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-gbp", baseCurrency: "PKR", sourceCurrency: "GBP", sourceCurrencyName: "Pound Sterling", rate: 355.4200, change24h: 0.35, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-aed", baseCurrency: "PKR", sourceCurrency: "AED", sourceCurrencyName: "United Arab Emirates Dirham", rate: 75.8400, change24h: 0.02, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-sar", baseCurrency: "PKR", sourceCurrency: "SAR", sourceCurrencyName: "Saudi Riyal", rate: 74.2700, change24h: -0.01, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-cny", baseCurrency: "PKR", sourceCurrency: "CNY", sourceCurrencyName: "Renminbi", rate: 38.3100, change24h: -0.45, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-jpy", baseCurrency: "PKR", sourceCurrency: "JPY", sourceCurrencyName: "Japanese Yen", rate: 1.9230, change24h: 0.08, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-inr", baseCurrency: "PKR", sourceCurrency: "INR", sourceCurrencyName: "Indian Rupee", rate: 3.2700, change24h: 0.15, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-aud", baseCurrency: "PKR", sourceCurrency: "AUD", sourceCurrencyName: "Australian Dollar", rate: 178.3500, change24h: -0.19, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-cad", baseCurrency: "PKR", sourceCurrency: "CAD", sourceCurrencyName: "Canadian Dollar", rate: 199.8700, change24h: 0.05, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-chf", baseCurrency: "PKR", sourceCurrency: "CHF", sourceCurrencyName: "Swiss Franc", rate: 315.6100, change24h: 0.28, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-nzd", baseCurrency: "PKR", sourceCurrency: "NZD", sourceCurrencyName: "New Zealand Dollar", rate: 162.4500, change24h: -0.11, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-sgd", baseCurrency: "PKR", sourceCurrency: "SGD", sourceCurrencyName: "Singapore Dollar", rate: 210.1400, change24h: 0.14, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-hkd", baseCurrency: "PKR", sourceCurrency: "HKD", sourceCurrencyName: "Hong Kong Dollar", rate: 35.7100, change24h: 0.09, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-sek", baseCurrency: "PKR", sourceCurrency: "SEK", sourceCurrencyName: "Swedish Krona", rate: 27.1400, change24h: -0.07, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-nok", baseCurrency: "PKR", sourceCurrency: "NOK", sourceCurrencyName: "Norwegian Krone", rate: 26.5500, change24h: 0.22, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-dkk", baseCurrency: "PKR", sourceCurrency: "DKK", sourceCurrencyName: "Danish Krone", rate: 40.8500, change24h: -0.18, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-myr", baseCurrency: "PKR", sourceCurrency: "MYR", sourceCurrencyName: "Malaysian Ringgit", rate: 63.1200, change24h: 0.31, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-thb", baseCurrency: "PKR", sourceCurrency: "THB", sourceCurrencyName: "Thai Baht", rate: 8.1400, change24h: -0.05, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-krw", baseCurrency: "PKR", sourceCurrency: "KRW", sourceCurrencyName: "South Korean Won", rate: 0.2010, change24h: 0.41, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-zar", baseCurrency: "PKR", sourceCurrency: "ZAR", sourceCurrencyName: "South African Rand", rate: 14.8200, change24h: 0.55, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-try", baseCurrency: "PKR", sourceCurrency: "TRY", sourceCurrencyName: "Turkish Lira", rate: 7.6500, change24h: -0.92, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-brl", baseCurrency: "PKR", sourceCurrency: "BRL", sourceCurrencyName: "Brazilian Real", rate: 48.9000, change24h: -0.34, effectiveDate: SYNC_DAY, source: "API", status: "active" },
  { id: "mm-mxn", baseCurrency: "PKR", sourceCurrency: "MXN", sourceCurrencyName: "Mexican Peso", rate: 16.4300, change24h: 0.19, effectiveDate: SYNC_DAY, source: "API", status: "active" },
];

// Deterministic string hash so generated rates are stable across reloads.
function _hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function _generatedMidRate(code: string): number {
  const h = _hash(code);
  // Produce a rate in a plausible range. Exponent ∈ {-2,-1,0,1,2} spreads values
  // from ~0.01 up to ~1000 PKR per source unit.
  const exp = (h % 5) - 2;
  const base = 1 + ((h >> 3) % 999) / 100; // 1.00 .. 10.99
  return +(base * Math.pow(10, exp)).toFixed(4);
}

function _generatedChange24h(code: string): number {
  const h = _hash(code + "#c24");
  return +(((h % 401) - 200) / 100).toFixed(2); // -2.00 .. +2.00
}

/** Full mid-market rate list derived from the Currency Library. */
export const SEED_MID_MARKET_RATES: MidMarketRate[] = (() => {
  const seeded = new Map(HAND_SEEDED_MID_RATES.map((r) => [r.sourceCurrency, r]));
  const out: MidMarketRate[] = [];
  // Base currency against itself — always 1.0000
  out.push({
    id: `mm-${BASE_CURRENCY.toLowerCase()}`,
    baseCurrency: BASE_CURRENCY,
    sourceCurrency: BASE_CURRENCY,
    sourceCurrencyName: BASE_CURRENCY_NAME,
    rate: 1.0000,
    change24h: 0.00,
    effectiveDate: SYNC_DAY,
    source: "API",
    status: "active",
  });
  for (const c of SEED_CURRENCIES) {
    if (c.code === BASE_CURRENCY) continue;
    const existing = seeded.get(c.code);
    if (existing) {
      // The Currency Library's ISO name, so both tabs call a currency the same.
      out.push({ ...existing, sourceCurrencyName: c.name });
      continue;
    }
    out.push({
      id: `mm-${c.code.toLowerCase()}`,
      baseCurrency: BASE_CURRENCY,
      sourceCurrency: c.code,
      sourceCurrencyName: c.name,
      rate: _generatedMidRate(c.code),
      change24h: _generatedChange24h(c.code),
      effectiveDate: SYNC_DAY,
      source: "API",
      status: "active",
    });
  }
  return out.sort((a, b) => a.sourceCurrency.localeCompare(b.sourceCurrency));
})();

// ─── Standard (Corporate) Rates Seed Data ───
const HAND_SEEDED_STANDARD_RATES: StandardRate[] = [
  { id: "std-usd", baseCurrency: "PKR", sourceCurrency: "USD", sourceCurrencyName: "United States Dollar", standardRate: 279.0000, midMarketRate: 278.5200, variance: 0.17, effectiveDate: CORPORATE_EFFECTIVE, createdBy: "Ahtisham Ahmad", createdAt: CORPORATE_CREATED, updatedAt: CORPORATE_EFFECTIVE, notes: CORPORATE_NOTE, status: "active", isStale: false },
  { id: "std-eur", baseCurrency: "PKR", sourceCurrency: "EUR", sourceCurrencyName: "Euro", standardRate: 305.5000, midMarketRate: 304.8150, variance: 0.22, effectiveDate: CORPORATE_EFFECTIVE, createdBy: "Ahtisham Ahmad", createdAt: CORPORATE_CREATED, updatedAt: CORPORATE_EFFECTIVE, notes: CORPORATE_NOTE, status: "active", isStale: false },
  { id: "std-gbp", baseCurrency: "PKR", sourceCurrency: "GBP", sourceCurrencyName: "Pound Sterling", standardRate: 356.0000, midMarketRate: 355.4200, variance: 0.16, effectiveDate: CORPORATE_EFFECTIVE, createdBy: "Ahtisham Ahmad", createdAt: CORPORATE_CREATED, updatedAt: CORPORATE_EFFECTIVE, notes: CORPORATE_NOTE, status: "active", isStale: false },
  { id: "std-aed", baseCurrency: "PKR", sourceCurrency: "AED", sourceCurrencyName: "United Arab Emirates Dirham", standardRate: 76.0000, midMarketRate: 75.8400, variance: 0.21, effectiveDate: CORPORATE_EFFECTIVE, createdBy: "Ahtisham Ahmad", createdAt: CORPORATE_CREATED, updatedAt: CORPORATE_EFFECTIVE, notes: CORPORATE_NOTE, status: "active", isStale: false },
  { id: "std-sar", baseCurrency: "PKR", sourceCurrency: "SAR", sourceCurrencyName: "Saudi Riyal", standardRate: 74.5000, midMarketRate: 74.2700, variance: 0.31, effectiveDate: CORPORATE_EFFECTIVE, createdBy: "Ahtisham Ahmad", createdAt: CORPORATE_CREATED, updatedAt: CORPORATE_EFFECTIVE, notes: CORPORATE_NOTE, status: "active", isStale: false },
  { id: "std-cny", baseCurrency: "PKR", sourceCurrency: "CNY", sourceCurrencyName: "Renminbi", standardRate: 38.5000, midMarketRate: 38.3100, variance: 0.50, effectiveDate: CORPORATE_EFFECTIVE, createdBy: "Ahtisham Ahmad", createdAt: CORPORATE_CREATED, updatedAt: CORPORATE_EFFECTIVE, notes: CORPORATE_NOTE, status: "active", isStale: false },
];

/** Named as the Currency Library names them (ISO 4217), like the mid-market rates. */
export const SEED_STANDARD_RATES: StandardRate[] = HAND_SEEDED_STANDARD_RATES.map(r => ({
  ...r,
  sourceCurrencyName: SEED_CURRENCIES.find(c => c.code === r.sourceCurrency)?.name ?? r.sourceCurrencyName,
}));

// ─── Corporate rate audit seed ───
// One "Created" entry per seeded corporate rate: when it was set up, by whom,
// and the rate and effective date it was set to.
export const SEED_RATE_AUDIT: RateAuditEntry[] = SEED_STANDARD_RATES.map(r => ({
  id: `audit-${r.id}-created`,
  dateTime: `${r.createdAt}T14:30:00+05:00`,
  action: "Created" as const,
  user: r.createdBy,
  oldValue: null,
  newValue: r.standardRate,
  reason: "Initial corporate rate setup",
  sourceCurrency: r.sourceCurrency,
  rateId: r.id,
  effectiveDate: r.effectiveDate,
  midRate: r.midMarketRate,
}));

/** The active corporate rate record for a currency. Archived records are never current. */
export function activeStandardRateFor(code: string, rates: StandardRate[]): StandardRate | undefined {
  return rates.find(r => r.sourceCurrency === code && r.status === "active");
}

/** A record as it stands on `today`: a rate dated for later takes over once its day comes. */
export function settleStandardRate(r: StandardRate, today: string): StandardRate {
  if (!r.upcoming || r.upcoming.effectiveDate > today) return r;
  const { upcoming, ...rest } = r;
  return { ...rest, standardRate: upcoming.standardRate, effectiveDate: upcoming.effectiveDate, notes: upcoming.notes, updatedAt: upcoming.setAt };
}

/** Is the record's rate in effect on `today`? One added for a later date is not yet. */
export const isRateInEffect = (r: StandardRate, today: string) => r.status === "active" && r.effectiveDate <= today;

/** The corporate rate in effect for a currency on `today`, if any. */
export function corporateRateInEffect(code: string, rates: StandardRate[], today: string): StandardRate | undefined {
  const r = activeStandardRateFor(code, rates);
  return r && isRateInEffect(r, today) ? r : undefined;
}

/** The rate a record will move to, and when: its scheduled rate, or, for a
 *  record added for a later date, its own. Null when nothing is upcoming. */
export function upcomingRateOf(r: StandardRate, today: string): { standardRate: number; effectiveDate: string } | null {
  if (r.status !== "active") return null;
  if (r.effectiveDate > today) return { standardRate: r.standardRate, effectiveDate: r.effectiveDate };
  return r.upcoming ? { standardRate: r.upcoming.standardRate, effectiveDate: r.upcoming.effectiveDate } : null;
}

// ─── Mid-market history (deterministic) ───
// The provider's daily syncs for a pair, ending on the last sync. Seeded from the
// currency code, so a pair reads the same on every visit: the last point is the
// current rate and the one before it matches the stored 24h change.
export const MID_HISTORY_DAYS = 6 * 365;

function _mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _pad2 = (n: number) => String(n).padStart(2, "0");
const _isoDay = (d: Date) => `${d.getUTCFullYear()}-${_pad2(d.getUTCMonth() + 1)}-${_pad2(d.getUTCDate())}`;

export function midMarketHistory(rate: MidMarketRate, days: number = MID_HISTORY_DAYS): { date: string; mid: number }[] {
  const end = new Date(`${rate.effectiveDate}T00:00:00Z`);
  const n = Math.max(2, days + 1);
  const values = new Array<number>(n);
  if (rate.sourceCurrency === rate.baseCurrency) {
    values.fill(rate.rate);
  } else {
    const rand = _mulberry32(_hash(`${rate.sourceCurrency}#series`) || 1);
    // Daily volatility between 0.15% and 0.55%, and a slow upward drift of the
    // foreign currency against the rupee (read backwards, the rate falls).
    const vol = 0.0015 + (_hash(`${rate.sourceCurrency}#vol`) % 40) / 10000;
    const drift = 0.00018;
    values[n - 1] = rate.rate;
    values[n - 2] = rate.rate / (1 + rate.change24h / 100);
    for (let i = n - 3; i >= 0; i--) {
      // Sum of three uniforms: a cheap, bounded bell curve.
      const z = (rand() + rand() + rand() - 1.5) * 2;
      values[i] = values[i + 1] / (1 + drift + z * vol);
    }
  }
  const out: { date: string; mid: number }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - (n - 1 - i));
    out.push({ date: _isoDay(d), mid: +values[i].toFixed(4) });
  }
  return out;
}

// Scrambles a hash so neighbouring keys (consecutive days) land far apart.
function _mix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Documents priced in this pair on one day (deterministic, 3 to 22). */
export function pairTransactionsOn(code: string, isoDay: string): number {
  return 3 + (_mix(_hash(`${code}#${isoDay}`)) % 20);
}

// Last sync timestamp
export { LAST_SYNC };
export const SYNC_STATUS: "connected" | "disconnected" = "connected";
