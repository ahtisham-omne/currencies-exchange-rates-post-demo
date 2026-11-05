/* ExcelJS four-sheet template generator, parameterised by spec. The layout
 * itself lives in `templateLayout.mjs` so the Node generator
 * (`scripts/gen-import-templates.mjs`) and this in-app builder share one
 * source of truth. */

import type { EntitySpec } from "./spec";
import { loadExcelJS, triggerBlobDownload } from "./download";
import {
  buildTemplateWorkbook as buildLayout,
  countLine as countLineFor,
  templateHeaders as headersFor,
  DATA_ENTRY_SHEET,
  DATA_ROWS,
} from "./templateLayout.mjs";

type Workbook = import("exceljs").Workbook;

export { DATA_ENTRY_SHEET, DATA_ROWS };

/** The Data Entry row 2 / CSV header row, exactly as the file carries it. */
export function templateHeaders(spec: EntitySpec<unknown>): string[] {
  return headersFor(spec.data);
}

/** Instructions sheet B4, computed from the columns. */
export function templateCountLine(spec: EntitySpec<unknown>): string {
  return countLineFor(spec.data);
}

/** Build the workbook (Data Entry, Instructions, Field Reference, Valid Values). */
export async function buildTemplateWorkbook(spec: EntitySpec<unknown>): Promise<Workbook> {
  const ExcelJS = await loadExcelJS();
  return buildLayout(ExcelJS, spec.data) as Workbook;
}

export async function buildTemplateWorkbookBuffer(spec: EntitySpec<unknown>): Promise<ArrayBuffer> {
  const wb = await buildTemplateWorkbook(spec);
  const buf = await wb.xlsx.writeBuffer();
  return buf as unknown as ArrayBuffer;
}

/** Generate in the browser and download as `<fileBase>.xlsx`. Returns the filename. */
export async function downloadTemplateWorkbook(spec: EntitySpec<unknown>): Promise<string> {
  const buffer = await buildTemplateWorkbookBuffer(spec);
  const filename = spec.template.xlsxFileName;
  triggerBlobDownload(
    filename,
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  return filename;
}
