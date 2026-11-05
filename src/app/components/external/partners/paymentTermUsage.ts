/**
 * Single source of truth for "which vendors use a given payment-term preset".
 *
 * Both the Payment Term picker card and the detail-modal Partners tab read
 * the count and the list from here, so the card's "X in use" pill always
 * matches the row count inside the modal.
 *
 * Mapping rule:
 *   • NET preset with a known duration matching the vendor enum
 *     (15 / 30 / 45 / 60 / 90) → vendor.paymentTerms === `net_${duration}`
 *   • Any other preset (prepayment, split, durations without an enum
 *     equivalent like 10 / 20 / 25) → no exact mapping yet, returns empty.
 *     Once richer payment-term linkage lands on the Vendor record we can
 *     swap this to a direct id match without changing call-sites.
 */

import type { PaymentTermPreset } from "./partnerConstants";
import type { Vendor, PaymentTerms } from "./vendors-data";

const VENDOR_ENUM_BY_NET_DURATION: Record<string, PaymentTerms> = {
  "15": "net_15",
  "30": "net_30",
  "45": "net_45",
  "60": "net_60",
  "90": "net_90",
};

function vendorEnumForPreset(term: PaymentTermPreset): PaymentTerms | null {
  if (term.category !== "net") return null;
  const dur = term.duration;
  if (!dur) return null;
  return VENDOR_ENUM_BY_NET_DURATION[dur] ?? null;
}

export function getVendorsForPaymentTerm(
  term: PaymentTermPreset,
  vendors: Vendor[],
): Vendor[] {
  const enumValue = vendorEnumForPreset(term);
  if (!enumValue) return [];
  return vendors.filter((v) => v.paymentTerms === enumValue);
}

export function getVendorCountForPaymentTerm(
  term: PaymentTermPreset,
  vendors: Vendor[],
): number {
  return getVendorsForPaymentTerm(term, vendors).length;
}
