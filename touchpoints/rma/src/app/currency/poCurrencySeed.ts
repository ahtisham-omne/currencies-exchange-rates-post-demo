/* ── Which POs are in which currency (the seed) ───────────────────────
 * Kept apart from returnCurrency.ts, which reads the vendors, so the vendor
 * data can read it too (a vendor trading wholly in pounds says so) without
 * the two importing each other. */

/** Every PO of these vendors is in this currency, and so is the vendor's
 *  default (Vendor.currency). */
export const VENDOR_CURRENCY: Record<string, string> = {
  'V-01001': 'GBP', // Vantage Fabrication Works
  'V-01005': 'EUR', // Redstone Machining Co.
  'V-01013': 'GBP', // Arbor Precision Engineering
  'V-01023': 'EUR', // Oakmoor Transport
};

/** POs in a currency of their own. Crestwood Carriers trades in three:
 *  11151 and 11152 (received together on one document) in pounds, 11153 in
 *  euros, the rest in dollars, which is what Create New RMA step 4's rule is
 *  for. */
export const PO_CURRENCY: Record<string, string> = {
  '11151': 'GBP',
  '11152': 'GBP',
  '11153': 'EUR',
};
