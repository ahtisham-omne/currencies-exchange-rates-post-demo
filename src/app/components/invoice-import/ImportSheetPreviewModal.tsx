/* ── Import sheet preview (9/16/26) ───────────────────────────────────
 * The cycle-counting Print Count Sheet recipe, verbatim in shape: build
 * a real PDF (jspdf, already a dependency) and hand the blob to the
 * browser's own PDF viewer in an iframe, which brings pagination, zoom,
 * print and download with it. White header + close over a gray canvas.
 *
 * Two uses: previewing a TEMPLATE (contract columns, the example row,
 * then the column rules and v1 exclusions) and previewing an UPLOADED
 * file (every parsed row, paginated).
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { OUT_OF_SCOPE_V1, objectSpec, templateExampleRows, type ImportObjectKey } from './importModel';

export interface SheetPreviewRequest {
  title: string;
  /** Meta line under the title inside the document. */
  subtitle: string;
  columns: string[];
  rows: string[][];
  /** Template previews append the column-rules and exclusions pages. */
  rulesFor?: ImportObjectKey;
}

export function templatePreviewRequest(key: ImportObjectKey): SheetPreviewRequest {
  const spec = objectSpec(key);
  const rows = templateExampleRows(key);
  return {
    title: `${spec.title} Template`,
    subtitle: key === 'invoices'
      ? `${spec.noun} · ${spec.fields.length} columns · a one-row invoice and a two-row line-item invoice as examples · column rules attached`
      : `${spec.noun} · ${spec.fields.length} columns · one example row · column rules attached`,
    columns: spec.fields.map((f) => f.key),
    rows,
    rulesFor: key,
  };
}

/* ── PDF builder ── */

const PAGE_W = 297; // A4 landscape, mm
const PAGE_H = 210;
const MARGIN = 12;
const USABLE_W = PAGE_W - MARGIN * 2;
const FOOT_Y = PAGE_H - 9;

const INK = '#334155';
const INK_HEAD = '#1E40AF';
const FILL_HEAD: [number, number, number] = [219, 234, 254]; // #DBEAFE
const LINE_HEAD: [number, number, number] = [147, 197, 253]; // #93C5FD
const LINE_ROW: [number, number, number] = [226, 232, 240]; // #E2E8F0

async function buildSheetPdf(req: SheetPreviewRequest): Promise<string> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const ncols = req.columns.length;
  const colW = USABLE_W / ncols;
  const tableFont = ncols > 12 ? 6 : ncols > 8 ? 7 : 8;
  const rowH = ncols > 12 ? 6.4 : 7;

  const truncate = (s: string, width: number): string => {
    if (doc.getTextWidth(s) <= width) return s;
    let out = s;
    while (out.length > 1 && doc.getTextWidth(`${out}…`) > width) out = out.slice(0, -1);
    return `${out}…`;
  };

  let y = MARGIN;

  const drawTitle = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(req.title, MARGIN, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(req.subtitle, MARGIN, y + 10.5);
    y += 16;
  };

  const drawHeaderRow = () => {
    doc.setFillColor(...FILL_HEAD);
    doc.rect(MARGIN, y, USABLE_W, rowH + 1, 'F');
    doc.setDrawColor(...LINE_HEAD);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y + rowH + 1, MARGIN + USABLE_W, y + rowH + 1);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(tableFont);
    doc.setTextColor(INK_HEAD);
    req.columns.forEach((c, i) => {
      doc.text(truncate(c, colW - 2.5), MARGIN + i * colW + 1.2, y + rowH - 1.6);
    });
    y += rowH + 1;
  };

  const pageBreak = (needed: number) => {
    if (y + needed <= PAGE_H - 14) return;
    doc.addPage();
    y = MARGIN;
  };

  drawTitle();
  drawHeaderRow();

  doc.setFont('helvetica', 'normal');
  for (const row of req.rows) {
    if (y + rowH > PAGE_H - 14) {
      doc.addPage();
      y = MARGIN;
      drawHeaderRow();
      doc.setFont('helvetica', 'normal');
    }
    doc.setFontSize(tableFont);
    doc.setTextColor(INK);
    row.slice(0, ncols).forEach((v, i) => {
      doc.text(truncate(String(v ?? ''), colW - 2.5), MARGIN + i * colW + 1.2, y + rowH - 1.8);
    });
    doc.setDrawColor(...LINE_ROW);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y + rowH, MARGIN + USABLE_W, y + rowH);
    y += rowH;
  }

  /* Template flavor: the rules travel with the sheet (spec §1). */
  if (req.rulesFor) {
    const spec = objectSpec(req.rulesFor);
    y += 8;
    pageBreak(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Column Rules', MARGIN, y + 4);
    y += 9;

    const keyW = 52;
    const reqW = 20;
    const ruleW = USABLE_W - keyW - reqW - 6;
    for (const f of spec.fields) {
      doc.setFontSize(8);
      const ruleLines: string[] = f.hint ? (doc.splitTextToSize(f.hint, ruleW) as string[]) : [''];
      const blockH = Math.max(1, ruleLines.length) * 4 + 2.4;
      pageBreak(blockH);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(INK);
      doc.text(f.key, MARGIN, y + 3.2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(f.required ? '#B91C1C' : '#94A3B8');
      doc.text(f.required ? 'Required' : 'Optional', MARGIN + keyW, y + 3.2);
      doc.setTextColor(100, 116, 139);
      ruleLines.forEach((line, li) => {
        doc.text(line, MARGIN + keyW + reqW + 6, y + 3.2 + li * 4);
      });
      doc.setDrawColor(...LINE_ROW);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + blockH, MARGIN + USABLE_W, y + blockH);
      y += blockH + 1.2;
    }

    y += 6;
    pageBreak(14 + OUT_OF_SCOPE_V1.length * 4.6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Not Supported in v1', MARGIN, y + 4);
    y += 9;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    for (const s of OUT_OF_SCOPE_V1) {
      doc.text(`•  ${s}`, MARGIN, y + 3);
      y += 4.6;
    }
  }

  /* Footers, stamped once the page count is final. */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Omne · Vendor Invoice Import', MARGIN, FOOT_Y);
    doc.text(`Page ${p} of ${pages}`, PAGE_W - MARGIN, FOOT_Y, { align: 'right' });
  }

  return doc.output('bloburl') as unknown as string;
}

/* ── Modal ── */

export function ImportSheetPreviewModal({ request, onClose }: { request: SheetPreviewRequest; onClose: () => void }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setFailed(false);
    (async () => {
      try {
        url = await buildSheetPdf(request);
        if (!cancelled) setPdfUrl(url);
      } catch (err) {
        console.error('Import sheet preview failed:', err);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      setPdfUrl(null);
      if (url) URL.revokeObjectURL(url);
    };
  }, [request]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="flex flex-col bg-white rounded-xl overflow-hidden animate-in zoom-in-95 duration-150"
        style={{ width: '95vw', maxWidth: 1220, height: '92vh', boxShadow: '0 24px 80px -12px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — heading left, close on the right (the count-sheet recipe). */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white shrink-0">
          <span className="text-[13px] text-foreground whitespace-nowrap" style={{ fontWeight: 600 }}>
            {request.title} Preview
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Document — the browser's PDF viewer supplies zoom, print, download. */}
        <div className="flex-1 relative bg-slate-200">
          {pdfUrl ? (
            <iframe
              title={request.title}
              src={pdfUrl}
              className="absolute inset-0 w-full h-full border-0"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              {failed ? (
                <span className="text-[13px] text-slate-500">Could not generate the preview.</span>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-primary animate-spin" />
                  <span className="text-[12px] text-slate-500">Preparing the sheet…</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
