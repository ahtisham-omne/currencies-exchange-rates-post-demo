import type { ColumnSpec } from "./importModel";
import type { SheetImportSpec } from "../sheetSpec";
import { toColumnSpec } from "./columnAdapter";

/* The copied module components read RECORD_COLUMNS / LINE_COLUMNS as constants.
   Here the columns come from whichever module's sheet spec is being imported, so
   the active spec is published once when the review sheet opens and the copied
   components read it through these getters. */
let active: SheetImportSpec | null = null;

export function setActiveSpec(spec: SheetImportSpec): void {
  active = spec;
}

/** "quotes", "sales orders": finishes the shared Tags editor's hint line. */
export function activeRecordPlural(): string {
  return active ? active.recordLabelPlural.toLowerCase() : "records";
}

function columns(level: "record" | "line"): ColumnSpec[] {
  if (!active) return [];
  return active.columns.filter((c) => c.level === level).map(toColumnSpec);
}

export const specColumns = {
  get record(): ColumnSpec[] { return columns("record"); },
  get line(): ColumnSpec[] { return columns("line"); },
};
