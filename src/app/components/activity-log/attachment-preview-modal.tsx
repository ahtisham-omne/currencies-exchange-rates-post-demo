/**
 * AttachmentPreviewModal — ported from items-v2's attachments module
 * (attachment-preview-modal.tsx), ERP's own full-screen file preview.
 * Dropped on the way in: DeleteAttachmentDialog (no delete button is ever
 * mounted here — see below), the CAD viewers (dxf/stl — no CAD file
 * reaches a warehouse activity log), and the Supabase storage URL
 * resolution (this prototype has no storage bucket; a file renders from
 * `previewUrl` or falls back to its type icon).
 *
 * NO DELETE: this modal is mounted with no onDelete prop, which is
 * deliberate, not an oversight — the activity log is a record of what
 * happened, so nothing opened from inside it should be destructible from
 * inside it, least of all a file whose addition or removal is the very
 * event being read. The footer keeps Download alone, filled and primary.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  File as FileIcon,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Maximize2,
  Minimize2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { LOG_TODAY } from "./date-range-field";

export interface AttachmentPreviewData {
  fileName: string;
  /** Uppercase extension, derived by the caller the same way the inline
   * chip tile derives it — never stored. */
  fileType: string;
  fileSize: string;
  uploadedBy: string;
  uploadedDate: string;
  uploadedTime: string;
  /** "Warehouse WH-1001" — names where this file lives, the same segment
   * Item Library's own header line ends on. */
  source: string;
  /** A real URL only for the image case in this prototype (a generated
   * placeholder) — everything else (sheet/text/pdf) renders synthetic
   * mock content regardless, same as the source component. */
  previewUrl?: string | null;
}

const FILE_TYPE_ICON: Record<string, typeof FileText> = {
  PDF: FileText,
  DOC: FileText,
  DOCX: FileText,
  TXT: FileText,
  PNG: FileImage,
  JPG: FileImage,
  JPEG: FileImage,
  XLSX: FileSpreadsheet,
  XLS: FileSpreadsheet,
  CSV: FileSpreadsheet,
  ZIP: FileArchive,
  RAR: FileArchive,
};
const FILE_TYPE_TOKEN: Record<string, "pdf" | "doc" | "image" | "sheet" | "archive"> = {
  PDF: "pdf",
  DOC: "doc",
  DOCX: "doc",
  TXT: "doc",
  PNG: "image",
  JPG: "image",
  JPEG: "image",
  XLSX: "sheet",
  XLS: "sheet",
  CSV: "sheet",
  ZIP: "archive",
  RAR: "archive",
};

function fileTile(ext: string): { bg: string; color: string } {
  const token = FILE_TYPE_TOKEN[ext] ?? "other";
  return { bg: `var(--file-${token}-bg, var(--muted))`, color: `var(--file-${token}, var(--muted-foreground))` };
}

function LargeFileIcon({ ext, color }: { ext: string; color: string }) {
  const Icon = FILE_TYPE_ICON[ext] ?? FileIcon;
  return <Icon size={88} style={{ color, opacity: 0.55 }} />;
}

// zip/rar carry no in-app preview at all — not even the mock placeholders
// the other types get.
function isUnpreviewable(ext: string): boolean {
  return ext === "ZIP" || ext === "RAR";
}

function ToolbarBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex cursor-pointer items-center justify-center text-white transition-colors hover:bg-white/15"
      style={{ width: 30, height: 30, borderRadius: 999 }}
    >
      {children}
    </button>
  );
}

/** Zoomable image viewer — zoom via +/-/fit controls; panning is native
 * scroll (overflow:auto) on the enlarged image, not a custom drag
 * handler, same as the source component. */
function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const min = 0.25;
  const max = 4;
  return (
    <div className="relative size-full" style={{ background: "#0b0b0d" }}>
      <div className="absolute inset-0 flex items-center justify-center overflow-auto">
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
        className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-1.5 py-1"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <ToolbarBtn label="Zoom out" onClick={() => setScale((s) => Math.max(min, +(s - 0.25).toFixed(2)))}>
          <ZoomOut size={15} />
        </ToolbarBtn>
        <div className="px-2 text-[11px] text-white/85 tabular-nums" style={{ minWidth: 44, textAlign: "center" }}>
          {Math.round(scale * 100)}%
        </div>
        <ToolbarBtn label="Zoom in" onClick={() => setScale((s) => Math.min(max, +(s + 0.25).toFixed(2)))}>
          <ZoomIn size={15} />
        </ToolbarBtn>
        <div className="mx-1 h-4 w-px" style={{ background: "rgba(255,255,255,0.18)" }} />
        <ToolbarBtn label="Fit to screen" onClick={() => setScale(1)}>
          <Maximize2 size={14} />
        </ToolbarBtn>
      </div>
    </div>
  );
}

/** "Paginated" here means: pageCount stacked paper sheets, each showing
 * the same mock content, with a Page N of M footer once there's more than
 * one — not real pagination of real file content, since nothing in this
 * prototype has any. */
function TextDocumentViewer({ content, pageCount = 1 }: { content: string; pageCount?: number }) {
  const pages = Array.from({ length: Math.max(1, pageCount) });
  return (
    <div className="size-full overflow-auto" style={{ background: "#EEF0F3", padding: 24 }}>
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
              <div style={{ position: "absolute", bottom: 18, right: 24, fontSize: 11, color: "var(--muted-foreground)" }}>
                Page {idx + 1} of {pageCount}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Excel-like grid — lettered columns, numbered rows, a sticky header —
 * always mock content, same as the source component (the sheet viewer
 * never reads the real uploaded file either). */
function SpreadsheetViewer({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  const cols = headers.length;
  const letter = (i: number) => String.fromCharCode(65 + i);
  const cellBorder = "1px solid #E1E3E6";
  return (
    <div className="size-full overflow-auto" style={{ background: "#F6F7F9" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 12, color: "var(--foreground)", minWidth: "100%" }}>
        <thead>
          <tr>
            <th style={{ position: "sticky", top: 0, left: 0, zIndex: 3, width: 40, minWidth: 40, background: "#E8EAED", borderRight: cellBorder, borderBottom: cellBorder, height: 22 }} />
            {Array.from({ length: cols }).map((_, i) => (
              <th
                key={`L${i}`}
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  background: "#E8EAED",
                  borderRight: cellBorder,
                  borderBottom: cellBorder,
                  fontWeight: 500,
                  color: "#5F6368",
                  height: 22,
                  minWidth: 120,
                  padding: "0 8px",
                  textAlign: "center",
                }}
              >
                {letter(i)}
              </th>
            ))}
          </tr>
          <tr>
            <th style={{ position: "sticky", left: 0, zIndex: 2, background: "#E8EAED", color: "#5F6368", borderRight: cellBorder, borderBottom: cellBorder, width: 40, fontWeight: 500, height: 28, textAlign: "center" }}>1</th>
            {headers.map((h, i) => (
              <td key={`H${i}`} style={{ background: "white", borderRight: cellBorder, borderBottom: cellBorder, padding: "6px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>
                {h}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              <th style={{ position: "sticky", left: 0, zIndex: 1, background: "#E8EAED", color: "#5F6368", borderRight: cellBorder, borderBottom: cellBorder, fontWeight: 500, width: 40, height: 28, textAlign: "center" }}>
                {r + 2}
              </th>
              {row.map((cell, c) => (
                <td
                  key={c}
                  style={{
                    background: "white",
                    borderRight: cellBorder,
                    borderBottom: cellBorder,
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
              <th style={{ position: "sticky", left: 0, zIndex: 1, background: "#E8EAED", color: "#5F6368", borderRight: cellBorder, borderBottom: cellBorder, fontWeight: 500, width: 40, height: 28, textAlign: "center" }}>
                {rows.length + 2 + r}
              </th>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} style={{ background: "white", borderRight: cellBorder, borderBottom: cellBorder, height: 28, minWidth: 120 }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useMockTextContent(fileName: string): string {
  return useMemo(() => {
    const paragraphs = [
      fileName.replace(/\.[^.]+$/, ""),
      `Generated on ${new Date(LOG_TODAY).toLocaleDateString()} — internal operations document.`,
      "1. Overview\n\nThis document describes the contents and intent of the attached file. It is provided for in-app preview only; download the original to access the canonical version with full formatting, embedded objects, and revision history.",
      "2. Scope\n\nThe attached material covers the procedures, controls, and compliance requirements that apply to this record. It supersedes all prior revisions.",
      "3. Responsibilities\n\n• Team leads are responsible for day-to-day compliance.\n• Operations managers approve exceptions above threshold.\n• Facilities reconciles inspection findings against the maintenance log.",
      "4. Procedure\n\nUpon receipt, file the record against the relevant location or asset. Route any flagged items to the designated follow-up owner within one business day.",
      "5. References\n\nSee related permits, certificates, and inspection reports in this record's own attachment history. For questions, contact facilities support.",
      "— End of preview —",
    ];
    return paragraphs.join("\n\n");
  }, [fileName]);
}

function useMockSheetContent(): { headers: string[]; rows: (string | number)[][] } {
  return useMemo(() => {
    const headers = ["Reference", "Description", "Category", "Quantity", "Reserved", "Available", "UoM", "Last Updated", "Owner", "Notes"];
    const rows: (string | number)[][] = [
      ["REF-1001", "Standard pallet racking, bay A", "Storage", 480, 360, 120, "Each", "10/22/2026", "S. Chen", "—"],
      ["REF-1002", "Standard pallet racking, bay B", "Storage", 480, 210, 270, "Each", "10/21/2026", "S. Chen", "—"],
      ["REF-1003", "Narrow-aisle racking, bay C", "Storage", 320, 320, 0, "Each", "10/19/2026", "M. Patel", "At capacity"],
      ["REF-1004", "Narrow-aisle racking, bay D", "Storage", 320, 90, 230, "Each", "10/18/2026", "M. Patel", "—"],
      ["REF-1005", "Outdoor staging", "Staging", 60, 22, 38, "Each", "10/17/2026", "A. Nguyen", "—"],
      ["REF-1006", "Temperature-controlled room", "Storage", 200, 140, 60, "Each", "10/17/2026", "A. Nguyen", "Temp-controlled"],
    ];
    return { headers, rows };
  }, []);
}

/** A tiny deterministic SVG placeholder for the image case — this
 * prototype has no real uploaded files, so an image chip gets a generated
 * swatch (hashed colour + filename) instead of leaving the viewer with
 * nothing to show. */
function placeholderImageDataUri(fileName: string): string {
  let h = 0;
  for (let i = 0; i < fileName.length; i++) h = (h * 31 + fileName.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="hsl(${hue},45%,38%)"/><text x="50%" y="52%" font-family="Inter,sans-serif" font-size="40" fill="white" text-anchor="middle" opacity="0.9">${fileName}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function formatMetaLine(a: AttachmentPreviewData): string {
  return [a.fileType, a.fileSize, a.uploadedBy, `${a.uploadedDate} ${a.uploadedTime}`, a.source].join(" · ");
}

export function AttachmentPreviewModal({ attachment, onClose }: { attachment: AttachmentPreviewData; onClose: () => void }) {
  const [isFullView, setIsFullView] = useState(false);
  const ext = attachment.fileType;
  const tile = fileTile(ext);

  const unpreviewable = isUnpreviewable(ext);
  const previewSrc = ext === "PNG" || ext === "JPG" || ext === "JPEG" ? (attachment.previewUrl ?? placeholderImageDataUri(attachment.fileName)) : null;
  const isImage = !!previewSrc && !unpreviewable;
  const isSheet = (ext === "XLSX" || ext === "XLS" || ext === "CSV") && !unpreviewable;
  const isText = !unpreviewable && !isImage && !isSheet;

  const pdfPageCount = useMemo(() => {
    if (ext !== "PDF") return 1;
    let h = 0;
    for (let i = 0; i < attachment.fileName.length; i++) h = (h * 31 + attachment.fileName.charCodeAt(i)) | 0;
    return [3, 4, 6, 2, 5][Math.abs(h) % 5];
  }, [attachment.fileName, ext]);

  const textContent = useMockTextContent(attachment.fileName);
  const sheetContent = useMockSheetContent();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleDownload = useCallback(() => {
    const blob = new Blob([previewSrc ? "" : textContent], { type: previewSrc ? "image/svg+xml" : "text/plain" });
    const url = previewSrc ?? URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (!previewSrc) URL.revokeObjectURL(url);
  }, [previewSrc, attachment.fileName, textContent]);

  const easing = "cubic-bezier(0.32, 0.72, 0, 1)";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)", padding: isFullView ? 0 : 24, transition: `padding 320ms ${easing}` }}
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${attachment.fileName}`}
    >
      {/* Portalled to body, so it carries the log's own tokens: the header
       * and footer read var(--card), which a host with bare-number tokens
       * cannot resolve (they went transparent in Items). */}
      <div
        className="activity-log-portal relative flex flex-col overflow-hidden"
        style={{
          width: isFullView ? "100vw" : "min(1200px, 100%)",
          height: isFullView ? "100vh" : "min(820px, 100%)",
          borderRadius: isFullView ? 0 : "var(--radius-lg)",
          background: "var(--card)",
          boxShadow: "0 32px 96px -16px rgba(0,0,0,0.45)",
          transition: `width 320ms ${easing}, height 320ms ${easing}, border-radius 320ms ${easing}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ Header ═══ */}
        <div className="flex shrink-0 items-center justify-between border-b" style={{ padding: "12px 16px", borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="flex min-w-0 items-center" style={{ gap: 12 }}>
            <div className="flex shrink-0 items-center justify-center" style={{ width: 36, height: 36, borderRadius: 8, background: tile.bg, color: tile.color }}>
              <LargeFileIconSmall ext={ext} color={tile.color} />
            </div>
            <div className="min-w-0">
              <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.25 }} title={attachment.fileName}>
                {attachment.fileName}
              </div>
              <div className="truncate" style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                {formatMetaLine(attachment)}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center" style={{ gap: 6, marginLeft: 12 }}>
            <button
              type="button"
              onClick={() => setIsFullView((v) => !v)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-foreground transition-all hover:bg-muted"
              style={{ fontWeight: 500 }}
              aria-label={isFullView ? "Exit full view" : "Full view"}
            >
              {isFullView ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              {isFullView ? "Exit full" : "Full view"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex cursor-pointer items-center justify-center border-none bg-transparent transition-colors hover:bg-muted"
              style={{ width: 36, height: 36, borderRadius: 8 }}
              aria-label="Close preview"
            >
              <X size={16} style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>
        </div>

        {/* ═══ Preview surface ═══ */}
        <div className="min-h-0 flex-1">
          {unpreviewable ? (
            <div className="flex size-full flex-col items-center justify-center" style={{ padding: "32px 16px", color: "var(--muted-foreground)" }}>
              <LargeFileIcon ext={ext} color="var(--muted-foreground)" />
              <p style={{ marginTop: 16, fontSize: 13 }}>Preview unavailable for .{ext.toLowerCase()} files.</p>
            </div>
          ) : isImage ? (
            <ImageViewer src={previewSrc!} alt={attachment.fileName} />
          ) : isSheet ? (
            <SpreadsheetViewer headers={sheetContent.headers} rows={sheetContent.rows} />
          ) : isText ? (
            <TextDocumentViewer content={textContent} pageCount={ext === "PDF" ? pdfPageCount : 1} />
          ) : (
            <div className="flex size-full flex-col items-center justify-center" style={{ color: "var(--muted-foreground)" }}>
              <LargeFileIcon ext={ext} color="var(--muted-foreground)" />
              <p style={{ marginTop: 16, fontSize: 13 }}>Preview is not available for this file type.</p>
            </div>
          )}
        </div>

        {/* ═══ Footer — Download only, no Delete: see file header note ═══ */}
        <div className="flex shrink-0 items-center border-t" style={{ padding: "12px 16px", borderColor: "var(--border)", background: "var(--card)", gap: 8 }}>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={handleDownload}
            className="flex cursor-pointer items-center justify-center border-none transition-all hover:opacity-90"
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 8,
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              gap: 6,
              fontWeight: 600,
              fontSize: 13,
              boxShadow: "0 4px 12px rgba(10,119,255,0.25)",
            }}
          >
            <Download size={14} />
            Download
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LargeFileIconSmall({ ext, color }: { ext: string; color: string }) {
  const Icon = FILE_TYPE_ICON[ext] ?? FileIcon;
  return <Icon size={18} style={{ color }} />;
}
