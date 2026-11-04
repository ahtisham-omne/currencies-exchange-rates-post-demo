// Single source of truth for invoice action availability.
// Encodes the PRD's row-action matrix (§1.7.2) and bulk-action matrix (§1.6.2).
// Status strings must match exactly the invoice.status values seeded in mockInvoices.

import type { Invoice } from '@/app/data/mockInvoices';
import { cashPaidOn } from '@/app/lib/invoiceCash';

export type InvoiceActionId =
  | 'view'
  | 'export'
  | 'print'
  | 'submit'
  | 'resubmit'
  | 'edit'
  | 'approve'
  | 'reject'
  | 'flagException'
  | 'resolve'
  | 'addPayment'
  | 'addPrepayment'
  | 'reversePayment'
  | 'paymentHold'
  | 'releaseHold'
  | 'addCreditMemo'
  | 'archive'
  | 'cancel'
  | 'uncancel'
  | 'restore'
  | 'download'
  | 'match';

// Menu segregation buckets (mirrors the partner listing/detail action menu):
// actions are grouped by intent, and groups render top→bottom by meaning.
// Order rev 7/16/26: pay first (an approver can pay a pending invoice
// directly, payment implies approval), then the approve/reject decision
// group, then balance adjustments (hold, credit memo, reversal), then
// output, with flag/cancel/archive pinned at the bottom.
export type InvoiceActionCategory =
  | 'primary'
  | 'money'
  | 'workflow'
  | 'adjust'
  | 'output'
  | 'warning'
  | 'destructive';

export const INVOICE_CATEGORY_ORDER: InvoiceActionCategory[] = [
  'money',
  'primary',
  'workflow',
  'adjust',
  'output',
  'warning',
  'destructive',
];

const ACTION_CATEGORY: Record<InvoiceActionId, InvoiceActionCategory> = {
  view: 'primary',
  edit: 'primary',
  match: 'primary',
  addPayment: 'money',
  addPrepayment: 'money',
  submit: 'workflow',
  resubmit: 'workflow',
  approve: 'workflow',
  reject: 'workflow',
  resolve: 'workflow',
  releaseHold: 'workflow',
  uncancel: 'workflow',
  restore: 'workflow',
  paymentHold: 'adjust',
  addCreditMemo: 'adjust',
  reversePayment: 'adjust',
  export: 'output',
  print: 'output',
  download: 'output',
  flagException: 'warning',
  cancel: 'destructive',
  archive: 'destructive',
};

export interface InvoiceAction {
  id: InvoiceActionId;
  label: string;
  category: InvoiceActionCategory;
  destructive?: boolean;
  /** True when this action mutates persistent state and should be confirmed. */
  requiresReason?: boolean;
}

// Action availability matrix per status — owns the BA-approved
// state→action mapping below. Order in each array drives the
// order options appear in the row's overflow menu and the detail-
// page Available Actions panel.
//
// "View Details" was removed 7/16/26 — clicking the row opens the
// detail, the menu holds only real actions. Draft was retired from
// the workflow — new invoices land directly in "Pending Approval".
// Matches the lifecycle specs' quick-reference tables (7/15/26):
// - An approver can Add Payment on a pending invoice directly; the
//   payment auto-approves it (one step, no approve-then-pay).
// - Payment Hold is placeable at ANY time, not only after approval
//   (meeting feedback 7/17/26) — a control state can precede payability.
// - Rejected is FIXABLE: fix and resubmit returns it to Pending Approval;
//   it can also be cancelled. No archive shortcut.
// - Cancel is additionally gated on $0 paid (see getRowActions).
const STATUS_ACTIONS: Record<string, InvoiceActionId[]> = {
  'Pending Approval': ['addPayment', 'approve', 'reject', 'paymentHold', 'export', 'print', 'flagException', 'cancel'],
  Approved: ['addPayment', 'paymentHold', 'addCreditMemo', 'export', 'print', 'cancel'],
  'Partially Paid': ['addPayment', 'paymentHold', 'addCreditMemo', 'reversePayment', 'export', 'print'],
  // No credit memos once fully paid; Reverse Payment is the only
  // state action left (spec quick-reference table).
  'Paid in Full': ['reversePayment', 'export', 'print'],
  // Settled = zeroed by a credit memo, no cash moved — there is no
  // payment to reverse (feedback 7/21/26).
  Settled: ['export', 'print'],
  Exception: ['resolve', 'paymentHold', 'export', 'print', 'cancel'],
  Rejected: ['resubmit', 'export', 'print', 'cancel'],
  Cancelled: ['uncancel', 'export', 'print', 'archive'],
  // Pre-invoice prepaid lifecycle — prepayment rows come from the
  // type-conditional injection; credit memos and reversals per spec.
  'Partially Prepaid': ['addPrepayment', 'paymentHold', 'addCreditMemo', 'reversePayment', 'export', 'print'],
  Prepaid: ['addCreditMemo', 'reversePayment', 'export', 'print'],
};

// Quick row-hover actions per status — the two most-likely next
// actions surface as icons next to each row when bulk-mode isn't on.
const QUICK_ACTIONS: Record<string, [InvoiceActionId, InvoiceActionId]> = {
  'Pending Approval': ['approve', 'reject'],
  Approved: ['addPayment', 'paymentHold'],
  'Partially Paid': ['addPayment', 'paymentHold'],
  'Paid in Full': ['reversePayment', 'export'],
  Settled: ['export', 'print'],
  Exception: ['resolve', 'cancel'],
  Rejected: ['resubmit', 'cancel'],
  Cancelled: ['uncancel', 'archive'],
  'Partially Prepaid': ['addPrepayment', 'reversePayment'],
  Prepaid: ['reversePayment', 'export'],
};

// Category is injected at every build site from ACTION_CATEGORY, so the
// meta entries carry only the label + flags.
const ACTION_META: Record<InvoiceActionId, Omit<InvoiceAction, 'id' | 'category'>> = {
  view: { label: 'View Details' },
  export: { label: 'Export Invoice' },
  print: { label: 'Print Invoice' },
  submit: { label: 'Submit for Approval' },
  resubmit: { label: 'Edit and Resubmit' },
  edit: { label: 'Edit' },
  approve: { label: 'Approve' },
  reject: { label: 'Reject', destructive: true, requiresReason: true },
  flagException: { label: 'Flag as Exception', requiresReason: true },
  resolve: { label: 'Resolve' },
  addPayment: { label: 'Add Payment' },
  addPrepayment: { label: 'Add Prepayment' },
  reversePayment: { label: 'Reverse Payment', requiresReason: true },
  paymentHold: { label: 'Payment Hold', requiresReason: true },
  releaseHold: { label: 'Release Hold' },
  addCreditMemo: { label: 'Add Credit Memo' },
  archive: { label: 'Archive' },
  cancel: { label: 'Cancel Invoice', destructive: true, requiresReason: true },
  uncancel: { label: 'Uncancel Invoice', requiresReason: true },
  restore: { label: 'Restore', requiresReason: true },
  download: { label: 'Download' },
  match: { label: 'Match' },
};

/** True when nothing has been paid against the invoice — the lifecycle
 *  specs allow cancelling a posted invoice only in this window; anything
 *  paid must be reversed first. */
export function isCancellable(inv: Pick<Invoice, 'outstandingBalance' | 'amount' | 'creditedAmount'>): boolean {
  // Cash only: a credit memo is not a payment (Mahreen 10/10).
  return cashPaidOn(inv) <= 0.004;
}

/** Hold flag over a status's action ids: Payment Hold becomes Release
 *  Hold and the pay actions drop (a held invoice can't be paid). */
function applyHoldFlag(ids: InvoiceActionId[]): InvoiceActionId[] {
  return ids
    .filter((id) => id !== 'addPayment' && id !== 'addPrepayment')
    .map((id): InvoiceActionId => (id === 'paymentHold' ? 'releaseHold' : id));
}

type RowActionInvoice = Pick<Invoice, 'outstandingBalance' | 'amount'> &
  Partial<Pick<Invoice, 'creditedAmount' | 'isArchived' | 'type'>> & { is_payment_held?: boolean };

export function getRowActions(status: string, invoice?: RowActionInvoice): InvoiceAction[] {
  // Archived (Mahreen 10/10): the row reads Archived and its ONLY action
  // is Restore, same as the detail page.
  if (invoice?.isArchived) return [{ id: 'restore', category: ACTION_CATEGORY.restore, ...ACTION_META.restore }];
  let ids = STATUS_ACTIONS[status] ?? ['export', 'print'];
  // Pre-invoice credit memo (Mahreen 10/10): only while something is
  // still owed; inventory and standalone keep the status matrix.
  if (invoice?.type === 'Pre-Invoice' && invoice.outstandingBalance <= 0.004) {
    ids = ids.filter((id) => id !== 'addCreditMemo');
  }
  // Reverse Payment only where cash was actually paid (Mahreen 10/10).
  if (invoice && cashPaidOn(invoice) <= 0.004) {
    ids = ids.filter((id) => id !== 'reversePayment');
  }
  // Payment hold is a flag beside any status (ERP-8796, AC4/AC5): the
  // status actions stay as they are, Payment Hold swaps for Release Hold,
  // and Add Payment / Add prepayment drop out while the hold is open.
  if (invoice?.is_payment_held) ids = applyHoldFlag(ids);
  return ids
    .filter((id) => id !== 'cancel' || !invoice || isCancellable(invoice))
    .map((id) => ({ id, category: ACTION_CATEGORY[id], ...ACTION_META[id] }));
}

// Same actions as getRowActions, but bucketed into ordered category groups so
// the menu can render dividers between them (partner-style segregation). Groups
// preserve the within-status order and drop empty buckets.
export function getRowActionGroups(status: string, invoice?: RowActionInvoice): InvoiceAction[][] {
  const actions = getRowActions(status, invoice);
  return INVOICE_CATEGORY_ORDER.map((cat) =>
    actions.filter((a) => a.category === cat),
  ).filter((group) => group.length > 0);
}

export function getQuickActions(status: string, invoice?: Pick<Invoice, 'isArchived'> & { is_payment_held?: boolean }): InvoiceAction[] {
  if (invoice?.isArchived) return [{ id: 'restore', category: ACTION_CATEGORY.restore, ...ACTION_META.restore }];
  let pair: InvoiceActionId[] = QUICK_ACTIONS[status] ?? ['export', 'print'];
  if (invoice?.is_payment_held) {
    // Release Hold leads on a held row; the payment quick actions drop.
    pair = ['releaseHold' as InvoiceActionId, ...applyHoldFlag(pair).filter((id) => id !== 'releaseHold')].slice(0, 2);
  }
  return pair.map((id) => ({ id, category: ACTION_CATEGORY[id], ...ACTION_META[id] }));
}

// Bulk action set — CURATED (rev 7/16/26): the bar offers the handful of
// actions that make sense in bulk (approve, reject, pay, export, print),
// not every row action at once. State-recovery actions (release hold,
// resolve, resubmit, archive) appear ONLY when the whole selection shares
// that state — e.g. select a batch of held invoices and Release Hold shows.
const CORE_BULK: Array<{ id: InvoiceActionId; targets: string[] }> = [
  { id: 'approve', targets: ['Pending Approval'] },
  { id: 'reject', targets: ['Pending Approval'] },
  // No bulk Add Payment (Nophil 9/28): paying many invoices at once IS a
  // payment run — the run flow owns batching, accounts and remittance.
  // Add Payment stays a row-level action.
  // Export / Print removed from the bulk bar (user 10/5): they stay as
  // row-level and detail-page actions (STATUS_ACTIONS / QUICK_ACTIONS),
  // but the bulk selection bar no longer offers them on any grid.
];

const CONTEXTUAL_BULK: Array<{ id: InvoiceActionId; when: string }> = [
  { id: 'releaseHold', when: 'Payment Hold' },
  { id: 'resolve', when: 'Exception' },
  { id: 'resubmit', when: 'Rejected' },
  { id: 'archive', when: 'Cancelled' },
];

export interface BulkActionEntry extends InvoiceAction {
  /** Number of selected invoices this action applies to. */
  eligibleCount: number;
}

export function getBulkActions(selected: Invoice[]): BulkActionEntry[] {
  if (selected.length === 0) return [];
  const entries: BulkActionEntry[] = [];
  const push = (id: InvoiceActionId, eligibleCount: number) => {
    if (eligibleCount > 0) entries.push({ id, category: ACTION_CATEGORY[id], ...ACTION_META[id], eligibleCount });
  };

  // Contextual recovery actions lead when the whole selection shares the
  // state — that IS the user's intent for that selection. A pre-approval
  // hold counts as held even though the status kept its queue place.
  for (const { id, when } of CONTEXTUAL_BULK) {
    const matches = (inv: Invoice) =>
      inv.status === when || (id === 'releaseHold' && inv.is_payment_held === true);
    if (selected.every(matches)) push(id, selected.length);
  }

  for (const { id, targets } of CORE_BULK) {
    const count = targets.length === 0
      ? selected.length
      : selected.filter((inv) =>
          targets.includes(inv.status) &&
          // Held invoices can't take a payment (feedback 7/21/26).
          !(id === 'addPayment' && inv.is_payment_held),
        ).length;
    push(id, count);
  }
  return entries;
}
