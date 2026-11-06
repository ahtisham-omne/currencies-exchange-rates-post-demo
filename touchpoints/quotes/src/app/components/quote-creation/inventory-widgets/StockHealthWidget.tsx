/**
 * StockHealthWidget — Interactive semi-circle arc gauge with hover tooltips.
 *
 * Ported from Physical Inventory v4 (`widgets/stock-health-gauge.tsx`).
 * The only adaptation is the prop-driven UOM_DATA so the host modal can
 * pipe live inventory numbers into the widget. All interactions are
 * verbatim:
 *   • 3-zone arc (Below Minimum / Healthy / Above Maximum) with
 *     hover dimming + tooltip overlay
 *   • Min / Max threshold popovers anchored to label rows
 *   • Healthy / Warning / Critical badge with a small popover
 *   • Per-stat hover background + portal-rendered tooltip
 *   • Negative-inventory badge when current < 0
 *   • UOM selector dropdown (EA / Box / Carton / Pallet)
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Info, Activity, CheckCircle2, AlertTriangle, AlertOctagon } from "lucide-react";
import { FONT, resolveVar, withAlpha } from "./widget-utils";
import { WidgetHeader, SmallSelect } from "./widget-primitives";

interface Zone {
  key: string;
  label: string;
  range: string;
  color: string;
  startDeg: number;
  endDeg: number;
  pct: number;
}

interface StatItem {
  label: string;
  value: string;
  tooltip: string;
}

interface UOMConfig {
  key: string;
  label: string;
  abbr: string;
  conversionFactor: number;
  min: number;
  max: number;
  current: number;
  stats: StatItem[];
}

export interface StockHealthWidgetProps {
  onHand: number;
  minQty: number;
  maxQty: number;
  available: number;
  reserved: number;
  onOrder: number;
  quarantined: number;
  inProduction: number;
  projectedAvailable: number;
}

function needleAngle(current: number, min: number, max: number): number {
  const pct = Math.max(0, Math.min(1, (current - min) / Math.max(1, max - min)));
  return -120 + pct * 240;
}

function GaugeArc({
  cx, cy, r, thickness, zones, hoveredZone, onHover,
}: {
  cx: number; cy: number; r: number; thickness: number;
  zones: Zone[]; hoveredZone: string | null;
  onHover: (key: string | null) => void;
}) {
  const totalDeg = 240;
  const startAngle = 150;
  const midR = r - thickness / 2;

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

export function StockHealthWidget(props: StockHealthWidgetProps) {
  /* Build UOM table from props. EA is canonical; the others derive
     min/max/current via fixed conversion factors so the gauge moves
     correctly across UOMs. Stat tooltips mirror v4 copy. */
  const UOM_DATA: UOMConfig[] = useMemo(() => {
    const buildStats = (factor: number, unit: string): StatItem[] => {
      const available = Math.round(props.available / factor);
      const allocated = Math.round(props.reserved / factor);
      const onOrder = Math.round(props.onOrder / factor);
      const quarantined = Math.round(props.quarantined / factor);
      const inProduction = Math.round(props.inProduction / factor);
      const projectedAvailable = Math.round(props.projectedAvailable / factor);
      return [
        { label: "Available", value: `${available.toLocaleString()} ${unit}`, tooltip: "Stock ready for use" },
        { label: "Allocated", value: `${allocated.toLocaleString()} ${unit}`, tooltip: "Allocated for work orders or sales" },
        { label: "On Order", value: `${onOrder.toLocaleString()} ${unit}`, tooltip: "Incoming purchase orders" },
        { label: "Quarantined", value: `${quarantined.toLocaleString()}`, tooltip: "Held for quality inspection" },
        { label: "In Production", value: `${inProduction.toLocaleString()}`, tooltip: "Currently being manufactured" },
        { label: "Projected Available", value: `${projectedAvailable.toLocaleString()} ${unit}`, tooltip: "Forecasted availability (On-Hand + On Order − Demand)" },
      ];
    };
    return [
      {
        key: "ea", label: "EA (default)", abbr: "EA", conversionFactor: 1,
        min: props.minQty, max: props.maxQty, current: props.onHand,
        stats: buildStats(1, "EA"),
      },
      {
        key: "box", label: "Box", abbr: "BOX", conversionFactor: 12,
        min: Math.max(1, Math.round(props.minQty / 12)),
        max: Math.max(1, Math.round(props.maxQty / 12)),
        current: Math.max(0, Math.round(props.onHand / 12)),
        stats: buildStats(12, "BOX"),
      },
      {
        key: "carton", label: "Carton", abbr: "CTN", conversionFactor: 48,
        min: Math.max(1, Math.round(props.minQty / 48)),
        max: Math.max(1, Math.round(props.maxQty / 48)),
        current: Math.max(0, Math.round(props.onHand / 48)),
        stats: buildStats(48, "CTN"),
      },
      {
        key: "pallet", label: "Pallet", abbr: "PLT", conversionFactor: 240,
        min: Math.max(1, Math.round(props.minQty / 240)),
        max: Math.max(1, Math.round(props.maxQty / 240)),
        current: Math.max(0, Math.round(props.onHand / 240)),
        stats: buildStats(240, "PLT"),
      },
    ];
  }, [props]);

  const [selectedUOM, setSelectedUOM] = useState("EA (default)");
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);
  const [hoveredThreshold, setHoveredThreshold] = useState<"min" | "max" | null>(null);
  const [needleRendered, setNeedleRendered] = useState(false);
  const [hoveredHealth, setHoveredHealth] = useState(false);

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleZoneHover = useCallback((key: string | null) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (key === null) {
      hoverTimerRef.current = setTimeout(() => setHoveredZone(null), 60);
    } else {
      setHoveredZone(key);
    }
  }, []);

  const uom = useMemo(
    () => UOM_DATA.find((u) => u.label === selectedUOM) || UOM_DATA[0],
    [selectedUOM, UOM_DATA],
  );

  const minQty = uom.min;
  const maxQty = uom.max;
  const currentQty = uom.current;
  const pct = Math.max(
    0,
    Math.min(100, Math.round(((currentQty - minQty) / Math.max(1, maxQty - minQty)) * 100)),
  );

  useEffect(() => {
    setNeedleRendered(false);
    const t = setTimeout(() => setNeedleRendered(true), 100);
    return () => clearTimeout(t);
  }, [selectedUOM]);

  /* Resolve colors at render. Local literal for the healthy green
     because this module's `--accent` is a callout-blue rather than
     the Physical Inventory green. */
  const accent = "#27B973";
  const chart3 = resolveVar("var(--chart-3)");
  const destructive = resolveVar("var(--destructive)");

  const isNegative = currentQty < 0;
  const zones: Zone[] = [
    { key: "below-min", label: "Below Minimum", range: `<${minQty}`, color: withAlpha(destructive, 0.45), startDeg: 0, endDeg: 0, pct: 15 },
    { key: "healthy", label: "Healthy", range: `${minQty}–${maxQty}`, color: accent, startDeg: 0, endDeg: 0, pct: 70 },
    { key: "above-max", label: "Above Maximum", range: `>${maxQty}`, color: withAlpha(chart3, 0.5), startDeg: 0, endDeg: 0, pct: 15 },
  ];

  const hoveredZoneData = zones.find((z) => z.key === hoveredZone);

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
          <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ overflow: "visible" }}>
            <GaugeArc cx={cx} cy={cy} r={r} thickness={thickness} zones={zones} hoveredZone={hoveredZone} onHover={handleZoneHover} />

            <g
              style={{
                transform: `rotate(${needleRendered ? nAngle : -120}deg)`,
                transformOrigin: `${cx}px ${cy}px`,
                transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              {(() => {
                const T = 73;
                const B = 48;
                const baseHW = 2.2;
                const midHW = 0.9;
                const tipR = 0.7;
                const midY = cy - (B + (T - B) * 0.55);
                const fg = resolveVar("var(--foreground)");
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
            style={{ bottom: "2px", left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }}
          >
            <span
              style={{
                fontFamily: FONT,
                fontWeight: "var(--font-weight-semibold)" as any,
                fontSize: "var(--text-h3)",
                color: isNegative ? "var(--destructive)" : "var(--foreground)",
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
                <AlertOctagon size={12} style={{ color: "var(--destructive)", flexShrink: 0 }} />
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: "var(--text-caption)",
                    fontWeight: "var(--font-weight-semibold)" as any,
                    color: "var(--destructive)",
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
                top: "16px", left: "50%", transform: "translateX(-50%)",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--spacing-1-5) var(--spacing-2-5)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
                pointerEvents: "none",
                zIndex: 10,
                whiteSpace: "nowrap",
              }}
            >
              <div className="flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: hoveredZoneData.color, flexShrink: 0 }} />
                <span style={{ fontFamily: FONT, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "var(--text-caption)", color: "var(--foreground)" }}>
                  {hoveredZoneData.label}
                </span>
                <span style={{ fontFamily: FONT, fontWeight: "var(--font-weight-normal)" as any, fontSize: "var(--text-caption)", color: "var(--text-tertiary)" }}>
                  {hoveredZoneData.range}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Min/Max labels + healthy badge */}
      <div className="flex items-center justify-between" style={{ padding: "0", marginTop: "var(--spacing-1)" }}>
        {/* Min */}
        <div
          className="relative"
          onMouseEnter={() => setHoveredThreshold("min")}
          onMouseLeave={() => setHoveredThreshold(null)}
        >
          <div
            className="flex items-center"
            style={{
              gap: "var(--spacing-1)", cursor: "default",
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
                color: hoveredThreshold === "min" ? "var(--primary)" : "var(--text-tertiary)",
                transition: "color 0.15s ease",
                flexShrink: 0,
              }}
            />
          </div>
          {hoveredThreshold === "min" && (
            <div
              className="absolute"
              style={{
                bottom: "calc(100% + 6px)", left: "0",
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)", padding: "var(--spacing-3)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)",
                zIndex: 30, width: "200px",
              }}
            >
              <div className="flex items-center" style={{ gap: "var(--spacing-1-5)", marginBottom: "var(--spacing-1-5)" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--destructive)", flexShrink: 0 }} />
                <span style={{ fontFamily: FONT, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "var(--text-caption)", color: "var(--foreground)" }}>
                  Minimum Threshold
                </span>
              </div>
              <p style={{ fontFamily: FONT, fontWeight: "var(--font-weight-normal)" as any, fontSize: "var(--text-caption)", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                The lowest acceptable stock level. Falling below {minQty} {uom.abbr} triggers a reorder alert to prevent stockouts.
              </p>
              <div style={{ position: "absolute", top: "100%", left: "20px", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid var(--border)" }} />
              <div style={{ position: "absolute", top: "calc(100% - 1px)", left: "20px", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid var(--card)" }} />
            </div>
          )}
        </div>

        {/* Healthy badge */}
        <div
          className="relative inline-flex items-center"
          onMouseEnter={() => setHoveredHealth(true)}
          onMouseLeave={() => setHoveredHealth(false)}
          style={{
            cursor: "default", gap: "var(--spacing-1)",
            padding: "var(--spacing-0-5) var(--spacing-2)",
            borderRadius: "var(--radius-sm)",
            background: hoveredHealth ? "var(--surface-secondary)" : "transparent",
            transition: "background 0.15s ease",
          }}
        >
          {pct >= 50 ? (
            <CheckCircle2 size={14} style={{ color: accent, flexShrink: 0 }} />
          ) : pct >= 20 ? (
            <AlertTriangle size={14} style={{ color: "var(--chart-3)", flexShrink: 0 }} />
          ) : (
            <AlertOctagon size={14} style={{ color: "var(--destructive)", flexShrink: 0 }} />
          )}
          <span
            style={{
              fontFamily: FONT,
              fontSize: "var(--text-caption)",
              fontWeight: "var(--font-weight-medium)" as any,
              color: pct >= 50 ? accent : pct >= 20 ? "var(--chart-3)" : "var(--destructive)",
              lineHeight: 1,
            }}
          >
            {pct}% {pct >= 50 ? "Healthy" : pct >= 20 ? "Warning" : "Critical"}
          </span>
          {hoveredHealth && (
            <div
              className="absolute"
              style={{
                bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
                background: "var(--popover, #ffffff)",
                color: "var(--popover-foreground, var(--foreground))",
                border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                padding: "var(--spacing-1) var(--spacing-2-5)",
                fontSize: "var(--text-caption)", fontFamily: FONT,
                fontWeight: "var(--font-weight-normal)" as any,
                whiteSpace: "nowrap", pointerEvents: "none",
                zIndex: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              {pct >= 50 ? "Stock is within the healthy Min/Max threshold range" : pct >= 20 ? "Stock approaching threshold limits — monitor closely" : "Stock level is critically outside the acceptable range"}
              <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "4px solid var(--border)" }} />
            </div>
          )}
        </div>

        {/* Max */}
        <div
          className="relative"
          onMouseEnter={() => setHoveredThreshold("max")}
          onMouseLeave={() => setHoveredThreshold(null)}
        >
          <div
            className="flex items-center"
            style={{
              gap: "var(--spacing-1)", cursor: "default",
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
                color: hoveredThreshold === "max" ? "var(--primary)" : "var(--text-tertiary)",
                transition: "color 0.15s ease",
                flexShrink: 0,
              }}
            />
          </div>
          {hoveredThreshold === "max" && (
            <div
              className="absolute"
              style={{
                bottom: "calc(100% + 6px)", right: "0",
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)", padding: "var(--spacing-3)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)",
                zIndex: 30, width: "200px",
              }}
            >
              <div className="flex items-center" style={{ gap: "var(--spacing-1-5)", marginBottom: "var(--spacing-1-5)" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--chart-3)", flexShrink: 0 }} />
                <span style={{ fontFamily: FONT, fontWeight: "var(--font-weight-semibold)" as any, fontSize: "var(--text-caption)", color: "var(--foreground)" }}>
                  Maximum Threshold
                </span>
              </div>
              <p style={{ fontFamily: FONT, fontWeight: "var(--font-weight-normal)" as any, fontSize: "var(--text-caption)", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                The upper stocking limit. Exceeding {maxQty} {uom.abbr} indicates overstock, tying up capital and warehouse space.
              </p>
              <div style={{ position: "absolute", top: "100%", right: "20px", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid var(--border)" }} />
              <div style={{ position: "absolute", top: "calc(100% - 1px)", right: "20px", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid var(--card)" }} />
            </div>
          )}
        </div>
      </div>

      {/* Stat grid — v4 hover-cell-with-portal-tooltip pattern */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--spacing-2) var(--spacing-4)",
          width: "100%", flex: 1,
          marginTop: "var(--spacing-4)",
          paddingTop: "var(--spacing-4)",
          borderTop: "1px solid var(--border)",
          alignContent: "start",
        }}
      >
        {uom.stats.map((s) => {
          const isHovered = hoveredStat === s.label;
          const cellId = `stat-${s.label.replace(/\s+/g, "-")}`;
          return (
            <div
              key={s.label}
              id={cellId}
              className="relative flex flex-col"
              style={{
                gap: "var(--spacing-0-5)",
                padding: "var(--spacing-1-5) var(--spacing-1-5)",
                borderRadius: "var(--radius-sm)",
                cursor: "default",
                transition: "background 0.15s ease, box-shadow 0.15s ease",
                background: isHovered ? "var(--surface-secondary)" : "transparent",
                boxShadow: isHovered ? "0 0 0 1px var(--border)" : "none",
              }}
              onMouseEnter={() => setHoveredStat(s.label)}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: "var(--text-body-sm)",
                  fontWeight: "var(--font-weight-normal)" as any,
                  color: isHovered ? "var(--text-secondary)" : "var(--text-tertiary)",
                  lineHeight: 1.4,
                  transition: "color 0.15s ease",
                }}
              >
                {s.label}
              </span>
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: "var(--text-label)",
                  fontWeight: "var(--font-weight-semibold)" as any,
                  color: "var(--foreground)",
                  lineHeight: 1.3,
                }}
              >
                {s.value}
              </span>

              {isHovered && (() => {
                const el = document.getElementById(cellId);
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
                      color: "var(--popover-foreground, var(--foreground))",
                      border: "1px solid var(--border)",
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
                    <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "4px solid var(--border)" }} />
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
