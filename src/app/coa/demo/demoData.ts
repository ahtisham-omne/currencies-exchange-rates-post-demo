// Sample data for the CoA kit demo route (/accounting/coa-kit). Read-only views
// over the app's seed data, plus deterministic extras (people, dates, series),
// so the demo looks like the screens the kit is for without touching them.
import { SEED_CURRENCIES, countInUse, countOpenDocuments, getRegionForCountry, type Currency } from '../../data/currencies'
import { SEED_MID_MARKET_RATES, SEED_STANDARD_RATES, BASE_CURRENCY } from '../../data/exchangeRates'
import { getCountryCode } from '../../utils/currencyFlags'

export interface DemoCurrency {
  code: string
  name: string
  numericCode: string
  symbol: string
  decimals: number
  country: string
  countries: string[]
  region: string
  flag: string
  status: 'Active' | 'Inactive'
  isBase: boolean
  inUse: number
  openDocs: number
  totalDocs: number
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  internalId: string
  source: Currency
}

export interface DemoRate {
  code: string
  name: string
  flag: string
  rate: number
  change24h: number
  effectiveDate: string
  corporate?: number
}

export const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
const PEOPLE = ['System', 'Ahtisham Ahmad (Controller)', 'Marcus Lee (Accountant)', 'Priya Nair (Engineering Manager)', 'Hannah Weiss (Sales Director)']
const pad = (n: number) => String(n).padStart(2, '0')
const isoFrom = (seed: number, year = 2026) => `${year}-${pad(1 + (seed % 10))}-${pad(1 + (seed % 27))}T${pad(8 + (seed % 9))}:${pad(seed % 60)}:00`

export const BASE = BASE_CURRENCY

export function demoCurrencies(): DemoCurrency[] {
  const pick = SEED_CURRENCIES.filter(c => c.code !== BASE).slice(0, 149)
  const base = SEED_CURRENCIES.find(c => c.code === BASE)
  const list = base ? [base, ...pick] : pick
  return list.map((c, i) => {
    const h = hash(c.code)
    const inUse = countInUse(c)
    return {
      code: c.code,
      name: c.name,
      numericCode: c.numericCode,
      symbol: c.symbol,
      decimals: c.decimalPlaces,
      country: c.country,
      countries: [c.country, ...(c.additionalCountries ?? [])],
      region: getRegionForCountry(c.country) ?? 'Other',
      flag: (getCountryCode(c.code) ?? '').toLowerCase(),
      // A handful inactive, so the pills and lifecycle have something to show.
      status: c.isBaseCurrency || inUse > 0 || h % 7 !== 0 ? 'Active' : 'Inactive',
      isBase: c.code === BASE,
      inUse,
      openDocs: countOpenDocuments(c),
      totalDocs: c.usage.totalLifetimeDocuments,
      createdBy: PEOPLE[h % 2],
      createdAt: isoFrom(h, 2025),
      updatedBy: PEOPLE[(h >>> 3) % PEOPLE.length],
      updatedAt: isoFrom(h >>> 5, 2026),
      internalId: `CUR-${String(1000 + i).padStart(6, '0')}`,
      source: c,
    }
  })
}

export function demoRates(currencies: DemoCurrency[]): DemoRate[] {
  const byCode = new Map(currencies.map(c => [c.code, c]))
  return SEED_MID_MARKET_RATES
    .filter(r => byCode.has(r.sourceCurrency))
    .map(r => ({
      code: r.sourceCurrency,
      name: r.sourceCurrencyName,
      flag: byCode.get(r.sourceCurrency)!.flag,
      rate: r.rate,
      change24h: r.change24h,
      effectiveDate: r.effectiveDate,
      corporate: SEED_STANDARD_RATES.find(s => s.sourceCurrency === r.sourceCurrency && s.status === 'active')?.standardRate,
    }))
}

/** A deterministic daily series of the rate against the base, ending on `end`. */
export function rateSeries(code: string, rate: number, days = 400, end = '2026-11-04'): { date: string; rate: number }[] {
  const out: { date: string; rate: number }[] = []
  let h = hash(code)
  const endD = new Date(end + 'T00:00:00')
  let v = rate * (0.92 + (h % 80) / 1000)
  for (let i = days - 1; i >= 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0
    const drift = ((h % 1000) / 1000 - 0.48) * 0.006
    v = v * (1 + drift)
    const d = new Date(endD)
    d.setDate(d.getDate() - i)
    out.push({ date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, rate: v })
  }
  // Land on today's rate exactly.
  const k = rate / out[out.length - 1].rate
  return out.map(p => ({ ...p, rate: p.rate * k }))
}

export interface DemoDoc {
  id: string
  number: string
  type: 'Vendor invoice' | 'Customer invoice' | 'Purchase order' | 'Sales order' | 'Vendor payment'
  party: string
  status: 'Open' | 'Paid' | 'Overdue' | 'Draft' | 'Pending'
  date: string
  amount: number
}

const PARTIES = ['Dubai Steel Industries', 'Abu Dhabi Exports LLC', 'Sharjah Building Materials', 'Northwind Traders', 'Contoso Ltd.', 'Fabrikam Inc.', 'Tailspin Toys', 'Wide World Importers', 'Litware Inc.', 'Adventure Works']
const TYPES: DemoDoc['type'][] = ['Vendor invoice', 'Customer invoice', 'Purchase order', 'Sales order', 'Vendor payment']
const STATUSES: DemoDoc['status'][] = ['Open', 'Open', 'Pending', 'Overdue', 'Paid', 'Draft']
const PREFIX: Record<DemoDoc['type'], string> = { 'Vendor invoice': 'INV', 'Customer invoice': 'AR', 'Purchase order': 'PO', 'Sales order': 'SO', 'Vendor payment': 'PAY' }

export function demoDocs(code: string, n = 42): DemoDoc[] {
  let h = hash(code + ':docs')
  const out: DemoDoc[] = []
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
    const type = TYPES[h % TYPES.length]
    out.push({
      id: `${code}-doc-${i}`,
      number: `${PREFIX[type]}-2026-${String(1000 + (h % 9000)).padStart(4, '0')}`,
      type,
      party: PARTIES[(h >>> 4) % PARTIES.length],
      status: STATUSES[(h >>> 7) % STATUSES.length],
      date: `2026-${pad(1 + ((h >>> 9) % 10))}-${pad(1 + ((h >>> 12) % 27))}`,
      amount: 500 + ((h >>> 3) % 95000) + ((h % 100) / 100),
    })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}
