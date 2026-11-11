// Ported from chart-of-accounts-v2.1/src/components/CoaInsights.tsx; adapted: the CoA KPI catalogue and CoaKpiCtx are gone - PerformanceInsights, KpiInsightsPanel and the toolbar count take KPI definitions and a valueOf(key) as props; useKpiShelf added for page wiring.
import { useState, useMemo, useEffect, useRef, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode, HTMLAttributes, Ref } from 'react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import {
  Search, ChartColumn, Sliders, SlidersHorizontal, X, Check, Plus, ToggleLeft, ToggleRight,
  RefreshCw, RotateCcw, GripVertical, Trash2, Info, BarChart3,
  Wallet, DollarSign, TrendingUp, AlertTriangle, Boxes, ArrowDownUp, ArrowUpRight, Coins, Clock, Globe, Activity,
} from 'lucide-react'
import { Tooltip } from './ui'
import { cn } from '../lib/utils'
import { useRememberedState } from '../lib/rememberedState'

const DND_LIST_KPI = 'coa-list-kpi'

/* ─── KPI definition type (mirrors the Partners module) ─── */
export interface KpiDefinition {
  key: string
  label: string
  /** Groups the card in the Customize insights drawer. */
  category: string
  subtitle?: string
  /** The info icon's one-liner on the card face. */
  tooltip?: string
  /** Withheld from the shelf and the drawer (kept in the active list) when false:
   *  a card the data cannot answer is not offered rather than shown at zero. */
  available?: boolean
}

/** What a card shows. A plain string is the value alone. */
export interface KpiValue {
  value: string
  /** Sub-label on the value's baseline, naming the window the figure covers. */
  caption?: string
  /** Makes the value a link (dotted underline + arrow) that runs this. */
  onSelect?: () => void
  selectTitle?: string
}
export type KpiValueOf = (key: string) => string | KpiValue
const asValue = (v: string | KpiValue): KpiValue => (typeof v === 'string' ? { value: v } : v)

/* The active KPIs the data can actually answer, in the order they were picked.
   A withheld card is deliberately left in `activeKpis`, so it comes back when
   the data can answer it. Every shelf and every count reads this one list so
   they cannot disagree (the toolbar Insights badge, the drawer's "N of M"). */
export function activeKpiDefs(activeKpis: string[], defs: KpiDefinition[]): KpiDefinition[] {
  return activeKpis
    .map(k => defs.find(d => d.key === k))
    .filter((d): d is KpiDefinition => !!d && d.available !== false)
}

const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((k, i) => k === b[i])

/**
 * The page's KPI shelf state, as CoA's list page holds it: the active keys (which
 * double as the display order), the drawer's open flag and the "Updated" stamp.
 * `rememberAs` keeps the shelf for the session (lib/rememberedState).
 */
export function useKpiShelf(defaultKpis: string[], rememberAs?: string) {
  const [activeKpis, setActiveKpisRaw] = useRememberedState<string[]>(rememberAs, () => [...defaultKpis])
  const [panelOpen, setPanelOpen] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date())
  const setActiveKpis = (updater: (prev: string[]) => string[]) => setActiveKpisRaw(updater)
  const toggleKpi = (key: string) => setActiveKpisRaw(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))
  const reset = () => setActiveKpisRaw([...defaultKpis])
  return {
    activeKpis, setActiveKpis, toggleKpi, reset,
    isDefault: sameOrder(activeKpis, defaultKpis),
    panelOpen, setPanelOpen,
    lastRefreshed, refresh: () => setLastRefreshed(new Date()),
  }
}

/* A KPI card carries no icon. There is no symbol for a figure, so every one that
   was tried stood for the record type rather than for the figure. The category
   icons below stay, because they group a list rather than decorate a number. */
function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case 'Current Balances': return <Wallet className="w-4 h-4 text-muted-foreground" />
    case 'Last Full Month': return <TrendingUp className="w-4 h-4 text-muted-foreground" />
    case 'Performance': return <TrendingUp className="w-4 h-4 text-muted-foreground" />
    case 'Movement': return <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
    case 'Liquidity': return <Wallet className="w-4 h-4 text-muted-foreground" />
    case 'Balances': return <DollarSign className="w-4 h-4 text-muted-foreground" />
    case 'Position': return <Boxes className="w-4 h-4 text-muted-foreground" />
    case 'Risk': return <AlertTriangle className="w-4 h-4 text-muted-foreground" />
    case 'Activity': return <TrendingUp className="w-4 h-4 text-muted-foreground" />
    case 'Rates': return <Coins className="w-4 h-4 text-muted-foreground" />
    case 'Usage': return <Activity className="w-4 h-4 text-muted-foreground" />
    case 'Coverage': return <Globe className="w-4 h-4 text-muted-foreground" />
    case 'Freshness': return <Clock className="w-4 h-4 text-muted-foreground" />
    default: return <ChartColumn className="w-4 h-4 text-muted-foreground" />
  }
}

/* ─── Shared simple KPI stat card (used across the COA module) ───
   Compact card: label on top, headline value below. Drag-handle overlay is baked
   in; drag mechanics and drag-state styling are supplied by the caller via
   native/react-dnd props + className. */
export const KPI_CARD_BASE = 'border rounded-lg bg-white group relative min-w-0 transition-all duration-200 overflow-hidden'
export const KPI_CARD_RESTING = 'border-border hover:-translate-y-[1px] hover:border-[#93C5FD] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]'
export const KPI_CARD_OVER = 'border-primary/30 bg-primary/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]'

export const KpiStatCard = forwardRef<HTMLDivElement, {
  label: string
  value: ReactNode
  tooltip?: string
  // A short line under the value naming the window the figure covers. Only the
  // fixed-window cards carry one, so its absence means "as of now".
  caption?: string
  onRemove?: () => void
  // When set, the value reads as a link and activates this (e.g. Largest
  // Movement opens the account it describes).
  onSelect?: () => void
  selectTitle?: string
  // When set, only this label row is the drag handle (react-dnd connector),
  // leaving the value below text-selectable.
  dragHandleRef?: Ref<HTMLDivElement>
} & HTMLAttributes<HTMLDivElement>>(function KpiStatCard(
  { label, value, tooltip, caption, onRemove, onSelect, selectTitle, dragHandleRef, className, children, ...rest }, ref,
) {
  return (
    <div ref={ref} className={cn(KPI_CARD_BASE, className)} {...rest}>
      <div className="px-3 py-2">
        {/* Label row = drag handle */}
        <div
          ref={dragHandleRef}
          className={cn('flex items-center justify-between gap-1 mb-1 select-none', dragHandleRef && 'cursor-grab active:cursor-grabbing group/kpihdr')}
        >
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-xs text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>{label}</p>
            {tooltip && (
              <Tooltip side="bottom" content={<span className="block max-w-[220px]">{tooltip}</span>}>
                <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                  <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                </button>
              </Tooltip>
            )}
          </div>
          <GripVertical className="w-3.5 h-3.5 shrink-0 text-slate-500 opacity-0 group-hover/kpihdr:opacity-100 transition-opacity duration-150 pointer-events-none" />
        </div>
        {/* Value - navigable KPIs render as a link that opens the target. Kept
            neutral (no blue); the dotted underline + arrow signal it's openable. */}
        {/* The figure never gives: it is what the card is for. A caption too long
            to sit beside it on a narrow card wraps onto its own line instead -
            it used to keep its width and squeeze Net income and Gross profit to a
            sliver ("Year to date through September 2026" is 180px). */}
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 min-w-0">
          {onSelect ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect() }}
              title={selectTitle}
              className="group/kpival inline-flex items-baseline gap-1 text-15 text-slate-700 hover:text-slate-900 tracking-tight truncate max-w-full shrink-0 text-left transition-colors cursor-pointer"
              style={{ fontWeight: 600, lineHeight: 1.15 }}
            >
              <span className="truncate underline decoration-slate-300 decoration-dotted underline-offset-[3px] group-hover/kpival:decoration-slate-400">{value}</span>
              <ArrowUpRight className="w-3 h-3 text-slate-400 shrink-0 group-hover/kpival:text-slate-600 transition-colors" />
            </button>
          ) : (
            <p className="text-15 text-slate-700 tracking-tight whitespace-nowrap truncate max-w-full shrink-0 cursor-text select-text" style={{ fontWeight: 600, lineHeight: 1.15 }}>{value}</p>
          )}
          {/* On the value's baseline where the card is wide enough, so a stamped
              card is the same height as an unstamped one; under it where not. */}
          {caption && (
            <span className="text-10 text-slate-400 truncate max-w-full" style={{ fontWeight: 500 }} title={caption}>{caption}</span>
          )}
        </div>
      </div>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
          title={`Remove ${label}`}
        >
          <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
        </button>
      )}
      {children}
    </div>
  )
})

/* ─── Draggable on-page KPI card ─── */
export function DraggableListKpiCard({ index, kpiKey, label, value, tooltip, caption, moveCard, onRemove, onSelect, selectTitle }: {
  index: number; kpiKey: string; label: string; value: string; tooltip?: string
  caption?: string
  moveCard: (from: number, to: number) => void; onRemove?: () => void
  onSelect?: () => void; selectTitle?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_LIST_KPI,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  })

  const [{ isOver }, drop] = useDrop({
    accept: DND_LIST_KPI,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return
      const dragIndex = item.index
      const hoverIndex = index
      if (dragIndex === hoverIndex) return
      const hoverRect = ref.current.getBoundingClientRect()
      const hoverMiddleX = (hoverRect.right - hoverRect.left) / 2
      const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2
      const clientOffset = monitor.getClientOffset()
      if (!clientOffset) return
      const hoverClientX = clientOffset.x - hoverRect.left
      const hoverClientY = clientOffset.y - hoverRect.top
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY && hoverClientX < hoverMiddleX) return
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY && hoverClientX > hoverMiddleX) return
      moveCard(dragIndex, hoverIndex)
      item.index = hoverIndex
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  })

  preview(drop(ref))
  drag(headerRef)

  if (isDragging) {
    return <div ref={ref} className="rounded-lg border border-dashed border-primary/20 bg-primary/[0.02] min-h-[52px] pointer-events-none" />
  }

  return (
    <KpiStatCard
      ref={ref}
      dragHandleRef={headerRef}
      label={label}
      value={value}
      tooltip={tooltip}
      caption={caption}
      onRemove={onRemove}
      onSelect={onSelect}
      selectTitle={selectTitle}
      className={cn(isOver ? KPI_CARD_OVER : KPI_CARD_RESTING)}
    >
      {isOver && <div className="absolute inset-0 rounded-lg bg-primary/[0.02] pointer-events-none" />}
    </KpiStatCard>
  )
}

/* ─── On-page "Performance Insights" row ─── */
/* The header carries no date lens. A page read against a period names it in its
   own strip, and a second period control here only ever disagreed with it. */
export function PerformanceInsights({
  defs, valueOf, activeKpis, setActiveKpis, defaultKpis, onOpenPanel, onReset, lastRefreshed, onRefresh,
}: {
  /** The whole catalogue on offer. */
  defs: KpiDefinition[]
  /** A card's face: its value, or { value, caption, onSelect }. */
  valueOf: KpiValueOf
  activeKpis: string[]
  setActiveKpis: (updater: (prev: string[]) => string[]) => void
  /** What Reset restores; the Reset link shows only once the shelf differs. */
  defaultKpis: string[]
  onOpenPanel: () => void
  onReset: () => void
  lastRefreshed: Date
  onRefresh: () => void
}) {
  const activeDefs = useMemo(() => activeKpiDefs(activeKpis, defs), [activeKpis, defs])
  // Drag positions count rendered cards, which is a shorter list than
  // `activeKpis` whenever a card is withheld. Translating through the keys keeps
  // a drop landing on the card the user aimed at rather than on whatever happens
  // to sit at that index in the unfiltered array.
  const moveKpi = (from: number, to: number) => setActiveKpis(prev => {
    const fromIdx = prev.indexOf(activeDefs[from]?.key)
    const toIdx = prev.indexOf(activeDefs[to]?.key)
    if (fromIdx === -1 || toIdx === -1) return prev
    const next = [...prev]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    return next
  })
  const toggleKpi = (key: string) => setActiveKpis(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  const refreshedLabel = lastRefreshed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  // Reset only appears once the dashboard diverges from the default KPI set
  // (order-sensitive, since drag-to-reorder is part of the state Reset restores).
  const isDefault = sameOrder(activeKpis, defaultKpis)

  // Match Cash Management: when no KPIs are active the whole shelf is hidden.
  // Re-entry is the persistent "Insights" button in the page toolbar.
  if (activeDefs.length === 0) return null

  return (
    <div className="mb-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Performance Insights</span>
          <span className="text-slate-300">|</span>
          <span className="text-11 text-slate-400" style={{ fontWeight: 400 }}>Updated {refreshedLabel}</span>
          <button onClick={onRefresh} className="inline-flex items-center gap-1 text-11 text-primary hover:text-[#1D4ED8] transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <div className="flex items-center gap-3">
          {!isDefault && (
            <button onClick={onReset} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          <button onClick={onOpenPanel} className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-[#0862D0] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
            <SlidersHorizontal className="w-3 h-3" /> Customize Insights
          </button>
        </div>
      </div>

      {/* Draggable responsive grid */}
      <DndProvider backend={HTML5Backend}>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
          {activeDefs.map((kpi, idx) => {
            const v = asValue(valueOf(kpi.key))
            return (
              <DraggableListKpiCard
                key={kpi.key}
                index={idx}
                kpiKey={kpi.key}
                label={kpi.label}
                value={v.value}
                tooltip={kpi.tooltip}
                caption={v.caption}
                moveCard={moveKpi}
                onRemove={() => toggleKpi(kpi.key)}
                onSelect={v.onSelect}
                selectTitle={v.selectTitle ?? (v.onSelect ? `Open ${v.value}` : undefined)}
              />
            )
          })}
        </div>
      </DndProvider>
    </div>
  )
}

/* ─── Insights drawer (generic KPI toggle panel) ─── */
export interface InsightsPanelItem {
  key: string
  label: string
  category: string
  value: string
}

export function InsightsPanel({
  open, onOpenChange, items, activeKeys, onToggle, onReset, isDefault,
  title = 'Insights', subtitle = 'Manage your dashboard KPIs.',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: InsightsPanelItem[]
  activeKeys: string[]
  onToggle: (key: string) => void
  // When provided, a "Reset" pill appears (hidden once already at defaults),
  // matching the Cash Management customize panel.
  onReset?: () => void
  isDefault?: boolean
  title?: string
  subtitle?: string
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const categories = useMemo(() => {
    const catMap = new Map<string, InsightsPanelItem[]>()
    for (const kpi of items) {
      const matches = !searchQuery ||
        kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kpi.category.toLowerCase().includes(searchQuery.toLowerCase())
      if (matches) {
        if (!catMap.has(kpi.category)) catMap.set(kpi.category, [])
        catMap.get(kpi.category)!.push(kpi)
      }
    }
    const cats: { name: string; kpis: InsightsPanelItem[] }[] = []
    catMap.forEach((kpis, name) => cats.push({ name, kpis }))
    return cats
  }, [searchQuery, items])

  // Counted against what is on offer rather than against the stored list, which
  // can hold keys for cards this chart has no accounts to answer.
  const activeCount = items.reduce((n, i) => (activeKeys.includes(i.key) ? n + 1 : n), 0)
  const allActive = items.length > 0 && items.every(k => activeKeys.includes(k.key))

  /* Smooth mount / unmount */
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setMounted(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      requestAnimationFrame(() => { requestAnimationFrame(() => setVisible(true)) })
    } else {
      setVisible(false)
      timeoutRef.current = setTimeout(() => setMounted(false), 280)
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [open])

  if (!mounted) return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{ backgroundColor: visible ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0)', pointerEvents: visible ? 'auto' : 'none' }}
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'hsl(var(--accent))' }}>
                <Sliders className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>{title}</h2>
                <p className="text-13 text-muted-foreground mt-0.5">{subtitle}</p>
              </div>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {/* Toggle all */}
          <div className="flex items-center justify-between mt-4 px-1 gap-2">
            <span className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>{activeCount} of {items.length} KPIs active</span>
            <div className="flex items-center gap-1.5">
              {onReset && !isDefault && (
                <button
                  onClick={onReset}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-border bg-slate-50 text-slate-600 hover:bg-muted hover:border-slate-300 transition-all duration-200 cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (allActive) activeKeys.forEach(k => onToggle(k))
                  else items.map(k => k.key).filter(k => !activeKeys.includes(k)).forEach(k => onToggle(k))
                }}
                className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer',
                  allActive
                    ? 'bg-[#EBF3FF] border-primary/25 text-primary hover:bg-[#DBEAFE] hover:border-primary/40 shadow-sm shadow-primary/10'
                    : activeKeys.length === 0
                    ? 'bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500'
                    : 'bg-slate-50 border-border text-slate-500 hover:bg-[#EBF3FF] hover:border-primary/25 hover:text-primary')}
                style={{ fontWeight: 600 }}
              >
                {allActive ? (<><ToggleRight className="w-4 h-4 text-primary" /><span>All On</span></>)
                  : activeKeys.length === 0 ? (<><ToggleLeft className="w-4 h-4" /><span>All Off</span></>)
                  : (<><ToggleLeft className="w-4 h-4" /><span>Enable All</span></>)}
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-3.5 pb-0 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input
              placeholder="Search metrics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-white text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
            />
          </div>
        </div>

        <div className="border-b border-muted mt-3 shrink-0" />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin">
          {categories.length === 0 && (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground/60">No metrics found</p>
            </div>
          )}
          {categories.map((cat) => (
            <div key={cat.name} className="mt-5 first:mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <CategoryIcon category={cat.name} />
                <span className="text-xs text-muted-foreground/70" style={{ fontWeight: 600 }}>{cat.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {cat.kpis.map((kpi) => {
                  const isActive = activeKeys.includes(kpi.key)
                  const value = kpi.value
                  return (
                    <button
                      key={kpi.key}
                      onClick={() => onToggle(kpi.key)}
                      className={cn('relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group',
                        isActive
                          ? 'border-primary/25 bg-primary/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]'
                          : 'border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm')}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn('text-xs truncate transition-colors', isActive ? 'text-primary' : 'text-muted-foreground/70')} style={{ fontWeight: 500 }} title={kpi.label}>{kpi.label}</span>
                        <div className="shrink-0">
                          {isActive ? <Check className="w-3.5 h-3.5" style={{ color: 'hsl(var(--primary))' }} />
                            : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />}
                        </div>
                      </div>
                      <p className={cn('text-15 mt-1 transition-colors', isActive ? 'text-foreground' : 'text-foreground/80')} style={{ fontWeight: 550 }}>{value}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body,
  )
}

/* The listing's KPI drawer - feeds the generic panel with live computed values.
   Same withholding rule as the shelf: a KPI the data cannot answer is not
   offered, so the panel never lists a card that would render blank. */
export function KpiInsightsPanel({ open, onOpenChange, defs, valueOf, activeKpis, onToggleKpi, onReset, defaultKpis, title, subtitle }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defs: KpiDefinition[]
  valueOf: KpiValueOf
  activeKpis: string[]
  onToggleKpi: (key: string) => void
  onReset?: () => void
  defaultKpis: string[]
  title?: string
  subtitle?: string
}) {
  const items = useMemo<InsightsPanelItem[]>(
    () => defs
      .filter(k => k.available !== false)
      .map(k => ({ key: k.key, label: k.label, category: k.category, value: asValue(valueOf(k.key)).value })),
    [defs, valueOf],
  )
  return (
    <InsightsPanel open={open} onOpenChange={onOpenChange} items={items} activeKeys={activeKpis} onToggle={onToggleKpi} onReset={onReset} isDefault={sameOrder(activeKpis, defaultKpis)} title={title} subtitle={subtitle} />
  )
}

/** The toolbar's Insights button (CoA ChartOfAccounts.tsx 829-840): opens the KPI
 *  drawer, badge = the cards actually on the shelf. */
export function InsightsToolbarButton({ open, onClick, count }: { open: boolean; onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn('inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-xs transition-colors text-sm',
        open ? 'border-primary/30 bg-primary/[0.04] text-fg' : 'border-border bg-white text-fg hover:bg-bg-subtle')}
      style={{ fontWeight: 500 }}
    >
      <BarChart3 className="w-[18px] h-[18px] text-muted-foreground/80" />
      <span className="hidden md:inline">Insights</span>
      {/* The cards actually on the shelf, so the badge and the drawer's own
          counter cannot report two different numbers. */}
      <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-11 font-semibold bg-accent text-primary">{count}</span>
    </button>
  )
}
