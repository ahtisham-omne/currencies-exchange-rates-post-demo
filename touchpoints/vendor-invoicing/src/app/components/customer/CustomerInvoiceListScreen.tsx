import { useState, useCallback, useRef, useMemo, Fragment } from 'react';
import dayjs from 'dayjs';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Search,
  X,
  Plus,
  Plus as PlusIcon,
  FileText,
  ChartColumn,
  Info,
  GripVertical,
  Trash2,
  EyeOff,
  SlidersHorizontal,
  LayoutGrid,
  Download,
  Upload,
  Receipt,
  Archive,
  CheckCheck,
  Ban,
  Send,
  AlertTriangle,
  Eye,
  MoreHorizontal,
  Flag,
} from 'lucide-react';
import { DatePicker } from '@/app/components/ui/date-picker';
import type { Customer } from '@/app/data/ar/mockCustomers';
import { useArPermissions } from '@/app/hooks/useArSettings';
import type { ArCreateEntry } from '@/app/components/customer/arCreateContract';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { SavedViewsDialog, SavedViewsSection, useSavedViews } from '@/app/components/SavedViewsDialog';
import { ExportDialog } from '@/app/components/ExportDialog';
import { rowMatchesColumns } from '@/app/components/data-table';
import { useTableStates, type DataTableEmptyConfig } from '@/app/components/data-table/DataTable';
import { TableEmptyState, CardSkeletonGrid, TableStaleBanner } from '@/app/components/ui/table-empty-state';
import { SearchSelectPeople } from '@/app/components/SearchSelectPeople';
import { formatMoneyText } from '@/app/components/payments/MoneyInput';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import type { CustomerInvoice, CustomerDocKind } from '@/app/data/ar/mockCustomerInvoices';
import type { CustomerDeposit } from '@/app/data/ar/mockCustomerDeposits';
import { netDue, paymentStatusOf } from '@/app/data/ar/customerInvoiceStatus';
import { getCustomerRowActionGroups, getCustomerRowActions, type CustomerInvoiceActionId } from '@/app/data/ar/customerInvoiceActions';
import { BulkActionBar, type BulkAction } from '@/app/components/BulkActionBar';
import { CreatedByCell } from '@/app/components/InvoiceDataTable';
import { actionToneClass, type ActionTone } from '@/app/lib/actionMenuTone';
import { Label } from '@/app/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  CustomerInvoiceDataTable,
  CUSTOMER_INVOICE_COLUMNS,
  CUSTOMER_COLUMN_CATALOG,
  LOCKED_CUSTOMER_COLUMNS,
  CUSTOMER_TYPE_CONFIG,
  renderCustomerInvoiceStatus,
  renderCustomerPaymentStatus,
  invoiceStatusLabelOf,
  signedAmountOf,
  paymentTermsOf,
  CustomerCell,
  CUSTOMER_ACTION_ICONS,
  DEFAULT_CUSTOMER_COLUMN_VISIBILITY,
  decorateCustomerListingRows,
  listingCreditAppliedTotal,
  listingDepositsTotal,
} from '@/app/components/customer/CustomerInvoiceDataTable';
import {
  CustomerInvoiceInsightsPanel,
  ALL_CUSTOMER_KPI_DEFINITIONS,
  DEFAULT_CUSTOMER_KPI_KEYS,
  filterCustomerInvoicesByRange,
  filterCustomerInvoicesByPreviousRange,
  computeCustomerKpi,
  CustomerKpiIcon,
  type CustomerKpiDefinition,
  type KpiDelta,
  type InsightsRange,
} from '@/app/components/customer/CustomerInvoiceInsightsPanel';
import { InsightsRangeMenu, INSIGHTS_RANGE_OPTIONS } from '@/app/components/InsightsRangeMenu';
import { InsightsResetButton } from '@/app/components/InsightsResetButton';
import { InsightsRefresh } from '@/app/components/InsightsRefresh';
import { MultiSelectFilter } from '@/app/components/data-table/MultiSelectFilter';
import { dueBucketOf, formatUsDate, overdueDaysOf, overdueLabel } from '@/app/lib/dueBucket';
import { ViewDensityMenu } from '@/app/components/data-table/ViewDensityMenu';
import { ColumnSelector, ColumnSelectorTrigger } from '@/app/components/ColumnSelector';
import {
  applyColumnFilters,
  isFilterActive,
  type ColumnFilterState,
  type SortConfig,
} from '@/app/components/data-table';
import { InvoiceActiveFiltersBar } from '@/app/components/InvoiceActiveFiltersBar';
import { toast } from 'sonner';
import { palette } from '@/styles/tokens';

// ─── Quick-filter taxonomies (PRD §5.4, §14) ───
// Status is the approval axis exactly as the Status pill prints it
// (invoiceStatusLabelOf), so the filter and the pill always agree. Sent
// is a flag with its own column; Archived is a cancelled invoice that
// stays out of the default view.
const INVOICE_STATUS_OPTIONS = [
  'Draft',
  'Pending Approval',
  'Approved',
  // An open exception now reads as the status (vendor parity, user 11/3).
  'Exception',
  'Rejected',
  'Cancelled',
  'Archived',
  // FAD 11/2: a version replaced by a revision.
  'Revised',
] as const;
const INVOICE_DATE_OPTIONS: { id: string; label: string; days: number | null }[] = [
  { id: 'all', label: 'All Time', days: null },
  { id: '30d', label: 'Last 30 Days', days: 30 },
  { id: '90d', label: 'Last 90 Days', days: 90 },
  { id: '6m', label: 'Last 6 Months', days: 182 },
  { id: '12m', label: 'Last 12 Months', days: 365 },
];
type ListTab = 'ready' | 'all';
// Saved Views parked, vendor parity (vendor listing SHOW_SAVED_VIEWS = false, user 9/28).
const SHOW_SAVED_VIEWS = false;
// Payment axis is derived via paymentStatusOf(); pre-invoices surface their
// deposit pair here, credit memos (null) never match while the filter is on.
const PAYMENT_STATUS_OPTIONS = [
  'Unpaid',
  'Partially Paid',
  'Paid',
  'Overdue',
  'Written Off',
  'Cancelled',
  'Deposit Awaited',
  'Deposit Received',
] as const;
const DOC_KIND_OPTIONS: CustomerDocKind[] = [
  'Shipment Invoice',
  'Advance Invoice',
  'Standalone',
];

// Column accessor map — reuses the table catalog's getValue so per-column
// filters and sorting read the exact values the cells render from.
const COLUMN_BY_KEY = new Map(CUSTOMER_INVOICE_COLUMNS.map((c) => [c.key, c]));
const columnValueOf = (row: CustomerInvoice, columnKey: string): unknown =>
  COLUMN_BY_KEY.get(columnKey)?.getValue(row);

interface CustomerInvoiceListScreenProps {
  invoices: CustomerInvoice[];
  deposits: CustomerDeposit[];
  /** Live customer book: Ready to Invoice rows and the KPI band derive from it. */
  customers: Customer[];
  /** Opens the creation flow; Ready to Invoice passes an entry that skips steps. */
  onCreateInvoice: (entry?: ArCreateEntry) => void;
  /** Opens the shared import pipeline (header parity with the vendor listing, user 9/25). */
  onImportInvoices?: () => void;
  onViewInvoice: (invoiceId: string) => void;
  /** Row-menu actions bubble up; unhandled ones the parent will toast. */
  onRowAction?: (actionId: CustomerInvoiceActionId, invoiceId: string) => void;
  /** Bulk bar actions on the eligible selected ids (optional; App may wire it). */
  onBulkAction?: (actionId: CustomerInvoiceActionId, invoiceIds: string[]) => void;
}

type DensityMode = 'condensed' | 'comfort' | 'card';

export function CustomerInvoiceListScreen({
  invoices: allInvoices,
  deposits,
  customers,
  onCreateInvoice,
  onImportInvoices,
  onViewInvoice,
  onRowAction,
  onBulkAction,
}: CustomerInvoiceListScreenProps) {
  const perms = useArPermissions();
  // User 11/4: a credit memo is not an invoice type, it lives inside the
  // invoice it credits. The listing (rows, counts, KPIs, options) drops
  // credit memo rows; each invoice carries its credit memos and deposits.
  const invoices = useMemo(() => decorateCustomerListingRows(allInvoices, deposits), [allInvoices, deposits]);
  // One view only (10/29, again 11/2): the Ready to Invoice pill is off
  // the data table; the queue lives on through the KPI band.
  const activeTab = 'all' as ListTab;
  const [showArchived, setShowArchived] = useState(false);
  // FAD 11/2: Disputed and Exception toggles, the vendor On Hold recipe.
  const [disputedOnly, setDisputedOnly] = useState(false);
  const [invDatePeriod, setInvDatePeriod] = useState<string>('all');
  // ─── Quick-filter state (all default to All = empty) ───
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<string[]>([]);
  const [typeQuickFilter, setTypeQuickFilter] = useState<string[]>([]);
  const [dueQuickFilter, setDueQuickFilter] = useState<string[]>([]);
  const [dueCustomRange, setDueCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [customerQuickFilter, setCustomerQuickFilter] = useState<string[]>([]);
  const [createdByQuickFilter, setCreatedByQuickFilter] = useState<string[]>([]);
  const [currencyQuickFilter, setCurrencyQuickFilter] = useState<string[]>([]);
  const [arAccountQuickFilter, setArAccountQuickFilter] = useState<string[]>([]);
  const [termsQuickFilter, setTermsQuickFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  // Header Export (user 9/25 parity pass) — the shared restyled dialog.
  const [showExportDialog, setShowExportDialog] = useState(false);

  // ─── Advanced filters (9/4/26) — module-standard partner-chrome modal
  // with starred saved views. The modal edits the SAME quick-filter state
  // plus two facets only it owns (invoice date range, amount range). ───
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const { views: savedViews, saveView, deleteView, toggleStar } = useSavedViews([]);
  const [invDateRange, setInvDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');

  // ─── Density + card size (persisted like the vendor list) ───
  const DENSITY_STORAGE_KEY = 'omnesoft:customer-invoices:density';
  const [densityMode, setDensityModeRaw] = useState<DensityMode>(() => {
    try {
      const v = localStorage.getItem(DENSITY_STORAGE_KEY);
      if (v === 'condensed' || v === 'comfort' || v === 'card') return v;
    } catch {
      /* ignore */
    }
    return 'condensed';
  });
  const setDensityMode = (next: DensityMode) => {
    setDensityModeRaw(next);
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };
  const CARD_SIZE_STORAGE_KEY = 'omnesoft:customer-invoices:card-size';
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>(() => {
    try {
      const v = localStorage.getItem(CARD_SIZE_STORAGE_KEY);
      // 'large' is parked like the vendor listing (user 10/1): a stored
      // large preference falls back to medium.
      if (v === 'small' || v === 'medium') return v;
    } catch {
      /* ignore */
    }
    return 'medium';
  });
  const updateCardSize = (next: 'small' | 'medium' | 'large') => {
    setCardSize(next);
    try {
      localStorage.setItem(CARD_SIZE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [showInsights, setShowInsights] = useState(true);
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);

  // ─── Insights date range — same chrome as the vendor band ───
  const INSIGHTS_RANGE_STORAGE_KEY = 'omnesoft:customer-invoices:insights-range';
  const [insightsRange, setInsightsRangeRaw] = useState<InsightsRange>(() => {
    try {
      const v = localStorage.getItem(INSIGHTS_RANGE_STORAGE_KEY);
      if (v && INSIGHTS_RANGE_OPTIONS.some((o) => o.key === v)) return v as InsightsRange;
    } catch {
      /* ignore */
    }
    return 'last_30';
  });
  const setInsightsRange = (next: InsightsRange) => {
    setInsightsRangeRaw(next);
    try {
      localStorage.setItem(INSIGHTS_RANGE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };
  const [insightsCustom, setInsightsCustom] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const RANGE_PERIOD_LABEL: Record<InsightsRange, string | undefined> = {
    last_7: '7 days',
    last_30: '30 days',
    last_90: '90 days',
    last_365: '12 months',
    all_time: undefined,
    custom: undefined,
  };
  const insightsPeriodLabel = RANGE_PERIOD_LABEL[insightsRange];

  // ─── Column selector drawer — order/visibility are session-only,
  // matching the vendor listing (rev 7/16/26: refresh restores defaults) ───
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => CUSTOMER_COLUMN_CATALOG.map((c) => c.key));
  // PRD §5.4 columns lead; the payment and audit columns stay in the
  // selector, hidden by default (payment features kept, user decision).
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => ({
    ...DEFAULT_CUSTOMER_COLUMN_VISIBILITY,
  }));
  // Column drawer Reset restores this default view and remounts the
  // table so dragged widths snap back too (10/9/26).
  const [columnResetKey, setColumnResetKey] = useState(0);
  const updateColumnOrder = (next: string[]) => setColumnOrder(next);
  const updateColumnVisibility = (next: Record<string, boolean>) => setColumnVisibility(next);
  const visibleColumnCount = CUSTOMER_COLUMN_CATALOG.filter(
    (c) => columnVisibility[c.key] !== false
  ).length;

  // ─── Per-column filter + sort state ───
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  // Default sort: newest first by invoice date (PRD §5.4).
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'invoiceDate', direction: 'desc' });
  const handleColumnSort = (columnKey: string, direction: 'asc' | 'desc' | null) => {
    if (direction === null) setSortConfig(null);
    else setSortConfig({ key: columnKey, direction });
    setCurrentPage(1);
  };
  const handleColumnFilterChange = (columnKey: string, filter: ColumnFilterState) => {
    setColumnFilters((prev) => {
      const next = { ...prev, [columnKey]: filter };
      if (!isFilterActive(filter)) delete next[columnKey];
      return next;
    });
    setCurrentPage(1);
  };
  const handleHideColumnFromHeader = (columnKey: string) => {
    if (LOCKED_CUSTOMER_COLUMNS.includes(columnKey)) return;
    updateColumnVisibility({ ...columnVisibility, [columnKey]: false });
  };
  const handleAddColumnFilter = (columnKey: string) => {
    setColumnFilters((prev) => {
      if (prev[columnKey]) return prev;
      const type: ColumnFilterState['type'] = COLUMN_BY_KEY.get(columnKey)?.filterType ?? 'text';
      return {
        ...prev,
        [columnKey]: {
          columnKey,
          type,
          values: [],
          text: '',
          min: '',
          max: '',
          dateFrom: '',
          dateTo: '',
        },
      };
    });
  };
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(
    () => new Set(LOCKED_CUSTOMER_COLUMNS)
  );
  const handleFreezeColumn = (columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && !LOCKED_CUSTOMER_COLUMNS.includes(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  };

  // ─── Me mode removed entirely (user 10/5) ───

  // ─── KPI widgets — active keys + order persisted under the AR key ───
  const KPI_STORAGE_KEY = 'omnesoft:customer-invoices:kpis';
  const [activeKpiKeys, setActiveKpiKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(KPI_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_CUSTOMER_KPI_KEYS;
  });

  const persistKpis = (next: string[]) => {
    try {
      localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
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

  const moveKpi = useCallback((from: number, to: number) => {
    setActiveKpiKeys((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      try {
        localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const handleInsightsReset = () => {
    setActiveKpiKeys(DEFAULT_CUSTOMER_KPI_KEYS);
    persistKpis(DEFAULT_CUSTOMER_KPI_KEYS);
    toast.info('Insights reset', { description: 'Restored the default widgets and order.' });
  };
  const insightsDirty = activeKpiKeys.join(',') !== DEFAULT_CUSTOMER_KPI_KEYS.join(',');

  // ─── Row filtering (quick filters + search) ───
  const filteredInvoices = invoices.filter((invoice) => {
    // Status matches the label the pill prints (fixes the old filter /
    // pill disagreement). Archived stays out of the default view until
    // the Show archived pill or the Archived status option asks for it.
    const statusLabel = invoiceStatusLabelOf(invoice);
    if (invoice.archived && !showArchived && !invoiceStatusFilter.includes('Archived')) return false;
    if (invoiceStatusFilter.length > 0 && !invoiceStatusFilter.includes(statusLabel)) return false;
    if (disputedOnly && !invoice.disputed) return false;

    if (paymentFilter.length > 0) {
      const ps = paymentStatusOf(invoice);
      if (!ps || !paymentFilter.includes(ps)) return false;
    }

    if (typeQuickFilter.length > 0 && !typeQuickFilter.includes(invoice.docKind)) return false;

    // Due-date slicers — undated documents (pre-invoices, credit memos)
    // can't match a due bucket or a custom window.
    if (dueCustomRange.from || dueCustomRange.to) {
      if (!invoice.dueDate) return false;
      if (dueCustomRange.from && new Date(invoice.dueDate) < new Date(dueCustomRange.from)) return false;
      if (dueCustomRange.to && new Date(invoice.dueDate) > new Date(dueCustomRange.to)) return false;
    }
    if (dueQuickFilter.length > 0) {
      if (!invoice.dueDate || !dueQuickFilter.includes(dueBucketOf(invoice.dueDate))) return false;
    }

    if (customerQuickFilter.length > 0 && !customerQuickFilter.includes(invoice.customer)) return false;
    if (createdByQuickFilter.length > 0 && !createdByQuickFilter.includes(invoice.createdBy)) return false;
    if (currencyQuickFilter.length > 0 && !currencyQuickFilter.includes(invoice.currency)) return false;
    if (arAccountQuickFilter.length > 0 && !arAccountQuickFilter.includes(invoice.arAccount)) return false;
    if (termsQuickFilter.length > 0 && !termsQuickFilter.includes(paymentTermsOf(invoice))) return false;

    // Invoice Date range (toolbar pill + modal share this state).
    if (invDatePeriod === 'custom') {
      if (invDateRange.from && invoice.invoiceDate.slice(0, 10) < invDateRange.from) return false;
      if (invDateRange.to && invoice.invoiceDate.slice(0, 10) > invDateRange.to) return false;
    } else if (invDatePeriod !== 'all') {
      const days = INVOICE_DATE_OPTIONS.find((o) => o.id === invDatePeriod)?.days;
      if (days) {
        const cutoff = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
        if (invoice.invoiceDate.slice(0, 10) < cutoff) return false;
      }
    }
    // Advanced-modal-only facets.
    const signed = signedAmountOf(invoice);
    if (amountMin !== '' && signed < Number(amountMin)) return false;
    if (amountMax !== '' && signed > Number(amountMax)) return false;

    // Trimmed + amount-searchable, vendor parity (GPT QC04/U4, 9/30).
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      const query = trimmedQuery.toLowerCase();
      const digits = query.replace(/[^0-9.]/g, '');
      const haystacks = [
        invoice.invoiceNumber,
        invoice.customer,
        invoice.description,
        invoice.documentNumber ?? '',
        invoice.customerPONumber ?? '',
        ...invoice.linkedSOs,
        ...invoice.linkedShipments,
      ];
      const amountHit = digits.length >= 2 && (
        String(Math.abs(invoice.amount)).includes(digits) ||
        Math.abs(invoice.amount).toFixed(2).includes(digits) ||
        String(Math.round(Math.abs(invoice.amount))).includes(digits)
      );
      // Every column is read too, shown or hidden, by the text its cell
      // prints (hidden-column-search spec, 10/14/26).
      if (
        !haystacks.some((h) => h.toLowerCase().includes(query)) &&
        !amountHit &&
        !rowMatchesColumns(invoice, CUSTOMER_INVOICE_COLUMNS, trimmedQuery)
      ) return false;
    }

    return true;
  });

  // Apply per-column filters from the column-header menus.
  const columnFiltersList = Object.values(columnFilters);
  let processedInvoices = applyColumnFilters(filteredInvoices, columnFiltersList, columnValueOf);

  // Apply active sort via the catalog's accessors so derived columns
  // (Net Due, Payment Status) sort by what they render.
  if (sortConfig) {
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const def = COLUMN_BY_KEY.get(sortConfig.key);
    const valueOf = (row: CustomerInvoice): unknown =>
      def ? (def.getSortValue ? def.getSortValue(row) : def.getValue(row)) : (row as any)[sortConfig.key];
    processedInvoices = [...processedInvoices].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (av == null && bv == null) return 0;
      if (av == null) return -dir;
      if (bv == null) return dir;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }
  const sortedFilteredInvoices = processedInvoices;

  // ─── Quick-filter option counts (whole dataset, like the vendor list) ───
  const invoiceStatusCounts: Record<string, number> = {};
  const paymentCounts: Record<string, number> = {};
  const typeQuickCounts: Record<string, number> = {};
  const dueQuickCounts: Record<string, number> = {};
  const customerQuickCounts: Record<string, number> = {};
  const createdByQuickCounts: Record<string, number> = {};
  const currencyQuickCounts: Record<string, number> = {};
  const arAccountQuickCounts: Record<string, number> = {};
  const termsQuickCounts: Record<string, number> = {};
  invoices.forEach((i) => {
    const term = paymentTermsOf(i);
    if (term) termsQuickCounts[term] = (termsQuickCounts[term] ?? 0) + 1;
    const label = invoiceStatusLabelOf(i);
    invoiceStatusCounts[label] = (invoiceStatusCounts[label] ?? 0) + 1;
    const ps = paymentStatusOf(i);
    if (ps) paymentCounts[ps] = (paymentCounts[ps] ?? 0) + 1;
    typeQuickCounts[i.docKind] = (typeQuickCounts[i.docKind] ?? 0) + 1;
    if (i.dueDate) {
      const bucket = dueBucketOf(i.dueDate);
      dueQuickCounts[bucket] = (dueQuickCounts[bucket] ?? 0) + 1;
    }
    customerQuickCounts[i.customer] = (customerQuickCounts[i.customer] ?? 0) + 1;
    createdByQuickCounts[i.createdBy] = (createdByQuickCounts[i.createdBy] ?? 0) + 1;
    currencyQuickCounts[i.currency] = (currencyQuickCounts[i.currency] ?? 0) + 1;
    arAccountQuickCounts[i.arAccount] = (arAccountQuickCounts[i.arAccount] ?? 0) + 1;
  });
  const customerQuickOptions = Object.keys(customerQuickCounts).sort();
  const createdByQuickOptions = Object.keys(createdByQuickCounts).sort();
  const termsQuickOptions = Object.keys(termsQuickCounts).sort();

  // ─── Advanced filter plumbing: one snapshot object feeds the saved
  // views (chips + dialog), apply resets every facet it captures. ───
  const advancedFilters = {
    types: typeQuickFilter,
    statuses: invoiceStatusFilter,
    payment: paymentFilter,
    customers: customerQuickFilter,
    createdBy: createdByQuickFilter,
    datePeriod: invDatePeriod,
    dateFrom: invDateRange.from,
    dateTo: invDateRange.to,
    dueBuckets: dueQuickFilter,
    arAccounts: arAccountQuickFilter,
    terms: termsQuickFilter,
    currencies: currencyQuickFilter,
    showArchived,
    dueFrom: dueCustomRange.from,
    dueTo: dueCustomRange.to,
    amountMin,
    amountMax,
  };
  // Filters badge counts ONLY modal-only facets (10/26 standard): the
  // toolbar pills (Status, Type, Customer, Invoice Date) never add to it.
  const activeAdvancedCount =
    createdByQuickFilter.length +
    (invDatePeriod !== 'all' ? 1 : 0) +
    arAccountQuickFilter.length +
    currencyQuickFilter.length +
    dueQuickFilter.length +
    (dueCustomRange.from || dueCustomRange.to ? 1 : 0) +
    (amountMin || amountMax ? 1 : 0);
  const anyListFilter =
    activeAdvancedCount > 0 ||
    paymentFilter.length > 0 ||
    termsQuickFilter.length > 0 ||
    typeQuickFilter.length > 0 ||
    invoiceStatusFilter.length > 0 ||
    customerQuickFilter.length > 0 ||
    invDatePeriod !== 'all' ||
    showArchived ||
    disputedOnly ||
    Object.keys(columnFilters).length > 0 ||
    !!searchQuery.trim();
  const applySavedFilters = (v: any) => {
    setTypeQuickFilter(v?.types ?? []);
    setInvoiceStatusFilter(v?.statuses ?? []);
    setPaymentFilter(v?.payment ?? []);
    setCustomerQuickFilter(v?.customers ?? []);
    setCreatedByQuickFilter(v?.createdBy ?? []);
    setInvDatePeriod(v?.datePeriod ?? (v?.dateFrom || v?.dateTo ? 'custom' : 'all'));
    setInvDateRange({ from: v?.dateFrom ?? '', to: v?.dateTo ?? '' });
    setDueQuickFilter(v?.dueBuckets ?? []);
    setArAccountQuickFilter(v?.arAccounts ?? []);
    setTermsQuickFilter(v?.terms ?? []);
    setCurrencyQuickFilter(v?.currencies ?? []);
    setShowArchived(!!v?.showArchived);
    setDisputedOnly(false);
    setDueCustomRange({ from: v?.dueFrom ?? '', to: v?.dueTo ?? '' });
    setAmountMin(v?.amountMin ?? '');
    setAmountMax(v?.amountMax ?? '');
    setCurrentPage(1);
  };
  /** Modal "Clear all": only the facets the modal owns. */
  const clearAdvancedFilters = () => {
    setTypeQuickFilter([]);
    setInvoiceStatusFilter([]);
    setPaymentFilter([]);
    setCustomerQuickFilter([]);
    setInvDatePeriod('all');
    setInvDateRange({ from: '', to: '' });
    setCreatedByQuickFilter([]);
    setArAccountQuickFilter([]);
    setCurrencyQuickFilter([]);
    setDueQuickFilter([]);
    setDueCustomRange({ from: '', to: '' });
    setAmountMin('');
    setAmountMax('');
    setCurrentPage(1);
  };
  const currencyQuickOptions = Object.keys(currencyQuickCounts).sort();
  const arAccountQuickOptions = Object.keys(arAccountQuickCounts).sort();

  // ─── FAD 11/2 flag counts (live, archived excluded like the list) ───
  const disputedCount = invoices.filter((i) => i.disputed && !i.archived).length;

  // ─── Pagination ───
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedInvoices = sortedFilteredInvoices.slice(startIndex, endIndex);

  const handleRecordsPerPageChange = (value: number) => {
    setRecordsPerPage(value);
    setCurrentPage(1);
  };

  const toggleSelectInvoice = (id: string) => {
    if (selectedInvoices.includes(id)) {
      setSelectedInvoices(selectedInvoices.filter((invId) => invId !== id));
    } else {
      setSelectedInvoices([...selectedInvoices, id]);
    }
  };

  // ─── Row actions — 'view' handled here, everything else bubbles up ───
  const handleRowAction = (actionId: CustomerInvoiceActionId, invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionId === 'view') {
      onViewInvoice(invoiceId);
      return;
    }
    if (onRowAction) {
      onRowAction(actionId, invoiceId);
      return;
    }
    toast.info('Coming soon', { description: 'This action is not wired up yet.' });
  };

  // ─── Bulk actions — the vendor BulkActionBar with per-action eligible
  // counts; ineligible rows are skipped. The parent applies them through
  // onBulkAction; without it a single eligible row routes through the
  // row-action handler (so its confirm modal opens). ───
  const BULK_ACTIONS: { id: CustomerInvoiceActionId; label: string; icon: typeof CheckCheck; tone: BulkAction['tone'] }[] = [
    { id: 'approve', label: 'Approve', icon: CheckCheck, tone: 'success' },
    { id: 'reject', label: 'Reject', icon: Ban, tone: 'destructive' },
    { id: 'send', label: 'Send to Customer', icon: Send, tone: 'primary' },
    { id: 'downloadPdf', label: 'Download PDF', icon: Download, tone: 'neutral' },
    { id: 'archive', label: 'Archive', icon: Archive, tone: 'destructive' },
  ];
  const selectedObjs = invoices.filter((inv) => selectedInvoices.includes(inv.id));
  const bulkActions: BulkAction[] = BULK_ACTIONS.map((a) => {
    const eligible = selectedObjs.filter((inv) => getCustomerRowActions(inv, perms).some((x) => x.id === a.id)).map((inv) => inv.id);
    return {
      key: a.id,
      label: a.label,
      icon: a.icon,
      tone: a.tone,
      count: eligible.length,
      onClick: () => {
        const skipped = selectedObjs.length - eligible.length;
        if (onBulkAction) {
          onBulkAction(a.id, eligible);
          if (skipped > 0) toast.info(`Skipped ${skipped} (ineligible).`);
          setSelectedInvoices([]);
          return;
        }
        if (eligible.length === 1 && onRowAction) {
          onRowAction(a.id, eligible[0]);
          return;
        }
        toast.info(`${a.label} for ${eligible.length} invoices`, { description: 'Open each invoice to apply it one at a time for now.' });
      },
    };
  });

  // ─── KPI cards — quiet vendor recipe: black value, grey sub-line ───
  const KPI_DEF_BY_KEY: Record<string, CustomerKpiDefinition> = Object.fromEntries(
    ALL_CUSTOMER_KPI_DEFINITIONS.map((d) => [d.key, d])
  );
  const invoicesInRange = filterCustomerInvoicesByRange(
    invoices,
    insightsRange,
    insightsRange === 'custom' ? insightsCustom : undefined,
  );
  const invoicesPreviousRange = filterCustomerInvoicesByPreviousRange(invoices, insightsRange);

  const activeKpiCards = activeKpiKeys
    .map((key) => KPI_DEF_BY_KEY[key])
    .filter(Boolean)
    .map((def) => {
      const computed = computeCustomerKpi(def.key, invoicesInRange, invoicesPreviousRange, invoices, deposits, customers);
      return {
        key: def.key,
        label: def.label,
        value: computed.value,
        sub: computed.sub,
        delta: undefined as KpiDelta | undefined,
        iconName: def.iconName,
        iconBg: def.iconBg,
        iconColor: def.iconColor,
        tooltip: def.tooltip,
        example: def.example,
        formula: def.formula,
      };
    });

  // Table Empty & Error States Standard v1.0 (11/3/26): one decision
  // for the table and the card view; every filter counts as one.
  const emptyFilterCount =
    activeAdvancedCount +
    paymentFilter.length +
    termsQuickFilter.length +
    typeQuickFilter.length +
    invoiceStatusFilter.length +
    customerQuickFilter.length +
    (showArchived ? 1 : 0) +
    (disputedOnly ? 1 : 0) +
    Object.keys(columnFilters).length;
  const emptyConfig: DataTableEmptyConfig = {
    entity: { singular: 'customer invoice', plural: 'customer invoices' },
    totalCount: invoices.length,
    filterCount: emptyFilterCount,
    onClearSearch: () => { setSearchQuery(''); setCurrentPage(1); },
    onClearFilters: () => {
      const q = searchQuery;
      applySavedFilters({});
      setColumnFilters({});
      setSearchQuery(q);
      setCurrentPage(1);
    },
    onSearch: (q) => { setSearchQuery(q); setCurrentPage(1); },
    ...(perms.canCreate ? { onCreate: () => onCreateInvoice(), createLabel: 'Create New Customer Invoice' } : {}),
  };
  const cardStates = useTableStates<CustomerInvoice>({
    config: emptyConfig,
    pageRows: paginatedInvoices,
    totalRows: sortedFilteredInvoices.length,
    searchQuery,
    suggestionRows: invoices,
    columns: CUSTOMER_INVOICE_COLUMNS,
    onFirstPage: () => setCurrentPage(1),
  });

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Listing gutter — 12px on all sides; the full-bleed header below
          cancels it with -mx-3/-mt-3 (same recipe as the vendor list). */}
      <div className="p-3 flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Page Header — Customer (AR) invoicing. Sky tint + FileText mirrors
          the module's Overview card identity. */}
      <div className="-mx-3 -mt-3 px-3 pt-3.5 pb-3.5 bg-white border-b border-border shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: palette.sky[50] }}
            >
              <FileText className="w-4 h-4" style={{ color: palette.sky[700] }} />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-[20px] truncate">Customer Invoicing</h1>
              <p className="text-xs text-muted-foreground">
                Bill customers for shipped goods, advances and charges.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Export in the PAGE HEADER — DISABLED like the vendor
                listing (user 10/1, matching the 9/28 vendor call): the
                CTA and the ExportDialog wiring stay intact, only the
                click is parked until the next phase. */}
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  aria-disabled
                  className="h-9 px-3.5 rounded-lg border border-border bg-white text-slate-400 inline-flex items-center gap-1.5 cursor-not-allowed shadow-sm text-[13px] opacity-70"
                  style={{ fontWeight: 500 }}
                >
                  <Download className="w-4 h-4 text-slate-300" />
                  Export
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="px-2.5 py-1.5 bg-white border border-border rounded-lg shadow-md">
                <p className="text-[11px] text-slate-600 leading-snug" style={{ fontWeight: 500 }}>Exports are coming in the next phase.</p>
              </TooltipContent>
            </Tooltip>
            {onImportInvoices && (
              <button
                onClick={onImportInvoices}
                className="h-9 px-3.5 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm text-[13px]"
                style={{ fontWeight: 500 }}
              >
                <Upload className="w-4 h-4 text-slate-500" />
                Import Invoices
              </button>
            )}
            {perms.canCreate && (
              <Button
                size="sm"
                onClick={() => onCreateInvoice()}
                className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create New Customer Invoice
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Performance Insights + KPI cards — hides entirely at zero widgets;
          the toolbar Insights button is the way back in. */}
      {showInsights && activeKpiKeys.length > 0 && (
        <div className="mt-3 mb-4 shrink-0">
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
              {/* One-click Hide (Eli 7/22/26): collapse the whole insights band
                  without opening Customize and toggling every widget off. The
                  toolbar "Insights" button is the way back in. */}
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
                <PlusIcon className="w-3 h-3" />
                Add Insights
              </button>
            </div>
          </div>
          <DndProvider backend={HTML5Backend}>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
            >
              {activeKpiCards.map((kpi, idx) => (
                <DraggableKpiCard
                  key={kpi.key}
                  index={idx}
                  kpiKey={kpi.key}
                  label={kpi.label}
                  value={kpi.value}
                  sub={kpi.sub}
                  delta={kpi.delta}
                  iconName={kpi.iconName}
                  tooltip={kpi.tooltip}
                  example={kpi.example}
                  rangeLabel={insightsPeriodLabel}
                  formula={kpi.formula}
                  moveCard={moveKpi}
                  onRemove={() => handleRemoveKpi(kpi.key)}
                />
              ))}
            </div>
          </DndProvider>
        </div>
      )}

      {/* Unified Table Container — search, pills, table, pagination. When
          the insights band is hidden it takes over the band's mt-3. */}
      {activeTab === 'all' && (
      <div className={`border border-border rounded-xl bg-card flex flex-1 min-h-0 overflow-hidden ${showInsights && activeKpiKeys.length > 0 ? '' : 'mt-3'}`}>
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Search + toolbar */}
      <div data-col-hide-edge className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              placeholder="Search invoices..."
              className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
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
            onClick={() => setIsFilterOpen(true)}
            className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 ${
              activeAdvancedCount > 0
                ? 'text-primary border-primary/30'
                : 'text-foreground border-border/80'
            }`}
          >
            <SlidersHorizontal
              className={`w-3.5 h-3.5 ${
                activeAdvancedCount > 0 ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
            <span className="text-sm" style={{ fontWeight: 500 }}>
              Filters
            </span>
            {activeAdvancedCount > 0 && (
              <span
                className="ml-0.5 min-w-[18px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 600 }}
              >
                {activeAdvancedCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(() => {
            // Vendor copy-audit rule: the denominator is the population in
            // view (archived only counts while it is shown), and when
            // nothing narrows the list it collapses to a plain count.
            const showingArchived = showArchived || invoiceStatusFilter.includes('Archived');
            const population = showingArchived ? invoices.length : invoices.filter((i) => !i.archived).length;
            const shown = sortedFilteredInvoices.length;
            return (
              <span className="text-sm mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                {shown === population ? (
                  <>
                    <span className="text-foreground">{shown}</span>
                    <span className="text-muted-foreground/70"> {shown === 1 ? 'invoice' : 'invoices'}</span>
                  </>
                ) : (
                  <>
                    <span className="text-foreground">{shown}</span>
                    <span className="text-muted-foreground/60"> of </span>
                    <span className="text-muted-foreground">{population}</span>
                    <span className="text-muted-foreground/70"> invoices</span>
                  </>
                )}
              </span>
            );
          })()}
          <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />
          <button
            onClick={() => {
              // The vendor listing's partner behavior verbatim (user 9/25):
              // Insights shows the KPI band AND opens the Customize
              // Widgets drawer — it does NOT just toggle the band.
              if (!showInsights) {
                setShowInsights(true);
              }
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
          <ViewDensityMenu
            density={densityMode}
            onDensityChange={setDensityMode}
            cardSize={cardSize}
            onCardSizeChange={updateCardSize}
            // Large cards parked, vendor parity (user 10/1).
            disabledCardSizes={['large']}
          />
          <ColumnSelectorTrigger
            visibleCount={visibleColumnCount}
            active={columnDrawerOpen}
            onClick={() => setColumnDrawerOpen((o) => !o)}
            disabled={densityMode === 'card'}
          />
        </div>
      </div>

      {/* Bulk Action Bar — replaces the pill row when rows are selected,
          the vendor listing recipe. */}
      {selectedInvoices.length > 0 ? (
        <BulkActionBar
          count={selectedInvoices.length}
          noun="invoice"
          actions={bulkActions}
          onClear={() => setSelectedInvoices([])}
        />
      ) : null}

      {/* Quick-filter pill row — the vendor order: the two status axes,
          then who, then what, then terms; the Archived toggle rides the
          vendor On hold pill recipe behind a separator. */}
      <div
        className={`flex flex-wrap items-center gap-1.5 px-4 pb-3 shrink-0 ${
          selectedInvoices.length > 0 ? 'hidden' : ''
        }`}
      >
        <MultiSelectFilter
          label="Invoice Status"
          options={INVOICE_STATUS_OPTIONS.map((opt) => ({ id: opt, label: opt, count: invoiceStatusCounts[opt] ?? 0 }))}
          selected={invoiceStatusFilter}
          onChange={(next) => { setInvoiceStatusFilter(next); setCurrentPage(1); }}
        />
        <MultiSelectFilter
          label="Payment Status"
          options={PAYMENT_STATUS_OPTIONS.map((opt) => ({ id: opt, label: opt, count: paymentCounts[opt] ?? 0 }))}
          selected={paymentFilter}
          onChange={(next) => { setPaymentFilter(next); setCurrentPage(1); }}
        />
        <MultiSelectFilter
          label="Customer"
          searchable
          options={customerQuickOptions.map((v) => ({ id: v, label: v, count: customerQuickCounts[v] ?? 0 }))}
          selected={customerQuickFilter}
          onChange={(next) => { setCustomerQuickFilter(next); setCurrentPage(1); }}
        />
        <MultiSelectFilter
          label="Invoice Type"
          options={DOC_KIND_OPTIONS.map((k) => ({ id: k, label: k, count: typeQuickCounts[k] ?? 0 }))}
          selected={typeQuickFilter}
          onChange={(next) => { setTypeQuickFilter(next); setCurrentPage(1); }}
        />
        <MultiSelectFilter
          label="Payment Terms"
          searchable
          options={termsQuickOptions.map((v) => ({ id: v, label: v, count: termsQuickCounts[v] ?? 0 }))}
          selected={termsQuickFilter}
          onChange={(next) => { setTermsQuickFilter(next); setCurrentPage(1); }}
        />
        <div className="w-px h-5 bg-border shrink-0" />
        {/* FAD 11/2: one toggle pill, Disputed (rose), the vendor On Hold
            recipe. Exception and Archived live under Invoice Status. */}
        <button
          type="button"
          aria-pressed={disputedOnly}
          onClick={() => { setDisputedOnly((v) => !v); setCurrentPage(1); }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            disputedOnly
              ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100/70 active:bg-rose-100'
              : 'border-rose-300 bg-white text-rose-700 hover:bg-rose-50 hover:border-rose-400 active:bg-rose-100'
          }`}
          style={{ fontWeight: disputedOnly ? 500 : 400 }}
        >
          <Flag className="w-3 h-3" />
          Disputed
          <span className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center bg-rose-100 text-rose-700" style={{ fontWeight: 500 }}>
            {disputedCount}
          </span>
        </button>
      </div>

      {/* Active per-column filter chips (Notion-style, shared with vendor) */}
      <InvoiceActiveFiltersBar
        columnFilters={columnFilters}
        columnLabels={Object.fromEntries(CUSTOMER_COLUMN_CATALOG.map((c) => [c.key, c.label]))}
        onRemoveFilter={(key) =>
          setColumnFilters((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          })
        }
        onClearAll={() => setColumnFilters({})}
      />

      {/* Divider between filters and table content */}
      <div className="border-t border-border shrink-0" />

      {/* Filters modal — the vendor listing's partner-chrome modal verbatim
          (centered title, round close; Saved Views parked like vendor). */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent
          className="max-w-[560px] p-0 overflow-hidden border-0 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] bg-white flex flex-col max-h-[85vh]"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Filters</DialogTitle>
          <DialogDescription className="sr-only">
            Refine the customer invoice list by type, status, customer, dates, and amount.
          </DialogDescription>
          <div className="relative flex items-center justify-center h-12 border-b border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-[14px]" style={{ fontWeight: 600 }}>Filters</span>
            {SHOW_SAVED_VIEWS && (
              <Button
                variant="outline"
                size="sm"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 text-[12px]"
                onClick={() => setSavedViewsOpen(true)}
              >
                <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
                Saved Views
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {SHOW_SAVED_VIEWS && (
              <SavedViewsSection
                views={savedViews}
                currentFilters={advancedFilters}
                hasActiveFilters={activeAdvancedCount > 0}
                onApply={(view) => applySavedFilters(view.filters)}
                onSaveCurrent={(name) => saveView(name, advancedFilters)}
              />
            )}
            <div>
              <p className="text-[13px] mb-1" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Invoice Type
              </p>
              <p className="text-[11px] text-muted-foreground mb-2.5">
                Select which invoice type to show.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => { setTypeQuickFilter([]); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                    typeQuickFilter.length === 0
                      ? 'border-primary bg-accent text-primary'
                      : 'border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  All
                </button>
                {DOC_KIND_OPTIONS.map((opt) => {
                  const selected = typeQuickFilter.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setTypeQuickFilter(selected ? typeQuickFilter.filter((x) => x !== opt) : [...typeQuickFilter, opt]);
                        setCurrentPage(1);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        selected
                          ? 'border-primary bg-accent text-primary'
                          : 'border-border bg-white text-foreground hover:bg-muted/50'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {opt}
                      <span
                        className="text-[10px] rounded-full px-1.5 py-px"
                        style={{
                          backgroundColor: selected ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                          color: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                          fontWeight: 600,
                        }}
                      >
                        {typeQuickCounts[opt] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Invoice Status
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => { setInvoiceStatusFilter([]); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                    invoiceStatusFilter.length === 0
                      ? 'border-primary bg-accent text-primary'
                      : 'border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  All
                </button>
                {INVOICE_STATUS_OPTIONS.map((opt) => {
                  const selected = invoiceStatusFilter.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setInvoiceStatusFilter(selected ? invoiceStatusFilter.filter((x) => x !== opt) : [...invoiceStatusFilter, opt]);
                        setCurrentPage(1);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        selected
                          ? 'border-primary bg-accent text-primary'
                          : 'border-border bg-white text-foreground hover:bg-muted/50'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {opt}
                      <span
                        className="text-[10px] rounded-full px-1.5 py-px"
                        style={{
                          backgroundColor: selected ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                          color: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                          fontWeight: 600,
                        }}
                      >
                        {invoiceStatusCounts[opt] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Payment Status
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => { setPaymentFilter([]); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                    paymentFilter.length === 0
                      ? 'border-primary bg-accent text-primary'
                      : 'border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  All
                </button>
                {PAYMENT_STATUS_OPTIONS.map((opt) => {
                  const selected = paymentFilter.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setPaymentFilter(selected ? paymentFilter.filter((x) => x !== opt) : [...paymentFilter, opt]);
                        setCurrentPage(1);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        selected
                          ? 'border-primary bg-accent text-primary'
                          : 'border-border bg-white text-foreground hover:bg-muted/50'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {opt}
                      <span
                        className="text-[10px] rounded-full px-1.5 py-px"
                        style={{
                          backgroundColor: selected ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                          color: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                          fontWeight: 600,
                        }}
                      >
                        {paymentCounts[opt] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Customer
              </p>
              <SearchSelectPeople
                options={customerQuickOptions.map((v) => ({ id: v, name: v, count: customerQuickCounts[v] ?? 0 }))}
                selected={customerQuickFilter}
                onChange={(next) => { setCustomerQuickFilter(next); setCurrentPage(1); }}
                placeholder="Search customers..."
                emptyText="No customers found."
                recentsKey="customer-invoices-customers"
              />
            </div>

            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Created By
              </p>
              <SearchSelectPeople
                options={createdByQuickOptions.map((v) => ({ id: v, name: v, count: createdByQuickCounts[v] ?? 0 }))}
                selected={createdByQuickFilter}
                onChange={(next) => { setCreatedByQuickFilter(next); setCurrentPage(1); }}
                placeholder="Search creators..."
                emptyText="No creators found."
                recentsKey="customer-invoices-creators"
              />
            </div>

            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                A/R Account
              </p>
              <SearchSelectPeople
                options={arAccountQuickOptions.map((v) => ({ id: v, name: v, count: arAccountQuickCounts[v] ?? 0 }))}
                selected={arAccountQuickFilter}
                onChange={(next) => { setArAccountQuickFilter(next); setCurrentPage(1); }}
                placeholder="Search A/R accounts..."
                emptyText="No accounts found."
                recentsKey="customer-invoices-ar-accounts"
                variant="plain"
              />
            </div>

            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Currency
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => { setCurrencyQuickFilter([]); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                    currencyQuickFilter.length === 0
                      ? 'border-primary bg-accent text-primary'
                      : 'border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  All
                </button>
                {currencyQuickOptions.map((opt) => {
                  const selected = currencyQuickFilter.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setCurrencyQuickFilter(selected ? currencyQuickFilter.filter((x) => x !== opt) : [...currencyQuickFilter, opt]);
                        setCurrentPage(1);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        selected
                          ? 'border-primary bg-accent text-primary'
                          : 'border-border bg-white text-foreground hover:bg-muted/50'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {opt}
                      <span
                        className="text-[10px] rounded-full px-1.5 py-px"
                        style={{
                          backgroundColor: selected ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                          color: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                          fontWeight: 600,
                        }}
                      >
                        {currencyQuickCounts[opt] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Invoice Date
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                    From
                  </Label>
                  <DatePicker
                    value={invDatePeriod === 'custom' ? invDateRange.from : ''}
                    onChange={(v) => { setInvDateRange({ ...invDateRange, from: v }); setInvDatePeriod('custom'); setCurrentPage(1); }}
                    placeholder="From"
                    className="h-9 border-border/80"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                    To
                  </Label>
                  <DatePicker
                    value={invDatePeriod === 'custom' ? invDateRange.to : ''}
                    onChange={(v) => { setInvDateRange({ ...invDateRange, to: v }); setInvDatePeriod('custom'); setCurrentPage(1); }}
                    placeholder="To"
                    align="end"
                    className="h-9 border-border/80"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Due Date
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                    From
                  </Label>
                  <DatePicker
                    value={dueCustomRange.from}
                    onChange={(v) => { setDueCustomRange({ ...dueCustomRange, from: v }); setCurrentPage(1); }}
                    placeholder="From"
                    className="h-9 border-border/80"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                    To
                  </Label>
                  <DatePicker
                    value={dueCustomRange.to}
                    onChange={(v) => { setDueCustomRange({ ...dueCustomRange, to: v }); setCurrentPage(1); }}
                    placeholder="To"
                    align="end"
                    className="h-9 border-border/80"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Amount
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                    Min
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 ">$</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="h-9 text-sm bg-white pl-7 border-border/80"
                      value={formatMoneyText(amountMin)}
                      onChange={(e) => { setAmountMin(e.target.value.replace(/[^\d.]/g, '')); setCurrentPage(1); }}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                    Max
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 ">$</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="No limit"
                      className="h-9 text-sm bg-white pl-7 border-border/80"
                      value={formatMoneyText(amountMax)}
                      onChange={(e) => { setAmountMax(e.target.value.replace(/[^\d.]/g, '')); setCurrentPage(1); }}
                    />
                  </div>
                </div>
              </div>
              {amountMin !== '' && amountMax !== '' && Number(amountMin) > Number(amountMax) && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-rose-600" style={{ fontWeight: 500 }}>
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  The minimum is above the maximum, so no invoice can match. Swap them to see results.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-5 h-14 border-t border-border/60 shrink-0">
            <button
              type="button"
              onClick={clearAdvancedFilters}
              className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Clear All
            </button>
            <Button size="sm" className="h-9 px-5 text-[13px]" onClick={() => setIsFilterOpen(false)}>
              Show {sortedFilteredInvoices.length} invoice{sortedFilteredInvoices.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SavedViewsDialog
        open={savedViewsOpen}
        onOpenChange={setSavedViewsOpen}
        currentFilters={advancedFilters}
        onApplyView={applySavedFilters}
        views={savedViews}
        onSaveView={(name) => saveView(name, advancedFilters)}
        onDeleteView={deleteView}
        onToggleStar={toggleStar}
      />

      {/* Module-level export — the vendor listing's recipe verbatim
          (user 9/25): selected rows when any, else the filtered list. */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        recordCount={selectedInvoices.length > 0 ? selectedInvoices.length : sortedFilteredInvoices.length}
        recordType="invoice"
        fileBaseName="customer-invoices"
        columns={[
          { key: 'invoiceNumber', label: 'Invoice ID' },
          { key: 'docKind', label: 'Invoice Type' },
          { key: 'customer', label: 'Customer' },
          { key: 'documentNumber', label: 'Invoice Number' },
          { key: 'customerPONumber', label: 'Customer PO No.' },
          { key: 'invoiceDate', label: 'Invoice Date' },
          { key: 'dueDate', label: 'Due Date' },
          { key: 'invoiceStatus', label: 'Invoice Status' },
          { key: 'sentAt', label: 'Sent On' },
          { key: 'amount', label: 'Amount' },
          { key: 'customerDeposits', label: 'Customer Deposits' },
          { key: 'creditMemos', label: 'Credit Memos' },
          { key: 'currency', label: 'Currency' },
          { key: 'arAccount', label: 'A/R Account' },
          { key: 'createdBy', label: 'Created By' },
          { key: 'createdDate', label: 'Created On' },
        ]}
        rows={(selectedInvoices.length > 0
          ? sortedFilteredInvoices.filter((inv) => selectedInvoices.includes(inv.id))
          : sortedFilteredInvoices
        ).map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          docKind: inv.docKind,
          customer: inv.customer,
          documentNumber: inv.documentNumber ?? '',
          customerPONumber: inv.customerPONumber ?? '',
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate ?? '',
          invoiceStatus: invoiceStatusLabelOf(inv),
          sentAt: inv.sentAt ?? '',
          amount: signedAmountOf(inv),
          customerDeposits: listingDepositsTotal(inv),
          creditMemos: listingCreditAppliedTotal(inv),
          currency: inv.currency,
          arAccount: inv.arAccount,
          createdBy: inv.createdBy,
          createdDate: inv.createdDate,
        }))}
      />

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {densityMode === 'card' ? (
          // Tinted well behind the cards (user 10/1, mirrors the vendor
          // listing): one step darker than the page so the white cards
          // separate from the background.
          <div className="flex-1 overflow-auto p-4 bg-slate-100/70">
            {cardStates.loadState === 'stale' && (
              <div className="-mx-4 -mt-4 mb-4">
                <TableStaleBanner entity={emptyConfig.entity} lastUpdated={cardStates.tableLoad.lastUpdated} onRetry={cardStates.tableLoad.retry} retrying={cardStates.tableLoad.retrying} />
              </div>
            )}
            {cardStates.loadState === 'loading' && <CardSkeletonGrid />}
            <div
              className={`grid gap-3 ${
                cardSize === 'large'
                  ? 'grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2'
                  : cardSize === 'small'
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              }`}
            >
              {cardStates.loadState !== 'loading' && cardStates.emptyProps && (
                <div className="col-span-full bg-white border border-border rounded-xl">
                  <TableEmptyState {...cardStates.emptyProps} />
                </div>
              )}
              {(cardStates.loadState === 'loading' || cardStates.emptyProps ? [] : paginatedInvoices).map((invoice) => {
                const tcfg = CUSTOMER_TYPE_CONFIG[invoice.docKind] ?? CUSTOMER_TYPE_CONFIG.Standalone;
                const TIcon = tcfg.icon;
                const signed = signedAmountOf(invoice);
                const due = netDue(invoice);
                return (
                <div
                  key={invoice.id}
                  // Type-tinted hover identity, the vendor card recipe.
                  style={{ ['--card-accent' as string]: tcfg.border }}
                  className={`bg-white border border-border rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[var(--card-accent)] hover:shadow-[0_10px_28px_-10px_rgba(15,23,42,0.16)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group ${
                    cardSize === 'large' ? 'p-5' : cardSize === 'small' ? 'p-3' : 'p-4'
                  }`}
                  onClick={() => onViewInvoice(invoice.id)}
                >
                  <div className="flex items-start justify-between mb-2.5 gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Checkbox
                        checked={selectedInvoices.includes(invoice.id)}
                        onCheckedChange={() => toggleSelectInvoice(invoice.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border"
                        style={{ backgroundColor: tcfg.bg, color: tcfg.fg, borderColor: tcfg.border }}
                      >
                        <TIcon className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-[13px] truncate" style={{ fontWeight: 600 }}>
                        {invoice.invoiceNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {cardSize !== 'small' && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap ${tcfg.dashed ? 'border border-dashed' : 'border'}`}
                          style={{ fontWeight: tcfg.dashed ? 600 : 500, backgroundColor: tcfg.bg, color: tcfg.fg, borderColor: tcfg.border }}
                        >
                          {tcfg.label.replace(/ Invoice$/, '')}
                        </span>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100 focus-visible:ring-slate-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-4 h-4 text-slate-400 group-hover:text-slate-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => onViewInvoice(invoice.id)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {getCustomerRowActionGroups(invoice, perms).map((group, gi) => {
                            const items = group.filter((a) => a.id !== 'view');
                            if (items.length === 0) return null;
                            return (
                              <Fragment key={gi}>
                                <DropdownMenuSeparator />
                                {items.map((action) => {
                                  const Icon = CUSTOMER_ACTION_ICONS[action.id];
                                  const tone: ActionTone =
                                    action.destructive || action.category === 'destructive'
                                      ? 'destructive'
                                      : action.id === 'creditHold' || action.id === 'markDisputed' || action.id === 'flagException'
                                        ? 'warning'
                                        : action.id === 'approve' || action.id === 'releaseCreditHold' || action.id === 'resolveDispute' || action.id === 'resolveException'
                                          ? 'positive'
                                          : 'neutral';
                                  const cls = actionToneClass(tone);
                                  return (
                                    <DropdownMenuItem
                                      key={action.id}
                                      onClick={(e) => handleRowAction(action.id, invoice.id, e as unknown as React.MouseEvent)}
                                      className={cls.item}
                                    >
                                      {Icon && <Icon className={`w-4 h-4 mr-2 ${cls.icon}`} />}
                                      {action.label}
                                    </DropdownMenuItem>
                                  );
                                })}
                              </Fragment>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {cardSize !== 'small' && invoice.description && (
                    <p className="text-[11px] text-slate-500 truncate mb-2" title={invoice.description}>
                      {invoice.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {renderCustomerInvoiceStatus(invoice)}
                    {renderCustomerPaymentStatus(invoice)}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-2.5 border-t border-slate-100">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Customer</p>
                      <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
                        <CustomerCell customer={invoice.customer} description={invoice.description} density="card" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Due Date</p>
                      {(() => {
                        const owes = !!invoice.dueDate && due > 0.004 && !invoice.writtenOff && invoice.invoiceStatus !== 'Cancelled' && invoice.invoiceStatus !== 'Rejected';
                        const dateEl = (
                          <p className={`text-[12px] text-slate-700 truncate mt-1 ${owes ? 'cursor-help' : ''}`} style={{ fontWeight: 400 }}>
                            {invoice.dueDate ? formatUsDate(invoice.dueDate) : '–'}
                          </p>
                        );
                        if (!owes || !invoice.dueDate) return dateEl;
                        const days = overdueDaysOf(invoice.dueDate);
                        return (
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>{dateEl}</TooltipTrigger>
                            <TooltipContent side="top" className="px-2.5 py-1.5 bg-white border border-border rounded-lg shadow-md">
                              <p
                                className="text-[11px] leading-snug"
                                style={{ fontWeight: 600, color: days > 0 ? '#DC2626' : days >= -7 ? '#B45309' : '#475569' }}
                              >
                                {overdueLabel(days)}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                    </div>
                    {cardSize !== 'small' && (
                      <>
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Customer PO No.</p>
                          <p className="text-[12px] text-slate-700 truncate mt-1" style={{ fontWeight: 400 }}>{invoice.customerPONumber || '–'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Invoice Date</p>
                          <p className="text-[12px] text-slate-700 truncate mt-1" style={{ fontWeight: 400 }}>{formatUsDate(invoice.invoiceDate)}</p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-end justify-between gap-2 pt-2.5 mt-2.5 border-t border-slate-100">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Amount</p>
                      <p
                        className={`${cardSize === 'small' ? 'text-[14px]' : 'text-[16px]'} ${signed < 0 ? '' : 'text-foreground'}`}
                        style={{ fontWeight: 500, lineHeight: 1.2, ...(signed < 0 ? { color: '#DC2626' } : {}) }}
                      >
                        {signed < 0 ? '−' : ''}${Math.abs(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 min-w-0">
                      {due > 0.004 && due < invoice.amount - 0.004 && (
                        <p className="text-[11px] text-slate-500" style={{ fontWeight: 400 }}>
                          {`$${due.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} due
                        </p>
                      )}
                      <div onClick={(e) => e.stopPropagation()}>
                        <CreatedByCell name={invoice.createdBy} vendor={invoice.customer} density="card" />
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <CustomerInvoiceDataTable
              key={`cols-${columnResetKey}`}
              invoices={paginatedInvoices}
              optionRows={invoices}
              selectedIds={new Set(selectedInvoices)}
              onSelectionChange={(next) => setSelectedInvoices(Array.from(next))}
              columnOrder={columnOrder}
              onColumnOrderChange={updateColumnOrder}
              columnVisibility={columnVisibility}
              columnFilters={columnFilters}
              onColumnFilterChange={handleColumnFilterChange}
              onAddColumnFilter={handleAddColumnFilter}
              onHideColumn={handleHideColumnFromHeader}
              sortConfig={sortConfig}
              onSort={handleColumnSort}
              frozenColumns={frozenColumns}
              onFreezeColumn={handleFreezeColumn}
              density={densityMode}
              searchQuery={searchQuery}
              searchRows={sortedFilteredInvoices}
              searchRevealAfter="invoiceNumber"
              currentPage={currentPage}
              recordsPerPage={recordsPerPage}
              totalRows={sortedFilteredInvoices.length}
              onPageChange={setCurrentPage}
              onRecordsPerPageChange={handleRecordsPerPageChange}
              onRowClick={(invoice) => onViewInvoice(invoice.id)}
              onRowAction={handleRowAction}
              emptyConfig={emptyConfig}
            />
          </div>
        )}
      </div>
        </div>
        <ColumnSelector
          columns={CUSTOMER_COLUMN_CATALOG}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          onColumnOrderChange={updateColumnOrder}
          onColumnVisibilityChange={updateColumnVisibility}
          lockedColumns={LOCKED_CUSTOMER_COLUMNS}
          frozenColumns={frozenColumns}
          onFreezeColumn={handleFreezeColumn}
          open={columnDrawerOpen}
          onOpenChange={setColumnDrawerOpen}
          defaultColumnOrder={CUSTOMER_COLUMN_CATALOG.map((c) => c.key)}
          defaultColumnVisibility={DEFAULT_CUSTOMER_COLUMN_VISIBILITY}
          onReset={() => setColumnResetKey((k) => k + 1)}
        />
      </div>
      )}
      </div>

      {/* Customize Widgets drawer */}
      <CustomerInvoiceInsightsPanel
        open={insightsPanelOpen}
        onOpenChange={setInsightsPanelOpen}
        activeKpis={activeKpiKeys}
        onToggleKpi={handleToggleKpi}
        invoices={invoices}
        deposits={deposits}
        customers={customers}
      />
    </div>
  );
}

/* ─── Draggable KPI card — copied from the vendor listing's dnd recipe,
 *  with the AR icon set. Same quiet card: label + (i) top-left, muted
 *  icon top-right, black value, grey sub-line. ─── */
const DND_CUSTOMER_KPI = 'CUSTOMER_INVOICE_KPI_CARD';

interface DraggableKpiCardProps {
  index: number;
  kpiKey: string;
  label: string;
  value: string;
  sub?: string;
  delta?: KpiDelta;
  iconName: string;
  tooltip?: string;
  /** Active range period label (e.g. "30 days") anchoring the delta text. */
  rangeLabel?: string;
  /** Optional fixed-pitch formula rendered inside the tooltip. */
  formula?: string;
  /** Optional example rendered on its own line under the tooltip text. */
  example?: string;
  moveCard: (from: number, to: number) => void;
  onRemove: () => void;
}

function DraggableKpiCard({
  index,
  label,
  value,
  sub,
  delta,
  iconName,
  tooltip,
  rangeLabel,
  formula,
  example,
  moveCard,
  onRemove,
}: DraggableKpiCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_CUSTOMER_KPI,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_CUSTOMER_KPI,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      const hoverRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverRect.right - hoverRect.left) / 2;
      const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverRect.left;
      const hoverClientY = clientOffset.y - hoverRect.top;
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY && hoverClientX < hoverMiddleX) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY && hoverClientX > hoverMiddleX) return;
      moveCard(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  preview(drop(ref));
  drag(ref);

  if (isDragging) {
    return (
      <div
        ref={ref}
        className="rounded-lg border border-dashed border-primary/20 bg-primary/[0.02] min-h-[80px] pointer-events-none"
      />
    );
  }

  return (
    <div
      ref={ref}
      className={`border rounded-lg bg-white group relative min-w-0 transition-all duration-200 select-none overflow-hidden cursor-grab active:cursor-grabbing ${
        isOver
          ? 'border-primary/30 bg-primary/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]'
          : 'border-border hover:-translate-y-[1px] hover:border-blue-300 hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]'
      }`}
    >
      <div className="px-3 py-2">
        {/* Top row: label + (i) on left, muted-gray icon on right */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p
              className="text-[10px] text-slate-500 truncate"
              style={{ fontWeight: 500 }}
            >
              {label}
            </p>
            {(tooltip || formula || example) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex shrink-0"
                  >
                    <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={6}
                  className="max-w-[280px] text-[11px] leading-snug z-[300] p-0 overflow-hidden"
                >
                  {tooltip && (
                    <p className="px-3 pt-2.5 pb-2 text-slate-600">{tooltip}</p>
                  )}
                  {example && (
                    /* Partner example-card recipe (BA 9/6): inset tile with
                       the EXAMPLE eyebrow, never an inline run. */
                    <div className="mx-2.5 mb-2.5 -mt-0.5 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
                      <p className="text-[9px] text-slate-400" style={{ fontWeight: 500 }}>Example</p>
                      <p className="text-[11px] text-slate-600 leading-snug mt-0.5">{example}</p>
                    </div>
                  )}
                  {formula && (
                    <div className="border-t px-3 py-2" style={{ backgroundColor: '#EBF3FF', borderColor: '#D6E8FF' }}>
                      <p className="text-[10px] mb-1" style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}>
                        Calculation
                      </p>
                      <pre className="text-[10px] whitespace-pre-wrap leading-snug" style={{ color: '#0654BC' }}>
                        {formula}
                      </pre>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <CustomerKpiIcon
            name={iconName}
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: palette.slate[400] }}
          />
        </div>

        {/* Headline row — value (black) left, delta pinned right */}
        <div className="flex items-baseline gap-1 min-w-0">
          <p
            className="text-[15px] text-slate-700 tracking-tight truncate min-w-0"
            style={{ fontWeight: 500, lineHeight: 1.2 }}
          >
            {value}
          </p>
          {delta && (
            <span
              className="text-[10px] shrink-0 ml-auto"
              style={{
                color:
                  delta.tone === 'positive'
                    ? 'hsl(var(--success))'
                    : delta.tone === 'negative'
                      ? 'hsl(var(--destructive))'
                      : 'hsl(var(--muted-foreground))',
                fontWeight: 500,
              }}
            >
              {delta.text}
            </span>
          )}
        </div>

        {/* Sub-text — money or caption, period anchor appended inline */}
        {(sub || (delta && rangeLabel)) && (
          <div className="text-[10px] text-slate-400/80 truncate mt-0.5">
            {sub}
            {sub && delta && rangeLabel && <span className="text-slate-300"> · </span>}
            {delta && rangeLabel && <span>vs prior {rangeLabel}</span>}
          </div>
        )}
      </div>

      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none">
        <GripVertical className="w-3.5 h-3.5 text-slate-500" />
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-rose-50 z-10"
        aria-label={`Remove ${label}`}
        type="button"
      >
        <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-500" />
      </button>
    </div>
  );
}
