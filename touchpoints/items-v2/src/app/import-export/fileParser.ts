/* Reads an uploaded .xlsx / .csv into ItemReviewRow[]. Port of the User
 * Access Control import parser (import-review/fileParser.ts) parameterised
 * by the Items spec:
 *  - type by extension only; CSV through a hand-rolled RFC-4180 parser, XLSX
 *    through a dynamic exceljs import
 *  - the "Data Entry" sheet by name, else the first sheet
 *  - blank rows dropped, then the first 10 non-blank rows are scanned for one
 *    that carries every header in spec.headerDetectNorms (after stripping
 *    "*" and "(required)"), so the banner row never masquerades as headers
 *  - headers mapped through spec.headerAliases, first claim wins, unknown
 *    columns silently dropped
 *  - Excel dates become YYYY-MM-DD text, numbers become plain strings,
 *    booleans become Yes / No
 * Failures throw ImportFileParseError with a code and the UAC message. */

import { ITEMS_IMPORT_SPEC, makeEmptyRow, type EntitySpec, type ItemReviewField, type ItemReviewRow } from "./spec";

export type ParseErrorCode = "EMPTY" | "NO_HEADERS" | "NO_DATA" | "READ_FAILED" | "UNSUPPORTED";

export class ImportFileParseError extends Error {
  code: ParseErrorCode;
  constructor(code: ParseErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ImportFileParseError";
  }
}

export const PARSE_MESSAGES: Record<ParseErrorCode, string> = {
  UNSUPPORTED: "Unsupported file type. Upload an Excel (.xlsx) or CSV (.csv) file.",
  READ_FAILED: "We couldn't read this file. Make sure it's a valid Excel (.xlsx) or CSV (.csv) export.",
  EMPTY: "This file looks empty. Add at least one item row and re-upload.",
  NO_HEADERS:
    "We couldn't match any column headers from this file. Download the template and make sure your file contains a header row with column names like Part Number, Description, and Primary Category.",
  NO_DATA: "This file has a header row but no items. Add at least one item row and re-upload.",
};

export interface ParseResult {
  rows: ItemReviewRow[];
  /** Data rows in the file after the header row, before validation. */
  rawRowCount: number;
  /** Number of header columns matched onto ItemReviewRow fields. */
  matchedFieldCount: number;
  /** Zero-based index of the header row among non-blank rows. */
  headerRowIndex: number;
  /** Header cells that matched no column (dropped). */
  unmatchedHeaders: string[];
}

/** Maximum number of non-blank rows to look at when hunting for the header. */
export const HEADER_SCAN_LIMIT = 10;

/** Strip required markers, collapse whitespace, lower-case. */
export function normHeader(raw: string): string {
  return String(raw ?? "")
    .replace(/\*/g, "")
    .replace(/\(\s*required\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** The header row is the first row (within the scan window) that carries
 *  every name in spec.headerDetectNorms, or any alias of the key column
 *  ("Part Number", "SKU", "Item No", ...). The banner row carries neither. */
function findHeaderRowIndex(rows: string[][], spec: EntitySpec): number {
  const limit = Math.min(rows.length, HEADER_SCAN_LIMIT);
  const wanted = new Set(spec.headerDetectNorms);
  for (let i = 0; i < limit; i++) {
    const found = new Set<string>();
    for (const cell of rows[i]) {
      const n = normHeader(cell ?? "");
      if (!n) continue;
      if (spec.headerAliases[n] === spec.keyColumn) return i;
      if (wanted.has(n)) found.add(n);
      if (wanted.size > 0 && found.size === wanted.size) return i;
    }
  }
  return -1;
}

export interface ColumnPlan {
  /** column index -> field */
  direct: Map<number, ItemReviewField>;
  unmatched: string[];
}

export function planColumns(headerRow: string[], spec: EntitySpec = ITEMS_IMPORT_SPEC): ColumnPlan {
  const direct = new Map<number, ItemReviewField>();
  const claimed = new Set<ItemReviewField>();
  const unmatched: string[] = [];
  for (let i = 0; i < headerRow.length; i++) {
    const raw = headerRow[i] ?? "";
    const norm = normHeader(raw);
    if (!norm) continue;
    const field = spec.headerAliases[norm];
    if (field && !claimed.has(field)) {
      direct.set(i, field);
      claimed.add(field);
      continue;
    }
    unmatched.push(String(raw).trim());
  }
  return { direct, unmatched };
}

/* Lists show comma separated; a file made for the older "|" template reads the same way. That
   covers every list column and every single-choice column, where a "|" can only be a leftover
   separator: "Purchased|Manufactured" shows as "Purchased, Manufactured". */
const PIPE_TO_COMMA = new Set<string>(
  ITEMS_IMPORT_SPEC.columns
    .filter((c) => c.kind === "multiselect" || c.kind === "select" || c.kind === "yesno" || c.key === "alternativeUnits" || c.key === "pricing")
    .map((c) => c.key),
);

function rowFromValues(values: string[], plan: ColumnPlan): ItemReviewRow {
  const out = makeEmptyRow();
  for (const [idx, field] of plan.direct) {
    let v = (values[idx] ?? "").trim();
    if (v && PIPE_TO_COMMA.has(field) && v.includes("|")) v = v.split("|").map((x) => x.trim()).filter(Boolean).join(", ");
    if (v) out[field] = v;
  }
  return out;
}

export function isRowBlank(values: string[]): boolean {
  return values.every((v) => !v || !String(v).trim());
}

/* ──────── CSV ──────── */

/** RFC-4180: quoted fields, "" escapes, embedded commas / newlines, CRLF. */
export function parseCsvText(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  /* A UTF-8 BOM decoded as U+FEFF would otherwise stick to the first header. */
  if (text.charCodeAt(0) === 0xfeff) i = 1;
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
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out;
}

/* ──────── XLSX ──────── */

export function cellToString(value: unknown): string {
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
    if (obj.result instanceof Date) return cellToString(obj.result);
    if (typeof obj.hyperlink === "string") return obj.hyperlink;
  }
  return String(value);
}

/** Read the "Data Entry" sheet (else the first sheet) of an .xlsx buffer into a string grid. */
export async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<string[][]> {
  const ExcelJSMod = await import("exceljs");
  const ExcelJS = ((ExcelJSMod as unknown as { default?: typeof ExcelJSMod }).default ?? ExcelJSMod) as typeof ExcelJSMod;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet =
    workbook.worksheets.find((s) => s.name.trim().toLowerCase() === "data entry") ?? workbook.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const raw = row.values as unknown[];
    rows.push((Array.isArray(raw) ? raw.slice(1) : []).map(cellToString));
  });
  return rows;
}

/* ──────── File readers ──────── */

async function readFileAsText(file: File): Promise<string> {
  if (typeof (file as { text?: unknown }).text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof (file as { arrayBuffer?: unknown }).arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(file);
  });
}

/* ──────── Grid -> rows ──────── */

/** Turn a raw string grid (CSV or sheet) into review rows. Throws ImportFileParseError. */
export function gridToRows(grid: string[][], spec: EntitySpec = ITEMS_IMPORT_SPEC): ParseResult {
  const nonEmpty = grid.filter((r) => !isRowBlank(r));
  if (nonEmpty.length === 0) throw new ImportFileParseError("EMPTY", PARSE_MESSAGES.EMPTY);

  const headerIdx = findHeaderRowIndex(nonEmpty, spec);
  if (headerIdx < 0) throw new ImportFileParseError("NO_HEADERS", PARSE_MESSAGES.NO_HEADERS);

  const plan = planColumns(nonEmpty[headerIdx], spec);
  if (plan.direct.size === 0) throw new ImportFileParseError("NO_HEADERS", PARSE_MESSAGES.NO_HEADERS);

  const dataRows = nonEmpty.slice(headerIdx + 1);
  const rows = dataRows.map((values) => rowFromValues(values, plan));
  if (rows.length === 0) throw new ImportFileParseError("NO_DATA", PARSE_MESSAGES.NO_DATA);

  return {
    rows,
    rawRowCount: dataRows.length,
    matchedFieldCount: plan.direct.size,
    headerRowIndex: headerIdx,
    unmatchedHeaders: plan.unmatched,
  };
}

/** Parse an uploaded file. Only .csv and .xlsx are accepted (by extension). */
export async function parseImportFile(file: File, spec: EntitySpec = ITEMS_IMPORT_SPEC): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  let grid: string[][];
  try {
    if (name.endsWith(".csv")) {
      grid = parseCsvText(await readFileAsText(file));
    } else if (name.endsWith(".xlsx")) {
      grid = await parseXlsxBuffer(await readFileAsArrayBuffer(file));
    } else {
      throw new ImportFileParseError("UNSUPPORTED", PARSE_MESSAGES.UNSUPPORTED);
    }
  } catch (err) {
    if (err instanceof ImportFileParseError) throw err;
    throw new ImportFileParseError("READ_FAILED", PARSE_MESSAGES.READ_FAILED);
  }
  return gridToRows(grid, spec);
}
