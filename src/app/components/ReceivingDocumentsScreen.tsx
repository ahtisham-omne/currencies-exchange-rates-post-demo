import { useState, useMemo, Fragment } from 'react';
import { formatUsDateTime } from '@/app/lib/dueBucket';
import { Search, Filter, ChevronDown, Package, Truck, Calendar, Building2, Eye, MoreHorizontal, Download, FileText, ArrowUpDown, X, LayoutGrid } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { SavedViewsDialog, SavedViewsSection, useSavedViews } from '@/app/components/SavedViewsDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/app/components/ui/hover-card";
import { mockVendors, VendorGRN } from '@/app/data/mockVendors';
import { toast } from 'sonner';
// Searchable cells highlight matches like every other listing (10/9/26).
import { highlightText } from '@/app/components/InvoiceDataTable';
import { TableEmptyRow, TableSkeletonRows, TableStaleBanner, resolveTableEmptyKind, useTableLoadState } from '@/app/components/ui/table-empty-state';
import { findSearchSuggestion } from '@/app/utils/searchSuggestion';

export function ReceivingDocumentsScreen() {
  // Deep link (9/3/26): /receiving?grn=REC-… opens searched AND expanded
  // on that document — the invoice trigger-date picker's document pills
  // land here in a new tab.
  const linkedGrn = (() => {
    try {
      return new URLSearchParams(window.location.search).get('grn') ?? '';
    } catch {
      return '';
    }
  })();
  const [searchQuery, setSearchQuery] = useState(linkedGrn);
  const [expandedGrns, setExpandedGrns] = useState<Set<string>>(() => new Set(linkedGrn ? [linkedGrn] : []));

  // Advanced filters (9/4/26) — the module-standard partner-chrome modal
  // with starred saved views, replacing the dead Advanced Filters button.
  const EMPTY_FILTERS = { statuses: [] as string[], vendor: '', dateFrom: '', dateTo: '' };
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const { views: savedViews, saveView, deleteView, toggleStar } = useSavedViews([]);
  const applySavedFilters = (saved: any) => setFilters({ ...EMPTY_FILTERS, ...saved });
  const activeFiltersCount =
    filters.statuses.length + (filters.vendor.trim() ? 1 : 0) + (filters.dateFrom || filters.dateTo ? 1 : 0);

  // Flatten all GRNs from all vendors
  const allGrns = useMemo(() => {
    return mockVendors.flatMap(vendor => vendor.receivingDocuments);
  }, []);

  const filteredGrns = allGrns.filter(grn => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      grn.grnNumber.toLowerCase().includes(query) ||
      grn.poNumber.toLowerCase().includes(query) ||
      grn.vendorName?.toLowerCase().includes(query) ||
      grn.status.toLowerCase().includes(query);
    if (!matchesSearch) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(grn.status)) return false;
    if (filters.vendor.trim() && !grn.vendorName?.toLowerCase().includes(filters.vendor.trim().toLowerCase())) return false;
    if (filters.dateFrom && new Date(grn.grnDate) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(grn.grnDate) > new Date(filters.dateTo)) return false;
    return true;
  });

  // Table Empty & Error States Standard (11/3/26).
  const tableLoad = useTableLoadState();
  const visibleGrns = tableLoad.forceEmpty ? [] : filteredGrns;
  const emptyKind = resolveTableEmptyKind({
    loadState: tableLoad.loadState,
    totalCount: tableLoad.forceEmpty ? 0 : allGrns.length,
    filteredCount: visibleGrns.length,
    searchQuery: tableLoad.forceEmpty ? '' : searchQuery,
    filterCount: tableLoad.forceEmpty ? 0 : activeFiltersCount,
  });
  const searchSuggestion = useMemo(
    () =>
      emptyKind === 'no-results' || emptyKind === 'no-results-filtered'
        ? findSearchSuggestion(searchQuery, allGrns.flatMap((g) => [g.grnNumber, g.poNumber, g.vendorName, g.status]))
        : null,
    [emptyKind, searchQuery, allGrns],
  );

  const RECEIVING_STATUSES = ['Received', 'Inspected', 'Accepted', 'Partially Invoiced', 'Fully Invoiced'];

  const toggleExpand = (grnNumber: string) => {
    const newExpanded = new Set(expandedGrns);
    if (newExpanded.has(grnNumber)) {
      newExpanded.delete(grnNumber);
    } else {
      newExpanded.add(grnNumber);
    }
    setExpandedGrns(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Received': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Inspected': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'Accepted': return 'bg-green-50 text-green-700 border-green-100';
      case 'Partially Invoiced': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'Fully Invoiced': return 'bg-gray-50 text-gray-600 border-gray-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#fafafa]">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              Receiving Documents
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Track goods movements and monitor their invoicing status.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export Log
            </Button>
            <Button size="sm" className="h-8 text-xs bg-gray-900 text-white hover:bg-black">
              Record Document
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by document no., PO no., or vendor..."
              className="pl-9 h-9 text-sm border-gray-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 text-sm gap-2" onClick={() => setIsFilterOpen(true)}>
            <Filter className="w-4 h-4" />
            Advanced Filters
            {activeFiltersCount > 0 && (
              <span
                className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]"
                style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--primary))', fontWeight: 600 }}
              >
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Filters modal — module-standard partner chrome with starred
          saved views (matches the Invoices and Payments listings). */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent
          className="max-w-[520px] p-0 overflow-hidden border-0 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] bg-white flex flex-col max-h-[85vh]"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Filters</DialogTitle>
          <DialogDescription className="sr-only">
            Refine the receiving document list by status, vendor, and date.
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
            <button
              type="button"
              onClick={() => setSavedViewsOpen(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-white text-[12px] text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Saved Views
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            <SavedViewsSection
              views={savedViews}
              currentFilters={filters}
              hasActiveFilters={activeFiltersCount > 0}
              onApply={(view) => applySavedFilters(view.filters)}
              onSaveCurrent={(name) => saveView(name, filters)}
            />

            {/* ── Status ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Status</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, statuses: [] })}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                    filters.statuses.length === 0
                      ? 'border-primary bg-accent text-primary'
                      : 'border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  Any
                </button>
                {RECEIVING_STATUSES.map((status) => {
                  const selected = filters.statuses.includes(status);
                  const count = allGrns.filter((g) => g.status === status).length;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        setFilters({
                          ...filters,
                          statuses: selected
                            ? filters.statuses.filter((s) => s !== status)
                            : [...filters.statuses, status],
                        })
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        selected
                          ? 'border-primary bg-accent text-primary'
                          : 'border-border bg-white text-foreground hover:bg-muted/50'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {status}
                      <span
                        className="text-[10px] rounded-full px-1.5 py-px"
                        style={{
                          backgroundColor: selected ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                          color: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                          fontWeight: 600,
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Vendor ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Vendor</p>
              <Input
                placeholder="Filter by vendor name..."
                className="h-9 text-sm bg-white"
                value={filters.vendor}
                onChange={(e) => setFilters({ ...filters, vendor: e.target.value })}
              />
            </div>

            {/* ── Receiving date ── */}
            <div>
              <p className="text-[13px] mb-2.5" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>Receiving Date</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>From</p>
                  <Input
                    type="date"
                    className="h-9 text-sm bg-white"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>To</p>
                  <Input
                    type="date"
                    className="h-9 text-sm bg-white"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-5 h-14 border-t border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => setFilters({ ...EMPTY_FILTERS })}
              disabled={activeFiltersCount === 0}
              className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="h-9 px-5 rounded-lg text-[13px] text-white bg-primary hover:bg-[#0862D0] transition-colors cursor-pointer border-0"
              style={{ fontWeight: 600 }}
            >
              Show {filteredGrns.length} Document{filteredGrns.length !== 1 ? 's' : ''}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <SavedViewsDialog
        open={savedViewsOpen}
        onOpenChange={setSavedViewsOpen}
        currentFilters={filters}
        onApplyView={applySavedFilters}
        views={savedViews}
        onSaveView={(name) => saveView(name, filters)}
        onDeleteView={deleteView}
        onToggleStar={toggleStar}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {tableLoad.loadState === 'stale' && (
            <TableStaleBanner entity={{ plural: 'receiving documents' }} lastUpdated={tableLoad.lastUpdated} onRetry={tableLoad.retry} retrying={tableLoad.retrying} />
          )}
          <Table>
            <TableHeader className="bg-gray-900">
              <TableRow className="hover:bg-gray-900 border-b-0">
                <TableHead className="w-10"></TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 py-3">Document No.</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 tracking-wider">Date</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 tracking-wider">PO Reference</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 tracking-wider">Vendor</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 text-right">Items</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 text-right">Received Qty</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 tracking-wider">Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableLoad.loadState === 'loading' ? (
                <TableSkeletonRows columns={9} />
              ) : emptyKind ? (
                <TableEmptyRow
                  colSpan={9}
                  kind={emptyKind}
                  entity={{ singular: 'receiving document', plural: 'receiving documents' }}
                  searchQuery={searchQuery}
                  suggestion={searchSuggestion}
                  onApplySuggestion={setSearchQuery}
                  filterCount={activeFiltersCount}
                  onClearSearch={() => setSearchQuery('')}
                  onClearFilters={() => setFilters({ ...EMPTY_FILTERS })}
                  onClearAll={() => { setSearchQuery(''); setFilters({ ...EMPTY_FILTERS }); }}
                  onRetry={tableLoad.retry}
                  retrying={tableLoad.retrying}
                  errorRef={tableLoad.errorRef}
                />
              ) : visibleGrns.map((grn) => (
                <Fragment key={grn.grnNumber}>
                  <TableRow 
                    className={`cursor-pointer transition-colors ${expandedGrns.has(grn.grnNumber) ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}
                    onClick={() => toggleExpand(grn.grnNumber)}
                  >
                    <TableCell>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedGrns.has(grn.grnNumber) ? '' : '-rotate-90'}`} />
                    </TableCell>
                    <TableCell className="font-semibold text-gray-900 text-sm">{highlightText(grn.grnNumber, searchQuery)}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="whitespace-nowrap">{formatUsDateTime(grn.grnDate, grn.grnNumber)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[11px] font-medium border border-gray-200">
                        {highlightText(grn.poNumber, searchQuery)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-900 font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {highlightText(grn.vendorName ?? '', searchQuery)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 text-right ">{grn.items.length}</TableCell>
                    <TableCell className="text-sm font-semibold text-gray-900 text-right ">{grn.receivedQty}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(grn.status)} tracking-tight`}>
                        {grn.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileText className="w-4 h-4 mr-2" /> View PO
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="w-4 h-4 mr-2" /> Download Slip
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  
                  {expandedGrns.has(grn.grnNumber) && (
                    <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                      <TableCell colSpan={9} className="p-0">
                        <div className="px-14 py-4 border-l-4 border-blue-500">
                          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <Table>
                              <TableHeader className="bg-gray-50">
                                <TableRow className="hover:bg-gray-50">
                                  <TableHead className="text-[10px] font-bold text-gray-500 py-2">Item No.</TableHead>
                                  <TableHead className="text-[10px] font-bold text-gray-500">Description</TableHead>
                                  <TableHead className="text-[10px] font-bold text-gray-500 text-right">Received Qty</TableHead>
                                  {grn.status === 'Partially Invoiced' && (
                                    <>
                                      <TableHead className="text-[10px] font-bold text-green-600 text-right">Pre-Inv Qty</TableHead>
                                      <TableHead className="text-[10px] font-bold text-green-600 text-right">Pre-Inv Val</TableHead>
                                    </>
                                  )}
                                  <TableHead className="text-[10px] font-bold text-gray-500">UOM</TableHead>
                                  <TableHead className="text-[10px] font-bold text-gray-500 text-right">Price per Unit</TableHead>
                                  <TableHead className="text-[10px] font-bold text-gray-500 text-right">Total Price</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {grn.items.map((item) => (
                                  <TableRow key={item.id} className="hover:bg-gray-50/80">
                                    <TableCell className="text-xs font-medium text-blue-600">{item.sku}</TableCell>
                                    <TableCell className="text-xs text-gray-600">{item.description}</TableCell>
                                    <TableCell className="text-xs font-bold text-gray-900 text-right ">{item.quantity}</TableCell>
                                    {grn.status === 'Partially Invoiced' && (
                                      <>
                                        <TableCell className="text-xs text-right">
                                          <div className="flex flex-col items-end">
                                            <span className="font-bold text-green-600 ">{item.invoicedQty || 0}</span>
                                            {(item.invoicedQty || 0) > 0 && (
                                              <div className="flex flex-wrap justify-end gap-1 mt-0.5">
                                                <HoverCard openDelay={300}>
                                                  <HoverCardTrigger asChild>
                                                    <span className="text-[7px] bg-violet-50 text-violet-700 px-1 py-0 rounded border border-dashed border-violet-300 font-bold cursor-help">PINV-001</span>
                                                  </HoverCardTrigger>
                                                  <HoverCardContent side="top" className="w-64 p-3 bg-white border-violet-200 shadow-xl rounded-xl z-[60]">
                                                    <div className="space-y-2">
                                                      <div className="flex items-center justify-between">
                                                        <span className="text-[9px] font-black text-violet-600 tracking-widest">Pre-Invoice</span>
                                                        <span className="text-[9px] font-bold text-gray-400">Jan 15, 2024</span>
                                                      </div>
                                                      <div className="flex items-center justify-between border-b border-gray-50 pb-1.5">
                                                        <span className="text-[11px] font-bold text-gray-900">PINV-001</span>
                                                        <span className="text-[11px] font-black text-violet-700">$ {(item.unitPrice * (item.invoicedQty || 0)).toLocaleString()}</span>
                                                      </div>
                                                      <p className="text-[9px] text-gray-500 font-medium leading-tight">Pre-billing record for partial quantities. Offsets against this receiving document.</p>
                                                    </div>
                                                  </HoverCardContent>
                                                </HoverCard>
                                                {item.invoicedQty > 20 && (
                                                  <HoverCard openDelay={300}>
                                                    <HoverCardTrigger asChild>
                                                      <span className="text-[7px] bg-violet-50 text-violet-700 px-1 py-0 rounded border border-dashed border-violet-300 font-bold cursor-help">PINV-002</span>
                                                    </HoverCardTrigger>
                                                    <HoverCardContent side="top" className="w-64 p-3 bg-white border-violet-200 shadow-xl rounded-xl z-[60]">
                                                      <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                          <span className="text-[9px] font-black text-violet-600 tracking-widest">Pre-Invoice</span>
                                                          <span className="text-[9px] font-bold text-gray-400">Feb 1, 2024</span>
                                                        </div>
                                                        <div className="flex items-center justify-between border-b border-gray-50 pb-1.5">
                                                          <span className="text-[11px] font-bold text-gray-900">PINV-002</span>
                                                          <span className="text-[11px] font-black text-violet-700">$ 2,400.00</span>
                                                        </div>
                                                        <p className="text-[9px] text-gray-500 font-medium leading-tight">Second billing record detected for this item. Offset logic applied.</p>
                                                      </div>
                                                    </HoverCardContent>
                                                  </HoverCard>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-green-600 text-right ">
                                          ${((item.invoicedQty || 0) * item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                      </>
                                    )}
                                    <TableCell className="text-xs text-gray-500">{item.uom}</TableCell>
                                    <TableCell className="text-xs text-gray-600 text-right ">${item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-xs font-semibold text-gray-900 text-right ">${item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
