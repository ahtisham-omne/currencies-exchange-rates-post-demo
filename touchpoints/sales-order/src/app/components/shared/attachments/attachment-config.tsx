/**
 * Attachment Configuration, shared design tokens and metadata for the
 * attachment-card surfaces. Mirrors the Physical Inventory module pattern,
 * extended with Sales-Order-specific types (url + mp3/mp4 + 3D CAD).
 *
 * Used in:
 *   - Sales Order Detail, Attachments tab
 *   - Sales Order Detail, Deal Information, RFP/RFQ carousel
 *   - Sales Order Line-Item Configurator, Attachments + Gallery tabs
 */

import React from "react";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  FileArchive,
  FileQuestion,
  Link2,
  Music,
  Film,
} from "lucide-react";

/* ── File types ─────────────────────────────────────────────────────────── */

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
  | "url"
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

export function fileExtLabel(type: FileType): string {
  if (type === "url") return "LINK";
  return type.toUpperCase();
}

/* ── Per-file thumbnail palette ────────────────────────────────────────── */

export interface FileThumbnailConfig {
  bg: string;
  color: string;
  icon: React.ReactNode;
}

const iconStyle = (color: string): React.CSSProperties => ({ color, opacity: 0.7 });

export const FILE_THUMB: Record<FileType, FileThumbnailConfig> = {
  pdf:  { bg: "var(--tx-type-negative-bg)", color: "var(--tx-type-negative-text)", icon: <FileText        size={28} style={iconStyle("var(--tx-type-negative-text)")} /> },
  xlsx: { bg: "var(--status-active-bg)",    color: "var(--status-active-text)",    icon: <FileSpreadsheet size={28} style={iconStyle("var(--status-active-text)")} /> },
  csv:  { bg: "var(--status-active-bg)",    color: "var(--status-active-text)",    icon: <FileSpreadsheet size={28} style={iconStyle("var(--status-active-text)")} /> },
  docx: { bg: "var(--primary-50)",          color: "var(--primary)",               icon: <FileText        size={28} style={iconStyle("var(--primary)")} /> },
  txt:  { bg: "var(--primary-50)",          color: "var(--primary)",               icon: <FileText        size={28} style={iconStyle("var(--primary)")} /> },
  png:  { bg: "var(--checked-out-tag-bg)",  color: "var(--checked-out-tag-text)",  icon: <FileImage       size={28} style={iconStyle("var(--checked-out-tag-text)")} /> },
  jpg:  { bg: "var(--checked-out-tag-bg)",  color: "var(--checked-out-tag-text)",  icon: <FileImage       size={28} style={iconStyle("var(--checked-out-tag-text)")} /> },
  zip:  { bg: "var(--primary-50)",          color: "var(--primary)",               icon: <FileQuestion    size={28} style={iconStyle("var(--primary)")} /> },
  rar:  { bg: "var(--primary-50)",          color: "var(--primary)",               icon: <FileQuestion    size={28} style={iconStyle("var(--primary)")} /> },
  exe:  { bg: "var(--primary-50)",          color: "var(--primary)",               icon: <FileQuestion    size={28} style={iconStyle("var(--primary)")} /> },
  psd:  { bg: "var(--primary-50)",          color: "var(--primary)",               icon: <FileQuestion    size={28} style={iconStyle("var(--primary)")} /> },
  cad:  { bg: "var(--primary-50)",          color: "var(--primary)",               icon: <FileQuestion    size={28} style={iconStyle("var(--primary)")} /> },
  dxf:  { bg: "#EEF2FF",                    color: "#4F46E5",                       icon: <FileQuestion    size={28} style={iconStyle("#4F46E5")} /> },
  dwg:  { bg: "#EEF2FF",                    color: "#4F46E5",                       icon: <FileQuestion    size={28} style={iconStyle("#4F46E5")} /> },
  stl:  { bg: "#EEF2FF",                    color: "#4F46E5",                       icon: <FileQuestion    size={28} style={iconStyle("#4F46E5")} /> },
  url:  { bg: "var(--link-tag-bg, var(--primary-50))", color: "var(--link-tag-text, var(--primary))", icon: <Link2 size={28} style={iconStyle("var(--primary)")} /> },
  mp3:  { bg: "var(--reason-tag-bg)",       color: "var(--reason-tag-text)",        icon: <Music           size={28} style={iconStyle("var(--reason-tag-text)")} /> },
  mp4:  { bg: "var(--checked-out-tag-bg)",  color: "var(--checked-out-tag-text)",   icon: <Film            size={28} style={iconStyle("var(--checked-out-tag-text)")} /> },
};

export function getFileThumbnail(type: string): FileThumbnailConfig {
  return (
    FILE_THUMB[type as FileType] ?? {
      bg: "var(--surface-secondary)",
      color: "var(--text-secondary)",
      icon: <File size={28} style={{ color: "var(--text-secondary)", opacity: 0.7 }} />,
    }
  );
}

/* ── Date formatter ────────────────────────────────────────────────────── */

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatAttachmentDate(date: string, time: string): string {
  if (!date) return "";
  try {
    let yyyy: string | undefined;
    let mm: string;
    let dd: string;
    if (date.includes("-")) {
      [yyyy, mm, dd] = date.split("-");
    } else {
      [mm, dd, yyyy] = date.split("/");
    }
    if (!yyyy || !/^\d+$/.test(yyyy)) yyyy = String(new Date().getFullYear());
    if (!mm || !dd) return time ? `${date}, ${time}` : date;
    const monthIdx = parseInt(mm, 10) - 1;
    const monthLabel = monthIdx >= 0 && monthIdx < 12 ? MONTH_ABBR[monthIdx] : mm;
    return `${dd} ${monthLabel} ${yyyy}${time ? `, ${time.toLowerCase()}` : ""}`;
  } catch {
    return time ? `${date}, ${time}` : date;
  }
}
