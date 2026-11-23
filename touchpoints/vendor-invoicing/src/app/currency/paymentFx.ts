import type { Invoice } from '@/app/data/mockInvoices';
import type { Payment } from '@/app/data/mockPayments';
import { isBaseCurrency } from './currencies';
import { invoiceFx, rateSourceLabel, type InvoiceFx } from './invoiceFx';
import { DEFAULT_RATE_TYPE, midRateOn, rateOn, toBase, type RateType } from './rates';

/* ── A payment's currency and rate (Currency & Exchange Rates) ────────
 * A payment is in the currency of the invoices it settles: that is what the
 * vendor receives (currency/paymentRules.ts). It goes out from an account in
 * that currency or in the base currency. Its rate, base per one unit:
 *  - from a base account, worked out from the bank's two figures (the
 *    rupees it took for the pounds the vendor got);
 *  - from an account in the invoices' currency, nothing converts, and the
 *    pounds are valued at the mid-market rate on the payment date.
 * Settling invoices booked at their own rates at it leaves the realized FX
 * Gain/Loss: a gain when paying costs less in the base currency than A/P
 * carried, a loss when more. */

type PaymentFxFields = Pick<Payment, 'currency' | 'paymentDate'> &
  Partial<Pick<Payment, 'exchangeRate' | 'rateType' | 'rateDate' | 'rateEdited' | 'settledCurrency' | 'amount' | 'bankAmount'>>;

/** The currency of the invoices a payment settles (its own unless paid in the base currency). */
export const settledCurrencyOf = (p: Pick<Payment, 'currency'> & Partial<Pick<Payment, 'settledCurrency'>>) =>
  (p.settledCurrency || p.currency || '').toUpperCase();

/** Base per one unit of the settled currency: the bank's (its figures),
 *  else the rate on the record, else the payment date's mid-market rate. */
export function settlementRateOf(p: PaymentFxFields): number {
  const cur = settledCurrencyOf(p);
  if (isBaseCurrency(cur)) return 1;
  if (p.bankAmount != null && p.bankAmount > 0 && p.amount && p.amount > 0 && !p.settledCurrency) return p.bankAmount / p.amount;
  if (p.exchangeRate && p.exchangeRate > 0) return p.exchangeRate;
  return midRateOn(cur, p.paymentDate) ?? 1;
}

/** The payment amount's rate card: its own currency against the base. */
export function paymentFx(p: PaymentFxFields): InvoiceFx {
  const currency = (p.currency || '').toUpperCase();
  const rateType: RateType = p.rateType ?? DEFAULT_RATE_TYPE;
  const rateDate = p.rateDate || p.paymentDate;
  if (isBaseCurrency(currency)) {
    return { currency, rate: 1, rateType, rateDate, source: 'Base currency', provisional: false, isBase: true, dateLabel: 'payment date' };
  }
  const rate = settledCurrencyOf(p) === currency ? settlementRateOf(p) : midRateOn(currency, p.paymentDate) ?? 1;
  return {
    currency,
    rate,
    rateType,
    rateDate,
    source: p.bankAmount != null ? (p.rateEdited ? 'Worked out from the bank’s figures' : 'Estimated at the mid-market rate') : rateSourceLabel(rateType),
    provisional: false,
    isBase: false,
    dateLabel: 'payment date',
  };
}

/** A payment amount (in its own currency) in the base currency. */
export const toPaymentBase = (p: PaymentFxFields, amount: number) => toBase(amount, paymentFx(p).rate);

/** The rate fields a payment saves: the settled currency's rate on the payment date. */
export function stampPaymentRate(
  settledCurrency: string,
  paymentDate: string,
  rateType: RateType = DEFAULT_RATE_TYPE,
): Pick<Payment, 'exchangeRate' | 'rateType' | 'rateDate'> {
  if (isBaseCurrency(settledCurrency)) return {};
  const quote = rateOn(settledCurrency, paymentDate, rateType);
  const rate = quote.rate ?? midRateOn(settledCurrency, paymentDate);
  if (rate == null) return {};
  return { exchangeRate: rate, rateType: quote.rate != null ? rateType : 'mid', rateDate: paymentDate };
}

/** The rate an invoice was booked at, in the settled currency. An invoice in
 *  another currency (the seeds draw from a shared pool) stands in with the
 *  settled currency's rate on its own rate date. */
export function bookedRateOf(inv: Invoice | undefined, settledCurrency: string, fallback: number): number {
  if (!inv) return fallback;
  if (isBaseCurrency(settledCurrency)) return 1;
  if ((inv.currency || '').toUpperCase() === settledCurrency) return invoiceFx(inv).rate;
  return midRateOn(settledCurrency, inv.rateDate || inv.postingDate || inv.invoiceDate) ?? fallback;
}

export interface ExchangeDifference {
  /** The settled invoice amounts in the base currency at their invoice rates. */
  booked: number;
  /** The same amounts at the payment's rate. */
  atPayment: number;
  /** booked − atPayment: positive is a gain, negative a loss. */
  difference: number;
}

/** One line's exchange difference: an amount in the settled currency, booked at
 *  one rate and paid at another. */
export function exchangeDifference(amount: number, bookedRate: number, payRate: number): ExchangeDifference {
  const booked = toBase(amount, bookedRate);
  const atPayment = toBase(amount, payRate);
  return { booked, atPayment, difference: Math.round((booked - atPayment) * 100) / 100 };
}

/** A payment's exchange difference over the invoices it settled. Null when the
 *  settled currency is the base (nothing to convert) or nothing was applied. */
export function paymentExchangeDifference(p: Payment, invoices: Invoice[]): ExchangeDifference | null {
  const settled = settledCurrencyOf(p);
  if (isBaseCurrency(settled) || !p.appliedInvoices?.length) return null;
  const byNumber = new Map(invoices.map((inv) => [inv.invoiceNumber, inv]));
  const payRate = settlementRateOf(p);
  let booked = 0;
  let atPayment = 0;
  p.appliedInvoices.forEach((ref) => {
    const d = exchangeDifference(ref.amount, bookedRateOf(byNumber.get(ref.invoiceNumber), settled, payRate), payRate);
    booked += d.booked;
    atPayment += d.atPayment;
  });
  booked = Math.round(booked * 100) / 100;
  atPayment = Math.round(atPayment * 100) / 100;
  return { booked, atPayment, difference: Math.round((booked - atPayment) * 100) / 100 };
}

/** "Gain" / "Loss" / "None" for an exchange difference. */
export const differenceKind = (d: number): 'gain' | 'loss' | 'none' => (Math.abs(d) < 0.005 ? 'none' : d > 0 ? 'gain' : 'loss');

/** Statuses a payment has posted in: its rate and FX variance are fixed
 *  (Currency Touchpoints Map, 24 Nov 2026: "Rate locks when the payment
 *  posts"). A scheduled payment hasn't posted yet. */
export const POSTED_PAYMENT_STATUSES = ['Paid', 'Unapplied', 'Partially Applied', 'Fully Applied', 'Reversed'];

export const paymentRateLocked = (p: Pick<Payment, 'status'>) => POSTED_PAYMENT_STATUSES.includes(p.status);
