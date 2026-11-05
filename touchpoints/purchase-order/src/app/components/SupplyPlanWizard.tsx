/* ═══════════════════════════════════════════════════════════════
   SUPPLY-PLAN WIZARD (single screen)
   ───────────────────────────────────────────────────────────────
   Eli 2026-07-16 verbatim: "you're all overcomplicating this, it's
   supposed to be an easy feature." What used to be a 3-step wizard
   (Need / Vendor / Timing) collapses to a flat, one-screen form:

     • Expected delivery date — the anchor everything works
       backwards from. Order date = delivery − vendor lead time.
     • How much — qty in a compatible UoM, with a WHY THIS QUANTITY
       hover explaining the item-master derivation.
     • Vendor (optional) — inline list; picking a row derives the
       order date + MOQ-safe qty.

   No need-by / order-on choice — the clicked day is always the
   delivery date. When no vendor's lead time can reach that date, we
   surface a "ship ASAP" warning but the user can still pick a
   vendor and override (they may have confirmed the vendor can
   expedite off-plan).

   Renders inside PlannerAddChooser as a self-contained shell.
   Reuses the existing `onSimulateAdd` / `onPlotVendor` handlers, so
   the graph + transaction table stay in sync.
   ═══════════════════════════════════════════════════════════════ */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Info,
  Minus,
  Package,
  Plus as PlusIcon,
  Search as SearchIcon,
  X as XIcon,
} from "lucide-react";
import { FONT } from "./designTokens";
import { VendorLogo } from "./vendorLogo";
import PlannerPricingRuleBadge from "./PlannerPricingRuleBadge";
import { PriceWarningShell } from "./PriceConfirmationDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  vendorConstraints,
  type PlannerItem,
  type PlannerVendor,
  type PlanMode,
} from "./plannerData";
import {
  recommendedQtyFromItemMaster,
  useRecommendationMode,
  type QtyRecommendation,
} from "./plannerRecommendationStore";
import { effectivePrice } from "../utils/projection";
import { getCompatibleUOMs, convertQty } from "./uomRegistry";
import { SystemDatePicker } from "./_dashboardModalKit";
import { toast } from "sonner";

/** ISO ⇄ Date helpers built from local Y/M/D so the round-trip never shifts
    a day (toISOString() would convert to UTC). Kept internal because the
    wizard owns its own date input; no shared util call site depends on it. */
const isoToDate = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};
const dateToIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = (): string => dateToIso(new Date());
const daysFromToday = (iso: string): number => {
  const ms = Date.parse(`${iso}T00:00:00`) - Date.parse(`${todayIso()}T00:00:00`);
  return Math.round(ms / 86400000);
};
const fmtFull = (iso: string): string =>
  isoToDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const fmtShort = (iso: string): string =>
  isoToDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Signed number → "3" / "−3" using the true minus glyph. */
function fmtSigned(n: number): string {
  if (n === 0) return "0";
  return n > 0 ? String(n) : `−${Math.abs(n)}`;
}

/** WHY THIS QUANTITY breakdown — the item-rule chip's hover tooltip.
 *
 * Mirrors the ATP INVENTORY SNAPSHOT layout (PODemands column header):
 * uppercase icon header, hierarchical rows with indented sub-terms, an
 * emerald-highlighted result row, and a mono formula footer.
 *
 * Every value comes from the plannerRecommendationStore's structured
 * QtyRecommendation — no re-derivation, no string parsing. Rows that
 * wouldn't fire (no rounding, no MOQ floor, no cap) are omitted so
 * the breakdown reads exactly the derivation that applied to THIS
 * qty. */
function WhyThisQuantityBreakdown({
  qtyRec,
  projectedOnHand,
  uom,
}: {
  qtyRec: QtyRecommendation;
  projectedOnHand: number;
  uom: string;
}) {
  /* Human-friendly target-level label. `"min (default)"` is what the
     store emits when no explicit mode is set — reads as "Minimum" in
     the buyer-facing card. */
  const targetTitle =
    qtyRec.targetLabel === "min" || qtyRec.targetLabel === "min (default)"
      ? "Minimum"
      : qtyRec.targetLabel === "max"
        ? "Maximum"
        : qtyRec.targetLabel === "zero"
          ? "Zero"
          : qtyRec.targetLabel;

  /* Re-derive the intermediate values the store computes internally so we
     can render each adjustment as an indented row with its delta. The math
     mirrors recommendedQtyFromItemMaster() exactly. */
  const preRound = qtyRec.shortfall > 0 ? qtyRec.shortfall : qtyRec.moq;
  const rounded =
    Math.ceil(preRound / Math.max(1, qtyRec.multiplesOf)) *
    Math.max(1, qtyRec.multiplesOf);
  const roundDelta = rounded - preRound;
  const afterMOQ = Math.max(rounded, qtyRec.moq);
  const moqDelta = afterMOQ - rounded;
  const capDelta = qtyRec.capped ? qtyRec.qty - afterMOQ : 0;

  const shortfallLabel = qtyRec.shortfall > 0 ? "Shortfall" : "Already covered";
  const shortfallValue = qtyRec.shortfall > 0 ? qtyRec.shortfall : 0;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
        <Package className="h-3 w-3" />
        Why this quantity
      </div>

      {/* Breakdown rows */}
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between font-semibold">
          <span>Target · {targetTitle}</span>
          <span className="tabular-nums">
            {qtyRec.targetLevel} {uom}
          </span>
        </div>
        <div className="flex items-center justify-between pl-3 opacity-80">
          <span>Projected on-hand</span>
          <span className="tabular-nums">
            {fmtSigned(projectedOnHand)} {uom}
          </span>
        </div>

        <div className="flex items-center justify-between font-semibold pt-1">
          <span>{shortfallLabel}</span>
          <span className="tabular-nums">
            {shortfallValue} {uom}
          </span>
        </div>

        {/* Falling back to MOQ when there's no shortfall — the store uses
            item MOQ as the pre-round baseline. Show it explicitly so the
            buyer can trace where the number came from. */}
        {qtyRec.shortfall === 0 && qtyRec.moq > 0 && (
          <div className="flex items-center justify-between pl-3 opacity-80">
            <span>Fall back to MOQ ({qtyRec.moq})</span>
            <span className="tabular-nums">
              +{qtyRec.moq} {uom}
            </span>
          </div>
        )}

        {qtyRec.rounded && (
          <div className="flex items-center justify-between pl-3 opacity-80">
            <span>Round to multiple of {qtyRec.multiplesOf}</span>
            <span className="tabular-nums">
              +{roundDelta} {uom}
            </span>
          </div>
        )}
        {qtyRec.moqApplied && (
          <div className="flex items-center justify-between pl-3 opacity-80">
            <span>MOQ floor ({qtyRec.moq})</span>
            <span className="tabular-nums">
              +{moqDelta} {uom}
            </span>
          </div>
        )}
        {qtyRec.capped && (
          <div className="flex items-center justify-between pl-3 opacity-80">
            <span>Cap at max order ({qtyRec.maxOrderQty})</span>
            <span className="tabular-nums">
              {fmtSigned(capDelta)} {uom}
            </span>
          </div>
        )}

        {/* Recommended — emerald highlighted row, mirroring the ATP row
            in the INVENTORY SNAPSHOT tooltip. */}
        <div
          className="mt-1 flex items-center justify-between rounded-md px-2 py-1 font-semibold"
          style={{
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            color: "#10B981",
          }}
        >
          <span>Recommended</span>
          <span className="tabular-nums">
            {qtyRec.qty} {uom}
          </span>
        </div>
      </div>

      {/* Formula footer */}
      <div className="space-y-0.5 border-t border-white/15 pt-2 font-mono text-[10px] opacity-80">
        <p>Recommended = max(Target − On-hand, MOQ)</p>
        <p>rounded to multiples of {qtyRec.multiplesOf}</p>
      </div>
    </div>
  );
}

/** Imperative handle exposed to hosts (PlannerAddChooser → PlannerGapGraph)
 *  so an outside-click overlay can defer to the wizard's discard guard
 *  instead of dismissing outright. Returns true when the wizard consumed
 *  the request (dirty → showed confirm strip); false when the wizard is
 *  pristine and it's safe to close directly. */
export interface SupplyPlanWizardHandle {
  requestClose: () => boolean;
}

export interface SupplyPlanWizardProps {
  item: PlannerItem;
  vendors: PlannerVendor[];
  /** Vendors that exist in the marketplace but are NOT currently
      qualified for this item — powers the in-flow "Add a vendor"
      picker so the buyer can attach an existing partner without
      leaving the wizard (buyer 2026-07-21 rule: "never make the user
      leave the flow"). Empty when caller doesn't provide it. */
  unqualifiedVendors?: PlannerVendor[];
  /** ISO date the graph click was anchored to — seeds Step 1's date field. */
  anchorDate: string;
  /** Baseline units the buyer should recover to hit min — seeds the qty
      default so Step 1 opens with a realistic fill instead of an empty box. */
  unitsToCover?: number;
  /** Commit a simulated supply what-if (Skip-vendor path). */
  onSimulateAdd: (data: {
    direction: "incoming";
    typeLabel: string;
    qty: number;
    date: string;
  }) => void;
  /** Commit a proposed vendor plot (Steps 2+3 path). */
  onPlotVendor: (
    vendorId: string,
    day: number,
    qty: number,
    plan?: { mode: PlanMode },
  ) => void;
  onClose: () => void;
  /** Edit-in-place pre-fills (buyer feedback 2026-07-20). When
      supplied, Step 1's qty input opens with `initialQty` (instead
      of the item-master recommendation) and Step 2's vendor list
      opens with `initialVendorId` pre-selected. The commit path is
      unchanged; the host maps the commit onto an existing plot's
      slot via its editing state. */
  initialQty?: number;
  initialVendorId?: string;
}

const SupplyPlanWizard = forwardRef<SupplyPlanWizardHandle, SupplyPlanWizardProps>(function SupplyPlanWizard(
  {
    item,
    vendors,
    unqualifiedVendors = [],
    anchorDate,
    unitsToCover = 0,
    onSimulateAdd,
    onPlotVendor,
    onClose,
    initialQty,
    initialVendorId,
  },
  ref,
) {
  /* Dirty tracking (buyer feedback 2026-07-16): once the wizard has any
     user-entered input, dismissing without a discard prompt would lose
     work silently. `dirty` flips true on the first change (qty / uom /
     date / vendor pick). `confirmingDiscard` surfaces the inline confirm
     strip in the sticky footer; it's set by the imperative `requestClose`
     handle when an outside-click / Cancel hits a dirty wizard. */
  const [dirty, setDirty] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const markDirty = () => {
    if (!dirty) setDirty(true);
  };
  /* Kept in a ref so `requestClose` stays a stable identity — the graph's
     outside-click handler calls into it synchronously and shouldn't have
     to memo around a changing dirty flag. */
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useImperativeHandle(
    ref,
    () => ({
      /* Buyer 2026-08-03: "we don't need to show discard". Close the
         wizard directly on every request — no dirty-state confirmation.
         Any picks the buyer made are dropped as part of the standard
         close (state lives on this component and unmounts). */
      requestClose: () => false,
    }),
    [],
  );

  /* ── Item-master recommendation ─────────────────────────────
     Buyer feedback 2026-07-14: the suggested qty must come from the
     item master (min/max/multiples/MOQ/max-order), not the vendor,
     and the UI must explain WHY. `unitsToCover` (from the parent) is
     the shortfall to hit min against the worst projected ATP; we
     reverse-derive `currentAtp = minLevel − unitsToCover` so the
     recommendation math works for any target (min/max/zero). The
     `reason` line surfaces just below the qty input. */
  const recMode = useRecommendationMode(item.itemCode);
  const currentAtpProxy = item.minLevel - unitsToCover;
  const qtyRec: QtyRecommendation = useMemo(
    () => recommendedQtyFromItemMaster(item, currentAtpProxy, recMode),
    [item, currentAtpProxy, recMode],
  );

  /* Edit vs create — the host passes `initialQty` / `initialVendorId`
     when the buyer clicked Edit on an existing plot. Header copy and
     the pill flip so it never reads as "create a new simulation". */
  const isEdit =
    (initialQty !== undefined && initialQty > 0) ||
    (initialVendorId !== undefined && initialVendorId !== "");

  /* ── Two-step model (buyer 2026-07-19). Step 1 = details (date, qty,
     UoM, item-rule reason). Step 2 = vendor selection. Connected
     stepper header, one screen at a time, no scroll. Guarded so
     Step 2 can only be reached when Step 1's inputs are valid. */
  const [step, setStep] = useState<1 | 2>(1);
  /* ── Step 1 state — date, qty (in the picked UoM), UoM. ── */
  const [date, setDate] = useState<string>(anchorDate);
  /* Seed order: (1) editing pre-fill → the plot the buyer is editing;
     (2) item-master recommendation; (3) parent-derived shortfall
     (unitsToCover) as a defensive fallback. `initialQty` from the
     host, when present, wins so the wizard opens with the plot the
     buyer clicked Edit on. */
  const seedQty = initialQty && initialQty > 0
    ? initialQty
    : qtyRec.qty > 0
      ? qtyRec.qty
      : unitsToCover;
  const [qty, setQty] = useState<string>(seedQty > 0 ? String(seedQty) : "");
  const [uom, setUom] = useState<string>(item.baseUom);
  const compatibleUoms = useMemo(() => getCompatibleUOMs(item.baseUom), [item.baseUom]);
  const qtyNum = Number(qty);
  const qtyInBaseUom = useMemo(() => {
    const converted = convertQty(uom, item.baseUom, qtyNum);
    return converted ?? qtyNum;
  }, [uom, item.baseUom, qtyNum]);
  const step1Valid = Number.isFinite(qtyNum) && qtyNum > 0 && !!date;
  const daysUntilArrival = useMemo(() => daysFromToday(date), [date]);

  /* Picked vendor — clicking a row in the vendor list sets this; a
     second click on the same row deselects. Plot fires when a vendor
     is picked AND step1Valid; Just simulate fires without a vendor.
     When the wizard opens in edit mode (initialVendorId set), the
     matching vendor from `vendors` seeds the pick so Step 2 opens
     with the buyer's original vendor highlighted. */
  const [pickedVendor, setPickedVendor] = useState<PlannerVendor | null>(
    initialVendorId
      ? vendors.find((v) => v.vendorId === initialVendorId) ?? null
      : null,
  );

  /* Vendors attached in-flow via the "Add a vendor" popover. These live
     alongside the qualified list — they render together, sort the same
     way, and are eligible for pick. A vendor's `leadTimeDays` defaults
     to 0 when missing (buyer 2026-07-21: "if a vendor has no lead time,
     default it to zero days — assume they can fill immediately").
     Cleared with the wizard's lifetime; caller doesn't persist. */
  const [extraVendors, setExtraVendors] = useState<PlannerVendor[]>([]);
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  /* Search query for the Add-a-vendor popover — filters `addableVendors`
     by substring match on vendor name. Cleared when the popover closes.
     Buyer 2026-08-03: "Add a search field to find/select an existing
     vendor in the plot-supply step". */
  const [extraVendorSearch, setExtraVendorSearch] = useState("");
  /* After picking an unqualified vendor, prompt the buyer to decide
     whether this attachment is for this plan only or should qualify the
     vendor on the item (buyer 2026-08-03: "ask user if they want to
     qualify this vendor or only for the planning like we are doing on
     the purchase order side"). Mirrors OrderFlow's location-qualify
     PriceWarningShell. Local Set stores vendorIds the buyer qualified
     during this wizard session — production would persist upstream. */
  const [qualifyPrompt, setQualifyPrompt] = useState<PlannerVendor | null>(null);
  const [qualifiedVendorIds, setQualifiedVendorIds] = useState<Set<string>>(new Set());

  const vendorRows = useMemo(() => {
    const combined = [...(vendors ?? []), ...extraVendors];
    if (combined.length === 0) return [];
    return combined
      .map((v) => {
        const c = vendorConstraints(item, v);
        const eff = effectivePrice(v.unitPrice, v.pricingRules, qtyInBaseUom);
        return {
          v,
          eff,
          moq: c.moq,
          maxOrderQty: c.maxOrderQty,
          fits: v.leadTimeDays <= Math.max(0, daysUntilArrival),
        };
      })
      .sort((a, b) => {
        if (a.fits !== b.fits) return a.fits ? -1 : 1;
        if (a.v.primaryFlag !== b.v.primaryFlag) return a.v.primaryFlag ? -1 : 1;
        return a.eff - b.eff;
      });
  }, [vendors, extraVendors, item, qtyInBaseUom, daysUntilArrival]);

  /* Pool of vendors the buyer hasn't already added via Add-a-vendor —
     drives the picker rows. Sorted alphabetically; empty when the host
     didn't pass `unqualifiedVendors`. */
  const addableVendors = useMemo(() => {
    const added = new Set(extraVendors.map((v) => v.vendorId));
    return unqualifiedVendors
      .filter((v) => !added.has(v.vendorId))
      .sort((a, b) => a.vendorName.localeCompare(b.vendorName));
  }, [unqualifiedVendors, extraVendors]);

  const handleAddVendor = (v: PlannerVendor) => {
    markDirty();
    /* Newly-attached vendors default to a 0-day lead (arrive today). The
       vendor's registry-level lead time is a "generic" number; for this
       item on this plan the buyer hasn't confirmed timing yet, so we
       treat it as unknown and let the buyer override on the picked
       vendor row (buyer 2026-08-03: "when I am selecting a new vendor I
       don't know about its lead time it will be the current day by
       default"). */
    const normalized: PlannerVendor = {
      ...v,
      leadTimeDays: 0,
    };
    setExtraVendors((prev) => [...prev, normalized]);
    setPickedVendor(normalized);
    setAddVendorOpen(false);
    setExtraVendorSearch("");
    /* Ask whether to only use this vendor for this plan, or qualify it
       on the vendor so future plans/POs see it too. Same pattern as
       OrderFlow's location-qualify prompt. */
    setQualifyPrompt(normalized);
  };

  /* "Create a new vendor" no longer builds an adhoc PlannerVendor
     in-place — buyer 2026-08-03 asked for a plain link that opens the
     Partners creation flow in a new tab instead. The old
     `handleCreateVendor` fn + `createNameOpen` / `newVendorName` state
     have been dropped. Existing adhoc vendors already added to a plan
     (via prior sessions) still render via the `adhoc-` vendorId prefix
     branch below. */

  /* Derived MOQ-aware plot qty. When a vendor is picked we round the
     buyer's requested qty up to the vendor's multiples and floor at MOQ,
     so the commit respects the vendor's ordering constraints without
     making the buyer touch a second stepper (Eli 2026-07-16: "you select
     them and hit plot, and literally that's what I do"). Zero when no
     vendor is picked — the Just-simulate path uses `qtyInBaseUom`
     directly since no vendor constraint applies. */
  const orderQty = useMemo(() => {
    if (!pickedVendor) return 0;
    const c = vendorConstraints(item, pickedVendor);
    const rounded =
      Math.ceil(qtyInBaseUom / Math.max(1, c.orderMultiples)) *
      Math.max(1, c.orderMultiples);
    return Math.max(c.moq, rounded);
  }, [pickedVendor, qtyInBaseUom, item]);

  /* Order date derived from the delivery date + vendor lead time. Eli
     2026-07-16: "you start with the delivery date… every other date
     works its way backwards from here." No user choice — always
     back-calculated. Clamped at 0 (today) when the vendor's lead time
     exceeds the days-until-delivery (the "ship ASAP" case). */
  const orderDayFromVendor = pickedVendor
    ? Math.max(0, daysUntilArrival - pickedVendor.leadTimeDays)
    : null;
  const orderDateFromVendor = orderDayFromVendor != null
    ? dateToIso(new Date(new Date().getTime() + orderDayFromVendor * 86400000))
    : null;
  const shipAsap =
    pickedVendor != null && pickedVendor.leadTimeDays > Math.max(0, daysUntilArrival);

  /* ── Commit paths ── */
  /* `commitSimOnly` (the old "Just simulate" secondary button's
     handler) was retired 2026-07-22 along with the button itself.
     `onSimulateAdd` stays on the props interface — callers keep
     passing it — but the wizard's committed path is now Plot-only. */
  void onSimulateAdd;
  const commitVendor = () => {
    if (!pickedVendor || !step1Valid) return;
    /* Plot on the buyer-set delivery day at the MOQ-aware qty. mode is
       hard-coded to "needBy" — the wizard no longer offers an order-on
       vs need-by choice (Eli 2026-07-16). */
    const day = Math.max(0, daysUntilArrival);
    onPlotVendor(pickedVendor.vendorId, day, orderQty, { mode: "needBy" });
    onClose();
  };

  return (
    /* Layout: sticky HEADER (title + step dots) + scrollable MIDDLE
       (per-step content) + sticky FOOTER (per-step CTAs). Sticky
       positioning inside the outer modal's scroll container keeps the
       "what wizard am I in" + primary actions visible even on short
       viewports — the fix for "the fonts are big and the header + Plot
       button are hidden as I scroll". */
    <div className="relative w-full" style={{ fontFamily: FONT }}>
      {/* ── STICKY HEADER — title + connected stepper (buyer
             2026-07-19: "make 2-stepper modal, need to have a
             connected stepper user needs to feel connected"). Two
             circles joined by a bar that fills as the buyer advances
             — same visual grammar the app uses for other multi-step
             flows so this reads immediately as "step 1 of 2". ── */}
      <div className="sticky top-0 z-20 bg-white px-3 pt-3 pb-2.5 border-b border-slate-200/70">
        <div className="flex items-start gap-2">
          <div
            className="flex size-7 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: "#ECFDF5" }}
          >
            <ArrowUp className="size-3.5" style={{ color: "#059669" }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[12px] 2xl:text-[13px] font-semibold text-slate-800">
                {isEdit ? "Edit simulation" : "Simulate supply"}
              </p>
              {isEdit ? (
                <span
                  className="inline-flex items-center rounded-md border px-1.5 py-px text-[9px] 2xl:text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: "#EFF6FF",
                    color: "#1D4ED8",
                    borderColor: "#BFDBFE",
                    lineHeight: 1.3,
                  }}
                >
                  Editing
                </span>
              ) : null}
            </div>
            <p className="text-[10px] 2xl:text-[11px] text-slate-500">
              {isEdit
                ? "Update this plotted supply's quantity, date, or vendor."
                : "Plot expected delivery of incoming stock, real or hypothetical."}
            </p>
          </div>
        </div>
        {/* Tab-style stepper — two labels sharing a subtle bottom
            border. The current step gets a bolder emerald underline
            (2 px) that sits ON the border, so the transition reads as
            a tab-active state, not a separate stepper strip. Feels
            integrated with the modal chrome, no heavy dots or long
            connector bar (buyer 2026-07-19: "smaller version that
            can feel connected with this modal"). */}
        <div className="mt-2 flex items-center gap-4 border-b border-slate-200 -mx-3 px-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            aria-current={step === 1 ? "step" : undefined}
            className={`relative -mb-px pb-1.5 pt-0.5 text-[11px] 2xl:text-[12px] font-semibold transition-colors cursor-pointer ${
              step === 1 ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <span className="mr-1 text-slate-400 tabular-nums">1</span>
            Details
            {step === 1 && (
              <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-t-full bg-emerald-500" />
            )}
          </button>
          <button
            type="button"
            onClick={() => step1Valid && setStep(2)}
            disabled={!step1Valid}
            aria-current={step === 2 ? "step" : undefined}
            title={step1Valid ? "Choose vendor" : "Complete Step 1 first"}
            className={`relative -mb-px pb-1.5 pt-0.5 text-[11px] 2xl:text-[12px] font-semibold transition-colors disabled:cursor-not-allowed enabled:cursor-pointer ${
              step === 2
                ? "text-slate-900"
                : step1Valid
                  ? "text-slate-400 hover:text-slate-600"
                  : "text-slate-300"
            }`}
          >
            <span className={`mr-1 tabular-nums ${step === 2 ? "text-slate-400" : "opacity-70"}`}>2</span>
            Vendor
            {step === 2 && (
              <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-t-full bg-emerald-500" />
            )}
          </button>
        </div>
      </div>

      {/* ── STEP CONTENT — one step at a time, no page scroll. ── */}
      <div className="px-3 py-3 space-y-3">
        {step === 1 && (
        <>
        <div>
          <label className="mb-1 block text-[11px] 2xl:text-[12px] font-medium text-slate-500">
            Expected delivery
          </label>
          <SystemDatePicker
            value={date}
            onChange={(iso) => {
              markDirty();
              setDate(iso || anchorDate);
            }}
            min={new Date(todayIso() + "T00:00:00")}
            placeholder="Pick a date"
            className="w-full"
          />
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[10px] 2xl:text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="inline size-3" />
              {daysUntilArrival === 0
                ? "Today"
                : daysUntilArrival === 1
                  ? "Tomorrow"
                  : daysUntilArrival > 0
                    ? `In ${daysUntilArrival} days`
                    : `${-daysUntilArrival} days ago`}
            </span>
            {pickedVendor && orderDateFromVendor && (
              <>
                <span className="text-slate-300">·</span>
                <span>
                  Order date{" "}
                  <span className="font-semibold text-slate-600">
                    {fmtShort(orderDateFromVendor)}
                  </span>
                  {shipAsap && (
                    <span className="ml-1 text-rose-600">· ship ASAP</span>
                  )}
                </span>
              </>
            )}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[11px] 2xl:text-[12px] font-medium text-slate-500">How much?</label>
            <div className="flex items-stretch gap-1.5">
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => {
                  markDirty();
                  setQty(e.target.value);
                }}
                placeholder="e.g. 50"
                autoFocus
                className="h-8 flex-1 rounded-md border border-input bg-transparent px-2.5 text-[11px] 2xl:text-[12px] outline-none transition-colors focus:border-[#0A77FF] focus:ring-1 focus:ring-ring/20"
                style={{ fontFamily: FONT, color: "hsl(var(--foreground))" }}
              />
              {compatibleUoms.length > 1 ? (
                /* shadcn Select — matches the "Records per page"
                   footer pattern (buyer 2026-07-19). Native <select>
                   rendered as an unstyled browser dropdown; shadcn
                   Select uses the same tokens as the rest of the app
                   with a proper chevron + checkmark. */
                <Select
                  value={uom}
                  onValueChange={(v) => {
                    markDirty();
                    setUom(v);
                  }}
                >
                  <SelectTrigger className="h-8 w-[110px] text-[11px] 2xl:text-[12px]">
                    <SelectValue placeholder={uom || item.baseUom}>
                      {uom || item.baseUom}
                    </SelectValue>
                  </SelectTrigger>
                  {/* Cap the UOM list at ~5 rows visible so it doesn't
                      stretch to a 12-item column that overflows the
                      viewport (buyer 2026-07-19: "reduce the UOM").
                      `z-[70]` puts it ABOVE the wizard modal wrapper
                      (which is z-[61]) so the popup renders in front,
                      not tucked behind the modal's footer. */}
                  <SelectContent className="max-h-[200px] overflow-y-auto z-[70]">
                    {compatibleUoms.map((u) => (
                      <SelectItem key={u.name} value={u.name} className="text-[11px] 2xl:text-[12px]">
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span
                  className="inline-flex h-8 items-center rounded-md border border-input bg-slate-50/60 px-2 text-[11px] 2xl:text-[12px]"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                >
                  {item.baseUom}
                </span>
              )}
            </div>
            {uom !== item.baseUom && qtyNum > 0 && Number.isFinite(qtyInBaseUom) && (
              <p className="mt-1 text-[9.5px] 2xl:text-[10.5px] text-slate-400">
                = {qtyInBaseUom.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.baseUom}
              </p>
            )}
            {/* Item-master reason chip — surfaces the RULE (with the
                actual target value inline so the buyer doesn't have
                to hover to see it), the ADJUSTMENTS as compact tokens,
                and the RESULT on the right. (i) hover still opens the
                full WhyThisQuantityBreakdown. */}
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10.5px] 2xl:text-[11px]">
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <span className="inline-flex min-w-0 flex-1 cursor-default items-center gap-1.5">
                    <Info className="size-3 shrink-0 text-slate-400" />
                    <span className="min-w-0 truncate text-slate-500">
                      <span className="font-medium text-slate-600">
                        Take to {qtyRec.targetLabel === "min" || qtyRec.targetLabel === "min (default)"
                          ? "min"
                          : qtyRec.targetLabel}
                      </span>
                      <span className="text-slate-400"> ({qtyRec.targetLevel} {item.baseUom})</span>
                      {qtyRec.rounded && (
                        <span className="text-slate-400"> · ×{qtyRec.multiplesOf}</span>
                      )}
                      {qtyRec.moqApplied && (
                        <span className="text-slate-400"> · MOQ {qtyRec.moq}</span>
                      )}
                      {qtyRec.capped && (
                        <span className="text-slate-400"> · capped {qtyRec.maxOrderQty}</span>
                      )}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={6}
                  className="z-[500] max-w-[280px] text-[11px]"
                >
                  <WhyThisQuantityBreakdown
                    qtyRec={qtyRec}
                    projectedOnHand={currentAtpProxy}
                    uom={item.baseUom}
                  />
                </TooltipContent>
              </Tooltip>
              <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                {qtyRec.qty} {item.baseUom}
              </span>
              {Number(qty) !== qtyRec.qty && qtyRec.qty > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    markDirty();
                    setUom(item.baseUom);
                    setQty(String(qtyRec.qty));
                  }}
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-[#0A77FF] transition-colors hover:bg-[#0A77FF]/[0.08]"
                >
                  Use suggested
                </button>
              )}
            </div>
            {/* Above-max warning — fires when the entered quantity
                would push the projected on-hand above the item's max
                level. Silent when the projected result stays at/below
                max (buyer feedback 2026-07-20: "if the entered
                quantity pushes stock above the max, it should warn").
                Uses `currentAtpProxy` (min - unitsToCover) as the
                pre-supply on-hand baseline — same anchor the item-
                master recommendation uses upstream. */}
            {qtyInBaseUom > 0 && currentAtpProxy + qtyInBaseUom > item.maxLevel && (
              <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10.5px] leading-snug text-amber-900 2xl:text-[11px]">
                <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-600" />
                <span>
                  This quantity would push projected stock above the item's max ({item.maxLevel} {item.baseUom}).
                </span>
              </div>
            )}
        </div>

        </>
        )}

        {/* ── STEP 2 — Vendor. Reached only when Step 1 inputs are
             valid (Next button + stepper are gated on step1Valid). ── */}
        {step === 2 && (() => {
          const allLate = vendorRows.length > 0 && vendorRows.every((r) => !r.fits);
          const closeAddOverlay = () => {
            setAddVendorOpen(false);
            setExtraVendorSearch("");
          };
          /* Substring filter for the popover's vendor list. Buyer typed
             query is trimmed + lowercased once so the map below stays
             cheap. */
          const q = extraVendorSearch.trim().toLowerCase();
          const filteredAddable = q
            ? addableVendors.filter((v) => v.vendorName.toLowerCase().includes(q))
            : addableVendors;
          /* Missing-your-vendor row — always sits as the LAST row of the
             vendor list (buyer 2026-07-22: "add this missing your vendor
             as 6th option"). Clicking it opens a floating dropdown OVERLAY
             above the row (upward `bottom-full`) rather than expanding
             the card, so the vendor list stays a static height and the
             overlay stays out of the layout flow. When a vendor is picked
             or created, it's inserted into vendorRows and this row shifts
             down to remain last. */
          const missingVendorRow = (
            <div className="relative">
              <button
                type="button"
                onClick={() => (addVendorOpen ? closeAddOverlay() : setAddVendorOpen(true))}
                aria-expanded={addVendorOpen}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors cursor-pointer hover:bg-slate-50"
              >
                {/* Empty slot mirrors the vendor-row radio dot so the
                    plus icon and text align with the rows above. */}
                <span className="size-3.5 shrink-0" aria-hidden />
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50">
                  <PlusIcon className="size-3.5 text-slate-400" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] 2xl:text-[12.5px] font-semibold text-slate-700">
                    Missing your vendor?
                  </p>
                  <p className="mt-0.5 text-[10.5px] 2xl:text-[11.5px] text-slate-500 leading-snug">
                    Attach an existing partner or create a new one.
                  </p>
                </div>
              </button>
              {addVendorOpen && (
                <>
                  {/* Outside-click backdrop — invisible, just captures
                      clicks outside the popover. Buyer 2026-08-03 asked
                      for shadow-only separation, no grey overlay. */}
                  <div
                    className="fixed inset-0 z-30"
                    onClick={closeAddOverlay}
                    aria-hidden
                  />
                  {/* Dropdown overlay — floats above the row (upward via
                      `bottom-full`) so it doesn't get clipped by the
                      sticky footer and doesn't push the vendor list
                      around. Heavier drop-shadow + explicit ring create
                      the visual break against the content behind. */}
                  <div className="absolute bottom-full left-0 right-0 mb-1 z-40 rounded-lg border border-slate-200 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.35),0_8px_16px_-8px_rgba(15,23,42,0.2)] ring-1 ring-slate-900/5 overflow-hidden">
                    {/* Search — filters `addableVendors` by substring on
                        the vendor name. Buyer 2026-08-03. Auto-focused on
                        open so the buyer can type immediately. */}
                    <div className="relative border-b border-slate-100">
                      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        autoFocus
                        value={extraVendorSearch}
                        onChange={(e) => setExtraVendorSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") closeAddOverlay();
                        }}
                        placeholder="Search vendors…"
                        className="h-8 w-full bg-white pl-8 pr-8 text-[11.5px] outline-none placeholder:text-slate-400"
                      />
                      {extraVendorSearch && (
                        <button
                          type="button"
                          onClick={() => setExtraVendorSearch("")}
                          className="absolute right-2 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                          aria-label="Clear search"
                        >
                          <XIcon className="size-3" />
                        </button>
                      )}
                    </div>
                    {filteredAddable.length > 0 ? (
                      <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100">
                        {filteredAddable.map((v) => (
                          <button
                            key={v.vendorId}
                            type="button"
                            onClick={() => handleAddVendor(v)}
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-slate-50 cursor-pointer"
                          >
                            <VendorLogo name={v.vendorName} id={v.vendorId} size={20} />
                            <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                              {v.vendorName}
                            </span>
                            {/* Lead time is shown as "0d lead" for every
                                unqualified vendor — until the buyer
                                qualifies the vendor for this item, we
                                don't know its real lead time here (buyer
                                2026-08-03). Matches the value the
                                popover will actually apply when the
                                vendor is picked. */}
                            <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                              0d lead
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="px-2.5 py-2 text-[10.5px] text-slate-500">
                        {q
                          ? `No vendors match "${extraVendorSearch}".`
                          : "No other existing partners to attach."}
                      </p>
                    )}
                    {/* "Create a new vendor" — plain link. Opens the
                        Partners creation flow in a new tab (buyer
                        2026-08-03: do not build a mini vendor-creation
                        inline). Whatever gets created there flows back
                        into the addable list on the next planner refresh. */}
                    <a
                      href="/partners?new=vendor"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-between gap-1.5 border-t border-slate-100 px-2.5 py-1.5 text-[11px] font-medium text-[#0A77FF] transition-colors hover:bg-blue-50/60 cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <PlusIcon className="size-3" /> Create a new vendor
                      </span>
                      <ExternalLink className="size-3 opacity-70" />
                    </a>
                  </div>
                </>
              )}
            </div>
          );
          if (vendorRows.length === 0) {
            return (
              <div>
                <div className="mb-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-500">
                  No qualified vendors for this item. Attach one below, or use{" "}
                  <span className="font-semibold text-slate-700">Just simulate</span>{" "}
                  for a pure what-if.
                </div>
                <div className="rounded-lg border border-slate-200">
                  {missingVendorRow}
                </div>
              </div>
            );
          }
          return (
            <div>
              <label className="mb-1 block text-[11px] 2xl:text-[12px] font-medium text-slate-500">
                Vendor
                <span className="ml-1 text-slate-400 font-normal">(optional — skip for a pure what-if)</span>
              </label>
              {allLate && (() => {
                /* Rewording + soonest-available action per Eli
                   2026-07-30: "there are no vendors who can hit your
                   first date... offer: use the soonest-available
                   vendor, or override with a chosen vendor". Any row
                   below can still be tapped to override manually. */
                const soonest = vendorRows.reduce((best, r) =>
                  best == null || r.v.leadTimeDays < best.v.leadTimeDays ? r : best,
                  null as (typeof vendorRows)[number] | null,
                );
                if (!soonest) return null;
                const soonestName = soonest.v.vendorName.split(" (")[0];
                return (
                  <div className="mb-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                    <p className="text-[11px] font-semibold text-amber-900 leading-snug">
                      There are no vendors who can hit your first date
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-amber-800">
                      Use the soonest-available vendor, or override by picking a vendor below.
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          markDirty();
                          setPickedVendor(soonest.v);
                          /* Push the date out to the earliest this
                             vendor CAN actually arrive so downstream
                             math (arrival day, projection) is right.
                             `daysUntilArrival` is derived from `date`,
                             so setting the ISO string here is enough. */
                          const d = new Date();
                          d.setDate(d.getDate() + soonest.v.leadTimeDays);
                          setDate(d.toISOString().split("T")[0]);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                      >
                        Use soonest — {soonestName} ({soonest.v.leadTimeDays}d)
                      </button>
                    </div>
                  </div>
                );
              })()}
              {/* Vendor list — no cap, no scroll (buyer 2026-07-22: "I
                  don't want this as a scroll… increase the height of
                  the modal"). Height grows with the number of vendors;
                  the "Missing your vendor" row always sits last. */}
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                {vendorRows.map(({ v, eff, moq, fits }) => {
                  const selected = pickedVendor?.vendorId === v.vendorId;
                  /* Ad-hoc vendors — created inline via the "Missing your
                     vendor?" flow — always show the Open Partners
                     affordance + configure copy on their card (buyer
                     2026-07-23: "always need to be available"). They're
                     tagged by the "adhoc-" vendorId prefix set in
                     handleCreateVendor, so the affordance persists across
                     re-renders, not just immediately after creation. */
                  const isAdhoc = v.vendorId.startsWith("adhoc-");
                  return (
                    <div
                      key={v.vendorId}
                      className={`relative w-full ${
                        selected ? "bg-[#EFF6FF]" : ""
                      }`}
                    >
                    <button
                      type="button"
                      onClick={() => {
                        markDirty();
                        setPickedVendor(selected ? null : v);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                        selected ? "" : "hover:bg-slate-50"
                      } ${isAdhoc ? "pr-24 2xl:pr-28" : ""}`}
                      title={
                        !fits
                          ? `Lead time exceeds the delivery date by ${v.leadTimeDays - Math.max(0, daysUntilArrival)}d — pick a vendor to override if you've confirmed they can expedite.`
                          : `Pick ${v.vendorName}`
                      }
                    >
                      {/* Radio-dot selection indicator so it's obvious which
                          row is picked without relying on the row tint alone. */}
                      <span
                        className={`flex size-3.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          selected ? "border-[#0A77FF]" : "border-slate-300"
                        }`}
                        aria-hidden
                      >
                        {selected && <span className="block size-1.5 rounded-full bg-[#0A77FF]" />}
                      </span>
                      <span className="shrink-0"><VendorLogo name={v.vendorName} id={v.vendorId} size={28} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[11.5px] 2xl:text-[12.5px] font-semibold text-slate-800">
                            {v.vendorName}
                          </span>
                          {v.primaryFlag && (
                            <span
                              className="inline-flex shrink-0 items-center rounded-md border px-1.5 py-[1px] font-semibold uppercase tracking-wide"
                              style={{
                                fontSize: "9px",
                                letterSpacing: "0.05em",
                                color: "#0A77FF",
                                backgroundColor: "#EFF6FF",
                                borderColor: "#BFDBFE",
                              }}
                            >
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] 2xl:text-[11.5px] tabular-nums">
                          <span className={fits ? "font-medium text-emerald-700" : "font-medium text-rose-600"}>
                            {v.leadTimeDays}d lead {fits ? "✓" : "✗"}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-500">${eff.toFixed(2)}/{item.baseUom}</span>
                          {moq > 0 && (
                            <>
                              <span className="text-slate-300">·</span>
                              {/* Buyer feedback 2026-07-20: MOQ is a
                                  single minimum. The former
                                  "MOQ 40–300" range conflated MOQ with
                                  the vendor's max order qty; drop the
                                  max (rare, low-signal in-context). */}
                              <span className="text-slate-500">MOQ {moq}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                    {isAdhoc && (
                      /* Ad-hoc vendor affordances (buyer 2026-07-23:
                         "always need to be available"): Open Partners
                         top-right + configure copy below. Persistent
                         while the vendor is ad-hoc — no auto-dismiss. */
                      <>
                        <a
                          href="/partners"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute right-3 top-2.5 inline-flex items-center gap-1 whitespace-nowrap text-[10.5px] font-semibold text-[#0A77FF] hover:underline"
                        >
                          Open Partners <ExternalLink className="size-2.5" />
                        </a>
                        <div className="flex items-center gap-1.5 px-3 pb-2 text-[10.5px] text-slate-500">
                          <Check className="size-3 shrink-0 text-emerald-600" />
                          <span className="min-w-0 flex-1 truncate">
                            Vendor created. Configure price, lead time &amp; UOM in Partners.
                          </span>
                        </div>
                      </>
                    )}
                    </div>
                  );
                })}
                {missingVendorRow}
              </div>
              {pickedVendor && orderQty > qtyInBaseUom && (
                <p className="mt-1.5 text-[10px] text-amber-700">
                  Order qty bumped to <span className="font-semibold">{orderQty} {item.baseUom}</span> to meet vendor MOQ / order multiples.
                </p>
              )}
            </div>
          );
        })()}

      </div>

      {/* ── STICKY FOOTER ── step-aware CTAs (buyer 2026-07-19).
             Step 1: Cancel · Next     Step 2: Back · Just simulate · Plot. */}
      <div className="sticky bottom-0 z-20 bg-white px-3 py-2 border-t border-slate-200/70">
        <div className="flex items-center justify-between gap-2">
          {step === 1 ? (
            <button
              type="button"
              onClick={onClose}
              className="h-7 rounded-md px-2.5 text-[11px] 2xl:text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-100"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] 2xl:text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-100"
            >
              <ChevronLeft className="size-3.5" />
              Back
            </button>
          )}
          <div className="flex items-center gap-1.5">
            {step === 1 ? (
              <button
                type="button"
                disabled={!step1Valid}
                onClick={() => setStep(2)}
                className="inline-flex h-7 items-center gap-1 rounded-md px-3 text-[11px] 2xl:text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: "#0A77FF" }}
                title={step1Valid ? "Choose a vendor" : "Enter a delivery date and quantity first"}
              >
                Next
                <ChevronRight className="size-3.5" />
              </button>
            ) : (
              /* "Just simulate" secondary retired 2026-07-22 — the
                 wizard's committed path is Plot with a vendor, so the
                 what-if-only shortcut was surface noise. */
              <button
                type="button"
                disabled={!step1Valid || !pickedVendor}
                onClick={commitVendor}
                className="inline-flex h-7 items-center gap-1 rounded-md px-3 text-[11px] 2xl:text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: "#0A77FF" }}
                title={pickedVendor ? undefined : "Pick a vendor to plot as a planned purchase order"}
              >
                Plot {pickedVendor ? orderQty : qtyInBaseUom} {item.baseUom}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Discard confirmation removed 2026-08-03 — buyer asked to close
          without ceremony. `DiscardConfirmCard` and its state hooks are
          left in the file (dead) so we can restore quickly if the ask
          changes; render block is gone. */}

      {/* Qualify-or-plan-only prompt — fires after picking an unqualified
          vendor from the Add-a-vendor popover. Hand-rolled overlay + card
          (not PriceWarningShell) so the backdrop and content both sit at
          `z-[400]` — the wizard host uses `z-[61]`, so a stock
          shadcn AlertDialog's `z-50` overlay would slip BEHIND the
          wizard and only dim the outer page (buyer 2026-08-03: "this
          overlay needs to on the entire page the modal will go behind
          the overlay"). */}
      {qualifyPrompt && (
        <>
          <div
            className="fixed inset-0 z-[400] bg-slate-900/45"
            onClick={() => setQualifyPrompt(null)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qualify-vendor-title"
            className="fixed left-1/2 top-1/2 z-[401] w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.35)]"
            style={{ fontFamily: FONT }}
          >
            {/* Blue-tinted header wash — mirrors OrderFlow's location-
                qualify chrome so both scope decisions read the same. */}
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{
                background:
                  "linear-gradient(180deg, #EFF6FF 0%, #F5F9FF 70%, transparent 100%)",
              }}
            >
              <div
                className="absolute left-1/2 top-0 h-[80px] w-[180px] -translate-x-1/2 rounded-full opacity-25 blur-[50px]"
                style={{ backgroundColor: "#0A77FF" }}
              />
              <div
                className="relative flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "#DBEAFE" }}
              >
                <PlusIcon className="h-8 w-8" style={{ color: "#0A77FF" }} />
              </div>
              <span
                className="mt-4 rounded-full px-3 py-1 text-[11px] uppercase"
                style={{
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  backgroundColor: "#DBEAFE",
                  color: "#0A77FF",
                }}
              >
                Qualify vendor
              </span>
            </div>

            <div className="flex flex-col items-center px-8 pb-8 text-center">
              <h2
                id="qualify-vendor-title"
                className="text-[18px] tracking-[-0.02em] text-slate-900"
                style={{ fontWeight: 600 }}
              >
                Qualify this vendor for this item?
              </h2>
              <p
                className="mt-2 max-w-[340px] text-[13px] text-slate-500"
                style={{ lineHeight: 1.65 }}
              >
                <span className="font-semibold text-slate-700">
                  {qualifyPrompt.vendorName}
                </span>{" "}
                isn't qualified for{" "}
                <span className="font-semibold text-slate-700">
                  {item?.itemCode ?? "this item"}
                </span>
                . Use it for this plan only, or qualify it on the vendor
                so future plans and POs can source from it too.
              </p>

              <button
                type="button"
                onClick={() => setQualifyPrompt(null)}
                className="mt-6 h-10 w-full rounded-lg bg-[#0A77FF] text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0866D8]"
              >
                Use for this plan only
              </button>
              <button
                type="button"
                onClick={() => {
                  setQualifiedVendorIds((prev) => {
                    const next = new Set(prev);
                    next.add(qualifyPrompt.vendorId);
                    return next;
                  });
                  setQualifyPrompt(null);
                }}
                className="mt-2 h-9 text-[12.5px] font-medium text-slate-500 transition-colors hover:text-slate-700"
              >
                Qualify on the vendor
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export default SupplyPlanWizard;

/** Shared confirm card used by the wizard's discard overlay (both the
 *  small-screen portal and the md+ in-place path render it) so the two
 *  can't drift. */
function DiscardConfirmCard({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  return (
    <div className="w-full max-w-[300px] rounded-lg bg-white p-3.5 shadow-xl">
      <p className="text-[13px] font-semibold text-slate-900">
        Discard your simulation?
      </p>
      <p className="mt-1 text-[11.5px] leading-snug text-slate-500">
        Any values you've entered will be lost.
      </p>
      <div className="mt-3 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onKeep}
          className="h-7 rounded-md px-2.5 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          Keep editing
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="h-7 rounded-md bg-rose-600 px-3 text-[11.5px] font-semibold text-white transition-colors hover:bg-rose-700"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
