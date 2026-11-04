// Single source of truth for payment action availability — PRD §4
// "Actions (row + bulk): Open, Void/Reverse, Download
// remittance, Assign prepayment (for unapplied prepayments)."
// Status strings must match exactly the values seeded in mockPayments.

import type { Payment } from '@/app/data/mockPayments';

export type PaymentActionId =
  | 'view'
  | 'edit'
  | 'download'
  | 'markPaid'
  | 'applyPrepayment'
  | 'reverse'
  | 'void';

// Menu segregation buckets (mirrors the partner listing/detail action menu):
// groups render top→bottom by meaning — open/edit first, then the
// forward-workflow (apply), output, and finally the red "destructive"
// state-change actions pinned at the bottom, each separated by a divider.
export type PaymentActionCategory =
  | 'primary'
  | 'workflow'
  | 'output'
  | 'destructive';

export const PAYMENT_CATEGORY_ORDER: PaymentActionCategory[] = [
  'primary',
  'workflow',
  'output',
  'destructive',
];

const ACTION_CATEGORY: Record<PaymentActionId, PaymentActionCategory> = {
  view: 'primary',
  edit: 'primary',
  markPaid: 'workflow',
  applyPrepayment: 'workflow',
  download: 'output',
  reverse: 'destructive',
  void: 'destructive',
};

export interface PaymentAction {
  id: PaymentActionId;
  label: string;
  category: PaymentActionCategory;
  destructive?: boolean;
  /** True when this action mutates persistent state and should be confirmed. */
  requiresReason?: boolean;
}

// Action availability matrix per status. One canonical set (feedback
// 7/22/26): View details, Mark as reversed, Void payment, Download
// remittance advice — the SAME actions the detail page offers, so the
// listing menu and the detail Actions stay consistent. "Assign
// Prepayment" was retired everywhere. Mark as reversed shows once money
// has gone out (Paid, or a prepayment sitting on account); Void shows
// until the record is already reversed or voided.
const STATUS_ACTIONS: Record<string, PaymentActionId[]> = {
  // ── Payment lifecycle ──
  // Mark as paid completes a scheduled payment (it isn't paid yet, so
  // there's nothing to reverse); void or mark-paid are the moves.
  Scheduled: ['view', 'markPaid', 'void', 'download'],
  Paid: ['view', 'reverse', 'void', 'download'],
  Reversed: ['view', 'download'],
  Cancelled: ['view', 'download'],
  // ── Prepayment lifecycle (money out → reversible + voidable) ──
  Unapplied: ['view', 'reverse', 'void', 'download'],
  'Partially Applied': ['view', 'reverse', 'void', 'download'],
  'Fully Applied': ['view', 'reverse', 'void', 'download'],
};

const ACTION_META: Record<PaymentActionId, Omit<PaymentAction, 'id' | 'category'>> = {
  view: { label: 'View Details' },
  edit: { label: 'Edit' },
  markPaid: { label: 'Mark as Paid' },
  download: { label: 'Download Remittance Advice' },
  applyPrepayment: { label: 'Assign Prepayment' },
  reverse: { label: 'Mark as Reversed', destructive: true, requiresReason: true },
  void: { label: 'Void Payment', destructive: true, requiresReason: true },
};

export function getRowActions(status: string): PaymentAction[] {
  const ids = STATUS_ACTIONS[status] ?? ['view', 'download'];
  return ids.map((id) => ({ id, category: ACTION_CATEGORY[id], ...ACTION_META[id] }));
}

// Same actions as getRowActions, bucketed into ordered category groups so the
// menu can render dividers between them (partner-style segregation).
export function getRowActionGroups(status: string): PaymentAction[][] {
  const actions = getRowActions(status);
  return PAYMENT_CATEGORY_ORDER.map((cat) =>
    actions.filter((a) => a.category === cat),
  ).filter((group) => group.length > 0);
}

// Bulk action matrix — every action lists the statuses it can target so
// the bulk bar can never offer an action against the wrong status.
const ALL_STATUSES = Object.keys(STATUS_ACTIONS);

const BULK_TARGETS: Record<PaymentActionId, string[]> = {
  view: [],
  edit: [],
  download: ALL_STATUSES,
  markPaid: ['Scheduled'],
  applyPrepayment: [],
  reverse: ['Paid', 'Unapplied', 'Partially Applied', 'Fully Applied'],
  void: ['Scheduled', 'Paid', 'Unapplied', 'Partially Applied', 'Fully Applied'],
};

// Mark as paid is back in the bulk bar for scheduled payments (user
// 10/27/26, reverses the 10/22 row-only call).
const BULK_ACTION_ORDER: PaymentActionId[] = ['markPaid', 'reverse', 'void', 'download'];

/** Whether a bulk action applies to this payment (its status is a target). */
export function isBulkEligible(id: PaymentActionId, payment: Payment): boolean {
  return BULK_TARGETS[id].includes(payment.status);
}

export interface BulkActionEntry extends PaymentAction {
  /** Number of selected payments this action applies to. */
  eligibleCount: number;
}

export function getBulkActions(selected: Payment[]): BulkActionEntry[] {
  return BULK_ACTION_ORDER.map((id) => {
    const targets = BULK_TARGETS[id];
    const eligibleCount =
      targets.length === 0 ? 0 : selected.filter((p) => targets.includes(p.status)).length;
    return { id, category: ACTION_CATEGORY[id], ...ACTION_META[id], eligibleCount };
  }).filter((entry) => entry.eligibleCount > 0);
}
