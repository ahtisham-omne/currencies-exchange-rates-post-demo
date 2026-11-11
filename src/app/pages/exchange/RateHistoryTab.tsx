// Pair detail: the Rate history tab. CoA's register-tab pattern (spec-detail
// §5.1): a flat table in a full-width card, type quick-filter pills with counts,
// search, density, Columns, and a Filters panel for Status and Effective Date.
// Each entry's Status says where it stands now: the rate in use (Active), one
// dated for later (Upcoming), one a newer entry took over from (Replaced), or
// the entry that archived the corporate rate (Archived). The page's range does
// not narrow it.
import { useEffect, useMemo, useState } from 'react'
import { RATE_TOOLTIPS } from '../../utils/rateCopy'
import { Badge, Marked } from '../../coa/components/ui'
import { CoaTableCard, PillRow, TableEmptyState } from '../../coa/components/TableCard'
import { TableToolbar } from '../../coa/components/TableToolbar'
import { CoaDataTable, useCoaTable, type CoaColumn } from '../../coa/components/CoaDataTable'
import { AllPill, DateRangeFromTo, FDivider, FilterPill, FiltersModal, PillGrid, QuickFilterPill, Section } from '../../coa/components/Filters'
import { EmptyCell, PARTNER_CHIP_CLS } from '../../coa/components/cells'
import { PersonCell, StampCell, personText, stampText } from '../../coa/components/AuditCells'
import { cn, fmtDate, fmtNumber, todayIso } from '../../coa/lib/utils'
import { fmtInverse, fmtRate, fmtSignedPct, fmtVariance } from './rateModel'
import type { HistoryEvent, RateHistoryRow } from './pairData'

const EVENT_TONE: Record<HistoryEvent, 'neutral' | 'success' | 'info' | 'danger' | 'warning'> = {
  Synced: 'neutral', Created: 'success', Updated: 'info', Scheduled: 'info', Archived: 'danger', Restored: 'warning',
}

type TypePill = 'all' | 'Mid-Market' | 'Corporate'

type HistoryStatus = 'Active' | 'Upcoming' | 'Replaced' | 'Archived'
const STATUS_ORDER: HistoryStatus[] = ['Active', 'Upcoming', 'Replaced', 'Archived']
const STATUS_TONE: Record<HistoryStatus, 'success' | 'info' | 'neutral' | 'danger'> = {
  Active: 'success', Upcoming: 'info', Replaced: 'neutral', Archived: 'danger',
}

/** Where each entry stands today. Mid-market: the latest sync is in use, every
 *  earlier one was replaced by the next. Corporate, newest first: a rate dated
 *  after today is Upcoming; the first one at or before today is the rate in use,
 *  unless the newest thing that happened was an archive; the rest were replaced. */
function statusesOf(rows: RateHistoryRow[], today: string): Map<string, HistoryStatus> {
  const out = new Map<string, HistoryStatus>()
  const newest = (a: RateHistoryRow, b: RateHistoryRow) => b.effectiveDate.localeCompare(a.effectiveDate) || b.at.localeCompare(a.at)
  rows.filter(r => r.type === 'Mid-Market').sort(newest).forEach((r, i) => out.set(r.id, i === 0 ? 'Active' : 'Replaced'))
  let settled = false
  for (const r of rows.filter(x => x.type === 'Corporate').sort((a, b) => b.at.localeCompare(a.at))) {
    if (r.effectiveDate > today && r.event !== 'Archived') { out.set(r.id, 'Upcoming'); continue }
    if (r.event === 'Archived') { out.set(r.id, settled ? 'Replaced' : 'Archived'); settled = true; continue }
    out.set(r.id, settled ? 'Replaced' : 'Active')
    settled = true
  }
  return out
}

interface HistoryFilters { statuses: HistoryStatus[]; from: string; to: string }
const NO_FILTERS: HistoryFilters = { statuses: [], from: '', to: '' }
const countFilters = (f: HistoryFilters) => (f.statuses.length ? 1 : 0) + (f.from || f.to ? 1 : 0)

export function RateHistoryTab({ rows, code }: { rows: RateHistoryRow[]; code: string }) {
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState(query)
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(query), 300); return () => clearTimeout(t) }, [query])
  // Opens on every entry, as the tab's count does.
  const [pill, setPill] = useState<TypePill>('all')
  const [filters, setFilters] = useState<HistoryFilters>(NO_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const status = useMemo(() => statusesOf(rows, todayIso()), [rows])
  const statusOf = (r: RateHistoryRow): HistoryStatus => status.get(r.id) ?? 'Replaced'
  const matches = (r: RateHistoryRow, f: HistoryFilters) =>
    (!f.statuses.length || f.statuses.includes(statusOf(r))) &&
    (!f.from || r.effectiveDate >= f.from) && (!f.to || r.effectiveDate <= f.to)
  // The panel narrows first, so the type pills count what the reader can see.
  const filtered = rows.filter(r => matches(r, filters))
  const shown = pill === 'all' ? filtered : filtered.filter(r => r.type === pill)
  const counts = { mid: filtered.filter(r => r.type === 'Mid-Market').length, corp: filtered.filter(r => r.type === 'Corporate').length }

  const columns = useMemo<CoaColumn<RateHistoryRow>[]>(() => [
    {
      key: 'effective', label: 'Effective Date', locked: true, width: 170, info: RATE_TOOLTIPS.effectiveDate,
      render: (r, ctx) => <span className="text-sm text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 500 }}><Marked text={fmtDate(r.effectiveDate)} q={ctx.q} /></span>,
      sortValue: r => `${r.effectiveDate}|${r.at}`, searchText: r => fmtDate(r.effectiveDate), filter: 'date', filterValue: r => r.effectiveDate,
    },
    {
      key: 'type', label: 'Rate Type', headerClassName: 'min-w-[130px]',
      render: (r, ctx) => <Badge tone={r.type === 'Corporate' ? 'orange' : 'purple'} className={PARTNER_CHIP_CLS}><Marked text={r.type} q={ctx.q} /></Badge>,
      sortValue: r => r.type, searchText: r => r.type, filter: 'multiselect',
    },
    {
      key: 'status', label: 'Status', headerClassName: 'min-w-[110px]',
      info: 'Where the entry stands now: the rate in use, one dated for later, one a newer entry replaced, or the archive of the corporate rate.',
      render: (r, ctx) => { const s = status.get(r.id) ?? 'Replaced'; return <Badge tone={STATUS_TONE[s]} className={PARTNER_CHIP_CLS}><Marked text={s} q={ctx.q} /></Badge> },
      sortValue: r => STATUS_ORDER.indexOf(status.get(r.id) ?? 'Replaced'), searchText: r => status.get(r.id) ?? 'Replaced',
      filter: 'multiselect', filterValue: r => status.get(r.id) ?? 'Replaced',
    },
    {
      key: 'event', label: 'Event', headerClassName: 'min-w-[110px]',
      info: 'Synced by the provider, or set, updated, scheduled for a later date, archived or restored by your team.',
      render: (r, ctx) => <Badge tone={EVENT_TONE[r.event]} className={PARTNER_CHIP_CLS}><Marked text={r.event} q={ctx.q} /></Badge>,
      sortValue: r => r.event, searchText: r => r.event, filter: 'multiselect',
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
      key: 'variance', label: 'Variance vs Mid', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[220px]', info: RATE_TOOLTIPS.variance,
      render: (r, ctx) => (r.variance == null ? <EmptyCell /> : (
        <Badge tone={Math.abs(r.variance) > 1 ? 'warning' : 'success'} className={cn(PARTNER_CHIP_CLS, 'tabular-nums')}><Marked text={fmtVariance(r.rate!, r.mid) ?? fmtSignedPct(r.variance)} q={ctx.q} /></Badge>
      )),
      sortValue: r => r.variance, searchText: r => (r.variance == null ? '' : fmtVariance(r.rate!, r.mid) ?? fmtSignedPct(r.variance)), filter: 'range',
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
    {
      key: 'note', label: 'Note', headerClassName: 'min-w-[220px]',
      render: (r, ctx) => (r.note ? <span className="text-sm text-slate-700 block truncate max-w-[340px]" title={r.note}><Marked text={r.note} q={ctx.q} /></span> : <EmptyCell />),
      sortValue: r => r.note || null, searchText: r => r.note, filter: 'text',
    },
    {
      key: 'at', label: 'Recorded On', defaultHidden: true, headerClassName: 'min-w-[180px]',
      info: 'When the sync ran or the change was saved, in your time zone.',
      render: (r, ctx) => <StampCell at={r.at} q={ctx.q} />,
      sortValue: r => r.at, searchText: r => stampText(r.at), filter: 'date', filterValue: r => r.at,
    },
  ], [code, status])

  const table = useCoaTable<RateHistoryRow>({
    columns, rows: shown, query: debouncedQ, getRowId: r => r.id, rememberAs: 'fx.pair:history',
    defaultSort: { key: 'effective', dir: 'desc' },
  })
  const narrowed = pill !== 'all' || countFilters(filters) > 0 || Object.keys(table.colFilters).length > 0

  return (
    <CoaTableCard
      table={table}
      className="min-h-[calc(100vh-260px)]"
      toolbar={
        <TableToolbar
          search={{ value: query, onChange: setQuery, placeholder: 'Search rate history' }}
          filters={{ count: countFilters(filters), onOpen: () => setFiltersOpen(true), onClear: () => setFilters(NO_FILTERS) }}
          count={{ shown: table.rows.length, total: rows.length, noun: 'entries' }}
          density={table.densityMenuProps}
          columns={{ open: table.columnsOpen, onToggle: () => table.setColumnsOpen(o => !o), count: table.visibleCount }}
        />
      }
      pills={
        <PillRow>
          <QuickFilterPill label="All" count={filtered.length} active={pill === 'all'} onClick={() => setPill('all')} />
          <QuickFilterPill label="Mid-Market" count={counts.mid} active={pill === 'Mid-Market'} onClick={() => setPill('Mid-Market')} />
          <QuickFilterPill label="Corporate" count={counts.corp} active={pill === 'Corporate'} onClick={() => setPill('Corporate')} />
        </PillRow>
      }
    >
      {/* Block-windowed at any length, like CoA's Transactions tab: fifty drawn at a time, never more than a hundred. */}
      <CoaDataTable
        table={table}
        windowAbove={0}
        emptyState={<TableEmptyState noun="entries" query={debouncedQ} filtersActive={narrowed} onClearSearch={() => setQuery('')} onClearFilters={() => { setPill('all'); setFilters(NO_FILTERS); table.setColFilters({}) }} where="the rate history" />}
      />
      <HistoryFiltersModal open={filtersOpen} onClose={() => setFiltersOpen(false)} rows={rows} statusOf={statusOf} matches={matches} filters={filters} setFilters={setFilters} />
    </CoaTableCard>
  )
}

/** Status and Effective Date, on the library's Filters modal: a draft, applied from the footer. */
function HistoryFiltersModal({ open, onClose, rows, statusOf, matches, filters, setFilters }: {
  open: boolean
  onClose: () => void
  rows: RateHistoryRow[]
  statusOf: (r: RateHistoryRow) => HistoryStatus
  matches: (r: RateHistoryRow, f: HistoryFilters) => boolean
  filters: HistoryFilters
  setFilters: (f: HistoryFilters) => void
}) {
  const [draft, setDraft] = useState<HistoryFilters>(filters)
  useEffect(() => { if (open) setDraft(filters) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (s: HistoryStatus) => setDraft(d => ({ ...d, statuses: d.statuses.includes(s) ? d.statuses.filter(x => x !== s) : [...d.statuses, s] }))
  const live = rows.filter(r => matches(r, draft)).length
  return (
    <FiltersModal
      open={open}
      onClose={onClose}
      activeCount={countFilters(draft)}
      onClear={() => setDraft(NO_FILTERS)}
      onApply={() => { setFilters(draft); onClose() }}
      applyLabel={`Show ${fmtNumber(live)} ${live === 1 ? 'Entry' : 'Entries'}`}
    >
      <Section title="Status" desc="Show the rate in use, rates dated for later, rates that were replaced, or archives.">
        <PillGrid>
          <AllPill active={!draft.statuses.length} onClick={() => setDraft(d => ({ ...d, statuses: [] }))} />
          {STATUS_ORDER.map(s => (
            <FilterPill key={s} active={draft.statuses.includes(s)} onClick={() => toggle(s)} count={rows.filter(r => statusOf(r) === s).length}>{s}</FilterPill>
          ))}
        </PillGrid>
      </Section>
      <FDivider />
      <Section title="Effective Date" desc="Show entries that took effect between two dates.">
        <DateRangeFromTo from={draft.from} to={draft.to} onFromChange={v => setDraft(d => ({ ...d, from: v }))} onToChange={v => setDraft(d => ({ ...d, to: v }))} />
      </Section>
    </FiltersModal>
  )
}
