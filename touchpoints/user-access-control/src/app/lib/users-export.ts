import type { UserRow } from "../data/users-data";
import { statusDisplayLabel } from "../components/table-cells";
import { addExportSheet, addGlossarySheet, buildExportPdf } from "../components/data-imports/exportLayout.mjs";

/* ──────────────────────────────────────────────────────────────────────────
 * Field extraction
 *
 * The Export modal exposes more columns than UserRow carries. Fields not
 * present in UserRow extract as empty, empty cells are valid per the export
 * spec ("empty cells: export as empty string, not 'null'"), and an id the
 * switch below does not know falls through to `empty` rather than throwing.
 * That is what makes removing a field from the modal a one-place edit.
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

const DATE_FIELDS = new Set(["last_logon", "invited_on", "invite_accepted_on"]);

export function extractField(row: UserRow, fieldId: string): Extracted {
  switch (fieldId) {
    case "full_name":
      return { kind: "string", value: row.fullName };
    case "assigned_roles":
      return { kind: "multi", values: row.assignedRoles ?? [] };
    case "license":
      return { kind: "string", value: row.license };
    case "email":
      return { kind: "string", value: row.email };
    case "status":
      /* Exported as the label the user sees on screen, not the stored value:
       * a file that says "Inactive" contradicts every surface in the app. */
      return { kind: "string", value: statusDisplayLabel(row.status) };
    case "invited_by":
      return { kind: "string", value: row.invitedBy };
    case "last_logon":
      return { kind: "date", date: parseTableDate(row.lastLogon), raw: row.lastLogon };
    case "invited_on":
      return { kind: "date", date: parseTableDate(row.invitedOn), raw: row.invitedOn };
    case "invite_accepted_on":
      return {
        kind: "date",
        date: parseTableDate(row.inviteAcceptedOn),
        raw: row.inviteAcceptedOn === "-" ? "" : row.inviteAcceptedOn,
      };
    /* Phone fields: UserRow has a single `phone`. Map both work_phone and
     * mobile to it so the export reflects what the data actually contains. */
    case "add.mobile":
    case "add.work_phone":
      return { kind: "string", value: row.phone ?? "" };
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
  row: UserRow,
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
  return `Users_Export_${y}-${m}-${day}.${ext}`;
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

export function exportUsersCsv(
  rows: UserRow[],
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

export async function exportUsersPdf(
  rows: UserRow[],
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
  const doc = buildExportPdf(jsPDF, autoTable, { entity: "Users", headers: fieldLabels, body });
  doc.save(exportFilename("pdf"));
}

/* ──────────────────────────────────────────────────────────────────────────
 * Excel (ExcelJS)
 * ────────────────────────────────────────────────────────────────────────── */

/** Glossary text for the fields whose Export modal card has no info icon:
 *  the Field Reference wording of the shipped Users import template
 *  (public/templates/OMNE_Users_Import_Template.xlsx), verbatim. */
export const USERS_TEMPLATE_FIELD_HELP: Record<string, string> = {
  "add.gender": "The user's gender.",
  "add.dob": "The user's date of birth, in year-month-day order.",
  "add.pronouns": "The user's pronouns.",
  "add.job_title": "The user's job title.",
  "add.mobile": "The user's mobile number, entered as you have it. Kept as text.",
  "add.work_phone": "The user's work number, entered as you have it. Kept as text.",
  "add.home_address": "The user's home address on a single line.",
  "add.work_address": "The user's work address on a single line.",
};

/** The export workbook: the Users sheet (band, filtered header, frozen panes)
 *  and the Glossary of the exported columns. `fieldHelp[i]` is the Export
 *  modal's info-icon text for field i (never new copy). */
export async function buildUsersWorkbook(
  rows: UserRow[],
  fieldIds: string[],
  fieldLabels: string[],
  fieldHelp: (string | undefined)[] = []
) {
  const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
  const workbook = new ExcelJS.Workbook();
  // Date columns go in as real Date cells with a date number format.
  const numFmts = fieldIds.map((id) => (isDateField(id) ? id === "invited_on" ? "yyyy-mm-dd" : "yyyy-mm-dd hh:mm" : undefined));
  const cells = rows.map((row) =>
    fieldIds.map((id) => {
      const v = extractField(row, id);
      if (v.kind === "string") return v.value;
      if (v.kind === "multi") return v.values.join(", ");
      if (v.kind === "date") return v.date ?? "";
      return "";
    })
  );
  addExportSheet(workbook, { entity: "Users", sheetName: "Users", headers: fieldLabels, rows: cells, numFmts });
  addGlossarySheet(workbook, {
    entity: "Users",
    sheetName: "Users",
    entries: fieldLabels.map((label, i) => [label, fieldHelp[i]]),
  });
  return workbook;
}

export async function exportUsersExcel(
  rows: UserRow[],
  fieldIds: string[],
  fieldLabels: string[],
  fieldHelp: (string | undefined)[] = []
): Promise<void> {
  const workbook = await buildUsersWorkbook(rows, fieldIds, fieldLabels, fieldHelp);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerBlobDownload(exportFilename("xlsx"), blob);
}
