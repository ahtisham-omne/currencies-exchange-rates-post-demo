// The Exchange Rates tab of Currency & Exchange Rates (CurrencyExchangePage),
// on the CoA kit: the shared header and one CoA table card per rate type,
// switched by Cash Management's SegmentedTabs atop the card (Mid-market rates |
// Corporate rates).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Archive, ArchiveRestore, ChevronDown, Download, ExternalLink, Eye, FileSpreadsheet, FileText, Pencil, Plus } from 'lucide-react'
import { useExchangeRates } from '../context/ExchangeRateContext'
import { API_PROVIDER, API_PROVIDER_URL } from '../data/exchangeRates'
import { EXPLANATORY_BLOCKS } from '../utils/rateCopy'
import { SegmentedTabs } from '../coa/components/SegmentedTabs'
import { Banner, Button, Menu, MenuItem, useResponsiveIconSize } from '../coa/components/ui'
import { TableToolbar } from '../coa/components/TableToolbar'
import { CoaTableCard, PillRow, TableEmptyState } from '../coa/components/TableCard'
import { CoaDataTable, useCoaTable } from '../coa/components/CoaDataTable'
import { FlagImage } from '../coa/components/FlagImage'
import { QuickFilterPill } from '../coa/components/Filters'
import { BulkActionBar } from '../coa/components/BulkActionBar'
import { setStoredValue, useRememberedState, useStoredState } from '../coa/lib/rememberedState'
import { pushToast } from '../coa/lib/toast'
import { cn, fmtDate } from '../coa/lib/utils'
import {
  BASE, LAST_SYNC_AT, LAST_SYNC_DATE, flagOf, fmtInverse, fmtRate, fmtSignedPct, pairPath,
  toCorpRows, toMidRows, type CorpRow, type MidRow,
} from './exchange/rateModel'
import { corpColumns, midColumns } from './exchange/libraryConfig'
import { RegionPill } from './currency/RegionPill'
import { useCorporateRateLifecycle } from './exchange/rateLifecycle'
import { useCorporateRateForm } from './exchange/CorporateRateForm'
import { PairInverter } from './exchange/PairInverter'
import { exportRows, type ExportFormat } from './exchange/rateExport'
import { CurrencyExchangeHeader } from './CurrencyExchangeHeader'

type Tab = 'mid' | 'corp'
type CorpPill = 'all' | 'active' | 'archived'

const EXPANDED_FILL = 'bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)]'

/* The explanation banner above each table. "Don’t Show Again" hides it in this
   browser for good, with an Undo in case it was a slip. Renders nothing once
   hidden, so the table moves up instead of leaving an empty strip. */
function ExplainerBanner({ id, title, children }: { id: Tab; title: string; children: ReactNode }) {
  const hiddenKey = `fx.rates:banner:${id}:hidden`
  const [hidden, setHidden] = useStoredState(hiddenKey, false)
  if (hidden) return null
  const hideForGood = () => {
    setHidden(true)
    // Undo writes storage directly too: the reader may have switched tabs first.
    pushToast(`${title} banner hidden`, 'success', 'It won’t show again in this browser.', {
      label: 'Undo', onClick: () => { setStoredValue(hiddenKey, false); setHidden(false) },
    })
  }
  return (
    <div className="px-4 py-3 border-b border-border">
      <Banner tone="info" title={title} onDontShowAgain={hideForGood}>{children}</Banner>
    </div>
  )
}

/** The rate provider's site, in a new tab. */
function SourceLink({ className }: { className?: string }) {
  return (
    <a href={API_PROVIDER_URL} target="_blank" rel="noopener noreferrer" className={cn('inline-flex items-center gap-0.5 font-medium hover:opacity-80', className)}>
      {API_PROVIDER}<ExternalLink size={11} aria-hidden />
    </a>
  )
}

/* The line above each table's header: what every rate is quoted against, where
   the market figures come from and how often they refresh. It replaces the base
   currency's own row (always 1.0000) and, unlike the banner, can't be hidden. */
function QuotedStrip({ kind }: { kind: Tab }) {
  return (
    <div className="px-4 py-2 border-b border-border flex items-center justify-between gap-x-4 gap-y-1 flex-wrap text-xs text-fg-muted">
      <span className="inline-flex items-center gap-1.5">
        <FlagImage code={flagOf(BASE)} />
        <span>Quoted against <span className="font-medium text-fg">{BASE}</span></span>
      </span>
      <span>
        {kind === 'mid' ? 'Rates from ' : 'Mid-market rates from '}
        <SourceLink className="text-primary" />, updated every 24 hours
        {kind === 'mid' && <> · Last updated {LAST_SYNC_AT}</>}
      </span>
    </div>
  )
}

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

  /* ── Rows ── */
  const midAll = useMemo(() => toMidRows(midMarketRates, standardRates), [midMarketRates, standardRates])
  const corpAll = useMemo(() => toCorpRows(standardRates, midMarketRates), [standardRates, midMarketRates])
  const inRegion = (r: { region: string | null }, list = regions) => !list.length || (r.region != null && list.includes(r.region))

  const midRows = useMemo(() => midAll.filter(r => inRegion(r)), [midAll, regions]) // eslint-disable-line react-hooks/exhaustive-deps
  const corpPanel = useMemo(() => corpAll.filter(r => inRegion(r)), [corpAll, regions]) // eslint-disable-line react-hooks/exhaustive-deps
  const pillCounts = {
    active: corpPanel.filter(r => r.status === 'Active').length,
    archived: corpPanel.filter(r => r.status === 'Archived').length,
  }
  // Show All lists what is in force (archived rows wait behind their own pill).
  const corpPillRows = useMemo(() => corpPanel.filter(r => (pill === 'archived' ? r.status === 'Archived' : r.status === 'Active')), [corpPanel, pill])

  /* ── Tables ── */
  // 100 rates a page by default, or All; the reader's choice survives a reload.
  // Switching rate type goes back to page 1.
  const paging = (resetKey: unknown[]) => ({ perPage: 100, options: [10, 20, 50, 100, 'all'] as (number | 'all')[], resetKey: JSON.stringify(resetKey) })
  const midCols = useMemo(() => midColumns(), [])
  const midTable = useCoaTable<MidRow>({
    columns: midCols, rows: midRows, query: debouncedQ, getRowId: r => r.id, rememberAs: 'fx.rates:mid',
    initialColumnSizing: 'fit',
    pagination: paging([tab, regions]),
  })
  // The status chip's picks go through the lifecycle flow; a ref keeps the columns stable.
  const lifecycleRef = useRef(lifecycle)
  lifecycleRef.current = lifecycle
  const corpCols = useMemo(() => corpColumns((next, row) => { if (row.record) lifecycleRef.current.request(next, row.record) }), [])
  const corpTable = useCoaTable<CorpRow>({
    columns: corpCols, rows: corpPillRows, query: debouncedQ, getRowId: r => r.id, rememberAs: 'fx.rates:corp',
    initialColumnSizing: 'fit',
    pagination: paging([tab, regions, pill]),
  })

  const isMid = tab === 'mid'
  const rateTypeTabs = (
    <SegmentedTabs<Tab>
      tabs={[
        { key: 'mid', label: 'Mid-Market Rates', count: midAll.length },
        { key: 'corp', label: 'Corporate Rates', count: corpAll.length },
      ]}
      activeKey={tab}
      onChange={setTab}
      ariaLabel="Rate types"
    />
  )
  const corpShown = corpTable.rows

  /* ── Export: the open tab, as filtered, archived rows left out ── */
  const exportCurrent = (fmt: ExportFormat, only?: CorpRow[]) => {
    if (isMid && !only) {
      const rows = midTable.rows
      void exportRows({
        fileBase: 'mid_market_rates', sheetName: 'Mid-Market Rates', title: 'Mid-Market Exchange Rates', noun: 'rates', one: 'rate',
        headers: ['Base Currency', 'Source Currency', 'Currency Name', 'Mid-Market Exchange Rate', 'Inverse Rate', 'Change (24h)', 'Effective Date'],
        rows: rows.map(r => [BASE, r.code, r.name, fmtRate(r.rate), fmtInverse(r.rate), fmtSignedPct(r.change24h), r.effectiveDate]),
        widths: [14, 16, 28, 24, 14, 12, 14],
      }, fmt)
      return
    }
    const rows = (only ?? corpShown).filter(r => r.status === 'Active')
    void exportRows({
      fileBase: 'corporate_rates', sheetName: 'Corporate Rates', title: 'Corporate Exchange Rates', noun: 'rates', one: 'rate',
      headers: ['Base Currency', 'Source Currency', 'Corporate Exchange Rate', 'Mid-Market Exchange Rate', 'Variance', 'Effective Date', 'Upcoming Rate', 'Upcoming From', 'Created By'],
      rows: rows.map(r => [BASE, r.code, r.rate == null ? '' : fmtRate(r.rate), r.mid == null ? '' : fmtRate(r.mid), r.variance == null ? '' : `${r.variance}%`, r.effectiveDate, r.upcoming ? fmtRate(r.upcoming.rate) : '', r.upcoming?.effectiveDate ?? '', r.createdBy]),
      widths: [14, 16, 22, 24, 10, 14, 14, 14, 18],
    }, fmt)
  }

  /* ── Selection (Corporate) ── */
  const selectedRecords = corpAll.filter(r => corpTable.selected.has(r.id) && r.record).map(r => r.record!)
  // What Archive would actually take: active rates no active transaction is priced at.
  const selectedArchivable = selectedRecords.filter(r => lifecycle.canArchive(r))

  const narrowing = regions.length > 0 || Object.keys(isMid ? midTable.colFilters : corpTable.colFilters).length > 0 || (!isMid && pill === 'archived')
  const clearNarrowing = () => { setRegions([]); setPill('all'); (isMid ? midTable : corpTable).setColFilters({}) }

  // What ticking a region alone would list on the open tab (the corporate one as its status pill leaves it).
  const regionCount = (region: string) => (isMid
    ? midAll.filter(r => r.region === region).length
    : corpAll.filter(r => r.region === region && (pill === 'archived' ? r.status === 'Archived' : r.status === 'Active')).length)
  // Region is the one filter here, so it is a pill on the row, as CoA's Dimensions is, and there is no Filters button.
  const regionPill = <RegionPill selected={regions} onChange={setRegions} countFor={regionCount} noun="rates" />

  const toolbarCommon = {
    search: { value: query, onChange: setQuery, placeholder: 'Search rates' },
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
          primaryAction={<Button icon={<Plus size={ic14} />} onClick={() => form.openAdd()}>Add Corporate Rate</Button>}
        />

        {/* Steps in under the header when the page's tab changes. */}
        <div className={cn('flex-1 min-h-0 flex flex-col', swapIn)}>
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
                    density={midTable.densityMenuProps}
                    columns={{ open: midTable.columnsOpen, onToggle: () => midTable.setColumnsOpen(o => !o), count: midTable.visibleCount }}
                  />
                }
                pills={<PillRow>{regionPill}</PillRow>}
                notes={<>
                  <ExplainerBanner id="mid" title="Mid-Market Rates">
                    The midpoint of global buy and sell rates. Synced from <SourceLink className="underline underline-offset-2" /> every 24 hours.
                  </ExplainerBanner>
                  <QuotedStrip kind="mid" />
                </>}
              >
                <CoaDataTable
                  table={midTable}
                  onRowClick={r => navigate(pairPath(r.code, 'mid'))}
                  renderExpanded={r => (
                    <div className={`px-4 py-3 ${EXPANDED_FILL}`}>
                      <PairInverter code={r.code} name={r.name} rate={r.rate} inverted={inverted.has(`mid:${r.id}`)} onToggle={() => toggleInvert(`mid:${r.id}`)} note={`Mid-market rate as of ${LAST_SYNC_DATE}`} />
                    </div>
                  )}
                  rowMenu={(r, close) => (
                    <>
                      <MenuItem icon={<Eye size={14} />} onClick={() => { close(); navigate(pairPath(r.code, 'mid')) }}>View Details</MenuItem>
                      {r.corporate
                        ? <MenuItem icon={<Pencil size={14} />} onClick={() => { close(); form.openUpdate(r.corporate!.id) }}>Update Corporate Rate</MenuItem>
                        : <MenuItem icon={<Plus size={14} />} onClick={() => { close(); form.openAdd(r.code) }}>Set Corporate Rate</MenuItem>}
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
                      { key: 'archive', label: 'Archive', icon: Archive, tone: 'destructive', count: selectedArchivable.length, onClick: () => lifecycle.archiveBulk(selectedRecords, corpTable.clearSelection) },
                      { key: 'export', label: 'Export Selected', icon: Download, tone: 'neutral', onClick: () => exportCurrent('csv', corpAll.filter(r => corpTable.selected.has(r.id))) },
                    ]}
                  />
                ) : null}
                pills={
                  <PillRow leading={regionPill}>
                    <QuickFilterPill label="Show All" active={pill === 'all'} onClick={() => setPill('all')} />
                    <QuickFilterPill label="Active" count={pillCounts.active} active={pill === 'active'} onClick={() => setPill('active')} />
                    <QuickFilterPill label="Archived" tone="danger" count={pillCounts.archived} active={pill === 'archived'} onClick={() => setPill(p => (p === 'archived' ? 'all' : 'archived'))} />
                  </PillRow>
                }
                notes={<>
                  <ExplainerBanner id="corp" title="Corporate Rates">{EXPLANATORY_BLOCKS.corporate}</ExplainerBanner>
                  <QuotedStrip kind="corp" />
                </>}
              >
                <CoaDataTable
                  table={corpTable}
                  selectable
                  onRowClick={r => navigate(pairPath(r.code, 'std'))}
                  renderExpanded={r => (
                    <div className={`px-4 py-3 ${EXPANDED_FILL}`}>
                      {r.rate != null ? (
                        <PairInverter code={r.code} name={r.name} rate={r.rate} inverted={inverted.has(`corp:${r.id}`)} onToggle={() => toggleInvert(`corp:${r.id}`)}
                          note={r.upcoming ? `Corporate rate, effective ${fmtDate(r.effectiveDate)} · Upcoming ${fmtRate(r.upcoming.rate)} from ${fmtDate(r.upcoming.effectiveDate)}` : `Corporate rate, effective ${fmtDate(r.effectiveDate)}`} />
                      ) : r.upcoming && (
                        <PairInverter code={r.code} name={r.name} rate={r.upcoming.rate} inverted={inverted.has(`corp:${r.id}`)} onToggle={() => toggleInvert(`corp:${r.id}`)}
                          note={`Upcoming corporate rate, from ${fmtDate(r.upcoming.effectiveDate)}`} />
                      )}
                    </div>
                  )}
                  rowMenu={(r, close) => (
                    <>
                      <MenuItem icon={<Eye size={14} />} onClick={() => { close(); navigate(pairPath(r.code, 'std')) }}>View Details</MenuItem>
                      {r.status === 'Active' && <MenuItem icon={<Pencil size={14} />} onClick={() => { close(); form.openUpdate(r.id) }}>Update Rate</MenuItem>}
                      {r.status === 'Active'
                        ? <MenuItem icon={<Archive size={14} />} danger onClick={() => { close(); lifecycle.archive(r.record!) }}>Archive Rate</MenuItem>
                        : <MenuItem icon={<ArchiveRestore size={14} />} onClick={() => { close(); lifecycle.restore(r.record!) }}>Restore Rate</MenuItem>}
                    </>
                  )}
                  emptyState={emptyState}
                />
              </CoaTableCard>
            )}
          </div>
        </div>
      </div>

      {lifecycle.modal}
      {form.modal}
    </>
  )
}
