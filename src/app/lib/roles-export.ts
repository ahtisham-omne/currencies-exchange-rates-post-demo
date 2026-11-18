import type { RoleRow } from "../data/roles-data";
import { statusDisplayLabel } from "../components/table-cells";
import { addExportSheet, addGlossarySheet, buildExportPdf } from "../components/data-imports/exportLayout.mjs";

/* ──────────────────────────────────────────────────────────────────────────
 * Field extraction
 *
 * The Export modal exposes 7 columns. Fields not present on RoleRow extract
 * as empty, empty cells are valid per the export spec ("empty cells:
 * export as empty string, not 'null'").
 * ────────────────────────────────────────────────────────────────────────── */

type Extracted =
  | { kind: "string"; value: string }
  | { kind: "multi"; values: string[] }
  | { kind: "date"; date: Date | null; raw: string }
  | { kind: "empty" };

/** Parse "MM/DD/YYYY" or "MM/DD/YYYY - HH:MM" into a Date. Returns null if
 *  the input is missing or unparseable (e.g. the literal "-"). */
function parseTableDate(input: string): Date | null {
  if (!input || input === "-") return null;
  const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s*-\s*(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, mm, dd, yyyy, hh, min] = m;
  const d = new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    hh ? Number(hh) : 0,
    min ? Number(min) : 0
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

const DATE_FIELDS = new Set(["date_created"]);

export function extractField(row: RoleRow, fieldId: string): Extracted {
  switch (fieldId) {
    case "role_name":
      return { kind: "string", value: row.roleName };
    case "description":
      return { kind: "string", value: row.description };
    case "role_type":
      return { kind: "string", value: row.isSystem ? "Predefined" : "Custom" };
    case "license_required":
      return { kind: "string", value: row.licenseRequired };
    case "users":
      return { kind: "string", value: String(row.usersCount) };
    case "status":
      /* Exported as the label the user sees on screen, not the stored value:
       * a file that says "Inactive" contradicts every surface in the app. */
      return { kind: "string", value: statusDisplayLabel(row.status) };
    case "date_created":
      /* Not yet on RoleRow, extracts as empty until the field exists. */
      return { kind: "empty" };
    default:
      return { kind: "empty" };
  }
}

export function isDateField(fieldId: string): boolean {
  return DATE_FIELDS.has(fieldId);
}

/** Format a field value as a display string. Multi-value join character is
 *  caller-controlled (comma for PDF/Excel, pipe for CSV). */
export function formatFieldString(
  row: RoleRow,
  fieldId: string,
  multiJoin: string
): string {
  const v = extractField(row, fieldId);
  switch (v.kind) {
    case "string":
      return v.value;
    case "multi":
      return v.values.join(multiJoin);
    case "date":
      return v.raw;
    case "empty":
      return "";
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Filename + download
 * ────────────────────────────────────────────────────────────────────────── */

export function exportFilename(ext: "pdf" | "xlsx" | "csv"): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `Roles_Export_${y}-${m}-${day}.${ext}`;
}

function triggerBlobDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Slight delay before revoking so Safari has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ──────────────────────────────────────────────────────────────────────────
 * CSV
 * ────────────────────────────────────────────────────────────────────────── */

/** RFC 4180 cell escape: wrap in quotes only when needed; double internal quotes. */
function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportRolesCsv(
  rows: RoleRow[],
  fieldIds: string[],
  fieldLabels: string[]
): void {
  const header = fieldLabels.map(escapeCsvCell).join(",");
  const body = rows
    .map((row) =>
      fieldIds.map((id) => escapeCsvCell(formatFieldString(row, id, "|"))).join(",")
    )
    .join("\r\n");
  const csv = `${header}\r\n${body}`;
  // Prepend UTF-8 BOM so Excel on Windows correctly decodes non-ASCII characters.
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8" });
  triggerBlobDownload(exportFilename("csv"), blob);
}

/* ──────────────────────────────────────────────────────────────────────────
 * PDF (jsPDF + autotable)
 * ────────────────────────────────────────────────────────────────────────── */

export async function exportRolesPdf(
  rows: RoleRow[],
  fieldIds: string[],
  fieldLabels: string[]
): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (autoTableModule as { default: typeof autoTableModule.default }).default;
  const body = rows.map((row) => fieldIds.map((id) => formatFieldString(row, id, ", ")));
  // Band, title block, dark header and page numbers: the shared exportLayout.mjs.
  const doc = buildExportPdf(jsPDF, autoTable, { entity: "Roles", headers: fieldLabels, body });
  doc.save(exportFilename("pdf"));
}

/* ──────────────────────────────────────────────────────────────────────────
 * Excel (ExcelJS)
 * ────────────────────────────────────────────────────────────────────────── */

/** The export workbook: the Roles sheet (band, filtered header, frozen panes)
 *  and the Glossary of the exported columns. `fieldHelp[i]` is the Export
 *  modal's info-icon text for field i (never new copy). */
export async function buildRolesWorkbook(
  rows: RoleRow[],
  fieldIds: string[],
  fieldLabels: string[],
  fieldHelp: (string | undefined)[] = []
) {
  const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
  const workbook = new ExcelJS.Workbook();
  // Date columns go in as real Date cells with a date number format.
  const numFmts = fieldIds.map((id) => (isDateField(id) ? "yyyy-mm-dd" : undefined));
  const cells = rows.map((row) =>
    fieldIds.map((id) => {
      const v = extractField(row, id);
      if (v.kind === "string") return v.value;
      if (v.kind === "multi") return v.values.join(", ");
      if (v.kind === "date") return v.date ?? "";
      return "";
    })
  );
  addExportSheet(workbook, { entity: "Roles", sheetName: "Roles", headers: fieldLabels, rows: cells, numFmts });
  addGlossarySheet(workbook, {
    entity: "Roles",
    sheetName: "Roles",
    entries: fieldLabels.map((label, i) => [label, fieldHelp[i]]),
  });
  return workbook;
}

export async function exportRolesExcel(
  rows: RoleRow[],
  fieldIds: string[],
  fieldLabels: string[],
  fieldHelp: (string | undefined)[] = []
): Promise<void> {
  const workbook = await buildRolesWorkbook(rows, fieldIds, fieldLabels, fieldHelp);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerBlobDownload(exportFilename("xlsx"), blob);
}
