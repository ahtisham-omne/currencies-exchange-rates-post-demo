/* Downloads from a module's import record page.
 *
 * - Failed rows: the module's shipped template layout (Data Entry sheet,
 *   heading band, header row, empty bordered grid, the template's column
 *   widths and frozen columns) with an "Error Message" column appended, built
 *   by the same buildTemplateRecordsWorkbook the Users download uses.
 * - Selected rows: the Users "Imported Records" export (importDetailExport.ts)
 *   with the module's columns: Row, the columns, Result, Error Reason. */

import { buildTemplateRecordsWorkbook, csvEscape, triggerBlobDownload } from "../importTemplateExport";
import { DOWNLOAD_META, importNameToFilenameStem, type RowFilter } from "../importRecords";
import type { ModuleImportDef } from "./moduleImportDefs";
import { recordValues, type ModuleRecord } from "./moduleImportStore";

type ExportFormat = "csv" | "xlsx";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function csvBlob(lines: string[]): Blob {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  return new Blob([bom, lines.join("\n")], { type: "text/csv;charset=utf-8" });
}

export async function exportModuleTemplateRecords({
  def,
  rows,
  messages,
  format,
  importName,
  suffix,
}: {
  def: ModuleImportDef;
  rows: ModuleRecord[];
  /** `_row` to the message the page shows for that row. */
  messages: Map<number, string>;
  format: ExportFormat;
  importName: string;
  suffix: string;
}): Promise<void> {
  const filename = `${importNameToFilenameStem(importName)}_${suffix}.${format}`;
  const headers = [...def.templateHeaders, "Error Message"];
  const dataRows = rows.map((r) => {
    const values = recordValues(def, r);
    return [...def.columns.map((c) => values[c.key] ?? ""), messages.get(r._row) ?? ""];
  });

  if (format === "csv") {
    const lines = [headers.map(csvEscape).join(",")];
    for (const row of dataRows) lines.push(row.map(csvEscape).join(","));
    triggerBlobDownload(filename, csvBlob(lines));
    return;
  }

  const workbook = await buildTemplateRecordsWorkbook(headers, dataRows, {
    banner: def.templateBanner,
    columnWidths: def.columns.map((c) => c.templateWidth),
    xSplit: def.templateXSplit,
    textFormatHeaders: new Set(def.columns.filter((c) => c.textFormat).map((c) => c.label)),
  });
  const buffer = await workbook.xlsx.writeBuffer();
  triggerBlobDownload(filename, new Blob([buffer], { type: XLSX_TYPE }));
}

interface ResolvedColumn {
  key: string;
  label: string;
}

function resolveColumns(def: ModuleImportDef, filter: RowFilter): ResolvedColumn[] {
  const cols: ResolvedColumn[] = [{ key: "_row", label: "Row" }, ...def.columns.map((c) => ({ key: c.key, label: c.label }))];
  if (filter === "all") cols.push({ key: "_outcome", label: "Result" });
  if (filter !== "imported") cols.push({ key: "_message", label: "Error Reason" });
  return cols;
}

function cellValue(row: ModuleRecord, key: string): string {
  if (key === "_outcome") return row._outcome === "Created" ? "Imported" : row._outcome;
  if (key === "_message") return row._message ?? "";
  const v = row[key];
  return v === null || v === undefined ? "" : String(v);
}

export async function exportModuleRecords({
  def,
  rows,
  filter,
  format,
  importName,
  suffix,
}: {
  def: ModuleImportDef;
  rows: ModuleRecord[];
  filter: RowFilter;
  format: ExportFormat;
  importName: string;
  suffix?: string;
}): Promise<void> {
  const filename = `${importNameToFilenameStem(importName)}_${suffix ?? DOWNLOAD_META[filter].fileSuffix}.${format}`;
  const cols = resolveColumns(def, filter);

  if (format === "csv") {
    const lines = [cols.map((c) => csvEscape(c.label)).join(",")];
    for (const r of rows) lines.push(cols.map((c) => csvEscape(cellValue(r, c.key))).join(","));
    triggerBlobDownload(filename, csvBlob(lines));
    return;
  }

  /* Same sheet styling as importDetailExport.ts rowsToXlsx. */
  const ExcelJSMod = await import("exceljs");
  const ExcelJS = ((ExcelJSMod as unknown as { default?: typeof ExcelJSMod }).default ?? ExcelJSMod) as typeof ExcelJSMod;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Imported Records", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = cols.map((c) => ({ header: c.label, key: c.key, width: Math.min(Math.max(c.label.length + 4, 14), 32) }));
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FF1E40AF" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF93C5FD" } } };
  });
  headerRow.height = 22;
  const widths = cols.map((c) => c.label.length + 4);
  for (const row of rows) {
    const cells: Record<string, string | number> = {};
    cols.forEach((c, idx) => {
      const v = c.key === "_row" ? row._row : cellValue(row, c.key);
      cells[c.key] = v;
      const len = String(v ?? "").length;
      if (len > widths[idx]) widths[idx] = len;
    });
    sheet.addRow(cells);
  }
  sheet.columns.forEach((col, idx) => {
    col.width = Math.min(Math.max(widths[idx] + 2, 12), 48);
  });
  const buffer = await workbook.xlsx.writeBuffer();
  triggerBlobDownload(filename, new Blob([buffer], { type: XLSX_TYPE }));
}
