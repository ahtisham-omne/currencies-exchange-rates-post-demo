// Ported from chart-of-accounts-v2.1/src/pages/ChartOfAccounts.tsx 787-1068 (main panel, card, toolbar slot, pill row / bulk-bar slot, ColumnFiltersBar, SearchRevealNote, docked ColumnSelector) and 486-508 (the no-match EmptyState); adapted: one wrapper component fed by a useCoaTable() state.
import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { cn } from '../lib/utils'
import { useSwapIn } from '../lib/swapIn'
import { Button, Card, EmptyState } from './ui'
import { ColumnSelector } from './ColumnSelector'
import { ColumnFiltersBar, blankFilter } from './columnFilters'
import { SearchRevealNote } from './SearchReveal'
import type { CoaTable } from './CoaDataTable'

/**
 * The CoA table card: `.card` (white, 1px border, 12px radius, no shadow) that
 * fills the height the page leaves it, holding - top to bottom - an optional
 * period bar, the toolbar row, then a body row with the pill row (or the bulk
 * bar while rows are selected), the header-filter chips, the search-reveal note,
 * any notes, and the table; the docked Columns panel sits beside the body and
 * pushes the table aside rather than covering it.
 */
export function CoaTableCard<T>({ table, topBar, swapKey, periodBar, toolbar, pills, bulkBar, notes, children, className }: {
  table: CoaTable<T>
  /** A row atop the card, e.g. SegmentedTabs (Cash Management DataTable's `topBar` slot). */
  topBar?: ReactNode
  /** What the topBar switches between: when it changes, everything under the
   *  topBar remounts and steps in (useSwapIn) while the topBar stays put. */
  swapKey?: string
  /** A tinted strip flush atop the card (PeriodBar variant="card"). */
  periodBar?: ReactNode
  /** The <TableToolbar />. */
  toolbar: ReactNode
  /** The quick-filter <PillRow />. Omit for none (a divider still closes the toolbar). */
  pills?: ReactNode
  /** The <BulkActionBar /> while rows are selected; it takes the pill row's slot. */
  bulkBar?: ReactNode
  /** Banners and notes between the pills and the table (each closes on border-b). */
  notes?: ReactNode
  /** The <CoaDataTable />. */
  children: ReactNode
  className?: string
}) {
  const filterable = table.columns.filter(c => !!c.filter)
  const swapIn = useSwapIn(swapKey)
  const body = (
    <>
      {periodBar}
      {toolbar}
      {/* Body row: table area (shrinks) + docked Columns side panel. */}
      <div className="flex items-stretch flex-1 min-h-0">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {bulkBar ? (
            <div className="border-b border-border">{bulkBar}</div>
          ) : pills ?? <div className="border-b border-border" />}
          <ColumnFiltersBar
            filters={table.colFilters}
            onChange={table.setColFilters}
            availableColumns={filterable.filter(c => table.isShown(c.key)).map(c => c.key)}
            labelOf={k => table.columns.find(c => c.key === k)?.label ?? k}
            uniqueValuesOf={k => {
              const c = table.columns.find(x => x.key === k)
              if (!c || c.filter !== 'multiselect') return []
              if (Array.isArray(c.filterOptions)) return c.filterOptions
              if (typeof c.filterOptions === 'function') return c.filterOptions(table.rows)
              const read = c.filterValue ?? c.sortValue
              const seen = new Set<string>()
              for (const r of table.rows) { const v = read?.(r); if (v != null && v !== '') seen.add(String(v)) }
              return [...seen].sort()
            }}
            blankFilterOf={k => blankFilter(table.columns.find(c => c.key === k)?.filter ?? 'text')}
          />
          <SearchRevealNote labels={table.revealedLabels} />
          {notes}
          {children}
        </div>
        <ColumnSelector {...table.columnSelectorProps} />
      </div>
    </>
  )
  return (
    <Card className={cn('overflow-visible flex-1 min-h-0 flex flex-col', className)}>
      {topBar && <div className="px-4 pt-3 pb-3 border-b border-border shrink-0">{topBar}</div>}
      {swapKey === undefined ? body : (
        <div key={swapKey} className={cn('flex-1 min-h-0 flex flex-col', swapIn)}>{body}</div>
      )}
    </Card>
  )
}

/**
 * The quick-filter pill row (43px): an inner scrolling track of pills, with
 * panel-opening controls first and a divider before them when present.
 */
export function PillRow({ leading, children, trailing }: {
  /** Controls that open a panel (MultiSelectFilter, a range pill), before the divider. */
  leading?: ReactNode
  /** QuickFilterPill: Show All, then one per category with counts, the danger pill last. */
  children: ReactNode
  /** Pushed right, outside the scrolling track. */
  trailing?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-4 pb-3 border-b border-border">
      <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
        {leading}
        {leading && <div className="w-px h-5 bg-border shrink-0" />}
        {children}
      </div>
      {trailing}
    </div>
  )
}

/** The vertical divider the pill row and toolbar use (`w-px h-5 bg-border`). */
export function PillDivider() {
  return <div className="w-px h-5 bg-border shrink-0" />
}

/**
 * CoA's "nothing matches" state for a table: what is narrowing the list and the
 * one or two clicks out of it. For "nothing exists yet", use EmptyState directly
 * with a create action.
 */
export function TableEmptyState({ noun, query, filtersActive, onClearSearch, onClearFilters, where = 'the list' }: {
  /** Plural noun: "currencies", "rates". */
  noun: string
  query: string
  /** Anything besides the search narrowing the rows (pills, panel or header filters). */
  filtersActive: boolean
  onClearSearch: () => void
  onClearFilters: () => void
  /** What a match would be in: "the library". */
  where?: string
}) {
  const q = query.trim()
  return (
    <EmptyState
      icon={<Search size={20} />}
      title={q ? `No ${noun} match "${q}"` : `No ${noun} match these filters`}
      description={q
        ? `Nothing in ${where} carries that in any of its columns.${filtersActive ? ` Filters are narrowing ${where} as well, so one that does match can still be held back by one.` : ''}`
        : `Every row is held back by a filter. Widen one, or clear them to see ${where} again.`}
      action={
        <div className="flex items-center justify-center gap-2">
          {q && (
            <Button variant={filtersActive ? 'secondary' : 'primary'} onClick={onClearSearch}>
              {filtersActive ? 'Clear search, keep filters' : 'Clear search'}
            </Button>
          )}
          {filtersActive && (
            <Button variant="primary" onClick={q ? () => { onClearSearch(); onClearFilters() } : onClearFilters}>
              {q ? 'Clear both' : 'Clear filters'}
            </Button>
          )}
        </div>
      }
    />
  )
}
