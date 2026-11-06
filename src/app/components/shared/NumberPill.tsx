import React from "react";

/* ════════════════════════════════════════════════════════════════
   NumberPill — single source of truth for the small numeric chip
   that appears next to tab labels, section titles, filter pills,
   table sub-headers, etc.

   Surfaces:
     • "default": white-card surface — gray pill with slate text.
     • "muted":   the pill itself sits on a gray strip (e.g. tabs
                 with `bg-muted`). Background flips to white so the
                 number stays legible.
     • "primary": carried inside a primary-tinted filter pill or
                 active state — uses tinted primary chrome.
   ═══════════════════════════════════════════════════════════════ */

export type NumberPillSurface = "default" | "muted" | "primary";

interface NumberPillProps {
  count: number | string;
  surface?: NumberPillSurface;
  className?: string;
  title?: string;
}

const VARIANT: Record<NumberPillSurface, React.CSSProperties> = {
  default: {
    background: "#F1F5F9",
    color: "#475569",
  },
  muted: {
    background: "#FFFFFF",
    color: "#475569",
    border: "1px solid #E2E8F0",
  },
  primary: {
    background: "rgba(27, 110, 243, 0.16)",
    color: "var(--primary)",
  },
};

export function NumberPill({ count, surface = "default", className, title }: NumberPillProps) {
  const v = VARIANT[surface];
  // Partner-style count badge — perfect circle when the value is ≤ 99 (any
  // single- or double-digit number fits the circle), oval only when the
  // count overflows to 3+ digits and needs the extra horizontal padding.
  const numericCount = typeof count === "number" ? count : Number(count);
  const isShortCount = !Number.isNaN(numericCount) && numericCount <= 99;
  return (
    <span
      className={`inline-flex items-center justify-center tabular-nums ${className ?? ""}`.trim()}
      title={title}
      style={{
        ...v,
        padding: isShortCount ? 0 : "1px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        minWidth: isShortCount ? 18 : 20,
        width: isShortCount ? 18 : undefined,
        height: 18,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {count}
    </span>
  );
}

export default NumberPill;
