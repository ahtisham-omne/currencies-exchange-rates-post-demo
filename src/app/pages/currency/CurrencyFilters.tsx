// The Currency Library's Filters modal on CoA's FiltersModal (a draft, applied
// from the footer): Status, In Use, Decimal Places and Country / Region.
//
// - In Use is "on at least one active transaction", the "N active" the In Use
//   column shows, not "ever on one". It is greyed out while Status is Inactive
//   alone: an inactive currency can't hold an active transaction (deactivation
//   is refused while it does), so the question has one answer there.
// - Country / Region is a grouped dropdown: regions as headings, their countries
//   under them, and a heading picks all of its countries. A currency matches when
//   it is used in any picked country, its main one or any other, so Germany finds
//   EUR. Only countries are stored. "Eurozone" is EUR's main entry rather than a
//   country, so it is the heading and not also an option under it.
// - In Use had a min / max of transactions under Yes; it read as unexplained and
//   duplicated sorting the In Use column, so it went.
import { useEffect, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { REGION_LIST, getRegionForCountry, type Currency } from '../../data/currencies'
import { FiltersModal, Section, FDivider, PillGrid, FilterPill, AllPill } from '../../coa/components/Filters'
import { GroupedDropdownSelect, type DropdownGroup } from '../../coa/components/GroupedDropdownSelect'
import { fmtNumber } from '../../coa/lib/utils'
import { countriesOf, isInUse, statusOf } from './model'

export interface CurrencyPanelFilters {
  statuses: string[]
  inUse: 'yes' | 'no' | null
  decimals: string[]
  /** Countries picked under Country / Region (a region heading adds all of its countries). */
  places: string[]
}

export const EMPTY_CURRENCY_FILTERS: CurrencyPanelFilters = { statuses: [], inUse: null, decimals: [], places: [] }

/** One per facet in use, as the Filters button counts them. */
export const countCurrencyFilters = (f: CurrencyPanelFilters) =>
  (f.statuses.length ? 1 : 0) + (f.inUse ? 1 : 0) + (f.decimals.length ? 1 : 0) + (f.places.length ? 1 : 0)

/** Status set to Inactive alone, where In Use has nothing to ask. */
const inactiveOnly = (f: CurrencyPanelFilters) => f.statuses.length === 1 && f.statuses[0] === 'Inactive'

const matchesInUse = (c: Currency, f: CurrencyPanelFilters) => !f.inUse || inactiveOnly(f) || (f.inUse === 'yes') === isInUse(c)

export const applyCurrencyFilters = (rows: Currency[], f: CurrencyPanelFilters) => {
  const places = new Set(f.places)
  return rows.filter(c =>
    (!f.statuses.length || f.statuses.includes(statusOf(c))) &&
    matchesInUse(c, f) &&
    (!f.decimals.length || f.decimals.includes(String(c.decimalPlaces))) &&
    (!places.size || countriesOf(c).some(x => places.has(x))))
}

/** Regions A–Z, each with the countries the library's currencies are used in, A–Z. */
function placeGroups(rows: Currency[]): DropdownGroup[] {
  const regions = new Set<string>(REGION_LIST)
  const countries = [...new Set(rows.flatMap(countriesOf))].filter(x => !regions.has(x)).sort()
  return [...REGION_LIST].sort()
    .map(r => ({ label: r, options: countries.filter(x => getRegionForCountry(x) === r).map(x => ({ value: x, label: x })) }))
    .filter(g => g.options.length > 0)
}

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
  const toggle = (key: 'statuses' | 'decimals', v: string) =>
    setDraft(d => {
      const next = { ...d, [key]: d[key].includes(v) ? d[key].filter(x => x !== v) : [...d[key], v] }
      // In Use goes quiet under Inactive alone, so it doesn't carry a pick nobody can see.
      return inactiveOnly(next) ? { ...next, inUse: null } : next
    })
  const live = applyCurrencyFilters(rows, draft).length
  const decimals = [...new Set(rows.map(r => r.decimalPlaces))].sort((a, b) => a - b).map(String)
  const inUseOff = inactiveOnly(draft)

  // Which currencies each country holds, for the dropdown's counts.
  const groups = useMemo(() => placeGroups(rows), [rows])
  const usedIn = useMemo(() => {
    const m = new Map<string, Set<string>>()
    rows.forEach(c => countriesOf(c).forEach(x => (m.get(x) ?? m.set(x, new Set()).get(x)!).add(c.code)))
    return m
  }, [rows])
  const countIn = (values: string[]) => new Set(values.flatMap(v => [...(usedIn.get(v) ?? [])])).size

  return (
    <FiltersModal
      open={open}
      onClose={onClose}
      activeCount={countCurrencyFilters(draft)}
      onClear={() => setDraft(EMPTY_CURRENCY_FILTERS)}
      onApply={() => { setFilters(draft); onClose() }}
      applyLabel={`Show ${fmtNumber(live)} ${live === 1 ? 'Currency' : 'Currencies'}`}
    >
      <Section title="Status" desc="Currencies you can or can’t use on new transactions.">
        <PillGrid>
          <AllPill active={!draft.statuses.length} onClick={() => setDraft(d => ({ ...d, statuses: [] }))} />
          {(['Active', 'Inactive'] as const).map(s => (
            <FilterPill key={s} active={draft.statuses.includes(s)} onClick={() => toggle('statuses', s)} count={rows.filter(r => statusOf(r) === s).length}>{s}</FilterPill>
          ))}
        </PillGrid>
      </Section>
      <FDivider />
      <Section title="In Use" desc="Currencies on at least one active transaction.">
        <div aria-disabled={inUseOff || undefined} className={inUseOff ? 'opacity-50 pointer-events-none select-none' : undefined}>
          <PillGrid>
            <AllPill active={!draft.inUse} onClick={() => setDraft(d => ({ ...d, inUse: null }))} />
            <FilterPill active={draft.inUse === 'yes'} onClick={() => setDraft(d => ({ ...d, inUse: d.inUse === 'yes' ? null : 'yes' }))} count={rows.filter(isInUse).length}>Yes</FilterPill>
            <FilterPill active={draft.inUse === 'no'} onClick={() => setDraft(d => ({ ...d, inUse: d.inUse === 'no' ? null : 'no' }))} count={rows.filter(r => !isInUse(r)).length}>No</FilterPill>
          </PillGrid>
        </div>
        {inUseOff && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Info size={12} className="shrink-0" />Inactive currencies have no active transactions.
          </p>
        )}
      </Section>
      <FDivider />
      <Section title="Decimal Places" desc="Currencies by the number of decimal places in their amounts.">
        <PillGrid>
          <AllPill active={!draft.decimals.length} onClick={() => setDraft(d => ({ ...d, decimals: [] }))} />
          {decimals.map(n => (
            <FilterPill key={n} active={draft.decimals.includes(n)} onClick={() => toggle('decimals', n)} count={rows.filter(r => String(r.decimalPlaces) === n).length}>{n}</FilterPill>
          ))}
        </PillGrid>
      </Section>
      <FDivider />
      <Section title="Country / Region" desc="Currencies used in the countries or regions you pick.">
        <GroupedDropdownSelect
          groups={groups}
          selected={draft.places}
          onChange={places => setDraft(d => ({ ...d, places }))}
          getCount={v => countIn([v])}
          getGroupCount={g => countIn(g.options.map(o => o.value))}
          placeholder="All countries and regions"
          searchPlaceholder="Search country or region"
        />
      </Section>
    </FiltersModal>
  )
}
