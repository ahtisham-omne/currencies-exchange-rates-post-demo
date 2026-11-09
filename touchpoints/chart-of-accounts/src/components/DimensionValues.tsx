import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'

/* ──────────────────────────────────────────────────────────────────
 * THE VALUES A DIMENSION HOLDS, AS A TABLE CELL
 *
 * Two surfaces ask the same question of a dimension and answer it the same
 * way: the import's dimensions step, which is reading values out of the file
 * just uploaded, and GL creation's dimensions step, which is reading the
 * values a filter was set up with. Both rows are "here is the filter, here is
 * what is in it, now answer for it", so the cell in the middle is one component
 * rather than two that drift.
 * ────────────────────────────────────────────────────────────────── */

/** How many of a filter's values fit on the row before the rest are counted. */
export const DIMENSION_VALUES_INLINE = 3

/* Every value the filter takes, on hover. Three of them fit on the row, and a
   bare "+17" leaves the other seventeen unaccounted for - but what this row asks
   is what the filter means, and that is only answerable by reading its values,
   so they have to be reachable.
 *
 * Partners' overflow panel, ported: `GroupChipsRow`'s OverflowChip and
 * `PocPillComponents`' contact overflow are the same recipe twice, so this keeps
 * its measurements. A "+N more" pill for a trigger rather than bare blue text - a
 * pill reads as something with more behind it, where coloured text reads as a
 * link to somewhere else. Then a 240px panel, a counted header on a tinted strip,
 * and one scrolling column capped at 220px.
 *
 * Not a Tooltip, though it looks like one, and not our Menu either. A tooltip
 * drops the moment the pointer leaves its trigger and twenty rows have to be
 * scrolled, so the panel keeps the pointer and the close waits 200ms for the gap
 * to be crossed - which is exactly what Partners' Popover does with its leave
 * timer. Portalled because the table this sits in is `overflow-clip` to hold its
 * rounded corners and would otherwise cut the panel off. */
const DIMENSION_VALUES_PANEL_H = 264

export function DimensionValuesCard({ values }: { values: string[] }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null)

  const enter = () => {
    if (closing.current) { clearTimeout(closing.current); closing.current = null }
    const el = ref.current
    if (el) setRect(el.getBoundingClientRect())
  }
  const leave = () => { closing.current = setTimeout(() => setRect(null), 200) }
  useEffect(() => () => { if (closing.current) clearTimeout(closing.current) }, [])

  // Opens below its trigger and flips up only when the panel would not fit, the
  // way a Popover placed `side="bottom"` behaves. Anchored by whichever edge is
  // doing the work, never by a transform: the open animation ends on
  // `transform: none`, so a transform used for placement would be wiped.
  const above = rect ? rect.bottom + DIMENSION_VALUES_PANEL_H > window.innerHeight : false

  return (
    <span ref={ref} className="relative inline-flex align-middle ml-1.5" onMouseEnter={enter} onMouseLeave={leave}>
      <span
        className="inline-flex items-center rounded-lg border border-border bg-bg-subtle px-2 py-0.5 text-11 text-fg-muted tabular-nums cursor-default transition-colors hover:border-fg-subtle/30 hover:text-fg"
        style={{ fontWeight: 500 }}
      >
        +{values.length - DIMENSION_VALUES_INLINE} more
      </span>
      {/* Hovering is not available to a screen reader, and the count on its own
          says nothing, so the values are in the row either way. */}
      <span className="sr-only">{`: ${values.slice(DIMENSION_VALUES_INLINE).join(', ')}`}</span>
      {rect && createPortal(
        <div
          onMouseEnter={enter}
          onMouseLeave={leave}
          className={cn(
            'fixed z-[90] w-[240px] rounded-xl border border-border/60 bg-white overflow-hidden text-left',
            'shadow-[0_8px_30px_rgba(0,0,0,0.12)]',
            above ? 'animate-popover-up' : 'animate-popover-down',
          )}
          style={{
            left: rect.left,
            ...(above ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
          }}
        >
          <div className="px-3 py-2 border-b border-border bg-bg-subtle/50">
            <span className="text-11 text-fg-muted" style={{ fontWeight: 600 }}>
              All {values.length} values
            </span>
          </div>
          <div className="max-h-[220px] overflow-y-auto scrollbar-thin py-1">
            {values.map(v => (
              <div key={v} className="flex items-center gap-2 px-3 py-2 text-xs text-fg tabular-nums cursor-default transition-colors hover:bg-bg-subtle" style={{ fontWeight: 500 }}>
                {v}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}

/* The whole cell: how many values there are, then the first few of them. A
   filter with one value across the whole chart and one with fifty are different
   jobs, and only the count says which, so it leads. */
export function DimensionValuesCell({ values, count = values.length }: {
  values: string[]
  /* Overridden where the count is not the length of what is shown: the import
     tallies every row of the file, and only the distinct codes are listed. */
  count?: number
}) {
  return (
    <span className="inline-flex items-baseline flex-wrap gap-1.5">
      <span className="tabular-nums mr-0.5">{count} value{count === 1 ? '' : 's'}</span>
      {values.slice(0, DIMENSION_VALUES_INLINE).map(v => (
        <span key={v} className="inline-flex items-center rounded-md border border-border bg-white px-1.5 py-0.5 text-11 text-fg tabular-nums">{v}</span>
      ))}
      {values.length > DIMENSION_VALUES_INLINE && <DimensionValuesCard values={values} />}
    </span>
  )
}
