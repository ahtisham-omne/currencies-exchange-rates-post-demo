/* ── The cart's line on what gets created ─────────────────────────────
 * Currency Touchpoints Map, Purchase Orders 2: one PO per vendor, in that
 * vendor's currency. "3 POs: General Motors in USD, Bosch Industrie in EUR,
 * Karachi Fasteners in PKR." Used under the total on the Cart page and in
 * the Catalogue's cart panel. */
export function poPerVendorLine(groups: Array<{ vendor: string; currency: string }>): string {
  const n = groups.length;
  return `${n} PO${n === 1 ? "" : "s"}: ${groups.map((g) => `${g.vendor} in ${g.currency}`).join(", ")}.`;
}

/** The note on a vendor's currency tag in the catalogue. */
export const CATALOG_TAG_NOTE = "The vendor's currency. Prices show in the base currency; hover one for the vendor's.";

/** The note on a vendor's currency tag in the cart. */
export const CART_TAG_NOTE = "The vendor's currency. Its PO is placed in it; amounts here are in the base currency.";
