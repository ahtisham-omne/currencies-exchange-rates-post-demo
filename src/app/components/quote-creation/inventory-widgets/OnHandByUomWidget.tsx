/**
 * OnHandByUomWidget — SVG donut chart showing on-hand inventory by UOM.
 *
 * Ported verbatim from Physical Inventory v4
 * (`widgets/on-hand-by-uom.tsx`). The only adaptation is the `data`
 * prop replacing the hardcoded UOM_DATA table so the host modal can
 * pipe live numbers in. All interactions are the v4 versions:
 *   • Segment hover dims siblings to 30% opacity
 *   • Floating tooltip below the donut shows
 *     {color dot} {unit} {qty → converted} {pct}
 *   • Legend row hover paints `var(--surface-secondary)` and mirrors
 *     the donut dim/highlight state
 */

import { useState } from "react";
import { PieChart } from "lucide-react";
import { FONT } from "./widget-utils";
import { WidgetHeader } from "./widget-primitives";

export interface UomEntry {
  unit: string;
  qty: number;
  converted: number;
  color: string;
}

export interface OnHandByUomWidgetProps {
  data: UomEntry[];
}

export function OnHandByUomWidget({ data }: OnHandByUomWidgetProps) {
  const totalConverted = data.reduce((s, d) => s + d.converted, 0);
  const [hovered, setHovered] = useState<string | null>(null);

  /* SVG donut parameters — match v4 verbatim. */
  const cx = 70;
  const cy = 70;
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const thickness = 14;

  let cumOffset = 0;
  const segments = data.map((entry) => {
    const pct = totalConverted > 0 ? entry.converted / totalConverted : 0;
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
            stroke="var(--border)"
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
              color: "var(--foreground)",
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

      {/* Hover tooltip — fixed-height reservation so the donut doesn't shift */}
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
            const c = data.find((x) => x.unit === hovered);
            if (!c) return null;
            const pct = totalConverted > 0 ? Math.round((c.converted / totalConverted) * 100) : 0;
            return (
              <div
                className="flex items-center"
                style={{
                  gap: "var(--spacing-1-5)",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--spacing-1) var(--spacing-2-5)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <span
                  style={{ width: "8px", height: "8px", borderRadius: "2px", background: c.color, flexShrink: 0 }}
                />
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-caption)",
                    fontWeight: "var(--font-weight-semibold)" as any,
                    color: "var(--foreground)",
                  }}
                >
                  {c.unit}
                </span>
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-caption)",
                    fontWeight: "var(--font-weight-medium)" as any,
                    color: "var(--text-secondary)",
                  }}
                >
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
        {data.map((item) => {
          const pct = totalConverted > 0 ? Math.round((item.converted / totalConverted) * 100) : 0;
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
                    color: "var(--foreground)",
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
                    color: "var(--foreground)",
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
