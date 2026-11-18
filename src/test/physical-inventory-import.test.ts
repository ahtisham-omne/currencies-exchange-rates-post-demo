/* Physical Inventory on Data Imports: the shipped templates are what the
 * generator builds, follow the house template standard, and the Part Number
 * rule sits in front of Physical Inventory's own rules. */

import { readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { MODULE_IMPORT_DEFS } from "@/app/components/data-imports/modules/moduleImportDefs";
import { PI_TABS, piTemplateCsv, piTemplateFiles, piTemplateHeaders } from "@/app/components/data-imports/modules/physical-inventory/piModule";
import { TEMPLATE_ONLY_MODULES } from "@/app/components/data-imports/templateOnlyModules";

const DIR = path.resolve(__dirname, "../../public/templates");

describe.each(PI_TABS)("Physical Inventory template: $label", (tab) => {
  const files = piTemplateFiles(tab.mode);

  it("CSV and guide ship next to the xlsx, the CSV exactly as generated", () => {
    expect(readFileSync(path.join(DIR, files.templateCsvFilename), "utf8")).toBe(piTemplateCsv(tab.mode));
    expect(readFileSync(path.join(DIR, files.guideFilename), "utf8").length).toBeGreaterThan(500);
  });

  it("xlsx has the four tabs, the band, the header row and the freeze under it", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(DIR, files.templateXlsxFilename));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Data Entry", "Instructions", "Field Reference", "Valid Values"]);
    for (const ws of wb.worksheets) expect(String(ws.getCell("A1").value ?? ws.getCell("B1").value)).toContain("OMNE");
    const de = wb.getWorksheet("Data Entry")!;
    const headers = (de.getRow(2).values as unknown[]).slice(1).map((v) => String(v ?? ""));
    expect(headers).toEqual(piTemplateHeaders(tab.mode));
    expect(headers[0]).toBe("Part Number *");
    expect((de.views[0] as { ySplit?: number }).ySplit).toBe(2);
    expect(de.getCell(600, 1).border?.bottom).toBeTruthy();
    for (const ws of wb.worksheets) {
      ws.eachRow({ includeEmpty: false }, (row, n) => {
        if (ws.name === "Data Entry" && n > 2) return;
        if (row.height) expect(row.height, `${ws.name} row ${n}`).toBeGreaterThanOrEqual(15);
      });
    }
  });

  it("the wizard reads the shipped header row", () => {
    expect(TEMPLATE_ONLY_MODULES[tab.slug].headers).toEqual(piTemplateHeaders(tab.mode));
  });
});

describe("Part Number rule", () => {
  it("names a blank, an unknown and a wrong-control-type item", () => {
    const def = MODULE_IMPORT_DEFS["physical-inventory-serialized"];
    const base = { serialNumber: "SN-7001", price: "24.50", location: "Zone A-01", reason: "" };
    const res = def.validate(
      [{ ...base, partNumber: "" }, { ...base, serialNumber: "SN-7002", partNumber: "P-00000" }, { ...base, serialNumber: "SN-7003", partNumber: "P-00988" }, { ...base, serialNumber: "SN-7004", partNumber: "p-00891" }],
      def.buildContext(),
    );
    expect(res.rows.map((r) => r.issues.map((x) => x.code))).toEqual([["REQUIRED_EMPTY"], ["ITEM_NOT_FOUND"], ["ITEM_CONTROL_TYPE"], []]);
    expect(res.rows[2].issues[0].message).toContain("Non-Serialized item");
  });
});
