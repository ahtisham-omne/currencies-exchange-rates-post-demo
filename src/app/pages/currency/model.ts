// Currency Library screens: shared, read-only views over the currency seed and
// context (flags, regions, linked documents, audit facts). Pure helpers, no UI.
import { countInUse, countOpenDocuments, getRegionForCountry, type Currency } from '../../data/currencies'
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
  { value: 'Active', verb: 'Activate', meaning: ['Offered on new transactions, rates and reports.'] },
  { value: 'Inactive', verb: 'Deactivate', meaning: ['Not offered on new transactions. Its rates and history are kept.'] },
]

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

/* ── Linked documents ─────────────────────────────────────────────────── */

export type DocTypeKey = 'vendorInvoice' | 'customerInvoice' | 'purchaseOrder' | 'salesOrder' | 'vendorPayment' | 'customerPayment'

export const DOC_TYPES: { key: DocTypeKey; label: string; plural: string; party: string; short: string }[] = [
  { key: 'vendorInvoice', label: 'Vendor invoice', plural: 'Vendor invoices', party: 'Vendor', short: 'Vend. inv' },
  { key: 'customerInvoice', label: 'Customer invoice', plural: 'Customer invoices', party: 'Customer', short: 'Cust. inv' },
  { key: 'purchaseOrder', label: 'Purchase order', plural: 'Purchase orders', party: 'Vendor', short: 'PO' },
  { key: 'salesOrder', label: 'Sales order', plural: 'Sales orders', party: 'Customer', short: 'SO' },
  { key: 'vendorPayment', label: 'Vendor payment', plural: 'Vendor payments', party: 'Party', short: 'Vend. pay' },
  { key: 'customerPayment', label: 'Customer payment', plural: 'Customer payments', party: 'Party', short: 'Cust. pay' },
]
export const docTypeMeta = (k: DocTypeKey) => DOC_TYPES.find(t => t.key === k)!

export interface LinkedDoc {
  id: string
  number: string
  type: DocTypeKey
  party: string
  /** '' for payments, which carry no status. */
  status: string
  date: string
  amount: number
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
  const push = (type: DocTypeKey, rows: { ref: string; vendor: string; amount: string; status: string; date: string }[]) =>
    rows.forEach((d, i) => out.push({ id: `${type}-${d.ref}-${i}`, number: d.ref, type, party: d.vendor, status: d.status, date: d.date, amount: parseAmount(d.amount) }))
  push('vendorInvoice', u.openInvoices)
  push('customerInvoice', u.openCustomerInvoices)
  push('purchaseOrder', u.openPurchaseOrders)
  push('salesOrder', u.openSalesOrders)
  ;(u.openPayments ?? []).forEach((p, i) => out.push({
    id: `pay-${p.ref}-${i}`, number: p.ref, type: p.type === 'Vendor Payment' ? 'vendorPayment' : 'customerPayment',
    party: p.party, status: '', date: p.date, amount: parseAmount(p.amount),
  }))
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** Status chip tones for a document: Open blue, Paid / Closed green, Overdue red, Draft slate, Pending / Partial amber. */
export function docStatusTone(status: string): BadgeTone {
  switch (status.toLowerCase()) {
    case 'open': return 'info'
    case 'paid': case 'closed': return 'success'
    case 'overdue': return 'danger'
    case 'pending': case 'partial': return 'warning'
    default: return 'neutral'
  }
}

/** The open documents that hold a currency back, per type, for a refusal's reasons box. */
export function openDocBreakdown(c: Currency): string[] {
  const u = c.usage
  const rows: [number, string, string][] = [
    [u.openInvoices.length, 'open vendor invoice', 'open vendor invoices'],
    [u.openCustomerInvoices.length, 'open customer invoice', 'open customer invoices'],
    [u.openPurchaseOrders.length, 'open purchase order', 'open purchase orders'],
    [u.openSalesOrders.length, 'open sales order', 'open sales orders'],
  ]
  return rows.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
}

/* ── Formatting ───────────────────────────────────────────────────────── */

export const fmtAmount = (n: number, dp: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })

/** "د.إ 85,000.00": the symbol, a left-to-right mark so a right-to-left symbol
 *  does not pull the digits in front of it, then the amount. */
export const money = (symbol: string, n: number, dp: number) => `${symbol}‎ ${fmtAmount(n, dp)}`

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

/** The system's ID for a currency, from its ISO numeric code. */
export const internalIdOf = (c: Currency) => `CUR-${c.numericCode.padStart(6, '0')}`
