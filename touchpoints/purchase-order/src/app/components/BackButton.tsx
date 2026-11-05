import React from "react";
import { ChevronLeft } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   BackButton — icon-only navigation square, matches Partners'
   VendorDetailsPage back button verbatim
   (`Partners/.../VendorDetailsPage.tsx:737-757`):
     - 44×44 (expanded) rounded-xl square
     - White bg, border-border, subtle elevation shadow
     - ChevronLeft 20×20 in slate-400, slate-50 hover
   Used app-wide via the same component so every detail page gets
   the same back-affordance.
   ═══════════════════════════════════════════════════════════════ */

interface BackButtonProps {
  onClick: () => void;
  /** Kept for API compatibility — no longer rendered. The icon-only
   *  recipe matches Partners which never shows a "Back" label. */
  label?: string;
  title?: string;
  /** Dimmed style for closed/cancelled states. */
  muted?: boolean;
  /** Scroll-morphed compact variant: 32×32 with a 16 px chevron.
   *  Mirrors Partners (`Partners/.../VendorDetailsPage.tsx:739-745`). */
  compact?: boolean;
}

export default function BackButton({ onClick, label = "Back", title, muted = false, compact = false }: BackButtonProps) {
  const size = compact ? 32 : 44;
  const iconSize = compact ? 16 : 20;
  return (
    <button
      onClick={onClick}
      type="button"
      title={title || label}
      aria-label={title || label}
      className="flex items-center justify-center rounded-xl shrink-0"
      style={{
        width: size,
        height: size,
        border: muted
          ? "1px solid color-mix(in srgb, hsl(var(--muted-foreground)) 18%, transparent)"
          : "1px solid hsl(var(--border))",
        backgroundColor: muted ? "color-mix(in srgb, hsl(var(--muted-foreground)) 5%, transparent)" : "#FFFFFF",
        color: muted
          ? "color-mix(in srgb, hsl(var(--muted-foreground)) 55%, transparent)"
          : "#94A3B8" /* slate-400 — matches Partners ChevronLeft tint */,
        // Partners' two-layer micro-shadow (`shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)]`).
        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
        cursor: "pointer",
        // Single 250ms cubic-bezier across every morphed element so the
        // scroll-morph reads as one coordinated animation, not a stagger.
        transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      onMouseEnter={(e) => {
        if (!muted) e.currentTarget.style.backgroundColor = "#F8FAFC" /* slate-50 */;
      }}
      onMouseLeave={(e) => {
        if (!muted) e.currentTarget.style.backgroundColor = "#FFFFFF";
      }}
    >
      <ChevronLeft style={{ width: iconSize, height: iconSize, transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)" }} strokeWidth={2} />
    </button>
  );
}
