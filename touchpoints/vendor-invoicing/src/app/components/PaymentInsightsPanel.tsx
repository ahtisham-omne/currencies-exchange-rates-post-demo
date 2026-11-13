import { useState, useMemo, useEffect, useRef } from 'react';
import { localTodayIso } from '@/app/lib/dueBucket';
import type { CSSProperties } from 'react';
import {
  Search,
  ChartColumn,
  AlertTriangle,
  CircleDollarSign,
  Calendar,
  Wallet,
  Clock,
  TrendingUp,
  Star,
  X,
  Check,
  Plus,
  Sliders,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  CreditCard,
  Banknote,
  Landmark,
  Ban,
  CheckCircle2,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { Payment } from '@/app/data/mockPayments';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import { formatCompactMoney } from '@/app/currency/money';
import { toPaymentBase } from '@/app/currency/paymentFx';
import { palette } from '@/styles/tokens';
import { highlightText } from '@/app/components/InvoiceDataTable';

// Payments flavor of InvoiceInsightsPanel — same drawer, range filtering,
// and period-over-period delta machinery, computed over the Payment schema.

export interface PaymentKpiDefinition {
  key: string;
  label: string;
  category: 'Pipeline & Volume' | 'Application & Risk' | 'Cash & Performance';
  iconName: string;
  iconBg: string;
  iconColor: string;
  subtitle: string;
  tooltip?: string;
}

export const ALL_PAYMENT_KPI_DEFINITIONS: PaymentKpiDefinition[] = [
  // Pipeline & Volume
  {
    key: 'total_paid',
    label: 'Total Paid',
    category: 'Pipeline & Volume',
    iconName: 'CircleDollarSign',
    iconBg: palette.emerald[50],
    iconColor: 'hsl(var(--success))',
    subtitle: '',
    tooltip: 'Total amount paid to vendors.',
  },
  {
    key: 'scheduled_pending',
    label: 'Scheduled',
    category: 'Pipeline & Volume',
    iconName: 'Clock',
    iconBg: palette.blue[50],
    iconColor: palette.blue[600],
    subtitle: 'Upcoming payments',
    tooltip: 'Payments queued to send on a future date.',
  },
  {
    key: 'largest_payment',
    label: 'Largest Payment',
    category: 'Pipeline & Volume',
    iconName: 'ArrowUpRight',
    iconBg: palette.emerald[50],
    iconColor: 'hsl(var(--success))',
    subtitle: 'Biggest single payment',
    tooltip: 'Your single biggest payment.',
  },
  {
    key: 'smallest_payment',
    label: 'Smallest Payment',
    category: 'Pipeline & Volume',
    iconName: 'ArrowDownRight',
    iconBg: palette.blue[50],
    iconColor: palette.blue[600],
    subtitle: 'Smallest single payment',
    tooltip: 'Your single smallest payment.',
  },

  // Prepayments & Risk
  {
    key: 'prepayments_outstanding',
    label: 'Unapplied Prepayments',
    category: 'Prepayments & Risk' as any,
    iconName: 'Wallet',
    iconBg: palette.amber[50],
    iconColor: palette.amber[700],
    subtitle: 'Available to apply to invoices',
    tooltip: "Money paid to a vendor in advance that isn't applied to an invoice yet.",
  },
  {
    key: 'cancelled',
    // "Void" for payment statuses (feedback 7/22/26): Cancelled is an
    // invoice state; the raw payment status value stays 'Cancelled'.
    label: 'Void',
    category: 'Prepayments & Risk' as any,
    iconName: 'Ban',
    iconBg: palette.red[50],
    iconColor: 'hsl(var(--destructive))',
    subtitle: 'Stopped before sending',
    tooltip: 'Payments voided before they were sent.',
  },
  {
    key: 'reversed',
    label: 'Reversed',
    category: 'Prepayments & Risk' as any,
    iconName: 'RotateCcw',
    iconBg: palette.red[50],
    iconColor: 'hsl(var(--destructive))',
    subtitle: 'Money returned after payment',
    tooltip: 'Payments that failed after sending and were returned.',
  },

  // Cash & Performance
  {
    key: 'top_vendor',
    label: 'Top Vendor by Spend',
    category: 'Cash & Performance',
    iconName: 'Star',
    iconBg: palette.amber[100],
    iconColor: palette.amber[600],
    subtitle: 'Highest-paid vendor',
    tooltip: "The single vendor you've paid the most to this period.",
  },
];

// ─── Range filtering ─────────────────────────────────────────────────────
export type InsightsRange = 'last_7' | 'last_30' | 'last_90' | 'last_365' | 'all_time' | 'custom';
export interface CustomRange { from: string; to: string }

const RANGE_DAYS: Record<InsightsRange, number | null> = {
  last_7: 7,
  last_30: 30,
  last_90: 90,
  last_365: 365,
  all_time: null,
  custom: null,
};

// Custom range: inclusive [from, to] on calendar dates.
function withinCustom(dateStr: string | undefined, custom?: CustomRange): boolean {
  if (!custom?.from || !custom?.to || !dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= custom.from && d <= custom.to;
}

export function filterPaymentsByRange(payments: Payment[], range: InsightsRange, custom?: CustomRange): Payment[] {
  if (range === 'custom') return payments.filter((p) => withinCustom(p.createdDate, custom));
  const days = RANGE_DAYS[range];
  if (days === null) return payments;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return payments.filter((p) => {
    const d = p.createdDate ? new Date(p.createdDate) : null;
    return d ? d >= cutoff : false;
  });
}

export function filterPaymentsByPreviousRange(payments: Payment[], range: InsightsRange): Payment[] {
  const days = RANGE_DAYS[range];
  if (days === null) return []; // all_time + custom: no prior-period comparison
  const end = new Date();
  end.setDate(end.getDate() - days);
  const start = new Date(end);
  start.setDate(end.getDate() - days);
  return payments.filter((p) => {
    const d = p.createdDate ? new Date(p.createdDate) : null;
    return d ? d >= start && d < end : false;
  });
}

// ─── Computation ─────────────────────────────────────────────────────────
export interface KpiDelta {
  text: string;
  tone: 'positive' | 'negative' | 'neutral';
}

export interface ComputedKpi {
  value: string;
  sub: string;
  delta?: KpiDelta;
}

function fmtPctDelta(current: number, previous: number): string {
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  const abs = Math.abs(pct);
  const formatted = abs >= 100 ? abs.toFixed(0) : abs.toFixed(1);
  return `${sign}${formatted}%`;
}

function buildDelta(
  current: number,
  previous: number,
  growthIsGood: boolean
): KpiDelta | undefined {
  if (previous === 0 && current === 0) return undefined;
  // No prior baseline: call it out instead of an unhelpful +∞%.
  if (previous === 0) return { text: 'New', tone: 'neutral' };
  // Dropped to zero is a real −100% move, not "no data".
  if (current === 0) return { text: '−100%', tone: growthIsGood ? 'negative' : 'positive' };
  if (current === previous) return { text: '0%', tone: 'neutral' };
  const isGrowth = current > previous;
  const tone: KpiDelta['tone'] = isGrowth === growthIsGood ? 'positive' : 'negative';
  return { text: fmtPctDelta(current, previous), tone };
}

/* Currency & Exchange Rates: every card is in the base currency, each
   payment converted at its own rate before it is added up (the band's
   "In PKR · base currency" note says so). */
const fmtMoney = (n: number) => formatCompactMoney(n, BASE_CURRENCY);
/** A payment amount (its own currency) in the base currency. */
const inBase = (p: Payment, n: number) => toPaymentBase(p, n);

const sum = (rows: Payment[]) => rows.reduce((s, r) => s + inBase(r, r.amount), 0);
const fmtCount = (n: number, noun = 'payments') => `${n} ${noun}`;
const pmtCount = (n: number) => `${n} payment${n === 1 ? '' : 's'}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-06-18" → "Jun 18" (UTC-safe, avoids TZ off-by-one). */
const fmtShortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}`;
};
/** Money that actually left the bank: posted payments + live advances. */
const cashOutRows = (rows: Payment[]) =>
  rows.filter(
    (p) =>
      (p.type === 'Payment' && p.status === 'Paid') ||
      (p.type === 'Prepayment' && p.status !== 'Cancelled')
  );

export function computePaymentKpi(
  key: string,
  paymentsInRange: Payment[],
  paymentsPrevious: Payment[] = []
): ComputedKpi {
  switch (key) {
    // One primary value per card: money KPIs headline the amount, state KPIs
    // (drafts / cancelled / reversed) headline the count; the counterpart and
    // any anchor detail live in the sub-line.
    case 'total_paid': {
      const rows = paymentsInRange.filter((p) => p.type === 'Payment' && p.status === 'Paid');
      const prev = paymentsPrevious.filter((p) => p.type === 'Payment' && p.status === 'Paid');
      return {
        value: fmtMoney(sum(rows)),
        sub: rows.length === 0 ? 'No payments in this period' : pmtCount(rows.length),
        delta: buildDelta(sum(rows), sum(prev), true),
      };
    }
    case 'scheduled_pending': {
      const rows = paymentsInRange.filter((p) => p.status === 'Scheduled');
      const prev = paymentsPrevious.filter((p) => p.status === 'Scheduled');
      // Earliest UPCOMING payment date for the "next …" caption
      // (9/22/26 review response, Claude C10-D3): "next" means the
      // future — an overdue queued date never reads as next.
      const today = localTodayIso();
      const futureDates = rows.map((p) => p.paymentDate).filter((d) => !!d && d >= today).sort();
      const nextDate = futureDates[0];
      // Queue growing = payment backlog = bad
      return {
        value: fmtMoney(sum(rows)),
        sub: rows.length === 0
          ? 'None scheduled'
          : `${rows.length} queued${nextDate ? ` · next ${fmtShortDate(nextDate)}` : ''}`,
        delta: buildDelta(sum(rows), sum(prev), false),
      };
    }
    case 'prepayments_outstanding': {
      const open = (rows: Payment[]) =>
        rows.filter(
          (p) => p.type === 'Prepayment' && (p.status === 'Unapplied' || p.status === 'Partially Applied')
        );
      const rows = open(paymentsInRange);
      const cur = rows.reduce((s, r) => s + inBase(r, r.unappliedAmount), 0);
      const prev = open(paymentsPrevious).reduce((s, r) => s + inBase(r, r.unappliedAmount), 0);
      // Breakdown (feedback 7/14/26): how much of the credit is anchored to
      // a pre-invoice vs sitting on account as free vendor credit.
      const tied = rows.filter((r) => r.preInvoiceId).reduce((s, r) => s + inBase(r, r.unappliedAmount), 0);
      // Outstanding advances growing = cash parked with vendors = watch it
      return {
        value: fmtMoney(cur),
        sub: rows.length === 0
          ? 'Nothing to apply'
          : `${fmtMoney(tied)} tied to pre-invoices · ${fmtMoney(cur - tied)} on account`,
        delta: buildDelta(cur, prev, false),
      };
    }
    case 'cancelled': {
      const rows = paymentsInRange.filter((p) => p.status === 'Cancelled');
      const prev = paymentsPrevious.filter((p) => p.status === 'Cancelled');
      return {
        value: String(rows.length),
        sub: rows.length === 0 ? 'None this period' : `${fmtMoney(sum(rows))} stopped before sending`,
        delta: buildDelta(rows.length, prev.length, false),
      };
    }
    case 'reversed': {
      const rows = paymentsInRange.filter((p) => p.status === 'Reversed');
      const prev = paymentsPrevious.filter((p) => p.status === 'Reversed');
      return {
        value: String(rows.length),
        sub: rows.length === 0 ? 'None this period' : `${fmtMoney(sum(rows))} returned after sending`,
        delta: buildDelta(rows.length, prev.length, false),
      };
    }
    case 'largest_payment': {
      const rows = paymentsInRange.filter((p) => p.type === 'Payment' && p.status === 'Paid');
      if (rows.length === 0) return { value: '$0', sub: 'No payments in this period' };
      const top = rows.reduce((a, b) => (inBase(b, b.amount) > inBase(a, a.amount) ? b : a));
      return { value: fmtMoney(inBase(top, top.amount)), sub: `${top.vendor} · ${fmtShortDate(top.paymentDate)}` };
    }
    case 'smallest_payment': {
      const rows = paymentsInRange.filter((p) => p.type === 'Payment' && p.status === 'Paid');
      if (rows.length === 0) return { value: '$0', sub: 'No payments in this period' };
      const low = rows.reduce((a, b) => (inBase(b, b.amount) < inBase(a, a.amount) ? b : a));
      return { value: fmtMoney(inBase(low, low.amount)), sub: `${low.vendor} · ${fmtShortDate(low.paymentDate)}` };
    }
    case 'top_vendor': {
      const outRows = cashOutRows(paymentsInRange);
      const grand = sum(outRows);
      const byVendor = new Map<string, number>();
      for (const p of outRows) {
        byVendor.set(p.vendor, (byVendor.get(p.vendor) ?? 0) + inBase(p, p.amount));
      }
      let top: { name: string; total: number } | null = null;
      byVendor.forEach((total, name) => {
        if (!top || total > top.total) top = { name, total };
      });
      if (!top) return { value: 'No vendor yet', sub: 'No cash out in this period' };
      const t = top as { name: string; total: number };
      return { value: t.name, sub: fmtMoney(t.total) };
    }
    default:
      return { value: '$0', sub: '' };
  }
}

export function computePaymentKpiValue(key: string, payments: Payment[]): string {
  return computePaymentKpi(key, payments).value;
}

export function PaymentKpiIcon({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  const props = { className, style };
  switch (name) {
    case 'CreditCard':
      return <CreditCard {...props} />;
    case 'Banknote':
      return <Banknote {...props} />;
    case 'Landmark':
      return <Landmark {...props} />;
    case 'CheckCircle2':
      return <CheckCircle2 {...props} />;
    case 'Ban':
      return <Ban {...props} />;
    case 'AlertTriangle':
      return <AlertTriangle {...props} />;
    case 'CircleDollarSign':
      return <CircleDollarSign {...props} />;
    case 'Calendar':
      return <Calendar {...props} />;
    case 'Wallet':
      return <Wallet {...props} />;
    case 'Clock':
      return <Clock {...props} />;
    case 'TrendingUp':
      return <TrendingUp {...props} />;
    case 'Star':
      return <Star {...props} />;
    case 'DollarSign':
      return <DollarSign {...props} />;
    case 'RotateCcw':
      return <RotateCcw {...props} />;
    case 'ArrowUpRight':
      return <ArrowUpRight {...props} />;
    case 'ArrowDownRight':
      return <ArrowDownRight {...props} />;
    default:
      return <ChartColumn {...props} />;
  }
}

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case 'Pipeline & Volume':
      return <CreditCard className="w-4 h-4 text-muted-foreground" />;
    case 'Application & Risk':
      return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    case 'Cash & Performance':
      return <DollarSign className="w-4 h-4 text-muted-foreground" />;
    default:
      return <ChartColumn className="w-4 h-4 text-muted-foreground" />;
  }
}

interface PaymentInsightsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  payments: Payment[];
}

export function PaymentInsightsPanel({
  open,
  onOpenChange,
  activeKpis,
  onToggleKpi,
  payments,
}: PaymentInsightsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    const cats: { name: string; kpis: PaymentKpiDefinition[] }[] = [];
    const catMap = new Map<string, PaymentKpiDefinition[]>();

    for (const kpi of ALL_PAYMENT_KPI_DEFINITIONS) {
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

  const allActive = ALL_PAYMENT_KPI_DEFINITIONS.every((k) => activeKpis.includes(k.key));

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
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                  Customize Insights
                </h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Choose which KPI cards show in Performance Insights.
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
              {activeCount} of {ALL_PAYMENT_KPI_DEFINITIONS.length} widgets active
            </span>
            <button
              onClick={() => {
                const allKeys = ALL_PAYMENT_KPI_DEFINITIONS.map((k) => k.key);
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
              style={{ fontWeight: 600 }}
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
                  style={{ fontWeight: 600 }}
                >
                  {/* Widget search highlights its matches like every list (10/9/26). */}
                  {highlightText(cat.name, searchQuery)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {cat.kpis.map((kpi) => {
                  const isActive = activeKpis.includes(kpi.key);
                  const value = computePaymentKpiValue(kpi.key, payments);
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
                        style={{ fontWeight: 600 }}
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
