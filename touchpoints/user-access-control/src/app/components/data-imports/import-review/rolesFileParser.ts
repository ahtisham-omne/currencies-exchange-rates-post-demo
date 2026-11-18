/* File parser for the Roles import wizard. Mirrors fileParser.ts (the Users
 * parser) one-to-one: same CSV/XLSX readers, same header-scan strategy, same
 * error taxonomy, with the header aliases and row shape swapped for the
 * Roles template's 5 columns. */

import type { RoleReviewField, RoleReviewRow } from "./rolesReviewData";

/* Maps the Roles import template's header labels (and reasonable variants)
 * onto the internal RoleReviewRow shape. Lookup is case- and whitespace-
 * insensitive, and ignores trailing required-field stars. */
const HEADER_ALIASES: Record<string, RoleReviewField> = {
  "role name": "roleName",
  "name": "roleName",
  "description": "description",
  "role owner": "roleOwner",
  "owner": "roleOwner",
  "assigned users": "assignedUsers",
  "users": "assignedUsers",
};

function normHeader(raw: string): string {
  /* Strip the required-field markers the template ships with, a trailing
   * asterisk ("Role Name *") and the parenthesised "(required)" form so
   * both shapes collapse onto the same key in HEADER_ALIASES. */
  return raw
    .replace(/\*/g, "")
    .replace(/\(\s*required\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* Normalised names of the columns we require to be present before we can
 * confidently say a given row is the header row. The template's title row
 * sits above the real header and contains nothing in this set, so it can't
 * be mistaken for headers. Role Name is the only required column. */
const REQUIRED_HEADER_NORMS: ReadonlySet<string> = new Set([
  "role name",
]);

/** Maximum number of non-blank rows to look at when hunting for the header.
 *  Templates may carry a title banner plus a couple of decorative rows; we
 *  give a generous window so a future variant doesn't break detection, but
 *  cap it so a body-only file fails fast instead of scanning the entire
 *  grid. */
const HEADER_SCAN_LIMIT = 10;

/** Locate the header row inside a list of already-blank-stripped rows. The
 *  first row whose cells include every required column name (after the
 *  same normalisation `planColumns` uses) wins; -1 if no row in the scan
 *  window qualifies. */
function findHeaderRowIndex(rows: string[][]): number {
  const limit = Math.min(rows.length, HEADER_SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    const found = new Set<string>();
    for (const cell of rows[i]) {
      const n = normHeader(cell ?? "");
      if (REQUIRED_HEADER_NORMS.has(n)) found.add(n);
      if (found.size === REQUIRED_HEADER_NORMS.size) return i;
    }
  }
  return -1;
}

const EMPTY_ROW: RoleReviewRow = {
  roleName: "",
  description: "",
  roleOwner: "",
  assignedUsers: "",
};

interface ColumnPlan {
  /** Index → RoleReviewField for direct mappings. */
  direct: Map<number, RoleReviewField>;
}

function planColumns(headerRow: string[]): ColumnPlan {
  const direct = new Map<number, RoleReviewField>();

  for (let i = 0; i < headerRow.length; i++) {
    const norm = normHeader(headerRow[i] ?? "");
    if (!norm) continue;

    const aliasMatch = HEADER_ALIASES[norm];
    if (aliasMatch && !direct.has(i)) {
      /* Don't overwrite an already-assigned field. e.g. "Role Name" wins
       * over "Name" if both somehow appear. */
      const alreadyAssigned = Array.from(direct.values()).includes(aliasMatch);
      if (!alreadyAssigned) direct.set(i, aliasMatch);
      continue;
    }
  }

  return { direct };
}

function rowFromValues(values: string[], plan: ColumnPlan): RoleReviewRow {
  const out: RoleReviewRow = { ...EMPTY_ROW };

  for (const [idx, field] of plan.direct) {
    const v = (values[idx] ?? "").trim();
    if (v) (out as Record<RoleReviewField, string>)[field] = v;
  }

  return out;
}

function isRowBlank(values: string[]): boolean {
  return values.every((v) => !v || !v.trim());
}

/* ──────── CSV parser ──────── */
/* Handles RFC-4180 quoted fields, escaped quotes ("") inside quotes, and CRLF
 * line endings. Good enough for the template plus realistic exports from
 * Excel / Google Sheets. Not a full conformant parser, we don't need one. */
function parseCSV(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      /* Swallow CR; the LF (if present) closes the row. */
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      out.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  /* Flush the trailing field/row if the file doesn't end on a newline. */
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out;
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(file);
  });
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof value === "object") {
    const obj = value as { text?: unknown; richText?: { text?: unknown }[]; result?: unknown; hyperlink?: unknown };
    if (typeof obj.text === "string") return obj.text;
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((rt) => (typeof rt?.text === "string" ? rt.text : "")).join("");
    }
    if (typeof obj.result === "string") return obj.result;
    if (typeof obj.result === "number") return String(obj.result);
    if (typeof obj.hyperlink === "string") return obj.hyperlink;
  }
  return String(value);
}

async function parseXLSX(file: File): Promise<string[][]> {
  /* Dynamic import, mirrors the export side so the wizard's first paint
   * doesn't pull in ~600 KB of ExcelJS on routes that never upload. */
  const ExcelJSMod = await import("exceljs");
  const ExcelJS = ((ExcelJSMod as unknown as { default?: typeof ExcelJSMod }).default ?? ExcelJSMod) as typeof ExcelJSMod;
  const buffer = await readFileAsArrayBuffer(file);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  /* The Roles import template ships with the same sheet layout as the Users
   * one: Data Entry holds the uploadable data; the others are documentation.
   * Look up by name first and fall back to the first sheet so CSV-converted
   * or trimmed-down variants still work. */
  const sheet =
    workbook.worksheets.find((s) => s.name.trim().toLowerCase() === "data entry") ??
    workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    /* row.values is 1-indexed; the first entry is null. Slice and coerce to
     * a 0-indexed string array so it lines up with the CSV path. */
    const raw = row.values as unknown[];
    const values = (Array.isArray(raw) ? raw.slice(1) : []).map(cellToString);
    rows.push(values);
  });
  return rows;
}

export interface RolesParseResult {
  rows: RoleReviewRow[];
  /** Total rows in the file, before stripping blanks, used in the wizard's
   *  uploaded-file summary card. */
  rawRowCount: number;
  /** Number of header columns matched into RoleReviewRow fields. */
  matchedFieldCount: number;
}

export class RolesImportFileParseError extends Error {
  code: "EMPTY" | "NO_HEADERS" | "NO_DATA" | "READ_FAILED";
  constructor(code: RolesImportFileParseError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "RolesImportFileParseError";
  }
}

export async function parseRolesImportFile(file: File): Promise<RolesParseResult> {
  const name = file.name.toLowerCase();
  let grid: string[][];
  try {
    if (name.endsWith(".csv")) {
      const text = await readFileAsText(file);
      grid = parseCSV(text);
    } else if (name.endsWith(".xlsx")) {
      grid = await parseXLSX(file);
    } else {
      throw new RolesImportFileParseError("READ_FAILED", "Unsupported file type. Upload an Excel (.xlsx) or CSV (.csv) file.");
    }
  } catch (err) {
    if (err instanceof RolesImportFileParseError) throw err;
    throw new RolesImportFileParseError(
      "READ_FAILED",
      "We couldn't read this file. Make sure it's a valid Excel (.xlsx) or CSV (.csv) export.",
    );
  }

  /* Drop fully-blank lines so a trailing newline doesn't inflate the row
   * count and so blank rows between the title row, the header row, and the
   * data rows don't throw off detection. */
  const nonEmpty = grid.filter((r) => !isRowBlank(r));
  if (nonEmpty.length === 0) {
    throw new RolesImportFileParseError("EMPTY", "This file looks empty. Add at least one role row and re-upload.");
  }

  /* The template ships with a title banner ("OMNE · Roles Import Template")
   * in row 1 and the real column headers in row 2. Scan the first several
   * non-blank rows for one that carries all the required column names and
   * use that as the header, never a fixed row index. */
  const headerIdx = findHeaderRowIndex(nonEmpty);
  if (headerIdx < 0) {
    throw new RolesImportFileParseError(
      "NO_HEADERS",
      "We couldn't match any column headers from this file. Download the template and make sure your file contains a header row with a column named Role Name.",
    );
  }

  const header = nonEmpty[headerIdx];
  const plan = planColumns(header);
  if (plan.direct.size === 0) {
    /* Belt + braces, findHeaderRowIndex already verified the required
     * columns are present, so planColumns should always produce a non-empty
     * map. Keep the guard so a future header-alias regression surfaces
     * here instead of producing silently-empty rows. */
    throw new RolesImportFileParseError(
      "NO_HEADERS",
      "We couldn't match any column headers from this file. Download the template and make sure your file contains a header row with a column named Role Name.",
    );
  }

  const dataRows = nonEmpty.slice(headerIdx + 1);
  const rows = dataRows.map((values) => rowFromValues(values, plan));

  if (rows.length === 0) {
    throw new RolesImportFileParseError(
      "NO_DATA",
      "This file has a header row but no roles. Add at least one role row and re-upload.",
    );
  }

  return {
    rows,
    rawRowCount: dataRows.length,
    matchedFieldCount: plan.direct.size,
  };
}
