// Ported from chart-of-accounts-v2.1/src/components/TableToolbar.tsx, aligned to the toolbar row ChartOfAccounts.tsx 793-918 actually draws; adapted: data-col-hide-edge on the row, responsive 16/14px icons, FiltersButton, the 18px-icon Insights button, and the Density + Columns pair in CoA's inline TOOL_BTN / COUNT_BADGE styles (6px apart); the dropdown Columns menu is dropped (CoA docks the Columns panel).
import type { ReactNode } from 'react'
import { Search, X, Columns3 } from 'lucide-react'
import { useResponsiveIconSize } from './ui'
import { DensityMenu } from './DensityMenu'
import { COUNT_BADGE, TOOL_BTN, TOOL_BTN_ACTIVE, type Density, type LookSection } from './tableLook'
import { FiltersButton } from './Filters'
import { InsightsToolbarButton } from './Insights'
import { fmtNumber } from '../lib/utils'

export interface TableToolbarProps {
  /** The table search (left). Controlled; debounce it (300ms) before it reaches the table. */
  search: { value: string; onChange: (v: string) => void; placeholder?: string }
  /** Filters button + its Clear all link. `count` = filters applied. */
  filters?: { count: number; onOpen: () => void; onClear: () => void }
  /** Extra controls after Filters (left group). */
  leftExtra?: ReactNode
  /** "N of M {noun}": rows after every narrowing, of the whole set (incl. archived). */
  count: { shown: number; total: number; noun: string }
  /** A quiet line before the count (e.g. a sync stamp), muted 12px. */
  meta?: ReactNode
  /** The Insights button; omit on a page without a KPI shelf. */
  insights?: { open: boolean; onClick: () => void; count: number }
  /** Controls between the count divider and the Density + Columns pair. */
  rightExtra?: ReactNode
  /** Density menu: pass `table.densityMenuProps` from useCoaTable. */
  density?: { value: Density; onChange: (d: Density) => void; sections?: LookSection[] }
  /** The Columns button toggling the docked panel: `open`, `onToggle`, `count` (visible columns). */
  columns?: { open: boolean; onToggle: () => void; count: number }
}

/**
 * The CoA table toolbar, row 1 (58px): search + Filters on the left; count ·
 * divider · Insights · Density + Columns on the right. Its top edge is where a
 * dragged column header turns into a hide (`data-col-hide-edge`).
 */
export function TableToolbar({ search, filters, leftExtra, count, meta, insights, rightExtra, density, columns }: TableToolbarProps) {
  const ic16 = useResponsiveIconSize(16)
  const ic14 = useResponsiveIconSize(14)
  return (
    <div data-col-hide-edge className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3.5 pb-2">
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
        <div className="relative flex-1 max-w-xs">
          <Search size={ic16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
          <input
            value={search.value}
            onChange={e => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? 'Search'}
            className="h-9 w-full pl-9 pr-8 text-sm bg-white rounded-lg border border-border shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
          {search.value && (
            <button onClick={() => search.onChange('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-bg-muted text-fg-subtle hover:text-fg">
              <X size={14} />
            </button>
          )}
        </div>
        {filters && <FiltersButton count={filters.count} onOpen={filters.onOpen} onClear={filters.onClear} iconSize={ic14} />}
        {leftExtra}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {meta && <span className="text-[12px] text-fg-muted/70 whitespace-nowrap mr-1 hidden lg:inline">{meta}</span>}
        {/* Count colours match the Partners table: dark shown · faint "of" ·
            muted total · grey label. */}
        <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
          <span className="text-fg">{fmtNumber(count.shown)}</span>
          <span className="text-fg-muted/60"> of </span>
          <span className="text-fg-muted">{fmtNumber(count.total)}</span>
          <span className="text-fg-muted/70"> {count.noun}</span>
        </span>
        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
        {insights && <InsightsToolbarButton open={insights.open} onClick={insights.onClick} count={insights.count} />}
        {rightExtra}
        {(density || columns) && (
          /* The toolbar pair, in this order and 6px apart: how the rows are
             drawn, then which columns are drawn at all. */
          <div className="flex items-center" style={{ gap: 6 }}>
            {density && <DensityMenu value={density.value} onChange={density.onChange} sections={density.sections} />}
            {columns && (
              <button
                type="button"
                onClick={columns.onToggle}
                className="fr-tool-btn"
                data-active={columns.open}
                aria-expanded={columns.open}
                style={{ ...TOOL_BTN, ...(columns.open ? TOOL_BTN_ACTIVE : null) }}
              >
                <Columns3 style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span className="hidden md:inline">Columns</span>
                <span style={COUNT_BADGE}>{columns.count}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
