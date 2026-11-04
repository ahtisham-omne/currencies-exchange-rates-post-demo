import { useTableStates, type DataTableEmptyConfig } from '@/app/components/data-table/DataTable';
import { TableEmptyState, CardSkeletonGrid, TableStaleBanner } from '@/app/components/ui/table-empty-state';
import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import dayjs from 'dayjs';
import {
  Search,
  X,
  Plus,
  ChartColumn,
  SlidersHorizontal,
  EyeOff,
  Inbox,
  MoreHorizontal,
  ListChecks,
  Truck,
  FileText,
  User,
  Calculator,
  Copy,
  Package,
  CalendarClock,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatMoneyText } from '@/app/components/payments/MoneyInput';
import { InsightsResetButton } from '@/app/components/InsightsResetButton';
import { InsightsRefresh } from '@/app/components/InsightsRefresh';
import { InsightsRangeMenu } from '@/app/components/InsightsRangeMenu';
import type { InsightsRange } from '@/app/components/InvoiceInsightsPanel';
import { DraggableKpiCard } from '@/app/components/DraggableKpiCard';
import { CustomerKpiIcon } from '@/app/components/customer/CustomerInvoiceInsightsPanel';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { DatePicker } from '@/app/components/ui/date-picker';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  DataTable,
  applyColumnFilters,
  isFilterActive,
  rowMatchesColumns,
  type ColumnDef,
  type ColumnFilterState,
  type SortConfig,
} from '@/app/components/data-table';
import { ColumnSelector, ColumnSelectorTrigger } from '@/app/components/ColumnSelector';
import { ViewDensityMenu } from '@/app/components/data-table/ViewDensityMenu';
import { MultiSelectFilter } from '@/app/components/data-table/MultiSelectFilter';
import { InvoiceActiveFiltersBar } from '@/app/components/InvoiceActiveFiltersBar';
import { BulkActionBar, type BulkAction } from '@/app/components/BulkActionBar';
import { SearchSelectPeople } from '@/app/components/SearchSelectPeople';
import { highlightAmount, highlightText } from '@/app/components/InvoiceDataTable';
import { actionToneClass, type ActionTone } from '@/app/lib/actionMenuTone';
import { formatUsDate } from '@/app/lib/dueBucket';
import { palette } from '@/styles/tokens';
import { billingByShipmentLine, type ReadyRow } from '@/app/data/ar/arBilling';
import type { CustomerInvoice } from '@/app/data/ar/mockCustomerInvoices';
import type { PaymentTermPreset } from '@/app/data/paymentTermPresets';
import { PaymentTermDetailsModal } from '@/app/components/PaymentTermDetailsModal';
import { CustomerTermName, renderCustomerTermCell } from '@/app/components/customer/CustomerTermName';
import {
  AdvanceStageHover,
  DateTooltip,
  LinesToBillHover,
  LinesToBillItemsCell,
  WaitingTooltip,
  ShipmentHover,
} from '@/app/components/customer/CustomerCellHovers';
import { findShipment } from '@/app/data/ar/mockCustomers';
import { arTermById } from '@/app/data/ar/arPaymentTerms';
import type { ArCreateEntry } from '@/app/components/customer/arCreateContract';
import {
  CustomerCell,
  SO_EXTERNAL_URL,
  mutedDot,
  openCustomerPartner,
} from '@/app/components/customer/CustomerInvoiceDataTable';
import { ReadyToInvoiceInsightsPanel } from '@/app/components/customer/ReadyToInvoiceInsightsPanel';
import {
  ALL_READY_INVOICE_KPI_DEFINITIONS,
  DEFAULT_READY_INVOICE_KPI_KEYS,
  computeReadyInvoiceKpi,
} from '@/app/components/customer/readyToInvoiceKpis';

/* ── Ready to Invoice (PRD §5.3) ───────────────────────────────────
 * The AR fork of the vendor payments "Invoices to pay" tab
 * (payments/ReadyToPayTable.tsx): same insights band, toolbar, quick
 * pills, Filters modal, bulk bar, active chips and table chrome. Only the
 * data (shipped lines not billed, advance stages fallen due) and the flow
 * (create an invoice from a row) differ. Rows can be billed together only
 * when they share a customer and currency and are all shipments; an
 * advance stage bills on its own. */

export function formatCurrencyAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SOURCE_TYPE_OPTIONS = [
  { id: 'shipment', label: 'Shipment' },
  { id: 'stage', label: 'Advance Stage' },
];

/** Days Waiting buckets, the Due Date rail's shape. */
const WAITING_BUCKETS: { id: string; label: string; test: (d: number) => boolean }[] = [
  { id: 'w7', label: 'Up to 7 Days', test: (d) => d <= 7 },
  { id: 'w14', label: '8 to 14 Days', test: (d) => d > 7 && d <= 14 },
  { id: 'w30', label: '15 to 30 Days', test: (d) => d > 14 && d <= 30 },
  { id: 'w30plus', label: 'Over 30 Days', test: (d) => d > 30 },
];
const waitingBucketOf = (d: number) => WAITING_BUCKETS.find((b) => b.test(d))?.id ?? 'w7';

const termNameOf = (r: ReadyRow) => arTermById(r.paymentTermId)?.name ?? '';
/** "Stage 1 of 2 · 30% at Order Confirmation" (no colon separator). */
const stageTextOf = (r: ReadyRow) => (r.stage ? r.stage.label.replace(/:\s*/, ' · ') : '');
/** Shipment number without its SHP prefix (the pill carries the type). */
const shipNo = (r: ReadyRow) => (r.shipmentNumber ?? '').replace(/^SHP\s*/i, '');
const sourceTextOf = (r: ReadyRow) => (r.kind === 'stage' ? 'Advance Stage' : `SHP ${shipNo(r)}`);
const waitingText = (days: number) => `${days} day${days === 1 ? '' : 's'}`;
function waitingCls(days: number): string {
  if (days > 30) return 'text-red-600';
  if (days > 14) return 'text-amber-600';
  return 'text-foreground';
}

/** What the Ship / Due Date means on this row (tooltip copy). */
function dateTooltipLines(r: ReadyRow): { text: string; color?: string; strong?: boolean }[] {
  if (r.kind === 'stage' && r.stage) {
    return [
      { text: `Fell due ${formatUsDate(r.date)}`, strong: true, color: '#0F172A' },
      { text: `The order reached ${r.stage.stage.trigger}, so stage ${r.stage.stage.index} of ${r.stage.total} can be billed.` },
    ];
  }
  return [
    { text: `Shipped ${formatUsDate(r.date)}`, strong: true, color: '#0F172A' },
    { text: 'The goods left on this date. Bill the shipped lines to start the customer payment clock.' },
  ];
}

/** Days Waiting tooltip copy: since when, and how urgent it reads. */
function waitingTooltipCopy(r: ReadyRow): { headline: string; note: string } {
  const headline = `${waitingText(r.waitingDays)} since ${r.kind === 'stage' ? 'the stage fell due' : 'it shipped'} on ${formatUsDate(r.date)}`;
  if (r.waitingDays > 30) return { headline, note: 'Over 30 days unbilled. Invoice it soon.' };
  if (r.waitingDays > 14) return { headline, note: 'Over two weeks unbilled.' };
  return { headline, note: 'Rows over 14 days read amber, over 30 days red.' };
}

const READY_COLUMN_CATALOG: { key: string; label: string }[] = [
  { key: 'source', label: 'Source Document' },
  { key: 'soNumber', label: 'Sales Order' },
  { key: 'customer', label: 'Customer' },
  { key: 'date', label: 'Ship / Due Date' },
  { key: 'valueNotBilled', label: 'Value Not Billed' },
  { key: 'waitingDays', label: 'Days Waiting' },
  { key: 'lineCount', label: 'Lines to Bill' },
  { key: 'stage', label: 'Stage' },
  { key: 'paymentTerm', label: 'Payment Term' },
  { key: 'currency', label: 'Currency' },
];
const LOCKED_COLUMNS = ['source'];
const DEFAULT_VISIBILITY: Record<string, boolean> = Object.fromEntries(READY_COLUMN_CATALOG.map((c) => [c.key, true]));

/* The source-type letter pill: the linked-records chip recipe. */
function SourcePill({ kind }: { kind: ReadyRow['kind'] }) {
  const s = kind === 'stage'
    ? { bg: palette.violet[100], fg: palette.violet[700], text: 'ADV' }
    : { bg: palette.green[100], fg: palette.green[700], text: 'SHP' };
  return (
    <span
      className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[4px] text-[10px] tracking-wide shrink-0"
      style={{ backgroundColor: s.bg, color: s.fg, fontWeight: 700 }}
    >
      {s.text}
    </span>
  );
}

function filterRowsByRange(rows: ReadyRow[], range: InsightsRange, custom?: { from: string; to: string }): ReadyRow[] {
  const days: Partial<Record<InsightsRange, number>> = { last_7: 7, last_30: 30, last_90: 90, last_365: 365 };
  if (range === 'custom') {
    return rows.filter((r) => (!custom?.from || r.date >= custom.from) && (!custom?.to || r.date <= custom.to));
  }
  const n = days[range];
  if (!n) return rows;
  const cutoff = dayjs().subtract(n, 'day').format('YYYY-MM-DD');
  return rows.filter((r) => r.date >= cutoff);
}

interface ReadyToInvoiceTableProps {
  rows: ReadyRow[];
  /** False hides every create control (no permission to bill shipments or orders). */
  canCreate: boolean;
  onCreateInvoice: (entry?: ArCreateEntry) => void;
  /** Every customer invoice: the Lines To Bill hover reads the quantity
   *  still available per shipment line from them. */
  invoices?: CustomerInvoice[];
}

export function ReadyToInvoiceTable({ rows, canCreate, onCreateInvoice, invoices }: ReadyToInvoiceTableProps) {
  const billing = useMemo(() => billingByShipmentLine(invoices ?? []), [invoices]);
  // "View Payment Term" opens the same details modal the term cell does.
  const [termModal, setTermModal] = useState<PaymentTermPreset | null>(null);
  // ── Performance Insights (vendor Invoices to pay recipe: All time
  // default, so the cards describe the queue below them) ──
  const [insightsRange, setInsightsRange] = useState<InsightsRange>('all_time');
  const [insightsCustom, setInsightsCustom] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const rangedRows = filterRowsByRange(rows, insightsRange, insightsRange === 'custom' ? insightsCustom : undefined);
  const READY_KPI_STORAGE_KEY = 'omnesoft:ready-to-invoice:active-widgets';
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  const [activeKpiKeys, setActiveKpiKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(READY_KPI_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as string[];
    } catch { /* ignore */ }
    return DEFAULT_READY_INVOICE_KPI_KEYS;
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
    setActiveKpiKeys(DEFAULT_READY_INVOICE_KPI_KEYS);
    persistKpis(DEFAULT_READY_INVOICE_KPI_KEYS);
    toast.info('Insights reset', { description: 'Restored the default widgets and order.' });
  };
  const insightsDirty = activeKpiKeys.join(',') !== DEFAULT_READY_INVOICE_KPI_KEYS.join(',');
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

  // ── Table state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  const DENSITY_STORAGE_KEY = 'omnesoft:ready-to-invoice:density';
  const [density, setDensityRaw] = useState<'condensed' | 'comfort' | 'card'>(() => {
    try {
      const v = localStorage.getItem(DENSITY_STORAGE_KEY);
      if (v === 'condensed' || v === 'comfort' || v === 'card') return v;
    } catch { /* ignore */ }
    return 'condensed';
  });
  const setDensity = (next: 'condensed' | 'comfort' | 'card') => {
    setDensityRaw(next);
    try { localStorage.setItem(DENSITY_STORAGE_KEY, next); } catch { /* ignore */ }
  };
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [columnOrder, setColumnOrder] = useState<string[]>(() => READY_COLUMN_CATALOG.map((c) => c.key));
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => ({ ...DEFAULT_VISIBILITY }));
  const [columnResetKey, setColumnResetKey] = useState(0);
  const visibleColumnCount = READY_COLUMN_CATALOG.filter((c) => columnVisibility[c.key] !== false).length;
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'date', direction: 'asc' });
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(() => new Set(['source']));

  // ── Quick filters (toolbar pills) + modal-only facets ──
  const [sourceQuick, setSourceQuick] = useState<string[]>([]);
  const [customerQuick, setCustomerQuick] = useState<string[]>([]);
  const [soQuick, setSoQuick] = useState<string[]>([]);
  const [termQuick, setTermQuick] = useState<string[]>([]);
  const [waitingQuick, setWaitingQuick] = useState<string[]>([]);
  const [currencyQuick, setCurrencyQuick] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [valueMin, setValueMin] = useState('');
  const [valueMax, setValueMax] = useState('');

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  // Rows billed elsewhere drop out of the selection.
  const liveSelected = selectedIds.filter((id) => byId.has(id));
  const selectedRows = liveSelected.map((id) => byId.get(id)!);
  const selectedValue = selectedRows.reduce((s, r) => s + r.valueNotBilled, 0);

  /** Selection rule: one customer and currency, shipments only; an
   *  advance stage bills on its own. Incompatible picks are left out
   *  with a toast naming the rule (never silently). */
  const applySelection = (next: Set<string>) => {
    const kept = liveSelected.filter((id) => next.has(id));
    const added = Array.from(next).filter((id) => !liveSelected.includes(id) && byId.has(id));
    const result = [...kept];
    let skipped = 0;
    for (const id of added) {
      const row = byId.get(id)!;
      const anchor = result.length > 0 ? byId.get(result[0])! : null;
      if (!anchor) { result.push(id); continue; }
      if (anchor.kind === 'stage' || row.kind === 'stage' || anchor.customer !== row.customer || anchor.currency !== row.currency) {
        skipped += 1;
        continue;
      }
      result.push(id);
    }
    if (skipped > 0) {
      toast.info(`${skipped} row${skipped === 1 ? '' : 's'} left out of the selection`, {
        description: 'One invoice bills shipments of one customer and currency. Advance stages bill one at a time.',
      });
    }
    setSelectedIds(result);
  };
  const toggleOne = (id: string) => {
    const next = new Set(liveSelected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    applySelection(next);
  };

  // ── Create flows ──
  const createForRow = (r: ReadyRow) => {
    if (r.kind === 'stage' && r.stage) {
      onCreateInvoice({
        seed: {
          kind: 'Advance Invoice',
          customerName: r.customer,
          source: { type: 'so', soNumber: r.soNumber },
          stageIndex: r.stage.stage.index,
        },
      });
      return;
    }
    if (!r.shipmentNumber) return;
    onCreateInvoice({
      seed: {
        kind: 'Shipment Invoice',
        customerName: r.customer,
        shipments: [{ shipmentNumber: r.shipmentNumber }],
        paymentTermId: r.paymentTermId,
      },
    });
  };
  const createFromSelection = () => {
    if (selectedRows.length === 1) {
      createForRow(selectedRows[0]);
      return;
    }
    const ship = selectedRows.filter((r) => r.kind === 'shipment' && r.shipmentNumber);
    if (ship.length === 0) return;
    const customerName = ship[0].customer;
    const terms = new Set(ship.map((r) => r.paymentTermId));
    if (terms.size === 1) {
      onCreateInvoice({
        seed: {
          kind: 'Shipment Invoice',
          customerName,
          shipments: ship.map((r) => ({ shipmentNumber: r.shipmentNumber! })),
          paymentTermId: ship[0].paymentTermId,
        },
      });
    } else {
      // Mixed order terms: the selection step runs so the BR-003 term gate can ask.
      onCreateInvoice({ kind: 'Shipment Invoice', customerName, shipmentNumbers: ship.map((r) => r.shipmentNumber!) });
    }
  };
  const viewSalesOrder = () => window.open(SO_EXTERNAL_URL, '_blank', 'noopener,noreferrer');
  const viewShipment = (r: ReadyRow) =>
    toast.info(sourceTextOf(r), { description: 'Shipment pages open from the inventory suite. This reference is display-only here.' });
  const viewTerm = (r: ReadyRow) => {
    const term = arTermById(r.paymentTermId);
    if (term) setTermModal(term);
    else toast.info('No payment term', { description: 'This order carries no payment term.' });
  };
  const copyReference = (r: ReadyRow) => {
    const ref = r.kind === 'stage' ? `SO ${r.soNumber} · ${stageTextOf(r)}` : sourceTextOf(r);
    try { void navigator.clipboard?.writeText(ref); } catch { /* ignore */ }
    toast.success('Reference copied', { description: ref });
  };

  /* Row menu: the vendor row-menu recipe (category groups with dividers,
   * icon + label, actionToneClass tones). */
  const rowMenuGroups = (r: ReadyRow): { key: string; label: string; icon: typeof Plus; run: () => void; tone?: ActionTone }[][] => {
    if (r.kind === 'stage') {
      return [
        ...(canCreate ? [[{ key: 'createAdvance', label: 'Create Advance Invoice', icon: Package, run: () => createForRow(r), tone: 'positive' as const }]] : []),
        [
          { key: 'viewSo', label: 'View Sales Order', icon: FileText, run: viewSalesOrder },
          { key: 'viewTerm', label: 'View Payment Term', icon: CalendarClock, run: () => viewTerm(r) },
          { key: 'viewCustomer', label: 'View Customer', icon: User, run: () => openCustomerPartner(r.customer) },
        ],
        [{ key: 'copy', label: 'Copy Reference', icon: Copy, run: () => copyReference(r) }],
      ];
    }
    return [
      ...(canCreate
        ? [[
            { key: 'create', label: 'Create Invoice', icon: Plus, run: () => createForRow(r), tone: 'positive' as const },
            {
              key: 'billLines',
              label: 'Bill Selected Lines…',
              icon: ListChecks,
              tone: 'positive' as const,
              run: () => onCreateInvoice({ kind: 'Shipment Invoice', customerName: r.customer, shipmentNumber: r.shipmentNumber }),
            },
          ]]
        : []),
      [
        { key: 'viewShipment', label: 'View Shipment', icon: Truck, run: () => viewShipment(r) },
        { key: 'viewSo', label: 'View Sales Order', icon: FileText, run: viewSalesOrder },
        { key: 'viewCustomer', label: 'View Customer', icon: User, run: () => openCustomerPartner(r.customer) },
      ],
      [
        ...(canCreate
          ? [{ key: 'standalone', label: 'Add Charges as Standalone', icon: Calculator, run: () => onCreateInvoice({ kind: 'Standalone', customerName: r.customer }) }]
          : []),
        { key: 'copy', label: 'Copy Reference', icon: Copy, run: () => copyReference(r) },
      ],
    ];
  };

  const renderRowMenu = (r: ReadyRow, triggerClass = 'h-8 w-8 p-0 hover:bg-muted') => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" className={triggerClass} aria-label={`Actions for ${sourceTextOf(r)}`}>
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[230px]" onClick={(e) => e.stopPropagation()}>
        {rowMenuGroups(r).map((group, gi) => (
          <Fragment key={gi}>
            {gi > 0 && <DropdownMenuSeparator />}
            {group.map((a) => {
              const cls = actionToneClass(a.tone ?? 'neutral');
              const Icon = a.icon;
              return (
                <DropdownMenuItem
                  key={a.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    a.run();
                  }}
                  className={cls.item}
                >
                  <Icon className={`w-4 h-4 mr-2 ${cls.icon}`} />
                  {a.label}
                </DropdownMenuItem>
              );
            })}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // ── Columns (the vendor ColumnDef contract) ──
  const columns = useMemo<ColumnDef<ReadyRow>[]>(() => [
    {
      key: 'source',
      label: 'Source Document',
      minWidth: 190,
      defaultWidth: 210,
      sortable: true,
      locked: true,
      sticky: 'left',
      filterable: false,
      getValue: (r) => sourceTextOf(r),
      searchText: (r) => (r.kind === 'stage' ? 'Advance Stage' : shipNo(r)),
      // Hover: the shipment summary (the vendor receiving-document quick
      // card) or, on ADV rows, the stage that fell due.
      render: (r, { density: d, searchQuery: q }) => {
        const cell = (
          <span className="flex min-w-0 items-center gap-1.5 cursor-default">
            <SourcePill kind={r.kind} />
            <span className={`truncate whitespace-nowrap text-slate-800 ${d === 'comfort' ? 'text-[13px]' : 'text-sm'}`} style={{ fontWeight: 400 }}>
              {r.kind === 'stage' ? highlightText('Advance Stage', q) : highlightText(shipNo(r), q)}
            </span>
          </span>
        );
        if (r.kind === 'stage' && r.stage) {
          return <AdvanceStageHover stage={r.stage} soNumber={r.soNumber} currency={r.currency}>{cell}</AdvanceStageHover>;
        }
        return r.shipmentNumber ? <ShipmentHover shipmentNumber={r.shipmentNumber}>{cell}</ShipmentHover> : cell;
      },
    },
    {
      key: 'soNumber',
      label: 'Sales Order',
      minWidth: 130,
      defaultWidth: 150,
      sortable: true,
      filterType: 'multiselect',
      uniqueValues: (list) => Array.from(new Set(list.map((r) => r.soNumber))).sort(),
      getValue: (r) => r.soNumber,
      render: (r, { searchQuery: q }) => (
        <a
          href={SO_EXTERNAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 group/lr"
        >
          <span
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[4px] text-[10px] tracking-wide"
            style={{ backgroundColor: palette.blue[100], color: palette.blue[700], fontWeight: 700 }}
          >
            SO
          </span>
          <span className="text-foreground group-hover/lr:text-primary group-hover/lr:underline transition-colors" style={{ fontWeight: 400 }}>
            {highlightText(r.soNumber, q)}
          </span>
        </a>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      minWidth: 200,
      defaultWidth: 240,
      sortable: true,
      filterType: 'multiselect',
      uniqueValues: (list) => Array.from(new Set(list.map((r) => r.customer))).sort(),
      getValue: (r) => r.customer,
      render: (r, ctx) => <CustomerCell customer={r.customer} density={ctx.density} searchQuery={ctx.searchQuery} />,
    },
    {
      key: 'stage',
      label: 'Stage',
      minWidth: 200,
      defaultWidth: 260,
      sortable: true,
      filterType: 'text',
      getValue: (r) => stageTextOf(r),
      // Hover: the term card with this row's stage picked on the slice
      // chips; click opens the term details (TermName recipe).
      render: (r, { searchQuery: q }) => {
        if (r.kind !== 'stage') return mutedDot();
        const term = arTermById(r.paymentTermId);
        if (!term || !r.stage) {
          return <span className="block truncate text-foreground" style={{ fontWeight: 400 }}>{highlightText(stageTextOf(r), q)}</span>;
        }
        return (
          <span className="flex items-center gap-2 flex-nowrap whitespace-nowrap overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <CustomerTermName term={term} label={stageTextOf(r)} stageIndex={r.stage.stage.index} searchQuery={q} />
          </span>
        );
      },
    },
    {
      key: 'paymentTerm',
      label: 'Payment Term',
      minWidth: 200,
      defaultWidth: 290,
      sortable: true,
      filterType: 'multiselect',
      uniqueValues: (list) => Array.from(new Set(list.map(termNameOf).filter(Boolean))).sort(),
      getValue: (r) => termNameOf(r),
      // Vendor TermName parity: hover card + details modal.
      render: (r, { searchQuery: q }) => renderCustomerTermCell(r.paymentTermId, termNameOf(r), q, mutedDot()),
    },
    {
      key: 'date',
      label: 'Ship / Due Date',
      tooltip: 'The ship date, or the date the advance stage fell due.',
      minWidth: 140,
      defaultWidth: 160,
      sortable: true,
      filterType: 'date',
      getValue: (r) => r.date,
      searchText: (r) => formatUsDate(r.date),
      render: (r, { searchQuery: q }) => (
        <DateTooltip lines={dateTooltipLines(r)}>
          <span className="text-muted-foreground whitespace-nowrap cursor-help">{highlightText(formatUsDate(r.date), q)}</span>
        </DateTooltip>
      ),
    },
    {
      key: 'lineCount',
      label: 'Lines to Bill',
      minWidth: 200,
      defaultWidth: 230,
      sortable: true,
      filterType: 'range',
      getValue: (r) => (r.kind === 'stage' ? null : r.lineCount),
      // Searchable by count and by every item code still open to bill.
      searchText: (r) => {
        if (r.kind === 'stage') return '';
        const hit = r.shipmentNumber ? findShipment(r.shipmentNumber) : undefined;
        const skus = hit ? hit.shipment.lines.map((l) => l.sku).join(' ') : '';
        return `${r.lineCount} ${skus}`;
      },
      // The partner PO Items cell: first item + "+N more" overflow list.
      render: (r, { searchQuery: q }) =>
        r.kind === 'stage' ? mutedDot() : (
          <LinesToBillItemsCell
            shipmentNumber={r.shipmentNumber}
            billing={billing}
            currency={r.currency}
            lineCount={r.lineCount}
            searchQuery={q}
          />
        ),
    },
    {
      key: 'valueNotBilled',
      label: 'Value Not Billed',
      minWidth: 140,
      defaultWidth: 160,
      sortable: true,
      filterType: 'range',
      getValue: (r) => r.valueNotBilled,
      searchText: (r) => formatCurrencyAmount(r.valueNotBilled, r.currency),
      render: (r, { searchQuery: q }) => (
        <span className="text-foreground" style={{ fontWeight: 400 }}>
          {highlightAmount(formatCurrencyAmount(r.valueNotBilled, r.currency), q)}
        </span>
      ),
    },
    {
      key: 'waitingDays',
      label: 'Days Waiting',
      tooltip: 'Days since the ship date or the stage date.',
      minWidth: 120,
      defaultWidth: 130,
      sortable: true,
      filterType: 'range',
      getValue: (r) => r.waitingDays,
      searchText: (r) => waitingText(r.waitingDays),
      render: (r, { searchQuery: q }) => (
        <WaitingTooltip days={r.waitingDays} {...waitingTooltipCopy(r)}>
          <span className={`whitespace-nowrap cursor-help ${waitingCls(r.waitingDays)}`} style={{ fontWeight: 400 }}>
            {highlightText(waitingText(r.waitingDays), q)}
          </span>
        </WaitingTooltip>
      ),
    },
    {
      key: 'currency',
      label: 'Currency',
      minWidth: 90,
      defaultWidth: 120,
      sortable: true,
      filterType: 'multiselect',
      uniqueValues: (list) => Array.from(new Set(list.map((r) => r.currency))).sort(),
      getValue: (r) => r.currency,
      render: (r, { searchQuery: q }) => <span className="text-muted-foreground">{highlightText(r.currency, q)}</span>,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [canCreate, rows, billing]);
  const colByKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);

  // ── Counts for pills and the modal (whole queue) ──
  const sourceCounts: Record<string, number> = {};
  const customerCounts: Record<string, number> = {};
  const soCounts: Record<string, number> = {};
  const termCounts: Record<string, number> = {};
  const waitingCounts: Record<string, number> = {};
  const currencyCounts: Record<string, number> = {};
  rows.forEach((r) => {
    sourceCounts[r.kind] = (sourceCounts[r.kind] ?? 0) + 1;
    customerCounts[r.customer] = (customerCounts[r.customer] ?? 0) + 1;
    soCounts[r.soNumber] = (soCounts[r.soNumber] ?? 0) + 1;
    const t = termNameOf(r);
    if (t) termCounts[t] = (termCounts[t] ?? 0) + 1;
    const w = waitingBucketOf(r.waitingDays);
    waitingCounts[w] = (waitingCounts[w] ?? 0) + 1;
    currencyCounts[r.currency] = (currencyCounts[r.currency] ?? 0) + 1;
  });
  const customerOptions = Object.keys(customerCounts).sort();
  const soOptions = Object.keys(soCounts).sort();
  const termOptions = Object.keys(termCounts).sort();
  const currencyOptions = Object.keys(currencyCounts).sort();

  // ── Filter + search + sort ──
  const searched = rows.filter((r) => {
    if (sourceQuick.length > 0 && !sourceQuick.includes(r.kind)) return false;
    if (customerQuick.length > 0 && !customerQuick.includes(r.customer)) return false;
    if (soQuick.length > 0 && !soQuick.includes(r.soNumber)) return false;
    if (termQuick.length > 0 && !termQuick.includes(termNameOf(r))) return false;
    if (waitingQuick.length > 0 && !waitingQuick.includes(waitingBucketOf(r.waitingDays))) return false;
    if (currencyQuick.length > 0 && !currencyQuick.includes(r.currency)) return false;
    if (dateRange.from && r.date < dateRange.from) return false;
    if (dateRange.to && r.date > dateRange.to) return false;
    if (valueMin !== '' && r.valueNotBilled < Number(valueMin)) return false;
    if (valueMax !== '' && r.valueNotBilled > Number(valueMax)) return false;
    const trimmed = searchQuery.trim();
    if (!trimmed) return true;
    const q = trimmed.toLowerCase();
    const digits = q.replace(/[^0-9.]/g, '');
    return (
      [r.shipmentNumber ?? '', r.soNumber, r.customer, stageTextOf(r), termNameOf(r)].some((h) => h.toLowerCase().includes(q)) ||
      rowMatchesColumns(r, columns, trimmed) ||
      (digits.length >= 2 && (r.valueNotBilled.toFixed(2).includes(digits) || String(Math.round(r.valueNotBilled)).includes(digits)))
    );
  });
  let processed = applyColumnFilters(searched, Object.values(columnFilters), (row, key) => colByKey.get(key)?.getValue(row));
  if (sortConfig) {
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const def = colByKey.get(sortConfig.key);
    processed = [...processed].sort((a, b) => {
      const av = def?.getValue(a);
      const bv = def?.getValue(b);
      if (av == null && bv == null) return 0;
      if (av == null) return -dir;
      if (bv == null) return dir;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }
  const sortedFiltered = processed;
  const paginated = sortedFiltered.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

  // Filters badge counts ONLY modal-only facets (10/26 standard).
  const activeFilterCount =
    (currencyQuick.length > 0 ? 1 : 0) +
    (dateRange.from || dateRange.to ? 1 : 0) +
    (valueMin || valueMax ? 1 : 0);
  const clearModalFilters = () => {
    setSourceQuick([]);
    setCustomerQuick([]);
    setSoQuick([]);
    setWaitingQuick([]);
    setCurrencyQuick([]);
    setDateRange({ from: '', to: '' });
    setValueMin('');
    setValueMax('');
    setCurrentPage(1);
  };
  const clearEverything = () => {
    clearModalFilters();
    setTermQuick([]);
    setColumnFilters({});
    setSearchQuery('');
  };

  const readyCtx = { selectedCount: liveSelected.length, selectedValue };
  const activeKpiCards = activeKpiKeys
    .map((key) => {
      const def = ALL_READY_INVOICE_KPI_DEFINITIONS.find((d) => d.key === key);
      if (!def) return null;
      const { value, sub } = computeReadyInvoiceKpi(key, rangedRows, readyCtx);
      return { def, value, sub };
    })
    .filter((c): c is { def: (typeof ALL_READY_INVOICE_KPI_DEFINITIONS)[number]; value: string; sub: string } => !!c);

  const pillBtn = (on: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
      on ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-foreground hover:bg-muted/50'
    }`;
  const allBtn = (on: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
      on ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground'
    }`;
  const countBadge = (on: boolean, n: number) => (
    <span
      className="text-[10px] rounded-full px-1.5 py-px"
      style={{
        backgroundColor: on ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
        color: on ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
        fontWeight: 600,
      }}
    >
      {n}
    </span>
  );
  const pillGroup = (
    options: { id: string; label: string; count: number }[],
    selected: string[],
    set: (next: string[]) => void,
  ) => (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => { set([]); setCurrentPage(1); }} className={allBtn(selected.length === 0)} style={{ fontWeight: 500 }}>
        All
      </button>
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => { set(on ? selected.filter((x) => x !== o.id) : [...selected, o.id]); setCurrentPage(1); }}
            className={pillBtn(on)}
            style={{ fontWeight: 500 }}
          >
            {o.label}
            {countBadge(on, o.count)}
          </button>
        );
      })}
    </div>
  );

  // Table Empty & Error States Standard v1.0 (11/3/26).
  const emptyConfig: DataTableEmptyConfig = {
    entity: { singular: 'row', plural: 'rows' },
    totalCount: rows.length,
    filterCount:
      sourceQuick.length +
      customerQuick.length +
      soQuick.length +
      termQuick.length +
      waitingQuick.length +
      currencyQuick.length +
      (dateRange.from || dateRange.to ? 1 : 0) +
      (valueMin || valueMax ? 1 : 0) +
      Object.keys(columnFilters).length,
    onClearSearch: () => { setSearchQuery(''); setCurrentPage(1); },
    onClearFilters: () => { clearModalFilters(); setTermQuick([]); setColumnFilters({}); },
    onSearch: (q) => { setSearchQuery(q); setCurrentPage(1); },
    // No-data copy only; the filters state keeps the standard wording.
    ...(rows.length === 0
      ? { title: 'Nothing waiting to be billed', description: 'Shipped goods and advance stages that fall due show up here, ready to invoice.' }
      : {}),
  };
  const cardStates = useTableStates<ReadyRow>({
    config: emptyConfig,
    pageRows: paginated,
    totalRows: sortedFiltered.length,
    searchQuery,
    suggestionRows: rows,
    columns,
    onFirstPage: () => setCurrentPage(1),
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {termModal && (
        <PaymentTermDetailsModal termLabel={termModal.name} term={termModal} onClose={() => setTermModal(null)} />
      )}
      {/* Performance Insights — the vendor Invoices to pay band. */}
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
                aria-label="Hide the insights band"
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
                  renderIcon={(name, props) => <CustomerKpiIcon name={name} {...props} />}
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

      <ReadyToInvoiceInsightsPanel
        open={insightsPanelOpen}
        onOpenChange={setInsightsPanelOpen}
        activeKpis={activeKpiKeys}
        onToggleKpi={handleToggleKpi}
        ready={rangedRows}
        ctx={readyCtx}
      />

      {/* Filters modal — the vendor listing's partner chrome. */}
      <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <DialogContent
          className="max-w-[560px] p-0 overflow-hidden border-0 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] bg-white flex flex-col max-h-[85vh]"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Filters</DialogTitle>
          <DialogDescription className="sr-only">
            Refine the rows waiting to be billed by source type, customer, sales order, date, value, and days waiting.
          </DialogDescription>
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
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            <div>
              <p className="text-[13px] mb-1" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Source Type</p>
              <p className="text-[11px] text-muted-foreground mb-2.5">Select which source documents to show.</p>
              {pillGroup(SOURCE_TYPE_OPTIONS.map((o) => ({ ...o, count: sourceCounts[o.id] ?? 0 })), sourceQuick, setSourceQuick)}
            </div>
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Customer</p>
              <SearchSelectPeople
                options={customerOptions.map((c) => ({ id: c, name: c, count: customerCounts[c] ?? 0 }))}
                selected={customerQuick}
                onChange={(next) => { setCustomerQuick(next); setCurrentPage(1); }}
                placeholder="Search customers..."
                emptyText="No customers found."
                recentsKey="ready-to-invoice-customers"
              />
            </div>
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Sales Order</p>
              <SearchSelectPeople
                options={soOptions.map((so) => ({ id: so, name: so, count: soCounts[so] ?? 0 }))}
                selected={soQuick}
                onChange={(next) => { setSoQuick(next); setCurrentPage(1); }}
                placeholder="Search sales orders..."
                emptyText="No sales orders found."
                recentsKey="ready-to-invoice-sales-orders"
                variant="plain"
              />
            </div>
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Ship / Due Date</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>From</Label>
                  <DatePicker
                    value={dateRange.from}
                    onChange={(v) => { setDateRange({ ...dateRange, from: v }); setCurrentPage(1); }}
                    placeholder="From"
                    className="h-9 border-border/80"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>To</Label>
                  <DatePicker
                    value={dateRange.to}
                    onChange={(v) => { setDateRange({ ...dateRange, to: v }); setCurrentPage(1); }}
                    placeholder="To"
                    align="end"
                    className="h-9 border-border/80"
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Value Not Billed</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Min</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 ">$</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="h-9 text-sm bg-white pl-7 border-border/80"
                      value={formatMoneyText(valueMin)}
                      onChange={(e) => { setValueMin(e.target.value.replace(/[^\d.]/g, '')); setCurrentPage(1); }}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Max</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 ">$</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="No limit"
                      className="h-9 text-sm bg-white pl-7 border-border/80"
                      value={formatMoneyText(valueMax)}
                      onChange={(e) => { setValueMax(e.target.value.replace(/[^\d.]/g, '')); setCurrentPage(1); }}
                    />
                  </div>
                </div>
              </div>
              {valueMin !== '' && valueMax !== '' && Number(valueMin) > Number(valueMax) && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-rose-600" style={{ fontWeight: 500 }}>
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  The minimum is above the maximum, so no row can match. Swap them to see results.
                </p>
              )}
            </div>
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Days Waiting</p>
              {pillGroup(WAITING_BUCKETS.map((b) => ({ id: b.id, label: b.label, count: waitingCounts[b.id] ?? 0 })), waitingQuick, setWaitingQuick)}
            </div>
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Currency</p>
              {pillGroup(currencyOptions.map((c) => ({ id: c, label: c, count: currencyCounts[c] ?? 0 })), currencyQuick, setCurrencyQuick)}
            </div>
          </div>
          <div className="flex items-center justify-between px-5 h-14 border-t border-border/60 shrink-0">
            <button
              type="button"
              onClick={clearModalFilters}
              className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Clear All
            </button>
            <Button size="sm" className="h-9 px-5 text-[13px]" onClick={() => setAdvancedOpen(false)}>
              Show {sortedFiltered.length} row{sortedFiltered.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unified table container */}
      <div className="border border-border rounded-xl bg-card flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Search + Filters left, counter + Insights + density + Columns right. */}
          <div data-col-hide-edge className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                <Input
                  placeholder="Search shipment, sales order, customer..."
                  className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setAdvancedOpen(true)}
                className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 ${
                  activeFilterCount > 0 ? 'text-primary border-primary/30' : 'text-foreground border-border/80'
                }`}
              >
                <SlidersHorizontal className={`w-3.5 h-3.5 ${activeFilterCount > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
                {activeFilterCount > 0 && (
                  <span
                    className="ml-0.5 min-w-[18px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                    style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 600 }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                {sortedFiltered.length === rows.length ? (
                  <>
                    <span className="text-foreground">{rows.length}</span>
                    <span className="text-muted-foreground/70"> waiting</span>
                  </>
                ) : (
                  <>
                    <span className="text-foreground">{sortedFiltered.length}</span>
                    <span className="text-muted-foreground/60"> of </span>
                    <span className="text-muted-foreground">{rows.length}</span>
                    <span className="text-muted-foreground/70"> waiting</span>
                  </>
                )}
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
                <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Insights</span>
                <span
                  className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]"
                  style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--primary))', fontWeight: 600 }}
                >
                  {activeKpiKeys.length}
                </span>
              </button>
              <ViewDensityMenu
                density={density}
                onDensityChange={setDensity}
                cardSize={cardSize}
                onCardSizeChange={setCardSize}
                disabledCardSizes={['large']}
              />
              <ColumnSelectorTrigger
                visibleCount={visibleColumnCount}
                active={columnDrawerOpen}
                onClick={() => setColumnDrawerOpen((o) => !o)}
                disabled={density === 'card'}
              />
            </div>
          </div>

          {/* Bulk action bar — replaces the pill row when rows are selected. */}
          {liveSelected.length > 0 && (() => {
            const single = selectedRows.length === 1 ? selectedRows[0] : null;
            const actions: BulkAction[] = canCreate
              ? [{
                  key: 'create',
                  label: single?.kind === 'stage'
                    ? `Create Advance Invoice · ${formatCurrencyAmount(selectedValue, single.currency)}`
                    : `Create One Invoice · ${formatCurrencyAmount(selectedValue, selectedRows[0]?.currency ?? 'USD')}`,
                  icon: Plus,
                  tone: 'primary',
                  onClick: createFromSelection,
                }]
              : [];
            return (
              <BulkActionBar
                count={liveSelected.length}
                noun="row"
                actions={actions}
                onClear={() => setSelectedIds([])}
              />
            );
          })()}

          {/* Quick-filter pills — hidden while the bulk bar is active. */}
          <div className={`flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0 ${liveSelected.length > 0 ? 'hidden' : ''}`}>
            <MultiSelectFilter
              label="Source Type"
              options={SOURCE_TYPE_OPTIONS.map((o) => ({ ...o, count: sourceCounts[o.id] ?? 0 }))}
              selected={sourceQuick}
              onChange={(next) => { setSourceQuick(next); setCurrentPage(1); }}
            />
            <MultiSelectFilter
              label="Customer"
              searchable
              options={customerOptions.map((c) => ({ id: c, label: c, count: customerCounts[c] ?? 0 }))}
              selected={customerQuick}
              onChange={(next) => { setCustomerQuick(next); setCurrentPage(1); }}
            />
            <MultiSelectFilter
              label="Sales Order"
              searchable
              options={soOptions.map((so) => ({ id: so, label: so, count: soCounts[so] ?? 0 }))}
              selected={soQuick}
              onChange={(next) => { setSoQuick(next); setCurrentPage(1); }}
            />
            <MultiSelectFilter
              label="Payment Term"
              searchable
              options={termOptions.map((t) => ({ id: t, label: t, count: termCounts[t] ?? 0 }))}
              selected={termQuick}
              onChange={(next) => { setTermQuick(next); setCurrentPage(1); }}
            />
            <MultiSelectFilter
              label="Days Waiting"
              options={WAITING_BUCKETS.map((b) => ({ id: b.id, label: b.label, count: waitingCounts[b.id] ?? 0 }))}
              selected={waitingQuick}
              onChange={(next) => { setWaitingQuick(next); setCurrentPage(1); }}
            />
          </div>

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
            {density === 'card' ? (
              <div className="flex-1 overflow-auto p-4 bg-slate-100/70">
                {cardStates.loadState === 'stale' && (
                  <div className="-mx-4 -mt-4 mb-4">
                    <TableStaleBanner entity={emptyConfig.entity} lastUpdated={cardStates.tableLoad.lastUpdated} onRetry={cardStates.tableLoad.retry} retrying={cardStates.tableLoad.retrying} />
                  </div>
                )}
                {cardStates.loadState === 'loading' && <CardSkeletonGrid />}
                <div
                  className={`grid gap-3 ${
                    cardSize === 'small'
                      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  }`}
                >
                  {cardStates.loadState !== 'loading' && cardStates.emptyProps && (
                    <div className="col-span-full bg-white border border-border rounded-xl">
                      <TableEmptyState {...cardStates.emptyProps} />
                    </div>
                  )}
                  {(cardStates.loadState === 'loading' || cardStates.emptyProps ? [] : paginated).map((r) => {
                    const isStage = r.kind === 'stage';
                    const accent = isStage
                      ? { bg: palette.violet[50], fg: palette.violet[700], border: palette.violet[300] }
                      : { bg: palette.blue[50], fg: palette.blue[700], border: palette.blue[200] };
                    const TIcon = isStage ? Wallet : Truck;
                    return (
                      <div
                        key={r.id}
                        style={{ ['--card-accent' as string]: accent.border }}
                        className={`bg-white border border-border rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[var(--card-accent)] hover:shadow-[0_10px_28px_-10px_rgba(15,23,42,0.16)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group ${
                          cardSize === 'small' ? 'p-3' : 'p-4'
                        }`}
                        onClick={() => canCreate && createForRow(r)}
                      >
                        <div className="flex items-start justify-between mb-2.5 gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Checkbox
                              checked={liveSelected.includes(r.id)}
                              onCheckedChange={() => toggleOne(r.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span
                              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border"
                              style={{ backgroundColor: accent.bg, color: accent.fg, borderColor: accent.border }}
                            >
                              <TIcon className="w-3.5 h-3.5" />
                            </span>
                            {(() => {
                              const title = (
                                <span className="text-[13px] truncate cursor-default" style={{ fontWeight: 600 }}>
                                  {highlightText(sourceTextOf(r), searchQuery)}
                                </span>
                              );
                              if (isStage && r.stage) {
                                return <AdvanceStageHover stage={r.stage} soNumber={r.soNumber} currency={r.currency}>{title}</AdvanceStageHover>;
                              }
                              return r.shipmentNumber ? <ShipmentHover shipmentNumber={r.shipmentNumber}>{title}</ShipmentHover> : title;
                            })()}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {cardSize !== 'small' && (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap ${isStage ? 'border border-dashed' : 'border'}`}
                                style={{ fontWeight: isStage ? 600 : 500, backgroundColor: accent.bg, color: accent.fg, borderColor: accent.border }}
                              >
                                {isStage ? 'Advance' : 'Shipment'}
                              </span>
                            )}
                            {renderRowMenu(r, 'h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100 focus-visible:ring-slate-200')}
                          </div>
                        </div>
                        {cardSize !== 'small' && (
                          <div className="text-[11px] text-slate-500 truncate mb-2" onClick={(e) => e.stopPropagation()}>
                            {isStage ? (
                              stageTextOf(r)
                            ) : (
                              <LinesToBillHover shipmentNumber={r.shipmentNumber} billing={billing} currency={r.currency}>
                                <span className="cursor-default">{`${r.lineCount} line${r.lineCount === 1 ? '' : 's'} to bill`}</span>
                              </LinesToBillHover>
                            )}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-2.5 border-t border-slate-100">
                          <div className="min-w-0">
                            <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Customer</p>
                            <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
                              <CustomerCell customer={r.customer} density="card" />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Ship / Due Date</p>
                            <DateTooltip lines={dateTooltipLines(r)}>
                              <p className="text-[12px] text-slate-700 truncate mt-1 cursor-help" style={{ fontWeight: 400 }}>{formatUsDate(r.date)}</p>
                            </DateTooltip>
                          </div>
                          {cardSize !== 'small' && (
                            <>
                              <div className="min-w-0">
                                <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Sales Order</p>
                                <a
                                  href={SO_EXTERNAL_URL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="block text-[12px] text-slate-700 truncate mt-1 hover:text-primary hover:underline transition-colors"
                                  style={{ fontWeight: 400 }}
                                >
                                  {r.soNumber}
                                </a>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Payment Term</p>
                                <div className="mt-1 min-w-0 flex" onClick={(e) => e.stopPropagation()}>
                                  {arTermById(r.paymentTermId) ? (
                                    <CustomerTermName term={arTermById(r.paymentTermId)!} card />
                                  ) : (
                                    <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 400 }}>–</p>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex items-end justify-between gap-2 pt-2.5 mt-2.5 border-t border-slate-100">
                          <div className="min-w-0">
                            <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Value Not Billed</p>
                            <p className={`${cardSize === 'small' ? 'text-[14px]' : 'text-[16px]'} text-foreground`} style={{ fontWeight: 500, lineHeight: 1.2 }}>
                              {highlightAmount(formatCurrencyAmount(r.valueNotBilled, r.currency), searchQuery)}
                            </p>
                          </div>
                          <WaitingTooltip days={r.waitingDays} {...waitingTooltipCopy(r)}>
                            <p className={`text-[11px] shrink-0 cursor-help ${waitingCls(r.waitingDays)}`} style={{ fontWeight: 400 }}>
                              Waiting {waitingText(r.waitingDays)}
                            </p>
                          </WaitingTooltip>
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
                optionRows={rows}
                searchRows={sortedFiltered}
                searchRevealAfter="source"
                columns={columns}
                getRowId={(r) => r.id}
                // The vendor Actions slot: the shared table draws the sticky,
                // fixed-width ⋯ column (user 10/27).
                renderRowActions={(r) => renderRowMenu(r)}
                selectedIds={new Set(liveSelected)}
                onSelectionChange={applySelection}
                columnOrder={columnOrder}
                onColumnOrderChange={setColumnOrder}
                columnVisibility={columnVisibility}
                columnFilters={columnFilters}
                onColumnFilterChange={(key, f) => {
                  setColumnFilters((prev) => {
                    const next = { ...prev, [key]: f };
                    if (!isFilterActive(f)) delete next[key];
                    return next;
                  });
                  setCurrentPage(1);
                }}
                onAddColumnFilter={(key) =>
                  setColumnFilters((prev) =>
                    prev[key]
                      ? prev
                      : {
                          ...prev,
                          [key]: { columnKey: key, type: colByKey.get(key)?.filterType ?? 'text', values: [], text: '', min: '', max: '', dateFrom: '', dateTo: '' },
                        },
                  )
                }
                onHideColumn={(key) => {
                  if (LOCKED_COLUMNS.includes(key)) return;
                  setColumnVisibility((v) => ({ ...v, [key]: false }));
                }}
                sortConfig={sortConfig}
                onSort={(key, direction) => {
                  setSortConfig(direction ? { key, direction } : null);
                  setCurrentPage(1);
                }}
                frozenColumns={frozenColumns}
                onFreezeColumn={(key) =>
                  setFrozenColumns((prev) => {
                    const next = new Set(prev);
                    if (next.has(key) && !LOCKED_COLUMNS.includes(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  })
                }
                density={density}
                emptyConfig={emptyConfig}
                searchQuery={searchQuery}
                currentPage={currentPage}
                recordsPerPage={recordsPerPage}
                totalRows={sortedFiltered.length}
                onPageChange={setCurrentPage}
                onRecordsPerPageChange={(n) => {
                  setRecordsPerPage(n);
                  setCurrentPage(1);
                }}
              />
            )}
          </div>
        </div>
        <ColumnSelector
          columns={READY_COLUMN_CATALOG}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          onColumnOrderChange={setColumnOrder}
          onColumnVisibilityChange={setColumnVisibility}
          lockedColumns={LOCKED_COLUMNS}
          frozenColumns={frozenColumns}
          onFreezeColumn={(key) =>
            setFrozenColumns((prev) => {
              const next = new Set(prev);
              if (next.has(key) && !LOCKED_COLUMNS.includes(key)) next.delete(key);
              else next.add(key);
              return next;
            })
          }
          open={columnDrawerOpen}
          onOpenChange={setColumnDrawerOpen}
          defaultColumnOrder={READY_COLUMN_CATALOG.map((c) => c.key)}
          defaultColumnVisibility={DEFAULT_VISIBILITY}
          onReset={() => setColumnResetKey((k) => k + 1)}
        />
      </div>
    </div>
  );
}
