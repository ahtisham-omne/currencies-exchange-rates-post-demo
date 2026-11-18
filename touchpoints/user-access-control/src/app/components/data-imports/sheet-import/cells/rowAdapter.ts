import type { ImportLine, ImportRecord, Issue, RecordValidation } from "./importModel";
import type { SheetImportSpec } from "../sheetSpec";
import type { SheetRow } from "../sheetRecords";

/* The Quote and Sales Order modules' line-items sheet reads one record with its
   lines nested underneath, and its issues bucketed per field and per line. The
   sheet import keeps rows flat, so translate here rather than forking the sheet.
   A record's own columns live on its first row; every row in the group is a
   line. Line ids are the source row number, which makes the trip back trivial. */

export function lineIdFor(row: SheetRow): string {
  return `row-${row._row}`;
}

export function rowNumberFromLineId(lineId: string): number {
  return Number(lineId.replace(/^row-/, ""));
}

export function toImportRecord(key: string, rows: SheetRow[]): ImportRecord {
  const head = rows[0];
  return {
    id: key,
    sourceRows: rows.map((r) => r._row),
    values: { ...(head?.values ?? {}) },
    lines: rows.map<ImportLine>((r) => ({
      id: lineIdFor(r),
      sourceRow: r._row,
      values: { ...r.values },
    })),
  };
}

/* One issue per flagged cell, in the shape the sheet renders: record columns
   land in byField, line columns in byLine under their row's line id. */
export function toRecordValidation(
  rows: SheetRow[],
  spec: SheetImportSpec,
): RecordValidation {
  const byField: Record<string, Issue[]> = {};
  const byLine: Record<string, Record<string, Issue[]>> = {};
  const issues: Issue[] = [];
  const errorLineIds: string[] = [];
  const warningLineIds: string[] = [];

  for (const row of rows) {
    const lineId = lineIdFor(row);
    let lineHasError = false;
    let lineHasWarning = false;

    for (const issue of row.issues) {
      const col = spec.columns.find((c) => c.key === issue.field);
      const severity = issue.level === "error" ? "error" : "warning";
      const shaped: Issue = {
        code: "VALUE_INVALID" as Issue["code"],
        severity,
        scope: col?.level === "line" ? "line" : "record",
        field: issue.field,
        lineId: col?.level === "line" ? lineId : undefined,
        message: issue.hint ? `${issue.message} ${issue.hint}` : issue.message,
        entity: col?.catalog as Issue["entity"],
      };
      issues.push(shaped);

      if (shaped.scope === "line") {
        const fields = byLine[lineId] ?? {};
        fields[issue.field] = [...(fields[issue.field] ?? []), shaped];
        byLine[lineId] = fields;
        if (severity === "error") lineHasError = true;
        else lineHasWarning = true;
      } else {
        byField[issue.field] = [...(byField[issue.field] ?? []), shaped];
      }
    }

    if (lineHasError) errorLineIds.push(lineId);
    else if (lineHasWarning) warningLineIds.push(lineId);
  }

  const status = issues.some((i) => i.severity === "error")
    ? "error"
    : issues.length > 0
      ? "warning"
      : "ready";

  return {
    status: status as RecordValidation["status"],
    issues,
    byField,
    byLine,
    errorLineIds,
    warningLineIds,
  };
}
