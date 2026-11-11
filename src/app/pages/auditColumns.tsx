// The four audit columns every table in the module carries: Created By, Created
// On, Last Updated By and Last Updated On, on CoA's audit cells (a person with
// their photo, a date and time). One builder, so the Currency Library and both
// exchange rate tables label, sort, search and filter them the same way.
import type { CoaColumn } from '../coa/components/CoaDataTable'
import { EmptyCell } from '../coa/components/cells'
import { PersonCell, StampCell, personText, stampText } from '../coa/components/AuditCells'

export interface AuditFields { createdBy?: string; createdAt?: string; updatedBy?: string; updatedAt?: string }
type AuditKey = keyof AuditFields

/** The four tooltips, shared by the tables' columns and the detail pages' fields. */
export const auditTooltips = (noun: string): Record<AuditKey, string> => ({
  createdBy: `User who added this ${noun}.`,
  createdAt: `When this ${noun} was added.`,
  updatedBy: `User who last changed this ${noun}.`,
  updatedAt: `When this ${noun} was last changed.`,
})

/** `noun` names the record in the tooltips ("rate", "currency"); `shown` lists the columns on by default. */
export function auditColumns<T>(of: (row: T) => AuditFields, noun: string, shown: AuditKey[] = []): CoaColumn<T>[] {
  const person = (key: AuditKey, label: string, info: string): CoaColumn<T> => ({
    key, label, info, defaultHidden: !shown.includes(key),
    pad: 'person', cellClassName: 'px-4 max-w-[220px]', headerClassName: 'min-w-[170px]',
    render: (r, ctx) => { const n = of(r)[key]; return n ? <PersonCell name={n} comfort={ctx.comfort} q={ctx.q} /> : <EmptyCell /> },
    sortValue: r => personText(of(r)[key]) || null, searchText: r => personText(of(r)[key]),
    filter: 'multiselect', filterValue: r => personText(of(r)[key]),
  })
  const stamp = (key: AuditKey, label: string, info: string): CoaColumn<T> => ({
    key, label, info, defaultHidden: !shown.includes(key), headerClassName: 'min-w-[170px]',
    render: (r, ctx) => { const at = of(r)[key]; return at ? <StampCell at={at} q={ctx.q} /> : <EmptyCell /> },
    sortValue: r => of(r)[key] || null, searchText: r => stampText(of(r)[key]),
    filter: 'date', filterValue: r => of(r)[key] || null,
  })
  const tip = auditTooltips(noun)
  return [
    person('createdBy', 'Created By', tip.createdBy),
    stamp('createdAt', 'Created On', tip.createdAt),
    person('updatedBy', 'Last Updated By', tip.updatedBy),
    stamp('updatedAt', 'Last Updated On', tip.updatedAt),
  ]
}
