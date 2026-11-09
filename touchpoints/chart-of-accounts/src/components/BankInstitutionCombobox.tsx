import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, PenLine, Search, X } from 'lucide-react'
import { BANK_INSTITUTIONS, type BankInstitution } from '../lib/bankInstitutions'
import { BankLogo } from './BankLogo'
import { RequiredMark } from './ui'
import { cn } from '../lib/utils'

// Searchable bank picker with logos - the COA translation of Cash Management's
// BankInstitutionCombobox. Trigger shows the selected bank; the portaled
// popover holds a pinned search box + scrollable list (popular banks first,
// then alphabetical). A footer row keeps a free-typed name when the bank isn't
// listed. Positioning mirrors the ui.tsx Select so it never clips in modals.
export function BankInstitutionCombobox({
  label, required, value, selectedInstitutionId, onSelectInstitution, onSelectCustom,
  placeholder = 'Select a bank…', invalid = false, error, ariaLabel = 'Bank name',
}: {
  label?: string
  required?: boolean
  /** Current bank name (institution name or free-typed custom name). */
  value: string
  /** Institution id when the value came from the list; null/'' for custom. */
  selectedInstitutionId: string | null
  onSelectInstitution: (inst: BankInstitution) => void
  onSelectCustom: (name: string) => void
  placeholder?: string
  invalid?: boolean
  error?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null)

  const selected = useMemo(
    () => (selectedInstitutionId ? BANK_INSTITUTIONS.find(b => b.id === selectedInstitutionId) ?? null : null),
    [selectedInstitutionId],
  )

  const filtered = useMemo(() => {
    const sorted = [...BANK_INSTITUTIONS].sort((a, b) => {
      if (a.isPopular && !b.isPopular) return -1
      if (!a.isPopular && b.isPopular) return 1
      return a.name.localeCompare(b.name)
    })
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(b => b.name.toLowerCase().includes(q) || b.shortName.toLowerCase().includes(q))
  }, [query])

  const trimmedQuery = query.trim()
  const exactMatch = filtered.some(b => b.name.toLowerCase() === trimmedQuery.toLowerCase())

  const place = () => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const estimated = 320
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

  const close = () => { setOpen(false); setQuery('') }
  const handleSelect = (inst: BankInstitution) => { onSelectInstitution(inst); close() }
  const handleCustom = () => { if (!trimmedQuery) return; onSelectCustom(trimmedQuery); close() }

  return (
    <div className="space-y-1.5">
      {label && <label className="label block">{label}<RequiredMark show={required} /></label>}
      <button
        type="button"
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen(o => !o)}
        className={cn('input pr-9 relative flex items-center gap-2 text-left cursor-pointer',
          (invalid || error) && 'border-danger-500 ring-4 ring-danger-100 focus:border-danger-500 focus:ring-4 focus:ring-danger-100')}
      >
        {value ? (
          <>
            <BankLogo bankName={selected?.name ?? value} domain={selected?.domain} initials={selected?.initials} color={selected?.primaryColor} size={20} rounded="rounded-sm" />
            <span className="flex-1 min-w-0 truncate text-fg">{value}</span>
          </>
        ) : (
          <span className="flex-1 coa-placeholder">{placeholder}</span>
        )}
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle/60 pointer-events-none" />
      </button>
      {error && <p data-field-error className="text-xs text-danger-600">{error}</p>}

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
                placeholder="Search banks…"
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

          <div className="max-h-[280px] overflow-auto scrollbar-thin p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-fg-muted">No banks match your search.</p>
            ) : (
              filtered.map(b => {
                const isSel = b.id === selectedInstitutionId
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => handleSelect(b)}
                    className={cn('w-full flex items-center gap-2.5 py-2 px-2 rounded-md text-left transition-colors',
                      isSel ? 'bg-primary/[0.06]' : 'hover:bg-bg-subtle')}
                  >
                    <BankLogo bankName={b.name} domain={b.domain} initials={b.initials} color={b.primaryColor} size={22} rounded="rounded-sm" />
                    <span className={cn('text-[13px] truncate flex-1 min-w-0', isSel ? 'text-primary font-semibold' : 'text-fg font-medium')}>{b.name}</span>
                    {b.isPopular && (
                      <span className="inline-flex items-center px-1.5 py-px rounded-md text-[9.5px] border border-border bg-bg-subtle text-fg-muted shrink-0 font-medium">Popular</span>
                    )}
                    {isSel && <Check size={16} className="text-primary shrink-0" />}
                  </button>
                )
              })
            )}
          </div>

          {trimmedQuery.length > 0 && !exactMatch && (
            <div className="border-t border-border p-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCustom}
                className="w-full flex items-center gap-2.5 py-2 px-2 rounded-md text-left transition-colors hover:bg-bg-subtle"
              >
                <span className="w-[22px] h-[22px] rounded-sm bg-bg-muted flex items-center justify-center shrink-0">
                  <PenLine size={12} className="text-fg-subtle" />
                </span>
                <span className="text-[13px] text-fg truncate flex-1 min-w-0">
                  My bank isn't listed - use <span className="font-semibold">"{trimmedQuery}"</span>
                </span>
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
