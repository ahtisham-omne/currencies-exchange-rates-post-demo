import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  Maximize2,
  Minimize2,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  FileQuestion,
  Trash2,
} from 'lucide-react';

// Attachment preview lightbox — ported from the cycle count app
// (render-companion › attachment-preview-modal) per the 10/1/26 decision:
// cycle count owns the preview design, this module's tokens own the
// styling values. Images get a zoomable viewer, spreadsheets a mock
// grid, PDFs/docs a paginated mock document, so every file previews
// with real-feeling content even when the seed has no bytes behind it.

export interface AttachmentPreviewData {
  id: string;
  name: string;
  size: string;
  typeLabel: string; // PDF, DOCX, XLSX, PNG …
  color: string; // type hue from getFileTypeInfo
  bg: string; // type tint from getFileTypeInfo
  uploadedBy: string;
  dateLabel: string; // already formatted per the module date standard
  previewUrl?: string;
  previewMime?: string;
}

function FileTypeIcon({ typeLabel, color, size = 18 }: { typeLabel: string; color: string; size?: number }) {
  const t = typeLabel.toUpperCase();
  const props = { size, style: { color } };
  if (['XLSX', 'XLS', 'CSV'].includes(t)) return <FileSpreadsheet {...props} />;
  if (['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(t)) return <ImageIcon {...props} />;
  if (['PDF', 'DOC', 'DOCX', 'TXT', 'RTF'].includes(t)) return <FileText {...props} />;
  return <FileQuestion {...props} />;
}

function ToolbarBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex items-center justify-center w-[30px] h-[30px] rounded-full cursor-pointer border-0 bg-transparent text-white hover:bg-white/15 transition-colors"
    >
      {children}
    </button>
  );
}

function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const min = 0.25;
  const max = 4;
  return (
    <div className="relative w-full h-full bg-slate-950">
      <div className="absolute inset-0 overflow-auto flex items-center justify-center">
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="select-none"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center', maxWidth: '100%', maxHeight: '100%', transition: 'transform 0.18s ease-out', cursor: scale > 1 ? 'grab' : 'default' }}
        />
      </div>
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-1 rounded-full border border-white/15"
        style={{ background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(8px)' }}
      >
        <ToolbarBtn label="Zoom Out" onClick={() => setScale((s) => Math.max(min, +(s - 0.25).toFixed(2)))}><ZoomOut size={15} /></ToolbarBtn>
        <div className="px-2 text-[11px] text-white/85 text-center min-w-[44px]">{Math.round(scale * 100)}%</div>
        <ToolbarBtn label="Zoom In" onClick={() => setScale((s) => Math.min(max, +(s + 0.25).toFixed(2)))}><ZoomIn size={15} /></ToolbarBtn>
        <div className="w-px h-4 mx-1 bg-white/20" />
        <ToolbarBtn label="Fit" onClick={() => setScale(1)}><Maximize2 size={14} /></ToolbarBtn>
      </div>
    </div>
  );
}

// Paginated mock document for PDFs/DOCX seeds with no real bytes — the
// cycle count recipe: white pages on a grey surface, page counter.
function TextDocumentViewer({ content, pageCount = 1 }: { content: string; pageCount?: number }) {
  const pages = Array.from({ length: Math.max(1, pageCount) });
  return (
    <div className="w-full h-full overflow-auto bg-slate-100 p-6">
      <div className="flex flex-col items-center gap-5">
        {pages.map((_, idx) => (
          <div
            key={idx}
            className="w-full max-w-[720px] bg-white rounded-md relative whitespace-pre-wrap text-[13.5px] text-foreground"
            style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.10), 0 1px 2px rgba(0,0,0,0.05)', padding: '56px 64px', lineHeight: 1.75, minHeight: pageCount > 1 ? 880 : undefined }}
          >
            {content}
            {pageCount > 1 && (
              <div className="absolute bottom-[18px] right-6 text-[10px] text-slate-400">
                Page {idx + 1} of {pageCount}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Mock spreadsheet for XLSX/CSV seeds — sticky letter/number rails, a
// believable AP-flavored sheet instead of a dead "no preview" panel.
function SpreadsheetViewer() {
  const headers = ['Invoice No.', 'Vendor', 'PO No.', 'Item', 'Qty', 'UOM', 'Unit Price ($)', 'Line Total ($)', 'Posting Date', 'Due Date', 'GL Account', 'Status'];
  const rows: (string | number)[][] = [
    ['INV-000002', 'Acme Supplies Co.', 'PO 1003', 'Hydraulic Hose 1in', 40, 'ft', 62.0, 2480.0, 'Oct 03, 2025', 'Nov 02, 2025', '5010 · Inventory', 'Approved'],
    ['INV-000002', 'Acme Supplies Co.', 'PO 1003', 'Safety Helmets', 35, 'EA', 24.5, 857.5, 'Oct 03, 2025', 'Nov 02, 2025', '5010 · Inventory', 'Approved'],
    ['INV-000003', 'Atlantic Electronics', 'PO 1004', 'Power Cable 1.5m', 640, 'EA', 4.85, 3104.0, 'Oct 05, 2025', 'Nov 04, 2025', '5010 · Inventory', 'Pending'],
    ['INV-000003', 'Atlantic Electronics', 'PO 1004', 'Anti-Fog Glasses', 39, 'EA', 11.2, 436.8, 'Oct 05, 2025', 'Nov 04, 2025', '5010 · Inventory', 'Pending'],
    ['INV-000005', 'Coastal Logistics', 'PO 1007', 'Freight charge', 1, 'EA', 540.0, 540.0, 'Oct 08, 2025', 'Nov 07, 2025', '5205 · Freight In', 'Approved'],
    ['INV-000007', 'Western Manufacturing', 'PO 1010', 'Work Gloves (Bulk)', 73, 'kg', 8.4, 613.2, 'Oct 11, 2025', 'Nov 10, 2025', '5010 · Inventory', 'Paid in Full'],
  ];
  const cols = headers.length;
  const letter = (i: number) => String.fromCharCode(65 + i);
  const cellBorder = '1px solid #E2E8F0';
  const railStyle: React.CSSProperties = { background: '#E2E8F0', color: '#64748B', borderRight: cellBorder, borderBottom: cellBorder, fontWeight: 500, textAlign: 'center' };
  return (
    <div className="w-full h-full overflow-auto bg-slate-50">
      <table className="min-w-full text-[11px] text-foreground" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ ...railStyle, position: 'sticky', top: 0, left: 0, zIndex: 3, width: 40, minWidth: 40, height: 22 }} />
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} style={{ ...railStyle, position: 'sticky', top: 0, zIndex: 2, height: 22, minWidth: 110, padding: '0 8px' }}>{letter(i)}</th>
            ))}
          </tr>
          <tr>
            <th style={{ ...railStyle, position: 'sticky', left: 0, zIndex: 2, width: 40, height: 28 }}>1</th>
            {headers.map((h, i) => (
              <td key={i} style={{ background: 'white', borderRight: cellBorder, borderBottom: cellBorder, padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</td>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              <th style={{ ...railStyle, position: 'sticky', left: 0, zIndex: 1, width: 40, height: 28 }}>{r + 2}</th>
              {row.map((cell, c) => (
                <td key={c} style={{ background: 'white', borderRight: cellBorder, borderBottom: cellBorder, padding: '6px 10px', whiteSpace: 'nowrap', textAlign: typeof cell === 'number' ? 'right' : 'left' }}>
                  {typeof cell === 'number' ? cell.toLocaleString('en-US', { minimumFractionDigits: cell % 1 === 0 && cell < 100 ? 0 : 2, maximumFractionDigits: 2 }) : cell}
                </td>
              ))}
            </tr>
          ))}
          {Array.from({ length: 12 }).map((_, r) => (
            <tr key={`E${r}`}>
              <th style={{ ...railStyle, position: 'sticky', left: 0, zIndex: 1, width: 40, height: 28 }}>{rows.length + 2 + r}</th>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} style={{ background: 'white', borderRight: cellBorder, borderBottom: cellBorder, height: 28, minWidth: 110 }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AttachmentPreviewModal({
  attachment,
  onClose,
  onDelete,
}: {
  attachment: AttachmentPreviewData;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [isFullView, setIsFullView] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const att = attachment;
  const t = att.typeLabel.toUpperCase();

  const isImage = (['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(t) || att.previewMime?.startsWith('image/')) && !!att.previewUrl;
  const isRealPdf = t === 'PDF' && !!att.previewUrl;
  const isSheet = ['XLSX', 'XLS', 'CSV'].includes(t);
  const isDocLike = ['PDF', 'DOC', 'DOCX', 'TXT', 'RTF'].includes(t);

  const textContent = useMemo(() => {
    const base = att.name.replace(/\.[^.]+$/, '');
    return [
      base,
      `Prepared by ${att.uploadedBy}, ${att.dateLabel}. Internal document for accounts payable operations.`,
      `1. Overview\n\nThis document describes the contents and intent of the attached file. It is provided for in-app preview only. Download the original to access the canonical version with full formatting, embedded objects, and revision history.`,
      `2. Scope\n\nThe attached material covers vendor invoicing, receiving reconciliation, payment terms, and settlement workflows for this record. It supersedes all prior revisions.`,
      `3. Responsibilities\n\n• AP clerks are responsible for three-way match review.\n• Approvers release invoices for payment once variances are resolved.\n• Finance reconciles month-end balances against the general ledger.`,
      `4. Procedure\n\nOn receipt of a vendor invoice, verify the billed quantities against the purchase order and receiving note. Route any variance through the exception workflow before posting. Schedule approved invoices according to their payment terms.`,
      `End of preview.`,
    ].join('\n\n');
  }, [att.name, att.uploadedBy, att.dateLabel]);

  const pdfPages = useMemo(() => {
    if (t !== 'PDF') return 1;
    let h = 0;
    for (let i = 0; i < att.name.length; i++) h = (h * 31 + att.name.charCodeAt(i)) | 0;
    return [3, 4, 6, 2, 5][Math.abs(h) % 5];
  }, [att.name, t]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleDownload = useCallback(() => {
    if (att.previewUrl) {
      const a = document.createElement('a');
      a.href = att.previewUrl;
      a.download = att.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [att.previewUrl, att.name, textContent]);

  const easing = 'cubic-bezier(0.32, 0.72, 0, 1)';

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', padding: isFullView ? 0 : 24, transition: `padding 320ms ${easing}` }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${att.name}`}
    >
      <div
        className="relative flex flex-col overflow-hidden bg-white"
        style={{
          width: isFullView ? '100vw' : 'min(1200px, 100%)',
          height: isFullView ? '100vh' : 'min(820px, 100%)',
          borderRadius: isFullView ? 0 : 16,
          boxShadow: '0 32px 96px -16px rgba(15,23,42,0.45)',
          transition: `width 320ms ${easing}, height 320ms ${easing}, border-radius 320ms ${easing}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 border-b border-border bg-white px-4 py-3">
          <div className="flex items-center min-w-0 gap-3">
            <div className="flex items-center justify-center shrink-0 w-9 h-9 rounded-lg" style={{ background: att.bg }}>
              <FileTypeIcon typeLabel={t} color={att.color} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] text-foreground" style={{ fontWeight: 600 }} title={att.name}>{att.name}</div>
              <div className="truncate text-[11px] text-slate-500 mt-0.5">
                <span className="tracking-wide" style={{ fontWeight: 600, color: att.color }}>{t}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                <span>{att.size}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                <span>{att.uploadedBy}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                <span>{att.dateLabel}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center shrink-0 gap-1.5 ml-3">
            <button
              onClick={() => setIsFullView((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer active:scale-[0.97]"
              style={{ fontWeight: 500 }}
            >
              {isFullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isFullView ? 'Exit Full' : 'Full View'}
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer border-0 bg-transparent hover:bg-slate-100 transition-colors active:scale-[0.97]"
              aria-label="Close preview"
            >
              <X size={16} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Preview surface */}
        <div className="flex-1 min-h-0 relative">
          {isImage ? (
            <ImageViewer src={att.previewUrl!} alt={att.name} />
          ) : isRealPdf ? (
            <iframe src={att.previewUrl} title={att.name} className="w-full h-full border-0 bg-white" />
          ) : isSheet ? (
            <SpreadsheetViewer />
          ) : isDocLike ? (
            <TextDocumentViewer content={textContent} pageCount={t === 'PDF' ? pdfPages : 1} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: att.bg }}>
              <FileQuestion size={88} style={{ color: att.color, opacity: 0.55 }} />
              <div className="mt-4 text-[13px] text-slate-500">Preview is not available for this file type.</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center shrink-0 border-t border-border bg-white px-4 py-3 gap-2">
          <div className="flex-1" />
          {onDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center justify-center h-9 px-3 gap-1.5 rounded-lg border border-border bg-white text-[13px] text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer active:scale-[0.97]"
              style={{ fontWeight: 500 }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button
            onClick={handleDownload}
            className="flex items-center justify-center h-9 px-3.5 gap-1.5 rounded-lg bg-primary text-white text-[13px] hover:bg-primary/90 transition-all cursor-pointer active:scale-[0.97] shadow-sm"
            style={{ fontWeight: 600 }}
          >
            <Download size={14} /> Download
          </button>
        </div>
      </div>

      {/* Delete confirmation — gradient-hero confirm per the module's
          modal design language, nested above the lightbox. */}
      {confirmDelete && onDelete && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDelete(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          >
            <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: 'linear-gradient(180deg, #FEE2E2 0%, rgba(254,226,226,0.3) 70%, transparent 100%)' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25 bg-red-400" />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center bg-red-100">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px] tracking-wider bg-red-50 text-red-700" style={{ fontWeight: 600 }}>Caution</span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <div className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600 }}>Delete this attachment?</div>
              <div className="text-[13px] mt-2 max-w-[300px] mx-auto text-slate-500 leading-relaxed">
                <span className="text-foreground" style={{ fontWeight: 600 }}>{att.name}</span> will be permanently removed. This action cannot be undone.
              </div>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setConfirmDelete(false);
                    onDelete();
                    onClose();
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer bg-red-600 text-white hover:bg-red-600/90 transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  Delete Attachment
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
