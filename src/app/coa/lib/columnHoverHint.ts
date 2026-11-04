/* ──────────────────────────────────────────────────────────────────
 * A COLUMN'S HEADER ANSWERS TO THE WHOLE COLUMN
 *
 * Every table header opens its actions (sort, filter, hide, freeze) on click,
 * and hints at it with a faint icon on hover. Only on hover of the header
 * itself, though - a strip 40px tall that nobody aims for. Design review,
 * 2026-09-30 - Eli: *"if I'm in the hover state anywhere in the column, it
 * should show me this little thing showing up because I would not know that
 * it's just here."*
 *
 * One listener for the page rather than one per table: the pointer's cell is
 * matched to the header cell in the same position, which gets
 * `data-col-hover`, and CSS lifts the hint (`.coa-col-hint`) inside it. Rows
 * whose cells do not line up one to one with the header - a category row
 * spanning the table - are skipped rather than guessed at.
 * ────────────────────────────────────────────────────────────────── */

let current: HTMLTableCellElement | null = null

function clear() {
  current?.removeAttribute('data-col-hover')
  current = null
}

function onOver(e: MouseEvent) {
  const cell = (e.target as Element | null)?.closest?.('td')
  const row = cell?.parentElement as HTMLTableRowElement | null
  const table = cell?.closest('table')
  const head = table?.tHead?.rows[table.tHead.rows.length - 1]
  if (!cell || !row || !head || row.parentElement?.tagName === 'THEAD' || row.cells.length !== head.cells.length) { clear(); return }
  const th = head.cells[(cell as HTMLTableCellElement).cellIndex] as HTMLTableCellElement | undefined
  if (th === current) return
  clear()
  if (th) { th.setAttribute('data-col-hover', ''); current = th }
}

let installed = false
export function installColumnHoverHint() {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener('mouseover', onOver, { passive: true })
  document.addEventListener('mouseleave', clear)
}
