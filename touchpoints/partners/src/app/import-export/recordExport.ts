/* Downloads for the Import Record page: the screen layout (Row, columns,
 * Result, Error Reason) as CSV / XLSX, and the template-fidelity failed-rows
 * export (one-sheet Data Entry layout + an appended "Error Message" column,
 * reusing templateLayout.mjs styles). */

import type { EntitySpec } from "./spec";
import { loadExcelJS, triggerBlobDownload } from "./download";
import { escapeCsvCell } from "./export";
import { importNameToFilenameStem, isImported, type ImportedRecord, type RowFilter } from "./importHistory";
import { templateHeaders } from "./templateWorkbook";
import { applyDataEntryGrid, applyHeadingBand, BAND_TEXT, colLetter, DATA_ROWS, ENTRY_ROW_HEIGHT, TEMPLATE_STYLES } from "./templateLayout.mjs";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function csvBlob(lines: string[][]): Blob {
  const csv = lines.map((r) => r.map(escapeCsvCell).join(",")).join("\n");
  return new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], { type: "text/csv;charset=utf-8" });
}

/** Screen-layout export. Result only on "all"; Error Reason unless "imported". */
export async function exportImportRecords(args: { spec: EntitySpec<unknown>; rows: ImportedRecord[]; filter: RowFilter; format: "csv" | "xlsx"; importName: string; suffix?: string }): Promise<string> {
  const { spec, rows, filter, format, importName } = args;
  const suffix = args.suffix ?? filter;
  const filename = `${importNameToFilenameStem(importName)}_${suffix}.${format}`;
  const headers = ["Row", ...spec.columns.map((c) => c.label)];
  if (filter === "all") headers.push("Result");
  if (filter !== "imported") headers.push("Error Reason");
  const body = rows.map((r) => {
    const cells: string[] = [String(r._row), ...spec.columns.map((c) => String(r[c.key] ?? ""))];
    if (filter === "all") cells.push(isImported(r._outcome) ? "Imported" : r._outcome);
    if (filter !== "imported") cells.push(r._message ?? "");
    return cells;
  });
  if (format === "csv") {
    triggerBlobDownload(filename, csvBlob([headers, ...body]));
    return filename;
  }
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Imported Records", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = headers.map((h, i) => ({ header: h, key: `c${i}`, width: Math.min(Math.max(h.length + 2, 12), 48) }));
  const hdr = ws.getRow(1);
  hdr.font = { bold: true, color: { argb: "FF1E40AF" } };
  hdr.height = 22;
  hdr.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF93C5FD" } } };
  });
  const widths = headers.map((h) => h.length + 2);
  for (const row of body) {
    ws.addRow(row);
    row.forEach((v, i) => {
      if (v.length > widths[i]) widths[i] = v.length;
    });
  }
  ws.columns.forEach((col, i) => {
    col.width = Math.min(Math.max(widths[i] + 2, 12), 48);
  });
  const buf = await wb.xlsx.writeBuffer();
  triggerBlobDownload(filename, new Blob([buf as unknown as ArrayBuffer], { type: XLSX_MIME }));
  return filename;
}

/** Template-fidelity export: the Data Entry header row plus "Error Message". */
export async function exportTemplateRecords(args: { spec: EntitySpec<unknown>; rows: ImportedRecord[]; messages: string[]; messageHeader?: string; format: "csv" | "xlsx"; importName: string; suffix: string }): Promise<string> {
  const { spec, rows, messages, format, importName, suffix } = args;
  const messageHeader = args.messageHeader ?? "Error Message";
  const filename = `${importNameToFilenameStem(importName)}_${suffix}.${format}`;
  const headers = [...templateHeaders(spec), messageHeader];
  const body = rows.map((r, i) => [...spec.columns.map((c) => String(r[c.key] ?? "")), messages[i] ?? r._message ?? ""]);
  if (format === "csv") {
    triggerBlobDownload(filename, csvBlob([headers, ...body]));
    return filename;
  }
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const S = TEMPLATE_STYLES as Record<string, Record<string, unknown>>;
  const freeze = spec.data.freezeColumns ?? spec.columns.filter((c) => c.required).length;
  const ws = wb.addWorksheet("Data Entry", { views: [{ state: "frozen", xSplit: freeze, ySplit: 2, topLeftCell: `${colLetter(freeze + 1)}3`, showGridLines: false }] });
  headers.forEach((h, i) => {
    const c = spec.columns[i];
    ws.getColumn(i + 1).width = c ? (c.width ?? Math.max(14, +(c.label.length * 0.95).toFixed(2))) : 48;
  });
  applyHeadingBand(ws, BAND_TEXT(spec.entity, "Data Entry"), headers.length);
  ws.properties.defaultRowHeight = ENTRY_ROW_HEIGHT;
  ws.getRow(2).height = 30;
  headers.forEach((h, i) => {
    const cell = ws.getCell(2, i + 1);
    cell.value = h;
    const col = spec.columns[i];
    Object.assign(cell, col ? (col.required ? S.hdrReq : S.hdrOpt) : S.hdrReq);
  });
  /* Same fillable grid as the template's empty rows, through row 600 */
  const gridCols = [...spec.columns.map((c) => ({ required: c.required, text: c.text })), { required: false, text: false }];
  applyDataEntryGrid(ws, gridCols, 3, Math.max(DATA_ROWS, 2 + body.length));
  body.forEach((row, r) => {
    row.forEach((v, i) => {
      ws.getCell(3 + r, i + 1).value = v || null;
    });
  });
  const buf = await wb.xlsx.writeBuffer();
  triggerBlobDownload(filename, new Blob([buf as unknown as ArrayBuffer], { type: XLSX_MIME }));
  return filename;
}
