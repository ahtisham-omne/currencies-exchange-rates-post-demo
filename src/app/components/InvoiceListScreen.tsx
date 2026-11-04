import { useState, useEffect, useCallback, useRef, Fragment, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { formatMoneyText } from '@/app/components/payments/MoneyInput';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  Plus,
  MoreHorizontal,
  FileText,
  Package,
  Calculator,
  X,
  Check,
  LayoutGrid,
  AlignJustify,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit3,
  Eye,
  EyeOff,
  Download,
  Ban,
  DollarSign,
  GitCompare,
  Lock,
  ChartColumn,
  Receipt,
  CircleDollarSign,
  AlertTriangle,
  Plus as PlusIcon,
  Info,
  GripVertical,
  Trash2,
  User,
  CheckCheck,
  Banknote,
  Printer,
  RotateCcw,
  CheckCircle2,
  Archive,
  BadgePercent,
  Upload,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { DatePicker } from '@/app/components/ui/date-picker';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { Invoice } from '@/app/data/mockInvoices';
import type { Payment } from '@/app/data/mockPayments';
import { BulkActionDialog } from '@/app/components/BulkActionDialog';
import { BulkInvoiceList } from '@/app/components/BulkInvoiceList';
import { SavedViewsDialog, SavedViewsSection, useSavedViews, type SavedView } from '@/app/components/SavedViewsDialog';

// Seed views carry the COMPLETE filter shape so applying one resets every
// facet (a partial object used to clobber the filters state and crash on
// the missing arrays) and so exact-match detection in the chip row works.
const INVOICE_SAVED_VIEW_SEEDS: SavedView[] = [
  {
    id: '1',
    name: 'Pending Approval Queue',
    starred: true,
    filters: { dateFrom: '', dateTo: '', dueFrom: '', dueTo: '', amountMin: '', amountMax: '', types: [], statuses: ['Pending Approval', 'Matched'], vendors: [], createdBy: [] },
  },
  {
    id: '2',
    name: 'Exception Invoices',
    starred: true,
    filters: { dateFrom: '', dateTo: '', dueFrom: '', dueTo: '', amountMin: '', amountMax: '', types: [], statuses: ['Exception'], vendors: [], createdBy: [] },
  },
  {
    id: '3',
    name: 'This Month PO-Based',
    starred: false,
    filters: {
      dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      dateTo: localTodayIso(),
      dueFrom: '', dueTo: '', amountMin: '', amountMax: '', types: ['PO-based'], statuses: [], vendors: [], createdBy: [],
    },
  },
];
import { ExportDialog } from '@/app/components/ExportDialog';
import { AdvancedInvoiceTable } from '@/app/components/AdvancedInvoiceTable';
import { SearchSelectPeople } from '@/app/components/SearchSelectPeople';
import { rowMatchesColumns } from '@/app/components/data-table';
import { useTableStates, type DataTableEmptyConfig } from '@/app/components/data-table/DataTable';
import { TableEmptyState, CardSkeletonGrid, TableStaleBanner } from '@/app/components/ui/table-empty-state';
import { InvoiceDataTable, INVOICE_COLUMNS, TYPE_CONFIG, statusDisplayLabel, invoiceStatusAxes, renderApprovalStatus, renderPaymentStatus, invoiceColumnValue, VendorCell, CreatedByCell, ACTION_ICONS } from '@/app/components/InvoiceDataTable';
import { MultiSelectFilter } from '@/app/components/data-table/MultiSelectFilter';
import { formatUsDate, localTodayIso, overdueDaysOf, overdueLabel, isInvoiceOverdue, compareMostOverdue, MOST_OVERDUE_SORT_KEY } from '@/app/lib/dueBucket';
import { discountIsLive, discountTermsFor, paymentTermsFor, invoiceTypeLabel } from '@/app/lib/runMath';
import { ViewDensityMenu } from '@/app/components/data-table/ViewDensityMenu';
import {
  InvoiceInsightsPanel,
  ALL_INVOICE_KPI_DEFINITIONS,
  InvoiceKpiIcon,
  computeInvoiceKpi,
  filterInvoicesByRange,
  filterInvoicesByPreviousRange,
  type InvoiceKpiDefinition,
  type KpiDelta,
  type InsightsRange,
} from '@/app/components/InvoiceInsightsPanel';
import { InsightsRangeMenu, INSIGHTS_RANGE_OPTIONS } from '@/app/components/InsightsRangeMenu';
import { InsightsResetButton } from '@/app/components/InsightsResetButton';
import { InsightsRefresh } from '@/app/components/InsightsRefresh';
import { BulkActionBar, type BulkAction } from '@/app/components/BulkActionBar';
import { getBulkActions, getRowActionGroups, isCancellable, type InvoiceActionId } from '@/app/data/invoiceActions';
import { InvoiceReasonDialog, type ReasonAction } from '@/app/components/InvoiceReasonDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { SlidersHorizontal as SlidersIcon } from 'lucide-react';
import { ColumnSelector, ColumnSelectorTrigger } from '@/app/components/ColumnSelector';
import {
  applyInvoiceColumnFilters,
  type ColumnFilterState,
  type SortConfig,
  isInvoiceFilterActive,
} from '@/app/components/InvoiceColumnHeaderMenu';
import { InvoiceActiveFiltersBar } from '@/app/components/InvoiceActiveFiltersBar';
// QuickViewPanel side drawer removed per design — row click no longer
// opens a peek panel. The row-action dropdown's "View Details" still
// navigates to the full invoice page.
// import { InvoiceQuickViewPanel } from '@/app/components/InvoiceQuickViewPanel';
import { toast } from 'sonner';
import { InvoiceRowActionModals } from '@/app/components/InvoiceRowActionModals';
import { buildReversiblePayments } from '@/app/lib/reversiblePayments';
import { openRunInvoiceIds, type PaymentRun } from '@/app/data/paymentRuns';
import { palette } from '@/styles/tokens';

// Catalog of every column that can appear in the invoice table.
// Order here is the default order; ColumnSelector persists user changes.
const INVOICE_COLUMN_CATALOG: { key: string; label: string }[] = [
  { key: 'invoiceNumber', label: 'Invoice ID' },
  { key: 'type', label: 'Invoice Type' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'vendorInvoiceNumber', label: 'Vendor Invoice No.' },
  { key: 'invoiceDate', label: 'Vendor Invoice Date' },
  // The two dates the due date DERIVES from (9/22/26 review response,
  // Claude C13-X3): auditable from the list, hidden by default.
  { key: 'triggerDate', label: 'Trigger Date' },
  { key: 'postingDate', label: 'Posting Date' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'paymentTerms', label: 'Payment Terms' },
  // Two status columns, not one merged pill (Eli review 7/15/26).
  { key: 'approvalStatus', label: 'Invoice Status' },
  { key: 'paymentStatus', label: 'Payment Status' },
  { key: 'amount', label: 'Amount' },
  { key: 'discount', label: 'Discount' },
  // Linked Records sits after Amount (feedback 7/16/26).
  { key: 'linkedRecords', label: 'Linked Records' },
  { key: 'apAccount', label: 'A/P Account' },
  { key: 'currency', label: 'Currency' },
  { key: 'description', label: 'Description' },
  { key: 'updatedBy', label: 'Last Updated By' },
  { key: 'updatedDate', label: 'Last Updated On' },
  { key: 'createdBy', label: 'Created By' },
  { key: 'createdDate', label: 'Created On' },
];

const LOCKED_INVOICE_COLUMNS = ['invoiceNumber']; // Invoice ID is always pinned/visible

// Early-pay discount check for the quick toggle (8/28/26 evening): a
// live window from the invoice's payment term, as of today.
function invoiceHasLiveDiscount(invoice: Invoice): boolean {
  const terms = discountTermsFor(invoice);
  return !!terms && discountIsLive(terms) && invoice.outstandingBalance > 0;
}

interface InvoiceListScreenProps {
  invoices: Invoice[];
  /** Payment records — drives the "Payment scheduled" quick-filter
   *  option, which is a payment-record fact, not an invoice status. */
  payments?: Payment[];
  onCreateInvoice: () => void;
  /** Launch the bulk import run (vendor ledger only). */
  onImportInvoices?: () => void;
  onViewInvoice: (invoiceId: string) => void;
  applyInvoiceAction?: (
    invoiceIds: string[],
    action:
      | 'submit'
      | 'approve'
      | 'reject'
      | 'cancel'
      | 'uncancel'
      | 'paymentHold'
      | 'flagException'
      | 'resolve'
      | 'releaseHold'
      | 'archive'
      | 'restore',
    reason: string,
    notifiedRecipientIds?: string[]
  ) => void;
  /** Launch the Record Payment flow pre-scoped to these invoices. */
  onPayInvoices?: (invoiceIds: string[]) => void;
  /** Launch the Record Prepayment flow seeded from a pre-invoice. */
  onAddPrepayment?: (vendor: string, preInvoiceId?: string) => void;
  /** Open the fix-and-resubmit flow for an Exception invoice — same
   *  callback the detail page uses, so a row-menu Resolve captures the
   *  recordation (notes, documents, notify) instead of clearing the
   *  exception in one click (BA 9/28 blocker). */
  onEditResubmit?: (invoice: Invoice, reason: string, notifiedRecipientIds?: string[]) => void;
  /** Reverse a payment from the row menu — same App handler and modal
   *  the detail page uses (10/9/26). */
  onReversePayment?: (args: { invoiceId?: string; paymentReference: string; amount?: number; reason?: string }) => void;
  /** Open payment runs — their invoices read "In Payment Run" (user 9/23). */
  runs?: PaymentRun[];
  /** Which ledger this listing serves. Drives the header icon (matches
   *  the Overview module card) and the AR copy direction. */
  module?: 'vendor' | 'customer';
}

type DensityMode = 'condensed' | 'comfort' | 'card';
type BulkActionType =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'addPayment'
  | 'paymentHold'
  | 'cancel'
  | 'export'
  | 'print'
  | 'releaseHold'
  | 'resolve'
  | 'resubmit'
  | 'archive'
  | null;

// Draft was retired from the workflow; tab + map entries removed.
// Two-axis status filters (Eli review 7/15/26): the single-status pill
// wall is gone. Approval answers "whose desk is this on," payment
// answers "where's the money" — each gets its own compact dropdown.
// Payment hold is a flag, not a status (ERP-8796): it never appears on
// the Invoice Status axis and filters on its own via the On hold toggle.
// "Archived" is a lifecycle flag, not a status, but it rides the
// invoice-status filter as a reveal toggle (VI-16): archived invoices are
// hidden by default and this value brings them back.
const APPROVAL_FILTER_OPTIONS = ['Pending Approval', 'Approved', 'Exception', 'Rejected', 'Cancelled', 'Archived'] as const;
// Payment axis final enum (7/17/26, wording locked 7/19/26): Scheduled
// = a payment is approved/scheduled but not cleared (derived from
// payment records); Settled = zeroed without cash (e.g. a full credit
// memo); Void = cancelled. The prepaid pair was removed entirely.
const PAYMENT_FILTER_OPTIONS = ['Unpaid', 'In Payment Run', 'Partially Paid', 'Paid in Full', 'Scheduled', 'Void', 'Settled'] as const;
const PAYMENT_SCHEDULED_OPTION = 'Scheduled';
// Additional quick-filter axes (feedback 7/16/26): type, due-date
// urgency and vendor join the two status dropdowns. Type folds
// 'PO-based' into Receiving (taxonomy rev 7/13/26).
// Labels match the type pills verbatim (user 9/28): Inventory Invoice /
// Standalone Invoice / Pre-Invoice — never "Receiving" or "(Pro-Forma)"
// variants that exist nowhere else in the module.
// Saved Views visibility (user 9/28): hidden for now, everything stays
// wired — flip to true to bring the header button + starred chips back.
const SHOW_SAVED_VIEWS = false;

const TYPE_QUICK_GROUPS: { id: string; label: string; values: string[] }[] = [
  { id: 'receiving', label: 'Inventory Invoice', values: ['Receiving-based', 'PO-based', 'GRN-based'] },
  { id: 'standalone', label: 'Standalone Invoice', values: ['Standalone'] },
  { id: 'pre-invoice', label: 'Pre-Invoice (Pro-Forma)', values: ['Pre-Invoice'] },
];

// Quick ↔ advanced type-filter sync (GPT QC05, 9/30: the advanced modal
// narrowed to Standalone while the quick control still read "All").
// The two surfaces speak different vocabularies — group ids vs raw
// invoice types — so these convert between them.
const typeGroupsToRaw = (ids: string[]): string[] =>
  TYPE_QUICK_GROUPS.filter((g) => ids.includes(g.id)).flatMap((g) => g.values);
const rawToTypeGroups = (types: string[]): string[] =>
  TYPE_QUICK_GROUPS.filter((g) => g.values.some((v) => types.includes(v))).map((g) => g.id);

// Session snapshot of the list's view state (VI-44). Opening a row swaps the
// list screen out for the detail screen, unmounting the list and dropping its
// React state — search, filters, sort, page size and page. This module-level
// cache survives that unmount, so "Back to invoice list" restores exactly
// what the user left. A full reload clears it (main.tsx wipes app storage),
// so the list still opens fresh on refresh.
let persistedListView: Record<string, any> | null = null;

export function InvoiceListScreen({
  invoices,
  payments = [],
  onCreateInvoice,
  onImportInvoices,
  onViewInvoice,
  applyInvoiceAction,
  onPayInvoices,
  onAddPrepayment,
  onEditResubmit,
  onReversePayment,
  runs = [],
  module = 'vendor',
}: InvoiceListScreenProps) {
  // Invoice numbers with a live scheduled payment against them — feeds
  // the "Payment scheduled" quick-filter option.
  const scheduledInvoiceNumbers = new Set<string>();
  payments.forEach((p) => {
    if (p.status !== 'Scheduled') return;
    (p.appliedInvoices ?? []).forEach((a) => scheduledInvoiceNumbers.add(a.invoiceNumber));
  });
  // Rows carry the transient Scheduled fact (9/22/26 review response,
  // GPT C02-D1): a recorded run's invoices READ Scheduled on the Payment
  // Status column, the filter and the counts — one derivation for all
  // three, so the buckets always add up to the row count.
  // Open-run locks (user 9/23): an invoice committed to a draft, pending
  // or approved run reads "In Payment Run" on the Payment Status axis.
  const inRunIds = openRunInvoiceIds(runs);
  const rows = invoices.map((inv) => {
    const scheduled = scheduledInvoiceNumbers.has(inv.invoiceNumber);
    const inRun = inRunIds.has(inv.id);
    return scheduled || inRun ? { ...inv, paymentScheduled: scheduled || undefined, inPaymentRun: inRun || undefined } : inv;
  });
  // Two independent status filters (Eli review 7/15/26) — multi-select,
  // empty = filter off.
  const [approvalFilter, setApprovalFilter] = useState<string[]>(() => persistedListView?.approvalFilter ?? []);
  const [paymentFilter, setPaymentFilter] = useState<string[]>(() => persistedListView?.paymentFilter ?? []);
  // Type / due-date / vendor / creator / currency / A/P account quick
  // filters (feedback 7/16/26). Due date also takes a custom calendar
  // range, mutually exclusive with the urgency buckets.
  const [typeQuickFilter, setTypeQuickFilter] = useState<string[]>(() => persistedListView?.typeQuickFilter ?? []);
  // Due-date bucket quick filter retired with its modal dropdown (user
  // 10/4): the Filters modal's From/To range is the one due-date control.
  const [vendorQuickFilter, setVendorQuickFilter] = useState<string[]>(() => persistedListView?.vendorQuickFilter ?? []);
  const [createdByQuickFilter, setCreatedByQuickFilter] = useState<string[]>(() => persistedListView?.createdByQuickFilter ?? []);
  const [currencyQuickFilter, setCurrencyQuickFilter] = useState<string[]>(() => persistedListView?.currencyQuickFilter ?? []);
  const [apAccountQuickFilter, setApAccountQuickFilter] = useState<string[]>(() => persistedListView?.apAccountQuickFilter ?? []);
  // Payment terms + early-pay discount quick filters (8/28/26 evening).
  // Discount is a single TOGGLE, off by default: on = only invoices with
  // a live early-pay window; off = no filtering.
  const [paymentTermsQuickFilter, setPaymentTermsQuickFilter] = useState<string[]>(() => persistedListView?.paymentTermsQuickFilter ?? []);
  const [discountOnly, setDiscountOnly] = useState(() => persistedListView?.discountOnly ?? false);
  // On hold toggle (ERP-8796, AC3): filters independently of Invoice
  // Status, so an Exception invoice on hold matches under both.
  const [holdOnly, setHoldOnly] = useState<boolean>(() => persistedListView?.holdOnly ?? false);
  const [searchQuery, setSearchQuery] = useState(() => persistedListView?.searchQuery ?? '');
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const DENSITY_STORAGE_KEY = 'omnesoft:invoices:density';
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
  const [currentPage, setCurrentPage] = useState(() => persistedListView?.currentPage ?? 1);
  const [recordsPerPage, setRecordsPerPage] = useState(() => persistedListView?.recordsPerPage ?? 100);
  const [bulkActionType, setBulkActionType] = useState<BulkActionType>(null);
  const [showBulkActionDialog, setShowBulkActionDialog] = useState(false);
  // Bulk approve pre-execution confirmation: which invoices will be
  // approved, and which selected rows are skipped as ineligible.
  const [approveConfirm, setApproveConfirm] = useState<{ eligible: Invoice[]; skipped: Invoice[] } | null>(null);
  // Row-menu approve uses the DETAIL page's single-invoice confirm, and
  // the approve-on-hold gate when a hold rides along (10/9/26).
  const [singleApprove, setSingleApprove] = useState<Invoice | null>(null);
  const [approveHoldInvoice, setApproveHoldInvoice] = useState<Invoice | null>(null);
  // Row-menu Reverse Payment opens the detail page's ReversePaymentModal.
  const [reverseInvoiceId, setReverseInvoiceId] = useState<string | null>(null);
  const [showSavedViewsDialog, setShowSavedViewsDialog] = useState(false);
  const { views: savedViews, saveView, deleteView, toggleStar } = useSavedViews(INVOICE_SAVED_VIEW_SEEDS);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  // AP / AR are now separate nav entities (Vendor Invoicing vs Customer
  // Invoicing) rather than an in-page tab — see Layout's FINANCE_CHILDREN.
  // This screen is the Vendor (AP) ledger only.
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);

  // Insights date range — drives the "Last N days" pill on the Performance
  // Insights header. Mirrors partners' KpiInsightsPanel range selector.
  // v2: default range is All time so the KPI strip mirrors the listing
  // table out of the box (design feedback 7/8/26) — narrowing the range
  // then scopes the flow KPIs (Total invoices, Paid in full, averages).
  // v3: default moved from all-time to Last 30 days (design review
  // 7/9/26) — bump drops saved all-time prefs so the new default lands.
  const INSIGHTS_RANGE_STORAGE_KEY = 'omnesoft:invoices:insights-range-v3';
  const [insightsRange, setInsightsRangeRaw] = useState<InsightsRange>(() => {
    try {
      const v = localStorage.getItem(INSIGHTS_RANGE_STORAGE_KEY);
      if (v && INSIGHTS_RANGE_OPTIONS.some((o) => o.key === v)) return v as InsightsRange;
    } catch {
      /* ignore */
    }
    // Default to a bounded window — all-time becomes a performance
    // exception on real data (design review 7/9/26).
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
  // Shorter "period" label for the per-card delta sub-text — renders
  // as "vs prior 30 days". `all_time`/`custom` return undefined so the cards
  // suppress the period anchor when there's no prior window.
  const RANGE_PERIOD_LABEL: Record<InsightsRange, string | undefined> = {
    last_7: '7 days',
    last_30: '30 days',
    last_90: '90 days',
    last_365: '12 months',
    all_time: undefined,
    custom: undefined,
  };
  const insightsPeriodLabel = RANGE_PERIOD_LABEL[insightsRange];

  // Quick-view side-drawer state retired — row click does nothing now; use
  // the row-action dropdown's "View Details" to open the full invoice page.

  // Card view size — small / medium / large grids (partners parity)
  const CARD_SIZE_STORAGE_KEY = 'omnesoft:invoices:card-size';
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>(() => {
    try {
      const v = localStorage.getItem(CARD_SIZE_STORAGE_KEY);
      // 'large' is parked for the next phase (user 9/28): a stored large
      // preference falls back to medium so the disabled option never renders.
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

  // Reason dialog for Reject / Cancel / Payment Hold (PRD §1.7.4)
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reasonTargetIds, setReasonTargetIds] = useState<string[]>([]);
  // Selected rows the bulk action can't touch (VI-39): the reason dialog
  // only ever acts on the eligible targets, and the toast names the rest as
  // skipped instead of claiming they were all rejected.
  const [reasonSkippedCount, setReasonSkippedCount] = useState(0);
  // Which rows were skipped and why, listed in the popup (Mahreen 10/10).
  const [reasonSkipped, setReasonSkipped] = useState<{ invoiceNumbers: string[]; reason: string }>({ invoiceNumbers: [], reason: '' });

  // Column selector drawer (PRD-mirroring partners ColumnSelector).
  // Order/visibility are session-only (rev 7/16/26): a refresh always
  // restores the catalog's default flow, rearrangements never persist.
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => INVOICE_COLUMN_CATALOG.map((c) => c.key));
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    // The derivation dates (Trigger / Posting) join the palette hidden by
    // default (9/22/26, Claude C13-X3) — one toggle away, no layout shift.
    Object.fromEntries(INVOICE_COLUMN_CATALOG.map((c) => [c.key, c.key !== 'triggerDate' && c.key !== 'postingDate'])),
  );
  // Column drawer Reset restores this default view and remounts the
  // table so dragged widths snap back too (10/9/26).
  const [columnResetKey, setColumnResetKey] = useState(0);
  const updateColumnOrder = (next: string[]) => setColumnOrder(next);
  const updateColumnVisibility = (next: Record<string, boolean>) => setColumnVisibility(next);
  const visibleColumnCount = INVOICE_COLUMN_CATALOG.filter(
    (c) => columnVisibility[c.key] !== false
  ).length;

  // Per-column filter + sort state (driven by InvoiceColumnHeaderMenu / new DataTable)
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>(() => persistedListView?.columnFilters ?? {});
  // Due date ascending by default (user 10/5): the most overdue invoices
  // sit on top — the payables priority order, same default as the run
  // authoring pool. Header sorts still override it.
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(() => persistedListView?.sortConfig ?? { key: 'dueDate', direction: 'asc' });
  // Header menu can pass direction=null to clear the current sort.
  const handleColumnSort = (columnKey: string, direction: 'asc' | 'desc' | null) => {
    if (direction === null) setSortConfig(null);
    else setSortConfig({ key: columnKey, direction });
    setCurrentPage(1);
  };
  const handleColumnFilterChange = (columnKey: string, filter: ColumnFilterState) => {
    setColumnFilters((prev) => {
      const next = { ...prev, [columnKey]: filter };
      // Prune cleared filters to keep the active list tight
      if (!isInvoiceFilterActive(filter)) delete next[columnKey];
      return next;
    });
    setCurrentPage(1);
  };
  const handleHideColumnFromHeader = (columnKey: string) => {
    if (LOCKED_INVOICE_COLUMNS.includes(columnKey)) return;
    updateColumnVisibility({ ...columnVisibility, [columnKey]: false });
  };
  // "Add filter" from the header menu — wires a blank filter for that column
  // (the inline menu UI then renders the editor in the same popover).
  const handleAddColumnFilter = (columnKey: string) => {
    setColumnFilters((prev) => {
      if (prev[columnKey]) return prev;
      // Use the column's filterType from the new INVOICE_COLUMNS catalog if available
      const fromCatalog = (INVOICE_COLUMNS as { key: string; filterType?: ColumnFilterState['type'] }[])
        .find((c) => c.key === columnKey);
      const type: ColumnFilterState['type'] = fromCatalog?.filterType ?? 'text';
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
  // Frozen columns — locked Invoice ID is always frozen. Users can additionally
  // freeze others via the header menu's "Freeze" item.
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(
    () => new Set(LOCKED_INVOICE_COLUMNS)
  );
  const handleFreezeColumn = (columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && !LOCKED_INVOICE_COLUMNS.includes(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  };

  // Me mode removed entirely (user 10/5).

  // The blue "Invoices in this period" leads the band and Overdue is OUT of
  // the default set (user 10/8, supersedes the same-day overdue-first call);
  // Overdue stays available in Customize Insights.
  const DEFAULT_ACTIVE_KPIS = ['total_invoices', 'pending_review', 'paid_in_full'];
  const KPI_STORAGE_KEY = 'omnesoft:invoices:active-widgets';

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
    return DEFAULT_ACTIVE_KPIS;
  });

  const handleToggleKpi = (key: string) => {
    setActiveKpiKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleRemoveKpi = (key: string) => {
    setActiveKpiKeys((prev) => {
      const next = prev.filter((k) => k !== key);
      try {
        localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
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

  // Insights reset — partner Performance-Insights header control. Refresh
  // moved into the shared InsightsRefresh component.
  const handleInsightsReset = () => {
    setActiveKpiKeys(DEFAULT_ACTIVE_KPIS);
    try {
      localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(DEFAULT_ACTIVE_KPIS));
    } catch {
      /* ignore */
    }
    toast.info('Insights reset', { description: 'Restored the default widgets and order.' });
  };
  // Reset only lights up when there's something to undo: a different widget
  // set OR a drag-and-drop reorder (join is order-sensitive on purpose).
  const insightsDirty = activeKpiKeys.join(',') !== DEFAULT_ACTIVE_KPIS.join(',');

  const [filters, setFilters] = useState(() => persistedListView?.filters ?? {
    dateFrom: '',
    dateTo: '',
    dueFrom: '',
    dueTo: '',
    amountMin: '',
    amountMax: '',
    types: [] as string[],
    statuses: [] as string[],
    vendors: [] as string[],
    createdBy: [] as string[],
  });

  // Mirror the view state into the session snapshot on every change (VI-44),
  // so leaving for a detail page and coming back restores search, filters,
  // sort, page size and page exactly as they were.
  useEffect(() => {
    persistedListView = {
      searchQuery, currentPage, recordsPerPage, sortConfig, filters,
      approvalFilter, paymentFilter, typeQuickFilter, vendorQuickFilter,
      createdByQuickFilter, currencyQuickFilter, apAccountQuickFilter,
      paymentTermsQuickFilter, discountOnly, holdOnly, columnFilters,
    };
  }, [
    searchQuery, currentPage, recordsPerPage, sortConfig, filters,
    approvalFilter, paymentFilter, typeQuickFilter, vendorQuickFilter,
    createdByQuickFilter, currencyQuickFilter, apAccountQuickFilter,
    paymentTermsQuickFilter, discountOnly, holdOnly, columnFilters,
  ]);

  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const [typeSearch, setTypeSearch] = useState('');
  const [statusSearch, setStatusSearch] = useState('');

  const filteredInvoices = rows.filter((invoice) => {

    // Archived invoices stay out of the default list (VI-16); the
    // "Archived" status value is the only thing that reveals them.
    if (invoice.isArchived && !approvalFilter.includes('Archived')) return false;

    if (approvalFilter.length > 0 || paymentFilter.length > 0) {
      const axes = invoiceStatusAxes(invoice.status, invoice);
      if (approvalFilter.length > 0) {
        const approvalMatch =
          approvalFilter.includes(axes.approval) || (!!invoice.isArchived && approvalFilter.includes('Archived'));
        if (!approvalMatch) return false;
      }
      if (paymentFilter.length > 0) {
        // Scheduled is a first-class axis value now (9/22/26): the row
        // derivation above already promoted in-run invoices, so a plain
        // axis match returns exactly the scheduled population.
        if (!axes.payment || !paymentFilter.includes(axes.payment)) return false;
      }
    }

    if (typeQuickFilter.length > 0) {
      const group = TYPE_QUICK_GROUPS.find((g) => g.values.includes(invoice.type));
      if (!group || !typeQuickFilter.includes(group.id)) return false;
    }
    if (vendorQuickFilter.length > 0 && !vendorQuickFilter.includes(invoice.vendor)) return false;
    if (createdByQuickFilter.length > 0 && !createdByQuickFilter.includes(invoice.createdBy)) return false;
    if (currencyQuickFilter.length > 0 && !currencyQuickFilter.includes(invoice.currency)) return false;
    if (apAccountQuickFilter.length > 0 && !apAccountQuickFilter.includes(invoice.apAccount)) return false;
    if (paymentTermsQuickFilter.length > 0 && !paymentTermsQuickFilter.includes(paymentTermsFor(invoice))) return false;
    if (discountOnly && !invoiceHasLiveDiscount(invoice)) return false;
    if (holdOnly && !invoice.is_payment_held) return false;

    // Trimmed before matching (GPT QC04, 9/30: a pasted reference with
    // surrounding spaces returned zero results). Amounts are searchable
    // too (U4): 49316 finds the $49,316.00 invoice.
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      const query = trimmedQuery.toLowerCase();
      // Amount matching only kicks in for a purely NUMERIC query (VI-37):
      // "ACM-6110" is an invoice code, not the amount $61,101 — its digits
      // must never leak into the amount match. A query with any letter is a
      // text search over the id/vendor/reference columns only.
      const isNumericQuery = !/[a-z]/i.test(trimmedQuery);
      const digits = query.replace(/[^0-9.]/g, '');
      if (
        !(
          invoice.invoiceNumber.toLowerCase().includes(query) ||
          invoice.vendor.toLowerCase().includes(query) ||
          invoice.vendorInvoiceNumber.toLowerCase().includes(query) ||
          invoice.reference.toLowerCase().includes(query) ||
          invoice.description.toLowerCase().includes(query) ||
          invoice.apAccount.toLowerCase().includes(query) ||
          // Every column, shown or not, by the text its cell prints
          // (hidden-column-search, 10/14/26).
          rowMatchesColumns(invoice, INVOICE_COLUMNS, trimmedQuery) ||
          (isNumericQuery && digits.length >= 2 && (
            String(invoice.amount).includes(digits) ||
            invoice.amount.toFixed(2).includes(digits) ||
            String(Math.round(invoice.amount)).includes(digits)
          ))
        )
      )
        return false;
    }

    // The range filters the POSTING date and says so (Nophil 9/28: "what
    // is it searching? Then say that"). Pre-invoices without a posting
    // date fall back to their record date so they stay findable.
    if (filters.dateFrom) {
      if (new Date(invoice.postingDate || invoice.date) < new Date(filters.dateFrom)) return false;
    }
    if (filters.dateTo) {
      if (new Date(invoice.postingDate || invoice.date) > new Date(filters.dateTo)) return false;
    }
    if (filters.dueFrom && new Date(invoice.dueDate) < new Date(filters.dueFrom)) return false;
    if (filters.dueTo && new Date(invoice.dueDate) > new Date(filters.dueTo)) return false;
    if (filters.amountMin !== '' && invoice.amount < Number(filters.amountMin)) return false;
    if (filters.amountMax !== '' && invoice.amount > Number(filters.amountMax)) return false;
    if (filters.types.length > 0 && !filters.types.includes(invoice.type)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(invoice.status)) return false;
    if (filters.vendors.length > 0 && !filters.vendors.includes(invoice.vendor)) return false;
    if (filters.createdBy.length > 0 && !filters.createdBy.includes(invoice.createdBy)) return false;

    return true;
  });

  // Apply per-column filters from the column-header menu
  const columnFiltersList = Object.values(columnFilters);
  let processedInvoices = applyInvoiceColumnFilters(filteredInvoices, columnFiltersList, invoiceColumnValue);

  // Apply active sort
  if (sortConfig?.key === MOST_OVERDUE_SORT_KEY) {
    // Due Date → "Most overdue first" (user 10/9): days past due, highest first.
    processedInvoices = [...processedInvoices].sort(compareMostOverdue);
  } else if (sortConfig) {
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const key = sortConfig.key;
    processedInvoices = [...processedInvoices].sort((a, b) => {
      const av = (a as any)[key];
      const bv = (b as any)[key];
      if (av == null && bv == null) return 0;
      if (av == null) return -dir;
      if (bv == null) return dir;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  } else {
    // Default register order (GPT QC06, 9/30 — S1 "most overdue first"):
    // open invoices by due date ascending (the most-overdue on top),
    // settled / cancelled / archived rows last. Any column sort the user
    // picks replaces this entirely.
    const closedRank = (inv: Invoice): number =>
      inv.isArchived || ['Paid in Full', 'Settled', 'Cancelled'].includes(inv.status) ? 1 : 0;
    processedInvoices = [...processedInvoices].sort((a, b) => {
      const rank = closedRank(a) - closedRank(b);
      if (rank !== 0) return rank;
      return String(a.dueDate ?? '').localeCompare(String(b.dueDate ?? ''));
    });
  }
  // Replace the variable name used downstream
  const sortedFilteredInvoices = processedInvoices;

  const clearFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', dueFrom: '', dueTo: '', amountMin: '', amountMax: '', types: [], statuses: [], vendors: [], createdBy: [] });
    // Status axes live in the quick-filter pills; Clear All resets them too.
    setApprovalFilter([]);
    setPaymentFilter([]);
    setTypeQuickFilter([]);
    setVendorQuickFilter([]);
    setCreatedByQuickFilter([]);
    setCurrencyQuickFilter([]);
    setApAccountQuickFilter([]);
    setPaymentTermsQuickFilter([]);
    setDiscountOnly(false);
    setHoldOnly(false);
  };

  // Merge over the empty shape so a view only carrying some facets still
  // resets the rest instead of leaving stale (or missing) keys behind.
  const handleApplySavedView = (savedFilters: any) => {
    setFilters({ dateFrom: '', dateTo: '', dueFrom: '', dueTo: '', amountMin: '', amountMax: '', types: [], statuses: [], vendors: [], createdBy: [], ...savedFilters });
    // Keep the quick type + vendor controls honest (QC05, VI-34) when a
    // view applies them.
    setTypeQuickFilter(rawToTypeGroups(savedFilters?.types ?? []));
    setVendorQuickFilter(savedFilters?.vendors ?? []);
  };

  // The Filters badge counts only what the toolbar can't show (user
  // 10/26/26, narrows VI-47): Invoice Status, Payment Status, Vendor,
  // Invoice Type, Payment Terms and On hold already show their own active
  // state as pills, so counting them again read as a second, hidden
  // filter. The badge flags filters that live ONLY inside the modal, the
  // ones a user can't otherwise see narrowing the list (ReadyToPay rule).
  const activeFiltersCount =
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.dueFrom || filters.dueTo ? 1 : 0) +
    (filters.amountMin || filters.amountMax ? 1 : 0) +
    Math.max(filters.createdBy.length, createdByQuickFilter.length) +
    filters.statuses.length +
    apAccountQuickFilter.length +
    currencyQuickFilter.length +
    (discountOnly ? 1 : 0);

  // Table Empty & Error States Standard (11/3/26): every non-search filter
  // counts honestly here, pills included, unlike the Filters badge above.
  const emptyFilterCount =
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.dueFrom || filters.dueTo ? 1 : 0) +
    (filters.amountMin || filters.amountMax ? 1 : 0) +
    filters.types.length +
    filters.statuses.length +
    filters.vendors.length +
    Math.max(filters.createdBy.length, createdByQuickFilter.length) +
    approvalFilter.length +
    paymentFilter.length +
    typeQuickFilter.length +
    vendorQuickFilter.length +
    currencyQuickFilter.length +
    apAccountQuickFilter.length +
    paymentTermsQuickFilter.length +
    (discountOnly ? 1 : 0) +
    (holdOnly ? 1 : 0) +
    Object.keys(columnFilters).length;
  const invoiceEmptyConfig: DataTableEmptyConfig = {
    entity: { singular: 'invoice', plural: 'invoices' },
    totalCount: invoices.length,
    filterCount: emptyFilterCount,
    onClearSearch: () => { setSearchQuery(''); setCurrentPage(1); },
    onClearFilters: () => { clearFilters(); setColumnFilters({}); setCurrentPage(1); },
    onSearch: (q) => { setSearchQuery(q); setCurrentPage(1); },
    onCreate: onCreateInvoice,
    createLabel: 'Create New Vendor Invoice',
  };

  // KPIs
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalCount = invoices.length;
  const pendingInvoices = invoices.filter((inv) => inv.status === 'Pending Approval');
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const pendingCount = pendingInvoices.length;
  const paidInvoices = invoices.filter((inv) => inv.status === 'Paid in Full');
  const paidAmount = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidCount = paidInvoices.length;
  // One shared overdue definition (VI-32): approved-and-owing past due,
  // plus any live pre-invoice past due with a balance. Same predicate the
  // Overdue KPI uses, so rows and card can never disagree.
  const overdueInvoices = invoices.filter(isInvoiceOverdue);
  const overdueCount = overdueInvoices.length;

  // ─── Filter modal counts (partner-style chips with N suffix) ───
  // 'PO-based' folds into Receiving (taxonomy rev 7/13/26: every PO
  // invoice is a receiving invoice), so one chip matches both raw types.
  // Same pill vocabulary as TYPE_QUICK_GROUPS (user 9/28); GRN-based
  // folds into the inventory chip like everywhere else.
  const TYPE_FILTER_OPTIONS: { key: string; values: Invoice['type'][]; label: string }[] = [
    { key: 'receiving', values: ['Receiving-based', 'PO-based', 'GRN-based'], label: 'Inventory Invoice' },
    { key: 'standalone', values: ['Standalone'], label: 'Standalone Invoice' },
    { key: 'pre-invoice', values: ['Pre-Invoice'], label: 'Pre-Invoice (Pro-Forma)' },
  ];
  const STATUS_FILTER_OPTIONS: string[] = [
    'Pending Approval',
    'Approved',
    'Partially Paid',
    'Paid in Full',
    'Settled',
    'Exception',
    'Cancelled',
  ];
  const typeFilterCounts: Record<string, number> = invoices.reduce(
    (acc, inv) => {
      acc[inv.type] = (acc[inv.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const statusFilterCounts: Record<string, number> = invoices.reduce(
    (acc, inv) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const createdByOptions: { name: string; count: number }[] = Object.entries(
    invoices.reduce(
      (acc, inv) => {
        acc[inv.createdBy] = (acc[inv.createdBy] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const vendorOptions: { name: string; count: number }[] = Object.entries(
    invoices.reduce(
      (acc, inv) => {
        acc[inv.vendor] = (acc[inv.vendor] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Per-axis counts shown inside the dropdown items.
  const approvalCounts: Record<string, number> = { all: invoices.length };
  const paymentCounts: Record<string, number> = { all: invoices.length };
  const typeQuickCounts: Record<string, number> = {};
  const vendorQuickCounts: Record<string, number> = {};
  const createdByQuickCounts: Record<string, number> = {};
  const currencyQuickCounts: Record<string, number> = {};
  const apAccountQuickCounts: Record<string, number> = {};
  const paymentTermsQuickCounts: Record<string, number> = {};
  let discountQuickCount = 0;
  let holdCount = 0;
  rows.forEach((i) => {
    if (i.is_payment_held && !i.isArchived) holdCount += 1;
    const axes = invoiceStatusAxes(i.status, i);
    // Archived rows read 'Archived' on the axis itself (Mahreen 10/10),
    // so one bucket per row, no double count.
    approvalCounts[axes.approval] = (approvalCounts[axes.approval] ?? 0) + 1;
    // One bucket per row (9/22/26, GPT C02-D2): Scheduled comes out of
    // the axis itself, so the payment-status counts sum to the row count
    // instead of double-counting in-run invoices.
    if (axes.payment) paymentCounts[axes.payment] = (paymentCounts[axes.payment] ?? 0) + 1;
    const group = TYPE_QUICK_GROUPS.find((g) => g.values.includes(i.type));
    if (group) typeQuickCounts[group.id] = (typeQuickCounts[group.id] ?? 0) + 1;
    vendorQuickCounts[i.vendor] = (vendorQuickCounts[i.vendor] ?? 0) + 1;
    createdByQuickCounts[i.createdBy] = (createdByQuickCounts[i.createdBy] ?? 0) + 1;
    currencyQuickCounts[i.currency] = (currencyQuickCounts[i.currency] ?? 0) + 1;
    apAccountQuickCounts[i.apAccount] = (apAccountQuickCounts[i.apAccount] ?? 0) + 1;
    const term = paymentTermsFor(i);
    paymentTermsQuickCounts[term] = (paymentTermsQuickCounts[term] ?? 0) + 1;
    if (invoiceHasLiveDiscount(i)) discountQuickCount += 1;
  });
  const vendorQuickOptions = Object.keys(vendorQuickCounts).sort();
  const createdByQuickOptions = Object.keys(createdByQuickCounts).sort();
  const currencyQuickOptions = Object.keys(currencyQuickCounts).sort();
  const apAccountQuickOptions = Object.keys(apAccountQuickCounts).sort();
  const paymentTermsQuickOptions = Object.keys(paymentTermsQuickCounts).sort();

  const toggleSelectAll = () => {
    if (selectedInvoices.length === sortedFilteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(sortedFilteredInvoices.map((inv) => inv.id));
    }
  };

  const toggleSelectInvoice = (id: string) => {
    if (selectedInvoices.includes(id)) {
      setSelectedInvoices(selectedInvoices.filter((invId) => invId !== id));
    } else {
      setSelectedInvoices([...selectedInvoices, id]);
    }
  };

  const totalPages = Math.ceil(sortedFilteredInvoices.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedInvoices = sortedFilteredInvoices.slice(startIndex, endIndex);
  const cardStates = useTableStates({
    config: invoiceEmptyConfig,
    pageRows: paginatedInvoices,
    totalRows: sortedFilteredInvoices.length,
    searchQuery,
    suggestionRows: invoices,
    columns: INVOICE_COLUMNS,
    onFirstPage: () => setCurrentPage(1),
  });

  const goToNextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
  const goToPreviousPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);
  const goToPage = (page: number) => setCurrentPage(page);

  const getPaginationButtons = () => {
    const buttons: (number | string)[] = [];
    const maxButtons = 7;
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) buttons.push(i);
    } else {
      buttons.push(1);
      if (currentPage > 3) buttons.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) buttons.push(i);
      if (currentPage < totalPages - 2) buttons.push('...');
      buttons.push(totalPages);
    }
    return buttons;
  };

  const handleRecordsPerPageChange = (value: number) => {
    setRecordsPerPage(value);
    setCurrentPage(1);
  };

  const selectApprovalFilter = (v: string[]) => {
    setApprovalFilter(v);
    setCurrentPage(1);
  };
  const selectPaymentFilter = (v: string[]) => {
    setPaymentFilter(v);
    setCurrentPage(1);
  };

  const handleEditInvoice = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onViewInvoice(invoiceId);
  };

  const handleVoidInvoice = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Void invoice:', invoiceId);
  };

  const handleDownload = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    toast.success('Download started', {
      description: `Downloading invoice ${invoice?.invoiceNumber || invoiceId} as PDF...`,
    });
  };

  const handleAddPayment = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onPayInvoices?.([invoiceId]);
  };

  const handleMatchInvoice = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    toast.info('Match Invoice', {
      description: `Opening match dialog for invoice ${invoice?.invoiceNumber || invoiceId}...`,
    });
  };

  const handleBulkAction = (actionType: BulkActionType) => {
    if (selectedInvoices.length === 0) {
      toast.error('No invoices selected', {
        description: 'Please select at least one invoice to perform this action.',
      });
      return;
    }
    if (actionType === 'export') {
      setShowExportDialog(true);
      return;
    }
    if (actionType === 'print') {
      toast.info('Printing, coming soon.');
      return;
    }
    // Contextual recovery actions (7/16/26) — the bar only offers these
    // when EVERY selected row shares the state, so no eligibility split.
    if (actionType === 'releaseHold') {
      applyInvoiceAction?.([...selectedInvoices], 'releaseHold', '');
      toast.success(`Hold released on ${selectedInvoices.length} invoice${selectedInvoices.length !== 1 ? 's' : ''}`, {
        description: 'Ready for payment again.',
      });
      setSelectedInvoices([]);
      return;
    }
    if (actionType === 'resolve') {
      // Never a one-click clear (BA 9/28 blocker): resolving goes through
      // the fix-and-resubmit flow, which is one invoice at a time.
      if (selectedInvoices.length === 1) {
        const inv = invoices.find((i) => i.id === selectedInvoices[0]);
        if (inv) {
          onEditResubmit?.(
            inv,
            [...(inv.actionHistory ?? [])].reverse().find((en) => en.action === 'flagException')?.reason ?? '',
            undefined,
          );
        }
        setSelectedInvoices([]);
        return;
      }
      toast.info('Exceptions resolve one at a time', {
        description: 'Open each invoice to fix the flagged issue and resubmit it with a note.',
      });
      return;
    }
    if (actionType === 'resubmit') {
      // Edit and Resubmit is the fix-first flow (same as the detail page
      // and the row menu), so it runs one invoice at a time like Resolve.
      if (selectedInvoices.length === 1) {
        const inv = invoices.find((i) => i.id === selectedInvoices[0]);
        if (inv) {
          onEditResubmit?.(
            inv,
            [...(inv.actionHistory ?? [])].reverse().find((en) => en.action === 'reject')?.reason ?? '',
            undefined,
          );
        }
        setSelectedInvoices([]);
        return;
      }
      toast.info('Rejected invoices resubmit one at a time', {
        description: 'Open each invoice to fix the rejection reason and resubmit it.',
      });
      return;
    }
    if (actionType === 'archive') {
      // Archive is reason-gated everywhere (VI-15): the bulk bar opens the
      // same archive reason modal the row menu does.
      setReasonAction('archive');
      setReasonTargetIds([...selectedInvoices]);
      setReasonSkippedCount(0);
      setReasonDialogOpen(true);
      return;
    }
    // Reject / Cancel / Payment Hold require a reason (PRD §1.7.4). Only the
    // rows the action can actually act on are targeted (VI-39): a cancelled
    // invoice in the selection is skipped, not rejected, and the count the
    // toast reports is the REAL one.
    if (actionType === 'reject' || actionType === 'cancel' || actionType === 'paymentHold') {
      const eligibleStatuses: Record<string, string[]> = {
        reject: ['Pending Approval'],
        cancel: ['Pending Approval', 'Approved', 'Partially Paid', 'Paid in Full', 'Exception', 'Partially Prepaid', 'Prepaid'],
        paymentHold: ['Pending Approval', 'Approved', 'Partially Paid', 'Exception', 'Partially Prepaid'],
      };
      const allowed = eligibleStatuses[actionType];
      const selectedObjs = invoices.filter((inv) => selectedInvoices.includes(inv.id));
      // Cancel keeps the $0-paid window the row and detail menus enforce.
      const eligible = selectedObjs.filter(
        (inv) =>
          allowed.includes(inv.status) &&
          !inv.isArchived &&
          (actionType !== 'cancel' || isCancellable(inv)) &&
          // An already-held invoice can't be held twice (hold is a flag).
          (actionType !== 'paymentHold' || !inv.is_payment_held),
      );
      if (eligible.length === 0) {
        const noun = actionType === 'reject' ? 'rejected' : actionType === 'cancel' ? 'cancelled' : 'placed on hold';
        toast.error('No eligible invoices selected', {
          description: actionType === 'reject'
            ? 'Only Pending Approval invoices can be rejected.'
            : `None of the selected invoices can be ${noun}.`,
        });
        return;
      }
      setReasonAction(actionType);
      setReasonTargetIds(eligible.map((inv) => inv.id));
      setReasonSkippedCount(selectedObjs.length - eligible.length);
      setReasonSkipped({
        invoiceNumbers: selectedObjs.filter((inv) => !eligible.includes(inv)).map((inv) => inv.invoiceNumber),
        reason: actionType === 'reject'
          ? 'Only Pending Approval invoices can be rejected'
          : actionType === 'cancel'
            ? 'Only invoices with nothing paid can be cancelled'
            : 'These invoices can’t be placed on hold',
      });
      setReasonDialogOpen(true);
      return;
    }
    // Submit / Approve — every bulk action confirms BEFORE executing with
    // a modal that lists exactly which invoices are affected and which
    // selected rows are skipped as ineligible (design review 7/9/26).
    if (actionType === 'submit' || actionType === 'approve') {
      // Submit was Draft→Pending; with Draft retired, submit has no eligible
      // rows and the bulk-action bar hides it automatically. Approve still
      // targets Pending Approval rows.
      const eligibleStatus: string | null =
        actionType === 'approve' ? 'Pending Approval' : null;
      const selectedObjs = invoices.filter((inv) => selectedInvoices.includes(inv.id));
      const eligible = eligibleStatus ? selectedObjs.filter((inv) => inv.status === eligibleStatus) : [];
      const skipped = selectedObjs.filter((inv) => !eligible.includes(inv));
      if (eligible.length === 0) {
        toast.error('No eligible invoices selected', {
          description: 'Only Pending Approval invoices can be approved.',
        });
        return;
      }
      setApproveConfirm({ eligible, skipped });
      return;
    }
    if (actionType === 'addPayment') {
      // Approved / Partially Paid invoices are payable, and Pending
      // Approval ones too — the payment auto-approves them (7/16/26).
      const payable = invoices.filter(
        (inv) =>
          selectedInvoices.includes(inv.id) &&
          (inv.status === 'Approved' || inv.status === 'Partially Paid' || inv.status === 'Pending Approval'),
      );
      if (payable.length === 0) {
        toast.error('No payable invoices selected', {
          description: 'Only Pending, Approved or Partially Paid invoices can be paid.',
        });
        return;
      }
      // Bulk payments (feedback 7/20/26): a cross-vendor selection is
      // fine — the Record Payment flow splits it into one payment
      // record per vendor, same as the Ready-to-pay tab.
      onPayInvoices?.(payable.map((inv) => inv.id));
      setSelectedInvoices([]);
      return;
    }
    // Fallback (export above is already handled)
    setBulkActionType(actionType);
    setShowBulkActionDialog(true);
  };

  const handleReasonConfirm = (reason: string, notifiedRecipientIds?: string[]) => {
    if (!reasonAction || reasonTargetIds.length === 0) return;
    applyInvoiceAction?.(reasonTargetIds, reasonAction, reason, notifiedRecipientIds);
    const targetSize = reasonTargetIds.length;
    const verb =
      reasonAction === 'reject'
        ? 'Rejected'
        : reasonAction === 'cancel'
          ? 'Cancelled'
          : reasonAction === 'flagException'
            ? 'Flagged'
            : reasonAction === 'archive'
              ? 'Archived'
              : reasonAction === 'uncancel'
                ? 'Uncancelled'
                : reasonAction === 'restore'
                  ? 'Restored'
                  : 'Placed on hold';
    // Uncancel names where the invoice went (Mahreen 10/10).
    const uncancelledOne =
      reasonAction === 'uncancel' && targetSize === 1
        ? invoices.find((inv) => inv.id === reasonTargetIds[0])
        : undefined;
    // One invoice reads like the detail page (BA 10/10): "Invoice
    // cancelled", not "Cancelled 1 invoice".
    const singleTarget = targetSize === 1 && reasonSkippedCount === 0
      ? invoices.find((inv) => inv.id === reasonTargetIds[0])
      : undefined;
    const singleMessage = singleTarget
      ? reasonAction === 'reject' ? 'Invoice rejected'
        : reasonAction === 'cancel' ? 'Invoice cancelled'
          : reasonAction === 'flagException' ? 'Exception flagged'
            : reasonAction === 'archive' ? 'Invoice archived'
              : reasonAction === 'restore' ? `${singleTarget.invoiceNumber} is back to Cancelled.`
                : reasonAction === 'paymentHold' ? 'Placed on payment hold'
                  : null
      : null;
    if (uncancelledOne) {
      toast.success(`${uncancelledOne.invoiceNumber} is back to Pending Approval.`);
    } else if (singleMessage) {
      toast.success(singleMessage);
    } else toast.success(
      `${verb} ${targetSize} invoice${targetSize !== 1 ? 's' : ''}${reasonSkippedCount > 0 ? ` · ${reasonSkippedCount} skipped` : ''}`,
      reasonSkippedCount > 0
        ? { description: `${reasonSkippedCount} selected ${reasonSkippedCount === 1 ? 'invoice was' : 'invoices were'} not eligible and left unchanged.` }
        : undefined,
    );
    setReasonDialogOpen(false);
    setReasonAction(null);
    setReasonTargetIds([]);
    setReasonSkippedCount(0);
    setSelectedInvoices([]);
  };

  // One row-action dispatcher shared by the table rows AND the card view
  // (VI-43): the card menu was hardcoded (and some items were dead), so
  // both now run the same per-status actions through this handler.
  const dispatchRowAction = (actionId: string, invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionId === 'edit') { handleEditInvoice(invoiceId, e); return; }
    if (actionId === 'export' || actionId === 'download') { handleDownload(invoiceId, e); return; }
    if (actionId === 'match') { handleMatchInvoice(invoiceId, e); return; }
    if (actionId === 'addPrepayment') {
      const inv = invoices.find((i) => i.id === invoiceId);
      if (inv) onAddPrepayment?.(inv.vendor, inv.id);
      return;
    }
    if (actionId === 'addPayment') { handleAddPayment(invoiceId, e); return; }
    // Archive joins the reason-dialog family (VI-15): it opens the archive
    // reason modal and actually archives on confirm, instead of a bare toast.
    // Uncancel rides the reason modal too, same as the detail page.
    if (actionId === 'reject' || actionId === 'cancel' || actionId === 'paymentHold' || actionId === 'flagException' || actionId === 'archive' || actionId === 'uncancel' || actionId === 'restore') {
      setReasonAction(actionId as any);
      setReasonTargetIds([invoiceId]);
      setReasonSkippedCount(0);
      setReasonDialogOpen(true);
      return;
    }
    if (actionId === 'approve') {
      // Row/card approve opens the detail page's single-invoice confirm
      // (10/9/26); a held invoice gets the approve-on-hold gate first.
      const inv = invoices.find((i) => i.id === invoiceId);
      if (!inv) return;
      if (inv.is_payment_held) setApproveHoldInvoice(inv);
      else setSingleApprove(inv);
      return;
    }
    if (actionId === 'resubmit') {
      // Edit and Resubmit opens the prefilled creation modal with the
      // rejection reason replayed, exactly like the detail page.
      const inv = invoices.find((i) => i.id === invoiceId);
      if (inv) {
        onEditResubmit?.(
          inv,
          [...(inv.actionHistory ?? [])].reverse().find((en) => en.action === 'reject')?.reason ?? '',
          undefined,
        );
      }
      return;
    }
    if (actionId === 'reversePayment') {
      const inv = invoices.find((i) => i.id === invoiceId);
      if (!inv) return;
      if (buildReversiblePayments(inv, invoices, payments).length === 0) {
        toast.info('No prior payments on this invoice to reverse.');
        return;
      }
      setReverseInvoiceId(invoiceId);
      return;
    }
    if (actionId === 'submit') {
      applyInvoiceAction?.([invoiceId], 'submit', '');
      toast.success('Submitted for approval');
      return;
    }
    if (actionId === 'print') { toast.info('Printing, coming soon.'); return; }
    if (actionId === 'resolve') {
      const inv = invoices.find((i) => i.id === invoiceId);
      if (inv) {
        onEditResubmit?.(
          inv,
          [...(inv.actionHistory ?? [])].reverse().find((en) => en.action === 'flagException')?.reason ?? '',
          undefined,
        );
      }
      return;
    }
    if (actionId === 'releaseHold') {
      applyInvoiceAction?.([invoiceId], 'releaseHold', '');
      toast.success('Hold released, invoice ready for payment.');
      return;
    }
    if (actionId === 'addCreditMemo') {
      onViewInvoice(invoiceId);
      toast.info('Open Actions → Add Credit Memo on the detail page.');
      return;
    }
  };

  const handleBulkActionConfirm = () => {
    const selectedInvoiceObjects = invoices.filter((inv) => selectedInvoices.includes(inv.id));
    const count = selectedInvoices.length;

    // Status eligibility per PRD §1.6.2 — non-eligible rows are skipped silently.
    const ELIGIBLE: Partial<Record<NonNullable<BulkActionType>, string[]>> = {
      submit: [], // Draft retired — submit has no eligible targets
      approve: ['Pending Approval'],
      reject: ['Pending Approval'],
      addPayment: ['Pending Approval', 'Approved', 'Partially Paid', 'Paid in Full', 'Exception'],
      paymentHold: ['Pending Approval', 'Approved', 'Partially Paid', 'Paid in Full', 'Exception'],
      cancel: ['Pending Approval', 'Approved', 'Partially Paid', 'Paid in Full', 'Exception'],
    };

    const LABELS: Partial<Record<NonNullable<BulkActionType>, string>> = {
      submit: 'Submitted for approval',
      approve: 'Approved',
      reject: 'Rejected',
      addPayment: 'Added payment to',
      paymentHold: 'Placed on payment hold',
      cancel: 'Cancelled',
    };

    if (bulkActionType && bulkActionType !== 'export') {
      const eligibleList = ELIGIBLE[bulkActionType] ?? [];
      const eligibleCount = selectedInvoiceObjects.filter((inv) => eligibleList.includes(inv.status)).length;
      const skipped = count - eligibleCount;
      const label = LABELS[bulkActionType] ?? 'Action applied to';
      toast.success(`${label} ${eligibleCount} invoice${eligibleCount !== 1 ? 's' : ''}`, {
        description: skipped > 0 ? `Skipped ${skipped} (ineligible).` : undefined,
      });
    }

    setShowBulkActionDialog(false);
    setBulkActionType(null);
    setSelectedInvoices([]);
  };

  // Tone hints by KPI key — kept in InvoiceListScreen so the panel can stay generic
  const KPI_TONE: Record<string, string> = {
    total_invoices: 'text-slate-700',
    pending_review: 'text-orange-600',
    paid_in_full: 'text-emerald-600',
    exceptions_open: 'text-rose-600',
    overdue: 'text-rose-600',
    payment_hold: 'text-amber-600',
    total_outstanding: 'text-rose-600',
    top_vendor: 'text-amber-600',
  };

  const KPI_DEF_BY_KEY: Record<string, InvoiceKpiDefinition> = Object.fromEntries(
    ALL_INVOICE_KPI_DEFINITIONS.map((d) => [d.key, d])
  );

  // Range-filtered slice that drives all KPI computations. Memo would be
  // nice but the dataset is tiny. Previous-period slice powers the
  // period-over-period delta chip on each card.
  const invoicesInRange = filterInvoicesByRange(invoices, insightsRange, insightsRange === 'custom' ? insightsCustom : undefined);
  const invoicesPreviousRange = filterInvoicesByPreviousRange(invoices, insightsRange);

  const activeKpiCards = activeKpiKeys
    .map((key) => KPI_DEF_BY_KEY[key])
    .filter(Boolean)
    .map((def) => {
      const computed = computeInvoiceKpi(def.key, invoicesInRange, invoicesPreviousRange, invoices);
      return {
        key: def.key,
        label: def.label,
        value: computed.value,
        sub: computed.sub,
        // Design feedback 7/8/26: no delta chips, and every card follows
        // one quiet pattern — black value, grey count sub-line.
        delta: undefined,
        valueClass: 'text-slate-900',
        iconName: def.iconName,
        iconBg: def.iconBg,
        iconColor: def.iconColor,
        tooltip: def.tooltip,
        example: def.example,
        formula: def.formula,
      };
    });

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Listing gutter — 12px on all sides (matches the header→table gap);
          the full-bleed header below cancels it with -mx-3/-mt-3. */}
      <div className="p-3 flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Page Header — Vendor (AP) invoicing. The Customer (AR) ledger lives
          under its own "Customer Invoicing" nav entity, so there's no longer
          an in-page AP/AR tab row here. */}
      <div className="-mx-3 -mt-3 px-3 pt-3.5 pb-3.5 bg-white border-b border-border shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Header icon mirrors the module's Overview card exactly:
                Receipt/accent for Vendor Invoicing, FileText/sky for
                Customer Invoicing (7/20/26). */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: module === 'customer' ? palette.sky[50] : 'hsl(var(--accent))' }}
            >
              {module === 'customer'
                ? <FileText className="w-4 h-4" style={{ color: palette.sky[700] }} />
                : <Receipt className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />}
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-[20px] truncate">Vendor Invoicing</h1>
              <p className="text-xs text-muted-foreground">
                {module === 'customer'
                  ? 'Capture, review, and approve customer invoices in one place.'
                  : 'Capture, review, and approve vendor invoices in one place.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Module-level export (Eli 9/8, S8-54) — moved from the table
                toolbar to the page header (user 9/25) so import/export sit
                together. DISABLED for now (user 9/28): the CTA and the
                whole ExportDialog wiring stay intact, only the click is
                parked until the next phase. */}
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
            {/* Import — plain white secondary CTA, left of the primary
                (the Vendor Payments "Start payment run" recipe). */}
            {module === 'vendor' && onImportInvoices && (
              <button
                onClick={onImportInvoices}
                className="h-9 px-3.5 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm text-[13px]"
                style={{ fontWeight: 500 }}
              >
                <Upload className="w-4 h-4 text-slate-500" />
                Import Invoices
              </button>
            )}
            <Button
              size="sm"
              onClick={onCreateInvoice}
              className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create New Vendor Invoice
            </Button>
          </div>
        </div>
      </div>

      {/* Performance Insights + KPI cards — the whole band disappears when
          every widget is removed (partner behavior); the toolbar Insights
          button is the way back in. */}
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
                  valueClass={kpi.valueClass}
                  iconName={kpi.iconName}
                  iconColor={kpi.iconColor}
                  iconBg={kpi.iconBg}
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

      {/* Unified Table Container — wraps search, pills, table, pagination.
          When the insights band is hidden it takes over the band's mt-3 so
          the table keeps the same breathing room under the header. */}
      <div className={`border border-border rounded-xl bg-card flex flex-1 min-h-0 overflow-hidden ${showInsights && activeKpiKeys.length > 0 ? '' : 'mt-3'}`}>
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Search + Filters Bar. data-col-hide-edge: its top is the line a
          dragged column header crosses to hide (10/14/26). */}
      <div data-col-hide-edge className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              placeholder="Search invoices..."
              className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
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
              activeFiltersCount > 0
                ? 'text-primary border-primary/30'
                : 'text-foreground border-border/80'
            }`}
          >
            <SlidersHorizontal
              className={`w-3.5 h-3.5 ${
                activeFiltersCount > 0 ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
            <span className="text-sm" style={{ fontWeight: 500 }}>
              Filters
            </span>
            {activeFiltersCount > 0 && (
              <span
                className="ml-0.5 min-w-[18px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 600 }}
              >
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(() => {
            // The total counts the population actually in view (copy audit):
            // an archived invoice leaves the active list, so "217 of 218"
            // (the archived one in the denominator but not the list) reads as
            // a lost record. The denominator follows the archived-visibility,
            // and when nothing is narrowing it collapses to a plain count.
            const showingArchived = approvalFilter.includes('Archived');
            const population = showingArchived ? invoices.length : invoices.filter((i) => !i.isArchived).length;
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
              // Partner behavior — Insights button shows the KPI band AND
              // opens the Customize Widgets drawer (it does NOT just toggle
              // the band visibility).
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

      {/* Bulk Action Bar — replaces the pill row when rows are selected (PRD §1.6) */}
      {selectedInvoices.length > 0 ? (
        <BulkActionBar
          count={selectedInvoices.length}
          noun="invoice"
          actions={(() => {
            const selectedObjs = invoices.filter((inv) => selectedInvoices.includes(inv.id));
            // No bulk addPayment (Nophil 9/28): bulk paying is a payment
            // run; the row-level Add Payment action remains.
            const BULK_ICONS: Record<string, typeof CheckCheck> = {
              approve: CheckCheck,
              reject: Ban,
              export: Download,
              print: Printer,
              releaseHold: RotateCcw,
              resolve: CheckCircle2,
              resubmit: RotateCcw,
              archive: Archive,
            };
            return getBulkActions(selectedObjs).map<BulkAction>((entry) => ({
              key: entry.id,
              label: entry.label,
              icon: BULK_ICONS[entry.id],
              count: entry.eligibleCount,
              tone:
                entry.id === 'cancel' || entry.id === 'reject' || entry.id === 'archive'
                  ? 'destructive'
                  : entry.id === 'approve' || entry.id === 'submit' || entry.id === 'releaseHold' || entry.id === 'resolve'
                    ? 'success'
                    : entry.id === 'paymentHold'
                      ? 'warning'
                      : entry.id === 'resubmit'
                        ? 'primary'
                        : 'neutral',
              onClick: () => handleBulkAction(entry.id as BulkActionType),
            }));
          })()}
          onClear={() => setSelectedInvoices([])}
        />
      ) : null}

      {/* Status Filter Pills (partners-style row) — hidden when bulk bar is active */}
      <div
        className={`flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0 ${
          selectedInvoices.length > 0 ? 'hidden' : ''
        }`}
      >
        {/* Me mode chip removed entirely (user 10/5): the feature is
            off the table for now. */}

        {/* Two-axis status multi-select filters — replaces the status
            pill wall (Eli review 7/15/26; multi-select 7/15/26), joined
            by type, due-date and vendor quick filters (7/16/26). */}
        <MultiSelectFilter
          label="Invoice Status"
          options={APPROVAL_FILTER_OPTIONS.map((opt) => ({ id: opt, label: statusDisplayLabel(opt), count: approvalCounts[opt] ?? 0 }))}
          selected={approvalFilter}
          onChange={selectApprovalFilter}
        />
        <MultiSelectFilter
          label="Payment Status"
          options={PAYMENT_FILTER_OPTIONS.map((opt) => ({ id: opt, label: opt, count: paymentCounts[opt] ?? 0 }))}
          selected={paymentFilter}
          onChange={selectPaymentFilter}
        />
        {/* Priority order left to right (feedback 7/16/26): the two
            status axes, then who (vendor), then when (due date), then
            what (type), then the audit slicers. */}
        <MultiSelectFilter
          label="Vendor"
          searchable
          options={vendorQuickOptions.map((v) => ({ id: v, label: v, count: vendorQuickCounts[v] ?? 0 }))}
          selected={vendorQuickFilter}
          onChange={(next) => { setVendorQuickFilter(next); setFilters((f) => ({ ...f, vendors: next })); setCurrentPage(1); }}
        />
        <MultiSelectFilter
          label="Invoice Type"
          options={TYPE_QUICK_GROUPS.map((g) => ({ id: g.id, label: g.label, count: typeQuickCounts[g.id] ?? 0 }))}
          selected={typeQuickFilter}
          // Mirrors into the advanced filter (QC05) so both surfaces
          // always show the applied type.
          onChange={(next) => { setTypeQuickFilter(next); setFilters((f) => ({ ...f, types: typeGroupsToRaw(next) })); setCurrentPage(1); }}
        />
        <MultiSelectFilter
          label="Payment Terms"
          searchable
          options={paymentTermsQuickOptions.map((v) => ({ id: v, label: v, count: paymentTermsQuickCounts[v] ?? 0 }))}
          selected={paymentTermsQuickFilter}
          onChange={(next) => { setPaymentTermsQuickFilter(next); setCurrentPage(1); }}
        />
        {/* Toolbar diet (Eli 9/8, global Billy Bob standard): Due date,
            Discount available, Created By, A/P Account and Currency moved
            INTO the Filters modal — "you gotta get four of them gone." The
            due-date BUCKET rail (checkbox identity) rides along; its state
            still filters, now set from the modal. */}
        {/* On hold toggle (ERP-8796): the partner Archived pill's recipe,
            separator included, in the hold's yellow. One click filters to
            held invoices, a second click clears it. */}
        <div className="w-px h-5 bg-border shrink-0" />
        <button
          type="button"
          aria-pressed={holdOnly}
          onClick={() => { setHoldOnly((v) => !v); setCurrentPage(1); }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            holdOnly
              ? 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100/70 active:bg-yellow-100'
              : 'border-yellow-400 bg-white text-yellow-800 hover:bg-yellow-50 hover:border-yellow-500 active:bg-yellow-100'
          }`}
          style={{ fontWeight: holdOnly ? 500 : 400 }}
        >
          <Lock className="w-3 h-3" />
          On Hold
          <span
            className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${holdOnly ? 'bg-yellow-100 text-yellow-700' : 'bg-yellow-100 text-yellow-800'}`}
            style={{ fontWeight: 600 }}
          >
            {holdCount}
          </span>
        </button>
      </div>

      {/* Active per-column filter chips (Notion-style) */}
      <InvoiceActiveFiltersBar
        columnFilters={columnFilters}
        columnLabels={Object.fromEntries(INVOICE_COLUMN_CATALOG.map((c) => [c.key, c.label]))}
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

      {/* Filters modal — partner-style centered dialog (replaced the
          right-side drawer). Internal sections kept intact. */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent
          className="max-w-[560px] p-0 overflow-hidden border-0 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] bg-white flex flex-col max-h-[85vh]"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Filters</DialogTitle>
          <DialogDescription className="sr-only">
            Refine the invoice list by date range, invoice type, status, and creator.
          </DialogDescription>
          {/* Partner FiltersModal chrome (9/4/26): centered title, round
              close button on the left, Saved Views on the right opening
              the full list. Starred views render as quick chips below. */}
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
            {/* Saved Views hidden for now (user 9/28) — the button, the
                chips section and all their logic stay wired behind this
                flag, ready to switch back on. */}
            {SHOW_SAVED_VIEWS && (
              <Button
                variant="outline"
                size="sm"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 text-[12px]"
                onClick={() => setShowSavedViewsDialog(true)}
              >
                <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
                Saved Views
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* ── Starred views — quick-apply chips; the footer count
                previews the result live. Drift from every saved view
                surfaces "Save as view". Hidden for now (user 9/28). ── */}
            {SHOW_SAVED_VIEWS && (
              <SavedViewsSection
                views={savedViews}
                currentFilters={filters}
                hasActiveFilters={activeFiltersCount > 0}
                onApply={(view) => handleApplySavedView(view.filters)}
                onSaveCurrent={(name) => saveView(name, filters)}
              />
            )}
            {/* ── Type ── */}
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
                  onClick={() => { setFilters({ ...filters, types: [] }); setTypeQuickFilter([]); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                    filters.types.length === 0
                      ? 'border-primary bg-accent text-primary'
                      : 'border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  All
                </button>
                {TYPE_FILTER_OPTIONS.map((opt) => {
                  const selected = opt.values.some((v) => filters.types.includes(v));
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        const nextTypes = selected
                          ? filters.types.filter((t) => !opt.values.includes(t))
                          : [...filters.types, ...opt.values];
                        setFilters({ ...filters, types: nextTypes });
                        // The quick control mirrors the applied type (QC05).
                        setTypeQuickFilter(rawToTypeGroups(nextTypes));
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        selected
                          ? 'border-primary bg-accent text-primary'
                          : 'border-border bg-white text-foreground hover:bg-muted/50'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {opt.label}
                      <span
                        className="text-[10px] rounded-full px-1.5 py-px"
                        style={{
                          backgroundColor: selected ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                          color: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                          fontWeight: 600,
                        }}
                      >
                        {opt.values.reduce((s, v) => s + (typeFilterCounts[v] ?? 0), 0)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Status — the same two axes as the quick-filter pills
                (Eli two-axis model). The modal edits the SAME state, so
                quick filters and advanced filters never disagree. ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Invoice Status
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => selectApprovalFilter([])}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                    approvalFilter.length === 0
                      ? 'border-primary bg-accent text-primary'
                      : 'border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  All
                </button>
                {APPROVAL_FILTER_OPTIONS.map((status) => {
                  const selected = approvalFilter.includes(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        selectApprovalFilter(
                          selected ? approvalFilter.filter((s) => s !== status) : [...approvalFilter, status],
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        selected
                          ? 'border-primary bg-accent text-primary'
                          : 'border-border bg-white text-foreground hover:bg-muted/50'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {statusDisplayLabel(status)}
                      <span
                        className="text-[10px] rounded-full px-1.5 py-px"
                        style={{
                          backgroundColor: selected ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                          color: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                          fontWeight: 600,
                        }}
                      >
                        {approvalCounts[status] ?? 0}
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
                  onClick={() => selectPaymentFilter([])}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                    paymentFilter.length === 0
                      ? 'border-primary bg-accent text-primary'
                      : 'border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  All
                </button>
                {PAYMENT_FILTER_OPTIONS.map((status) => {
                  const selected = paymentFilter.includes(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        selectPaymentFilter(
                          selected ? paymentFilter.filter((s) => s !== status) : [...paymentFilter, status],
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        selected
                          ? 'border-primary bg-accent text-primary'
                          : 'border-border bg-white text-foreground hover:bg-muted/50'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {statusDisplayLabel(status)}
                      <span
                        className="text-[10px] rounded-full px-1.5 py-px"
                        style={{
                          backgroundColor: selected ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                          color: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                          fontWeight: 600,
                        }}
                      >
                        {paymentCounts[status] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Vendor — collapsed search that opens a dropdown with
                recently used vendors first (rev 7/16/26, Jira-style). ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Vendor
              </p>
              <SearchSelectPeople
                options={vendorOptions.map((v) => ({ id: v.name, name: v.name, count: v.count }))}
                selected={filters.vendors}
                onChange={(next) => { setFilters({ ...filters, vendors: next }); setVendorQuickFilter(next); }}
                placeholder="Search vendors..."
                emptyText="No vendors found."
                recentsKey="invoice-vendors"
              />
            </div>

            {/* ── Created by — same collapsed search-dropdown pattern. ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Created By
              </p>
              <SearchSelectPeople
                options={createdByOptions.map((u) => ({ id: u.name, name: u.name, count: u.count }))}
                selected={filters.createdBy}
                onChange={(next) => setFilters({ ...filters, createdBy: next })}
                placeholder="Search creators..."
                emptyText="No creators found."
                recentsKey="invoice-creators"
              />
            </div>

            {/* ── A/P Account — moved off the toolbar (Eli 9/8): edits the
                same quick-filter state, so nothing downstream changes. ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                A/P Account
              </p>
              {/* Plain ledger rows, no person avatar (Nophil 9/28: a GL
                  account rendered with initials read as a person). */}
              <SearchSelectPeople
                options={apAccountQuickOptions.map((a) => ({ id: a, name: a, count: apAccountQuickCounts[a] ?? 0 }))}
                selected={apAccountQuickFilter}
                onChange={(next) => { setApAccountQuickFilter(next); setCurrentPage(1); }}
                placeholder="Search A/P accounts..."
                emptyText="No accounts found."
                recentsKey="invoice-ap-accounts"
                variant="plain"
              />
            </div>

            {/* ── Currency — moved off the toolbar (Eli 9/8). ── */}
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
                {currencyQuickOptions.map((cur) => {
                  const selected = currencyQuickFilter.includes(cur);
                  return (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => {
                        setCurrencyQuickFilter(selected ? currencyQuickFilter.filter((c) => c !== cur) : [...currencyQuickFilter, cur]);
                        setCurrentPage(1);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        selected
                          ? 'border-primary bg-accent text-primary'
                          : 'border-border bg-white text-foreground hover:bg-muted/50'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {cur}
                      <span
                        className="text-[10px] rounded-full px-1.5 py-px"
                        style={{
                          backgroundColor: selected ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                          color: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                          fontWeight: 600,
                        }}
                      >
                        {currencyQuickCounts[cur] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Payment Hold — the toolbar's On hold toggle, same state
                (ERP-8796, AC3), independent of Invoice Status. ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Payment Hold
              </p>
              <button
                type="button"
                aria-pressed={holdOnly}
                onClick={() => { setHoldOnly((v) => !v); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                  holdOnly
                    ? 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100/70'
                    : 'border-yellow-400 bg-white text-yellow-800 hover:bg-yellow-50 hover:border-yellow-500'
                }`}
                style={{ fontWeight: 500 }}
              >
                <Lock className="w-3.5 h-3.5" />
                On Hold
                <span
                  className={`text-[10px] rounded-full px-1.5 py-px ${holdOnly ? 'bg-yellow-100 text-yellow-700' : 'bg-yellow-100 text-yellow-800'}`}
                  style={{ fontWeight: 600 }}
                >
                  {holdCount}
                </span>
              </button>
            </div>

            {/* ── Discounts — the toolbar's single toggle, relocated. ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Discounts
              </p>
              {/* Definition rides a real Tooltip, not the native title
                  (Nophil 9/28: the old hover copy was hard to parse). */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => { setDiscountOnly((v) => !v); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                  discountOnly
                    ? 'border-primary bg-accent text-primary'
                    : 'border-border bg-white text-foreground hover:bg-muted/50'
                }`}
                style={{ fontWeight: 500 }}
              >
                <BadgePercent className="w-3.5 h-3.5" />
                Discount Available
                <span
                  className="text-[10px] rounded-full px-1.5 py-px"
                  style={{
                    backgroundColor: discountOnly ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                    color: discountOnly ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    fontWeight: 600,
                  }}
                >
                  {discountQuickCount}
                </span>
              </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                  <p className="text-[11px] text-slate-600 leading-snug" style={{ fontWeight: 500 }}>
                    Approved, unpaid invoices still within their early payment discount period.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* ── Dates — invoice date and due date each get their OWN row
                (side by side was confusing, feedback 7/16/26). ── */}
            <div>
              {/* Named for what it actually filters (Nophil 9/28). */}
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Posting Date
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                    From
                  </Label>
                  <DatePicker
                    value={filters.dateFrom}
                    onChange={(v) => setFilters({ ...filters, dateFrom: v })}
                    placeholder="From"
                    className="h-9 border-border/80"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                    To
                  </Label>
                  <DatePicker
                    value={filters.dateTo}
                    onChange={(v) => setFilters({ ...filters, dateTo: v })}
                    placeholder="To"
                    align="end"
                    className="h-9 border-border/80"
                  />
                </div>
              </div>
            </div>

            <div>
              {/* The bucket dropdown is gone (user 10/4): the From/To
                  range pickers below are the one due-date control here. */}
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[13px]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  Due Date
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                    From
                  </Label>
                  <DatePicker
                    value={filters.dueFrom}
                    onChange={(v) => setFilters({ ...filters, dueFrom: v })}
                    placeholder="From"
                    className="h-9 border-border/80"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                    To
                  </Label>
                  <DatePicker
                    value={filters.dueTo}
                    onChange={(v) => setFilters({ ...filters, dueTo: v })}
                    placeholder="To"
                    align="end"
                    className="h-9 border-border/80"
                  />
                </div>
              </div>
            </div>

            {/* ── Amount range ── */}
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
                      value={formatMoneyText(filters.amountMin)}
                      onChange={(e) => setFilters({ ...filters, amountMin: e.target.value.replace(/[^\d.]/g, '') })}
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
                      value={formatMoneyText(filters.amountMax)}
                      onChange={(e) => setFilters({ ...filters, amountMax: e.target.value.replace(/[^\d.]/g, '') })}
                    />
                  </div>
                </div>
              </div>
              {/* Min above max matches nothing — warn instead of silently
                  returning an empty list (VI-48). */}
              {filters.amountMin !== '' && filters.amountMax !== '' && Number(filters.amountMin) > Number(filters.amountMax) && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-rose-600" style={{ fontWeight: 500 }}>
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  The minimum is above the maximum, so no invoice can match. Swap them to see results.
                </p>
              )}
            </div>
          </div>

          {/* Partner sticky footer: Clear all as an underline link, one
              primary CTA. Cancel is gone, X and outside click close. */}
          <div className="flex items-center justify-between px-5 h-14 border-t border-border/60 shrink-0">
            <button
              type="button"
              onClick={clearFilters}
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

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {densityMode === 'card' ? (
          // Slate canvas behind the cards (user 9/28, deepened 10/1): the
          // well was indistinguishable from the page background, so the
          // cards sat flat again. One step darker separates them without
          // touching the page bg.
          <div className="flex-1 overflow-auto p-4 bg-slate-100/70 flex flex-col">
            {cardStates.loadState === 'stale' && (
              <div className="-mx-4 -mt-4 mb-4">
                <TableStaleBanner entity={invoiceEmptyConfig.entity} lastUpdated={cardStates.tableLoad.lastUpdated} onRetry={cardStates.tableLoad.retry} retrying={cardStates.tableLoad.retrying} />
              </div>
            )}
            {cardStates.loadState === 'loading' ? (
              <CardSkeletonGrid />
            ) : cardStates.emptyProps ? (
              <div className="flex-1 flex flex-col justify-center">
                <TableEmptyState {...cardStates.emptyProps} />
              </div>
            ) : (
            <div
              className={`grid gap-3 ${
                cardSize === 'large'
                  ? 'grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2'
                  : cardSize === 'small'
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              }`}
            >
              {paginatedInvoices.map((invoice) => {
                const tcfg = TYPE_CONFIG[invoice.type as string] ?? TYPE_CONFIG.Standalone;
                const TIcon = tcfg.icon;
                return (
                <div
                  key={invoice.id}
                  // Type-tinted hover identity (user 9/28): the border takes
                  // the card's own type family — blue inventory, violet
                  // pre-invoice, teal standalone — so a sweep of the grid
                  // reads the type before the pill does. Resting cards carry
                  // a hairline shadow; hover lifts.
                  style={{ ['--card-accent' as string]: tcfg.border }}
                  className={`bg-white border border-border rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[var(--card-accent)] hover:shadow-[0_10px_28px_-10px_rgba(15,23,42,0.16)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group ${
                    cardSize === 'large' ? 'p-5' : cardSize === 'small' ? 'p-3' : 'p-4'
                  }`}
                  onClick={() => onViewInvoice(invoice.id)}
                >
                  {/* Card anatomy (user 9/25): type icon + Invoice ID lead,
                      type pill right — then description, the detail
                      header's status pills, and the partner two-column
                      grid. No repeated vendor lines. */}
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
                      {/* Label-only pill: the leading chip already carries
                          the type icon, and the icon-less pill keeps the
                          full Invoice ID visible on medium cards. */}
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
                          // Grey hover, not the ghost variant's blue accent
                          // (user 9/28): a utility affordance stays neutral.
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100 focus-visible:ring-slate-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-4 h-4 text-slate-400 group-hover:text-slate-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {/* View Details is always first; the rest are the
                            invoice's REAL per-status actions (VI-43), the
                            same set the table rows show, grouped by category
                            and dispatched through the shared handler. */}
                        <DropdownMenuItem onClick={() => onViewInvoice(invoice.id)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {getRowActionGroups(invoice.status, invoice).map((group, gi) => (
                          <Fragment key={gi}>
                            <DropdownMenuSeparator />
                            {group.map((action) => {
                              const Icon = ACTION_ICONS[action.id];
                              return (
                                <DropdownMenuItem
                                  key={action.id}
                                  onClick={(e) => dispatchRowAction(action.id, invoice.id, e as any)}
                                  className={action.destructive ? 'text-rose-600 focus:text-rose-600 focus:bg-rose-50' : undefined}
                                >
                                  {Icon && <Icon className="w-4 h-4 mr-2" />}
                                  {action.label}
                                </DropdownMenuItem>
                              );
                            })}
                          </Fragment>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                  {/* Description — the detail header's context line. */}
                  {cardSize !== 'small' && invoice.description && (
                    <p className="text-[11px] text-slate-500 truncate mb-2" title={invoice.description}>
                      {invoice.description}
                    </p>
                  )}
                  {/* Status pills — the detail header's two axes. */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {renderApprovalStatus(invoice.status, invoice)}
                    {renderPaymentStatus(invoice.status, invoice)}
                  </div>
                  {/* Partner two-column grid — label over value, the
                      sidebar GI recipe (user 9/25). */}
                  {/* Label/value typography = the data table's (user 10/1):
                      labels wear the column-header treatment (muted, weight
                      400), values wear the cell treatment (12px slate-700,
                      weight 400). No heavy bolds in the grid. */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-2.5 border-t border-slate-100">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Vendor</p>
                      {/* The table's own vendor cell (user 9/28): avatar
                          hover quick-card + click full modal, name click
                          opens the partner module. */}
                      <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
                        <VendorCell vendor={invoice.vendor} description={invoice.description} density="card" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Due Date</p>
                      {/* No pill on the card (user 9/28, superseding the
                          same-day pill ask): hovering the date shows how
                          long it has been due, while the invoice owes. */}
                      {(() => {
                        const owes =
                          invoice.outstandingBalance > 0.004 &&
                          !['Cancelled', 'Rejected', 'Settled', 'Paid in Full', 'Prepaid'].includes(invoice.status);
                        const dateEl = (
                          <p className={`text-[12px] text-slate-700 truncate mt-1 ${owes ? 'cursor-help' : ''}`} style={{ fontWeight: 400 }}>
                            {formatUsDate(invoice.dueDate)}
                          </p>
                        );
                        if (!owes) return dateEl;
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
                    {/* The vendor's own paper identity (user 9/28): their
                        invoice number and date are the load-bearing facts,
                        promoted into the grid; Created On is gone and
                        Created By moved to the footer. */}
                    {cardSize !== 'small' && (
                      <>
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Vendor Invoice No.</p>
                          <p className="text-[12px] text-slate-700 truncate mt-1" style={{ fontWeight: 400 }}>{invoice.vendorInvoiceNumber || '–'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Vendor Invoice Date</p>
                          <p className="text-[12px] text-slate-700 truncate mt-1" style={{ fontWeight: 400 }}>{formatUsDate(invoice.invoiceDate)}</p>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Footer — the money leads; Created By keeps the record's
                      provenance without its own grid row. */}
                  <div className="flex items-end justify-between gap-2 pt-2.5 mt-2.5 border-t border-slate-100">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Amount</p>
                      {/* The money still leads the card, but at weight 500
                          (user 10/1: the 700 read too dark against the
                          table's uniform 400 cells). */}
                      <p className={`${cardSize === 'small' ? 'text-[14px]' : 'text-[16px]'} text-foreground`} style={{ fontWeight: 500, lineHeight: 1.2 }}>
                        ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 min-w-0">
                      {invoice.outstandingBalance > 0.004 && invoice.outstandingBalance < invoice.amount - 0.004 && (
                        <p className="text-[11px] text-slate-500" style={{ fontWeight: 400 }}>
                          {`$${invoice.outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} due
                        </p>
                      )}
                      {/* The table's created-by cell on EVERY size (user
                          10/1: small cards were missing the provenance). */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <CreatedByCell name={invoice.createdBy} vendor={invoice.vendor} density="card" />
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <InvoiceDataTable
              key={`cols-${columnResetKey}`}
              invoices={paginatedInvoices}
              optionRows={invoices}
              searchRows={sortedFilteredInvoices}
              emptyConfig={invoiceEmptyConfig}
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
              density={((densityMode as string) === 'card' ? 'card' : densityMode) as any}
              searchQuery={searchQuery}
              currentPage={currentPage}
              recordsPerPage={recordsPerPage}
              totalRows={sortedFilteredInvoices.length}
              onPageChange={setCurrentPage}
              onRecordsPerPageChange={handleRecordsPerPageChange}
              onRowClick={(invoice) => onViewInvoice(invoice.id)}
              onRowAction={dispatchRowAction}
            />
          </div>
        )}
      </div>

      {/* Pagination is rendered by <InvoiceDataTable> itself, so no duplicate
          footer here. The legacy AdvancedInvoiceTable path still depends on
          the helper functions above (goToNextPage / goToPreviousPage / etc.). */}
        </div>
        <ColumnSelector
          columns={INVOICE_COLUMN_CATALOG}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          onColumnOrderChange={updateColumnOrder}
          onColumnVisibilityChange={updateColumnVisibility}
          lockedColumns={LOCKED_INVOICE_COLUMNS}
          frozenColumns={frozenColumns}
          onFreezeColumn={handleFreezeColumn}
          open={columnDrawerOpen}
          onOpenChange={setColumnDrawerOpen}
          defaultColumnOrder={INVOICE_COLUMN_CATALOG.map((c) => c.key)}
          defaultColumnVisibility={Object.fromEntries(INVOICE_COLUMN_CATALOG.map((c) => [c.key, c.key !== 'triggerDate' && c.key !== 'postingDate']))}
          onReset={() => setColumnResetKey((k) => k + 1)}
        />
      </div>
      </div>

      {/* Modals */}
      <BulkActionDialog
        open={showBulkActionDialog}
        onOpenChange={setShowBulkActionDialog}
        actionType={bulkActionType as any}
        selectedCount={selectedInvoices.length}
        onConfirm={handleBulkActionConfirm}
      />
      <SavedViewsDialog
        open={showSavedViewsDialog}
        onOpenChange={setShowSavedViewsDialog}
        currentFilters={filters}
        onApplyView={handleApplySavedView}
        views={savedViews}
        onSaveView={(name) => saveView(name, filters)}
        onDeleteView={deleteView}
        onToggleStar={toggleStar}
      />
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        recordCount={selectedInvoices.length > 0 ? selectedInvoices.length : sortedFilteredInvoices.length}
        recordType="invoice"
        fileBaseName="vendor-invoices"
        columns={[
          { key: 'invoiceNumber', label: 'Invoice ID' },
          { key: 'type', label: 'Invoice Type' },
          { key: 'vendor', label: 'Vendor' },
          { key: 'vendorInvoiceNumber', label: 'Vendor Invoice No.' },
          { key: 'invoiceDate', label: 'Invoice Date' },
          { key: 'dueDate', label: 'Due Date' },
          { key: 'status', label: 'Status' },
          { key: 'amount', label: 'Amount' },
          { key: 'outstandingBalance', label: 'Amount Due' },
          { key: 'currency', label: 'Currency' },
          { key: 'apAccount', label: 'A/P Account' },
          { key: 'paymentTerms', label: 'Payment Terms' },
          { key: 'createdBy', label: 'Created By' },
          { key: 'createdDate', label: 'Created On' },
        ]}
        rows={(selectedInvoices.length > 0
          ? sortedFilteredInvoices.filter((inv) => selectedInvoices.includes(inv.id))
          : sortedFilteredInvoices
        ).map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          type: invoiceTypeLabel(inv.type),
          vendor: inv.vendor,
          vendorInvoiceNumber: inv.vendorInvoiceNumber,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          status: inv.status,
          amount: inv.amount,
          outstandingBalance: inv.outstandingBalance,
          currency: inv.currency,
          apAccount: inv.apAccount,
          paymentTerms: paymentTermsFor(inv),
          createdBy: inv.createdBy,
          createdDate: inv.createdDate,
        }))}
      />
      <InvoiceInsightsPanel
        open={insightsPanelOpen}
        onOpenChange={setInsightsPanelOpen}
        activeKpis={activeKpiKeys}
        onToggleKpi={handleToggleKpi}
        // Catalog previews compute from the SELECTED period for flow KPIs
        // (GPT QC10, 9/30: the band said 93 for the last 30 days while the
        // catalog showed the all-time 218) and from the FULL dataset for
        // live-state KPIs (VI-33), matching exactly what each band card does.
        invoices={invoicesInRange}
        allInvoices={invoices}
      />
      <InvoiceReasonDialog
        open={reasonDialogOpen}
        onOpenChange={setReasonDialogOpen}
        action={reasonAction}
        count={reasonTargetIds.length}
        targets={invoices
          .filter((inv) => reasonTargetIds.includes(inv.id))
          .map((inv) => ({ invoiceNumber: inv.invoiceNumber, vendor: inv.vendor, amount: inv.amount, type: inv.type }))}
        // A single row gates reasons to its own kind and state, like the
        // detail page; bulk selections keep every reason.
        {...(() => {
          const one = reasonTargetIds.length === 1 ? invoices.find((inv) => inv.id === reasonTargetIds[0]) : undefined;
          return one ? { currentStatus: statusDisplayLabel(one.status, one.type), invoiceType: one.type } : {};
        })()}
        skipped={reasonSkippedCount > 0 ? reasonSkipped.invoiceNumbers.map((invoiceNumber) => ({ invoiceNumber })) : []}
        skipReason={reasonSkipped.reason}
        onConfirm={handleReasonConfirm}
      />
      <InvoiceRowActionModals
        singleApprove={singleApprove}
        onCloseSingleApprove={() => setSingleApprove(null)}
        approveHoldInvoice={approveHoldInvoice}
        onCloseApproveHold={() => setApproveHoldInvoice(null)}
        onApprove={(inv, toastDescription) => {
          applyInvoiceAction?.([inv.id], 'approve', '');
          toast.success('Invoice approved', { description: toastDescription ?? `${inv.invoiceNumber} is now Approved.` });
        }}
        onReleaseHold={(inv) => {
          // The listing's Release Hold row action, run right after approval.
          applyInvoiceAction?.([inv.id], 'releaseHold', '');
          toast.success('Hold released, invoice ready for payment.');
        }}
        reverseInvoice={reverseInvoiceId ? invoices.find((i) => i.id === reverseInvoiceId) ?? null : null}
        onCloseReverse={() => setReverseInvoiceId(null)}
        invoices={invoices}
        payments={payments}
        onReversePayment={onReversePayment}
      />
      {/* Bulk approve confirmation (design review 7/9/26; modal design
          language 10/9/26): gradient hero, the invoice list leads the body
          (IDs open in a new tab), skipped rows in an amber note, stacked
          full-width CTAs pinned at the bottom. */}
      <Dialog open={!!approveConfirm} onOpenChange={(o) => { if (!o) setApproveConfirm(null); }}>
        <DialogContent
          className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[460px] flex flex-col max-h-[calc(100dvh-2rem)]"
          style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
          showCloseButton={false}
        >
          {approveConfirm && (() => {
            const n = approveConfirm.eligible.length;
            const solid = '#059669';
            const tint = '#ECFDF5';
            return (
              <>
                <div
                  className="relative flex flex-col items-center pt-4 pb-2 shrink-0"
                  style={{ background: `linear-gradient(180deg, ${tint} 0%, color-mix(in srgb, ${tint} 30%, transparent) 70%, transparent 100%)` }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: solid, filter: 'blur(50px)' }} />
                  <div className="relative w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                    <CheckCheck className="w-5 h-5" style={{ color: solid, strokeWidth: 2 }} />
                  </div>
                  <span className="mt-2 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: tint, color: solid }}>
                    Approve
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-6 shrink-0">
                  <DialogTitle className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                    Approve {n} invoice{n === 1 ? '' : 's'}?
                  </DialogTitle>
                  <DialogDescription className="text-[13px] mt-1 mx-auto text-muted-foreground" style={{ lineHeight: 1.45, maxWidth: '380px' }}>
                    They post to the general ledger once approved.
                  </DialogDescription>
                </div>
                <div className="px-6 sm:px-8 pt-3 space-y-2.5 text-left flex-1 min-h-0 overflow-y-auto">
                  <BulkInvoiceList items={approveConfirm.eligible.map((inv) => ({ invoiceNumber: inv.invoiceNumber, vendor: inv.vendor, amount: inv.amount }))} />
                  {approveConfirm.skipped.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5">
                      <p className="text-[12px] text-amber-800" style={{ fontWeight: 500 }}>
                        {approveConfirm.skipped.length} selected invoice{approveConfirm.skipped.length === 1 ? '' : 's'} will be skipped
                      </p>
                      <p className="text-[11px] text-amber-700/90 mt-0.5 leading-snug">
                        Only Pending Approval invoices can be approved:{' '}
                        {approveConfirm.skipped.slice(0, 4).map((inv, i) => (
                          <span key={inv.id}>
                            {i > 0 && ', '}
                            <a
                              href={`/invoices/${encodeURIComponent(inv.invoiceNumber)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary hover:underline underline-offset-2 transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              {inv.invoiceNumber}
                            </a>
                          </span>
                        ))}
                        {approveConfirm.skipped.length > 4 ? `, +${approveConfirm.skipped.length - 4} more` : ''}.
                      </p>
                    </div>
                  )}
                </div>
                <div className="px-6 sm:px-8 pt-3 pb-5 flex flex-row-reverse gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      applyInvoiceAction?.(approveConfirm.eligible.map((i) => i.id), 'approve', '');
                      toast.success(`Approved ${n} invoice${n !== 1 ? 's' : ''}`,
                        approveConfirm.skipped.length > 0 ? { description: `Skipped ${approveConfirm.skipped.length} (ineligible).` } : undefined);
                      setApproveConfirm(null);
                      setSelectedInvoices([]);
                    }}
                    className="flex-1 h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                    style={{ fontWeight: 600, backgroundColor: solid, color: '#fff' }}
                  >
                    Approve {n} Invoice{n === 1 ? '' : 's'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setApproveConfirm(null)}
                    className="flex-1 h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-colors bg-[#F8FAFC] hover:bg-[#F1F5F9] text-slate-700"
                    style={{ fontWeight: 500 }}
                  >
                    Go Back
                  </button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
      {/* InvoiceQuickViewPanel side drawer removed per design feedback. */}
    </div>
  );
}

function TypeBadge({ type }: { type: Invoice['type'] }) {
  // Same flat per-type pill as the table's Type column (taxonomy rev
  // 7/9/26) so the card view stays consistent with the listing.
  const cfg = TYPE_CONFIG[type as string] ?? TYPE_CONFIG.Standalone;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs whitespace-nowrap ${cfg.dashed ? 'border border-dashed' : 'border'}`}
      style={{ fontWeight: cfg.dashed ? 600 : 500, backgroundColor: cfg.bg, color: cfg.fg, borderColor: cfg.border }}
    >
      <Icon className="w-3 h-3" style={{ color: cfg.fg }} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
    approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Approved' },
    paid: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Paid' },
    partial: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Partial' },
    void: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Void' },
  };
  const cfg = map[status as string] ?? {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    label: status,
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${cfg.bg} ${cfg.text}`}
      style={{ fontWeight: 500 }}
    >
      {cfg.label}
    </span>
  );
}

const DND_INVOICE_KPI = 'INVOICE_KPI_CARD';

interface DraggableKpiCardProps {
  index: number;
  kpiKey: string;
  label: string;
  value: string;
  sub?: string;
  delta?: KpiDelta;
  valueClass: string;
  iconName: string;
  iconColor: string;
  iconBg: string;
  tooltip?: string;
  /** Active range period label (e.g., "30 days") shown next to the
   *  delta so the comparison anchor is explicit — "+12% vs prior
   *  30 days" instead of just "+12%". */
  rangeLabel?: string;
  /** Optional fixed-pitch formula rendered inside the tooltip so
   *  users can see how the number is calculated. Mirrors the
   *  ATP hover pattern on quotes/sales orders. */
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
  iconColor,
  iconBg,
  tooltip,
  rangeLabel,
  formula,
  example,
  moveCard,
  onRemove,
}: DraggableKpiCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_INVOICE_KPI,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_INVOICE_KPI,
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
        {/* Top row: label + (i) on left, muted-gray icon on right (no tile) */}
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
                      <p className="text-[9px] text-slate-400" style={{ fontWeight: 600 }}>Example</p>
                      <p className="text-[11px] text-slate-600 leading-snug mt-0.5">{example}</p>
                    </div>
                  )}
                  {formula && (
                    <div className="border-t px-3 py-2" style={{ backgroundColor: '#EBF3FF', borderColor: '#D6E8FF' }}>
                      <p className="text-[10px] mb-1" style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>
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
          <InvoiceKpiIcon
            name={iconName}
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: palette.slate[400] }}
          />
        </div>

        {/* Headline row — value (black) on the left, delta (green/red) pinned right */}
        <div className="flex items-baseline gap-1 min-w-0">
          <p
            className="text-[15px] text-slate-700 tracking-tight truncate min-w-0"
            style={{ fontWeight: 600, lineHeight: 1.2 }}
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
                fontWeight: 600,
              }}
            >
              {delta.text}
            </span>
          )}
        </div>

        {/* Sub-text — money or descriptive caption, with the period
            anchor appended inline so we don't add another row. Empty
            range (all_time) skips the period clause. */}
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
        title={`Remove ${label}`}
        type="button"
      >
        <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-500" />
      </button>
    </div>
  );
}
