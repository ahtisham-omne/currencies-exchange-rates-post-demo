/**
 * Shared inline progress-fraction cell used for Allocated, Picked, and Shipped
 * columns across the entire SO detail page (Items & Allocation, Picking, Shipping tabs).
 *
 * Renders a numeric fraction (e.g. "15/20") above a colored 3px mini progress bar.
 * The bar TRACK is always visible; only the filled portion changes width/color.
 *
 * Color logic:
 *   - green  (--accent)      → complete (value >= total)
 *   - amber  (--chart-3)     → partial  (value > 0 && value < total)
 *   - blue   (--primary)     → alt partial (opt-in via `altPartialColor`)
 *   - red    (--destructive) → over-allocated (opt-in via `isOver`)
 *   - empty track only       → zero
 *
 * All typography uses CSS custom property tokens (--text-caption, --text-micro,
 * --font-weight-*) to ensure design-system compliance.
 */

interface ProgressFractionCellProps {
  /** Current numerator value (e.g. allocatedQty, pickedQty, shippedQty) */
  value: number;
  /** Denominator (e.g. orderedQty, toShip) */
  total: number;
  /** Show destructive styling when over-allocated */
  isOver?: boolean;
  /** Use --primary instead of --chart-3 for the partial state */
  altPartialColor?: boolean;
  /** Unit label shown after fraction – default hidden */
  unit?: string;
  /** Alignment – "end" (default, right-aligned) or "start" */
  align?: "start" | "end";
}

export function ProgressFractionCell({
  value,
  total,
  isOver = false,
  altPartialColor = false,
  unit,
  align = "end",
}: ProgressFractionCellProps) {
  // Shipment-style chrome: tinted track tinted to the bar color, slightly
  // thicker bar (4px), label uses var(--text-label) so it reads as a primary
  // numeric (matches the shipment line-item table reference design).
  if (total === 0) {
    return (
      <div className={`flex flex-col ${align === "start" ? "items-start" : "items-end"} min-w-[64px]`} style={{ gap: "4px" }}>
        <span className="text-foreground/20 tabular-nums" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>0/0</span>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(15,23,42,0.06)" }} />
      </div>
    );
  }

  const pct = Math.min(100, (value / total) * 100);
  const isFull = value >= total;
  const hasValue = value > 0;

  /* ── Text color ── */
  const fractionColor = isOver
    ? "text-destructive"
    : isFull
      ? "text-success"
      : hasValue
        ? altPartialColor
          ? "text-primary"
          : "text-chart-3"
        : "text-foreground/25";

  /* ── Bar color (CSS var) ── */
  const barColor = isOver
    ? "var(--destructive)"
    : isFull
      ? "var(--success)"
      : hasValue
        ? altPartialColor
          ? "var(--primary)"
          : "var(--chart-3)"
        : "transparent";

  /* ── Track tint — shipment pattern: track shares the bar's hue at ~10% so
        the bar always reads as part of a complete capsule even when empty. */
  const trackTint = isOver
    ? "color-mix(in srgb, var(--destructive) 12%, transparent)"
    : isFull
      ? "color-mix(in srgb, var(--success) 12%, transparent)"
      : hasValue
        ? altPartialColor
          ? "color-mix(in srgb, var(--primary) 12%, transparent)"
          : "color-mix(in srgb, var(--chart-3) 12%, transparent)"
        : "rgba(15,23,42,0.06)";

  const alignClass = align === "start" ? "items-start" : "items-end";

  return (
    <div className={`flex flex-col ${alignClass} min-w-[64px]`} style={{ gap: "4px" }}>
      <span
        className={`tabular-nums ${fractionColor}`}
        style={{
          fontSize: "var(--text-label)",
          fontWeight: "var(--font-weight-semibold)",
          lineHeight: 1.1,
        }}
      >
        {value}/{total}
        {unit && (
          <span
            className="text-muted-foreground uppercase"
            style={{
              fontSize: "var(--text-caption)",
              fontWeight: "var(--font-weight-normal)",
              marginLeft: "2px",
            }}
          >
            {unit}
          </span>
        )}
      </span>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: trackTint }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${isOver ? 100 : pct}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  );
}
