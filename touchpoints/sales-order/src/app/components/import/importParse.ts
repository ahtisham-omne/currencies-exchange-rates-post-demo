/**
 * Reads an import workbook into grouped records.
 *
 * The templates are not flat, so parsing is two-pass. First find the
 * header row: the workbook opens with a title row and a band row before
 * the real headers, so we scan the first rows for the one containing the
 * key column. Then walk the data rows, starting a new record whenever the
 * key column carries a value and appending a line to the current record
 * on every row, blank key or not. That is exactly the shape the template
 * documents: record columns on the first row of a group, `Line /` columns
 * on every row.
 */

import { COLUMNS, KEY_COLUMN } from "./importSpec";
import type { ImportLine, ImportRecord, ParsedFile } from "./importModel";

const HEADER_SCAN_ROWS = 12;

function normHeader(raw: string): string {
  return raw
    .replace(/[*†]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const LABEL_TO_KEY = new Map(COLUMNS.map((c) => [normHeader(c.label), c.key]));

/** Tolerate a couple of shapes an exporter might emit for the same column. */
const ALIASES: Record<string, string> = {
  "quote number": "quote no",
  "quote #": "quote no",
  "so no": "so number",
  "so #": "so number",
  "sales order number": "so number",
  "customer": "customer name",
  "status": COLUMNS.some((c) => c.label === "Quote Status") ? "quote status" : "order status",
  "line / uom": "line / unit of measure",
  "line / unit price": "line / price per unit",
  "line / qty": "line / quantity",
  "line / sku": "line / item",
};

function keyForHeader(raw: string): string | null {
  const n = normHeader(raw);
  return LABEL_TO_KEY.get(n) ?? LABEL_TO_KEY.get(ALIASES[n] ?? "") ?? null;
}

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "object") {
    /* ExcelJS rich text and hyperlink cells. */
    const rich = v as { text?: unknown; richText?: Array<{ text?: string }>; result?: unknown };
    if (Array.isArray(rich.richText)) return rich.richText.map((r) => r.text ?? "").join("");
    if (rich.text != null) return String(rich.text);
    if (rich.result != null) return String(rich.result);
    return "";
  }
  return String(v).trim();
}

let seq = 0;
const nextId = (p: string) => `${p}-${++seq}`;

/** Turn a raw grid into records. Exported for tests and for CSV input. */
export function buildRecords(grid: string[][]): ParsedFile {
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(grid.length, HEADER_SCAN_ROWS); i++) {
    const mapped = grid[i].map(keyForHeader);
    if (mapped.includes(KEY_COLUMN)) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) {
    return { records: [], unknownColumns: [], missingColumns: COLUMNS.map((c) => c.label), blankRowCount: 0 };
  }

  const headerRow = grid[headerRowIdx];
  const colKeys: (string | null)[] = headerRow.map(keyForHeader);
  const unknownColumns = headerRow
    .map((h, i) => (h.trim() && !colKeys[i] ? h.trim() : null))
    .filter((v): v is string => !!v);
  const present = new Set(colKeys.filter(Boolean) as string[]);
  const missingColumns = COLUMNS.filter((c) => !present.has(c.key)).map((c) => c.label);

  const records: ImportRecord[] = [];
  let blankRowCount = 0;
  let current: ImportRecord | null = null;

  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.every((c) => !c || !c.trim())) { blankRowCount++; continue; }
    const sourceRow = r + 1; // 1-based, as the user sees it

    const recordVals: Record<string, string> = {};
    const lineVals: Record<string, string> = {};
    for (let c = 0; c < colKeys.length; c++) {
      const key = colKeys[c];
      if (!key) continue;
      const val = (row[c] ?? "").trim();
      const spec = COLUMNS.find((x) => x.key === key)!;
      if (spec.level === "record") recordVals[key] = val;
      else lineVals[key] = val;
    }

    const startsRecord = !!recordVals[KEY_COLUMN];
    if (startsRecord) {
      current = { id: nextId("rec"), sourceRows: [sourceRow], values: recordVals, lines: [] };
      records.push(current);
    } else if (!current) {
      /* A line before any record key. Nothing to attach it to. */
      blankRowCount++;
      continue;
    } else {
      current.sourceRows.push(sourceRow);
    }

    const hasLine = Object.values(lineVals).some((v) => v);
    if (hasLine) {
      const line: ImportLine = { id: nextId("line"), sourceRow, values: lineVals };
      current!.lines.push(line);
    }
  }

  return { records, unknownColumns, missingColumns, blankRowCount };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ",") { row.push(cell); cell = ""; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function parseXlsx(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  /* The template's first sheet is "Data Entry"; fall back to the first
     sheet so a plain single-sheet export still works. */
  const ws = wb.getWorksheet("Data Entry") ?? wb.worksheets[0];
  if (!ws) return [];
  const grid: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const out: string[] = [];
    const count = Math.max(row.cellCount, ws.columnCount);
    for (let c = 1; c <= count; c++) out.push(cellToString(row.getCell(c).value));
    grid.push(out);
  });
  return grid;
}

export async function parseImportFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  const grid = name.endsWith(".csv") || name.endsWith(".txt")
    ? parseCsv(await file.text())
    : await parseXlsx(file);
  return buildRecords(grid);
}

/** Split a pipe-separated cell into trimmed values. */
export function splitList(raw: string): string[] {
  return raw.split("|").map((v) => v.trim()).filter(Boolean);
}

/** Parse a `Label:+2400` / `Label:-2%` adjustment. */
export function parseAdjustment(raw: string): { label: string; value: string } | null {
  const idx = raw.lastIndexOf(":");
  if (idx <= 0) return null;
  const label = raw.slice(0, idx).trim();
  const value = raw.slice(idx + 1).trim();
  if (!label || !value) return null;
  return { label, value };
}
