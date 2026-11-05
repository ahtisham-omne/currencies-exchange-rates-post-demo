/* Plain ESM, no TypeScript, no imports beyond textMeasure: the shared look of
 * every Omne listing export (Categories, Items, Partners, Partner Groups,
 * Users, Roles). Copy this file as-is into any repo that exports a listing;
 * it is byte-identical in radiant-core-fusion, nimble-palette,
 * partner-management-module and role-zen.
 *
 * The palette, fonts, borders and row heights are the import template's
 * (templateLayout.mjs / Omne_<Entity>_Import_Template.xlsx), so an export and
 * a template read as one family:
 *   XLSX  <Sheet>    row 1 navy band, row 2 dark header with an autoFilter,
 *                    white / zebra bordered rows, frozen under the header.
 *         Glossary   the template's Valid Values card: Column | What It Means.
 *   PDF   page 1 band + title block, dark table header on every page,
 *         running header and "Page X of Y" on every page. */

import { lineCount, textWidth, PX_PER_WIDTH, COLUMN_PX_OFFSET, CELL_PADDING_PX } from "./textMeasure.mjs";

/* ───────── palette (templateLayout.mjs) ───────── */
const INK = "FF1A1A18";
const MUTED = "FF6B6B66";
const WHITE = "FFFFFFFF";
const NAVY = "FF1D4E89";
const HEAD = "FF3A3A36";
const LINE = "FFD8D6D1";
const ZEBRA = "FFFAFAF8";
const SECTION = "FFF2F1EE";
const LABEL = "FFF7F6F3";
const FILL = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const THIN = { style: "thin", color: { argb: LINE } };
const BORDER4 = { left: THIN, right: THIN, top: THIN, bottom: THIN };
const F = (o) => ({ name: "Arial", size: 10, ...o });
const CELL_AL = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
/* Data rows: top-aligned, so a value taller than MAX_ROW_LINES loses only its tail. */
const DATA_AL = { horizontal: "left", vertical: "top", wrapText: true, indent: 1 };
const NUM_AL = { horizontal: "right", vertical: "top", wrapText: true, indent: 1 };

export const EXPORT_STYLES = {
  band: { font: { name: "Arial", size: 12, bold: true, color: { argb: WHITE } }, fill: FILL(NAVY), alignment: { horizontal: "left", vertical: "middle", indent: 1 } },
  title15: { font: { name: "Arial", size: 15, bold: true, color: { argb: INK } }, alignment: { vertical: "middle" } },
  sub10: { font: F({ color: { argb: MUTED } }), alignment: { vertical: "middle" } },
  section: { font: { name: "Arial", size: 11, bold: true, color: { argb: INK } }, fill: FILL(SECTION), border: BORDER4, alignment: CELL_AL },
  tblHdr: { font: F({ bold: true, color: { argb: WHITE } }), fill: FILL(HEAD), border: BORDER4, alignment: CELL_AL },
  label: { font: F({ color: { argb: INK } }), fill: FILL(LABEL), border: BORDER4, alignment: CELL_AL },
  cell: { font: F({ color: { argb: INK } }), fill: FILL(WHITE), border: BORDER4, alignment: CELL_AL },
  cellZebra: { font: F({ color: { argb: INK } }), fill: FILL(ZEBRA), border: BORDER4, alignment: CELL_AL },
  data: { font: F({ color: { argb: INK } }), fill: FILL(WHITE), border: BORDER4, alignment: DATA_AL },
  dataZebra: { font: F({ color: { argb: INK } }), fill: FILL(ZEBRA), border: BORDER4, alignment: DATA_AL },
};

export const MIDDLE_DOT_SEP = "  ·  "; // two spaces, middle dot, two spaces
export const BAND_HEIGHT = 32;
export const HEADER_HEIGHT = 24;
export const SPACER_HEIGHT = 18;
export const GLOSSARY_SHEET = "Glossary";
export const GLOSSARY_WIDTHS = [2, 30, 90];
/** Data columns: never narrower or wider than this (Excel width units). */
export const MIN_COL_WIDTH = 10;
export const MAX_COL_WIDTH = 45;
/** A data row grows to show at most this many wrapped lines; longer values
 *  stay whole in the cell (formula bar, or drag the row taller). */
export const MAX_ROW_LINES = 5;
/** PDF cells stop at this many lines and end in "…". */
export const PDF_MAX_LINES = 3;
/** PDF: a word up to this many characters is kept on one line. */
export const PDF_UNBREAKABLE_CHARS = 14;
const NUMERIC = /^-?[$€£]?\d[\d,]*(\.\d+)?%?$/;
/** Room the autoFilter dropdown takes at the right of a header cell, px. */
const FILTER_BUTTON_PX = 18;
/** Extra px on a fitted column: Excel snaps widths to whole pixels, so a value
 *  measured to fit exactly would wrap onto a second, clipped line. */
const FIT_SLACK_PX = 10;

/** "1 Oct 2026" */
export function displayDate(d = new Date()) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function colLetter(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Excel column width that fits `px` of Arial 10 text plus indent and padding. */
function widthForPx(px) {
  return (px + CELL_PADDING_PX - COLUMN_PX_OFFSET) / PX_PER_WIDTH;
}

/** The width Excel actually draws for a stored column width: measured in
 *  real Excel, every column reports COLUMN_PX_OFFSET / PX_PER_WIDTH (0.64)
 *  narrower than the width written to the file (45 shows as 44.36), so wraps
 *  are measured against that. */
function drawnWidth(w) {
  return w - COLUMN_PX_OFFSET / PX_PER_WIDTH;
}

/** Explicit padded height for a wrapped row (Excel never refits on open, and
 *  autofit leaves the last line touching the border). One line is 21.5. */
function rowHeight(cells, maxLines = Infinity) {
  let lines = 1;
  for (const [text, widths, bold] of cells) lines = Math.max(lines, lineCount(text, widths, !!bold));
  lines = Math.min(lines, maxLines);
  return Math.max(20, lines * 13.5 + 8);
}

function cellText(v, numFmt) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return numFmt && numFmt.includes("h") ? "0000-00-00 00:00" : "0000-00-00";
  return String(v);
}

function applyBand(ws, text, lastCol) {
  for (let c = 1; c <= lastCol; c++) Object.assign(ws.getCell(1, c), EXPORT_STYLES.band);
  ws.getCell(1, 1).value = text;
  ws.getRow(1).height = BAND_HEIGHT;
}

/**
 * The data sheet. `rows` hold strings, numbers, Dates or null; `numFmts[i]`
 * (optional) is the Excel format of column i (e.g. "yyyy-mm-dd" for Dates).
 * Row 1 band, row 2 header with an autoFilter over the whole table, frozen
 * under the header and after `freezeColumns` (default 1, the record name).
 */
export function addExportSheet(wb, { entity, sheetName, headers, rows, numFmts = [], freezeColumns = 1, date = new Date() }) {
  const S = EXPORT_STYLES;
  const n = headers.length;
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", xSplit: freezeColumns, ySplit: 2, topLeftCell: `${colLetter(freezeColumns + 1)}3`, showGridLines: false }],
  });

  /* Widths: the widest cell of each column (header plus filter button), clamped. */
  const widths = headers.map((h, i) => {
    let px = textWidth(h, true) + FILTER_BUTTON_PX;
    for (const r of rows) px = Math.max(px, textWidth(cellText(r[i], numFmts[i])));
    return Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, +widthForPx(px + FIT_SLACK_PX).toFixed(2)));
  });
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  applyBand(ws, `Omne${MIDDLE_DOT_SEP}${entity} Export${MIDDLE_DOT_SEP}${displayDate(date)}`, n);

  /* Header. The filter button sits over the right of each cell, so the
   * wrap is measured against the width minus the button. */
  const header = ws.getRow(2);
  headers.forEach((h, i) => Object.assign(header.getCell(i + 1), S.tblHdr, { value: h }));
  header.height = Math.max(
    HEADER_HEIGHT,
    rowHeight(headers.map((h, i) => [h, Math.max(1, drawnWidth(widths[i]) - FILTER_BUTTON_PX / PX_PER_WIDTH), true])),
  );

  rows.forEach((r, ri) => {
    const row = ws.getRow(3 + ri);
    const base = ri % 2 ? S.dataZebra : S.data;
    r.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      Object.assign(cell, base);
      if (typeof v === "number" || (typeof v === "string" && NUMERIC.test(v))) cell.alignment = NUM_AL;
      cell.value = v === "" || v === undefined ? null : v;
      if (numFmts[i]) cell.numFmt = numFmts[i];
    });
    row.height = rowHeight(r.map((v, i) => [cellText(v, numFmts[i]), drawnWidth(widths[i])]), MAX_ROW_LINES);
  });

  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2 + Math.max(rows.length, 1), column: n } };
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:2" };
  return ws;
}

/**
 * The Glossary sheet, laid out exactly like the import template's Valid
 * Values tab: band, title block, then one card (section row, dark
 * "Column | What It Means" header, zebra rows). `entries` are
 * [column label, existing description]; the descriptions are the ones the
 * Export modal already shows on each field's info icon, never new copy.
 */
export function addGlossarySheet(wb, { entity, sheetName, entries }) {
  const S = EXPORT_STYLES;
  const W = GLOSSARY_WIDTHS;
  const ws = wb.addWorksheet(GLOSSARY_SHEET, { views: [{ showGridLines: false }] });
  W.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  applyBand(ws, `Omne${MIDDLE_DOT_SEP}${entity} Export${MIDDLE_DOT_SEP}${GLOSSARY_SHEET}`, W.length);

  Object.assign(ws.getCell("B2"), S.title15, { value: GLOSSARY_SHEET });
  ws.getRow(2).height = 26;
  Object.assign(ws.getCell("B3"), S.sub10, { value: `${sheetName}${MIDDLE_DOT_SEP}${entries.length} columns` });
  ws.getRow(3).height = 18;
  ws.getRow(4).height = SPACER_HEIGHT;

  let r = 5;
  for (let c = 2; c <= 3; c++) Object.assign(ws.getCell(r, c), S.section);
  ws.getCell(r, 2).value = sheetName;
  ws.mergeCells(r, 2, r, 3);
  ws.getRow(r++).height = 24;
  Object.assign(ws.getCell(r, 2), S.tblHdr, { value: "Column" });
  Object.assign(ws.getCell(r, 3), S.tblHdr, { value: "What It Means" });
  ws.getRow(r++).height = 24;
  entries.forEach(([label, text], i) => {
    Object.assign(ws.getCell(r, 2), S.label, { value: label });
    Object.assign(ws.getCell(r, 3), i % 2 ? S.cellZebra : S.cell, { value: text || null });
    ws.getRow(r++).height = rowHeight([[label, W[1]], [text ?? "", W[2]]]);
  });
  return ws;
}

/* ───────── PDF (jsPDF + jspdf-autotable) ───────── */

const RGB = (argb) => [1, 3, 5].map((i) => parseInt(argb.slice(2).slice(i - 1, i + 1), 16));

/**
 * Build the listing PDF. `jsPDF` and `autoTable` are passed in so callers keep
 * their dynamic imports. `body` is strings. Returns the jsPDF doc (caller
 * saves it). A4 landscape up to 10 columns, A3 landscape beyond, so wide
 * exports wrap instead of collapsing every column to "Par...".
 */
/**
 * Column widths for the PDF table, in pt: each column wants its widest value
 * (capped), never less than its longest header word, then the columns above
 * their minimum shrink in proportion until the table fits `available`.
 */
function pdfColumnWidths(doc, headers, body, available, fontSize, pad) {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "bold");
  const min = headers.map((h) => Math.max(...h.split(/\s+/).map((w) => doc.getTextWidth(w))) + pad);
  /* Short tokens (numbers, dates, single words) are never split either; only
   * long ones such as emails and URLs may break. */
  doc.setFont("helvetica", "normal");
  headers.forEach((_, i) => {
    for (const r of body)
      for (const word of String(r[i] ?? "").split(/\s+/))
        if (word.length <= PDF_UNBREAKABLE_CHARS) min[i] = Math.max(min[i], doc.getTextWidth(word) + pad + 2);
  });
  const want = headers.map((_, i) => {
    let w = 0;
    for (const r of body) w = Math.max(w, doc.getTextWidth(r[i] ?? ""));
    return Math.max(min[i], Math.min(w + pad, 180));
  });
  const total = want.reduce((a, b) => a + b, 0);
  if (total <= available) return want.map((w) => (w * available) / total);
  const fixed = min.reduce((a, b) => a + b, 0);
  const k = Math.max(0, (available - fixed) / (total - fixed));
  return want.map((w, i) => min[i] + (w - min[i]) * k);
}

/** Wrap `text` to `width` and keep at most `max` lines, the last ending "…". */
function clampLines(doc, text, width, max) {
  const lines = doc.splitTextToSize(String(text ?? ""), width);
  if (lines.length <= max) return lines.join("\n");
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last && doc.getTextWidth(`${last}…`) > width) last = last.slice(0, -1);
  kept[max - 1] = `${last.replace(/[\s,]+$/, "")}…`;
  return kept.join("\n");
}

export function buildExportPdf(jsPDF, autoTable, { entity, headers, body, date = new Date() }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: headers.length > 10 ? "a3" : "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const M = 36;
  const dateStr = displayDate(date);
  const title = `${entity} Export`;
  const records = `${body.length} ${body.length === 1 ? "record" : "records"}${MIDDLE_DOT_SEP}${headers.length} columns`;

  /* Page 1 heading: navy band (as the XLSX row 1), title, record line. */
  doc.setFillColor(...RGB(NAVY));
  doc.rect(M, M, pageWidth - 2 * M, 26, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("Omne", M + 10, M + 17);
  doc.setFont("helvetica", "normal");
  doc.text(dateStr, pageWidth - M - 10, M + 17, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...RGB(INK));
  doc.text(title, M, M + 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...RGB(MUTED));
  doc.text(records, M, M + 74);

  /* Columns sized by content; a header word is never split; long cells stop at PDF_MAX_LINES. */
  const fontSize = headers.length > 16 ? 7 : 8;
  const pad = 12;
  const widths = pdfColumnWidths(doc, headers, body, pageWidth - 2 * M, fontSize, pad);
  const columnStyles = {};
  widths.forEach((w, i) => {
    const values = body.map((r) => r[i]).filter((v) => v !== "" && v != null);
    const numeric = values.length > 0 && values.every((v) => NUMERIC.test(String(v)));
    columnStyles[i] = { cellWidth: w, halign: numeric ? "right" : "left" };
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  const clamped = body.map((r) => r.map((v, i) => clampLines(doc, v, widths[i] - pad - 0.5, PDF_MAX_LINES)));

  autoTable(doc, {
    head: [headers],
    body: clamped,
    startY: M + 90,
    margin: { left: M, right: M, top: M + 26, bottom: M + 4 },
    styles: { font: "helvetica", fontSize, cellPadding: { top: 4, bottom: 4, left: 6, right: 6 }, overflow: "linebreak", valign: "middle", textColor: RGB(INK), lineColor: RGB(LINE), lineWidth: 0.4 },
    headStyles: { fillColor: RGB(HEAD), textColor: [255, 255, 255], fontStyle: "bold", valign: "middle" },
    bodyStyles: { fillColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: RGB(ZEBRA) },
    columnStyles,
    showHead: "everyPage",
  });

  /* Running header (pages 2+) and "Page X of Y" once the page count is final. */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...RGB(MUTED));
    if (p > 1) {
      doc.text(`Omne${MIDDLE_DOT_SEP}${title}`, M, M + 8);
      doc.text(dateStr, pageWidth - M, M + 8, { align: "right" });
    }
    doc.text(`Page ${p} of ${pages}`, pageWidth / 2, pageHeight - M / 2, { align: "center" });
  }
  return doc;
}
