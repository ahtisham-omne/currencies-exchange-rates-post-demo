/* Parse an uploaded sheet into spec-shaped rows.
 *
 * Accepts .csv and .xlsx. The xlsx path uses exceljs (already a dependency of
 * this app for the template downloads) and reads the first worksheet whose
 * header row matches the spec, so a workbook that carries an instructions tab
 * ahead of the data tab still parses. */

import type { SheetImportSpec } from "./sheetSpec";
import { columnByHeader, normaliseHeader } from "./sheetSpec";
import type { SheetRow } from "./sheetRecords";

export interface SheetParseResult {
  rows: SheetRow[];
  /** How many of the spec's columns the file actually carried. */
  matchedFieldCount: number;
}

export class SheetParseError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SheetParseError";
  }
}

/* ── CSV ── */

/** Split one CSV line, honouring quoted fields and escaped quotes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsvText(text: string): string[][] {
  return text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(splitCsvLine);
}

/* ── XLSX ── */

/** Whether a cell is the key column's header (label, or an alias when the
 *  spec resolves headers itself). */
function isKeyHeader(spec: SheetImportSpec, cell: string): boolean {
  if (spec.resolveHeader) return spec.resolveHeader(cell) === spec.keyColumn;
  return normaliseHeader(cell) === normaliseHeader(spec.columns[0].label);
}

async function parseXlsx(file: File, spec: SheetImportSpec): Promise<string[][]> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  for (const sheet of wb.worksheets) {
    const grid: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        const v = cell.value;
        if (v == null) cells.push("");
        else if (v instanceof Date) {
          cells.push(
            `${String(v.getMonth() + 1).padStart(2, "0")}/${String(v.getDate()).padStart(2, "0")}/${v.getFullYear()}`,
          );
        } else if (typeof v === "object") {
          /* Rich text and formula cells carry their display value under
             `text` / `result`; anything else falls back to its own string. */
          const obj = v as unknown as { text?: unknown; result?: unknown };
          if (obj.text != null) cells.push(String(obj.text));
          else if (obj.result != null) cells.push(String(obj.result));
          else cells.push(String(v));
        } else cells.push(String(v));
      });
      grid.push(cells);
    });
    /* The template carries a title banner above the header row, so look for
       the header row rather than assuming it is the first one. */
    const headerIdx = grid.findIndex((r) => r.some((c) => isKeyHeader(spec, c)));
    if (headerIdx !== -1) return grid.slice(headerIdx);
  }
  throw new SheetParseError(
    "no-header",
    `No sheet in this workbook has a "${spec.columns[0].label}" column. Download the template and paste your rows into it.`,
  );
}

/* ── Entry point ── */

export function makeSheetParser(spec: SheetImportSpec) {
  return async function parseSheetFile(file: File): Promise<SheetParseResult> {
    const name = file.name.toLowerCase();
    let grid: string[][];

    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      grid = parseCsvText(await file.text());
      const headerIdx = grid.findIndex((r) => r.some((c) => isKeyHeader(spec, c)));
      if (headerIdx === -1) {
        throw new SheetParseError(
          "no-header",
          `This file has no "${spec.columns[0].label}" column. Download the template and paste your rows into it.`,
        );
      }
      grid = grid.slice(headerIdx);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      grid = await parseXlsx(file, spec);
    } else {
      throw new SheetParseError("unsupported", "Upload a .csv or .xlsx file.");
    }

    const [header, ...body] = grid;
    if (!header) throw new SheetParseError("empty", "This file has no rows.");

    /* Header position to column key. Unknown headers are ignored, so a legacy
       export carrying extra columns still imports. */
    const map = new Map<number, string>();
    if (spec.resolveHeader) {
      const claimed = new Set<string>();
      header.forEach((raw, idx) => {
        const key = spec.resolveHeader!(raw);
        if (!key || claimed.has(key)) return;
        claimed.add(key);
        map.set(idx, key);
      });
    } else {
      header.forEach((raw, idx) => {
        const col = columnByHeader(spec, raw);
        if (col) map.set(idx, col.key);
      });
    }
    if (map.size === 0) {
      throw new SheetParseError(
        "no-columns",
        "None of this file's columns match the template. Download the template and paste your rows into it.",
      );
    }

    const rows: SheetRow[] = [];
    let lastKey = "";
    body.forEach((cells, i) => {
      const values: Record<string, string> = {};
      for (const [idx, key] of map) values[key] = (cells[idx] ?? "").toString().trim();
      /* A row with nothing in it is spreadsheet padding, not a record. */
      if (Object.values(values).every((v) => v === "")) return;

      const own = values[spec.keyColumn] ?? "";
      /* A blank key column continues the record above: that is how the sheet
         carries a second line item for the same record. */
      const key = own || lastKey;
      const isRecordRow = own !== "" || rows.length === 0;
      if (own) lastKey = own;

      rows.push({
        values,
        _row: i + 1,
        _key: key,
        _isRecordRow: isRecordRow,
        issues: [],
      });
    });

    if (rows.length === 0) throw new SheetParseError("empty", "This file has headers but no rows.");
    return { rows, matchedFieldCount: map.size };
  };
}
