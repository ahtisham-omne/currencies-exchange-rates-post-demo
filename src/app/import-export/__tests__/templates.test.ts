/// <reference types="node" />
/* Byte-sync rule: the checked-in public/templates files, the in-app
 * generators and the spec headers must all agree, for both entities. */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ExcelJS from "exceljs";
import { ALL_IMPORT_SPECS } from "../spec";
import { lineCount } from "../textMeasure.mjs";
import { buildTemplateWorkbook, templateCountLine, templateHeaders, DATA_ENTRY_SHEET, DATA_ROWS } from "../templateWorkbook";
import { buildGuideText, buildTemplateCsv, GUIDE_WIDTH } from "../templateCsv";
import { parseCSV, parseGrid, xlsxBufferToGrid } from "../fileParser";
import { validateRows } from "../validation";

const root = process.cwd();
const tpl = (name: string) => path.join(root, "public", "templates", name);
const rowValues = (ws: ExcelJS.Worksheet, n: number, count: number) =>
  Array.from({ length: count }, (_, i) => String(ws.getRow(n).getCell(i + 1).value ?? ""));

for (const spec of ALL_IMPORT_SPECS) {
  describe(`${spec.entity} template files`, () => {
    const headers = templateHeaders(spec);
    const csvPath = tpl(spec.template.csvFileName);
    const xlsxPath = tpl(spec.template.xlsxFileName);
    const guidePath = tpl(spec.template.guideFileName);

    it("all three files are checked in", () => {
      for (const p of [csvPath, xlsxPath, guidePath]) expect(fs.existsSync(p), p).toBe(true);
    });

    it("CSV header row equals the spec headers; UTF-8 no BOM, LF only, trailing newline", () => {
      const buf = fs.readFileSync(csvPath);
      expect(buf[0]).not.toBe(0xef);
      const text = buf.toString("utf8");
      expect(text).not.toContain("\r");
      expect(text.endsWith("\n")).toBe(true);
      expect(text.split("\n")[0]).toBe(headers.join(","));
      expect(text).toBe(buildTemplateCsv(spec));
      const rows = parseCSV(text);
      expect(rows).toHaveLength(3);
      expect(rows[1]).toEqual(spec.data.examples[0]);
      expect(rows[2]).toEqual(spec.data.examples[1]);
    });

    it("xlsx Data Entry row 2 equals the spec headers and the shipped file matches the in-app generator", async () => {
      const shipped = new ExcelJS.Workbook();
      await shipped.xlsx.readFile(xlsxPath);
      expect(shipped.worksheets.map((w) => w.name)).toEqual([DATA_ENTRY_SHEET, "Instructions", "Field Reference", "Valid Values"]);
      const de = shipped.getWorksheet(DATA_ENTRY_SHEET)!;
      expect(rowValues(de, 2, headers.length)).toEqual(headers);
      expect(String(de.getCell("A1").value)).toBe(`Omne  ·  ${spec.entity} Import Template  ·  Data Entry`);
      expect(de.getRow(2).height).toBe(30);
      expect(de.views[0]).toMatchObject({ state: "frozen", xSplit: spec.data.freezeColumns, ySplit: 2, topLeftCell: expect.stringMatching(/3$/), showGridLines: false });
      expect(de.properties.defaultRowHeight).toBe(20);
      expect(de.rowCount).toBeGreaterThanOrEqual(DATA_ROWS);
      expect(rowValues(de, 3, headers.length)).toEqual(spec.data.examples[0]);
      expect(rowValues(de, 4, headers.length)).toEqual(spec.data.examples[1]);
      /* required = white on #C0392B, optional = ink on #E8E6E1, both Arial bold */
      spec.columns.forEach((c, i) => {
        const cell = de.getRow(2).getCell(i + 1);
        const fill = cell.fill as ExcelJS.FillPattern;
        expect(fill.fgColor?.argb).toBe(c.required ? "FFC0392B" : "FFE8E6E1");
        expect(cell.font?.name).toBe("Arial");
        expect(cell.font?.bold).toBe(true);
        if (c.text) expect(de.getRow(10).getCell(i + 1).numFmt).toBe("@");
      });
      const ins = shipped.getWorksheet("Instructions")!;
      expect(String(ins.getCell("B4").value)).toBe(templateCountLine(spec));
      expect(String(ins.getCell("B6").value)).toBe("Quick Start");
      const fr = shipped.getWorksheet("Field Reference")!;
      expect(String(fr.getCell("A5").value)).toBe(spec.data.compareTable!.heading);
      expect((fr.getCell("B6").fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FF3A3A36"); // compare header now matches every table header

      /* 2026-09-30 table standard: bordered grid, wrapped cells, new widths */
      const thin = (cell: ExcelJS.Cell) => {
        for (const side of ["left", "right", "top", "bottom"] as const) {
          expect(cell.border?.[side]?.style, `${cell.address} ${side}`).toBe("thin");
          expect(cell.border?.[side]?.color?.argb, `${cell.address} ${side}`).toBe("FFD8D6D1");
        }
      };
      const last = headers.length;
      for (const n of [5, DATA_ROWS]) {
        thin(de.getRow(n).getCell(last));
        thin(de.getRow(n).getCell(1));
        expect(de.getRow(n).height).toBeUndefined();
        expect(de.getRow(n).getCell(3).alignment).toMatchObject({ wrapText: true, vertical: "top", horizontal: "left" });
        expect(de.getRow(n).getCell(1).font?.name).toBe("Arial");
      }
      /* Addendum 3: rows 3 to 600 carry no explicit height (Excel autofits), examples wrap too */
      for (let n = 3; n <= DATA_ROWS; n++) expect(de.getRow(n).height, `row ${n}`).toBeUndefined();
      expect(de.getRow(3).getCell(3).alignment).toMatchObject({ wrapText: true, vertical: "top", horizontal: "left" });
      expect(de.getRow(4).getCell(1).border?.bottom).toMatchObject({ style: "thin", color: { argb: "FFD8D6D1" } });
      spec.columns.forEach((c, i) => {
        const fill = de.getRow(5).getCell(i + 1).fill as ExcelJS.FillPattern;
        expect(fill.fgColor?.argb).toBe("FFFFFFFF"); // no required tint
      });
      expect([1, 2, 3].map((n) => ins.getColumn(n).width)).toEqual([2, 30, 100]);
      expect([1, 2, 3, 4, 5, 6].map((n) => fr.getColumn(n).width)).toEqual([26, 11, 56, 22, 30, 28]);
      const vvs = shipped.getWorksheet("Valid Values")!;
      expect([1, 2, 3].map((n) => vvs.getColumn(n).width)).toEqual([2, 30, 90]);
      /* a bordered, wrapped cell in each reference sheet */
      for (const cell of [ins.getCell("C8"), fr.getCell("A7"), vvs.getCell("C7")]) {
        thin(cell);
        expect(cell.alignment?.wrapText, cell.address).toBe(true);
        expect(cell.alignment?.vertical, cell.address).toBe("middle");
      }
      expect(String(ins.getCell("B7").value)).toBe("Step");
      expect(String(ins.getCell("C7").value)).toBe("What to Do");
      expect((ins.getCell("B7").fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FF3A3A36");
      expect(String(ins.getCell("B8").value)).toBe("Step 1");
      expect(ins.getCell("B6").isMerged).toBe(true);
      /* compare table: header and body use merged B:C and D:F */
      const merges = (fr.model as unknown as { merges: string[] }).merges;
      expect(merges).toContain("B6:C6");
      expect(merges).toContain("D6:F6");
      expect(merges).toContain("B7:C7");
      expect(merges).toContain("D7:F7");
      expect(String(fr.getCell("B7").value)).toBe(spec.data.compareTable!.rows[0][1]);
      expect(String(fr.getCell("D7").value)).toBe(spec.data.compareTable!.rows[0][2]);
      expect(fr.getRow(7).height).toBeGreaterThanOrEqual(20);
      expect(fr.autoFilter).toBeFalsy();
      /* every wrapped row carries an explicit padded height; a multi-line row is taller */
      const fieldRow = 7 + spec.data.compareTable!.rows.length + (spec.data.compareTable!.mergedLast ? 1 : 0) + 3;
      /* Addendum 5: the field table is a card with an "All columns" title bar */
      expect(String(fr.getCell(`A${fieldRow - 2}`).value)).toBe("All Columns");
      expect(fr.getCell(`A${fieldRow - 2}`).isMerged).toBe(true);
      expect((fr.getCell(`A${fieldRow - 2}`).fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFF2F1EE");
      expect(String(fr.getCell(`A${fieldRow - 1}`).value)).toBe("Field");
      expect(String(fr.getCell(`A${fieldRow}`).value)).toBe(spec.columns[0].label);
      for (let n = fieldRow; n < fieldRow + spec.columns.length; n++) expect(fr.getRow(n).height, `FR row ${n}`).toBeGreaterThanOrEqual(20);
      expect(fr.getRow(fieldRow).height).toBeGreaterThan(22);
      /* calibrated factor: a one-line row is at most 22, never two lines tall */
      /* real Arial 10 measurement: the Valid Values "New Name" row is one line (21.5) */
      const nn = spec.data.validValues[0].rows![0];
      expect(nn[0]).toBe("New Name");
      expect(lineCount(nn[1], 90)).toBe(1);
      let nnRow = 0;
      vvs.eachRow((row, n) => { if (String(row.getCell(2).value) === "New Name") nnRow = n; });
      expect(vvs.getRow(nnRow).height).toBe(21.5);
      expect(lineCount("word ".repeat(60), 90)).toBeGreaterThan(1);
      const oneLine = [ins, fr, vvs].flatMap((ws) => {
        const out: number[] = [];
        ws.eachRow((row) => {
          const cells: string[] = [];
          row.eachCell((c) => { if (!c.isMerged && c.value != null && !c.font?.bold) cells.push(String(c.value)); });
          if (row.height && row.height >= 20 && cells.length === 2 && cells.every((t) => t.length <= 20)) out.push(row.height);
        });
        return out;
      });
      expect(oneLine.length).toBeGreaterThan(5);
      for (const h of oneLine) expect(h).toBeLessThanOrEqual(22);
      for (const ws of [ins, fr, vvs]) ws.eachRow((row) => row.eachCell((c) => {
        if (c.value != null && row.number > 4) expect(c.alignment?.vertical, `${ws.name} ${c.address}`).toBe("middle");
      }));
      expect(ins.getRow(7).height).toBeGreaterThanOrEqual(20);
      /* Addendum 2: identical heading band on all four tabs, aligned title block, one spacer */
      const sheets = [de, ins, fr, vvs];
      const lastCols = [headers.length, 3, 6, 3];
      sheets.forEach((ws, k) => {
        const a1 = ws.getCell("A1");
        expect(String(a1.value)).toBe(`Omne  ·  ${spec.entity} Import Template  ·  ${ws.name}`);
        expect(String(a1.value)).not.toContain(spec.columns[0].label);
        expect(ws.getRow(1).height).toBe(32);
        expect(a1.font).toMatchObject({ name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } });
        for (let c = 1; c <= lastCols[k]; c++) {
          expect((ws.getRow(1).getCell(c).fill as ExcelJS.FillPattern).fgColor?.argb, `${ws.name} ${c}`).toBe("FF1D4E89");
          expect(ws.getRow(1).getCell(c).border?.top).toBeUndefined();
        }
        if (k > 0) expect(ws.getRow(2).height).toBe(26);
      });
      expect(String(ins.getCell("B2").value)).toBe("Instructions");
      expect(String(ins.getCell("B3").value)).toBe(spec.data.moduleLine);
      expect(ins.getRow(5).height).toBe(18);
      expect(String(fr.getCell("A2").value)).toBe("Field Reference");
      expect(String(fr.getCell("A3").value)).toBe(spec.data.frSubtitle);
      expect(fr.getRow(4).height).toBe(18);
      expect(String(vvs.getCell("B2").value)).toBe("Valid Values & Reference");
      expect(vvs.getRow(4).height).toBe(18);
      expect(vvs.getRow(7).height).toBeGreaterThanOrEqual(20);

      const generated = await buildTemplateWorkbook(spec);
      const gde = generated.getWorksheet(DATA_ENTRY_SHEET)!;
      for (let r = 1; r <= 4; r++) expect(rowValues(gde, r, headers.length)).toEqual(rowValues(de, r, headers.length));
      for (const name of ["Instructions", "Field Reference", "Valid Values"]) {
        const a = shipped.getWorksheet(name)!;
        const b = generated.getWorksheet(name)!;
        expect(b.rowCount).toBe(a.rowCount);
        a.eachRow((row, n) => {
          expect(rowValues(b, n, 6)).toEqual(rowValues(a, n, 6));
        });
      }
    });

    it("row rhythm: no explicit height below 15, every spacer row exactly 18, never two spacers in a row", async () => {
      const wb = await buildTemplateWorkbook(spec);
      for (const ws of wb.worksheets) {
        const last = ws.rowCount;
        for (let n = 1; n <= last; n++) {
          const h = ws.getRow(n).height;
          if (h !== undefined) expect(h, `${ws.name} row ${n}`).toBeGreaterThanOrEqual(15);
        }
        if (ws.name === DATA_ENTRY_SHEET) continue;
        const empty = (n: number) => {
          const row = ws.getRow(n);
          for (let c = 1; c <= Math.max(ws.columnCount, 6); c++) if (row.getCell(c).value != null && row.getCell(c).value !== "") return false;
          return true;
        };
        expect(empty(2), `${ws.name} spacer under band`).toBe(false);
        for (let n = 2; n <= last; n++) {
          if (!empty(n)) continue;
          expect(ws.getRow(n).height, `${ws.name} spacer row ${n}`).toBe(18);
          expect(empty(n + 1) && n + 1 <= last, `${ws.name} double spacer at ${n}`).toBe(false);
        }
      }
    });

    it("the shipped files parse to the two example rows with zero errors", async () => {
      const csv = parseGrid(spec, parseCSV(fs.readFileSync(csvPath, "utf8")));
      expect(csv.rows).toHaveLength(2);
      expect(csv.matchedFieldCount).toBe(spec.columns.length);
      const xlsxBuf = fs.readFileSync(xlsxPath);
      const xlsx = parseGrid(spec, await xlsxBufferToGrid(xlsxBuf.buffer.slice(xlsxBuf.byteOffset, xlsxBuf.byteOffset + xlsxBuf.byteLength) as ArrayBuffer));
      expect(xlsx.rows).toEqual(csv.rows);
      const ctx = {
        groups: new Set(["tier 1 automotive oems", "powertrain components", "nordic countries"]),
        partners: new Set(["toyota international", "ntn corporation"]),
        contacts: new Set(["issac archer", "braelyn lowe"]),
      };
      expect(validateRows(spec, csv.rows, ctx).errorRowCount).toBe(0);
    });

    it("guide txt: banner, dividers, QUICK START, 66-column wrap, matches the generator", () => {
      const text = fs.readFileSync(guidePath, "utf8");
      expect(text).toBe(buildGuideText(spec));
      const lines = text.split("\n");
      const bannerLine = "=".repeat(GUIDE_WIDTH);
      expect(lines[0]).toBe(bannerLine);
      expect(lines[1]).toBe(`Omne ${spec.entity} Import Guide`);
      expect(lines[3]).toBe(bannerLine);
      const divider = "-".repeat(GUIDE_WIDTH);
      const dividerCount = lines.filter((l) => l === divider).length;
      expect(dividerCount).toBeGreaterThanOrEqual(8);
      expect(dividerCount % 2).toBe(0);
      const titles = lines.filter((l, i) => lines[i - 1] === divider && lines[i + 1] === divider);
      expect(titles[0]).toBe("Quick Start");
      expect(titles).toContain("Field Reference");
      expect(titles).toContain("Valid Values");
      for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(GUIDE_WIDTH);
      expect(text).not.toContain("\r");
      expect(text).not.toContain("—");
      for (const c of spec.columns) expect(text).toContain(`${c.label}  `);
    });
  });
}
