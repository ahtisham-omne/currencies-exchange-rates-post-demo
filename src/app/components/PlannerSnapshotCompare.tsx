/* ═══════════════════════════════════════════════════════════════
   PLANNER SNAPSHOT COMPARE
   ───────────────────────────────────────────────────────────────
   Modal that puts 2+ snapshots side-by-side. Restyled 2026-07-14
   to match the app's shared modal pattern (auto-breakdown / cart /
   add-vendor): p-0 gap-0 container, icon-chip header, scrollable
   body with cards, sticky footer with primary/secondary actions.

   Layout:
     · Header: GitCompare icon chip + "Compare N plans" + subtitle
     · Winners strip: two callout cards ("Cheapest" and "Most on-time")
       spotlighting the standout plan without hunting through the table
     · Plan cards row: one card per snapshot with its metrics stacked
       (POs / vendors / units / cost / late) — cost + on-time cells
       highlighted on the winning plan
     · Footer: "Load into workspace" buttons, one per plan
   ═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  GitCompare,
  TrendingDown,
  Timer,
  Package,
  ExternalLink,
  Sparkles,
  Maximize2,
  X,
} from "lucide-react";
import type { PlannerSnapshot } from "./plannerSnapshotStore";

function fmtMoney(n: number): string {
  if (n === 0) return "$0";
  if (Math.abs(n) < 1000) return `$${n.toFixed(0)}`;
  if (Math.abs(n) < 1_000_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${(n / 1_000_000).toFixed(2)}M`;
}

function fmtWhen(ms: number): string {
  const d = new Date(ms);
  const day = d.getDate();
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ampm = hh >= 12 ? "PM" : "AM";
  const hh12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${mon} ${day}, ${hh12}:${mm} ${ampm}`;
}

function ruleLabel(snap: PlannerSnapshot): string {
  const c = snap.intent.recommendationConfig;
  if (c.trigger === "off") return "Off";
  if (c.source === "item-master") {
    if (c.trigger === "min") return "Min threshold";
    if (c.trigger === "zero") return "Below zero";
  }
  if (c.trigger === "min") return `Custom · Below min → ${c.fillTo}`;
  if (c.trigger === "zero") return `Custom · Below zero → ${c.fillTo}`;
  return "Custom";
}

/** Sparkline preview of a snapshot's projected on-hand curve.
 *  Buyer feedback 2026-07-20: "show the plan image as well for each
 *  plan and the ability to preview." Small mode = a thumbnail
 *  clickable to expand; large mode = full-size chart with axes. */
function PlanCurvePreview({
  curve,
  size,
  onExpand,
  minLevel,
  maxLevel,
}: {
  curve: number[] | undefined;
  size: "small" | "large";
  onExpand?: () => void;
  minLevel?: number;
  maxLevel?: number;
}) {
  if (!curve || curve.length < 2) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-500 ${
          size === "small" ? "h-10 text-[10px]" : "h-56 text-[12.5px]"
        }`}
      >
        <div className={size === "small" ? "text-[10px]" : "text-[13px] font-medium"}>
          No preview available
        </div>
        {size === "large" && (
          <div className="max-w-[420px] px-4 text-center text-[11px] text-slate-400">
            This snapshot was saved before plan images were captured. Take a new snapshot to see its projected-on-hand curve.
          </div>
        )}
      </div>
    );
  }
  const isLarge = size === "large";
  const width = isLarge ? 720 : 200;
  const height = isLarge ? 320 : 40;
  /* Left / right / top / bottom padding — in large mode we reserve
     space for the y-axis numbers on the left and the band labels on
     the right, plus x-axis day labels at the bottom (same anatomy
     as the workspace planner graph). */
  const padL = isLarge ? 42 : 2;
  const padR = isLarge ? 62 : 2;
  const padT = isLarge ? 12 : 2;
  const padB = isLarge ? 22 : 2;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  /* Y-domain — include the item's guardrails so the zones render
     even when the curve stays entirely inside one band. Match the
     workspace graph's yDomain math. */
  const atpLo = Math.min(0, ...curve, minLevel ?? Infinity);
  const atpHi = Math.max(...curve, maxLevel ?? -Infinity);
  const domainPad = Math.max(5, Math.ceil((atpHi - atpLo) * 0.12));
  const lo = atpLo - domainPad;
  const hi = atpHi + domainPad;
  const range = hi - lo || 1;
  const stepX = plotW / (curve.length - 1);
  const yFor = (v: number) => padT + ((hi - v) / range) * plotH;
  const points = curve
    .map((v, i) => `${padL + i * stepX},${yFor(v)}`)
    .join(" ");
  const areaPoints = `${padL},${padT + plotH} ${points} ${
    padL + (curve.length - 1) * stepX
  },${padT + plotH}`;
  const min = minLevel != null ? yFor(minLevel) : null;
  const max = maxLevel != null ? yFor(maxLevel) : null;
  const zero = yFor(0);
  const endValue = curve[curve.length - 1];
  /* X-axis day markers — every ~5 days in large mode, day-0 keyed
     to today (dates are synthetic since the snapshot doesn't store
     the anchor; matches the buyer's mental model of "the plan
     starts today"). */
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fmtDay = (i: number) => {
    const d = new Date(today.getTime() + i * 86400000);
    if (i === 0 || d.getDate() === 1) return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
    return `${d.getDate()}`;
  };
  const dayTickCount = Math.min(7, curve.length);
  const dayTicks: number[] = [];
  for (let k = 0; k < dayTickCount; k++) {
    const idx = Math.round((k / (dayTickCount - 1)) * (curve.length - 1));
    if (!dayTicks.includes(idx)) dayTicks.push(idx);
  }

  return (
    <div
      className={`relative rounded-md border border-slate-200 bg-white overflow-hidden ${
        onExpand ? "cursor-pointer hover:border-slate-300 transition-colors" : ""
      }`}
      onClick={onExpand}
      role={onExpand ? "button" : undefined}
      tabIndex={onExpand ? 0 : undefined}
      onKeyDown={(e) => {
        if (onExpand && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onExpand();
        }
      }}
      title={onExpand ? "Preview plan" : undefined}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Guardrail zones — match the workspace planner graph
            EXACTLY (see PlannerGapGraph.tsx lines 2454–2485):
              · Above max (y > maxLevel) — teal #14B8A6 · opacity 0.14
              · Below max (max → min)   — emerald #10B981 · opacity 0.05
              · Below min (min → 0)     — amber #D97706 · opacity 0.08
              · Below zero (< 0)        — red #DC2626 · opacity 0.10 */}
        {max != null && (
          <rect x={padL} y={padT} width={plotW} height={Math.max(0, max - padT)} fill="#14B8A6" fillOpacity={0.14} />
        )}
        {max != null && min != null && (
          <rect x={padL} y={max} width={plotW} height={Math.max(0, min - max)} fill="#10B981" fillOpacity={0.05} />
        )}
        {min != null && (
          <rect x={padL} y={min} width={plotW} height={Math.max(0, zero - min)} fill="#D97706" fillOpacity={0.08} />
        )}
        <rect x={padL} y={zero} width={plotW} height={Math.max(0, padT + plotH - zero)} fill="#DC2626" fillOpacity={0.10} />

        {/* Threshold guide lines */}
        {max != null && (
          <line x1={padL} x2={padL + plotW} y1={max} y2={max} stroke="#94A3B8" strokeDasharray="3 3" strokeWidth={1} />
        )}
        {min != null && (
          <line x1={padL} x2={padL + plotW} y1={min} y2={min} stroke="#D97706" strokeDasharray="3 3" strokeWidth={1} />
        )}
        <line x1={padL} x2={padL + plotW} y1={zero} y2={zero} stroke="#DC2626" strokeDasharray="3 3" strokeWidth={1} />

        {/* Right-side band labels (large mode only) — mirror the workspace graph. */}
        {isLarge && max != null && (
          <text x={padL + plotW - 6} y={padT + 12} fontSize={10} fontWeight={600} fill="#115E59" textAnchor="end">
            Above max
          </text>
        )}
        {isLarge && max != null && min != null && (
          <text x={padL + plotW - 6} y={max + 12} fontSize={10} fontWeight={600} fill="#047857" textAnchor="end">
            Below max
          </text>
        )}
        {isLarge && min != null && (
          <text x={padL + plotW - 6} y={min + 12} fontSize={10} fontWeight={600} fill="#B45309" textAnchor="end">
            Below min
          </text>
        )}
        {isLarge && (
          <text x={padL + plotW - 6} y={zero + 12} fontSize={10} fontWeight={700} fill="#B91C1C" textAnchor="end">
            Below zero
          </text>
        )}

        {/* Y-axis numbers on the left (large mode only). */}
        {isLarge && (
          <>
            <text x={padL - 6} y={padT + 4} fontSize={10} fill="#94A3B8" textAnchor="end">
              {Math.round(hi)}
            </text>
            {max != null && (
              <text x={padL - 6} y={max + 3} fontSize={10} fill="#94A3B8" textAnchor="end">
                {maxLevel}
              </text>
            )}
            {min != null && (
              <text x={padL - 6} y={min + 3} fontSize={10} fill="#94A3B8" textAnchor="end">
                {minLevel}
              </text>
            )}
            <text x={padL - 6} y={zero + 3} fontSize={10} fill="#94A3B8" textAnchor="end">
              0
            </text>
            <text x={padL - 6} y={padT + plotH + 3} fontSize={10} fill="#94A3B8" textAnchor="end">
              {Math.round(lo)}
            </text>
          </>
        )}

        {/* X-axis day labels along the bottom (large mode only). */}
        {isLarge && dayTicks.map((i) => (
          <text
            key={`x-${i}`}
            x={padL + i * stepX}
            y={padT + plotH + 14}
            fontSize={10}
            fill="#94A3B8"
            textAnchor={i === 0 ? "start" : i === curve.length - 1 ? "end" : "middle"}
          >
            {fmtDay(i)}
          </text>
        ))}

        {/* Curve area + line — thicker in large mode to match the
            workspace's projected-stock line weight. */}
        <polygon points={areaPoints} fill="rgba(71, 85, 105, 0.08)" />
        <polyline
          points={points}
          fill="none"
          stroke="#475569"
          strokeWidth={isLarge ? 2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End-value badge on the right — mirrors the workspace's
            "final value" chip at the tail of the projected curve. */}
        {isLarge && (
          <g transform={`translate(${padL + plotW - 4}, ${yFor(endValue)})`}>
            <rect x={-1} y={-9} width={30} height={18} rx={9} fill="#334155" />
            <text x={14} y={4} fontSize={10} fontWeight={700} fill="#FFFFFF" textAnchor="middle">
              {Math.round(endValue)}
            </text>
          </g>
        )}
      </svg>
      {!isLarge && onExpand && (
        <div className="absolute right-1 top-1 rounded bg-white/85 p-0.5 shadow-sm">
          <Maximize2 className="size-2.5 text-slate-500" />
        </div>
      )}
    </div>
  );
}

export function PlannerSnapshotCompare({
  open,
  onOpenChange,
  snapshots,
  onOpenSnapshot,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  snapshots: PlannerSnapshot[];
  onOpenSnapshot?: (snap: PlannerSnapshot) => void;
}) {
  /* Which plan the buyer clicked "preview" on — opens a nested
     lightbox showing the full-size projected-on-hand chart. */
  const [previewSnap, setPreviewSnap] = useState<PlannerSnapshot | null>(null);
  if (snapshots.length < 2) return null;

  const minCost = Math.min(...snapshots.map((s) => s.metrics.totalCost));
  const minLate = Math.min(...snapshots.map((s) => s.metrics.lateCount));
  const cheapest = snapshots.find((s) => s.metrics.totalCost === minCost)!;
  const mostOnTime = snapshots.find((s) => s.metrics.lateCount === minLate)!;
  const sameWinner = cheapest.id === mostOnTime.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(920px,95vw)] p-0 gap-0 overflow-hidden bg-white">
        {/* Header — icon chip + title only. No subtitle; the row
            labels below carry all the context the buyer needs. */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200/70">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center shrink-0 rounded-lg"
              style={{ width: 36, height: 36, backgroundColor: "#EFF6FF", color: "#0A77FF" }}
            >
              <GitCompare className="h-[16px] w-[16px]" />
            </div>
            <DialogTitle className="text-[15px] font-semibold text-slate-900">
              Compare {snapshots.length} plans
            </DialogTitle>
            <DialogDescription className="sr-only">
              Compare {snapshots.length} snapshot plans.
            </DialogDescription>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="max-h-[600px] overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {/* Winners strip */}
          <div className={`grid gap-2 ${sameWinner ? "grid-cols-1" : "grid-cols-2"}`}>
            {sameWinner ? (
              <WinnerCard
                icon={<Sparkles className="h-3.5 w-3.5" />}
                label="Lowest cost & fewest late"
                planName={cheapest.name}
                stat={`${fmtMoney(cheapest.metrics.totalCost)} · ${cheapest.metrics.lateCount} late`}
              />
            ) : (
              <>
                <WinnerCard
                  icon={<TrendingDown className="h-3.5 w-3.5" />}
                  label="Lowest cost"
                  planName={cheapest.name}
                  stat={fmtMoney(cheapest.metrics.totalCost)}
                />
                <WinnerCard
                  icon={<Timer className="h-3.5 w-3.5" />}
                  label="Fewest late"
                  planName={mostOnTime.name}
                  stat={`${mostOnTime.metrics.lateCount} late`}
                />
              </>
            )}
          </div>

          {/* Plan cards — one column per snapshot */}
          <div className="rounded-lg border border-slate-200/70 bg-white">
            <div className="grid" style={{ gridTemplateColumns: `140px repeat(${snapshots.length}, minmax(0, 1fr))` }}>
              {/* Header row — plan names + timestamps */}
              <div className="border-b border-slate-100 bg-slate-50/60 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500" style={{ letterSpacing: "0.06em" }}>
                Plan
              </div>
              {snapshots.map((s) => (
                <div key={s.id} className="border-b border-slate-100 bg-slate-50/60 px-3 py-2">
                  <div className="truncate text-[12.5px] font-semibold text-slate-900" title={s.name}>
                    {s.name}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-slate-500">
                    {fmtWhen(s.createdAt)}
                  </div>
                </div>
              ))}

              <MetricRow label="Rule active" values={snapshots.map((s) => ruleLabel(s))} />
              <MetricRow label="Purchase orders" values={snapshots.map((s) => `${s.metrics.poCount}`)} />
              <MetricRow label="Vendors" values={snapshots.map((s) => `${s.metrics.vendorCount}`)} />
              <MetricRow label="Total units" values={snapshots.map((s) => `${s.metrics.totalUnits}`)} />
              <MetricRow
                label="Total cost"
                icon={<TrendingDown className="h-3 w-3 text-emerald-600" />}
                values={snapshots.map((s) => ({
                  text: fmtMoney(s.metrics.totalCost),
                  best: s.metrics.totalCost === minCost,
                }))}
              />
              <MetricRow
                label="Late arrivals"
                icon={<Timer className="h-3 w-3 text-emerald-600" />}
                values={snapshots.map((s) => ({
                  text: `${s.metrics.lateCount}`,
                  best: s.metrics.lateCount === minLate,
                }))}
              />
              {/* Per-column footer row — Load + Preview side-by-side
                  at the bottom of each plan column. Label cell stays
                  blank so the buttons align with their column above. */}
              <div className="border-t border-slate-100 px-3 py-2.5" />
              {snapshots.map((s) => {
                const isCheapest = s.id === cheapest.id;
                return (
                  <div
                    key={`actions-${s.id}`}
                    className="border-t border-slate-100 px-3 py-2.5 flex items-center gap-1.5"
                  >
                    {onOpenSnapshot && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenSnapshot(s);
                          onOpenChange(false);
                        }}
                        className={`inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors flex-1 ${
                          isCheapest
                            ? "bg-[#0A77FF] text-white hover:bg-[#0866DE] shadow-sm"
                            : "border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                        }`}
                      >
                        Load
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewSnap(s)}
                      title="See the plan image"
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 flex-1"
                    >
                      <Maximize2 className="h-3 w-3" />
                      Preview
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* At-save context — small audit card. */}
          <div className="rounded-lg border border-slate-200/70 bg-slate-50/40 px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500" style={{ letterSpacing: "0.06em" }}>
              <Package className="h-3 w-3" />
              At save time
            </div>
            <div className="grid" style={{ gridTemplateColumns: `140px repeat(${snapshots.length}, minmax(0, 1fr))` }}>
              <SubMetricRow label="On-hand" values={snapshots.map((s) => `${s.world.onHand}`)} />
              <SubMetricRow label="Sales orders + PRs" values={snapshots.map((s) => `${s.world.demandEventIds.length}`)} />
              <SubMetricRow label="Incoming purchase orders" values={snapshots.map((s) => `${s.world.incomingIds.length}`)} />
            </div>
          </div>
        </div>

        {/* Bottom Load button row removed 2026-07-20 — Load + Preview
            now live at the bottom of each plan column above. */}
      </DialogContent>
      {/* Preview lightbox — opens on sparkline click. Shows the
          full-size projected-on-hand curve captured at snapshot
          time so the buyer can inspect the plan visually before
          loading it into the workspace. */}
      <Dialog open={previewSnap !== null} onOpenChange={(o) => { if (!o) setPreviewSnap(null); }}>
        <DialogContent className="sm:max-w-[720px] p-0 gap-0 overflow-hidden bg-white">
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-200/70">
            <div className="min-w-0">
              <DialogTitle className="text-[15px] font-semibold text-slate-900 truncate">
                {previewSnap?.name ?? "Plan preview"}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[11.5px] text-slate-500">
                Projected on-hand at save time
                {previewSnap ? ` · ${fmtWhen(previewSnap.createdAt)}` : ""}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => setPreviewSnap(null)}
              className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close preview"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="px-5 py-4">
            {previewSnap && (
              <PlanCurvePreview
                curve={previewSnap.curvePreview}
                size="large"
                minLevel={previewSnap.world.minLevel}
                maxLevel={previewSnap.world.maxLevel}
              />
            )}
            {previewSnap && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-600">
                <span>POs: <span className="font-semibold text-slate-900">{previewSnap.metrics.poCount}</span></span>
                <span>Vendors: <span className="font-semibold text-slate-900">{previewSnap.metrics.vendorCount}</span></span>
                <span>Units: <span className="font-semibold text-slate-900">{previewSnap.metrics.totalUnits}</span></span>
                <span>Cost: <span className="font-semibold text-slate-900">{fmtMoney(previewSnap.metrics.totalCost)}</span></span>
                <span>Late: <span className="font-semibold text-slate-900">{previewSnap.metrics.lateCount}</span></span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function WinnerCard({
  icon,
  label,
  planName,
  stat,
}: {
  icon: React.ReactNode;
  label: string;
  planName: string;
  stat: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500 text-white shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700" style={{ letterSpacing: "0.06em" }}>
          {label}
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="truncate text-[13px] font-semibold text-slate-900" title={planName}>
            {planName}
          </span>
          <span className="shrink-0 text-[11px] font-medium text-emerald-800 tabular-nums">
            {stat}
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  values,
  icon,
}: {
  label: string;
  values: Array<string | { text: string; best?: boolean }>;
  icon?: React.ReactNode;
}) {
  return (
    <>
      <div className="border-t border-slate-100 px-3 py-2 flex items-center gap-1 text-[11px] font-medium text-slate-600">
        {icon}
        {label}
      </div>
      {values.map((v, i) => {
        const text = typeof v === "string" ? v : v.text;
        const best = typeof v === "string" ? false : !!v.best;
        return (
          <div
            key={i}
            className={`border-t border-slate-100 px-3 py-2 text-[12.5px] tabular-nums ${
              best
                ? "font-semibold text-emerald-700"
                : "text-slate-800"
            }`}
          >
            {text}
          </div>
        );
      })}
    </>
  );
}

function SubMetricRow({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <>
      <div className="py-1 text-[11px] text-slate-500">{label}</div>
      {values.map((v, i) => (
        <div key={i} className="py-1 text-[11.5px] tabular-nums text-slate-700">
          {v}
        </div>
      ))}
    </>
  );
}
