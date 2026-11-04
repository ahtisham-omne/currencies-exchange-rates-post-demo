// The Currency Library's Filters modal on CoA's FiltersModal (a draft, applied
// from the footer): Status, In use (Yes / No, with a min / max when Yes),
// Decimal places and Region - the four facets the library has always offered.
import { useEffect, useState } from 'react'
import type { Currency } from '../../data/currencies'
import { FiltersModal, Section, FDivider, PillGrid, FilterPill, AllPill, PillSection, RangeMinMax } from '../../coa/components/Filters'
import { fmtNumber } from '../../coa/lib/utils'
import { countInUse, regionOf, statusOf } from './model'

export interface CurrencyPanelFilters {
  statuses: string[]
  inUse: 'yes' | 'no' | null
  inUseMin: string
  inUseMax: string
  decimals: string[]
  regions: string[]
}

export const EMPTY_CURRENCY_FILTERS: CurrencyPanelFilters = { statuses: [], inUse: null, inUseMin: '', inUseMax: '', decimals: [], regions: [] }

/** One per facet in use, as the Filters button counts them. */
export const countCurrencyFilters = (f: CurrencyPanelFilters) =>
  (f.statuses.length ? 1 : 0) + (f.inUse ? 1 : 0) + (f.decimals.length ? 1 : 0) + (f.regions.length ? 1 : 0)

const matchesInUse = (c: Currency, f: CurrencyPanelFilters) => {
  if (!f.inUse) return true
  const n = countInUse(c)
  if (f.inUse === 'no') return n === 0
  if (n < 1) return false
  if (f.inUseMin !== '' && n < Number(f.inUseMin)) return false
  if (f.inUseMax !== '' && n > Number(f.inUseMax)) return false
  return true
}

export const applyCurrencyFilters = (rows: Currency[], f: CurrencyPanelFilters) => rows.filter(c =>
  (!f.statuses.length || f.statuses.includes(statusOf(c))) &&
  matchesInUse(c, f) &&
  (!f.decimals.length || f.decimals.includes(String(c.decimalPlaces))) &&
  (!f.regions.length || f.regions.includes(regionOf(c) ?? '')))

export function CurrencyFiltersModal({ open, onClose, rows, filters, setFilters }: {
  open: boolean
  onClose: () => void
  /** Every currency, for the facet counts and the live forecast. */
  rows: Currency[]
  filters: CurrencyPanelFilters
  setFilters: (f: CurrencyPanelFilters) => void
}) {
  const [draft, setDraft] = useState<CurrencyPanelFilters>(filters)
  useEffect(() => { if (open) setDraft(filters) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (key: 'statuses' | 'decimals' | 'regions', v: string) =>
    setDraft(d => ({ ...d, [key]: d[key].includes(v) ? d[key].filter(x => x !== v) : [...d[key], v] }))
  const live = applyCurrencyFilters(rows, draft).length
  const decimals = [...new Set(rows.map(r => r.decimalPlaces))].sort((a, b) => a - b).map(String)
  const regions = [...new Set(rows.map(r => regionOf(r)).filter((r): r is NonNullable<typeof r> => !!r))].sort()

  return (
    <FiltersModal
      open={open}
      onClose={onClose}
      activeCount={countCurrencyFilters(draft)}
      onClear={() => setDraft(EMPTY_CURRENCY_FILTERS)}
      onApply={() => { setFilters(draft); onClose() }}
      applyLabel={`Show ${fmtNumber(live)} ${live === 1 ? 'currency' : 'currencies'}`}
    >
      <Section title="Status" desc="Show active currencies, inactive ones, or both.">
        <PillGrid>
          <AllPill active={!draft.statuses.length} onClick={() => setDraft(d => ({ ...d, statuses: [] }))} />
          {(['Active', 'Inactive'] as const).map(s => (
            <FilterPill key={s} active={draft.statuses.includes(s)} onClick={() => toggle('statuses', s)} count={rows.filter(r => statusOf(r) === s).length}>{s}</FilterPill>
          ))}
        </PillGrid>
      </Section>
      <FDivider />
      <Section title="In use" desc="Show currencies that are on any document, or ones that aren't.">
        <PillGrid>
          <AllPill active={!draft.inUse} onClick={() => setDraft(d => ({ ...d, inUse: null }))} />
          <FilterPill active={draft.inUse === 'yes'} onClick={() => setDraft(d => ({ ...d, inUse: d.inUse === 'yes' ? null : 'yes' }))} count={rows.filter(r => countInUse(r) > 0).length}>Yes</FilterPill>
          <FilterPill active={draft.inUse === 'no'} onClick={() => setDraft(d => ({ ...d, inUse: d.inUse === 'no' ? null : 'no' }))} count={rows.filter(r => countInUse(r) === 0).length}>No</FilterPill>
        </PillGrid>
        {draft.inUse === 'yes' && (
          <div className="mt-3">
            <RangeMinMax
              values={rows.map(r => countInUse(r)).filter(n => n > 0)}
              min={draft.inUseMin}
              max={draft.inUseMax}
              prefix="#"
              magnitude
              onMinChange={v => setDraft(d => ({ ...d, inUseMin: v }))}
              onMaxChange={v => setDraft(d => ({ ...d, inUseMax: v }))}
            />
          </div>
        )}
      </Section>
      <FDivider />
      <Section title="Decimal places" desc="Show currencies by how many digits their amounts carry after the point.">
        <PillGrid>
          <AllPill active={!draft.decimals.length} onClick={() => setDraft(d => ({ ...d, decimals: [] }))} />
          {decimals.map(n => (
            <FilterPill key={n} active={draft.decimals.includes(n)} onClick={() => toggle('decimals', n)} count={rows.filter(r => String(r.decimalPlaces) === n).length}>
              {n} {n === '1' ? 'decimal' : 'decimals'}
            </FilterPill>
          ))}
        </PillGrid>
      </Section>
      <FDivider />
      <Section title="Region" desc="Show currencies by the region of their primary country.">
        <PillSection
          options={regions.map(r => ({ value: r, label: r }))}
          selected={draft.regions}
          onToggle={r => toggle('regions', r)}
          getCount={r => rows.filter(x => regionOf(x) === r).length}
          leading={<AllPill active={!draft.regions.length} onClick={() => setDraft(d => ({ ...d, regions: [] }))} />}
        />
      </Section>
    </FiltersModal>
  )
}
