import type { Invoice, InvoiceRateBasis } from '@/app/data/mockInvoices';
import { localTodayIso } from '@/app/lib/dueBucket';
import { BASE_CURRENCY, isBaseCurrency } from './currencies';
import { DEFAULT_RATE_TYPE, RATE_PROVIDER, rateOn, toBase, type RateType } from './rates';

/* ── An invoice's currency and rate (spec 4.4) ────────────────────────
 * An invoice is written in its own currency (the PO's, else the vendor's)
 * and carries the rate taken on its posting date: mid-market (read-only)
 * or corporate (editable on the invoice). A/P posts in the base currency at
 * that rate, and it is the rate a later payment is compared against.
 * Everything that sums or posts invoices converts through here. */

const todayIso = localTodayIso;

export interface InvoiceFx {
  currency: string;
  /** Base currency per one unit of `currency` (1 for the base currency). */
  rate: number;
  rateType: RateType;
  /** The day the rate is for. */
  rateDate: string;
  /** "Open Exchange Rates", "Corporate rate", "Entered on the invoice". */
  source: string;
  /** No rate taken yet (a pre-invoice posts when paid): today's rate stands in. */
  provisional: boolean;
  isBase: boolean;
  /** What the rate date is, for the hover: "vendor invoice date", "PO date"… */
  dateLabel: string;
}

/** The "Rate as of" date's name, lower case for running text. */
export const RATE_BASIS_DATE_LABEL: Record<InvoiceRateBasis, string> = {
  invoiceDate: 'vendor invoice date',
  receivingDate: 'receiving date',
  poDate: 'PO date',
  postingDate: 'posting date',
  paidDate: 'payment date',
};

type FxFields = Pick<Invoice, 'currency' | 'postingDate' | 'invoiceDate'> &
  Partial<Pick<Invoice, 'exchangeRate' | 'rateType' | 'rateDate' | 'rateEdited' | 'rateBasis'>>;

export function rateSourceLabel(type: RateType, edited?: boolean): string {
  if (type === 'mid') return RATE_PROVIDER;
  return edited ? 'Corporate rate, changed on the invoice' : 'Corporate rate';
}

export function invoiceFx(inv: FxFields): InvoiceFx {
  const currency = (inv.currency || BASE_CURRENCY).toUpperCase();
  const rateType = inv.rateType ?? DEFAULT_RATE_TYPE;
  const docDate = inv.postingDate || inv.invoiceDate || todayIso();
  if (isBaseCurrency(currency)) {
    return { currency, rate: 1, rateType, rateDate: docDate, source: 'Base currency', provisional: false, isBase: true, dateLabel: RATE_BASIS_DATE_LABEL[inv.rateBasis ?? 'postingDate'] };
  }
  if (inv.exchangeRate && inv.exchangeRate > 0) {
    return {
      currency,
      rate: inv.exchangeRate,
      rateType,
      rateDate: inv.rateDate || docDate,
      source: rateSourceLabel(rateType, inv.rateEdited),
      provisional: false,
      isBase: false,
      dateLabel: RATE_BASIS_DATE_LABEL[inv.rateBasis ?? 'postingDate'],
    };
  }
  // Not posted yet: today's rate of the same type (mid-market if there's none).
  const today = todayIso();
  const quote = rateOn(currency, today, rateType);
  const usable = quote.rate != null ? quote : rateOn(currency, today, 'mid');
  return {
    currency,
    rate: usable.rate ?? 1,
    rateType: usable.type,
    rateDate: today,
    source: rateSourceLabel(usable.type),
    provisional: true,
    isBase: false,
    dateLabel: 'today',
  };
}

/** An invoice amount (its total, balance, a line…) in the base currency. */
export const toInvoiceBase = (inv: FxFields, amount: number) => toBase(amount, invoiceFx(inv).rate);

/** The rate fields to stamp on an invoice, taken on the given day (its
 *  posting date unless a basis says otherwise). */
export function stampRate(
  currency: string,
  day: string | undefined,
  rateType: RateType = DEFAULT_RATE_TYPE,
  basis?: InvoiceRateBasis,
): Pick<Invoice, 'exchangeRate' | 'rateType' | 'rateDate' | 'rateBasis'> {
  if (!day) return {};
  const quote = rateOn(currency, day, rateType);
  if (quote.rate == null) return {};
  return { exchangeRate: quote.rate, rateType, rateDate: quote.date, ...(basis ? { rateBasis: basis } : {}) };
}

/** A PO's own rate: the mid-market rate on its PO date (spec 4.3), the
 *  commitment an invoice's rate is compared against. Null when unknown. */
export function poRateFx(po: { currency?: string; exchangeRate?: number; poDate: string }): InvoiceFx | null {
  if (!po.currency || !po.exchangeRate) return null;
  return {
    currency: po.currency,
    rate: po.exchangeRate,
    rateType: 'mid',
    rateDate: po.poDate,
    source: RATE_PROVIDER,
    provisional: false,
    isBase: isBaseCurrency(po.currency),
    dateLabel: 'PO date',
  };
}

/* ── A vendor's currency (spec 4.2) ───────────────────────────────────
 * The partner record's default currency. Seeded per vendor name, so the
 * vendor registry, the invoices and the POs always agree. Local vendors bill
 * in the base currency; the rest in their own. */

const VENDOR_CURRENCY_MIX: [string, number][] = [
  ['USD', 38], ['PKR', 22], ['EUR', 12], ['GBP', 8], ['AED', 8], ['CNY', 7], ['SAR', 5],
];
const MIX_TOTAL = VENDOR_CURRENCY_MIX.reduce((s, [, w]) => s + w, 0);

/** Pinned so the demo's first screens show the range (the standalone picker leads with these). */
const PINNED_VENDOR_CURRENCY: Record<string, string> = {
  'Superior Industries': 'EUR',
  'Acme Industries': 'USD',
  'Ultra Corp': 'GBP',
};

export function currencyForVendorName(name: string): string {
  const pinned = PINNED_VENDOR_CURRENCY[name.trim()];
  if (pinned) return pinned;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) | 0;
  let pick = Math.abs(h) % MIX_TOTAL;
  for (const [code, weight] of VENDOR_CURRENCY_MIX) {
    if (pick < weight) return code;
    pick -= weight;
  }
  return BASE_CURRENCY;
}
