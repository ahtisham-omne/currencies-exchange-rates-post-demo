import { Star } from "lucide-react";

/**
 * Canonical "Primary" pill used wherever the system marks a row as
 * the primary item in a side / list. Mirrors Partner Management.
 */
export function PrimaryPill({ size = "sm", className = "" }: { size?: "sm" | "xs"; className?: string }) {
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
