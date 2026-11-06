/**
 * Export the listing back out in the import template's own shape.
 *
 * Round-tripping matters: what comes out here should be loadable by the
 * importer without editing. So the header row and column order are the
 * template's, records are grouped the same way (record columns on the
 * group's first row, `Line /` columns on every row), and multi-value
 * fields go back out pipe-separated.
 */

import { COLUMNS, LINE_COLUMNS, RECORD_COLUMNS, RECORD_LABEL } from "./importSpec";
import { HEADER_ROW, downloadRows } from "./importTemplate";

export interface ExportLine { [key: string]: string | number | undefined }
export interface ExportRecord {
  values: Record<string, string | number | undefined>;
  lines: ExportLine[];
}

function cell(v: string | number | undefined): string {
  if (v == null) return "";
  return String(v);
}

export function buildExportGrid(records: ExportRecord[]): string[][] {
  const rows: string[][] = [HEADER_ROW];
  for (const rec of records) {
    const lines = rec.lines.length ? rec.lines : [{}];
    lines.forEach((line, idx) => {
      const row = COLUMNS.map((c) => {
        if (c.level === "record") {
          /* Record columns only on the group's first row, exactly as the
             template documents and as the parser expects on the way back. */
          return idx === 0 ? cell(rec.values[c.key]) : "";
        }
        return cell(line[c.key]);
      });
      rows.push(row);
    });
  }
  return rows;
}

export async function exportRecordsToFile(records: ExportRecord[], fileNameStem?: string) {
  const stem = fileNameStem ?? `${RECORD_LABEL.replace(/\s+/g, "_")}s_export`;
  const stamp = new Date().toISOString().slice(0, 10);
  await downloadRows(buildExportGrid(records), `${stem}_${stamp}.xlsx`);
}

export const EXPORT_COLUMN_COUNT = COLUMNS.length;
export const EXPORT_RECORD_COLUMNS = RECORD_COLUMNS.length;
export const EXPORT_LINE_COLUMNS = LINE_COLUMNS.length;

/* ── Column-subset exports, for the Export modal ──────────────────────
   The picker hands us the columns to include, in the order it shows them.
   A subset is not re-importable by definition (the template's own header is
   the round-trippable shape), so these writers format for reading instead:
   one row per line, record values repeated on the group's first row only,
   exactly as the full grid does. */

export function buildSubsetGrid(records: ExportRecord[], keys: string[]): string[][] {
  const cols = keys
    .map((k) => COLUMNS.find((c) => c.key === k))
    .filter((c): c is (typeof COLUMNS)[number] => !!c);
  const rows: string[][] = [cols.map((c) => c.label)];
  for (const rec of records) {
    const lines = rec.lines.length ? rec.lines : [{}];
    lines.forEach((line, idx) => {
      rows.push(
        cols.map((c) => (c.level === "record" ? (idx === 0 ? cell(rec.values[c.key]) : "") : cell(line[c.key]))),
      );
    });
  }
  return rows;
}

function stamped(stem?: string): string {
  const base = stem ?? `${RECORD_LABEL.replace(/\s+/g, "_")}s_export`;
  return `${base}_${new Date().toISOString().slice(0, 10)}`;
}

export async function exportSubsetXlsx(records: ExportRecord[], keys: string[], stem?: string) {
  await downloadRows(buildSubsetGrid(records, keys), `${stamped(stem)}.xlsx`);
}

export function exportSubsetCsv(records: ExportRecord[], keys: string[], stem?: string) {
  const grid = buildSubsetGrid(records, keys);
  const csv = grid
    .map((row) => row.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${stamped(stem)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** PDF via jsPDF + autotable, the same pair and the same table styling UAC's
 *  export uses (landscape A4, slate header fill, zebra body, footer stamp). */
export async function exportSubsetPdf(records: ExportRecord[], keys: string[], stem?: string) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableModule as { default: typeof autoTableModule.default }).default;
  const grid = buildSubsetGrid(records, keys);
  const [head, ...body] = grid;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  autoTable(doc, {
    head: [head],
    body,
    startY: 56,
    margin: { left: 32, right: 32, top: 56, bottom: 36 },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 5, overflow: "ellipsize", valign: "middle" },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold", lineWidth: 0.5, lineColor: [226, 232, 240] },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    bodyStyles: { textColor: [30, 41, 59], lineWidth: 0.25, lineColor: [241, 245, 249] },
    didDrawPage: () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(`${RECORD_LABEL}s`, 32, 34);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`${records.length} records · ${dateStr}`, pageWidth - 32, 34, { align: "right" });
      const page = doc.getNumberOfPages();
      doc.text(`Page ${page}`, pageWidth - 32, pageHeight - 18, { align: "right" });
    },
  });

  doc.save(`${stamped(stem)}.pdf`);
}
