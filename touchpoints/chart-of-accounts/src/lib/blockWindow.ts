// How many records a block holds: fifty, by Mahad's ask below.
export const BLOCK_SIZE = 50

/* Which blocks of a long list are drawn, for a list that draws its rows a block
   at a time rather than a row at a time.

   Mahad, 2026-11-03, for the Journal entries tab: *"the first 50 items are
   visible. As you scroll down, the next 50 items should load, meaning at any
   given time, a maximum of 100 rows should be visible. When you scroll past the
   first 50 to load the next 50, the initial 50 should disappear ... but when you
   scroll back up, they will reload."*

   So the list is cut into blocks, and at most two are drawn: the block holding
   the top of the viewport, and the neighbour the reader is heading for once they
   are within `margin` of it. Every block not drawn is stood in for by a spacer
   as tall as it, which is what keeps the scrollbar honest and the rows still.

   `offsets` holds where each block starts, with the list's full height last, so
   block `b` spans `offsets[b]` to `offsets[b + 1]`. `top` and `bottom` are the
   edges of what the reader can see, in the same coordinates. */
export function blocksInView(
  offsets: number[], top: number, bottom: number, margin: number,
): { first: number; last: number } {
  const n = offsets.length - 1
  if (n <= 1) return { first: 0, last: 0 }
  let b = 0
  while (b < n - 1 && offsets[b + 1] <= top) b++
  // How close the reader is to the block below and to the one above.
  const toNext = b + 1 < n ? offsets[b + 1] - bottom : Infinity
  const toPrev = b > 0 ? top - offsets[b] : Infinity
  const down = toNext <= margin
  const up = toPrev <= margin
  // Both near, on a screen taller than a block: draw whichever is nearer.
  if (down && (!up || toNext <= toPrev)) return { first: b, last: b + 1 }
  if (up) return { first: b - 1, last: b }
  return { first: b, last: b }
}

// The start of every block and the full height last; see `blocksInView`.
export function blockOffsets(heights: number[]): number[] {
  const out = [0]
  for (const h of heights) out.push(out[out.length - 1] + h)
  return out
}
