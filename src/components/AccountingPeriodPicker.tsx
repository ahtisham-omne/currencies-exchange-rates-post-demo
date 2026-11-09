import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { RangeMonthPane, weeksIn } from './DateField'
import { FILTER_INPUT_CLS } from './AccountTable'
import { cn, todayIso } from '../lib/utils'
import {
  buildPeriodChoices, choiceKey, defaultPeriodSelection, resolvePeriodSelection,
  type PeriodChoice, type PeriodScope, type PeriodSelection, type ResolvedPeriod,
} from '../lib/periodSelection'
import { fiscalYearName } from '../lib/periodClose'
import type { FiscalYearNaming, Period, PeriodStatus } from '../types'

// The accounting-period picker. One control, shared by every surface that states
// a period, so a reader who learns it once knows it everywhere.
//
// Named for the accounting period on purpose: `PeriodSelector` in DetailInsights
// is a different thing (a lookback window over the charts), and the two sitting
// inches apart on the account detail page is exactly the confusion this module's
// copy works to prevent.
//
// Deliberately built as a sibling of `PeriodRangePicker` in DateField, down to
// the rail width, panel chrome and footer buttons, and it borrows that picker's
// own calendar pane rather than a second one. Those two controls appear together
// on the account detail page, so a visual difference between them would read as
// a difference in meaning. The list rows follow the Partners dropdown recipe
// (subtle `bg-primary/5` for the committed row) so the rail's stronger `bg-accent`
// stays unambiguously "which panel you are looking at".

// Each hint says how much time the choice covers, in the same shape, so the four
// read as one set. They answer "what will I be looking at", which is the only
// question open at this point - not how the figures are arrived at.
const SCOPES: { scope: PeriodScope; label: string; title: string; hint: string }[] = [
  { scope: 'month', label: 'Month', title: 'Accounting periods', hint: 'Show one month.' },
  { scope: 'quarter', label: 'Quarter', title: 'Quarters', hint: 'Show three months together.' },
  { scope: 'year', label: 'Fiscal year', title: 'Fiscal years', hint: 'Show the whole fiscal year.' },
  // The odd one out on purpose: this pane is a two-step calendar, so its hint is
  // the first instruction and hands over to "Pick the end date." mid-range.
  { scope: 'custom', label: 'Custom', title: 'Custom period', hint: 'Pick a start and end date.' },
]

// Long lists get a search field, matching the Partners threshold. Quarters and
// fiscal years stay short enough that a search box would be noise.
const SEARCH_THRESHOLD = 8

export const PERIOD_STATUS_TONE = { 'Open': 'success', 'Soft-Closed': 'warning', 'Hard-Locked': 'neutral' } as const

const STATUS_DOT: Record<PeriodStatus, string> = {
  'Open': 'bg-success-500',
  'Soft-Closed': 'bg-warning-500',
  'Hard-Locked': 'bg-fg-subtle',
}

const RAIL_W = 176
// Wide enough that the busiest row - dot, label, "Current", date range - sits
// comfortably without truncating. Rows still degrade gracefully if a label ever
// outgrows it.
const LIST_PANEL_W = RAIL_W + 320
const CUSTOM_PANEL_W = RAIL_W + 596
const PANEL_FALLBACK_H = 400

export function AccountingPeriodPicker({ value, resolved, onChange, periods, fiscalYearStart, fiscalYearNaming, triggerLabel }: {
  value: PeriodSelection
  /** The already-resolved selection, so the trigger and the strip can't disagree. */
  resolved: ResolvedPeriod
  onChange: (next: PeriodSelection) => void
  periods: Period[]
  fiscalYearStart: string
  /** Which calendar year names a mid-year fiscal year, so every row in this list
      calls it what the rest of the app calls it. */
  fiscalYearNaming?: FiscalYearNaming
  /** What the trigger reads, where a page words the period its own way. */
  triggerLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<PeriodScope>(value.scope)
  const [search, setSearch] = useState('')
  /* Which fiscal year the month and quarter lists are showing, once the reader
     has said. Null means "the one the committed selection is in", so the panel
     always opens on the year in force rather than on a remembered one. */
  const [fyPick, setFyPick] = useState<number | null>(null)
  const [fyOpen, setFyOpen] = useState(false)
  // Draft custom range. Applied on Apply, dropped when the panel closes.
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [anchor, setAnchor] = useState(() => new Date())
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selectedRowRef = useRef<HTMLButtonElement>(null)
  // Null until measured. The panel has to be in the DOM to have a height, so the
  // first render is a hidden one; keeping that state explicit means the open
  // animation can wait for it instead of playing from the top-left corner.
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null)

  const today = todayIso()
  const choices = useMemo(
    () => buildPeriodChoices(periods, fiscalYearStart, today, fiscalYearNaming),
    [periods, fiscalYearStart, today, fiscalYearNaming])
  const selectedKey = choiceKey(value)
  // What Reset goes back to, and what the trigger treats as "not narrowed".
  const defaultSelection = defaultPeriodSelection(periods, fiscalYearStart, today)
  const isDefault = selectedKey === choiceKey(defaultSelection)
  const defaultLabel = resolvePeriodSelection(defaultSelection, periods, fiscalYearStart, today, fiscalYearNaming).label
  const panelW = scope === 'custom' ? CUSTOM_PANEL_W : LIST_PANEL_W

  // Reopen on the scope the committed selection belongs to, seeded with its dates
  // when that selection is a custom range, so reopening shows what is in force
  // rather than an empty calendar.
  useEffect(() => {
    if (!open) return
    setScope(value.scope)
    setSearch('')
    setFyPick(null)
    setFyOpen(false)
    const seedFrom = value.scope === 'custom' ? value.from : ''
    setFrom(seedFrom)
    setTo(value.scope === 'custom' ? value.to : '')
    // Show the range start (or the period in force) in the LEFT pane.
    const focus = new Date(`${seedFrom || resolved.startDate || today}T00:00:00`)
    setAnchor(new Date(focus.getFullYear(), focus.getMonth(), 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) { setPos(null); return }
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const h = popRef.current?.offsetHeight ?? PANEL_FALLBACK_H
      const left = Math.max(8, Math.min(r.left, window.innerWidth - panelW - 8))
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
  }, [open, panelW, scope, anchor])

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

  const commit = (next: PeriodSelection) => { onChange(next); setOpen(false) }

  const active = SCOPES.find(s => s.scope === scope)
  const pool: PeriodChoice[] = scope === 'month' || scope === 'quarter' || scope === 'year' ? choices[scope] : []

  /* Two of the four panes list spans a fiscal year divides into - twelve months,
     four quarters - and the tenant carries three years, so left whole they are
     thirty-odd rows in which the reader scrolls past two Marches to reach a
     third. The year comes out of the rows and is asked once, above them: Mahad,
     *"only the month names ... should be displayed without unnecessary extra
     labels"*, and a Fiscal Year dropdown *"on the top-right corner"*.

     The fiscal-year pane is not one of them - a year is the thing being listed
     there - and Custom is a calendar. */
  const byFiscalYear = scope === 'month' || scope === 'quarter'
  const fyOptions = useMemo(
    () => [...new Set(choices.month.map(c => c.fiscalYear))].sort((a, b) => b - a),
    [choices])
  /* The year in force. Read off the committed selection so that opening the panel
     shows the list the reader is already looking at, and falling back to the
     newest - which is the year holding the period being posted into. */
  const fy = fyPick ?? [...choices.month, ...choices.quarter].find(c => c.key === selectedKey)?.fiscalYear
    ?? fyOptions[0]
  const all = byFiscalYear ? pool.filter(c => c.fiscalYear === fy) : pool

  const q = search.trim().toLowerCase()
  // Searched on both names, so "March" finds the row now labelled "March" and
  // "Mar FY2026" still finds it for a reader typing what the chip says.
  const listed = q ? all.filter(c => `${c.label} ${c.shortLabel} ${c.range}`.toLowerCase().includes(q)) : all
  /* Which row the list opens on. The committed selection when this pane holds it,
     and otherwise today's - a reader who has a month selected and steps across to
     Quarter has chosen nothing here yet, and the quarter they are in is the one
     they are looking for. */
  const openOn = listed.some(c => c.key === selectedKey) ? selectedKey : listed.find(c => c.current)?.key

  /* Open the list on the period in force rather than at the top of it. A fiscal
     year is twelve rows and the one the reader is looking at is usually the last
     of them; left alone the panel opens on the first month of the year and the
     current one is a scroll away. Centred rather than scrolled-to-top so the
     months either side stay visible, which is what a reader stepping back a month
     is reaching for.

     Scrolled by measuring both rects instead of `scrollIntoView`, which would also
     scroll the page behind the panel. */
  useEffect(() => {
    if (!open) return
    const list = listRef.current
    if (!list) return
    const row = selectedRowRef.current
    // A year the reader has stepped to holds neither their selection nor today's
    // period, so there is no row to centre on and the list starts at its first
    // month rather than wherever the year before it happened to be scrolled.
    if (!row) { list.scrollTop = 0; return }
    list.scrollTop += row.getBoundingClientRect().top - list.getBoundingClientRect().top
      - (list.clientHeight - row.offsetHeight) / 2
  }, [open, scope, fy])

  // First click sets the start, second closes the range; clicking before the
  // start (or after a complete range) restarts from that day.
  const pick = (iso: string) => {
    if (!from || (from && to) || iso < from) { setFrom(iso); setTo(''); return }
    setTo(iso)
  }
  const next = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
  const weeks = Math.max(weeksIn(anchor), weeksIn(next))
  const draft = from && to
    ? resolvePeriodSelection({ scope: 'custom', from, to }, periods, fiscalYearStart, today, fiscalYearNaming)
    : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Change accounting period"
        className={cn('inline-flex items-center gap-1 h-[22px] px-1.5 -mx-0.5 rounded-md text-13 transition-colors cursor-pointer',
          // Tints while open, and stays tinted whenever it holds something other
          // than the default period - the Partners filter-chip behaviour, so a
          // narrowed view is visible without reading the label.
          open || !isDefault ? 'bg-accent text-primary' : 'text-fg hover:bg-white hover:shadow-xs')}
        style={{ fontWeight: 600 }}
      >
        <span className="whitespace-nowrap">{triggerLabel ?? resolved.label}</span>
        <ChevronDown size={12} className={cn('shrink-0 opacity-60 transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            zIndex: 90,
            width: panelW,
            // The scale is anchored to the corner nearest the trigger, so the panel
            // reads as unfolding from the control rather than swelling in place.
            transformOrigin: pos?.flip ? 'bottom left' : 'top left',
            // Hidden, not unmounted, for the one frame before it has been measured:
            // it needs a height in the DOM to know whether it fits below the trigger.
            visibility: pos ? undefined : 'hidden',
          }}
          className={cn('max-w-[calc(100vw-16px)] bg-white border border-border rounded-xl shadow-lg overflow-hidden',
            // Only once placed, so the animation plays from the resting position
            // instead of travelling in from the top-left of the viewport.
            pos && (pos.flip ? 'animate-popover-up' : 'animate-popover-down'),
            'motion-reduce:animate-none')}
        >
          <div className="flex items-stretch">
            {/* Left rail: the kind of span. Choosing a kind only swaps the right
                panel; nothing is applied until a span itself is chosen. */}
            <div className="shrink-0 border-r border-border p-2 space-y-0.5" style={{ width: RAIL_W }}>
              {SCOPES.map(s => {
                const on = scope === s.scope
                return (
                  <button
                    key={s.scope}
                    type="button"
                    onClick={() => setScope(s.scope)}
                    className={cn('w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors cursor-pointer',
                      on ? 'bg-accent text-primary' : 'text-fg hover:bg-bg-subtle')}
                    style={{ fontWeight: on ? 500 : 400 }}
                  >
                    <span className="truncate">{s.label}</span>
                    {value.scope === s.scope && <Check size={15} className="shrink-0" />}
                  </button>
                )
              })}
            </div>

            <div className="flex-1 min-w-0 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-fg" style={{ fontWeight: 600 }}>{active?.title}</div>
                  <div className="text-11 text-fg-muted mt-0.5">
                    {scope === 'custom'
                      // Deliberately the period count, not the status: a hand-picked
                      // range routinely straddles a close, so naming one status here
                      // would be wrong and "Mixed" would be noise.
                      ? draft
                        ? `${draft.range} · covers ${draft.periods.length} ${draft.periods.length === 1 ? 'period' : 'periods'}`
                        : from ? 'Pick the end date.' : active?.hint
                      : active?.hint}
                  </div>
                </div>

                {/* Which year the list below is showing. Opposite the title, so it
                    reads as the heading of the list rather than as one more thing
                    to choose among the rows. Opens inside the panel rather than
                    through a portal - three rows fit under it with room to
                    spare, and a portal here would be a second thing to place and
                    dismiss over one that is already placed. */}
                {byFiscalYear && fyOptions.length > 1 && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setFyOpen(o => !o)}
                      aria-label="Change fiscal year"
                      className={cn('inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-lg border text-13 transition-colors cursor-pointer',
                        fyOpen ? 'border-primary/30 bg-accent text-primary' : 'border-border bg-white text-fg hover:bg-bg-subtle')}
                      style={{ fontWeight: 500 }}
                    >
                      {fiscalYearName(fy, fiscalYearStart, fiscalYearNaming)}
                      <ChevronDown size={12} className={cn('shrink-0 opacity-60 transition-transform duration-150', fyOpen && 'rotate-180')} />
                    </button>
                    {fyOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setFyOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 z-20 min-w-[128px] bg-white border border-border rounded-lg shadow-lg p-1 animate-popover-down motion-reduce:animate-none">
                          {fyOptions.map(y => (
                            <button
                              key={y}
                              type="button"
                              onClick={() => { setFyPick(y); setFyOpen(false) }}
                              className={cn('w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-left text-13 transition-colors cursor-pointer',
                                y === fy ? 'bg-primary/5 text-primary' : 'text-fg hover:bg-muted/50')}
                              style={{ fontWeight: y === fy ? 500 : 400 }}
                            >
                              {fiscalYearName(y, fiscalYearStart, fiscalYearNaming)}
                              {y === fy && <Check size={14} className="shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {scope === 'custom' ? (
                <div className="grid grid-cols-2 gap-8">
                  <RangeMonthPane
                    base={anchor} weeks={weeks} from={from} to={to} todayIso={today} onPick={pick}
                    onSet={setAnchor}
                    onPrev={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
                  />
                  <RangeMonthPane
                    base={next} weeks={weeks} from={from} to={to} todayIso={today} onPick={pick}
                    // The right pane trails the left by a month, so jumping it
                    // moves the shared anchor back one to keep the pair in step.
                    onSet={d => setAnchor(new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                    onNext={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
                  />
                </div>
              ) : (
                <>
                  {all.length > SEARCH_THRESHOLD && (
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                      <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search periods…"
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
                  <div ref={listRef} className="max-h-[264px] overflow-y-auto overscroll-contain scrollbar-thin -mx-1 px-1 py-0.5 space-y-0.5">
                    {listed.length === 0 && (
                      <div className="px-3 py-4 text-center text-13 text-muted-foreground">
                        {all.length === 0 ? 'No periods are defined yet.' : 'No periods match your search.'}
                      </div>
                    )}
                    {listed.map(c => {
                      const on = c.key === selectedKey
                      return (
                        <button
                          key={c.key}
                          ref={c.key === openOn ? selectedRowRef : undefined}
                          type="button"
                          onClick={() => commit(c.selection)}
                          className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-13 transition-colors cursor-pointer',
                            on ? 'bg-primary/5' : 'hover:bg-muted/50')}
                        >
                          <span className={cn('w-2 h-2 rounded-full shrink-0', c.status ? STATUS_DOT[c.status] : 'bg-border')} />
                          {/* The one flexible cell: a long label truncates rather
                              than pushing the range and status out of the pane. */}
                          <span className={cn('truncate min-w-0', on ? 'text-primary' : 'text-fg')} style={{ fontWeight: on ? 500 : 400 }}>
                            {byFiscalYear ? c.shortLabel : c.label}
                          </span>
                          {c.current && (
                            <span className="text-10 text-primary bg-accent rounded px-1.5 py-0.5 shrink-0" style={{ fontWeight: 500 }}>
                              Current
                            </span>
                          )}
                          <span className="text-11 text-muted-foreground tabular-nums ml-auto shrink-0">{c.range}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* One footer for every pane. Its left slot used to restate the
                  drafted range, which the subtitle above already says; it carries
                  the way back out instead. Reset belongs on the list panes too, not
                  just the calendar - a reader who has walked back to an earlier
                  quarter needs one click home, and only the month list happens to
                  mark the period they started on. */}
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isDefault}
                  onClick={() => commit(defaultSelection)}
                  title={`Read every figure against ${defaultLabel} again`}
                  className="h-9 px-3 -ml-3 rounded-lg text-13 text-fg-muted hover:text-fg hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg-muted transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >Reset to current period</button>
                {scope === 'custom' && (
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
                      onClick={() => commit({ scope: 'custom', from, to })}
                      className="h-9 px-4 rounded-lg bg-primary text-white text-13 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      style={{ fontWeight: 500 }}
                    >Apply</button>
                  </div>
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
