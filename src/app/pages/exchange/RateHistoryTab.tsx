// Pair detail: the Rate history tab. CoA's register-tab pattern (spec-detail
// §5.1): a flat table in a full-width card, type quick-filter pills with counts,
// search, density, Columns. The page's range does not narrow it.
import { useEffect, useMemo, useState } from 'react'
import { RATE_TOOLTIPS } from '../../utils/rateCopy'
import { Badge, Marked } from '../../coa/components/ui'
import { CoaTableCard, PillRow, TableEmptyState } from '../../coa/components/TableCard'
import { TableToolbar } from '../../coa/components/TableToolbar'
import { CoaDataTable, useCoaTable, type CoaColumn } from '../../coa/components/CoaDataTable'
import { QuickFilterPill } from '../../coa/components/Filters'
import { EmptyCell, PARTNER_CHIP_CLS } from '../../coa/components/cells'
import { PersonCell, StampCell, personText, stampText } from '../../coa/components/AuditCells'
import { cn, fmtDate } from '../../coa/lib/utils'
import { fmtInverse, fmtRate, fmtSignedPct } from './rateModel'
import type { HistoryEvent, RateHistoryRow } from './pairData'

const EVENT_TONE: Record<HistoryEvent, 'neutral' | 'success' | 'info' | 'danger' | 'warning'> = {
  Synced: 'neutral', Created: 'success', Updated: 'info', Scheduled: 'info', Archived: 'danger', Restored: 'warning',
}

type TypePill = 'all' | 'Mid-market' | 'Corporate'

export function RateHistoryTab({ rows, code }: { rows: RateHistoryRow[]; code: string }) {
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState(query)
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(query), 300); return () => clearTimeout(t) }, [query])
  // Opens on every entry, as the tab's count does.
  const [pill, setPill] = useState<TypePill>('all')
  const shown = pill === 'all' ? rows : rows.filter(r => r.type === pill)
  const counts = { mid: rows.filter(r => r.type === 'Mid-market').length, corp: rows.filter(r => r.type === 'Corporate').length }

  const columns = useMemo<CoaColumn<RateHistoryRow>[]>(() => [
    {
      key: 'effective', label: 'Effective date', locked: true, width: 170, info: RATE_TOOLTIPS.effectiveDate,
      render: (r, ctx) => <span className="text-sm text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 500 }}><Marked text={fmtDate(r.effectiveDate)} q={ctx.q} /></span>,
      sortValue: r => `${r.effectiveDate}|${r.at}`, searchText: r => fmtDate(r.effectiveDate), filter: 'date', filterValue: r => r.effectiveDate,
    },
    {
      key: 'type', label: 'Rate type', headerClassName: 'min-w-[130px]',
      render: (r, ctx) => <Badge tone={r.type === 'Corporate' ? 'orange' : 'purple'} className={PARTNER_CHIP_CLS}><Marked text={r.type} q={ctx.q} /></Badge>,
      sortValue: r => r.type, searchText: r => r.type, filter: 'multiselect',
    },
    {
      key: 'event', label: 'Event', headerClassName: 'min-w-[110px]',
      info: 'Synced by the provider, or set, updated, scheduled for a later date, archived or restored by your team.',
      render: (r, ctx) => <Badge tone={EVENT_TONE[r.event]} className={PARTNER_CHIP_CLS}><Marked text={r.event} q={ctx.q} /></Badge>,
      sortValue: r => r.event, searchText: r => r.event, filter: 'multiselect',
    },
    {
      key: 'rate', label: 'Rate value', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[130px]',
      info: `One ${code} in the base currency.`,
      render: (r, ctx) => <span className="text-sm font-medium text-slate-700 tabular-nums whitespace-nowrap"><Marked text={fmtRate(r.rate)} q={ctx.q} /></span>,
      sortValue: r => r.rate, searchText: r => fmtRate(r.rate), filter: 'range',
    },
    {
      key: 'inverse', label: 'Inverse rate', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[130px]', info: RATE_TOOLTIPS.inverse,
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
      key: 'variance', label: 'Variance vs mid', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[140px]', info: RATE_TOOLTIPS.variance,
      render: (r, ctx) => (r.variance == null ? <EmptyCell /> : (
        <Badge tone={Math.abs(r.variance) > 1 ? 'warning' : 'success'} className={cn(PARTNER_CHIP_CLS, 'tabular-nums')}><Marked text={fmtSignedPct(r.variance)} q={ctx.q} /></Badge>
      )),
      sortValue: r => r.variance, searchText: r => (r.variance == null ? '' : fmtSignedPct(r.variance)), filter: 'range',
    },
    {
      key: 'by', label: 'Set by', pad: 'person', cellClassName: 'px-4 max-w-[220px]', headerClassName: 'min-w-[160px]',
      render: (r, ctx) => <PersonCell name={r.by} comfort={ctx.comfort} q={ctx.q} />,
      sortValue: r => personText(r.by), searchText: r => personText(r.by), filter: 'multiselect', filterValue: r => personText(r.by),
    },
    {
      key: 'source', label: 'Source', headerClassName: 'min-w-[160px]',
      render: (r, ctx) => <span className="text-sm text-slate-700 whitespace-nowrap"><Marked text={r.source} q={ctx.q} /></span>,
      sortValue: r => r.source, searchText: r => r.source, filter: 'multiselect',
    },
    {
      key: 'note', label: 'Note', headerClassName: 'min-w-[220px]',
      render: (r, ctx) => (r.note ? <span className="text-sm text-slate-700 block truncate max-w-[340px]" title={r.note}><Marked text={r.note} q={ctx.q} /></span> : <EmptyCell />),
      sortValue: r => r.note || null, searchText: r => r.note, filter: 'text',
    },
    {
      key: 'at', label: 'Recorded on', defaultHidden: true, headerClassName: 'min-w-[180px]',
      info: 'When the sync ran or the change was saved, in your time zone.',
      render: (r, ctx) => <StampCell at={r.at} q={ctx.q} />,
      sortValue: r => r.at, searchText: r => stampText(r.at), filter: 'date', filterValue: r => r.at,
    },
  ], [code])

  const table = useCoaTable<RateHistoryRow>({
    columns, rows: shown, query: debouncedQ, getRowId: r => r.id, rememberAs: 'fx.pair:history',
    defaultSort: { key: 'effective', dir: 'desc' },
  })
  const narrowed = pill !== 'all' || Object.keys(table.colFilters).length > 0

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
          <QuickFilterPill label="All" count={rows.length} active={pill === 'all'} onClick={() => setPill('all')} />
          <QuickFilterPill label="Mid-market" count={counts.mid} active={pill === 'Mid-market'} onClick={() => setPill('Mid-market')} />
          <QuickFilterPill label="Corporate" count={counts.corp} active={pill === 'Corporate'} onClick={() => setPill('Corporate')} />
        </PillRow>
      }
    >
      {/* Block-windowed at any length, like CoA's Transactions tab: fifty drawn at a time, never more than a hundred. */}
      <CoaDataTable
        table={table}
        windowAbove={0}
        emptyState={<TableEmptyState noun="entries" query={debouncedQ} filtersActive={narrowed} onClearSearch={() => setQuery('')} onClearFilters={() => { setPill('all'); table.setColFilters({}) }} where="the rate history" />}
      />
    </CoaTableCard>
  )
}
