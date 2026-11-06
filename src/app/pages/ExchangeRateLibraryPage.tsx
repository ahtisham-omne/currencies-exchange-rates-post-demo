// The Exchange Rates tab of Currency & Exchange Rates (CurrencyExchangePage),
// on the CoA kit: the shared header, the Performance Insights shelf, and one CoA
// table card per rate type, switched by Cash Management's SegmentedTabs atop the
// card (Mid-market rates | Corporate rates).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Archive, ArchiveRestore, ChevronDown, Download, Eye, FileSpreadsheet, FileText, Pencil, Plus } from 'lucide-react'
import { useExchangeRates } from '../context/ExchangeRateContext'
import { EXPLANATORY_BLOCKS } from '../utils/rateCopy'
import { SegmentedTabs } from '../coa/components/SegmentedTabs'
import { Banner, Button, Menu, MenuItem, Tooltip, useResponsiveIconSize } from '../coa/components/ui'
import { PerformanceInsights, KpiInsightsPanel, activeKpiDefs, useKpiShelf, type KpiValue } from '../coa/components/Insights'
import { TableToolbar } from '../coa/components/TableToolbar'
import { CoaTableCard, PillRow, TableEmptyState } from '../coa/components/TableCard'
import { CoaDataTable, TableNoteRow, useCoaTable } from '../coa/components/CoaDataTable'
import { QuickFilterPill } from '../coa/components/Filters'
import { BulkActionBar } from '../coa/components/BulkActionBar'
import { useRememberedState } from '../coa/lib/rememberedState'
import { cn, fmtDate, fmtNumber } from '../coa/lib/utils'
import {
  BASE, BASE_NAME, LAST_SYNC_DATE, LAST_SYNC_TIME, SYNC_LINE, SYNC_LINE_SHORT, baseCorpRow, daysSince, fmtInverse, fmtRate, fmtSignedPct, pairPath,
  toCorpRows, toMidRows, type CorpRow, type MidRow,
} from './exchange/rateModel'
import { LIBRARY_DEFAULT_KPIS, LIBRARY_KPIS, RateFiltersModal, corpColumns, midColumns } from './exchange/libraryConfig'
import { useCorporateRateLifecycle } from './exchange/rateLifecycle'
import { useCorporateRateForm } from './exchange/CorporateRateForm'
import { PairInverter } from './exchange/PairInverter'
import { exportRows, type ExportFormat } from './exchange/rateExport'
import { CurrencyExchangeHeader } from './CurrencyExchangeHeader'

type Tab = 'mid' | 'corp'
type CorpPill = 'all' | 'active' | 'archived'

const EXPANDED_FILL = 'bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)]'

export function ExchangeRatesPanel({ swapIn }: { swapIn?: string } = {}) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const ic14 = useResponsiveIconSize(14)
  const { midMarketRates, standardRates } = useExchangeRates()
  const lifecycle = useCorporateRateLifecycle()
  const form = useCorporateRateForm()

  const [tab, setTab] = useRememberedState<Tab>('fx.rates:tab', 'mid')

  // Search: remembered, debounced 300ms, prefilled from the TopBar's ?q=.
  const [query, setQuery] = useRememberedState('fx.rates:query', params.get('q') ?? '')
  const [debouncedQ, setDebouncedQ] = useState(query)
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(query), 300); return () => clearTimeout(t) }, [query])
  useEffect(() => { const q = params.get('q'); if (q != null) setQuery(q) }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const [pill, setPill] = useRememberedState<CorpPill>('fx.rates:pill', 'all')
  const [regions, setRegions] = useRememberedState<string[]>('fx.rates:regions', [])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [inverted, setInverted] = useState<Set<string>>(new Set())
  const toggleInvert = (id: string) => setInverted(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  // The currency detail page's "Set corporate rate" lands here: Corporate tab,
  // Add form pre-filled for CODE, then the parameter is dropped.
  useEffect(() => {
    const code = params.get('addCorp')
    if (!code) return
    setTab('corp')
    setPill('all')
    form.openAdd(code.toUpperCase())
    const p = new URLSearchParams(params)
    p.delete('addCorp')
    setParams(p, { replace: true })
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const shelf = useKpiShelf(LIBRARY_DEFAULT_KPIS, 'fx.rates:kpis')

  /* ── Rows ── */
  const midAll = useMemo(() => toMidRows(midMarketRates, standardRates), [midMarketRates, standardRates])
  const corpAll = useMemo(() => toCorpRows(standardRates, midMarketRates), [standardRates, midMarketRates])
  const inRegion = (r: { region: string | null }, list = regions) => !list.length || (r.region != null && list.includes(r.region))

  // The base row is the reference every rate is quoted against, so the Region filter never hides it.
  const midRows = useMemo(() => midAll.filter(r => r.isBase || inRegion(r)), [midAll, regions]) // eslint-disable-line react-hooks/exhaustive-deps
  const corpPanel = useMemo(() => corpAll.filter(r => inRegion(r)), [corpAll, regions]) // eslint-disable-line react-hooks/exhaustive-deps
  const pillCounts = {
    active: corpPanel.filter(r => r.status === 'Active').length,
    archived: corpPanel.filter(r => r.status === 'Archived').length,
  }
  // Show All lists what is in force (archived rows wait behind their own pill).
  const corpPillRows = useMemo(() => corpPanel.filter(r => (pill === 'archived' ? r.status === 'Archived' : r.status === 'Active')), [corpPanel, pill])
  const corpRows = useMemo(() => (corpPillRows.length ? [baseCorpRow(), ...corpPillRows] : []), [corpPillRows])

  /* ── Tables ── */
  const midCols = useMemo(() => midColumns(), [])
  const midTable = useCoaTable<MidRow>({
    columns: midCols, rows: midRows, query: debouncedQ, getRowId: r => r.id, rememberAs: 'fx.rates:mid',
    pinTop: r => r.isBase, initialColumnSizing: 'fit',
  })
  // The status chip's picks go through the lifecycle flow; a ref keeps the columns stable.
  const lifecycleRef = useRef(lifecycle)
  lifecycleRef.current = lifecycle
  const corpCols = useMemo(() => corpColumns((next, row) => { if (row.record) lifecycleRef.current.request(next, row.record) }), [])
  const corpTable = useCoaTable<CorpRow>({
    columns: corpCols, rows: corpRows, query: debouncedQ, getRowId: r => r.id, rememberAs: 'fx.rates:corp',
    pinTop: r => r.isBase, initialColumnSizing: 'fit',
  })

  const isMid = tab === 'mid'
  const rateTypeTabs = (
    <SegmentedTabs<Tab>
      tabs={[
        { key: 'mid', label: 'Mid-market rates', count: midAll.length },
        { key: 'corp', label: 'Corporate rates', count: corpAll.length },
      ]}
      activeKey={tab}
      onChange={setTab}
      ariaLabel="Rate types"
    />
  )
  const corpShown = corpTable.rows.filter(r => !r.isBase)

  /* ── KPIs ── */
  const activeCorp = corpAll.filter(r => r.status === 'Active')
  const withVariance = activeCorp.filter(r => r.variance != null)
  const kpiValue = (key: string): string | KpiValue => {
    switch (key) {
      case 'mid_count': return fmtNumber(midAll.length)
      case 'last_sync': return { value: LAST_SYNC_DATE, caption: `${LAST_SYNC_TIME} PKT` }
      case 'active_corp': return fmtNumber(activeCorp.length)
      case 'avg_variance': {
        if (!withVariance.length) return '-'
        const avg = withVariance.reduce((s, r) => s + (r.variance ?? 0), 0) / withVariance.length
        return { value: fmtSignedPct(avg), caption: `Across ${withVariance.length} ${withVariance.length === 1 ? 'rate' : 'rates'}` }
      }
      case 'largest_variance': {
        const top = [...withVariance].sort((a, b) => Math.abs(b.variance ?? 0) - Math.abs(a.variance ?? 0))[0]
        return top
          ? { value: `${top.code} ${fmtSignedPct(top.variance ?? 0)}`, onSelect: () => navigate(pairPath(top.code, 'std')), selectTitle: `Open ${top.code} corporate rate` }
          : '-'
      }
      case 'stale_corp': {
        const n = activeCorp.filter(r => daysSince(r.effectiveDate) > 30).length
        return { value: fmtNumber(n), caption: `of ${activeCorp.length} active` }
      }
      case 'archived_corp': return fmtNumber(corpAll.length - activeCorp.length)
      case 'gain': {
        const g = midAll.filter(r => !r.isBase).sort((a, b) => b.change24h - a.change24h)[0]
        return g ? { value: `${g.code} ${fmtSignedPct(g.change24h)}`, onSelect: () => navigate(pairPath(g.code, 'mid')), selectTitle: `Open ${g.code}` } : '-'
      }
      case 'drop': {
        const d = midAll.filter(r => !r.isBase).sort((a, b) => a.change24h - b.change24h)[0]
        return d ? { value: `${d.code} ${fmtSignedPct(d.change24h)}`, onSelect: () => navigate(pairPath(d.code, 'mid')), selectTitle: `Open ${d.code}` } : '-'
      }
      case 'base': return `${BASE} · ${BASE_NAME}`
      default: return '-'
    }
  }

  /* ── Export: the open tab, as filtered, archived rows left out ── */
  const exportCurrent = (fmt: ExportFormat, only?: CorpRow[]) => {
    if (isMid && !only) {
      const rows = midTable.rows
      void exportRows({
        fileBase: 'mid_market_rates', sheetName: 'Mid-market rates', title: 'Mid-market exchange rates', noun: 'rates', one: 'rate',
        headers: ['Base currency', 'Source currency', 'Currency name', 'Mid-market exchange rate', 'Inverse rate', 'Change (24h)', 'Effective date'],
        rows: rows.map(r => [BASE, r.code, r.name, fmtRate(r.rate), fmtInverse(r.rate), fmtSignedPct(r.change24h), r.effectiveDate]),
        widths: [14, 16, 28, 24, 14, 12, 14],
      }, fmt)
      return
    }
    const rows = (only ?? corpShown).filter(r => r.status === 'Active')
    void exportRows({
      fileBase: 'corporate_rates', sheetName: 'Corporate Rates', title: 'Corporate Exchange Rates', noun: 'rates', one: 'rate',
      headers: ['Base currency', 'Source currency', 'Corporate exchange rate', 'Mid-market exchange rate', 'Variance', 'Effective date', 'Created by'],
      rows: rows.map(r => [BASE, r.code, fmtRate(r.rate), r.mid == null ? '' : fmtRate(r.mid), r.variance == null ? '' : `${r.variance}%`, r.effectiveDate, r.createdBy]),
      widths: [14, 16, 22, 24, 10, 14, 18],
    }, fmt)
  }

  /* ── Selection (Corporate) ── */
  const selectedRecords = corpAll.filter(r => corpTable.selected.has(r.id) && r.record).map(r => r.record!)
  const selectedActive = selectedRecords.filter(r => r.status === 'active')

  const narrowing = regions.length > 0 || Object.keys(isMid ? midTable.colFilters : corpTable.colFilters).length > 0 || (!isMid && pill === 'archived')
  const clearNarrowing = () => { setRegions([]); setPill('all'); (isMid ? midTable : corpTable).setColFilters({}) }

  const regionCount = (region: string) => (isMid ? midAll.filter(r => !r.isBase) : corpAll).filter(r => r.region === region).length
  const regionMatch = (draft: string[]) => (isMid
    ? midAll.filter(r => r.isBase || inRegion(r, draft)).length
    : corpAll.filter(r => inRegion(r, draft) && (pill === 'archived' ? r.status === 'Archived' : r.status === 'Active')).length)

  const toolbarCommon = {
    search: { value: query, onChange: setQuery, placeholder: 'Search rates' },
    filters: { count: regions.length ? 1 : 0, onOpen: () => setFiltersOpen(true), onClear: () => setRegions([]) },
    insights: { open: shelf.panelOpen, onClick: () => shelf.setPanelOpen(true), count: activeKpiDefs(shelf.activeKpis, LIBRARY_KPIS).length },
  }

  const emptyState = (
    <TableEmptyState noun="rates" query={debouncedQ} filtersActive={narrowing}
      onClearSearch={() => setQuery('')} onClearFilters={clearNarrowing} where="the library" />
  )

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 pb-6">
        <CurrencyExchangeHeader
          tab="rates"
          secondaryActions={
            <Menu trigger={<Button variant="secondary" iconRight={<ChevronDown size={ic14} className="text-fg-subtle/60" />}>Actions</Button>}>
              {c => (
                <>
                  <MenuItem icon={<FileText size={ic14} />} onClick={() => { c(); exportCurrent('csv') }}>Export CSV</MenuItem>
                  <MenuItem icon={<FileSpreadsheet size={ic14} />} onClick={() => { c(); exportCurrent('xlsx') }}>Export Excel</MenuItem>
                  <MenuItem icon={<Download size={ic14} />} onClick={() => { c(); exportCurrent('pdf') }}>Export PDF</MenuItem>
                </>
              )}
            </Menu>
          }
          primaryAction={<Button icon={<Plus size={ic14} />} onClick={() => form.openAdd()}>Add corporate rate</Button>}
        />

        {/* Steps in under the header when the page's tab changes. */}
        <div className={cn('flex-1 min-h-0 flex flex-col', swapIn)}>
          <div className="px-6 lg:px-8 mt-4">
            <PerformanceInsights
              defs={LIBRARY_KPIS}
              valueOf={kpiValue}
              activeKpis={shelf.activeKpis}
              setActiveKpis={shelf.setActiveKpis}
              defaultKpis={LIBRARY_DEFAULT_KPIS}
              onOpenPanel={() => shelf.setPanelOpen(true)}
              onReset={shelf.reset}
              lastRefreshed={shelf.lastRefreshed}
              onRefresh={shelf.refresh}
            />
          </div>

          <div className="flex-1 min-h-0 flex flex-col px-6 lg:px-8 mt-4">
            {isMid ? (
              <CoaTableCard
                table={midTable}
                topBar={rateTypeTabs}
                swapKey={tab}
                toolbar={
                  <TableToolbar
                    {...toolbarCommon}
                    count={{ shown: midTable.rows.length, total: midAll.length, noun: 'rates' }}
                    meta={<Tooltip content={SYNC_LINE} side="bottom" align="right"><span className="cursor-default">{SYNC_LINE_SHORT}</span></Tooltip>}
                    density={midTable.densityMenuProps}
                    columns={{ open: midTable.columnsOpen, onToggle: () => midTable.setColumnsOpen(o => !o), count: midTable.visibleCount }}
                  />
                }
                notes={
                  <div className="px-4 py-3 border-b border-border">
                    <Banner tone="info" title="Mid-market rates">{EXPLANATORY_BLOCKS.midMarket}</Banner>
                  </div>
                }
              >
                <CoaDataTable
                  table={midTable}
                  isBand={r => r.isBase}
                  onRowClick={r => navigate(pairPath(r.code, 'mid'))}
                  renderExpanded={r => (
                    <div className={`px-4 py-3 ${EXPANDED_FILL}`}>
                      <PairInverter code={r.code} name={r.name} rate={r.rate} inverted={inverted.has(`mid:${r.id}`)} onToggle={() => toggleInvert(`mid:${r.id}`)} note={`Mid-market rate as of ${LAST_SYNC_DATE}`} />
                    </div>
                  )}
                  afterRow={r => (r.isBase ? <TableNoteRow band>All exchange rates below are quoted against this currency.</TableNoteRow> : null)}
                  rowMenu={(r, close) => (
                    <>
                      <MenuItem icon={<Eye size={14} />} onClick={() => { close(); navigate(pairPath(r.code, 'mid')) }}>View details</MenuItem>
                      {r.isBase
                        ? <MenuItem icon={<Plus size={14} />} disabled disabledReason={`${BASE} is the base currency. Its rate is always 1.0000.`}>Set corporate rate</MenuItem>
                        : r.corporate
                          ? <MenuItem icon={<Pencil size={14} />} onClick={() => { close(); form.openUpdate(r.corporate!.id) }}>Update corporate rate</MenuItem>
                          : <MenuItem icon={<Plus size={14} />} onClick={() => { close(); form.openAdd(r.code) }}>Set corporate rate</MenuItem>}
                    </>
                  )}
                  emptyState={emptyState}
                />
              </CoaTableCard>
            ) : (
              <CoaTableCard
                table={corpTable}
                topBar={rateTypeTabs}
                swapKey={tab}
                toolbar={
                  <TableToolbar
                    {...toolbarCommon}
                    count={{ shown: corpShown.length, total: corpAll.length, noun: 'rates' }}
                    density={corpTable.densityMenuProps}
                    columns={{ open: corpTable.columnsOpen, onToggle: () => corpTable.setColumnsOpen(o => !o), count: corpTable.visibleCount }}
                  />
                }
                bulkBar={corpTable.selected.size > 0 ? (
                  <BulkActionBar
                    count={corpTable.selected.size}
                    noun="rate"
                    nounPlural="rates"
                    onClear={corpTable.clearSelection}
                    actions={[
                      { key: 'archive', label: 'Archive', icon: Archive, tone: 'destructive', count: selectedActive.length, onClick: () => lifecycle.archiveBulk(selectedRecords, corpTable.clearSelection) },
                      { key: 'export', label: 'Export selected', icon: Download, tone: 'neutral', onClick: () => exportCurrent('csv', corpAll.filter(r => corpTable.selected.has(r.id))) },
                    ]}
                  />
                ) : null}
                pills={
                  <PillRow>
                    <QuickFilterPill label="Show All" active={pill === 'all'} onClick={() => setPill('all')} />
                    <QuickFilterPill label="Active" count={pillCounts.active} active={pill === 'active'} onClick={() => setPill('active')} />
                    <QuickFilterPill label="Archived" tone="danger" count={pillCounts.archived} active={pill === 'archived'} onClick={() => setPill(p => (p === 'archived' ? 'all' : 'archived'))} />
                  </PillRow>
                }
                notes={
                  <div className="px-4 py-3 border-b border-border">
                    <Banner tone="info" title="Corporate rates">{EXPLANATORY_BLOCKS.corporate}</Banner>
                  </div>
                }
              >
                <CoaDataTable
                  table={corpTable}
                  selectable
                  isSelectable={r => !r.isBase}
                  isBand={r => r.isBase}
                  onRowClick={r => navigate(r.isBase ? pairPath(BASE, 'mid') : pairPath(r.code, 'std'))}
                  canExpand={r => !r.isBase}
                  renderExpanded={r => (
                    <div className={`px-4 py-3 ${EXPANDED_FILL}`}>
                      <PairInverter code={r.code} name={r.name} rate={r.rate} inverted={inverted.has(`corp:${r.id}`)} onToggle={() => toggleInvert(`corp:${r.id}`)} note={`Corporate rate, effective ${fmtDate(r.effectiveDate)}`} />
                    </div>
                  )}
                  afterRow={r => (r.isBase ? <TableNoteRow band>All exchange rates below are quoted against this currency.</TableNoteRow> : null)}
                  rowMenu={(r, close) => r.isBase ? (
                    <MenuItem icon={<Eye size={14} />} onClick={() => { close(); navigate(pairPath(BASE, 'mid')) }}>View details</MenuItem>
                  ) : (
                    <>
                      <MenuItem icon={<Eye size={14} />} onClick={() => { close(); navigate(pairPath(r.code, 'std')) }}>View details</MenuItem>
                      {r.status === 'Active' && <MenuItem icon={<Pencil size={14} />} onClick={() => { close(); form.openUpdate(r.id) }}>Update rate</MenuItem>}
                      {r.status === 'Active'
                        ? <MenuItem icon={<Archive size={14} />} danger onClick={() => { close(); lifecycle.archive(r.record!) }}>Archive rate</MenuItem>
                        : <MenuItem icon={<ArchiveRestore size={14} />} onClick={() => { close(); lifecycle.restore(r.record!) }}>Restore rate</MenuItem>}
                    </>
                  )}
                  emptyState={emptyState}
                />
              </CoaTableCard>
            )}
          </div>
        </div>
      </div>

      <RateFiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        regions={regions}
        setRegions={setRegions}
        countFor={regionCount}
        matchCount={regionMatch}
      />
      <KpiInsightsPanel
        open={shelf.panelOpen}
        onOpenChange={shelf.setPanelOpen}
        defs={LIBRARY_KPIS}
        valueOf={kpiValue}
        activeKpis={shelf.activeKpis}
        onToggleKpi={shelf.toggleKpi}
        onReset={shelf.reset}
        defaultKpis={LIBRARY_DEFAULT_KPIS}
      />
      {lifecycle.modal}
      {form.modal}
    </>
  )
}
