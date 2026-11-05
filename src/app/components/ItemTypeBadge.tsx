import React from "react";

/**
 * Item tracking-type pill — port of Sales-Order-V5's `ItemTypeBadge`
 * (`so/StatusBadge.tsx`, itself a verbatim port of Physical Inventory's
 * `ControlTypeBadge`). Used by the shared `AdjustmentFormModal` items
 * picker so a line reads the same as it does in Sales Orders. PO items
 * are only Serialized / Non-Serialized, so the lot variants
 * (`LotTrackingTag`) aren't ported.
 */

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
  const isSerialized = type === "Serialized";
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
        background: "var(--surface-secondary, hsl(var(--secondary)))",
        color: "hsl(var(--foreground))",
        borderColor: "hsl(var(--border))",
      }}
    >
      {isSerialized ? SERIALIZED_ICON : NON_SERIALIZED_ICON}
      {isSerialized ? "Serialized" : "Non-Serialized"}
    </span>
  );
}
