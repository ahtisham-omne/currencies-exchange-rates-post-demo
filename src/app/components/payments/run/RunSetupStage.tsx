import type { DataTableEmptyConfig } from '@/app/components/data-table/DataTable';
import { toast } from 'sonner';
import { useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import type { DateRange } from 'react-day-picker';
import {
  BadgePercent,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Hourglass,
  Layers,
  Receipt,
  Rows3,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type { Invoice } from '@/app/data/mockInvoices';
import type { PaymentRun, PaymentRunLine } from '@/app/data/paymentRuns';
import type { PaymentRunsApi } from '@/app/hooks/usePaymentRuns';
import {
  discountAmountOn,
  discountDaysLeft,
  discountIsLive,
  discountTermsFor,
  eligibleInvoices,
  invoiceTypeLabel,
  isClosedPeriod,
  type EligibleRow,
} from '@/app/lib/runMath';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { AGING_BUCKETS, OVERDUE_BUCKET_LABELS, localTodayIso, overdueDaysOf, overdueLabel } from '@/app/lib/dueBucket';
import { VendorCell, highlightText, highlightAmount, renderType } from '@/app/components/InvoiceDataTable';
import { rowMatchesColumns } from '@/app/components/data-table/tableSearch';
import { DateCalendar } from '@/app/components/ui/date-picker';
import { DateRangePanel } from '@/app/components/data-table/DateRangePanel';
import { Input } from '@/app/components/ui/input';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Button } from '@/app/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { DataTable } from '@/app/components/data-table/DataTable';
import { AmountWithPrepaidNote, prepaidTotalOf } from '@/app/components/payments/PrepaidOriginNote';
import { applyColumnFilters } from '@/app/components/data-table/applyColumnFilters';
import type { ColumnDef, ColumnFilterState, SortConfig } from '@/app/components/data-table/types';
import { money, humanDate, openInvoiceTab, DueDatePill, RUN_FOOTER_FLUSH, FOOTER_BTN_GHOST, FOOTER_BTN_PRIMARY } from './runUi';
import { MoneyInput } from '@/app/components/payments/MoneyInput';

/* ── Group total (Eli 10/5) ───────────────────────────────────────────
 * The per-vendor (or per-band) total rides the RIGHT edge of the group
 * band, landing over the pinned Amount Due column so it reads as the sum
 * of the rows beneath it — not as the run-wide selected total (that one
 * lives bold + boxed in the footer). The hover restates the vendor and
 * spells out due vs. selected so the two totals can never be confused. */
function GroupAmountTotal({
  label,
  count,
  total,
  selCount,
  selTotal,
}: {
  label: string;
  count: number;
  total: number;
  selCount: number;
  selTotal: number;
}) {
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <HoverCard openDelay={150} closeDelay={80}>
        <HoverCardTrigger asChild>
          <span className="inline-flex items-baseline gap-2 cursor-help whitespace-nowrap">
            <span className="text-[9.5px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Total Amount Due</span>
            <span className="text-[12.5px] text-slate-700" style={{ fontWeight: 700 }}>{money(total)}</span>
            {selCount > 0 && (
              <span className="text-[11px] text-primary border-l border-slate-300 pl-2" style={{ fontWeight: 600 }}>
                {money(selTotal)} selected
              </span>
            )}
          </span>
        </HoverCardTrigger>
        <HoverCardContent side="left" align="center" sideOffset={8} className="w-[248px] p-3 rounded-xl border border-border shadow-lg bg-white z-[260]">
          <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{label}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Total across the {count} invoice{count === 1 ? '' : 's'} below.
          </p>
          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <span className="text-slate-500">Amount Due</span>
              <span className="text-slate-700" style={{ fontWeight: 600 }}>{money(total)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11.5px] pt-1.5 border-t border-slate-200/70">
              <span className="text-slate-500">You've Selected</span>
              <span className="text-primary" style={{ fontWeight: 600 }}>
                {selCount > 0 ? `${money(selTotal)} · ${selCount} of ${count}` : 'Nothing yet'}
              </span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </span>
  );
}

/* ── Grouping (Eli 9/25) ──────────────────────────────────────────────
 * Cluster the pool by vendor, due-date urgency, or amount band. groupRank
 * gives a sortable key so same-group rows sit adjacent; groupMeta names
 * the band the DataTable draws above each cluster. */
type GroupKey = 'none' | 'vendor' | 'dueDate' | 'amount' | 'discount';
const GROUP_OPTIONS: { key: GroupKey; label: string }[] = [
  { key: 'none', label: 'No Grouping' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'amount', label: 'Amount Due' },
  // Discount band (user 10/5): early-pay rows cluster on top so the
  // money-saving picks are one glance.
  { key: 'discount', label: 'Discount' },
];
const AMOUNT_BANDS = [
  { max: 5000, label: 'Under $5,000' },
  { max: 25000, label: '$5,000 to $25,000' },
  { max: 50000, label: '$25,000 to $50,000' },
  { max: Infinity, label: '$50,000 and Up' },
];
const amountBandIdx = (n: number) => AMOUNT_BANDS.findIndex((b) => n < b.max);
const dueBandOf = (iso: string): { idx: number; label: string } => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(`${iso}T00:00:00`);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { idx: 0, label: 'Overdue' };
  if (days === 0) return { idx: 1, label: 'Due Today' };
  if (days <= 7) return { idx: 2, label: 'Due This Week' };
  if (days <= 30) return { idx: 3, label: 'Due This Month' };
  return { idx: 4, label: 'Later' };
};
// Discount liveness for grouping — measured against the run's payment
// date, same reference the Discount column uses.
const hasLiveDiscount = (r: EligibleRow, paymentDate: string): boolean => {
  const terms = discountTermsFor(r.invoice);
  return !!terms && discountIsLive(terms, paymentDate);
};
const groupRank = (r: EligibleRow, key: GroupKey, paymentDate: string): string => {
  if (key === 'vendor') return r.invoice.vendor.toLowerCase();
  if (key === 'dueDate') return String(dueBandOf(r.invoice.dueDate).idx);
  if (key === 'amount') return String(amountBandIdx(r.invoice.outstandingBalance));
  if (key === 'discount') return hasLiveDiscount(r, paymentDate) ? '0' : '1';
  return '';
};
const groupMetaOf = (r: EligibleRow, key: GroupKey, paymentDate: string): { id: string; label: string } => {
  if (key === 'vendor') return { id: `v-${r.invoice.vendor}`, label: r.invoice.vendor };
  if (key === 'dueDate') { const b = dueBandOf(r.invoice.dueDate); return { id: `d-${b.idx}`, label: b.label }; }
  if (key === 'amount') { const i = amountBandIdx(r.invoice.outstandingBalance); return { id: `a-${i}`, label: AMOUNT_BANDS[i].label }; }
  if (key === 'discount') {
    return hasLiveDiscount(r, paymentDate)
      ? { id: 'disc-1', label: 'Early-Pay Discount Available' }
      : { id: 'disc-0', label: 'No Discount' };
  }
  return { id: 'all', label: 'All' };
};

/* ── P1 · Parameters (payment-run-flow.md) ───────────────────────────
 * The run starts from criteria, not a vendor: set the payment date, set
 * the filters, and the system returns matching APPROVED invoices. Tick
 * what to pay; the footer just counts the selection (the per-account
 * cash readout lives on the proposal). Vendor is an optional filter.
 * Method and pay-from account are NOT set here; each vendor carries
 * its own into the proposal.
 *
 * Visual language (8/4/26): the Record Payment flow's Step 1 recipe,
 * verbatim — segmented search bar up top, popover filter chips below
 * with a right-aligned Reset, then the list under a light header. The
 * stage renders FLUSH against the modal shell (PaymentRunScreen skips
 * the slate canvas for P1): no inner card, no boxed section. */

/** The Record Payment chip recipe: h-8 rounded-lg, primary tint when
 *  the filter is live, rose when the value is invalid. */
const chipClass = (active: boolean, danger = false) =>
  `inline-flex items-center gap-2 h-8 px-3 bg-white border rounded-lg transition-colors text-[12px] cursor-pointer ${
    danger
      ? 'border-rose-300 text-rose-700'
      : active
        ? 'border-primary/30 text-foreground'
        : 'border-border text-slate-600 hover:border-slate-300'
  }`;
const chipIconClass = (active: boolean, danger = false) =>
  `w-3.5 h-3.5 ${danger ? 'text-rose-500' : active ? 'text-primary' : 'text-slate-400'}`;
const POPOVER_SHADOW = { boxShadow: '0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' };

// "Due by" preset windows (8/10/26, flipped forward): invoices coming
// due within the NEXT N days, plus Custom for an explicit window. The
// past belongs to the Overdue filter, not this one.
const DUE_PRESETS = [7, 14, 30, 60, 90] as const;

// The pool table IS the listing DataTable (8/28/26 review): same header
// menus, resize, reorder, freeze, and column filters as every listing
// page. Invoice stays frozen LEFT, Amount Due pinned RIGHT, everything
// between scrolls horizontally.
const STEP1_COLUMN_ORDER = ['invoice', 'type', 'vendor', 'invoiceDate', 'dueDate', 'discount', 'amount'];

/** The type filter's fixed option order, the creation-flow taxonomy. */
const TYPE_FAMILIES = ['Inventory Invoice', 'Pre-Invoice', 'Standalone Invoice'] as const;

export function RunSetupStage({
  run,
  invoices,
  runsApi,
  onCancel,
}: {
  run: PaymentRun;
  invoices: Invoice[];
  runsApi: PaymentRunsApi;
  onCancel: () => void;
}) {
  // Segmented search (invoice / vendor), the Record Payment bar.
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [vendorQuery, setVendorQuery] = useState('');
  const [activePopover, setActivePopover] = useState<null | 'payDate' | 'due' | 'aging' | 'type' | 'vendor' | 'amount' | 'discount' | 'group'>(null);
  const [vendorFilterSearch, setVendorFilterSearch] = useState('');
  // "Due by" popover: draft range for the global DateRangePanel (the
  // listing calendar, 8/12/26). Nothing applies until Apply.
  const [dueDraft, setDueDraft] = useState<DateRange | undefined>(undefined);
  const [dueCustomArmed, setDueCustomArmed] = useState(false);
  // "Amount due" popover draft (8/12/26): the range only hits the list
  // on Apply, never while typing.
  const [amountDraft, setAmountDraft] = useState<{ min?: number; max?: number }>({});
  // DataTable-controlled table state (8/28/26, the listing recipe):
  // order, visibility, per-column filters, frozen set, sort. Invoice is
  // locked + frozen left; Amount Due is locked + pinned right.
  const [columnOrder, setColumnOrder] = useState<string[]>([...STEP1_COLUMN_ORDER]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(() => new Set(['invoice']));
  // Due date ascending stays the default, most overdue first.
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'dueDate', direction: 'asc' });
  // Group the pool by a dimension (Eli 9/25): the DataTable draws a band
  // per group; the column sort stays the within-group order.
  const [groupByKey, setGroupByKey] = useState<GroupKey>('none');

  const todayIso = localTodayIso();
  const closedPeriod = isClosedPeriod(run.paymentDate);

  // The query result. Ticked lines survive filter changes (a tick is an
  // explicit decision); the filters only shape what's listed. Invoices
  // whose vendor has no payment method are hidden for now (8/4/26)
  // instead of listed greyed out.
  const rows = useMemo(
    () => eligibleInvoices(invoices, runsApi.runs, run.id, run.filters, run.paymentDate).filter((r) => !r.noPaymentMethod),
    [invoices, runsApi.runs, run.id, run.filters, run.paymentDate],
  );
  // Live early-pay discount dollars for a row, measured against the
  // run's payment date (8/28/26) — feeds the Discount column and sort.
  const liveDiscountOf = (r: EligibleRow): number => {
    const terms = discountTermsFor(r.invoice);
    return terms && discountIsLive(terms, run.paymentDate)
      ? discountAmountOn(r.invoice.outstandingBalance, terms)
      : 0;
  };
  // Raw value per column key — shared by the header filters and sort.
  const colValue = (r: EligibleRow, key: string): string | number => {
    switch (key) {
      case 'invoice': return r.invoice.invoiceNumber;
      case 'type': return invoiceTypeLabel(r.invoice.type);
      case 'vendor': return r.invoice.vendor;
      case 'invoiceDate': return r.invoice.invoiceDate;
      case 'dueDate': return r.invoice.dueDate;
      case 'discount': return liveDiscountOf(r);
      case 'amount': return r.invoice.outstandingBalance;
      default: return '';
    }
  };

  // Amount column width follows the DATA (8/28/26): sized to the longest
  // formatted amount plus cell padding, with extra room when any row
  // carries the inline prepaid icon so "$X [icon]" stays on one line
  // (user 10/5). Left-aligned now, so the figure never clips.
  const amountWidth = useMemo(() => {
    const maxLen = rows.reduce((m, r) => Math.max(m, money(r.invoice.outstandingBalance).length), 0);
    const hasPrepaid = rows.some((r) => prepaidTotalOf(r.invoice) > 0.004);
    const base = Math.round(maxLen * 7.5) + 56 + (hasPrepaid ? 28 : 0);
    return Math.min(220, Math.max(132, base));
  }, [rows]);

  // Column defs — renderers ported 1:1 from the old handmade table.
  const runColumns = useMemo<ColumnDef<EligibleRow>[]>(() => [
    {
      key: 'invoice',
      label: 'Invoice ID',
      minWidth: 120,
      defaultWidth: 150,
      locked: true,
      sticky: 'left',
      sortable: true,
      filterable: false,
      getValue: (r) => r.invoice.invoiceNumber,
      render: (r, { searchQuery }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openInvoiceTab(r.invoice.invoiceNumber);
          }}
          className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors cursor-pointer p-0 bg-transparent border-0 whitespace-nowrap"
          style={{ fontWeight: 500 }}
        >
          {highlightText(r.invoice.invoiceNumber, searchQuery)}
        </button>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      minWidth: 170,
      defaultWidth: 210,
      sortable: true,
      filterType: 'multiselect',
      uniqueValues: (list) => [...new Set(list.map((r) => invoiceTypeLabel(r.invoice.type)))],
      getValue: (r) => invoiceTypeLabel(r.invoice.type),
      render: (r, { searchQuery }) => <span className="whitespace-nowrap">{renderType(r.invoice.type, searchQuery)}</span>,
    },
    {
      key: 'vendor',
      label: 'Vendor',
      minWidth: 170,
      defaultWidth: 200,
      flex: true,
      sortable: true,
      filterType: 'text',
      getValue: (r) => r.invoice.vendor,
      render: (r, { searchQuery }) => (
        <span className="inline-flex w-fit max-w-full" onClick={(e) => e.stopPropagation()}>
          {/* Marks the vendor search, or the invoice search when it found the vendor. */}
          <VendorCell vendor={r.invoice.vendor} density="condensed" searchQuery={vendorQuery.trim() ? vendorQuery : searchQuery} />
        </span>
      ),
    },
    {
      key: 'invoiceDate',
      label: 'Vendor Invoice Date',
      minWidth: 140,
      defaultWidth: 180,
      sortable: true,
      filterType: 'date',
      getValue: (r) => r.invoice.invoiceDate,
      searchText: (r) => (r.invoice.invoiceDate ? humanDate(r.invoice.invoiceDate) : ''),
      render: (r, { searchQuery }) => <span className="text-slate-600 whitespace-nowrap">{highlightText(humanDate(r.invoice.invoiceDate), searchQuery)}</span>,
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      minWidth: 200,
      defaultWidth: 250,
      sortable: true,
      filterType: 'date',
      getValue: (r) => r.invoice.dueDate,
      // One segmented pill (8/28/26 review): date + urgency in the
      // payment-term pill's two-segment recipe.
      searchText: (r) => `${humanDate(r.invoice.dueDate)} ${overdueLabel(overdueDaysOf(r.invoice.dueDate))}`,
      render: (r, { searchQuery }) => <DueDatePill dueDate={r.invoice.dueDate} searchQuery={searchQuery} />,
    },
    {
      key: 'discount',
      label: 'Discount',
      minWidth: 120,
      defaultWidth: 160,
      sortable: true,
      filterable: false,
      getValue: (r) => liveDiscountOf(r),
      // What the pill prints; nothing when the cell is empty.
      searchText: (r) => {
        const terms = discountTermsFor(r.invoice);
        if (!terms || !discountIsLive(terms, run.paymentDate)) return '';
        return `${terms.percent}% · −${money(discountAmountOn(r.invoice.outstandingBalance, terms))}`;
      },
      // Early-pay discount, measured against the run's PAYMENT date
      // (8/28/26): what you'd actually save if the money moves that
      // day. Hover explains the terms, deadline and days left.
      render: (r, { searchQuery }) => {
        const inv = r.invoice;
        const terms = discountTermsFor(inv);
        const live = discountIsLive(terms, run.paymentDate);
        if (!terms || !live) return null;
        const discount = discountAmountOn(inv.outstandingBalance, terms);
        const daysLeft = discountDaysLeft(terms, run.paymentDate);
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <HoverCard openDelay={150} closeDelay={80}>
              <HoverCardTrigger asChild>
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] cursor-help whitespace-nowrap"
                  style={{ fontWeight: 600 }}
                >
                  {highlightText(`${terms.percent}% · −`, searchQuery)}{highlightAmount(money(discount), searchQuery)}
                </span>
              </HoverCardTrigger>
              <HoverCardContent side="top" align="end" className="w-[280px] p-3 rounded-xl border border-border shadow-lg bg-white z-[260]">
                <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                  Early-Pay Discount, {terms.label}
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                  Pay by {humanDate(terms.deadline)} and take {terms.percent}% off. On this balance that's{' '}
                  <span className="text-emerald-700" style={{ fontWeight: 600 }}>{money(discount)}</span>, so you'd pay{' '}
                  <span style={{ fontWeight: 600 }}>{money(inv.outstandingBalance - discount)}</span> instead of {money(inv.outstandingBalance)}.
                </p>
                <p className="text-[11px] mt-1.5" style={{ fontWeight: 600, color: daysLeft <= 2 ? '#B45309' : '#047857' }}>
                  {daysLeft === 0 ? 'Payment date is the last day of the window.' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left at the current payment date.`}
                </p>
              </HoverCardContent>
            </HoverCard>
          </span>
        );
      },
    },
    {
      key: 'amount',
      label: 'Amount Due',
      minWidth: 140,
      defaultWidth: amountWidth,
      locked: true,
      sticky: 'right',
      // Right-aligned (user 10/5, final): header label + figures share the
      // right edge; the prepaid icon sits to the LEFT of the amount, so the
      // row reads "[icon] $45,202.50" flush right on one line.
      align: 'right',
      sortable: true,
      filterType: 'range',
      getValue: (r) => r.invoice.outstandingBalance,
      searchText: (r) => money(r.invoice.outstandingBalance),
      // Prepaid-origin note (9/2/26): the $70 remainder of a $100
      // invoice says where the other $30 went, right in the pool.
      render: (r, { searchQuery }) => (
        <AmountWithPrepaidNote invoice={r.invoice}>
          <span className="text-slate-600 whitespace-nowrap">{highlightAmount(money(r.invoice.outstandingBalance), searchQuery)}</span>
        </AmountWithPrepaidNote>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [vendorQuery, run.paymentDate, amountWidth]);

  const visibleRows = useMemo(() => {
    const qi = invoiceQuery.trim().toLowerCase();
    const qv = vendorQuery.trim().toLowerCase();
    let filtered = !qi && !qv
      ? rows
      : rows.filter((r) => {
          // The invoice search also reads every column, shown or not, by
          // what its cell prints (10/14/26).
          if (
            qi &&
            !r.invoice.invoiceNumber.toLowerCase().includes(qi) &&
            !r.invoice.vendorInvoiceNumber.toLowerCase().includes(qi) &&
            !rowMatchesColumns(r, runColumns, invoiceQuery.trim())
          ) return false;
          if (qv && !r.invoice.vendor.toLowerCase().includes(qv)) return false;
          return true;
        });
    // Header column filters (the listing recipe) stack on the chips.
    filtered = applyColumnFilters(filtered, Object.values(columnFilters), colValue);
    // Header-driven sort; due date ascending is the default, most
    // overdue first, the payables priority.
    const cfg = sortConfig ?? { key: 'dueDate', direction: 'asc' as const };
    const mul = cfg.direction === 'asc' ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      const va = colValue(a, cfg.key);
      const vb = colValue(b, cfg.key);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return cmp * mul;
    });
    // Grouping (Eli 9/25): a stable pre-sort by the chosen dimension so
    // same-group rows sit adjacent, then the DataTable draws a band per
    // group. The column sort above stays the WITHIN-group order.
    if (groupByKey !== 'none') {
      sorted.sort((a, b) => groupRank(a, groupByKey, run.paymentDate).localeCompare(groupRank(b, groupByKey, run.paymentDate)));
    }
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, invoiceQuery, vendorQuery, columnFilters, sortConfig, run.paymentDate, groupByKey, runColumns]);

  const selectedIds = useMemo(() => new Set(run.lines.map((l) => l.invoiceId)), [run.lines]);

  const setFilters = (patch: Partial<PaymentRun['filters']>) => {
    runsApi.updateRun(run.id, (r) => ({ ...r, filters: { ...r.filters, ...patch } }));
  };

  const f = run.filters;
  const hasActiveFilters = !!(
    f.dueOnOrBefore ||
    f.dueFrom ||
    f.agingBuckets?.length ||
    f.types?.length ||
    f.vendors?.length ||
    f.amountMin != null ||
    f.amountMax != null ||
    f.discount
  );
  const clearAllFilters = () => {
    runsApi.updateRun(run.id, (r) => ({ ...r, filters: {} }));
  };
  // Table Empty & Error States Standard v1.0 (11/3/26): the pool before
  // any chip, vendor search or column filter is what exists.
  const unfilteredPoolCount = useMemo(
    () => eligibleInvoices(invoices, runsApi.runs, run.id, {}, run.paymentDate).filter((r) => !r.noPaymentMethod).length,
    [invoices, runsApi.runs, run.id, run.paymentDate],
  );
  const poolFilterCount =
    (f.dueOnOrBefore || f.dueFrom ? 1 : 0) +
    (f.agingBuckets?.length ?? 0) +
    (f.types?.length ?? 0) +
    (f.vendors?.length ?? 0) +
    (f.paymentTerms?.length ?? 0) +
    (f.amountMin != null || f.amountMax != null ? 1 : 0) +
    (f.discount ? 1 : 0) +
    (vendorQuery.trim() ? 1 : 0) +
    Object.keys(columnFilters).length;
  const emptyConfig: DataTableEmptyConfig = {
    entity: { singular: 'invoice', plural: 'invoices' },
    totalCount: unfilteredPoolCount,
    filterCount: poolFilterCount,
    onClearSearch: () => setInvoiceQuery(''),
    onClearFilters: () => { clearAllFilters(); setVendorQuery(''); setColumnFilters({}); },
    onSearch: (q) => setInvoiceQuery(q),
    compact: true,
    ...(unfilteredPoolCount === 0
      ? { title: 'No invoices to pay', description: 'Only approved invoices with an open balance are eligible.' }
      : {}),
  };
  const toggleIn = (list: string[] | undefined, id: string) => {
    const cur = list ?? [];
    const next = cur.includes(id) ? cur.filter((v) => v !== id) : [...cur, id];
    return next.length ? next : undefined;
  };

  const toLine = (inv: Invoice): PaymentRunLine => {
    // Paying defaults to the DISCOUNTED amount when the early-pay window
    // is still open at the run's payment date (8/28/26 review) — the
    // whole point of surfacing the discount is capturing it.
    const terms = discountTermsFor(inv);
    const discount = discountIsLive(terms, run.paymentDate) && terms
      ? discountAmountOn(inv.outstandingBalance, terms)
      : 0;
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      vendor: inv.vendor,
      dueDate: inv.dueDate,
      balanceAtAdd: inv.outstandingBalance,
      payAmount: inv.outstandingBalance - discount,
      // Pre-invoices pay as advances (user 10/22/26).
      isPreInvoice: inv.type === 'Pre-Invoice' || undefined,
    };
  };

  const toggle = (row: EligibleRow) => {
    runsApi.updateRun(run.id, (r) => ({
      ...r,
      lines: r.lines.some((l) => l.invoiceId === row.invoice.id)
        ? r.lines.filter((l) => l.invoiceId !== row.invoice.id)
        : [...r.lines, toLine(row.invoice)],
    }));
  };

  // DataTable owns the checkbox column, drag-select, and select-all; the
  // diff lands back on the run's lines (a tick = a line in the run).
  const applySelection = (next: Set<string>) => {
    runsApi.updateRun(run.id, (r) => {
      const have = new Set(r.lines.map((l) => l.invoiceId));
      const keep = r.lines.filter((l) => next.has(l.invoiceId));
      const add = rows
        .filter((v) => next.has(v.invoice.id) && !have.has(v.invoice.id))
        .map((v) => toLine(v.invoice));
      return { ...r, lines: [...keep, ...add] };
    });
  };

  const vendorOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    eligibleInvoices(invoices, runsApi.runs, run.id, {})
      .filter((r) => !r.noPaymentMethod)
      .forEach((r) => {
        counts[r.invoice.vendor] = (counts[r.invoice.vendor] ?? 0) + 1;
      });
    return Object.keys(counts)
      .sort()
      .map((v) => ({ id: v, label: v, count: counts[v] }));
  }, [invoices, runsApi.runs, run.id]);

  // Discount filter stats (8/28/26 review): the options carry counts and
  // the live savings on the table, measured at the run's payment date,
  // so the filter says what taking it is worth before it's clicked.
  const discountStats = useMemo(() => {
    let withCount = 0;
    let savings = 0;
    eligibleInvoices(invoices, runsApi.runs, run.id, {})
      .filter((r) => !r.noPaymentMethod)
      .forEach((r) => {
        const terms = discountTermsFor(r.invoice);
        if (terms && discountIsLive(terms, run.paymentDate)) {
          withCount += 1;
          savings += discountAmountOn(r.invoice.outstandingBalance, terms);
        }
      });
    return { withCount, savings: Math.round(savings * 100) / 100 };
  }, [invoices, runsApi.runs, run.id, run.paymentDate]);

  // Invoice type options (8/12/26): the three families, fixed order,
  // counts from the whole eligible pool.
  const typeOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    eligibleInvoices(invoices, runsApi.runs, run.id, {})
      .filter((r) => !r.noPaymentMethod)
      .forEach((r) => {
        const label = invoiceTypeLabel(r.invoice.type);
        counts[label] = (counts[label] ?? 0) + 1;
      });
    return TYPE_FAMILIES.map((t) => ({ id: t, label: t, count: counts[t] ?? 0 }));
  }, [invoices, runsApi.runs, run.id]);

  // "Due by" preset helpers: Next N days = due date within [today, today+N].
  const isoDaysAhead = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  };
  const activePreset = DUE_PRESETS.find((n) => f.dueFrom === todayIso && f.dueOnOrBefore === isoDaysAhead(n));
  const dueChipLabel = !f.dueOnOrBefore && !f.dueFrom
    ? 'Due By'
    : activePreset
      ? `Due in the Next ${activePreset} Days`
      : f.dueFrom
        ? `Due ${humanDate(f.dueFrom)} to ${f.dueOnOrBefore ? humanDate(f.dueOnOrBefore) : 'Any'}`
        : `Due by ${humanDate(f.dueOnOrBefore!)}`;

  // The payment date (and its closed-period gate) lives on the
  // execution step now (8/7/26).
  const canContinue = run.lines.length > 0;

  // Running total of the current selection (Eli 9/25): what each selected
  // line pays (discount already applied at add), shown in the footer.
  const selectedTotal = useMemo(
    () => Math.round(run.lines.reduce((s, l) => s + (l.payAmount ?? l.balanceAtAdd ?? 0), 0) * 100) / 100,
    [run.lines],
  );

  // Per-group count + total (Eli 9/25): the band subtitle shows how many
  // invoices sit in the group, their combined amount due — and the
  // SELECTED slice ("how much am I authorizing for each vendor").
  const groupStats = useMemo(() => {
    const m = new Map<string, { count: number; total: number; selCount: number; selTotal: number }>();
    if (groupByKey === 'none') return m;
    const lineById = new Map(run.lines.map((l) => [l.invoiceId, l]));
    for (const r of visibleRows) {
      const id = groupMetaOf(r, groupByKey, run.paymentDate).id;
      const cur = m.get(id) ?? { count: 0, total: 0, selCount: 0, selTotal: 0 };
      cur.count += 1;
      cur.total = Math.round((cur.total + r.invoice.outstandingBalance) * 100) / 100;
      const line = lineById.get(r.invoice.id);
      if (line) {
        cur.selCount += 1;
        cur.selTotal = Math.round((cur.selTotal + (line.payAmount ?? line.balanceAtAdd ?? 0)) * 100) / 100;
      }
      m.set(id, cur);
    }
    return m;
  }, [visibleRows, groupByKey, run.lines]);

  // Distinct vendors in the selection (Eli 9/25 footer stats), plus the
  // per-vendor amounts behind them (user 10/5: "amount per vendor" is a
  // first-class running total) — surfaced as a hover card on the count.
  const selectedVendorCount = useMemo(
    () => new Set(run.lines.map((l) => l.vendor)).size,
    [run.lines],
  );
  const perVendorSelected = useMemo(() => {
    const m = new Map<string, number>();
    run.lines.forEach((l) => {
      m.set(l.vendor, Math.round(((m.get(l.vendor) ?? 0) + (l.payAmount ?? l.balanceAtAdd ?? 0)) * 100) / 100);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [run.lines]);

  // Clicking a vendor in the footer hover (user 10/8): every one of that
  // vendor's rows flashes in the table and the first scrolls into view if
  // it sits outside the viewport.
  const [flashVendor, setFlashVendor] = useState<string | null>(null);
  const flashVendorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashVendorRows = (vendor: string) => {
    const target =
      visibleRows.find((r) => r.invoice.vendor === vendor)
      ?? rows.find((r) => r.invoice.vendor === vendor);
    if (!target) return;
    // Restart the CSS flash even when the same vendor is clicked twice.
    setFlashVendor(null);
    requestAnimationFrame(() => {
      setFlashVendor(vendor);
      document
        .querySelector(`[data-row-id="${CSS.escape(target.invoice.id)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    if (flashVendorTimer.current) clearTimeout(flashVendorTimer.current);
    flashVendorTimer.current = setTimeout(() => setFlashVendor(null), 2400);
  };

  // DataTable handlers — the listing recipe verbatim: header menu sort,
  // per-column filters, freeze, hide. Invoice can't unfreeze.
  const handleSort = (key: string, dir: 'asc' | 'desc' | null) =>
    setSortConfig(dir ? { key, direction: dir } : null);
  const handleFreezeColumn = (key: string) =>
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key) && key !== 'invoice') next.delete(key);
      else next.add(key);
      return next;
    });
  const handleHideColumn = (key: string) =>
    setColumnVisibility((prev) => ({ ...prev, [key]: false }));
  const handleColumnFilterChange = (key: string, filter: ColumnFilterState) =>
    setColumnFilters((prev) => ({ ...prev, [key]: filter }));
  const handleAddColumnFilter = (key: string) =>
    setColumnFilters((prev) =>
      prev[key]
        ? prev
        : {
            ...prev,
            [key]: {
              columnKey: key,
              type: runColumns.find((c) => c.key === key)?.filterType ?? 'text',
              values: [],
              text: '',
              min: '',
              max: '',
              dateFrom: '',
              dateTo: '',
            },
          },
    );


  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Flush body (8/4/26), the Record Payment Step 1 recipe verbatim:
          segmented search bar, popover filter chips, light list header,
          then the pool. No inner card, the modal shell IS the surface. */}
      <div className="flex-1 min-h-0 bg-white flex flex-col overflow-hidden">
        {/* Full-bleed search + filter band on the grey canvas, the Record
            Payment step 1 recipe (8/4/26). */}
        <div data-col-hide-edge className="px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 bg-slate-50 border-b border-slate-100 space-y-3 shrink-0">
          {/* Search row — one joined bar, invoice and vendor segments. */}
          <div className="flex items-stretch border border-border rounded-lg bg-white shadow-sm overflow-hidden transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 hover:border-primary/50 [&>div]:flex-1 [&>div:not(:last-child)]:border-r [&>div:not(:last-child)]:border-border/70">
            <div className="relative">
              <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Search invoices..."
                value={invoiceQuery}
                onChange={(e) => setInvoiceQuery(e.target.value)}
                className="pl-9 pr-3 h-10 bg-white border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/20 focus:bg-white transition-all text-[13px] placeholder:text-slate-400"
              />
            </div>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Search vendors..."
                value={vendorQuery}
                onChange={(e) => setVendorQuery(e.target.value)}
                className="pl-9 pr-3 h-10 bg-white border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/20 focus:bg-white transition-all text-[13px] placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Filter chips — payment date first (back by BA request
              8/10/26; it also stays editable on the execution step),
              then the query filters, Reset pinned right. */}
          <div className="flex items-center gap-x-2 gap-y-2 flex-wrap px-0.5">
            {/* Payment date — a named run parameter, not an "applied filter"
                (feedback 8/4/26): neutral chip with a label, and the popover
                opens straight on the calendar. */}
            <Popover open={activePopover === 'payDate'} onOpenChange={(o) => setActivePopover(o ? 'payDate' : null)}>
              <PopoverTrigger asChild>
                <button className={chipClass(activePopover === 'payDate', closedPeriod)} style={{ fontWeight: 500 }}>
                  <Calendar className={chipIconClass(activePopover === 'payDate', closedPeriod)} />
                  <span>Payment Date · {humanDate(run.paymentDate)}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'payDate' ? 'rotate-180' : ''}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="w-[300px] p-0 bg-white border border-border rounded-xl overflow-hidden" style={POPOVER_SHADOW}>
                {/* No "Scheduled" mode language (8/5/26): the date picker
                    IS the payment date. A future date is the user's own
                    choice, not a separate feature. */}
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>Payment Date</p>
                  {closedPeriod ? (
                    <p className="text-[11px] text-rose-600 mt-1" style={{ fontWeight: 500 }}>
                      That date falls in a closed period. Pick a date in the current month or later.
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Payments post on this date.
                    </p>
                  )}
                </div>
                <DateCalendar
                  value={run.paymentDate}
                  showFooter={false}
                  onChange={(v) => {
                    if (!v) return;
                    runsApi.updateRun(run.id, { paymentDate: v });
                    setActivePopover(null);
                  }}
                />
              </PopoverContent>
            </Popover>
            {/* Group by rides directly after the payment date (user 9/25):
                it shapes how the whole pool reads, so it leads the row. */}
            <Popover open={activePopover === 'group'} onOpenChange={(o) => setActivePopover(o ? 'group' : null)}>
              <PopoverTrigger asChild>
                <button className={chipClass(groupByKey !== 'none')} style={{ fontWeight: 500 }}>
                  <Rows3 className={chipIconClass(groupByKey !== 'none')} />
                  {groupByKey === 'none' ? 'Group By' : `Grouped by ${GROUP_OPTIONS.find((o) => o.key === groupByKey)?.label}`}
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'group' ? 'rotate-180' : ''}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-1.5">
                {GROUP_OPTIONS.map((o) => {
                  const active = groupByKey === o.key;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => { setGroupByKey(o.key); setActivePopover(null); }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-left text-[12.5px] transition-colors cursor-pointer ${active ? 'bg-primary/[0.06] text-primary' : 'hover:bg-slate-50 text-foreground'}`}
                      style={{ fontWeight: active ? 600 : 500 }}
                    >
                      {o.label}
                      {active && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
            <div className="w-px h-5 bg-border/70 mx-0.5" />
            {/* Due by — renamed from "Due on or before" (8/5/26). The
                popover is the GLOBAL DateRangePanel (8/12/26): preset
                rail (Next N days), two-month range calendar, Cancel and
                Apply. The panel stays open while a range is drafted;
                only Apply (or a preset) touches the list. */}
            <Popover
              open={activePopover === 'due'}
              onOpenChange={(o) => {
                setActivePopover(o ? 'due' : null);
                if (o) {
                  const hasCustomRange = !activePreset && !!(f.dueFrom && f.dueOnOrBefore);
                  setDueDraft(
                    hasCustomRange
                      ? { from: dayjs(f.dueFrom).toDate(), to: dayjs(f.dueOnOrBefore).toDate() }
                      : undefined,
                  );
                  setDueCustomArmed(hasCustomRange);
                }
              }}
            >
              <PopoverTrigger asChild>
                <button className={chipClass(!!f.dueOnOrBefore || !!f.dueFrom)} style={{ fontWeight: 500 }}>
                  <CalendarClock className={chipIconClass(!!f.dueOnOrBefore || !!f.dueFrom)} />
                  <span>{dueChipLabel}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'due' ? 'rotate-180' : ''}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="w-auto p-0 bg-white border border-border rounded-xl overflow-hidden" style={POPOVER_SHADOW}>
                <DateRangePanel
                  customArmed={dueCustomArmed}
                  customApplied={!activePreset && !!(f.dueFrom && f.dueOnOrBefore)}
                  onArmCustom={() => setDueCustomArmed(true)}
                  draft={dueDraft}
                  onDraftChange={setDueDraft}
                  onCancel={() => setActivePopover(null)}
                  onApply={() => {
                    if (!dueDraft?.from || !dueDraft?.to) return;
                    setFilters({
                      dueFrom: dayjs(dueDraft.from).format('YYYY-MM-DD'),
                      dueOnOrBefore: dayjs(dueDraft.to).format('YYYY-MM-DD'),
                    });
                    setActivePopover(null);
                  }}
                  defaultMonth={new Date()}
                  rail={
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setFilters({ dueFrom: undefined, dueOnOrBefore: undefined });
                          setActivePopover(null);
                        }}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer text-[12px] ${
                          !f.dueFrom && !f.dueOnOrBefore && !dueCustomArmed && !dueDraft?.from
                            ? 'bg-accent text-primary'
                            : 'hover:bg-slate-50 text-foreground'
                        }`}
                        style={{ fontWeight: !f.dueFrom && !f.dueOnOrBefore && !dueCustomArmed && !dueDraft?.from ? 600 : 400 }}
                      >
                        Any Due Date
                        {!f.dueFrom && !f.dueOnOrBefore && !dueCustomArmed && !dueDraft?.from && (
                          <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                        )}
                      </button>
                      {DUE_PRESETS.map((n) => {
                        const active = activePreset === n && !dueCustomArmed && !dueDraft?.from;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              setFilters({ dueFrom: todayIso, dueOnOrBefore: isoDaysAhead(n) });
                              setActivePopover(null);
                            }}
                            className={`flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer text-[12px] ${
                              active ? 'bg-accent text-primary' : 'hover:bg-slate-50 text-foreground'
                            }`}
                            style={{ fontWeight: active ? 600 : 400 }}
                          >
                            Next {n} Days
                            {active && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
                          </button>
                        );
                      })}
                    </>
                  }
                />
              </PopoverContent>
            </Popover>

            {/* Overdue — the bracket windows stay for grouping, relabeled
                in overdue-days language (8/5/26): aging brackets are an
                AR concept, this is payables. */}
            <Popover open={activePopover === 'aging'} onOpenChange={(o) => setActivePopover(o ? 'aging' : null)}>
              <PopoverTrigger asChild>
                <button className={chipClass(!!f.agingBuckets?.length)} style={{ fontWeight: 500 }}>
                  <Hourglass className={chipIconClass(!!f.agingBuckets?.length)} />
                  <span>
                    {!f.agingBuckets?.length
                      ? 'Overdue'
                      : f.agingBuckets.length === 1
                        ? OVERDUE_BUCKET_LABELS[f.agingBuckets[0] as (typeof AGING_BUCKETS)[number]] ?? f.agingBuckets[0]
                        : `Overdue · ${f.agingBuckets.length} Selected`}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'aging' ? 'rotate-180' : ''}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="w-[240px] p-0 bg-white border border-border rounded-xl overflow-hidden" style={POPOVER_SHADOW}>
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>Overdue</p>
                  {!!f.agingBuckets?.length && (
                    <button onClick={() => setFilters({ agingBuckets: undefined })} className="text-[11px] text-primary hover:text-blue-700 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>Reset</button>
                  )}
                </div>
                <div className="px-2 py-2">
                  {/* "All overdue" (Jennifer 9/1/26): one catch-all that
                      sweeps every past-due bracket in a click — "to me,
                      overdue is overdue." The brackets below stay for the
                      limited-cash, chase-the-oldest-first read. */}
                  {(() => {
                    const overdueAll: string[] = AGING_BUCKETS.filter((b) => b !== 'Current' && b !== 'Due Today');
                    const allChecked = overdueAll.every((b) => f.agingBuckets?.includes(b));
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const next = allChecked
                            ? (f.agingBuckets ?? []).filter((b) => !overdueAll.includes(b as (typeof AGING_BUCKETS)[number]))
                            : [...new Set([...(f.agingBuckets ?? []), ...overdueAll])];
                          setFilters({ agingBuckets: next.length ? next : undefined });
                        }}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                      >
                        <Checkbox checked={allChecked} className="pointer-events-none" />
                        <span className="text-[12px] text-foreground flex-1 truncate" style={{ fontWeight: 600 }}>All Overdue</span>
                        <span className="text-[10px] text-slate-400 shrink-0">every past-due bracket</span>
                      </button>
                    );
                  })()}
                  <div className="my-1 border-t border-border/60" />
                  {AGING_BUCKETS.map((b) => {
                    const checked = f.agingBuckets?.includes(b) ?? false;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setFilters({ agingBuckets: toggleIn(f.agingBuckets, b) })}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                      >
                        <Checkbox checked={checked} className="pointer-events-none" />
                        <span className="text-[12px] text-foreground flex-1 truncate">{OVERDUE_BUCKET_LABELS[b]}</span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {/* Invoice type (8/12/26): the three creation-flow families,
                selectable now that pre-invoices joined the pool. */}
            <Popover open={activePopover === 'type'} onOpenChange={(o) => setActivePopover(o ? 'type' : null)}>
              <PopoverTrigger asChild>
                <button className={chipClass(!!f.types?.length)} style={{ fontWeight: 500 }}>
                  <Layers className={chipIconClass(!!f.types?.length)} />
                  <span className="max-w-[170px] truncate">
                    {!f.types?.length
                      ? 'Type'
                      : f.types.length === 1
                        ? f.types[0]
                        : `${f.types.length} types`}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'type' ? 'rotate-180' : ''}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="w-[240px] p-0 bg-white border border-border rounded-xl overflow-hidden" style={POPOVER_SHADOW}>
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>Invoice Type</p>
                  {!!f.types?.length && (
                    <button onClick={() => setFilters({ types: undefined })} className="text-[11px] text-primary hover:text-blue-700 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>Reset</button>
                  )}
                </div>
                <div className="px-2 py-2">
                  {typeOptions.map((opt) => {
                    const checked = f.types?.includes(opt.id) ?? false;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFilters({ types: toggleIn(f.types, opt.id) })}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                      >
                        <Checkbox checked={checked} className="pointer-events-none" />
                        <span className="text-[12px] text-foreground flex-1 truncate">{opt.label}</span>
                        <span className="text-[11px] text-slate-400 shrink-0">{opt.count}</span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {/* Vendor */}
            <Popover open={activePopover === 'vendor'} onOpenChange={(o) => { setActivePopover(o ? 'vendor' : null); if (!o) setVendorFilterSearch(''); }}>
              <PopoverTrigger asChild>
                <button className={chipClass(!!f.vendors?.length)} style={{ fontWeight: 500 }}>
                  <Building2 className={chipIconClass(!!f.vendors?.length)} />
                  <span className="max-w-[160px] truncate">
                    {!f.vendors?.length
                      ? 'Vendor'
                      : f.vendors.length === 1
                        ? f.vendors[0]
                        : `${f.vendors.length} vendors`}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'vendor' ? 'rotate-180' : ''}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="w-[260px] p-0 bg-white border border-border rounded-xl overflow-hidden" style={POPOVER_SHADOW}>
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>Vendor</p>
                  {!!f.vendors?.length && (
                    <button onClick={() => setFilters({ vendors: undefined })} className="text-[11px] text-primary hover:text-blue-700 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>Reset</button>
                  )}
                </div>
                <div className="px-2 pt-2 pb-1">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
                    <input
                      autoFocus
                      value={vendorFilterSearch}
                      onChange={(e) => setVendorFilterSearch(e.target.value)}
                      placeholder="Search vendors..."
                      className="w-full h-8 pl-8 pr-7 rounded-md border border-border bg-white text-[12px] outline-none placeholder:text-muted-foreground/50 focus:border-primary"
                    />
                    {vendorFilterSearch && (
                      <button
                        type="button"
                        onClick={() => setVendorFilterSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-2 pb-2 max-h-[260px] overflow-y-auto">
                  {vendorOptions
                    .filter((o) => !vendorFilterSearch || o.label.toLowerCase().includes(vendorFilterSearch.toLowerCase()))
                    .map((opt) => {
                      const checked = f.vendors?.includes(opt.id) ?? false;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFilters({ vendors: toggleIn(f.vendors, opt.id) })}
                          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                        >
                          <Checkbox checked={checked} className="pointer-events-none" />
                          {/* Searchable, so it highlights like every other matched cell (10/9/26). */}
                          <span className="text-[12px] text-foreground flex-1 truncate">{highlightText(opt.label, vendorFilterSearch)}</span>
                          <span className="text-[11px] text-slate-400 shrink-0">{opt.count}</span>
                        </button>
                      );
                    })}
                  {vendorOptions.filter((o) => !vendorFilterSearch || o.label.toLowerCase().includes(vendorFilterSearch.toLowerCase())).length === 0 && (
                    <p className="px-2 py-2 text-[12px] text-muted-foreground">No matches</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Amount due range */}
            <Popover
              open={activePopover === 'amount'}
              onOpenChange={(o) => {
                setActivePopover(o ? 'amount' : null);
                // The draft loads the applied range on open; typing edits
                // the draft only. The list changes on Apply, not per
                // keystroke (feedback 8/12/26).
                if (o) setAmountDraft({ min: f.amountMin, max: f.amountMax });
              }}
            >
              <PopoverTrigger asChild>
                <button className={chipClass(f.amountMin != null || f.amountMax != null)} style={{ fontWeight: 500 }}>
                  <Receipt className={chipIconClass(f.amountMin != null || f.amountMax != null)} />
                  <span>
                    {f.amountMin != null || f.amountMax != null
                      ? `${f.amountMin != null ? '$' + f.amountMin.toLocaleString('en-US') : '$0'} to ${f.amountMax != null ? '$' + f.amountMax.toLocaleString('en-US') : 'Any'}`
                      : 'Amount Due'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'amount' ? 'rotate-180' : ''}`} />
                </button>
              </PopoverTrigger>
              {/* The inventory listing's range-popover recipe (8/4/26):
                  From/To fields, a range-status footnote on the left of the
                  footer, Apply on the right. */}
              <PopoverContent align="start" sideOffset={6} className="w-[320px] p-0 bg-white border border-border rounded-xl overflow-hidden" style={POPOVER_SHADOW}>
                {/* "Amount due", never just "amount" (8/5/26): with
                    partial payments the full figure may never be paid.
                    The filter finds invoices at a given size. */}
                <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                  <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>Amount Due</p>
                  {(amountDraft.min != null || amountDraft.max != null || f.amountMin != null || f.amountMax != null) && (
                    <button
                      onClick={() => {
                        setAmountDraft({});
                        setFilters({ amountMin: undefined, amountMax: undefined });
                      }}
                      className="text-[11px] text-primary hover:text-blue-700 transition-colors cursor-pointer"
                      style={{ fontWeight: 600 }}
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="px-4 pb-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>From</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 ">$</span>
                      {/* MoneyInput (8/12/26): thousands group while
                          typing, the comma standard for amount fields. */}
                      <MoneyInput
                        fluid
                        value={amountDraft.min ?? 0}
                        onValueChange={(n) => setAmountDraft((d) => ({ ...d, min: n > 0 ? n : undefined }))}
                        placeholder="0.00"
                        className="flex h-9 w-full min-w-0 rounded-md border border-input bg-white pl-7 pr-3 py-1 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>To</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 ">$</span>
                      <MoneyInput
                        fluid
                        value={amountDraft.max ?? 0}
                        onValueChange={(n) => setAmountDraft((d) => ({ ...d, max: n > 0 ? n : undefined }))}
                        placeholder="No limit"
                        className="flex h-9 w-full min-w-0 rounded-md border border-input bg-white pl-7 pr-3 py-1 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      />
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between border-t border-slate-100">
                  <span className="text-[11px] text-slate-400 " style={{ fontWeight: 500 }}>
                    {amountDraft.min != null || amountDraft.max != null
                      ? `${amountDraft.min != null ? '$' + amountDraft.min.toLocaleString('en-US') : '$0'} to ${amountDraft.max != null ? '$' + amountDraft.max.toLocaleString('en-US') : 'Any'}`
                      : 'No range set'}
                  </span>
                  <Button
                    onClick={() => {
                      setFilters({ amountMin: amountDraft.min, amountMax: amountDraft.max });
                      setActivePopover(null);
                    }}
                    className="h-8 px-4 text-[12px] rounded-lg shadow-sm"
                    style={{ fontWeight: 600 }}
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Early-pay discount — its own filter, separate from the
                terms catalog (8/28/26 review): payment-term discounts are
                a paying decision; pricing-rule discounts are already on
                the line items and have nothing to do with the run. */}
            <Popover open={activePopover === 'discount'} onOpenChange={(o) => setActivePopover(o ? 'discount' : null)}>
              <PopoverTrigger asChild>
                <button className={chipClass(!!f.discount)} style={{ fontWeight: 500 }}>
                  <BadgePercent className={chipIconClass(!!f.discount)} />
                  <span className="max-w-[200px] truncate">
                    {f.discount === 'with' ? `Discount Available · ${discountStats.withCount}` : 'Discount'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'discount' ? 'rotate-180' : ''}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="w-[300px] p-0 bg-white border border-border rounded-xl overflow-hidden" style={POPOVER_SHADOW}>
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>Early-Pay Discount</p>
                  {!!f.discount && (
                    <button onClick={() => { setFilters({ discount: undefined }); setActivePopover(null); }} className="text-[11px] text-primary hover:text-blue-700 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>Reset</button>
                  )}
                </div>
                {/* Live worth up top (8/28/26 review): what's on the table
                    if every open window is taken at this payment date. */}
                {discountStats.withCount > 0 && (
                  <div className="mx-4 mt-1 mb-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50/70 border border-emerald-100 flex items-center gap-2">
                    <BadgePercent className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <p className="text-[11px] text-emerald-800 leading-snug" style={{ fontWeight: 500 }}>
                      <span style={{ fontWeight: 700 }}>{money(discountStats.savings)}</span> on the table across{' '}
                      {discountStats.withCount} invoice{discountStats.withCount === 1 ? '' : 's'} if paid on {humanDate(run.paymentDate)}.
                    </p>
                  </div>
                )}
                {/* ONE checkbox (8/28/26 evening): on = only invoices
                    with a live early-pay window; off (the default) = no
                    filtering. A "No discount" option added nothing. */}
                <div className="px-2 pb-2">
                  {(() => {
                    const checked = f.discount === 'with';
                    return (
                      <button
                        type="button"
                        onClick={() => { setFilters({ discount: checked ? undefined : 'with' }); setActivePopover(null); }}
                        className="w-full flex items-start gap-2.5 px-2 py-2 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                      >
                        <Checkbox checked={checked} className="pointer-events-none mt-0.5" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[12px] text-foreground" style={{ fontWeight: checked ? 600 : 500 }}>Discount Available</span>
                          <span className="block text-[11px] text-slate-400 mt-0.5">
                            Only invoices whose early-pay window is still open on {humanDate(run.paymentDate)}.
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0 mt-0.5">{discountStats.withCount}</span>
                      </button>
                    );
                  })()}
                </div>
                <p className="px-4 pb-3 text-[10.5px] text-slate-400" style={{ fontWeight: 500 }}>
                  Pricing-rule discounts are already applied on the PO lines; this filter is only the payment-term window.
                </p>
              </PopoverContent>
            </Popover>

            <button
              type="button"
              onClick={clearAllFilters}
              disabled={!hasActiveFilters}
              className={`ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] transition-colors group ${hasActiveFilters ? 'text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer' : 'text-slate-300 cursor-default'}`}
              style={{ fontWeight: 500 }}
            >
              <RotateCcw className={`w-3.5 h-3.5 transition-transform duration-300 ${hasActiveFilters ? 'group-hover:rotate-[-45deg]' : ''}`} /> Reset
            </button>
          </div>
        </div>

        {/* The listing DataTable (8/28/26 review): frozen invoice column
            left, Amount Due pinned right, the middle columns scroll
            horizontally; header menus carry sort / filter / freeze /
            resize / reorder, exactly like every listing page. */}
        <DataTable<EligibleRow>
          rows={visibleRows}
          optionRows={rows}
          columns={runColumns}
          getRowId={(r) => r.invoice.id}
          selectedIds={selectedIds}
          onSelectionChange={applySelection}
          columnOrder={columnOrder}
          onColumnOrderChange={setColumnOrder}
          columnVisibility={columnVisibility}
          columnFilters={columnFilters}
          onColumnFilterChange={handleColumnFilterChange}
          onAddColumnFilter={handleAddColumnFilter}
          onHideColumn={handleHideColumn}
          sortConfig={sortConfig}
          onSort={handleSort}
          frozenColumns={frozenColumns}
          onFreezeColumn={handleFreezeColumn}
          density="comfort"
          groupBy={
            groupByKey === 'none'
              ? undefined
              : (r) => {
                  const meta = groupMetaOf(r, groupByKey, run.paymentDate);
                  const s = groupStats.get(meta.id);
                  return {
                    ...meta,
                    // Left of the band: just the count (Eli 10/5 — the group
                    // total was read as the SELECTED total because they sat
                    // side by side). The amount moves right, over the column.
                    subtitle: s ? `${s.count} invoice${s.count === 1 ? '' : 's'}` : undefined,
                    // Right edge of the band, directly over the Amount Due
                    // column: the group's total amount due, framed as "the
                    // total of the rows below" via its hover, with the
                    // selected slice called out in the primary tone so it
                    // reads as distinct from this due figure.
                    right: s ? (
                      <GroupAmountTotal label={meta.label} count={s.count} total={s.total} selCount={s.selCount} selTotal={s.selTotal} />
                    ) : undefined,
                  };
                }
          }
          onRowClick={(r) => toggle(r)}
          // Footer-hover vendor click (user 10/8): that vendor's rows flash.
          rowClassName={(r) => (flashVendor && r.invoice.vendor === flashVendor ? 'animate-row-flash' : '')}
          searchQuery={invoiceQuery}
          searchRows={visibleRows}
          searchRevealAfter="invoice"
          hidePagination
          currentPage={1}
          recordsPerPage={Math.max(1, visibleRows.length)}
          totalRows={visibleRows.length}
          onPageChange={() => {}}
          onRecordsPerPageChange={() => {}}
          emptyConfig={emptyConfig}
        />

      </div>

      {/* Footer — shell-flush, the shared modal footer recipe at the
          STANDARD height (user 10/8: no boxed card inflating it). The
          counts read as plain text bottom-left with the total right next
          to them; the per-vendor breakdown stays on hover, and clicking a
          vendor there flashes its rows in the table and scrolls to them. */}
      <div className={RUN_FOOTER_FLUSH}>
        {run.lines.length > 0 && (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <span className="inline-flex items-baseline gap-1.5 cursor-help shrink-0 text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
                <span className="text-foreground" style={{ fontWeight: 600 }}>{run.lines.length}</span>
                {` invoice${run.lines.length === 1 ? '' : 's'} · `}
                <span className="text-foreground" style={{ fontWeight: 600 }}>{selectedVendorCount}</span>
                {` vendor${selectedVendorCount === 1 ? '' : 's'} · `}
                <span className="text-[14px] text-foreground" style={{ fontWeight: 700 }}>{money(selectedTotal)}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
              <p className="text-[11px] text-slate-500 mb-1" style={{ fontWeight: 600 }}>Selected per Vendor</p>
              <div className="space-y-0.5 max-h-[180px] overflow-y-auto">
                {perVendorSelected.map(([vendor, amt]) => (
                  <button
                    key={vendor}
                    type="button"
                    onClick={() => flashVendorRows(vendor)}
                    className="w-full text-[11px] text-foreground flex items-center justify-between gap-3 px-1 py-0.5 -mx-1 rounded hover:bg-blue-50/70 hover:text-primary transition-colors cursor-pointer text-left"
                    title={`Show ${vendor} in the table`}
                  >
                    <span className="truncate">{vendor}</span>
                    <span style={{ fontWeight: 600 }}>{money(amt)}</span>
                  </button>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
        <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
          <button type="button" onClick={onCancel} className={FOOTER_BTN_GHOST} style={{ fontWeight: 500 }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!canContinue) {
                toast.error('No invoices in this run', { description: 'Add at least one invoice before continuing.' });
                return;
              }
              runsApi.continueToProposal(run.id, run.lines);
            }}
            className={FOOTER_BTN_PRIMARY}
            style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 500 }}
          >
            Continue
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
