import { useTableStates, type DataTableEmptyConfig } from '@/app/components/data-table/DataTable';
import { TableEmptyState, CardSkeletonGrid, TableStaleBanner } from '@/app/components/ui/table-empty-state';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { formatMoneyText } from '@/app/components/payments/MoneyInput';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Search,
  X,
  Plus,
  Ban,
  ChartColumn,
  CheckCheck,
  FilePen,
  Lock,
  LockOpen,
  SlidersHorizontal,
  ListChecks,
  User,
  EyeOff,
  MoreHorizontal,
  Download,
  LayoutGrid,
} from 'lucide-react';
import { SavedViewsDialog, useSavedViews } from '@/app/components/SavedViewsDialog';
import { toast } from 'sonner';
import type { Payment } from '@/app/data/mockPayments';
import type { PaymentRun } from '@/app/data/paymentRuns';
import { liveLines, runLastUpdate } from '@/app/data/paymentRuns';
import { runTotal } from '@/app/lib/runMath';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { InvoiceReasonDialog } from '@/app/components/InvoiceReasonDialog';
import { ReleaseHoldDialog, type ReleaseHoldResult } from '@/app/components/ReleaseHoldDialog';
import { CreatedByCell } from '@/app/components/InvoiceDataTable';
import { ApproveRunModal } from './RunDecisionModals';
import { RUN_CANCEL_OVERRIDE, RUN_HOLD_OVERRIDE } from './runReasonConfigs';
import {
  DataTable,
  ColumnSelector,
  ColumnSelectorTrigger,
  OverflowTooltip,
  applyColumnFilters,
  isFilterActive,
  PersonAvatar,
  rowMatchesColumns,
  type ColumnDef,
  type ColumnFilterState,
  type SortConfig,
} from '@/app/components/data-table';
import { palette } from '@/styles/tokens';
import { MultiSelectFilter } from '@/app/components/data-table/MultiSelectFilter';
import {
  ViewDensityMenu,
  type DensityOption,
  type CardSize,
} from '@/app/components/data-table/ViewDensityMenu';
import { VendorCell, highlightText, highlightAmount } from '@/app/components/InvoiceDataTable';
import { InvoiceActiveFiltersBar } from '@/app/components/InvoiceActiveFiltersBar';
import { InsightsResetButton } from '@/app/components/InsightsResetButton';
import { InsightsRefresh } from '@/app/components/InsightsRefresh';
import { InsightsRangeMenu } from '@/app/components/InsightsRangeMenu';
import { DraggableKpiCard } from '@/app/components/DraggableKpiCard';
import type { InsightsRange } from '@/app/components/InvoiceInsightsPanel';
import {
  ALL_RUN_KPI_DEFINITIONS,
  computeRunKpi,
  filterRunsByRange,
  DEFAULT_RUN_KPI_KEYS,
} from '@/app/data/runKpis';
import { RunInsightsPanel } from './RunInsightsPanel';
import { RunStatusPill, money, humanDate, openInvoiceTab, runDisplayStatus, exportRunCsv, type RunDisplayStatus } from './runUi';
import { formatUsDateTime, usDateTimeValue } from '@/app/lib/dueBucket';
import { actionToneClass } from '@/app/lib/actionMenuTone';

/* ── Payment runs tab ────────────────────────────────────────────────
 * The third Vendor Payments tab, rebuilt on the shared listing shell
 * (7/29/26) so it reads exactly like Invoices to pay: insights band,
 * search, quick filters, column controls, and the paginated DataTable.
 * Pending rows are the work queue; Completed rows are the history that
 * also lives in Payment history through their posted payments. Clicking
 * a run resumes it at its current stage. */

// No Draft (feedback 8/5/26): runs have no draft state — one exists
// only inside the open authoring modal and discards on close. The
// statuses are the DISPLAY statuses: a recorded run reads Scheduled or
// Paid (its payments' own state), never Executed/Completed.
const STATUS_ORDER: RunDisplayStatus[] = [
  'Pending Approval',
  'Changes Requested',
  'Approved',
  'Scheduled',
  'Paid',
  'Cancelled',
];

const vendorCount = (run: PaymentRun) => new Set(liveLines(run).map((l) => l.vendor)).size;
const invoiceCount = (run: PaymentRun) => liveLines(run).length;
const vendorNames = (run: PaymentRun) => Array.from(new Set(liveLines(run).map((l) => l.vendor)));

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

// Partner listing pill colors (PaymentDataTable's applied-invoices recipe).
const INV_PILL_STYLE = { bg: palette.blue[100], fg: palette.blue[700] };


/** Partner "+N more" cell (DataTableStyleReference MoreBadge): the first
 *  value's cell, with the rest behind the hoverable blue badge +
 *  OverflowTooltip. */
function MoreCell({ first, others, category, items, onItemClick }: {
  first: ReactNode;
  others: number;
  category: string;
  items: { id: string; name: string; subtitle: string; initials?: string; avatarBg?: string; avatarFg?: string; nameHref?: string }[];
  onItemClick?: (item: { id: string; name: string }) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap min-w-0">
      {first}
      {others > 0 && (
        <OverflowTooltip category={category} items={items} onItemClick={onItemClick}>
          <span
            className="text-xs cursor-pointer transition-colors shrink-0 hover:underline"
            style={{ color: 'var(--color-blue-600)', fontWeight: 500 }}
          >
            +{others} more
          </span>
        </OverflowTooltip>
      )}
    </div>
  );
}

// Columns are built with the caller's display-status resolver (8/5/26):
// the Status column shows, sorts, and filters on what the run READS as
// (Paid/Scheduled once recorded), which needs the posted payments.
const buildRunColumns = (displayStatus: (r: PaymentRun) => RunDisplayStatus): ColumnDef<PaymentRun>[] => [
  {
    key: 'id',
    label: 'Payment Run ID',
    minWidth: 130,
    defaultWidth: 160,
    locked: true,
    sticky: 'left',
    sortable: true,
    filterable: false,
    getValue: (r) => r.id,
    // Searchable, so it highlights like every other matched cell (10/9/26).
    render: (r, { searchQuery }) => (
      <span className="text-foreground text-[13px]" style={{ fontWeight: 600 }}>{highlightText(r.id, searchQuery)}</span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    minWidth: 130,
    defaultWidth: 160,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => STATUS_ORDER.filter((s) => rows.some((r) => displayStatus(r) === s)),
    getValue: (r) => displayStatus(r),
    getSortValue: (r) => STATUS_ORDER.indexOf(displayStatus(r)),
    render: (r, { searchQuery }) => <RunStatusPill status={displayStatus(r)} searchQuery={searchQuery} />,
  },
  {
    key: 'paymentDate',
    label: 'Payment Date',
    minWidth: 110,
    defaultWidth: 130,
    sortable: true,
    filterType: 'date',
    getValue: (r) => r.paymentDate,
    searchText: (r) => formatUsDateTime(r.paymentDate, r.id),
    render: (r, { searchQuery }) => <span className="text-[13px] text-slate-600 whitespace-nowrap">{highlightText(formatUsDateTime(r.paymentDate, r.id), searchQuery)}</span>,
  },
  {
    key: 'vendors',
    label: 'Vendors',
    // Wide enough for the first vendor's full name before the "+N more"
    // badge (feedback 8/4/26).
    minWidth: 220,
    defaultWidth: 280,
    sortable: true,
    filterType: 'range',
    getValue: (r) => vendorCount(r),
    // The vendor names it lists (first in the cell, the rest in "+N more").
    searchText: (r) => vendorNames(r).join(' '),
    render: (r, { searchQuery }) => {
      const names = vendorNames(r);
      if (names.length === 0) return <span className="text-[13px] text-slate-400">·</span>;
      const lines = liveLines(r);
      return (
        <MoreCell
          // The invoicing listing's vendor cell verbatim: avatar with the
          // hover quick card + full card, name hover → primary underline.
          first={<VendorCell vendor={names[0]} density="condensed" searchQuery={searchQuery} />}
          others={names.length - 1}
          category="Vendors"
          items={names.slice(1).map((v) => {
            const vLines = lines.filter((l) => l.vendor === v);
            const total = vLines.reduce((s, l) => s + l.payAmount, 0);
            return {
              id: v,
              name: v,
              subtitle: `${vLines.length} invoice${vLines.length === 1 ? '' : 's'} · ${money(total)}`,
              initials: initialsOf(v),
            };
          })}
        />
      );
    },
  },
  {
    key: 'invoices',
    label: 'Invoices',
    minWidth: 150,
    defaultWidth: 190,
    sortable: true,
    filterType: 'range',
    getValue: (r) => invoiceCount(r),
    // The invoice IDs it lists (first in the cell, the rest in "+N more").
    searchText: (r) => liveLines(r).map((l) => l.invoiceNumber).join(' '),
    render: (r, { searchQuery }) => {
      const lines = liveLines(r);
      if (lines.length === 0) return <span className="text-[13px] text-slate-400">·</span>;
      return (
        <MoreCell
          // Black at rest, primary + underline on hover, and the detail
          // page opens in a new tab so the runs tab stays put.
          first={
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openInvoiceTab(lines[0].invoiceNumber);
              }}
              className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors cursor-pointer p-0 bg-transparent border-0 truncate min-w-0 text-left"
              style={{ fontWeight: 500 }}
            >
              {highlightText(lines[0].invoiceNumber, searchQuery)}
            </button>
          }
          others={lines.length - 1}
          category="Invoices"
          onItemClick={(item) => openInvoiceTab(item.name)}
          items={lines.slice(1).map((l) => ({
            id: l.invoiceId,
            name: l.invoiceNumber,
            subtitle: `${l.vendor} · ${money(l.payAmount)}`,
            initials: 'INV',
            avatarBg: INV_PILL_STYLE.bg,
            avatarFg: INV_PILL_STYLE.fg,
            nameHref: `/invoices/${encodeURIComponent(l.invoiceNumber)}`,
          }))}
        />
      );
    },
  },
  {
    key: 'total',
    label: 'Total',
    minWidth: 110,
    defaultWidth: 130,
    align: 'right',
    sortable: true,
    filterType: 'range',
    getValue: (r) => runTotal(r),
    searchText: (r) => money(runTotal(r)),
    render: (r, { searchQuery }) => (
      <span className="text-[13px] " style={{ fontWeight: 600 }}>{highlightAmount(money(runTotal(r)), searchQuery)}</span>
    ),
  },
  // Last Updated By / On (user 10/22/26), placed like Payment history:
  // just before Created By / On. The latest step or edit on the run.
  {
    key: 'updatedBy',
    label: 'Last Updated By',
    minWidth: 140,
    defaultWidth: 170,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => runLastUpdate(r).by))).sort(),
    getValue: (r) => runLastUpdate(r).by,
    render: (r, { searchQuery }) => (
      <CreatedByCell name={runLastUpdate(r).by} vendor={liveLines(r)[0]?.vendor ?? ''} density="condensed" searchQuery={searchQuery} />
    ),
  },
  {
    key: 'updatedAt',
    label: 'Last Updated On',
    minWidth: 110,
    defaultWidth: 150,
    sortable: true,
    filterType: 'date',
    getValue: (r) => runLastUpdate(r).at,
    getSortValue: (r) => usDateTimeValue(runLastUpdate(r).at, `${r.id}:upd`)?.getTime() ?? 0,
    searchText: (r) => formatUsDateTime(runLastUpdate(r).at, `${r.id}:upd`),
    render: (r, { searchQuery }) => (
      <span className="text-[13px] text-slate-600 whitespace-nowrap">
        {highlightText(formatUsDateTime(runLastUpdate(r).at, `${r.id}:upd`), searchQuery)}
      </span>
    ),
  },
  {
    key: 'createdBy',
    label: 'Created By',
    minWidth: 140,
    defaultWidth: 170,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => r.createdBy))).sort(),
    getValue: (r) => r.createdBy,
    // The system-wide person cell (8/7/26): round photo avatar, hover
    // quick card, click for the full contact modal.
    render: (r, { searchQuery }) => (
      <CreatedByCell name={r.createdBy} vendor={liveLines(r)[0]?.vendor ?? ''} density="condensed" searchQuery={searchQuery} />
    ),
  },
  {
    key: 'createdAt',
    label: 'Created On',
    minWidth: 110,
    defaultWidth: 130,
    sortable: true,
    filterType: 'date',
    getValue: (r) => r.createdAt,
    searchText: (r) => formatUsDateTime(r.createdAt, `${r.id}:crt`),
    render: (r, { searchQuery }) => <span className="text-[13px] text-slate-600 whitespace-nowrap">{highlightText(formatUsDateTime(r.createdAt, `${r.id}:crt`), searchQuery)}</span>,
  },
  {
    key: 'approvedBy',
    label: 'Approved By',
    minWidth: 140,
    defaultWidth: 170,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) =>
      Array.from(new Set(rows.map((r) => r.approvedBy).filter((v): v is string => !!v))).sort(),
    getValue: (r) => r.approvedBy ?? '',
    render: (r, { searchQuery }) =>
      r.approvedBy ? (
        <CreatedByCell name={r.approvedBy} vendor={liveLines(r)[0]?.vendor ?? ''} density="condensed" searchQuery={searchQuery} />
      ) : (
        <span className="text-[13px] text-slate-400">·</span>
      ),
  },
  {
    key: 'approvedAt',
    label: 'Approved On',
    minWidth: 110,
    defaultWidth: 130,
    sortable: true,
    filterType: 'date',
    getValue: (r) => r.approvedAt ?? '',
    searchText: (r) => formatUsDateTime(r.approvedAt, `${r.id}:apr`),
    render: (r, { searchQuery }) =>
      r.approvedAt ? (
        <span className="text-[13px] text-slate-600 whitespace-nowrap">{highlightText(formatUsDateTime(r.approvedAt, `${r.id}:apr`), searchQuery)}</span>
      ) : (
        <span className="text-[13px] text-slate-400">·</span>
      ),
  },
];

const RUN_COLUMN_CATALOG = buildRunColumns(() => 'Paid').map((c) => ({ key: c.key, label: c.label }));
const LOCKED_COLUMNS = ['id'];
// Every column ships visible (7/30/26): Created On and Approved On sit next
// to their By columns by default; the drawer can still hide them.
const DEFAULT_HIDDEN = new Set<string>();

export function RunsTab({
  runs,
  payments,
  onOpenRun,
  onStartRun,
  onApproveRun,
  onHoldRun,
  onReleaseHold,
  onCancelRun,
}: {
  runs: PaymentRun[];
  /** Posted payments, to read a recorded run's settled state. */
  payments: Payment[];
  onOpenRun: (runId: string) => void;
  onStartRun: () => void;
  /** Lifecycle decisions straight from the listing (8/4/26), behind the
   *  same heads-up modals the detail page uses. Request changes opens
   *  the run instead (8/5/26): the issue builder needs line context. */
  onApproveRun: (runId: string) => void;
  onHoldRun: (runId: string, reason: string) => void;
  /** Release confirms first (user 10/22/26) with the invoice release dialog. */
  onReleaseHold: (runId: string, release: ReleaseHoldResult) => void;
  onCancelRun: (runId: string, reason: string) => void;
}) {
  const displayStatus = useCallback((r: PaymentRun) => runDisplayStatus(r, payments), [payments]);
  const runColumns = useMemo(() => buildRunColumns(displayStatus), [displayStatus]);
  const runColumnValue = useCallback(
    (run: PaymentRun, key: string): unknown => runColumns.find((c) => c.key === key)?.getValue(run),
    [runColumns],
  );
  // Row-menu decision → heads-up modal, shared with the detail page.
  const [decision, setDecision] = useState<{ run: PaymentRun; kind: 'approve' | 'hold' | 'release' | 'cancel' } | null>(null);
  // Performance Insights date range (same control as the rest of the module).
  // The table always shows every run regardless of the range; the range only
  // scopes the KPI band (module pattern).
  const [insightsRange, setInsightsRange] = useState<InsightsRange>('last_30');
  const [insightsCustom, setInsightsCustom] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const rangedRuns = filterRunsByRange(
    runs,
    insightsRange,
    insightsRange === 'custom' ? insightsCustom : undefined,
  );

  // Customizable Performance Insights (Add insights drawer + drag/remove),
  // matching the other Vendor Payments tabs.
  const RUN_KPI_STORAGE_KEY = 'omnesoft:payment-runs:active-widgets-v1';
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);
  // One-click Hide (Eli 7/22/26): collapse the whole band without toggling
  // every widget off. The toolbar Insights button is the way back in.
  const [showInsights, setShowInsights] = useState(true);
  const [activeKpiKeys, setActiveKpiKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RUN_KPI_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as string[];
    } catch { /* ignore */ }
    return DEFAULT_RUN_KPI_KEYS;
  });
  const persistKpis = (next: string[]) => {
    try { localStorage.setItem(RUN_KPI_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
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
    setActiveKpiKeys(DEFAULT_RUN_KPI_KEYS);
    persistKpis(DEFAULT_RUN_KPI_KEYS);
    toast.info('Insights reset', { description: 'Restored the default widgets and order.' });
  };
  const insightsDirty = activeKpiKeys.join(',') !== DEFAULT_RUN_KPI_KEYS.join(',');
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
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  // No seeds here — the section stays hidden until the user stars a view.
  const { views: savedViews, saveView, deleteView, toggleStar } = useSavedViews([]);
  const applySavedFilters = (filters: any) => {
    setColumnFilters(filters ?? {});
    setCurrentPage(1);
  };

  // View density + card size — same persisted control as the other listing
  // tabs (Payment history, Invoices to pay).
  const DENSITY_STORAGE_KEY = 'omnesoft:payment-runs:density';
  const [densityMode, setDensityModeRaw] = useState<DensityOption>(() => {
    try {
      const v = localStorage.getItem(DENSITY_STORAGE_KEY);
      if (v === 'condensed' || v === 'comfort' || v === 'card') return v;
    } catch { /* ignore */ }
    return 'condensed';
  });
  const setDensityMode = (next: DensityOption) => {
    setDensityModeRaw(next);
    try { localStorage.setItem(DENSITY_STORAGE_KEY, next); } catch { /* ignore */ }
  };
  const CARD_SIZE_STORAGE_KEY = 'omnesoft:payment-runs:card-size';
  const [cardSize, setCardSizeRaw] = useState<CardSize>(() => {
    try {
      const v = localStorage.getItem(CARD_SIZE_STORAGE_KEY);
      if (v === 'small' || v === 'medium' || v === 'large') return v;
    } catch { /* ignore */ }
    return 'medium';
  });
  const setCardSize = (next: CardSize) => {
    setCardSizeRaw(next);
    try { localStorage.setItem(CARD_SIZE_STORAGE_KEY, next); } catch { /* ignore */ }
  };

  // Column order/visibility are session-only (listing pattern): a refresh
  // restores the catalog's default flow.
  const [columnOrder, setColumnOrder] = useState<string[]>(() => RUN_COLUMN_CATALOG.map((c) => c.key));
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(RUN_COLUMN_CATALOG.map((c) => [c.key, !DEFAULT_HIDDEN.has(c.key)])),
  );
  // Column drawer Reset restores this default view and remounts the
  // table so dragged widths snap back too (10/9/26).
  const [columnResetKey, setColumnResetKey] = useState(0);
  const visibleColumnCount = RUN_COLUMN_CATALOG.filter((c) => columnVisibility[c.key] !== false).length;

  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  // Newest first by default, matching the old runs table.
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'createdAt', direction: 'desc' });

  const handleColumnSort = (columnKey: string, direction: 'asc' | 'desc' | null) => {
    setSortConfig(direction === null ? null : { key: columnKey, direction });
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
  const handleAddColumnFilter = (columnKey: string) => {
    setColumnFilters((prev) => {
      if (prev[columnKey]) return prev;
      const type = runColumns.find((c) => c.key === columnKey)?.filterType ?? 'text';
      return {
        ...prev,
        [columnKey]: { columnKey, type, values: [], text: '', min: '', max: '', dateFrom: '', dateTo: '' },
      };
    });
  };
  const handleHideColumn = (columnKey: string) => {
    if (LOCKED_COLUMNS.includes(columnKey)) return;
    setColumnVisibility((prev) => ({ ...prev, [columnKey]: false }));
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

  // Quick-filter dropdowns: status first (the work queue slicer), then who
  // built and who approved. Me mode removed entirely (user 10/5).
  const [statusQuick, setStatusQuick] = useState<string[]>([]);
  const [createdByQuick, setCreatedByQuick] = useState<string[]>([]);
  const [approvedByQuick, setApprovedByQuick] = useState<string[]>([]);

  const statusQuickCounts: Record<string, number> = {};
  const createdByQuickCounts: Record<string, number> = {};
  const approvedByQuickCounts: Record<string, number> = {};
  runs.forEach((run) => {
    if (run.status === 'Draft') return;
    const shown = displayStatus(run);
    statusQuickCounts[shown] = (statusQuickCounts[shown] ?? 0) + 1;
    createdByQuickCounts[run.createdBy] = (createdByQuickCounts[run.createdBy] ?? 0) + 1;
    if (run.approvedBy) approvedByQuickCounts[run.approvedBy] = (approvedByQuickCounts[run.approvedBy] ?? 0) + 1;
  });
  const createdByQuickOptions = Object.keys(createdByQuickCounts).sort();
  const approvedByQuickOptions = Object.keys(approvedByQuickCounts).sort();

  // Search across the fields someone scans when hunting for a run: the run
  // id, who built or approved it, and the vendors it pays.
  const searched = runs.filter((run) => {
    // Drafts never list (8/5/26): one exists only while its authoring
    // modal is open, and closing that modal discards it.
    if (run.status === 'Draft') return false;
    if (statusQuick.length > 0 && !statusQuick.includes(displayStatus(run))) return false;
    if (createdByQuick.length > 0 && !createdByQuick.includes(run.createdBy)) return false;
    if (approvedByQuick.length > 0 && (!run.approvedBy || !approvedByQuick.includes(run.approvedBy))) return false;
    const trimmed = searchQuery.trim();
    if (!trimmed) return true;
    const q = trimmed.toLowerCase();
    return (
      run.id.toLowerCase().includes(q) ||
      run.createdBy.toLowerCase().includes(q) ||
      (run.approvedBy ?? '').toLowerCase().includes(q) ||
      liveLines(run).some((l) => l.vendor.toLowerCase().includes(q)) ||
      // Every column, shown or not, by what its cell prints (10/14/26).
      rowMatchesColumns(run, runColumns, trimmed)
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
      if (!isFilterActive(nextFilter)) delete next[columnKey];
      return next;
    });
    setCurrentPage(1);
  };
  const activeFilterCount = Object.keys(columnFilters).length;

  const columnFiltersList = Object.values(columnFilters);
  let processed = applyColumnFilters(searched, columnFiltersList, runColumnValue);
  if (sortConfig) {
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const col = runColumns.find((c) => c.key === sortConfig.key);
    processed = [...processed].sort((a, b) => {
      const av = col?.getSortValue ? col.getSortValue(a) : (runColumnValue(a, sortConfig.key) as string | number | undefined);
      const bv = col?.getSortValue ? col.getSortValue(b) : (runColumnValue(b, sortConfig.key) as string | number | undefined);
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

  // Table Empty & Error States Standard v1.0 (11/3/26). Drafts never list,
  // so they never count toward what exists.
  const emptyConfig: DataTableEmptyConfig = {
    entity: { singular: 'payment run', plural: 'payment runs' },
    totalCount: runs.filter((r) => r.status !== 'Draft').length,
    filterCount: statusQuick.length + createdByQuick.length + approvedByQuick.length + Object.keys(columnFilters).length,
    onClearSearch: () => { setSearchQuery(''); setCurrentPage(1); },
    onClearFilters: () => {
      setStatusQuick([]);
      setCreatedByQuick([]);
      setApprovedByQuick([]);
      setColumnFilters({});
      setCurrentPage(1);
    },
    onSearch: (q) => { setSearchQuery(q); setCurrentPage(1); },
  };
  const cardStates = useTableStates<PaymentRun>({
    config: emptyConfig,
    pageRows: paginated,
    totalRows: sortedFiltered.length,
    searchQuery,
    suggestionRows: runs,
    columns: runColumns,
    onFirstPage: () => setCurrentPage(1),
  });

  // Active KPI cards for the insights grid (customizable via the drawer).
  const activeKpiCards = activeKpiKeys
    .map((key) => {
      const def = ALL_RUN_KPI_DEFINITIONS.find((d) => d.key === key);
      if (!def) return null;
      const { value, sub } = computeRunKpi(key, rangedRuns);
      return { def, value, sub };
    })
    .filter((c): c is { def: (typeof ALL_RUN_KPI_DEFINITIONS)[number]; value: string; sub: string } => !!c);

  // Row menu — the invoice listing's category-segregated recipe
  // (feedback 8/5/26): forward decisions, then the hold control, then
  // output, destructive last, a separator between each group. No "Open"
  // item, the row click already opens the run. Tones come from the
  // shared actionMenuTone map (green approve, amber hold, red
  // destructive).
  const runMenuItems = (run: PaymentRun) => {
    // Hold pauses a live decision (pending/approved); cancel also covers
    // a Changes-requested run the creator abandons (8/5/26).
    const holdable = run.status === 'Pending Approval' || run.status === 'Approved';
    const cancellable = holdable || run.status === 'Changes Requested';
    const positive = actionToneClass('positive');
    const warning = actionToneClass('warning');
    const destructive = actionToneClass('destructive');
    const neutral = actionToneClass('neutral');
    return (
      <>
        {run.status === 'Pending Approval' && !run.hold && (
          <>
            {/* Approve stays a heads-up; Request changes opens the run,
                the issue builder needs the line context (8/5/26). */}
            <DropdownMenuItem className={`cursor-pointer ${positive.item}`} onClick={() => setDecision({ run, kind: 'approve' })}>
              <CheckCheck className={`w-4 h-4 mr-2 ${positive.icon}`} />
              Approve Payment Run
            </DropdownMenuItem>
            <DropdownMenuItem className={`cursor-pointer ${warning.item}`} onClick={() => onOpenRun(run.id)}>
              <FilePen className={`w-4 h-4 mr-2 ${warning.icon}`} />
              Request Changes
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {holdable && (
          <>
            {run.hold ? (
              <DropdownMenuItem className={`cursor-pointer ${positive.item}`} onClick={() => setDecision({ run, kind: 'release' })}>
                <LockOpen className={`w-4 h-4 mr-2 ${positive.icon}`} />
                Release Payment Hold
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className={`cursor-pointer ${warning.item}`} onClick={() => setDecision({ run, kind: 'hold' })}>
                <Lock className={`w-4 h-4 mr-2 ${warning.icon}`} />
                Hold Payment Run
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem className="cursor-pointer" onClick={() => exportRunCsv(run)}>
          <Download className={`w-4 h-4 mr-2 ${neutral.icon}`} />
          Export Payment Run
        </DropdownMenuItem>
        {cancellable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={`cursor-pointer ${destructive.item}`} onClick={() => setDecision({ run, kind: 'cancel' })}>
              <Ban className={`w-4 h-4 mr-2 ${destructive.icon}`} />
              Cancel Payment Run
            </DropdownMenuItem>
          </>
        )}
      </>
    );
  };

  // Zero runs at all: the empty card with the CTA (no point rendering an
  // empty listing shell around nothing).
  if (runs.length === 0) {
    return (
      <div className="flex-1 rounded-xl border border-border bg-card flex flex-col items-center justify-center text-center px-6 py-16">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
          <ListChecks className="w-6 h-6 text-blue-500" />
        </div>
        <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>
          No payment runs yet
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          A run pays many vendors in one reviewed, approved batch. Set the criteria and the invoices fall out of the query.
        </p>
        <Button size="sm" className="mt-4 h-9 rounded-lg shadow-sm" onClick={onStartRun}>
          <Plus className="w-4 h-4 mr-1.5" />
          Start a Payment Run
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Performance Insights — customizable KPI grid + date control, matching
          the other Vendor Payments tabs. The whole band disappears when every
          widget is removed; the toolbar Insights button is the way back in. */}
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

      <RunInsightsPanel
        open={insightsPanelOpen}
        onOpenChange={setInsightsPanelOpen}
        activeKpis={activeKpiKeys}
        onToggleKpi={handleToggleKpi}
        runs={rangedRuns}
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
            Refine the payment run list by status, creator, payment date, and total.
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
            {/* ── Status ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Status</p>
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const selectedStatuses = columnFilters.status?.values ?? [];
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => patchColumnFilter('status', 'multiselect', { values: [] })}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                          selectedStatuses.length === 0
                            ? 'border-primary bg-accent text-primary'
                            : 'border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                        style={{ fontWeight: 500 }}
                      >
                        Any
                      </button>
                      {STATUS_ORDER.map((status) => {
                        const isOn = selectedStatuses.includes(status);
                        const count = runs.filter((r) => r.status !== 'Draft' && displayStatus(r) === status).length;
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() =>
                              patchColumnFilter('status', 'multiselect', {
                                values: isOn
                                  ? selectedStatuses.filter((v) => v !== status)
                                  : [...selectedStatuses, status],
                              })
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                              isOn
                                ? 'border-primary bg-accent text-primary'
                                : 'border-border bg-white text-foreground hover:bg-muted/50'
                            }`}
                            style={{ fontWeight: 500 }}
                          >
                            {status}
                            <span
                              className="text-[10px] rounded-full px-1.5 py-px"
                              style={{
                                backgroundColor: isOn ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                                color: isOn ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
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

            {/* ── Created by ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Created By</p>
              <Input
                placeholder="Filter by creator name..."
                className="h-9 text-sm bg-white"
                value={columnFilters.createdBy?.text ?? ''}
                onChange={(e) => patchColumnFilter('createdBy', 'text', { text: e.target.value })}
              />
            </div>

            {/* ── Payment date range ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Payment Date</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>From</p>
                  <Input
                    type="date"
                    className="h-9 text-sm bg-white"
                    value={columnFilters.paymentDate?.dateFrom ?? ''}
                    onChange={(e) => patchColumnFilter('paymentDate', 'date', { dateFrom: e.target.value })}
                  />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>To</p>
                  <Input
                    type="date"
                    className="h-9 text-sm bg-white"
                    value={columnFilters.paymentDate?.dateTo ?? ''}
                    onChange={(e) => patchColumnFilter('paymentDate', 'date', { dateTo: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* ── Run total range ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Run Total</p>
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
                      value={formatMoneyText(columnFilters.total?.min ?? '')}
                      onChange={(e) => patchColumnFilter('total', 'range', { min: e.target.value.replace(/[^\d.]/g, '') })}
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
                      value={formatMoneyText(columnFilters.total?.max ?? '')}
                      onChange={(e) => patchColumnFilter('total', 'range', { max: e.target.value.replace(/[^\d.]/g, '') })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-5 h-14 border-t border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => { setColumnFilters({}); setCurrentPage(1); }}
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
              Show {sortedFiltered.length} run{sortedFiltered.length !== 1 ? 's' : ''}
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
          {/* Search + Filters on the left (the invoicing listing layout),
              count + Insights + column selector on the right. */}
          <div data-col-hide-edge className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                <Input
                  placeholder="Search by run ID, creator, or vendor..."
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
                className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none shrink-0 focus-visible:ring-2 focus-visible:ring-ring/50 ${
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
                <span className="text-muted-foreground">{runs.length}</span>
                <span className="text-muted-foreground/70"> runs</span>
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
              <ViewDensityMenu
                density={densityMode}
                onDensityChange={setDensityMode}
                cardSize={cardSize}
                onCardSizeChange={setCardSize}
              />
              <ColumnSelectorTrigger
                visibleCount={visibleColumnCount}
                active={columnDrawerOpen}
                onClick={() => setColumnDrawerOpen((o) => !o)}
                disabled={densityMode === 'card'}
              />
            </div>
          </div>

          {/* Quick-filter dropdowns — status is the work-queue slicer, then
              who built the run and who approved it. */}
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
            {/* Me mode chip removed entirely (user 10/5). */}
            <MultiSelectFilter
              label="Status"
              options={STATUS_ORDER.map((s) => ({ id: s, label: s, count: statusQuickCounts[s] ?? 0 }))}
              selected={statusQuick}
              onChange={(next) => { setStatusQuick(next); setCurrentPage(1); }}
            />
            <MultiSelectFilter
              label="Created By"
              searchable
              options={createdByQuickOptions.map((v) => ({ id: v, label: v, count: createdByQuickCounts[v] ?? 0 }))}
              selected={createdByQuick}
              onChange={(next) => { setCreatedByQuick(next); setCurrentPage(1); }}
            />
            <MultiSelectFilter
              label="Approved By"
              searchable
              options={approvedByQuickOptions.map((v) => ({ id: v, label: v, count: approvedByQuickCounts[v] ?? 0 }))}
              selected={approvedByQuick}
              onChange={(next) => { setApprovedByQuick(next); setCurrentPage(1); }}
            />
          </div>

          {/* Active per-column filter chips */}
          <InvoiceActiveFiltersBar
            columnFilters={columnFilters}
            columnLabels={Object.fromEntries(RUN_COLUMN_CATALOG.map((c) => [c.key, c.label]))}
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
            {densityMode === 'card' ? (
              <div className="flex-1 overflow-auto p-4">
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
                  {(cardStates.loadState === 'loading' || cardStates.emptyProps ? [] : paginated).map((run) => {
                    const names = vendorNames(run);
                    const invoices = invoiceCount(run);
                    return (
                      <div
                        key={run.id}
                        className={`border border-border rounded-xl bg-white hover:border-primary/20 hover:shadow-md transition-all cursor-pointer group ${
                          cardSize === 'large' ? 'p-5' : cardSize === 'small' ? 'p-3' : 'p-4'
                        }`}
                        onClick={() => onOpenRun(run.id)}
                      >
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <div className="min-w-0">
                            <div className="text-sm truncate" style={{ fontWeight: 600 }}>{run.id}</div>
                            {cardSize !== 'small' && (
                              <div className="text-[11px] text-muted-foreground truncate">
                                Pays on {formatUsDateTime(run.paymentDate, run.id)}
                              </div>
                            )}
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
                            <DropdownMenuContent align="end" className="w-44">
                              {runMenuItems(run)}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="space-y-2 mb-3">
                          <div className="text-sm truncate" style={{ fontWeight: 500 }} title={names.join(', ')}>
                            {names.length === 0
                              ? 'No vendors yet'
                              : names.length === 1
                                ? names[0]
                                : `${names[0]} +${names.length - 1} more`}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{names.length} vendor{names.length === 1 ? '' : 's'}</span>
                            <span className="text-muted-foreground/50">·</span>
                            <span>{invoices} invoice{invoices === 1 ? '' : 's'}</span>
                          </div>
                          {/* Audit trail — the table's Created / Approved
                              columns, so the card view stays consistent. */}
                          {cardSize !== 'small' && (
                            <div className="space-y-0.5 pt-1 text-[11px] text-muted-foreground/80">
                              <div className="flex items-center justify-between gap-2">
                                <span className="shrink-0 text-muted-foreground/50">Created</span>
                                <span className="truncate text-right">{run.createdBy} · {formatUsDateTime(run.createdAt, `${run.id}:crt`)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="shrink-0 text-muted-foreground/50">Approved</span>
                                <span className="truncate text-right">
                                  {run.approvedBy
                                    ? `${run.approvedBy}${run.approvedAt ? ` · ${formatUsDateTime(run.approvedAt, `${run.id}:apr`)}` : ''}`
                                    : 'Not yet'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-border">
                          <div className="text-lg " style={{ fontWeight: 600 }}>
                            {money(runTotal(run))}
                          </div>
                          <RunStatusPill status={run.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
            <DataTable
              key={`cols-${columnResetKey}`}
              rows={paginated}
              optionRows={runs}
              columns={runColumns}
              getRowId={(r) => r.id}
              selectedIds={new Set<string>()}
              onSelectionChange={() => {}}
              hideSelectionColumn
              columnOrder={columnOrder}
              onColumnOrderChange={setColumnOrder}
              columnVisibility={columnVisibility}
              columnFilters={columnFilters}
              onColumnFilterChange={handleColumnFilterChange}
              onAddColumnFilter={handleAddColumnFilter}
              onHideColumn={handleHideColumn}
              sortConfig={sortConfig}
              onSort={handleColumnSort}
              frozenColumns={frozenColumns}
              onFreezeColumn={handleFreezeColumn}
              density={densityMode}
              searchQuery={searchQuery}
              searchRows={sortedFiltered}
              searchRevealAfter="id"
              currentPage={currentPage}
              recordsPerPage={recordsPerPage}
              totalRows={sortedFiltered.length}
              onPageChange={setCurrentPage}
              onRecordsPerPageChange={(n) => {
                setRecordsPerPage(n);
                setCurrentPage(1);
              }}
              onRowClick={(run) => onOpenRun(run.id)}
              renderRowActions={(run) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      aria-label="Run actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {runMenuItems(run)}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              emptyConfig={emptyConfig}
            />
            )}
          </div>
        </div>
        <ColumnSelector
          columns={RUN_COLUMN_CATALOG}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          onColumnOrderChange={setColumnOrder}
          onColumnVisibilityChange={setColumnVisibility}
          lockedColumns={LOCKED_COLUMNS}
          frozenColumns={frozenColumns}
          onFreezeColumn={handleFreezeColumn}
          open={columnDrawerOpen}
          onOpenChange={setColumnDrawerOpen}
          defaultColumnOrder={RUN_COLUMN_CATALOG.map((c) => c.key)}
          defaultColumnVisibility={Object.fromEntries(RUN_COLUMN_CATALOG.map((c) => [c.key, !DEFAULT_HIDDEN.has(c.key)]))}
          onReset={() => setColumnResetKey((k) => k + 1)}
        />
      </div>

      {/* Approval decisions from the row menu — the same heads-up modals
          the detail page uses. */}
      {decision && (
        <>
          <ApproveRunModal
            run={decision.run}
            open={decision.kind === 'approve'}
            onClose={() => setDecision(null)}
            onConfirm={() => {
              onApproveRun(decision.run.id);
              setDecision(null);
            }}
          />
          {/* Release — the vendor invoicing release dialog (user 10/22/26). */}
          <ReleaseHoldDialog
            open={decision.kind === 'release'}
            onOpenChange={(o) => { if (!o) setDecision(null); }}
            description="The run can be approved and recorded again. Its status doesn't change."
            holdBy={decision.run.hold?.by}
            holdAt={decision.run.hold?.at}
            notifyHelper="Choose who should hear about the release."
            onConfirm={(release) => {
              onReleaseHold(decision.run.id, release);
              setDecision(null);
            }}
          />
          {/* Hold / cancel — the invoice module's reason dialog AS IS,
              with run copy (runReasonConfigs). */}
          <InvoiceReasonDialog
            open={decision.kind === 'hold'}
            onOpenChange={(o) => { if (!o) setDecision(null); }}
            action="paymentHold"
            count={1}
            currentStatus={decision.run.status}
            configOverride={RUN_HOLD_OVERRIDE}
            onConfirm={(reason) => {
              onHoldRun(decision.run.id, reason);
              setDecision(null);
            }}
          />
          <InvoiceReasonDialog
            open={decision.kind === 'cancel'}
            onOpenChange={(o) => { if (!o) setDecision(null); }}
            action="cancel"
            count={1}
            currentStatus={decision.run.status}
            configOverride={RUN_CANCEL_OVERRIDE}
            onConfirm={(reason) => {
              onCancelRun(decision.run.id, reason);
              setDecision(null);
            }}
          />
        </>
      )}
    </div>
  );
}
