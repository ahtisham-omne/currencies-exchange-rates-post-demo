/**
 * OnHandByUOM — SVG donut chart showing on-hand inventory by unit of measure,
 * with hover interaction and legend.
 *
 * Pure React (no Chart.js). Uses SVG for the donut ring with animated
 * segments and hover-driven opacity/scale transitions.
 *
 * Portable: copy this file + `widget-utils.ts` + `widget-primitives.tsx`.
 */

import { useState } from "react";
import { PieChart } from "lucide-react";
import { FONT } from "./widget-utils";
import { WidgetHeader } from "./widget-primitives";

interface UomEntry {
  unit: string;
  qty: number;
  converted: number;
  color: string;
}

const UOM_DATA: UomEntry[] = [
  { unit: "Each (EA)", qty: 80, converted: 80, color: "var(--piw-chart-1)" },
  { unit: "Box (2 EA)", qty: 50, converted: 100, color: "var(--piw-chart-2)" },
  { unit: "Carton (8 EA)", qty: 15, converted: 120, color: "var(--piw-chart-3)" },
  { unit: "Pallet (80 EA)", qty: 1.87, converted: 150, color: "var(--piw-chart-4)" },
];

export function OnHandByUOM() {
  const totalConverted = UOM_DATA.reduce((s, d) => s + d.converted, 0);
  const [hovered, setHovered] = useState<string | null>(null);

  /* SVG donut parameters */
  const cx = 70;
  const cy = 70;
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const thickness = 14;

  /* Build segment offsets */
  let cumOffset = 0;
  const segments = UOM_DATA.map((entry) => {
    const pct = entry.converted / totalConverted;
    const dashLen = pct * circumference;
    const gapLen = circumference - dashLen;
    const offset = -cumOffset;
    cumOffset += dashLen;
    return { ...entry, dashLen, gapLen, offset, pct };
  });

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon={PieChart}
        title="On-Hand by Unit of Measure"
        subtitle="Stock breakdown across UOMs"
        description="Donut chart displaying how total on-hand inventory is distributed across different units of measure (EA, Box, Carton, etc.)."
      />

      {/* Donut + center value */}
      <div
        className="flex items-center justify-center"
        style={{ marginBottom: "var(--spacing-2)", position: "relative" }}
      >
        <svg width={140} height={140} viewBox={`0 0 ${cx * 2} ${cy * 2}`}>
          {/* Background ring */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--piw-border)"
            strokeWidth={thickness}
            opacity={0.4}
          />
          {/* Segments */}
          {segments.map((seg) => {
            const isHov = hovered === seg.unit;
            const isDimmed = hovered !== null && !isHov;
            return (
              <circle
                key={seg.unit}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${seg.dashLen} ${seg.gapLen}`}
                strokeDashoffset={seg.offset}
                strokeLinecap="butt"
                style={{
                  opacity: isDimmed ? 0.3 : 1,
                  transition: "opacity 0.2s ease",
                  cursor: "pointer",
                  transform: "rotate(-90deg)",
                  transformOrigin: `${cx}px ${cy}px`,
                }}
                onMouseEnter={() => setHovered(seg.unit)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
        </svg>

        {/* Center text */}
        <div
          className="absolute flex flex-col items-center"
          style={{ pointerEvents: "none" }}
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
            {totalConverted}
          </span>
          <span
            style={{
              fontFamily: FONT,
              fontWeight: "var(--font-weight-normal)" as any,
              fontSize: "var(--text-caption)",
              color: "var(--text-tertiary)",
              lineHeight: 1.4,
              marginTop: "var(--spacing-0-5)",
            }}
          >
            Total EA
          </span>
        </div>
      </div>

      {/* Hover tooltip */}
      <div
        style={{
          height: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "var(--spacing-1)",
        }}
      >
        {hovered &&
          (() => {
            const c = UOM_DATA.find((x) => x.unit === hovered);
            if (!c) return null;
            const pct = Math.round((c.converted / totalConverted) * 100);
            return (
              <div
                className="flex items-center"
                style={{
                  gap: "var(--spacing-1-5)",
                  background: "var(--piw-card)",
                  border: "1px solid var(--piw-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--spacing-1) var(--spacing-2-5)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <span
                  style={{ width: "8px", height: "8px", borderRadius: "2px", background: c.color, flexShrink: 0 }}
                />
                <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" as any, color: "var(--piw-foreground)" }}>
                  {c.unit}
                </span>
                <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-secondary)" }}>
                  {c.qty} qty &rarr; {c.converted} EA &middot; {pct}%
                </span>
              </div>
            );
          })()}
      </div>

      {/* Legend */}
      <div
        className="flex flex-col"
        style={{
          marginTop: "auto",
          gap: "var(--spacing-1-5)",
        }}
      >
        {UOM_DATA.map((item) => {
          const pct = Math.round((item.converted / totalConverted) * 100);
          const isHovRow = hovered === item.unit;
          return (
            <div
              key={item.unit}
              className="flex items-center justify-between"
              style={{
                padding: "var(--spacing-0-5) var(--spacing-1-5)",
                borderRadius: "var(--radius-sm)",
                transition: "background 0.15s ease",
                background: isHovRow ? "var(--surface-secondary)" : "transparent",
                cursor: "default",
              }}
              onMouseEnter={() => setHovered(item.unit)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-center" style={{ gap: "var(--spacing-2)" }}>
                <div
                  className="rounded-full"
                  style={{ width: "8px", height: "8px", background: item.color, flexShrink: 0 }}
                />
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-weight-medium)" as any,
                    color: "var(--piw-foreground)",
                  }}
                >
                  {item.unit}
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
                  {item.converted}
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