/* Restyles the shipped Users and Roles import templates to the shared import
 * template standard (see src/app/components/data-imports/importTemplateStyle.ts).
 *
 * The two workbooks were generated outside this repo, so there is no generator
 * to edit. This script loads each one with exceljs, finds its tables and
 * section rows by their current structure, and restyles them in place. No
 * text, column, header or example value is changed.
 *
 * The untouched originals live in public/templates/_originals/. The first run
 * copies them there; every run restyles from that copy, so re-running always
 * writes the same bytes (the zip entries and core properties carry a pinned
 * date).
 *
 *   node scripts/restyle-import-templates.mjs
 */
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TPL,
  TPL_FONT,
  DATA_ENTRY_HEADER_HEIGHT,
  applyDataEntryCellStructure,
  applyDataEntryGrid,
  font,
  setStyle,
  solid,
  styleDataEntryBanner,
  styleDataEntryExampleRow,
  styleDataEntryHeader,
  styleHeadingBand,
  thinBorder,
} from "../src/app/components/data-imports/importTemplateStyle.ts";
import { lineCount as measuredLineCount } from "../src/app/components/data-imports/textMeasure.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES = path.join(ROOT, "public", "templates");
const ORIGINALS = path.join(TEMPLATES, "_originals");
const FILES = ["OMNE_Users_Import_Template.xlsx", "OMNE_Roles_Import_Template.xlsx"];
const PINNED = new Date(Date.UTC(2026, 0, 1));
/* Templates that get the consistent heading band on every tab and an
 * untinted Data Entry grid (brief addendum 2). Value = the entity name. */
const HEADING = { "OMNE_Users_Import_Template.xlsx": "Users" };

/* ---------- helpers ---------- */

const text = (cell) => (cell.value == null ? "" : String(cell.text ?? "").trim());
const isBold = (cell) => Boolean(cell.font?.bold);
const fontSize = (cell) => cell.font?.size ?? 11;
const fillOf = (cell) => {
  const argb = cell.fill?.fgColor?.argb;
  return argb ? argb.slice(-6).toUpperCase() : "";
};

/** Wrapped, top, left, padded: every reference table cell. */
const cellAlign = (extra = {}) => ({ wrapText: true, vertical: "top", horizontal: "left", indent: 1, ...extra });
const headAlign = () => cellAlign({ vertical: "middle" });

function colWidth(ws, c) {
  return ws.getColumn(c).width ?? 9;
}

/** Lines of wrapped text in a span of the given total width. */
function lineCount(value, totalWidth) {
  const perLine = Math.max(1, Math.floor(totalWidth * 1.15));
  return String(value)
    .split(/\r?\n/)
    .reduce((n, p) => n + Math.max(1, Math.ceil(p.length / perLine)), 0);
}

/** Explicit height for a wrapped table row. Excel's autofit leaves the last
 *  line touching the bottom border (and never autofits merged cells), so
 *  every wrapped row gets a padded height. `spans` = [[firstCol, lastCol,
 *  text], ...], one per cell or merged range in the row. */
function computedHeight(ws, spans) {
  let lines = 1;
  for (const [c1, c2, value] of spans) {
    let w = 0;
    for (let c = c1; c <= c2; c++) w += colWidth(ws, c);
    lines = Math.max(lines, lineCount(value, w));
  }
  return Math.max(20, lines * 13.5 + 9);
}

function unmergeRow(ws, r, c1, c2) {
  for (const range of [...(ws.model.merges ?? [])]) {
    const [a, b] = range.split(":");
    const ca = ws.getCell(a), cb = ws.getCell(b);
    if (ca.row <= r && cb.row >= r && cb.col >= c1 && ca.col <= c2) ws.unMergeCells(range);
  }
}

function merge(ws, r, c1, c2) {
  if (c2 > c1) ws.mergeCells(r, c1, r, c2);
}

/** Style every cell of a span (Excel draws merged borders per cell). */
function styleSpan(ws, r, c1, c2, style) {
  for (let c = c1; c <= c2; c++) setStyle(ws.getCell(r, c), style);
}

/** Plain text above the tables: keep it plain, just make it Arial. */
function arialPlain(ws, r) {
  ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
    if (cell.value == null) return;
    const f = cell.font ?? {};
    setStyle(cell, {
      font: { ...f, name: TPL_FONT, size: f.size ?? 10 },
      alignment: cell.alignment ? { ...cell.alignment } : undefined,
      numFmt: cell.numFmt,
    });
  });
}

function sectionTitle(ws, r, c1, c2) {
  unmergeRow(ws, r, c1, c2);
  merge(ws, r, c1, c2);
  styleSpan(ws, r, c1, c2, {
    font: font({ bold: true, size: 11 }),
    fill: solid(TPL.sectionFill),
    border: thinBorder(),
    alignment: headAlign(),
  });
  ws.getRow(r).height = 24;
}

/* ---------- Data Entry ---------- */

function dataEntryHeaders(ws) {
  const headers = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    const t = text(ws.getCell(2, c));
    if (!t) break;
    headers.push(t);
  }
  return headers;
}

function restyleDataEntry(ws, { tintRequired = true } = {}) {
  const headerRow = ws.getRow(2);
  const headers = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    const t = text(headerRow.getCell(c));
    if (!t) break;
    headers.push(t);
  }
  const colCount = headers.length;
  const required = headers.map((h) => /\s\*$/.test(h));
  /* Keep each column's number format (text "@" on dates and phones). */
  const numFmts = headers.map((_, i) => {
    const probe = [ws.getCell(5, i + 1), ws.getCell(3, i + 1)].find((cell) => cell.numFmt && cell.numFmt !== "General");
    return probe?.numFmt;
  });

  styleDataEntryBanner(ws);
  styleDataEntryHeader(ws, 2, required);

  let r = 3;
  while (r <= ws.rowCount) {
    const row = ws.getRow(r);
    let any = false;
    for (let c = 1; c <= colCount; c++) if (text(row.getCell(c))) any = true;
    if (!any) break;
    styleDataEntryExampleRow(ws, r, colCount, numFmts);
    r++;
  }
  applyDataEntryGrid(ws, { firstRow: r, required, numFmts, tintRequired });
}

/* ---------- Instructions (A gutter, B label, C text) ---------- */

function restyleInstructions(ws) {
  ws.getColumn(1).width = 2;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 100;
  const last = ws.rowCount;
  const isSection = (r) => {
    const b = ws.getCell(r, 2);
    return text(b) && !text(ws.getCell(r, 3)) && isBold(b) && fontSize(b) === 11;
  };
  let first = 1;
  while (first <= last && !isSection(first)) first++;
  for (let r = 1; r < first; r++) arialPlain(ws, r);

  for (let r = first; r <= last; r++) {
    const b = ws.getCell(r, 2), c = ws.getCell(r, 3);
    const bt = text(b), ct = text(c);
    if (!bt && !ct) continue; // spacer
    if (isSection(r)) { sectionTitle(ws, r, 2, 3); continue; }
    if (bt && ct) {
      setStyle(b, { font: font({ bold: true }), fill: solid(TPL.labelFill), border: thinBorder(), alignment: cellAlign() });
      const tint = fillOf(c) === TPL.requiredTint.slice(2) ? solid(TPL.requiredTint) : undefined;
      setStyle(c, { font: font(), fill: tint, border: thinBorder(), alignment: cellAlign() });
      ws.getRow(r).height = computedHeight(ws, [[2, 2, bt], [3, 3, ct]]);
      continue;
    }
    /* Text only: one paragraph across the label and text columns. */
    const value = bt ? b.value : c.value;
    const tint = fillOf(bt ? b : c) === TPL.requiredTint.slice(2) ? solid(TPL.requiredTint) : undefined;
    c.value = null;
    b.value = value;
    merge(ws, r, 2, 3);
    styleSpan(ws, r, 2, 3, { font: font(), fill: tint, border: thinBorder(), alignment: cellAlign() });
    ws.getRow(r).height = computedHeight(ws, [[2, 3, text(b)]]);
  }
}

/* ---------- Field Reference (A..F) ---------- */

const FR_WIDTHS = [26, 11, 56, 22, 30, 28];

function restyleFieldReference(ws) {
  FR_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const last = ws.rowCount;
  const blank = (r) => [1, 2, 3, 4, 5, 6].every((c) => !text(ws.getCell(r, c)));

  /* The first bordered table (compare or field) ends the title block. */
  let first = 1;
  while (first <= last) {
    const cA = ws.getCell(first, 1), cB = ws.getCell(first, 2);
    if (fillOf(cB) === TPL.compareHeaderFill.slice(2) || fillOf(cA) === TPL.headerFill.slice(2)) break;
    first++;
  }
  let compareHeader = fillOf(ws.getCell(first, 2)) === TPL.compareHeaderFill.slice(2) ? first : 0;
  const titleEnd = compareHeader && text(ws.getCell(first - 1, 1)) ? first - 2 : first - 1;
  for (let r = 1; r <= titleEnd; r++) arialPlain(ws, r);

  let r = titleEnd + 1;
  while (r <= last) {
    if (blank(r)) { r++; continue; }

    /* Compare table: "<Entity> vs ..." title, then its blue header. */
    if (fillOf(ws.getCell(r + 1, 2)) === TPL.compareHeaderFill.slice(2) && !text(ws.getCell(r, 2))) {
      sectionTitle(ws, r, 1, 6);
      r++;
      continue;
    }
    if (fillOf(ws.getCell(r, 2)) === TPL.compareHeaderFill.slice(2)) {
      const newText = ws.getCell(r, 2).value, oldText = ws.getCell(r, 3).value;
      unmergeRow(ws, r, 1, 6);
      ws.getCell(r, 3).value = null;
      ws.getCell(r, 4).value = oldText;
      ws.getCell(r, 2).value = newText;
      merge(ws, r, 2, 3);
      merge(ws, r, 4, 6);
      const head = { font: font({ bold: true, color: { argb: TPL.white } }), fill: solid(TPL.compareHeaderFill), border: thinBorder(), alignment: headAlign() };
      styleSpan(ws, r, 1, 6, head);
      ws.getRow(r).height = DATA_ENTRY_HEADER_HEIGHT;
      r++;
      while (r <= last && !blank(r)) {
        const merges = ws.model.merges ?? [];
        const spansBoth = merges.some((m) => m.startsWith(`B${r}:`) && /^[C-F]/.test(m.split(":")[1]));
        const label = ws.getCell(r, 1);
        const nv = ws.getCell(r, 2).value, ov = ws.getCell(r, 3).value;
        unmergeRow(ws, r, 1, 6);
        setStyle(label, { font: font({ bold: true }), fill: solid(TPL.labelFill), border: thinBorder(), alignment: cellAlign() });
        const body = { font: font(), border: thinBorder(), alignment: cellAlign() };
        for (let c = 3; c <= 6; c++) ws.getCell(r, c).value = null;
        ws.getCell(r, 2).value = nv;
        if (spansBoth) {
          merge(ws, r, 2, 6);
          styleSpan(ws, r, 2, 6, body);
          ws.getRow(r).height = computedHeight(ws, [[1, 1, text(label)], [2, 6, String(nv ?? "")]]);
        } else {
          ws.getCell(r, 4).value = ov;
          merge(ws, r, 2, 3);
          merge(ws, r, 4, 6);
          styleSpan(ws, r, 2, 6, body);
          ws.getRow(r).height = computedHeight(ws, [[1, 1, text(label)], [2, 3, String(nv ?? "")], [4, 6, String(ov ?? "")]]);
        }
        r++;
      }
      continue;
    }

    /* Field table: dark header, then one row per field. */
    if (fillOf(ws.getCell(r, 1)) === TPL.headerFill.slice(2)) {
      styleSpan(ws, r, 1, 6, { font: font({ bold: true, color: { argb: TPL.white } }), fill: solid(TPL.headerFill), border: thinBorder(), alignment: headAlign() });
      ws.getRow(r).height = 24;
      r++;
      let optional = 0;
      while (r <= last && !blank(r)) {
        const req = text(ws.getCell(r, 2)).toLowerCase() === "yes";
        const fill = req ? solid(TPL.requiredTint) : solid(optional++ % 2 ? TPL.zebra : TPL.white);
        for (let c = 1; c <= 6; c++) {
          const redYes = req && c === 2;
          setStyle(ws.getCell(r, c), {
            font: font(redYes ? { bold: true, color: { argb: TPL.requiredText } } : {}),
            fill,
            border: thinBorder(),
            alignment: cellAlign(),
          });
        }
        ws.getRow(r).height = computedHeight(ws, [1, 2, 3, 4, 5, 6].map((c) => [c, c, text(ws.getCell(r, c))]));
        r++;
      }
      continue;
    }

    /* Anything else is a note: bold label in A, text across B:F. */
    const label = ws.getCell(r, 1);
    let noteText = null;
    for (let c = 2; c <= 6 && noteText == null; c++) if (text(ws.getCell(r, c))) noteText = ws.getCell(r, c).value;
    unmergeRow(ws, r, 1, 6);
    /* A stray merge on the empty row below (B:F one row too low) goes too. */
    if (r + 1 <= last && blank(r + 1)) unmergeRow(ws, r + 1, 2, 6);
    for (let c = 2; c <= 6; c++) ws.getCell(r, c).value = null;
    ws.getCell(r, 2).value = noteText;
    merge(ws, r, 2, 6);
    setStyle(label, { font: font({ bold: true }), fill: solid(TPL.labelFill), border: thinBorder(), alignment: cellAlign() });
    styleSpan(ws, r, 2, 6, { font: font(), border: thinBorder(), alignment: cellAlign() });
    ws.getRow(r).height = computedHeight(ws, [[1, 1, text(label)], [2, 6, String(noteText ?? "")]]);
    r++;
  }
  /* Clear leftover styling on emptied spacer cells so no stray lines show. */
  for (let rr = titleEnd + 1; rr <= last; rr++) {
    if (blank(rr) && !(ws.model.merges ?? []).some((m) => new RegExp(`^[A-F]${rr}:`).test(m))) {
      for (let c = 1; c <= 6; c++) ws.getCell(rr, c).style = {};
    }
  }
}

/* ---------- Valid Values (A gutter, B value, C meaning) ---------- */

function restyleValidValues(ws) {
  ws.getColumn(1).width = 2;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 90;
  const last = ws.rowCount;
  const isSection = (r) => {
    const b = ws.getCell(r, 2);
    return text(b) && !text(ws.getCell(r, 3)) && isBold(b) && fontSize(b) === 11;
  };
  let first = 1;
  while (first <= last && !isSection(first)) first++;
  for (let r = 1; r < first; r++) arialPlain(ws, r);

  let valueRows = 0;
  for (let r = first; r <= last; r++) {
    const b = ws.getCell(r, 2), c = ws.getCell(r, 3);
    const bt = text(b), ct = text(c);
    if (!bt && !ct) continue;
    if (isSection(r)) { sectionTitle(ws, r, 2, 3); valueRows = 0; continue; }
    if (bt && ct && isBold(b) && isBold(c)) {
      styleSpan(ws, r, 2, 3, { font: font({ bold: true, color: { argb: TPL.white } }), fill: solid(TPL.headerFill), border: thinBorder(), alignment: headAlign() });
      ws.getRow(r).height = 22;
      continue;
    }
    if (bt && ct) {
      setStyle(b, { font: font(), fill: solid(TPL.labelFill), border: thinBorder(), alignment: cellAlign() });
      setStyle(c, { font: font(), fill: solid(valueRows++ % 2 ? TPL.zebra : TPL.white), border: thinBorder(), alignment: cellAlign() });
      ws.getRow(r).height = computedHeight(ws, [[2, 2, bt], [3, 3, ct]]);
      continue;
    }
    /* Text across both columns: a note under a value table (italic, muted),
     * or the block's own description when it has no table. */
    const value = bt ? b.value : c.value;
    const tint = fillOf(bt ? b : c) === TPL.requiredTint.slice(2) ? solid(TPL.requiredTint) : undefined;
    const isNote = valueRows > 0;
    c.value = null;
    b.value = value;
    merge(ws, r, 2, 3);
    styleSpan(ws, r, 2, 3, {
      font: isNote ? font({ italic: true, color: { argb: TPL.muted } }) : font(),
      fill: tint,
      border: thinBorder(),
      alignment: cellAlign(),
    });
    ws.getRow(r).height = computedHeight(ws, [[2, 3, text(b)]]);
  }
}

/* ---------- heading band (addendum 2) ---------- */

/** Delete (count > 0) or insert (count < 0) rows at `at`, moving merges. */
function spliceKeepMerges(ws, at, count) {
  const merges = [...(ws.model.merges ?? [])];
  merges.forEach((m) => ws.unMergeCells(m));
  if (count > 0) ws.spliceRows(at, count);
  else ws.spliceRows(at, 0, ...Array.from({ length: -count }, () => []));
  const shift = (row) => (row >= at ? row - count : row);
  for (const m of merges) {
    const [a, b] = m.split(":").map((x) => ws.getCell(x));
    ws.mergeCells(shift(a.row), a.col, shift(b.row), b.col);
  }
}

const SPACER_HEIGHT = 18;

function rowBlank(ws, r, lastCol) {
  for (let c = 1; c <= lastCol; c++) if (text(ws.getCell(r, c))) return false;
  return true;
}

/** Before restyling: give every reference tab the same title block rows
 *  (1 band, 2 title, 3 subtitle, [4 meta], one spacer) with the tab's title. */
function prepareHeading(ws, headers) {
  const key = ws.name.trim().toLowerCase();
  if (key === "instructions") {
    ws.getCell("B2").value = "Instructions";
    const req = headers.filter((h) => /\s\*$/.test(h)).length;
    ws.getCell("B4").value = `${headers.length} columns  ·  ${req} required, ${headers.length - req} optional`;
  } else if (key === "field reference") {
    /* Today: A1 plain banner, A2 subtitle. Insert a title row under the band. */
    spliceKeepMerges(ws, 2, -1);
    ws.getCell("A2").value = "Field Reference";
  } else if (key === "valid values") {
    ws.getCell("B2").value = "Valid Values & Reference";
  }
  /* Addendum 4: one spacer row, never two in a row. */
  if (key !== "data entry") {
    for (let r = ws.rowCount; r > 2; r--) {
      if (rowBlank(ws, r, 6) && rowBlank(ws, r - 1, 6)) spliceKeepMerges(ws, r, 1);
    }
  }
}

/** After restyling: band on row 1, then title, subtitle, meta, one spacer. */
function applyHeading(ws, entities, lastCol) {
  const key = ws.name.trim().toLowerCase();
  styleHeadingBand(ws, `OMNE  ·  ${entities} Import Template  ·  ${ws.name}`, lastCol);
  if (key === "data entry") {
    /* Addendum 3: wrap inside the cell, autofit rows, freeze under row 2. */
    const xSplit = ws.views?.[0]?.xSplit ?? 0;
    applyDataEntryCellStructure(ws, { firstRow: 3, lastRow: 600, colCount: lastCol, xSplit });
    return;
  }
  const col = key === "field reference" ? 1 : 2;
  const hasMeta = key === "instructions";
  const plain = (r, f, h) => {
    const cell = ws.getCell(r, col);
    setStyle(cell, { font: f, alignment: { vertical: "middle" } });
    ws.getRow(r).height = h;
  };
  plain(2, font({ bold: true, size: 15 }), 26);
  plain(3, font({ color: { argb: TPL.muted } }), 18);
  if (hasMeta) plain(4, font({ color: { argb: TPL.muted } }), 18);
  /* Addendum 4: every spacer row (under the title block and between
   * tables) is 18pt, the same on every tab. */
  for (let r = 2; r <= ws.rowCount; r++) {
    if (rowBlank(ws, r, lastCol)) ws.getRow(r).height = SPACER_HEIGHT;
  }
}

/* ---------- cards (addendum 5, Users only) ---------- */

/* Card rows are sized with the shared Excel text measure (textMeasure.mjs):
 * Arial 10 advance widths and word wrap as Excel lays them out, validated
 * against real Excel AutoFit with 0 under- and 0 over-predictions. `spans` =
 * [[firstCol, lastCol, text, bold], ...]; a merged range passes every column
 * width so the measure sums their pixels. */
function cardHeight(ws, spans) {
  let lines = 1;
  for (const [c1, c2, value, bold] of spans) {
    const widths = [];
    for (let c = c1; c <= c2; c++) widths.push(colWidth(ws, c));
    lines = Math.max(lines, measuredLineCount(value, widths, bold));
  }
  return Math.max(20, lines * 13.5 + 8);
}

const midAlign = () => ({ wrapText: true, vertical: "middle", horizontal: "left", indent: 1 });
const isFill = (cell, argb) => fillOf(cell) === argb.slice(2);
const mergeAt = (ws, r, c) => (ws.model.merges ?? []).find((m) => m.startsWith(`${ws.getCell(r, c).address}:`));
const inMerge = (ws, r, c) =>
  (ws.model.merges ?? []).some((m) => {
    const [a, b] = m.split(":").map((x) => ws.getCell(x));
    return a.row <= r && b.row >= r && a.col < c && b.col >= c;
  });

function cardHeader(ws, r, c1, c2, labels) {
  labels?.forEach((t, i) => { ws.getCell(r, c1 + i).value = t; });
  styleSpan(ws, r, c1, c2, { font: font({ bold: true, color: { argb: TPL.white } }), fill: solid(TPL.headerFill), border: thinBorder(), alignment: midAlign() });
}

function cardTitle(ws, r, c1, c2, value) {
  ws.getCell(r, c1).value = value;
  merge(ws, r, c1, c2);
  styleSpan(ws, r, c1, c2, { font: font({ bold: true, size: 11 }), fill: solid(TPL.sectionFill), border: thinBorder(), alignment: midAlign() });
}

/** Last pass on a card tab: every bordered cell centred vertically, left,
 *  padded, wrapped; section bars and headers 24; body rows sized to fit. */
function finishCards(ws, c1, c2, fixed = {}) {
  let first = 1;
  while (first <= ws.rowCount && !isFill(ws.getCell(first, c1), TPL.sectionFill)) first++;
  for (let r = first; r <= ws.rowCount; r++) {
    let any = false;
    const spans = [];
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c);
      if (text(cell)) any = true;
      if (!cell.border) continue;
      setStyle(cell, { font: cell.font && { ...cell.font }, fill: cell.fill && { ...cell.fill }, border: { ...cell.border }, alignment: midAlign() });
      if (inMerge(ws, r, c)) continue;
      const m = mergeAt(ws, r, c);
      spans.push([c, m ? ws.getCell(m.split(":")[1]).col : c, text(cell), isBold(cell)]);
    }
    if (!any) continue;
    const lead = ws.getCell(r, c1);
    if (fixed[r]) ws.getRow(r).height = fixed[r];
    else if (isFill(lead, TPL.sectionFill) || isFill(lead, TPL.headerFill)) ws.getRow(r).height = 24;
    else ws.getRow(r).height = cardHeight(ws, spans);
  }
}

const INSTRUCTION_HEADERS = [
  [/quick start/i, ["Step", "What to do"]],
  [/matched/i, ["Case", "What happens"]],
  [/important notes/i, ["Topic", "Details"]],
];

function cardifyInstructions(ws) {
  const isSection = (r) => isFill(ws.getCell(r, 2), TPL.sectionFill);
  const isLabelRow = (r) => text(ws.getCell(r, 2)) && text(ws.getCell(r, 3)) && !mergeAt(ws, r, 2);
  /* Insert a header row above the first label row of each tabular section,
   * bottom-up so earlier row numbers stay valid. */
  const inserts = [];
  let section = null, done = false;
  for (let r = 1; r <= ws.rowCount; r++) {
    if (isSection(r)) { section = text(ws.getCell(r, 2)); done = false; continue; }
    if (section && !done && isLabelRow(r)) {
      const hit = INSTRUCTION_HEADERS.find(([re]) => re.test(section));
      inserts.push([r, hit ? hit[1] : ["Topic", "Details"]]);
      done = true;
    }
  }
  for (const [r, labels] of inserts.reverse()) {
    spliceKeepMerges(ws, r, -1);
    cardHeader(ws, r, 2, 3, labels);
  }
  /* Body: first column on F7F6F3 (regular, as on Valid Values), the other
   * column zebra; single paragraphs stay merged, regular, white. */
  let zebra = 0;
  for (let r = 1; r <= ws.rowCount; r++) {
    if (isSection(r) || isFill(ws.getCell(r, 2), TPL.headerFill)) { zebra = 0; continue; }
    if (!isLabelRow(r)) continue;
    setStyle(ws.getCell(r, 2), { font: font(), fill: solid(TPL.labelFill), border: thinBorder() });
    setStyle(ws.getCell(r, 3), { font: font(), fill: solid(zebra++ % 2 ? TPL.zebra : TPL.white), border: thinBorder() });
  }
  finishCards(ws, 2, 3);
}

function cardifyFieldReference(ws) {
  const blank = (r) => rowBlank(ws, r, 6);
  /* Field table gets its own title bar above the dark header. */
  let fieldHeader = 0;
  for (let r = 1; r <= ws.rowCount && !fieldHeader; r++) {
    if (isFill(ws.getCell(r, 1), TPL.headerFill) && text(ws.getCell(r, 1)) === "Field") fieldHeader = r;
  }
  spliceKeepMerges(ws, fieldHeader, -1);
  cardTitle(ws, fieldHeader, 1, 6, "All columns");
  fieldHeader++;

  let compareHeader = 0;
  for (let r = 1; r <= ws.rowCount; r++) {
    if (isFill(ws.getCell(r, 2), TPL.compareHeaderFill)) { compareHeader = r; break; }
  }
  if (compareHeader) {
    cardHeader(ws, compareHeader, 1, 6);
    let zebra = 0;
    for (let r = compareHeader + 1; r <= ws.rowCount && !blank(r); r++) {
      setStyle(ws.getCell(r, 1), { font: font(), fill: solid(TPL.labelFill), border: thinBorder() });
      const fill = solid(zebra++ % 2 ? TPL.zebra : TPL.white);
      for (let c = 2; c <= 6; c++) setStyle(ws.getCell(r, c), { font: font(), fill, border: thinBorder() });
    }
  }
  let optional = 0;
  for (let r = fieldHeader + 1; r <= ws.rowCount && !blank(r); r++) {
    if (text(ws.getCell(r, 2)).toLowerCase() === "yes") continue; // FBE9E7 + red Yes stay
    const fill = solid(optional++ % 2 ? TPL.zebra : TPL.white);
    setStyle(ws.getCell(r, 1), { font: font(), fill: solid(TPL.labelFill), border: thinBorder() });
    for (let c = 2; c <= 6; c++) setStyle(ws.getCell(r, c), { font: font(), fill, border: thinBorder() });
  }
  finishCards(ws, 1, 6, compareHeader ? { [compareHeader]: DATA_ENTRY_HEADER_HEIGHT } : {});
}

function cardify(ws) {
  const key = ws.name.trim().toLowerCase();
  if (key === "instructions") cardifyInstructions(ws);
  else if (key === "field reference") cardifyFieldReference(ws);
  else if (key === "valid values") finishCards(ws, 2, 3);
}

/* ---------- run ---------- */

mkdirSync(ORIGINALS, { recursive: true });
for (const name of FILES) {
  const shipped = path.join(TEMPLATES, name);
  const original = path.join(ORIGINALS, name);
  if (!existsSync(original)) copyFileSync(shipped, original);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(original);
  const entities = HEADING[name];
  const dataEntry = wb.worksheets.find((w) => w.name.trim().toLowerCase() === "data entry");
  const headers = dataEntryHeaders(dataEntry);
  if (entities) for (const ws of wb.worksheets) prepareHeading(ws, headers);
  for (const ws of wb.worksheets) {
    const key = ws.name.trim().toLowerCase();
    if (key === "data entry") restyleDataEntry(ws, { tintRequired: !entities });
    else if (key === "instructions") restyleInstructions(ws);
    else if (key === "field reference") restyleFieldReference(ws);
    else if (key === "valid values") restyleValidValues(ws);
  }
  if (entities) {
    for (const ws of wb.worksheets) cardify(ws);
    for (const ws of wb.worksheets) {
      const key = ws.name.trim().toLowerCase();
      const lastCol = key === "data entry" ? headers.length : key === "field reference" ? 6 : 3;
      applyHeading(ws, entities, lastCol);
    }
  }
  wb.modified = PINNED;
  wb.lastModifiedBy = "Omne";

  /* ExcelJS stamps every zip entry with the current time, so re-pack the
   * archive with a pinned entry date to keep the shipped file byte-identical. */
  const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer());
  zip.forEach((_, f) => { f.date = PINNED; });
  writeFileSync(shipped, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`restyled ${name}`);
}
