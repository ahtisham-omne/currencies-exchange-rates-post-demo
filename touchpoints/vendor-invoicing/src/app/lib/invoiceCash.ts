import type { Invoice } from '@/app/data/mockInvoices';

/** Cash actually paid against an invoice (Mahreen 10/10): the balance
 *  reduction minus any credit memos. A credit lowers what is owed but is
 *  never a payment, so "partially paid", Reverse Payment and the cancel
 *  window all read this, never `amount - outstanding`. */
export function cashPaidOn(inv: Pick<Invoice, 'amount' | 'outstandingBalance' | 'creditedAmount'>): number {
  return Math.max(0, Math.round((inv.amount - inv.outstandingBalance - (inv.creditedAmount ?? 0)) * 100) / 100);
}
