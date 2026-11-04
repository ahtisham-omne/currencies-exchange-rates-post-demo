/* ── Credit memos as real records (9/22/26 review response) ────────────
 * The Sept 20 reviews found credit memos living in session-local state:
 * a $1 credit vanished on reopen (GPT F03), its number linked nowhere
 * (F16 / Claude C06-X1), and its amount surfaced as "Paid" (F19). Memos
 * now live in App state like invoices and payments: they persist across
 * navigation, settle the invoice for real, render as "Credited", and
 * open a real detail page at /credit-memos/:creditMemoNumber.
 */

export interface CreditMemo {
  id: string;
  creditMemoNumber: string;
  vendor: string;
  /** The invoice the memo was applied against. */
  invoiceNumber: string;
  invoiceType: string;
  date: string;
  reason: string;
  description: string;
  amount: number;
  currency: string;
  /** Supporting document names attached at creation. */
  attachments?: string[];
  createdBy: string;
  status: 'Applied' | 'Void';
}
