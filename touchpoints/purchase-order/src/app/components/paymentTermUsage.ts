/**
 * Stubbed payment-term usage helpers.
 *
 * In the Partners app, `getVendorsForPaymentTerm` / `getVendorCountForPaymentTerm`
 * filter the global vendor list down to vendors using a given payment-term
 * preset (matched via the `vendor.paymentTerms` enum). The PO Detail page
 * doesn't carry a global vendor list yet, so these stubs return empty.
 *
 * The Browse Templates picker still renders the "X in use" pill on each
 * card — when no vendor list is available the count falls back to
 * `term.vendorsApplied` (the mock seed baked into each preset).
 */

import type { PaymentTermPreset } from "./paymentTermPresets";

export interface PtVendorStub {
  id: string;
  name: string;
  paymentTerms: string;
  partnerGroup?: string;
  category?: string;
}

export function getVendorsForPaymentTerm(
  _term: PaymentTermPreset,
  _vendors: PtVendorStub[],
): PtVendorStub[] {
  return [];
}

export function getVendorCountForPaymentTerm(
  term: PaymentTermPreset,
  vendors: PtVendorStub[],
): number {
  if (vendors.length === 0) return term.vendorsApplied;
  return getVendorsForPaymentTerm(term, vendors).length;
}
