// The Currency Library tab of Currency & Exchange Rates (CurrencyExchangePage),
// on the CoA kit (src/app/coa): the shared header and the CoA table card - toolbar,
// quick-filter pills / bulk bar, header menus, docked Columns panel, density.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, CircleCheck, CircleSlash, Download, Eye, FileSpreadsheet, FileText, Power } from 'lucide-react'
import { Badge, Button, Marked, Menu, MenuItem, useResponsiveIconSize } from '../coa/components/ui'
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
import type { Currency } from '../data/currencies'
import {
  CURRENCY_STATUS_OPTIONS, countInUse, countriesOf, countryFlagOf, flagOf, placeFlagOf, regionOf, statusOf,
} from './currency/model'
import { useCurrencyLifecycle } from './currency/useCurrencyLifecycle'
import { CurrencyFiltersModal, EMPTY_CURRENCY_FILTERS, applyCurrencyFilters, countCurrencyFilters, type CurrencyPanelFilters } from './currency/CurrencyFilters'
import { exportCurrencies, type ExportFormat } from './currency/exportCurrencies'
import { ExportSelectedModal } from './currency/ExportSelectedModal'
import { CurrencyExchangeHeader } from './CurrencyExchangeHeader'


type Pill = 'all' | 'active' | 'base' | 'inactive'

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
  const [filters, setFilters] = useRememberedState<CurrencyPanelFilters>('currencies:filters', EMPTY_CURRENCY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  // Pill counts: the rows a click would show, over the panel-filtered set.
  const panelRows = useMemo(() => applyCurrencyFilters(currencies, filters), [currencies, filters])
  const pillCounts = {
    active: panelRows.filter(c => c.status === 'active').length,
    inactive: panelRows.filter(c => c.status === 'inactive').length,
    base: panelRows.filter(c => c.isBaseCurrency).length,
  }
  const pillRows = useMemo(() => panelRows.filter(c =>
    pill === 'active' ? c.status === 'active' : pill === 'inactive' ? c.status === 'inactive' : pill === 'base' ? c.isBaseCurrency : true), [panelRows, pill])

  const columns = useMemo<CoaColumn<Currency>[]>(() => [
    {
      key: 'currency', label: 'Currency', locked: true, width: 300,
      info: 'The ISO 4217 code and name.',
      render: (c, ctx) => (
        <CurrencyCell code={c.code} country={flagOf(c.code)} name={c.name} q={ctx.q} showName strong={ctx.band} onOpen={ctx.openRow}
          trailing={c.isBaseCurrency ? <Badge tone="base" className="shrink-0">Base</Badge> : undefined} />
      ),
      sortValue: c => c.code, searchText: c => [c.code, c.name], filter: 'text', filterValue: c => `${c.code} ${c.name}`,
    },
    {
      key: 'symbol', label: 'Symbol', headerClassName: 'min-w-[90px]',
      info: 'The sign amounts in this currency are written with.',
      render: (c, ctx) => <span className="text-sm text-slate-700 whitespace-nowrap"><Marked text={c.symbol} q={ctx.q} /></span>,
      searchText: c => c.symbol, filter: 'multiselect', filterValue: c => c.symbol,
    },
    {
      key: 'decimals', label: 'Decimals', align: 'right', headerClassName: 'min-w-[100px]', cellClassName: 'pl-4 pr-4',
      info: 'Digits after the decimal point that amounts in this currency carry.',
      render: c => <span className="text-sm text-slate-700 tabular-nums">{c.decimalPlaces}</span>,
      sortValue: c => c.decimalPlaces, searchText: c => String(c.decimalPlaces), filter: 'multiselect', filterValue: c => String(c.decimalPlaces),
    },
    {
      key: 'country', label: 'Country / region', headerClassName: 'min-w-[220px]',
      info: 'Where the currency is used: its primary country first, then every other country or territory.',
      render: (c, ctx) => (
        <OverflowPills
          plain
          q={ctx.q}
          category="Countries / Regions"
          values={countriesOf(c).map((name, i) => ({
            name,
            subtitle: i === 0 ? regionOf(c) : undefined,
            icon: <FlagImage code={i === 0 ? placeFlagOf(name, c.code) : countryFlagOf(name)} className="text-base" />,
          }))}
        />
      ),
      sortValue: c => c.country, searchText: c => countriesOf(c), filter: 'multiselect', filterValue: c => c.country,
    },
    {
      key: 'linked', label: 'Linked transactions', align: 'right', headerClassName: 'min-w-[170px]', cellClassName: 'pl-4 pr-4',
      info: 'Open documents in this currency, and every document it has ever been on.',
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
      info: 'Active currencies are offered on new transactions. Inactive ones keep their rates and history.',
      render: (c, ctx) => <StatusMenu status={statusOf(c)} options={CURRENCY_STATUS_OPTIONS} onPick={next => lifecycleRef.current.request(next, c)} q={ctx.q} />,
      sortValue: c => statusOf(c), searchText: c => statusOf(c), filter: 'multiselect', filterValue: c => statusOf(c),
    },
    {
      key: 'numeric', label: 'Numeric code', defaultHidden: true, headerClassName: 'min-w-[120px]',
      info: 'The ISO 4217 three-digit code.',
      render: (c, ctx) => <span className="text-sm text-slate-700 tabular-nums"><Marked text={c.numericCode} q={ctx.q} /></span>,
      sortValue: c => c.numericCode, searchText: c => c.numericCode, filter: 'text',
    },
  ], [navigate])

  const table = useCoaTable<Currency>({
    columns, rows: pillRows, query: debouncedQ, getRowId: c => c.code, rememberAs: 'currencies:table',
    pinTop: c => c.isBaseCurrency, defaultSort: { key: 'linked', dir: 'desc' }, initialColumnSizing: 'fit',
    // 50 a page by default; the base currency is page 1's first row.
    pagination: { perPage: 50, options: [10, 25, 50, 100], resetKey: JSON.stringify([pill, filters]) },
  })

  const selected = table.selected
  const selectedRows = currencies.filter(c => selected.has(c.code))
  const toActivate = selectedRows.filter(c => c.status === 'inactive')
  const toDeactivate = selectedRows.filter(c => c.status === 'active')
  const panelCount = countCurrencyFilters(filters)
  const otherNarrowing = pill !== 'all' || panelCount > 0 || Object.keys(table.colFilters).length > 0
  const clearNarrowing = () => { setPill('all'); setFilters(EMPTY_CURRENCY_FILTERS); table.setColFilters({}) }
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
                  actions={[
                    { key: 'activate', label: 'Activate', icon: CircleCheck, tone: 'success', count: toActivate.length, onClick: () => lifecycle.requestBulk('Active', selectedRows, table.clearSelection) },
                    { key: 'deactivate', label: 'Deactivate', icon: CircleSlash, tone: 'warning', count: toDeactivate.length, onClick: () => lifecycle.requestBulk('Inactive', selectedRows, table.clearSelection) },
                    { key: 'export', label: 'Export selected', icon: Download, tone: 'neutral', onClick: () => setExportOpen(true) },
                  ]}
                />
              ) : null}
              pills={
                <PillRow>
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
                isBand={c => c.isBaseCurrency}
                onRowClick={c => navigate(`/accounting/currencies/${c.code}`)}
                rowMenu={(c, close) => (
                  <>
                    <MenuItem icon={<Eye size={14} />} onClick={() => { close(); navigate(`/accounting/currencies/${c.code}`) }}>View details</MenuItem>
                    {c.status === 'active'
                      ? <MenuItem icon={<CircleSlash size={14} />} warning onClick={() => { close(); lifecycle.request('Inactive', c) }}>Deactivate currency</MenuItem>
                      : <MenuItem icon={<Power size={14} />} onClick={() => { close(); lifecycle.request('Active', c) }}>Activate currency</MenuItem>}
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
