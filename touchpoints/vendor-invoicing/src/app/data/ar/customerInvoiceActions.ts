import type { ArPermissions } from '@/app/hooks/useArSettings';
import type { CustomerInvoice } from './mockCustomerInvoices';
import { receiptsTotal, depositsAppliedTotal, treatmentOf } from './customerInvoiceStatus';

// Row and detail action availability for customer invoices (PRD §14,
// §10, §15). Lifecycle: Draft → Pending Approval → Approved, with Send
// Back to Rejected, Cancel from Rejected, Archive / Restore on a
// cancelled invoice. Approved is final: corrections go through a
// customer credit memo. Sent is a flag, so Send turns into Resend.
// Payment actions (record payment, credit hold, write-off) are kept as
// they were until the Customer Payments PRD. Single source of truth for
// the listing menu and the detail Actions menu.

export type CustomerInvoiceActionId =
  | 'view'
  | 'edit'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'send'
  | 'resend'
  | 'downloadPdf'
  | 'recordPayment'
  | 'createBalanceInvoice'
  | 'issueCreditMemo'
  | 'creditHold'
  | 'releaseCreditHold'
  | 'writeOff'
  | 'cancel'
  | 'archive'
  | 'restore'
  | 'deleteDraft'
  | 'duplicate'
  // FAD 11/2
  | 'markDisputed'
  | 'resolveDispute'
  | 'flagException'
  | 'resolveException'
  | 'reviseInvoice'
  | 'refundPrepayment';

export type CustomerActionCategory = 'primary' | 'money' | 'workflow' | 'adjust' | 'output' | 'warning' | 'destructive';

export const CUSTOMER_CATEGORY_ORDER: CustomerActionCategory[] = ['money', 'primary', 'workflow', 'adjust', 'output', 'warning', 'destructive'];

const ACTION_CATEGORY: Record<CustomerInvoiceActionId, CustomerActionCategory> = {
  view: 'primary',
  edit: 'primary',
  duplicate: 'primary',
  recordPayment: 'money',
  submit: 'workflow',
  approve: 'workflow',
  reject: 'workflow',
  send: 'workflow',
  resend: 'workflow',
  createBalanceInvoice: 'workflow',
  issueCreditMemo: 'adjust',
  creditHold: 'adjust',
  releaseCreditHold: 'adjust',
  writeOff: 'adjust',
  downloadPdf: 'output',
  restore: 'output',
  cancel: 'destructive',
  archive: 'destructive',
  deleteDraft: 'destructive',
  markDisputed: 'warning',
  resolveDispute: 'warning',
  flagException: 'warning',
  resolveException: 'warning',
  reviseInvoice: 'adjust',
  refundPrepayment: 'money',
};

export interface CustomerInvoiceAction {
  id: CustomerInvoiceActionId;
  label: string;
  category: CustomerActionCategory;
  destructive?: boolean;
  requiresReason?: boolean;
}

const isCredit = (inv: CustomerInvoice) => inv.docKind === 'Credit Memo';

function labelFor(id: CustomerInvoiceActionId, inv: CustomerInvoice): string {
  const noun = isCredit(inv) ? 'Credit Memo' : 'Invoice';
  switch (id) {
    case 'view': return 'View Details';
    case 'edit': return inv.invoiceStatus === 'Rejected' ? 'Edit and Resubmit' : 'Edit';
    case 'submit': return 'Submit for Approval';
    case 'approve': return 'Approve';
    case 'reject': return 'Send Back';
    case 'send': return 'Send to Customer';
    case 'resend': return 'Resend to Customer';
    case 'downloadPdf': return 'Download PDF';
    case 'recordPayment': return inv.docKind === 'Advance Invoice' ? 'Record Deposit' : 'Record Payment';
    case 'createBalanceInvoice': return 'Bill Shipped Balance';
    // Vendor parity (FAD 11/2): "Add Credit Memo" everywhere in AR.
    case 'issueCreditMemo': return 'Add Credit Memo';
    case 'creditHold': return 'Put on Credit Hold';
    case 'releaseCreditHold': return 'Release Credit Hold';
    case 'writeOff': return 'Write Off Balance';
    case 'cancel': return `Cancel ${noun}`;
    case 'archive': return 'Archive';
    case 'restore': return 'Restore';
    case 'deleteDraft': return 'Delete Draft';
    case 'duplicate': return 'Duplicate';
    case 'markDisputed': return 'Flag as Disputed';
    case 'resolveDispute': return 'Resolve Dispute';
    case 'flagException': return 'Flag as Exception';
    case 'resolveException': return 'Resolve Exception';
    case 'reviseInvoice': return 'Revise Invoice';
    case 'refundPrepayment': return treatmentOf(inv) === 'Revenue' ? 'Reverse and Refund' : 'Refund Prepayment';
  }
}

const REASON_ACTIONS = new Set<CustomerInvoiceActionId>([
  'reject', 'cancel', 'creditHold', 'writeOff', 'archive',
  'markDisputed', 'resolveDispute', 'flagException', 'resolveException', 'reviseInvoice',
]);
const DESTRUCTIVE = new Set<CustomerInvoiceActionId>(['reject', 'cancel', 'archive', 'deleteDraft', 'writeOff']);

/** Receipts, applied deposits or credits on the invoice: Revise needs
 *  them reversed first (FAD 11/2). */
export function hasMoneyApplied(inv: CustomerInvoice): boolean {
  return receiptsTotal(inv) > 0.004 || depositsAppliedTotal(inv) > 0.004 || inv.creditApplied > 0.004;
}

function idsFor(inv: CustomerInvoice): CustomerInvoiceActionId[] {
  const credit = isCredit(inv);
  // Revise (FAD 11/2): a replaced version keeps only view and the PDF.
  if (inv.supersededById) return ['downloadPdf'];
  const exceptionToggle: CustomerInvoiceActionId[] = credit ? [] : [inv.exception ? 'resolveException' : 'flagException'];
  switch (inv.invoiceStatus) {
    case 'Draft':
      return ['edit', 'submit', 'downloadPdf', 'duplicate', ...exceptionToggle, 'deleteDraft'];
    case 'Pending Approval':
      return ['approve', 'reject', 'edit', 'downloadPdf', 'duplicate', ...exceptionToggle];
    case 'Rejected':
      return ['edit', 'downloadPdf', 'duplicate', 'cancel'];
    case 'Approved': {
      const ids: CustomerInvoiceActionId[] = [];
      if (!credit) ids.push('recordPayment');
      ids.push(inv.sentAt ? 'resend' : 'send');
      // FAD 11/2: a Deposit pre-invoice settles on the SAME invoice as each
      // shipment goes out, so once it has settlements there is no second
      // (balance) invoice. Confirm with Eli.
      const advance = inv.docKind === 'Advance Invoice';
      const settlesInPlace = advance && treatmentOf(inv) === 'Deposit' && (inv.settlements?.length ?? 0) > 0;
      if (advance && !settlesInPlace) ids.push('createBalanceInvoice');
      if (advance && inv.depositReceived && !inv.prepaymentReversal) ids.push('refundPrepayment');
      if (!credit) ids.push('issueCreditMemo');
      if (!credit && !(advance && inv.prepaymentReversal)) ids.push('reviseInvoice');
      ids.push('downloadPdf');
      if (!credit) ids.push('duplicate');
      if (!credit && inv.sentAt && !advance) ids.push('writeOff');
      if (!credit && !inv.writtenOff) ids.push(inv.disputed ? 'resolveDispute' : 'markDisputed');
      ids.push(...exceptionToggle);
      return ids;
    }
    case 'Cancelled':
      return inv.archived ? ['restore', 'downloadPdf'] : ['downloadPdf', 'duplicate', 'archive'];
    default:
      return ['downloadPdf'];
  }
}

const NEEDS: Partial<Record<CustomerInvoiceActionId, keyof ArPermissions>> = {
  edit: 'canCreate',
  submit: 'canCreate',
  duplicate: 'canCreate',
  deleteDraft: 'canCreate',
  cancel: 'canCreate',
  archive: 'canCreate',
  restore: 'canCreate',
  createBalanceInvoice: 'canCreate',
  issueCreditMemo: 'canCreate',
  approve: 'canApprove',
  reject: 'canApprove',
  send: 'canSend',
  resend: 'canSend',
  recordPayment: 'canSend',
  creditHold: 'canApprove',
  releaseCreditHold: 'canApprove',
  writeOff: 'canApprove',
  markDisputed: 'canApprove',
  resolveDispute: 'canApprove',
  flagException: 'canCreate',
  resolveException: 'canApprove',
  reviseInvoice: 'canCreate',
  refundPrepayment: 'canSend',
};

export function getCustomerRowActions(inv: CustomerInvoice, perms?: ArPermissions): CustomerInvoiceAction[] {
  let ids = idsFor(inv);
  // Credit hold toggles by current state; a held invoice can't take
  // money or be sent until released.
  if (!isCredit(inv) && inv.invoiceStatus === 'Approved') {
    ids = inv.creditHold
      ? ['releaseCreditHold', ...ids.filter((id) => id !== 'recordPayment' && id !== 'send' && id !== 'resend')]
      : [...ids, 'creditHold'];
  }
  if (perms) {
    ids = ids.filter((id) => {
      const need = NEEDS[id];
      if (!need) return true;
      if (perms.advanceFromQuoteOnly && need === 'canCreate') return inv.docKind === 'Advance Invoice' && !!inv.quoteNumber && id !== 'issueCreditMemo';
      return !!perms[need];
    });
  }
  return ids.map((id) => ({
    id,
    label: labelFor(id, inv),
    category: ACTION_CATEGORY[id],
    destructive: DESTRUCTIVE.has(id) || undefined,
    requiresReason: REASON_ACTIONS.has(id) || undefined,
  }));
}

export function getCustomerRowActionGroups(inv: CustomerInvoice, perms?: ArPermissions): CustomerInvoiceAction[][] {
  const actions = getCustomerRowActions(inv, perms);
  return CUSTOMER_CATEGORY_ORDER.map((cat) => actions.filter((a) => a.category === cat)).filter((g) => g.length > 0);
}
