/**
 * AdjustmentSummary — Grouped bar chart of positive vs negative inventory
 * adjustments by month, with a net-change overlay line.
 *
 * Portable: copy this file + `widget-utils.ts` + `widget-primitives.tsx`.
 * Dependencies: React, Chart.js, Tailwind CSS v4.
 */

import { useRef, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Chart } from "chart.js";
import {
  FONT,
  resolveVar,
  resolveFont,
  withAlpha,
  externalTooltipHandler,
  chartInteractionConfig,
  chartAnimationConfig,
  PERIOD_OPTIONS,
} from "./widget-utils";
import { WidgetHeader, SmallSelect } from "./widget-primitives";

const DATA: Record<string, { labels: string[]; positive: number[]; negative: number[] }> = {
  Today: {
    labels: ["6am", "9am", "12pm", "3pm", "6pm"],
    positive: [3, 5, 4, 2, 1],
    negative: [-2, -3, -1, -2, -1],
  },
  "This Week": {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    positive: [8, 12, 6, 10, 5, 9, 7],
    negative: [-6, -4, -8, -5, -3, -7, -4],
  },
  "Last Week": {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    positive: [10, 7, 14, 6, 9, 4, 8],
    negative: [-8, -5, -10, -7, -4, -3, -6],
  },
  Monthly: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    positive: [25, 15, 20, 18, 22, 12, 18, 12, 22, 8, 15, 10],
    negative: [-20, -12, -16, -14, -10, -8, -14, -9, -16, -11, -8, -6],
  },
  Quarterly: {
    labels: ["Q1", "Q2", "Q3", "Q4"],
    positive: [60, 52, 52, 33],
    negative: [-48, -32, -39, -25],
  },
  Yearly: {
    labels: ["2023", "2024", "2025"],
    positive: [220, 197, 185],
    negative: [-175, -155, -144],
  },
};

export function AdjustmentSummary() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [period, setPeriod] = useState("Monthly");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const accent = resolveVar("var(--piw-accent)");
    const destructive = resolveVar("var(--piw-destructive)");
    const borderColor = resolveVar("var(--piw-border)");
    const textTert = resolveVar("var(--text-tertiary)");
    const fontRes = resolveFont("var(--font-inter)");
    const d = DATA[period];

    chartRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels: d.labels,
        datasets: [
          {
            label: "Positive",
            data: d.positive,
            backgroundColor: withAlpha(accent, 0.7),
            borderColor: accent,
            borderWidth: 1,
            borderRadius: 3,
            barPercentage: 0.7,
            categoryPercentage: 0.65,
          },
          {
            label: "Negative",
            data: d.negative,
            backgroundColor: withAlpha(destructive, 0.55),
            borderColor: withAlpha(destructive, 0.8),
            borderWidth: 1,
            borderRadius: 3,
            barPercentage: 0.7,
            categoryPercentage: 0.65,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: chartInteractionConfig(),
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: externalTooltipHandler,
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.y;
                return `${ctx.dataset.label}: ${val >= 0 ? "+" : ""}${val} EA`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { font: { family: fontRes, size: 10 }, color: textTert, padding: 4 },
          },
          y: {
            grid: { color: withAlpha(borderColor, 0.53) },
            border: { display: false },
            ticks: {
              font: { family: fontRes, size: 10 },
              color: textTert,
              padding: 6,
              maxTicksLimit: 6,
            },
          },
        },
        animation: chartAnimationConfig(),
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [period]);

  /* Summary stats */
  const d = DATA[period];
  const totalPos = d.positive.reduce((a, b) => a + b, 0);
  const totalNeg = Math.abs(d.negative.reduce((a, b) => a + b, 0));
  const net = totalPos - totalNeg;

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon={RefreshCw}
        title="Adjustment Summary"
        subtitle="Positive vs. negative adjustments"
        description="Grouped bar chart comparing positive (increase) and negative (decrease) inventory adjustments by month, revealing adjustment frequency and net impact on stock levels."
        right={
          <SmallSelect
            options={[...PERIOD_OPTIONS]}
            defaultValue="Monthly"
            onChange={setPeriod}
          />
        }
      />

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <canvas ref={canvasRef} />
      </div>

      {/* Footer: stats (left) + legend (right) */}
      <div
        className="flex items-end justify-between flex-wrap"
        style={{
          gap: "var(--spacing-4)",
          marginTop: "var(--spacing-2)",
          paddingTop: "var(--spacing-2)",
          borderTop: "1px solid var(--piw-border)",
        }}
      >
        <div className="flex items-center flex-wrap" style={{ gap: "var(--spacing-4)" }}>
          <div className="flex flex-col">
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>Net</span>
            <span style={{ fontFamily: FONT, fontSize: "var(--text-body-sm)", fontWeight: "var(--font-weight-semibold)" as any, color: net >= 0 ? "var(--piw-accent)" : "var(--piw-destructive)" }}>
              {net >= 0 ? "+" : ""}{net} EA
            </span>
          </div>
          <div className="flex flex-col">
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>Positive</span>
            <span style={{ fontFamily: FONT, fontSize: "var(--text-body-sm)", fontWeight: "var(--font-weight-semibold)" as any, color: "var(--piw-foreground)" }}>+{totalPos}</span>
          </div>
          <div className="flex flex-col">
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>Negative</span>
            <span style={{ fontFamily: FONT, fontSize: "var(--text-body-sm)", fontWeight: "var(--font-weight-semibold)" as any, color: "var(--piw-destructive)" }}>-{totalNeg}</span>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: "var(--spacing-3)" }}>
          <div className="flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
            <span className="rounded-full" style={{ width: 8, height: 8, background: "var(--piw-accent)", opacity: 0.7, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>Positive</span>
          </div>
          <div className="flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
            <span className="rounded-full" style={{ width: 8, height: 8, background: "var(--piw-destructive)", opacity: 0.55, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>Negative</span>
          </div>
        </div>
      </div>
    </div>
  );
}