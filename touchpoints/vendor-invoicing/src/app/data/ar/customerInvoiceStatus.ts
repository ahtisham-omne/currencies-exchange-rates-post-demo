import type { CustomerDeposit, DepositStatus } from './mockCustomerDeposits';
import type { CustomerInvoice, PreInvoiceTreatment } from './mockCustomerInvoices';

// All AR money math lives here as pure DERIVATIONS — the list, detail,
// KPIs and modals read the same functions so they can never disagree.
// Payment status per spec §8: Unpaid → Partially paid → Paid; Overdue
// is DERIVED from the due date while unpaid (never a stored state);
// Written off and Cancelled are terminal. Advance invoices track their
// deposit instead (Deposit awaited / Deposit received, §1.6 col 8);
// credit memos have no payment status (§1.9).

export type CustomerPaymentStatus =
  | 'Unpaid'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue'
  | 'Written Off'
  | 'Cancelled'
  | 'Deposit Awaited'
  | 'Deposit Received';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── FAD 11/2 helpers ──

/** Advance invoices only: Revenue or Deposit. A missing treatment is a
 *  legacy record and reads Deposit (FAD 11/2). Null for other kinds. */
export function treatmentOf(inv: CustomerInvoice): PreInvoiceTreatment | null {
  if (inv.docKind !== 'Advance Invoice') return null;
  return inv.treatment ?? 'Deposit';
}

/** Advance invoice revenue treatment (Mahreen 11/4 flow). Data stays
 *  Revenue | Deposit; the UI reads it as when revenue is booked. */
export const TREATMENT_LABEL: Record<PreInvoiceTreatment, string> = {
  Revenue: 'Revenue on Invoice',
  Deposit: 'Revenue on Shipment',
};

export const TREATMENT_HELPER: Record<PreInvoiceTreatment, string> = {
  Revenue: 'Books revenue now and locks the units to this customer.',
  Deposit: 'Holds payments as customer prepayment until the goods ship.',
};

/** Revise (FAD 11/2): a posted version replaced by a newer one. It stays
 *  in history but owes nothing and takes no money actions. */
export function isSuperseded(inv: CustomerInvoice): boolean {
  return !!inv.supersededById;
}

/** Deposit pre-invoice: value moved to revenue by shipments so far. */
export function settledTotal(inv: CustomerInvoice): number {
  return round2((inv.settlements ?? []).reduce((s, x) => s + x.amount, 0));
}

/** Deposit pre-invoice: what is still held in Customer Deposits. */
export function depositHeldRemaining(inv: CustomerInvoice): number {
  return Math.max(0, round2(inv.amount - settledTotal(inv)));
}

export function receiptsTotal(inv: CustomerInvoice): number {
  return round2(inv.receipts.reduce((s, r) => s + r.amount, 0));
}

export function depositsAppliedTotal(inv: CustomerInvoice): number {
  return round2(inv.depositApplications.reduce((s, d) => s + d.amount, 0));
}

/** Amount minus applied deposits, receipts, and credit memos — what the
 *  customer still owes (spec §1.9 "Net due"). Floors at zero. */
export function netDue(inv: CustomerInvoice): number {
  if (inv.docKind === 'Credit Memo' || isSuperseded(inv)) return 0;
  return Math.max(0, round2(inv.amount - depositsAppliedTotal(inv) - receiptsTotal(inv) - inv.creditApplied));
}

export function isOverdue(inv: CustomerInvoice, todayIso?: string): boolean {
  if (!inv.dueDate || inv.writtenOff || inv.invoiceStatus === 'Cancelled' || isSuperseded(inv)) return false;
  const today = todayIso ?? new Date().toISOString().split('T')[0];
  return inv.dueDate < today && netDue(inv) > 0.004;
}

export function daysOverdue(inv: CustomerInvoice, todayIso?: string): number {
  if (!inv.dueDate) return 0;
  const today = todayIso ?? new Date().toISOString().split('T')[0];
  const ms = new Date(today + 'T00:00:00').getTime() - new Date(inv.dueDate + 'T00:00:00').getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** The payment-status pill value; null for credit memos. */
export function paymentStatusOf(inv: CustomerInvoice, todayIso?: string): CustomerPaymentStatus | null {
  // A revised (superseded) version has no payment axis (FAD 11/2).
  if (inv.docKind === 'Credit Memo' || isSuperseded(inv)) return null;
  if (inv.docKind === 'Advance Invoice') {
    if (inv.invoiceStatus === 'Cancelled') return 'Cancelled';
    return inv.depositReceived ? 'Deposit Received' : 'Deposit Awaited';
  }
  if (inv.invoiceStatus === 'Cancelled') return 'Cancelled';
  if (inv.writtenOff) return 'Written Off';
  const due = netDue(inv);
  const covered = round2(depositsAppliedTotal(inv) + receiptsTotal(inv) + inv.creditApplied);
  if (due <= 0.004 && covered > 0.004) return 'Paid';
  if (isOverdue(inv, todayIso)) return 'Overdue';
  if (covered > 0.004) return 'Partially Paid';
  return 'Unpaid';
}

// ── Deposits ──

export function depositAppliedAmount(dep: CustomerDeposit): number {
  return round2(dep.applications.reduce((s, a) => s + a.amount, 0));
}

export function depositRemaining(dep: CustomerDeposit): number {
  if (dep.refunded) return 0;
  return Math.max(0, round2(dep.amount - depositAppliedAmount(dep) - (dep.refundedAmount ?? 0)));
}

export function depositStatusOf(dep: CustomerDeposit): DepositStatus {
  if (dep.refunded) return 'Refunded';
  const applied = depositAppliedAmount(dep);
  if (applied <= 0.004) return 'Held';
  if (applied < dep.amount - 0.004) return 'Partially Applied';
  return 'Fully Applied';
}

/** Deposits with money still held for a customer — SO-matched ones sort
 *  first when soNumbers are given (spec §6.3 scoping preference). */
export function heldDepositsFor(
  customer: string,
  deposits: CustomerDeposit[],
  opts?: { soNumbers?: string[] },
): CustomerDeposit[] {
  const held = deposits.filter((d) => d.customer === customer && depositRemaining(d) > 0.004);
  if (!opts?.soNumbers?.length) return held;
  const match = new Set(opts.soNumbers);
  return [...held].sort((a, b) => {
    const am = a.soNumber && match.has(a.soNumber) ? 0 : 1;
    const bm = b.soNumber && match.has(b.soNumber) ? 0 : 1;
    return am - bm;
  });
}

export function heldDepositsTotal(customer: string, deposits: CustomerDeposit[]): number {
  return round2(
    deposits.filter((d) => d.customer === customer).reduce((s, d) => s + depositRemaining(d), 0),
  );
}

/** Vendor parity (user 11/3): an open exception reads as the Status, like
 *  vendor invoicing, instead of a flag icon. Rejected and Cancelled keep
 *  their own status; the exception banner on the detail still explains it. */
export function showsExceptionStatus(inv: CustomerInvoice): boolean {
  return !!inv.exception && !inv.archived && !inv.supersededById && inv.invoiceStatus !== 'Rejected' && inv.invoiceStatus !== 'Cancelled';
}
