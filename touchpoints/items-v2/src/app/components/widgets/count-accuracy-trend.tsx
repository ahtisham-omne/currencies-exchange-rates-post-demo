/**
 * CountAccuracyTrend — Line chart showing inventory count accuracy % over time.
 *
 * Portable: copy this file + `widget-utils.ts` + `widget-primitives.tsx`.
 * Dependencies: React, Chart.js, Tailwind CSS v4.
 */

import { useRef, useEffect, useState } from "react";
import { Target } from "lucide-react";
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

export function CountAccuracyTrend() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);
  const [period, setPeriod] = useState("Monthly");

  const dataSets: Record<string, { labels: string[]; accuracy: number[] }> = {
    Today: {
      labels: ["6am", "9am", "12pm", "3pm", "6pm"],
      accuracy: [98.0, 98.1, 98.2, 98.2, 98.2],
    },
    "This Week": {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      accuracy: [97.8, 97.9, 98.0, 98.0, 98.1, 98.1, 98.2],
    },
    "Last Week": {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      accuracy: [97.4, 97.5, 97.6, 97.6, 97.7, 97.8, 97.8],
    },
    Monthly: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      accuracy: [94.5, 95.1, 95.8, 96.0, 96.2, 96.5, 96.8, 97.1, 97.5, 97.8, 98.0, 98.2],
    },
    Quarterly: {
      labels: ["Q1 '25", "Q2 '25", "Q3 '25", "Q4 '25"],
      accuracy: [95.1, 96.5, 97.3, 98.2],
    },
    Yearly: {
      labels: ["Q1 '24", "Q2 '24", "Q3 '24", "Q4 '24", "Q1 '25", "Q2 '25", "Q3 '25", "Q4 '25"],
      accuracy: [91.2, 92.8, 93.5, 94.5, 95.6, 96.5, 97.3, 98.2],
    },
    "Custom Date": {
      labels: ["Day 1", "Day 3", "Day 5", "Day 7", "Day 9", "Day 11", "Day 13", "Day 15"],
      accuracy: [97.6, 97.7, 97.8, 97.9, 98.0, 98.0, 98.1, 98.2],
    },
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const accent = resolveVar("var(--piw-accent)");
    const borderColor = resolveVar("var(--piw-border)");
    const textTert = resolveVar("var(--text-tertiary)");
    const fontRes = resolveFont("var(--font-inter)");
    const d = dataSets[period];

    const ctx = canvas.getContext("2d");
    let gradient: CanvasGradient | string = withAlpha(accent, 0.09);
    if (ctx) {
      gradient = ctx.createLinearGradient(0, 0, 0, 200);
      gradient.addColorStop(0, withAlpha(accent, 0.16));
      gradient.addColorStop(1, withAlpha(accent, 0.01));
    }

    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels: d.labels,
        datasets: [
          {
            label: "Accuracy",
            data: d.accuracy,
            borderColor: accent,
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: accent,
            pointHoverBorderColor: "var(--piw-primary-foreground)",
            pointHoverBorderWidth: 2,
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
              label: (ctx) => `Accuracy: ${ctx.parsed.y}%`,
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
            min: 90,
            max: 100,
            grid: { color: withAlpha(borderColor, 0.53) },
            border: { display: false },
            ticks: {
              font: { family: fontRes, size: 10 },
              color: textTert,
              padding: 6,
              maxTicksLimit: 5,
              callback: (v: any) => `${v}%`,
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

  const d = dataSets[period];
  const latest = d.accuracy[d.accuracy.length - 1];
  const first = d.accuracy[0];
  const changePct = (latest - first).toFixed(1);
  const isUp = latest >= first;

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon={Target}
        title="Count Accuracy Trend"
        subtitle="Physical vs. system count accuracy"
        description="Dual-line chart comparing physical count results against system records over time, tracking count accuracy improvements and identifying discrepancy trends."
        right={
          <SmallSelect
            options={[...PERIOD_OPTIONS]}
            defaultValue="Monthly"
            onChange={setPeriod}
          />
        }
      />

      {/* Hero value */}
      <div className="flex items-baseline" style={{ gap: "var(--spacing-2)", marginBottom: "var(--spacing-2)" }}>
        <span style={{ fontFamily: FONT, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "var(--text-h4)", color: "var(--piw-foreground)", lineHeight: 1 }}>
          {latest}%
        </span>
        <span
          className="inline-flex items-center rounded-[var(--radius-sm)]"
          style={{
            fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" as any,
            color: isUp ? "var(--piw-accent)" : "var(--piw-destructive)",
            background: isUp ? "color-mix(in srgb, var(--piw-accent) 8%, transparent)" : "color-mix(in srgb, var(--piw-destructive) 8%, transparent)",
            padding: "1px var(--spacing-1-5)",
          }}
        >
          {isUp ? "\u2191" : "\u2193"} {changePct}pp
        </span>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}