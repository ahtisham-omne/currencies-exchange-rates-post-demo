/* ═══════════════════════════════════════════════════════════════
   CENTRAL STATUS BADGE COLOR MAP
   Single source of truth for all PO status badge styling.
   Every component that renders a status badge MUST use this.
   ═══════════════════════════════════════════════════════════════ */

import type { POStatus } from "./poStore";

export interface StatusBadgeStyle {
  bg: string;
  text: string;
  border: string;
}

/**
 * Canonical badge colors for every PO status.
 * Uses CSS variables defined in index.css for theme consistency.
 */
const STATUS_BADGE_MAP: Record<string, StatusBadgeStyle> = {
  Draft: {
    bg: "var(--status-draft-bg)",
    text: "var(--status-draft-text)",
    border: "var(--status-draft-border)",
  },
  Sent: {
    bg: "var(--status-sent-bg)",
    text: "var(--status-sent-text)",
    border: "var(--status-sent-border)",
  },
  Confirmed: {
    bg: "var(--status-confirmed-bg)",
    text: "var(--status-confirmed-text)",
    border: "var(--status-confirmed-border)",
  },
  "Partially Received": {
    bg: "var(--status-partial-bg)",
    text: "var(--status-partial-text)",
    border: "var(--status-partial-border)",
  },
  "Fully Received": {
    bg: "var(--status-received-bg)",
    text: "var(--status-received-text)",
    border: "var(--status-received-border)",
  },
  Cancelled: {
    bg: "var(--status-cancelled-bg)",
    text: "var(--status-cancelled-text)",
    border: "var(--status-cancelled-border)",
  },
  "Active with Cancellation": {
    bg: "var(--status-active-cancel-bg)",
    text: "var(--status-active-cancel-text)",
    border: "var(--status-active-cancel-border)",
  },
  "Active with Cancellations": {
    bg: "var(--status-active-cancel-bg)",
    text: "var(--status-active-cancel-text)",
    border: "var(--status-active-cancel-border)",
  },
  "Closed with Cancellations": {
    bg: "var(--status-closed-cancel-bg)",
    text: "var(--status-closed-cancel-text)",
    border: "var(--status-closed-cancel-border)",
  },
  "Fully Received with Cancellations": {
    bg: "var(--status-closed-cancel-bg)",
    text: "var(--status-closed-cancel-text)",
    border: "var(--status-closed-cancel-border)",
  },
  Closed: {
    bg: "var(--status-closed-cancel-bg)",
    text: "var(--status-closed-cancel-text)",
    border: "var(--status-closed-cancel-border)",
  },
};

const FALLBACK: StatusBadgeStyle = STATUS_BADGE_MAP.Draft;

/**
 * Returns the canonical badge style for any PO status string.
 */
export function getStatusBadgeStyle(status: string): StatusBadgeStyle {
  return STATUS_BADGE_MAP[status] ?? FALLBACK;
}

/**
 * Returns inline React CSS properties for a status badge.
 */
export function getStatusBadgeCss(status: string): React.CSSProperties {
  const s = getStatusBadgeStyle(status);
  return {
    backgroundColor: s.bg,
    color: s.text,
    border: `1px solid ${s.border}`,
  };
}

/**
 * Hard-coded hex equivalents for print view (no CSS variables available).
 */
const PRINT_STATUS_MAP: Record<string, StatusBadgeStyle> = {
  Draft:                               { bg: "#f3f4f6", text: "#4b5563", border: "#e5e7eb" },
  Sent:                                { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  Confirmed:                           { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  "Partially Received":                { bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
  "Fully Received":                    { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  Cancelled:                           { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  "Active with Cancellation":          { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  "Active with Cancellations":         { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  "Closed with Cancellations":         { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  "Fully Received with Cancellations": { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  Closed:                              { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
};

const PRINT_FALLBACK: StatusBadgeStyle = PRINT_STATUS_MAP.Draft;

export function getPrintStatusBadgeStyle(status: string): StatusBadgeStyle {
  return PRINT_STATUS_MAP[status] ?? PRINT_FALLBACK;
}

/**
 * Version status config uses lowercase keys (draft, sent, confirmed, partially-received).
 * This maps them to the canonical colors.
 */
const VERSION_STATUS_KEY_MAP: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  confirmed: "Confirmed",
  "partially-received": "Partially Received",
};

export function getVersionStatusBadgeStyle(versionStatus: string): StatusBadgeStyle {
  const canonical = VERSION_STATUS_KEY_MAP[versionStatus] ?? "Draft";
  return getStatusBadgeStyle(canonical);
}

/**
 * For filter tab styling (lowercase kebab-case keys).
 */
const FILTER_KEY_MAP: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  confirmed: "Confirmed",
  "partially-received": "Partially Received",
  "fully-received": "Fully Received",
  cancelled: "Cancelled",
  "active-cancellation": "Active with Cancellation",
  "closed-cancellations": "Closed with Cancellations",
  closed: "Closed",
};

export function getFilterTabStyle(filterKey: string, active: boolean): React.CSSProperties {
  if (!active) return {};
  const canonical = FILTER_KEY_MAP[filterKey];
  if (!canonical) return { backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))" };
  const s = getStatusBadgeStyle(canonical);
  return { backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` };
}
