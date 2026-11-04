import type { DataTableEmptyConfig } from '@/app/components/data-table/DataTable';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { formatMoneyText } from '@/app/components/payments/MoneyInput';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Search, X, Plus, ChartColumn, SlidersHorizontal, User, EyeOff, LayoutGrid } from 'lucide-react';
import { SavedViewsDialog, useSavedViews } from '@/app/components/SavedViewsDialog';
import { toast } from 'sonner';
import { InsightsResetButton } from '@/app/components/InsightsResetButton';
import { InsightsRefresh } from '@/app/components/InsightsRefresh';
import { Input } from '@/app/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import type { Invoice } from '@/app/data/mockInvoices';
import { InvoiceDataTable, INVOICE_COLUMNS, invoiceStatusAxes, invoiceColumnValue } from '@/app/components/InvoiceDataTable';
import { rowMatchesColumns } from '@/app/components/data-table';
import {
  applyInvoiceColumnFilters,
  isInvoiceFilterActive,
  type ColumnFilterState,
  type SortConfig,
} from '@/app/components/InvoiceColumnHeaderMenu';
import { ColumnSelector, ColumnSelectorTrigger } from '@/app/components/ColumnSelector';
import { ViewDensityMenu } from '@/app/components/data-table/ViewDensityMenu';
import { MultiSelectFilter } from '@/app/components/data-table/MultiSelectFilter';
import { DueDateFilter } from '@/app/components/data-table/DueDateFilter';
import { DUE_BUCKETS, dueBucketOf, compareMostOverdue, MOST_OVERDUE_SORT_KEY } from '@/app/lib/dueBucket';
import { discountTermsFor, discountIsLive, discountAmountOn, paymentTermsFor } from '@/app/lib/runMath';
import { InvoiceActiveFiltersBar } from '@/app/components/InvoiceActiveFiltersBar';
import { BulkActionBar, type BulkAction } from '@/app/components/BulkActionBar';
import { filterInvoicesByRange, type InsightsRange } from '@/app/components/InvoiceInsightsPanel';
import { InsightsRangeMenu } from '@/app/components/InsightsRangeMenu';
import { DraggableKpiCard } from '@/app/components/DraggableKpiCard';
import { ReadyToPayInsightsPanel } from '@/app/components/ReadyToPayInsightsPanel';
import {
  ALL_READY_KPI_DEFINITIONS,
  computeReadyKpi,
  DEFAULT_READY_KPI_KEYS,
} from '@/app/data/readyKpis';

// "Invoices to pay" shows ONLY approved invoices awaiting payment
// (rev 7/16/26): approval already happened at invoice level, so this
// tab is the queue of what an AP clerk can cut a payment against.
// Payment Hold / Exception / Pending Approval are blocked upstream.
// Partially Paid stays IN the queue (9/15/26): its remainder is still
// payable — the Payment Status column tells the two states apart.
export function isReadyToPay(inv: Invoice): boolean {
  return (
    (inv.status === 'Approved' || inv.status === 'Partially Paid') &&
    inv.outstandingBalance > 0 &&
    // Pre-invoices take PREPAYMENTS only — payments unlock at receiving
    // (lifecycle spec 7/15/26), so they never enter a pay run.
    inv.type !== 'Pre-Invoice'
  );
}

// Same catalog as the Vendor Invoicing listing (rev 7/16/26): this tab IS
// that table, just pre-scoped to approved invoices awaiting payment.
const READY_COLUMN_CATALOG: { key: string; label: string }[] = [
  { key: 'invoiceNumber', label: 'Invoice ID' },
  { key: 'type', label: 'Invoice Type' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'vendorInvoiceNumber', label: 'Vendor Invoice No.' },
  { key: 'invoiceDate', label: 'Vendor Invoice Date' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'approvalStatus', label: 'Invoice Status' },
  { key: 'paymentStatus', label: 'Payment Status' },
  { key: 'amount', label: 'Amount' },
  // Linked Records sits after Amount (feedback 7/16/26).
  { key: 'linkedRecords', label: 'Linked Records' },
  // Early-pay discount rides just before Amount Due (8/31/26), the run
  // Step 1 order, so the pay queue reads the same as the run pool.
  { key: 'discount', label: 'Discount' },
  { key: 'outstandingBalance', label: 'Amount Due' },
  { key: 'apAccount', label: 'A/P Account' },
  { key: 'currency', label: 'Currency' },
  { key: 'description', label: 'Description' },
  { key: 'updatedBy', label: 'Last Updated By' },
  { key: 'updatedDate', label: 'Last Updated On' },
  { key: 'createdBy', label: 'Created By' },
  { key: 'createdDate', label: 'Created On' },
];

const LOCKED_COLUMNS = ['invoiceNumber'];
// All four audit columns show by default on every grid (Eli 10/5: "one
// of the most common ways to find something"; last-modified joined 10/30).
const DEFAULT_HIDDEN = new Set(['apAccount', 'currency', 'description']);

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Quick-filter axes (7/16/26): the same compact dropdowns as the other
// listings. Type folds the receiving flavors into one option; due date
// slices the pay run by urgency.
const READY_TYPE_GROUPS: { id: string; label: string; values: string[] }[] = [
  { id: 'receiving', label: 'Inventory', values: ['PO-based', 'Receiving-based', 'GRN-based'] },
  { id: 'standalone', label: 'Standalone', values: ['Standalone'] },
];

interface ReadyToPayTableProps {
  invoices: Invoice[];
  onViewInvoice: (invoiceId: string) => void;
  /** Kick off the record-payment flow, optionally seeded with these invoices. */
  onRecordPayment: (invoiceIds: string[]) => void;
  /** Start a payment run seeded with these invoices (7/29/26): always on
   *  offer — a single-vendor run is legal, vendor is just a filter. A
   *  multi-vendor selection can ONLY run (one payment per pay-to vendor). */
  onStartPaymentRun?: (invoiceIds: string[]) => void;
  /** Live selection mirror (Jennifer 9/1/26): the page-header "Start
   *  payment run" CTA seeds the run with whatever is ticked here, so a
   *  selection made on the listing carries into the flow no matter
   *  which button starts it. */
  onLiveSelectionChange?: (invoiceIds: string[]) => void;
  /** invoiceId → runId for invoices already sitting in an open run. */
  lockedInvoiceIds?: Map<string, string>;
  /** Invoice numbers covered by a recorded SCHEDULED payment (9/22/26
   *  review response, GPT C07-D1): their money is committed, so they
   *  leave this queue until the payment posts or reverses. */
  scheduledInvoiceNumbers?: Set<string>;
  /** Listing tab strip, rendered between the summary and the table so the
   *  V2 tabs sit directly above this table too. */
  tabSlot?: ReactNode;
}

export function ReadyToPayTable({
  invoices,
  onViewInvoice,
  onRecordPayment,
  onStartPaymentRun,
  onLiveSelectionChange,
  lockedInvoiceIds,
  scheduledInvoiceNumbers,
  tabSlot,
}: ReadyToPayTableProps) {
  // Performance Insights date range (same control as the rest of the
  // module). THIS tab defaults to All time (9/22/26 review response,
  // Claude C07-D2): the cards describe the actual queue below them —
  // "Awaiting 69" over a queue of 111 read as a defect, not a window.
  // Narrower ranges stay one click away.
  const [insightsRange, setInsightsRange] = useState<InsightsRange>('all_time');
  const [insightsCustom, setInsightsCustom] = useState<{ from: string; to: string }>({ from: '', to: '' });
  // The table always shows every payable invoice regardless of the range;
  // the range only scopes the KPI band (module pattern, so an approved
  // invoice never disappears from the pay run just because it's older).
  // A recorded run's invoices leave the queue (9/22/26, GPT C07-D1):
  // their scheduled payments have the money committed, so offering them
  // here again is the double-payment door.
  // An invoice reserved in an OPEN run leaves the queue too (Eli 9/24
  // R06): the run owns it until it pays out or the run is cancelled.
  const inQueue = (inv: Invoice) => isReadyToPay(inv) && !scheduledInvoiceNumbers?.has(inv.invoiceNumber) && !lockedInvoiceIds?.has(inv.id);
  const readyInvoices = invoices.filter(inQueue);
  const rangedReadyInvoices = filterInvoicesByRange(
    invoices,
    insightsRange,
    insightsRange === 'custom' ? insightsCustom : undefined,
  ).filter(inQueue);

  // Customizable Performance Insights (Add insights drawer + drag/remove),
  // matching the Payments tab.
  // v2: KPI set replaced 7/14/26 (Ready to pay / Overdue / Due today / Due
  // this week / Oldest invoice / Largest invoice / Next due date) — bump
  // drops saved sets pointing at retired keys.
  const READY_KPI_STORAGE_KEY = 'omnesoft:ready-to-pay:active-widgets-v2';
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);
  // One-click Hide (Eli 7/22/26): collapse the whole band without toggling
  // every widget off. The toolbar Insights button is the way back in.
  const [showInsights, setShowInsights] = useState(true);
  const [activeKpiKeys, setActiveKpiKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(READY_KPI_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as string[];
    } catch { /* ignore */ }
    return DEFAULT_READY_KPI_KEYS;
  });
  const persistKpis = (next: string[]) => {
    try { localStorage.setItem(READY_KPI_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const handleToggleKpi = (key: string) => {
    setActiveKpiKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      persistKpis(next);
      return next;
    });
  };
  const handleRemoveKpi = (key: string) => {
    setActiveKpiKeys((prev) => {
      const next = prev.filter((k) => k !== key);
      persistKpis(next);
      return next;
    });
  };
  const handleInsightsReset = () => {
    setActiveKpiKeys(DEFAULT_READY_KPI_KEYS);
    persistKpis(DEFAULT_READY_KPI_KEYS);
    toast.info('Insights reset', { description: 'Restored the default widgets and order.' });
  };
  // Reset only lights up when there's something to undo: a different widget
  // set OR a drag-and-drop reorder (join is order-sensitive on purpose).
  const insightsDirty = activeKpiKeys.join(',') !== DEFAULT_READY_KPI_KEYS.join(',');
  const moveKpi = useCallback((from: number, to: number) => {
    setActiveKpiKeys((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persistKpis(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Mirror the live selection up so the page-header CTA can seed a run
  // with it; clear the mirror when this table unmounts (tab switch).
  useEffect(() => {
    onLiveSelectionChange?.(selectedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);
  useEffect(() => () => onLiveSelectionChange?.([]), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  // Density control (user 9/26): the system-standard Condensed/Comfort
  // menu — every listing carries it. No card view for payments.
  const [density, setDensity] = useState<'condensed' | 'comfort'>('condensed');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  // No seeds here — the section stays hidden until the user stars a view.
  const { views: savedViews, saveView, deleteView, toggleStar } = useSavedViews([]);
  const applySavedFilters = (filters: any) => {
    setColumnFilters(filters ?? {});
    setCurrentPage(1);
  };

  // Column order/visibility are session-only (rev 7/16/26): a refresh
  // always restores the catalog's default flow, so rearrangements never
  // stick past the page load.
  const [columnOrder, setColumnOrder] = useState<string[]>(() => READY_COLUMN_CATALOG.map((c) => c.key));
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(READY_COLUMN_CATALOG.map((c) => [c.key, !DEFAULT_HIDDEN.has(c.key)])),
  );
  // Column drawer Reset restores this default view and remounts the
  // table so dragged widths snap back too (10/9/26).
  const [columnResetKey, setColumnResetKey] = useState(0);
  const updateColumnOrder = (next: string[]) => setColumnOrder(next);
  const updateColumnVisibility = (next: Record<string, boolean>) => setColumnVisibility(next);
  const visibleColumnCount = READY_COLUMN_CATALOG.filter(
    (c) => columnVisibility[c.key] !== false
  ).length;

  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'dueDate', direction: 'asc' });

  const handleColumnSort = (columnKey: string, direction: 'asc' | 'desc' | null) => {
    setSortConfig(direction === null ? null : { key: columnKey, direction });
    setCurrentPage(1);
  };
  const handleColumnFilterChange = (columnKey: string, filter: ColumnFilterState) => {
    setColumnFilters((prev) => {
      const next = { ...prev, [columnKey]: filter };
      if (!isInvoiceFilterActive(filter)) delete next[columnKey];
      return next;
    });
    setCurrentPage(1);
  };
  const handleAddColumnFilter = (columnKey: string) => {
    setColumnFilters((prev) => {
      if (prev[columnKey]) return prev;
      const fromCatalog = (INVOICE_COLUMNS as { key: string; filterType?: ColumnFilterState['type'] }[]).find(
        (c) => c.key === columnKey
      );
      const type: ColumnFilterState['type'] = fromCatalog?.filterType ?? 'text';
      return {
        ...prev,
        [columnKey]: { columnKey, type, values: [], text: '', min: '', max: '', dateFrom: '', dateTo: '' },
      };
    });
  };
  const handleHideColumn = (columnKey: string) => {
    if (LOCKED_COLUMNS.includes(columnKey)) return;
    updateColumnVisibility({ ...columnVisibility, [columnKey]: false });
  };

  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(() => new Set(LOCKED_COLUMNS));
  const handleFreezeColumn = (columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && !LOCKED_COLUMNS.includes(columnKey)) next.delete(columnKey);
      else next.add(columnKey);
      return next;
    });
  };

  // Quick-filter dropdowns (7/16/26): type, due-date urgency (with a
  // custom calendar range), vendor, creator, currency and A/P account —
  // multi-select, empty = filter off. Me mode removed entirely (user 10/5).
  const [typeQuick, setTypeQuick] = useState<string[]>([]);
  // Payment-status + payment-terms axes (user 10/5 — "pull the same pills
  // as vendor invoicing"; also Eli's 10/5 ask for a payment-status filter
  // on Invoices to Pay). Invoice-status is intentionally absent: every row
  // here is Approved, so that axis would be a single degenerate option.
  const [paymentStatusQuick, setPaymentStatusQuick] = useState<string[]>([]);
  const [paymentTermsQuick, setPaymentTermsQuick] = useState<string[]>([]);
  const [dueQuick, setDueQuick] = useState<string[]>([]);
  const [dueCustomRange, setDueCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [vendorQuick, setVendorQuick] = useState<string[]>([]);
  const [createdByQuick, setCreatedByQuick] = useState<string[]>([]);
  const [currencyQuick, setCurrencyQuick] = useState<string[]>([]);
  const [apAccountQuick, setApAccountQuick] = useState<string[]>([]);
  // Early-pay discount pill (8/31/26), the run Step 1 axis: 'with' keeps
  // only invoices whose discount window is still open today.
  const [discountQuick, setDiscountQuick] = useState<string[]>([]);

  const typeQuickCounts: Record<string, number> = {};
  const paymentStatusQuickCounts: Record<string, number> = {};
  const paymentTermsQuickCounts: Record<string, number> = {};
  const dueQuickCounts: Record<string, number> = {};
  const vendorQuickCounts: Record<string, number> = {};
  const createdByQuickCounts: Record<string, number> = {};
  const currencyQuickCounts: Record<string, number> = {};
  const apAccountQuickCounts: Record<string, number> = {};
  let discountQuickCount = 0;
  let discountQuickSavings = 0;
  readyInvoices.forEach((inv) => {
    const group = READY_TYPE_GROUPS.find((g) => g.values.includes(inv.type));
    if (group) typeQuickCounts[group.id] = (typeQuickCounts[group.id] ?? 0) + 1;
    const pay = invoiceStatusAxes(inv.status, inv).payment;
    if (pay) paymentStatusQuickCounts[pay] = (paymentStatusQuickCounts[pay] ?? 0) + 1;
    const term = paymentTermsFor(inv);
    paymentTermsQuickCounts[term] = (paymentTermsQuickCounts[term] ?? 0) + 1;
    const bucket = dueBucketOf(inv.dueDate);
    dueQuickCounts[bucket] = (dueQuickCounts[bucket] ?? 0) + 1;
    vendorQuickCounts[inv.vendor] = (vendorQuickCounts[inv.vendor] ?? 0) + 1;
    createdByQuickCounts[inv.createdBy] = (createdByQuickCounts[inv.createdBy] ?? 0) + 1;
    currencyQuickCounts[inv.currency] = (currencyQuickCounts[inv.currency] ?? 0) + 1;
    apAccountQuickCounts[inv.apAccount] = (apAccountQuickCounts[inv.apAccount] ?? 0) + 1;
    const dTerms = discountTermsFor(inv);
    if (discountIsLive(dTerms) && dTerms) {
      discountQuickCount += 1;
      discountQuickSavings += discountAmountOn(inv.outstandingBalance, dTerms);
    }
  });
  const vendorQuickOptions = Object.keys(vendorQuickCounts).sort();
  const paymentStatusQuickOptions = Object.keys(paymentStatusQuickCounts).sort();
  const paymentTermsQuickOptions = Object.keys(paymentTermsQuickCounts).sort();
  const createdByQuickOptions = Object.keys(createdByQuickCounts).sort();
  const currencyQuickOptions = Object.keys(currencyQuickCounts).sort();
  const apAccountQuickOptions = Object.keys(apAccountQuickCounts).sort();

  // Search across the fields a clerk scans when building a pay run.
  const searched = readyInvoices.filter((inv) => {
    if (typeQuick.length > 0) {
      const group = READY_TYPE_GROUPS.find((g) => g.values.includes(inv.type));
      if (!group || !typeQuick.includes(group.id)) return false;
    }
    if (dueCustomRange.from && new Date(inv.dueDate) < new Date(dueCustomRange.from)) return false;
    if (dueCustomRange.to && new Date(inv.dueDate) > new Date(dueCustomRange.to)) return false;
    if (dueQuick.length > 0 && !dueQuick.includes(dueBucketOf(inv.dueDate))) return false;
    if (paymentStatusQuick.length > 0) {
      const pay = invoiceStatusAxes(inv.status, inv).payment;
      if (!pay || !paymentStatusQuick.includes(pay)) return false;
    }
    if (paymentTermsQuick.length > 0 && !paymentTermsQuick.includes(paymentTermsFor(inv))) return false;
    if (vendorQuick.length > 0 && !vendorQuick.includes(inv.vendor)) return false;
    if (createdByQuick.length > 0 && !createdByQuick.includes(inv.createdBy)) return false;
    if (currencyQuick.length > 0 && !currencyQuick.includes(inv.currency)) return false;
    if (apAccountQuick.length > 0 && !apAccountQuick.includes(inv.apAccount)) return false;
    if (discountQuick.includes('with') && !discountIsLive(discountTermsFor(inv))) return false;
    const trimmed = searchQuery.trim();
    if (!trimmed) return true;
    const q = trimmed.toLowerCase();
    // Amounts are searchable too (user 10/5, mirroring the vendor
    // invoicing listing): "49316" finds the $49,316.00 invoice, and the
    // amount-due remainder is matched as well since this is the pay queue.
    const digits = q.replace(/[^0-9.]/g, '');
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.vendor.toLowerCase().includes(q) ||
      inv.vendorInvoiceNumber.toLowerCase().includes(q) ||
      inv.description.toLowerCase().includes(q) ||
      // Every column, shown or not (hidden-column-search, 10/14/26).
      rowMatchesColumns(inv, INVOICE_COLUMNS, trimmed) ||
      (digits.length >= 2 && (
        inv.amount.toFixed(2).includes(digits) ||
        String(Math.round(inv.amount)).includes(digits) ||
        inv.outstandingBalance.toFixed(2).includes(digits) ||
        String(Math.round(inv.outstandingBalance)).includes(digits)
      ))
    );
  });

  // Advanced Filters dialog — a friendlier surface over the SAME per-column
  // filter state the column header menus use, so the active-filters bar
  // stays the single source of truth for what's applied.
  const patchColumnFilter = (
    columnKey: string,
    type: ColumnFilterState['type'],
    patch: Partial<ColumnFilterState>,
  ) => {
    setColumnFilters((prev) => {
      const base: ColumnFilterState =
        prev[columnKey] ?? { columnKey, type, values: [], text: '', min: '', max: '', dateFrom: '', dateTo: '' };
      const nextFilter = { ...base, ...patch };
      const next = { ...prev, [columnKey]: nextFilter };
      if (!isInvoiceFilterActive(nextFilter)) delete next[columnKey];
      return next;
    });
    setCurrentPage(1);
  };
  // Quick-filter groups that moved into the modal (user 9/22) count
  // toward the Filters badge alongside the per-column filters.
  const activeFilterCount =
    Object.keys(columnFilters).length +
    (createdByQuick.length > 0 ? 1 : 0) +
    (apAccountQuick.length > 0 ? 1 : 0) +
    (currencyQuick.length > 0 ? 1 : 0) +
    (discountQuick.length > 0 ? 1 : 0);

  // Table Empty & Error States Standard (11/3/26): every non-search filter.
  const readyEmptyConfig: DataTableEmptyConfig = {
    entity: { singular: 'invoice', plural: 'invoices' },
    totalCount: readyInvoices.length,
    filterCount:
      Object.keys(columnFilters).length +
      typeQuick.length +
      paymentStatusQuick.length +
      paymentTermsQuick.length +
      dueQuick.length +
      (dueCustomRange.from || dueCustomRange.to ? 1 : 0) +
      vendorQuick.length +
      createdByQuick.length +
      currencyQuick.length +
      apAccountQuick.length +
      discountQuick.length,
    onClearSearch: () => { setSearchQuery(''); setCurrentPage(1); },
    onClearFilters: () => {
      setColumnFilters({});
      setTypeQuick([]);
      setPaymentStatusQuick([]);
      setPaymentTermsQuick([]);
      setDueQuick([]);
      setDueCustomRange({ from: '', to: '' });
      setVendorQuick([]);
      setCreatedByQuick([]);
      setCurrencyQuick([]);
      setApAccountQuick([]);
      setDiscountQuick([]);
      setCurrentPage(1);
    },
    onSearch: (q) => { setSearchQuery(q); setCurrentPage(1); },
    // The queue's own first-use copy, kept from before.
    ...(readyInvoices.length === 0
      ? { title: 'Nothing waiting to be paid', description: 'Approved invoices with an open balance show up here, ready for a payment run.' }
      : {}),
  };
  const columnFiltersList = Object.values(columnFilters);
  let processed = applyInvoiceColumnFilters(searched, columnFiltersList, invoiceColumnValue);
  if (sortConfig?.key === MOST_OVERDUE_SORT_KEY) {
    // Due Date → "Most overdue first" (user 10/9).
    processed = [...processed].sort(compareMostOverdue);
  } else if (sortConfig) {
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const key = sortConfig.key;
    // Computed column: discount has no invoice field, sort on the live
    // savings amount (0 when the window is closed).
    const liveDiscountOf = (inv: Invoice) => {
      const dTerms = discountTermsFor(inv);
      return discountIsLive(dTerms) && dTerms ? discountAmountOn(inv.outstandingBalance, dTerms) : 0;
    };
    processed = [...processed].sort((a, b) => {
      const av = key === 'discount' ? liveDiscountOf(a) : (a as any)[key];
      const bv = key === 'discount' ? liveDiscountOf(b) : (b as any)[key];
      if (av == null && bv == null) return 0;
      if (av == null) return -dir;
      if (bv == null) return dir;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }
  const sortedFiltered = processed;

  const startIndex = (currentPage - 1) * recordsPerPage;
  const paginated = sortedFiltered.slice(startIndex, startIndex + recordsPerPage);

  // Selection context feeds the "Selected" KPI + the pay-run CTA.
  const selectedInvoices = readyInvoices.filter((i) => selectedIds.includes(i.id));
  const selectedDue = selectedInvoices.reduce((s, i) => s + i.outstandingBalance, 0);
  const readyCtx = { selectedCount: selectedIds.length, selectedDue };

  // Active KPI cards for the insights grid (customizable via the drawer).
  const activeKpiCards = activeKpiKeys
    .map((key) => {
      const def = ALL_READY_KPI_DEFINITIONS.find((d) => d.key === key);
      if (!def) return null;
      const { value, sub } = computeReadyKpi(key, rangedReadyInvoices, readyCtx);
      return { def, value, sub };
    })
    .filter((c): c is { def: (typeof ALL_READY_KPI_DEFINITIONS)[number]; value: string; sub: string } => !!c);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Performance Insights — customizable KPI grid + date control, matching
          the Payments tab (Add insights drawer, drag/remove, date range). The
          whole band disappears when every widget is removed (partner
          behavior); the toolbar Insights button is the way back in. */}
      {showInsights && activeKpiKeys.length > 0 && (
      <div className="mb-4 shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>
              Performance Insights
            </span>
            <InsightsRangeMenu
              range={insightsRange}
              onRangeChange={setInsightsRange}
              customFrom={insightsCustom.from}
              customTo={insightsCustom.to}
              onCustomChange={(from, to) => setInsightsCustom({ from, to })}
            />
            <InsightsRefresh />
          </div>
          <div className="flex items-center gap-2">
            <InsightsResetButton dirty={insightsDirty} onReset={handleInsightsReset} />
            <button
              onClick={() => setShowInsights(false)}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md text-slate-500 hover:text-foreground hover:bg-slate-100 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
              title="Hide the insights band"
            >
              <EyeOff className="w-3 h-3" />
              Hide
            </button>
            <button
              onClick={() => setInsightsPanelOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
            >
              <Plus className="w-3 h-3" />
              Add Insights
            </button>
          </div>
        </div>
        <DndProvider backend={HTML5Backend}>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {activeKpiCards.map((card, idx) => (
              <DraggableKpiCard
                key={card.def.key}
                index={idx}
                kpiKey={card.def.key}
                label={card.def.label}
                value={card.value}
                sub={card.sub}
                iconName={card.def.iconName}
                iconColor={card.def.iconColor}
                iconBg={card.def.iconBg}
                tooltip={card.def.tooltip}
                moveCard={moveKpi}
                onRemove={() => handleRemoveKpi(card.def.key)}
              />
            ))}
          </div>
        </DndProvider>
      </div>
      )}

      <ReadyToPayInsightsPanel
        open={insightsPanelOpen}
        onOpenChange={setInsightsPanelOpen}
        activeKpis={activeKpiKeys}
        onToggleKpi={handleToggleKpi}
        ready={rangedReadyInvoices}
        ctx={readyCtx}
      />

      {/* Advanced filters — centered dialog (same shell as the invoicing
          listing's Filters modal) writing into the per-column filter state,
          so applied filters surface in the active-filters bar and column
          header menus alike. */}
      <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <DialogContent
          className="max-w-[520px] p-0 overflow-hidden border-0 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] bg-white flex flex-col max-h-[85vh]"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Filters</DialogTitle>
          <DialogDescription className="sr-only">
            Refine the payable invoice list by status, vendor, due date, and amount due.
          </DialogDescription>
          {/* Partner FiltersModal chrome (9/4/26): centered title, round
              close button on the left. */}
          <div className="relative flex items-center justify-center h-12 border-b border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => setAdvancedOpen(false)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-[14px]" style={{ fontWeight: 600 }}>Filters</span>
            {/* Saved Views button and chips removed (user 10/22/26). */}
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* ── Invoice type ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Invoice Type</p>
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const TYPE_GROUPS = [
                    { label: 'Inventory', values: ['PO-based', 'Receiving-based', 'GRN-based'] },
                    { label: 'Standalone', values: ['Standalone'] },
                  ];
                  const selectedTypes = columnFilters.type?.values ?? [];
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => patchColumnFilter('type', 'multiselect', { values: [] })}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                          selectedTypes.length === 0
                            ? 'border-primary bg-accent text-primary'
                            : 'border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                        style={{ fontWeight: 500 }}
                      >
                        All
                      </button>
                      {TYPE_GROUPS.map((group) => {
                        const groupSelected = group.values.every((v) => selectedTypes.includes(v));
                        const count = readyInvoices.filter((i) => group.values.includes(i.type)).length;
                        return (
                          <button
                            key={group.label}
                            type="button"
                            onClick={() =>
                              patchColumnFilter('type', 'multiselect', {
                                values: groupSelected
                                  ? selectedTypes.filter((v) => !group.values.includes(v))
                                  : Array.from(new Set([...selectedTypes, ...group.values])),
                              })
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                              groupSelected
                                ? 'border-primary bg-accent text-primary'
                                : 'border-border bg-white text-foreground hover:bg-muted/50'
                            }`}
                            style={{ fontWeight: 500 }}
                          >
                            {group.label}
                            <span
                              className="text-[10px] rounded-full px-1.5 py-px"
                              style={{
                                backgroundColor: groupSelected ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                                color: groupSelected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                                fontWeight: 600,
                              }}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ── Vendor ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Vendor</p>
              <Input
                placeholder="Filter by vendor name..."
                className="h-9 text-sm bg-white"
                value={columnFilters.vendor?.text ?? ''}
                onChange={(e) => patchColumnFilter('vendor', 'text', { text: e.target.value })}
              />
            </div>

            {/* ── Due date range ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Due Date</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>From</p>
                  <Input
                    type="date"
                    className="h-9 text-sm bg-white"
                    value={columnFilters.dueDate?.dateFrom ?? ''}
                    onChange={(e) => patchColumnFilter('dueDate', 'date', { dateFrom: e.target.value })}
                  />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>To</p>
                  <Input
                    type="date"
                    className="h-9 text-sm bg-white"
                    value={columnFilters.dueDate?.dateTo ?? ''}
                    onChange={(e) => patchColumnFilter('dueDate', 'date', { dateTo: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* ── Amount due range ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Amount Due</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>Min</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 ">$</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="h-9 text-sm bg-white pl-7 "
                      value={formatMoneyText(columnFilters.outstandingBalance?.min ?? '')}
                      onChange={(e) => patchColumnFilter('outstandingBalance', 'range', { min: e.target.value.replace(/[^\d.]/g, '') })}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>Max</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 ">$</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="No limit"
                      className="h-9 text-sm bg-white pl-7 "
                      value={formatMoneyText(columnFilters.outstandingBalance?.max ?? '')}
                      onChange={(e) => patchColumnFilter('outstandingBalance', 'range', { max: e.target.value.replace(/[^\d.]/g, '') })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Created by / A/P account / Currency / Discount — moved
                off the toolbar (user 9/22): the same quick-filter state,
                edited from here. Pill groups match the Invoice type
                section above. ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Created By</p>
              <div className="flex flex-wrap gap-1.5">
                {createdByQuickOptions.map((v) => {
                  const on = createdByQuick.includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { setCreatedByQuick(on ? createdByQuick.filter((x) => x !== v) : [...createdByQuick, v]); setCurrentPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        on ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-foreground hover:bg-muted/50'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {v}
                      <span className="text-[10px] rounded-full px-1.5 py-px" style={{ backgroundColor: on ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))', color: on ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))', fontWeight: 600 }}>
                        {createdByQuickCounts[v] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>A/P Account</p>
              <div className="flex flex-wrap gap-1.5">
                {apAccountQuickOptions.map((v) => {
                  const on = apAccountQuick.includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { setApAccountQuick(on ? apAccountQuick.filter((x) => x !== v) : [...apAccountQuick, v]); setCurrentPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        on ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-foreground hover:bg-muted/50'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {v}
                      <span className="text-[10px] rounded-full px-1.5 py-px" style={{ backgroundColor: on ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))', color: on ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))', fontWeight: 600 }}>
                        {apAccountQuickCounts[v] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Currency</p>
              <div className="flex flex-wrap gap-1.5">
                {currencyQuickOptions.map((v) => {
                  const on = currencyQuick.includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { setCurrencyQuick(on ? currencyQuick.filter((x) => x !== v) : [...currencyQuick, v]); setCurrentPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        on ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-foreground hover:bg-muted/50'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {v}
                      <span className="text-[10px] rounded-full px-1.5 py-px" style={{ backgroundColor: on ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))', color: on ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))', fontWeight: 600 }}>
                        {currencyQuickCounts[v] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Early-Pay Discount</p>
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const on = discountQuick.includes('with');
                  return (
                    <button
                      type="button"
                      onClick={() => { setDiscountQuick(on ? [] : ['with']); setCurrentPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        on ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-foreground hover:bg-muted/50'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      Discount Available · {money(Math.round(discountQuickSavings * 100) / 100)}
                      <span className="text-[10px] rounded-full px-1.5 py-px" style={{ backgroundColor: on ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))', color: on ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))', fontWeight: 600 }}>
                        {discountQuickCount}
                      </span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-5 h-14 border-t border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => { setColumnFilters({}); setCreatedByQuick([]); setApAccountQuick([]); setCurrencyQuick([]); setDiscountQuick([]); setCurrentPage(1); }}
              disabled={activeFilterCount === 0}
              className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={() => setAdvancedOpen(false)}
              className="h-9 px-5 rounded-lg text-[13px] text-white bg-primary hover:bg-[#0862D0] transition-colors cursor-pointer border-0"
              style={{ fontWeight: 600 }}
            >
              Show {sortedFiltered.length} invoice{sortedFiltered.length !== 1 ? 's' : ''}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <SavedViewsDialog
        open={savedViewsOpen}
        onOpenChange={setSavedViewsOpen}
        currentFilters={columnFilters}
        onApplyView={applySavedFilters}
        views={savedViews}
        onSaveView={(name) => saveView(name, columnFilters)}
        onDeleteView={deleteView}
        onToggleStar={toggleStar}
      />

      {/* Unified table container */}
      <div className="border border-border rounded-xl bg-card flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* V2 listing tabs — inside the card, above the toolbar. */}
          {tabSlot}
          {/* Search + count + column selector. Its top is the drag-to-hide
              line for the table's headers (10/14/26). */}
          <div data-col-hide-edge className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3 shrink-0">
            {/* Search + Filters together on the LEFT (user 9/25) — the
                vendor invoicing listing's arrangement. */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                placeholder="Search by invoice no, vendor, amount, or vendor invoice no..."
                className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
              <button
                onClick={() => setAdvancedOpen(true)}
                className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  advancedOpen || activeFilterCount > 0
                    ? 'border-primary/30 bg-primary/[0.04] text-foreground'
                    : 'border-border bg-white text-foreground hover:bg-muted/40'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground/80" />
                <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Filters</span>
                {activeFilterCount > 0 && (
                  <span
                    className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]"
                    style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--primary))', fontWeight: 600 }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                <span className="text-foreground">{sortedFiltered.length}</span>
                <span className="text-muted-foreground/60"> of </span>
                <span className="text-muted-foreground">{readyInvoices.length}</span>
                <span className="text-muted-foreground/70"> invoices</span>
              </span>
              <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />
              <button
                onClick={() => {
                  if (!showInsights) setShowInsights(true);
                  setInsightsPanelOpen(true);
                }}
                className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  insightsPanelOpen
                    ? 'border-primary/30 bg-primary/[0.04] text-foreground'
                    : 'border-border bg-white text-foreground hover:bg-muted/40'
                }`}
              >
                <ChartColumn className="w-[18px] h-[18px] text-muted-foreground/80" />
                <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                  Insights
                </span>
                <span
                  className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]"
                  style={{
                    backgroundColor: 'hsl(var(--accent))',
                    color: 'hsl(var(--primary))',
                    fontWeight: 600,
                  }}
                >
                  {activeKpiKeys.length}
                </span>
              </button>
              {/* System-standard density control (user 9/26) — card view
                  intentionally absent on the payments listing. */}
              <ViewDensityMenu
                density={density}
                onDensityChange={(next) => { if (next !== 'card') setDensity(next); }}
                hideCard
              />
              <ColumnSelectorTrigger
                visibleCount={visibleColumnCount}
                active={columnDrawerOpen}
                onClick={() => setColumnDrawerOpen((o) => !o)}
              />
            </div>
          </div>

          {/* Quick-filter dropdowns (7/16/26; payment-status + terms added
              10/5): the invoice-status axis is omitted because every row is
              Approved, but payment status, payment terms, due-date urgency,
              vendor and type all slice the pay run — the same pill set as the
              vendor invoicing listing. Hidden while the bulk bar is active. */}
          <div
            className={`flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0 ${
              selectedIds.length > 0 ? 'hidden' : ''
            }`}
          >
            {/* Me mode chip removed entirely (user 10/5). */}
            {/* Priority order left to right (feedback 7/16/26): the pay
                queue slices by urgency first, then who, then what, then
                the audit slicers. */}
            {/* Payment status axis (user 10/5 / Eli 10/5): Unpaid vs
                Partially paid — the pay queue's only live money states. */}
            <MultiSelectFilter
              label="Payment Status"
              options={paymentStatusQuickOptions.map((v) => ({ id: v, label: v, count: paymentStatusQuickCounts[v] ?? 0 }))}
              selected={paymentStatusQuick}
              onChange={(next) => { setPaymentStatusQuick(next); setCurrentPage(1); }}
            />
            <DueDateFilter
              buckets={DUE_BUCKETS.map((b) => ({ id: b, label: b, count: dueQuickCounts[b] ?? 0 }))}
              selected={dueQuick}
              onChange={(next) => { setDueQuick(next); setCurrentPage(1); }}
              customFrom={dueCustomRange.from}
              customTo={dueCustomRange.to}
              onCustomChange={(from, to) => { setDueCustomRange({ from, to }); setCurrentPage(1); }}
            />
            <MultiSelectFilter
              label="Vendor"
              searchable
              options={vendorQuickOptions.map((v) => ({ id: v, label: v, count: vendorQuickCounts[v] ?? 0 }))}
              selected={vendorQuick}
              onChange={(next) => { setVendorQuick(next); setCurrentPage(1); }}
            />
            <MultiSelectFilter
              label="Invoice Type"
              options={READY_TYPE_GROUPS.map((g) => ({ id: g.id, label: g.label, count: typeQuickCounts[g.id] ?? 0 }))}
              selected={typeQuick}
              onChange={(next) => { setTypeQuick(next); setCurrentPage(1); }}
            />
            {/* Payment terms axis (user 10/5 — parity with vendor invoicing). */}
            <MultiSelectFilter
              label="Payment Terms"
              searchable
              options={paymentTermsQuickOptions.map((v) => ({ id: v, label: v, count: paymentTermsQuickCounts[v] ?? 0 }))}
              selected={paymentTermsQuick}
              onChange={(next) => { setPaymentTermsQuick(next); setCurrentPage(1); }}
            />
            {/* Toolbar diet (user 9/22, the invoice listing's Eli 9/8
                rule applied here): Created By, A/P Account, Currency and
                Discount left the toolbar — their sections in the Filters
                modal edit the same state. The toolbar keeps urgency
                (Due Date), who (Vendor) and what (Invoice Type). */}
          </div>

          {/* Bulk action bar. One pay-to vendor = record a single payment OR
              start a run; more than one pay-to vendor can only run (a run
              posts one payment per vendor, 7/29/26). Rows already locked in
              an open run are stripped from the run seeding. */}
          {selectedIds.length > 0 && (() => {
            const runVendorCount = new Set(selectedInvoices.map((i) => i.vendor)).size;
            const multiVendor = runVendorCount > 1;
            const startRun = () => {
              const free = selectedIds.filter((id) => !lockedInvoiceIds?.has(id));
              const held = selectedIds.length - free.length;
              if (held > 0) {
                toast.info(`${held} invoice${held === 1 ? '' : 's'} already in an open run`, {
                  description: 'They were left out of the new run.',
                });
              }
              onStartPaymentRun!(free);
            };
            const actions: BulkAction[] = [];
            if (!multiVendor) {
              actions.push({
                key: 'recordPayment',
                label: `Record Payment · ${money(selectedDue)}`,
                tone: 'success',
                onClick: () => onRecordPayment(selectedIds),
              });
            }
            if (onStartPaymentRun) {
              actions.push({
                key: 'startRun',
                label: multiVendor
                  ? `Start a Payment Run · ${money(selectedDue)} · ${runVendorCount} Vendors`
                  : 'Start a Payment Run',
                tone: 'primary',
                onClick: startRun,
              });
            }
            return (
              <BulkActionBar
                count={selectedIds.length}
                noun="invoice"
                actions={actions}
                onClear={() => setSelectedIds([])}
              />
            );
          })()}

          {/* Active per-column filter chips */}
          <InvoiceActiveFiltersBar
            columnFilters={columnFilters}
            columnLabels={Object.fromEntries(READY_COLUMN_CATALOG.map((c) => [c.key, c.label]))}
            onRemoveFilter={(key) =>
              setColumnFilters((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              })
            }
            onClearAll={() => setColumnFilters({})}
          />

          <div className="border-t border-border shrink-0" />

          {/* Body */}
          <div className="flex-1 min-h-0 flex flex-col">
            {(
              <InvoiceDataTable
                key={`cols-${columnResetKey}`}
                invoices={paginated}
                optionRows={readyInvoices}
                searchRows={sortedFiltered}
                selectedIds={new Set(selectedIds)}
                onSelectionChange={(next) => setSelectedIds(Array.from(next))}
                columnOrder={columnOrder}
                onColumnOrderChange={updateColumnOrder}
                columnVisibility={columnVisibility}
                columnFilters={columnFilters}
                onColumnFilterChange={handleColumnFilterChange}
                onAddColumnFilter={handleAddColumnFilter}
                onHideColumn={handleHideColumn}
                sortConfig={sortConfig}
                onSort={handleColumnSort}
                frozenColumns={frozenColumns}
                onFreezeColumn={handleFreezeColumn}
                density={density}
                searchQuery={searchQuery}
                promoteRowAction="addPayment"
                emptyConfig={readyEmptyConfig}
                currentPage={currentPage}
                recordsPerPage={recordsPerPage}
                totalRows={sortedFiltered.length}
                onPageChange={setCurrentPage}
                onRecordsPerPageChange={(n) => {
                  setRecordsPerPage(n);
                  setCurrentPage(1);
                }}
                onRowClick={(invoice) => onViewInvoice(invoice.id)}
                onRowAction={(actionId, invoiceId, e) => {
                  e.stopPropagation();
                  if (actionId === 'addPayment') {
                    onRecordPayment([invoiceId]);
                    return;
                  }
                  onViewInvoice(invoiceId);
                }}
              />
            )}
          </div>
        </div>
        <ColumnSelector
          columns={READY_COLUMN_CATALOG}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          onColumnOrderChange={updateColumnOrder}
          onColumnVisibilityChange={updateColumnVisibility}
          lockedColumns={LOCKED_COLUMNS}
          frozenColumns={frozenColumns}
          onFreezeColumn={handleFreezeColumn}
          open={columnDrawerOpen}
          onOpenChange={setColumnDrawerOpen}
          defaultColumnOrder={READY_COLUMN_CATALOG.map((c) => c.key)}
          defaultColumnVisibility={Object.fromEntries(READY_COLUMN_CATALOG.map((c) => [c.key, !DEFAULT_HIDDEN.has(c.key)]))}
          onReset={() => setColumnResetKey((k) => k + 1)}
        />
      </div>
    </div>
  );
}
