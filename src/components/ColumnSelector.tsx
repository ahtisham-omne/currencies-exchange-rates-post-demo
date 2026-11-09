import { useState, useRef, useMemo, useCallback, useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Search, GripVertical, Columns3, X, Lock, Eye, EyeOff, RotateCcw, Snowflake } from 'lucide-react'
import { Tooltip } from './ui'
import { cn } from '../lib/utils'
import { ConfigureVisualButton, VisualConfigView, type VisualOffers, type VisualValues } from './tableLook'

// Ported from the Partner Management "ColumnSelector", a docked inline side
// drawer (the table shrinks beside it) with a header + count, search, Show All /
// Hide All / Reset, a Pinned section, blue eye-in-square visibility toggles, and
// pointer-based drag-to-reorder with live preview + edge auto-scroll.
//
// Configure Visuals stands above Pinned and pushes a second screen in over the
// column list, mobile-stack style, rather than opening a drawer of its own: it
// is a decision about the same table, made in the same place.
export interface ColSpec { key: string; label: string }

// Auto-scroll: how close (px) to a list edge before scrolling kicks in, and the
// peak per-frame scroll speed at the very edge.
const AUTO_SCROLL_ZONE = 40
const AUTO_SCROLL_MAX_SPEED = 12

/* Forward (dir 1): the new screen enters from the right, the old slides a third
   of the way left and fades. Back (dir -1): mirrored. */
const SCREEN_VARIANTS = {
  enter: (dir: 1 | -1) => ({ x: dir === 1 ? '100%' : '-30%', opacity: dir === 1 ? 1 : 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: 1 | -1) => ({ x: dir === 1 ? '-30%' : '100%', opacity: dir === 1 ? 0 : 1 }),
}
const SCREEN_TRANSITION = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }

export function ColumnSelector({
  columns, columnOrder, columnVisibility, onColumnOrderChange, onColumnVisibilityChange,
  lockedColumns = [], requiredColumns = [], frozenColumns, onToggleFreeze, canFreeze, open, onOpenChange, visual, defaults,
}: {
  columns: ColSpec[]
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  onColumnOrderChange: (order: string[]) => void
  onColumnVisibilityChange: (vis: Record<string, boolean>) => void
  lockedColumns?: string[]
  /** Always shown but still movable: the eye cannot turn them off, and they
   *  stay in the list where the reader put them rather than joining Pinned. */
  requiredColumns?: string[]
  /* Freeze, offered here as well as in each column's header menu. Design review,
     2026-09-24 - Nophil: *"The column picker itself should have the freeze
     function there."* Omit `onToggleFreeze` and no row offers it. */
  frozenColumns?: string[]
  onToggleFreeze?: (key: string) => void
  /** Whether a column may be frozen; one the table already holds at an edge may not. */
  canFreeze?: (key: string) => boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  /* What the table opens on: which columns show and in what order. Reset puts
     the table back to it. Without it Reset could only guess, and turned every
     column on - Mahad, 2026-10-01: *"reset button in the columns config is not
     working, it should make the table with default columns."* */
  defaults?: { visibility: Record<string, boolean>; order: string[] }
  /** Omit it and the panel is the plain column list it has always been. */
  visual?: {
    values: VisualValues
    offers: VisualOffers
    onToggle: (k: keyof VisualValues) => void
  }
}) {
  const [q, setQ] = useState('')
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  // While dragging we reorder a local copy so the list reflows live; on drop we
  // commit it to the parent. Null when not dragging (parent order is source).
  const [liveOrder, setLiveOrder] = useState<string[] | null>(null)

  /* Which of the two screens is showing, and which way the next swap travels.
     The direction is fixed at the moment the screen changes so the outgoing
     screen's exit reads it too. */
  const [configOpen, setConfigOpen] = useState(false)
  const prevConfig = useRef(configOpen)
  const dirRef = useRef<1 | -1>(1)
  if (prevConfig.current !== configOpen) { dirRef.current = configOpen ? 1 : -1; prevConfig.current = configOpen }
  const dir = dirRef.current
  // Closing the drawer closes the second screen with it, so reopening lands on
  // the column list rather than wherever it was left.
  useEffect(() => { if (!open) setConfigOpen(false) }, [open])

  const listRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const liveOrderRef = useRef<string[] | null>(null)
  const draggingKeyRef = useRef<string | null>(null)
  const autoScrollRaf = useRef<number | null>(null)
  const pointerYRef = useRef<number>(0)
  liveOrderRef.current = liveOrder
  draggingKeyRef.current = draggingKey

  // Stable refs so the pointer handlers (created once) always read fresh values.
  const lockedRef = useRef(lockedColumns); lockedRef.current = lockedColumns
  const qRef = useRef(q); qRef.current = q
  const columnsRef = useRef(columns); columnsRef.current = columns
  const onOrderRef = useRef(onColumnOrderChange); onOrderRef.current = onColumnOrderChange

  const visibleCount = columns.filter(c => columnVisibility[c.key] !== false).length
  const total = columns.length
  const currentOrder = liveOrder ?? columnOrder
  const ordered = currentOrder.map(k => columns.find(c => c.key === k)).filter(Boolean) as ColSpec[]
  const pinned = useMemo(() => ordered.filter(c => lockedColumns.includes(c.key)), [ordered, lockedColumns])
  const match = (l: string) => l.toLowerCase().includes(q.trim().toLowerCase())
  const reorderable = ordered.filter(c => !lockedColumns.includes(c.key) && match(c.label))

  const setVis = (key: string, on: boolean) => {
    if (lockedColumns.includes(key) || requiredColumns.includes(key)) return
    onColumnVisibilityChange({ ...columnVisibility, [key]: on })
  }
  const showAll = () => { const v = { ...columnVisibility }; columns.forEach(c => { v[c.key] = true }); onColumnVisibilityChange(v) }
  const hideAll = () => { const v = { ...columnVisibility }; columns.forEach(c => { if (!lockedColumns.includes(c.key) && !requiredColumns.includes(c.key)) v[c.key] = false }); onColumnVisibilityChange(v) }
  /* The table as it opens: its default columns, in its default order, nothing
     frozen - no table opens with a column frozen. A host that gives no defaults
     falls back to every column, in the panel's order. */
  const reset = () => {
    const v = { ...columnVisibility }
    columns.forEach(c => { v[c.key] = defaults ? (defaults.visibility[c.key] ?? false) : true })
    onColumnVisibilityChange(v)
    onColumnOrderChange(defaults ? defaults.order : columns.map(c => c.key))
    frozenColumns?.forEach(k => onToggleFreeze?.(k))
    setLiveOrder(null)
  }

  // rAF loop: while dragging, nudge the list scroll when the pointer nears an edge.
  const startAutoScroll = useCallback(() => {
    const tick = () => {
      const listEl = listRef.current
      if (!listEl || !draggingKeyRef.current) { autoScrollRaf.current = null; return }
      const rect = listEl.getBoundingClientRect()
      const y = pointerYRef.current
      const distTop = y - rect.top
      const distBottom = rect.bottom - y
      if (distTop < AUTO_SCROLL_ZONE && distTop > 0) {
        listEl.scrollTop -= Math.round(AUTO_SCROLL_MAX_SPEED * (1 - distTop / AUTO_SCROLL_ZONE))
      } else if (distBottom < AUTO_SCROLL_ZONE && distBottom > 0) {
        listEl.scrollTop += Math.round(AUTO_SCROLL_MAX_SPEED * (1 - distBottom / AUTO_SCROLL_ZONE))
      }
      autoScrollRaf.current = requestAnimationFrame(tick)
    }
    if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current)
    autoScrollRaf.current = requestAnimationFrame(tick)
  }, [])
  const stopAutoScroll = useCallback(() => {
    if (autoScrollRaf.current) { cancelAnimationFrame(autoScrollRaf.current); autoScrollRaf.current = null }
  }, [])

  // Move the dragged key to wherever the pointer sits (based on row midpoints),
  // keeping locked columns pinned at the front.
  const performReorder = useCallback((clientY: number) => {
    const listEl = listRef.current
    const currentKey = draggingKeyRef.current
    if (!listEl || !currentKey) return
    const rows = Array.from(listEl.querySelectorAll<HTMLElement>('[data-col-key]'))
    let targetIdx = -1
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect()
      if (clientY < r.top + r.height / 2) { targetIdx = i; break }
    }
    if (targetIdx === -1) targetIdx = rows.length - 1

    setLiveOrder(prev => {
      if (!prev) return prev
      const locked = lockedRef.current
      const reorderableKeys = prev.filter(k => !locked.includes(k))
      const lockedKeys = prev.filter(k => locked.includes(k))
      const clamped = Math.max(0, Math.min(targetIdx, reorderableKeys.length - 1))
      const fromIdx = reorderableKeys.indexOf(currentKey)
      if (fromIdx === -1 || fromIdx === clamped) return prev
      const next = [...reorderableKeys]
      next.splice(fromIdx, 1)
      next.splice(clamped, 0, currentKey)
      return [...lockedKeys, ...next]
    })
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent, key: string) => {
    if (qRef.current) return // no reordering while filtering
    e.preventDefault(); e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDraggingKey(key)
    setLiveOrder(columnOrder)
    pointerYRef.current = e.clientY
    startAutoScroll()

    const onMove = (ev: PointerEvent) => { pointerYRef.current = ev.clientY; performReorder(ev.clientY) }
    const onUp = () => {
      const finalOrder = liveOrderRef.current
      if (finalOrder) onOrderRef.current(finalOrder)
      setDraggingKey(null); setLiveOrder(null); stopAutoScroll()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [columnOrder, startAutoScroll, stopAutoScroll, performReorder])

  return (
    <div
      className="self-stretch bg-white flex flex-col shrink-0 overflow-hidden"
      /* The drawer opens by widening, so the table beside it reflows into the
         room being taken rather than being covered. The fade is shorter than
         the slide so the contents are readable before the width has settled. */
      style={{
        width: open ? 300 : 0,
        minWidth: open ? 300 : 0,
        /* It stretches to the table beside it, and a table a search has cut to one
           row would cut it to its header - Mahad, 2026-10-01: *"When I search
           something and the column configurator gets cut off."* So it keeps room
           for its list while open, and a short table makes room for it rather
           than clipping it. */
        minHeight: open ? 480 : 0,
        opacity: open ? 1 : 0,
        borderLeftWidth: open ? 1 : 0,
        borderLeftStyle: 'solid',
        borderLeftColor: 'hsl(var(--border))',
        transition: 'width 320ms cubic-bezier(0.22, 1, 0.36, 1), min-width 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out, border-left-width 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        pointerEvents: open ? 'auto' : 'none',
      }}
      aria-hidden={!open}
    >
      {/* Header. It stands outside the two screens on purpose: which table this
          is and how much of it is showing are true of both. */}
      <div className="px-3.5 pt-3 pb-3 border-b border-border shrink-0" style={{ backgroundColor: 'var(--color-slate-28)' }}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[6px] flex items-center justify-center" style={{ backgroundColor: 'var(--color-blue-50)' }}>
              <Columns3 size={14} className="text-primary" />
            </div>
            <span className="text-[13px] font-semibold text-fg">Columns</span>
            <span className="inline-flex items-center text-[11px] tabular-nums px-2 py-[2px] rounded-full font-semibold text-primary" style={{ backgroundColor: 'var(--color-blue-50)' }}>{visibleCount}/{total}</span>
          </div>
          <button onClick={() => onOpenChange(false)} aria-label="Close columns" className="p-1 rounded-md hover:bg-bg-muted text-fg-subtle/60 hover:text-fg transition-colors"><X size={14} /></button>
        </div>

        {/* Search */}
        <div className="relative mb-2.5">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle/60 pointer-events-none" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search columns…" aria-label="Search columns"
            className="h-[30px] w-full pl-8 pr-8 text-xs bg-white rounded-md border border-border shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
          {q && (
            <button onClick={() => setQ('')} aria-label="Clear column search" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-bg-muted text-fg-subtle/60 hover:text-fg-muted"><X size={12} /></button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button onClick={showAll} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-[3px] rounded-[6px] hover:bg-accent text-primary transition-colors"><Eye size={12} /> Show All</button>
          <button onClick={hideAll} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-[3px] rounded-[6px] hover:bg-bg-muted text-fg-muted transition-colors"><EyeOff size={12} /> Hide All</button>
          <div className="flex-1" />
          <button onClick={reset} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-[3px] rounded-[6px] hover:bg-bg-muted text-fg-muted transition-colors"><RotateCcw size={12} /> Reset</button>
        </div>
      </div>

      {/* The column list, or the visual switches in its place, the two swapping
          with a push/pop slide: the incoming screen arrives from the side it
          lives on, the outgoing one leaves the other way, shallower and fading,
          the way a mobile stack reads. */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence initial={false} custom={dir} mode="sync">
          {visual && configOpen ? (
            <motion.div
              key="visual"
              custom={dir}
              variants={SCREEN_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={SCREEN_TRANSITION}
              className="absolute inset-0 overflow-y-auto scrollbar-thin flex flex-col bg-white"
            >
              <VisualConfigView values={visual.values} offers={visual.offers} onToggle={visual.onToggle} onBack={() => setConfigOpen(false)} />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              custom={dir}
              variants={SCREEN_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={SCREEN_TRANSITION}
              ref={listRef}
              className="absolute inset-0 overflow-y-auto scrollbar-thin pb-2 bg-white"
            >
              {visual && !q && (
                <div className="px-3.5 pt-3 pb-1">
                  <ConfigureVisualButton open={false} onClick={() => setConfigOpen(true)} />
                </div>
              )}

              {pinned.length > 0 && !q && (
                <>
                  <SectionLabel>Pinned</SectionLabel>
                  {pinned.map(c => (
                    <div key={c.key} className="flex items-center gap-2 px-2 py-[7px] mx-1.5 rounded-md select-none">
                      <div title="Pinned column, always visible" className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'var(--color-blue-50)' }}><Eye size={14} className="text-primary" /></div>
                      <span className="flex-1 text-[13px] font-medium truncate" style={{ color: 'var(--color-gray-800)' }}>{c.label}</span>
                      <Lock size={14} className="text-fg-subtle/40 shrink-0" />
                    </div>
                  ))}
                  <div className="my-1 border-t border-border mx-3.5" />
                </>
              )}

              {!q && <SectionLabel top={8}>Columns</SectionLabel>}
              {q && reorderable.length > 0 && (
                <div className="px-3.5 pt-2 pb-1 text-[11px] font-medium text-fg-subtle/60">{reorderable.length} result{reorderable.length !== 1 ? 's' : ''}</div>
              )}

              {reorderable.map(c => {
                const required = requiredColumns.includes(c.key)
                const on = required || columnVisibility[c.key] !== false
                const isDragging = draggingKey === c.key
                const frozen = !!frozenColumns?.includes(c.key)
                const freezable = !!onToggleFreeze && (canFreeze ? canFreeze(c.key) : true)
                return (
                  <div
                    key={c.key}
                    data-col-key={c.key}
                    ref={el => { if (el) rowRefs.current.set(c.key, el); else rowRefs.current.delete(c.key) }}
                    className="mx-1.5 select-none"
                  >
                    {/* The dragging ring is an outline, not a border: a border
                        would stand in the row's own box and make every row 2px
                        taller than the 38 the spec sets. */}
                    <div className={cn('group/item flex items-center gap-2 px-2 py-[7px] rounded-md transition-all duration-150',
                      isDragging ? 'bg-primary/[0.04] outline outline-1 outline-dashed outline-primary/25 opacity-40 scale-[0.97]' : 'hover:bg-bg-subtle/60')}>
                      <span
                        onPointerDown={e => handlePointerDown(e, c.key)}
                        className={cn('shrink-0 touch-none transition-all duration-150',
                          q ? 'opacity-0 w-0 overflow-hidden'
                            : isDragging ? 'opacity-100 cursor-grabbing'
                            : 'opacity-0 group-hover/item:opacity-100 cursor-grab active:cursor-grabbing')}
                      >
                        <GripVertical size={14} className="text-fg-subtle/40" />
                      </span>
                      <button
                        type="button"
                        onClick={() => setVis(c.key, !on)}
                        disabled={required}
                        title={required ? 'Always shown' : on ? 'Hide column' : 'Show column'}
                        className={cn('shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors',
                          required ? 'cursor-default' : on ? 'hover:bg-blue-100' : 'bg-bg-muted/50 hover:bg-bg-muted')}
                        style={on ? { backgroundColor: 'var(--color-blue-50)' } : undefined}
                      >
                        {on ? <Eye size={14} className="text-primary" /> : <EyeOff size={14} className="text-fg-subtle/50" />}
                      </button>
                      <span className="flex-1 text-[13px] truncate transition-colors duration-150"
                        style={{ fontWeight: on ? 500 : 400, color: on ? 'var(--color-gray-800)' : 'var(--color-slate-400)' }}>{c.label}</span>
                      {required && <span title="Always shown" className="inline-flex shrink-0"><Lock size={12} className="text-fg-subtle/40" /></span>}
                      {/* Hidden until the row is hovered, like the grip - except on a
                          frozen column, where it stays lit so the list says which
                          columns are frozen without anyone having to go looking. */}
                      {freezable && on && (
                        <Tooltip content={frozen ? 'Unfreeze' : 'Freeze'} side="top" align="right">
                          <button
                            type="button"
                            onClick={() => onToggleFreeze!(c.key)}
                            aria-pressed={frozen}
                            aria-label={`${frozen ? 'Unfreeze' : 'Freeze'} ${c.label}`}
                            className={cn('shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all',
                              frozen
                                ? 'text-primary bg-accent opacity-100'
                                : 'text-fg-subtle/60 hover:text-fg hover:bg-bg-muted opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100')}
                          >
                            <Snowflake size={13} />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                )
              })}

              {reorderable.length === 0 && q && (
                <div className="px-4 py-8 text-center">
                  <Search size={20} className="text-fg-subtle/20 mx-auto mb-2" />
                  <p className="text-[12px] font-medium text-fg-subtle/60">No columns match “{q}”.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* Pinned clears the search above it by 10; Columns only clears the rule under
   Pinned, and takes 8. */
function SectionLabel({ children, top = 10 }: { children: ReactNode; top?: number }) {
  return <div className="px-3.5 pb-1 text-[10px] uppercase tracking-[1px] font-semibold" style={{ paddingTop: top, color: 'var(--color-slate-500)' }}>{children}</div>
}
