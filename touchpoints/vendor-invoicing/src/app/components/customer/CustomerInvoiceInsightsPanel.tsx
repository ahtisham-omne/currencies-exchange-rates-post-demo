import { useState, useMemo, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import {
  Search,
  ChartColumn,
  Receipt,
  AlertTriangle,
  DollarSign,
  X,
  Check,
  Plus,
  Sliders,
  ToggleLeft,
  ToggleRight,
  // KPI icons (10/30): each one names what the card counts.
  FilePlus2,
  Files,
  Hourglass,
  FileCheck2,
  FileX2,
  HandCoins,
  CircleCheckBig,
  CalendarX2,
  MessageSquareWarning,
  ShieldAlert,
  CircleDollarSign,
  CalendarClock,
  Timer,
  Trophy,
  PiggyBank,
  Truck,
  Coins,
  Milestone,
  AlarmClock,
  ArrowUpNarrowWide,
  Users,
  SquareCheck,
  type LucideIcon,
} from 'lucide-react';
import type { CustomerInvoice } from '@/app/data/ar/mockCustomerInvoices';
import type { CustomerDeposit } from '@/app/data/ar/mockCustomerDeposits';
import {
  netDue,
  paymentStatusOf,
  isOverdue,
  daysOverdue,
  receiptsTotal,
  depositsAppliedTotal,
  depositRemaining,
} from '@/app/data/ar/customerInvoiceStatus';
import { mockCustomers, type Customer } from '@/app/data/ar/mockCustomers';
import { readyToInvoiceRows, shippedValueWaiting } from '@/app/data/ar/arBilling';
import { palette } from '@/styles/tokens';
// The AR panel reuses the vendor insights primitives verbatim so the two
// list screens render KPI cards through the exact same shapes: the range
// union, the custom window, and the computed { value, sub, delta } card
// payload that DraggableKpiCard consumes.
import type { InsightsRange, CustomRange, ComputedKpi, KpiDelta } from '@/app/components/InvoiceInsightsPanel';
import { highlightText } from '@/app/components/InvoiceDataTable';

export type { InsightsRange, CustomRange, ComputedKpi, KpiDelta } from '@/app/components/InvoiceInsightsPanel';

/** AR alias of the shared insights range so customer call sites can stay
 *  domain-named while the underlying union remains the vendor one. */
export type CustomerInsightsRange = InsightsRange;

export interface CustomerKpiDefinition {
  key: string;
  label: string;
  category: 'Pipeline & Volume' | 'Exceptions & Risk' | 'Cash & Performance';
  iconName: string;
  iconBg: string;
  iconColor: string;
  subtitle: string;
  tooltip?: string;
  /** Optional example, rendered on its own line under the tooltip text. */
  example?: string;
  /** Optional fixed-pitch formula shown in the KPI tooltip — same
   *  pattern as the ATP hover on quotes/sales orders. Use a short
   *  multi-line string so the math is scannable in the popover. */
  formula?: string;
}

export const ALL_CUSTOMER_KPI_DEFINITIONS: CustomerKpiDefinition[] = [
  // Pipeline & Volume (invoicing first, PRD §5)
  {
    key: 'ready_to_invoice',
    label: 'Ready to Invoice',
    category: 'Pipeline & Volume',
    iconName: 'FilePlus2',
    iconBg: palette.indigo[50],
    iconColor: palette.indigo[600],
    subtitle: 'Shipped or due, not billed',
    tooltip: 'Shipped goods and advance stages that have fallen due but are not on an invoice yet.',
  },
  {
    key: 'total_invoices',
    label: 'Invoices in This Period',
    category: 'Pipeline & Volume',
    iconName: 'Files',
    iconBg: 'hsl(var(--accent))',
    iconColor: 'hsl(var(--primary))',
    subtitle: 'All documents in the period',
    tooltip: 'Customer invoices created in this period.',
  },
  {
    key: 'pending_approval',
    label: 'Pending Approval',
    category: 'Pipeline & Volume',
    iconName: 'Hourglass',
    iconBg: palette.orange[50],
    iconColor: palette.orange[600],
    subtitle: 'Awaiting approver action',
    tooltip: 'Invoices waiting to be approved before they can be sent.',
  },
  {
    key: 'approved_not_sent',
    label: 'Approved, Not Sent',
    category: 'Pipeline & Volume',
    iconName: 'FileCheck2',
    iconBg: palette.emerald[50],
    iconColor: palette.emerald[700],
    subtitle: 'Approved, waiting to go out',
    tooltip: 'Approved invoices that have not been sent to the customer yet.',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    category: 'Pipeline & Volume',
    iconName: 'FileX2',
    iconBg: palette.rose[50],
    iconColor: palette.rose[600],
    subtitle: 'Sent back for changes',
    tooltip: 'Invoices the approver sent back with a reason. Edit and resubmit, or cancel them.',
  },
  {
    key: 'awaiting_payment',
    label: 'Awaiting Payment',
    category: 'Pipeline & Volume',
    iconName: 'HandCoins',
    iconBg: palette.blue[50],
    iconColor: palette.blue[600],
    subtitle: 'Sent, not yet due',
    tooltip: 'Sent invoices with a balance open, still inside their terms.',
  },
  {
    key: 'paid_in_full',
    label: 'Paid in Full',
    category: 'Pipeline & Volume',
    iconName: 'CircleCheckBig',
    iconBg: palette.emerald[50],
    iconColor: 'hsl(var(--success))',
    subtitle: 'Fully collected invoices',
    tooltip: 'Invoices your customers have paid off completely.',
  },

  // Exceptions & Risk
  {
    key: 'overdue',
    label: 'Overdue',
    category: 'Exceptions & Risk',
    iconName: 'CalendarX2',
    iconBg: palette.rose[50],
    iconColor: palette.rose[600],
    subtitle: 'Past due, not fully paid',
    tooltip: 'Invoices past their due date with a balance still open.',
  },
  {
    key: 'open_disputes',
    label: 'Open Disputes',
    category: 'Exceptions & Risk',
    iconName: 'MessageSquareWarning',
    iconBg: palette.red[50],
    iconColor: 'hsl(var(--destructive))',
    subtitle: 'Disputed, balance open',
    tooltip: 'Invoices the customer is disputing while money is still owed.',
    example: 'a customer contests a freight charge before paying.',
  },
  {
    key: 'credit_hold',
    label: 'Credit Hold',
    category: 'Exceptions & Risk',
    iconName: 'ShieldAlert',
    iconBg: palette.amber[50],
    iconColor: palette.amber[700],
    subtitle: 'Customers on credit hold',
    tooltip: 'Invoices for customers whose credit is currently on hold.',
  },

  // Cash & Performance
  {
    key: 'total_outstanding',
    label: 'Total Outstanding',
    category: 'Cash & Performance',
    iconName: 'CircleDollarSign',
    iconBg: palette.red[50],
    iconColor: 'hsl(var(--destructive))',
    subtitle: 'Everything still owed to you',
    tooltip: 'The total your customers still owe across all open invoices.',
    formula: 'total billed − total collected',
  },
  {
    key: 'dso',
    label: 'Days Sales Outstanding',
    category: 'Cash & Performance',
    iconName: 'CalendarClock',
    iconBg: palette.violet[50],
    iconColor: 'hsl(var(--violet))',
    subtitle: 'Avg days invoice to cash',
    tooltip: 'The average number of days it takes customers to pay you.',
  },
  {
    key: 'avg_approval_time',
    label: 'Avg Approval Time',
    category: 'Cash & Performance',
    iconName: 'Timer',
    iconBg: palette.blue[50],
    iconColor: palette.blue[600],
    subtitle: 'Creation to approval',
    tooltip: "The average time from when an invoice is created to when it's approved.",
  },
  {
    key: 'top_customer',
    label: 'Top Customer by Revenue',
    category: 'Cash & Performance',
    iconName: 'Trophy',
    iconBg: palette.amber[100],
    iconColor: palette.amber[600],
    subtitle: 'Highest-revenue customer',
    tooltip: "The customer you've billed the most in this period.",
  },
  {
    key: 'deposits_held',
    label: 'Customer Deposits Held',
    category: 'Cash & Performance',
    iconName: 'PiggyBank',
    iconBg: palette.teal[50],
    iconColor: palette.teal[600],
    subtitle: 'Advances not yet applied',
    tooltip: 'Customer money you hold as a liability until it is applied to an invoice.',
  },
  {
    key: 'shipped_not_invoiced',
    label: 'Shipped, Not Invoiced',
    category: 'Cash & Performance',
    iconName: 'Truck',
    iconBg: palette.indigo[50],
    iconColor: palette.indigo[600],
    subtitle: 'Delivered value not yet billed',
    tooltip: 'Value of shipped or delivered goods that has not been invoiced yet.',
  },
];

/** Default band = ONE relevant row, the vendor listing's shape (user
 *  9/25 parity; was the full 11-card spec set sprawled over two rows).
 *  Everything else stays a click away in Add insights. */
export const DEFAULT_CUSTOMER_KPI_KEYS: string[] = [
  'ready_to_invoice',
  'pending_approval',
  'approved_not_sent',
  'rejected',
];

// ─── Range filtering ─────────────────────────────────────────────────────
//
// Mirrors the vendor filterInvoicesByRange: the Performance Insights
// date-range dropdown narrows the KPI dataset to invoices whose
// createdDate falls within the chosen window. "All time" returns every row.

const RANGE_DAYS: Record<InsightsRange, number | null> = {
  last_7: 7,
  last_30: 30,
  last_90: 90,
  last_365: 365,
  all_time: null,
  custom: null,
};

function withinCustom(dateStr: string | undefined, custom?: CustomRange): boolean {
  if (!custom?.from || !custom?.to || !dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= custom.from && d <= custom.to;
}

export function filterCustomerInvoicesByRange(
  invoices: CustomerInvoice[],
  range: InsightsRange,
  custom?: CustomRange,
): CustomerInvoice[] {
  if (range === 'custom') return invoices.filter((inv) => withinCustom(inv.createdDate, custom));
  const days = RANGE_DAYS[range];
  if (days === null) return invoices;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return invoices.filter((inv) => {
    const d = inv.createdDate ? new Date(inv.createdDate) : null;
    return d ? d >= cutoff : false;
  });
}

// Previous-period filter — shifts back by the same window so we can show
// period-over-period deltas on KPIs that lend themselves to comparison.
export function filterCustomerInvoicesByPreviousRange(
  invoices: CustomerInvoice[],
  range: InsightsRange,
): CustomerInvoice[] {
  const days = RANGE_DAYS[range];
  if (days === null) return [];
  const end = new Date();
  end.setDate(end.getDate() - days);
  const start = new Date(end);
  start.setDate(end.getDate() - days);
  return invoices.filter((inv) => {
    const d = inv.createdDate ? new Date(inv.createdDate) : null;
    return d ? d >= start && d < end : false;
  });
}

// ─── Computation ─────────────────────────────────────────────────────────
//
// Returns the vendor ComputedKpi shape verbatim: the formatted headline
// { value }, an optional muted { sub } line, and an optional { delta }
// prefix. DraggableKpiCard renders both sides identically.

/** Format a percent delta with sign and one decimal. */
function fmtPctDelta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '0%' : '+∞%';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  const abs = Math.abs(pct);
  const formatted = abs >= 100 ? abs.toFixed(0) : abs.toFixed(1);
  return `${sign}${formatted}%`;
}

/**
 * Compute a delta only when a real percentage change can be expressed.
 * Tone follows whether growth is good or bad for the metric (growth in
 * revenue is positive, but a rise in Overdue is negative). Skipped when
 * either side is zero — same rule as the vendor cards.
 */
function buildDelta(
  current: number,
  previous: number,
  growthIsGood: boolean,
): KpiDelta | undefined {
  if (previous === 0 || current === 0) return undefined;
  if (current === previous) return { text: '0%', tone: 'neutral' };
  const isGrowth = current > previous;
  const tone: KpiDelta['tone'] = isGrowth === growthIsGood ? 'positive' : 'negative';
  return { text: fmtPctDelta(current, previous), tone };
}

const fmtMoney = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
    : n >= 1000
      ? `$${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}K`
      : `$${Math.round(n).toLocaleString('en-US')}`;

const fmtCount = (n: number, noun = 'invoices') => `${n} ${noun}`;

/** Sum of positive document amounts — credit memos (negative) excluded. */
const billedTotal = (rows: CustomerInvoice[]) =>
  rows.reduce((s, r) => s + (r.amount > 0 ? r.amount : 0), 0);

/** What actually came in against these invoices: receipts plus deposits applied. */
const collectedTotal = (rows: CustomerInvoice[]) =>
  rows.reduce((s, r) => s + receiptsTotal(r) + depositsAppliedTotal(r), 0);

const netDueTotal = (rows: CustomerInvoice[]) => rows.reduce((s, r) => s + netDue(r), 0);

const daysBetween = (fromIso: string, toIso: string) =>
  Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000));

/** Approval timestamp for an invoice: the approve entry in actionHistory
 *  when one exists, otherwise the row's updatedDate. */
function approvalDateOf(inv: CustomerInvoice): string | undefined {
  const entry = inv.actionHistory?.find((e) => e.action.toLowerCase().includes('approv'));
  return entry?.at ?? inv.updatedDate;
}

export function computeCustomerKpi(
  key: string,
  inRange: CustomerInvoice[],
  previous: CustomerInvoice[] = [],
  // Live-state KPIs (overdue, outstanding, pending, disputes, holds…)
  // must mirror what the listing table shows RIGHT NOW, so they read the
  // full dataset rather than the created-date range slice. Flow KPIs
  // (total invoices, paid in full, averages, top customer) stay
  // period-scoped — same split as the vendor cards.
  all: CustomerInvoice[] = inRange,
  deposits: CustomerDeposit[] = [],
  customers: Customer[] = mockCustomers,
): ComputedKpi {
  switch (key) {
    case 'ready_to_invoice': {
      // Live state — every row waiting in the Ready to Invoice tab.
      const rows = readyToInvoiceRows(customers, all);
      const value = rows.reduce((s, r) => s + r.valueNotBilled, 0);
      return {
        value: rows.length === 0 ? '$0' : fmtMoney(value),
        sub: rows.length === 0 ? 'Nothing waiting' : `${rows.length} waiting to be billed`,
      };
    }
    case 'approved_not_sent': {
      const rows = all.filter((i) => i.invoiceStatus === 'Approved' && !i.sentAt && !i.archived);
      return {
        value: fmtCount(rows.length),
        sub: rows.length === 0 ? undefined : `${fmtMoney(billedTotal(rows))} to send`,
      };
    }
    case 'rejected': {
      const rows = all.filter((i) => i.invoiceStatus === 'Rejected');
      return {
        value: fmtCount(rows.length),
        sub: rows.length === 0 ? undefined : `${fmtMoney(billedTotal(rows))} sent back`,
      };
    }
    // Count as the headline, money smaller below — same recipe as the
    // vendor "Invoices in this period" card.
    case 'total_invoices': {
      const billed = billedTotal(inRange);
      // Falling invoice volume isn't inherently bad, so render this delta
      // as a neutral movement indicator rather than red/green.
      const d = buildDelta(billed, billedTotal(previous), true);
      return {
        value: fmtCount(inRange.length),
        sub: `${fmtMoney(billed)} billed`,
        delta: d ? { ...d, tone: 'neutral' } : undefined,
      };
    }
    case 'pending_approval': {
      // Live state — every invoice currently awaiting approval.
      const rows = all.filter((i) => i.invoiceStatus === 'Pending Approval');
      return {
        value: fmtCount(rows.length),
        sub: rows.length === 0 ? undefined : `${fmtMoney(billedTotal(rows))} awaiting`,
      };
    }
    case 'paid_in_full': {
      const rows = inRange.filter((i) => paymentStatusOf(i) === 'Paid');
      const prev = previous.filter((i) => paymentStatusOf(i) === 'Paid');
      return {
        value: fmtCount(rows.length),
        sub: rows.length === 0 ? undefined : `${fmtMoney(collectedTotal(rows))} collected`,
        delta: buildDelta(collectedTotal(rows), collectedTotal(prev), true),
      };
    }
    case 'overdue': {
      // Live state — every invoice currently past due with a balance open.
      // Money-led per the copy spec: the amount past due is the headline,
      // the invoice count is the sub-line.
      const rows = all.filter((i) => isOverdue(i));
      return {
        value: rows.length === 0 ? '$0' : fmtMoney(netDueTotal(rows)),
        sub:
          rows.length === 0
            ? 'On Time'
            : `${rows.length} invoice${rows.length === 1 ? '' : 's'} past due`,
      };
    }
    case 'awaiting_payment': {
      // Live state — sent invoices with money open, still inside terms.
      const rows = all.filter(
        (i) => i.invoiceStatus === 'Approved' && !!i.sentAt && netDue(i) > 0.004 && !isOverdue(i),
      );
      return {
        value: fmtCount(rows.length),
        sub: rows.length === 0 ? undefined : fmtMoney(netDueTotal(rows)),
      };
    }
    case 'open_disputes': {
      // Live state — disputes currently open with a balance at risk.
      const rows = all.filter((i) => i.disputed && netDue(i) > 0.004);
      return {
        value: String(rows.length),
        sub: rows.length === 0 ? 'No disputes' : `${fmtMoney(netDueTotal(rows))} at risk`,
      };
    }
    case 'credit_hold': {
      // Live state — holds currently in force.
      const rows = all.filter((i) => i.creditHold);
      return {
        value: String(rows.length),
        sub: rows.length === 0 ? undefined : `${fmtMoney(netDueTotal(rows))} held`,
      };
    }
    case 'total_outstanding': {
      // Live state — the balance owed right now across all open invoices
      // (Sent or Approved, not written off or cancelled). Money-led: the
      // open balance is the headline, the invoice count is the sub-line.
      const rows = all.filter(
        (i) =>
          i.invoiceStatus === 'Approved' &&
          !i.writtenOff &&
          netDue(i) > 0.004,
      );
      return {
        value: fmtMoney(netDueTotal(rows)),
        sub: fmtCount(rows.length),
      };
    }
    case 'dso': {
      // Simple, honest DSO for mock data: average days from invoice date
      // to the last receipt on invoices collected in the period.
      const collected = inRange.filter(
        (i) => paymentStatusOf(i) === 'Paid' && i.receipts.length > 0,
      );
      const avgDso = (rows: CustomerInvoice[]) => {
        if (rows.length === 0) return 0;
        const total = rows.reduce((acc, i) => {
          const lastReceipt = i.receipts.reduce(
            (max, r) => (r.date > max ? r.date : max),
            i.receipts[0].date,
          );
          return acc + daysBetween(i.invoiceDate, lastReceipt);
        }, 0);
        return total / rows.length;
      };
      if (collected.length > 0) {
        const cur = avgDso(collected);
        const prevRows = previous.filter(
          (i) => paymentStatusOf(i) === 'Paid' && i.receipts.length > 0,
        );
        const prev = avgDso(prevRows);
        return {
          value: `${Math.round(cur)} days`,
          sub: `${collected.length} collected in period`,
          // DSO going DOWN is good (faster collection cycle).
          delta: prev > 0 ? buildDelta(cur, prev, false) : undefined,
        };
      }
      // Fallback when nothing was collected: terms length plus days
      // overdue, averaged across the dated invoices in range.
      const dated = inRange.filter((i) => i.dueDate);
      if (dated.length === 0) return { value: '0 days', sub: 'No collections in period' };
      const est =
        dated.reduce((acc, i) => acc + daysBetween(i.invoiceDate, i.dueDate!) + daysOverdue(i), 0) /
        dated.length;
      return { value: `${Math.round(est)} days`, sub: 'No collections in period' };
    }
    case 'avg_approval_time': {
      const avgApproval = (rows: CustomerInvoice[]) => {
        const samples = rows
          .filter((i) => i.invoiceStatus === 'Approved')
          .map((i) => {
            const approvedAt = approvalDateOf(i);
            return approvedAt ? daysBetween(i.createdDate, approvedAt) : null;
          })
          .filter((d): d is number => d !== null);
        if (samples.length === 0) return null;
        return samples.reduce((s, d) => s + d, 0) / samples.length;
      };
      const cur = avgApproval(inRange);
      if (cur === null) return { value: '0 days', sub: 'No approvals in period' };
      const prev = avgApproval(previous);
      return {
        value: `${cur.toFixed(1)} days`,
        // Approval time going DOWN is good.
        delta: prev !== null && prev > 0 ? buildDelta(cur, prev, false) : undefined,
      };
    }
    case 'top_customer': {
      const byCustomer = new Map<string, number>();
      for (const inv of inRange) {
        if (inv.amount <= 0) continue;
        byCustomer.set(inv.customer, (byCustomer.get(inv.customer) ?? 0) + inv.amount);
      }
      let top: { name: string; total: number } | null = null;
      byCustomer.forEach((total, name) => {
        if (!top || total > top.total) top = { name, total };
      });
      if (!top) return { value: 'None yet', sub: 'No invoices in this period' };
      const t = top as { name: string; total: number };
      return { value: t.name, sub: `${fmtMoney(t.total)} in the selected period` };
    }
    case 'deposits_held': {
      // Live state — advances currently sitting on the liability account.
      const held = deposits.filter((d) => depositRemaining(d) > 0.004);
      const total = held.reduce((s, d) => s + depositRemaining(d), 0);
      return {
        value: fmtMoney(total),
        sub: fmtCount(held.length, held.length === 1 ? 'deposit' : 'deposits'),
      };
    }
    case 'shipped_not_invoiced': {
      // Live state — unbilled shipped value across the customer book,
      // derived from the invoices (arBilling).
      const perCustomer = customers.map((c) => shippedValueWaiting(c, all).value);
      const total = perCustomer.reduce((s, v) => s + v, 0);
      const withValue = perCustomer.filter((v) => v > 0.004).length;
      return {
        value: fmtMoney(total),
        sub: `${withValue} customer${withValue === 1 ? '' : 's'} with unbilled shipments`,
      };
    }
    default:
      return { value: '0', sub: '' };
  }
}

// Headline-only helper — mirrors computeInvoiceKpiValue so the panel's
// preview tiles and any lightweight call sites share the same math.
export function computeCustomerKpiValue(
  key: string,
  invoices: CustomerInvoice[],
  deposits: CustomerDeposit[] = [],
  customers: Customer[] = mockCustomers,
): string {
  return computeCustomerKpi(key, invoices, [], invoices, deposits, customers).value;
}

/** Customer KPI icon set (10/30): one icon per meaning, shared by the
 *  invoice listing and the Ready to Invoice tab. */
const CUSTOMER_KPI_ICONS: Record<string, LucideIcon> = {
  FilePlus2,
  Files,
  Hourglass,
  FileCheck2,
  FileX2,
  HandCoins,
  CircleCheckBig,
  CalendarX2,
  MessageSquareWarning,
  ShieldAlert,
  CircleDollarSign,
  CalendarClock,
  Timer,
  Trophy,
  PiggyBank,
  Truck,
  Coins,
  Milestone,
  AlarmClock,
  ArrowUpNarrowWide,
  Users,
  SquareCheck,
};

export function CustomerKpiIcon({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  const Icon = CUSTOMER_KPI_ICONS[name] ?? ChartColumn;
  return <Icon className={className} style={style} />;
}

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case 'Pipeline & Volume':
      return <Receipt className="w-4 h-4 text-muted-foreground" />;
    case 'Exceptions & Risk':
      return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    case 'Cash & Performance':
      return <DollarSign className="w-4 h-4 text-muted-foreground" />;
    default:
      return <ChartColumn className="w-4 h-4 text-muted-foreground" />;
  }
}

interface CustomerInvoiceInsightsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  invoices: CustomerInvoice[];
  deposits: CustomerDeposit[];
  /** Live customer book, for the Ready to Invoice / shipped-not-invoiced math. */
  customers?: Customer[];
}

export function CustomerInvoiceInsightsPanel({
  open,
  onOpenChange,
  activeKpis,
  onToggleKpi,
  invoices,
  deposits,
  customers = mockCustomers,
}: CustomerInvoiceInsightsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    const cats: { name: string; kpis: CustomerKpiDefinition[] }[] = [];
    const catMap = new Map<string, CustomerKpiDefinition[]>();

    for (const kpi of ALL_CUSTOMER_KPI_DEFINITIONS) {
      const matchesSearch =
        !searchQuery ||
        kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kpi.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (matchesSearch) {
        if (!catMap.has(kpi.category)) catMap.set(kpi.category, []);
        catMap.get(kpi.category)!.push(kpi);
      }
    }
    catMap.forEach((kpis, name) => cats.push({ name, kpis }));
    return cats;
  }, [searchQuery]);

  const activeCount = activeKpis.length;

  // Smooth mount/unmount transitions
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      timeoutRef.current = setTimeout(() => setMounted(false), 280);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [open]);

  if (!mounted) return null;

  const allActive = ALL_CUSTOMER_KPI_DEFINITIONS.every((k) => activeKpis.includes(k.key));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{
          backgroundColor: visible ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0)',
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-0 bg-white shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'hsl(var(--accent))' }}
              >
                <Sliders className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 500 }}>
                  Customize Insights
                </h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Manage your dashboard KPI widgets.
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-4 px-1">
            <span
              className="text-[12px] text-muted-foreground"
              style={{ fontWeight: 500 }}
            >
              {activeCount} of {ALL_CUSTOMER_KPI_DEFINITIONS.length} widgets active
            </span>
            <button
              onClick={() => {
                const allKeys = ALL_CUSTOMER_KPI_DEFINITIONS.map((k) => k.key);
                if (allActive) {
                  activeKpis.forEach((k) => onToggleKpi(k));
                } else {
                  allKeys.filter((k) => !activeKpis.includes(k)).forEach((k) => onToggleKpi(k));
                }
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                allActive
                  ? 'bg-blue-50 border-primary/25 text-primary hover:bg-blue-100 hover:border-primary/40 shadow-sm shadow-primary/10'
                  : activeKpis.length === 0
                    ? 'bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500'
                    : 'bg-slate-50 border-border text-slate-500 hover:bg-blue-50 hover:border-primary/25 hover:text-primary'
              }`}
              style={{ fontWeight: 500 }}
            >
              {allActive ? (
                <>
                  <ToggleRight className="w-4 h-4 text-primary" />
                  <span>All On</span>
                </>
              ) : activeKpis.length === 0 ? (
                <>
                  <ToggleLeft className="w-4 h-4" />
                  <span>All Off</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4" />
                  <span>Enable All</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-3.5 pb-3 bg-white border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input
              placeholder="Search metrics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
            />
          </div>
        </div>


        <div className="flex-1 overflow-y-auto px-4 pb-4 bg-slate-50 scrollbar-hide">
          {categories.length === 0 && (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground/60">No metrics found</p>
            </div>
          )}

          {categories.map((cat) => (
            <div key={cat.name} className="mt-5 first:mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <CategoryIcon category={cat.name} />
                <span
                  className="text-[12px] text-muted-foreground/70 tracking-wide"
                  style={{ fontWeight: 500 }}
                >
                  {/* Widget search highlights its matches like every list (10/9/26). */}
                  {highlightText(cat.name, searchQuery)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {cat.kpis.map((kpi) => {
                  const isActive = activeKpis.includes(kpi.key);
                  const value = computeCustomerKpiValue(kpi.key, invoices, deposits, customers);
                  return (
                    <button
                      key={kpi.key}
                      onClick={() => onToggleKpi(kpi.key)}
                      className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                        isActive
                          ? 'border-primary/25 bg-white shadow-[0_0_0_1px_rgba(10,119,255,0.08)]'
                          : 'border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[11px] truncate transition-colors ${
                            isActive ? 'text-primary' : 'text-muted-foreground/70'
                          }`}
                          style={{ fontWeight: 500 }}
                          title={kpi.label}
                        >
                          {highlightText(kpi.label, searchQuery)}
                        </span>
                        <div className="shrink-0">
                          {isActive ? (
                            <Check className="w-3.5 h-3.5" style={{ color: 'hsl(var(--primary))' }} />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />
                          )}
                        </div>
                      </div>
                      <p
                        className={`text-[15px] mt-1 transition-colors ${
                          isActive ? 'text-foreground' : 'text-foreground/80'
                        }`}
                        style={{ fontWeight: 500 }}
                      >
                        {value}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
