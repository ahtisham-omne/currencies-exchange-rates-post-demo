import type { Quote } from '@/app/types/quote';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import { resolveAccount } from '@/app/currency/companyAccounts';
import { quoteFx } from '@/app/currency/qFx';
import { toBase, type RateType } from '@/app/currency/rates';

/* ── Quote to sales order: the currency configuration the order takes ──
 * Converting a quote (Convert to sales order, from the quote page or the
 * Kanban board) creates the order in the Sales Orders app, a separate app
 * (touchpoints/sales-order). Until now nothing crossed over: converting only
 * marked the quote. Both apps run in the shell on the same origin, so the
 * conversion is written to the origin's localStorage under
 * QUOTE_TO_SO_STORAGE_KEY (a list, newest last, one entry per quote), where
 * the Sales Orders app can read it; another app's window hears it through
 * the browser's `storage` event, and this window gets QUOTE_TO_SO_EVENT.
 * The order keeps the quote's currency (it can't change), the rate the rep
 * chose (the quote's or today's) and its type, and the pay-to account
 * (Currency Touchpoints Map, Quote to sales order 1–2). */

export const QUOTE_TO_SO_STORAGE_KEY = 'omne.quotes.convertedToSalesOrder';
export const QUOTE_TO_SO_EVENT = 'omne:quote-converted-to-sales-order';

/** One quote line as the order takes it; prices in the quote's currency. */
export interface QuoteToSalesOrderLine {
  itemCode: string;
  itemName: string;
  qty: number;
  uom: string;
  /** Per unit, in the quote's currency. */
  unitPrice: number;
}

export interface QuoteToSalesOrder {
  /** The order number the convert dialog showed. */
  soNumber: string;
  quoteId: string;
  quoteNumber: string;
  quoteVersion?: number;
  customerName: string;
  /** ISO timestamp of the conversion. */
  convertedAt: string;
  customerPO?: string;
  notes?: string;
  /** The quote's currency (ISO 4217). The order is in it and can't change it. */
  currency: string;
  /** Which rate the order takes: the quote's ("Keep the quote's rate") or today's. */
  rateChoice: 'quote' | 'today';
  /** The rate the order takes: base currency per 1 unit of `currency` (1 for the base currency). */
  exchangeRate: number;
  rateType: RateType;
  /** ISO day the rate is for: the quote's rate date, or today. */
  rateDate: string;
  /** A corporate rate typed on the quote (kept only with the quote's rate). */
  rateEdited: boolean;
  /** The quote's own rate, for reference when today's was taken. */
  quoteRate: { exchangeRate: number; rateType: RateType; rateDate: string };
  /** "You receive": the company account id (currency/companyAccounts.ts, same ids in every module). */
  payToAccount: string;
  /** That account's currency: the base currency or the quote's. */
  settlementCurrency: string;
  /** The quote's total in `currency`, and in base at `exchangeRate`. */
  total: number;
  totalBase: number;
  baseCurrency: string;
  /** The quote's lines, when the convert dialog had them (the quote page). */
  lines?: QuoteToSalesOrderLine[];
}

/** The rate the convert dialog settled on (ConvertToSOModal). */
export interface ConvertRateChoice {
  rateChoice: 'quote' | 'today';
  exchangeRate: number;
  rateType: RateType;
  rateDate: string;
}

/** The entry for a quote converted with `choice`; `total` is in the quote's currency. */
export function quoteConversionEntry(
  quote: Quote,
  args: { soNumber: string; customerPO?: string; notes?: string; choice: ConvertRateChoice; total: number; quoteVersion?: number; lines?: QuoteToSalesOrderLine[] },
): QuoteToSalesOrder {
  const fx = quoteFx(quote);
  const account = resolveAccount(fx.currency, quote.payToAccount, quote.settlementCurrency);
  const keep = args.choice.rateChoice === 'quote';
  return {
    soNumber: args.soNumber,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    quoteVersion: args.quoteVersion ?? quote.version,
    customerName: quote.customer?.name ?? '',
    convertedAt: new Date().toISOString(),
    customerPO: args.customerPO || undefined,
    notes: args.notes || undefined,
    currency: fx.currency,
    rateChoice: args.choice.rateChoice,
    exchangeRate: args.choice.exchangeRate,
    rateType: args.choice.rateType,
    rateDate: args.choice.rateDate,
    rateEdited: keep && !!quote.rateEdited,
    quoteRate: { exchangeRate: fx.rate, rateType: fx.rateType, rateDate: fx.rateDate },
    payToAccount: account.id,
    settlementCurrency: account.currency,
    total: args.total,
    totalBase: toBase(args.total, args.choice.exchangeRate),
    baseCurrency: BASE_CURRENCY,
    ...(args.lines && args.lines.length > 0 && { lines: args.lines }),
  };
}

/** Records a conversion for the Sales Orders app (see the header). */
export function recordQuoteConversion(entry: QuoteToSalesOrder): void {
  try {
    const raw = window.localStorage.getItem(QUOTE_TO_SO_STORAGE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    const kept = Array.isArray(list) ? list.filter((e) => (e as QuoteToSalesOrder | null)?.quoteId !== entry.quoteId) : [];
    window.localStorage.setItem(QUOTE_TO_SO_STORAGE_KEY, JSON.stringify([...kept, entry]));
  } catch {
    // Storage blocked or full: the quote still converts here.
  }
  try {
    window.dispatchEvent(new CustomEvent(QUOTE_TO_SO_EVENT, { detail: entry }));
  } catch {
    // No CustomEvent (an old browser): the storage entry is enough.
  }
}

/** Every conversion recorded on this origin, oldest first. */
export function readQuoteConversions(): QuoteToSalesOrder[] {
  try {
    const raw = window.localStorage.getItem(QUOTE_TO_SO_STORAGE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as QuoteToSalesOrder[]) : [];
  } catch {
    return [];
  }
}
