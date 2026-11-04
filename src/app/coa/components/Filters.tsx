// Ported from chart-of-accounts-v2.1/src/components/Filters.tsx; adapted: the account half (FilterState, applyFilters, FiltersSlideOver, offTheListing) is removed; the generic modal, buttons and facet building blocks stay byte for byte, with their popover helpers now from ./columnFilters instead of AccountTable.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, ChevronDown, ChevronUp, Check, SlidersHorizontal } from 'lucide-react'
import { AnchoredPopover, clickIsOutside, CrossedRangeNote, FILTER_INPUT_CLS } from './columnFilters'
import { Avatar } from './Avatar'
import { DateField } from './DateField'
import { cn, fmtNumber, invertedDates, invertedRange } from '../lib/utils'

/* The way back out of an applied filter set, sitting next to whatever applied it.
   Divider plus text link is the Partners active-filter-bar recipe, which
   `ColumnFiltersBar` already uses - so where a toolbar carries both a Filters
   button and a column-filter bar, the two clears read as one pattern instead of
   two inventions.

   Renders nothing when nothing is filtered. A disabled control would hold space
   on every table for a state most readers never reach, and the Filters button
   beside it already says "no filters" by showing no badge. */
export function ClearFiltersLink({ onClear, label = 'Clear all' }: { onClear: () => void; label?: string }) {
  return (
    <>
      <div className="w-px h-5 bg-border/60 shrink-0" />
      <button
        type="button"
        onClick={onClear}
        title="Remove every filter applied to this table"
        className="text-[12px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors whitespace-nowrap shrink-0"
        style={{ fontWeight: 500 }}
      >
        {label}
      </button>
    </>
  )
}

/* The Filters trigger, shared by every table in the module so the toolbars cannot
   drift apart. `count` is how many filters are applied; it drives the badge, the
   primary tint, and whether Clear appears.

   Clear sits beside the button rather than only in the modal footer, because the
   footer is two clicks away and a reader who can see the badge should be able to
   act on it. It clears exactly what the badge counts - the filters behind this
   button - and deliberately not the search box or the column filters, which sit
   elsewhere in the toolbar and carry their own clear affordances. Scoping the
   clear to the count it sits beside is what keeps it predictable. */
export function FiltersButton({ count, onOpen, onClear, iconSize = 14 }: {
  count: number
  onOpen: () => void
  onClear: () => void
  iconSize?: number
}) {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <button
        onClick={onOpen}
        className={cn('inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-xs hover:bg-bg-subtle transition-colors shrink-0 text-sm font-medium',
          count > 0 ? 'text-primary border-primary/30' : 'text-fg border-border')}
      >
        <SlidersHorizontal size={iconSize} className={count > 0 ? 'text-primary' : 'text-fg-subtle'} />
        Filters
        {count > 0 && <span className="ml-0.5 min-w-[18px] h-5 rounded-full text-2xs flex items-center justify-center px-1.5 bg-primary text-white font-semibold">{count}</span>}
      </button>
      {count > 0 && <ClearFiltersLink onClear={onClear} />}
    </div>
  )
}

/* The Filters modal's chrome, shared by every table that offers filtering: the
   portal, the overlay, the centred card, the header with its active count, the
   scrolling body and the Clear all / apply footer. Extracted so the second table
   to want filters does not get a second hand-built copy of all that - which is
   exactly how the toolbar came to have two versions of itself.
 *
 * The panel edits a draft and applies on the footer button. Filtering a table is
 * a sentence the reader composes before it is read back to them, and a panel
 * that reruns the table under the reader's hands cannot say "Show 12" on the
 * button, which is the part that tells them what they just asked for. */
export function FiltersModal({
  open, onClose, activeCount, onClear, onApply, applyLabel, children,
}: {
  open: boolean
  onClose: () => void
  activeCount: number
  onClear: () => void
  onApply: () => void
  applyLabel: React.ReactNode
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null

  // Portal to <body>: the app shell wraps every page in an animate-page-in
  // div whose transform persists (fill-mode both), making it the containing
  // block for fixed children - so an in-tree overlay would be clipped to the
  // content area and leave the sidebar and top bar uncovered.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 coa-scrim animate-overlay-in" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[680px] max-h-[85vh] flex flex-col overflow-hidden animate-modal-in">
        {/* Header - centered title + active count, circular X at left (Partner FiltersModal) */}
        <div className="flex items-center justify-center relative px-6 h-12 border-b border-border/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="text-[14px]" style={{ fontWeight: 600 }}>Filters</span>
          {activeCount > 0 && (
            <span className="ml-2 min-w-[20px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white" style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 600 }}>
              {activeCount}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
          {children}
        </div>

        {/* Sticky footer - underlined Clear all (left) · primary Show N (right) */}
        <div className="flex items-center justify-between px-6 h-14 border-t border-border/60 shrink-0">
          <button
            type="button"
            onClick={onClear}
            className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onApply}
            className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-white text-[13px] cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 600 }}
          >
            {applyLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* Who, then when: the people as pills, the way every other facet here picks,
   and the days as a From/To pair under them. Shared by the chart's panel and
   the ledger's, so "Created" asks its question the same way in both. */
export function AuditFacet({ people, selected, onToggle, onAll, getCount, from, to, onFromChange, onToChange }: {
  people: string[]
  selected: string[]
  onToggle: (name: string) => void
  onAll: () => void
  getCount: (name: string) => number
  from: string
  to: string
  onFromChange: (iso: string) => void
  onToChange: (iso: string) => void
}) {
  return (
    <div className="space-y-3">
      <PillSection
        options={people.map(name => ({ value: name, label: <><Avatar name={name} size={16} />{name}</> }))}
        selected={selected}
        onToggle={onToggle}
        getCount={getCount}
        leading={<AllPill active={selected.length === 0} onClick={onAll} />}
      />
      <DateRangeFromTo from={from} to={to} onFromChange={onFromChange} onToChange={onToChange} />
    </div>
  )
}

// Section wrapper + inset divider - exact Partner FiltersModal metrics
// (px-6 py-4, 14px/600 title, 12px muted subtitle, mx-6 hairline).
export function FDivider() {
  return <div className="border-t border-border/50 mx-6" />
}
export function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-4">
      <h4 className="text-[14px] mb-0.5" style={{ fontWeight: 600 }}>{title}</h4>
      {desc && <p className="text-[12px] text-muted-foreground mb-3">{desc}</p>}
      {!desc && <div className="mb-3" />}
      {children}
    </div>
  )
}
export function PillGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>
}
// Pill chip for multiselect - Partner FiltersModal Pill: 30px tall, 13px,
// weight 400 (500 when selected), bare 11px count (no boxed chip).
export function FilterPill({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border text-[13px] cursor-pointer transition-all select-none shrink-0',
        active ? 'border-primary/30 text-primary' : 'bg-white text-foreground border-border hover:border-muted-foreground/40 hover:bg-muted/30')}
      style={{ fontWeight: active ? 500 : 400, backgroundColor: active ? 'hsl(var(--accent))' : undefined }}
    >
      {children}
      {count !== undefined && (
        <span className={cn('text-[11px] tabular-nums', active ? 'text-primary/60' : 'text-muted-foreground/50')}>{count}</span>
      )}
    </button>
  )
}
// Preselected "All" pill: active (clears the group) by default. No count. It
// says All rather than Any because the pill is what the group reads as when
// nothing is picked, and what the table then shows is all of them - "Any" named
// the rule the filter applies, which is not what the reader is looking at.
export function AllPill({ active, onClick }: { active: boolean; onClick: () => void }) {
  return <FilterPill active={active} onClick={onClick}>All</FilterPill>
}

// ── Quick-filter pill: the toolbar row above a table, not the modal ──
// Ported from the Partners module's FilterPills.tsx, the canonical version of a
// recipe its list pages duplicate. Distinct from FilterPill above, which is the
// 30px chip *inside* the Filters modal. Weight carries the state - 400 idle,
// 500 active - so a selected pill reads without relying on colour alone.
export function QuickFilterPill({ label, count, active, onClick, icon, tone = 'default' }: {
  label: React.ReactNode
  count?: number
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  tone?: 'default' | 'danger'
}) {
  const danger = tone === 'danger'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer',
        danger
          ? (active
            ? 'border-rose-300 bg-rose-50 hover:bg-rose-100 active:bg-rose-200'
            : 'border-rose-200 hover:bg-rose-50 hover:border-rose-300 active:bg-rose-100')
          : (active
            ? 'border-primary bg-accent hover:bg-[#DBEAFE] active:bg-[#BFDBFE]'
            : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted'))}
      style={{
        fontWeight: active ? 500 : 400,
        color: danger ? 'hsl(var(--destructive))' : active ? 'hsl(var(--primary))' : undefined,
      }}
    >
      {icon}
      {label}
      {typeof count === 'number' && (
        <span
          className={cn('text-10 rounded-full px-1.5 py-px min-w-[18px] text-center tabular-nums',
            danger ? (active ? 'bg-rose-100' : 'bg-rose-50') : active ? 'bg-primary/10' : 'bg-muted')}
          style={{
            fontWeight: 600,
            color: danger ? 'hsl(var(--destructive))' : active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
          }}
        >
          {fmtNumber(count)}
        </span>
      )}
    </button>
  )
}

// Pill section with a "Show all N" / "Show less" toggle for long option lists
// (Partner FiltersModal PillSection). Chips render with FilterPill; once the
// option count exceeds `threshold` (8), the overflow collapses behind the toggle.
export function PillSection({ options, selected, onToggle, getCount, threshold = 8, leading }: {
  options: { value: string; label: React.ReactNode }[]
  selected: string[]
  onToggle: (value: string) => void
  getCount: (value: string) => number
  threshold?: number
  /* Rendered as the first pill in the wrap - used to pass an <AllPill /> so it
     shares the row rather than sitting on a line of its own. */
  leading?: React.ReactNode
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? options : options.slice(0, threshold)
  const hasMore = options.length > threshold
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {leading}
        {visible.map(opt => (
          <FilterPill key={opt.value} active={selected.includes(opt.value)} onClick={() => onToggle(opt.value)} count={getCount(opt.value)}>
            {opt.label}
          </FilterPill>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(s => !s)}
          className="inline-flex items-center gap-1 mt-2.5 text-[13px] cursor-pointer transition-colors hover:opacity-80"
          style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}
        >
          {showAll ? 'Show less' : `Show all ${options.length}`}
          {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  )
}

// Period labels are "MMM YYYY", which sorts alphabetically by month name rather
// than chronologically, so rank them by their position in the company's own
// period list - newest first, the end a reader reaches for. This matters more
// than it looks: the dropdown list is scrolled rather than fully visible, so the
// ordering decides which periods are reachable without typing. Labels absent
// from the list (older archived periods) fall to the end rather than the front.
export function orderPeriodsRecentFirst(labels: string[], periods: { label: string }[]): string[] {
  const rank = new Map(periods.map((p, i) => [p.label, i]))
  return [...labels].sort((a, b) => (rank.get(b) ?? -1) - (rank.get(a) ?? -1))
}

// Multi-select dropdown for open-ended option lists. Pills - even searchable,
// height-capped ones - still spend the facet's whole width on options the reader
// probably isn't after; a closed dropdown spends one line and says what's picked.
// The panel reuses the column-header filter editor's recipe (search above a
// scrolling checkbox list, "N selected · Clear selection" footer) so editing a
// facet feels the same from the modal as from a column header.
export function SearchableDropdownSelect({ options, selected, onToggle, onClear, getCount, allLabel = 'All', searchPlaceholder = 'Search…' }: {
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  onClear: () => void
  getCount: (value: string) => number
  /* Shown on the trigger while nothing is picked - i.e. the unfiltered state. */
  allLabel?: string
  searchPlaceholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [width, setWidth] = useState(320)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setSearch(''); return }
    if (ref.current) setWidth(ref.current.offsetWidth)
    const away = (e: MouseEvent) => { if (clickIsOutside(e, ref.current)) setOpen(false) }
    // Escape closes the dropdown without reaching the modal behind it, which
    // would otherwise dismiss the whole Filters panel and drop the draft.
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key, true) }
  }, [open])

  const selectedSet = new Set(selected)
  const q = search.trim().toLowerCase()
  const visible = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options
  const summary = selected.length === 0
    ? allLabel
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label ?? selected[0])
      : `${selected.length} selected`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn('w-full h-9 px-3 flex items-center justify-between gap-2 text-[13px] border rounded-lg bg-white cursor-pointer transition-colors',
          open ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50')}
      >
        <span
          className={cn('truncate', selected.length ? 'text-foreground' : 'text-muted-foreground/60')}
          style={{ fontWeight: selected.length ? 500 : 400 }}
        >
          {summary}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 text-muted-foreground/60 transition-transform', open && 'rotate-180')} />
      </button>

      <AnchoredPopover anchor={ref} open={open} width={width}>
        {options.length > 5 && (
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                autoFocus
                className={cn(FILTER_INPUT_CLS, 'pl-8 pr-8')}
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="border-t border-border/40 mt-2 -mx-3" />
          </div>
        )}
        <div className="max-h-[240px] overflow-y-auto overscroll-contain scrollbar-thin py-1 px-1">
          {visible.length === 0
            ? <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">No options found</div>
            : visible.map(opt => {
                const on = selectedSet.has(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onToggle(opt.value)}
                    className={cn('flex items-center gap-2.5 w-full px-2.5 py-[6px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/50', on && 'bg-primary/5')}
                  >
                    <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', on ? 'bg-primary border-primary' : 'border-border-strong bg-white')}>
                      {on && <Check size={11} className="text-white" />}
                    </span>
                    <span className="text-foreground truncate" style={{ fontWeight: on ? 500 : 400 }}>{opt.label}</span>
                    <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/50">{fmtNumber(getCount(opt.value))}</span>
                  </button>
                )
              })}
        </div>
        {selected.length > 0 && (
          <>
            <div className="border-t border-border/40" />
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">{selected.length} selected</span>
              <button type="button" onClick={onClear} className="text-[12px] cursor-pointer transition-colors hover:opacity-80" style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}>Clear selection</button>
            </div>
          </>
        )}
      </AnchoredPopover>
    </div>
  )
}

// Short number formatting for range-input placeholders (1.2K, 3.4M). Contra
// accounts hold a negative balance, so the magnitude is abbreviated and the sign
// put back afterwards.
const formatShort = (n: number) => {
  const sign = n < 0 ? '-' : ''
  const m = Math.abs(n)
  if (m >= 1_000_000) return `${sign}${(m / 1_000_000).toFixed(1)}M`
  if (m >= 1_000) return `${sign}${(m / 1_000).toFixed(m >= 10_000 ? 0 : 1)}K`
  return n.toLocaleString()
}

const RANGE_FIELD_CLS = 'w-full h-9 pl-7 pr-3 text-[13px] border rounded-lg bg-white focus:outline-none tabular-nums'
const RANGE_OK_CLS = 'border-border focus:ring-2 focus:ring-primary/20 focus:border-primary'
const RANGE_CROSSED_CLS = 'border-danger-500 ring-4 ring-danger-100 focus:border-danger-500'

// Min / Max numeric range inputs (Partner FiltersModal RangeHistogram): two
// labelled fields with a prefix glyph, placeholders drawn from the data extent.
export function RangeMinMax({ values, min, max, onMinChange, onMaxChange, prefix = '$', magnitude = false, placeholders }: {
  values: number[]
  min: string
  max: string
  onMinChange: (v: string) => void
  onMaxChange: (v: string) => void
  prefix?: string
  /* Set where the range bounds a size rather than a signed figure, so the
     crossed-range warning reads the pair the way the filter matches it: -100 to
     10 is inverted on an amount filter and is not on a balance one. */
  magnitude?: boolean
  /** Placeholder copy for the two fields, in place of the data's extent. */
  placeholders?: { min: string; max: string }
}) {
  const dataMin = useMemo(() => (values.length ? Math.min(...values) : 0), [values])
  const dataMax = useMemo(() => (values.length ? Math.max(...values) : 100), [values])
  const sliderMin = Math.floor(dataMin)
  const sliderMax = Math.ceil(dataMax) || 100
  const crossed = invertedRange(min, max, magnitude)
  const fieldCls = cn(RANGE_FIELD_CLS, crossed ? RANGE_CROSSED_CLS : RANGE_OK_CLS)
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Minimum</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{prefix}</span>
            <input
              type="number"
              placeholder={placeholders?.min ?? formatShort(sliderMin)}
              value={min}
              onChange={e => onMinChange(e.target.value)}
              aria-invalid={crossed || undefined}
              className={fieldCls}
            />
          </div>
        </div>
        <span className="text-muted-foreground/30 mt-5">–</span>
        <div className="flex-1">
          <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Maximum</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{prefix}</span>
            <input
              type="number"
              placeholder={placeholders?.max ?? formatShort(sliderMax)}
              value={max}
              onChange={e => onMaxChange(e.target.value)}
              aria-invalid={crossed || undefined}
              className={fieldCls}
            />
          </div>
        </div>
      </div>
      {crossed && (
        <CrossedRangeNote
          what="The minimum is above the maximum, so nothing can fall between them."
          onSwap={() => { onMinChange(max); onMaxChange(min) }}
        />
      )}
    </div>
  )
}

// From / To date range, the sibling of RangeMinMax: same 11px labels at mb-1.5
// and same 36px lg-radius field, so a modal stacking the two reads as one grid.
export function DateRangeFromTo({ from, to, onFromChange, onToChange, placeholder = 'Any' }: {
  from: string
  to: string
  onFromChange: (iso: string) => void
  onToChange: (iso: string) => void
  placeholder?: string
}) {
  const crossed = invertedDates(from, to)
  const triggerCls = cn(DATE_TRIGGER_CLS, crossed && 'border-danger-500 ring-4 ring-danger-100')
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>From</label>
          <DateField clearable value={from} placeholder={placeholder} triggerClassName={triggerCls} onChange={onFromChange} />
        </div>
        <div className="min-w-0">
          <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>To</label>
          <DateField clearable value={to} placeholder={placeholder} triggerClassName={triggerCls} onChange={onToChange} />
        </div>
      </div>
      {crossed && (
        <CrossedRangeNote
          what="The From date is after the To date, so no day falls between them."
          onSwap={() => { onFromChange(to); onToChange(from) }}
        />
      )}
    </div>
  )
}

const DATE_TRIGGER_CLS = 'w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white hover:border-primary/50 transition-colors'
