/* Plain ESM, no TypeScript: the four-sheet Omne import template layout,
 * reconstructed cell by cell from the User Access Control standard
 * (Omne_Users_Import_Template.xlsx). Used by BOTH the app
 * (`templateWorkbook.ts`, dynamic ExcelJS import) and the Node generator
 * (`scripts/gen-import-templates.mjs`), so the checked-in files and the
 * in-app download are produced by the same code.
 *
 * Everything under `data` (an EntityData from spec.data.mjs) is the entity
 * input; everything else here is the fixed layout and must not change per
 * entity. */

import { lineCount } from "./textMeasure.mjs";

/* ───────── fixed style system ───────── */
const INK = "FF1A1A18";
const MUTED = "FF6B6B66";
const WHITE = "FFFFFFFF";
const FILL = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const THIN = { style: "thin", color: { argb: "FFD8D6D1" } };
const BORDER4 = { left: THIN, right: THIN, top: THIN, bottom: THIN };
const F = (o) => ({ name: "Arial", size: 10, ...o });
/* Every reference-sheet table cell: wrap, vertically centred, left, indent 1 (inner padding). */
const CELL_AL = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
/* Data Entry rows 3 to 600: wrap inside the cell, never spill into the next one. */
const ENTRY_AL = { horizontal: "left", vertical: "top", wrapText: true };
const HEAD_AL = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };

export const TEMPLATE_STYLES = {
  banner: { font: { name: "Arial", size: 11, bold: true } },
  hdrReq: { font: F({ bold: true, color: { argb: WHITE } }), fill: FILL("FFC0392B"), border: BORDER4, alignment: { horizontal: "left", vertical: "middle", wrapText: true } },
  hdrOpt: { font: F({ bold: true, color: { argb: INK } }), fill: FILL("FFE8E6E1"), border: BORDER4, alignment: { horizontal: "left", vertical: "middle", wrapText: true } },
  example: { font: F({ italic: true, color: { argb: MUTED } }), fill: FILL("FFF2F1EE"), border: BORDER4, alignment: ENTRY_AL },
  /* Data Entry fillable grid (rows 5 to 600), every empty cell white */
  entry: { font: F({ color: { argb: INK } }), fill: FILL(WHITE), border: BORDER4, alignment: ENTRY_AL },
  /* plain title blocks, no borders */
  /* heading band, row 1 of every tab (no borders, not merged) */
  band: { font: { name: "Arial", size: 12, bold: true, color: { argb: WHITE } }, fill: FILL("FF1D4E89"), alignment: { horizontal: "left", vertical: "middle", indent: 1 } },
  title15: { font: { name: "Arial", size: 15, bold: true, color: { argb: INK } }, alignment: { vertical: "middle" } },
  sub10: { font: F({ color: { argb: MUTED } }), alignment: { vertical: "middle" } },
  /* bordered reference tables */
  section: { font: { name: "Arial", size: 11, bold: true, color: { argb: INK } }, fill: FILL("FFF2F1EE"), border: BORDER4, alignment: HEAD_AL },
  label: { font: F({ bold: true, color: { argb: INK } }), fill: FILL("FFF7F6F3"), border: BORDER4, alignment: CELL_AL },
  value: { font: F({ color: { argb: INK } }), fill: FILL("FFF7F6F3"), border: BORDER4, alignment: CELL_AL },
  cell: { font: F({ color: { argb: INK } }), fill: FILL(WHITE), border: BORDER4, alignment: CELL_AL },
  cellZebra: { font: F({ color: { argb: INK } }), fill: FILL("FFFAFAF8"), border: BORDER4, alignment: CELL_AL },
  note: { font: F({ italic: true, color: { argb: MUTED } }), fill: FILL(WHITE), border: BORDER4, alignment: CELL_AL },
  tblHdr: { font: F({ bold: true, color: { argb: WHITE } }), fill: FILL("FF3A3A36"), border: BORDER4, alignment: HEAD_AL },
  cmpHdr: { font: F({ bold: true, color: { argb: WHITE } }), fill: FILL("FF1D4E89"), border: BORDER4, alignment: HEAD_AL },
  reqCell: { font: F({ color: { argb: INK } }), fill: FILL("FFFBE9E7"), border: BORDER4, alignment: CELL_AL },
  reqYes: { font: F({ bold: true, color: { argb: "FFC0392B" } }), fill: FILL("FFFBE9E7"), border: BORDER4, alignment: CELL_AL },
};

/** Column widths of the reference sheets (Excel character units). */
export const INSTRUCTIONS_WIDTHS = [2, 30, 100];
export const FIELD_REFERENCE_WIDTHS = [26, 11, 56, 22, 30, 28];
export const VALID_VALUES_WIDTHS = [2, 30, 90];
/** Sheet default row height on Data Entry; rows 3 to 600 carry no explicit
 *  height so Excel autofits them as the user types. */
export const ENTRY_ROW_HEIGHT = 20;
/** Every spacer row on every tab (title block to first table, between tables). */
export const SPACER_HEIGHT = 18;
/** No row may be set shorter than this. */
export const MIN_ROW_HEIGHT = 15;

export const DATA_ENTRY_SHEET = "Data Entry";
export const DATA_ROWS = 600;
export const MIDDLE_DOT_SEP = "  ·  "; // two spaces, middle dot, two spaces
export const BANNER = (title) => `Omne${MIDDLE_DOT_SEP}${title}`;
/** Row 1 band text: "Omne  ·  <Entities> Import Template  ·  <Sheet name>". */
export const BAND_TEXT = (entity, sheet) => BANNER(`${entity} Import Template${MIDDLE_DOT_SEP}${sheet}`);
export const BAND_HEIGHT = 32;
export const FIELD_REFERENCE_HEADERS = ["Field", "Required", "Description", "Format", "Valid Values", "Example"];

export function colLetter(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Header row exactly as the file carries it: " *" suffix on required. */
export function templateHeaders(data) {
  return data.columns.map((c) => (c.required ? `${c.label} *` : c.label));
}

/** Instructions B4 line, computed so it can never drift from the columns. */
export function countLine(data) {
  const n = data.columns.length;
  const req = data.columns.filter((c) => c.required).length;
  return `${n} columns${MIDDLE_DOT_SEP}${req} required, ${n - req} optional`;
}

function put(ws, addr, value, style, numFmt) {
  const c = ws.getCell(addr);
  c.value = value;
  if (style) Object.assign(c, style);
  if (numFmt) c.numFmt = numFmt;
  return c;
}

/** Explicit padded height for a wrapped table row (autofit leaves the last
 *  line touching the border and never fits merged cells). `cells` is a list
 *  of [text, widths, bold?]; widths is one column width or the array of
 *  widths of a merged range. Lines come from real Arial 10 measurement
 *  (textMeasure.mjs), so a one-line row is 21.5. */
export function wrappedRowHeight(cells) {
  let lines = 1;
  for (const [text, widths, bold] of cells) lines = Math.max(lines, lineCount(text, widths, !!bold));
  return Math.max(20, lines * 13.5 + 8);
}

/** Row 1 brand band: A1 text, band fill on every cell A..lastCol, height 32. */
export function applyHeadingBand(ws, text, lastCol) {
  for (let c = 1; c <= lastCol; c++) Object.assign(ws.getCell(1, c), TEMPLATE_STYLES.band);
  ws.getCell(1, 1).value = text;
  ws.getRow(1).height = BAND_HEIGHT;
}

/** Rows 2-4 title block under the band, then one 18-high spacer row.
 *  Returns the first table row. */
function titleBlock(ws, col, title, subtitle, meta) {
  const S = TEMPLATE_STYLES;
  const L = colLetter(col);
  put(ws, `${L}2`, title, S.title15);
  ws.getRow(2).height = 26;
  put(ws, `${L}3`, subtitle, S.sub10);
  ws.getRow(3).height = 18;
  let r = 4;
  if (meta) {
    put(ws, `${L}${r}`, meta, S.sub10);
    ws.getRow(r++).height = 18;
  }
  ws.getRow(r).height = SPACER_HEIGHT;
  return r + 1;
}

/** Value in the first cell, the style on every cell of the range (so the
 *  border draws on all sides of the merged block), then merge. */
function putMerged(ws, row, fromCol, toCol, value, style) {
  for (let c = fromCol; c <= toCol; c++) Object.assign(ws.getCell(row, c), style);
  ws.getCell(row, fromCol).value = value;
  ws.mergeCells(row, fromCol, row, toCol);
}

/**
 * The fillable Data Entry grid: every cell of `columns` (a list of
 * { required, text }) in rows `fromRow` to `toRow` gets thin borders, Arial
 * 10, wrap / top / left, the column's numFmt, no explicit height, white fill (no
 * required tint). Shared by the template and the failed-rows export.
 */
export function applyDataEntryGrid(ws, columns, fromRow, toRow) {
  const S = TEMPLATE_STYLES;
  for (let r = fromRow; r <= toRow; r++) {
    const row = ws.getRow(r);
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      Object.assign(cell, S.entry);
      if (c.text) cell.numFmt = "@";
    });
  }
}

/**
 * Build the four-sheet workbook. `ExcelJS` is the exceljs module (passed in
 * so the browser can dynamic-import it and Node can static-import it).
 */
export function buildTemplateWorkbook(ExcelJS, data) {
  const S = TEMPLATE_STYLES;
  const wb = new ExcelJS.Workbook();
  const cols = data.columns;
  const headers = templateHeaders(data);
  const freeze = data.freezeColumns ?? cols.filter((c) => c.required).length;

  /* Sheet 1: Data Entry */
  const de = wb.addWorksheet(DATA_ENTRY_SHEET, {
    views: [{ state: "frozen", xSplit: freeze, ySplit: 2, topLeftCell: `${colLetter(freeze + 1)}3`, showGridLines: false }],
  });
  de.properties.defaultRowHeight = ENTRY_ROW_HEIGHT;
  cols.forEach((c, i) => {
    de.getColumn(i + 1).width = c.width ?? Math.max(14, +(c.label.length * 0.95).toFixed(2));
  });
  applyHeadingBand(de, BAND_TEXT(data.entity, DATA_ENTRY_SHEET), cols.length);
  de.getRow(2).height = 30;
  headers.forEach((h, i) => put(de, `${colLetter(i + 1)}2`, h, cols[i].required ? S.hdrReq : S.hdrOpt));
  data.examples.forEach((row, r) =>
    cols.forEach((c, i) => put(de, `${colLetter(i + 1)}${3 + r}`, row[i] || null, S.example, c.text ? "@" : undefined)),
  );
  applyDataEntryGrid(de, cols, 3 + data.examples.length, DATA_ROWS);

  /* Sheet 2: Instructions */
  const ins = wb.addWorksheet("Instructions", { views: [{ showGridLines: false }] });
  const IW = INSTRUCTIONS_WIDTHS;
  IW.forEach((w, i) => (ins.getColumn(i + 1).width = w));
  const insTextW = IW.slice(1, 3); // merged B:C
  applyHeadingBand(ins, BAND_TEXT(data.entity, "Instructions"), IW.length);
  let r = titleBlock(ins, 2, "Instructions", data.moduleLine, countLine(data));
  /* Every section is a card over B:C, styled exactly like a Valid Values block. */
  const insCard = (title, header, items, intro) => {
    putMerged(ins, r, 2, 3, title, S.section);
    ins.getRow(r++).height = 24;
    if (intro) {
      putMerged(ins, r, 2, 3, intro, S.cell);
      ins.getRow(r++).height = wrappedRowHeight([[intro, insTextW]]);
    }
    if (items.length && header) {
      put(ins, `B${r}`, header[0], S.tblHdr);
      put(ins, `C${r}`, header[1], S.tblHdr);
      ins.getRow(r++).height = 24;
    }
    items.forEach(([label, body], i) => {
      put(ins, `B${r}`, label, S.value);
      put(ins, `C${r}`, body, i % 2 ? S.cellZebra : S.cell);
      ins.getRow(r++).height = wrappedRowHeight([[label, IW[1]], [body, IW[2]]]);
    });
  };
  const cardHeader = (heading) =>
    /MATCHED/i.test(heading) ? ["Case", "What Happens"] : ["Topic", "Details"];
  insCard("Quick Start", ["Step", "What to Do"], data.instructions.quickStart.map((t, i) => [`Step ${i + 1}`, t]));
  for (const sec of data.instructions.sections) {
    ins.getRow(r++).height = SPACER_HEIGHT; // unbordered spacer row
    insCard(sec.heading, cardHeader(sec.heading), sec.items ?? [], sec.intro);
  }

  /* Sheet 3: Field Reference */
  const fr = wb.addWorksheet("Field Reference", { views: [{ showGridLines: false }] });
  const FW = FIELD_REFERENCE_WIDTHS;
  FW.forEach((w, i) => (fr.getColumn(i + 1).width = w));
  applyHeadingBand(fr, BAND_TEXT(data.entity, "Field Reference"), FW.length);
  r = titleBlock(fr, 1, "Field Reference", data.frSubtitle);
  /* Both tables are cards styled exactly like a Valid Values block. */
  if (data.compareTable) {
    const ct = data.compareTable;
    putMerged(fr, r, 1, 6, ct.heading, S.section);
    fr.getRow(r++).height = 24;
    put(fr, `A${r}`, null, S.tblHdr);
    putMerged(fr, r, 2, 3, ct.colHeaders[0], S.tblHdr);
    putMerged(fr, r, 4, 6, ct.colHeaders[1], S.tblHdr);
    fr.getRow(r++).height = 24;
    const newW = FW.slice(1, 3); // merged B:C
    const oldW = FW.slice(3, 6); // merged D:F
    ct.rows.forEach(([a, b, c], i) => {
      const body = i % 2 ? S.cellZebra : S.cell;
      put(fr, `A${r}`, a, S.value);
      putMerged(fr, r, 2, 3, b, body);
      putMerged(fr, r, 4, 6, c, body);
      fr.getRow(r++).height = wrappedRowHeight([[a, FW[0]], [b, newW], [c, oldW]]);
    });
    if (ct.mergedLast) {
      const [a, b] = ct.mergedLast;
      put(fr, `A${r}`, a, S.value);
      putMerged(fr, r, 2, 6, b, ct.rows.length % 2 ? S.cellZebra : S.cell);
      fr.getRow(r++).height = wrappedRowHeight([[a, FW[0]], [b, FW.slice(1, 6)]]);
    }
    fr.getRow(r++).height = SPACER_HEIGHT; // spacer between the two cards
  }
  putMerged(fr, r, 1, 6, "All Columns", S.section);
  fr.getRow(r++).height = 24;
  FIELD_REFERENCE_HEADERS.forEach((h, i) => put(fr, `${colLetter(i + 1)}${r}`, h, S.tblHdr));
  fr.getRow(r++).height = 24;
  let optional = 0;
  for (const c of cols) {
    const zebra = c.required ? null : optional++ % 2 ? S.cellZebra : S.cell;
    const vals = [c.label, c.required ? "Yes" : "No", c.ref.description ?? c.description, c.ref.format, c.ref.validValues ?? null, c.ref.example];
    vals.forEach((v, i) => {
      const st = c.required ? (i === 1 ? S.reqYes : S.reqCell) : i === 0 ? S.value : zebra;
      put(fr, `${colLetter(i + 1)}${r}`, v, st);
    });
    fr.getRow(r++).height = wrappedRowHeight(vals.map((v, i) => [v, FW[i]]));
  }

  /* Sheet 4: Valid Values */
  const vv = wb.addWorksheet("Valid Values", { views: [{ showGridLines: false }] });
  const VW = VALID_VALUES_WIDTHS;
  VW.forEach((w, i) => (vv.getColumn(i + 1).width = w));
  const vvTextW = VW.slice(1, 3); // merged B:C
  applyHeadingBand(vv, BAND_TEXT(data.entity, "Valid Values"), VW.length);
  r = titleBlock(vv, 2, "Valid Values & Reference", "Use these exact values in the Data Entry sheet.");
  for (const block of data.validValues) {
    putMerged(vv, r, 2, 3, block.heading, S.section);
    vv.getRow(r++).height = Math.max(24, wrappedRowHeight([[block.heading, vvTextW, true]]));
    if (block.subHeader) {
      put(vv, `B${r}`, block.subHeader[0], S.tblHdr);
      put(vv, `C${r}`, block.subHeader[1], S.tblHdr);
      vv.getRow(r++).height = 24;
    }
    (block.rows ?? []).forEach(([label, body], i) => {
      put(vv, `B${r}`, label, S.value);
      put(vv, `C${r}`, body, i % 2 ? S.cellZebra : S.cell);
      vv.getRow(r++).height = wrappedRowHeight([[label, VW[1]], [body, VW[2]]]);
    });
    if (block.note) {
      putMerged(vv, r, 2, 3, block.note, S.note);
      vv.getRow(r++).height = wrappedRowHeight([[block.note, vvTextW]]);
    }
    vv.getRow(r++).height = SPACER_HEIGHT; // unbordered spacer row
  }

  return wb;
}
