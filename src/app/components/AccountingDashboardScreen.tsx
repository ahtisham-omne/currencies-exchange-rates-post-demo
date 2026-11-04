import { useEffect, useMemo, useRef, useState } from 'react';
import { formatUsDate } from '@/app/lib/dueBucket';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Banknote,
  CalendarDays,
  ChartColumn,
  Check,
  Clock,
  DollarSign,
  FileText,
  Info,
  Landmark,
  LayoutDashboard,
  PieChart as PieChartIcon,
  Plus,
  EyeOff,
  Receipt,
  Search,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { DraggableKpiCard } from '@/app/components/DraggableKpiCard';
import { InsightsResetButton } from '@/app/components/InsightsResetButton';
import { InsightsRefresh } from '@/app/components/InsightsRefresh';
import { InsightsRangeMenu } from '@/app/components/InsightsRangeMenu';
import type { InsightsRange } from '@/app/components/PaymentInsightsPanel';
import type { AppView } from '@/app/components/Layout';
import type { Invoice } from '@/app/data/mockInvoices';
import type { Payment } from '@/app/data/mockPayments';
import { palette } from '@/styles/tokens';
import { highlightText } from '@/app/components/InvoiceDataTable';

/* ── Accounting & Finance Dashboard ───────────────────────────────────
 *
 * Port of the partner details page Dashboard tab (VendorDetailsPage in
 * the partner-management module): the same configurable board — a
 * draggable KPI strip, a drag-to-reorder widget grid with per-widget
 * sm/md/lg sizing, a Customize Insights drawer, and a sticky right rail
 * of collapsible summary cards — with the data swapped to vendor
 * invoicing + payments so it reads as one overview of the whole
 * Accounting & Finance module.
 */

// ── Formatting + date helpers ──
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const moneyExact = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function daysPastDue(dueDate: string): number {
  const due = new Date(dueDate + 'T00:00:00').getTime();
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.floor((midnight - due) / 86_400_000);
}

const OPEN_TERMINAL = ['Cancelled', 'Rejected', 'Archived'];
/* HARD REQUIREMENT (9/4/26 Eli, L-05 / Option A): a pre-invoice posts
 * NOTHING to the GL, so no ledger account will ever surface it — open
 * pre-invoices MUST appear in the AP aging report, the payables/cash
 * forecast (this file) and the payment run pool (runMath.eligibleInvoices).
 * This predicate is deliberately type-blind: any non-terminal document
 * with an outstanding balance counts, Pre-Invoice included. Do not add a
 * type filter here. */
const isOpenInvoice = (inv: Invoice) =>
  (inv.outstandingBalance ?? 0) > 0.004 && !OPEN_TERMINAL.includes(inv.status);

// Range filter — mirrors the Performance Insights strips so "Last 30
// days" means the same thing everywhere in the app.
function rangeStart(range: InsightsRange): Date | null {
  const now = new Date();
  const days: Partial<Record<InsightsRange, number>> = { last_7: 7, last_30: 30, last_90: 90, last_365: 365 };
  const n = days[range];
  if (!n) return null;
  const d = new Date(now);
  d.setDate(now.getDate() - n);
  return d;
}
function inRange(dateStr: string, range: InsightsRange, custom?: { from: string; to: string }): boolean {
  if (range === 'all_time') return true;
  const d = new Date(dateStr + 'T00:00:00');
  if (range === 'custom') {
    if (custom?.from && d < new Date(custom.from + 'T00:00:00')) return false;
    if (custom?.to && d > new Date(custom.to + 'T23:59:59')) return false;
    return true;
  }
  const start = rangeStart(range);
  return !start || d >= start;
}

// ── Chart palette (concrete hexes; recharts SVG attrs) ──
const C_BLUE = palette.blue[500];
const C_EMERALD = '#059669';
const C_AMBER = '#F59E0B';
const C_RED = '#EF4444';
const C_VIOLET = '#7C3AED';
const C_SLATE = '#94A3B8';
const PIE_COLORS = [C_BLUE, C_VIOLET, C_EMERALD, C_SLATE];
// Invoice types keep their system identity whatever their rank (user
// 10/10): Inventory blue, Pre-Invoice violet, Standalone teal.
const TYPE_SLICE_COLORS: Record<string, string> = { Inventory: C_BLUE, 'Pre-Invoice': C_VIOLET, Standalone: '#0D9488' };
const ttStyle = { borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 };

// ── KPI catalog (partner DASH_KPI_DEFS recipe, accounting data) ──
interface DashKpiDef {
  key: string;
  label: string;
  category: 'Cash' | 'Invoicing' | 'Payments';
  iconName: string;
  subtitle: string;
  tooltip?: string;
}

// Module-wide money KPIs (design feedback): the strip reads the whole
// Accounting & Finance position — cash on hand and obligations first,
// not invoice counts. Cash figures stream from Cash Management.
const DASH_KPI_DEFS: DashKpiDef[] = [
  // Cash
  { key: 'cash_on_hand', label: 'Cash on Hand', category: 'Cash', iconName: 'Landmark', subtitle: 'Across bank accounts', tooltip: 'Combined balance of every connected bank account, synced from Cash Management.' },
  { key: 'cash_outflow', label: 'Cash Outflow', category: 'Cash', iconName: 'Banknote', subtitle: 'Paid out to vendors', tooltip: 'All cash that has left the bank for vendors: settled payments plus prepayments.' },
  { key: 'net_cash_flow', label: 'Net Cash Flow', category: 'Cash', iconName: 'TrendingUp', subtitle: 'In minus out, this period', tooltip: 'Cash in minus cash out for the selected period. Inflow streams from Cash Management.' },
  { key: 'receivables_due', label: 'Receivables Due', category: 'Cash', iconName: 'Wallet', subtitle: 'A/R expected in 30 days', tooltip: 'Outstanding receivables expected over the next 30 days, from Cash Management.' },
  { key: 'payroll_due', label: 'Next Payroll', category: 'Cash', iconName: 'Calendar', subtitle: 'Net payroll due', tooltip: 'Net amount of the next payroll run and when it goes out, from Cash Management.' },
  // Invoicing
  { key: 'outstanding_payables', label: 'Outstanding Payables', category: 'Invoicing', iconName: 'CircleDollarSign', subtitle: 'Owed across open invoices', tooltip: 'Total unpaid balance across every open vendor invoice, regardless of the date range.' },
  { key: 'overdue_balance', label: 'Overdue Balance', category: 'Invoicing', iconName: 'AlertTriangle', subtitle: 'Past due and unpaid', tooltip: 'Open balance on invoices whose due date has passed. Counted from current state, not the date range.' },
  { key: 'due_today', label: 'Due Today', category: 'Invoicing', iconName: 'Calendar', subtitle: 'Falls due today', tooltip: 'Balance on open invoices that fall due today. Pay these before the day ends.' },
  { key: 'invoiced_period', label: 'Invoiced', category: 'Invoicing', iconName: 'CreditCard', subtitle: 'Booked this period' },
  { key: 'blocked_balance', label: 'Blocked', category: 'Invoicing', iconName: 'Ban', subtitle: 'In exception or on hold', tooltip: 'Open balance stuck in Exception or Payment Hold, needing a decision before it can pay.' },
  // Payments
  { key: 'paid_period', label: 'Total Paid', category: 'Payments', iconName: 'Banknote', subtitle: 'This period', tooltip: 'Sum of successful payments in the selected period, net of reversals.' },
  { key: 'scheduled', label: 'Scheduled', category: 'Payments', iconName: 'Clock', subtitle: 'Queued to send' },
  { key: 'prepay_unapplied', label: 'Prepayments on Account', category: 'Payments', iconName: 'Wallet', subtitle: 'Ready to assign', tooltip: 'Money already advanced to vendors that is not assigned to an invoice yet.' },
  { key: 'top_vendor', label: 'Top Vendor by Spend', category: 'Payments', iconName: 'Star', subtitle: 'Highest-paid vendor' },
];

const DEFAULT_DASH_KPIS = [
  'cash_on_hand', 'cash_outflow', 'outstanding_payables', 'overdue_balance',
  'due_today', 'prepay_unapplied', 'paid_period', 'receivables_due',
];

const isSettledPayment = (p: Payment) =>
  p.status === 'Paid' || p.status === 'Unapplied' || p.status === 'Partially Applied' || p.status === 'Fully Applied';

function computeDashKpi(
  key: string,
  invAll: Invoice[],
  invRange: Invoice[],
  payAll: Payment[],
  payRange: Payment[],
): { value: string; sub?: string } {
  const open = invAll.filter(isOpenInvoice);
  switch (key) {
    // ── Cash ──
    case 'cash_on_hand':
      return {
        value: money(CASH_ACCOUNTS.reduce((s, a) => s + a.balance, 0)),
        sub: `${CASH_ACCOUNTS.length} bank accounts`,
      };
    case 'cash_outflow': {
      const rows = payAll.filter(isSettledPayment);
      return { value: money(rows.reduce((s, p) => s + p.amount, 0)), sub: `${rows.length} payments out` };
    }
    case 'net_cash_flow': {
      const out = payRange.filter(isSettledPayment).reduce((s, p) => s + p.amount, 0);
      // Inflow mirrors the Cash Management receivables stream (mocked
      // as a share of the invoiced value in the same period).
      const cashIn = Math.round(invRange.reduce((s, i) => s + i.amount, 0) * 1.05);
      const net = cashIn - out;
      return { value: `${net < 0 ? '-' : ''}${money(Math.abs(net))}`, sub: `${money(cashIn)} in · ${money(out)} out` };
    }
    case 'receivables_due':
      return { value: money(RECEIVABLES_DUE.total), sub: `${money(RECEIVABLES_DUE.nextFiveDays)} in the next 5 days` };
    case 'payroll_due':
      return { value: money(PAYROLL_DUE.net), sub: `runs ${nextPayrollRunLabel()} · ${PAYROLL_DUE.employees} employees` };

    // ── Invoicing ──
    case 'outstanding_payables':
      return { value: money(open.reduce((s, i) => s + i.outstandingBalance, 0)), sub: `${open.length} open invoices` };
    case 'overdue_balance': {
      const rows = open.filter((i) => daysPastDue(i.dueDate) > 0);
      return { value: money(rows.reduce((s, i) => s + i.outstandingBalance, 0)), sub: `${rows.length} invoices past due` };
    }
    case 'due_today': {
      const rows = open.filter((i) => daysPastDue(i.dueDate) === 0);
      return {
        value: money(rows.reduce((s, i) => s + i.outstandingBalance, 0)),
        sub: rows.length ? `${rows.length} invoice${rows.length === 1 ? '' : 's'} due today` : 'Nothing due today',
      };
    }
    case 'invoiced_period':
      return { value: money(invRange.reduce((s, i) => s + i.amount, 0)), sub: `${invRange.length} invoices booked` };
    case 'blocked_balance': {
      const exceptions = invAll.filter((i) => i.status === 'Exception');
      // Hold is a flag (ERP-8796): an invoice both in Exception and on
      // hold counts under each, but its balance only once.
      const holds = invAll.filter((i) => i.is_payment_held);
      const total = invAll.filter((i) => i.status === 'Exception' || i.is_payment_held).reduce((s, i) => s + i.outstandingBalance, 0);
      return { value: money(total), sub: `${exceptions.length} exceptions · ${holds.length} on hold` };
    }

    // ── Payments ──
    case 'paid_period': {
      const rows = payRange.filter((p) => p.type === 'Payment' && p.status === 'Paid');
      return { value: money(rows.reduce((s, p) => s + p.amount, 0)), sub: `${rows.length} payments` };
    }
    case 'scheduled': {
      const rows = payRange.filter((p) => p.status === 'Scheduled');
      return { value: money(rows.reduce((s, p) => s + p.amount, 0)), sub: rows.length ? `${rows.length} queued` : 'None scheduled' };
    }
    case 'prepay_unapplied': {
      const rows = payAll.filter((p) => p.type === 'Prepayment' && (p.status === 'Unapplied' || p.status === 'Partially Applied'));
      const total = rows.reduce((s, p) => s + (p.unappliedAmount ?? 0), 0);
      return { value: money(total), sub: rows.length ? `${rows.length} advances open` : 'Nothing to assign' };
    }
    case 'top_vendor': {
      const byVendor = new Map<string, number>();
      payRange.filter((p) => p.status === 'Paid').forEach((p) => byVendor.set(p.vendor, (byVendor.get(p.vendor) ?? 0) + p.amount));
      let top: { name: string; total: number } | null = null;
      byVendor.forEach((total, name) => { if (!top || total > top.total) top = { name, total }; });
      if (!top) return { value: 'No vendor yet', sub: 'No payments in period' };
      const t = top as { name: string; total: number };
      return { value: t.name, sub: money(t.total) };
    }
    default:
      return { value: '–' };
  }
}

// ── Widget catalog (partner PARTNER_WIDGET_DEFS recipe) ──
type WidgetVisualType = 'chart' | 'list' | 'donut' | 'bars' | 'line';
type WSize = 'sm' | 'md' | 'lg';
interface DashWidgetDef {
  key: string;
  label: string;
  type: WidgetVisualType;
  description: string;
  category: 'Performance' | 'Financial' | 'Cash' | 'Operational';
}

const DASH_WIDGET_DEFS: DashWidgetDef[] = [
  { key: 'invoice_spend_trend', label: 'Invoice Cost Trend', type: 'line', description: 'Value of vendor invoices booked, by month.', category: 'Performance' },
  { key: 'payments_out_trend', label: 'Payments Out Trend', type: 'line', description: 'Cash paid to vendors, by month.', category: 'Performance' },
  { key: 'invoice_activity', label: 'Invoice Activity', type: 'chart', description: 'Invoices booked per month, with the ones flagged or held.', category: 'Performance' },
  { key: 'payment_activity', label: 'Payment Activity', type: 'chart', description: 'Payments recorded per month, with reversals and cancellations.', category: 'Performance' },
  { key: 'invoice_aging', label: 'Invoice Aging', type: 'bars', description: 'Outstanding balance grouped by how long it has been due.', category: 'Financial' },
  { key: 'spend_by_type', label: 'Spend by Invoice Type', type: 'donut', description: 'Invoiced value split across Inventory, Pre-Invoice and Standalone.', category: 'Financial' },
  { key: 'payment_methods', label: 'Payments by Method', type: 'donut', description: 'Paid value split across payment methods.', category: 'Financial' },
  { key: 'cash_out_history', label: 'Cash Out History', type: 'line', description: 'Payments vs prepayments leaving the bank, by month.', category: 'Financial' },
  // Cash — same boards the Cash Management dashboard shows; cash is
  // part of Accounting & Finance so its widgets belong here too.
  { key: 'cash_position', label: 'Cash Position', type: 'line', description: 'Balance of every bank account over the last 12 weeks.', category: 'Cash' },
  { key: 'cash_flow', label: 'Cash Flow', type: 'chart', description: 'Cash coming in vs cash going out, by month.', category: 'Cash' },
  { key: 'top_spend_distribution', label: 'Top Spend Distribution', type: 'donut', description: 'Where the cash out went, split by spend category.', category: 'Cash' },
  { key: 'top_vendors_outflow', label: 'Top Vendors by Outflow', type: 'bars', description: 'The five vendors receiving the most cash.', category: 'Cash' },
  { key: 'payables_due', label: 'Payables Due', type: 'chart', description: 'Bills falling due over the next seven days.', category: 'Cash' },
  { key: 'receivables_due', label: 'Receivables Due', type: 'list', description: 'Outstanding A/R expected over the next 30 days.', category: 'Cash' },
  { key: 'payroll_due', label: 'Payroll Due', type: 'list', description: 'The next payroll run: net due, run date, and funding account.', category: 'Cash' },
  { key: 'accounts_snapshot', label: 'Accounts Snapshot', type: 'list', description: 'Connected bank accounts and their current balances.', category: 'Cash' },
  { key: 'top_vendors', label: 'Top Vendors by Spend', type: 'bars', description: 'The five vendors with the highest invoiced value.', category: 'Operational' },
  { key: 'oldest_outstanding', label: 'Oldest Outstanding', type: 'list', description: 'The five unpaid invoices that have waited longest.', category: 'Operational' },
  { key: 'recent_invoices', label: 'Recent Invoices', type: 'list', description: 'Five most recent vendor invoices by status and amount.', category: 'Operational' },
  { key: 'recent_payments', label: 'Recent Payments', type: 'list', description: 'Five most recent vendor payments by status and amount.', category: 'Operational' },
];
const WIDGET_CATEGORY_ORDER: DashWidgetDef['category'][] = ['Performance', 'Financial', 'Cash', 'Operational'];
const DEFAULT_DASH_WIDGETS = [
  'invoice_spend_trend', 'payments_out_trend', 'cash_position', 'cash_flow',
  'invoice_activity', 'payment_activity', 'invoice_aging', 'spend_by_type',
  'payables_due', 'top_vendors', 'oldest_outstanding',
];

// Chart heights per size (partner CH constant).
const CH: Record<WSize, number> = { sm: 140, md: 200, lg: 280 };

const DND_DASH_WIDGET = 'ACCT_DASH_WIDGET';

// ── Persistence ──
// v2: KPI catalog reworked to module-wide money KPIs — bumped so
// returning browsers pick up the new default strip.
const LS_KPIS = 'omnesoft:acct-dash:kpis-v2';
// v2: the Cash widget family joined the defaults — bumped so returning
// browsers pick up the new default board.
const LS_WIDGETS = 'omnesoft:acct-dash:widgets-v2';
const LS_SIZES = 'omnesoft:acct-dash:sizes';
function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}
function saveLS(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ── Shared render helpers (partner chartBox / statRow) ──
const chartBox = (h: number, chart: React.ReactElement) => (
  <div style={{ height: h }} className="-ml-2">
    <ResponsiveContainer width="100%" height="100%">
      {chart}
    </ResponsiveContainer>
  </div>
);

const statRow = (stats: { label: string; value: string; color?: string }[], compact?: boolean, trailing?: React.ReactNode) => (
  <div className={`flex items-end justify-between gap-4 ${compact ? 'mt-1.5 pt-1.5' : 'mt-2 pt-2'} border-t border-muted`}>
    <div className={`flex items-center ${compact ? 'gap-3' : 'gap-4'} flex-wrap min-w-0`}>
      {stats.map((s, i) => (
        <div key={i}>
          <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-slate-400`} style={{ fontWeight: 500 }}>{s.label}</p>
          <p className={compact ? 'text-[11px]' : 'text-[13px]'} style={{ fontWeight: 700, color: s.color || '#334155' }}>{s.value}</p>
        </div>
      ))}
    </div>
    {trailing && <div className="shrink-0 pb-px">{trailing}</div>}
  </div>
);

const legendDots = (items: { label: string; color: string }[]) => (
  <div className="flex items-center gap-3">
    {items.map((it) => (
      <div key={it.label} className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: it.color }} />
        <span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>{it.label}</span>
      </div>
    ))}
  </div>
);

// Status pill tones for the list widgets.
const LIST_STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  'Pending Approval': { bg: '#EEF2FF', fg: '#4338CA' },
  Approved: { bg: '#ECFDF5', fg: '#047857' },
  'Partially Paid': { bg: '#F1F5F9', fg: '#475569' },
  'Paid in Full': { bg: '#ECFDF5', fg: '#065F46' },
  Exception: { bg: '#FFF7ED', fg: '#C2410C' },
  'Payment Hold': { bg: '#FEFCE8', fg: '#A16207' },
  Rejected: { bg: '#FEF2F2', fg: '#B91C1C' },
  Cancelled: { bg: '#FEF2F2', fg: '#B91C1C' },
  Draft: { bg: '#F1F5F9', fg: '#475569' },
  Scheduled: { bg: '#EBF3FF', fg: '#0654BC' },
  Paid: { bg: '#ECFDF5', fg: '#047857' },
  Reversed: { bg: '#FEF2F2', fg: '#B91C1C' },
  Unapplied: { bg: '#FFFBEB', fg: '#B45309' },
  'Partially Applied': { bg: '#FFFBEB', fg: '#B45309' },
  'Fully Applied': { bg: '#ECFDF5', fg: '#047857' },
};

function listRows(
  rows: { id: string; primary: string; secondary: string; status: string; amount: number; badge?: string }[],
  emptyText: string,
) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Receipt className="w-6 h-6 text-slate-200 mb-2" />
        <p className="text-[12px] text-slate-400" style={{ fontWeight: 500 }}>{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((r) => {
        const tone = LIST_STATUS_TONE[r.status] ?? { bg: '#F1F5F9', fg: '#475569' };
        return (
          <div key={r.id} className="flex items-center gap-2.5 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{r.primary}</span>
                {r.badge && (
                  <span className="inline-flex px-1.5 py-px rounded-full text-[10px] bg-red-50 text-red-700 border border-red-100 shrink-0" style={{ fontWeight: 600 }}>{r.badge}</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5" style={{ fontWeight: 500 }}>{r.secondary}</p>
            </div>
            {/* Advance tri-state display name (BA 9/28): the stored
                'Fully Applied' reads 'Applied' everywhere. */}
            <span className="inline-flex px-2 py-px rounded-full text-[10px] shrink-0" style={{ fontWeight: 600, backgroundColor: tone.bg, color: tone.fg }}>{r.status === 'Fully Applied' ? 'Applied' : r.status}</span>
            <span className="text-[12px] text-foreground shrink-0" style={{ fontWeight: 600 }}>{money(r.amount)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Cash Management mock data — mirrors the accounts and figures the
// Cash Management dashboard shows, so the two boards tell one story. ──
const CASH_ACCOUNTS = [
  { name: 'US Bank High-Yield Savings', short: 'US Bank Savings', mask: '••7331', balance: 100392.5, color: C_EMERALD, base: 100000 },
  { name: 'Wells Fargo Receivables', short: 'Wells Fargo Recv.', mask: '••1467', balance: 82145.22, color: C_AMBER, base: 82000 },
  { name: 'Mercury Reserve', short: 'Mercury Reserve', mask: '••5144', balance: 79215.4, color: C_VIOLET, base: 78000 },
  { name: 'Chase Operating Account', short: 'Chase Operating', mask: '••4521', balance: 47823.41, color: C_BLUE, base: 52000 },
];
// Deterministic 12-week balance series per account (no randomness so
// the board renders the same on every load, like the seeded mocks).
const CASH_POSITION_SERIES = Array.from({ length: 12 }, (_, i) => {
  const point: Record<string, number | string> = { week: `W${i + 1}` };
  CASH_ACCOUNTS.forEach((acc, idx) => {
    const wobble = Math.sin(i * 1.15 + idx * 2.1) * acc.base * 0.09;
    const drift = (i - 6) * acc.base * 0.008 * (idx % 2 === 0 ? 1 : -1);
    point[acc.short] = Math.round(acc.base + wobble + drift);
  });
  return point;
});
const SPEND_CATEGORIES = [
  { name: 'Uncategorized', pct: 40 },
  { name: 'Payroll Expense', pct: 22 },
  { name: 'Rent & Office', pct: 15 },
  { name: 'Software & Subscriptions', pct: 13 },
  { name: 'Telecommunications', pct: 10 },
];
const RECEIVABLES_DUE = {
  total: 110850,
  nextFiveDays: 46820,
  buckets: [
    { label: 'Next 5 Days', note: '3 invoices · 42% of total', amount: 46820, pct: 42 },
    { label: 'Next 15 Days', note: '3 invoices · 27% of total', amount: 29930, pct: 27 },
    { label: 'Next 30 Days', note: '4 invoices · 31% of total', amount: 34100, pct: 31 },
  ],
};
const PAYROLL_DUE = {
  net: 142680,
  gross: 164320,
  deductions: 41640,
  fundingAccount: 'Bank of America Payroll',
  fundingMask: '••••8842',
  employees: 28,
  avgPerEmployee: 5096,
  cycle: 'Bi-weekly',
};
function nextPayrollRunLabel(): string {
  // Next Tuesday from today, matching the cash-management card.
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() + ((9 - now.getDay()) % 7 || 7));
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
const compactMoney = (n: number) => (n >= 1000 ? `$${(n / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K` : `$${Math.round(n).toLocaleString('en-US')}`);

// ── Precomputed board data ──
interface BoardData {
  monthly: { label: string; invoiced: number; paidOut: number; invCount: number; invBlocked: number; payCount: number; payReversed: number; payments: number; prepayments: number }[];
  aging: { bucket: string; amount: number; color: string }[];
  byType: { name: string; value: number; pct: number }[];
  byMethod: { name: string; value: number; pct: number }[];
  topVendors: { name: string; value: number }[];
  topVendorsOutflow: { name: string; value: number }[];
  payablesWeek: { day: string; date: string; amount: number; isToday: boolean }[];
  oldest: Invoice[];
  recentInvoices: Invoice[];
  recentPayments: Payment[];
  outstandingTotal: number;
  overdueTotal: number;
  dueTodayTotal: number;
  laterTotal: number;
  totalPaidAll: number;
  prepayOnAccount: number;
}

function buildBoardData(invoices: Invoice[], payments: Payment[]): BoardData {
  const now = new Date();
  const monthly: BoardData['monthly'] = [];
  const byKey = new Map<string, BoardData['monthly'][number]>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const entry = {
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      invoiced: 0, paidOut: 0, invCount: 0, invBlocked: 0, payCount: 0, payReversed: 0, payments: 0, prepayments: 0,
    };
    monthly.push(entry);
    byKey.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, entry);
  }
  for (const inv of invoices) {
    const b = byKey.get((inv.invoiceDate || inv.date || '').slice(0, 7));
    if (!b) continue;
    b.invoiced += inv.amount;
    b.invCount += 1;
    if (inv.status === 'Exception' || inv.is_payment_held) b.invBlocked += 1;
  }
  for (const p of payments) {
    const b = byKey.get((p.paymentDate || '').slice(0, 7));
    if (!b) continue;
    b.payCount += 1;
    if (p.status === 'Reversed' || p.status === 'Cancelled') b.payReversed += 1;
    const settled = p.status === 'Paid' || p.status === 'Unapplied' || p.status === 'Partially Applied' || p.status === 'Fully Applied';
    if (settled) {
      b.paidOut += p.amount;
      if (p.type === 'Prepayment') b.prepayments += p.amount;
      else b.payments += p.amount;
    }
  }

  const open = invoices.filter(isOpenInvoice);
  const bucketDefs = [
    { bucket: 'Current', color: C_EMERALD, test: (d: number) => d <= 0 },
    { bucket: '1-30', color: C_BLUE, test: (d: number) => d >= 1 && d <= 30 },
    { bucket: '31-60', color: C_AMBER, test: (d: number) => d >= 31 && d <= 60 },
    { bucket: '61-90', color: '#F97316', test: (d: number) => d >= 61 && d <= 90 },
    { bucket: '90+', color: C_RED, test: (d: number) => d > 90 },
  ];
  const aging = bucketDefs.map(({ bucket, color, test }) => ({
    bucket,
    color,
    amount: open.filter((i) => test(daysPastDue(i.dueDate))).reduce((s, i) => s + i.outstandingBalance, 0),
  }));

  const typeLabel: Record<string, string> = { 'PO-based': 'Inventory', 'Receiving-based': 'Inventory', 'GRN-based': 'Inventory', 'Pre-Invoice': 'Pre-Invoice', Standalone: 'Standalone' };
  const typeTotals = new Map<string, number>();
  invoices.forEach((i) => {
    const label = typeLabel[i.type] ?? i.type;
    typeTotals.set(label, (typeTotals.get(label) ?? 0) + i.amount);
  });
  const typeGrand = [...typeTotals.values()].reduce((s, v) => s + v, 0);
  const byType = [...typeTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, pct: typeGrand ? Math.round((value / typeGrand) * 100) : 0 }));

  const methodTotals = new Map<string, number>();
  payments.filter((p) => p.status === 'Paid' || p.status === 'Unapplied' || p.status === 'Partially Applied' || p.status === 'Fully Applied')
    .forEach((p) => methodTotals.set(p.paymentMethod, (methodTotals.get(p.paymentMethod) ?? 0) + p.amount));
  const methodGrand = [...methodTotals.values()].reduce((s, v) => s + v, 0);
  const byMethod = [...methodTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, value]) => ({ name, value, pct: methodGrand ? Math.round((value / methodGrand) * 100) : 0 }));

  const vendorTotals = new Map<string, number>();
  invoices.forEach((i) => vendorTotals.set(i.vendor, (vendorTotals.get(i.vendor) ?? 0) + i.amount));
  const topVendors = [...vendorTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  // Cash actually sent per vendor — the outflow ranking the Cash
  // Management dashboard shows, computed from settled payments.
  const outflowTotals = new Map<string, number>();
  payments
    .filter((p) => p.status === 'Paid' || p.status === 'Unapplied' || p.status === 'Partially Applied' || p.status === 'Fully Applied')
    .forEach((p) => outflowTotals.set(p.vendor, (outflowTotals.get(p.vendor) ?? 0) + p.amount));
  const topVendorsOutflow = [...outflowTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  // Bills falling due each of the next 7 days (today first).
  const payablesWeek: BoardData['payablesWeek'] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      day: d.toLocaleDateString(undefined, { weekday: 'short' }),
      date: String(d.getDate()),
      amount: open.filter((inv) => inv.dueDate === iso).reduce((s, inv) => s + inv.outstandingBalance, 0),
      isToday: i === 0,
    };
  });

  const oldest = open
    .filter((i) => daysPastDue(i.dueDate) > 0)
    .sort((a, b) => daysPastDue(b.dueDate) - daysPastDue(a.dueDate))
    .slice(0, 5);
  const recentInvoices = [...invoices]
    .sort((a, b) => (b.invoiceDate || b.date).localeCompare(a.invoiceDate || a.date))
    .slice(0, 5);
  const recentPayments = [...payments]
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
    .slice(0, 5);

  const overdueTotal = open.filter((i) => daysPastDue(i.dueDate) > 0).reduce((s, i) => s + i.outstandingBalance, 0);
  const dueTodayTotal = open.filter((i) => daysPastDue(i.dueDate) === 0).reduce((s, i) => s + i.outstandingBalance, 0);
  const outstandingTotal = open.reduce((s, i) => s + i.outstandingBalance, 0);

  return {
    monthly, aging, byType, byMethod, topVendors, topVendorsOutflow, payablesWeek, oldest, recentInvoices, recentPayments,
    outstandingTotal, overdueTotal, dueTodayTotal,
    laterTotal: Math.max(0, outstandingTotal - overdueTotal - dueTodayTotal),
    totalPaidAll: payments.filter((p) => p.type === 'Payment' && p.status === 'Paid').reduce((s, p) => s + p.amount, 0),
    prepayOnAccount: payments.filter((p) => p.type === 'Prepayment' && (p.status === 'Unapplied' || p.status === 'Partially Applied')).reduce((s, p) => s + (p.unappliedAmount ?? 0), 0),
  };
}

// ── Widget content renderers (partner chart recipes, accounting data) ──
function renderWidgetContent(wKey: string, sz: WSize, data: BoardData): { icon: React.ElementType; title: string; tip: string; content: React.ReactNode } {
  if (wKey === 'invoice_spend_trend' || wKey === 'payments_out_trend') {
    const isPay = wKey === 'payments_out_trend';
    const stroke = isPay ? C_EMERALD : C_BLUE;
    const gradId = isPay ? 'acctPayTrendGrad' : 'acctInvTrendGrad';
    const series = data.monthly.map((m) => ({ month: m.label, amount: Math.round(isPay ? m.paidOut : m.invoiced) }));
    const total = series.reduce((s, d) => s + d.amount, 0);
    const avg = Math.round(total / Math.max(1, series.length));
    const peak = series.reduce((a, b) => (a.amount > b.amount ? a : b));
    const low = series.reduce((a, b) => (a.amount < b.amount ? a : b));
    return {
      icon: TrendingUp,
      title: isPay ? 'Payments Out Trend' : 'Invoice Cost Trend',
      tip: isPay
        ? 'Cash paid to vendors, summed by month, across payments and applied prepayments.'
        : 'Value of vendor invoices booked, summed by month of the invoice date.',
      content: (
        <>
          {chartBox(CH[sz], (
            <AreaChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: C_SLATE }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C_SLATE }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <ReTooltip contentStyle={ttStyle} formatter={(val: number) => [moneyExact(val), isPay ? 'Paid Out' : 'Invoiced']} />
              <Area type="monotone" dataKey="amount" stroke={stroke} strokeWidth={2} fill={`url(#${gradId})`} />
            </AreaChart>
          ))}
          {sz === 'sm' && statRow([
            { label: '12 mo', value: money(total) },
            { label: 'Avg/mo', value: money(avg) },
          ], true)}
          {sz === 'md' && statRow([
            { label: '12-Mo Total', value: money(total) },
            { label: 'Monthly Avg', value: money(avg) },
          ])}
          {sz === 'lg' && statRow([
            { label: '12-Mo Total', value: money(total) },
            { label: 'Monthly Avg', value: money(avg) },
            { label: 'Peak Month', value: `${peak.month} · ${money(peak.amount)}`, color: stroke },
            { label: 'Lowest', value: `${low.month} · ${money(low.amount)}`, color: C_SLATE },
          ])}
        </>
      ),
    };
  }

  if (wKey === 'invoice_activity' || wKey === 'payment_activity') {
    const isPay = wKey === 'payment_activity';
    const mainColor = isPay ? C_EMERALD : C_BLUE;
    const mainLabel = isPay ? 'Payments' : 'Invoices';
    const altLabel = isPay ? 'Reversed / Cancelled' : 'Flagged / Held';
    const series = data.monthly.map((m) => ({
      month: m.label,
      main: isPay ? m.payCount : m.invCount,
      alt: isPay ? m.payReversed : m.invBlocked,
    }));
    const totalMain = series.reduce((s, d) => s + d.main, 0);
    const totalAlt = series.reduce((s, d) => s + d.alt, 0);
    const altPct = totalMain > 0 ? ((totalAlt / totalMain) * 100).toFixed(1) : '0';
    const legend = legendDots([
      { label: mainLabel, color: mainColor },
      { label: altLabel, color: C_AMBER },
    ]);
    return {
      icon: BarChart3,
      title: isPay ? 'Payment Activity' : 'Invoice Activity',
      tip: isPay
        ? 'Payments recorded each month, alongside the ones that were reversed or cancelled.'
        : 'Invoices booked each month, alongside the ones sitting in Exception or Payment Hold.',
      content: (
        <>
          {chartBox(CH[sz], (
            <BarChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: C_SLATE }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C_SLATE }} axisLine={false} tickLine={false} allowDecimals={false} />
              <ReTooltip contentStyle={ttStyle} />
              <Bar dataKey="main" fill={mainColor} radius={[4, 4, 0, 0]} barSize={sz === 'sm' ? 10 : 16} name={mainLabel} />
              <Bar dataKey="alt" fill={C_AMBER} radius={[4, 4, 0, 0]} barSize={sz === 'sm' ? 10 : 16} name={altLabel} />
            </BarChart>
          ))}
          {sz === 'sm' && statRow([
            { label: mainLabel, value: String(totalMain) },
            { label: altLabel, value: `${altPct}%`, color: C_AMBER },
          ], true, legend)}
          {sz !== 'sm' && statRow([
            { label: '12 Months', value: `${totalMain} ${mainLabel}` },
            { label: altLabel, value: `${totalAlt} (${altPct}%)`, color: C_AMBER },
            ...(sz === 'lg' ? [{ label: 'Avg / Month', value: (totalMain / 12).toFixed(1) }] : []),
          ], false, legend)}
        </>
      ),
    };
  }

  if (wKey === 'invoice_aging') {
    const total = data.aging.reduce((s, b) => s + b.amount, 0);
    const worst = data.aging[4];
    return {
      icon: BarChart3,
      title: 'Invoice Aging',
      tip: 'Outstanding balance grouped by how long it has been past due. Current means not due yet.',
      content: (
        <>
          {chartBox(CH[sz], (
            <BarChart data={data.aging} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: C_SLATE }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C_SLATE }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [moneyExact(v), 'Outstanding']} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={sz === 'sm' ? 18 : 28}>
                {data.aging.map((b) => (
                  <Cell key={b.bucket} fill={b.color} />
                ))}
              </Bar>
            </BarChart>
          ))}
          {sz === 'sm' && statRow([
            { label: 'Open', value: money(total) },
            { label: '90+', value: money(worst.amount), color: C_RED },
          ], true)}
          {sz !== 'sm' && statRow([
            { label: 'Total Open', value: money(total) },
            { label: 'Past 90 Days', value: money(worst.amount), color: C_RED },
            ...(sz === 'lg' ? [{ label: 'Current', value: money(data.aging[0].amount), color: C_EMERALD }] : []),
          ])}
        </>
      ),
    };
  }

  if (wKey === 'spend_by_type' || wKey === 'payment_methods') {
    const isMethods = wKey === 'payment_methods';
    const slices = isMethods ? data.byMethod : data.byType;
    const grand = slices.reduce((s, c) => s + c.value, 0);
    const pieSize = sz === 'sm' ? 100 : sz === 'lg' ? 160 : 130;
    const pieInner = sz === 'sm' ? 30 : sz === 'lg' ? 52 : 40;
    const pieOuter = sz === 'sm' ? 46 : sz === 'lg' ? 74 : 60;
    return {
      icon: PieChartIcon,
      title: isMethods ? 'Payments by Method' : 'Spend by Invoice Type',
      tip: isMethods
        ? 'How the paid value splits across payment methods, over all recorded payments.'
        : 'How the invoiced value splits across the invoice types, over all invoices.',
      content: (
        <>
          <div className="flex items-center gap-4">
            <div className="shrink-0 relative" style={{ width: pieSize, height: pieSize }}>
              <RePieChart width={pieSize} height={pieSize}>
                <Pie data={slices} cx="50%" cy="50%" innerRadius={pieInner} outerRadius={pieOuter} paddingAngle={2} dataKey="value" stroke="none">
                  {slices.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={(!isMethods && TYPE_SLICE_COLORS[slices[i].name]) || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </RePieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] text-slate-700" style={{ fontWeight: 700 }}>{money(grand)}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              {slices.map((cat, idx) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: (!isMethods && TYPE_SLICE_COLORS[cat.name]) || PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <span className="text-[11px] text-muted-foreground truncate" style={{ fontWeight: 500 }}>{cat.name}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>{cat.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          {sz === 'sm' && statRow(slices.slice(0, 2).map((c) => ({ label: c.name, value: money(c.value) })), true)}
          {sz === 'md' && statRow(slices.slice(0, 3).map((c) => ({ label: c.name, value: money(c.value) })))}
          {sz === 'lg' && statRow(slices.map((c) => ({ label: c.name, value: money(c.value) })))}
        </>
      ),
    };
  }

  if (wKey === 'cash_out_history') {
    const series = data.monthly.map((m) => ({ month: m.label, payments: Math.round(m.payments), prepayments: Math.round(m.prepayments) }));
    const totalPay = series.reduce((s, d) => s + d.payments, 0);
    const totalPre = series.reduce((s, d) => s + d.prepayments, 0);
    return {
      icon: Banknote,
      title: 'Cash Out History',
      tip: 'Cash leaving the bank by month, split between invoice payments and vendor prepayments.',
      content: (
        <>
          {chartBox(CH[sz], (
            <AreaChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="acctCashOutGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C_EMERALD} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={C_EMERALD} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: C_SLATE }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C_SLATE }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <ReTooltip contentStyle={ttStyle} formatter={(v: number, name: string) => [moneyExact(v), name === 'payments' ? 'Payments' : 'Prepayments']} />
              <Area type="monotone" dataKey="payments" stroke={C_EMERALD} strokeWidth={2} fill="url(#acctCashOutGrad)" />
              <Area type="monotone" dataKey="prepayments" stroke={C_AMBER} strokeWidth={2} strokeDasharray="4 3" fill="transparent" />
            </AreaChart>
          ))}
          {statRow([
            { label: 'Payments', value: money(totalPay), color: C_EMERALD },
            { label: 'Prepayments', value: money(totalPre), color: C_AMBER },
            ...(sz === 'lg' ? [{ label: 'Total Out', value: money(totalPay + totalPre) }] : []),
          ], sz === 'sm', legendDots([
            { label: 'Payments', color: C_EMERALD },
            { label: 'Prepayments', color: C_AMBER },
          ]))}
        </>
      ),
    };
  }

  if (wKey === 'top_vendors' || wKey === 'top_vendors_outflow') {
    const isOutflow = wKey === 'top_vendors_outflow';
    const rows = isOutflow ? data.topVendorsOutflow : data.topVendors;
    const series = rows.map((v) => ({ name: v.name.length > 18 ? `${v.name.slice(0, 17)}…` : v.name, value: Math.round(v.value) }));
    return {
      icon: ChartColumn,
      title: isOutflow ? 'Top Vendors by Outflow' : 'Top Vendors by Spend',
      tip: isOutflow
        ? 'The five vendors that received the most cash, across payments and prepayments.'
        : 'The five vendors with the highest total invoiced value, across all invoices.',
      content: (
        <>
          {chartBox(CH[sz], (
            <BarChart data={series} layout="vertical" margin={{ top: 0, right: 10, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: C_SLATE }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={sz === 'sm' ? 90 : 120} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [moneyExact(v), isOutflow ? 'Paid' : 'Invoiced']} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={sz === 'sm' ? 10 : 14}>
                {series.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ))}
          {sz !== 'sm' && rows[0] && statRow([
            { label: 'Top Vendor', value: rows[0].name, color: C_BLUE },
            { label: isOutflow ? 'Paid' : 'Invoiced', value: money(rows[0].value) },
          ])}
        </>
      ),
    };
  }

  if (wKey === 'cash_position') {
    const totalNow = CASH_ACCOUNTS.reduce((s, a) => s + a.balance, 0);
    return {
      icon: Landmark,
      title: 'Cash Position',
      tip: 'Balance of every connected bank account over the last 12 weeks, from Cash Management.',
      content: (
        <>
          {chartBox(CH[sz], (
            <LineChart data={CASH_POSITION_SERIES} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: C_SLATE }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C_SLATE }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <ReTooltip contentStyle={ttStyle} formatter={(v: number) => [moneyExact(v)]} />
              {CASH_ACCOUNTS.map((acc) => (
                <Line key={acc.short} type="monotone" dataKey={acc.short} stroke={acc.color} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          ))}
          {statRow(
            [
              { label: 'Total on Hand', value: money(totalNow) },
              ...(sz !== 'sm' ? [{ label: 'Accounts', value: String(CASH_ACCOUNTS.length) }] : []),
            ],
            sz === 'sm',
            sz !== 'sm' ? legendDots(CASH_ACCOUNTS.map((a) => ({ label: a.short, color: a.color }))) : undefined,
          )}
        </>
      ),
    };
  }

  if (wKey === 'cash_flow') {
    // Cash in mirrors the Cash Management feed (mocked as a steady
    // receivables stream); cash out is the real monthly payments series.
    const series = data.monthly.map((m, i) => ({
      month: m.label,
      cashIn: Math.round(m.invoiced * (0.85 + 0.25 * Math.abs(Math.sin(i * 1.7)))),
      cashOut: Math.round(m.paidOut),
    }));
    const totalIn = series.reduce((s, d) => s + d.cashIn, 0);
    const totalOut = series.reduce((s, d) => s + d.cashOut, 0);
    return {
      icon: TrendingUp,
      title: 'Cash Flow',
      tip: 'Cash coming in vs cash going out each month. Outflow is the real payments series; inflow streams from Cash Management.',
      content: (
        <>
          {chartBox(CH[sz], (
            <BarChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: C_SLATE }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C_SLATE }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <ReTooltip contentStyle={ttStyle} formatter={(v: number, name: string) => [moneyExact(v), name === 'cashIn' ? 'Cash In' : 'Cash Out']} />
              <Bar dataKey="cashIn" fill={C_EMERALD} radius={[3, 3, 0, 0]} barSize={sz === 'sm' ? 8 : 12} name="cashIn" />
              <Bar dataKey="cashOut" fill={C_BLUE} radius={[3, 3, 0, 0]} barSize={sz === 'sm' ? 8 : 12} name="cashOut" />
            </BarChart>
          ))}
          {statRow(
            [
              { label: 'Cash In', value: money(totalIn), color: C_EMERALD },
              { label: 'Cash Out', value: money(totalOut), color: C_BLUE },
              ...(sz === 'lg' ? [{ label: 'Net', value: money(totalIn - totalOut), color: totalIn >= totalOut ? C_EMERALD : C_RED }] : []),
            ],
            sz === 'sm',
            legendDots([
              { label: 'Cash In', color: C_EMERALD },
              { label: 'Cash Out', color: C_BLUE },
            ]),
          )}
        </>
      ),
    };
  }

  if (wKey === 'top_spend_distribution') {
    const total = data.totalPaidAll;
    const slices = SPEND_CATEGORIES.map((c) => ({ name: c.name, pct: c.pct, value: Math.round((total * c.pct) / 100) }));
    const pieSize = sz === 'sm' ? 100 : sz === 'lg' ? 160 : 130;
    const pieInner = sz === 'sm' ? 30 : sz === 'lg' ? 52 : 40;
    const pieOuter = sz === 'sm' ? 46 : sz === 'lg' ? 74 : 60;
    const colors = [C_BLUE, C_VIOLET, C_EMERALD, C_AMBER, C_SLATE];
    return {
      icon: PieChartIcon,
      title: 'Top Spend Distribution',
      tip: 'Where the cash out went, split by spend category, from Cash Management.',
      content: (
        <>
          <div className="flex items-center gap-4">
            <div className="shrink-0 relative" style={{ width: pieSize, height: pieSize }}>
              <RePieChart width={pieSize} height={pieSize}>
                <Pie data={slices} cx="50%" cy="50%" innerRadius={pieInner} outerRadius={pieOuter} paddingAngle={2} dataKey="value" stroke="none">
                  {slices.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
              </RePieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] text-slate-700" style={{ fontWeight: 700 }}>{compactMoney(total)}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              {slices.map((cat, idx) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[idx % colors.length] }} />
                    <span className="text-[11px] text-muted-foreground truncate" style={{ fontWeight: 500 }}>{cat.name}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>{cat.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          {sz !== 'sm' && statRow(slices.slice(0, sz === 'lg' ? 4 : 3).map((c) => ({ label: c.name, value: money(c.value) })))}
        </>
      ),
    };
  }

  if (wKey === 'payables_due') {
    const week = data.payablesWeek;
    const owedThisWeek = week.reduce((s, d) => s + d.amount, 0);
    const dueToday = week[0]?.amount ?? 0;
    return {
      icon: CalendarDays,
      title: 'Payables Due',
      tip: 'Bills falling due day by day over the next seven days, from open invoice due dates.',
      content: (
        <>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Owed This Week</p>
              <p className="text-[20px] text-primary leading-tight" style={{ fontWeight: 700 }}>{money(owedThisWeek)}</p>
            </div>
            <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{money(dueToday)} due today</p>
          </div>
          <div className="grid grid-cols-7 gap-1.5 mt-3">
            {week.map((d) => (
              <div
                key={`${d.day}-${d.date}`}
                className={`rounded-lg border px-1 py-2 flex flex-col items-center gap-1 min-w-0 ${
                  d.isToday ? 'border-primary/40 bg-[#EBF3FF]' : d.amount > 0 ? 'border-border bg-white' : 'border-border/60 bg-white'
                }`}
              >
                <span className="text-[9px] text-slate-400" style={{ fontWeight: 600 }}>{d.day}</span>
                <span className={`text-[13px] ${d.isToday ? 'text-primary' : 'text-slate-700'}`} style={{ fontWeight: 700 }}>{d.date}</span>
                <div className={`w-full h-1 rounded-full ${d.amount > 0 ? '' : 'bg-slate-100'}`} style={d.amount > 0 ? { backgroundColor: d.isToday ? C_BLUE : '#BFDBFE' } : undefined} />
                <span className={`text-[9px] truncate max-w-full ${d.amount > 0 ? 'text-slate-600' : 'text-slate-300'}`} style={{ fontWeight: 600 }}>
                  {d.amount > 0 ? compactMoney(d.amount) : '$0'}
                </span>
              </div>
            ))}
          </div>
          {sz !== 'sm' && statRow([
            { label: 'Bills', value: String(week.filter((d) => d.amount > 0).length) },
            { label: 'Heaviest Day', value: (() => { const top = week.reduce((a, b) => (b.amount > a.amount ? b : a)); return top.amount > 0 ? `${top.day} · ${compactMoney(top.amount)}` : 'None'; })(), color: C_BLUE },
          ])}
        </>
      ),
    };
  }

  if (wKey === 'receivables_due') {
    return {
      icon: Wallet,
      title: 'Receivables Due',
      tip: 'Outstanding A/R expected over the next 30 days, streamed from Cash Management.',
      content: (
        <>
          <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Total A/R · Next 30 Days</p>
          <p className="text-[20px] text-primary leading-tight" style={{ fontWeight: 700 }}>{money(RECEIVABLES_DUE.total)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{money(RECEIVABLES_DUE.nextFiveDays)} due in the next 5 days</p>
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden flex mt-2">
            {RECEIVABLES_DUE.buckets.map((b, i) => (
              <div key={b.label} style={{ width: `${b.pct}%`, backgroundColor: [C_BLUE, '#60A5FA', '#BFDBFE'][i] }} />
            ))}
          </div>
          <div className="mt-2.5 space-y-1.5">
            {RECEIVABLES_DUE.buckets.map((b) => (
              <div key={b.label} className="flex items-center justify-between rounded-lg border border-border bg-white px-2.5 py-1.5">
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-700" style={{ fontWeight: 600 }}>{b.label}</p>
                  <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{b.note}</p>
                </div>
                <span className="text-[12px] text-primary shrink-0" style={{ fontWeight: 700 }}>{money(b.amount)}</span>
              </div>
            ))}
          </div>
        </>
      ),
    };
  }

  if (wKey === 'payroll_due') {
    return {
      icon: Banknote,
      title: 'Payroll Due',
      tip: 'The next payroll run: net amount due, run date, and the funding account, from Cash Management.',
      content: (
        <>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Net Payroll Due</p>
              <p className="text-[20px] text-primary leading-tight" style={{ fontWeight: 700 }}>{money(PAYROLL_DUE.net)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                Gross {money(PAYROLL_DUE.gross)} · Taxes and deductions {money(PAYROLL_DUE.deductions)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Run Date</p>
              <p className="text-[13px] text-slate-700" style={{ fontWeight: 700 }}>{nextPayrollRunLabel()}</p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-border bg-white px-2.5 py-2">
            <div className="w-7 h-7 rounded-md bg-white border border-border flex items-center justify-center shrink-0">
              <Landmark className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{PAYROLL_DUE.fundingAccount}</p>
              <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{PAYROLL_DUE.fundingMask} · funding account</p>
            </div>
          </div>
          {statRow([
            { label: 'Employees', value: String(PAYROLL_DUE.employees) },
            { label: 'Avg / Employee', value: money(PAYROLL_DUE.avgPerEmployee) },
            { label: 'Cycle', value: PAYROLL_DUE.cycle },
          ], sz === 'sm')}
        </>
      ),
    };
  }

  if (wKey === 'accounts_snapshot') {
    const total = CASH_ACCOUNTS.reduce((s, a) => s + a.balance, 0);
    return {
      icon: Landmark,
      title: 'Accounts Snapshot',
      tip: 'Connected bank accounts and their current balances, synced from Cash Management.',
      content: (
        <>
          <div className="divide-y divide-slate-100">
            {CASH_ACCOUNTS.map((acc) => (
              <div key={acc.name} className="flex items-center gap-2.5 py-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${acc.color}1A` }}>
                  <Landmark className="w-3.5 h-3.5" style={{ color: acc.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{acc.name}</p>
                  <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{acc.mask}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[12px] text-foreground " style={{ fontWeight: 600 }}>{moneyExact(acc.balance)}</span>
                  <span className="inline-flex px-1.5 py-px rounded-full text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100" style={{ fontWeight: 600 }}>Connected</span>
                </div>
              </div>
            ))}
          </div>
          {sz !== 'sm' && statRow([
            { label: 'Total on Hand', value: money(total), color: C_EMERALD },
            { label: 'Accounts', value: String(CASH_ACCOUNTS.length) },
          ])}
        </>
      ),
    };
  }

  if (wKey === 'oldest_outstanding') {
    return {
      icon: Clock,
      title: 'Oldest Outstanding',
      tip: 'The five unpaid invoices that have been past due the longest.',
      content: listRows(
        data.oldest.map((inv) => ({
          id: inv.id,
          primary: inv.invoiceNumber,
          secondary: inv.vendor,
          status: inv.status,
          amount: inv.outstandingBalance,
          badge: `${daysPastDue(inv.dueDate)}d`,
        })),
        'Nothing overdue. Nice.',
      ),
    };
  }

  if (wKey === 'recent_invoices') {
    return {
      icon: FileText,
      title: 'Recent Invoices',
      tip: 'The five most recently booked vendor invoices.',
      content: listRows(
        data.recentInvoices.map((inv) => ({
          id: inv.id,
          primary: inv.invoiceNumber,
          secondary: `${inv.vendor} · ${inv.invoiceDate || inv.date}`,
          status: inv.status,
          amount: inv.amount,
        })),
        'No invoices yet.',
      ),
    };
  }

  // recent_payments
  return {
    icon: Banknote,
    title: 'Recent Payments',
    tip: 'The five most recently recorded vendor payments and prepayments.',
    content: listRows(
      data.recentPayments.map((p) => ({
        id: p.id,
        primary: p.paymentNumber,
        secondary: `${p.vendor} · ${formatUsDate(p.paymentDate)}`,
        status: p.status,
        amount: p.amount,
      })),
      'No payments yet.',
    ),
  };
}

// ── Widget frame — 1:1 with the partner details ContentCard: the whole
// header bar is the drag handle, the Small / Medium / Large toggle
// slides in from the right on hover, and the remove action is the
// Trash2 button with a re-enable toast. ──
function DashWidget({
  wKey, index, sz, data, moveWidget, onSizeChange, onRemove,
}: {
  wKey: string;
  index: number;
  sz: WSize;
  data: BoardData;
  moveWidget: (from: number, to: number) => void;
  onSizeChange: (size: WSize) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_DASH_WIDGET,
    item: () => ({ key: wKey, index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });
  const [{ isOver }, drop] = useDrop({
    accept: DND_DASH_WIDGET,
    drop(item: { key: string; index: number }) {
      if (item.index !== index) {
        moveWidget(item.index, index);
        item.index = index;
      }
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });
  preview(drop(ref));
  drag(ref);

  // Width model — sm/md flow two-up, lg takes the full row.
  const width = sz === 'lg' ? '100%' : 'calc(50% - 6px)';
  const { icon: Icon, title, tip, content } = renderWidgetContent(wKey, sz, data);

  return (
    <div
      ref={ref}
      style={{
        width,
        opacity: isDragging ? 0.3 : 1,
        transform: isDragging ? 'scale(0.97) rotate(-0.5deg)' : undefined,
      }}
      className={`transition-all duration-300 ease-out rounded-xl min-w-0 ${isOver && !isDragging ? 'ring-2 ring-primary/20 ring-offset-2 scale-[1.005]' : ''}`}
    >
      <div
        className={`rounded-xl border bg-white overflow-hidden h-full flex flex-col transition-[box-shadow,border-color] duration-300 ${
          isOver && !isDragging
            ? 'border-primary/30 shadow-[0_0_0_2px_rgba(10,119,255,0.10)]'
            : 'border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]'
        }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Header — entire bar is the drag handle */}
        <div className="px-4 py-2.5 border-b border-muted flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none">
          <div className="flex items-center gap-2 pointer-events-none">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</span>
            <span className="pointer-events-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                    <Info className="w-3 h-3 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={6}
                  className="z-[300] max-w-[260px] rounded-xl bg-white/95 backdrop-blur-md text-slate-700 border border-border/80 px-3.5 py-2.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)]"
                >
                  <p className="text-[11px] leading-relaxed">{tip}</p>
                </TooltipContent>
              </Tooltip>
            </span>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Size toggle — slides in from right on hover */}
            <div
              className={`flex items-center transition-all duration-200 ease-out pointer-events-auto ${
                hovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
              }`}
            >
              <div className="flex items-center h-7 rounded-lg border border-border bg-slate-50 p-0.5 gap-0.5">
                {(['sm', 'md', 'lg'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={(e) => { e.stopPropagation(); onSizeChange(s); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`h-6 px-2.5 rounded-md text-[11px] cursor-pointer transition-all duration-150 ${
                      sz === s
                        ? 'bg-white text-primary shadow-sm border border-border'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-white/60 border border-transparent'
                    }`}
                    style={{ fontWeight: sz === s ? 600 : 500 }}
                  >
                    {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}
                  </button>
                ))}
              </div>
            </div>
            {/* Remove button — fades in on hover, inline in header flow */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); toast.success(`Removed "${title}". Re-enable from Customize Insights.`); }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`group/rm w-7 h-7 rounded-md flex items-center justify-center text-slate-400 transition-all duration-150 cursor-pointer hover:bg-red-100 hover:text-destructive ${
                hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              title={`Remove ${title}`}
              aria-label={`Remove ${title} widget`}
            >
              <Trash2 className="w-3.5 h-3.5 transition-transform duration-150 group-hover/rm:scale-110" />
            </button>
          </div>
        </div>
        <div className={`flex-1 flex flex-col justify-between ${sz === 'sm' ? 'p-3' : sz === 'lg' ? 'p-5' : 'p-4'}`}>{content}</div>
      </div>
    </div>
  );
}

// ── Customize panel widget preview (pastel visual per type) ──
function WidgetVisual({ type, isActive }: { type: WidgetVisualType; isActive: boolean }) {
  const tone = isActive ? C_BLUE : C_SLATE;
  if (type === 'donut') {
    return (
      <div className="w-9 h-9 rounded-full border-[5px]" style={{ borderColor: tone, borderRightColor: '#E2E8F0' }} />
    );
  }
  if (type === 'list') {
    return (
      <div className="w-14 space-y-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tone, opacity: 0.7 }} />
            <span className="h-1 flex-1 rounded-full" style={{ backgroundColor: '#E2E8F0' }} />
          </div>
        ))}
      </div>
    );
  }
  if (type === 'bars') {
    return (
      <div className="flex items-end gap-1 h-9">
        {[35, 60, 45, 80, 55].map((h, i) => (
          <span key={i} className="w-1.5 rounded-sm" style={{ height: `${h}%`, backgroundColor: i === 3 ? tone : '#CBD5E1' }} />
        ))}
      </div>
    );
  }
  if (type === 'chart') {
    return (
      <div className="flex items-end gap-1 h-9">
        {[50, 70, 40, 85, 60, 30].map((h, i) => (
          <span key={i} className="w-1.5 rounded-sm" style={{ height: `${h}%`, backgroundColor: i % 2 === 0 ? tone : C_AMBER, opacity: i % 2 === 0 ? 1 : 0.75 }} />
        ))}
      </div>
    );
  }
  // line
  return (
    <svg width="56" height="28" viewBox="0 0 56 28" fill="none">
      <path d="M2 22 C 12 20, 16 10, 24 12 S 40 20, 54 6" stroke={tone} strokeWidth="2" strokeLinecap="round" />
      <path d="M2 22 C 12 20, 16 10, 24 12 S 40 20, 54 6 L 54 28 L 2 28 Z" fill={tone} opacity="0.12" />
    </svg>
  );
}

// ── Customize Insights drawer — 1:1 with the partner details
// DashboardCustomizePanel: mount/visible slide animation, icon-tile
// header, "N of M widgets active" + toggle-all pill, tall search box,
// and underline tabs. ──
function CustomizePanel({
  open, onOpenChange, activeKpis, onToggleKpi, activeWidgets, onToggleWidget, widgetSizes, onWidgetSizeChange, kpiValue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  activeWidgets: string[];
  onToggleWidget: (key: string) => void;
  widgetSizes: Record<string, WSize>;
  onWidgetSizeChange: (key: string, size: WSize) => void;
  kpiValue: (key: string) => string;
}) {
  const [panelTab, setPanelTab] = useState<'kpis' | 'widgets'>('kpis');
  const [searchQuery, setSearchQuery] = useState('');
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
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [open]);

  const kpiCategories = (['Cash', 'Invoicing', 'Payments'] as const)
    .map((name) => ({
      name,
      kpis: DASH_KPI_DEFS.filter((k) =>
        k.category === name &&
        (!searchQuery || k.label.toLowerCase().includes(searchQuery.toLowerCase()))),
    }))
    .filter((c) => c.kpis.length > 0);

  const tabDefsCount = panelTab === 'kpis' ? DASH_KPI_DEFS.length : DASH_WIDGET_DEFS.length;
  const tabActiveCount = panelTab === 'kpis' ? activeKpis.length : activeWidgets.length;
  const allOn = panelTab === 'kpis'
    ? DASH_KPI_DEFS.every((k) => activeKpis.includes(k.key))
    : DASH_WIDGET_DEFS.every((w) => activeWidgets.includes(w.key));

  const toggleAll = () => {
    if (panelTab === 'kpis') {
      const allKeys = DASH_KPI_DEFS.map((k) => k.key);
      if (allOn) activeKpis.forEach((k) => onToggleKpi(k));
      else allKeys.filter((k) => !activeKpis.includes(k)).forEach((k) => onToggleKpi(k));
    } else {
      const allKeys = DASH_WIDGET_DEFS.map((w) => w.key);
      if (allOn) activeWidgets.forEach((k) => onToggleWidget(k));
      else allKeys.filter((k) => !activeWidgets.includes(k)).forEach((k) => onToggleWidget(k));
    }
  };

  if (!mounted) return null;

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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'hsl(var(--accent))' }}>
                <Sliders className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Customize Insights</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">Manage your dashboard KPI widgets.</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {/* Toggle all widgets */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {tabActiveCount} of {tabDefsCount} widgets active
            </span>
            <button
              onClick={toggleAll}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                allOn
                  ? 'bg-[#EBF3FF] border-primary/25 text-primary hover:bg-[#DCEAFF] hover:border-primary/40 shadow-sm shadow-primary/10'
                  : tabActiveCount === 0
                    ? 'bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500'
                    : 'bg-slate-50 border-border text-slate-500 hover:bg-[#EBF3FF] hover:border-primary/25 hover:text-primary'
              }`}
              style={{ fontWeight: 600 }}
            >
              {allOn ? (
                <>
                  <ToggleRight className="w-4 h-4 text-primary" />
                  <span>All On</span>
                </>
              ) : tabActiveCount === 0 ? (
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
        <div className="px-5 pt-3.5 pb-0 bg-white shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input
              placeholder={panelTab === 'kpis' ? 'Search metrics...' : 'Search widgets...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
            />
          </div>
        </div>

        {/* Tab bar — matches the partner header tab style */}
        <div className="flex items-center gap-0 px-5 pt-3 bg-white border-b border-border shrink-0">
          {(['kpis', 'widgets'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPanelTab(t)}
              className={`px-4 py-2.5 border-b-2 text-[13px] transition-all duration-200 cursor-pointer whitespace-nowrap ${
                panelTab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
              style={{ fontWeight: panelTab === t ? 600 : 400 }}
            >
              {t === 'kpis' ? 'KPIs' : 'Widgets'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 bg-slate-50">
          {panelTab === 'kpis' ? (
            <>
              {kpiCategories.length === 0 && (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Search className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground/60">No metrics found</p>
                </div>
              )}
              {kpiCategories.map((cat) => (
                <div key={cat.name} className="mt-5 first:mt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    {cat.name === 'Cash' ? <Landmark className="w-4 h-4 text-muted-foreground" /> : cat.name === 'Invoicing' ? <FileText className="w-4 h-4 text-muted-foreground" /> : <DollarSign className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-[12px] text-muted-foreground/70 tracking-wide" style={{ fontWeight: 600 }}>{cat.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.kpis.map((kpi) => {
                      const isActive = activeKpis.includes(kpi.key);
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
                            <span className={`text-[11px] truncate transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground/70'}`} style={{ fontWeight: 500 }}>
                              {/* Widget search highlights its matches like every list (10/9/26). */}
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
                          <p className={`text-[15px] mt-1 truncate transition-colors ${isActive ? 'text-foreground' : 'text-foreground/80'}`} style={{ fontWeight: 550 }}>
                            {kpiValue(kpi.key)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="mt-2">
              {WIDGET_CATEGORY_ORDER.map((cat) => {
                const inCat = DASH_WIDGET_DEFS.filter((w) =>
                  w.category === cat &&
                  (!searchQuery || w.label.toLowerCase().includes(searchQuery.toLowerCase()) || w.description.toLowerCase().includes(searchQuery.toLowerCase())));
                if (inCat.length === 0) return null;
                const CatIcon = cat === 'Performance' ? ChartColumn : cat === 'Financial' ? DollarSign : cat === 'Cash' ? Landmark : Activity;
                return (
                  <div key={cat} className="mt-5 first:mt-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CatIcon className="w-3.5 h-3.5 text-muted-foreground/70" />
                      <span className="text-[12px] text-muted-foreground/70 tracking-wide" style={{ fontWeight: 600 }}>{cat}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {inCat.map((w) => {
                        const isActive = activeWidgets.includes(w.key);
                        const sz = widgetSizes[w.key] || 'md';
                        return (
                          // div-with-role instead of <button>: the active
                          // state nests the size-picker buttons inside.
                          <div
                            key={w.key}
                            role="button"
                            tabIndex={0}
                            onClick={() => onToggleWidget(w.key)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleWidget(w.key); } }}
                            className={`relative text-left rounded-xl border overflow-hidden transition-all duration-150 cursor-pointer group ${
                              isActive
                                ? 'border-primary/30 bg-white shadow-[0_0_0_1px_rgba(10,119,255,0.08)]'
                                : 'border-border/60 bg-white hover:border-border hover:shadow-sm'
                            }`}
                          >
                            <div className="h-[68px] flex items-center justify-center bg-white border-b border-slate-100">
                              <WidgetVisual type={w.type} isActive={isActive} />
                            </div>
                            <div className="absolute top-1.5 right-1.5">
                              {isActive ? (
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center group-hover:border-slate-300 transition-colors">
                                  <Plus className="w-3 h-3 text-slate-400" />
                                </div>
                              )}
                            </div>
                            <div className="px-3 py-2.5 border-t border-muted">
                              <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }} title={w.label}>{highlightText(w.label, searchQuery)}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug" title={w.description}>{highlightText(w.description, searchQuery)}</p>
                              {isActive && (
                                <div className="mt-2 flex items-center h-6 rounded-md border border-border bg-slate-50 p-0.5 gap-0.5" onClick={(e) => e.stopPropagation()}>
                                  {(['sm', 'md', 'lg'] as const).map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); onWidgetSizeChange(w.key, s); }}
                                      className={`flex-1 h-5 rounded text-[10px] transition-all duration-150 cursor-pointer ${
                                        sz === s ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-700'
                                      }`}
                                      style={{ fontWeight: sz === s ? 600 : 500 }}
                                    >
                                      {({ sm: 'SM', md: 'MD', lg: 'LG' } as const)[s]}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Screen ──
interface AccountingDashboardScreenProps {
  invoices: Invoice[];
  payments: Payment[];
  onNavigate: (view: AppView) => void;
}

export function AccountingDashboardScreen({ invoices, payments, onNavigate }: AccountingDashboardScreenProps) {
  const [range, setRange] = useState<InsightsRange>('last_30');
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [customizeOpen, setCustomizeOpen] = useState(false);
  // One-click Hide (Eli 7/22/26): collapse the KPI strip in one tap without
  // toggling each card off. "Customize Insights" brings it back.
  const [showKpiStrip, setShowKpiStrip] = useState(true);

  const [activeKpis, setActiveKpis] = useState<string[]>(() => loadLS(LS_KPIS, DEFAULT_DASH_KPIS));
  const [activeWidgets, setActiveWidgets] = useState<string[]>(() => loadLS(LS_WIDGETS, DEFAULT_DASH_WIDGETS));
  const [widgetSizes, setWidgetSizes] = useState<Record<string, WSize>>(() => loadLS(LS_SIZES, {}));

  const updateKpis = (next: string[]) => { setActiveKpis(next); saveLS(LS_KPIS, next); };
  const updateWidgets = (next: string[]) => { setActiveWidgets(next); saveLS(LS_WIDGETS, next); };
  const updateSizes = (next: Record<string, WSize>) => { setWidgetSizes(next); saveLS(LS_SIZES, next); };

  const toggleKpi = (key: string) =>
    updateKpis(activeKpis.includes(key) ? activeKpis.filter((k) => k !== key) : [...activeKpis, key]);
  const toggleWidget = (key: string) =>
    updateWidgets(activeWidgets.includes(key) ? activeWidgets.filter((k) => k !== key) : [...activeWidgets, key]);
  const setWidgetSize = (key: string, size: WSize) => updateSizes({ ...widgetSizes, [key]: size });

  const moveKpi = (from: number, to: number) => {
    const next = [...activeKpis];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateKpis(next);
  };
  const moveWidget = (from: number, to: number) => {
    const next = [...activeWidgets];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateWidgets(next);
  };

  const handleReset = () => {
    updateKpis(DEFAULT_DASH_KPIS);
    updateWidgets(DEFAULT_DASH_WIDGETS);
    updateSizes({});
    toast.info('Dashboard reset', { description: 'Restored the default KPIs, widgets, and sizes.' });
  };
  // Reset only lights up when something differs from the default layout:
  // KPI/widget set or order (join is order-sensitive) or a size override.
  const dashboardDirty =
    activeKpis.join(',') !== DEFAULT_DASH_KPIS.join(',') ||
    activeWidgets.join(',') !== DEFAULT_DASH_WIDGETS.join(',') ||
    Object.keys(widgetSizes).length > 0;

  // Range slices for the flow KPIs; state KPIs read from all invoices.
  const invRange = useMemo(
    () => invoices.filter((i) => inRange(i.invoiceDate || i.date, range, custom)),
    [invoices, range, custom],
  );
  const payRange = useMemo(
    () => payments.filter((p) => inRange(p.createdDate || p.paymentDate, range, custom)),
    [payments, range, custom],
  );
  const boardData = useMemo(() => buildBoardData(invoices, payments), [invoices, payments]);

  const kpiValue = (key: string) => computeDashKpi(key, invoices, invRange, payments, payRange).value;
  const activeKpiDefs = activeKpis
    .map((key) => DASH_KPI_DEFS.find((d) => d.key === key))
    .filter(Boolean) as DashKpiDef[];
  const orderedWidgets = activeWidgets.filter((key) => DASH_WIDGET_DEFS.some((d) => d.key === key));

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Page gutter — 12px on all sides (module standard); the full-bleed
          header below cancels it with -mx-3/-mt-3. */}
      <div className="p-3 flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Page header — same recipe as the module screens */}
        <div className="-mx-3 -mt-3 px-3 pt-3.5 pb-3.5 bg-slate-50 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: palette.violet[50] }}>
                <LayoutDashboard className="w-4 h-4" style={{ color: 'hsl(var(--violet))' }} />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-[20px] truncate">Dashboard</h1>
                <p className="text-xs text-muted-foreground">
                  One view of the whole Accounting &amp; Finance module: invoicing, payments, and cash out.
                </p>
              </div>
            </div>
            {/* All board controls live in the header (design feedback):
                range, updated timestamp, refresh, reset, customize. */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <InsightsRangeMenu
                range={range}
                onRangeChange={setRange}
                customFrom={custom.from}
                customTo={custom.to}
                onCustomChange={(from, to) => setCustom({ from, to })}
              />
              <InsightsRefresh toastLabel="Dashboard refreshed" />
              <InsightsResetButton dirty={dashboardDirty} onReset={handleReset} />
              {activeKpiDefs.length > 0 && showKpiStrip && (
                <button
                  onClick={() => setShowKpiStrip(false)}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md text-slate-500 hover:text-foreground hover:bg-slate-100 transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                  title="Hide the KPI strip"
                >
                  <EyeOff className="w-3 h-3" />
                  Hide
                </button>
              )}
              <button
                onClick={() => { setShowKpiStrip(true); setCustomizeOpen(true); }}
                className="inline-flex items-center gap-1 text-[11px] hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
              >
                <Sliders className="w-3 h-3" />
                Customize Insights
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable board */}
        <div className="flex-1 min-h-0 overflow-y-auto pt-4 pb-8">
          <DndProvider backend={HTML5Backend}>
            {/* KPI strip — draggable cards */}
            {activeKpiDefs.length > 0 && showKpiStrip && (
              <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
                {activeKpiDefs.map((kpi, idx) => {
                  const computed = computeDashKpi(kpi.key, invoices, invRange, payments, payRange);
                  return (
                    <DraggableKpiCard
                      key={kpi.key}
                      index={idx}
                      kpiKey={kpi.key}
                      label={kpi.label}
                      value={computed.value}
                      sub={computed.sub ?? kpi.subtitle}
                      iconName={kpi.iconName}
                      iconColor={palette.slate[400]}
                      iconBg="transparent"
                      tooltip={kpi.tooltip}
                      moveCard={moveKpi}
                      onRemove={() => toggleKpi(kpi.key)}
                    />
                  );
                })}
              </div>
            )}

            {/* Widget board — full width; the Financial Summary rail was
                folded into the KPI strip per design feedback. */}
            {orderedWidgets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-white/60 py-16 flex flex-col items-center text-center">
                <LayoutDashboard className="w-6 h-6 text-slate-300 mb-2" />
                <p className="text-[13px] text-slate-500" style={{ fontWeight: 500 }}>No widgets on the board.</p>
                <button
                  onClick={() => setCustomizeOpen(true)}
                  className="mt-2 text-[12px] text-primary hover:underline underline-offset-2 cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  Customize Insights
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 items-stretch min-w-0">
                {orderedWidgets.map((wKey, wIdx) => (
                  <DashWidget
                    key={wKey}
                    wKey={wKey}
                    index={wIdx}
                    sz={widgetSizes[wKey] || 'md'}
                    data={boardData}
                    moveWidget={moveWidget}
                    onSizeChange={(s) => setWidgetSize(wKey, s)}
                    onRemove={() => toggleWidget(wKey)}
                  />
                ))}
              </div>
            )}
          </DndProvider>
        </div>
      </div>

      <CustomizePanel
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        activeKpis={activeKpis}
        onToggleKpi={toggleKpi}
        activeWidgets={activeWidgets}
        onToggleWidget={toggleWidget}
        widgetSizes={widgetSizes}
        onWidgetSizeChange={setWidgetSize}
        kpiValue={kpiValue}
      />
    </div>
  );
}
