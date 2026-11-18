/* ═══════════════════════════════════════════
   Hover-popover list sizing
   ───────────────────────────────────────────
   Every "+N more" popover shows the same number of rows before it scrolls, so
   they read as one control rather than four that happen to look alike. The
   count steps down on short viewports: a popover taller than the window gets
   flipped above the trigger by each caller's own positioning pass, and a list
   that never fits either way just scrolls off screen.

   Callers multiply by their own row height, which differs by content:
   avatar rows are taller than plain text rows.
   ═══════════════════════════════════════════ */

/** Rows visible before the list scrolls, on a normal viewport. */
export const POPOVER_VISIBLE_ROWS = 5;

/** Rows visible before the list scrolls, stepped down on short viewports. */
export function popoverVisibleRows(): number {
  if (typeof window === "undefined") return POPOVER_VISIBLE_ROWS;
  const h = window.innerHeight;
  if (h < 600) return 3;
  if (h < 768) return 4;
  return POPOVER_VISIBLE_ROWS;
}

/**
 * Max height for a scrolling popover list, or `undefined` when everything
 * fits and the list should size to its content.
 *
 * @param itemCount how many rows the list will render
 * @param rowH      height of one row in px, including its vertical padding
 */
export function popoverListMaxHeight(
  itemCount: number,
  rowH: number,
): number | undefined {
  const rows = popoverVisibleRows();
  return itemCount > rows ? rows * rowH : undefined;
}
