/**
 * AcquisitionMix — Proportional segmented bar with legend & hover.
 *
 * Portable: copy this file + `widget-utils.ts` + `widget-primitives.tsx`.
 * Dependencies: React, Tailwind CSS v4.  (No Chart.js needed.)
 */

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { FONT, PERIOD_OPTIONS } from "./widget-utils";
import { WidgetHeader, SmallSelect } from "./widget-primitives";

export function AcquisitionMix() {
  const [period, setPeriod] = useState("This Week");

  const periodData: Record<string, { label: string; value: number; color: string }[]> = {
    Today: [
      { label: "Purchased", value: 35, color: "var(--piw-chart-1)" },
      { label: "Manufactured", value: 15, color: "var(--piw-chart-2)" },
    ],
    "This Week": [
      { label: "Purchased", value: 280, color: "var(--piw-chart-1)" },
      { label: "Manufactured", value: 120, color: "var(--piw-chart-2)" },
    ],
    "Last Week": [
      { label: "Purchased", value: 250, color: "var(--piw-chart-1)" },
      { label: "Manufactured", value: 140, color: "var(--piw-chart-2)" },
    ],
    Monthly: [
      { label: "Purchased", value: 1020, color: "var(--piw-chart-1)" },
      { label: "Manufactured", value: 480, color: "var(--piw-chart-2)" },
    ],
    Quarterly: [
      { label: "Purchased", value: 2850, color: "var(--piw-chart-1)" },
      { label: "Manufactured", value: 1350, color: "var(--piw-chart-2)" },
    ],
    Yearly: [
      { label: "Purchased", value: 10500, color: "var(--piw-chart-1)" },
      { label: "Manufactured", value: 5200, color: "var(--piw-chart-2)" },
    ],
    "Custom Date": [
      { label: "Purchased", value: 540, color: "var(--piw-chart-1)" },
      { label: "Manufactured", value: 260, color: "var(--piw-chart-2)" },
    ],
  };

  const segments = periodData[period] || periodData["This Week"];
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon={BarChart3}
        title="Acquisition Mix"
        subtitle="Source breakdown"
        description="Stacked bar chart showing how inventory was acquired — purchased vs. manufactured — to understand sourcing composition over time."
        right={
          <SmallSelect
            options={[...PERIOD_OPTIONS]}
            defaultValue="This Week"
            onChange={setPeriod}
          />
        }
      />

      {/* Hero total */}
      <div
        className="flex items-baseline"
        style={{ gap: "var(--spacing-1-5)", marginBottom: "var(--spacing-2-5)" }}
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
          {total}
        </span>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: "var(--font-weight-normal)" as any,
            fontSize: "var(--text-caption)",
            color: "var(--text-tertiary)",
          }}
        >
          Total EA
        </span>
      </div>

      {/* Proportional bar */}
      <div
        className="flex overflow-hidden"
        style={{ height: "20px", borderRadius: "100px", gap: "2px" }}
      >
        {segments.map((seg) => {
          const isHovered = hovered === seg.label;
          const isDimmed = hovered !== null && !isHovered;
          return (
            <div
              key={seg.label}
              style={{
                width: `${(seg.value / total) * 100}%`,
                background: seg.color,
                borderRadius: "var(--radius-sm)",
                opacity: isDimmed ? 0.35 : 1,
                transition: "opacity 0.2s ease",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHovered(seg.label)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </div>

      {/* Hover tooltip — appears above bar */}
      <div
        style={{
          height: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "var(--spacing-1)",
        }}
      >
        {hovered && (() => {
          const seg = segments.find((s) => s.label === hovered);
          if (!seg) return null;
          const pct = Math.round((seg.value / total) * 100);
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
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "2px",
                  background: seg.color,
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
                {seg.label}
              </span>
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: "var(--text-caption)",
                  fontWeight: "var(--font-weight-medium)" as any,
                  color: "var(--text-secondary)",
                }}
              >
                {seg.value} EA · {pct}%
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
          gap: "var(--spacing-2)",
        }}
      >
        {segments.map((seg) => {
          const pct = Math.round((seg.value / total) * 100);
          const isHoveredRow = hovered === seg.label;
          return (
            <div
              key={seg.label}
              className="flex items-center justify-between"
              style={{
                padding: "var(--spacing-1) var(--spacing-1-5)",
                borderRadius: "var(--radius-sm)",
                transition: "background 0.15s ease",
                background: isHoveredRow ? "var(--surface-secondary)" : "transparent",
                cursor: "default",
              }}
              onMouseEnter={() => setHovered(seg.label)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className="flex items-center"
                style={{ gap: "var(--spacing-2)" }}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: "8px",
                    height: "8px",
                    background: seg.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-weight-medium)" as any,
                    color: "var(--piw-foreground)",
                  }}
                >
                  {seg.label}
                </span>
              </div>
              <div
                className="flex items-center"
                style={{ gap: "var(--spacing-2)" }}
              >
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-weight-semibold)" as any,
                    color: "var(--piw-foreground)",
                  }}
                >
                  {seg.value} EA
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