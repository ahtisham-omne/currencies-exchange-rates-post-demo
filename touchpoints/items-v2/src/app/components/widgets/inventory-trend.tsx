/**
 * InventoryTrend — Smooth area line chart with 7D / 30D / 90D range picker.
 *
 * Portable: copy this file + `widget-utils.ts` + `widget-primitives.tsx`.
 * Dependencies: React, Chart.js, Tailwind CSS v4.
 */

import { useRef, useEffect, useState } from "react";
import { Chart } from "chart.js";
import { TrendingUp } from "lucide-react";
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

export function InventoryTrend() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState("This Week");

  const dataSets: Record<string, { labels: string[]; values: number[] }> = {
    Today: {
      labels: ["6am", "8am", "10am", "12pm", "2pm", "4pm", "6pm"],
      values: [448, 450, 447, 452, 449, 451, 450],
    },
    "This Week": {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      values: [420, 435, 410, 450, 445, 430, 450],
    },
    "Last Week": {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      values: [400, 415, 425, 410, 430, 420, 420],
    },
    Monthly: {
      labels: [
        "01","03","05","07","09","11","13","15","17","19","21","23","25","27","29",
      ],
      values: [380, 395, 410, 390, 420, 435, 415, 440, 425, 450, 435, 460, 445, 455, 450],
    },
    Quarterly: {
      labels: ["Jan", "Feb", "Mar"],
      values: [360, 410, 450],
    },
    Yearly: {
      labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
      values: [320, 340, 360, 350, 380, 395, 410, 420, 435, 440, 445, 450],
    },
    "Custom Date": {
      labels: ["Day 1", "Day 3", "Day 5", "Day 7", "Day 9", "Day 11", "Day 13", "Day 15"],
      values: [425, 430, 418, 442, 438, 450, 445, 448],
    },
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const primary = resolveVar("var(--piw-primary)");
    const borderColor = resolveVar("var(--piw-border)");
    const textTert = resolveVar("var(--text-tertiary)");
    const fontRes = resolveFont("var(--font-inter)");
    const d = dataSets[period];

    const ctx = canvas.getContext("2d");
    let gradient: CanvasGradient | string = withAlpha(primary, 0.09);
    if (ctx) {
      gradient = ctx.createLinearGradient(0, 0, 0, 200);
      gradient.addColorStop(0, withAlpha(primary, 0.19));
      gradient.addColorStop(1, withAlpha(primary, 0.01));
    }

    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels: d.labels,
        datasets: [
          {
            data: d.values,
            borderColor: primary,
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: primary,
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
            callbacks: { label: (ctx) => `On-Hand: ${ctx.parsed.y} EA` },
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
              maxTicksLimit: 5,
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
  const latest = d.values[d.values.length - 1];
  const first = d.values[0];
  const changePct = (((latest - first) / first) * 100).toFixed(1);
  const isUp = latest >= first;

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon={TrendingUp}
        title="Inventory Trend"
        subtitle="On-hand quantity over time"
        description="Line chart tracking on-hand quantity changes over time, showing stock fluctuations to identify seasonal patterns and supply chain issues."
        right={
          <SmallSelect
            options={[...PERIOD_OPTIONS]}
            defaultValue="This Week"
            onChange={setPeriod}
          />
        }
      />

      {/* Chart */}
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0, position: "relative" }}
      >
        <canvas ref={canvasRef} />
      </div>

      {/* Footer: stats (left) + legend (right) — matches TransactionActivity */}
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
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>On-Hand</span>
            <span style={{ fontFamily: FONT, fontSize: "var(--text-body-sm)", fontWeight: "var(--font-weight-semibold)" as any, color: "var(--piw-foreground)" }}>{latest.toLocaleString()} EA</span>
          </div>
          <div className="flex flex-col">
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>Change</span>
            <span style={{ fontFamily: FONT, fontSize: "var(--text-body-sm)", fontWeight: "var(--font-weight-semibold)" as any, color: isUp ? "var(--piw-accent)" : "var(--piw-destructive)" }}>{isUp ? "↑" : "↓"} {changePct}%</span>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
          <span className="rounded-full" style={{ width: 8, height: 8, background: "var(--piw-primary)", flexShrink: 0 }} />
          <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>On-Hand</span>
        </div>
      </div>
    </div>
  );
}