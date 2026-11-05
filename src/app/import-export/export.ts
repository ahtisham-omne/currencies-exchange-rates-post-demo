/* Generic listing export, ported from User Access Control `users-export.ts`:
 * PDF via jspdf + jspdf-autotable (dynamic import), XLSX via exceljs (entity
 * sheet + Glossary, laid out by the shared exportLayout.mjs), CSV with BOM
 * and "|" joins. Filename `<Entities>_Export_YYYY-MM-DD.<ext>`. */

import type { EntitySpec, ExportField } from "./spec";
import { loadExcelJS, triggerBlobDownload } from "./download";
import { addExportSheet, addGlossarySheet, buildExportPdf } from "./exportLayout.mjs";

export type ExportFormat = "pdf" | "xlsx" | "csv";

export function todayStamp(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function exportFilename(spec: EntitySpec<unknown>, ext: ExportFormat): string {
  return `${spec.exportFilePrefix}_${todayStamp()}.${ext}`;
}

function fieldById<T>(spec: EntitySpec<T>, id: string): ExportField<T> | undefined {
  return spec.exportFields.find((f) => f.id === id);
}

export function exportFieldLabels<T>(spec: EntitySpec<T>, fieldIds: string[]): string[] {
  return fieldIds.map((id) => fieldById(spec, id)?.label ?? id);
}

type Extracted = { kind: "string"; value: string } | { kind: "multi"; values: string[] } | { kind: "empty" };

export function extractField<T>(spec: EntitySpec<T>, row: T, fieldId: string): Extracted {
  const f = fieldById(spec, fieldId);
  if (!f) return { kind: "empty" };
  const v = f.extract(row);
  if (v === null || v === undefined) return { kind: "empty" };
  if (Array.isArray(v)) return { kind: "multi", values: v.map((x) => String(x ?? "")).filter((x) => x !== "") };
  return { kind: "string", value: String(v) };
}

/** Multi-value join is caller-controlled (", " for PDF/Excel, "|" for CSV). */
export function formatFieldString<T>(spec: EntitySpec<T>, row: T, fieldId: string, multiJoin: string): string {
  const v = extractField(spec, row, fieldId);
  if (v.kind === "string") return v.value;
  if (v.kind === "multi") return v.values.join(multiJoin);
  return "";
}

/** RFC 4180 cell escape: wrap in quotes only when needed; double internal quotes. */
export function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV text (no BOM; the download adds it). CRLF rows, "|" joins. */
export function buildExportCsv<T>(spec: EntitySpec<T>, rows: T[], fieldIds: string[]): string {
  const header = exportFieldLabels(spec, fieldIds).map(escapeCsvCell).join(",");
  const body = rows.map((row) => fieldIds.map((id) => escapeCsvCell(formatFieldString(spec, row, id, "|"))).join(",")).join("\r\n");
  return `${header}\r\n${body}`;
}

export function exportCsv<T>(spec: EntitySpec<T>, rows: T[], fieldIds: string[]): string {
  const csv = buildExportCsv(spec, rows, fieldIds);
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const filename = exportFilename(spec, "csv");
  triggerBlobDownload(filename, new Blob([bom, csv], { type: "text/csv;charset=utf-8" }));
  return filename;
}

/** The text the Export modal shows on a field's info icon: the field's own
 *  helpText, else the import template column with the same label. The
 *  Glossary tab uses the same text, so it never carries copy of its own. */
export function exportFieldHelp<T>(spec: EntitySpec<T>, field: ExportField<T>): string | undefined {
  return field.helpText ?? spec.columns.find((c) => c.label === field.label)?.description;
}

export async function exportPdf<T>(spec: EntitySpec<T>, rows: T[], fieldIds: string[]): Promise<string> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableModule as { default: typeof autoTableModule.default }).default;
  const body = rows.map((row) => fieldIds.map((id) => formatFieldString(spec, row, id, ", ")));
  const doc = buildExportPdf(jsPDF, autoTable, { entity: spec.entity, headers: exportFieldLabels(spec, fieldIds), body });
  const filename = exportFilename(spec, "pdf");
  doc.save(filename);
  return filename;
}

/** Build the export workbook: the entity sheet (band, filtered header, frozen
 *  panes) and the Glossary of the exported columns. */
export async function buildExportWorkbook<T>(spec: EntitySpec<T>, rows: T[], fieldIds: string[]) {
  const ExcelJS = await loadExcelJS();
  const labels = exportFieldLabels(spec, fieldIds);
  const workbook = new ExcelJS.Workbook();

  /* Date columns ("... On") go in as real Date cells with a date format, so Excel sorts and filters them as dates (UAC users-export). */
  const isDateField = (id: string) => id.endsWith("_on");
  const numFmts = fieldIds.map((id) => (isDateField(id) ? "yyyy-mm-dd" : undefined));
  const cells = rows.map((row) =>
    fieldIds.map((id) => {
      const raw = fieldById(spec, id)?.extract(row);
      if (typeof raw === "number") return raw;
      const value = formatFieldString(spec, row, id, ", ");
      const m = isDateField(id) ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
      return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : value;
    }),
  );
  addExportSheet(workbook, { entity: spec.entity, sheetName: spec.entity, headers: labels, rows: cells, numFmts });
  addGlossarySheet(workbook, {
    entity: spec.entity,
    sheetName: spec.entity,
    entries: fieldIds.map((id, i) => {
      const f = fieldById(spec, id);
      return [labels[i], f ? exportFieldHelp(spec, f) : undefined];
    }),
  });
  return workbook;
}

export async function exportExcel<T>(spec: EntitySpec<T>, rows: T[], fieldIds: string[]): Promise<string> {
  const workbook = await buildExportWorkbook(spec, rows, fieldIds);
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = exportFilename(spec, "xlsx");
  triggerBlobDownload(
    filename,
    new Blob([buffer as unknown as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  return filename;
}

/** Export `rows` with the given field ids in the given format. Returns the filename. */
export async function exportRecords<T>(spec: EntitySpec<T>, rows: T[], fieldIds: string[], format: ExportFormat): Promise<string> {
  if (format === "csv") return exportCsv(spec, rows, fieldIds);
  if (format === "pdf") return exportPdf(spec, rows, fieldIds);
  return exportExcel(spec, rows, fieldIds);
}

/** Field ids checked by default: the listing's visible columns (plus locked ones). */
export function defaultExportFieldIds<T>(spec: EntitySpec<T>, columnVisibility?: Record<string, boolean>): string[] {
  return spec.exportFields
    .filter((f) => f.locked || (f.listing && (columnVisibility ? columnVisibility[f.listingKey ?? f.id] !== false : true)))
    .map((f) => f.id);
}
