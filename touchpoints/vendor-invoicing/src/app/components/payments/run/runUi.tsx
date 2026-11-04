import { toast } from 'sonner';
import { highlightText } from '@/app/components/InvoiceDataTable';
import type { Payment } from '@/app/data/mockPayments';
import { liveLines, type PaymentRun, type PaymentRunStatus } from '@/app/data/paymentRuns';
import { overdueDaysOf, overdueLabel, overdueTone, localTodayIso } from '@/app/lib/dueBucket';

/* ── Small shared pieces for the payment run surfaces ─────────────── */

/** Shell-flush footer bar: escapes the stage body's padding so it reads
 *  as the modal footer every other flow uses (white, flush bottom). No
 *  top divider (user 10/8: "remove the grey line in the bottom").
 *  Must mirror the body padding in PaymentRunScreen. */
export const RUN_FOOTER_SHELL =
  '-mx-3 sm:-mx-5 -mb-3.5 shrink-0 bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center gap-3';

/** Same footer bar for flush stages (P1 has no body padding to escape). */
export const RUN_FOOTER_FLUSH =
  'shrink-0 bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center gap-3';

/** Invoice details open in a NEW tab (8/4/26): the run surface stays put. */
export const openInvoiceTab = (invoiceNumber: string) =>
  window.open(`/invoices/${encodeURIComponent(invoiceNumber)}`, '_blank', 'noopener');

/** The standard modal footer buttons (RecordPaymentFlow recipe). */
export const FOOTER_BTN_GHOST =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0 cursor-pointer px-3 sm:px-5 h-9 disabled:opacity-50 disabled:cursor-not-allowed';
export const FOOTER_BTN_PRIMARY =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 h-9 text-[13px] text-white shadow-sm transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "2026-07-29" → "Jul 29, 2026". */
export const humanDate = (isoDate: string) =>
  new Date(`${isoDate.split('T')[0]}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

/** What a run's status READS as (8/5/26, the detail header rule applied
 *  everywhere): a recorded run is Paid or Scheduled — its payments'
 *  own state — never "Executed"/"Partially Executed"/"Completed". */
export type RunDisplayStatus =
  | Exclude<PaymentRunStatus, 'Executed' | 'Partially Executed' | 'Completed'>
  | 'Paid'
  | 'Scheduled';

export function runDisplayStatus(run: PaymentRun, payments: Payment[]): RunDisplayStatus {
  if (run.status !== 'Executed' && run.status !== 'Partially Executed' && run.status !== 'Completed') {
    return run.status;
  }
  const runPayments = payments.filter((p) => p.runId === run.id);
  if (runPayments.length > 0) return runPayments.some((p) => p.status === 'Scheduled') ? 'Scheduled' : 'Paid';
  return run.paymentDate > localTodayIso() ? 'Scheduled' : 'Paid';
}

/** Export a run as CSV, one row per committed invoice line (shared by
 *  the detail Actions menu and the listing row menu). */
export function exportRunCsv(run: PaymentRun) {
  const esc = (v: string | number) => `"${String(v).split('"').join('""')}"`;
  const lines = liveLines(run);
  const rows = [
    ['Run', 'Vendor', 'Invoice', 'Due Date', 'Pay Amount', 'Method', 'Pay from Account'].join(','),
    ...run.groups.flatMap((g) =>
      lines
        .filter((l) => l.vendor === g.vendor)
        .map((l) => [esc(run.id), esc(l.vendor), esc(l.invoiceNumber), esc(l.dueDate), l.payAmount.toFixed(2), esc(g.methodType), esc(g.payFromAccountId)].join(',')),
    ),
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${run.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Run exported', { description: `${run.id}.csv, one row per invoice.` });
}

/** Due-date pill (8/28/26 review): the payment-term pill's two-segment
 *  recipe applied to due dates — the date rides a white segment, the
 *  urgency label its overdueTone segment, one pill instead of a plain
 *  date plus a floating status chip. Border follows the urgency tone. */
export function DueDatePill({ dueDate, labeled, className, searchQuery }: { dueDate: string; labeled?: boolean; className?: string; searchQuery?: string }) {
  const days = overdueDaysOf(dueDate);
  const border =
    days < 0 ? 'border-slate-200'
    : days === 0 ? 'border-yellow-200'
    : days <= 30 ? 'border-amber-200'
    : days <= 60 ? 'border-orange-200'
    : 'border-red-200';
  return (
    <span className={`inline-flex items-stretch rounded-full overflow-hidden border align-middle whitespace-nowrap ${border} ${className ?? ''}`}>
      <span className="inline-flex items-center px-2 py-[2px] text-[10.5px] bg-white text-slate-600 " style={{ fontWeight: 500 }}>
        {/* `labeled` spells out WHAT the date is (8/28/26 evening) — for
            surfaces without a "Due Date" column header to say it. */}
        {highlightText(labeled ? `Due ${humanDate(dueDate)}` : humanDate(dueDate), searchQuery)}
      </span>
      <span className={`inline-flex items-center px-2 py-[2px] text-[10.5px] border-l ${border} ${overdueTone(days)}`} style={{ fontWeight: 600 }}>
        {highlightText(overdueLabel(days), searchQuery)}
      </span>
    </span>
  );
}

/** Run lifecycle tones: Pending amber, Approved emerald, Paid green,
 *  Scheduled blue (the payment detail tones), Rejected red, Cancelled
 *  rose. Executed keys stay for surfaces that show the raw status.
 *  NO leading status dot, here or anywhere (8/7/26): the pill is just
 *  the label on its tone. */
const STATUS_TONES: Record<RunDisplayStatus | PaymentRunStatus, { bg: string; text: string }> = {
  Draft: { bg: 'bg-slate-100', text: 'text-slate-700' },
  'Pending Approval': { bg: 'bg-amber-50', text: 'text-amber-700' },
  // Changes requested is ORANGE, needs work, never terminal red (8/5/26).
  'Changes Requested': { bg: 'bg-orange-50', text: 'text-orange-700' },
  // Approved wears the Approve CTA's emerald (8/5/26): the status color
  // matches the action that produced it, listing pill through ladder.
  Approved: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  Executed: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'Partially Executed': { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  Completed: { bg: 'bg-green-50', text: 'text-green-700' },
  Paid: { bg: 'bg-green-50', text: 'text-green-700' },
  Scheduled: { bg: 'bg-blue-50', text: 'text-blue-700' },
  Cancelled: { bg: 'bg-rose-50', text: 'text-rose-700' },
};

export function RunStatusPill({ status, className, searchQuery }: { status: RunDisplayStatus | PaymentRunStatus; className?: string; searchQuery?: string }) {
  const tone = STATUS_TONES[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] ${tone.bg} ${tone.text} ${className ?? ''}`}
      style={{ fontWeight: 600 }}
    >
      {searchQuery ? highlightText(status, searchQuery) : status}
    </span>
  );
}
