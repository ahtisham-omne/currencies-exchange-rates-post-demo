import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { GUIDED_COUNTRIES } from '../lib/guidedSetup'
import { FlagImage } from './FlagImage'
import { RequiredMark } from './ui'
import { cn } from '../lib/utils'

// Country picker with flags, built on the bank combobox: trigger shows the
// choice, and a portaled popover holds a pinned search box over a scrollable
// list. Two things it does that a plain searchable Select could not:
//
//   - sorts by name. The source list is in code order, so a Select renders
//     Switzerland between Canada and China and the whole list reads as unsorted.
//   - flags, which turn a wall of similar text into something scannable. Pictures,
//     not emoji, so they draw on Windows too (see FlagImage).
//
// Countries only. The "Somewhere else" row is gone (Mahad, 2026-10-02): every
// business picks its country, and anywhere but the US gets the general chart.

// Typing what you call a country should find it. Without these, "UK", "USA" and
// "UAE" all return nothing, since none of them is a substring of the full name.
const SEARCH_ALIASES: Record<string, string> = {
  AE: 'uae emirates dubai abu dhabi',
  GB: 'uk britain british england scotland wales',
  KR: 'korea',
  NL: 'holland dutch',
  US: 'usa america american',
}

const PINNED_COUNTRY = 'US'

export function CountryCombobox({
  label, required, value, onChange,
  placeholder = 'Choose a country', ariaLabel = 'Country',
}: {
  label?: string
  required?: boolean
  /** Country code, or '' when unanswered. */
  value: string
  onChange: (code: string) => void
  placeholder?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null)

  const selected = useMemo(() => GUIDED_COUNTRIES.find(c => c.code === value) ?? null, [value])

  const filtered = useMemo(() => {
    /* The United States first, then the rest by name: most companies setting
       up are there. Design review, 2026-10-08 - Eli: *"Because this is primarily
       in the United States, should the United States be pinned to the top of
       the list?"*; Mahreen: *"I think we should."* */
    const sorted = [...GUIDED_COUNTRIES].sort((a, b) =>
      Number(b.code === PINNED_COUNTRY) - Number(a.code === PINNED_COUNTRY) || a.name.localeCompare(b.name))
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(c =>
      c.name.toLowerCase().includes(q)
      || c.code.toLowerCase().startsWith(q)
      || (SEARCH_ALIASES[c.code]?.includes(q) ?? false))
  }, [query])

  const place = () => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const estimated = 360
    const below = r.bottom + estimated <= window.innerHeight || r.top < estimated
    setBox(below
      ? { left: r.left, width: r.width, top: r.bottom + 4 }
      : { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4 })
  }

  useLayoutEffect(() => { if (open) place() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) { setQuery(''); return }
    requestAnimationFrame(() => searchRef.current?.focus())
  }, [open])
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || popRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onScroll = (e: Event) => {
      if (popRef.current && e.target instanceof Node && popRef.current.contains(e.target)) return
      place()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const pick = (code: string) => { onChange(code); setOpen(false); setQuery('') }

  return (
    <div className="space-y-1.5">
      {label && <label className="label block">{label}<RequiredMark show={required} /></label>}
      <button
        type="button"
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="input pr-9 relative flex items-center gap-2 text-left cursor-pointer"
      >
        {selected ? (
          <>
            <span className="text-[16px] leading-none shrink-0 inline-flex" aria-hidden><FlagImage code={selected.code} /></span>
            <span className="flex-1 min-w-0 truncate text-fg">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 coa-placeholder">{placeholder}</span>
        )}
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle/60 pointer-events-none" />
      </button>

      {open && box && createPortal(
        <div
          ref={popRef}
          role="listbox"
          aria-label={ariaLabel}
          className="fixed z-[80] bg-white border border-border rounded-lg shadow-lg flex flex-col overflow-hidden"
          style={{ left: box.left, width: box.width, top: box.top, bottom: box.bottom }}
        >
          <div className="p-1.5 border-b border-border shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                // Enter takes the top match, so a country can be chosen without
                // leaving the keys the name was typed on.
                onKeyDown={e => {
                  if (e.key !== 'Enter' || !filtered.length) return
                  e.preventDefault()
                  pick(filtered[0].code)
                }}
                placeholder="Search countries…"
                className="w-full h-8 pl-8 pr-8 rounded-md border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[260px] overflow-auto scrollbar-thin p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-fg-muted">No countries match your search.</p>
            ) : (
              filtered.map(c => {
                const isSel = c.code === value
                return (
                  <button
                    key={c.code}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => pick(c.code)}
                    className={cn('w-full flex items-center gap-2.5 py-2 px-2 rounded-md text-left transition-colors',
                      isSel ? 'bg-primary/[0.06]' : 'hover:bg-bg-subtle')}
                  >
                    <span className="w-[22px] shrink-0 text-[16px] leading-none inline-flex justify-center" aria-hidden><FlagImage code={c.code} /></span>
                    <span className={cn('text-[13px] truncate flex-1 min-w-0', isSel ? 'text-primary font-semibold' : 'text-fg font-medium')}>{c.name}</span>
                    {isSel && <Check size={16} className="text-primary shrink-0" />}
                  </button>
                )
              })
            )}
          </div>

        </div>,
        document.body,
      )}
    </div>
  )
}
