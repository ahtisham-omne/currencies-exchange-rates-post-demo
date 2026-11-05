/**
 * @deprecated — Original Item Detail Attachments tab (ported 1:1 from Physical
 * Inventory in July 2026). Replaced by the Inventory-Movement-derived tab at
 * `../attachments-tab.tsx`. Kept here as a reference/comparison snapshot.
 * Do NOT import from this file in new code.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  FileArchive,
  Cog,
  Layers as LayersIcon,
  Compass,
  Download,
  Eye,
  ExternalLink,
  Paperclip,
  User,
  MoreVertical,
  Upload,
  Library,
  LayoutGrid,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Layers,
  List,
  AlignJustify,
  ArrowDownUp,
  Calendar,
  X,
  ListFilter,
} from "lucide-react";
import { TransactionDetailModal, enrichTransactionDetail } from "../serial-unit-modal";
import { TxTypeMini, HighlightText } from "../search-highlight";
import { EmptyState } from "../shared-ui";
import { AttachmentPreviewModal } from "../attachment-preview-modal";
import { AttachmentCard, THUMB_GRID_COLUMNS, DocumentPreview } from "../attachment-card";
import { UploadingCard } from "../create-item-attachments-field";
import { getFileThumbnail } from "../attachment-config";
import { PersonHoverCard } from "../person-hover-card";
import designPdfAsset from "@/assets/design.pdf.asset.json";
import sampleAudioAsset from "@/assets/sample-audio.mp3.asset.json";
import sampleVideoAsset from "@/assets/sample-video.mp4.asset.json";
import { Check } from "lucide-react";

const font = "var(--font-inter)";
const fontInter = "var(--font-inter)";
const fontCard = "var(--font-inter)";

/* ═════════════════════════════════════════════════════════════════════════════
 * § 0  TYPES & MOCK DATA
 * ═════════════════════════════════════════════════════════════════════════════ */

type FileType = "pdf" | "xlsx" | "docx" | "txt" | "png" | "jpg" | "zip" | "rar" | "csv" | "exe" | "psd" | "cad" | "dxf" | "dwg" | "stl" | "mp3" | "mp4";

type SourceType =
  | "Receiving"
  | "Consumption"
  | "Adjustment"
  | "Movement"
  | "Cycle Count"
  | "Manufactured"
  | "Item Library";

interface Attachment {
  id: string;
  fileName: string;
  fileType: FileType;
  fileSize: string;
  fileSizeBytes: number;
  uploadedDate: string;
  uploadedTime: string;
  uploadedBy: string;
  source: SourceType;
  linkedTransactionId: string | null;
  linkedTransactionLabel: string | null;
  description?: string;
  /** Serial unit this attachment is linked to (for drill-through navigation) */
  linkedSerialUnit?: string | null;
  /** Preview image URL for thumbnail display */
  previewUrl?: string | null;
}

/* ── Deterministic seeded RNG for reproducible data ── */
function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

/* ── Preview URL pool (real Unsplash images) ── */
const PREVIEW_URLS = [
  "https://images.unsplash.com/photo-1579642984417-0c00620f8e94?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1625384827802-1118262acfa6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1715173679369-18006e84d6a8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1739204618173-3e89def7140f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1666537072157-440346cea066?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1545751766-f71f9467d1f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1601598704991-eef6114775e0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1693045181676-57199422ee66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1621862681400-a2a7321dc1c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1763729805496-b5dbf7f00c79?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1576666735179-f3ad352212c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1627915589334-14a3c3e3a741?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1718512932005-197f55f2e186?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1532347833815-3b8e47e7bd7c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1628863353691-0071c8c1874c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1769147339214-076740872485?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1589982875270-1998b9747f06?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
];

/* ── File name templates per source type ── */
const FILE_TEMPLATES: Record<SourceType, { names: string[]; types: FileType[]; labels: string[] }> = {
  Receiving: {
    names: ["PO_Receiving_Report", "Inbound_QC_Checklist", "Supplier_COA_Batch", "Receiving_Photo_Dock", "GRN_Note", "Packing_Slip_Scan", "BOL_Freight_Doc", "Inspection_Certificate", "Supplier_Invoice", "Weight_Ticket"],
    types: ["pdf", "xlsx", "pdf", "jpg", "pdf", "pdf", "pdf", "docx", "pdf", "png"],
    labels: ["Receiving"],
  },
  "Cycle Count": {
    names: ["CycleCount_Zone_Report", "CycleCount_Variance_Analysis", "Discrepancy_Evidence_Photo", "CC_Recount_Summary", "CC_Adjustment_Log", "Auditor_Sign_Off", "CC_Zone_Map"],
    types: ["pdf", "xlsx", "png", "pdf", "csv", "pdf", "png"],
    labels: ["Cycle Count"],
  },
  Adjustment: {
    names: ["Adjustment_Authorization_Form", "Damaged_Items_Photos", "Adj_Approval_Email", "Scrap_Report", "Shrinkage_Investigation", "Found_Item_Report", "Adj_Supporting_Doc", "Calibration_Utility", "Adjustment_Archive"],
    types: ["pdf", "zip", "docx", "pdf", "pdf", "pdf", "xlsx", "exe", "rar"],
    labels: ["Adj. Increase", "Adj. Decrease"],
  },
  Movement: {
    names: ["Transfer_Manifest", "Movement_Confirmation", "Pick_List_Scan", "Staging_Photo", "Forklift_Log", "Zone_Transfer_Auth", "Relocation_Summary"],
    types: ["pdf", "docx", "pdf", "jpg", "csv", "pdf", "xlsx"],
    labels: ["Movement (Pick)"],
  },
  Consumption: {
    names: ["WorkOrder_BOM", "Consumption_Log", "Material_Issue_Slip", "WO_Completion_Report", "Scrap_Material_Log", "Component_Usage_Summary"],
    types: ["xlsx", "csv", "pdf", "pdf", "xlsx", "pdf"],
    labels: ["Consumption"],
  },
  Manufactured: {
    names: ["Production_Report_Batch", "QC_Test_Results", "Batch_Record", "Production_Photo", "Yield_Analysis", "Equipment_Log", "Packaging_Spec", "Assembly_3D_Model"],
    types: ["pdf", "xlsx", "pdf", "jpg", "xlsx", "csv", "pdf", "cad"],
    labels: ["Manufactured"],
  },
  "Item Library": {
    names: ["Item_Specification_Sheet", "Safety_Data_Sheet_SDS", "Part_Drawing_Rev", "Vendor_Agreement", "Compliance_Certificate", "Assembly_Instructions", "Material_Cert", "Dimensional_Report", "Test_Protocol", "Mechanical_Drawing_CAD", "Label_Mockup_Design", "Firmware_Installer", "Spec_Archive_Bundle", "Readme_Notes"],
    types: ["pdf", "pdf", "png", "docx", "pdf", "pdf", "pdf", "xlsx", "pdf", "cad", "psd", "exe", "rar", "txt"],
    labels: [],
  },
};

const UPLOADERS = ["Sarah Chen", "James Wilson", "Maria Garcia", "Daniel Adams", "Lisa Park", "Robert Kim", "Emily Torres"];

/* ── Transaction ID pools per source ── */
const TX_POOLS: Record<SourceType, string[]> = {
  Receiving:     ["10293-456", "10293-789", "10294-101", "10294-202", "10294-303", "10294-404", "10294-505"],
  "Cycle Count": ["2025-047", "2025-048", "2026-001", "2026-002", "2026-003"],
  Adjustment:    ["20571-012", "20571-345", "20572-601", "20572-602", "20572-703", "20572-804"],
  Movement:      ["30815-678", "30815-901", "30815-902", "30816-103", "30816-204"],
  Consumption:   ["40128-901", "40128-401", "40128-402", "40129-503", "40129-604"],
  Manufactured:  ["50447-234", "50447-501", "50448-502", "50448-603"],
  "Item Library": [],
};

function generateAttachments(count: number = 72, seed: number = 42): Attachment[] {
  const rand = seededRng(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const results: Attachment[] = [];

  /* Distribution weights — controls how many files each source gets */
  const sources: SourceType[] = [
    "Receiving", "Receiving", "Receiving",
    "Cycle Count", "Cycle Count",
    "Adjustment", "Adjustment",
    "Movement", "Movement",
    "Consumption", "Consumption",
    "Manufactured",
    "Item Library", "Item Library",
  ];

  const formatSize = (bytes: number) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  /* Generate a date between 2025-05-01 and 2026-02-28 */
  const baseDate = new Date(2025, 4, 1).getTime();
  const dateRange = new Date(2026, 1, 28).getTime() - baseDate;

  for (let i = 0; i < count; i++) {
    const source = sources[i % sources.length];
    const tpl = FILE_TEMPLATES[source];
    const nameIdx = Math.floor(rand() * tpl.names.length);
    const baseName = tpl.names[nameIdx];
    const fileType = tpl.types[nameIdx % tpl.types.length];
    const suffix = Math.floor(rand() * 900 + 100);
    const fileName = `${baseName}_${suffix}.${fileType}`;

    const fileSizeBytes = Math.floor(rand() * 12_000_000) + 50_000;
    const dateMs = baseDate + Math.floor(rand() * dateRange);
    const d = new Date(dateMs);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();
    const h = Math.floor(rand() * 12) + 1;
    const m = Math.floor(rand() * 60);
    const ampm = rand() > 0.5 ? "AM" : "PM";

    const txPool = TX_POOLS[source];
    const linkedTransactionId = txPool.length > 0 ? pick(txPool) : null;
    const labelSuffix = tpl.labels.length > 0 ? pick(tpl.labels) : null;
    const linkedTransactionLabel = linkedTransactionId && labelSuffix
      ? `${linkedTransactionId} · ${labelSuffix}`
      : linkedTransactionId;

    /* ~85% of non-zip files get a preview image */
    /* Only image types get a preview image; everything else uses placeholder icon. */
    const hasPreview = (fileType === "jpg" || fileType === "png") && rand() > 0.15;

    results.push({
      id: `att-gen-${i}`,
      fileName,
      fileType,
      fileSize: formatSize(fileSizeBytes),
      fileSizeBytes,
      uploadedDate: `${month}/${day}/${year}`,
      uploadedTime: `${h}:${String(m).padStart(2, "0")} ${ampm}`,
      uploadedBy: pick(UPLOADERS),
      source,
      linkedTransactionId,
      linkedTransactionLabel,
      previewUrl: hasPreview ? PREVIEW_URLS[i % PREVIEW_URLS.length] : null,
    });
  }

  /* Sort newest first */
  results.sort((a, b) => {
    const da = new Date(a.uploadedDate).getTime();
    const db = new Date(b.uploadedDate).getTime();
    return db - da;
  });

  return results;
}

const DESIGN_SPEC_ATTACHMENT: Attachment = {
  id: "att-item-library-design-spec",
  fileName: "Design_Specification.pdf",
  fileType: "pdf",
  fileSize: `${(designPdfAsset.size / 1048576).toFixed(1)} MB`,
  fileSizeBytes: designPdfAsset.size,
  uploadedDate: "02/15/2026",
  uploadedTime: "9:42 AM",
  uploadedBy: "Sarah Chen",
  source: "Item Library",
  linkedTransactionId: null,
  linkedTransactionLabel: null,
  previewUrl: designPdfAsset.url,
};

const AUDIO_SAMPLE_ATTACHMENT: Attachment = {
  id: "att-item-library-audio-sample",
  fileName: "Item_Walkthrough_Audio.mp3",
  fileType: "mp3",
  fileSize: `${(sampleAudioAsset.size / 1048576).toFixed(1)} MB`,
  fileSizeBytes: sampleAudioAsset.size,
  uploadedDate: "02/18/2026",
  uploadedTime: "11:15 AM",
  uploadedBy: "Maria Garcia",
  source: "Item Library",
  linkedTransactionId: null,
  linkedTransactionLabel: null,
  previewUrl: sampleAudioAsset.url,
};

const VIDEO_SAMPLE_ATTACHMENT: Attachment = {
  id: "att-item-library-video-sample",
  fileName: "Item_Overview_Video.mp4",
  fileType: "mp4",
  fileSize: `${(sampleVideoAsset.size / 1048576).toFixed(1)} MB`,
  fileSizeBytes: sampleVideoAsset.size,
  uploadedDate: "02/20/2026",
  uploadedTime: "2:30 PM",
  uploadedBy: "James Wilson",
  source: "Item Library",
  linkedTransactionId: null,
  linkedTransactionLabel: null,
  previewUrl: sampleVideoAsset.url,
};

const DXF_SAMPLE_ATTACHMENT: Attachment = {
  id: "att-item-library-dxf-sample",
  fileName: "Tree_Of_Life_Wall_Art.dxf",
  fileType: "dxf",
  fileSize: "344 KB",
  fileSizeBytes: 352609,
  uploadedDate: "02/22/2026",
  uploadedTime: "10:05 AM",
  uploadedBy: "Alex Morgan",
  source: "Item Library",
  linkedTransactionId: null,
  linkedTransactionLabel: null,
  previewUrl: "/samples/Tree_Of_Life.dxf",
};

const DWG_SAMPLE_ATTACHMENT: Attachment = {
  id: "att-item-library-dwg-sample",
  fileName: "Nissan_Fairlady_Z_Dimensions.dwg",
  fileType: "dwg",
  fileSize: "138 KB",
  fileSizeBytes: 141686,
  uploadedDate: "02/23/2026",
  uploadedTime: "9:42 AM",
  uploadedBy: "Alex Morgan",
  source: "Item Library",
  linkedTransactionId: null,
  linkedTransactionLabel: null,
  previewUrl: "/samples/Nissan_Fairlady_Z.dwg",
};

const STL_SAMPLE_ATTACHMENT: Attachment = {
  id: "att-item-library-stl-sample",
  fileName: "Bracket_Model.stl",
  fileType: "stl",
  fileSize: "1.2 KB",
  fileSizeBytes: 1234,
  uploadedDate: "02/24/2026",
  uploadedTime: "3:18 PM",
  uploadedBy: "Jordan Lee",
  source: "Item Library",
  linkedTransactionId: null,
  linkedTransactionLabel: null,
  previewUrl: "/samples/Sample_Model.stl",
};

const MOCK_ATTACHMENTS: Attachment[] = [
  DESIGN_SPEC_ATTACHMENT,
  AUDIO_SAMPLE_ATTACHMENT,
  VIDEO_SAMPLE_ATTACHMENT,
  DXF_SAMPLE_ATTACHMENT,
  DWG_SAMPLE_ATTACHMENT,
  STL_SAMPLE_ATTACHMENT,
  ...generateAttachments(72),
];

/* ── Source metadata (colour + icon treatment per source type) ── */
const SOURCE_META: Record<SourceType, { color: string; bg: string; border: string }> = {
  Receiving:     { color: "var(--status-active-text)", bg: "var(--status-active-bg)", border: "var(--status-active-border)" },
  Consumption:   { color: "var(--reason-tag-text)", bg: "var(--reason-tag-bg)", border: "var(--reason-tag-border)" },
  Adjustment:    { color: "var(--piw-primary)", bg: "var(--primary-50)", border: "var(--primary-200)" },
  Movement:      { color: "var(--checked-out-tag-text)", bg: "var(--checked-out-tag-bg)", border: "var(--checked-out-tag-border)" },
  "Cycle Count": { color: "var(--tx-type-negative-text)", bg: "var(--tx-type-negative-bg)", border: "var(--tx-type-negative-border)" },
  Manufactured:  { color: "var(--status-active-text)", bg: "var(--status-active-bg)", border: "var(--status-active-border)" },
  "Item Library":{ color: "var(--text-secondary)", bg: "var(--surface-secondary)", border: "var(--piw-border)" },
};

/* ── File type icon helper ── */
function FileTypeIcon({ type, size = 16 }: { type: FileType; size?: number }) {
  const s = { flexShrink: 0 } as React.CSSProperties;
  switch (type) {
    case "pdf":  return <FileText size={size} style={{ ...s, color: "var(--tx-type-negative-text)" }} />;
    case "xlsx":
    case "csv":  return <FileSpreadsheet size={size} style={{ ...s, color: "var(--status-active-text)" }} />;
    case "docx": return <FileText size={size} style={{ ...s, color: "var(--piw-primary)" }} />;
    case "png":
    case "jpg":  return <FileImage size={size} style={{ ...s, color: "var(--checked-out-tag-text)" }} />;
    case "zip":  return <FileArchive size={size} style={{ ...s, color: "var(--reason-tag-text)" }} />;
    case "exe":  return <Cog size={size} style={{ ...s, color: "#475569" }} />;
    case "psd":  return <LayersIcon size={size} style={{ ...s, color: "#4F46E5" }} />;
    case "cad":  return <Compass size={size} style={{ ...s, color: "#C2410C" }} />;
    case "dxf":  return <Compass size={size} style={{ ...s, color: "#C2410C" }} />;
    case "dwg":  return <Compass size={size} style={{ ...s, color: "#C2410C" }} />;
    case "stl":  return <LayersIcon size={size} style={{ ...s, color: "#4F46E5" }} />;
    case "mp3":  return <FileText size={size} style={{ ...s, color: "var(--reason-tag-text)" }} />;
    case "mp4":  return <FileText size={size} style={{ ...s, color: "var(--checked-out-tag-text)" }} />;
    default:     return <File size={size} style={{ ...s, color: "var(--text-secondary)" }} />;
  }
}

function fileExtLabel(type: FileType): string {
  return type.toUpperCase();
}

/* ═════════════════════════════════════════════════════════════════════════════
 * § 1  SOURCE FILTER PILLS
 * ════════════════════════════════════════════════════════════════════════════ */

type SourceFilter = "all" | SourceType;

const SOURCE_FILTERS: { key: SourceFilter; label: string }[] = [
  { key: "all",           label: "All Files" },
  { key: "Item Library",  label: "Item Library" },
  { key: "Receiving",     label: "Receiving" },
  { key: "Cycle Count",   label: "Cycle Count" },
  { key: "Adjustment",    label: "Adjustment" },
  { key: "Movement",      label: "Movement" },
  { key: "Consumption",   label: "Consumption" },
  { key: "Manufactured",  label: "Manufactured" },
];

function SourceFilterBar({
  active,
  onChange,
  counts,
}: {
  active: SourceFilter;
  onChange: (f: SourceFilter) => void;
  counts: Record<SourceFilter, number>;
}) {
  return (
    <div className="flex items-center flex-wrap gap-2">
      {SOURCE_FILTERS.map((f) => {
        const isActive = active === f.key;
        const count = counts[f.key] ?? 0;
        if (f.key !== "all" && count === 0) return null;
        return (
          <button
            key={f.key}
            onClick={() => onChange(f.key)}
            className="inline-flex items-center gap-1.5 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            style={{
              height: "30px",
              padding: count !== undefined ? "0 var(--spacing-2) 0 var(--spacing-3)" : "0 var(--spacing-3)",
              cursor: "pointer",
              background: isActive ? "var(--primary-50)" : "var(--piw-card)",
              borderColor: isActive ? "var(--primary-600)" : "var(--piw-border)",
              color: isActive ? "var(--piw-primary)" : "var(--text-secondary)",
              fontSize: "var(--text-label)",
              fontFamily: font,
              fontWeight: "var(--font-weight-medium)" as any,
            }}
          >
            {f.label}
            <span
              className="flex items-center justify-center rounded-full"
              style={{
                minWidth: "20px",
                height: "20px",
                padding: "0 var(--spacing-1-5)",
                background: isActive ? "var(--primary-100)" : "var(--surface-secondary)",
                color: isActive ? "var(--primary-700)" : "var(--text-secondary)",
                fontSize: "var(--text-caption)",
                fontWeight: "var(--font-weight-semibold)" as any,
                fontFamily: fontInter,
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════════
 * § 2  SUMMARY STATS BAR
 * ═════════════════════════════════════════════════════════════════════════════ */

function SummaryStatsBar({ items }: { items: Attachment[] }) {
  const totalSize = items.reduce((sum, a) => sum + a.fileSizeBytes, 0);
  const formatSize = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const uniqueUploaders = new Set(items.map(a => a.uploadedBy)).size;
  const linkedCount = items.filter(a => a.linkedTransactionId).length;
  const itemLibraryCount = items.filter(a => a.source === "Item Library").length;

  const stats = [
    { icon: <Paperclip size={12} style={{ color: "var(--text-tertiary)" }} />, text: `${items.length} files` },
    { icon: <Download size={12} style={{ color: "var(--text-tertiary)" }} />, text: `${formatSize(totalSize)} total` },
    { icon: <User size={12} style={{ color: "var(--text-tertiary)" }} />, text: `${uniqueUploaders} contributor${uniqueUploaders !== 1 ? "s" : ""}` },
  ];

  return (
    <div
      className="flex items-center flex-wrap"
      style={{ gap: "var(--spacing-3)" }}
    >
      {stats.map((s, i) => (
        <div key={i} className="flex items-center" style={{ gap: "var(--spacing-1)" }}>
          {s.icon}
          <span style={{ fontFamily: font, fontWeight: "var(--font-weight-normal)" as any, fontSize: "var(--text-caption-helper)", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
            {s.text}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * § 3  THUMBNAIL CARD
 * ═════════════════════════════════════════════════════════════════════════════ */

/* Colour palette for the thumbnail preview area — soft pastels */
const THUMB_BG: Record<FileType, { bg: string; color: string; icon: React.ReactNode }> = {
  pdf:  { bg: "var(--tx-type-negative-bg)", color: "var(--tx-type-negative-text)", icon: <FileText size={28} style={{ color: "var(--tx-type-negative-text)", opacity: 0.7 }} /> },
  xlsx: { bg: "var(--status-active-bg)", color: "var(--status-active-text)", icon: <FileSpreadsheet size={28} style={{ color: "var(--status-active-text)", opacity: 0.7 }} /> },
  csv:  { bg: "var(--status-active-bg)", color: "var(--status-active-text)", icon: <FileSpreadsheet size={28} style={{ color: "var(--status-active-text)", opacity: 0.7 }} /> },
  docx: { bg: "var(--primary-50)", color: "var(--piw-primary)", icon: <FileText size={28} style={{ color: "var(--piw-primary)", opacity: 0.7 }} /> },
  png:  { bg: "var(--checked-out-tag-bg)", color: "var(--checked-out-tag-text)", icon: <FileImage size={28} style={{ color: "var(--checked-out-tag-text)", opacity: 0.7 }} /> },
  jpg:  { bg: "var(--checked-out-tag-bg)", color: "var(--checked-out-tag-text)", icon: <FileImage size={28} style={{ color: "var(--checked-out-tag-text)", opacity: 0.7 }} /> },
  zip:  { bg: "var(--reason-tag-bg)", color: "var(--reason-tag-text)", icon: <FileArchive size={28} style={{ color: "var(--reason-tag-text)", opacity: 0.7 }} /> },
  rar:  { bg: "var(--reason-tag-bg)", color: "var(--reason-tag-text)", icon: <FileArchive size={28} style={{ color: "var(--reason-tag-text)", opacity: 0.7 }} /> },
  txt:  { bg: "var(--primary-50)", color: "var(--piw-primary)", icon: <FileText size={28} style={{ color: "var(--piw-primary)", opacity: 0.7 }} /> },
  exe:  { bg: "#F1F5F9", color: "#475569", icon: <Cog size={28} style={{ color: "#475569", opacity: 0.7 }} /> },
  psd:  { bg: "#EEF2FF", color: "#4F46E5", icon: <LayersIcon size={28} style={{ color: "#4F46E5", opacity: 0.7 }} /> },
  cad:  { bg: "#FFF7ED", color: "#C2410C", icon: <Compass size={28} style={{ color: "#C2410C", opacity: 0.7 }} /> },
  dxf:  { bg: "#FFF7ED", color: "#C2410C", icon: <Compass size={28} style={{ color: "#C2410C", opacity: 0.7 }} /> },
  dwg:  { bg: "#FFF7ED", color: "#C2410C", icon: <Compass size={28} style={{ color: "#C2410C", opacity: 0.7 }} /> },
  stl:  { bg: "#EEF2FF", color: "#4F46E5", icon: <LayersIcon size={28} style={{ color: "#4F46E5", opacity: 0.7 }} /> },
  mp3:  { bg: "var(--reason-tag-bg)", color: "var(--reason-tag-text)", icon: <FileText size={28} style={{ color: "var(--reason-tag-text)", opacity: 0.7 }} /> },
  mp4:  { bg: "var(--checked-out-tag-bg)", color: "var(--checked-out-tag-text)", icon: <FileText size={28} style={{ color: "var(--checked-out-tag-text)", opacity: 0.7 }} /> },
};

/**
 * ThumbnailCard — Thin wrapper around the shared AttachmentCard.
 * Builds the appropriate source pill for the Inventory Detail Attachments tab
 * and threads searchQuery through to HighlightText for file-name matches.
 */
function ThumbnailCard({ att, onTransactionClick, searchQuery, onPreviewClick }: { att: Attachment; onTransactionClick?: (att: Attachment) => void; searchQuery?: string; onPreviewClick?: (att: Attachment) => void }) {
  const srcMeta = SOURCE_META[att.source];

  /* Build source pill */
  const pill = att.linkedTransactionId ? (
    <a
      href="#"
      className="inline-flex items-center"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTransactionClick?.(att); }}
      style={{
        maxWidth: "100%",
        padding: "1px var(--spacing-1-5)",
        borderRadius: "9999px",
        background: "var(--surface-secondary)",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "var(--piw-border)",
        fontFamily: font,
        fontWeight: "var(--font-weight-medium)" as any,
        fontSize: "var(--text-badge)",
        color: "var(--text-secondary)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        gap: "var(--spacing-0-5)",
        textDecoration: "none",
        transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
      }}
      title={att.linkedTransactionLabel ?? att.linkedTransactionId}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--primary-50)";
        e.currentTarget.style.borderColor = "var(--primary-200)";
        e.currentTarget.style.color = "var(--piw-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--surface-secondary)";
        e.currentTarget.style.borderColor = "var(--piw-border)";
        e.currentTarget.style.color = "var(--text-secondary)";
      }}
    >
      <ExternalLink size={9} style={{ flexShrink: 0, marginRight: "2px" }} />
      <HighlightText text={att.linkedTransactionId} query={searchQuery} />
    </a>
  ) : (
    <span
      className="inline-flex items-center"
      style={{
        padding: "1px var(--spacing-1-5)",
        borderRadius: "9999px",
        background: srcMeta.bg,
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: srcMeta.border,
        fontFamily: font,
        fontWeight: "var(--font-weight-medium)" as any,
        fontSize: "var(--text-badge)",
        color: srcMeta.color,
        whiteSpace: "nowrap",
        gap: "var(--spacing-0-5)",
      }}
    >
      <Library size={9} style={{ flexShrink: 0 }} />
      Item Library
    </span>
  );

  return (
    <AttachmentCard
      att={att}
      sourcePill={pill}
      renderFileName={(name) => <HighlightText text={name} query={searchQuery} />}
      searchQuery={searchQuery}
      onDelete={() => {/* placeholder — removes from UI in future */}}
    />
  );
}

/* ═════════════════════════════════════════════════════════════════════════════
 * § 4  THUMBNAIL GRID
 * ══════════════════════════════���══════════════════════════════════════════════ */

function ThumbnailGrid({ items, onTransactionClick, searchQuery, onPreviewClick }: { items: Attachment[]; onTransactionClick?: (att: Attachment) => void; searchQuery?: string; onPreviewClick?: (att: Attachment) => void }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No attachments found"
        subtitle="Try adjusting your search or filter criteria"
        iconComponent={Paperclip}
      />
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: THUMB_GRID_COLUMNS,
        padding: "var(--spacing-4)",
        gap: "var(--spacing-4)",
      }}
    >
      {items.map((att) => (
        <ThumbnailCard key={att.id} att={att} onTransactionClick={onTransactionClick} searchQuery={searchQuery} onPreviewClick={onPreviewClick} />
      ))}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════════
 * § 4b  UPLOAD FILE BUTTON — triggers native file picker
 * ═════════════════════════════════════════════════════════════════════════════ */

function UploadFileButton({ onFilesSelected }: { onFilesSelected: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFilesSelected(files);
          if (inputRef.current) inputRef.current.value = "";
        }}
        style={{ display: "none" }}
        accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.zip,.csv,.exe,.msi,.psd,.cad,.dwg,.dxf,.stl,.step,.stp,.iges,.igs"
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center border border-border transition-colors hover:bg-[hsl(210,100%,96%)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        style={{
          height: "38px",
          padding: "0 var(--spacing-3)",
          borderRadius: "var(--radius-sm)",
          background: "var(--piw-card)",
          cursor: "pointer",
          gap: "var(--spacing-1-5)",
          fontFamily: font,
          fontWeight: "var(--font-weight-semibold)" as any,
          fontSize: "var(--text-label)",
          color: "var(--text-secondary)",
          boxShadow: "var(--elevation-xs)",
        }}
      >
        <Upload size={14} style={{ color: "var(--text-secondary)" }} />
        Upload File
      </button>
    </>
  );
}

/* ── Compact drop-zone for the Item Library folder (mirrors Create Item modal UX). */
function LibraryUploadDropzone({ onFilesSelected }: { onFilesSelected: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const arr = Array.from(list);
    if (arr.length) onFilesSelected(arr);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      className={`rounded-lg border-2 border-dashed px-3 py-2.5 cursor-pointer transition-all ${
        dragActive
          ? "border-primary bg-accent/30"
          : "border-border bg-white hover:border-slate-300 hover:bg-[#FAFBFC]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.zip,.csv,.exe,.msi,.psd,.cad,.dwg,.dxf,.stl,.step,.stp,.iges,.igs,.mp3,.mp4,.mov,.txt,.rar"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        className="hidden"
      />
      <div className="flex items-center gap-3 text-left">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            dragActive ? "bg-[#D6E8FF] text-primary" : "bg-muted text-slate-400"
          }`}
        >
          <Upload className="w-4 h-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <p className="text-sm text-foreground" style={{ fontWeight: 500 }}>
            <span className="text-primary">Click to upload</span>
            <span> or drag and drop</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Files land in the Item Library folder.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════════
 * § 4c  VIEW MODE DROPDOWN
 * ════════════════════════════════════════════════════════════��════════════════ */

type ViewMode = "grid" | "folder";

const VIEW_OPTIONS: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
  { key: "grid", label: "Grid View", icon: <LayoutGrid size={14} /> },
  { key: "folder", label: "Folder View", icon: <FolderOpen size={14} /> },
];

function ViewModeDropdown({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = VIEW_OPTIONS.find((o) => o.key === value)!;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center border border-border transition-colors hover:bg-[hsl(210,100%,96%)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        style={{
          height: "38px",
          padding: "0 var(--spacing-2-5)",
          borderRadius: "var(--radius-sm)",
          background: "var(--piw-card)",
          cursor: "pointer",
          gap: "var(--spacing-1-5)",
          fontFamily: font,
          fontWeight: "var(--font-weight-semibold)" as any,
          fontSize: "var(--text-label)",
          color: "var(--text-secondary)",
          boxShadow: "var(--elevation-xs)",
        }}
      >
        <span style={{ color: "var(--text-secondary)", display: "flex" }}>{current.icon}</span>
        {current.label}
        <ChevronDown
          size={13}
          style={{
            color: "var(--text-tertiary)",
            transition: "transform 0.15s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 border border-border"
          style={{
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: "160px",
            borderRadius: "var(--radius-md)",
            background: "var(--piw-card)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
            padding: "var(--spacing-1)",
          }}
        >
          {VIEW_OPTIONS.map((opt) => {
            const isActive = opt.key === value;
            return (
              <button
                key={opt.key}
                onClick={() => { onChange(opt.key); setOpen(false); }}
                className="flex items-center w-full transition-colors hover:bg-[hsl(210,100%,96%)]"
                style={{
                  height: "34px",
                  padding: "0 var(--spacing-2-5)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  border: "none",
                  background: isActive ? "var(--primary-50)" : "transparent",
                  gap: "var(--spacing-2)",
                  fontFamily: font,
                  fontWeight: isActive ? "var(--font-weight-semibold)" as any : "var(--font-weight-medium)" as any,
                  fontSize: "var(--text-body-sm)",
                  color: isActive ? "var(--piw-primary)" : "var(--piw-foreground)",
                }}
              >
                <span style={{ color: isActive ? "var(--piw-primary)" : "var(--text-secondary)", display: "flex" }}>{opt.icon}</span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════════
 * § 4d  FOLDER EXPLORER VIEW — Split-pane: tree nav (left) + file list (right)
 * ═════════════════════════════════════════════════════════════════════════════ */

function formatDateShort(d: string, t: string) {
  try {
    const [mm, dd, yyyy] = d.split("/");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${dd} ${months[parseInt(mm, 10) - 1]} ${yyyy}, ${t.toLowerCase()}`;
  } catch { return `${d}, ${t}`; }
}

function formatFolderSize(items: Attachment[]) {
  const total = items.reduce((sum, a) => sum + a.fileSizeBytes, 0);
  if (total >= 1073741824) return `${(total / 1073741824).toFixed(1)} GB`;
  if (total >= 1048576) return `${(total / 1048576).toFixed(1)} MB`;
  return `${(total / 1024).toFixed(0)} KB`;
}

const FOLDER_ORDER: SourceType[] = [
  "Item Library", "Receiving", "Cycle Count", "Adjustment", "Movement", "Consumption", "Manufactured",
];

const FOLDER_ORDER_WITH_ALL: ("all" | SourceType)[] = [
  "Item Library", "Receiving", "Cycle Count", "Adjustment", "Movement", "Consumption", "Manufactured", "all",
];

/** Maps SourceType to the TxTypeMini `type` prop string */
const SOURCE_TO_TX_TYPE: Record<SourceType, string> = {
  Receiving: "Receiving",
  Consumption: "Consumption",
  Adjustment: "Adjustment Increase",
  Movement: "Movement",
  "Cycle Count": "Cycle Count",
  Manufactured: "Manufactured",
  "Item Library": "Receiving", /* fallback — Item Library doesn't have transactions */
};

type FilePaneMode = "condensed" | "comfort" | "card";
type CardSize = "small" | "medium" | "large";

const FILE_PANE_OPTIONS: { key: FilePaneMode; label: string; description: string; icon: React.ReactNode }[] = [
  { key: "condensed", label: "Condensed", description: "Compact list view",   icon: <List size={18} /> },
  { key: "comfort",   label: "Comfort",   description: "Spacious list view",  icon: <AlignJustify size={18} /> },
  { key: "card",      label: "Card",      description: "Sized card grid",     icon: <LayoutGrid size={18} /> },
];

const CARD_SIZE_COLUMNS: Record<CardSize, string> = {
  large:  "repeat(auto-fill, minmax(300px, 1fr))",
  medium: "repeat(auto-fill, minmax(210px, 1fr))",
  small:  "repeat(auto-fill, minmax(150px, 1fr))",
};

function FilePaneModeDropdown({ value, onChange, cardSize, onCardSizeChange }: { value: FilePaneMode; onChange: (v: FilePaneMode) => void; cardSize: CardSize; onCardSizeChange: (s: CardSize) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = FILE_PANE_OPTIONS.find((o) => o.key === value)!;
  const triggerIcon = value === "condensed"
    ? <List size={14} style={{ color: "var(--text-secondary)" }} />
    : value === "comfort"
    ? <AlignJustify size={14} style={{ color: "var(--text-secondary)" }} />
    : <LayoutGrid size={14} style={{ color: "var(--text-secondary)" }} />;

  return (
    <div ref={ref} className="relative shrink-0" style={{ width: "130px" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center border border-border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none w-full"
        style={{
          height: "34px",
          padding: "0 var(--spacing-2-5)",
          borderRadius: "var(--radius-sm)",
          backgroundColor: open ? "hsl(210,100%,96%)" : "var(--piw-card)",
          cursor: "pointer",
          gap: "var(--spacing-1-5)",
          fontFamily: font,
          fontWeight: "var(--font-weight-medium)" as any,
          fontSize: "var(--text-caption)",
          color: "var(--piw-foreground)",
          boxShadow: "var(--elevation-xs)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(210,100%,96%)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = open ? "hsl(210,100%,96%)" : "var(--piw-card)"; }}
      >
        {triggerIcon}
        {current.label}
        <ChevronDown
          size={11}
          style={{
            marginLeft: "auto",
            color: "var(--text-tertiary)",
            transition: "transform 0.15s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 border border-border"
          style={{
            top: "calc(100% + 4px)",
            right: 0,
            width: "240px",
            borderRadius: "var(--radius-md)",
            background: "var(--piw-card)",
            boxShadow: "0 8px 24px rgba(16,24,40,0.10), 0 2px 6px rgba(16,24,40,0.06)",
            padding: "var(--spacing-1-5)",
          }}
        >
          {FILE_PANE_OPTIONS.map((opt) => {
            const isActive = opt.key === value;
            return (
              <button
                key={opt.key}
                onClick={() => { onChange(opt.key); setOpen(false); }}
                className="flex items-center w-full transition-colors hover:bg-[hsl(210,100%,96%)]"
                style={{
                  padding: "var(--spacing-2) var(--spacing-2-5)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  border: "none",
                  gap: "var(--spacing-2-5)",
                  fontFamily: font,
                  textAlign: "left",
                }}
              >
                <span style={{ color: "var(--text-secondary)", display: "flex", flexShrink: 0 }}>{opt.icon}</span>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
                  <span
                    style={{
                      fontWeight: "var(--font-weight-semibold)" as any,
                      fontSize: "var(--text-body-sm)",
                      color: "var(--piw-foreground)",
                      lineHeight: 1.2,
                    }}
                  >
                    {opt.label}
                  </span>
                  <span
                    style={{
                      fontWeight: "var(--font-weight-normal)" as any,
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
              <div style={{ borderTop: "1px solid var(--piw-border)", margin: "var(--spacing-1-5) var(--spacing-1)" }} />
              <div style={{ padding: "var(--spacing-1) var(--spacing-2)" }}>
                <div
                  style={{
                    fontFamily: font,
                    fontSize: "10px",
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
                          fontFamily: font,
                          fontSize: "11px",
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

/* ══��════════ Sort dropdown for Col 2 ═══════���═══ */
type TxSortMode = "latest" | "oldest";

const TX_SORT_OPTIONS: { key: TxSortMode; label: string }[] = [
  { key: "latest", label: "Latest" },
  { key: "oldest", label: "Oldest" },
];

function TxSortDropdown({ value, onChange }: { value: TxSortMode; onChange: (v: TxSortMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = TX_SORT_OPTIONS.find((o) => o.key === value)!;

  return (
    <div ref={ref} className="relative shrink-0" style={{ width: "96px" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center border border-border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none w-full"
        style={{
          height: "28px",
          padding: "0 var(--spacing-1-5)",
          borderRadius: "var(--radius-sm)",
          backgroundColor: open ? "hsl(210,100%,96%)" : "var(--piw-card)",
          cursor: "pointer",
          gap: "var(--spacing-1)",
          fontFamily: font,
          fontWeight: "var(--font-weight-medium)" as any,
          fontSize: "var(--text-caption)",
          color: "var(--text-secondary)",
          boxShadow: "var(--elevation-xs)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(210,100%,96%)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = open ? "hsl(210,100%,96%)" : "var(--piw-card)"; }}
      >
        <ArrowDownUp size={11} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
        {current.label}
        <ChevronDown
          size={10}
          style={{
            marginLeft: "auto",
            color: "var(--text-tertiary)",
            transition: "transform 0.15s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 border border-border"
          style={{
            top: "calc(100% + 3px)",
            left: 0,
            minWidth: "110px",
            borderRadius: "var(--radius-md)",
            background: "var(--piw-card)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
            padding: "var(--spacing-0-5)",
          }}
        >
          {TX_SORT_OPTIONS.map((opt) => {
            const isActive = opt.key === value;
            return (
              <button
                key={opt.key}
                onClick={() => { onChange(opt.key); setOpen(false); }}
                className="flex items-center w-full transition-colors"
                style={{
                  height: "30px",
                  padding: "0 var(--spacing-2)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  border: "none",
                  backgroundColor: isActive ? "var(--primary-50)" : "transparent",
                  gap: "var(--spacing-1-5)",
                  fontFamily: font,
                  fontWeight: isActive ? "var(--font-weight-semibold)" as any : "var(--font-weight-medium)" as any,
                  fontSize: "var(--text-caption)",
                  color: isActive ? "var(--piw-primary)" : "var(--piw-foreground)",
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(210,100%,96%)"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** FileTypeDropdown — filters the right pane by file extension.
 *  Options are computed from the currently visible files so only extensions
 *  that actually exist in the active scope are listed. */
function FileTypeDropdown({ value, onChange, available }: { value: string; onChange: (v: string) => void; available: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const options = [{ key: "all", label: "All File Types" }, ...available.map((e) => ({ key: e, label: e.toUpperCase() }))];
  const current = options.find((o) => o.key === value) ?? options[0];

  return (
    <div ref={ref} className="relative shrink-0" style={{ width: "140px" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center border border-border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none w-full"
        style={{
          height: "28px",
          padding: "0 var(--spacing-1-5)",
          borderRadius: "var(--radius-sm)",
          backgroundColor: open ? "hsl(210,100%,96%)" : "var(--piw-card)",
          cursor: "pointer",
          gap: "var(--spacing-1)",
          fontFamily: font,
          fontWeight: "var(--font-weight-medium)" as any,
          fontSize: "var(--text-caption)",
          color: "var(--text-secondary)",
          boxShadow: "var(--elevation-xs)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(210,100%,96%)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = open ? "hsl(210,100%,96%)" : "var(--piw-card)"; }}
      >
        <ListFilter size={11} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
        {current.label}
        <ChevronDown
          size={10}
          style={{
            marginLeft: "auto",
            color: "var(--text-tertiary)",
            transition: "transform 0.15s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 border border-border"
          style={{
            top: "calc(100% + 3px)",
            left: 0,
            minWidth: "130px",
            maxHeight: "260px",
            overflowY: "auto",
            borderRadius: "var(--radius-md)",
            background: "var(--piw-card)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
            padding: "var(--spacing-0-5)",
          }}
        >
          {options.map((opt) => {
            const isActive = opt.key === value;
            return (
              <button
                key={opt.key}
                onClick={() => { onChange(opt.key); setOpen(false); }}
                className="flex items-center w-full transition-colors"
                style={{
                  height: "30px",
                  padding: "0 var(--spacing-2)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  border: "none",
                  backgroundColor: isActive ? "var(--primary-50)" : "transparent",
                  gap: "var(--spacing-1-5)",
                  fontFamily: font,
                  fontWeight: isActive ? "var(--font-weight-semibold)" as any : "var(--font-weight-medium)" as any,
                  fontSize: "var(--text-caption)",
                  color: isActive ? "var(--piw-primary)" : "var(--piw-foreground)",
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(210,100%,96%)"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FolderTreeView({
  items,
  onTransactionClick,
  searchQuery,
  onPreviewClick,
  filePaneMode,
  cardSize,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onFilesSelected,
  uploadingProgress,
}: {
  items: Attachment[];
  onTransactionClick?: (att: Attachment) => void;
  searchQuery?: string;
  onPreviewClick?: (att: Attachment) => void;
  filePaneMode: FilePaneMode;
  cardSize: CardSize;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onFilesSelected?: (files: File[]) => void;
  uploadingProgress?: Record<string, number>;
}) {
  /* Two-tier selection: source scope (Col 1) is independent of transaction drill-in (Col 2) */
  const [sourceScope, setSourceScope] = useState<"all" | SourceType>("Item Library");
  const [txDrillIn, setTxDrillIn] = useState<{ source: SourceType; txId: string } | null>(null);
  const [txSearch, setTxSearch] = useState("");
  const [txSortMode, setTxSortMode] = useState<TxSortMode>("latest");
  const [fileSortMode, setFileSortMode] = useState<TxSortMode>("latest");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
  const [libCategory, setLibCategory] = useState<"all" | "documents" | "photos" | "videos" | "audio">("all");
  const [filePaneLoading, setFilePaneLoading] = useState(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Show a brief shimmer in Col 3 when navigating to a large file set */
  const triggerFilePaneLoad = useCallback((fileCount: number) => {
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    if (fileCount > 15) {
      setFilePaneLoading(true);
      const delay = Math.min(400 + fileCount * 4, 900);
      loadingTimerRef.current = setTimeout(() => setFilePaneLoading(false), delay);
    }
  }, []);

  useEffect(() => { return () => { if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current); }; }, []);

  /* Build tree structure — always include all sources even if empty */
  const grouped = useMemo(() => {
    const bySource: Record<string, Attachment[]> = {};
    items.forEach((a) => {
      if (!bySource[a.source]) bySource[a.source] = [];
      bySource[a.source].push(a);
    });
    return FOLDER_ORDER.map((source) => {
        const sourceItems = bySource[source] || [];
        const byTx: Record<string, Attachment[]> = {};
        sourceItems.forEach((a) => {
          const txKey = a.linkedTransactionId || "__standalone__";
          if (!byTx[txKey]) byTx[txKey] = [];
          byTx[txKey].push(a);
        });
        const txGroups = Object.entries(byTx).sort(([, a], [, b]) =>
          b[0].uploadedDate.localeCompare(a[0].uploadedDate),
        );
        return { source, items: sourceItems, txGroups };
      });
  }, [items]);

  /* Validate sourceScope still exists — always valid since all sources are included */
  const effectiveScope: "all" | SourceType = sourceScope;

  /* Validate txDrillIn still exists */
  const effectiveTx = useMemo(() => {
    if (!txDrillIn) return null;
    const sg = grouped.find((g) => g.source === txDrillIn.source);
    if (sg && sg.txGroups.some(([k]) => k === txDrillIn.txId)) return txDrillIn;
    return null;
  }, [txDrillIn, grouped]);

  /* File category helpers for Item Library */
  const LIB_DOC_EXTS: FileType[] = ["pdf", "xlsx", "csv", "docx", "zip", "exe", "psd", "cad", "dxf", "dwg", "stl", "txt", "rar"];
  const LIB_PHOTO_EXTS: FileType[] = ["png", "jpg"];
  const LIB_VIDEO_EXTS: FileType[] = ["mp4"];
  const LIB_AUDIO_EXTS: FileType[] = ["mp3"];

  const filterByLibCategory = useCallback((files: Attachment[]) => {
    if (libCategory === "all") return files;
    if (libCategory === "documents") return files.filter((f) => LIB_DOC_EXTS.includes(f.fileType));
    if (libCategory === "photos") return files.filter((f) => LIB_PHOTO_EXTS.includes(f.fileType));
    if (libCategory === "videos") return files.filter((f) => LIB_VIDEO_EXTS.includes(f.fileType));
    if (libCategory === "audio") return files.filter((f) => LIB_AUDIO_EXTS.includes(f.fileType));
    return files;
  }, [libCategory]);

  /* Files to show on the right pane — base set (before type filter), used to compute available extensions */
  const rightPaneFilesBase = useMemo(() => {
    let base: Attachment[];
    if (effectiveTx) {
      const sg = grouped.find((g) => g.source === effectiveTx.source);
      const txg = sg?.txGroups.find(([k]) => k === effectiveTx.txId);
      base = txg ? txg[1] : [];
    } else if (effectiveScope === "all") {
      base = items;
    } else {
      const sg = grouped.find((g) => g.source === effectiveScope);
      const sourceFiles = sg ? sg.items : [];
      base = effectiveScope === "Item Library" ? filterByLibCategory(sourceFiles) : sourceFiles;
    }
    const toTs = (d: string, t?: string) => {
      const [mm, dd, yyyy] = d.split("/").map(Number);
      let h = 0, min = 0;
      if (t) {
        const m = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (m) {
          h = Number(m[1]);
          min = Number(m[2]);
          const ap = m[3]?.toUpperCase();
          if (ap === "PM" && h !== 12) h += 12;
          if (ap === "AM" && h === 12) h = 0;
        }
      }
      return new Date(yyyy, (mm || 1) - 1, dd || 1, h, min).getTime();
    };
    return [...base].sort((a, b) => {
      const ta = toTs(a.uploadedDate, a.uploadedTime);
      const tb = toTs(b.uploadedDate, b.uploadedTime);
      return fileSortMode === "latest" ? tb - ta : ta - tb;
    });
  }, [effectiveTx, effectiveScope, grouped, items, filterByLibCategory, fileSortMode]);

  /* Available extensions (sorted, unique) for the FileTypeDropdown */
  const availableExts = useMemo(() => {
    const set = new Set<string>();
    rightPaneFilesBase.forEach((f) => set.add(f.fileType));
    return Array.from(set).sort();
  }, [rightPaneFilesBase]);

  /* Reset the type filter if the current selection isn't available in the new scope */
  useEffect(() => {
    if (fileTypeFilter !== "all" && !availableExts.includes(fileTypeFilter as any)) {
      setFileTypeFilter("all");
    }
  }, [availableExts, fileTypeFilter]);

  const rightPaneFiles = useMemo(() => {
    if (fileTypeFilter === "all") return rightPaneFilesBase;
    return rightPaneFilesBase.filter((f) => f.fileType === fileTypeFilter);
  }, [rightPaneFilesBase, fileTypeFilter]);

  /* Transactions for the middle pane — depends on source scope */
  const middlePaneTxGroups: { source: SourceType; txKey: string; txFiles: Attachment[] }[] = useMemo(() => {
    let sourcesToShow: typeof grouped;
    if (effectiveScope === "all") {
      sourcesToShow = grouped;
    } else {
      const sg = grouped.find((g) => g.source === effectiveScope);
      sourcesToShow = sg ? [sg] : [];
    }
    const all: { source: SourceType; txKey: string; txFiles: Attachment[] }[] = [];
    sourcesToShow.forEach((sg) => {
      sg.txGroups.forEach(([txKey, txFiles]) => {
        if (txKey !== "__standalone__") {
          all.push({ source: sg.source as SourceType, txKey, txFiles });
        }
      });
    });
    return all;
  }, [effectiveScope, grouped]);

  /* Filter & sort middle pane transactions by txSearch + txSortMode */
  const filteredTxGroups = useMemo(() => {
    let result = middlePaneTxGroups;
    if (txSearch.trim()) {
      const q = txSearch.toLowerCase();
      result = result.filter((t) => t.txKey.toLowerCase().includes(q) || t.source.toLowerCase().includes(q));
    }
    if (txSortMode === "latest") {
      result = [...result].sort((a, b) => b.txFiles[0].uploadedDate.localeCompare(a.txFiles[0].uploadedDate));
    } else if (txSortMode === "oldest") {
      result = [...result].sort((a, b) => a.txFiles[0].uploadedDate.localeCompare(b.txFiles[0].uploadedDate));
    }
    return result;
  }, [middlePaneTxGroups, txSearch, txSortMode]);

  /* Handle source scope change — clear transaction drill-in and search */
  const handleSourceChange = useCallback((scope: "all" | SourceType) => {
    setSourceScope(scope);
    setTxDrillIn(null);
    setTxSearch("");
    setLibCategory("all");
    /* Trigger load animation — "all" always loads many files */
    triggerFilePaneLoad(scope === "all" ? items.length : 20);
  }, [items.length, triggerFilePaneLoad]);

  /* Handle transaction click — drill into it without changing source scope */
  const handleTxClick = useCallback((source: SourceType, txId: string) => {
    setTxDrillIn({ source, txId });
  }, []);

  /* Clear tx drill-in (back to source level view) */
  const handleClearTxDrillIn = useCallback(() => {
    setTxDrillIn(null);
    triggerFilePaneLoad(items.length);
  }, [items.length, triggerFilePaneLoad]);

  const isAllSelected = effectiveScope === "all";
  const noTxDrillIn = effectiveTx === null;

  /** Helper to determine TxTypeMini `type` for a given source+txFiles */
  const getTxType = (source: SourceType, txFiles: Attachment[]) =>
    source === "Adjustment"
      ? (txFiles[0]?.linkedTransactionLabel?.includes("Decrease") ? "Adjustment Decrease" : "Adjustment Increase")
      : (SOURCE_TO_TX_TYPE[source] || "Receiving");

  return (
    <div className="flex" style={{ height: "100%", minHeight: "520px" }}>

      {/* ═══════════════ COL 1 — Source folders ═══════════════ */}
      <div
        className="shrink-0 flex flex-col"
        style={{
          width: "210px",
          borderRight: "1px solid var(--piw-border)",
          background: "var(--piw-card)",
        }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2)", borderBottom: "1px solid var(--piw-border)", gap: "var(--spacing-1-5)", height: "42px", boxSizing: "border-box" }}>
          <Layers size={13} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          <span style={{ fontFamily: font, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "var(--text-caption)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Sources
          </span>
        </div>

        {/* Folder list */}
        <div className="flex-1 overflow-y-auto scroll-auto-hide" style={{ padding: "var(--spacing-1-5) 0" }}>
          {/* Source folder rows first */}
          {grouped.map(({ source, items: sourceItems }) => {
            const srcMeta = SOURCE_META[source];
            const isSourceSelected = effectiveScope === source;
            return (
              <div key={source} style={{ padding: "0 var(--spacing-1-5)" }}>
                <button
                  onClick={() => handleSourceChange(source)}
                  className="flex items-center w-full min-w-0 transition-colors"
                  style={{
                    height: "32px",
                    padding: "0 var(--spacing-1-5)",
                    cursor: "pointer", border: "none", borderRadius: "var(--radius-sm)",
                    background: isSourceSelected ? "var(--primary-50)" : "transparent",
                    gap: "var(--spacing-1-5)",
                  }}
                  onMouseEnter={(e) => { if (!isSourceSelected) (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
                  onMouseLeave={(e) => { if (!isSourceSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <FolderOpen size={13} className="shrink-0" style={{ color: srcMeta.color }} />
                  <span className="truncate" style={{ fontFamily: font, fontWeight: isSourceSelected ? "var(--font-weight-semibold)" as any : "var(--font-weight-medium)" as any, fontSize: "var(--text-caption)", color: isSourceSelected ? "var(--piw-primary)" : "var(--piw-foreground)", textAlign: "left", flex: 1 }}>
                    {source}
                  </span>
                  <span className="shrink-0 inline-flex items-center justify-center" style={{ minWidth: "16px", height: "16px", padding: "0 var(--spacing-0-5)", borderRadius: "9999px", background: isSourceSelected ? "var(--primary-100)" : "var(--surface-secondary)", fontFamily: fontInter, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "9px", color: isSourceSelected ? "var(--primary-700)" : "var(--text-tertiary)", lineHeight: 1 }}>
                    {sourceItems.length}
                  </span>
                </button>
              </div>
            );
          })}

          {/* Divider before All Files */}
          <div style={{ height: "1px", background: "var(--piw-border)", margin: "var(--spacing-1) var(--spacing-2)" }} />

          {/* All Files node — at the bottom */}
          <div style={{ padding: "0 var(--spacing-1-5)" }}>
            <button
              onClick={() => handleSourceChange("all")}
              className="flex items-center w-full transition-colors"
              style={{
                height: "32px",
                padding: "0 var(--spacing-1-5)",
                cursor: "pointer", border: "none", borderRadius: "var(--radius-sm)",
                background: isAllSelected ? "var(--primary-50)" : "transparent",
                gap: "var(--spacing-1-5)",
              }}
              onMouseEnter={(e) => { if (!isAllSelected) (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
              onMouseLeave={(e) => { if (!isAllSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Layers size={13} className="shrink-0" style={{ color: isAllSelected ? "var(--piw-primary)" : "var(--text-secondary)" }} />
              <span className="truncate" style={{ fontFamily: font, fontWeight: isAllSelected ? "var(--font-weight-semibold)" as any : "var(--font-weight-medium)" as any, fontSize: "var(--text-caption)", color: isAllSelected ? "var(--piw-primary)" : "var(--piw-foreground)", textAlign: "left", flex: 1 }}>
                All Files
              </span>
              <span className="shrink-0 inline-flex items-center justify-center" style={{ minWidth: "16px", height: "16px", padding: "0 var(--spacing-0-5)", borderRadius: "9999px", background: isAllSelected ? "var(--primary-100)" : "var(--surface-secondary)", fontFamily: fontInter, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "9px", color: isAllSelected ? "var(--primary-700)" : "var(--text-tertiary)", lineHeight: 1 }}>
                {items.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════ COL 2 — Context pane ═══════════════ */}
      <div
        className="shrink-0 flex flex-col"
        style={{
          width: "300px",
          borderRight: "1px solid var(--piw-border)",
          background: "color-mix(in srgb, var(--surface-secondary) 45%, var(--piw-card))",
        }}
      >
        {/* Header — reflects selected source */}
        <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2)", borderBottom: "1px solid var(--piw-border)", gap: "var(--spacing-1-5)", height: "42px", boxSizing: "border-box", background: "var(--piw-card)" }}>
          <span style={{ fontFamily: font, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "var(--text-caption)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {effectiveScope === "all" ? "All Sources" : effectiveScope}
          </span>
          {effectiveScope !== "Item Library" && (
            <div style={{ marginLeft: "auto" }}>
              <TxSortDropdown value={txSortMode} onChange={setTxSortMode} />
            </div>
          )}
        </div>

        {/* "All transactions" option — hidden for Item Library */}
        {effectiveScope !== "Item Library" && (
        <div style={{ padding: "var(--spacing-1) var(--spacing-1-5)", borderBottom: "1px solid color-mix(in srgb, var(--piw-border) 50%, transparent)" }}>
          <button
            onClick={handleClearTxDrillIn}
            className="flex items-center w-full transition-colors"
            style={{
              height: "32px",
              padding: "0 var(--spacing-1-5)",
              cursor: "pointer", border: "none", borderRadius: "var(--radius-sm)",
              background: noTxDrillIn ? "var(--primary-50)" : "transparent",
              gap: "var(--spacing-1-5)",
            }}
            onMouseEnter={(e) => { if (!noTxDrillIn) (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
            onMouseLeave={(e) => { if (!noTxDrillIn) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Layers size={12} className="shrink-0" style={{ color: noTxDrillIn ? "var(--piw-primary)" : "var(--text-secondary)" }} />
            <span style={{ fontFamily: font, fontWeight: noTxDrillIn ? "var(--font-weight-semibold)" as any : "var(--font-weight-medium)" as any, fontSize: "var(--text-caption)", color: noTxDrillIn ? "var(--piw-primary)" : "var(--piw-foreground)", textAlign: "left" }}>
              All transactions
            </span>
          </button>
        </div>
        )}

        {/* Transaction list / Item Library document info */}
        <div className="flex-1 overflow-y-auto scroll-auto-hide" style={{ padding: "var(--spacing-1) 0" }}>
          {effectiveScope === "Item Library" ? (
            /* Item Library — file category structure instead of transactions */
            (() => {
              const libGroup = grouped.find((g) => g.source === "Item Library");
              const libFiles = libGroup?.items ?? [];
              const docCount = libFiles.filter((f) => ["pdf", "xlsx", "csv", "docx", "zip", "exe", "psd", "cad", "dxf", "dwg", "stl", "txt", "rar"].includes(f.fileType)).length;
              const photoCount = libFiles.filter((f) => ["png", "jpg"].includes(f.fileType)).length;
              const videoCount = libFiles.filter((f) => ["mp4"].includes(f.fileType)).length;
              const audioCount = libFiles.filter((f) => ["mp3"].includes(f.fileType)).length;

              const categories: { key: "all" | "documents" | "photos" | "videos" | "audio"; label: string; count: number; icon: React.ReactNode }[] = [
                { key: "all", label: "All Files", count: libFiles.length, icon: <Layers size={12} /> },
                { key: "documents", label: "Documents", count: docCount, icon: <FileText size={12} /> },
                { key: "photos", label: "Photos", count: photoCount, icon: <FileImage size={12} /> },
                { key: "videos", label: "Videos", count: videoCount, icon: <File size={12} /> },
                { key: "audio", label: "Audio", count: audioCount, icon: <File size={12} /> },
              ];

              return (
                <>
                  {categories.map((cat) => {
                    const isActive = libCategory === cat.key;
                    return (
                      <div key={cat.key} style={{ padding: "0 var(--spacing-1-5)" }}>
                        <button
                          onClick={() => setLibCategory(cat.key)}
                          className="flex items-center w-full min-w-0 transition-colors"
                          style={{
                            height: "32px",
                            padding: "0 var(--spacing-1-5)",
                            cursor: "pointer", border: "none", borderRadius: "var(--radius-sm)",
                            background: isActive ? "var(--primary-50)" : "transparent",
                            gap: "var(--spacing-1-5)",
                          }}
                          onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
                          onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                        >
                          <span style={{ color: isActive ? "var(--piw-primary)" : "var(--text-secondary)", display: "flex", flexShrink: 0 }}>{cat.icon}</span>
                          <span className="truncate" style={{ fontFamily: font, fontWeight: isActive ? "var(--font-weight-semibold)" as any : "var(--font-weight-medium)" as any, fontSize: "var(--text-caption)", color: isActive ? "var(--piw-primary)" : "var(--piw-foreground)", textAlign: "left", flex: 1 }}>
                            {cat.label}
                          </span>
                          <span className="shrink-0 inline-flex items-center justify-center" style={{ minWidth: "16px", height: "16px", padding: "0 var(--spacing-0-5)", borderRadius: "9999px", background: isActive ? "var(--primary-100)" : "color-mix(in srgb, var(--piw-border) 60%, var(--surface-secondary))", fontFamily: fontInter, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "9px", color: isActive ? "var(--primary-700)" : "var(--text-tertiary)", lineHeight: 1 }}>
                            {cat.count}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </>
              );
            })()
          ) : filteredTxGroups.length === 0 ? (
            <EmptyState
              title="No transactions"
              subtitle="No transactions available for this source."
              iconComponent={FolderOpen}
            />
          ) : (
            filteredTxGroups.map(({ source, txKey, txFiles }) => {
              const isTxSelected = effectiveTx?.txId === txKey && effectiveTx?.source === source;
              return (
                <div key={`${source}__${txKey}`} style={{ padding: "0 var(--spacing-1-5)" }}>
                  <button
                    onClick={() => handleTxClick(source, txKey)}
                    className="flex items-center w-full min-w-0 transition-colors"
                    style={{
                      height: "32px",
                      padding: "0 var(--spacing-1-5)", cursor: "pointer", border: "none",
                      borderRadius: "var(--radius-sm)",
                      background: isTxSelected ? "var(--primary-50)" : "transparent",
                      gap: "var(--spacing-1-5)",
                    }}
                    onMouseEnter={(e) => { if (!isTxSelected) (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
                    onMouseLeave={(e) => { if (!isTxSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <TxTypeMini type={getTxType(source, txFiles)} />
                    <span className="truncate" style={{ fontFamily: font, fontWeight: isTxSelected ? "var(--font-weight-semibold)" as any : "var(--font-weight-medium)" as any, fontSize: "var(--text-caption)", color: isTxSelected ? "var(--piw-primary)" : "var(--piw-foreground)", textAlign: "left", flex: 1 }}>
                      <HighlightText text={txKey} query={txSearch || searchQuery} />
                    </span>
                    <span className="shrink-0 inline-flex items-center justify-center" style={{ minWidth: "16px", height: "16px", padding: "0 var(--spacing-0-5)", borderRadius: "9999px", background: isTxSelected ? "var(--primary-100)" : "color-mix(in srgb, var(--piw-border) 60%, var(--surface-secondary))", fontFamily: fontInter, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "9px", color: isTxSelected ? "var(--primary-700)" : "var(--text-tertiary)", lineHeight: 1 }}>
                      {txFiles.length}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══════════════ COL 3 — File list ═══════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Breadcrumb header */}
        <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2) var(--spacing-3)", borderBottom: "1px solid var(--piw-border)", gap: "var(--spacing-1-5)", background: "var(--piw-card)", height: "42px", boxSizing: "border-box" }}>
          {/* Breadcrumb: scope label */}
          {effectiveScope === "all" && !effectiveTx ? (
            <>
              <Layers size={13} style={{ color: "var(--piw-primary)", flexShrink: 0 }} />
              <span style={{ fontFamily: font, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "var(--text-caption)", color: "var(--piw-foreground)" }}>All Files</span>
            </>
          ) : effectiveTx ? (
            <>
              <FolderOpen size={13} style={{ color: SOURCE_META[effectiveTx.source]?.color ?? "var(--text-secondary)", flexShrink: 0 }} />
              <button
                onClick={handleClearTxDrillIn}
                style={{ fontFamily: font, fontWeight: "var(--font-weight-medium)" as any, fontSize: "var(--text-caption)", color: "var(--piw-primary)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
              >
                {effectiveScope === "all" ? "All Files" : effectiveTx.source}
              </button>
              <ChevronRight size={10} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
              <TxTypeMini type={(() => {
                const sg = grouped.find((g) => g.source === effectiveTx.source);
                const txg = sg?.txGroups.find(([k]) => k === effectiveTx.txId);
                return getTxType(effectiveTx.source, txg?.[1] ?? []);
              })()} />
              <span style={{ fontFamily: font, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "var(--text-caption)", color: "var(--piw-foreground)" }}>
                {effectiveTx.txId}
              </span>
            </>
          ) : (
            <>
              {effectiveScope === "Item Library"
                ? <Library size={13} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                : <FolderOpen size={13} style={{ color: SOURCE_META[effectiveScope]?.color ?? "var(--text-secondary)", flexShrink: 0 }} />
              }
              <span style={{ fontFamily: font, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "var(--text-caption)", color: "var(--piw-foreground)" }}>
                {effectiveScope}
              </span>
            </>
          )}
          {/* Right side: file count + sort dropdown + compact view dropdown */}
          <div className="flex items-center shrink-0" style={{ marginLeft: "auto", gap: "var(--spacing-2)" }}>
            <span style={{ fontFamily: font, fontWeight: "var(--font-weight-normal)" as any, fontSize: "var(--text-caption)", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
              {rightPaneFiles.length} file{rightPaneFiles.length !== 1 ? "s" : ""} &middot; {formatFolderSize(rightPaneFiles)}
            </span>
            <DateRangePresetDropdown
              compact
              scope={effectiveScope}
              onDateRange={(from, to) => { onDateFromChange(from); onDateToChange(to); }}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={onDateFromChange}
              onDateToChange={onDateToChange}
            />
            <FileTypeDropdown value={fileTypeFilter} onChange={setFileTypeFilter} available={availableExts} />
            <TxSortDropdown value={fileSortMode} onChange={setFileSortMode} />
          </div>
        </div>

        {/* Upload drop-zone — only for Item Library, matches Create Item modal UX */}
        {effectiveScope === "Item Library" && onFilesSelected && (
          <div style={{ padding: "var(--spacing-3) var(--spacing-3) 0" }}>
            <LibraryUploadDropzone onFilesSelected={onFilesSelected} />
          </div>
        )}

        {/* File content — list or grid */}
        <div className="flex-1 overflow-y-auto scroll-auto-hide">
          {filePaneLoading ? (
            <FilePaneShimmer mode={filePaneMode} />
          ) : rightPaneFiles.length === 0 ? (
            <EmptyState
              title="No files yet"
              subtitle="No files have been attached to this source yet. Upload a file to get started."
              iconComponent={Paperclip}
            />
          ) : filePaneMode !== "card" ? (
            <>
              <FileListHeader />
              {rightPaneFiles.map((att) => (
                <ExplorerFileRow key={att.id} att={att} onTransactionClick={onTransactionClick} searchQuery={searchQuery} density={filePaneMode} />
              ))}
            </>

          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: CARD_SIZE_COLUMNS[cardSize],
                padding: "var(--spacing-3)",
                gap: "calc(var(--spacing-3) + 2px)",
              }}
            >
              {rightPaneFiles.map((att) => {
                const pct = uploadingProgress?.[att.id];
                if (pct !== undefined) {
                  return (
                    <UploadingCard
                      key={att.id}
                      fileName={att.fileName}
                      fileSize={att.fileSize}
                      ext={att.fileType}
                      progress={pct}
                      onCancel={() => {/* files persist in state; cancel is a no-op during the short fake upload */}}
                    />
                  );
                }
                return (
                  <ThumbnailCard key={att.id} att={att} onTransactionClick={onTransactionClick} searchQuery={searchQuery} onPreviewClick={onPreviewClick} />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Shimmer loader for Col 3 file pane while navigating large sets */
function FilePaneShimmer({ mode }: { mode: FilePaneMode }) {
  const shimmerStyle: React.CSSProperties = {
    background: "linear-gradient(90deg, var(--surface-secondary) 25%, color-mix(in srgb, var(--surface-secondary) 50%, var(--piw-card)) 50%, var(--surface-secondary) 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
    borderRadius: "var(--radius-sm)",
  };

  if (mode === "card") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: THUMB_GRID_COLUMNS, padding: "var(--spacing-3)", gap: "var(--spacing-3)" }}>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} style={{ borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <div style={{ ...shimmerStyle, height: "120px", borderRadius: "var(--radius-md) var(--radius-md) 0 0" }} />
            <div style={{ padding: "var(--spacing-2)", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ ...shimmerStyle, height: "10px", width: `${65 + (i % 3) * 12}%` }} />
              <div style={{ ...shimmerStyle, height: "8px", width: "40%" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          className="flex items-center"
          style={{
            padding: "var(--spacing-1-5) var(--spacing-3)",
            borderBottom: "1px solid color-mix(in srgb, var(--piw-border) 50%, transparent)",
            gap: "var(--spacing-2-5)",
          }}
        >
          <div style={{ ...shimmerStyle, width: "36px", height: "36px", flexShrink: 0 }} />
          <div className="flex flex-col flex-1" style={{ gap: "5px" }}>
            <div style={{ ...shimmerStyle, height: "10px", width: `${40 + (i * 7) % 35}%` }} />
            <div style={{ ...shimmerStyle, height: "8px", width: `${20 + (i * 5) % 20}%` }} />
          </div>
          <div style={{ ...shimmerStyle, height: "9px", width: "48px", flexShrink: 0 }} />
          <div style={{ ...shimmerStyle, height: "9px", width: "100px", flexShrink: 0 }} />
          <div style={{ ...shimmerStyle, height: "9px", width: "70px", flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

/** Compact inline thumbnail for the explorer file row (36×36) */
function InlineThumbnail({ att }: { att: Attachment }) {
  const [imgErr, setImgErr] = useState(false);
  const tb = getFileThumbnail(att.fileType);
  const isImageType = att.fileType === "png" || att.fileType === "jpg";
  const hasImagePreview = !!att.previewUrl && !imgErr && isImageType;

  return (
    <div
      className="shrink-0 relative overflow-hidden flex items-center justify-center"
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "var(--radius-sm)",
        background: tb.bg,
        border: "1px solid var(--piw-border)",
      }}
    >
      {hasImagePreview ? (
        <img
          src={att.previewUrl!}
          alt=""
          onError={() => setImgErr(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <FileTypeIcon type={att.fileType} size={16} />
      )}
      {/* tiny ext badge — white bg, gray border, colored text (matches card) */}
      <span
        className="absolute"
        style={{
          bottom: "1px",
          right: "1px",
          padding: "0px 2px",
          borderRadius: "2px",
          background: "#FFFFFF",
          border: "1px solid var(--piw-border)",
          fontFamily: fontInter,
          fontWeight: "var(--font-weight-semibold)" as any,
          fontSize: "7px",
          color: tb.color,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          lineHeight: "11px",
          boxShadow: hasImagePreview ? "0 1px 2px rgba(0,0,0,0.18)" : undefined,
        }}
      >
        {fileExtLabel(att.fileType)}
      </span>
    </div>
  );
}

/** Individual file row for the right pane explorer view */
function FileListHeader() {
  const cellStyle: React.CSSProperties = {
    fontFamily: font,
    fontWeight: 600,
    fontSize: "11px",
    color: "#94a3b8",
    textTransform: "none",
    letterSpacing: "0.01em",
    textAlign: "left",
  };
  return (
    <div
      className="flex items-center sticky top-0 z-10 bg-slate-50"
      style={{
        padding: "calc(var(--spacing-1-5) + 2px) var(--spacing-3)",
        borderBottom: "1px solid var(--piw-border)",
        columnGap: "2px",
      }}
    >
      <div className="flex-1 min-w-0" style={cellStyle}>File Name</div>
      <div className="shrink-0" style={{ ...cellStyle, width: "70px" }}>Size</div>
      <div className="shrink-0" style={{ ...cellStyle, width: "150px" }}>Date</div>
      <div className="shrink-0" style={{ ...cellStyle, width: "140px" }}>Uploaded By</div>
      <div className="shrink-0" style={{ width: "36px" }} />
    </div>
  );
}


function ExplorerFileRow({ att, onTransactionClick, searchQuery, density = "condensed" }: { att: Attachment; onTransactionClick?: (att: Attachment) => void; searchQuery?: string; density?: "condensed" | "comfort" }) {

  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const verticalPadding = density === "comfort" ? "var(--spacing-3)" : "calc(var(--spacing-1-5) + 1px)";

  return (
    <div
      className="flex items-center transition-colors"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-row-menu]') || (e.target as HTMLElement).closest('a')) return;
        setShowPreview(true);
      }}
      style={{
        padding: `${verticalPadding} var(--spacing-3)`,
        borderBottom: "1px solid color-mix(in srgb, var(--piw-border) 50%, transparent)",
        background: hovered ? "var(--primary-50)" : "transparent",
        cursor: "pointer",
        columnGap: "2px",
      }}
    >
      <div className="flex items-center flex-1 min-w-0" style={{ gap: "var(--spacing-2-5)" }}>
        {/* Thumbnail preview */}
        <InlineThumbnail att={att} />
        <div className="flex flex-col min-w-0" style={{ gap: "2px" }}>
          <span className="truncate" style={{ fontFamily: font, fontWeight: "var(--font-weight-medium)" as any, fontSize: "var(--text-caption)", color: "var(--piw-foreground)", lineHeight: 1.3 }} title={att.fileName}>
            <HighlightText text={att.fileName} query={searchQuery} />
          </span>
          <div className="flex items-center" style={{ gap: "var(--spacing-1)" }}>
            {att.linkedTransactionId && (
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTransactionClick?.(att); }}
                className="inline-flex items-center transition-colors"
                style={{ padding: "0px var(--spacing-1-5)", borderRadius: "9999px", background: hovered ? "var(--piw-card)" : "var(--surface-secondary)", border: "1px solid var(--piw-border)", fontFamily: font, fontWeight: "var(--font-weight-medium)" as any, fontSize: "var(--text-badge)", color: "var(--text-secondary)", whiteSpace: "nowrap", gap: "var(--spacing-0-5)", textDecoration: "none", lineHeight: "16px" }}
                title={att.linkedTransactionLabel ?? att.linkedTransactionId}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary-100)"; e.currentTarget.style.borderColor = "var(--primary-200)"; e.currentTarget.style.color = "var(--piw-primary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = hovered ? "var(--piw-card)" : "var(--surface-secondary)"; e.currentTarget.style.borderColor = "var(--piw-border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              >
                <ExternalLink size={8} style={{ flexShrink: 0 }} />
                <HighlightText text={att.linkedTransactionId} query={searchQuery} />
              </a>
            )}
          </div>
        </div>
      </div>
      <span className="shrink-0" style={{ width: "70px", textAlign: "left", fontFamily: font, fontWeight: "var(--font-weight-normal)" as any, fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
        {att.fileSize}
      </span>
      <span className="shrink-0" style={{ width: "150px", textAlign: "left", fontFamily: font, fontWeight: "var(--font-weight-normal)" as any, fontSize: "var(--text-caption)", color: "var(--text-tertiary)" }}>
        <HighlightText text={formatDateShort(att.uploadedDate, att.uploadedTime)} query={searchQuery} />
      </span>
      <div className="shrink-0 flex items-center" style={{ width: "140px", gap: "var(--spacing-1-5)", minWidth: 0 }}>
        <PersonHoverCard name={att.uploadedBy} size="caption" showAvatar avatarSize={20} />
      </div>
      <div ref={menuRef} data-row-menu className="relative shrink-0" style={{ width: "36px", display: "flex", justifyContent: "center" }}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((p) => !p); }}
          className="flex items-center justify-center"
          style={{ width: "24px", height: "24px", borderRadius: "var(--radius-xs)", cursor: "pointer", border: "none", background: "transparent", opacity: hovered || menuOpen ? 1 : 0, transition: "opacity 0.1s ease, background-color 0.15s ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(210,100%,96%)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <MoreVertical size={14} style={{ color: "var(--text-secondary)" }} />
        </button>
        {menuOpen && (
          <div className="absolute z-50 border border-border" style={{ top: "calc(100% + 2px)", right: 0, minWidth: "120px", borderRadius: "var(--radius-md)", background: "var(--piw-card)", boxShadow: "var(--elevation-card)", padding: "var(--spacing-1)" }}>
            {[
              { label: "Preview", icon: <Eye size={13} style={{ color: "var(--text-secondary)" }} />, action: () => setShowPreview(true) },
              { label: "Download", icon: <Download size={13} style={{ color: "var(--text-secondary)" }} />, action: () => {} },
            ].map((item) => (
              <button
                key={item.label}
                className="flex items-center w-full"
                style={{ height: "30px", padding: "0 var(--spacing-2)", borderRadius: "var(--radius-sm)", cursor: "pointer", border: "none", background: "transparent", gap: "var(--spacing-1-5)", fontFamily: font, fontWeight: "var(--font-weight-medium)" as any, fontSize: "var(--text-caption)", color: "var(--piw-foreground)", transition: "background-color 0.15s ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(210,100%,96%)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); item.action(); }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {showPreview && (
        <AttachmentPreviewModal attachment={att} onClose={() => setShowPreview(false)} onDelete={() => {/* placeholder */}} />
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════════
 * § 4e  LOADING SKELETON
 * ═════════════════════════════════════════════════════════════════════════════ */

const skeletonPulse: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--surface-secondary) 25%, color-mix(in srgb, var(--surface-secondary) 60%, var(--piw-card)) 50%, var(--surface-secondary) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s ease-in-out infinite",
  borderRadius: "var(--radius-sm)",
};

function SkeletonBlock({ width, height, style }: { width: string | number; height: string | number; style?: React.CSSProperties }) {
  return <div style={{ ...skeletonPulse, width, height, ...style }} />;
}

function AttachmentsLoadingSkeleton() {
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div className="flex" style={{ height: "clamp(520px, calc(100vh - 380px), 1200px)" }}>
        {/* Col 1 skeleton */}
        <div className="shrink-0 flex flex-col" style={{ width: "210px", borderRight: "1px solid var(--piw-border)", background: "var(--piw-card)" }}>
          <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2)", borderBottom: "1px solid var(--piw-border)", height: "42px", boxSizing: "border-box", gap: "var(--spacing-1-5)" }}>
            <SkeletonBlock width={13} height={13} style={{ borderRadius: "3px" }} />
            <SkeletonBlock width={52} height={11} />
          </div>
          <div className="flex flex-col" style={{ padding: "var(--spacing-2) var(--spacing-1-5)", gap: "var(--spacing-1)" }}>
            <SkeletonBlock width="100%" height={32} style={{ borderRadius: "var(--radius-sm)" }} />
            <div style={{ height: "1px", background: "var(--piw-border)", margin: "var(--spacing-0-5) var(--spacing-0-5)" }} />
            {[0.85, 0.72, 0.68, 0.78, 0.6, 0.55].map((w, i) => (
              <SkeletonBlock key={i} width={`${w * 100}%`} height={32} style={{ borderRadius: "var(--radius-sm)" }} />
            ))}
          </div>
        </div>

        {/* Col 2 skeleton */}
        <div className="shrink-0 flex flex-col" style={{ width: "210px", borderRight: "1px solid var(--piw-border)", background: "var(--surface-secondary)" }}>
          <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2)", borderBottom: "1px solid var(--piw-border)", height: "42px", boxSizing: "border-box", gap: "var(--spacing-1-5)" }}>
            <SkeletonBlock width={72} height={11} />
            <SkeletonBlock width={16} height={16} style={{ borderRadius: "9999px" }} />
          </div>
          <div style={{ padding: "var(--spacing-1-5) var(--spacing-2)", borderBottom: "1px solid var(--piw-border)" }}>
            <SkeletonBlock width="100%" height={28} style={{ borderRadius: "var(--radius-sm)" }} />
          </div>
          <div style={{ padding: "var(--spacing-1) var(--spacing-1-5)", borderBottom: "1px solid color-mix(in srgb, var(--piw-border) 50%, transparent)" }}>
            <SkeletonBlock width="70%" height={32} style={{ borderRadius: "var(--radius-sm)" }} />
          </div>
          <div className="flex flex-col" style={{ padding: "var(--spacing-1-5) var(--spacing-1-5)", gap: "var(--spacing-1)" }}>
            {[0.9, 0.82, 0.88, 0.75, 0.92].map((w, i) => (
              <SkeletonBlock key={i} width={`${w * 100}%`} height={32} style={{ borderRadius: "var(--radius-sm)" }} />
            ))}
          </div>
        </div>

        {/* Col 3 skeleton — file list */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2) var(--spacing-3)", borderBottom: "1px solid var(--piw-border)", height: "42px", boxSizing: "border-box", gap: "var(--spacing-1-5)" }}>
            <SkeletonBlock width={13} height={13} style={{ borderRadius: "3px" }} />
            <SkeletonBlock width={56} height={12} />
            <div style={{ flex: 1 }} />
            <SkeletonBlock width={80} height={11} />
            <SkeletonBlock width={64} height={24} />
          </div>
          <div className="flex flex-col" style={{ padding: 0 }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center"
                style={{
                  padding: "var(--spacing-1-5) var(--spacing-3)",
                  borderBottom: "1px solid color-mix(in srgb, var(--piw-border) 50%, transparent)",
                  gap: "var(--spacing-2-5)",
                }}
              >
                <SkeletonBlock width={36} height={36} style={{ borderRadius: "var(--radius-sm)", flexShrink: 0 }} />
                <div className="flex flex-col flex-1 min-w-0" style={{ gap: "var(--spacing-1)" }}>
                  <SkeletonBlock width={`${55 + (i * 7) % 30}%`} height={12} />
                  <SkeletonBlock width={`${30 + (i * 11) % 25}%`} height={9} />
                </div>
                <SkeletonBlock width={50} height={10} style={{ flexShrink: 0 }} />
                <SkeletonBlock width={100} height={10} style={{ flexShrink: 0 }} />
                <SkeletonBlock width={70} height={10} style={{ flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ═════════════════════════════════════════════════════════════════════════════
 * § 5  MAIN COMPONENT — AttachmentsTab
 * ═════════════════════════════════════════════════════════════════════════════ */

/* ── Mini Calendar Date Picker ── */
function MiniCalendar({
  value,
  onChange,
  minDate,
  maxDate,
}: {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (v: string) => void;
  minDate?: string;
  maxDate?: string;
}) {
  const today = new Date();
  const parsed = value ? new Date(value + "T00:00:00") : null;
  const [viewYear, setViewYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth() : today.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString("en-US", { month: "long", year: "numeric" });

  const isSelected = (day: number) => {
    if (!parsed) return false;
    return parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth && parsed.getDate() === day;
  };
  const isToday = (day: number) => {
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  };
  const isDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    if (minDate) { const min = new Date(minDate + "T00:00:00"); if (d < min) return true; }
    if (maxDate) { const max = new Date(maxDate + "T00:00:00"); if (d > max) return true; }
    return false;
  };

  const selectDay = (day: number) => {
    if (isDisabled(day)) return;
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}`);
  };

  // Build grid cells: leading blanks + days
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ width: "100%" }}>
      {/* Month nav */}
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--spacing-2)" }}>
        <button
          onClick={prevMonth}
          className="flex items-center justify-center cursor-pointer hover:bg-[hsl(210,100%,96%)] transition-colors"
          style={{ width: "24px", height: "24px", borderRadius: "var(--radius-sm)", background: "transparent", border: "none" }}
          aria-label="Previous month"
        >
          <ChevronLeft size={14} style={{ color: "var(--text-secondary)" }} />
        </button>
        <span style={{ fontFamily: font, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "var(--text-caption)", color: "var(--piw-foreground)" }}>
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          className="flex items-center justify-center cursor-pointer hover:bg-[hsl(210,100%,96%)] transition-colors"
          style={{ width: "24px", height: "24px", borderRadius: "var(--radius-sm)", background: "transparent", border: "none" }}
          aria-label="Next month"
        >
          <ChevronRight size={14} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0" }}>
        {dayNames.map((dn) => (
          <div
            key={dn}
            className="flex items-center justify-center"
            style={{
              height: "28px",
              fontFamily: font,
              fontWeight: "var(--font-weight-medium)" as any,
              fontSize: "var(--text-badge)",
              color: "var(--text-tertiary)",
            }}
          >
            {dn}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px" }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={`blank-${idx}`} style={{ height: "30px" }} />;
          const selected = isSelected(day);
          const todayDay = isToday(day);
          const disabled = isDisabled(day);
          return (
            <button
              key={day}
              onClick={() => selectDay(day)}
              disabled={disabled}
              className="flex items-center justify-center transition-colors"
              style={{
                height: "30px",
                width: "100%",
                borderRadius: "var(--radius-sm)",
                border: "none",
                cursor: disabled ? "not-allowed" : "pointer",
                fontFamily: font,
                fontWeight: selected ? ("var(--font-weight-semibold)" as any) : ("var(--font-weight-normal)" as any),
                fontSize: "var(--text-caption)",
                color: disabled
                  ? "var(--text-tertiary)"
                  : selected
                    ? "var(--piw-primary-foreground)"
                    : todayDay
                      ? "var(--piw-primary)"
                      : "var(--piw-foreground)",
                background: selected
                  ? "var(--piw-primary)"
                  : "transparent",
                opacity: disabled ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (!selected && !disabled) (e.currentTarget as HTMLElement).style.background = "var(--primary-50)";
              }}
              onMouseLeave={(e) => {
                if (!selected && !disabled) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Date Input with Calendar Popover ── */
function DateInputWithCalendar({
  label,
  value,
  onChange,
  placeholder,
  minDate,
  maxDate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
}) {
  const [showCal, setShowCal] = useState(false);
  const [inputText, setInputText] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  /* Sync external value → display text */
  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split("-");
      setInputText(`${m}/${d}/${y}`);
    } else {
      setInputText("");
    }
  }, [value]);

  /* Close calendar on outside click */
  useEffect(() => {
    if (!showCal) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowCal(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCal]);

  /* Parse typed input mm/dd/yyyy → YYYY-MM-DD */
  const commitTyped = () => {
    if (!inputText.trim()) { onChange(""); return; }
    const parts = inputText.trim().split("/");
    if (parts.length === 3) {
      const [mm, dd, yyyy] = parts;
      if (mm.length <= 2 && dd.length <= 2 && yyyy.length === 4) {
        const m = parseInt(mm, 10);
        const d = parseInt(dd, 10);
        const y = parseInt(yyyy, 10);
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
          onChange(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
          return;
        }
      }
    }
    // Invalid — revert to last good value
    if (value) {
      const [y, m, d] = value.split("-");
      setInputText(`${m}/${d}/${y}`);
    } else {
      setInputText("");
    }
  };

  return (
    <div ref={wrapRef} className="flex flex-col relative" style={{ gap: "var(--spacing-1)" }}>
      <label style={{ fontFamily: font, fontWeight: "var(--font-weight-medium)" as any, fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
        {label}
      </label>
      <div
        className="flex items-center border"
        style={{
          height: "36px",
          borderRadius: "var(--radius-sm)",
          borderColor: showCal ? "var(--piw-primary)" : "var(--piw-border)",
          background: "var(--piw-card)",
          overflow: "hidden",
          transition: "border-color 0.15s ease",
          boxShadow: showCal ? "0 0 0 2px var(--piw-primary)" : "none",
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onFocus={() => setShowCal(true)}
          onBlur={() => { /* delay to let calendar click register */ setTimeout(commitTyped, 200); }}
          onKeyDown={(e) => { if (e.key === "Enter") { commitTyped(); setShowCal(false); } }}
          placeholder={placeholder || "mm/dd/yyyy"}
          className="flex-1 bg-transparent outline-none"
          style={{
            height: "100%",
            padding: "0 var(--spacing-2-5)",
            fontFamily: font,
            fontWeight: "var(--font-weight-normal)" as any,
            fontSize: "var(--text-body-sm)",
            color: inputText ? "var(--piw-foreground)" : "var(--text-tertiary)",
            border: "none",
            minWidth: 0,
          }}
        />
        <button
          onClick={() => setShowCal((v) => !v)}
          className="flex items-center justify-center shrink-0 cursor-pointer hover:bg-[hsl(210,100%,96%)] transition-colors"
          style={{ width: "32px", height: "100%", background: "transparent", border: "none", borderLeft: "1px solid var(--piw-border)" }}
          tabIndex={-1}
          aria-label="Toggle calendar"
        >
          <Calendar size={14} style={{ color: "var(--text-tertiary)" }} />
        </button>
      </div>

      {/* Calendar dropdown */}
      {showCal && (
        <div
          className="absolute z-50"
          style={{
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            borderRadius: "var(--radius-md)",
            background: "var(--piw-card)",
            border: "1px solid var(--piw-border)",
            boxShadow: "var(--elevation-sm)",
            padding: "var(--spacing-2-5)",
          }}
        >
          <MiniCalendar
            value={value}
            onChange={(v) => { onChange(v); setShowCal(false); }}
            minDate={minDate}
            maxDate={maxDate}
          />
        </div>
      )}
    </div>
  );
}

/* ── Date Range Preset Dropdown (matches widget date picker style) ── */
type DatePreset = "all" | "today" | "7d" | "30d" | "3m" | "6m" | "yearly" | "custom";

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "3m", label: "Last 3 Months" },
  { key: "6m", label: "Last 6 Months" },
  { key: "yearly", label: "Yearly" },
  { key: "custom", label: "Custom Date" },
];

function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const to = fmt(now);
  switch (preset) {
    case "all": return { from: "", to: "" };
    case "today": return { from: to, to };
    case "7d": { const f = new Date(now); f.setDate(f.getDate() - 7); return { from: fmt(f), to }; }
    case "30d": { const f = new Date(now); f.setDate(f.getDate() - 30); return { from: fmt(f), to }; }
    case "3m": { const f = new Date(now); f.setMonth(f.getMonth() - 3); return { from: fmt(f), to }; }
    case "6m": { const f = new Date(now); f.setMonth(f.getMonth() - 6); return { from: fmt(f), to }; }
    case "yearly": { const f = new Date(now); f.setFullYear(f.getFullYear() - 1); return { from: fmt(f), to }; }
    default: return { from: "", to: "" };
  }
}

function DateRangePresetDropdown({
  onDateRange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  compact = false,
  scope,
}: {
  onDateRange: (from: string, to: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  compact?: boolean;
  scope?: "all" | SourceType;
}) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<DatePreset>("6m");
  const [showCustom, setShowCustom] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* Apply each folder scope's default date range when the scope changes.
   * Item Library holds timeless reference docs → default to All Time;
   * transaction sources default to Last 6 Months. */
  useEffect(() => {
    if (scope === undefined) return;
    const preset: DatePreset = scope === "Item Library" ? "all" : "6m";
    setActivePreset(preset);
    setShowCustom(false);
    const range = getPresetRange(preset);
    onDateRange(range.from, range.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setShowCustom(false); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentLabel = DATE_PRESETS.find((p) => p.key === activePreset)?.label ?? "Last 6 Months";

  const handleSelect = (preset: DatePreset) => {
    if (preset === "custom") {
      setShowCustom(true);
      setActivePreset("custom");
      return;
    }
    setActivePreset(preset);
    setShowCustom(false);
    const range = getPresetRange(preset);
    onDateRange(range.from, range.to);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative shrink-0" style={compact ? { width: "140px" } : undefined}>
      <button
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center border border-border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none${compact ? " w-full" : ""}`}
        style={{
          height: compact ? "28px" : "34px",
          padding: compact ? "0 var(--spacing-1-5)" : "0 var(--spacing-2-5)",
          borderRadius: "var(--radius-sm)",
          backgroundColor: open ? "hsl(210,100%,96%)" : "var(--piw-card)",
          cursor: "pointer",
          gap: compact ? "var(--spacing-1)" : "var(--spacing-1-5)",
          fontFamily: font,
          fontWeight: "var(--font-weight-medium)" as any,
          fontSize: "var(--text-caption)",
          color: "var(--text-secondary)",
          boxShadow: "var(--elevation-xs)",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(210,100%,96%)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = open ? "hsl(210,100%,96%)" : "var(--piw-card)"; }}
      >
        <Calendar size={compact ? 11 : 13} style={{ flexShrink: 0, color: "var(--text-tertiary)" }} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{currentLabel}</span>
        <ChevronDown
          size={11}
          style={{
            flexShrink: 0,
            color: "var(--text-tertiary)",
            transition: "transform 0.15s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 border border-border"
          style={{
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: showCustom ? "300px" : "180px",
            borderRadius: "var(--radius-md)",
            background: "var(--piw-card)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
            padding: "var(--spacing-1)",
          }}
        >
          {!showCustom ? (
            DATE_PRESETS.map((p) => {
              const isActive = activePreset === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => handleSelect(p.key)}
                  className="flex items-center w-full transition-colors"
                  style={{
                    height: "32px",
                    padding: "0 var(--spacing-2-5)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    border: "none",
                    backgroundColor: isActive ? "var(--primary-50)" : "transparent",
                    gap: "var(--spacing-2)",
                    fontFamily: font,
                    fontWeight: isActive ? "var(--font-weight-semibold)" as any : "var(--font-weight-medium)" as any,
                    fontSize: "var(--text-body-sm)",
                    color: isActive ? "var(--piw-primary)" : "var(--piw-foreground)",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(210,100%,96%)"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  {p.key === "custom" && <Calendar size={13} style={{ color: isActive ? "var(--piw-primary)" : "var(--text-tertiary)", flexShrink: 0 }} />}
                  {p.label}
                </button>
              );
            })
          ) : (
            <div style={{ padding: "var(--spacing-2)" }}>
              <div className="flex items-center" style={{ marginBottom: "var(--spacing-2-5)", gap: "var(--spacing-1-5)" }}>
                <button
                  onClick={() => setShowCustom(false)}
                  className="flex items-center justify-center cursor-pointer hover:bg-[hsl(210,100%,96%)] transition-colors"
                  style={{ width: "24px", height: "24px", borderRadius: "var(--radius-sm)", background: "transparent", border: "none" }}
                >
                  <ChevronLeft size={14} style={{ color: "var(--text-secondary)" }} />
                </button>
                <span style={{ fontFamily: font, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "var(--text-label)", color: "var(--piw-foreground)" }}>
                  Custom Date Range
                </span>
              </div>
              <div className="flex flex-col" style={{ gap: "var(--spacing-3)" }}>
                <DateInputWithCalendar
                  label="From"
                  value={dateFrom}
                  onChange={(v) => { onDateFromChange(v); }}
                  maxDate={dateTo || undefined}
                />
                <DateInputWithCalendar
                  label="To"
                  value={dateTo}
                  onChange={(v) => { onDateToChange(v); }}
                  minDate={dateFrom || undefined}
                />
                <button
                  onClick={() => { setOpen(false); setShowCustom(false); }}
                  className="flex items-center justify-center cursor-pointer transition-colors"
                  style={{
                    height: "32px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--piw-primary)",
                    border: "none",
                    fontFamily: font,
                    fontWeight: "var(--font-weight-medium)" as any,
                    fontSize: "var(--text-caption)",
                    color: "var(--piw-primary-foreground)",
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export function AttachmentsTab({ controlType }: { controlType?: string }) {
  const [search, setSearch] = useState("");
  const [openTxAtt, setOpenTxAtt] = useState<Attachment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  /* Density / view-mode lifted from FolderTreeView so it can render next to the search input. */
  const [filePaneMode, setFilePaneMode] = useState<FilePaneMode>("card");
  const [cardSize, setCardSize] = useState<CardSize>("medium");

  /* State for user-uploaded files (appended to the mock list) */
  const [uploadedFiles, setUploadedFiles] = useState<Attachment[]>([]);
  /* Per-attachment upload progress (0..100). Presence in this map => still "uploading". */
  const [uploadingProgress, setUploadingProgress] = useState<Record<string, number>>({});

  /* Simulate initial file loading */
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  const handleSearchChange = useCallback((v: string) => { setSearch(v); }, []);

  const handleFilesSelected = useCallback((files: File[]) => {
    const now = new Date();
    const dateStr = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`;
    const h = now.getHours();
    const m = now.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const timeStr = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;

    const getExt = (name: string): FileType => {
      const ext = name.split(".").pop()?.toLowerCase() || "";
      if (["pdf"].includes(ext)) return "pdf";
      if (["xlsx", "xls"].includes(ext)) return "xlsx";
      if (["docx", "doc"].includes(ext)) return "docx";
      if (["png"].includes(ext)) return "png";
      if (["jpg", "jpeg"].includes(ext)) return "jpg";
      if (["zip"].includes(ext)) return "zip";
      if (["rar"].includes(ext)) return "rar";
      if (["txt"].includes(ext)) return "txt";
      if (["csv"].includes(ext)) return "csv";
      if (["exe", "msi"].includes(ext)) return "exe";
      if (["psd"].includes(ext)) return "psd";
      if (ext === "dxf") return "dxf";
      if (ext === "stl") return "stl";
      if (ext === "dwg") return "dwg";
      if (["cad", "step", "stp", "iges", "igs"].includes(ext)) return "cad";
      if (["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)) return "mp3";
      if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) return "mp4";
      return "pdf";
    };

    const formatSize = (bytes: number) => {
      if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
      return `${Math.round(bytes / 1024)} KB`;
    };

    const newAtts: Attachment[] = files.map((f, i) => ({
      id: `upload-${Date.now()}-${i}`,
      fileName: f.name,
      fileType: getExt(f.name),
      fileSize: formatSize(f.size),
      fileSizeBytes: f.size,
      uploadedDate: dateStr,
      uploadedTime: timeStr,
      uploadedBy: "You",
      source: "Item Library" as SourceType,
      linkedTransactionId: null,
      linkedTransactionLabel: null,
      description: "Uploaded file",
    }));

    setUploadedFiles((prev) => [...newAtts, ...prev]);

    /* Kick off fake progress rings for each new file so uploads feel like the
     * Create Item modal (0 -> 100 over 700-1100ms per file, then swap to
     * normal ThumbnailCard). */
    newAtts.forEach((att) => {
      setUploadingProgress((prev) => ({ ...prev, [att.id]: 0 }));
      const totalMs = 700 + Math.random() * 400;
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
        setUploadingProgress((prev) => (att.id in prev ? { ...prev, [att.id]: pct } : prev));
        if (pct < 100) {
          requestAnimationFrame(tick);
        } else {
          setUploadingProgress((prev) => {
            if (!(att.id in prev)) return prev;
            const { [att.id]: _drop, ...rest } = prev;
            return rest;
          });
        }
      };
      requestAnimationFrame(tick);
    });
  }, []);

  /* Derive transaction type from the attachment source for the modal */
  const txTypeFromSource = (source: SourceType): string => {
    switch (source) {
      case "Adjustment": return "Adjustment Increase";
      case "Cycle Count": return "Cycle Count";
      case "Receiving": return "Receiving";
      case "Movement": return "Movement";
      case "Consumption": return "Consumption";
      case "Manufactured": return "Manufactured";
      default: return "Receiving";
    }
  };

  /* Helper: parse attachment date (MM/DD/YYYY) to comparable value */
  const parseAttDate = useCallback((dateStr: string): number => {
    const [mm, dd, yyyy] = dateStr.split("/").map(Number);
    return new Date(yyyy, mm - 1, dd).getTime();
  }, []);

  /* Filter logic — search + date range */
  const allAttachments = useMemo(() => [...uploadedFiles, ...MOCK_ATTACHMENTS], [uploadedFiles]);

  const filteredItems = useMemo(() => {
    let items = allAttachments;

    /* Date range filter */
    if (dateFrom || dateTo) {
      const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
      const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : Infinity;
      items = items.filter((a) => {
        const ts = parseAttDate(a.uploadedDate);
        return ts >= fromTs && ts <= toTs;
      });
    }

    /* Text search filter */
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((a) =>
        a.fileName.toLowerCase().includes(q) ||
        a.uploadedBy.toLowerCase().includes(q) ||
        (a.linkedTransactionId?.toLowerCase().includes(q) ?? false) ||
        (a.description?.toLowerCase().includes(q) ?? false) ||
        a.source.toLowerCase().includes(q)
      );
    }

    return items;
  }, [search, allAttachments, dateFrom, dateTo, parseAttDate]);

  return (
    <div
      data-section="attachments-tab"
      className="flex flex-col"
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--piw-border)",
        background: "var(--piw-card)",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <div className="flex flex-col" style={{ padding: "var(--spacing-4) var(--spacing-4) var(--spacing-3)", gap: "var(--spacing-2-5)" }}>
        {/* Row 1: Search + Date filter + Upload button (far right) */}
        <div className="flex items-center" style={{ gap: "var(--spacing-2-5)" }}>
          {/* Search */}
          <div className="relative" style={{ maxWidth: "320px", flex: 1 }}>
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-secondary)" }}
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search files, transactions..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              style={{
                height: "34px",
                paddingLeft: "34px",
                paddingRight: "12px",
                fontFamily: font,
                fontWeight: "var(--font-weight-normal)" as any,
                fontSize: "var(--text-body-sm)",
                color: "var(--piw-foreground)",
                background: "var(--piw-card)",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--piw-border)",
                borderRadius: "var(--radius-sm)",
                boxShadow: "var(--elevation-xs)",
              }}
            />
          </div>

          {/* Density / view-mode — moved out of the Item Library header into the search row. */}
          <div className="ml-auto">
            <FilePaneModeDropdown
              value={filePaneMode}
              onChange={setFilePaneMode}
              cardSize={cardSize}
              onCardSizeChange={setCardSize}
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid var(--piw-border)" }} />

      {/* Content — Loading skeleton or Folder view */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }} className="scroll-auto-hide">
        {isLoading ? (
          <AttachmentsLoadingSkeleton />
        ) : (
          <FolderTreeView
            items={filteredItems}
            onTransactionClick={(att) => setOpenTxAtt(att)}
            searchQuery={search}
            filePaneMode={filePaneMode}
            cardSize={cardSize}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onFilesSelected={handleFilesSelected}
            uploadingProgress={uploadingProgress}
          />
        )}
      </div>

      {/* TransactionDetailModal — opened by clicking a transaction pill */}
      {openTxAtt && openTxAtt.linkedTransactionId && (
        <TransactionDetailModal
          tx={{
            txId: openTxAtt.linkedTransactionId,
            type: txTypeFromSource(openTxAtt.source),
            subType: openTxAtt.source === "Movement" ? "Pick" : undefined,
          }}
          detail={enrichTransactionDetail(
            {
              createdBy: openTxAtt.uploadedBy || "Maya Thompson",
              dateTime: `${openTxAtt.uploadedDate} ${openTxAtt.uploadedTime}`,
              transactionType: txTypeFromSource(openTxAtt.source),
              locationDetails: "Zone A-01",
              sourceLink: "",
              sourceLinkLabel: "",
              totalAvailable: "450 EA",
              onHandBefore: "480 EA",
              onHandAfter: "450 EA",
              onHandAfterColor: "red",
              changeInQty: "-30",
              changeInQtyColor: "red",
              costingMethodology: "Real Cost",
              pricePerUnit: "$ 22.50",
              valuationBefore: "$ 10,800.00",
              valuationAfter: "$ 10,125.00",
              valuationAfterColor: "red",
              changeInValuation: "-$ 675.00",
              changeInValuationColor: "red",
              serialUnits: [],
            },
            { txId: openTxAtt.linkedTransactionId, date: openTxAtt.uploadedDate, time: openTxAtt.uploadedTime },
          )}
          onClose={() => setOpenTxAtt(null)}
          controlType={controlType}
          initialTab="overview"
        />
      )}
    </div>
  );
}