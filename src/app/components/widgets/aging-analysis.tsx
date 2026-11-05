/**
 * AgingAnalysis — Horizontal stacked bars showing inventory age distribution.
 *
 * Pure React (no Chart.js). Follows the acquisition-mix pattern with
 * proportional bars, hover interaction, and legend.
 *
 * Portable: copy this file + `widget-utils.ts` + `widget-primitives.tsx`.
 */

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { FONT } from "./widget-utils";
import { WidgetHeader } from "./widget-primitives";

interface AgeBucket {
  label: string;
  shortLabel: string;
  qty: number;
  color: string;
}

const AGE_BUCKETS: AgeBucket[] = [
  { label: "0–30 Days", shortLabel: "0-30d", qty: 210, color: "var(--piw-accent)" },
  { label: "31–60 Days", shortLabel: "31-60d", qty: 120, color: "var(--piw-chart-1)" },
  { label: "61–90 Days", shortLabel: "61-90d", qty: 65, color: "var(--piw-chart-3)" },
  { label: "90+ Days", shortLabel: "90d+", qty: 55, color: "var(--piw-destructive)" },
];

export function AgingAnalysis() {
  const total = AGE_BUCKETS.reduce((s, b) => s + b.qty, 0);
  const [hovered, setHovered] = useState<string | null>(null);

  /* Find the freshness score: % of stock under 60 days */
  const freshPct = Math.round(
    ((AGE_BUCKETS[0].qty + AGE_BUCKETS[1].qty) / total) * 100
  );

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon={CalendarClock}
        title="Aging Analysis"
        subtitle="Inventory age distribution"
        description="Horizontal bar chart breaking down inventory into age buckets (0–30 days, 30–60, 60–90, 90+), highlighting slow-moving or stale stock that may need attention."
      />

      {/* Hero value */}
      <div
        className="flex items-baseline"
        style={{ gap: "var(--spacing-1-5)", marginBottom: "var(--spacing-3)" }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontWeight: "var(--font-weight-semibold)" as any,
            fontSize: "var(--text-h4)",
            color: "var(--piw-foreground)",
            lineHeight: 1,
          }}
        >
          {freshPct}%
        </span>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: "var(--font-weight-normal)" as any,
            fontSize: "var(--text-caption)",
            color: "var(--text-tertiary)",
          }}
        >
          Fresh (&lt;60d)
        </span>
      </div>

      {/* Stacked horizontal bar */}
      <div
        className="flex overflow-hidden"
        style={{ height: "20px", borderRadius: "100px", gap: "2px" }}
      >
        {AGE_BUCKETS.map((bucket) => {
          const isHov = hovered === bucket.label;
          const isDimmed = hovered !== null && !isHov;
          return (
            <div
              key={bucket.label}
              style={{
                width: `${(bucket.qty / total) * 100}%`,
                background: bucket.color,
                borderRadius: "var(--radius-sm)",
                opacity: isDimmed ? 0.35 : 1,
                transition: "opacity 0.2s ease",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHovered(bucket.label)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </div>

      {/* Hover tooltip — absolute so no layout shift */}
      <div
        style={{
          height: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "var(--spacing-1)",
          position: "relative",
        }}
      >
        {hovered &&
          (() => {
            const b = AGE_BUCKETS.find((x) => x.label === hovered);
            if (!b) return null;
            const pct = Math.round((b.qty / total) * 100);
            return (
              <div
                className="flex items-center"
                style={{
                  position: "absolute",
                  gap: "var(--spacing-1-5)",
                  background: "var(--piw-card)",
                  border: "1px solid var(--piw-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--spacing-1) var(--spacing-2-5)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "2px",
                    background: b.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-caption)",
                    fontWeight: "var(--font-weight-semibold)" as any,
                    color: "var(--piw-foreground)",
                  }}
                >
                  {b.label}
                </span>
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-caption)",
                    fontWeight: "var(--font-weight-medium)" as any,
                    color: "var(--text-secondary)",
                  }}
                >
                  {b.qty} EA · {pct}%
                </span>
              </div>
            );
          })()}
      </div>

      {/* Legend rows */}
      <div
        className="flex flex-col"
        style={{
          marginTop: "auto",
          gap: "var(--spacing-2)",
        }}
      >
        {AGE_BUCKETS.map((b) => {
          const pct = Math.round((b.qty / total) * 100);
          const isHovRow = hovered === b.label;
          return (
            <div
              key={b.label}
              className="flex items-center justify-between"
              style={{
                padding: "var(--spacing-1) var(--spacing-1-5)",
                borderRadius: "var(--radius-sm)",
                transition: "background 0.15s ease",
                background: isHovRow ? "var(--surface-secondary)" : "transparent",
                cursor: "default",
              }}
              onMouseEnter={() => setHovered(b.label)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-center" style={{ gap: "var(--spacing-2)" }}>
                <div
                  className="rounded-full"
                  style={{ width: "8px", height: "8px", background: b.color, flexShrink: 0 }}
                />
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-weight-medium)" as any,
                    color: "var(--piw-foreground)",
                  }}
                >
                  {b.label}
                </span>
              </div>
              <div className="flex items-center" style={{ gap: "var(--spacing-2)" }}>
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-weight-semibold)" as any,
                    color: "var(--piw-foreground)",
                  }}
                >
                  {b.qty} EA
                </span>
                <span
                  className="rounded-[var(--radius-sm)]"
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-caption)",
                    fontWeight: "var(--font-weight-semibold)" as any,
                    color: "var(--text-secondary)",
                    background: "var(--surface-secondary)",
                    padding: "1px var(--spacing-1-5)",
                    minWidth: "32px",
                    textAlign: "center",
                  }}
                >
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}