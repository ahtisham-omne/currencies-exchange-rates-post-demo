/* Provenance: your-invoice-mate/src/app/components/import-adjustment/templateLayout.mjs
 * sha256 8bbe04284c589abb895b526780846d063dc87312314290bb9294457f700de58e
 * Copied into role-zen 2026-09-30. Verbatim. */
/* The ONE source of truth for the import template layout: the 4-sheet xlsx
   (UAC standard, reconstructed in template-and-validation.md section 1.6), the
   CSV, and the companion Guide txt. Plain ESM (its only import is the self-contained textMeasure.mjs) so both
   scripts/gen-import-templates.mjs (Node) and the app (Vite) share it; the
   ExcelJS module is passed in by the caller (static import in Node, dynamic
   import in the browser). Types live in templateLayout.d.mts. */

/* ─── Fixed style system (entity-independent) ───────────────────────── */
import { lineCount } from "./textMeasure.mjs";

const INK = "FF1A1A18";
const MUTED = "FF6B6B66";
const WHITE = "FFFFFFFF";
const REQ_RED = "FFC0392B";
const FILL = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const THIN = { style: "thin", color: { argb: "FFD8D6D1" } };
const BORDER4 = { left: THIN, right: THIN, top: THIN, bottom: THIN };
const F = (o) => ({ name: "Arial", size: 10, ...o });
/* Every reference-table cell wraps, sits left and vertically centred, with a one-step indent as inner padding. */
const AL_CELL = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
const AL_HDR = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };

export const STYLES = {
  /* Data Entry */
  /* Row 1 brand band, identical on all four tabs (no borders, not merged). */
  band: { font: { name: "Arial", size: 12, bold: true, color: { argb: WHITE } }, fill: FILL("FF1D4E89"), alignment: { horizontal: "left", vertical: "middle", indent: 1 } },
  hdrReq: { font: F({ bold: true, color: { argb: WHITE } }), fill: FILL(REQ_RED), border: BORDER4, alignment: { horizontal: "left", vertical: "middle", wrapText: true } },
  hdrOpt: { font: F({ bold: true, color: { argb: INK } }), fill: FILL("FFE8E6E1"), border: BORDER4, alignment: { horizontal: "left", vertical: "middle", wrapText: true } },
  example: { font: F({ italic: true, color: { argb: MUTED } }), fill: FILL("FFF2F1EE"), border: BORDER4, alignment: { horizontal: "left", vertical: "top", wrapText: true } },
  /* Empty fill-in grid below the examples: every cell white (no required tint). */
  gridCell: { font: F({ color: { argb: INK } }), fill: FILL(WHITE), border: BORDER4, alignment: { horizontal: "left", vertical: "top", wrapText: true } },
  /* Title blocks (plain, no borders) */
  title15: { font: { name: "Arial", size: 15, bold: true, color: { argb: INK } }, alignment: { vertical: "middle" } },
  sub10: { font: F({ color: { argb: MUTED } }), alignment: { vertical: "middle" } },
  /* Reference tables (Instructions, Field Reference, Valid Values) */
  secTitle: { font: { name: "Arial", size: 11, bold: true, color: { argb: INK } }, fill: FILL("FFF2F1EE"), border: BORDER4, alignment: AL_HDR },
  tValue: { font: F({ color: { argb: INK } }), fill: FILL("FFF7F6F3"), border: BORDER4, alignment: AL_CELL },
  tCell: { font: F({ color: { argb: INK } }), fill: FILL(WHITE), border: BORDER4, alignment: AL_CELL },
  tZebra: { font: F({ color: { argb: INK } }), fill: FILL("FFFAFAF8"), border: BORDER4, alignment: AL_CELL },
  tNote: { font: F({ italic: true, color: { argb: MUTED } }), fill: FILL(WHITE), border: BORDER4, alignment: AL_CELL },
  tHdr: { font: F({ bold: true, color: { argb: WHITE } }), fill: FILL("FF3A3A36"), border: BORDER4, alignment: AL_HDR },
  reqCell: { font: F({ color: { argb: INK } }), fill: FILL("FFFBE9E7"), border: BORDER4, alignment: AL_CELL },
  reqYes: { font: F({ bold: true, color: { argb: REQ_RED } }), fill: FILL("FFFBE9E7"), border: BORDER4, alignment: AL_CELL },
};

/** Pre-created row range on Data Entry. */
export const DATA_ROWS = 600;
/** Data Entry sheet default row height; rows 3-600 carry no explicit height so Excel autofits as the user types. */
export const GRID_ROW_HEIGHT = 20;
/** Every empty spacer row (under a title block, between tables) on every tab. No row is ever set below 15. */
export const SPACER_HEIGHT = 18;
/** Two spaces, U+00B7 middle dot, two spaces (the UAC banner separator). */
export const BANNER = (title) => "OMNE  ·  " + title;
/** Row 1 band text: "OMNE  ·  <Entities> Import Template  ·  <Sheet name>". */
export const BAND_TEXT = (title, sheetName) => BANNER(title) + "  ·  " + sheetName;
export const BAND_HEIGHT = 32;
export const SHEET_NAMES = ["Data Entry", "Instructions", "Field Reference", "Valid Values"];
export const INSTRUCTIONS_WIDTHS = [2, 30, 100];
export const FIELD_REFERENCE_WIDTHS = [26, 11, 56, 22, 30, 28];
export const VALID_VALUES_WIDTHS = [2, 30, 90];
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

function put(ws, addr, value, style, numFmt) {
  const c = ws.getCell(addr);
  c.value = value;
  if (style) Object.assign(c, style);
  if (numFmt) c.numFmt = numFmt;
  return c;
}

/** Style every cell of row `r` from column c1 to c2, write `value` in c1, and merge. */
function putMerged(ws, r, c1, c2, value, style) {
  for (let c = c1; c <= c2; c++) Object.assign(ws.getCell(r, c), style);
  ws.getCell(r, c1).value = value;
  if (c2 > c1) ws.mergeCells(r, c1, r, c2);
}

/* Row heights come from textMeasure.mjs, the shared Excel text measure: Arial 10 advance widths and
   Excel's own word wrap, validated against real Excel AutoFit (0 under- and 0 over-predictions). */

/** Wrapped line count of `text` in a column `width` wide, or a merged range (an array of its column widths). */
export function wrappedLines(text, width, bold = false) {
  return lineCount(String(text ?? ""), width, bold);
}

/** Explicit height for a wrapped table row: the tallest of its [text, width, bold?] cells, padded.
    Set on every wrapped row, since Excel never autofits merged cells. One line comes out at 21.5. */
export function wrappedRowHeight(cells) {
  const lines = Math.max(...cells.map(([t, w, bold]) => wrappedLines(t, w, bold)));
  return Math.max(20, lines * 13.5 + 8);
}

/** Column widths of a merged range c1..c2 (textMeasure sums their pixels). */
const span = (widths, c1, c2) => widths.slice(c1 - 1, c2);

/** Row 1 brand band: fill A1..lastCol, text in A1 only so it overflows, height 32. */
export function applyHeadingBand(ws, title, sheetName, lastCol) {
  for (let c = 1; c <= lastCol; c++) Object.assign(ws.getCell(1, c), STYLES.band);
  ws.getCell(1, 1).value = BAND_TEXT(title, sheetName);
  ws.getRow(1).height = BAND_HEIGHT;
}

/** Title block under the band: row 2 title (26), row 3 subtitle (18), optional row 4 meta (18),
    then one spacer row. Returns the first table row. */
function titleBlock(ws, col, title, subtitle, meta) {
  const L = colLetter(col);
  put(ws, `${L}2`, title, STYLES.title15);
  ws.getRow(2).height = 26;
  put(ws, `${L}3`, subtitle, STYLES.sub10);
  ws.getRow(3).height = 18;
  let r = 4;
  if (meta) {
    put(ws, `${L}4`, meta, STYLES.sub10);
    ws.getRow(r++).height = 18;
  }
  ws.getRow(r++).height = SPACER_HEIGHT;
  return r;
}

/** Template headers: label plus " *" on required columns. */
export function templateHeaders(spec) {
  return spec.columns.map((c) => (c.required ? `${c.label} *` : c.label));
}

/**
 * The empty fill-in grid of a Data Entry sheet: rows `from`..`to`, every template
 * column bordered, white and wrapped (text never spills into the next cell), no explicit height, with the
 * column's text numFmt. `extraCols` more bordered white columns follow the template
 * columns (the failed-rows export uses one for its message column).
 */
export function applyDataEntryGrid(ws, columns, from, to = DATA_ROWS, extraCols = 0) {
  ws.properties.defaultRowHeight = GRID_ROW_HEIGHT;
  for (let r = from; r <= to; r++) {
    const row = ws.getRow(r);
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      Object.assign(cell, STYLES.gridCell);
      if (c.textFormat) cell.numFmt = "@";
    });
    for (let k = 1; k <= extraCols; k++) Object.assign(row.getCell(columns.length + k), STYLES.gridCell);
  }
}

/* ─── xlsx ──────────────────────────────────────────────────────────── */

/**
 * Build the 4-sheet workbook. `ExcelJS` is the exceljs module (its default
 * export in the browser); the workbook is returned, not written.
 */
export function buildTemplateWorkbook(ExcelJS, spec) {
  const wb = new ExcelJS.Workbook();
  // Pinned so the shipped file stays byte-identical across regenerations.
  wb.created = wb.modified = new Date(Date.UTC(2026, 0, 1));
  const cols = spec.columns;
  const headers = templateHeaders(spec);
  const nReq = cols.filter((c) => c.required).length;
  const tpl = spec.template;
  const examples = [cols.map((c) => c.example1), cols.map((c) => c.example2)];

  /* Sheet 1: Data Entry. The required columns and rows 1-2 (band, header) stay
     frozen; rows 3-4 are the examples, rows 5-600 an empty bordered, wrapped grid. */
  const de = wb.addWorksheet(SHEET_NAMES[0], {
    views: [{ state: "frozen", xSplit: nReq, ySplit: 2, topLeftCell: `${colLetter(nReq + 1)}3`, showGridLines: false }],
  });
  cols.forEach((c, i) => {
    de.getColumn(i + 1).width = c.width ?? Math.max(14, +(c.label.length * 0.95).toFixed(2));
  });
  applyHeadingBand(de, tpl.bannerTitle, SHEET_NAMES[0], cols.length);
  de.getRow(2).height = 30;
  headers.forEach((h, i) => put(de, `${colLetter(i + 1)}2`, h, cols[i].required ? STYLES.hdrReq : STYLES.hdrOpt));
  examples.forEach((row, r) =>
    cols.forEach((c, i) => put(de, `${colLetter(i + 1)}${3 + r}`, row[i] || null, STYLES.example, c.textFormat ? "@" : undefined)),
  );
  applyDataEntryGrid(de, cols, 3 + examples.length, DATA_ROWS);

  /* Reference tabs share one card design (the Valid Values model): a title bar merged
     across the card, an optional dark header row, body rows with the first column on
     F7F6F3 and the rest zebra white / FAFAF8, notes merged across the card. Every body
     row gets an explicit height from the calibrated estimate. */
  let r;
  const card = (ws, widths, c1, c2) => {
    const full = span(widths, c1, c2);
    return {
      title(text) {
        putMerged(ws, r, c1, c2, text, STYLES.secTitle);
        ws.getRow(r++).height = 24;
      },
      header(labels) {
        labels.forEach((h, i) => put(ws, `${colLetter(c1 + i)}${r}`, h, STYLES.tHdr));
        ws.getRow(r++).height = 24;
      },
      /** A paragraph spanning the card: italic muted note, or regular body text. */
      para(text, style) {
        putMerged(ws, r, c1, c2, text, style);
        ws.getRow(r++).height = wrappedRowHeight([[text, full]]);
      },
      spacer() {
        ws.getRow(r++).height = SPACER_HEIGHT;
      },
    };
  };

  /* Sheet 2: Instructions. Band, title block, then one card per section over B:C. */
  const ins = wb.addWorksheet(SHEET_NAMES[1], { views: [{ showGridLines: false }] });
  INSTRUCTIONS_WIDTHS.forEach((w, i) => (ins.getColumn(i + 1).width = w));
  const IW = INSTRUCTIONS_WIDTHS;
  applyHeadingBand(ins, tpl.bannerTitle, SHEET_NAMES[1], IW.length);
  r = titleBlock(ins, 2, "Instructions", tpl.moduleLine, tpl.countLine);
  const ic = card(ins, IW, 2, 3);
  const insRows = (pairs) =>
    pairs.forEach(([label, body], i) => {
      put(ins, `B${r}`, label, STYLES.tValue);
      put(ins, `C${r}`, body, i % 2 ? STYLES.tZebra : STYLES.tCell);
      ins.getRow(r++).height = wrappedRowHeight([[label, IW[1]], [body, IW[2]]]);
    });
  ic.title("QUICK START");
  ic.header(["Step", "What to do"]);
  insRows(tpl.instructions.quickStart.map((t, i) => [`Step ${i + 1}`, t]));
  for (const sec of tpl.instructions.sections) {
    ic.spacer();
    ic.title(sec.heading);
    if (sec.intro) ic.para(sec.intro, STYLES.tCell);
    if (sec.items?.length) {
      ic.header(sec.heading.startsWith("HOW ") ? ["Case", "What happens"] : ["Topic", "Details"]);
      insRows(sec.items);
    }
  }

  /* Sheet 3: Field Reference. Band, title block, the compare card, then the "All columns" card. */
  const fr = wb.addWorksheet(SHEET_NAMES[2], { views: [{ showGridLines: false }] });
  FIELD_REFERENCE_WIDTHS.forEach((w, i) => (fr.getColumn(i + 1).width = w));
  const W = FIELD_REFERENCE_WIDTHS;
  applyHeadingBand(fr, tpl.bannerTitle, SHEET_NAMES[2], W.length);
  r = titleBlock(fr, 1, "Field Reference", tpl.frSubtitle);
  const fc = card(fr, W, 1, 6);
  if (tpl.compareTable) {
    const ct = tpl.compareTable;
    fc.title(ct.heading);
    put(fr, `A${r}`, null, STYLES.tHdr);
    putMerged(fr, r, 2, 3, ct.colHeaders[0], STYLES.tHdr);
    putMerged(fr, r, 4, 6, ct.colHeaders[1], STYLES.tHdr);
    fr.getRow(r++).height = 24;
    ct.rows.forEach(([a, b, c], i) => {
      const st = i % 2 ? STYLES.tZebra : STYLES.tCell;
      put(fr, `A${r}`, a, STYLES.tValue);
      putMerged(fr, r, 2, 3, b, st);
      putMerged(fr, r, 4, 6, c, st);
      fr.getRow(r++).height = wrappedRowHeight([[a, W[0]], [b, span(W, 2, 3)], [c, span(W, 4, 6)]]);
    });
    if (ct.mergedLast) {
      const [a, b] = ct.mergedLast;
      put(fr, `A${r}`, a, STYLES.tValue);
      putMerged(fr, r, 2, 6, b, ct.rows.length % 2 ? STYLES.tZebra : STYLES.tCell);
      fr.getRow(r++).height = wrappedRowHeight([[a, W[0]], [b, span(W, 2, 6)]]);
    }
    fc.spacer();
  }
  fc.title("All columns");
  fc.header(FIELD_REFERENCE_HEADERS);
  let optIdx = 0;
  for (const c of cols) {
    const st = c.required ? STYLES.reqCell : optIdx++ % 2 ? STYLES.tZebra : STYLES.tCell;
    const vals = [c.label, c.required ? "Yes" : "No", c.reference.description, c.reference.format, c.reference.validValues || null, c.reference.example];
    vals.forEach((v, i) => {
      const cellStyle = c.required ? (i === 1 ? STYLES.reqYes : st) : i === 0 ? STYLES.tValue : st;
      put(fr, `${colLetter(i + 1)}${r}`, v, cellStyle);
    });
    fr.getRow(r++).height = wrappedRowHeight(vals.map((v, i) => [v, W[i], c.required && i === 1]));
  }

  /* Sheet 4: Valid Values. Band, title block, one card per block over B:C. */
  const vv = wb.addWorksheet(SHEET_NAMES[3], { views: [{ showGridLines: false }] });
  VALID_VALUES_WIDTHS.forEach((w, i) => (vv.getColumn(i + 1).width = w));
  const VW = VALID_VALUES_WIDTHS;
  applyHeadingBand(vv, tpl.bannerTitle, SHEET_NAMES[3], VW.length);
  r = titleBlock(vv, 2, "Valid Values & Reference", "Use these exact values in the Data Entry sheet.");
  const vc = card(vv, VW, 2, 3);
  tpl.validValues.forEach((block, bi) => {
    if (bi > 0) vc.spacer();
    vc.title(block.heading);
    if (block.subHeader) vc.header(block.subHeader);
    (block.rows ?? []).forEach(([label, body], i) => {
      put(vv, `B${r}`, label, STYLES.tValue);
      put(vv, `C${r}`, body, i % 2 ? STYLES.tZebra : STYLES.tCell);
      vv.getRow(r++).height = wrappedRowHeight([[label, VW[1]], [body, VW[2]]]);
    });
    if (block.note) vc.para(block.note, STYLES.tNote);
  });

  return wb;
}

/* ─── CSV ───────────────────────────────────────────────────────────── */

/** RFC 4180: quote only when the cell holds a comma, a quote, or a line break. */
export function escapeCsvCell(value) {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** UTF-8 (no BOM), LF line endings, trailing newline, header + two example rows. */
export function buildTemplateCsv(spec) {
  const cols = spec.columns;
  const lines = [
    templateHeaders(spec).map(escapeCsvCell).join(","),
    cols.map((c) => escapeCsvCell(c.example1)).join(","),
    cols.map((c) => escapeCsvCell(c.example2)).join(","),
  ];
  return lines.join("\n") + "\n";
}

/* ─── Guide txt ─────────────────────────────────────────────────────── */

export const GUIDE_WIDTH = 66;
const RULE_EQ = "=".repeat(GUIDE_WIDTH);
const RULE_DASH = "-".repeat(GUIDE_WIDTH);

/** Greedy word wrap at `width`; a word longer than the width sits on its own line. */
export function wrapText(text, width = GUIDE_WIDTH) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** "Label  body..." with continuation lines indented under the body. */
function labeled(label, body, gap = 2, indent = 0) {
  const pad = " ".repeat(indent);
  const lead = pad + label + " ".repeat(gap);
  const cont = " ".repeat(lead.length);
  const lines = wrapText(body, GUIDE_WIDTH - lead.length);
  return lines.map((l, i) => (i === 0 ? lead + l : cont + l));
}

function section(title) {
  return [RULE_DASH, title, RULE_DASH, ""];
}

function subheader(text) {
  return [text, "-".repeat(text.length)];
}

/** The companion guide for the CSV, in the UAC format the Reading Room parser reads. */
export function buildGuideText(spec) {
  const tpl = spec.template;
  const g = tpl.guide;
  const out = [];
  out.push(RULE_EQ, g.title, tpl.moduleLine, RULE_EQ, "");
  for (const p of g.intro) out.push(...wrapText(p), "");
  out.push("");

  /* QUICK START */
  out.push(...section("QUICK START"));
  g.quickStart.forEach((t, i) => {
    out.push(...labeled(`Step ${i + 1}`, t, 3), "");
  });
  out.push("");

  /* HOW <ENTITIES> ARE MATCHED */
  out.push(...section(`HOW ${spec.titlePlural.toUpperCase()} ARE MATCHED`));
  out.push(...wrapText(g.matching.intro), "");
  for (const c of g.matching.cases) {
    out.push(...subheader(c.subheader));
    out.push(...wrapText(c.lead), "");
    const labelW = Math.max(...c.items.map(([l]) => l.length));
    for (const [label, body] of c.items) {
      out.push(...labeled(label.padEnd(labelW), body, 3, 2));
    }
    out.push("");
  }
  out.push("");

  /* Free-text sections from the Instructions sheet, minus the matching block
     and the notes, which the guide renders elsewhere. */
  for (const sec of tpl.instructions.sections) {
    if (!sec.intro || sec.heading.startsWith("HOW ")) continue;
    out.push(...section(sec.heading));
    out.push(...wrapText(sec.intro), "", "");
  }

  /* FILE LIMITS */
  out.push(...section("FILE LIMITS"));
  out.push(...wrapText(g.fileLimits), "", "");

  /* FIELD REFERENCE */
  out.push(...section("FIELD REFERENCE"));
  const byKey = Object.fromEntries(spec.columns.map((c) => [c.key, c]));
  for (const group of g.fieldGroups) {
    out.push(...subheader(group.heading), "");
    for (const key of group.keys) {
      const c = byKey[key];
      out.push(...labeled(c.label, c.guide), "");
    }
  }
  out.push("");

  /* VALID VALUES: every block except the first, which restates the matching rules. */
  out.push(...section("VALID VALUES"));
  tpl.validValues.slice(1).forEach((block, i, arr) => {
    out.push(...subheader(block.heading));
    for (const [label, body] of block.rows ?? []) {
      out.push(...labeled(label, body), "");
    }
    if (block.note) out.push(...wrapText(block.note), "");
    if (i < arr.length - 1) out.push("");
  });

  return out.join("\n").replace(/\n+$/, "") + "\n";
}
