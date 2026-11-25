import { formatMoney as moneyIn, formatRate } from '@/app/currency/money';
import { returnFx } from '@/app/currency/returnCurrency';
import type { MoneyFx } from '@/app/currency/rates';
import { useReturnView, viewMoney } from '@/app/components/currency/returnView';
import { Money } from '@/app/components/currency/Money';
import { useMemo, useState, type ReactNode } from 'react';
import { shipmentForShippedLine } from '@/app/data/rmaShipments';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Package, Plus, ChevronDown, ChevronRight, ChevronUp, Pencil, Receipt, Search, Maximize2, Minimize2, X, Trash2, ScanLine, Layers } from 'lucide-react';
import { EmptyState } from '@/app/components/EmptyState';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import RMAConfirmModal from '@/app/components/rma/RMAConfirmModal';
import { OverflowTooltip } from '@/app/components/data-table/OverflowTooltip';
import { DataTable } from '@/app/components/data-table/DataTable';
import type { ColumnDef, SortConfig, ColumnFilterState } from '@/app/components/data-table/types';
import { ColumnSelector, ColumnSelectorTrigger } from '@/app/components/ColumnSelector';
import { Invoice } from '@/app/data/mockInvoices';
import type { RMA, RMALineItem, RMALineSettlement, RMALotAllocation } from '@/app/data/mockRMAs';
import { authorizedQty, RMA_EDITABLE_STATUSES } from '@/app/data/mockRMAs';
import { useRMAContext } from '@/app/rma-context';
import { ReceivingDocumentModal, type ReceivingDocumentLine } from './ReceivingDocumentModal';
import { RMALineEditModal } from './RMALineEditModal';
import { useRMAEditGate } from '../rma-versions/RMAEditGate';
import { ItemImageWithPreview, ItemQuickViewModal } from './ItemQuickView';
import { InvoiceStatusChip } from '@/app/components/InvoiceStatusChip';
import { invoiceSplitForRMALine, type LineInvoiceSplit } from '@/app/data/receiptInvoiceStatus';
import { BUCKET_CHIP, BUCKET_HINTS, BUCKET_LABELS, RETURN_BUCKETS, autoAllocate, bucketCount } from '@/app/data/rmaReturnAllocation';

// Read-only, short list → no row selection, no pagination. Shared empties so
// the controlled DataTable props stay referentially stable.
const EMPTY_SET: Set<string> = new Set();
const EMPTY_FILTERS: Record<string, ColumnFilterState> = {};

// Generic shell — renders line-item rows through the same listing DataTable
// (column selector, sortable/reorderable/resizable columns, persisted), with
// a money subtotal strip in place of the pagination footer. Exported so
// sibling detail tabs (Payments) can render the exact same table chrome.
export function LineItemsTable<T>({
  rows,
  columns,
  catalog,
  lockedKeys,
  defaultHiddenKeys = [],
  storageKey,
  getRowId,
  subtotalLabel,
  subtotalValue,
  headerExtra,
  toolbarExtra,
  rowHeight = 52,
  searchAccessor,
  searchPlaceholder = 'Search line items…',
  quickFilters,
  title,
  countNoun = 'items',
  emptyMessage = 'No line items match the current search or filter.',
  emptyTitle = 'Nothing here yet',
  emptyIcon = Search,
  renderExpandedRow,
  expandedIds,
  renderRowActions,
}: {
  rows: T[];
  columns: ColumnDef<T>[];
  catalog: { key: string; label: string }[];
  lockedKeys: string[];
  defaultHiddenKeys?: string[];
  storageKey: string;
  getRowId: (row: T) => string;
  subtotalLabel: string;
  /** A return's value carries its dollars hover, so this takes a node. */
  subtotalValue: ReactNode;
  headerExtra?: ReactNode;
  /** View controls on the right of the toolbar, beside Full screen and
   *  Columns (a return's Base Currency | Vendor Currency switch). */
  toolbarExtra?: ReactNode;
  /** Approx px per row — used to size the scroll area to content (capped at
   *  64vh). The DataTable's scroll container needs a definite height or it
   *  collapses in normal page flow. */
  rowHeight?: number;
  /** Enables the search box; returns the haystack string for a row. */
  searchAccessor?: (row: T) => string;
  searchPlaceholder?: string;
  /** Quick-filter pills (e.g. by match status). "All" is added automatically. */
  quickFilters?: { key: string; label: string; match: (row: T) => boolean }[];
  /** Shown in the full-screen panel header. */
  title?: string;
  /** Noun in the "X of Y" toolbar count. */
  countNoun?: string;
  emptyMessage?: string;
  /** Standard empty state (EmptyState component): headline + icon tile. */
  emptyTitle?: string;
  emptyIcon?: React.ElementType;
  /** Nested detail row — rendered full-width beneath an expanded row. */
  renderExpandedRow?: (row: T) => ReactNode;
  expandedIds?: Set<string>;
  /** Pinned per-row action cell. Sits outside the column catalog, so the
   *  column selector and its count are unaffected. */
  renderRowActions?: (row: T) => ReactNode;
}) {
  const allKeys = useMemo(() => catalog.map((c) => c.key), [catalog]);
  // Column order/visibility are session-only state: toggling works while the
  // page is open, but a refresh resets back to these defaults. (We intentionally
  // do NOT persist to localStorage — the line-item table should always open in
  // its designed default layout.)
  const [columnOrder, setColumnOrder] = useState<string[]>(() => allKeys);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    allKeys.forEach((k) => { init[k] = !defaultHiddenKeys.includes(k); });
    return init;
  });
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Quick-filter pills were removed from the toolbar; the filter stays fixed
  // at 'all' but the quickFilters-aware narrowing below is kept intact.
  const [activeFilter] = useState('all');
  const [fullScreen, setFullScreen] = useState(false);

  const persistOrder = (next: string[]) => setColumnOrder(next);
  const persistVis = (next: Record<string, boolean>) => setColumnVisibility(next);

  const colByKey = useMemo(() => {
    const m = new Map<string, ColumnDef<T>>();
    columns.forEach((c) => m.set(c.key, c));
    return m;
  }, [columns]);

  // Filtering + search are upstream too — narrow the rows, then sort, before
  // handing them to DataTable.
  const filteredRows = useMemo(() => {
    let r = rows;
    if (activeFilter !== 'all' && quickFilters) {
      const qf = quickFilters.find((q) => q.key === activeFilter);
      if (qf) r = r.filter(qf.match);
    }
    const q = search.trim().toLowerCase();
    if (q && searchAccessor) r = r.filter((row) => searchAccessor(row).toLowerCase().includes(q));
    return r;
  }, [rows, activeFilter, quickFilters, search, searchAccessor]);

  const sortedRows = useMemo(() => {
    if (!sortConfig) return filteredRows;
    const def = colByKey.get(sortConfig.key);
    if (!def) return filteredRows;
    const val = (r: T) => (def.getSortValue ? def.getSortValue(r) : (def.getValue(r) as string | number));
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const av = val(a); const bv = val(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filteredRows, sortConfig, colByKey]);

  const frozenColumns = useMemo(() => new Set(lockedKeys), [lockedKeys]);

  const visibleColumnCount = useMemo(
    () => catalog.filter((c) => columnVisibility[c.key] !== false).length,
    [catalog, columnVisibility],
  );

  const body = (
    <>
      {/* Search + actions row — mirrors the listing's table chrome exactly
          (search left; X-of-Y count, Columns trigger, full-screen right). */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {searchAccessor && (
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {headerExtra}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
            <span className="text-foreground">{sortedRows.length}</span>
            <span className="text-muted-foreground/60"> of </span>
            <span className="text-muted-foreground">{rows.length}</span>
            <span className="text-muted-foreground/70"> {countNoun}</span>
          </span>
          <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />
          {toolbarExtra}
          <button
            type="button"
            onClick={() => setFullScreen((v) => !v)}
            className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            title={fullScreen ? 'Exit full screen' : 'Full screen'}
            aria-label={fullScreen ? 'Exit full screen' : 'Full screen'}
          >
            {fullScreen ? (
              <Minimize2 className="w-[18px] h-[18px] text-muted-foreground/80" />
            ) : (
              <Maximize2 className="w-[18px] h-[18px] text-muted-foreground/80" />
            )}
            {/* Icon only beside the currency switch, so the search keeps its width. */}
            <span className={`text-sm ${toolbarExtra ? 'hidden' : 'hidden md:inline'}`} style={{ fontWeight: 500 }}>
              {fullScreen ? 'Exit full screen' : 'Full screen'}
            </span>
          </button>
          <ColumnSelectorTrigger
            visibleCount={visibleColumnCount}
            active={columnsOpen}
            onClick={() => setColumnsOpen((o) => !o)}
          />
        </div>
      </div>

      {/* Divider between the toolbar and table content (listing parity). */}
      <div className="border-t border-border shrink-0" />

      {/* Fills the panel in full screen. Otherwise the table sizes to its real
          content (no estimated-height dead space below the last row) and only
          scrolls once it would exceed 64vh — the rowHeight estimate is a safe
          upper bound for that cap, not a forced height. Zero rows reserve
          enough room for the standard EmptyState (7/15/26). */}
      <div
        className={`min-h-0 flex flex-col ${fullScreen ? 'flex-1' : ''}`}
        style={fullScreen ? undefined : { maxHeight: `min(64vh, ${Math.max(1, sortedRows.length) * rowHeight + (expandedIds?.size ?? 0) * 180 + 46}px)`, minHeight: sortedRows.length === 0 ? 240 : undefined }}
      >
        <DataTable<T>
          rows={sortedRows}
          columns={columns}
          getRowId={getRowId}
          selectedIds={EMPTY_SET}
          onSelectionChange={() => {}}
          columnOrder={columnOrder}
          onColumnOrderChange={persistOrder}
          columnVisibility={columnVisibility}
          columnFilters={EMPTY_FILTERS}
          onColumnFilterChange={() => {}}
          onAddColumnFilter={() => {}}
          onHideColumn={(key) => persistVis({ ...columnVisibility, [key]: false })}
          sortConfig={sortConfig}
          onSort={(key, direction) => setSortConfig(direction ? { key, direction } : null)}
          frozenColumns={frozenColumns}
          onFreezeColumn={() => {}}
          density="condensed"
          currentPage={1}
          recordsPerPage={Math.max(1, sortedRows.length)}
          totalRows={sortedRows.length}
          onPageChange={() => {}}
          onRecordsPerPageChange={() => {}}
          searchQuery={search}
          {...(renderExpandedRow ? { renderExpandedRow } : {})}
          {...(expandedIds ? { expandedIds } : {})}
          {...(renderRowActions ? { renderRowActions } : {})}
          emptyState={
            /* Module-standard empty state — floating icon tile + fade-in
               (EmptyState component, 7/15/26). */
            <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyMessage} />
          }
          hideSelectionColumn
          hidePagination
          fillMode="flex"
        />
      </div>

      {/* Money subtotal strip — replaces the generic pagination footer. */}
      <div className="shrink-0 flex items-center justify-end gap-3 px-4 py-2.5 border-t border-border bg-slate-50/80">
        <span className="text-[11px] text-slate-500 uppercase tracking-wider" style={{ fontWeight: 600 }}>{subtotalLabel}</span>
        <span className="text-foreground tabular-nums text-[13px]" style={{ fontWeight: 700 }}>{subtotalValue}</span>
      </div>
    </>
  );

  // Column selector is a side panel that slides in beside the table, so it
  // must be a horizontal flex sibling of the content (not stacked below it,
  // which would float it as a detached box). Mirrors the listing's
  // "flex-1 min-w-0 content + ColumnSelector" row layout exactly.
  const columnPanel = (
    <ColumnSelector
      columns={catalog}
      columnOrder={columnOrder}
      columnVisibility={columnVisibility}
      onColumnOrderChange={persistOrder}
      onColumnVisibilityChange={persistVis}
      lockedColumns={lockedKeys}
      open={columnsOpen}
      onOpenChange={setColumnsOpen}
    />
  );

  if (fullScreen) {
    return createPortal(
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/40" onClick={() => setFullScreen(false)}>
        <div
          className="relative bg-white rounded-xl shadow-2xl w-[calc(100vw-2rem)] max-w-[1380px] h-[calc(100vh-3rem)] max-h-[92vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</span>
              <button
                type="button"
                onClick={() => setFullScreen(false)}
                className="ml-auto inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close full screen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              {body}
            </div>
            {columnPanel}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {body}
      </div>
      {columnPanel}
    </div>
  );
}

export interface LineItem {
  id: string;
  productName: string;
  description: string;
  sku: string;
  uom: string;
  /** Purchase orders this line ties back to. A single item can sit on
   *  more than one PO (split shipments, blanket orders, etc.) — the
   *  Purchase Order column shows the first inline and rolls the rest
   *  into a "+N more" popover. */
  poRefs: string[];
  grnRefs: string[];
  glAccount: string;
  orderedQty: number;
  receivedQty: number;
  invoicedQty: number;
  unitPrice: number;
  amount: number;
  matchStatus: 'Matched' | 'Over-billed' | 'Under-billed' | 'No PO';
  serialized: boolean;
}

const PRODUCT_CATALOGUE: Array<{ name: string; sku: string; uom: string; gl: string; longDesc: string }> = [
  { name: 'Precision Component H1-XPR', sku: 'ITM-9021', uom: 'EA', gl: '1200 Inventory', longDesc: 'High-precision injection-moulded assembly bracket, automotive harness mount, ISO 9001 certified, RoHS compliant.' },
  { name: 'Hydraulic Seal Kit 4-Pack', sku: 'ITM-9034', uom: 'KIT', gl: '1200 Inventory', longDesc: 'Hydraulic press seal replacement kit, Buna-N elastomer, fits 200/300/500 series presses, includes O-rings + back-up rings.' },
  { name: 'Industrial Lubricant Grade A', sku: 'ITM-9047', uom: 'L', gl: '1230 Inventory-Raw Materials', longDesc: 'Synthetic gear-oil, SAE 75W-90, viscosity index 165, suitable for high-load industrial gearboxes. Mil-spec PRF-2105E compliant.' },
  { name: 'Stainless Fastener Set M8', sku: 'ITM-9058', uom: 'BOX', gl: '1240 Inventory-Consumables', longDesc: 'M8 × 25mm hex-head socket cap screws, A2-70 stainless steel, DIN 912, 100 pieces per box.' },
  { name: 'Cable Harness Loom 12ft', sku: 'ITM-9061', uom: 'EA', gl: '1200 Inventory', longDesc: 'Pre-terminated wiring harness, 12-conductor, 12ft length, abrasion-resistant braided sleeve, OEM-grade quick-disconnect connectors.' },
  { name: 'Inline Pressure Sensor PS-3', sku: 'ITM-9072', uom: 'EA', gl: '1200 Inventory', longDesc: 'Inline pressure transducer, 0-300 PSI range, 4-20 mA output, 316L stainless wetted parts, IP67-rated housing.' },
  { name: 'Thermal Insulation Wrap', sku: 'ITM-9083', uom: 'ROLL', gl: '1230 Inventory-Raw Materials', longDesc: 'Ceramic-fibre thermal insulation wrap, 50ft × 2in × 1/8in roll, 2300°F rating, suitable for exhaust + manifold heat shielding.' },
];

function generateLines(invoice: Invoice, subtotal: number): LineItem[] {
  const seed = invoice.invoiceNumber.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const lineCount = 3 + (seed % 3);
  const ratios = Array.from({ length: lineCount }, (_, i) => 1 + ((seed + i * 7) % 5));
  const ratioSum = ratios.reduce((s, r) => s + r, 0);
  const isStandalone = invoice.type === 'Standalone' || !invoice.linkedPOs?.length;
  // A Pre-Invoice is billed against a PO BEFORE goods are received — so it has
  // no receivers: zero received qty and no receiving-document references. (The
  // moment a receiver exists it is no longer a pre-invoice.)
  const isPreInvoice = invoice.type === 'Pre-Invoice';
  const invoicePOs = invoice.linkedPOs ?? [];
  const grnRefs = isPreInvoice ? [] : (invoice.linkedGRNs || []);

  return ratios.map((ratio, i) => {
    const product = PRODUCT_CATALOGUE[(seed + i * 3) % PRODUCT_CATALOGUE.length];
    const lineAmount = Math.round((subtotal * ratio) / ratioSum * 100) / 100;
    const invoicedQty = 1 + ((seed + i * 11) % 12);
    // Ordered qty on the PO is larger than the invoiced qty for some
    // lines, so the "Balance Total" column has meaningful data and
    // the hover breakdown can render a 2-row split.
    const orderedQty = invoicedQty + ((seed + i * 5) % 4); // 0-3 over
    // Received qty (via GRN) — typically between invoicedQty and
    // orderedQty so the 3-way match story is visible. For standalone
    // invoices receivedQty == invoicedQty (no PO/GRN to compare). For a
    // Pre-Invoice nothing is received yet, so receivedQty is 0.
    const receivedQty = isPreInvoice
      ? 0
      : isStandalone
        ? invoicedQty
        : Math.min(orderedQty, invoicedQty + ((seed + i * 13) % 3));
    const unitPrice = Math.round((lineAmount / invoicedQty) * 100) / 100;
    const matchStatus: LineItem['matchStatus'] = isStandalone
      ? 'No PO'
      : invoicedQty > orderedQty
        ? 'Over-billed'
        : invoicedQty < orderedQty
          ? 'Under-billed'
          : 'Matched';
    // Pick 1-2 GRNs for this line from the invoice's linked GRN list.
    const lineGRNs = isStandalone
      ? []
      : grnRefs.length === 0
        ? []
        : grnRefs.slice(0, 1 + ((seed + i) % 2));
    // Assign 1-3 POs to this line — a single item can sit on more
    // than one PO (split shipments / blanket orders). When the
    // invoice itself is linked to multiple POs, rotate which ones
    // attach to each line so the +N more popover surfaces.
    const linePOs: string[] = isStandalone
      ? []
      : invoicePOs.length === 0
        ? []
        : (() => {
            const count = Math.min(invoicePOs.length, 1 + ((seed + i * 4) % 3));
            const start = (seed + i) % invoicePOs.length;
            return Array.from({ length: count }, (_, k) => invoicePOs[(start + k) % invoicePOs.length]);
          })();
    // Alternate Serialized / Non-Serialized so the table shows both.
    const serialized = (seed + i) % 2 === 0;
    return {
      id: `line-${i + 1}`,
      productName: product.name,
      description: product.longDesc,
      sku: product.sku,
      uom: product.uom,
      poRefs: linePOs,
      grnRefs: lineGRNs,
      glAccount: product.gl,
      orderedQty,
      receivedQty,
      invoicedQty,
      unitPrice,
      amount: lineAmount,
      matchStatus,
      serialized,
    };
  });
}

// RMA mode reuses the InventoryLineItems shell verbatim — same DataTable,
// same modals, same column selector. To slot in without a parallel type,
// we project each RMALineItem onto the InventoryLineItem shape. Ordered qty
// is what the source order asked for and received qty is what the receiving
// documents booked in, both carried on the RMA line. invoicedQty holds
// the return qty (the "Qty invoiced" column is re-labelled "Return qty"
// below when rma is set). glAccount / notYetInvoiced / grnRefs / poRefs
// stay empty or safe defaults — the invoice-only columns backed by these
// fields (GL, PO, Not yet invoiced) are default-hidden anyway. Serialized
// is inferred from whether the RMA line carries serialNumbers[].
function rmaLinesToInvoiceLines(rma: RMA): LineItem[] {
  return rma.items.map((li) => {
    // productName = first ~40 chars of description up to the first
    // period/comma, so the two-line "product name + description" cell
    // still renders a meaningful title. Falls back to the full desc
    // when the short head can't be extracted.
    // Break on a comma, or on a full stop that actually ends a sentence --
    // one followed by a space or nothing. Breaking on any dot cut "MIG
    // Welding Wire 0.045" down to "MIG Welding Wire 0", and the full name
    // then repeated underneath it, so the cell said the part twice and got
    // it wrong once.
    const firstBreak = li.description.search(/,|\.(?=\s|$)/);
    // With no punctuation to break on, stop at the last whole word inside 40
    // characters rather than mid-token: a hard slice turned "High Efficiency
    // 450V" into "High Efficiency 45", which is a different voltage.
    const clipped = (() => {
      const d = li.description;
      if (d.length <= 40) return d;
      const space = d.lastIndexOf(' ', 40);
      return (space > 0 ? d.slice(0, space) : d.slice(0, 40)).trim();
    })();
    const head = firstBreak > 0 ? li.description.slice(0, firstBreak).trim() : clipped;
    const productName = head.length > 0 ? head : li.description;
    const matchStatus: LineItem['matchStatus'] = li.returnQty === li.receivedQty
      ? 'Matched'
      : li.returnQty > li.receivedQty
        ? 'Over-billed'
        : 'Under-billed';
    return {
      id: li.id,
      productName,
      description: li.description,
      sku: li.sku,
      uom: li.uom,
      poRefs: rma.sourcePO ? [rma.sourcePO] : [],
      grnRefs: [],
      glAccount: '',
      // What the order asked for and what the receiving documents booked in
      // are two different figures. Showing the same one under both headings
      // said nothing, and the one it showed was not the receipt's.
      orderedQty: li.orderedQty ?? li.receivedQty,
      receivedQty: li.receivedQty,
      invoicedQty: li.returnQty,
      unitPrice: li.unitPrice,
      amount: Math.round(li.returnQty * li.unitPrice * 100) / 100,
      matchStatus,
      serialized: !!(li.serialNumbers && li.serialNumbers.length > 0),
    };
  });
}

// ── Standalone (manual-entry) line items ──────────────────────────────
// A Standalone vendor invoice has no PO/GRN/inventory backing — it's a
// direct GL-coded expense entry typed straight into the create form
// (GL Account · Description · Amount). The detail page must mirror that
// shape rather than the inventory 3-way-match columns, so it carries its
// own lightweight line type + generator.
export interface StandaloneLineItem {
  id: string;
  glAccount: string;
  description: string;
  amount: number;
}

const STANDALONE_GL_CATALOGUE: Array<{ glAccount: string; description: string }> = [
  { glAccount: '6010 Professional Services', description: 'Consulting services, monthly retainer' },
  { glAccount: '6200 Office Supplies', description: 'Office supplies & stationery' },
  { glAccount: '6400 Software Subscriptions', description: 'SaaS subscription, annual license renewal' },
  { glAccount: '6100 Marketing & Advertising', description: 'Digital advertising campaign spend' },
  { glAccount: '6500 Utilities', description: 'Facility utilities, electricity & water' },
  { glAccount: '6300 Repairs & Maintenance', description: 'Equipment maintenance & repair' },
  { glAccount: '6600 Travel & Entertainment', description: 'Business travel, airfare & lodging' },
  { glAccount: '6700 Legal & Compliance', description: 'Legal advisory & filing fees' },
];

function generateStandaloneLines(invoice: Invoice, subtotal: number): StandaloneLineItem[] {
  const seed = invoice.invoiceNumber.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const lineCount = 2 + (seed % 3); // 2–4 lines
  const ratios = Array.from({ length: lineCount }, (_, i) => 1 + ((seed + i * 7) % 5));
  const ratioSum = ratios.reduce((s, r) => s + r, 0);
  // Distribute the subtotal across the lines; the last line absorbs the
  // rounding remainder so the column total reconciles to the subtotal.
  let running = 0;
  return ratios.map((ratio, i) => {
    const entry = STANDALONE_GL_CATALOGUE[(seed + i * 3) % STANDALONE_GL_CATALOGUE.length];
    const isLast = i === ratios.length - 1;
    const amount = isLast
      ? Math.round((subtotal - running) * 100) / 100
      : Math.round(((subtotal * ratio) / ratioSum) * 100) / 100;
    running = Math.round((running + amount) * 100) / 100;
    return {
      id: `sa-line-${i + 1}`,
      glAccount: entry.glAccount,
      description: entry.description,
      amount,
    };
  });
}

/** In the return's (the PO's) currency, with its symbol: £30.23 (app/currency/money.ts). */
function formatMoney(amount: number, currency: string) {
  return moneyIn(amount, currency);
}

// Nested detail — how one return line settles, stated per invoice state.
// Goods that sat part on accrual, part billed and part paid go back on three
// different sets of terms, and the parent row can only carry the headline one,
// so each state gets its own row with the quantity, remedy, reason and price
// it settles under.
function LineSettlementPanel({
  line,
  settlements,
  currency,
  fx,
}: {
  line: RMALineItem;
  settlements: RMALineSettlement[];
  currency: string;
  /** The return's rate, for the page's Base Currency view. */
  fx?: MoneyFx | null | undefined;
}) {
  const pageView = useReturnView();
  const formatMoney = (amount: number, code: string) => viewMoney(pageView, amount, code, fx);
  // There is no per-serial record of the invoice state a unit was billed
  // under, so the line's units are cut into contiguous slices in the same
  // order the breakdown was built in. Slice and breakdown describe the same
  // units, which is what lets a state name the units going back under it.
  const units = line.serialNumbers ?? [];
  let cursor = 0;
  const serialsFor = (qty: number) => {
    const slice = units.slice(cursor, cursor + qty);
    cursor += qty;
    return slice;
  };
  return (
    <div className="pl-8 pr-3 py-2.5 border-l-2 border-primary/30">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_92px_104px_112px] gap-3 px-3 py-2 border-b border-border bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>
          <span>Invoice state</span>
          <span>Return reason</span>
          <span className="text-right">Return qty</span>
          <span className="text-right">Price per unit</span>
          <span className="text-right">Total</span>
        </div>
        {settlements.map((s) => {
          const serials = serialsFor(s.qty);
          return (
            <div
              key={s.state}
              className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_92px_104px_112px] gap-3 px-3 py-2 items-start border-b border-border/60 last:border-b-0"
            >
              <div className="min-w-0">
                <span
                  className={`inline-flex items-center px-1.5 py-px rounded-full text-[10px] border ${BUCKET_CHIP[s.state]}`}
                  style={{ fontWeight: 600 }}
                >
                  {BUCKET_LABELS[s.state]}
                </span>
                <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{BUCKET_HINTS[s.state]}</div>
                {serials.length > 0 && (
                  <div className="flex items-start gap-1 mt-1 text-[10px] text-slate-500 min-w-0" title={serials.join(', ')}>
                    <ScanLine className="w-3 h-3 shrink-0 mt-px text-slate-400" />
                    <span className="truncate font-mono">{serials.join(', ')}</span>
                  </div>
                )}
              </div>
              <div className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{s.reason}</div>
              <div className="text-right">
                <div className="tabular-nums text-[13px] text-foreground" style={{ fontWeight: 500 }}>{s.qty}</div>
                <div className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{line.uom}</div>
              </div>
              <div className="text-right tabular-nums text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                {formatMoney(s.unitPrice, currency)}
              </div>
              <div className="text-right tabular-nums text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                {formatMoney(s.qty * s.unitPrice, currency)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Detail-page line items for a Standalone invoice — mirrors the create
// form's GL Account · Description · Amount table instead of the inventory
// 3-way-match grid.
function StandaloneLineItems({ invoice, subtotal, isPending }: { invoice: Invoice; subtotal: number; isPending: boolean }) {
  const lines = useMemo(() => generateStandaloneLines(invoice, subtotal), [invoice, subtotal]);
  const total = lines.reduce((s, l) => s + l.amount, 0);

  if (lines.length === 0) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-slate-200 bg-white">
          <Receipt className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-[13px] text-slate-600" style={{ fontWeight: 600 }}>No line items on this invoice.</p>
          {isPending && (
            <Button size="sm" className="mt-4 h-9 px-3 text-[12px]" style={{ fontWeight: 600 }}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add line item
            </Button>
          )}
        </div>
      </div>
    );
  }

  const idxById = new Map(lines.map((l, i) => [l.id, i + 1]));
  const columns: ColumnDef<StandaloneLineItem>[] = [
    {
      key: 'lineNo', label: '#', minWidth: 52, defaultWidth: 56, align: 'left', locked: true, sticky: 'left',
      getValue: (r) => idxById.get(r.id) ?? 0,
      render: (r) => <span className="text-[11px] text-blue-600 tabular-nums" style={{ fontWeight: 700 }}>{idxById.get(r.id)}</span>,
    },
    {
      key: 'glAccount', label: 'GL Account', minWidth: 200, defaultWidth: 240, sortable: true,
      getValue: (r) => r.glAccount,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-700 tabular-nums" style={{ fontWeight: 600 }}>
          <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
          {r.glAccount}
        </span>
      ),
    },
    {
      key: 'description', label: 'Description', minWidth: 220, defaultWidth: 340, sortable: true,
      getValue: (r) => r.description,
      render: (r) => <span className="text-[12px] text-slate-600 leading-snug">{r.description}</span>,
    },
    {
      key: 'amount', label: 'Total', minWidth: 130, defaultWidth: 160, sortable: true,
      getValue: (r) => r.amount,
      render: (r) => <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{formatMoney(r.amount, invoice.currency)}</span>,
    },
  ];
  const catalog = columns.map((c) => ({ key: c.key, label: c.label }));

  return (
    <LineItemsTable<StandaloneLineItem>
      rows={lines}
      columns={columns}
      catalog={catalog}
      lockedKeys={['lineNo']}
      storageKey="omnesoft:invoice-lines-standalone"
      getRowId={(r) => r.id}
      subtotalLabel="Subtotal"
      subtotalValue={formatMoney(total, invoice.currency)}
      rowHeight={33}
      title="Line Items"
      searchAccessor={(r) => `${r.glAccount} ${r.description}`}
      searchPlaceholder="Search by GL account or description…"
    />
  );
}

// Mirrors the partner / Add-Items modal recipe
// (VendorSelectionModalNested.tsx lines 2450-2498). Width cap on the
// root keeps the Item/item number column width identical in both states —
// collapsed truncates inside the cap, expanded wraps to multiple
// lines inside the same cap. Right-side columns never reflow.
//
// Description splits on the em-dash so the short head ("Stretch Wrap
// Roll 18" x 1500ft") always shows, and only the long tail
// ("Industrial-grade component...") gets gated behind a "more"
// toggle. Copy mirrors the modal verbatim: `more ▼` collapsed,
// `Show less ▲` open.
function ItemDescriptionWithToggle({ shortText, longText }: { shortText: string; longText: string }) {
  const [open, setOpen] = useState(false);
  const hasTail = longText && longText.length > 0;
  if (!hasTail) {
    return (
      <div className="text-[11px] text-slate-500 leading-snug mt-0.5 w-full min-w-0">
        <span className="block truncate">{shortText}</span>
      </div>
    );
  }
  return (
    <div className="text-[11px] text-slate-500 leading-snug mt-0.5 w-full min-w-0">
      {open ? (
        // Expanded — the full description wraps to as many lines as it needs,
        // growing the row height (mirrors the creation-form item pattern).
        // `whitespace-normal` is required because the parent <td> sets
        // `whitespace-nowrap`, which would otherwise keep the text on one
        // clipped line and hide the expansion entirely.
        <span className="block whitespace-normal break-words">
          {shortText}
          <span className="text-slate-400">, </span>
          {longText}{' '}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-blue-700 transition-colors cursor-pointer align-baseline"
            style={{ fontWeight: 500 }}
          >
            Show less <ChevronUp className="w-3 h-3" />
          </button>
        </span>
      ) : (
        // Collapsed — the description fills the full cell width and truncates
        // with an ellipsis at the right edge; the `more` toggle sits flush at
        // that edge (flex-1 text + shrink-0 button), so there's no dead space.
        <span className="flex items-center gap-1 w-full min-w-0">
          <span className="truncate flex-1 min-w-0">
            {shortText}
            <span className="text-slate-400">, </span>
            {longText}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-blue-700 transition-colors cursor-pointer shrink-0"
            style={{ fontWeight: 500 }}
          >
            more <ChevronDown className="w-3 h-3" />
          </button>
        </span>
      )}
    </div>
  );
}

// Serial / Lot cell — the same shape the listing table gives its Items
// column: the first value inline, the rest behind a "+N more" hover card.
// A comma-joined list of twenty-character serials clipped by the column
// width named none of them.
function SerialLotCell({ serials, lots }: { serials?: string[]; lots?: RMALotAllocation[] }) {
  const linkClass = 'text-[12px] cursor-pointer transition-colors shrink-0 hover:underline';
  const linkStyle = { color: 'hsl(var(--primary))', fontWeight: 500 } as const;

  if (serials && serials.length > 0) {
    const first = serials[0]!;
    const rest = serials.slice(1);
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[12px] text-slate-600 font-mono truncate" title={first}>{first}</span>
        {rest.length > 0 && (
          <OverflowTooltip
            category="Serial numbers"
            items={rest.map((sn, i) => ({
              id: sn,
              name: sn,
              subtitle: `Unit ${i + 2} of ${serials.length}`,
              icon: <ScanLine className="w-3.5 h-3.5" />,
            }))}
          >
            <span className={linkClass} style={linkStyle}>+{rest.length} more</span>
          </OverflowTooltip>
        )}
      </div>
    );
  }

  if (lots && lots.length > 0) {
    const first = lots[0]!;
    const rest = lots.slice(1);
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[12px] text-slate-600 font-mono truncate" title={first.lot}>{first.lot}</span>
        {rest.length > 0 && (
          <OverflowTooltip
            category="Lots"
            items={rest.map((l) => ({
              id: l.lot,
              name: l.lot,
              subtitle: `${l.qty} returning`,
              icon: <Layers className="w-3.5 h-3.5" />,
            }))}
          >
            <span className={linkClass} style={linkStyle}>+{rest.length} more</span>
          </OverflowTooltip>
        )}
      </div>
    );
  }

  return <span className="text-muted-foreground/60 text-[12px]">–</span>;
}

// Dispatcher — picks the right line-items table for the invoice type.
// Standalone invoices are GL-coded manual entries with no PO/inventory
// backing, so they render the create-form-style GL Account · Description ·
// Amount table; everything else uses the inventory 3-way-match grid.
// Kept hook-free so the conditional branch doesn't trip the Rules of Hooks
// when the user navigates between a standalone and an inventory invoice.
export function LineItemsTab({ invoice, subtotal, isPending, rma, readOnly = false, toolbarExtra }: { invoice: Invoice; subtotal: number; isPending: boolean; rma?: RMA; readOnly?: boolean; toolbarExtra?: ReactNode }) {
  // RMA mode reuses the InventoryLineItems shell — same DataTable, same
  // modals, same column selector — and only swaps the row source, column
  // labels, quick filters, storage key, and chrome strings.
  if (rma) {
    return <InventoryLineItems invoice={invoice} subtotal={subtotal} isPending={isPending} rma={rma} readOnly={readOnly} toolbarExtra={toolbarExtra} />;
  }
  if (invoice.type === 'Standalone') {
    return <StandaloneLineItems invoice={invoice} subtotal={subtotal} isPending={isPending} />;
  }
  return <InventoryLineItems invoice={invoice} subtotal={subtotal} isPending={isPending} />;
}

function InventoryLineItems({ invoice, subtotal, isPending: _isPending, rma, readOnly = false, toolbarExtra }: { invoice: Invoice; subtotal: number; isPending: boolean; rma?: RMA; readOnly?: boolean; toolbarExtra?: ReactNode }) {
  const lines = useMemo(
    () => (rma ? rmaLinesToInvoiceLines(rma) : generateLines(invoice, subtotal)),
    [invoice, subtotal, rma],
  );
  // A return's amounts are in its PO's currency; the hover gives dollars at
  // the receiving-day rate, the rate the receipt reverses at (GL Impact).
  const returnRate = useMemo(() => (rma ? returnFx(rma) : null), [rma]);
  // The page's view (returnView.tsx): PKR on Base Currency.
  const pageView = useReturnView();
  const formatMoney = (amount: number, currency: string) => viewMoney(pageView, amount, currency, returnRate);
  // Per-line amount = qty invoiced × unit price. For an invoice this is the
  // billable subtotal; for an RMA this is the total return value (footer
  // label swaps to "Return value" below). Quantities can't be summed across
  // mixed units (ROLL + L + EA), so no quantity totals are shown.
  // On a return the footer has to sum the column above it, which reads the
  // authorized quantity, so a line the vendor cut short does not pay its full
  // asking value into the total.
  const lineAmountTotal = rma
    ? // Rounded line by line, as the Return Summary and the ledger round it.
      Math.round(rma.items.reduce((s, li) => s + Math.round(authorizedQty(li) * li.unitPrice * 100) / 100, 0) * 100) / 100
    : lines.reduce((s, l) => s + l.invoicedQty * l.unitPrice, 0);

  // RMA-mode lookups — reason + serial/lot render against the original
  // RMALineItem (fields we can't fit onto the shared LineItem shape). The
  // Map keeps per-line lookups O(1) inside the render + quick-filter hot
  // path.
  const rmaItemById = useMemo(() => {
    if (!rma) return null;
    return new Map<string, RMALineItem>(rma.items.map((li) => [li.id, li]));
  }, [rma]);
  const reasonOf = (id: string): string => rmaItemById?.get(id)?.reason ?? '';
  // How much of each line was received, invoiced and settled, read back off
  // the receipts the return was raised against.
  const invoiceSplitById = useMemo(() => {
    const map = new Map<string, LineInvoiceSplit>();
    if (!rma) return map;
    for (const li of rma.items) {
      const split = invoiceSplitForRMALine(rma.vendor, rma.receivingNumbers, li.originId, li.sku, li.receivedQty);
      if (split) map.set(li.id, split);
    }
    return map;
  }, [rma]);
  /** What comes back for a line, in money.
   *
   *  Only what was paid for comes back: goods still on an open invoice take a
   *  vendor credit against it and goods never billed unwind their accrual, and
   *  neither is money returning. The paid share is read off the same receipts
   *  the row's invoice-state chip reads, capped at what is actually going
   *  back, so a receipt paid in full still only claims the units on the return.
   */
  const creditBackFor = (line: { id: string; unitPrice: number }): number => {
    const li = rmaItemById?.get(line.id);
    if (!li) return 0;
    const going = authorizedQty(li);
    if (going <= 0) return 0;
    const settlements = li.settlements && li.settlements.length > 1 ? li.settlements : null;
    if (settlements) {
      return Math.round(
        settlements
          .filter((sx) => sx.state === 'paid')
          .reduce((n, sx) => n + sx.qty * (sx.unitPrice ?? line.unitPrice), 0) * 100,
      ) / 100;
    }
    const split = invoiceSplitById.get(line.id);
    if (!split || split.received <= 0) return 0;
    const paidShare = Math.min(going, (split.paid / split.received) * going);
    return Math.round(paidShare * line.unitPrice * 100) / 100;
  };

  // 'Other' is meaningless on its own, so the free-text the user typed rides
  // along in the display value while reasonOf stays the raw filter key.
  const reasonLabelOf = (id: string): string => {
    const li = rmaItemById?.get(id);
    if (!li) return '';
    return li.reason;
  };
  // Only the reasons this RMA actually uses earn a chip — the full list is
  // eleven long and would bury the table under filters that match nothing.
  const reasonsPresent = useMemo(
    () => [...new Set((rma?.items ?? []).map((li) => li.reason))],
    [rma],
  );
  const serialLotSummaryOf = (id: string): string => {
    const li = rmaItemById?.get(id);
    if (!li) return '–';
    if (li.serialNumbers && li.serialNumbers.length > 0) return li.serialNumbers.join(', ');
    if (li.lots && li.lots.length > 0) {
      const first = li.lots[0];
      const extra = li.lots.length - 1;
      return extra > 0 ? `${first.lot} (+${extra} more)` : first.lot;
    }
    return '–';
  };

  // Receiving Document modal state — opens when a user clicks a GRN
  // chip in the Linked Documents column. The modal sources its line
  // data from every invoice line that references the clicked GRN.
  const [grnModal, setGrnModal] = useState<string | null>(null);
  // Return lines stay editable up to the point the goods leave: a vendor who
  // cuts a quantity after authorizing is recorded by editing the line, and each
  // edit is kept as a version. Once the return ships, the lines are settled.
  const { updateRMALine, removeRMALine, reduceRMALine } = useRMAContext();
  // From the first shipment the return is locked to its version (DQ-07, the
  // PO and Sales Order rule). A line still in the warehouse can be reduced or
  // cancelled on that version; nothing else changes and no version is cut.
  const shipLocked = !!rma?.shipmentStartedDate;
  const guardEdit = useRMAEditGate();
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  // A line whose goods sat in more than one invoice state settles once per
  // state, and those terms open under the line rather than replacing the one
  // headline answer the row already reads.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const settlementsOf = (id: string): RMALineSettlement[] | null => {
    const li = rmaItemById?.get(id);
    if (!li) return null;
    if (li.settlements && li.settlements.length > 1) return li.settlements;
    // A line the user never split by hand still settles per invoice state:
    // which units were billed and which were paid comes off the receipt, not
    // off the return, so it is derived here and the line's own remedy, reason
    // and price apply to every state. A saved breakdown overrides it, since
    // that is the user stating different terms per state.
    const split = invoiceSplitById.get(id);
    if (!split || bucketCount(split) < 2) return null;
    const alloc = autoAllocate(authorizedQty(li), split);
    const states = RETURN_BUCKETS.filter((b) => alloc[b] > 0.004);
    if (states.length < 2) return null;
    return states.map((state) => ({
      state,
      qty: alloc[state],
      unitPrice: li.unitPrice,
      reason: li.reason,
      ...(li.returnType ? { returnType: li.returnType } : {}),
    }));
  };
  const anySettlementLines = (rma?.items ?? []).some((li) => settlementsOf(li.id) !== null);
  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [removingLineId, setRemovingLineId] = useState<string | null>(null);
  const lineEditable = !readOnly && RMA_EDITABLE_STATUSES.includes(rma?.status ?? '');
  const editingLine = editingLineId ? rmaItemById?.get(editingLineId) ?? null : null;
  const removingLine = removingLineId ? rmaItemById?.get(removingLineId) ?? null : null;
  // A return with nothing on it has no meaning, so the last line stays put and
  // the user cancels the RMA instead.
  const canRemoveLine = (rma?.items.length ?? 0) > 1;
  // Item QuickView modal state — opens when a user clicks the item
  // thumbnail. Holds the item number + description of the active item so the
  // modal can render its hero carousel + stat grid + detail rows.
  const [itemPreview, setItemPreview] = useState<{ sku: string; description: string; unitPrice: number; uom: string; serialized: boolean } | null>(null);
  const grnLines: ReceivingDocumentLine[] = useMemo(() => {
    if (!grnModal) return [];
    return lines
      .filter((l) => l.grnRefs.includes(grnModal))
      .map((l) => ({
        sku: l.sku,
        productName: l.productName,
        uom: l.uom,
        orderedQty: l.orderedQty,
        receivedQty: l.receivedQty,
        serialized: l.serialized,
      }));
  }, [grnModal, lines]);
  const grnPoRef = useMemo(() => {
    if (!grnModal) return undefined;
    return lines.find((l) => l.grnRefs.includes(grnModal))?.poRefs?.[0] || undefined;
  }, [grnModal, lines]);

  if (lines.length === 0) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-slate-200 bg-white">
          <Package className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-[13px] text-slate-600" style={{ fontWeight: 600 }}>{rma ? 'No return lines on this RMA.' : 'No line items on this invoice.'}</p>
          {_isPending && !rma && (
            <Button size="sm" className="mt-4 h-9 px-3 text-[12px]" style={{ fontWeight: 600 }}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add line item
            </Button>
          )}
        </div>
      </div>
    );
  }

  const columns: ColumnDef<LineItem>[] = [
    {
      // flex: the Item column absorbs leftover width so it never shrinks
      // below its minimum while numeric columns keep their natural size
      // (design review 7/9/26: Item shrank tiny while Quantity ballooned).
      // The minimum holds the longest item number and its invoice chip on one
      // line, since the chip wrapping under the number reads as a second row.
      key: 'item', label: 'Item', minWidth: anySettlementLines ? 306 : 280, defaultWidth: anySettlementLines ? 326 : 300, align: 'left', locked: true, sticky: 'left', flex: true,
      getValue: (l) => l.sku,
      getSortValue: (l) => l.sku,
      render: (line) => {
        const settlements = settlementsOf(line.id);
        const open = expandedIds.has(line.id);
        return (
          <div className="flex items-start gap-3 py-1">
            {/* The slot is held on every row once any line splits, so the
                item numbers stay on one vertical line down the column. */}
            {anySettlementLines && (
              settlements ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleExpanded(line.id); }}
                  className="shrink-0 mt-1 inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-expanded={open}
                  aria-label={open ? `Hide settlement states for ${line.sku}` : `Show settlement states for ${line.sku}`}
                  title={open ? 'Hide settlement by invoice state' : `Settles across ${settlements.length} invoice states`}
                >
                  {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <span className="shrink-0 w-5" aria-hidden="true" />
              )
            )}
            <span className="shrink-0">
              <ItemImageWithPreview
                sku={line.sku}
                alt={line.sku}
                unitPrice={line.unitPrice}
                uom={line.uom}
                serialized={line.serialized}
                onPreview={() => setItemPreview({ sku: line.sku, description: line.description, unitPrice: line.unitPrice, uom: line.uom, serialized: line.serialized })}
                disabled={!!itemPreview}
                size={36}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setItemPreview({ sku: line.sku, description: line.description, unitPrice: line.unitPrice, uom: line.uom, serialized: line.serialized })}
                  className="text-[12px] font-mono text-slate-900 hover:text-primary hover:underline decoration-primary/60 underline-offset-2 transition-colors cursor-pointer"
                  style={{ fontWeight: 700 }}
                  title={`View ${line.sku} details`}
                >
                  {line.sku}
                </button>
                <InvoiceStatusChip split={invoiceSplitById.get(line.id)} uom={line.uom} />
              </div>
              {/* A line whose units sit in more than one payment state stays
                  one row; the split reads under the tag (ERP-8689), e.g.
                  "6 paid · 2 unpaid · 2 not invoiced". */}
              {(() => {
                const parts = settlementsOf(line.id);
                if (!parts) return null;
                const word: Record<string, string> = { paid: 'paid', invoicedUnpaid: 'unpaid', notInvoiced: 'not invoiced' };
                const order = ['paid', 'invoicedUnpaid', 'notInvoiced'];
                const text = [...parts]
                  .sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state))
                  .map((s) => `${Number(s.qty.toFixed(2))} ${word[s.state] ?? s.state}`)
                  .join(' · ');
                return (
                  <p className="text-[10px] text-slate-500 tabular-nums mt-0.5" style={{ fontWeight: 500 }}>
                    {text}
                  </p>
                );
              })()}
              <div>
                <ItemDescriptionWithToggle shortText={line.productName} longText={line.description} />
              </div>
            </div>
          </div>
        );
      },
    },
    {
      /* Column order + typography rev 7/15/26: Ordered → Received → Qty
         invoiced → Price per unit → Total in the default view, every data
         cell at the partner-listing standard (13px, weight 500) with the
         UOM as the shared 10px subtext. */
      key: 'ordered', label: 'Ordered', minWidth: 84, defaultWidth: 88, sortable: true,
      getValue: (l) => l.orderedQty,
      render: (line) => (
        <div>
          <div className="tabular-nums text-[13px] text-foreground" style={{ fontWeight: 500 }}>{line.orderedQty}</div>
          <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{line.uom}</div>
        </div>
      ),
    },
    {
      key: 'received', label: 'Received', minWidth: 88, defaultWidth: 92, sortable: true,
      getValue: (l) => l.receivedQty,
      render: (line) => (
        <div>
          <div className="tabular-nums text-[13px] text-foreground" style={{ fontWeight: 500 }}>{line.receivedQty}</div>
          <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{line.uom}</div>
        </div>
      ),
    },
    {
      key: 'qtyInvoiced', label: rma ? 'Return qty' : 'Qty invoiced', minWidth: 96, defaultWidth: 104, sortable: true,
      tooltip: rma ? 'The number of units being returned. Once the vendor has answered, the units they authorized sit under the number that was asked for.' : 'The number of units the vendor billed you for on this invoice line.',
      getValue: (l) => l.invoicedQty,
      render: (line) => {
        const li = rmaItemById?.get(line.id);
        // A vendor who cut or refused a line has answered the request rather
        // than replaced it, so what was asked for stays above what came back.
        const authorized = li ? authorizedQty(li) : line.invoicedQty;
        const cut = !!li && li.approvedQty !== undefined && authorized !== li.returnQty;
        if (!cut) {
          return (
            <div>
              <div className="tabular-nums text-[13px] text-foreground" style={{ fontWeight: 500 }}>{line.invoicedQty}</div>
              <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{line.uom}</div>
            </div>
          );
        }
        return (
          <div title={`Asked for ${line.invoicedQty} ${line.uom}. The vendor authorized ${authorized}.`}>
            <div className="tabular-nums text-[11px] text-slate-400 line-through" style={{ fontWeight: 500 }}>
              {line.invoicedQty}
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={`tabular-nums text-[13px] ${authorized === 0 ? 'text-rose-600' : 'text-foreground'}`}
                style={{ fontWeight: 600 }}
              >
                {authorized}
              </span>
              <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{line.uom}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'unitPrice', label: 'Price Per Unit', minWidth: 96, defaultWidth: 104, sortable: true,
      getValue: (l) => l.unitPrice,
      render: (line) => (
        <div>
          <div className="tabular-nums text-[13px] text-foreground" style={{ fontWeight: 500 }}>
            <Money value={line.unitPrice} currency={invoice.currency} fx={returnRate} />
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>per {line.uom}</div>
        </div>
      ),
    },
    {
      // What the vendor owes back for this line. The Total column says what
      // the goods are worth; this says how much of that is money coming back,
      // which is the figure the settlement step turns on and the one nobody
      // could read off this table.
      // Named by how this return settles. A refund and a credit are not the
      // same promise -- one is money back in the account you paid from, the
      // other is a balance you spend on the vendor's next invoice -- and a
      // header that covers both leaves the reader to remember which one this
      // document is. "Refund or credit" is the open question, so it stands
      // only until somebody answers it.
      key: 'creditBack',
      label:
        rma?.creditTerms?.refundOrCredit === 'Refund'
          ? 'Refund value'
          : rma?.creditTerms?.refundOrCredit === 'Credit'
            ? 'Credit value'
            : 'Refund or credit',
      minWidth: 124, defaultWidth: 140, sortable: true,
      getValue: (l) => creditBackFor(l),
      render: (line) => {
        const back = creditBackFor(line);
        const li = rmaItemById?.get(line.id);
        const whole = li ? authorizedQty(li) * line.unitPrice : 0;
        return (
          <div>
            <span
              className={`tabular-nums text-[13px] ${back > 0.004 ? 'text-foreground' : 'text-slate-400'}`}
              style={{ fontWeight: back > 0.004 ? 600 : 500 }}
            >
              <Money value={back} currency={invoice.currency} fx={returnRate} />
            </span>
            {back > 0.004 && back < whole - 0.004 && (
              <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                paid share
              </div>
            )}
            {back <= 0.004 && (
              <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                nothing paid yet
              </div>
            )}
            {back > 0.004 && back >= whole - 0.004 && !rma?.creditTerms?.refundOrCredit && (
              <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                not yet chosen
              </div>
            )}
          </div>
        );
      },
    },
    // RMA-only: per-line reason + serial/lot IDs. Slot in before Amount so
    // the money column stays flush right, mirroring how the previous stripped
    // RmaLineItems table read left-to-right.
    ...(rma
      ? ([
          {
            key: 'reason', label: 'Reason', minWidth: 108, defaultWidth: 120, align: 'left',
            getValue: (l) => reasonLabelOf(l.id),
            render: (line) => {
              const li = rmaItemById?.get(line.id);
              return (
                <div className="min-w-0">
                  <span className="text-[13px] text-slate-700 block truncate" style={{ fontWeight: 500 }}>{reasonLabelOf(line.id) || '–'}</span>
                  {li?.approvalNote && (
                    <span className="block text-[10px] text-slate-500 mt-0.5 truncate" title={li.approvalNote}>
                      {li.approvalNote}
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            // The first ID plus its "+n more" is the whole point of the cell,
            // so the column is sized for that pair and lets the ID truncate.
            key: 'serialLot', label: 'Serial / Lot IDs', minWidth: 124, defaultWidth: 140, align: 'left',
            getValue: (l) => serialLotSummaryOf(l.id),
            render: (line) => {
              const li = rmaItemById?.get(line.id);
              return (
                <SerialLotCell
                  {...(li?.serialNumbers ? { serials: li.serialNumbers } : {})}
                  {...(li?.lots ? { lots: li.lots } : {})}
                />
              );
            },
          },
        ] as ColumnDef<LineItem>[])
      : []),
    {
      key: 'amount', label: 'Total', minWidth: 108, defaultWidth: 116, sortable: true,
      // Once the vendor has answered, the line is worth what they authorized,
      // and the struck-through original says what was asked for.
      getValue: (l) => {
        const li = rmaItemById?.get(l.id);
        return (li ? authorizedQty(li) : l.invoicedQty) * l.unitPrice;
      },
      render: (line) => {
        const li = rmaItemById?.get(line.id);
        const qty = li ? authorizedQty(li) : line.invoicedQty;
        const reduced = !!li && qty < li.returnQty;
        return (
          <div>
            {reduced && (
              <div className="tabular-nums text-[11px] text-slate-400 line-through">
                {formatMoney(li.returnQty * line.unitPrice, invoice.currency)}
              </div>
            )}
            <span
              className="tabular-nums text-[13px] text-foreground"
              style={{ fontWeight: 500 }}
            >
              <Money value={qty * line.unitPrice} currency={invoice.currency} fx={returnRate} />
            </span>
          </div>
        );
      },
    },
    {
      key: 'notYetInvoiced', label: 'Not yet invoiced', minWidth: 130, defaultWidth: 150, sortable: true,
      getValue: (l) => Math.max(0, l.orderedQty - l.invoicedQty),
      render: (line) => (
        <div>
          <div className="tabular-nums text-slate-500" style={{ fontWeight: 600 }}>{Math.max(0, line.orderedQty - line.invoicedQty)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{line.uom}</div>
        </div>
      ),
    },
    {
      key: 'glAccount', label: 'GL account', minWidth: 150, defaultWidth: 180, align: 'left', sortable: true,
      getValue: (l) => l.glAccount,
      render: (line) => <span className="text-[12px] text-slate-600 tabular-nums">{line.glAccount}</span>,
    },
    {
      key: 'po', label: 'PO', minWidth: 130, defaultWidth: 150, align: 'left',
      getValue: (l) => l.poRefs[0] ?? '',
      /* Linked-records recipe from the invoice listing (partner style):
         blue PO type pill + plain foreground number, overflow as a
         primary-blue "+N more" text link (feedback 7/15/26). */
      render: (line) => (
        line.poRefs.length > 0 ? (
          <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap overflow-hidden">
            <a
              href={`https://pleasant-flow.lovable.app/purchase-orders/po-10`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 shrink-0 group/lr cursor-pointer"
              title={`Open purchase order ${line.poRefs[0]} in a new tab`}
            >
              <span
                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[4px] text-[10px] tracking-wide"
                style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: 700 }}
              >
                PO
              </span>
              <span className="text-[12px] text-foreground group-hover/lr:text-primary group-hover/lr:underline transition-colors tabular-nums" style={{ fontWeight: 500 }}>
                {line.poRefs[0]}
              </span>
            </a>
            {line.poRefs.length > 1 && (
              <OverflowTooltip
                category="Purchase Orders"
                items={line.poRefs.slice(1).map((po) => ({
                  id: po, name: po, subtitle: 'PURCHASE ORDER', initials: 'PO',
                  avatarBg: '#DBEAFE', avatarFg: '#1D4ED8',
                  nameHref: `https://pleasant-flow.lovable.app/purchase-orders/po-10`,
                }))}
              >
                <span
                  className="text-xs cursor-pointer transition-colors shrink-0 hover:underline"
                  style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
                >
                  +{line.poRefs.length - 1} more
                </span>
              </OverflowTooltip>
            )}
          </div>
        ) : (
          <span className="text-[12px] text-slate-300" aria-label="No purchase order">, </span>
        )
      ),
    },
  ];
  const catalog = columns.map((c) => ({ key: c.key, label: c.label }));

  return (
    <>
      <LineItemsTable<LineItem>
        rows={lines}
        columns={columns}
        catalog={catalog}
        lockedKeys={['item']}
        defaultHiddenKeys={['notYetInvoiced', 'glAccount', 'po']}
        storageKey={rma ? 'omnesoft:rma-lines-v1' : 'omnesoft:invoice-lines-v3'}
        getRowId={(l) => l.id}
        // "Return value · receiving rate 307.6686" in PKR, the rate the
        // receipt was booked at (Currency Touchpoints Map, 2026-11-24).
        subtotalLabel={
          rma
            ? returnRate
              ? `Return value · ${returnRate.provisional ? "today's rate" : 'receiving rate'} ${formatRate(returnRate.rate)}`
              : 'Return value'
            : 'Invoice line subtotal'
        }
        subtotalValue={<Money value={lineAmountTotal} currency={invoice.currency} fx={returnRate} />}
        rowHeight={62}
        toolbarExtra={toolbarExtra}
        title={rma ? 'Return Items' : 'Line Items'}
        searchAccessor={(l) => rma
          ? `${l.sku} ${l.productName} ${l.description} ${reasonOf(l.id)}`
          : `${l.sku} ${l.productName} ${l.description} ${l.glAccount}`}
        searchPlaceholder={rma ? 'Search return items…' : 'Search items…'}
        quickFilters={rma ? reasonsPresent.map((r) => ({
          key: r,
          label: r,
          match: (l: LineItem) => reasonOf(l.id) === r,
        })) : [
          { key: 'matched', label: 'Matched', match: (l) => l.matchStatus === 'Matched' },
          { key: 'over', label: 'Over-billed', match: (l) => l.matchStatus === 'Over-billed' },
          { key: 'under', label: 'Under-billed', match: (l) => l.matchStatus === 'Under-billed' },
        ]}
        {...(anySettlementLines
          ? {
              expandedIds,
              renderExpandedRow: (l: LineItem) => {
                const li = rmaItemById?.get(l.id);
                const settlements = settlementsOf(l.id);
                if (!li || !settlements) return null;
                return <LineSettlementPanel line={li} settlements={settlements} currency={invoice.currency} fx={returnRate} />;
              },
            }
          : {})}
        {...(lineEditable
          ? {
              renderRowActions: (l: LineItem) => {
                // ERP-8682 AC1: while a shipment is in process, a line that
                // has already shipped cannot be changed or cancelled; the
                // ones still in the warehouse can.
                const shippedOn = rma ? shipmentForShippedLine(rma, l.id) : null;
                if (shippedOn) {
                  const why = `Shipped on ${shippedOn.shippingId}. It can no longer be changed or removed.`;
                  return (
                    <div className="flex items-center gap-0.5" title={why}>
                      <button type="button" disabled aria-label={why} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 opacity-40 cursor-not-allowed">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" disabled aria-label={why} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 opacity-40 cursor-not-allowed">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }
                // Neither path cuts a version once shipping has started, so
                // there is no new-version prompt to pass through.
                const gate = (action: () => void) => (shipLocked ? action() : guardEdit(action));
                const editLabel = shipLocked ? `Reduce quantity of ${l.sku}` : `Edit ${l.sku}`;
                const removeLabel = shipLocked ? `Cancel ${l.sku} on this return` : `Remove ${l.sku} from this return`;
                return (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    title={shipLocked ? 'Reduce quantity' : undefined}
                    onClick={() => gate(() => setEditingLineId(l.id))}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/[0.06] transition-colors disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    aria-label={editLabel}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={!canRemoveLine}
                    onClick={() => gate(() => setRemovingLineId(l.id))}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    aria-label={canRemoveLine ? removeLabel : 'A return needs at least one line'}
                    title={canRemoveLine ? (shipLocked ? 'Cancel line' : 'Remove from this return') : 'A return needs at least one line. Cancel the RMA instead.'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                );
              },
            }
          : {})}
      />

      {editingLine && rma && (
        <RMALineEditModal
          line={editingLine}
          {...(invoiceSplitById.get(editingLine.id) ? { split: invoiceSplitById.get(editingLine.id)! } : {})}
          reduceOnly={shipLocked}
          onClose={() => setEditingLineId(null)}
          onSave={(patch) =>
            shipLocked
              ? reduceRMALine(rma.id, editingLine.id, { returnQty: patch.returnQty ?? editingLine.returnQty, ...patch })
              : updateRMALine(rma.id, editingLine.id, patch)
          }
        />
      )}

      {/* Dropping a line changes what the vendor is being asked to take back,
          so it is confirmed rather than done on a single click. */}
      <RMAConfirmModal
        open={!!removingLine}
        onOpenChange={(open) => { if (!open) setRemovingLineId(null); }}
        tone="destructive"
        icon={Trash2}
        eyebrow={shipLocked ? 'Cancel line' : 'Remove line'}
        title={shipLocked ? 'Cancel this line?' : 'Remove this line from the return?'}
        description={
          removingLine && (
            <>
              <span className="font-mono" style={{ fontWeight: 600, color: '#0F172A' }}>{removingLine.sku}</span>
              {' '}drops off this RMA and its{' '}
              {removingLine.returnQty} {removingLine.uom} stay in stock.{' '}
              {shipLocked
                ? 'It has not shipped yet, so it comes off the current version. The shipped lines are not affected.'
                : 'You can add it back until the first shipment.'}
            </>
          )
        }
        confirmLabel={shipLocked ? 'Cancel line' : 'Remove line'}
        cancelLabel="Keep line"
        onConfirm={() => {
          if (rma && removingLine) {
            removeRMALine(rma.id, removingLine.id);
            toast.success(shipLocked ? 'Line cancelled' : 'Line removed', { description: `${removingLine.sku} is no longer on this return.` });
          }
          setRemovingLineId(null);
        }}
      />

      <ReceivingDocumentModal
        open={!!grnModal}
        onOpenChange={(open) => { if (!open) setGrnModal(null); }}
        grnNumber={grnModal || ''}
        vendorName={invoice.vendor}
        poRef={grnPoRef}
        receivedDate={invoice.createdDate || invoice.invoiceDate}
        status="Received"
        lines={grnLines}
      />

      <ItemQuickViewModal
        open={!!itemPreview}
        onClose={() => setItemPreview(null)}
        sku={itemPreview?.sku || ''}
        vendorName={invoice.vendor}
        description={itemPreview?.description}
        unitPrice={itemPreview?.unitPrice}
        uom={itemPreview?.uom}
        serialized={itemPreview?.serialized}
      />
    </>
  );
}
