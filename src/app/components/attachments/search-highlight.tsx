/**
 * SearchHighlight — Shared utility for highlighting search matches in table cells.
 *
 * Splits text by the search query and wraps matches in a styled `<mark>` span
 * with a warm yellow background and dark text.
 *
 * All visual tokens reference CSS custom properties from the design system.
 */

import React from "react";

const FONT = "var(--font-inter)";

/**
 * Highlights occurrences of `query` within `text`.
 * If query is empty/null, returns text as-is.
 * Case-insensitive matching.
 */
export function HighlightText({
  text,
  query,
  style,
}: {
  text: string;
  query?: string;
  style?: React.CSSProperties;
}) {
  if (!query || !query.trim() || !text) {
    return <>{text}</>;
  }

  const q = query.trim();
  // Escape regex special chars
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  if (parts.length === 1) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = part.toLowerCase() === q.toLowerCase();
        if (isMatch) {
          return (
            <mark
              key={i}
              style={{
                background: "#FEFCE8",
                color: "#854D0E",
                fontFamily: FONT,
                fontWeight: 500,
                borderRadius: "2px",
                padding: "1px 3px",
                margin: "0 -0.5px",
                lineHeight: "inherit",
                ...style,
              }}
            >
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/**
 * TxTypeMini — Compact pill showing a short transaction-type abbreviation
 * (e.g. "RCV", "MOV", "ADJ") with type-appropriate coloring.
 * Replaces the old VersionBadge for the Physical Inventory module.
 */

const TX_MINI_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  Receiving:             { label: "RCV", color: "var(--status-active-text)",  bg: "var(--status-active-bg)",  border: "var(--status-active-border)" },
  "Adjustment Decrease": { label: "ADJ",  color: "var(--tx-type-negative-text)",  bg: "var(--tx-type-negative-bg)",  border: "var(--tx-type-negative-border)" },
  "Adjustment Increase": { label: "ADJ",  color: "var(--status-active-text)",  bg: "var(--status-active-bg)",  border: "var(--status-active-border)" },
  Movement:              { label: "MOV", color: "var(--piw-primary)",             bg: "var(--primary-50)",         border: "var(--primary-200)" },
  Consumption:           { label: "CON", color: "var(--reason-tag-text)",     bg: "var(--reason-tag-bg)",      border: "var(--reason-tag-border)" },
  "Cycle Count":         { label: "CC",  color: "var(--checked-out-tag-text)", bg: "var(--checked-out-tag-bg)", border: "var(--checked-out-tag-border)" },
  Manufactured:          { label: "MFG", color: "var(--status-active-text)",  bg: "var(--status-active-bg)",  border: "var(--status-active-border)" },
  Shipping:              { label: "SHP", color: "var(--piw-primary)",             bg: "var(--primary-50)",         border: "var(--primary-200)" },
  Quarantine:            { label: "QTN", color: "var(--tx-type-warning-text)", bg: "var(--tx-type-warning-bg)", border: "var(--tx-type-warning-border)" },
  "Checked Out":         { label: "CKO", color: "var(--checked-out-tag-text)", bg: "var(--checked-out-tag-bg)", border: "var(--checked-out-tag-border)" },
  "Split LOT":           { label: "SPL", color: "var(--piw-primary)",             bg: "var(--primary-50)",         border: "var(--primary-200)" },
};

const TX_MINI_DEFAULT = { label: "TX", color: "var(--text-secondary)", bg: "var(--surface-secondary)", border: "var(--piw-border)" };

export function TxTypeMini({ type }: { type: string }) {
  const t = TX_MINI_MAP[type] || TX_MINI_DEFAULT;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        fontWeight: "var(--font-weight-semibold)" as any,
        fontSize: "9px",
        color: t.color,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: "var(--radius-sm)",
        padding: "3px 0",
        lineHeight: "14px",
        width: "30px",
        textAlign: "center",
        whiteSpace: "nowrap",
        flexShrink: 0,
        letterSpacing: "0.03em",
      }}
    >
      {t.label}
    </span>
  );
}