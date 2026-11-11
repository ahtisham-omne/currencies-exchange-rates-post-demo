// Ported from chart-of-accounts-v2.1/src/components/comms/recordDirectory.ts; adapted: the owners are currencies and exchange rates (corporate and mid-market) instead of accounts and journal entries, and a currency's sub-records are its rates.
/* Ported from the reporting module's comms cluster (its recordDirectory.ts).

   ModifyTagModal is a three-step picker: module -> owning record -> sub-record.
   In the source the middle step is a report template and the third is a report
   generated from it. This module's own two-level hierarchy is a currency and
   the exchange rates quoted for it, so that is what the steps read.

   The records are passed in rather than pulled off the store here, so the
   directory stays hook-free and a caller cannot end up offering a record the
   library does not hold. */
import type { Currency } from '../../../data/currencies'
import { BASE_CURRENCY, type MidMarketRate, type StandardRate } from '../../../data/exchangeRates'
import { recordKey } from '../../lib/recordStore'
import { fmtDate } from '../../lib/utils'

/** The middle step: a record that can own correspondence. */
export interface RecordOwner {
  /** The record's own id, which is what a thread's subject uses. */
  id: string
  /** Prefixed reference a thread is filed under (see `refOf` in lib/comms). */
  ref: string
  /** What the picker shows as the row title. */
  name: string
  /** Secondary line: enough to tell two similar rows apart. */
  meta: string
  /** The record's own status, shown as a pill beside its reference. */
  status: string
}

/** The third step: a specific record under an owner. */
export interface RecordSubRecord {
  id: string
  label: string
  status?: string
  /** The "No record" sentinel prepended to every sub-list. Renders with
   *  distinct styling and an alternate secondary line, exactly as the source
   *  did - it files the thread against the OWNER without pinning it to one
   *  specific record underneath. */
  isNoRecord?: boolean
}

/** Which sub-list to build under an owner. */
export type RecordOwnerKind = 'currency' | 'rate'

/** Everything the picker can offer, read off the store by the caller. */
export interface RecordSource {
  currencies: Currency[]
  midMarketRates: MidMarketRate[]
  standardRates: StandardRate[]
}

const fmtRate = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: n < 1 ? 6 : 4 })

/** The library, the owners that actually have a second level under them. */
export function currencyOwners(currencies: Currency[]): RecordOwner[] {
  return currencies.map(c => ({
    id: recordKey('currency', c.code),
    ref: `CUR-${c.code}`,
    name: c.name,
    meta: `${c.country} · ${c.decimalPlaces} decimal ${c.decimalPlaces === 1 ? 'place' : 'places'}`,
    status: c.status === 'active' ? 'Active' : 'Inactive',
  }))
}

/* A rate is known the way the Exchange Rate Library knows it: by its pair, and
   by which of the pair's two rates it is. A pair can carry a corporate rate
   that has been archived; it is still a record a thread can be filed against. */
export function rateOwners({ midMarketRates, standardRates }: Pick<RecordSource, 'midMarketRates' | 'standardRates'>): RecordOwner[] {
  const corporate = new Map<string, StandardRate>()
  for (const r of standardRates) {
    const held = corporate.get(r.sourceCurrency)
    if (!held || r.status === 'active' || (held.status !== 'active' && r.updatedAt > held.updatedAt)) corporate.set(r.sourceCurrency, r)
  }
  const out: RecordOwner[] = []
  for (const m of midMarketRates) {
    if (m.sourceCurrency === BASE_CURRENCY) continue
    const pair = `${m.sourceCurrency}/${BASE_CURRENCY}`
    const corp = corporate.get(m.sourceCurrency)
    if (corp) {
      out.push({
        id: recordKey('exchangeRate', `${m.sourceCurrency}:std`),
        ref: `CR-${pair}`,
        name: `${m.sourceCurrencyName} Corporate Rate`,
        meta: `Corporate · ${fmtRate(corp.standardRate)} ${BASE_CURRENCY} · Effective ${fmtDate(corp.effectiveDate)}`,
        status: corp.status === 'active' ? 'Active' : 'Archived',
      })
    }
    out.push({
      id: recordKey('exchangeRate', `${m.sourceCurrency}:mid`),
      ref: `MR-${pair}`,
      name: `${m.sourceCurrencyName} Mid-Market Rate`,
      meta: `Mid-Market · ${fmtRate(m.rate)} ${BASE_CURRENCY} · ${fmtDate(m.effectiveDate)}`,
      status: 'Active',
    })
  }
  return out
}

/** Owners for a module key, matching TAG_MODULES in ModifyTagModal. */
export function ownersForModule(moduleKey: string, src: RecordSource): RecordOwner[] {
  switch (moduleKey) {
    case 'currency-library': return currencyOwners(src.currencies)
    case 'exchange-rates': return rateOwners(src)
    /* The source synthesised eight fictional rows for a module it held no data
       for. Both of this module's keys have real records, so an unknown key has
       nothing honest to offer. */
    default: return []
  }
}

/**
 * Sub-records under one owner, with the "No record" sentinel first - the
 * source's contract, unchanged.
 */
export function getOwnerSubRecords(owner: RecordOwner, kind: RecordOwnerKind, src: RecordSource): RecordSubRecord[] {
  const noRecord: RecordSubRecord = {
    id: owner.ref,
    label: 'No Record',
    isNoRecord: true,
  }
  if (kind !== 'rate') return [noRecord]

  // Every rate quoted for this currency: its corporate rate, then its mid-market rate.
  const code = owner.ref.replace(/^CUR-/, '')
  const rates = rateOwners(src).filter(r => r.ref.startsWith(`CR-${code}/`) || r.ref.startsWith(`MR-${code}/`))
  return [noRecord, ...rates.map(r => ({ id: r.ref, label: `${r.name} · ${r.meta.split(' · ').slice(1).join(' · ')}`, status: r.status }))]
}
