import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Package, Plus, ChevronDown, ChevronUp, Receipt, Search, Maximize2, Minimize2, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { OverflowTooltip } from '@/app/components/data-table/OverflowTooltip';
import { DataTable } from '@/app/components/data-table/DataTable';
import type { ColumnDef, SortConfig, ColumnFilterState } from '@/app/components/data-table/types';
import { ColumnSelector, ColumnSelectorTrigger } from '@/app/components/ColumnSelector';
import { ViewDensityMenu } from '@/app/components/data-table/ViewDensityMenu';
import { Invoice } from '@/app/data/mockInvoices';
import { ReceivingDocumentModal, type ReceivingDocumentLine } from './ReceivingDocumentModal';
import { ItemImageWithPreview, ItemQuickViewModal } from './ItemQuickView';
import { highlightText, highlightAmount } from '@/app/components/InvoiceDataTable';
import { rowMatchesColumns } from '@/app/components/data-table/tableSearch';

// Read-only, short list → no row selection, no pagination. Shared empties so
// the controlled DataTable props stay referentially stable.
const EMPTY_SET: Set<string> = new Set();
const EMPTY_FILTERS: Record<string, ColumnFilterState> = {};

// Generic shell — renders line-item rows through the same listing DataTable
// (column selector, sortable/reorderable/resizable columns, persisted), with
// the listing pagination footer (user 10/1; the money subtotal strip is
// gone). Exported so sibling detail tabs (Payments) can render the exact
// same table chrome.
export function LineItemsTable<T>({
  rows,
  columns,
  catalog,
  lockedKeys,
  defaultHiddenKeys = [],
  storageKey,
  getRowId,
  headerExtra,
  rowHeight = 52,
  searchAccessor,
  searchPlaceholder = 'Search line items…',
  quickFilters,
  title,
  countNoun = 'items',
  emptyMessage,
  emptyTitle,
  fillViewport = false,
}: {
  rows: T[];
  columns: ColumnDef<T>[];
  catalog: { key: string; label: string }[];
  lockedKeys: string[];
  defaultHiddenKeys?: string[];
  storageKey: string;
  getRowId: (row: T) => string;
  headerExtra?: ReactNode;
  /** Approx px per row — sizes content-fitted tables (capped at 64vh).
   *  Ignored when fillViewport stretches the card instead. */
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
  /** No-data copy (Table Empty & Error States Standard); search and load
   *  states keep the standard wording. */
  emptyMessage?: string;
  emptyTitle?: string;
  /** Kept for callers; the standard picks the icon per state. */
  emptyIcon?: React.ElementType;
  /** Card fills the column to the bottom of the viewport with rows
   *  scrolling inside, and pagination appears past 100 rows (user 10/1:
   *  the Payments tab). Line items keep the content-sized card. */
  fillViewport?: boolean;
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
  // System-standard density control (user 9/26): every table toolbar
  // carries Condensed/Comfort; no card layout for line items.
  const [density, setDensity] = useState<'condensed' | 'comfort'>('condensed');
  const [search, setSearch] = useState('');
  // Quick-filter pills were removed from the toolbar; the filter stays fixed
  // at 'all' but the quickFilters-aware narrowing below is kept intact.
  const [activeFilter] = useState('all');
  const [fullScreen, setFullScreen] = useState(false);
  // Listing-style pagination (user 10/1): only once the list outgrows
  // 100 rows, and only on viewport-filling tables (Payments). Smaller
  // sets render complete, no footer.
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(100);

  // Column drawer Reset remounts the table so dragged widths snap back (10/9/26).
  const [columnResetKey, setColumnResetKey] = useState(0);
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
    const trimmed = search.trim();
    const q = trimmed.toLowerCase();
    // The search also reads every column, shown or not, by what its cell
    // prints (10/14/26).
    if (q) r = r.filter((row) => (searchAccessor ? searchAccessor(row).toLowerCase().includes(q) : false) || rowMatchesColumns(row, columns, trimmed));
    return r;
  }, [rows, activeFilter, quickFilters, search, searchAccessor, columns]);

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

  // Page slice — the DataTable renders the listing pagination footer; the
  // slicing lives upstream, exactly like the listing screens. A narrowed
  // result set snaps back to page 1. Pagination exists only when the set
  // outgrows 100 rows on a viewport-filling table.
  const showPagination = fillViewport && sortedRows.length > 100;
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeFilter, recordsPerPage]);
  const pagedRows = useMemo(() => {
    if (!showPagination) return sortedRows;
    const start = (currentPage - 1) * recordsPerPage;
    return sortedRows.slice(start, start + recordsPerPage);
  }, [sortedRows, currentPage, recordsPerPage, showPagination]);

  // Freeze state matches the listings (9/4/26): the locked column is
  // always frozen, the rest toggle via the header menu or the drawer.
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(() => new Set(lockedKeys));
  const handleFreezeColumn = (columnKey: string) =>
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && !lockedKeys.includes(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });

  const visibleColumnCount = useMemo(
    () => catalog.filter((c) => columnVisibility[c.key] !== false).length,
    [catalog, columnVisibility],
  );

  const body = (
    <>
      {/* Search + actions row — mirrors the listing's table chrome exactly
          (search left; X-of-Y count, Columns trigger, full-screen right). */}
      <div data-col-hide-edge className="shrink-0 flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {searchAccessor && (
            <div className="relative flex-1 max-w-xs">
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
          <span className="text-sm mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
            <span className="text-foreground">{sortedRows.length}</span>
            <span className="text-muted-foreground/60"> of </span>
            <span className="text-muted-foreground">{rows.length}</span>
            <span className="text-muted-foreground/70"> {countNoun}</span>
          </span>
          <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />
          <button
            type="button"
            onClick={() => setFullScreen((v) => !v)}
            className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            title={fullScreen ? 'Exit Full Screen' : 'Full Screen'}
            aria-label={fullScreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {fullScreen ? (
              <Minimize2 className="w-[18px] h-[18px] text-muted-foreground/80" />
            ) : (
              <Maximize2 className="w-[18px] h-[18px] text-muted-foreground/80" />
            )}
            <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
              {fullScreen ? 'Exit Full Screen' : 'Full Screen'}
            </span>
          </button>
          <ViewDensityMenu
            density={density}
            onDensityChange={(next) => { if (next !== 'card') setDensity(next); }}
            hideCard
          />
          <ColumnSelectorTrigger
            visibleCount={visibleColumnCount}
            active={columnsOpen}
            onClick={() => setColumnsOpen((o) => !o)}
          />
        </div>
      </div>

      {/* Divider between the toolbar and table content (listing parity). */}
      <div className="border-t border-border shrink-0" />

      {/* Viewport-filling tables (Payments) stretch and scroll inside;
          content-sized tables (Line Items, user 10/1) keep their height
          to the rows, capped at 64vh. */}
      <div
        className={`min-h-0 flex flex-col ${fullScreen || fillViewport ? 'flex-1' : ''}`}
        style={fullScreen || fillViewport ? undefined : { maxHeight: `min(64vh, ${Math.max(1, sortedRows.length) * rowHeight + 46}px)`, minHeight: sortedRows.length === 0 ? 240 : undefined }}
      >
        <DataTable<T>
          key={`cols-${columnResetKey}`}
          rows={pagedRows}
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
          onFreezeColumn={handleFreezeColumn}
          density={density}
          currentPage={showPagination ? currentPage : 1}
          recordsPerPage={showPagination ? recordsPerPage : Math.max(1, sortedRows.length)}
          totalRows={sortedRows.length}
          onPageChange={setCurrentPage}
          onRecordsPerPageChange={(n) => { setRecordsPerPage(n); setCurrentPage(1); }}
          searchQuery={search}
          searchRows={sortedRows}
          searchRevealAfter={lockedKeys[0]}
          emptyConfig={{
            // Table Empty & Error States Standard v1.0 (11/3/26), compact
            // for detail tabs.
            entity: { singular: countNoun.replace(/s$/, ''), plural: countNoun },
            totalCount: rows.length,
            filterCount: 0,
            onClearSearch: () => { setSearch(''); setCurrentPage(1); },
            onSearch: (q) => { setSearch(q); setCurrentPage(1); },
            compact: true,
            ...(emptyTitle ? { title: emptyTitle } : {}),
            ...(emptyMessage ? { description: emptyMessage } : {}),
          }}
          hideSelectionColumn
          hidePagination={!showPagination}
          fillMode="flex"
        />
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
      frozenColumns={frozenColumns}
      onFreezeColumn={handleFreezeColumn}
      open={columnsOpen}
      onOpenChange={setColumnsOpen}
      defaultColumnOrder={allKeys}
      defaultColumnVisibility={Object.fromEntries(allKeys.map((k) => [k, !defaultHiddenKeys.includes(k)]))}
      onReset={() => setColumnResetKey((k) => k + 1)}
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
    // fillViewport tables run to the bottom of the viewport (16px gutter,
    // user 10/1); content-sized tables keep their natural height.
    <div className="rounded-xl border border-border bg-card overflow-hidden flex" style={fillViewport ? { minHeight: 'max(400px, calc(100vh - 269px))' } : undefined}>
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
  matchStatus: 'Matched' | 'Over-Billed' | 'Under-Billed' | 'No PO';
  serialized: boolean;
}

const PRODUCT_CATALOGUE: Array<{ name: string; sku: string; uom: string; gl: string; longDesc: string }> = [
  { name: 'Precision Component H1-XPR', sku: 'ITM-9021', uom: 'EA', gl: '1200 Inventory', longDesc: 'High-precision injection-moulded assembly bracket, automotive harness mount, ISO 9001 certified, RoHS compliant.' },
  { name: 'Hydraulic Seal Kit 4-Pack', sku: 'ITM-9034', uom: 'KIT', gl: '1200 Inventory', longDesc: 'Hydraulic press seal replacement kit, Buna-N elastomer, fits 200/300/500 series presses, includes O-rings + back-up rings.' },
  { name: 'Industrial Lubricant Grade A', sku: 'ITM-9047', uom: 'L', gl: '1230 Inventory-Raw Materials', longDesc: 'Synthetic gear-oil, SAE 75W-90, viscosity index 165, suitable for high-load industrial gearboxes. Mil-spec PRF-2105E compliant.' },
  { name: 'Stainless Fastener Set M8', sku: 'ITM-9058', uom: 'BX', gl: '1240 Inventory-Consumables', longDesc: 'M8 × 25mm hex-head socket cap screws, A2-70 stainless steel, DIN 912, 100 pieces per box.' },
  { name: 'Cable Harness Loom 12ft', sku: 'ITM-9061', uom: 'EA', gl: '1200 Inventory', longDesc: 'Pre-terminated wiring harness, 12-conductor, 12ft length, abrasion-resistant braided sleeve, OEM-grade quick-disconnect connectors.' },
  { name: 'Inline Pressure Sensor PS-3', sku: 'ITM-9072', uom: 'EA', gl: '1200 Inventory', longDesc: 'Inline pressure transducer, 0-300 PSI range, 4-20 mA output, 316L stainless wetted parts, IP67-rated housing.' },
  { name: 'Thermal Insulation Wrap', sku: 'ITM-9083', uom: 'RL', gl: '1230 Inventory-Raw Materials', longDesc: 'Ceramic-fibre thermal insulation wrap, 50ft × 2in × 1/8in roll, 2300°F rating, suitable for exhaust + manifold heat shielding.' },
];

// Exported (9/5/26): the Print/Export invoice document renders the same
// lines this tab shows, from the same generator.
export function generateLines(invoice: Invoice, subtotal: number): LineItem[] {
  // User-created records render EXACTLY the lines the form held
  // (9/22/26 review response, GPT F01/F11): persisted at submit, so the
  // detail tab, exports and the edit sheet all read the same record.
  // Seeds keep the deterministic demo catalogue below.
  if (invoice.savedLineItems && invoice.savedLineItems.length > 0) {
    const isPre = invoice.type === 'Pre-Invoice';
    return invoice.savedLineItems.map((l, i) => ({
      id: `line-${i + 1}`,
      productName: l.description || l.sku || 'Line item',
      description: l.description,
      sku: l.sku,
      uom: l.uom,
      poRefs: l.poNumber ? [l.poNumber] : [],
      grnRefs: l.grnNumbers ?? [],
      glAccount: l.glAccount,
      // Saved source quantities win (Eli 9/24 R02); the invoice quantity
      // is only the fallback for records that never carried them.
      orderedQty: l.orderedQty ?? l.quantity,
      receivedQty: l.receivedQty ?? (isPre ? 0 : l.quantity),
      invoicedQty: l.quantity,
      // Amount-first standalone lines carry no entered unit price — derive
      // it so the print never reads "$0.00 for $1,234.56" (Mahreen 9/29).
      unitPrice: l.unitPrice || (l.quantity > 0 ? Math.round((l.lineTotal / l.quantity) * 100) / 100 : l.lineTotal),
      amount: l.lineTotal,
      // Over-billed shows from the SAVED source quantities (Eli 9/24
      // R03): the variance stays visible to the approver on the line.
      matchStatus: !isPre && l.receivedQty !== undefined && l.quantity > l.receivedQty
        ? 'Over-Billed' as const
        : l.poNumber ? 'Matched' as const : 'No PO' as const,
      serialized: false,
    }));
  }
  // User-created records NEVER fall back to the demo catalogue (GPT QC20,
  // 9/30: an edited standalone's PDF invented three inventory lines).
  // A user record without saved lines renders honestly empty.
  if (invoice.isUserCreated) return [];
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
    // Four-decimal unit price (9/22/26 review response, GPT EXP-02): the
    // exported document must explain itself — qty × price now reproduces
    // the line amount within a cent instead of drifting 2 to 4 cents.
    const unitPrice = Math.round((lineAmount / invoicedQty) * 10000) / 10000;
    const matchStatus: LineItem['matchStatus'] = isStandalone
      ? 'No PO'
      : invoicedQty > orderedQty
        ? 'Over-Billed'
        : invoicedQty < orderedQty
          ? 'Under-Billed'
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
  // User-created standalone invoices render the exact GL-coded lines
  // the form held (9/22/26 review response); seeds keep the demo split.
  if (invoice.savedLineItems && invoice.savedLineItems.length > 0) {
    return invoice.savedLineItems.map((l, i) => ({
      id: `sa-line-${i + 1}`,
      glAccount: l.glAccount,
      description: l.description,
      amount: l.lineTotal,
    }));
  }
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

function formatMoney(amount: number, currency: string) {
  return `${currency === 'USD' ? '$' : currency + ' '}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
              Add Line Item
            </Button>
          )}
        </div>
      </div>
    );
  }

  const idxById = new Map(lines.map((l, i) => [l.id, i + 1]));
  const columns: ColumnDef<StandaloneLineItem>[] = [
    {
      key: 'lineNo', label: 'Line No.', minWidth: 64, defaultWidth: 72, align: 'left', locked: true, sticky: 'left',
      getValue: (r) => idxById.get(r.id) ?? 0,
      searchText: (r) => String(idxById.get(r.id) ?? ''),
      render: (r, { searchQuery }) => <span className="text-[11px] text-blue-600 " style={{ fontWeight: 700 }}>{highlightText(String(idxById.get(r.id) ?? ''), searchQuery)}</span>,
    },
    {
      key: 'glAccount', label: 'GL Account', minWidth: 200, defaultWidth: 240, sortable: true,
      getValue: (r) => r.glAccount,
      // Searchable, so it highlights like every other matched cell (10/9/26).
      render: (r, { searchQuery }) => (
        <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-700 " style={{ fontWeight: 600 }}>
          <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
          {highlightText(r.glAccount, searchQuery)}
        </span>
      ),
    },
    {
      key: 'description', label: 'Description', minWidth: 220, defaultWidth: 340, sortable: true,
      getValue: (r) => r.description,
      render: (r, { searchQuery }) => <span className="text-[12px] text-slate-600 leading-snug">{highlightText(r.description, searchQuery)}</span>,
    },
    {
      key: 'amount', label: 'Total', minWidth: 130, defaultWidth: 160, sortable: true,
      getValue: (r) => r.amount,
      searchText: (r) => formatMoney(r.amount, invoice.currency),
      render: (r, { searchQuery }) => <span className="text-foreground " style={{ fontWeight: 600 }}>{highlightAmount(formatMoney(r.amount, invoice.currency), searchQuery)}</span>,
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
// Exported for the AR detail's Line Items tab (user 10/1 parity) — the
// customer table reuses the exact same truncate + more/Show-less cell.
// `searchQuery` (10/9/26): the table search matches these texts, so the
// matched substring highlights like every other searched cell.
export function ItemDescriptionWithToggle({ shortText, longText, searchQuery }: { shortText: string; longText: string; searchQuery?: string }) {
  const [open, setOpen] = useState(false);
  // Name printed ONCE (VI-52): when the long description is just the item
  // name again (productName === description), there is no tail to show —
  // otherwise the cell read 'Industrial Steel Pipes 2"–Industrial Steel Pipes 2"'.
  const sameText = (longText ?? '').trim().toLowerCase() === (shortText ?? '').trim().toLowerCase();
  const hasTail = !!longText && longText.length > 0 && !sameText;
  if (!hasTail) {
    return (
      <div className="text-[11px] text-slate-500 leading-snug mt-0.5 w-full min-w-0">
        <span className="block truncate">{highlightText(shortText, searchQuery)}</span>
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
          {highlightText(shortText, searchQuery)}
          <span className="text-slate-400">–</span>
          {highlightText(longText, searchQuery)}{' '}
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
            {highlightText(shortText, searchQuery)}
            <span className="text-slate-400">–</span>
            {highlightText(longText, searchQuery)}
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

// Dispatcher — picks the right line-items table for the invoice type.
// Standalone invoices are GL-coded manual entries with no PO/inventory
// backing, so they render the create-form-style GL Account · Description ·
// Amount table; everything else uses the inventory 3-way-match grid.
// Kept hook-free so the conditional branch doesn't trip the Rules of Hooks
// when the user navigates between a standalone and an inventory invoice.
export function LineItemsTab({ invoice, subtotal, isPending }: { invoice: Invoice; subtotal: number; isPending: boolean }) {
  if (invoice.type === 'Standalone') {
    return <StandaloneLineItems invoice={invoice} subtotal={subtotal} isPending={isPending} />;
  }
  return <InventoryLineItems invoice={invoice} subtotal={subtotal} isPending={isPending} />;
}

function InventoryLineItems({ invoice, subtotal, isPending: _isPending }: { invoice: Invoice; subtotal: number; isPending: boolean }) {
  const lines = useMemo(() => generateLines(invoice, subtotal), [invoice, subtotal]);
  // Offending-field highlight moved to the EDIT screen (BA 9/6): the
  // detail page states the exception in the banner + sidebar card; the
  // amber column tint appears where the user can actually FIX it — the
  // Edit-and-Resubmit modal (CreateInvoiceScreen).
  // Per-line amount = qty invoiced × unit price. The footer shows ONLY this
  // money subtotal ("Invoice line subtotal") — quantities can't be summed
  // across mixed units (ROLL + L + EA), so no quantity totals are shown.
  const lineAmountTotal = lines.reduce((s, l) => s + l.invoicedQty * l.unitPrice, 0);

  // Receiving Document modal state — opens when a user clicks a GRN
  // chip in the Linked Documents column. The modal sources its line
  // data from every invoice line that references the clicked GRN.
  const [grnModal, setGrnModal] = useState<string | null>(null);
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
          <p className="text-[13px] text-slate-600" style={{ fontWeight: 600 }}>No line items on this invoice.</p>
          {_isPending && (
            <Button size="sm" className="mt-4 h-9 px-3 text-[12px]" style={{ fontWeight: 600 }}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Line Item
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
      key: 'item', label: 'Item', minWidth: 200, defaultWidth: 260, align: 'left', locked: true, sticky: 'left', flex: true,
      getValue: (l) => l.sku,
      getSortValue: (l) => l.sku,
      searchText: (l) => `${l.sku} ${l.productName} ${l.description}`,
      // SKU, name and description are searchable, so they highlight (10/9/26).
      render: (line, { searchQuery }) => {
        return (
          <div className="flex items-start gap-3 py-1">
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setItemPreview({ sku: line.sku, description: line.description, unitPrice: line.unitPrice, uom: line.uom, serialized: line.serialized })}
                  className="text-[12px] text-slate-900 hover:text-primary hover:underline decoration-primary/60 underline-offset-2 transition-colors cursor-pointer"
                  style={{ fontWeight: 700 }}
                  title={`View ${line.sku} details`}
                >
                  {highlightText(line.sku, searchQuery)}
                </button>
              </div>
              <ItemDescriptionWithToggle shortText={line.productName} longText={line.description} searchQuery={searchQuery} />
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
      key: 'ordered', label: 'Ordered', minWidth: 100, defaultWidth: 110, sortable: true,
      getValue: (l) => l.orderedQty,
      searchText: (l) => `${l.orderedQty} ${l.uom}`,
      render: (line, { searchQuery }) => (
        <div>
          <div className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{highlightText(String(line.orderedQty), searchQuery)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{highlightText(line.uom, searchQuery)}</div>
        </div>
      ),
    },
    {
      key: 'received', label: 'Received', minWidth: 100, defaultWidth: 120, sortable: true,
      getValue: (l) => l.receivedQty,
      searchText: (l) => `${l.receivedQty} ${l.uom}`,
      render: (line, { searchQuery }) => (
        <div>
          <div className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{highlightText(String(line.receivedQty), searchQuery)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{highlightText(line.uom, searchQuery)}</div>
        </div>
      ),
    },
    {
      // "Invoiced" (copy audit): "Qty invoiced" clipped at 1366×768 and read
      // out of step with the single-word Ordered / Received headers beside it.
      key: 'qtyInvoiced', label: 'Invoiced', minWidth: 110, defaultWidth: 120, sortable: true,
      tooltip: 'The number of units the vendor billed you for on this invoice line.',
      getValue: (l) => l.invoicedQty,
      searchText: (l) => `${l.invoicedQty} ${l.uom}`,
      render: (line, { searchQuery }) => (
        <div>
          <div className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{highlightText(String(line.invoicedQty), searchQuery)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{highlightText(line.uom, searchQuery)}</div>
        </div>
      ),
    },
    {
      key: 'unitPrice', label: 'Price per Unit', minWidth: 100, defaultWidth: 120, sortable: true,
      getValue: (l) => l.unitPrice,
      searchText: (l) => `${formatMoney(l.unitPrice, invoice.currency)} per ${l.uom}`,
      render: (line, { searchQuery }) => (
        <div>
          <div className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{highlightAmount(formatMoney(line.unitPrice, invoice.currency), searchQuery)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{highlightText(`per ${line.uom}`, searchQuery)}</div>
        </div>
      ),
    },
    {
      key: 'amount', label: 'Total', minWidth: 120, defaultWidth: 130, sortable: true,
      getValue: (l) => l.invoicedQty * l.unitPrice,
      searchText: (l) => formatMoney(l.invoicedQty * l.unitPrice, invoice.currency),
      render: (line, { searchQuery }) => (
        <span className="text-foreground text-[13px]" style={{ fontWeight: 500 }}>{highlightAmount(formatMoney(line.invoicedQty * line.unitPrice, invoice.currency), searchQuery)}</span>
      ),
    },
    {
      key: 'notYetInvoiced', label: 'Not Yet Invoiced', minWidth: 130, defaultWidth: 150, sortable: true,
      getValue: (l) => Math.max(0, l.orderedQty - l.invoicedQty),
      searchText: (l) => `${Math.max(0, l.orderedQty - l.invoicedQty)} ${l.uom}`,
      render: (line, { searchQuery }) => (
        <div>
          <div className="text-slate-500" style={{ fontWeight: 600 }}>{highlightText(String(Math.max(0, line.orderedQty - line.invoicedQty)), searchQuery)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{highlightText(line.uom, searchQuery)}</div>
        </div>
      ),
    },
    {
      key: 'glAccount', label: 'GL Account', minWidth: 150, defaultWidth: 180, align: 'left', sortable: true,
      getValue: (l) => l.glAccount,
      render: (line, { searchQuery }) => <span className="text-[12px] text-slate-600 ">{highlightText(line.glAccount, searchQuery)}</span>,
    },
    {
      key: 'po', label: 'PO', minWidth: 130, defaultWidth: 150, align: 'left',
      getValue: (l) => l.poRefs[0] ?? '',
      // Every PO it lists (first in the cell, the rest in "+N more").
      searchText: (l) => l.poRefs.join(' '),
      /* Linked-records recipe from the invoice listing (partner style):
         blue PO type pill + plain foreground number, overflow as a
         primary-blue "+N more" text link (feedback 7/15/26). */
      render: (line, { searchQuery }) => (
        line.poRefs.length > 0 ? (
          <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap overflow-hidden">
            {/* PO number is plain text (VI-24): the procurement module isn't
                wired to this prototype, so the old link opened one fixed
                record (po-10) for every PO. Shown as a labelled reference. */}
            <span
              className="inline-flex items-center gap-1.5 shrink-0"
              title={`Purchase order ${line.poRefs[0]}`}
            >
              <span
                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[4px] text-[10px] tracking-wide"
                style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: 700 }}
              >
                PO
              </span>
              <span className="text-[12px] text-foreground " style={{ fontWeight: 500 }}>
                {highlightText(line.poRefs[0], searchQuery)}
              </span>
            </span>
            {line.poRefs.length > 1 && (
              <OverflowTooltip
                category="Purchase Orders"
                items={line.poRefs.slice(1).map((po) => ({
                  id: po, name: po, subtitle: 'Purchase Order', initials: 'PO',
                  avatarBg: '#DBEAFE', avatarFg: '#1D4ED8',
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
        ) : null
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
        storageKey="omnesoft:invoice-lines-v3"
        getRowId={(l) => l.id}
        rowHeight={62}
        title="Line Items"
        searchAccessor={(l) => `${l.sku} ${l.productName} ${l.description} ${l.glAccount}`}
        searchPlaceholder="Search items…"
        quickFilters={[
          { key: 'matched', label: 'Matched', match: (l) => l.matchStatus === 'Matched' },
          { key: 'over', label: 'Over-Billed', match: (l) => l.matchStatus === 'Over-Billed' },
          { key: 'under', label: 'Under-Billed', match: (l) => l.matchStatus === 'Under-Billed' },
        ]}
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
