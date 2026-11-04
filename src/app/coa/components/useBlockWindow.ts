import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { blockOffsets, blocksInView } from '../lib/blockWindow'

/* A long table drawn a block at a time instead of a page at a time: the Journal
   entries tab and an account's Transactions tab. Mahad, 2026-11-03 - see
   `lib/blockWindow` for which blocks are drawn.

   The table hands over how many rows each block holds and a key naming what it
   holds; it gets back which blocks to draw and how tall the spacers standing in
   for the rest are. Three things keep the rows still while blocks come and go:

   - A block's height is measured the first time it is drawn, so the spacer that
     replaces it when it leaves is exactly as tall as it was. A block not drawn
     yet is estimated at its row count times the drawn rows' height. Measures are
     kept against the block's key and dropped when `layoutKey` changes - the
     density, the columns, a width: anything that sizes a row.
   - Column widths are floored at the widest each has drawn (`colFloor`). An
     auto-layout table sizes its columns to the rows it holds, so without this a
     column narrowed when the block holding its longest value left, and every row
     shifted sideways mid-scroll. Kept against the result set and the layout, and
     dropped when the table's frame changes width.
   - Whatever scrolls the table is followed - its own frame, or the page around
     it - so the same hook serves a table in a scroller and a table in a page.

   A new result set (`resetKey`) starts again from the first block, with the top
   of the table brought back into view if the reader was scrolled past it. */
export function useBlockWindow(o: {
  enabled: boolean
  // The <tbody> the rows and spacers sit in.
  bodyRef: RefObject<HTMLElement>
  // The <thead>, when it sticks over the rows as they scroll.
  headRef?: RefObject<HTMLElement>
  // The rows a block is made of, as drawn inside `bodyRef`.
  rowSelector: string
  sizes: number[]
  keys: string[]
  layoutKey: string
  resetKey: string
  // The attribute naming each header cell's column, to floor its width by.
  colAttr: string
  floorCols: boolean
}) {
  const { bodyRef, headRef } = o
  const [blocks, setBlocks] = useState({ first: 0, last: 0 })
  const [rowH, setRowH] = useState(41)
  const [, setMeasured] = useState(0)

  const measuredRef = useRef<{ key: string; h: Map<string, number> }>({ key: '', h: new Map() })
  if (measuredRef.current.key !== o.layoutKey) measuredRef.current = { key: o.layoutKey, h: new Map() }
  const heights = o.sizes.map((n, b) => measuredRef.current.h.get(o.keys[b]) ?? n * rowH)
  const offsets = blockOffsets(heights)
  const offsetsRef = useRef(offsets)
  offsetsRef.current = offsets

  const lastBlock = Math.max(0, o.sizes.length - 1)
  const first = Math.min(blocks.first, lastBlock)
  const last = Math.min(Math.max(blocks.last, first), lastBlock)

  // Where the reader can see, in the body's own coordinates.
  const viewport = useCallback(() => {
    const body = bodyRef.current
    if (!body) return null
    const sp = scrollParentOf(body)
    const frame = sp ? sp.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
    const head = headRef?.current
    const headH = head && getComputedStyle(head).position === 'sticky' ? head.getBoundingClientRect().height : 0
    const bodyTop = body.getBoundingClientRect().top
    return { sp, top: frame.top + headH - bodyTop, bottom: frame.bottom - bodyTop, height: frame.bottom - frame.top }
  }, [bodyRef, headRef])

  const sync = useCallback(() => {
    const v = viewport()
    if (!v) return
    const next = blocksInView(offsetsRef.current, v.top, v.bottom, v.height / 2)
    setBlocks(prev => (prev.first === next.first && prev.last === next.last ? prev : next))
  }, [viewport])

  // Any scroll that moves the table: its own frame's or the page's. Read a frame
  // at a time, and only set when the pair of blocks changes, so scrolling inside
  // a block re-renders nothing.
  useEffect(() => {
    if (!o.enabled) return
    let raf = 0
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; sync() }) }
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [o.enabled, sync])

  const resetRef = useRef(o.resetKey)
  useLayoutEffect(() => {
    if (resetRef.current === o.resetKey) return
    resetRef.current = o.resetKey
    setBlocks(prev => (prev.first === 0 && prev.last === 0 ? prev : { first: 0, last: 0 }))
    const v = viewport()
    if (v && v.top > 0) {
      if (v.sp) v.sp.scrollTop -= v.top
      else window.scrollBy(0, -v.top)
    }
  }, [o.resetKey, viewport])

  const floorKey = o.layoutKey + o.resetKey
  const [floor, setFloor] = useState<{ key: string; w: Record<string, number> }>({ key: '', w: {} })
  // The frame's width, so the floors go when it changes: the wide columns share
  // out whatever room the frame has.
  useEffect(() => {
    const frame = bodyRef.current?.closest('table')?.parentElement
    if (!o.enabled || !frame) return
    let w = frame.clientWidth
    const ro = new ResizeObserver(() => {
      if (frame.clientWidth !== w) { w = frame.clientWidth; setFloor({ key: '', w: {} }) }
    })
    ro.observe(frame)
    return () => ro.disconnect()
  }, [o.enabled, bodyRef])

  /* After each draw: measure the drawn blocks and the header cells, and re-check
     which blocks the screen wants. Before paint, so a corrected spacer never shows. */
  useLayoutEffect(() => {
    if (!o.enabled) return
    const rows = bodyRef.current?.querySelectorAll<HTMLElement>(o.rowSelector)
    const drawn = o.sizes.slice(first, last + 1)
    const drawnCount = drawn.reduce((a, b) => a + b, 0)
    if (rows && rows.length && rows.length === drawnCount) {
      let moved = false
      let drawnH = 0
      let k = 0
      drawn.forEach((n, i) => {
        // Layout offsets rather than the box on screen: a row sliding in carries
        // a transform for its first frames, which the box would include.
        const top = rows[k], bottom = rows[k + n - 1]
        const h = bottom.offsetTop + bottom.offsetHeight - top.offsetTop
        k += n
        drawnH += h
        const key = o.keys[first + i]
        if (Math.abs((measuredRef.current.h.get(key) ?? -1) - h) > 0.5) {
          measuredRef.current.h.set(key, h)
          moved = true
        }
      })
      const avg = drawnH / drawnCount
      if (avg > 0 && Math.abs(avg - rowH) > 0.5) setRowH(avg)
      else if (moved) setMeasured(n => n + 1)
    }
    if (o.floorCols) {
      const prev = floor.key === floorKey ? floor.w : {}
      let next: Record<string, number> | null = null
      bodyRef.current?.closest('table')?.querySelectorAll<HTMLElement>(`thead th[${o.colAttr}]`).forEach(th => {
        const col = th.getAttribute(o.colAttr)!
        const w = th.getBoundingClientRect().width
        if (w > (prev[col] ?? 0) + 0.5) next = { ...(next ?? prev), [col]: Math.ceil(w) }
      })
      if (next || floor.key !== floorKey) setFloor({ key: floorKey, w: next ?? prev })
    }
    sync()
  })

  const total = offsets[offsets.length - 1] ?? 0
  return {
    first,
    last,
    // The rows above the drawn blocks, for a row counter to skip.
    rowsAbove: o.sizes.slice(0, first).reduce((a, b) => a + b, 0),
    spaceAbove: offsets[first] ?? 0,
    spaceBelow: total - (offsets[last + 1] ?? total),
    colFloor: o.floorCols && floor.key === floorKey ? floor.w : null,
  }
}

// The nearest ancestor that scrolls the element vertically, or null for the page.
function scrollParentOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p
  }
  return null
}
