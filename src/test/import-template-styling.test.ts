/* Guards the shared import-template styling standard (importTemplateStyle.ts)
 * on the shipped xlsx templates and on the in-app failed-rows downloads, so
 * the whole family keeps the bordered Data Entry grid and the reference-sheet
 * table layout. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { TEMPLATE_HEADERS, buildTemplateRecordsWorkbook } from "../app/components/data-imports/importTemplateExport";
import {
  ROLES_TEMPLATE_HEADERS,
  buildTemplateRecordsWorkbook as buildRolesWorkbook,
} from "../app/components/data-imports/rolesImportTemplateExport";
import { TPL } from "../app/components/data-imports/importTemplateStyle";

const TPL_DIR = path.resolve(__dirname, "../../public/templates");

async function load(rel: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(path.join(TPL_DIR, rel)) as unknown as ExcelJS.Buffer);
  return wb;
}

function expectThinBorder(cell: ExcelJS.Cell) {
  for (const side of ["top", "left", "bottom", "right"] as const) {
    expect(cell.border?.[side]?.style, `${cell.address} ${side}`).toBe("thin");
    expect(cell.border?.[side]?.color?.argb?.slice(-6)).toBe("D8D6D1");
  }
}

function lastHeaderCol(ws: ExcelJS.Worksheet) {
  let c = 1;
  while (ws.getCell(2, c + 1).value) c++;
  return c;
}

function widths(ws: ExcelJS.Worksheet, n: number) {
  return Array.from({ length: n }, (_, i) => ws.getColumn(i + 1).width);
}

const FOUR_SHEET = ["OMNE_Users_Import_Template.xlsx", "OMNE_Roles_Import_Template.xlsx"];
const ONE_SHEET = [
  "quotes/OMNE_Quotes_Import_Template.xlsx",
  "sales-orders/OMNE_Sales_Orders_Import_Template.xlsx",
];

describe("Data Entry grid on every shipped template", () => {
  for (const file of [...FOUR_SHEET, ...ONE_SHEET]) {
    it(`${file}: rows 5 and 600 are bordered on the last column, required columns tinted`, async () => {
      const ws = (await load(file)).getWorksheet("Data Entry")!;
      const last = lastHeaderCol(ws);
      expectThinBorder(ws.getCell(5, last));
      expectThinBorder(ws.getCell(600, last));
      expectThinBorder(ws.getCell(600, 1));
      /* Users rows autofit (addendum 3); the others keep an explicit 20. */
      expect(ws.getRow(600).height).toBe(file.startsWith("OMNE_Users") ? undefined : 20);
      expect(String(ws.getCell(2, 1).value)).toMatch(/\s\*$/);
      /* The Users template dropped the required tint (addendum 2). */
      const tint = file.startsWith("OMNE_Users") ? TPL.white : TPL.requiredEntryTint;
      expect(ws.getCell(600, 1).fill).toMatchObject({ fgColor: { argb: tint } });
      expectThinBorder(ws.getCell(2, last));
      expectThinBorder(ws.getCell(3, last));
      expect(ws.getCell(601, 1).border).toBeUndefined();
    });
  }
});

describe("Reference sheets of the Users and Roles templates", () => {
  for (const file of FOUR_SHEET) {
    it(`${file}: widths, bordered wrapped cells, explicit heights, no autoFilter`, async () => {
      const wb = await load(file);
      const ins = wb.getWorksheet("Instructions")!;
      expect(widths(ins, 3).slice(1)).toEqual([30, 100]);
      const fr = wb.getWorksheet("Field Reference")!;
      expect(widths(fr, 6)).toEqual([26, 11, 56, 22, 30, 28]);
      expect(fr.autoFilter).toBeUndefined();
      const vv = wb.getWorksheet("Valid Values")!;
      expect(widths(vv, 3).slice(1)).toEqual([30, 90]);

      /* A bordered, wrapped cell in each reference sheet. */
      for (const [ws, addr] of [[ins, "C10"], [fr, "C5"], [vv, "B6"]] as const) {
        const cell = ws.getCell(addr);
        expectThinBorder(cell);
        expect(cell.alignment?.wrapText, `${ws.name} ${addr}`).toBe(true);
      }

      /* Every wrapped row carries an explicit, padded height. */
      let tallest = 0;
      fr.eachRow((row, n) => {
        if (n > 3 && row.getCell(3).value) {
          expect(row.height, `Field Reference row ${n}`).toBeGreaterThanOrEqual(20);
          tallest = Math.max(tallest, row.height);
        }
      });
      expect(tallest).toBeGreaterThan(20); // a multi-line row
    });
  }

  it("Users Field Reference compare table uses merged B:C and D:F", async () => {
    const fr = (await load("OMNE_Users_Import_Template.xlsx")).getWorksheet("Field Reference")!;
    const merges = fr.model.merges;
    expect(merges).toContain("B6:C6");
    expect(merges).toContain("D6:F6");
    expect(merges).toContain("B7:C7");
    expect(merges).toContain("D7:F7");
    expect(fr.getCell("B7").value).toBe("Creates a new user in the Draft state.");
    expect(String(fr.getCell("D7").value)).toMatch(/^Updates the existing user/);
  });
});

describe("In-app failed-rows downloads match the shipped Data Entry sheet", () => {
  const cases = [
    ["OMNE_Users_Import_Template.xlsx", TEMPLATE_HEADERS, buildTemplateRecordsWorkbook],
    ["OMNE_Roles_Import_Template.xlsx", ROLES_TEMPLATE_HEADERS, buildRolesWorkbook],
  ] as const;
  for (const [file, headers, build] of cases) {
    it(`${file}: same banner, header styling, widths and grid`, async () => {
      const shipped = (await load(file)).getWorksheet("Data Entry")!;
      const all = [...headers, "Error Message"];
      const out = (await build(all, [all.map((_, i) => (i === 0 ? "Row value" : ""))])).getWorksheet("Data Entry")!;
      expect(out.getCell(1, 1).value).toBe(shipped.getCell(1, 1).value);
      expect(out.getCell(1, 1).font).toMatchObject({ bold: true, size: shipped.getCell(1, 1).font?.size });
      expect(out.getCell(600, 1).fill).toMatchObject({ fgColor: { argb: (shipped.getCell(600, 1).fill as ExcelJS.FillPattern).fgColor!.argb } });
      headers.forEach((h, i) => {
        const a = out.getCell(2, i + 1), b = shipped.getCell(2, i + 1);
        expect(a.value).toBe(b.value);
        expect(a.fill).toMatchObject({ fgColor: { argb: expect.stringMatching(new RegExp(`${(b.fill as ExcelJS.FillPattern).fgColor!.argb!.slice(-6)}$`)) } });
        expect(a.font?.color?.argb?.slice(-6)).toBe(b.font?.color?.argb?.slice(-6));
        expect(out.getColumn(i + 1).width).toBe(shipped.getColumn(i + 1).width);
        expect(out.getCell(600, i + 1).numFmt ?? "General").toBe(shipped.getCell(600, i + 1).numFmt ?? "General");
      });
      expect(out.getRow(2).height).toBe(30);
      expect(out.getCell(3, 1).value).toBe("Row value");
      expectThinBorder(out.getCell(3, all.length));
      expectThinBorder(out.getCell(600, all.length));
      expect(out.getRow(600).height).toBe(shipped.getRow(600).height);
      expect(out.getCell(600, 1).alignment).toEqual(shipped.getCell(600, 1).alignment);
      if (file.startsWith("OMNE_Users")) expect(out.views[0]).toMatchObject({ ySplit: (shipped.views[0] as { ySplit?: number }).ySplit });
    });
  }
});

describe("Users template heading band (addendum 2)", () => {
  it("row 1 is the same brand band on all four tabs, titles and spacer line up", async () => {
    const wb = await load("OMNE_Users_Import_Template.xlsx");
    const specs = [
      ["Data Entry", 1, 28, null],
      ["Instructions", 2, 3, "Instructions"],
      ["Field Reference", 1, 6, "Field Reference"],
      ["Valid Values", 2, 3, "Valid Values & Reference"],
    ] as const;
    for (const [name, col, lastCol, title] of specs) {
      const ws = wb.getWorksheet(name)!;
      expect(ws.getCell("A1").value).toBe(`OMNE  ·  Users Import Template  ·  ${name}`);
      expect(ws.getRow(1).height).toBe(32);
      expect(ws.getCell(1, lastCol).fill).toMatchObject({ fgColor: { argb: TPL.compareHeaderFill } });
      expect(ws.getCell(1, lastCol).value).toBeNull();
      expect(ws.getCell("A1").font).toMatchObject({ bold: true, size: 12, color: { argb: TPL.white } });
      if (!title) continue;
      expect(ws.getCell(2, col).value).toBe(title);
      expect(ws.getCell(2, col).font).toMatchObject({ bold: true, size: 15 });
      const spacer = name === "Instructions" ? 5 : 4;
      expect(ws.getRow(spacer).height).toBe(18);
      expect(ws.getCell(spacer + 1, col).fill).toMatchObject({ fgColor: { argb: TPL.sectionFill } });
    }
    expect(wb.getWorksheet("Instructions")!.getCell("B4").value).toBe("28 columns  ·  3 required, 25 optional");
  });
});

describe("Users Data Entry cell structure (addendum 3)", () => {
  it("wraps inside the cell, autofits rows 3 to 600, freezes under the header row", async () => {
    const ws = (await load("OMNE_Users_Import_Template.xlsx")).getWorksheet("Data Entry")!;
    expect(ws.views[0]).toMatchObject({ state: "frozen", xSplit: 3, ySplit: 2, topLeftCell: "D3" });
    expect(ws.properties.defaultRowHeight).toBe(20);
    expect(ws.getRow(1).height).toBe(32);
    expect(ws.getRow(2).height).toBe(30);
    for (const addr of ["A3", "C5", "AB600"]) {
      expect(ws.getCell(addr).alignment, addr).toMatchObject({ wrapText: true, vertical: "top", horizontal: "left" });
    }
    for (let r = 3; r <= 600; r++) expect(ws.getRow(r).height, `row ${r}`).toBeUndefined();
    expectThinBorder(ws.getCell("C4"));
  });
});

describe("Users template row rhythm (addendum 4)", () => {
  it("no explicit row height below 15, every spacer row is 18, never two spacers in a row", async () => {
    const wb = await load("OMNE_Users_Import_Template.xlsx");
    const all = [...headersFor(wb), "Error Message"];
    const built = await buildTemplateRecordsWorkbook(all, [all.map(() => "x")]);
    for (const book of [wb, built]) {
      for (const ws of book.worksheets) {
        const lastCol = ws.name === "Data Entry" ? all.length : ws.name === "Field Reference" ? 6 : 3;
        let prevBlank = false;
        for (let r = 1; r <= ws.rowCount; r++) {
          const row = ws.getRow(r);
          if (row.height !== undefined) expect(row.height, `${ws.name} row ${r}`).toBeGreaterThanOrEqual(15);
          if (ws.name === "Data Entry") continue;
          let blank = true;
          for (let c = 1; c <= lastCol; c++) if (ws.getCell(r, c).value) blank = false;
          if (blank) {
            expect(row.height, `${ws.name} spacer row ${r}`).toBe(18);
            expect(prevBlank, `${ws.name} double spacer at row ${r}`).toBe(false);
            expect(r, `${ws.name} spacer under the band`).toBeGreaterThan(2);
          } else {
            expect(row.height, `${ws.name} content row ${r}`).toBeGreaterThanOrEqual(15);
          }
          prevBlank = blank;
        }
      }
    }
  });
});

function headersFor(wb: ExcelJS.Workbook): string[] {
  const ws = wb.getWorksheet("Data Entry")!;
  const out: string[] = [];
  for (let c = 1; ws.getCell(2, c).value; c++) out.push(String(ws.getCell(2, c).value));
  return out;
}

describe("Users reference tabs as Valid Values style cards (addendum 5)", () => {
  it("dark headers everywhere, 'All columns' title bar, cells centred, one-line rows at most 22", async () => {
    const wb = await load("OMNE_Users_Import_Template.xlsx");
    const fr = wb.getWorksheet("Field Reference")!;
    const find = (ws: ExcelJS.Worksheet, col: number, value: string) => {
      for (let r = 1; r <= ws.rowCount; r++) if (ws.getCell(r, col).value === value) return r;
      return -1;
    };
    /* Compare header is the same 3A3A36 as every table header now. */
    const compare = find(fr, 2, "For a new user (email not in Omne)");
    expect(fr.getCell(compare, 2).fill).toMatchObject({ fgColor: { argb: TPL.headerFill } });
    const all = find(fr, 1, "All columns");
    expect(fr.model.merges).toContain(`A${all}:F${all}`);
    expect(fr.getCell(all, 1).fill).toMatchObject({ fgColor: { argb: TPL.sectionFill } });
    expect(fr.getCell(all + 1, 1).value).toBe("Field");
    expect(fr.getCell(all + 2, 2).font).toMatchObject({ bold: true, color: { argb: TPL.requiredText } });

    const ins = wb.getWorksheet("Instructions")!;
    for (const [left, right] of [["Step", "What to do"], ["Case", "What happens"], ["Topic", "Details"]]) {
      const r = find(ins, 2, left);
      expect(r, left).toBeGreaterThan(0);
      expect(ins.getCell(r, 3).value).toBe(right);
      expect(ins.getCell(r, 2).fill).toMatchObject({ fgColor: { argb: TPL.headerFill } });
    }
    expect(ins.getCell(find(ins, 2, "Step 1"), 2).fill).toMatchObject({ fgColor: { argb: TPL.labelFill } });

    const vv = wb.getWorksheet("Valid Values")!;
    for (const [ws, addr] of [[ins, "C8"], [fr, "C8"], [vv, "C7"]] as const) {
      expect(ws.getCell(addr).alignment, `${ws.name} ${addr}`).toMatchObject({ vertical: "middle", horizontal: "left", wrapText: true, indent: 1 });
    }
    /* Rows are sized with textMeasure.mjs (Excel's own wrap, validated against
     * AutoFit): a one-line body row comes out at 21.5, never two lines tall. */
    expect(ins.getRow(find(ins, 2, "Step 1")).height).toBeLessThanOrEqual(22);
    expect(fr.getRow(find(fr, 1, "Middle Name")).height).toBeLessThanOrEqual(22);
    expect(vv.getRow(find(vv, 2, "Active")).height).toBeLessThanOrEqual(22);
    expect(fr.getRow(all + 5).height).toBeGreaterThan(22); // License field row, three lines
  });
});
