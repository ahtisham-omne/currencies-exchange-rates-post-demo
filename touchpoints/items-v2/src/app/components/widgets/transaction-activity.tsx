/**
 * TransactionActivity — Grouped vertical bar chart (increase vs. decrease).
 *
 * Two independent controls:
 *   1. **Date range** (period) — how far back to look
 *   2. **Group by** (granularity) — what each bar represents
 *
 * The subtitle updates dynamically to reflect the active granularity.
 *
 * Portable: copy this file + `widget-utils.ts` + `widget-primitives.tsx`.
 * Dependencies: React, Chart.js, Tailwind CSS v4.
 */

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { BarChart3 } from "lucide-react";
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

/* ══════════════════════════════════════════════════════════════════════
 *  Types & Constants
 * ══════════════════════════════════════════════════════════════════════ */
type Granularity = "Daily" | "Weekly" | "Monthly";
interface BarData { label: string; inc: number; dec: number }

/** Which granularities are valid for each period, and the default selection. */
const GRANULARITY_CONFIG: Record<string, { options: Granularity[]; default: Granularity } | null> = {
  Today:         null,                                                       // hourly only, no selector
  "This Week":   { options: ["Daily"],                  default: "Daily"   },
  "Last Week":   { options: ["Daily"],                  default: "Daily"   },
  Monthly:       { options: ["Daily", "Weekly"],        default: "Weekly"  },
  Quarterly:     { options: ["Daily", "Weekly", "Monthly"], default: "Monthly" },
  Yearly:        { options: ["Weekly", "Monthly"],      default: "Monthly" },
  "Custom Date": { options: ["Daily", "Weekly", "Monthly"], default: "Weekly" },
};

/* ── helpers to produce realistic-ish mock bars ── */
const _wk = (n: number): BarData[] =>
  Array.from({ length: n }, (_, i) => ({
    label: `Wk ${i + 1}`,
    inc: 130 + Math.round(Math.sin(i * 0.9) * 50 + Math.random() * 40),
    dec: 70 + Math.round(Math.cos(i * 0.7) * 30 + Math.random() * 30),
  }));

const _daily = (n: number, base = 25): BarData[] => {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return Array.from({ length: n }, (_, i) => ({
    label: n <= 7 ? labels[i % 7] : `${i + 1}`,
    inc: base + Math.round(Math.random() * base * 0.8),
    dec: Math.round(base * 0.45 + Math.random() * base * 0.5),
  }));
};

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ══════════════════════════════════════════════════════════════════════
 *  Full dataset: DATA[period][granularity]
 *
 *  "Today" is keyed as DATA["Today"]["_hourly"] (single entry, no
 *  granularity selector shown).
 * ══════════════════════════════════════════════════════════════════════ */
const DATA: Record<string, Record<string, BarData[]>> = {
  /* ── Today (hourly, no granularity selector) ── */
  Today: {
    _hourly: [
      { label: "6am", inc: 8, dec: 3 },
      { label: "9am", inc: 12, dec: 5 },
      { label: "12pm", inc: 15, dec: 8 },
      { label: "3pm", inc: 10, dec: 6 },
      { label: "6pm", inc: 5, dec: 2 },
    ],
  },

  /* ── This Week — only Daily ── */
  "This Week": {
    Daily: [
      { label: "Mon", inc: 30, dec: 15 },
      { label: "Tue", inc: 50, dec: 25 },
      { label: "Wed", inc: 35, dec: 20 },
      { label: "Thu", inc: 40, dec: 10 },
      { label: "Fri", inc: 25, dec: 15 },
      { label: "Sat", inc: 45, dec: 30 },
      { label: "Sun", inc: 35, dec: 20 },
    ],
  },

  /* ── Last Week — only Daily ── */
  "Last Week": {
    Daily: [
      { label: "Mon", inc: 20, dec: 25 },
      { label: "Tue", inc: 35, dec: 15 },
      { label: "Wed", inc: 45, dec: 30 },
      { label: "Thu", inc: 30, dec: 20 },
      { label: "Fri", inc: 40, dec: 35 },
      { label: "Sat", inc: 15, dec: 10 },
      { label: "Sun", inc: 25, dec: 20 },
    ],
  },

  /* ── Monthly (~30 days) ── */
  Monthly: {
    Daily: _daily(30, 22),
    Weekly: [
      { label: "Wk 1", inc: 180, dec: 95 },
      { label: "Wk 2", inc: 210, dec: 135 },
      { label: "Wk 3", inc: 160, dec: 110 },
      { label: "Wk 4", inc: 195, dec: 125 },
    ],
  },

  /* ── Quarterly (~90 days / ~13 weeks / 3 months) ── */
  Quarterly: {
    Daily: _daily(90, 18),
    Weekly: _wk(13),
    Monthly: [
      { label: "Jan", inc: 620, dec: 380 },
      { label: "Feb", inc: 580, dec: 420 },
      { label: "Mar", inc: 745, dec: 465 },
    ],
  },

  /* ── Yearly (~52 weeks / 12 months) ── */
  Yearly: {
    Weekly: _wk(52),
    Monthly: MONTHS_SHORT.map((m, i) => ({
      label: m,
      inc: 480 + Math.round(Math.sin(i * 0.5) * 120 + i * 15),
      dec: 300 + Math.round(Math.cos(i * 0.6) * 80 + i * 10),
    })),
  },

  /* ── Custom Date (placeholder data) ── */
  "Custom Date": {
    Daily: _daily(15, 20),
    Weekly: [
      { label: "Wk 1", inc: 85, dec: 40 },
      { label: "Wk 2", inc: 110, dec: 55 },
      { label: "Wk 3", inc: 95, dec: 60 },
      { label: "Wk 4", inc: 120, dec: 50 },
      { label: "Wk 5", inc: 105, dec: 45 },
    ],
    Monthly: [
      { label: "Month 1", inc: 340, dec: 195 },
      { label: "Month 2", inc: 410, dec: 230 },
    ],
  },
};

/* ══════════════════════════════════════════════════════════════════════
 *  Component
 * ══════════════════════════════════════════════════════════════════════ */
export function TransactionActivity() {
  const [period, setPeriod] = useState("This Week");
  const [granularity, setGranularity] = useState<Granularity>("Daily");

  /* Resolve valid granularity config for the current period */
  const granConfig = GRANULARITY_CONFIG[period] ?? null;

  /* When the period changes, reset granularity to the period's default */
  useEffect(() => {
    const cfg = GRANULARITY_CONFIG[period];
    if (cfg) {
      setGranularity(cfg.default);
    }
  }, [period]);

  /* Determine which dataset key to use */
  const dataKey = granConfig ? granularity : "_hourly";
  const data: BarData[] = useMemo(() => {
    const periodSet = DATA[period] || DATA["This Week"];
    return periodSet[dataKey] || periodSet[Object.keys(periodSet)[0]] || [];
  }, [period, dataKey]);

  /* Dynamic subtitle */
  const subtitle = useMemo(() => {
    if (!granConfig) return "Hourly increase vs. decrease";
    return `${granularity} increase vs. decrease`;
  }, [granConfig, granularity]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<"bar"> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalInc = data.reduce((s, d) => s + d.inc, 0);
  const totalDec = data.reduce((s, d) => s + d.dec, 0);
  const net = totalInc - totalDec;

  const buildChart = useCallback(() => {
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

    /* For large bar counts, slim down bars so they don't crowd */
    const barCount = data.length;
    const barPct = barCount > 30 ? 0.85 : barCount > 14 ? 0.7 : 0.6;
    const catPct = barCount > 30 ? 0.95 : barCount > 14 ? 0.8 : 0.7;

    chartRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels: data.map((d) => d.label),
        datasets: [
          {
            label: "Increase",
            data: data.map((d) => d.inc),
            backgroundColor: accent,
            hoverBackgroundColor: withAlpha(accent, 0.8),
            borderRadius: barCount > 30 ? 2 : 4,
            borderSkipped: false,
            barPercentage: barPct,
            categoryPercentage: catPct,
          },
          {
            label: "Decrease",
            data: data.map((d) => d.dec),
            backgroundColor: withAlpha(destructive, 0.47),
            hoverBackgroundColor: withAlpha(destructive, 0.65),
            borderRadius: barCount > 30 ? 2 : 4,
            borderSkipped: false,
            barPercentage: barPct,
            categoryPercentage: catPct,
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
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} EA`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { family: fontRes, size: 10 },
              color: textTert,
              padding: 4,
              maxRotation: barCount > 30 ? 90 : 0,
              autoSkip: true,
              maxTicksLimit: barCount > 30 ? 15 : undefined,
            },
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
  }, [data]);

  useEffect(() => {
    buildChart();
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [buildChart]);

  return (
    <div className="flex flex-col h-full">
      <WidgetHeader
        icon={BarChart3}
        title="Transaction Activity"
        subtitle={subtitle}
        description="Grouped bar chart showing transaction volumes (increase vs. decrease) over time. Use the date range to control how far back you look, and the group-by selector to control bar granularity."
        right={
          <div className="flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
            {/* Group-by selector — only shown when the period supports it */}
            {granConfig && granConfig.options.length > 1 && (
              <SmallSelect
                options={granConfig.options as unknown as string[]}
                defaultValue={granConfig.default}
                value={granularity}
                onChange={(v) => setGranularity(v as Granularity)}
                prefix="Group by"
              />
            )}
            {/* Period (date-range) selector */}
            <SmallSelect
              options={[...PERIOD_OPTIONS]}
              defaultValue="This Week"
              onChange={setPeriod}
            />
          </div>
        }
      />

      {/* Chart */}
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0, position: "relative" }}
      >
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
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>Increase</span>
            <span style={{ fontFamily: FONT, fontSize: "var(--text-body-sm)", fontWeight: "var(--font-weight-semibold)" as any, color: "var(--piw-foreground)" }}>{totalInc} EA</span>
          </div>
          <div className="flex flex-col">
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>Decrease</span>
            <span style={{ fontFamily: FONT, fontSize: "var(--text-body-sm)", fontWeight: "var(--font-weight-semibold)" as any, color: "var(--piw-destructive)" }}>{totalDec} EA</span>
          </div>
          <div className="flex flex-col">
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>Net</span>
            <span style={{ fontFamily: FONT, fontSize: "var(--text-body-sm)", fontWeight: "var(--font-weight-semibold)" as any, color: net >= 0 ? "var(--piw-accent)" : "var(--piw-destructive)" }}>{net >= 0 ? "+" : ""}{net} EA</span>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: "var(--spacing-3)" }}>
          <div className="flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
            <span className="rounded-full" style={{ width: 8, height: 8, background: "var(--piw-accent)", flexShrink: 0 }} />
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>Increase</span>
          </div>
          <div className="flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
            <span className="rounded-full" style={{ width: 8, height: 8, background: "var(--piw-destructive)", opacity: 0.55, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>Decrease</span>
          </div>
        </div>
      </div>
    </div>
  );
}
