/**
 * AttachmentCard — Shared thumbnail card component for attachment surfaces.
 * ────────────────────────────────────────────────────────────────────────────
 * Single source of truth for the card UI used in:
 *   - Inventory Detail  -> Attachments tab  (ThumbnailGrid)
 *   - Transaction Detail -> Attachments tab  (Notes & Attachments)
 *   - Transaction Detail -> Serial Units tab (accordion attachment grids)
 *
 * Consumers pass attachment data + optional slots for the source pill
 * and custom file-name rendering (e.g. HighlightText for search).
 *
 * All colours reference design-system CSS variables from /src/styles/theme.css.
 */

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { AttachmentPreviewModal } from "./attachment-preview-modal";
import { DeleteAttachmentDialog } from "./delete-attachment-dialog";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  
  FileQuestion,
  Music,
  Film,
  Play,
  MoreVertical,
  Eye,
  Download,
  Trash2,
  X,
  Box as BoxIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  getFileThumbnail,
  formatAttachmentDate,
  type FileType,
} from "./attachment-config";
import { HighlightText } from "./search-highlight";

const font = "var(--font-inter)";

/* ═══════════════════════════════════════════════════════════════════════════
 * § 1  DOCUMENT PREVIEW
 *   Faux content-line rendering for non-image file types inside the
 *   thumbnail preview area.  Matches the exact visual from the original
 *   Attachments tab `DocumentPreview`.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* Mock content matched to the preview modal so thumbnails feel real. */
const MOCK_DOC_TITLE = (fileName: string) => fileName.replace(/\.[^.]+$/, "");
const MOCK_DOC_META = `Generated on ${new Date().toLocaleDateString()} — Internal document for inventory operations.`;
const MOCK_DOC_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "1. Overview",
    body:
      "This document describes the contents and intent of the attached file. It is provided for in-app preview only; please download the original to access the canonical version with full formatting, embedded objects, and revision history.",
  },
  {
    heading: "2. Scope",
    body:
      "The attached material covers receiving, putaway, cycle counting, and adjustment workflows across all warehouse locations. It supersedes all prior revisions.",
  },
];

const MOCK_SHEET_HEADERS = ["SKU", "Description", "Lot", "Location", "On Hand", "Available"];
const MOCK_SHEET_ROWS: (string | number)[][] = [
  ["WID-1001", "Widget Mk II", "LOT-A24-001", "WH-01 / A-12", 1240, 1160],
  ["WID-1002", "Widget Mk II Pro", "LOT-A24-002", "WH-01 / A-13", 860, 836],
  ["BOLT-22", "Stainless Bolt M8", "LOT-B24-014", "WH-02 / C-04", 5400, 5200],
  ["GASK-09", "Rubber Gasket 2in", "LOT-B24-015", "WH-02 / C-05", 2210, 2210],
  ["CABL-7", "Power Cable 1.5m", "LOT-C24-101", "WH-03 / B-01", 640, 600],
];

export function DocumentPreview({
  type,
  bg,
  color,
  fileName = "",
  previewUrl,
}: {
  type: string;
  bg: string;
  color: string;
  fileName?: string;
  previewUrl?: string | null;
}) {
  const isImage = type === "jpg" || type === "png";
  const isSpreadsheet = type === "xlsx" || type === "csv";
  const isDocLike = type === "pdf" || type === "txt" || type === "docx";
  const isArchive = type === "zip" || type === "rar";
  const isOpaque = type === "exe" || type === "psd" || type === "cad";
  const isAudio = type === "mp3";
  const isVideo = type === "mp4";
  const isPulsing = isArchive || isOpaque;
  // Unified treatment for non-previewable binary files: question-mark icon on pastel blue
  const pulseBg = "var(--primary-50)";
  const pulseColor = "var(--piw-primary)";
  const PulseIcon = FileQuestion;

  /* ── Archive / opaque: pulsing rounded-square icon placeholder ── */
  if (isPulsing) {
    return (
      <div
        className="flex items-center justify-center w-full h-full"
        style={{ background: pulseBg, position: "relative", overflow: "hidden" }}
      >
        <div style={{ position: "relative", width: 44, height: 44 }}>
          <div
            className="animate-ping"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 12,
              background: pulseColor,
              opacity: 0.08,
              animationDuration: "2.4s",
            }}
          />
          <div
            style={{
              position: "relative",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--piw-card)",
              border: "1px solid var(--piw-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)",
            }}
          >
            <PulseIcon size={20} style={{ color: pulseColor, opacity: 0.85 }} />
          </div>
        </div>
      </div>
    );
  }

  /* ── Spreadsheet: scaled-down real top portion ── */
  if (isSpreadsheet) {
    const gridLine = "#E1E3E6";
    const headerBg = "#F8F9FA";
    const headerText = "#5F6368";
    const COLS = ["A", "B", "C", "D", "E", "F", "G"];
    const ROW_COUNT = 14;
    // Sparse, realistic-looking content placed in a few cells (col index → text)
    const ROW_CONTENT: Record<number, Record<number, { text: string; bold?: boolean; size?: number; color?: string }>> = {
      1: { 1: { text: "Users Import Template", bold: true, size: 8, color: "#1f2937" } },
      2: { 1: { text: "Omne ERP   ·   User Access Control Module", size: 5.5, color: "#6b7280" } },
      4: { 1: { text: "Generated: May 2026   ·   17 required / 8 optional", size: 5, color: "#9ca3af" } },
      6: { 1: { text: "QUICK START", bold: true, size: 5.5, color: "#1f6feb" } },
      8: { 1: { text: "Step 1", bold: true, size: 5.5 }, 2: { text: "Go to the Data Entry sheet. Fill in the required fields per row.", size: 5, color: "#374151" } },
      10: { 1: { text: "Step 2", bold: true, size: 5.5 }, 2: { text: "Review the example rows (rows 3-4, highlighted in grey).", size: 5, color: "#374151" } },
      12: { 1: { text: "Step 3", bold: true, size: 5.5 }, 2: { text: "Validate entries before importing into the platform.", size: 5, color: "#374151" } },
    };
    const BAND_ROWS = new Set([6]); // light-blue band row like the screenshot
    return (
      <div
        className="w-full h-full"
        style={{
          background: "white",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            fontFamily: font,
            width: "100%",
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            <col style={{ width: 14 }} />
            {COLS.map((_, i) => (
              <col key={i} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                style={{
                  background: headerBg,
                  border: `1px solid ${gridLine}`,
                  height: 8,
                }}
              />
              {COLS.map((c, i) => (
                <th
                  key={i}
                  style={{
                    background: headerBg,
                    border: `1px solid ${gridLine}`,
                    color: headerText,
                    fontSize: 5,
                    fontWeight: 600,
                    height: 8,
                    padding: 0,
                    textAlign: "center",
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROW_COUNT }).map((_, r) => {
              const rowNum = r + 1;
              const banded = BAND_ROWS.has(rowNum);
              return (
                <tr key={r}>
                  <td
                    style={{
                      background: headerBg,
                      border: `1px solid ${gridLine}`,
                      color: headerText,
                      fontSize: 5,
                      fontWeight: 500,
                      textAlign: "center",
                      padding: 0,
                      height: 10,
                    }}
                  >
                    {rowNum}
                  </td>
                  {COLS.map((_, c) => {
                    const cell = ROW_CONTENT[rowNum]?.[c];
                    return (
                      <td
                        key={c}
                        style={{
                          border: `1px solid ${gridLine}`,
                          background: banded ? "#E8F0FE" : "white",
                          padding: "0 3px",
                          height: 10,
                          fontSize: cell?.size ?? 5,
                          fontWeight: cell?.bold ? 700 : 400,
                          color: cell?.color ?? "#1f2937",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {cell?.text ?? ""}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Soft bottom fade to read as a top-portion preview */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "40%",
            background: "linear-gradient(to bottom, rgba(238,240,243,0) 0%, #EEF0F3 80%)",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  /* ── Document-like (pdf/txt/docx): scaled paper with real top content ── */
  if (isDocLike) {
    return (
      <div
        className="w-full h-full"
        style={{
          background: "white",
          position: "relative",
          overflow: "hidden",
          padding: "10px 12px 0 12px",
          fontFamily: font,
          color: "var(--piw-foreground)",
        }}
      >
        <div
          style={{
            fontSize: 7.5,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: 3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {MOCK_DOC_TITLE(fileName) || "Document"}
        </div>
        <div
          style={{
            fontSize: 5.5,
            color: "#6b7280",
            lineHeight: 1.4,
            marginBottom: 5,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as any,
          }}
        >
          {MOCK_DOC_META}
        </div>
        {MOCK_DOC_SECTIONS.map((s, i) => (
          <div key={i} style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 6, fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>
              {s.heading}
            </div>
            <div
              style={{
                fontSize: 5.5,
                color: "#374151",
                lineHeight: 1.45,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical" as any,
              }}
            >
              {s.body}
            </div>
          </div>
        ))}
        {/* Soft bottom fade to read as a top-portion preview */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "40%",
            background: "linear-gradient(to bottom, rgba(238,240,243,0) 0%, #EEF0F3 80%)",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  /* ── Audio (mp3): pulsing music icon (mirrors archive pattern, orange palette) ── */
  if (isAudio) {
    const audioAccent = "#e65100";
    return (
      <div
        className="flex items-center justify-center w-full h-full"
        style={{
          background: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", width: 44, height: 44 }}>
          <div
            className="animate-ping"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 12,
              background: audioAccent,
              opacity: 0.12,
              animationDuration: "2.4s",
            }}
          />
          <div
            style={{
              position: "relative",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #ffcc80",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)",
            }}
          >
            <Music size={20} style={{ color: audioAccent, opacity: 0.9 }} />
          </div>
        </div>
      </div>
    );
  }

  /* ── Video (mp4): first-frame snapshot, play button appears on hover ── */
  if (isVideo) {
    const videoUrl = previewUrl || undefined;
    return (
      <div
        className="group/video flex items-center justify-center w-full h-full"
        style={{
          background: "#0b0b0d",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {videoUrl ? (
          <video
            src={`${videoUrl}#t=0.1`}
            preload="metadata"
            muted
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              pointerEvents: "none",
            }}
          />
        ) : null}
        <div
          aria-hidden
          className="opacity-0 group-hover/video:opacity-100 transition-opacity duration-200"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.28)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          className="opacity-0 scale-90 group-hover/video:opacity-100 group-hover/video:scale-100 transition-all duration-200"
          style={{
            position: "absolute",
            width: 52,
            height: 52,
            borderRadius: 999,
            background: "rgba(255,255,255,0.96)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
            pointerEvents: "none",
          }}
        >
          <Play size={22} style={{ color: "#0b0b0d", marginLeft: 2 }} fill="#0b0b0d" />
        </div>
      </div>
    );
  }


  /* ── Image-type placeholder (no URL available) ── */
  if (isImage) {
    return (
      <div
        className="flex items-center justify-center w-full h-full"
        style={{ background: bg }}
      >
        <FileImage size={32} style={{ color, opacity: 0.5 }} />
      </div>
    );
  }

  /* ── 3D / CAD (dxf, dwg, stl): pulsing 3D-box icon, mirrors archive pattern ── */
  if (type === "dxf" || type === "dwg" || type === "stl") {
    const accent = "#4F46E5";
    const tint   = "linear-gradient(135deg, #EEF2FF 0%, #DDE3FF 100%)";
    const border = "#C7D2FE";
    return (
      <div
        className="flex items-center justify-center w-full h-full"
        style={{ background: tint, position: "relative", overflow: "hidden" }}
      >
        <div style={{ position: "relative", width: 44, height: 44 }}>
          <div
            className="animate-ping"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 12,
              background: accent,
              opacity: 0.12,
              animationDuration: "2.4s",
            }}
          />
          <div
            style={{
              position: "relative",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#fff",
              border: `1px solid ${border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)",
            }}
          >
            <BoxIcon size={20} style={{ color: accent, opacity: 0.9 }} />
          </div>
        </div>
      </div>
    );
  }

  /* ── Fallback ── */
  return (
    <div
      className="flex items-center justify-center w-full h-full"
      style={{ background: bg }}
    >
      <FileQuestion size={28} style={{ color, opacity: 0.5 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 2  CONSTANTS
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Responsive height for the thumbnail preview area. */
export const THUMB_PREVIEW_H = "clamp(94px, calc(10vw - 6px), 174px)";

/** Grid column spec for thumbnail grids. */
export const THUMB_GRID_COLUMNS = "repeat(auto-fill, minmax(200px, 1fr))";

/* ═══════════════════════════════════════════════════════════════════════════
 * § 3  ATTACHMENT CARD DATA INTERFACE
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Minimal data shape that every consumer must provide.
 * Maps to the union of fields from `Attachment` (attachments-tab)
 * and `GeneratedAttachment` (serial-unit-generator).
 */
export interface AttachmentCardData {
  fileName: string;
  fileType: string;
  fileSize: string;
  uploadedDate: string;
  uploadedTime: string;
  uploadedBy: string;
  /** Optional image preview URL for jpg/png files (local blob or remote URL). */
  previewUrl?: string | null;
  /** Storage object path in the `attachments` bucket. When set, the preview modal
   *  resolves a remote URL from Supabase Storage instead of using `previewUrl`. */
  filePath?: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 4  ATTACHMENT CARD COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════ */

export function AttachmentCard({
  att,
  sourcePill,
  renderFileName,
  searchQuery,
  onPreview,
  onDownload,
  onDelete,
  onCardClick,
  deleteVariant = "menu",
}: {
  att: AttachmentCardData;
  sourcePill?: React.ReactNode;
  renderFileName?: (fileName: string) => React.ReactNode;
  searchQuery?: string;
  /** Called when Preview is clicked. */
  onPreview?: () => void;
  /** Called when Download is clicked. */
  onDownload?: () => void;
  /** Called when Delete is confirmed. If provided, shows Delete in the menu. */
  onDelete?: () => void;
  /** Called when the card itself is clicked (opens preview modal). */
  onCardClick?: () => void;
  /** "menu" (default) shows MoreVertical with Preview/Download/Delete; "inline" shows a floating X delete button on the thumbnail. */
  deleteVariant?: "menu" | "inline";
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const tb = getFileThumbnail(att.fileType);
  const isImageType = att.fileType === "png" || att.fileType === "jpg";
  const hasImagePreview = !!att.previewUrl && !imgError && isImageType;

  /* Position portal menu near button */
  useLayoutEffect(() => {
    if (!menuOpen || !menuBtnRef.current) return;
    const rect = menuBtnRef.current.getBoundingClientRect();
    const menuW = 140;
    setMenuPos({ top: rect.bottom + 4, left: rect.right - menuW });
  }, [menuOpen]);

  /* Close menu on outside click */
  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      const inMenu = menuRef.current && menuRef.current.contains(e.target as Node);
      const inBtn = menuBtnRef.current && menuBtnRef.current.contains(e.target as Node);
      if (!inMenu && !inBtn) setMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <div
      className="relative flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 0,
        borderRadius: "var(--radius-lg)",
        background: "var(--piw-card)",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: hovered ? "var(--primary-200)" : "var(--piw-border)",
        boxShadow: hovered
          ? "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)"
          : "0px 1px 2px 0px rgba(16,24,40,0.04)",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        cursor: "pointer",
      }}
      onClick={(e) => {
        // Ignore clicks that bubble from React portals (e.g. preview modal, menu, delete dialog).
        if (!e.currentTarget.contains(e.target as Node)) return;
        if ((e.target as HTMLElement).closest('[data-menu-area]') || (e.target as HTMLElement).closest('a')) return;
        if (onCardClick) {
          onCardClick();
        } else {
          setShowPreview(true);
        }
      }}
    >
      {/* ── Thumbnail preview area ── */}
      <div
        className="relative shrink-0 w-full"
        style={{
          height: THUMB_PREVIEW_H,
          borderTopLeftRadius: "calc(var(--radius-lg) - 1px)",
          borderTopRightRadius: "calc(var(--radius-lg) - 1px)",
          overflow: "hidden",
          background: tb.bg,
        }}
      >
        {hasImagePreview ? (
          <img
            src={att.previewUrl!}
            alt={att.fileName}
            onError={() => setImgError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : isImageType && !att.previewUrl ? (
          <div
            className="flex items-center justify-center w-full h-full"
            style={{ background: tb.bg }}
          >
            <FileImage
              size={32}
              style={{ color: tb.color, opacity: 0.5 }}
            />
          </div>
        ) : (
          <DocumentPreview
            type={att.fileType}
            bg={tb.bg}
            color={tb.color}
            fileName={att.fileName}
            previewUrl={att.previewUrl}
          />

        )}

        {/* File extension badge — always white with colored text */}
        <span
          className="absolute"
          style={{
            bottom: "var(--spacing-1-5)",
            left: "var(--spacing-1-5)",
            padding: "1px var(--spacing-1)",
            borderRadius: "var(--radius-xs)",
            background: "#FFFFFF",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--piw-border)",
            fontFamily: font,
            fontWeight: "var(--font-weight-semibold)" as any,
            fontSize: "9px",
            color: tb.color,
            letterSpacing: "0.04em",
            textTransform: "uppercase" as const,
            boxShadow: hasImagePreview ? "0 1px 2px rgba(0,0,0,0.18)" : undefined,
            zIndex: 2,
          }}
        >
          {att.fileType.toUpperCase()}
        </span>

        {/* Inline delete (X) button — visible top-right, used when no menu */}
        {deleteVariant === "inline" && onDelete && (
          <button
            type="button"
            data-menu-area
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            aria-label={`Remove ${att.fileName}`}
            className="absolute flex items-center justify-center transition-all"
            style={{
              top: "var(--spacing-1-5)",
              right: "var(--spacing-1-5)",
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "rgba(255,255,255,0.95)",
              border: "1px solid var(--piw-border)",
              cursor: "pointer",
              color: "var(--text-secondary)",
              boxShadow: "0 1px 2px rgba(16,24,40,0.10)",
              zIndex: 2,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "hsl(0 93% 96%)";
              (e.currentTarget as HTMLElement).style.color = "hsl(0 72% 51%)";
              (e.currentTarget as HTMLElement).style.borderColor = "hsl(0 72% 51% / 0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.95)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--piw-border)";
            }}
          >
            <X size={12} />
          </button>
        )}

        {/* Hover overlay for image previews */}
        {hasImagePreview && hovered && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: "rgba(0,0,0,0.25)",
              transition: "opacity 0.15s ease",
              pointerEvents: "none",
            }}
          >
            <Eye
              size={20}
              style={{ color: "var(--piw-primary-foreground)", opacity: 0.9 }}
            />
          </div>
        )}
      </div>

      {/* ── Source pill slot ── */}
      {sourcePill != null && (
        <div style={{ padding: "var(--spacing-1-5) var(--spacing-2) 0" }}>
          {sourcePill}
        </div>
      )}

      {/* ── File name + date + size/uploader + actions ── */}
      <div
        className="flex items-start w-full"
        style={{
          padding: "var(--spacing-1-5) var(--spacing-2) var(--spacing-2)",
          gap: "var(--spacing-1)",
        }}
      >
        <div
          className="flex flex-col flex-1 min-w-0"
          style={{ gap: "var(--spacing-1-5)" }}
        >
          {/* File name */}
          <p
            className="overflow-hidden"
            style={{
              fontFamily: font,
              fontWeight: "var(--font-weight-medium)" as any,
              fontSize: "var(--text-body-sm)",
              color: "var(--piw-foreground)",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              margin: 0,
              lineHeight: 1.3,
            }}
            title={att.fileName}
          >
            {renderFileName
              ? renderFileName(att.fileName)
              : searchQuery
                ? <HighlightText text={att.fileName} query={searchQuery} />
                : att.fileName}
          </p>

          {/* Date + size/uploader — inline variant shows just file size for a cleaner upload preview. */}
          <div className="flex flex-col" style={{ gap: "1px" }}>
            {deleteVariant !== "inline" && (
              <p
                className="overflow-hidden"
                style={{
                  fontFamily: font,
                  fontWeight: "var(--font-weight-normal)" as any,
                  fontSize: "var(--text-caption)",
                  color: "var(--text-tertiary)",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {formatAttachmentDate(att.uploadedDate, att.uploadedTime)}
              </p>
            )}
            <p
              className="overflow-hidden"
              style={{
                fontFamily: font,
                fontWeight: "var(--font-weight-normal)" as any,
                fontSize: "var(--text-caption)",
                color: "var(--text-tertiary)",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {deleteVariant === "inline"
                ? att.fileSize
                : <>{att.fileSize} · {searchQuery ? <HighlightText text={att.uploadedBy} query={searchQuery} /> : att.uploadedBy}</>}
            </p>
          </div>
        </div>



        {/* More-vert context menu — hidden when using inline X delete */}
        {deleteVariant !== "inline" && (
        <div
          data-menu-area
          ref={menuRef}
          className="relative shrink-0"
          style={{ marginTop: "1px" }}
        >
          <button
            ref={menuBtnRef}
            onClick={() => setMenuOpen((p) => !p)}
            className="flex items-center justify-center"
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "var(--radius-xs)",
              cursor: "pointer",
              borderWidth: "0px",
              borderStyle: "solid",
              borderColor: "transparent",
              background: "transparent",
              opacity: hovered || menuOpen ? 1 : 0,
              transition: "opacity 0.12s ease, background-color 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(210,100%,96%)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <MoreVertical
              size={14}
              style={{ color: "var(--text-secondary)" }}
            />
          </button>
          {menuOpen && createPortal(
            <div
              ref={menuRef}
              data-menu-area
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                zIndex: 10000,
                minWidth: "140px",
                borderRadius: "var(--radius-md)",
                background: "var(--piw-card)",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "var(--piw-border)",
                boxShadow: "var(--elevation-card)",
                padding: "var(--spacing-1)",
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Preview */}
              <button
                className="flex items-center w-full"
                style={{
                  height: "30px",
                  padding: "0 var(--spacing-2)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  border: "none",
                  background: "transparent",
                  gap: "var(--spacing-1-5)",
                  fontFamily: font,
                  fontWeight: "var(--font-weight-medium)" as any,
                  fontSize: "var(--text-caption)",
                  color: "var(--piw-foreground)",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(210,100%,96%)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                onClick={() => { setMenuOpen(false); if (onPreview) { onPreview(); } else { setShowPreview(true); } }}
              >
                <Eye size={13} style={{ color: "var(--text-secondary)" }} />
                Preview
              </button>
              {/* Download */}
              <button
                className="flex items-center w-full"
                style={{
                  height: "30px",
                  padding: "0 var(--spacing-2)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  border: "none",
                  background: "transparent",
                  gap: "var(--spacing-1-5)",
                  fontFamily: font,
                  fontWeight: "var(--font-weight-medium)" as any,
                  fontSize: "var(--text-caption)",
                  color: "var(--piw-foreground)",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(210,100%,96%)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                onClick={() => { setMenuOpen(false); onDownload?.(); }}
              >
                <Download size={13} style={{ color: "var(--text-secondary)" }} />
                Download
              </button>
              {/* Delete — only if onDelete provided */}
              {onDelete && (
                <>
                  <div style={{ height: 1, background: "var(--piw-border)", margin: "var(--spacing-1) 0" }} />
                  <button
                    className="flex items-center w-full"
                    style={{
                      height: "30px",
                      padding: "0 var(--spacing-2)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      border: "none",
                      background: "transparent",
                      gap: "var(--spacing-1-5)",
                      fontFamily: font,
                      fontWeight: "var(--font-weight-medium)" as any,
                      fontSize: "var(--text-caption)",
                      color: "hsl(0 72% 51%)",
                      transition: "background-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(0 93% 96%)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    onClick={() => { setMenuOpen(false); setDeleteDialogOpen(true); }}
                  >
                    <Trash2 size={13} style={{ color: "hsl(0 72% 51%)" }} />
                    Delete
                  </button>
                </>
              )}
            </div>,
            document.body
          )}
        </div>
        )}
      </div>

      {/* ── Delete Confirmation Dialog (shared) ── */}
      <DeleteAttachmentDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        fileName={att.fileName}
        onConfirm={() => onDelete?.()}
      />

      {/* Built-in preview modal */}
      {showPreview && (
        <AttachmentPreviewModal
          attachment={att}
          onClose={() => setShowPreview(false)}
          onDelete={onDelete ? () => onDelete() : undefined}
          immediateDelete={deleteVariant === "inline"}
        />
      )}
    </div>
  );
}