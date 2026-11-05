/* Uploaded File Card, carried over from User Access Control's import wizard
 * (`data-imports/import-wizard/uploadedFileCard.tsx`) so the importer's file
 * cards are that module's components rather than new ones: the shimmering
 * `UploadingCard` with its centred progress ring, and the finished
 * `AttachmentCard` with a real spreadsheet preview. Only the faux preview's
 * text names this module instead of theirs.
 *
 * Original header follows.
 *
 * Uploaded File Card, Physical Inventory parity.
 *
 * Replicated from the reference attachment-card design (attachment-card.tsx
 * + modal-attachments-field.tsx) with the design-system variables resolved
 * to their literal values:
 *   --radius-lg: 10px            --radius-xs: 4px
 *   --card: #FFFFFF              --border: #EAEBF0
 *   --primary: #0A77FF           --primary-50: #ECF4FC
 *   --primary-200: #90C2FF       --surface-secondary: #F7F7F8
 *   --text-secondary: #68727D    --text-tertiary: #A1A3A7
 *   --text-body-sm: 13px         --text-caption: 12px
 *   spacing-1: 4px  spacing-1-5: 6px  spacing-2: 8px  spacing-3: 12px
 * Only the spreadsheet preview branch is carried over, this flow accepts
 * .xlsx / .csv exclusively; anything else falls back to the generic icon. */

import { useState } from "react";
import { FileQuestion, X } from "lucide-react";

const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif";
const BORDER = "#EAEBF0";
const PRIMARY = "#0A77FF";
const PRIMARY_200 = "#90C2FF";
const SURFACE_SECONDARY = "#F7F7F8";
const TEXT_SECONDARY = "#68727D";
const TEXT_TERTIARY = "#A1A3A7";
const FOREGROUND = "#0F172A";

/** Responsive height for the thumbnail preview area. */
export const THUMB_PREVIEW_H = "clamp(94px, calc(10vw - 6px), 174px)";

/** Grid spec for the card grid rendered below the dropzone. */
export const CARD_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: 12,
  marginTop: "10px",
};

/* Accent colour drives the extension badge text; bg fills icon placeholders. */
export function getFileThumbnail(type: string): { bg: string; color: string } {
  switch (type) {
    case "xlsx":
    case "csv":
      return { bg: "#e9f8f1", color: "#176f45" }; // green, spreadsheets
    case "pdf":
      return { bg: "#ffefee", color: "#db3a33" }; // red
    case "docx":
    case "txt":
      return { bg: "#ECF4FC", color: PRIMARY }; // blue
    case "png":
    case "jpg":
      return { bg: "#f3f0ff", color: "#7c3aed" }; // purple
    default:
      return { bg: SURFACE_SECONDARY, color: TEXT_SECONDARY };
  }
}

/* ────────────────────────────────────
   Document preview, faux content rendered inside the thumbnail area so the
   card reads as a real preview of the file's top portion.
   ──────────────────────────────────── */

export function DocumentPreview({ type }: { type: string; fileName?: string }) {
  const tb = getFileThumbnail(type);
  const isSpreadsheet = type === "xlsx" || type === "csv";

  /* ── Spreadsheet: scaled-down real top portion with A–G columns ── */
  if (isSpreadsheet) {
    const gridLine = "#E1E3E6";
    const headerBg = "#F8F9FA";
    const headerText = "#5F6368";
    const COLS = ["A", "B", "C", "D", "E", "F", "G"];
    const ROW_COUNT = 14;
    // Sparse, realistic-looking content placed in a few cells (col index → text)
    const ROW_CONTENT: Record<number, Record<number, { text: string; bold?: boolean; size?: number; color?: string }>> = {
      1: { 1: { text: "Sales Orders Import Template", bold: true, size: 8, color: "#1f2937" } },
      2: { 1: { text: "Omne ERP   ·   Sales Orders Module", size: 5.5, color: "#6b7280" } },
      4: { 1: { text: "Legacy import   ·   V1 only", size: 5, color: "#9ca3af" } },
      6: { 1: { text: "QUICK START", bold: true, size: 5.5, color: "#1f6feb" } },
      8: { 1: { text: "Step 1", bold: true, size: 5.5 }, 2: { text: "Go to the Data Entry sheet. Fill in the required fields per row.", size: 5, color: "#374151" } },
      10: { 1: { text: "Step 2", bold: true, size: 5.5 }, 2: { text: "Review the example rows (rows 3-4, highlighted in grey).", size: 5, color: "#374151" } },
      12: { 1: { text: "Step 3", bold: true, size: 5.5 }, 2: { text: "Review and fix rows before importing into the platform.", size: 5, color: "#374151" } },
    };
    const BAND_ROWS = new Set([6]); // light-blue band row
    return (
      <div className="w-full h-full" style={{ background: "white", position: "relative", overflow: "hidden" }}>
        <table style={{ borderCollapse: "collapse", fontFamily: FONT, width: "100%", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 14 }} />
            {COLS.map((_, i) => (<col key={i} />))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ background: headerBg, border: `1px solid ${gridLine}`, height: 8 }} />
              {COLS.map((c, i) => (
                <th key={i} style={{ background: headerBg, border: `1px solid ${gridLine}`, color: headerText, fontSize: 5, fontWeight: 600, height: 8, padding: 0, textAlign: "center" }}>
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
                  <td style={{ background: headerBg, border: `1px solid ${gridLine}`, color: headerText, fontSize: 5, fontWeight: 500, textAlign: "center", padding: 0, height: 10 }}>
                    {rowNum}
                  </td>
                  {COLS.map((_, c) => {
                    const cell = ROW_CONTENT[rowNum]?.[c];
                    return (
                      <td key={c} style={{ border: `1px solid ${gridLine}`, background: banded ? "#E8F0FE" : "white", padding: "0 3px", height: 10, fontSize: cell?.size ?? 5, fontWeight: cell?.bold ? 700 : 400, color: cell?.color ?? "#1f2937", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "40%", background: "linear-gradient(to bottom, rgba(238,240,243,0) 0%, #EEF0F3 80%)", pointerEvents: "none" }} />
      </div>
    );
  }

  /* ── Fallback ── */
  return (
    <div className="flex items-center justify-center w-full h-full" style={{ background: tb.bg }}>
      <FileQuestion size={28} style={{ color: tb.color, opacity: 0.5 }} />
    </div>
  );
}

/* ────────────────────────────────────
   Attachment card, final uploaded state (inline delete variant)
   ──────────────────────────────────── */

export interface AttachmentCardData {
  fileName: string;
  fileType: string; // lowercased extension, e.g. "xlsx"
  fileSize: string; // pre-formatted, e.g. "42.5 KB"
}

export function AttachmentCard({
  att,
  onDelete,
}: {
  att: AttachmentCardData;
  onDelete?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const tb = getFileThumbnail(att.fileType);

  return (
    <div
      className="relative flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 0,
        borderRadius: 10,
        background: "#FFFFFF",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: hovered ? PRIMARY_200 : BORDER,
        boxShadow: hovered
          ? "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)"
          : "0px 1px 2px 0px rgba(16,24,40,0.04)",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      {/* ── Thumbnail preview area ── */}
      <div
        className="relative shrink-0 w-full"
        style={{
          height: THUMB_PREVIEW_H,
          borderTopLeftRadius: 9,
          borderTopRightRadius: 9,
          overflow: "hidden",
          background: tb.bg,
        }}
      >
        <DocumentPreview type={att.fileType} fileName={att.fileName} />

        {/* File extension badge, always white pill with the type's accent text */}
        <span
          className="absolute"
          style={{
            bottom: 6,
            left: 6,
            padding: "1px 4px",
            borderRadius: 4,
            background: "#FFFFFF",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: BORDER,
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: "9px",
            color: tb.color,
            letterSpacing: "0.04em",
            textTransform: "uppercase" as const,
            zIndex: 2,
          }}
        >
          {att.fileType.toUpperCase()}
        </span>

        {/* Inline delete (X) button, always visible top-right, turns red on hover */}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label={`Remove ${att.fileName}`}
            className="absolute flex items-center justify-center transition-all"
            style={{
              top: 6,
              right: 6,
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "rgba(255,255,255,0.95)",
              border: `1px solid ${BORDER}`,
              cursor: "pointer",
              color: TEXT_SECONDARY,
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
              (e.currentTarget as HTMLElement).style.color = TEXT_SECONDARY;
              (e.currentTarget as HTMLElement).style.borderColor = BORDER;
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── File name + size ── */}
      <div
        className="flex items-start w-full"
        style={{ padding: "6px 8px 8px", gap: 4 }}
      >
        <div className="flex flex-col flex-1 min-w-0" style={{ gap: 6 }}>
          <p
            className="overflow-hidden"
            style={{
              fontFamily: FONT,
              fontWeight: 500,
              fontSize: "13px",
              color: FOREGROUND,
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              margin: 0,
              lineHeight: 1.3,
            }}
            title={att.fileName}
          >
            {att.fileName}
          </p>
          <p
            className="overflow-hidden"
            style={{
              fontFamily: FONT,
              fontWeight: 400,
              fontSize: "12px",
              color: TEXT_TERTIARY,
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {att.fileSize}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────
   Uploading card, skeleton placeholder shown while the file uploads.
   Same footprint as AttachmentCard (thumbnail area + name + size rows),
   with a shimmering skeleton and a centred circular progress ring.
   ──────────────────────────────────── */

const SHIMMER_BG =
  `linear-gradient(110deg, ${SURFACE_SECONDARY} 8%, hsl(210,16%,93%) 18%, ${SURFACE_SECONDARY} 33%)`;

export function UploadingCard({
  fileName,
  fileSize,
  ext,
  progress,
  onCancel,
}: {
  fileName: string;
  fileSize: string;
  ext: string;
  progress: number; // 0–100
  onCancel: () => void;
}) {
  return (
    <div
      className="relative flex flex-col"
      style={{
        minWidth: 0,
        borderRadius: 10,
        background: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        boxShadow: "0px 1px 2px 0px rgba(16,24,40,0.04)",
      }}
    >
      <div
        className="relative shrink-0 w-full flex items-center justify-center overflow-hidden"
        style={{
          height: THUMB_PREVIEW_H,
          borderTopLeftRadius: 9,
          borderTopRightRadius: 9,
          background: SHIMMER_BG,
          backgroundSize: "200% 100%",
          animation: "attUploadShimmer 1.2s linear infinite",
        }}
      >
        {/* Centered progress indicator: animated ring + percent in the middle */}
        <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute", inset: 0 }} aria-hidden>
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(15,23,41,0.08)" strokeWidth="4" />
            <circle
              cx="28" cy="28" r="24" fill="none"
              stroke={PRIMARY}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 24}
              strokeDashoffset={2 * Math.PI * 24 * (1 - Math.min(100, Math.max(0, progress)) / 100)}
              style={{ transformOrigin: "center", transform: "rotate(-90deg)", transition: "stroke-dashoffset 160ms linear" }}
            />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {Math.min(100, Math.max(0, progress))}%
          </span>
        </div>

        {/* Extension badge */}
        <span
          className="absolute"
          style={{
            bottom: 6,
            left: 6,
            padding: "1px 4px",
            borderRadius: 4,
            background: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            fontWeight: 600,
            fontSize: 9,
            color: TEXT_SECONDARY,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {ext}
        </span>

        {/* Cancel upload */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          aria-label="Cancel upload"
          className="absolute flex items-center justify-center transition-all"
          style={{
            top: 6,
            right: 6,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "rgba(255,255,255,0.95)",
            border: `1px solid ${BORDER}`,
            cursor: "pointer",
            color: TEXT_SECONDARY,
            boxShadow: "0 1px 2px rgba(16,24,40,0.10)",
          }}
        >
          <span style={{ fontSize: 12, lineHeight: 1 }}>×</span>
        </button>
      </div>

      <div
        className="flex flex-col w-full"
        style={{ padding: "6px 8px 8px", gap: 6 }}
      >
        {/* Skeleton row for filename, matches body-sm line height */}
        <div
          aria-hidden
          style={{
            height: "calc(13px * 1.3)",
            width: `${60 + ((fileName.length * 7) % 30)}%`,
            maxWidth: "100%",
            borderRadius: 4,
            background: SHIMMER_BG,
            backgroundSize: "200% 100%",
            animation: "attUploadShimmer 1.2s linear infinite",
          }}
        />
        {/* Skeleton row for size, matches caption line height */}
        <div
          aria-hidden
          style={{
            height: "calc(12px * 1.3)",
            width: 56,
            borderRadius: 4,
            background: SHIMMER_BG,
            backgroundSize: "200% 100%",
            animation: "attUploadShimmer 1.2s linear infinite",
          }}
        />
        <span className="sr-only" title={fileName}>{fileName}</span>
        <span className="sr-only">{fileSize}</span>
      </div>

      <style>{`@keyframes attUploadShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
