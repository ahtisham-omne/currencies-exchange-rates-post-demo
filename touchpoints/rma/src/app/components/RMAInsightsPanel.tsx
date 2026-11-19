import { returnToBase } from '@/app/currency/returnCurrency';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import { formatCompactMoney } from '@/app/currency/money';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  X,
  Check,
  Plus,
  Sliders,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  ListChecks,
  Timer,
  Gauge,
  Truck,
  Tag,
  Layers,
  Coins,
} from 'lucide-react';
import type { RMA } from '@/app/data/mockRMAs';
import { authorizedQty } from '@/app/data/mockRMAs';
import { rmaScenarioValues } from '@/app/data/rmaGLEntries';
import { palette } from '@/styles/tokens';

/**
 * Right-side "Customize Insights" drawer for the RMA listing. Mirrors
 * InvoiceInsightsPanel visually and behaviourally — backdrop fade,
 * right-slide, header + count + Enable All toggle, search, category-
 * grouped KPI grid where each tile flips active/inactive.
 */

export interface RMAKpiDefinition {
  key: string;
  label: string;
  category: 'Performance' | 'Volume' | 'Composition';
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconBg: string;
  iconColor: string;
  subtitle: string;
  tooltip?: string;
  compute: (rmas: RMA[]) => string;
  /** Subtext that has to name the sample the value was drawn from — a
   *  duration over 3 of 40 returns means something different to one over 38.
   *  Falls back to `subtitle` when the sample never varies. */
  computeSubtitle?: (rmas: RMA[]) => string;
  /** A hover over the value or the subtitle. The money insights have none:
   *  they are in the base currency, plain (Mahreen, 2026-11-20). */
  computeHover?: (rmas: RMA[]) => KpiHover | undefined;
}

export interface KpiHover {
  on: 'value' | 'subtitle';
  /** "£1,200.00 + $5,900.00" */
  split: string;
  note: string;
}

/** A money figure across returns in several currencies, in the base currency:
 *  each return's amount at its receiving-day rate (what its GL Impact carries). */
function inBase(rmas: RMA[], amountOf: (r: RMA) => number): number {
  return Math.round(rmas.reduce((sum, r) => sum + returnToBase(r, amountOf(r)), 0) * 100) / 100;
}

// Days between two ISO date strings (positive integer).
const daysBetween = (a?: string, b?: string): number | null => {
  if (!a || !b) return null;
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (Number.isNaN(t1) || Number.isNaN(t2)) return null;
  return Math.max(0, Math.round((t2 - t1) / 86_400_000));
};


/** Authorized value of one return. Cancelled lines are authorized at zero,
 *  so they fall out of every money figure without being filtered. */
/** The value of the goods on a return, at the price they were authorized at.
 *  What is in transit, rather than what is owed: they are different figures
 *  and only one of them is a claim on a vendor. */
const rmaValue = (r: RMA): number =>
  r.items.reduce((s, li) => s + authorizedQty(li) * li.unitPrice, 0);

/** What a vendor actually owes on a return.
 *
 *  Not the value of the goods: goods that were never billed owe nobody
 *  anything, they just take the accrual off. What is owed is the part that
 *  was paid for, plus the part sitting on an invoice still open. Summing the
 *  whole return read every unpaid delivery as money coming back, and one new
 *  draft moved the card by fourteen thousand dollars. */
const rmaOwedValue = (r: RMA): number => {
  const v = rmaScenarioValues(r);
  return Math.round((v['credit-paid'] + v['credit-unpaid']) * 100) / 100;
};

/** Returns that still owe money back. A Draft is not a claim on anybody yet
 *  -- nothing has been sent, let alone agreed -- and a Closed or Cancelled
 *  return has stopped being outstanding. */
const owedRMAs = (rmas: RMA[]): RMA[] =>
  rmas.filter(
    (r) =>
      r.status !== 'Draft' &&
      r.status !== 'Closed' &&
      r.status !== 'Cancelled' &&
      !r.archived,
  );

/** "Rs8.5M": insights read in the base currency. */
const money = (n: number): string => formatCompactMoney(n, BASE_CURRENCY);

const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Average days between two stamped dates, plus how many returns had both.
 *
 * The dates are written once as the return transitions, the way the PO module
 * stamps its confirmation date, so a state-to-state duration is a subtraction
 * rather than a walk back through the action history. Returns that never
 * reached the later state simply have no second date and are left out.
 */
/** The day a return closed, where it closed rather than being cancelled. */
const closedOn = (r: RMA) => (r.status === 'Closed' ? r.resolvedDate : undefined);

const stageDuration = (
  rmas: RMA[],
  from: (r: RMA) => string | undefined,
  to: (r: RMA) => string | undefined,
): { value: string; counted: number } => {
  const spans = rmas
    .map((r) => daysBetween(from(r), to(r)))
    .filter((d): d is number => d !== null);
  if (spans.length === 0) return { value: '—', counted: 0 };
  const avg = spans.reduce((s, d) => s + d, 0) / spans.length;
  // A whole number of days reads as one: nobody says "ten point zero days".
  const days = Number(avg.toFixed(1));
  return {
    value: `${days} ${days === 1 ? 'day' : 'days'}`,
    counted: spans.length,
  };
};

/** Label of the most frequent key, with its share of the total. */
const topBy = <T extends string>(
  rmas: RMA[],
  keyOf: (r: RMA) => T | undefined,
): { label: T | null; count: number; total: number } => {
  const tally = new Map<T, number>();
  let total = 0;
  for (const r of rmas) {
    const k = keyOf(r);
    if (!k) continue;
    tally.set(k, (tally.get(k) ?? 0) + 1);
    total += 1;
  }
  let label: T | null = null;
  let count = 0;
  tally.forEach((n, k) => {
    if (n > count) {
      count = n;
      label = k;
    }
  });
  return { label, count, total };
};

export const ALL_RMA_KPI_DEFINITIONS: RMAKpiDefinition[] = [
  {
    key: 'total',
    label: 'Returns created',
    category: 'Volume',
    icon: RotateCcw,
    iconBg: palette.blue[50],
    iconColor: palette.blue[600],
    subtitle: 'Created in the selected period',
    tooltip:
      'Returns created in this period, in any state, including Cancelled returns.',
    compute: (rmas) => String(rmas.length),
    computeSubtitle: (rmas) => {
      if (rmas.length === 0) return 'None created in this period';
      const open = rmas.filter(
        (r) => r.status !== 'Closed' && r.status !== 'Cancelled',
      ).length;
      return `${open} of ${rmas.length} still open`;
    },
  },
  {
    key: 'total_return_value',
    label: 'Expected refund value',
    category: 'Performance',
    icon: Coins,
    iconBg: palette.emerald[50],
    iconColor: palette.emerald[700],
    subtitle: 'Authorized value still owed',
    tooltip:
      'What the vendors owe you across the open returns created in this period: the goods that were paid for, plus the goods sitting on an invoice still open. Goods never billed owe nothing, and a draft is not a claim yet, so neither is counted. In PKR, the base currency: each return at its receiving-day rate.',
    compute: (rmas) => money(inBase(owedRMAs(rmas), rmaOwedValue)),
    computeSubtitle: (rmas) => {
      const owed = owedRMAs(rmas);
      if (owed.length === 0) return 'Nothing outstanding';
      return `Across ${plural(owed.length, 'open return')}`;
    },
  },
  {
    key: 'time_to_resolution',
    label: 'Time to close',
    category: 'Performance',
    icon: Timer,
    iconBg: palette.indigo[50],
    iconColor: palette.indigo[600],
    subtitle: 'Average from creation to Closed',
    tooltip:
      'Average number of days from creation to Closed, counting only the returns created in this period that have since closed. Cancelled returns are left out.',
    // `resolvedDate` is stamped on cancel as well as on close, so the end
    // date only counts where the return actually closed. The key stays as
    // it was so saved layouts keep the card.
    compute: (rmas) => stageDuration(rmas, (r) => r.createdDate, closedOn).value,
    computeSubtitle: (rmas) => {
      const { counted } = stageDuration(rmas, (r) => r.createdDate, closedOn);
      if (counted === 0) return 'Nothing closed yet';
      return `Average from creation to Closed · based on ${plural(counted, 'closed RMA')}`;
    },
  },
  {
    key: 'in_shipping',
    label: 'In shipping',
    category: 'Volume',
    icon: Truck,
    iconBg: palette.sky[50],
    iconColor: palette.sky[700],
    subtitle: 'Shipped to the vendor, not yet settled',
    tooltip:
      'Returns shipped to the vendor, waiting on a credit or a refund.',
    compute: (rmas) =>
      String(rmas.filter((r) => r.status === 'Shipped to Vendor').length),
    computeSubtitle: (rmas) => {
      const shipping = rmas.filter((r) => r.status === 'Shipped to Vendor');
      if (shipping.length === 0) return 'Nothing is in transit';
      return `${money(inBase(shipping, rmaValue))} in transit to vendors`;
    },
  },
  {
    key: 'most_common_reason',
    label: 'Most common reason',
    category: 'Composition',
    icon: Tag,
    iconBg: palette.amber[50],
    iconColor: palette.amber[700],
    subtitle: 'Why goods are going back',
    tooltip:
      'The reason recorded most often on returns created in this period.',
    compute: (rmas) => topBy(rmas, (r) => r.reason).label ?? '—',
    computeSubtitle: (rmas) => {
      const { label, count, total } = topBy(rmas, (r) => r.reason);
      if (!label || total === 0) return 'No returns in this period';
      return `${count} of ${total} returns · ${Math.round((count / total) * 100)}%`;
    },
  },
];

function CategoryIcon({ category }: { category: RMAKpiDefinition['category'] }) {
  const props = { className: 'w-4 h-4 text-muted-foreground' };
  switch (category) {
    case 'Volume':
      return <ListChecks {...props} />;
    case 'Performance':
      return <Gauge {...props} />;
    case 'Composition':
      return <Layers {...props} />;
    default:
      return <ListChecks {...props} />;
  }
}

interface RMAInsightsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  rmas: RMA[];
}

export function RMAInsightsPanel({
  open,
  onOpenChange,
  activeKpis,
  onToggleKpi,
  rmas,
}: RMAInsightsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    const cats: { name: string; kpis: RMAKpiDefinition[] }[] = [];
    const catMap = new Map<string, RMAKpiDefinition[]>();
    for (const kpi of ALL_RMA_KPI_DEFINITIONS) {
      const matches =
        !searchQuery ||
        kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kpi.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (matches) {
        if (!catMap.has(kpi.category)) catMap.set(kpi.category, []);
        catMap.get(kpi.category)!.push(kpi);
      }
    }
    catMap.forEach((kpis, name) => cats.push({ name, kpis }));
    return cats;
  }, [searchQuery]);

  const activeCount = activeKpis.length;
  const allActive = ALL_RMA_KPI_DEFINITIONS.every((k) => activeKpis.includes(k.key));

  // Mount / unmount animation timing — copied verbatim from
  // InvoiceInsightsPanel so the drawer glides in the same way.
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

  return (
    <>
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{
          backgroundColor: visible ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0)',
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-0 shrink-0">
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
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeCount} of {ALL_RMA_KPI_DEFINITIONS.length} widgets active
            </span>
            <button
              onClick={() => {
                const allKeys = ALL_RMA_KPI_DEFINITIONS.map((k) => k.key);
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
        <div className="px-5 pt-3.5 pb-0 shrink-0">
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

        <div className="border-b border-muted mt-3 shrink-0" />

        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {categories.length === 0 && (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground/60">No metrics found</p>
            </div>
          )}
          {categories.map((cat) => (
            <div key={cat.name} className="mt-5 first:mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <CategoryIcon category={cat.name as RMAKpiDefinition['category']} />
                <span
                  className="text-[12px] text-muted-foreground/70 uppercase tracking-wide"
                  style={{ fontWeight: 600 }}
                >
                  {cat.name}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {cat.kpis.map((kpi) => {
                  const isActive = activeKpis.includes(kpi.key);
                  const value = kpi.compute(rmas);
                  return (
                    <button
                      key={kpi.key}
                      onClick={() => onToggleKpi(kpi.key)}
                      className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                        isActive
                          ? 'border-primary/25 bg-primary/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]'
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
                          {kpi.label}
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
