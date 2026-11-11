/* A multi-select dropdown whose options come in groups: SearchableDropdownSelect
   (Filters.tsx) with a heading per group. Built for the Currency Library's
   Country / Region filter, where the regions are the headings and their
   countries sit underneath.

   - A heading is a checkbox of its own: ticking it picks every option under it,
     unticking it clears them, and it shows a dash while only some are picked.
     Only options are ever stored, so "Eurozone" is its 21 countries, not a tag.
   - Search matches either level. A heading that matches brings its whole group;
     an option that matches brings its heading along for context.
   - The closed trigger names what is picked, two at most and then "+N": a group
     picked whole is named by its heading ("Eurozone, Japan"), not 21 countries.
   - Escape closes the list without reaching the Filters modal behind it, which
     would otherwise close the panel and drop the draft. */
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Minus, Search, X } from 'lucide-react'
import { AnchoredPopover, clickIsOutside, FILTER_INPUT_CLS } from './columnFilters'
import { cn, fmtNumber } from '../lib/utils'

export interface DropdownGroup { label: string; options: { value: string; label: string }[] }

/** The trigger's line: up to two names, then "+N" for the rest. */
const SHOWN = 2

function Box({ state }: { state: 'on' | 'some' | 'off' }) {
  return (
    <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0',
      state === 'off' ? 'border-border-strong bg-white' : 'bg-primary border-primary')}>
      {state === 'on' && <Check size={11} className="text-white" />}
      {state === 'some' && <Minus size={11} className="text-white" />}
    </span>
  )
}

export function GroupedDropdownSelect({ groups, selected, onChange, getCount, getGroupCount, placeholder, searchPlaceholder }: {
  groups: DropdownGroup[]
  selected: string[]
  onChange: (next: string[]) => void
  /** Rows an option would show on its own. */
  getCount: (value: string) => number
  /** Rows a whole group would show (not the sum of its options, which can overlap). */
  getGroupCount: (group: DropdownGroup) => number
  /** The closed trigger with nothing picked, i.e. the filter off. */
  placeholder: string
  searchPlaceholder: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [width, setWidth] = useState(320)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setSearch(''); return }
    if (ref.current) setWidth(ref.current.offsetWidth)
    const away = (e: MouseEvent) => { if (clickIsOutside(e, ref.current)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key, true) }
  }, [open])

  const picked = new Set(selected)
  const stateOf = (g: DropdownGroup): 'on' | 'some' | 'off' => {
    const n = g.options.filter(o => picked.has(o.value)).length
    return n === 0 ? 'off' : n === g.options.length ? 'on' : 'some'
  }
  const toggle = (v: string) => onChange(picked.has(v) ? selected.filter(x => x !== v) : [...selected, v])
  const toggleGroup = (g: DropdownGroup) => {
    const values = g.options.map(o => o.value)
    onChange(stateOf(g) === 'on'
      ? selected.filter(v => !values.includes(v))
      : [...selected, ...values.filter(v => !picked.has(v))])
  }

  // Names in the order they were picked; a group picked whole is named once, by its heading.
  const groupOf = new Map(groups.flatMap(g => g.options.map(o => [o.value, g] as const)))
  const labelOf = new Map(groups.flatMap(g => g.options.map(o => [o.value, o.label] as const)))
  const names: string[] = []
  const named = new Set<DropdownGroup>()
  selected.forEach(v => {
    const g = groupOf.get(v)
    if (g && stateOf(g) === 'on') {
      if (!named.has(g)) { named.add(g); names.push(g.label) }
    } else names.push(labelOf.get(v) ?? v)
  })
  const summary = names.length === 0
    ? placeholder
    : names.slice(0, SHOWN).join(', ') + (names.length > SHOWN ? ` +${names.length - SHOWN}` : '')

  const q = search.trim().toLowerCase()
  const visible = groups
    .map(g => (!q || g.label.toLowerCase().includes(q) ? g : { ...g, options: g.options.filter(o => o.label.toLowerCase().includes(q)) }))
    .filter(g => g.options.length > 0)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={cn('w-full h-9 px-3 flex items-center justify-between gap-2 text-[13px] border rounded-lg bg-white cursor-pointer transition-colors',
          open ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50')}
      >
        <span className={cn('truncate', names.length ? 'text-foreground' : 'text-muted-foreground/60')} style={{ fontWeight: names.length ? 500 : 400 }}>
          {summary}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 text-muted-foreground/60 transition-transform', open && 'rotate-180')} />
      </button>

      <AnchoredPopover anchor={ref} open={open} width={width}>
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
        <div className="max-h-[280px] overflow-y-auto overscroll-contain scrollbar-thin pb-1 px-1">
          {visible.length === 0
            ? <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">Nothing matches your search.</div>
            : visible.map(g => {
                const whole = groups.find(x => x.label === g.label) ?? g
                const state = stateOf(whole)
                return (
                  <div key={g.label} role="group" aria-label={g.label}>
                    {/* The heading stays in view while its countries scroll under it. */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(whole)}
                      aria-checked={state === 'on' ? true : state === 'some' ? 'mixed' : false}
                      role="menuitemcheckbox"
                      className="sticky top-0 z-[1] flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors bg-white hover:bg-muted/50"
                    >
                      <Box state={state} />
                      <span className="text-foreground truncate" style={{ fontWeight: 600 }}>{g.label}</span>
                      <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/50">{fmtNumber(getGroupCount(whole))}</span>
                    </button>
                    {g.options.map(o => {
                      const on = picked.has(o.value)
                      return (
                        <button
                          key={o.value}
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={on}
                          onClick={() => toggle(o.value)}
                          className={cn('flex items-center gap-2.5 w-full pl-8 pr-2.5 py-[6px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/50', on && 'bg-primary/5')}
                        >
                          <Box state={on ? 'on' : 'off'} />
                          <span className="text-foreground truncate" style={{ fontWeight: on ? 500 : 400 }}>{o.label}</span>
                          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/50">{fmtNumber(getCount(o.value))}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
        </div>
        {selected.length > 0 && (
          <>
            <div className="border-t border-border/40" />
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">{selected.length} selected</span>
              <button type="button" onClick={() => onChange([])} className="text-[12px] cursor-pointer transition-colors hover:opacity-80" style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}>Clear Selection</button>
            </div>
          </>
        )}
      </AnchoredPopover>
    </div>
  )
}
