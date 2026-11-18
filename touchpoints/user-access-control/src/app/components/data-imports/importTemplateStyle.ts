/* The one styling standard for every downloadable import template workbook.
 *
 * Shared by three writers so the family always matches:
 *   - scripts/restyle-import-templates.mjs (Users and Roles 4-sheet templates),
 *   - gen-templates.mjs (Quotes and Sales Orders single-sheet templates),
 *   - importTemplateExport.ts / rolesImportTemplateExport.ts (the in-app
 *     failed-rows and warning-rows downloads).
 * The Node scripts import this file directly (Node strips the types), so it
 * must stay dependency-free: type-only imports and plain objects only. */

import type { Alignment, Borders, Cell, Fill, Font, Worksheet } from "exceljs";

/** Palette, ARGB. */
export const TPL = {
  border: "FFD8D6D1",
  strongBorder: "FF3A3A36",
  headerFill: "FF3A3A36",
  compareHeaderFill: "FF1D4E89",
  requiredTint: "FFFBE9E7",
  requiredText: "FFC0392B",
  requiredEntryTint: "FFFDF5F4",
  optionalHeaderFill: "FFE8E6E1",
  labelFill: "FFF7F6F3",
  zebra: "FFFAFAF8",
  sectionFill: "FFF2F1EE",
  exampleFill: "FFF2F1EE",
  muted: "FF6B6B66",
  body: "FF1A1A18",
  white: "FFFFFFFF",
} as const;

export const TPL_FONT = "Arial";
/** Last row of the empty, bordered Data Entry grid. */
export const DATA_ENTRY_LAST_ROW = 600;
export const DATA_ENTRY_ROW_HEIGHT = 20;
export const DATA_ENTRY_HEADER_HEIGHT = 30;

export function thinBorder(): Partial<Borders> {
  const side = { style: "thin" as const, color: { argb: TPL.border } };
  return { top: { ...side }, left: { ...side }, bottom: { ...side }, right: { ...side } };
}

export function solid(argb: string): Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export function font(opts: Partial<Font> = {}): Partial<Font> {
  return { name: TPL_FONT, size: 10, color: { argb: TPL.body }, ...opts };
}

/** Replace a cell's whole style with a fresh object. Loaded workbooks can
 *  share one style object across cells, so styles are never mutated. */
export function setStyle(
  cell: Cell,
  s: { font?: Partial<Font>; fill?: Fill; border?: Partial<Borders>; alignment?: Partial<Alignment>; numFmt?: string },
): void {
  const next: Record<string, unknown> = {};
  if (s.font) next.font = s.font;
  if (s.fill) next.fill = s.fill;
  if (s.border) next.border = s.border;
  if (s.alignment) next.alignment = s.alignment;
  if (s.numFmt) next.numFmt = s.numFmt;
  cell.style = next as Cell["style"];
}

/** Row 1 banner. */
export function styleDataEntryBanner(sheet: Worksheet): void {
  const cell = sheet.getCell(1, 1);
  setStyle(cell, { font: { name: TPL_FONT, bold: true, size: 11 }, numFmt: cell.numFmt });
}

/** Heading band on row 1 of every tab (Users template): brand blue, Arial
 *  12 bold white, height 32. Not merged: every cell from A to `lastCol` gets
 *  the fill and only A1 holds text, so the text overflows across the band. */
export function styleHeadingBand(sheet: Worksheet, text: string, lastCol: number): void {
  for (let c = 1; c <= lastCol; c++) {
    const cell = sheet.getCell(1, c);
    cell.value = c === 1 ? text : null;
    setStyle(cell, {
      font: font({ bold: true, size: 12, color: { argb: TPL.white } }),
      fill: solid(TPL.compareHeaderFill),
      alignment: { vertical: "middle", horizontal: "left", indent: 1 },
    });
  }
  sheet.getRow(1).height = 32;
}

/** Header row: required columns white bold on red, optional dark bold on
 *  warm grey, every cell bordered, height 30. */
export function styleDataEntryHeader(sheet: Worksheet, rowNumber: number, required: readonly boolean[]): void {
  required.forEach((req, i) => {
    setStyle(sheet.getCell(rowNumber, i + 1), {
      font: font({ bold: true, color: { argb: req ? TPL.white : TPL.body } }),
      fill: solid(req ? TPL.requiredText : TPL.optionalHeaderFill),
      border: thinBorder(),
      alignment: { horizontal: "left", vertical: "middle", wrapText: true },
    });
  });
  sheet.getRow(rowNumber).height = DATA_ENTRY_HEADER_HEIGHT;
}

/** Example row: italic muted text on a light grey fill, bordered. */
export function styleDataEntryExampleRow(
  sheet: Worksheet,
  rowNumber: number,
  colCount: number,
  numFmts: readonly (string | undefined)[] = [],
): void {
  for (let c = 1; c <= colCount; c++) {
    setStyle(sheet.getCell(rowNumber, c), {
      font: font({ italic: true, color: { argb: TPL.muted } }),
      fill: solid(TPL.exampleFill),
      border: thinBorder(),
      alignment: { vertical: "top" },
      numFmt: numFmts[c - 1],
    });
  }
}

/** The empty grid users type into: every row from `firstRow` to `lastRow`
 *  (default 600) gets thin borders on every template column, a white fill
 *  (a very light red tint on required columns), Arial 10, vertical middle,
 *  the column's number format, and a height of 20. Values already in those
 *  cells are kept. */
export function applyDataEntryGrid(
  sheet: Worksheet,
  opts: {
    firstRow: number;
    required: readonly boolean[];
    numFmts?: readonly (string | undefined)[];
    lastRow?: number;
    /** Tint empty required cells FDF5F4 (default true). */
    tintRequired?: boolean;
  },
): void {
  const last = Math.max(opts.lastRow ?? DATA_ENTRY_LAST_ROW, opts.firstRow);
  for (let r = opts.firstRow; r <= last; r++) {
    const row = sheet.getRow(r);
    row.height = DATA_ENTRY_ROW_HEIGHT;
    opts.required.forEach((req, i) => {
      setStyle(row.getCell(i + 1), {
        font: font(),
        fill: solid(req && opts.tintRequired !== false ? TPL.requiredEntryTint : TPL.white),
        border: thinBorder(),
        alignment: { vertical: "middle" },
        numFmt: opts.numFmts?.[i],
      });
    });
  }
}

/** Data Entry cell structure (Users template): typed text wraps inside its
 *  own cell instead of spilling into the next one. Rows `firstRow` to
 *  `lastRow` get wrapText, top, left on every template column and NO
 *  explicit height, so Excel autofits a row as the user types; the sheet
 *  default height of 20 keeps the empty grid roomy. Freeze through the
 *  header row only, so the frozen-pane divider sits under the headers, not
 *  under the examples. Borders, fonts, fills and number formats are kept. */
export function applyDataEntryCellStructure(
  sheet: Worksheet,
  opts: { firstRow: number; lastRow: number; colCount: number; xSplit: number },
): void {
  for (let r = opts.firstRow; r <= opts.lastRow; r++) {
    const row = sheet.getRow(r);
    row.height = undefined as unknown as number;
    for (let c = 1; c <= opts.colCount; c++) {
      const cell = row.getCell(c);
      setStyle(cell, {
        font: cell.font ? { ...cell.font } : undefined,
        fill: cell.fill ? ({ ...cell.fill } as Fill) : undefined,
        border: cell.border ? { ...cell.border } : undefined,
        alignment: { wrapText: true, vertical: "top", horizontal: "left" },
        numFmt: cell.numFmt,
      });
    }
  }
  sheet.properties.defaultRowHeight = DATA_ENTRY_ROW_HEIGHT;
  const col = String.fromCharCode(65 + opts.xSplit);
  sheet.views = [
    { state: "frozen", xSplit: opts.xSplit, ySplit: 2, topLeftCell: `${col}3`, showGridLines: false },
  ];
}
