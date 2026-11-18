/* Template-fidelity export for the Roles Import Detail page's error /
 * warning downloads.
 *
 * Mirrors importTemplateExport.ts (the Users module) one-to-one. The
 * downloaded file reproduces the Roles import template exactly, same 5
 * columns, same headers (including the required-field asterisks), same
 * order, and (for Excel) the same "Data Entry" sheet layout with the title
 * banner above the header row, so a user can fix the rows and re-upload
 * the very same file without reformatting. One extra column is appended at
 * the far right ("Error Message" / "Warning Message") carrying, word for
 * word, the message Omne shows for that row; the import parser has no alias
 * for it, so it is ignored on re-upload. */

import type { ImportedRoleRow } from "./rolesImportRecords";
import { importNameToFilenameStem } from "./rolesImportRecords";
import type { Workbook } from "exceljs";
import {
  DATA_ENTRY_LAST_ROW,
  applyDataEntryGrid,
  styleDataEntryBanner,
  styleDataEntryHeader,
} from "./importTemplateStyle";

/* Exact header row from public/templates/OMNE_Roles_Import_Template.csv,
 * keep byte-for-byte in sync with the template files. */
export const ROLES_TEMPLATE_HEADERS: readonly string[] = [
  "Role Name *",
  "Description",
  "Role Owner",
  "Assigned Users",
];

/* Title banner the template's Data Entry sheet carries in row 1. */
const TEMPLATE_SHEET_NAME = "Data Entry";
const TEMPLATE_BANNER = "OMNE  ·  Roles Import Template";

/** Map a stored import record onto the template's 4 columns, in order.
 *  All fields are 1:1 with the template, so values pass through verbatim. */
function toTemplateValues(r: ImportedRoleRow): string[] {
  return [
    r.roleName,
    r.description,
    r.roleOwner,
    r.assignedUsers,
  ];
}

/* Column widths of the shipped template's Data Entry sheet, in order, so a
 * downloaded file lines up with the template it came from. */
export const TEMPLATE_COLUMN_WIDTHS: readonly number[] = [18, 40, 22, 24];
const MESSAGE_COLUMN_WIDTH = 48;

const TEXT_FORMAT_HEADERS: ReadonlySet<string> = new Set();

/** Build the "Data Entry" workbook: the title banner in row 1, the header
 *  row in row 2 (the import's header scan finds it the same way it does in
 *  the shipped template), the records from row 3, then the same empty,
 *  bordered grid the template carries down to row 600. Styling comes from
 *  importTemplateStyle.ts, the standard the shipped templates use. */
export async function buildTemplateRecordsWorkbook(
  headers: readonly string[],
  dataRows: readonly string[][],
): Promise<Workbook> {
  const ExcelJSMod = await import("exceljs");
  const ExcelJS = ((ExcelJSMod as unknown as { default?: typeof ExcelJSMod }).default ?? ExcelJSMod) as typeof ExcelJSMod;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(TEMPLATE_SHEET_NAME, {
    views: [{ state: "frozen", xSplit: 1, ySplit: 2, showGridLines: false }],
  });

  sheet.getCell(1, 1).value = TEMPLATE_BANNER;
  styleDataEntryBanner(sheet);

  headers.forEach((h, idx) => {
    sheet.getCell(2, idx + 1).value = h;
  });
  const required = headers.map((h) => /\s\*$/.test(h));
  styleDataEntryHeader(sheet, 2, required);

  const numFmts = headers.map((h) => (TEXT_FORMAT_HEADERS.has(h.replace(/\s\*$/, "")) ? "@" : undefined));
  applyDataEntryGrid(sheet, {
    firstRow: 3,
    required,
    numFmts,
    lastRow: Math.max(DATA_ENTRY_LAST_ROW, 2 + dataRows.length),
  });
  dataRows.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value !== "") sheet.getCell(3 + r, c + 1).value = value;
    });
  });

  headers.forEach((_, idx) => {
    sheet.getColumn(idx + 1).width = TEMPLATE_COLUMN_WIDTHS[idx] ?? MESSAGE_COLUMN_WIDTH;
  });
  return workbook;
}

function csvEscape(value: string): string {
  if (value === "") return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function triggerBlobDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ExportRolesTemplateRecordsParams {
  rows: ImportedRoleRow[];
  /** `_row` → the exact message string the page shows for that row. */
  messages: Map<number, string>;
  /** Heading for the appended far-right column. */
  messageHeader: "Error Message" | "Warning Message";
  format: "csv" | "xlsx";
  importName: string;
  /** File-name suffix, e.g. "failed" → `<stem>_failed.csv`. */
  suffix: string;
}

export async function exportRolesTemplateRecords({
  rows,
  messages,
  messageHeader,
  format,
  importName,
  suffix,
}: ExportRolesTemplateRecordsParams): Promise<void> {
  const filename = `${importNameToFilenameStem(importName)}_${suffix}.${format}`;
  const headers = [...ROLES_TEMPLATE_HEADERS, messageHeader];
  const dataRows = rows.map((r) => [...toTemplateValues(r), messages.get(r._row) ?? ""]);

  if (format === "csv") {
    /* Template CSV layout: header row first, data rows below. UTF-8 BOM so
     * Excel-on-Windows decodes non-ASCII cleanly. */
    const lines = [headers.map(csvEscape).join(",")];
    for (const row of dataRows) lines.push(row.map(csvEscape).join(","));
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, lines.join("\n")], { type: "text/csv;charset=utf-8" });
    triggerBlobDownload(filename, blob);
    return;
  }

  const workbook = await buildTemplateRecordsWorkbook(headers, dataRows);
  const buffer = await workbook.xlsx.writeBuffer();
  triggerBlobDownload(
    filename,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}
