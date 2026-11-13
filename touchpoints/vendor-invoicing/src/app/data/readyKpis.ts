import type { Invoice } from '@/app/data/mockInvoices';
import { daysUntil as dueBucketDaysUntil } from '@/app/lib/dueBucket';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import { formatMoney } from '@/app/currency/money';
import { toInvoiceBase } from '@/app/currency/invoiceFx';

// KPI catalogue for the Vendor Payments "Invoices to pay" tab. Mirrors the
// payment insights shape (key/label/category/icon/subtitle/tooltip) so the
// same customize drawer + DraggableKpiCard render it. Computed on the
// ready-to-pay invoice subset for the selected date range; these are
// point-in-time snapshots, so there is no prior-period delta.
// Set + copy per design feedback 7/14/26.
export interface ReadyKpiDefinition {
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

export const ALL_READY_KPI_DEFINITIONS: ReadyKpiDefinition[] = [
  {
    key: 'ready_to_pay', label: 'Ready to Pay', category: 'Payables',
    iconName: 'CircleDollarSign', iconBg: blue.bg, iconColor: blue.color,
    subtitle: 'Invoices that have been approved and are ready for payment.', tooltip: 'Invoices that have been approved and are ready for payment.',
  },
  {
    key: 'overdue', label: 'Overdue', category: 'Timing & Risk',
    iconName: 'Clock', iconBg: '#FFF1F2', iconColor: '#E11D48',
    subtitle: 'Invoices past their due date.', tooltip: 'Invoices past their due date.',
  },
  {
    key: 'due_today', label: 'Due Today', category: 'Timing & Risk',
    iconName: 'Calendar', iconBg: '#FFFBEB', iconColor: '#B45309',
    subtitle: 'Invoices due by end of day.', tooltip: 'Invoices due by end of day.',
  },
  {
    key: 'due_this_week', label: 'Due This Week', category: 'Timing & Risk',
    iconName: 'Clock', iconBg: '#FFFBEB', iconColor: '#B45309',
    subtitle: 'Invoices due within the next 7 days.', tooltip: 'Invoices due within the next 7 days.',
  },
  {
    key: 'oldest_invoice', label: 'Oldest Invoice', category: 'Timing & Risk',
    iconName: 'AlertTriangle', iconBg: '#FFF1F2', iconColor: '#E11D48',
    subtitle: 'How far past due your oldest invoice is.', tooltip: 'How far past due your oldest invoice is.',
  },
  {
    key: 'largest_invoice', label: 'Largest Invoice', category: 'Payables',
    iconName: 'ArrowUpRight', iconBg: '#EFF6FF', iconColor: '#2563EB',
    subtitle: 'Your single biggest invoice in this run.', tooltip: 'Your single biggest invoice in this run.',
  },
  {
    key: 'next_due_date', label: 'Next Due Date', category: 'Timing & Risk',
    iconName: 'Calendar', iconBg: '#EFF6FF', iconColor: '#2563EB',
    subtitle: 'When your next payment is due.', tooltip: 'When your next payment is due.',
  },
];

export const DEFAULT_READY_KPI_KEYS = [
  'ready_to_pay',
  'overdue',
  'due_today',
  'due_this_week',
  'oldest_invoice',
  'largest_invoice',
  'next_due_date',
];

// Currency & Exchange Rates: in the base currency, each invoice converted at
// its own rate before it is added up or compared.
const money = (n: number) => formatMoney(n, BASE_CURRENCY);
const due = (inv: Invoice) => toInvoiceBase(inv, inv.outstandingBalance);
// The shared midnight-anchored day count (9/22/26 review response): the
// old fractional Date.now() rounding read "Sep 21, due today" on Sep 20.
const daysUntil = dueBucketDaysUntil;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${MONTH_SHORT[parseInt(m, 10) - 1] || m} ${parseInt(d, 10)}, ${y}`;
};

export interface ReadyKpiContext {
  selectedCount: number;
  selectedDue: number;
}

export function computeReadyKpi(
  key: string,
  ready: Invoice[],
  _ctx: ReadyKpiContext,
): { value: string; sub: string } {
  const sumDue = (rows: Invoice[]) => rows.reduce((s, i) => s + due(i), 0);
  switch (key) {
    case 'ready_to_pay':
      return { value: String(ready.length), sub: `${money(sumDue(ready))} due` };
    case 'overdue': {
      const rows = ready.filter((i) => daysUntil(i.dueDate) < 0);
      return { value: String(rows.length), sub: rows.length === 0 ? 'On Time' : `${money(sumDue(rows))} past due` };
    }
    case 'due_today': {
      const rows = ready.filter((i) => daysUntil(i.dueDate) === 0);
      return { value: String(rows.length), sub: rows.length === 0 ? 'Nothing due today' : `${money(sumDue(rows))} due today` };
    }
    case 'due_this_week': {
      const rows = ready.filter((i) => { const d = daysUntil(i.dueDate); return d >= 0 && d <= 7; });
      return { value: String(rows.length), sub: `${money(sumDue(rows))} due soon` };
    }
    case 'oldest_invoice': {
      const overdue = ready.filter((i) => daysUntil(i.dueDate) < 0);
      if (overdue.length === 0) return { value: '—', sub: 'Nothing past due' };
      const oldest = overdue.reduce((a, b) => (daysUntil(b.dueDate) < daysUntil(a.dueDate) ? b : a));
      const days = Math.abs(daysUntil(oldest.dueDate));
      return { value: `${days} days`, sub: `past due · ${oldest.invoiceNumber}` };
    }
    case 'largest_invoice': {
      if (ready.length === 0) return { value: '—', sub: 'Nothing payable' };
      const top = ready.reduce((a, b) => (due(b) > due(a) ? b : a));
      return { value: money(due(top)), sub: top.vendor };
    }
    case 'next_due_date': {
      const upcoming = ready.filter((i) => daysUntil(i.dueDate) >= 0);
      if (upcoming.length === 0) return { value: '—', sub: 'Nothing upcoming' };
      const next = upcoming.reduce((a, b) => (daysUntil(b.dueDate) < daysUntil(a.dueDate) ? b : a));
      const d = daysUntil(next.dueDate);
      return { value: shortDate(next.dueDate), sub: d === 0 ? 'due today' : `in ${d} day${d === 1 ? '' : 's'}` };
    }
    default:
      return { value: '—', sub: '' };
  }
}
