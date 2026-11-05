/**
 * Versioning Engine for Sales Order Module
 *
 * Classifies field changes as:
 * - MATERIAL:     auto-triggers a new version (when past Draft)
 * - NON_MATERIAL: logged to activity only, no version bump
 * - ASK_USER:     prompts user whether to create new version (instructions/attachments)
 */

export type ChangeCategory = 'material' | 'non_material' | 'ask_user';

export interface FieldChange {
  field: string;
  oldValue?: string;
  newValue?: string;
  category: ChangeCategory;
  rationale?: string;
}

// ── Material changes (auto-trigger revision) ─────────────────────────────────
const MATERIAL_FIELDS = new Set([
  // Line items
  'line_item_add',
  'line_item_delete',
  'line_item_modify',
  'quantity',
  'uom',
  // Pricing
  'pricing_line',
  'pricing_order',
  'unit_price',
  'pricing_rule',
  'adjustment',
  // Deal terms
  'currency',
  'customer',
  'partner',
  'ship_to',
  'bill_to',
  'expiry_date',
  'due_by_date',
  'payment_terms',
]);

// ── Non-material changes (logged only) ───────────────────────────────────────
const NON_MATERIAL_FIELDS = new Set([
  'assigned_salesperson',
  'payment_method',
  'shipping_carrier',
  'shipping_mode',
  'deal_information',
  'internal_notes',
  'customer_reference',
  'po_number',
  /* PoC roster edits (add / remove contact, swap primary) — NOT
     material. They carry no pricing or commitment impact so post-
     Cleared edits must never fire the version prompt. */
  'contact_person',
  'pocs',
  'primary_poc',
  'priority',
  'tags',
  'description',
]);

// ── Ask-user changes ─────────────────────────────────────────────────────────
const ASK_USER_FIELDS = new Set([
  'instruction_order',
  'instruction_item',
  'attachment_order',
  'attachment_item',
]);

/**
 * Classify a field change into one of the three categories.
 */
export function classifyChange(fieldKey: string): ChangeCategory {
  if (MATERIAL_FIELDS.has(fieldKey)) return 'material';
  if (ASK_USER_FIELDS.has(fieldKey)) return 'ask_user';
  return 'non_material';
}

/**
 * Human-readable rationale map for material changes.
 */
export const MATERIAL_RATIONALES: Record<string, string> = {
  line_item_add: 'Changes what is being sold',
  line_item_delete: 'Changes what is being sold',
  line_item_modify: 'Changes what is being sold',
  quantity: 'Changes how much is being sold',
  uom: '500 units vs 500 cases is a different deal',
  pricing_line: 'Changes the financial commitment',
  pricing_order: 'Changes the financial commitment',
  unit_price: 'Changes the financial commitment',
  pricing_rule: 'Changes the financial commitment',
  adjustment: 'Changes the financial commitment',
  currency: 'Changes the denomination of the entire deal',
  customer: 'Changes who the deal is with',
  partner: 'Changes who the deal is with',
  ship_to: 'Changes delivery destination',
  bill_to: 'Changes the legal payment party',
  expiry_date: 'Changes the guarantee window for pricing and terms',
  due_by_date: 'Changes the guarantee window for pricing and terms',
  payment_terms: 'Changes the financial obligation timeline',
};

/**
 * Statuses where the SO is editable.
 *
 * Draft + Pending Review: sales is still iterating with ops; edits land
 *   directly without spinning up a new version.
 * Cleared + Partially Shipped + Partially Cancelled: ops has approved the
 *   SO (or it's mid-fulfilment), so any further edit forks a new draft
 *   version to keep the cleared/shipping copy stable. Shipped lines
 *   inside a Partially-Shipped SO are still per-line locked (see
 *   `isLineEditable` below).
 * Shipped + Cancelled + Archived: terminal — fully locked.
 */
export function isEditableStatus(status: string): boolean {
  return ['Draft', 'Pending Review', 'Cleared', 'Partially Shipped', 'Partially Cancelled'].includes(status);
}

export function requiresNewDraftFirst(status: string): boolean {
  /* Only post-approval edits need a new draft. Draft and Pending Review
     are still in the sales↔ops back-and-forth, so edits there don't bump
     versions. Everything beyond Cleared (Partially Shipped / Partially
     Cancelled) does fork a new draft on material change. */
  return ['Cleared', 'Partially Shipped', 'Partially Cancelled'].includes(status);
}

/**
 * Per-line edit gate. A line is editable only if:
 *   - the SO status is editable (above), AND
 *   - the line is not yet cancelled, AND
 *   - no quantity has shipped (shipped lines are locked even when the SO
 *     itself is still editable — you can't un-ship what's gone out).
 *
 * Pricing rules and summary-level modals must respect this for partially
 * shipped SOs: shipped lines stay locked while unshipped lines remain
 * editable through the new-version flow.
 */
export function isLineEditable(soStatus: string, line: { cancelled?: boolean; shippedQty?: number }): boolean {
  if (!isEditableStatus(soStatus)) return false;
  if (line.cancelled) return false;
  if ((line.shippedQty ?? 0) > 0) return false;
  return true;
}

/**
 * Build a summary string for the auto-version toast.
 */
export function buildVersionSummary(changes: FieldChange[]): string {
  if (changes.length === 0) return 'Changes applied';
  if (changes.length === 1) return changes[0].field;
  return `${changes[0].field} + ${changes.length - 1} other change${changes.length - 1 > 1 ? 's' : ''}`;
}
