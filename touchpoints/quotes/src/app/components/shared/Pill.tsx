import React from "react";

/**
 * Inline status/type pill — Partner-aligned chrome.
 *
 * Reference: Partner's `VendorStatusBadge` (rounded-full + 1px colored
 * border + solid bg + AAA-compliant text on bg).
 *
 * All pills across Quote — type chips ("Customer", "Vendor"), state chips
 * ("Active", "Inactive", "Default", "Primary"), and tag chips — should
 * use this primitive instead of hand-rolling inline class strings.
 */
type Variant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "destructive"
  | "violet"
  | "neutral";

const variantTokens: Record<Variant, { bg: string; text: string; border: string }> = {
  // Light blue tint — type chips ("Customer", "Vendor", location), Default
  default:    { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  // Solid primary — "Primary" tag (high-emphasis)
  primary:    { bg: "var(--primary)", text: "#FFFFFF", border: "var(--primary)" },
  // Green — "Active", "Confirmed"
  success:    { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  // Amber — "Inactive", warnings
  warning:    { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  // Red — "Cancelled", "Archived", errors
  destructive:{ bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  // Purple — premiums, special tags
  violet:     { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
  // Slate — generic / muted
  neutral:    { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" },
};

export function Pill({
  variant = "default",
  children,
  className,
}: {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}) {
  const t = variantTokens[variant];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap shrink-0 ${className ?? ""}`}
      style={{
        fontWeight: 500,
        backgroundColor: t.bg,
        color: t.text,
        borderColor: t.border,
      }}
    >
      {children}
    </span>
  );
}
