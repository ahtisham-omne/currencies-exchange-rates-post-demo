import { LotTrackingTag } from "./LotTrackingTag";

/**
 * ItemTypeBadge — single source of truth for inventory-tracking pills
 * across the Quote module. Mirrors the Physical Inventory
 * `ControlTypeBadge` chrome (surface-secondary background, foreground
 * text, var(--border) outline, 14×14 inline SVG glyph) for the plain
 * Serialized / Non-Serialized variants, and delegates to the shared
 * `LotTrackingTag` (two-segment "Lot | …" capsule) for lot variants.
 *
 * Accepts both the four canonical labels and a few legacy aliases so
 * call-sites can pass whatever the underlying data carries:
 *   "Serialized" | "Non-Serialized"
 *   "Lot Serialized" | "Lot Non-Serialized"
 *   "Lot"           → "Lot Non-Serialized"
 *   "Lot-Serialized" → "Lot Serialized"
 */
/* Physical Inventory's exact ControlTypeBadge glyphs — 14×14 path
   from shared-badges.tsx. Do not resize: that lives outside this
   module's scope. */
const SERIALIZED_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M2.91 12.36H1.45V3.64H2.91M4.36 12.36H3.64V3.64H4.36M7.27 12.36H5.09V3.64H7.27M8.73 12.36H8V3.64H8.73M10.91 12.36H9.45V3.64H10.91M12.36 12.36H11.64V3.64H12.36M14.55 12.36H13.09V3.64H14.55V12.36Z"
      fill="currentColor"
    />
  </svg>
);

const NON_SERIALIZED_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M13.89 15.15L10.67 11.93V12H9.33V10.59L8 9.26V12H7.33V8.59L6.67 7.93V12H4.67V5.93L4 5.26V12H3.33V4.59L0.74 2L1.59 1.15L4.67 4.23L6.67 6.23L7.33 6.89L8 7.56L9.33 8.9V8.89L10.67 10.23V10.23L11.33 10.9V10.89L12.44 12H12.43L14.74 14.31L13.89 15.15ZM10.67 4H9.33V7.2L10.67 8.53V4ZM8 4H7.33V5.2L8 5.87V4ZM13.33 4H11.33V9.2L13.33 11.2V4ZM14.67 12V4H14V11.87L14.13 12H14.67ZM6.67 4H6.13L6.67 4.53V4ZM1.33 12H2.67V4H1.33V12Z"
      fill="currentColor"
    />
  </svg>
);

export function ItemTypeBadge({ type }: { type: string }) {
  const normalized =
    type === "Lot" ? "Lot Non-Serialized" :
    type === "Lot-Serialized" ? "Lot Serialized" :
    type;
  if (normalized === "Lot Serialized") return <LotTrackingTag type="serialized" />;
  if (normalized === "Lot Non-Serialized") return <LotTrackingTag type="non-serialized" />;

  const isSerialized = normalized === "Serialized";
  /* Verbatim port of Physical Inventory's `ControlTypeBadge`
     (shared-badges.tsx). Same DOM, same className, same inline
     styles — `--surface-secondary` background, `--foreground` label,
     `--border` outline, 14×14 inline SVG glyph. PI's tag tokens
     resolve to `padding: 2px 8px / radius: 6 / fontSize: 13 /
     fontWeight: medium / lineHeight: normal`. */
  return (
    <span
      className="inline-flex items-center gap-1 border shrink-0"
      style={{
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: "nowrap",
        lineHeight: "normal",
        background: "var(--surface-secondary, var(--secondary))",
        color: "var(--foreground)",
        borderColor: "var(--border)",
      }}
    >
      {isSerialized ? SERIALIZED_ICON : NON_SERIALIZED_ICON}
      {normalized}
    </span>
  );
}

/** Convenience helper — convert the boolean flags from product/line-item
 *  records into the canonical string label `ItemTypeBadge` expects. */
export function itemTypeLabel(isSerialized?: boolean | null, isLotControlled?: boolean | null): string {
  if (isLotControlled) return isSerialized ? "Lot Serialized" : "Lot Non-Serialized";
  return isSerialized ? "Serialized" : "Non-Serialized";
}
