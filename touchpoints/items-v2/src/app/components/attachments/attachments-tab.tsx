/**
 * AttachmentsTab — Item v2 Attachments tab (ported from Inventory Movement).
 * ────────────────────────────────────────────────────────────────────────────
 * Mechanical port of the Attachments tab from Inventory Movement's
 * `MovementDetailsPage.tsx`. All eleven sub-components (MOCK_ATTACHMENTS,
 * ATT_THUMB, DocumentPreview, AttachmentLike, AttachmentLocationPill,
 * SerialTooltip, AttachmentSerialPill, AttachmentCardItem, UploadingCard,
 * CardSize/FilePaneMode, FilePaneModeDropdown, AttachmentListHeader,
 * AttachmentInlineThumb, AttachmentListRow, and the upload handler) are
 * defined inline to mirror IM's monolithic style.
 *
 * Adaptations from source:
 *   • IM's bare CSS vars (--primary/--card/--border/etc.) swapped for
 *     Item v2's `--piw-*` HSL-safe tokens.
 *   • `linkedItem` (movement-owned) removed — Item v2 attachments live on the
 *     item, so item tags are meaningless. `location`/`linkedSerial` retained.
 *   • Uses Item v2's `AttachmentPreviewModal` (shape adapter in the caller).
 *   • Uses Item v2's `PersonHoverCard`.
 *   • Uses this folder's `LocationHoverCard` (self-contained port).
 *   • No IM `mockData`/`inventoryData` — locations are just codes/names on
 *     the mock attachments, no lookup needed.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Hash,
  MapPin,
  Upload,
  X,
  XCircle,
  Eye,
  Download,
  Trash2,
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileQuestion,
  MoreVertical,
  ChevronDown,
  Check,
  LayoutGrid,
  List,
  AlignJustify,
  Star,
  Image as ImageIcon,
} from "lucide-react";
import { AttachmentPreviewModal } from "./attachment-preview-modal";
import { DeleteAttachmentDialog } from "./delete-attachment-dialog";
import { PersonHoverCard } from "./person-hover-card";
import { LocationHoverCard, LocationDetailContext } from "./location-hover-card";

/* ═══════════════════════════════════════════════════════════════════════════
 * § 0  SHARED-UI INLINES (ported from IM's @/lib/shared-ui)
 * ═══════════════════════════════════════════════════════════════════════════ */

const FONT = "var(--font-inter)";

/** Shared highlight style — search-match mark. */
const HIGHLIGHT_STYLE: React.CSSProperties = {
  background: "#FEFCE8",
  color: "#854D0E",
  fontWeight: 500,
  borderRadius: "2px",
  padding: "0 1px",
};

/** Highlights the first occurrence of `query` inside `text`. */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || !query.trim()) return <>{text}</>;
  const q = query.toLowerCase().trim();
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return <>{text}</>;
  return (
    <>
      <span>{text.slice(0, idx)}</span>
      <mark style={HIGHLIGHT_STYLE}>{text.slice(idx, idx + q.length)}</mark>
      <span>{text.slice(idx + q.length)}</span>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 1  MOCK DATA
 *   `linkedItem` removed — attachments live on the item in Item v2.
 * ═══════════════════════════════════════════════════════════════════════════ */

const MOCK_ATTACHMENTS = [
  {
    id: "a1",
    name: "Item_Spec_Sheet.pdf",
    size: "245 KB",
    type: "PDF",
    uploadedBy: "Sam Chen",
    uploadedAt: "2026-03-05T09:20:00Z",
    previewUrl: "/samples/sample.pdf" as string | null,
    linkedSerial: null as string | null,
    location: "WH-D06",
    locationName: "Zone D Storage Area 6",
  },
  {
    id: "a2",
    name: "Manufacturing_Instructions.docx",
    size: "128 KB",
    type: "DOCX",
    uploadedBy: "Taylor Kim",
    uploadedAt: "2026-03-05T11:05:00Z",
    previewUrl: null as string | null,
    linkedSerial: null as string | null,
    location: "WH-A01",
    locationName: "Zone A Receiving Dock",
  },
  {
    id: "a3",
    name: "Product_Photo_Front.png",
    size: "1.8 MB",
    type: "PNG",
    uploadedBy: "Alex Morgan",
    uploadedAt: "2026-03-06T08:30:00Z",
    linkedSerial: "SN-8831B-2026-WHB03-000482-REVA-QCPASS" as string | null,
    previewUrl:
      "https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&q=80&auto=format&fit=crop" as string | null,
    location: "WH-B03",
    locationName: "Zone B Storage Area 3",
  },
  {
    id: "a4",
    name: "Inventory_Report_Q4_2026.xlsx",
    size: "340 KB",
    type: "XLSX",
    uploadedBy: "Jordan Lee",
    uploadedAt: "2026-03-04T14:00:00Z",
    previewUrl: null as string | null,
    linkedSerial: null as string | null,
    location: "WH-C02",
    locationName: "Zone C Bulk Storage",
  },
  {
    id: "a5",
    name: "Count_Sheet_WH_A01.pdf",
    size: "1.1 MB",
    type: "PDF",
    uploadedBy: "Casey Wang",
    uploadedAt: "2026-03-03T09:15:00Z",
    previewUrl: "/samples/sample.pdf" as string | null,
    linkedSerial: "SN-4420A-2026-WHA01-000119-BATCH7X-LOT22" as string | null,
    location: "WH-A01",
    locationName: "Zone A Storage Area 1",
  },
  {
    id: "a6",
    name: "Receiving_Photo_Dock3.jpg",
    size: "3.8 MB",
    type: "JPG",
    uploadedBy: "Riley Patel",
    uploadedAt: "2026-03-02T09:20:00Z",
    linkedSerial: null as string | null,
    previewUrl:
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80&auto=format&fit=crop" as string | null,
    location: "WH-D03",
    locationName: "Zone D Inbound Dock 3",
  },
  {
    id: "a7",
    name: "Assembly_Walkthrough.mp4",
    size: "12.6 MB",
    type: "MP4",
    uploadedBy: "Morgan Reid",
    uploadedAt: "2026-03-01T10:45:00Z",
    previewUrl: "https://www.w3schools.com/html/mov_bbb.mp4" as string | null,
    linkedSerial: null as string | null,
    location: "WH-E01",
    locationName: "Zone E Assembly Bay",
  },
  {
    id: "a8",
    name: "Voice_Note_QA.mp3",
    size: "980 KB",
    type: "MP3",
    uploadedBy: "Priya Sharma",
    uploadedAt: "2026-02-28T15:20:00Z",
    previewUrl: "https://www.w3schools.com/html/horse.mp3" as string | null,
    linkedSerial: null as string | null,
    location: "WH-B03",
    locationName: "Zone B Storage Area 3",
  },
  {
    id: "a9",
    name: "Enclosure_Blueprint.dxf",
    size: "352 KB",
    type: "DXF",
    uploadedBy: "Devon Blake",
    uploadedAt: "2026-02-27T13:10:00Z",
    previewUrl: "/samples/Tree_Of_Life.dxf" as string | null,
    linkedSerial: null as string | null,
    location: "WH-C02",
    locationName: "Zone C Bulk Storage",
  },
  {
    id: "a10",
    name: "Mounting_Bracket.stl",
    size: "1.2 KB",
    type: "STL",
    uploadedBy: "Sydney Stone",
    uploadedAt: "2026-02-26T09:00:00Z",
    previewUrl: "/samples/Sample_Model.stl" as string | null,
    linkedSerial: null as string | null,
    location: "WH-C02",
    locationName: "Zone C Bulk Storage",
  },
  {
    id: "a11",
    name: "Legacy_Chassis.dwg",
    size: "138 KB",
    type: "DWG",
    uploadedBy: "Rachel Wong",
    uploadedAt: "2026-02-25T11:35:00Z",
    previewUrl: "/samples/Nissan_Fairlady_Z.dwg" as string | null,
    linkedSerial: null as string | null,
    location: "WH-C02",
    locationName: "Zone C Bulk Storage",
  },
  {
    id: "a12",
    name: "Release_Notes.txt",
    size: "8 KB",
    type: "TXT",
    uploadedBy: "Kevin Ogutu",
    uploadedAt: "2026-02-24T16:50:00Z",
    previewUrl: null as string | null,
    linkedSerial: null as string | null,
    location: "WH-A01",
    locationName: "Zone A Storage Area 1",
  },
  {
    id: "a13",
    name: "BOM_Snapshot.csv",
    size: "42 KB",
    type: "CSV",
    uploadedBy: "Sofia Patel",
    uploadedAt: "2026-02-23T08:15:00Z",
    previewUrl: null as string | null,
    linkedSerial: null as string | null,
    location: "WH-C02",
    locationName: "Zone C Bulk Storage",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
 * § 2  FILE-TYPE THUMBNAIL MAP
 * ═══════════════════════════════════════════════════════════════════════════ */

const ATT_THUMB: Record<
  string,
  { bg: string; color: string; Icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties }> }
> = {
  PDF:  { bg: "rgba(255,69,58,0.08)", color: "#ef4444", Icon: FileText },
  DOC:  { bg: "rgba(37,99,235,0.08)", color: "var(--piw-primary)", Icon: FileText },
  DOCX: { bg: "rgba(37,99,235,0.08)", color: "var(--piw-primary)", Icon: FileText },
  TXT:  { bg: "rgba(100,116,139,0.08)", color: "#64748b", Icon: FileText },
  PNG:  { bg: "rgba(34,197,94,0.08)", color: "#22c55e", Icon: FileImage },
  JPG:  { bg: "rgba(34,197,94,0.08)", color: "#22c55e", Icon: FileImage },
  XLSX: { bg: "rgba(34,197,94,0.08)", color: "#22c55e", Icon: FileSpreadsheet },
  CSV:  { bg: "rgba(34,197,94,0.08)", color: "#16a34a", Icon: FileSpreadsheet },
  MP4:  { bg: "rgba(139,92,246,0.08)", color: "#8b5cf6", Icon: File },
  MP3:  { bg: "rgba(236,72,153,0.08)", color: "#ec4899", Icon: File },
  DXF:  { bg: "rgba(20,184,166,0.08)", color: "#14b8a6", Icon: File },
  DWG:  { bg: "rgba(20,184,166,0.08)", color: "#14b8a6", Icon: File },
  STL:  { bg: "rgba(6,182,212,0.08)", color: "#06b6d4", Icon: File },
};

/* ═══════════════════════════════════════════════════════════════════════════
 * § 3  DOCUMENT PREVIEW  (matches PI's AttachmentCard DocumentPreview)
 * ═══════════════════════════════════════════════════════════════════════════ */

const MOCK_DOC_TITLE = (fileName: string) => fileName.replace(/\.[^.]+$/, "");
const MOCK_DOC_META = `Generated on ${new Date().toLocaleDateString()} — Internal document for inventory operations.`;
const MOCK_DOC_SECTIONS = [
  {
    heading: "1. Overview",
    body: "This document describes the contents and intent of the attached file. It is provided for in-app preview only; please download the original to access the canonical version with full formatting, embedded objects, and revision history.",
  },
  {
    heading: "2. Scope",
    body: "The attached material covers receiving, putaway, cycle counting, and adjustment workflows across all warehouse locations. It supersedes all prior revisions.",
  },
];

function DocumentPreview({
  type,
  bg,
  color,
  fileName = "",
}: {
  type: string;
  bg: string;
  color: string;
  fileName?: string;
}) {
  const t = type.toLowerCase();
  const isSpreadsheet = t === "xlsx" || t === "csv" || t === "xls";
  const isImage = t === "jpg" || t === "png" || t === "jpeg";
  const isDocLike = t === "pdf" || t === "txt" || t === "docx" || t === "doc";
  const isArchive = t === "zip" || t === "rar";

  if (isArchive) {
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
              background: "var(--piw-primary)",
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
            <FileQuestion size={20} style={{ color: "var(--piw-primary)", opacity: 0.85 }} />
          </div>
        </div>
      </div>
    );
  }

  if (isSpreadsheet) {
    const gridLine = "#E1E3E6";
    const headerBg = "#F8F9FA";
    const headerText = "#5F6368";
    const COLS = ["A", "B", "C", "D", "E", "F", "G"];
    const ROW_CONTENT: Record<
      number,
      Record<number, { text: string; bold?: boolean; size?: number; color?: string }>
    > = {
      1: { 1: { text: "Inventory Report", bold: true, size: 8, color: "#1f2937" } },
      2: { 1: { text: "Movement records · Q1 2026", size: 5.5, color: "#6b7280" } },
      6: { 1: { text: "OVERVIEW", bold: true, size: 5.5, color: "#1f6feb" } },
      8: {
        1: { text: "SKU", bold: true, size: 5.5 },
        2: { text: "WID-1001", size: 5, color: "#374151" },
        3: { text: "Widget Mk II", size: 5, color: "#374151" },
      },
      10: {
        1: { text: "SKU", bold: true, size: 5.5 },
        2: { text: "BOLT-22", size: 5, color: "#374151" },
        3: { text: "Stainless Bolt", size: 5, color: "#374151" },
      },
      12: {
        1: { text: "SKU", bold: true, size: 5.5 },
        2: { text: "CABL-7", size: 5, color: "#374151" },
        3: { text: "Power Cable", size: 5, color: "#374151" },
      },
    };
    const BAND_ROWS = new Set([6]);
    return (
      <div
        className="w-full h-full"
        style={{ background: "white", position: "relative", overflow: "hidden" }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            fontFamily: FONT,
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
            {Array.from({ length: 14 }).map((_, r) => {
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

  if (isDocLike) {
    return (
      <div
        className="w-full h-full"
        style={{
          background: "white",
          position: "relative",
          overflow: "hidden",
          padding: "10px 12px 0 12px",
          fontFamily: FONT,
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
            WebkitBoxOrient: "vertical" as React.CSSProperties["WebkitBoxOrient"],
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
                WebkitBoxOrient: "vertical" as React.CSSProperties["WebkitBoxOrient"],
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

  /* Video (MP4/MOV/WEBM) — dark strip with center play glyph + timeline. */
  const isVideo = t === "mp4" || t === "mov" || t === "webm";
  if (isVideo) {
    return (
      <div
        className="relative flex items-center justify-center w-full h-full"
        style={{
          background:
            "linear-gradient(135deg, rgba(139,92,246,0.14) 0%, rgba(59,130,246,0.10) 100%)",
          overflow: "hidden",
        }}
      >
        {/* Film-strip perforations top + bottom */}
        <div
          aria-hidden
          style={{
            position: "absolute", top: 6, left: 0, right: 0, height: 6,
            display: "flex", justifyContent: "space-around", opacity: 0.35,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={`t${i}`} style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
          ))}
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute", bottom: 6, left: 0, right: 0, height: 6,
            display: "flex", justifyContent: "space-around", opacity: 0.35,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={`b${i}`} style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
          ))}
        </div>
        {/* Play button */}
        <div
          style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "rgba(255,255,255,0.92)",
            border: `1px solid ${color}33`,
            boxShadow: "0 4px 12px rgba(15,23,41,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path d="M4.5 3 L14 9 L4.5 15 Z" fill={color} />
          </svg>
        </div>
      </div>
    );
  }

  /* Audio (MP3/WAV/OGG) — waveform bars over a soft pink/purple wash. */
  const isAudio = t === "mp3" || t === "wav" || t === "ogg" || t === "m4a";
  if (isAudio) {
    const bars = [
      6, 10, 16, 22, 30, 24, 18, 12, 20, 26, 34, 30, 24, 16, 10, 14, 22, 28,
      34, 30, 22, 14, 10, 18, 26, 32, 26, 20, 14, 8,
    ];
    return (
      <div
        className="relative flex items-center justify-center w-full h-full"
        style={{
          background:
            "linear-gradient(135deg, rgba(236,72,153,0.10) 0%, rgba(139,92,246,0.10) 100%)",
          overflow: "hidden",
          padding: "0 10%",
        }}
      >
        <div
          aria-hidden
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 2, width: "100%",
          }}
        >
          {bars.map((h, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                width: 3,
                height: `${h}%`,
                minHeight: 4,
                borderRadius: 2,
                background: color,
                opacity: 0.55 + (h / 68) * 0.4,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* CAD (DXF/DWG/STL) — isometric wireframe cube on a teal wash. */
  const isCad = t === "dxf" || t === "dwg" || t === "stl" || t === "cad" || t === "step" || t === "iges" || t === "igs";
  if (isCad) {
    return (
      <div
        className="relative flex items-center justify-center w-full h-full"
        style={{
          background: "linear-gradient(135deg, rgba(20,184,166,0.10) 0%, rgba(6,182,212,0.10) 100%)",
          overflow: "hidden",
        }}
      >
        <svg width="66" height="66" viewBox="0 0 100 100" aria-hidden style={{ opacity: 0.85 }}>
          {/* Isometric cube — top face */}
          <path d="M50 12 L84 32 L50 52 L16 32 Z" fill="none" stroke={color} strokeWidth="2" />
          {/* Left face */}
          <path d="M16 32 L16 68 L50 88 L50 52 Z" fill="none" stroke={color} strokeWidth="2" />
          {/* Right face */}
          <path d="M84 32 L84 68 L50 88 L50 52 Z" fill="none" stroke={color} strokeWidth="2" />
          {/* Inner grid lines to hint mesh */}
          <path d="M33 22 L67 42 M33 42 L67 22" stroke={color} strokeWidth="1" opacity="0.4" />
          <path d="M33 60 L33 78 M67 60 L67 78 M50 70 L50 88" stroke={color} strokeWidth="1" opacity="0.4" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full h-full" style={{ background: bg }}>
      <FileQuestion size={28} style={{ color, opacity: 0.5 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 4  ATTACHMENT TYPES
 * ═══════════════════════════════════════════════════════════════════════════ */

type AttachmentLike = {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
  previewUrl?: string | null;
  uploading?: boolean;
  progress?: number;
  location?: string | null;
  locationName?: string | null;
  linkedSerial?: string | null;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * § 5  LINKED-LOCATION PILL (attachment source pill)
 * ═══════════════════════════════════════════════════════════════════════════ */

function AttachmentLocationPill({
  code,
  name,
  searchQuery: sq,
}: {
  code?: string | null;
  name?: string | null;
  searchQuery?: string;
}) {
  const openLocation = React.useContext(LocationDetailContext);
  if (!code) return null;
  const interactive = !!openLocation;
  const pill = (
    <button
      type="button"
      className="inline-flex items-center"
      title={name ? `${code} — ${name}` : code}
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation();
              openLocation!(code, name ?? undefined);
            }
          : undefined
      }
      style={{
        maxWidth: "100%",
        padding: "1px var(--spacing-1-5)",
        borderRadius: "9999px",
        background: "var(--surface-secondary)",
        border: "1px solid var(--piw-border)",
        fontFamily: FONT,
        fontWeight: "var(--font-weight-medium)",
        fontSize: "10px",
        color: "var(--text-secondary)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        gap: "3px",
        cursor: interactive ? "pointer" : "default",
        transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
      }}
      onMouseEnter={
        interactive
          ? (e) => {
              e.currentTarget.style.background = "var(--primary-50)";
              e.currentTarget.style.borderColor = "var(--primary-200)";
              e.currentTarget.style.color = "var(--piw-primary)";
            }
          : undefined
      }
      onMouseLeave={
        interactive
          ? (e) => {
              e.currentTarget.style.background = "var(--surface-secondary)";
              e.currentTarget.style.borderColor = "var(--piw-border)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }
          : undefined
      }
    >
      <MapPin size={10} style={{ flexShrink: 0 }} />
      {sq ? highlightMatch(code, sq) : code}
    </button>
  );
  return (
    <LocationHoverCard code={code} name={name ?? undefined}>
      {pill}
    </LocationHoverCard>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 6  SERIAL TOOLTIP  (portal-positioned, instant on hover)
 * ═══════════════════════════════════════════════════════════════════════════ */

function SerialTooltip({ serial, children }: { serial: string; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const show = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: r.left + r.width / 2, y: r.top });
  }, []);
  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseMove={pos ? undefined : show}
      onMouseLeave={() => setPos(null)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minWidth: 0,
        maxWidth: "100%",
        gap: "3px",
      }}
    >
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.y - 8,
              transform: "translate(-50%, -100%)",
              zIndex: 10000,
              pointerEvents: "none",
              background: "#FFFFFF",
              color: "#0F172A",
              padding: "5px 9px",
              borderRadius: "6px",
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
              boxShadow:
                "0 4px 12px -2px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.12)",
            }}
          >
            {serial}
            <span
              style={{
                position: "absolute",
                left: "50%",
                top: "100%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "5px solid #FFFFFF",
              }}
            />
          </div>,
          document.body,
        )}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 7  LINKED-SERIAL PILL  (sits next to the location pill)
 * ═══════════════════════════════════════════════════════════════════════════ */

function AttachmentSerialPill({
  serial,
  searchQuery: sq,
}: {
  serial?: string | null;
  searchQuery?: string;
}) {
  if (!serial) return null;
  return (
    <SerialTooltip serial={serial}>
      <span
        className="inline-flex items-center"
        style={{
          maxWidth: "100%",
          minWidth: 0,
          padding: "1px var(--spacing-1-5)",
          borderRadius: "9999px",
          background: "var(--surface-secondary)",
          border: "1px solid var(--piw-border)",
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          fontWeight: "var(--font-weight-medium)",
          fontSize: "10px",
          color: "var(--text-secondary)",
          gap: "3px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <Hash size={10} style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {sq ? highlightMatch(serial, sq) : serial}
        </span>
      </span>
    </SerialTooltip>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 8  ATTACHMENT CARD ITEM  (Card grid mode)
 * ═══════════════════════════════════════════════════════════════════════════ */

function AttachmentCardItem({
  file,
  onDelete,
  onPreview,
  onSetThumbnail,
  isThumbnail = false,
  searchQuery: sq,
  thumbHeight = "clamp(100px, 12vw, 180px)",
}: {
  file: AttachmentLike;
  onDelete?: () => void;
  onPreview?: () => void;
  onSetThumbnail?: () => void;
  isThumbnail?: boolean;
  searchQuery?: string;
  thumbHeight?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const tb =
    ATT_THUMB[file.type] ?? { bg: "var(--surface-secondary)", color: "var(--text-secondary)", Icon: File };
  const isImageType = file.type === "PNG" || file.type === "JPG";
  const hasImagePreview = !!file.previewUrl && isImageType;

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <div
      className="relative flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-card-menu]")) return;
        onPreview?.();
      }}
      style={{
        minWidth: 0,
        borderRadius: "var(--radius-lg)",
        background: "var(--piw-card)",
        border: `1px solid ${hovered ? "var(--primary-200)" : "var(--piw-border)"}`,
        boxShadow: hovered
          ? "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)"
          : "0px 1px 2px 0px rgba(16,24,40,0.04)",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        cursor: "pointer",
      }}
    >
      {/* Thumbnail preview */}
      <div
        className="relative shrink-0 w-full"
        style={{
          height: thumbHeight,
          borderTopLeftRadius: "calc(var(--radius-lg) - 1px)",
          borderTopRightRadius: "calc(var(--radius-lg) - 1px)",
          overflow: "hidden",
          background: tb.bg,
        }}
      >
        {hasImagePreview ? (
          <img
            src={file.previewUrl!}
            alt={file.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <DocumentPreview type={file.type} bg={tb.bg} color={tb.color} fileName={file.name} />
        )}
        {/* File extension badge — bottom-left, white pill */}
        <span
          className="absolute"
          style={{
            bottom: "var(--spacing-1-5)",
            left: "var(--spacing-1-5)",
            padding: "1px var(--spacing-1)",
            borderRadius: "var(--radius-xs)",
            background: "#FFFFFF",
            border: "1px solid var(--piw-border)",
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 9,
            color: tb.color,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            boxShadow: hasImagePreview ? "0 1px 2px rgba(0,0,0,0.18)" : undefined,
            zIndex: 2,
          }}
        >
          {file.type}
        </span>
        {hasImagePreview && hovered && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.25)", pointerEvents: "none" }}
          >
            <Eye size={20} style={{ color: "#FFF", opacity: 0.9 }} />
          </div>
        )}
        {isThumbnail && (
          <span
            className="absolute inline-flex items-center"
            title="Current thumbnail"
            aria-label="Current thumbnail"
            style={{
              top: "var(--spacing-1-5)",
              left: "var(--spacing-1-5)",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 999,
              background: "rgba(15,23,41,0.55)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              color: "#FFFFFF",
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: "0.03em",
              textShadow: "0 1px 1px rgba(0,0,0,0.35)",
              zIndex: 3,
            }}
          >
            <ImageIcon size={11} strokeWidth={2.25} /> Thumbnail
          </span>
        )}
      </div>

      {/* File info + actions */}
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
          <p
            className="overflow-hidden"
            style={{
              fontFamily: FONT,
              fontWeight: "var(--font-weight-medium)",
              fontSize: "var(--text-body-sm)",
              color: "var(--piw-foreground)",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              margin: 0,
              lineHeight: 1.3,
            }}
            title={file.name}
          >
            {sq ? highlightMatch(file.name, sq) : file.name}
          </p>
          <div className="flex flex-col" style={{ gap: "1px" }}>
            <p
              className="overflow-hidden"
              style={{
                fontFamily: FONT,
                fontWeight: "var(--font-weight-normal)",
                fontSize: "var(--text-caption)",
                color: "var(--text-tertiary)",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {new Date(file.uploadedAt).toLocaleDateString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
              })}{" "}
              {new Date(file.uploadedAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
            <p
              className="overflow-hidden"
              style={{
                fontFamily: FONT,
                fontWeight: "var(--font-weight-normal)",
                fontSize: "var(--text-caption)",
                color: "var(--text-tertiary)",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {file.size} · {sq ? highlightMatch(file.uploadedBy, sq) : file.uploadedBy}
            </p>
          </div>
        </div>

        <div ref={menuRef} data-card-menu className="relative shrink-0" style={{ marginTop: "1px" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((p) => !p);
            }}
            className="flex items-center justify-center"
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "var(--radius-xs)",
              cursor: "pointer",
              border: "none",
              background: "transparent",
              opacity: hovered || menuOpen ? 1 : 0,
              transition: "opacity 0.12s ease, background-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "hsl(210,100%,96%)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <MoreVertical size={14} style={{ color: "var(--text-secondary)" }} />
          </button>
          {menuOpen && (
            <div
              className="absolute z-50"
              style={{
                top: "calc(100% + 2px)",
                right: 0,
                minWidth: "170px",
                borderRadius: "var(--radius-md)",
                background: "var(--piw-card)",
                border: "1px solid var(--piw-border)",
                boxShadow: "0 8px 24px rgba(16,24,40,0.10), 0 2px 6px rgba(16,24,40,0.06)",
                padding: "var(--spacing-1)",
              }}
            >
              {hasImagePreview && onSetThumbnail && !isThumbnail && (
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
                    fontFamily: FONT,
                    fontWeight: 500,
                    fontSize: "var(--text-caption)",
                    color: "var(--piw-foreground)",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "hsl(210,100%,96%)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onSetThumbnail();
                  }}
                >
                  <ImageIcon size={13} style={{ color: "var(--text-secondary)" }} /> Set as thumbnail
                </button>
              )}
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
                  fontFamily: FONT,
                  fontWeight: 500,
                  fontSize: "var(--text-caption)",
                  color: "var(--piw-foreground)",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "hsl(210,100%,96%)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onPreview?.();
                }}
              >
                <Eye size={13} style={{ color: "var(--text-secondary)" }} /> Preview
              </button>
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
                  fontFamily: FONT,
                  fontWeight: 500,
                  fontSize: "var(--text-caption)",
                  color: "var(--piw-foreground)",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "hsl(210,100%,96%)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              >
                <Download size={13} style={{ color: "var(--text-secondary)" }} /> Download
              </button>
              {onDelete && (
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
                    fontFamily: FONT,
                    fontWeight: 500,
                    fontSize: "var(--text-caption)",
                    color: "#DC2626",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "hsl(210,100%,96%)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  <Trash2 size={13} style={{ color: "#DC2626" }} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 9  UPLOADING CARD  (shimmer placeholder while uploading)
 * ═══════════════════════════════════════════════════════════════════════════ */

function UploadingCard({
  fileName,
  fileSize,
  ext,
  progress,
  onCancel,
  thumbHeight = "clamp(100px, 12vw, 180px)",
}: {
  fileName: string;
  fileSize: string;
  ext: string;
  progress: number;
  onCancel: () => void;
  thumbHeight?: string;
}) {
  return (
    <div
      className="relative flex flex-col"
      style={{
        minWidth: 0,
        borderRadius: "var(--radius-lg)",
        background: "var(--piw-card)",
        border: "1px solid var(--piw-border)",
        boxShadow: "0px 1px 2px 0px rgba(16,24,40,0.04)",
      }}
    >
      <div
        className="relative shrink-0 w-full flex items-center justify-center overflow-hidden"
        style={{
          height: thumbHeight,
          borderTopLeftRadius: "calc(var(--radius-lg) - 1px)",
          borderTopRightRadius: "calc(var(--radius-lg) - 1px)",
          background:
            "linear-gradient(110deg, var(--surface-secondary) 8%, hsl(210,16%,93%) 18%, var(--surface-secondary) 33%)",
          backgroundSize: "200% 100%",
          animation: "itemAttUploadShimmer 1.2s linear infinite",
        }}
      >
        <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
          <svg
            width="56"
            height="56"
            viewBox="0 0 56 56"
            style={{ position: "absolute", inset: 0 }}
            aria-hidden
          >
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="rgba(15,23,41,0.08)"
              strokeWidth="4"
            />
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="var(--piw-primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 24}
              strokeDashoffset={
                2 * Math.PI * 24 * (1 - Math.min(100, Math.max(0, progress)) / 100)
              }
              style={{
                transformOrigin: "center",
                transform: "rotate(-90deg)",
                transition: "stroke-dashoffset 160ms linear",
              }}
            />
          </svg>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--piw-primary)",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {Math.min(100, Math.max(0, Math.round(progress)))}%
          </span>
        </div>
        <span
          className="absolute"
          style={{
            bottom: "var(--spacing-1-5)",
            left: "var(--spacing-1-5)",
            padding: "1px var(--spacing-1)",
            borderRadius: "var(--radius-xs)",
            background: "#FFFFFF",
            border: "1px solid var(--piw-border)",
            fontWeight: 600,
            fontSize: 9,
            color: "var(--text-secondary)",
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
          className="absolute flex items-center justify-center"
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
          }}
        >
          <X size={12} />
        </button>
      </div>
      <div
        className="flex flex-col w-full"
        style={{
          padding: "var(--spacing-1-5) var(--spacing-2) var(--spacing-2)",
          gap: "var(--spacing-1-5)",
        }}
      >
        <div
          aria-hidden
          style={{
            height: "calc(var(--text-body-sm) * 1.3)",
            width: `${60 + ((fileName.length * 7) % 30)}%`,
            maxWidth: "100%",
            borderRadius: 4,
            background:
              "linear-gradient(110deg, var(--surface-secondary) 8%, hsl(210,16%,93%) 18%, var(--surface-secondary) 33%)",
            backgroundSize: "200% 100%",
            animation: "itemAttUploadShimmer 1.2s linear infinite",
          }}
        />
        <div
          aria-hidden
          style={{
            height: "calc(var(--text-caption) * 1.3)",
            width: 56,
            borderRadius: 4,
            background:
              "linear-gradient(110deg, var(--surface-secondary) 8%, hsl(210,16%,93%) 18%, var(--surface-secondary) 33%)",
            backgroundSize: "200% 100%",
            animation: "itemAttUploadShimmer 1.2s linear infinite",
          }}
        />
        <span className="sr-only" title={fileName}>
          {fileName} ({fileSize})
        </span>
      </div>
      <style>{`@keyframes itemAttUploadShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 10  FILE PANE MODE DROPDOWN
 * ═══════════════════════════════════════════════════════════════════════════ */

type CardSize = "small" | "medium" | "large";
type FilePaneMode = "condensed" | "comfort" | "card";

const CARD_SIZE_COLUMNS: Record<CardSize, string> = {
  large: "repeat(auto-fill, minmax(360px, 1fr))",
  medium: "repeat(auto-fill, minmax(240px, 1fr))",
  small: "repeat(auto-fill, minmax(170px, 1fr))",
};
const CARD_SIZE_THUMB: Record<CardSize, string> = {
  small: "clamp(80px, 9vw, 120px)",
  medium: "clamp(100px, 12vw, 160px)",
  large: "clamp(140px, 16vw, 220px)",
};

const FILE_PANE_OPTIONS: {
  key: FilePaneMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  { key: "condensed", label: "Condensed", description: "Compact list view", icon: <List size={18} /> },
  { key: "comfort", label: "Comfort", description: "Spacious list view", icon: <AlignJustify size={18} /> },
  { key: "card", label: "Card", description: "Sized card grid", icon: <LayoutGrid size={18} /> },
];

function FilePaneModeDropdown({
  value,
  onChange,
  cardSize,
  onCardSizeChange,
}: {
  value: FilePaneMode;
  onChange: (v: FilePaneMode) => void;
  cardSize: CardSize;
  onCardSizeChange: (s: CardSize) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const current = FILE_PANE_OPTIONS.find((o) => o.key === value)!;
  const triggerIcon =
    value === "condensed" ? (
      <List size={14} style={{ color: "var(--text-secondary)" }} />
    ) : value === "comfort" ? (
      <AlignJustify size={14} style={{ color: "var(--text-secondary)" }} />
    ) : (
      <LayoutGrid size={14} style={{ color: "var(--text-secondary)" }} />
    );

  return (
    <div ref={ref} className="relative shrink-0" style={{ width: 130 }}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center w-full transition-colors"
        style={{
          height: 34,
          padding: "0 var(--spacing-2-5)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--piw-border)",
          background: open ? "hsl(210,100%,96%)" : "var(--piw-card)",
          cursor: "pointer",
          gap: "var(--spacing-1-5)",
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: "var(--text-caption)",
          color: "var(--piw-foreground)",
          boxShadow: "0 1px 2px 0 rgba(16,24,40,0.05)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "hsl(210,100%,96%)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = open ? "hsl(210,100%,96%)" : "var(--piw-card)";
        }}
      >
        {triggerIcon}
        {current.label}
        <ChevronDown
          size={11}
          style={{
            marginLeft: "auto",
            color: "var(--text-tertiary)",
            transition: "transform 0.15s ease",
            transform: open ? "rotate(180deg)" : "rotate(0)",
          }}
        />
      </button>
      {open && (
        <div
          className="absolute z-50"
          style={{
            top: "calc(100% + 4px)",
            right: 0,
            width: 240,
            borderRadius: "var(--radius-md)",
            background: "var(--piw-card)",
            border: "1px solid var(--piw-border)",
            boxShadow: "0 8px 24px rgba(16,24,40,0.10), 0 2px 6px rgba(16,24,40,0.06)",
            padding: "var(--spacing-1-5)",
          }}
        >
          {FILE_PANE_OPTIONS.map((opt) => {
            const isActive = opt.key === value;
            return (
              <button
                key={opt.key}
                onClick={() => {
                  onChange(opt.key);
                  if (opt.key !== "card") setOpen(false);
                }}
                className="flex items-center w-full transition-colors hover:bg-[hsl(210,100%,96%)]"
                style={{
                  padding: "var(--spacing-2) var(--spacing-2-5)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  border: "none",
                  background: "transparent",
                  gap: "var(--spacing-2-5)",
                  fontFamily: FONT,
                  textAlign: "left",
                }}
              >
                <span style={{ color: "var(--text-secondary)", display: "flex", flexShrink: 0 }}>
                  {opt.icon}
                </span>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "var(--text-body-sm)",
                      color: "var(--piw-foreground)",
                      lineHeight: 1.2,
                    }}
                  >
                    {opt.label}
                  </span>
                  <span
                    style={{
                      fontWeight: 400,
                      fontSize: "var(--text-caption)",
                      color: "var(--text-tertiary)",
                      lineHeight: 1.2,
                    }}
                  >
                    {opt.description}
                  </span>
                </div>
                {isActive && (
                  <Check size={15} style={{ color: "var(--piw-primary)", flexShrink: 0 }} />
                )}
              </button>
            );
          })}
          {value === "card" && (
            <>
              <div
                style={{
                  borderTop: "1px solid var(--piw-border)",
                  margin: "var(--spacing-1-5) var(--spacing-1)",
                }}
              />
              <div style={{ padding: "var(--spacing-1) var(--spacing-2)" }}>
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: "var(--spacing-1-5)",
                  }}
                >
                  Card Size
                </div>
                <div style={{ display: "flex", gap: "var(--spacing-1)" }}>
                  {(["large", "medium", "small"] as const).map((size) => {
                    const active = cardSize === size;
                    return (
                      <button
                        key={size}
                        onClick={() => onCardSizeChange(size)}
                        style={{
                          flex: 1,
                          padding: "6px 0",
                          borderRadius: "var(--radius-sm)",
                          fontFamily: FONT,
                          fontSize: 11,
                          fontWeight: active ? 600 : 500,
                          cursor: "pointer",
                          border: "none",
                          background: active ? "var(--piw-primary)" : "var(--surface-secondary)",
                          color: active ? "var(--piw-primary-foreground)" : "var(--text-secondary)",
                          transition: "all 0.15s",
                        }}
                      >
                        {size === "large" ? "Large" : size === "medium" ? "Medium" : "Small"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 11  LIST HEADER  (condensed / comfort)
 * ═══════════════════════════════════════════════════════════════════════════ */

function AttachmentListHeader() {
  const cell: React.CSSProperties = {
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "left",
  };
  return (
    <div
      className="flex items-center sticky top-0 z-10"
      style={{
        padding: "calc(var(--spacing-1-5) + 2px) var(--spacing-3)",
        borderBottom: "1px solid var(--piw-border)",
        background: "#f8fafc",
        columnGap: 2,
      }}
    >
      <div className="flex-1 min-w-0" style={cell}>
        File Name
      </div>
      <div className="shrink-0" style={{ ...cell, width: 70 }}>
        Size
      </div>
      <div className="shrink-0" style={{ ...cell, width: 150 }}>
        Date
      </div>
      <div className="shrink-0" style={{ ...cell, width: 140 }}>
        Uploaded By
      </div>
      <div className="shrink-0" style={{ width: 36 }} />
    </div>
  );
}

/* ─── Avatar helpers ─── */
function _avInitials(n: string) {
  const p = n.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}
function _avColor(n: string) {
  const palette = [
    "#6366F1",
    "#0EA5E9",
    "#14B8A6",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#10B981",
    "#EC4899",
  ];
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function _formatAttDate(iso: string) {
  try {
    const d = new Date(iso);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}, ${h}:${m} ${ampm}`;
  } catch {
    return iso;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 12  INLINE THUMBNAIL  (36×36, list view)
 * ═══════════════════════════════════════════════════════════════════════════ */

function AttachmentInlineThumb({ file }: { file: AttachmentLike }) {
  const tb =
    ATT_THUMB[file.type] ?? { bg: "var(--surface-secondary)", color: "var(--text-secondary)", Icon: File };
  const Icon = tb.Icon;
  const isImg = (file.type === "PNG" || file.type === "JPG") && !!file.previewUrl;
  return (
    <div
      className="shrink-0 relative overflow-hidden flex items-center justify-center"
      style={{
        width: 36,
        height: 36,
        borderRadius: "var(--radius-sm)",
        background: tb.bg,
        border: "1px solid var(--piw-border)",
      }}
    >
      {isImg ? (
        <img
          src={file.previewUrl!}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <Icon size={16} style={{ color: tb.color }} />
      )}
      <span
        className="absolute"
        style={{
          bottom: 1,
          right: 1,
          padding: "0 2px",
          borderRadius: 2,
          background: "#FFFFFF",
          border: "1px solid var(--piw-border)",
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 7,
          color: tb.color,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          lineHeight: "11px",
          boxShadow: isImg ? "0 1px 2px rgba(0,0,0,0.18)" : undefined,
        }}
      >
        {file.type}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 13  LIST ROW  (condensed / comfort)
 * ═══════════════════════════════════════════════════════════════════════════ */

function AttachmentListRow({
  file,
  density,
  onPreview,
  onDelete,
  onSetThumbnail,
  isThumbnail = false,
  searchQuery: sq,
}: {
  file: AttachmentLike;
  density: "condensed" | "comfort";
  onPreview: () => void;
  onDelete: () => void;
  onSetThumbnail?: () => void;
  isThumbnail?: boolean;
  searchQuery?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasImagePreview = !!file.previewUrl && (file.type === "PNG" || file.type === "JPG");
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);
  const py = density === "comfort" ? "var(--spacing-3)" : "calc(var(--spacing-1-5) + 1px)";
  return (
    <div
      className="flex items-center transition-colors"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-row-menu]")) return;
        onPreview();
      }}
      style={{
        padding: `${py} var(--spacing-3)`,
        borderBottom: "1px solid color-mix(in srgb, var(--piw-border) 50%, transparent)",
        background: hovered ? "var(--primary-50)" : "transparent",
        cursor: "pointer",
        columnGap: 2,
      }}
    >
      <div className="flex items-center flex-1 min-w-0" style={{ gap: "var(--spacing-2-5)" }}>
        <AttachmentInlineThumb file={file} />
        <div className="flex flex-col min-w-0" style={{ gap: 3 }}>
          <span
            className="truncate"
            style={{
              fontFamily: FONT,
              fontWeight: 500,
              fontSize: "var(--text-caption)",
              color: "var(--piw-foreground)",
              lineHeight: 1.3,
            }}
            title={file.name}
          >
            {sq ? highlightMatch(file.name, sq) : file.name}
          </span>
        </div>
      </div>
      <span
        className="shrink-0"
        style={{
          width: 70,
          fontFamily: FONT,
          fontSize: "var(--text-caption)",
          color: "var(--text-secondary)",
        }}
      >
        {file.size}
      </span>
      <span
        className="shrink-0"
        style={{
          width: 150,
          fontFamily: FONT,
          fontSize: "var(--text-caption)",
          color: "var(--text-tertiary)",
        }}
      >
        {_formatAttDate(file.uploadedAt)}
      </span>
      <div
        className="shrink-0 flex items-center"
        style={{ width: 140, minWidth: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <PersonHoverCard name={file.uploadedBy} showAvatar avatarSize={20} size="caption" />
      </div>
      <div
        ref={menuRef}
        data-row-menu
        className="relative shrink-0"
        style={{ width: 36, display: "flex", justifyContent: "center" }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((p) => !p);
          }}
          className="flex items-center justify-center"
          style={{
            width: 24,
            height: 24,
            borderRadius: "var(--radius-xs)",
            cursor: "pointer",
            border: "none",
            background: "transparent",
            opacity: hovered || menuOpen ? 1 : 0,
            transition: "opacity 0.1s ease, background-color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "hsl(210,100%,96%)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <MoreVertical size={14} style={{ color: "var(--text-secondary)" }} />
        </button>
        {menuOpen && (
          <div
            className="absolute z-50"
            style={{
              top: "calc(100% + 2px)",
              right: 0,
              minWidth: 170,
              borderRadius: "var(--radius-md)",
              background: "var(--piw-card)",
              border: "1px solid var(--piw-border)",
              boxShadow: "0 8px 24px rgba(16,24,40,0.10), 0 2px 6px rgba(16,24,40,0.06)",
              padding: "var(--spacing-1)",
            }}
          >
            {hasImagePreview && onSetThumbnail && !isThumbnail && (
              <button
                className="flex items-center w-full"
                style={{
                  height: 30,
                  padding: "0 var(--spacing-2)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  border: "none",
                  background: "transparent",
                  gap: "var(--spacing-1-5)",
                  fontFamily: FONT,
                  fontWeight: 500,
                  fontSize: "var(--text-caption)",
                  color: "var(--piw-foreground)",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "hsl(210,100%,96%)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onSetThumbnail();
                }}
              >
                <ImageIcon size={13} style={{ color: "var(--text-secondary)" }} /> Set as thumbnail
              </button>
            )}
            <button
              className="flex items-center w-full"
              style={{
                height: 30,
                padding: "0 var(--spacing-2)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                border: "none",
                background: "transparent",
                gap: "var(--spacing-1-5)",
                fontFamily: FONT,
                fontWeight: 500,
                fontSize: "var(--text-caption)",
                color: "var(--piw-foreground)",
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "hsl(210,100%,96%)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onPreview();
              }}
            >
              <Eye size={13} style={{ color: "var(--text-secondary)" }} /> Preview
            </button>
            <button
              className="flex items-center w-full"
              style={{
                height: 30,
                padding: "0 var(--spacing-2)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                border: "none",
                background: "transparent",
                gap: "var(--spacing-1-5)",
                fontFamily: FONT,
                fontWeight: 500,
                fontSize: "var(--text-caption)",
                color: "var(--piw-foreground)",
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "hsl(210,100%,96%)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
              }}
            >
              <Download size={13} style={{ color: "var(--text-secondary)" }} /> Download
            </button>
            <button
              className="flex items-center w-full"
              style={{
                height: 30,
                padding: "0 var(--spacing-2)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                border: "none",
                background: "transparent",
                gap: "var(--spacing-1-5)",
                fontFamily: FONT,
                fontWeight: 500,
                fontSize: "var(--text-caption)",
                color: "#DC2626",
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "hsl(210,100%,96%)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete();
              }}
            >
              <Trash2 size={13} style={{ color: "#DC2626" }} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 14  DETAIL SEARCH (toolbar search input)
 * ═══════════════════════════════════════════════════════════════════════════ */

function DetailSearch({
  value,
  onChange,
  placeholder,
  maxWidth = "500px",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxWidth?: string;
}) {
  return (
    <div className="relative flex-1" style={{ maxWidth }}>
      <Search
        size={18}
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: "var(--text-secondary)" }}
        aria-hidden="true"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-ring/30"
        style={{
          height: "38px",
          paddingLeft: "36px",
          paddingRight: value ? "32px" : "12px",
          fontSize: "var(--text-label)",
          fontWeight: "var(--font-weight-normal)",
          fontFamily: FONT,
          color: "var(--piw-foreground)",
          background: "var(--piw-card)",
          border: "1px solid var(--piw-border)",
          borderRadius: "var(--radius-sm)",
          boxShadow: "0 1px 2px 0 rgba(16,24,40,0.05)",
        }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
            display: "flex",
            color: "var(--text-tertiary)",
          }}
          aria-label="Clear search"
        >
          <XCircle size={14} />
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 15  ATTACHMENTS TAB  (main export)
 * ═══════════════════════════════════════════════════════════════════════════ */

export function AttachmentsTab({
  controlType: _controlType,
  itemImages,
  itemPartNumber,
  currentThumbnailUrl,
  onSetThumbnail,
}: {
  controlType?: string;
  itemImages?: string[];
  itemPartNumber?: string;
  currentThumbnailUrl?: string | null;
  onSetThumbnail?: (url: string) => void;
}) {
  // NOTE: `controlType` is accepted for signature-compatibility with the
  // deprecated tab (ItemDetail passes it through). Not currently used —
  // reserved for future control-type-scoped filtering.
  void _controlType;

  /* Convert an item's hero images into AttachmentLike records so they show up
   * as first-class attachments. The item-quick-view URLs become each card's
   * preview thumbnail AND the modal preview. */
  const itemImageAttachments: AttachmentLike[] = useMemo(() => {
    const imgs = itemImages ?? [];
    return imgs.map((url, i) => ({
      id: `item-img-${i}`,
      name: `${itemPartNumber ?? "Item"}_Image_${i + 1}.jpg`,
      size: "Image",
      type: "JPG",
      uploadedBy: "System",
      uploadedAt: new Date().toISOString(),
      previewUrl: url,
      linkedSerial: null,
      location: null,
      locationName: null,
    }));
  }, [itemImages, itemPartNumber]);

  /* Merge item-image records + rest, deduping by previewUrl. When a mock or
   * uploaded attachment's URL matches an item-image URL, keep only the
   * item-image copy so setting it as thumbnail doesn't produce two cards. */
  const mergeDeduped = useCallback(
    (itemImgs: AttachmentLike[], rest: AttachmentLike[]): AttachmentLike[] => {
      const itemImgUrls = new Set(
        itemImgs.map((a) => a.previewUrl).filter((u): u is string => !!u),
      );
      const cleanedRest = rest.filter(
        (a) => !a.previewUrl || !itemImgUrls.has(a.previewUrl),
      );
      return [...itemImgs, ...cleanedRest];
    },
    [],
  );

  const [attachments, setAttachments] = useState<AttachmentLike[]>(
    mergeDeduped(itemImageAttachments, MOCK_ATTACHMENTS as AttachmentLike[]),
  );

  /* Keep the item-image portion of the list in sync when the parent item
   * changes (e.g. navigating between items). System-owned records have
   * `id.startsWith("item-img-")` — replace those, dedupe against the rest. */
  const lastImagesKey = useRef<string>(JSON.stringify(itemImageAttachments.map((a) => a.previewUrl)));
  useEffect(() => {
    const key = JSON.stringify(itemImageAttachments.map((a) => a.previewUrl));
    if (key === lastImagesKey.current) return;
    lastImagesKey.current = key;
    setAttachments((prev) => {
      const nonItemImgs = prev.filter((a) => !a.id.startsWith("item-img-"));
      return mergeDeduped(itemImageAttachments, nonItemImgs);
    });
  }, [itemImageAttachments, mergeDeduped]);

  const [attachmentSearch, setAttachmentSearch] = useState("");
  const [attachmentPaneMode, setAttachmentPaneMode] = useState<FilePaneMode>("card");
  const [attachmentCardSize, setAttachmentCardSize] = useState<CardSize>("medium");
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentLike | null>(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<AttachmentLike | null>(null);
  const attachmentFileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredAttachments = useMemo(() => {
    let items = attachments;
    if (attachmentSearch.trim()) {
      const q = attachmentSearch.toLowerCase();
      items = items.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.uploadedBy.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q),
      );
    }
    return items;
  }, [attachments, attachmentSearch]);

  /* Upload handler — adds shimmer cards immediately, simulates progress, finalizes. */
  const handleAttachmentUpload = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    if (!arr.length) return;
    const getType = (name: string): string => {
      const ext = (name.split(".").pop() || "").toLowerCase();
      if (ext === "pdf") return "PDF";
      if (["doc", "docx"].includes(ext)) return "DOC";
      if (["xls", "xlsx", "csv"].includes(ext)) return "XLSX";
      if (ext === "png") return "PNG";
      if (["jpg", "jpeg"].includes(ext)) return "JPG";
      if (["zip", "rar"].includes(ext)) return "ZIP";
      return ext.toUpperCase() || "FILE";
    };
    const formatSize = (b: number) =>
      b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
    const isImg = (f: File) => f.type.startsWith("image/");
    const newItems: AttachmentLike[] = arr.map((f, i) => ({
      id: `upload-${Date.now()}-${i}`,
      name: f.name,
      size: formatSize(f.size),
      type: getType(f.name),
      uploadedBy: "You",
      uploadedAt: new Date().toISOString(),
      previewUrl: isImg(f) ? URL.createObjectURL(f) : null,
      uploading: true,
      progress: 0,
    }));
    setAttachments((prev) => [...newItems, ...prev]);
    // Simulate progress per file
    newItems.forEach((item) => {
      const total = 1200 + Math.random() * 1200;
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const pct = Math.min(100, Math.round((elapsed / total) * 100));
        setAttachments((prev) =>
          prev.map((a) => (a.id === item.id ? { ...a, progress: pct } : a)),
        );
        if (pct < 100) {
          setTimeout(tick, 120);
        } else {
          setAttachments((prev) =>
            prev.map((a) => (a.id === item.id ? { ...a, uploading: false, progress: 100 } : a)),
          );
        }
      };
      setTimeout(tick, 120);
    });
  }, []);

  /* Build the preview-modal payload from an AttachmentLike. Item v2's
   * `AttachmentPreviewModal` takes an `AttachmentCardData` shape
   * (fileName/fileType/fileSize/uploadedDate/uploadedTime/uploadedBy). */
  const buildPreviewData = (att: AttachmentLike) => {
    const d = new Date(att.uploadedAt);
    const uploadedDate = isNaN(d.getTime())
      ? att.uploadedAt
      : d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
    const uploadedTime = isNaN(d.getTime())
      ? ""
      : d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    return {
      fileName: att.name,
      fileType: att.type.toLowerCase(),
      fileSize: att.size,
      uploadedDate,
      uploadedTime,
      uploadedBy: att.uploadedBy,
      previewUrl: att.previewUrl ?? null,
      filePath: null,
    };
  };

  return (
    <div>
      {/* Attachments Tab — full-width layout, no outer border */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-auto-hide"
        style={{ padding: "var(--spacing-4)" }}
      >
        {/* Toolbar: search + density + upload */}
        <div
          className="flex items-center"
          style={{ gap: "var(--spacing-2-5)", marginBottom: "var(--spacing-3)" }}
        >
          <DetailSearch
            value={attachmentSearch}
            onChange={setAttachmentSearch}
            placeholder="Search attachments..."
          />
          <div className="ml-auto flex items-center" style={{ gap: "var(--spacing-2)" }}>
            <FilePaneModeDropdown
              value={attachmentPaneMode}
              onChange={setAttachmentPaneMode}
              cardSize={attachmentCardSize}
              onCardSizeChange={setAttachmentCardSize}
            />
            <button
              onClick={() => attachmentFileInputRef.current?.click()}
              className="flex items-center transition-colors"
              style={{
                height: 34,
                padding: "0 var(--spacing-3)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--piw-primary)",
                background: "var(--piw-primary)",
                color: "var(--piw-primary-foreground)",
                cursor: "pointer",
                gap: "var(--spacing-1-5)",
                fontFamily: FONT,
                fontWeight: 600,
                fontSize: "var(--text-caption)",
                boxShadow: "0 1px 2px 0 rgba(16,24,40,0.05)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.92";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              <Upload size={14} />
              Upload
            </button>
          </div>
          <input
            ref={attachmentFileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
            className="hidden"
            onChange={(e) => {
              handleAttachmentUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Content area */}
        <div>
          {attachmentPaneMode === "card" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: CARD_SIZE_COLUMNS[attachmentCardSize],
                gap: "var(--spacing-3)",
              }}
            >
              {filteredAttachments.map((file) =>
                file.uploading ? (
                  <UploadingCard
                    key={file.id}
                    fileName={file.name}
                    fileSize={file.size}
                    ext={file.type}
                    progress={file.progress ?? 0}
                    onCancel={() =>
                      setAttachments((prev) => prev.filter((a) => a.id !== file.id))
                    }
                    thumbHeight={CARD_SIZE_THUMB[attachmentCardSize]}
                  />
                ) : (
                  <AttachmentCardItem
                    key={file.id}
                    file={file}
                    onPreview={() => setAttachmentPreview(file)}
                    onDelete={() => setAttachmentToDelete(file)}
                    onSetThumbnail={
                      onSetThumbnail && file.previewUrl
                        ? () => onSetThumbnail(file.previewUrl!)
                        : undefined
                    }
                    isThumbnail={
                      !!currentThumbnailUrl && file.previewUrl === currentThumbnailUrl
                    }
                    searchQuery={attachmentSearch.trim() || undefined}
                    thumbHeight={CARD_SIZE_THUMB[attachmentCardSize]}
                  />
                ),
              )}
            </div>
          ) : (
            <div
              style={{
                background: "var(--piw-card)",
                border: "1px solid var(--piw-border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
              }}
            >
              <AttachmentListHeader />
              {filteredAttachments
                .filter((f) => !f.uploading)
                .map((file) => (
                  <AttachmentListRow
                    key={file.id}
                    file={file}
                    density={attachmentPaneMode === "comfort" ? "comfort" : "condensed"}
                    onPreview={() => setAttachmentPreview(file)}
                    onDelete={() => setAttachmentToDelete(file)}
                    onSetThumbnail={
                      onSetThumbnail && file.previewUrl
                        ? () => onSetThumbnail(file.previewUrl!)
                        : undefined
                    }
                    isThumbnail={
                      !!currentThumbnailUrl && file.previewUrl === currentThumbnailUrl
                    }
                    searchQuery={attachmentSearch.trim() || undefined}
                  />
                ))}
            </div>
          )}
          {filteredAttachments.length === 0 && (
            <div
              className="flex flex-col items-center justify-center"
              style={{ padding: "var(--spacing-10, 40px) var(--spacing-4)" }}
            >
              <Search
                size={36}
                style={{ color: "var(--text-tertiary)", marginBottom: "var(--spacing-3)" }}
              />
              <span
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--text-tertiary)",
                  fontFamily: FONT,
                }}
              >
                {attachmentSearch.trim()
                  ? `No results matching "${attachmentSearch}"`
                  : "No attachments yet"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Attachment Preview Modal */}
      {attachmentPreview && (
        <AttachmentPreviewModal
          attachment={buildPreviewData(attachmentPreview)}
          onClose={() => setAttachmentPreview(null)}
          onDelete={() => {
            setAttachmentToDelete(attachmentPreview);
            setAttachmentPreview(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteAttachmentDialog
        open={!!attachmentToDelete}
        onOpenChange={(o) => { if (!o) setAttachmentToDelete(null); }}
        fileName={attachmentToDelete?.name ?? ""}
        onConfirm={() => {
          if (!attachmentToDelete) return;
          const id = attachmentToDelete.id;
          setAttachments((prev) => prev.filter((a) => a.id !== id));
          setAttachmentToDelete(null);
        }}
      />
    </div>
  );
}
