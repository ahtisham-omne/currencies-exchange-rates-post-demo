import type { CSSProperties } from "react";

/**
 * Shared license-requirement chip used across:
 *  - Module cards / rows in the permission grid (header chip)
 *  - Individual permission rows in the detail modal (next to name)
 *  - The "Requires:" line in the permission detail right panel
 *
 * Visual treatment intentionally matches the existing license chips used on
 * the Users listing (LicenseBadge / LicenseDropdown) so admins immediately
 * recognize the tier.
 */

export type LicenseTier = "Full Access" | "Field User";

const TIER_VISUAL: Record<LicenseTier, { bg: string; color: string; border: string }> = {
  "Full Access": { bg: "#EDE9FE", color: "#5B21B6", border: "#C4B5FD" },
  "Field User":  { bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" },
};

interface Props {
  tier: LicenseTier;
  /** "with-prefix" → "Requires Full Access". "bare" → "Full Access" */
  variant?: "with-prefix" | "bare";
  /** Slightly smaller chip used in the per-row left list */
  size?: "xs" | "sm";
  className?: string;
  style?: CSSProperties;
}

export function LicenseRequirementChip({
  tier,
  variant = "with-prefix",
  size = "sm",
  className,
  style,
}: Props) {
  const v = TIER_VISUAL[tier];
  const label = variant === "with-prefix" ? `Requires ${tier}` : tier;
  const sizeClasses =
    size === "xs"
      ? "px-1.5 py-px text-[10.5px]"
      : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded border whitespace-nowrap ${sizeClasses} ${className ?? ""}`}
      style={{
        fontWeight: 500,
        backgroundColor: v.bg,
        color: v.color,
        borderColor: v.border,
        ...style,
      }}
    >
      {label}
    </span>
  );
}
