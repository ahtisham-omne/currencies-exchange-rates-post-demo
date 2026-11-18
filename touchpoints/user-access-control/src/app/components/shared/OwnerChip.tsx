/**
 * Amber "Owner" chip, visual indicator that a user is a role owner.
 * Replaces the legacy amber crown icon used across UAC views.
 *
 * Styling matches the License chips ("Full Access" / "Field User") used on
 * the Users listing so admins recognize the chip family.
 */
import type { CSSProperties } from "react";

interface Props {
  size?: "xs" | "sm";
  className?: string;
  style?: CSSProperties;
  /** Optional accessible label override */
  ariaLabel?: string;
}

export function OwnerChip({ size = "sm", className, style, ariaLabel }: Props) {
  const sizeClasses =
    size === "xs"
      ? "px-1.5 py-px text-[10.5px]"
      : "px-2 py-0.5 text-xs";
  return (
    <span
      aria-label={ariaLabel ?? "Role owner"}
      className={`inline-flex items-center rounded border whitespace-nowrap ${sizeClasses} ${className ?? ""}`}
      style={{
        fontWeight: 500,
        backgroundColor: "#FEF3C7",
        color: "#92400E",
        borderColor: "#FCD34D",
        ...style,
      }}
    >
      Owner
    </span>
  );
}
