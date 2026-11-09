import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react'
import { Marked, RequiredMark, useEscapeToClose } from './ui'
import { cn } from '../lib/utils'

/* ──────────────────────────────────────────────────────────────────
 * THE VALUES AN ACCOUNT TAKES FOR ONE DIMENSION
 *
 * A multi-select, in the field. Mahad, 2026-10-02: *"there should be a
 * multi-select option directly within the dropdown menu, where a checkmark
 * appears on the far right as items are selected"*, and the chips *"should be
 * contained inside the field as they get added"*. So the list stays open while
 * values are ticked, and what is taken sits inside the trigger as chips.
 *
 * The default - the value a journal line takes, because one amount lands in one
 * place - is the first one picked, and says so beside it, in the list and on
 * its chip. It moves from either: "Set as default" on a ticked row, or a click
 * on a chip. Take the default away and the next value in line becomes it. No
 * separate field: *"The default should be assigned automatically based on the
 * first item selected."*
 *
 * Built on the house Select's menu - same panel, search box, create row and
 * highlighting - so the two read as one control family.
 * ────────────────────────────────────────────────────────────────── */

export function DimensionValuePicker({
  label, ariaLabel, required, disabled, placeholder, searchPlaceholder,
  options, values, defaultValue, onChange, onCreate, createNoun, createAlways,
}: {
  label?: string
  ariaLabel: string
  required?: boolean
  disabled?: boolean
  placeholder: string
  searchPlaceholder?: string
  /** Every value the dimension offers, in its own order. */
  options: string[]
  /** The values taken, in the order they were picked. */
  values: string[]
  defaultValue?: string
  onChange: (values: string[], defaultValue: string | undefined) => void
  /** The create row: receives what was typed, or '' when nothing was. */
  onCreate?: (typed: string) => void
  createNoun?: string
  createAlways?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // The field, which the menu hangs off and an outside click is measured against.
  const triggerRef = useRef<HTMLDivElement>(null)
  // The control that opens the list. Its own element, so the chips beside it
  // are buttons a reader can reach rather than markup inside another button.
  const openerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null)

  // The default is always one of the values, and the first picked when unset.
  const def = defaultValue && values.includes(defaultValue) ? defaultValue : values[0]

  const toggle = (v: string) => {
    if (values.includes(v)) {
      const next = values.filter(x => x !== v)
      onChange(next, def === v ? next[0] : def)
    } else {
      const next = [...values, v]
      onChange(next, def ?? v)
    }
  }
  const makeDefault = (v: string) => onChange(values, v)

  const q = query.trim().toLowerCase()
  const shown = q ? options.filter(o => o.toLowerCase().includes(q)) : options
  const q0 = query.trim()
  const named = !!q0 && !options.some(o => o.trim().toLowerCase() === q0.toLowerCase())
  const creatable = !!onCreate && (named || !!createAlways)

  const place = () => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const estimated = Math.min(options.length, 8) * 38 + 52
    const below = r.bottom + estimated <= window.innerHeight || r.top < estimated
    const width = Math.min(Math.max(r.width, 240), window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 8 - width))
    setBox(below ? { left, width, top: r.bottom + 4 } : { left, width, bottom: window.innerHeight - r.top + 4 })
  }
  useLayoutEffect(() => { if (open) place() }, [open, values.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) { setQuery(''); return }
    requestAnimationFrame(() => searchRef.current?.focus())
  }, [open])

  const close = useCallback(() => {
    if (popRef.current?.contains(document.activeElement)) openerRef.current?.focus()
    setOpen(false)
  }, [])
  useEscapeToClose(open, close)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || popRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onScroll = (e: Event) => {
      if (popRef.current && e.target instanceof Node && popRef.current.contains(e.target)) return
      place()
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const DefaultTag = () => (
    <span className="text-[10px] text-primary bg-primary/10 rounded px-1 leading-4 shrink-0" style={{ fontWeight: 600 }}>Default</span>
  )

  return (
    <div className="space-y-1.5">
      {label && <label className="label flex items-center gap-1">{label}<RequiredMark show={required} /></label>}
      <div
        ref={triggerRef}
        onClick={() => { if (!disabled) { setOpen(o => !o); openerRef.current?.focus() } }}
        className={cn('input !h-auto min-h-[38px] py-1 pr-9 relative flex flex-wrap items-center gap-1.5 text-left cursor-pointer',
          open && 'border-primary ring-2 ring-primary/10',
          disabled && 'opacity-60 cursor-not-allowed')}
      >
        {values.length > 0 && (
          <span className="contents" data-dimension-values>
            {values.map(v => (
              <span key={v} className={cn('inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-md border text-2xs',
                v === def ? 'border-primary/30 bg-primary/[0.06] text-fg' : 'border-border bg-bg-subtle text-fg')} style={{ fontWeight: 500 }}>
                {/* A click on a chip makes it the default; the chip that already
                    is says so instead. */}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={e => { e.stopPropagation(); if (v !== def) makeDefault(v) }}
                  title={v === def ? undefined : `Make ${v} the default`}
                  aria-label={v === def ? `${v}, the default` : `Make ${v} the default`}
                  className={cn('inline-flex items-center gap-1', v !== def && 'hover:text-primary')}
                >
                  {v}
                  {v === def && values.length > 1 && <DefaultTag />}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove ${v}`}
                  onClick={e => { e.stopPropagation(); toggle(v) }}
                  className="w-4 h-4 rounded flex items-center justify-center text-fg-subtle hover:text-danger-600 hover:bg-danger-50 transition-colors"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </span>
        )}
        {/* The rest of the field opens the list, and carries its name. */}
        <button
          ref={openerRef}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={e => { e.stopPropagation(); if (!disabled) setOpen(o => !o) }}
          onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true) } }}
          className={cn('flex-1 min-w-[48px] h-6 text-left outline-none truncate', values.length === 0 && 'coa-placeholder')}
        >
          {values.length === 0 ? placeholder : ''}
        </button>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle/60 pointer-events-none" />
      </div>
      {open && box && createPortal(
        <div
          ref={popRef}
          role="listbox"
          aria-multiselectable="true"
          className="fixed z-[80] bg-white border border-border rounded-lg shadow-lg max-h-72 flex flex-col overflow-hidden"
          style={{ left: box.left, width: box.width, top: box.top, bottom: box.bottom }}
        >
          <div className="p-1.5 border-b border-border shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={searchPlaceholder ?? 'Search…'}
                className="w-full h-8 pl-8 pr-2 rounded-md border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>
          {creatable && (
            <div className="p-1.5 pb-0 shrink-0">
              <button
                type="button"
                onClick={() => {
                  // Typed, the value is made and ticked here and the list stays;
                  // untyped, the caller asks for a name in a form of its own.
                  if (!named) setOpen(false)
                  onCreate!(named ? q0 : '')
                  setQuery('')
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-accent text-sm font-medium text-primary hover:bg-primary/[0.12] transition-colors"
              >
                <Plus size={15} className="shrink-0" />
                <span className="truncate">{named ? `Create "${q0}"` : `Create new ${createNoun ?? 'value'}`}</span>
              </button>
            </div>
          )}
          <div className="py-1.5 overflow-auto scrollbar-thin">
            {shown.map(v => {
              const selected = values.includes(v)
              return (
                <div key={v} className="group relative">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => toggle(v)}
                    className={cn('w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors',
                      selected ? 'bg-primary/[0.06] text-primary font-medium' : 'text-fg hover:bg-bg-subtle')}
                  >
                    <span className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="truncate"><Marked text={v} q={query} /></span>
                      {selected && v === def && <DefaultTag />}
                    </span>
                    {/* Room for the Set as default link on a ticked row. */}
                    {selected && v !== def && <span className="w-[92px] shrink-0" aria-hidden />}
                    <span className="w-[15px] shrink-0 flex justify-end">{selected && <Check size={15} className="text-primary" />}</span>
                  </button>
                  {selected && v !== def && (
                    <button
                      type="button"
                      onClick={() => makeDefault(v)}
                      className="absolute right-9 top-1/2 -translate-y-1/2 text-2xs text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 hover:underline transition-opacity"
                      style={{ fontWeight: 600 }}
                    >
                      Set as default
                    </button>
                  )}
                </div>
              )
            })}
            {shown.length === 0 && (
              <div className="px-3 py-3 text-sm text-fg-subtle text-center">No {createNoun ? `${createNoun}s` : 'values'} found</div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
