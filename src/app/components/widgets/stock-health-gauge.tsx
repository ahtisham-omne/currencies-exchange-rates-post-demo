/**
 * StockHealthGauge — Interactive semi-circle arc gauge with hover tooltips.
 *
 * Portable: copy this file + `widget-utils.ts` + `widget-primitives.tsx`.
 * Dependencies: React, Tailwind CSS v4.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Info, Activity, CheckCircle2, AlertTriangle, AlertOctagon } from "lucide-react";
import { FONT, resolveVar, withAlpha } from "./widget-utils";
import { WidgetHeader, SmallSelect } from "./widget-primitives";

/* ── Zone definitions ── */
interface Zone {
  key: string;
  label: string;
  range: string;
  color: string;      // resolved at render
  startDeg: number;    // arc start in degrees (0 = left end of arc)
  endDeg: number;
  pct: number;         // percent of arc
}

/* ── Stat definitions ── */
interface StatItem {
  label: string;
  value: string;
  tooltip: string;
}

/* ── UOM conversion data ── */
interface UOMConfig {
  key: string;
  label: string;
  abbr: string;
  conversionFactor: number; // how many EA per 1 of this unit
  min: number;
  max: number;
  current: number;
  stats: StatItem[];
}

const UOM_DATA: UOMConfig[] = [
  {
    key: "ea",
    label: "EA (default)",
    abbr: "EA",
    conversionFactor: 1,
    min: 100,
    max: 600,
    current: 450,
    stats: [
      { label: "Available", value: "400 EA", tooltip: "Stock ready for use" },
      { label: "Allocated", value: "50 EA", tooltip: "Allocated for work orders or sales" },
      { label: "On Order", value: "2,000 EA", tooltip: "Incoming purchase orders" },
      { label: "Quarantined", value: "0", tooltip: "Held for quality inspection" },
      { label: "In Production", value: "0", tooltip: "Currently being manufactured" },
      { label: "Projected Available", value: "2,400 EA", tooltip: "Forecasted availability (On-Hand + On Order)" },
    ],
  },
  {
    key: "box",
    label: "Box",
    abbr: "BOX",
    conversionFactor: 12,
    min: 9,
    max: 50,
    current: 38,
    stats: [
      { label: "Available", value: "33 BOX", tooltip: "Stock ready for use" },
      { label: "Allocated", value: "4 BOX", tooltip: "Allocated for work orders or sales" },
      { label: "On Order", value: "167 BOX", tooltip: "Incoming purchase orders" },
      { label: "Quarantined", value: "0", tooltip: "Held for quality inspection" },
      { label: "In Production", value: "0", tooltip: "Currently being manufactured" },
      { label: "Projected Available", value: "200 BOX", tooltip: "Forecasted availability (On-Hand + On Order)" },
    ],
  },
  {
    key: "carton",
    label: "Carton",
    abbr: "CTN",
    conversionFactor: 48,
    min: 2,
    max: 13,
    current: 9,
    stats: [
      { label: "Available", value: "8 CTN", tooltip: "Stock ready for use" },
      { label: "Allocated", value: "1 CTN", tooltip: "Allocated for work orders or sales" },
      { label: "On Order", value: "42 CTN", tooltip: "Incoming purchase orders" },
      { label: "Quarantined", value: "0", tooltip: "Held for quality inspection" },
      { label: "In Production", value: "0", tooltip: "Currently being manufactured" },
      { label: "Projected Available", value: "50 CTN", tooltip: "Forecasted availability (On-Hand + On Order)" },
    ],
  },
];

/* ── Needle angle calculation ── */
function needleAngle(current: number, min: number, max: number): number {
  const pct = Math.max(0, Math.min(1, (current - min) / (max - min)));
  // Arc spans from -120deg to +120deg (240deg total), starting from bottom-left
  return -120 + pct * 240;
}

/* ── SVG gauge drawing (stroke-based for rounded ends) ── */
function GaugeArc({
  cx,
  cy,
  r,
  thickness,
  zones,
  hoveredZone,
  onHover,
}: {
  cx: number;
  cy: number;
  r: number;
  thickness: number;
  zones: Zone[];
  hoveredZone: string | null;
  onHover: (key: string | null) => void;
}) {
  const totalDeg = 240;
  const startAngle = 150; // start from bottom-left
  const midR = r - thickness / 2; // stroke is centered on this radius

  function describeStrokeArc(startDeg: number, endDeg: number): string {
    const s1 = ((startAngle + startDeg) * Math.PI) / 180;
    const e1 = ((startAngle + endDeg) * Math.PI) / 180;
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    const x1 = cx + midR * Math.cos(s1);
    const y1 = cy + midR * Math.sin(s1);
    const x2 = cx + midR * Math.cos(e1);
    const y2 = cy + midR * Math.sin(e1);
    return `M ${x1} ${y1} A ${midR} ${midR} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  let cumDeg = 0;

  return (
    <g>
      {zones.map((z, i) => {
        const segStart = cumDeg;
        const segEnd = cumDeg + (z.pct / 100) * totalDeg;
        cumDeg = segEnd;
        const isHovered = hoveredZone === z.key;
        const opacity = hoveredZone === null ? 1 : isHovered ? 1 : 0.3;
        const isFirst = i === 0;
        const isLast = i === zones.length - 1;

        return (
          <path
            key={z.key}
            d={describeStrokeArc(segStart, segEnd)}
            fill="none"
            stroke={z.color}
            strokeWidth={thickness}
            strokeLinecap={isFirst || isLast ? "round" : "butt"}
            style={{
              opacity,
              transition: "opacity 0.2s ease, filter 0.2s ease",
              filter: isHovered ? "brightness(1.08) drop-shadow(0 2px 6px rgba(0,0,0,0.15))" : "none",
              cursor: "pointer",
            }}
            onMouseEnter={() => onHover(z.key)}
            onMouseLeave={() => onHover(null)}
          />
        );
      })}
    </g>
  );
}

export function StockHealthGauge({ partNumber }: { partNumber?: string } = {}) {
  const [selectedUOM, setSelectedUOM] = useState("EA (default)");
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);
  const [hoveredThreshold, setHoveredThreshold] = useState<"min" | "max" | null>(null);
  const [needleRendered, setNeedleRendered] = useState(false);
  const [hoveredHealth, setHoveredHealth] = useState(false);

  /* ── Debounced zone hover to reduce jitter ── */
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleZoneHover = useCallback((key: string | null) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (key === null) {
      hoverTimerRef.current = setTimeout(() => setHoveredZone(null), 60);
    } else {
      setHoveredZone(key);
    }
  }, []);

  // P-00961 demo: simulate negative inventory
  const isNegativeDemo = partNumber === "P-00961";
  const baseUom = useMemo(
    () => UOM_DATA.find((u) => u.label === selectedUOM) || UOM_DATA[0],
    [selectedUOM]
  );
  const uom = useMemo(() => {
    if (!isNegativeDemo) return baseUom;
    const factor = baseUom.conversionFactor;
    const negCurrent = -Math.round(45 / factor);
    return {
      ...baseUom,
      current: negCurrent,
      stats: [
        { label: "Available", value: `${negCurrent} ${baseUom.abbr}`, tooltip: "Stock ready for use (currently negative — backorder)" },
        { label: "Allocated", value: `${Math.round(60 / factor)} ${baseUom.abbr}`, tooltip: "Allocated for work orders or sales" },
        { label: "On Order", value: `${Math.round(500 / factor).toLocaleString()} ${baseUom.abbr}`, tooltip: "Incoming purchase orders" },
        { label: "Quarantined", value: "0", tooltip: "Held for quality inspection" },
        { label: "In Production", value: "0", tooltip: "Currently being manufactured" },
        { label: "Projected Available", value: `${Math.round((500 - 45 - 60) / factor).toLocaleString()} ${baseUom.abbr}`, tooltip: "Forecasted availability (On-Hand + On Order − Allocated)" },
      ],
    };
  }, [baseUom, isNegativeDemo]);

  const minQty = uom.min;
  const maxQty = uom.max;
  const currentQty = uom.current;
  const pct = Math.round(((currentQty - minQty) / (maxQty - minQty)) * 100);

  useEffect(() => {
    setNeedleRendered(false);
    const t = setTimeout(() => setNeedleRendered(true), 100);
    return () => clearTimeout(t);
  }, [selectedUOM]);

  /* ── Resolve colors at render ── */
  const accent = resolveVar("var(--piw-accent)");
  const chart3 = resolveVar("var(--piw-chart-3)");
  const destructive = resolveVar("var(--piw-destructive)");
  const border = resolveVar("var(--piw-border)");

  const isNegative = currentQty < 0;
  const zones: Zone[] = [
    { key: "below-min", label: "Below Minimum", range: `<${minQty}`, color: withAlpha(destructive, 0.45), startDeg: 0, endDeg: 0, pct: 15 },
    { key: "healthy", label: "Healthy", range: `${minQty}–${maxQty}`, color: accent, startDeg: 0, endDeg: 0, pct: 70 },
    { key: "above-max", label: "Above Maximum", range: `>${maxQty}`, color: withAlpha(chart3, 0.5), startDeg: 0, endDeg: 0, pct: 15 },
  ];
  // suppress unused warning
  void border;

  const hoveredZoneData = zones.find((z) => z.key === hoveredZone);

  /* ── SVG dimensions ── */
  const svgW = 220;
  const svgH = 145;
  const cx = svgW / 2;
  const cy = 120;
  const r = 95;
  const thickness = 20;
  const nAngle = needleAngle(currentQty, minQty, maxQty);

  return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      <WidgetHeader
        icon={Activity}
        title="Stock Health"
        subtitle="Current vs. Min/Max threshold"
        description="Semi-circle gauge showing current stock level against minimum and maximum thresholds, indicating whether inventory is understocked, optimal, or overstocked."
        right={
          <SmallSelect
            options={UOM_DATA.map((u) => u.label)}
            defaultValue="EA (default)"
            onChange={setSelectedUOM}
          />
        }
      />

      {/* Gauge */}
      <div className="flex justify-center" style={{ marginTop: "var(--spacing-1)" }}>
        <div className="relative" style={{ width: `${svgW}px`, height: `${svgH}px` }}>
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ overflow: "visible" }}
          >
            {/* Arc segments */}
            <GaugeArc
              cx={cx}
              cy={cy}
              r={r}
              thickness={thickness}
              zones={zones}
              hoveredZone={hoveredZone}
              onHover={handleZoneHover}
            />

            {/* Needle — shortened to stay within arc */}
            <g
              style={{
                transform: `rotate(${needleRendered ? nAngle : -120}deg)`,
                transformOrigin: `${cx}px ${cy}px`,
                transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              {/* Pilot-style needle (kite silhouette) — ported from Sales Order V5 */}
              {(() => {
                const T = 73;
                const B = 48;
                const baseHW = 2.2;
                const midHW = 0.9;
                const tipR = 0.7;
                const midY = cy - (B + (T - B) * 0.55);
                const fg = resolveVar("var(--piw-foreground)");
                const d = [
                  `M ${cx + baseHW} ${cy - B}`,
                  `L ${cx + midHW} ${midY}`,
                  `L ${cx + tipR} ${cy - T}`,
                  `A ${tipR} ${tipR} 0 0 1 ${cx - tipR} ${cy - T}`,
                  `L ${cx - midHW} ${midY}`,
                  `L ${cx - baseHW} ${cy - B}`,
                  "Z",
                ].join(" ");
                return <path d={d} fill={fg} />;
              })()}
            </g>
          </svg>

          {/* Center text */}
          <div
            className="absolute flex flex-col items-center"
            style={{
              bottom: "2px",
              left: "50%",
              transform: "translateX(-50%)",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontFamily: FONT,
                fontWeight: "var(--font-weight-semibold)" as any,
                fontSize: "var(--text-h3)",
                color: isNegative ? "var(--piw-destructive)" : "var(--piw-foreground)",
                lineHeight: 1,
                transition: "opacity 0.2s ease",
                opacity: hoveredZone ? 0.4 : 1,
              }}
            >
              {currentQty}
            </span>
            <span
              style={{
                fontFamily: FONT,
                fontWeight: "var(--font-weight-normal)" as any,
                fontSize: "var(--text-body-sm)",
                color: "var(--text-tertiary)",
                lineHeight: 1.4,
                marginTop: "var(--spacing-0-5)",
              }}
            >
              {uom.abbr} On-Hand
            </span>
            {isNegative && (
              <div
                className="flex items-center"
                style={{
                  pointerEvents: "auto",
                  marginTop: "var(--spacing-1)",
                  gap: "var(--spacing-1)",
                  padding: "var(--spacing-0-5) var(--spacing-1-5)",
                  borderRadius: "var(--radius-pill)",
                  background: withAlpha(destructive, 0.12),
                  border: `1px solid ${withAlpha(destructive, 0.35)}`,
                }}
              >
                <AlertOctagon size={12} style={{ color: "var(--piw-destructive)", flexShrink: 0 }} />
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-caption)",
                    fontWeight: "var(--font-weight-semibold)" as any,
                    color: "var(--piw-destructive)",
                    lineHeight: 1,
                  }}
                >
                  Negative Inventory
                </span>
              </div>
            )}
          </div>

          {/* Zone hover tooltip */}
          {hoveredZoneData && (
            <div
              className="absolute"
              style={{
                top: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "var(--piw-card)",
                border: "1px solid var(--piw-border)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--spacing-1-5) var(--spacing-2-5)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
                pointerEvents: "none",
                zIndex: 10,
                whiteSpace: "nowrap",
              }}
            >
              <div className="flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: hoveredZoneData.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT,
                    fontWeight: "var(--font-weight-semibold)" as any,
                    fontSize: "var(--text-caption)",
                    color: "var(--piw-foreground)",
                  }}
                >
                  {hoveredZoneData.label}
                </span>
                <span
                  style={{
                    fontFamily: FONT,
                    fontWeight: "var(--font-weight-normal)" as any,
                    fontSize: "var(--text-caption)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {hoveredZoneData.range}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Min/Max labels + healthy badge */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "0", marginTop: "var(--spacing-1)" }}
      >
        {/* Min label with popover */}
        <div
          className="relative"
          onMouseEnter={() => setHoveredThreshold("min")}
          onMouseLeave={() => setHoveredThreshold(null)}
        >
          <div
            className="flex items-center"
            style={{
              gap: "var(--spacing-1)",
              cursor: "default",
              padding: "var(--spacing-0-5) var(--spacing-1)",
              borderRadius: "var(--radius-sm)",
              transition: "background 0.15s ease",
              background: hoveredThreshold === "min" ? "var(--surface-secondary)" : "transparent",
            }}
          >
            <span
              style={{
                fontFamily: FONT,
                fontSize: "var(--text-body-sm)",
                fontWeight: "var(--font-weight-medium)" as any,
                color: hoveredThreshold === "min" ? "var(--text-secondary)" : "var(--text-tertiary)",
                transition: "color 0.15s ease",
              }}
            >
              Min {minQty}
            </span>
            <Info
              size={12}
              style={{
                color: hoveredThreshold === "min" ? "var(--piw-primary)" : "var(--text-tertiary)",
                transition: "color 0.15s ease",
                flexShrink: 0,
              }}
            />
          </div>
          {hoveredThreshold === "min" && (
            <div
              className="absolute"
              style={{
                bottom: "calc(100% + 6px)",
                left: "0",
                background: "var(--piw-card)",
                border: "1px solid var(--piw-border)",
                borderRadius: "var(--radius-md)",
                padding: "var(--spacing-3)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)",
                zIndex: 30,
                width: "200px",
              }}
            >
              <div className="flex items-center" style={{ gap: "var(--spacing-1-5)", marginBottom: "var(--spacing-1-5)" }}>
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "var(--piw-destructive)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT,
                    fontWeight: "var(--font-weight-semibold)" as any,
                    fontSize: "var(--text-caption)",
                    color: "var(--piw-foreground)",
                  }}
                >
                  Minimum Threshold
                </span>
              </div>
              <p
                style={{
                  fontFamily: FONT,
                  fontWeight: "var(--font-weight-normal)" as any,
                  fontSize: "var(--text-caption)",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                The lowest acceptable stock level. Falling below {minQty} EA triggers a reorder alert to prevent stockouts.
              </p>
              {/* Arrow */}
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: "20px",
                  width: 0,
                  height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: "5px solid var(--piw-border)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% - 1px)",
                  left: "20px",
                  width: 0,
                  height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: "5px solid var(--piw-card)",
                }}
              />
            </div>
          )}
        </div>

        {/* Health status icon + percentage badge */}
        <div
          className="relative inline-flex items-center"
          onMouseEnter={() => setHoveredHealth(true)}
          onMouseLeave={() => setHoveredHealth(false)}
          style={{
            cursor: "default",
            gap: "var(--spacing-1)",
            padding: "var(--spacing-0-5) var(--spacing-2)",
            borderRadius: "var(--radius-sm)",
            background: hoveredHealth ? "var(--surface-secondary)" : "transparent",
            transition: "background 0.15s ease",
          }}
        >
          {pct >= 50 ? (
            <CheckCircle2 size={14} style={{ color: "var(--piw-accent)", flexShrink: 0 }} />
          ) : pct >= 20 ? (
            <AlertTriangle size={14} style={{ color: "var(--piw-chart-3)", flexShrink: 0 }} />
          ) : (
            <AlertOctagon size={14} style={{ color: "var(--piw-destructive)", flexShrink: 0 }} />
          )}
          <span
            style={{
              fontFamily: FONT,
              fontSize: "var(--text-caption)",
              fontWeight: "var(--font-weight-medium)" as any,
              color: pct >= 50 ? "var(--piw-accent)" : pct >= 20 ? "var(--piw-chart-3)" : "var(--piw-destructive)",
              lineHeight: 1,
            }}
          >
            {pct}% {pct >= 50 ? "Healthy" : pct >= 20 ? "Warning" : "Critical"}
          </span>
          {hoveredHealth && (
            <div
              className="absolute"
              style={{
                bottom: "calc(100% + 8px)",
                left: "50%",
                transform: "translateX(-50%)",
                background: "var(--popover, #ffffff)",
                color: "var(--popover-foreground, var(--piw-foreground))",
                border: "1px solid var(--piw-border)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--spacing-1) var(--spacing-2-5)",
                fontSize: "var(--text-caption)",
                fontFamily: FONT,
                fontWeight: "var(--font-weight-normal)" as any,
                whiteSpace: "nowrap",
                pointerEvents: "none",
                zIndex: 20,
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              {pct >= 50 ? "Stock is within the healthy Min/Max threshold range" : pct >= 20 ? "Stock approaching threshold limits — monitor closely" : "Stock level is critically outside the acceptable range"}
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 0,
                  height: 0,
                  borderLeft: "4px solid transparent",
                  borderRight: "4px solid transparent",
                  borderTop: "4px solid var(--piw-border)",
                }}
              />
            </div>
          )}
        </div>

        {/* Max label with popover */}
        <div
          className="relative"
          onMouseEnter={() => setHoveredThreshold("max")}
          onMouseLeave={() => setHoveredThreshold(null)}
        >
          <div
            className="flex items-center"
            style={{
              gap: "var(--spacing-1)",
              cursor: "default",
              padding: "var(--spacing-0-5) var(--spacing-1)",
              borderRadius: "var(--radius-sm)",
              transition: "background 0.15s ease",
              background: hoveredThreshold === "max" ? "var(--surface-secondary)" : "transparent",
            }}
          >
            <span
              style={{
                fontFamily: FONT,
                fontSize: "var(--text-body-sm)",
                fontWeight: "var(--font-weight-medium)" as any,
                color: hoveredThreshold === "max" ? "var(--text-secondary)" : "var(--text-tertiary)",
                transition: "color 0.15s ease",
              }}
            >
              Max {maxQty}
            </span>
            <Info
              size={12}
              style={{
                color: hoveredThreshold === "max" ? "var(--piw-primary)" : "var(--text-tertiary)",
                transition: "color 0.15s ease",
                flexShrink: 0,
              }}
            />
          </div>
          {hoveredThreshold === "max" && (
            <div
              className="absolute"
              style={{
                bottom: "calc(100% + 6px)",
                right: "0",
                background: "var(--piw-card)",
                border: "1px solid var(--piw-border)",
                borderRadius: "var(--radius-md)",
                padding: "var(--spacing-3)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)",
                zIndex: 30,
                width: "200px",
              }}
            >
              <div className="flex items-center" style={{ gap: "var(--spacing-1-5)", marginBottom: "var(--spacing-1-5)" }}>
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "var(--piw-chart-3)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT,
                    fontWeight: "var(--font-weight-semibold)" as any,
                    fontSize: "var(--text-caption)",
                    color: "var(--piw-foreground)",
                  }}
                >
                  Maximum Threshold
                </span>
              </div>
              <p
                style={{
                  fontFamily: FONT,
                  fontWeight: "var(--font-weight-normal)" as any,
                  fontSize: "var(--text-caption)",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                The upper stocking limit. Exceeding {maxQty} EA indicates overstock, tying up capital and warehouse space.
              </p>
              {/* Arrow */}
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: "20px",
                  width: 0,
                  height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: "5px solid var(--piw-border)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% - 1px)",
                  right: "20px",
                  width: 0,
                  height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: "5px solid var(--piw-card)",
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Compact stat grid with hover tooltips */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--spacing-2) var(--spacing-4)",
          width: "100%",
          flex: 1,
          marginTop: "var(--spacing-4)",
          paddingTop: "var(--spacing-4)",
          borderTop: "1px solid var(--piw-border)",
          alignContent: "start",
        }}
      >
        {uom.stats.map((s) => {
          const isHovered = hoveredStat === s.label;
          return (
            <div
              key={s.label}
              id={`stat-${s.label.replace(/\s+/g, '-')}`}
              className="relative flex flex-col"
              style={{
                gap: "var(--spacing-0-5)",
                padding: "var(--spacing-1-5) var(--spacing-1-5)",
                borderRadius: "var(--radius-sm)",
                cursor: "default",
                transition: "background 0.15s ease, box-shadow 0.15s ease",
                background: isHovered ? "var(--surface-secondary)" : "transparent",
                boxShadow: isHovered ? "0 0 0 1px var(--piw-border)" : "none",
              }}
              onMouseEnter={() => setHoveredStat(s.label)}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: "var(--text-body-sm)",
                  fontWeight: "var(--font-weight-normal)" as any,
                  color: "var(--text-tertiary)",
                  lineHeight: 1.4,
                  transition: "color 0.15s ease",
                  ...(isHovered ? { color: "var(--text-secondary)" } : {}),
                }}
              >
                {s.label}
              </span>
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: "var(--text-label)",
                  fontWeight: "var(--font-weight-semibold)" as any,
                  color: "var(--piw-foreground)",
                  lineHeight: 1.3,
                }}
              >
                {s.value}
              </span>

              {/* Tooltip — rendered via portal to avoid overflow clipping */}
              {isHovered && (() => {
                const el = document.getElementById(`stat-${s.label.replace(/\s+/g, '-')}`);
                if (!el) return null;
                const rect = el.getBoundingClientRect();
                return createPortal(
                  <div
                    style={{
                      position: "fixed",
                      bottom: `calc(100vh - ${rect.top}px + 4px)`,
                      left: `${rect.left + rect.width / 2}px`,
                      transform: "translateX(-50%)",
                      background: "var(--popover, #ffffff)",
                      color: "var(--popover-foreground, var(--piw-foreground))",
                      border: "1px solid var(--piw-border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "var(--spacing-1) var(--spacing-2)",
                      fontSize: "var(--text-caption)",
                      fontFamily: FONT,
                      fontWeight: "var(--font-weight-normal)" as any,
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      zIndex: 9999,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}
                  >
                    {s.tooltip}
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 0,
                        height: 0,
                        borderLeft: "4px solid transparent",
                        borderRight: "4px solid transparent",
                        borderTop: "4px solid var(--piw-border)",
                      }}
                    />
                  </div>,
                  document.body,
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}