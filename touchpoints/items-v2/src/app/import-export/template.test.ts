/* Byte-sync rule: the checked-in template files under public/templates must
 * equal what the shared layout produces from spec.data, and the header row
 * must be identical in the CSV, in Data Entry row 2 and in TEMPLATE_HEADERS. */
/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { TEMPLATE_HEADERS, EXAMPLE_ROWS } from "./spec.data.mjs";
import { ITEMS_IMPORT_SPEC } from "./spec";
import { buildTemplateCsv, buildGuideText, GUIDE_WIDTH } from "./templateCsv";
import { lineCount } from "./textMeasure.mjs";
import { buildTemplateWorkbook, DATA_ENTRY_SHEET, DATA_ROWS, FROZEN_COLUMNS } from "./templateWorkbook";
import { parseCsvText } from "./fileParser";

const dir = join(process.cwd(), "public", "templates");
const csvOnDisk = readFileSync(join(dir, ITEMS_IMPORT_SPEC.files.csv), "utf8");
const guideOnDisk = readFileSync(join(dir, ITEMS_IMPORT_SPEC.files.guide), "utf8");
const xlsxOnDisk = readFileSync(join(dir, ITEMS_IMPORT_SPEC.files.xlsx));

describe("CSV template", () => {
  it("checked-in file equals the generated text (UTF-8, no BOM, LF)", () => {
    expect(csvOnDisk).toBe(buildTemplateCsv(ITEMS_IMPORT_SPEC));
    expect(csvOnDisk.charCodeAt(0)).not.toBe(0xfeff);
    expect(csvOnDisk.includes("\r")).toBe(false);
    expect(csvOnDisk.endsWith("\n")).toBe(true);
  });
  it("header row equals TEMPLATE_HEADERS and the two example rows follow", () => {
    const grid = parseCsvText(csvOnDisk);
    expect(grid[0]).toEqual([...TEMPLATE_HEADERS]);
    expect(grid[1]).toEqual([...EXAMPLE_ROWS[0]]);
    expect(grid[2]).toEqual([...EXAMPLE_ROWS[1]]);
    expect(grid).toHaveLength(3);
  });
});

describe("Guide txt", () => {
  it("checked-in file equals the generated text", () => {
    expect(guideOnDisk).toBe(buildGuideText(ITEMS_IMPORT_SPEC));
  });
  it("follows the UAC guide structure: = banner, 66-dash dividers, QUICK START, no line over 66 columns", () => {
    const lines = guideOnDisk.split("\n");
    expect(lines[0]).toBe("=".repeat(GUIDE_WIDTH));
    expect(lines[1]).toBe("OMNE ITEMS IMPORT GUIDE");
    expect(lines[3]).toBe("=".repeat(GUIDE_WIDTH));
    const dividers = lines.filter((l) => l === "-".repeat(GUIDE_WIDTH));
    expect(dividers.length).toBeGreaterThanOrEqual(4);
    const titles = lines.filter((l, i) => lines[i - 1] === "-".repeat(GUIDE_WIDTH) && lines[i + 1] === "-".repeat(GUIDE_WIDTH));
    expect(titles).toEqual([
      "QUICK START",
      "HOW ITEMS ARE MATCHED",
      "COPYING FROM ANOTHER SYSTEM",
      "WHAT THE FILE DOES NOT COVER",
      "FILE LIMITS",
      "FIELD REFERENCE",
      "VALID VALUES",
    ]);
    const tooLong = lines.filter((l) => l.length > GUIDE_WIDTH);
    expect(tooLong).toEqual([]);
    expect(guideOnDisk.includes("—")).toBe(false);
  });
});

describe("XLSX template", () => {
  it("Data Entry row 2 equals TEMPLATE_HEADERS, both in the checked-in file and in the in-app workbook", async () => {
    const onDisk = new ExcelJS.Workbook();
    await onDisk.xlsx.load(xlsxOnDisk as unknown as ArrayBuffer);
    const built = await buildTemplateWorkbook(ITEMS_IMPORT_SPEC);
    for (const wb of [onDisk, built]) {
      expect(wb.worksheets.map((s: { name: string }) => s.name)).toEqual([DATA_ENTRY_SHEET, "Instructions", "Field Reference", "Valid Values"]);
      const de = wb.getWorksheet(DATA_ENTRY_SHEET)!;
      const row2 = (de.getRow(2).values as unknown[]).slice(1).map((v) => String(v ?? ""));
      expect(row2).toEqual([...TEMPLATE_HEADERS]);
      const row3 = (de.getRow(3).values as unknown[]).slice(1).map((v) => (v == null ? "" : String(v)));
      expect(row3.slice(0, 6)).toEqual([...EXAMPLE_ROWS[0].slice(0, 6)]);
      expect(String(de.getCell("A1").value)).toBe("OMNE  ·  Items Import Template  ·  Data Entry");
    }
  });
  it("carries the UAC style system on Data Entry", async () => {
    const wb = await buildTemplateWorkbook(ITEMS_IMPORT_SPEC);
    const de = wb.getWorksheet(DATA_ENTRY_SHEET)!;
    expect(de.views[0]).toMatchObject({ state: "frozen", xSplit: FROZEN_COLUMNS, ySplit: 2, topLeftCell: `${String.fromCharCode(65 + FROZEN_COLUMNS)}3`, showGridLines: false });
    expect(de.properties.defaultRowHeight).toBe(20);
    expect(de.getRow(2).height).toBe(30);
    const req = de.getCell("A2");
    expect(req.fill).toMatchObject({ fgColor: { argb: "FFC0392B" } });
    expect(req.font).toMatchObject({ name: "Arial", bold: true, color: { argb: "FFFFFFFF" } });
    const opt = de.getCell("B2");
    expect(opt.fill).toMatchObject({ fgColor: { argb: "FFE8E6E1" } });
    expect(opt.font).toMatchObject({ color: { argb: "FF1A1A18" } });
    expect(opt.border).toMatchObject({ left: { style: "thin", color: { argb: "FFD8D6D1" } } });
    const ex = de.getCell("A3");
    expect(ex.font).toMatchObject({ italic: true, color: { argb: "FF6B6B66" } });
    expect(ex.fill).toMatchObject({ fgColor: { argb: "FFF2F1EE" } });
    expect(ex.numFmt).toBe("@");
    expect(de.getCell(DATA_ROWS, 1).numFmt).toBe("@");
    expect(de.rowCount).toBe(DATA_ROWS);
    const fr = wb.getWorksheet("Field Reference")!;
    expect(fr.getCell("B6").fill).toMatchObject({ fgColor: { argb: "FF3A3A36" } });
    expect(fr.columns.map((c: { width?: number }) => c.width)).toEqual([26, 11, 56, 22, 30, 28]);
    const ins = wb.getWorksheet("Instructions")!;
    expect(ins.columns.map((c: { width?: number }) => c.width)).toEqual([2, 30, 100]);
    expect(String(ins.getCell("B6").value)).toBe("QUICK START");
    const vv = wb.getWorksheet("Valid Values")!;
    expect(vv.columns.map((c: { width?: number }) => c.width)).toEqual([2, 30, 90]);
  });
  it("puts the same row 1 brand band and title block on every tab", async () => {
    const wb = await buildTemplateWorkbook(ITEMS_IMPORT_SPEC);
    const titles: Record<string, [string, string] | null> = {
      [DATA_ENTRY_SHEET]: null,
      Instructions: ["B", "Instructions"],
      "Field Reference": ["A", "Field Reference"],
      "Valid Values": ["B", "Valid Values & Reference"],
    };
    for (const ws of wb.worksheets) {
      expect(String(ws.getCell("A1").value)).toBe(`OMNE  ·  Items Import Template  ·  ${ws.name}`);
      expect(String(ws.getCell("A1").value)).not.toContain("Part Number");
      expect(ws.getCell("A1").fill).toMatchObject({ fgColor: { argb: "FF1D4E89" } });
      expect(ws.getCell("A1").font).toMatchObject({ name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } });
      expect(ws.getRow(1).height).toBe(32);
      expect(ws.getCell(1, ws.columnCount).fill).toMatchObject({ fgColor: { argb: "FF1D4E89" } });
      const t = titles[ws.name];
      if (!t) continue;
      expect(ws.getCell(`${t[0]}2`).value).toBe(t[1]);
      expect(ws.getRow(2).height).toBe(26);
      expect(ws.getRow(3).height).toBe(18);
    }
    expect(wb.getWorksheet("Instructions")!.getRow(5).height).toBe(18);
    expect(wb.getWorksheet("Field Reference")!.getRow(4).height).toBe(18);
    expect(wb.getWorksheet("Valid Values")!.getRow(4).height).toBe(18);
  });
  it("never sets a row below 15pt, and every spacer row is exactly 18pt, one at a time", async () => {
    const wb = await buildTemplateWorkbook(ITEMS_IMPORT_SPEC);
    for (const ws of wb.worksheets) {
      let prevEmpty = false;
      for (let r = 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        if (row.height !== undefined) expect(row.height, `${ws.name} row ${r}`).toBeGreaterThanOrEqual(15);
        if (ws.name === DATA_ENTRY_SHEET) continue;
        const empty = (row.values as unknown[]).every((v) => v == null || v === "");
        if (empty) {
          expect(row.height, `${ws.name} spacer row ${r}`).toBe(18);
          expect(prevEmpty, `${ws.name} two spacers at row ${r}`).toBe(false);
          expect(r, `${ws.name} spacer under the band`).not.toBe(2);
        }
        prevEmpty = empty;
      }
    }
  });
  it("outlines every table cell and the empty Data Entry rows (one standard for all import templates)", async () => {
    const thin = { style: "thin", color: { argb: "FFD8D6D1" } };
    const boxed = { top: thin, left: thin, bottom: thin, right: thin };
    const wb = await buildTemplateWorkbook(ITEMS_IMPORT_SPEC);
    const de = wb.getWorksheet(DATA_ENTRY_SHEET)!;
    const last = TEMPLATE_HEADERS.length;
    for (const r of [5, DATA_ROWS]) {
      expect(de.getCell(r, last).border).toMatchObject(boxed);
      expect(de.getCell(r, 1).border).toMatchObject(boxed);
      expect(de.getCell(r, last).alignment).toMatchObject({ wrapText: true, vertical: "top", horizontal: "left" });
    }
    expect(de.getCell("C3").alignment).toMatchObject({ wrapText: true, vertical: "top", horizontal: "left" });
    /* No explicit height on rows 3 to 600, so Excel autofits as the user types. */
    for (let r = 3; r <= DATA_ROWS; r++) expect(de.getRow(r).height).toBeUndefined();
    expect(de.getRow(2).height).toBe(30);
    expect(de.getRow(1).height).toBe(32);
    /* No required tint in the empty grid: every empty cell is white. */
    expect(de.getCell(5, 1).fill).toMatchObject({ fgColor: { argb: "FFFFFFFF" } });
    expect(de.getCell(DATA_ROWS, 5).fill).toMatchObject({ fgColor: { argb: "FFFFFFFF" } });
    expect(de.getCell(5, 2).fill).toMatchObject({ fgColor: { argb: "FFFFFFFF" } });
    expect(de.getCell(5, 1).font).toMatchObject({ name: "Arial", size: 10, color: { argb: "FF1A1A18" } });
    const wrapped = { wrapText: true, vertical: "middle", horizontal: "left", indent: 1 };
    const dark = { fgColor: { argb: "FF3A3A36" } };
    const bar = { fgColor: { argb: "FFF2F1EE" } };
    /* Every reference tab is a stack of Valid Values style cards: title bar, dark header, body. */
    const ins = wb.getWorksheet("Instructions")!;
    expect(ins.getCell("B6").value).toBe("QUICK START");
    expect(ins.getCell("B6").fill).toMatchObject(bar);
    expect(ins.getCell("C6").isMerged).toBe(true);
    expect([ins.getCell("B7").value, ins.getCell("C7").value]).toEqual(["Step", "What to do"]);
    expect(ins.getCell("B7").fill).toMatchObject(dark);
    expect(ins.getCell("B7").alignment).toMatchObject({ vertical: "middle" });
    expect(ins.getCell("B8").value).toBe("Step 1");
    for (const a of ["B8", "C8"]) {
      expect(ins.getCell(a).border).toMatchObject(boxed);
      expect(ins.getCell(a).alignment).toMatchObject(wrapped);
    }
    expect(ins.getCell("B8").fill).toMatchObject({ fgColor: { argb: "FFF7F6F3" } });
    const fr = wb.getWorksheet("Field Reference")!;
    /* Compare card: row 5 title bar, row 6 dark header, body from row 7 with B:C and D:F merged. */
    expect(fr.getCell("A5").fill).toMatchObject(bar);
    expect(fr.getCell("B6").fill).toMatchObject(dark);
    expect(fr.getRow(6).height).toBe(24);
    expect(fr.getCell("A7").value).toBe(ITEMS_IMPORT_SPEC.template.compareTable.rows[0][0]);
    expect(fr.getCell("A7").fill).toMatchObject({ fgColor: { argb: "FFF7F6F3" } });
    expect(fr.getCell("C7").master.address).toBe("B7");
    expect(fr.getCell("F7").master.address).toBe("D7");
    expect(fr.getCell("C6").master.address).toBe("B6");
    expect(fr.getCell("E6").master.address).toBe("D6");
    expect(fr.getCell("F7").border).toMatchObject(boxed);
    expect(fr.getCell("B7").alignment).toMatchObject(wrapped);
    /* Field card: row 14 "All columns" title bar, row 15 dark header, body from row 16. */
    expect(fr.getCell("A14").value).toBe("All columns");
    expect(fr.getCell("F14").master.address).toBe("A14");
    const hdr = (fr.getRow(15).values as unknown[]).slice(1);
    expect(hdr).toEqual(["Field", "Required", "Description", "Format", "Valid Values", "Example"]);
    expect(fr.getCell("A15").fill).toMatchObject(dark);
    expect(fr.autoFilter).toBeFalsy();
    /* Wrapped rows carry an explicit padded height from the Excel text measure. */
    const lines = lineCount(ITEMS_IMPORT_SPEC.template.columns[0].reference.description, 56);
    expect(fr.getRow(16).height).toBe(Math.max(20, lines * 13.5 + 8));
    expect(fr.getCell("C16").border).toMatchObject(boxed);
    expect(fr.getCell("C16").alignment).toMatchObject(wrapped);
    expect(fr.getCell("A16").fill).toMatchObject({ fgColor: { argb: "FFFBE9E7" } });
    expect(fr.getCell("B16").font).toMatchObject({ bold: true, color: { argb: "FFC0392B" } });
    expect(fr.getCell("A17").fill).toMatchObject({ fgColor: { argb: "FFF7F6F3" } });
    const vv = wb.getWorksheet("Valid Values")!;
    expect(vv.getCell("C5").master.address).toBe("B5");
    expect(vv.getCell("B6").fill).toMatchObject(dark);
    expect(vv.getCell("C7").border).toMatchObject(boxed);
    expect(vv.getCell("C7").alignment).toMatchObject(wrapped);
    expect(vv.getCell("B7").fill).toMatchObject({ fgColor: { argb: "FFF7F6F3" } });
    /* A one-line body row is 20 to 22pt, never two lines tall. */
    expect(vv.getCell("B12").value).toBe("Active");
    for (const [ws, r] of [[vv, 12], [ins, 8], [fr, 7]] as const) expect(ws.getRow(r).height).toBeLessThanOrEqual(22);
    expect(vv.getRow(7).height).toBeGreaterThanOrEqual(20);
  });
});
