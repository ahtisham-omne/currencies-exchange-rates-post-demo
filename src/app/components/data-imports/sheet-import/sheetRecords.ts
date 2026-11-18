/* Row shapes shared by the review modal, the stored detail, and the record
 * table. A row is kept as plain strings: a failed row must keep exactly the
 * text the file carried, because that text is what produced its issue. */

import type { SheetColumn, SheetImportSpec } from "./sheetSpec";

export type RowOutcome = "Created" | "Skipped" | "Failed";
export type RowFilter = "all" | "imported" | "failed";
export type IssueLevel = "error" | "warning";

export interface CellIssue {
  level: IssueLevel;
  /** Column key the issue sits on. Empty for a row-level issue. */
  field: string;
  /** One sentence, shown in the cell's hover card. */
  message: string;
  /** What to do about it, shown under the message. */
  hint?: string;
}

export interface SheetRow {
  /** Column key to the raw cell text. */
  values: Record<string, string>;
  /** 1-based row number in the uploaded file, for reporting. */
  _row: number;
  /** Grouping key value, so lines can be tied to their record. */
  _key: string;
  /** True on the first row of a group: the row carrying the record columns. */
  _isRecordRow: boolean;
  issues: CellIssue[];
  _outcome?: RowOutcome;
  /** Set when the user skips the row in review. */
  _skipped?: boolean;
}

export function cellValue(row: SheetRow, key: string): string {
  return row.values[key] ?? "";
}

export function issuesFor(row: SheetRow, key: string): CellIssue[] {
  return row.issues.filter((i) => i.field === key);
}

export function worstLevel(issues: CellIssue[]): IssueLevel | null {
  if (issues.some((i) => i.level === "error")) return "error";
  if (issues.length > 0) return "warning";
  return null;
}

export function rowHasError(row: SheetRow): boolean {
  return row.issues.some((i) => i.level === "error");
}

export function rowHasWarning(row: SheetRow): boolean {
  return row.issues.some((i) => i.level === "warning");
}

/** Columns shown in the review grid and the record table: every column the
 *  spec declares, record columns first so a group reads left to right. */
export function gridColumns(spec: SheetImportSpec): SheetColumn[] {
  return spec.columns;
}

/** How many records (not rows) the given rows describe. */
export function countRecords(rows: SheetRow[]): number {
  return new Set(rows.map((r) => r._key)).size;
}

/** Filename stem for a download, derived from the import's name. */
export function importNameToStem(name: string): string {
  return name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "import";
}
