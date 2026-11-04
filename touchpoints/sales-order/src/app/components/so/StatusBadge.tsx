import type { SOStatus, ShipmentStatus } from "./types";
import { Copy } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Display labels — maps internal status keys to user-facing strings.
 */
export const SO_STATUS_DISPLAY: Record<SOStatus, string> = {
  Draft: "Draft",
  "Pending Review": "Pending Review",
  Cleared: "Cleared by Ops",
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
  "Partially Shipped": "var(--chart-4)",
  Shipped: "var(--accent)",
  "Partially Cancelled": "var(--destructive)",
  Cancelled: "var(--destructive)",
  Archived: "var(--destructive)",
};

/**
 * Partner-style status pills — NO border/stroke, borderless.
 */
const soStatusConfig: Record<SOStatus, { bg: string; text: string; dot: string }> = {
  Draft:                  { bg: "#F1F5F9", text: "#334155", dot: "#64748B" },
  "Pending Review":       { bg: "#FFFBEB", text: "#92400E", dot: "#D97706" },
  Cleared:               { bg: "#ECFDF5", text: "#065F46", dot: "#059669" },
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

export function ItemTypeBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    Serialized: { bg: "#EFF6FF", text: "#1E40AF" },
    "Non-Serialized": { bg: "#F1F5F9", text: "#475569" },
    "Lot Controlled": { bg: "#F5F3FF", text: "#5B21B6" },
  };
  const c = colors[type] || colors["Non-Serialized"];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.text, fontWeight: 600, borderRadius: 9999, fontSize: 10 }}
    >
      {type}
    </span>
  );
}

export function DuplicateBadge({ ofIndex }: { ofIndex: number }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs whitespace-nowrap"
      style={{ fontSize: "var(--text-micro)", fontWeight: 600, gap: 4, border: "1.5px dashed #574EFA", color: "#574EFA", background: "transparent", borderRadius: 4, lineHeight: 1 }}
    >
      <Copy style={{ width: 10, height: 10, flexShrink: 0 }} />
      Duplicate of #{ofIndex}
    </span>
  );
}

/**
 * PriorityBadge — borderless, matching screenshot colors.
 * Low = gray pill, Standard = blue pill, High = red pill.
 */
export function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    Low: { bg: "#F1F5F9", text: "#475569" },
    Standard: { bg: "#EFF6FF", text: "#1E40AF" },
    High: { bg: "#FEF2F2", text: "#991B1B" },
  };
  const c = config[priority] || config.Low;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.text, fontWeight: 500 }}
    >
      {priority}
    </span>
  );
}
