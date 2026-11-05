/* Listing export for Items: PDF (jspdf + jspdf-autotable), XLSX (exceljs)
 * and CSV, port of role-zen's users-export.ts. Field ids come from
 * ITEMS_IMPORT_SPEC.exportFields (the 14 listing columns first, then the
 * remaining import columns); values for import columns are rendered through
 * itemToReviewRow so an export re-imports cleanly. PDF and XLSX are laid
 * out by the shared exportLayout.mjs (XLSX: Items sheet + Glossary). */

import type { Item } from "@/app/context/ItemsContext";
import { toCategoryCode } from "@/app/lib/categoryCode";
import { ITEMS_IMPORT_SPEC, splitList, type EntitySpec, type ExportField, type ItemReviewField } from "./spec";
import { itemToReviewRow } from "./mappers";
import { addExportSheet, addGlossarySheet, buildExportPdf } from "./exportLayout.mjs";
import { downloadName } from "./downloadName";

export type ExportFormat = "pdf" | "xlsx" | "csv";

export type Extracted =
  | { kind: "string"; value: string }
  | { kind: "multi"; values: string[] }
  | { kind: "date"; date: Date | null; raw: string }
  | { kind: "empty" };

/** Owner ids the listing resolves to names (OWNER_DIRECTORY in ItemsListPageV3). */
const OWNER_NAMES: Record<string, string> = {
  "user-123": "Ahtisham Ahmad",
  "user-456": "Maya Patel",
  "user-789": "Liam Chen",
};

const ACQ_LABEL: Record<string, string> = { Purchase: "Purchased", Manufacturing: "Manufactured" };

/** The category code the listing shows: catalog codes pass through, names are hashed. */
export function categoryDisplayCode(name: string): string {
  if (!name) return "";
  return /^C-\d{4}$/i.test(name.trim()) ? name.trim().toUpperCase() : toCategoryCode(name);
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MULTI_FIELDS = new Set<ItemReviewField>(
  ITEMS_IMPORT_SPEC.columns.filter((c) => c.kind === "multiselect").map((c) => c.key),
);

export function extractField(item: Item, fieldId: string, spec: EntitySpec = ITEMS_IMPORT_SPEC): Extracted {
  switch (fieldId) {
    case "part_number":
      return { kind: "string", value: item.partNumber ?? "" };
    case "description":
      return { kind: "string", value: item.description ?? "" };
    case "status":
      return { kind: "string", value: item.status ?? "" };
    case "inventory_control_type":
      return { kind: "string", value: item.inventoryControlType ?? "" };
    case "primary_category":
      return { kind: "string", value: categoryDisplayCode(item.primaryCategory) };
    case "additional_categories":
      return { kind: "multi", values: (item.additionalCategories ?? []).map(categoryDisplayCode) };
    case "tags":
      return { kind: "multi", values: item.tags ?? [] };
    case "on_hand_qty":
      return { kind: "string", value: String(item.onHandQty ?? 0) };
    case "unit":
      return { kind: "string", value: item.unit ?? "" };
    case "acquisition":
      return { kind: "multi", values: (item.acquisitionMethods ?? []).map((m) => ACQ_LABEL[m] ?? m) };
    case "preferred_acquisition":
      return { kind: "string", value: item.primaryAcquisition ? ACQ_LABEL[item.primaryAcquisition] ?? item.primaryAcquisition : "" };
    case "created_on": {
      const d = parseIso(item.createdAt);
      return { kind: "date", date: d, raw: d ? isoDate(d) : "" };
    }
    case "created_by":
      return { kind: "string", value: item.createdBy ?? "" };
    case "owner_id":
      return { kind: "string", value: OWNER_NAMES[item.ownerId] ?? item.ownerId ?? "" };
    default: {
      const field = spec.exportFields.find((f) => f.id === fieldId)?.field ?? (fieldId as ItemReviewField);
      if (field && field in spec.columnByKey) {
        const raw = itemToReviewRow(item)[field];
        if (MULTI_FIELDS.has(field)) return { kind: "multi", values: splitList(raw) };
        return { kind: "string", value: raw };
      }
      return { kind: "empty" };
    }
  }
}

export function isDateField(fieldId: string, spec: EntitySpec = ITEMS_IMPORT_SPEC): boolean {
  return !!spec.exportFields.find((f) => f.id === fieldId)?.date;
}

/** Display string; multi-value join is caller-controlled (", " for PDF, Excel and CSV). */
export function formatFieldString(item: Item, fieldId: string, multiJoin: string): string {
  const v = extractField(item, fieldId);
  switch (v.kind) {
    case "string":
      return v.value;
    case "multi":
      return v.values.join(multiJoin);
    case "date":
      return v.raw;
    case "empty":
      return "";
  }
}

/* ─── Filename + download ─── */

export function exportFilename(ext: ExportFormat, spec: EntitySpec = ITEMS_IMPORT_SPEC, date: Date = new Date()): string {
  return downloadName(spec.nouns.titlePlural, "Export", ext, date);
}

function triggerBlobDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resolveFields(fieldIds: readonly string[], spec: EntitySpec): ExportField[] {
  return fieldIds
    .map((id) => spec.exportFields.find((f) => f.id === id))
    .filter((f): f is ExportField => !!f);
}

/* ─── CSV ─── */

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** CSV text (no BOM): header labels, then one line per item, CRLF, ", " joins for lists. */
export function buildItemsCsv(rows: readonly Item[], fieldIds: readonly string[], spec: EntitySpec = ITEMS_IMPORT_SPEC): string {
  const fields = resolveFields(fieldIds, spec);
  const header = fields.map((f) => escapeCsvCell(f.label)).join(",");
  const body = rows.map((row) => fields.map((f) => escapeCsvCell(formatFieldString(row, f.id, ", "))).join(",")).join("\r\n");
  return `${header}\r\n${body}`;
}

export function exportItemsCsv(rows: readonly Item[], fieldIds: readonly string[], spec: EntitySpec = ITEMS_IMPORT_SPEC): string {
  const csv = buildItemsCsv(rows, fieldIds, spec);
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8" });
  const filename = exportFilename("csv", spec);
  triggerBlobDownload(filename, blob);
  return filename;
}

/* ─── Field help (Export modal info icon + Glossary tab) ─── */

/** Info-icon copy per field: the import column description, or the system
 *  fields' own line. The Glossary tab uses the same text. */
export function exportFieldHelp(f: ExportField, spec: EntitySpec = ITEMS_IMPORT_SPEC): string | undefined {
  const col = f.field ? spec.columnByKey[f.field] : undefined;
  let helpText: string | undefined = col?.description;
  if (f.locked) helpText = `Always included. The ${spec.nouns.singular}'s part number as it appears in Omne.`;
  else if (!helpText) {
    if (f.id === "on_hand_qty") helpText = "Quantity currently on hand, in the stocking unit.";
    else if (f.id === "created_on") helpText = `When the ${spec.nouns.singular} was created in Omne.`;
    else if (f.id === "created_by") helpText = `The user who created the ${spec.nouns.singular}.`;
    else if (f.id === "owner_id") helpText = `The user who owns the ${spec.nouns.singular} record.`;
  }
  return helpText;
}

/* ─── PDF ─── */

export async function exportItemsPdf(rows: readonly Item[], fieldIds: readonly string[], spec: EntitySpec = ITEMS_IMPORT_SPEC): Promise<string> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableModule as { default: typeof autoTableModule.default }).default;
  const fields = resolveFields(fieldIds, spec);
  const body = rows.map((row) => fields.map((f) => formatFieldString(row, f.id, ", ")));
  const doc = buildExportPdf(jsPDF, autoTable, { entity: spec.nouns.titlePlural, headers: fields.map((f) => f.label), body });
  const filename = exportFilename("pdf", spec);
  doc.save(filename);
  return filename;
}

/* ─── Excel ─── */

/** The export workbook: the Items sheet (band, filtered header, frozen panes)
 *  and the Glossary of the exported columns. */
export async function buildItemsWorkbook(rows: readonly Item[], fieldIds: readonly string[], spec: EntitySpec = ITEMS_IMPORT_SPEC) {
  const ExcelJSMod = await import("exceljs");
  const ExcelJS = ((ExcelJSMod as unknown as { default?: typeof ExcelJSMod }).default ?? ExcelJSMod) as typeof ExcelJSMod;
  const fields = resolveFields(fieldIds, spec);
  const entity = spec.nouns.titlePlural;
  const labels = fields.map((f) => f.label);

  const workbook = new ExcelJS.Workbook();
  const numFmts = fields.map((f) => (f.date ? "yyyy-mm-dd" : undefined));
  const cells = rows.map((row) =>
    fields.map((f) => {
      const v = extractField(row, f.id, spec);
      if (v.kind === "string") return f.id === "on_hand_qty" && /^-?\d+(\.\d+)?$/.test(v.value) ? Number(v.value) : v.value;
      if (v.kind === "multi") return v.values.join(", ");
      if (v.kind === "date") return v.date ?? "";
      return "";
    }),
  );
  addExportSheet(workbook, { entity, sheetName: entity, headers: labels, rows: cells, numFmts });
  addGlossarySheet(workbook, { entity, sheetName: entity, entries: fields.map((f) => [f.label, exportFieldHelp(f, spec)]) });
  return workbook;
}

export async function exportItemsExcel(rows: readonly Item[], fieldIds: readonly string[], spec: EntitySpec = ITEMS_IMPORT_SPEC): Promise<string> {
  const workbook = await buildItemsWorkbook(rows, fieldIds, spec);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const filename = exportFilename("xlsx", spec);
  triggerBlobDownload(filename, blob);
  return filename;
}

/* ─── Entry point ─── */

/** Export `rows` with the given export field ids in `format`; resolves to the downloaded filename. */
export async function exportItems(
  rows: readonly Item[],
  fields: readonly string[],
  format: ExportFormat,
  spec: EntitySpec = ITEMS_IMPORT_SPEC,
): Promise<string> {
  if (format === "csv") return exportItemsCsv(rows, fields, spec);
  if (format === "pdf") return exportItemsPdf(rows, fields, spec);
  return exportItemsExcel(rows, fields, spec);
}
