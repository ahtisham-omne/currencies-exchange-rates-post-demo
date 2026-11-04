// Ported from chart-of-accounts-v2.1/src/components/PeriodStrip.tsx (strip chrome, PeriodBounds, BOUND_FIELD_CLS) and src/components/DetailInsights.tsx (PeriodSelector pills + CustomRangePopover); adapted: no store or accounting periods - a generic context bar, From/To date bounds, and a range toggle over caller-defined ranges.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Calendar as CalendarIcon } from 'lucide-react'
import { cn, fmtDate } from '../lib/utils'
import { DateField, CustomRangeMenu } from './DateField'

/* The compact bordered field a span's two ends are set in. Taller than a 22px
   word-trigger on purpose: these are boxes to type a date into. */
export const BOUND_FIELD_CLS = 'w-[116px] h-7 px-2 rounded-md border border-border bg-white text-11 hover:border-primary/50 transition-colors cursor-pointer'

/**
 * The tinted strip CoA puts above a ledger-type table (`variant="card"`, flush
 * atop the card, 45px) or above a detail dashboard (`variant="standalone"`).
 * Calendar icon, a muted label, then whatever controls the page passes.
 */
export function PeriodBar({ variant = 'card', label = 'Period', icon, children, right, className }: {
  /** `card` sits flush atop a table card; `standalone` floats in page flow. */
  variant?: 'card' | 'standalone'
  label?: ReactNode
  /** Replaces the calendar icon. */
  icon?: ReactNode
  children?: ReactNode
  /** Pushed to the right end of the strip. */
  right?: ReactNode
  className?: string
}) {
  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-2 bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)]',
      // The card variant sits flush inside a `.card`, which is `rounded-xl` and
      // deliberately `overflow-visible`, so it carries the card's own top radius.
      variant === 'card' ? 'border-b border-border-subtle rounded-t-xl' : 'border border-border-subtle rounded-lg',
      className,
    )}>
      {icon ?? <Calendar size={13} className="text-fg-subtle shrink-0" />}
      {label != null && <span className="text-11 text-muted-foreground">{label}</span>}
      {children}
      {right && <div className="ml-auto flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  )
}

/** "From [date] to [date]" in the strip's compact fields. The far end follows the
 *  one just set rather than letting the range invert. */
export function PeriodBounds({ from, to, onChange, fromPlaceholder = 'Earliest', toPlaceholder = 'Latest' }: {
  from: string
  to: string
  onChange: (next: { from: string; to: string }) => void
  fromPlaceholder?: string
  toPlaceholder?: string
}) {
  const set = (edge: 'from' | 'to') => (iso: string) => {
    if (!iso) return
    const f = from || iso
    const t = to || iso
    const next = edge === 'from' ? { from: iso, to: iso > t ? iso : t } : { from: iso < f ? iso : f, to: iso }
    if (next.from === from && next.to === to) return
    onChange(next)
  }
  return (
    <>
      <span className="text-11 text-muted-foreground shrink-0">From</span>
      <DateField value={from} onChange={set('from')} placeholder={fromPlaceholder} ariaLabel="Period from" triggerClassName={BOUND_FIELD_CLS} />
      <span className="text-11 text-muted-foreground shrink-0">to</span>
      <DateField value={to} onChange={set('to')} placeholder={toPlaceholder} ariaLabel="Period to" triggerClassName={BOUND_FIELD_CLS} />
    </>
  )
}

/* ── Range toggle ──────────────────────────────────────────────────────── */

export interface RangeOption { key: string; label: string }
export type RangeValue = { kind: 'preset'; key: string } | { kind: 'custom'; from: string; to: string }

const PILL = 'px-2 py-0.5 rounded-md text-[11px] transition-colors cursor-pointer'
const PILL_ON = 'bg-[#EDF4FF] text-[#0A77FF]'
const PILL_OFF = 'text-muted-foreground hover:bg-muted'

/**
 * CoA's range pills (DetailInsights `PeriodSelector`, pills variant) over any set
 * of ranges - 1D / 5D / 1M / 1Y / 5Y / Max, or 7d / 30d / 90d - with an optional
 * Custom pill that opens CoA's two-month range calendar.
 */
export function RangeToggle({ options, value, onChange, custom = true }: {
  options: RangeOption[]
  value: RangeValue
  onChange: (next: RangeValue) => void
  /** Offer the Custom pill (two-month calendar). */
  custom?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {options.map(o => {
        const active = value.kind === 'preset' && value.key === o.key
        return (
          <button key={o.key} type="button" onClick={() => onChange({ kind: 'preset', key: o.key })}
            className={cn(PILL, active ? PILL_ON : PILL_OFF)} style={{ fontWeight: active ? 500 : 400 }}>
            {o.label}
          </button>
        )
      })}
      {custom && <CustomRangePill value={value} onChange={onChange} />}
    </div>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const short = (iso: string) => `${MONTHS[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`

/** "Oct 3 – Nov 4, 2026" for a custom value; the option's label otherwise. */
export function describeRange(value: RangeValue, options: RangeOption[], longLabels?: Record<string, string>): string {
  if (value.kind === 'preset') return longLabels?.[value.key] ?? options.find(o => o.key === value.key)?.label ?? value.key
  const sameYear = value.from.slice(0, 4) === value.to.slice(0, 4)
  return `${sameYear ? short(value.from) : fmtDate(value.from)} – ${fmtDate(value.to)}`
}

function CustomRangePill({ value, onChange }: { value: RangeValue; onChange: (next: RangeValue) => void }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const POP_W = 588

  useEffect(() => {
    if (!open) { setPos(null); return }
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - POP_W, window.innerWidth - POP_W - 8)) })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [open])

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
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const label = useMemo(() => {
    if (value.kind !== 'custom') return 'Custom'
    const sameYear = value.from.slice(0, 4) === value.to.slice(0, 4)
    return `${short(value.from)} – ${sameYear ? short(value.to) : fmtDate(value.to)}`
  }, [value])
  const isCustom = value.kind === 'custom'

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(o => !o)}
        className={cn('inline-flex items-center gap-1', PILL, isCustom ? PILL_ON : PILL_OFF)}
        style={{ fontWeight: isCustom ? 500 : 400 }}>
        <CalendarIcon className="w-3 h-3" />
        {label}
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, zIndex: 90, width: POP_W, transformOrigin: 'top right', visibility: pos ? undefined : 'hidden' }}
          className={`max-w-[calc(100vw-16px)] bg-white border border-border rounded-xl shadow-lg p-3 motion-reduce:animate-none ${pos ? 'animate-popover-down' : ''}`}
          onMouseDown={e => e.stopPropagation()}
        >
          <CustomRangeMenu
            initialFrom={isCustom ? value.from : ''}
            initialTo={isCustom ? value.to : ''}
            onApply={(f, t) => { onChange({ kind: 'custom', from: f, to: t }); setOpen(false) }}
            onCancel={() => setOpen(false)}
          />
        </div>,
        document.body,
      )}
    </>
  )
}

/** A widget body's top row (CoA `WidgetPeriodHeader`): the range in words on the
 *  left, the toggle on the right. */
export function RangeHeader({ value, onChange, options, longLabels, custom }: {
  value: RangeValue
  onChange: (next: RangeValue) => void
  options: RangeOption[]
  longLabels?: Record<string, string>
  custom?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap pb-2">
      <p className="text-[11px] text-muted-foreground">{describeRange(value, options, longLabels)}</p>
      <RangeToggle value={value} onChange={onChange} options={options} custom={custom} />
    </div>
  )
}
