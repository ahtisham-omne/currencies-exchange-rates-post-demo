import type { Quote, PointOfContact, SalesRep, LineItem } from '@/app/types/quote';

/* Canonical summary of a Quote — single source of truth for listings,
   kanban cards, and the detail sidebar. Every surface that renders
   a quote should pull through here so the same number / PoC / rep
   appears everywhere.

   The mock generator stores `totalValue` as the headline grand total.
   When a quote also carries an `items[]` line array we recompute the
   breakdown (subtotal/tax/...) so the detail page can show each
   component; absent items, we treat `totalValue` as both subtotal
   and grand total so the listing and the detail tile still match. */

export interface QuoteSummary {
  primaryPoC: PointOfContact;
  additionalPoCs: PointOfContact[];
  /** Primary + additional, in render order. */
  allPoCs: PointOfContact[];
  pocCount: number;

  salesRep: SalesRep;
  additionalSalesReps: SalesRep[];
  /** Primary + additional, in render order. */
  allSalesReps: SalesRep[];
  salesRepCount: number;

  items: LineItem[];
  lineItemCount: number;

  /** Sum of line `total` values. Falls back to `totalValue` when the
   *  quote has no `items[]` — the listing's source of truth. */
  subtotal: number;
  /** Tax applied on top of subtotal. Derived from `quote.tax` when
   *  present, else 0. */
  tax: number;
  /** Net pricing-rules discount (positive number = amount removed). */
  pricingRulesTotal: number;
  pricingRulesCount: number;
  /** Net one-time adjustment (signed: + premium, - discount). */
  adjustmentsTotal: number;
  adjustmentsCount: number;
  /** Freight added to the grand total. */
  freight: number;

  /** Final value displayed everywhere. Matches `quote.totalValue` when
   *  no breakdown components are populated. */
  grandTotal: number;
}

export function summarizeQuote(quote: Quote): QuoteSummary {
  const additionalPoCs = quote.additionalPoCs ?? [];
  const allPoCs = [quote.primaryPoC, ...additionalPoCs];
  const additionalSalesReps = quote.additionalSalesReps ?? [];
  const allSalesReps = [quote.salesRep, ...additionalSalesReps];

  const items = quote.items ?? [];
  const computedSubtotal = items.reduce((sum, li) => sum + (li.total ?? 0), 0);

  /* If the quote carries real line items we trust them, otherwise we
     fall back to the headline `totalValue` so listing rows and the
     detail's grand-total tile read the same number. */
  const hasItems = items.length > 0;
  const subtotalRaw = hasItems ? computedSubtotal : (quote.subtotal ?? quote.totalValue);
  const tax = quote.tax ?? 0;
  const pricingRulesTotal = 0;
  const pricingRulesCount = 0;
  const adjustmentsTotal = 0;
  const adjustmentsCount = 0;
  const freight = 0;

  const grandTotal = hasItems
    ? subtotalRaw + tax + freight + adjustmentsTotal - pricingRulesTotal
    : quote.totalValue;

  return {
    primaryPoC: quote.primaryPoC,
    additionalPoCs,
    allPoCs,
    pocCount: allPoCs.length,
    salesRep: quote.salesRep,
    additionalSalesReps,
    allSalesReps,
    salesRepCount: allSalesReps.length,
    items,
    lineItemCount: items.length,
    subtotal: subtotalRaw,
    tax,
    pricingRulesTotal,
    pricingRulesCount,
    adjustmentsTotal,
    adjustmentsCount,
    freight,
    grandTotal,
  };
}
