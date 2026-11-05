/* ═══════════════════════════════════════════════════════════════
   PO ORDER PRICING — single source of truth for a PO's money math.

   Everything that shows or stores a PO total (store recalcs, detail
   page Order Summary, line hover cards, cart summary, print) goes
   through `computePOPricing` so the numbers always agree.

   Total = Subtotal
         − line % discounts
         − pricing-rule discounts + pricing-rule premiums
         ± one-time discounts / premiums (item-level + order-level)

   Shipping is intentionally excluded (spec not final — same as Sales
   Orders, and the Order Summary no longer shows a shipping row).

   One-time adjustments are a port of Sales-Order-V5's
   `useAdjustments` model (`so/useAdjustments.ts`), with three fixes:
     1. A `$` item-level adjustment on N lines is ONE amount split
        across those lines (pro-rata by line value), not N × amount.
     2. Removing an adjustment from one line only detaches that line
        (`detachAdjustmentFromLine`) instead of deleting it everywhere.
     3. Adjustments never fold into `unitPrice` — they stay a separate
        layer, so nothing is double-counted.
   ═══════════════════════════════════════════════════════════════ */

import type { POLineItem, PurchaseOrderData } from "./poStore";
import {
  getVendorRules,
  computeLineBreakdowns,
  type LinePricingBreakdown,
} from "./poPricingRulesData";

/* ── One-time adjustment model (verbatim shape of SO `Adjustment`) ── */

export type AdjustmentUnappliedReason = "USER_UNAPPLIED" | "EXCEEDS_100_PERCENT";

export interface POAdjustment {
  id: string;
  label: string;
  type: "discount" | "premium";
  amountType: "$" | "%";
  amount: number;
  /** `'quote'` = order-level (legacy SO naming kept so the shared
   *  AdjustmentFormModal / ManageAdjustmentsModal work unchanged). */
  scope: "quote" | "item";
  /** Line ids — item scope only. */
  appliedTo?: string[];
  isApplied: boolean;
  unappliedReason?: AdjustmentUnappliedReason;
  internalNotes?: string;
}

/** Item-level adjustment carried on a line before a PO exists (cart /
 *  Items Detail Modal in creation modes). Becomes a `POAdjustment` with
 *  `appliedTo: [lineId]` when the PO is created. */
export type LineOneTimeAdjustment = Omit<POAdjustment, "scope" | "appliedTo">;

export interface AdjustmentTotals {
  premium: number;
  discount: number;
  /** premium − discount (positive adds cost). */
  net: number;
}

export interface LineAdjustmentImpact {
  adjustmentId: string;
  label: string;
  type: "discount" | "premium";
  amountType: "$" | "%";
  amount: number;
  /** $ this adjustment contributes on this line (always positive). */
  dollars: number;
}

export interface LineAdjustmentBreakdown extends AdjustmentTotals {
  impacts: LineAdjustmentImpact[];
}

const ZERO: AdjustmentTotals = { premium: 0, discount: 0, net: 0 };

export function newAdjustmentId(): string {
  return `A${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Fallback label so toasts / rows never read `""`. */
export function adjustmentDisplayLabel(a: { label: string; type: "discount" | "premium" }): string {
  return a.label.trim() || (a.type === "premium" ? "One-time premium" : "One-time discount");
}

/** $ value of an adjustment against a base (SO `dollarImpact`). */
export function adjustmentDollarImpact(a: { amountType: "$" | "%"; amount: number }, base: number): number {
  return a.amountType === "%" ? (base * a.amount) / 100 : a.amount;
}

/** Line value one-time `%` adjustments and pricing rules are measured
 *  against: qty × net PPU (after the line's static % discount). */
export function lineBaseValue(li: Pick<POLineItem, "unitPrice" | "quantity" | "discount">): number {
  return li.unitPrice * (1 - (li.discount || 0) / 100) * li.quantity;
}

export function computeAdjustmentBreakdowns(
  lines: Array<{ id: string; base: number }>,
  adjustments: POAdjustment[],
): {
  lineBreakdowns: Map<string, LineAdjustmentBreakdown>;
  itemTotals: AdjustmentTotals;
  quoteTotals: AdjustmentTotals;
  grandTotal: AdjustmentTotals;
} {
  const baseById = new Map(lines.map((l) => [l.id, l.base]));
  const lineBreakdowns = new Map<string, LineAdjustmentBreakdown>();
  const bump = (lineId: string, a: POAdjustment, dollars: number) => {
    const cur = lineBreakdowns.get(lineId) ?? { ...ZERO, impacts: [] };
    if (a.type === "premium") cur.premium += dollars;
    else cur.discount += dollars;
    cur.net = cur.premium - cur.discount;
    cur.impacts.push({
      adjustmentId: a.id,
      label: a.label,
      type: a.type,
      amountType: a.amountType,
      amount: a.amount,
      dollars,
    });
    lineBreakdowns.set(lineId, cur);
  };

  for (const a of adjustments) {
    if (!a.isApplied || a.scope !== "item") continue;
    const targets = (a.appliedTo ?? []).filter((id) => baseById.has(id));
    if (targets.length === 0) continue;
    if (a.amountType === "%") {
      for (const id of targets) bump(id, a, adjustmentDollarImpact(a, baseById.get(id)!));
    } else {
      /* Fix #1 — one $ amount split across the selected lines, weighted
         by line value (equal split when every line is $0). */
      const totalBase = targets.reduce((s, id) => s + Math.max(0, baseById.get(id)!), 0);
      for (const id of targets) {
        const share = totalBase > 0 ? Math.max(0, baseById.get(id)!) / totalBase : 1 / targets.length;
        bump(id, a, a.amount * share);
      }
    }
  }

  const itemTotals = { ...ZERO };
  for (const b of lineBreakdowns.values()) {
    itemTotals.premium += b.premium;
    itemTotals.discount += b.discount;
  }
  itemTotals.net = itemTotals.premium - itemTotals.discount;

  const orderBase = lines.reduce((s, l) => s + l.base, 0);
  const quoteTotals = { ...ZERO };
  for (const a of adjustments) {
    if (!a.isApplied || a.scope !== "quote") continue;
    const dollars = adjustmentDollarImpact(a, orderBase);
    if (a.type === "premium") quoteTotals.premium += dollars;
    else quoteTotals.discount += dollars;
  }
  quoteTotals.net = quoteTotals.premium - quoteTotals.discount;

  const grandTotal = {
    premium: itemTotals.premium + quoteTotals.premium,
    discount: itemTotals.discount + quoteTotals.discount,
    net: itemTotals.net + quoteTotals.net,
  };
  return { lineBreakdowns, itemTotals, quoteTotals, grandTotal };
}

/* ── Pricing rules (moved from PurchaseOrderDraft's useMemo) ── */

type PricingInput = Pick<PurchaseOrderData, "lineItems" | "deactivatedRuleIds" | "adjustments"> & {
  vendor: { name: string };
};

export function computePORuleBreakdowns(po: PricingInput): Map<string, LinePricingBreakdown> {
  const vendorRules = getVendorRules(po.vendor.name);
  if (vendorRules.length === 0) return new Map();
  const linesForCompute = po.lineItems.map((li) => ({
    id: li.id,
    itemCode: li.itemNumber,
    orderedQty: li.quantity,
    unitPrice: li.unitPrice * (1 - li.discount / 100),
  }));
  const deactivated = po.deactivatedRuleIds ?? {};
  const activatedItemsByRule = new Map<string, Set<string>>();
  for (const rule of vendorRules) {
    if (deactivated[rule.id]) continue;
    const activeLineIds = new Set<string>();
    for (const li of po.lineItems) {
      if (!rule.appliesToItemCodes.includes(li.itemNumber)) continue;
      const explicit = li.activatedRuleIds;
      if (explicit ? explicit.includes(rule.id) : true) activeLineIds.add(li.id);
    }
    if (activeLineIds.size > 0) activatedItemsByRule.set(rule.id, activeLineIds);
  }
  const rows = computeLineBreakdowns(linesForCompute, vendorRules, activatedItemsByRule);
  return new Map(rows.map((r) => [r.lineId, r]));
}

export interface POPricingSummary {
  /** Σ qty × list price (active lines). */
  subtotal: number;
  /** Σ line static % discounts (active lines). */
  lineDiscountTotal: number;
  rulesDiscount: number;
  rulesPremium: number;
  ruleBreakdowns: Map<string, LinePricingBreakdown>;
  adjustments: ReturnType<typeof computeAdjustmentBreakdowns>;
  total: number;
}

export function computePOPricing(po: PricingInput): POPricingSummary {
  const active = po.lineItems.filter((li) => !li.cancelled);
  const subtotal = active.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
  const lineDiscountTotal = active.reduce((s, li) => s + li.unitPrice * li.quantity * (li.discount / 100), 0);
  const ruleBreakdowns = computePORuleBreakdowns(po);
  let rulesDiscount = 0;
  let rulesPremium = 0;
  for (const li of active) {
    const bd = ruleBreakdowns.get(li.id);
    if (!bd) continue;
    rulesDiscount += bd.discountAmount;
    rulesPremium += bd.premiumAmount;
  }
  const adjustments = computeAdjustmentBreakdowns(
    active.map((li) => ({ id: li.id, base: lineBaseValue(li) })),
    po.adjustments ?? [],
  );
  const total = subtotal - lineDiscountTotal - rulesDiscount + rulesPremium + adjustments.grandTotal.net;
  return { subtotal, lineDiscountTotal, rulesDiscount, rulesPremium, ruleBreakdowns, adjustments, total };
}

/* ── Cart / creation helpers ── */

/** Per-line one-time impact for a not-yet-created line (cart, Items
 *  Detail Modal). `base` = qty × net PPU. */
export function lineOneTimeNet(adjs: LineOneTimeAdjustment[] | undefined, base: number): AdjustmentTotals {
  const out = { ...ZERO };
  for (const a of adjs ?? []) {
    if (!a.isApplied) continue;
    const d = adjustmentDollarImpact(a, base);
    if (a.type === "premium") out.premium += d;
    else out.discount += d;
  }
  out.net = out.premium - out.discount;
  return out;
}

/** Turn a line's carried one-times into PO-level item adjustments. */
export function lineAdjustmentsToPO(lineId: string, adjs: LineOneTimeAdjustment[] | undefined): POAdjustment[] {
  return (adjs ?? []).map((a) => ({ ...a, scope: "item" as const, appliedTo: [lineId] }));
}

/** The item-level adjustments that touch exactly one line, as the
 *  per-line shape the Items Detail Modal edits. */
export function poAdjustmentsForLine(po: Pick<PurchaseOrderData, "adjustments">, lineId: string): POAdjustment[] {
  return (po.adjustments ?? []).filter((a) => a.scope === "item" && (a.appliedTo ?? []).includes(lineId));
}

/** Fix #2 — remove a line from an adjustment's targets; drop the
 *  adjustment only when no lines are left. */
export function detachAdjustmentFromLine(list: POAdjustment[], adjustmentId: string, lineId: string): POAdjustment[] {
  return list.flatMap((a) => {
    if (a.id !== adjustmentId) return [a];
    const rest = (a.appliedTo ?? []).filter((id) => id !== lineId);
    return rest.length > 0 ? [{ ...a, appliedTo: rest }] : [];
  });
}

/** Replace the item-level adjustments on one line with `next` (the
 *  Items Detail Modal's edited list), leaving every other line's — and
 *  every multi-line adjustment's other targets — untouched. */
export function replaceLineAdjustments(
  list: POAdjustment[],
  lineId: string,
  next: LineOneTimeAdjustment[],
): POAdjustment[] {
  const keptIds = new Set(next.map((a) => a.id));
  let out: POAdjustment[] = [];
  for (const a of list) {
    const onLine = a.scope === "item" && (a.appliedTo ?? []).includes(lineId);
    if (!onLine) { out.push(a); continue; }
    if (keptIds.has(a.id)) {
      const edited = next.find((n) => n.id === a.id)!;
      out.push({ ...a, ...edited, scope: "item", appliedTo: a.appliedTo });
    } else {
      out = detachAdjustmentFromLine([...out, a], a.id, lineId);
    }
  }
  const existingIds = new Set(list.map((a) => a.id));
  for (const n of next) {
    if (!existingIds.has(n.id)) out.push({ ...n, scope: "item", appliedTo: [lineId] });
  }
  return out;
}

/** Cart-side pricing for one vendor's checked lines (no PO yet):
 *  every applicable rule is active (same as CartPage), plus each line's
 *  carried one-times. Used by the catalogue modal's cart summary. */
export function computeCartVendorPricing(
  vendorName: string,
  lines: Array<{ id: string; itemNumber: string; quantity: number; unitPrice: number; discount: number; oneTimeAdjustments?: LineOneTimeAdjustment[] }>,
): { rulesDiscount: number; rulesPremium: number; oneTimeNet: number } {
  let rulesDiscount = 0;
  let rulesPremium = 0;
  const rules = vendorName ? getVendorRules(vendorName) : [];
  if (rules.length > 0 && lines.length > 0) {
    const forCompute = lines.map((l) => ({
      id: l.id,
      itemCode: l.itemNumber,
      orderedQty: l.quantity,
      unitPrice: l.unitPrice * (1 - l.discount / 100),
    }));
    const activation = new Map<string, Set<string>>();
    for (const r of rules) {
      const ids = new Set(forCompute.filter((l) => r.appliesToItemCodes.includes(l.itemCode)).map((l) => l.id));
      if (ids.size > 0) activation.set(r.id, ids);
    }
    for (const bd of computeLineBreakdowns(forCompute, rules, activation)) {
      rulesDiscount += bd.discountAmount;
      rulesPremium += bd.premiumAmount;
    }
  }
  const oneTimeNet = lines.reduce(
    (s, l) => s + lineOneTimeNet(l.oneTimeAdjustments, l.unitPrice * (1 - l.discount / 100) * l.quantity).net,
    0,
  );
  return { rulesDiscount, rulesPremium, oneTimeNet };
}

/** Net one-time adjustment value recorded in a version snapshot. */
export function snapshotOneTimeNet(snapshot: {
  lineItems: Array<{ id: string; unitPrice: number; quantity: number; discount: number; cancelled?: boolean }>;
  adjustments?: POAdjustment[];
}): number {
  return computeAdjustmentBreakdowns(
    snapshot.lineItems.filter((li) => !li.cancelled).map((li) => ({ id: li.id, base: lineBaseValue(li) })),
    snapshot.adjustments ?? [],
  ).grandTotal.net;
}
