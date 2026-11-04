import { Invoice, mockInvoices } from '@/app/data/mockInvoices';
import { Payment, mockPayments } from '@/app/data/mockPayments';
import { SEED_RUN_PAYMENTS } from '@/app/data/paymentRuns';
import { getLinkedFinancials, countsTowardBalance, type LinkedFinancialRecord } from '@/app/data/invoiceLinkedRecords';
import type { PaymentRecord } from '@/app/components/invoice-details/ReversePaymentModal';

// One source for "which payments can this invoice reverse" (10/9/26):
// the detail page and the listing row action both open the same
// ReversePaymentModal, so both must list the same records.

/** Payment references already reversed on this invoice, read from the
 *  action history App writes on every reversal ("PAY-123 reversed: …"
 *  or "Payment PAY-123 reversed"), so a reversal survives navigation. */
export function reversedRefsFromHistory(invoice: Invoice): Set<string> {
  const refs = new Set<string>();
  (invoice.actionHistory ?? []).forEach((e) => {
    if (e.action !== 'reversePayment' || !e.reason) return;
    const m = /^(?:Payment\s+)?(\S+)\s+reversed/.exec(e.reason);
    if (m) refs.add(m[1]);
  });
  return refs;
}

/** Map linked records + app payments to the reversal modal's rows. */
export function reversiblePaymentsFrom(
  records: LinkedFinancialRecord[],
  invoice: Invoice,
  payments: Payment[],
  invoices: Invoice[],
): PaymentRecord[] {
  // Pre-invoices settle through prepayments, so the reversal flow lists
  // their PREPAYMENT records instead (lifecycle spec 7/15/26).
  const reversibleType = invoice.type === 'Pre-Invoice' ? 'Prepayment' : 'Payment';
  const fromLinked = records
    .filter((r) => r.type === reversibleType && countsTowardBalance(r.status as any))
    .map((r) => ({
      id: r.id,
      reference: r.reference,
      date: r.date,
      amount: r.amount,
      appliedTo: [{ invoiceNumber: invoice.invoiceNumber, applied: r.amount, outstanding: invoice.outstandingBalance }],
    }));
  // App-recorded payments applied to this invoice appear too, so every
  // payment on the Payments tab is reversible (feedback 7/15/26). The
  // against-card lists EVERY invoice the payment touched (BA 9/6).
  const fromApp = payments
    .filter((p) => p.type === reversibleType && p.status === 'Paid')
    .flatMap((p) =>
      (p.appliedInvoices ?? [])
        .filter((a) => a.invoiceNumber === invoice.invoiceNumber)
        .map(() => ({
          id: p.id,
          reference: p.paymentNumber,
          paymentNumber: p.paymentNumber,
          date: p.paymentDate,
          // The record's FULL amount (9/22/26 review response): the
          // dialog reverses the whole payment, so it names the whole
          // payment — the per-invoice slice rides appliedTo below.
          amount: p.amount,
          bankAccount: p.bankAccount,
          apAccount: p.apAccount,
          glEntries: p.glEntries,
          appliedCreditTotal: Math.round(((p.appliedCredits ?? []).reduce((s, c) => s + c.amount, 0)) * 100) / 100,
          // The persisted split carries cash + credit per invoice;
          // records predating it fall back to cash allocations.
          appliedTo: (p.perInvoiceSplit && p.perInvoiceSplit.length > 0
            ? p.perInvoiceSplit.map((s) => ({ invoiceNumber: s.invoiceNumber, applied: Math.round((s.cash + s.credit) * 100) / 100 }))
            : (p.appliedInvoices ?? []).map((ai) => ({ invoiceNumber: ai.invoiceNumber, applied: ai.amount }))
          ).map((row) => ({
            ...row,
            outstanding: invoices.find((i) => i.invoiceNumber === row.invoiceNumber)?.outstandingBalance ?? 0,
          })),
        })),
    );
  const seen = new Set(fromLinked.map((r) => r.reference));
  return [...fromLinked, ...fromApp.filter((r) => !seen.has(r.reference))];
}

/** Full derivation for surfaces without the detail page's linked-records
 *  state (the listing row action): same seed decomposition, same
 *  session prepayments, reversed rows retired. */
export function buildReversiblePayments(
  invoice: Invoice,
  invoices: Invoice[],
  payments: Payment[],
  extraReversedRefs: Iterable<string> = [],
): PaymentRecord[] {
  const seedInvoice = mockInvoices.find((m) => m.id === invoice.id) ?? invoice;
  const bootRealSettled = Math.round(
    [...SEED_RUN_PAYMENTS, ...mockPayments]
      .filter((p) => p.status !== 'Reversed' && p.status !== 'Void')
      .reduce((s, p) => s + (p.appliedInvoices?.find((a) => a.invoiceNumber === invoice.invoiceNumber)?.amount ?? 0), 0) * 100,
  ) / 100;
  const base = getLinkedFinancials(seedInvoice, seedInvoice.amount, bootRealSettled);
  const reversed = reversedRefsFromHistory(invoice);
  for (const ref of extraReversedRefs) reversed.add(ref);
  const existingRefs = new Set(base.records.map((r) => r.reference));
  const sessionPrepays: LinkedFinancialRecord[] = payments
    .filter(
      (p) =>
        p.type === 'Prepayment' &&
        (p.preInvoiceId === invoice.invoiceNumber || p.preInvoiceId === invoice.id) &&
        !existingRefs.has(p.paymentNumber),
    )
    .map((p) => ({
      id: `pp-${p.id}`,
      type: 'Prepayment' as const,
      reference: p.paymentNumber,
      description: p.memo || `Advance to ${p.vendor}`,
      status: p.status === 'Reversed' ? ('Reversed' as const) : ('Applied' as const),
      date: p.paymentDate,
      amount: p.amount,
      createdBy: p.createdBy,
      updatedBy: p.createdBy,
    }));
  const records = [
    ...base.records.map((r) =>
      (r.type === 'Payment' || r.type === 'Prepayment') && reversed.has(r.reference)
        ? { ...r, status: 'Reversed' as const }
        : r,
    ),
    ...sessionPrepays,
  ];
  return reversiblePaymentsFrom(records, invoice, payments, invoices);
}
