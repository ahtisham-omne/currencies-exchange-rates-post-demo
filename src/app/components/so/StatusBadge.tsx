import type { SOStatus, ShipmentStatus } from "./types";
import { Copy } from "lucide-react";
import type { ReactNode } from "react";
import { LotTrackingTag } from "@/app/components/shared/LotTrackingTag";

/**
 * Display labels — maps internal status keys to user-facing strings.
 */
export const SO_STATUS_DISPLAY: Record<SOStatus, string> = {
  Draft: "Draft",
  "Pending Review": "Pending Review",
  Cleared: "Released",
  Rejected: "Rejected",
  "Partially Shipped": "Partially Shipped",
  Shipped: "Shipped",
  "Partially Cancelled": "Partially Cancelled",
  Cancelled: "Cancelled",
  Archived: "Archived",
};

export const SO_STATUS_CSS_VAR: Record<SOStatus, string> = {
  Draft: "var(--foreground)",
  "Pending Review": "var(--chart-3)",
  Cleared: "var(--primary)",
  Rejected: "var(--destructive)",
  "Partially Shipped": "var(--chart-4)",
  Shipped: "var(--success)",
  "Partially Cancelled": "var(--destructive)",
  Cancelled: "var(--destructive)",
  Archived: "var(--destructive)",
};

/**
 * Partner-style status pills — NO border/stroke, borderless.
 * Rejected shares the destructive palette with Cancelled since the
 * two states carry the same visual weight (terminal + red tokens).
 */
const soStatusConfig: Record<SOStatus, { bg: string; text: string; dot: string }> = {
  Draft:                  { bg: "#F1F5F9", text: "#334155", dot: "#64748B" },
  "Pending Review":       { bg: "#FFFBEB", text: "#92400E", dot: "#D97706" },
  Cleared:               { bg: "#E5F0FF", text: "#0F62D6", dot: "#0A77FF" },
  Rejected:              { bg: "#FEF2F2", text: "#991B1B", dot: "#DC2626" },
  "Partially Shipped":    { bg: "#F5F3FF", text: "#5B21B6", dot: "#7C3AED" },
  Shipped:               { bg: "#ECFDF5", text: "#065F46", dot: "#059669" },
  "Partially Cancelled":  { bg: "#FEF2F2", text: "#991B1B", dot: "#DC2626" },
  Cancelled:             { bg: "#FEF2F2", text: "#991B1B", dot: "#DC2626" },
  Archived:              { bg: "#FEF2F2", text: "#991B1B", dot: "#DC2626" },
};

export function SOStatusBadge({ status, trailingIcon }: { status: SOStatus; trailingIcon?: ReactNode }) {
  const c = soStatusConfig[status] || soStatusConfig.Draft;
  const label = SO_STATUS_DISPLAY[status] || status;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap"
      style={{
        backgroundColor: c.bg,
        color: c.text,
        fontWeight: 500,
        border: `1px solid ${c.dot}20`,
      }}
    >
      {label}
      {trailingIcon}
    </span>
  );
}

const shipStatusConfig: Record<ShipmentStatus, { bg: string; text: string; dot: string }> = {
  Draft:          { bg: "#F1F5F9", text: "#334155", dot: "#64748B" },
  "Ready to Pick": { bg: "#EFF6FF", text: "#1E40AF", dot: "#2563EB" },
  "In Progress":  { bg: "#FFFBEB", text: "#92400E", dot: "#D97706" },
  Ready:          { bg: "#F5F3FF", text: "#5B21B6", dot: "#7C3AED" },
  Shipped:        { bg: "#ECFDF5", text: "#065F46", dot: "#059669" },
  Cancelled:      { bg: "#FEF2F2", text: "#991B1B", dot: "#DC2626" },
};

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const c = shipStatusConfig[status] || shipStatusConfig.Draft;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.text, fontWeight: 500, border: `1px solid ${c.dot}20` }}
    >
      {status}
    </span>
  );
}

/**
 * Inline tracking-type glyphs ported verbatim from the Physical Inventory
 * `ControlTypeBadge` (shared-badges.tsx). The exact SVG paths from the
 * canonical badge are reused so Serialized / Non-Serialized read identically
 * to the Physical Inventory module.
 */
const SERIALIZED_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M2.91 12.36H1.45V3.64H2.91M4.36 12.36H3.64V3.64H4.36M7.27 12.36H5.09V3.64H7.27M8.73 12.36H8V3.64H8.73M10.91 12.36H9.45V3.64H10.91M12.36 12.36H11.64V3.64H12.36M14.55 12.36H13.09V3.64H14.55V12.36Z"
      fill="currentColor"
    />
  </svg>
);

const NON_SERIALIZED_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M13.89 15.15L10.67 11.93V12H9.33V10.59L8 9.26V12H7.33V8.59L6.67 7.93V12H4.67V5.93L4 5.26V12H3.33V4.59L0.74 2L1.59 1.15L4.67 4.23L6.67 6.23L7.33 6.89L8 7.56L9.33 8.9V8.89L10.67 10.23V10.23L11.33 10.9V10.89L12.44 12H12.43L14.74 14.31L13.89 15.15ZM10.67 4H9.33V7.2L10.67 8.53V4ZM8 4H7.33V5.2L8 5.87V4ZM13.33 4H11.33V9.2L13.33 11.2V4ZM14.67 12V4H14V11.87L14.13 12H14.67ZM6.67 4H6.13L6.67 4.53V4ZM1.33 12H2.67V4H1.33V12Z"
      fill="currentColor"
    />
  </svg>
);

export function ItemTypeBadge({ type }: { type: string }) {
  // Tracking pill renderer. Non-lot variants use the Physical Inventory
  // `ControlTypeBadge` chrome (surface-secondary bg, foreground text,
  // var(--border) outline, 14×14 SVG glyph). Lot variants use the new
  // two-segment `LotTrackingTag` chrome instead.
  const normalized =
    type === "Lot" ? "Lot Non-Serialized" :
    type === "Lot-Serialized" ? "Lot Serialized" :
    type;
  if (normalized === "Lot Serialized") {
    return <LotTrackingTag type="serialized" />;
  }
  if (normalized === "Lot Non-Serialized") {
    return <LotTrackingTag type="non-serialized" />;
  }
  const isSerialized = normalized === "Serialized";
  /* Verbatim port of Physical Inventory's `ControlTypeBadge`
     (shared-badges.tsx). Same DOM, same className, same inline
     styles. PI's tag tokens resolve to padding 2px/8px, radius 6,
     fontSize 13, fontWeight medium, lineHeight normal, with the
     `--surface-secondary` background, `--foreground` label, and
     `--border` outline. Mirrored exactly in Quote's ItemTypeBadge. */
  return (
    <span
      className="inline-flex items-center gap-1 border shrink-0"
      style={{
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: "nowrap",
        lineHeight: "normal",
        background: "var(--surface-secondary, var(--secondary))",
        color: "var(--foreground)",
        borderColor: "var(--border)",
      }}
    >
      {isSerialized ? SERIALIZED_ICON : NON_SERIALIZED_ICON}
      {normalized}
    </span>
  );
}

/** Convenience helper — convert boolean flags from product/line-item
 *  records into the canonical string label `ItemTypeBadge` expects. */
export function itemTypeLabel(isSerialized?: boolean | null, isLotControlled?: boolean | null): string {
  if (isLotControlled) return isSerialized ? "Lot Serialized" : "Lot Non-Serialized";
  return isSerialized ? "Serialized" : "Non-Serialized";
}

export function DuplicateBadge({ ofIndex }: { ofIndex: number }) {
  // Partner pill chrome — rounded-full + hairline border, matches StatusPill.
  return (
    <span
      className="inline-flex items-center whitespace-nowrap"
      style={{
        fontSize: 11, fontWeight: 500, gap: 4,
        padding: "2px 10px", borderRadius: 9999, lineHeight: 1.4,
        border: "1px solid #DDD6FE", background: "#FFFFFF", color: "#7C3AED",
      }}
    >
      <Copy style={{ width: 11, height: 11, flexShrink: 0 }} />
      Duplicate of #{String(ofIndex).padStart(3, "0")}
    </span>
  );
}

/**
 * PriorityBadge — rounded-full + colored hairline border, matches the Quote
 * module's PriorityBadge chrome so both listings read the same.
 * Low = gray pill, Standard = blue pill, High = red pill.
 */
export function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { bg: string; text: string; border: string }> = {
    Low:      { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
    Standard: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
    High:     { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  };
  const c = config[priority] || config.Low;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap shrink-0"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border, fontWeight: 500 }}
    >
      {priority}
    </span>
  );
}
