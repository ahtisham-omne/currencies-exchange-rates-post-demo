import { BASE_CURRENCY, getCurrency, isBaseCurrency } from './currencies';
import { currencyDecimals } from './money';
import { DEFAULT_RATE_TYPE, LAST_SYNC, RATE_PROVIDER, rateOn, toBase, type RateType } from './rates';

/* ── A quote's currency and rate (spec 4.3, 4.2) ─────────────────────
 * Same document-level behaviour as Purchase Orders, defaulted from the
 * customer: a quote is written in one currency, the customer's default
 * unless the rep changes it from Quote Summary. Every line, total, rule
 * and adjustment on it is in that currency. It carries the rate taken on
 * its quote date (the created date): mid-market (read-only) or corporate
 * (editable on the quote). A quote converted to a sales order keeps its
 * currency and rate. The listing's base-currency KPIs convert each quote
 * through here before adding up. */

export interface QuoteFx {
  currency: string;
  /** Base currency per one unit of `currency` (1 for the base currency). */
  rate: number;
  rateType: RateType;
  /** The day the rate is for: the quote date. */
  rateDate: string;
  /** "Open Exchange Rates", "Corporate rate", "Corporate rate, changed on the quote". */
  source: string;
  /** Money.tsx's hover reads it; a quote always has its rate. */
  provisional: false;
  isBase: boolean;
}

export interface QuoteFxFields {
  currency?: string;
  exchangeRate?: number;
  rateType?: RateType;
  rateDate?: string;
  rateEdited?: boolean;
  createdDate?: Date | string;
  customer?: { name?: string } | null;
}

export const localTodayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A date (a Date, "2026-11-01", "2026/11/01T…") as an ISO day. */
export const isoDay = (date: Date | string | null | undefined): string => {
  if (!date) return localTodayIso();
  /* The day the page shows for it: the design writes a quote's dates from
     toISOString() (QuoteDetails' createdDate), so the rate date matches. */
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return date.replace(/\//g, '-').slice(0, 10);
};

export function rateSourceLabel(type: RateType, edited?: boolean): string {
  if (type === 'mid') return RATE_PROVIDER;
  return edited ? 'Corporate rate, changed on the quote' : 'Corporate rate';
}

/** A quote's currency: its own, else its customer's default. */
export function quoteCurrency(q: QuoteFxFields): string {
  return (q.currency || customerCurrency(q.customer?.name)).toUpperCase();
}

export function quoteFx(q: QuoteFxFields): QuoteFx {
  const currency = quoteCurrency(q);
  const rateType = q.rateType ?? DEFAULT_RATE_TYPE;
  const docDate = isoDay(q.rateDate || q.createdDate);
  if (isBaseCurrency(currency)) {
    return { currency, rate: 1, rateType, rateDate: docDate, source: 'Base currency', provisional: false, isBase: true };
  }
  if (q.exchangeRate && q.exchangeRate > 0) {
    return {
      currency,
      rate: q.exchangeRate,
      rateType,
      rateDate: docDate,
      source: rateSourceLabel(rateType, q.rateEdited),
      provisional: false,
      isBase: false,
    };
  }
  // No rate stamped (a quote saved before it had one): the rate on its quote date.
  const quote = rateOn(currency, docDate, rateType);
  const usable = quote.rate != null ? quote : rateOn(currency, docDate, 'mid');
  return {
    currency,
    rate: usable.rate ?? 1,
    rateType: usable.type,
    rateDate: docDate,
    source: rateSourceLabel(usable.type),
    provisional: false,
    isBase: false,
  };
}

/** A quote amount (its total, a line, a rule…) in the base currency. */
export const toQuoteBase = (q: QuoteFxFields, amount: number) => toBase(amount, quoteFx(q).rate);

/** The currency fields to stamp on a quote, with the rate taken on its quote
 *  date. A corporate rate falls back to mid-market when finance has none set. */
export function stampQuoteRate(
  currency: string,
  quoteDate: Date | string,
  rateType: RateType = DEFAULT_RATE_TYPE,
): { currency: string; exchangeRate: number; rateType: RateType; rateDate: string; rateEdited: false } {
  const code = currency.toUpperCase();
  const day = isoDay(quoteDate);
  const quote = rateOn(code, day, rateType);
  const usable = quote.rate != null ? quote : rateOn(code, day, 'mid');
  return { currency: code, exchangeRate: usable.rate ?? 1, rateType: usable.type, rateDate: day, rateEdited: false };
}

/** Today's rate (mid-market) for a currency: creating a quote, before it exists. */
export const todayRate = (code: string) => rateOn(code, localTodayIso(), 'mid').rate ?? 1;

/** Today's rate for a Money hover, before a quote exists. */
export const todayFx = (code: string) => ({
  rate: todayRate(code),
  rateType: 'mid' as const,
  rateDate: localTodayIso(),
  source: RATE_PROVIDER,
  provisional: true,
});

/** Round to a currency's minor units (¥ has none, KWD has three). */
export function roundTo(code: string, value: number): number {
  const f = 10 ** currencyDecimals(code);
  return Math.round(value * f) / f;
}

/** One unit of `from` in `to`, through base, at the two rates given. */
export const crossRate = (fromRate: number, toRate: number) => (toRate > 0 ? fromRate / toRate : 1);

/** An amount in `from`, in `to`, at the mid-market rates on a day. */
export function convertOn(amount: number, from: string, to: string, day: Date | string): number {
  if (from.toUpperCase() === to.toUpperCase() || !amount) return amount;
  const fromRate = rateOn(from, isoDay(day), 'mid').rate ?? 1;
  const toRate = rateOn(to, isoDay(day), 'mid').rate ?? 1;
  return roundTo(to, amount * crossRate(fromRate, toRate));
}

/* ── The design's figures ─────────────────────────────────────────────
 * The design writes every amount in USD. A seeded quote in another
 * currency is restated once in it at the mid-market rate on its quote
 * date (the last synced rate for a date after the last sync). */
export const DESIGN_CURRENCY = 'USD';
export const LAST_SYNC_DAY = LAST_SYNC.slice(0, 10);

/* ── Pricing-rule flat amounts ────────────────────────────────────────
 * Rule tiers are quantity bands; a "$" tier takes a flat amount off (or
 * adds it to) each unit. The rule book writes those amounts in USD, as
 * Partners, Purchase Orders and Sales Orders do; on a quote they are
 * converted to its currency at the mid-market cross rate on its quote
 * date. Not at the quote's own rate: that is the rate to base, and
 * changing it (mid-market to corporate, a rate typed on the quote) must
 * not change the quote's total. */
export const RULE_AMOUNT_CURRENCY = 'USD';

export function ruleAmountFactor(fx: { currency: string; rateDate: string }): number {
  if (fx.currency.toUpperCase() === RULE_AMOUNT_CURRENCY) return 1;
  const usd = rateOn(RULE_AMOUNT_CURRENCY, fx.rateDate, 'mid').rate ?? 1;
  const doc = rateOn(fx.currency, fx.rateDate, 'mid').rate ?? 1;
  return crossRate(usd, doc);
}

/* ── A customer's default currency (spec 4.3, 4.2) ────────────────────
 * The partner record's default currency. The design's customers are all
 * US agencies trading in USD; six are seeded with another currency so the
 * listing shows quotes in different currencies, one of them in the base
 * currency. The same map as Sales Orders (with the design's spelling
 * "Valley Health System" here), so a quote and the order made from it
 * agree. A customer not listed trades in USD, as the design
 * priced every quote in $. */
export const CUSTOMER_CURRENCIES: Record<string, string> = {
  'Lakewood Community Hospital': 'EUR',
  'Summit Regional Medical Center': 'GBP',
  'Pacific Northwest Ambulance': 'CAD',
  'Pacific Northwest Ambulance Co.': 'CAD',
  'Heartland Air Ambulance': 'AED',
  'Coastal Search & Rescue': 'JPY',
  'Valley Health Systems': BASE_CURRENCY,
  'Valley Health System': BASE_CURRENCY,
};

export function customerCurrency(customerName: string | null | undefined): string {
  const code = customerName ? CUSTOMER_CURRENCIES[customerName.trim()] : undefined;
  return code && getCurrency(code) ? code : DESIGN_CURRENCY;
}
