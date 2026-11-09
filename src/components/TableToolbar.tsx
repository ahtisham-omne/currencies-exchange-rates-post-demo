import { ReactNode } from 'react'
import { Search, X, SlidersHorizontal, BarChart3, Columns3, Check } from 'lucide-react'
import { Menu } from './ui'
import { DensityMenu } from './DensityMenu'
import type { LookSection } from './tableLook'
import { ClearFiltersLink } from './Filters'
import { cn, fmtNumber } from '../lib/utils'

// Density shared across tables that adopt this toolbar.
export type ToolbarDensity = 'condensed' | 'comfortable'

// A column the Columns menu can show/hide. `required` columns render disabled
// (always visible) so a table can pin, e.g., a name column.
export interface ToolbarColumn {
  key: string
  label: string
  required?: boolean
}

export interface TableToolbarProps {
  // Search input (left). Value + onChange keep it controlled by the page.
  search: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
  }
  // "N of M {noun}" summary shown on the right, coloured like the CoA/Partners
  // toolbar (dark shown · faint "of" · muted total · grey noun).
  count: { shown: number; total: number; noun: string }
  // Filters button (left group). Provide `menu` for a dropdown panel, or
  // `onClick` for a button that opens a page-owned panel/modal. `activeCount`
  // drives the primary tint + count badge, matching CoA exactly. `onClear`
  // adds the Clear all link beside the button, shown only while filtered - pass
  // it whatever resets the state `activeCount` counts.
  filters?: {
    activeCount?: number
    onClick?: () => void
    onClear?: () => void
    menu?: (close: () => void) => ReactNode
  }
  // Insights button (right group). `count` shows a rounded-full accent badge.
  insights?: {
    count?: number
    onClick?: () => void
    menu?: (close: () => void) => ReactNode
  }
  // Density dropdown (right group). The shared menu, so the two spacings read
  // and are worded the same here as on the chart listing. `sections` hangs Tree
  // layout / Column widths under them where the table can honour one.
  density?: {
    value: ToolbarDensity
    onChange: (d: ToolbarDensity) => void
    sections?: LookSection[]
  }
  // Columns control (right group). Badge = # visible. Provide `onToggle` for the
  // built-in dropdown menu, OR `onOpen` (+ `open`) to make the button toggle a
  // page-owned side drawer (e.g. the docked ColumnSelector), matching CoA.
  columns?: {
    items: ToolbarColumn[]
    visible: Record<string, boolean>
    onToggle?: (key: string) => void
    onOpen?: () => void
    open?: boolean
  }
  // Optional extra controls rendered on the right, before the Density button.
  rightExtra?: ReactNode
}

// Shared button chrome for the toolbar's secondary buttons (Insights, Density,
// Columns) - h-9, rounded-lg, bordered, shadowed. Matches CoA precisely.
const btnBase = 'inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-fg shadow-xs hover:bg-bg-subtle transition-colors text-sm font-medium'

// A presentational, config-driven table toolbar that mirrors the Chart of
// Accounts / Partners toolbar: search + filters on the left; count · insights ·
// density · columns on the right. Kept generic so other tables can adopt it.
export function TableToolbar({ search, count, filters, insights, density, columns, rightExtra }: TableToolbarProps) {
  const filtersActive = filters?.activeCount ?? 0
  const visibleCount = columns ? columns.items.filter(c => columns.visible[c.key]).length : 0

  // Styled Filters button, shared by the menu / onClick variants.
  const filtersBtn = (
    <button
      onClick={filters?.menu ? undefined : filters?.onClick}
      className={cn('inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-xs hover:bg-bg-subtle transition-colors shrink-0 text-sm font-medium',
        filtersActive > 0 ? 'text-primary border-primary/30' : 'text-fg border-border')}
    >
      <SlidersHorizontal size={14} className={filtersActive > 0 ? 'text-primary' : 'text-fg-subtle'} />
      Filters
      {filtersActive > 0 && <span className="ml-0.5 min-w-[18px] h-5 rounded-full text-2xs flex items-center justify-center px-1.5 bg-primary text-white font-semibold">{filtersActive}</span>}
    </button>
  )

  // Styled Insights button, shared by the menu / onClick variants.
  const insightsBtn = insights && (
    <button onClick={insights.menu ? undefined : insights.onClick} className={btnBase}>
      <BarChart3 size={16} className="text-fg-subtle" />
      <span className="hidden md:inline">Insights</span>
      {typeof insights.count === 'number' && (
        <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-2xs font-semibold bg-accent text-primary">{insights.count}</span>
      )}
    </button>
  )

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3.5 pb-2">
      {/* Left group: search + filters */}
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
          <input
            value={search.value}
            onChange={e => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? 'Search…'}
            className="h-9 w-full pl-9 pr-8 text-sm bg-white rounded-lg border border-border shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
          {search.value && (
            <button onClick={() => search.onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-bg-muted text-fg-subtle hover:text-fg">
              <X size={14} />
            </button>
          )}
        </div>
        {/* Clear sits outside the Menu wrapper on purpose: inside the trigger,
            clicking it would also open the filter panel it just emptied. */}
        {filters && (
          <div className="flex items-center gap-2.5 shrink-0">
            {filters.menu
              ? <Menu align="left" trigger={filtersBtn}>{c => <>{filters.menu!(c)}</>}</Menu>
              : filtersBtn}
            {filtersActive > 0 && filters.onClear && <ClearFiltersLink onClear={filters.onClear} />}
          </div>
        )}
      </div>

      {/* Right group: count · insights · density · columns */}
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
          <span className="text-fg">{fmtNumber(count.shown)}</span>
          <span className="text-fg-muted/60"> of </span>
          <span className="text-fg-muted">{fmtNumber(count.total)}</span>
          <span className="text-fg-muted/70"> {count.noun}</span>
        </span>
        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

        {rightExtra}

        {insights && (insights.menu
          ? <Menu align="right" trigger={insightsBtn}>{c => <>{insights.menu!(c)}</>}</Menu>
          : insightsBtn)}

        {density && (
          <DensityMenu
            value={density.value === 'comfortable' ? 'comfort' : 'condensed'}
            onChange={d => density.onChange(d === 'comfort' ? 'comfortable' : 'condensed')}
            sections={density.sections}
          />
        )}

        {columns && columns.onOpen && (
          <button
            onClick={columns.onOpen}
            className={cn('inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-xs transition-colors text-sm font-medium',
              columns.open ? 'border-primary/30 bg-primary/[0.04] text-fg' : 'border-border bg-white text-fg hover:bg-bg-subtle')}
          >
            <Columns3 size={16} className="text-fg-subtle" />
            <span className="hidden md:inline">Columns</span>
            <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-2xs font-semibold bg-accent text-primary">{visibleCount}</span>
          </button>
        )}

        {columns && columns.onToggle && !columns.onOpen && (
          <Menu align="right" trigger={
            <button className={btnBase}>
              <Columns3 size={16} className="text-fg-subtle" />
              <span className="hidden md:inline">Columns</span>
              <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-2xs font-semibold bg-accent text-primary">{visibleCount}</span>
            </button>
          }>
            {() => (
              <div className="w-[220px] p-1.5 max-h-[70vh] overflow-y-auto">
                <div className="px-2 pt-1 pb-1.5 text-[10px] uppercase tracking-wide text-fg-subtle/70 font-semibold">Columns</div>
                {columns.items.map(c => {
                  const on = columns.visible[c.key]
                  return (
                    <button key={c.key}
                      disabled={c.required}
                      onClick={() => !c.required && columns.onToggle?.(c.key)}
                      className={cn('w-full flex items-center gap-2.5 py-2 px-2 rounded-md text-left text-sm transition-colors',
                        c.required ? 'cursor-default opacity-60' : 'hover:bg-bg-subtle')}
                    >
                      <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', on ? 'bg-primary border-primary' : 'border-border-strong')}>
                        {on && <Check size={12} className="text-white" />}
                      </span>
                      <span className="flex-1 text-fg">{c.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </Menu>
        )}
      </div>
    </div>
  )
}
