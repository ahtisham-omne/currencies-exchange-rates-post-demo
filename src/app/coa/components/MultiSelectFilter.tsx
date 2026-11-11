/* Ported from the vendor invoicing module
   (src/app/components/data-table/MultiSelectFilter.tsx), 1 to 1.

   A quick filter as one compact dropdown instead of a row of pills. Mahad,
   2026-09-30, of the ledger's category and source chips: *"this design doesn't
   look scalable at all ... There is a dropdown, and when you click on a dropdown,
   all the checkboxes appear underneath it."* A pill per value grows with the
   data - one per source the ledger has ever seen - where this stays one control
   whatever the list holds.

   Empty selection is the filter off ("All"). The trigger reads All, the one label
   picked, or "N selected", and clears in one click while anything is picked.

   What is this module's own: the popover is portalled by hand rather than the
   source's Radix Popover, which this module does not have, and the checkbox is
   drawn to the source's recipe rather than imported. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useEscapeToClose } from './ui'

export interface MultiSelectOption { id: string; label: string; count?: number }

/* The source's shadcn checkbox: 16px, a 4px radius, a filled slate-100 box with a
   slate-200 edge, primary with a white tick once checked. */
function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className="size-4 shrink-0 rounded-[4px] border shadow-xs flex items-center justify-center"
      style={checked
        ? { backgroundColor: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary))', color: '#fff' }
        : { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}
    >
      {checked && <Check className="size-3.5" />}
    </span>
  )
}

export function MultiSelectFilter({ label, options, selected, onChange, searchable = false, renderLabel }: {
  label: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (next: string[]) => void
  /** Long option lists get a search box at the top of the dropdown. */
  searchable?: boolean
  /** How an option's label is drawn, where the text alone is not enough. */
  renderLabel?: (o: MultiSelectOption) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  // Searchable lists render ten rows at a time, and reaching the bottom reveals
  // the next ten, so a long catalogue never dumps at once.
  const PAGE = 10
  const [visibleCount, setVisibleCount] = useState(PAGE)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const close = useCallback(() => { setOpen(false); setSearch(''); setVisibleCount(PAGE) }, [])
  useEscapeToClose(open, close)

  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = trigger.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 248)) })
    }
    place()
    const outside = (e: MouseEvent) => {
      const t = e.target as Node
      if (!trigger.current?.contains(t) && !panel.current?.contains(t)) close()
    }
    document.addEventListener('mousedown', outside)
    window.addEventListener('resize', place)
    document.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', outside)
      window.removeEventListener('resize', place)
      document.removeEventListener('scroll', place, true)
    }
  }, [open, close])

  const active = selected.length > 0
  const visibleOptions = searchable && search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options
  const triggerValue = selected.length === 0
    ? 'All'
    : selected.length === 1
      ? options.find(o => o.id === selected[0])?.label ?? selected[0]
      : `${selected.length} selected`

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(v => v !== id) : [...selected, id])

  const renderOption = (opt: MultiSelectOption) => {
    const checked = selected.includes(opt.id)
    return (
      <button key={opt.id} type="button" role="menuitemcheckbox" aria-checked={checked} onClick={() => toggle(opt.id)}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer">
        <Checkbox checked={checked} />
        <span className="text-[12px] text-foreground flex-1 truncate">{renderLabel ? renderLabel(opt) : opt.label}</span>
        {opt.count !== undefined && <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">{opt.count}</span>}
      </button>
    )
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={`inline-flex items-center gap-1.5 h-[30px] rounded-full border text-xs px-3 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
          active ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-muted-foreground hover:bg-muted/60'
        }`}
        style={{ fontWeight: active ? 500 : 400 }}
      >
        <span>{label}:</span>
        <span className="max-w-[140px] truncate">{triggerValue}</span>
        {active ? (
          <span
            role="button"
            aria-label={`Clear ${label} filter`}
            onClick={e => { e.stopPropagation(); e.preventDefault(); onChange([]) }}
            className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-primary/15 transition-colors shrink-0"
          >
            <X className="w-3 h-3" />
          </span>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
        )}
      </button>

      {open && pos && createPortal(
        <div ref={panel} role="menu" aria-label={label}
          className="fixed z-[60] w-[240px] p-1 bg-white rounded-md border border-border animate-popover-down motion-reduce:animate-none"
          // Tailwind's shadow-md, which is the source's and which this module's scale redefines.
          style={{ top: pos.top, left: pos.left, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)" }}>
          {searchable && (
            <div className="relative mb-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
              <input
                autoFocus
                value={search}
                onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE) }}
                placeholder="Search…"
                className="w-full h-8 pl-8 pr-7 rounded-md border border-border bg-white text-[12px] outline-none placeholder:text-muted-foreground/50 focus:border-primary"
              />
              {search && (
                <button type="button" aria-label="Clear search" onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
          <button type="button" role="menuitemradio" aria-checked={selected.length === 0} onClick={() => onChange([])}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer">
            <span className="text-[12px] text-foreground" style={{ fontWeight: selected.length === 0 ? 600 : 400 }}>All</span>
            {selected.length === 0 && <Check className="w-3.5 h-3.5 text-primary" />}
          </button>
          <div className="h-px bg-border/60 my-1" />
          {searchable && visibleOptions.length === 0 && (
            <p className="px-2 py-2 text-[12px] text-muted-foreground">No matches</p>
          )}
          {searchable ? (
            <div
              className="max-h-[260px] overflow-y-auto"
              onScroll={e => {
                const el = e.currentTarget
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                  setVisibleCount(c => (c < visibleOptions.length ? Math.min(visibleOptions.length, c + PAGE) : c))
                }
              }}
            >
              {visibleOptions.slice(0, visibleCount).map(renderOption)}
              {visibleOptions.length > visibleCount && (
                <p className="px-2 pb-1.5 text-center text-[10px] text-muted-foreground/70" style={{ fontWeight: 500 }}>
                  Scroll for {visibleOptions.length - visibleCount} more
                </p>
              )}
            </div>
          ) : visibleOptions.map(renderOption)}
        </div>,
        document.body,
      )}
    </>
  )
}
