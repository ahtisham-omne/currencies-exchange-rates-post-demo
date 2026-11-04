import type { PaymentRun } from '@/app/data/paymentRuns';
import { daysUntil as sharedDaysUntil } from '@/app/lib/dueBucket';
import { liveLines, OPEN_RUN_STATUSES } from '@/app/data/paymentRuns';
import { runTotal } from '@/app/lib/runMath';
import type { InsightsRange, CustomRange } from '@/app/components/InvoiceInsightsPanel';

// KPI catalogue for the Vendor Payments "Payment runs" tab. Mirrors the
// ready-to-pay insights shape (key/label/category/icon/subtitle/tooltip) so
// the same customize drawer + DraggableKpiCard render it. Computed on the
// runs created in the selected date range; point-in-time snapshots, so no
// prior-period delta.
export interface RunKpiDefinition {
  key: string;
  label: string;
  category: string;
  iconName: string; // must be a PaymentKpiIcon-supported name
  iconBg: string;
  iconColor: string;
  subtitle: string;
  tooltip: string;
}

const blue = { bg: 'hsl(var(--accent))', color: 'hsl(var(--primary))' };

// Catalogue reworked 8/31/26 (user feedback: the old set read like status
// tallies, not decisions). Each card answers a real question: what paid
// last, what has paid ever, what is stuck waiting on me, what is committed
// Trimmed to THREE (user 9/23): Awaiting approval, Invoices in runs,
// Payments completed — the rest left the palette.
export const ALL_RUN_KPI_DEFINITIONS: RunKpiDefinition[] = [
  {
    key: 'runs_to_approve', label: 'Awaiting Approval', category: 'Work Queue',
    iconName: 'Clock', iconBg: '#FFFBEB', iconColor: '#B45309',
    subtitle: "Runs that can't pay until approved.", tooltip: "Runs that can't pay until approved.",
  },
  {
    key: 'invoices_in_runs', label: 'Invoices in Runs', category: 'Pipeline',
    iconName: 'CircleDollarSign', iconBg: blue.bg, iconColor: blue.color,
    subtitle: 'Approved invoices currently in a run.', tooltip: 'Approved invoices currently in a run.',
  },
  {
    key: 'total_runs', label: 'Payments Completed', category: 'History',
    iconName: 'CheckCircle2', iconBg: '#ECFDF5', iconColor: '#059669',
    subtitle: 'Runs that have finished paying.', tooltip: 'Runs that have finished paying.',
  },
];

export const DEFAULT_RUN_KPI_KEYS = [
  'runs_to_approve',
  'invoices_in_runs',
  'total_runs',
];

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Shared midnight-anchored day count (9/22/26 review response): the old
// fractional Date.now() math read "in 1 day" for a date two days out.
const daysUntil = (dateStr: string) => sharedDaysUntil(dateStr.split('T')[0]);
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('T')[0].split('-');
  if (!y || !m || !d) return iso;
  return `${MONTH_SHORT[parseInt(m, 10) - 1] || m} ${parseInt(d, 10)}, ${y}`;
};

const RANGE_DAYS: Record<InsightsRange, number | null> = {
  last_7: 7,
  last_30: 30,
  last_90: 90,
  last_365: 365,
  all_time: null,
  custom: null,
};

/** Range scoping keyed on when the run was created, mirroring the invoice
 *  bands (which key on createdDate). */
export function filterRunsByRange(runs: PaymentRun[], range: InsightsRange, custom?: CustomRange): PaymentRun[] {
  if (range === 'custom') {
    if (!custom?.from || !custom?.to) return runs;
    return runs.filter((r) => {
      const d = r.createdAt.slice(0, 10);
      return d >= custom.from && d <= custom.to;
    });
  }
  const days = RANGE_DAYS[range];
  if (days === null) return runs;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return runs.filter((r) => new Date(r.createdAt) >= cutoff);
}

const isOpen = (r: PaymentRun) => OPEN_RUN_STATUSES.includes(r.status);

export function computeRunKpi(key: string, runs: PaymentRun[]): { value: string; sub: string } {
  const sumTotals = (rows: PaymentRun[]) => rows.reduce((s, r) => s + runTotal(r), 0);
  switch (key) {
    case 'last_run': {
      const done = runs.filter((r) => r.status === 'Completed');
      if (done.length === 0) return { value: '—', sub: 'No completed runs yet' };
      const last = done.reduce((a, b) =>
        ((b.completedAt ?? b.paymentDate) > (a.completedAt ?? a.paymentDate) ? b : a));
      return { value: money(runTotal(last)), sub: `${last.id} · ${shortDate(last.completedAt ?? last.paymentDate)}` };
    }
    case 'total_runs': {
      const done = runs.filter((r) => r.status === 'Completed');
      return { value: String(done.length), sub: done.length === 0 ? 'None completed yet' : `${money(sumTotals(done))} paid in total` };
    }
    case 'runs_to_approve': {
      const rows = runs.filter((r) => r.status === 'Pending Approval');
      return { value: String(rows.length), sub: rows.length === 0 ? 'Nothing waiting' : `${money(sumTotals(rows))} waiting to move` };
    }
    case 'approved_scheduled': {
      const rows = runs.filter((r) => r.status === 'Approved');
      return { value: String(rows.length), sub: rows.length === 0 ? 'Nothing scheduled' : `${money(sumTotals(rows))} committed` };
    }
    case 'changes_requested': {
      const rows = runs.filter((r) => r.status === 'Changes Requested');
      return { value: String(rows.length), sub: rows.length === 0 ? 'Nothing sent back' : `${money(sumTotals(rows))} parked on fixes` };
    }
    case 'next_payment_date': {
      // "Next" = authorized, scheduled work (9/22/26 review response,
      // Claude C11-D2): a run parked in Changes requested has no
      // payment date anyone committed to, so it never supplies the card.
      const open = runs.filter((r) => isOpen(r) && r.status !== 'Changes Requested');
      if (open.length === 0) return { value: '—', sub: 'No open runs' };
      const next = open.reduce((a, b) => (b.paymentDate < a.paymentDate ? b : a));
      const d = daysUntil(next.paymentDate);
      const rel = d === 0 ? 'today' : d > 0 ? `in ${d} day${d === 1 ? '' : 's'}` : `${-d} day${d === -1 ? '' : 's'} ago`;
      return { value: shortDate(next.paymentDate), sub: `${next.id} · ${rel}` };
    }
    case 'invoices_in_runs': {
      const open = runs.filter(isOpen);
      const lines = open.flatMap((r) => liveLines(r));
      const vendors = new Set(lines.map((l) => l.vendor)).size;
      return { value: String(lines.length), sub: lines.length === 0 ? 'Nothing locked' : `${vendors} vendor${vendors === 1 ? '' : 's'}` };
    }
    case 'largest_run': {
      const open = runs.filter(isOpen);
      if (open.length === 0) return { value: '—', sub: 'No open runs' };
      const top = open.reduce((a, b) => (runTotal(b) > runTotal(a) ? b : a));
      return { value: money(runTotal(top)), sub: top.id };
    }
    default:
      return { value: '—', sub: '' };
  }
}
