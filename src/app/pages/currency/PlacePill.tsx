// The Currency Library's Country / Region pill on the quick-filter row: every
// place the listing's Country / Region column shows (a currency's main entry and
// the other countries it is used in), A–Z, each with the flag the column draws
// for it. A currency matches when it is used in any place ticked, so Germany
// finds EUR. The Exchange Rates tables keep the Region pill (RegionPill).
import { Globe } from 'lucide-react'
import type { Currency } from '../../data/currencies'
import { PillFilter } from '../../coa/components/PillFilter'
import { FlagImage } from '../../coa/components/FlagImage'
import { countriesOf, countryFlagOf, placeFlagOf } from './model'

/** Every place in the listing with its flag, drawn as the column draws it. */
export function placesOf(rows: Currency[]): { name: string; flag: string }[] {
  const flags = new Map<string, string>()
  rows.forEach(c => countriesOf(c).forEach((name, i) => {
    const flag = i === 0 ? placeFlagOf(name, c.code) : countryFlagOf(name)
    if (!flags.get(name)) flags.set(name, flag)
  }))
  return [...flags].map(([name, flag]) => ({ name, flag })).sort((a, b) => a.name.localeCompare(b.name))
}

export const usedInAny = (c: Currency, places: string[]) => countriesOf(c).some(x => places.includes(x))

export function PlacePill({ places, selected, onChange, countFor }: {
  places: { name: string; flag: string }[]
  selected: string[]
  onChange: (next: string[]) => void
  /** Currencies a place would show ticked alone. */
  countFor: (place: string) => number
}) {
  return (
    <PillFilter
      label="Country / Region"
      icon={<Globe size={14} />}
      description="Show currencies used in the countries or regions you tick."
      options={places.map(p => ({ value: p.name, label: p.name, count: countFor(p.name), icon: <FlagImage code={p.flag} /> }))}
      selected={selected}
      onChange={onChange}
      searchPlaceholder="Search country or region"
    />
  )
}
