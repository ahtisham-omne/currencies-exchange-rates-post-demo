/* ═══════════════════════════════════════════════════════════════
   PLANNER VENDOR PANEL  (Classic left column — "Plan a purchase order")

   The interactive vendor surface for the Classic view's left column.
   Lists the item's qualified vendors (and, on demand, the full
   marketplace) and lets the buyer allocate quantities — each allocation
   becomes an expected receiving on the gap graph (ordered today,
   arriving after the vendor's lead time), drawn with the SAME blue
   "Planned PO" legend the graph already uses.

     · A planning-period summary — for the graph's visible window, the
       demand to cover and how much to order, so the buyer isn't guessing
       the quantity (Nophil's planning-phase pain).
     · One card per vendor: a price-led spec block (effective price · lead
       time · order range MOQ→max) + the vendor's pricing-rule label, with
       an ALWAYS-VISIBLE MOQ-aware qty stepper and an on-time / arrives-late
       chip (arrival vs. the need-by). There is no separate select step —
       a vendor enters the plan when its quantity goes above zero.
     · A "Show all vendors" toggle for buying outside the qualified list.
     · A shortfall hint when the allocation can't cover the gap alone.

   Allocation state is owned by the workspace; this is a controlled
   component. Setting a quantity > 0 both allocates AND selects the vendor
   (the workspace keeps `selectedVendorIds` in sync off the allocation),
   so the PO-building pipeline is unchanged.
   ═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import {
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  CalendarRange,
  Sparkles,
} from "lucide-react";
import type { PlannerItem, PlannerVendor } from "./plannerData";
import { vendorConstraints } from "./plannerData";
import { effectivePrice } from "../utils/projection";
import { VendorLogo } from "./vendorLogo";
import PlannerPricingRuleBadge from "./PlannerPricingRuleBadge";
import PlannerQtyInput from "./PlannerQtyInput";

const VIOLET = "#0A77FF";

/** Planning-period summary the workspace computes for the graph's visible
    window. `orderNeeded` is the graph's own bring-to-min gap (so the panel and
    graph never disagree on the number); `demand` is the period's total demand. */
export interface PlanningSummary {
  /** "Next 30 days" / "Day +5 to +60" — the window the numbers describe. */
  periodLabel: string;
  /** Total outstanding demand falling inside the planning window. */
  demand: number;
  /** Units to order to bring the worst projected stock back up to the minimum. */
  orderNeeded: number;
}

interface PlannerVendorPanelProps {
  item: PlannerItem;
  /** Qualified vendor set for this item (the default list). */
  vendors: PlannerVendor[];
  /** Full marketplace (qualified + non-qualified pool) — revealed by the
      "Show all vendors" toggle so the buyer can order outside the qualified
      list. Falls back to `vendors` when absent. */
  allVendors?: PlannerVendor[];
  /** Day the item first goes short (the need-by marker), or null. */
  needByDay: number | null;
  /** Planning-period summary (period · demand · how much to order). */
  planning: PlanningSummary;
  baseUom: string;
  allocations: Map<string, number>;
  /** Planned arrival day per vendor (kept in sync with gap-graph drag).
      Falls back to the vendor's lead time when absent. */
  arrivalByVendor?: Map<string, number>;
  onSetAllocation: (id: string, qty: number) => void;
  /** Per-vendor Auto-fill roll-up — vendors present in this map get an
      emerald "Auto · N POs · Xqty" chip on their card so the buyer can spot
      which vendors the current Auto mode is using without opening the
      breakdown modal. Empty / missing entries render as before. */
  autoAllocations?: Map<string, { count: number; qty: number }>;
  /** Snapshot-view read-only lock (buyer feedback 2026-07-20). When true,
      the qty inputs, +/- steppers, "Show all vendors" toggle and any add
      affordances are hidden or disabled so the panel reads as static. */
  viewOnly?: boolean;
}

export default function PlannerVendorPanel({
  item,
  vendors,
  allVendors,
  needByDay,
  planning,
  baseUom,
  allocations,
  arrivalByVendor,
  onSetAllocation,
  autoAllocations,
  viewOnly = false,
}: PlannerVendorPanelProps) {
  /* "Show all vendors" — buying outside the qualified list (point 6). The list
     swaps to the full marketplace; allocation behaves identically for any
     vendor, so the only change is which cards render. */
  const [showAll, setShowAll] = useState(false);
  const canShowAll = !!allVendors && allVendors.length > vendors.length;
  const listVendors = showAll && allVendors ? allVendors : vendors;

  /* Total allocated across EVERY vendor (the map only holds qty>0 entries), and
     the gap math against the planning summary's order target. */
  const allocated = Array.from(allocations.values()).reduce((s, n) => s + n, 0);
  const orderNeeded = planning.orderNeeded;
  const shortfall = Math.max(0, orderNeeded - allocated);
  const covered = orderNeeded > 0 && shortfall === 0;

  /* Vendor hierarchy — the primary vendor sits on top; everyone else
     follows by lowest effective price (the price we'd actually pay after
     pricing rules), with the name as the final tie-break. The effective-
     price extremes still drive the green-cheapest / red-dearest colouring. */
  const effOf = (v: PlannerVendor) =>
    effectivePrice(v.unitPrice, v.pricingRules, allocations.get(v.vendorId) ?? 0);
  const orderedVendors = [...listVendors].sort((a, b) => {
    if (a.primaryFlag !== b.primaryFlag) return a.primaryFlag ? -1 : 1;
    return effOf(a) - effOf(b) || a.vendorName.localeCompare(b.vendorName);
  });
  const effValues = listVendors.map(effOf);
  const minEff = effValues.length ? Math.min(...effValues) : 0;
  const maxEff = effValues.length ? Math.max(...effValues) : 0;
  const hasPriceSpread = minEff !== maxEff;

  /* Always surface viable options: the two earliest-arriving vendors render
     "on time" even when the need-by has already passed (the item is already
     below min). Every other vendor is "late" only if it arrives after need-by. */
  const arrivalOf = (v: PlannerVendor) => arrivalByVendor?.get(v.vendorId) ?? v.leadTimeDays;
  const onTimeArrivalFloor = (() => {
    const sorted = listVendors.map(arrivalOf).sort((a, b) => a - b);
    return sorted.length > 1 ? sorted[1] : (sorted[0] ?? 0);
  })();

  /* MOQ / multiples-aware steppers. First step jumps to MOQ. */
  const stepUp = (v: PlannerVendor) => {
    const c = vendorConstraints(item, v);
    const cur = allocations.get(v.vendorId) ?? 0;
    const next = cur === 0 ? c.moq : cur + c.orderMultiples;
    /* Max is a SOFT ceiling — the buyer may step over it (only MOQ floors). */
    onSetAllocation(v.vendorId, next);
  };
  const stepDown = (v: PlannerVendor) => {
    const c = vendorConstraints(item, v);
    const cur = allocations.get(v.vendorId) ?? 0;
    const next = cur <= c.moq ? 0 : cur - c.orderMultiples;
    onSetAllocation(v.vendorId, Math.max(0, next));
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ── Planning-period summary ──
         States, for the graph's visible window: the period, its demand, and how
         much to order to get back to minimum — so the quantity isn't a guess. */}
      <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 2xl:px-3 2xl:py-2.5">
        {orderNeeded > 0 ? (
          <>
            <div className="flex items-center justify-between gap-2 text-[10.5px] 2xl:text-[11px]">
              <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                <CalendarRange className="h-3 w-3 text-slate-400 2xl:h-3.5 2xl:w-3.5" />
                Planning period · {planning.periodLabel}
              </span>
              <span className="text-slate-500">
                Demand{" "}
                <span className="font-semibold text-slate-700">
                  {planning.demand} {baseUom}
                </span>
              </span>
            </div>
            <div className="mt-1 text-[12px] text-slate-600 2xl:mt-1.5 2xl:text-[13px]">
              Order{" "}
              <span className="font-semibold text-slate-900">
                {orderNeeded} {baseUom}
              </span>{" "}
              to bring this item to its minimum level.
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] 2xl:mt-1.5 2xl:text-xs">
              <span className="text-slate-400">
                Allocated <span className="font-semibold text-slate-700">{allocated}</span> /{" "}
                {orderNeeded}
              </span>
              {covered ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700 2xl:px-2">
                  <CheckCircle2 className="h-3 w-3 2xl:h-3.5 2xl:w-3.5" /> Covered
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700 2xl:px-2">
                  <AlertTriangle className="h-3 w-3 2xl:h-3.5 2xl:w-3.5" /> Short {shortfall} {baseUom}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="text-[12px] text-slate-600 2xl:text-[13px]">
            No gap to cover — projected stock stays at or above the minimum across the
            planning period ({planning.periodLabel.toLowerCase()}).
          </div>
        )}
      </div>

      {/* ── Vendor cards (fill + scroll so the column tracks the right side) ── */}
      {listVendors.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
          No vendors for this item.
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto scrollbar-planner pr-0.5">
          {orderedVendors.map((v) => {
            const c = vendorConstraints(item, v);
            const qty = allocations.get(v.vendorId) ?? 0;
            /* No select step — a vendor is "in the plan" once its qty > 0; the
               card lights up blue to show it. */
            const on = qty > 0;
            const arrivalDay = arrivalOf(v);
            const late =
              needByDay != null && arrivalDay > needByDay && arrivalDay > onTimeArrivalFloor;
            const eff = effectivePrice(v.unitPrice, v.pricingRules, qty);
            /* Cheapest green, dearest red (only when prices actually differ). */
            const priceColor =
              hasPriceSpread && eff === minEff
                ? "#16A34A"
                : hasPriceSpread && eff === maxEff
                  ? "#DC2626"
                  : "#1E293B";
            const priceTitle =
              hasPriceSpread && eff === minEff
                ? "Cheapest"
                : hasPriceSpread && eff === maxEff
                  ? "Most expensive"
                  : undefined;
            const autoAlloc = autoAllocations?.get(v.vendorId);
            return (
              <div
                key={v.vendorId}
                className="rounded-lg border bg-white transition-colors"
                style={{
                  /* Auto-allocated vendors get an emerald outline (paired with
                     the Auto Active gradient) so the Qualified Vendors panel
                     visually mirrors the graph's Auto banner. A manual
                     allocation (`on`) still wins — its blue outline signals
                     "you've picked this vendor" over "Auto picked this". */
                  borderColor: on ? VIOLET : autoAlloc ? "#10B981" : "#E2E8F0",
                  boxShadow: on
                    ? `inset 0 0 0 1px ${VIOLET}`
                    : autoAlloc
                      ? "inset 0 0 0 1px #10B981"
                      : "none",
                }}
              >
                {/* Header — vendor identity + spec (static; selection is the
                    quantity below, so this is no longer a toggle). */}
                <div className="flex w-full items-start gap-2.5 px-2.5 py-2.5 text-left 2xl:gap-3 2xl:px-3 2xl:py-3">
                  <span className="shrink-0">
                    <VendorLogo name={v.vendorName} id={v.vendorId} size={32} />
                  </span>

                  <div className="min-w-0 flex-1">
                    {/* Name + primary + Auto badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="truncate text-[13px] font-semibold text-slate-800 2xl:text-sm">
                        {v.vendorName}
                      </span>
                      {v.primaryFlag && (
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                          Primary
                        </span>
                      )}
                      {autoAlloc && (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-700"
                          title={`Auto has allocated ${autoAlloc.count} ${autoAlloc.count === 1 ? "PO" : "POs"} · ${autoAlloc.qty} ${baseUom} on this vendor`}
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          Auto · {autoAlloc.count} {autoAlloc.count === 1 ? "PO" : "POs"} · {autoAlloc.qty} {baseUom}
                        </span>
                      )}
                    </div>

                    {/* Spec — lead time on its own line, then the effective
                        price kept whole ("$X / UOM" never breaks) on one line
                        with its discount/premium rule label(s) beside it. */}
                    <div
                      className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 2xl:mt-1.5 2xl:text-[12px]"
                      title={`Vendor lead time — ${v.leadTimeDays} days from order to delivery`}
                    >
                      <Clock className="h-2.5 w-2.5 shrink-0 text-slate-400 2xl:h-3 2xl:w-3" />
                      {v.leadTimeDays}-day lead
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] 2xl:text-[12px]">
                      <span
                        className="whitespace-nowrap font-semibold tabular-nums"
                        style={{ color: priceColor }}
                        title={priceTitle}
                      >
                        ${eff.toFixed(2)}
                        <span className="font-normal text-slate-400"> / {baseUom}</span>
                      </span>
                      {v.pricingRules.map((r, i) => (
                        <PlannerPricingRuleBadge key={i} rule={r} uom={baseUom} />
                      ))}
                    </div>

                    {/* Order constraints — MOQ→max + multiples. Tooltips on
                        both the MOQ range and the order-multiple chip so a
                        first-time buyer can read the notation without
                        guessing. */}
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 2xl:mt-1.5 2xl:text-[11px]">
                      <Package className="h-2.5 w-2.5 shrink-0 text-slate-400 2xl:h-3 2xl:w-3" />
                      <span title={`Minimum order quantity ${c.moq}, maximum ${c.maxOrderQty} ${baseUom}`}>
                        MOQ{" "}
                        <span className="font-semibold tabular-nums text-slate-700">
                          {c.moq}–{c.maxOrderQty}
                        </span>{" "}
                        {baseUom}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span
                        className="tabular-nums"
                        title={`Order multiple — quantities must be in increments of ${c.orderMultiples}`}
                      >
                        ×{c.orderMultiples}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Qty controls (+ / − with a typable input) + arrival chip —
                    ALWAYS available (no select gate). Stepping the qty above 0
                    adds the vendor's expected receiving to the plan; back to 0
                    removes it. In snapshot view (viewOnly=true) the +/-
                    steppers and typable input are frozen so the allocation
                    reads as a static value. */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-2.5 py-2 2xl:px-3 2xl:py-2.5">
                  <div className="flex items-center gap-1 2xl:gap-1.5">
                    <button
                      onClick={() => stepDown(v)}
                      disabled={qty === 0 || viewOnly}
                      className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 2xl:h-7 2xl:w-7"
                      aria-label={`Decrease ${v.vendorName} qty`}
                    >
                      <Minus className="h-3 w-3 2xl:h-3.5 2xl:w-3.5" />
                    </button>
                    <PlannerQtyInput
                      value={qty}
                      floor={0}
                      baseUom={baseUom}
                      ariaLabel={`${v.vendorName} quantity`}
                      focusClass="focus-within:border-[#0A77FF]"
                      onCommit={(n) => onSetAllocation(v.vendorId, n)}
                      readOnly={viewOnly}
                    />
                    <button
                      onClick={() => stepUp(v)}
                      disabled={viewOnly}
                      className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 2xl:h-7 2xl:w-7"
                      aria-label={`Increase ${v.vendorName} qty`}
                    >
                      <Plus className="h-3 w-3 2xl:h-3.5 2xl:w-3.5" />
                    </button>
                    {qty > c.maxOrderQty && (
                      <span className="text-[10px] font-medium text-amber-600">over max</span>
                    )}
                  </div>
                  {/* arrival vs need-by */}
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold 2xl:px-2 2xl:text-[10px]"
                    style={{
                      backgroundColor: late ? "#FEE2E2" : "#DCFCE7",
                      color: late ? "#B91C1C" : "#15803D",
                    }}
                    title={`Arrives on day +${arrivalDay} — ${arrivalDay} days from today`}
                  >
                    {late ? "arrives late" : "on time"} · day +{arrivalDay}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Show all vendors — order outside the qualified list (point 6) ── */}
      {canShowAll && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="shrink-0 self-center rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#0A77FF] transition-colors hover:bg-[#0A77FF]/5 2xl:px-2 2xl:py-1 2xl:text-xs"
        >
          {showAll ? "Show qualified vendors only" : "Show all vendors"}
        </button>
      )}

      {/* ── One-vendor-can't-cover hint ── */}
      {shortfall > 0 && allocated > 0 && (
        <div className="flex shrink-0 items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Still short by <span className="font-semibold">{shortfall} {baseUom}</span>.
            Raise a vendor quantity or add another vendor to close the gap.
          </span>
        </div>
      )}
    </div>
  );
}

/* Absolute need-by date "Jun 26" — mirrors the gap graph's deadline
   marker (startOfToday + day → "MMM D"). Built from LOCAL Y/M/D (never
   toISOString(), which converts to UTC and can shift a day behind UTC). */
const NEEDBY_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function needByDateLabel(day: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + day);
  return `${NEEDBY_MONTHS[d.getMonth()]} ${d.getDate()}`;
}
