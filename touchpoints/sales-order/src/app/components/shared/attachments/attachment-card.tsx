/**
 * AttachmentCard, shared thumbnail card component for attachment surfaces.
 * Mirrors the Physical Inventory PI-8 pattern.
 *
 *   - Type-specific thumbnails (docs render the top of a paper, spreadsheets
 *     render the top-left of Sheet 1, images render the image, archives /
 *     binaries render a subtly-pulsing placeholder, audio gets a pulsing
 *     music-icon thumbnail, video shows a first-frame snapshot with a
 *     play-button hover overlay, 3D CAD types get a pulsing 3D-box icon).
 *   - Extension badge sits in the BOTTOM-LEFT of the thumbnail, white bg,
 *     1px solid var(--border), border-radius var(--radius-xs), 9px semibold
 *     uppercase.
 *   - "pills" slot renders between the thumbnail and the file-info section
 *     (line-item, source, item-master provenance, etc.).
 *   - Hover state: border var(--border) -> var(--primary-200); shadow ->
 *     var(--elevation-card). Transition: border-color 0.15s ease,
 *     box-shadow 0.15s ease.
 *
 * Used in:
 *   - Attachments tab (grid + folder views)
 *   - Deal Information, RFP/RFQ carousel
 *   - Line-Item Configurator, Attachments + Gallery tabs
 */

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Checkbox } from "@/app/components/ui/checkbox";
import { XCircle } from "lucide-react";
import {
  FileImage,
  FileQuestion,
  Music,
  Film,
  Play,
  Link2,
  Video,
  MoreVertical,
  Eye,
  EyeOff,
  Download,
  Trash2,
  ExternalLink,
  X,
  Box as BoxIcon,
} from "lucide-react";
import { getFileThumbnail, formatAttachmentDate } from "./attachment-config";

const font = "var(--font-inter)";

/* ═══════════════════════════════════════════════════════════════════════════
 * § 1  DOCUMENT PREVIEW
 *   Faux content rendering used inside the thumbnail preview area when the
 *   consumer does not provide a `previewUrl`. Matches the Physical Inventory
 *   PI-8 pattern: realistic top-of-document / top-of-sheet snapshots, with
 *   subtle pulse animations for archives / opaque binary file types, plus
 *   audio / video / 3D thumbnails.
 * ═══════════════════════════════════════════════════════════════════════════ */

const MOCK_DOC_TITLE = (fileName: string) => fileName.replace(/\.[^.]+$/, "");
const MOCK_DOC_META = `Generated on ${new Date().toLocaleDateString()}, internal document.`;
const MOCK_DOC_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "1. Overview",
    body:
      "This document describes the contents and intent of the attached file. It is provided for in-app preview only; please download the original to access the canonical version with full formatting, embedded objects, and revision history.",
  },
  {
    heading: "2. Scope",
    body:
      "The attached material covers the relevant scope of work for this quote. It supersedes all prior revisions distributed to the customer.",
  },
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
  const is3D = type === "dxf" || type === "dwg" || type === "stl";
  const isUrl = type === "url";
  const isPulsing = isArchive || isOpaque;

  /* ── URL / link preview ── */
  if (isUrl) {
    return (
      <div className="flex items-center justify-center w-full h-full" style={{ background: bg }}>
        <Link2 size={32} style={{ color, opacity: 0.6 }} />
      </div>
    );
  }

  /* ── Archive / opaque: pulsing rounded-square icon placeholder ── */
  if (isPulsing) {
    return (
      <div
        className="flex items-center justify-center w-full h-full"
        style={{ background: "var(--primary-50)", position: "relative", overflow: "hidden" }}
      >
        <div style={{ position: "relative", width: 44, height: 44 }}>
          <div
            className="animate-ping"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 12,
              background: "var(--primary)",
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
              background: "var(--card)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)",
            }}
          >
            <FileQuestion size={20} style={{ color: "var(--primary)", opacity: 0.85 }} />
          </div>
        </div>
      </div>
    );
  }

  /* ── Spreadsheet: scaled-down real top-left of Sheet 1 ── */
  if (isSpreadsheet) {
    const gridLine = "#E1E3E6";
    const headerBg = "#F8F9FA";
    const headerText = "#5F6368";
    const COLS = ["A", "B", "C", "D", "E", "F", "G"];
    const ROW_COUNT = 14;
    const ROW_CONTENT: Record<number, Record<number, { text: string; bold?: boolean; size?: number; color?: string }>> = {
      1: { 1: { text: "Quote Line Items", bold: true, size: 8, color: "#1f2937" } },
      2: { 1: { text: "Workbook, Sales Quote Workbook", size: 5.5, color: "#6b7280" } },
      4: { 1: { text: "Generated: " + new Date().toLocaleDateString(), size: 5, color: "#9ca3af" } },
      6: { 1: { text: "SUMMARY", bold: true, size: 5.5, color: "#1f6feb" } },
      8:  { 1: { text: "Item",  bold: true, size: 5.5 }, 2: { text: "Qty", bold: true, size: 5.5 }, 3: { text: "Price", bold: true, size: 5.5 } },
      9:  { 1: { text: "WID-1001", size: 5 }, 2: { text: "10", size: 5 }, 3: { text: "$125.00", size: 5 } },
      10: { 1: { text: "WID-1002", size: 5 }, 2: { text: "6",  size: 5 }, 3: { text: "$182.00", size: 5 } },
      11: { 1: { text: "BOLT-22",  size: 5 }, 2: { text: "40", size: 5 }, 3: { text: "$4.20",   size: 5 } },
      12: { 1: { text: "GASK-09",  size: 5 }, 2: { text: "12", size: 5 }, 3: { text: "$11.00",  size: 5 } },
    };
    const BAND_ROWS = new Set([6]);
    return (
      <div className="w-full h-full" style={{ background: "white", position: "relative", overflow: "hidden" }}>
        <table
          style={{ borderCollapse: "collapse", fontFamily: font, width: "100%", tableLayout: "fixed" }}
        >
          <colgroup>
            <col style={{ width: 14 }} />
            {COLS.map((_, i) => <col key={i} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ background: headerBg, border: `1px solid ${gridLine}`, height: 8 }} />
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
          color: "var(--foreground)",
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

  /* ── Audio (mp3): pulsing music-icon thumbnail on orange gradient ── */
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
        ) : (
          <Video size={32} style={{ color: "#FFFFFF", opacity: 0.55 }} />
        )}
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

  /* ── 3D / CAD (dxf, dwg, stl): pulsing 3D-box icon, indigo gradient ── */
  if (is3D) {
    const accent = "#4F46E5";
    const tint   = "linear-gradient(135deg, #EEF2FF 0%, #DDE3FF 100%)";
    const borderCol = "#C7D2FE";
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
              border: `1px solid ${borderCol}`,
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

  /* ── Image-type placeholder (no URL available) ── */
  if (isImage) {
    return (
      <div className="flex items-center justify-center w-full h-full" style={{ background: bg }}>
        <FileImage size={32} style={{ color, opacity: 0.5 }} />
      </div>
    );
  }

  /* ── Fallback ── */
  return (
    <div className="flex items-center justify-center w-full h-full" style={{ background: bg }}>
      <FileQuestion size={28} style={{ color, opacity: 0.5 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 2  CONSTANTS & DATA INTERFACES
 * ═══════════════════════════════════════════════════════════════════════════ */

export const THUMB_PREVIEW_H = "clamp(94px, calc(10vw - 6px), 174px)";
export const THUMB_GRID_COLUMNS = "repeat(auto-fill, minmax(200px, 1fr))";

export interface AttachmentCardData {
  fileName: string;
  fileType: string;
  fileSize: string;
  uploadedDate: string;
  uploadedTime: string;
  uploadedBy: string;
  previewUrl?: string | null;
  externalUrl?: string;
}

export interface AttachmentCardMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 3  ATTACHMENT CARD
 * ═══════════════════════════════════════════════════════════════════════════ */

export function AttachmentCard({
  att,
  pills,
  renderFileName,
  onPreview,
  onDownload,
  onDelete,
  onCardClick,
  extraMenuItems,
  removeScopeLabel,
  deleteDivider = true,
  selection,
  inclusionToggle,
  compact,
  thumbHeight,
  deleteVariant = "menu",
}: {
  att: AttachmentCardData;
  /** Pills rendered in a dedicated row between the thumbnail and file info. */
  pills?: React.ReactNode;
  renderFileName?: (fileName: string) => React.ReactNode;
  onPreview?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onCardClick?: () => void;
  extraMenuItems?: AttachmentCardMenuItem[];
  /** Recasts the destructive menu action as a "remove from <scope>"
   *  instead of a delete, matching the Purchase Order configurator's
   *  "Remove from PO". Use it for files the module holds a copy of
   *  rather than the only copy: removing them takes the file off this
   *  record without destroying anything the user cannot get back.
   *  Supply the scope word only, e.g. "Order" or "Quote". */
  removeScopeLabel?: string;
  /** Separator above the Delete / Remove item. Off for short menus (e.g.
   *  item master files in a line item: Preview, Download, Remove). */
  deleteDivider?: boolean;
  /** Opt-in bulk-selection affordance. When supplied the card shows a
   *  checkbox in its top-left corner, tints its border/ring while
   *  checked, and a click anywhere on the card toggles selection instead
   *  of opening the preview (matching the Purchase Order configurator).
   *  Surfaces that do not pass this behave exactly as before. */
  selection?: {
    checked: boolean;
    onToggle: () => void;
  };
  /** PDF-inclusion toggle. No Quote/SO surface passes this any more:
   *  every attachment travels with the PDF, so there is nothing to opt
   *  in or out of, and the user writes any explicit callout into the
   *  instructions instead. Kept only so this card stays a drop-in match
   *  for its Physical Inventory source. Do not wire it back up without
   *  that decision being revisited. */
  inclusionToggle?: {
    included: boolean;
    showLabel: string;
    hideLabel: string;
    onToggle: () => void;
  };
  compact?: boolean;
  /** Thumbnail height. Surfaces with a Card Size control pass the height
   *  for the chosen size, the way the Purchase Order card does; anything
   *  without one leaves it unset and keeps the fixed height below. */
  thumbHeight?: string;
  /** "menu" (default) shows MoreVertical + dropdown; "inline" shows a floating X delete button on the thumbnail. */
  deleteVariant?: "menu" | "inline";
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const tb = getFileThumbnail(att.fileType);
  const isImageType = att.fileType === "png" || att.fileType === "jpg";
  const hasImagePreview = !!att.previewUrl && !imgError && isImageType;
  const isUrl = att.fileType === "url";

  useLayoutEffect(() => {
    if (!menuOpen || !menuBtnRef.current) return;
    const rect = menuBtnRef.current.getBoundingClientRect();
    const menuW = 180;
    const estimatedH = 240;
    const margin = 8;
    const viewportH = window.innerHeight;
    const top = (rect.bottom + estimatedH + margin > viewportH)
      ? Math.max(margin, rect.top - estimatedH - 4)
      : rect.bottom + 4;
    setMenuPos({ top, left: Math.max(margin, rect.right - menuW) });
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menuOpen || !menuRef.current || !menuBtnRef.current) return;
    const menuEl = menuRef.current;
    const btnRect = menuBtnRef.current.getBoundingClientRect();
    const menuRect = menuEl.getBoundingClientRect();
    const margin = 8;
    const viewportH = window.innerHeight;
    const wouldOverflowBelow = btnRect.bottom + menuRect.height + margin > viewportH;
    const correctTop = wouldOverflowBelow
      ? Math.max(margin, btnRect.top - menuRect.height - 4)
      : btnRect.bottom + 4;
    if (Math.abs(correctTop - menuRect.top) > 1) {
      setMenuPos((p) => ({ ...p, top: correctTop }));
    }
  }, [menuOpen, menuPos.top]);

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

  const previewH = thumbHeight ?? (compact ? "clamp(80px, 8vw, 120px)" : THUMB_PREVIEW_H);

  return (
    <div
      className="relative flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 0,
        borderRadius: "var(--radius-lg)",
        /* Selection reads as a ring, not a tint — the Purchase Order
           card's treatment: the border turns primary and a 1px primary
           ring doubles it, while the card surface stays white. A tinted
           fill had two problems a ring does not: it changed the ground
           every thumbnail and pill sat against, and at 30% accent it was
           easy to miss on a card whose thumbnail already fills most of
           the frame. Selected beats hover, so a selected card keeps its
           ring while the pointer crosses it. */
        background: "var(--card)",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: selection?.checked
          ? "var(--primary)"
          : hovered
          ? "var(--primary-200)"
          : "var(--border)",
        boxShadow: selection?.checked
          ? "0 0 0 1px var(--primary), 0px 1px 2px 0px rgba(16,24,40,0.04)"
          : hovered
          ? "var(--elevation-card)"
          : "0px 1px 2px 0px rgba(16,24,40,0.04)",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        cursor: "pointer",
      }}
      onClick={(e) => {
        // Ignore clicks bubbling from React portals (preview modal, menu, delete dialog).
        if (!e.currentTarget.contains(e.target as Node)) return;
        if ((e.target as HTMLElement).closest("[data-menu-area]") || (e.target as HTMLElement).closest("a") || (e.target as HTMLElement).closest("button[data-action]")) return;
        if ((e.target as HTMLElement).closest("[data-select-toggle]")) return;
        /* While selecting, the card is a checkbox target, not a preview
           trigger. Same trade the PO configurator makes: picking many
           files quickly matters more than one-click preview, and preview
           is still one menu item away. */
        if (selection) { selection.onToggle(); return; }
        onCardClick?.();
      }}
    >
      {/* Bulk-selection checkbox, top-left over the thumbnail.
          Still the shared Checkbox primitive, at the size and elevation
          the Purchase Order configurator gives it: 20px instead of 16,
          a 1.5px border, and a real drop shadow. A card checkbox sits on
          top of a photo rather than in a form row, so it needs to hold
          its own edge against whatever is behind it; the extra weight is
          what makes it readable over a dark thumbnail. Colour still
          comes from the primitive, so checked is `--primary` here as
          everywhere else.

          The wrapper carries NO click handler: the Checkbox already
          toggles, and a handler here would fire on the same bubbling
          click and toggle a second time, cancelling it out.
          `data-select-toggle` is what stops the card's own click handler
          from adding a third toggle. */}
      {selection && (
        <span
          data-select-toggle
          className="absolute"
          style={{ top: "var(--spacing-1-5)", left: "var(--spacing-1-5)", zIndex: 3, lineHeight: 0 }}
        >
          <Checkbox
            checked={selection.checked}
            onCheckedChange={() => selection.onToggle()}
            aria-label={selection.checked ? `Unselect ${att.fileName}` : `Select ${att.fileName}`}
            className="size-5 [&_svg]:size-3"
            /* Border width and shadow go inline, not in the className:
               the primitive's own `border` and `shadow-xs` sit later in
               the compiled sheet than an arbitrary-value utility of the
               same group, so the class form silently lost and the box
               kept its 1px form-row edge. */
            style={{ borderWidth: 1.5, boxShadow: "0 1px 2px rgba(16,24,40,0.12)" }}
          />
        </span>
      )}

      {/* Thumbnail preview area */}
      <div
        className="relative shrink-0 w-full"
        style={{
          height: previewH,
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
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : isImageType && !att.previewUrl ? (
          <div className="flex items-center justify-center w-full h-full" style={{ background: tb.bg }}>
            <FileImage size={32} style={{ color: tb.color, opacity: 0.5 }} />
          </div>
        ) : (
          <DocumentPreview type={att.fileType} bg={tb.bg} color={tb.color} fileName={att.fileName} previewUrl={att.previewUrl} />
        )}

        {/* Bottom-left extension badge, mirrors PI-8 */}
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
            borderColor: "var(--border)",
            fontFamily: font,
            fontWeight: 600,
            fontSize: "9px",
            color: tb.color,
            letterSpacing: "0.04em",
            textTransform: "uppercase" as const,
            boxShadow: hasImagePreview ? "0 1px 2px rgba(0,0,0,0.18)" : undefined,
            whiteSpace: "nowrap",
            zIndex: 2,
          }}
        >
          {att.fileType === "url" ? "LINK" : att.fileType.toUpperCase()}
        </span>

        {/* Inline delete (X) button, visible top-right, used when no menu */}
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
              border: "1px solid var(--border)",
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
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
            }}
          >
            <X size={12} />
          </button>
        )}

        {/* Hover overlay, shown when card has external link or image preview */}
        {(hasImagePreview || isUrl) && hovered && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.25)", transition: "opacity 0.15s ease", pointerEvents: "none" }}
          >
            {isUrl ? (
              <ExternalLink size={20} style={{ color: "#FFFFFF", opacity: 0.95 }} />
            ) : (
              <Eye size={20} style={{ color: "#FFFFFF", opacity: 0.9 }} />
            )}
          </div>
        )}
      </div>

      {/* Dedicated pills row, sits between thumbnail and file info.
          Kept flush under the thumbnail; the file-info block below takes
          the card's leftover height so both align across a row. */}
      {pills != null && (
        <div
          className="flex flex-wrap items-center"
          style={{
            padding: "var(--spacing-1-5) var(--spacing-2) 0",
            gap: "var(--spacing-1)",
          }}
        >
          {pills}
        </div>
      )}

      {/* File info section.
          `marginTop: auto` bottom-aligns this block inside the card.
          Cards in a grid row all stretch to the tallest one, and the
          pills row above is conditional, so without this the slack
          collected BELOW the info block on pill-less cards: their file
          name and three-dots menu sat higher than their neighbours'.
          Pinning the block to the bottom moves that slack above it
          instead, so every card in a row lines up its name, metadata and
          menu button at the same height whether it carries a pill or
          not. The pills row stays tucked under the thumbnail, which is
          what its translucent blurred styling is drawn for. */}
      <div className="flex items-start w-full" style={{ marginTop: "auto", padding: "var(--spacing-1-5) var(--spacing-2) var(--spacing-2)", gap: "var(--spacing-1)" }}>
        <div className="flex flex-col flex-1 min-w-0" style={{ gap: "var(--spacing-1-5)" }}>
          <p
            className="overflow-hidden"
            style={{
              fontFamily: font,
              fontWeight: 500,
              fontSize: "var(--text-body-sm)",
              color: "var(--foreground)",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              margin: 0,
              lineHeight: 1.3,
            }}
            title={att.fileName}
          >
            {renderFileName ? renderFileName(att.fileName) : att.fileName}
          </p>

          <div className="flex flex-col" style={{ gap: "1px" }}>
            {deleteVariant !== "inline" && (
              <p
                className="overflow-hidden"
                style={{
                  fontFamily: font,
                  fontWeight: 400,
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
                fontWeight: 400,
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
                : <>{att.fileSize ? `${att.fileSize} · ` : ""}{att.uploadedBy}</>}
            </p>
          </div>
        </div>

        {/* Three-dot menu, hidden when using inline X delete */}
        {deleteVariant !== "inline" && (
        <div data-menu-area className="relative shrink-0" style={{ marginTop: "1px" }}>
          <button
            ref={menuBtnRef}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((p) => !p); }}
            className="flex items-center justify-center transition-colors hover:bg-[var(--primary-50)]"
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "var(--radius-xs)",
              cursor: "pointer",
              border: 0,
              background: "transparent",
            }}
            aria-label="More actions"
          >
            <MoreVertical size={14} style={{ color: "var(--text-secondary)" }} />
          </button>
          {menuOpen && createPortal(
            <div
              ref={menuRef}
              data-menu-area
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                zIndex: 12000,
                minWidth: "180px",
                borderRadius: "var(--radius-md)",
                background: "var(--card)",
                border: "1px solid var(--border)",
                boxShadow: "var(--elevation-card)",
                padding: "var(--spacing-1)",
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <MenuButton icon={isUrl ? <ExternalLink size={13} style={{ color: "var(--text-secondary)" }} /> : <Eye size={13} style={{ color: "var(--text-secondary)" }} />} label={isUrl ? "Open Link" : "Preview"} onClick={() => { setMenuOpen(false); onPreview?.(); }} />
              {!isUrl && (
                <MenuButton icon={<Download size={13} style={{ color: "var(--text-secondary)" }} />} label="Download" onClick={() => { setMenuOpen(false); onDownload?.(); }} />
              )}
              {inclusionToggle && (
                <>
                  <MenuDivider />
                  <MenuButton
                    icon={inclusionToggle.included ? <EyeOff size={13} style={{ color: "var(--text-secondary)" }} /> : <Eye size={13} style={{ color: "var(--text-secondary)" }} />}
                    label={inclusionToggle.included ? inclusionToggle.hideLabel : inclusionToggle.showLabel}
                    onClick={() => { setMenuOpen(false); inclusionToggle.onToggle(); }}
                  />
                </>
              )}
              {extraMenuItems && extraMenuItems.length > 0 && (
                <>
                  {extraMenuItems.map((item, idx) => (
                    <React.Fragment key={`${item.label}-${idx}`}>
                      {item.dividerBefore && <MenuDivider />}
                      <MenuButton
                        icon={item.icon}
                        label={item.label}
                        danger={item.danger}
                        onClick={() => { setMenuOpen(false); item.onClick(); }}
                      />
                    </React.Fragment>
                  ))}
                </>
              )}
              {onDelete && (
                <>
                  {deleteDivider && <MenuDivider />}
                  <MenuButton
                    icon={removeScopeLabel
                      ? <XCircle size={13} style={{ color: "hsl(0 72% 51%)" }} />
                      : <Trash2 size={13} style={{ color: "hsl(0 72% 51%)" }} />}
                    label={removeScopeLabel ? `Remove from ${removeScopeLabel}` : "Delete"}
                    danger
                    onClick={() => { setMenuOpen(false); setDeleteDialogOpen(true); }}
                  />
                </>
              )}
            </div>,
            document.body,
          )}
        </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteDialogOpen && createPortal(
        <DeleteConfirmDialog
          fileName={att.fileName}
          removeScopeLabel={removeScopeLabel}
          onCancel={() => setDeleteDialogOpen(false)}
          onConfirm={() => { setDeleteDialogOpen(false); onDelete?.(); }}
        />,
        document.body,
      )}
    </div>
  );
}

const DELETE_DIALOG_Z = 12100;

/* ═══════════════════════════════════════════════════════════════════════════
 * § 4  RENAME DIALOG
 * ═══════════════════════════════════════════════════════════════════════════ */

export function RenameAttachmentDialog({
  currentName,
  onCancel,
  onConfirm,
}: {
  currentName: string;
  onCancel: () => void;
  onConfirm: (newName: string) => void;
}) {
  const [value, setValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && value.trim() && value.trim() !== currentName) {
        onConfirm(value.trim());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm, value, currentName]);

  useLayoutEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.focus();
    const dot = currentName.lastIndexOf(".");
    if (dot > 0) inputRef.current.setSelectionRange(0, dot);
    else inputRef.current.select();
  }, [currentName]);

  const valid = value.trim().length > 0 && value.trim() !== currentName;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: DELETE_DIALOG_Z, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      onClick={onCancel}
    >
      <div
        className="relative flex flex-col"
        style={{
          width: "min(440px, calc(100vw - 32px))",
          background: "var(--card)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontFamily: font, fontSize: "18px", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
            Rename attachment
          </h3>
        </div>
        <div className="flex flex-col" style={{ padding: 20, gap: 12 }}>
          <label style={{ fontFamily: font, fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>File name</label>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              width: "100%",
              height: 36,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontFamily: font,
              fontSize: 13,
              color: "var(--foreground)",
              outline: "none",
            }}
          />
          <div className="flex" style={{ gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              onClick={onCancel}
              className="hover:bg-[var(--surface-secondary)]"
              style={{
                height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--card)", fontFamily: font, fontSize: 13, fontWeight: 500,
                color: "var(--foreground)", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => valid && onConfirm(value.trim())}
              disabled={!valid}
              className="hover:bg-[#0862D0]"
              style={{
                height: 36, padding: "0 16px", borderRadius: 8, border: 0,
                background: valid ? "var(--primary)" : "var(--muted)",
                color: valid ? "#FFFFFF" : "var(--muted-foreground)",
                fontFamily: font, fontSize: 13, fontWeight: 600,
                cursor: valid ? "pointer" : "not-allowed",
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 5  HELPERS
 * ═══════════════════════════════════════════════════════════════════════════ */

function MenuButton({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center w-full transition-colors ${danger ? "hover:bg-[rgba(220,38,38,0.08)]" : "hover:bg-[var(--primary-50)]"}`}
      style={{
        height: "30px",
        padding: "0 var(--spacing-2)",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        border: 0,
        background: "transparent",
        gap: "var(--spacing-1-5)",
        fontFamily: font,
        fontWeight: 500,
        fontSize: "var(--text-caption)",
        color: danger ? "hsl(0 72% 51%)" : "var(--foreground)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function MenuDivider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "var(--spacing-1) 0" }} />;
}

function DeleteConfirmDialog({ fileName, removeScopeLabel, onCancel, onConfirm }: { fileName: string; removeScopeLabel?: string; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: DELETE_DIALOG_Z, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      onClick={onCancel}
    >
      <div
        className="relative flex flex-col"
        style={{
          width: "min(400px, calc(100vw - 32px))",
          background: "var(--card)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative flex flex-col items-center"
          style={{ padding: "40px 0 24px", background: "linear-gradient(180deg, hsl(0 93% 94%) 0%, hsla(0,93%,94%,0.3) 70%, transparent 100%)" }}
        >
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
            {removeScopeLabel ? `Remove this attachment from the ${removeScopeLabel.toLowerCase()}?` : 'Delete this attachment?'}
          </h3>
          <p style={{ fontFamily: font, fontSize: "13px", color: "var(--muted-foreground)", marginTop: "8px", lineHeight: 1.65, maxWidth: "300px" }}>
            <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{fileName}</span>{" "}
            {removeScopeLabel
              ? "stays in the item master, so you can add it again anytime."
              : "will be permanently removed from the system. This action cannot be undone."}
          </p>
          <div className="w-full flex flex-col" style={{ marginTop: "28px", gap: "10px" }}>
            <button
              onClick={onConfirm}
              className="w-full transition-colors hover:opacity-90 cursor-pointer"
              style={{
                height: "44px",
                borderRadius: "var(--radius-lg)",
                fontFamily: font,
                fontSize: "14px",
                fontWeight: 600,
                backgroundColor: "hsl(0 72% 51%)",
                color: "#FFFFFF",
                border: 0,
              }}
            >
              {removeScopeLabel ? `Remove from ${removeScopeLabel}` : "Delete Attachment"}
            </button>
            <button
              onClick={onCancel}
              className="w-full transition-colors cursor-pointer"
              style={{
                height: "44px",
                borderRadius: "var(--radius-lg)",
                fontFamily: font,
                fontSize: "14px",
                fontWeight: 500,
                backgroundColor: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                border: 0,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
