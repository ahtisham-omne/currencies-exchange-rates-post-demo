/**
 * AttachmentsTab — Quote Detail
 * ────────────────────────────────────────────────────────────────────────────
 * Replaces the previous flat-list LinkedTransactionsTab with the 3-column
 * Layers/folder-tree structure ported from Physical Inventory (the approved
 * "design source of truth" component outside Partners).
 *
 * Identical structure is mirrored in the Sales Order module — only the
 * category set ("sources") differs between modules.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Upload,
  Link2,
  Layers,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  FileText,
  FileImage,
  File as FileIco,
  Package,
  Paperclip,
  ArrowRightLeft,
  Calendar,
  ListFilter,
  X,
  Check,
  ExternalLink,
  Eye,
  MoreVertical,
  Trash2,
  FileSpreadsheet,
  FileArchive,
  ArrowDownUp,
  ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPreQuoteDocs,
  subscribePreQuoteDocs,
  type PreQuoteDocument,
  getRejectionDocs,
  subscribeRejectionDocs,
  type RejectionDocument,
  getAllLineItemAttachments,
  subscribeLineItemAttachments,
  addLineItemAttachment,
  removeLineItemAttachment,
  renameLineItemAttachment,
  initEmptyLineItemAttachments,
} from "../../data/quoteStore";
import { AttachmentCard, RenameAttachmentDialog, type AttachmentCardData } from "../shared/attachments/attachment-card";
import { InactiveItemPill } from "../shared/InactiveItemPill";
import { ATTACHMENT_CARD_THUMB, AttachmentRowMenu } from "../shared/attachments/attachment-view-mode";
import { ItemTypeBadge } from "../shared/ItemTypeBadge";
import { ConfirmationModal } from "@/app/components/ConfirmationModal";
import { AttachmentPreviewModal } from "../shared/attachments/attachment-preview-modal";
import { EmptyPlaceholder } from "../shared/EmptyPlaceholder";
import { Pencil } from "lucide-react";
import { DatePicker } from "../ui/date-picker";
import { publishPrintAttachments, getPublishedPrintAttachments, type PrintableAttachment } from "../shared/printPages";

const font = "var(--font-inter)";

/* ═══════════════════════════════════════════════════════════════════════════
 * § 0  TYPES & MODULE CATEGORY DEFINITIONS
 * ═══════════════════════════════════════════════════════════════════════════ */

type DocCategory =
  | "pre-quote"
  | "quote-attachment"
  | "item-attachment"
  | "sales-order"
  | "rejection";

interface ItemRef { id: string; label: string; }

export interface LinkedDocument {
  id: string;
  name: string;
  category: DocCategory;
  type: "pdf" | "xlsx" | "docx" | "png" | "jpg" | "url" | "csv" | "mp3" | "mp4" | "dxf" | "stl" | "dwg";
  size?: string;
  url?: string;
  uploadedBy: string;
  uploadedAt: string; // ISO
  itemRefs?: ItemRef[];
  tags?: string[];
  includedInPdf: boolean;
  previewUrl?: string | null;
  /** Item attachments only: set when the file was copied from the item
   *  master gallery (not uploaded). Its menu is Preview, Download and
   *  Remove from Quote, the same as in the line item configurator. */
  galleryId?: string;
}

/* Item-type union mirrors the line-items grid — drives the coloured
   inventory pill next to each item code in the picker. */
type QuoteLineItemType = "Serialized" | "Lot Serialized" | "Lot Non-Serialized" | "Non-Serialized";

interface QuoteLineItem { id: string; itemNumber: string; productName: string; description?: string; quantity: number; uom: string; itemType: QuoteLineItemType; }

/* Deep item catalogue for the picker — matches the same items the
   quote line-items grid renders (SKU + productName + description +
   inventory type pill). Copies mirror `ItemsTabTableClean.tsx` so
   the picker row reads as the same line-item surface the user sees
   on the Line Items tab. Kept as a module-level mock here because
   the AttachmentsTab isn't currently threaded to the parent quote's
   `items` array; can be swapped to real quote line items by passing
   them in as a prop once the plumbing lands. */
const QUOTE_LINE_ITEMS: QuoteLineItem[] = [
  { id: "1",  itemNumber: "000-100-002", productName: "Ford E-450 Super Duty Stripped Chassis — Ambulance Prep Package", description: 'E-450 stripped chassis, 176" WB, 7.3L V8, DRW, 16,000 GVWR, ambulance prep with reinforced frame, heavy-duty alternator, and dual batteries. Includes extended-idle package and PTO-ready wiring.', quantity: 2, uom: "EA", itemType: "Serialized" },
  { id: "1b", itemNumber: "000-100-019", productName: 'Type III Ambulance Module — Standard 152" Patient Compartment', description: 'Cutaway-mount modular body, 152" compartment, 72" headroom, full walk-through cab access, aluminum/composite construction, KKK-A-1822F compliant.', quantity: 3, uom: "EA", itemType: "Serialized" },
  { id: "2",  itemNumber: "000-100-049", productName: "Motorola APX 8500 P25 Phase II Multi-Band Mobile Radio", description: "Multi-band P25 Phase II digital mobile radio, VHF/UHF/700/800 MHz, AES-256 encryption, GPS + Bluetooth, Over-The-Air Programming ready.", quantity: 3, uom: "EA", itemType: "Serialized" },
  { id: "3",  itemNumber: "000-100-059", productName: "Stryker Power-PRO XT Powered Stretcher — 700 lb Capacity", description: "Battery-operated lift mechanism, auto-loading base with isokinetic lowering, Power-LOAD compatible, Fowler/Trendelenburg positioning.", quantity: 3, uom: "EA", itemType: "Lot Serialized" },
  { id: "3b", itemNumber: "000-100-081", productName: "AIMS 3000W Pure Sine Wave Inverter/Charger", description: "3000W continuous / 9000W surge pure sine wave inverter with integrated 100A shore-power charger and auto-transfer relay.", quantity: 3, uom: "EA", itemType: "Non-Serialized" },
];

const CURRENT_USER = "Sarah Chen";

/* ── Unsplash preview thumbnails for jpg/png attachments ── */
const PREVIEW_POOL = [
  "https://images.unsplash.com/photo-1581094794329-c8112a89af12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400", // ambulance
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",   // fire truck
  "https://images.unsplash.com/photo-1597692493715-cdec61b7dcb4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400", // chassis
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",   // dashboard
  "https://images.unsplash.com/photo-1581093588401-fbb62a02f120?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400", // medical equipment
  "https://images.unsplash.com/photo-1576091160550-2173dba999ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400", // medical
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400", // electronics
  "https://images.unsplash.com/photo-1580130732478-4e339fb33746?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400", // radio gear
  "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400", // engineer signing
  "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400", // documents
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",   // spreadsheet
  "https://images.unsplash.com/photo-1518770660439-4636190af475?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400", // circuit board
];

/* Count of seeded mock documents. Exported so the QuoteDetails tab
   header can show a real number on the Attachments badge instead of a
   hard-coded value that drifts from what the tab actually renders.
   Newly-created quotes start empty, so the parent should pass 0
   rather than this constant in that case. */
const MOCK_DOCUMENTS: LinkedDocument[] = [
  /* ── Pre-Quote (RFQ/RFP) ── */
  { id: "D000a", name: "RFQ-2026-TC-0042_Original_Request.pdf",   category: "pre-quote",        type: "pdf",  size: "1.8 MB",  uploadedBy: "Sarah Chen",        uploadedAt: "2026-01-15", includedInPdf: false, tags: ["rfq/rfp"] },
  { id: "D000b", name: "Tri-County_Fleet_Requirements_Spec.xlsx", category: "pre-quote",        type: "xlsx", size: "340 KB",  uploadedBy: "Sarah Chen",        uploadedAt: "2026-01-15", includedInPdf: false, tags: ["rfq/rfp"] },
  { id: "D000c", name: "Site_Walkthrough_Photo_01.jpg",           category: "pre-quote",        type: "jpg",  size: "2.1 MB",  uploadedBy: "James Wilson",      uploadedAt: "2026-01-17", includedInPdf: false, previewUrl: PREVIEW_POOL[0] },
  { id: "D000d", name: "Vehicle_Bay_Measurements.png",            category: "pre-quote",        type: "png",  size: "1.4 MB",  uploadedBy: "James Wilson",      uploadedAt: "2026-01-17", includedInPdf: false, previewUrl: PREVIEW_POOL[2] },
  { id: "D000e", name: "Bidder_Q&A_Summary.docx",                 category: "pre-quote",        type: "docx", size: "180 KB",  uploadedBy: "Sarah Chen",        uploadedAt: "2026-02-02", includedInPdf: false },
  { id: "D000f", name: "Equipment_Schedule_Detail.csv",           category: "pre-quote",        type: "csv",  size: "62 KB",   uploadedBy: "Maria Garcia",      uploadedAt: "2026-02-04", includedInPdf: false },

  /* ── Quote Attachments ── */
  { id: "D001",  name: "Quote_Q-2026-0142_v3.pdf",                category: "quote-attachment", type: "pdf",  size: "2.4 MB",  uploadedBy: "Sarah Chen",        uploadedAt: "2026-02-05", includedInPdf: true },
  { id: "D002",  name: "Pricing_Approval_Internal.xlsx",          category: "quote-attachment", type: "xlsx", size: "890 KB",  uploadedBy: "Michael Rodriguez", uploadedAt: "2026-02-04", includedInPdf: false },
  { id: "D003",  name: "Terms_and_Conditions_2026.pdf",           category: "quote-attachment", type: "pdf",  size: "1.1 MB",  uploadedBy: "Sarah Chen",        uploadedAt: "2026-01-28", includedInPdf: true },
  { id: "D003b", name: "Cover_Letter_Tri-County_Final.docx",      category: "quote-attachment", type: "docx", size: "240 KB",  uploadedBy: "Sarah Chen",        uploadedAt: "2026-04-12", includedInPdf: true },
  { id: "D003c", name: "Discount_Schedule.csv",                   category: "quote-attachment", type: "csv",  size: "18 KB",   uploadedBy: "Michael Rodriguez", uploadedAt: "2026-04-15", includedInPdf: false },
  { id: "D003d", name: "Reference_Customer_Photo.jpg",            category: "quote-attachment", type: "jpg",  size: "3.6 MB",  uploadedBy: "Sarah Chen",        uploadedAt: "2026-04-22", includedInPdf: true,  previewUrl: PREVIEW_POOL[1] },
  { id: "D003e", name: "Executive_Summary_v2.pdf",                category: "quote-attachment", type: "pdf",  size: "780 KB",  uploadedBy: "Sarah Chen",        uploadedAt: "2026-05-04", includedInPdf: true },

  /* Item Attachments are NOT seeded here. They live in quoteStore's
     line-item attachment registry, which the line-item configurator and
     this tab's Item Attachments folder both read. That shared store is
     what makes a delete on either surface show up on the other. */

  /* ── Media (audio + video samples) — exercise inline preview in
     the new card + modal. Short publicly hosted samples so users
     can hear/see playback without external dependencies. ── */
  { id: "D007e", name: "Customer_Voicemail_Quote_Followup.mp3",   category: "quote-attachment", type: "mp3",  size: "412 KB",  uploadedBy: "Sarah Chen",        uploadedAt: "2026-04-18", includedInPdf: false, previewUrl: "https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3" },

  /* ── CAD / 3D samples (exercises inline DXF / STL viewers in the
     preview modal). DWG keeps the placeholder fallback per design. ── */

  /* External Links were removed from Attachments — external URLs now
     live in the Deal Information tab's Links repository and are
     attached as chip references from External Notes / adjustment
     internal notes. */
];

const CATEGORY_META: Record<DocCategory, { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  "pre-quote":         { label: "Pre-Quote (RFQ/RFP)", color: "var(--reason-tag-text)",        bg: "var(--reason-tag-bg)",        border: "var(--reason-tag-border)",        icon: FileText },
  "quote-attachment":  { label: "Quote Attachments",   color: "var(--primary)",                 bg: "var(--primary-50)",            border: "var(--primary-200)",              icon: FileText },
  "item-attachment":   { label: "Item Attachments",    color: "var(--checked-out-tag-text)",    bg: "var(--checked-out-tag-bg)",    border: "var(--checked-out-tag-border)",   icon: Package },
  "sales-order":       { label: "Sales Order Documents", color: "var(--status-active-text)",    bg: "var(--status-active-bg)",      border: "var(--status-active-border)",     icon: FolderOpen },
  "rejection":         { label: "Rejection Attachments", color: "#991B1B",                       bg: "rgba(220, 38, 38, 0.10)",     border: "rgba(220, 38, 38, 0.22)",         icon: ThumbsDown },
};

const CATEGORY_ORDER: DocCategory[] = ["pre-quote", "quote-attachment", "item-attachment", "sales-order", "rejection"];

/* ═══════════════════════════════════════════════════════════════════════════
 * § 1  HELPERS
 * ═══════════════════════════════════════════════════════════════════════════ */

function HighlightText({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <mark key={i} style={{ background: "var(--primary-100)", color: "var(--primary-700)", padding: "0 1px", borderRadius: 2 }}>{p}</mark>
          : <React.Fragment key={i}>{p}</React.Fragment>,
      )}
    </>
  );
}

function toCardData(d: LinkedDocument): AttachmentCardData {
  return {
    fileName: d.name,
    fileType: d.type,
    fileSize: d.size ?? "",
    uploadedDate: d.uploadedAt,
    uploadedTime: "",
    uploadedBy: d.uploadedBy,
    previewUrl: d.previewUrl ?? null,
    externalUrl: d.url,
  };
}

function formatTotalSize(items: LinkedDocument[]): string {
  const totalKb = items.reduce((sum, a) => {
    const s = (a.size || "").trim();
    if (!s) return sum;
    const m = s.match(/([\d.]+)\s*(KB|MB|GB)/i);
    if (!m) return sum;
    const n = parseFloat(m[1]);
    if (m[2].toUpperCase() === "GB") return sum + n * 1024 * 1024;
    if (m[2].toUpperCase() === "MB") return sum + n * 1024;
    return sum + n;
  }, 0);
  if (totalKb >= 1024 * 1024) return `${(totalKb / (1024 * 1024)).toFixed(1)} GB`;
  if (totalKb >= 1024) return `${(totalKb / 1024).toFixed(1)} MB`;
  return `${Math.round(totalKb)} KB`;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 2  TOP-RIGHT CTA BUTTONS — Partner detail-page style
 * ═══════════════════════════════════════════════════════════════════════════ */

function PartnerStyleSecondaryCta({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border bg-white inline-flex items-center transition-all duration-200 cursor-pointer shadow-sm hover:bg-slate-50"
      style={{
        height: "36px",
        padding: "0 14px",
        gap: "6px",
        fontSize: "13px",
        fontWeight: 500,
        color: "var(--foreground)",
        borderColor: "var(--border)",
        fontFamily: font,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function PartnerStylePrimaryCta({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg bg-primary hover:bg-[#0862D0] text-white inline-flex items-center transition-all duration-200 cursor-pointer shadow-sm"
      style={{
        height: "36px",
        padding: "0 16px",
        gap: "6px",
        fontSize: "13px",
        fontWeight: 600,
        fontFamily: font,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 3  IN-CARD PILLS (line-item ref, source, included-in-quote)
 * ═══════════════════════════════════════════════════════════════════════════ */

function CardSourcePill({ doc }: { doc: LinkedDocument }) {
  const meta = CATEGORY_META[doc.category];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center"
      style={{
        padding: "1px 6px",
        borderRadius: "9999px",
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.color,
        fontFamily: font,
        fontWeight: 500,
        fontSize: "9px",
        gap: "3px",
        whiteSpace: "nowrap",
        backdropFilter: "blur(4px)",
      }}
    >
      <Icon size={9} />
      {meta.label.replace(" Attachments", "").replace(" Documents", "").replace(" (RFQ/RFP)", "")}
    </span>
  );
}

function CardItemRefPill({ itemRef }: { itemRef: ItemRef }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        padding: "1px 6px",
        borderRadius: "9999px",
        background: "rgba(255,255,255,0.92)",
        border: "1px solid var(--border)",
        color: "var(--foreground)",
        fontFamily: font,
        fontWeight: 500,
        fontSize: "9px",
        gap: "3px",
        maxWidth: "120px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        backdropFilter: "blur(4px)",
      }}
      title={itemRef.label}
    >
      <Package size={9} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{itemRef.id}</span>
    </span>
  );
}

/* CardIncludedPill removed. Attachments are no longer flagged for
   reference in the Quote PDF: every attachment travels with the PDF, and
   if the document needs to call one out by name the user types that into
   the instructions. Nothing in the UI toggles it, so nothing displays
   it. Partners' attachments surface carries no such control either. */

/* ═══════════════════════════════════════════════════════════════════════════
 * § 3.5  DATE FILTER DROPDOWN — pill in toolbar, matches PI styling
 * ═══════════════════════════════════════════════════════════════════════════ */

export type DateRangeKey = "today" | "7d" | "30d" | "3m" | "6m" | "yearly" | "all" | "custom";

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "today",  label: "Today" },
  { key: "7d",     label: "Last 7 Days" },
  { key: "30d",    label: "Last 30 Days" },
  { key: "3m",     label: "Last 3 Months" },
  { key: "6m",     label: "Last 6 Months" },
  { key: "yearly", label: "Yearly" },
  { key: "all",    label: "All Time" },
  { key: "custom", label: "Custom Date" },
];

/* Compact date-range dropdown — verbatim port of PI-9's
 * `DateRangePresetDropdown` chrome (attachments-tab.tsx:2388) in its
 * `compact` mode. 28px height, 140px width, primary-50 hover /
 * active row bg, text-body-sm menu font. Sits next to the file pane
 * header alongside FileTypeDropdown and SortDropdown so all three
 * pane-header controls read as one row. */
function DateFilterDropdown({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomChange,
}: {
  value: DateRangeKey;
  onChange: (v: DateRangeKey) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(value === "custom");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustom(value === "custom");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, value]);

  const current = DATE_RANGE_OPTIONS.find((o) => o.key === value)!;
  const triggerLabel = (() => {
    if (value === "custom" && customFrom && customTo) {
      const fmt = (iso: string) => {
        const [y, m, d] = iso.split("-");
        return `${m}/${d}/${y.slice(2)}`;
      };
      return `${fmt(customFrom)} to ${fmt(customTo)}`;
    }
    return current.label;
  })();

  return (
    <div ref={ref} className="relative shrink-0" style={{ width: "140px" }}>
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) setShowCustom(value === "custom");
        }}
        className="flex items-center border border-border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none w-full"
        style={{
          height: "28px",
          padding: "0 var(--spacing-1-5)",
          borderRadius: "var(--radius-sm)",
          backgroundColor: open ? "hsl(210,100%,96%)" : "#FFFFFF",
          cursor: "pointer",
          gap: "var(--spacing-1)",
          fontFamily: font,
          fontWeight: "var(--font-weight-medium)" as any,
          fontSize: "var(--text-caption)",
          color: "var(--text-secondary)",
          boxShadow: "var(--elevation-xs)",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(210,100%,96%)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = open ? "hsl(210,100%,96%)" : "#FFFFFF"; }}
      >
        <Calendar size={11} style={{ flexShrink: 0, color: "var(--text-tertiary)" }} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{triggerLabel}</span>
        <ChevronDown size={11} style={{ flexShrink: 0, color: "var(--text-tertiary)", transition: "transform 0.15s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {open && (
        <div
          className="absolute z-50 border border-border"
          style={{
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: showCustom ? "280px" : "180px",
            borderRadius: "var(--radius-md)",
            background: "var(--card)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
            padding: "var(--spacing-1)",
          }}
        >
          {!showCustom ? (
            DATE_RANGE_OPTIONS.map((opt) => {
              const isActive = opt.key === value;
              return (
                <button
                  key={opt.key}
                  onClick={() => {
                    if (opt.key === "custom") {
                      setShowCustom(true);
                      return;
                    }
                    onChange(opt.key);
                    setOpen(false);
                  }}
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
                    fontWeight: isActive ? 600 : 500,
                    fontSize: "var(--text-body-sm)",
                    color: isActive ? "var(--primary)" : "var(--foreground)",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(210,100%,96%)"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  {opt.key === "custom" && <Calendar size={13} style={{ color: isActive ? "var(--primary)" : "var(--text-tertiary)", flexShrink: 0 }} />}
                  {opt.label}
                </button>
              );
            })
          ) : (
            <div style={{ padding: "var(--spacing-2)" }}>
              <div className="flex items-center" style={{ marginBottom: "var(--spacing-2-5)", gap: "var(--spacing-1-5)" }}>
                <button
                  onClick={() => setShowCustom(false)}
                  className="flex items-center justify-center cursor-pointer transition-colors"
                  style={{ width: 24, height: 24, borderRadius: "var(--radius-sm)", background: "transparent", border: "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(210,100%,96%)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  <ChevronLeft size={14} style={{ color: "var(--text-secondary)" }} />
                </button>
                <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-label)", color: "var(--foreground)" }}>
                  Custom Date Range
                </span>
              </div>
              <div className="flex flex-col" style={{ gap: "var(--spacing-2-5)" }}>
                <div className="flex flex-col" style={{ gap: 4 }}>
                  <label style={{ fontFamily: font, fontWeight: 500, fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>From</label>
                  <DatePicker
                    value={customFrom}
                    onChange={(v) => onCustomChange(v, customTo)}
                    placeholder="Select date"
                    className="h-9 text-[13px] w-full"
                    align="start"
                    toYear={customTo ? Number(customTo.slice(0, 4)) : undefined}
                  />
                </div>
                <div className="flex flex-col" style={{ gap: 4 }}>
                  <label style={{ fontFamily: font, fontWeight: 500, fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>To</label>
                  <DatePicker
                    value={customTo}
                    onChange={(v) => onCustomChange(customFrom, v)}
                    placeholder="Select date"
                    className="h-9 text-[13px] w-full"
                    align="start"
                    fromYear={customFrom ? Number(customFrom.slice(0, 4)) : undefined}
                  />
                </div>
                <button
                  onClick={() => {
                    onChange("custom");
                    setOpen(false);
                  }}
                  disabled={!customFrom && !customTo}
                  className="flex items-center justify-center transition-colors"
                  style={{
                    height: 32,
                    borderRadius: "var(--radius-sm)",
                    background: customFrom || customTo ? "var(--primary)" : "var(--muted)",
                    color: customFrom || customTo ? "#FFFFFF" : "var(--muted-foreground)",
                    border: "none",
                    cursor: customFrom || customTo ? "pointer" : "not-allowed",
                    fontFamily: font,
                    fontWeight: 600,
                    fontSize: "var(--text-body-sm)",
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

function filterByDateRange<T extends { uploadedAt: string }>(
  items: T[],
  range: DateRangeKey,
  customFrom?: string,
  customTo?: string,
): T[] {
  if (range === "all") return items;
  if (range === "custom") {
    /* Both ends optional so a half-populated range still filters
       sensibly. An empty custom range falls through as "no filter". */
    if (!customFrom && !customTo) return items;
    const fromDate = customFrom ? new Date(customFrom + "T00:00:00") : null;
    const toDate = customTo ? new Date(customTo + "T23:59:59") : null;
    return items.filter((it) => {
      const d = new Date(it.uploadedAt + (it.uploadedAt.includes("T") ? "" : "T00:00:00"));
      if (Number.isNaN(d.getTime())) return true;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let cutoff: Date;
  switch (range) {
    case "today":  cutoff = today; break;
    case "7d":     cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 7); break;
    case "30d":    cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 30); break;
    case "3m":     cutoff = new Date(today); cutoff.setMonth(cutoff.getMonth() - 3); break;
    case "6m":     cutoff = new Date(today); cutoff.setMonth(cutoff.getMonth() - 6); break;
    case "yearly": cutoff = new Date(today); cutoff.setFullYear(cutoff.getFullYear() - 1); break;
    default: return items;
  }
  return items.filter((it) => {
    const d = new Date(it.uploadedAt + (it.uploadedAt.includes("T") ? "" : "T00:00:00"));
    if (Number.isNaN(d.getTime())) return true;
    return d >= cutoff;
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 3.6  SORT + FILE-TYPE DROPDOWNS — verbatim ports of PI-9's
 *        `TxSortDropdown` (attachments-tab.tsx:1002) and
 *        `FileTypeDropdown` (line 1100). Both render in the file pane
 *        header alongside DateFilterDropdown. Colors, sizes (28px
 *        height, 96/140px widths), and behaviors match PI-9 exactly.
 * ═══════════════════════════════════════════════════════════════════════════ */

type SortMode = "latest" | "oldest";

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "latest", label: "Latest" },
  { key: "oldest", label: "Oldest" },
];

function SortDropdown({ value, onChange }: { value: SortMode; onChange: (v: SortMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const current = SORT_OPTIONS.find((o) => o.key === value)!;
  return (
    <div ref={ref} className="relative shrink-0" style={{ width: "96px" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center border border-border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none w-full"
        style={{
          height: "28px",
          padding: "0 var(--spacing-1-5)",
          borderRadius: "var(--radius-sm)",
          backgroundColor: open ? "hsl(210,100%,96%)" : "#FFFFFF",
          cursor: "pointer",
          gap: "var(--spacing-1)",
          fontFamily: font,
          fontWeight: "var(--font-weight-medium)" as any,
          fontSize: "var(--text-caption)",
          color: "var(--text-secondary)",
          boxShadow: "var(--elevation-xs)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(210,100%,96%)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = open ? "hsl(210,100%,96%)" : "#FFFFFF"; }}
      >
        <ArrowDownUp size={11} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
        {current.label}
        <ChevronDown size={10} style={{ marginLeft: "auto", color: "var(--text-tertiary)", transition: "transform 0.15s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && (
        <div className="absolute z-50 border border-border" style={{ top: "calc(100% + 3px)", left: 0, minWidth: "110px", borderRadius: "var(--radius-md)", background: "var(--card)", boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)", padding: "var(--spacing-0-5)" }}>
          {SORT_OPTIONS.map((opt) => {
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
                  fontWeight: isActive ? 600 : 500,
                  fontSize: "var(--text-caption)",
                  color: isActive ? "var(--primary)" : "var(--foreground)",
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

function FileTypeDropdown({ value, onChange, available }: { value: string; onChange: (v: string) => void; available: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
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
          backgroundColor: open ? "hsl(210,100%,96%)" : "#FFFFFF",
          cursor: "pointer",
          gap: "var(--spacing-1)",
          fontFamily: font,
          fontWeight: "var(--font-weight-medium)" as any,
          fontSize: "var(--text-caption)",
          color: "var(--text-secondary)",
          boxShadow: "var(--elevation-xs)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(210,100%,96%)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = open ? "hsl(210,100%,96%)" : "#FFFFFF"; }}
      >
        <ListFilter size={11} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
        {current.label}
        <ChevronDown size={10} style={{ marginLeft: "auto", color: "var(--text-tertiary)", transition: "transform 0.15s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && (
        <div className="absolute z-50 border border-border" style={{ top: "calc(100% + 3px)", left: 0, minWidth: "130px", maxHeight: "260px", overflowY: "auto", borderRadius: "var(--radius-md)", background: "var(--card)", boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)", padding: "var(--spacing-0-5)" }}>
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
                  fontWeight: isActive ? 600 : 500,
                  fontSize: "var(--text-caption)",
                  color: isActive ? "var(--primary)" : "var(--foreground)",
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

/* ═══════════════════════════════════════════════════════════════════════════
 * § 3.7  LOADING SKELETON — verbatim port of PI-9's
 *        `AttachmentsLoadingSkeleton` (attachments-tab.tsx:1986). Shows
 *        for ~1.8s on mount while the layers tree hydrates so the shell
 *        never jumps between empty and populated states.
 * ═══════════════════════════════════════════════════════════════════════════ */

const skeletonPulse: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--surface-secondary) 25%, color-mix(in srgb, var(--surface-secondary) 60%, var(--background)) 50%, var(--surface-secondary) 75%)",
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
      <div className="flex flex-1 min-h-0">
        {/* Col 1 skeleton */}
        <div className="shrink-0 flex flex-col" style={{ width: "210px", borderRight: "1px solid var(--border)", background: "var(--background)" }}>
          <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2)", borderBottom: "1px solid var(--border)", height: "42px", boxSizing: "border-box", gap: "var(--spacing-1-5)" }}>
            <SkeletonBlock width={13} height={13} style={{ borderRadius: "3px" }} />
            <SkeletonBlock width={52} height={11} />
          </div>
          <div className="flex flex-col" style={{ padding: "var(--spacing-2) var(--spacing-1-5)", gap: "var(--spacing-1)" }}>
            <SkeletonBlock width="100%" height={32} style={{ borderRadius: "var(--radius-sm)" }} />
            <div style={{ height: "1px", background: "var(--border)", margin: "var(--spacing-0-5) var(--spacing-0-5)" }} />
            {[0.85, 0.72, 0.68, 0.78, 0.6, 0.55].map((w, i) => (
              <SkeletonBlock key={i} width={`${w * 100}%`} height={32} style={{ borderRadius: "var(--radius-sm)" }} />
            ))}
          </div>
        </div>
        {/* Col 2 skeleton */}
        <div className="shrink-0 flex flex-col" style={{ width: "210px", borderRight: "1px solid var(--border)", background: "var(--surface-secondary)" }}>
          <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2)", borderBottom: "1px solid var(--border)", height: "42px", boxSizing: "border-box", gap: "var(--spacing-1-5)" }}>
            <SkeletonBlock width={72} height={11} />
            <SkeletonBlock width={16} height={16} style={{ borderRadius: "9999px" }} />
          </div>
          <div style={{ padding: "var(--spacing-1-5) var(--spacing-2)", borderBottom: "1px solid var(--border)" }}>
            <SkeletonBlock width="100%" height={28} style={{ borderRadius: "var(--radius-sm)" }} />
          </div>
          <div style={{ padding: "var(--spacing-1) var(--spacing-1-5)", borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)" }}>
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
          <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2) var(--spacing-3)", borderBottom: "1px solid var(--border)", height: "42px", boxSizing: "border-box", gap: "var(--spacing-1-5)" }}>
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
                  borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
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

/* ═══════════════════════════════════════════════════════════════════════════
 * § 4  LAYERS TREE — Col 1 (sources) + Col 2 (context, conditional) + Col 3 (file pane)
 * ═══════════════════════════════════════════════════════════════════════════ */

type SourceScope = "all" | DocCategory;
/* File-type categories shown in the middle column for non-item scopes.
   Mirrors the Physical Inventory Item Library treatment so a user
   scanning Pre-Quote or Quote Attachments can drill into Documents /
   Photos / Videos / Audio without a separate filter widget. */
type FileCategory = "all" | "documents" | "photos" | "videos" | "audio";
const FILE_CAT_DOCS: LinkedDocument["type"][] = ["pdf", "xlsx", "csv", "docx", "dxf", "stl", "dwg"];
const FILE_CAT_PHOTOS: LinkedDocument["type"][] = ["png", "jpg"];
const FILE_CAT_VIDEOS: LinkedDocument["type"][] = ["mp4"];
const FILE_CAT_AUDIO: LinkedDocument["type"][] = ["mp3"];
function matchesFileCategory(type: LinkedDocument["type"], cat: FileCategory): boolean {
  if (cat === "all") return true;
  if (cat === "documents") return FILE_CAT_DOCS.includes(type);
  if (cat === "photos") return FILE_CAT_PHOTOS.includes(type);
  if (cat === "videos") return FILE_CAT_VIDEOS.includes(type);
  if (cat === "audio") return FILE_CAT_AUDIO.includes(type);
  return true;
}

// Three-mode view selector ported from Physical Inventory `attachments-tab`.
// "Card" mode opens a sub-toggle for card size, mapped onto the existing
// thumbnail grid columns.
type ViewMode = "condensed" | "comfort" | "card";
type CardSize = "small" | "medium" | "large";

const VIEW_MODE_OPTIONS: { key: ViewMode; label: string; description: string; icon: React.ReactNode }[] = [
  { key: "condensed", label: "Condensed", description: "Compact list view", icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="3" width="14" height="1.5" rx="0.5" />
      <rect x="1" y="7.25" width="14" height="1.5" rx="0.5" />
      <rect x="1" y="11.5" width="14" height="1.5" rx="0.5" />
    </svg>
  ) },
  { key: "comfort", label: "Comfort", description: "Spacious list view", icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="14" height="2.5" rx="0.5" />
      <rect x="1" y="6.75" width="14" height="2.5" rx="0.5" />
      <rect x="1" y="11.5" width="14" height="2.5" rx="0.5" />
    </svg>
  ) },
  { key: "card", label: "Card", description: "Sized card grid", icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  ) },
];

/* Purchase Order's values, verbatim — the same three the configurator's
   `ATTACHMENT_CARD_COLUMNS` uses, so Large is one size across every
   attachments surface rather than three near-misses. */
const CARD_SIZE_COLUMNS: Record<CardSize, string> = {
  large:  "repeat(auto-fill, minmax(360px, 1fr))",
  medium: "repeat(auto-fill, minmax(240px, 1fr))",
  small:  "repeat(auto-fill, minmax(170px, 1fr))",
};

/* Format raw date strings into the "25 Feb 2026, 9:42 am" form used in the
 * Physical Inventory listing. Accepts MM/DD, MM/DD/YYYY, YYYY-MM-DD, or any
 * Date-parseable string. Falls back to the original input on any parse failure. */
const MONTH_ABBR_LIST = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function formatDateShort(raw: string): string {
  if (!raw) return "";
  const s = raw.trim();
  // MM/DD or MM/DD/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:[, ]+(.+))?$/);
  if (slash) {
    const mm = parseInt(slash[1], 10);
    const dd = parseInt(slash[2], 10);
    const yyyy = slash[3] ? (slash[3].length === 2 ? 2000 + parseInt(slash[3], 10) : parseInt(slash[3], 10)) : new Date().getFullYear();
    const time = slash[4] ? `, ${slash[4].toLowerCase()}` : "";
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${String(dd).padStart(2,"0")} ${MONTH_ABBR_LIST[mm-1]} ${yyyy}${time}`;
    }
  }
  // YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const yyyy = parseInt(iso[1], 10);
    const mm = parseInt(iso[2], 10);
    const dd = parseInt(iso[3], 10);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${String(dd).padStart(2,"0")} ${MONTH_ABBR_LIST[mm-1]} ${yyyy}`;
    }
  }
  return s;
}

/* Small initial-circle avatar used in the listing's Uploaded By cell so the
 * row reads at a glance — same affordance as Physical Inventory. */
const AVATAR_PALETTE = [
  { bg: "#FEE2E2", fg: "#B91C1C" },
  { bg: "#DCFCE7", fg: "#15803D" },
  { bg: "#DBEAFE", fg: "#1D4ED8" },
  { bg: "#FEF3C7", fg: "#A16207" },
  { bg: "#EDE9FE", fg: "#6D28D9" },
  { bg: "#CFFAFE", fg: "#0E7490" },
  { bg: "#FCE7F3", fg: "#BE185D" },
];
function UploaderAvatar({ name, size = 20 }: { name: string; size?: number }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const pal = AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
  const parts = name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      style={{
        width: size, height: size, borderRadius: "9999px",
        background: pal.bg, color: pal.fg,
        fontFamily: font, fontSize: Math.round(size * 0.42), fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {initials}
    </span>
  );
}

function ViewToggle({ value, onChange, cardSize, onCardSizeChange }: {
  value: ViewMode; onChange: (v: ViewMode) => void;
  cardSize: CardSize; onCardSizeChange: (s: CardSize) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = VIEW_MODE_OPTIONS.find((o) => o.key === value)!;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((p) => !p)}
        className="inline-flex items-center transition-colors hover:bg-[var(--primary-50)]"
        style={{
          height: "28px", padding: "0 8px", borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)", background: "var(--card)",
          gap: "6px", fontFamily: font, fontWeight: 500, fontSize: "var(--text-caption)",
          color: "var(--text-secondary)", cursor: "pointer",
        }}
      >
        <span style={{ display: "flex", color: "var(--text-secondary)" }}>{current.icon}</span>
        {current.label}
        <ChevronDown size={11} style={{ color: "var(--text-tertiary)", transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div
          className="absolute z-50"
          style={{
            top: "calc(100% + 4px)", right: 0, width: "240px",
            borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
            background: "var(--card)",
            boxShadow: "0 8px 24px rgba(16,24,40,0.10), 0 2px 6px rgba(16,24,40,0.06)",
            padding: "6px",
          }}
        >
          {VIEW_MODE_OPTIONS.map((opt) => {
            const isActive = opt.key === value;
            return (
              <button
                key={opt.key}
                onClick={() => { onChange(opt.key); if (opt.key !== "card") setOpen(false); }}
                className="flex items-center w-full transition-colors hover:bg-[var(--primary-50)]"
                style={{
                  padding: "8px 10px", borderRadius: "var(--radius-sm)",
                  border: 0, background: "transparent",
                  fontFamily: font, textAlign: "left", gap: "10px", cursor: "pointer",
                }}
              >
                <span style={{ color: "var(--text-secondary)", display: "flex", flexShrink: 0 }}>{opt.icon}</span>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--foreground)", lineHeight: 1.2 }}>{opt.label}</span>
                  <span style={{ fontWeight: 400, fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.2 }}>{opt.description}</span>
                </div>
                {isActive && <Check size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />}
              </button>
            );
          })}
          {value === "card" && (
            <>
              <div style={{ borderTop: "1px solid var(--border)", margin: "6px 4px" }} />
              <div style={{ padding: "4px 8px" }}>
                <div style={{ fontFamily: font, fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                  Card Size
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["large", "medium", "small"] as const).map((size) => {
                    const active = cardSize === size;
                    return (
                      <button
                        key={size}
                        onClick={() => onCardSizeChange(size)}
                        style={{
                          flex: 1, padding: "6px 0",
                          borderRadius: "var(--radius-sm)",
                          fontFamily: font, fontSize: 11, fontWeight: active ? 600 : 500,
                          border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                          background: active ? "var(--primary-50)" : "var(--card)",
                          color: active ? "var(--primary)" : "var(--foreground)",
                          cursor: "pointer", textTransform: "capitalize",
                        }}
                      >
                        {size}
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

/* Inline 36×36 thumbnail with type-tinted bg + lucide icon + tiny extension
   badge — verbatim port of Physical Inventory's `InlineThumbnail`. */
const THUMB_BG: Record<string, { bg: string; color: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  pdf:  { bg: "var(--tx-type-negative-bg)", color: "var(--tx-type-negative-text)", Icon: FileText },
  xlsx: { bg: "var(--status-active-bg)",    color: "var(--status-active-text)",    Icon: FileSpreadsheet },
  csv:  { bg: "var(--status-active-bg)",    color: "var(--status-active-text)",    Icon: FileSpreadsheet },
  docx: { bg: "var(--primary-50)",          color: "var(--primary)",                Icon: FileText },
  png:  { bg: "var(--checked-out-tag-bg)",  color: "var(--checked-out-tag-text)",   Icon: FileImage },
  jpg:  { bg: "var(--checked-out-tag-bg)",  color: "var(--checked-out-tag-text)",   Icon: FileImage },
  zip:  { bg: "var(--reason-tag-bg)",       color: "var(--reason-tag-text)",        Icon: FileArchive },
  url:  { bg: "var(--link-tag-bg)",         color: "var(--link-tag-text)",          Icon: Link2 },
};

function InlineThumbnail({ type }: { type: string }) {
  const tb = THUMB_BG[type] ?? { bg: "var(--surface-secondary)", color: "var(--text-secondary)", Icon: FileIco };
  const Ico = tb.Icon;
  const ext = type === "url" ? "URL" : type.toUpperCase();
  return (
    <div
      className="shrink-0 relative overflow-hidden flex items-center justify-center"
      style={{ width: 36, height: 36, borderRadius: 6, background: tb.bg, border: "1px solid var(--border)" }}
    >
      <Ico size={16} style={{ color: tb.color, flexShrink: 0 }} />
      <span
        className="absolute"
        style={{
          bottom: 1, right: 1, padding: "0px 2px", borderRadius: 2,
          background: "rgba(255,255,255,0.85)", border: "1px solid var(--border)",
          fontFamily: font, fontWeight: 600, fontSize: 7, color: tb.color,
          letterSpacing: "0.03em", textTransform: "uppercase", lineHeight: "11px",
        }}
      >
        {ext}
      </span>
    </div>
  );
}

/* List-view row — shown for both Condensed and Comfort modes. The
   `density` prop controls the row vertical padding (Condensed: tight,
   Comfort: spacious) — Physical Inventory pattern. */
function FileListRow({
  doc, searchQuery, readOnly, density = "comfort", onPreview, onDelete, onConvert, onRename,
}: {
  doc: LinkedDocument;
  searchQuery: string;
  readOnly?: boolean;
  density?: "condensed" | "comfort";
  onPreview: (doc: LinkedDocument) => void;
  onDelete: (id: string) => void;
  onConvert: (doc: LinkedDocument, direction: "to-quote" | "to-item") => void;
  onRename: (doc: LinkedDocument) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const tb = (() => {
    switch (doc.type) {
      case "pdf":  return { color: "var(--tx-type-negative-text)", bg: "var(--tx-type-negative-bg)" };
      case "xlsx":
      case "csv":  return { color: "var(--status-active-text)", bg: "var(--status-active-bg)" };
      case "docx": return { color: "var(--primary)", bg: "var(--primary-50)" };
      case "png":
      case "jpg":  return { color: "var(--checked-out-tag-text)", bg: "var(--checked-out-tag-bg)" };
      case "url":  return { color: "var(--link-tag-text)", bg: "var(--link-tag-bg)" };
      default:     return { color: "var(--text-secondary)", bg: "var(--surface-secondary)" };
    }
  })();
  return (
    <div
      className="flex items-center transition-colors cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (doc.type === "url" && doc.url) { window.open(doc.url, "_blank"); return; }
        onPreview(doc);
      }}
      style={{
        // Condensed: tight 7px vertical pad. Comfort: 12px (spacious) — PI chrome.
        padding: density === "condensed" ? "7px 16px" : "12px 16px",
        borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
        background: hovered ? "var(--primary-50)" : "transparent",
        fontFamily: font,
        columnGap: 2,
      }}
    >
      <div className="flex items-center min-w-0" style={{ flex: 1, gap: 10 }}>
        {/* InlineThumbnail — verbatim Physical Inventory chrome. */}
        <InlineThumbnail type={doc.type} />
        <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1.3 }} title={doc.name}>
          <HighlightText text={doc.name} query={searchQuery} />
        </span>
      </div>
      <span className="shrink-0" style={{ width: 70, textAlign: "left", fontSize: 12, color: "var(--text-secondary)" }}>{doc.size || "—"}</span>
      <span className="shrink-0" style={{ width: 150, textAlign: "left", fontSize: 12, color: "var(--text-tertiary)" }}>{formatDateShort(doc.uploadedAt)}</span>
      <div className="shrink-0 flex items-center min-w-0" style={{ width: 140, gap: 8 }}>
        <UploaderAvatar name={doc.uploadedBy} size={20} />
        <span className="truncate" style={{ fontSize: 12, color: "var(--foreground)" }} title={doc.uploadedBy}>{doc.uploadedBy}</span>
      </div>
      {/* Three-dots hover menu — the same Preview / Download / Convert /
          Delete actions the card view exposes, in the same order. It runs
          through the shared `AttachmentRowMenu`, which portals itself out
          of this pane: the list sits in an `overflow-y-auto` container, so
          an in-row menu on one of the last rows lost its lower items to
          the container's bottom edge. */}
      {(() => {
        //   1. Preview / Open Link
        //   2. Download (non-URL)
        //   3. Move to Quote Level (item-scoped files only)
        //   4. Delete (destructive, divider above)
        // No PDF-reference toggle: every attachment travels with the
        // PDF, so there is nothing to opt in or out of.
        const isUrl = doc.type === "url";
        const isItemAtt = doc.category === "item-attachment";
        const items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; dividerBefore?: boolean }[] = [
          {
            label: isUrl ? "Open Link" : "Preview",
            icon: isUrl ? <ExternalLink size={13} /> : <Eye size={13} />,
            onClick: () => {
              if (isUrl && doc.url) { window.open(doc.url, "_blank"); return; }
              onPreview(doc);
            },
          },
        ];
        if (!isUrl) {
          items.push({ label: "Download", icon: <FileIco size={13} />, onClick: () => toast.success("Download started") });
        }
        if (!readOnly) {
          /* Copied from the item master: Preview, Download and Remove from
             Quote only, no separator, as in the line item configurator. */
          if (isItemAtt && doc.galleryId) {
            items.push({ label: "Remove from Quote", icon: <Trash2 size={13} />, danger: true, onClick: () => onDelete(doc.id) });
          } else {
            if (isItemAtt) {
              items.push({ label: "Move to Quote Level", icon: <ArrowRightLeft size={13} />, onClick: () => onConvert(doc, "to-quote"), dividerBefore: true });
            }
            items.push({ label: "Delete", icon: <Trash2 size={13} />, danger: true, dividerBefore: true, onClick: () => onDelete(doc.id) });
          }
        }
        return <AttachmentRowMenu items={items} label={doc.name} visible={hovered} width={36} />;
      })()}
    </div>
  );
}

function FolderTreeView({
  documents,
  searchQuery,
  onDelete,
  onConvert,
  onPreview,
  onRename,
  onRequestDelete,
  readOnly,
  viewMode,
  cardSize,
  dateRange,
  onDateRangeChange,
  customFrom,
  customTo,
  onCustomRangeChange,
  visibleCategories,
}: {
  documents: LinkedDocument[];
  searchQuery: string;
  onDelete: (id: string) => void;
  onConvert: (doc: LinkedDocument, direction: "to-quote" | "to-item") => void;
  onPreview: (doc: LinkedDocument) => void;
  onRename: (doc: LinkedDocument) => void;
  /** List rows have no built-in confirm (cards do), so they ask the tab
   *  to confirm first. */
  onRequestDelete: (id: string) => void;
  readOnly?: boolean;
  /* Lifted from AttachmentsTab so the top toolbar owns the density
     control (matches PI-9's layout). */
  viewMode: ViewMode;
  cardSize: CardSize;
  /* Date range is rendered as a file-pane header dropdown here, but
     filtering happens upstream in AttachmentsTab so counts stay in sync
     with the source pill bar. Pass through raw so the dropdown can
     write it back. */
  dateRange: DateRangeKey;
  onDateRangeChange: (v: DateRangeKey) => void;
  /* Custom-range endpoints (ISO YYYY-MM-DD, empty when unused).
     Lifted so both the dropdown sub-view and the parent filter share
     the same source of truth. */
  customFrom: string;
  customTo: string;
  onCustomRangeChange: (from: string, to: string) => void;
  /* Which category rows the sources sidebar should render. Filtered
     upstream by quote status so an unconverted quote never surfaces
     the "Sales Order Documents" row. */
  visibleCategories: DocCategory[];
}) {
  const [scope, setScope] = useState<SourceScope>("all");
  const [itemDrillIn, setItemDrillIn] = useState<string | null>(null); // "all" or item id
  const [fileCategory, setFileCategory] = useState<FileCategory>("all");
  /* File pane header controls — ported from PI-9's `TxSortDropdown`
     and `FileTypeDropdown` (attachments-tab.tsx:1688-1689). Both live
     inside the tree since they affect only the right pane's list. */
  const [fileSortMode, setFileSortMode] = useState<SortMode>("latest");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");

  /* Aggregate counts */
  const counts = useMemo(() => {
    const c: Record<SourceScope, number> = {
      "all": documents.length,
      "pre-quote": 0,
      "quote-attachment": 0,
      "item-attachment": 0,
      "sales-order": 0,
      "rejection": 0,
    };
    documents.forEach((d) => { c[d.category]++; });
    return c;
  }, [documents]);

  /* Group item-attachments by line item */
  const itemGroups = useMemo(() => {
    const map = new Map<string, { line: QuoteLineItem; docs: LinkedDocument[] }>();
    for (const li of QUOTE_LINE_ITEMS) {
      for (const d of documents) {
        if (d.category !== "item-attachment") continue;
        if (d.itemRefs?.some((r) => r.id === li.itemNumber)) {
          if (!map.has(li.itemNumber)) map.set(li.itemNumber, { line: li, docs: [] });
          if (!map.get(li.itemNumber)!.docs.find((x) => x.id === d.id)) {
            map.get(li.itemNumber)!.docs.push(d);
          }
        }
      }
    }
    return Array.from(map.values());
  }, [documents]);

  /* Right pane files. For non-item scopes, the middle column lets the
     user narrow by file category — we apply that filter here so the
     pane reflects the user's selection in real time. Then the file
     pane header's FileTypeDropdown + SortDropdown are applied on top
     (PI-9 style). */
  const rightPaneDocs = useMemo(() => {
    let base: LinkedDocument[];
    if (scope === "all") {
      base = documents;
    } else if (scope === "item-attachment") {
      const itemDocs = documents.filter((d) => d.category === "item-attachment");
      base = (itemDrillIn && itemDrillIn !== "all")
        ? itemDocs.filter((d) => d.itemRefs?.some((r) => r.id === itemDrillIn))
        : itemDocs;
    } else {
      base = documents.filter((d) => d.category === scope);
    }
    if (scope !== "item-attachment") {
      base = base.filter((d) => matchesFileCategory(d.type, fileCategory));
    }
    if (fileTypeFilter !== "all") {
      base = base.filter((d) => d.type === fileTypeFilter);
    }
    const cmp = (a: LinkedDocument, b: LinkedDocument): number =>
      fileSortMode === "latest"
        ? (b.uploadedAt || "").localeCompare(a.uploadedAt || "")
        : (a.uploadedAt || "").localeCompare(b.uploadedAt || "");
    return [...base].sort(cmp);
  }, [scope, itemDrillIn, fileCategory, fileTypeFilter, fileSortMode, documents]);

  /* Extensions available in the current pane — feeds the FileTypeDropdown
     so users don't see filter options that would produce zero results. */
  const availableExts = useMemo(() => {
    const set = new Set<string>();
    rightPaneDocs.forEach((d) => set.add(d.type));
    /* Reset the file type filter if the current pick becomes unavailable. */
    return Array.from(set).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightPaneDocs.length, fileTypeFilter]);
  useEffect(() => {
    if (fileTypeFilter !== "all" && !availableExts.includes(fileTypeFilter)) {
      setFileTypeFilter("all");
    }
  }, [availableExts, fileTypeFilter]);

  /* File-category counts for the middle column. Computed from the
     unfiltered base set so the badge always reflects what's available
     under the current scope, not what's currently visible. */
  const scopeBaseDocs = useMemo<LinkedDocument[]>(() => {
    if (scope === "all") return documents;
    if (scope === "item-attachment") return documents.filter((d) => d.category === "item-attachment");
    return documents.filter((d) => d.category === scope);
  }, [scope, documents]);

  const fileCategoryCounts = useMemo(() => ({
    all: scopeBaseDocs.length,
    documents: scopeBaseDocs.filter((d) => FILE_CAT_DOCS.includes(d.type)).length,
    photos: scopeBaseDocs.filter((d) => FILE_CAT_PHOTOS.includes(d.type)).length,
    videos: scopeBaseDocs.filter((d) => FILE_CAT_VIDEOS.includes(d.type)).length,
    audio: scopeBaseDocs.filter((d) => FILE_CAT_AUDIO.includes(d.type)).length,
  }), [scopeBaseDocs]);

  const handleScopeChange = useCallback((s: SourceScope) => {
    setScope(s);
    setItemDrillIn(s === "item-attachment" ? "all" : null);
    /* Always reset the file category when the user picks a different
       source — the previous category may not exist under the new
       scope, and "All Files" is the most predictable starting point. */
    setFileCategory("all");
  }, []);

  return (
    <div className="flex flex-1 min-h-0">
      {/* ─── COL 1 — Sources / categories ───
          Aligned with the Physical Inventory attachments-tab pattern:
          210px width, uses `var(--card)` (pure white) rather than
          `var(--background)` because Quote's theme resolves the latter
          to a visible light-gray tint that reads as a distinct band
          against the outer card. PI's `--background` is near-white, so
          swapping tokens is what actually preserves visual parity. */}
      <div className="shrink-0 flex flex-col" style={{ width: "210px", borderRight: "1px solid var(--border)", background: "var(--card)" }}>
        <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2)", borderBottom: "1px solid var(--border)", gap: "var(--spacing-1-5)", height: "38px", boxSizing: "border-box" }}>
          <Layers size={13} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-caption)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Sources
          </span>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ padding: "var(--spacing-1-5) 0" }}>
          {visibleCategories.map((cat) => {
            const meta = CATEGORY_META[cat];
            const isActive = scope === cat;
            const count = counts[cat];
            return (
              <div key={cat} style={{ padding: "0 6px" }}>
                <button
                  onClick={() => handleScopeChange(cat)}
                  className="flex items-center w-full transition-colors"
                  style={{
                    height: "32px",
                    padding: "0 6px",
                    border: 0,
                    borderRadius: "var(--radius-sm)",
                    background: isActive ? "var(--primary-50)" : "transparent",
                    gap: "6px",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <FolderOpen size={13} style={{ color: meta.color, flexShrink: 0 }} />
                  <span className="truncate" style={{ fontFamily: font, fontWeight: isActive ? 600 : 500, fontSize: "var(--text-caption)", color: isActive ? "var(--primary)" : "var(--foreground)", textAlign: "left", flex: 1 }}>
                    {meta.label}
                  </span>
                  <span className="inline-flex items-center justify-center" style={{ minWidth: "16px", height: "16px", padding: "0 2px", borderRadius: "9999px", background: isActive ? "var(--primary-100)" : "var(--surface-secondary)", fontFamily: font, fontWeight: 600, fontSize: "9px", color: isActive ? "var(--primary-700)" : "var(--text-tertiary)" }}>
                    {count}
                  </span>
                </button>
              </div>
            );
          })}
          <div style={{ height: 1, background: "var(--border)", margin: "4px 8px" }} />
          <div style={{ padding: "0 6px" }}>
            <button
              onClick={() => handleScopeChange("all")}
              className="flex items-center w-full transition-colors"
              style={{
                height: "32px",
                padding: "0 6px",
                border: 0,
                borderRadius: "var(--radius-sm)",
                background: scope === "all" ? "var(--primary-50)" : "transparent",
                gap: "6px",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { if (scope !== "all") (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
              onMouseLeave={(e) => { if (scope !== "all") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Layers size={13} style={{ color: scope === "all" ? "var(--primary)" : "var(--text-secondary)", flexShrink: 0 }} />
              <span className="truncate" style={{ fontFamily: font, fontWeight: scope === "all" ? 600 : 500, fontSize: "var(--text-caption)", color: scope === "all" ? "var(--primary)" : "var(--foreground)", textAlign: "left", flex: 1 }}>
                All Files
              </span>
              <span className="inline-flex items-center justify-center" style={{ minWidth: "16px", height: "16px", padding: "0 2px", borderRadius: "9999px", background: scope === "all" ? "var(--primary-100)" : "var(--surface-secondary)", fontFamily: font, fontWeight: 600, fontSize: "9px", color: scope === "all" ? "var(--primary-700)" : "var(--text-tertiary)" }}>
                {documents.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── COL 2 — File-category context pane ───
          Shown for every source EXCEPT Item Attachments, which uses
          the item-list variant below. Mirrors the Physical Inventory
          Item Library middle column: All Files / Documents / Photos /
          Videos / Audio with counts. The header label tracks the
          active source so the breadcrumb reads cleanly into the right
          pane. */}
      {scope !== "item-attachment" && (
        <div
          className="shrink-0 flex flex-col"
          style={{
            width: "240px",
            borderRight: "1px solid var(--border)",
            /* Middle column carries PI-9's subtle gray tint
               (attachments-tab.tsx:1501): a 45% blend of the surface
               token over white. Anchors the visual hierarchy so col 2
               reads as a secondary rail between the sources column
               and the file pane, matching PI-9 exactly. */
            background: "color-mix(in srgb, #F1F5F9 45%, #FFFFFF)",
          }}
        >
          <div className="shrink-0 flex items-center" style={{ padding: "8px", borderBottom: "1px solid var(--border)", gap: "6px", height: "38px", boxSizing: "border-box", background: "transparent" }}>
            <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-caption)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {scope === "all" ? "All Files" : CATEGORY_META[scope].label}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ padding: "6px 0" }}>
            {([
              { key: "all" as const,       label: "All Files",  icon: Layers,        count: fileCategoryCounts.all },
              { key: "documents" as const, label: "Documents",  icon: FileText,      count: fileCategoryCounts.documents },
              { key: "photos" as const,    label: "Photos",     icon: FileImage,     count: fileCategoryCounts.photos },
              { key: "videos" as const,    label: "Videos",     icon: FileIco,       count: fileCategoryCounts.videos },
              { key: "audio" as const,     label: "Audio",      icon: FileIco,       count: fileCategoryCounts.audio },
            ]).map((cat) => {
              const isActive = fileCategory === cat.key;
              return (
                <div key={cat.key} style={{ padding: "0 6px" }}>
                  <button
                    onClick={() => setFileCategory(cat.key)}
                    className="flex items-center w-full transition-colors"
                    style={{
                      height: "32px", padding: "0 6px", border: 0, borderRadius: "var(--radius-sm)",
                      background: isActive ? "var(--primary-50)" : "transparent",
                      gap: "6px", cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <cat.icon size={12} style={{ color: isActive ? "var(--primary)" : "var(--text-secondary)", flexShrink: 0 }} />
                    <span className="truncate" style={{ fontFamily: font, fontWeight: isActive ? 600 : 500, fontSize: "var(--text-caption)", color: isActive ? "var(--primary)" : "var(--foreground)", textAlign: "left", flex: 1 }}>
                      {cat.label}
                    </span>
                    <span className="inline-flex items-center justify-center" style={{ minWidth: "16px", height: "16px", padding: "0 2px", borderRadius: "9999px", background: isActive ? "var(--primary-100)" : "color-mix(in srgb, var(--border) 60%, var(--surface-secondary))", fontFamily: font, fontWeight: 600, fontSize: "9px", color: isActive ? "var(--primary-700)" : "var(--text-tertiary)" }}>
                      {cat.count}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── COL 2 — Item drill-in pane (Item Attachments only) ─── */}
      {scope === "item-attachment" && (
        <div
          className="shrink-0 flex flex-col"
          style={{
            width: "260px",
            borderRight: "1px solid var(--border)",
            /* Same subtle tint as the file-category col 2 above so
               the item drill-in variant reads as the same rail. */
            background: "color-mix(in srgb, #F1F5F9 45%, #FFFFFF)",
          }}
        >
          <div className="shrink-0 flex items-center" style={{ padding: "8px", borderBottom: "1px solid var(--border)", gap: "6px", height: "38px", boxSizing: "border-box", background: "transparent" }}>
            <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-caption)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Item Attachments
            </span>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ padding: "6px 0" }}>
            <div style={{ padding: "0 6px" }}>
              <button
                onClick={() => setItemDrillIn("all")}
                className="flex items-center w-full transition-colors"
                style={{
                  height: "32px", padding: "0 6px", border: 0, borderRadius: "var(--radius-sm)",
                  background: itemDrillIn === "all" ? "var(--primary-50)" : "transparent",
                  gap: "6px", cursor: "pointer",
                }}
                onMouseEnter={(e) => { if (itemDrillIn !== "all") (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
                onMouseLeave={(e) => { if (itemDrillIn !== "all") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <Layers size={12} style={{ color: itemDrillIn === "all" ? "var(--primary)" : "var(--text-secondary)" }} />
                <span className="truncate" style={{ fontFamily: font, fontWeight: itemDrillIn === "all" ? 600 : 500, fontSize: "var(--text-caption)", color: itemDrillIn === "all" ? "var(--primary)" : "var(--foreground)", textAlign: "left", flex: 1 }}>
                  All items
                </span>
                <span className="inline-flex items-center justify-center" style={{ minWidth: "16px", height: "16px", padding: "0 2px", borderRadius: "9999px", background: itemDrillIn === "all" ? "var(--primary-100)" : "color-mix(in srgb, var(--border) 60%, var(--surface-secondary))", fontFamily: font, fontWeight: 600, fontSize: "9px", color: itemDrillIn === "all" ? "var(--primary-700)" : "var(--text-tertiary)" }}>
                  {documents.filter((d) => d.category === "item-attachment").length}
                </span>
              </button>
            </div>
            <div style={{ height: 1, background: "color-mix(in srgb, var(--border) 50%, transparent)", margin: "4px 8px" }} />
            {itemGroups.length === 0 ? (
              <div style={{ padding: "16px", fontFamily: font, fontSize: "var(--text-caption)", color: "var(--text-tertiary)", lineHeight: 1.4, textAlign: "center" }}>
                No item-level attachments yet.
              </div>
            ) : itemGroups.map(({ line, docs }) => {
              const isActive = itemDrillIn === line.itemNumber;
              return (
                <div key={line.itemNumber} style={{ padding: "0 6px" }}>
                  <button
                    onClick={() => setItemDrillIn(line.itemNumber)}
                    className="flex items-center w-full transition-colors"
                    style={{
                      minHeight: "44px", padding: "6px 6px", border: 0, borderRadius: "var(--radius-sm)",
                      background: isActive ? "var(--primary-50)" : "transparent",
                      gap: "8px", cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div style={{ width: "28px", height: "28px", borderRadius: "var(--radius-sm)", background: "var(--surface-secondary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Package size={13} style={{ color: "var(--text-secondary)" }} />
                    </div>
                    <div className="flex flex-col min-w-0" style={{ flex: 1, gap: "1px" }}>
                      <span className="truncate" style={{ fontFamily: font, fontWeight: isActive ? 600 : 500, fontSize: "var(--text-caption)", color: isActive ? "var(--primary)" : "var(--foreground)" }}>
                        {line.itemNumber}
                      </span>
                      <span className="truncate" style={{ fontFamily: font, fontWeight: 400, fontSize: "10px", color: "var(--text-tertiary)" }}>
                        {line.productName}
                      </span>
                    </div>
                    <span className="inline-flex items-center justify-center shrink-0" style={{ minWidth: "16px", height: "16px", padding: "0 2px", borderRadius: "9999px", background: isActive ? "var(--primary-100)" : "color-mix(in srgb, var(--border) 60%, var(--surface-secondary))", fontFamily: font, fontWeight: 600, fontSize: "9px", color: isActive ? "var(--primary-700)" : "var(--text-tertiary)" }}>
                      {docs.length}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── COL 3 — File grid ───
          Breadcrumb header uses `var(--card)` (white) to match the
          adjacent columns' surfaces and stay flush with the toolbar
          above; using `var(--background)` here surfaces Quote's
          light-gray page bg and breaks the seamless look PI has. */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2) var(--spacing-3)", borderBottom: "1px solid var(--border)", gap: "var(--spacing-1-5)", background: "var(--card)", height: "38px", boxSizing: "border-box" }}>
          {scope === "all" ? (
            <>
              <Layers size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />
              <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-caption)", color: "var(--foreground)" }}>All Files</span>
            </>
          ) : scope === "item-attachment" && itemDrillIn && itemDrillIn !== "all" ? (
            (() => {
              const li = QUOTE_LINE_ITEMS.find((x) => x.itemNumber === itemDrillIn);
              return (
                <>
                  <FolderOpen size={13} style={{ color: CATEGORY_META["item-attachment"].color, flexShrink: 0 }} />
                  <button
                    onClick={() => setItemDrillIn("all")}
                    style={{ fontFamily: font, fontWeight: 500, fontSize: "var(--text-caption)", color: "var(--primary)", background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
                  >
                    Item Attachments
                  </button>
                  <ChevronRight size={10} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                  <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-caption)", color: "var(--foreground)" }}>
                    {li?.itemNumber}
                  </span>
                </>
              );
            })()
          ) : (
            <>
              <FolderOpen size={13} style={{ color: CATEGORY_META[scope as DocCategory].color, flexShrink: 0 }} />
              <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-caption)", color: "var(--foreground)" }}>
                {CATEGORY_META[scope as DocCategory].label}
              </span>
            </>
          )}
          <div className="flex items-center shrink-0" style={{ marginLeft: "auto", gap: "var(--spacing-2)" }}>
            {/* File pane header controls — port of PI-9's file pane
                header (attachments-tab.tsx:1675-1690). ViewToggle
                (density) has been lifted to the top toolbar so this
                row only carries filter + sort controls. */}
            <span style={{ fontFamily: font, fontWeight: 400, fontSize: "var(--text-caption)", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
              {rightPaneDocs.length} item{rightPaneDocs.length !== 1 ? "s" : ""} · {formatTotalSize(rightPaneDocs)}
            </span>
            <DateFilterDropdown
              value={dateRange}
              onChange={onDateRangeChange}
              customFrom={customFrom}
              customTo={customTo}
              onCustomChange={onCustomRangeChange}
            />
            <FileTypeDropdown value={fileTypeFilter} onChange={setFileTypeFilter} available={availableExts} />
            <SortDropdown value={fileSortMode} onChange={setFileSortMode} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rightPaneDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center" style={{ padding: "48px 24px", gap: "8px", height: "100%" }}>
              <div className="flex items-center justify-center" style={{ width: "64px", height: "64px", borderRadius: "var(--radius-md)", background: "var(--accent)" }}>
                <Paperclip size={26} style={{ color: "var(--primary)", opacity: 0.7 }} />
              </div>
              <div style={{ fontFamily: font, fontSize: "14px", fontWeight: 600, color: "var(--foreground)", marginTop: "8px" }}>No files yet</div>
              <div style={{ fontFamily: font, fontSize: "12px", color: "var(--muted-foreground)", maxWidth: "320px", textAlign: "center", lineHeight: 1.5 }}>
                No files have been attached to this source yet. Upload a file to get started.
              </div>
            </div>
          ) : viewMode === "condensed" || viewMode === "comfort" ? (
            <div className="flex flex-col">
              {/* File list header — verbatim port of PI-9's
                  `FileListHeader` (attachments-tab.tsx:1837): tighter
                  8px 12px padding, no letter-spacing beyond 0.01em,
                  bg-slate-50, 11px semibold 94a3b8 cell text. */}
              <div
                className="flex items-center sticky top-0 z-10 bg-slate-50"
                style={{
                  padding: "calc(var(--spacing-1-5) + 2px) var(--spacing-3)",
                  borderBottom: "1px solid var(--border)",
                  columnGap: "2px",
                }}
              >
                <div className="flex-1 min-w-0" style={{ fontFamily: font, fontWeight: 600, fontSize: "11px", color: "#94a3b8", letterSpacing: "0.01em", textAlign: "left" }}>File Name</div>
                <div className="shrink-0" style={{ width: "70px", fontFamily: font, fontWeight: 600, fontSize: "11px", color: "#94a3b8", letterSpacing: "0.01em", textAlign: "left" }}>Size</div>
                <div className="shrink-0" style={{ width: "150px", fontFamily: font, fontWeight: 600, fontSize: "11px", color: "#94a3b8", letterSpacing: "0.01em", textAlign: "left" }}>Date</div>
                <div className="shrink-0" style={{ width: "140px", fontFamily: font, fontWeight: 600, fontSize: "11px", color: "#94a3b8", letterSpacing: "0.01em", textAlign: "left" }}>Uploaded By</div>
                <div className="shrink-0" style={{ width: "36px" }} />
              </div>
              {rightPaneDocs.map((doc) => (
                <FileListRow
                  key={doc.id}
                  doc={doc}
                  searchQuery={searchQuery}
                  readOnly={readOnly}
                  density={viewMode === "condensed" ? "condensed" : "comfort"}
                  onPreview={onPreview}
                  onDelete={onRequestDelete}
                  onConvert={onConvert}
                  onRename={onRename}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: CARD_SIZE_COLUMNS[cardSize], padding: "var(--spacing-4)", gap: "var(--spacing-4)" }}>
              {rightPaneDocs.map((doc) => {
                const isItemAtt = doc.category === "item-attachment";
                const fromItemMaster = isItemAtt && !!doc.galleryId;
                /* Attachment-card 3-dots menu is scoped to Preview, Download,
                   PDF-visibility toggle, "Move to Quote Level" (only when
                   the file is item-scoped), and Delete. Rename and
                   "Move to Item Level" were removed per updated spec. */
                const extraMenu: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; dividerBefore?: boolean }[] = [];
                if (!readOnly && isItemAtt && !fromItemMaster) {
                  extraMenu.push({ label: "Move to Quote Level", icon: <ArrowRightLeft size={13} style={{ color: "var(--text-secondary)" }} />, onClick: () => onConvert(doc, "to-quote") });
                }

                return (
                  <AttachmentCard
                    key={doc.id}
                    att={toCardData(doc)}
                    /* Thumbnail follows the Card Size control, as PO's
                       does. Columns alone widened the cards and left the
                       images short. */
                    thumbHeight={ATTACHMENT_CARD_THUMB[cardSize]}
                    renderFileName={(n) => <HighlightText text={n} query={searchQuery} />}
                    pills={
                      <>
                        {doc.itemRefs && doc.itemRefs.length > 0 && <CardItemRefPill itemRef={doc.itemRefs[0]} />}
                        {scope === "all" && <CardSourcePill doc={doc} />}
                      </>
                    }
                    onPreview={() => {
                      if (doc.type === "url" && doc.url) { window.open(doc.url, "_blank"); return; }
                      onPreview(doc);
                    }}
                    onDownload={() => toast.success("Download started")}
                    onDelete={readOnly ? undefined : () => onDelete(doc.id)}
                    removeScopeLabel={fromItemMaster ? "Quote" : undefined}
                    deleteDivider={!fromItemMaster}
                    onCardClick={() => {
                      if (doc.type === "url" && doc.url) { window.open(doc.url, "_blank"); return; }
                      onPreview(doc);
                    }}
                    extraMenuItems={extraMenu.length ? extraMenu.map((m, i) => ({ ...m, dividerBefore: i === 0 })) : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 5  MAIN — AttachmentsTab
 * ═══════════════════════════════════════════════════════════════════════════ */

interface AttachmentsTabProps {
  quoteNumber?: string;
  customerName?: string;
  readOnly?: boolean;
  onAskUserChange?: (fieldKey: string, fieldLabel: string, changeDescription: string) => void;
  isNewlyCreated?: boolean;
  quoteStatus?: string;
}

export function AttachmentsTab({ quoteNumber = "Q-000-000-000", readOnly = false, onAskUserChange, isNewlyCreated = false, quoteStatus = 'sent' }: AttachmentsTabProps) {
  const [localDocs, setLocalDocs] = useState<LinkedDocument[]>(() => isNewlyCreated ? [] : MOCK_DOCUMENTS);
  /* Keep the Print window's attachment page count in step with this tab. */
  useEffect(() => { publishPrintAttachments(quoteNumber, toPrintable(localDocs)); }, [quoteNumber, localDocs]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeKey>("all");
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  /* View mode + card size lifted from FolderTreeView so the toggle
     lives in the top toolbar (matches PI-9's shell where density sits
     in the tab's row 1, not the file pane header). Default is "card"
     to match PI-9's default (attachments-tab.tsx:2584). */
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [cardSize, setCardSize] = useState<CardSize>("medium");
  /* Initial-load skeleton — PI-9 shows one for ~1.8s so the layers
     tree never flashes empty. `AttachmentsLoadingSkeleton` is a
     verbatim port of PI-9's chrome. */
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1800);
    return () => clearTimeout(t);
  }, []);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [convertModal, setConvertModal] = useState<{ doc: LinkedDocument; direction: "to-quote" | "to-item" } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<LinkedDocument | null>(null);
  const [renameDoc, setRenameDoc] = useState<LinkedDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Pre-quote docs synced from quote store */
  const [storeDocs, setStoreDocs] = useState<PreQuoteDocument[]>(() => getPreQuoteDocs(quoteNumber));
  useEffect(() => {
    setStoreDocs(getPreQuoteDocs(quoteNumber));
    return subscribePreQuoteDocs(quoteNumber, () => setStoreDocs(getPreQuoteDocs(quoteNumber)));
  }, [quoteNumber]);

  /* Rejection-modal attachments synced from the rejection-doc registry.
     Same pub/sub shape as `preQuoteDocs`. */
  const [rejectionDocsState, setRejectionDocsState] = useState<RejectionDocument[]>(() => getRejectionDocs(quoteNumber));
  useEffect(() => {
    setRejectionDocsState(getRejectionDocs(quoteNumber));
    return subscribeRejectionDocs(quoteNumber, () => setRejectionDocsState(getRejectionDocs(quoteNumber)));
  }, [quoteNumber]);

  const mapDocType = (ext: string): LinkedDocument["type"] => {
    const m: Record<string, LinkedDocument["type"]> = { pdf: "pdf", xlsx: "xlsx", xls: "xlsx", csv: "csv", docx: "docx", doc: "docx", png: "png", jpg: "jpg", jpeg: "jpg" };
    return m[ext] || "pdf";
  };

  const storeAsLinked: LinkedDocument[] = storeDocs.map((d) => ({
    id: d.id, name: d.name, category: "pre-quote", type: mapDocType(d.type),
    size: d.size, uploadedBy: d.uploadedBy, uploadedAt: d.uploadedAt, includedInPdf: false, tags: ["rfq/rfp"],
  }));

  const rejectionAsLinked: LinkedDocument[] = rejectionDocsState.map((d) => ({
    id: d.id, name: d.name, category: "rejection", type: mapDocType(d.type),
    size: d.size, uploadedBy: d.uploadedBy, uploadedAt: d.uploadedAt, includedInPdf: false,
    previewUrl: d.previewUrl,
  }));

  /* Item Attachments come from quoteStore's line-item attachment
     registry, the same store the line-item configurator reads and writes.
     That shared store is what makes deletion symmetric: removing a file
     here removes it from the configurator's list, and vice versa. */
  useEffect(() => {
    if (isNewlyCreated) initEmptyLineItemAttachments(quoteNumber);
  }, [isNewlyCreated, quoteNumber]);
  const [lineAtts, setLineAtts] = useState(() => getAllLineItemAttachments(quoteNumber));
  useEffect(() => {
    setLineAtts(getAllLineItemAttachments(quoteNumber));
    return subscribeLineItemAttachments(quoteNumber, () => setLineAtts(getAllLineItemAttachments(quoteNumber)));
  }, [quoteNumber]);

  const lineAttsAsLinked: LinkedDocument[] = lineAtts.map((a) => ({
    id: a.id,
    name: a.name,
    category: "item-attachment",
    type: mapDocType(a.type),
    size: a.size,
    uploadedBy: a.uploadedBy,
    uploadedAt: a.uploadedAt,
    previewUrl: a.previewUrl,
    includedInPdf: false,
    itemRefs: [{ id: a.itemId, label: a.itemLabel }],
    galleryId: a.galleryId,
  }));

  const visibleDocs = (() => {
    // Sales-order docs only relevant after the quote has been converted to an SO.
    // Everything else stays.
    if (quoteStatus !== 'converted') {
      return localDocs.filter(d => d.category !== 'sales-order');
    }
    return localDocs;
  })();

  const documents = useMemo(
    () => [...storeAsLinked, ...rejectionAsLinked, ...lineAttsAsLinked, ...visibleDocs],
    [storeAsLinked, rejectionAsLinked, lineAttsAsLinked, visibleDocs],
  );

  /* Sources sidebar rows are gated by state + content:
     - `sales-order` only surfaces once the quote has been converted
     - `rejection` only surfaces after a rejection with attachments
       actually landed (no empty folder advertising) */
  const hasRejectionAttachments = rejectionAsLinked.length > 0;
  const visibleCategories: DocCategory[] = useMemo(
    () =>
      CATEGORY_ORDER.filter((c) => {
        if (c === 'sales-order' && quoteStatus !== 'converted') return false;
        if (c === 'rejection' && !hasRejectionAttachments) return false;
        return true;
      }),
    [quoteStatus, hasRejectionAttachments],
  );

  const filteredDocs = useMemo(() => {
    let list = filterByDateRange(documents, dateRange, customRange.from, customRange.to);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) =>
        d.name.toLowerCase().includes(q) ||
        d.uploadedBy.toLowerCase().includes(q) ||
        d.itemRefs?.some((r) => r.id.includes(q) || r.label.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [documents, searchQuery, dateRange, customRange]);

  /* Deleting has to reach whichever store owns the row. Item Attachments
     live in the line-item registry and are not in local state, so writing
     only to local state would silently no-op on them and leave the
     configurator still showing the file. */
  const handleDelete = useCallback((id: string) => {
    setLocalDocs((prev) => prev.filter((d) => d.id !== id));
    removeLineItemAttachment(quoteNumber, id);
  }, [quoteNumber]);

  /* One confirm + toast for every delete in this tab. Cards confirm in
     their own dialog and then call deleteNow; list rows and the preview
     open this tab's confirm first. Uploaded files are permanently
     deleted; line-item files copied from the item master are only
     removed from the quote (the master keeps its copy). */
  type PendingDelete = { id: string; name: string; kind: "file" | "link"; fromItemMaster: boolean };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const describeDoc = (id: string): PendingDelete | null => {
    const d = documents.find((x) => x.id === id);
    if (!d) return null;
    return { id, name: d.name, kind: d.type === "url" ? "link" : "file", fromItemMaster: d.category === "item-attachment" && !!d.galleryId };
  };
  const deleteNow = (target: PendingDelete) => {
    handleDelete(target.id);
    toast.success(target.kind === "link"
      ? `Link "${target.name}" deleted`
      : target.fromItemMaster ? `"${target.name}" removed from this quote` : `"${target.name}" deleted`);
  };
  const requestDelete = (id: string) => setPendingDelete(describeDoc(id));

  const handleConvert = useCallback((doc: LinkedDocument, direction: "to-quote" | "to-item") => {
    setConvertModal({ doc, direction });
  }, []);

  /* Moving between levels moves the record between the two stores, since
     Item Attachments no longer live in this tab's local state. */
  const handleConvertToQuote = (id: string) => {
    const fromItem = lineAtts.find((a) => a.id === id);
    if (fromItem) {
      setLocalDocs((prev) => [{
        id: fromItem.id,
        name: fromItem.name,
        category: "quote-attachment",
        type: mapDocType(fromItem.type),
        size: fromItem.size,
        uploadedBy: fromItem.uploadedBy,
        uploadedAt: fromItem.uploadedAt,
        previewUrl: fromItem.previewUrl,
        includedInPdf: false,
      }, ...prev]);
      removeLineItemAttachment(quoteNumber, id);
    } else {
      setLocalDocs((prev) => prev.map((d) => d.id === id ? { ...d, category: "quote-attachment", itemRefs: undefined } : d));
    }
    setConvertModal(null);
    toast.success("Moved to quote-level");
  };

  const handleConvertToItem = (id: string, items: ItemRef[]) => {
    const fromQuote = localDocs.find((d) => d.id === id);
    if (fromQuote && items.length) {
      /* One record per item: a line-item attachment belongs to one item,
         so a file sent to several items becomes a copy on each. */
      items.forEach((ref, i) => {
        addLineItemAttachment(quoteNumber, {
          id: items.length === 1 ? fromQuote.id : `${fromQuote.id}-${ref.id}-${i}`,
          name: fromQuote.name,
          type: fromQuote.type,
          size: fromQuote.size ?? "",
          uploadedBy: fromQuote.uploadedBy,
          uploadedAt: fromQuote.uploadedAt,
          previewUrl: fromQuote.previewUrl,
          itemId: ref.id,
          itemLabel: ref.label,
        });
      });
      setLocalDocs((prev) => prev.filter((d) => d.id !== id));
    }
    setConvertModal(null);
    toast.success(`Linked to ${items.length} item${items.length !== 1 ? "s" : ""}`);
  };

  const handleUpload = (files: FileList | null, category: DocCategory, items: ItemRef[]) => {
    if (!files || !files.length) return;
    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const newDoc: LinkedDocument = {
        id: `D${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        category,
        type: (["pdf", "xlsx", "docx", "png", "jpg", "csv"].includes(ext) ? ext : "pdf") as LinkedDocument["type"],
        size: `${Math.round(file.size / 1024)} KB`,
        uploadedBy: CURRENT_USER,
        uploadedAt: new Date().toISOString().slice(0, 10),
        itemRefs: category === "item-attachment" && items.length ? items : undefined,
        includedInPdf: false,
      };
      /* An item-attachment upload belongs in the shared store where the
         configurator will see it. Everything else is a quote-level file
         and stays in this tab's own list. */
      if (category === "item-attachment" && items.length) {
        items.forEach((ref, ri) => {
          addLineItemAttachment(quoteNumber, {
            id: items.length === 1 ? newDoc.id : `${newDoc.id}-${ri}`,
            name: newDoc.name,
            type: newDoc.type,
            size: newDoc.size ?? "",
            uploadedBy: newDoc.uploadedBy,
            uploadedAt: newDoc.uploadedAt,
            itemId: ref.id,
            itemLabel: ref.label,
          });
        });
        return;
      }
      setLocalDocs((prev) => [newDoc, ...prev]);
    });
    setShowUploadModal(false);
    toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded`);
    onAskUserChange?.("attachment_quote", "Quote Attachment", `Uploaded ${files.length} file${files.length > 1 ? "s" : ""}`);
  };

  /* handleAddLink + LinkUrlModal are gone. External URLs no longer
     live in the Attachments tab — the Deal Information tab's Links
     repository owns them, and External Notes / adjustment internal
     notes attach individual entries as chip references. */

  return (
    <div
      className="flex-1 flex flex-col min-h-0"
      style={{
        fontFamily: font,
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--elevation-xs)",
        overflow: "hidden",
      }}
    >
      {/* ── Toolbar — mirrors PI-9's attachments-tab shell (row 1 only):
          search input (left) + view-mode / density (right) +
          upload button (far right). Date/file-type/sort controls
          live in the file pane header inside FolderTreeView. */}
      <div className="flex items-center" style={{ padding: "var(--spacing-4) var(--spacing-4) var(--spacing-3)", gap: "var(--spacing-2-5)", borderBottom: "1px solid var(--border)" }}>
        <div className="relative" style={{ flex: 1, maxWidth: "320px" }}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-secondary)" }} />
          <input
            type="text"
            placeholder="Search attachments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            style={{
              height: "34px",
              paddingLeft: "34px",
              paddingRight: "12px",
              fontFamily: font,
              fontSize: "var(--text-body-sm)",
              color: "var(--foreground)",
              background: "#FFFFFF",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              boxShadow: "var(--elevation-xs)",
            }}
          />
        </div>
        <div className="ml-auto flex items-center" style={{ gap: "var(--spacing-2)" }}>
          <ViewToggle value={viewMode} onChange={setViewMode} cardSize={cardSize} onCardSizeChange={setCardSize} />
          {!readOnly && (
            <PartnerStylePrimaryCta icon={<Upload className="w-3.5 h-3.5" />} label="Upload" onClick={() => setShowUploadModal(true)} />
          )}
        </div>
      </div>

      {/* ── Layers tree ── */}
      {isLoading ? (
        <AttachmentsLoadingSkeleton />
      ) : documents.length === 0 ? (
        <EmptyPlaceholder
          block
          icon={Paperclip}
          title="No attachments yet"
          description="Supporting files attached to this quote at the document level or to individual line items."
          actionLabel={readOnly ? undefined : "Upload attachment"}
          onAction={readOnly ? undefined : () => setShowUploadModal(true)}
        />
      ) : (
        <FolderTreeView
          documents={filteredDocs}
          searchQuery={searchQuery}
          onDelete={(id) => { const t = describeDoc(id); if (t) deleteNow(t); else handleDelete(id); }}
          onRequestDelete={requestDelete}
          onConvert={handleConvert}
          onPreview={(d) => setPreviewDoc(d)}
          onRename={(d) => setRenameDoc(d)}
          readOnly={readOnly}
          viewMode={viewMode}
          cardSize={cardSize}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          customFrom={customRange.from}
          customTo={customRange.to}
          onCustomRangeChange={(from, to) => setCustomRange({ from, to })}
          visibleCategories={visibleCategories}
        />
      )}

      {/* Modals */}
      {previewDoc && (
        <AttachmentPreviewModal
          attachment={{ ...toCardData(previewDoc), source: CATEGORY_META[previewDoc.category].label }}
          onClose={() => setPreviewDoc(null)}
          immediateDelete
          onDelete={readOnly ? undefined : () => { requestDelete(previewDoc.id); setPreviewDoc(null); }}
        />
      )}

      <ConfirmationModal
        isOpen={!!pendingDelete}
        variant="red"
        icon={<Trash2 className="w-6 h-6 text-white" />}
        title={pendingDelete?.kind === "link"
          ? "Delete this link?"
          : pendingDelete?.fromItemMaster ? "Remove this file from the quote?" : "Delete this attachment?"}
        message={pendingDelete?.kind === "link"
          ? `"${pendingDelete?.name}" will be permanently removed from this quote. This action cannot be undone.`
          : pendingDelete?.fromItemMaster
            ? `"${pendingDelete?.name}" stays in the item master, so you can add it again anytime.`
            : `"${pendingDelete?.name}" will be permanently removed from the system. This action cannot be undone.`}
        confirmText={pendingDelete?.kind === "link" ? "Delete Link" : pendingDelete?.fromItemMaster ? "Remove from Quote" : "Delete Attachment"}
        cancelText="Cancel"
        onConfirm={() => { if (pendingDelete) deleteNow(pendingDelete); setPendingDelete(null); }}
        onCancel={() => setPendingDelete(null)}
      />

      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUpload}
          fileInputRef={fileInputRef}
        />
      )}


      {convertModal && (
        <ConvertScopeModal
          doc={convertModal.doc}
          direction={convertModal.direction}
          onClose={() => setConvertModal(null)}
          onConvertToQuote={handleConvertToQuote}
          onConvertToItem={handleConvertToItem}
        />
      )}

      {renameDoc && (
        <RenameAttachmentDialog
          currentName={renameDoc.name}
          onCancel={() => setRenameDoc(null)}
          onConfirm={(newName) => {
            setLocalDocs((prev) => prev.map((d) => d.id === renameDoc.id ? { ...d, name: newName } : d));
            renameLineItemAttachment(quoteNumber, renameDoc.id, newName);
            setRenameDoc(null);
            toast.success("File renamed");
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 6  UPLOAD MODAL (simplified port — keeps flow but lighter UI)
 * ═══════════════════════════════════════════════════════════════════════════ */

/* Format raw file-size bytes into a compact human-readable string
   matching the shared AttachmentCard's expected `fileSize` shape. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* Compact uploaded-file row — verbatim port of Partner's
   `AttachmentsSection` file-row chrome (see Partner Management
   `CreatePartnerModal.tsx:4216-4238`): bordered white card, file-
   type emoji on the left, filename + formatted size stacked, hover-
   revealed trash button on the right. Kept intentionally small so
   many files stack without eating vertical space in the modal. */
function StagedFileRow({ file, onRemove }: { file: File; onRemove: () => void }) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const icon = ext === "pdf" ? "📄"
    : ["xlsx", "xls", "csv"].includes(ext) ? "📊"
    : ["doc", "docx"].includes(ext) ? "📝"
    : ["png", "jpg", "jpeg", "gif"].includes(ext) ? "🖼️"
    : ["zip", "rar"].includes(ext) ? "🗜️"
    : "📎";
  return (
    <div
      className="flex items-center gap-2.5 rounded-md border border-border bg-white hover:bg-[#FAFBFC] transition-colors group"
      style={{ padding: "8px 12px" }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ fontFamily: font, fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{file.name}</p>
        <p style={{ fontFamily: font, fontSize: 11, color: "#94A3B8" }}>{formatFileSize(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
        style={{ width: 28, height: 28 }}
        aria-label="Remove file"
      >
        <Trash2 style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}

function UploadModal({ onClose, onUpload, fileInputRef }: {
  onClose: () => void;
  onUpload: (files: FileList | null, category: DocCategory, selectedItems: ItemRef[]) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [category, setCategory] = useState<DocCategory>("quote-attachment");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [staged, setStaged] = useState<FileList | null>(null);
  const [step, setStep] = useState<"upload" | "select-items">("upload");
  const [dragOver, setDragOver] = useState(false);

  const handleProceed = () => {
    if (!staged) return;
    if (category === "item-attachment") {
      setStep("select-items");
    } else {
      onUpload(staged, category, []);
    }
  };

  const handleFinalize = () => {
    if (!staged) return;
    const refs: ItemRef[] = QUOTE_LINE_ITEMS.filter((li) => selectedItems.has(li.itemNumber)).map((li) => ({ id: li.itemNumber, label: li.productName }));
    onUpload(staged, category, refs);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9998, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div
        className="flex flex-col"
        style={{ width: "min(560px, calc(100vw - 32px))", maxHeight: "80vh", background: "var(--card)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontFamily: font, fontSize: "18px", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
            {step === "upload" ? "Upload Files" : "Link to Items"}
          </h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} className="hover:bg-[var(--surface-secondary)]">
            <X size={18} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        {step === "upload" ? (
          <div className="flex flex-col" style={{ padding: "20px", gap: "16px", overflowY: "auto" }}>
            <div>
              <label style={{ fontFamily: font, fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Attachment scope</label>
              <div className="flex flex-wrap" style={{ gap: "6px" }}>
                {CATEGORY_ORDER.filter((c) => c !== "sales-order").map((c) => {
                  const isActive = category === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      style={{
                        height: "30px", padding: "0 12px", borderRadius: "9999px",
                        border: `1px solid ${isActive ? "var(--primary-600)" : "var(--border)"}`,
                        /* Unselected: white — matches Partner's
                           AttachmentsSection dropzone/pill chrome
                           (`bg-white`). Was `var(--background)` which
                           rendered as a muted grey and broke the
                           Partner-consistent white surface. */
                        background: isActive ? "var(--primary-50)" : "#FFFFFF",
                        color: isActive ? "var(--primary)" : "var(--text-secondary)",
                        fontFamily: font, fontSize: "12px", fontWeight: 500, cursor: "pointer",
                      }}
                    >
                      {CATEGORY_META[c].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                if (e.dataTransfer.files.length) setStaged(e.dataTransfer.files);
              }}
              className="flex flex-col items-center justify-center cursor-pointer transition-colors"
              style={{
                padding: "32px",
                border: `2px dashed ${dragOver ? "var(--primary)" : "var(--border)"}`,
                borderRadius: "var(--radius-md)",
                /* Resting bg white to stay consistent with Partner's
                   AttachmentsSection dropzone (`bg-white`). Only
                   drag-hover swaps to the primary-50 tint. */
                background: dragOver ? "var(--primary-50)" : "#FFFFFF",
                gap: "8px",
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={28} style={{ color: dragOver ? "var(--primary)" : "var(--text-secondary)" }} />
              <p style={{ fontFamily: font, fontSize: "13px", fontWeight: 500, color: "var(--foreground)", margin: 0 }}>
                {staged && staged.length > 0
                  ? "Click to add more files"
                  : "Click to browse or drag files here"}
              </p>
              <p style={{ fontFamily: font, fontSize: "11px", color: "var(--text-tertiary)", margin: 0 }}>
                PDF, XLSX, DOCX, PNG, JPG, CSV, ZIP
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => { if (e.target.files) setStaged(e.target.files); }}
            />

            {/* Staged files — rendered as Partner's compact
                uploaded-file rows (icon + filename + size + hover
                trash) rather than large AttachmentCard tiles. Rows
                stack densely so multiple uploads stay legible
                without dominating the modal. Row chrome is verbatim
                from Partner's `AttachmentsSection`. */}
            {staged && staged.length > 0 && (
              <div className="flex flex-col" style={{ gap: 6 }}>
                {Array.from(staged).map((file, idx) => (
                  <StagedFileRow
                    key={`${file.name}-${idx}`}
                    file={file}
                    onRemove={() => {
                      const remaining = Array.from(staged).filter((_, i) => i !== idx);
                      if (remaining.length === 0) { setStaged(null); return; }
                      const dt = new DataTransfer();
                      remaining.forEach((f) => dt.items.add(f));
                      setStaged(dt.files);
                    }}
                  />
                ))}
              </div>
            )}

            <div className="flex" style={{ gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={onClose} className="hover:bg-[var(--surface-secondary)]" style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", fontFamily: font, fontSize: 13, fontWeight: 500, color: "var(--foreground)", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={handleProceed}
                disabled={!staged}
                className="hover:bg-[#0862D0]"
                style={{ height: 36, padding: "0 16px", borderRadius: 8, border: 0, background: !staged ? "var(--muted)" : "var(--primary)", color: !staged ? "var(--muted-foreground)" : "#FFFFFF", fontFamily: font, fontSize: 13, fontWeight: 600, cursor: !staged ? "not-allowed" : "pointer" }}
              >
                {category === "item-attachment" ? "Next" : "Upload"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col" style={{ padding: "20px", gap: "12px", overflowY: "auto" }}>
            <p style={{ fontFamily: font, fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
              Select one or more line items to link these {staged?.length} file{(staged?.length || 0) > 1 ? "s" : ""} to.
            </p>
            <div className="flex flex-col" style={{ gap: 6 }}>
              {QUOTE_LINE_ITEMS.map((li) => {
                const checked = selectedItems.has(li.itemNumber);
                return (
                  /* Rich picker row — thumb + code + inventory-type
                     pill + description, mirroring the quote's line-
                     items table chrome. Unselected bg white per the
                     Partner-consistent rule. */
                  <label key={li.id} className="flex items-start cursor-pointer hover:bg-[var(--primary-50)]" style={{ padding: 10, border: `1px solid ${checked ? "var(--primary-200)" : "var(--border)"}`, borderRadius: 8, background: checked ? "var(--primary-50)" : "#FFFFFF", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(selectedItems);
                        if (e.target.checked) next.add(li.itemNumber); else next.delete(li.itemNumber);
                        setSelectedItems(next);
                      }}
                      className="accent-primary"
                      style={{ width: 16, height: 16, marginTop: 2 }}
                    />
                    <div className="shrink-0 flex items-center justify-center rounded-md border border-border" style={{ width: 32, height: 32, background: "rgba(148,163,184,0.10)" }}>
                      <Package style={{ width: 14, height: 14, color: "#94A3B8" }} />
                    </div>
                    {/* Item code + canonical inventory-type badge
                        + productName + descriptive text — mirrors
                        the quote line-items table row (see
                        `ItemsTabTableClean.tsx`). Uses the shared
                        `ItemTypeBadge` component so the pill chrome
                        is byte-identical to the table's pill (same
                        borders, tokens, font, glyphs). Description
                        is 2-line clamped so long copy doesn't blow
                        out the row height. */}
                    <div className="flex flex-col min-w-0" style={{ flex: 1, gap: 4 }}>
                      <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
                        <span style={{ fontFamily: font, fontSize: 13, fontWeight: 500, color: "var(--foreground-soft)", lineHeight: 1 }}>{li.itemNumber}</span>
                        <InactiveItemPill code={li.itemNumber} size="md" noun="quote" />
                        <ItemTypeBadge type={li.itemType} />
                      </div>
                      <p style={{ fontFamily: font, fontSize: 12, fontWeight: 500, color: "var(--foreground)", margin: 0, lineHeight: 1.35 }}>{li.productName}</p>
                      {li.description && (
                        <p
                          style={{
                            fontFamily: font,
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                            margin: 0,
                            lineHeight: 1.4,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical" as any,
                            overflow: "hidden",
                          }}
                        >
                          {li.description}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="flex" style={{ gap: 8, justifyContent: "space-between", marginTop: 4 }}>
              <button onClick={() => setStep("upload")} className="hover:bg-[var(--surface-secondary)]" style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", fontFamily: font, fontSize: 13, fontWeight: 500, color: "var(--foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={handleFinalize}
                disabled={selectedItems.size === 0}
                className="hover:bg-[#0862D0]"
                style={{ height: 36, padding: "0 16px", borderRadius: 8, border: 0, background: selectedItems.size === 0 ? "var(--muted)" : "var(--primary)", color: selectedItems.size === 0 ? "var(--muted-foreground)" : "#FFFFFF", fontFamily: font, fontSize: 13, fontWeight: 600, cursor: selectedItems.size === 0 ? "not-allowed" : "pointer" }}
              >
                Upload to {selectedItems.size} item{selectedItems.size !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 7  CONVERT SCOPE MODAL
 * (LinkUrlModal removed — external URLs now live in the Deal Info
 *  Links repository; the shared AddExternalLinkModal lives at
 *  `../shared/AddExternalLinkModal`.)
 * ═══════════════════════════════════════════════════════════════════════════ */

function ConvertScopeModal({ doc, direction, onClose, onConvertToQuote, onConvertToItem }: {
  doc: LinkedDocument;
  direction: "to-quote" | "to-item";
  onClose: () => void;
  onConvertToQuote: (id: string) => void;
  onConvertToItem: (id: string, items: ItemRef[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9998, background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div
        className="flex flex-col"
        style={{ width: "min(480px, calc(100vw - 32px))", maxHeight: "80vh", background: "var(--card)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontFamily: font, fontSize: 18, fontWeight: 600, margin: 0, color: "var(--foreground)" }}>
            {direction === "to-quote" ? "Move to Quote Level" : "Move to Item Level"}
          </h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} className="hover:bg-[var(--surface-secondary)]">
            <X size={18} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>
        <div className="flex flex-col" style={{ padding: 20, gap: 12, overflowY: "auto" }}>
          <p style={{ fontFamily: font, fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
            <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{doc.name}</span>
          </p>
          {direction === "to-quote" ? (
            <p style={{ fontFamily: font, fontSize: 13, color: "var(--foreground)", margin: 0 }}>
              This will detach the file from line items and attach it at the quote level.
            </p>
          ) : (
            <>
              <p style={{ fontFamily: font, fontSize: 13, color: "var(--foreground)", margin: 0 }}>
                Select one or more line items to link this file to.
              </p>
              <div className="flex flex-col" style={{ gap: 6 }}>
                {QUOTE_LINE_ITEMS.map((li) => {
                  const checked = selected.has(li.itemNumber);
                  return (
                    <label key={li.id} className="flex items-center cursor-pointer hover:bg-[var(--primary-50)]" style={{ padding: 10, border: `1px solid ${checked ? "var(--primary-200)" : "var(--border)"}`, borderRadius: 8, background: checked ? "var(--primary-50)" : "var(--background)", gap: 10 }}>
                      <input
                        type="checkbox" checked={checked}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(li.itemNumber); else next.delete(li.itemNumber);
                          setSelected(next);
                        }}
                        style={{ width: 16, height: 16 }}
                      />
                      <div className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{li.itemNumber}</span>
                        <span style={{ fontFamily: font, fontSize: 11, color: "var(--text-tertiary)" }}>{li.productName}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
          <div className="flex" style={{ gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={onClose} className="hover:bg-[var(--surface-secondary)]" style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", fontFamily: font, fontSize: 13, fontWeight: 500, color: "var(--foreground)", cursor: "pointer" }}>
              Cancel
            </button>
            <button
              onClick={() => {
                if (direction === "to-quote") onConvertToQuote(doc.id);
                else {
                  const refs: ItemRef[] = QUOTE_LINE_ITEMS.filter((li) => selected.has(li.itemNumber)).map((li) => ({ id: li.itemNumber, label: li.productName }));
                  onConvertToItem(doc.id, refs);
                }
              }}
              disabled={direction === "to-item" && selected.size === 0}
              className="hover:bg-[#0862D0]"
              style={{
                height: 36, padding: "0 16px", borderRadius: 8, border: 0,
                background: (direction === "to-item" && selected.size === 0) ? "var(--muted)" : "var(--primary)",
                color: (direction === "to-item" && selected.size === 0) ? "var(--muted-foreground)" : "#FFFFFF",
                fontFamily: font, fontSize: 13, fontWeight: 600,
                cursor: (direction === "to-item" && selected.size === 0) ? "not-allowed" : "pointer",
              }}
            >
              {direction === "to-quote" ? "Move" : `Link to ${selected.size} item${selected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Initial number of attachments a quote shows when the details page
   first mounts. Mirrors the local seed in AttachmentsTab: empty for
   newly-created quotes, otherwise the mock catalogue. Exported so the
   QuoteDetails tab badge stays in lockstep with what the tab content
   actually renders on first load. */
export function getInitialQuoteAttachmentsCount(isNewlyCreated: boolean): number {
  return isNewlyCreated ? 0 : MOCK_DOCUMENTS.length;
}

/* Files marked Include in PDF, for the Print window's page count. */
function toPrintable(docs: LinkedDocument[]): PrintableAttachment[] {
  return docs.filter((d) => d.includedInPdf).map((d) => ({ kind: d.type, size: d.size }));
}

/** The quote's PDF-bound attachments: the tab's live list once it has
 *  been opened, otherwise the same seed the tab starts from. */
export function getQuotePrintAttachments(quoteNumber: string, isNewlyCreated = false): PrintableAttachment[] {
  return getPublishedPrintAttachments(quoteNumber) ?? (isNewlyCreated ? [] : toPrintable(MOCK_DOCUMENTS));
}
