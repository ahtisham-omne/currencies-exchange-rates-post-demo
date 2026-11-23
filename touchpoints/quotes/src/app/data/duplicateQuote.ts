import type { Quote, QuoteVersion } from '../types/quote';
import { CreatedLineItem, addCreatedQuote, getVersionRate, todaysRateType, type QuoteRateStamp, type VersionRateChoice } from './quoteStore';
import { convertOn, customerCurrency, quoteFx, stampQuoteRate } from '@/app/currency/qFx';
import { resolveAccount } from '@/app/currency/companyAccounts';

/* ── The duplicate's currency and rate (Currency Touchpoints Map, Quotes 5) ──
 * The same customer keeps the quote's currency, and the rep picks the rate:
 * the original one (the seeded version's, else the quote's) or today's.
 * Another customer takes that customer's currency; when it differs there is
 * no original rate to keep, so the duplicate takes today's. */

/** The rate the duplicate can keep: the version's on record, else the quote's. */
export function originalRate(source: Quote, version?: number): QuoteRateStamp {
  const fx = quoteFx(source);
  const onRecord = version != null ? getVersionRate(source.id, version) : undefined;
  if (onRecord && onRecord.currency.toUpperCase() === fx.currency) return onRecord;
  return { currency: fx.currency, exchangeRate: fx.rate, rateType: fx.rateType, rateDate: fx.rateDate, rateEdited: !!source.rateEdited };
}

/** The duplicate's currency: the quote's for the same customer, else the new customer's. */
export function duplicateCurrency(source: Quote, newCustomerName?: string | null): string {
  return newCustomerName ? customerCurrency(newCustomerName) : quoteFx(source).currency;
}

/* ════════════════════════════════════════════════════════════════════
   Shared duplicate-quote builder. Used by the listing page and the
   detail page so both surfaces produce identical duplicates and the
   new quote persists in the module-level `createdQuotes` store until
   a hard refresh wipes the JS module cache.
   ════════════════════════════════════════════════════════════════════ */

export type DuplicateVersionMode = 'single' | 'all';

export interface DuplicateOptions {
  /** Empty when keeping the same customer. */
  newCustomerId?: string;
  newCustomerName: string;
  versionMode: DuplicateVersionMode;
  /** When `versionMode === 'single'`, the version number to seed from. */
  selectedVersion: number;
  /** Existing quote numbers — used to make sure the new quote number is unique. */
  existingQuoteNumbers: string[];
  /** Keep the original rate ("locked") or take today's of a type. Only
   *  meaningful when the duplicate stays in the quote's currency; otherwise
   *  it takes today's. Today's mid-market when left out. */
  rateChoice?: VersionRateChoice;
}

export interface DuplicateResult {
  quote: Quote;
  lineItems: CreatedLineItem[];
}

function nextQuoteNumber(existing: string[]): string {
  const nums = existing
    .map(qn => {
      const m = qn.match(/Q-(\d{3})-(\d{3})-(\d{3})/);
      return m ? parseInt(m[1] + m[2] + m[3], 10) : 0;
    })
    .filter(n => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  const next = String(max + 1).padStart(9, '0');
  return `Q-${next.substring(0, 3)}-${next.substring(3, 6)}-${next.substring(6, 9)}`;
}

/* Build the versions[] array on the duplicate.
   - 'all'   → copy the source's full history verbatim, then add a fresh
     Draft entry on top whose `version` is max+1.
   - 'single' → discard history; the duplicate is a fresh Draft V1 that
     was seeded from `selectedVersion` (we note that in the summary). */
function buildVersions(
  source: Quote,
  mode: DuplicateVersionMode,
  selectedVersion: number,
  authorName: string,
  dateStr: string,
): { versions: QuoteVersion[]; topVersion: number } {
  if (mode === 'all') {
    const sourceVersions = (source.versions ?? []).slice().sort((a, b) => b.version - a.version);
    const maxV = sourceVersions[0]?.version ?? source.version ?? 1;
    const newTop: QuoteVersion = {
      version: maxV + 1,
      versionStatus: 'draft',
      date: dateStr,
      author: authorName,
      summary: `Duplicated from ${source.quoteNumber} (all history copied)`,
    };
    return { versions: [newTop, ...sourceVersions], topVersion: maxV + 1 };
  }
  /* single-version mode → drop history, fresh V1 */
  const newTop: QuoteVersion = {
    version: 1,
    versionStatus: 'draft',
    date: dateStr,
    author: authorName,
    summary: `Duplicated from ${source.quoteNumber} V${selectedVersion}`,
  };
  return { versions: [newTop], topVersion: 1 };
}

export function duplicateQuote(source: Quote, options: DuplicateOptions): DuplicateResult {
  const now = new Date();
  const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
  const newId = `quote-dup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newQuoteNumber = nextQuoteNumber(options.existingQuoteNumbers);
  const authorName = typeof source.salesRep === 'string'
    ? source.salesRep
    : source.salesRep?.name || 'System';

  const { versions, topVersion } = buildVersions(
    source,
    options.versionMode,
    options.selectedVersion,
    authorName,
    dateStr,
  );

  const customer = options.newCustomerId
    ? { id: options.newCustomerId, name: options.newCustomerName }
    : source.customer;

  /* Same customer: the copy keeps the quote's currency and the rate the rep
     picked, the original or today's. Another customer: it opens in that
     customer's default (spec 4.3), prices converted at today's mid-market
     rates; in another currency there is no original rate, so it takes
     today's. The pay-to account carries over when it can take the
     duplicate's currency, else 1010. */
  const fromCurrency = quoteFx(source).currency;
  const toCurrency = duplicateCurrency(source, options.newCustomerId ? options.newCustomerName : null);
  const convert = (n: number) => (toCurrency === fromCurrency ? n : convertOn(n, fromCurrency, toCurrency, now));
  const keep = toCurrency === fromCurrency && options.rateChoice === 'locked';
  const kept = keep ? originalRate(source, options.selectedVersion) : null;
  const rateFields = kept
    ? { currency: toCurrency, exchangeRate: kept.exchangeRate, rateType: kept.rateType, rateDate: kept.rateDate, rateEdited: !!kept.rateEdited }
    : stampQuoteRate(toCurrency, now, (options.rateChoice && todaysRateType(options.rateChoice)) || 'mid');
  const account = resolveAccount(toCurrency, source.payToAccount, source.settlementCurrency);

  const duplicated: Quote = {
    ...source,
    ...rateFields,
    payToAccount: account.id,
    settlementCurrency: account.currency,
    totalValue: convert(source.totalValue),
    id: newId,
    quoteNumber: newQuoteNumber,
    status: 'Draft',
    version: topVersion,
    versions,
    customer,
    /* Reset lifecycle-bound fields so the duplicate behaves like a brand
       new draft regardless of the source's status. */
    confirmationDate: undefined,
    cancellationReason: undefined,
    daysInCurrentStage: 0,
    hasUnreadMessages: false,
    unreadMessageCount: 0,
    createdDate: now,
    lastUpdated: now,
    /* Push expiry out 30 days from creation so it isn't already expired. */
    expiryDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  };

  const lineItems: CreatedLineItem[] = (source.items ?? []).map((item, idx) => ({
    id: `${newId}-li-${idx}`,
    productId: item.productId,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unitPrice: convert(item.unitPrice),
    discount: item.discount,
    total: convert(item.total),
    image: item.image,
  }));

  addCreatedQuote(duplicated, lineItems);

  return { quote: duplicated, lineItems };
}
