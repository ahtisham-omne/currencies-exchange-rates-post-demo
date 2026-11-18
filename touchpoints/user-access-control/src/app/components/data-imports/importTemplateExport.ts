/* Template-fidelity export for the Import Detail page's error / warning
 * downloads.
 *
 * The downloaded file reproduces the Users import template exactly, same
 * 29 columns, same headers (including the required-field asterisks), same
 * order, and (for Excel) the same "Data Entry" sheet layout with the title
 * banner above the header row, so a user can fix the rows and re-upload
 * the very same file without reformatting. One extra column is appended at
 * the far right ("Error Message" / "Warning Message") carrying, word for
 * word, the message Omne shows for that row; the import parser has no alias
 * for it, so it is ignored on re-upload. */

import type { ImportedUserRow } from "./importRecords";
import { importNameToFilenameStem } from "./importRecords";
import type { Workbook } from "exceljs";
import {
  DATA_ENTRY_LAST_ROW,
  applyDataEntryGrid,
  styleDataEntryHeader,
  styleHeadingBand,
  applyDataEntryCellStructure,
} from "./importTemplateStyle";

/* Exact header row from public/templates/OMNE_Users_Import_Template.csv,
 * keep byte-for-byte in sync with the template files. */
export const TEMPLATE_HEADERS: readonly string[] = [
  "First Name *",
  "Last Name *",
  "Email *",
  "License",
  "Status",
  "Invite",
  "Assigned Roles",
  "Middle Name",
  "Username",
  "Preferred Name",
  "Nickname",
  "Gender",
  "Date of Birth",
  "Pronouns",
  "About",
  "Job Title",
  "Notes",
  "Mobile",
  "Work Phone",
  "Home Phone",
  "Personal Email",
  "Home Address",
  "Work Address",
  "Emergency Contact Name",
  "Emergency Contact Relationship",
  "Emergency Contact Phone",
  "Languages",
  "Citizenships",
];

/* Title banner the template's Data Entry sheet carries in row 1. */
const TEMPLATE_SHEET_NAME = "Data Entry";
const TEMPLATE_BANNER = "OMNE  ·  Users Import Template  ·  Data Entry";

/** Map a stored import record onto the template's 28 columns, in order.
 *  Fields the record doesn't carry (middle name, emergency contacts, …)
 *  export blank, exactly like an untouched template cell. Values pass
 *  through verbatim, the template keeps Date of Birth (YYYY-MM-DD) and
 *  each phone in a single column, matching the stored record's shape. */
function toTemplateValues(r: ImportedUserRow): string[] {
  const values = new Array<string>(TEMPLATE_HEADERS.length).fill("");

  values[0] = r.firstName;
  values[1] = r.lastName;
  values[2] = r.emailAddress;
  values[3] = r.licenseType;
  values[4] = r.employeeStatus;
  values[6] = r.assignedRoles;
  values[8] = r.username;
  values[9] = r.preferredName;
  values[11] = r.gender;
  values[12] = r.dateOfBirth;
  values[13] = r.pronouns;
  values[15] = r.jobTitle;
  values[17] = r.mobile;
  values[18] = r.workPhone;
  values[20] = r.personalEmail;
  values[21] = r.homeAddress;
  values[22] = r.workAddress;
  return values;
}

/* Column widths of the shipped template's Data Entry sheet, in order, so a
 * downloaded file lines up with the template it came from. */
export const TEMPLATE_COLUMN_WIDTHS: readonly number[] = [14, 14, 24, 14, 14, 14, 26, 14, 14, 14, 14, 14, 14, 14, 26, 14, 14, 26, 17, 17, 17, 24, 30, 30, 20.9, 28.5, 21.85, 18];
const MESSAGE_COLUMN_WIDTH = 48;

/* Columns the template keeps as text ("@") so dates and phone numbers are
 * not reformatted by Excel. */
const TEXT_FORMAT_HEADERS: ReadonlySet<string> = new Set([
  "Date of Birth",
  "Mobile",
  "Work Phone",
  "Home Phone",
  "Emergency Contact Phone",
]);

/** Build the "Data Entry" workbook: the title banner in row 1, the header
 *  row in row 2 (the import's header scan finds it the same way it does in
 *  the shipped template), the records from row 3, then the same empty,
 *  bordered grid the template carries down to row 600. Styling comes from
 *  importTemplateStyle.ts, the standard the shipped templates use. */
export async function buildTemplateRecordsWorkbook(
  headers: readonly string[],
  dataRows: readonly string[][],
  /** Another module's Data Entry layout. Every field defaults to the Users
   *  template's, so the Users download is unchanged. */
  layout: {
    banner?: string;
    columnWidths?: readonly number[];
    xSplit?: number;
    textFormatHeaders?: ReadonlySet<string>;
  } = {},
): Promise<Workbook> {
  const banner = layout.banner ?? TEMPLATE_BANNER;
  const columnWidths = layout.columnWidths ?? TEMPLATE_COLUMN_WIDTHS;
  const xSplit = layout.xSplit ?? 3;
  const textFormatHeaders = layout.textFormatHeaders ?? TEXT_FORMAT_HEADERS;
  const ExcelJSMod = await import("exceljs");
  const ExcelJS = ((ExcelJSMod as unknown as { default?: typeof ExcelJSMod }).default ?? ExcelJSMod) as typeof ExcelJSMod;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(TEMPLATE_SHEET_NAME, {
    views: [{ state: "frozen", xSplit, ySplit: 2, showGridLines: false }],
  });

  styleHeadingBand(sheet, banner, headers.length);

  headers.forEach((h, idx) => {
    sheet.getCell(2, idx + 1).value = h;
  });
  const required = headers.map((h) => /\s\*$/.test(h));
  styleDataEntryHeader(sheet, 2, required);

  const numFmts = headers.map((h) => (textFormatHeaders.has(h.replace(/\s\*$/, "")) ? "@" : undefined));
  applyDataEntryGrid(sheet, {
    firstRow: 3,
    required,
    numFmts,
    tintRequired: false,
    lastRow: Math.max(DATA_ENTRY_LAST_ROW, 2 + dataRows.length),
  });
  dataRows.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value !== "") sheet.getCell(3 + r, c + 1).value = value;
    });
  });

  applyDataEntryCellStructure(sheet, {
    firstRow: 3,
    lastRow: Math.max(DATA_ENTRY_LAST_ROW, 2 + dataRows.length),
    colCount: headers.length,
    xSplit,
  });

  headers.forEach((_, idx) => {
    sheet.getColumn(idx + 1).width = columnWidths[idx] ?? MESSAGE_COLUMN_WIDTH;
  });
  return workbook;
}

export function csvEscape(value: string): string {
  if (value === "") return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function triggerBlobDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ExportTemplateRecordsParams {
  rows: ImportedUserRow[];
  /** `_row` → the exact message string the page shows for that row. */
  messages: Map<number, string>;
  /** Heading for the appended far-right column. */
  messageHeader: "Error Message" | "Warning Message";
  format: "csv" | "xlsx";
  importName: string;
  /** File-name suffix, e.g. "failed" → `<stem>_failed.csv`. */
  suffix: string;
}

export async function exportTemplateRecords({
  rows,
  messages,
  messageHeader,
  format,
  importName,
  suffix,
}: ExportTemplateRecordsParams): Promise<void> {
  const filename = `${importNameToFilenameStem(importName)}_${suffix}.${format}`;
  const headers = [...TEMPLATE_HEADERS, messageHeader];
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
