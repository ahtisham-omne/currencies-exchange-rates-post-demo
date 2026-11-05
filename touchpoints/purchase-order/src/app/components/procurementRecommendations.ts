/* ═══════════════════════════════════════════════════════════════
   Procurement Planning — Recommendation engine (Phase 6 / Eli E11)
   ───────────────────────────────────────────────────────────────
   Shared helpers used by both:
     · the Sandbox modal (single-item planning workspace)
     · the batch Recommended POs surface on the Procurement Planning
       page (multi-item one-button generation)

   Two responsibilities live here:

     1. `snapQty()`      — bring a buyer-supplied qty into compliance
                           with item rules (MOQ / max order qty / order
                           multiples). Pure; reused by every row that
                           edits a qty.

     2. `buildRecommendations()` — for ONE planner item, derive the
                           minimum efficient set of proposed POs that
                           covers the projected deficit while
                           respecting item + vendor rules. Surfaces
                           cross-rule conflicts rather than silently
                           snapping past them.

   Originally lived inside PlannerSandboxModal.tsx. Lifted here so the
   batch "Recommend POs" surface on the All-Demand listing can drive
   the SAME math the Sandbox uses — single source of truth for what
   "the system would recommend" means.
   ═══════════════════════════════════════════════════════════════ */

import type {
  PlannerItem,
  PlannerDemandEvent,
  FutureIncomingEvent,
} from "./plannerData";
import { projectAtpCurve } from "../utils/projection";

/* ─────────────────────────── QTY SNAP ─────────────────────────── */

/** Snap a quantity to the nearest valid multiple ≥ MOQ, ≤ max. Returns
    both the snapped value and a human hint (e.g. "Snapped to multiple of
    12") so the caller can surface the correction inline. */
export function snapQty(
  raw: number,
  moq: number,
  maxOrderQty: number,
  multiples: number,
): { snapped: number; hint: string | null } {
  if (!Number.isFinite(raw) || raw <= 0) {
    return { snapped: moq, hint: `Set to MOQ ${moq}` };
  }
  let q = raw;
  let hint: string | null = null;
  if (q < moq) {
    q = moq;
    hint = `Below MOQ — bumped to ${moq}`;
  }
  if (q > maxOrderQty) {
    q = maxOrderQty;
    hint = `Above max — capped at ${maxOrderQty}`;
  }
  if (multiples > 1 && q % multiples !== 0) {
    const rounded = Math.round(q / multiples) * multiples;
    if (rounded !== raw) hint = `Snapped to multiple of ${multiples}`;
    q = rounded;
  }
  return { snapped: q, hint };
}

/* ─────────────────────────── CONFLICTS ─────────────────────────── */

/** A single conflict surfaced by the recommendation engine. The
    consuming surface renders one banner per conflict so the buyer can
    resolve them inline. Phase 6 / Eli E11: "do not silently snap past
    a true conflict — snapping is fine for MOQ/max within one vendor,
    but cross-rule conflicts get surfaced." */
export type RecommendationConflict =
  | { kind: "no-deficit"; message: string }
  | { kind: "no-qualified-vendors"; message: string }
  | {
      kind: "vendor-late";
      vendorNames: string[];
      firstDeficitDay: number;
      shortestLead: number;
      message: string;
    }
  | {
      kind: "moq-overshoot";
      vendorName: string;
      moq: number;
      gap: number;
      uom: string;
      message: string;
    }
  | {
      kind: "uncovered";
      remaining: number;
      uom: string;
      message: string;
    };

export interface Recommendation {
  vendorId: string;
  qty: number;
  arrivalDays: number;
}

/* ─────────────────────────── BUILD ─────────────────────────── */

/** Build the **minimum efficient set** of proposed POs that satisfies
    the item's projected deficit over the horizon while respecting:
      · item rules: MOQ, max order qty, order multiples
      · vendor rules: lead time, qualified status, rank-order preference
      · pricing rules: snap qty to the multiples Eli expects, defer
        cross-vendor pricing optimisation to a later phase
    Conflicts that can't be resolved by snapping (cross-rule conflicts)
    are returned alongside the recommendation list — never swallowed. */
export function buildRecommendations(
  item: PlannerItem,
  demandEvents: PlannerDemandEvent[],
  baselineIncoming: FutureIncomingEvent[],
  horizonDays: number,
): { recommendations: Recommendation[]; conflicts: RecommendationConflict[] } {
  if (item.qualifiedVendors.length === 0) {
    return {
      recommendations: [],
      conflicts: [
        {
          kind: "no-qualified-vendors",
          message:
            "No qualified vendors available for this item. Add one in Vendor management before recommending.",
        },
      ],
    };
  }

  /* Compute the baseline projection (no proposed POs). Iterate the
     curve day-by-day summing every deficit-triggered shortfall.
     Eli 2026-07-30 data-alignment: auto and simulate previously
     returned different totals (e.g. 69 vs 22) because auto walked
     the curve dip-by-dip while simulate took a single max-deficit.
     The single-worst-dip approach undercounts when the curve dips
     multiple times before a shipment can restock — reconciling
     both surfaces on the day-by-day sum here so the numbers match
     `computeAutoSupplyEvents()` in `plannerRecommendationStore`. */
  const baseline = projectAtpCurve(
    item,
    demandEvents,
    baselineIncoming,
    horizonDays,
  );
  let totalDeficit = 0;
  let firstDeficitDay: number | null = null;
  const running = baseline.map((p) => p.atp);
  for (let i = 0; i < baseline.length; i++) {
    if (running[i] < item.minLevel) {
      const shortfall = Math.ceil(item.minLevel - running[i]);
      if (shortfall <= 0) continue;
      totalDeficit += shortfall;
      if (firstDeficitDay === null) firstDeficitDay = baseline[i].day;
      // Lift the running curve forward so we don't double-count a
      // dip that lasts across multiple days.
      for (let j = i; j < running.length; j++) running[j] += shortfall;
    }
  }
  if (totalDeficit <= 0) {
    return {
      recommendations: [],
      conflicts: [
        {
          kind: "no-deficit",
          message:
            "Projection stays above min through the horizon. No POs needed right now.",
        },
      ],
    };
  }

  const sortedVendors = [...item.qualifiedVendors].sort((a, b) => a.rank - b.rank);

  let remaining = totalDeficit;
  const recs: Recommendation[] = [];
  const conflicts: RecommendationConflict[] = [];
  const lateVendorNames: string[] = [];
  const lateVendorLeads: number[] = [];

  for (const vendor of sortedVendors) {
    if (remaining <= 0) break;

    /* Missing / undefined lead time → treat as 0 (instant) per Eli
       2026-07-30: "no lead time on a vendor → assume zero — better
       to assume you can get it right away than not at all". Type
       already declares `number`, but we normalize here so any
       loosely-shaped upstream vendor object is still safe. */
    const vendorLead = vendor.leadTimeDays ?? 0;
    if (firstDeficitDay !== null && vendorLead > firstDeficitDay) {
      lateVendorNames.push(vendor.vendorName);
      lateVendorLeads.push(vendorLead);
      /* Still allocate to this vendor — a partial / late fix is more
         useful than no recommendation at all. The conflict banner
         tells the buyer the fix arrives after the first violation. */
    }

    /* Cap to item.maxOrderQty first so the next steps work against the
       per-PO ceiling. */
    let qty = Math.min(remaining, item.maxOrderQty);

    /* Bump below-MOQ allocations up to MOQ. When that overshoots the
       remaining gap by a meaningful amount, surface a banner — Eli's
       rule: "snapping is fine for MOQ/max within one vendor" but the
       buyer should still see when the snap overshoots the need. */
    if (qty < item.moq) {
      if (item.moq - remaining > item.orderMultiples) {
        conflicts.push({
          kind: "moq-overshoot",
          vendorName: vendor.vendorName,
          moq: item.moq,
          gap: remaining,
          uom: item.baseUom,
          message: `Vendor ${vendor.vendorName.split(" (")[0]}: need ${remaining} ${item.baseUom}, MOQ is ${item.moq}. Recommendation rounds up — will overshoot by ${item.moq - remaining}.`,
        });
      }
      qty = item.moq;
    }

    /* Snap UP to the nearest multiple — never down (don't lose coverage). */
    if (item.orderMultiples > 1 && qty % item.orderMultiples !== 0) {
      qty = Math.ceil(qty / item.orderMultiples) * item.orderMultiples;
    }

    /* Final cap to max order qty. */
    qty = Math.min(qty, item.maxOrderQty);

    recs.push({
      vendorId: vendor.vendorId,
      qty,
      arrivalDays: vendorLead,
    });

    remaining -= qty;
  }

  if (remaining > 0) {
    conflicts.push({
      kind: "uncovered",
      remaining,
      uom: item.baseUom,
      message: `${remaining} ${item.baseUom} can't be covered within max order qty (${item.maxOrderQty}) across the ${sortedVendors.length} qualified vendor${sortedVendors.length === 1 ? "" : "s"}. Closest fit shown — bump qty manually or add another vendor.`,
    });
  }

  if (
    lateVendorNames.length === sortedVendors.length &&
    firstDeficitDay !== null
  ) {
    conflicts.push({
      kind: "vendor-late",
      vendorNames: lateVendorNames,
      firstDeficitDay,
      shortestLead: Math.min(...lateVendorLeads),
      message: `All qualified vendors deliver after first deficit on day +${firstDeficitDay} (fastest lead ${Math.min(...lateVendorLeads)}d). Recommendation is a partial fix only.`,
    });
  }

  return { recommendations: recs, conflicts };
}

/* ─────────────────────────── ROW-LEVEL HELPER ─────────────────────────── */

/** Single-number row-level summary of what `buildRecommendations` would
    propose for an item — the total qty across all vendor allocations,
    measured in the item's `baseUom`. Powers the All-Demand table's
    "Recommended order qty" column as decision-support: the buyer sees
    what the one-button generate would tee up before they commit.

    Returns 0 when there's no deficit, no qualified vendors, or the
    item is unknown. Callers using this for display should treat 0 as
    "no recommendation right now" (the projection already stays above
    min, or there's nothing the engine can do). */
export function recommendedTotalQtyForItem(
  item: PlannerItem,
  demandEvents: PlannerDemandEvent[],
  baselineIncoming: FutureIncomingEvent[],
  horizonDays: number,
): number {
  const { recommendations } = buildRecommendations(
    item,
    demandEvents,
    baselineIncoming,
    horizonDays,
  );
  return recommendations.reduce((sum, r) => sum + r.qty, 0);
}
