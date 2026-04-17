// ─── Exchange Rate Library — Data Model & Seed Data ───
import { SEED_CURRENCIES } from "./currencies";

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
  status: "active" | "inactive";
  isStale: boolean; // not updated in 30+ days
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

export interface CurrencyPairDetail {
  pairCode: string;
  sourceCurrency: string;
  baseCurrency: string;
  sourceCurrencyName: string;
  currentMidRate: number;
  currentStdRate: number | null;
  change24h: number;
  change7d: number;
  change30d: number;
  changeYtd: number;
  high30d: number;
  low30d: number;
  volatility30d: number;
  avgRate30d: number;
  high52w: number;
  low52w: number;
  transactions30d: number;
  lastSyncTimestamp: string;
  variance: number | null;
  stdEffectiveDate: string | null;
  stdSetBy: string | null;
  rateHistory: RateHistoryEntry[];
  auditLog: AuditEntry[];
  // Time series for charts (daily close for last 90 days simplified)
  timeSeries: { date: string; mid: number; std: number | null }[];
}

// Base currency is PKR
export const BASE_CURRENCY = "PKR";
export const BASE_CURRENCY_NAME = "Pakistani Rupee";
export const API_PROVIDER = "Open Exchange Rates";
export const SYNC_FREQUENCY = "Every 30 min";
export const DEFAULT_RATE_TYPE: "MID" | "STD" = "MID";

// Helper to generate a realistic rate with slight randomness
function r(base: number, spread: number = 0.02): number {
  return +(base * (1 + (Math.random() - 0.5) * spread)).toFixed(4);
}

// Generate time series data for a pair
function generateTimeSeries(baseRate: number, days: number = 90, stdRate: number | null = null): { date: string; mid: number; std: number | null }[] {
  const series: { date: string; mid: number; std: number | null }[] = [];
  const now = new Date("2026-04-10");
  let currentRate = baseRate * (1 + (Math.random() - 0.5) * 0.03);
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    currentRate += currentRate * (Math.random() - 0.495) * 0.008;
    series.push({
      date: d.toISOString().slice(0, 10),
      mid: +currentRate.toFixed(4),
      std: stdRate ? +(stdRate * (1 + (Math.random() - 0.5) * 0.001)).toFixed(4) : null,
    });
  }
  // ensure latest entry matches the actual rate
  if (series.length > 0) series[series.length - 1].mid = baseRate;
  return series;
}

// Generate rate history with 24h intervals (matching sync frequency)
function generateRateHistory(midRate: number, stdRate: number | null): RateHistoryEntry[] {
  const entries: RateHistoryEntry[] = [];
  const now = new Date("2026-04-10T19:30:00+05:00");
  // Generate 30 daily mid-market history entries (one per 24h sync)
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    entries.push({
      id: `rh-mid-${i}`,
      effectiveDate: d.toISOString(),
      rateType: "MID",
      rateValue: +(midRate * (1 + (Math.random() - 0.5) * 0.02)).toFixed(4),
      varianceVsMid: null,
      setBy: "API Sync",
      source: API_PROVIDER,
    });
  }
  // Ensure latest entry has the actual current rate
  if (entries.length > 0) entries[entries.length - 1].rateValue = midRate;
  if (stdRate) {
    entries.push({
      id: "rh-std-1",
      effectiveDate: "2026-03-15T14:30:00+05:00",
      rateType: "STD",
      rateValue: stdRate,
      varianceVsMid: +((stdRate - midRate) / midRate * 100).toFixed(2),
      setBy: "Ahtisham Ahmad",
      source: "Manual",
    });
  }
  return entries.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
}

function generateAuditLog(stdRate: number | null): AuditEntry[] {
  if (!stdRate) return [];
  return [
    {
      id: "audit-1",
      dateTime: "2026-03-15T14:30:00Z",
      action: "Created",
      user: "Ahtisham Ahmad",
      oldValue: null,
      newValue: stdRate,
      reason: "Initial corporate rate setup",
    },
  ];
}

// ─── Mid-Market Rates Seed Data ───
// All rates are relative to PKR (base), so USD/PKR = 278.52 means 1 USD = 278.52 PKR.
// Hand-seeded rates below cover real quotable currencies; the rest are filled in
// deterministically from the Currency Library so every active currency has a rate.
const HAND_SEEDED_MID_RATES: MidMarketRate[] = [
  { id: "mm-usd", baseCurrency: "PKR", sourceCurrency: "USD", sourceCurrencyName: "United States Dollar", rate: 278.5200, change24h: 0.12, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-eur", baseCurrency: "PKR", sourceCurrency: "EUR", sourceCurrencyName: "Euro", rate: 304.8150, change24h: -0.23, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-gbp", baseCurrency: "PKR", sourceCurrency: "GBP", sourceCurrencyName: "British Pound Sterling", rate: 355.4200, change24h: 0.35, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-aed", baseCurrency: "PKR", sourceCurrency: "AED", sourceCurrencyName: "United Arab Emirates Dirham", rate: 75.8400, change24h: 0.02, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-sar", baseCurrency: "PKR", sourceCurrency: "SAR", sourceCurrencyName: "Saudi Riyal", rate: 74.2700, change24h: -0.01, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-cny", baseCurrency: "PKR", sourceCurrency: "CNY", sourceCurrencyName: "Chinese Yuan", rate: 38.3100, change24h: -0.45, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-jpy", baseCurrency: "PKR", sourceCurrency: "JPY", sourceCurrencyName: "Japanese Yen", rate: 1.9230, change24h: 0.08, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-inr", baseCurrency: "PKR", sourceCurrency: "INR", sourceCurrencyName: "Indian Rupee", rate: 3.2700, change24h: 0.15, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-aud", baseCurrency: "PKR", sourceCurrency: "AUD", sourceCurrencyName: "Australian Dollar", rate: 178.3500, change24h: -0.19, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-cad", baseCurrency: "PKR", sourceCurrency: "CAD", sourceCurrencyName: "Canadian Dollar", rate: 199.8700, change24h: 0.05, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-chf", baseCurrency: "PKR", sourceCurrency: "CHF", sourceCurrencyName: "Swiss Franc", rate: 315.6100, change24h: 0.28, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-nzd", baseCurrency: "PKR", sourceCurrency: "NZD", sourceCurrencyName: "New Zealand Dollar", rate: 162.4500, change24h: -0.11, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-sgd", baseCurrency: "PKR", sourceCurrency: "SGD", sourceCurrencyName: "Singapore Dollar", rate: 210.1400, change24h: 0.14, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-hkd", baseCurrency: "PKR", sourceCurrency: "HKD", sourceCurrencyName: "Hong Kong Dollar", rate: 35.7100, change24h: 0.09, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-sek", baseCurrency: "PKR", sourceCurrency: "SEK", sourceCurrencyName: "Swedish Krona", rate: 27.1400, change24h: -0.07, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-nok", baseCurrency: "PKR", sourceCurrency: "NOK", sourceCurrencyName: "Norwegian Krone", rate: 26.5500, change24h: 0.22, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-dkk", baseCurrency: "PKR", sourceCurrency: "DKK", sourceCurrencyName: "Danish Krone", rate: 40.8500, change24h: -0.18, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-myr", baseCurrency: "PKR", sourceCurrency: "MYR", sourceCurrencyName: "Malaysian Ringgit", rate: 63.1200, change24h: 0.31, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-thb", baseCurrency: "PKR", sourceCurrency: "THB", sourceCurrencyName: "Thai Baht", rate: 8.1400, change24h: -0.05, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-krw", baseCurrency: "PKR", sourceCurrency: "KRW", sourceCurrencyName: "South Korean Won", rate: 0.2010, change24h: 0.41, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-zar", baseCurrency: "PKR", sourceCurrency: "ZAR", sourceCurrencyName: "South African Rand", rate: 14.8200, change24h: 0.55, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-try", baseCurrency: "PKR", sourceCurrency: "TRY", sourceCurrencyName: "Turkish Lira", rate: 7.6500, change24h: -0.92, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-brl", baseCurrency: "PKR", sourceCurrency: "BRL", sourceCurrencyName: "Brazilian Real", rate: 48.9000, change24h: -0.34, effectiveDate: "2026-04-10", source: "API", status: "active" },
  { id: "mm-mxn", baseCurrency: "PKR", sourceCurrency: "MXN", sourceCurrencyName: "Mexican Peso", rate: 16.4300, change24h: 0.19, effectiveDate: "2026-04-10", source: "API", status: "active" },
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
    effectiveDate: "2026-04-10",
    source: "API",
    status: "active",
  });
  for (const c of SEED_CURRENCIES) {
    if (c.code === BASE_CURRENCY) continue;
    const existing = seeded.get(c.code);
    if (existing) {
      out.push(existing);
      continue;
    }
    out.push({
      id: `mm-${c.code.toLowerCase()}`,
      baseCurrency: BASE_CURRENCY,
      sourceCurrency: c.code,
      sourceCurrencyName: c.name,
      rate: _generatedMidRate(c.code),
      change24h: _generatedChange24h(c.code),
      effectiveDate: "2026-04-10",
      source: "API",
      status: "active",
    });
  }
  return out.sort((a, b) => a.sourceCurrency.localeCompare(b.sourceCurrency));
})();

// ─── Standard (Corporate) Rates Seed Data ───
export const SEED_STANDARD_RATES: StandardRate[] = [
  { id: "std-usd", baseCurrency: "PKR", sourceCurrency: "USD", sourceCurrencyName: "United States Dollar", standardRate: 279.0000, midMarketRate: 278.5200, variance: 0.17, effectiveDate: "2026-04-01", createdBy: "Ahtisham Ahmad", createdAt: "2026-03-15", updatedAt: "2026-04-01", notes: "Q2 2026 corporate rate", status: "active", isStale: false },
  { id: "std-eur", baseCurrency: "PKR", sourceCurrency: "EUR", sourceCurrencyName: "Euro", standardRate: 305.5000, midMarketRate: 304.8150, variance: 0.22, effectiveDate: "2026-04-01", createdBy: "Ahtisham Ahmad", createdAt: "2026-03-15", updatedAt: "2026-04-01", notes: "Q2 2026 corporate rate", status: "active", isStale: false },
  { id: "std-gbp", baseCurrency: "PKR", sourceCurrency: "GBP", sourceCurrencyName: "British Pound Sterling", standardRate: 356.0000, midMarketRate: 355.4200, variance: 0.16, effectiveDate: "2026-04-01", createdBy: "Ahtisham Ahmad", createdAt: "2026-03-15", updatedAt: "2026-04-01", notes: "Q2 2026 corporate rate", status: "active", isStale: false },
  { id: "std-aed", baseCurrency: "PKR", sourceCurrency: "AED", sourceCurrencyName: "United Arab Emirates Dirham", standardRate: 76.0000, midMarketRate: 75.8400, variance: 0.21, effectiveDate: "2026-04-01", createdBy: "Ahtisham Ahmad", createdAt: "2026-03-15", updatedAt: "2026-04-01", notes: "Q2 2026 corporate rate", status: "active", isStale: false },
  { id: "std-sar", baseCurrency: "PKR", sourceCurrency: "SAR", sourceCurrencyName: "Saudi Riyal", standardRate: 74.5000, midMarketRate: 74.2700, variance: 0.31, effectiveDate: "2026-04-01", createdBy: "Ahtisham Ahmad", createdAt: "2026-03-15", updatedAt: "2026-04-01", notes: "Q2 2026 corporate rate", status: "active", isStale: false },
  { id: "std-cny", baseCurrency: "PKR", sourceCurrency: "CNY", sourceCurrencyName: "Chinese Yuan", standardRate: 38.5000, midMarketRate: 38.3100, variance: 0.50, effectiveDate: "2026-04-01", createdBy: "Ahtisham Ahmad", createdAt: "2026-03-15", updatedAt: "2026-04-01", notes: "Q2 2026 corporate rate", status: "active", isStale: false },
];

// ─── Pair Detail Generator ───
export function generatePairDetail(sourceCurrency: string): CurrencyPairDetail | null {
  const mid = SEED_MID_MARKET_RATES.find(r => r.sourceCurrency === sourceCurrency);
  if (!mid) return null;
  const std = SEED_STANDARD_RATES.find(r => r.sourceCurrency === sourceCurrency);

  const baseRate = mid.rate;
  const timeSeries = generateTimeSeries(baseRate, 90, std?.standardRate || null);
  const mids = timeSeries.map(t => t.mid);
  const high30 = Math.max(...mids.slice(-30));
  const low30 = Math.min(...mids.slice(-30));
  const avg30 = mids.slice(-30).reduce((s, v) => s + v, 0) / 30;
  const dailyChanges = mids.slice(-30).map((v, i, a) => i > 0 ? (v - a[i - 1]) / a[i - 1] * 100 : 0).slice(1);
  const mean = dailyChanges.reduce((s, v) => s + v, 0) / dailyChanges.length;
  const volatility = Math.sqrt(dailyChanges.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyChanges.length);

  return {
    pairCode: `${sourceCurrency}/${BASE_CURRENCY}`,
    sourceCurrency: mid.sourceCurrency,
    baseCurrency: BASE_CURRENCY,
    sourceCurrencyName: mid.sourceCurrencyName,
    currentMidRate: baseRate,
    currentStdRate: std?.standardRate || null,
    change24h: mid.change24h,
    change7d: +(mid.change24h * 3.2 + (Math.random() - 0.5) * 0.4).toFixed(2),
    change30d: +(mid.change24h * 8.5 + (Math.random() - 0.5) * 1.2).toFixed(2),
    changeYtd: +(mid.change24h * 22 + (Math.random() - 0.5) * 3).toFixed(2),
    high30d: +high30.toFixed(4),
    low30d: +low30.toFixed(4),
    volatility30d: +volatility.toFixed(3),
    avgRate30d: +avg30.toFixed(4),
    high52w: +(baseRate * 1.08).toFixed(4),
    low52w: +(baseRate * 0.92).toFixed(4),
    transactions30d: Math.floor(Math.random() * 400) + 50,
    lastSyncTimestamp: LAST_SYNC,
    variance: std ? +((std.standardRate - baseRate) / baseRate * 100).toFixed(2) : null,
    stdEffectiveDate: std?.effectiveDate || null,
    stdSetBy: std?.createdBy || null,
    rateHistory: generateRateHistory(baseRate, std?.standardRate || null),
    auditLog: generateAuditLog(std?.standardRate || null),
    timeSeries,
  };
}

// Last sync timestamp
export const LAST_SYNC = "2026-04-10T14:30:00Z";
export const SYNC_STATUS: "connected" | "disconnected" = "connected";
