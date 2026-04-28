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
  'contact_person',
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
 * Draft: full edit
 * Sent to Customer / Confirmed by Customer: editing creates a new draft auto
 * Converted to SO: read-only (only duplicate or cancel)
 */
export type EditableStatus = 'draft' | 'sent' | 'confirmed';
export type ReadOnlyStatus = 'converted' | 'cancelled' | 'archived' | 'expired';

export function isEditableStatus(status: string): boolean {
  return status === 'draft' || status === 'sent' || status === 'confirmed';
}

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