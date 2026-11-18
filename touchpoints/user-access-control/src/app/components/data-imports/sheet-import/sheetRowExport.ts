/* Download the rows of a stored import, in template order, with the issue
 * message appended so a corrected file can go straight back through the
 * wizard: the parser has no column for the message, so it is ignored on
 * re-upload. */

import type { SheetImportSpec } from "./sheetSpec";
import { headerFor } from "./sheetSpec";
import type { SheetRow } from "./sheetRecords";

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function downloadSheetRows(
  spec: SheetImportSpec,
  rows: SheetRow[],
  stem: string,
  format: "csv" | "xlsx",
): Promise<void> {
  const headers = [...spec.columns.map(headerFor), "Result", "Message"];
  const body = rows.map((row) => [
    ...spec.columns.map((c) => (c.level === "record" && !row._isRecordRow ? "" : row.values[c.key] ?? "")),
    row._outcome ?? "",
    row.issues.map((i) => i.message).join(" "),
  ]);

  if (format === "csv") {
    const text = [headers, ...body].map((r) => r.map(csvCell).join(",")).join("\r\n");
    triggerDownload(new Blob([text], { type: "text/csv;charset=utf-8" }), `${stem}.csv`);
    return;
  }

  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Rows");
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  body.forEach((r) => ws.addRow(r));
  ws.columns.forEach((col, i) => { col.width = Math.min(42, Math.max(14, headers[i].length + 4)); });
  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${stem}.xlsx`,
  );
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
