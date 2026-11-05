/**
 * InventoryTrendWidget — Smooth area line chart with period picker.
 *
 * Mirrors `widgets/inventory-trend.tsx` from Physical Inventory. The
 * structure (period dropdown, smooth tension curve, area gradient,
 * footer with On-Hand / Change / legend) is preserved. The chart itself
 * is rendered as an SVG rather than via Chart.js because the host repos
 * don't ship `chart.js`. Visual parameters (stroke 2px, tension 0.4,
 * area alpha 0.19 → 0.01, font 10px text-tertiary) match the source
 * configuration.
 *
 * Hover state replicates Chart.js' default behaviour for `mode: 'index',
 * intersect: false`: a vertical guide tracks the nearest x, the data
 * point gets a filled dot, and a floating tooltip shows the label + qty.
 */

import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { TrendingUp } from "lucide-react";
import {
  FONT,
  PERIOD_OPTIONS,
} from "./widget-utils";
import { WidgetHeader, SmallSelect } from "./widget-primitives";

const PRIMARY = "#0A77FF";
const PRIMARY_FILL_TOP = "rgba(10, 119, 255, 0.19)";
const PRIMARY_FILL_BOTTOM = "rgba(10, 119, 255, 0.01)";

export interface InventoryTrendWidgetProps {
  /** Anchor value (used as the latest point). */
  onHand: number;
}

export function InventoryTrendWidget({ onHand }: InventoryTrendWidgetProps) {
  const [period, setPeriod] = useState("This Week");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  /* Same period table as the source, anchored to `onHand` so the latest
     point reflects the line item's actual quantity. The intermediate
     values use the same deltas as the source so the chart shapes match. */
  const baseSeries: Record<string, { labels: string[]; deltas: number[] }> = {
    Today: {
      labels: ["6am", "8am", "10am", "12pm", "2pm", "4pm", "6pm"],
      deltas: [-2, 0, -3, 2, -1, 1, 0],
    },
    "This Week": {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      deltas: [-30, -15, -40, 0, -5, -20, 0],
    },
    "Last Week": {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      deltas: [-50, -35, -25, -40, -20, -30, -30],
    },
    Monthly: {
      labels: ["01", "03", "05", "07", "09", "11", "13", "15", "17", "19", "21", "23", "25", "27", "29"],
      deltas: [-70, -55, -40, -60, -30, -15, -35, -10, -25, 0, -15, 10, -5, 5, 0],
    },
    Quarterly: {
      labels: ["Jan", "Feb", "Mar"],
      deltas: [-90, -40, 0],
    },
    Yearly: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      deltas: [-130, -110, -90, -100, -70, -55, -40, -30, -15, -10, -5, 0],
    },
    "Custom Date": {
      labels: ["Day 1", "Day 3", "Day 5", "Day 7", "Day 9", "Day 11", "Day 13", "Day 15"],
      deltas: [-25, -20, -32, -8, -12, 0, -5, -2],
    },
  };

  const meta = baseSeries[period] || baseSeries["This Week"];
  const values = meta.deltas.map((d) => Math.max(0, onHand + d));
  values[values.length - 1] = onHand;
  const labels = meta.labels;

  const first = values[0];
  const latest = values[values.length - 1];
  const changePct = first === 0 ? 0 : ((latest - first) / first) * 100;
  const isUp = latest >= first;

  /* SVG geometry — fixed aspect, scales by container width. */
  const w = 360, h = 180;
  const padL = 32, padR = 12, padT = 10, padB = 24;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const maxV = Math.max(...values);
  const minV = Math.min(...values);
  const range = Math.max(1, maxV - minV);
  const xPad = range * 0.08;
  const yMax = maxV + xPad;
  const yMin = Math.max(0, minV - xPad);
  const yRange = Math.max(1, yMax - yMin);

  const coords = values.map((v, i) => ({
    x: padL + (i / Math.max(1, values.length - 1)) * chartW,
    y: padT + (1 - (v - yMin) / yRange) * chartH,
  }));

  /* Catmull-rom-style smoothed path approximating Chart.js tension 0.4. */
  const linePath = coords.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    const prev = coords[i - 1];
    const cpx1 = prev.x + (p.x - prev.x) * 0.5;
    const cpx2 = p.x - (p.x - prev.x) * 0.5;
    return `${acc} C ${cpx1.toFixed(2)} ${prev.y.toFixed(2)}, ${cpx2.toFixed(2)} ${p.y.toFixed(2)}, ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }, "");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${padT + chartH} L ${coords[0].x.toFixed(2)} ${padT + chartH} Z`;

  /* Y-axis ticks — at most 5, rounded. */
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const v = yMax - (i * yRange) / (tickCount - 1);
    return { v: Math.round(v), y: padT + (i / (tickCount - 1)) * chartH };
  });

  const onSvgMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = Math.abs(coords[i].x - local.x);
      if (d < best) { best = d; nearest = i; }
    }
    setHoverIdx(nearest);
  };

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
            onChange={(v) => { setPeriod(v); setHoverIdx(null); }}
          />
        }
      />

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          style={{ display: "block", overflow: "visible" }}
          onPointerMove={onSvgMove}
          onPointerLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="invTrendAreaSO" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRIMARY_FILL_TOP} />
              <stop offset="100%" stopColor={PRIMARY_FILL_BOTTOM} />
            </linearGradient>
          </defs>

          {/* Y-axis grid + tick labels */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padL} y1={t.y} x2={w - padR} y2={t.y} stroke="rgba(226,232,240,0.53)" strokeWidth="1" />
              <text x={padL - 6} y={t.y + 3} textAnchor="end" fontSize="10" fill="var(--text-tertiary)" fontFamily="Inter, system-ui, sans-serif">
                {t.v}
              </text>
            </g>
          ))}

          {/* Area fill + smoothed line */}
          <path d={areaPath} fill="url(#invTrendAreaSO)" />
          <path d={linePath} fill="none" stroke={PRIMARY} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* X-axis labels */}
          {labels.map((d, i) => (
            <text
              key={`${d}-${i}`}
              x={coords[i].x}
              y={padT + chartH + 16}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-tertiary)"
              fontFamily="Inter, system-ui, sans-serif"
            >
              {d}
            </text>
          ))}

          {/* Hover guide + dot */}
          {hoverIdx !== null && (
            <g>
              <line
                x1={coords[hoverIdx].x} y1={padT}
                x2={coords[hoverIdx].x} y2={padT + chartH}
                stroke={PRIMARY} strokeWidth="1" strokeDasharray="3 3" opacity="0.4"
              />
              <circle
                cx={coords[hoverIdx].x}
                cy={coords[hoverIdx].y}
                r="5"
                fill={PRIMARY}
                stroke="var(--primary-foreground, #FFFFFF)"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Hover tooltip — mirrors the external HTML tooltip used by Chart.js */}
        {hoverIdx !== null && (
          <div
            style={{
              position: "absolute",
              left: `${(coords[hoverIdx].x / w) * 100}%`,
              top: `${(coords[hoverIdx].y / h) * 100}%`,
              transform: "translate(-50%, calc(-100% - 12px))",
              pointerEvents: "none",
              zIndex: 4,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--spacing-2) var(--spacing-3)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.05)",
              fontFamily: FONT,
              maxWidth: 220,
            }}
          >
            <div
              style={{
                fontSize: "var(--text-caption)",
                fontWeight: "var(--font-weight-medium)" as any,
                color: "var(--text-tertiary)",
                marginBottom: "var(--spacing-0-5)",
                lineHeight: 1.3,
              }}
            >
              {labels[hoverIdx]}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "var(--text-body-sm)",
                fontWeight: "var(--font-weight-semibold)" as any,
                color: "var(--foreground)",
                lineHeight: 1.4,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: PRIMARY, flexShrink: 0 }} />
              On-Hand: {values[hoverIdx].toLocaleString()} EA
            </div>
          </div>
        )}
      </div>

      <div
        className="flex items-end justify-between flex-wrap"
        style={{
          gap: "var(--spacing-4)",
          marginTop: "var(--spacing-2)",
          paddingTop: "var(--spacing-2)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center flex-wrap" style={{ gap: "var(--spacing-4)" }}>
          <div className="flex flex-col">
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>On-Hand</span>
            <span style={{ fontFamily: FONT, fontSize: "var(--text-body-sm)", fontWeight: "var(--font-weight-semibold)" as any, color: "var(--foreground)" }}>{latest.toLocaleString()} EA</span>
          </div>
          <div className="flex flex-col">
            <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>Change</span>
            <span style={{ fontFamily: FONT, fontSize: "var(--text-body-sm)", fontWeight: "var(--font-weight-semibold)" as any, color: isUp ? "#27B973" : "var(--destructive)" }}>
              {isUp ? "↑" : "↓"} {Math.abs(changePct).toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
          <span className="rounded-full" style={{ width: 8, height: 8, background: PRIMARY, flexShrink: 0 }} />
          <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}>On-Hand</span>
        </div>
      </div>
    </div>
  );
}
