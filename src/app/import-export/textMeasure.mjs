/* Plain ESM, self-contained (no imports): measures Arial 10 text the way
 * Excel lays it out, so a generator can set an explicit row height that fits
 * wrapped text exactly. Copy this file as-is into any repo that needs it.
 *
 * Calibrated 2026-09-30 against real Excel (private COM instance):
 * - Advance widths: each ASCII character (32 to 126) AutoFit in Excel at
 *   Arial 10 regular and bold, 10 vs 50 repeats, difference / 40, in px at
 *   96 dpi. Anything outside the table uses the width of "n".
 * - Column pixels: Excel column width w is w * 7.3333 + 4.67 px (measured at
 *   widths 30 and 100 in a workbook whose default font is Calibri 11).
 * - Usable width: column px minus 14.7 px (indent 1 plus cell padding). With
 *   this value the wrap below reproduced Excel AutoFit line counts on 1613
 *   wrapped cells of the Categories, Items, Users, Partners and Partner Groups
 *   templates with 0 under- and 0 over-predictions. The safe band is 14.6 to
 *   14.8 px: 14.5 or less under-predicts Categories Instructions row 34 (the
 *   Unit=factor text, whose first line is 723.4 px), 14.9 or more
 *   over-predicts a Partners Valid Values row. */

// prettier-ignore
const REGULAR = [4.08, 4.08, 4.77, 7.5, 7.5, 12.27, 8.87, 2.7, 4.77, 4.77, 5.45, 8.18, 4.08, 4.77, 4.08, 4.08, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 4.08, 4.08, 8.18, 8.18, 8.18, 7.5, 13.65, 8.87, 8.87, 9.55, 9.55, 8.87, 8.18, 10.9, 8.87, 4.08, 6.82, 8.87, 7.5, 11.58, 8.87, 10.9, 8.87, 10.9, 9.55, 8.87, 8.18, 8.87, 8.87, 12.97, 8.87, 9.55, 8.18, 4.08, 4.08, 4.08, 5.45, 7.5, 4.77, 7.5, 7.5, 6.82, 7.5, 7.5, 4.08, 7.5, 6.82, 2.7, 2.7, 6.82, 2.7, 10.9, 6.82, 7.5, 7.5, 7.5, 4.77, 6.82, 4.08, 6.82, 6.13, 10.23, 6.13, 6.82, 6.13, 4.77, 4.08, 4.77, 8.18];
// prettier-ignore
const BOLD = [4.08, 4.77, 6.13, 7.5, 7.5, 11.58, 9.55, 3.4, 4.77, 4.77, 5.45, 8.18, 4.08, 4.77, 4.08, 4.08, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 4.77, 4.77, 8.18, 8.18, 8.18, 8.18, 13.63, 8.87, 9.55, 9.55, 9.55, 8.87, 8.18, 10.9, 9.55, 3.4, 7.5, 9.55, 8.18, 11.58, 9.55, 10.9, 8.87, 10.9, 9.55, 8.87, 8.87, 9.55, 8.87, 12.97, 8.87, 8.87, 7.5, 4.77, 4.08, 4.77, 8.18, 7.5, 4.77, 7.5, 8.18, 7.5, 8.18, 7.5, 4.77, 8.18, 8.18, 3.4, 3.4, 7.5, 3.4, 11.58, 8.18, 8.18, 8.18, 8.18, 5.45, 7.5, 4.77, 8.18, 7.5, 10.23, 7.5, 7.5, 6.82, 5.45, 4.08, 5.45, 8.18];

export const PX_PER_WIDTH = 7.3333;
export const COLUMN_PX_OFFSET = 4.67;
export const CELL_PADDING_PX = 14.7;

/** Advance width in px of one character, Arial 10. */
export function charWidth(ch, bold = false) {
  const table = bold ? BOLD : REGULAR;
  const code = ch.charCodeAt(0);
  return code >= 32 && code <= 126 ? table[code - 32] : table[110 - 32];
}

/** Width in px of a run of text, Arial 10. */
export function textWidth(text, bold = false) {
  let w = 0;
  for (const ch of String(text ?? "")) w += charWidth(ch, bold);
  return w;
}

/** Usable text width in px of a cell spanning `widths` (one Excel column
 *  width, or an array of them for a merged range). */
export function usableWidth(widths) {
  const list = Array.isArray(widths) ? widths : [widths];
  const px = list.reduce((sum, w) => sum + w * PX_PER_WIDTH + COLUMN_PX_OFFSET, 0);
  return Math.max(1, px - CELL_PADDING_PX);
}

/** Lines Excel wraps `text` into in a cell of `widths`: breaks at spaces and
 *  after hyphens, splits a word longer than the line, "\n" starts a line. */
export function lineCount(text, widths, bold = false) {
  const max = usableWidth(widths);
  const space = charWidth(" ", bold);
  let total = 0;
  for (const para of String(text ?? "").split(/\r?\n/)) {
    let lines = 1;
    let cur = -1; // -1: nothing on the line yet
    for (const word of para.split(" ")) {
      const parts = word.match(/[^-]*-|[^-]+/g) ?? [""];
      parts.forEach((part, i) => {
        const w = textWidth(part, bold);
        const gap = i === 0 && cur > 0 ? space : 0;
        if (cur < 0) cur = w;
        else if (cur + gap + w <= max) cur += gap + w;
        else {
          lines++;
          cur = w;
        }
        while (cur > max) {
          lines++;
          cur -= max;
        }
      });
    }
    total += lines;
  }
  return Math.max(1, total);
}
