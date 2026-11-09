import { useCallback, useEffect, useRef, useState } from 'react'
import type { ColumnKey } from './reviewColumns'

export interface CellAddr { row: number; key: ColumnKey }

export const sameCell = (a: CellAddr | null, b: CellAddr | null) =>
  !!a && !!b && a.row === b.row && a.key === b.key

export type Move = 'up' | 'down' | 'left' | 'right' | 'none'

/**
 * Arrow-key movement through the grid, the way a spreadsheet moves. Right off
 * the last column wraps to the first column of the next row, left off the first
 * wraps back to the last of the previous.
 *
 * The page window is passed in, not the whole row set: moving down off the last
 * row of a page has to turn the page, or the grid appears to stop halfway
 * through the data.
 */
export function useCellNavigation({ pageRowKeys, columns, page, pageCount, setPage, enabled }: {
  pageRowKeys: number[]
  columns: ColumnKey[]
  page: number
  pageCount: number
  setPage: (p: number) => void
  enabled: boolean
}) {
  const [active, setActive] = useState<CellAddr | null>(null)
  const [editing, setEditing] = useState<CellAddr | null>(null)
  // Read inside the keydown listener, which is registered once.
  const ctx = useRef({ pageRowKeys, columns, page, pageCount })
  ctx.current = { pageRowKeys, columns, page, pageCount }

  const move = useCallback((from: CellAddr, dir: Move, keepEditing: boolean) => {
    if (dir === 'none') { setEditing(null); return }
    const { pageRowKeys: keys, columns: cols, page: p, pageCount: pc } = ctx.current
    let r = keys.indexOf(from.row)
    let c = cols.indexOf(from.key)
    if (r === -1 || c === -1) { setEditing(null); return }

    if (dir === 'left') { c--; if (c < 0) { c = cols.length - 1; r-- } }
    else if (dir === 'right') { c++; if (c >= cols.length) { c = 0; r++ } }
    else if (dir === 'up') r--
    else r++

    if (r < 0) {
      // Off the top of the page: step back a page and land on its last row.
      if (p <= 1) return
      setPage(p - 1)
      setActive(null); setEditing(null)
      return
    }
    if (r >= keys.length) {
      if (p >= pc) return
      setPage(p + 1)
      setActive(null); setEditing(null)
      return
    }
    const next = { row: keys[r], key: cols[c] }
    setActive(next)
    setEditing(keepEditing ? next : null)
  }, [setPage])

  const beginEdit = useCallback((addr: CellAddr) => { setActive(addr); setEditing(addr) }, [])
  const cancelEdit = useCallback(() => setEditing(null), [])

  /* An edit in progress on a row that has just left the page cannot be
     committed against anything, so it is dropped rather than left floating. */
  useEffect(() => {
    if (editing && !pageRowKeys.includes(editing.row)) setEditing(null)
    if (active && !pageRowKeys.includes(active.row)) setActive(null)
  }, [pageRowKeys, editing, active])

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      // An editor owns its own keys; only movement between cells is handled here.
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return
      const cur = active
      if (!cur) return
      const dir: Move | null =
        e.key === 'ArrowUp' ? 'up' : e.key === 'ArrowDown' ? 'down'
        : e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : null
      if (dir) { e.preventDefault(); move(cur, dir, false); return }
      if (e.key === 'Enter') { e.preventDefault(); setEditing(cur); return }
      if (e.key === 'Escape') { setActive(null); setEditing(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, active, move])

  /* Clicking away from the grid gives up the focused cell, so the arrow keys
     stop steering a table the user has left. */
  useEffect(() => {
    if (!enabled) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('td') || t.closest('[data-cell-dropdown]')) return
      setActive(null); setEditing(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [enabled])

  return { active, setActive, editing, beginEdit, cancelEdit, move }
}
