/*
 * AAA-compliant status badge colors for inventory items.
 * Mirrors VendorStatusBadge contrast targets, with status set adapted to Items.
 *
 * In Stock:     #065F46 on #ECFDF5 — green
 * Low Stock:    #92400E on #FFFBEB — amber
 * Out of Stock: #991B1B on #FEF2F2 — red
 * Discontinued: #475569 on #F1F5F9 — slate
 * Archived:     #475569 on #F8FAFC — slate softer
 */

export type ItemStatus =
  | "Active"
  | "Inactive"
  | "In Stock"
  | "Low Stock"
  | "Out of Stock"
  | "Discontinued"
  | "Archived";

const statusStyles: Record<ItemStatus, { bg: string; text: string; border: string; dot: string }> = {
  Active: {
    bg: "#F0FDF4",
    text: "#15803D",
    border: "#BBF7D0",
    dot: "#16A34A",
  },
  Inactive: {
    bg: "#FFFBEB",
    text: "#92400E",
    border: "#FDE68A",
    dot: "#D97706",
  },
  "In Stock": {
    bg: "#ECFDF5",
    text: "#065F46",
    border: "#A7F3D0",
    dot: "#059669",
  },
  "Low Stock": {
    bg: "#FFFBEB",
    text: "#92400E",
    border: "#FDE68A",
    dot: "#D97706",
  },
  "Out of Stock": {
    bg: "#FEF2F2",
    text: "#991B1B",
    border: "#FECACA",
    dot: "#DC2626",
  },
  Discontinued: {
    bg: "#F1F5F9",
    text: "#475569",
    border: "#E2E8F0",
    dot: "#64748B",
  },
  Archived: {
    bg: "#F8FAFC",
    text: "#475569",
    border: "#E2E8F0",
    dot: "#94A3B8",
  },
};

interface ItemStatusBadgeProps {
  status: string;
}

export function ItemStatusBadge({ status }: ItemStatusBadgeProps) {
  const s = statusStyles[status as ItemStatus] ?? statusStyles.Active;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap shrink-0"
      style={{
        fontWeight: 500,
        backgroundColor: s.bg,
        color: s.text,
        borderColor: s.border,
      }}
    >
      {status}
    </span>
  );
}

/** Status dot color used by inline filter rows (mirrors VendorStatusBadge → ColumnHeaderMenu pattern). */
export function getItemStatusDotColor(status: string): string {
  return statusStyles[status as ItemStatus]?.dot ?? "#6B7280";
}
