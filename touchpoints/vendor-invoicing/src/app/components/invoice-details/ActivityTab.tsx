import { useMemo } from 'react';
import {
  FilePlus,
  Pencil,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  CreditCard,
  RotateCcw,
  Receipt,
  Flag,
  ShieldCheck,
  Paperclip,
  Trash2,
  Archive,
  ArchiveRestore,
  Cog,
  Wallet,
} from 'lucide-react';
import { Invoice } from '@/app/data/mockInvoices';
import { Payment } from '@/app/data/mockPayments';
import { LinkedFinancialRecord } from '@/app/data/invoiceLinkedRecords';
import { EmptyState } from '@/app/components/EmptyState';
import { PaymentRecord } from './ReversePaymentModal';

// Partner Contact-Directory > Activity History tab recipe — a
// single Activity History card with a vertical timeline of events:
//
//   ┌───────────────────────────────────────────────┐
//   │ Activity History                     N events │
//   ├───────────────────────────────────────────────┤
//   │ (●)──  Mar 28, 2026 at 03:15 PM               │
//   │  │    Sarah Johnson approved Purchase Order   │
//   │  │                                            │
//   │ (●)──  Mar 25, 2026 at 07:00 PM               │
//   │  │    System sent Email to issacarcher@…       │
//   │  …                                            │
//   └───────────────────────────────────────────────┘
//
// Each row has an icon circle on the timeline, the absolute
// timestamp in slate-500 small caps, and an action line where the
// actor is bolded and the subject reference is a coloured link.
// The previous expandable "Show detail" pattern is dropped — the
// partner reference puts everything on one line per event.

type EventKind =
  | 'created'
  | 'edited'
  | 'approved'
  | 'rejected'
  | 'hold'
  | 'hold-released'
  | 'payment'
  | 'payment-reversed'
  | 'credit-memo'
  | 'exception-raised'
  | 'exception-resolved'
  | 'attachment-added'
  | 'attachment-deleted'
  | 'archived'
  | 'restored'
  | 'prepay-applied'
  | 'reconciled';

interface ActivityEvent {
  id: string;
  kind: EventKind;
  actor: string;
  /** Verb phrase placed between actor and subject, e.g. "approved", "added payment to". */
  verb: string;
  /** Subject rendered as a coloured chip-link at the end of the line. */
  subject?: { label: string; tone: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'slate' };
  /** Optional one-line detail/reason rendered in slate beneath the action line. */
  detail?: string;
  at: string;
  isSystem?: boolean;
}

const KIND_META: Record<EventKind, { icon: typeof FilePlus; color: string; bg: string }> = {
  created: { icon: FilePlus, color: '#2563EB', bg: '#EFF6FF' },
  edited: { icon: Pencil, color: '#475569', bg: '#F1F5F9' },
  approved: { icon: CheckCircle2, color: '#047857', bg: '#ECFDF5' },
  rejected: { icon: XCircle, color: '#991B1B', bg: '#FEF2F2' },
  hold: { icon: Pause, color: '#92400E', bg: '#FFFBEB' },
  'hold-released': { icon: Play, color: '#047857', bg: '#ECFDF5' },
  payment: { icon: CreditCard, color: '#6D28D9', bg: '#F5F3FF' },
  'payment-reversed': { icon: RotateCcw, color: '#B45309', bg: '#FFFBEB' },
  'credit-memo': { icon: Receipt, color: '#B45309', bg: '#FFFBEB' },
  'exception-raised': { icon: Flag, color: '#991B1B', bg: '#FEF2F2' },
  'exception-resolved': { icon: ShieldCheck, color: '#047857', bg: '#ECFDF5' },
  'attachment-added': { icon: Paperclip, color: '#475569', bg: '#F1F5F9' },
  'attachment-deleted': { icon: Trash2, color: '#991B1B', bg: '#FEF2F2' },
  archived: { icon: Archive, color: '#475569', bg: '#F1F5F9' },
  restored: { icon: ArchiveRestore, color: '#047857', bg: '#ECFDF5' },
  // Reconciliation pair (9/2/26): prepayment identity violet on the
  // receiving invoice, settlement green on the pre-invoice.
  'prepay-applied': { icon: Wallet, color: '#6D28D9', bg: '#F5F3FF' },
  reconciled: { icon: CheckCircle2, color: '#047857', bg: '#ECFDF5' },
};

const SUBJECT_TONE: Record<NonNullable<ActivityEvent['subject']>['tone'], { bg: string; text: string; border: string }> = {
  blue: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  emerald: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  violet: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
  amber: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  rose: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  slate: { bg: '#F1F5F9', text: '#334155', border: '#E2E8F0' },
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatPartnerTimestamp(iso: string) {
  // Accept either YYYY-MM-DD or full ISO; output "Mar 28, 2026 at 03:15 PM".
  // A DATE-ONLY string parses at local midnight and renders as a plain
  // date (9/22/26 review response, GPT RR14): `new Date('2026-09-20')`
  // parses UTC and used to render as "Sep 19 at 08:00 PM" — an event
  // time nobody acted at.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso.trim());
  const d = new Date(dateOnly ? `${iso.trim()}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const month = MONTH_SHORT[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  if (dateOnly) return `${month} ${day}, ${year}`;
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hh = hours.toString().padStart(2, '0');
  return `${month} ${day}, ${year} at ${hh}:${minutes} ${period}`;
}

export function ActivityTab({
  invoice,
  payments,
  records = [],
  appPayments = [],
}: {
  invoice: Invoice;
  payments: PaymentRecord[];
  /** Linked financial records — surfaces credit memos and reversed
   *  payments in the activity feed (feedback 7/16/26: events removed
   *  from the journey timeline live here instead). */
  records?: LinkedFinancialRecord[];
  /** App-recorded payment records applied to this invoice. */
  appPayments?: Payment[];
}) {
  const events = useMemo<ActivityEvent[]>(() => {
    const list: ActivityEvent[] = [];
    const money = (n: number) =>
      `${invoice.currency === 'USD' ? '$' : invoice.currency + ' '}${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    list.push({
      id: 'ev-created',
      kind: 'created',
      actor: invoice.createdBy || 'System',
      isSystem: !invoice.createdBy || invoice.createdBy === 'System',
      verb: 'created',
      subject: { label: invoice.invoiceNumber, tone: 'blue' },
      detail: `Type: ${invoice.type} · Currency: ${invoice.currency}`,
      at: invoice.createdDate || invoice.invoiceDate,
    });

    // Reconciliation (9/2/26): prepayments consumed at creation read as
    // their own violet nodes right after Created — one per pre-invoice.
    (invoice.appliedPrepayments || []).forEach((p, i) => {
      list.push({
        id: `ev-prepay-${i}`,
        kind: 'prepay-applied',
        actor: invoice.createdBy || 'System',
        isSystem: !invoice.createdBy || invoice.createdBy === 'System',
        verb: `applied ${money(p.amount)} prepayment from`,
        subject: { label: p.invoiceNumber, tone: 'violet' },
        detail: 'Applied automatically at creation; the pre-invoice was reconciled.',
        at: invoice.createdDate || invoice.invoiceDate,
      });
    });

    (invoice.actionHistory || []).forEach((entry, i) => {
      const lower = entry.action.toLowerCase();
      // Reconciled pre-invoices settle with a dedicated node linking to
      // the receiving invoice (9/2/26); everything else keeps its map.
      if (lower.includes('reconcil')) {
        list.push({
          id: `ev-hist-${i}`,
          kind: 'reconciled',
          actor: entry.by,
          verb: invoice.reconciledIntoInvoiceNumber ? 'reconciled this pre-invoice into' : 'reconciled',
          subject: invoice.reconciledIntoInvoiceNumber
            // The inventory invoice it became: blue (type colors, user 10/10).
            ? { label: invoice.reconciledIntoInvoiceNumber, tone: 'blue' }
            : { label: invoice.invoiceNumber, tone: 'blue' },
          detail: entry.reason,
          at: entry.at,
        });
        return;
      }
      const kind: EventKind = lower.includes('approve')
        ? 'approved'
        : lower.includes('reject')
          ? 'rejected'
          : lower.includes('hold released') || lower.includes('release')
            ? 'hold-released'
            : lower.includes('hold')
              ? 'hold'
              : lower.includes('archive')
                ? 'archived'
                : lower.includes('restore')
                  ? 'restored'
                  : lower.includes('resolve')
                    ? 'exception-resolved'
                    : lower.includes('exception')
                      ? 'exception-raised'
                      : 'edited';
      // Human verbs for the resolution pair (9/4/26, BB-16) — the raw
      // action strings read as code, not a sentence.
      const verb =
        kind === 'exception-resolved'
          ? 'resolved the exception on'
          : kind === 'exception-raised'
            ? 'flagged an exception on'
            : entry.action;
      list.push({
        id: `ev-hist-${i}`,
        kind,
        actor: entry.by,
        verb,
        subject: { label: invoice.invoiceNumber, tone: 'blue' },
        detail: [entry.reason, entry.attachments?.length ? `${entry.attachments.length} document${entry.attachments.length === 1 ? '' : 's'} attached` : '']
          .filter(Boolean)
          .join(' · '),
        at: entry.at,
      });
    });

    payments.forEach((p, i) => {
      list.push({
        id: `ev-pay-${i}`,
        kind: 'payment',
        actor: invoice.createdBy || 'System',
        verb: `recorded ${money(p.amount)} payment on`,
        subject: { label: p.reference, tone: 'violet' },
        at: p.date,
      });
    });

    // Credit memos and reversed payments no longer render on the journey
    // timeline (7/16/26) — the activity feed is their full record.
    const seenRefs = new Set<string>();
    records.forEach((r, i) => {
      seenRefs.add(r.reference);
      if (r.type === 'Credit Memo') {
        list.push({
          id: `ev-credit-${i}`,
          kind: 'credit-memo',
          actor: r.createdBy || 'System',
          verb: `applied ${money(r.amount)} credit memo`,
          subject: { label: r.reference, tone: 'amber' },
          detail: r.description || undefined,
          at: r.date,
        });
      } else if ((r.type === 'Payment' || r.type === 'Prepayment') && (r.status === 'Reversed' || r.status === 'Returned')) {
        list.push({
          id: `ev-reversal-${i}`,
          kind: 'payment-reversed',
          actor: r.createdBy || 'System',
          verb: `reversed ${money(r.amount)} ${r.type === 'Prepayment' ? 'prepayment' : 'payment'}`,
          subject: { label: r.reference, tone: 'rose' },
          detail: r.description || undefined,
          at: r.date,
        });
      }
    });
    appPayments.forEach((p, i) => {
      if (p.status !== 'Reversed' || seenRefs.has(p.paymentNumber)) return;
      const applied = (p.appliedInvoices ?? []).filter((a) => a.invoiceNumber === invoice.invoiceNumber);
      if (applied.length === 0) return;
      list.push({
        id: `ev-app-reversal-${i}`,
        kind: 'payment-reversed',
        actor: p.createdBy || 'System',
        verb: `reversed ${money(applied.reduce((s, a) => s + a.amount, 0))} ${p.type === 'Prepayment' ? 'prepayment' : 'payment'}`,
        subject: { label: p.paymentNumber, tone: 'rose' },
        detail: p.memo || undefined,
        at: p.updatedDate || p.paymentDate,
      });
    });

    // The synthetic approval node exists only for seed invoices with no
    // recorded history. When actionHistory holds a real approve entry it
    // is the single source of truth (BA 9/28: the log showed the same
    // approval twice, the synthetic copy timeless and below created).
    const hasRealApprove = (invoice.actionHistory ?? []).some((e) => e.action.toLowerCase().includes('approve'));
    if (!hasRealApprove && (invoice.status === 'Approved' || invoice.status === 'Partially Paid' || invoice.status === 'Paid in Full' || invoice.status === 'Settled')) {
      list.push({
        id: 'ev-approved',
        kind: 'approved',
        actor: 'Ahtisham Ahmad',
        verb: 'approved and posted',
        subject: { label: invoice.invoiceNumber, tone: 'emerald' },
        // Date-only stamps sort at midnight, under same-day events; an
        // explicit morning time keeps the node above created and dated.
        at: `${(invoice.postingDate || invoice.invoiceDate).slice(0, 10)}T08:00:00`,
      });
    }

    if (invoice.is_exception) {
      list.push({
        id: 'ev-exception',
        kind: 'exception-raised',
        actor: 'System',
        isSystem: true,
        verb: 'flagged an exception on',
        subject: { label: invoice.invoiceNumber, tone: 'rose' },
        detail: 'Awaiting reviewer action',
        at: invoice.createdDate || invoice.invoiceDate,
      });
    }

    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [invoice, payments, records, appPayments]);

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white py-4 flex items-center justify-center" style={{ minHeight: 'max(400px, calc(100vh - 269px))' }}>
        {/* Module-standard empty state (EmptyState component, 7/15/26). */}
        <EmptyState
          icon={Cog}
          title="No activity recorded yet"
          description="Approvals, payments, holds and other events on this invoice show up here."
        />
      </div>
    );
  }

  return (
    // Fills the column to the viewport bottom (user 10/2, matching the
    // Coming Soon / Payments empty-state treatment).
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col" style={{ minHeight: 'max(400px, calc(100vh - 269px))' }}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        {/* "Activity" exactly (GPT QC02: the Sept 28 standard's name). */}
        <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Activity</h3>
        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
          {events.length} event{events.length === 1 ? '' : 's'}
        </span>
      </div>

      <ol className="relative px-4 py-4 flex-1">
        {/* Vertical timeline rail */}
        <div className="absolute left-[28px] top-6 bottom-6 w-px bg-slate-200 pointer-events-none" />

        {events.map((event) => {
          const meta = KIND_META[event.kind];
          const tone = event.subject ? SUBJECT_TONE[event.subject.tone] : null;
          return (
            <li key={event.id} className="relative pl-10 pr-2 py-2.5 group">
              {/* Icon dot on the rail */}
              <div
                className="absolute left-[14px] top-3 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                style={{ backgroundColor: meta.bg }}
              >
                <meta.icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
              </div>

              {/* Timestamp */}
              <p className="text-[11px] text-slate-500 " style={{ fontWeight: 500 }}>
                {formatPartnerTimestamp(event.at)}
              </p>

              {/* Action line */}
              <p className="mt-0.5 text-[12px] text-slate-700 leading-snug" style={{ fontWeight: 400 }}>
                <span className="text-foreground" style={{ fontWeight: 600 }}>
                  {event.actor}
                </span>{' '}
                <span className="text-slate-600">{event.verb}</span>
                {event.subject && tone && (
                  <>
                    {' '}
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="inline-flex items-center px-1.5 py-px rounded text-[11px] hover:underline align-baseline"
                      style={{
                        fontWeight: 700,
                        backgroundColor: tone.bg,
                        color: tone.text,
                        border: `1px solid ${tone.border}`,
                      }}
                    >
                      {event.subject.label}
                    </a>
                  </>
                )}
              </p>

              {/* Optional detail line */}
              {event.detail && (
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                  {event.detail}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
