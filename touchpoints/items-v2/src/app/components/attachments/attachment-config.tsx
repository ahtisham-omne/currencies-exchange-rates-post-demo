/**
 * Attachment Configuration
 * ────────────────────────────────────────────────────────────────────────────
 * Centralised definitions for file-type thumbnails, source metadata,
 * link pill variants, and shared types used by every attachment surface
 * in the application (Inventory Detail → Attachments Tab,
 * Transaction Detail Modal → Attachments Tab, etc.)
 *
 * ⚡  All colours that reference the design-system use CSS custom properties
 *    from /src/styles/theme.css so the look-and-feel can be updated in one
 *    place without touching component code.
 *
 * Usage:
 *   import {
 *     FILE_THUMB,
 *     SOURCE_META,
 *     LINK_PILL_VARIANTS,
 *     fileExtLabel,
 *     type FileType,
 *     type SourceType,
 *     type AttachmentLinkVariant,
 *   } from "./attachment-config";
 */

import React from "react";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  FileArchive,
  FileQuestion,
  Music,
  Film,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
 * § 1  FILE TYPES
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Supported file extensions across all attachment surfaces. */
export type FileType =
  | "pdf"
  | "xlsx"
  | "csv"
  | "docx"
  | "txt"
  | "png"
  | "jpg"
  | "zip"
  | "rar"
  | "exe"
  | "psd"
  | "cad"
  | "dxf"
  | "dwg"
  | "stl"
  | "mp3"
  | "mp4";

/** Audio extensions that should be rendered with the native HTML5 audio player. */
export const AUDIO_TYPES: ReadonlyArray<FileType> = ["mp3"];
/** Video extensions that should be rendered with the native HTML5 video player. */
export const VIDEO_TYPES: ReadonlyArray<FileType> = ["mp4"];

export function isAudio(type: string): boolean {
  return (AUDIO_TYPES as ReadonlyArray<string>).includes(type);
}
export function isVideo(type: string): boolean {
  return (VIDEO_TYPES as ReadonlyArray<string>).includes(type);
}

/** File types that cannot be previewed even in the preview modal. */
export const UNPREVIEWABLE_TYPES: ReadonlyArray<FileType> = [
  "zip", "rar", "exe", "psd", "cad",
];

export function isUnpreviewable(type: string): boolean {
  return (UNPREVIEWABLE_TYPES as ReadonlyArray<string>).includes(type);
}

/** Maps a FileType to its human-friendly extension label (uppercased). */
export function fileExtLabel(type: FileType): string {
  return type.toUpperCase();
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 2  FILE-TYPE THUMBNAILS
 *   Soft-pastel colour palette + icon for the card preview area.
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface FileThumbnailConfig {
  /** Background colour for the thumbnail preview area. */
  bg: string;
  /** Accent colour for the extension badge and icon tint. */
  color: string;
  /** Pre-built icon (28 px, 70 % opacity) shown inside the preview area. */
  icon: React.ReactNode;
}

const iconStyle = (color: string): React.CSSProperties => ({
  color,
  opacity: 0.7,
});

export const FILE_THUMB: Record<FileType, FileThumbnailConfig> = {
  pdf:  { bg: "var(--tx-type-negative-bg)", color: "var(--tx-type-negative-text)", icon: <FileText        size={28} style={iconStyle("var(--tx-type-negative-text)")} /> },
  xlsx: { bg: "var(--status-active-bg)", color: "var(--status-active-text)", icon: <FileSpreadsheet size={28} style={iconStyle("var(--status-active-text)")} /> },
  csv:  { bg: "var(--status-active-bg)", color: "var(--status-active-text)", icon: <FileSpreadsheet size={28} style={iconStyle("var(--status-active-text)")} /> },
  docx: { bg: "var(--primary-50)", color: "var(--piw-primary)", icon: <FileText        size={28} style={iconStyle("var(--piw-primary)")} /> },
  txt:  { bg: "var(--primary-50)", color: "var(--piw-primary)", icon: <FileText        size={28} style={iconStyle("var(--piw-primary)")} /> },
  png:  { bg: "var(--checked-out-tag-bg)", color: "var(--checked-out-tag-text)", icon: <FileImage       size={28} style={iconStyle("var(--checked-out-tag-text)")} /> },
  jpg:  { bg: "var(--checked-out-tag-bg)", color: "var(--checked-out-tag-text)", icon: <FileImage       size={28} style={iconStyle("var(--checked-out-tag-text)")} /> },
  zip:  { bg: "var(--primary-50)", color: "var(--piw-primary)", icon: <FileQuestion size={28} style={iconStyle("var(--piw-primary)")} /> },
  rar:  { bg: "var(--primary-50)", color: "var(--piw-primary)", icon: <FileQuestion size={28} style={iconStyle("var(--piw-primary)")} /> },
  exe:  { bg: "var(--primary-50)", color: "var(--piw-primary)", icon: <FileQuestion size={28} style={iconStyle("var(--piw-primary)")} /> },
  psd:  { bg: "var(--primary-50)", color: "var(--piw-primary)", icon: <FileQuestion size={28} style={iconStyle("var(--piw-primary)")} /> },
  cad:  { bg: "var(--primary-50)", color: "var(--piw-primary)", icon: <FileQuestion size={28} style={iconStyle("var(--piw-primary)")} /> },
  dxf:  { bg: "#EEF2FF", color: "#4F46E5", icon: <FileQuestion size={28} style={iconStyle("#4F46E5")} /> },
  dwg:  { bg: "#EEF2FF", color: "#4F46E5", icon: <FileQuestion size={28} style={iconStyle("#4F46E5")} /> },
  stl:  { bg: "#EEF2FF", color: "#4F46E5", icon: <FileQuestion size={28} style={iconStyle("#4F46E5")} /> },
  mp3:  { bg: "var(--reason-tag-bg)", color: "var(--reason-tag-text)", icon: <Music         size={28} style={iconStyle("var(--reason-tag-text)")} /> },
  mp4:  { bg: "var(--checked-out-tag-bg)", color: "var(--checked-out-tag-text)", icon: <Film          size={28} style={iconStyle("var(--checked-out-tag-text)")} /> },
};

/** Safe accessor — returns a neutral fallback for unknown types. */
export function getFileThumbnail(type: string): FileThumbnailConfig {
  return (
    FILE_THUMB[type as FileType] ?? {
      bg: "var(--surface-secondary)",
      color: "var(--text-secondary)",
      icon: <File size={28} style={{ color: "var(--text-secondary)", opacity: 0.7 }} />,
    }
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 3  SOURCE / TRANSACTION-TYPE METADATA
 *   Coloured treatment for source-filter pills and source badges.
 * ═══════════════════════════════════════════════════════════════════════════ */

export type SourceType =
  | "Receiving"
  | "Consumption"
  | "Adjustment"
  | "Movement"
  | "Cycle Count"
  | "Manufactured"
  | "Item Library";

export interface SourceMetaConfig {
  /** Text / icon colour. */
  color: string;
  /** Background tint. */
  bg: string;
  /** Border colour. */
  border: string;
}

export const SOURCE_META: Record<SourceType, SourceMetaConfig> = {
  Receiving:      { color: "var(--status-active-text)", bg: "var(--status-active-bg)", border: "var(--status-active-border)" },
  Consumption:    { color: "var(--reason-tag-text)", bg: "var(--reason-tag-bg)", border: "var(--reason-tag-border)" },
  Adjustment:     { color: "var(--piw-primary)", bg: "var(--primary-50)", border: "var(--primary-200)" },
  Movement:       { color: "var(--checked-out-tag-text)", bg: "var(--checked-out-tag-bg)", border: "var(--checked-out-tag-border)" },
  "Cycle Count":  { color: "var(--tx-type-negative-text)", bg: "var(--tx-type-negative-bg)", border: "var(--tx-type-negative-border)" },
  Manufactured:   { color: "var(--status-active-text)", bg: "var(--status-active-bg)", border: "var(--status-active-border)" },
  "Item Library": { color: "var(--text-secondary)", bg: "var(--surface-secondary)", border: "var(--piw-border)" },
};

/* ═══════════════════════════════════════════════════════════════════════════
 * § 4  LINK PILL VARIANTS
 *   Defines the pill shown between the thumbnail preview and file-info
 *   area.  The variant describes *what* the pill links to, or indicates
 *   that the attachment has no specific linkage.
 *
 *   ┌──────────────────────┬──────────────────────────────────────────────┐
 *   │ Variant              │ Where it's used                             │
 *   ├──────────────────────┼──────────────────────────────────────────────┤
 *   │ transaction          │ Inventory Detail → Attachments tab          │
 *   │                      │ Pill links to the related transaction       │
 *   │                      │ (ExternalLink icon + TX ID).                │
 *   ├──────────────────────┼──────────────────────────────────────────────┤
 *   │ serial-unit          │ Transaction Detail Modal → Attachments tab  │
 *   │                      │ Pill indicates the linked serial unit       │
 *   │                      │ (barcode icon + serial number).             │
 *   ├──────────────────────┼──────────────────────────────────────────────┤
 *   │ item-library         │ Inventory Detail → Attachments tab          │
 *   │                      │ Pill uses source-coloured treatment for     │
 *   │                      │ "Item Library" entries (Library icon).      │
 *   ├──────────────────────┼──────────────────────────────────────────────┤
 *   │ transaction-level    │ Transaction Detail Modal → Attachments tab  │
 *   │                      │ Neutral pill with "Transaction attachment"  │
 *   │                      │ text when file is not linked to a specific  │
 *   │                      │ serial unit.                                │
 *   └──────────────────────┴──────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════ */

export type AttachmentLinkVariant =
  | "transaction"
  | "serial-unit"
  | "item-library"
  | "transaction-level";

export interface LinkPillConfig {
  /** Human-readable description of this pill variant. */
  description: string;
  /** Default label shown inside the pill (can be overridden with dynamic text). */
  defaultLabel: string;
  /** Whether the pill is interactive (clickable link with hover effect). */
  interactive: boolean;
  /** Static style tokens — all reference design-system CSS variables. */
  style: {
    background: string;
    border: string;
    color: string;
  };
  /** Hover style tokens (only applies when `interactive: true`). */
  hoverStyle?: {
    background: string;
    border: string;
    color: string;
  };
}

/**
 * Serialized-item barcode icon (inline SVG, 10 × 10 px).
 * Matches the SERIALIZED_ICON from shared-badges.tsx at pill scale.
 */
export const SERIAL_BARCODE_ICON = (
  <svg
    width="10"
    height="10"
    viewBox="0 0 16 16"
    fill="none"
    style={{ flexShrink: 0, marginRight: "2px" }}
  >
    <path
      d="M2.91 12.36H1.45V3.64H2.91M4.36 12.36H3.64V3.64H4.36M7.27 12.36H5.09V3.64H7.27M8.73 12.36H8V3.64H8.73M10.91 12.36H9.45V3.64H10.91M12.36 12.36H11.64V3.64H12.36M14.55 12.36H13.09V3.64H14.55V12.36Z"
      fill="currentColor"
    />
  </svg>
);

export const LINK_PILL_VARIANTS: Record<AttachmentLinkVariant, LinkPillConfig> = {
  /* ── Transaction link (Inventory Detail Attachments tab) ── */
  transaction: {
    description:
      "Links to a specific transaction. Shown in the Inventory Detail → Attachments tab when the file was uploaded via a transaction (Receiving, Adjustment, etc.).",
    defaultLabel: "TX-000000",
    interactive: true,
    style: {
      background: "var(--surface-secondary)",
      border: "var(--piw-border)",
      color: "var(--text-secondary)",
    },
    hoverStyle: {
      background: "var(--primary-50)",
      border: "var(--primary-200)",
      color: "var(--piw-primary)",
    },
  },

  /* ── Serial-unit link (Transaction Detail Attachments tab) ── */
  "serial-unit": {
    description:
      "Indicates a linked serial unit. Shown in the Transaction Detail Modal → Attachments tab when the file is associated with a specific serial unit. Uses a barcode icon to differentiate from transaction links.",
    defaultLabel: "000000-00",
    interactive: true,
    style: {
      background: "var(--surface-secondary)",
      border: "var(--piw-border)",
      color: "var(--text-secondary)",
    },
    hoverStyle: {
      background: "var(--primary-50)",
      border: "var(--primary-200)",
      color: "var(--piw-primary)",
    },
  },

  /* ── Item Library source (Inventory Detail Attachments tab) ── */
  "item-library": {
    description:
      "Source badge for files uploaded directly to the item library rather than through a transaction. Uses the Item Library source-colour treatment.",
    defaultLabel: "Item Library",
    interactive: false,
    style: {
      background: "var(--surface-secondary)",
      border: "var(--piw-border)",
      color: "var(--text-secondary)",
    },
  },

  /* ── Transaction-level fallback (Transaction Detail Attachments tab) ── */
  "transaction-level": {
    description:
      "Neutral pill for files attached to the transaction as a whole (not linked to a specific serial unit). Shown in the Transaction Detail Modal → Attachments tab.",
    defaultLabel: "Transaction attachment",
    interactive: false,
    style: {
      background: "var(--surface-secondary)",
      border: "var(--piw-border)",
      color: "var(--text-tertiary)",
    },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
 * § 5  SHARED PILL STYLE HELPERS
 *   Common inline-style objects used by all pill instances.
 * ═══════════════════════════════════════════════════════════════════════════ */

const font = "var(--font-inter)";

/** Base inline styles shared by every link pill regardless of variant. */
export const PILL_BASE_STYLE: React.CSSProperties = {
  padding: "1px var(--spacing-1-5)",
  borderRadius: "9999px",
  fontFamily: font,
  fontWeight: "var(--font-weight-medium)" as any,
  fontSize: "var(--text-badge)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  gap: "var(--spacing-0-5)",
  textDecoration: "none",
  transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
};

/** Builds the full inline style for a pill from its variant config. */
export function pillStyle(variant: AttachmentLinkVariant): React.CSSProperties {
  const cfg = LINK_PILL_VARIANTS[variant];
  return {
    ...PILL_BASE_STYLE,
    background: cfg.style.background,
    border: `1px solid ${cfg.style.border}`,
    color: cfg.style.color,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 6  THUMBNAIL CARD STYLE CONSTANTS
 *   Reusable style objects for the ThumbnailCard layout shared across
 *   all attachment surfaces.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Card container border + shadow (idle state). */
export const CARD_IDLE_STYLE: React.CSSProperties = {
  minWidth: 0,
  borderRadius: "var(--radius-lg)",
  background: "var(--piw-card)",
  boxShadow: "0px 1px 2px 0px rgba(16,24,40,0.04)",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  cursor: "default",
};

/** Card container border + shadow (hovered state). */
export const CARD_HOVER_BORDER = "var(--primary-200)";
export const CARD_HOVER_SHADOW = "var(--elevation-card)";

/** Thumbnail preview area (top section). */
export const THUMBNAIL_PREVIEW_STYLE: React.CSSProperties = {
  height: "88px",
  borderTopLeftRadius: "calc(var(--radius-lg) - 1px)",
  borderTopRightRadius: "calc(var(--radius-lg) - 1px)",
  overflow: "hidden",
};

/** Extension badge (top-right of preview area). */
export const EXT_BADGE_STYLE: React.CSSProperties = {
  top: "var(--spacing-1-5)",
  right: "var(--spacing-1-5)",
  padding: "1px var(--spacing-1)",
  borderRadius: "var(--radius-xs)",
  background: "rgba(255,255,255,0.88)",
  border: "1px solid var(--piw-border)",
  fontFamily: font,
  fontWeight: "var(--font-weight-semibold)" as any,
  fontSize: "9px",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

/** Pill container padding (between preview and file info). */
export const PILL_CONTAINER_PADDING: React.CSSProperties = {
  padding: "var(--spacing-1-5) var(--spacing-2) 0",
};

/** File-info section padding. */
export const FILE_INFO_PADDING: React.CSSProperties = {
  padding: "var(--spacing-1-5) var(--spacing-2) var(--spacing-2)",
  gap: "var(--spacing-1)",
};

/** File name text style. */
export const FILE_NAME_STYLE: React.CSSProperties = {
  fontFamily: font,
  fontWeight: "var(--font-weight-medium)" as any,
  fontSize: "var(--text-body-sm)",
  color: "var(--piw-foreground)",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  margin: 0,
  lineHeight: 1.3,
};

/** Meta-row text style (date, file size, uploader). */
export const FILE_META_STYLE: React.CSSProperties = {
  fontFamily: font,
  fontWeight: "var(--font-weight-normal)" as any,
  fontSize: "var(--text-caption)",
  color: "var(--text-tertiary)",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  margin: 0,
  lineHeight: 1.3,
};

/* ═══════════════════════════════════════════════════════════════════════════
 * § 7  DATE FORMATTER
 * ═══════════════════════════════════════════════════════════════════════════ */

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Converts "MM/DD/YYYY" + "H:MM AM/PM" into "DD Mon YYYY, h:mm am/pm".
 * Falls back to raw concatenation on parse failure.
 */
export function formatAttachmentDate(date: string, time: string): string {
  try {
    const [mm, dd, yyyy] = date.split("/");
    return `${dd} ${MONTH_ABBR[parseInt(mm, 10) - 1]} ${yyyy}, ${time.toLowerCase()}`;
  } catch {
    return `${date}, ${time}`;
  }
}
