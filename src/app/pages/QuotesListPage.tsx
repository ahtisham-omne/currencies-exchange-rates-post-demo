// @ts-nocheck
import { useState, useEffect, useMemo, useCallback, useRef, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Quote, QuoteStatus, ColumnConfig } from '@/app/types/quote';
import { KanbanView, BoardColumnConfigSidebar } from '@/app/components/KanbanView';
import { CreateQuoteModal, QuoteDraft } from '@/app/components/CreateQuoteModal';
import { AssignSalesRepModal } from '@/app/components/modals/AssignSalesRepModal';
import { StatusBadge } from '@/app/components/StatusBadge';
import { PriorityBadge } from '@/app/components/PriorityBadge';
import { VersionBadge } from '@/app/components/VersionBadge';
import { VersionHistoryModal } from '@/app/components/VersionHistoryModal';
import { mockQuotes } from '@/app/data/mockQuotes';
import { addCreatedQuote } from '@/app/data/quoteStore';
import {
  ColumnSelector,
  ColumnSelectorTrigger,
  type ColumnConfig as ColSelectorConfig,
} from '@/app/components/quotes/ColumnSelector';
import {
  ColumnHeaderMenu,
  ActiveFiltersBar,
  applyColumnFilters,
  createBlankFilter,
  isFilterActive,
  type ColumnFilterState,
  type SortConfig,
} from '@/app/components/quotes/ColumnHeaderMenu';
import {
  KpiInsightsPanel,
  KpiIcon,
  ALL_KPI_DEFINITIONS,
  DEFAULT_ACTIVE_KPIS,
  computeKpiValue,
  computeKpiAmount,
} from '@/app/components/quotes/KpiInsightsPanel';
import { BaseCurrencyKPI } from '@/app/components/currency/BaseCurrencyKPI';
import { RateKpiValue } from '@/app/components/currency/RateKpiValue';
import { CurrencyAmount } from '@/app/components/ui/CurrencyAmount';
import { BASE_CURRENCY, convertBetween } from '@/app/data/currencyLibrary';
import {
  QuoteFiltersModal,
  DEFAULT_QUOTE_FILTERS,
  countActiveQuoteFilters,
  type QuoteAdvancedFilters,
} from '@/app/components/quotes/FiltersModal';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/app/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/app/components/ui/select';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Search, X, Plus, MoreHorizontal, Eye, Pencil, Archive, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, AlignJustify, List,
  LayoutGrid, Check, ChevronDown, User, SlidersHorizontal, GripVertical, ChartColumn,
  Calendar, Clock, BarChart3, FileText, Copy, Printer, ExternalLink, Link2,
  Trash2, Info, FileDown, Send, ArchiveRestore, Maximize2, Minimize2, Layers,
} from 'lucide-react';
import { format } from 'date-fns';

type DensityOption = 'condensed' | 'comfort' | 'board';
type QuickFilter = 'all' | 'draft' | 'sent' | 'confirmed_customer' | 'converted' | 'expired' | 'cancelled' | 'archived';

const DENSITY_CONFIG: { key: DensityOption; label: string; description: string; icon: string }[] = [
  { key: 'condensed', label: 'Condensed', description: 'Compact table view', icon: 'align-justify' },
  { key: 'comfort', label: 'Comfort', description: 'Spacious table view', icon: 'list' },
  { key: 'board', label: 'Board View', description: 'Kanban board', icon: 'layout-grid' },
];

/* Status pills — main list (no Archived) */
const MAIN_STATUS_PILLS: { key: QuickFilter; label: string; showCount: boolean }[] = [
  { key: 'all', label: 'Show All', showCount: false },
  { key: 'draft', label: 'Draft', showCount: true },
  { key: 'sent', label: 'Sent to Customer', showCount: true },
  { key: 'confirmed_customer', label: 'Confirmed by Customer', showCount: true },
  { key: 'converted', label: 'Converted to SO', showCount: true },
  { key: 'expired', label: 'Expired', showCount: true },
  { key: 'cancelled', label: 'Cancelled', showCount: true },
];

/* ─── Column configuration ─── */
const COLUMN_DEFS: (ColSelectorConfig & { minWidth: string; sortable?: boolean; align?: 'left' | 'right' })[] = [
  { key: 'quoteNumber', label: 'Quote No', minWidth: '300px', sortable: true },
  { key: 'customer', label: 'Customer Name', minWidth: '200px', sortable: true },
  { key: 'primaryPoC', label: 'Point of Contact', minWidth: '200px', sortable: true },
  { key: 'status', label: 'Status', minWidth: '150px', sortable: true },
  { key: 'totalValue', label: 'Quote Value', minWidth: '130px', sortable: true, align: 'right' },
  { key: 'deliveryLocation', label: 'Delivery Location', minWidth: '180px', sortable: true },
  { key: 'requestedDate', label: 'Requested', minWidth: '120px', sortable: true },
  { key: 'createdDate', label: 'Created', minWidth: '120px', sortable: true },
  { key: 'respondBy', label: 'Respond By', minWidth: '120px', sortable: true },
  { key: 'expiryDate', label: 'Expires', minWidth: '120px', sortable: true },
  { key: 'confirmationDate', label: 'Confirmed', minWidth: '120px', sortable: true },
  { key: 'salesRep', label: 'Sales Rep', minWidth: '180px', sortable: true },
  { key: 'priority', label: 'Priority', minWidth: '110px', sortable: true },
];

const DEFAULT_COLUMN_ORDER = COLUMN_DEFS.map(c => c.key);
const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(COLUMN_DEFS.map(c => [c.key, true]));
const LOCKED_COLUMNS = ['quoteNumber'];
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = Object.fromEntries(COLUMN_DEFS.map(c => [c.key, parseInt(c.minWidth, 10)]));
const MIN_COL_WIDTH = 1;
const CHECKBOX_COL_WIDTH = 40;

const DND_LIST_KPI = 'LIST_KPI_CARD';

/* ─── Avatar tints ─── */
const AVATAR_TINTS = [
  { bg: '#DBEAFE', text: '#1E40AF' }, { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#D1FAE5', text: '#065F46' }, { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#E0E7FF', text: '#3730A3' }, { bg: '#FEE2E2', text: '#991B1B' },
  { bg: '#CFFAFE', text: '#155E75' }, { bg: '#F3E8FF', text: '#6B21A8' },
];
function getAvatarTint(name: string) {
  const h = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

/* ─── DraggableListKpiCard — matches PM-V exactly ─── */
function DraggableListKpiCard({ index, kpiKey, label, value, valueNode, iconName, tooltip, moveCard, onRemove }: {
  index: number; kpiKey: string; label: string; value: string; valueNode?: React.ReactNode; iconName: string; tooltip?: string; moveCard: (from: number, to: number) => void; onRemove?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag, preview] = useDrag({ type: DND_LIST_KPI, item: () => ({ index }), collect: m => ({ isDragging: m.isDragging() }) });
  const [{ isOver }, drop] = useDrop({
    accept: DND_LIST_KPI,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index, hoverIndex = index;
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
    collect: m => ({ isOver: m.isOver() }),
  });
  preview(drop(ref));
  drag(ref);

  if (isDragging) {
    return <div ref={ref} className="rounded-lg border border-dashed border-[#0A77FF]/20 bg-[#0A77FF]/[0.02] min-h-[52px] pointer-events-none" />;
  }

  return (
    <div ref={ref}
      className={`border rounded-lg bg-white group relative min-w-0 transition-all duration-200 select-none cursor-grab active:cursor-grabbing ${
        isOver ? "border-[#0A77FF]/30 bg-[#0A77FF]/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]"
               : "border-[#E2E8F0] hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
      }`}>
      {isOver && <div className="absolute inset-0 rounded-lg bg-[#0A77FF]/[0.02] pointer-events-none" />}
      <div className="px-3 py-2">
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-[#F1F5F9] rounded-md p-1 z-10 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-[#64748B]" />
        </div>
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10.5px] text-[#64748B] whitespace-nowrap" style={{ fontWeight: 500 }}>{label}</p>
            {tooltip && (
              <div className="relative group/info inline-flex shrink-0">
                <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={e => e.stopPropagation()}>
                  <Info className="w-3 h-3 text-[#CBD5E1] hover:text-[#94A3B8] transition-colors cursor-help" />
                </button>
                <div className="absolute z-50 w-[220px] pointer-events-none opacity-0 group-hover/info:opacity-100 transition-opacity duration-200 bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2">
                  <div className="bg-white border border-border rounded-lg px-3 py-2 shadow-md text-[11px] text-muted-foreground" style={{ lineHeight: 1.55 }}>{tooltip}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        {valueNode
          ? <div className="text-[15px] text-[#0F172A]" style={{ fontWeight: 600, lineHeight: 1.2 }}>{valueNode}</div>
          : <div className="flex items-baseline gap-1.5"><p className="text-[15px] text-[#0F172A] tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p></div>}
      </div>
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
          title={`Remove ${label}`}>
          <Trash2 className="w-3 h-3 text-[#94A3B8] hover:text-[#EF4444]" />
        </button>
      )}
    </div>
  );
}

export function QuotesListPage() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>(mockQuotes);
  const [density, setDensity] = useState<DensityOption>('condensed');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [meMode, setMeMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const contentRef = useRef<HTMLDivElement>(null);

  // Modals
  const [isCreateQuoteModalOpen, setIsCreateQuoteModalOpen] = useState(false);
  const [showAssignRepModal, setShowAssignRepModal] = useState(false);
  const [versionHistoryQuote, setVersionHistoryQuote] = useState<{ id: string; version: number } | null>(null);
  const [kanbanFullscreen, setKanbanFullscreen] = useState(false);
  const [boardTimeDuration, setBoardTimeDuration] = useState('all');

  // Advanced filters modal
  const [advFilters, setAdvFilters] = useState<QuoteAdvancedFilters>({ ...DEFAULT_QUOTE_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = useMemo(() => countActiveQuoteFilters(advFilters), [advFilters]);

  // Row selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Quote Value column — Base ↔ Customer currency view (set from the column-header menu)
  const [quoteValueView, setQuoteValueView] = useState<'base' | 'partner'>('base');

  // Board state
  const [boardGroupBy, setBoardGroupBy] = useState<'none' | 'salesRep' | 'customer' | 'priority'>('none');
  const [isBoardColumnConfigModalOpen, setIsBoardColumnConfigModalOpen] = useState(false);
  const [boardVisibleColumns, setBoardVisibleColumns] = useState<QuoteStatus[]>(() => {
    const saved = localStorage.getItem('boardVisibleColumns');
    if (saved) return JSON.parse(saved);
    return ['Draft', 'Sent to Customer', 'Unconfirmed SO', 'Confirmed SO', 'Expired', 'Cancelled'];
  });

  // KPI insights
  const [activeKpis, setActiveKpis] = useState<string[]>([...DEFAULT_ACTIVE_KPIS]);
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);
  const [insightsDateRange, setInsightsDateRange] = useState('last_30');
  const [showInsights, setShowInsights] = useState(true);

  // Column config
  const [columnOrder, setColumnOrder] = useState<string[]>([...DEFAULT_COLUMN_ORDER]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({ ...DEFAULT_COLUMN_VISIBILITY });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ ...DEFAULT_COLUMN_WIDTHS });
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);

  // Column drag
  const colDragRef = useRef<{ columnKey: string; startX: number; startY: number; isDragging: boolean; lastSwapTime: number } | null>(null);
  const suppressNextClickRef = useRef(false);
  const ghostElRef = useRef<HTMLDivElement>(null);
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);

  // Column resize
  const resizeRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null);

  // Column filters (Notion-style)
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [autoOpenFilterKey, setAutoOpenFilterKey] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set(['quoteNumber']));

  const columnFiltersList = useMemo(() => Object.values(columnFilters), [columnFilters]);
  const columnLabels = useMemo(() => {
    const map: Record<string, string> = {};
    COLUMN_DEFS.forEach(c => { map[c.key] = c.label; });
    return map;
  }, []);

  // Escape key: clear selection first, then exit fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedRows.size > 0) { e.preventDefault(); setSelectedRows(new Set()); return; }
        if (kanbanFullscreen) { e.preventDefault(); setKanbanFullscreen(false); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedRows.size, kanbanFullscreen]);

  /* ─── Filter counts ─── */
  const filterCounts = useMemo(() => {
    const counts: Record<QuickFilter, number> = { all: quotes.length, draft: 0, sent: 0, confirmed_customer: 0, converted: 0, expired: 0, cancelled: 0, archived: 0 };
    quotes.forEach(q => {
      if (q.status === 'Draft') counts.draft++;
      if (q.status === 'Sent to Customer') counts.sent++;
      if (q.status === 'Unconfirmed SO') counts.confirmed_customer++;
      if (q.status === 'Confirmed SO') counts.converted++;
      if (q.status === 'Expired') counts.expired++;
      if (q.status === 'Cancelled') counts.cancelled++;
    });
    return counts;
  }, [quotes]);

  /* ─── Filtered + sorted quotes ─── */
  const filteredQuotes = useMemo(() => {
    let result = quotes.filter(q => {
      // Quick filter
      switch (quickFilter) {
        case 'draft': return q.status === 'Draft';
        case 'sent': return q.status === 'Sent to Customer';
        case 'confirmed_customer': return q.status === 'Unconfirmed SO';
        case 'converted': return q.status === 'Confirmed SO';
        case 'expired': return q.status === 'Expired';
        case 'cancelled': return q.status === 'Cancelled';
        default: return true;
      }
    });

    // Me mode
    if (meMode) {
      result = result.filter(q => {
        const repName = typeof q.salesRep === 'string' ? q.salesRep : q.salesRep?.name || '';
        return repName === 'Adrian User' || repName === 'Ahtisham Ahmad';
      });
    }

    // Search
    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      result = result.filter(quote => {
        const customerName = typeof quote.customer === 'string' ? quote.customer : quote.customer?.name || '';
        const salesRepName = typeof quote.salesRep === 'string' ? quote.salesRep : quote.salesRep?.name || '';
        return quote.quoteNumber?.toLowerCase().includes(sq) || customerName.toLowerCase().includes(sq) || salesRepName.toLowerCase().includes(sq) || quote.status?.toLowerCase().includes(sq);
      });
    }

    // Advanced filters
    const f = advFilters;
    if (f.statuses.length > 0) result = result.filter(q => f.statuses.includes(q.status));
    if (f.priorities.length > 0) result = result.filter(q => f.priorities.includes(q.priority));
    if (f.salesReps.length > 0) result = result.filter(q => { const n = typeof q.salesRep === 'string' ? q.salesRep : q.salesRep?.name || ''; return f.salesReps.includes(n); });
    if (f.customers.length > 0) result = result.filter(q => { const n = typeof q.customer === 'string' ? q.customer : q.customer?.name || ''; return f.customers.includes(n); });
    if (f.currencies.length > 0) result = result.filter(q => f.currencies.includes((q.customerCurrency ?? 'PKR').toUpperCase()));
    if (f.valueMin) result = result.filter(q => (q.totalValue || 0) >= Number(f.valueMin));
    if (f.valueMax) result = result.filter(q => (q.totalValue || 0) <= Number(f.valueMax));
    if (f.createdFrom) result = result.filter(q => q.createdDate && new Date(q.createdDate) >= new Date(f.createdFrom));
    if (f.createdTo) { const to = new Date(f.createdTo); to.setHours(23,59,59,999); result = result.filter(q => q.createdDate && new Date(q.createdDate) <= to); }
    if (f.expiryFrom) result = result.filter(q => q.expiryDate && new Date(q.expiryDate) >= new Date(f.expiryFrom));
    if (f.expiryTo) { const to = new Date(f.expiryTo); to.setHours(23,59,59,999); result = result.filter(q => q.expiryDate && new Date(q.expiryDate) <= to); }

    // Column filters
    result = applyColumnFilters(result, columnFiltersList);

    // Sort
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        const key = sortConfig.key;
        let aVal: any, bVal: any;
        switch (key) {
          case 'quoteNumber': aVal = a.quoteNumber || ''; bVal = b.quoteNumber || ''; break;
          case 'customer': aVal = typeof a.customer === 'string' ? a.customer : a.customer?.name || ''; bVal = typeof b.customer === 'string' ? b.customer : b.customer?.name || ''; break;
          case 'primaryPoC': aVal = typeof a.primaryPoC === 'string' ? a.primaryPoC : a.primaryPoC?.name || ''; bVal = typeof b.primaryPoC === 'string' ? b.primaryPoC : b.primaryPoC?.name || ''; break;
          case 'status': aVal = a.status || ''; bVal = b.status || ''; break;
          case 'totalValue': aVal = a.totalValue ?? 0; bVal = b.totalValue ?? 0; break;
          case 'salesRep': aVal = typeof a.salesRep === 'string' ? a.salesRep : a.salesRep?.name || ''; bVal = typeof b.salesRep === 'string' ? b.salesRep : b.salesRep?.name || ''; break;
          case 'priority': aVal = a.priority || ''; bVal = b.priority || ''; break;
          default: { aVal = a[key] instanceof Date ? a[key].getTime() : (a as any)[key] || ''; bVal = b[key] instanceof Date ? b[key].getTime() : (b as any)[key] || ''; }
        }
        if (typeof aVal === 'string' && typeof bVal === 'string') return dir * aVal.localeCompare(bVal);
        return dir * (aVal > bVal ? 1 : aVal < bVal ? -1 : 0);
      });
    }

    return result;
  }, [quotes, quickFilter, meMode, searchQuery, advFilters, columnFiltersList, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / recordsPerPage));
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);
  const paginatedQuotes = useMemo(() => filteredQuotes.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage), [filteredQuotes, currentPage, recordsPerPage]);

  /* ─── Column handlers ─── */
  const handleAddColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters(prev => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey) });
    setCurrentPage(1);
  }, []);
  const handleAddColumnFilterWithAutoOpen = useCallback((columnKey: string) => {
    setColumnFilters(prev => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey) });
    setAutoOpenFilterKey(null);
    setTimeout(() => setAutoOpenFilterKey(columnKey), 0);
  }, []);
  const handleColumnFilterChange = useCallback((columnKey: string, filter: ColumnFilterState) => {
    setColumnFilters(prev => ({ ...prev, [columnKey]: filter })); setCurrentPage(1);
  }, []);
  const handleRemoveColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters(prev => { const next = { ...prev }; delete next[columnKey]; return next; }); setCurrentPage(1);
  }, []);
  const handleClearAllColumnFilters = useCallback(() => { setColumnFilters({}); setCurrentPage(1); }, []);
  const handleSort = useCallback((key: string, direction: 'asc' | 'desc' | null) => {
    setSortConfig(direction === null ? null : { key, direction }); setCurrentPage(1);
  }, []);
  const handleHideColumn = useCallback((columnKey: string) => {
    setColumnVisibility(prev => ({ ...prev, [columnKey]: false }));
    setSortConfig(prev => prev?.key === columnKey ? null : prev);
    setColumnFilters(prev => { if (!prev[columnKey]) return prev; const next = { ...prev }; delete next[columnKey]; return next; });
    setFrozenColumns(prev => { if (!prev.has(columnKey)) return prev; const next = new Set(prev); next.delete(columnKey); return next; });
  }, []);
  const handleAutoOpened = useCallback(() => setAutoOpenFilterKey(null), []);
  const handleFreezeColumn = useCallback((columnKey: string) => {
    setFrozenColumns(prev => { const next = new Set(prev); if (next.has(columnKey) && columnKey !== 'quoteNumber') next.delete(columnKey); else next.add(columnKey); return next; });
  }, []);

  /* ─── Visible columns ─── */
  const validColumnKeys = useMemo(() => new Set(COLUMN_DEFS.map(c => c.key)), []);
  const visibleColumns = useMemo(() => {
    const ordered = columnOrder.filter(key => validColumnKeys.has(key) && columnVisibility[key] !== false);
    if (!ordered.includes('quoteNumber')) ordered.unshift('quoteNumber');
    else if (ordered[0] !== 'quoteNumber') { const idx = ordered.indexOf('quoteNumber'); ordered.splice(idx, 1); ordered.unshift('quoteNumber'); }
    return ordered;
  }, [columnOrder, columnVisibility]);

  const colDef = (key: string) => COLUMN_DEFS.find(c => c.key === key)!;

  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let cumLeft = CHECKBOX_COL_WIDTH;
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) { offsets[key] = cumLeft; cumLeft += columnWidths[key] ?? parseInt(colDef(key).minWidth, 10); }
    }
    return offsets;
  }, [visibleColumns, frozenColumns, columnWidths]);

  const lastFrozenKey = useMemo(() => {
    let last = '';
    for (const key of visibleColumns) { if (frozenColumns.has(key)) last = key; }
    return last;
  }, [visibleColumns, frozenColumns]);

  /* ─── Column drag reorder ─── */
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    if (LOCKED_COLUMNS.includes(columnKey) || isResizing || e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    colDragRef.current = { columnKey, startX, startY, isDragging: false, lastSwapTime: 0 };
    const DRAG_THRESHOLD = 5, SWAP_SETTLE_MS = 60;
    const onMove = (moveEvt: MouseEvent) => {
      if (!colDragRef.current) return;
      const dx = moveEvt.clientX - colDragRef.current.startX, dy = moveEvt.clientY - colDragRef.current.startY;
      if (!colDragRef.current.isDragging) { if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return; colDragRef.current.isDragging = true; document.body.style.userSelect = 'none'; document.body.style.cursor = 'grabbing'; setDraggingColumnKey(colDragRef.current.columnKey); }
      const ghost = ghostElRef.current; if (ghost) ghost.style.transform = `translate(${moveEvt.clientX}px, ${moveEvt.clientY}px)`;
      const now = performance.now(); if (now - colDragRef.current.lastSwapTime < SWAP_SETTLE_MS) return;
      const cursorX = moveEvt.clientX, draggedKey = colDragRef.current.columnKey;
      const draggedTh = document.querySelector<HTMLElement>(`th[data-col-drag-key="${draggedKey}"]`); if (!draggedTh) return;
      const draggedRect = draggedTh.getBoundingClientRect();
      if (cursorX >= draggedRect.left && cursorX <= draggedRect.right) return;
      const allThs = document.querySelectorAll<HTMLElement>('th[data-col-drag-key]');
      for (const th of allThs) {
        const rect = th.getBoundingClientRect(); if (cursorX < rect.left || cursorX > rect.right) continue;
        const k = th.getAttribute('data-col-drag-key'); if (!k || k === draggedKey || LOCKED_COLUMNS.includes(k)) break;
        setColumnOrder(prev => { const srcIdx = prev.indexOf(draggedKey); const tgtIdx = prev.indexOf(k); if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return prev; const next = [...prev]; next.splice(srcIdx, 1); next.splice(tgtIdx, 0, draggedKey); return next; });
        colDragRef.current.lastSwapTime = now; break;
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = ''; document.body.style.cursor = '';
      if (colDragRef.current?.isDragging) { suppressNextClickRef.current = true; requestAnimationFrame(() => { suppressNextClickRef.current = false; }); }
      colDragRef.current = null; setDraggingColumnKey(null);
    };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }, [isResizing]);

  /* ─── Column resize ─── */
  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault(); e.stopPropagation();
    const startWidth = columnWidths[columnKey] ?? parseInt(colDef(columnKey).minWidth, 10);
    resizeRef.current = { columnKey, startX: e.clientX, startWidth }; setIsResizing(true); setResizingColumnKey(columnKey);
    const handleMouseMove = (moveEvent: MouseEvent) => { if (!resizeRef.current) return; const delta = moveEvent.clientX - resizeRef.current.startX; const newWidth = Math.max(MIN_COL_WIDTH, resizeRef.current.startWidth + delta); setColumnWidths(prev => ({ ...prev, [resizeRef.current!.columnKey]: newWidth })); };
    const handleMouseUp = () => { resizeRef.current = null; setIsResizing(false); setResizingColumnKey(null); document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
  }, [columnWidths]);

  /* ─── Row selection ─── */
  const allPageSelected = paginatedQuotes.length > 0 && paginatedQuotes.every(q => selectedRows.has(q.id));
  const somePageSelected = paginatedQuotes.some(q => selectedRows.has(q.id));
  const handleSelectAll = useCallback(() => { setSelectedRows(prev => { const next = new Set(prev); if (allPageSelected) paginatedQuotes.forEach(q => next.delete(q.id)); else paginatedQuotes.forEach(q => next.add(q.id)); return next; }); }, [allPageSelected, paginatedQuotes]);
  const handleSelectRow = useCallback((id: string) => { setSelectedRows(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }, []);

  /* ─── KPI handlers ─── */
  const handleToggleKpi = (key: string) => setActiveKpis(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const moveKpi = useCallback((fromIndex: number, toIndex: number) => { setActiveKpis(prev => { const next = [...prev]; const [moved] = next.splice(fromIndex, 1); next.splice(toIndex, 0, moved); return next; }); }, []);
  const activeKpiDefs = useMemo(() => activeKpis.map(key => ALL_KPI_DEFINITIONS.find(d => d.key === key)).filter(Boolean) as typeof ALL_KPI_DEFINITIONS, [activeKpis]);

  /* ─── Quote creation ─── */
  const generateQuoteNumber = useCallback(() => {
    const existingNumbers = quotes.map(q => { const m = q.quoteNumber.match(/Q-(\d{3})-(\d{3})-(\d{3})/); return m ? parseInt(m[1] + m[2] + m[3], 10) : 0; }).filter(n => n > 0);
    const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNum = maxNum + 1; const numStr = String(nextNum).padStart(9, '0');
    return `Q-${numStr.substring(0, 3)}-${numStr.substring(3, 6)}-${numStr.substring(6, 9)}`;
  }, [quotes]);

  const handleQuoteCreated = useCallback((draft: QuoteDraft): { quoteId: string; quoteNumber: string } => {
    const now = new Date();
    const quoteId = `quote-created-${Date.now()}`;
    const quoteNumber = generateQuoteNumber();
    const totalValue = draft.lineItems.reduce((sum, item) => sum + item.total, 0);

    // Map fields from the wizard's QuoteDraft (customer in `draft.customer`,
    // PoC in `draft.primaryPoC`, FX in `draft.currency`, dates/tags inside
    // `draft.configuration`) onto the listing-page Quote shape. Earlier this
    // code referenced flat fields like `draft.customerName` that don't exist
    // on QuoteDraft, so most of the new quote was silently empty.
    const expiryDate = draft.configuration?.expiryDate ? new Date(draft.configuration.expiryDate) : undefined;
    const newQuote: Quote = {
      id: quoteId,
      quoteNumber,
      status: 'Draft' as QuoteStatus,
      priority: 'Medium',
      version: 1,
      customer: {
        id: draft.customer?.id || `cust-${Date.now()}`,
        name: draft.customer?.name || 'New Customer',
        location: draft.customer?.location ? { name: draft.customer.location, isPrimary: true } : undefined,
      },
      primaryPoC: draft.primaryPoC
        ? { id: draft.primaryPoC.id, name: draft.primaryPoC.name, email: draft.primaryPoC.email }
        : undefined as any,
      salesRep: undefined as any,
      totalValue,
      total: totalValue,
      subtotal: totalValue,
      customerCurrency: draft.currency || draft.customerDefaultCurrency || 'PKR',
      createdDate: now,
      requestedDate: now,
      expiryDate: expiryDate || now,
      lastUpdated: now,
      hasUnreadMessages: false,
      unreadMessageCount: 0,
      daysInCurrentStage: 0,
      description: draft.configuration?.notes || `Quote for ${draft.customer?.name || 'customer'}`,
      tags: draft.configuration?.tags || [],
    };

    // Persist line items separately — ItemsTabTableClean reads them via
    // getCreatedQuoteLineItems(quoteId). Without this, the detail page
    // falls back to MOCK_LINE_ITEMS regardless of what the user added.
    const createdLineItems = draft.lineItems.map(item => ({
      id: item.id || `li-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      productId: item.productId,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      total: item.total,
      image: item.image,
    }));

    setQuotes(prev => [newQuote, ...prev]);
    addCreatedQuote(newQuote, createdLineItems);
    setCurrentPage(1); setSearchQuery(''); setQuickFilter('all');
    return { quoteId, quoteNumber };
  }, [generateQuoteNumber]);

  const handleStatusChange = useCallback((quoteId: string, newStatus: QuoteStatus) => {
    setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: newStatus } : q));
  }, []);

  /* ─── Bulk actions ─── */
  const handleBulkArchive = () => { toast.success(`Archived ${selectedRows.size} quote${selectedRows.size > 1 ? 's' : ''}`); setSelectedRows(new Set()); };
  const handleBulkExportCSV = () => { toast.success(`Exporting CSV for ${selectedRows.size} quote${selectedRows.size > 1 ? 's' : ''}…`); };
  const handleBulkPrint = () => { toast.success(`Generating print view for ${selectedRows.size} quote${selectedRows.size > 1 ? 's' : ''}…`); };

  /* ─── Text helpers ─── */
  const highlightText = useCallback((text: string | undefined | null) => {
    if (!text) return <span>–</span>;
    if (!searchQuery || searchQuery.trim().length === 0) return <>{text}</>;
    const query = searchQuery.trim();
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    if (parts.length === 1) return <>{text}</>;
    return <>{parts.map((part, i) => i % 2 === 1 ? <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: '#FEFCE8', color: '#854D0E', fontWeight: 500 }}>{part}</mark> : <span key={i}>{part}</span>)}</>;
  }, [searchQuery]);

  const clearAllFilters = () => { setSearchQuery(''); setQuickFilter('all'); setAdvFilters({ ...DEFAULT_QUOTE_FILTERS }); setColumnFilters({}); setSortConfig(null); setCurrentPage(1); };
  const hasAnyFilter = !!searchQuery || quickFilter !== 'all' || activeFilterCount > 0 || Object.keys(columnFilters).length > 0;

  const fmtCurrency = (val: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  const fmtDate = (dateInput: Date | string | undefined | null) => {
    if (!dateInput) return '–';
    try { return format(new Date(dateInput), 'MMM dd, yyyy'); } catch { return '–'; }
  };

  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else { pages.push(1); if (currentPage > 3) pages.push('...'); const start = Math.max(2, currentPage - 1); const end = Math.min(totalPages - 1, currentPage + 1); for (let i = start; i <= end; i++) pages.push(i); if (currentPage < totalPages - 2) pages.push('...'); pages.push(totalPages); }
    return pages;
  };

  const isRelaxed = density === 'comfort';
  const isBoard = density === 'board';

  return (
    <>
      <div ref={contentRef} className="flex-1 min-w-0 flex flex-col h-full px-6 lg:px-8 py-6" style={{ paddingBottom: 0, overflowX: 'hidden', overflowY: 'auto' }}>

        {/* Page Header */}
        <div className="flex items-center justify-between shrink-0 -mx-6 lg:-mx-8 -mt-6 px-6 lg:px-8 pt-3.5 pb-3.5 bg-white border-b border-border" style={{ marginBottom: 16 }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EDF4FF' }}>
              <FileText className="w-4 h-4" style={{ color: '#0A77FF' }} />
            </div>
            <div>
              <h1 className="font-bold text-[20px]">Quotes</h1>
              <p className="text-xs text-muted-foreground" style={{ marginTop: 1 }}>Create, manage, and track customer quotes through the entire lifecycle.</p>
            </div>
          </div>
          <Button onClick={() => setIsCreateQuoteModalOpen(true)} className="bg-primary text-primary-foreground shrink-0">
            <Plus className="w-4 h-4 mr-1.5" /> Create New Quote
          </Button>
        </div>

        {/* KPI Insights — inline cards shown only in non-fullscreen, non-board mode */}
        {!kanbanFullscreen && !isBoard && showInsights && activeKpiDefs.length > 0 && (
          <div className="shrink-0" style={{ marginBottom: 12 }}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Performance Insights</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer">
                      <Calendar className="w-3 h-3" />
                      <span style={{ fontWeight: 500 }}>
                        {insightsDateRange === 'last_7' && 'Last 7 days'}
                        {insightsDateRange === 'last_30' && 'Last 30 days'}
                        {insightsDateRange === 'last_90' && 'Last 90 days'}
                        {insightsDateRange === 'last_365' && 'Last 12 months'}
                        {insightsDateRange === 'all_time' && 'All time'}
                      </span>
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[170px]">
                    {[{ key: 'last_7', label: 'Last 7 days' }, { key: 'last_30', label: 'Last 30 days' }, { key: 'last_90', label: 'Last 90 days' }, { key: 'last_365', label: 'Last 12 months' }, { key: 'all_time', label: 'All time' }].map(opt => (
                      <DropdownMenuItem key={opt.key} className="flex items-center justify-between cursor-pointer" onClick={() => setInsightsDateRange(opt.key)}>
                        <span className="text-sm">{opt.label}</span>
                        {insightsDateRange === opt.key && <Check className="w-3.5 h-3.5" style={{ color: '#0A77FF' }} />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button onClick={() => setInsightsPanelOpen(true)} className="inline-flex items-center gap-1 text-[11px] hover:bg-muted/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer" style={{ fontWeight: 500, color: '#0A77FF' }}>
                <Plus className="w-3 h-3" /> Add Insights
              </button>
            </div>
            <DndProvider backend={HTML5Backend}>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
                {activeKpiDefs.map((kpi, idx) => {
                  const value = computeKpiValue(kpi.key, quotes);
                  const amountPKR = kpi.isCurrency ? computeKpiAmount(kpi.key, quotes) : undefined;
                  const valueNode = kpi.key === 'market_rate'
                    ? <RateKpiValue rateType="market" />
                    : kpi.key === 'corporate_rate'
                      ? <RateKpiValue rateType="corporate" />
                      : amountPKR !== undefined
                        ? <BaseCurrencyKPI valuePKR={amountPKR} />
                        : undefined;
                  return <DraggableListKpiCard key={kpi.key} index={idx} kpiKey={kpi.key} label={kpi.label} value={value} valueNode={valueNode} iconName={kpi.iconName} tooltip={kpi.tooltip} moveCard={moveKpi} onRemove={() => handleToggleKpi(kpi.key)} />;
                })}
              </div>
            </DndProvider>
          </div>
        )}

        <KpiInsightsPanel open={insightsPanelOpen} onOpenChange={setInsightsPanelOpen} activeKpis={activeKpis} onToggleKpi={handleToggleKpi} quotes={quotes} />

        {/* Unified Table Container */}
        <div className="border border-border rounded-xl bg-card overflow-clip flex flex-1 min-h-0" style={{ marginBottom: 24 }}>
          <div className="flex-1 min-w-0 overflow-clip flex flex-col">

            {/* Row 1: Search + Filters ... Count + Density */}
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                  <Input placeholder="Search by quote no, customer, or rep..." value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20" />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {/* Filters button — Airbnb-style modal */}
                <button type="button" onClick={() => setFiltersOpen(true)}
                  className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 ${
                    activeFilterCount > 0 ? "text-primary border-primary/30" : "text-foreground border-border/80"
                  }`}>
                  <SlidersHorizontal className={`w-3.5 h-3.5 ${activeFilterCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 min-w-[18px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                      style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}>{activeFilterCount}</span>
                  )}
                </button>
              </div>

              {/* Count + Insights + Density + Columns */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                  {filteredQuotes.length !== quotes.length ? (
                    <><span className="text-foreground">{filteredQuotes.length}</span><span className="text-muted-foreground/60"> of </span><span className="text-muted-foreground">{quotes.length}</span><span className="text-muted-foreground/70"> quotes</span></>
                  ) : (
                    <><span className="text-foreground">{quotes.length}</span><span className="text-muted-foreground/70"> quotes</span></>
                  )}
                </span>
                <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

                {/* Insights toggle */}
                <button type="button" onClick={() => { if (!showInsights) setShowInsights(true); setInsightsPanelOpen(true); }}
                  className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none ${
                    insightsPanelOpen ? 'border-primary/30 bg-primary/[0.04] text-foreground' : 'border-border bg-white text-foreground hover:bg-muted/40'
                  }`}>
                  <ChartColumn className="w-[18px] h-[18px] text-muted-foreground/80" />
                  <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Insights</span>
                  {activeKpiDefs.length > 0 && (
                    <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]" style={{ backgroundColor: '#EDF4FF', color: '#0A77FF', fontWeight: 600 }}>{activeKpiDefs.length}</span>
                  )}
                </button>

                {/* Density dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none">
                      {density === 'condensed' && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                      {density === 'comfort' && <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
                      {density === 'board' && <LayoutGrid className="w-[18px] h-[18px] text-muted-foreground/80" />}
                      <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>{DENSITY_CONFIG.find(d => d.key === density)?.label}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[230px] p-1.5">
                    {DENSITY_CONFIG.map(opt => (
                      <DropdownMenuItem key={opt.key} className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md" onSelect={() => setDensity(opt.key)}>
                        {opt.icon === 'align-justify' && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                        {opt.icon === 'list' && <List className="w-5 h-5 text-muted-foreground shrink-0" />}
                        {opt.icon === 'layout-grid' && <LayoutGrid className="w-5 h-5 text-muted-foreground shrink-0" />}
                        <div className="flex-1 min-w-0"><div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div><div className="text-xs text-muted-foreground">{opt.description}</div></div>
                        {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: '#0A77FF' }} />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <ColumnSelectorTrigger visibleCount={visibleColumns.length} active={columnDrawerOpen} onClick={() => setColumnDrawerOpen(!columnDrawerOpen)} />

                {/* Fullscreen toggle — board view only */}
                {isBoard && (
                  <>
                    <div className="w-px h-5 bg-border/60 mx-1" />
                    <div className="relative group/fs">
                      <button type="button" onClick={() => setKanbanFullscreen(!kanbanFullscreen)}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none shrink-0">
                        <Maximize2 className="w-[18px] h-[18px] text-muted-foreground/80" />
                      </button>
                      <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/fs:opacity-100 transition-opacity pointer-events-none z-50">
                        <div className="bg-[#1E293B] text-white text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap" style={{ fontWeight: 500 }}>
                          Expand to fullscreen
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Row 2: Quick Filter Pills — Me mode + status pills + Archived */}
            <div className="flex items-center gap-1.5 px-4 pb-3 shrink-0" style={{ overflowX: isBoard ? 'visible' : 'auto', flexWrap: isBoard ? 'wrap' : 'nowrap' }}>
              {/* Me mode pill */}
              <button onClick={() => { setMeMode(!meMode); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  meMode ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                }`}
                style={{ fontWeight: meMode ? 500 : 400, color: meMode ? "#0A77FF" : undefined }}>
                <User className="w-3.5 h-3.5" /> Me mode
              </button>

              {/* Board-only inline pills: Group By + Time Duration */}
              {isBoard && !kanbanFullscreen && (
                <>
                  <div className="w-px h-5 bg-border mx-1 shrink-0" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${
                        boardGroupBy !== 'none' ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                      }`} style={{ fontWeight: boardGroupBy !== 'none' ? 500 : 400, color: boardGroupBy !== 'none' ? '#0A77FF' : undefined }}>
                        <Layers className="w-3.5 h-3.5" />
                        <span>{boardGroupBy === 'none' ? 'Group By' : boardGroupBy === 'salesRep' ? 'Sales Rep' : boardGroupBy === 'customer' ? 'Customer' : 'Priority'}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[180px]">
                      {[{ value: 'none', label: 'No Grouping' }, { value: 'salesRep', label: 'Sales Rep' }, { value: 'customer', label: 'Customer' }, { value: 'priority', label: 'Priority' }].map(opt => (
                        <DropdownMenuItem key={opt.value} className="flex items-center justify-between cursor-pointer" onClick={() => setBoardGroupBy(opt.value as any)}>
                          <span className="text-sm">{opt.label}</span>
                          {boardGroupBy === opt.value && <Check className="w-3.5 h-3.5" style={{ color: '#0A77FF' }} />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${
                        boardTimeDuration !== 'all' ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                      }`} style={{ fontWeight: boardTimeDuration !== 'all' ? 500 : 400, color: boardTimeDuration !== 'all' ? '#0A77FF' : undefined }}>
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{boardTimeDuration === 'last_7_days' ? 'Last 7 days' : boardTimeDuration === 'last_30_days' ? 'Last 30 days' : boardTimeDuration === 'last_6_months' ? 'Last 6 months' : boardTimeDuration === 'last_12_months' ? 'Last 12 months' : 'All'}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[170px]">
                      {[{ value: 'last_7_days', label: 'Last 7 days' }, { value: 'last_30_days', label: 'Last 30 days' }, { value: 'last_6_months', label: 'Last 6 months' }, { value: 'last_12_months', label: 'Last 12 months' }, { value: 'all', label: 'All' }].map(opt => (
                        <DropdownMenuItem key={opt.value} className="flex items-center justify-between cursor-pointer" onClick={() => setBoardTimeDuration(opt.value)}>
                          <span className="text-sm">{opt.label}</span>
                          {boardTimeDuration === opt.value && <Check className="w-3.5 h-3.5" style={{ color: '#0A77FF' }} />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}

              {!isBoard && (
                <>
                  <div className="w-px h-5 bg-border shrink-0" />
                  {MAIN_STATUS_PILLS.map(sf => {
                    const isActive = quickFilter === sf.key;
                    const count = filterCounts[sf.key as QuickFilter];
                    return (
                      <button key={sf.key} onClick={() => { setQuickFilter(sf.key); setCurrentPage(1); setSelectedRows(new Set()); }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isActive ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                        }`}
                        style={{ fontWeight: isActive ? 500 : 400, color: isActive ? '#0A77FF' : undefined }}>
                        {sf.label}
                        {sf.showCount && <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`} style={{ fontWeight: 600, color: isActive ? '#0A77FF' : '#475569' }}>{count}</span>}
                      </button>
                    );
                  })}
                  {/* Archived pill — separated */}
                  <div className="w-px h-5 bg-border mx-1 shrink-0" />
                  <button onClick={() => { setQuickFilter(quickFilter === 'archived' ? 'all' : 'archived'); setCurrentPage(1); setSelectedRows(new Set()); }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors shrink-0 cursor-pointer ${
                      quickFilter === 'archived' ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                    style={{ fontWeight: quickFilter === 'archived' ? 500 : 400 }}>
                    <Archive className="w-3 h-3" /> Archived
                    <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${quickFilter === 'archived' ? "bg-destructive/10" : "bg-muted"}`}
                      style={{ fontWeight: 600, color: quickFilter === 'archived' ? undefined : 'hsl(var(--foreground))' }}>
                      {filterCounts.archived}
                    </span>
                  </button>
                </>
              )}
            </div>

            {/* Active Column Filters Bar */}
            <ActiveFiltersBar columnFilters={columnFiltersList} columnLabels={columnLabels} quotes={quotes}
              onFilterChange={handleColumnFilterChange} onRemoveFilter={handleRemoveColumnFilter}
              onAddFilter={handleAddColumnFilterWithAutoOpen} onClearAll={handleClearAllColumnFilters}
              autoOpenKey={autoOpenFilterKey} onAutoOpened={handleAutoOpened}
              availableColumns={COLUMN_DEFS.map(c => ({ key: c.key, label: c.label }))} />

            <div className="border-t border-border shrink-0" />

            {isBoard ? (
              <KanbanView quotes={filteredQuotes} onStatusChange={handleStatusChange} onQuoteClick={id => navigate(`/quotes/${id}`)}
                groupBy={boardGroupBy} searchTerm={searchQuery} visibleColumns={boardVisibleColumns} onVisibleColumnsChange={setBoardVisibleColumns}
                onGroupByChange={setBoardGroupBy} onColumnConfig={() => setIsBoardColumnConfigModalOpen(true)} onViewDensityChange={setDensity as any} />
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">
                {/* ── Inline Bulk Action Bar — SO V5 style ── */}
                <div role="toolbar" aria-label="Bulk actions for selected quotes" aria-hidden={selectedRows.size === 0}
                  className="overflow-hidden transition-all duration-200 ease-out shrink-0"
                  style={{ height: selectedRows.size > 0 ? 48 : 0 }}>
                  <div className="flex items-center h-[48px] px-4" style={{ backgroundColor: "hsl(214 80% 98.5%)", borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[13px] whitespace-nowrap text-foreground"><span style={{ fontWeight: 700 }}>{selectedRows.size}</span><span style={{ fontWeight: 400 }}> quote{selectedRows.size !== 1 ? 's' : ''} selected</span></span>
                    </div>
                    <div className="w-px h-5 mx-3 shrink-0 bg-border" />
                    <div className="flex items-center gap-1.5">
                      <button onClick={handleBulkArchive} aria-label="Archive quotes"
                        className="inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-md text-[12px] border border-border bg-white text-foreground/70 transition-colors cursor-pointer hover:bg-muted/40 hover:text-foreground" style={{ fontWeight: 400 }}>
                        <Archive className="w-3.5 h-3.5" /><span className="hidden lg:inline">Archive</span>
                      </button>
                      <button onClick={() => setShowAssignRepModal(true)} aria-label="Assign rep"
                        className="inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-md text-[12px] border border-border bg-white text-foreground/70 transition-colors cursor-pointer hover:bg-muted/40 hover:text-foreground" style={{ fontWeight: 400 }}>
                        <User className="w-3.5 h-3.5" /><span className="hidden lg:inline">Assign Rep</span>
                      </button>
                      <button onClick={handleBulkExportCSV} aria-label="Export CSV"
                        className="inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-md text-[12px] border border-border bg-white text-foreground/70 transition-colors cursor-pointer hover:bg-muted/40 hover:text-foreground hidden md:inline-flex" style={{ fontWeight: 400 }}>
                        <FileDown className="w-3.5 h-3.5" /><span className="hidden lg:inline">Export</span>
                      </button>
                      <button onClick={handleBulkPrint} aria-label="Print quotes"
                        className="inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-md text-[12px] border border-border bg-white text-foreground/70 transition-colors cursor-pointer hover:bg-muted/40 hover:text-foreground hidden md:inline-flex" style={{ fontWeight: 400 }}>
                        <Printer className="w-3.5 h-3.5" /><span className="hidden lg:inline">Print</span>
                      </button>
                    </div>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] hidden sm:inline text-muted-foreground" style={{ fontWeight: 400 }}>Esc to clear</span>
                      <button onClick={() => setSelectedRows(new Set())} aria-label="Clear selection"
                        className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-md transition-colors cursor-pointer text-muted-foreground hover:bg-muted/40 hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div aria-live="polite" className="sr-only">{selectedRows.size > 0 ? `${selectedRows.size} quote${selectedRows.size !== 1 ? 's' : ''} selected` : 'Selection cleared'}</div>
                </div>

                {/* Table */}
                <div className={`flex-1 min-h-0 overflow-auto ${isResizing || draggingColumnKey ? 'select-none' : ''}`}>
                  <Table style={{ tableLayout: 'fixed', minWidth: `${CHECKBOX_COL_WIDTH + visibleColumns.reduce((sum, key) => sum + (columnWidths[key] ?? parseInt(colDef(key).minWidth, 10)), 0) + 60}px`, width: '100%' }}>
                    <TableHeader className="sticky top-0 z-20 bg-card">
                      <TableRow className={`bg-muted/30 hover:bg-muted/30 border-b border-border ${density === 'condensed' ? '[&>th]:h-8' : '[&>th]:h-9'}`}>
                        <TableHead className="sticky left-0 z-20 bg-[#f8fafc] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
                          <Checkbox checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false} onCheckedChange={handleSelectAll} aria-label="Select all rows" />
                        </TableHead>
                        {visibleColumns.map(key => {
                          const def = colDef(key);
                          const isFrozen = frozenColumns.has(key);
                          const isLocked = LOCKED_COLUMNS.includes(key);
                          const isDraggable = !isLocked;
                          const currentColSort: 'asc' | 'desc' | null = sortConfig?.key === key ? sortConfig.direction : null;
                          const hasFilter = columnFilters[key] ? isFilterActive(columnFilters[key]) : false;
                          const width = columnWidths[key] ?? parseInt(def.minWidth, 10);
                          const isBeingDragged = draggingColumnKey === key;
                          return (
                            <TableHead key={key} data-col-drag-key={key}
                              onMouseDown={isDraggable ? e => handleHeaderMouseDown(e, key) : undefined}
                              onClickCapture={isDraggable ? e => { if (suppressNextClickRef.current) { e.stopPropagation(); e.preventDefault(); } } : undefined}
                              className={`whitespace-nowrap relative group/colheader ${isFrozen ? 'sticky bg-[#f8fafc] z-20' : ''} ${isDraggable ? 'cursor-grab' : ''} ${def.align === 'right' ? 'text-right' : ''}`}
                              style={{
                                width: `${width}px`, overflow: 'hidden',
                                ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px` } : {}),
                                ...(key === lastFrozenKey && !isBeingDragged ? { boxShadow: 'inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)' } : {}),
                                ...(isBeingDragged ? { background: 'linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)' } : {}),
                              }}>
                              {isBeingDragged && <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: '#0A77FF' }} />}
                              {isDraggable && <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? 'opacity-100 text-primary' : 'opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40'}`} />}
                              <div className={`flex items-center ${def.align === 'right' ? 'w-full' : ''} px-2`}>
                                <ColumnHeaderMenu columnKey={key} label={def.label} sortable={def.sortable} sortConfig={sortConfig}
                                  onSort={handleSort} onAddFilter={handleAddColumnFilter} onHideColumn={handleHideColumn}
                                  onFreezeColumn={handleFreezeColumn} isFrozen={isFrozen} isLocked={isLocked} hasActiveFilter={hasFilter}
                                  filter={columnFilters[key] ?? null} quotes={quotes} onFilterChange={handleColumnFilterChange}
                                  currencyViewMode={key === 'totalValue' ? quoteValueView : undefined}
                                  onCurrencyViewModeChange={key === 'totalValue' ? setQuoteValueView : undefined}>
                                  <div className={`inline-flex items-center gap-1 ${def.align === 'right' ? 'w-full justify-end' : ''}`}>
                                    <span className="text-[13px]" style={currentColSort || hasFilter ? { color: '#0A77FF' } : undefined}>{def.label}</span>
                                    {hasFilter && !currentColSort && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#0A77FF' }} />}
                                    {currentColSort === 'asc' && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: '#0A77FF' }} />}
                                    {currentColSort === 'desc' && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: '#0A77FF' }} />}
                                    {!currentColSort && !hasFilter && def.sortable && <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />}
                                  </div>
                                </ColumnHeaderMenu>
                              </div>
                              <div onMouseDown={e => { e.stopPropagation(); handleResizeStart(e, key); }} onClick={e => e.stopPropagation()}
                                onDoubleClick={e => { e.stopPropagation(); setColumnWidths(prev => ({ ...prev, [key]: parseInt(def.minWidth, 10) })); }}
                                className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize" style={{ touchAction: 'none' }}>
                                <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${resizingColumnKey === key ? 'bg-primary' : 'bg-transparent group-hover/resize:bg-primary/40'}`} />
                              </div>
                            </TableHead>
                          );
                        })}
                        <TableHead className="whitespace-nowrap w-[60px] sticky right-0 bg-[#f8fafc] z-20 !pl-2 !pr-2" style={{ boxShadow: 'inset 1px 0 0 0 rgba(0,0,0,0.08)' }}>
                          <span className="text-[13px]">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedQuotes.length === 0 ? (
                        <TableRow><TableCell colSpan={visibleColumns.length + 2} className="text-center" style={{ height: 'calc(100vh - 480px)', minHeight: 200 }}>
                          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground h-full">
                            <FileText className="w-8 h-8" /><p className="text-sm">No quotes found</p>
                            {hasAnyFilter && <Button variant="link" size="sm" onClick={clearAllFilters}>Clear all filters</Button>}
                          </div>
                        </TableCell></TableRow>
                      ) : paginatedQuotes.map(quote => {
                        const customerName = typeof quote.customer === 'string' ? quote.customer : quote.customer?.name || '–';
                        const salesRepName = typeof quote.salesRep === 'string' ? quote.salesRep : quote.salesRep?.name || '–';
                        const pocName = typeof quote.primaryPoC === 'string' ? quote.primaryPoC : quote.primaryPoC?.name || '–';
                        const customerLoc = typeof quote.customer === 'object' ? quote.customer?.location?.name : '';

                        const renderCell = (colKey: string) => {
                          switch (colKey) {
                            case 'quoteNumber':
                              return (
                                <TableCell key={colKey}>
                                  <div className="flex items-center gap-2">
                                    <VersionBadge version={quote.version || 1} compact showExpandIcon onClick={(e) => { e.stopPropagation(); setVersionHistoryQuote({ id: quote.id, version: quote.version || 1 }); }} />
                                    <div className="flex flex-col min-w-0">
                                      <span className={isRelaxed ? 'text-[13.5px]' : 'text-sm'} style={{ fontWeight: 500, color: '#0A77FF' }}>{highlightText(quote.quoteNumber)}</span>
                                      {isRelaxed && <span className="text-[10px] text-muted-foreground/50 truncate">{quote.description || '–'}</span>}
                                    </div>
                                  </div>
                                </TableCell>
                              );
                            case 'customer':
                              return (
                                <TableCell key={colKey}>
                                  <div className={`flex items-center ${isRelaxed ? 'gap-2.5' : 'gap-2'}`}>
                                    {(() => { const t = getAvatarTint(customerName); const initials = customerName.split(/[\s&]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase(); return (
                                      <div className={`${isRelaxed ? 'w-8 h-8' : 'w-7 h-7'} rounded-lg flex items-center justify-center shrink-0 border border-[#E8ECF1]`} style={{ backgroundColor: t.bg }}>
                                        <span className="text-[10px]" style={{ fontWeight: 700, color: t.text }}>{initials}</span>
                                      </div>
                                    ); })()}
                                    <div className="min-w-0 flex-1">
                                      <span className={`${isRelaxed ? 'text-[13.5px]' : 'text-sm'} block truncate`} style={{ fontWeight: 500, color: '#334155' }}>{highlightText(customerName)}</span>
                                      {isRelaxed && customerLoc && <span className="text-[10px] text-muted-foreground/50 truncate block">{customerLoc}</span>}
                                    </div>
                                  </div>
                                </TableCell>
                              );
                            case 'primaryPoC':
                              return (
                                <TableCell key={colKey}>
                                  <div className={`flex items-center ${isRelaxed ? 'gap-2.5' : 'gap-2'}`}>
                                    {(() => { const t = getAvatarTint(pocName); const initials = pocName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase(); return (
                                      <div className={`${isRelaxed ? 'w-7 h-7' : 'w-6 h-6'} rounded-lg flex items-center justify-center shrink-0 border border-[#E8ECF1]`} style={{ backgroundColor: t.bg }}>
                                        <span style={{ fontSize: isRelaxed ? 9 : 8, fontWeight: 700, color: '#334155' }}>{initials}</span>
                                      </div>
                                    ); })()}
                                    <span className={`${isRelaxed ? 'text-[13.5px]' : 'text-sm'} truncate`} style={{ fontWeight: 500, color: '#334155' }}>{highlightText(pocName)}</span>
                                  </div>
                                </TableCell>
                              );
                            case 'status': return <TableCell key={colKey}><StatusBadge status={quote.status} /></TableCell>;
                            case 'totalValue': {
                              const customerCur = (quote.customerCurrency ?? BASE_CURRENCY).toUpperCase();
                              const isBase = customerCur === BASE_CURRENCY;
                              const showAsPartner = quoteValueView === 'partner' && !isBase;
                              return (
                                <TableCell key={colKey} className="text-right">
                                  <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                                    {isBase
                                      ? <CurrencyAmount mode="single" currency={BASE_CURRENCY} value={quote.totalValue || 0} />
                                      : showAsPartner
                                      ? <CurrencyAmount
                                          mode="listing-partner"
                                          currency={customerCur}
                                          value={convertBetween(quote.totalValue || 0, BASE_CURRENCY, customerCur)}
                                        />
                                      : <CurrencyAmount
                                          mode="listing-base"
                                          currency={BASE_CURRENCY}
                                          value={quote.totalValue || 0}
                                          partnerDefaultCurrency={customerCur}
                                          partnerDefaultValue={convertBetween(quote.totalValue || 0, BASE_CURRENCY, customerCur)}
                                        />}
                                  </span>
                                </TableCell>
                              );
                            }
                            case 'deliveryLocation': return <TableCell key={colKey}><span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{highlightText(customerLoc || '–')}</span></TableCell>;
                            case 'requestedDate': return <TableCell key={colKey}><span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{fmtDate(quote.requestedDate)}</span></TableCell>;
                            case 'createdDate': return <TableCell key={colKey}><span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{fmtDate(quote.createdDate)}</span></TableCell>;
                            case 'respondBy': return <TableCell key={colKey}><span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{fmtDate(quote.respondBy)}</span></TableCell>;
                            case 'expiryDate': return <TableCell key={colKey}><span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{fmtDate(quote.expiryDate)}</span></TableCell>;
                            case 'confirmationDate': return <TableCell key={colKey}><span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{fmtDate(quote.confirmationDate)}</span></TableCell>;
                            case 'salesRep':
                              return (
                                <TableCell key={colKey}>
                                  <div className="flex items-center gap-2">
                                    {(() => { const t = getAvatarTint(salesRepName); const initials = salesRepName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase(); return (
                                      <div className={`${isRelaxed ? 'w-7 h-7' : 'w-6 h-6'} rounded-lg flex items-center justify-center shrink-0 border border-[#E8ECF1]`} style={{ backgroundColor: t.bg }}>
                                        <span style={{ fontSize: isRelaxed ? 9 : 8, fontWeight: 700, color: '#334155' }}>{initials}</span>
                                      </div>
                                    ); })()}
                                    <span className="whitespace-nowrap" style={{ fontWeight: 500, fontSize: '13px', color: '#334155' }}>{highlightText(salesRepName)}</span>
                                  </div>
                                </TableCell>
                              );
                            case 'priority': return <TableCell key={colKey}><PriorityBadge priority={quote.priority} /></TableCell>;
                            default: return <TableCell key={colKey}>–</TableCell>;
                          }
                        };

                        return (
                          <TableRow key={quote.id}
                            className={`cursor-pointer group hover:bg-[#F0F7FF] ${density === 'condensed' ? '[&>td]:py-1 [&>td]:px-2' : '[&>td]:py-2 [&>td]:px-2'}`}
                            onClick={() => navigate(`/quotes/${quote.id}`)}>
                            <TableCell className="sticky left-0 z-10 bg-card group-hover:bg-[#F0F7FF] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
                              <Checkbox checked={selectedRows.has(quote.id)} onCheckedChange={() => handleSelectRow(quote.id)} onClick={e => e.stopPropagation()} />
                            </TableCell>
                            {visibleColumns.map(key => {
                              const cell = renderCell(key);
                              const w = columnWidths[key] ?? parseInt(colDef(key).minWidth, 10);
                              const isDraggedCol = draggingColumnKey === key;
                              const cellWidthStyle: React.CSSProperties = { width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: 'hidden', textOverflow: 'ellipsis', ...(isDraggedCol ? { backgroundColor: 'rgba(10,119,255,0.035)' } : {}) };
                              if (frozenColumns.has(key)) {
                                const defAlign = colDef(key).align;
                                return cloneElement(cell, {
                                  className: `${cell.props.className || ''} sticky z-10 bg-card group-hover:bg-[#F0F7FF] ${defAlign === 'right' ? 'text-right' : ''}`.trim(),
                                  style: { ...cell.props.style, ...cellWidthStyle, left: `${frozenOffsets[key] ?? 0}px`, ...(key === lastFrozenKey ? { boxShadow: 'inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)' } : {}) },
                                });
                              }
                              const defAlign = colDef(key).align;
                              return cloneElement(cell, { className: `${cell.props.className || ''} ${defAlign === 'right' ? 'text-right' : ''}`.trim(), style: { ...cell.props.style, ...cellWidthStyle } });
                            })}
                            <TableCell className="sticky right-0 bg-card group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2" style={{ boxShadow: 'inset 1px 0 0 0 rgba(0,0,0,0.08)' }}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                  <button type="button" className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[200px]" onClick={e => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={() => navigate(`/quotes/${quote.id}`)}><Eye className="w-4 h-4 mr-2" /> View Details</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => navigate(`/quotes/${quote.id}/edit`)}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/quotes/${quote.id}`); toast.success('Link copied'); }}>
                                    <Link2 className="w-4 h-4 mr-2" /> Copy Link
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toast.info('Print – coming soon')}><Printer className="w-4 h-4 mr-2" /> Print Quote</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {!isBoard && filteredQuotes.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Records per page</span>
                  <Select value={String(recordsPerPage)} onValueChange={val => { setRecordsPerPage(Number(val)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}><ChevronsLeft className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </Button>
                  {getPageNumbers().map((page, idx) =>
                    page === '...' ? (<span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">...</span>) : (
                      <Button key={page} variant={currentPage === page ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0 text-sm" onClick={() => setCurrentPage(page as number)}>{page}</Button>
                    )
                  )}
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}><ChevronsRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </div>

          {/* Column Selector Side Drawer */}
          <ColumnSelector columns={COLUMN_DEFS} columnOrder={columnOrder} columnVisibility={columnVisibility}
            onColumnOrderChange={setColumnOrder} onColumnVisibilityChange={setColumnVisibility}
            lockedColumns={LOCKED_COLUMNS} open={columnDrawerOpen} onOpenChange={setColumnDrawerOpen} />
        </div>
      </div>

      {/* Modals */}
      <QuoteFiltersModal open={filtersOpen} onOpenChange={setFiltersOpen} filters={advFilters} onFiltersChange={f => { setAdvFilters(f); setCurrentPage(1); }} quotes={quotes} filteredCount={filteredQuotes.length} />
      <CreateQuoteModal
        open={isCreateQuoteModalOpen}
        onOpenChange={setIsCreateQuoteModalOpen}
        onQuoteCreated={handleQuoteCreated}
        onNavigateToQuote={(id) => navigate(`/quotes/${id}`)}
      />
      <AssignSalesRepModal open={showAssignRepModal} onOpenChange={setShowAssignRepModal} selectedCount={selectedRows.size}
        onAssign={rep => { toast.success(`Assigned ${rep} to ${selectedRows.size} quote${selectedRows.size > 1 ? 's' : ''}`); setSelectedRows(new Set()); setShowAssignRepModal(false); }} />
      {versionHistoryQuote && (
        <VersionHistoryModal quoteId={versionHistoryQuote.id} currentVersion={versionHistoryQuote.version} onClose={() => setVersionHistoryQuote(null)} />
      )}

      {/* ═══ Kanban Fullscreen Portal ═══ */}
      {kanbanFullscreen && createPortal(
        <div className="fixed inset-0 z-[200] flex flex-col bg-background" style={{ overflow: 'hidden' }}>

          {/* Collapsible Insights in fullscreen */}
          {showInsights && activeKpiDefs.length > 0 && (
            <div className="shrink-0 px-5 pt-3" style={{ paddingBottom: 4 }}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Performance Insights</span>
                <button onClick={() => setShowInsights(false)} className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <DndProvider backend={HTML5Backend}>
                <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
                  {activeKpiDefs.map((kpi, idx) => {
                    const value = computeKpiValue(kpi.key, quotes);
                    const amountPKR = kpi.isCurrency ? computeKpiAmount(kpi.key, quotes) : undefined;
                    const valueNode = amountPKR !== undefined
                      ? <BaseCurrencyKPI valuePKR={amountPKR} />
                      : undefined;
                    return <DraggableListKpiCard key={kpi.key} index={idx} kpiKey={kpi.key} label={kpi.label} value={value} valueNode={valueNode} iconName={kpi.iconName} tooltip={kpi.tooltip} moveCard={moveKpi} onRemove={() => handleToggleKpi(kpi.key)} />;
                  })}
                </div>
              </DndProvider>
            </div>
          )}

          {/* Collapsed insights toggle */}
          {!showInsights && activeKpiDefs.length > 0 && (
            <div className="flex items-center gap-2 shrink-0 px-5 py-2">
              <button onClick={() => setShowInsights(true)} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
                <BarChart3 className="w-3 h-3" /> Show Insights
              </button>
            </div>
          )}

          {/* White card with full content */}
          <div className="bg-card border border-border relative flex flex-col min-h-0 flex-1 overflow-clip rounded-xl mx-4 mb-4 mt-2">

            {/* Fullscreen Toolbar */}
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                  <Input placeholder="Search by quote no, customer, or rep..." value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20" />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button type="button" onClick={() => setFiltersOpen(true)}
                  className={`inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none shrink-0 ${
                    activeFilterCount > 0 ? "text-primary border-primary/30" : "text-foreground border-border/80"
                  }`}>
                  <SlidersHorizontal className={`w-3.5 h-3.5 ${activeFilterCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 min-w-[18px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white"
                      style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}>{activeFilterCount}</span>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Insights toggle */}
                <button type="button" onClick={() => { setShowInsights(!showInsights); }}
                  className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none ${
                    showInsights ? 'border-primary/30 bg-primary/[0.04] text-foreground' : 'border-border bg-white text-foreground hover:bg-muted/40'
                  }`}>
                  <ChartColumn className="w-[18px] h-[18px] text-muted-foreground/80" />
                  <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Insights</span>
                </button>
                <div className="w-px h-5 bg-border/60 mx-1" />
                {/* Exit fullscreen */}
                <div className="relative group/fs">
                  <button type="button" onClick={() => setKanbanFullscreen(false)}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none shrink-0">
                    <Minimize2 className="w-[18px] h-[18px] text-muted-foreground/80" />
                  </button>
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/fs:opacity-100 transition-opacity pointer-events-none z-50">
                    <div className="bg-[#1E293B] text-white text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap" style={{ fontWeight: 500 }}>
                      Exit fullscreen · <kbd className="text-[10px] opacity-70">Esc</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fullscreen Pills Row */}
            <div className="flex items-center gap-1.5 px-4 pb-3 shrink-0" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
              {/* Me mode */}
              <button onClick={() => { setMeMode(!meMode); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  meMode ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                }`}
                style={{ fontWeight: meMode ? 500 : 400, color: meMode ? "#0A77FF" : undefined }}>
                <User className="w-3.5 h-3.5" /> Me mode
              </button>
              <div className="w-px h-5 bg-border mx-1 shrink-0" />

              {/* Group By */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${
                    boardGroupBy !== 'none' ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                  }`} style={{ fontWeight: boardGroupBy !== 'none' ? 500 : 400, color: boardGroupBy !== 'none' ? '#0A77FF' : undefined }}>
                    <Layers className="w-3.5 h-3.5" />
                    <span>{boardGroupBy === 'none' ? 'Group By' : boardGroupBy === 'salesRep' ? 'Sales Rep' : boardGroupBy === 'customer' ? 'Customer' : 'Priority'}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[180px]">
                  {[{ value: 'none', label: 'No Grouping' }, { value: 'salesRep', label: 'Sales Rep' }, { value: 'customer', label: 'Customer' }, { value: 'priority', label: 'Priority' }].map(opt => (
                    <DropdownMenuItem key={opt.value} className="flex items-center justify-between cursor-pointer" onClick={() => setBoardGroupBy(opt.value as any)}>
                      <span className="text-sm">{opt.label}</span>
                      {boardGroupBy === opt.value && <Check className="w-3.5 h-3.5" style={{ color: '#0A77FF' }} />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Time Duration */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${
                    boardTimeDuration !== 'all' ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                  }`} style={{ fontWeight: boardTimeDuration !== 'all' ? 500 : 400, color: boardTimeDuration !== 'all' ? '#0A77FF' : undefined }}>
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{boardTimeDuration === 'last_7_days' ? 'Last 7 days' : boardTimeDuration === 'last_30_days' ? 'Last 30 days' : boardTimeDuration === 'last_6_months' ? 'Last 6 months' : boardTimeDuration === 'last_12_months' ? 'Last 12 months' : 'All'}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[170px]">
                  {[{ value: 'last_7_days', label: 'Last 7 days' }, { value: 'last_30_days', label: 'Last 30 days' }, { value: 'last_6_months', label: 'Last 6 months' }, { value: 'last_12_months', label: 'Last 12 months' }, { value: 'all', label: 'All' }].map(opt => (
                    <DropdownMenuItem key={opt.value} className="flex items-center justify-between cursor-pointer" onClick={() => setBoardTimeDuration(opt.value)}>
                      <span className="text-sm">{opt.label}</span>
                      {boardTimeDuration === opt.value && <Check className="w-3.5 h-3.5" style={{ color: '#0A77FF' }} />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-px h-5 bg-border mx-1 shrink-0" />

              {/* Status filter pills */}
              {MAIN_STATUS_PILLS.map(sf => {
                const isActive = quickFilter === sf.key;
                const count = filterCounts[sf.key as QuickFilter];
                return (
                  <button key={sf.key} onClick={() => { setQuickFilter(sf.key); setCurrentPage(1); setSelectedRows(new Set()); }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                    }`}
                    style={{ fontWeight: isActive ? 500 : 400, color: isActive ? '#0A77FF' : undefined }}>
                    {sf.label}
                    {sf.showCount && <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`} style={{ fontWeight: 600, color: isActive ? '#0A77FF' : '#475569' }}>{count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border shrink-0" />

            {/* Kanban board fills remaining space */}
            <div className="flex-1 min-h-0 flex relative">
              <KanbanView quotes={filteredQuotes} onStatusChange={handleStatusChange} onQuoteClick={id => navigate(`/quotes/${id}`)}
                groupBy={boardGroupBy} searchTerm={searchQuery} visibleColumns={boardVisibleColumns} onVisibleColumnsChange={setBoardVisibleColumns}
                onGroupByChange={setBoardGroupBy} isFullscreen={true} onFullscreenToggle={() => setKanbanFullscreen(false)} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
