/**
 * The narrowest a Review and Fix column can be without its header changing
 * on hover: the 12px cell padding each side, the 12px the drag grip adds on
 * hover, the 12px / 500 label, and the Required pill when the column has one.
 * Used as the column's default width (when wider than its own default) and as
 * its resize floor, so hovering a header never widens or clips it.
 *
 * Text is measured from a fixed table, not the canvas: widths are often worked
 * out before the Inter webfont has loaded, and the module apps load different
 * cuts of Inter. Each entry is the wider of the hub's and the Categories app's
 * Inter 500 advance for that character, at 100px (printable ASCII, 32 to 126).
 */
const INTER_500_AT_100 = [
  26.7,30.4,49.4,63.9,64.6,99.3,65.3,31.3,36.9,36.9,52.1,66.8,30.3,46.3,30.3,37,64.6,41.5,61.6,62.7,65.6,60.3,63,57.1,63,63,30.3,31.5,66.8,66.8,66.8,53.9,98.5,70.9,65.7,73.3,72.2,60.3,58.9,74.8,74.5,27.3,57.5,68.8,56.5,91.3,75.6,76.7,64.2,76.9,64.8,64.6,65.3,74,70.9,100.3,70.1,69.6,64.1,36.9,37,36.9,47.7,46.3,33.7,56.8,61.8,57.7,61.8,58.8,38,62,60.2,25.2,25.2,55.9,25.2,88.8,60.2,60.4,61.8,61.8,38.7,53.9,34,60.2,57.5,82.9,55.7,57.5,55.9,44,34.6,44,66.8,
];
const UNKNOWN_CHAR = 70;
const CELL_PADDING = 24;
const HOVER_GRIP = 12;
const GAP = 4;
/** RequiredPill: px-1.5 each side plus a 1px border each side. */
const PILL_CHROME = 14;
/** Rounding and sub-pixel text, so the label never truncates by a hair. */
const SLACK = 4;

function textWidth(text: string, sizePx: number): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    units += code >= 32 && code <= 126 ? INTER_500_AT_100[code - 32] : UNKNOWN_CHAR;
  }
  return (units * sizePx) / 100;
}

export function headerMinWidth(label: string, required = false): number {
  const pill = required ? GAP + textWidth("Required", 10.5) + PILL_CHROME : 0;
  return Math.ceil(CELL_PADDING + HOVER_GRIP + textWidth(label, 12) + pill + SLACK);
}
