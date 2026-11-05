/**
 * AttachmentsTab — Sales Order Detail
 * ────────────────────────────────────────────────────────────────────────────
 * Same 3-column Layers/folder-tree structure as the Quote Detail Attachments
 * tab — only the category set differs ("sources" for an SO are Pre-Sales,
 * SO Documents, Fulfillment, Invoices, Item Attachments, External Links).
 */

import React, { useState, useRef, useEffect, useMemo, useCallback, useSyncExternalStore } from "react";
import * as poItemAttachments from "../poItemAttachmentsStore";
import { MOCK_ATTACHMENTS as ITEM_LIBRARY } from "../attachments/AttachmentsTab";
import {
  Search,
  Upload,
  Link2,
  Layers,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
  FileText,
  FileImage,
  Package,
  Paperclip,
  ArrowRightLeft,
  X,
  ClipboardList,
  Truck,
  Receipt,
  ThumbsDown,
  Eye,
  Pencil,
  Check,
  MoreVertical,
  Trash2,
  File as FileIco,
  FileSpreadsheet,
  FileArchive,
  ListFilter,
  ArrowDownUp,
} from "lucide-react";
import { AttachmentCard, RenameAttachmentDialog, THUMB_GRID_COLUMNS, type AttachmentCardData } from "../shared/attachments/attachment-card";
import { AttachmentPreviewModal } from "../shared/attachments/attachment-preview-modal";
import { EmptyPlaceholder } from "../shared/EmptyPlaceholder";
import { DatePicker } from "../ui/date-picker";
import {
  FilterModalShell,
  Pill as FilterModalPill,
  Section as FilterModalSection,
} from "@/app/components/shared/filterModal";
import { toast } from "sonner";
import type { Attachment, SOLine, AttachmentCategory, FileKind } from "./types";
import {
  getPreSoDocs,
  subscribePreSoDocs,
  type PreSoDocument,
} from "./preSoDocsStore";

const font = "var(--font-inter)";

/* ═══════════════════════════════════════════════════════════════════════════
 * § 0  EXTENDED TYPES — local-only for this tab
 *   External links used to live here as a synthetic "external-link"
 *   category; they now live in the Deal Information tab's Links
 *   repository (`linksRepository`) and are attached to External Notes
 *   / adjustment internal notes as chip references. The `SOSource`
 *   alias is kept for back-compat but no longer includes external-link.
 * ═══════════════════════════════════════════════════════════════════════════ */

type SOSource = AttachmentCategory;

/* Legacy shape kept only so the tab's internal plumbing that used to
   render link rows still typechecks — the state array itself now
   seeds empty and never grows because the Add External URL button and
   its modal have been removed. Real link storage moved to the shared
   linksRepository consumed by the Deal Information tab. */
interface UrlLink {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
  date: string;
}

const CURRENT_USER = "Sarah Chen";
const EMPTY_PICKED: Array<{ lineItemId: string; attId: string }> = [];

const CATEGORY_META: Record<SOSource, { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  "pre-sales":     { label: "Pre-Sales (RFQ/RFP)",   color: "var(--reason-tag-text)",     bg: "var(--reason-tag-bg)",      border: "var(--reason-tag-border)",      icon: ClipboardList },
  "so-docs":       { label: "PO Attachments",         color: "hsl(var(--primary))",              bg: "var(--primary-50)",          border: "var(--primary-200)",            icon: FileText },
  "fulfillment":   { label: "Fulfillment & Shipping", color: "var(--status-active-text)",  bg: "var(--status-active-bg)",    border: "var(--status-active-border)",   icon: Truck },
  "invoices":      { label: "Invoices & Financial",   color: "var(--tx-type-negative-text)", bg: "var(--tx-type-negative-bg)", border: "var(--tx-type-negative-border)", icon: Receipt },
  "item":          { label: "Item Attachments",       color: "var(--checked-out-tag-text)", bg: "var(--checked-out-tag-bg)",  border: "var(--checked-out-tag-border)", icon: Package },
  "rejection":     { label: "Rejection Attachments",  color: "#991B1B",                     bg: "rgba(220, 38, 38, 0.10)",    border: "rgba(220, 38, 38, 0.22)",       icon: ThumbsDown },
};

const CATEGORY_ORDER: SOSource[] = ["so-docs", "item"];

/* ── Uploading card (shimmer placeholder) — ported from Cycle-Count-Web's
 *    attachment-views.tsx `UploadingCard`. Renders in place of a real
 *    AttachmentCard while `att.uploading === true`; when progress hits
 *    100 the parent flips uploading off and the normal card renders. */
function POUploadingCard({ fileName, fileSize, ext, progress, onCancel, thumbHeight = "clamp(100px, 12vw, 180px)" }: { fileName: string; fileSize: string; ext: string; progress: number; onCancel: () => void; thumbHeight?: string }) {
  const clamped = Math.min(100, Math.max(0, progress));
  return (
    <div className="relative flex flex-col overflow-hidden" style={{ minWidth: 0, borderRadius: "var(--radius-lg)", background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "var(--elevation-xs)" }}>
      <div className="relative shrink-0 w-full flex items-center justify-center overflow-hidden" style={{ height: thumbHeight, borderTopLeftRadius: "calc(var(--radius-lg) - 1px)", borderTopRightRadius: "calc(var(--radius-lg) - 1px)", background: "linear-gradient(110deg, var(--surface-secondary) 8%, hsl(210,16%,93%) 18%, var(--surface-secondary) 33%)", backgroundSize: "200% 100%", animation: "poAttUploadShimmer 1.2s linear infinite" }}>
        <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute", inset: 0 }}>
            <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
            <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - clamped / 100)} style={{ transformOrigin: "center", transform: "rotate(-90deg)", transition: "stroke-dashoffset 160ms linear" }} />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--primary))", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{Math.round(clamped)}%</span>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onCancel(); }} aria-label="Cancel upload" className="absolute flex items-center justify-center" style={{ top: 6, right: 6, width: 22, height: 22, borderRadius: 999, background: "rgba(255,255,255,0.95)", border: "1px solid hsl(var(--border))", cursor: "pointer", color: "var(--text-secondary)", boxShadow: "0 1px 2px rgba(16,24,40,0.10)" }}>
          <X size={12} />
        </button>
      </div>
      <div className="flex flex-col" style={{ padding: "var(--spacing-2) var(--spacing-2-5)", gap: 4 }}>
        <div aria-hidden style={{ height: 14, width: `${60 + ((fileName.length * 7) % 30)}%`, maxWidth: "100%", borderRadius: 4, background: "linear-gradient(110deg, var(--surface-secondary) 8%, hsl(210,16%,93%) 18%, var(--surface-secondary) 33%)", backgroundSize: "200% 100%", animation: "poAttUploadShimmer 1.2s linear infinite" }} />
        <div aria-hidden style={{ height: 11, width: 56, borderRadius: 4, background: "linear-gradient(110deg, var(--surface-secondary) 8%, hsl(210,16%,93%) 18%, var(--surface-secondary) 33%)", backgroundSize: "200% 100%", animation: "poAttUploadShimmer 1.2s linear infinite" }} />
        <span aria-hidden style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-inter)" }}>{fileSize} · {ext}</span>
      </div>
      <style>{`@keyframes poAttUploadShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

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

function attToCardData(a: Attachment): AttachmentCardData {
  return {
    fileName: a.name,
    fileType: a.fileKind === "doc" ? "docx" : a.fileKind === "sheet" ? "xlsx" : a.fileKind,
    fileSize: a.size,
    uploadedDate: a.date,
    uploadedTime: "",
    uploadedBy: a.uploadedBy,
    previewUrl: a.previewUrl ?? null,
  };
}

function urlToCardData(u: UrlLink): AttachmentCardData {
  return {
    fileName: u.name,
    fileType: "url",
    fileSize: "",
    uploadedDate: u.date,
    uploadedTime: "",
    uploadedBy: u.uploadedBy,
    externalUrl: u.url,
  };
}

function formatTotalSize(items: Attachment[]): string {
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
 * § 2  CTAs (partner-style)
 * ═══════════════════════════════════════════════════════════════════════════ */

function PartnerStyleSecondaryCta({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border bg-white inline-flex items-center transition-all duration-200 cursor-pointer shadow-sm hover:bg-slate-50"
      style={{ height: "36px", padding: "0 14px", gap: "6px", fontSize: "13px", fontWeight: 500, color: "hsl(var(--foreground))", borderColor: "hsl(var(--border))", fontFamily: font }}
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
      style={{ height: "36px", padding: "0 16px", gap: "6px", fontSize: "13px", fontWeight: 600, fontFamily: font }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 3  PILLS
 * ═══════════════════════════════════════════════════════════════════════════ */

function CardSourcePill({ category }: { category: SOSource }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center"
      style={{
        padding: "1px 6px", borderRadius: "9999px",
        background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color,
        fontFamily: font, fontWeight: 500, fontSize: "9px", gap: "3px", whiteSpace: "nowrap", backdropFilter: "blur(4px)",
      }}
    >
      <Icon size={9} />
      {meta.label.replace(" Documents", "").replace(" & Shipping", "").replace(" & Financial", "").replace(" Attachments", "")}
    </span>
  );
}

function CardLineItemPill({ line }: { line: SOLine }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        padding: "1px 6px", borderRadius: "9999px",
        background: "rgba(255,255,255,0.92)", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))",
        fontFamily: font, fontWeight: 500, fontSize: "9px", gap: "3px",
        maxWidth: "120px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", backdropFilter: "blur(4px)",
      }}
      title={line.itemName}
    >
      <Package size={9} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{line.itemCode}</span>
    </span>
  );
}

function CardShipmentPill({ shipmentId }: { shipmentId: string }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        padding: "1px 6px", borderRadius: "9999px",
        background: "rgba(255,255,255,0.92)", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))",
        fontFamily: font, fontWeight: 500, fontSize: "9px", gap: "3px", whiteSpace: "nowrap", backdropFilter: "blur(4px)",
      }}
    >
      <Truck size={9} />
      {shipmentId}
    </span>
  );
}

function CardInOrderPill() {
  return (
    <span
      className="inline-flex items-center"
      style={{
        padding: "1px 6px", borderRadius: "9999px",
        background: "var(--primary-50)", border: "1px solid var(--primary-200)", color: "var(--primary-700)",
        fontFamily: font, fontWeight: 500, fontSize: "9px", gap: "3px", whiteSpace: "nowrap", backdropFilter: "blur(4px)",
      }}
      title="This file is referenced in the Order PDF — customer will see it"
    >
      <Eye size={9} />
      In Order PDF
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 3.5  DATE FILTER DROPDOWN + VIEW TOGGLE
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

/* Inline date-range dropdown — port of Physical Inventory's
 * `DateRangePresetDropdown` (attachments-tab.tsx:2388). Presets in the
 * top pane; picking Custom Date slides in a From / To sub-view backed
 * by the shared `DatePicker`. Kept behaviourally identical to Quote's
 * AttachmentsTab so both modules read the same. */
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
            background: "hsl(var(--card))",
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
                    color: isActive ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(210,100%,96%)"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  {opt.key === "custom" && <Calendar size={13} style={{ color: isActive ? "hsl(var(--primary))" : "var(--text-tertiary)", flexShrink: 0 }} />}
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
                <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-label)", color: "hsl(var(--foreground))" }}>
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
                    background: customFrom || customTo ? "hsl(var(--primary))" : "hsl(var(--muted))",
                    color: customFrom || customTo ? "#FFFFFF" : "hsl(var(--muted-foreground))",
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

const CARD_SIZE_COLUMNS: Record<CardSize, string> = {
  large:  "repeat(auto-fill, minmax(300px, 1fr))",
  medium: "repeat(auto-fill, minmax(210px, 1fr))",
  small:  "repeat(auto-fill, minmax(150px, 1fr))",
};

/* Format raw date strings into the "25 Feb 2026, 9:42 am" form used in the
 * Physical Inventory listing. Accepts MM/DD, MM/DD/YYYY, YYYY-MM-DD, or any
 * Date-parseable string. Falls back to the original input on any parse failure. */
const MONTH_ABBR_LIST = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function formatDateShort(raw: string): string {
  if (!raw) return "";
  const s = raw.trim();
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
          border: "1px solid hsl(var(--border))", background: "hsl(var(--card))",
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
            borderRadius: "var(--radius-md)", border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
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
                  <span style={{ fontWeight: 600, fontSize: "13px", color: "hsl(var(--foreground))", lineHeight: 1.2 }}>{opt.label}</span>
                  <span style={{ fontWeight: 400, fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.2 }}>{opt.description}</span>
                </div>
                {isActive && <Check size={14} style={{ color: "hsl(var(--primary))", flexShrink: 0 }} />}
              </button>
            );
          })}
          {value === "card" && (
            <>
              <div style={{ borderTop: "1px solid hsl(var(--border))", margin: "6px 4px" }} />
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
                          border: `1px solid ${active ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
                          background: active ? "var(--primary-50)" : "hsl(var(--card))",
                          color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
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

function filterByDateRange<T extends { date: string }>(
  items: T[],
  range: DateRangeKey,
  customFrom?: string,
  customTo?: string,
): T[] {
  if (range === "all") return items;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const parseItemDate = (raw: string) => {
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})/);
    if (!m) return null;
    return new Date(today.getFullYear(), parseInt(m[1], 10) - 1, parseInt(m[2], 10));
  };
  if (range === "custom") {
    if (!customFrom && !customTo) return items;
    const fromDate = customFrom ? new Date(customFrom + "T00:00:00") : null;
    const toDate = customTo ? new Date(customTo + "T23:59:59") : null;
    return items.filter((it) => {
      const d = parseItemDate(it.date);
      if (!d) return true;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }
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
  // SO date format is "MM/DD" without year — assume current year for filtering
  return items.filter((it) => {
    const d = parseItemDate(it.date);
    if (!d) return true;
    return d >= cutoff;
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 3.6  SORT + FILE-TYPE DROPDOWNS — verbatim ports of PI-9's
 *        `TxSortDropdown` (attachments-tab.tsx:1002) and
 *        `FileTypeDropdown` (line 1100). 28px height, 96/140px widths,
 *        primary-50 active row bg, primary-foreground active text.
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
        <div className="absolute z-50 border border-border" style={{ top: "calc(100% + 3px)", left: 0, minWidth: "110px", borderRadius: "var(--radius-md)", background: "hsl(var(--card))", boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)", padding: "var(--spacing-0-5)" }}>
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
                  color: isActive ? "hsl(var(--primary))" : "hsl(var(--foreground))",
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
        <div className="absolute z-50 border border-border" style={{ top: "calc(100% + 3px)", left: 0, minWidth: "130px", maxHeight: "260px", overflowY: "auto", borderRadius: "var(--radius-md)", background: "hsl(var(--card))", boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)", padding: "var(--spacing-0-5)" }}>
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
                  color: isActive ? "hsl(var(--primary))" : "hsl(var(--foreground))",
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
 *        `AttachmentsLoadingSkeleton` (attachments-tab.tsx:1986).
 * ═══════════════════════════════════════════════════════════════════════════ */

/* Highlight endpoint uses --skeleton-highlight (a solid color literal
   defined in PO's index.css) instead of --background — PO's
   --background token is a raw HSL fragment, which makes color-mix()
   silently fail and flattens the shimmer. */
const skeletonPulse: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--surface-secondary) 25%, var(--skeleton-highlight) 50%, var(--surface-secondary) 75%)",
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
        <div className="shrink-0 flex flex-col" style={{ width: "210px", borderRight: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}>
          <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2)", borderBottom: "1px solid hsl(var(--border))", height: "42px", boxSizing: "border-box", gap: "var(--spacing-1-5)" }}>
            <SkeletonBlock width={13} height={13} style={{ borderRadius: "3px" }} />
            <SkeletonBlock width={52} height={11} />
          </div>
          <div className="flex flex-col" style={{ padding: "var(--spacing-2) var(--spacing-1-5)", gap: "var(--spacing-1)" }}>
            <SkeletonBlock width="100%" height={32} style={{ borderRadius: "var(--radius-sm)" }} />
            <div style={{ height: "1px", background: "hsl(var(--border))", margin: "var(--spacing-0-5) var(--spacing-0-5)" }} />
            {[0.85, 0.72, 0.68, 0.78, 0.6, 0.55].map((w, i) => (
              <SkeletonBlock key={i} width={`${w * 100}%`} height={32} style={{ borderRadius: "var(--radius-sm)" }} />
            ))}
          </div>
        </div>
        <div className="shrink-0 flex flex-col" style={{ width: "210px", borderRight: "1px solid hsl(var(--border))", background: "var(--surface-secondary)" }}>
          <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2)", borderBottom: "1px solid hsl(var(--border))", height: "42px", boxSizing: "border-box", gap: "var(--spacing-1-5)" }}>
            <SkeletonBlock width={72} height={11} />
            <SkeletonBlock width={16} height={16} style={{ borderRadius: "9999px" }} />
          </div>
          <div style={{ padding: "var(--spacing-1-5) var(--spacing-2)", borderBottom: "1px solid hsl(var(--border))" }}>
            <SkeletonBlock width="100%" height={28} style={{ borderRadius: "var(--radius-sm)" }} />
          </div>
          <div style={{ padding: "var(--spacing-1) var(--spacing-1-5)", borderBottom: "1px solid color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
            <SkeletonBlock width="70%" height={32} style={{ borderRadius: "var(--radius-sm)" }} />
          </div>
          <div className="flex flex-col" style={{ padding: "var(--spacing-1-5) var(--spacing-1-5)", gap: "var(--spacing-1)" }}>
            {[0.9, 0.82, 0.88, 0.75, 0.92].map((w, i) => (
              <SkeletonBlock key={i} width={`${w * 100}%`} height={32} style={{ borderRadius: "var(--radius-sm)" }} />
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2) var(--spacing-3)", borderBottom: "1px solid hsl(var(--border))", height: "42px", boxSizing: "border-box", gap: "var(--spacing-1-5)" }}>
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
                  borderBottom: "1px solid color-mix(in srgb, hsl(var(--border)) 50%, transparent)",
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

/* Inline 36×36 thumbnail with type-tinted bg + lucide icon + tiny extension
   badge — verbatim port of Physical Inventory's `InlineThumbnail`. */
const THUMB_BG: Record<string, { bg: string; color: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  pdf:  { bg: "var(--tx-type-negative-bg)", color: "var(--tx-type-negative-text)", Icon: FileText },
  xlsx: { bg: "var(--status-active-bg)",    color: "var(--status-active-text)",    Icon: FileSpreadsheet },
  csv:  { bg: "var(--status-active-bg)",    color: "var(--status-active-text)",    Icon: FileSpreadsheet },
  doc:  { bg: "var(--primary-50)",          color: "hsl(var(--primary))",                Icon: FileText },
  docx: { bg: "var(--primary-50)",          color: "hsl(var(--primary))",                Icon: FileText },
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
      style={{ width: 36, height: 36, borderRadius: 6, background: tb.bg, border: "1px solid hsl(var(--border))" }}
    >
      <Ico size={16} style={{ color: tb.color, flexShrink: 0 }} />
      <span
        className="absolute"
        style={{
          bottom: 1, right: 1, padding: "0px 2px", borderRadius: 2,
          background: "rgba(255,255,255,0.85)", border: "1px solid hsl(var(--border))",
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
   `density` prop controls the row vertical padding so Condensed reads
   tight and Comfort reads spacious (Physical Inventory pattern). */
function FileListRow({
  name, type, size, date, uploadedBy, searchQuery, density = "comfort",
  onClick, onDelete, onPreview, onDownload, onRename, onTogglePdf, onConvertToOrder, onConvertToItem,
  isUrl, includedInPdf, canConvertToOrder, canConvertToItem,
}: {
  name: string; type: string; size: string; date: string; uploadedBy: string;
  searchQuery: string; density?: "condensed" | "comfort";
  onClick: () => void;
  onDelete?: () => void;
  onPreview?: () => void;
  onDownload?: () => void;
  onRename?: () => void;
  onTogglePdf?: () => void;
  onConvertToOrder?: () => void;
  onConvertToItem?: () => void;
  isUrl?: boolean;
  includedInPdf?: boolean;
  canConvertToOrder?: boolean;
  canConvertToItem?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);
  const tb = (() => {
    switch (type) {
      case "pdf":  return { color: "var(--tx-type-negative-text)", bg: "var(--tx-type-negative-bg)" };
      case "xlsx":
      case "csv":
      case "sheet": return { color: "var(--status-active-text)", bg: "var(--status-active-bg)" };
      case "doc":
      case "docx": return { color: "hsl(var(--primary))", bg: "var(--primary-50)" };
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
      onClick={onClick}
      style={{
        // Condensed: tight 7px vertical pad. Comfort: 12px (spacious) — PI chrome.
        padding: density === "condensed" ? "7px 16px" : "12px 16px",
        borderBottom: "1px solid color-mix(in srgb, hsl(var(--border)) 50%, transparent)",
        background: hovered ? "var(--primary-50)" : "transparent",
        fontFamily: font,
        columnGap: 2,
      }}
    >
      <div className="flex items-center min-w-0" style={{ flex: 1, gap: 10 }}>
        {/* InlineThumbnail — verbatim Physical Inventory chrome. */}
        <InlineThumbnail type={type} />
        <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))", lineHeight: 1.3 }} title={name}>
          <HighlightText text={name} query={searchQuery} />
        </span>
      </div>
      <span className="shrink-0" style={{ width: 70, textAlign: "left", fontSize: 12, color: "var(--text-secondary)" }}>{size || "—"}</span>
      <span className="shrink-0" style={{ width: 150, textAlign: "left", fontSize: 12, color: "var(--text-tertiary)" }}>{formatDateShort(date)}</span>
      <div className="shrink-0 flex items-center min-w-0" style={{ width: 140, gap: 8 }}>
        <UploaderAvatar name={uploadedBy} size={20} />
        <span className="truncate" style={{ fontSize: 12, color: "hsl(var(--foreground))" }} title={uploadedBy}>{uploadedBy}</span>
      </div>
      {/* Three-dots hover menu — Preview / Delete actions matching the
          card view's three-dots (Physical Inventory pattern). */}
      <div ref={menuRef} className="relative shrink-0" style={{ width: 36, display: "flex", justifyContent: "center" }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((p) => !p); }}
          style={{
            width: 24, height: 24, borderRadius: 4, cursor: "pointer", border: "none",
            background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
            opacity: hovered || menuOpen ? 1 : 0, transition: "opacity 0.1s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary-50)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <MoreVertical size={14} style={{ color: "var(--text-secondary)" }} />
        </button>
        {menuOpen && (
          // Same menu structure as `AttachmentCard` so the listing and
          // card views expose identical actions in the same order.
          <div className="absolute z-50 border border-border" style={{ top: "calc(100% + 2px)", right: 0, minWidth: 200, borderRadius: 8, background: "hsl(var(--card))", boxShadow: "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)", padding: 4 }}>
            {onPreview && (
              <FileMenuItem
                icon={isUrl ? <ExternalLink size={13} /> : <Eye size={13} />}
                label={isUrl ? "Open Link" : "Preview"}
                onClick={() => { setMenuOpen(false); onPreview(); }}
              />
            )}
            {!isUrl && onDownload && (
              <FileMenuItem icon={<FileIco size={13} />} label="Download" onClick={() => { setMenuOpen(false); onDownload(); }} />
            )}
            {onTogglePdf && (
              <>
                <FileMenuDivider />
                <FileMenuItem
                  icon={<FileText size={13} />}
                  label={includedInPdf ? "Remove from Order PDF" : "Reference in Order PDF"}
                  onClick={() => { setMenuOpen(false); onTogglePdf(); }}
                />
              </>
            )}
            {canConvertToOrder && onConvertToOrder && (
              <>
                <FileMenuDivider />
                <FileMenuItem icon={<ArrowRightLeft size={13} />} label="Move to Order Level" onClick={() => { setMenuOpen(false); onConvertToOrder(); }} />
              </>
            )}
            {onDelete && (
              <>
                <FileMenuDivider />
                <FileMenuItem icon={<Trash2 size={13} />} label="Delete" destructive onClick={() => { setMenuOpen(false); onDelete(); }} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* Hairline divider used between menu sections — matches `AttachmentCard`
   menu so list and card menus visually pair. */
function FileMenuDivider() {
  return <div style={{ height: 1, margin: "4px 6px", background: "hsl(var(--border))" }} />;
}

/* Tiny menu item — used by FileListRow's three-dots menu so the menu
   structure mirrors `AttachmentCard`'s (Partner-style hoverable). */
function FileMenuItem({ icon, label, onClick, destructive }: { icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center w-full transition-colors"
      style={{
        height: 30, padding: "0 10px", borderRadius: 6, cursor: "pointer", border: "none",
        background: "transparent", gap: 8, fontFamily: font, fontWeight: 500, fontSize: 12,
        color: destructive ? "hsl(var(--destructive))" : "hsl(var(--foreground))", textAlign: "left",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = destructive ? "rgba(220,38,38,0.08)" : "var(--primary-50)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ display: "flex", color: destructive ? "hsl(var(--destructive))" : "var(--text-secondary)" }}>{icon}</span>
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 4  LAYERS TREE
 * ═══════════════════════════════════════════════════════════════════════════ */

type SourceScope = "all" | SOSource;
/* File-type categories shown in the middle column for non-item scopes.
   Mirrors the Physical Inventory Item Library treatment so the SO
   attachments tab reads the same as Quote / PI. */
type FileCategory = "all" | "documents" | "photos" | "videos" | "audio";
const SO_FILE_CAT_DOCS: FileKind[] = ["pdf", "xlsx", "doc", "csv", "sheet", "cfg", "dxf", "stl", "dwg"];
const SO_FILE_CAT_PHOTOS: FileKind[] = ["png", "jpg"];
const SO_FILE_CAT_VIDEOS: FileKind[] = ["mp4"];
const SO_FILE_CAT_AUDIO: FileKind[] = ["mp3"];
function soMatchesFileCategory(fileKind: FileKind, cat: FileCategory): boolean {
  if (cat === "all") return true;
  if (cat === "documents") return SO_FILE_CAT_DOCS.includes(fileKind);
  if (cat === "photos") return SO_FILE_CAT_PHOTOS.includes(fileKind);
  if (cat === "videos") return SO_FILE_CAT_VIDEOS.includes(fileKind);
  if (cat === "audio") return SO_FILE_CAT_AUDIO.includes(fileKind);
  return true;
}

function FolderTreeView({
  attachments,
  links,
  lines,
  searchQuery,
  onToggleInOrder,
  onDelete,
  onConvert,
  onPreview,
  onPreviewLink,
  onDeleteLink,
  onRename,
  onRenameLink,
  viewMode,
  cardSize,
  dateRange,
  onDateRangeChange,
  customFrom,
  customTo,
  onCustomRangeChange,
  visibleCategories,
  onContextChange,
}: {
  attachments: Attachment[];
  links: UrlLink[];
  lines: SOLine[];
  searchQuery: string;
  onToggleInOrder: (id: string) => void;
  onDelete: (id: string) => void;
  onConvert: (att: Attachment, direction: "to-order" | "to-item") => void;
  onPreview: (att: Attachment) => void;
  onPreviewLink: (link: UrlLink) => void;
  onDeleteLink: (id: string) => void;
  onRename: (att: Attachment) => void;
  onRenameLink: (link: UrlLink) => void;
  /* Lifted from AttachmentsTab so the top toolbar owns the density
     control (matches PI-9's layout). */
  viewMode: ViewMode;
  cardSize: CardSize;
  /* Date range is rendered as a file-pane header dropdown here, but
     filtering happens upstream in AttachmentsTab so pill counts stay
     in sync. Pass through raw so the dropdown can write it back. */
  dateRange: DateRangeKey;
  onDateRangeChange: (v: DateRangeKey) => void;
  /* Custom-range endpoints (ISO YYYY-MM-DD, empty when unused).
     Lifted so the parent filter + dropdown sub-view share one truth. */
  customFrom: string;
  customTo: string;
  onCustomRangeChange: (from: string, to: string) => void;
  /* Category rows the sources sidebar should render, gated by SO
     status upstream so a pre-Cleared SO never surfaces Invoices, and a
     pre-shipment SO never surfaces Fulfillment. */
  visibleCategories: SOSource[];
  /* Report scope+drill-in up so the toolbar's Upload button can route
     new files to the right bucket (PO-level vs specific line item). */
  onContextChange?: (ctx: { scope: SourceScope; itemDrillIn: string | null }) => void;
}) {
  const [scope, setScope] = useState<SourceScope>("all");
  const [itemDrillIn, setItemDrillIn] = useState<string | null>(null);
  useEffect(() => {
    onContextChange?.({ scope, itemDrillIn });
  }, [scope, itemDrillIn, onContextChange]);
  const [fileCategory, setFileCategory] = useState<FileCategory>("all");
  /* File pane header controls — ported from PI-9 (attachments-tab
     lines 1688-1689). Live inside the tree since they affect only
     the right pane. */
  const [fileSortMode, setFileSortMode] = useState<SortMode>("latest");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");

  const counts = useMemo(() => {
    const c: Record<SourceScope, number> = {
      "all": attachments.length + links.length,
      "so-docs": 0, "item": 0, "pre-sales": 0, "fulfillment": 0, "invoices": 0, "rejection": 0,
      "external-link": links.length,
    };
    attachments.forEach((a) => { c[a.category]++; });
    return c;
  }, [attachments, links]);

  const itemGroups = useMemo(() => {
    const map = new Map<string, { line: SOLine; docs: Attachment[] }>();
    for (const li of lines) {
      const docs = attachments.filter((a) => a.category === "item" && a.lineItemId === li.id);
      if (docs.length) map.set(li.id, { line: li, docs });
    }
    return Array.from(map.values());
  }, [attachments, lines]);

  const rightPaneItems = useMemo<Array<{ kind: "att"; att: Attachment } | { kind: "url"; link: UrlLink }>>(() => {
    let base: Array<{ kind: "att"; att: Attachment } | { kind: "url"; link: UrlLink }>;
    if (scope === "all") {
      base = [
        ...attachments.map((a) => ({ kind: "att" as const, att: a })),
        ...links.map((l) => ({ kind: "url" as const, link: l })),
      ];
    } else if (scope === "external-link") {
      base = links.map((l) => ({ kind: "url" as const, link: l }));
    } else if (scope === "item") {
      let docs = attachments.filter((a) => a.category === "item");
      if (itemDrillIn && itemDrillIn !== "all") docs = docs.filter((a) => a.lineItemId === itemDrillIn);
      base = docs.map((a) => ({ kind: "att" as const, att: a }));
    } else {
      base = attachments
        .filter((a) => a.category === scope)
        .map((a) => ({ kind: "att" as const, att: a }));
    }
    /* Item scope keeps its own drill-in flow and uses the full file
       list. Every other scope honours the middle-column file-category
       filter so the user can scope to documents / photos / etc. */
    if (scope !== "item") {
      base = base.filter((entry) => {
        if (entry.kind === "url") return fileCategory === "all";
        return soMatchesFileCategory(entry.att.fileKind, fileCategory);
      });
    }
    /* File pane header FileTypeDropdown filter — applied after the
       middle-column file-category filter so the two compose. */
    if (fileTypeFilter !== "all") {
      base = base.filter((entry) => {
        if (entry.kind === "url") return false;
        return entry.att.fileKind === fileTypeFilter;
      });
    }
    /* File pane header SortDropdown */
    const dateOf = (e: typeof base[number]) => e.kind === "att" ? e.att.date : e.link.date;
    const cmp = (a: typeof base[number], b: typeof base[number]): number =>
      fileSortMode === "latest"
        ? (dateOf(b) || "").localeCompare(dateOf(a) || "")
        : (dateOf(a) || "").localeCompare(dateOf(b) || "");
    return [...base].sort(cmp);
  }, [scope, itemDrillIn, fileCategory, fileTypeFilter, fileSortMode, attachments, links]);

  /* Extensions available in the current pane — feeds FileTypeDropdown. */
  const availableExts = useMemo(() => {
    const set = new Set<string>();
    rightPaneItems.forEach((e) => { if (e.kind === "att") set.add(e.att.fileKind); });
    return Array.from(set).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightPaneItems.length, fileTypeFilter]);
  useEffect(() => {
    if (fileTypeFilter !== "all" && !availableExts.includes(fileTypeFilter)) {
      setFileTypeFilter("all");
    }
  }, [availableExts, fileTypeFilter]);

  const rightPaneAtts = rightPaneItems.filter((x) => x.kind === "att").map((x) => (x as { att: Attachment }).att);

  /* File-category counts computed off the unfiltered scope base so the
     badges always reflect what's available in this scope, not what the
     active category filter currently shows. */
  const fileCategoryCounts = useMemo(() => {
    let scopeAtts: Attachment[];
    let scopeUrls: UrlLink[];
    if (scope === "all") {
      scopeAtts = attachments;
      scopeUrls = links;
    } else if (scope === "external-link") {
      scopeAtts = [];
      scopeUrls = links;
    } else if (scope === "item") {
      scopeAtts = attachments.filter((a) => a.category === "item");
      scopeUrls = [];
    } else {
      scopeAtts = attachments.filter((a) => a.category === scope);
      scopeUrls = [];
    }
    return {
      all: scopeAtts.length + scopeUrls.length,
      documents: scopeAtts.filter((a) => SO_FILE_CAT_DOCS.includes(a.fileKind)).length,
      photos: scopeAtts.filter((a) => SO_FILE_CAT_PHOTOS.includes(a.fileKind)).length,
      videos: scopeAtts.filter((a) => SO_FILE_CAT_VIDEOS.includes(a.fileKind)).length,
      audio: scopeAtts.filter((a) => SO_FILE_CAT_AUDIO.includes(a.fileKind)).length,
    };
  }, [scope, attachments, links]);

  const handleScopeChange = useCallback((s: SourceScope) => {
    setScope(s);
    setItemDrillIn(s === "item" ? "all" : null);
    setFileCategory("all");
  }, []);

  return (
    <div className="flex flex-1 min-h-0">
      {/* COL 1 — Sources sidebar
          210px width; uses `hsl(var(--card))` (pure white) rather than
          `hsl(var(--background))` because SO's theme resolves the latter to
          a visible light-gray tint that reads as a distinct band
          against the outer card. PI's `--background` is near-white, so
          swapping tokens is what preserves the seamless PI-9 look. */}
      <div className="shrink-0 flex flex-col" style={{ width: "210px", borderRight: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}>
        <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2)", borderBottom: "1px solid hsl(var(--border))", gap: "var(--spacing-1-5)", height: "38px", boxSizing: "border-box" }}>
          <Layers size={13} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-caption)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Sources
          </span>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ padding: "var(--spacing-1-5) 0" }}>
          {visibleCategories.map((cat) => {
            const meta = CATEGORY_META[cat];
            const isActive = scope === cat;
            return (
              <div key={cat} style={{ padding: "0 6px" }}>
                <button
                  onClick={() => handleScopeChange(cat)}
                  className="flex items-center w-full transition-colors"
                  style={{ height: "32px", padding: "0 6px", border: 0, borderRadius: "var(--radius-sm)", background: isActive ? "var(--primary-50)" : "transparent", gap: "6px", cursor: "pointer" }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <FolderOpen size={13} style={{ color: meta.color, flexShrink: 0 }} />
                  <span className="truncate" style={{ fontFamily: font, fontWeight: isActive ? 600 : 500, fontSize: "var(--text-caption)", color: isActive ? "hsl(var(--primary))" : "hsl(var(--foreground))", textAlign: "left", flex: 1 }}>
                    {meta.label}
                  </span>
                  <span className="inline-flex items-center justify-center" style={{ minWidth: "16px", height: "16px", padding: "0 2px", borderRadius: "9999px", background: isActive ? "var(--primary-100)" : "var(--surface-secondary)", fontFamily: font, fontWeight: 600, fontSize: "9px", color: isActive ? "var(--primary-700)" : "var(--text-tertiary)" }}>
                    {counts[cat]}
                  </span>
                </button>
              </div>
            );
          })}
          <div style={{ height: 1, background: "hsl(var(--border))", margin: "4px 8px" }} />
          <div style={{ padding: "0 6px" }}>
            <button
              onClick={() => handleScopeChange("all")}
              className="flex items-center w-full transition-colors"
              style={{ height: "32px", padding: "0 6px", border: 0, borderRadius: "var(--radius-sm)", background: scope === "all" ? "var(--primary-50)" : "transparent", gap: "6px", cursor: "pointer" }}
              onMouseEnter={(e) => { if (scope !== "all") (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
              onMouseLeave={(e) => { if (scope !== "all") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Layers size={13} style={{ color: scope === "all" ? "hsl(var(--primary))" : "var(--text-secondary)", flexShrink: 0 }} />
              <span className="truncate" style={{ fontFamily: font, fontWeight: scope === "all" ? 600 : 500, fontSize: "var(--text-caption)", color: scope === "all" ? "hsl(var(--primary))" : "hsl(var(--foreground))", textAlign: "left", flex: 1 }}>
                All Files
              </span>
              <span className="inline-flex items-center justify-center" style={{ minWidth: "16px", height: "16px", padding: "0 2px", borderRadius: "9999px", background: scope === "all" ? "var(--primary-100)" : "var(--surface-secondary)", fontFamily: font, fontWeight: 600, fontSize: "9px", color: scope === "all" ? "var(--primary-700)" : "var(--text-tertiary)" }}>
                {counts.all}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* COL 2 — File-category context pane (non-item scopes).
          Mirrors Physical Inventory: All Files / Documents / Photos /
          Videos / Audio with counts. The header label tracks the
          active source so the breadcrumb reads cleanly. */}
      {scope !== "item" && (
        <div
          className="shrink-0 flex flex-col"
          style={{
            width: "240px",
            borderRight: "1px solid hsl(var(--border))",
            /* PI-9's subtle gray tint (attachments-tab.tsx:1501) —
               45% blend of the surface token over white anchors
               col 2 as a secondary rail between the sources column
               and the file pane. */
            background: "color-mix(in srgb, #F1F5F9 45%, #FFFFFF)",
          }}
        >
          <div className="shrink-0 flex items-center" style={{ padding: "8px", borderBottom: "1px solid hsl(var(--border))", gap: "6px", height: "38px", boxSizing: "border-box", background: "transparent" }}>
            <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-caption)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {scope === "all" ? "All Files" : CATEGORY_META[scope as SOSource].label}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ padding: "6px 0" }}>
            {([
              { key: "all" as const,       label: "All Files",  icon: Layers,    count: fileCategoryCounts.all },
              { key: "documents" as const, label: "Documents",  icon: FileText,  count: fileCategoryCounts.documents },
              { key: "photos" as const,    label: "Photos",     icon: FileImage, count: fileCategoryCounts.photos },
              { key: "videos" as const,    label: "Videos",     icon: FileIco,   count: fileCategoryCounts.videos },
              { key: "audio" as const,     label: "Audio",      icon: FileIco,   count: fileCategoryCounts.audio },
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
                    <cat.icon size={12} style={{ color: isActive ? "hsl(var(--primary))" : "var(--text-secondary)", flexShrink: 0 }} />
                    <span className="truncate" style={{ fontFamily: font, fontWeight: isActive ? 600 : 500, fontSize: "var(--text-caption)", color: isActive ? "hsl(var(--primary))" : "hsl(var(--foreground))", textAlign: "left", flex: 1 }}>
                      {cat.label}
                    </span>
                    <span className="inline-flex items-center justify-center" style={{ minWidth: "16px", height: "16px", padding: "0 2px", borderRadius: "9999px", background: isActive ? "var(--primary-100)" : "color-mix(in srgb, hsl(var(--border)) 60%, var(--surface-secondary))", fontFamily: font, fontWeight: 600, fontSize: "9px", color: isActive ? "var(--primary-700)" : "var(--text-tertiary)" }}>
                      {cat.count}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {scope === "item" && (
        <div
          className="shrink-0 flex flex-col"
          style={{
            width: "240px",
            borderRight: "1px solid hsl(var(--border))",
            /* Same subtle tint as the file-category col 2 above. */
            background: "color-mix(in srgb, #F1F5F9 45%, #FFFFFF)",
          }}
        >
          <div className="shrink-0 flex items-center" style={{ padding: "8px", borderBottom: "1px solid hsl(var(--border))", gap: "6px", height: "38px", boxSizing: "border-box", background: "transparent" }}>
            <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-caption)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Item Attachments
            </span>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ padding: "6px 0" }}>
            <div style={{ padding: "0 6px" }}>
              <button
                onClick={() => setItemDrillIn("all")}
                className="flex items-center w-full transition-colors"
                style={{ height: "32px", padding: "0 6px", border: 0, borderRadius: "var(--radius-sm)", background: itemDrillIn === "all" ? "var(--primary-50)" : "transparent", gap: "6px", cursor: "pointer" }}
                onMouseEnter={(e) => { if (itemDrillIn !== "all") (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
                onMouseLeave={(e) => { if (itemDrillIn !== "all") (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <Layers size={12} style={{ color: itemDrillIn === "all" ? "hsl(var(--primary))" : "var(--text-secondary)" }} />
                <span className="truncate" style={{ fontFamily: font, fontWeight: itemDrillIn === "all" ? 600 : 500, fontSize: "var(--text-caption)", color: itemDrillIn === "all" ? "hsl(var(--primary))" : "hsl(var(--foreground))", textAlign: "left", flex: 1 }}>
                  All items
                </span>
                <span className="inline-flex items-center justify-center" style={{ minWidth: "16px", height: "16px", padding: "0 2px", borderRadius: "9999px", background: itemDrillIn === "all" ? "var(--primary-100)" : "color-mix(in srgb, hsl(var(--border)) 60%, var(--surface-secondary))", fontFamily: font, fontWeight: 600, fontSize: "9px", color: itemDrillIn === "all" ? "var(--primary-700)" : "var(--text-tertiary)" }}>
                  {attachments.filter((a) => a.category === "item").length}
                </span>
              </button>
            </div>
            <div style={{ height: 1, background: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", margin: "4px 8px" }} />
            {itemGroups.length === 0 ? (
              <div style={{ padding: "16px", fontFamily: font, fontSize: "var(--text-caption)", color: "var(--text-tertiary)", lineHeight: 1.4, textAlign: "center" }}>
                No item-level attachments yet.
              </div>
            ) : itemGroups.map(({ line, docs }) => {
              const isActive = itemDrillIn === line.id;
              return (
                <div key={line.id} style={{ padding: "0 6px" }}>
                  <button
                    onClick={() => setItemDrillIn(line.id)}
                    className="flex items-center w-full transition-colors"
                    style={{ minHeight: "44px", padding: "6px 6px", border: 0, borderRadius: "var(--radius-sm)", background: isActive ? "var(--primary-50)" : "transparent", gap: "8px", cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div style={{ width: "28px", height: "28px", borderRadius: "var(--radius-sm)", background: "var(--surface-secondary)", border: "1px solid hsl(var(--border))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Package size={13} style={{ color: "var(--text-secondary)" }} />
                    </div>
                    <div className="flex flex-col min-w-0" style={{ flex: 1, gap: "1px" }}>
                      <span className="truncate" style={{ fontFamily: font, fontWeight: isActive ? 600 : 500, fontSize: "var(--text-caption)", color: isActive ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}>
                        {line.itemCode}
                      </span>
                      <span className="truncate" style={{ fontFamily: font, fontWeight: 400, fontSize: "10px", color: "var(--text-tertiary)" }}>
                        {line.itemName}
                      </span>
                    </div>
                    <span className="inline-flex items-center justify-center shrink-0" style={{ minWidth: "16px", height: "16px", padding: "0 2px", borderRadius: "9999px", background: isActive ? "var(--primary-100)" : "color-mix(in srgb, hsl(var(--border)) 60%, var(--surface-secondary))", fontFamily: font, fontWeight: 600, fontSize: "9px", color: isActive ? "var(--primary-700)" : "var(--text-tertiary)" }}>
                      {docs.length}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* COL 3 — breadcrumb header
          Uses `hsl(var(--card))` (white) to stay flush with the toolbar
          above and the adjacent sources sidebar. `hsl(var(--background))`
          reads as gray under SO's theme. */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="shrink-0 flex items-center" style={{ padding: "var(--spacing-2) var(--spacing-3)", borderBottom: "1px solid hsl(var(--border))", gap: "var(--spacing-1-5)", background: "hsl(var(--card))", height: "38px", boxSizing: "border-box" }}>
          {scope === "all" ? (
            <>
              <Layers size={13} style={{ color: "hsl(var(--primary))", flexShrink: 0 }} />
              <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-caption)", color: "hsl(var(--foreground))" }}>All Files</span>
            </>
          ) : scope === "item" && itemDrillIn && itemDrillIn !== "all" ? (
            (() => {
              const li = lines.find((x) => x.id === itemDrillIn);
              return (
                <>
                  <FolderOpen size={13} style={{ color: CATEGORY_META["item"].color, flexShrink: 0 }} />
                  <button
                    onClick={() => setItemDrillIn("all")}
                    style={{ fontFamily: font, fontWeight: 500, fontSize: "var(--text-caption)", color: "hsl(var(--primary))", background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
                  >
                    Item Attachments
                  </button>
                  <ChevronRight size={10} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                  <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-caption)", color: "hsl(var(--foreground))" }}>{li?.itemCode}</span>
                </>
              );
            })()
          ) : (
            <>
              <FolderOpen size={13} style={{ color: CATEGORY_META[scope as SOSource].color, flexShrink: 0 }} />
              <span style={{ fontFamily: font, fontWeight: 600, fontSize: "var(--text-caption)", color: "hsl(var(--foreground))" }}>
                {CATEGORY_META[scope as SOSource].label}
              </span>
            </>
          )}
          <div className="flex items-center shrink-0" style={{ marginLeft: "auto", gap: "var(--spacing-2)" }}>
            {/* File pane header controls — port of PI-9's file pane
                header (attachments-tab.tsx:1675-1690). ViewToggle
                (density) has been lifted to the top toolbar so this
                row only carries filter + sort controls. */}
            <span style={{ fontFamily: font, fontWeight: 400, fontSize: "var(--text-caption)", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
              {rightPaneItems.length} item{rightPaneItems.length !== 1 ? "s" : ""}{rightPaneAtts.length > 0 ? ` · ${formatTotalSize(rightPaneAtts)}` : ""}
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
          {rightPaneItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center" style={{ padding: "48px 24px", gap: "8px", height: "100%" }}>
              <div className="flex items-center justify-center" style={{ width: "64px", height: "64px", borderRadius: "var(--radius-md)", background: "hsl(var(--accent))" }}>
                <Paperclip size={26} style={{ color: "hsl(var(--primary))", opacity: 0.7 }} />
              </div>
              <div style={{ fontFamily: font, fontSize: "14px", fontWeight: 600, color: "hsl(var(--foreground))", marginTop: "8px" }}>No files yet</div>
              <div style={{ fontFamily: font, fontSize: "12px", color: "hsl(var(--muted-foreground))", maxWidth: "320px", textAlign: "center", lineHeight: 1.5 }}>
                No files have been attached to this source yet. Upload a file to get started.
              </div>
            </div>
          ) : viewMode === "condensed" || viewMode === "comfort" ? (
            <div className="flex flex-col">
              {/* File list header — verbatim port of PI-9's
                  `FileListHeader` (attachments-tab.tsx:1837). */}
              <div
                className="flex items-center sticky top-0 z-10 bg-slate-50"
                style={{
                  padding: "calc(var(--spacing-1-5) + 2px) var(--spacing-3)",
                  borderBottom: "1px solid hsl(var(--border))",
                  columnGap: "2px",
                }}
              >
                <div className="flex-1 min-w-0" style={{ fontFamily: font, fontWeight: 600, fontSize: "11px", color: "#94a3b8", letterSpacing: "0.01em", textAlign: "left" }}>File Name</div>
                <div className="shrink-0" style={{ width: "70px", fontFamily: font, fontWeight: 600, fontSize: "11px", color: "#94a3b8", letterSpacing: "0.01em", textAlign: "left" }}>Size</div>
                <div className="shrink-0" style={{ width: "150px", fontFamily: font, fontWeight: 600, fontSize: "11px", color: "#94a3b8", letterSpacing: "0.01em", textAlign: "left" }}>Date</div>
                <div className="shrink-0" style={{ width: "140px", fontFamily: font, fontWeight: 600, fontSize: "11px", color: "#94a3b8", letterSpacing: "0.01em", textAlign: "left" }}>Uploaded By</div>
                <div className="shrink-0" style={{ width: "36px" }} />
              </div>
              {rightPaneItems.map((it) => {
                if (it.kind === "url") {
                  return (
                    <FileListRow
                      key={it.link.id}
                      name={it.link.name}
                      type="url"
                      size=""
                      date={it.link.date}
                      uploadedBy={it.link.uploadedBy}
                      searchQuery={searchQuery}
                      density={viewMode === "condensed" ? "condensed" : "comfort"}
                      onClick={() => window.open(it.link.url, "_blank")}
                      onPreview={() => onPreviewLink(it.link)}
                      onRename={() => onRenameLink(it.link)}
                      onDelete={() => onDeleteLink(it.link.id)}
                      isUrl
                    />
                  );
                }
                const a = it.att;
                const canConvertToOrder = a.category === "item";
                const canConvertToItem = a.category === "so-docs";
                return (
                  <FileListRow
                    key={a.id}
                    name={a.name}
                    type={a.fileKind === "doc" ? "docx" : a.fileKind === "sheet" ? "xlsx" : a.fileKind}
                    size={a.size}
                    date={a.date}
                    uploadedBy={a.uploadedBy}
                    searchQuery={searchQuery}
                    density={viewMode === "condensed" ? "condensed" : "comfort"}
                    onClick={() => onPreview(a)}
                    onPreview={() => onPreview(a)}
                    onDownload={() => toast.success("Download started")}
                    onRename={() => onRename(a)}
                    onTogglePdf={() => onToggleInOrder(a.id)}
                    onConvertToOrder={() => onConvert(a, "to-order")}
                    onConvertToItem={() => onConvert(a, "to-item")}
                    onDelete={() => onDelete(a.id)}
                    includedInPdf={a.inOrder}
                    canConvertToOrder={canConvertToOrder}
                    canConvertToItem={canConvertToItem}
                  />
                );
              })}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: CARD_SIZE_COLUMNS[cardSize], padding: "var(--spacing-4)", gap: "var(--spacing-4)" }}>
              {rightPaneItems.map((it) => {
                if (it.kind === "url") {
                  return (
                    <AttachmentCard
                      key={it.link.id}
                      att={urlToCardData(it.link)}
                      renderFileName={(n) => <HighlightText text={n} query={searchQuery} />}
                      pills={scope === "all" ? <CardSourcePill category="external-link" /> : undefined}
                      onPreview={() => onPreviewLink(it.link)}
                      onDelete={() => onDeleteLink(it.link.id)}
                      onCardClick={() => window.open(it.link.url, "_blank")}
                    />
                  );
                }
                const a = it.att;
                if (a.uploading) {
                  return (
                    <POUploadingCard
                      key={a.id}
                      fileName={a.name}
                      fileSize={a.size}
                      ext={(a.fileKind || "pdf").toUpperCase()}
                      progress={a.progress ?? 0}
                      onCancel={() => onDelete(a.id)}
                    />
                  );
                }
                const line = a.lineItemId ? lines.find((l) => l.id === a.lineItemId) : null;
                /* Attachment-card 3-dots menu scoped to Preview, Download,
                   PDF-visibility toggle, "Move to Order Level" (only for
                   item-scoped files), and Delete. Rename and
                   "Move to Item Level" removed per updated spec. */
                const extraMenu: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; dividerBefore?: boolean }[] = [];
                if (a.category === "item") {
                  extraMenu.push({ label: "Move to Order Level", icon: <ArrowRightLeft size={13} style={{ color: "var(--text-secondary)" }} />, onClick: () => onConvert(a, "to-order") });
                }

                return (
                  <AttachmentCard
                    key={a.id}
                    att={attToCardData(a)}
                    renderFileName={(n) => <HighlightText text={n} query={searchQuery} />}
                    pills={
                      <>
                        {a.inOrder && <CardInOrderPill />}
                        {line && <CardLineItemPill line={line} />}
                        {a.shipmentId && <CardShipmentPill shipmentId={a.shipmentId} />}
                        {scope === "all" && <CardSourcePill category={a.category} />}
                      </>
                    }
                    onPreview={() => onPreview(a)}
                    onDownload={() => { /* hook upstream */ }}
                    onDelete={() => onDelete(a.id)}
                    onCardClick={() => onPreview(a)}
                    inclusionToggle={{
                      included: a.inOrder,
                      showLabel: "Reference in Order PDF",
                      hideLabel: "Remove from Order PDF",
                      onToggle: () => onToggleInOrder(a.id),
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
 * § 5  MAIN
 * ═══════════════════════════════════════════════════════════════════════════ */

interface AttachmentsTabProps {
  attachments: Attachment[];
  lines: SOLine[];
  createdViaUI?: boolean;
  soStatus?: string;
  /** SO id used to look up RFQ/RFP docs in the shared preSoDocsStore. */
  soId?: string;
}

/* External links moved out of the Attachments tab. The shared
   `linksRepository` (used by the Deal Information tab's Links section)
   owns them now. The seed array is emptied so the Attachments tab
   renders only real file attachments. */
const INITIAL_LINKS: UrlLink[] = [];

export function AttachmentsTab({ attachments: initialAttachments, lines, createdViaUI = false, soStatus = 'Cleared', soId }: AttachmentsTabProps) {
  // PO scope: only two sidebar buckets — "PO Attachments" (so-docs) and
  // "Item Attachments" (item). Fold every other legacy SO category into
  // so-docs at the state boundary so counts, groups, and card pills all
  // see the collapsed shape.
  const normalizeCategory = (a: Attachment): Attachment =>
    a.category === "item" ? a : { ...a, category: "so-docs" as AttachmentCategory };
  const [attachments, setAttachments] = useState<Attachment[]>(() => createdViaUI ? [] : initialAttachments.map(normalizeCategory));
  const [links, setLinks] = useState<UrlLink[]>(() => createdViaUI ? [] : INITIAL_LINKS);

  /* Merge newly-arrived attachments from the parent (e.g. files
     uploaded through the Mark Rejection modal — the store pushes
     them onto the SO's `attachments` array after `rejectSO`) into
     local state. Local additions (via the tab's own upload flow)
     survive because we only append IDs the tab hasn't seen. Local
     removals aren't reflected upstream, which matches the tab's
     existing "local-first" model. */
  useEffect(() => {
    setAttachments(prev => {
      const seen = new Set(prev.map(a => a.id));
      const additions = initialAttachments.filter(a => !seen.has(a.id)).map(normalizeCategory);
      return additions.length ? [...prev, ...additions] : prev;
    });
  }, [initialAttachments]);

  /* Pre-SO RFQ/RFP docs synced from the shared `preSoDocsStore`, mirrors
   * how Quote's AttachmentsTab pulls `getPreQuoteDocs`. */
  const [preSoDocs, setPreSoDocsState] = useState<PreSoDocument[]>(() => soId ? getPreSoDocs(soId) : []);
  useEffect(() => {
    if (!soId) return;
    setPreSoDocsState(getPreSoDocs(soId));
    return subscribePreSoDocs(soId, () => setPreSoDocsState(getPreSoDocs(soId)));
  }, [soId]);

  const mapDocKind = (ext: string): FileKind => {
    const m: Record<string, FileKind> = {
      pdf: "pdf", xlsx: "xlsx", xls: "xlsx", csv: "csv",
      docx: "doc", doc: "doc", png: "png", jpg: "jpg", jpeg: "jpg",
    };
    return m[ext.toLowerCase()] || "pdf";
  };

  // Project the shared PreSoDocument list into Attachment so the rest of the
  // tab (folder grouping, source pill, preview modal, etc.) works without
  // touching the existing UI plumbing. RFQ/RFP docs are surfaced under the
  // existing "pre-sales" category, which already appears first in
  // CATEGORY_ORDER and is labeled "Pre-Sales Documents (RFQ/RFP)" below.
  const rfqAsAttachments: Attachment[] = preSoDocs.map((d) => ({
    id: d.id,
    name: d.name,
    size: d.size,
    uploadedBy: d.uploadedBy,
    date: d.uploadedAt,
    category: "so-docs" as AttachmentCategory,
    fileKind: mapDocKind(d.type),
    inOrder: false,
    tag: "rfq/rfp",
  }));
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
     tree never flashes empty. */
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1800);
    return () => clearTimeout(t);
  }, []);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [convertModal, setConvertModal] = useState<{ att: Attachment; direction: "to-order" | "to-item" } | null>(null);
  const [previewAtt, setPreviewAtt] = useState<Attachment | null>(null);
  const [previewLink, setPreviewLink] = useState<UrlLink | null>(null);
  const [renameAtt, setRenameAtt] = useState<Attachment | null>(null);
  const [renameLink, setRenameLink] = useState<UrlLink | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Item-scoped attachments picked by the buyer via the Item Detail modal
     (OrderFlow). Read from the shared store keyed by this PO id and
     resolved against the item library so PO Detail's Item Attachments
     section reflects the same picks. Kept as a memo so identity is
     stable across renders when nothing changed. */
  const storeSubscribe = useCallback(
    (cb: () => void) => (soId ? poItemAttachments.subscribe(soId, cb) : () => {}),
    [soId],
  );
  const storeSnapshot = useSyncExternalStore(
    storeSubscribe,
    () => (soId ? poItemAttachments.getAllPickedForPo(soId) : EMPTY_PICKED),
    () => EMPTY_PICKED,
  );

  /* One-time seed: on first mount for a PO, dummy-pick a couple of item
     library files for the first three non-cancelled line items so the
     "Item Attachments" section starts populated for those three; the
     remaining lines stay empty for the buyer to fill in via the Item
     Detail modal picker. Uses `hasSeeded` on the store (via the picks
     being non-empty) to skip re-seeding on remount. */
  useEffect(() => {
    if (!soId) return;
    if (poItemAttachments.getAllPickedForPo(soId).length > 0) return;
    const targets = lines.filter((l) => !l.cancelled).slice(0, 3);
    if (targets.length === 0) return;
    // Pick 2 library files per seeded line — rotates through the shared
    // ITEM_LIBRARY so different lines get different files.
    targets.forEach((li, idx) => {
      const start = (idx * 2) % ITEM_LIBRARY.length;
      const picks = [ITEM_LIBRARY[start]?.id, ITEM_LIBRARY[(start + 1) % ITEM_LIBRARY.length]?.id].filter(Boolean) as string[];
      picks.forEach((attId) => poItemAttachments.togglePickedAttachment(soId, li.id, attId));
    });
  }, [soId, lines]);

  const pickedItemAttachments: Attachment[] = useMemo(() => {
    return storeSnapshot
      .map(({ lineItemId, attId }) => {
        const lib = ITEM_LIBRARY.find((a) => a.id === attId);
        if (!lib) return null;
        const ext = (lib.name.split(".").pop() || "pdf").toLowerCase();
        const fk: FileKind = (["pdf", "xlsx", "doc", "docx", "png", "jpg", "jpeg", "csv", "mp4", "mp3", "stl", "dxf", "cfg"].includes(ext)
          ? ({ docx: "doc", jpeg: "jpg" } as Record<string, FileKind>)[ext] ?? (ext as FileKind)
          : "pdf");
        const d = new Date(lib.uploadedAt);
        const date = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
        return {
          id: `PICK-${lineItemId}-${attId}`,
          name: lib.name,
          size: lib.size,
          uploadedBy: lib.uploadedBy,
          date,
          category: "item" as AttachmentCategory,
          fileKind: fk,
          lineItemId,
          inOrder: true,
          previewUrl: lib.previewUrl ?? undefined,
          // Non-standard extra fields used to route delete back to the store.
          _pickedRef: { attId, lineItemId },
        } as Attachment & { _pickedRef: { attId: string; lineItemId: string } };
      })
      .filter(Boolean) as Attachment[];
  }, [storeSnapshot]);

  const visibleAttachments = [...rfqAsAttachments, ...attachments, ...pickedItemAttachments];
  const visibleCategories: SOSource[] = useMemo(
    () => CATEGORY_ORDER.slice(),
    [],
  );

  /* Search + date-range filters */
  const filteredAtts = useMemo(() => {
    let list = filterByDateRange(visibleAttachments, dateRange, customRange.from, customRange.to);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q) || a.uploadedBy.toLowerCase().includes(q));
    }
    return list;
  }, [visibleAttachments, searchQuery, dateRange, customRange]);

  const filteredLinks = useMemo(() => {
    let list = filterByDateRange(links, dateRange, customRange.from, customRange.to);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((l) => l.name.toLowerCase().includes(q) || l.uploadedBy.toLowerCase().includes(q));
    }
    return list;
  }, [links, searchQuery, dateRange, customRange]);

  const handleToggleInOrder = useCallback((id: string) => {
    setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, inOrder: !a.inOrder } : a));
  }, []);

  const handleDelete = useCallback((id: string) => {
    // Store-backed picked attachment: un-pick in the shared store so the
    // Item Detail modal picker reflects the removal too.
    if (soId && id.startsWith("PICK-")) {
      const rest = id.slice("PICK-".length);
      const sep = rest.lastIndexOf("-");
      if (sep > 0) {
        const lineItemId = rest.slice(0, sep);
        const attId = rest.slice(sep + 1);
        poItemAttachments.removePickedAttachment(soId, lineItemId, attId);
        return;
      }
    }
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, [soId]);

  const handleDeleteLink = useCallback((id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const handleConvert = useCallback((att: Attachment, direction: "to-order" | "to-item") => {
    setConvertModal({ att, direction });
  }, []);

  const handleConvertToOrder = (id: string) => {
    setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, category: "so-docs", lineItemId: undefined } : a));
    setConvertModal(null);
  };
  const handleConvertToItem = (id: string, lineItemId: string) => {
    setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, category: "item", lineItemId } : a));
    setConvertModal(null);
  };

  /* Cycle-Count-style upload: files land as shimmer placeholder cards
     immediately and progress fills in over ~1.2-2.4s. Category is
     inferred from the sidebar scope reported by FolderTreeView so the
     toolbar Upload button routes to PO-level vs a specific line item
     without a modal gate. */
  const handleUpload = useCallback((files: FileList | null, category: AttachmentCategory, lineItemId?: string) => {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    const formatSize = (b: number) =>
      b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
    const newItems: Attachment[] = arr.map((f, i) => {
      const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
      const fk: Attachment["fileKind"] = (["pdf", "xlsx", "doc", "cfg", "png", "jpg", "csv", "sheet"].includes(ext) ? ext : "pdf") as Attachment["fileKind"];
      return {
        id: `upload-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        size: formatSize(f.size),
        uploadedBy: CURRENT_USER,
        date: (() => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`; })(),
        category,
        fileKind: fk,
        inOrder: false,
        lineItemId: category === "item" ? lineItemId : undefined,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        uploading: true,
        progress: 0,
      };
    });
    setAttachments((prev) => [...newItems, ...prev]);
    newItems.forEach((item) => {
      const total = 1200 + Math.random() * 1200;
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const pct = Math.min(100, Math.round((elapsed / total) * 100));
        setAttachments((prev) => prev.map((a) => (a.id === item.id ? { ...a, progress: pct } : a)));
        if (pct < 100) {
          setTimeout(tick, 120);
        } else {
          setAttachments((prev) => prev.map((a) => (a.id === item.id ? { ...a, uploading: false, progress: 100 } : a)));
        }
      };
      setTimeout(tick, 120);
    });
    setShowUploadModal(false);
  }, []);

  /* Toolbar Upload trigger: file picker opens immediately (no modal).
     Route by the current sidebar scope reported from FolderTreeView. */
  const scopeCtxRef = useRef<{ scope: SourceScope; itemDrillIn: string | null }>({ scope: "all", itemDrillIn: null });
  const handleContextChange = useCallback((ctx: { scope: SourceScope; itemDrillIn: string | null }) => {
    scopeCtxRef.current = ctx;
  }, []);
  const [pendingItemPick, setPendingItemPick] = useState<FileList | null>(null);
  const handleToolbarUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  const handleToolbarFilesChosen = useCallback((files: FileList | null) => {
    if (!files || !files.length) return;
    const { scope, itemDrillIn } = scopeCtxRef.current;
    if (scope === "item") {
      if (itemDrillIn && itemDrillIn !== "all") {
        handleUpload(files, "item", itemDrillIn);
      } else {
        /* Item scope without a drilled-in line — stash files and open a
           compact line picker so the user can name the target. */
        setPendingItemPick(files);
      }
      return;
    }
    handleUpload(files, "so-docs");
  }, [handleUpload]);

  /* handleAddLink + LinkUrlModal are gone. External URLs live in the
     Deal Information tab's Links repository now. */

  return (
    <div
      className="flex-1 flex flex-col min-h-0"
      style={{
        fontFamily: font,
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--elevation-xs)",
        overflow: "hidden",
      }}
    >
      {/* ── Toolbar — mirrors PI-9's attachments-tab shell (row 1 only):
          search input + view-mode / density + upload button. */}
      <div className="flex items-center" style={{ padding: "var(--spacing-4) var(--spacing-4) var(--spacing-3)", gap: "var(--spacing-2-5)", borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="relative" style={{ flex: 1, maxWidth: "320px" }}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-secondary)" }} />
          <input
            type="text"
            placeholder="Search attachments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            style={{
              height: "34px", paddingLeft: "34px", paddingRight: "12px",
              fontFamily: font, fontSize: "var(--text-body-sm)", color: "hsl(var(--foreground))",
              background: "#FFFFFF", border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius-sm)", boxShadow: "var(--elevation-xs)",
            }}
          />
        </div>
        <div className="ml-auto flex items-center" style={{ gap: "var(--spacing-2)" }}>
          <ViewToggle value={viewMode} onChange={setViewMode} cardSize={cardSize} onCardSizeChange={setCardSize} />
          <PartnerStylePrimaryCta icon={<Upload className="w-3.5 h-3.5" />} label="Upload" onClick={handleToolbarUploadClick} />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
            className="hidden"
            onChange={(e) => { handleToolbarFilesChosen(e.target.files); e.target.value = ""; }}
          />
        </div>
      </div>

      {isLoading ? (
        <AttachmentsLoadingSkeleton />
      ) : visibleAttachments.length === 0 && links.length === 0 ? (
        <EmptyPlaceholder
          block
          icon={Paperclip}
          title="No attachments yet"
          description="Supporting files attached to this sales order at the document level or to individual line items."
          actionLabel="Upload attachment"
          onAction={handleToolbarUploadClick}
        />
      ) : (
        <FolderTreeView
          attachments={filteredAtts}
          links={filteredLinks}
          lines={lines}
          searchQuery={searchQuery}
          onToggleInOrder={handleToggleInOrder}
          onDelete={handleDelete}
          onConvert={handleConvert}
          onPreview={(a) => setPreviewAtt(a)}
          onPreviewLink={(l) => setPreviewLink(l)}
          onDeleteLink={handleDeleteLink}
          onRename={(a) => setRenameAtt(a)}
          onRenameLink={(l) => setRenameLink(l)}
          viewMode={viewMode}
          cardSize={cardSize}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          customFrom={customRange.from}
          customTo={customRange.to}
          onCustomRangeChange={(from, to) => setCustomRange({ from, to })}
          visibleCategories={visibleCategories}
          onContextChange={handleContextChange}
        />
      )}

      {previewAtt && (
        <AttachmentPreviewModal
          attachment={{ ...attToCardData(previewAtt), source: CATEGORY_META[previewAtt.category].label }}
          onClose={() => setPreviewAtt(null)}
          onDelete={() => { handleDelete(previewAtt.id); setPreviewAtt(null); }}
        />
      )}

      {previewLink && (
        <AttachmentPreviewModal
          attachment={{ ...urlToCardData(previewLink), source: "External Links" }}
          onClose={() => setPreviewLink(null)}
          onDelete={() => { handleDeleteLink(previewLink.id); setPreviewLink(null); }}
        />
      )}

      {pendingItemPick && (
        <ItemPickerModal
          lines={lines}
          fileCount={pendingItemPick.length}
          onClose={() => setPendingItemPick(null)}
          onPick={(lineItemId) => {
            handleUpload(pendingItemPick, "item", lineItemId);
            setPendingItemPick(null);
          }}
        />
      )}

      {convertModal && (
        <ConvertScopeModal
          att={convertModal.att}
          direction={convertModal.direction}
          lines={lines}
          onClose={() => setConvertModal(null)}
          onConvertToOrder={handleConvertToOrder}
          onConvertToItem={handleConvertToItem}
        />
      )}

      {renameAtt && (
        <RenameAttachmentDialog
          currentName={renameAtt.name}
          onCancel={() => setRenameAtt(null)}
          onConfirm={(newName) => {
            setAttachments((prev) => prev.map((a) => a.id === renameAtt.id ? { ...a, name: newName } : a));
            setRenameAtt(null);
          }}
        />
      )}

      {renameLink && (
        <RenameAttachmentDialog
          currentName={renameLink.name}
          onCancel={() => setRenameLink(null)}
          onConfirm={(newName) => {
            setLinks((prev) => prev.map((l) => l.id === renameLink.id ? { ...l, name: newName } : l));
            setRenameLink(null);
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 6-8  UPLOAD / LINK / CONVERT MODALS
 * ═══════════════════════════════════════════════════════════════════════════ */

/* Compact "which line item?" modal shown only when the buyer clicks
   Upload while on the Item Attachments sidebar without a specific line
   drilled in. Matches cycle-count's directness — no category picker,
   no drop-zone step, just a radio list of line items. */
function ItemPickerModal({ lines, fileCount, onClose, onPick }: {
  lines: SOLine[];
  fileCount: number;
  onClose: () => void;
  onPick: (lineItemId: string) => void;
}) {
  const [lineItemId, setLineItemId] = useState<string>("");
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9998, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div
        className="flex flex-col"
        style={{ width: "min(440px, calc(100vw - 32px))", maxHeight: "80vh", background: "hsl(var(--card))", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ padding: "16px 20px", borderBottom: "1px solid hsl(var(--border))" }}>
          <h3 style={{ fontFamily: font, fontSize: "16px", fontWeight: 600, color: "hsl(var(--foreground))", margin: 0 }}>
            Attach {fileCount} file{fileCount > 1 ? "s" : ""} to a line item
          </h3>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} className="hover:bg-[var(--surface-secondary)]">
            <X size={16} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>
        <div className="flex flex-col" style={{ padding: 16, gap: 12, overflowY: "auto" }}>
          <div className="flex flex-col" style={{ gap: 6 }}>
            {lines.filter((l) => !l.cancelled).map((li) => {
              const checked = lineItemId === li.id;
              return (
                <label key={li.id} className="flex items-center cursor-pointer hover:bg-[var(--primary-50)]" style={{ padding: 10, border: `1px solid ${checked ? "var(--primary-200)" : "hsl(var(--border))"}`, borderRadius: 8, background: checked ? "var(--primary-50)" : "hsl(var(--background))", gap: 10 }}>
                  <input type="radio" checked={checked} onChange={() => setLineItemId(li.id)} style={{ width: 16, height: 16 }} />
                  <div className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))" }}>{li.itemCode}</span>
                    <span style={{ fontFamily: font, fontSize: 11, color: "var(--text-tertiary)" }}>{li.itemName}</span>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex" style={{ gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} className="hover:bg-[var(--surface-secondary)]" style={{ height: 34, padding: "0 14px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontFamily: font, fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))", cursor: "pointer" }}>Cancel</button>
            <button onClick={() => onPick(lineItemId)} disabled={!lineItemId} style={{ height: 34, padding: "0 14px", borderRadius: 8, border: 0, background: !lineItemId ? "hsl(var(--muted))" : "hsl(var(--primary))", color: !lineItemId ? "hsl(var(--muted-foreground))" : "#FFFFFF", fontFamily: font, fontSize: 13, fontWeight: 600, cursor: !lineItemId ? "not-allowed" : "pointer" }}>
              Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadModal({ lines, onClose, onUpload, fileInputRef }: {
  lines: SOLine[];
  onClose: () => void;
  onUpload: (files: FileList | null, category: AttachmentCategory, lineItemId?: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [category, setCategory] = useState<AttachmentCategory>("so-docs");
  const [lineItemId, setLineItemId] = useState<string>("");
  const [staged, setStaged] = useState<FileList | null>(null);
  const [step, setStep] = useState<"upload" | "select-item">("upload");
  const [dragOver, setDragOver] = useState(false);

  const handleProceed = () => {
    if (!staged) return;
    if (category === "item") setStep("select-item");
    else onUpload(staged, category);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9998, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div
        className="flex flex-col"
        style={{ width: "min(560px, calc(100vw - 32px))", maxHeight: "80vh", background: "hsl(var(--card))", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ padding: "16px 20px", borderBottom: "1px solid hsl(var(--border))" }}>
          <h3 style={{ fontFamily: font, fontSize: "18px", fontWeight: 600, color: "hsl(var(--foreground))", margin: 0 }}>
            {step === "upload" ? "Upload Files" : "Link to Line Item"}
          </h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} className="hover:bg-[var(--surface-secondary)]">
            <X size={18} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        {step === "upload" ? (
          <div className="flex flex-col" style={{ padding: 20, gap: 16, overflowY: "auto" }}>
            <div>
              <label style={{ fontFamily: font, fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Attachment scope</label>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {(["so-docs", "item"] as AttachmentCategory[]).map((c) => {
                  const isActive = category === c;
                  return (
                    <button
                      key={c} onClick={() => setCategory(c)}
                      style={{ height: 30, padding: "0 12px", borderRadius: 9999, border: `1px solid ${isActive ? "var(--primary-600)" : "hsl(var(--border))"}`, background: isActive ? "var(--primary-50)" : "hsl(var(--background))", color: isActive ? "hsl(var(--primary))" : "var(--text-secondary)", fontFamily: font, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
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
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) setStaged(e.dataTransfer.files); }}
              className="flex flex-col items-center justify-center cursor-pointer transition-colors"
              style={{ padding: 32, border: `2px dashed ${dragOver ? "hsl(var(--primary))" : "hsl(var(--border))"}`, borderRadius: "var(--radius-md)", background: dragOver ? "var(--primary-50)" : "hsl(var(--background))", gap: 8 }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={28} style={{ color: dragOver ? "hsl(var(--primary))" : "var(--text-secondary)" }} />
              <p style={{ fontFamily: font, fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))", margin: 0 }}>
                {staged ? `${staged.length} file${staged.length > 1 ? "s" : ""} selected` : "Click to browse or drag files here"}
              </p>
              <p style={{ fontFamily: font, fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
                PDF, XLSX, DOCX, PNG, JPG, CSV, ZIP
              </p>
            </div>
            <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files) setStaged(e.target.files); }} />

            <div className="flex" style={{ gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose} className="hover:bg-[var(--surface-secondary)]" style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontFamily: font, fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleProceed} disabled={!staged} className="hover:bg-[#0862D0]" style={{ height: 36, padding: "0 16px", borderRadius: 8, border: 0, background: !staged ? "hsl(var(--muted))" : "hsl(var(--primary))", color: !staged ? "hsl(var(--muted-foreground))" : "#FFFFFF", fontFamily: font, fontSize: 13, fontWeight: 600, cursor: !staged ? "not-allowed" : "pointer" }}>
                {category === "item" ? "Next" : "Upload"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col" style={{ padding: 20, gap: 12, overflowY: "auto" }}>
            <p style={{ fontFamily: font, fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
              Select the line item to link these {staged?.length} file{(staged?.length || 0) > 1 ? "s" : ""} to.
            </p>
            <div className="flex flex-col" style={{ gap: 6 }}>
              {lines.map((li) => {
                const checked = lineItemId === li.id;
                return (
                  <label key={li.id} className="flex items-center cursor-pointer hover:bg-[var(--primary-50)]" style={{ padding: 10, border: `1px solid ${checked ? "var(--primary-200)" : "hsl(var(--border))"}`, borderRadius: 8, background: checked ? "var(--primary-50)" : "hsl(var(--background))", gap: 10 }}>
                    <input type="radio" checked={checked} onChange={() => setLineItemId(li.id)} style={{ width: 16, height: 16 }} />
                    <div className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))" }}>{li.itemCode}</span>
                      <span style={{ fontFamily: font, fontSize: 11, color: "var(--text-tertiary)" }}>{li.itemName}</span>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="flex" style={{ gap: 8, justifyContent: "space-between", marginTop: 4 }}>
              <button onClick={() => setStep("upload")} className="hover:bg-[var(--surface-secondary)]" style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontFamily: font, fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <ChevronLeft size={14} /> Back
              </button>
              <button onClick={() => onUpload(staged, "item", lineItemId)} disabled={!lineItemId} className="hover:bg-[#0862D0]" style={{ height: 36, padding: "0 16px", borderRadius: 8, border: 0, background: !lineItemId ? "hsl(var(--muted))" : "hsl(var(--primary))", color: !lineItemId ? "hsl(var(--muted-foreground))" : "#FFFFFF", fontFamily: font, fontSize: 13, fontWeight: 600, cursor: !lineItemId ? "not-allowed" : "pointer" }}>
                Upload
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* LinkUrlModal removed — the shared AddExternalLinkModal at
   `@/app/components/shared/AddExternalLinkModal` is the sole
   external-link entry point now (Deal Info Links section + inline
   picker in External Notes / adjustment internal notes). */

function ConvertScopeModal({ att, direction, lines, onClose, onConvertToOrder, onConvertToItem }: {
  att: Attachment;
  direction: "to-order" | "to-item";
  lines: SOLine[];
  onClose: () => void;
  onConvertToOrder: (id: string) => void;
  onConvertToItem: (id: string, lineItemId: string) => void;
}) {
  const [selected, setSelected] = useState<string>("");
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9998, background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div className="flex flex-col" style={{ width: "min(480px, calc(100vw - 32px))", maxHeight: "80vh", background: "hsl(var(--card))", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between" style={{ padding: "16px 20px", borderBottom: "1px solid hsl(var(--border))" }}>
          <h3 style={{ fontFamily: font, fontSize: 18, fontWeight: 600, margin: 0, color: "hsl(var(--foreground))" }}>
            {direction === "to-order" ? "Move to Order Level" : "Move to Item Level"}
          </h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} className="hover:bg-[var(--surface-secondary)]">
            <X size={18} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>
        <div className="flex flex-col" style={{ padding: 20, gap: 12, overflowY: "auto" }}>
          <p style={{ fontFamily: font, fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
            <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>{att.name}</span>
          </p>
          {direction === "to-order" ? (
            <p style={{ fontFamily: font, fontSize: 13, color: "hsl(var(--foreground))", margin: 0 }}>
              This will detach the file from its line item and attach it at the order level.
            </p>
          ) : (
            <>
              <p style={{ fontFamily: font, fontSize: 13, color: "hsl(var(--foreground))", margin: 0 }}>Select the line item to link this file to.</p>
              <div className="flex flex-col" style={{ gap: 6 }}>
                {lines.map((li) => {
                  const checked = selected === li.id;
                  return (
                    <label key={li.id} className="flex items-center cursor-pointer hover:bg-[var(--primary-50)]" style={{ padding: 10, border: `1px solid ${checked ? "var(--primary-200)" : "hsl(var(--border))"}`, borderRadius: 8, background: checked ? "var(--primary-50)" : "hsl(var(--background))", gap: 10 }}>
                      <input type="radio" checked={checked} onChange={() => setSelected(li.id)} style={{ width: 16, height: 16 }} />
                      <div className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))" }}>{li.itemCode}</span>
                        <span style={{ fontFamily: font, fontSize: 11, color: "var(--text-tertiary)" }}>{li.itemName}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
          <div className="flex" style={{ gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={onClose} className="hover:bg-[var(--surface-secondary)]" style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontFamily: font, fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))", cursor: "pointer" }}>Cancel</button>
            <button
              onClick={() => { if (direction === "to-order") onConvertToOrder(att.id); else onConvertToItem(att.id, selected); }}
              disabled={direction === "to-item" && !selected}
              className="hover:bg-[#0862D0]"
              style={{ height: 36, padding: "0 16px", borderRadius: 8, border: 0, background: (direction === "to-item" && !selected) ? "hsl(var(--muted))" : "hsl(var(--primary))", color: (direction === "to-item" && !selected) ? "hsl(var(--muted-foreground))" : "#FFFFFF", fontFamily: font, fontSize: 13, fontWeight: 600, cursor: (direction === "to-item" && !selected) ? "not-allowed" : "pointer" }}
            >
              {direction === "to-order" ? "Move" : "Link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
