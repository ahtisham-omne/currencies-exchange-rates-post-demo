/**
 * TopLocations — Horizontal bar chart showing location distribution.
 *
 * Portable: copy this file + `widget-utils.ts` + `widget-primitives.tsx`.
 * Dependencies: React, Chart.js, Tailwind CSS v4.
 */

import { useRef, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Chart } from "chart.js";
import {
  resolveVar,
  resolveFont,
  withAlpha,
  externalTooltipHandler,
  chartAnimationConfig,
  PERIOD_OPTIONS,
} from "./widget-utils";
import { WidgetHeader, SmallSelect } from "./widget-primitives";

export function TopLocations() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<"bar"> | null>(null);
  const [period, setPeriod] = useState("This Week");

  const locationData: Record<string, { name: string; qty: number }[]> = {
    Today: [
      { name: "Zone A-02", qty: 45 },
      { name: "Zone B-05", qty: 32 },
      { name: "Rack C-11", qty: 28 },
      { name: "Jonas S.", qty: 15 },
      { name: "Others", qty: 22 },
    ],
    "This Week": [
      { name: "Zone A-02", qty: 140 },
      { name: "Zone B-05", qty: 100 },
      { name: "Rack C-11", qty: 85 },
      { name: "Jonas S.", qty: 50 },
      { name: "Others", qty: 75 },
    ],
    "Last Week": [
      { name: "Zone A-02", qty: 130 },
      { name: "Zone B-05", qty: 95 },
      { name: "Rack C-11", qty: 80 },
      { name: "Jonas S.", qty: 55 },
      { name: "Others", qty: 60 },
    ],
    Monthly: [
      { name: "Zone A-02", qty: 520 },
      { name: "Zone B-05", qty: 380 },
      { name: "Rack C-11", qty: 310 },
      { name: "Jonas S.", qty: 190 },
      { name: "Others", qty: 250 },
    ],
    Quarterly: [
      { name: "Zone A-02", qty: 1450 },
      { name: "Zone B-05", qty: 1080 },
      { name: "Rack C-11", qty: 890 },
      { name: "Jonas S.", qty: 540 },
      { name: "Others", qty: 720 },
    ],
    Yearly: [
      { name: "Zone A-02", qty: 5200 },
      { name: "Zone B-05", qty: 3800 },
      { name: "Rack C-11", qty: 3100 },
      { name: "Jonas S.", qty: 1900 },
      { name: "Others", qty: 2500 },
    ],
    "Custom Date": [
      { name: "Zone A-02", qty: 280 },
      { name: "Zone B-05", qty: 195 },
      { name: "Rack C-11", qty: 160 },
      { name: "Jonas S.", qty: 95 },
      { name: "Others", qty: 130 },
    ],
  };

  const locations = locationData[period] || locationData["This Week"];
  const total = locations.reduce((s, l) => s + l.qty, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const primary = resolveVar("var(--piw-primary)");
    const textSec = resolveVar("var(--text-secondary)");
    const fontRes = resolveFont("var(--font-inter)");
    const borderColor = resolveVar("var(--piw-border)");

    const colors = [
      withAlpha(primary, 1),
      withAlpha(primary, 0.8),
      withAlpha(primary, 0.6),
      withAlpha(primary, 0.4),
      withAlpha(primary, 0.27),
    ];

    chartRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels: locations.map((l) => l.name),
        datasets: [
          {
            data: locations.map((l) => l.qty),
            backgroundColor: colors,
            hoverBackgroundColor: colors.map((c) => {
              // Slightly darken on hover
              const match = c.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,?\s*([\d.]*)/);
              if (match) {
                const a = match[4] ? Math.min(1, parseFloat(match[4]) + 0.15) : 1;
                return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${a})`;
              }
              return c;
            }),
            borderRadius: 4,
            borderSkipped: false,
            barThickness: 18,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index" as const, intersect: false, axis: "y" as const },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: externalTooltipHandler,
            callbacks: {
              label: (ctx) =>
                `${ctx.parsed.x} EA (${Math.round(((ctx.parsed.x as number) / total) * 100)}%)`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: withAlpha(borderColor, 0.4) },
            border: { display: false },
            ticks: {
              font: { family: fontRes, size: 10 },
              color: textSec,
              padding: 4,
              maxTicksLimit: 5,
            },
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { family: fontRes, size: 11 },
              color: textSec,
              padding: 4,
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

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon={MapPin}
        title="Location Distribution"
        subtitle="Top locations by on-hand qty"
        description="Horizontal bar chart ranking the top warehouse locations by on-hand quantity, helping identify stock concentration and distribution across your facility."
      />
      <div
        style={{ flex: 1, minHeight: 0, position: "relative" }}
      >
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}