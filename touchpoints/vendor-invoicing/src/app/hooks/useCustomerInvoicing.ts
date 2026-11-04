import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { localTodayIso } from '@/app/lib/dueBucket';
import { mockCustomers, type Customer } from '@/app/data/ar/mockCustomers';
import { shipmentBillingConflicts } from '@/app/data/ar/arBilling';
import { depositRemaining, netDue } from '@/app/data/ar/customerInvoiceStatus';
import {
  mockCustomerInvoices,
  type CustomerInvoice,
  type CustomerInvoiceHistoryEntry,
  type CustomerSendRecord,
} from '@/app/data/ar/mockCustomerInvoices';
import { mockCustomerDeposits, type CustomerDeposit } from '@/app/data/ar/mockCustomerDeposits';
import { formatInvoiceId, nextDepositNumber } from '@/app/lib/invoiceIds';

const round2 = (n: number) => Math.round(n * 100) / 100;
const todayIso = () => localTodayIso();

// Payloads emitted by the money-action modals: the modals stay dumb,
// the hook builds the records (payment side, unchanged until the
// Customer Payments PRD).
export interface ReceiptPayload {
  date: string;
  method: string;
  reference: string;
  amount: number;
  markDisputed?: boolean;
  /** Overpayment carried forward as a new held deposit. */
  overpaymentToDeposit?: number;
}
export interface DepositPayload {
  date: string;
  method: string;
  reference: string;
  amount: number;
}
export interface SendPayload {
  to: string[];
  cc: string[];
  subject: string;
  message: string;
}

// Lifecycle per PRD §14: Draft → Pending Approval → Approved; Send Back
// → Rejected (reason kept); Rejected → Cancelled; Cancelled → Archived
// flag → Restore. Payment flags (credit hold, write-off, dispute) ride
// alongside unchanged.
export type CustomerInvoiceWorkflowAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'archive'
  | 'restore'
  | 'creditHold'
  | 'releaseCreditHold'
  | 'writeOff'
  | 'markDisputed'
  | 'resolveDispute'
  // FAD 11/2: exception flag (vendor parity), reasons kept on the record.
  | 'flagException'
  | 'resolveException';

/** FAD 11/2 refund or reverse of an advance invoice's prepayment. */
export interface RefundPrepaymentPayload {
  depositId: string;
  amount: number;
  date: string;
  reason: string;
  memo: string;
  notifiedRecipientIds?: string[];
}

/** Revise (FAD 11/2): INV-000123 → INV-000123-1 → INV-000123-2. The
 *  base strips an existing -N suffix after the six-digit sequence. */
export function revisionNumberFor(invoiceNumber: string, rev: number): string {
  const m = /^(.+-\d{6})-(\d+)$/.exec(invoiceNumber);
  const base = m ? m[1] : invoiceNumber;
  return `${base}-${rev}`;
}

export const AR_ACTING_USER = 'Ahtisham Ahmad';
const BY = AR_ACTING_USER;

export function useCustomerInvoicing() {
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoice[]>(mockCustomerInvoices);
  const [customerDeposits, setCustomerDeposits] = useState<CustomerDeposit[]>(mockCustomerDeposits);

  /** Workflow transitions. No-op for ineligible states. Approving a
   *  credit memo credits its invoice (customer credit memos reduce A/R
   *  only once approved). */
  const applyCustomerInvoiceAction = useCallback(
    (invoiceIds: string[], action: CustomerInvoiceWorkflowAction, reason: string, notifiedRecipientIds?: string[]): { blocked: string[] } => {
      const at = new Date().toISOString();
      // FAD 11/2 approve-time duplicate check: shipment lines are re-read
      // at approval; a line already invoiced elsewhere blocks it.
      const blocked: string[] = [];
      if (action === 'approve') {
        const shippedQtyOf = (lineId: string) => {
          for (const c of customers) for (const s of c.shipments) {
            const l = s.lines.find((x) => x.id === lineId);
            if (l) return l.shippedQty;
          }
          return undefined;
        };
        for (const id of invoiceIds) {
          const inv = customerInvoices.find((i) => i.id === id);
          if (!inv) continue;
          const conflicts = shipmentBillingConflicts(inv, customerInvoices, shippedQtyOf);
          if (conflicts.length > 0) {
            blocked.push(id);
            const c = conflicts[0];
            toast.error(`${c.shipmentNumber} is already invoiced on ${c.otherInvoiceNumber}`, {
              description: `${inv.invoiceNumber} was not approved. Remove the shipment lines billed elsewhere, then approve again.`,
            });
          }
        }
      }
      const blockedSet = new Set(blocked);
      setCustomerInvoices((prev) => {
        const credits: Array<{ invoiceNumber: string; amount: number }> = [];
        const next = prev.map((inv) => {
          if (!invoiceIds.includes(inv.id) || blockedSet.has(inv.id)) return inv;
          let patch: Partial<CustomerInvoice> = {};
          switch (action) {
            case 'submit':
              if (inv.invoiceStatus === 'Draft' || inv.invoiceStatus === 'Rejected') {
                patch = { invoiceStatus: 'Pending Approval', submittedBy: BY, submittedAt: at };
              }
              break;
            case 'approve':
              if (inv.invoiceStatus === 'Pending Approval' || inv.invoiceStatus === 'Draft' || inv.invoiceStatus === 'Rejected') {
                patch = {
                  invoiceStatus: 'Approved',
                  approvedBy: BY,
                  approvedAt: at,
                  submittedBy: inv.submittedBy ?? BY,
                  submittedAt: inv.submittedAt ?? at,
                };
                if (inv.docKind === 'Credit Memo' && inv.relatedInvoiceNumber) {
                  credits.push({ invoiceNumber: inv.relatedInvoiceNumber, amount: Math.abs(inv.amount) });
                }
              }
              break;
            case 'reject':
              if (inv.invoiceStatus === 'Pending Approval') patch = { invoiceStatus: 'Rejected', rejectionReason: reason };
              break;
            case 'cancel':
              if (inv.invoiceStatus === 'Rejected' || inv.invoiceStatus === 'Draft') patch = { invoiceStatus: 'Cancelled' };
              break;
            case 'archive':
              if (inv.invoiceStatus === 'Cancelled' && !inv.archived) patch = { archived: true };
              break;
            case 'restore':
              if (inv.archived) patch = { archived: false };
              break;
            case 'creditHold':
              patch = { creditHold: true };
              break;
            case 'releaseCreditHold':
              patch = { creditHold: false };
              break;
            case 'writeOff':
              // FAD 11/2: the outstanding balance at write-off moves to bad debt.
              patch = { writtenOff: true, writeOffAmount: netDue(inv) };
              break;
            case 'markDisputed':
              patch = { disputed: true, disputeDetail: { reason, by: BY, at } };
              break;
            case 'resolveDispute':
              patch = { disputed: false, disputeDetail: undefined };
              break;
            case 'flagException':
              patch = { exception: { reason, by: BY, at } };
              break;
            case 'resolveException':
              patch = { exception: undefined };
              break;
          }
          if (Object.keys(patch).length === 0) return inv;
          const entry: CustomerInvoiceHistoryEntry = { action, reason, by: BY, at, notifiedRecipientIds };
          return { ...inv, ...patch, updatedBy: BY, updatedDate: at.split('T')[0], actionHistory: [...(inv.actionHistory ?? []), entry] };
        });
        if (credits.length === 0) return next;
        return next.map((inv) => {
          const c = credits.filter((x) => x.invoiceNumber === inv.invoiceNumber);
          if (c.length === 0) return inv;
          return { ...inv, creditApplied: round2(inv.creditApplied + c.reduce((s, x) => s + x.amount, 0)) };
        });
      });
      return { blocked };
    },
    [customers, customerInvoices],
  );

  /** Revise (FAD 11/2): the posted version is reversed and kept in
   *  history; a new Draft version opens with a -N suffix. Returns the new
   *  version so the caller can open it for editing. */
  const reviseCustomerInvoice = useCallback(
    (invoiceId: string, reason: string, notifiedRecipientIds?: string[]): CustomerInvoice | null => {
      const old = customerInvoices.find((i) => i.id === invoiceId);
      if (!old || old.supersededById) return null;
      const at = new Date().toISOString();
      // Version numbers: the original is 1; version N prints the -(N-1) suffix.
      const rev = (old.revision ?? 1) + 1;
      const number = revisionNumberFor(old.invoiceNumber, rev - 1);
      const next: CustomerInvoice = {
        ...old,
        id: `cinv-${number}`,
        invoiceNumber: number,
        documentNumber: old.documentNumber ? revisionNumberFor(old.documentNumber, rev - 1) : undefined,
        revision: rev,
        revisedFromId: old.id,
        supersededById: undefined,
        invoiceStatus: 'Draft',
        submittedBy: undefined,
        submittedAt: undefined,
        approvedBy: undefined,
        approvedAt: undefined,
        sentAt: undefined,
        sendLog: [],
        rejectionReason: undefined,
        writtenOff: undefined,
        writeOffAmount: undefined,
        receipts: [],
        depositApplications: [],
        creditApplied: 0,
        createdBy: BY,
        createdDate: at.split('T')[0],
        updatedBy: BY,
        updatedDate: at.split('T')[0],
        actionHistory: [{ action: 'revisedFrom', reason: `${old.invoiceNumber}. ${reason}`, by: BY, at }],
      };
      setCustomerInvoices((prev) => [
        next,
        ...prev.map((i) =>
          i.id === old.id
            ? {
                ...i,
                supersededById: next.id,
                revision: i.revision ?? 1,
                updatedBy: BY,
                updatedDate: at.split('T')[0],
                actionHistory: [...(i.actionHistory ?? []), { action: 'revised', reason: `${reason} · Replaced by ${number}`, by: BY, at, notifiedRecipientIds }],
              }
            : i,
        ),
      ]);
      return next;
    },
    [customerInvoices],
  );

  /** Refund or reverse an advance invoice's prepayment (FAD 11/2). The
   *  deposit is marked refunded once nothing is left on it. */
  const refundPrepayment = useCallback(
    (invoiceId: string, payload: RefundPrepaymentPayload) => {
      const inv = customerInvoices.find((i) => i.id === invoiceId);
      const dep = customerDeposits.find((d) => d.id === payload.depositId);
      if (!inv || !dep) return;
      const at = new Date().toISOString();
      const mode: 'refund' | 'reverse' = (inv.treatment ?? 'Deposit') === 'Revenue' ? 'reverse' : 'refund';
      const fully = payload.amount >= depositRemaining(dep) - 0.004;
      const reason = payload.memo ? `${payload.reason}: ${payload.memo}` : payload.reason;
      setCustomerDeposits((prev) =>
        prev.map((d) =>
          d.id === dep.id
            ? fully
              ? { ...d, refunded: true, refundedAmount: round2((d.refundedAmount ?? 0) + payload.amount), refundedOn: payload.date, refundReason: reason }
              : { ...d, refundedAmount: round2((d.refundedAmount ?? 0) + payload.amount), refundReason: reason }
            : d,
        ),
      );
      setCustomerInvoices((prev) =>
        prev.map((i) =>
          i.id === invoiceId
            ? {
                ...i,
                prepaymentReversal: { mode, amount: round2(payload.amount), reason, by: BY, at },
                updatedBy: BY,
                updatedDate: at.split('T')[0],
                actionHistory: [
                  ...(i.actionHistory ?? []),
                  { action: mode === 'reverse' ? 'reverseRefund' : 'refundPrepayment', reason, by: BY, at, notifiedRecipientIds: payload.notifiedRecipientIds },
                ],
              }
            : i,
        ),
      );
    },
    [customerInvoices, customerDeposits],
  );

  /** Create or replace an invoice from the create / edit form. An edit
   *  keeps the record's id, number and history. */
  const saveCustomerInvoice = useCallback((inv: CustomerInvoice, historyAction: string) => {
    const at = new Date().toISOString();
    setCustomerInvoices((prev) => {
      const existing = prev.find((i) => i.id === inv.id);
      const entry: CustomerInvoiceHistoryEntry = { action: historyAction, reason: '', by: BY, at };
      if (!existing) return [{ ...inv, actionHistory: [...(inv.actionHistory ?? []), entry] }, ...prev];
      return prev.map((i) =>
        i.id === inv.id
          ? { ...inv, createdBy: existing.createdBy, createdDate: existing.createdDate, updatedBy: BY, updatedDate: at.split('T')[0], actionHistory: [...(existing.actionHistory ?? []), entry] }
          : i,
      );
    });
    if (inv.docKind === 'Credit Memo' && inv.invoiceStatus === 'Approved' && inv.relatedInvoiceNumber) {
      setCustomerInvoices((prev) =>
        prev.map((i) => (i.invoiceNumber === inv.relatedInvoiceNumber ? { ...i, creditApplied: round2(i.creditApplied + Math.abs(inv.amount)) } : i)),
      );
    }
  }, []);

  const deleteCustomerInvoice = useCallback((id: string) => {
    setCustomerInvoices((prev) => prev.filter((i) => i.id !== id || i.invoiceStatus !== 'Draft'));
  }, []);

  /** Prepend newly created documents. */
  const addCustomerInvoices = useCallback((created: CustomerInvoice[]) => {
    setCustomerInvoices((prev) => [...created, ...prev]);
  }, []);

  const updateCustomerInvoice = useCallback((id: string, patch: Partial<CustomerInvoice>) => {
    setCustomerInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, ...patch } : inv)));
  }, []);

  const addCustomerDeposit = useCallback((dep: CustomerDeposit) => {
    setCustomerDeposits((prev) => [dep, ...prev]);
  }, []);

  const updateCustomerDeposit = useCallback((id: string, patch: Partial<CustomerDeposit>) => {
    setCustomerDeposits((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  /** Send to the customer (PRD §10.3): only an approved invoice goes
   *  out. Sent is a flag with the date; every send lands in the log so
   *  Communications shows it, and Resend stays available. */
  const sendToCustomer = useCallback((invoiceId: string, payload: SendPayload, outcome: 'sent' | 'failed' = 'sent') => {
    const at = new Date().toISOString();
    setCustomerInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId || inv.invoiceStatus !== 'Approved') return inv;
        const rec: CustomerSendRecord = { id: `snd-${Date.now()}`, at, by: BY, outcome, ...payload };
        const history: CustomerInvoiceHistoryEntry = {
          action: outcome === 'failed' ? 'sendFailed' : inv.sentAt ? 'resend' : 'send',
          reason: payload.to.join(', '),
          by: BY,
          at,
        };
        return {
          ...inv,
          sentAt: outcome === 'sent' ? at : inv.sentAt,
          sendLog: [...(inv.sendLog ?? []), rec],
          updatedBy: BY,
          updatedDate: at.split('T')[0],
          actionHistory: [...(inv.actionHistory ?? []), history],
        };
      }),
    );
  }, []);

  // ── Payment actions (unchanged until Customer Payments) ──────────

  /** Record a receipt against an invoice (cash application). An
   *  overpayment carries forward as a new held deposit; a short pay can
   *  flag the invoice disputed. */
  const recordReceipt = useCallback((invoiceId: string, payload: ReceiptPayload) => {
    const inv = customerInvoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    setCustomerInvoices((prev) =>
      prev.map((i) =>
        i.id === invoiceId
          ? {
              ...i,
              receipts: [
                ...i.receipts,
                { id: `rc-${Date.now()}`, date: payload.date, method: payload.method, reference: payload.reference, amount: round2(payload.amount) },
              ],
              disputed: payload.markDisputed ? true : i.disputed,
              updatedBy: BY,
              updatedDate: todayIso(),
            }
          : i,
      ),
    );
    if (payload.overpaymentToDeposit && payload.overpaymentToDeposit > 0.004) {
      addCustomerDeposit({
        id: `dep-${Date.now()}`,
        depositNumber: nextDepositNumber(customerDeposits.map((d) => d.depositNumber)),
        customer: inv.customer,
        receivedDate: payload.date,
        method: payload.method,
        reference: payload.reference,
        amount: round2(payload.overpaymentToDeposit),
        applications: [],
      });
    }
  }, [customerInvoices, addCustomerDeposit]);

  /** Record the customer's deposit against an advance invoice. */
  const recordDeposit = useCallback((advanceInvoiceId: string, payload: DepositPayload) => {
    const adv = customerInvoices.find((i) => i.id === advanceInvoiceId);
    if (!adv) return;
    addCustomerDeposit({
      id: `dep-${Date.now()}`,
      depositNumber: nextDepositNumber(customerDeposits.map((d) => d.depositNumber)),
      customer: adv.customer,
      soNumber: adv.linkedSOs[0],
      preInvoiceNumber: adv.invoiceNumber,
      receivedDate: payload.date,
      method: payload.method,
      reference: payload.reference,
      amount: round2(payload.amount),
      applications: [],
    });
    updateCustomerInvoice(advanceInvoiceId, { depositReceived: true, updatedBy: BY, updatedDate: todayIso() });
  }, [customerInvoices, addCustomerDeposit, updateCustomerInvoice]);

  return {
    customers,
    setCustomers,
    customerInvoices,
    setCustomerInvoices,
    customerDeposits,
    setCustomerDeposits,
    applyCustomerInvoiceAction,
    reviseCustomerInvoice,
    refundPrepayment,
    saveCustomerInvoice,
    deleteCustomerInvoice,
    addCustomerInvoices,
    updateCustomerInvoice,
    addCustomerDeposit,
    updateCustomerDeposit,
    sendToCustomer,
    recordReceipt,
    recordDeposit,
  };
}

export type CustomerInvoicingApi = ReturnType<typeof useCustomerInvoicing>;

/** Next number in the one shared invoice sequence (PRD §8.4). */
export function nextCustomerInvoiceNumber(invoices: CustomerInvoice[], kind: 'invoice' | 'credit'): string {
  const prefix = kind === 'credit' ? 'CRN-' : 'INV-';
  const max = invoices
    .filter((i) => i.invoiceNumber.startsWith(prefix))
    .reduce((m, i) => Math.max(m, parseInt(i.invoiceNumber.slice(prefix.length), 10) || 0), 0);
  return formatInvoiceId(max + 1, kind === 'credit' ? 'CRN' : 'INV');
}
