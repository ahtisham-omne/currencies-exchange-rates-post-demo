import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Layers, Search, X } from 'lucide-react'
import { FILTER_INPUT_CLS } from './AccountTable'
import { countDimensionsActive, type FilterState } from './Filters'
import { useStore } from '../store'
import { cn, fmtNumber } from '../lib/utils'
import type { Account } from '../types'

/* The dimension filters, out of the Filters panel and onto the toolbar beside it.
   Dimensions are the reader's own ways of slicing the chart - they named them -
   so they are the filter most worth reaching for and the one that was hardest to
   reach, three sections down a modal nobody scrolled to the foot of.

   Built as a sibling of `AccountingPeriodPicker`, down to the rail width, panel
   chrome, portal placement and footer: the two controls sit in the same toolbar,
   and a difference in how they look would read as a difference in what they do.
   Rail rows carry the stronger `bg-accent` so the rail stays "which panel you are
   looking at", and the checkbox rows are the ones from the Filters panel's own
   dropdown, so picking a value feels the same from here as from there.

   Applies on the click, with no Apply button, because that is what a dropdown
   does and what the period picker beside it already does. The Filters panel keeps
   its draft-and-apply because it edits a dozen facets at once; this edits one. */

const RAIL_W = 176
const PANEL_W = RAIL_W + 320
const PANEL_FALLBACK_H = 400
// Long lists get a search field, at the same threshold as the period picker.
const SEARCH_THRESHOLD = 8

/* One dimension and the values a reader can pick from it: the ones it declares,
   in the order they were declared, then anything the accounts are carrying that
   it does not. That tail is how a value stays reachable after it has been taken
   off the dimension, rather than sitting on accounts nobody can pull up.

   Counts are over the whole chart rather than over what the other filters have
   left, so a value never reads as empty because of a filter somewhere else.

   Except the other dimensions' ticks. Those combine with this one - an account
   has to carry a ticked value of every dimension ticked - so a count that left
   them out promised rows the table would not show. Mahad, 2026-10-13: Location
   ticked, Engineering read 4, and ticking it emptied the table. A dimension's own
   ticks are left out of its counts, since its values are alternatives to each
   other: each count says what ticking that value adds. */
export function dimensionFacetsOf(
  dimensions: { id: string; name: string; values: string[]; status: string }[],
  accounts: Account[],
  ticked: Record<string, string[]> = {},
) {
  const carries = (a: Account, id: string, values: string[]) =>
    a.defaultDimensionValues.some(dv => dv.dimensionId === id && values.includes(dv.value))
  // Whether the account carries a ticked value of every dimension ticked, bar one.
  const passesOthers = (a: Account, except: string) =>
    Object.entries(ticked).every(([id, values]) => id === except || !values.length || carries(a, id, values))
  // Every value carried, for the list; the counts take the other ticks.
  const carried: Record<string, Set<string>> = {}
  const byDimensionValue: Record<string, Record<string, number>> = {}
  accounts.forEach(a => a.defaultDimensionValues.forEach(dv => {
    (carried[dv.dimensionId] ?? (carried[dv.dimensionId] = new Set())).add(dv.value)
    if (!passesOthers(a, dv.dimensionId)) return
    const held = byDimensionValue[dv.dimensionId] ?? (byDimensionValue[dv.dimensionId] = {})
    held[dv.value] = (held[dv.value] ?? 0) + 1
  }))
  return dimensions.filter(d => d.status === 'Active').map(d => {
    const held = byDimensionValue[d.id] ?? {}
    const declared = new Set(d.values)
    return {
      id: d.id,
      name: d.name,
      values: [...d.values, ...[...(carried[d.id] ?? [])].filter(v => !declared.has(v)).sort()],
      counts: held,
    }
    // A dimension with no values yet has nothing to offer, so it waits until it
    // does rather than showing an empty pane.
  }).filter(g => g.values.length > 0)
}

export function DimensionsPicker({ filters, setFilters, accounts, iconSize = 14 }: {
  filters: FilterState
  setFilters: (f: FilterState) => void
  /** The whole chart, unfiltered: the per-value counts are counts of it. */
  accounts: Account[]
  iconSize?: number
}) {
  const dimensions = useStore(s => s.dimensions)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const facets = useMemo(() => dimensionFacetsOf(dimensions, accounts, filters.dimensionValues), [dimensions, accounts, filters.dimensionValues])
  // Which pane is showing. Held by id rather than by index so it survives a
  // dimension being renamed, reordered or retired while the panel is open.
  const [paneId, setPaneId] = useState<string | null>(null)
  const pane = facets.find(g => g.id === paneId) ?? facets[0]
  const total = countDimensionsActive(filters)

  /* Reopen on the first dimension that is asking something, rather than always on
     the first in the list: a reader coming back to a narrowed chart is coming back
     to change the narrowing, and that is the pane it is on. */
  useEffect(() => {
    if (!open) return
    setSearch('')
    const asking = facets.find(g => (filters.dimensionValues[g.id] ?? []).length > 0)
    setPaneId((asking ?? facets[0])?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) { setPos(null); return }
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const h = popRef.current?.offsetHeight ?? PANEL_FALLBACK_H
      const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8))
      const below = r.bottom + 6
      const flip = below + h > window.innerHeight - 8 && r.top - h - 6 >= 8
      setPos({ top: flip ? r.top - h - 6 : below, left, flip })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, paneId])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // An emptied dimension drops its key rather than holding [], so the filter says
  // what is being asked for and nothing about what is not.
  const setDimension = (id: string, values: string[]) => {
    const next = { ...filters.dimensionValues }
    if (values.length) next[id] = values
    else delete next[id]
    setFilters({ ...filters, dimensionValues: next })
  }
  const toggleValue = (id: string, value: string) => {
    const held = filters.dimensionValues[id] ?? []
    setDimension(id, held.includes(value) ? held.filter(v => v !== value) : [...held, value])
  }

  // Nothing to slice by. The button waits until the chart has a dimension rather
  // than opening onto an empty panel, the same rule the Filters section it
  // replaced followed.
  if (facets.length === 0) return null

  const on = total > 0 || open
  const picked = new Set(pane ? filters.dimensionValues[pane.id] ?? [] : [])
  const q = search.trim().toLowerCase()
  const listed = pane ? (q ? pane.values.filter(v => v.toLowerCase().includes(q)) : pane.values) : []

  return (
    <>
      {/* A quick-filter pill, because that is what it is: the reader's own way of
          slicing their own chart, standing with Me mode and the category pills
          rather than beside Filters where it read as a second filter panel. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Filter by dimension"
        className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer',
          on
            ? 'border-primary bg-accent hover:bg-[#DBEAFE] active:bg-[#BFDBFE]'
            : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted')}
        style={{ fontWeight: on ? 500 : 400, color: on ? 'hsl(var(--primary))' : undefined }}
      >
        <Layers size={iconSize} className={on ? 'text-primary' : undefined} />
        <span>Dimensions</span>
        {total > 0 && (
          <span className="text-10 rounded-full px-1.5 py-px min-w-[18px] text-center tabular-nums bg-primary/10"
            style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>
            {total}
          </span>
        )}
        <ChevronDown size={12} className={cn('shrink-0 opacity-60 transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          data-dimensions-panel
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            zIndex: 90,
            width: PANEL_W,
            transformOrigin: pos?.flip ? 'bottom left' : 'top left',
            visibility: pos ? undefined : 'hidden',
          }}
          className={cn('max-w-[calc(100vw-16px)] bg-white border border-border rounded-xl shadow-lg overflow-hidden',
            pos && (pos.flip ? 'animate-popover-up' : 'animate-popover-down'),
            'motion-reduce:animate-none')}
        >
          <div className="flex items-stretch">
            {/* Left rail: the dimensions. Clicking one only swaps the right pane;
                nothing is filtered until a value is ticked over there. The count
                stands in for the period picker's tick, because a dimension is not
                chosen or unchosen - it is either asking something or it is not. */}
            <div className="shrink-0 border-r border-border p-2 space-y-0.5 max-h-[360px] overflow-y-auto overscroll-contain scrollbar-thin" style={{ width: RAIL_W }}>
              {facets.map(g => {
                const on = g.id === pane?.id
                const n = (filters.dimensionValues[g.id] ?? []).length
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => { setPaneId(g.id); setSearch('') }}
                    className={cn('w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors cursor-pointer',
                      on ? 'bg-accent text-primary' : 'text-fg hover:bg-bg-subtle')}
                    style={{ fontWeight: on ? 500 : 400 }}
                  >
                    <span className="truncate">{g.name}</span>
                    {n > 0 && (
                      <span className="text-10 text-primary bg-accent rounded px-1.5 py-0.5 shrink-0 tabular-nums" style={{ fontWeight: 500 }}>
                        {n}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex-1 min-w-0 p-4">
              <div className="mb-3">
                <div className="text-sm text-fg" style={{ fontWeight: 600 }}>{pane?.name}</div>
                {/* Says how the ticks combine, because it is not obvious and it is
                    the thing a reader gets wrong: values inside one dimension widen
                    the set, and dimensions narrow each other. */}
                <div className="text-11 text-fg-muted mt-0.5">Show accounts carrying any of the values you tick.</div>
              </div>

              {pane && pane.values.length > SEARCH_THRESHOLD && (
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={`Search ${pane.name.toLowerCase()}…`}
                    autoFocus
                    className={cn(FILTER_INPUT_CLS, 'pl-8 pr-8')}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              <div className="max-h-[264px] overflow-y-auto overscroll-contain scrollbar-thin -mx-1 px-1 py-0.5 space-y-0.5">
                {listed.length === 0 && (
                  <div className="px-3 py-4 text-center text-13 text-muted-foreground">No values match your search.</div>
                )}
                {listed.map(v => {
                  const on = picked.has(v)
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => pane && toggleValue(pane.id, v)}
                      className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-13 transition-colors cursor-pointer',
                        on ? 'bg-primary/5' : 'hover:bg-muted/50')}
                    >
                      <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', on ? 'bg-primary border-primary' : 'border-border-strong bg-white')}>
                        {on && <Check size={11} className="text-white" />}
                      </span>
                      <span className="truncate min-w-0 text-fg" style={{ fontWeight: on ? 500 : 400 }}>{v}</span>
                      <span className="text-11 text-muted-foreground tabular-nums ml-auto shrink-0">{fmtNumber(pane?.counts[v] ?? 0)}</span>
                    </button>
                  )
                })}
              </div>

              {/* Reset clears every dimension, not just the pane in view: a reader
                  who wants the whole chart back should not have to remember which
                  panes they ticked. It leaves the rest of the Filters panel alone,
                  since this control never touched it. */}
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={total === 0}
                  onClick={() => setFilters({ ...filters, dimensionValues: {} })}
                  title="Read the whole chart again, on every dimension"
                  className="h-9 px-3 -ml-3 rounded-lg text-13 text-fg-muted hover:text-fg hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg-muted transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >Reset</button>
                {total > 0 && (
                  <span className="text-[12px] text-muted-foreground">{total} selected</span>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
