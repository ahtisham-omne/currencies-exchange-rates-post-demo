import { Badge } from "@/components/ui/badge";

export type ItemStatus = "In Stock" | "Low Stock" | "Out of Stock" | "Discontinued" | "Archived";

/*
 * AAA-compliant status badge colors for inventory items.
 * Mirrors the shape & contrast targets of Partners' VendorStatusBadge.
 *
 * In Stock:     #065F46 on #ECFDF5 — green, healthy
 * Low Stock:    #92400E on #FFFBEB — amber, warning
 * Out of Stock: #991B1B on #FEF2F2 — red, critical
 * Discontinued: #475569 on #F1F5F9 — slate, neutral retired
 * Archived:     #475569 on #F8FAFC — slate softer
 */
const statusStyles: Record<ItemStatus, { bg: string; text: string; border: string }> = {
  "In Stock": {
    bg: "#ECFDF5",
    text: "#065F46",
    border: "#A7F3D0",
  },
  "Low Stock": {
    bg: "#FFFBEB",
    text: "#92400E",
    border: "#FDE68A",
  },
  "Out of Stock": {
    bg: "#FEF2F2",
    text: "#991B1B",
    border: "#FECACA",
  },
  Discontinued: {
    bg: "#F1F5F9",
    text: "#475569",
    border: "#E2E8F0",
  },
  Archived: {
    bg: "#F8FAFC",
    text: "#475569",
    border: "#E2E8F0",
  },
};

interface ItemStatusBadgeProps {
  status: string;
}

export function ItemStatusBadge({ status }: ItemStatusBadgeProps) {
  const s = statusStyles[status as ItemStatus] ?? statusStyles["In Stock"];
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
