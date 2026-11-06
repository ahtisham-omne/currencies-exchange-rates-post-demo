import React from "react";

/* ════════════════════════════════════════════════════════════════
   OverflowChip — the "+12 more" / "+1 more" pill seen in Partner
   contact / phone / email cells. Primary-blue, no background, hover
   underline. Use it next to a truncated label whenever the underlying
   field has more than one value.
   ═══════════════════════════════════════════════════════════════ */

interface OverflowChipProps {
  count: number;
  /** Optional click handler — if omitted the chip is not interactive. */
  onClick?: () => void;
  /** Optional hover-tooltip listing the additional values. */
  title?: string;
  className?: string;
}

export function OverflowChip({ count, onClick, title, className }: OverflowChipProps) {
  if (count <= 0) return null;
  const interactive = !!onClick;
  const Tag: React.ElementType = interactive ? "button" : "span";
  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={onClick}
      title={title}
      className={`inline-flex items-center ${className ?? ""}`.trim()}
      style={{
        gap: 2,
        height: 18,
        padding: "0 6px",
        borderRadius: 4,
        border: "none",
        background: "transparent",
        color: "var(--primary)",
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1,
        cursor: interactive ? "pointer" : "default",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => { if (interactive) (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
    >
      +{count} more
    </Tag>
  );
}

export default OverflowChip;
