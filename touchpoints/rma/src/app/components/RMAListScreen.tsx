import { rmaCurrency } from '@/app/currency/returnCurrency';
import { getCurrency } from '@/app/currency/currencies';
import { useCallback, useMemo, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Search,
  X,
  Plus,
  RotateCcw,
  Undo2,
  SlidersHorizontal,
  ChartColumn,
  Truck,
  CheckCheck,
  FileEdit,
  CalendarDays,
  ChevronDown,
  Plus as PlusIcon,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Calendar } from '@/app/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import type { DateRange } from 'react-day-picker';
import { EmptyState } from '@/app/components/EmptyState';
import { BulkActionBar, type BulkAction } from '@/app/components/BulkActionBar';
import { MultiSelectFilter } from '@/app/components/data-table/MultiSelectFilter';
import { SearchSelectPeople } from '@/app/components/SearchSelectPeople';
import { InvoiceActiveFiltersBar } from '@/app/components/InvoiceActiveFiltersBar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { DraggableRMAKpiCard } from '@/app/components/DraggableRMAKpiCard';
import { InsightsResetButton } from '@/app/components/InsightsResetButton';
import { InsightsRefresh } from '@/app/components/InsightsRefresh';
import { InsightsRangeMenu, INSIGHTS_RANGE_OPTIONS, type InsightsRange } from '@/app/components/InsightsRangeMenu';
import {
  ALL_RMA_KPI_DEFINITIONS,
  RMAInsightsPanel,
} from '@/app/components/RMAInsightsPanel';
import {
  applyColumnFilters,
  ColumnSelector,
  ColumnSelectorTrigger,
  type ColumnFilterState,
  type SortConfig,
  type DensityOption,
  type CardSize,
} from '@/app/components/data-table';
import { ViewDensityMenu } from '@/app/components/data-table/ViewDensityMenu';
import {
  RMADataTable,
  RMAVersionHistoryProvider,
  RMA_COLUMNS,
  RMA_STATUS_STYLES,
  rmaListStatus,
  rmaMatchesSearch,
  type RMAListStatus,
  type RMARowActionId,
} from '@/app/components/RMADataTable';
import { StatusPill } from '@/app/components/data-table/StatusPill';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import { Checkbox } from '@/app/components/ui/checkbox';
import type { RMA } from '@/app/data/mockRMAs';
import { authorizedQty, receivingsForRMA, rmaPaymentOverdue, rmaStatusLabel, sourcePOsForRMA } from '@/app/data/mockRMAs';
import { palette } from '@/styles/tokens';
import RMAVersionHistoryModal from '@/app/components/rma-versions/RMAVersionHistoryModal';
import { RMAArchiveModal } from '@/app/components/rma/RMAArchiveModal';
import { rmaShipmentInProcess } from '@/app/data/rmaShipments';
import { useRMAContext } from '@/app/rma-context';
import { toast } from 'sonner';

const RMA_COLUMN_CATALOG = RMA_COLUMNS.map((c) => ({ key: c.key, label: c.label }));
const LOCKED_RMA_COLUMNS = ['rmaNumber'];
/** Columns hidden until somebody asks for them.
 *  It stays available in the Columns panel for anyone who wants it. */
const HIDDEN_BY_DEFAULT_RMA_COLUMNS: string[] = [];

const DEFAULT_ACTIVE_KPIS = [
  'total',
  'total_return_value',
  'time_to_resolution',
  'most_common_reason',
  'in_shipping',
];
// Bumped to v5 with the trimmed catalogue: a stored set from an earlier
// version would keep asking for metrics that no longer exist.
const KPI_STORAGE_KEY = 'omnesoft:rma:active-widgets-v5';

// ─── KPI catalog. Same visual language as vendor-invoicing's Performance
// KPI catalog lives in RMAInsightsPanel (shared with the side drawer) so
// the drawer's tiles and the band's cards always agree on shape, label,
// icon tint, and compute.

/** The tags a return can carry beside its status, the same two the detail
 *  header shows. Pending refund lets accounting pull the refunds still to
 *  come in one click (review RMA-46). */
const TAG_QUICK_OPTIONS = ['Pending refund', 'Payment overdue', 'Shipment in process'] as const;
function rmaTags(rma: RMA): string[] {
  const tags: string[] = [];
  if (
    !rma.archived &&
    rma.status === 'Shipped to Vendor' &&
    rma.creditTerms?.refundOrCredit !== 'Credit'
  )
    tags.push('Pending refund');
  // DQ-02: still waiting past the company's setting.
  if (rmaPaymentOverdue(rma)) tags.push('Payment overdue');
  if (rmaShipmentInProcess(rma)) tags.push('Shipment in process');
  return tags;
}

const STATUS_QUICK_OPTIONS: RMAListStatus[] = [
  'Draft',
  'Sent',
  'Approved',
  'Shipped to Vendor',
  'Closed',
  // Closed, but on a short settlement somebody confirmed as a loss.
  'Closed with loss',
  // A cancelled return is still a record somebody looks for -- it is the one
  // state that can be archived -- so it is filterable like the rest.
  'Cancelled',
  // Archiving used to take a return off the list with nothing that could
  // bring it back, so the counts in this filter added up to fewer than the
  // returns that existed. An archived return is out of the way, not gone:
  // the list hides it until this option asks for it.
  'Archived',
];

interface RMAListScreenProps {
  rmas: RMA[];
  onCreateRMA: () => void;
  onViewRMA: (rmaId: string) => void;
  onRowAction?: (actionId: RMARowActionId, rmaId: string) => void;
}

export function RMAListScreen({ rmas, onCreateRMA, onViewRMA, onRowAction }: RMAListScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  /** The archived rail-and-pane design, open for comparison. */
  const [statusQuick, setStatusQuick] = useState<string[]>([]);
  /** Tags a return carries beside its status. Pending refund is the one
   *  accounting chases: shipped, settles in cash, money not logged yet. */
  const [tagQuick, setTagQuick] = useState<string[]>([]);
  const [vendorQuick, setVendorQuick] = useState<string[]>([]);
  const [createdByQuick, setCreatedByQuick] = useState<string[]>([]);
  const [pointOfContactQuick, setPointOfContactQuick] = useState<string[]>([]);
  // Item, PO and receipt are many-per-return, so these match on "the return
  // carries any of the selected values" rather than on a single header field.
  const [itemQuick, setItemQuick] = useState<string[]>([]);
  const [poQuick, setPoQuick] = useState<string[]>([]);
  /** A return's currency is its PO's (app/currency/returnCurrency.ts). */
  const [currencyQuick, setCurrencyQuick] = useState<string[]>([]);
  const [receivingQuick, setReceivingQuick] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** The return whose version history is open, reached from the V pill on the
   *  RMA ID cell without leaving the list. Held by id so a revert made inside
   *  the modal re-reads from the store instead of a captured row. */
  const [versionHistoryId, setVersionHistoryId] = useState<string | null>(null);

  // ─── DataTable-driven state ─────────────────────────────────
  const [columnOrder, setColumnOrder] = useState<string[]>(() => RMA_COLUMN_CATALOG.map((c) => c.key));
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      RMA_COLUMN_CATALOG.map((c) => [c.key, !HIDDEN_BY_DEFAULT_RMA_COLUMNS.includes(c.key)]),
    ),
  );
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'createdDate', direction: 'desc' });
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(() => new Set(LOCKED_RMA_COLUMNS));
  const [density, setDensity] = useState<DensityOption>('condensed');
  const [cardSize, setCardSize] = useState<CardSize>('medium');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  /** The return whose archive is waiting on the confirmation. */
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const { applyRMAAction } = useRMAContext();
  const archiveTarget = archiveId ? (rmas.find((r) => r.id === archiveId) ?? null) : null;
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);

  // ─── Insights KPI band state — 1:1 with InvoiceListScreen. Active
  // keys + their order persist in localStorage so a user's arrangement
  // survives reloads; Reset restores the default set / order and clears
  // the storage entry.
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

  const persistKpiKeys = (next: string[]) => {
    try {
      localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const handleToggleKpi = (key: string) => {
    setActiveKpiKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      persistKpiKeys(next);
      return next;
    });
  };
  const handleRemoveKpi = (key: string) => {
    setActiveKpiKeys((prev) => {
      const next = prev.filter((k) => k !== key);
      persistKpiKeys(next);
      return next;
    });
  };
  const moveKpi = useCallback((from: number, to: number) => {
    setActiveKpiKeys((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persistKpiKeys(next);
      return next;
    });
  }, []);
  const handleInsightsReset = () => {
    setActiveKpiKeys(DEFAULT_ACTIVE_KPIS);
    persistKpiKeys(DEFAULT_ACTIVE_KPIS);
  };
  const insightsDirty = activeKpiKeys.join(',') !== DEFAULT_ACTIVE_KPIS.join(',');

  // ─── Filtering ──────────────────────────────────────────────
  const preColumnFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rmas.filter((rma) => {
      // One list of what a return can be found by, shared with the row so the
      // two can never disagree about whether something matched. It carries
      // every source PO and receipt, in the form the product prints them.
      if (q && !rmaMatchesSearch(rma, q)) return false;
      // An archived return stays out of the way until the filter asks for it
      // by name, which is the only way it can be found again.
      if (statusQuick.length > 0) {
        if (!statusQuick.includes(rmaListStatus(rma))) return false;
      } else if (rma.archived) {
        return false;
      }
      if (tagQuick.length > 0 && !rmaTags(rma).some((t) => tagQuick.includes(t))) return false;
      if (vendorQuick.length > 0 && !vendorQuick.includes(rma.vendor)) return false;
      if (createdByQuick.length > 0 && !createdByQuick.includes(rma.createdBy)) return false;
      if (pointOfContactQuick.length > 0 && !pointOfContactQuick.includes(rma.pointOfContact ?? '')) return false;
      if (itemQuick.length > 0 && !rma.items.some((li) => itemQuick.includes(li.sku))) return false;
      if (poQuick.length > 0 && !sourcePOsForRMA(rma).some((p) => poQuick.includes(p))) return false;
      if (currencyQuick.length > 0 && !currencyQuick.includes(rmaCurrency(rma))) return false;
      if (receivingQuick.length > 0 && !receivingsForRMA(rma).some((g) => receivingQuick.includes(g)))
        return false;
      if (dateFrom && rma.createdDate < dateFrom) return false;
      if (dateTo && rma.createdDate > dateTo) return false;
      return true;
    });
  }, [
    rmas,
    searchQuery,
    statusQuick,
    tagQuick,
    vendorQuick,
    createdByQuick,
    pointOfContactQuick,
    itemQuick,
    poQuick,
    currencyQuick,
    receivingQuick,
    dateFrom,
    dateTo,
  ]);

  // Per-column filters from the DataTable header menus.
  const filtered = useMemo(() => {
    const columnFilterList = Object.values(columnFilters);
    return applyColumnFilters(preColumnFiltered, columnFilterList, (row, key) => {
      const col = RMA_COLUMNS.find((c) => c.key === key);
      return col ? col.getValue(row) : (row as unknown as Record<string, unknown>)[key];
    });
  }, [preColumnFiltered, columnFilters]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortConfig) return filtered;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const col = RMA_COLUMNS.find((c) => c.key === sortConfig.key);
    const accessor = col?.getSortValue ?? col?.getValue;
    if (!accessor) return filtered;
    return [...filtered].sort((a, b) => {
      const av = accessor(a) as unknown;
      const bv = accessor(b) as unknown;
      if (av == null && bv == null) return 0;
      if (av == null) return -dir;
      if (bv == null) return dir;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortConfig]);

  const visibleColumnCount = RMA_COLUMN_CATALOG.filter(
    (c) => columnVisibility[c.key] !== false,
  ).length;

  const activeQuickFilterCount =
    statusQuick.length +
    tagQuick.length +
    vendorQuick.length +
    createdByQuick.length +
    pointOfContactQuick.length +
    itemQuick.length +
    poQuick.length +
    currencyQuick.length +
    receivingQuick.length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);
  const activeColumnFilterCount = Object.keys(columnFilters).length;
  const activeFiltersCount = activeQuickFilterCount + activeColumnFilterCount;
  /** Whether anything but the search box is narrowing the list. The empty
   *  state reads it so a search that found nothing is not blamed on filters
   *  nobody set. */
  const anyFilterApplied = activeFiltersCount > 0;

  // Insights date range. Mirrors InvoiceListScreen: the choice persists,
  // and narrowing the window scopes the KPI strip without touching the
  // listing table's own filters.
  const INSIGHTS_RANGE_STORAGE_KEY = 'omnesoft:rmas:insights-range-v1';
  const [insightsRange, setInsightsRangeRaw] = useState<InsightsRange>(() => {
    // Guarded for SSR: this seeds useState, so it runs during the server
    // render where localStorage does not exist.
    if (typeof window === 'undefined') return 'last_30';
    try {
      const v = localStorage.getItem(INSIGHTS_RANGE_STORAGE_KEY);
      // A range that is no longer offered, such as the retired "All time",
      // fails this check and falls back to the default.
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

  // RMAs the KPI strip is computed from. Anchored on createdDate, which is
  // the only date every RMA carries regardless of status.
  const rmasInRange = useMemo(() => {
    const days: Record<InsightsRange, number | null> = {
      last_7: 7, last_30: 30, last_90: 90, last_365: 365, custom: null,
    };
    if (insightsRange === 'custom') {
      const { from, to } = insightsCustom;
      if (!from || !to) return rmas;
      return rmas.filter((r) => r.createdDate >= from && r.createdDate <= to);
    }
    const window = days[insightsRange];
    if (window === null) return rmas;
    const cutoff = new Date(Date.now() - window * 86400000).toISOString().split('T')[0]!;
    return rmas.filter((r) => r.createdDate >= cutoff);
  }, [rmas, insightsRange, insightsCustom]);

  const kpiCards = useMemo(
    () =>
      ALL_RMA_KPI_DEFINITIONS.map((def) => ({
        key: def.key,
        label: def.label,
        icon: def.icon,
        iconBg: def.iconBg,
        iconColor: def.iconColor,
        tooltip: def.tooltip,
        value: def.compute(rmasInRange),
        sub: def.computeSubtitle ? def.computeSubtitle(rmasInRange) : def.subtitle,
        hover: def.computeHover?.(rmasInRange),
      })),
    [rmasInRange],
  );
  const kpiByKey = useMemo(
    () => new Map(kpiCards.map((k) => [k.key, k])),
    [kpiCards],
  );
  const activeKpiCards = activeKpiKeys
    .map((k) => kpiByKey.get(k))
    .filter((v): v is (typeof kpiCards)[number] => Boolean(v));

  // ─── DataTable handlers ────────────────────────────────────
  const handleColumnFilterChange = (columnKey: string, filter: ColumnFilterState) => {
    setColumnFilters((prev) => {
      const next = { ...prev, [columnKey]: filter };
      const isActive =
        (filter.type === 'text' && filter.text.trim().length > 0) ||
        (filter.type === 'multiselect' && filter.values.length > 0) ||
        (filter.type === 'range' && (filter.min !== '' || filter.max !== '')) ||
        (filter.type === 'date' && (filter.dateFrom !== '' || filter.dateTo !== ''));
      if (!isActive) delete next[columnKey];
      return next;
    });
    setCurrentPage(1);
  };
  const handleAddColumnFilter = (columnKey: string) => {
    setColumnFilters((prev) => {
      if (prev[columnKey]) return prev;
      const col = RMA_COLUMNS.find((c) => c.key === columnKey);
      const type = col?.filterType ?? 'text';
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
  const handleHideColumn = (columnKey: string) => {
    if (LOCKED_RMA_COLUMNS.includes(columnKey)) return;
    setColumnVisibility((prev) => ({ ...prev, [columnKey]: false }));
  };
  const handleSort = (columnKey: string, direction: 'asc' | 'desc' | null) => {
    setSortConfig(direction === null ? null : { key: columnKey, direction });
    setCurrentPage(1);
  };
  const handleFreezeColumn = (columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && !LOCKED_RMA_COLUMNS.includes(columnKey)) next.delete(columnKey);
      else next.add(columnKey);
      return next;
    });
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusQuick([]);
    setTagQuick([]);
    setVendorQuick([]);
    setCreatedByQuick([]);
    setPointOfContactQuick([]);
    setItemQuick([]);
    setPoQuick([]);
    setCurrencyQuick([]);
    setReceivingQuick([]);
    setDateFrom('');
    setDateTo('');
    setColumnFilters({});
  };

  // ─── Bulk actions ──────────────────────────────────────────
  const selectedRMAs = useMemo(
    () => rmas.filter((r) => selectedIds.has(r.id)),
    [rmas, selectedIds],
  );
  // Shipping is the only thing worth doing to a handful of returns at once.
  //
  // The bar carried every lifecycle step, and the rest are decisions rather
  // than chores: sending asks the vendor something, approving records what
  // they answered, closing settles the money and cancelling undoes a promise
  // already made. None of those is safe to apply to a selection without
  // looking at each return, and each one already has its place on the return
  // itself. Handing a batch of authorized returns to the carrier is the one
  // step that really is the same act repeated.
  const bulkActions: BulkAction[] = useMemo(() => {
    const shippable = selectedRMAs.filter((r) => r.status === 'Approved');
    if (shippable.length === 0) return [];
    return [
      {
        key: 'ship',
        label: `Ship (${shippable.length})`,
        icon: Truck,
        tone: 'primary',
        onClick: () => shippable.forEach((r) => onRowAction?.('ship', r.id)),
      },
    ];
  }, [selectedRMAs, onRowAction]);

  // Options + per-option counts — mirrors the vendor-invoicing quick-
  // filter recipe (MultiSelectFilter reads `{ id, label, count }`).
  const countsFor = (getter: (r: RMA) => string | undefined) => {
    const map: Record<string, number> = {};
    for (const r of rmas) {
      const v = getter(r);
      if (!v) continue;
      map[v] = (map[v] ?? 0) + 1;
    }
    return map;
  };
  const vendorOptions = useMemo(
    () => Array.from(new Set(rmas.map((r) => r.vendor))).sort(),
    [rmas],
  );
  const vendorCounts = useMemo(() => countsFor((r) => r.vendor), [rmas]);
  const createdByOptions = useMemo(
    () => Array.from(new Set(rmas.map((r) => r.createdBy))).sort(),
    [rmas],
  );
  const createdByCounts = useMemo(() => countsFor((r) => r.createdBy), [rmas]);
  const pointOfContactOptions = useMemo(
    () =>
      Array.from(new Set(rmas.map((r) => r.pointOfContact ?? '').filter(Boolean))).sort(),
    [rmas],
  );
  const pointOfContactCounts = useMemo(
    () => countsFor((r) => r.pointOfContact),
    [rmas],
  );
  const statusCounts = useMemo(() => countsFor((r) => rmaListStatus(r)), [rmas]);
  const tagCounts = useMemo(() => {
    const out: Record<string, number> = {};
    rmas.forEach((r) => rmaTags(r).forEach((t) => (out[t] = (out[t] ?? 0) + 1)));
    return out;
  }, [rmas]);

  // Item, PO and receipt repeat within a single return, so each value is
  // counted once per return — the badge reads as "returns carrying this",
  // matching every other facet, not as a line count.
  const countsForMany = (getter: (r: RMA) => string[]) => {
    const map: Record<string, number> = {};
    for (const r of rmas) {
      for (const v of new Set(getter(r))) {
        if (!v) continue;
        map[v] = (map[v] ?? 0) + 1;
      }
    }
    return map;
  };
  const optionsForMany = (getter: (r: RMA) => string[]) =>
    Array.from(new Set(rmas.flatMap(getter).filter(Boolean))).sort();

  const itemOptions = useMemo(() => optionsForMany((r) => r.items.map((li) => li.sku)), [rmas]);
  const itemCounts = useMemo(() => countsForMany((r) => r.items.map((li) => li.sku)), [rmas]);
  const poOptions = useMemo(() => optionsForMany(sourcePOsForRMA), [rmas]);
  const poCounts = useMemo(() => countsForMany(sourcePOsForRMA), [rmas]);
  // Dollars first, then the others A to Z.
  const currencyOptions = useMemo(
    () => Array.from(new Set(rmas.map(rmaCurrency))).sort((a, b) => Number(b === 'USD') - Number(a === 'USD') || a.localeCompare(b)),
    [rmas],
  );
  const currencyCounts = useMemo(() => countsFor(rmaCurrency), [rmas]);
  /** "GBP, British Pound", as the currency dropdowns write a currency. */
  const currencyOptionLabel = (code: string) => `${code}, ${getCurrency(code)?.name ?? code}`;
  const receivingOptions = useMemo(() => optionsForMany(receivingsForRMA), [rmas]);
  const receivingCounts = useMemo(() => countsForMany(receivingsForRMA), [rmas]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-3 flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Page Header — 1:1 with InvoiceListScreen */}
        <div className="-mx-3 -mt-3 px-3 pt-3.5 pb-3.5 bg-white border-b border-border shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: palette.amber[50] }}
              >
                <Undo2 className="w-4 h-4" style={{ color: palette.amber[700] }} />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-[20px] truncate">Vendor Returns</h1>
                <p className="text-xs text-muted-foreground">
                  Track vendor returns from draft through resolution.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={onCreateRMA}
                className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create New RMA
              </Button>
            </div>
          </div>
        </div>

        {/* Performance Insights KPI band — drag-reorder, per-card
            remove, Reset when dirty, Add insights popover to re-add
            removed widgets, Hide toggle. Copied 1:1 from InvoiceListScreen. */}
        {showInsights && activeKpiCards.length > 0 && (
          <div className="mt-3 mb-4 shrink-0">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>
                  Performance insights
                </h2>
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
                  Hide
                </button>
                {/* Add insights opens the right-side Customize drawer —
                    same recipe as vendor-invoicing (search + category
                    grid + Enable All toggle). */}
                <button
                  onClick={() => setInsightsPanelOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
                >
                  <PlusIcon className="w-3 h-3" />
                  Add insights
                </button>
              </div>
            </div>
            <DndProvider backend={HTML5Backend}>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
              >
                {activeKpiCards.map((kpi, idx) => (
                  <DraggableRMAKpiCard
                    key={kpi.key}
                    index={idx}
                    kpiKey={kpi.key}
                    label={kpi.label}
                    value={kpi.value}
                    sub={kpi.sub}
                    icon={kpi.icon}
                    iconBg={kpi.iconBg}
                    iconColor={kpi.iconColor}
                    tooltip={kpi.tooltip}
                    hover={kpi.hover}
                    moveCard={moveKpi}
                    onRemove={() => handleRemoveKpi(kpi.key)}
                  />
                ))}
              </div>
            </DndProvider>
          </div>
        )}

        {/* Unified Table Container */}
        <div className={`border border-border rounded-xl bg-card flex flex-1 min-h-0 overflow-hidden ${showInsights ? '' : 'mt-3'}`}>
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Toolbar — search + filter button + insights + density + columns */}
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                  <Input
                    placeholder="Search RMAs..."
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
                  onClick={() => setFiltersDialogOpen(true)}
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
                {activeFiltersCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                    style={{ fontWeight: 500 }}
                    title="Reset all filters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-sm tabular-nums mr-1 hidden sm:inline"
                  style={{ fontWeight: 500 }}
                >
                  <span className="text-foreground">{sorted.length}</span>
                  <span className="text-muted-foreground/60"> of </span>
                  <span className="text-muted-foreground">{rmas.length}</span>
                  <span className="text-muted-foreground/70"> RMAs</span>
                </span>
                <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />
                <button
                  onClick={() => {
                    // Partner behavior: the Insights button reveals the
                    // band AND opens the Customize drawer. Match vendor-
                    // invoicing exactly.
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
                  density={density}
                  onDensityChange={setDensity}
                  cardSize={cardSize}
                  onCardSizeChange={setCardSize}
                />
                <ColumnSelectorTrigger
                  visibleCount={visibleColumnCount}
                  active={columnDrawerOpen}
                  onClick={() => setColumnDrawerOpen((o) => !o)}
                />
              </div>
            </div>

            {/* Quick filters row — MultiSelectFilter chips w/ per-option
                counts, matching vendor-invoicing's InvoiceListScreen. Same
                white card background as the toolbar (no grey band). */}
            <div className="flex items-center flex-wrap gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
              <MultiSelectFilter
                label="Status"
                options={STATUS_QUICK_OPTIONS.map((s) => ({ id: s, label: s, count: statusCounts[s] ?? 0 }))}
                selected={statusQuick}
                onChange={(next) => { setStatusQuick(next); setCurrentPage(1); }}
              />
              <MultiSelectFilter
                label="Tag"
                options={TAG_QUICK_OPTIONS.map((t) => ({ id: t, label: t, count: tagCounts[t] ?? 0 }))}
                selected={tagQuick}
                onChange={(next) => { setTagQuick(next); setCurrentPage(1); }}
              />
              <MultiSelectFilter
                label="Vendor"
                searchable
                options={vendorOptions.map((v) => ({ id: v, label: v, count: vendorCounts[v] ?? 0 }))}
                selected={vendorQuick}
                onChange={(next) => { setVendorQuick(next); setCurrentPage(1); }}
              />
              <MultiSelectFilter
                label="Point of contact"
                searchable
                options={pointOfContactOptions.map((v) => ({ id: v, label: v, count: pointOfContactCounts[v] ?? 0 }))}
                selected={pointOfContactQuick}
                onChange={(next) => { setPointOfContactQuick(next); setCurrentPage(1); }}
              />
              <MultiSelectFilter
                label="Created by"
                searchable
                options={createdByOptions.map((v) => ({ id: v, label: v, count: createdByCounts[v] ?? 0 }))}
                selected={createdByQuick}
                onChange={(next) => { setCreatedByQuick(next); setCurrentPage(1); }}
              />
              <MultiSelectFilter
                label="Item"
                searchable
                options={itemOptions.map((v) => ({ id: v, label: v, count: itemCounts[v] ?? 0 }))}
                selected={itemQuick}
                onChange={(next) => { setItemQuick(next); setCurrentPage(1); }}
              />
              <MultiSelectFilter
                label="PO number"
                searchable
                options={poOptions.map((v) => ({ id: v, label: v, count: poCounts[v] ?? 0 }))}
                selected={poQuick}
                onChange={(next) => { setPoQuick(next); setCurrentPage(1); }}
              />
              <MultiSelectFilter
                label="Currency"
                options={currencyOptions.map((v) => ({ id: v, label: currencyOptionLabel(v), count: currencyCounts[v] ?? 0 }))}
                selected={currencyQuick}
                onChange={(next) => { setCurrencyQuick(next); setCurrentPage(1); }}
              />
              <MultiSelectFilter
                label="Receiving document"
                searchable
                options={receivingOptions.map((v) => ({ id: v, label: v, count: receivingCounts[v] ?? 0 }))}
                selected={receivingQuick}
                onChange={(next) => { setReceivingQuick(next); setCurrentPage(1); }}
              />
            </div>

            {/* Active column filter chips row */}
            {activeColumnFilterCount > 0 && (
              <InvoiceActiveFiltersBar
                columnFilters={columnFilters}
                columnLabels={Object.fromEntries(RMA_COLUMN_CATALOG.map((c) => [c.key, c.label]))}
                onRemoveFilter={(key) => {
                  setColumnFilters((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                }}
                onClearAll={() => setColumnFilters({})}
              />
            )}

            {/* Bulk action bar OR active filter chips row */}
            {selectedIds.size > 0 && (
              <BulkActionBar
                count={selectedIds.size}
                noun="Return"
                actions={bulkActions}
                onClear={() => setSelectedIds(new Set())}
              />
            )}

            {/* Card view — same rows and pagination as the table, laid out
                as a grid. Mirrors InvoiceListScreen's card branch. */}
            {density === 'card' ? (
              <div className="flex-1 min-h-0 overflow-auto p-4">
                <div
                  className={`grid gap-3 ${
                    cardSize === 'large'
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : cardSize === 'small'
                        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  }`}
                >
                  {sorted
                    .slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage)
                    .map((rma) => {
                      const value = rma.items.reduce((s, li) => s + authorizedQty(li) * li.unitPrice, 0);
                      return (
                        <div
                          key={rma.id}
                          onClick={() => onViewRMA(rma.id)}
                          className={`bg-white border border-border rounded-xl hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group ${
                            cardSize === 'large' ? 'p-5' : cardSize === 'small' ? 'p-3' : 'p-4'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Checkbox
                                checked={selectedIds.has(rma.id)}
                                onCheckedChange={() => {
                                  const next = new Set(selectedIds);
                                  if (next.has(rma.id)) next.delete(rma.id);
                                  else next.add(rma.id);
                                  setSelectedIds(next);
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <VendorAvatar name={rma.vendor} size={cardSize === 'large' ? 'md' : 'sm'} />
                              <div className="min-w-0">
                                <div className="text-sm truncate" style={{ fontWeight: 600 }}>
                                  {rma.rmaNumber}
                                </div>
                                {cardSize !== 'small' && (
                                  <div className="text-[11px] text-muted-foreground truncate" title={rma.vendor}>
                                    {rma.vendor}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 mb-3">
                            <div className="text-[11px] text-muted-foreground truncate" title={rma.reason}>
                              {rma.reason}
                            </div>
                            {cardSize !== 'small' && (
                              <div className="space-y-0.5 pt-1 text-[11px] text-muted-foreground/80">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="shrink-0 text-muted-foreground/50">Created</span>
                                  <span className="truncate text-right">{rma.createdBy} · {rma.createdDate}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="shrink-0 text-muted-foreground/50">Items</span>
                                  <span className="truncate text-right">{rma.items.length}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-border gap-2">
                            <div className="text-lg tabular-nums" style={{ fontWeight: 600 }}>
                              ${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                            <StatusPill label={rmaStatusLabel(rma)} style={RMA_STATUS_STYLES[rmaStatusLabel(rma)]} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <RMAVersionHistoryProvider onOpen={(r) => setVersionHistoryId(r.id)}>
              <RMADataTable
                rmas={sorted}
                optionRows={preColumnFiltered}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
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
                density={density}
                currentPage={currentPage}
                recordsPerPage={recordsPerPage}
                totalRows={sorted.length}
                onPageChange={setCurrentPage}
                onRecordsPerPageChange={setRecordsPerPage}
                onRowClick={(rma) => onViewRMA(rma.id)}
                onRowAction={(actionId, rmaId) => {
                  if (actionId === 'view') onViewRMA(rmaId);
                  // Archive asks first, here as on the detail page.
                  else if (actionId === 'archive') setArchiveId(rmaId);
                  else onRowAction?.(actionId, rmaId);
                }}
                searchQuery={searchQuery}
                emptyState={
                  <EmptyState
                    icon={Undo2}
                    // A search with no filters applied is not a filter
                    // problem, and telling somebody to clear filters they
                    // never set sends them looking for a control that is
                    // already off.
                    title={
                      rmas.length === 0
                        ? 'No RMAs yet'
                        : searchQuery.trim() && !anyFilterApplied
                          ? 'No RMAs match your search'
                          : 'No RMAs match your filters'
                    }
                    description={
                      rmas.length === 0
                        ? 'Start a return against a PO to raise your first RMA.'
                        : searchQuery.trim() && !anyFilterApplied
                          ? 'Check the spelling, or try a part number, PO or receipt.'
                          : 'Try clearing filters or adjusting your search.'
                    }
                  />
                }
              />
              </RMAVersionHistoryProvider>
            </div>
            )}
          </div>
          {/* ColumnSelector renders BESIDE the table content as a horizontal
              side panel (flex-row sibling), same as InvoiceListScreen. Its
              `h-full` picks up the table container's height so it opens as
              an inline drawer instead of stealing the whole page height. */}
          <ColumnSelector
            open={columnDrawerOpen}
            onOpenChange={setColumnDrawerOpen}
            columns={RMA_COLUMN_CATALOG}
            columnOrder={columnOrder}
            columnVisibility={columnVisibility}
            onColumnOrderChange={setColumnOrder}
            onColumnVisibilityChange={setColumnVisibility}
            lockedColumns={LOCKED_RMA_COLUMNS}
          />
        </div>
      </div>
      {/* Customize Insights drawer — portal-style right-side sheet
          mirroring vendor-invoicing's InvoiceInsightsPanel. Opened by
          both the toolbar "Insights" button and the band's "Add
          insights" link. */}
      <RMAArchiveModal
        rma={archiveTarget}
        open={archiveTarget !== null}
        onOpenChange={(next) => {
          if (!next) setArchiveId(null);
        }}
        onConfirm={() => {
          if (!archiveTarget) return;
          applyRMAAction(archiveTarget.id, 'archive');
          setArchiveId(null);
          toast.success(`${archiveTarget.rmaNumber} archived`, {
            description: 'Find it with the Archived status filter.',
          });
        }}
      />
      <RMAVersionHistoryModal
        rma={rmas.find((r) => r.id === versionHistoryId) ?? null}
        onClose={() => setVersionHistoryId(null)}
      />
      <RMAInsightsPanel
        open={insightsPanelOpen}
        onOpenChange={setInsightsPanelOpen}
        activeKpis={activeKpiKeys}
        onToggleKpi={handleToggleKpi}
        rmas={rmas}
      />

      {/* Filters Dialog — centered modal that mirrors vendor-invoicing's
          InvoiceListScreen filters modal (chip rows per axis). Edits the
          same quick-filter state so the toolbar and modal stay in sync. */}
      <Dialog open={filtersDialogOpen} onOpenChange={setFiltersDialogOpen}>
        <DialogContent
          className="max-w-[560px] p-0 overflow-hidden border-0 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] bg-white flex flex-col max-h-[85vh]"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Filters</DialogTitle>
          <DialogDescription className="sr-only">
            Refine the returns list by status, vendor, point of contact, location, creator, and date range.
          </DialogDescription>

          {/* Header */}
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersDialogOpen(false)}
                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-[15px]" style={{ fontWeight: 600 }}>
                Filters
              </h2>
            </div>
            {activeFiltersCount > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {activeFiltersCount} active
              </span>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            <PillGroup
              label="Status"
              anySelected={statusQuick.length === 0}
              onAny={() => setStatusQuick([])}
              options={STATUS_QUICK_OPTIONS.map((s) => ({
                id: s,
                label: s,
                count: statusCounts[s] ?? 0,
                selected: statusQuick.includes(s),
                onToggle: () =>
                  setStatusQuick(
                    statusQuick.includes(s) ? statusQuick.filter((v) => v !== s) : [...statusQuick, s],
                  ),
              }))}
            />
            <PillGroup
              label="Tag"
              anySelected={tagQuick.length === 0}
              onAny={() => setTagQuick([])}
              options={TAG_QUICK_OPTIONS.map((t) => ({
                id: t,
                label: t,
                count: tagCounts[t] ?? 0,
                selected: tagQuick.includes(t),
                onToggle: () =>
                  setTagQuick(tagQuick.includes(t) ? tagQuick.filter((v) => v !== t) : [...tagQuick, t]),
              }))}
            />
            {/* A return is in its PO's currency. Few of them, so pills. */}
            <PillGroup
              label="Currency"
              anySelected={currencyQuick.length === 0}
              onAny={() => setCurrencyQuick([])}
              options={currencyOptions.map((c) => ({
                id: c,
                label: currencyOptionLabel(c),
                count: currencyCounts[c] ?? 0,
                selected: currencyQuick.includes(c),
                onToggle: () =>
                  setCurrencyQuick(currencyQuick.includes(c) ? currencyQuick.filter((v) => v !== c) : [...currencyQuick, c]),
              }))}
            />
            {/* Vendor / people / site facets are long lists, so they use the
                collapsed search-select (recently used first) instead of
                dumping every pill into the dialog. */}
            <SearchSelectFacet
              label="Vendor"
              options={vendorOptions}
              counts={vendorCounts}
              selected={vendorQuick}
              onChange={setVendorQuick}
              placeholder="Search vendors..."
              emptyText="No vendors found."
              recentsKey="rma-vendors"
            />
            <SearchSelectFacet
              label="Point of contact"
              options={pointOfContactOptions}
              counts={pointOfContactCounts}
              selected={pointOfContactQuick}
              onChange={setPointOfContactQuick}
              placeholder="Search contacts..."
              emptyText="No contacts found."
              recentsKey="rma-point-of-contact"
            />
            <SearchSelectFacet
              label="Created by"
              options={createdByOptions}
              counts={createdByCounts}
              selected={createdByQuick}
              onChange={setCreatedByQuick}
              placeholder="Search people..."
              emptyText="No people found."
              recentsKey="rma-created-by"
            />
            {/* Item, PO and receipt are all long code lists, so they take the
                same search-select rather than a wall of pills. */}
            <SearchSelectFacet
              label="Item"
              options={itemOptions}
              counts={itemCounts}
              selected={itemQuick}
              onChange={setItemQuick}
              placeholder="Search items..."
              emptyText="No items found."
              recentsKey="rma-items"
              avatars={false}
            />
            <SearchSelectFacet
              label="PO number"
              options={poOptions}
              counts={poCounts}
              selected={poQuick}
              onChange={setPoQuick}
              placeholder="Search PO numbers..."
              emptyText="No purchase orders found."
              recentsKey="rma-source-po"
              avatars={false}
            />
            <SearchSelectFacet
              label="Receiving document"
              options={receivingOptions}
              counts={receivingCounts}
              selected={receivingQuick}
              onChange={setReceivingQuick}
              placeholder="Search receiving documents..."
              emptyText="No receiving documents found."
              recentsKey="rma-receivings"
              avatars={false}
            />

            {/* Date range */}
            <div>
              <h3 className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Created date
              </h3>
              <DateRangeSection
                fromDate={dateFrom}
                toDate={dateTo}
                onFromChange={setDateFrom}
                onToChange={setDateTo}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-border flex items-center justify-between shrink-0">
            <button
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Clear all filters
            </button>
            <Button size="sm" onClick={() => setFiltersDialogOpen(false)} className="h-9">
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtMonthDay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtFull(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseISODate(d: string): Date | undefined {
  return d ? new Date(`${d}T00:00:00`) : undefined;
}

// The two-month range picker from the Procurement Planning sandbox: one
// field, one calendar, start and end picked in a single pass. The range is
// staged until Apply so a half-finished pick never reaches the filter.
function DateRangeSection({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
}: {
  fromDate: string;
  toDate: string;
  onFromChange: (d: string) => void;
  onToChange: (d: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);

  const from = parseISODate(fromDate);
  const to = parseISODate(toDate);
  const hasValue = Boolean(from || to);

  const summary = !hasValue
    ? 'Select date range'
    : from && to
      ? `${fmtMonthDay(from)} – ${fmtFull(to)}`
      : from
        ? `From ${fmtFull(from)}`
        : `Until ${fmtFull(to!)}`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reopening always starts from what is currently applied, so a
        // cancelled pick leaves nothing behind.
        if (next) setPendingRange(from ? { from, ...(to ? { to } : {}) } : undefined);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-10 w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 text-sm transition-colors cursor-pointer hover:border-primary/40 data-[state=open]:border-primary data-[state=open]:ring-1 data-[state=open]:ring-primary/20"
        >
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-4 h-4 shrink-0 text-slate-400" />
            <span className={`truncate tabular-nums ${hasValue ? 'text-foreground' : 'text-slate-400'}`} style={{ fontWeight: 500 }}>
              {summary}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 text-slate-400">
            {hasValue && (
              <span
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onFromChange('');
                  onToChange('');
                }}
              >
                <X className="size-3.5 hover:opacity-70 transition-opacity" />
              </span>
            )}
            <ChevronDown className="size-3.5 opacity-50" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        avoidCollisions
        collisionPadding={16}
        className="w-auto max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto p-0"
      >
        <div className="border-b border-slate-100 px-3 py-2">
          <p className="text-[12px] font-semibold text-slate-700">Custom date range</p>
          <p className="text-[11px] text-slate-400">
            {pendingRange?.from && !pendingRange.to
              ? 'Pick the end date'
              : 'Pick a start date, then an end date'}
          </p>
        </div>

        {/* Tighter cells than the default so two months clear the Filters
            dialog instead of covering it. */}
        <Calendar
          className="p-2 [--cell-size:1.75rem]"
          mode="range"
          showOutsideDays={false}
          selected={pendingRange}
          defaultMonth={pendingRange?.from ?? new Date()}
          numberOfMonths={2}
          onSelect={setPendingRange}
          autoFocus
        />

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2">
          <span className="text-[11px] tabular-nums text-slate-500">
            {pendingRange?.from && pendingRange.to
              ? `${fmtMonthDay(pendingRange.from)} – ${fmtFull(pendingRange.to)}`
              : pendingRange?.from
                ? `${fmtFull(pendingRange.from)} – …`
                : 'No range selected'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!pendingRange?.from || !pendingRange.to}
              onClick={() => {
                if (!pendingRange?.from || !pendingRange.to) return;
                onFromChange(toISODate(pendingRange.from));
                onToChange(toISODate(pendingRange.to));
                setOpen(false);
              }}
              className="rounded-md bg-[#0A77FF] px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Searchable facet — same section heading as PillGroup, but the body is
// vendor-invoicing's SearchSelectPeople so long lists stay collapsed.
function SearchSelectFacet({
  label,
  options,
  counts,
  selected,
  onChange,
  placeholder,
  emptyText,
  recentsKey,
  avatars = true,
}: {
  label: string;
  options: string[];
  counts: Record<string, number>;
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  emptyText: string;
  recentsKey: string;
  avatars?: boolean;
}) {
  return (
    <div>
      <h3 className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
        {label}
      </h3>
      <SearchSelectPeople
        options={options.map((v) => ({ id: v, name: v, count: counts[v] ?? 0 }))}
        selected={selected}
        onChange={onChange}
        placeholder={placeholder}
        emptyText={emptyText}
        recentsKey={recentsKey}
        avatars={avatars}
        recentsOnlyWhenIdle
      />
    </div>
  );
}

// Pill group used inside the Filters modal — one row per axis (Status,
// Vendor, etc.). Mirrors vendor-invoicing's Invoice Type / Invoice Status
// section pattern: "Any" reset chip + option chips with a count badge.
function PillGroup({
  label,
  anySelected,
  onAny,
  options,
}: {
  label: string;
  anySelected: boolean;
  onAny: () => void;
  options: { id: string; label: string; count: number; selected: boolean; onToggle: () => void }[];
}) {
  return (
    <div>
      <h3 className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
        {label}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onAny}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
            anySelected
              ? 'border-primary bg-accent text-primary'
              : 'border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
          style={{ fontWeight: 500 }}
        >
          Any
        </button>
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={opt.onToggle}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
              opt.selected
                ? 'border-primary bg-accent text-primary'
                : 'border-border bg-white text-foreground hover:bg-muted/50'
            }`}
            style={{ fontWeight: 500 }}
          >
            {opt.label}
            <span
              className="text-[10px] tabular-nums rounded-full px-1.5 py-px"
              style={{
                backgroundColor: opt.selected ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                color: opt.selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                fontWeight: 600,
              }}
            >
              {opt.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Compact multi-select chip — matches the quick-filter dropdowns used
// on the vendor-invoicing screen (label + count badge + popover).
function QuickFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  };
  const displayValue =
    selected.length === 0
      ? 'All'
      : selected.length === 1
        ? options.find((o) => o.id === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 h-8 px-2.5 rounded-md border bg-white text-[12px] transition-colors cursor-pointer ${
          selected.length > 0
            ? 'border-primary/30 text-primary'
            : 'border-border text-slate-700 hover:bg-slate-50'
        }`}
      >
        <span className="text-muted-foreground" style={{ fontWeight: 500 }}>
          {label}
        </span>
        <span style={{ fontWeight: 500 }}>{displayValue}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 left-0 top-full mt-1 min-w-[220px] max-h-64 overflow-auto rounded-md border border-border bg-white shadow-md py-1">
            {options.map((opt) => {
              const isChecked = selected.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggle(opt.id)}
                  className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-slate-50 flex items-center justify-between gap-2 ${
                    isChecked ? 'bg-blue-50/60 text-primary' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isChecked && <span className="text-primary">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
