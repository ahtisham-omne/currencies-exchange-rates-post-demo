/**
 * Projection helpers for the Procurement Planner.
 *
 * Walks an item's Demand events and Future Incoming events day by day across
 * a horizon window, producing a Projected ATP curve that other surfaces
 * (Distress table severity badge, Cause modal chart, Sandbox live recompute)
 * all read from.
 *
 * Math (per Inventory v1.1, canonical):
 *
 *     Projected ATP at t = (On-Hand + Future Incoming up to t)
 *                          − Quarantined − Demand up to t
 *
 * Allocated is **not** subtracted — Allocated is a subset of Demand, and the
 * doc explicitly calls this out: ATP is the purchaser lens, not the
 * warehouse lens.
 */

import type {
  PlannerItem,
  PlannerDemandEvent,
  PlannerSeverity,
  FutureIncomingEvent,
} from "../components/plannerData";

/* ─────────────────────────── TYPES ─────────────────────────── */

export interface ProjectionPoint {
  /** Days from today. 0 = today, 1 = tomorrow, … */
  day: number;
  /** ISO yyyy-mm-dd date for this point. */
  date: string;
  /** Projected ATP at the end of this day (after all deltas for the day applied). */
  atp: number;
  /** Cumulative demand consumed by the end of this day. */
  demandSoFar: number;
  /** Cumulative future-incoming received by the end of this day. */
  incomingSoFar: number;
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Days between two ISO dates. Positive if `iso` is in the future. */
function daysFromToday(iso: string): number {
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = startOfToday();
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function isoForDay(day: number): string {
  const d = startOfToday();
  d.setDate(d.getDate() + day);
  // Local Y/M/D — toISOString() would convert to UTC and land a day early for
  // timezones ahead of UTC (e.g. the curve/axis date for "today" became yesterday).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ─────────────────────────── CORE PROJECTION ─────────────────────────── */

/**
 * Build the Projected ATP curve over `horizonDays` days starting today (day 0).
 *
 * Events on `day = 0` apply today. Events with a `requiredDate` / `expectedDate`
 * before today are folded into the day-0 starting balance (treating them as
 * "should already be reflected" — overdue demand still counts as outstanding,
 * overdue incoming still counts as receivable). This avoids dropping events
 * silently if the mock data drifts.
 *
 * @param item              The item being projected.
 * @param demandEvents      All demand events for this item (caller pre-filters by itemCode).
 * @param futureIncoming    All future incoming events for this item (caller pre-filters by itemCode).
 * @param horizonDays       How many days to project. Curve length = horizonDays + 1 (includes day 0).
 */
/**
 * Outstanding quantity for a demand event. Equals ordered qty minus anything
 * already shipped/fulfilled and anything cancelled — the units that still
 * need to come out of future inventory. Backwards-compatible: events that
 * don't carry `qtyShipped` / `qtyCancelled` (legacy mock rows) are treated
 * as fully outstanding so the projection doesn't regress.
 */
export function outstandingQty(ev: PlannerDemandEvent): number {
  const shipped = ev.qtyShipped ?? 0;
  const cancelled = ev.qtyCancelled ?? 0;
  return Math.max(0, ev.qty - shipped - cancelled);
}

export function projectAtpCurve(
  item: PlannerItem,
  demandEvents: PlannerDemandEvent[],
  futureIncoming: FutureIncomingEvent[],
  horizonDays: number,
): ProjectionPoint[] {
  // Bucket events by day (negative day → bucket into day 0).
  // Demand consumption uses *outstanding* qty so partially-shipped SOs and
  // cancelled lines don't double-count against future ATP.
  // LowStock events are reorder-point alerts (display-only signals shown
  // in the transaction stream); they don't represent real demand, so we
  // skip them here — including them would double-count the shortage the
  // baseline ATP already reflects via on-hand vs. min math.
  const demandByDay = new Map<number, number>();
  for (const ev of demandEvents) {
    if (ev.source === "LowStock") continue;
    const d = Math.max(0, daysFromToday(ev.requiredDate));
    const out = outstandingQty(ev);
    if (out <= 0) continue;
    demandByDay.set(d, (demandByDay.get(d) ?? 0) + out);
  }

  const incomingByDay = new Map<number, number>();
  for (const ev of futureIncoming) {
    const d = Math.max(0, daysFromToday(ev.expectedDate));
    incomingByDay.set(d, (incomingByDay.get(d) ?? 0) + ev.qty);
  }

  // Starting balance: On-Hand − Quarantined.
  let cumulativeDemand = 0;
  let cumulativeIncoming = 0;
  const startingBalance = item.onHand - item.quarantined;

  const curve: ProjectionPoint[] = [];
  for (let day = 0; day <= horizonDays; day++) {
    const todayDemand = demandByDay.get(day) ?? 0;
    const todayIncoming = incomingByDay.get(day) ?? 0;
    /* End-of-day rule (Eli 2026-07-16): a plotted supply on a day that
       also has consumption is assumed to land at 23:59, so that day's
       demand is realized against the day's OPENING ATP — before the
       supply arrives. Reasoning: a PO has a date but no time, so we
       assume worst case. The projected point for day D therefore
       reflects the trough (post-demand, pre-supply); today's incoming
       carries into day D+1's opening balance.
       (Exception noted in the spec — job creation events with a known
       completion time should use that hour rather than the 23:59
       default — is not implemented here because the item master
       doesn't yet carry a completion-time field on demand events.) */
    cumulativeDemand += todayDemand;
    const atp = startingBalance + cumulativeIncoming - cumulativeDemand;
    cumulativeIncoming += todayIncoming;
    curve.push({
      day,
      date: isoForDay(day),
      atp,
      demandSoFar: cumulativeDemand,
      incomingSoFar: cumulativeIncoming,
    });
  }
  return curve;
}

/* ─────────────────────────── DERIVED METRICS ─────────────────────────── */

/**
 * Classify a single ATP value against the item's min level.
 *   ATP < 0           → "negative"
 *   ATP = 0           → "at_zero"
 *   0 < ATP < min     → "below_min"
 *   ATP ≥ min         → "healthy"
 */
export function severityForAtp(
  atp: number,
  minLevel: number,
): PlannerSeverity {
  if (atp < 0) return "negative";
  if (atp === 0) return "at_zero";
  if (atp < minLevel) return "below_min";
  return "healthy";
}

const SEVERITY_RANK: Record<PlannerSeverity, number> = {
  healthy: 0,
  below_min: 1,
  at_zero: 2,
  negative: 3,
};

/**
 * Worst severity reached anywhere in the curve. Drives the Distress table
 * row badge.
 */
export function worstSeverityInHorizon(
  curve: ProjectionPoint[],
  minLevel: number,
): PlannerSeverity {
  let worst: PlannerSeverity = "healthy";
  for (const p of curve) {
    const s = severityForAtp(p.atp, minLevel);
    if (SEVERITY_RANK[s] > SEVERITY_RANK[worst]) worst = s;
    // Early exit — can't get worse than negative.
    if (worst === "negative") break;
  }
  return worst;
}

/**
 * ISO date when the curve first crosses **below min** (or null if it never does
 * within the horizon). The Distress table shows this as "first violation date".
 */
export function firstViolationDate(
  curve: ProjectionPoint[],
  minLevel: number,
): string | null {
  for (const p of curve) {
    if (p.atp < minLevel) return p.date;
  }
  return null;
}

/**
 * Current ATP (the day-0 point of the curve). Convenience accessor so the
 * table doesn't need to know the curve shape.
 */
export function currentAtp(curve: ProjectionPoint[]): number {
  return curve.length > 0 ? curve[0].atp : 0;
}

/**
 * Pretty short label for severity, used by badges. Kept here so any surface
 * (table, modal, sandbox) renders identical strings.
 */
export function severityLabel(s: PlannerSeverity): string {
  switch (s) {
    case "healthy":
      return "Healthy";
    case "below_min":
      return "Below min";
    case "at_zero":
      return "At zero";
    case "negative":
      return "Negative";
  }
}

/* ─────────────────────────── EFFECTIVE PRICE ─────────────────────────── */

/**
 * Apply a vendor's pricing rules to its unit price for a given order qty.
 * Used by the Sandbox vendor picker (Phase 3) but defined here so anything
 * that displays "effective price" reads the same logic.
 *
 * Rules are applied in order; each works against the running price. Discount
 * = subtract; premium = add.
 *
 * Tiered rules (`tiers` + `conditionBasis`, mirroring the Partner Manager's
 * pricing rules) are CONDITIONAL on the order: the engine picks the highest
 * tier whose `minQty` threshold the order meets — measured in base units for
 * a "volume" rule, or in dollars of line value for a "value" rule. Below the
 * first threshold the rule contributes nothing (the discount/premium hasn't
 * been earned yet). Rules without tiers keep applying their flat `amount`.
 */
export function effectivePrice(
  unitPrice: number,
  rules: Array<{
    ruleType: "discount" | "premium";
    basis: "percent" | "absolute";
    amount: number;
    conditionBasis?: "volume" | "value";
    tiers?: Array<{ minQty: number; maxQty: number | null; rate: number }>;
  }>,
  orderQty: number,
): number {
  let price = unitPrice;
  for (const r of rules) {
    let delta: number;
    if (r.tiers && r.tiers.length > 0 && r.conditionBasis) {
      // Measure the order against the tier thresholds, then apply the deepest
      // tier the order qualifies for (highest minQty ≤ measure).
      const measure = r.conditionBasis === "value" ? orderQty * unitPrice : orderQty;
      let applicable: { minQty: number; maxQty: number | null; rate: number } | null = null;
      for (const t of r.tiers) {
        if (measure >= t.minQty && (applicable === null || t.minQty > applicable.minQty)) {
          applicable = t;
        }
      }
      delta = applicable ? price * applicable.rate : 0;
    } else {
      delta = r.basis === "percent" ? price * r.amount : r.amount;
    }
    price = r.ruleType === "discount" ? price - delta : price + delta;
  }
  return Math.max(0, price);
}
