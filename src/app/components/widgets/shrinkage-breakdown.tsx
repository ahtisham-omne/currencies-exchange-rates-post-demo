/**
 * ShrinkageBreakdown — Horizontal stacked bar showing inventory shrinkage
 * by cause, with hover interaction and legend.
 *
 * Layout matches Aging Analysis: hero → full-width bar → legend rows below.
 * Layout is identical at every widget size (sm/md/lg).
 *
 * Portable: copy this file + `widget-utils.ts` + `widget-primitives.tsx`.
 */

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { FONT, PERIOD_OPTIONS } from "./widget-utils";
import { WidgetHeader, SmallSelect } from "./widget-primitives";

interface ShrinkageCause {
  label: string;
  qty: number;
  color: string;
}

const CAUSES: ShrinkageCause[] = [
  { label: "Damage", qty: 12, color: "var(--piw-chart-1)" },
  { label: "Obsolescence", qty: 8, color: "var(--piw-chart-3)" },
  { label: "Admin Error", qty: 5, color: "var(--piw-chart-4)" },
  { label: "Theft/Loss", qty: 3, color: "var(--piw-destructive)" },
  { label: "Other", qty: 2, color: "var(--piw-chart-2)" },
];

export function ShrinkageBreakdown() {
  const total = CAUSES.reduce((s, c) => s + c.qty, 0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [, setPeriod] = useState("This Week");

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon={AlertTriangle}
        title="Quarantined Units Breakdown"
        subtitle="Quarantined by cause category"
        description="Horizontal bar chart categorizing quarantined inventory by cause (Damage, Obsolescence, Admin Error, Theft/Loss, Other), highlighting primary drivers of inventory quarantine."
        right={
          <SmallSelect
            options={[...PERIOD_OPTIONS]}
            defaultValue="This Week"
            onChange={setPeriod}
          />
        }
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
          {total} EA
        </span>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: "var(--font-weight-normal)" as any,
            fontSize: "var(--text-caption)",
            color: "var(--text-tertiary)",
          }}
        >
          Total Lost
        </span>
      </div>

      {/* Stacked horizontal bar */}
      <div
        className="flex overflow-hidden"
        style={{ height: "20px", borderRadius: "100px", gap: "2px" }}
      >
        {CAUSES.map((cause) => {
          const isHov = hovered === cause.label;
          const isDimmed = hovered !== null && !isHov;
          return (
            <div
              key={cause.label}
              style={{
                width: `${(cause.qty / total) * 100}%`,
                background: cause.color,
                borderRadius: "var(--radius-sm)",
                opacity: isDimmed ? 0.35 : 1,
                transition: "opacity 0.2s ease",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHovered(cause.label)}
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
            const c = CAUSES.find((x) => x.label === hovered);
            if (!c) return null;
            const pct = Math.round((c.qty / total) * 100);
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
                    background: c.color,
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
                  {c.label}
                </span>
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-caption)",
                    fontWeight: "var(--font-weight-medium)" as any,
                    color: "var(--text-secondary)",
                  }}
                >
                  {c.qty} EA · {pct}%
                </span>
              </div>
            );
          })()}
      </div>

      {/* Legend rows — anchored to bottom */}
      <div
        className="flex flex-col"
        style={{
          marginTop: "auto",
          gap: "var(--spacing-2)",
        }}
      >
        {CAUSES.map((c) => {
          const pct = Math.round((c.qty / total) * 100);
          const isHovRow = hovered === c.label;
          return (
            <div
              key={c.label}
              className="flex items-center justify-between"
              style={{
                padding: "var(--spacing-1) var(--spacing-1-5)",
                borderRadius: "var(--radius-sm)",
                transition: "background 0.15s ease",
                background: isHovRow ? "var(--surface-secondary)" : "transparent",
                cursor: "default",
              }}
              onMouseEnter={() => setHovered(c.label)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-center" style={{ gap: "var(--spacing-2)" }}>
                <div
                  className="rounded-full"
                  style={{ width: "8px", height: "8px", background: c.color, flexShrink: 0 }}
                />
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-weight-medium)" as any,
                    color: "var(--piw-foreground)",
                  }}
                >
                  {c.label}
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
                  {c.qty} EA
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
