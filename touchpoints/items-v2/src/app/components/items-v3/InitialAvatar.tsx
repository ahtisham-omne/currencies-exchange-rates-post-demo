// Initial avatar atom — Partners-aligned person-cell idiom:
// circular shape, tinted background by name hash, slate-700 bold initials.
// Sizes mirror Partners VendorsListPage cells: sm = 7 (condensed), md = 8 (comfort).
import React from "react";

// Partners' TINTS palette (5 pairs incl. fallback) — verbatim hex values.
const PALETTE: Array<{ bg: string; text: string }> = [
  { bg: "#EBF3FF", text: "hsl(var(--primary))" },        // blue
  { bg: "#F0EBFF", text: "hsl(var(--violet, 262 83% 58%))" }, // violet (fallback HSL if token missing)
  { bg: "#E8FAF3", text: "hsl(var(--success, 142 71% 36%))" }, // green
  { bg: "#FEF5E7", text: "#B45D04" },                    // amber
  { bg: "#FFE8EC", text: "#BE185D" },                    // pink (5th slot to widen the spread)
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h) + name.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function getAvatarTint(name: string): { bg: string; text: string } {
  return PALETTE[hashName(name) % PALETTE.length];
}

export interface InitialAvatarProps {
  name: string;
  /** sm = 7 (condensed cell), md = 8 (comfort cell), lg = 10 (header avatar) */
  size?: "sm" | "md" | "lg";
  /** Square (rounded-lg) instead of the default circle — matches the
   *  Partners listing company/logo avatar (LogoAvatar type="logo"). */
  square?: boolean;
  className?: string;
}

/**
 * InitialAvatar — Partners-literal flat colored square-rounded avatar.
 * Renders initials over a tinted background; color is deterministic per name.
 * Defaults match Partners' condensed table cell: w-8 h-8, fontSize 11, fontWeight 700.
 */
export function InitialAvatar({ name, size = "sm", square = false, className = "" }: InitialAvatarProps) {
  const t = getAvatarTint(name);
  const dims = size === "lg" ? "w-10 h-10" : size === "md" ? "w-8 h-8" : "w-7 h-7";
  const fs = size === "lg" ? 11 : size === "md" ? 10 : 9;
  return (
    <div
      className={`${dims} ${square ? "rounded-lg" : "rounded-full"} flex items-center justify-center shrink-0 border border-[#E8ECF1] text-slate-700 ${className}`}
      style={{ backgroundColor: t.bg, fontSize: fs, fontWeight: 700 }}
    >
      {getInitials(name)}
    </div>
  );
}
