import { useState, useMemo, useEffect, useRef } from 'react';
import { isInvoiceOverdue } from '@/app/lib/dueBucket';
import type { CSSProperties } from 'react';
import {
  Search,
  ChartColumn,
  Receipt,
  AlertTriangle,
  CircleDollarSign,
  Calendar,
  Wallet,
  Clock,
  TrendingUp,
  Star,
  Lock,
  X,
  Check,
  Plus,
  Sliders,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Globe,
  Users,
} from 'lucide-react';
import type { Invoice } from '@/app/data/mockInvoices';
import { palette } from '@/styles/tokens';
import { highlightText } from '@/app/components/InvoiceDataTable';

export interface InvoiceKpiDefinition {
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

export const ALL_INVOICE_KPI_DEFINITIONS: InvoiceKpiDefinition[] = [
  // Pipeline & Volume
  {
    key: 'total_invoices',
    label: 'Invoices in This Period',
    category: 'Pipeline & Volume',
    iconName: 'Receipt',
    iconBg: 'hsl(var(--accent))',
    iconColor: 'hsl(var(--primary))',
    subtitle: 'All invoices in the period',
    tooltip: 'Vendor invoices received in this period.',
  },
  {
    key: 'pending_review',
    label: 'Pending Approval',
    category: 'Pipeline & Volume',
    iconName: 'AlertTriangle',
    iconBg: palette.orange[50],
    iconColor: palette.orange[600],
    subtitle: 'Awaiting approver action',
    tooltip: 'Invoices waiting to be approved.',
  },
  // "Awaiting payment" KPI removed (user 10/4): it duplicated the
  // Ready-to-pay figure in Vendor Payments. Stale persisted keys fall
  // through the active-keys filter harmlessly.
  {
    key: 'paid_in_full',
    label: 'Paid in Full',
    category: 'Pipeline & Volume',
    iconName: 'CircleDollarSign',
    iconBg: palette.emerald[50],
    iconColor: 'hsl(var(--success))',
    subtitle: 'Fully paid invoices',
    tooltip: "Invoices you've paid off completely.",
  },

  // Exceptions & Risk
  {
    key: 'exceptions_open',
    label: 'Open Exceptions',
    category: 'Exceptions & Risk',
    iconName: 'AlertTriangle',
    iconBg: palette.red[50],
    iconColor: 'hsl(var(--destructive))',
    subtitle: 'Unresolved exceptions',
    // One sentence, no example (user 10/4).
    tooltip: "Invoices that won't post to the general ledger until the exception is fixed.",
  },
  {
    key: 'overdue',
    label: 'Overdue',
    category: 'Exceptions & Risk',
    iconName: 'Calendar',
    iconBg: palette.rose[50],
    iconColor: palette.rose[600],
    subtitle: 'Past due, not fully paid',
    tooltip: 'Approved invoices past their payment due date.',
  },
  {
    key: 'payment_hold',
    label: 'Payment Hold',
    category: 'Exceptions & Risk',
    iconName: 'Lock',
    iconBg: palette.amber[50],
    iconColor: palette.amber[700],
    subtitle: 'Held from payment runs',
    // One sentence, no example (user 10/4).
    tooltip: "Invoices you can't pay until the hold is released.",
  },

  // Cash & Performance
  {
    key: 'total_outstanding',
    label: 'Total Outstanding',
    category: 'Cash & Performance',
    iconName: 'Wallet',
    iconBg: palette.red[50],
    iconColor: 'hsl(var(--destructive))',
    subtitle: 'Everything still owed',
    // One sentence, no calculation (user 10/4).
    tooltip: 'What you still owe on unpaid and partially paid invoices.',
  },
  {
    key: 'top_vendor',
    label: 'Top Vendor by Spend',
    category: 'Cash & Performance',
    iconName: 'Star',
    iconBg: palette.amber[100],
    iconColor: palette.amber[600],
    subtitle: 'Highest-spend vendor',
    tooltip: "The vendor you've paid the most in this period.",
  },
];

// ─── Range filtering ─────────────────────────────────────────────────────
//
// The Performance Insights date-range dropdown narrows the KPI dataset to
// invoices whose createdDate falls within the chosen window. "All time"
// returns every row.
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

function withinCustom(dateStr: string | undefined, custom?: CustomRange): boolean {
  if (!custom?.from || !custom?.to || !dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= custom.from && d <= custom.to;
}

export function filterInvoicesByRange(invoices: Invoice[], range: InsightsRange, custom?: CustomRange): Invoice[] {
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
export function filterInvoicesByPreviousRange(invoices: Invoice[], range: InsightsRange): Invoice[] {
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
// Returns the formatted display value plus a one-line subtitle that puts
// the headline in context — count, ratio, or qualifier. The card consumer
// renders { value } as the headline and { sub } as a small muted line below
// (mirrors partners' detail-page KPI pattern).
export interface KpiDelta {
  /** Display string e.g. "+12%", "−8%", "−$240". */
  text: string;
  /** Drives the prefix color — semantic up/down for the metric. */
  tone: 'positive' | 'negative' | 'neutral';
}

export interface ComputedKpi {
  value: string;
  /** Optional sub-line; zero-state cards omit it (UX copy spec 7/8/26). */
  sub?: string;
  /** Optional period-over-period delta shown as a colored prefix. */
  delta?: KpiDelta;
}

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
 * Compute a count delta only when a real percentage change can be expressed.
 * Tone follows whether growth is good or bad for the metric (e.g. growth in
 * Total Invoices is positive, but a rise in Overdue is negative).
 *
 * Skipped (no delta rendered) when:
 *  - both periods are zero (genuinely nothing to say)
 *  - either side is zero (a "+new" or "−100%" label was confusing — user feedback)
 */
function buildDelta(
  current: number,
  previous: number,
  growthIsGood: boolean
): KpiDelta | undefined {
  if (previous === 0 || current === 0) return undefined;
  if (current === previous) return { text: '0%', tone: 'neutral' };
  const isGrowth = current > previous;
  const tone: KpiDelta['tone'] =
    isGrowth === growthIsGood ? 'positive' : 'negative';
  return { text: fmtPctDelta(current, previous), tone };
}

const fmtMoney = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
    : n >= 1000
      ? `$${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}K`
      : `$${Math.round(n).toLocaleString('en-US')}`;

const sum = (rows: Invoice[]) => rows.reduce((s, r) => s + r.amount, 0);
const outstanding = (rows: Invoice[]) => rows.reduce((s, r) => s + r.outstandingBalance, 0);
// Singular when there's exactly one (copy audit: "1 invoices" read wrong).
const fmtCount = (n: number, noun = 'invoices') =>
  `${n} ${n === 1 ? (noun.endsWith('s') ? noun.slice(0, -1) : noun) : noun}`;

export function computeInvoiceKpi(
  key: string,
  invoicesInRange: Invoice[],
  invoicesPrevious: Invoice[] = [],
  // Live-state KPIs (overdue, outstanding, pending, holds…) must mirror
  // what the listing table shows RIGHT NOW, so they read the full dataset
  // rather than the created-date range slice. Flow KPIs (total invoices,
  // paid in full, averages, top vendor) stay period-scoped.
  allInvoices: Invoice[] = invoicesInRange,
): ComputedKpi {
  switch (key) {
    // Per BA: count as the headline, money smaller below (was the
    // other way around on every money-led card).
    case 'total_invoices': {
      const value = sum(invoicesInRange);
      // Falling invoice volume isn't inherently bad, so render this delta as a
      // neutral movement indicator rather than red/green.
      const d = buildDelta(value, sum(invoicesPrevious), true);
      return {
        value: fmtCount(invoicesInRange.length),
        sub: `${fmtMoney(value)} invoiced`,
        delta: d ? { ...d, tone: 'neutral' } : undefined,
      };
    }
    case 'pending_review': {
      // Live state — every invoice currently awaiting approval.
      const rows = allInvoices.filter((i) => i.status === 'Pending Approval');
      return {
        value: fmtCount(rows.length),
        sub: rows.length === 0 ? undefined : `${fmtMoney(sum(rows))} awaiting`,
      };
    }
    // 'approved_unpaid' removed (user 10/4): Vendor Payments' Ready to
    // pay already carries this figure.
    case 'paid_in_full': {
      const rows = invoicesInRange.filter((i) => i.status === 'Paid in Full');
      const prev = invoicesPrevious.filter((i) => i.status === 'Paid in Full');
      return {
        value: fmtCount(rows.length),
        sub: rows.length === 0 ? undefined : fmtMoney(sum(rows)),
        delta: buildDelta(sum(rows), sum(prev), true),
      };
    }
    case 'exceptions_open': {
      // Live state — exceptions currently open. Count on top, money
      // underneath — the one shape every card wears (user 9/28).
      const rows = allInvoices.filter((i) => i.status === 'Exception');
      return {
        value: fmtCount(rows.length),
        sub: rows.length === 0 ? 'No exceptions' : `${fmtMoney(sum(rows))} at risk`,
      };
    }
    case 'overdue': {
      // The card counts EXACTLY what its tooltip promises (9/22/26 review
      // response): approved-and-owing past the due date, plus any live
      // pre-invoice past due with a balance (VI-32). One shared predicate
      // with the listing rows, so they can never disagree.
      const rows = allInvoices.filter(isInvoiceOverdue);
      // Count on top, money underneath (user 9/28, superseding the
      // money-led 9/22 copy spec): every KPI card wears the same shape.
      return {
        value: fmtCount(rows.length),
        sub: rows.length === 0 ? 'On Time' : `${fmtMoney(outstanding(rows))} past due`,
      };
    }
    case 'payment_hold': {
      // Live state — holds currently in force. Count on top, money
      // underneath (user 9/28).
      // Hold is a flag beside any status (ERP-8796).
      const rows = allInvoices.filter((i) => i.is_payment_held && !i.isArchived && i.status !== 'Cancelled');
      return {
        value: fmtCount(rows.length),
        sub: rows.length === 0 ? undefined : `${fmtMoney(sum(rows))} held`,
      };
    }
    case 'total_outstanding': {
      // Per BA: "everything still owed until it's paid or rejected"
      // — Pending Approval invoices now count alongside Approved and
      // Partially Paid. Removes the linguistic collision with the
      // (now-renamed) "Ready to Pay" card, which stays a subset of
      // this number minus the Pending Approval slice.
      // Live state — the balance owed right now across the whole ledger.
      const inScope = ['Pending Approval', 'Approved', 'Partially Paid', 'Partially Prepaid'];
      const rows = allInvoices.filter((i) => inScope.includes(i.status));
      // Count on top, money underneath (user 9/28, superseding the
      // money-led 9/22 copy spec).
      return {
        value: fmtCount(rows.length),
        sub: `${fmtMoney(outstanding(rows))} outstanding`,
      };
    }
    case 'top_vendor': {
      const byVendor = new Map<string, number>();
      for (const inv of invoicesInRange) {
        byVendor.set(inv.vendor, (byVendor.get(inv.vendor) ?? 0) + inv.amount);
      }
      let top: { name: string; total: number } | null = null;
      byVendor.forEach((total, name) => {
        if (!top || total > top.total) top = { name, total };
      });
      if (!top) return { value: '—', sub: 'No invoices' };
      const t = top as { name: string; total: number };
      return { value: t.name, sub: `${fmtMoney(t.total)} in the selected period` };
    }
    default:
      return { value: '—', sub: '' };
  }
}

// Back-compat shim — old call sites still call computeInvoiceKpiValue and
// only want the formatted headline string. Forward to computeInvoiceKpi.
export function computeInvoiceKpiValue(key: string, invoices: Invoice[]): string {
  return computeInvoiceKpi(key, invoices).value;
}

export function InvoiceKpiIcon({
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
    case 'Receipt':
      return <Receipt {...props} />;
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
    case 'Lock':
      return <Lock {...props} />;
    case 'DollarSign':
      return <DollarSign {...props} />;
    default:
      return <ChartColumn {...props} />;
  }
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

interface InvoiceInsightsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  invoices: Invoice[];
  /** The full, unfiltered dataset (VI-33): live-state KPIs (pending,
   *  overdue, exception, holds) read this so a preview equals the band's
   *  card instead of the created-date range slice. Defaults to `invoices`. */
  allInvoices?: Invoice[];
}

export function InvoiceInsightsPanel({
  open,
  onOpenChange,
  activeKpis,
  onToggleKpi,
  invoices,
  allInvoices,
}: InvoiceInsightsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    const cats: { name: string; kpis: InvoiceKpiDefinition[] }[] = [];
    const catMap = new Map<string, InvoiceKpiDefinition[]>();

    for (const kpi of ALL_INVOICE_KPI_DEFINITIONS) {
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

  const allActive = ALL_INVOICE_KPI_DEFINITIONS.every((k) => activeKpis.includes(k.key));

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
              {activeCount} of {ALL_INVOICE_KPI_DEFINITIONS.length} widgets active
            </span>
            <button
              onClick={() => {
                const allKeys = ALL_INVOICE_KPI_DEFINITIONS.map((k) => k.key);
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
                  // Preview matches the real card (VI-33): headline value AND
                  // the sub line, computed from the same sources the band
                  // uses — the range slice for flow KPIs and the full dataset
                  // for live-state KPIs (pending, overdue, holds).
                  const { value, sub } = computeInvoiceKpi(kpi.key, invoices, [], allInvoices ?? invoices);
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
                      {sub && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate" style={{ fontWeight: 500 }} title={sub}>
                          {sub}
                        </p>
                      )}
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
