/**
 * AttachmentPreviewModal — Large full-screen preview modal for attachments.
 *
 * Renders a file-type-specific preview:
 *  • Images (png/jpg) — zoomable image viewer with +/- controls and click-to-pan.
 *  • Spreadsheets (xlsx/csv) — Excel-like grid with lettered columns and numbered rows.
 *  • Documents (docx/pdf/txt) — paginated text viewer on paper-like surface.
 *  • Other — fallback large file icon.
 *
 * Footer exposes a primary (filled) Download button alongside Open / Delete.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  FileQuestion,
  File as FileIcon,
  Trash2,
  Music,
  Box as BoxIcon,
} from "lucide-react";
import { type AttachmentCardData } from "./attachment-card";
import { getFileThumbnail, isUnpreviewable, isAudio as isAudioType, isVideo as isVideoType } from "./attachment-config";
import { DeleteAttachmentDialog } from "./delete-attachment-dialog";
import { EmptyState } from "./shared-ui";
import { DxfViewer } from "./dxf-viewer";
import { StlViewer } from "./stl-viewer";
import { resolveStorageUrl } from "@/lib/attachments";

const font = "var(--font-inter)";

export interface AttachmentPreviewData extends AttachmentCardData {
  source?: string;
}

interface AttachmentPreviewModalProps {
  attachment: AttachmentPreviewData;
  onClose: () => void;
  onDelete?: () => void;
  /** When true, clicking Delete fires onDelete + onClose immediately, skipping the confirm dialog. */
  immediateDelete?: boolean;
}

/* ───────────────────────── Mock content generators ───────────────────────── */

function useMockTextContent(fileName: string): string {
  return useMemo(() => {
    const paragraphs = [
      `${fileName.replace(/\.[^.]+$/, "")}`,
      `Generated on ${new Date().toLocaleDateString()} — Internal document for inventory operations.`,
      `1. Overview\n\nThis document describes the contents and intent of the attached file. It is provided for in-app preview only; please download the original to access the canonical version with full formatting, embedded objects, and revision history.`,
      `2. Scope\n\nThe attached material covers receiving, putaway, cycle counting, and adjustment workflows across all warehouse locations. It supersedes all prior revisions.`,
      `3. Responsibilities\n\n• Warehouse leads are responsible for daily reconciliation.\n• Operations managers approve adjustments above threshold.\n• Finance reconciles end-of-month variances against the general ledger.`,
      `4. Procedure\n\nUpon receipt, scan each unit at the inbound dock. Validate against the corresponding purchase order. Quarantine any units that fail visual inspection. Route conforming units to the designated putaway zone within 60 minutes of receipt.`,
      `5. References\n\nSee related SOPs, vendor contracts, and quality assurance handbooks in the document library. For questions, contact the operations support desk.`,
      `— End of preview —`,
    ];
    return paragraphs.join("\n\n");
  }, [fileName]);
}

function useMockSheetContent(): { headers: string[]; rows: (string | number)[][] } {
  return useMemo(() => {
    const headers = [
      "SKU", "Description", "Lot", "Location", "On Hand", "Allocated", "Available", "UoM",
      "Reorder Pt", "Safety Stock", "Lead Time (d)", "Unit Cost ($)", "Total Value ($)",
      "Last Received", "Last Counted", "Cycle Class", "Owner", "Vendor", "PO #", "Notes",
    ];
    const rows: (string | number)[][] = [
      ["WID-1001", "Widget Mk II",          "LOT-A24-001", "WH-01 / A-12", 1240, 80,  1160, "EA", 500, 200, 14, 12.50, 15500.00, "10/22/2025", "10/15/2025", "A", "S. Chen",   "Acme Co.",    "PO-88421", "—"],
      ["WID-1002", "Widget Mk II Pro",      "LOT-A24-002", "WH-01 / A-13",  860, 24,   836, "EA", 400, 150, 14, 18.20, 15652.00, "10/21/2025", "10/14/2025", "A", "S. Chen",   "Acme Co.",    "PO-88421", "Premium SKU"],
      ["BOLT-22",  "Stainless Bolt M8",     "LOT-B24-014", "WH-02 / C-04", 5400, 200, 5200, "EA", 2000, 800, 7,  0.42,  2268.00,  "10/19/2025", "10/02/2025", "B", "M. Patel",  "FastenIt",    "PO-88512", "Bulk"],
      ["GASK-09",  "Rubber Gasket 2in",     "LOT-B24-015", "WH-02 / C-05", 2210, 0,   2210, "EA", 1000, 500, 10, 1.10,  2431.00,  "10/18/2025", "10/02/2025", "B", "M. Patel",  "FastenIt",    "PO-88512", "—"],
      ["CABL-7",   "Power Cable 1.5m",      "LOT-C24-101", "WH-03 / B-01",  640, 40,   600, "EA", 300, 100, 21, 4.85,  3104.00,  "10/17/2025", "09/28/2025", "B", "A. Nguyen", "Cable Pros",  "PO-88634", "—"],
      ["CABL-8",   "Power Cable 3.0m",      "LOT-C24-102", "WH-03 / B-02",  420, 12,   408, "EA", 250, 80,  21, 7.20,  3024.00,  "10/17/2025", "09/28/2025", "B", "A. Nguyen", "Cable Pros",  "PO-88634", "—"],
      ["LBL-RD",   "Red Warning Label",     "LOT-D24-301", "WH-01 / D-09", 9800, 0,   9800, "EA", 3000,1000, 5,  0.08,  784.00,   "10/14/2025", "09/20/2025", "C", "L. Garcia", "PrintWorks",  "PO-88701", "—"],
      ["LBL-YL",   "Yellow Caution Label",  "LOT-D24-302", "WH-01 / D-10", 7600, 100, 7500, "EA", 3000,1000, 5,  0.08,  608.00,   "10/14/2025", "09/20/2025", "C", "L. Garcia", "PrintWorks",  "PO-88701", "—"],
      ["BOX-S",    "Shipping Box — Small",  "LOT-E24-410", "WH-04 / E-01", 3200, 60,  3140, "EA", 1500, 600, 9,  0.55,  1760.00,  "10/12/2025", "09/18/2025", "B", "K. Brown",  "BoxMakers",   "PO-88822", "—"],
      ["BOX-M",    "Shipping Box — Medium", "LOT-E24-411", "WH-04 / E-02", 2800, 0,   2800, "EA", 1200, 500, 9,  0.78,  2184.00,  "10/12/2025", "09/18/2025", "B", "K. Brown",  "BoxMakers",   "PO-88822", "—"],
      ["BOX-L",    "Shipping Box — Large",  "LOT-E24-412", "WH-04 / E-03", 1900, 24,  1876, "EA", 800,  400, 9,  1.10,  2090.00,  "10/12/2025", "09/18/2025", "B", "K. Brown",  "BoxMakers",   "PO-88822", "Fragile only"],
      ["TAPE-2",   "Packing Tape 2in",      "LOT-F24-501", "WH-04 / F-07", 4400, 0,   4400, "EA", 1500, 600, 12, 2.40,  10560.00, "10/10/2025", "09/15/2025", "A", "K. Brown",  "TapeCo",      "PO-88901", "—"],
    ];
    return { headers, rows };
  }, []);
}

/* ───────────────────────── Subviews ───────────────────────── */

function LargeFileIcon({ type, color }: { type: string; color: string }) {
  const props = { size: 88, style: { color, opacity: 0.55 } as React.CSSProperties };
  switch (type) {
    case "pdf":
    case "docx":
    case "txt":  return <FileText {...props} />;
    case "xlsx":
    case "csv":  return <FileSpreadsheet {...props} />;
    case "png":
    case "jpg":  return <FileImage {...props} />;
    case "zip":
    case "rar":  return <FileArchive {...props} />;
    case "exe":
    case "psd":
    case "cad":  return <FileQuestion {...props} />;
    default:     return <FileIcon {...props} />;
  }
}

function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const min = 0.25, max = 4;
  const fit = () => setScale(1);
  return (
    /* Outer non-scrolling wrapper hosts the fixed zoom bar */
    <div className="relative w-full h-full" style={{ background: "#0b0b0d" }}>
      {/* Scrollable image area */}
      <div className="absolute inset-0 overflow-auto flex items-center justify-center">
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            maxWidth: "100%",
            maxHeight: "100%",
            transition: "transform 0.18s ease-out",
            userSelect: "none",
            cursor: scale > 1 ? "grab" : "default",
          }}
        />
      </div>
      {/* Fixed zoom toolbar — stays put when image is scrolled */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-1 rounded-full pointer-events-auto"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)", zIndex: 2 }}
      >
        <ToolbarBtn label="Zoom out" onClick={() => setScale((s) => Math.max(min, +(s - 0.25).toFixed(2)))}>
          <ZoomOut size={15} />
        </ToolbarBtn>
        <div className="px-2 text-[11px] tabular-nums text-white/85" style={{ fontFamily: font, minWidth: 44, textAlign: "center" }}>
          {Math.round(scale * 100)}%
        </div>
        <ToolbarBtn label="Zoom in" onClick={() => setScale((s) => Math.min(max, +(s + 0.25).toFixed(2)))}>
          <ZoomIn size={15} />
        </ToolbarBtn>
        <div className="w-px h-4 mx-1" style={{ background: "rgba(255,255,255,0.18)" }} />
        <ToolbarBtn label="Fit to screen" onClick={fit}>
          <Maximize2 size={14} />
        </ToolbarBtn>
      </div>
    </div>
  );
}

function ToolbarBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex items-center justify-center transition-colors hover:bg-white/15 text-white"
      style={{ width: 30, height: 30, borderRadius: 999, cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

function TextDocumentViewer({ content, pageCount = 1 }: { content: string; pageCount?: number }) {
  const pages = Array.from({ length: Math.max(1, pageCount) });
  return (
    <div className="w-full h-full overflow-auto scroll-visible" style={{ background: "#EEF0F3", padding: "24px" }}>
      <div className="flex flex-col items-center" style={{ gap: 20 }}>
        {pages.map((_, idx) => (
          <div
            key={idx}
            className="w-full"
            style={{
              maxWidth: 720,
              background: "white",
              borderRadius: 6,
              boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
              padding: "56px 64px",
              fontFamily: font,
              fontSize: 13.5,
              lineHeight: 1.75,
              color: "var(--piw-foreground)",
              whiteSpace: "pre-wrap",
              position: "relative",
              minHeight: pageCount > 1 ? 880 : undefined,
            }}
          >
            {content}
            {pageCount > 1 && (
              <div
                style={{
                  position: "absolute",
                  bottom: 18,
                  right: 24,
                  fontFamily: font,
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                }}
              >
                Page {idx + 1} of {pageCount}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SpreadsheetViewer({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  const cols = headers.length;
  const letter = (i: number) => String.fromCharCode(65 + i);
  const cellBorder = "1px solid #E1E3E6";

  return (
    <div className="w-full h-full overflow-auto scroll-visible" style={{ background: "#F6F7F9" }}>
      <table
        style={{
          borderCollapse: "separate",
          borderSpacing: 0,
          fontFamily: font,
          fontSize: 12,
          color: "var(--piw-foreground)",
          minWidth: "100%",
        }}
      >
        {/* Column letters row (Excel-style) */}
        <thead>
          <tr>
            <th
              style={{
                position: "sticky", top: 0, left: 0, zIndex: 3,
                width: 40, minWidth: 40,
                background: "#E8EAED",
                borderRight: cellBorder, borderBottom: cellBorder,
                height: 22,
              }}
            />
            {Array.from({ length: cols }).map((_, i) => (
              <th
                key={`L${i}`}
                style={{
                  position: "sticky", top: 0, zIndex: 2,
                  background: "#E8EAED",
                  borderRight: cellBorder, borderBottom: cellBorder,
                  fontWeight: 500, color: "#5F6368",
                  height: 22, minWidth: 120, padding: "0 8px",
                  textAlign: "center",
                }}
              >
                {letter(i)}
              </th>
            ))}
          </tr>
          {/* Header row (row 1) */}
          <tr>
            <th
              style={{
                position: "sticky", left: 0, zIndex: 2,
                background: "#E8EAED", color: "#5F6368",
                borderRight: cellBorder, borderBottom: cellBorder,
                width: 40, fontWeight: 500, height: 28, textAlign: "center",
              }}
            >
              1
            </th>
            {headers.map((h, i) => (
              <td
                key={`H${i}`}
                style={{
                  background: "white",
                  borderRight: cellBorder, borderBottom: cellBorder,
                  padding: "6px 10px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              <th
                style={{
                  position: "sticky", left: 0, zIndex: 1,
                  background: "#E8EAED", color: "#5F6368",
                  borderRight: cellBorder, borderBottom: cellBorder,
                  fontWeight: 500, width: 40, height: 28, textAlign: "center",
                }}
              >
                {r + 2}
              </th>
              {row.map((cell, c) => (
                <td
                  key={c}
                  style={{
                    background: "white",
                    borderRight: cellBorder, borderBottom: cellBorder,
                    padding: "6px 10px",
                    whiteSpace: "nowrap",
                    textAlign: typeof cell === "number" ? "right" : "left",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {/* Pad with empty rows for the Excel feel */}
          {Array.from({ length: 18 }).map((_, r) => (
            <tr key={`E${r}`}>
              <th
                style={{
                  position: "sticky", left: 0, zIndex: 1,
                  background: "#E8EAED", color: "#5F6368",
                  borderRight: cellBorder, borderBottom: cellBorder,
                  fontWeight: 500, width: 40, height: 28, textAlign: "center",
                }}
              >
                {rows.length + 2 + r}
              </th>
              {Array.from({ length: cols }).map((_, c) => (
                <td
                  key={c}
                  style={{
                    background: "white",
                    borderRight: cellBorder, borderBottom: cellBorder,
                    height: 28, minWidth: 120,
                  }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── Main modal ───────────────────────── */

export function AttachmentPreviewModal({ attachment, onClose, onDelete, immediateDelete = false }: AttachmentPreviewModalProps) {
  const [isFullView, setIsFullView] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const att = attachment;
  const tb = getFileThumbnail(att.fileType);

  /* Resolve the URL to feed viewers: prefer a remote Supabase Storage URL when
   * the attachment has been persisted (`filePath`), otherwise fall back to the
   * local blob URL (`previewUrl`) used during in-flight uploads. */
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(att.previewUrl ?? null);
  useEffect(() => {
    let cancelled = false;
    if (att.filePath) {
      resolveStorageUrl(att.filePath).then((u) => {
        if (!cancelled && u) setResolvedUrl(u);
      });
    } else {
      setResolvedUrl(att.previewUrl ?? null);
    }
    return () => { cancelled = true; };
  }, [att.filePath, att.previewUrl]);

  const previewSrc = resolvedUrl;

  const unpreviewable = isUnpreviewable(att.fileType);
  const isImage = (att.fileType === "png" || att.fileType === "jpg") && !!previewSrc && !unpreviewable;
  const isSheet = (att.fileType === "xlsx" || att.fileType === "csv") && !unpreviewable;
  const isPdf   = att.fileType === "pdf";
  const isText  = !unpreviewable && (att.fileType === "docx" || att.fileType === "txt");
  const isAudio = isAudioType(att.fileType) && !!previewSrc;
  const isVideo = isVideoType(att.fileType) && !!previewSrc;
  const isDxf   = att.fileType === "dxf" && !!previewSrc;
  const isDwg   = att.fileType === "dwg";
  const isStl   = att.fileType === "stl" && !!previewSrc;

  /* Deterministic page count for PDFs: 3, 4, or 6 pages based on file name */
  const pdfPageCount = useMemo(() => {
    if (!isPdf) return 1;
    let h = 0;
    for (let i = 0; i < att.fileName.length; i++) h = (h * 31 + att.fileName.charCodeAt(i)) | 0;
    return [3, 4, 6, 2, 5][Math.abs(h) % 5];
  }, [att.fileName, isPdf]);

  const textContent  = useMockTextContent(att.fileName);
  const sheetContent = useMockSheetContent();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleDownload = useCallback(() => {
    if (previewSrc) {
      const a = document.createElement("a");
      a.href = previewSrc;
      a.download = att.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    // Fallback: download a text placeholder so the button always feels live.
    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = att.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [previewSrc, att.fileName, textContent]);

  const handleOpenExternal = useCallback(() => {
    if (previewSrc) {
      window.open(previewSrc, "_blank");
      return;
    }
    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, [previewSrc, textContent]);

  const easing = "cubic-bezier(0.32, 0.72, 0, 1)";
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        padding: isFullView ? 0 : 24,
        transition: `padding 320ms ${easing}`,
        pointerEvents: "auto",
      }}
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${att.fileName}`}
    >
        <div
          className="relative flex flex-col overflow-hidden"
          style={{
            width: isFullView ? "100vw" : "min(1200px, 100%)",
            height: isFullView ? "100vh" : "min(820px, 100%)",
            borderRadius: isFullView ? 0 : "var(--radius-lg)",
            background: "var(--piw-card)",
            boxShadow: "0 32px 96px -16px rgba(0,0,0,0.45)",
            transition: `width 320ms ${easing}, height 320ms ${easing}, border-radius 320ms ${easing}`,
            willChange: "width, height",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ═══ Header ═══ */}
          <div
            className="flex items-center justify-between shrink-0 border-b"
            style={{
              padding: "12px 16px",
              borderColor: "var(--piw-border)",
              background: "var(--piw-card)",
            }}
          >
            <div className="flex items-center min-w-0" style={{ gap: 12 }}>
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: tb.bg, color: tb.color,
                }}
              >
                {(() => {
                  const p = { size: 18, style: { color: tb.color } as React.CSSProperties };
                  switch (att.fileType) {
                    case "pdf":
                    case "docx":
                    case "txt":  return <FileText {...p} />;
                    case "xlsx":
                    case "csv":  return <FileSpreadsheet {...p} />;
                    case "png":
                    case "jpg":  return <FileImage {...p} />;
                    case "zip":
                    case "rar":  return <FileArchive {...p} />;
                    case "exe":
                    case "psd":
                    case "cad":  return <FileQuestion {...p} />;
                    default:     return <FileIcon {...p} />;
                  }
                })()}
              </div>
              <div className="min-w-0">
                <div
                  className="truncate"
                  style={{
                    fontFamily: font,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--piw-foreground)",
                    lineHeight: 1.25,
                  }}
                  title={att.fileName}
                >
                  {att.fileName}
                </div>
                <div
                  className="truncate"
                  style={{
                    fontFamily: font,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginTop: 2,
                  }}
                >
                  <span style={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, color: tb.color }}>
                    {att.fileType}
                  </span>
                  <span style={{ margin: "0 6px", color: "var(--text-tertiary)" }}>·</span>
                  <span>{att.fileSize}</span>
                  <span style={{ margin: "0 6px", color: "var(--text-tertiary)" }}>·</span>
                  <span>{att.uploadedBy}</span>
                  <span style={{ margin: "0 6px", color: "var(--text-tertiary)" }}>·</span>
                  <span>{att.uploadedDate} {att.uploadedTime}</span>
                  {att.source && (
                    <>
                      <span style={{ margin: "0 6px", color: "var(--text-tertiary)" }}>·</span>
                      <span>{att.source}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center shrink-0" style={{ gap: 6, marginLeft: 12 }}>
              <button
                onClick={() => setIsFullView((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-foreground hover:bg-[hsl(210,100%,96%)] hover:border-[hsl(0,0%,70%)] transition-all cursor-pointer active:scale-[0.97]"
                style={{ fontWeight: 500 }}
                aria-label={isFullView ? "Exit full view" : "Full view"}
              >
                {isFullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullView ? "Exit full" : "Full view"}
              </button>
              <button
                onClick={onClose}
                className="flex items-center justify-center transition-colors bg-transparent hover:bg-[hsl(210,100%,96%)] active:scale-[0.97]"
                style={{
                  width: 36, height: 36, borderRadius: 8, cursor: "pointer",
                  border: "none",
                }}
                aria-label="Close preview"
              >
                <X size={16} style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>
          </div>

          {/* ═══ Preview surface ═══ */}
          <div className="flex-1 min-h-0 relative">
            {unpreviewable ? (
              <div
                className="w-full h-full flex flex-col items-center justify-center"
                style={{ background: tb.bg, padding: "var(--spacing-8) var(--spacing-4)" }}
              >
                <div style={{ position: "relative", width: 88, height: 88, marginBottom: 24 }}>
                  <div
                    className="animate-ping"
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 20,
                      background: tb.color,
                      opacity: 0.08,
                      animationDuration: "2.4s",
                    }}
                  />
                  <div
                    style={{
                      position: "relative",
                      width: 88,
                      height: 88,
                      borderRadius: 20,
                      background: "var(--piw-card)",
                      border: "1px solid var(--piw-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)",
                    }}
                  >
                    <FileQuestion size={36} style={{ color: tb.color, opacity: 0.85 }} />
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: font,
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--piw-foreground)",
                    marginBottom: 6,
                  }}
                >
                  {`Preview unavailable for .${att.fileType.toUpperCase()} files`}
                </div>
                <div style={{ fontFamily: font, fontSize: 13, color: "var(--text-secondary)" }}>
                  Use Download or Open to view it in a compatible application.
                </div>
              </div>
            ) : isImage ? (
              <ImageViewer src={previewSrc!} alt={att.fileName} />
            ) : isSheet ? (
              <SpreadsheetViewer headers={sheetContent.headers} rows={sheetContent.rows} />
            ) : isPdf && previewSrc ? (
              <iframe
                src={previewSrc}
                className="w-full h-full border-0"
                title={`PDF preview: ${att.fileName}`}
              />
            ) : isAudio ? (
              <div
                className="w-full h-full flex flex-col items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)",
                  padding: 24,
                }}
              >
                <div style={{ position: "relative", width: 104, height: 104, marginBottom: 20 }}>
                  <div
                    className="animate-ping"
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 24,
                      background: "#e65100",
                      opacity: 0.12,
                      animationDuration: "2.4s",
                    }}
                  />
                  <div
                    style={{
                      position: "relative",
                      width: 104, height: 104, borderRadius: 24,
                      background: "#fff",
                      border: "1px solid #ffcc80",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 8px 24px rgba(230,81,0,0.22)",
                    }}
                  >
                    <Music size={46} style={{ color: "#e65100" }} />
                  </div>
                </div>
                <div
                  className="truncate"
                  style={{
                    maxWidth: 480, fontFamily: font, fontSize: 14, fontWeight: 600,
                    color: "var(--piw-foreground)", marginBottom: 16, textAlign: "center",
                  }}
                  title={att.fileName}
                >
                  {att.fileName}
                </div>
                <audio
                  src={previewSrc!}
                  controls
                  className="w-full max-w-md"
                  style={{ outline: "none" }}
                />
              </div>
            ) : isVideo ? (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: "#0b0b0d" }}
              >
                <video
                  src={previewSrc!}
                  controls
                  className="rounded-b-lg"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
            ) : isDxf ? (
              <DxfViewer url={previewSrc!} fileName={att.fileName} />
            ) : isDwg ? (
              <div
                className="w-full h-full flex flex-col items-center justify-center"
                style={{ background: tb.bg, padding: "var(--spacing-8) var(--spacing-4)" }}
              >
                <div style={{ position: "relative", width: 88, height: 88, marginBottom: 24 }}>
                  <div
                    className="animate-ping"
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 20,
                      background: tb.color,
                      opacity: 0.08,
                      animationDuration: "2.4s",
                    }}
                  />
                  <div
                    style={{
                      position: "relative",
                      width: 88,
                      height: 88,
                      borderRadius: 20,
                      background: "var(--piw-card)",
                      border: "1px solid var(--piw-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)",
                    }}
                  >
                    <BoxIcon size={36} style={{ color: tb.color, opacity: 0.85 }} />
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: font,
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--piw-foreground)",
                    marginBottom: 6,
                  }}
                >
                  {`Preview unavailable for .${att.fileType.toUpperCase()} files`}
                </div>
                <div style={{ fontFamily: font, fontSize: 13, color: "var(--text-secondary)" }}>
                  Use Download or Open to view it in a compatible application.
                </div>
              </div>
            ) : isStl ? (
              <StlViewer url={previewSrc!} />

            ) : isText || isPdf ? (
              <TextDocumentViewer content={textContent} pageCount={isPdf ? pdfPageCount : 1} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: tb.bg }}>
                <LargeFileIcon type={att.fileType} color={tb.color} />
                <div
                  style={{
                    marginTop: 16, fontFamily: font, fontSize: 13,
                    color: "var(--text-secondary)",
                  }}
                >
                  Preview is not available for this file type.
                </div>
              </div>
            )}
          </div>


          {/* ═══ Footer / actions ═══ */}
          <div
            className="flex items-center shrink-0 border-t"
            style={{
              padding: "12px 16px",
              borderColor: "var(--piw-border)",
              background: "var(--piw-card)",
              gap: 8,
            }}
          >
            <div style={{ flex: 1 }} />
            {onDelete && (
              <button
                onClick={() => { if (immediateDelete) { onDelete?.(); onClose(); } else { setConfirmDelete(true); } }}
                className="flex items-center justify-center border transition-colors active:scale-[0.97]"
                style={{
                  height: 36, padding: "0 12px", borderRadius: 8,
                  background: "var(--piw-card)", cursor: "pointer",
                  gap: 6, fontFamily: font, fontWeight: 500, fontSize: 13,
                  color: "hsl(0 72% 51%)",
                  borderColor: "var(--piw-border)",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "hsl(0 100% 97%)"; (e.currentTarget as HTMLElement).style.borderColor = "hsl(0 72% 51% / 0.4)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--piw-card)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--piw-border)"; }}
              >
                <Trash2 size={14} />
                Delete
              </button>
            )}

            {/* Primary, filled Download */}
            <button
              onClick={handleDownload}
              className="flex items-center justify-center transition-all hover:opacity-90 active:scale-[0.97]"
              style={{
                height: 36, padding: "0 14px", borderRadius: 8,
                background: "var(--piw-primary)", color: "var(--piw-primary-foreground)",
                cursor: "pointer", gap: 6,
                fontFamily: font, fontWeight: 600, fontSize: 13,
                boxShadow: "0 4px 12px rgba(10,119,255,0.25)",
                border: "none",
              }}
            >
              <Download size={14} />
              Download
            </button>
          </div>
        </div>
        {onDelete && (
          <DeleteAttachmentDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            fileName={att.fileName}
            onConfirm={() => { onDelete(); onClose(); }}
          />
        )}
      </div>,
    document.body,
  );
}
