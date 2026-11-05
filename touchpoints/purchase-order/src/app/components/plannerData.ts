/**
 * Procurement Planner — data layer
 *
 * Self-contained mock data for the Procurement Planner's Distress / Cause /
 * Sandbox views. Intentionally separate from PODemands.tsx (Demands tab) and
 * catalogData.ts (Create-PO catalogue) so the Planner can evolve without
 * touching either of those surfaces.
 *
 * Conventions (per spec):
 *  • Acquisition (Purchased / Manufactured, + an optional secondary
 *    make-or-buy method) is synthesized per item by getAcquisitionForItem
 *    (this mock has no real BOM / WO layer to derive it from).
 *  • Future Incoming is **derived** from the live poStore at render time,
 *    not stored on each item.
 *  • Demand events live in PLANNER_DEMAND_EVENTS — for v1 we mock these
 *    directly rather than reaching into PODemands.tsx's private state.
 */

import type { PurchaseOrderData } from "./poStore";
import { computeExpectedDeliveryDate } from "./poStore";
import { findPRIdByRequesterName } from "./prData";
import { SHOW_PURCHASE_REQUESTS_IN_PLANNER } from "./procurementPlanningParams";

/* ─────────────────────────── TYPES ─────────────────────────── */

export type PlannerSeverity = "healthy" | "below_min" | "at_zero" | "negative";

export type DemandPriority = "Low" | "Standard" | "High";

export type DemandEventSource = "SO" | "Request" | "LowStock";

/* Real-world demand-event states a purchasing manager would recognise.
   The earlier vocabulary ("Cleared by Ops" / "Pending Review") was
   misleading — no ERP carries those values. Renamed to standard
   industry terms:
     · "Pending Approval"  — order/request awaiting sign-off
     · "Confirmed"         — order/request locked in, ready to consume
     · "Partially Shipped" — only on SOs that have shipped some units
                             but not the full ordered qty
   Shared across SO, Purchase Request and LowStock event sources.
   LowStock alerts use "Confirmed" because the reorder-point trigger
   is the "approved" state of the alert itself. */
export type DemandEventState =
  | "Pending Approval"
  | "Confirmed"
  | "Partially Shipped"
  /* "Draft" — a tentative sales order not yet firmed. Excluded from the
     projection by default; the buyer opts it in from the gap graph to plan
     for it (point 14). */
  | "Draft";

export interface PlannerDemandEvent {
  id: string;
  itemCode: string;
  /** Ordered/requested quantity at the source. The projection math uses
      `outstanding = qty − (qtyShipped ?? 0) − (qtyCancelled ?? 0)` so an SO
      that's been partially shipped only consumes the remainder of future ATP. */
  qty: number;
  /** Units already shipped/fulfilled against this demand event. Optional —
      omit (or 0) when nothing has shipped yet. Used by the projection helpers
      to compute outstanding-only consumption. */
  qtyShipped?: number;
  /** Units explicitly cancelled against this demand event (customer reduced
      the order, internal cancel, etc). Optional. Subtracted alongside
      `qtyShipped` so the curve doesn't over-count cancelled units. */
  qtyCancelled?: number;
  requiredDate: string; // ISO yyyy-mm-dd — the date the demand must be satisfied
  source: DemandEventSource;
  sourceRef: string; // SO# or PR#
  customer?: string; // for SO
  requester?: string; // for Request / LowStock party label
  /** Free-text "why" — surfaced inline in the transaction stream so the
      buyer reads the reason without expanding any row. Optional; SOs
      rarely carry a reason, Requests almost always do, LowStock events
      use it for the reorder-point detail (e.g. "Below reorder point —
      40, need 5 more"). */
  reason?: string;
  priority: DemandPriority;
  state: DemandEventState;
}

/** One break in a tiered pricing rule — mirrors the Partner Manager's
    `TierData`. The threshold (`minQty`) is read in base units when the rule's
    `conditionBasis` is "volume", or in dollars of order value when "value". */
export interface PlannerPricingTier {
  /** Lower threshold the order must reach for this tier to apply. */
  minQty: number;
  /** Upper bound of the tier; null = open-ended (the top tier). */
  maxQty: number | null;
  /** Adjustment as a fraction of the line price (0.10 = 10%). */
  rate: number;
}

export interface PlannerPricingRule {
  ruleType: "discount" | "premium";
  basis: "percent" | "absolute";
  amount: number; // 0.05 = 5% discount; or absolute $ if basis=absolute
  description?: string;
  /** Human-facing rule name shown in the detail hover card (e.g. "Tiered
      Volume Discount"). Falls back to a type-derived label when absent. */
  ruleName?: string;
  /** What the tier thresholds are measured against. Present only on
      quantity/value-gated rules; absent rules apply on every order. */
  conditionBasis?: "volume" | "value";
  /** Tier ladder, sorted ascending by `minQty`. When present (with a
      `conditionBasis`), `effectivePrice` applies the tier matching the order;
      below the first threshold no adjustment applies. Absent → flat `amount`. */
  tiers?: PlannerPricingTier[];
  /** Longer "About this rule" copy for the detail hover card. */
  aboutText?: string;
}

export interface PlannerVendor {
  vendorId: string;
  vendorName: string;
  unitPrice: number;
  leadTimeDays: number;
  onTimeRating: number; // 0–100
  primaryFlag: boolean;
  rank: number; // 1 = best
  pricingRules: PlannerPricingRule[];
  /** Per-vendor procurement constraints (point 8 — "MOQ & multiples by
      vendor"). Optional on the hand-authored data; `vendorConstraints()`
      falls back to the item-level values when a vendor omits its own. */
  moq?: number;
  orderMultiples?: number;
  maxOrderQty?: number;
}

/* Item-library "PO Recommendation Rules" — the rule set at item
   level that the Auto dropdown fires. One rule per item; the buyer
   flips between them on the item card (or, for this mock, they're
   seeded per-item in `PLANNER_ITEMS`). Buyer feedback 2026-07-14:
   "the rules I shared trigger here, only one at a time from items". */
export type PORecommendationRule = "min" | "zero" | "disable";
export interface PORecommendationRuleMeta {
  key: PORecommendationRule;
  title: string;
  /** Long form — used by the item-library card. */
  subtitle: string;
  /** Short form — used by the Auto dropdown (planner sandbox). Buyer
      feedback 2026-07-14: dropdown copies were too heavy; the card
      already carries the full explanation. */
  shortSubtitle: string;
}
export const PO_RECOMMENDATION_RULES: Record<PORecommendationRule, PORecommendationRuleMeta> = {
  min: {
    key: "min",
    title: "Recommend when stock hits min. threshold",
    subtitle: "Triggers when available stock falls to or below the minimum threshold.",
    shortSubtitle: "Fires at the minimum stock level.",
  },
  zero: {
    key: "zero",
    title: "Recommend if stock falls below zero",
    subtitle: "Triggers when available stock falls below zero. Stock sitting at zero is normal, so it will not trigger.",
    shortSubtitle: "Fires only when stock goes negative.",
  },
  disable: {
    key: "disable",
    title: "Disable Purchase Order Recommendations",
    subtitle: "No recommendations. Monitor shortages and replenish manually.",
    shortSubtitle: "Never recommends — you'll plot orders yourself.",
  },
};

export interface PlannerItem {
  itemCode: string;
  itemName: string;
  itemImage: string;
  description: string;
  category: string;
  baseUom: string;
  purchaseUom: string;

  // Inventory snapshot (today)
  onHand: number;
  quarantined: number;

  // Item rules
  minLevel: number;
  maxLevel: number;

  // Procurement constraints
  moq: number;
  maxOrderQty: number;
  orderMultiples: number;

  /** PO Recommendation Rule from the item library — the rule that the
      Auto dropdown fires. Optional; if missing, defaults to "min"
      (Recommend when stock hits min threshold). */
  poRecommendationRule?: PORecommendationRule;

  // Governance
  purchasingOwner: string;
  // For "me mode" filter — true if the current user owns this item.
  // In real life this is computed from auth; for the mock we just flag a
  // subset directly.
  ownedByMe: boolean;

  // Vendor info (the primary; full qualified-vendor list lives below)
  primaryVendor: string;
  primaryVendorLeadDays: number;
  qualifiedVendors: PlannerVendor[];
}

/** Resolves an item's PO Recommendation Rule, defaulting to "min"
    when the item doesn't carry an explicit one. */
export function getItemPORecommendationRule(item: PlannerItem): PORecommendationRule {
  return item.poRecommendationRule ?? "min";
}

/* ── Acquisition method (synthesized) ──
   Real ERPs derive this from whether an item has a Bill of Materials / Work
   Order (Manufactured) or only purchase records (Purchased). This mock has no
   BOM/WO layer, so we synthesize a stable value per item — a primary method
   plus an optional secondary "make-or-buy" alternative — deterministic from
   the item code so it never shifts between renders. Drives the demand
   listing's Acquisition column + filter (#6 / #22). */
export type AcquisitionMethod = "Purchased" | "Manufactured";
export interface ItemAcquisition {
  primary: AcquisitionMethod;
  /** Optional secondary make-or-buy method (~30% of items are dual-sourced). */
  secondary?: AcquisitionMethod;
}
export function getAcquisitionForItem(item: PlannerItem): ItemAcquisition {
  let h = 0;
  for (let i = 0; i < item.itemCode.length; i++) {
    h = (h * 31 + item.itemCode.charCodeAt(i)) >>> 0;
  }
  const primary: AcquisitionMethod = h % 100 < 55 ? "Purchased" : "Manufactured";
  const secondary: AcquisitionMethod | undefined =
    h % 10 < 3 ? (primary === "Purchased" ? "Manufactured" : "Purchased") : undefined;
  return { primary, secondary };
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const addDays = (n: number): string => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  // Local Y/M/D — toISOString() would convert to UTC and shift seed dates a day
  // early for timezones ahead of UTC (must match isoFromDay / isoForDay).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ─────────────────────────── ITEMS ─────────────────────────── */

/**
 * Curated set of 10 items spanning every severity bucket so the Distress
 * table has visible variety on first load:
 *   • 2 healthy items (just appear with low severity / above min)
 *   • 3 below-min items
 *   • 2 at-zero items
 *   • 2 negative items
 *   • 1 recovers via in-flight PO
 *
 * Item codes overlap PODemands.tsx Low Stock fixtures so the data feels
 * familiar across surfaces, but the records here are independent — the
 * Planner owns them.
 */
export const PLANNER_ITEMS: PlannerItem[] = [
  /* ── Synthetic filter-coverage fixtures (generated) — see filter combos ── */
  {
    itemCode: "PL-BKZ1",
    itemName: "Braking Planning Part BKZ1",
    itemImage: "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=200",
    description: "Braking planning fixture — synthetic demo item for filter coverage",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    /* Hero demo item — starts HEALTHY (above min, headroom to max) so the
       30-day projection walks through every band: healthy → below-max →
       below-min → below-zero, with PO events pulling it back up. Lets the
       transaction table showcase all four band stripes + every crossing
       annotation. Item-library rule: min-threshold (default). */
    onHand: 55,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    poRecommendationRule: "min",
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    /* Hero demo vendors — deliberately mixed. Acme + Globex have short
       lead times that can hit most shortfalls (on-time); Stark + Wayne
       have long lead times that WILL be late for early shortfalls, so
       the review modal shows the multi-vendor "some late, some on-time"
       case out of the box. Small per-vendor maxOrderQty forces the
       auto-recommender to split a single shortfall across multiple
       vendors instead of consolidating into one card (buyer 2026-07-23:
       "show more vendors, some late, some on time"). */
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [], maxOrderQty: 25 },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [], maxOrderQty: 20 },
      { vendorId: "v-stark", vendorName: "Stark Industries (SI)", unitPrice: 145, leadTimeDays: 14, onTimeRating: 82, primaryFlag: false, rank: 3, pricingRules: [], maxOrderQty: 30 },
      { vendorId: "v-wayne", vendorName: "Wayne Enterprises (WE)", unitPrice: 155, leadTimeDays: 21, onTimeRating: 78, primaryFlag: false, rank: 4, pricingRules: [], maxOrderQty: 40 },
    ],
  },
  {
    itemCode: "PL-BKZ2",
    itemName: "Braking Planning Part BKZ2",
    itemImage: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200",
    description: "Braking planning fixture — synthetic demo item for filter coverage",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: -8,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-BKZ3",
    itemName: "Braking Planning Part BKZ3",
    itemImage: "https://images.unsplash.com/photo-1625465329054-dde00a74a072?w=200",
    description: "Braking planning fixture — synthetic demo item for filter coverage",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: -8,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-BKZ4",
    itemName: "Braking Planning Part BKZ4",
    itemImage: "https://images.unsplash.com/photo-1635179885954-c778885a1197?w=200",
    description: "Braking planning fixture — synthetic demo item for filter coverage",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: -8,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Fatima Zahra",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-BKN1",
    itemName: "Braking Planning Part BKN1",
    itemImage: "https://images.unsplash.com/photo-1658825959612-8f4bce484393?w=200",
    description: "Braking planning fixture — synthetic demo item for filter coverage",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 10,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Omar Malik",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-BKN2",
    itemName: "Braking Planning Part BKN2",
    itemImage: "https://images.unsplash.com/photo-1720670996738-f8d12d3aba17?w=200",
    description: "Braking planning fixture — synthetic demo item for filter coverage",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 10,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Aisha Khan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-BKN3",
    itemName: "Braking Planning Part BKN3",
    itemImage: "https://images.unsplash.com/photo-1721048379815-751e1c6a748a?w=200",
    description: "Braking planning fixture — synthetic demo item for filter coverage",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 10,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Kamran Rizvi",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-BKN4",
    itemName: "Braking Planning Part BKN4",
    itemImage: "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?w=200",
    description: "Braking planning fixture — synthetic demo item for filter coverage",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 10,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Sara Ahmed",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-BKX1",
    itemName: "Braking Planning Part BKX1",
    itemImage: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=200",
    description: "Braking planning fixture — synthetic demo item for filter coverage",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 50,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-BKX2",
    itemName: "Braking Planning Part BKX2",
    itemImage: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200",
    description: "Braking planning fixture — overstock at ~30% over max (mild noise; filtered out by the default 50% threshold, kept when threshold is Any).",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    /* Above-max seed (Nophil 2026-07-14): onHand 104 vs maxLevel 80
       → +24 units = +30 % over max. This is the "mild overstock" case
       — passes the raw Above-max pill (mode = Any) but gets filtered
       out at the default 50 % threshold. Useful for verifying that
       the threshold gates by percentage. */
    onHand: 104,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-DRZ1",
    itemName: "Drivetrain Planning Part DRZ1",
    itemImage: "https://images.unsplash.com/photo-1486754735734-325b5831c3ad?w=200",
    description: "Drivetrain planning fixture — synthetic demo item for filter coverage",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: -8,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Bilal Hassan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-DRZ2",
    itemName: "Drivetrain Planning Part DRZ2",
    itemImage: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=200",
    description: "Drivetrain planning fixture — synthetic demo item for filter coverage",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: -8,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-DRN1",
    itemName: "Drivetrain Planning Part DRN1",
    itemImage: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=200",
    description: "Drivetrain planning fixture — overstock at ~60% over max (materially over; passes 50% threshold, fails 100%).",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    /* Above-max seed (Nophil 2026-07-14): onHand 128 vs maxLevel 80
       → +48 units = +60 % over max. "Moderate overstock" case —
       passes at 50 % but fails when the buyer dials the threshold
       up to 100 %. Simulates a scenario where an SO was cancelled
       after the buyer had already committed a receipt. */
    onHand: 128,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-DRN2",
    itemName: "Drivetrain Planning Part DRN2",
    itemImage: "https://images.unsplash.com/photo-1517524285303-d6fc683dddf8?w=200",
    description: "Drivetrain planning fixture — synthetic demo item for filter coverage",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 10,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Zeeshan Ali",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-DRN3",
    itemName: "Drivetrain Planning Part DRN3",
    itemImage: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=200",
    description: "Drivetrain planning fixture — synthetic demo item for filter coverage",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 10,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-DRN4",
    itemName: "Drivetrain Planning Part DRN4",
    itemImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=200",
    description: "Drivetrain planning fixture — severe overstock at ~200% over max (triple the ceiling; passes every threshold).",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    /* Above-max seed (Nophil 2026-07-14): onHand 240 vs maxLevel 80
       → +160 units = +200 % over max. "Severe overstock" case —
       triple the ceiling, passes at 50 %, 100 %, even 500 %. This
       is the "BOM changed / demand dried up" scenario where the
       buyer is now sitting on capital. */
    onHand: 240,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-DRN5",
    itemName: "Drivetrain Planning Part DRN5",
    itemImage: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=200",
    description: "Drivetrain planning fixture — synthetic demo item for filter coverage",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 10,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Iqra Fatima",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-DRX1",
    itemName: "Drivetrain Planning Part DRX1",
    itemImage: "https://images.unsplash.com/photo-1564912139097-6e35a037c77f?w=200",
    description: "Drivetrain planning fixture — synthetic demo item for filter coverage",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 50,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-DRX2",
    itemName: "Drivetrain Planning Part DRX2",
    itemImage: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=200",
    description: "Drivetrain planning fixture — synthetic demo item for filter coverage",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 50,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    /* Item-library rule: below-zero. Buyer feedback 2026-07-14 —
       distribute the 3 rules across different Areeb-owned items so
       the sandbox demonstrates each state. */
    poRecommendationRule: "zero",
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-DRX3",
    itemName: "Drivetrain Planning Part DRX3",
    itemImage: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=200",
    description: "Drivetrain planning fixture — synthetic demo item for filter coverage",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 50,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-ELZ1",
    itemName: "Electrical Planning Part ELZ1",
    itemImage: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=200",
    description: "Electrical planning fixture — synthetic demo item for filter coverage",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: -8,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-ELZ2",
    itemName: "Electrical Planning Part ELZ2",
    itemImage: "https://images.unsplash.com/photo-1583778176476-4a8b02b64e01?w=200",
    description: "Electrical planning fixture — synthetic demo item for filter coverage",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: -8,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-ELZ3",
    itemName: "Electrical Planning Part ELZ3",
    itemImage: "https://images.unsplash.com/photo-1590239481209-b99e795df500?w=200",
    description: "Electrical planning fixture — synthetic demo item for filter coverage",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: -8,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-ELZ4",
    itemName: "Electrical Planning Part ELZ4",
    itemImage: "https://images.unsplash.com/photo-1593941707882-a5bba53b0998?w=200",
    description: "Electrical planning fixture — synthetic demo item for filter coverage",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: -8,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-ELN1",
    itemName: "Electrical Planning Part ELN1",
    itemImage: "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=200",
    description: "Electrical planning fixture — synthetic demo item for filter coverage",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 10,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    /* Item-library rule: Disable PO Recommendations — buyer wants to
       monitor + replenish this SKU manually (per 2026-07-14 rule
       distribution across Areeb-owned items). */
    poRecommendationRule: "disable",
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-ELN2",
    itemName: "Electrical Planning Part ELN2",
    itemImage: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200",
    description: "Electrical planning fixture — synthetic demo item for filter coverage",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 10,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-ELN3",
    itemName: "Electrical Planning Part ELN3",
    itemImage: "https://images.unsplash.com/photo-1625465329054-dde00a74a072?w=200",
    description: "Electrical planning fixture — synthetic demo item for filter coverage",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 10,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-ELX1",
    itemName: "Electrical Planning Part ELX1",
    itemImage: "https://images.unsplash.com/photo-1635179885954-c778885a1197?w=200",
    description: "Electrical planning fixture — synthetic demo item for filter coverage",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 50,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-ELX2",
    itemName: "Electrical Planning Part ELX2",
    itemImage: "https://images.unsplash.com/photo-1658825959612-8f4bce484393?w=200",
    description: "Electrical planning fixture — synthetic demo item for filter coverage",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 50,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-ELX3",
    itemName: "Electrical Planning Part ELX3",
    itemImage: "https://images.unsplash.com/photo-1720670996738-f8d12d3aba17?w=200",
    description: "Electrical planning fixture — synthetic demo item for filter coverage",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 50,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-HYZ1",
    itemName: "Hydraulics Planning Part HYZ1",
    itemImage: "https://images.unsplash.com/photo-1721048379815-751e1c6a748a?w=200",
    description: "Hydraulics planning fixture — synthetic demo item for filter coverage",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: -8,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-HYZ2",
    itemName: "Hydraulics Planning Part HYZ2",
    itemImage: "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?w=200",
    description: "Hydraulics planning fixture — synthetic demo item for filter coverage",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: -8,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-HYZ3",
    itemName: "Hydraulics Planning Part HYZ3",
    itemImage: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=200",
    description: "Hydraulics planning fixture — synthetic demo item for filter coverage",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: -8,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-HYZ4",
    itemName: "Hydraulics Planning Part HYZ4",
    itemImage: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200",
    description: "Hydraulics planning fixture — synthetic demo item for filter coverage",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: -8,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-HYN1",
    itemName: "Hydraulics Planning Part HYN1",
    itemImage: "https://images.unsplash.com/photo-1486754735734-325b5831c3ad?w=200",
    description: "Hydraulics planning fixture — synthetic demo item for filter coverage",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 10,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-HYN2",
    itemName: "Hydraulics Planning Part HYN2",
    itemImage: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=200",
    description: "Hydraulics planning fixture — synthetic demo item for filter coverage",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 10,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-HYN3",
    itemName: "Hydraulics Planning Part HYN3",
    itemImage: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=200",
    description: "Hydraulics planning fixture — synthetic demo item for filter coverage",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 10,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-HYX1",
    itemName: "Hydraulics Planning Part HYX1",
    itemImage: "https://images.unsplash.com/photo-1517524285303-d6fc683dddf8?w=200",
    description: "Hydraulics planning fixture — synthetic demo item for filter coverage",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 50,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-HYX2",
    itemName: "Hydraulics Planning Part HYX2",
    itemImage: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=200",
    description: "Hydraulics planning fixture — synthetic demo item for filter coverage",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 50,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-HYX3",
    itemName: "Hydraulics Planning Part HYX3",
    itemImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=200",
    description: "Hydraulics planning fixture — synthetic demo item for filter coverage",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 50,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 500,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Acme Supply Co (AS)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-acme", vendorName: "Acme Supply Co (AS)", unitPrice: 120, leadTimeDays: 7, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-globex", vendorName: "Globex Industrial (GI)", unitPrice: 132, leadTimeDays: 4, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "HYD-4420-A1",
    itemName: "Hydraulic Pump A1",
    itemImage:
      "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=200",
    description: "Hydraulic pump assembly — 4420 series, A1 spec",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 12,
    quarantined: 2,
    minLevel: 20,
    maxLevel: 80,
    moq: 25,
    maxOrderQty: 200,
    orderMultiples: 5,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Bosch Rexroth (BR)",
    primaryVendorLeadDays: 9,
    qualifiedVendors: [
      {
        vendorId: "v-br",
        vendorName: "Bosch Rexroth (BR)",
        unitPrice: 245,
        leadTimeDays: 9,
        onTimeRating: 92,
        primaryFlag: true,
        rank: 1,
        pricingRules: [
          { ruleType: "discount", basis: "percent", amount: 0.04, description: "Volume ≥ 50", ruleName: "Tiered Volume Discount", conditionBasis: "volume", tiers: [{ minQty: 50, maxQty: 149, rate: 0.04 }, { minQty: 150, maxQty: null, rate: 0.07 }], aboutText: "A volume-based discount that deepens as the order grows — 4% once you reach 50 units, rising to 7% at 150 or more. Rewards consolidating demand onto this preferred vendor." },
        ],
      },
      {
        vendorId: "v-parker",
        vendorName: "Parker Hannifin (PH)",
        unitPrice: 268,
        leadTimeDays: 5,
        onTimeRating: 88,
        primaryFlag: false,
        rank: 2,
        pricingRules: [],
      },
    ],
  },
  {
    itemCode: "BFA-4210-R2",
    itemName: "Brake Friction Assembly R2",
    itemImage:
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=200",
    description: "Brake friction assembly — R2 spec, 4210 series",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 45,
    quarantined: 0,
    minLevel: 30,
    maxLevel: 120,
    moq: 40,
    maxOrderQty: 300,
    orderMultiples: 10,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Brembo SpA (BS)",
    primaryVendorLeadDays: 12,
    qualifiedVendors: [
      {
        vendorId: "v-brembo",
        vendorName: "Brembo SpA (BS)",
        unitPrice: 89,
        leadTimeDays: 12,
        onTimeRating: 95,
        primaryFlag: true,
        rank: 1,
        pricingRules: [
          { ruleType: "discount", basis: "percent", amount: 0.03, description: "Net 30 terms", ruleName: "Net 30 Term Discount", aboutText: "A standing 3% discount honored on every order settled on Net 30 payment terms with this vendor." },
        ],
      },
      {
        vendorId: "v-akebono",
        vendorName: "Akebono Brake (AB)",
        unitPrice: 84,
        leadTimeDays: 15,
        onTimeRating: 90,
        primaryFlag: false,
        rank: 2,
        pricingRules: [
          { ruleType: "discount", basis: "percent", amount: 0.07, description: "Volume tier", ruleName: "Tiered Volume Discount", conditionBasis: "volume", tiers: [{ minQty: 60, maxQty: 99, rate: 0.05 }, { minQty: 100, maxQty: null, rate: 0.08 }], aboutText: "A volume discount with two breaks: 5% from 60 units, deepening to 8% at 100 or more. Rewards larger consolidated orders." },
        ],
      },
    ],
  },
  {
    itemCode: "CLP-2290-M3",
    itemName: "Clutch Plate M3",
    itemImage:
      "https://images.unsplash.com/photo-1486754735734-325b5831c3ad?w=200",
    description: "Clutch plate — M3 spec, 2290 series",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 8,
    quarantined: 0,
    minLevel: 15,
    maxLevel: 60,
    moq: 20,
    maxOrderQty: 150,
    orderMultiples: 5,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Sachs Performance (SP)",
    primaryVendorLeadDays: 14,
    qualifiedVendors: [
      {
        vendorId: "v-sachs",
        vendorName: "Sachs Performance (SP)",
        unitPrice: 142,
        leadTimeDays: 14,
        onTimeRating: 87,
        primaryFlag: true,
        rank: 1,
        pricingRules: [],
      },
    ],
  },
  {
    itemCode: "AFE-5520-K1",
    itemName: "Air Filter Element K1",
    itemImage:
      "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=200",
    description: "Air filter element — K1 spec, heavy-duty",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "BOX",
    onHand: 0,
    quarantined: 0,
    minLevel: 50,
    maxLevel: 200,
    moq: 50,
    maxOrderQty: 500,
    orderMultiples: 25,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Mann+Hummel (MH)",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      {
        vendorId: "v-mann",
        vendorName: "Mann+Hummel (MH)",
        unitPrice: 24.5,
        leadTimeDays: 7,
        onTimeRating: 96,
        primaryFlag: true,
        rank: 1,
        pricingRules: [
          { ruleType: "discount", basis: "percent", amount: 0.06, description: "Annual contract", ruleName: "Annual Contract Discount", aboutText: "A negotiated 6% discount under the current annual purchasing contract. Applies to every qualifying order for the contract term." },
        ],
      },
      {
        vendorId: "v-donaldson",
        vendorName: "Donaldson Co (DC)",
        unitPrice: 27,
        leadTimeDays: 4,
        onTimeRating: 93,
        primaryFlag: false,
        rank: 2,
        pricingRules: [],
      },
    ],
  },
  {
    itemCode: "RDC-4450-CU",
    itemName: "Radiator Core CU",
    itemImage:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200",
    description: "Copper radiator core — 4450 series",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 22,
    quarantined: 3,
    minLevel: 18,
    maxLevel: 70,
    moq: 20,
    maxOrderQty: 200,
    orderMultiples: 5,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Denso Corp (DN)",
    primaryVendorLeadDays: 10,
    qualifiedVendors: [
      {
        vendorId: "v-denso",
        vendorName: "Denso Corp (DN)",
        unitPrice: 178,
        leadTimeDays: 10,
        onTimeRating: 94,
        primaryFlag: true,
        rank: 1,
        pricingRules: [],
      },
    ],
  },
  {
    itemCode: "CVJ-5590-ST",
    itemName: "CV Joint Standard ST",
    itemImage:
      "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=200",
    description: "Constant velocity joint — standard, 5590 series",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 4,
    quarantined: 0,
    minLevel: 25,
    maxLevel: 100,
    moq: 30,
    maxOrderQty: 250,
    orderMultiples: 10,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "GKN Driveline (GK)",
    primaryVendorLeadDays: 18,
    qualifiedVendors: [
      {
        vendorId: "v-gkn",
        vendorName: "GKN Driveline (GK)",
        unitPrice: 312,
        leadTimeDays: 18,
        onTimeRating: 89,
        primaryFlag: true,
        rank: 1,
        pricingRules: [
          { ruleType: "premium", basis: "percent", amount: 0.02, description: "Express handling", ruleName: "Express Handling Premium", aboutText: "A 2% surcharge covering expedited handling and priority production scheduling on this line." },
        ],
      },
      {
        vendorId: "v-nexteer",
        vendorName: "Nexteer Auto (NA)",
        unitPrice: 295,
        leadTimeDays: 22,
        onTimeRating: 85,
        primaryFlag: false,
        rank: 2,
        pricingRules: [],
      },
    ],
  },
  {
    itemCode: "BRG-7750-C3",
    itemName: "Bearing C3",
    itemImage:
      "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=200",
    description: "Precision bearing — C3 clearance, 7750 series",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 180,
    quarantined: 5,
    minLevel: 60,
    maxLevel: 240,
    moq: 50,
    maxOrderQty: 500,
    orderMultiples: 25,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "SKF Group (SKF)",
    primaryVendorLeadDays: 8,
    qualifiedVendors: [
      {
        vendorId: "v-skf",
        vendorName: "SKF Group (SKF)",
        unitPrice: 42,
        leadTimeDays: 8,
        onTimeRating: 97,
        primaryFlag: true,
        rank: 1,
        pricingRules: [],
      },
      {
        vendorId: "v-ntn",
        vendorName: "NTN Corp (NTN)",
        unitPrice: 39,
        leadTimeDays: 11,
        onTimeRating: 92,
        primaryFlag: false,
        rank: 2,
        pricingRules: [],
      },
    ],
  },
  {
    itemCode: "GSK-3305-R1",
    itemName: "Gasket R1",
    itemImage:
      "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=200",
    description: "Rubber gasket — R1 spec, 3305 series",
    category: "Hydraulics",
    baseUom: "EA",
    purchaseUom: "PACK",
    onHand: 28,
    quarantined: 0,
    minLevel: 40,
    maxLevel: 160,
    moq: 50,
    maxOrderQty: 400,
    orderMultiples: 25,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Federal-Mogul (FM)",
    primaryVendorLeadDays: 6,
    qualifiedVendors: [
      {
        vendorId: "v-fm",
        vendorName: "Federal-Mogul (FM)",
        unitPrice: 8.5,
        leadTimeDays: 6,
        onTimeRating: 94,
        primaryFlag: true,
        rank: 1,
        pricingRules: [],
      },
    ],
  },
  {
    itemCode: "FST-8810-SS",
    itemName: "Fastener Set SS",
    itemImage:
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=200",
    description: "Stainless steel fastener set — 8810 series",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "BOX",
    onHand: 320,
    quarantined: 0,
    minLevel: 100,
    maxLevel: 400,
    moq: 100,
    maxOrderQty: 1000,
    orderMultiples: 50,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Bossard Group (BG)",
    primaryVendorLeadDays: 5,
    qualifiedVendors: [
      {
        vendorId: "v-bossard",
        vendorName: "Bossard Group (BG)",
        unitPrice: 3.2,
        leadTimeDays: 5,
        onTimeRating: 96,
        primaryFlag: true,
        rank: 1,
        pricingRules: [],
      },
    ],
  },
  {
    itemCode: "ELC-1190-H2",
    itemName: "Electrical Connector H2",
    itemImage:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=200",
    description: "High-current electrical connector — H2 spec",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 15,
    quarantined: 0,
    minLevel: 30,
    maxLevel: 120,
    moq: 25,
    maxOrderQty: 250,
    orderMultiples: 5,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "TE Connectivity (TE)",
    primaryVendorLeadDays: 11,
    qualifiedVendors: [
      {
        vendorId: "v-te",
        vendorName: "TE Connectivity (TE)",
        unitPrice: 56,
        leadTimeDays: 11,
        onTimeRating: 91,
        primaryFlag: true,
        rank: 1,
        pricingRules: [
          { ruleType: "discount", basis: "percent", amount: 0.05, description: "Strategic partner", ruleName: "Strategic Partner Discount", aboutText: "A 5% partner discount extended under the strategic-supplier agreement, applied to all orders." },
        ],
      },
      {
        vendorId: "v-molex",
        vendorName: "Molex LLC (ML)",
        unitPrice: 62,
        leadTimeDays: 7,
        onTimeRating: 93,
        primaryFlag: false,
        rank: 2,
        pricingRules: [],
      },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
     Extended planner coverage — minimal-but-realistic registry
     entries for the 10 remaining `MOCK_DEMAND_ITEMS` (PODemands)
     items so every demand row has a projection, severity, and a
     working "Plan in sandbox" handoff. Data shape mirrors the
     records above; vendor lists are intentionally short (1–2
     vendors) since these are stub entries — extend when a specific
     planning workflow needs richer vendor metadata.
     ─────────────────────────────────────────────────────────────── */
  {
    itemCode: "667205-32-41",
    itemName: "Brake Caliper Assembly",
    itemImage: "https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?w=200",
    description: "Single-piston sliding-design brake caliper assembly",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 18,
    quarantined: 0,
    minLevel: 25,
    maxLevel: 90,
    moq: 20,
    maxOrderQty: 200,
    orderMultiples: 5,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Chrysler (Stellantis N.V.)",
    primaryVendorLeadDays: 9,
    qualifiedVendors: [
      { vendorId: "v-chrysler", vendorName: "Chrysler (Stellantis N.V.)", unitPrice: 245, leadTimeDays: 9, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-akebono",  vendorName: "Akebono Brake Industry",     unitPrice: 232, leadTimeDays: 14, onTimeRating: 86, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "608497-26-54",
    itemName: "Suspension Coil Spring",
    itemImage: "https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?w=200",
    description: "Variable-rate suspension coil spring",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 24,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 100,
    moq: 20,
    maxOrderQty: 250,
    orderMultiples: 5,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Lucid Motors",
    primaryVendorLeadDays: 18,
    qualifiedVendors: [
      { vendorId: "v-lucid", vendorName: "Lucid Motors", unitPrice: 124.5, leadTimeDays: 18, onTimeRating: 84, primaryFlag: true, rank: 1, pricingRules: [] },
    ],
  },
  {
    itemCode: "511564-21-08",
    itemName: "Wheel Bearing Hub",
    itemImage: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=200",
    description: "Sealed double-row wheel bearing hub",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 9,
    quarantined: 0,
    minLevel: 15,
    maxLevel: 60,
    moq: 12,
    maxOrderQty: 150,
    orderMultiples: 6,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Rivian Automotive",
    primaryVendorLeadDays: 13,
    qualifiedVendors: [
      { vendorId: "v-rivian", vendorName: "Rivian Automotive", unitPrice: 88.2, leadTimeDays: 13, onTimeRating: 87, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-skf",    vendorName: "SKF Group",         unitPrice: 92.0, leadTimeDays: 10, onTimeRating: 94, primaryFlag: false, rank: 2, pricingRules: [{ ruleType: "discount", basis: "percent", amount: 0.03, description: "Preferred rate", ruleName: "Preferred Vendor Discount", aboutText: "A standing 3% discount under the preferred-vendor agreement, applied to every order." }] },
    ],
  },
  {
    itemCode: "519574-21-08",
    itemName: "Ignition Coil Pack",
    itemImage: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=200",
    description: "Multi-cylinder direct ignition coil pack",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 35,
    quarantined: 1,
    minLevel: 20,
    maxLevel: 90,
    moq: 25,
    maxOrderQty: 200,
    orderMultiples: 5,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Toyota Technical Center (TTC)",
    primaryVendorLeadDays: 8,
    qualifiedVendors: [
      { vendorId: "v-toyota-ttc", vendorName: "Toyota Technical Center (TTC)", unitPrice: 64.3, leadTimeDays: 8,  onTimeRating: 91, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-denso",      vendorName: "Denso Corporation",              unitPrice: 67.0, leadTimeDays: 6, onTimeRating: 95, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PB-9921-TR",
    itemName: "Power Brake Booster",
    itemImage: "https://images.unsplash.com/photo-1564912139097-6e35a037c77f?w=200",
    description: "Vacuum-assisted power brake booster",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 5,
    quarantined: 0,
    minLevel: 15,
    maxLevel: 50,
    moq: 10,
    maxOrderQty: 100,
    orderMultiples: 2,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Nissan North America",
    primaryVendorLeadDays: 14,
    qualifiedVendors: [
      { vendorId: "v-nissan",     vendorName: "Nissan North America", unitPrice: 312.5, leadTimeDays: 14, onTimeRating: 89, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-bosch-auto", vendorName: "Bosch Mobility",         unitPrice: 298.0, leadTimeDays: 11, onTimeRating: 92, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "GT-7740-LX",
    itemName: "Gear Shift Lever Assembly",
    itemImage: "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=200",
    description: "Gear shift lever assembly — 7740 LX series",
    category: "Drivetrain",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 28,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 20,
    maxOrderQty: 200,
    orderMultiples: 4,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Ford Motor Company",
    primaryVendorLeadDays: 12,
    qualifiedVendors: [
      { vendorId: "v-ford-gt", vendorName: "Ford Motor Company", unitPrice: 72.95, leadTimeDays: 12, onTimeRating: 88, primaryFlag: true, rank: 1, pricingRules: [] },
    ],
  },
  {
    itemCode: "ALU-5580-T6",
    itemName: "Aluminum Extrusion Profile",
    itemImage: "https://images.unsplash.com/photo-1593941707882-a5bba53b0998?w=200",
    description: "T-Slot 40×40 mm 6061-T6 aluminum extrusion",
    category: "Hydraulics",
    baseUom: "BUNDLE",
    purchaseUom: "BUNDLE",
    onHand: 12,
    quarantined: 0,
    minLevel: 10,
    maxLevel: 50,
    moq: 8,
    maxOrderQty: 80,
    orderMultiples: 2,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "BMW of North America",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-bmw-alu",    vendorName: "BMW of North America",    unitPrice: 31.77, leadTimeDays: 7,  onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-misumi",     vendorName: "Misumi USA",              unitPrice: 29.5,  leadTimeDays: 10, onTimeRating: 93, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "MBP-14-M3",
    itemName: "MacBook Pro 14\" — M3 chip, 32GB RAM",
    itemImage: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=200",
    description: "Standard developer-issue laptop, M3 chip, 32 GB RAM",
    category: "Electrical",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 0,
    quarantined: 0,
    minLevel: 3,
    maxLevel: 12,
    moq: 1,
    maxOrderQty: 20,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Apple Inc.",
    primaryVendorLeadDays: 21,
    qualifiedVendors: [
      { vendorId: "v-apple", vendorName: "Apple Inc.", unitPrice: 2599, leadTimeDays: 21, onTimeRating: 97, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-cdw",   vendorName: "CDW",        unitPrice: 2649, leadTimeDays: 7,  onTimeRating: 95, primaryFlag: false, rank: 2, pricingRules: [{ ruleType: "discount", basis: "percent", amount: 0.04, description: "Education program", ruleName: "Education Discount", aboutText: "A 4% discount under the education-purchasing program, applied to every order." }] },
    ],
  },
  {
    itemCode: "FGM-ORG",
    itemName: "Figma Organization License",
    itemImage: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200",
    description: "Figma Organization tier — annual per-seat license",
    category: "Electrical",
    baseUom: "Seat",
    purchaseUom: "Seat",
    onHand: 0,
    quarantined: 0,
    minLevel: 5,
    maxLevel: 100,
    moq: 5,
    maxOrderQty: 200,
    orderMultiples: 1,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Figma, Inc.",
    primaryVendorLeadDays: 1,
    qualifiedVendors: [
      { vendorId: "v-figma", vendorName: "Figma, Inc.", unitPrice: 75, leadTimeDays: 1, onTimeRating: 99, primaryFlag: true, rank: 1, pricingRules: [] },
    ],
  },
  {
    itemCode: "SAF-GOG-Z87",
    itemName: "Industrial Safety Goggles",
    itemImage: "https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?w=200",
    description: "ANSI Z87.1 industrial safety goggles",
    category: "Braking",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 60,
    quarantined: 0,
    minLevel: 40,
    maxLevel: 200,
    moq: 24,
    maxOrderQty: 500,
    orderMultiples: 12,
    purchasingOwner: "Shehryar Hasan",
    ownedByMe: false,
    primaryVendor: "Honeywell",
    primaryVendorLeadDays: 5,
    qualifiedVendors: [
      { vendorId: "v-honeywell", vendorName: "Honeywell",                unitPrice: 12.5, leadTimeDays: 5,  onTimeRating: 96, primaryFlag: true, rank: 1, pricingRules: [{ ruleType: "discount", basis: "percent", amount: 0.05, description: "Volume ≥ 100", ruleName: "Tiered Volume Discount", conditionBasis: "volume", tiers: [{ minQty: 100, maxQty: 299, rate: 0.05 }, { minQty: 300, maxQty: null, rate: 0.08 }], aboutText: "A volume discount for bulk PPE buys: 5% from 100 units, rising to 8% at 300 or more." }] },
      { vendorId: "v-3m",        vendorName: "3M Personal Safety",         unitPrice: 14.0, leadTimeDays: 4, onTimeRating: 97, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  /* ── Suspension · Cooling System · Fuel Systems · Steering ──
     Small synthetic fixtures so the Configure Categories modal's new
     rows aren't dead ends when the buyer selects them in the scope
     filter. Same shape as the Braking / Drivetrain fixtures above. */
  {
    itemCode: "PL-SUS1",
    itemName: "Suspension Strut Assembly",
    itemImage: "https://images.unsplash.com/photo-1517524285303-d6fc683dddf8?w=200",
    description: "Front strut assembly with integrated spring seat",
    category: "Suspension",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 6,
    quarantined: 0,
    minLevel: 12,
    maxLevel: 48,
    moq: 4,
    maxOrderQty: 200,
    orderMultiples: 2,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Monroe",
    primaryVendorLeadDays: 8,
    qualifiedVendors: [
      { vendorId: "v-monroe", vendorName: "Monroe", unitPrice: 185, leadTimeDays: 8, onTimeRating: 92, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-kyb", vendorName: "KYB", unitPrice: 172, leadTimeDays: 10, onTimeRating: 88, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-SUS2",
    itemName: "Lower Control Arm",
    itemImage: "https://images.unsplash.com/photo-1517524285303-d6fc683dddf8?w=200",
    description: "Forged steel lower control arm with pressed ball joint",
    category: "Suspension",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 22,
    quarantined: 0,
    minLevel: 15,
    maxLevel: 60,
    moq: 5,
    maxOrderQty: 250,
    orderMultiples: 1,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Moog",
    primaryVendorLeadDays: 6,
    qualifiedVendors: [
      { vendorId: "v-moog", vendorName: "Moog", unitPrice: 74, leadTimeDays: 6, onTimeRating: 94, primaryFlag: true, rank: 1, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-SUS3",
    itemName: "Rear Coil Spring Set",
    itemImage: "https://images.unsplash.com/photo-1517524285303-d6fc683dddf8?w=200",
    description: "Constant-rate rear coil spring, ride-tuned OE-equivalent",
    category: "Suspension",
    baseUom: "Set",
    purchaseUom: "Set",
    onHand: 3,
    quarantined: 0,
    minLevel: 8,
    maxLevel: 32,
    moq: 2,
    maxOrderQty: 100,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Eibach",
    primaryVendorLeadDays: 12,
    qualifiedVendors: [
      { vendorId: "v-eibach", vendorName: "Eibach", unitPrice: 220, leadTimeDays: 12, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-COL1",
    itemName: "Radiator Assembly",
    itemImage: "https://images.unsplash.com/photo-1583778176476-4a8b02b64e01?w=200",
    description: "Aluminum-core cross-flow radiator with integrated trans cooler",
    category: "Cooling System",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 4,
    quarantined: 0,
    minLevel: 10,
    maxLevel: 40,
    moq: 2,
    maxOrderQty: 150,
    orderMultiples: 1,
    purchasingOwner: "Faizan Khan",
    ownedByMe: false,
    primaryVendor: "Denso",
    primaryVendorLeadDays: 9,
    qualifiedVendors: [
      { vendorId: "v-denso", vendorName: "Denso", unitPrice: 245, leadTimeDays: 9, onTimeRating: 95, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-mahle", vendorName: "MAHLE Behr", unitPrice: 258, leadTimeDays: 11, onTimeRating: 91, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-COL2",
    itemName: "Electric Cooling Fan",
    itemImage: "https://images.unsplash.com/photo-1583778176476-4a8b02b64e01?w=200",
    description: "Dual-speed electric cooling fan assembly, shroud + motor",
    category: "Cooling System",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 14,
    quarantined: 0,
    minLevel: 12,
    maxLevel: 48,
    moq: 4,
    maxOrderQty: 200,
    orderMultiples: 2,
    purchasingOwner: "Faizan Khan",
    ownedByMe: false,
    primaryVendor: "Denso",
    primaryVendorLeadDays: 7,
    qualifiedVendors: [
      { vendorId: "v-denso", vendorName: "Denso", unitPrice: 132, leadTimeDays: 7, onTimeRating: 95, primaryFlag: true, rank: 1, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-COL3",
    itemName: "Water Pump Kit",
    itemImage: "https://images.unsplash.com/photo-1583778176476-4a8b02b64e01?w=200",
    description: "OE-spec water pump with gasket + hardware kit",
    category: "Cooling System",
    baseUom: "Kit",
    purchaseUom: "Kit",
    onHand: 8,
    quarantined: 0,
    minLevel: 8,
    maxLevel: 32,
    moq: 2,
    maxOrderQty: 100,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Gates",
    primaryVendorLeadDays: 5,
    qualifiedVendors: [
      { vendorId: "v-gates", vendorName: "Gates", unitPrice: 96, leadTimeDays: 5, onTimeRating: 96, primaryFlag: true, rank: 1, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-FUE1",
    itemName: "High-Pressure Fuel Pump",
    itemImage: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=200",
    description: "Direct-injection high-pressure fuel pump with mount",
    category: "Fuel Systems",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 2,
    quarantined: 0,
    minLevel: 6,
    maxLevel: 24,
    moq: 1,
    maxOrderQty: 80,
    orderMultiples: 1,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Bosch",
    primaryVendorLeadDays: 10,
    qualifiedVendors: [
      { vendorId: "v-bosch", vendorName: "Bosch", unitPrice: 385, leadTimeDays: 10, onTimeRating: 94, primaryFlag: true, rank: 1, pricingRules: [] },
      { vendorId: "v-delphi", vendorName: "Delphi", unitPrice: 362, leadTimeDays: 14, onTimeRating: 89, primaryFlag: false, rank: 2, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-FUE2",
    itemName: "Fuel Injector Set (4)",
    itemImage: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=200",
    description: "Matched-flow port fuel injectors, 4-cylinder set",
    category: "Fuel Systems",
    baseUom: "Set",
    purchaseUom: "Set",
    onHand: 12,
    quarantined: 0,
    minLevel: 10,
    maxLevel: 40,
    moq: 2,
    maxOrderQty: 100,
    orderMultiples: 1,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Bosch",
    primaryVendorLeadDays: 6,
    qualifiedVendors: [
      { vendorId: "v-bosch", vendorName: "Bosch", unitPrice: 210, leadTimeDays: 6, onTimeRating: 94, primaryFlag: true, rank: 1, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-FUE3",
    itemName: "In-Tank Fuel Pump Module",
    itemImage: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=200",
    description: "Complete in-tank fuel pump module with sending unit",
    category: "Fuel Systems",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 5,
    quarantined: 0,
    minLevel: 8,
    maxLevel: 32,
    moq: 2,
    maxOrderQty: 100,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Delphi",
    primaryVendorLeadDays: 8,
    qualifiedVendors: [
      { vendorId: "v-delphi", vendorName: "Delphi", unitPrice: 178, leadTimeDays: 8, onTimeRating: 89, primaryFlag: true, rank: 1, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-STE1",
    itemName: "Rack & Pinion Assembly",
    itemImage: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=200",
    description: "Remanufactured power rack and pinion assembly",
    category: "Steering",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 3,
    quarantined: 0,
    minLevel: 6,
    maxLevel: 24,
    moq: 1,
    maxOrderQty: 60,
    orderMultiples: 1,
    purchasingOwner: "Ahtsham Ahmad",
    ownedByMe: false,
    primaryVendor: "Cardone",
    primaryVendorLeadDays: 11,
    qualifiedVendors: [
      { vendorId: "v-cardone", vendorName: "Cardone", unitPrice: 340, leadTimeDays: 11, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-STE2",
    itemName: "Outer Tie Rod End",
    itemImage: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=200",
    description: "OE-spec outer tie rod end with dust boot",
    category: "Steering",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 24,
    quarantined: 0,
    minLevel: 20,
    maxLevel: 80,
    moq: 10,
    maxOrderQty: 300,
    orderMultiples: 2,
    purchasingOwner: "Nophil Anwer",
    ownedByMe: false,
    primaryVendor: "Moog",
    primaryVendorLeadDays: 4,
    qualifiedVendors: [
      { vendorId: "v-moog", vendorName: "Moog", unitPrice: 32, leadTimeDays: 4, onTimeRating: 94, primaryFlag: true, rank: 1, pricingRules: [] },
    ],
  },
  {
    itemCode: "PL-STE3",
    itemName: "Power Steering Pump",
    itemImage: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=200",
    description: "Hydraulic power steering pump with pulley",
    category: "Steering",
    baseUom: "EA",
    purchaseUom: "EA",
    onHand: 7,
    quarantined: 0,
    minLevel: 10,
    maxLevel: 40,
    moq: 2,
    maxOrderQty: 80,
    orderMultiples: 1,
    purchasingOwner: "Areeb Tanvir",
    ownedByMe: true,
    primaryVendor: "Cardone",
    primaryVendorLeadDays: 9,
    qualifiedVendors: [
      { vendorId: "v-cardone", vendorName: "Cardone", unitPrice: 195, leadTimeDays: 9, onTimeRating: 90, primaryFlag: true, rank: 1, pricingRules: [] },
    ],
  },
];

/* ─────────────────────────── CATEGORY CODES ─────────────────────────── */

/**
 * Stable ERP code per category — `C-2131`, `C-2132`, … assigned across the
 * sorted distinct category list of `PLANNER_ITEMS`. Categories surface to the
 * buyer as these codes app-wide (listing chips, the scope dropdown, the
 * manage-categories modal, the sandbox tab-group header) — only the displayed
 * label becomes the code; filtering / grouping still keys on the category NAME.
 *
 * Mirrors PODemands' `categoryCodeByName` (same source + alpha sort), so every
 * surface shows the same code for a given category.
 */
export const CATEGORY_CODE_BY_NAME: Record<string, string> = (() => {
  const names = Array.from(new Set(PLANNER_ITEMS.map((i) => i.category)))
    .filter(Boolean)
    .sort();
  const out: Record<string, string> = {};
  names.forEach((name, i) => {
    out[name] = `C-${2131 + i}`;
  });
  return out;
})();

/** Display label for a category: its ERP code, or the name if unmapped. */
export function categoryCodeFor(name: string): string {
  return CATEGORY_CODE_BY_NAME[name] ?? name;
}

/** Purchasing-owner name that represents the current logged-in buyer.
    Derived from the first `PLANNER_ITEMS` record flagged `ownedByMe: true`
    so there is one source of truth for "who is me" — same identity the
    Owner column, "You" badge, and Me/All filter already read. Consumed by
    procurementPlanningParams.ts to preselect the owner in the default
    scope (Nophil ask: "if I'm logged in, I'm the owner — preselect me"). */
export const MY_OWNER_NAME: string | null =
  PLANNER_ITEMS.find((i) => i.ownedByMe)?.purchasingOwner ?? null;

/* ─────────────────────────── DEMAND EVENTS ─────────────────────────── */

/**
 * Realistic outstanding-demand fixtures. Each event represents one SO line
 * or one user-request that needs the item by `requiredDate`. The projection
 * curve walks these day by day.
 *
 * Date offsets are relative to "today" so the demo always renders fresh —
 * `addDays(N)` returns an ISO date N days from now.
 */
export const PLANNER_DEMAND_EVENTS: PlannerDemandEvent[] = [
  /* ── HYD-4420-A1 ── 10 ATP (12-2), starts dipping fast.
     Mirrors PODemands fixture: 4 SO lines + 1 LowStock.
     (Purchase Request rows parked 2026-07-20 — see plannerParams flag.) */
  /* Longer SO refs sprinkled in for realistic wide-number rendering
     (buyer 2026-07-21: "increase the PO and SO number counts for some
     to 7 or 8 digits"). Also validates that the compressed Type/Source
     column doesn't clip when the reference stretches. */
  { id: "de-1", itemCode: "HYD-4420-A1", qty: 6, requiredDate: addDays(4), source: "SO", sourceRef: "SO-90210428", customer: "Acme Manufacturing", priority: "High", state: "Confirmed" },
  { id: "de-2", itemCode: "HYD-4420-A1", qty: 5, requiredDate: addDays(12), source: "SO", sourceRef: "SO-8319421", customer: "Pioneer Industries", priority: "Standard", state: "Pending Approval" },
  { id: "de-1b", itemCode: "HYD-4420-A1", qty: 3, requiredDate: addDays(18), source: "SO", sourceRef: "SO-10448", customer: "Northwest Fleet", priority: "Standard", state: "Pending Approval" },
  { id: "de-1c", itemCode: "HYD-4420-A1", qty: 8, requiredDate: addDays(2), source: "LowStock", sourceRef: "ROP-HYD-4420-A1", requester: "Reorder point", reason: "Below reorder point (15) — 8 ea short", priority: "High", state: "Confirmed" },
  { id: "de-1d", itemCode: "HYD-4420-A1", qty: 7, requiredDate: addDays(9), source: "SO", sourceRef: "SO-10455", customer: "Vertex Robotics", reason: "Draft order — pending customer PO", priority: "Standard", state: "Draft" },

  /* ── BFA-4210-R2 ── 45 ATP, dips below min (30) on day 14 */
  { id: "de-4", itemCode: "BFA-4210-R2", qty: 12, requiredDate: addDays(8), source: "SO", sourceRef: "SO-77104290", customer: "Westbound Logistics", priority: "Standard", state: "Confirmed" },
  { id: "de-5", itemCode: "BFA-4210-R2", qty: 10, requiredDate: addDays(14), source: "SO", sourceRef: "SO-10433", customer: "Acme Manufacturing", priority: "High", state: "Pending Approval" },
  { id: "de-5b", itemCode: "BFA-4210-R2", qty: 8, requiredDate: addDays(11), source: "SO", sourceRef: "SO-10456", customer: "Vertex Robotics", reason: "Draft order — quote stage", priority: "Standard", state: "Draft" },

  /* ── CLP-2290-M3 ── already below min (8 vs 15) */
  { id: "de-6", itemCode: "CLP-2290-M3", qty: 5, requiredDate: addDays(6), source: "SO", sourceRef: "SO-6821043", customer: "Pioneer Industries", priority: "High", state: "Confirmed" },
  { id: "de-7", itemCode: "CLP-2290-M3", qty: 6, requiredDate: addDays(18), source: "SO", sourceRef: "SO-10434", customer: "Northwest Fleet", priority: "Standard", state: "Confirmed" },
  { id: "de-6b", itemCode: "CLP-2290-M3", qty: 7, requiredDate: addDays(1), source: "LowStock", sourceRef: "ROP-CLP-2290-M3", requester: "Reorder point", reason: "Below reorder point (15) — 7 ea short", priority: "High", state: "Confirmed" },

  /* ── AFE-5520-K1 ── already at zero — worst-case demo
     de-9 partially shipped (20/50 done) — outstanding = 30. */
  { id: "de-8", itemCode: "AFE-5520-K1", qty: 30, requiredDate: addDays(10), source: "SO", sourceRef: "SO-55210432", customer: "Acme Manufacturing", priority: "High", state: "Confirmed" },
  { id: "de-9", itemCode: "AFE-5520-K1", qty: 50, qtyShipped: 20, requiredDate: addDays(20), source: "SO", sourceRef: "SO-10435", customer: "Westbound Logistics", priority: "Standard", state: "Partially Shipped" },
  { id: "de-8c", itemCode: "AFE-5520-K1", qty: 20, requiredDate: addDays(0), source: "LowStock", sourceRef: "ROP-AFE-5520-K1", requester: "Reorder point", reason: "At zero — 20 ea short of reorder point", priority: "High", state: "Confirmed" },

  /* ── RDC-4450-CU ── 19 ATP, barely above min (18) */
  { id: "de-10", itemCode: "RDC-4450-CU", qty: 8, requiredDate: addDays(15), source: "SO", sourceRef: "SO-10436", customer: "Northwest Fleet", priority: "Standard", state: "Confirmed" },

  /* ── CVJ-5590-ST ── deep negative (4 ATP vs 25 min) — full mix */
  { id: "de-12", itemCode: "CVJ-5590-ST", qty: 8, requiredDate: addDays(3), source: "SO", sourceRef: "SO-10437", customer: "Acme Manufacturing", priority: "High", state: "Confirmed" },
  { id: "de-13", itemCode: "CVJ-5590-ST", qty: 10, requiredDate: addDays(11), source: "SO", sourceRef: "SO-10439", customer: "Pioneer Industries", priority: "High", state: "Confirmed" },
  { id: "de-12c", itemCode: "CVJ-5590-ST", qty: 21, requiredDate: addDays(0), source: "LowStock", sourceRef: "ROP-CVJ-5590-ST", requester: "Reorder point", reason: "Below reorder point (25) — 21 ea short", priority: "High", state: "Confirmed" },

  /* ── BRG-7750-C3 ── healthy (180 vs 60 min); steady demand only.
     de-15 has 10 cancelled units — outstanding = 20, not 30. */
  { id: "de-14", itemCode: "BRG-7750-C3", qty: 25, requiredDate: addDays(9), source: "SO", sourceRef: "SO-42710438", customer: "Westbound Logistics", priority: "Standard", state: "Confirmed" },
  { id: "de-15", itemCode: "BRG-7750-C3", qty: 30, qtyCancelled: 10, requiredDate: addDays(24), source: "SO", sourceRef: "SO-10441", customer: "Northwest Fleet", priority: "Low", state: "Confirmed" },

  /* ── GSK-3305-R1 ── 28 ATP vs 40 min — below_min today */
  { id: "de-16", itemCode: "GSK-3305-R1", qty: 12, requiredDate: addDays(13), source: "SO", sourceRef: "SO-10440", customer: "Acme Manufacturing", priority: "Standard", state: "Confirmed" },
  { id: "de-16b", itemCode: "GSK-3305-R1", qty: 12, requiredDate: addDays(2), source: "LowStock", sourceRef: "ROP-GSK-3305-R1", requester: "Reorder point", reason: "Below reorder point (40) — 12 ea short", priority: "High", state: "Confirmed" },

  /* ── FST-8810-SS ── healthy 320 vs 100 */
  { id: "de-17", itemCode: "FST-8810-SS", qty: 60, requiredDate: addDays(7), source: "SO", sourceRef: "SO-10442", customer: "Pioneer Industries", priority: "Standard", state: "Confirmed" },
  { id: "de-18", itemCode: "FST-8810-SS", qty: 80, requiredDate: addDays(19), source: "SO", sourceRef: "SO-10444", customer: "Northwest Fleet", priority: "Low", state: "Confirmed" },

  /* ── ELC-1190-H2 ── 15 ATP vs 30 min — below_min today */
  { id: "de-19", itemCode: "ELC-1190-H2", qty: 7, requiredDate: addDays(5), source: "SO", sourceRef: "SO-10443", customer: "Acme Manufacturing", priority: "High", state: "Confirmed" },
  { id: "de-20", itemCode: "ELC-1190-H2", qty: 8, requiredDate: addDays(17), source: "SO", sourceRef: "SO-10446", customer: "Westbound Logistics", priority: "Standard", state: "Pending Approval" },
  { id: "de-19b", itemCode: "ELC-1190-H2", qty: 15, requiredDate: addDays(1), source: "LowStock", sourceRef: "ROP-ELC-1190-H2", requester: "Reorder point", reason: "Below reorder point (30) — 15 ea short", priority: "High", state: "Confirmed" },

  /* ── Past-due backorders ── confirmed demand whose required date has already
     passed and is still unshipped. The projection folds past-due demand into
     day 0, so each of these pulls the item's current ATP below zero — giving
     the "Below Zero" issue band a realistic population (items oversold against
     on-hand stock) instead of sitting empty. qty is set above each item's
     on-hand-minus-quarantined so the day-0 ATP is genuinely negative. */
  { id: "de-od-1", itemCode: "AFE-5520-K1", qty: 10, requiredDate: addDays(-2), source: "SO", sourceRef: "SO-10461", customer: "Acme Manufacturing", priority: "High", state: "Confirmed" },
  { id: "de-od-2", itemCode: "CVJ-5590-ST", qty: 12, requiredDate: addDays(-5), source: "SO", sourceRef: "SO-10462", customer: "Pioneer Industries", priority: "High", state: "Confirmed" },
  { id: "de-od-3", itemCode: "CLP-2290-M3", qty: 14, requiredDate: addDays(-7), source: "SO", sourceRef: "SO-10463", customer: "Northwest Fleet", priority: "High", state: "Confirmed" },
  { id: "de-od-4", itemCode: "PB-9921-TR", qty: 11, requiredDate: addDays(-3), source: "SO", sourceRef: "SO-10464", customer: "Westbound Logistics", priority: "High", state: "Confirmed" },
  { id: "de-od-5", itemCode: "511564-21-08", qty: 16, requiredDate: addDays(-10), source: "SO", sourceRef: "SO-10465", customer: "Apex Motorworks", priority: "High", state: "Confirmed" },
  { id: "de-od-6", itemCode: "MBP-14-M3", qty: 5, requiredDate: addDays(-4), source: "SO", sourceRef: "SO-10466", customer: "Summit Equipment", priority: "High", state: "Confirmed" },
];

/* ─────────────────────────── DEMAND PADDING ───────────────────────────
 * Every item should present a full demand picture in the planner — the buyer
 * expects to read the spread of sales orders, internal requests and the
 * reorder-point alert that drive the gap, not two stray rows. The
 * hand-authored events above define each item's early gap dynamics; this pads
 * any item up to MIN_DEMAND_ROWS with deterministic, source-mixed events
 * placed *later* in the horizon (day 16+) so the tuned early-shortfall timing
 * is preserved. Deterministic (seedFrom) — the list never reshuffles between
 * renders. Used by the Planner workspace only; the Distress table keeps its
 * curated raw set.
 */
const MIN_DEMAND_ROWS = 100;

/* Realistic customer / party pool — mixes OEM/tier-1 automotive names with
   in-house lines to match the reference transaction-table design's
   ("Nissan NA · Toyota · Denso · Bosch · Line 4") variety. Hashed
   deterministically per event, so an item's synthetic rows read the same
   way across renders. */
const SYNTH_CUSTOMERS = [
  "Nissan NA",
  "Toyota Motor Mfg",
  "Denso NA",
  "Bosch Powertrain",
  "Magna Powertrain",
  "Continental AG",
  "ZF Friedrichshafen",
  "Aisin Seiki",
  "Line 4",
  "Line 7 · Assembly",
  "Service Centre East",
  "Warranty Ops",
];
const SYNTH_REQUESTERS = ["Nophil Anwer", "Irtaza Abid", "Shehryar Hasan", "Eli Rosenbloom", "Areeb Tanvir"];
const SYNTH_REQUEST_REASONS = [
  "Maintenance kit refresh — scheduled PM",
  "Line changeover spares",
  "Service centre restock",
  "Field replacement run",
  "Warranty repair stock",
];

/**
 * Return this item's demand events, padded to at least MIN_DEMAND_ROWS with a
 * realistic SO / Request / LowStock mix. Hand-authored events come first and
 * are returned verbatim; synthetic rows are appended deterministically.
 */
export function getDemandEventsForItem(item: PlannerItem): PlannerDemandEvent[] {
  const base = PLANNER_DEMAND_EVENTS.filter((e) => e.itemCode === item.itemCode);
  if (base.length >= MIN_DEMAND_ROWS) return base.slice();

  const need = MIN_DEMAND_ROWS - base.length;
  const haveLow = base.some((e) => e.source === "LowStock");
  const haveReq = base.some((e) => e.source === "Request");
  const haveSO = base.some((e) => e.source === "SO");
  const atOrBelowMin = item.onHand - item.quarantined < item.minLevel;

  /* Source queue: guarantee at least one of each kind (a LowStock alert only
     when the item is genuinely at/below its floor — healthy items don't get a
     phantom reorder signal), then fill SO-heavy with a periodic Request.
     Purchase Request rows are parked from procurement (2026-07-20 flag);
     when the flag is off the queue skips Request entirely. */
  const queue: DemandEventSource[] = [];
  if (!haveLow && atOrBelowMin) queue.push("LowStock");
  if (SHOW_PURCHASE_REQUESTS_IN_PLANNER && !haveReq) queue.push("Request");
  if (!haveSO) queue.push("SO");
  let n = 0;
  while (queue.length < need) {
    if (SHOW_PURCHASE_REQUESTS_IN_PLANNER) {
      queue.push(n % 3 === 2 ? "Request" : "SO");
    } else {
      queue.push("SO");
    }
    n++;
  }
  const sources = queue.slice(0, need);

  const unit = Math.max(2, Math.round(item.minLevel / 5));
  const synth = sources.map((src, k): PlannerDemandEvent => {
    const seed = seedFrom(`${item.itemCode}::syn::${k}`);
    const id = `syn-${item.itemCode}-${k}`;
    if (src === "LowStock") {
      const short = Math.max(2, item.minLevel - (item.onHand - item.quarantined));
      return {
        id,
        itemCode: item.itemCode,
        qty: short,
        requiredDate: addDays(1 + (seed % 3)),
        source: "LowStock",
        sourceRef: `ROP-${item.itemCode}`,
        requester: "Reorder point",
        reason: `Below reorder point (${item.minLevel}) — ${short} ${item.baseUom} short`,
        priority: "High",
        state: "Confirmed",
      };
    }
    /* Spread firm demand across the full horizon with heavy density in the
       visible 30-day window so the projected-stock curve reads as a busy
       stock-chart line (many small daily up-and-downs). About 35% of the
       synthetic events land in day 1..29 (dense, one-per-day-ish), the rest
       spread across day 30..230 for downstream planning context. Hand-authored
       events already own day 0..15's shape so this weighting doesn't disturb
       tuned early-gap dynamics. */
    const denseCount = Math.round(need * 0.35);
    const day = k < denseCount
      ? 1 + Math.round((k / Math.max(1, denseCount)) * 28) + (seed % 2)
      : 30 + Math.round(((k - denseCount) / Math.max(1, need - denseCount)) * 200) + (seed % 5);
    /* ~30% of synth SOs / PRs get 7-8 digit refs (buyer 2026-07-21) so
       the Type/Source column visibly handles wide numbers on every
       page. Bucket by `seed % 10` so distribution is deterministic. */
    const isWideRef = seed % 10 < 3;
    if (src === "Request") {
      return {
        id,
        itemCode: item.itemCode,
        qty: Math.max(2, unit + (seed % 3)),
        requiredDate: addDays(day),
        source: "Request",
        sourceRef: isWideRef
          ? `PR-${8100000 + (seed % 900)}`
          : `PR-${1100 + (seed % 900)}`,
        requester: SYNTH_REQUESTERS[seed % SYNTH_REQUESTERS.length],
        reason: SYNTH_REQUEST_REASONS[seed % SYNTH_REQUEST_REASONS.length],
        priority: seed % 3 === 0 ? "High" : "Standard",
        state: seed % 2 === 0 ? "Confirmed" : "Pending Approval",
      };
    }
    return {
      id,
      itemCode: item.itemCode,
      qty: Math.max(2, unit + (seed % 5)),
      requiredDate: addDays(day),
      source: "SO",
      sourceRef: isWideRef
        ? `SO-${77000000 + (seed % 900)}`
        : `SO-${3200 + (seed % 900)}`,
      customer: SYNTH_CUSTOMERS[seed % SYNTH_CUSTOMERS.length],
      priority: seed % 4 === 0 ? "High" : seed % 4 === 1 ? "Low" : "Standard",
      state: seed % 3 === 0 ? "Pending Approval" : "Confirmed",
    };
  });

  return [...base, ...synth];
}

/* ─────────────────────────── FUTURE INCOMING (DERIVED) ─────────────────────────── */

export interface FutureIncomingEvent {
  poNumber: string;
  itemCode: string;
  qty: number;
  expectedDate: string;
  status: string;
  /** Optional vendor name for events not backed by a PO in the store
      (e.g. seeded inbound POs). When absent the stream resolves the
      vendor via `poByNumber`. */
  vendorName?: string;
  /** Who created the (draft) PO — sourced from `PurchaseOrderData.createdBy`.
      Surfaced as a person avatar on the gap graph's Draft-PO row so the buyer
      can see who drafted it. */
  createdBy?: string;
}

/**
 * Walk live `purchaseOrders` and pull every line for this item where the PO
 * is still in flight (Sent / Confirmed / Partially Received). Cancelled lines
 * are skipped. Status "Draft" is **excluded** — a draft hasn't promised
 * anything to a vendor yet.
 *
 * Overdue lines (dueDeliveryDate < today) are **skipped**: from the planner's
 * "what should I order now" lens they're unreliable supply — they either
 * arrive imminently (and show up via On-Hand once received) or get escalated
 * on a separate lane. Counting them as future supply would mask real
 * shortages.
 *
 * The caller passes the live POs (from getAllPOs() subscribed via the store)
 * so this stays reactive.
 */
export function getFutureIncomingForItem(
  itemCode: string,
  allPOs: PurchaseOrderData[],
): FutureIncomingEvent[] {
  const inFlightStatuses = new Set<PurchaseOrderData["status"]>([
    "Sent",
    "Confirmed",
    "Partially Received",
  ]);
  const todayMs = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const events: FutureIncomingEvent[] = [];
  for (const po of allPOs) {
    if (!inFlightStatuses.has(po.status)) continue;
    for (const line of po.lineItems) {
      if (line.cancelled) continue;
      if (line.itemNumber !== itemCode) continue;
      const remaining = line.quantity - (line.receivedQuantity ?? 0);
      if (remaining <= 0) continue;
      // Skip overdue arrivals — see jsdoc above.
      // Under the new date model, "expected arrival" prefers the derived
      // expectedDeliveryDate (promisedShipDate + transit) but falls back
      // to needByDate for lines the vendor hasn't committed to yet.
      const expectedIso =
        line.expectedDeliveryDate ||
        computeExpectedDeliveryDate(line.promisedShipDate, line.shipmentMethod) ||
        line.needByDate;
      const expected = new Date(expectedIso);
      expected.setHours(0, 0, 0, 0);
      if (expected.getTime() < todayMs) continue;
      events.push({
        poNumber: po.poNumber,
        itemCode: line.itemNumber,
        qty: remaining,
        expectedDate: expectedIso,
        status: po.status,
      });
    }
  }
  return events;
}

/* ─────────────────────────── SEEDED INCOMING (SAMPLE) ───────────────────────────
 * Store-derived incoming only exists for items that happen to have a live PO,
 * so most items would show ZERO supply — leaving the Supply/Fulfillment flow
 * unverifiable. Seed two deterministic in-flight POs per item so every item
 * (including any reached via search) presents visible supply alongside its
 * demand. Sized to the item, dated inside the horizon, and carrying a real
 * vendor name (they're not store-backed, so the stream resolves the vendor via
 * `vendorName`). Plain `PO-…` numbers with a distinct 8000-9999 range keep
 * them separate from real store PO numbers, so merging with
 * `getFutureIncomingForItem` never double-counts. */
export function getSeededIncomingForItem(item: PlannerItem): FutureIncomingEvent[] {
  const primary = item.qualifiedVendors.find((v) => v.primaryFlag) ?? item.qualifiedVendors[0];
  const secondary = item.qualifiedVendors.find((v) => !v.primaryFlag) ?? primary;
  const vendorPrimary = primary?.vendorName ?? "Grainger Industrial";
  const vendorSecondary = secondary?.vendorName ?? vendorPrimary;
  const unit = Math.max(4, Math.round(item.minLevel / 3));
  const seed = seedFrom(`${item.itemCode}::inc`);
  /* Tiered seeded-receipt count over the 30-day window:
       · Stock-out / distressed items (on-hand − quarantined < min):
         8 receipts — these items visibly need supply so multiple
         inbound POs read as "recovery is underway".
       · Healthy items: 5 receipts — enough to show a plausible
         supply cadence without cluttering the graph.
     Prior tuning seeded 6 for every item regardless of severity, which
     both over-saturated healthy items and under-supplied distressed ones. */
  const isDistressed = item.onHand - item.quarantined < item.minLevel;
  const anchorsDistressed = [3, 6, 10, 13, 16, 19, 23, 27];
  const anchorsHealthy = [4, 10, 16, 22, 27];
  const anchors = isDistressed ? anchorsDistressed : anchorsHealthy;
  const recvNo = 8000 + (seed % 1999);
  const statusCycle: Array<"Confirmed" | "Sent"> = ["Confirmed", "Sent"];
  return anchors.map((base, i) => ({
    /* Seeded incoming POs get a plain PO-NNNN number — the FUTURE-projection
       terminology fix (2026-07-10): no "Receiving" prefix, since a receiving
       is a past event and this table is a projection. */
    poNumber: `PO-${recvNo + i}`,
    itemCode: item.itemCode,
    /* Per-event qty ~3× the previous scaling (unit * 3) so each PO visibly
       lifts the curve back across a threshold — buyer feedback 2026-07-10:
       Eli couldn't see the "PO comes in and I'm back above minimum" story
       when supply bumps were tiny wiggles next to accumulating demand.
       Combined with the ~35 small daily demand events already in place,
       the curve now oscillates through all four bands (healthy → below-
       max → below-min → below-zero → recover) inside the 30-day window,
       so the transaction table's compliance-band stripes + crossing
       annotations get to demonstrate every case. */
    qty: Math.max(6, Math.round(unit * 3) + ((seed + i * 3) % 8)),
    expectedDate: addDays(base + ((seed + i) % 2)),
    status: statusCycle[i % statusCycle.length],
    vendorName: i % 2 === 0 ? vendorPrimary : vendorSecondary,
  }));
}

/**
 * DRAFT POs for this item — purchase orders the buyer has STARTED but not yet
 * sent (`status === "Draft"`). The committed-supply feed
 * (`getFutureIncomingForItem`) deliberately excludes these (a draft "hasn't
 * promised anything"), so the projected curve must NOT count them. But they're
 * useful context on the gap graph — "I already have a draft covering some of
 * this" — so the planner surfaces them as DISPLAY-ONLY hollow-green "Draft PO"
 * markers that don't lift the curve. Same line-level rules as committed
 * incoming: skip cancelled lines, nothing-remaining lines, and overdue dates.
 */
export function getDraftPOsForItem(
  itemCode: string,
  allPOs: PurchaseOrderData[],
): FutureIncomingEvent[] {
  const todayMs = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const events: FutureIncomingEvent[] = [];
  for (const po of allPOs) {
    if (po.status !== "Draft") continue;
    for (const line of po.lineItems) {
      if (line.cancelled) continue;
      if (line.itemNumber !== itemCode) continue;
      const remaining = line.quantity - (line.receivedQuantity ?? 0);
      if (remaining <= 0) continue;
      const expectedIso =
        line.expectedDeliveryDate ||
        computeExpectedDeliveryDate(line.promisedShipDate, line.shipmentMethod) ||
        line.needByDate;
      const expected = new Date(expectedIso);
      expected.setHours(0, 0, 0, 0);
      if (expected.getTime() < todayMs) continue;
      events.push({
        poNumber: po.poNumber,
        itemCode: line.itemNumber,
        qty: remaining,
        expectedDate: expectedIso,
        status: "Draft",
        vendorName: po.vendor?.name,
        createdBy: po.createdBy,
      });
    }
  }
  return events;
}

/* ─────────────────────────── SEEDED DRAFT (SAMPLE) ───────────────────────────
 * Real draft POs rarely reference a given planner item, so most items would
 * show none. Seed ONE deterministic draft PO per item — dated inside the
 * horizon, sized to the item, carrying a real vendor — so the "Draft PO" marker
 * is verifiable on every item (mirrors getSeededIncomingForItem). The distinct
 * `DRAFT-PO-…` number keeps it from colliding with real / seeded-incoming POs. */
export function getSeededDraftPOForItem(item: PlannerItem): FutureIncomingEvent[] {
  const primary = item.qualifiedVendors.find((v) => v.primaryFlag) ?? item.qualifiedVendors[0];
  const secondary = item.qualifiedVendors.find((v) => !v.primaryFlag) ?? primary;
  const vendorPrimary = primary?.vendorName ?? "Grainger Industrial";
  const vendorSecondary = secondary?.vendorName ?? vendorPrimary;
  const seed = seedFrom(`${item.itemCode}::draft`);
  const unit = Math.max(4, Math.round(item.minLevel / 3));
  /* Deterministic creator so the "created by" avatar is stable per item. */
  const DRAFT_CREATORS = [
    "Areeb Tanvir",
    "Sara Lindgren",
    "Marcus Webb",
    "Priya Nair",
    "Tom Becker",
    "Lena Ortiz",
  ];
  /* Two draft PO markers per item over the 30-day window (day 8, 20) — a small
     signal that some paperwork is already in flight, without cluttering the
     graph. Display-only — these don't lift the projected curve (draft ≠
     promise). Small qty variance keeps them visually distinct.
     PO number format matches the Purchase Orders listing table
     (buyer 2026-07-19: "simple PO number like we have on listing table").
     Range 9000–9899 stays clear of the listing's 9823–9842 seeded
     values so drafts never collide with real POs in the app. */
  const anchors = [8, 20];
  return anchors.map((base, i) => {
    const num = 9000 + ((seed * 7 + i * 31) % 900);
    return {
      poNumber: `PO-${num}`,
      itemCode: item.itemCode,
      qty: Math.max(4, Math.round(unit * 0.6) + ((seed + i * 2) % 6)),
      expectedDate: addDays(base + ((seed + i) % 2)),
      status: "Draft",
      vendorName: i % 2 === 0 ? vendorPrimary : vendorSecondary,
      createdBy: DRAFT_CREATORS[(seed + i) % DRAFT_CREATORS.length],
    };
  });
}

/**
 * Convenience for tests / fixtures: pure helper exposing addDays so callers
 * can build relative-date scenarios without re-implementing it.
 */
export const plannerAddDays = addDays;

/* ─────────────────────────── SOURCE-DOC LINKS ─────────────────────────── */

/* Placeholder document routes for a demand SOURCE reference (Sales Order /
   Purchase Request), opened in a NEW TAB. The real SO / PR document pages
   don't exist yet, so this is the link target to wire up later.

   This is the ONE source of truth for the route, shared by every surface that
   shows a source reference so they can never drift apart:
     • the Demands listing sources cell  (PODemands → SourcePill)
     • the gap-graph hover / day cards   (PlannerGapGraph → DayEventRow)
     • the Transaction Table source cell (UnifiedTransactionStream)
   Only SO + Purchase-Request references link; POs / what-ifs stay plain text. */
export type SourceDocKind = "SO" | "Request";
const SOURCE_DOC_BASE: Record<SourceDocKind, string> = {
  SO: "/sales-orders",
  Request: "/purchase-requests",
};
export function sourceDocHref(kind: SourceDocKind, ref: string): string {
  if (kind === "Request") {
    /* Request references carry a requester NAME in the seed (not a
       PR id). Resolve to a real PR id so clicking opens the detail
       page for that person's active request. `?from=planner` tells
       the detail page to surface the buyer-side actions header
       (Defer / Deny / Create PO). Falls back to the listing when no
       requester matches — safer than a 404. */
    const prId = findPRIdByRequesterName(ref);
    return prId
      ? `${SOURCE_DOC_BASE.Request}/${encodeURIComponent(prId)}?from=planner`
      : SOURCE_DOC_BASE.Request;
  }
  return `${SOURCE_DOC_BASE[kind]}/${encodeURIComponent(ref)}`;
}

/* ─────────────────────────── VENDOR EXPANSION ─────────────────────────── */

/* Shared vendor pool ("all vendors", point 16). The hand-authored items each
   carry their 1–2 contracted vendors; `expandVendorsForItem` tops the list up
   from this pool so the Fulfillment graph + multi-vendor filter (point 25) and
   the one-vendor-can't-cover split (point 24) have enough vendors to be
   meaningful. Prices are derived per item (no separate price master), honouring
   the "reuse vendor prices as the quote" decision. */
const VENDOR_POOL: Array<{
  vendorId: string;
  vendorName: string;
  leadBias: number;
  priceBias: number;
  onTime: number;
}> = [
  { vendorId: "vp-grainger", vendorName: "Grainger Industrial", leadBias: 0, priceBias: 1.03, onTime: 90 },
  { vendorId: "vp-mcmaster", vendorName: "McMaster-Carr", leadBias: -2, priceBias: 1.09, onTime: 97 },
  { vendorId: "vp-fastenal", vendorName: "Fastenal", leadBias: 1, priceBias: 0.97, onTime: 87 },
  { vendorId: "vp-motion", vendorName: "Motion Industries", leadBias: 3, priceBias: 0.94, onTime: 84 },
  { vendorId: "vp-applied", vendorName: "Applied Industrial", leadBias: 2, priceBias: 1.0, onTime: 91 },
  // Non-qualified marketplace depth — these sit beyond the qualified cap of 5
  // (the fill loop breaks at TARGET_VENDOR_COUNT before reaching them, so the
  // qualified set is untouched) and surface only via the "Show all vendors" path.
  { vendorId: "vp-msc", vendorName: "MSC Industrial", leadBias: 1, priceBias: 1.05, onTime: 92 },
  { vendorId: "vp-wesco", vendorName: "WESCO International", leadBias: 4, priceBias: 0.92, onTime: 81 },
  { vendorId: "vp-ferguson", vendorName: "Ferguson Supply", leadBias: 2, priceBias: 0.99, onTime: 88 },
  { vendorId: "vp-zoro", vendorName: "Zoro", leadBias: 0, priceBias: 0.96, onTime: 85 },
  { vendorId: "vp-rs", vendorName: "RS Components", leadBias: 5, priceBias: 1.07, onTime: 94 },
];

const TARGET_VENDOR_COUNT = 5;
const MULTIPLE_CHOICES = [1, 5, 10, 25];

/** Deterministic seed from a string so derived constraints are stable across
    renders (no Math.random — the UI must not reshuffle on every paint). */
function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Derive a vendor's per-vendor MOQ / multiples / max-order qty. The primary
    vendor mirrors the item-level numbers; others vary deterministically so the
    graph shows real per-vendor differences — including some capacity-limited
    vendors that can't cover a large demand alone (point 24). */
function deriveConstraints(
  item: PlannerItem,
  vendorId: string,
  isPrimary: boolean,
): { moq: number; orderMultiples: number; maxOrderQty: number } {
  if (isPrimary) {
    return { moq: item.moq, orderMultiples: item.orderMultiples, maxOrderQty: item.maxOrderQty };
  }
  const seed = seedFrom(vendorId);
  const moq = Math.max(1, Math.round(item.moq * [0.5, 1, 1.5][seed % 3]));
  const orderMultiples = MULTIPLE_CHOICES[seed % MULTIPLE_CHOICES.length];
  // Unsigned shift (>>>): `seed` is an unsigned 32-bit hash, so a signed `>>`
  // can go negative when the high bit is set → a negative modulo → an
  // out-of-bounds (undefined) factor → NaN. `>>>` keeps the index in [0,2].
  const maxOrderQty = Math.max(moq, Math.round(item.maxOrderQty * [0.4, 0.7, 1][(seed >>> 2) % 3]));
  return { moq, orderMultiples, maxOrderQty };
}

/** The full set of vendors available for an item: its contracted vendors plus
    enough pool vendors to reach TARGET_VENDOR_COUNT, every one carrying
    explicit per-vendor constraints. */
/** Always-on rules injected by `expandVendorsForItem` so every item shows at
    least one discount AND one premium across its vendors. Read-only — shared
    across items; never mutated. */
const INJECTED_DISCOUNT: PlannerPricingRule = {
  ruleType: "discount",
  basis: "percent",
  amount: 0.04,
  description: "Preferred rate",
  ruleName: "Preferred Vendor Discount",
  aboutText:
    "A standing 4% discount under this vendor's preferred-supplier agreement, applied to every order.",
};
const INJECTED_PREMIUM: PlannerPricingRule = {
  ruleType: "premium",
  basis: "percent",
  amount: 0.03,
  description: "Expedite surcharge",
  ruleName: "Expedite Surcharge",
  aboutText:
    "A 3% surcharge for priority handling and faster turnaround on this vendor's line.",
};

export function expandVendorsForItem(item: PlannerItem): PlannerVendor[] {
  const result: PlannerVendor[] = item.qualifiedVendors.map((v) => {
    const d = deriveConstraints(item, v.vendorId, v.primaryFlag);
    return {
      ...v,
      moq: v.moq ?? d.moq,
      orderMultiples: v.orderMultiples ?? d.orderMultiples,
      maxOrderQty: v.maxOrderQty ?? d.maxOrderQty,
    };
  });
  const haveNames = new Set(result.map((v) => v.vendorName));
  const refPrice = result[0]?.unitPrice ?? 100;
  const refLead = item.primaryVendorLeadDays || result[0]?.leadTimeDays || 7;
  for (const p of VENDOR_POOL) {
    if (result.length >= TARGET_VENDOR_COUNT) break;
    if (haveNames.has(p.vendorName)) continue;
    const d = deriveConstraints(item, p.vendorId, false);
    result.push({
      vendorId: p.vendorId,
      vendorName: p.vendorName,
      unitPrice: Math.round(refPrice * p.priceBias * 100) / 100,
      leadTimeDays: Math.max(1, refLead + p.leadBias),
      onTimeRating: p.onTime,
      primaryFlag: false,
      rank: result.length + 1,
      pricingRules: [],
      moq: d.moq,
      orderMultiples: d.orderMultiples,
      maxOrderQty: d.maxOrderQty,
    });
  }

  /* Guarantee every item demonstrates BOTH a discount and a premium across
     its vendors. Fill whichever type is missing with an always-on rule,
     placed on distinct rule-free vendors — the discount on the cheapest, the
     premium on the dearest (and not the primary when avoidable) — so the
     spread reads naturally. Hand-authored / tiered rules are left untouched. */
  const hasType = (rt: "discount" | "premium") =>
    result.some((v) => v.pricingRules.some((r) => r.ruleType === rt));
  const ruleFreeByPrice = result
    .filter((v) => v.pricingRules.length === 0)
    .sort((a, b) => a.unitPrice - b.unitPrice);
  if (!hasType("discount") && ruleFreeByPrice.length > 0) {
    ruleFreeByPrice[0].pricingRules = [INJECTED_DISCOUNT];
  }
  if (!hasType("premium")) {
    const dearestFirst = [...ruleFreeByPrice].reverse();
    const premiumTarget =
      dearestFirst.find((v) => v.pricingRules.length === 0 && !v.primaryFlag) ??
      dearestFirst.find((v) => v.pricingRules.length === 0);
    if (premiumTarget) premiumTarget.pricingRules = [INJECTED_PREMIUM];
  }

  return result;
}

/** The FULL marketplace for an item — every qualified vendor (exactly the set
    `expandVendorsForItem` returns, in the same order) PLUS the remaining shared-
    pool vendors the buyer has NOT qualified. Powers the gap graph's "Show all
    vendors" path (buying outside the qualified list). Pool-only vendors are
    derived the same way the qualified-fill loop derives its top-ups; they carry
    no special pricing rules. Qualified-ness is recovered by the caller by
    intersecting ids with `expandVendorsForItem`. */
export function expandAllVendorsForItem(item: PlannerItem): PlannerVendor[] {
  const qualified = expandVendorsForItem(item);
  const result: PlannerVendor[] = [...qualified];
  const haveNames = new Set(result.map((v) => v.vendorName));
  const refPrice = qualified[0]?.unitPrice ?? 100;
  const refLead = item.primaryVendorLeadDays || qualified[0]?.leadTimeDays || 7;
  for (const p of VENDOR_POOL) {
    if (haveNames.has(p.vendorName)) continue;
    const d = deriveConstraints(item, p.vendorId, false);
    result.push({
      vendorId: p.vendorId,
      vendorName: p.vendorName,
      unitPrice: Math.round(refPrice * p.priceBias * 100) / 100,
      leadTimeDays: Math.max(1, refLead + p.leadBias),
      onTimeRating: p.onTime,
      primaryFlag: false,
      rank: result.length + 1,
      pricingRules: [],
      moq: d.moq,
      orderMultiples: d.orderMultiples,
      maxOrderQty: d.maxOrderQty,
    });
  }
  return result;
}

/** Resolve a vendor's effective constraints, falling back to item-level. */
export function vendorConstraints(
  item: PlannerItem,
  vendor: PlannerVendor,
): { moq: number; orderMultiples: number; maxOrderQty: number } {
  return {
    moq: vendor.moq ?? item.moq,
    orderMultiples: vendor.orderMultiples ?? item.orderMultiples,
    maxOrderQty: vendor.maxOrderQty ?? item.maxOrderQty,
  };
}

/** How the buyer anchored a planned PO to the clicked day:
 *   · "needBy"  — the clicked day is when stock must ARRIVE; the order is
 *                 placed earlier (arrival − lead time).
 *   · "orderOn" — the clicked day is when the order is PLACED; stock arrives
 *                 later (order + lead time).
 * The graph plots the order marker (no curve lift) and the receiving marker
 * (lifts the curve) accordingly. */
export type PlanMode = "needBy" | "orderOn";

/** The default order quantity for a planned PO: enough to bring the item back
 *  to its minimum level (`unitsToCover`), rounded UP to the vendor's order
 *  multiple, floored at MOQ and capped at the (soft) max. When there's no gap,
 *  falls back to one MOQ. The stepper may still take the buyer over max — this
 *  is only the suggested starting quantity so they aren't left guessing. */
export function defaultOrderQty(
  item: PlannerItem,
  vendor: PlannerVendor,
  unitsToCover: number,
): number {
  const c = vendorConstraints(item, vendor);
  const base = unitsToCover > 0 ? unitsToCover : c.moq;
  const mult = Math.max(1, c.orderMultiples);
  const rounded = Math.ceil(base / mult) * mult;
  return Math.min(c.maxOrderQty, Math.max(c.moq, rounded));
}
