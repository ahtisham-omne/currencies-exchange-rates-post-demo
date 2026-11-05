/* Generic port of the User Access Control `fileParser.ts`, driven by an
 * EntitySpec: extension routing, "Data Entry" sheet by name (else first),
 * header scan of the first 10 non-blank rows for the key column header
 * (after stripping "*" / "(required)"), label + alias mapping, unknown
 * columns dropped, blank rows skipped, hand-rolled RFC-4180 CSV parser,
 * Excel dates coerced to YYYY-MM-DD text. */

import type { EntitySpec, ImportRow } from "./spec";
import { emptyRow } from "./spec";
import { loadExcelJS } from "./download";

export type ParseErrorCode = "EMPTY" | "NO_HEADERS" | "NO_DATA" | "READ_FAILED" | "UNSUPPORTED";

export class ImportFileParseError extends Error {
  code: ParseErrorCode;
  constructor(code: ParseErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ImportFileParseError";
  }
}

export interface ParseResult {
  rows: ImportRow[];
  /** Data rows in the file after the header, before validation. */
  rawRowCount: number;
  /** Number of header columns matched into spec columns. */
  matchedFieldCount: number;
}

export const HEADER_SCAN_LIMIT = 10;
export const DATA_ENTRY_SHEET_NAME = "data entry";

/** Strip required markers, collapse whitespace, lower-case. */
export function normHeader(raw: string): string {
  return String(raw ?? "")
    .replace(/\*/g, "")
    .replace(/\(\s*required\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** normalised header -> column key (labels first, then aliases; first claim wins). */
export function headerAliasMap(spec: EntitySpec<unknown>): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of spec.columns) {
    const label = normHeader(c.label);
    if (!map.has(label)) map.set(label, c.key);
  }
  for (const c of spec.columns) {
    for (const a of c.aliases ?? []) {
      const n = normHeader(a);
      if (n && !map.has(n)) map.set(n, c.key);
    }
  }
  return map;
}

/** Normalised header names that must all be present for a row to be the header row. */
export function requiredHeaderNorms(spec: EntitySpec<unknown>): Set<string> {
  const out = new Set<string>();
  for (const key of spec.headerIdentityKeys) {
    const col = spec.columns.find((c) => c.key === key);
    if (col) out.add(normHeader(col.label));
  }
  return out;
}

function identityNormsWithAliases(spec: EntitySpec<unknown>): Map<string, Set<string>> {
  /* key -> every normalised header (label + aliases) that satisfies it */
  const out = new Map<string, Set<string>>();
  for (const key of spec.headerIdentityKeys) {
    const col = spec.columns.find((c) => c.key === key);
    if (!col) continue;
    const set = new Set<string>([normHeader(col.label)]);
    for (const a of col.aliases ?? []) set.add(normHeader(a));
    out.set(key, set);
  }
  return out;
}

export function findHeaderRowIndex(spec: EntitySpec<unknown>, rows: string[][]): number {
  const identity = identityNormsWithAliases(spec);
  const limit = Math.min(rows.length, HEADER_SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    const norms = new Set(rows[i].map((c) => normHeader(c ?? "")));
    let ok = true;
    for (const set of identity.values()) {
      let hit = false;
      for (const n of set) if (norms.has(n)) { hit = true; break; }
      if (!hit) { ok = false; break; }
    }
    if (ok && identity.size > 0) return i;
  }
  return -1;
}

export interface ColumnPlan {
  /** column index -> spec column key */
  direct: Map<number, string>;
}

export function planColumns(spec: EntitySpec<unknown>, headerRow: string[]): ColumnPlan {
  const aliases = headerAliasMap(spec);
  const direct = new Map<number, string>();
  const claimed = new Set<string>();
  for (let i = 0; i < headerRow.length; i++) {
    const norm = normHeader(headerRow[i] ?? "");
    if (!norm) continue;
    const key = aliases.get(norm);
    if (!key || claimed.has(key)) continue; // unknown column, or a later duplicate alias: dropped
    direct.set(i, key);
    claimed.add(key);
  }
  return { direct };
}

export function rowFromValues(spec: EntitySpec<unknown>, values: string[], plan: ColumnPlan): ImportRow {
  const out = emptyRow(spec);
  for (const [idx, key] of plan.direct) {
    const v = (values[idx] ?? "").trim();
    if (v) out[key] = v;
  }
  return out;
}

export function isRowBlank(values: string[]): boolean {
  return values.every((v) => !v || !String(v).trim());
}

/* ──────── CSV parser (RFC-4180: quotes, "" escapes, embedded commas / newlines, CRLF) ──────── */
export function parseCSV(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  /* Strip a UTF-8 BOM if the reader left one in. */
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { row.push(field); out.push(row); row = []; field = ""; i++; continue; }
    field += ch; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); out.push(row); }
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

/** Coerce an ExcelJS cell value to the text the review grid holds. */
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
    if (Array.isArray(obj.richText)) return obj.richText.map((rt) => (typeof rt?.text === "string" ? rt.text : "")).join("");
    if (typeof obj.result === "string") return obj.result;
    if (typeof obj.result === "number") return String(obj.result);
    if (obj.result instanceof Date) return cellToString(obj.result);
    if (typeof obj.hyperlink === "string") return obj.hyperlink;
  }
  return String(value);
}

/** Read the "Data Entry" sheet (else the first sheet) of an xlsx buffer into a string grid. */
export async function xlsxBufferToGrid(buffer: ArrayBuffer): Promise<string[][]> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet =
    workbook.worksheets.find((s) => s.name.trim().toLowerCase() === DATA_ENTRY_SHEET_NAME) ?? workbook.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const raw = row.values as unknown[];
    rows.push((Array.isArray(raw) ? raw.slice(1) : []).map(cellToString));
  });
  return rows;
}

function headerExamples(spec: EntitySpec<unknown>): string {
  const labels = spec.columns.slice(0, 3).map((c) => c.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

/** Turn an already-read grid into rows. Throws ImportFileParseError (EMPTY / NO_HEADERS / NO_DATA). */
/* Banner rows above the header ("Omne  ·  ..." or the legacy "OMNE  ·  ..."
 * from older templates) are never matched by text: the header scan skips any
 * row that is not the header, so both forms keep importing. */
export function parseGrid(spec: EntitySpec<unknown>, grid: string[][]): ParseResult {
  const nonEmpty = grid.filter((r) => !isRowBlank(r));
  if (nonEmpty.length === 0) {
    throw new ImportFileParseError("EMPTY", `This file looks empty. Add at least one ${spec.nounLower} row and re-upload.`);
  }
  const noHeaders = () =>
    new ImportFileParseError(
      "NO_HEADERS",
      `We couldn't match any column headers from this file. Download the template and make sure your file contains a header row with column names like ${headerExamples(spec)}.`,
    );
  const headerIdx = findHeaderRowIndex(spec, nonEmpty);
  if (headerIdx < 0) throw noHeaders();
  const plan = planColumns(spec, nonEmpty[headerIdx]);
  if (plan.direct.size === 0) throw noHeaders();
  const dataRows = nonEmpty.slice(headerIdx + 1);
  const rows = dataRows.map((values) => rowFromValues(spec, values, plan));
  if (rows.length === 0) {
    throw new ImportFileParseError(
      "NO_DATA",
      `This file has a header row but no ${spec.nounPluralLower}. Add at least one ${spec.nounLower} row and re-upload.`,
    );
  }
  return { rows, rawRowCount: dataRows.length, matchedFieldCount: plan.direct.size };
}

export async function parseImportFile(spec: EntitySpec<unknown>, file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
    throw new ImportFileParseError("UNSUPPORTED", "Unsupported file type. Upload an Excel (.xlsx) or CSV (.csv) file.");
  }
  let grid: string[][];
  try {
    if (name.endsWith(".csv")) grid = parseCSV(await readFileAsText(file));
    else grid = await xlsxBufferToGrid(await readFileAsArrayBuffer(file));
  } catch (err) {
    if (err instanceof ImportFileParseError) throw err;
    throw new ImportFileParseError(
      "READ_FAILED",
      "We couldn't read this file. Make sure it's a valid Excel (.xlsx) or CSV (.csv) export.",
    );
  }
  return parseGrid(spec, grid);
}
