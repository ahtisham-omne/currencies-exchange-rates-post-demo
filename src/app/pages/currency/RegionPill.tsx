// Region as a pill on a table's quick-filter row, the way CoA's Dimensions pill
// sits on the chart's: the Currency Library and both exchange rate tables. Every
// region is listed, alphabetically, so the list reads the same on each table; a
// count of 0 says the region has nothing there rather than hiding it.
import { Globe } from 'lucide-react'
import { REGION_LIST } from '../../data/currencies'
import { PillFilter } from '../../coa/components/PillFilter'

const REGIONS_AZ = [...REGION_LIST].sort()

export function RegionPill({ selected, onChange, countFor, noun }: {
  selected: string[]
  onChange: (next: string[]) => void
  /** Rows in a region, as the table would show them with that region ticked alone. */
  countFor: (region: string) => number
  /** What the table lists, for the panel's line: "currencies", "rates". */
  noun: string
}) {
  return (
    <PillFilter
      label="Region"
      icon={<Globe size={14} />}
      description={`Show ${noun} from the regions you tick.`}
      options={REGIONS_AZ.map(r => ({ value: r, label: r, count: countFor(r) }))}
      selected={selected}
      onChange={onChange}
      searchPlaceholder="Search regions"
    />
  )
}
