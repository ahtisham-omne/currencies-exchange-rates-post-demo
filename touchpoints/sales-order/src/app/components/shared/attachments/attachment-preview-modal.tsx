/**
 * AttachmentPreviewModal, large preview modal for attachment files.
 * Mirrors the Physical Inventory PI-8 pattern.
 *
 *  - Images (png/jpg), zoomable viewer with +/- controls and scrollable canvas.
 *  - Spreadsheets (xlsx/csv), Excel-like grid with lettered cols + numbered rows.
 *  - Documents (docx/pdf/txt), paginated text on paper-like surface.
 *  - Audio (mp3), pulsing music-icon hero + native HTML5 audio controls.
 *  - Video (mp4), native HTML5 video controls.
 *  - 3D / CAD (dxf/dwg/stl): pulsing 3D-box icon placeholder.
 *  - Unpreviewable (zip/rar/exe/psd/cad), "Preview Unavailable" state with
 *    pulse icon.
 *  - URL, opens externally via the Open button.
 *
 * Footer exposes Delete (left), then Open (external) + primary Download (right).
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
  Link2,
  Video,
  Music,
  Trash2,
  Box as BoxIcon,
} from "lucide-react";
import { type AttachmentCardData } from "./attachment-card";
import { getFileThumbnail, isUnpreviewable, isAudio as isAudioType, isVideo as isVideoType } from "./attachment-config";

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
      `Generated on ${new Date().toLocaleDateString()}, internal document for sales operations.`,
      `1. Overview\n\nThis document describes the contents and intent of the attached file. It is provided for in-app preview only; please download the original to access the canonical version with full formatting, embedded objects, and revision history.`,
      `2. Scope\n\nThe attached material covers pricing, terms, and configuration relevant to this quote. It supersedes all prior revisions previously sent to the customer.`,
      `3. Responsibilities\n\n• Account managers are responsible for keeping the customer informed of changes.\n• Sales operations approves any change above the configured threshold.\n• Finance reconciles the executed quote against the order at fulfillment.`,
      `4. Procedure\n\nReview each line item against the bill of materials. Confirm pricing matches the customer-specific schedule. Flag any deviation for sales-operations approval before sending to the customer.`,
      `5. References\n\nSee related templates, customer agreements, and pricing policies in the document library. For questions, contact the sales-operations desk.`,
      `End of preview.`,
    ];
    return paragraphs.join("\n\n");
  }, [fileName]);
}

function useMockSheetContent(): { headers: string[]; rows: (string | number)[][] } {
  return useMemo(() => {
    const headers = [
      "SKU", "Description", "Qty", "Unit Price", "Disc %", "Net Price",
      "Line Total", "UoM", "Lead Time (d)", "Vendor", "PO #",
      "Customer Ref", "Notes",
    ];
    const rows: (string | number)[][] = [
      ["WID-1001", "Widget Mk II",          10, 125.00, 5,  118.75, 1187.50, "EA", 14, "Acme Co.",   "PO-88421", "n/a",          "n/a"],
      ["WID-1002", "Widget Mk II Pro",       6, 182.00, 5,  172.90, 1037.40, "EA", 14, "Acme Co.",   "PO-88421", "Premium",      "n/a"],
      ["BOLT-22",  "Stainless Bolt M8",     40,   4.20, 0,    4.20,  168.00, "EA", 7,  "FastenIt",   "PO-88512", "n/a",          "Bulk"],
      ["GASK-09",  "Rubber Gasket 2in",     12,  11.00, 0,   11.00,  132.00, "EA", 10, "FastenIt",   "PO-88512", "n/a",          "n/a"],
      ["CABL-7",   "Power Cable 1.5m",       8,  48.50, 5,   46.08,  368.60, "EA", 21, "Cable Pros", "PO-88634", "n/a",          "n/a"],
      ["CABL-8",   "Power Cable 3.0m",       4,  72.00, 5,   68.40,  273.60, "EA", 21, "Cable Pros", "PO-88634", "n/a",          "n/a"],
      ["LBL-RD",   "Red Warning Label",    200,   0.80, 0,    0.80,  160.00, "EA", 5,  "PrintWorks", "PO-88701", "n/a",          "n/a"],
      ["LBL-YL",   "Yellow Caution Label", 200,   0.80, 0,    0.80,  160.00, "EA", 5,  "PrintWorks", "PO-88701", "n/a",          "n/a"],
      ["BOX-S",    "Shipping Box, Small",   60,   5.50, 0,    5.50,  330.00, "EA", 9,  "BoxMakers",  "PO-88822", "n/a",          "n/a"],
      ["BOX-M",    "Shipping Box, Medium",  24,   7.80, 0,    7.80,  187.20, "EA", 9,  "BoxMakers",  "PO-88822", "n/a",          "n/a"],
      ["BOX-L",    "Shipping Box, Large",   12,  11.00, 0,   11.00,  132.00, "EA", 9,  "BoxMakers",  "PO-88822", "Fragile only", "n/a"],
      ["TAPE-2",   "Packing Tape 2in",      20,  24.00, 0,   24.00,  480.00, "EA", 12, "TapeCo",     "PO-88901", "n/a",          "n/a"],
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
    case "url":  return <Link2 {...props} />;
    case "mp3":  return <Music {...props} />;
    case "mp4":  return <Video {...props} />;
    case "dxf":
    case "dwg":
    case "stl":  return <BoxIcon {...props} />;
    default:     return <FileIcon {...props} />;
  }
}

function ToolbarBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex items-center justify-center transition-colors hover:bg-white/15 text-white"
      style={{ width: 30, height: 30, borderRadius: 999, cursor: "pointer", border: 0, background: "transparent" }}
    >
      {children}
    </button>
  );
}

function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const min = 0.25, max = 4;
  const fit = () => setScale(1);
  return (
    <div className="relative w-full h-full" style={{ background: "#0b0b0d" }}>
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

function TextDocumentViewer({ content, pageCount = 1 }: { content: string; pageCount?: number }) {
  const pages = Array.from({ length: Math.max(1, pageCount) });
  return (
    <div className="w-full h-full overflow-auto" style={{ background: "#EEF0F3", padding: "24px" }}>
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
              color: "var(--foreground)",
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
    <div className="w-full h-full overflow-auto" style={{ background: "#F6F7F9" }}>
      <table
        style={{
          borderCollapse: "separate",
          borderSpacing: 0,
          fontFamily: font,
          fontSize: 12,
          color: "var(--foreground)",
          minWidth: "100%",
        }}
      >
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

  /* Prefer the local previewUrl; fall back to externalUrl when available. */
  const previewSrc = att.previewUrl || att.externalUrl || null;

  const unpreviewable = isUnpreviewable(att.fileType);
  const isImage = (att.fileType === "png" || att.fileType === "jpg") && !!previewSrc && !unpreviewable;
  const isSheet = (att.fileType === "xlsx" || att.fileType === "csv") && !unpreviewable;
  const isPdf   = att.fileType === "pdf";
  const isText  = !unpreviewable && (att.fileType === "docx" || att.fileType === "txt");
  const isAudio = isAudioType(att.fileType) && !!previewSrc;
  const isVideo = isVideoType(att.fileType) && !!previewSrc;
  const isUrl   = att.fileType === "url";
  const is3D    = att.fileType === "dxf" || att.fileType === "dwg" || att.fileType === "stl";

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
    if (att.externalUrl) {
      window.open(att.externalUrl, "_blank");
      return;
    }
    if (att.previewUrl) {
      window.open(att.previewUrl, "_blank");
      return;
    }
    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, [att.externalUrl, att.previewUrl, textContent]);

  const easing = "cubic-bezier(0.32, 0.72, 0, 1)";
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 12000,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        padding: isFullView ? 0 : 24,
        transition: `padding 320ms ${easing}`,
      }}
      onClick={onClose}
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
          background: "var(--card)",
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
            borderColor: "var(--border)",
            background: "var(--card)",
          }}
        >
          <div className="flex items-center min-w-0" style={{ gap: 12 }}>
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: 36, height: 36, borderRadius: 8, background: tb.bg, color: tb.color }}
            >
              <LargeFileIcon type={att.fileType} color={tb.color} />
            </div>
            <div className="min-w-0">
              <div
                className="truncate"
                style={{
                  fontFamily: font,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--foreground)",
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
                  {att.fileType === "url" ? "LINK" : att.fileType}
                </span>
                {att.fileSize && (
                  <>
                    <span style={{ margin: "0 6px", color: "var(--text-tertiary)" }}>·</span>
                    <span>{att.fileSize}</span>
                  </>
                )}
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
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-foreground hover:bg-[hsl(210,100%,96%)] hover:border-[hsl(0,0%,70%)] transition-all cursor-pointer active:scale-[0.97]"
              style={{ fontWeight: 500 }}
              aria-label={isFullView ? "Exit full view" : "Full view"}
            >
              {isFullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isFullView ? "Exit full" : "Full view"}
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center transition-colors bg-transparent hover:bg-[hsl(210,100%,96%)] active:scale-[0.97]"
              style={{ width: 36, height: 36, borderRadius: 8, cursor: "pointer", border: "none" }}
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
              style={{ background: tb.bg, padding: "48px 16px" }}
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
                    background: "var(--card)",
                    border: "1px solid var(--border)",
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
                  color: "var(--foreground)",
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
                  color: "var(--foreground)", marginBottom: 16, textAlign: "center",
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
          ) : is3D ? (
            <div
              className="w-full h-full flex flex-col items-center justify-center"
              style={{ background: "linear-gradient(135deg, #EEF2FF 0%, #DDE3FF 100%)", padding: "48px 16px" }}
            >
              <div style={{ position: "relative", width: 88, height: 88, marginBottom: 24 }}>
                <div
                  className="animate-ping"
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 20,
                    background: "#4F46E5",
                    opacity: 0.12,
                    animationDuration: "2.4s",
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    width: 88,
                    height: 88,
                    borderRadius: 20,
                    background: "#fff",
                    border: "1px solid #C7D2FE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)",
                  }}
                >
                  <BoxIcon size={36} style={{ color: "#4F46E5", opacity: 0.85 }} />
                </div>
              </div>
              <div
                style={{
                  fontFamily: font,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--foreground)",
                  marginBottom: 6,
                }}
              >
                {`Preview unavailable for .${att.fileType.toUpperCase()} files`}
              </div>
              <div style={{ fontFamily: font, fontSize: 13, color: "var(--text-secondary)" }}>
                Use Download or Open to view it in a compatible application.
              </div>
            </div>
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
                {isUrl ? "External link, use Open to launch it." : "Preview is not available for this file type."}
              </div>
            </div>
          )}
        </div>

        {/* ═══ Footer / actions ═══
            Spacer renders BEFORE the action buttons so Delete and
            Download sit together on the right, matching the latest
            Physical Inventory design. */}
        <div
          className="flex items-center shrink-0 border-t"
          style={{
            padding: "12px 16px",
            borderColor: "var(--border)",
            background: "var(--card)",
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
                background: "var(--card)", cursor: "pointer",
                gap: 6, fontFamily: font, fontWeight: 500, fontSize: 13,
                color: "hsl(0 72% 51%)",
                borderColor: "var(--border)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "hsl(0 100% 97%)"; (e.currentTarget as HTMLElement).style.borderColor = "hsl(0 72% 51% / 0.4)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--card)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
          {(att.externalUrl || att.previewUrl || isUrl) && (
            <button
              onClick={handleOpenExternal}
              className="flex items-center justify-center border border-border transition-colors hover:bg-[hsl(210,100%,96%)] hover:border-[hsl(0,0%,70%)]"
              style={{
                height: 36, padding: "0 12px", borderRadius: 8,
                background: "var(--card)", cursor: "pointer",
                gap: 6, fontFamily: font, fontWeight: 500, fontSize: 13,
                color: "var(--foreground)",
              }}
            >
              <ExternalLink size={14} style={{ color: "var(--text-secondary)" }} />
              {isUrl ? "Open Link" : "Open"}
            </button>
          )}
          {!isUrl && (
            <button
              onClick={handleDownload}
              className="flex items-center justify-center transition-all hover:opacity-90 active:scale-[0.97]"
              style={{
                height: 36, padding: "0 14px", borderRadius: 8,
                background: "var(--primary)", color: "var(--primary-foreground)",
                cursor: "pointer", gap: 6,
                fontFamily: font, fontWeight: 600, fontSize: 13,
                boxShadow: "0 4px 12px rgba(10,119,255,0.25)",
                border: "none",
              }}
            >
              <Download size={14} />
              Download
            </button>
          )}
        </div>
      </div>

      {/* Inline delete confirm */}
      {onDelete && confirmDelete && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 12200, background: "rgba(0,0,0,0.55)" }}
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="relative flex flex-col"
            style={{ width: "min(400px, calc(100vw - 32px))", background: "var(--card)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex flex-col items-center" style={{ padding: "40px 0 24px", background: "linear-gradient(180deg, hsl(0 93% 94%) 0%, hsla(0,93%,94%,0.3) 70%, transparent 100%)" }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2" style={{ width: "180px", height: "80px", borderRadius: "9999px", filter: "blur(50px)", opacity: 0.25, backgroundColor: "hsl(0 84% 60%)" }} />
              <div className="relative flex items-center justify-center" style={{ width: "64px", height: "64px", borderRadius: "var(--radius-lg)", backgroundColor: "hsl(0 93% 94%)" }}>
                <Trash2 style={{ width: "32px", height: "32px", color: "hsl(0 72% 51%)" }} />
              </div>
              <span className="mt-4" style={{ padding: "4px 12px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600, backgroundColor: "hsl(0 100% 97%)", color: "hsl(0 63% 31%)", textTransform: "none" }}>
                Caution
              </span>
            </div>
            <div className="flex flex-col items-center text-center" style={{ padding: "0 32px 32px" }}>
              <h3 style={{ fontFamily: font, fontSize: "18px", fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em", margin: 0 }}>
                Delete this attachment?
              </h3>
              <p style={{ fontFamily: font, fontSize: "13px", color: "var(--muted-foreground)", marginTop: "8px", lineHeight: 1.65, maxWidth: "300px" }}>
                <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{att.fileName}</span>{" "}will be permanently removed from the system. This action cannot be undone.
              </p>
              <div className="w-full flex flex-col" style={{ marginTop: "28px", gap: "10px" }}>
                <button
                  onClick={() => { setConfirmDelete(false); onClose(); onDelete?.(); }}
                  className="w-full cursor-pointer transition-colors hover:opacity-90"
                  style={{ height: "44px", borderRadius: "var(--radius-lg)", fontFamily: font, fontSize: "14px", fontWeight: 600, backgroundColor: "hsl(0 72% 51%)", color: "#FFFFFF", border: 0 }}
                >
                  Delete Attachment
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="w-full cursor-pointer transition-colors"
                  style={{ height: "44px", borderRadius: "var(--radius-lg)", fontFamily: font, fontSize: "14px", fontWeight: 500, backgroundColor: "var(--surface-secondary)", color: "var(--text-secondary)", border: 0 }}
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
