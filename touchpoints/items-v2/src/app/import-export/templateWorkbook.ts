/* In-app generator for the four-sheet Items import workbook. The layout
 * itself lives in templateLayout.mjs (shared with scripts/
 * gen-import-templates.mjs); this module adds the typed surface and the
 * dynamic exceljs import so the ~600 KB library stays out of the first
 * paint. */

import type { EntitySpec } from "./spec";
import { buildWorkbookWith, DATA_ENTRY_SHEET, DATA_ROWS, FROZEN_COLUMNS } from "./templateLayout.mjs";

export { DATA_ENTRY_SHEET, DATA_ROWS, FROZEN_COLUMNS };

/* exceljs is loaded dynamically and handed to the untyped .mjs layout module. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadExcelJS(): Promise<any> {
  const mod = await import("exceljs");
  return (mod as unknown as { default?: unknown }).default ?? mod;
}

/** Build the workbook (ExcelJS.Workbook) for `spec.template`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildTemplateWorkbook(spec: EntitySpec): Promise<any> {
  const ExcelJS = await loadExcelJS();
  return buildWorkbookWith(ExcelJS, spec.template);
}

/** The workbook serialised as an .xlsx ArrayBuffer. */
export async function buildTemplateWorkbookBuffer(spec: EntitySpec): Promise<ArrayBuffer> {
  const wb = await buildTemplateWorkbook(spec);
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/** The workbook as a Blob ready for download (`spec.files.xlsx`). */
export async function buildTemplateWorkbookBlob(spec: EntitySpec): Promise<Blob> {
  const buffer = await buildTemplateWorkbookBuffer(spec);
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
