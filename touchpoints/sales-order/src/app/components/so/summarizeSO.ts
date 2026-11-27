import type { SalesOrder, SOPointOfContact, SalesRep, SOLine } from "./types";
import { computeLineBreakdowns, getCustomerRules, lineIdsForRule } from "./pricingRulesData";
import { adjustmentsNet, seedInitial, type Adjustment } from "./useAdjustments";
import { getImportedAdjustments } from "./importedAdjustments";
import { DESIGN_CURRENCY, convertOn, roundTo, ruleAmountFactor, soFx } from "@/app/currency/soFx";

/* Canonical summary of a Sales Order — single source of truth for the
   SO listing rows, kanban cards, and the detail sidebar. Every surface
   that renders an SO should pull through here so the same number /
   PoC / rep appears everywhere.

   The store generator stores `total` as the headline grand total
   (line subtotals × (1 + taxRate)). When the SO also carries freight
   we add it on top so listings + the sidebar reconcile against the
   detail page's grand-total tile. */

export interface SOSummary {
  primaryPoC?: SOPointOfContact;
  additionalPoCs: SOPointOfContact[];
  /** Primary + additional, in render order. */
  allPoCs: SOPointOfContact[];
  pocCount: number;

  salesRepName: string;
  salesReps: SalesRep[];
  salesRepCount: number;

  lines: SOLine[];
  /** Lines that haven't been cancelled — what we show in counts. */
  activeLines: SOLine[];
  lineItemCount: number;

  /** Sum of `orderedQty * unitPrice` across non-cancelled lines.
   *  No tax applied here. */
  subtotal: number;
  /** Sum of `orderedQty * unitPrice * taxRate`. */
  tax: number;
  /** Order-level freight + any per-line freight overrides. */
  freight: number;
  /** Net pricing-rules discount (positive number = amount removed). */
  pricingRulesTotal: number;
  pricingRulesCount: number;
  /** Net one-time adjustment (signed: + premium, - discount). */
  adjustmentsTotal: number;
  adjustmentsCount: number;

  /** Final value displayed everywhere: subtotal + tax + freight +
   *  adjustments − pricing rules. Falls back to `so.total` when no
   *  line-level breakdown is present. */
  grandTotal: number;
}

/** The pricing rules and one-time adjustments an order opens with on the
 *  detail page (SODetail: usePricingRules, useAdjustments), in its currency.
 *  rulesNet: discount − premium (positive takes off). */
export function openingRulesAndAdjustments(so: SalesOrder, activeLines: SOLine[] = (so.lines ?? []).filter(l => !l.cancelled)) {
  const fx = soFx(so);
  const rules = getCustomerRules(so.customer ?? "");
  const activation = new Map(rules.map(r => [r.id, new Set(lineIdsForRule(r, so.lines ?? []))]));
  const rulesNet = computeLineBreakdowns(activeLines, rules, activation, ruleAmountFactor(fx))
    .reduce((t, b) => t + b.discountAmount - b.premiumAmount, 0);
  const imported = getImportedAdjustments(so.id) as Adjustment[] | undefined;
  const adjustments: Adjustment[] = imported
    ?? (so.createdViaUI ? [] : seedInitial(so.lines ?? [], (n) => convertOn(n, DESIGN_CURRENCY, fx.currency, fx.rateDate)));
  return {
    rulesNet,
    rulesCount: rules.length,
    adjustmentsNet: adjustmentsNet(adjustments, so.lines ?? []),
    adjustmentsCount: adjustments.length,
  };
}

export function summarizeSO(so: SalesOrder): SOSummary {
  const pocs = so.pocs ?? [];
  const primary = pocs.find(p => p.id === so.primaryPocId) || pocs.find(p => p.isPrimary) || pocs[0];
  const additional = pocs.filter(p => p.id !== primary?.id);
  const allPoCs = primary ? [primary, ...additional] : additional;

  const salesReps = so.salesReps ?? [];
  const salesRepCount = salesReps.length || (so.salesRep ? 1 : 0);

  const activeLines = (so.lines ?? []).filter(l => !l.cancelled);

  const subtotal = activeLines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);
  const tax = activeLines.reduce((s, l) => s + l.orderedQty * l.unitPrice * (l.taxRate ?? 0), 0);

  /* Freight: per-line overrides take precedence when any line has one,
     otherwise the order-level freightCost is the single charge. Mirrors
     the contract in updateSO (store.tsx) so the sidebar's grand-total
     tile reconciles with the listing's `total`. */
  const anyLineOverride = activeLines.some(l => typeof l.shipmentCost === 'number');
  const freight = anyLineOverride
    ? activeLines.reduce((s, l) => s + (l.shipmentCost ?? 0), 0)
    : (so.freightCost ?? 0);

  /* Rules and one-time adjustments aren't on the SalesOrder record (they
     live in usePricingRules / useAdjustments, which SODetail starts). They
     used to count as zero here, so the listing's Order Value left out what
     the detail page's Order Summary took off or added (SO-000-000-000:
     ₨37,120,421 in the listing, ₨36,813,683 on the order). Since 25 Nov 2026
     this works them out the way the detail page starts them: every customer
     rule on every matching line, and the demo or imported adjustments. */
  const opening = openingRulesAndAdjustments(so, activeLines);
  const pricingRulesTotal = opening.rulesNet;
  const pricingRulesCount = opening.rulesCount;
  const adjustmentsTotal = opening.adjustmentsNet;
  const adjustmentsCount = opening.adjustmentsCount;

  /* Prefer the line-driven computation when we have lines, otherwise
     trust `so.total` (the generator's pre-computed value, which
     already includes tax). */
  /* Any lines at all: an order whose every line is cancelled is worth
     nothing, rather than falling back to its stored total (25 Nov 2026). */
  const hasLines = (so.lines ?? []).length > 0;
  /* To the order currency's minor unit, as its invoices are (25 Nov 2026). */
  const computedGrand = roundTo(soFx(so).currency, subtotal + tax + freight + adjustmentsTotal - pricingRulesTotal);
  const grandTotal = hasLines ? computedGrand : (so.total + freight);

  return {
    primaryPoC: primary,
    additionalPoCs: additional,
    allPoCs,
    pocCount: allPoCs.length,
    salesRepName: so.salesRep,
    salesReps,
    salesRepCount,
    lines: so.lines ?? [],
    activeLines,
    lineItemCount: activeLines.length,
    subtotal: hasLines ? subtotal : so.total,
    tax,
    freight,
    pricingRulesTotal,
    pricingRulesCount,
    adjustmentsTotal,
    adjustmentsCount,
    grandTotal,
  };
}
