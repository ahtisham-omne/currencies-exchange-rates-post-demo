import { useCallback, useRef, useState } from 'react'

/* Drag-to-resize for the thread list column.

   Ported from the financial reporting module, which in turn mirrors this app's
   own DataTable column resize: a document-level mousemove/mouseup pair plus a
   body cursor and user-select lock, so the drag survives the pointer leaving the
   handle and does not select text on the way past.

   Width is a percentage of the container rather than pixels, so the split holds
   when the window is resized instead of the list keeping a width that no longer
   suits the pane beside it. */
export function useColumnResize(opts: {
  containerRef: React.RefObject<HTMLElement | null>
  /** Baseline width, in percent. Also the floor, give or take the 20px of give
   *  below it that stops the handle feeling stuck. */
  defaultPercent?: number
  /** How far past the baseline the column may grow, as a multiplier. */
  maxMultiplier?: number
}) {
  const { containerRef, defaultPercent = 35, maxMultiplier = 1.25 } = opts
  const maxPercent = defaultPercent * maxMultiplier

  const [widthPercent, setWidthPercent] = useState(defaultPercent)
  const [isResizing, setIsResizing] = useState(false)
  const drag = useRef<{ startX: number; startPercent: number; containerWidth: number } | null>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const containerWidth = container.getBoundingClientRect().width
    drag.current = { startX: e.clientX, startPercent: widthPercent, containerWidth }
    setIsResizing(true)

    const onMove = (mv: MouseEvent) => {
      if (!drag.current) return
      const deltaPercent = ((mv.clientX - drag.current.startX) / drag.current.containerWidth) * 100
      // The floor sits 20px below the baseline, expressed against the width
      // captured at mousedown so the column gives slightly before it stops.
      const minPercent = defaultPercent - (20 / drag.current.containerWidth) * 100
      setWidthPercent(Math.max(minPercent, Math.min(maxPercent, drag.current.startPercent + deltaPercent)))
    }
    const onUp = () => {
      drag.current = null
      setIsResizing(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [containerRef, widthPercent, defaultPercent, maxPercent])

  return { widthPercent, isResizing, onMouseDown }
}

/* A 6px hit strip flush with the column's right edge. The column's own border is
   the rest-state separator, and the handle lights that same line rather than
   drawing a second one beside it. */
export function ColumnResizeHandle({ onMouseDown, isResizing }: {
  onMouseDown: (e: React.MouseEvent) => void
  isResizing: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const active = hovered || isResizing
  return (
    <div
      onMouseDown={onMouseDown}
      onPointerDown={e => e.stopPropagation()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute right-0 top-0 bottom-0 z-[5] w-1.5"
      style={{ cursor: 'col-resize' }}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize thread list"
    >
      <div
        className={`absolute top-0 bottom-0 right-0 w-px transition-colors ${active ? 'bg-border-strong' : 'bg-transparent'}`}
      />
    </div>
  )
}
