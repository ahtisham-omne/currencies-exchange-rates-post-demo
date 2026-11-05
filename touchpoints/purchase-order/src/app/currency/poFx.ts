import { BASE_CURRENCY, getCurrency, isBaseCurrency } from './currencies';
import { currencyDecimals } from './money';
import { DEFAULT_RATE_TYPE, RATE_PROVIDER, rateOn, toBase, type RateType } from './rates';

/* ── A PO's currency and rate (spec 4.3) ──────────────────────────────
 * A PO is written in one currency: the vendor's default (spec 4.2) unless
 * the buyer changes it from Order Summary. Every line, total, discount and
 * adjustment on it is in that currency. It carries the rate taken on its PO
 * date: mid-market (read-only) or corporate (editable on the PO). The
 * listing's base-currency KPIs, the cart's grand total and Vendor
 * Invoicing's rate comparison all convert through here. */

export interface PoFx {
  currency: string;
  /** Base currency per one unit of `currency` (1 for the base currency). */
  rate: number;
  rateType: RateType;
  /** The day the rate is for: the PO date. */
  rateDate: string;
  /** "Open Exchange Rates", "Corporate rate", "Corporate rate, changed on the PO". */
  source: string;
  /** Money.tsx's hover reads it; a PO always has its rate. */
  provisional: false;
  isBase: boolean;
}

export interface PoFxFields {
  currency?: string;
  exchangeRate?: number;
  rateType?: RateType;
  rateDate?: string;
  rateEdited?: boolean;
  orderDate?: string;
  vendor?: { name?: string } | null;
}

export const localTodayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function rateSourceLabel(type: RateType, edited?: boolean): string {
  if (type === 'mid') return RATE_PROVIDER;
  return edited ? 'Corporate rate, changed on the PO' : 'Corporate rate';
}

/** A PO's currency: its own, else its vendor's default. */
export function poCurrency(po: PoFxFields): string {
  return (po.currency || vendorCurrency(po.vendor?.name)).toUpperCase();
}

export function poFx(po: PoFxFields): PoFx {
  const currency = poCurrency(po);
  const rateType = po.rateType ?? DEFAULT_RATE_TYPE;
  const docDate = po.rateDate || po.orderDate || localTodayIso();
  if (isBaseCurrency(currency)) {
    return { currency, rate: 1, rateType, rateDate: docDate, source: 'Base currency', provisional: false, isBase: true };
  }
  if (po.exchangeRate && po.exchangeRate > 0) {
    return {
      currency,
      rate: po.exchangeRate,
      rateType,
      rateDate: docDate,
      source: rateSourceLabel(rateType, po.rateEdited),
      provisional: false,
      isBase: false,
    };
  }
  // No rate stamped (a PO saved before it had one): the rate on its PO date.
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

/** A PO amount (its total, a line, a discount…) in the base currency. */
export const toPOBase = (po: PoFxFields, amount: number) => toBase(amount, poFx(po).rate);

/** The currency fields to stamp on a PO, with the rate taken on its PO date.
 *  A corporate rate falls back to mid-market when finance has none set. */
export function stampPoRate(
  currency: string,
  orderDate: string,
  rateType: RateType = DEFAULT_RATE_TYPE,
): { currency: string; exchangeRate: number; rateType: RateType; rateDate: string; rateEdited: false } {
  const code = currency.toUpperCase();
  const quote = rateOn(code, orderDate, rateType);
  const usable = quote.rate != null ? quote : rateOn(code, orderDate, 'mid');
  return { currency: code, exchangeRate: usable.rate ?? 1, rateType: usable.type, rateDate: orderDate.slice(0, 10), rateEdited: false };
}

/** Today's rate (mid-market) for a currency: the cart, before a PO exists. */
export const todayRate = (code: string) => rateOn(code, localTodayIso(), 'mid').rate ?? 1;

/** An amount in a currency, in base at today's mid-market rate. */
export const toBaseToday = (amount: number, code: string) => toBase(amount, todayRate(code));

/** Today's rate for a Money hover, before a PO exists (cart, item modal). */
export const todayFx = (code: string) => ({
  rate: todayRate(code),
  rateType: 'mid' as const,
  rateDate: localTodayIso(),
  source: RATE_PROVIDER,
  provisional: true,
});

/** An amount in `from`, in the PO's currency at the PO's rate (a vendor's
 *  quote added to, or edited on, a PO in another currency). */
export function toPOCurrency(amount: number, from: string, po: PoFxFields): number {
  const fx = poFx(po);
  if (from.toUpperCase() === fx.currency) return amount;
  const fromRate = rateOn(from, fx.rateDate, 'mid').rate ?? 1;
  return roundTo(fx.currency, amount * crossRate(fromRate, fx.rate));
}

/** The reverse: a PO amount in another currency (`to`), at the PO's rate. */
export function fromPOCurrency(amount: number, to: string, po: PoFxFields): number {
  const fx = poFx(po);
  if (to.toUpperCase() === fx.currency) return amount;
  const toRate = rateOn(to, fx.rateDate, 'mid').rate ?? 1;
  return roundTo(to, amount * crossRate(fx.rate, toRate));
}

/** Round to a currency's minor units (¥ has none, KWD has three). */
export function roundTo(code: string, value: number): number {
  const f = 10 ** currencyDecimals(code);
  return Math.round(value * f) / f;
}

/** One unit of `from` in `to`, through base, at the two rates given. */
export const crossRate = (fromRate: number, toRate: number) => (toRate > 0 ? fromRate / toRate : 1);

/* ── Pricing-rule flat amounts ────────────────────────────────────────
 * Rule tiers are quantity bands; a "$" tier takes a flat amount off (or
 * adds it to) each unit. The rule book writes those amounts in USD, as
 * Partners does; on a PO they are converted to its currency at the
 * mid-market cross rate on its PO date (today's for the cart). Not at the
 * PO's own rate: that is the rate to base, and changing it (mid-market to
 * corporate, a rate typed on the PO) must not change the PO's total. The
 * multiplier below turns a USD amount into one in the document's currency. */
export const RULE_AMOUNT_CURRENCY = 'USD';

export function ruleAmountFactor(fx: { currency: string; rateDate: string }): number {
  if (fx.currency.toUpperCase() === RULE_AMOUNT_CURRENCY) return 1;
  const usd = rateOn(RULE_AMOUNT_CURRENCY, fx.rateDate, 'mid').rate ?? 1;
  const doc = rateOn(fx.currency, fx.rateDate, 'mid').rate ?? 1;
  return crossRate(usd, doc);
}

/** The same multiplier for a vendor group in the cart (today's rates). */
export const ruleAmountFactorToday = (code: string) => ruleAmountFactor({ currency: code, rateDate: localTodayIso() });

/* ── A vendor's default currency (spec 4.2) ───────────────────────────
 * The partner record's default currency, carried over from the earlier
 * Purchase Orders touchpoint (catalogData's VENDOR_CURRENCIES there) so the
 * same vendor keeps the same currency. A vendor not listed (Procurement
 * Planning's suppliers) is a local one and trades in the base currency. */
export const VENDOR_CURRENCIES: Record<string, string> = {
  // North American OEMs
  'General Motors (GM)': 'USD',
  'Ford Motor Company': 'USD',
  'Tesla, Inc.': 'USD',
  'Rivian Automotive': 'USD',
  'Lucid Motors': 'USD',
  'Chrysler (Stellantis N.V.)': 'EUR',
  // Japanese OEMs
  'Toyota Technical Center (TTC)': 'JPY',
  'Honda Motor Co., Ltd. (USA)': 'JPY',
  'Nissan North America': 'JPY',
  // European OEMs
  'BMW of North America': 'EUR',
  // Tier-1 suppliers, extended network
  'Bosch Rexroth': 'EUR',
  'Continental AG': 'EUR',
  'ZF Friedrichshafen': 'EUR',
  'Valeo SA': 'EUR',
  'Denso Corporation': 'JPY',
  'Aisin Corporation': 'JPY',
  'Schaeffler Group': 'EUR',
  'BorgWarner Inc.': 'USD',
  'Dana Incorporated': 'USD',
  'Magna International': 'CAD',
  'Aptiv PLC': 'USD',
  'Hyundai Mobis': 'KRW',
  'Sensata Technologies': 'USD',
  'Eaton Corporation': 'USD',
  'Parker Hannifin': 'USD',
  'Cummins Inc.': 'USD',
  'Timken Company': 'USD',
  'SKF Group': 'EUR',
  'Flex-N-Gate': 'USD',
};

export function vendorCurrency(vendorName: string | null | undefined): string {
  if (!vendorName) return BASE_CURRENCY;
  const code = VENDOR_CURRENCIES[vendorName.trim()];
  return code && getCurrency(code) ? code : BASE_CURRENCY;
}
