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
  if (total === 0) {
    // Always show empty progress bar even when total is 0
    return (
      <div className={`flex flex-col ${align === "start" ? "items-start" : "items-end"} min-w-[48px]`} style={{ gap: "4px" }}>
        <span className="text-foreground/20 tabular-nums" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>0/0</span>
        <div className="w-full h-[3px] rounded-full overflow-hidden bg-border/60" />
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
      ? "text-accent"
      : hasValue
        ? altPartialColor
          ? "text-primary"
          : "text-chart-3"
        : "text-foreground/25";

  /* ── Bar color (CSS var) ── */
  const barColor = isOver
    ? "var(--destructive)"
    : isFull
      ? "var(--accent)"
      : hasValue
        ? altPartialColor
          ? "var(--primary)"
          : "var(--chart-3)"
        : "transparent";

  const alignClass = align === "start" ? "items-start" : "items-end";

  return (
    <div className={`flex flex-col ${alignClass} min-w-[48px]`} style={{ gap: "4px" }}>
      <span
        className={`tabular-nums ${fractionColor}`}
        style={{
          fontSize: "var(--text-caption)",
          fontWeight: "var(--font-weight-semibold)",
        }}
      >
        {value}/{total}
        {unit && (
          <span
            className="text-foreground/30 uppercase"
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
      {/* Mini progress bar — ALWAYS rendered so the track is visible */}
      <div className="w-full h-[3px] rounded-full overflow-hidden bg-border/60">
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
