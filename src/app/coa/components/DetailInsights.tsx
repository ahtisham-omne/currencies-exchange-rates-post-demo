// Ported from chart-of-accounts-v2.1/src/components/DetailInsights.tsx; adapted: widget-remove toast from the kit store, drawer subtitle names the record (noun prop, default "currency"), plus DetailInsightsSection (the OverviewTab composition) at the end.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DndProvider, useDrag, useDrop, type ConnectDragSource } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import {
  Calendar as CalendarIcon, Check, GripVertical, Info, Trash2,
  Search, X, Plus, Sliders, ToggleLeft, ToggleRight, RotateCcw, BarChart3,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { pushToast } from '../lib/toast'
import { Tooltip as UITooltip } from './ui'
import { CAL_CLEAR, CustomRangeMenu, PeriodRangePicker } from './DateField'

// Account-detail insights system, ported from the Cash Management module's
// AccountInsights widgets (KPI tiles, resizable/draggable widget cards,
// per-widget period selectors, customize drawer). CM is a shadcn/Radix repo,
// so its primitives (Radix Tooltip/DropdownMenu/Popover, react-day-picker,
// date-fns, sonner) are translated onto this app's own primitives
// (ui.tsx Tooltip/Menu, DateField calendar, store toasts, local date math).

/* ── Period model ─────────────────────────────────────────────────────── */

/* Two families. The day presets window a series of postings, where a day is the
   unit the reader is counting in. The month presets window the per-period rows -
   closing balance and net change are one figure per accounting period, so "90
   days" of them was a span that never lined up with the bars it was cutting. */
export type PeriodPreset = '7d' | '14d' | '30d' | '90d' | '365d' | 'all' | '3m' | '6m' | '12m'

export type PeriodValue =
  | { kind: 'preset'; preset: PeriodPreset }
  | { kind: 'custom'; from: Date; to: Date }

// How many accounting periods a month preset asks for, counted rather than
// derived from a day span: three months is the last three rows, whether those
// months are 28 days long or 31.
export const PRESET_MONTHS: Partial<Record<PeriodPreset, number>> = { '3m': 3, '6m': 6, '12m': 12 }

// Sentinel lookback for the "All time" preset - large enough to cover any
// realistic transaction history without needing the caller to supply the
// earliest data point.
export const ALL_TIME_DAYS = 365 * 20

const PRESET_LABEL: Record<PeriodPreset, string> = {
  '7d': '7d', '14d': '14d', '30d': '30d', '90d': '90d', '365d': '12m', all: 'All',
  '3m': '3m', '6m': '6m', '12m': '12m',
}

const PRESET_LABEL_LONG: Record<PeriodPreset, string> = {
  '7d': 'Last 7 Days', '14d': 'Last 14 Days', '30d': 'Last 30 Days',
  '90d': 'Last 90 Days', '365d': 'Last 12 Months', all: 'All Time',
  '3m': 'Last 3 Months', '6m': 'Last 6 Months', '12m': 'Last 12 Months',
}

// The month presets still carry a day span, for the code paths that window a
// daily series. `PRESET_MONTHS` is what the monthly rows are cut by.
const PRESET_DAYS: Record<PeriodPreset, number> = {
  '7d': 7, '14d': 14, '30d': 30, '90d': 90, '365d': 365, all: ALL_TIME_DAYS,
  '3m': 92, '6m': 183, '12m': 365,
}

const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const subDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() - n); return dayStart(x) }
const fmtShort = (d: Date) => `${MONTHS_ABBR[d.getMonth()]} ${d.getDate()}`
const fmtLong = (d: Date) => `${MONTHS_ABBR[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
const pad2 = (n: number) => String(n).padStart(2, '0')
export const toIsoDay = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const fromIsoDay = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : dayStart(new Date())
}

// Derive { from, to, days } from any period value. `to` is inclusive - today
// for presets, or whatever the user picked for custom.
export function resolvePeriod(value: PeriodValue): { from: Date; to: Date; days: number } {
  if (value.kind === 'preset') {
    const today = dayStart(new Date())
    const days = PRESET_DAYS[value.preset]
    return { from: subDays(today, days - 1), to: today, days }
  }
  const from = dayStart(value.from)
  const to = dayStart(value.to)
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1)
  return { from, to, days }
}

const fmtMonth = (d: Date) => `${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`

export function describePeriod(value: PeriodValue, granularity: Granularity = 'day'): string {
  if (value.kind === 'preset') return PRESET_LABEL_LONG[value.preset]
  const { from, to } = resolvePeriod(value)
  // A month-granular range was picked as whole months, so printing the day
  // bounds it happens to span would state a precision the reader never chose.
  if (granularity === 'month') {
    return fmtMonth(from) === fmtMonth(to) ? fmtMonth(from) : `${fmtMonth(from)} – ${fmtMonth(to)}`
  }
  const sameYear = from.getFullYear() === to.getFullYear()
  return `${sameYear ? fmtShort(from) : fmtLong(from)} – ${fmtLong(to)}`
}

/* ── Persistence helpers ──────────────────────────────────────────────── */

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

// Period needs custom (de)serialization because the `custom` variant carries
// `Date` instances that JSON drops to strings.
export const DEFAULT_PERIOD: PeriodValue = { kind: 'preset', preset: '30d' }

export function readStoredPeriod(key: string): PeriodValue {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return DEFAULT_PERIOD
    const parsed = JSON.parse(raw)
    if (parsed?.kind === 'preset' && typeof parsed.preset === 'string') {
      return { kind: 'preset', preset: parsed.preset }
    }
    if (parsed?.kind === 'custom' && typeof parsed.from === 'string' && typeof parsed.to === 'string') {
      return { kind: 'custom', from: new Date(parsed.from), to: new Date(parsed.to) }
    }
    return DEFAULT_PERIOD
  } catch {
    return DEFAULT_PERIOD
  }
}

export function serializePeriod(period: PeriodValue) {
  return period.kind === 'preset'
    ? period
    : { kind: 'custom' as const, from: period.from.toISOString(), to: period.to.toISOString() }
}

/* ── PeriodSelector ───────────────────────────────────────────────────── */

/* What the Custom picker asks for. A widget charting one figure per accounting
   period cannot honour a range that starts mid-month, so asking for days there
   offers a precision the chart then silently rounds away. */
export type Granularity = 'day' | 'month'

export interface PeriodSelectorProps {
  value: PeriodValue
  onChange: (next: PeriodValue) => void
  presets?: PeriodPreset[]
  granularity?: Granularity
  // "pills" (default) renders inline preset buttons + a calendar popover,
  // suited to widget headers. "dropdown" renders a single dropdown trigger,
  // denser and better for page-level filters.
  variant?: 'pills' | 'dropdown'
  // Replaces the dropdown trigger's own chrome, for toolbars whose controls are
  // taller than an insights row's (the register's h-9 buttons).
  triggerClassName?: string
}

/* A range picked as whole months. Two clicks, the way the day calendar works:
   the first sets the start and the second the end, and clicking before the
   start re-anchors rather than refusing. The value it hands back is still a pair
   of dates - the first of the opening month and the last of the closing one - so
   nothing downstream has to learn a second range type.

   Years are stepped rather than listed: a chart holds a handful of years of
   history and a dropdown of them would be a control for a list of three. */
function MonthRangeMenu({ initialFrom, initialTo, onApply, onCancel }: {
  initialFrom: Date | null
  initialTo: Date | null
  onApply: (from: Date, to: Date) => void
  onCancel: () => void
}) {
  const today = new Date()
  const [year, setYear] = useState((initialFrom ?? today).getFullYear())
  // A month as a sortable number, so the two ends compare without date math.
  const key = (d: Date) => d.getFullYear() * 12 + d.getMonth()
  const [from, setFrom] = useState<number | null>(initialFrom ? key(initialFrom) : null)
  const [to, setTo] = useState<number | null>(initialTo ? key(initialTo) : null)

  const pick = (k: number) => {
    // A completed range is finished with, so the next click starts a new one.
    if (from === null || to !== null) { setFrom(k); setTo(null); return }
    if (k < from) { setFrom(k); setTo(from); return }
    setTo(k)
  }

  const label = (k: number) => `${MONTHS_ABBR[k % 12]} ${Math.floor(k / 12)}`
  const heading = from === null
    ? 'Pick a start month, then an end month'
    : to === null ? `${label(from)} – …` : `${label(from)} – ${label(to)}`
  // Nothing that has not begun: a month the chart cannot have a figure for is
  // not a month to offer, the same rule the accounting period strip follows.
  const latest = key(today)

  return (
    <div className="p-1 w-[268px]" data-coa-month-range>
      <div className="mb-3">
        <div className="text-sm text-fg" style={{ fontWeight: 600 }}>Custom Month Range</div>
        <div className="text-[12px] text-fg-muted mt-0.5">{heading}</div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setYear(y => y - 1)} aria-label="Previous year"
                className="w-7 h-7 rounded-md flex items-center justify-center text-fg-muted hover:bg-bg-subtle cursor-pointer">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[13px] text-fg tabular-nums" style={{ fontWeight: 600 }}>{year}</span>
        <button type="button" onClick={() => setYear(y => y + 1)} aria-label="Next year"
                disabled={year >= today.getFullYear()}
                className="w-7 h-7 rounded-md flex items-center justify-center text-fg-muted hover:bg-bg-subtle cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTHS_ABBR.map((m, i) => {
          const k = year * 12 + i
          const isEnd = k === from || k === to
          const inRange = from !== null && to !== null && k > from && k < to
          const future = k > latest
          return (
            <button
              key={m}
              type="button"
              disabled={future}
              onClick={() => pick(k)}
              className={`h-8 rounded-md text-[12px] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                isEnd ? 'bg-primary text-white'
                  : inRange ? 'bg-[#EDF4FF] text-[#0A77FF]'
                    : 'text-fg-muted hover:bg-bg-subtle'
              }`}
              style={{ fontWeight: isEnd ? 600 : 500 }}
            >
              {m}
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-3 pt-2.5 border-t border-border">
        <button type="button" onClick={() => { setFrom(null); setTo(null) }}
                className={`${CAL_CLEAR} py-1.5`}>Clear</button>
        <button type="button" onClick={onCancel}
                className="text-[13px] text-fg-muted hover:text-fg px-2.5 py-1.5 rounded-md hover:bg-bg-subtle cursor-pointer">Cancel</button>
        <button
          type="button"
          disabled={from === null || to === null}
          onClick={() => onApply(
            new Date(Math.floor(from! / 12), from! % 12, 1),
            // Day 0 of the following month is the last day of this one.
            new Date(Math.floor(to! / 12), (to! % 12) + 1, 0),
          )}
          className="text-[13px] px-3.5 py-1.5 rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          style={{ fontWeight: 500 }}
        >Apply</button>
      </div>
    </div>
  )
}

// The pills variant's Custom trigger opens a portaled two-month range calendar
// (same portal pattern as DateField: fixed position under the trigger,
// outside-click / Escape dismissal, reposition on scroll and resize).
function CustomRangePopover({ value, onChange, granularity = 'day' }: { value: PeriodValue; onChange: (next: PeriodValue) => void; granularity?: Granularity }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  // Null until placed, so the open animation starts from the resting position
  // rather than travelling in from the viewport's top-left corner.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  // The month grid is a third of the width of two calendars side by side, and a
  // panel padded out to the calendar's width would be mostly empty.
  const POP_W = granularity === 'month' ? 292 : 588

  useEffect(() => {
    if (!open) { setPos(null); return }
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - POP_W, window.innerWidth - POP_W - 8)) })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
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
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const customLabel = useMemo(() => {
    if (value.kind !== 'custom') return 'Custom'
    const { from, to } = resolvePeriod(value)
    if (granularity === 'month') {
      return fmtMonth(from) === fmtMonth(to) ? fmtMonth(from) : `${fmtMonth(from)} – ${fmtMonth(to)}`
    }
    const sameYear = from.getFullYear() === to.getFullYear()
    return `${fmtShort(from)} – ${sameYear ? fmtShort(to) : fmtLong(to)}`
  }, [value, granularity])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] transition-colors cursor-pointer ${
          value.kind === 'custom' ? 'bg-[#EDF4FF] text-[#0A77FF]' : 'text-muted-foreground hover:bg-muted'
        }`}
        style={{ fontWeight: value.kind === 'custom' ? 500 : 400 }}
      >
        <CalendarIcon className="w-3 h-3" />
        {customLabel}
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            zIndex: 90,
            width: POP_W,
            // Right-aligned to its trigger, so it unfolds from that corner.
            transformOrigin: 'top right',
            visibility: pos ? undefined : 'hidden',
          }}
          className={`max-w-[calc(100vw-16px)] bg-white border border-border rounded-xl shadow-lg p-3 motion-reduce:animate-none ${pos ? 'animate-popover-down' : ''}`}
          onMouseDown={e => e.stopPropagation()}
        >
          {granularity === 'month' ? (
            <MonthRangeMenu
              initialFrom={value.kind === 'custom' ? value.from : null}
              initialTo={value.kind === 'custom' ? value.to : null}
              onApply={(f, t) => { onChange({ kind: 'custom', from: f, to: t }); setOpen(false) }}
              onCancel={() => setOpen(false)}
            />
          ) : (
            <CustomRangeMenu
              initialFrom={value.kind === 'custom' ? toIsoDay(value.from) : ''}
              initialTo={value.kind === 'custom' ? toIsoDay(value.to) : ''}
              onApply={(f, t) => { onChange({ kind: 'custom', from: fromIsoDay(f), to: fromIsoDay(t) }); setOpen(false) }}
              onCancel={() => setOpen(false)}
            />
          )}
        </div>,
        document.body,
      )}
    </>
  )
}

export function PeriodSelector({ value, onChange, presets = ['7d', '14d', '30d', '90d'], variant = 'pills', triggerClassName, granularity = 'day' }: PeriodSelectorProps) {
  // Dropdown variant: the shared PeriodRangePicker - presets on the left, a
  // two-month range calendar on the right. Its value model is ISO strings, so
  // translate in both directions across this component's Date-based one.
  if (variant === 'dropdown') {
    return (
      <PeriodRangePicker
        presets={presets.map(p => ({ key: p, label: PRESET_LABEL_LONG[p] }))}
        value={value.kind === 'preset'
          ? { kind: 'preset', key: value.preset }
          : { kind: 'custom', from: toIsoDay(value.from), to: toIsoDay(value.to) }}
        onChange={next => onChange(next.kind === 'preset'
          ? { kind: 'preset', preset: next.key as PeriodPreset }
          : { kind: 'custom', from: fromIsoDay(next.from), to: fromIsoDay(next.to) })}
        label={describePeriod(value, granularity)}
        triggerClassName={triggerClassName}
      />
    )
  }

  return (
    <div className="flex items-center gap-1">
      {presets.map(p => {
        const active = value.kind === 'preset' && value.preset === p
        return (
          <button
            key={p}
            onClick={() => onChange({ kind: 'preset', preset: p })}
            className={`px-2 py-0.5 rounded-md text-[11px] transition-colors cursor-pointer ${
              active ? 'bg-[#EDF4FF] text-[#0A77FF]' : 'text-muted-foreground hover:bg-muted'
            }`}
            style={{ fontWeight: active ? 500 : 400 }}
          >
            {PRESET_LABEL[p]}
          </button>
        )
      })}
      <CustomRangePopover value={value} onChange={onChange} granularity={granularity} />
    </div>
  )
}

/* ── Widget chrome ────────────────────────────────────────────────────── */

export type WidgetSize = 'sm' | 'md' | 'lg'

// Chart heights per size, matching the Partners dashboard. Size has to change
// something the reader can actually see: Large also takes the full row, but Small
// and Medium are both half-width, so with a fixed chart height the two differed by
// nothing but 4px of padding and the toggle looked broken.
export const WIDGET_CHART_H: Record<WidgetSize, number> = { sm: 140, md: 200, lg: 280 }

// A donut is drawn at a fixed square rather than into a responsive box, so it
// cannot take its height from the constant above - it needs three sets of its
// own. Partners' spend-by-category numbers exactly, so a ring here and a ring
// there come out the same width at the same setting.
export const WIDGET_PIE: Record<WidgetSize, { box: number; inner: number; outer: number }> = {
  sm: { box: 100, inner: 30, outer: 46 },
  md: { box: 130, inner: 40, outer: 60 },
  lg: { box: 160, inner: 52, outer: 74 },
}

// Bars thin down on a small card. At 140px tall and half a row wide, a 24px bar
// crowds the one beside it and the gaps stop reading as gaps.
export const widgetBarSize = (size: WidgetSize, full = 24) => (size === 'sm' ? 14 : full)

// The card's own size, published to its body. A context rather than a prop on
// every widget body: the size is fixed by the card that renders the body, so
// threading it through each of the eight bodies would just restate what the card
// already knows, and each new widget would have to remember to forward it.
const WidgetSizeContext = createContext<WidgetSize>('md')
export const useWidgetSize = () => useContext(WidgetSizeContext)

/* How much taller a widget's chart draws because its card is wider than usual.

   The heights above are right for the width a card has on an ordinary page. In
   full view, or on a big monitor, the same card gets far wider and a fixed
   height left it a thin strip - Eli, 2026-09-24: *"It's just stretching it from
   side to side. It's not scaling it ... there needs to be a width-to-height
   ratio with these things."* So past the width a card has on the widest normal
   page, its chart grows in proportion, up to twice its height. At or below that
   width nothing changes, which keeps a posting and a summary dashboard the same
   height side by side (the other half of his note: *"you have a sizing
   consistency issue"*).

   Reference widths are the card's width on the 1600px page: half the content
   column for Small and Medium, all of it for Large. */
export const WIDGET_REFERENCE_W: Record<WidgetSize, number> = { sm: 600, md: 600, lg: 1200 }
export const WIDGET_MAX_GROWTH = 2
export function widgetGrowth(size: WidgetSize, cardWidth: number): number {
  if (!cardWidth) return 1
  return Math.min(WIDGET_MAX_GROWTH, Math.max(1, cardWidth / WIDGET_REFERENCE_W[size]))
}
const WidgetGrowthContext = createContext(1)
/** The chart height for the card this body is in, grown for a wide card. */
export function useWidgetChartH(): number {
  return Math.round(WIDGET_CHART_H[useWidgetSize()] * useContext(WidgetGrowthContext))
}
/** The donut's square and radii, grown the same way. */
export function useWidgetPie(): { box: number; inner: number; outer: number } {
  const p = WIDGET_PIE[useWidgetSize()]
  const g = useContext(WidgetGrowthContext)
  return { box: Math.round(p.box * g), inner: Math.round(p.inner * g), outer: Math.round(p.outer * g) }
}

interface WidgetContentCardProps {
  title: string
  tooltip?: string
  icon?: ElementType
  iconBg?: string
  iconColor?: string
  children: ReactNode
  currentSize?: WidgetSize
  onSizeChange?: (size: WidgetSize) => void
  onRemove?: () => void
  isDragging?: boolean
  isOver?: boolean
}

// Lets DraggableWidgetCard hand its react-dnd drag connector down to the
// WidgetContentCard header, so only the header initiates a drag while the body
// stays text-selectable.
const WidgetDragHandleContext = createContext<ConnectDragSource | null>(null)

export function WidgetContentCard({
  title, tooltip, icon: Icon, iconBg, iconColor, children,
  currentSize, onSizeChange, onRemove, isDragging, isOver,
}: WidgetContentCardProps) {
  const [hovered, setHovered] = useState(false)
  const dragHandle = useContext(WidgetDragHandleContext)
  const headerRef = useRef<HTMLDivElement>(null)
  if (dragHandle) dragHandle(headerRef)

  /* The card's own width, read as it changes - full view, a size pick, a
     resized window. Rounded to 8px so the 500ms width transition does not
     redraw the chart on every frame of it. */
  const rootRef = useRef<HTMLDivElement>(null)
  const [cardWidth, setCardWidth] = useState(0)
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const read = () => setCardWidth(Math.round(el.getBoundingClientRect().width / 8) * 8)
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const growth = widgetGrowth(currentSize ?? 'md', cardWidth)

  return (
    <div
      ref={rootRef}
      data-widget-growth={growth.toFixed(2)}
      className={`rounded-xl border bg-white overflow-hidden h-full flex flex-col transition-[box-shadow,border-color] duration-300 ${
        isOver && !isDragging
          ? 'border-primary/30 shadow-[0_0_0_2px_rgba(10,119,255,0.10)]'
          : 'border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={headerRef}
        className={`px-4 py-2.5 border-b border-muted flex items-center justify-between shrink-0 select-none ${dragHandle ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 pointer-events-none" style={{ backgroundColor: iconBg || '#EDF4FF' }}>
              <Icon className="w-3.5 h-3.5" style={{ color: iconColor || '#0A77FF' }} />
            </div>
          )}
          <span className="text-[13px] text-foreground truncate pointer-events-none" style={{ fontWeight: 600 }}>{title}</span>
          {tooltip && (
            <UITooltip content={tooltip} side="top">
              <span
                className="inline-flex shrink-0 cursor-help pointer-events-auto"
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
              >
                <Info className="w-3.5 h-3.5 text-[#94A3B8]" />
              </span>
            </UITooltip>
          )}
        </div>

        {/* Host change: the hidden controls take no width until hover, so titles
            aren't truncated beside this app's wider sidebar. */}
        <div className={`flex items-center gap-2 pointer-events-auto shrink-0 overflow-hidden transition-[max-width] duration-200 ease-out ${hovered ? 'max-w-[320px]' : 'max-w-0'}`}>
          <div className={`flex items-center transition-all duration-200 ease-out ${
            hovered && onSizeChange ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
          }`}>
            {onSizeChange && currentSize && (
              <div className="flex items-center h-7 rounded-lg border border-border bg-slate-50 p-0.5 gap-0.5">
                {(['sm', 'md', 'lg'] as const).map(s => (
                  <button
                    key={s}
                    onClick={e => { e.stopPropagation(); onSizeChange(s) }}
                    onMouseDown={e => e.stopPropagation()}
                    className={`h-6 px-2.5 rounded-md text-[11px] cursor-pointer transition-all duration-150 ${
                      currentSize === s
                        ? 'bg-white text-primary shadow-sm border border-border'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-white/60 border border-transparent'
                    }`}
                    style={{ fontWeight: currentSize === s ? 600 : 500 }}
                    aria-label={`Set widget size ${s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}`}
                    aria-pressed={currentSize === s}
                  >
                    {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {onRemove && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onRemove()
                pushToast(`Removed "${title}". Re-enable it from Customize Insights.`, 'success')
              }}
              onMouseDown={e => e.stopPropagation()}
              className={`group/rm w-7 h-7 rounded-md flex items-center justify-center text-slate-400 transition-all duration-150 cursor-pointer hover:bg-red-100 hover:text-red-600 ${
                hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              title={`Remove ${title}`}
              aria-label={`Remove ${title} widget`}
            >
              <Trash2 className="w-3.5 h-3.5 transition-transform duration-150 group-hover/rm:scale-110" />
            </button>
          )}
        </div>
      </div>

      <WidgetSizeContext.Provider value={currentSize ?? 'md'}>
        <WidgetGrowthContext.Provider value={growth}>
          <div className={`flex-1 flex flex-col justify-between ${currentSize === 'sm' ? 'p-3' : currentSize === 'lg' ? 'p-5' : 'p-4'}`}>
            {children}
          </div>
        </WidgetGrowthContext.Provider>
      </WidgetSizeContext.Provider>
    </div>
  )
}

/* ── Draggable KPI card ───────────────────────────────────────────────── */

export const DND_DETAIL_KPI_TYPE = 'COA_DETAIL_KPI'

interface DraggableKpiCardProps {
  index: number
  kpiKey: string
  label: string
  value: ReactNode
  subDetail?: ReactNode
  tooltip?: string
  moveCard: (from: number, to: number) => void
  onClick?: () => void
  onRemove?: () => void
}

/* No icon on the face. A KPI card states one figure, and no symbol stands for a
   figure - the ones drawn here stood for the account type instead, which the
   label already said. */
export function DraggableKpiCard({
  index, label, value, subDetail, tooltip,
  moveCard, onClick, onRemove,
}: DraggableKpiCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_DETAIL_KPI_TYPE,
    item: () => ({ index }),
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  })

  const [{ isOver }, drop] = useDrop({
    accept: DND_DETAIL_KPI_TYPE,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return
      const dragIndex = item.index
      const hoverIndex = index
      if (dragIndex === hoverIndex) return
      const hoverRect = ref.current.getBoundingClientRect()
      const hoverMiddleX = (hoverRect.right - hoverRect.left) / 2
      const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2
      const offset = monitor.getClientOffset()
      if (!offset) return
      const x = offset.x - hoverRect.left
      const y = offset.y - hoverRect.top
      if (dragIndex < hoverIndex && y < hoverMiddleY && x < hoverMiddleX) return
      if (dragIndex > hoverIndex && y > hoverMiddleY && x > hoverMiddleX) return
      moveCard(dragIndex, hoverIndex)
      item.index = hoverIndex
    },
    collect: monitor => ({ isOver: monitor.isOver() }),
  })

  preview(drop(ref))
  drag(headerRef)

  if (isDragging) {
    return <div ref={ref} className="rounded-lg border border-dashed border-[#0A77FF]/20 bg-[#0A77FF]/[0.02] min-h-[68px] pointer-events-none" />
  }

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`border rounded-lg bg-white group relative min-w-0 transition-all duration-200 overflow-hidden ${onClick ? 'cursor-pointer' : ''} ${
        isOver
          ? 'border-[#0A77FF]/30 bg-[#0A77FF]/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]'
          : 'border-[#E2E8F0] hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]'
      }`}
    >
      {isOver && <div className="absolute inset-0 rounded-lg bg-[#0A77FF]/[0.02] pointer-events-none" />}
      <div className="px-3 py-2">
        <div
          ref={headerRef}
          className="flex items-center justify-between gap-1 mb-1 cursor-grab active:cursor-grabbing select-none group/kpihdr"
        >
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-xs text-[#64748B] whitespace-nowrap truncate" style={{ fontWeight: 500 }}>{label}</p>
            {tooltip && (
              <UITooltip content={tooltip} side="bottom">
                <span
                  className="inline-flex shrink-0 cursor-help"
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <Info className="w-3 h-3 text-[#CBD5E1] hover:text-[#94A3B8] transition-colors" />
                </span>
              </UITooltip>
            )}
          </div>
          <GripVertical className="w-3.5 h-3.5 shrink-0 text-[#64748B] opacity-0 group-hover/kpihdr:opacity-100 transition-opacity duration-150 pointer-events-none" />
        </div>

        {/* Selectable by default so a figure can be copied; on a tile that acts
            as a link the whole face has to read as clickable instead. */}
        <div className={`flex flex-col gap-1 min-w-0 ${onClick ? '' : 'cursor-text select-text'}`}>
          <p className="text-[15px] text-[#334155] tracking-tight whitespace-nowrap truncate" style={{ fontWeight: 600, lineHeight: 1 }}>
            {value}
          </p>
          {/* Host change: CoA rides the detail on the value's baseline, which
              truncated the value in a narrow tile. Every tile puts it on its own
              line instead, so the value always shows in full and the tiles read
              the same (Mahad: "Do it for all, not for just one"). */}
          {subDetail && (
            <span className="text-[10px] text-[#94A3B8] whitespace-nowrap truncate">{subDetail}</span>
          )}
        </div>
      </div>

      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          onMouseDown={e => e.stopPropagation()}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
          title={`Remove ${label}`}
          aria-label={`Remove ${label}`}
        >
          <Trash2 className="w-3 h-3 text-[#94A3B8] hover:text-[#EF4444]" />
        </button>
      )}
    </div>
  )
}

/* ── Draggable widget wrapper ─────────────────────────────────────────── */

export const DND_DETAIL_WIDGET_TYPE = 'COA_DETAIL_WIDGET'

interface DraggableWidgetCardProps {
  widgetKey: string
  index: number
  moveWidget: (from: number, to: number) => void
  children: (isDragging: boolean, isOver: boolean) => ReactNode
}

export function DraggableWidgetCard({ widgetKey, index, moveWidget, children }: DraggableWidgetCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_DETAIL_WIDGET_TYPE,
    item: () => ({ key: widgetKey, index }),
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  })

  const [{ isOver }, drop] = useDrop({
    accept: DND_DETAIL_WIDGET_TYPE,
    drop(item: { key: string; index: number }) {
      if (item.index !== index) {
        moveWidget(item.index, index)
        item.index = index
      }
    },
    collect: monitor => ({ isOver: monitor.isOver() }),
  })

  preview(drop(ref))

  return (
    <div
      ref={ref}
      data-widget-idx={index}
      className={`transition-all duration-300 ease-out rounded-xl h-full ${
        isOver && !isDragging ? 'ring-2 ring-primary/20 ring-offset-2 scale-[1.005]' : ''
      }`}
      style={{
        opacity: isDragging ? 0.3 : 1,
        transform: isDragging ? 'scale(0.97) rotate(-0.5deg)' : undefined,
      }}
    >
      <WidgetDragHandleContext.Provider value={drag}>
        {children(isDragging, isOver)}
      </WidgetDragHandleContext.Provider>
    </div>
  )
}

/* ── Widget preview SVGs (customize drawer) ───────────────────────────── */

export type WidgetPreviewType = 'line' | 'area' | 'area-red' | 'bar' | 'bar-green' | 'bar-red' | 'pie' | 'list'

export function WidgetPreviewSvg({ type }: { type?: WidgetPreviewType }) {
  if (type === 'line') {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-10">
        <polyline points="5,30 20,25 35,28 50,18 65,22 80,12 95,15 115,8" fill="none" stroke="#0A77FF" strokeWidth="2" strokeLinecap="round" />
        <polyline points="5,32 20,30 35,31 50,28 65,29 80,26 95,27 115,24" fill="none" stroke="#059669" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
      </svg>
    )
  }
  if (type === 'area') {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-10">
        <defs>
          <linearGradient id="coa-mg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0A77FF" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0A77FF" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d="M5,30 20,25 35,28 50,18 65,22 80,14 95,20 115,10 115,38 5,38Z" fill="url(#coa-mg)" />
        <polyline points="5,30 20,25 35,28 50,18 65,22 80,14 95,20 115,10" fill="none" stroke="#0A77FF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (type === 'area-red') {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-10">
        <defs>
          <linearGradient id="coa-rg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d="M5,8 20,12 35,10 50,20 65,18 80,28 95,25 115,32 115,38 5,38Z" fill="url(#coa-rg)" />
        <polyline points="5,8 20,12 35,10 50,20 65,18 80,28 95,25 115,32" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (type === 'bar' || type === 'bar-green' || type === 'bar-red') {
    const heights = [18, 26, 14, 22, 30, 18, 24, 16]
    const fill = type === 'bar-green' ? '#059669' : type === 'bar-red' ? '#DC2626' : '#0A77FF'
    return (
      <svg viewBox="0 0 120 40" className="w-full h-10">
        {[5, 20, 35, 50, 65, 80, 95, 110].map((x, i) => (
          <rect key={i} x={x} y={38 - heights[i]} width="8" height={heights[i]} rx="2" fill={fill} opacity={0.55 + (i % 3) * 0.12} />
        ))}
      </svg>
    )
  }
  // For widgets whose body is ranked rows rather than a chart - a chart preview
  // over a list makes the tile promise something the widget doesn't draw.
  if (type === 'list') {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-10">
        {[4, 16, 28].map((y, i) => (
          <g key={y}>
            <rect x="5" y={y} width={34 - i * 6} height="6" rx="3" fill="#94A3B8" opacity={0.45} />
            <rect x="46" y={y} width={64 - i * 20} height="6" rx="3" fill="#0A77FF" opacity={0.75 - i * 0.18} />
          </g>
        ))}
      </svg>
    )
  }
  if (type === 'pie') {
    return (
      <svg viewBox="0 0 40 40" className="h-10 mx-auto">
        <circle cx="20" cy="20" r="14" fill="#EDF4FF" />
        <path d="M20 6 A 14 14 0 0 1 33.3 24.6 L 20 20 Z" fill="#0A77FF" />
        <path d="M33.3 24.6 A 14 14 0 0 1 14.7 33.1 L 20 20 Z" fill="#7C3AED" />
        <path d="M14.7 33.1 A 14 14 0 0 1 7.1 14.6 L 20 20 Z" fill="#D97706" />
        <circle cx="20" cy="20" r="5" fill="#FFFFFF" />
      </svg>
    )
  }
  return null
}

/* ── Widget body helpers ──────────────────────────────────────────────── */

// Shared header row for widgets that expose their own time period -
// human-readable range on the left, pills PeriodSelector on the right.
export function WidgetPeriodHeader({ period, onChange, presets, granularity = 'day' }: {
  period: PeriodValue
  onChange: (next: PeriodValue) => void
  presets: PeriodPreset[]
  granularity?: Granularity
}) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap pb-2">
      <p className="text-[11px] text-muted-foreground">{describePeriod(period, granularity)}</p>
      <PeriodSelector value={period} onChange={onChange} presets={presets} granularity={granularity} />
    </div>
  )
}

// Stat row under a widget chart - border-t, 10.5px label + 13px value.
export function WidgetStatRow({ stats, trailing, swapKey }: {
  stats: { label: string; value: ReactNode; color?: string }[]
  // Right-aligned slot for something that belongs with the stats rather than
  // with the chart above them - a hint, or a way back to what they said before.
  trailing?: ReactNode
  /* Changes when the stats start describing something else. Without it React
     rewrites the figures in place and three numbers quietly become three other
     numbers, with nothing tying the change to what the reader just clicked. */
  swapKey?: string
}) {
  const size = useWidgetSize()
  // A 140px chart has no room left for a four-stat footer, and every widget orders
  // its stats most-important-first, so the small card keeps the first two. Trimming
  // here rather than in each body means a new widget gets the behaviour for free.
  const shown = size === 'sm' ? stats.slice(0, 2) : stats
  /* A small card compacts the row as well as shortening it - Partners' own
     proportions, down to the 9px label. Trimming to two stats but leaving them
     full-size put a footer under a 140px chart that was taller than the drop in
     chart height it was supposed to make room for. */
  const compact = size === 'sm'
  return (
    <div className={`flex items-end justify-between gap-4 border-t border-[#F1F5F9] ${compact ? 'mt-1.5 pt-1.5' : 'mt-2 pt-2'}`}>
      <div className={`flex items-center flex-wrap min-w-0 ${compact ? 'gap-3' : 'gap-4'}`}>
        {shown.map((s, i) => (
          // Positional keys: a swap replaces all of them at once, and the label is
          // part of what changes, so it cannot also be the identity.
          <div key={i} className="min-w-0 overflow-hidden">
            <div key={swapKey} className={swapKey ? 'coa-stat-swap' : undefined} style={{ animationDelay: `${i * 45}ms` }}>
              <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-[#94A3B8] whitespace-nowrap`} style={{ fontWeight: 500 }}>{s.label}</p>
              <p className={`${compact ? 'text-[11px]' : 'text-[13px]'} tabular-nums`} style={{ fontWeight: 700, color: s.color ?? '#334155' }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>
      {trailing && <div className="shrink-0 pb-px">{trailing}</div>}
    </div>
  )
}

// Shared categorical rotation for the detail widgets (CM chart palette).
export const CHART_PALETTE = ['#0A77FF', '#059669', '#EA580C', '#7C3AED', '#0891B2', '#DC2626', '#F59E0B', '#BE185D']

/* ── Customize Insights drawer ────────────────────────────────────────── */

export interface DetailKpiDef {
  key: string
  label: string
  description: string
  category: string
}

export interface DetailWidgetDef {
  key: string
  label: string
  description: string
  category: string
  icon?: ElementType
  iconBg?: string
  iconColor?: string
  previewType?: WidgetPreviewType
}

interface DetailInsightsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kpis: DetailKpiDef[]
  widgets: DetailWidgetDef[]
  activeKpis: string[]
  activeWidgets: string[]
  onToggleKpi: (key: string) => void
  onToggleWidget: (key: string) => void
  onReset: () => void
  isDefault: boolean
  // Live preview value shown on each KPI tile (plain-string mirror of the
  // KPI card's headline figure).
  kpiPreview: (key: string) => string
  /** What the record is called in the drawer's subtitle: "currency", "exchange rate". */
  noun?: string
}

type PanelTab = 'kpis' | 'widgets'

export function DetailInsightsPanel({
  open, onOpenChange, kpis, widgets, activeKpis, activeWidgets,
  onToggleKpi, onToggleWidget, onReset, isDefault, kpiPreview, noun = 'currency',
}: DetailInsightsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<PanelTab>('kpis')

  const filteredKpis = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return kpis
    return kpis.filter(k =>
      k.label.toLowerCase().includes(q) ||
      k.description.toLowerCase().includes(q) ||
      k.category.toLowerCase().includes(q))
  }, [searchQuery, kpis])

  const filteredWidgets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return widgets
    return widgets.filter(w =>
      w.label.toLowerCase().includes(q) ||
      w.description.toLowerCase().includes(q) ||
      w.category.toLowerCase().includes(q))
  }, [searchQuery, widgets])

  const widgetCategories = useMemo(() => {
    const map = new Map<string, DetailWidgetDef[]>()
    for (const w of filteredWidgets) {
      if (!map.has(w.category)) map.set(w.category, [])
      map.get(w.category)!.push(w)
    }
    return Array.from(map.entries()).map(([name, items]) => ({ name, widgets: items }))
  }, [filteredWidgets])

  /* Counted against the catalogue on offer, not against the stored list. The
     catalogue narrows on a base-currency account, and a key for a withheld card
     stays stored so it returns if the account ever holds foreign currency -
     counting the stored list read more active than were ever offered. */
  const activeInCatalog = (catalog: { key: string }[], active: string[]) =>
    catalog.reduce((n, c) => (active.includes(c.key) ? n + 1 : n), 0)
  const counterLabel = activeTab === 'kpis'
    ? `${activeInCatalog(kpis, activeKpis)} of ${kpis.length} KPIs active`
    : `${activeInCatalog(widgets, activeWidgets)} of ${widgets.length} widgets active`

  const handleToggleAll = () => {
    if (activeTab === 'kpis') {
      const allKeys = kpis.map(k => k.key)
      const allActive = allKeys.every(k => activeKpis.includes(k))
      if (allActive) activeKpis.forEach(k => onToggleKpi(k))
      else allKeys.filter(k => !activeKpis.includes(k)).forEach(k => onToggleKpi(k))
    } else {
      const allKeys = widgets.map(w => w.key)
      const allActive = allKeys.every(k => activeWidgets.includes(k))
      if (allActive) activeWidgets.forEach(k => onToggleWidget(k))
      else allKeys.filter(k => !activeWidgets.includes(k)).forEach(k => onToggleWidget(k))
    }
  }

  const tabAllActive = activeTab === 'kpis'
    ? kpis.every(k => activeKpis.includes(k.key))
    : widgets.every(w => activeWidgets.includes(w.key))
  const tabNoneActive = activeTab === 'kpis' ? activeKpis.length === 0 : activeWidgets.length === 0

  /* Mount/visibility for slide animation */
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setMounted(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
      timeoutRef.current = setTimeout(() => setMounted(false), 280)
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [open])

  if (!mounted) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{
          backgroundColor: visible ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0)',
          pointerEvents: visible ? 'auto' : 'none',
          margin: 0,
        }}
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)', margin: 0 }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#EDF4FF' }}>
                <Sliders className="w-5 h-5" style={{ color: '#0A77FF' }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Customize Insights</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">Pick the KPIs and widgets you want to see for this {noun}.</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Counters row */}
          <div className="flex items-center justify-between mt-4 px-1 gap-2">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>{counterLabel}</span>
            <div className="flex items-center gap-1.5">
              {!isDefault && (
                <button
                  onClick={onReset}
                  className="flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-full border border-border bg-slate-50 text-slate-600 hover:bg-muted hover:border-slate-300 transition-all duration-200 cursor-pointer"
                  style={{ fontWeight: 500 }}
                  title="Reset to defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
              <button
                onClick={handleToggleAll}
                className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                  tabAllActive
                    ? 'bg-[#EBF3FF] border-primary/25 text-primary hover:bg-[#DCEAFF]'
                    : tabNoneActive
                      ? 'bg-slate-50 border-border text-slate-400 hover:bg-muted'
                      : 'bg-slate-50 border-border text-slate-500 hover:bg-[#EBF3FF] hover:border-primary/25 hover:text-primary'
                }`}
                style={{ fontWeight: 600 }}
              >
                {tabAllActive ? (
                  <><ToggleRight className="w-4 h-4" style={{ color: '#0A77FF' }} /><span>All On</span></>
                ) : tabNoneActive ? (
                  <><ToggleLeft className="w-4 h-4" /><span>All Off</span></>
                ) : (
                  <><ToggleLeft className="w-4 h-4" /><span>Enable All</span></>
                )}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
              <input
                placeholder="Search insights…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-white text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0 mt-3 px-1">
            {(['kpis', 'widgets'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-[12px] text-center transition-all cursor-pointer border-b-2 ${
                  activeTab === tab
                    ? 'border-[#0A77FF] text-[#0A77FF]'
                    : 'border-transparent text-[#94A3B8] hover:text-[#64748B]'
                }`}
                style={{ fontWeight: activeTab === tab ? 600 : 500 }}
              >
                {tab === 'kpis' ? 'KPIs' : 'Widgets'}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-[#F1F5F9] shrink-0" />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {activeTab === 'kpis' ? (
            <>
              {filteredKpis.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground/60">No KPIs match your search</p>
                </div>
              )}
              {/* No category headings: the KPIs sit two to a row in one grid. */}
              {filteredKpis.length > 0 && (
                <div className="mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    {filteredKpis.map(kpi => {
                      const isActive = activeKpis.includes(kpi.key)
                      return (
                        <button
                          key={kpi.key}
                          onClick={() => onToggleKpi(kpi.key)}
                          className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                            isActive
                              ? 'border-[#0A77FF]/25 bg-[#0A77FF]/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]'
                              : 'border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm'
                          }`}
                          title={kpi.description}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-[11.5px] truncate transition-colors ${isActive ? 'text-[#0A77FF]' : 'text-muted-foreground/70'}`}
                              style={{ fontWeight: 500 }}
                            >
                              {kpi.label}
                            </span>
                            <div className="shrink-0">
                              {isActive
                                ? <Check className="w-3.5 h-3.5" style={{ color: '#0A77FF' }} />
                                : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />}
                            </div>
                          </div>
                          <p
                            className={`text-[15px] mt-1 transition-colors truncate ${isActive ? 'text-foreground' : 'text-foreground/80'}`}
                            style={{ fontWeight: 600 }}
                          >
                            {kpiPreview(kpi.key)}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {widgetCategories.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground/60">No widgets match your search</p>
                </div>
              )}
              {widgetCategories.map(cat => (
                <div key={cat.name} className="mt-5 first:mt-4">
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[12px] text-muted-foreground/70" style={{ fontWeight: 600 }}>{cat.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.widgets.map(widget => {
                      const isActive = activeWidgets.includes(widget.key)
                      return (
                        <button
                          key={widget.key}
                          onClick={() => onToggleWidget(widget.key)}
                          className={`relative text-left rounded-xl border overflow-hidden transition-all duration-150 cursor-pointer group ${
                            isActive
                              ? 'border-[#0A77FF]/25 bg-[#0A77FF]/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]'
                              : 'border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm'
                          }`}
                          title={widget.description}
                        >
                          <div className={`relative px-3 pt-3 pb-1 ${isActive ? 'bg-[#EDF4FF]/50' : 'bg-[#F8FAFC]'}`}>
                            <WidgetPreviewSvg type={widget.previewType} />
                            <div className="absolute top-2 right-2">
                              {isActive ? (
                                <div className="w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-[#CBD5E1] bg-white" />
                              )}
                            </div>
                          </div>
                          <div className="px-3 py-2.5">
                            <span
                              className={`text-[12px] transition-colors block truncate ${isActive ? 'text-foreground' : 'text-foreground/80'}`}
                              style={{ fontWeight: 600 }}
                            >
                              {widget.label}
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{widget.description}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

/* ── The Dashboard tab's insights block (AccountDetail OverviewTab 699-1003) ── */

/** What a KPI tile shows. */
export interface DetailKpiFace {
  value: ReactNode
  /** Rides on the value's baseline ("As of Nov 4, 2026"). */
  subDetail?: ReactNode
  /** Makes the whole tile a link (cursor-pointer). */
  onClick?: () => void
}

const sameKeys = (a: string[], b: string[]) => a.length === b.length && a.every((k, i) => k === b[i])

/**
 * The detail dashboard's insights, as CoA's OverviewTab composes them: the
 * "Insights" header row with "+ Add Insights", the KPI tiles (drag to reorder,
 * trash to remove), the widget row (Small / Medium / Large, drag, remove), the
 * empty state, and the Customize insights drawer - all under ONE DndProvider.
 * Active keys double as the display order and persist in localStorage under
 * `storageKey` (e.g. `fx.currency.USD.insights.v1`), as CoA's do.
 */
export function DetailInsightsSection(props: {
  storageKey: string
  kpis: DetailKpiDef[]
  widgets: DetailWidgetDef[]
  /** Default to every catalogue entry, in catalogue order. */
  defaultKpis?: string[]
  defaultWidgets?: string[]
  kpiValue: (key: string) => DetailKpiFace
  /** Plain-string mirror of a tile's headline, for the drawer. */
  kpiPreview: (key: string) => string
  /** A widget's body (the card chrome is drawn for you). Read the size with useWidgetSize / useWidgetChartH. */
  renderWidget: (key: string) => ReactNode
  /** The drawer's subtitle noun ("currency", "exchange rate"). */
  noun?: string
  /** Shown between the header row and the tiles (e.g. a range bar). */
  above?: ReactNode
  /** Beside the "Insights" title, e.g. a range menu (Partners' dashboard header). */
  titleExtra?: ReactNode
}) {
  // Remount per record so a new record reads its own stored layout.
  return <DetailInsightsInner key={props.storageKey} {...props} />
}

function DetailInsightsInner({ storageKey, kpis, widgets, defaultKpis: dk, defaultWidgets: dw, kpiValue, kpiPreview, renderWidget, noun, above, titleExtra }: Parameters<typeof DetailInsightsSection>[0]) {
  const defaultKpis = useMemo(() => dk ?? kpis.map(k => k.key), [dk, kpis])
  const defaultWidgets = useMemo(() => dw ?? widgets.map(w => w.key), [dw, widgets])
  const [activeKpis, setActiveKpis] = useState<string[]>(() => readStored<string[]>(`${storageKey}.activeKpis`, defaultKpis))
  const [activeWidgets, setActiveWidgets] = useState<string[]>(() => readStored<string[]>(`${storageKey}.activeWidgets`, defaultWidgets))
  const [widgetSizes, setWidgetSizes] = useState<Record<string, WidgetSize>>(() => readStored<Record<string, WidgetSize>>(`${storageKey}.widgetSizes`, {}))
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => { try { localStorage.setItem(`${storageKey}.activeKpis`, JSON.stringify(activeKpis)) } catch { /* ignore */ } }, [activeKpis, storageKey])
  useEffect(() => { try { localStorage.setItem(`${storageKey}.activeWidgets`, JSON.stringify(activeWidgets)) } catch { /* ignore */ } }, [activeWidgets, storageKey])
  useEffect(() => { try { localStorage.setItem(`${storageKey}.widgetSizes`, JSON.stringify(widgetSizes)) } catch { /* ignore */ } }, [widgetSizes, storageKey])

  const toggleKpi = (key: string) => setActiveKpis(p => (p.includes(key) ? p.filter(k => k !== key) : [...p, key]))
  const toggleWidget = (key: string) => setActiveWidgets(p => (p.includes(key) ? p.filter(k => k !== key) : [...p, key]))
  const resetInsights = () => { setActiveKpis(defaultKpis); setActiveWidgets(defaultWidgets); setWidgetSizes({}) }
  const isDefault = sameKeys(activeKpis, defaultKpis) && sameKeys(activeWidgets, defaultWidgets) && Object.keys(widgetSizes).length === 0

  const moveKpi = (from: number, to: number) => setActiveKpis(prev => {
    const keys = prev.filter(k => kpis.some(c => c.key === k))
    const fromKey = keys[from], toKey = keys[to]
    const next = [...prev]
    const fi = next.indexOf(fromKey), ti = next.indexOf(toKey)
    if (fi === -1 || ti === -1) return prev
    const [moved] = next.splice(fi, 1)
    next.splice(ti, 0, moved)
    return next
  })
  const moveWidget = (from: number, to: number) => setActiveWidgets(prev => {
    const keys = prev.filter(k => widgets.some(w => w.key === k))
    const fromKey = keys[from], toKey = keys[to]
    const next = [...prev]
    const fi = next.indexOf(fromKey), ti = next.indexOf(toKey)
    if (fi === -1 || ti === -1) return prev
    const [moved] = next.splice(fi, 1)
    next.splice(ti, 0, moved)
    return next
  })

  const enabledKpiDefs = activeKpis.map(k => kpis.find(c => c.key === k)).filter(Boolean) as DetailKpiDef[]
  const enabledWidgetKeys = activeWidgets.filter(k => widgets.some(w => w.key === k))

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Insights</h4>
          {titleExtra}
        </div>
        <button
          onClick={() => setPanelOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] text-primary hover:bg-accent transition-colors cursor-pointer shrink-0"
          style={{ fontWeight: 500 }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Insights
        </button>
      </div>
      {above}

      {(enabledKpiDefs.length > 0 || enabledWidgetKeys.length > 0) && (
        <DndProvider backend={HTML5Backend}>
          {enabledKpiDefs.length > 0 && (
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
              {enabledKpiDefs.map((kpi, i) => {
                const { value, subDetail, onClick } = kpiValue(kpi.key)
                return (
                  <DraggableKpiCard
                    key={kpi.key}
                    index={i}
                    kpiKey={kpi.key}
                    label={kpi.label}
                    value={value}
                    subDetail={subDetail}
                    tooltip={kpi.description}
                    moveCard={moveKpi}
                    onClick={onClick}
                    onRemove={() => toggleKpi(kpi.key)}
                  />
                )
              })}
            </div>
          )}

          {/* A wrapping flex row where each card carries its own width, so a size
              change animates. Half is calc(50% - 6px) because gap-3 is 12px. */}
          {enabledWidgetKeys.length > 0 && (
            <div className="flex flex-wrap gap-3 items-stretch min-w-0">
              {enabledWidgetKeys.map((wKey, i) => {
                const meta = widgets.find(w => w.key === wKey)
                if (!meta) return null
                const sz: WidgetSize = widgetSizes[wKey] ?? 'md'
                return (
                  <div
                    key={wKey}
                    style={{ width: sz === 'lg' ? '100%' : 'calc(50% - 6px)' }}
                    className="transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] h-auto self-stretch"
                  >
                    <DraggableWidgetCard widgetKey={wKey} index={i} moveWidget={moveWidget}>
                      {(isDragging, isOver) => (
                        <WidgetContentCard
                          title={meta.label}
                          tooltip={meta.description}
                          icon={meta.icon}
                          iconBg={meta.iconBg}
                          iconColor={meta.iconColor}
                          currentSize={sz}
                          onSizeChange={s => setWidgetSizes(prev => ({ ...prev, [wKey]: s }))}
                          onRemove={() => toggleWidget(wKey)}
                          isDragging={isDragging}
                          isOver={isOver}
                        >
                          {renderWidget(wKey)}
                        </WidgetContentCard>
                      )}
                    </DraggableWidgetCard>
                  </div>
                )
              })}
            </div>
          )}
        </DndProvider>
      )}

      {enabledKpiDefs.length === 0 && enabledWidgetKeys.length === 0 && (
        <div className="border border-dashed border-border rounded-lg py-8 px-4 text-center bg-white">
          <p className="text-sm text-muted-foreground mb-2">No insights enabled.</p>
          <button
            onClick={() => setPanelOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] text-white bg-primary hover:bg-[#0862D0] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Insights
          </button>
        </div>
      )}

      <DetailInsightsPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        kpis={kpis}
        widgets={widgets}
        activeKpis={activeKpis}
        activeWidgets={activeWidgets}
        onToggleKpi={toggleKpi}
        onToggleWidget={toggleWidget}
        onReset={resetInsights}
        isDefault={isDefault}
        kpiPreview={kpiPreview}
        noun={noun}
      />
    </>
  )
}
