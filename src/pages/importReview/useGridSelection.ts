import { useCallback, useMemo, useState } from 'react'

/**
 * Row selection for the review grid, keyed by the spreadsheet row number rather
 * than by position in the array. Sorting, filtering and pagination all reorder
 * that array, and a selection keyed by index would silently come to mean
 * different rows: bulk actions would then hit rows nobody picked.
 */
export function useGridSelection(visibleKeys: number[]) {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const toggle = useCallback((key: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const select = useCallback((keys: number[]) => setSelected(new Set(keys)), [])

  /* The header checkbox works on what is on screen, so a filter or a page is
     selected without silently taking the rows behind it too. */
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every(k => selected.has(k))
  const someVisibleSelected = visibleKeys.some(k => selected.has(k))

  const toggleVisible = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev)
      const all = visibleKeys.length > 0 && visibleKeys.every(k => next.has(k))
      for (const k of visibleKeys) { if (all) next.delete(k); else next.add(k) }
      return next
    })
  }, [visibleKeys])

  /* Rows that leave the grid leave the selection with them, or the count above
     the table stops matching what an action would touch. */
  const prune = useCallback((keep: Set<number>) => {
    setSelected(prev => {
      const next = new Set([...prev].filter(k => keep.has(k)))
      return next.size === prev.size ? prev : next
    })
  }, [])

  const selectedKeys = useMemo(() => [...selected], [selected])

  return { selected, selectedKeys, toggle, toggleVisible, clear, select, prune, allVisibleSelected, someVisibleSelected }
}
