/**
 * Versioning Engine for Quote Module
 *
 * Classifies field changes as:
 * - MATERIAL:     auto-triggers a new version (when in Draft)
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
  'pricing_quote',
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
     material. They carry no pricing or commitment impact so post-Sent /
     post-Confirmed edits must never fire the version prompt. */
  'contact_person',
  'pocs',
  'primary_poc',
  'priority',
  'tags',
  'win_probability',
  'description',
]);

// ── Ask-user changes ─────────────────────────────────────────────────────────
const ASK_USER_FIELDS = new Set([
  'instruction_quote',
  'instruction_item',
  'attachment_quote',
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
  line_item_add:  'Changes what is being sold',
  line_item_delete: 'Changes what is being sold',
  line_item_modify: 'Changes what is being sold',
  quantity:       'Changes how much is being sold',
  uom:            '500 units vs 500 cases is a different deal',
  pricing_line:   'Changes the financial commitment',
  pricing_quote:  'Changes the financial commitment',
  unit_price:     'Changes the financial commitment',
  pricing_rule:   'Changes the financial commitment',
  adjustment:     'Changes the financial commitment',
  currency:       'Changes the denomination of the entire deal',
  customer:       'Changes who the deal is with',
  partner:        'Changes who the deal is with',
  ship_to:        'Changes delivery destination',
  bill_to:        'Changes the legal payment party',
  expiry_date:    'Changes the guarantee window for pricing and terms',
  due_by_date:    'Changes the guarantee window for pricing and terms',
  payment_terms:  'Changes the financial obligation timeline',
};

/**
 * Statuses where the quote is editable (changes can be made).
 *
 * Draft + Sent to Customer: full edit, no version bump — sales is still
 *   iterating with the customer.
 * Confirmed by Customer ('confirmed'): customer has approved; any material
 *   change forks a new draft version to keep the approved copy intact.
 * Converted to SO ('converted'): terminal — no edits, no new versions.
 *   Only Archive / Cancel / Duplicate (as a new draft Quote) is allowed
 *   at this point. The same lock applies to Cancelled / Archived / Expired.
 */
export type EditableStatus = 'draft' | 'sent' | 'confirmed';
export type ReadOnlyStatus = 'converted' | 'cancelled' | 'archived' | 'expired';

export function isEditableStatus(status: string): boolean {
  return status === 'draft' || status === 'sent' || status === 'confirmed';
}

/**
 * Material-change new-draft gate.
 *
 * Triggers from Sent to Customer onwards. Once the proposal has been
 * sent, the customer has a copy of it; any material change has to fork
 * a new version so the original sent revision stays intact and the
 * customer-visible record matches what they actually saw. Edits while
 * the quote is still in Draft flow through in-place because nothing
 * external has seen the values yet. After conversion to SO, this engine
 * returns false because the quote is read-only — material changes belong
 * on the SO side, not the quote.
 */
export function requiresNewDraftFirst(status: string): boolean {
  return status === 'sent' || status === 'confirmed';
}

/**
 * Build a summary string for the auto-version toast, listing what changed.
 */
export function buildVersionSummary(changes: FieldChange[]): string {
  if (changes.length === 0) return 'Changes applied';
  if (changes.length === 1) return changes[0].field;
  return `${changes[0].field} + ${changes.length - 1} other change${changes.length - 1 > 1 ? 's' : ''}`;
}