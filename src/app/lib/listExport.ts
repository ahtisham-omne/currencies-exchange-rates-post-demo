/* ── Real list exports (9/22/26 review response, GPT F52 / A11) ────────
 * The old toolbar export showed a success toast and produced nothing.
 * This module writes the actual artifact — CSV, Excel (exceljs, the
 * same dependency the import templates use) or PDF (jsPDF, the same
 * dependency the invoice document uses) — and callers signal success
 * only after the file exists in the download list.
 */

export interface ListExportColumn {
  key: string;
  label: string;
}

export type ListExportRow = Record<string, string | number>;

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the click a beat before revoking so the download starts.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function csvEscape(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportRowsToFile(
  format: 'csv' | 'excel' | 'pdf',
  rows: ListExportRow[],
  columns: ListExportColumn[],
  baseName: string,
): Promise<string> {
  const stamp = new Date();
  const dateStamp = `${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, '0')}-${String(stamp.getDate()).padStart(2, '0')}`;
  const fileBase = `${baseName}-${dateStamp}`;

  if (format === 'csv') {
    const lines = [
      columns.map((c) => csvEscape(c.label)).join(','),
      ...rows.map((r) => columns.map((c) => csvEscape(r[c.key] ?? '')).join(',')),
    ];
    const fileName = `${fileBase}.csv`;
    downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), fileName);
    return fileName;
  }

  if (format === 'excel') {
    const ExcelJSMod = await import('exceljs');
    const ExcelJS = (ExcelJSMod as { default?: typeof import('exceljs') }).default ?? ExcelJSMod;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Export');
    ws.columns = columns.map((c) => ({
      header: c.label,
      key: c.key,
      width: Math.min(36, Math.max(12, c.label.length + 4)),
    }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(columns.map((c) => r[c.key] ?? '')));
    const buffer = await wb.xlsx.writeBuffer();
    const fileName = `${fileBase}.xlsx`;
    downloadBlob(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      fileName,
    );
    return fileName;
  }

  // PDF: a plain landscape table, paginated. Column widths share the page
  // proportionally to the longest value in each column.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const usable = pageW - margin * 2;
  const weights = columns.map((c) =>
    Math.max(c.label.length, ...rows.slice(0, 200).map((r) => String(r[c.key] ?? '').length), 6),
  );
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const widths = weights.map((w) => (w / totalWeight) * usable);

  let y = margin;
  const rowH = 16;
  const drawHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let x = margin;
    columns.forEach((c, i) => {
      doc.text(doc.splitTextToSize(c.label, widths[i] - 4)[0] ?? '', x, y);
      x += widths[i];
    });
    y += 6;
    doc.setDrawColor(180);
    doc.line(margin, y, pageW - margin, y);
    y += rowH - 6;
    doc.setFont('helvetica', 'normal');
  };
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(baseName.replace(/-/g, ' '), margin, y);
  y += 20;
  drawHeader();
  rows.forEach((r) => {
    if (y > pageH - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
    let x = margin;
    columns.forEach((c, i) => {
      doc.text(doc.splitTextToSize(String(r[c.key] ?? ''), widths[i] - 4)[0] ?? '', x, y);
      x += widths[i];
    });
    y += rowH;
  });
  const fileName = `${fileBase}.pdf`;
  doc.save(fileName);
  return fileName;
}
