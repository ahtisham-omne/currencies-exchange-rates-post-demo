/* The Items import template layout: the four-sheet workbook, the CSV and
 * the Guide txt. Plain ESM so scripts/gen-import-templates.mjs (Node) and
 * templateWorkbook.ts / templateCsv.ts (the app) run the very same code on
 * the very same data (spec.data.mjs), which is what keeps the checked-in
 * files under public/templates identical to what the app would generate.
 *
 * The workbook builder takes the ExcelJS module as a parameter so this file
 * has no static dependency on it: the app dynamically imports exceljs to keep
 * it out of the first paint, the script imports it statically.
 *
 * Fixed style system reverse-engineered from the User Access Control
 * template (docs: _crossref/extracts/role-zen/template-and-validation.md,
 * section 1). Nothing under S changes per entity. */

import { lineCount } from "./textMeasure.mjs";
import {
  COLUMNS,
  EXAMPLE_ROWS,
  FILE_BASE,
  GUIDE_FILE,
  OPTION_SNAPSHOTS,
  TEMPLATE,
  TEMPLATE_HEADERS,
} from "./spec.data.mjs";

/* ─── Fixed style system ───
 * One standard shared by every Omne import template: thin D8D6D1 borders on
 * every side of every table cell, dark 3A3A36 table headers, 1D4E89 compare
 * headers, FBE9E7 required tint, F7F6F3 label column, FAFAF8 zebra, F2F1EE
 * section titles, Arial throughout. Every text cell wraps with a one-step
 * indent so nothing is clipped. */
const INK = "FF1A1A18";
const MUTED = "FF6B6B66";
const WHITE = "FFFFFFFF";
const FILL = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const THIN = { style: "thin", color: { argb: "FFD8D6D1" } };
const BORDER4 = { left: THIN, right: THIN, top: THIN, bottom: THIN };
const F = (o) => ({ name: "Arial", size: 10, ...o });
const CELL_ALIGN = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
/* Data Entry cells wrap inside their own column; rows have no explicit
 * height so Excel autofits them as the user types. */
const DE_ALIGN = { horizontal: "left", vertical: "top", wrapText: true };
const HDR_ALIGN = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
const S = {
  /* Row 1 brand band, identical on every tab. */
  band: { font: { name: "Arial", size: 12, bold: true, color: { argb: WHITE } }, fill: FILL("FF1D4E89"), alignment: { horizontal: "left", vertical: "middle", indent: 1 } },
  hdrReq: {
    font: F({ bold: true, color: { argb: WHITE } }),
    fill: FILL("FFC0392B"),
    border: BORDER4,
    alignment: { horizontal: "left", vertical: "middle", wrapText: true },
  },
  hdrOpt: {
    font: F({ bold: true, color: { argb: INK } }),
    fill: FILL("FFE8E6E1"),
    border: BORDER4,
    alignment: { horizontal: "left", vertical: "middle", wrapText: true },
  },
  example: {
    font: F({ italic: true, color: { argb: MUTED } }),
    fill: FILL("FFF2F1EE"),
    border: BORDER4,
    alignment: DE_ALIGN,
  },
  /* Title blocks: plain text above the tables, no borders. */
  title15: { font: { name: "Arial", size: 15, bold: true, color: { argb: INK } }, alignment: { vertical: "middle" } },
  sub10: { font: F({ color: { argb: MUTED } }), alignment: { vertical: "middle" } },
  /* Tables. */
  secTitle: { font: { name: "Arial", size: 11, bold: true, color: { argb: INK } }, fill: FILL("FFF2F1EE"), border: BORDER4, alignment: HDR_ALIGN },
  label: { font: F({ bold: true, color: { argb: INK } }), fill: FILL("FFF7F6F3"), border: BORDER4, alignment: CELL_ALIGN },
  value: { font: F({ color: { argb: INK } }), fill: FILL("FFF7F6F3"), border: BORDER4, alignment: CELL_ALIGN },
  cell: { font: F({ color: { argb: INK } }), border: BORDER4, alignment: CELL_ALIGN },
  zebra: { font: F({ color: { argb: INK } }), fill: FILL("FFFAFAF8"), border: BORDER4, alignment: CELL_ALIGN },
  note: { font: F({ italic: true, color: { argb: MUTED } }), border: BORDER4, alignment: CELL_ALIGN },
  tblHdr: { font: F({ bold: true, color: { argb: WHITE } }), fill: FILL("FF3A3A36"), border: BORDER4, alignment: HDR_ALIGN },
  cmpHdr: { font: F({ bold: true, color: { argb: WHITE } }), fill: FILL("FF1D4E89"), border: BORDER4, alignment: HDR_ALIGN },
  reqCell: { font: F({ color: { argb: INK } }), fill: FILL("FFFBE9E7"), border: BORDER4, alignment: CELL_ALIGN },
  reqYes: { font: F({ bold: true, color: { argb: "FFC0392B" } }), fill: FILL("FFFBE9E7"), border: BORDER4, alignment: CELL_ALIGN },
  /* Data Entry empty rows: an outlined grid ready to type into. */
  gridOpt: { font: F({ color: { argb: INK } }), fill: FILL(WHITE), border: BORDER4, alignment: DE_ALIGN },
};

export const DATA_ENTRY_SHEET = "Data Entry";
export const DATA_ROWS = 600;
/** Columns kept frozen on the Data Entry sheet (the UAC standard freezes three). */
export const FROZEN_COLUMNS = 3;
export const GUIDE_WIDTH = 66;
/** Default row height of the Data Entry sheet (rows 3 to 600 carry no explicit height). */
export const DATA_ENTRY_ROW_HEIGHT = 20;
/** Every spacer row on every tab. No row in the workbook is set below 15. */
export const SPACER_ROW_HEIGHT = 18;
export const MIN_ROW_HEIGHT = 15;

function colLetter(n) {
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

/* ─── Model: everything the three outputs need, resolved from spec.data ─── */

function unitsByCategory() {
  const order = [];
  const byCat = new Map();
  for (const [name, cat] of OPTION_SNAPSHOTS.units) {
    if (!byCat.has(cat)) {
      byCat.set(cat, []);
      order.push(cat);
    }
    byCat.get(cat).push(name);
  }
  return order.map((cat) => [cat, byCat.get(cat).join(", ")]);
}

function resolveValidValues(blocks) {
  return blocks.map((b) => {
    const out = { heading: b.heading };
    if (b.subHeader) out.subHeader = [...b.subHeader];
    if (b.rows) out.rows = b.rows.map((r) => [...r]);
    if (b.rowsRef === "unitsByCategory") out.rows = unitsByCategory();
    else if (b.rowsRef === "categories") out.rows = OPTION_SNAPSHOTS.categories.map((r) => [...r]);
    else if (b.rowsRef === "users") out.rows = OPTION_SNAPSHOTS.users.map((r) => [...r]);
    else if (b.rowsRef === "approvers") out.rows = OPTION_SNAPSHOTS.approvers.map((r) => [...r]);
    if (b.noteRef === "locations") out.note = `${OPTION_SNAPSHOTS.locations.join(", ")}.`;
    else if (b.noteRef === "partners") out.note = `${OPTION_SNAPSHOTS.partners.join(", ")}.`;
    if (b.note) out.note = out.note ? `${out.note} ${b.note}` : b.note;
    return out;
  });
}

/** Resolve the template model from spec.data.mjs. Same output in Node and in the app. */
export function buildTemplateModel() {
  return {
    fileBase: FILE_BASE,
    guideFile: GUIDE_FILE,
    title: TEMPLATE.title,
    bannerFieldReference: TEMPLATE.bannerFieldReference,
    sheetTitle: TEMPLATE.sheetTitle,
    moduleLine: TEMPLATE.moduleLine,
    countLine: TEMPLATE.countLine,
    frSubtitle: TEMPLATE.frSubtitle,
    vvTitle: TEMPLATE.vvTitle,
    vvSubtitle: TEMPLATE.vvSubtitle,
    columns: COLUMNS.map((c) => ({
      key: c.key,
      label: c.label,
      required: !!c.required,
      width: c.width,
      text: !!c.text,
      group: c.group,
      reference: { ...c.reference },
      /* Fixed product values (status, yes/no, enums) become a Data Entry dropdown. Columns that name
       * records users add in Omne (optionsRef) and multi-value lists stay free text. */
      ...((c.kind === "select" || c.kind === "yesno") && !c.optionsRef && c.options ? { options: [...c.options] } : {}),
    })),
    headers: [...TEMPLATE_HEADERS],
    examples: EXAMPLE_ROWS.map((r) => [...r]),
    instructions: {
      quickStart: [...TEMPLATE.instructions.quickStart],
      sections: TEMPLATE.instructions.sections.map((s) => ({
        heading: s.heading,
        intro: s.intro,
        items: s.items ? s.items.map((i) => [...i]) : undefined,
      })),
    },
    compareTable: {
      heading: TEMPLATE.compareTable.heading,
      colHeaders: [...TEMPLATE.compareTable.colHeaders],
      rows: TEMPLATE.compareTable.rows.map((r) => [...r]),
      mergedLast: TEMPLATE.compareTable.mergedLast ? [...TEMPLATE.compareTable.mergedLast] : undefined,
    },
    validValues: resolveValidValues(TEMPLATE.validValues),
    guide: TEMPLATE.guide,
  };
}

/* ─── Workbook ─── */

/* Excel's autofit never covers merged cells and leaves the last line of
 * unmerged wrapped text touching the bottom border, so every wrapped table
 * row gets an explicit, padded height. `cells` is a list of [text, width, bold?]
 * (an array of the column widths for a merged range). Lines come from
 * textMeasure.mjs, Excel's own Arial 10 wrap, validated against real Excel
 * AutoFit with 0 under- and 0 over-predictions. */
function rowHeightFor(cells) {
  let lines = 1;
  for (const [text, width, bold] of cells) lines = Math.max(lines, lineCount(String(text ?? ""), width, bold));
  return Math.max(20, lines * 13.5 + 8);
}

/** Put `value` in columns c1..c2 of row r, styling every cell of the range, and merge it. */
function putMerged(ws, r, c1, c2, value, style) {
  for (let c = c1; c <= c2; c++) Object.assign(ws.getCell(r, c), style);
  ws.getCell(r, c1).value = value;
  if (c2 > c1) ws.mergeCells(r, c1, r, c2);
}

/** Column widths of c1..c2 (textMeasure sums their pixels for a merged range). */
function widthOf(widths, c1, c2) {
  return widths.slice(c1 - 1, c2);
}

/** Outline rows fromRow..toRow of a Data Entry sheet as an empty grid: thin
 * borders on every column, white fill, Arial 10, wrap / top / left, the column's
 * text numFmt, and no explicit row height (the sheet default is 20, and Excel
 * autofits a row as text is typed). Shared by the
 * template and the failed-rows export so the whole family matches. */
export function applyDataEntryGrid(ws, columns, fromRow, toRow) {
  for (let r = fromRow; r <= toRow; r++) {
    const row = ws.getRow(r);
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      Object.assign(cell, S.gridOpt);
      if (c.text) cell.numFmt = "@";
    });
  }
}

/** Data Entry dropdowns for the columns that carry fixed `options`, rows fromRow..toRow:
 * a list validation with a warning (the value can still be kept), pointing at the Valid Values tab.
 * Same standard in every Omne import template. */
export function applyListValidations(ws, columns, fromRow, toRow) {
  columns.forEach((c, i) => {
    if (!c.options || c.options.length === 0) return;
    const col = colLetter(i + 1);
    ws.dataValidations.add(`${col}${fromRow}:${col}${toRow}`, {
      type: "list",
      allowBlank: true,
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: c.label,
      error: "This value is not in the list. Check the Valid Values tab.",
      formulae: [`"${c.options.join(",")}"`],
    });
  });
}

/** Row 1 brand band: "<title>  ·  <sheet>" in A1, fill across A..lastCol, height 32, no borders, no merge. */
export function applyHeadingBand(ws, title, sheetName, lastCol) {
  for (let c = 1; c <= lastCol; c++) Object.assign(ws.getCell(1, c), S.band);
  ws.getCell(1, 1).value = `${title}  ·  ${sheetName}`;
  ws.getRow(1).height = 32;
}

/** One empty spacer row between the title block and a table, or between tables. */
function spacer(ws, r) {
  ws.getRow(r).height = SPACER_ROW_HEIGHT;
}

/* Title block under the band: row 2 title, row 3 subtitle, optional row 4
 * meta line, then one 18pt spacer row. Returns the first table row. */
function titleBlock(ws, col, title, subtitle, meta) {
  let r = 2;
  put(ws, `${col}${r}`, title, S.title15);
  ws.getRow(r++).height = 26;
  put(ws, `${col}${r}`, subtitle, S.sub10);
  ws.getRow(r++).height = 18;
  if (meta) {
    put(ws, `${col}${r}`, meta, S.sub10);
    ws.getRow(r++).height = 18;
  }
  ws.getRow(r++).height = SPACER_ROW_HEIGHT;
  return r;
}

/** Build the four-sheet workbook. `ExcelJS` is the exceljs module (default export). */
export function buildWorkbookWith(ExcelJS, model = buildTemplateModel()) {
  const wb = new ExcelJS.Workbook();
  const cols = model.columns;
  const headers = model.headers;

  /* Sheet 1: Data Entry */
  const de = wb.addWorksheet(DATA_ENTRY_SHEET, {
    properties: { defaultRowHeight: DATA_ENTRY_ROW_HEIGHT },
    views: [
      {
        state: "frozen",
        xSplit: FROZEN_COLUMNS,
        ySplit: 2,
        topLeftCell: `${colLetter(FROZEN_COLUMNS + 1)}3`,
        showGridLines: false,
      },
    ],
  });
  cols.forEach((c, i) => {
    de.getColumn(i + 1).width = c.width ?? Math.max(14, +(c.label.length * 0.95).toFixed(2));
  });
  applyHeadingBand(de, model.title, DATA_ENTRY_SHEET, cols.length);
  de.getRow(2).height = 30;
  headers.forEach((h, i) => put(de, `${colLetter(i + 1)}2`, h, cols[i].required ? S.hdrReq : S.hdrOpt));
  model.examples.forEach((row, r) =>
    cols.forEach((c, i) => put(de, `${colLetter(i + 1)}${3 + r}`, row[i] || null, S.example, c.text ? "@" : undefined)),
  );
  applyDataEntryGrid(de, cols, 3 + model.examples.length, DATA_ROWS);
  applyListValidations(de, cols, 3, DATA_ROWS);

  /* The three reference tabs share one page style (the Valid Values one):
   * band, title block, then a stack of cards separated by one 18pt spacer.
   * A card is a title bar, an optional dark header row and bordered body
   * rows (first column on F7F6F3, the others zebra white / FAFAF8). */
  const cardTitle = (ws, row, c1, c2, text) => {
    putMerged(ws, row, c1, c2, text, S.secTitle);
    ws.getRow(row).height = 24;
  };
  const cardHeader = (ws, row, cells) => {
    for (const [c1, c2, text] of cells) putMerged(ws, row, c1, c2, text, S.tblHdr);
    ws.getRow(row).height = 24;
  };
  /* `cells` is a list of [c1, c2, text]; the first one is the key column. */
  const cardRow = (ws, row, widths, cells, i) => {
    cells.forEach(([c1, c2, text], k) => putMerged(ws, row, c1, c2, text, k === 0 ? S.value : i % 2 === 1 ? S.zebra : S.cell));
    ws.getRow(row).height = rowHeightFor(cells.map(([c1, c2, text]) => [text, widthOf(widths, c1, c2)]));
  };
  const cardNote = (ws, row, widths, c1, c2, text, style) => {
    putMerged(ws, row, c1, c2, text, style);
    ws.getRow(row).height = rowHeightFor([[text, widthOf(widths, c1, c2)]]);
  };

  /* Sheet 2: Instructions (A gutter, cards over B:C) */
  const INS_W = [2, 30, 100];
  const ins = wb.addWorksheet("Instructions", { views: [{ showGridLines: false }] });
  INS_W.forEach((w, i) => (ins.getColumn(i + 1).width = w));
  applyHeadingBand(ins, model.title, "Instructions", INS_W.length);
  let r = titleBlock(ins, "B", "Instructions", model.moduleLine, model.countLine);
  cardTitle(ins, r++, 2, 3, "QUICK START");
  cardHeader(ins, r++, [
    [2, 2, "Step"],
    [3, 3, "What to do"],
  ]);
  model.instructions.quickStart.forEach((t, i) =>
    cardRow(ins, r++, INS_W, [
      [2, 2, `Step ${i + 1}`],
      [3, 3, t],
    ], i),
  );
  for (const sec of model.instructions.sections) {
    spacer(ins, r++);
    cardTitle(ins, r++, 2, 3, sec.heading);
    if (sec.intro) cardNote(ins, r++, INS_W, 2, 3, sec.intro, S.cell);
    if (sec.items?.length) {
      const matched = /MATCHED/i.test(sec.heading);
      cardHeader(ins, r++, [
        [2, 2, matched ? "Case" : "Topic"],
        [3, 3, matched ? "What happens" : "Details"],
      ]);
      sec.items.forEach(([label, body], i) =>
        cardRow(ins, r++, INS_W, [
          [2, 2, label],
          [3, 3, body],
        ], i),
      );
    }
  }

  /* Sheet 3: Field Reference (cards over A:F) */
  const FR_W = [26, 11, 56, 22, 30, 28];
  const fr = wb.addWorksheet("Field Reference", { views: [{ showGridLines: false }] });
  FR_W.forEach((w, i) => (fr.getColumn(i + 1).width = w));
  applyHeadingBand(fr, model.title, "Field Reference", FR_W.length);
  r = titleBlock(fr, "A", "Field Reference", model.frSubtitle);
  if (model.compareTable) {
    const ct = model.compareTable;
    cardTitle(fr, r++, 1, 6, ct.heading);
    cardHeader(fr, r++, [
      [1, 1, null],
      [2, 3, ct.colHeaders[0]],
      [4, 6, ct.colHeaders[1]],
    ]);
    ct.rows.forEach(([a, b, c], i) =>
      cardRow(fr, r++, FR_W, [
        [1, 1, a],
        [2, 3, b],
        [4, 6, c],
      ], i),
    );
    if (ct.mergedLast) {
      const [a, b] = ct.mergedLast;
      cardRow(fr, r++, FR_W, [
        [1, 1, a],
        [2, 6, b],
      ], ct.rows.length);
    }
    spacer(fr, r++);
  }
  cardTitle(fr, r++, 1, 6, "All columns");
  cardHeader(
    fr,
    r++,
    ["Field", "Required", "Description", "Format", "Valid Values", "Example"].map((h, i) => [i + 1, i + 1, h]),
  );
  let optional = 0;
  for (const c of cols) {
    const vals = [c.label, c.required ? "Yes" : "No", c.reference.description, c.reference.format, c.reference.validValues || null, c.reference.example];
    if (c.required) {
      /* The one tint that stays: required rows carry meaning. */
      vals.forEach((v, i) => put(fr, `${colLetter(i + 1)}${r}`, v, i === 1 ? S.reqYes : S.reqCell));
      fr.getRow(r++).height = rowHeightFor(vals.map((v, i) => [v, FR_W[i], i === 1]));
    } else {
      cardRow(fr, r++, FR_W, vals.map((v, i) => [i + 1, i + 1, v]), optional++);
    }
  }

  /* Sheet 4: Valid Values (A gutter, cards over B:C) */
  const VV_W = [2, 30, 90];
  const vv = wb.addWorksheet("Valid Values", { views: [{ showGridLines: false }] });
  VV_W.forEach((w, i) => (vv.getColumn(i + 1).width = w));
  applyHeadingBand(vv, model.title, "Valid Values", VV_W.length);
  r = titleBlock(vv, "B", model.vvTitle, model.vvSubtitle);
  model.validValues.forEach((block, bi) => {
    if (bi > 0) spacer(vv, r++);
    cardTitle(vv, r++, 2, 3, block.heading);
    if (block.subHeader) {
      cardHeader(vv, r++, [
        [2, 2, block.subHeader[0]],
        [3, 3, block.subHeader[1]],
      ]);
    }
    (block.rows ?? []).forEach(([label, body], i) =>
      cardRow(vv, r++, VV_W, [
        [2, 2, label],
        [3, 3, body],
      ], i),
    );
    /* A note under a value table is a muted aside; a block with no rows
     * (the locations and partners lists) is the content itself. */
    if (block.note) cardNote(vv, r++, VV_W, 2, 3, block.note, block.rows?.length ? S.note : S.cell);
  });

  return wb;
}

/* ─── CSV ─── */

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV template: header row + two example rows. UTF-8, no BOM, LF, trailing newline. */
export function buildTemplateCsvText(model = buildTemplateModel()) {
  const lines = [model.headers, ...model.examples].map((r) => r.map(csvCell).join(","));
  return `${lines.join("\n")}\n`;
}

/* ─── Guide txt ─── */

/** Greedy word wrap to `width` columns; continuation lines get `indent` spaces. */
export function wrapText(text, width = GUIDE_WIDTH, indent = 0, firstIndent = indent) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  let avail = width - firstIndent;
  for (const w of words) {
    if (line && line.length + 1 + w.length > avail) {
      lines.push(line);
      line = w;
      avail = width - indent;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.map((l, i) => " ".repeat(i === 0 ? firstIndent : indent) + l);
}

function labeled(label, text, gap = 2, leading = 0) {
  const head = " ".repeat(leading) + label + " ".repeat(gap);
  const lines = wrapText(text, GUIDE_WIDTH, head.length, head.length);
  lines[0] = head + lines[0].trimStart();
  return lines;
}

function alignedGroup(items, leading = 2, gap = 3) {
  const maxLen = Math.max(...items.map(([l]) => l.length));
  const out = [];
  for (const [label, text] of items) {
    const padded = label + " ".repeat(maxLen - label.length);
    out.push(...labeled(padded, text, gap, leading));
  }
  return out;
}

const RULE = "=".repeat(GUIDE_WIDTH);
const DIVIDER = "-".repeat(GUIDE_WIDTH);

/* A section body always ends with one blank line; the extra "" leaves two
 * blank lines before the next divider, like the UAC guide. */
function section(title, body) {
  return [DIVIDER, title, DIVIDER, "", ...body, ""];
}

function subheader(title) {
  return [title, "-".repeat(title.length)];
}

/** The plain-text companion to the CSV (66-column wrap, "=" banner, "-" dividers). */
export function buildGuideText(model = buildTemplateModel()) {
  const g = model.guide;
  const out = [];

  out.push(RULE, g.banner, model.moduleLine, RULE, "");
  for (const p of g.intro) out.push(...wrapText(p), "");
  out.push("");

  /* QUICK START */
  const steps = [];
  g.quickStart.forEach((t, i) => {
    steps.push(...labeled(`Step ${i + 1}`, t, 3), "");
  });
  out.push(...section("QUICK START", steps));

  /* HOW ITEMS ARE MATCHED */
  const m = g.matched;
  const matched = [...wrapText(m.intro), ""];
  matched.push(...subheader(m.newHeading), ...wrapText(m.newIntro), "");
  matched.push(...alignedGroup(m.newItems), "");
  matched.push(...subheader(m.existingHeading), ...wrapText(m.existingIntro), "");
  matched.push(...alignedGroup(m.existingItems), "");
  out.push(...section("HOW ITEMS ARE MATCHED", matched));

  out.push(...section("COPYING FROM ANOTHER SYSTEM", [...wrapText(g.copying), ""]));
  out.push(...section("WHAT THE FILE DOES NOT COVER", [...wrapText(g.notCovered), ""]));
  out.push(...section("FILE LIMITS", [...wrapText(g.fileLimits), ""]));

  /* FIELD REFERENCE */
  const fr = [];
  for (const group of g.fieldGroups) {
    const cols = model.columns.filter((c) => c.group === group);
    if (cols.length === 0) continue;
    fr.push(...subheader(group), "");
    for (const c of cols) {
      const text = c.reference.validValues
        ? `${c.reference.description} Values: ${c.reference.validValues}.`
        : c.reference.description;
      fr.push(...labeled(c.label, text), "");
    }
  }
  out.push(...section("FIELD REFERENCE", fr));

  /* VALID VALUES */
  const vv = [];
  for (const block of model.validValues) {
    vv.push(...subheader(block.heading));
    for (const [label, body] of block.rows ?? []) vv.push(...labeled(label, body), "");
    if (block.note) vv.push(...wrapText(block.note), "");
  }
  out.push(...section("VALID VALUES", vv));

  return `${out.join("\n").replace(/\n{3,}$/g, "\n")}\n`;
}
