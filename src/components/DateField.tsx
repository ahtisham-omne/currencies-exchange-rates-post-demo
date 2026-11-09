import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar as CalendarIcon, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, fmtDate } from '../lib/utils'

// Self-contained date field + month-grid calendar popover. Matches the Partners
// date picker (react-day-picker) styling - weekday row Su–Sa, month/year dropdown
// caption, blue-filled selected day - without pulling in react-day-picker /
// date-fns / radix Popover (none of which ship in this app).

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
// Popover box, in px - the width must track the `w-[17rem]` class below. The
// height is only a first-paint fallback; afterwards it is measured.
const POPOVER_W = 272
const POPOVER_FALLBACK_H = 330
const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad2 = (n: number) => String(n).padStart(2, '0')
const toISO = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`
const fmtDisplay = (d: Date) => `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`

function parseISO(value?: string | null): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// Year options for the caption dropdown - ±10 around today, widened so a month
// the user paged to with the arrows always has a matching option.
function yearRange(...include: number[]) {
  const now = new Date().getFullYear()
  const lo = Math.min(now - 10, ...include)
  const hi = Math.max(now + 10, ...include)
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

// Caption for one month pane: prev/next arrows pinned to the edges with the
// month + year dropdowns centered between them (Cash Management's
// `captionLayout="dropdown"` calendar). `onSet` receives the month the pane
// should display; the caller maps that onto whatever anchor it keeps.
/* A calendar's footer actions, the same in every calendar in the module
   (Mahad, 2026-10-08): Clear on the left in grey, turning red on hover since it
   empties the field; Today on the right in blue, on a light blue fill on hover.
   No vertical padding: each footer sets its own height, beside its neighbours. */
export const CAL_CLEAR = 'text-[13px] text-fg-muted px-2.5 rounded-md transition-colors hover:text-danger-600 hover:bg-danger-50 cursor-pointer'
export const CAL_TODAY = 'text-[13px] text-primary px-2.5 rounded-md transition-colors hover:bg-primary/10 cursor-pointer'

function MonthCaption({ shown, onSet, onPrev, onNext }: {
  shown: Date
  onSet: (next: Date) => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const y = shown.getFullYear()
  const m = shown.getMonth()
  return (
    <div className="relative flex items-center justify-center gap-1.5 h-7">
      {onPrev && (
        <button type="button" aria-label="Previous month" onClick={onPrev}
          className="absolute left-0 top-1/2 -translate-y-1/2 p-1 rounded-md text-fg-subtle opacity-50 hover:opacity-100 hover:bg-bg-subtle hover:text-fg transition-opacity">
          <ChevronLeft size={16} />
        </button>
      )}
      <CaptionSelect
        value={m}
        onChange={mo => onSet(new Date(y, mo, 1))}
        options={MONTHS_ABBR.map((label, i) => ({ value: i, label }))}
        ariaLabel="Month"
      />
      <CaptionSelect
        value={y}
        onChange={yy => onSet(new Date(yy, m, 1))}
        options={yearRange(y).map(yy => ({ value: yy, label: String(yy) }))}
        ariaLabel="Year"
      />
      {onNext && (
        <button type="button" aria-label="Next month" onClick={onNext}
          className="absolute right-0 top-1/2 -translate-y-1/2 p-1 rounded-md text-fg-subtle opacity-50 hover:opacity-100 hover:bg-bg-subtle hover:text-fg transition-opacity">
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}

export function DateField({
  value, onChange, placeholder = 'Select date', id, ariaLabel, disabled, triggerClassName, clearable,
}: {
  value?: string | null
  onChange: (iso: string) => void
  placeholder?: string
  id?: string
  /** Names the field where no visible `<label>` is tied to it - a compact inline
   *  field whose only text is the date it holds reads as "Sep 1, 2026" alone. */
  ariaLabel?: string
  disabled?: boolean
  // Optional override for the trigger button styling. When set, replaces the
  // default full-width `.input` chrome - used for compact inline pickers (e.g.
  // the insights custom-range From/To fields).
  triggerClassName?: string
  // Adds a Clear action to the calendar footer, emitting ''. Filter fields need
  // it because an empty end of a range is a meaningful value ("everything
  // before X"); required form fields do not.
  clearable?: boolean
}) {
  const selected = parseISO(value)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => selected ?? new Date())
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  // Null until measured, so the open animation can wait for the resting position.
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null)

  // Keep the calendar's visible month in sync when the field opens.
  useEffect(() => {
    if (open) setView(selected ?? new Date())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Position the portaled popover under the trigger, clamped to the viewport and
  // flipped above when the month grid would run off the bottom. Matters because
  // the field is also used inside filter popovers that can open low on screen.
  useEffect(() => {
    if (!open) { setPos(null); return }
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const h = popRef.current?.offsetHeight ?? POPOVER_FALLBACK_H
      const left = Math.max(8, Math.min(r.left, window.innerWidth - POPOVER_W - 8))
      const below = r.bottom + 4
      const flip = below + h > window.innerHeight - 8 && r.top - h - 4 >= 8
      setPos({ top: flip ? r.top - h - 4 : below, left, flip })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
    // `view` matters because a 6-week month is taller than a 5-week one, which
    // changes where a flipped popover has to sit.
  }, [open, view])

  // Dismiss on outside click / Escape.
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

  const viewYear = view.getFullYear()
  const viewMonth = view.getMonth()
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const today = new Date()
  const isToday = (d: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d
  const isSel = (d: number) => !!selected && selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        aria-label={ariaLabel}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          triggerClassName
            ? 'inline-flex items-center justify-between gap-2 text-left'
            : 'input flex items-center justify-between text-left gap-2',
          triggerClassName,
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className={cn('truncate', selected ? 'text-fg' : 'coa-placeholder')}>
          {selected ? (triggerClassName ? fmtDate(toISO(selected.getFullYear(), selected.getMonth(), selected.getDate())) : fmtDisplay(selected)) : placeholder}
        </span>
        <CalendarIcon size={triggerClassName ? 12 : 16} className="text-fg-subtle/70 shrink-0" />
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          // Marks the calendar as a nested popover so a host popover's
          // outside-click handler doesn't treat picking a day as a click away.
          data-date-popover
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            zIndex: 90,
            transformOrigin: pos?.flip ? 'bottom left' : 'top left',
            visibility: pos ? undefined : 'hidden',
          }}
          className={cn('w-[17rem] bg-white border border-border rounded-xl shadow-lg p-3',
            pos && (pos.flip ? 'animate-popover-up' : 'animate-popover-down'),
            'motion-reduce:animate-none')}
        >
          {/* Caption: prev/next arrows + month & year dropdowns */}
          <div className="pt-1 px-1">
            <MonthCaption
              shown={view}
              onSet={setView}
              onPrev={() => setView(new Date(viewYear, viewMonth - 1, 1))}
              onNext={() => setView(new Date(viewYear, viewMonth + 1, 1))}
            />
          </div>

          {/* Weekday header */}
          <div className="mt-3 grid grid-cols-7">
            {WEEKDAYS.map(w => (
              <div key={w} className="h-9 w-9 flex items-center justify-center text-[0.8rem] text-fg-subtle font-normal">{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {cells.map((d, i) => (
              <div key={i} className="h-9 w-9 flex items-center justify-center">
                {d !== null && (
                  <button
                    type="button"
                    onClick={() => { onChange(toISO(viewYear, viewMonth, d)); setOpen(false) }}
                    className={cn(
                      'h-9 w-9 rounded-md text-sm font-normal inline-flex items-center justify-center transition-colors',
                      isSel(d)
                        ? 'bg-primary text-white hover:bg-primary'
                        : isToday(d)
                          ? 'bg-accent text-primary hover:bg-accent'
                          : 'text-fg hover:bg-bg-subtle',
                    )}
                  >{d}</button>
                )}
              </div>
            ))}
          </div>

          {/* Today in one click, wherever the calendar has been paged to. Design
              review, 2026-09-30 - Eli: *"There should be a button here that says
              ... Today."* Clear sits opposite it on the fields that can be empty:
              Clear left, Today right (see CAL_CLEAR, CAL_TODAY). */}
          <div className="mt-1 pt-2 border-t border-border flex items-center">
            {clearable && selected && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className={cn(CAL_CLEAR, 'py-1')}
                style={{ fontWeight: 500 }}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => { onChange(toISO(today.getFullYear(), today.getMonth(), today.getDate())); setOpen(false) }}
              className={cn(CAL_TODAY, 'py-1 ml-auto')}
              style={{ fontWeight: 500 }}
            >
              Today
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// Inline two-month range calendar. Click a day to set the range start, click
// again to set the end; clicking never closes the host popover (all handlers are
// internal). Highlights the start/end days and the span between them.
export function DateRangeCalendar({ from, to, onChange }: {
  from?: string | null
  to?: string | null
  onChange: (from: string, to: string) => void
}) {
  const fromD = parseISO(from ?? null)
  const [anchor, setAnchor] = useState<Date>(() => fromD ?? new Date())

  const pick = (iso: string) => {
    // No start yet, or a full range already chosen → begin a new range.
    if (!from || (from && to)) { onChange(iso, ''); return }
    // Start set, end open: a click before the start restarts; otherwise closes it.
    if (iso < from) { onChange(iso, ''); return }
    onChange(from, iso)
  }
  const complete = !!from && !!to
  const isEnd = (iso: string) => iso === from || iso === to
  const inSpan = (iso: string) => complete && iso >= from! && iso <= to!

  const monthBody = (base: Date) => {
    const y = base.getFullYear(), m = base.getMonth()
    const firstDow = new Date(y, m, 1).getDay()
    const dim = new Date(y, m + 1, 0).getDate()
    const cells: (number | null)[] = [
      ...Array.from({ length: firstDow }, () => null),
      ...Array.from({ length: dim }, (_, i) => i + 1),
    ]
    return (
      <div>
        <div className="grid grid-cols-7">
          {WEEKDAYS.map(w => <div key={w} className="h-8 flex items-center justify-center text-2xs text-fg-subtle font-normal">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className="h-9" />
            const iso = toISO(y, m, d)
            const end = isEnd(iso), span = inSpan(iso)
            // Continuous band: tint the whole cell across the span, rounding the
            // start and end so the band reads as one connected pill.
            return (
              <div key={i} className={cn('h-9 flex items-center justify-center', span && 'bg-primary/10',
                span && iso === from && 'rounded-l-md', span && iso === to && 'rounded-r-md')}>
                <button
                  type="button"
                  onClick={() => pick(iso)}
                  className={cn('h-9 w-9 rounded-md text-[13px] inline-flex items-center justify-center transition-colors',
                    end ? 'bg-primary text-white hover:bg-primary font-medium' : span ? 'text-primary' : 'text-fg hover:bg-bg-subtle')}
                >{d}</button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  const next = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
  return (
    <div className="w-full">
      {/* Caption row: each pane carries its own month + year dropdowns, with the
          prev/next arrows pinned to the outer edges. Both panes drive the one
          shared anchor, so the right pane always trails the left by a month. */}
      <div className="mb-3 px-1 grid grid-cols-2 gap-6">
        <MonthCaption
          shown={anchor}
          onSet={setAnchor}
          onPrev={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
        />
        <MonthCaption
          shown={next}
          onSet={d => setAnchor(new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          onNext={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
        />
      </div>
      <div className="grid grid-cols-2 gap-6">
        {monthBody(anchor)}
        {monthBody(next)}
      </div>
    </div>
  )
}

// Full custom-range panel: title + subtitle, the two-month range calendar, and a
// Clear / Cancel / Apply footer. Holds a draft range so Apply commits and Cancel
// discards - matching the reference. Stays open while the user picks dates.
export function CustomRangeMenu({ initialFrom, initialTo, onApply, onCancel }: {
  initialFrom?: string | null
  initialTo?: string | null
  onApply: (from: string, to: string) => void
  onCancel: () => void
}) {
  const [from, setFrom] = useState(initialFrom ?? '')
  const [to, setTo] = useState(initialTo ?? '')
  const rangeLabel = from && to ? `${fmtDate(from)} – ${fmtDate(to)}` : from ? `${fmtDate(from)} – …` : 'Pick a start date, then an end date'
  return (
    <div className="p-1">
      <div className="mb-3">
        <div className="text-sm font-semibold text-fg">Custom date range</div>
        <div className="text-[12px] text-fg-muted mt-0.5">{rangeLabel}</div>
      </div>
      <DateRangeCalendar from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border">
        <span className="text-[12px] text-fg-muted tabular-nums">{from && to ? `${fmtDate(from)} – ${fmtDate(to)}` : ''}</span>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => { setFrom(''); setTo('') }} className={cn(CAL_CLEAR, 'py-1.5')}>Clear</button>
          <button type="button" onClick={onCancel} className="text-[13px] text-fg-muted hover:text-fg px-2.5 py-1.5 rounded-md hover:bg-bg-subtle">Cancel</button>
          <button type="button" disabled={!from || !to} onClick={() => onApply(from, to)} className="text-[13px] font-medium px-3.5 py-1.5 rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed">Apply</button>
        </div>
      </div>
    </div>
  )
}

/* ── Period range picker ──────────────────────────────────────────────────
   The single insights period selector used across the module: one dropdown
   trigger opening a panel with the named presets on the left and a two-month
   range calendar on the right. Presets apply on click; a hand-picked range is a
   draft until Apply, so the calendar can be explored without disturbing the
   dashboard behind it. */

// ISO `yyyy-mm-dd` on the custom variant, so the value survives JSON round-trips
// and compares lexicographically.
export type DateRangeValue =
  | { kind: 'preset'; key: string }
  | { kind: 'custom'; from: string; to: string }

export interface PeriodPresetOption { key: string; label: string }

const PANEL_W = 772
const PANEL_FALLBACK_H = 430

// How many week rows a month occupies, so both panes can render the same number
// and the two calendars stay vertically aligned.
export function weeksIn(base: Date) {
  const y = base.getFullYear(), m = base.getMonth()
  return Math.ceil((new Date(y, m, 1).getDay() + new Date(y, m + 1, 0).getDate()) / 7)
}

// A month's cells including the leading/trailing days of the adjacent months,
// which render muted but stay pickable (they're real dates).
function monthGrid(base: Date, weeks: number) {
  const y = base.getFullYear(), m = base.getMonth()
  const start = new Date(y, m, 1 - new Date(y, m, 1).getDay())
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return { iso: toISO(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), outside: d.getMonth() !== m }
  })
}

export function RangeMonthPane({ base, weeks, from, to, todayIso, onPick, onSet, onPrev, onNext }: {
  base: Date
  weeks: number
  from: string
  to: string
  todayIso: string
  onPick: (iso: string) => void
  /** Jump the pane to a month picked from the caption dropdowns. */
  onSet: (next: Date) => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const complete = !!from && !!to
  const inSpan = (iso: string) => complete && iso >= from && iso <= to
  const isEnd = (iso: string) => (!!from && iso === from) || (!!to && iso === to)
  return (
    <div className="min-w-0">
      {/* The same month/year dropdown caption the single-date field uses, so a
          reader who has moved a date in one calendar can move it in every other.
          Stepping a month at a time is the slow path when a range spans years. */}
      <MonthCaption shown={base} onSet={onSet} onPrev={onPrev} onNext={onNext} />
      <div className="mt-2 grid grid-cols-7">
        {WEEKDAYS.map(w => (
          <div key={w} className="h-8 flex items-center justify-center text-13 text-fg-subtle font-normal">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {monthGrid(base, weeks).map(c => {
          const end = isEnd(c.iso), span = inSpan(c.iso)
          return (
            <div
              key={c.iso}
              // Tint the cell (not the button) across the span so the band reads
              // as one connected pill, rounded at the two endpoints.
              className={cn('h-9 flex items-center justify-center', span && 'bg-primary/10',
                span && c.iso === from && 'rounded-l-md', span && c.iso === to && 'rounded-r-md')}
            >
              <button
                type="button"
                onClick={() => onPick(c.iso)}
                className={cn('h-9 w-9 rounded-md text-sm inline-flex items-center justify-center transition-colors',
                  end ? 'bg-primary text-white hover:bg-primary'
                    : span ? 'text-primary hover:bg-primary/15'
                      : c.outside ? 'text-slate-300 hover:bg-bg-subtle'
                        : c.iso === todayIso ? 'bg-accent text-primary hover:bg-accent'
                          : 'text-fg hover:bg-bg-subtle')}
                style={{ fontWeight: end ? 500 : 400 }}
              >{c.day}</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PeriodRangePicker({
  presets, value, onChange, label, triggerClassName, customLabel = 'Custom',
}: {
  presets: PeriodPresetOption[]
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  // Trigger text. Callers already own the label vocabulary (and some abbreviate
  // it), so it's passed in rather than derived from `presets`.
  label: string
  triggerClassName?: string
  customLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null)
  // Draft range: the calendar edits this, Apply commits it, Cancel drops it.
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  // "Custom" reads as selected as soon as the user picks it or touches a day,
  // before the range is complete enough to commit.
  const [customMode, setCustomMode] = useState(false)
  const [anchor, setAnchor] = useState(() => new Date())
  const isCustom = value.kind === 'custom'
  const today = new Date()
  const todayIso = toISO(today.getFullYear(), today.getMonth(), today.getDate())

  // Seed the draft from the committed value each time the panel opens, and show
  // the range end (or today) in the RIGHT pane so the visible months read as a
  // look-back rather than a look-ahead.
  useEffect(() => {
    if (!open) return
    const seedFrom = isCustom ? value.from : ''
    const seedTo = isCustom ? value.to : ''
    setFrom(seedFrom)
    setTo(seedTo)
    setCustomMode(isCustom)
    const focus = parseISO(seedFrom) ?? new Date()
    setAnchor(new Date(focus.getFullYear(), focus.getMonth() - (seedFrom ? 0 : 1), 1))
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
  }, [open, anchor])

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

  // First click sets the start, second closes the range; clicking before the
  // start (or after a complete range) restarts from that day.
  const pick = (iso: string) => {
    setCustomMode(true)
    if (!from || (from && to) || iso < from) { setFrom(iso); setTo(''); return }
    setTo(iso)
  }

  const next = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
  const weeks = Math.max(weeksIn(anchor), weeksIn(next))
  const footerLabel = from && to
    ? `${fmtDate(from)} to ${fmtDate(to)}`
    : from
      ? `${fmtDate(from)} to end date`
      : 'Start date to end date'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={triggerClassName ?? cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-11 transition-colors cursor-pointer',
          isCustom ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground')}
      >
        <CalendarIcon className="w-3 h-3 shrink-0" />
        <span style={{ fontWeight: 500 }}>{label}</span>
        <ChevronDown className={cn('w-2.5 h-2.5 shrink-0 transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          data-date-popover
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
            {/* Presets - apply immediately and close. */}
            <div className="w-[176px] shrink-0 border-r border-border p-2 space-y-0.5">
              {presets.map(p => {
                const active = !customMode && value.kind === 'preset' && value.key === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => { onChange({ kind: 'preset', key: p.key }); setOpen(false) }}
                    className={cn('w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors',
                      active ? 'bg-accent text-primary' : 'text-fg hover:bg-bg-subtle')}
                    style={{ fontWeight: active ? 500 : 400 }}
                  >
                    <span className="truncate">{p.label}</span>
                    {active && <Check size={15} className="shrink-0" />}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setCustomMode(true)}
                className={cn('w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors',
                  customMode ? 'bg-accent text-primary' : 'text-fg hover:bg-bg-subtle')}
                style={{ fontWeight: customMode ? 500 : 400 }}
              >
                <span className="truncate">{customLabel}</span>
                {customMode && <Check size={15} className="shrink-0" />}
              </button>
            </div>

            {/* Two-month range calendar + commit footer. */}
            <div className="flex-1 min-w-0 p-4">
              <div className="grid grid-cols-2 gap-8">
                <RangeMonthPane
                  base={anchor} weeks={weeks} from={from} to={to} todayIso={todayIso} onPick={pick}
                  onSet={setAnchor}
                  onPrev={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
                />
                <RangeMonthPane
                  base={next} weeks={weeks} from={from} to={to} todayIso={todayIso} onPick={pick}
                  // The right pane trails the left by a month, so jumping it moves
                  // the shared anchor back one to keep the pair in step.
                  onSet={d => setAnchor(new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  onNext={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
                />
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
                <span className={cn('text-13 tabular-nums', from ? 'text-fg-muted' : 'text-fg-subtle')}>{footerLabel}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="h-9 px-4 rounded-lg border border-border bg-white text-13 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >Cancel</button>
                  <button
                    type="button"
                    disabled={!from || !to}
                    onClick={() => { onChange({ kind: 'custom', from, to }); setOpen(false) }}
                    className="h-9 px-4 rounded-lg bg-primary text-white text-13 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >Apply</button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// Month / year caption dropdown - a native <select> styled as a compact pill with
// a trailing chevron, matching the calendar caption in the reference screenshots.
function CaptionSelect<T extends number>({
  value, onChange, options, ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  ariaLabel: string
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={e => onChange(Number(e.target.value) as T)}
        className="appearance-none rounded-md bg-transparent hover:bg-bg-subtle pl-2 pr-6 py-1 text-sm font-medium text-fg cursor-pointer focus:outline-none focus:ring-2 focus:ring-fg/5 transition-colors"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-fg-subtle/60 pointer-events-none" />
    </div>
  )
}
