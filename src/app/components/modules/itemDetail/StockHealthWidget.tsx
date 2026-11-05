import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, ChevronDown } from "lucide-react";

type ItemLike = {
  onHandQty?: number;
  unit?: string;
  alternativeStockingUnits?: string;
  reorderPoint?: number;
  safetyStock?: number;
};

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

function needleAngle(current: number, min: number, max: number): number {
  const pct = Math.max(0, Math.min(1, (current - min) / Math.max(max - min, 1)));
  return -120 + pct * 240;
}

function withAlpha(hsl: string, alpha: number) {
  return hsl.replace("hsl(", "hsla(").replace(")", ` / ${alpha})`);
}

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

function buildUomData(item: ItemLike): UOMConfig[] {
  const onHand = Number(item.onHandQty) || 0;
  const baseUnit = (item.unit || "EA").toUpperCase();
  const parsedAltFactor = Number(item.alternativeStockingUnits?.match(/\((\d+)\)/)?.[1] || 12);
  const minBase = Math.max(100, Number(item.reorderPoint) || 200);
  const maxBase = Math.max(minBase + 100, minBase * 3);
  const available = Math.max(onHand - Math.round(onHand * 0.17), 0);
  const allocated = Math.max(onHand - available, 0);
  const onOrder = Math.max(minBase * 10, 2000);
  const projected = onHand + onOrder;
  const configs = [
    { key: "ea", label: `${baseUnit} (default)`, abbr: baseUnit, conversionFactor: 1 },
    { key: "box", label: "Box", abbr: "BOX", conversionFactor: parsedAltFactor },
    { key: "carton", label: "Carton", abbr: "CTN", conversionFactor: parsedAltFactor * 4 },
  ];

  return configs.map((config) => {
    const convert = (value: number) => Math.max(Math.round(value / config.conversionFactor), 0);
    const fmt = (value: number) => `${convert(value).toLocaleString()} ${config.abbr}`;
    return {
      ...config,
      min: convert(minBase),
      max: convert(maxBase),
      current: convert(onHand),
      stats: [
        { label: "Available", value: fmt(available), tooltip: "Stock ready for use" },
        { label: "Allocated", value: fmt(allocated), tooltip: "Allocated for work orders or sales" },
        { label: "On Order", value: fmt(onOrder), tooltip: "Incoming purchase orders" },
        { label: "Quarantined", value: "0", tooltip: "Held for quality inspection" },
        { label: "In Production", value: "0", tooltip: "Currently being manufactured" },
        { label: "Projected Available", value: fmt(projected), tooltip: "Forecasted availability (On-Hand + On Order)" },
      ],
    };
  });
}

export function StockHealthWidget({ item }: { item: ItemLike }) {
  const uomData = useMemo(() => buildUomData(item), [item]);
  const [selectedUOM, setSelectedUOM] = useState(uomData[0]?.label ?? "EA (default)");
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);
  const [hoveredThreshold, setHoveredThreshold] = useState<"min" | "max" | null>(null);
  const [needleRendered, setNeedleRendered] = useState(false);
  const [uomMenuOpen, setUomMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, minWidth: 0 });

  const handleZoneHover = useCallback((key: string | null) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (key === null) {
      hoverTimerRef.current = setTimeout(() => setHoveredZone(null), 60);
    } else {
      setHoveredZone(key);
    }
  }, []);

  const uom = useMemo(
    () => uomData.find((entry) => entry.label === selectedUOM) || uomData[0],
    [selectedUOM, uomData],
  );

  useEffect(() => {
    setSelectedUOM((current) => (uomData.some((entry) => entry.label === current) ? current : uomData[0]?.label ?? "EA (default)"));
  }, [uomData]);

  useEffect(() => {
    setNeedleRendered(false);
    const timer = setTimeout(() => setNeedleRendered(true), 100);
    return () => clearTimeout(timer);
  }, [selectedUOM]);

  useEffect(() => {
    if (!uomMenuOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.right, minWidth: Math.max(rect.width, 160) });
  }, [uomMenuOpen]);

  useEffect(() => {
    if (!uomMenuOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setUomMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [uomMenuOpen]);

  if (!uom) return null;

  const minQty = uom.min;
  const maxQty = uom.max;
  const currentQty = uom.current;
  const pct = Math.round(((currentQty - minQty) / Math.max(maxQty - minQty, 1)) * 100);
  const primary = "hsl(var(--primary))";
  const chart3 = "hsl(var(--chart-3))";
  const destructive = "hsl(var(--destructive))";
  const border = "hsl(var(--border))";
  const foreground = "hsl(var(--foreground))";
  const card = "hsl(var(--card))";
  const secondarySurface = "hsl(var(--secondary))";
  const mutedText = "hsl(var(--muted-foreground))";

  const zones: Zone[] = [
    { key: "critical-low", label: "Critical Low", range: `${minQty}–${minQty + 50}`, color: withAlpha(destructive, 0.38), startDeg: 0, endDeg: 0, pct: 8 },
    { key: "low", label: "Low Stock", range: `${minQty + 50}–${minQty + 120}`, color: withAlpha(chart3, 0.45), startDeg: 0, endDeg: 0, pct: 12 },
    { key: "healthy", label: "Healthy", range: `${minQty + 120}–${maxQty - 120}`, color: primary, startDeg: 0, endDeg: 0, pct: 50 },
    { key: "high", label: "High Stock", range: `${maxQty - 120}–${maxQty - 50}`, color: withAlpha(chart3, 0.45), startDeg: 0, endDeg: 0, pct: 12 },
    { key: "critical-high", label: "Critical High", range: `${maxQty - 50}–${maxQty}`, color: withAlpha(destructive, 0.38), startDeg: 0, endDeg: 0, pct: 8 },
    { key: "over", label: "Over Max", range: `>${maxQty}`, color: withAlpha(border, 0.3), startDeg: 0, endDeg: 0, pct: 10 },
  ];

  const hoveredZoneData = zones.find((zone) => zone.key === hoveredZone);
  const svgW = 220;
  const svgH = 145;
  const cx = svgW / 2;
  const cy = 120;
  const r = 95;
  const thickness = 20;
  const nAngle = needleAngle(currentQty, minQty, maxQty);

  return (
    <div className="flex flex-col h-full mx-auto w-fit">
      <div className="flex justify-end mb-1">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setUomMenuOpen((open) => !open)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40"
          style={{ fontWeight: 500 }}
        >
          {selectedUOM}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {uomMenuOpen && createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              transform: "translateX(-100%)",
              zIndex: 9999,
              background: card,
              border: `1px solid ${border}`,
              borderRadius: 8,
              padding: 4,
              minWidth: `${menuPos.minWidth}px`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
            }}
          >
            {uomData.map((option) => {
              const isActive = option.label === selectedUOM;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setSelectedUOM(option.label);
                    setUomMenuOpen(false);
                  }}
                  className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[12px]"
                  style={{
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? primary : foreground,
                    background: isActive ? "hsl(var(--accent))" : "transparent",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
      </div>

      <div className="flex justify-center" style={{ marginTop: 4 }}>
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
              <line x1={cx} y1={cy - 10} x2={cx} y2={cy - r + thickness + 36} stroke={foreground} strokeWidth={1.5} strokeLinecap="round" />
              <circle cx={cx} cy={cy - 10} r={2.5} fill={foreground} />
            </g>
          </svg>

          <div className="absolute flex flex-col items-center" style={{ bottom: "2px", left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }}>
            <span style={{ fontWeight: 600, fontSize: 24, color: foreground, lineHeight: 1, transition: "opacity 0.2s ease", opacity: hoveredZone ? 0.4 : 1 }}>
              {currentQty}
            </span>
            <span style={{ fontSize: 12, color: mutedText, lineHeight: 1.4, marginTop: 2 }}>
              {uom.abbr} On-Hand
            </span>
          </div>

          {hoveredZoneData && (
            <div className="absolute" style={{ top: "16px", left: "50%", transform: "translateX(-50%)", background: card, border: `1px solid ${border}`, borderRadius: 6, padding: "6px 10px", boxShadow: "0 4px 12px rgba(0,0,0,0.10)", pointerEvents: "none", zIndex: 10, whiteSpace: "nowrap" }}>
              <div className="flex items-center gap-1.5">
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: hoveredZoneData.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 11, color: foreground }}>{hoveredZoneData.label}</span>
                <span style={{ fontSize: 11, color: mutedText }}>{hoveredZoneData.range}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between" style={{ padding: 0, marginTop: 4 }}>
        <div className="relative" onMouseEnter={() => setHoveredThreshold("min")} onMouseLeave={() => setHoveredThreshold(null)}>
          <div className="flex items-center" style={{ gap: 4, cursor: "default", padding: "2px 4px", borderRadius: 6, transition: "background 0.15s ease", background: hoveredThreshold === "min" ? secondarySurface : "transparent" }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: mutedText }}>Min {minQty}</span>
            <Info size={12} style={{ color: hoveredThreshold === "min" ? primary : mutedText, transition: "color 0.15s ease", flexShrink: 0 }} />
          </div>
        </div>

        <div className="relative" onMouseEnter={() => setHoveredThreshold("max")} onMouseLeave={() => setHoveredThreshold(null)}>
          <div className="flex items-center" style={{ gap: 4, cursor: "default", padding: "2px 4px", borderRadius: 6, transition: "background 0.15s ease", background: hoveredThreshold === "max" ? secondarySurface : "transparent" }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: mutedText }}>Max {maxQty}</span>
            <Info size={12} style={{ color: hoveredThreshold === "max" ? primary : mutedText, transition: "color 0.15s ease", flexShrink: 0 }} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 16px", width: "100%", flex: 1, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${border}`, alignContent: "start" }}>
        {uom.stats.map((stat) => {
          const isHovered = hoveredStat === stat.label;
          return (
            <div
              key={stat.label}
              id={`stat-${stat.label.replace(/\s+/g, "-")}`}
              className="relative flex flex-col"
              style={{ gap: 2, padding: "6px", borderRadius: 6, cursor: "default", transition: "background 0.15s ease, box-shadow 0.15s ease", background: isHovered ? secondarySurface : "transparent", boxShadow: isHovered ? `0 0 0 1px ${border}` : "none" }}
              onMouseEnter={() => setHoveredStat(stat.label)}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <span style={{ fontSize: 12, color: mutedText, lineHeight: 1.4 }}>{stat.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: foreground, lineHeight: 1.3 }}>{stat.value}</span>
              {isHovered && (() => {
                const el = document.getElementById(`stat-${stat.label.replace(/\s+/g, "-")}`);
                if (!el) return null;
                const rect = el.getBoundingClientRect();
                return createPortal(
                  <div style={{ position: "fixed", bottom: `calc(100vh - ${rect.top}px + 4px)`, left: `${rect.left + rect.width / 2}px`, transform: "translateX(-50%)", background: foreground, color: "hsl(var(--background))", borderRadius: 6, padding: "4px 8px", fontSize: 11, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 9999, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                    {stat.tooltip}
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