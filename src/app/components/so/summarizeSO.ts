import type { SalesOrder, SOPointOfContact, SalesRep, SOLine } from "./types";

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

  /* Rules / adjustments aren't yet modeled on the SalesOrder record
     itself (they live in usePricingRules / useAdjustments which are
     instantiated by SODetail). We expose zero here so callers without
     those APIs still get a working grand total; the detail page can
     overlay live numbers from the APIs. */
  const pricingRulesTotal = 0;
  const pricingRulesCount = 0;
  const adjustmentsTotal = 0;
  const adjustmentsCount = 0;

  /* Prefer the line-driven computation when we have lines, otherwise
     trust `so.total` (the generator's pre-computed value, which
     already includes tax). */
  const hasLines = activeLines.length > 0;
  const computedGrand = subtotal + tax + freight + adjustmentsTotal - pricingRulesTotal;
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
