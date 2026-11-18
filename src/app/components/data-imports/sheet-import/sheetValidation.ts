/* Issue computation for a parsed sheet.
 *
 * Two levels, and the split matters: an error blocks its row until the value is
 * fixed, a warning never blocks. A legacy word this import can map onto a real
 * value (Medium onto Standard) is a warning, because dropping the row would
 * lose data the import can place perfectly well. */

import { MAX_EXAMPLES } from "../shared-cells/examples";
import type { SheetImportSpec } from "./sheetSpec";
import type { CellIssue, SheetRow } from "./sheetRecords";

const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export interface ValidateOptions {
  /** Keys that already exist in the module. A row carrying one of these is an
   *  error: importing it would duplicate an existing record. */
  existingKeys?: readonly string[];
}

function isBlank(v: string): boolean {
  return v.trim() === "";
}

function listValues(raw: string): string[] {
  return raw.split("|").map((v) => v.trim()).filter(Boolean);
}

/** Re-run every rule over the rows, in place, replacing any prior issues. Called
 *  after each edit in the review modal so a fix clears its own issue and any
 *  issue the fix creates appears immediately. */
export function validateRows(
  rows: SheetRow[],
  spec: SheetImportSpec,
  options: ValidateOptions = {},
): SheetRow[] {
  const existing = new Set((options.existingKeys ?? []).map((k) => k.toLowerCase()));
  const seenKeys = new Map<string, number>();

  return rows.map((row) => {
    const issues: CellIssue[] = [];
    const val = (key: string) => (row.values[key] ?? "").trim();

    for (const col of spec.columns) {
      /* Record columns only apply to the row that carries the record. On a
         continuation row they are blank by design. */
      if (col.level === "record" && !row._isRecordRow) continue;
      const raw = val(col.key);

      if (col.requirement === "required" && isBlank(raw)) {
        issues.push({
          level: "error",
          field: col.key,
          message: `${col.label} is required.`,
          hint: `Enter a ${col.label.replace(/^Line \/ /, "").toLowerCase()} for this row.`,
        });
        continue;
      }
      if (isBlank(raw)) {
        if (col.requirement === "conditional" && col.conditionalNote) {
          issues.push({
            level: "warning",
            field: col.key,
            message: `${col.label} is blank.`,
            hint: col.conditionalNote,
          });
        }
        continue;
      }

      if (col.kind === "number") {
        const n = Number(raw.replace(/[$,]/g, ""));
        if (!Number.isFinite(n)) {
          issues.push({
            level: "error",
            field: col.key,
            message: `${raw} is not a number.`,
            hint: `Enter ${col.label} as a plain number, without letters or symbols.`,
          });
        } else if (n < 0) {
          issues.push({
            level: "error",
            field: col.key,
            message: `${col.label} cannot be negative.`,
            hint: "Enter zero or more.",
          });
        }
      }

      if (col.kind === "date" && !DATE_RE.test(raw)) {
        issues.push({
          level: "error",
          field: col.key,
          message: `${raw} is not a date Omne reads.`,
          hint: "Use MM/DD/YYYY, for example 03/16/2026.",
        });
      }

      if (col.set) {
        const values = col.list ? listValues(raw) : [raw];
        for (const v of values) {
          if (col.set.some((allowed) => allowed.toLowerCase() === v.toLowerCase())) continue;
          const mapped = spec.aliases[v.toLowerCase()];
          if (mapped && col.set.some((allowed) => allowed.toLowerCase() === mapped.toLowerCase())) {
            issues.push({
              level: "warning",
              field: col.key,
              message: `${v} is not a ${col.label.toLowerCase()} in Omne and imports as ${mapped}.`,
              hint: `Change it to ${mapped} to keep the file and Omne saying the same thing.`,
            });
          } else {
            issues.push({
              level: "error",
              field: col.key,
              message: `${v} is not a ${col.label.toLowerCase()} Omne holds.`,
              hint: col.set.length > MAX_EXAMPLES
                ? `Pick one of: ${col.set.slice(0, MAX_EXAMPLES).join(", ")}, or another value from the list.`
                : `Pick one of: ${col.set.join(", ")}.`,
            });
          }
        }
      }

      if (col.catalog) {
        const known = spec.catalogs[col.catalog] ?? [];
        const values = col.list ? listValues(raw) : [raw];
        for (const v of values) {
          /* `Customer > Location` addresses a location under a customer. The
             catalog may hold the full pair or just the location part, so the
             value passes when either matches. */
          const leaf = v.includes(">") ? v.split(">").pop()!.trim() : v;
          if (known.some((k) => k.toLowerCase() === v.toLowerCase() || k.toLowerCase() === leaf.toLowerCase())) continue;
          const mapped = spec.aliases[leaf.toLowerCase()];
          if (mapped && known.some((k) => k.toLowerCase() === mapped.toLowerCase())) {
            issues.push({
              level: "warning",
              field: col.key,
              message: `${leaf} matches ${mapped} in Omne and imports as ${mapped}.`,
              hint: `Change it to ${mapped} so the file matches the record.`,
            });
          } else {
            issues.push({
              level: "error",
              field: col.key,
              message: `${leaf} does not exist in Omne yet.`,
              hint: spec.catalogModules[col.catalog]
                ? `Create "${leaf}" in ${spec.catalogModules[col.catalog]} first, then re-upload. You can also enter a ${col.label.replace(/^Line \/ /, "").toLowerCase()} that already exists.`
                : `Enter a ${col.label.replace(/^Line \/ /, "").toLowerCase()} that already exists.`,
            });
          }
        }
      }
    }

    /* Key rules run on the record row only: a duplicate inside the file and a
       key that already exists in the module are both blocking. */
    if (row._isRecordRow) {
      const key = val(spec.keyColumn);
      if (key) {
        const firstAt = seenKeys.get(key.toLowerCase());
        if (firstAt != null) {
          issues.push({
            level: "error",
            field: spec.keyColumn,
            message: `${key} appears twice in this file, first on row ${firstAt}.`,
            hint: "Give this record a different number, or drop the row.",
          });
        } else {
          seenKeys.set(key.toLowerCase(), row._row);
        }
        if (existing.has(key.toLowerCase())) {
          issues.push({
            level: "error",
            field: spec.keyColumn,
            message: `${key} already exists in ${spec.recordLabelPlural}.`,
            hint: `Give this row a new number to import it, or drop the row.`,
          });
        }
      }
    }

    return { ...row, issues };
  });
}

export interface IssueTotals {
  rows: number;
  records: number;
  errorRows: number;
  warningRows: number;
  cleanRows: number;
}

export function totals(rows: SheetRow[]): IssueTotals {
  const errorRows = rows.filter((r) => r.issues.some((i) => i.level === "error")).length;
  const warningRows = rows.filter(
    (r) => !r.issues.some((i) => i.level === "error") && r.issues.length > 0,
  ).length;
  return {
    rows: rows.length,
    records: new Set(rows.map((r) => r._key)).size,
    errorRows,
    warningRows,
    cleanRows: rows.length - errorRows - warningRows,
  };
}
