/* Ported from the reporting module's comms cluster (its composePopoutChrome.tsx).

   The dock / expand-to-modal / minimise state a compose popout sits in, the
   drag-to-dock behaviour on its header, and the header's own controls.

   Colours are the source's own primitives. They resolve because the popout root
   re-declares `data-comms` on the portalled wrapper: <body> is outside the tab,
   so without that they would resolve to nothing. */
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type PointerEvent,
} from 'react'
import {
  ExternalLink, Maximize2, Minimize2, Minus, PanelLeft, PanelRight, RectangleHorizontal, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  getPopoutSlots, releasePopoutDock, reservePopoutDock, setPopoutDock, subscribePopoutRegistry,
} from './composePopoutRegistry'

/** Where the popout is anchored along the bottom edge. */
export type PopoutDock = 'left' | 'center' | 'right'

interface ChromeStateOptions {
  /** Stack offset within a multi-popout column. See the `void stackIndex` below. */
  stackIndex: number
  /** Width at the compact size, typically from a responsive hook so the chrome
   *  scales with the viewport. */
  compactWidth: number
  /** Margin between the popout and the viewport edge in the left/right docks. */
  edgeMargin: number
  /** Gap between popouts in the same dock column. */
  gap?: number
}

interface ChromeStateValue {
  dock: PopoutDock
  setDock: (next: PopoutDock) => void
  /** True when the popout is a centered overlay with a dark backdrop rather
   *  than docked along the bottom edge. */
  expandedToModal: boolean
  setExpandedToModal: (next: boolean | ((prev: boolean) => boolean)) => void
  toggleExpandedToModal: () => void
  minimized: boolean
  setMinimized: (next: boolean | ((prev: boolean) => boolean)) => void
  width: number
  maxHeightVh: number
  /** Position, width and z-index for the popout root, in one place. */
  rootStyle: CSSProperties
}

const DEFAULT_DOCKED_HEIGHT_VH = 86
/** Tall enough that a nested modal (the record picker) can render its own ~88vh
 *  card inside the compose body without being clipped at the bottom. */
const MODAL_HEIGHT_VH = 96

/** Floor so three popouts on a narrow laptop stay usable. Kept at or below the
 *  share each gets at 1280px, so the floor cannot itself cause an overlap by
 *  overriding the fair-share calculation. */
const MIN_POPOUT_WIDTH = 380

function modalWidth(viewportWidth: number): number {
  return Math.min(1600, Math.max(880, viewportWidth * 0.75))
}

/** Rendered width when docked, given which sibling docks are occupied: one
 *  popout takes its preferred width, two at the corners take half each, and any
 *  layout including center takes a third each. */
function computeDockedWidth(
  compactWidth: number,
  viewportWidth: number,
  openCount: number,
  centerOccupied: boolean,
  edgeMargin: number,
  gap: number,
): number {
  let share: number
  if (openCount <= 1) {
    share = viewportWidth - 2 * edgeMargin
  } else if (centerOccupied) {
    share = (viewportWidth - 2 * edgeMargin - 2 * gap) / 3
  } else {
    share = (viewportWidth - 2 * edgeMargin - gap) / 2
  }
  return Math.max(MIN_POPOUT_WIDTH, Math.min(compactWidth, share))
}

interface ChromeOptionsWithHeights extends ChromeStateOptions {
  dockedHeightVh?: number
  /** Hard unmount, fired when the registry evicts this popout to make room.
   *  Must skip any "discard draft?" prompt: the eviction has already happened. */
  onForceClose?: () => void
  /** Mount in expanded-modal mode. Minimising still collapses to the docked
   *  strip, and restoring returns to the overlay rather than the docked popout. */
  defaultExpanded?: boolean
}

let popoutIdCounter = 0
function nextPopoutId(): string {
  popoutIdCounter += 1
  return `popout-${popoutIdCounter}`
}

export function usePopoutChrome({
  stackIndex,
  compactWidth,
  edgeMargin,
  gap = 12,
  dockedHeightVh,
  onForceClose,
  defaultExpanded = false,
}: ChromeOptionsWithHeights): ChromeStateValue {
  const idRef = useRef<string | null>(null)
  if (idRef.current === null) {
    idRef.current = nextPopoutId()
  }
  const id = idRef.current
  // Held in a ref so a re-render does not churn the registry.
  const forceCloseRef = useRef<() => void>(() => undefined)
  forceCloseRef.current = onForceClose ?? (() => undefined)

  /* Subscribe before reserving. Reservation notifies, and with no listener yet
     attached this popout never re-renders to read the dock it was given, so it
     stays at the default 'right' and two popouts opened together overlap. Both
     run as layout effects so they settle before the browser paints. */
  const [, setRegistryTick] = useState(0)
  useLayoutEffect(() => subscribePopoutRegistry(() => setRegistryTick(t => t + 1)), [])
  useLayoutEffect(() => {
    reservePopoutDock(id, () => forceCloseRef.current())
    return () => releasePopoutDock(id)
  }, [id])

  // The registry is the source of truth, so a manual re-dock here stays in sync
  // with a displacement forced by another popout.
  const slot = getPopoutSlots().find(s => s.id === id)
  const dock: PopoutDock = slot?.dock ?? 'right'
  const setDock = useCallback((next: PopoutDock) => setPopoutDock(id, next), [id])

  /* `preferExpandedToModal` is the user's intent; `expandedToModal` is what
     actually renders. Minimising forces the docked strip even when the
     preference is "modal", and restoring returns to the preference, which is
     what makes "open in modal, minimise, restore to modal" work. */
  const [preferExpandedToModal, setPreferExpandedToModalRaw] = useState(defaultExpanded)
  const [minimized, setMinimizedRaw] = useState(false)
  const setMinimized = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setMinimizedRaw(prev => (typeof next === 'function' ? next(prev) : next))
  }, [])
  const setExpandedToModal = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setPreferExpandedToModalRaw(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next
      // A half-collapsed centered overlay is a useless state.
      if (resolved) setMinimizedRaw(false)
      return resolved
    })
  }, [])
  const expandedToModal = preferExpandedToModal && !minimized
  const toggleExpandedToModal = useCallback(() => {
    setExpandedToModal(!expandedToModal)
  }, [expandedToModal, setExpandedToModal])

  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  )
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Read off the same registry the docks come from, so a sibling opening,
  // closing or moving to center re-renders every popout at its new fair share.
  const allSlots = getPopoutSlots()
  const openCount = allSlots.length || 1
  const centerOccupied = allSlots.some(s => s.dock === 'center')

  const width = expandedToModal
    ? modalWidth(viewportWidth)
    : computeDockedWidth(compactWidth, viewportWidth, openCount, centerOccupied, edgeMargin, gap)
  /* A leftover from before the registry, when popouts shared a dock and needed
     a horizontal fan-out. Every popout now owns its slot, so an offset only
     pushes the center-docked one off the midline. Kept on the interface for
     callers still passing it. */
  void stackIndex
  const maxHeightVh = expandedToModal ? MODAL_HEIGHT_VH : (dockedHeightVh ?? DEFAULT_DOCKED_HEIGHT_VH)

  const rootStyle: CSSProperties = (() => {
    const base: CSSProperties = {
      position: 'fixed',
      width,
      zIndex: expandedToModal ? 320 : 300,
    }
    if (expandedToModal) {
      return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }
    if (dock === 'right') return { ...base, bottom: 0, right: edgeMargin }
    if (dock === 'left') return { ...base, bottom: 0, left: edgeMargin }
    return { ...base, bottom: 0, left: '50%', transform: 'translateX(-50%)' }
  })()

  return {
    dock, setDock,
    expandedToModal, setExpandedToModal, toggleExpandedToModal,
    minimized, setMinimized,
    width, maxHeightVh, rootStyle,
  }
}

/* ─── Drag to dock ─────────────────────────────────────────────────────────── */

interface DragHandleHandlers {
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (e: PointerEvent<HTMLDivElement>) => void
}

interface DragToDockState {
  /** Style override while a drag is in progress, null otherwise. Pins the
   *  popout's left edge to the cursor minus the grab offset so it tracks the
   *  pointer 1:1; the consumer must also disable its layout transitions while
   *  this is non-null. */
  dragOverlay: { left: number } | null
  handlers: DragHandleHandlers
  /** Wraps a click handler so the trailing click after a drag does not fire it. */
  guardClick: (fn: () => void) => () => void
}

/** Pointer-down on the header starts a horizontal pan; pointer-up snaps to
 *  whichever viewport third the dropped popout's centre lands in. Disabled
 *  while the popout is a centered overlay. */
export function useHeaderDragToDock(chrome: ChromeStateValue): DragToDockState {
  const dragRef = useRef<{
    startX: number
    offsetX: number
    pointerId: number
    isDragging: boolean
  } | null>(null)
  const justDraggedRef = useRef(false)
  const [dragOverlay, setDragOverlay] = useState<{ left: number } | null>(null)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // The chrome buttons inside the handle keep their normal click behaviour.
    if ((e.target as HTMLElement).closest('button')) return
    if (chrome.expandedToModal) return
    const dialogEl = e.currentTarget.parentElement as HTMLElement | null
    if (!dialogEl) return
    const rect = dialogEl.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      offsetX: e.clientX - rect.left,
      pointerId: e.pointerId,
      isDragging: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    // 4px of slack, so a steady click that drifts still toggles minimise.
    if (!d.isDragging && Math.abs(e.clientX - d.startX) > 4) d.isDragging = true
    if (d.isDragging) setDragOverlay({ left: e.clientX - d.offsetX })
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    const wasDragging = d.isDragging
    try { e.currentTarget.releasePointerCapture(d.pointerId) } catch { /* already released */ }
    dragRef.current = null
    setDragOverlay(null)
    if (wasDragging) {
      justDraggedRef.current = true
      const vw = window.innerWidth
      const droppedLeft = e.clientX - d.offsetX
      const centerX = droppedLeft + chrome.width / 2
      const targetDock = centerX < vw / 3
        ? 'left'
        : centerX < (2 * vw) / 3
          ? 'center'
          : 'right'
      if (targetDock !== chrome.dock) chrome.setDock(targetDock)
    }
  }
  const guardClick = useCallback((fn: () => void) => () => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false
      return
    }
    fn()
  }, [])

  return {
    dragOverlay,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    guardClick,
  }
}

interface PopoutHeaderControlsProps {
  dock: PopoutDock
  onDockChange: (next: PopoutDock) => void
  expandedToModal: boolean
  onToggleExpand: () => void
  minimized: boolean
  onToggleMinimize: () => void
  onClose: () => void
  closeLabel?: string
  /** Hide the left/center/right segmented control. The email compose does,
   *  because drag-to-dock replaces it. */
  hideDockSelector?: boolean
  /** Hide the expand-to-modal toggle. With only a modal and a minimised strip,
   *  the minimise button alone flips between them and an extra toggle would
   *  only expose the never-used docked-popout state in between. */
  hideExpandToggle?: boolean
}

/** The header chrome shared by the email and chat compose popouts: dock
 *  segmented group, expand-to-modal toggle, minimise, close. The caller still
 *  owns the title to the left of these. */
export function PopoutHeaderControls({
  dock,
  onDockChange,
  expandedToModal,
  onToggleExpand,
  minimized,
  onToggleMinimize,
  onClose,
  closeLabel = 'Close',
  hideDockSelector = false,
  hideExpandToggle = false,
}: PopoutHeaderControlsProps) {
  const dockButtons: { value: PopoutDock; label: string; icon: typeof PanelLeft }[] = [
    { value: 'left', label: 'Dock to left', icon: PanelLeft },
    { value: 'center', label: 'Dock to center', icon: RectangleHorizontal },
    { value: 'right', label: 'Dock to right', icon: PanelRight },
  ]
  const expandLabel = expandedToModal ? 'Restore to docked popout' : 'Expand to full modal'
  return (
    <div
      className="flex items-center gap-1"
      // The header itself is a minimise toggle, so without this every press on
      // a chrome button would also collapse the body.
      onClick={e => e.stopPropagation()}
    >
      {!expandedToModal && !hideDockSelector && (
        <div className="inline-flex items-center rounded-md bg-white/60 border border-[var(--color-slate-200)] overflow-hidden">
          {dockButtons.map((b, i) => {
            const Icon = b.icon
            const active = dock === b.value
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => onDockChange(b.value)}
                className={cn(
                  'w-6 h-6 flex items-center justify-center transition-colors cursor-pointer',
                  i > 0 && 'border-l border-[var(--color-slate-200)]',
                  active
                    ? 'bg-[var(--color-brand-75)] text-[var(--color-sky-500)]'
                    : 'text-gray-500 hover:bg-gray-100',
                )}
                aria-label={b.label}
                aria-pressed={active}
                title={b.label}
              >
                <Icon className="w-3 h-3" />
              </button>
            )
          })}
        </div>
      )}
      {!hideExpandToggle && (
        <button
          type="button"
          onClick={onToggleExpand}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
          aria-label={expandLabel}
          aria-pressed={expandedToModal}
          title={expandLabel}
        >
          {/* An arrow leaving a square reads as "pop this out", which the
              Maximize2 on the restore button beside it does not. */}
          {expandedToModal
            ? <Minimize2 className="w-3.5 h-3.5" />
            : <ExternalLink className="w-3.5 h-3.5" />}
        </button>
      )}
      <button
        type="button"
        onClick={onToggleMinimize}
        className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
        aria-label={minimized ? 'Restore' : 'Minimize'}
        title={minimized ? 'Restore' : 'Minimize'}
      >
        {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
        aria-label={closeLabel}
        title={closeLabel}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

/** The dark backdrop behind a popout expanded into the modal overlay. Discrete
 *  so the consumer decides when to render it and what a backdrop click does:
 *  collapsing back to docked is the safe default, since the compose may hold an
 *  unsent draft. */
export function PopoutModalBackdrop({ visible, onClick }: { visible: boolean; onClick?: () => void }) {
  if (!visible) return null
  return (
    <div
      onClick={onClick}
      className="fixed inset-0 z-[310] coa-scrim transition-opacity"
      aria-hidden="true"
    />
  )
}
