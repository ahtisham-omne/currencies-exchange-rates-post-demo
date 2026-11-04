// CoA kit demo: the list page (Currency Library shape) - PageHeader with two
// tabs, KPI shelf, table card with toolbar, pills, bulk bar, a 150-row table
// with frozen and Actions columns, Filters modal, Columns panel, density menu.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRightLeft, ChevronDown, CircleCheck, CircleSlash, Coins, Download, Eye, FileSpreadsheet, FileText,
  Power, Trash2, TrendingDown, TrendingUp, Minus, Info,
} from 'lucide-react'
import { CoaPage } from '../components/CoaPage'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, Menu, MenuItem, Tooltip, useResponsiveIconSize } from '../components/ui'
import { PerformanceInsights, KpiInsightsPanel, activeKpiDefs, useKpiShelf, type KpiDefinition } from '../components/Insights'
import { TableToolbar } from '../components/TableToolbar'
import { CoaTableCard, PillRow, TableEmptyState } from '../components/TableCard'
import { CoaDataTable, TableNoteRow, useCoaTable, type CoaColumn } from '../components/CoaDataTable'
import { QuickFilterPill, FiltersModal, Section, FDivider, PillGrid, FilterPill, AllPill, PillSection, RangeMinMax } from '../components/Filters'
import { BulkActionBar } from '../components/BulkActionBar'
import { MultiSelectFilter } from '../components/MultiSelectFilter'
import { CurrencyCell, OverflowPills } from '../components/cells'
import { StatusMenu, type StatusOption } from '../components/StatusChip'
import { PersonCell, StampCell, stampText, personText } from '../components/AuditCells'
import { FlagImage } from '../components/FlagImage'
import { useRememberedState } from '../lib/rememberedState'
import { pushToast } from '../lib/toast'
import { useLifecycleFlow, lifecycleIcon, type LifecyclePlan } from '../lib/lifecycle'
import { fmtNumber, cn } from '../lib/utils'
import { Banner } from '../components/ui'
import { BASE, demoCurrencies, demoRates, type DemoCurrency, type DemoRate } from './demoData'
import { getFlagUrlByCountry } from '../../utils/currencyFlags'

// Country name → flag code, for the Country / Region overflow list.
const flagOf = (country: string) => getFlagUrlByCountry(country).match(/\/([a-z]{2})\.png$/)?.[1] ?? ''

export const CURRENCY_STATUS_OPTIONS: StatusOption<'Active' | 'Inactive'>[] = [
  { value: 'Active', verb: 'Activate', meaning: ['Offered on new transactions, rates and reports.'] },
  { value: 'Inactive', verb: 'Deactivate', meaning: ['Not offered on new transactions. Its rates and history are kept.'] },
]

/** The demo's shared currency state, kept for the session so list and detail agree. */
export function useDemoCurrencies() {
  return useRememberedState<DemoCurrency[]>('coaKit:currencies', demoCurrencies)
}

/** The currency lifecycle plans, CoA-style: refusal, confirm, or immediate commit. */
export function useCurrencyLifecycle(setRows: (fn: (rows: DemoCurrency[]) => DemoCurrency[]) => void) {
  const flow = useLifecycleFlow()
  const setStatus = (codes: string[], status: DemoCurrency['status']) =>
    setRows(rows => rows.map(r => (codes.includes(r.code) ? { ...r, status, updatedAt: new Date().toISOString(), updatedBy: 'Ahtisham Ahmad (You)' } : r)))

  const plan = (next: DemoCurrency['status'], c: DemoCurrency): LifecyclePlan => {
    if (next === 'Active') return { allowed: true, commit: () => setStatus([c.code], 'Active'), toast: `${c.code} activated` }
    if (c.isBase) return {
      allowed: false, commit: () => {},
      refusal: {
        title: `Can't deactivate ${c.code}`,
        description: [`${c.code} is your base currency. Every rate in the library is quoted against it, so it stays active.`],
        dismissLabel: 'Got it',
      },
    }
    if (c.openDocs > 0) return {
      allowed: false, commit: () => {},
      refusal: {
        title: `Can't deactivate ${c.code} yet`,
        description: [`${c.code} is on open documents. Close or settle them first, then deactivate it.`],
        reasonsTitle: 'Still open',
        reasons: [`${c.openDocs} open ${c.openDocs === 1 ? 'document' : 'documents'}`],
      },
    }
    return {
      allowed: true,
      confirm: {
        tone: 'warning',
        icon: lifecycleIcon('deactivate'),
        title: `Deactivate ${c.code}?`,
        description: [`${c.code} will stop being offered on new transactions. Its rates and history are kept, and you can activate it again anytime.`],
        confirmLabel: 'Deactivate currency',
      },
      commit: () => setStatus([c.code], 'Inactive'),
      toast: `${c.code} deactivated`,
    }
  }
  const request = (next: DemoCurrency['status'], c: DemoCurrency) => flow.request(plan(next, c))
  const requestBulk = (next: DemoCurrency['status'], targets: DemoCurrency[], onDone: () => void) => {
    if (next === 'Active') {
      flow.request({ allowed: true, commit: () => setStatus(targets.map(t => t.code), 'Active'), toast: `${targets.length} ${targets.length === 1 ? 'currency' : 'currencies'} activated` }, onDone)
      return
    }
    const ok = targets.filter(t => !t.isBase && t.openDocs === 0)
    const held = targets.filter(t => t.isBase || t.openDocs > 0)
    if (!ok.length) {
      flow.request({ allowed: false, commit: () => {}, refusal: { title: 'Nothing to deactivate', description: ['Every currency you picked is the base currency or is on open documents.'], reasonsTitle: 'Held back', reasons: held.map(h => `${h.code} · ${h.isBase ? 'base currency' : `${h.openDocs} open documents`}`) } })
      return
    }
    flow.request({
      allowed: true,
      confirm: {
        tone: 'warning', icon: lifecycleIcon('deactivate'), badge: 'Deactivate',
        title: `Deactivate ${ok.length} ${ok.length === 1 ? 'currency' : 'currencies'}?`,
        description: ['They will stop being offered on new transactions. Their rates and history are kept, and you can activate them again anytime.'],
        reasonsTitle: held.length ? 'Not included' : undefined,
        reasons: held.length ? held.map(h => `${h.code} · ${h.isBase ? 'base currency' : `${h.openDocs} open documents`}`) : undefined,
        confirmLabel: `Deactivate ${ok.length === 1 ? 'currency' : 'currencies'}`,
      },
      commit: () => setStatus(ok.map(t => t.code), 'Inactive'),
      toast: `${ok.length} ${ok.length === 1 ? 'currency' : 'currencies'} deactivated`,
      toastDescription: held.length ? `${held.length} held back.` : undefined,
      toastTone: held.length ? 'info' : 'success',
    }, onDone)
  }
  return { request, requestBulk, modal: flow.modal }
}

type Pill = 'all' | 'active' | 'base' | 'inactive'
interface PanelFilters { statuses: string[]; inUse: 'yes' | 'no' | null; inUseMin: string; inUseMax: string; decimals: string[]; regions: string[] }
const EMPTY_FILTERS: PanelFilters = { statuses: [], inUse: null, inUseMin: '', inUseMax: '', decimals: [], regions: [] }
const countPanel = (f: PanelFilters) => (f.statuses.length ? 1 : 0) + (f.inUse ? 1 : 0) + (f.decimals.length ? 1 : 0) + (f.regions.length ? 1 : 0)
const applyPanel = (rows: DemoCurrency[], f: PanelFilters) => rows.filter(r =>
  (!f.statuses.length || f.statuses.includes(r.status)) &&
  (!f.inUse || (f.inUse === 'no' ? r.inUse === 0 : r.inUse > 0 && (f.inUseMin === '' || r.inUse >= +f.inUseMin) && (f.inUseMax === '' || r.inUse <= +f.inUseMax))) &&
  (!f.decimals.length || f.decimals.includes(String(r.decimals))) &&
  (!f.regions.length || f.regions.includes(r.region)))

const LIST_KPIS: KpiDefinition[] = [
  { key: 'active', label: 'Active currencies', category: 'Status', tooltip: 'Currencies offered on new transactions.' },
  { key: 'inactive', label: 'Inactive currencies', category: 'Status', tooltip: 'Currencies kept for history but not offered on new transactions.' },
  { key: 'in_use', label: 'Currencies in use', category: 'Usage', tooltip: 'Currencies on at least one open document.' },
  { key: 'blocking', label: 'Open documents', category: 'Usage', tooltip: 'Open documents that keep their currency from being deactivated.' },
  { key: 'base', label: 'Base currency', category: 'Rates', tooltip: 'The currency every rate is quoted against.' },
  { key: 'countries', label: 'Countries / regions', category: 'Coverage', tooltip: 'Countries and territories the library covers.' },
  { key: 'zero_dp', label: 'Zero-decimal currencies', category: 'Coverage' },
]
const LIST_DEFAULT = ['active', 'inactive', 'in_use', 'blocking', 'base', 'countries']

const RATE_KPIS: KpiDefinition[] = [
  { key: 'count', label: 'Mid-market rates', category: 'Rates', tooltip: 'Rates synced from the provider, base row included.' },
  { key: 'sync', label: 'Last sync', category: 'Freshness' },
  { key: 'gain', label: 'Largest 24h gain', category: 'Performance' },
  { key: 'drop', label: 'Largest 24h drop', category: 'Performance' },
  { key: 'avg', label: 'Average 24h change', category: 'Performance' },
]
const RATE_DEFAULT = ['count', 'sync', 'gain', 'drop', 'avg']

export function DemoList() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const ic14 = useResponsiveIconSize(14)
  const [rows, setRows] = useDemoCurrencies()
  const lifecycle = useCurrencyLifecycle(setRows)
  const [tab, setTab] = useRememberedState<'currencies' | 'rates'>('coaKit:tab', 'currencies')

  // Search: remembered, debounced 300ms, prefilled from the TopBar's ?q=.
  const [query, setQuery] = useRememberedState('coaKit:query', params.get('q') ?? '')
  const [debouncedQ, setDebouncedQ] = useState(query)
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(query), 300); return () => clearTimeout(t) }, [query])
  useEffect(() => { const q = params.get('q'); if (q != null) setQuery(q) }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const [pill, setPill] = useRememberedState<Pill>('coaKit:pill', 'all')
  const [regions, setRegions] = useRememberedState<string[]>('coaKit:regions', [])
  const [filters, setFilters] = useRememberedState<PanelFilters>('coaKit:filters', EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const listShelf = useKpiShelf(LIST_DEFAULT, 'coaKit:kpis')
  const rateShelf = useKpiShelf(RATE_DEFAULT, 'coaKit:rateKpis')
  const shelf = tab === 'currencies' ? listShelf : rateShelf
  const kpiDefs = tab === 'currencies' ? LIST_KPIS : RATE_KPIS

  const rates = useMemo(() => demoRates(rows), [rows])

  // Pill counts: the rows a click would show, over the panel-filtered set.
  const panelRows = useMemo(() => applyPanel(rows, filters).filter(r => !regions.length || regions.includes(r.region)), [rows, filters, regions])
  const pillCounts = {
    active: panelRows.filter(r => r.status === 'Active').length,
    inactive: panelRows.filter(r => r.status === 'Inactive').length,
    base: panelRows.filter(r => r.isBase).length,
  }
  const pillRows = useMemo(() => panelRows.filter(r =>
    pill === 'active' ? r.status === 'Active' : pill === 'inactive' ? r.status === 'Inactive' : pill === 'base' ? r.isBase : true), [panelRows, pill])

  const columns = useMemo<CoaColumn<DemoCurrency>[]>(() => [
    {
      key: 'currency', label: 'Currency', locked: true, width: 300,
      info: 'The ISO 4217 code and name.',
      render: (r, ctx) => (
        <CurrencyCell code={r.code} country={r.flag} name={r.name} q={ctx.q} showName strong={ctx.band} onOpen={ctx.openRow}
          trailing={r.isBase ? <Badge tone="brand" className="shrink-0">Base</Badge> : undefined} />
      ),
      sortValue: r => r.code, searchText: r => [r.code, r.name], filter: 'text', filterValue: r => `${r.code} ${r.name}`,
    },
    {
      key: 'symbol', label: 'Symbol', headerClassName: 'min-w-[90px]',
      render: r => <span className="text-sm text-slate-700 whitespace-nowrap">{r.symbol}</span>,
      searchText: r => r.symbol, filter: 'multiselect', filterValue: r => r.symbol,
    },
    {
      key: 'decimals', label: 'Decimals', align: 'right', headerClassName: 'min-w-[100px]', cellClassName: 'pl-4 pr-4',
      info: 'Digits after the decimal point that amounts in this currency carry.',
      render: r => <span className="text-sm text-slate-700 tabular-nums">{r.decimals}</span>,
      sortValue: r => r.decimals, searchText: r => String(r.decimals), filter: 'multiselect', filterValue: r => String(r.decimals),
    },
    {
      key: 'country', label: 'Country / Region', headerClassName: 'min-w-[220px]',
      render: (r, ctx) => (
        <OverflowPills
          plain
          q={ctx.q}
          category="Countries / Regions"
          values={r.countries.map((c, i) => ({ name: c, subtitle: i === 0 ? r.region : undefined, icon: <FlagImage code={i === 0 ? r.flag : flagOf(c)} className="text-[13px]" /> }))}
        />
      ),
      sortValue: r => r.country, searchText: r => r.countries, filter: 'multiselect', filterValue: r => r.region,
    },
    {
      key: 'linked', label: 'Linked transactions', align: 'right', headerClassName: 'min-w-[160px]', cellClassName: 'pl-4 pr-4',
      info: 'Open documents in this currency, and every document it has ever been on.',
      render: r => (
        <span className="text-sm tabular-nums whitespace-nowrap">
          {r.inUse > 0
            ? <button type="button" onClick={e => { e.stopPropagation(); navigate(`/accounting/coa-kit/${r.code}?tab=linked`) }} className="text-primary hover:text-[#0862D0] hover:underline underline-offset-2" style={{ fontWeight: 600 }}>{r.inUse} active</button>
            : <span className="text-fg-subtle">0 active</span>}
          <span className="text-fg-subtle"> · {fmtNumber(r.totalDocs)} total</span>
        </span>
      ),
      sortValue: r => r.inUse, filter: 'range', filterValue: r => r.inUse,
    },
    {
      key: 'status', label: 'Status', headerClassName: 'min-w-[120px]',
      render: (r, ctx) => <StatusMenu status={r.status} options={CURRENCY_STATUS_OPTIONS} onPick={next => lifecycle.request(next, r)} q={ctx.q} />,
      sortValue: r => r.status, searchText: r => r.status, filter: 'multiselect', filterValue: r => r.status,
    },
    {
      key: 'numeric', label: 'Numeric code', defaultHidden: true, headerClassName: 'min-w-[120px]',
      info: 'The ISO 4217 three-digit code.',
      render: r => <span className="text-sm text-slate-700 tabular-nums">{r.numericCode}</span>,
      sortValue: r => r.numericCode, searchText: r => r.numericCode, filter: 'text',
    },
    {
      key: 'createdBy', label: 'Created by', pad: 'person', cellClassName: 'px-4 max-w-[220px]', headerClassName: 'min-w-[170px]',
      info: 'Who added it.',
      render: (r, ctx) => <PersonCell name={r.createdBy} comfort={ctx.comfort} q={ctx.q} />,
      sortValue: r => personText(r.createdBy), searchText: r => personText(r.createdBy), filter: 'multiselect', filterValue: r => personText(r.createdBy),
    },
    {
      key: 'updatedAt', label: 'Last updated on', headerClassName: 'min-w-[170px]',
      info: 'When it was changed last, in your time zone.',
      render: (r, ctx) => <StampCell at={r.updatedAt} q={ctx.q} />,
      sortValue: r => r.updatedAt, searchText: r => stampText(r.updatedAt), filter: 'date', filterValue: r => r.updatedAt,
    },
  ], [navigate, lifecycle])

  const table = useCoaTable<DemoCurrency>({
    columns, rows: pillRows, query: debouncedQ, getRowId: r => r.code, rememberAs: 'coaKit:table',
    pinTop: r => r.isBase,
  })

  // Rates tab: its own table state.
  const rateColumns = useMemo<CoaColumn<DemoRate>[]>(() => [
    {
      key: 'currency', label: 'Source currency', locked: true, width: 300,
      info: 'The currency being priced in the base currency.',
      render: (r, ctx) => <CurrencyCell code={r.code} country={r.flag} name={r.name} q={ctx.q} showName strong={ctx.band} onOpen={ctx.openRow}
        trailing={r.code === BASE ? <Badge tone="brand" className="shrink-0">Base</Badge> : undefined} />,
      sortValue: r => r.code, searchText: r => [r.code, r.name],
    },
    {
      key: 'rate', label: 'Mid-market exchange rate', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[200px]',
      info: 'One unit of the source currency in the base currency, at the provider\'s mid-market rate.',
      render: r => <span className="text-sm font-medium text-slate-700 tabular-nums whitespace-nowrap">{r.rate.toFixed(4)}</span>,
      sortValue: r => r.rate, searchText: r => r.rate.toFixed(4), filter: 'range', filterValue: r => r.rate,
    },
    {
      key: 'inverse', label: 'Inverse rate', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[140px]',
      info: 'One unit of the base currency in the source currency.',
      render: r => <span className="text-sm text-slate-500 tabular-nums whitespace-nowrap">{(1 / r.rate).toFixed(6)}</span>,
      sortValue: r => 1 / r.rate, searchText: r => (1 / r.rate).toFixed(6),
    },
    {
      key: 'change', label: 'Change (24h)', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[130px]',
      render: r => {
        const Icon = r.change24h > 0 ? TrendingUp : r.change24h < 0 ? TrendingDown : Minus
        return (
          <span className={cn('inline-flex items-center justify-end gap-1 text-sm tabular-nums whitespace-nowrap', r.change24h > 0 ? 'text-success-700' : r.change24h < 0 ? 'text-danger-700' : 'text-fg-subtle')} style={{ fontWeight: 500 }}>
            <Icon size={12} />{r.change24h > 0 ? '+' : ''}{r.change24h.toFixed(2)}%
          </span>
        )
      },
      sortValue: r => r.change24h, filter: 'range', filterValue: r => r.change24h,
    },
    {
      key: 'corporate', label: 'Corporate rate', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[140px]',
      render: r => r.corporate ? <span className="text-sm text-slate-700 tabular-nums">{r.corporate.toFixed(4)}</span> : <span className="text-fg-subtle">-</span>,
      sortValue: r => r.corporate ?? null,
    },
  ], [])
  const rateTable = useCoaTable<DemoRate>({
    columns: rateColumns, rows: rates, query: debouncedQ, getRowId: r => r.code, rememberAs: 'coaKit:rates',
    pinTop: r => r.code === BASE,
  })

  const kpiValue = (key: string): string => {
    switch (key) {
      case 'active': return fmtNumber(rows.filter(r => r.status === 'Active').length)
      case 'inactive': return fmtNumber(rows.filter(r => r.status === 'Inactive').length)
      case 'in_use': return fmtNumber(rows.filter(r => r.inUse > 0).length)
      case 'blocking': return fmtNumber(rows.reduce((n, r) => n + r.openDocs, 0))
      case 'base': return `${BASE} · Pakistani Rupee`
      case 'countries': return fmtNumber(rows.reduce((n, r) => n + r.countries.length, 0))
      case 'zero_dp': return fmtNumber(rows.filter(r => r.decimals === 0).length)
      case 'count': return fmtNumber(rates.length)
      case 'sync': return 'Apr 10, 2026'
      case 'gain': { const g = [...rates].sort((a, b) => b.change24h - a.change24h)[0]; return g ? `${g.code} +${g.change24h.toFixed(2)}%` : '-' }
      case 'drop': { const d = [...rates].sort((a, b) => a.change24h - b.change24h)[0]; return d ? `${d.code} ${d.change24h.toFixed(2)}%` : '-' }
      case 'avg': return `${(rates.reduce((s, r) => s + r.change24h, 0) / Math.max(1, rates.length)).toFixed(2)}%`
      default: return '-'
    }
  }
  const kpiFace = (key: string) => key === 'base'
    ? { value: kpiValue(key), onSelect: () => navigate(`/accounting/coa-kit/${BASE}`), selectTitle: `Open ${BASE}` }
    : key === 'sync' ? { value: kpiValue(key), caption: '2:30 PM PKT' } : kpiValue(key)

  const selected = table.selected
  const selectedRows = rows.filter(r => selected.has(r.code))
  const toActivate = selectedRows.filter(r => r.status !== 'Active')
  const toDeactivate = selectedRows.filter(r => r.status === 'Active')
  const otherNarrowing = pill !== 'all' || countPanel(filters) > 0 || regions.length > 0 || Object.keys(table.colFilters).length > 0
  const clearNarrowing = () => { setPill('all'); setFilters(EMPTY_FILTERS); setRegions([]); table.setColFilters({}) }

  const exportAs = (fmt: string, n: number) => pushToast(`${fmt} exported`, 'success', `${n} ${n === 1 ? 'currency' : 'currencies'}, as filtered.`)
  const regionOptions = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.region, (m.get(r.region) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([id, count]) => ({ id, label: id, count }))
  }, [rows])

  const isRates = tab === 'rates'

  return (
    <CoaPage crumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'CoA kit' }]}>
      <div className="flex-1 flex flex-col min-h-0 pb-6">
        <PageHeader
          icon={<Coins size={16} />}
          title="Currency Library"
          subtitle="Kit demo: every CoA list-page piece on the currency seed data."
          tabs={[{ id: 'currencies', label: 'Currencies', count: rows.length }, { id: 'rates', label: 'Mid-market rates', count: rates.length }]}
          activeTab={tab}
          onTabChange={id => setTab(id as 'currencies' | 'rates')}
          secondaryActions={
            <>
              <Menu trigger={<Button variant="secondary" iconRight={<ChevronDown size={ic14} className="text-fg-subtle/60" />}>Actions</Button>}>
                {c => (
                  <>
                    <MenuItem icon={<FileText size={ic14} />} onClick={() => { c(); exportAs('CSV', table.rows.length) }}>Export CSV</MenuItem>
                    <MenuItem icon={<FileSpreadsheet size={ic14} />} onClick={() => { c(); exportAs('Excel', table.rows.length) }}>Export Excel</MenuItem>
                    <MenuItem icon={<Download size={ic14} />} onClick={() => { c(); exportAs('PDF', table.rows.length) }}>Export PDF</MenuItem>
                  </>
                )}
              </Menu>
              <Tooltip side="bottom" content="How it works">
                <button className="btn-secondary !px-0 w-9" aria-label="How it works" onClick={() => pushToast('Currencies are ISO 4217 and fixed. You can activate or deactivate them.', 'info')}>
                  <Info className="w-4 h-4" strokeWidth={2.25} />
                </button>
              </Tooltip>
            </>
          }
          primaryAction={<Button icon={<ArrowRightLeft size={ic14} />} onClick={() => navigate(`/accounting/coa-kit/USD`)}>Open USD</Button>}
        />

        <div className="px-6 lg:px-8 mt-4">
          <PerformanceInsights
            defs={kpiDefs}
            valueOf={kpiFace}
            activeKpis={shelf.activeKpis}
            setActiveKpis={shelf.setActiveKpis}
            defaultKpis={isRates ? RATE_DEFAULT : LIST_DEFAULT}
            onOpenPanel={() => shelf.setPanelOpen(true)}
            onReset={shelf.reset}
            lastRefreshed={shelf.lastRefreshed}
            onRefresh={shelf.refresh}
          />
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-6 lg:px-8 mt-4">
          {!isRates ? (
            <CoaTableCard
              table={table}
              toolbar={
                <TableToolbar
                  search={{ value: query, onChange: setQuery, placeholder: 'Search currencies' }}
                  filters={{ count: countPanel(filters), onOpen: () => setFiltersOpen(true), onClear: () => setFilters(EMPTY_FILTERS) }}
                  count={{ shown: table.rows.length, total: rows.length, noun: 'currencies' }}
                  insights={{ open: shelf.panelOpen, onClick: () => shelf.setPanelOpen(true), count: activeKpiDefs(shelf.activeKpis, kpiDefs).length }}
                  density={table.densityMenuProps}
                  columns={{ open: table.columnsOpen, onToggle: () => table.setColumnsOpen(o => !o), count: table.visibleCount }}
                />
              }
              bulkBar={selected.size > 0 ? (
                <BulkActionBar
                  count={selected.size}
                  noun="currency"
                  nounPlural="currencies"
                  onClear={table.clearSelection}
                  actions={[
                    { key: 'activate', label: 'Activate', icon: CircleCheck, tone: 'success', count: toActivate.length, onClick: () => lifecycle.requestBulk('Active', toActivate, table.clearSelection) },
                    { key: 'deactivate', label: 'Deactivate', icon: CircleSlash, tone: 'warning', count: toDeactivate.length, onClick: () => lifecycle.requestBulk('Inactive', toDeactivate, table.clearSelection) },
                    { key: 'export', label: 'Export selected', icon: Download, tone: 'neutral', onClick: () => exportAs('CSV', selected.size) },
                  ]}
                />
              ) : null}
              pills={
                <PillRow leading={<MultiSelectFilter label="Region" options={regionOptions} selected={regions} onChange={setRegions} searchable />}>
                  <QuickFilterPill label="Show All" active={pill === 'all'} onClick={() => setPill('all')} />
                  <QuickFilterPill label="Active" count={pillCounts.active} active={pill === 'active'} onClick={() => setPill('active')} />
                  <QuickFilterPill label="Base currency" count={pillCounts.base} active={pill === 'base'} onClick={() => setPill('base')} />
                  <QuickFilterPill label="Inactive" tone="danger" count={pillCounts.inactive} active={pill === 'inactive'} onClick={() => setPill(p => (p === 'inactive' ? 'all' : 'inactive'))} />
                </PillRow>
              }
            >
              <CoaDataTable
                table={table}
                selectable
                isBand={r => r.isBase}
                onRowClick={r => navigate(`/accounting/coa-kit/${r.code}`)}
                rowMenu={(r, close) => (
                  <>
                    <MenuItem icon={<Eye size={14} />} onClick={() => { close(); navigate(`/accounting/coa-kit/${r.code}`) }}>View details</MenuItem>
                    <MenuItem icon={<ArrowRightLeft size={14} />} onClick={() => { close(); pushToast(`Opening the corporate rate form for ${r.code}`, 'info') }}>Set corporate rate</MenuItem>
                    {r.status === 'Active'
                      ? <MenuItem icon={<CircleSlash size={14} />} warning onClick={() => { close(); lifecycle.request('Inactive', r) }}>Deactivate currency</MenuItem>
                      : <MenuItem icon={<Power size={14} />} onClick={() => { close(); lifecycle.request('Active', r) }}>Activate currency</MenuItem>}
                    <MenuItem icon={<Trash2 size={14} />} danger disabled disabledReason="ISO currencies can't be deleted. Deactivate it instead.">Delete currency</MenuItem>
                  </>
                )}
                emptyState={<TableEmptyState noun="currencies" query={debouncedQ} filtersActive={otherNarrowing} onClearSearch={() => setQuery('')} onClearFilters={clearNarrowing} where="the library" />}
              />
            </CoaTableCard>
          ) : (
            <CoaTableCard
              table={rateTable}
              notes={
                <div className="px-4 py-3 border-b border-border">
                  <Banner tone="info" title="Mid-market rates">Synced from Open Exchange Rates. Corporate rates you set are kept apart and never overwritten by a sync.</Banner>
                </div>
              }
              toolbar={
                <TableToolbar
                  search={{ value: query, onChange: setQuery, placeholder: 'Search rates' }}
                  count={{ shown: rateTable.rows.length, total: rates.length, noun: 'rates' }}
                  meta="Synced every 24h · Updated Apr 10, 2026 at 14:30 PKT"
                  insights={{ open: shelf.panelOpen, onClick: () => shelf.setPanelOpen(true), count: activeKpiDefs(shelf.activeKpis, kpiDefs).length }}
                  density={rateTable.densityMenuProps}
                  columns={{ open: rateTable.columnsOpen, onToggle: () => rateTable.setColumnsOpen(o => !o), count: rateTable.visibleCount }}
                />
              }
            >
              <CoaDataTable
                table={rateTable}
                isBand={r => r.code === BASE}
                onRowClick={r => navigate(`/accounting/coa-kit/${r.code}`)}
                canExpand={r => r.code !== BASE}
                renderExpanded={r => <RowInverter rate={r} />}
                afterRow={r => (r.code === BASE ? <TableNoteRow band>All exchange rates below are quoted against this currency.</TableNoteRow> : null)}
                rowMenu={(r, close) => <MenuItem icon={<Eye size={14} />} onClick={() => { close(); navigate(`/accounting/coa-kit/${r.code}`) }}>View details</MenuItem>}
                emptyState={<TableEmptyState noun="rates" query={debouncedQ} filtersActive={Object.keys(rateTable.colFilters).length > 0} onClearSearch={() => setQuery('')} onClearFilters={() => rateTable.setColFilters({})} where="the library" />}
              />
            </CoaTableCard>
          )}
        </div>
      </div>

      <CurrencyFiltersModal open={filtersOpen} onClose={() => setFiltersOpen(false)} rows={rows} filters={filters} setFilters={setFilters} />
      <KpiInsightsPanel
        open={shelf.panelOpen}
        onOpenChange={shelf.setPanelOpen}
        defs={kpiDefs}
        valueOf={kpiFace}
        activeKpis={shelf.activeKpis}
        onToggleKpi={shelf.toggleKpi}
        onReset={shelf.reset}
        defaultKpis={isRates ? RATE_DEFAULT : LIST_DEFAULT}
      />
      {lifecycle.modal}
    </CoaPage>
  )
}

/* The expanded row: a one-unit inverter, both directions. */
function RowInverter({ rate }: { rate: DemoRate }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3 bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)]">
      {[
        { from: rate.code, to: BASE, v: rate.rate.toFixed(4) },
        { from: BASE, to: rate.code, v: (1 / rate.rate).toFixed(6) },
      ].map(x => (
        <div key={x.from} className="rounded-lg border border-border bg-white px-3 py-2 min-w-[220px]">
          <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>1 {x.from} equals</p>
          <p className="text-[13px] text-slate-700 tabular-nums" style={{ fontWeight: 600 }}>{x.v} {x.to}</p>
        </div>
      ))}
      <span className="text-[11px] text-fg-subtle">Effective {rate.effectiveDate}</span>
    </div>
  )
}

function CurrencyFiltersModal({ open, onClose, rows, filters, setFilters }: {
  open: boolean
  onClose: () => void
  rows: DemoCurrency[]
  filters: PanelFilters
  setFilters: (f: PanelFilters) => void
}) {
  const [draft, setDraft] = useState<PanelFilters>(filters)
  useEffect(() => { if (open) setDraft(filters) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (key: 'statuses' | 'decimals' | 'regions', v: string) =>
    setDraft(d => ({ ...d, [key]: d[key].includes(v) ? d[key].filter(x => x !== v) : [...d[key], v] }))
  const live = applyPanel(rows, draft).length
  const decimals = [...new Set(rows.map(r => String(r.decimals)))].sort()
  const regions = [...new Set(rows.map(r => r.region))].sort()
  return (
    <FiltersModal
      open={open}
      onClose={onClose}
      activeCount={countPanel(draft)}
      onClear={() => setDraft(EMPTY_FILTERS)}
      onApply={() => { setFilters(draft); onClose() }}
      applyLabel={`Show ${fmtNumber(live)} ${live === 1 ? 'currency' : 'currencies'}`}
    >
      <Section title="Status">
        <PillGrid>
          <AllPill active={!draft.statuses.length} onClick={() => setDraft(d => ({ ...d, statuses: [] }))} />
          {['Active', 'Inactive'].map(s => (
            <FilterPill key={s} active={draft.statuses.includes(s)} onClick={() => toggle('statuses', s)} count={rows.filter(r => r.status === s).length}>{s}</FilterPill>
          ))}
        </PillGrid>
      </Section>
      <FDivider />
      <Section title="In use" desc="Show currencies that are on open documents, or ones that aren't.">
        <PillGrid>
          <AllPill active={!draft.inUse} onClick={() => setDraft(d => ({ ...d, inUse: null }))} />
          <FilterPill active={draft.inUse === 'yes'} onClick={() => setDraft(d => ({ ...d, inUse: d.inUse === 'yes' ? null : 'yes' }))} count={rows.filter(r => r.inUse > 0).length}>Yes</FilterPill>
          <FilterPill active={draft.inUse === 'no'} onClick={() => setDraft(d => ({ ...d, inUse: d.inUse === 'no' ? null : 'no' }))} count={rows.filter(r => r.inUse === 0).length}>No</FilterPill>
        </PillGrid>
        {draft.inUse === 'yes' && (
          <div className="mt-3">
            <RangeMinMax values={rows.map(r => r.inUse)} min={draft.inUseMin} max={draft.inUseMax} prefix="#" magnitude
              onMinChange={v => setDraft(d => ({ ...d, inUseMin: v }))} onMaxChange={v => setDraft(d => ({ ...d, inUseMax: v }))} />
          </div>
        )}
      </Section>
      <FDivider />
      <Section title="Decimal places">
        <PillGrid>
          <AllPill active={!draft.decimals.length} onClick={() => setDraft(d => ({ ...d, decimals: [] }))} />
          {decimals.map(n => (
            <FilterPill key={n} active={draft.decimals.includes(n)} onClick={() => toggle('decimals', n)} count={rows.filter(r => String(r.decimals) === n).length}>{n} {n === '1' ? 'decimal' : 'decimals'}</FilterPill>
          ))}
        </PillGrid>
      </Section>
      <FDivider />
      <Section title="Region" desc="Show currencies used in the regions you pick.">
        <PillSection
          options={regions.map(r => ({ value: r, label: r }))}
          selected={draft.regions}
          onToggle={r => toggle('regions', r)}
          getCount={r => rows.filter(x => x.region === r).length}
          leading={<AllPill active={!draft.regions.length} onClick={() => setDraft(d => ({ ...d, regions: [] }))} />}
        />
      </Section>
    </FiltersModal>
  )
}

