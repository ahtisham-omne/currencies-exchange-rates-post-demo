/* The failed-rows Data Entry export carries the same fillable grid as the
 * template's empty rows (2026-09-30 table standard). */
import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { ALL_IMPORT_SPECS } from "../spec";
import { DATA_ROWS } from "../templateLayout.mjs";
import type { ImportedRecord } from "../importHistory";

const captured: Blob[] = [];
vi.mock("../download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../download")>()),
  triggerBlobDownload: (_name: string, blob: Blob) => {
    captured.push(blob);
  },
}));

const { exportTemplateRecords } = await import("../recordExport");

for (const spec of ALL_IMPORT_SPECS) {
  describe(`${spec.entity} failed-rows export`, () => {
    it("Data Entry grid: thin D8D6D1 borders from row 3 to row 600 on every column incl. Error Message", async () => {
      captured.length = 0;
      const row = { _row: 5, _outcome: "error", _message: "Missing name" } as unknown as ImportedRecord;
      await exportTemplateRecords({ spec, rows: [row], messages: ["Missing name"], format: "xlsx", importName: "Test import", suffix: "failed" });
      expect(captured).toHaveLength(1);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await captured[0].arrayBuffer());
      const ws = wb.getWorksheet("Data Entry")!;
      const last = spec.columns.length + 1;
      expect(String(ws.getRow(2).getCell(last).value)).toBe("Error Message");
      expect(String(ws.getRow(3).getCell(last).value)).toBe("Missing name");
      for (const n of [3, 4, DATA_ROWS]) {
        for (const col of [1, last]) {
          const cell = ws.getRow(n).getCell(col);
          for (const side of ["left", "right", "top", "bottom"] as const) {
            expect(cell.border?.[side]?.style, `${cell.address} ${side}`).toBe("thin");
            expect(cell.border?.[side]?.color?.argb).toBe("FFD8D6D1");
          }
        }
        expect(ws.getRow(n).height).toBeUndefined();
        expect(ws.getRow(n).getCell(last).alignment).toMatchObject({ wrapText: true, vertical: "top", horizontal: "left" });
      }
      const reqIdx = spec.columns.findIndex((c) => c.required) + 1;
      expect((ws.getRow(10).getCell(reqIdx).fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFFFFFFF"); // no required tint
      expect(String(ws.getCell("A1").value)).toBe(`Omne  ·  ${spec.entity} Import Template  ·  Data Entry`);
      expect(ws.getRow(1).height).toBe(32);
      expect(ws.properties.defaultRowHeight).toBe(20);
      expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 2 });
      expect((ws.getRow(1).getCell(last).fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FF1D4E89");
    });
  });
}
