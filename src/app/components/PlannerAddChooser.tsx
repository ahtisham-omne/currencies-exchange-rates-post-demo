/* ═══════════════════════════════════════════════════════════════
   PlannerAddChooser — the ONE "Add" modal shared by every surface
   ───────────────────────────────────────────────────────────────
   A single chooser drives the click-to-add flow in BOTH the gap
   graph's day popover AND the Transaction Table's header / between-row
   "+" — so the two can never drift. The host owns only the trigger and
   positioning (a Popover, or the graph's absolutely-placed box) and the
   commit handlers; this component owns the whole decision tree:

     Box with a header, primary action on top:
       1. PLAN A PURCHASE ORDER
          · Purchase from a qualified vendor (the default, recommended)
          · Show all vendors — buy outside the qualified list
       2. SIMULATE (grouped)
          · Simulate Supply   · Simulate Demand

   Simulate paths open the shared SimulateForm (locked flow); the plan
   path opens the vendor step, scoped to the qualified set or the full
   marketplace (the Qualified | All toggle / "Show all vendors"), with
   non-qualified vendors badged. Every commit routes through the host's
   `onSimulateAdd` / `onPlotVendor`, so an add reflects on both surfaces.
   ═══════════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Minus,
  ArrowDown,
  ArrowUp,
  Truck,
  ChevronLeft,
  ChevronRight,
  Store,
  Clock,
  Package,
  Check,
  AlertTriangle,
} from "lucide-react";

import { SimulateForm, type TransactionDirection } from "./UnifiedTransactionStream";
import SupplyPlanWizard, { type SupplyPlanWizardHandle } from "./SupplyPlanWizard";
import { vendorConstraints, defaultOrderQty } from "./plannerData";
import type { PlannerItem, PlannerVendor, PlanMode } from "./plannerData";
import { effectivePrice } from "../utils/projection";
import { VendorLogo } from "./vendorLogo";
import PlannerPricingRuleBadge from "./PlannerPricingRuleBadge";
import PlannerQtyInput from "./PlannerQtyInput";

/* Flow colours mirror the gap graph's dot taxonomy: demand red · supply
   green · planned vendor blue. */
const TONE_DEMAND = "#DC2626";
const TONE_SUPPLY = "#059669";
const TONE_VENDOR = "#2563EB";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Jul 11" from an ISO date, or "" when absent. */
function fmtDateLabel(iso?: string): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return "";
  return `${MONTHS[m - 1]} ${d}`;
}
/** A vendor's arrival label — today + `day`, matching the graph's window dates. */
function arrivalDateLabel(day: number): string {
  const dt = new Date();
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + Math.max(0, day));
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}


export interface PlannerAddChooserProps {
  item: PlannerItem;
  /** Qualified (recommended) vendors — the default plan set. */
  vendors?: PlannerVendor[];
  /** Full marketplace (qualified + non-qualified pool) for "Show all vendors". */
  allVendors?: PlannerVendor[];
  /** ISO date this add is anchored to — seeds the Simulate form + header label. */
  anchorDate?: string;
  /** Day offset (0 = today) a plotted vendor lands at. */
  anchorDay: number;
  /** Need-by day — drives the vendor cards' on-time / late pill. */
  deadlineDay?: number | null;
  /** Units needed to bring the item back to its minimum level — seeds the
      default plot quantity so the buyer isn't guessing how much to order. */
  unitsToCover?: number;
  /** Commit a simulated what-if (demand / supply). Omit to hide the Simulate section. */
  onSimulateAdd?: (data: {
    direction: TransactionDirection;
    typeLabel: string;
    qty: number;
    date: string;
  }) => void;
  /** Plot a chosen vendor as a planned PO. Omit (or pass no vendors) to hide the
      plan section. `plan.mode` says whether the clicked `day` is the order date
      ("orderOn") or the need-by date ("needBy") — the host derives order vs
      arrival from it. */
  onPlotVendor?: (
    vendorId: string,
    day: number,
    qty: number,
    plan?: { mode: PlanMode },
  ) => void;
  /** Close the host popover — called after any commit or the user dismissing a sub-step. */
  onClose: () => void;
  /** Open straight into a step (default: the chooser, or the vendor step when simulate is unavailable). */
  initialStep?: "choose" | "demand" | "supply" | "vendor";
  /** Open the vendor step scoped qualified (default) or all. */
  initialScope?: "qualified" | "all";
  /** True when the anchor day is the planning window's LAST day. Because event
      days are clamped to the window, everything due on or after that day stacks
      there — so the chooser shows an explainer + "widen the window" hint. */
  atWindowEnd?: boolean;
  /** Optional handle receiver — the host (PlannerGapGraph) wires this so
      its outside-click overlay can route dismiss attempts through the
      inner SupplyPlanWizard's discard guard instead of closing outright. */
  supplyWizardHandleRef?: React.MutableRefObject<SupplyPlanWizardHandle | null>;
  /** Edit-in-place pre-fills (buyer feedback 2026-07-20). When set,
      the wizard opens with Step 1 seeded to `initialQty` and Step 2
      seeded with `initialVendorId` selected. Used when a plotted PO
      is re-opened from the graph's day-card. Any commit from the
      wizard replaces the original plot rather than adding a new one
      (that side is handled by the host's plotVendorAt via its
      `editingExtraPOId` state). */
  initialQty?: number;
  initialVendorId?: string;
}

export default function PlannerAddChooser({
  item,
  vendors,
  allVendors,
  anchorDate,
  anchorDay,
  deadlineDay,
  unitsToCover = 0,
  onSimulateAdd,
  onPlotVendor,
  onClose,
  initialStep,
  initialScope = "qualified",
  atWindowEnd = false,
  supplyWizardHandleRef,
  initialQty,
  initialVendorId,
}: PlannerAddChooserProps) {
  const canSimulate = !!onSimulateAdd;
  const canPlotVendor = !!onPlotVendor && !!vendors && vendors.length > 0;

  const [step, setStep] = useState<"choose" | "demand" | "supply" | "vendor">(
    initialStep ?? (canSimulate ? "choose" : "vendor"),
  );
  const [scope, setScope] = useState<"qualified" | "all">(initialScope);
  const [sel, setSel] = useState<{ vendorId: string; qty: number } | null>(null);
  /* The one question, asked up front: is the clicked day when the ORDER is
     placed, or when stock must be RECEIVED? Default to need-by when at least
     one shown vendor could actually make that day — otherwise a near-term click
     would flag every vendor "too slow", so fall back to order-on. */
  const [mode, setMode] = useState<PlanMode>(() => {
    const list =
      initialScope === "all" ? (allVendors ?? vendors ?? []) : (vendors ?? []);
    return list.some((v) => v.leadTimeDays <= anchorDay) ? "needBy" : "orderOn";
  });

  /* Selecting a vendor expands its card to reveal the qty stepper + Plot
     button. Glide that card to the centre of the scroll area so those controls
     are in view without manual scrolling — the user's exact ask. Scrolls ONLY
     the inner list (never the host popover / page), and runs after render so
     the card's expanded height is final. Keyed on the selected vendor id, so it
     fires on (re)selection but not on every qty tap. */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectedCardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sel) return;
    const container = scrollRef.current;
    const card = selectedCardRef.current;
    if (!container || !card) return;
    const cRect = container.getBoundingClientRect();
    const kRect = card.getBoundingClientRect();
    const taller = kRect.height > container.clientHeight;
    // Centre when it fits; otherwise pin its top so the inputs (right under the
    // header) stay visible rather than centring it half-off both edges.
    const delta = taller
      ? kRect.top - cRect.top
      : kRect.top - cRect.top - (container.clientHeight - kRect.height) / 2;
    container.scrollTo({ top: Math.max(0, container.scrollTop + delta), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.vendorId]);

  const dateLabel = fmtDateLabel(anchorDate);

  /* The full marketplace backing "Show all vendors"; falls back to the qualified
     set. Qualified-ness is recovered by intersecting ids. */
  const marketplace = allVendors && allVendors.length > 0 ? allVendors : (vendors ?? []);
  const qualifiedIds = new Set((vendors ?? []).map((v) => v.vendorId));

  /* Cards mirror the Qualified Vendors panel — cheapest-green / dearest-red +
     rule badges. Ranking is a baseline snapshot at qty 0 so tiered discounts
     don't skew it. */
  const effOf = (v: PlannerVendor) => effectivePrice(v.unitPrice, v.pricingRules, 0);
  const sortByPrice = (list: PlannerVendor[]) =>
    [...list].sort((a, b) => {
      if (a.primaryFlag !== b.primaryFlag) return a.primaryFlag ? -1 : 1;
      return effOf(a) - effOf(b) || a.vendorName.localeCompare(b.vendorName);
    });
  const qualifiedSorted = sortByPrice(vendors ?? []);
  /* "All" keeps the qualified set first (its perfect default order), then the
     non-qualified pool below, price-sorted. */
  const allSorted = [
    ...qualifiedSorted,
    ...sortByPrice(marketplace.filter((v) => !qualifiedIds.has(v.vendorId))),
  ];
  const shownVendors = scope === "all" ? allSorted : qualifiedSorted;
  const effValues = shownVendors.map(effOf);
  const minEff = effValues.length ? Math.min(...effValues) : 0;
  const maxEff = effValues.length ? Math.max(...effValues) : 0;
  const hasSpread = minEff !== maxEff;

  /* Per-vendor timing under the current mode. needBy: the clicked day is the
     arrival; the order is back-dated by the lead time and the vendor only
     "fits" if that lands today or later. orderOn: the order is the clicked day;
     stock arrives lead-time later and is "late" if it overruns the need-by. */
  const planFor = (v: PlannerVendor) => {
    if (mode === "needBy") {
      const daysUntil = Math.max(0, anchorDay);
      return {
        orderDay: Math.max(0, anchorDay - v.leadTimeDays),
        arrivalDay: anchorDay,
        fits: v.leadTimeDays <= daysUntil,
        late: false,
      };
    }
    const arrivalDay = anchorDay + v.leadTimeDays;
    return {
      orderDay: anchorDay,
      arrivalDay,
      fits: true,
      late: deadlineDay != null && arrivalDay > deadlineDay,
    };
  };
  /* A vendor is selectable unless it can't physically meet a need-by date. */
  const isEligible = (v: PlannerVendor) => mode === "orderOn" || planFor(v).fits;
  /* Recommended = the primary vendor when it qualifies, else the first eligible,
     else just the first shown (so the list is never left with nothing picked). */
  const recommendedVendor = (): PlannerVendor | null => {
    const elig = shownVendors.filter(isEligible);
    if (elig.length === 0) return null; // nothing can make this date — don't pre-pick an impossible plan
    return elig.find((v) => v.primaryFlag) ?? elig[0] ?? null;
  };
  /* Open with the recommended vendor already picked and a bring-to-minimum
     quantity filled in — no "tick a checkbox first" step. Re-seeds only when the
     current pick falls out of the eligible set (e.g. flipping to need-by makes a
     slow vendor invalid); a manual selection/deselection is left alone. */
  useEffect(() => {
    if (step !== "vendor") return;
    const selVendor = sel ? shownVendors.find((v) => v.vendorId === sel.vendorId) : null;
    const stale = !selVendor || !isEligible(selVendor);
    if (sel && !stale) return;
    const rec = recommendedVendor();
    setSel(rec ? { vendorId: rec.vendorId, qty: defaultOrderQty(item, rec, unitsToCover) } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, scope, mode, anchorDay]);

  /* ── Step 1 — chooser ── */
  if (step === "choose") {
    return (
      <div className="p-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-slate-100">
            <Plus className="size-3.5 text-slate-500" />
          </div>
          <div>
            <p className="text-[11.5px] 2xl:text-[12.5px] font-semibold text-slate-800">
              What to add{dateLabel ? ` at ${dateLabel}` : ""}
            </p>
          </div>
        </div>
        {atWindowEnd && (
          <div className="mb-2.5 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-[9.5px] 2xl:text-[10.5px] leading-snug text-slate-500">
            This is the end of your planning period. Demand and supply due on or after{" "}
            <span className="font-semibold text-slate-600">{dateLabel}</span> stack on this day. Widen the
            window to see them on their own dates.
          </div>
        )}
        {/* Simplified chooser (user feedback 2026-07-01): the two Simulate
            actions are the sole entry points now. Vendor picking + PO
            planning happens INSIDE the Simulate Supply wizard once the buyer
            has picked a date + qty, so surfacing "Plan a purchase order"
            here duplicated the flow. */}
        <div className="space-y-1.5">
          {canSimulate && (
            <>
              <button
                type="button"
                onClick={() => setStep("supply")}
                className="flex w-full items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
              >
                <ArrowUp className="mt-0.5 size-4 shrink-0" style={{ color: TONE_SUPPLY }} />
                <span>
                  <span className="block text-[11.5px] 2xl:text-[12.5px] font-semibold text-slate-800">Simulate supply</span>
                  <span className="block text-[10px] 2xl:text-[11px] text-slate-500">
                    Plot incoming stock, real or hypothetical, that increases the inventory.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStep("demand")}
                className="flex w-full items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-red-200 hover:bg-red-50/40"
              >
                <ArrowDown className="mt-0.5 size-4 shrink-0" style={{ color: TONE_DEMAND }} />
                <span>
                  <span className="block text-[11.5px] 2xl:text-[12.5px] font-semibold text-slate-800">Simulate demand</span>
                  <span className="block text-[10px] 2xl:text-[11px] text-slate-500">
                    Plot a sales order or purchase request that lowers the inventory.
                  </span>
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Step 2a — simulate demand (single-step form) ── */
  if (step === "demand" && onSimulateAdd) {
    return (
      <SimulateForm
        baseUom={item.baseUom}
        initialDate={anchorDate}
        initialFlow="outgoing"
        lockFlow
        onCancel={() => (canSimulate && canPlotVendor ? setStep("choose") : onClose())}
        onSubmit={(d) => {
          onSimulateAdd(d);
          onClose();
        }}
      />
    );
  }

  /* ── Step 2b — plan supply (3-step wizard: need → vendor → timing).
     Replaces the flat SimulateForm for supply so buyers can (optionally)
     chain into vendor + timing in one popover. Skip-vendor still commits
     as a what-if sim; picking a vendor commits as a proposed PO plot. */
  if (step === "supply" && onSimulateAdd && onPlotVendor) {
    return (
      <SupplyPlanWizard
        ref={supplyWizardHandleRef}
        item={item}
        vendors={shownVendors}
        /* Pool of partners not currently qualified for this item —
           powers the in-flow "Add a vendor" picker (buyer 2026-07-21).
           Filter out anyone already in the qualified list; if the buyer
           is showing "all", nothing else to add here. */
        unqualifiedVendors={
          scope === "qualified"
            ? marketplace.filter((v) => !qualifiedIds.has(v.vendorId))
            : []
        }
        anchorDate={anchorDate}
        unitsToCover={unitsToCover}
        onSimulateAdd={(d) => onSimulateAdd(d)}
        onPlotVendor={onPlotVendor}
        onClose={onClose}
        initialQty={initialQty}
        initialVendorId={initialVendorId}
      />
    );
  }

  /* Supply path with sim-only wiring (no vendor plotting host) — fall back
     to the single-step form. */
  if (step === "supply" && onSimulateAdd) {
    return (
      <SimulateForm
        baseUom={item.baseUom}
        initialDate={anchorDate}
        initialFlow="incoming"
        lockFlow
        onCancel={() => (canSimulate && canPlotVendor ? setStep("choose") : onClose())}
        onSubmit={(d) => {
          onSimulateAdd(d);
          onClose();
        }}
      />
    );
  }

  /* ── Step 2c — plan a purchase order (qualified set or full marketplace) ── */
  if (step === "vendor" && onPlotVendor && vendors) {
    return (
      <div className="p-3">
        <div className="mb-2.5 flex items-center gap-1.5">
          {canSimulate && (
            <button
              type="button"
              onClick={() => setStep("choose")}
              aria-label="Back"
              className="-ml-1 flex size-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <div className="min-w-0">
            <p className="truncate text-[11.5px] 2xl:text-[12.5px] font-semibold text-slate-800">
              Plan a purchase order
            </p>
            <p className="text-[9.5px] 2xl:text-[10.5px] text-slate-500">
              {unitsToCover > 0 ? (
                <>
                  Order{" "}
                  <span className="font-semibold text-slate-600">
                    {unitsToCover} {item.baseUom}
                  </span>{" "}
                  to bring this item back to its minimum.
                </>
              ) : (
                "Creates an expected receiving from a qualified vendor."
              )}
            </p>
          </div>
          {(allVendors?.length ?? 0) > (vendors?.length ?? 0) && (
            <div className="ml-auto inline-flex shrink-0 rounded-md bg-slate-100 p-0.5">
              {(["qualified", "all"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setScope(s);
                    setSel(null);
                  }}
                  className={
                    "rounded px-2 py-0.5 text-[9.5px] 2xl:text-[10.5px] font-medium transition-colors " +
                    (scope === s ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")
                  }
                >
                  {s === "qualified" ? "Qualified" : "All"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* The one question: order on this day, or need it received by this day?
            Flips how the clicked day is read; everything below re-times to match. */}
        <div className="mb-2.5 rounded-lg border border-slate-200/80 bg-slate-50/60 p-2">
          <div className="inline-flex w-full rounded-md bg-slate-100 p-0.5">
            {(
              [
                { m: "needBy", label: "Need it by" },
                { m: "orderOn", label: "Order on" },
              ] as const
            ).map(({ m, label }) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={
                  "flex-1 rounded px-2 py-1 text-[10px] 2xl:text-[11px] font-semibold transition-colors " +
                  (mode === m
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700")
                }
              >
                {label} {arrivalDateLabel(anchorDay)}
              </button>
            ))}
          </div>
          <p className="mt-1.5 px-0.5 text-[9px] 2xl:text-[10px] leading-snug text-slate-500">
            {mode === "needBy"
              ? `Stock must arrive by ${arrivalDateLabel(anchorDay)}. The order is placed earlier, and vendors that can't make it in time are flagged.`
              : `The order is placed ${arrivalDateLabel(anchorDay)}. Stock arrives later, after each vendor's lead time.`}
          </p>
        </div>
        {mode === "needBy" && !shownVendors.some(isEligible) && (
          <div className="mb-2.5 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[10px] 2xl:text-[11px] text-red-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              No qualified vendor can arrive by {arrivalDateLabel(anchorDay)}. Switch to{" "}
              <span className="font-semibold">Order on {arrivalDateLabel(anchorDay)}</span>, or pick a
              later need-by date.
            </span>
          </div>
        )}
        <div ref={scrollRef} className="-mx-1 max-h-[300px] space-y-2 overflow-y-auto scrollbar-planner px-1">
          {shownVendors.map((v) => {
            const c = vendorConstraints(item, v);
            const isQualified = qualifiedIds.has(v.vendorId);
            const isSel = sel && sel.vendorId === v.vendorId ? sel : null;
            const plan = planFor(v);
            const eligible = isEligible(v);
            const eff = effectivePrice(v.unitPrice, v.pricingRules, isSel ? isSel.qty : 0);
            const priceColor =
              hasSpread && eff === minEff
                ? "#16A34A"
                : hasSpread && eff === maxEff
                  ? "#DC2626"
                  : "#1E293B";
            const priceTitle =
              hasSpread && eff === minEff
                ? "Cheapest"
                : hasSpread && eff === maxEff
                  ? "Most expensive"
                  : undefined;
            return (
              <div
                key={v.vendorId}
                ref={isSel ? selectedCardRef : null}
                className="rounded-lg border bg-white transition-colors"
                style={{
                  borderColor: isSel ? "#2563EB" : !eligible ? "#FECACA" : "#E2E8F0",
                  boxShadow: isSel ? "inset 0 0 0 1px #2563EB" : "none",
                  opacity: eligible ? 1 : 0.9,
                }}
              >
                <button
                  type="button"
                  disabled={!eligible}
                  onClick={() =>
                    setSel(
                      isSel
                        ? null
                        : { vendorId: v.vendorId, qty: defaultOrderQty(item, v, unitsToCover) },
                    )
                  }
                  aria-pressed={!!isSel}
                  className="flex w-full items-start gap-2.5 px-2.5 py-2.5 text-left disabled:cursor-not-allowed"
                >
                  <VendorLogo name={v.vendorName} id={v.vendorId} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[11.5px] 2xl:text-[12.5px] font-semibold text-slate-800">
                        {v.vendorName}
                      </span>
                      {v.primaryFlag && (
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[8px] 2xl:text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                          Primary
                        </span>
                      )}
                      {!isQualified && (
                        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[8px] 2xl:text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                          Not qualified
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[10.5px] 2xl:text-[11.5px] text-slate-500">
                      <Clock className="h-3 w-3 shrink-0 text-slate-400" /> {v.leadTimeDays}-day lead
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] 2xl:text-[11.5px]">
                      <span
                        className="whitespace-nowrap font-semibold tabular-nums"
                        style={{ color: priceColor }}
                        title={priceTitle}
                      >
                        ${eff.toFixed(2)}
                        <span className="font-normal text-slate-400"> / {item.baseUom}</span>
                      </span>
                      {v.pricingRules.map((r, i) => (
                        <PlannerPricingRuleBadge key={i} rule={r} uom={item.baseUom} />
                      ))}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[9.5px] 2xl:text-[10.5px] text-slate-500">
                      <Package className="h-3 w-3 shrink-0 text-slate-400" />
                      <span>
                        Order{" "}
                        <span className="font-semibold tabular-nums text-slate-700">
                          {c.moq}–{c.maxOrderQty}
                        </span>{" "}
                        {item.baseUom}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="tabular-nums">×{c.orderMultiples}</span>
                    </div>
                    {/* Timing under the current mode — on every card so the fit /
                        late state reads at a glance before selecting. */}
                    <div className="mt-1.5">
                      {mode === "needBy" ? (
                        eligible ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] 2xl:text-[10px] font-semibold"
                            style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}
                          >
                            <Check className="h-3 w-3" /> arrives {arrivalDateLabel(plan.arrivalDay)} · order by{" "}
                            {arrivalDateLabel(plan.orderDay)}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] 2xl:text-[10px] font-semibold"
                            style={{ backgroundColor: "#FEE2E2", color: "#B91C1C" }}
                          >
                            <AlertTriangle className="h-3 w-3" /> won't arrive in time · {v.leadTimeDays}-day lead
                          </span>
                        )
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] 2xl:text-[10px] font-semibold"
                          style={{
                            backgroundColor: plan.late ? "#FEE2E2" : "#DCFCE7",
                            color: plan.late ? "#B91C1C" : "#15803D",
                          }}
                        >
                          {plan.late ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                          {plan.late ? "arrives late" : "arrives"} {arrivalDateLabel(plan.arrivalDay)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {isSel && (
                  <div className="border-t border-slate-100 px-2.5 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSel((s) => (s ? { ...s, qty: Math.max(c.moq, s.qty - c.orderMultiples) } : s))
                          }
                          disabled={isSel.qty <= c.moq}
                          className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <PlannerQtyInput
                          value={isSel.qty}
                          floor={c.moq}
                          baseUom={item.baseUom}
                          ariaLabel={`${v.vendorName} quantity`}
                          focusClass="focus-within:border-[#2563EB]"
                          onCommit={(n) => setSel((s) => (s ? { ...s, qty: n } : s))}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setSel((s) => (s ? { ...s, qty: s.qty + c.orderMultiples } : s))
                          }
                          className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        {isSel.qty > c.maxOrderQty && (
                          <span className="text-[9px] 2xl:text-[10px] font-medium text-amber-600">over max</span>
                        )}
                      </div>
                      <span className="text-[9.5px] 2xl:text-[10.5px] tabular-nums text-slate-500">
                        order{" "}
                        <span className="font-semibold text-slate-700">
                          {arrivalDateLabel(plan.orderDay)}
                        </span>{" "}
                        → arrives{" "}
                        <span
                          className="font-semibold"
                          style={{ color: plan.late ? "#B91C1C" : "#15803D" }}
                        >
                          {arrivalDateLabel(plan.arrivalDay)}
                        </span>
                      </span>
                    </div>
                    {plan.late && (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[9.5px] 2xl:text-[10.5px] font-medium text-red-600">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Arrives after the need-by. Pick a faster vendor or move the date.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onPlotVendor(v.vendorId, anchorDay, isSel.qty, { mode });
                        onClose();
                      }}
                      className="mt-2.5 w-full rounded-md bg-[#2563EB] py-1.5 text-[11px] 2xl:text-[12px] font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
                    >
                      Plot {isSel.qty} {item.baseUom}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
