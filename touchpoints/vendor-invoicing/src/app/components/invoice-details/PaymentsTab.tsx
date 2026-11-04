import { useMemo } from 'react';
import { Banknote, CircleDashed, Copy, ExternalLink, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { actionToneClass } from '@/app/lib/actionMenuTone';
import type { ColumnDef } from '@/app/components/data-table/types';
import { Invoice } from '@/app/data/mockInvoices';
import { Payment } from '@/app/data/mockPayments';
import { LinkedFinancialRecord } from '@/app/data/invoiceLinkedRecords';
import { LineItemsTable } from './LineItemsTab';
import { highlightText } from '@/app/components/InvoiceDataTable';

// Payments tab — every money movement recorded against THIS invoice in one
// place: posted payments, prepayments (anchored or applied), scheduled
// payments and prepayments (draft payments were deleted from the model,
// Eli review 7/15/26). Renders through the same table chrome as the
// Line Items tab and is self-contained so other surfaces can reuse it.

interface PaymentRow {
  id: string;
  reference: string;
  type: 'Payment' | 'Prepayment' | 'Credit Memo';
  date: string;
  method: string;
  status: string;
  /** Portion applied to (or reserved for) this invoice. */
  applied: number;
  /** The record's own total amount. */
  total: number;
  /** True for real app-state payment records (navigable), false for the
   *  synthesized history rows. */
  isRecord: boolean;
}

const TYPE_PILL: Record<PaymentRow['type'], { bg: string; color: string; border: string }> = {
  Payment: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  Prepayment: { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
  // Credit memos belong in the payment history too, not just Linked
  // Records (meeting feedback 7/17/26) — they settle balance like money.
  'Credit Memo': { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
};

// Status palette — mirrors the payments listing so a Scheduled
// record reads the same here as there.
const STATUS_PILL: Record<string, { bg: string; color: string; border: string }> = {
  Scheduled: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  Paid: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  Applied: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  'Fully Applied': { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  'Partially Applied': { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  Unapplied: { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
  Reversed: { bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },
  Returned: { bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },
  Void: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
};
const STATUS_FALLBACK = { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' };

/** The prepayment status vocabulary (user 10/12): Unapplied, Partially
 *  applied, Fully applied. Legacy "Applied"/"Paid" read Fully applied;
 *  reversals keep their own terminal label. */
export function prepaymentStatusLabel(status: string): string {
  if (status === 'Unapplied' || status === 'Partially Applied' || status === 'Fully Applied') return status;
  if (status === 'Applied' || status === 'Paid') return 'Fully Applied';
  if (status === 'Partially Applied') return 'Partially Applied';
  return status;
}

function formatMoney(amount: number, currency: string) {
  return `${currency === 'USD' ? '$' : currency + ' '}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PAYMENT_COLUMN_CATALOG = [
  { key: 'reference', label: 'Payment No.' },
  { key: 'type', label: 'Type' },
  { key: 'date', label: 'Date' },
  { key: 'method', label: 'Method' },
  { key: 'status', label: 'Status' },
  { key: 'applied', label: 'Applied to Invoice' },
  { key: 'total', label: 'Amount' },
  { key: 'actions', label: 'Actions' },
];

export function PaymentsTab({
  invoice,
  payments,
  records,
  onViewPayment,
  onViewCreditMemo,
  onContinuePayment,
}: {
  invoice: Invoice;
  payments: Payment[];
  /** Linked financial records (the synthesized history the Linked Records
   *  tab shows) — the Prepayment/Payment ones surface here too. */
  records: LinkedFinancialRecord[];
  /** Opens a payment record in the payments module. */
  onViewPayment?: (paymentNumber: string) => void;
  /** Opens a credit memo's page (9/22/26, GPT F16). */
  onViewCreditMemo?: (creditMemoNumber: string) => void;
  /** Records a scheduled payment now in the Record Payment flow. */
  onContinuePayment?: (paymentNumber: string) => void;
}) {
  const rows = useMemo<PaymentRow[]>(() => {
    // Real payment records from the app state — includes drafts, scheduled
    // payments, and prepayments created this session.
    const real: (PaymentRow & { seq: number })[] = payments
      .filter(
        (p) =>
          p.appliedInvoices?.some((a) => a.invoiceNumber === invoice.invoiceNumber) ||
          p.preInvoiceId === invoice.invoiceNumber ||
          p.preInvoiceId === invoice.id,
      )
      .map((p, idx) => {
        const appliedRef = p.appliedInvoices?.find((a) => a.invoiceNumber === invoice.invoiceNumber);
        return {
          id: `pmt-${p.id}`,
          reference: p.paymentNumber,
          type: p.type === 'Prepayment' ? 'Prepayment' as const : 'Payment' as const,
          date: p.paymentDate,
          method: p.paymentMethod,
          status: p.type === 'Prepayment' ? prepaymentStatusLabel(p.status) : p.status,
          applied: appliedRef?.amount ?? (p.preInvoiceId === invoice.invoiceNumber || p.preInvoiceId === invoice.id ? p.amount : 0),
          total: p.amount,
          isRecord: true,
          // App prepends new records, so the array index IS recency —
          // the latest payment sorts to the top on same-day ties (7/15/26).
          seq: idx,
        };
      });

    // Synthesized history from the linked-records source of truth.
    // Credit memos DO surface here (Eli 7/22/26, re-flagged): a credit memo
    // settles balance like money, so it belongs in the payment history — a
    // full-amount memo is what moves the invoice to Settled.
    // A real record and its linked-record mirror are the SAME money (user
    // 10/12: one prepayment showed twice) — the real record wins.
    const realRefs = new Set(real.map((r) => r.reference));
    const historic: (PaymentRow & { seq: number })[] = records
      .filter((r) => r.type === 'Prepayment' || r.type === 'Payment' || r.type === 'Credit Memo')
      .filter((r) => !realRefs.has(r.reference))
      .map((r, idx) => ({
        id: `rec-${r.id}`,
        reference: r.reference,
        type: r.type as PaymentRow['type'],
        date: r.date,
        method: r.type === 'Credit Memo' ? 'Credit' : 'Bank Transfer',
        // Prepayments speak the three-state application axis only
        // (user 10/12): Unapplied, Partially applied, Fully applied.
        status: r.type === 'Prepayment' ? prepaymentStatusLabel(r.status) : r.status,
        applied: r.amount,
        total: r.amount,
        isRecord: false,
        seq: 100000 + idx,
      }));

    return [...real, ...historic].sort((a, b) =>
      a.date === b.date ? a.seq - b.seq : a.date < b.date ? 1 : -1,
    );
  }, [invoice.invoiceNumber, payments, records]);

  const appliedTotal = rows
    .filter((r) => !['Reversed', 'Returned', 'Void'].includes(r.status))
    .reduce((s, r) => s + r.applied, 0);

  // Banner headline carries the count — scheduled payments only (draft
  // payments were deleted from the model, Eli review 7/15/26).
  const scheduledCount = rows.filter((r) => r.status === 'Scheduled').length;
  const hasPending = scheduledCount > 0;
  const pendingHeadline = `${scheduledCount} scheduled payment${scheduledCount === 1 ? '' : 's'}`;

  const columns = useMemo<ColumnDef<PaymentRow>[]>(() => [
    {
      key: 'reference', label: 'Payment No.', minWidth: 116, defaultWidth: 140, sortable: true,
      locked: true, sticky: 'left',
      getValue: (r) => r.reference,
      // The number is the link (Sep 8 decision, re-flagged in the 9/20
      // reviews): real payments open their payment page, credit memos
      // open the credit memo page — in a NEW TAB (user 10/5: every
      // document code opens in a new tab).
      // Searchable, so it highlights like every other matched cell (10/9/26).
      render: (r, { searchQuery }) => {
        const open = r.type === 'Credit Memo'
          ? (onViewCreditMemo ? () => window.open(`/credit-memos/${encodeURIComponent(r.reference)}`, '_blank', 'noopener') : undefined)
          : (r.isRecord && onViewPayment ? () => window.open(`/payments-v2/${encodeURIComponent(r.reference)}`, '_blank', 'noopener') : undefined);
        if (!open) {
          return <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{highlightText(r.reference, searchQuery)}</span>;
        }
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); open(); }}
            className="text-[12px] text-foreground hover:text-primary hover:underline transition-colors cursor-pointer bg-transparent border-0 p-0"
            style={{ fontWeight: 600 }}
          >
            {highlightText(r.reference, searchQuery)}
          </button>
        );
      },
    },
    {
      key: 'type', label: 'Type', minWidth: 92, defaultWidth: 108, sortable: true,
      getValue: (r) => r.type,
      render: (r) => {
        const pill = TYPE_PILL[r.type];
        return (
          <span
            className="inline-flex items-center px-2 py-px rounded-full text-[10px] border"
            style={{ fontWeight: 600, backgroundColor: pill.bg, color: pill.color, borderColor: pill.border }}
          >
            {r.type}
          </span>
        );
      },
    },
    {
      key: 'date', label: 'Date', minWidth: 88, defaultWidth: 104, sortable: true,
      getValue: (r) => r.date,
      render: (r) => <span className="text-[12px] text-slate-600">{r.date}</span>,
    },
    {
      key: 'method', label: 'Method', minWidth: 110, defaultWidth: 140, sortable: true, flex: true,
      getValue: (r) => r.method,
      render: (r, { searchQuery }) => <span className="text-[12px] text-slate-600">{highlightText(r.method, searchQuery)}</span>,
    },
    {
      key: 'status', label: 'Status', minWidth: 108, defaultWidth: 132, sortable: true,
      getValue: (r) => r.status,
      render: (r) => {
        const pill = STATUS_PILL[r.status] ?? STATUS_FALLBACK;
        return (
          <span
            className="inline-flex items-center px-2 py-px rounded-full text-[10px] border"
            style={{ fontWeight: 600, backgroundColor: pill.bg, color: pill.color, borderColor: pill.border }}
          >
            {r.status}
          </span>
        );
      },
    },
    {
      key: 'applied', label: 'Applied to Invoice', minWidth: 116, defaultWidth: 140, sortable: true, align: 'right',
      getValue: (r) => r.applied,
      render: (r) => <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{formatMoney(r.applied, invoice.currency)}</span>,
    },
    {
      key: 'total', label: 'Amount', minWidth: 96, defaultWidth: 116, sortable: true, align: 'right',
      getValue: (r) => r.total,
      render: (r) => <span className="text-[12px] text-slate-600">{formatMoney(r.total, invoice.currency)}</span>,
    },
    {
      key: 'actions', label: 'Actions', minWidth: 64, defaultWidth: 64, sortable: false, resizable: false, align: 'right',
      getValue: () => '',
      render: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              aria-label={`Actions for ${r.reference}`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          {/* Same panel recipe as the header Actions dropdown: w-56, toned
              w-4 icons, grouped with separators. */}
          <DropdownMenuContent align="end" className="z-[300] w-56">
            {r.status === 'Scheduled' && onContinuePayment && (
              <>
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onContinuePayment(r.reference); }}
                  className={actionToneClass('positive').item}
                >
                  <Banknote className={`w-4 h-4 mr-2 ${actionToneClass('positive').icon}`} />
                  Record Payment Now
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {r.isRecord && onViewPayment && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewPayment(r.reference); }}>
                <ExternalLink className={`w-4 h-4 mr-2 ${actionToneClass('neutral').icon}`} />
                View Payment
              </DropdownMenuItem>
            )}
            {r.type === 'Credit Memo' && onViewCreditMemo && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewCreditMemo(r.reference); }}>
                <ExternalLink className={`w-4 h-4 mr-2 ${actionToneClass('neutral').icon}`} />
                View Credit Memo
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard?.writeText(r.reference);
                toast.success('Payment number copied', { description: r.reference });
              }}
            >
              <Copy className={`w-4 h-4 mr-2 ${actionToneClass('neutral').icon}`} />
              Copy Payment Number
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [invoice.currency, onViewPayment, onViewCreditMemo, onContinuePayment]);

  // Zero payments → pure empty state (user 10/1): the table chrome
  // (search, count, view controls, header row) is noise with nothing
  // under it. Same card recipe as the Coming Soon tabs, minus the pill;
  // the full table appears with the first recorded payment.
  if (rows.length === 0) {
    return (
      <div className="border border-border rounded-xl bg-white overflow-hidden flex flex-col" style={{ minHeight: 'max(400px, calc(100vh - 269px))' }}>
        <div className="flex-1 flex flex-col items-center justify-center w-full py-12 px-6 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-primary/5 animate-ping" style={{ animationDuration: '3s' }} />
            <div
              className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-accent border border-border flex items-center justify-center shadow-sm"
              style={{ animation: 'payEmptyFloat 4s ease-in-out infinite' }}
            >
              <Banknote className="w-7 h-7 text-slate-400" />
            </div>
          </div>
          <h3 className="text-foreground text-[16px] mb-1.5" style={{ fontWeight: 600, animation: 'payEmptyFade 0.5s ease-out both', animationDelay: '0.1s' }}>
            No payments yet
          </h3>
          <p className="text-slate-400 text-[13px] max-w-sm leading-relaxed" style={{ animation: 'payEmptyFade 0.5s ease-out both', animationDelay: '0.2s' }}>
            Payments, prepayments, and reversals recorded against this invoice show up here.
          </p>
        </div>
        <style>{`
          @keyframes payEmptyFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
          @keyframes payEmptyFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Pending money banner — same slim gradient recipe as the GL Impact
          tab's "Not posted" banner. */}
      {hasPending && (
        <div
          className="rounded-xl border border-slate-200/80 px-4 py-3 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 60%)' }}
        >
          <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] flex items-center justify-center shrink-0">
            <CircleDashed className="w-4 h-4 text-slate-400" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[13px] text-slate-800 tracking-tight" style={{ fontWeight: 600 }}>
                {pendingHeadline} on file
              </p>
              <span
                className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] bg-slate-100 text-slate-500 border border-slate-200/80"
                style={{ fontWeight: 700 }}
              >
                Not Posted
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              They post to the GL and settle the balance only when recorded on their payment date.
            </p>
          </div>
        </div>
      )}

      <LineItemsTable<PaymentRow>
        rows={rows}
        columns={columns}
        catalog={PAYMENT_COLUMN_CATALOG}
        lockedKeys={['reference']}
        storageKey="omnesoft:invoice-payments:columns"
        getRowId={(r) => r.id}
        rowHeight={52}
        searchAccessor={(r) => `${r.reference} ${r.type} ${r.method} ${r.status}`}
        searchPlaceholder="Search payments…"
        title="Payments"
        countNoun="payments"
        emptyTitle="No payments yet"
        emptyIcon={Banknote}
        emptyMessage="Payments, prepayments, and reversals recorded against this invoice show up here."
        fillViewport
      />

    </div>
  );
}
