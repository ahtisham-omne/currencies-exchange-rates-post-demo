import React from "react";
import { ChevronLeft } from "lucide-react";
import { FONT } from "./designTokens";

/* ═══════════════════════════════════════════════════════════════
   BackButton — standardized back navigation used app-wide
   Consistent size, styling, and hover behavior everywhere.
   ═══════════════════════════════════════════════════════════════ */

interface BackButtonProps {
  onClick: () => void;
  label?: string;
  title?: string;
  muted?: boolean; // Use dimmed style (for closed/cancelled states)
}

export default function BackButton({ onClick, label = "Back", title, muted = false }: BackButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "0",
        fontSize: "var(--text-label)",
        fontWeight: "var(--font-weight-medium)" as string,
        color: muted ? "color-mix(in srgb, var(--muted-foreground) 60%, transparent)" : "var(--muted-foreground)",
        fontFamily: FONT,
        transition: "color 150ms",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = muted ? "var(--muted-foreground)" : "var(--primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = muted ? "color-mix(in srgb, var(--muted-foreground) 60%, transparent)" : "var(--muted-foreground)";
      }}
      title={title || label}
    >
      <ChevronLeft style={{ width: "14px", height: "14px" }} />
      <span>{label}</span>
    </button>
  );
}
