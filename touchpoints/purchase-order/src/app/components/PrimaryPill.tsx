import React from "react";
import { Star } from "lucide-react";

/**
 * Canonical "Primary" pill used wherever the system marks a row as
 * the primary item in a side / list (primary carrier, primary
 * payment method, primary contact, primary group, etc.).
 *
 * The look: light-blue tint, blue border, dark-blue label, filled
 * blue Star — mirrored from the Partners app so primary indicators
 * feel identical at every touchpoint.
 *
 * Sizes:
 *   "sm" (default) — 10px text, used on cards.
 *   "xs"           — 9px text, used in tight rows (table cells,
 *                    dense chip strips).
 */
export function PrimaryPill({
  size = "sm",
  className = "",
}: {
  size?: "sm" | "xs";
  className?: string;
}) {
  const text = size === "xs" ? "text-[9px]" : "text-[10px]";
  const padX = size === "xs" ? "px-1.5" : "px-2";
  const padY = size === "xs" ? "py-[1px]" : "py-[2px]";
  return (
    <span
      className={`inline-flex items-center gap-1 ${padX} ${padY} rounded-md text-blue-800 bg-blue-50 border border-blue-200 ${text} ${className}`}
      style={{ fontWeight: 600 }}
    >
      <Star className="w-2.5 h-2.5 fill-blue-800 text-blue-800" />
      Primary
    </span>
  );
}
