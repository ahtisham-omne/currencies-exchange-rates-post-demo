// The Currency Library tab of Currency & Exchange Rates (CurrencyExchangePage),
// on the CoA kit (src/app/coa): the shared header and the CoA table card - toolbar,
// quick-filter pills / bulk bar, header menus, docked Columns panel, density.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, CircleCheck, CircleSlash, Download, Eye, FileSpreadsheet, FileText, Info, Power } from 'lucide-react'
import { Badge, Button, Marked, Menu, MenuItem, Tooltip, useResponsiveIconSize } from '../coa/components/ui'
import { TableToolbar } from '../coa/components/TableToolbar'
import { CoaTableCard, PillRow, TableEmptyState } from '../coa/components/TableCard'
import { CoaDataTable, useCoaTable, type CoaColumn } from '../coa/components/CoaDataTable'
import { QuickFilterPill } from '../coa/components/Filters'
import { BulkActionBar } from '../coa/components/BulkActionBar'
import { CurrencyCell, OverflowPills } from '../coa/components/cells'
import { StatusMenu } from '../coa/components/StatusChip'
import { FlagImage } from '../coa/components/FlagImage'
import { useRememberedState } from '../coa/lib/rememberedState'
import { cn, fmtNumber } from '../coa/lib/utils'
import { useCurrencies } from '../context/CurrencyContext'
import { hasOpenDocuments, type Currency } from '../data/currencies'
import {
  BASE_CURRENCY_LOCKED, countInUse, countriesOf, countryFlagOf, flagOf, placeFlagOf, regionOf, statusOf, statusOptionsFor, symbolSearchText,
} from './currency/model'
import { useCurrencyLifecycle } from './currency/useCurrencyLifecycle'
import { CurrencyFiltersModal, EMPTY_CURRENCY_FILTERS, applyCurrencyFilters, countCurrencyFilters, type CurrencyPanelFilters } from './currency/CurrencyFilters'
import { PlacePill, placesOf, usedInAny } from './currency/PlacePill'
import { exportCurrencies, type ExportFormat } from './currency/exportCurrencies'
import { ExportSelectedModal } from './currency/ExportSelectedModal'
import { CurrencyExchangeHeader } from './CurrencyExchangeHeader'


type Pill = 'all' | 'active' | 'base' | 'inactive'

// Stable, so the table's row order is worked out only when the rows change.
const isBase = (c: Currency) => c.isBaseCurrency
const isInactive = (c: Currency) => c.status === 'inactive'

export function CurrencyLibraryPanel({ swapIn }: { swapIn?: string } = {}) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const ic14 = useResponsiveIconSize(14)
  const { currencies } = useCurrencies()
  const lifecycle = useCurrencyLifecycle()
  // The columns are memoised; they reach the lifecycle through a ref so they stay stable.
  const lifecycleRef = useRef(lifecycle)
  lifecycleRef.current = lifecycle

  // Search: remembered, debounced 300ms, prefilled from the TopBar's ?q=.
  const [query, setQuery] = useRememberedState('currencies:query', params.get('q') ?? '')
  const [debouncedQ, setDebouncedQ] = useState(query)
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(query), 300); return () => clearTimeout(t) }, [query])
  useEffect(() => { const q = params.get('q'); if (q != null) setQuery(q) }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const [pill, setPill] = useRememberedState<Pill>('currencies:pill', 'all')
  const [filters, setFilters] = useRememberedState<CurrencyPanelFilters>('currencies:panel', EMPTY_CURRENCY_FILTERS)
  // The Country / Region pill on the quick-filter row: any place the column lists.
  const [regions, setRegions] = useRememberedState<string[]>('currencies:places', [])
  const places = useMemo(() => placesOf(currencies), [currencies])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  // Pill counts: the rows a click would show, over the panel- and region-filtered set.
  const outsideRegion = useMemo(() => applyCurrencyFilters(currencies, filters), [currencies, filters])
  const panelRows = useMemo(() => (regions.length ? outsideRegion.filter(c => usedInAny(c, regions)) : outsideRegion), [outsideRegion, regions])
  const pillCounts = {
    active: panelRows.filter(c => c.status === 'active').length,
    inactive: panelRows.filter(c => c.status === 'inactive').length,
    base: panelRows.filter(c => c.isBaseCurrency).length,
  }
  const pillRows = useMemo(() => panelRows.filter(c =>
    pill === 'active' ? c.status === 'active' : pill === 'inactive' ? c.status === 'inactive' : pill === 'base' ? c.isBaseCurrency : true), [panelRows, pill])
  // A place's count is what ticking it alone would list: the panel's filters and the status pill, used there.
  const regionCount = (place: string) => outsideRegion.filter(c => countriesOf(c).includes(place) &&
    (pill === 'active' ? c.status === 'active' : pill === 'inactive' ? c.status === 'inactive' : pill === 'base' ? c.isBaseCurrency : true)).length

  const columns = useMemo<CoaColumn<Currency>[]>(() => [
    {
      key: 'currency', label: 'Currency', locked: true, width: 300,
      info: 'This currency’s three-letter ISO (International Organization for Standardization) code and name.',
      render: (c, ctx) => (
        <CurrencyCell code={c.code} country={flagOf(c.code)} name={c.name} q={ctx.q} showName strong={ctx.band} onOpen={ctx.openRow}
          trailing={c.isBaseCurrency ? <Badge tone="base" className="shrink-0">Base</Badge> : undefined} />
      ),
      sortValue: c => c.code, searchText: c => [c.code, c.name], filter: 'text', filterValue: c => `${c.code} ${c.name}`,
    },
    {
      key: 'symbol', label: 'Symbol', headerClassName: 'min-w-[90px]',
      info: 'The sign shown with this currency’s amounts.',
      render: (c, ctx) => <span className="text-sm text-slate-700 whitespace-nowrap"><Marked text={c.symbol} q={ctx.q} /></span>,
      // "Rs" finds the rupee sign (₨), as people type it.
      searchText: c => symbolSearchText(c.symbol), filter: 'multiselect', filterValue: c => c.symbol,
    },
    {
      key: 'decimals', label: 'Decimals', align: 'right', headerClassName: 'min-w-[100px]', cellClassName: 'pl-4 pr-4',
      info: 'The number of decimal places in this currency’s amounts.',
      render: c => <span className="text-sm text-slate-700 tabular-nums">{c.decimalPlaces}</span>,
      sortValue: c => c.decimalPlaces, searchText: c => String(c.decimalPlaces), filter: 'multiselect', filterValue: c => String(c.decimalPlaces),
    },
    {
      key: 'country', label: 'Country / Region', headerClassName: 'min-w-[220px]',
      info: 'Where this currency is used.',
      render: (c, ctx) => (
        <OverflowPills
          plain
          q={ctx.q}
          category="Countries / Regions"
          values={countriesOf(c).map((name, i) => ({
            name,
            // The primary country carries its region, unless the two read the same (EUR: Eurozone).
            subtitle: i === 0 && regionOf(c) !== name ? regionOf(c) : undefined,
            icon: <FlagImage code={i === 0 ? placeFlagOf(name, c.code) : countryFlagOf(name)} className="text-base" />,
          }))}
        />
      ),
      sortValue: c => c.country, searchText: c => countriesOf(c), filter: 'multiselect', filterValue: c => c.country,
    },
    {
      key: 'linked', label: 'In Use', align: 'right', headerClassName: 'min-w-[170px]', cellClassName: 'pl-4 pr-4',
      info: 'Active and total transactions in this currency.',
      render: c => {
        const n = countInUse(c)
        return (
          <span className="text-sm tabular-nums whitespace-nowrap">
            {n > 0
              ? <button type="button" onClick={e => { e.stopPropagation(); navigate(`/accounting/currencies/${c.code}?tab=linked`) }} className="text-primary hover:text-[#0862D0] hover:underline underline-offset-2" style={{ fontWeight: 600 }}>{n} active</button>
              : <span className="text-fg-subtle">0 active</span>}
            <span className="text-fg-subtle"> · {fmtNumber(c.usage.totalLifetimeDocuments)} total</span>
          </span>
        )
      },
      sortValue: c => countInUse(c), searchText: c => [`${countInUse(c)} active`, `${c.usage.totalLifetimeDocuments} total`], filter: 'range', filterValue: c => countInUse(c),
    },
    {
      key: 'status', label: 'Status', headerClassName: 'min-w-[120px]',
      info: 'Whether this currency can be used on new transactions. Inactive currencies keep their history.',
      render: (c, ctx) => <StatusMenu status={statusOf(c)} options={statusOptionsFor(c)} onPick={next => lifecycleRef.current.request(next, c)} q={ctx.q} />,
      sortValue: c => statusOf(c), searchText: c => statusOf(c), filter: 'multiselect', filterValue: c => statusOf(c),
    },
    {
      key: 'numeric', label: 'ISO Numeric Code', defaultHidden: true, headerClassName: 'min-w-[120px]',
      info: 'This currency’s three-digit ISO (International Organization for Standardization) code.',
      render: (c, ctx) => <span className="text-sm text-slate-700 tabular-nums"><Marked text={c.numericCode} q={ctx.q} /></span>,
      sortValue: c => c.numericCode, searchText: c => c.numericCode, filter: 'text',
    },
  ], [navigate])

  const table = useCoaTable<Currency>({
    columns, rows: pillRows, query: debouncedQ, getRowId: c => c.code, rememberAs: 'currencies:table',
    // The base currency first, then active currencies, then inactive ones.
    pinTop: isBase, sinkBottom: isInactive, defaultSort: { key: 'linked', dir: 'desc' }, initialColumnSizing: 'fit',
    // 100 a page by default, or All; the reader's choice survives a reload. The
    // base currency is page 1's first row.
    pagination: { perPage: 100, options: [10, 25, 50, 100, 'all'], resetKey: JSON.stringify([pill, filters, regions]) },
  })

  const selected = table.selected
  const selectedRows = currencies.filter(c => selected.has(c.code))
  const toActivate = selectedRows.filter(c => c.status === 'inactive')
  const toDeactivate = selectedRows.filter(c => c.status === 'active' && !c.isBaseCurrency)
  // The base currency can be picked, so it exports with the rest; the bar says up
  // front that Activate and Deactivate leave it as it is.
  const selectedBase = selectedRows.find(c => c.isBaseCurrency)
  // What Deactivate would actually take. When every candidate is held by open
  // transactions the button stays, without a count, so the dialog can say why.
  const deactivatable = toDeactivate.filter(c => !hasOpenDocuments(c)).length
  const deactivateCount = deactivatable || (toDeactivate.length ? undefined : 0)
  const panelCount = countCurrencyFilters(filters)
  const otherNarrowing = pill !== 'all' || panelCount > 0 || regions.length > 0 || Object.keys(table.colFilters).length > 0
  const clearNarrowing = () => { setPill('all'); setFilters(EMPTY_CURRENCY_FILTERS); setRegions([]); table.setColFilters({}) }
  const exportFiltered = (fmt: ExportFormat) => exportCurrencies(table.rows, fmt, 'filtered')

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 pb-6">
        <CurrencyExchangeHeader
          tab="currencies"
          secondaryActions={
            <Menu trigger={<Button variant="secondary" iconRight={<ChevronDown size={ic14} className="text-fg-subtle/60" />}>Actions</Button>}>
              {close => (
                <>
                  <MenuItem icon={<FileText size={ic14} />} onClick={() => { close(); exportFiltered('csv') }}>Export CSV</MenuItem>
                  <MenuItem icon={<FileSpreadsheet size={ic14} />} onClick={() => { close(); exportFiltered('xlsx') }}>Export Excel</MenuItem>
                  <MenuItem icon={<Download size={ic14} />} onClick={() => { close(); exportFiltered('pdf') }}>Export PDF</MenuItem>
                </>
              )}
            </Menu>
          }
        />

        {/* Steps in under the header when the page's tab changes. */}
        <div className={cn('flex-1 min-h-0 flex flex-col', swapIn)}>
          <div className="flex-1 min-h-0 flex flex-col px-6 lg:px-8 mt-4">
            <CoaTableCard
              table={table}
              toolbar={
                <TableToolbar
                  search={{ value: query, onChange: setQuery, placeholder: 'Search currencies' }}
                  filters={{ count: panelCount, onOpen: () => setFiltersOpen(true), onClear: () => setFilters(EMPTY_CURRENCY_FILTERS) }}
                  count={{ shown: table.rows.length, total: currencies.length, noun: 'currencies' }}
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
                  trailing={selectedBase && (
                    <Tooltip content={BASE_CURRENCY_LOCKED} side="bottom" align="right">
                      <span className="inline-flex items-center gap-1 text-xs text-fg-muted cursor-default whitespace-nowrap">
                        <Info size={12} className="text-fg-subtle" />{selectedBase.code} stays active
                      </span>
                    </Tooltip>
                  )}
                  actions={[
                    { key: 'activate', label: 'Activate', icon: CircleCheck, tone: 'success', count: toActivate.length, onClick: () => lifecycle.requestBulk('Active', selectedRows, table.clearSelection) },
                    { key: 'deactivate', label: 'Deactivate', icon: CircleSlash, tone: 'warning', count: deactivateCount, onClick: () => lifecycle.requestBulk('Inactive', selectedRows, table.clearSelection) },
                    { key: 'export', label: 'Export Selected', icon: Download, tone: 'neutral', onClick: () => setExportOpen(true) },
                  ]}
                />
              ) : null}
              pills={
                <PillRow leading={<PlacePill places={places} selected={regions} onChange={setRegions} countFor={regionCount} />}>
                  <QuickFilterPill label="Show All" active={pill === 'all'} onClick={() => setPill('all')} />
                  <QuickFilterPill label="Active" count={pillCounts.active} active={pill === 'active'} onClick={() => setPill('active')} />
                  <QuickFilterPill label="Base Currency" count={pillCounts.base} active={pill === 'base'} onClick={() => setPill('base')} />
                  <QuickFilterPill label="Inactive" tone="warning" count={pillCounts.inactive} active={pill === 'inactive'} onClick={() => setPill(p => (p === 'inactive' ? 'all' : 'inactive'))} />
                </PillRow>
              }
            >
              <CoaDataTable
                table={table}
                selectable
                isBand={c => c.isBaseCurrency}
                onRowClick={c => navigate(`/accounting/currencies/${c.code}`)}
                rowMenu={(c, close) => (
                  <>
                    <MenuItem icon={<Eye size={14} />} onClick={() => { close(); navigate(`/accounting/currencies/${c.code}`) }}>View Details</MenuItem>
                    {c.status === 'active'
                      ? <MenuItem icon={<CircleSlash size={14} />} warning onClick={() => { close(); lifecycle.request('Inactive', c) }} disabled={c.isBaseCurrency} disabledReason={BASE_CURRENCY_LOCKED}>Deactivate Currency</MenuItem>
                      : <MenuItem icon={<Power size={14} />} onClick={() => { close(); lifecycle.request('Active', c) }}>Activate Currency</MenuItem>}
                  </>
                )}
                emptyState={<TableEmptyState noun="currencies" query={debouncedQ} filtersActive={otherNarrowing} onClearSearch={() => setQuery('')} onClearFilters={clearNarrowing} where="the library" />}
              />
            </CoaTableCard>
          </div>
        </div>
      </div>

      <CurrencyFiltersModal open={filtersOpen} onClose={() => setFiltersOpen(false)} rows={currencies} filters={filters} setFilters={setFilters} />
      <ExportSelectedModal open={exportOpen} onClose={() => setExportOpen(false)} rows={selectedRows} />
      {lifecycle.modal}
    </>
  )
}
