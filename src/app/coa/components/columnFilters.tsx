// Ported from chart-of-accounts-v2.1/src/components/AccountTable.tsx (ColFilter model, FILTER_INPUT_CLS, AnchoredPopover, clickIsOutside, CrossedRangeNote, FilterEditorBody, HeaderMenu, ColumnFilterChip, ColumnFiltersBar); adapted: lifted out of the Account table so any table can use them - blankFilter takes the filter type, and matchColFilter is a generic row predicate.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp, ArrowDown, EyeOff, Filter, ChevronLeft, ChevronDown, Search, X, Check, Plus, Snowflake } from 'lucide-react'
import { cn, invertedDates, invertedRange, localDayOf } from '../lib/utils'
import { DateField } from './DateField'

// ── Column filters (Partner ColumnHeaderMenu port) ──
// Clicking a header opens Filter / Sort ascending / Sort descending; Filter
// switches the popover to an inline per-type editor.
export type ColFilterType = 'text' | 'multiselect' | 'range' | 'date'
export interface ColFilter { type: ColFilterType; values: string[]; text: string; min: string; max: string; from: string; to: string }
export type ColFilters<K extends string = string> = Partial<Record<K, ColFilter>>
export const blankFilter = (type: ColFilterType): ColFilter => ({ type, values: [], text: '', min: '', max: '', from: '', to: '' })
export const filterActive = (f?: ColFilter | null) => !!f && (f.values.length > 0 || f.text.trim() !== '' || f.min !== '' || f.max !== '' || f.from !== '' || f.to !== '')

/** Whether one value passes one column's filter. `value` is what the filter reads:
 *  the printed text (text), the chip label (multiselect), a number (range) or an
 *  ISO date/time (date). */
export function matchColFilter(f: ColFilter | undefined, value: string | number | null | undefined): boolean {
  if (!f || !filterActive(f)) return true
  switch (f.type) {
    case 'text': {
      const t = f.text.trim().toLowerCase()
      return !t || String(value ?? '').toLowerCase().includes(t)
    }
    case 'multiselect': return f.values.length === 0 || f.values.includes(String(value ?? ''))
    case 'range': {
      if (value == null || value === '') return false
      const v = Number(value)
      if (f.min !== '' && v < Number(f.min)) return false
      if (f.max !== '' && v > Number(f.max)) return false
      return true
    }
    case 'date': {
      if (!value) return false
      const day = localDayOf(String(value))
      if (f.from && day < f.from) return false
      if (f.to && day > f.to) return false
      return true
    }
  }
}

// The header popover itself - column-name box, Filter, Sort ascending /
// descending, plus the inline filter editor (text / multiselect / range /
// date), styled exactly like the Partner table's ColumnHeaderMenu.
export const FILTER_INPUT_CLS = 'w-full h-8 px-3 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF]'
// DateField trigger dressed as a FILTER_INPUT_CLS field, so the date filter's
// From/To read as inputs alongside the text and number ones.
const FILTER_DATE_TRIGGER_CLS = 'w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white hover:border-primary/50 transition-colors'

// Popover portaled to <body> with fixed positioning, so it can never be
// clipped by the table's overflow-auto scroller or the chips bar's
// overflow-x-auto. Repositions on scroll/resize and clamps to the viewport.
// Outside-click handlers must also allow clicks inside [data-col-popover].
export function AnchoredPopover({ anchor, open, align = 'left', width, className, children }: {
  anchor: React.RefObject<HTMLElement | HTMLDivElement | null>
  open: boolean
  align?: 'left' | 'right'
  width: number
  className?: string
  children: React.ReactNode
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    if (!open) { setPos(null); return }
    const update = () => {
      const r = anchor.current?.getBoundingClientRect()
      if (!r) return
      let left = align === 'right' ? r.right - width : r.left
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
      setPos({ top: r.bottom + 6, left })
    }
    update()
    window.addEventListener('resize', update)
    document.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); document.removeEventListener('scroll', update, true) }
  }, [open, align, width, anchor])
  if (!open || !pos) return null
  return createPortal(
    <div
      data-col-popover
      style={{ position: 'fixed', top: pos.top, left: pos.left, width, transformOrigin: align === 'right' ? 'top right' : 'top left' }}
      className={cn('z-[60] bg-white rounded-lg shadow-lg border border-border/80 text-left font-normal normal-case cursor-default animate-popover-down motion-reduce:animate-none', className)}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      draggable={false}
      onDragStart={e => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

// Outside-click predicate shared by the popover owners: a click counts as
// "outside" only when it's outside both the trigger and any portaled popover.
export const clickIsOutside = (e: MouseEvent, trigger: HTMLElement | null) => {
  const t = e.target as Element | null
  if (!t) return true
  if (trigger && trigger.contains(t)) return false
  // [data-date-popover] is the DateField calendar, which portals out of the
  // filter popover - picking a day must not read as a click away.
  if (typeof t.closest === 'function' && t.closest('[data-col-popover],[data-date-popover]')) return false
  return true
}

// The per-type filter editor (multiselect / text / range / date), shared by
// the column-header menu and the ActiveFilters chips so editing feels the
// same from either entry point - exactly like the Partner table.
/* What a crossed range says, and the one click out of it. A swap rather than a
   clear: both ends are ones the reader typed on purpose, and the order is the
   only thing wrong with them.
 *
 * Lives here rather than in Filters.tsx because Filters imports this module, and
 * both the modal's Minimum / Maximum pair and the column popover's Min / Max
 * pair have to say it the same way. */
export function CrossedRangeNote({ what, onSwap }: { what: string; onSwap: () => void }) {
  return (
    <p className="text-[12px] text-danger-600 mt-2">
      {what}
      <button
        type="button"
        onClick={onSwap}
        className="ml-1.5 underline underline-offset-2 hover:no-underline cursor-pointer"
        style={{ fontWeight: 500 }}
      >
        Swap Them
      </button>
    </p>
  )
}

export function FilterEditorBody({ label, filter, onFilterChange, uniqueValues }: {
  label: string
  filter: ColFilter
  onFilterChange: (f: ColFilter) => void
  uniqueValues: string[]
}) {
  const [search, setSearch] = useState('')
  const clear = () => onFilterChange({ ...filter, values: [], text: '', min: '', max: '', from: '', to: '' })
  const visibleValues = uniqueValues.filter(v => v.toLowerCase().includes(search.trim().toLowerCase()))
  return (
    <>
      {filter.type === 'multiselect' && (
        <div>
          {uniqueValues.length > 5 && (
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" autoFocus className={cn(FILTER_INPUT_CLS, 'pl-8 pr-3')} />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground cursor-pointer"><X className="w-3 h-3" /></button>
                )}
              </div>
            </div>
          )}
          <div className="border-t border-border/40" />
          <div className="max-h-[240px] overflow-y-auto py-1 px-1">
            {visibleValues.length === 0
              ? <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">No options found</div>
              : visibleValues.map(v => {
                  const selected = filter.values.includes(v)
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onFilterChange({ ...filter, values: selected ? filter.values.filter(x => x !== v) : [...filter.values, v] })}
                      className={cn('flex items-center gap-2.5 w-full px-2.5 py-[6px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/50', selected && 'bg-primary/5')}
                    >
                      <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', selected ? 'bg-primary border-primary' : 'border-border-strong bg-white')}>
                        {selected && <Check size={11} className="text-white" />}
                      </span>
                      <span className="text-foreground" style={{ fontWeight: selected ? 500 : 400 }}>{v}</span>
                    </button>
                  )
                })}
          </div>
          {filter.values.length > 0 && (
            <>
              <div className="border-t border-border/40" />
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground">{filter.values.length} selected</span>
                <button type="button" onClick={clear} className="text-[12px] cursor-pointer transition-colors hover:text-primary" style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}>Clear Selection</button>
              </div>
            </>
          )}
        </div>
      )}
      {filter.type === 'text' && (
        <div className="px-3 pb-3">
          <input type="text" value={filter.text} onChange={e => onFilterChange({ ...filter, text: e.target.value })} placeholder="Type to filter…" autoFocus className={FILTER_INPUT_CLS} />
        </div>
      )}
      {filter.type === 'range' && (() => {
        // Same reading, and the same one click out of it, as the Filters modal's
        // Minimum / Maximum pair. A crossed range asks for nothing, and this
        // popover has no footer count to hint at that.
        const crossed = invertedRange(filter.min, filter.max)
        const cls = cn(FILTER_INPUT_CLS, 'px-2.5 tabular-nums', crossed && 'border-danger-500 ring-4 ring-danger-100')
        return (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>Min</label>
                <input type="number" value={filter.min} onChange={e => onFilterChange({ ...filter, min: e.target.value })} placeholder="0" autoFocus aria-invalid={crossed || undefined} className={cls} />
              </div>
              <span className="text-muted-foreground/30 mt-4">–</span>
              <div className="flex-1">
                <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>Max</label>
                <input type="number" value={filter.max} onChange={e => onFilterChange({ ...filter, max: e.target.value })} placeholder="∞" aria-invalid={crossed || undefined} className={cls} />
              </div>
            </div>
            {crossed && (
              <CrossedRangeNote
                what="Min is above Max, so nothing can fall between them."
                onSwap={() => onFilterChange({ ...filter, min: filter.max, max: filter.min })}
              />
            )}
          </div>
        )
      })()}
      {filter.type === 'date' && (() => {
        const crossed = invertedDates(filter.from, filter.to)
        const cls = cn(FILTER_DATE_TRIGGER_CLS, crossed && 'border-danger-500 ring-4 ring-danger-100')
        return (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>From</label>
                <DateField clearable value={filter.from} placeholder="Any" triggerClassName={cls}
                  onChange={iso => onFilterChange({ ...filter, from: iso })} />
              </div>
              <span className="text-muted-foreground/30 mt-4">–</span>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>To</label>
                <DateField clearable value={filter.to} placeholder="Any" triggerClassName={cls}
                  onChange={iso => onFilterChange({ ...filter, to: iso })} />
              </div>
            </div>
            {crossed && (
              <CrossedRangeNote
                what="From is after To, so no day falls between them."
                onSwap={() => onFilterChange({ ...filter, from: filter.to, to: filter.from })}
              />
            )}
          </div>
        )
      })()}
    </>
  )
}

export const operatorFor = (f: ColFilter) => (f.type === 'multiselect' ? 'is' : f.type === 'text' ? 'contains' : 'between')

export function HeaderMenu({ label, sortable, currentSort, onSortDir, filter, onFilterChange, uniqueValues, align, onHide, onToggleFreeze, frozen, noFilter, children }: {
  label: string
  sortable: boolean
  currentSort: 'asc' | 'desc' | null
  onSortDir: (dir: 'asc' | 'desc' | null) => void
  filter: ColFilter
  onFilterChange: (f: ColFilter) => void
  uniqueValues: string[]
  align?: 'right'
  onHide?: () => void
  onToggleFreeze?: () => void
  frozen?: boolean
  /** A column with no filter editor: the menu offers sort, hide and freeze only. */
  noFilter?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'filter'>('menu')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (clickIsOutside(e, ref.current)) {
        setOpen(false)
        setTimeout(() => setView('menu'), 150)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const hasActive = filterActive(filter)
  const clear = () => onFilterChange({ ...filter, values: [], text: '', min: '', max: '', from: '', to: '' })
  const handleSort = (dir: 'asc' | 'desc') => { onSortDir(currentSort === dir ? null : dir); setOpen(false) }
  const itemCls = 'flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60'
  return (
    /* The whole header cell opens the menu, not only its label. Design review,
       2026-09-24 - Eli: *"The whole column needs to be clickable."* The trigger's
       ::after stretches over the nearest positioned ancestor, which is the <th>
       (every header cell that holds this menu is `relative` or sticky), so this
       wrapper must stay unpositioned. The label and its info icon sit above the
       stretch so the icon's tooltip still answers to hover, and the resize grip
       sits above both. */
    <div ref={ref} className="inline-block">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setView('menu') }}
        className="inline-flex items-center gap-1 hover:text-fg transition-colors cursor-pointer select-none after:absolute after:inset-0 after:content-['']"
      >
        <span className="relative z-[1] inline-flex items-center gap-1">{children}</span>
      </button>
      {open && (
        <AnchoredPopover
          anchor={ref}
          open={open}
          align={align === 'right' ? 'right' : 'left'}
          width={view === 'filter' ? (filter.type === 'date' ? 340 : 260) : 220}
        >
          {view === 'menu' ? (
            <>
              {/* Column name display */}
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-muted/30">
                  <span className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>{label}</span>
                </div>
              </div>
              <div className="border-t border-border/60" />
              <div className="py-1 px-1">
                {/* Filter - also ensures the column's chip exists in the
                    ActiveFilters bar, like the Partner table. */}
                {!noFilter && (
                <button type="button" onClick={() => { setView('filter'); if (!hasActive) onFilterChange({ ...filter }) }} className={cn(itemCls, hasActive ? 'text-primary' : 'text-foreground')}>
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span style={{ fontWeight: 400 }}>Filter</span>
                  {hasActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
                )}
                {sortable && (
                  <>
                    <button type="button" onClick={() => handleSort('asc')} className={cn(itemCls, currentSort === 'asc' ? 'text-primary bg-primary/5' : 'text-foreground')}>
                      <ArrowUp className="w-4 h-4 text-muted-foreground" />
                      <span style={{ fontWeight: 400 }}>Sort Ascending</span>
                      {currentSort === 'asc' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                    </button>
                    <button type="button" onClick={() => handleSort('desc')} className={cn(itemCls, currentSort === 'desc' ? 'text-primary bg-primary/5' : 'text-foreground')}>
                      <ArrowDown className="w-4 h-4 text-muted-foreground" />
                      <span style={{ fontWeight: 400 }}>Sort Descending</span>
                      {currentSort === 'desc' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                    </button>
                  </>
                )}
                {(onToggleFreeze || onHide) && <div className="border-t border-border/60 my-1" />}
                {onHide && (
                  <button type="button" onClick={() => { onHide(); setOpen(false) }} className={cn(itemCls, 'text-foreground')}>
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                    <span style={{ fontWeight: 400 }}>Hide</span>
                  </button>
                )}
                {onToggleFreeze && (
                  <button type="button" onClick={() => { onToggleFreeze(); setOpen(false) }} className={cn(itemCls, frozen ? 'text-primary' : 'text-foreground')}>
                    <Snowflake className="w-4 h-4 text-muted-foreground" />
                    <span style={{ fontWeight: 400 }}>{frozen ? 'Unfreeze' : 'Freeze'}</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Inline filter view - back chevron, "<column> contains/is/between", Clear */}
              <div className="px-3 pt-2.5 pb-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setView('menu')} className="inline-flex items-center justify-center w-6 h-6 rounded-md cursor-pointer transition-colors hover:bg-muted/60 text-muted-foreground shrink-0">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1.5 text-[13px] min-w-0">
                    <span className="truncate" style={{ fontWeight: 500, color: 'hsl(var(--foreground))' }}>{label}</span>
                    <span className="text-muted-foreground/50 shrink-0">{operatorFor(filter)}</span>
                  </div>
                  {hasActive && (
                    <button type="button" onClick={clear} className="ml-auto text-[12px] cursor-pointer transition-colors hover:text-primary shrink-0" style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}>Clear</button>
                  )}
                </div>
              </div>
              <FilterEditorBody label={label} filter={filter} onFilterChange={onFilterChange} uniqueValues={uniqueValues} />
            </>
          )}
        </AnchoredPopover>
      )}
    </div>
  )
}

// ── ActiveFilters bar (Partner ColumnFilterChip + ActiveFiltersBar port) ──
// Chips for every column with a filter (blank or active), each reopening the
// same editor; a dashed "+ Filter" picker; and Clear all.
export function ColumnFilterChip({ label, filter, uniqueValues, onFilterChange, onRemove, autoOpen, onAutoOpened }: {
  label: string
  filter: ColFilter
  uniqueValues: string[]
  onFilterChange: (f: ColFilter) => void
  onRemove: () => void
  autoOpen?: boolean
  onAutoOpened?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (clickIsOutside(e, ref.current)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  useEffect(() => {
    if (autoOpen) {
      const t = setTimeout(() => { setOpen(true); onAutoOpened?.() }, 60)
      return () => clearTimeout(t)
    }
  }, [autoOpen, onAutoOpened])
  const active = filterActive(filter)
  const clear = () => onFilterChange({ ...filter, values: [], text: '', min: '', max: '', from: '', to: '' })
  const summary = (() => {
    if (!active) return ''
    switch (filter.type) {
      case 'multiselect': return filter.values.length === 1 ? filter.values[0] : `${filter.values.length} selected`
      case 'text': return filter.text
      case 'range': {
        const parts: string[] = []
        if (filter.min) parts.push(`≥ ${filter.min}`)
        if (filter.max) parts.push(`≤ ${filter.max}`)
        return parts.join(' & ')
      }
      case 'date': {
        const parts: string[] = []
        if (filter.from) parts.push(`from ${filter.from}`)
        if (filter.to) parts.push(`to ${filter.to}`)
        return parts.join(' ')
      }
      default: return ''
    }
  })()
  return (
    <div ref={ref} className="flex items-center shrink-0 relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn('inline-flex items-center gap-1 h-[30px] pl-2.5 rounded-l-md border text-[13px] cursor-pointer transition-colors',
          active ? 'border-primary/30 bg-accent text-primary hover:bg-[#D6E8FF]' : 'border-border bg-white text-foreground hover:bg-muted/50',
          open && 'border-primary/40')}
        style={{ fontWeight: 500, borderRight: 'none' }}
      >
        {label}
        {active && summary && (
          <>
            <span className="text-muted-foreground/50 mx-0.5">·</span>
            <span className="text-[12px] max-w-[100px] truncate opacity-80">{summary}</span>
          </>
        )}
        <ChevronDown className="w-3 h-3 ml-0.5 mr-2 opacity-60" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className={cn('inline-flex items-center justify-center h-[30px] w-[28px] rounded-r-md border border-l-0 cursor-pointer transition-colors',
          active ? 'border-primary/30 bg-accent text-primary/60 hover:text-primary hover:bg-[#D6E8FF]' : 'border-border bg-white text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50')}
      >
        <X className="w-3 h-3" />
      </button>
      {open && (
        <AnchoredPopover anchor={ref} open={open} width={filter.type === 'date' ? 340 : 260}>
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <span style={{ fontWeight: 500 }}>{label}</span>
              <span className="text-muted-foreground/50">{operatorFor(filter)}</span>
              {active && (
                <button type="button" onClick={clear} className="ml-auto text-[12px] cursor-pointer transition-colors hover:text-primary" style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}>Clear</button>
              )}
            </div>
          </div>
          <FilterEditorBody label={label} filter={filter} onFilterChange={onFilterChange} uniqueValues={uniqueValues} />
        </AnchoredPopover>
      )}
    </div>
  )
}

// Active column-filter chips + "+ Filter" picker + Clear all, mirroring the
// Partners table's Active Filters Bar. Generic over the column-key type so the
// General Ledger and register - whose keys aren't Account columns - share it.
export function ColumnFiltersBar<K extends string>({ filters, onChange, availableColumns, labelOf, uniqueValuesOf, blankFilterOf }: {
  filters: Partial<Record<K, ColFilter>>
  onChange: (f: Partial<Record<K, ColFilter>>) => void
  /* Visible, filterable columns offered by the "+ Filter" picker. */
  availableColumns: K[]
  labelOf: (k: K) => string
  uniqueValuesOf: (k: K) => string[]
  blankFilterOf: (k: K) => ColFilter
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [autoOpenKey, setAutoOpenKey] = useState<K | null>(null)
  const addRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!addOpen) return
    const h = (e: MouseEvent) => { if (clickIsOutside(e, addRef.current)) { setAddOpen(false); setAddSearch('') } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [addOpen])

  const keys = Object.keys(filters) as K[]
  if (keys.length === 0) return null

  const addable = availableColumns.filter(k => !filters[k])
  const filteredAddable = addSearch.trim()
    ? addable.filter(k => labelOf(k).toLowerCase().includes(addSearch.toLowerCase()))
    : addable
  const anyActive = keys.some(k => filterActive(filters[k]))

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border overflow-x-auto scrollbar-thin">
      {keys.map(k => (
        <ColumnFilterChip
          key={k}
          label={labelOf(k)}
          filter={filters[k]!}
          uniqueValues={uniqueValuesOf(k)}
          onFilterChange={f => onChange({ ...filters, [k]: f })}
          onRemove={() => { const next = { ...filters }; delete next[k]; onChange(next) }}
          autoOpen={autoOpenKey === k}
          onAutoOpened={() => setAutoOpenKey(null)}
        />
      ))}

      {/* + Filter picker */}
      {addable.length > 0 && (
        <div ref={addRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setAddOpen(o => !o)}
            className="inline-flex items-center gap-1 h-[30px] px-2.5 rounded-md border border-dashed border-border text-[13px] text-muted-foreground cursor-pointer transition-colors hover:bg-muted/50 hover:text-foreground hover:border-muted-foreground/40"
            style={{ fontWeight: 500 }}
          >
            <Plus className="w-3.5 h-3.5" />
            Filter
          </button>
          {addOpen && (
            <AnchoredPopover anchor={addRef} open={addOpen} width={220}>
              <div className="px-3 pt-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                  <input type="text" value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Search columns" autoFocus className={cn(FILTER_INPUT_CLS, 'pl-8 pr-3')} />
                </div>
              </div>
              <div className="border-t border-border/40" />
              <div className="max-h-[240px] overflow-y-auto py-1 px-1">
                {filteredAddable.length === 0
                  ? <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">No columns available</div>
                  : filteredAddable.map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => { onChange({ ...filters, [k]: blankFilterOf(k) }); setAutoOpenKey(k); setAddOpen(false); setAddSearch('') }}
                        className="flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] text-foreground cursor-pointer transition-colors hover:bg-muted/50"
                      >
                        <Filter className="w-3.5 h-3.5 text-muted-foreground/60" />
                        <span style={{ fontWeight: 400 }}>{labelOf(k)}</span>
                      </button>
                    ))}
              </div>
            </AnchoredPopover>
          )}
        </div>
      )}

      {/* Clear all. Same markup as `ClearFiltersLink` in Filters.tsx, which the
          Filters button uses - kept as a local copy rather than imported because
          Filters.tsx already imports from this file, and the other direction
          would close the cycle. Change both together. */}
      {anyActive && (
        <>
          <div className="w-px h-5 bg-border/60 shrink-0" />
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-[12px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors whitespace-nowrap shrink-0"
            style={{ fontWeight: 500 }}
          >
            Clear All
          </button>
        </>
      )}
    </div>
  )
}
