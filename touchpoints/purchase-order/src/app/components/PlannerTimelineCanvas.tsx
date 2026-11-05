/* ═══════════════════════════════════════════════════════════════
   PLANNER TIMELINE CANVAS  (the Gantt planning surface)
   ───────────────────────────────────────────────────────────────
   A single-item planning Gantt. One shared time axis, two panes:

     LEFT RAIL  — collapsible groups, each row labelled:
         · Demand        the SO / request consumption that drives the gap
         · Inbound       supply already on its way (in-flight POs)
         · Plan          the vendors you're ordering from (PO bars). Each
                         vendor carries its primary allocation plus any
                         extra POs you add ("+ PO") to split an order.
       …plus a Coverage label aligned to the ribbon.

     RIGHT CANVAS — the same horizon drawn once (zoomable + scrollable):
         · day/week grid, weekend shading, month + day headers, TODAY
           line, need-by line
         · demand → milestone diamonds (drag = reschedule, dot = on/off)
         · vendor → order→arrival bars, green on-time / red late, with a
                    MOQ-aware qty stepper; drag the bar = move arrival
         · predicted → dashed "ghost" rows you add by hand (what-if)
         · dependency connectors — a faint line from each on-time PO to
           the demand it covers (cause → cure)

     COVERAGE RIBBON (pinned beneath, same x):
         a per-day severity heatmap + the enhanced ATP line over a faint
         "today's reality" baseline. The delta is what ordering buys you.

   Presentational: the workspace owns all state, recomputes the curves
   from it, and passes handlers down.
   ═══════════════════════════════════════════════════════════════ */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  X,
  Clock,
  Sparkles,
  Truck,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  CornerDownRight,
} from "lucide-react";
import type { PlannerItem, PlannerVendor } from "./plannerData";
import { vendorConstraints } from "./plannerData";
import { effectivePrice, severityForAtp, type ProjectionPoint } from "../utils/projection";
import type { GapGraphEvent } from "./PlannerGapGraph";

/* ─────────────────────────── CONSTANTS ─────────────────────────── */

const VIOLET = "#0A77FF";
const C_ZERO = "#c93248"; // negative / at-zero
const C_MIN = "#d48e29"; // below min
const C_OK = "#228864"; // healthy
const EMERALD = "#16a34a";

const RAIL_W = 320;
const AXIS_H = 30; // top strip for month + day/week labels
const ROW_H = 36;
const GROUP_H = 28;
const RIBBON_H = 104;
const PAD_L = 12;
const PAD_R = 16;

const DIAMOND = 13;

/** Zoom multipliers over the fit-to-width density. 1× = everything fits;
    higher zooms widen each day and let the canvas scroll horizontally. */
const ZOOM_LEVELS = [1, 1.5, 2, 3, 4] as const;

/* ─────────────────────────── TYPES ─────────────────────────── */

interface ExtraPORow {
  id: string;
  vendorId: string;
  qty: number;
  arrivalDay: number;
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const fmtDay = (d: number): string => {
  if (d === 0) return "today";
  return `+${d}d`;
};

const sevColor = (atp: number, minLevel: number): string => {
  const s = severityForAtp(atp, minLevel);
  if (s === "negative" || s === "at_zero") return C_ZERO;
  if (s === "below_min") return C_MIN;
  return C_OK;
};

/* ─────────────────────────── PROPS ─────────────────────────── */

interface PlannerTimelineCanvasProps {
  item: PlannerItem;
  baseUom: string;
  horizonDays: number;
  horizonOptions: readonly number[];
  onHorizonChange: (h: number) => void;
  needByDay: number | null;
  /** Enhanced projection (reality + in-flight + your proposed POs). */
  curve: ProjectionPoint[];
  /** Baseline projection (reality + in-flight, no proposed POs). */
  baselineCurve: ProjectionPoint[];
  /** Demand / incoming / proposed / mock tiles, effective days applied. */
  events: GapGraphEvent[];
  vendors: PlannerVendor[];
  selectedVendorIds: Set<string>;
  allocations: Map<string, number>;
  arrivalByVendor: Map<string, number>;
  onMoveEvent: (id: string, day: number) => void;
  onToggleEvent: (id: string) => void;
  onToggleVendor: (id: string) => void;
  onSetAllocation: (id: string, qty: number) => void;
  /** Extra POs per vendor (beyond the primary allocation). */
  extraPOs: ExtraPORow[];
  onAddExtraPO: (vendorId: string) => void;
  onRemoveExtraPO: (id: string) => void;
  onSetExtraPOQty: (id: string, qty: number) => void;
  onAddMock: (kind: "demand" | "supply", qty: number, day: number) => void;
  onRemoveMock: (id: string) => void;
  hasOverrides: boolean;
  onResetOverrides: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function PlannerTimelineCanvas({
  item,
  baseUom,
  horizonDays,
  horizonOptions,
  onHorizonChange,
  needByDay,
  curve,
  baselineCurve,
  events,
  vendors,
  selectedVendorIds,
  allocations,
  arrivalByVendor,
  onMoveEvent,
  onToggleEvent,
  onToggleVendor,
  onSetAllocation,
  extraPOs,
  onAddExtraPO,
  onRemoveExtraPO,
  onSetExtraPOQty,
  onAddMock,
  onRemoveMock,
  hasOverrides,
  onResetOverrides,
}: PlannerTimelineCanvasProps) {
  /* ── Measure the visible right pane for the fit-to-width density ── */
  const paneRef = useRef<HTMLDivElement>(null);
  const [paneW, setPaneW] = useState(720);
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && Math.abs(w - paneW) > 1) setPaneW(w);
    });
    ro.observe(el);
    setPaneW(el.clientWidth || 720);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Zoom (horizontal density) ── */
  const [zoomIdx, setZoomIdx] = useState(0);
  const zoom = ZOOM_LEVELS[zoomIdx];
  const basePxPerDay = Math.max(60, paneW - PAD_L - PAD_R) / Math.max(1, horizonDays);
  const pxPerDay = basePxPerDay * zoom;
  const x = (day: number) => PAD_L + day * pxPerDay;
  const canvasW = Math.max(paneW, Math.round(PAD_L + horizonDays * pxPerDay + PAD_R));
  const clampX = (v: number) => Math.max(PAD_L, Math.min(canvasW - PAD_R, v));
  /* Day numbers only fit (and only help) once each day is wide enough. */
  const dense = pxPerDay >= 16;

  /* ── Split the event list by lane ── */
  const demandRows = useMemo(
    () => events.filter((e) => e.kind === "demand").sort((a, b) => a.day - b.day),
    [events],
  );
  const supplyRows = useMemo(
    () => events.filter((e) => e.kind === "incoming").sort((a, b) => a.day - b.day),
    [events],
  );
  const selectedVendors = useMemo(
    () => vendors.filter((v) => selectedVendorIds.has(v.vendorId)),
    [vendors, selectedVendorIds],
  );
  const unselectedVendors = useMemo(
    () => vendors.filter((v) => !selectedVendorIds.has(v.vendorId)),
    [vendors, selectedVendorIds],
  );
  const extrasByVendor = useMemo(() => {
    const m = new Map<string, ExtraPORow[]>();
    for (const x of extraPOs) {
      const arr = m.get(x.vendorId) ?? [];
      arr.push(x);
      m.set(x.vendorId, arr);
    }
    return m;
  }, [extraPOs]);

  /* ── Collapsible groups ── */
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleGroup = (k: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const open = (k: string) => !collapsed.has(k);

  /* ── Add-vendor menu + predict form ── */
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [predictOpen, setPredictOpen] = useState(false);
  const [pKind, setPKind] = useState<"demand" | "supply">("demand");
  const [pQty, setPQty] = useState(10);
  const [pDay, setPDay] = useState(() => Math.min(horizonDays, 14));

  /* ── Steppers ── */
  const stepUp = (v: PlannerVendor) => {
    const c = vendorConstraints(item, v);
    const cur = allocations.get(v.vendorId) ?? 0;
    const next = cur === 0 ? c.moq : cur + c.orderMultiples;
    onSetAllocation(v.vendorId, Math.min(next, c.maxOrderQty));
  };
  const stepDown = (v: PlannerVendor) => {
    const c = vendorConstraints(item, v);
    const cur = allocations.get(v.vendorId) ?? 0;
    const next = cur <= c.moq ? 0 : cur - c.orderMultiples;
    onSetAllocation(v.vendorId, Math.max(0, next));
  };
  /* Extra-PO steppers: stepping below MOQ removes the PO (an extra PO with
     qty 0 is meaningless — it only exists once you've committed to a second
     order from that vendor). */
  const extraUp = (v: PlannerVendor, po: ExtraPORow) => {
    const c = vendorConstraints(item, v);
    onSetExtraPOQty(po.id, Math.min(po.qty + c.orderMultiples, c.maxOrderQty));
  };
  const extraDown = (v: PlannerVendor, po: ExtraPORow) => {
    const c = vendorConstraints(item, v);
    const next = po.qty <= c.moq ? 0 : po.qty - c.orderMultiples;
    if (next <= 0) onRemoveExtraPO(po.id);
    else onSetExtraPOQty(po.id, next);
  };

  /* ── Coverage read-out (cause → cure) ── */
  const cover = useMemo(() => {
    const min = item.minLevel;
    const baseWorst = baselineCurve.length ? Math.min(...baselineCurve.map((p) => p.atp)) : 0;
    const enhWorst = curve.length ? Math.min(...curve.map((p) => p.atp)) : 0;
    const firstShortBase = baselineCurve.find((p) => p.atp < min)?.day ?? null;
    const firstShortEnh = curve.find((p) => p.atp < min)?.day ?? null;
    return {
      baseWorst,
      enhWorst,
      firstShortBase,
      firstShortEnh,
      baseShort: Math.max(0, min - baseWorst),
      enhShort: Math.max(0, min - enhWorst),
      solved: enhWorst >= min && baseWorst < min,
    };
  }, [item.minLevel, baselineCurve, curve]);

  /* ── Build the ordered line list (shared by both panes) ── */
  type Line =
    | { t: "group"; key: string; label: string; count: number }
    | { t: "demand"; ev: GapGraphEvent }
    | { t: "supply"; ev: GapGraphEvent }
    | { t: "vendor"; v: PlannerVendor }
    | { t: "extraPO"; v: PlannerVendor; po: ExtraPORow }
    | { t: "addVendor" }
    | { t: "empty"; label: string };

  const lines: Line[] = [];
  lines.push({ t: "group", key: "demand", label: "Demand", count: demandRows.length });
  if (open("demand")) {
    if (demandRows.length === 0) lines.push({ t: "empty", label: "No demand in horizon" });
    else demandRows.forEach((ev) => lines.push({ t: "demand", ev }));
  }
  lines.push({ t: "group", key: "inbound", label: "Inbound supply", count: supplyRows.length });
  if (open("inbound")) {
    if (supplyRows.length === 0) lines.push({ t: "empty", label: "Nothing inbound" });
    else supplyRows.forEach((ev) => lines.push({ t: "supply", ev }));
  }
  lines.push({ t: "group", key: "plan", label: "Plan", count: selectedVendors.length });
  if (open("plan")) {
    selectedVendors.forEach((v) => {
      lines.push({ t: "vendor", v });
      (extrasByVendor.get(v.vendorId) ?? []).forEach((po) => lines.push({ t: "extraPO", v, po }));
    });
    lines.push({ t: "addVendor" });
  }

  /* Per-line y tops (for dependency connectors + separators). */
  const lineTops: number[] = [];
  {
    let y = AXIS_H;
    for (const l of lines) {
      lineTops.push(y);
      y += l.t === "group" ? GROUP_H : ROW_H;
    }
  }
  const yCenterOf = (i: number) => lineTops[i] + (lines[i].t === "group" ? GROUP_H : ROW_H) / 2;

  const rowsH = lines.reduce((s, l) => s + (l.t === "group" ? GROUP_H : ROW_H), 0);
  const totalH = AXIS_H + rowsH + RIBBON_H;

  /* ── Drag handling (whole days; pointer-based) ── */
  const drag = useRef<{ id: string; startX: number; startDay: number } | null>(null);
  const onDown = (e: ReactPointerEvent<HTMLElement>, id: string, startDay: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* non-capturable pointer — drag still works via clientX math */
    }
    drag.current = { id, startX: e.clientX, startDay };
  };
  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dd = Math.round((e.clientX - d.startX) / pxPerDay);
    onMoveEvent(d.id, Math.max(0, Math.min(horizonDays, d.startDay + dd)));
  };
  const onUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (drag.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be released */
      }
    }
    drag.current = null;
  };

  /* ── Calendar columns: weekend shading, month + day labels ── */
  const base = startOfToday();
  const days = useMemo(() => {
    const out: Array<{ d: number; dom: number; wd: number; monthStart: boolean; month: string }> = [];
    for (let d = 0; d <= horizonDays; d++) {
      const date = new Date(base);
      date.setDate(date.getDate() + d);
      out.push({
        d,
        dom: date.getDate(),
        wd: date.getDay(),
        monthStart: d === 0 || date.getDate() === 1,
        month: date.toLocaleDateString(undefined, { month: "short" }),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizonDays]);
  const weekTicks = useMemo(
    () =>
      days
        .filter((dd) => dd.d % 7 === 0)
        .map((dd) => ({ day: dd.d, label: `${dd.month} ${dd.dom}` })),
    [days],
  );

  /* ── Ribbon scales ── */
  const ribbonTop = AXIS_H + rowsH + 18;
  const ribbonBottom = totalH - 16;
  const allAtp = [...curve.map((p) => p.atp), ...baselineCurve.map((p) => p.atp), 0, item.minLevel];
  const yLo = Math.min(...allAtp);
  const yHi = Math.max(...allAtp);
  const yPad = Math.max(4, (yHi - yLo) * 0.12);
  const rMin = yLo - yPad;
  const rMax = yHi + yPad;
  const yR = (v: number) =>
    ribbonBottom - ((v - rMin) / Math.max(1, rMax - rMin)) * (ribbonBottom - ribbonTop);
  const linePath = (c: ProjectionPoint[]) =>
    c.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)},${yR(p.atp).toFixed(1)}`).join(" ");

  /* ── Dependency connectors: each on-time PO → the demand it covers ──
     "The demand it covers" = the first demand at/after the baseline first
     shortfall (the line that tips ATP under the floor). Only on-time, placed
     POs draw a connector — that's the cause→cure link the 'saves' badge marks. */
  const connectors = useMemo(() => {
    if (cover.firstShortBase == null) return [];
    const demandLines = lines
      .map((l, i) => ({ l, i }))
      .filter((o): o is { l: Extract<Line, { t: "demand" }>; i: number } => o.l.t === "demand" && !o.l.ev.excluded && !o.l.ev.signal);
    if (demandLines.length === 0) return [];
    const after = demandLines
      .filter((o) => o.l.ev.day >= (cover.firstShortBase as number))
      .sort((a, b) => a.l.ev.day - b.l.ev.day);
    const pick = after[0] ?? [...demandLines].sort((a, b) => b.l.ev.day - a.l.ev.day)[0];
    if (!pick) return [];
    const target = { x: clampX(x(pick.l.ev.day)), y: yCenterOf(pick.i) };
    const out: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    lines.forEach((l, i) => {
      if (l.t !== "vendor" && l.t !== "extraPO") return;
      const v = l.v;
      const qty = l.t === "vendor" ? allocations.get(v.vendorId) ?? 0 : l.po.qty;
      const arrival =
        l.t === "vendor"
          ? arrivalByVendor.get(v.vendorId) ?? v.leadTimeDays
          : Math.max(v.leadTimeDays, Math.min(horizonDays, l.po.arrivalDay));
      const late = needByDay != null && arrival > needByDay;
      if (qty > 0 && !late) out.push({ x1: clampX(x(arrival)), y1: yCenterOf(i), x2: target.x, y2: target.y });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, cover.firstShortBase, allocations, arrivalByVendor, needByDay, horizonDays, pxPerDay, canvasW]);

  /* ── Reusable PO bar (primary allocation + extra POs share this) ── */
  const renderPOBar = (
    rowKey: string,
    barId: string,
    vendorName: string,
    qty: number,
    arrivalRaw: number,
    leadTimeDays: number,
  ) => {
    const arrival = Math.max(leadTimeDays, Math.min(horizonDays, arrivalRaw));
    const late = needByDay != null && arrival > needByDay;
    const placed = qty > 0;
    const left = x(0);
    const right = Math.max(left + 26, x(arrival));
    const coversGap = placed && !late && cover.firstShortBase != null && arrival <= cover.firstShortBase;
    return (
      <div key={rowKey} className="relative" style={{ height: ROW_H }}>
        <div
          onPointerDown={(e) => onDown(e, barId, arrival)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          title={`${vendorName} · ${qty} ${baseUom} · arrives ${fmtDay(arrival)}${late ? " (late)" : ""} — drag to move arrival`}
          className="absolute flex cursor-grab touch-none select-none items-center gap-1 rounded-full px-2 active:cursor-grabbing"
          style={{
            left,
            width: right - left,
            top: "50%",
            height: 18,
            transform: "translateY(-50%)",
            backgroundColor: !placed ? "#F1F5F9" : late ? "#FEE2E2" : "#DCFCE7",
            border: `1px ${placed ? "solid" : "dashed"} ${!placed ? "#CBD5E1" : late ? "#FCA5A5" : "#86EFAC"}`,
            opacity: placed ? 1 : 0.8,
          }}
        >
          <span
            className="absolute"
            style={{
              right: -1,
              top: "50%",
              transform: "translateY(-50%)",
              width: 0,
              height: 0,
              borderTop: "5px solid transparent",
              borderBottom: "5px solid transparent",
              borderLeft: `7px solid ${!placed ? "#CBD5E1" : late ? "#B91C1C" : "#15803D"}`,
            }}
          />
          <span className="truncate text-[11px] font-semibold" style={{ color: !placed ? "#64748B" : late ? "#B91C1C" : "#15803D" }}>
            {!placed ? "set qty →" : `${late ? "late" : "on time"} · ${qty} ${baseUom}`}
          </span>
          {coversGap && (
            <span className="ml-1 shrink-0 rounded-full bg-emerald-600 px-1.5 text-[9.5px] font-bold uppercase text-white">saves</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ── Toolbar ── */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Planning timeline</h3>
        </div>
        <div className="flex items-center gap-2">
          {hasOverrides && (
            <button
              onClick={onResetOverrides}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[12px] font-medium text-slate-500 hover:bg-slate-50"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
          <button
            onClick={() => {
              setPredictOpen((o) => !o);
              setAddVendorOpen(false);
            }}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
              predictOpen ? "border-transparent bg-[#0A77FF] text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Predict transaction
          </button>
          {/* zoom */}
          <div className="flex items-center rounded-md border border-slate-200 p-0.5">
            <button
              onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
              disabled={zoomIdx === 0}
              className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-50 disabled:opacity-30"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="w-7 text-center text-[12px] font-semibold tabular-nums text-slate-600">{zoom}×</span>
            <button
              onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
              disabled={zoomIdx === ZOOM_LEVELS.length - 1}
              className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-50 disabled:opacity-30"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* horizon */}
          <div className="flex items-center rounded-md border border-slate-200 p-0.5">
            {horizonOptions.map((h) => (
              <button
                key={h}
                onClick={() => onHorizonChange(h)}
                className={`rounded px-2 py-0.5 text-[12px] font-medium transition-colors ${
                  horizonDays === h ? "bg-[#0A77FF] text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {h}d
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Predict form (what-if) ── */}
      {predictOpen && (
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-violet-50/40 px-5 py-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Type</span>
            <div className="flex items-center rounded-md border border-slate-200 bg-white p-0.5">
              {(["demand", "supply"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setPKind(k)}
                  className={`rounded px-2.5 py-1 text-[12.5px] font-medium capitalize transition-colors ${
                    pKind === k ? "bg-[#0A77FF] text-white" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {k === "demand" ? "Demand (−)" : "Supply (+)"}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Qty ({baseUom})</span>
            <input
              type="number"
              min={1}
              value={pQty}
              onChange={(e) => setPQty(Math.max(1, Number(e.target.value) || 0))}
              className="h-8 w-24 rounded-md border border-slate-200 px-2 text-sm text-slate-800 focus:border-[#0A77FF] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">When (day +N)</span>
            <input
              type="number"
              min={0}
              max={horizonDays}
              value={pDay}
              onChange={(e) => setPDay(Math.max(0, Math.min(horizonDays, Number(e.target.value) || 0)))}
              className="h-8 w-24 rounded-md border border-slate-200 px-2 text-sm text-slate-800 focus:border-[#0A77FF] focus:outline-none"
            />
          </label>
          <button
            onClick={() => {
              onAddMock(pKind, pQty, Math.max(0, Math.min(horizonDays, pDay)));
              setPredictOpen(false);
            }}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-[#0A77FF] px-3 text-[13px] font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add prediction
          </button>
          <span className="hidden text-[12px] text-slate-400 xl:inline">
            Reshapes coverage only — never sent as a PO.
          </span>
        </div>
      )}

      {/* ── Two-pane body ── */}
      <div className="flex">
        {/* LEFT RAIL */}
        <div className="shrink-0 border-r border-slate-100" style={{ width: RAIL_W }}>
          <div style={{ height: AXIS_H }} className="border-b border-slate-100" />
          {lines.map((l, i) => {
            if (l.t === "group") {
              return (
                <button
                  key={`g-${l.key}`}
                  onClick={() => toggleGroup(l.key)}
                  className="flex w-full items-center gap-1.5 bg-slate-50/70 px-3 text-left"
                  style={{ height: GROUP_H }}
                >
                  {open(l.key) ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span className="text-[12px] font-bold uppercase tracking-wide text-slate-600">{l.label}</span>
                  <span className="rounded bg-slate-200/70 px-1.5 text-[11px] font-semibold text-slate-500">{l.count}</span>
                </button>
              );
            }
            if (l.t === "empty") {
              return (
                <div key={`e-${i}`} className="flex items-center px-3 text-[12px] italic text-slate-400" style={{ height: ROW_H }}>
                  {l.label}
                </div>
              );
            }
            if (l.t === "demand" || l.t === "supply") {
              const ev = l.ev;
              const isDemand = l.t === "demand";
              const isSignal = !!ev.signal;
              const tone = isSignal ? C_MIN : isDemand ? C_ZERO : "#1D4ED8";
              const sign = isSignal ? "" : isDemand ? "−" : "+";
              return (
                <div key={ev.id} className="flex items-center gap-2 px-3" style={{ height: ROW_H, opacity: ev.excluded ? 0.5 : 1 }}>
                  {isSignal ? (
                    <span
                      className="grid h-4 w-4 shrink-0 place-items-center"
                      title="Reorder-point alert — a signal, not consuming demand"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" style={{ color: tone }} />
                    </span>
                  ) : (
                    <button
                      onClick={() => onToggleEvent(ev.id)}
                      className="grid h-4 w-4 shrink-0 place-items-center rounded-full border"
                      style={{ borderColor: tone }}
                      aria-label={ev.excluded ? `Include ${ev.label}` : `Exclude ${ev.label}`}
                    >
                      {!ev.excluded && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone }} />}
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-[13px] font-semibold text-slate-800" style={{ textDecoration: ev.excluded ? "line-through" : "none" }}>
                        {ev.label}
                      </span>
                      {ev.tag && (
                        <span
                          className={`shrink-0 rounded px-1 text-[9.5px] font-bold uppercase ${
                            ev.tag === "LOW"
                              ? "bg-amber-100 text-amber-700"
                              : ev.tag === "REQ"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {ev.tag}
                        </span>
                      )}
                      {ev.mock && (
                        <span className="shrink-0 rounded bg-violet-100 px-1 text-[9.5px] font-bold uppercase text-[#0A77FF]">pred</span>
                      )}
                      {ev.draft && !ev.mock && (
                        <span className="shrink-0 rounded bg-slate-100 px-1 text-[9.5px] font-bold uppercase text-slate-400">draft</span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">
                      {sign}
                      {ev.qty} {baseUom}
                      {ev.sublabel ? ` · ${ev.sublabel}` : ""} · {fmtDay(ev.day)}
                    </div>
                  </div>
                  {ev.mock && (
                    <button
                      onClick={() => onRemoveMock(ev.id)}
                      className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                      aria-label={`Remove ${ev.label}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            }
            if (l.t === "vendor") {
              const v = l.v;
              const c = vendorConstraints(item, v);
              const qty = allocations.get(v.vendorId) ?? 0;
              const eff = effectivePrice(v.unitPrice, v.pricingRules, qty);
              return (
                <div key={v.vendorId} className="flex items-center gap-1 px-3" style={{ height: ROW_H }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-[13px] font-medium text-slate-800">{v.vendorName}</span>
                      {v.primaryFlag && (
                        <span className="rounded bg-slate-100 px-1 text-[9.5px] font-bold uppercase text-slate-400">1°</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> {v.leadTimeDays}d
                      </span>
                      <span className="text-slate-500">${eff.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => stepDown(v)}
                      disabled={qty === 0}
                      className="grid h-5 w-5 place-items-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                      aria-label={`Decrease ${v.vendorName}`}
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="min-w-[2rem] text-center text-[12px] font-semibold tabular-nums text-slate-800">{qty}</span>
                    <button
                      onClick={() => stepUp(v)}
                      disabled={qty >= c.maxOrderQty}
                      className="grid h-5 w-5 place-items-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                      aria-label={`Increase ${v.vendorName}`}
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => onAddExtraPO(v.vendorId)}
                    title="Add another PO from this vendor (split the order across dates)"
                    className="grid h-5 w-5 shrink-0 place-items-center rounded border border-dashed border-slate-300 text-[#0A77FF] hover:bg-violet-50"
                    aria-label={`Add another PO from ${v.vendorName}`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onToggleVendor(v.vendorId)}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                    aria-label={`Remove ${v.vendorName}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }
            if (l.t === "extraPO") {
              const v = l.v;
              const c = vendorConstraints(item, v);
              const po = l.po;
              return (
                <div key={`x-${po.id}`} className="flex items-center gap-1 py-0 pl-6 pr-3" style={{ height: ROW_H }}>
                  <CornerDownRight className="h-3 w-3 shrink-0 text-slate-300" />
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-[12.5px] font-medium text-slate-600">Additional PO</span>
                    <div className="text-[11px] text-slate-400">{v.vendorName}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => extraDown(v, po)}
                      className="grid h-5 w-5 place-items-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50"
                      aria-label="Decrease additional PO"
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="min-w-[2rem] text-center text-[12px] font-semibold tabular-nums text-slate-800">{po.qty}</span>
                    <button
                      onClick={() => extraUp(v, po)}
                      disabled={po.qty >= c.maxOrderQty}
                      className="grid h-5 w-5 place-items-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Increase additional PO"
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => onRemoveExtraPO(po.id)}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Remove additional PO"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }
            // addVendor row
            return (
              <div key="addvendor" className="relative flex items-center px-3" style={{ height: ROW_H }}>
                <button
                  onClick={() => {
                    setAddVendorOpen((o) => !o);
                    setPredictOpen(false);
                  }}
                  disabled={unselectedVendors.length === 0}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-[12px] font-medium text-slate-500 hover:border-[#0A77FF] hover:text-[#0A77FF] disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" /> Add vendor
                </button>
                {addVendorOpen && unselectedVendors.length > 0 && (
                  <div className="absolute left-3 top-[calc(100%-4px)] z-20 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                    {unselectedVendors.map((v) => (
                      <button
                        key={v.vendorId}
                        onClick={() => {
                          onToggleVendor(v.vendorId);
                          setAddVendorOpen(false);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                      >
                        <span className="truncate">{v.vendorName}</span>
                        <span className="shrink-0 text-[11px] text-slate-400">{v.leadTimeDays}d · ${v.unitPrice}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {/* Coverage label aligned to the ribbon */}
          <div className="flex flex-col justify-center border-t border-slate-100 px-3" style={{ height: RIBBON_H }}>
            <span className="text-[12px] font-bold uppercase tracking-wide text-slate-600">Coverage</span>
            <span className="text-[11px] text-slate-400">ATP vs min floor</span>
            {cover.solved ? (
              <span className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> Plan closes the gap
              </span>
            ) : cover.enhShort > 0 ? (
              <span className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-amber-600">
                <AlertTriangle className="h-3 w-3" /> Short {Math.round(cover.enhShort)} {baseUom}
              </span>
            ) : (
              <span className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> Above floor
              </span>
            )}
          </div>
        </div>

        {/* RIGHT CANVAS — horizontally scrollable when zoomed in */}
        <div ref={paneRef} className="relative min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width: canvasW, height: totalH }}>
            {/* Background SVG: grid + weekend + connectors + markers + ribbon */}
            <svg width={canvasW} height={totalH} className="absolute inset-0 block">
              {/* weekend shading */}
              {days
                .filter((dd) => dd.wd === 0 || dd.wd === 6)
                .map((dd) => (
                  <rect key={`we-${dd.d}`} x={x(dd.d) - pxPerDay / 2} y={AXIS_H} width={pxPerDay} height={rowsH} fill="#f8fafc" />
                ))}
              {/* week gridlines */}
              {days
                .filter((dd) => dd.d % 7 === 0)
                .map((dd) => (
                  <line key={`gl-${dd.d}`} x1={x(dd.d)} y1={AXIS_H} x2={x(dd.d)} y2={AXIS_H + rowsH} stroke="#eef2f7" strokeWidth={1} />
                ))}
              {/* month labels (top row of the axis strip) */}
              {days
                .filter((dd) => dd.monthStart)
                .map((dd) => (
                  <text key={`mo-${dd.d}`} x={x(dd.d) + 2} y={11} fontSize={10} fontWeight={700} fill="#64748b" textAnchor="start">
                    {dd.month}
                  </text>
                ))}
              {/* day numbers (dense) or week labels (fit) */}
              {dense
                ? days.map((dd) => (
                    <text
                      key={`dn-${dd.d}`}
                      x={x(dd.d)}
                      y={24}
                      fontSize={9.5}
                      fill={dd.wd === 0 || dd.wd === 6 ? "#cbd5e1" : "#94a3b8"}
                      textAnchor="middle"
                    >
                      {dd.dom}
                    </text>
                  ))
                : weekTicks.map((t) => (
                    <text key={`wk-${t.day}`} x={x(t.day)} y={23} fontSize={11} fill="#94a3b8" textAnchor="middle">
                      {t.label}
                    </text>
                  ))}

              {/* group band separators */}
              {lines.map((l, i) =>
                l.t === "group" && i !== 0 ? (
                  <line key={`sep-${i}`} x1={0} y1={lineTops[i]} x2={canvasW} y2={lineTops[i]} stroke="#f1f5f9" strokeWidth={1} />
                ) : null,
              )}

              {/* dependency connectors: PO → demand it covers */}
              {connectors.map((c, idx) => (
                <g key={`cn-${idx}`}>
                  <path
                    d={`M ${c.x1.toFixed(1)} ${c.y1.toFixed(1)} C ${c.x1.toFixed(1)} ${((c.y1 + c.y2) / 2).toFixed(1)}, ${c.x2.toFixed(1)} ${((c.y1 + c.y2) / 2).toFixed(1)}, ${c.x2.toFixed(1)} ${c.y2.toFixed(1)}`}
                    fill="none"
                    stroke={EMERALD}
                    strokeWidth={1.5}
                    strokeOpacity={0.45}
                    strokeDasharray="3 2"
                  />
                  <circle cx={c.x2} cy={c.y2} r={2.5} fill={EMERALD} opacity={0.65} />
                </g>
              ))}

              {/* TODAY line */}
              <line x1={x(0)} y1={AXIS_H} x2={x(0)} y2={ribbonBottom} stroke="#0f172a" strokeWidth={1.5} strokeOpacity={0.55} />
              <text x={x(0) + 3} y={AXIS_H - 18} fontSize={10} fontWeight={700} fill="#0f172a" opacity={0.6}>
                TODAY
              </text>

              {/* need-by line */}
              {needByDay != null && needByDay >= 0 && needByDay <= horizonDays && (
                <g>
                  <line x1={x(needByDay)} y1={AXIS_H} x2={x(needByDay)} y2={ribbonBottom} stroke={C_ZERO} strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.85} />
                  <text x={x(needByDay) + 3} y={AXIS_H + 9} fontSize={10} fontWeight={700} fill={C_ZERO}>
                    need-by
                  </text>
                </g>
              )}

              {/* ── Coverage ribbon ── */}
              {curve.slice(0, horizonDays).map((p) => (
                <rect
                  key={`hm-${p.day}`}
                  x={x(p.day)}
                  y={ribbonTop}
                  width={pxPerDay + 0.5}
                  height={ribbonBottom - ribbonTop}
                  fill={sevColor(p.atp, item.minLevel)}
                  opacity={0.16}
                />
              ))}
              <line x1={PAD_L} y1={yR(item.minLevel)} x2={canvasW - PAD_R} y2={yR(item.minLevel)} stroke={C_MIN} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.7} />
              <text x={canvasW - PAD_R} y={yR(item.minLevel) - 3} fontSize={10} fontWeight={600} fill={C_MIN} textAnchor="end">
                min {item.minLevel}
              </text>
              {rMin < 0 && (
                <line x1={PAD_L} y1={yR(0)} x2={canvasW - PAD_R} y2={yR(0)} stroke={C_ZERO} strokeWidth={1} strokeDasharray="2 3" strokeOpacity={0.5} />
              )}
              {baselineCurve.length > 1 && (
                <path d={linePath(baselineCurve)} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.8} />
              )}
              {curve.length > 1 && <path d={linePath(curve)} fill="none" stroke={VIOLET} strokeWidth={2.5} />}
              {cover.firstShortEnh != null && (
                <g>
                  <line x1={x(cover.firstShortEnh)} y1={ribbonTop} x2={x(cover.firstShortEnh)} y2={ribbonBottom} stroke={C_ZERO} strokeWidth={1} strokeOpacity={0.7} />
                  <circle cx={x(cover.firstShortEnh)} cy={yR(curve[cover.firstShortEnh]?.atp ?? 0)} r={3} fill={C_ZERO} />
                </g>
              )}
              <text x={PAD_L} y={ribbonBottom + 12} fontSize={10.5} fill="#64748b">
                {cover.solved
                  ? `Plan lifts ATP above the floor`
                  : cover.firstShortEnh != null
                    ? `First shortfall ${fmtDay(cover.firstShortEnh)} · short ${Math.round(cover.enhShort)} ${baseUom}`
                    : `ATP stays above the ${item.minLevel} ${baseUom} floor`}
              </text>
            </svg>

            {/* Foreground: interactive markers per row (HTML over the SVG) */}
            <div className="absolute left-0 top-0" style={{ width: canvasW, paddingTop: AXIS_H }}>
              {lines.map((l, i) => {
                if (l.t === "group") return <div key={`gr-${l.key}`} style={{ height: GROUP_H }} />;
                if (l.t === "empty") return <div key={`er-${i}`} style={{ height: ROW_H }} />;
                if (l.t === "addVendor") return <div key="avr" style={{ height: ROW_H }} />;

                if (l.t === "demand" || l.t === "supply") {
                  const ev = l.ev;
                  const isDemand = l.t === "demand";
                  const isSignal = !!ev.signal;
                  const fill = isSignal ? C_MIN : ev.mock ? "#a78bfa" : isDemand ? C_ZERO : "#1D4ED8";
                  const sign = isSignal ? "" : isDemand ? "−" : "+";
                  const cx = clampX(x(ev.day));
                  /* LowStock signal — context only (the projection ignores it),
                     so it's a static hollow amber marker, not draggable. */
                  if (isSignal) {
                    return (
                      <div key={ev.id} className="relative" style={{ height: ROW_H }}>
                        <div
                          title={`${ev.label} · reorder-point alert · ${fmtDay(ev.day)}`}
                          className="absolute flex select-none items-center gap-1"
                          style={{ left: cx, top: "50%", transform: "translate(-50%,-50%)", opacity: ev.excluded ? 0.4 : 1 }}
                        >
                          <span
                            style={{
                              width: DIAMOND,
                              height: DIAMOND,
                              backgroundColor: "#fff",
                              border: `2px dashed ${fill}`,
                              transform: "rotate(45deg)",
                              borderRadius: 2,
                            }}
                          />
                          <span className="whitespace-nowrap rounded bg-white/85 px-1 text-[11px] font-semibold tabular-nums" style={{ color: fill }}>
                            {ev.qty}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={ev.id} className="relative" style={{ height: ROW_H }}>
                      <div
                        onPointerDown={(e) => onDown(e, ev.id, ev.day)}
                        onPointerMove={onMove}
                        onPointerUp={onUp}
                        title={`${ev.label} · ${sign}${ev.qty} ${baseUom} · ${fmtDay(ev.day)} — drag to reschedule`}
                        className="absolute flex cursor-grab touch-none select-none items-center gap-1 active:cursor-grabbing"
                        style={{ left: cx, top: "50%", transform: "translate(-50%,-50%)", opacity: ev.excluded ? 0.4 : 1 }}
                      >
                        <span
                          style={{
                            width: DIAMOND,
                            height: DIAMOND,
                            backgroundColor: isDemand ? fill : "#fff",
                            border: `2px solid ${fill}`,
                            borderStyle: ev.draft || ev.mock ? "dashed" : "solid",
                            transform: "rotate(45deg)",
                            borderRadius: 2,
                          }}
                        />
                        <span className="whitespace-nowrap rounded bg-white/85 px-1 text-[11px] font-semibold tabular-nums" style={{ color: fill }}>
                          {sign}
                          {ev.qty}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (l.t === "vendor") {
                  return renderPOBar(
                    `v-${l.v.vendorId}`,
                    `proposed-${l.v.vendorId}`,
                    l.v.vendorName,
                    allocations.get(l.v.vendorId) ?? 0,
                    arrivalByVendor.get(l.v.vendorId) ?? l.v.leadTimeDays,
                    l.v.leadTimeDays,
                  );
                }
                // extraPO
                return renderPOBar(
                  `x-${l.po.id}`,
                  `extrapo-${l.po.id}`,
                  l.v.vendorName,
                  l.po.qty,
                  l.po.arrivalDay,
                  l.v.leadTimeDays,
                );
              })}
              <div style={{ height: RIBBON_H }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-5 py-2 text-[11.5px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[2px]" style={{ backgroundColor: C_ZERO }} /> Demand
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] border-2" style={{ borderColor: "#1D4ED8", background: "#fff" }} /> Inbound
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] border-2 border-dashed" style={{ borderColor: C_MIN, background: "#fff" }} /> Low stock
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-full" style={{ background: "#DCFCE7", border: "1px solid #86EFAC" }} /> On-time PO
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-full" style={{ background: "#FEE2E2", border: "1px solid #FCA5A5" }} /> Late PO
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] border-2 border-dashed" style={{ borderColor: "#a78bfa", background: "#fff" }} /> Predicted
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: EMERALD }} /> Covers gap
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed border-slate-400" /> Today’s reality
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0 w-4 border-t-2" style={{ borderColor: VIOLET }} /> With your plan
        </span>
        <span className="ml-auto inline-flex items-center gap-1">
          <Truck className="h-3 w-3" /> {item.itemCode}
        </span>
      </footer>
    </section>
  );
}
