import { Fragment, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { formatUsDate, usDateTimeValue } from '@/app/lib/dueBucket';
import { useSearchParams } from 'react-router-dom';
import { InsightsResetButton } from '@/app/components/InsightsResetButton';
import { InsightsRefresh } from '@/app/components/InsightsRefresh';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Search,
  SlidersHorizontal,
  Plus,
  MoreHorizontal,
  X,
  Check,
  LayoutGrid,
  ListChecks,
  AlignJustify,
  Eye,
  EyeOff,
  Download,
  Ban,
  ArrowLeftRight,
  DollarSign,
  ChartColumn,
  CreditCard,
  Banknote,
  CircleDollarSign,
  Layers,
  Plus as PlusIcon,
  Info,
  GripVertical,
  Trash2,
  User,
  Printer,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { ViewDensityMenu } from '@/app/components/data-table/ViewDensityMenu';
import { MultiSelectFilter } from '@/app/components/data-table/MultiSelectFilter';
import { PeriodFilter } from '@/app/components/data-table/PeriodFilter';
import { Input } from '@/app/components/ui/input';
import { DatePicker } from '@/app/components/ui/date-picker';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { type Payment, paymentStatusAxis } from '@/app/data/mockPayments';
import type { Invoice } from '@/app/data/mockInvoices';
import {
  RecordPaymentFlow,
  type InvoiceAllocation,
  type RecordPaymentMode,
  type PrepaymentConsumption,
} from '@/app/components/payments/RecordPaymentFlow';
import { ReadyToPayTable } from '@/app/components/payments/ReadyToPayTable';
import { RunsTab } from '@/app/components/payments/run/RunsTab';
import type { PaymentRun } from '@/app/data/paymentRuns';
import { downloadRemittanceAdvice } from '@/app/lib/remittanceAdvice';
import { SavedViewsDialog, useSavedViews, type SavedView } from '@/app/components/SavedViewsDialog';
import type { ReleaseHoldResult } from '@/app/components/ReleaseHoldDialog';

// Seed views carry the COMPLETE payments filter shape so exact-match
// detection in the chip row works and applying one resets every facet.
const PAYMENT_SAVED_VIEW_SEEDS: SavedView[] = [
  {
    id: 'pv1',
    name: 'Scheduled Payments',
    starred: true,
    filters: { type: [], status: ['Scheduled'], methods: [], accounts: [], createdBy: [], vendors: [], currencies: [], amountMin: '', amountMax: '', period: 'all', periodCustom: { from: '', to: '' } },
  },
  {
    id: 'pv2',
    name: 'Prepayments',
    starred: true,
    filters: { type: ['Prepayment'], status: [], methods: [], accounts: [], createdBy: [], vendors: [], currencies: [], amountMin: '', amountMax: '', period: 'all', periodCustom: { from: '', to: '' } },
  },
  {
    id: 'pv3',
    name: 'Reversed & Cancelled',
    starred: false,
    filters: { type: [], status: ['Reversed', 'Cancelled'], methods: [], accounts: [], createdBy: [], vendors: [], currencies: [], amountMin: '', amountMax: '', period: 'all', periodCustom: { from: '', to: '' } },
  },
];
import { SearchSelectPeople } from '@/app/components/SearchSelectPeople';
import { ExportDialog } from '@/app/components/ExportDialog';
import { PaymentDataTable, PAYMENT_COLUMNS, paymentStatusLabel } from '@/app/components/PaymentDataTable';
import { useTableStates, type DataTableEmptyConfig } from '@/app/components/data-table/DataTable';
import { TableEmptyState, CardSkeletonGrid, TableStaleBanner } from '@/app/components/ui/table-empty-state';
import {
  PaymentInsightsPanel,
  ALL_PAYMENT_KPI_DEFINITIONS,
  PaymentKpiIcon,
  computePaymentKpi,
  filterPaymentsByRange,
  filterPaymentsByPreviousRange,
  type PaymentKpiDefinition,
  type KpiDelta,
  type InsightsRange,
} from '@/app/components/PaymentInsightsPanel';
import { InsightsRangeMenu, INSIGHTS_RANGE_OPTIONS } from '@/app/components/InsightsRangeMenu';
import { BaseCurrencyNote } from '@/app/components/currency/BaseCurrencyNote';
import { formatMoney } from '@/app/currency/money';
import { BulkActionBar, type BulkAction } from '@/app/components/BulkActionBar';
import { getBulkActions, isBulkEligible, type PaymentActionId } from '@/app/data/paymentActions';
import {
  PaymentReasonDialog,
  type PaymentReasonAction,
} from '@/app/components/PaymentReasonDialog';
import { InvoiceReasonDialog } from '@/app/components/InvoiceReasonDialog';
import { PAYMENT_REVERSE_OVERRIDE, paymentVoidOverride, voidEffectText } from '@/app/components/payments/paymentReasonConfigs';
import { ReversePaymentModal } from '@/app/components/invoice-details/ReversePaymentModal';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { ColumnSelector, ColumnSelectorTrigger } from '@/app/components/ColumnSelector';
import {
  applyColumnFilters,
  isFilterActive,
  rowMatchesColumns,
  type ColumnFilterState,
  type SortConfig,
} from '@/app/components/data-table';
import { InvoiceActiveFiltersBar } from '@/app/components/InvoiceActiveFiltersBar';
import { VendorAvatar as VendorAvatarInline } from '@/app/components/VendorAvatar';
import { toast } from 'sonner';
import { palette } from '@/styles/tokens';

// Catalog of every column that can appear in the payments table.
// Order here is the default order; ColumnSelector persists user changes.
const PAYMENT_COLUMN_CATALOG: { key: string; label: string }[] = [
  { key: 'paymentNumber', label: 'Payment ID' },
  { key: 'type', label: 'Type' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'reference', label: 'Reference' },
  { key: 'paymentMethod', label: 'Payment Method' },
  { key: 'checkPrint', label: 'Check Print' },
  { key: 'bankAccount', label: 'Pay-From Account' },
  { key: 'paymentDate', label: 'Payment Date' },
  { key: 'appliedTo', label: 'Applied To' },
  { key: 'amount', label: 'Amount' },
  { key: 'currency', label: 'Currency' },
  { key: 'status', label: 'Status' },
  { key: 'memo', label: 'Description' },
  { key: 'updatedBy', label: 'Last Updated By' },
  { key: 'updatedDate', label: 'Last Updated On' },
  { key: 'createdBy', label: 'Created By' },
  { key: 'createdDate', label: 'Created On' },
];

const LOCKED_PAYMENT_COLUMNS = ['paymentNumber']; // Payment ID is always pinned/visible

type DensityMode = 'condensed' | 'comfort' | 'card';

/* ── Filter taxonomy (Eli review 7/15/26) ─────────────────────────────
 * Orthogonal axes, each with its own dropdown, plus the history-slicing
 * filters that justify the module (account, method, period):
 *   - Type: Payment / Prepayment ("All" = filter off)
 *   - Status: Scheduled / Paid / Reversed / Cancelled (mutually
 *     exclusive; prepayments derive to Paid unless Cancelled — the
 *     money went out)
 * Refunded was retired as a status and the application-of-funds
 * dropdown was dropped from the quick row (design feedback 7/16/26);
 * application states remain reachable via the Filters modal. */
const PAYMENT_TYPE_OPTIONS = ['Payment', 'Prepayment'] as const;
// Payments: Scheduled / Paid / Reversed / Void. Prepayments carry their
// own three statuses (user 10/12): Unapplied / Partially applied / Fully
// applied — the same values the Status column shows.
const PAYMENT_STATUS_AXIS_OPTIONS = ['Scheduled', 'Paid', 'Reversed', 'Cancelled', 'Unapplied', 'Partially Applied', 'Fully Applied'] as const;
const PERIOD_OPTIONS: { id: string; label: string; days: number | null }[] = [
  { id: 'all', label: 'All Time', days: null },
  { id: '30d', label: 'Last 30 Days', days: 30 },
  { id: '90d', label: 'Last 90 Days', days: 90 },
  { id: '6m', label: 'Last 6 Months', days: 182 },
  { id: '12m', label: 'Last 12 Months', days: 365 },
];

// paymentStatusAxis lives in mockPayments.ts so detail pages share the
// same axis derivation. The history tab's filter reads a prepayment by
// its application status instead, matching its Status column.
const historyStatusOf = (p: Payment): string =>
  p.type === 'Prepayment' && p.status !== 'Cancelled'
    ? (p.status === 'Applied' || p.status === 'Paid' ? 'Fully Applied' : p.status)
    : paymentStatusAxis(p);

interface PaymentsScreenProps {
  payments: Payment[];
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
  invoices: Invoice[];
  /** Reduce invoice balances when a recorded payment settles them. */
  onSettleInvoices: (allocations: InvoiceAllocation[]) => void;
  /** Draw down on-account prepayment records consumed in a pay run. */
  onPrepayConsumption?: (consumption: PrepaymentConsumption[]) => void;
  onViewPayment: (payment: Payment) => void;
  /** Navigate to an invoice's detail page (used by the Ready to pay tab). */
  onViewInvoice: (invoiceId: string) => void;
  /** 'workspace' = the V2 listing with the Payments / Ready to pay tabs
   *  and the two-panel Record Payment shell. The V1 'classic' single
   *  listing was removed; 'workspace' is the only surface now. */
  variant?: 'classic' | 'workspace';
  /** Which ledger this listing serves. Drives the header icon (matches
   *  the Overview module card) and the AR copy direction. */
  module?: 'vendor' | 'customer';
  /** Payment runs (vendor module only): the third tab lists them, the
   *  Actions dropdown starts one, bulk-selected Ready-to-pay rows seed
   *  one. All state lives in usePaymentRuns at the App level. */
  runs?: PaymentRun[];
  onStartRun?: (seedInvoiceIds?: string[]) => void;
  onOpenRun?: (runId: string) => void;
  /** Lifecycle decisions from the runs listing row menu (8/4/26). */
  onApproveRun?: (runId: string) => void;
  onHoldRun?: (runId: string, reason: string) => void;
  onReleaseHold?: (runId: string, release: ReleaseHoldResult) => void;
  onCancelRun?: (runId: string, reason: string) => void;
  /** invoiceId → runId for invoices locked inside an open run. */
  lockedInvoiceIds?: Map<string, string>;
}

/** Segmented Any + options row for the advanced filters modal — the same
 *  pill recipe used across the module, driven by multi-select state. */
function FilterPillGroup({
  label,
  description,
  options,
  selected,
  onChange,
  counts,
  formatLabel,
}: {
  label: string;
  description?: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  counts?: Record<string, number>;
  formatLabel?: (o: string) => string;
}) {
  const pill = (active: boolean, neutral = false) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
      active
        ? 'border-primary bg-accent text-primary'
        : `border-border bg-white hover:bg-muted/50 ${neutral ? 'text-muted-foreground hover:text-foreground' : 'text-foreground'}`
    }`;
  return (
    <div>
      <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>{label}</p>
      {description && <p className="text-[11px] text-muted-foreground -mt-2 mb-2.5">{description}</p>}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange([])} className={pill(selected.length === 0, true)} style={{ fontWeight: 500 }}>
          Any
        </button>
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(on ? selected.filter((x) => x !== o) : [...selected, o])}
              className={pill(on)}
              style={{ fontWeight: 500 }}
            >
              {formatLabel ? formatLabel(o) : o}
              {counts && (
                <span
                  className="text-[10px] rounded-full px-1.5 py-px"
                  style={{
                    backgroundColor: on ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                    color: on ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    fontWeight: 600,
                  }}
                >
                  {counts[o] ?? 0}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PaymentsScreen({
  payments,
  setPayments,
  invoices,
  onSettleInvoices,
  onPrepayConsumption,
  onViewPayment,
  onViewInvoice,
  variant = 'workspace',
  module = 'vendor',
  runs,
  onStartRun,
  onOpenRun,
  onApproveRun,
  onHoldRun,
  onReleaseHold,
  onCancelRun,
  lockedInvoiceIds,
}: PaymentsScreenProps) {
  // Payment runs are an AP concept; the AR mirror never shows the tab.
  const runsEnabled = module === 'vendor' && !!runs && !!onStartRun && !!onOpenRun;
  // Record payment wizard (PRD §5–§8). The old Payment-vs-Prepayment type
  // picker was removed (7/22/26): the flow now opens vendor-first and its
  // Step 2 option boxes choose invoices / pre-invoices / standalone advance.
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowMode, setFlowMode] = useState<RecordPaymentMode>('pay');
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  // Invoice ids seeded into the pay flow from the Ready to pay tab — the flow
  // jumps straight to step 2 with these preselected. Empty for the normal
  // "Record a vendor payment" entry.
  const [paySelectionIds, setPaySelectionIds] = useState<string[]>([]);

  const applyPaymentAction = (
    ids: string[],
    action: 'void' | 'reverse',
    _reason: string
  ) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (!ids.includes(p.id)) return p;
        if (action === 'void' && p.status !== 'Cancelled') {
          return { ...p, status: 'Cancelled', appliedAmount: 0, unappliedAmount: 0 };
        }
        // Reverse: a completed payment whose funds were returned. It keeps its
        // applied history but the related invoices reopen.
        // Every status the bulk modal lists as reversible (user 10/22/26),
        // prepayments included; it used to flip Paid only.
        if (action === 'reverse' && isBulkEligible('reverse', p)) {
          return { ...p, status: 'Reversed' };
        }
        return p;
      })
    );
  };

  // Mark as paid — a scheduled payment completes: it flips to Paid, its
  // planned application posts, and the linked invoices settle NOW (this is
  // when Partially Paid / Paid in Full happens, not at scheduling, 7/16/26).
  const handleMarkPaid = (ids: string[]) => {
    const targets = payments.filter((p) => ids.includes(p.id) && p.status === 'Scheduled');
    if (targets.length === 0) return;
    setPayments((prev) =>
      prev.map((p) =>
        targets.some((t) => t.id === p.id)
          ? { ...p, status: 'Paid', appliedAmount: (p.appliedInvoices ?? []).reduce((s, a) => s + a.amount, 0) }
          : p,
      ),
    );
    const allocations = targets.flatMap((p) =>
      (p.appliedInvoices ?? []).flatMap((a) => {
        const inv = invoices.find((i) => i.invoiceNumber === a.invoiceNumber);
        return inv ? [{ invoiceId: inv.id, applied: a.amount }] : [];
      }),
    );
    if (allocations.length > 0) onSettleInvoices(allocations);
    toast.success(
      targets.length === 1 ? 'Payment marked as paid' : `${targets.length} payments marked as paid`,
      { description: 'Applied invoices settled and balances updated.' },
    );
  };

  // Filters persist across navigation (feedback 7/22/26): opening a
  // payment's detail and coming back must keep every filter, so the
  // whole set is saved to localStorage, keyed per module so vendor and
  // customer runs don't share state.
  const FILTERS_STORAGE_KEY = `omnesoft:payments-filters:${module}`;
  const persistedFilters = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Independent filter axes (Eli review 7/15/26): type and payment
  // status, plus the history slicers (account, method, period).
  // Multi-select — empty array = filter off; period is a single window
  // pick, with a custom calendar range (7/16/26).
  const [typeFilter, setTypeFilter] = useState<string[]>(persistedFilters.type ?? []);
  const [statusAxisFilter, setStatusAxisFilter] = useState<string[]>(persistedFilters.status ?? []);
  const [accountFilter, setAccountFilter] = useState<string[]>(persistedFilters.accounts ?? []);
  const [methodFilter, setMethodFilter] = useState<string[]>(persistedFilters.methods ?? []);
  const [createdByQuickFilter, setCreatedByQuickFilter] = useState<string[]>(persistedFilters.createdBy ?? []);
  const [periodFilter, setPeriodFilter] = useState<string>(persistedFilters.period ?? 'all');
  const [periodCustom, setPeriodCustom] = useState<{ from: string; to: string }>(persistedFilters.periodCustom ?? { from: '', to: '' });
  // "Unprinted checks" quick toggle — filters to Check payments with no
  // print trail (10/5 spec step 7 global surface).
  const [showUnprintedOnly, setShowUnprintedOnly] = useState(false);

  // Advanced-filter-only dimensions (feedback 7/22/26): the modal is a
  // superset of the quick-filter pills, so vendor / currency / amount
  // live here and drive the same filtered list.
  const [vendorFilter, setVendorFilter] = useState<string[]>(persistedFilters.vendors ?? []);
  const [currencyFilter, setCurrencyFilter] = useState<string[]>(persistedFilters.currencies ?? []);
  const [amountMin, setAmountMin] = useState<string>(persistedFilters.amountMin ?? '');
  const [amountMax, setAmountMax] = useState<string>(persistedFilters.amountMax ?? '');

  // ─── View iteration (V1 vs V2) ─────────────────────────────────────
  // V1 was pulled up to full logic parity with V2 (design feedback 7/9/26):
  // both variants get the Payment history · Invoices to pay tabs and the
  // Ready-to-pay flow. `variant` now only picks the Record Payment modal
  // shell (classic single-column vs workspace two-panel).
  // "Invoices to pay" is the action item, so it's the default landing tab;
  // Payment history is the secondary reference view (design review 7/9/26).
  // The active tab lives in the URL (?tab=history) so drilling into a detail
  // page and coming back restores the tab you left from (feedback 7/13/26).
  const [searchParams, setSearchParams] = useSearchParams();
  // Three workspace tabs: Invoices to pay (action), Payment history
  // (reference), and Payment runs (the batch flow, vendor module only).
  // Active tab lives in the URL.
  const tabParam = searchParams.get('tab');
  const workspaceTab: 'payments' | 'ready' | 'runs' =
    tabParam === 'history' ? 'payments' : tabParam === 'runs' && runsEnabled ? 'runs' : 'ready';
  const setWorkspaceTab = useCallback(
    (tab: 'payments' | 'ready' | 'runs') => {
      setSearchParams(tab === 'payments' ? { tab: 'history' } : tab === 'runs' ? { tab: 'runs' } : {}, { replace: true });
    },
    [setSearchParams],
  );
  // The "Invoices to pay" tab swaps the payments listing for the invoice table.
  const showPaymentsBody = workspaceTab === 'payments';

  const [searchQuery, setSearchQuery] = useState(persistedFilters.searchQuery ?? '');
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const DENSITY_STORAGE_KEY = 'omnesoft:payments:density';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [showSavedViewsDialog, setShowSavedViewsDialog] = useState(false);
  const { views: savedViews, saveView, deleteView, toggleStar } = useSavedViews(PAYMENT_SAVED_VIEW_SEEDS);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  // AP / AR are now separate nav entities (Vendor Payments vs Customer
  // Payments) rather than an in-page tab — see Layout's FINANCE_CHILDREN.
  // This screen is the Vendor (AP) ledger; the header tab below splits it
  // into Vendor Payments and Vendor Prepayments.
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);

  // Insights date range — drives the "Last N days" pill on the Performance
  // Insights header. Same pattern as the invoice listing.
  const INSIGHTS_RANGE_STORAGE_KEY = 'omnesoft:payments:insights-range';
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

  // Card view size — small / medium / large grids (partners parity)
  const CARD_SIZE_STORAGE_KEY = 'omnesoft:payments:card-size';
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>(() => {
    try {
      const v = localStorage.getItem(CARD_SIZE_STORAGE_KEY);
      if (v === 'small' || v === 'medium' || v === 'large') return v;
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

  // Reason dialog for Void / Unapply (mirrors invoices' PRD §1.7.4 pattern)
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  // Single-payment reverse opens the SAME Reverse Payment modal the
  // invoice detail page uses (feedback 7/21/26), not the reason dialog.
  const [reversePaymentId, setReversePaymentId] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<PaymentReasonAction | null>(null);
  const [reasonTargetIds, setReasonTargetIds] = useState<string[]>([]);
  // Selected payments a bulk action can't touch, named in the modal.
  const [reasonSkipped, setReasonSkipped] = useState<string[]>([]);

  // Column selector drawer. Order/visibility are session-only (rev
  // 7/16/26): a refresh always restores the catalog's default flow,
  // rearrangements never persist.
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => PAYMENT_COLUMN_CATALOG.map((c) => c.key));
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PAYMENT_COLUMN_CATALOG.map((c) => [c.key, true])),
  );
  // Column drawer Reset restores this default view and remounts the
  // table so dragged widths snap back too (10/9/26).
  const [columnResetKey, setColumnResetKey] = useState(0);
  const updateColumnOrder = (next: string[]) => setColumnOrder(next);
  const updateColumnVisibility = (next: Record<string, boolean>) => setColumnVisibility(next);
  const visibleColumnCount = PAYMENT_COLUMN_CATALOG.filter(
    (c) => columnVisibility[c.key] !== false
  ).length;

  // Per-column filter + sort state (driven by the DataTable's header menus)
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  // Payment history opens newest first (user 10/22/26): Created On,
  // descending. Header menus still re-sort or clear it.
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'createdDate', direction: 'desc' });
  const handleColumnSort = (columnKey: string, direction: 'asc' | 'desc' | null) => {
    if (direction === null) setSortConfig(null);
    else setSortConfig({ key: columnKey, direction });
    setCurrentPage(1);
  };
  const handleColumnFilterChange = (columnKey: string, filter: ColumnFilterState) => {
    setColumnFilters((prev) => {
      const next = { ...prev, [columnKey]: filter };
      // Prune cleared filters to keep the active list tight
      if (!isFilterActive(filter)) delete next[columnKey];
      return next;
    });
    setCurrentPage(1);
  };
  const handleHideColumnFromHeader = (columnKey: string) => {
    if (LOCKED_PAYMENT_COLUMNS.includes(columnKey)) return;
    updateColumnVisibility({ ...columnVisibility, [columnKey]: false });
  };
  // "Add filter" from the header menu — wires a blank filter for that column
  const handleAddColumnFilter = (columnKey: string) => {
    setColumnFilters((prev) => {
      if (prev[columnKey]) return prev;
      const fromCatalog = PAYMENT_COLUMNS.find((c) => c.key === columnKey);
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
  // Frozen columns — locked Payment ID is always frozen. Users can
  // additionally freeze others via the header menu's "Freeze" item.
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(
    () => new Set(LOCKED_PAYMENT_COLUMNS)
  );
  const handleFreezeColumn = (columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && !LOCKED_PAYMENT_COLUMNS.includes(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  };

  // Me mode removed entirely (user 10/5).

  // Default widgets: Scheduled, Prepayments outstanding, Cancelled,
  // Reversed, Total Paid, Largest payment, Smallest payment (Drafts
  // KPI removed with the draft state, Eli review 7/15/26).
  const DEFAULT_ACTIVE_KPIS = [
    'scheduled_pending',
    'prepayments_outstanding',
    'cancelled',
    'reversed',
    'total_paid',
    'largest_payment',
    'smallest_payment',
  ];
  // Bump the storage key so users pick up the new BA default set (old key
  // persisted the previous 5-widget layout).
  const KPI_STORAGE_KEY = 'omnesoft:payments:active-widgets-v2';

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

  const filteredPayments = payments.filter((payment) => {

    if (typeFilter.length > 0 && !typeFilter.includes(payment.type)) return false;
    if (statusAxisFilter.length > 0 && !statusAxisFilter.includes(historyStatusOf(payment))) return false;
    if (accountFilter.length > 0 && !accountFilter.includes(payment.bankAccount)) return false;
    if (methodFilter.length > 0 && !methodFilter.includes(payment.paymentMethod)) return false;
    if (createdByQuickFilter.length > 0 && !createdByQuickFilter.includes(payment.createdBy)) return false;
    if (vendorFilter.length > 0 && !vendorFilter.includes(payment.vendor)) return false;
    if (currencyFilter.length > 0 && !currencyFilter.includes(payment.currency)) return false;
    if (amountMin && payment.amount < parseFloat(amountMin)) return false;
    if (amountMax && payment.amount > parseFloat(amountMax)) return false;
    if (periodFilter === 'custom') {
      if (periodCustom.from && new Date(payment.createdDate) < new Date(periodCustom.from)) return false;
      if (periodCustom.to && new Date(payment.createdDate) > new Date(periodCustom.to)) return false;
    } else if (periodFilter !== 'all') {
      const days = PERIOD_OPTIONS.find((o) => o.id === periodFilter)?.days;
      if (days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        if (new Date(payment.createdDate) < cutoff) return false;
      }
    }

    if (showUnprintedOnly && !(payment.paymentMethod === 'Check' && !payment.checkPrint)) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !(
          payment.paymentNumber.toLowerCase().includes(query) ||
          payment.vendor.toLowerCase().includes(query) ||
          payment.reference.toLowerCase().includes(query) ||
          payment.memo.toLowerCase().includes(query) ||
          payment.type.toLowerCase().includes(query) ||
          payment.bankAccount.toLowerCase().includes(query) ||
          payment.appliedInvoices.some((inv) => inv.invoiceNumber.toLowerCase().includes(query)) ||
          // Every column, shown or hidden, by the text its cell prints.
          rowMatchesColumns(payment, PAYMENT_COLUMNS, searchQuery.trim())
        )
      )
        return false;
    }

    return true;
  });

  // Apply per-column filters from the column-header menu (generic evaluator
  // + the column catalog's getValue accessors)
  const columnFiltersList = Object.values(columnFilters);
  const COLUMN_BY_KEY: Record<string, (typeof PAYMENT_COLUMNS)[number]> = Object.fromEntries(
    PAYMENT_COLUMNS.map((c) => [c.key, c])
  );
  let processedPayments = applyColumnFilters(filteredPayments, columnFiltersList, (row, key) =>
    COLUMN_BY_KEY[key]?.getValue(row)
  );

  // Apply active sort
  if (sortConfig) {
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const key = sortConfig.key;
    // Created On sorts by the date AND time the column prints (user
    // 10/22/26), so same-day rows read newest first too.
    const sortValue = (p: Payment) =>
      key === 'createdDate' ? usDateTimeValue(p.createdDate, `${p.id}:crt`)?.getTime() : (p as any)[key];
    processedPayments = [...processedPayments].sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      if (av == null && bv == null) return 0;
      if (av == null) return -dir;
      if (bv == null) return dir;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }
  const sortedFilteredPayments = processedPayments;

  // The advanced modal and the quick-filter pills share ONE state, so
  // clearing / saving / restoring covers every dimension at once.
  const clearFilters = () => {
    setTypeFilter([]);
    setStatusAxisFilter([]);
    setMethodFilter([]);
    setAccountFilter([]);
    setCreatedByQuickFilter([]);
    setVendorFilter([]);
    setCurrencyFilter([]);
    setAmountMin('');
    setAmountMax('');
    setPeriodFilter('all');
    setPeriodCustom({ from: '', to: '' });
  };

  const currentFilters = {
    type: typeFilter,
    status: statusAxisFilter,
    methods: methodFilter,
    accounts: accountFilter,
    createdBy: createdByQuickFilter,
    vendors: vendorFilter,
    currencies: currencyFilter,
    amountMin,
    amountMax,
    period: periodFilter,
    periodCustom,
  };

  // Persist the whole filter set (plus search) so it survives leaving
  // for a detail page and returning (feedback 7/22/26).
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ ...currentFilters, searchQuery }));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    typeFilter, statusAxisFilter, methodFilter, accountFilter, createdByQuickFilter,
    vendorFilter, currencyFilter, amountMin, amountMax, periodFilter, periodCustom, searchQuery,
  ]);

  const handleApplySavedView = (v: any) => {
    setTypeFilter(v?.type ?? []);
    setStatusAxisFilter(v?.status ?? []);
    setMethodFilter(v?.methods ?? []);
    setAccountFilter(v?.accounts ?? []);
    setCreatedByQuickFilter(v?.createdBy ?? []);
    setVendorFilter(v?.vendors ?? []);
    setCurrencyFilter(v?.currencies ?? []);
    setAmountMin(v?.amountMin ?? '');
    setAmountMax(v?.amountMax ?? '');
    setPeriodFilter(v?.period ?? 'all');
    setPeriodCustom(v?.periodCustom ?? { from: '', to: '' });
  };

  // Only filters the toolbar can't show (user 10/26/26): Payment Status,
  // Type, Account, Method and Period are pills with their own active
  // state, so the Filters badge counts the modal-only facets.
  const activeFiltersCount =
    createdByQuickFilter.length +
    vendorFilter.length +
    currencyFilter.length +
    (amountMin || amountMax ? 1 : 0);

  // Per-axis counts shown inside the dropdown items, plus the dynamic
  // account/method option lists pulled from the data itself.
  const typeCounts: Record<string, number> = { all: payments.length };
  const statusAxisCounts: Record<string, number> = { all: payments.length };
  const accountCounts: Record<string, number> = {};
  const methodCounts: Record<string, number> = {};
  const createdByQuickCounts: Record<string, number> = {};
  const vendorCounts: Record<string, number> = {};
  const currencyCounts: Record<string, number> = {};
  payments.forEach((p) => {
    typeCounts[p.type] = (typeCounts[p.type] ?? 0) + 1;
    const axis = historyStatusOf(p);
    statusAxisCounts[axis] = (statusAxisCounts[axis] ?? 0) + 1;
    accountCounts[p.bankAccount] = (accountCounts[p.bankAccount] ?? 0) + 1;
    methodCounts[p.paymentMethod] = (methodCounts[p.paymentMethod] ?? 0) + 1;
    createdByQuickCounts[p.createdBy] = (createdByQuickCounts[p.createdBy] ?? 0) + 1;
    vendorCounts[p.vendor] = (vendorCounts[p.vendor] ?? 0) + 1;
    currencyCounts[p.currency] = (currencyCounts[p.currency] ?? 0) + 1;
  });
  const unprintedCheckCount = payments.filter((p) => p.paymentMethod === 'Check' && !p.checkPrint).length;

  const accountOptions = Object.keys(accountCounts).sort();
  const methodOptions = Object.keys(methodCounts).sort();
  const createdByQuickOptions = Object.keys(createdByQuickCounts).sort();
  const vendorOptions = Object.keys(vendorCounts).sort();
  const currencyOptions = Object.keys(currencyCounts).sort();

  const toggleSelectPayment = (id: string) => {
    if (selectedPayments.includes(id)) {
      setSelectedPayments(selectedPayments.filter((pmtId) => pmtId !== id));
    } else {
      setSelectedPayments([...selectedPayments, id]);
    }
  };

  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedPayments = sortedFilteredPayments.slice(startIndex, endIndex);
  // Table Empty & Error States Standard (11/3/26): every non-search filter
  // counts, pills and column filters included.
  const paymentEmptyConfig: DataTableEmptyConfig = {
    entity: { singular: 'payment', plural: 'payments' },
    totalCount: payments.length,
    filterCount:
      typeFilter.length +
      statusAxisFilter.length +
      accountFilter.length +
      methodFilter.length +
      createdByQuickFilter.length +
      vendorFilter.length +
      currencyFilter.length +
      (amountMin || amountMax ? 1 : 0) +
      (periodFilter !== 'all' ? 1 : 0) +
      (showUnprintedOnly ? 1 : 0) +
      Object.keys(columnFilters).length,
    onClearSearch: () => { setSearchQuery(''); setCurrentPage(1); },
    onClearFilters: () => { clearFilters(); setShowUnprintedOnly(false); setColumnFilters({}); setCurrentPage(1); },
    onSearch: (q) => { setSearchQuery(q); setCurrentPage(1); },
    onCreate: () => openRecordPayment(),
    createLabel: 'Record a Vendor Payment',
  };
  const paymentCardStates = useTableStates({
    config: paymentEmptyConfig,
    pageRows: paginatedPayments,
    totalRows: sortedFilteredPayments.length,
    searchQuery,
    suggestionRows: payments,
    columns: PAYMENT_COLUMNS,
    onFirstPage: () => setCurrentPage(1),
  });

  const handleRecordsPerPageChange = (value: number) => {
    setRecordsPerPage(value);
    setCurrentPage(1);
  };

  // Entry: the "Record a vendor payment" button opens the vendor-first flow
  // directly (Select vendor → choose what to pay → record). This is the blank
  // entry, so clear any Ready-to-pay preselection first.
  const openRecordPayment = () => {
    setPaySelectionIds([]);
    setFlowMode('pay');
    setFlowOpen(true);
  };
  // Ready to pay → "Record payment" seeds the pay flow with the chosen
  // invoices and jumps straight to step 2 (preselected, full balance each).
  const handleRecordForInvoices = (invoiceIds: string[]) => {
    setPaySelectionIds(invoiceIds);
    setFlowMode('pay');
    setFlowOpen(true);
  };
  // Ready to pay → "Start a payment run": mint a Draft run with the
  // selected invoices pre-ticked and land on its P1 setup stage.
  const handleStartPaymentRun = (invoiceIds: string[]) => {
    onStartRun?.(invoiceIds);
  };

  // Live Ready-to-pay selection (Jennifer 9/1/26): what's ticked on the
  // listing carries into a run started from the page-header CTA too —
  // her instinct was "check things off, then start the run", and the
  // header button used to open the flow empty and make her re-select.
  const [readySelection, setReadySelection] = useState<string[]>([]);
  const startRunFromHeader = () => {
    const free = readySelection.filter((id) => !lockedInvoiceIds?.has(id));
    const held = readySelection.length - free.length;
    if (held > 0) {
      toast.info(`${held} invoice${held === 1 ? '' : 's'} already in an open run`, {
        description: 'They stay with their run; everything else seeds this one.',
      });
    }
    onStartRun?.(free.length > 0 ? free : undefined);
  };

  // Wizard completion — add the records, settle the invoices (posted
  // payments only), flash the new row, and deep-link a single record.
  const handleFlowComplete = (
    records: Payment[],
    allocations: InvoiceAllocation[],
    asDraft: boolean,
    prepayConsumption?: PrepaymentConsumption[]
  ) => {
    setPayments((prev) => [...records, ...prev]);
    if (!asDraft && allocations.length > 0) onSettleInvoices(allocations);
    if (!asDraft && prepayConsumption && prepayConsumption.length > 0) onPrepayConsumption?.(prepayConsumption);
    setNewlyCreatedId(records[0]?.id ?? null);
    // Drafts close the wizard immediately; recorded payments stay on the
    // flow's "Payment recorded" success step (the flow closes itself on Done).
    if (asDraft) setFlowOpen(false);
    const noun = records[0]?.type === 'Prepayment' ? 'prepayment' : 'payment';
    const first = records[0];
    const vendorCount = new Set(records.map((r) => r.vendor)).size;
    const recordedDetail = records.length === 1 && first
      ? `${first.paymentNumber} · $${first.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} for ${first.vendor}.`
      : `${records.length} records created across ${vendorCount} vendor${vendorCount === 1 ? '' : 's'}.`;
    toast.success(
      asDraft
        ? `Saved ${records.length} draft${records.length === 1 ? '' : 's'}`
        : `Recorded ${records.length} ${noun}${records.length === 1 ? '' : 's'}`,
      { description: asDraft ? 'No GL impact until it posts.' : recordedDetail }
    );
  };

  const handleViewPayment = (paymentId: string) => {
    const payment = payments.find((p) => p.id === paymentId);
    if (payment) onViewPayment(payment);
  };

  const handleDownload = (paymentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return;
    // Prepayments carry no applied invoices, so an advance line stands
    // in for the invoice rows (feedback 7/21/26).
    downloadRemittanceAdvice(payment, payment.appliedInvoices.length === 0
      ? { lines: [{ invoiceNumber: payment.linkedPO ? `Advance on PO ${payment.linkedPO}` : 'On-account advance', paid: payment.amount }] }
      : undefined);
    toast.success('Remittance advice downloaded', {
      description: `${payment.paymentNumber}, saved as PDF.`,
    });
  };

  const handleBulkAction = (actionId: PaymentActionId) => {
    if (selectedPayments.length === 0) {
      toast.error('No payments selected', {
        description: 'Please select at least one payment to perform this action.',
      });
      return;
    }
    if (actionId === 'download') {
      setShowExportDialog(true);
      return;
    }
    // Void / Reverse requires a reason
    if (actionId === 'void' || actionId === 'reverse') {
      // A single-payment reverse goes through the SAME Reverse Payment
      // modal as the row menu and the invoice detail page (feedback
      // 7/21/26); only a multi-payment reverse keeps the reason dialog.
      if (actionId === 'reverse' && selectedPayments.length === 1) {
        setReversePaymentId(selectedPayments[0]);
        return;
      }
      // The vendor invoicing bulk modal (user 10/22/26): only the payments
      // the action applies to go in; the rest are named as skipped.
      const chosen = payments.filter((p) => selectedPayments.includes(p.id));
      const eligible = chosen.filter((p) => isBulkEligible(actionId, p));
      setReasonAction(actionId);
      setReasonTargetIds(eligible.map((p) => p.id));
      setReasonSkipped(chosen.filter((p) => !isBulkEligible(actionId, p)).map((p) => p.paymentNumber));
      setReasonDialogOpen(true);
      return;
    }
    if (actionId === 'applyPrepayment') {
      setSelectedPayments([]);
      toast.info('Assign prepayment', {
        description: 'Applying prepayment credits against invoices is coming in a later phase.',
      });
      return;
    }
    if (actionId === 'markPaid') {
      handleMarkPaid([...selectedPayments]);
      setSelectedPayments([]);
      return;
    }
  };

  // Shared by the bulk reason dialog AND the single-payment Reverse
  // modal (feedback 7/21/26): applies the action.
  const performPaymentAction = (ids: string[], act: 'void' | 'reverse', reason: string) => {
    const before = payments;
    applyPaymentAction(ids, act, reason);
    const targetSize = ids.length;
    const plural = targetSize !== 1 ? 's' : '';
    // No undo (10/29): a plain confirmation toast, the action stands.
    toast.success(
      act === 'reverse'
        ? `Marked ${targetSize} payment${plural} reversed`
        : `Voided ${targetSize} payment${plural}`,
      {
        description: act === 'reverse'
          ? 'The related invoices reopen as unpaid.'
          : voidEffectText(before.filter((p) => ids.includes(p.id))),
      },
    );
  };

  const handleReasonConfirm = (reason: string) => {
    if (!reasonAction || reasonTargetIds.length === 0) return;
    performPaymentAction(reasonTargetIds, reasonAction === 'reverse' ? 'reverse' : 'void', reason);
    setReasonDialogOpen(false);
    setReasonAction(null);
    setReasonTargetIds([]);
    setSelectedPayments([]);
  };

  // Tone hints by KPI key — kept here so the panel stays generic
  const KPI_TONE: Record<string, string> = {
    total_paid: 'text-emerald-600',
    scheduled_pending: 'text-blue-700',
    drafts: 'text-slate-700',
    prepayments_outstanding: 'text-amber-600',
    cancelled: 'text-rose-600',
    top_vendor: 'text-amber-600',
  };

  const KPI_DEF_BY_KEY: Record<string, PaymentKpiDefinition> = Object.fromEntries(
    ALL_PAYMENT_KPI_DEFINITIONS.map((d) => [d.key, d])
  );

  // Range-filtered slice that drives all KPI computations. Previous-period
  // slice powers the period-over-period delta chip on each card.
  const paymentsInRange = filterPaymentsByRange(payments, insightsRange, insightsRange === 'custom' ? insightsCustom : undefined);
  const paymentsPreviousRange = filterPaymentsByPreviousRange(payments, insightsRange);

  const activeKpiCards = activeKpiKeys
    .map((key) => KPI_DEF_BY_KEY[key])
    .filter(Boolean)
    .map((def) => {
      const computed = computePaymentKpi(def.key, paymentsInRange, paymentsPreviousRange);
      return {
        key: def.key,
        label: def.label,
        value: computed.value,
        sub: computed.sub,
        delta: undefined, // percentages removed per design feedback 7/9
        valueClass: KPI_TONE[def.key] ?? 'text-slate-700',
        iconName: def.iconName,
        iconBg: def.iconBg,
        iconColor: def.iconColor,
        tooltip: def.tooltip,
      };
    });

  // Listing tabs for V2 — the canonical segmented control used across the
  // system (Partner detail sub-tabs): a bg-muted track with the active tab as
  // a white chip (double shadow, no border) and a per-tab accent color. Lives
  // in the PAGE HEADER (under the title), so the tabs read as the primary view
  // switcher rather than a table control.
  // Header view tabs (V2) — underline style, matching the combined-invoicing /
  // Cash Management header tab pattern: active tab = primary-blue text + a 2px
  // blue underline flush on the header's bottom border; inactive = muted grey.
  const workspaceTabStrip = (
    <div className="flex items-center gap-6 mt-3 -mb-3.5 shrink-0">
      {([
        { id: 'ready' as const, label: 'Invoices to Pay', icon: CircleDollarSign },
        { id: 'payments' as const, label: 'Payment History', icon: CreditCard },
        ...(runsEnabled ? [{ id: 'runs' as const, label: 'Payment Runs', icon: ListChecks }] : []),
      ]).map((tab) => {
        const active = workspaceTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setWorkspaceTab(tab.id)}
            className="relative inline-flex items-center gap-1.5 pb-3 text-[13px] transition-colors cursor-pointer"
            style={{ fontWeight: active ? 600 : 500, color: active ? 'hsl(var(--primary))' : '#64748B' }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: active ? 'hsl(var(--primary))' : '#94A3B8' }} />
            {tab.label}
            {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-t-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Listing gutter — 12px on all sides (matches the header→table gap);
          the full-bleed header below cancels it with -mx-3/-mt-3. */}
      <div className="p-3 flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Page Header — generic Payments framing. In V2 the listing tabs
          (Payments / Ready to pay) sit above the table, not here. */}
      <div className="-mx-3 -mt-3 px-3 pt-3.5 pb-3.5 bg-white border-b border-border shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Heading icon matches each variant's Overview module card,
                icon AND colors (7/20/26): V1 CreditCard/emerald, V2
                Banknote/green, Customer Payments CreditCard/purple. */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor:
                  module === 'customer'
                    ? palette.purple[50]
                    : variant === 'workspace'
                      ? palette.green[50]
                      : palette.emerald[50],
              }}
            >
              {module === 'customer'
                ? <CreditCard className="w-4 h-4" style={{ color: palette.purple[700] }} />
                : variant === 'workspace'
                  ? <Banknote className="w-4 h-4" style={{ color: palette.green[700] }} />
                  : <CreditCard className="w-4 h-4" style={{ color: 'hsl(var(--success))' }} />}
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-[20px] truncate">Vendor Payments</h1>
              <p className="text-xs text-muted-foreground">
                {module === 'customer'
                  ? 'Collect customer invoice payments, record partial receipts, or log a prepayment received to apply later.'
                  : 'Pay vendor invoices, make partial payments, or record a prepayment to apply later.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Start payment run — plain white CTA (dropdown retired 7/30/26). */}
            {runsEnabled && (
              <button
                onClick={startRunFromHeader}
                className="h-9 px-3.5 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm text-[13px]"
                style={{ fontWeight: 500 }}
              >
                <ListChecks className="w-4 h-4 text-slate-500" />
                Start Payment Run
                {/* Ticked rows ride along (Jennifer 9/1/26): the count
                    shows the header CTA picks the selection up. */}
                {readySelection.length > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-blue-50 text-primary text-[11px] " style={{ fontWeight: 600 }}>
                    {readySelection.length}
                  </span>
                )}
              </button>
            )}
            {/* Record payment — opens the Payment / Prepayment type picker. */}
            <Button
              size="sm"
              onClick={openRecordPayment}
              className="h-9 shrink-0 rounded-lg shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Record a Vendor Payment
            </Button>
          </div>
        </div>

        {/* V2 view tabs (Payments / Ready to pay) live in the header. */}
        {workspaceTabStrip}
      </div>

      {/* Ready to pay tab — reuses the invoice listing table. The view
          tabs now live in the page header (both variants since 7/9/26). */}
      {workspaceTab === 'ready' && (
        <div className="mt-3 flex flex-1 min-h-0 flex-col">
          <ReadyToPayTable
            invoices={invoices}
            onViewInvoice={onViewInvoice}
            onRecordPayment={handleRecordForInvoices}
            onStartPaymentRun={runsEnabled ? handleStartPaymentRun : undefined}
            onLiveSelectionChange={runsEnabled ? setReadySelection : undefined}
            lockedInvoiceIds={lockedInvoiceIds}
            scheduledInvoiceNumbers={new Set(
              payments.flatMap((p) => (p.status === 'Scheduled' ? (p.appliedInvoices ?? []).map((a) => a.invoiceNumber) : [])),
            )}
          />
        </div>
      )}

      {/* Payment runs tab — every run, resuming at its stage on click. */}
      {workspaceTab === 'runs' && runsEnabled && (
        <div className="mt-3 flex flex-1 min-h-0 flex-col">
          <RunsTab
            runs={runs!}
            payments={payments}
            onOpenRun={onOpenRun!}
            onStartRun={() => onStartRun!()}
            onApproveRun={(runId) => onApproveRun?.(runId)}
            onHoldRun={(runId, reason) => onHoldRun?.(runId, reason)}
            onReleaseHold={(runId, release) => onReleaseHold?.(runId, release)}
            onCancelRun={(runId, reason) => onCancelRun?.(runId, reason)}
          />
        </div>
      )}

      {/* Performance Insights + KPI cards — the whole band disappears when
          every widget is removed (partner behavior); the toolbar Insights
          button is the way back in. */}
      {showPaymentsBody && showInsights && activeKpiKeys.length > 0 && (
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
              {/* The cards' money is base currency (Currency & Exchange Rates). */}
              <BaseCurrencyNote what="payment" rateDay="its payment date" />
            </div>
            <div className="flex items-center gap-2">
              <InsightsResetButton dirty={insightsDirty} onReset={handleInsightsReset} />
              {/* One-click Hide (Eli 7/22/26): collapse the whole insights band
                  without opening Customize and toggling every widget off. The
                  toolbar "Insights" button re-opens it. */}
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
                  rangeLabel={insightsPeriodLabel}
                  moveCard={moveKpi}
                  onRemove={() => handleRemoveKpi(kpi.key)}
                />
              ))}
            </div>
          </DndProvider>
        </div>
      )}

      {/* Unified Table Container — wraps search, pills, table, pagination.
          Hidden when the workspace's "Ready to pay" tab is active. */}
      {showPaymentsBody && (
      <div className={`border border-border rounded-xl bg-card flex flex-1 min-h-0 overflow-hidden ${showInsights && activeKpiKeys.length > 0 ? '' : 'mt-3'}`}>
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Search + Filters Bar */}
      <div data-col-hide-edge className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              placeholder="Search by payment number, vendor, invoice number, or reference..."
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
          {/* The yellow "N checks to print" pill is gone (user 10/12): the
              Unprinted checks quick filter leading the filter row does the
              same job. */}
          <span
            className="text-sm mr-1 hidden sm:inline"
            style={{ fontWeight: 500 }}
          >
            <span className="text-foreground">{sortedFilteredPayments.length}</span>
            <span className="text-muted-foreground/60"> of </span>
            <span className="text-muted-foreground">{payments.length}</span>
            <span className="text-muted-foreground/70"> payments</span>
          </span>
          <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />
          <button
            onClick={() => {
              // Insights button shows the KPI band AND opens the Customize
              // Widgets drawer (it does NOT just toggle the band visibility).
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
          />
          <ColumnSelectorTrigger
            visibleCount={visibleColumnCount}
            active={columnDrawerOpen}
            onClick={() => setColumnDrawerOpen((o) => !o)}
            disabled={densityMode === 'card'}
          />
        </div>
      </div>

      {/* Bulk Action Bar — replaces the pill row when rows are selected */}
      {selectedPayments.length > 0 ? (
        <BulkActionBar
          count={selectedPayments.length}
          noun="payment"
          actions={(() => {
            const selectedObjs = payments.filter((p) => selectedPayments.includes(p.id));
            return getBulkActions(selectedObjs).map<BulkAction>((entry) => ({
              key: entry.id,
              label: entry.label,
              count: entry.eligibleCount,
              tone: ((): any => {
                const id = entry.id as string;
                if (id === 'void') return 'destructive';
                if (id === 'process' || id === 'markCleared' || id === 'markPaid') return 'success';
                if (id === 'unapply') return 'warning';
                if (id === 'applyToInvoice') return 'primary';
                return 'neutral';
              })(),
              onClick: () => handleBulkAction(entry.id),
            }));
          })()}
          onClear={() => setSelectedPayments([])}
        />
      ) : null}

      {/* Status Filter Pills (partners-style row) — hidden when bulk bar is active */}
      <div
        className={`flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0 ${
          selectedPayments.length > 0 ? 'hidden' : ''
        }`}
      >
        {/* Me mode chip removed entirely (user 10/5). */}

        {/* Unprinted checks quick filter LEADS the row (user 10/12), set
            apart by a divider: it's a work queue, not a slicer. Only shows
            when there are checks to print. */}
        {unprintedCheckCount > 0 && (
          <button
            type="button"
            onClick={() => { setShowUnprintedOnly((v) => !v); setCurrentPage(1); }}
            className={`h-7 inline-flex items-center gap-1 px-2.5 rounded-md border text-[12px] cursor-pointer shrink-0 transition-colors ${showUnprintedOnly ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-white border-border text-slate-600 hover:bg-slate-50'}`}
            style={{ fontWeight: 500 }}
          >
            <Printer className="w-3 h-3" />
            Unprinted Checks
            <span
              className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px]"
              style={{ fontWeight: 600, backgroundColor: showUnprintedOnly ? '#B45309' : '#94A3B8', color: 'white' }}
            >
              {unprintedCheckCount}
            </span>
          </button>
        )}
        {unprintedCheckCount > 0 && <div className="w-px h-5 bg-border shrink-0 mx-1" aria-hidden />}

        {/* Independent filter dropdowns — replaces the pill wall (Eli
            review 7/15/26): type and status are orthogonal axes; account,
            method and period are the history slicers this module exists
            for. Multi-select (7/15/26); period is a single window pick
            with a custom calendar range (7/16/26). */}
        {/* Priority order left to right (feedback 7/16/26): status first,
            then type, then the history slicers. */}
        {[
          { label: 'Payment Status', value: statusAxisFilter, set: setStatusAxisFilter, searchable: false, options: PAYMENT_STATUS_AXIS_OPTIONS.map((o) => ({ id: o, label: paymentStatusLabel(o), count: statusAxisCounts[o] ?? 0 })) },
          { label: 'Type', value: typeFilter, set: setTypeFilter, searchable: false, options: PAYMENT_TYPE_OPTIONS.map((o) => ({ id: o, label: `${o}s`, count: typeCounts[o] ?? 0 })) },
          { label: 'Account', value: accountFilter, set: setAccountFilter, searchable: true, options: accountOptions.map((o) => ({ id: o, label: o, count: accountCounts[o] ?? 0 })) },
          { label: 'Method', value: methodFilter, set: setMethodFilter, searchable: false, options: methodOptions.map((o) => ({ id: o, label: o, count: methodCounts[o] ?? 0 })) },
          // Currency & Exchange Rates: the payment currency, beside the other
          // history slicers; the Filters modal edits the same state.
          { label: 'Currency', value: currencyFilter, set: setCurrencyFilter, searchable: true, options: currencyOptions.map((o) => ({ id: o, label: o, count: currencyCounts[o] ?? 0 })) },
          // Created By left the toolbar (Eli 9/8, global Billy Bob
          // standard): "you could search it, there's a filter for it" —
          // its section in the Filters modal edits the same state.
        ].map((f) => (
          <MultiSelectFilter
            key={f.label}
            label={f.label}
            options={f.options}
            selected={f.value}
            searchable={f.searchable}
            onChange={(next) => { f.set(next); setCurrentPage(1); }}
          />
        ))}
        <PeriodFilter
          options={PERIOD_OPTIONS}
          value={periodFilter}
          onChange={(v) => { setPeriodFilter(v); setCurrentPage(1); }}
          customFrom={periodCustom.from}
          customTo={periodCustom.to}
          onCustomChange={(from, to) => { setPeriodCustom({ from, to }); setCurrentPage(1); }}
        />
      </div>

      {/* Active per-column filter chips (Notion-style) */}
      <InvoiceActiveFiltersBar
        columnFilters={columnFilters}
        columnLabels={Object.fromEntries(PAYMENT_COLUMN_CATALOG.map((c) => [c.key, c.label]))}
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

      {/* Filters modal — partner-style centered dialog */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent
          className="max-w-[560px] p-0 overflow-hidden border-0 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] bg-white flex flex-col max-h-[85vh]"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Filters</DialogTitle>
          <DialogDescription className="sr-only">
            Refine the payment list by type, status, method, account, vendor, currency, amount, creator, and date.
          </DialogDescription>
          {/* Partner FiltersModal chrome (9/4/26): centered title, round
              close button on the left. */}
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
            {/* Saved Views button and chips removed (user 10/22/26). */}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* ── Type ── */}
            <FilterPillGroup
              label="Type"
              options={[...PAYMENT_TYPE_OPTIONS]}
              selected={typeFilter}
              onChange={setTypeFilter}
              counts={typeCounts}
              formatLabel={(o) => `${o}s`}
            />

            {/* ── Payment status (cash axis) ── */}
            <FilterPillGroup
              label="Payment Status"
              description="Where the money is in its lifecycle."
              options={[...PAYMENT_STATUS_AXIS_OPTIONS]}
              selected={statusAxisFilter}
              onChange={setStatusAxisFilter}
              counts={statusAxisCounts}
              formatLabel={(o) => paymentStatusLabel(o)}
            />

            {/* ── Payment method ── */}
            <FilterPillGroup
              label="Payment Method"
              options={methodOptions}
              selected={methodFilter}
              onChange={setMethodFilter}
              counts={methodCounts}
            />

            {/* ── Currency (only when the data spans more than one) ── */}
            {currencyOptions.length > 1 && (
              <FilterPillGroup
                label="Currency"
                options={currencyOptions}
                selected={currencyFilter}
                onChange={setCurrencyFilter}
                counts={currencyCounts}
              />
            )}

            {/* ── Pay-from account (searchable) ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Pay-From Account</p>
              <SearchSelectPeople
                options={accountOptions.map((a) => ({ id: a, name: a, count: accountCounts[a] }))}
                selected={accountFilter}
                onChange={setAccountFilter}
                placeholder="Select account..."
                emptyText="No accounts found."
                recentsKey="pay-accounts"
                recentsOnlyWhenIdle
              />
            </div>

            {/* ── Vendor (searchable) ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Vendor</p>
              <SearchSelectPeople
                options={vendorOptions.map((v) => ({ id: v, name: v, count: vendorCounts[v] }))}
                selected={vendorFilter}
                onChange={setVendorFilter}
                placeholder="Select vendor..."
                emptyText="No vendors found."
                recentsKey="payment-vendors"
                recentsOnlyWhenIdle
              />
            </div>

            {/* ── Created by (searchable) ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Created By</p>
              <SearchSelectPeople
                options={createdByQuickOptions.map((c) => ({ id: c, name: c, count: createdByQuickCounts[c] }))}
                selected={createdByQuickFilter}
                onChange={setCreatedByQuickFilter}
                placeholder="Select creator..."
                emptyText="No creators found."
                recentsKey="payment-creators"
                recentsOnlyWhenIdle
              />
            </div>

            {/* ── Amount range ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Amount</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground/60">$</span>
                  <Input inputMode="decimal" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} placeholder="Min" className="pl-6 h-9 text-sm bg-white border-border/80" />
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground/60">$</span>
                  <Input inputMode="decimal" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} placeholder="Max" className="pl-6 h-9 text-sm bg-white border-border/80" />
                </div>
              </div>
            </div>

            {/* ── Created date ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Created Date</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>From</Label>
                  <DatePicker
                    value={periodFilter === 'custom' ? periodCustom.from : ''}
                    onChange={(v) => { setPeriodFilter('custom'); setPeriodCustom((p) => ({ ...p, from: v })); }}
                    placeholder="Select date"
                    className="h-9 border-border/80"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>To</Label>
                  <DatePicker
                    value={periodFilter === 'custom' ? periodCustom.to : ''}
                    onChange={(v) => { setPeriodFilter('custom'); setPeriodCustom((p) => ({ ...p, to: v })); }}
                    placeholder="Select date"
                    align="end"
                    className="h-9 border-border/80"
                  />
                </div>
              </div>
              {periodFilter !== 'all' && periodFilter !== 'custom' && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Currently showing {PERIOD_OPTIONS.find((o) => o.id === periodFilter)?.label}. Pick dates for a custom range.
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
              Show {sortedFilteredPayments.length} payment{sortedFilteredPayments.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {densityMode === 'card' ? (
          <div className="flex-1 overflow-auto p-4 flex flex-col">
            {paymentCardStates.loadState === 'stale' && (
              <div className="-mx-4 -mt-4 mb-4">
                <TableStaleBanner entity={paymentEmptyConfig.entity} lastUpdated={paymentCardStates.tableLoad.lastUpdated} onRetry={paymentCardStates.tableLoad.retry} retrying={paymentCardStates.tableLoad.retrying} />
              </div>
            )}
            {paymentCardStates.loadState === 'loading' ? (
              <CardSkeletonGrid />
            ) : paymentCardStates.emptyProps ? (
              <div className="flex-1 flex flex-col justify-center">
                <TableEmptyState {...paymentCardStates.emptyProps} />
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
              {paginatedPayments.map((payment) => (
                <div
                  key={payment.id}
                  className={`border rounded-xl hover:shadow-md transition-all cursor-pointer group ${
                    payment.type === 'Prepayment'
                      ? 'bg-violet-50/40 border-violet-200 border-l-[3px] border-l-violet-500 hover:border-violet-300'
                      : 'bg-white border-border hover:border-primary/20'
                  } ${cardSize === 'large' ? 'p-5' : cardSize === 'small' ? 'p-3' : 'p-4'}`}
                  onClick={() => handleViewPayment(payment.id)}
                >
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox
                        checked={selectedPayments.includes(payment.id)}
                        onCheckedChange={() => toggleSelectPayment(payment.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <VendorAvatarInline name={payment.vendor} size={cardSize === 'large' ? 'md' : 'sm'} />
                      <div className="min-w-0">
                        <div className="text-sm truncate flex items-center gap-1.5" style={{ fontWeight: 600 }}>
                          <span className="truncate">{payment.paymentNumber}</span>
                          {payment.runId && (
                            <span
                              className="inline-flex items-center gap-1 shrink-0 px-1.5 py-px rounded-full text-[10px] border border-indigo-100 bg-indigo-50 text-indigo-700"
                              style={{ fontWeight: 600 }}
                              title={payment.runLabel ?? 'Part of a payment run'}
                            >
                              <Layers className="w-2.5 h-2.5" /> Run
                            </span>
                          )}
                        </div>
                        {cardSize !== 'small' && (
                          <div className="text-[11px] text-muted-foreground truncate" title={payment.vendor}>
                            {payment.vendor}
                          </div>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {/* Canonical payment actions (feedback 7/22/26),
                            same set as the table row menu and the detail
                            page: View details, Mark as reversed, Void
                            payment, Download remittance advice. */}
                        <DropdownMenuItem onClick={() => handleViewPayment(payment.id)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleDownload(payment.id, e as any)}>
                          <Download className="w-4 h-4 mr-2" />
                          Download Remittance Advice
                        </DropdownMenuItem>
                        {['Paid', 'Unapplied', 'Partially Applied', 'Fully Applied'].includes(payment.status) && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setReversePaymentId(payment.id);
                            }}
                            className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                          >
                            <ArrowLeftRight className="w-4 h-4 mr-2" />
                            Mark as Reversed
                          </DropdownMenuItem>
                        )}
                        {!['Cancelled', 'Reversed'].includes(payment.status) && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setReasonAction('void');
                              setReasonTargetIds([payment.id]);
                              setReasonSkipped([]);
                              setReasonDialogOpen(true);
                            }}
                            className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            Void Payment
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-2 mb-3">
                    <MethodBadge method={payment.paymentMethod} />
                    <div className="text-sm truncate" style={{ fontWeight: 500 }}>
                      {payment.vendor}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatUsDate(payment.paymentDate)}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <span>{payment.reference}</span>
                    </div>
                    {/* Audit trail — same fields as the table's Created /
                        Last Updated columns so the card view stays
                        consistent (design review 7/9/26). */}
                    {cardSize !== 'small' && (
                      <div className="space-y-0.5 pt-1 text-[11px] text-muted-foreground/80">
                        <div className="flex items-center justify-between gap-2">
                          <span className="shrink-0 text-muted-foreground/50">Created</span>
                          <span className="truncate text-right">{payment.createdBy} · {formatUsDate(payment.createdDate)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="shrink-0 text-muted-foreground/50">Updated</span>
                          <span className="truncate text-right">{payment.updatedBy ?? payment.createdBy} · {payment.updatedDate ?? payment.createdDate}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="text-lg " style={{ fontWeight: 600 }}>
                      {formatMoney(payment.amount, payment.currency)}
                    </div>
                    <StatusBadge status={payment.status} />
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <PaymentDataTable
              emptyConfig={paymentEmptyConfig}
              key={`cols-${columnResetKey}`}
              payments={paginatedPayments}
              optionRows={payments}
              selectedIds={new Set(selectedPayments)}
              onSelectionChange={(next) => setSelectedPayments(Array.from(next))}
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
              density={(((densityMode as string) === 'card') ? 'card' : densityMode) as any}
              searchQuery={searchQuery}
              searchRows={sortedFilteredPayments}
              searchRevealAfter="paymentNumber"
              currentPage={currentPage}
              recordsPerPage={recordsPerPage}
              totalRows={sortedFilteredPayments.length}
              onPageChange={setCurrentPage}
              onRecordsPerPageChange={handleRecordsPerPageChange}
              newlyCreatedId={newlyCreatedId}
              onOpenInvoice={(invoiceNumber) => {
                const inv = invoices.find((i) => i.invoiceNumber === invoiceNumber);
                if (inv) onViewInvoice(inv.id);
                else toast.info('Invoice not found', { description: `${invoiceNumber} is not in the current invoice list.` });
              }}
              onRowClick={(payment) => handleViewPayment(payment.id)}
              onRowAction={(actionId, paymentId, e) => {
                e.stopPropagation();
                if (actionId === 'view') {
                  handleViewPayment(paymentId);
                  return;
                }
                if (actionId === 'download') {
                  handleDownload(paymentId, e);
                  return;
                }
                if (actionId === 'edit') {
                  toast.info('Edit draft', { description: 'Draft editing reopens the wizard, coming soon.' });
                  return;
                }
                if (actionId === 'applyPrepayment') {
                  toast.info('Assign prepayment', {
                    description: 'Applying prepayment credits against invoices is coming in a later phase.',
                  });
                  return;
                }
                if (actionId === 'markPaid') {
                  handleMarkPaid([paymentId]);
                  return;
                }
                if (actionId === 'reverse') {
                  setReversePaymentId(paymentId);
                  return;
                }
                if (actionId === 'void') {
                  setReasonAction(actionId);
                  setReasonTargetIds([paymentId]);
                  setReasonSkipped([]);
                  setReasonDialogOpen(true);
                  return;
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Pagination is rendered by <PaymentDataTable> itself. */}
        </div>
        <ColumnSelector
          columns={PAYMENT_COLUMN_CATALOG}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          onColumnOrderChange={updateColumnOrder}
          onColumnVisibilityChange={updateColumnVisibility}
          lockedColumns={LOCKED_PAYMENT_COLUMNS}
          frozenColumns={frozenColumns}
          onFreezeColumn={handleFreezeColumn}
          open={columnDrawerOpen}
          onOpenChange={setColumnDrawerOpen}
          defaultColumnOrder={PAYMENT_COLUMN_CATALOG.map((c) => c.key)}
          defaultColumnVisibility={Object.fromEntries(PAYMENT_COLUMN_CATALOG.map((c) => [c.key, true]))}
          onReset={() => setColumnResetKey((k) => k + 1)}
        />
      </div>
      )}
      </div>

      {/* Modals */}
      <SavedViewsDialog
        open={showSavedViewsDialog}
        onOpenChange={setShowSavedViewsDialog}
        currentFilters={currentFilters}
        onApplyView={handleApplySavedView}
        views={savedViews}
        onSaveView={(name) => saveView(name, currentFilters)}
        onDeleteView={deleteView}
        onToggleStar={toggleStar}
      />
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        recordCount={selectedPayments.length > 0 ? selectedPayments.length : sortedFilteredPayments.length}
        recordType="payment"
        fileBaseName="vendor-payments"
        columns={[
          { key: 'paymentNumber', label: 'Payment No.' },
          { key: 'type', label: 'Type' },
          { key: 'vendor', label: 'Vendor' },
          { key: 'paymentDate', label: 'Payment Date' },
          { key: 'paymentMethod', label: 'Method' },
          { key: 'bankAccount', label: 'Bank Account' },
          { key: 'reference', label: 'Reference' },
          { key: 'status', label: 'Status' },
          { key: 'amount', label: 'Amount' },
          { key: 'appliedAmount', label: 'Applied' },
          { key: 'unappliedAmount', label: 'Unapplied' },
          { key: 'createdBy', label: 'Created By' },
        ]}
        rows={(selectedPayments.length > 0
          ? sortedFilteredPayments.filter((p) => selectedPayments.includes(p.id))
          : sortedFilteredPayments
        ).map((p) => ({
          paymentNumber: p.paymentNumber,
          type: p.type,
          vendor: p.vendor,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          bankAccount: p.bankAccount,
          reference: p.reference,
          status: p.status,
          amount: p.amount,
          appliedAmount: p.appliedAmount,
          unappliedAmount: p.unappliedAmount,
          createdBy: p.createdBy,
        }))}
      />
      <PaymentInsightsPanel
        open={insightsPanelOpen}
        onOpenChange={setInsightsPanelOpen}
        activeKpis={activeKpiKeys}
        onToggleKpi={handleToggleKpi}
        payments={payments}
      />
      <PaymentReasonDialog
        open={reasonDialogOpen && reasonAction !== 'void' && reasonAction !== 'reverse'}
        onOpenChange={setReasonDialogOpen}
        action={reasonAction}
        count={reasonTargetIds.length}
        onConfirm={handleReasonConfirm}
      />
      {/* Void and bulk Mark as reversed confirm with the vendor invoicing
          reason dialog (user 10/22/26): void in the Cancel flavor, and a
          bulk run lists its payments like the invoice bulk modal. */}
      <InvoiceReasonDialog
        open={reasonDialogOpen && (reasonAction === 'void' || reasonAction === 'reverse')}
        onOpenChange={setReasonDialogOpen}
        action="cancel"
        count={reasonTargetIds.length}
        configOverride={reasonAction === 'reverse'
          ? PAYMENT_REVERSE_OVERRIDE
          // Scheduled payments never posted: no GL reversal (user 10/22/26).
          : paymentVoidOverride(payments.filter((p) => reasonTargetIds.includes(p.id)))}
        targets={payments
          .filter((p) => reasonTargetIds.includes(p.id))
          .map((p) => ({ invoiceNumber: p.paymentNumber, vendor: p.vendor, amount: p.amount }))}
        skipped={reasonSkipped.map((n) => ({ invoiceNumber: n }))}
        skipReason={reasonAction === 'reverse' ? 'Scheduled, void or reversed payments can’t be marked as reversed' : 'Void or reversed payments can’t be voided again'}
        onConfirm={(reason) => handleReasonConfirm(reason)}
      />

      {/* Single-payment reverse — the SAME modal as the invoice detail
          page (feedback 7/21/26), reframed vendor-first (9/4/26 Eli,
          BB-29): the picker offers ALL of this vendor's reversible
          payments with the invoked one pre-selected, and the balance
          preview follows whichever record is picked. */}
      {(() => {
        const rp = payments.find((p) => p.id === reversePaymentId);
        if (!rp) return null;
        const firstInvNo = rp.appliedInvoices[0]?.invoiceNumber;
        const inv = firstInvNo ? invoices.find((i) => i.invoiceNumber === firstInvNo) : undefined;
        // The vendor's reversible payments — money that actually moved
        // (scheduled records cancel, they don't reverse).
        const vendorPayments = payments.filter(
          (p) => p.vendor === rp.vendor && p.type === rp.type && !['Reversed', 'Cancelled', 'Scheduled'].includes(p.status),
        );
        const pool = vendorPayments.length > 0 ? vendorPayments : [rp];
        const contexts = Object.fromEntries(
          pool.map((p) => {
            const invNo = p.appliedInvoices[0]?.invoiceNumber;
            const pInv = invNo ? invoices.find((i) => i.invoiceNumber === invNo) : undefined;
            return [p.id, { invoiceNumber: invNo ?? p.paymentNumber, outstandingBalance: pInv?.outstandingBalance ?? 0, totalAmount: pInv?.amount ?? p.amount }];
          }),
        );
        return (
          <ReversePaymentModal
            open
            onOpenChange={(o) => { if (!o) setReversePaymentId(null); }}
            invoiceNumber={firstInvNo ?? rp.paymentNumber}
            vendorName={rp.vendor}
            outstandingBalance={inv?.outstandingBalance ?? 0}
            totalAmount={inv?.amount ?? rp.amount}
            currency={rp.currency || 'USD'}
            payments={pool.map((p) => ({
              id: p.id,
              reference: p.reference || p.paymentNumber,
              paymentNumber: p.paymentNumber,
              date: p.paymentDate,
              amount: p.amount,
              // Every invoice this payment applied to (BA 9/6) — the
              // against-card lists them all with live outstanding.
              appliedTo: (p.appliedInvoices ?? []).map((ai) => ({
                invoiceNumber: ai.invoiceNumber,
                applied: ai.amount,
                outstanding: invoices.find((i) => i.invoiceNumber === ai.invoiceNumber)?.outstandingBalance ?? 0,
              })),
            }))}
            initialPaymentId={rp.id}
            contexts={contexts}
            entity={rp.type === 'Prepayment' ? 'prepayment' : 'payment'}
            onSubmit={(payload) => {
              performPaymentAction([payload.paymentId], 'reverse', payload.reason);
              setReversePaymentId(null);
              setSelectedPayments((prev) => prev.filter((id) => id !== payload.paymentId));
            }}
          />
        );
      })()}

      {/* Record payment wizard — PRD §5–§8. Keyed by open+mode+selection so
          each launch remounts with fresh wizard state, the right mode, and any
          Ready-to-pay preselection seeded in. */}
      <RecordPaymentFlow
        key={`${flowMode}-${flowOpen}-${paySelectionIds.join(',')}`}
        open={flowOpen}
        initialMode={flowMode}
        invoices={invoices}
        payments={payments}
        runs={runs}
        paySelection={paySelectionIds.length > 0 ? { invoiceIds: paySelectionIds } : undefined}
        variant={variant}
        onClose={() => setFlowOpen(false)}
        onBack={() => setFlowOpen(false)}
        onComplete={handleFlowComplete}
        onViewPayment={onViewPayment}
      />

    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    'Bank Transfer': { bg: 'bg-sky-50', text: 'text-sky-700' },
    ACH: { bg: 'bg-blue-50', text: 'text-blue-700' },
    Check: { bg: 'bg-green-50', text: 'text-green-700' },
    Wire: { bg: 'bg-violet-50', text: 'text-violet-700' },
    Card: { bg: 'bg-pink-50', text: 'text-pink-700' },
  };
  const cfg = map[method] ?? { bg: 'bg-muted', text: 'text-muted-foreground' };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${cfg.bg} ${cfg.text} border border-current/10`}
      style={{ fontWeight: 500 }}
    >
      {method}
    </span>
  );
}

function StatusBadge({ status }: { status: Payment['status'] }) {
  const map: Record<string, { bg: string; text: string }> = {
    Draft: { bg: 'bg-slate-100', text: 'text-slate-600' },
    Scheduled: { bg: 'bg-blue-50', text: 'text-blue-700' },
    Paid: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    Cancelled: { bg: 'bg-rose-50', text: 'text-rose-700' },
    Unapplied: { bg: 'bg-amber-50', text: 'text-amber-700' },
    'Partially Applied': { bg: 'bg-orange-50', text: 'text-orange-700' },
    'Fully Applied': { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  };
  const cfg = map[status] ?? { bg: 'bg-muted', text: 'text-muted-foreground' };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${cfg.bg} ${cfg.text}`}
      style={{ fontWeight: 500 }}
    >
      {paymentStatusLabel(status)}
    </span>
  );
}

const DND_PAYMENT_KPI = 'PAYMENT_KPI_CARD';

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
  /** Active range period label (e.g., "30 days") shown next to the delta. */
  rangeLabel?: string;
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
  moveCard,
  onRemove,
}: DraggableKpiCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_PAYMENT_KPI,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_PAYMENT_KPI,
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
            {tooltip && (
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
                  className="max-w-[260px] text-[11px] leading-[1.5] z-[300]"
                >
                  <p className="text-slate-500">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <PaymentKpiIcon
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

        {/* Sub-text — money or descriptive caption, period anchor appended */}
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
