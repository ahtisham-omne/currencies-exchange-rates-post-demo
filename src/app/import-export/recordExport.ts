/* Downloads from an import record (port of role-zen's importDetailExport.ts
 * + importTemplateExport.ts):
 *  - exportImportRecords: the on-screen layout (Row, data columns, Result,
 *    Error Reason) as CSV / XLSX, for all / imported / failed / selected rows;
 *  - exportFailedTemplateRows: the failed rows in the one-sheet "Data Entry"
 *    template layout (same header styling as the shipped workbook, built from
 *    spec.template) with an appended "Error Message" column, so the file can
 *    be fixed and uploaded straight back. */
import { DOWNLOAD_META, IMPORT_RECORD_COLUMNS, isImported, type ImportedItemRow, type RowFilter } from "./importHistory";
import { ITEMS_IMPORT_SPEC, type EntitySpec } from "./spec";
import { applyDataEntryGrid, applyHeadingBand, applyListValidations, DATA_ENTRY_ROW_HEIGHT, DATA_ENTRY_SHEET, DATA_ROWS, FROZEN_COLUMNS } from "./templateLayout.mjs";
import { importRowsDownloadName } from "./downloadName";

export type RecordExportFormat = "csv" | "xlsx";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(rows: string[][]): Blob {
  const text = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  return new Blob([BOM, text], { type: "text/csv;charset=utf-8" });
}

function colWidthFor(header: string, values: string[]): number {
  const longest = values.reduce((m, v) => Math.max(m, v.length), header.length);
  return Math.min(Math.max(longest + 2, 12), 48);
}

/* ─── Screen layout ─── */

export interface ExportImportRecordsArgs {
  rows: ImportedItemRow[];
  filter: RowFilter;
  format: RecordExportFormat;
  importName: string;
  /** Overrides DOWNLOAD_META[filter].fileSuffix (the selection toolbar passes "selected"). */
  suffix?: string;
  /** Live error messages by _row (take precedence over the stored _message). */
  messages?: Map<number, string>;
}

export async function exportImportRecords({ rows, filter, format, importName, suffix, messages }: ExportImportRecordsArgs): Promise<string> {
  const includeResult = filter === "all";
  const includeReason = filter !== "imported";
  const headers = ["Row", ...IMPORT_RECORD_COLUMNS.map((c) => c.label), ...(includeResult ? ["Result"] : []), ...(includeReason ? ["Error Reason"] : [])];
  const body = rows.map((r) => [
    String(r._row),
    ...IMPORT_RECORD_COLUMNS.map((c) => r[c.key] ?? ""),
    ...(includeResult ? [isImported(r._outcome) ? "Imported" : r._outcome] : []),
    ...(includeReason ? [messages?.get(r._row) ?? r._message ?? ""] : []),
  ]);
  const filename = importRowsDownloadName(ITEMS_IMPORT_SPEC.nouns.titlePlural, suffix ?? DOWNLOAD_META[filter].fileSuffix, format);

  if (format === "csv") {
    triggerDownload(filename, toCsv([headers, ...body]));
    return filename;
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Imported Records", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(headers);
  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FF1E40AF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF93C5FD" } } };
  });
  body.forEach((r) => ws.addRow(r));
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = colWidthFor(
      h,
      body.map((r) => r[i]),
    );
  });
  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(filename, new Blob([buffer], { type: XLSX_MIME }));
  return filename;
}

/* ─── Template layout (failed rows) ─── */

export interface ExportFailedTemplateRowsArgs {
  rows: ImportedItemRow[];
  /** Message per row, aligned with `rows`. */
  messages: string[];
  messageHeader?: string;
  format: RecordExportFormat;
  importName: string;
  suffix?: string;
  spec?: EntitySpec;
}

export async function exportFailedTemplateRows({
  rows,
  messages,
  messageHeader = "Error Message",
  format,
  importName,
  suffix = "failed",
  spec = ITEMS_IMPORT_SPEC,
}: ExportFailedTemplateRowsArgs): Promise<string> {
  const model = spec.template;
  const headers = [...model.headers, messageHeader];
  const body = rows.map((r, i) => [...model.columns.map((c) => r[c.key] ?? ""), messages[i] ?? ""]);
  const filename = importRowsDownloadName(spec.nouns.titlePlural, suffix, format);

  if (format === "csv") {
    triggerDownload(filename, toCsv([headers, ...body]));
    return filename;
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(DATA_ENTRY_SHEET, {
    properties: { defaultRowHeight: DATA_ENTRY_ROW_HEIGHT },
    views: [{ state: "frozen", xSplit: FROZEN_COLUMNS, ySplit: 2, showGridLines: false }],
  });
  const font = (o: Record<string, unknown>) => ({ name: "Arial", size: 10, ...o });
  const thin = { style: "thin" as const, color: { argb: "FFD8D6D1" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const hdrReq = {
    font: font({ bold: true, color: { argb: "FFFFFFFF" } }),
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFC0392B" } },
    border,
    alignment: { horizontal: "left" as const, vertical: "middle" as const, wrapText: true },
  };
  const hdrOpt = {
    ...hdrReq,
    font: font({ bold: true, color: { argb: "FF1A1A18" } }),
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE8E6E1" } },
  };
  model.columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width ?? Math.max(14, +(c.label.length * 0.95).toFixed(2));
  });
  ws.getColumn(headers.length).width = 60;
  applyHeadingBand(ws, model.title, DATA_ENTRY_SHEET, headers.length);
  ws.getRow(2).height = 30;
  headers.forEach((h, i) => {
    const cell = ws.getCell(2, i + 1);
    cell.value = h;
    const style = i < model.columns.length && model.columns[i].required ? hdrReq : hdrOpt;
    cell.font = style.font;
    cell.fill = style.fill;
    cell.border = style.border;
    cell.alignment = style.alignment;
  });
  body.forEach((r, ri) => {
    r.forEach((v, ci) => {
      const cell = ws.getCell(3 + ri, ci + 1);
      cell.value = v || null;
      cell.font = font({ color: { argb: "FF1A1A18" } });
      cell.border = border;
      cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
      if (ci < model.columns.length && model.columns[ci].text) cell.numFmt = "@";
    });
  });
  /* Below the failed rows, the same empty bordered grid as the shipped template. */
  applyDataEntryGrid(ws, [...model.columns, { required: false, text: false }], 3 + body.length, DATA_ROWS);
  /* Same dropdowns as the shipped template, over the failed rows and the empty grid. */
  applyListValidations(ws, model.columns, 3, DATA_ROWS);
  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(filename, new Blob([buffer], { type: XLSX_MIME }));
  return filename;
}
