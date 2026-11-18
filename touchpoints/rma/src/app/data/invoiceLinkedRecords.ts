import type { Invoice } from './mockInvoices';

// Linked financial records (prepayments / payments / credit memos) for an
// invoice — the single source of truth shared by the detail page header,
// the sidebar Invoice Summary, and the Linked Records tab so every surface
// shows the same balance composition:
//
//   invoice total − prepayments − payments − credit memos = outstanding
//
// Records are synthesized deterministically (seeded off the invoice number)
// so the same invoice keeps the same records across reloads — but only for
// the slice the invoice data says is already settled (total − outstanding).
// An unpaid invoice has NO counting documents and shows Paid $0; terminal
// Cancelled / Rejected invoices show documents as Reversed / Void —
// present, but excluded from totals.

export type LinkedGroupType =
  | 'Purchase Order'
  | 'Receiving Document'
  // A return's own chain. Linked Records is the one place to find every
  // transaction that touches a document, so a line that reads partially paid
  // has the invoice and the payment here, and a return that has shipped or
  // settled has what it raised on the way.
  | 'Vendor Invoice'
  | 'Picking Document'
  | 'Shipping Document'
  | 'Reversal'
  | 'Unlinked'
  | 'Prepayment'
  | 'Payment'
  | 'Credit Memo';

// Status describes the record's APPLICATION TO THIS INVOICE — not the
// record's own lifecycle. Reversed / Returned / Void mark records that
// stopped counting toward the balance.
export type LinkedApplicationStatus =
  | 'Applied'
  | 'Partially applied'
  | 'Reversed'
  | 'Returned'
  | 'Void';

// Procurement documents (POs / receiving) sit upstream of the invoice — they
// are reference links, not financial applications, so they never change the
// invoice balance. Their statuses describe the procure-to-pay progress.
export type LinkedProcurementStatus =
  | 'Open'
  | 'Partially invoiced'
  | 'Billed'
  | 'Closed'
  | 'Cancelled'
  | 'Received'
  | 'Partially received'
  | 'Inspected'
  // The states a return's own documents stand in.
  | 'Paid'
  | 'Picked'
  | 'Shipped'
  | 'Posted'
  | 'Not linked'
  // A vendor credit the system raised that accounting has not confirmed yet.
  | 'Pending confirmation';

export type LinkedRecordStatus = LinkedApplicationStatus | LinkedProcurementStatus;

export interface LinkedFinancialRecord {
  id: string;
  type: LinkedGroupType;
  reference: string;
  description: string;
  status: LinkedRecordStatus;
  date: string;
  /** Money amount. 0 for receiving documents, which track quantity, not value. */
  amount: number;
  createdBy: string;
  /** Last touch, mirrors the invoice's audit trail. */
  updatedBy: string;
  /** Which parts this document is about.
   *
   *  A return of seventeen lines showed a column of receiving documents with
   *  no way to tell which line any of them belonged to, so the row said a
   *  receipt existed and nothing about what was on it. */
  items?: { sku: string; description: string; unitPrice?: number; uom?: string }[];
}

export function isProcurementType(t: LinkedGroupType): boolean {
  return (
    t === 'Purchase Order' ||
    t === 'Receiving Document' ||
    t === 'Vendor Invoice' ||
    t === 'Picking Document' ||
    t === 'Shipping Document' ||
    t === 'Reversal' ||
    t === 'Unlinked'
  );
}

export interface LinkedFinancials {
  records: LinkedFinancialRecord[];
  /** Applied (counting) totals per group. */
  prepaymentsApplied: number;
  paymentsApplied: number;
  creditsApplied: number;
  /** total − prepayments − payments − credits. What the page shows as outstanding. */
  effectiveOutstanding: number;
}

/** True when the record counts toward the subtotal / reconciliation. */
export function countsTowardBalance(status: LinkedApplicationStatus) {
  return status === 'Applied' || status === 'Partially applied';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function getLinkedFinancials(invoice: Invoice, totalAmount: number): LinkedFinancials {
  const seed = invoice.invoiceNumber.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const refSuffix = invoice.invoiceNumber.split('-').pop();
  const records: LinkedFinancialRecord[] = [];

  const terminal = invoice.status === 'Cancelled' || invoice.status === 'Rejected';

  // ── Allocation — the invoice row's own numbers are the source of truth ──
  // Outstanding is EXACTLY what the listing carries, and only the slice the
  // data says is already settled (total − outstandingBalance) decomposes
  // into prepayments, credits and payments. Synthesized documents can never
  // invent progress on an unpaid invoice: an Approved invoice with a full
  // balance shows Paid $0 and zero counting documents (feedback 7/14/26).
  //   prepays + credits + payments + effectiveOutstanding = total
  const paidTotal = Math.max(0, round2(totalAmount - invoice.outstandingBalance));

  const prepaymentCount = (seed % 2) + 1; // 1 or 2 advances when anything settled
  const hasCreditMemo = seed % 2 === 1;
  let prepTarget = round2(totalAmount * (prepaymentCount === 1 ? 0.15 : 0.22));
  let creditTarget = hasCreditMemo ? round2(totalAmount * 0.08) : 0;

  // Scale the documents into the settled slice (terminal invoices keep the
  // natural sizes for display — none of their documents count anyway).
  if (!terminal) {
    const docsWanted = round2(prepTarget + creditTarget);
    if (docsWanted > paidTotal && docsWanted > 0) {
      const scale = paidTotal / docsWanted;
      prepTarget = round2(prepTarget * scale);
      creditTarget = round2(creditTarget * scale);
    }
  }

  // Cancelled invoices are VOIDED: the posted entry was reversed, nothing
  // is owed and nothing counts (lifecycle specs 7/15/26). Rejected keeps
  // its balance — it can be fixed and resubmitted.
  const cancelled = invoice.status === 'Cancelled';
  const paymentsApplied = cancelled
    ? 0
    : terminal
      ? paidTotal
      : round2(Math.max(0, paidTotal - prepTarget - creditTarget));
  const effectiveOutstanding = cancelled ? 0 : invoice.outstandingBalance;

  const prepaymentsApplied = terminal ? 0 : prepTarget;
  const creditsApplied = terminal ? 0 : creditTarget;

  // ── Prepayments — advances paid before the invoice ──
  for (let i = 0; i < prepaymentCount; i++) {
    const slice =
      prepaymentCount === 1
        ? prepTarget
        : i === 0
          ? round2(prepTarget * 0.7)
          : round2(prepTarget - round2(prepTarget * 0.7));
    // Nothing settled → no advance to show; zero-amount rows would imply
    // progress the invoice data doesn't back up.
    if (slice <= 0.005) continue;
    records.push({
      id: `prep-${i}`,
      type: 'Prepayment',
      reference: `PREP-${refSuffix}-${i + 1}`,
      description: i === 0 ? 'Advance on order confirmation' : 'Second advance per payment plan',
      // Terminal invoices: the advance was reversed when the invoice died.
      // Second prepayment only partially lands here — the rest is applied
      // to other invoices (spec's Partially applied case).
      status: terminal ? 'Reversed' : i === 1 ? 'Partially applied' : 'Applied',
      date: shiftDate(invoice.invoiceDate, -(15 + i * 7)),
      amount: slice,
      createdBy: invoice.createdBy,
      updatedBy: invoice.updatedBy ?? invoice.createdBy,
    });
  }

  // ── Payments — settle the remainder ──
  if (paymentsApplied > 0.005) {
    records.push({
      id: 'pay-1',
      type: 'Payment',
      reference: `PAY-${invoice.invoiceNumber.replace(/[^A-Z0-9-]/gi, '')}-001`,
      description: 'Payment against this invoice',
      // Cancellation requires payments to be reversed first, so a
      // cancelled invoice's payments always read Reversed.
      status: cancelled ? 'Reversed' : 'Applied',
      date: invoice.postingDate || invoice.invoiceDate,
      amount: paymentsApplied,
      createdBy: invoice.createdBy,
      updatedBy: invoice.updatedBy ?? invoice.createdBy,
    });
    // Occasionally a returned payment sits alongside the applied one —
    // payments only ever read "Reversed" (Returned is reserved for
    // receiving documents, feedback 7/15/26); excluded from the subtotal.
    if (seed % 5 === 0) {
      records.push({
        id: 'pay-returned',
        type: 'Payment',
        reference: `PAY-${refSuffix}-R`,
        description: 'Check returned by bank, reissued',
        status: 'Reversed',
        date: shiftDate(invoice.invoiceDate, 3),
        amount: round2(paymentsApplied * 0.5),
        createdBy: invoice.createdBy,
        updatedBy: invoice.updatedBy ?? invoice.createdBy,
      });
    }
  }

  // ── Credit memos — credits issued against the invoice ──
  if (hasCreditMemo && creditTarget > 0.005) {
    records.push({
      id: 'cm-1',
      type: 'Credit Memo',
      reference: `CM-${refSuffix}-1`,
      description: 'Credit for damaged units',
      status: terminal ? 'Void' : 'Applied',
      date: shiftDate(invoice.invoiceDate, 5),
      amount: creditTarget,
      createdBy: invoice.createdBy,
      updatedBy: invoice.updatedBy ?? invoice.createdBy,
    });
  }

  return {
    records,
    prepaymentsApplied,
    paymentsApplied,
    creditsApplied,
    effectiveOutstanding,
  };
}

// Linked procurement documents — the purchase orders and receiving documents
// (goods receipts) upstream of the invoice. These are reference links shown in
// the Linked Records tab; they DO NOT affect the invoice balance. Synthesized
// deterministically from the invoice's own linkedPOs / linkedGRNs so they stay
// stable across reloads and match the header's "N POs · M Receiving Documents".
export function getLinkedProcurement(invoice: Invoice): LinkedFinancialRecord[] {
  const records: LinkedFinancialRecord[] = [];
  const terminal = invoice.status === 'Cancelled' || invoice.status === 'Rejected';
  const pos = invoice.linkedPOs ?? [];
  const grns = invoice.linkedGRNs ?? [];

  // Purchase orders — split the invoice value across the linked POs (each PO is
  // billed a little above its invoiced slice, as POs usually cover more).
  const poCount = pos.length || 1;
  pos.forEach((po, k) => {
    const amount = round2((invoice.amount / poCount) * (1.05 + (k % 3) * 0.06));
    const status: LinkedRecordStatus = terminal
      ? 'Cancelled'
      : k === 0 && pos.length > 1
        ? 'Partially invoiced'
        : 'Billed';
    records.push({
      id: `po-${k}`,
      type: 'Purchase Order',
      reference: `PO-${po}`,
      description: k === 0 ? 'Purchase order, goods & services' : `Purchase order ${k + 1}`,
      status,
      date: shiftDate(invoice.invoiceDate, -(30 + k * 6)),
      amount,
      createdBy: invoice.createdBy,
      updatedBy: invoice.updatedBy ?? invoice.createdBy,
    });
  });

  // Receiving documents — goods receipts booked against the PO(s).
  grns.forEach((grn, k) => {
    const status: LinkedRecordStatus = terminal
      ? 'Returned'
      : k === 0 && grns.length > 1
        ? 'Partially received'
        : 'Received';
    records.push({
      id: `grn-${k}`,
      type: 'Receiving Document',
      reference: grn,
      description: pos[0] ? `Goods received against PO-${pos[0]}` : 'Goods received',
      status,
      date: shiftDate(invoice.invoiceDate, -(10 + k * 4)),
      amount: 0, // receiving documents track quantity received, not money
      createdBy: invoice.createdBy,
      updatedBy: invoice.updatedBy ?? invoice.createdBy,
    });
  });

  return records;
}
