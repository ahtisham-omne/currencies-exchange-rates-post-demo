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
  | 'Prepayment'
  | 'Payment'
  | 'Credit Memo'
  // Reconciliation forward-link (9/2/26): on a settled pre-invoice, the
  // receiving invoice its prepayment applied to. Amount 0, reference
  // only — never counts toward any balance.
  | 'Invoice';

// Status describes the record's APPLICATION TO THIS INVOICE — not the
// record's own lifecycle. Reversed / Returned / Void mark records that
// stopped counting toward the balance.
export type LinkedApplicationStatus =
  | 'Applied'
  | 'Partially Applied'
  | 'Reversed'
  | 'Returned'
  | 'Void';

// Procurement documents (POs / receiving) sit upstream of the invoice — they
// are reference links, not financial applications, so they never change the
// invoice balance. Their statuses describe the procure-to-pay progress.
export type LinkedProcurementStatus =
  | 'Confirmed'
  | 'Partially Invoiced'
  | 'Billed'
  | 'Closed'
  | 'Cancelled'
  | 'Received'
  | 'Partially Received'
  | 'Inspected';

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
}

export function isProcurementType(t: LinkedGroupType): boolean {
  return t === 'Purchase Order' || t === 'Receiving Document';
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
  return status === 'Applied' || status === 'Partially Applied';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function getLinkedFinancials(
  invoice: Invoice,
  totalAmount: number,
  /** Cash applied to this invoice by REAL payment records in app state —
   *  those rows render from the payments array, so the synthetic slice
   *  shrinks by this amount and the same money is never shown twice. */
  realSettled: number = 0,
  /** Credit applied by REAL credit memos in app state (same rule). */
  realCredits: number = 0,
): LinkedFinancials {
  const seed = invoice.invoiceNumber.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const refSuffix = invoice.invoiceNumber.split('-').pop();
  const records: LinkedFinancialRecord[] = [];

  const terminal = invoice.status === 'Cancelled' || invoice.status === 'Rejected';

  // ── User-created records: real data only (9/22/26 review response) ──
  // The Sept 20 reviews' worst class of defect was invented history: a
  // $7,000 payment reopening as four rows totaling $13,441.30, returned
  // prepayments nobody made, credits shown as cash. Records created in
  // this session synthesize NOTHING — their prepayment rows are the real
  // reconciliations they were born with, their payment and credit rows
  // render from app state, and the totals are pure arithmetic.
  if (invoice.isUserCreated) {
    const cancelledHere = invoice.status === 'Cancelled';
    const realPrepaysHere = invoice.appliedPrepayments ?? [];
    const prepayTotalHere = round2(realPrepaysHere.reduce((s, p) => s + p.amount, 0));
    realPrepaysHere.forEach((p, i) => {
      records.push({
        id: `prep-${i}`,
        type: 'Prepayment',
        reference: p.invoiceNumber,
        description: 'Pre-invoice reconciled into this invoice at creation',
        status: terminal ? 'Reversed' : 'Applied',
        date: invoice.invoiceDate,
        amount: p.amount,
        createdBy: invoice.createdBy,
        updatedBy: invoice.updatedBy ?? invoice.createdBy,
      });
    });
    const paidHere = Math.max(0, round2(totalAmount - invoice.outstandingBalance));
    const creditsHere = cancelledHere ? 0 : round2(Math.max(0, realCredits));
    return {
      records,
      prepaymentsApplied: cancelledHere ? 0 : prepayTotalHere,
      paymentsApplied: cancelledHere ? 0 : round2(Math.max(0, paidHere - prepayTotalHere - creditsHere)),
      creditsApplied: creditsHere,
      effectiveOutstanding: cancelledHere ? 0 : invoice.outstandingBalance,
    };
  }

  // ── Allocation — the invoice row's own numbers are the source of truth ──
  // Outstanding is EXACTLY what the listing carries, and only the slice the
  // data says is already settled (total − outstandingBalance) decomposes
  // into prepayments, credits and payments. Synthesized documents can never
  // invent progress on an unpaid invoice: an Approved invoice with a full
  // balance shows Paid $0 and zero counting documents (feedback 7/14/26).
  //   prepays + credits + payments + effectiveOutstanding = total
  const paidTotal = Math.max(0, round2(totalAmount - invoice.outstandingBalance));

  // Reconciliation (Eli, 8/31/26): when the invoice consumed real
  // pre-invoice prepayments at creation, those records ARE the
  // prepayment slice — nothing is synthesized for it.
  const realPrepays = invoice.appliedPrepayments ?? [];
  const realPrepayTotal = round2(realPrepays.reduce((s, p) => s + p.amount, 0));

  const prepaymentCount = (seed % 2) + 1; // 1 or 2 advances when anything settled
  const hasCreditMemo = seed % 2 === 1 && realPrepays.length === 0;
  let prepTarget = realPrepays.length > 0
    ? realPrepayTotal
    : round2(totalAmount * (prepaymentCount === 1 ? 0.15 : 0.22));
  let creditTarget = hasCreditMemo ? round2(totalAmount * 0.08) : 0;

  // Scale the documents into the settled slice (terminal invoices keep the
  // natural sizes for display — none of their documents count anyway).
  if (!terminal && realPrepays.length === 0) {
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
  // Real reconciled pre-invoices first (Eli, 8/31/26): the reference IS
  // the pre-invoice number, so the linkage reads on the tab and the row
  // clicks through to the closed pre-invoice.
  if (realPrepays.length > 0) {
    realPrepays.forEach((p, i) => {
      records.push({
        id: `prep-${i}`,
        type: 'Prepayment',
        reference: p.invoiceNumber,
        description: 'Pre-invoice reconciled into this invoice at creation',
        status: terminal ? 'Reversed' : 'Applied',
        date: invoice.invoiceDate,
        amount: p.amount,
        createdBy: invoice.createdBy,
        updatedBy: invoice.updatedBy ?? invoice.createdBy,
      });
    });
  } else
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
      status: terminal ? 'Reversed' : i === 1 ? 'Partially Applied' : 'Applied',
      date: shiftDate(invoice.invoiceDate, -(15 + i * 7)),
      amount: slice,
      createdBy: invoice.createdBy,
      updatedBy: invoice.updatedBy ?? invoice.createdBy,
    });
  }

  // ── Payments — settle the remainder ──
  // Real records always win (9/22/26): cash applied by actual payment
  // records this session renders from app state, so the synthetic row
  // covers only whatever settled slice remains beyond it. If real
  // payments explain the whole slice, no synthetic row is emitted.
  const syntheticPayments = round2(Math.max(0, paymentsApplied - realSettled));
  if (syntheticPayments > 0.005) {
    records.push({
      id: 'pay-1',
      type: 'Payment',
      reference: `PAY-${invoice.invoiceNumber.replace(/[^A-Z0-9-]/gi, '')}-001`,
      description: 'Payment against this invoice',
      // Cancellation requires payments to be reversed first, so a
      // cancelled invoice's payments always read Reversed.
      status: cancelled ? 'Reversed' : 'Applied',
      date: invoice.postingDate || invoice.invoiceDate,
      amount: syntheticPayments,
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
        amount: round2(syntheticPayments * 0.5),
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
  // User-created records carry the plain per-PO slice, never an inflated
  // demo figure (9/22/26 review response).
  const poCount = pos.length || 1;
  pos.forEach((po, k) => {
    const amount = invoice.isUserCreated
      ? round2(invoice.amount / poCount)
      : round2((invoice.amount / poCount) * (1.05 + (k % 3) * 0.06));
    // A pre-invoice never bills its PO (user 9/28, carried through the
    // Mahreen 9/29 retest): nothing was received, so the PO stays
    // Confirmed here — the data-layer applyInvoiceToVendorDocs already
    // skips pre lines; this synthetic display row must agree.
    const status: LinkedRecordStatus = terminal
      ? 'Cancelled'
      : invoice.type === 'Pre-Invoice'
        ? 'Confirmed'
        : k === 0 && pos.length > 1
          ? 'Partially Invoiced'
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
        ? 'Partially Received'
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
