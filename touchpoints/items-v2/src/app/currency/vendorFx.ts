import { BASE_CURRENCY, getCurrency, isBaseCurrency } from './currencies';
import { currencyDecimals, moneyPrefix } from './money';
import { DEFAULT_RATE_TYPE, LAST_SYNC, RATE_PROVIDER, rateOn, toBase, type RateType } from './rates';

/* ── Qualified-vendor prices (spec 4.1, 4.2, 3.5) ─────────────────────
 * Item prices stay in the base currency. A qualified vendor quotes in its
 * own currency, the partner's default, and every selling unit carries three
 * fields: the price in that currency, the exchange rate to the base
 * currency, and the price in base. Entering either price fills the other.
 * The rate is today's mid-market rate (read-only) or the corporate rate,
 * which can be changed for the vendor. */

export const localTodayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* The partner's default currency. The design's partners have a country but
   no currency yet, so it is seeded from the country (the audit's example:
   Adiant, Germany → EUR). A country not listed trades in USD, as the design
   priced every vendor in $. */
const COUNTRY_CURRENCY: Record<string, string> = {
  'United States': 'USD',
  'United Kingdom': 'GBP',
  Canada: 'CAD',
  Germany: 'EUR',
  France: 'EUR',
  Italy: 'EUR',
  Japan: 'JPY',
  China: 'CNY',
  Australia: 'AUD',
  'South Korea': 'KRW',
  Mexico: 'MXN',
  India: 'INR',
  Pakistan: 'PKR',
};

/** A partner's currency from its country, or from a location ending in one ("Aichi, Japan"). */
export function vendorCurrencyFor(countryOrLocation: string | null | undefined): string {
  const country = (countryOrLocation ?? '').split(',').pop()!.trim();
  return COUNTRY_CURRENCY[country] ?? 'USD';
}

/** Round to a currency's minor units (¥ has none). */
export function roundTo(code: string, value: number): number {
  const f = 10 ** currencyDecimals(code);
  return Math.round(value * f) / f;
}

export interface VendorRate {
  currency: string;
  /** Base currency per one unit of `currency`. */
  rate: number;
  rateType: RateType;
  /** The day the rate is for: today. */
  rateDate: string;
  /** For the Money hover: "Open Exchange Rates", "Corporate rate", … */
  source: string;
  /** A corporate rate entered for this vendor instead of finance's. */
  edited: boolean;
  /** Finance's corporate rate for today, when there is one. */
  corporateRate: number | null;
}

/** The rate a vendor's prices convert at: today's, of the vendor's rate type.
 *  A corporate rate typed for the vendor wins; with no corporate rate set
 *  for the currency, the mid-market rate fills the (editable) corporate
 *  field until one is entered. */
export function vendorRate(
  currency: string | null | undefined,
  opts: { rateType?: RateType; exchangeRate?: string | number } = {},
): VendorRate {
  const code = (currency || BASE_CURRENCY).toUpperCase();
  const today = localTodayIso();
  const rateType = opts.rateType ?? DEFAULT_RATE_TYPE;
  const corporate = isBaseCurrency(code) ? 1 : rateOn(code, today, 'corporate').rate;
  if (isBaseCurrency(code)) {
    return { currency: code, rate: 1, rateType, rateDate: today, source: 'Base currency', edited: false, corporateRate: 1 };
  }
  const typed = Number(opts.exchangeRate);
  if (rateType === 'corporate' && Number.isFinite(typed) && typed > 0) {
    const edited = typed !== corporate;
    return {
      currency: code,
      rate: typed,
      rateType,
      rateDate: today,
      source: edited ? 'Corporate rate, entered for this vendor' : 'Corporate rate',
      edited,
      corporateRate: corporate,
    };
  }
  if (rateType === 'corporate' && corporate != null) {
    return { currency: code, rate: corporate, rateType, rateDate: today, source: 'Corporate rate', edited: false, corporateRate: corporate };
  }
  const mid = rateOn(code, today, 'mid').rate ?? 1;
  if (rateType === 'corporate') {
    return { currency: code, rate: mid, rateType, rateDate: today, source: 'No corporate rate set; mid-market shown', edited: false, corporateRate: null };
  }
  return { currency: code, rate: mid, rateType: 'mid', rateDate: today, source: RATE_PROVIDER, edited: false, corporateRate: corporate };
}

/** A vendor-currency price in base, at a rate. */
export const priceInBase = (price: number, rate: number) => toBase(price, rate);

/** A base price in the vendor's currency, at a rate, to its minor units. */
export const priceFromBase = (base: number, rate: number, code: string) => (rate > 0 ? roundTo(code, base / rate) : 0);

/* ── The design's figures ─────────────────────────────────────────────
 * The design writes every amount in USD. Vendor amounts are restated in the
 * vendor's currency, and item amounts (which stay in base) in PKR, at the
 * mid-market rate of the last sync. */
const LAST_SYNC_DAY = LAST_SYNC.slice(0, 10);

export function fromUsd(amount: number, code: string): number {
  const to = code.toUpperCase();
  if (to === 'USD' || !amount) return amount;
  const usd = rateOn('USD', LAST_SYNC_DAY, 'mid').rate ?? 1;
  const rate = rateOn(to, LAST_SYNC_DAY, 'mid').rate ?? 1;
  return roundTo(to, (amount * usd) / rate);
}

/** A design amount (USD) in the base currency. */
export const usdToBase = (amount: number) => fromUsd(amount, BASE_CURRENCY);

/** The currency prefix for a vendor-price input: "€", "¥", "MXN". */
export const pricePrefix = (code: string) => moneyPrefix(code).trim();

/** A whole amount in a currency with its code: "¥2,896,000 JPY", "$20,000 USD". */
export function formatWhole(value: number, code: string): string {
  const prefix = moneyPrefix(code);
  const n = Math.round(value).toLocaleString('en-US');
  return prefix.trim() === code.toUpperCase() ? `${prefix}${n}` : `${prefix}${n} ${code.toUpperCase()}`;
}

/** The currency's name, for labels: "Euro". */
export const currencyName = (code: string) => getCurrency(code)?.name ?? code;

/** A qualified vendor's rate, from its row (currency + captured config). */
export const qvRate = (qv: { currency: string; config?: { rateType?: RateType; exchangeRate?: string } }) =>
  vendorRate(qv.currency, { rateType: qv.config?.rateType, exchangeRate: qv.config?.exchangeRate });
