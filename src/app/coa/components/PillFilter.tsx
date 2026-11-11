/* A filter as a pill on the table's quick-filter row, opening onto a checkbox
   list: CoA's Dimensions picker (chart-of-accounts DimensionsPicker) with its
   left rail taken off, since it slices by one thing rather than several.

   Same trigger, down to the classes - icon, label, a count once anything is
   ticked, a chevron that turns - so it reads as the CoA control it is. Same
   panel: a title and a line on how the ticks combine, a search field once the
   list passes eight, checkbox rows with counts, and a Reset footer. The list
   shows about eight rows and scrolls for the rest; on a short window it shrinks
   further, and the panel opens upwards when there is more room above.

   Applies on the click, with no Apply button, because that is what a dropdown
   does and what CoA's does. An empty selection is the filter off. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { FILTER_INPUT_CLS } from './columnFilters'
import { cn, fmtNumber } from '../lib/utils'

const PANEL_W = 320
const PANEL_FALLBACK_H = 400
// Long lists get a search field, at CoA's threshold.
const SEARCH_THRESHOLD = 8

export interface PillFilterOption { value: string; label: string; count: number; /** A flag or mark before the label. */ icon?: ReactNode }

export function PillFilter({ label, icon, description, options, selected, onChange, searchPlaceholder }: {
  /** The pill's label and the panel's title, in Title Case: "Region". */
  label: string
  icon: ReactNode
  /** One sentence under the title on what ticking does. */
  description: string
  options: PillFilterOption[]
  selected: string[]
  onChange: (next: string[]) => void
  searchPlaceholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean; maxH: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setPos(null); setSearch(''); return }
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      // The panel's full height, as if nothing in it scrolled.
      const pop = popRef.current, list = listRef.current
      const natural = pop && list ? pop.offsetHeight - list.clientHeight + list.scrollHeight : PANEL_FALLBACK_H
      const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8))
      const below = r.bottom + 6
      const roomBelow = window.innerHeight - below - 8
      const roomAbove = r.top - 6 - 8
      const flip = natural > roomBelow && roomAbove > roomBelow
      const maxH = Math.max(200, flip ? roomAbove : roomBelow)
      const h = Math.min(natural, maxH)
      setPos({ top: flip ? r.top - 6 - h : below, left, flip, maxH })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, search])

  // The panel opens hidden until it is placed, and a hidden field takes no focus,
  // so the search is focused once it shows rather than by autoFocus.
  useEffect(() => { if (pos) searchRef.current?.focus() }, [pos != null]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const total = selected.length
  const on = total > 0 || open
  const picked = new Set(selected)
  const q = search.trim().toLowerCase()
  const listed = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options
  const toggle = (v: string) => onChange(picked.has(v) ? selected.filter(x => x !== v) : [...selected, v])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={`Filter by ${label.toLowerCase()}`}
        aria-expanded={open}
        className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer',
          on
            ? 'border-primary bg-accent hover:bg-[#DBEAFE] active:bg-[#BFDBFE]'
            : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted')}
        style={{ fontWeight: on ? 500 : 400, color: on ? 'hsl(var(--primary))' : undefined }}
      >
        <span className={cn('inline-flex', on && 'text-primary')}>{icon}</span>
        <span>{label}</span>
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
          role="dialog"
          aria-label={label}
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            zIndex: 90,
            width: PANEL_W,
            maxHeight: pos?.maxH,
            transformOrigin: pos?.flip ? 'bottom left' : 'top left',
            visibility: pos ? undefined : 'hidden',
          }}
          className={cn('max-w-[calc(100vw-16px)] bg-white border border-border rounded-xl shadow-lg overflow-hidden p-4 flex flex-col',
            pos && (pos.flip ? 'animate-popover-up' : 'animate-popover-down'),
            'motion-reduce:animate-none')}
        >
          <div className="mb-3 shrink-0">
            <div className="text-sm text-fg" style={{ fontWeight: 600 }}>{label}</div>
            <div className="text-11 text-fg-muted mt-0.5">{description}</div>
          </div>

          {options.length > SEARCH_THRESHOLD && (
            <div className="relative mb-2 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                ref={searchRef}
                placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
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

          <div ref={listRef} className="flex-1 min-h-0 max-h-[288px] overflow-y-auto overscroll-contain scrollbar-thin -mx-1 px-1 py-0.5 space-y-0.5">
            {listed.length === 0 && (
              <div className="px-3 py-4 text-center text-13 text-muted-foreground">Nothing matches your search.</div>
            )}
            {listed.map(o => {
              const ticked = picked.has(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={ticked}
                  onClick={() => toggle(o.value)}
                  className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-13 transition-colors cursor-pointer',
                    ticked ? 'bg-primary/5' : 'hover:bg-muted/50')}
                >
                  <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', ticked ? 'bg-primary border-primary' : 'border-border-strong bg-white')}>
                    {ticked && <Check size={11} className="text-white" />}
                  </span>
                  {o.icon && <span className="inline-flex shrink-0 text-base leading-none" aria-hidden>{o.icon}</span>}
                  <span className="truncate min-w-0 text-fg" style={{ fontWeight: ticked ? 500 : 400 }}>{o.label}</span>
                  <span className="text-11 text-muted-foreground tabular-nums ml-auto shrink-0">{fmtNumber(o.count)}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              disabled={total === 0}
              onClick={() => onChange([])}
              className="h-9 px-3 -ml-3 rounded-lg text-13 text-fg-muted hover:text-fg hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg-muted transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >Reset</button>
            {total > 0 && <span className="text-[12px] text-muted-foreground">{total} selected</span>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
