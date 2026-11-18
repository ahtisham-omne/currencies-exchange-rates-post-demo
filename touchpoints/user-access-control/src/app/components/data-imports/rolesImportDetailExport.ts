/* Shared CSV + Excel generators for the Roles Import Detail page.
 *
 * Mirrors importDetailExport.ts (the Users module) one-to-one. Both the
 * header download dropdown and the selected-rows export route through this
 * module so the on-disk file has exactly one column layout, the one defined
 * by ROLES_IMPORT_RECORD_COLUMNS, regardless of which UI control triggered
 * the download. The Excel path mirrors the styling defaults already used by
 * lib/roles-export.ts (frozen header row, soft-blue header fill, auto-fit
 * column widths) so both exports feel native to the module. */

import {
  ROLES_IMPORT_RECORD_COLUMNS,
  type ImportedRoleRow,
  type RowFilter,
  DOWNLOAD_META,
  importNameToFilenameStem,
} from "./rolesImportRecords";

type ExportFormat = "csv" | "xlsx";

/* ─── Common column resolution ─── */

interface ResolvedColumn {
  key: keyof ImportedRoleRow | "_row" | "_outcome" | "_message";
  label: string;
}

/** Pulls the column set in display order: Row → the template columns →
 *  optional Result → optional Error Reason. The conditional columns mirror
 *  the Users module's rowsToCsv logic so a re-export of an old import file
 *  looks identical to what the page used to ship. */
function resolveColumns(filter: RowFilter): ResolvedColumn[] {
  const cols: ResolvedColumn[] = [
    { key: "_row", label: "Row" },
    ...ROLES_IMPORT_RECORD_COLUMNS.map((c) => ({ key: c.key, label: c.label })),
  ];
  if (filter === "all") cols.push({ key: "_outcome", label: "Result" });
  if (filter !== "imported") cols.push({ key: "_message", label: "Error Reason" });
  return cols;
}

function cellValue(row: ImportedRoleRow, key: ResolvedColumn["key"]): string {
  if (key === "_outcome") {
    /* Surface the outcome with the same label the on-screen chip shows so
     * an exported "Result" column matches what the user sees in the UI. */
    return row._outcome === "Created" ? "Imported" : row._outcome;
  }
  if (key === "_message") return row._message ?? "";
  const v = (row as unknown as Record<string, unknown>)[key];
  if (v === null || v === undefined) return "";
  return String(v);
}

/* ─── CSV ─── */

function csvEscape(value: string): string {
  if (value === "") return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function roleRowsToCsv(rows: ImportedRoleRow[], filter: RowFilter): string {
  const cols = resolveColumns(filter);
  const header = cols.map((c) => csvEscape(c.label)).join(",");
  const lines = [header];
  for (const r of rows) {
    const cells = cols.map((c) => csvEscape(cellValue(r, c.key)));
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

/* ─── Triggers ─── */

function triggerBlobDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  /* Slight delay before revoking so Safari has a chance to start the download. */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function triggerCsvDownload(filename: string, csv: string): void {
  /* UTF-8 BOM prepended so Excel-on-Windows decodes non-ASCII cleanly,
   * matches the convention from lib/roles-export.ts. */
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8" });
  triggerBlobDownload(filename, blob);
}

/* ─── Excel ─── */

async function roleRowsToXlsx(rows: ImportedRoleRow[], filter: RowFilter): Promise<Blob> {
  /* Dynamic import: keeps ~600 KB of ExcelJS out of the initial bundle.
   * Same pattern as lib/roles-export.ts. */
  const ExcelJSMod = await import("exceljs");
  const ExcelJS = ((ExcelJSMod as unknown as { default?: typeof ExcelJSMod }).default ?? ExcelJSMod) as typeof ExcelJSMod;

  const cols = resolveColumns(filter);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Imported Records", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = cols.map((c) => ({
    header: c.label,
    key: String(c.key),
    width: Math.min(Math.max(c.label.length + 4, 14), 32),
  }));

  /* Header styling: bold + light-blue fill + thin bottom border. Mirrors
   * lib/roles-export.ts exportRolesExcel so both exports read as part of
   * the same family. */
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FF1E40AF" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDBEAFE" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF93C5FD" } },
    };
  });
  headerRow.height = 22;

  const widths = cols.map((c) => c.label.length + 4);

  for (const row of rows) {
    const cells: Record<string, string | number> = {};
    cols.forEach((c, idx) => {
      const v = c.key === "_row" ? row._row : cellValue(row, c.key);
      cells[String(c.key)] = v as string | number;
      const len = String(v ?? "").length;
      if (len > widths[idx]) widths[idx] = len;
    });
    sheet.addRow(cells);
  }

  sheet.columns.forEach((col, idx) => {
    col.width = Math.min(Math.max(widths[idx] + 2, 12), 48);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function triggerXlsxDownload(filename: string, rows: ImportedRoleRow[], filter: RowFilter): Promise<void> {
  const blob = await roleRowsToXlsx(rows, filter);
  triggerBlobDownload(filename, blob);
}

/* ─── Public entry point ─── */

export interface ExportRolesImportRecordsParams {
  rows: ImportedRoleRow[];
  filter: RowFilter;
  format: ExportFormat;
  importName: string;
  /** Override the file-name stem (e.g. selected-rows uses "selected" suffix).
   *  Defaults to the filter's standard suffix from DOWNLOAD_META. */
  suffix?: string;
}

export async function exportRolesImportRecords({
  rows,
  filter,
  format,
  importName,
  suffix,
}: ExportRolesImportRecordsParams): Promise<void> {
  const stem = importNameToFilenameStem(importName);
  const finalSuffix = suffix ?? DOWNLOAD_META[filter].fileSuffix;
  const filename = `${stem}_${finalSuffix}.${format}`;
  if (format === "csv") {
    triggerCsvDownload(filename, roleRowsToCsv(rows, filter));
    return;
  }
  await triggerXlsxDownload(filename, rows, filter);
}
