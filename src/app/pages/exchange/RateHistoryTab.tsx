// Pair detail: the Rate history tab. CoA's register-tab pattern (spec-detail
// §5.1): a flat table in a full-width card, search, density, Columns, and an
// Effective Date pill on the quick-filter row (CoA's ledger Amount pill, with dates). It lists one rate type, the page's own:
// the mid-market page shows the provider's syncs, the corporate page the
// corporate rate's changes. The page's range does not narrow it.
import { useEffect, useMemo, useState } from 'react'
import { RATE_TOOLTIPS } from '../../utils/rateCopy'
import { Marked } from '../../coa/components/ui'
import { CoaTableCard, PillRow, TableEmptyState } from '../../coa/components/TableCard'
import { TableToolbar } from '../../coa/components/TableToolbar'
import { CoaDataTable, useCoaTable, type CoaColumn } from '../../coa/components/CoaDataTable'
import { DateRangePill } from '../../coa/components/DateRangePill'
import { EmptyCell } from '../../coa/components/cells'
import { PersonCell, personText } from '../../coa/components/AuditCells'
import { cn, fmtDate } from '../../coa/lib/utils'
import { fmtInverse, fmtRate, fmtSignedPct } from './rateModel'
import type { RateHistoryRow } from './pairData'

interface HistoryFilters { from: string; to: string }
const NO_FILTERS: HistoryFilters = { from: '', to: '' }
const countFilters = (f: HistoryFilters) => (f.from || f.to ? 1 : 0)
const matches = (r: RateHistoryRow, f: HistoryFilters) => (!f.from || r.effectiveDate >= f.from) && (!f.to || r.effectiveDate <= f.to)

export function RateHistoryTab({ rows, code }: { rows: RateHistoryRow[]; code: string }) {
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState(query)
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(query), 300); return () => clearTimeout(t) }, [query])
  const [filters, setFilters] = useState<HistoryFilters>(NO_FILTERS)
  const shown = rows.filter(r => matches(r, filters))

  const columns = useMemo<CoaColumn<RateHistoryRow>[]>(() => [
    {
      key: 'effective', label: 'Effective Date', locked: true, width: 170, info: RATE_TOOLTIPS.effectiveDate,
      render: (r, ctx) => <span className="text-sm text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 500 }}><Marked text={fmtDate(r.effectiveDate)} q={ctx.q} /></span>,
      sortValue: r => `${r.effectiveDate}|${r.at}`, searchText: r => fmtDate(r.effectiveDate), filter: 'date', filterValue: r => r.effectiveDate,
    },
    {
      key: 'rate', label: 'Rate Value', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[130px]',
      info: `One ${code} in the base currency.`,
      render: (r, ctx) => <span className="text-sm font-medium text-slate-700 tabular-nums whitespace-nowrap"><Marked text={fmtRate(r.rate)} q={ctx.q} /></span>,
      sortValue: r => r.rate, searchText: r => fmtRate(r.rate), filter: 'range',
    },
    {
      key: 'inverse', label: 'Inverse Rate', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[130px]', info: RATE_TOOLTIPS.inverse,
      render: r => <span className="text-sm text-slate-500 tabular-nums whitespace-nowrap">{fmtInverse(r.rate)}</span>,
      sortValue: r => 1 / r.rate, filter: 'range', filterValue: r => 1 / r.rate,
    },
    {
      key: 'change', label: 'Change', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[110px]',
      info: 'Against the previous sync (mid-market) or the rate it replaced (corporate).',
      render: r => (r.changePct == null ? <EmptyCell /> : (
        <span className={cn('text-sm tabular-nums whitespace-nowrap', r.changePct > 0 ? 'text-success-700' : r.changePct < 0 ? 'text-danger-700' : 'text-fg-subtle')} style={{ fontWeight: 500 }}>
          {fmtSignedPct(r.changePct, 3)}
        </span>
      )),
      sortValue: r => r.changePct, filter: 'range',
    },
    {
      key: 'by', label: 'Set By', pad: 'person', cellClassName: 'px-4 max-w-[220px]', headerClassName: 'min-w-[160px]',
      render: (r, ctx) => <PersonCell name={r.by} comfort={ctx.comfort} q={ctx.q} />,
      sortValue: r => personText(r.by), searchText: r => personText(r.by), filter: 'multiselect', filterValue: r => personText(r.by),
    },
    {
      key: 'source', label: 'Source', headerClassName: 'min-w-[160px]',
      render: (r, ctx) => <span className="text-sm text-slate-700 whitespace-nowrap"><Marked text={r.source} q={ctx.q} /></span>,
      sortValue: r => r.source, searchText: r => r.source, filter: 'multiselect',
    },
  ], [code])

  const table = useCoaTable<RateHistoryRow>({
    columns, rows: shown, query: debouncedQ, getRowId: r => r.id, rememberAs: 'fx.pair:history',
    defaultSort: { key: 'effective', dir: 'desc' },
  })
  const narrowed = countFilters(filters) > 0 || Object.keys(table.colFilters).length > 0

  return (
    <CoaTableCard
      table={table}
      className="min-h-[calc(100vh-260px)]"
      toolbar={
        <TableToolbar
          search={{ value: query, onChange: setQuery, placeholder: 'Search rate history' }}
          count={{ shown: table.rows.length, total: rows.length, noun: 'entries' }}
          density={table.densityMenuProps}
          columns={{ open: table.columnsOpen, onToggle: () => table.setColumnsOpen(o => !o), count: table.visibleCount }}
        />
      }
      pills={
        <PillRow>
          <DateRangePill
            label="Effective Date"
            description="Show entries that took effect between these dates. Leave one blank for no limit."
            from={filters.from}
            to={filters.to}
            onChange={(from, to) => setFilters({ from, to })}
          />
        </PillRow>
      }
    >
      {/* Block-windowed at any length, like CoA's Transactions tab: fifty drawn at a time, never more than a hundred. */}
      <CoaDataTable
        table={table}
        windowAbove={0}
        emptyState={<TableEmptyState noun="entries" query={debouncedQ} filtersActive={narrowed} onClearSearch={() => setQuery('')} onClearFilters={() => { setFilters(NO_FILTERS); table.setColFilters({}) }} where="the rate history" />}
      />
    </CoaTableCard>
  )
}

