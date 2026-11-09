import { useCallback, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { GripVertical, ArrowUp, ArrowDown, ChevronsUpDown, EyeOff } from 'lucide-react'
import { cn } from '../lib/utils'

// Column resize, drag-reorder, sticky pinning and sort affordances, in one
// place. Three surfaces grew their own copies of this (the Chart of Accounts
// table, the ledger, the import review grid) and they had drifted: one clamped
// resize with no maximum, another had no double-click reset. The options here
// are a superset, so each caller can reproduce its own behaviour exactly.

// ── Resize ──

export interface ColumnWidthOptions {
  /** Narrowest a column may be dragged. */
  min?: number
  /** Widest a column may be dragged. Unbounded when omitted. */
  max?: number
  /** Widths a column starts at, keyed the same way as the table's columns. */
  initial?: Record<string, number>
}

export function useColumnWidths({ min = 60, max, initial }: ColumnWidthOptions = {}) {
  const [widths, setWidths] = useState<Record<string, number>>(initial ?? {})
  const [resizing, setResizing] = useState<string | null>(null)

  const onResizeStart = useCallback((key: string) => (e: ReactMouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const th = (e.currentTarget as HTMLElement).closest('th')
    const startX = e.clientX
    const startW = th?.getBoundingClientRect().width ?? 120
    setResizing(key)
    const move = (ev: MouseEvent) => {
      let w = Math.round(startW + (ev.clientX - startX))
      w = Math.max(min, max == null ? w : Math.min(max, w))
      setWidths(prev => ({ ...prev, [key]: w }))
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setResizing(null)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [min, max])

  // Double-clicking the grip puts a column back to the width it shipped at,
  // which is the only way out of a drag that went too far.
  const resetWidth = useCallback((key: string) => () => {
    setWidths(prev => {
      const next = { ...prev }
      if (initial && key in initial) next[key] = initial[key]
      else delete next[key]
      return next
    })
  }, [initial])

  return { widths, resizing, onResizeStart, resetWidth }
}

/** Right-edge resize grip. Absolutely positioned, so its header must be `relative`. */
export function ResizeHandle({ onResizeStart, onReset, active, className }: {
  onResizeStart: (e: ReactMouseEvent) => void
  onReset?: () => void
  active?: boolean
  className?: string
}) {
  return (
    <span
      onMouseDown={onResizeStart}
      onDoubleClick={onReset}
      onClick={e => e.stopPropagation()}
      title={onReset ? 'Drag to resize, double-click to reset' : 'Drag to resize'}
      className={cn('absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize select-none z-10 group/resize', className)}
    >
      <span className={cn('absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors',
        active ? 'bg-primary' : 'bg-transparent group-hover/resize:bg-primary/40')} />
    </span>
  )
}

// ── Drag-reorder ──

export interface ColumnDragOptions {
  order: string[]
  setOrder: (next: string[] | ((prev: string[]) => string[])) => void
  /** Keys that neither move nor accept a drop, e.g. a frozen identity column. */
  locked?: ReadonlySet<string>
  /** Whether `from` may take `to`'s place, e.g. only within a frozen run. */
  canSwap?: (from: string, to: string) => boolean
  /* Drag a header off the top of its table and let go: the column hides.
     Mahad, 2026-10-01: *"if you drag them upwards to the top and release them
     outside, that specific column you dragged should be hidden"*, and *"when we
     drag it away from the table it just becomes like red so that the user knows
     ... I'm gonna hide this specific column."* `canHide` is the rule the
     header menu's Hide follows, so a drag cannot hide what that menu would not. */
  onHide?: (key: string) => void
  canHide?: (key: string) => boolean
}

/* Where a dragged header turns into a hide. Mahad, 2026-10-13: *"as soon as it
   is dragged up slightly - at least reaching the Accounting Period row - it
   should trigger that hiding feedback ... We shouldn't require the user to pull
   the column all the way out."* So the line is the top of the table's toolbar
   (the row marked `data-col-hide-edge`), just under the period row: everything
   from the toolbar down is a move, anything above it a hide. It used to be the
   top of the <table>, which on a card that scrolls its rows sits far above the
   screen once the reader has scrolled, so no drag could reach it. A table with no
   marked toolbar falls back to a margin above its header row. */
export const DRAG_OUT_MARGIN = 24
export function hideEdgeOf(th: Element): number {
  let el = th.parentElement
  while (el && !el.querySelector('[data-col-hide-edge]')) el = el.parentElement
  const toolbar = el?.querySelector('[data-col-hide-edge]')
  return toolbar ? toolbar.getBoundingClientRect().top : th.getBoundingClientRect().top - DRAG_OUT_MARGIN
}
const TINT_REORDER = 'rgba(10,119,255,0.035)'
const TINT_HIDE = 'rgba(220,38,38,0.06)'

/* The dragged column's cells, tinted the way Partners tints them. One rule for
   whatever draws the rows: the column is found by its header's position, so
   every row that lines up with the header takes the tint, and it follows the
   column as it moves. */
function useColumnTint() {
  const el = useRef<HTMLStyleElement | null>(null)
  const set = useCallback((th: HTMLElement | null, hiding: boolean) => {
    if (!th) { if (el.current) el.current.textContent = ''; return }
    const table = th.closest('table')
    if (!table) return
    table.setAttribute('data-col-dragging', '')
    if (!el.current) { el.current = document.createElement('style'); document.head.appendChild(el.current) }
    const n = (th as HTMLTableCellElement).cellIndex + 1
    el.current.textContent = `table[data-col-dragging] > tbody > tr > td:nth-child(${n}) { background-color: ${hiding ? TINT_HIDE : TINT_REORDER} !important; }`
  }, [])
  const clear = useCallback(() => {
    if (el.current) el.current.textContent = ''
    document.querySelectorAll('table[data-col-dragging]').forEach(t => t.removeAttribute('data-col-dragging'))
  }, [])
  return { set, clear }
}

const DRAG_THRESHOLD = 5
// A cooldown between swaps, so React can settle the DOM before the next
// header rect is measured. Without it a fast drag reads stale geometry.
const SWAP_SETTLE_MS = 60

export function useColumnDragReorder({ order, setOrder, locked, canSwap, onHide, canHide }: ColumnDragOptions) {
  const dragRef = useRef<{ key: string; startX: number; startY: number; dragging: boolean; lastSwap: number; hiding: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const ghostRef = useRef<HTMLDivElement>(null)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  // The column a release would hide, while the header is off the top.
  const [hiding, setHiding] = useState(false)
  const orderRef = useRef(order)
  orderRef.current = order
  const tint = useColumnTint()
  const hideRef = useRef({ onHide, canHide })
  hideRef.current = { onHide, canHide }

  const onHeaderMouseDown = useCallback((e: ReactMouseEvent, key: string) => {
    if (e.button !== 0 || locked?.has(key)) return
    dragRef.current = { key, startX: e.clientX, startY: e.clientY, dragging: false, lastSwap: 0, hiding: false }
    const thOf = (k: string) => document.querySelector<HTMLElement>(`th[data-col-drag-key="${k}"]`)

    const onMove = (ev: MouseEvent) => {
      const st = dragRef.current
      if (!st) return
      const dx = ev.clientX - st.startX
      const dy = ev.clientY - st.startY
      if (!st.dragging) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return
        st.dragging = true
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'
        setDraggingKey(st.key)
      }

      const ghost = ghostRef.current
      if (ghost) ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`

      // Above the toolbar: a hide in the making, not a reorder. Read each move,
      // since the page can scroll under a drag.
      const { onHide: hide, canHide: may } = hideRef.current
      const dragged = thOf(st.key)
      const off = !!hide && (may ? may(st.key) : true) && !!dragged && ev.clientY < hideEdgeOf(dragged)
      if (off !== st.hiding) { st.hiding = off; setHiding(off) }
      tint.set(thOf(st.key), off)
      if (off) return

      const now = performance.now()
      if (now - st.lastSwap < SWAP_SETTLE_MS) return

      const draggedTh = document.querySelector<HTMLElement>(`th[data-col-drag-key="${st.key}"]`)
      if (!draggedTh) return
      const draggedRect = draggedTh.getBoundingClientRect()
      // Still over its own header: nothing to swap with yet.
      if (ev.clientX >= draggedRect.left && ev.clientX <= draggedRect.right) return

      for (const th of document.querySelectorAll<HTMLElement>('th[data-col-drag-key]')) {
        const rect = th.getBoundingClientRect()
        if (ev.clientX < rect.left || ev.clientX > rect.right) continue
        const k = th.getAttribute('data-col-drag-key')
        if (!k || k === st.key || locked?.has(k) || (canSwap && !canSwap(st.key, k))) break
        /* Only once the pointer is past the middle of the column it is over, on
           the far side from where the dragged one sits: that is the point at
           which the dragged column's place actually changes. Swapping on first
           touch flipped columns back and forth under a pointer that only drifted
           sideways while it was being pulled up to hide. */
        const mid = rect.left + rect.width / 2
        if (rect.left > draggedRect.left ? ev.clientX < mid : ev.clientX > mid) break
        setOrder(prev => {
          const from = prev.indexOf(st.key)
          const to = prev.indexOf(k)
          if (from === -1 || to === -1 || from === to) return prev
          const next = [...prev]
          next.splice(from, 1)
          next.splice(to, 0, st.key)
          return next
        })
        st.lastSwap = now
        break
      }
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      const st = dragRef.current
      if (st?.dragging) {
        // The mouseup that ends a drag would otherwise land as a click on the
        // header and sort the column the user was only moving.
        suppressClickRef.current = true
        requestAnimationFrame(() => { suppressClickRef.current = false })
        if (st.hiding) hideRef.current.onHide?.(st.key)
      }
      tint.clear()
      dragRef.current = null
      setDraggingKey(null)
      setHiding(false)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [locked, setOrder, canSwap, tint])

  return { draggingKey, hiding, onHeaderMouseDown, ghostRef, suppressClick: () => suppressClickRef.current }
}

/* The header being dragged, drawn as Partners draws it: a wash over the cell and
   a 2px bar along its top edge, blue while it moves, red once a release would
   hide it. Spread onto the th's style; `dragBar` is the bar. */
export function draggedHeaderStyle(hiding: boolean): CSSProperties {
  // Over solid white: the header is sticky, and a see-through wash let a row
  // scrolled under it show through while it was dragged.
  return {
    background: hiding
      ? 'linear-gradient(180deg, rgba(220,38,38,0.10) 0%, rgba(220,38,38,0.04) 100%), #fff'
      : 'linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%), #fff',
  }
}
export function DragBar({ hiding }: { hiding: boolean }) {
  return <span aria-hidden className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full pointer-events-none" style={{ backgroundColor: hiding ? '#DC2626' : 'hsl(var(--primary))' }} />
}

/** The label that follows the cursor during a column drag - Partners' chip. Red,
 *  with an eye-off in place of the grip, while a release would hide the column.
 *  `caps` keeps the import grid's uppercase headers. */
export function DragGhost({ ghostRef, label, hiding = false, caps = true }: { ghostRef: React.RefObject<HTMLDivElement>; label: string | null; hiding?: boolean; caps?: boolean }) {
  // Nothing to portal into where there is no page (a table rendered to a string).
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={ghostRef}
      style={{
        position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none',
        opacity: label ? 1 : 0, transition: 'opacity 80ms ease-out', willChange: 'transform',
      }}
    >
      {label && (
        <div
          className="flex items-center gap-1.5 h-8 pl-2 pr-3 rounded-md whitespace-nowrap"
          style={{
            marginLeft: 12, marginTop: -14,
            backgroundColor: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: hiding ? '1px solid rgba(220,38,38,0.35)' : '1px solid rgba(10,119,255,0.3)',
            boxShadow: hiding ? '0 1px 3px rgba(220,38,38,0.10), 0 6px 20px rgba(0,0,0,0.10)' : '0 1px 3px rgba(10,119,255,0.08), 0 6px 20px rgba(0,0,0,0.10)',
            transition: 'border-color 120ms ease-out, box-shadow 120ms ease-out',
          }}
          data-drag-ghost={hiding ? 'hide' : 'move'}
        >
          {hiding
            ? <EyeOff className="w-3 h-3 shrink-0" style={{ color: '#DC2626' }} />
            : <GripVertical className="w-3 h-3 shrink-0 text-primary" />}
          <span className={cn('text-[13px]', caps && 'uppercase tracking-wide')} style={{ fontWeight: caps ? 600 : 500, color: hiding ? '#DC2626' : 'hsl(var(--primary))' }}>{label}</span>
        </div>
      )}
    </div>,
    document.body,
  )
}

// ── Pinning ──

export const SEAM_SHADOW_LEFT = '4px 0 8px rgba(0,0,0,0.06)'
export const SEAM_SHADOW_RIGHT = '-4px 0 8px rgba(0,0,0,0.06)'

/**
 * Left/right offsets for a run of frozen columns. Only the column at the
 * scrolling edge of the run draws the seam, since it is the one the moving
 * columns pass under, and only once there is something to pass under.
 */
export function pinStyle({ side, offset, z, seam }: {
  side: 'left' | 'right'
  offset: number
  z: number
  seam?: boolean
}): CSSProperties {
  return {
    position: 'sticky',
    [side]: offset,
    zIndex: z,
    boxShadow: seam ? (side === 'left' ? SEAM_SHADOW_LEFT : SEAM_SHADOW_RIGHT) : undefined,
  }
}

/** Running left offsets for pinned columns given their widths, in order. */
export function pinOffsets(widths: number[]): number[] {
  const out: number[] = []
  let acc = 0
  for (const w of widths) { out.push(acc); acc += w }
  return out
}

// ── Sort ──

export function SortIcon({ dir, hovered }: { dir?: 'asc' | 'desc' | null; hovered?: boolean }) {
  const cls = cn('w-3 h-3 shrink-0', dir ? 'text-primary' : hovered ? 'text-fg-muted' : 'text-fg-subtle/50')
  if (dir === 'asc') return <ArrowUp className={cls} />
  if (dir === 'desc') return <ArrowDown className={cls} />
  return <ChevronsUpDown className={cls} />
}

/** asc → desc → unsorted, the cycle every table in the app uses. */
export function nextSortDir(dir: 'asc' | 'desc' | null | undefined): 'asc' | 'desc' | null {
  return dir === 'asc' ? 'desc' : dir === 'desc' ? null : 'asc'
}
