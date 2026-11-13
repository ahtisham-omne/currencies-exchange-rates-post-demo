// Currency Library screens: shared, read-only views over the currency seed and
// context (flags, regions, linked documents, audit facts). Pure helpers, no UI.
import { countInUse, countOpenDocuments, getRegionForCountry, isActiveTransaction, paymentSetOf, paymentStatusOf, type Currency, type OpenTransaction, type StatusSet } from '../../data/currencies'
import { BASE_CURRENCY } from '../../data/exchangeRates'
import { getCountryCode, getFlagUrlByCountry } from '../../utils/currencyFlags'
import type { BadgeTone } from '../../coa/components/ui'
import type { StatusOption } from '../../coa/components/StatusChip'

export const BASE = BASE_CURRENCY

export type CurrencyStatus = 'Active' | 'Inactive'
/** The context stores `active` / `inactive`; the screens print CoA's capitalised labels. */
export const statusOf = (c: Currency): CurrencyStatus => (c.status === 'active' ? 'Active' : 'Inactive')

/** The status menu's two states, with what each one means for a currency. */
export const CURRENCY_STATUS_OPTIONS: StatusOption<CurrencyStatus>[] = [
  { value: 'Active', verb: 'Activate', meaning: ['You can use it on new transactions.'] },
  { value: 'Inactive', verb: 'Deactivate', meaning: ['You can’t use it on new transactions. Past transactions aren’t affected.'] },
]

/** Why the base currency's status can't change: the row menus' disabled reason,
 *  the refusal, and the bulk dialog all say it in these words. */
export const BASE_CURRENCY_LOCKED = 'Your base currency can’t be changed because transactions are linked to it.'
/** Why Inactive is greyed out on the base currency's status menu. */
export const BASE_CURRENCY_NO_DEACTIVATE = 'Your base currency can’t be deactivated. You can change it in General settings until the first posting to the General Ledger.'

/** The status menu for one currency: the base currency's Deactivate is greyed out. */
export const statusOptionsFor = (c: Currency): StatusOption<CurrencyStatus>[] =>
  c.isBaseCurrency
    ? CURRENCY_STATUS_OPTIONS.map(o => (o.value === 'Inactive' ? { ...o, disabledReason: BASE_CURRENCY_NO_DEACTIVATE } : o))
    : CURRENCY_STATUS_OPTIONS

/** ISO 3166 alpha-2 (lower case) for a currency's flag, '' when there is none. */
export const flagOf = (code: string) => (getCountryCode(code) ?? '').toLowerCase()
/** Flag code for a country name, as the Countries / Regions list names it. */
export const countryFlagOf = (country: string) => getFlagUrlByCountry(country).match(/\/([a-z]{2})\.png$/)?.[1] ?? ''
/** The flag beside a currency's primary country: that country's own, else the
 *  currency's. They differ for shared currencies (XCD lists Anguilla first, but
 *  its flag is Antigua and Barbuda's). */
export const placeFlagOf = (country: string, code: string) => countryFlagOf(country) || flagOf(code)

export const regionOf = (c: Currency): string | undefined => getRegionForCountry(c.country)
export const countriesOf = (c: Currency): string[] => [c.country, ...(c.additionalCountries ?? [])]

export { countInUse, countOpenDocuments }

/** In use: on at least one active transaction, the "N active" in the In Use column. */
export const isInUse = (c: Currency) => countInUse(c) > 0

/** What a search may type for a symbol: "Rs" for the rupee sign (₨). */
const SYMBOL_ALIASES: Record<string, string[]> = { '₨': ['Rs'] }
export const symbolSearchText = (symbol: string) => [symbol, ...(SYMBOL_ALIASES[symbol] ?? [])]

/* ── Linked documents ─────────────────────────────────────────────────── */

export type DocTypeKey = 'vendorInvoice' | 'customerInvoice' | 'purchaseOrder' | 'salesOrder' | 'vendorPayment' | 'customerPayment'

export const DOC_TYPES: { key: DocTypeKey; label: string; plural: string; party: string; short: string }[] = [
  { key: 'vendorInvoice', label: 'Vendor Invoice', plural: 'Vendor Invoices', party: 'Vendor', short: 'Vend. Inv' },
  { key: 'customerInvoice', label: 'Customer Invoice', plural: 'Customer Invoices', party: 'Customer', short: 'Cust. Inv' },
  { key: 'purchaseOrder', label: 'Purchase Order', plural: 'Purchase Orders', party: 'Vendor', short: 'PO' },
  { key: 'salesOrder', label: 'Sales Order', plural: 'Sales Orders', party: 'Customer', short: 'SO' },
  { key: 'vendorPayment', label: 'Vendor Payment', plural: 'Vendor Payments', party: 'Party', short: 'Vend. Pay' },
  { key: 'customerPayment', label: 'Customer Payment', plural: 'Customer Payments', party: 'Party', short: 'Cust. Pay' },
]
export const docTypeMeta = (k: DocTypeKey) => DOC_TYPES.find(t => t.key === k)!

export interface LinkedDoc {
  id: string
  number: string
  type: DocTypeKey
  party: string
  /** Its status as its own module names it (a vendor invoice's Invoice Status). */
  status: string
  /** Vendor invoices only: the Payment Status beside it. */
  paymentStatus?: string
  /** Whose statuses it reads: its type's, or for a vendor payment, payment or prepayment. */
  statusSet: StatusSet
  date: string
  amount: number
  /** The rate it was priced at. */
  rateType: 'corporate' | 'mid'
}

/** The number out of a formatted amount ("د.إ85,000.00" → 85000). The first run of
 *  digits is read, so a symbol that carries a point of its own (د.إ) is not. */
export const parseAmount = (amount: string): number => {
  const m = amount.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  const n = m ? Number(m[0]) : 0
  return Number.isFinite(n) ? n : 0
}

/** Every open document booked in the currency, one flat list, newest first. */
export function linkedDocs(c: Currency): LinkedDoc[] {
  const u = c.usage
  const out: LinkedDoc[] = []
  const push = (type: 'vendorInvoice' | 'customerInvoice' | 'purchaseOrder' | 'salesOrder', rows: OpenTransaction[]) =>
    rows.forEach((d, i) => out.push({
      id: `${type}-${d.ref}-${i}`, number: d.ref, type, party: d.vendor, status: d.status, statusSet: type,
      paymentStatus: type === 'vendorInvoice' ? d.paymentStatus ?? (d.status === 'Cancelled' ? 'Void' : 'Unpaid') : undefined,
      date: d.date, amount: parseAmount(d.amount), rateType: d.rateType ?? 'mid',
    }))
  push('vendorInvoice', u.openInvoices)
  push('customerInvoice', u.openCustomerInvoices)
  push('purchaseOrder', u.openPurchaseOrders)
  push('salesOrder', u.openSalesOrders)
  ;(u.openPayments ?? []).forEach((p, i) => out.push({
    id: `pay-${p.ref}-${i}`, number: p.ref, type: p.type === 'Vendor Payment' ? 'vendorPayment' : 'customerPayment',
    party: p.party, status: paymentStatusOf(p), statusSet: paymentSetOf(p), date: p.date, amount: parseAmount(p.amount), rateType: 'mid',
  }))
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** The active transactions priced at the currency's corporate rate: while any
 *  is open, that rate can't be archived. */
export function corporateRateDocs(c: Currency): LinkedDoc[] {
  return linkedDocs(c).filter(d => d.rateType === 'corporate' && isActiveDoc(d))
}

/** Status chip tones, by what the status means across the modules: done green,
 *  in play blue, waiting or part-way amber, a problem red, not started or
 *  stopped grey. */
export function docStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'Paid': case 'Paid in Full': case 'Settled': case 'Applied': case 'Fully Received': case 'Shipped': return 'success'
    case 'Approved': case 'Unpaid': case 'In Payment Run': case 'Scheduled': case 'Unapplied':
    case 'Sent': case 'Confirmed': case 'Released': return 'info'
    case 'Pending Approval': case 'Pending Review': case 'Partially Paid': case 'Partially Applied':
    case 'Partially Received': case 'Partially Shipped': case 'Partially Cancelled': case 'Active with Cancellation': return 'warning'
    case 'Overdue': case 'Exception': case 'Rejected': return 'danger'
    default: return 'neutral' // Draft, Cancelled, Archived, Void, Reversed, Written Off, Closed with Cancellations
  }
}

/** The open documents that hold a currency back, per type, for a refusal's reasons box. */
export function openDocBreakdown(c: Currency): string[] {
  const u = c.usage
  const n = (set: StatusSet, rows: OpenTransaction[]) => rows.filter(r => isActiveTransaction(set, r.status, r.paymentStatus)).length
  const rows: [number, string, string][] = [
    [n('vendorInvoice', u.openInvoices), 'open vendor invoice', 'open vendor invoices'],
    [n('customerInvoice', u.openCustomerInvoices), 'open customer invoice', 'open customer invoices'],
    [n('purchaseOrder', u.openPurchaseOrders), 'open purchase order', 'open purchase orders'],
    [n('salesOrder', u.openSalesOrders), 'open sales order', 'open sales orders'],
  ]
  return rows.filter(([k]) => k > 0).map(([k, one, many]) => `${k} ${k === 1 ? one : many}`)
}

/* ── Formatting ───────────────────────────────────────────────────────── */

export const fmtAmount = (n: number, dp: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })

/** "د.إ 85,000.00": the symbol, a left-to-right mark so a right-to-left symbol
 *  does not pull the digits in front of it, then the amount. */
export const money = (symbol: string, n: number, dp: number) => `${symbol}‎ ${fmtAmount(n, dp)}`

/* ── Format preview ─────────────────────────────────────────────────────
   How an amount is written where the currency is at home: the thousand and
   decimal separators, the grouping (India writes 12,34,567.89), and which side
   the symbol sits, from the locale of the currency's primary country (the
   euro's from Germany), in the country's main language (Switzerland's German:
   CHF 1'234'567.89) with Western digits. The library's own symbol stands in
   for the locale's. Language and region only: a script subtag (de-Latn-CH)
   loses the regional rules and falls back to the language's. */
const PREVIEW_AMOUNT = 1234567.891

function previewLocale(c: Currency): string {
  const region = (c.country === 'Eurozone' ? 'de' : placeFlagOf(c.country, c.code)).toUpperCase()
  if (!/^[A-Z]{2}$/.test(region)) return 'en-US'
  try {
    const likely = new Intl.Locale(`und-${region}`).maximize()
    return likely.language && likely.region ? `${likely.language}-${likely.region}` : 'en-US'
  } catch { return 'en-US' }
}

/** "$1,234,567.89", "1.234.567,89 €", "₹12,34,567.89", "CHF 1’234’567.89", "¥1,234,568". */
export function formatPreview(c: Currency): { text: string; place: string } {
  const nf = new Intl.NumberFormat(previewLocale(c), {
    style: 'currency', currency: c.code, numberingSystem: 'latn',
    minimumFractionDigits: c.decimalPlaces, maximumFractionDigits: c.decimalPlaces,
  })
  const parts = nf.formatToParts(PREVIEW_AMOUNT)
  // Where the symbol is the decimal mark itself, it is not written a second time:
  // the Cape Verdean escudo reads 1 234 567$89, not 1 234 567$89 $.
  const symbolIsDecimal = parts.some(p => p.type === 'decimal' && p.value === c.symbol)
  const text = parts
    .map(p => (p.type === 'currency' ? (symbolIsDecimal ? '' : c.symbol) : p.value))
    .join('')
    .replace(/[\u200e\u200f\u061c]/g, '')
    .trim()
  return { text, place: c.country === 'Eurozone' ? 'Germany' : c.country }
}

/* ── Active transactions ───────────────────────────────────────────────── */

/** Still in play, by its own type's statuses (DOC_STATUSES): not a draft, not
 *  finished. An Approved vendor invoice is active while money is still owed. */
export const isActiveDoc = (d: LinkedDoc) => isActiveTransaction(d.statusSet, d.status, d.paymentStatus)

export const fmtRate =(n: number, dp = 4) => n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

/* ── Audit facts for the rail ─────────────────────────────────────────── */

export function auditFacts(c: Currency) {
  const log = c.auditLog
  const oldest = log[log.length - 1]
  const newest = log[0]
  return {
    createdBy: oldest?.changedBy ?? 'System',
    createdAt: oldest?.dateTime ?? '',
    updatedBy: newest?.changedBy ?? 'System',
    updatedAt: newest?.dateTime ?? '',
  }
}
