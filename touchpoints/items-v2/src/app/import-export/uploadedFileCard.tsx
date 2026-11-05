/* The uploaded-file cards under the import dropzone: UploadingCard (shimmer
 * + progress ring while the file parses) and AttachmentCard (faux
 * spreadsheet preview, type badge, name + size, remove X). Port of
 * role-zen's import-wizard/uploadedFileCard.tsx; values resolved from the
 * Physical Inventory design vars this repo also carries (--radius-lg 10px,
 * --border #EAEBF0, --primary #0A77FF, --primary-200 #90C2FF,
 * --surface-secondary #F7F7F8, --text-secondary #68727D, --text-tertiary
 * #A1A3A7). */
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
export const THUMB_PREVIEW_H = "clamp(94px, calc(10vw - 6px), 174px)";
export const CARD_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: 12,
  marginTop: "10px",
};

function getFileThumbnail(type: string): { bg: string; color: string } {
  switch (type) {
    case "xlsx":
    case "csv":
      return { bg: "#e9f8f1", color: "#176f45" };
    case "pdf":
      return { bg: "#ffefee", color: "#db3a33" };
    case "docx":
    case "txt":
      return { bg: "#ECF4FC", color: "#0A77FF" };
    case "png":
    case "jpg":
      return { bg: "#f3f0ff", color: "#7c3aed" };
    default:
      return { bg: "#F7F7F8", color: "#68727D" };
  }
}

/* ─── Faux spreadsheet preview ─── */

const COLS = ["A", "B", "C", "D", "E", "F", "G"];
const ROW_COUNT = 14;
const BAND_ROWS = new Set([6]);
type PreviewCell = { text: string; bold?: boolean; size?: number; color?: string };
const ROW_CONTENT: Record<number, Record<number, PreviewCell>> = {
  1: { 1: { text: "Items Import Template", bold: true, size: 8, color: "#1f2937" } },
  2: { 1: { text: "Omne ERP   ·   Items & Inventory Module", size: 5.5, color: "#6b7280" } },
  4: { 1: { text: "Generated: Sep 2026   ·   2 required / 37 optional", size: 5, color: "#9ca3af" } },
  6: { 1: { text: "QUICK START", bold: true, size: 5.5, color: "#1f6feb" } },
  8: { 1: { text: "Step 1", bold: true, size: 5.5 }, 2: { text: "Go to the Data Entry sheet. Fill in the required fields per row.", size: 5, color: "#374151" } },
  10: { 1: { text: "Step 2", bold: true, size: 5.5 }, 2: { text: "Review the example rows (rows 3-4, highlighted in grey).", size: 5, color: "#374151" } },
  12: { 1: { text: "Step 3", bold: true, size: 5.5 }, 2: { text: "Validate entries before importing into the platform.", size: 5, color: "#374151" } },
};

export function DocumentPreview({ type }: { type: string; fileName?: string }) {
  const tb = getFileThumbnail(type);
  if (type === "xlsx" || type === "csv") {
    const gridLine = "#E1E3E6";
    const headerBg = "#F8F9FA";
    const headerText = "#5F6368";
    return (
      <div className="w-full h-full" style={{ background: "white", position: "relative", overflow: "hidden" }}>
        <table style={{ borderCollapse: "collapse", fontFamily: FONT, width: "100%", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 14 }} />
            {COLS.map((c) => (
              <col key={c} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ background: headerBg, border: `1px solid ${gridLine}`, height: 8 }} />
              {COLS.map((c) => (
                <th
                  key={c}
                  style={{ background: headerBg, border: `1px solid ${gridLine}`, color: headerText, fontSize: 5, fontWeight: 600, height: 8, padding: 0, textAlign: "center" }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROW_COUNT }, (_, i) => i + 1).map((rowNum) => {
              const banded = BAND_ROWS.has(rowNum);
              return (
                <tr key={rowNum}>
                  <td style={{ background: headerBg, border: `1px solid ${gridLine}`, color: headerText, fontSize: 5, fontWeight: 500, textAlign: "center", padding: 0, height: 10 }}>
                    {rowNum}
                  </td>
                  {COLS.map((_, ci) => {
                    const cell = ROW_CONTENT[rowNum]?.[ci + 1];
                    return (
                      <td
                        key={ci}
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
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "40%", background: "linear-gradient(to bottom, rgba(238,240,243,0) 0%, #EEF0F3 80%)", pointerEvents: "none" }}
        />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-full h-full" style={{ background: tb.bg }}>
      <FileQuestion size={28} style={{ color: tb.color, opacity: 0.5 }} />
    </div>
  );
}

/* ─── AttachmentCard ─── */

export interface AttachmentCardData {
  fileName: string;
  fileType: string; // lowercased extension, e.g. "xlsx"
  fileSize: string; // pre-formatted, e.g. "42 KB"
}

export function AttachmentCard({ att, onDelete }: { att: AttachmentCardData; onDelete?: () => void }) {
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
        boxShadow: hovered ? "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)" : "0px 1px 2px 0px rgba(16,24,40,0.04)",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <div
        className="relative shrink-0 w-full"
        style={{ height: THUMB_PREVIEW_H, borderTopLeftRadius: 9, borderTopRightRadius: 9, overflow: "hidden", background: tb.bg }}
      >
        <DocumentPreview type={att.fileType} fileName={att.fileName} />
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
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
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
              const el = e.currentTarget as HTMLElement;
              el.style.background = "hsl(0 93% 96%)";
              el.style.color = "hsl(0 72% 51%)";
              el.style.borderColor = "hsl(0 72% 51% / 0.4)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "rgba(255,255,255,0.95)";
              el.style.color = TEXT_SECONDARY;
              el.style.borderColor = BORDER;
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>
      <div className="flex items-start w-full" style={{ padding: "6px 8px 8px", gap: 4 }}>
        <div className="flex flex-col flex-1 min-w-0" style={{ gap: 6 }}>
          <p
            className="overflow-hidden"
            title={att.fileName}
            style={{ fontFamily: FONT, fontWeight: 500, fontSize: "13px", color: FOREGROUND, whiteSpace: "nowrap", textOverflow: "ellipsis", margin: 0, lineHeight: 1.3 }}
          >
            {att.fileName}
          </p>
          <p
            className="overflow-hidden"
            style={{ fontFamily: FONT, fontWeight: 400, fontSize: "12px", color: TEXT_TERTIARY, whiteSpace: "nowrap", textOverflow: "ellipsis", margin: 0, lineHeight: 1.3 }}
          >
            {att.fileSize}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── UploadingCard ─── */

const SHIMMER_BG = `linear-gradient(110deg, ${SURFACE_SECONDARY} 8%, hsl(210,16%,93%) 18%, ${SURFACE_SECONDARY} 33%)`;
const shimmer: React.CSSProperties = { background: SHIMMER_BG, backgroundSize: "200% 100%", animation: "attUploadShimmer 1.2s linear infinite" };

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
  progress: number;
  onCancel: () => void;
}) {
  const p = Math.min(100, Math.max(0, progress));
  const C = 2 * Math.PI * 24;
  return (
    <div
      className="relative flex flex-col"
      style={{ minWidth: 0, borderRadius: 10, background: "#FFFFFF", border: `1px solid ${BORDER}`, boxShadow: "0px 1px 2px 0px rgba(16,24,40,0.04)" }}
    >
      <div
        className="relative shrink-0 w-full flex items-center justify-center overflow-hidden"
        style={{ height: THUMB_PREVIEW_H, borderTopLeftRadius: 9, borderTopRightRadius: 9, ...shimmer }}
      >
        <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute", inset: 0 }} aria-hidden>
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(15,23,41,0.08)" strokeWidth="4" />
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke={PRIMARY}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - p / 100)}
              style={{ transformOrigin: "center", transform: "rotate(-90deg)", transition: "stroke-dashoffset 160ms linear" }}
            />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{p}%</span>
        </div>
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
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
            color: TEXT_SECONDARY,
            boxShadow: "0 1px 2px rgba(16,24,40,0.10)",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 12, lineHeight: 1 }}>×</span>
        </button>
      </div>
      <div className="flex flex-col w-full" style={{ padding: "6px 8px 8px", gap: 6 }}>
        <div aria-hidden style={{ height: "calc(13px * 1.3)", width: `${60 + ((fileName.length * 7) % 30)}%`, maxWidth: "100%", borderRadius: 4, ...shimmer }} />
        <div aria-hidden style={{ height: "calc(12px * 1.3)", width: 56, borderRadius: 4, ...shimmer }} />
        <span className="sr-only" title={fileName}>
          {fileName}
        </span>
        <span className="sr-only">{fileSize}</span>
      </div>
      <style>{`@keyframes attUploadShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
