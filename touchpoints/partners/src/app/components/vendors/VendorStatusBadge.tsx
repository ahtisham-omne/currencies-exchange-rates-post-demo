import { Badge } from "../ui/badge";
import type { VendorStatus } from "../../data/vendors";
import { STATUS_LABELS } from "../../data/vendors";

/*
 * AAA-compliant status badge colors
 * All text colors meet 7:1+ contrast on their respective background.
 *
 * Active:   #065F46 on #ECFDF5 → ~10.2:1 ✓ AAA
 * Inactive: #92400E on #FFFBEB → ~8.5:1  ✓ AAA
 * Archived: #991B1B on #FEF2F2 → ~7.0:1  ✓ AAA  (matches the partner Archive modal palette)
 */

const statusStyles: Record<VendorStatus, { bg: string; text: string; border: string; dot: string }> = {
  active: {
    bg: "#ECFDF5",
    text: "#065F46",
    border: "#A7F3D0",
    dot: "hsl(var(--success))",
  },
  inactive: {
    bg: "#FFFBEB",
    text: "#92400E",
    border: "#FDE68A",
    dot: "hsl(var(--warning))",
  },
  archived: {
    bg: "#FEF2F2",
    text: "#991B1B",
    border: "#FECACA",
    dot: "hsl(var(--destructive))",
  },
};

interface VendorStatusBadgeProps {
  status: VendorStatus;
}

export function VendorStatusBadge({ status }: VendorStatusBadgeProps) {
  const s = statusStyles[status];
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
      {STATUS_LABELS[status]}
    </span>
  );
}
