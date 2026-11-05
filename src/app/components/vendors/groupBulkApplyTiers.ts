/**
 * Bulk-apply tier registry for Partner Group settings.
 *
 * Eli's framework (latest): partners are templates, not inventory. Changing a
 * partner-group setting only seeds future transactions — existing POs,
 * invoices, orders, and credit decisions keep the snapshot they were created
 * with. Net 30 → Net 45 doesn't retroactively change an open invoice. A
 * pricing-rule edit doesn't recompute a discount that already lives inside a
 * line item. A credit-limit raise doesn't un-flag a past block.
 *
 * Implication: every partner setting resolves to "template-only" by default.
 * The complex push-to-linked logic that items has is not needed here. Eli's
 * confidence on this is 90-92%; if a specific setting later proves to need
 * push semantics we re-introduce the tier on that one row, but no setting
 * starts there.
 *
 * The full / push-cautious tier types stay in the union as an explicit escape
 * hatch — keeping them costs nothing and avoids rebuilding the framework if
 * one edge case turns up. Today nothing maps to them.
 *
 * - "template-only"  — modal shows a single "Save template only" button.
 *                      Linked partners are never touched from the group editor.
 *                      Default for everything except gl.
 * - "pending"        — no editor, no modal. Used for GL Accounts until
 *                      Ashma's discovery lands.
 * - "full"           — escape hatch (unused). Template default + opt-in push
 *                      with in-flight detection. Re-introduce per-setting if a
 *                      real edge case appears.
 * - "push-cautious"  — escape hatch (unused). Same shape as "full" with
 *                      stronger "does not touch anything in motion" copy.
 */
export type GroupBulkApplyTier =
  | "full"
  | "push-cautious"
  | "template-only"
  | "pending";

/**
 * Section IDs come from the Setup tab in PartnerGroupDetailModal.tsx and the
 * VENDOR_CONFIG_SECTIONS / CUSTOMER_CONFIG_SECTIONS arrays in partnerConstants.tsx.
 * Missing keys default to "template-only" so a new section never accidentally
 * gets a bulk-push action it wasn't designed for.
 */
const TIERS: Record<string, GroupBulkApplyTier> = {
  // Detail-modal Setup tab section ids
  overview: "template-only",
  payment_terms: "template-only",
  pricing_rules: "template-only",
  credit: "template-only",
  payment_methods: "template-only",
  shipping: "template-only",
  items: "template-only",
  categories: "template-only",
  gl: "pending",

  // Vendor config-section ids (partnerConstants.tsx)
  billing_shipping: "template-only",
  credit_limit: "template-only",
  shipping_methods: "template-only",

  // Customer config-section ids
  customer_billing: "template-only",
  customer_payment: "template-only",
  customer_credit: "template-only",
  customer_payment_terms: "template-only",
  customer_pricing_rules: "template-only",
  customer_shipping_methods: "template-only",
};

export function getGroupBulkApplyTier(sectionId: string): GroupBulkApplyTier {
  return TIERS[sectionId] ?? "template-only";
}
